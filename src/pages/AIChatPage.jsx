import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, Send, BarChart3, TrendingUp, Maximize2, Mic, MicOff, X, Bot, Sparkles, Search, ChartLine, AudioLines, Zap, RotateCcw, Paperclip, FileSpreadsheet } from 'lucide-react';
import { Chart as ReactChart } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
    Title, Tooltip, Legend, BarElement, Filler, ArcElement, RadialLinearScale,
    PieController, DoughnutController, RadarController, PolarAreaController,
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { sendMessageToGemini, resetConversation } from '../services/geminiService';
import {
    studentStatsData, universityBudgetData, scienceFacultyBudgetData,
} from '../data/mockData';
import { scienceStudentList, SCIENCE_MAJORS } from '../data/studentListData';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, RadialLinearScale, Title, Tooltip, Legend, BarElement, Filler, ArcElement, PieController, DoughnutController, RadarController, PolarAreaController, zoomPlugin);

// ==================== Linear Regression Forecasting ====================
function linearRegression(dataPoints) {
    const n = dataPoints.length;
    if (n < 3) return null;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (const { x, y } of dataPoints) { sumX += x; sumY += y; sumXY += x * y; sumXX += x * x; }
    const denom = n * sumXX - sumX * sumX;
    if (denom === 0) return null;
    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept, predict: (x) => Math.round(slope * x + intercept) };
}

// ==================== Available Datasets ====================
const DATASETS = {
    universityBudgetRevenue: {
        label: 'รายรับมหาวิทยาลัย', unit: 'ล้านบาท', scope: 'มหาวิทยาลัย',
        getData: () => universityBudgetData.yearly.filter(y => y.type === 'actual').map(y => ({ x: parseInt(y.year), y: y.revenue })),
        color: '#00a651', keywords: ['รายรับ', 'revenue'],
        scopeKeywords: ['มหาวิทยาลัย', 'มจ', 'mju', 'ทั้งหมด']
    },
    universityBudgetExpense: {
        label: 'รายจ่ายมหาวิทยาลัย', unit: 'ล้านบาท', scope: 'มหาวิทยาลัย',
        getData: () => universityBudgetData.yearly.filter(y => y.type === 'actual').map(y => ({ x: parseInt(y.year), y: y.expense })),
        color: '#E91E63', keywords: ['รายจ่าย', 'expense', 'ค่าใช้จ่าย'],
        scopeKeywords: ['มหาวิทยาลัย', 'มจ', 'mju', 'ทั้งหมด']
    },
    universityBudget: {
        label: 'งบประมาณมหาวิทยาลัย (รายรับ)', unit: 'ล้านบาท', scope: 'มหาวิทยาลัย',
        getData: () => universityBudgetData.yearly.filter(y => y.type === 'actual').map(y => ({ x: parseInt(y.year), y: y.revenue })),
        color: '#00a651', keywords: ['งบประมาณ', 'budget', 'งบ'],
        scopeKeywords: ['มหาวิทยาลัย', 'มจ', 'mju', 'ทั้งหมด']
    },
    scienceBudgetRevenue: {
        label: 'รายรับคณะวิทยาศาสตร์', unit: 'ล้านบาท', scope: 'คณะวิทยาศาสตร์',
        getData: () => scienceFacultyBudgetData.yearly.filter(y => y.type === 'actual').map(y => ({ x: parseInt(y.year), y: y.revenue })),
        color: '#006838', keywords: ['รายรับ', 'revenue', 'งบประมาณ', 'budget', 'งบ'],
        scopeKeywords: ['คณะวิทยาศาสตร์', 'วิทยาศาสตร์', 'science', 'คณะวิทย์']
    },
    scienceBudgetExpense: {
        label: 'รายจ่ายคณะวิทยาศาสตร์', unit: 'ล้านบาท', scope: 'คณะวิทยาศาสตร์',
        getData: () => scienceFacultyBudgetData.yearly.filter(y => y.type === 'actual').map(y => ({ x: parseInt(y.year), y: y.expense })),
        color: '#A23B72', keywords: ['รายจ่าย', 'expense', 'ค่าใช้จ่าย'],
        scopeKeywords: ['คณะวิทยาศาสตร์', 'วิทยาศาสตร์', 'science', 'คณะวิทย์']
    },
    universityStudents: {
        label: 'จำนวนนิสิตมหาวิทยาลัย', unit: 'คน', scope: 'มหาวิทยาลัย',
        getData: () => studentStatsData.trend.filter(t => t.type === 'actual').map(t => ({ x: parseInt(t.year), y: t.total })),
        color: '#7B68EE', keywords: ['นิสิต', 'นักศึกษา', 'student', 'จำนวนนิสิต'],
        scopeKeywords: ['มหาวิทยาลัย', 'มจ', 'mju', 'ทั้งหมด']
    },
    scienceStudents: {
        label: 'จำนวนนิสิตคณะวิทยาศาสตร์', unit: 'คน', scope: 'คณะวิทยาศาสตร์',
        getData: () => studentStatsData.scienceFaculty.byEnrollmentYear.map(e => ({ x: parseInt(e.year), y: e.count })),
        color: '#006838', keywords: ['นิสิต', 'นักศึกษา', 'student', 'จำนวนนิสิต'],
        scopeKeywords: ['คณะวิทยาศาสตร์', 'วิทยาศาสตร์', 'science', 'คณะวิทย์']
    }
};

// ==================== Request Parser ====================
function parseForecastRequest(question) {
    const q = question.toLowerCase();
    const forecastKeywords = ['พยากรณ์', 'คาดการณ์', 'ประมาณการ', 'ทำนาย', 'predict', 'forecast', 'คาดว่า'];
    const isForecast = forecastKeywords.some(k => q.includes(k));
    if (!isForecast) return null;

    let chartType = 'line';
    if (q.includes('แท่ง') || q.includes('bar')) chartType = 'bar';
    if (q.includes('เส้น') || q.includes('line') || q.includes('กราฟเส้น')) chartType = 'line';

    const years = [];
    const yearPatterns = q.matchAll(/ปี\s*(\d{2,4})/g);
    for (const match of yearPatterns) { let y = parseInt(match[1]); if (y < 100) y += 2500; years.push(y); }
    if (years.length === 0) {
        const numMatches = q.matchAll(/\b(\d{2,4})\b/g);
        for (const match of numMatches) { let y = parseInt(match[1]); if (y >= 2500 && y <= 2600) years.push(y); else if (y >= 60 && y <= 99) years.push(y + 2500); }
    }
    if (years.length === 0) years.push(2570, 2571);

    const isScience = ['คณะวิทยาศาสตร์', 'วิทยาศาสตร์', 'science', 'คณะวิทย์'].some(k => q.includes(k));
    let matchedDatasets = [];

    for (const [key, ds] of Object.entries(DATASETS)) {
        const hasKeyword = ds.keywords.some(k => q.includes(k));
        const hasScopeMatch = isScience
            ? ds.scopeKeywords.some(k => ['คณะวิทยาศาสตร์', 'วิทยาศาสตร์', 'science', 'คณะวิทย์'].includes(k))
            : ds.scopeKeywords.some(k => ['มหาวิทยาลัย', 'มจ', 'mju', 'ทั้งหมด'].includes(k));
        if (hasKeyword && hasScopeMatch) matchedDatasets.push(key);
    }

    if (matchedDatasets.length === 0 && isScience) {
        if (q.includes('งบประมาณ') || q.includes('budget') || q.includes('งบ') || q.includes('รายรับ') || q.includes('รายจ่าย')) {
            matchedDatasets = (q.includes('รายจ่าย') || q.includes('expense')) ? ['scienceBudgetExpense'] : ['scienceBudgetRevenue'];
        } else if (q.includes('นิสิต') || q.includes('นักศึกษา') || q.includes('student')) {
            matchedDatasets = ['scienceStudents'];
        }
    }

    if (matchedDatasets.length === 0) {
        if (q.includes('งบประมาณ') || q.includes('budget') || q.includes('งบ')) matchedDatasets = ['universityBudget'];
        else if (q.includes('รายรับ') || q.includes('revenue')) matchedDatasets = ['universityBudgetRevenue'];
        else if (q.includes('รายจ่าย') || q.includes('expense')) matchedDatasets = ['universityBudgetExpense'];
        else if (q.includes('นิสิต') || q.includes('นักศึกษา') || q.includes('student')) matchedDatasets = ['universityStudents'];
    }

    if (matchedDatasets.includes('universityBudget') && matchedDatasets.includes('universityBudgetRevenue')) {
        matchedDatasets = matchedDatasets.filter(d => d !== 'universityBudget');
    }

    return { years: years.sort(), chartType, datasets: matchedDatasets, isScience };
}

// ==================== Generate Forecast Response ====================
function generateForecastResponse(parsed) {
    if (!parsed || parsed.datasets.length === 0) {
        return {
            text: '⚠️ **ข้อมูลไม่เพียงพอในการคาดการณ์**\n\nระบบมีข้อมูลสำหรับพยากรณ์ดังนี้:\n' +
                '• 📈 งบประมาณมหาวิทยาลัย (รายรับ/รายจ่าย)\n' +
                '• 🔬 งบประมาณคณะวิทยาศาสตร์ (รายรับ/รายจ่าย)\n' +
                '• จำนวนนิสิตมหาวิทยาลัย\n' +
                '• 🧪 จำนวนนิสิตคณะวิทยาศาสตร์\n\n' +
                'ลองถามใหม่ เช่น "พยากรณ์งบประมาณคณะวิทยาศาสตร์ ปี 70 71 แบบกราฟ"',
            chart: null
        };
    }

    const results = [];
    const allLabels = [];
    const allDatasets = [];

    for (const dsKey of parsed.datasets) {
        const ds = DATASETS[dsKey];
        const dataPoints = ds.getData();
        if (dataPoints.length < 3) { results.push(`⚠️ ${ds.label}: ข้อมูลไม่เพียงพอ`); continue; }

        const model = linearRegression(dataPoints);
        if (!model) { results.push(`⚠️ ${ds.label}: ไม่สามารถสร้างโมเดลพยากรณ์ได้`); continue; }

        const existingYears = dataPoints.map(d => d.x);
        const allYears = [...new Set([...existingYears, ...parsed.years])].sort();
        const labels = allYears.map(y => `ปี ${y}`);
        const actualValues = allYears.map(y => { const f = dataPoints.find(d => d.x === y); return f ? f.y : null; });
        const forecastValues = allYears.map(y => {
            if (existingYears.includes(y)) {
                return y === Math.max(...existingYears) ? dataPoints.find(d => d.x === y).y : null;
            }
            return model.predict(y);
        });

        if (allLabels.length === 0) allLabels.push(...labels);

        allDatasets.push({
            label: `${ds.label} (ข้อมูลจริง)`, data: actualValues,
            borderColor: ds.color, backgroundColor: ds.color + '20',
            fill: parsed.chartType === 'line', tension: 0.4,
            pointBackgroundColor: ds.color, pointRadius: 5, borderWidth: 2,
            borderRadius: parsed.chartType === 'bar' ? 6 : 0,
        });
        allDatasets.push({
            label: `${ds.label} (พยากรณ์)`, data: forecastValues,
            borderColor: ds.color, borderDash: [6, 3], backgroundColor: ds.color + '40',
            tension: 0.4, pointBackgroundColor: ds.color + 'cc', pointRadius: 5,
            pointStyle: 'triangle', borderWidth: 2,
            borderRadius: parsed.chartType === 'bar' ? 6 : 0,
        });

        const forecastSummary = parsed.years.map(y => `   ปี ${y}: ~${model.predict(y).toLocaleString()} ${ds.unit}`).join('\n');
        results.push(`📊 **${ds.label}**\nข้อมูลจริง: ${existingYears[0]}-${existingYears[existingYears.length - 1]} (${existingYears.length} ปี)\nพยากรณ์ (Linear Regression):\n${forecastSummary}`);
    }

    const chartConfig = allDatasets.length > 0 ? {
        chartType: parsed.chartType,
        data: { labels: allLabels, datasets: allDatasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 8, font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const ds = DATASETS[parsed.datasets[0]];
                            return `${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString() || '-'} ${ds?.unit || ''}`;
                        }
                    }
                }
            },
            scales: {
                x: { ticks: { color: '#9ca3af', font: { size: 11 } }, grid: { display: false } },
                y: { ticks: { color: '#9ca3af', font: { size: 11 }, callback: (v) => v.toLocaleString() }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    } : null;

    return { text: results.join('\n\n') + '\n\n💡 _อ้างอิงจากข้อมูลในระบบเท่านั้น (Linear Regression)_', chart: chartConfig };
}

// ==================== Student Data (Real from MJU) ====================
const MAJORS = SCIENCE_MAJORS;
const ALL_STUDENTS = scienceStudentList;

// ==================== Smart Student Search ====================
function searchStudents(query) {
    const q = query.toLowerCase();
    let limit = 0;
    const limitMatch = q.match(/(\d+)\s*(คน|ราย|รายการ)/);
    if (limitMatch) limit = parseInt(limitMatch[1]);
    const limitMatch2 = q.match(/(?:แค่|ขอ|เอา|แสดง|โชว์)\s*(\d+)/);
    if (!limit && limitMatch2) limit = parseInt(limitMatch2[1]);

    let results = [];
    let searchDesc = '';

    const idPrefixMatch = q.match(/(?:รหัส|id)\s*(\d{2,8})/i) || q.match(/\b(6[0-9]\d{0,6})\b/);
    if (idPrefixMatch) {
        const prefix = idPrefixMatch[1];
        results = ALL_STUDENTS.filter(s => s.id.startsWith(prefix));
        searchDesc = `รหัสขึ้นต้นด้วย "${prefix}"`;
    }

    if (results.length === 0) {
        const namePatterns = ['ชื่อ', 'หา', 'ค้นหา'];
        for (const p of namePatterns) {
            const idx = q.indexOf(p);
            if (idx !== -1) {
                const searchTerm = q.slice(idx + p.length).trim().split(/\s+/)[0];
                if (searchTerm.length >= 2) {
                    results = ALL_STUDENTS.filter(s => s.name.includes(searchTerm));
                    searchDesc = `ชื่อ "${searchTerm}"`;
                    break;
                }
            }
        }
    }

    const majorKeywords = { 'คอม': 'วิทยาการคอมพิวเตอร์', 'ไอที': 'เทคโนโลยีสารสนเทศ', 'it': 'เทคโนโลยีสารสนเทศ', 'คณิต': 'คณิตศาสตร์', 'เคมี': 'เคมี', 'ฟิสิกส์': 'ฟิสิกส์', 'ชีว': 'ชีววิทยา', 'ข้อมูล': 'วิทยาการข้อมูล', 'data': 'วิทยาการข้อมูล', 'สถิติ': 'สถิติ' };
    if (results.length === 0) {
        for (const [kw, major] of Object.entries(majorKeywords)) {
            if (q.includes(kw) && (q.includes('สาขา') || q.includes('นักศึกษา') || q.includes('นิสิต') || q.includes('คน') || q.includes('รายชื่อ') || q.includes('ใคร'))) {
                results = ALL_STUDENTS.filter(s => s.major === major);
                searchDesc = `สาขา${major}`;
                break;
            }
        }
    }

    if (results.length === 0) {
        const yearMatch = q.match(/(?:ชั้นปี|ปี)\s*(\d)/);
        if (yearMatch && (q.includes('นักศึกษา') || q.includes('นิสิต') || q.includes('รายชื่อ') || q.includes('คน') || q.includes('ใคร'))) {
            const yr = parseInt(yearMatch[1]);
            results = ALL_STUDENTS.filter(s => s.year === yr);
            searchDesc = `ชั้นปี ${yr}`;
        }
    }

    if (results.length === 0) {
        if (q.includes('รอพินิจ') || q.includes('เกรดต่ำ') || q.includes('เสี่ยง')) {
            results = ALL_STUDENTS.filter(s => s.gpa < 2.0);
            searchDesc = 'สถานะรอพินิจ (GPA < 2.00)';
        } else if (q.includes('เกรดสูง') || q.includes('เกียรตินิยม') || q.includes('gpa สูง')) {
            results = ALL_STUDENTS.filter(s => s.gpa >= 3.5).sort((a, b) => b.gpa - a.gpa);
            searchDesc = 'GPA สูง (≥ 3.50)';
        }
    }

    if (results.length === 0) return null;

    const total = results.length;
    if (limit > 0) results = results.slice(0, limit);

    let text = `📋 **พบนักศึกษา ${searchDesc}** จำนวน ${total} คน`;
    if (limit > 0 && total > limit) text += ` (แสดง ${limit} คน)`;
    text += '\n\n';

    results.forEach((s, i) => {
        const gpaColor = s.gpa >= 3.5 ? '🟢' : s.gpa >= 2.5 ? '🟡' : s.gpa >= 2.0 ? '🟠' : '🔴';
        text += `**${i + 1}.** \`${s.id}\` ${s.name}\n`;
        text += `   📚 ${s.major} | ชั้นปี ${s.year} | ${gpaColor} GPA ${s.gpa} | ${s.status}\n`;
    });

    if (total > results.length) {
        text += `\n_...และอีก ${total - results.length} คน (พิมพ์ "ขอทั้งหมด" เพื่อดูเพิ่ม)_`;
    }

    return { text, chart: null };
}

// ==================== Check if query needs local handling ====================
function tryLocalResponse(question) {
    const q = question.toLowerCase();
    const forecastParsed = parseForecastRequest(question);
    if (forecastParsed) return generateForecastResponse(forecastParsed);
    const studentKeywords = ['รหัส', 'รายชื่อ', 'หานักศึกษา', 'ค้นหานักศึกษา', 'นักศึกษา', 'นิสิต', 'สาขา', 'ชั้นปี', 'รอพินิจ', 'เกรดต่ำ', 'เกรดสูง', 'เกียรตินิยม'];
    const hasStudentQuery = studentKeywords.some(k => q.includes(k)) &&
        (q.match(/\d{2,}/) || q.includes('สาขา') || q.includes('ชั้นปี') || q.includes('รอพินิจ') || q.includes('เกรดต่ำ') || q.includes('เกรดสูง') || q.includes('เกียรตินิยม') || q.includes('รายชื่อ') || q.includes('ใคร') || q.includes('คน'));
    if (hasStudentQuery) {
        const studentResult = searchStudents(q);
        if (studentResult) return studentResult;
    }
    return null;
}

// ==================== Parse AI Generated Chart ====================
function parseAIResponse(text) {
    const regex = /```json_chart\s*([\s\S]*?)\s*```/;
    const match = text.match(regex);
    let chartConfig = null;
    let cleanText = text;

    if (match) {
        try {
            const rawJson = JSON.parse(match[1]);
            cleanText = text.replace(regex, '').trim();
            const isRadar = rawJson.chartType === 'radar' || rawJson.chartType === 'polarArea';

            if (isRadar) {
                const neonColors = [
                    { border: '#00e5ff', fill: 'rgba(0, 229, 255, 0.4)' },
                    { border: '#e91e63', fill: 'rgba(233, 30, 99, 0.4)' },
                    { border: '#00e676', fill: 'rgba(0, 230, 118, 0.4)' },
                    { border: '#ffea00', fill: 'rgba(255, 234, 0, 0.4)' }
                ];
                rawJson.data.datasets.forEach((ds, i) => {
                    const colorSet = neonColors[i % neonColors.length];
                    ds.borderColor = colorSet.border;
                    ds.backgroundColor = colorSet.fill;
                    ds.pointBackgroundColor = colorSet.border;
                    ds.pointBorderColor = '#fff';
                    ds.pointBorderWidth = 2;
                    ds.pointRadius = 4;
                    ds.pointHoverRadius = 6;
                    ds.borderWidth = 2;
                });
            }

            chartConfig = {
                chartType: rawJson.chartType || 'bar',
                data: rawJson.data,
                options: rawJson.options || {
                    responsive: true, maintainAspectRatio: false,
                    elements: isRadar ? { line: { tension: 0.1 } } : undefined,
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 12, font: { size: 11 } } },
                        zoom: {
                            pan: { enabled: true, mode: 'xy' },
                            zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' }
                        }
                    },
                    scales: isRadar ? {
                        r: {
                            angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            pointLabels: { color: '#e5e7eb', font: { size: 11, weight: 'bold' } },
                            ticks: { display: false, min: 0, max: 100 }
                        }
                    } : (rawJson.chartType === 'pie' || rawJson.chartType === 'doughnut') ? {} : {
                        x: { ticks: { color: '#9ca3af', font: { size: 11 } }, grid: { display: false } },
                        y: { ticks: { color: '#9ca3af', font: { size: 11 }, callback: (v) => v.toLocaleString() }, grid: { color: 'rgba(255,255,255,0.05)' } }
                    }
                }
            };
        } catch (e) {
            console.error('Failed to parse Generative Chart JSON:', e);
        }
    }
    return { text: cleanText, chart: chartConfig };
}

// ==================== Chat Message Component ====================
function ChatMessage({ msg, onExpand }) {
    const [chartType, setChartType] = useState(msg.chart?.chartType || 'line');

    if (msg.role === 'user') {
        return (
            <div className="ai-page-msg ai-page-msg-user">
                <div className="ai-page-msg-bubble user">{msg.text}</div>
            </div>
        );
    }

    const formatText = (text) => {
        if (!text) return null;
        return text.split('\n').map((line, i) => {
            const parts = line.split(/(\*\*.*?\*\*|_.*?_|`.*?`)/g).map((part, j) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={j}>{part.slice(2, -2)}</strong>;
                }
                if (part.startsWith('_') && part.endsWith('_')) {
                    return <em key={j} style={{ fontSize: '0.9em', color: '#9ca3af' }}>{part.slice(1, -1)}</em>;
                }
                if (part.startsWith('`') && part.endsWith('`')) {
                    return <code key={j} style={{ background: 'rgba(0,230,118,0.15)', color: '#00e676', padding: '2px 6px', borderRadius: 4, fontSize: '0.88em' }}>{part.slice(1, -1)}</code>;
                }
                return part;
            });
            return <div key={i}>{parts}</div>;
        });
    };

    const chartData = msg.chart;

    return (
        <div className="ai-page-msg ai-page-msg-bot">
            <div className="ai-page-msg-avatar">🤖</div>
            <div className="ai-page-msg-content">
                <div className="ai-page-msg-bubble bot">{formatText(msg.text)}</div>

                {chartData && (
                    <div className="ai-page-chart-container">
                        <div className="ai-page-chart-toolbar">
                            {(chartType === 'line' || chartType === 'bar') && (
                                <>
                                    <button
                                        className={`ai-page-chart-btn ${chartType === 'line' ? 'active' : ''}`}
                                        onClick={() => setChartType('line')}
                                    >
                                        <TrendingUp size={14} /> กราฟเส้น
                                    </button>
                                    <button
                                        className={`ai-page-chart-btn ${chartType === 'bar' ? 'active' : ''}`}
                                        onClick={() => setChartType('bar')}
                                    >
                                        <BarChart3 size={14} /> กราฟแท่ง
                                    </button>
                                </>
                            )}
                            <button
                                className="ai-page-chart-btn"
                                onClick={() => onExpand({ ...chartData, chartType })}
                                style={{ marginLeft: 'auto' }}
                            >
                                <Maximize2 size={14} /> ขยาย
                            </button>
                        </div>
                        <div className="ai-page-chart-wrapper">
                            <ReactChart type={chartType} data={chartData.data} options={chartData.options} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}


// ==================== Main AIChatPage Component ====================
// ==================== CSV/File Parser ====================
function parseCSVContent(text) {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return null;

    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).map(line => {
        const vals = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
        const obj = {};
        headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
        return obj;
    });

    // Auto-detect numeric columns
    const numericCols = headers.filter(h => {
        const vals = rows.map(r => parseFloat(r[h])).filter(v => !isNaN(v));
        return vals.length >= rows.length * 0.5;
    });

    // Auto-detect label column (first non-numeric column)
    const labelCol = headers.find(h => !numericCols.includes(h)) || headers[0];

    return { headers, rows, numericCols, labelCol, rowCount: rows.length };
}

function generateChartFromFile(parsed, fileName) {
    if (!parsed || parsed.numericCols.length === 0) return null;

    const colors = ['#00a651', '#2E86AB', '#E91E63', '#C5A028', '#7B68EE', '#FF6B6B', '#006838', '#A23B72'];
    const labels = parsed.rows.map(r => r[parsed.labelCol]);
    const datasets = parsed.numericCols.slice(0, 6).map((col, i) => ({
        label: col,
        data: parsed.rows.map(r => parseFloat(r[col]) || 0),
        borderColor: colors[i % colors.length],
        backgroundColor: colors[i % colors.length] + '40',
        fill: false,
        tension: 0.4,
        pointRadius: 4,
        borderWidth: 2,
        borderRadius: 6,
    }));

    const chartType = parsed.numericCols.length <= 2 ? 'bar' : 'line';

    return {
        chartType,
        data: { labels, datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 8, font: { size: 11 } } },
                title: { display: true, text: `📁 ${fileName}`, color: '#fff', font: { size: 14 } },
            },
            scales: {
                x: { ticks: { color: '#9ca3af', maxRotation: 45 }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } },
            },
        },
    };
}

export default function AIChatPage() {
    const [expandedChart, setExpandedChart] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);
    const fileInputRef = useRef(null);
    const [uploadedFileData, setUploadedFileData] = useState(null);
    const [messages, setMessages] = useState([
        {
            role: 'bot',
            text: 'สวัสดีครับ! ผม **MJU AI Assistant** (Powered by Gemini ✨)\n\nพร้อมช่วยตอบคำถามเกี่ยวกับข้อมูลมหาวิทยาลัยแม่โจ้ ถามมาได้เลยครับ!\n\n🔮 **ฟีเจอร์ทั้งหมด:**\n• 💬 แชทสอบถามข้อมูลทั่วไป\n• 📊 สร้างกราฟและพยากรณ์ข้อมูล\n• 🔍 ค้นหานักศึกษา\n• 🎤 สั่งงานด้วยเสียง\n• 📎 **อัปโหลดไฟล์ CSV** เพื่อวิเคราะห์และสร้างกราฟ\n\nลองเลือก Quick Action ด้านล่าง หรือพิมพ์คำถามได้เลยครับ!',
            chart: null
        }
    ]);
    const [input, setInput] = useState('');
    const [typing, setTyping] = useState(false);
    const messagesEnd = useRef(null);

    // ── Speech Recognition Setup ──
    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'th-TH';

            recognitionRef.current.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setInput(prev => (prev + ' ' + transcript).trim());
                setIsListening(false);
            };
            recognitionRef.current.onerror = () => setIsListening(false);
            recognitionRef.current.onend = () => setIsListening(false);
        }
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) return alert("เบราว์เซอร์ของคุณไม่รองรับการสั่งงานด้วยเสียง");
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            try { recognitionRef.current.start(); setIsListening(true); } catch (e) { console.error(e); }
        }
    };

    useEffect(() => {
        messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, typing]);

    const handleNewChat = useCallback(() => {
        resetConversation();
        setMessages([{
            role: 'bot',
            text: '🔄 **เริ่มบทสนทนาใหม่แล้ว!**\n\nถามมาได้เลยครับ ผมพร้อมช่วยเสมอ!',
            chart: null
        }]);
    }, []);

    // ── File Upload Handler ──
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        const fileName = file.name;
        const ext = fileName.split('.').pop().toLowerCase();

        if (!['csv', 'txt', 'tsv'].includes(ext)) {
            setMessages(prev => [...prev, {
                role: 'bot',
                text: `⚠️ **รองรับเฉพาะไฟล์ CSV, TSV, TXT**\n\nไฟล์ "${fileName}" ไม่รองรับ กรุณาแปลงเป็นไฟล์ .csv ก่อนอัปโหลด`,
                chart: null
            }]);
            return;
        }

        setMessages(prev => [...prev, { role: 'user', text: `📎 อัปโหลดไฟล์: **${fileName}**` }]);
        setTyping(true);

        try {
            const text = await file.text();
            const parsed = parseCSVContent(text);

            if (!parsed || parsed.rows.length === 0) {
                setMessages(prev => [...prev, {
                    role: 'bot',
                    text: `⚠️ ไม่สามารถอ่านข้อมูลจากไฟล์ "${fileName}" ได้\n\nตรวจสอบว่าไฟล์มีหัวคอลัมน์ (header row) และข้อมูลอย่างน้อย 1 แถว`,
                    chart: null
                }]);
                return;
            }

            setUploadedFileData(parsed);
            const chart = generateChartFromFile(parsed, fileName);

            // Build summary text
            let summaryText = `📊 **วิเคราะห์ไฟล์: ${fileName}**\n\n`;
            summaryText += `📋 **ข้อมูล:** ${parsed.rowCount} แถว × ${parsed.headers.length} คอลัมน์\n`;
            summaryText += `📌 **คอลัมน์:** ${parsed.headers.join(', ')}\n`;
            summaryText += `📈 **คอลัมน์ตัวเลข:** ${parsed.numericCols.join(', ') || 'ไม่พบ'}\n\n`;

            // Show sample data
            summaryText += `🔍 **ตัวอย่างข้อมูล (5 แถวแรก):**\n`;
            parsed.rows.slice(0, 5).forEach((row, i) => {
                summaryText += `${i + 1}. ${parsed.headers.map(h => `${h}: ${row[h]}`).join(' | ')}\n`;
            });

            if (parsed.numericCols.length > 0) {
                summaryText += `\n✅ **สร้างกราฟจากข้อมูลให้แล้ว!**`;
                summaryText += `\n💡 ลองถาม: "เปรียบเทียบ ${parsed.numericCols[0]} กับข้อมูลในระบบ" เพื่อรวมกับข้อมูล 5 ด้าน`;
            } else {
                summaryText += `\n⚠️ ไม่พบคอลัมน์ตัวเลข จึงไม่สามารถสร้างกราฟอัตโนมัติได้`;
            }

            setMessages(prev => [...prev, { role: 'bot', text: summaryText, chart }]);

            // Also send to Gemini for AI analysis
            const dataPreview = parsed.rows.slice(0, 15).map(r => Object.values(r).join(', ')).join('\n');
            const aiPrompt = `ผู้ใช้อัปโหลดไฟล์ "${fileName}" มีข้อมูล ${parsed.rowCount} แถว คอลัมน์: ${parsed.headers.join(', ')}\n\nตัวอย่างข้อมูล:\n${dataPreview}\n\nช่วยวิเคราะห์และสรุปข้อมูลนี้ให้หน่อย จุดที่น่าสนใจ แนวโน้ม และข้อเสนอแนะ`;

            try {
                const aiText = await sendMessageToGemini(aiPrompt);
                const parsedAI = parseAIResponse(aiText);
                setMessages(prev => [...prev, {
                    role: 'bot',
                    text: `🤖 **AI วิเคราะห์เพิ่มเติม:**\n\n${parsedAI.text}`,
                    chart: parsedAI.chart
                }]);
            } catch (err) {
                console.log('AI analysis skipped:', err.message);
            }

        } catch (err) {
            setMessages(prev => [...prev, {
                role: 'bot',
                text: `❌ อ่านไฟล์ล้มเหลว: ${err.message}`,
                chart: null
            }]);
        } finally {
            setTyping(false);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || typing) return;
        const userMsg = input.trim();
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInput('');
        setTyping(true);

        try {
            // Try local response first (forecast, student search)
            const localResult = tryLocalResponse(userMsg);
            if (localResult) {
                setMessages(prev => [...prev, { role: 'bot', text: localResult.text, chart: localResult.chart }]);
                setTyping(false);
                return;
            }
            // If user has uploaded file data, include it in context
            let contextMsg = userMsg;
            if (uploadedFileData) {
                const preview = uploadedFileData.rows.slice(0, 10).map(r => Object.values(r).join(', ')).join('\n');
                contextMsg = `[บริบท: ผู้ใช้มีข้อมูลไฟล์ที่อัปโหลด คอลัมน์: ${uploadedFileData.headers.join(', ')} จำนวน ${uploadedFileData.rowCount} แถว ตัวอย่าง:\n${preview}]\n\nคำถาม: ${userMsg}`;
            }
            const aiText = await sendMessageToGemini(contextMsg);
            const parsedAI = parseAIResponse(aiText);
            setMessages(prev => [...prev, { role: 'bot', text: parsedAI.text, chart: parsedAI.chart }]);
        } catch (error) {
            console.error('[AIChatPage] Gemini API error:', error);
            setMessages(prev => [...prev, {
                role: 'bot',
                text: `❌ **เกิดข้อผิดพลาด** ไม่สามารถเชื่อมต่อกับ AI ได้\n\n🔍 รายละเอียด: ${error.message}\n\n💡 ลองตรวจสอบ API Key หรือลองถามคำถามใหม่อีกครั้ง`,
                chart: null
            }]);
        } finally {
            setTyping(false);
        }
    };

    const handleKeyDown = (e) => { if (e.key === 'Enter') handleSend(); };

    const quickActions = [
        { label: '🔮 พยากรณ์งบฯ คณะวิทย์', query: 'พยากรณ์งบประมาณคณะวิทยาศาสตร์ ปี 70 71 เป็นกราฟ', icon: ChartLine },
        { label: '📊 คาดการณ์จำนวนนิสิต', query: 'พยากรณ์จำนวนนิสิตมหาวิทยาลัย ปี 70 71 แบบกราฟแท่ง', icon: TrendingUp },
        { label: '📈 งบฯ มหาวิทยาลัย', query: 'พยากรณ์งบประมาณมหาวิทยาลัย ปี 2570 2571 เป็นกราฟเส้น', icon: BarChart3 },
        { label: '🔍 ค้นหานิสิตรอพินิจ', query: 'แสดงรายชื่อนักศึกษาที่สถานะรอพินิจ', icon: Search },
        { label: '🎓 นิสิตเกียรตินิยม', query: 'แสดงนักศึกษาเกรดสูง เกียรตินิยม', icon: Sparkles },
        { label: '💰 สรุปงบประมาณ', query: 'สรุปภาพรวมงบประมาณคณะวิทยาศาสตร์ปีล่าสุด', icon: BarChart3 },
    ];

    const handleQuickAction = async (query) => {
        if (typing) return;
        setMessages(prev => [...prev, { role: 'user', text: query }]);
        setTyping(true);
        try {
            const aiText = await sendMessageToGemini(query);
            const parsedAI = parseAIResponse(aiText);
            setMessages(prev => [...prev, { role: 'bot', text: parsedAI.text, chart: parsedAI.chart }]);
        } catch (error) {
            console.error('[AIChatPage] Gemini API error:', error);
            setMessages(prev => [...prev, {
                role: 'bot',
                text: `❌ **เกิดข้อผิดพลาด** ไม่สามารถเชื่อมต่อกับ AI ได้\n\n🔍 ${error.message}`,
                chart: null
            }]);
        } finally {
            setTyping(false);
        }
    };

    const featureCards = [
        { icon: Bot, title: 'ถาม-ตอบ AI', desc: 'สอบถามข้อมูลมหาวิทยาลัย, งบประมาณ, นักศึกษา', color: '#00e676' },
        { icon: ChartLine, title: 'พยากรณ์ข้อมูล', desc: 'สร้างกราฟพยากรณ์งบประมาณ/จำนวนนิสิต', color: '#00e5ff' },
        { icon: Search, title: 'ค้นหานักศึกษา', desc: 'ค้นหาตามรหัส, ชื่อ, สาขา, ชั้นปี, GPA', color: '#7B68EE' },
        { icon: Paperclip, title: 'อัปโหลดไฟล์', desc: 'แนบ CSV เพื่อวิเคราะห์และสร้างกราฟอัตโนมัติ', color: '#C5A028' },
        { icon: AudioLines, title: 'สั่งงานด้วยเสียง', desc: 'กดปุ่มไมค์แล้วพูดคำสั่งเป็นภาษาไทย', color: '#E91E63' },
        { icon: Maximize2, title: 'ขยาย/ซูมกราฟ', desc: 'คลิก "ขยาย" เพื่อดูกราฟเต็มจอพร้อมซูม', color: '#FF6B6B' },
    ];

    return (
        <div className="ai-chat-page">
            {/* Header */}
            <div className="ai-chat-page-header">
                <div className="ai-chat-page-header-left">
                    <div className="ai-chat-page-header-icon">
                        <Bot size={24} />
                    </div>
                    <div>
                        <h1>MJU AI Assistant</h1>
                        <p>Powered by Gemini ✨ — ระบบ AI อัจฉริยะสำหรับคณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้</p>
                    </div>
                </div>
                <button className="ai-chat-page-new-chat" onClick={handleNewChat}>
                    <RotateCcw size={16} /> เริ่มใหม่
                </button>
            </div>

            <div className="ai-chat-page-body">
                {/* Main Chat Area */}
                <div className="ai-chat-page-main">
                    {/* Quick Actions Bar */}
                    {messages.length <= 2 && (
                        <div className="ai-chat-page-quick-actions">
                            <div className="ai-chat-page-quick-label">
                                <Zap size={14} /> Quick Actions — คลิกเพื่อลองใช้งาน
                            </div>
                            <div className="ai-chat-page-quick-grid">
                                {quickActions.map((action, i) => (
                                    <button key={i} className="ai-chat-page-quick-btn" onClick={() => handleQuickAction(action.query)}>
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Messages */}
                    <div className="ai-chat-page-messages">
                        {messages.map((msg, i) => (
                            <ChatMessage key={i} msg={msg} onExpand={setExpandedChart} />
                        ))}
                        {typing && (
                            <div className="ai-page-msg ai-page-msg-bot">
                                <div className="ai-page-msg-avatar">🤖</div>
                                <div className="ai-page-msg-content">
                                    <div className="ai-page-typing">
                                        <span /><span /><span />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEnd} />
                    </div>

                    {/* Input Area */}
                    <div className="ai-chat-page-input-wrapper">
                        {uploadedFileData && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', marginBottom: 6, borderRadius: '8px', background: 'rgba(0,166,81,0.12)', border: '1px solid rgba(0,166,81,0.25)', fontSize: '0.78rem', color: '#00a651' }}>
                                <FileSpreadsheet size={14} />
                                <span>📎 ไฟล์ที่โหลด: {uploadedFileData.rowCount} แถว × {uploadedFileData.headers.length} คอลัมน์ — ถามคำถามเกี่ยวกับข้อมูลนี้ได้เลย</span>
                                <button onClick={() => setUploadedFileData(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 2 }}><X size={14} /></button>
                            </div>
                        )}
                        <div className="ai-chat-page-input-area">
                            <button
                                className={`ai-chat-page-mic ${isListening ? 'listening' : ''}`}
                                onClick={toggleListening}
                                disabled={typing}
                                title="สั่งงานด้วยเสียง (ภาษาไทย)"
                            >
                                {isListening ? <Mic size={20} /> : <MicOff size={20} />}
                            </button>
                            <button
                                className="ai-chat-page-mic"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={typing}
                                title="อัปโหลดไฟล์ CSV เพื่อวิเคราะห์"
                                style={{ color: '#C5A028' }}
                            >
                                <Paperclip size={20} />
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept=".csv,.tsv,.txt"
                                style={{ display: 'none' }}
                            />
                            <input
                                type="text"
                                placeholder={isListening ? "🎤 กำลังฟัง..." : "พิมพ์คำถามที่นี่... หรือ 📎 แนบไฟล์ CSV เพื่อวิเคราะห์"}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={typing}
                            />
                            <button className="ai-chat-page-send" onClick={handleSend} disabled={typing || !input.trim()}>
                                <Send size={20} />
                            </button>
                        </div>
                        <div className="ai-chat-page-input-hint">
                            กด Enter เพื่อส่ง • 📎 แนบไฟล์ CSV/TSV • 🎤 สั่งด้วยเสียง • AI อาจตอบผิดพลาดได้
                        </div>
                    </div>
                </div>

                {/* Right Sidebar — Feature Cards */}
                <div className="ai-chat-page-sidebar">
                    <h3><Sparkles size={16} /> ฟีเจอร์ทั้งหมด</h3>
                    <div className="ai-chat-page-feature-list">
                        {featureCards.map((card, i) => {
                            const Icon = card.icon;
                            return (
                                <div key={i} className="ai-chat-page-feature-card">
                                    <div className="ai-chat-page-feature-icon" style={{ background: card.color + '22', color: card.color }}>
                                        <Icon size={18} />
                                    </div>
                                    <div>
                                        <div className="ai-chat-page-feature-title">{card.title}</div>
                                        <div className="ai-chat-page-feature-desc">{card.desc}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="ai-chat-page-tips">
                        <h4>💡 ตัวอย่างคำถาม</h4>
                        <ul>
                            <li>"พยากรณ์งบประมาณคณะวิทยาศาสตร์ ปี 70 71"</li>
                            <li>"แสดงนักศึกษาสาขาคอม ชั้นปี 3"</li>
                            <li>"สรุปข้อมูลค่าธรรมเนียมการศึกษา"</li>
                            <li>"เปรียบเทียบรายรับรายจ่ายมหาวิทยาลัย"</li>
                            <li>"นักศึกษาที่มี GPA สูงสุด 10 คน"</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Expanded Chart Modal */}
            {expandedChart && (
                <div className="ai-page-chart-modal-overlay" onClick={() => setExpandedChart(null)}>
                    <div className="ai-page-chart-modal" onClick={e => e.stopPropagation()}>
                        <button className="ai-page-chart-modal-close" onClick={() => setExpandedChart(null)}>
                            <X size={24} />
                        </button>
                        <h3>📊 กราฟขยาย (รองรับการซูมและแพน)</h3>
                        <div className="ai-page-chart-modal-body">
                            <ReactChart type={expandedChart.chartType} data={expandedChart.data} options={expandedChart.options} />
                        </div>
                        <div className="ai-page-chart-modal-hint">
                            💡 เลื่อนลูกกลิ้งเมาส์ (Scroll) หรือ Pinch นิ้วเพื่อซูม และคลิกค้างเพื่อเลื่อนซ้าย/ขวา
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
