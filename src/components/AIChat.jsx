import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, BarChart3, TrendingUp, Maximize2, Mic, MicOff, Bot } from 'lucide-react';
import { SCIENCE_MAJORS } from '../data/studentListData';
import { getStudentListSync } from '../services/studentDataService';
import { Chart as ReactChart } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, RadialLinearScale,
    Title, Tooltip, Legend, BarElement, Filler, ArcElement,
    BarController, LineController, PieController, DoughnutController,
    RadarController, PolarAreaController, ScatterController, BubbleController
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { themeAdaptorPlugin } from '../utils/chartTheme';
import { studentStatsData, universityBudgetData, scienceFacultyBudgetData } from '../data/mockData';
import { sendMessageToGemini, resetConversation, getWaitSeconds } from '../services/geminiService';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, RadialLinearScale, Title, Tooltip, Legend, BarElement, Filler, ArcElement, BarController, LineController, PieController, DoughnutController, RadarController, PolarAreaController, ScatterController, BubbleController, zoomPlugin, themeAdaptorPlugin);

const SAFE_CHART_PALETTE = ['#00a651', '#7B68EE', '#E91E63', '#C5A028', '#2E86AB', '#06b6d4', '#a855f7', '#22c55e'];

function parseSafeRgb(value) {
    const match = String(value || '').trim().match(/rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)/i);
    if (match) return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
    const hex = String(value || '').trim().replace(/^#/, '');
    if (![3, 4, 6, 8].includes(hex.length)) return null;
    const expanded = hex.length <= 4 ? hex.split('').map(ch => ch + ch).join('') : hex;
    if (!/^[0-9a-f]{6}/i.test(expanded)) return null;
    return {
        r: parseInt(expanded.slice(0, 2), 16),
        g: parseInt(expanded.slice(2, 4), 16),
        b: parseInt(expanded.slice(4, 6), 16),
    };
}

function rgbaFromSafeColor(value, alpha) {
    const rgb = parseSafeRgb(value);
    return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})` : value;
}

function isNearBlackChartColor(value) {
    if (!value || typeof value !== 'string') return false;
    const color = value.trim().toLowerCase();
    if (color === 'black' || color === '#000' || color === '#000000' || color === '#000000ff') return true;
    const rgb = parseSafeRgb(color);
    return Boolean(rgb && rgb.r <= 18 && rgb.g <= 18 && rgb.b <= 18);
}

function safeChartColor(value, fallbackHex, alpha = 0.72) {
    if (!value || isNearBlackChartColor(value)) return rgbaFromSafeColor(fallbackHex, alpha);
    return value;
}

function safeChartHoverColor(value, fallbackHex) {
    if (Array.isArray(value)) return value.map((color, idx) => safeChartHoverColor(color, SAFE_CHART_PALETTE[idx % SAFE_CHART_PALETTE.length]));
    const safe = safeChartColor(value, fallbackHex, 0.88);
    return rgbaFromSafeColor(safe, 0.88);
}

function sanitizeChartDatasetColors(chart) {
    if (!Array.isArray(chart?.data?.datasets)) return chart;
    chart.data.datasets.forEach((ds, idx) => {
        const fallback = SAFE_CHART_PALETTE[idx % SAFE_CHART_PALETTE.length];
        if (Array.isArray(ds.backgroundColor)) {
            ds.backgroundColor = ds.backgroundColor.map((color, colorIdx) => safeChartColor(color, SAFE_CHART_PALETTE[colorIdx % SAFE_CHART_PALETTE.length], 0.72));
        } else {
            ds.backgroundColor = safeChartColor(ds.backgroundColor, fallback, chart.chartType === 'bar' ? 0.72 : 0.28);
        }
        ds.borderColor = safeChartColor(ds.borderColor, fallback, 0.95);
        if (chart.chartType === 'bar' || chart.chartType === 'pie' || chart.chartType === 'doughnut') {
            ds.hoverBackgroundColor = safeChartHoverColor(ds.backgroundColor, fallback);
            ds.hoverBorderColor = ds.borderColor;
        }
        ds.pointBackgroundColor = safeChartColor(ds.pointBackgroundColor || ds.borderColor, fallback, 0.72);
        ds.pointHoverBackgroundColor = safeChartHoverColor(ds.pointBackgroundColor, fallback);
    });
    return chart;
}

// ==================== Linear Regression Forecasting ====================
function linearRegression(dataPoints) {
    const n = dataPoints.length;
    if (n < 3) return null;
    const xs = dataPoints.map(d => d.x);
    const ys = dataPoints.map(d => d.y);
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
    const sumX2 = xs.reduce((a, x) => a + x * x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
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
    for (const match of yearPatterns) {
        let y = parseInt(match[1]);
        if (y < 100) y += 2500;
        years.push(y);
    }
    if (years.length === 0) {
        const numMatches = q.matchAll(/\b(\d{2,4})\b/g);
        for (const match of numMatches) {
            let y = parseInt(match[1]);
            if (y >= 2500 && y <= 2600) years.push(y);
            else if (y >= 60 && y <= 99) years.push(y + 2500);
        }
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
            text: '**ข้อมูลไม่เพียงพอในการคาดการณ์**\n\nระบบมีข้อมูลสำหรับพยากรณ์ดังนี้:\n' +
                '• งบประมาณมหาวิทยาลัย (รายรับ/รายจ่าย)\n' +
                '• งบประมาณคณะวิทยาศาสตร์ (รายรับ/รายจ่าย)\n' +
                '• จำนวนนิสิตมหาวิทยาลัย\n' +
                '• จำนวนนิสิตคณะวิทยาศาสตร์\n\n' +
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
        if (dataPoints.length < 3) { results.push(`${ds.label}: ข้อมูลไม่เพียงพอ`); continue; }

        const model = linearRegression(dataPoints);
        if (!model) { results.push(`${ds.label}: ไม่สามารถสร้างโมเดลพยากรณ์ได้`); continue; }

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
        results.push(`**${ds.label}**\nข้อมูลจริง: ${existingYears[0]}-${existingYears[existingYears.length - 1]} (${existingYears.length} ปี)\nพยากรณ์ (Linear Regression):\n${forecastSummary}`);
    }

    const chartConfig = allDatasets.length > 0 ? {
        chartType: parsed.chartType,
        data: { labels: allLabels, datasets: allDatasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 8, font: { size: 10 } } },
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
                x: { ticks: { color: '#9ca3af', font: { size: 10 } }, grid: { display: false } },
                y: { ticks: { color: '#9ca3af', font: { size: 10 }, callback: (v) => v.toLocaleString() }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    } : null;

    return { text: results.join('\n\n') + '\n\n_หมายเหตุ: อ้างอิงจากข้อมูลในระบบเท่านั้น (Linear Regression)_', chart: chartConfig };
}

// ==================== Student Data (Real from MJU) ====================
const MAJORS = SCIENCE_MAJORS;

// ==================== Smart Student Search ====================
function searchStudents(query) {
    const ALL_STUDENTS = getStudentListSync();
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

    const majorKeywords = { 'คอม': 'วิทยาการคอมพิวเตอร์', 'ไอที': 'เทคโนโลยีสารสนเทศ', 'it': 'เทคโนโลยีสารสนเทศ', 'คณิต': 'คณิตศาสตร์', 'เคมี': 'เคมี', 'ฟิสิกส์': 'ฟิสิกส์ประยุกต์', 'ชีว': 'เทคโนโลยีชีวภาพ', 'วัสดุ': 'วัสดุศาสตร์', 'สิ่งทอ': 'เคมีอุตสาหกรรมและเทคโนโลยีสิ่งทอ', 'สถิติ': 'สถิติ' };
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

    let text = `**พบนักศึกษา ${searchDesc}** จำนวน ${total} คน`;
    if (limit > 0 && total > limit) text += ` (แสดง ${limit} คน)`;
    text += '\n\n';

    results.forEach((s, i) => {
        const gpaColor = s.gpa >= 3.5 ? '[ดีมาก]' : s.gpa >= 2.5 ? '[ดี]' : s.gpa >= 2.0 ? '[พอใช้]' : '[ต่ำ]';
        text += `**${i + 1}.** \`${s.id}\` ${s.name}\n`;
        text += `   ${s.major} | ชั้นปี ${s.year} | ${gpaColor} GPA ${s.gpa} | ${s.status}\n`;
    });

    if (total > results.length) {
        text += `\n_...และอีก ${total - results.length} คน (พิมพ์ "ขอทั้งหมด" เพื่อดูเพิ่ม)_`;
    }

    return { text, chart: null };
}

// ==================== Check if query needs local handling ====================
function tryLocalResponse(question) {
    const q = question.toLowerCase();

    // 1. Explicit forecast requests only (with forecast-specific keywords)
    const forecastParsed = parseForecastRequest(question);
    if (forecastParsed) {
        const result = generateForecastResponse(forecastParsed);
        if (result) return result;
        // No datasets matched → fall through to AI
    }

    // 2. Student search — only specific structured lookups
    const isStudentLookup =
        (q.match(/(?:รหัส|id)\s*\d{2,}/i)) ||
        (q.includes('รอพินิจ') && (q.includes('รายชื่อ') || q.includes('แสดง') || q.includes('ใคร'))) ||
        (q.includes('เกรดต่ำ') && (q.includes('รายชื่อ') || q.includes('แสดง') || q.includes('ใคร'))) ||
        (q.includes('เกรดสูง') && (q.includes('รายชื่อ') || q.includes('แสดง') || q.includes('ใคร'))) ||
        (q.includes('เกียรตินิยม') && (q.includes('รายชื่อ') || q.includes('แสดง') || q.includes('ใคร'))) ||
        ((q.includes('รายชื่อ') || q.includes('ค้นหานักศึกษา') || q.includes('หานักศึกษา')) &&
         (q.includes('สาขา') || q.includes('ชั้นปี') || q.match(/\d{2,}/)));

    if (isStudentLookup) {
        const studentResult = searchStudents(q);
        if (studentResult) return studentResult;
    }

    return null; // Let AI handle everything else
}

// ==================== Parse AI Generated Chart ====================
function parseAIResponse(text) {
    // Accept 1-3 backticks on the fence — Gemini occasionally emits a single
    // backtick which renders as inline code instead of a block.
    let regex = /`{1,3}json_chart\s*([\s\S]*?)\s*`{1,3}/;
    let match = text.match(regex);

    // Fallback: detect ```json blocks that contain chart data (chartType + data)
    if (!match) {
        const jsonRegex = /`{1,3}json\s*([\s\S]*?)\s*`{1,3}/;
        const jsonMatch = text.match(jsonRegex);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[1]);
                if (parsed.chartType && parsed.data) {
                    match = jsonMatch;
                    regex = jsonRegex;
                }
            } catch { /* not valid chart JSON */ }
        }
    }

    // Last fallback: find raw JSON with chartType (no code block)
    if (!match) {
        const startIdx = text.indexOf('{"chartType"');
        if (startIdx !== -1) {
            try {
                let depth = 0, endIdx = startIdx;
                for (let i = startIdx; i < text.length; i++) {
                    if (text[i] === '{') depth++;
                    else if (text[i] === '}') { depth--; if (depth === 0) { endIdx = i + 1; break; } }
                }
                const jsonStr = text.slice(startIdx, endIdx);
                const parsed = JSON.parse(jsonStr);
                if (parsed.chartType && parsed.data) {
                    match = [jsonStr, jsonStr];
                    regex = new RegExp(jsonStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                }
            } catch { /* not valid */ }
        }
    }

    let chartConfig = null;
    let cleanText = text;

    if (match) {
        try {
            const rawJson = JSON.parse(match[1] || match[0]);
            cleanText = text.replace(match[0].includes('`') ? regex : match[0], '').trim();
            cleanText = cleanText
                .replace(/`{1,3}\s*`{1,3}/g, '')
                .replace(/`{1,3}\s*json_chart\s*`{0,3}/g, '')
                .replace(/`{1,3}\s*json\s*`{0,3}/g, '')
                .trim();

            const isRadar = rawJson.chartType === 'radar' || rawJson.chartType === 'polarArea';

            if (isRadar && rawJson.data?.labels?.length < 3) {
                rawJson.chartType = 'bar';
            }

            if (isRadar && rawJson.data?.labels?.length >= 3) {
                const neonColors = [
                    { border: '#06b6d4', fill: 'rgba(6, 182, 212, 0.25)' },
                    { border: '#ec4899', fill: 'rgba(236, 72, 153, 0.25)' },
                    { border: '#22c55e', fill: 'rgba(34, 197, 94, 0.25)' },
                    { border: '#f59e0b', fill: 'rgba(245, 158, 11, 0.25)' }
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

            // Ensure default colors
            const defaultColors = ['#7B68EE', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#a855f7', '#64748b'];
            if (rawJson.data?.datasets) {
                rawJson.data.datasets.forEach((ds, i) => {
                    if (!ds.borderColor && !ds.backgroundColor) {
                        const c = defaultColors[i % defaultColors.length];
                        ds.borderColor = c;
                        ds.backgroundColor = c + '40';
                    }
                    if (rawJson.chartType === 'bar' && !ds.borderRadius) ds.borderRadius = 6;
                });
                sanitizeChartDatasetColors(rawJson);
            }

            const defaultScales = isRadar ? {
                r: {
                    angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    pointLabels: { color: '#e5e7eb', font: { size: 11, weight: 'bold' } },
                    ticks: { display: false, min: 0, max: 100 }
                }
            } : (rawJson.chartType === 'pie' || rawJson.chartType === 'doughnut') ? {} : {
                x: { ticks: { color: '#9ca3af', font: { size: 10 } }, grid: { display: false } },
                y: { ticks: { color: '#9ca3af', font: { size: 10 }, callback: (v) => v.toLocaleString() }, grid: { color: 'rgba(255,255,255,0.05)' } }
            };

            // Merge AI-provided scales into defaults so y1 / indexAxis / titles apply
            // without losing our dark-theme tick/grid styling.
            const aiScales = rawJson.options?.scales || {};
            const mergedScales = { ...defaultScales };
            for (const k of Object.keys(aiScales)) {
                mergedScales[k] = { ...(defaultScales[k] || defaultScales.y || {}), ...aiScales[k] };
            }

            chartConfig = {
                chartType: rawJson.chartType || 'bar',
                data: rawJson.data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: rawJson.options?.indexAxis,
                    elements: isRadar ? { line: { tension: 0.1 } } : undefined,
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 12, font: { size: 10 } } },
                        zoom: {
                            pan: { enabled: true, mode: 'xy' },
                            zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' }
                        },
                        ...(rawJson.options?.plugins || {})
                    },
                    scales: mergedScales
                }
            };
        } catch (e) {
            console.error('Failed to parse Generative Chart JSON:', e);
        }
    }
    return { text: cleanText, chart: chartConfig };
}


// ==================== Chat Message with Chart Component ====================
function ChatMessage({ msg, onExpand }) {
    const [chartType, setChartType] = useState(msg.chart?.chartType || 'line');

    if (msg.role === 'user') {
        return <div className="chat-message user">{msg.text}</div>;
    }

    const formatText = (text) => {
        if (!text) return null;
        return text.split('\n').map((line, i) => {
            const parts = line.split(/(\*\*.*?\*\*|_.*?_)/g).map((part, j) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={j}>{part.slice(2, -2)}</strong>;
                }
                if (part.startsWith('_') && part.endsWith('_')) {
                    return <em key={j} style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>{part.slice(1, -1)}</em>;
                }
                return part;
            });
            return <div key={i}>{parts}</div>;
        });
    };

    const chartData = msg.chart ? sanitizeChartDatasetColors(JSON.parse(JSON.stringify(msg.chart))) : null;

    return (
        <div className="chat-message bot">
            {formatText(msg.text)}

            {chartData && (
                <div className="chat-chart-container">
                    <div className="chat-chart-toggle" style={{ display: 'flex', gap: '8px' }}>
                        {(chartType === 'line' || chartType === 'bar') && (
                            <>
                                <button
                                    className={`chat-chart-toggle-btn ${chartType === 'line' ? 'active' : ''}`}
                                    onClick={() => setChartType('line')}
                                >
                                    <TrendingUp size={12} /> กราฟเส้น
                                </button>
                                <button
                                    className={`chat-chart-toggle-btn ${chartType === 'bar' ? 'active' : ''}`}
                                    onClick={() => setChartType('bar')}
                                >
                                    <BarChart3 size={12} /> กราฟแท่ง
                                </button>
                            </>
                        )}
                        <button
                            className="chat-chart-toggle-btn"
                            onClick={() => onExpand({ ...chartData, chartType })}
                            style={{ marginLeft: 'auto' }}
                        >
                            <Maximize2 size={12} /> ขยาย/ซูม
                        </button>
                    </div>

                    <div className="chat-chart-wrapper">
                        <ReactChart type={chartType} data={chartData.data} options={chartData.options} />
                    </div>
                </div>
            )}
        </div>
    );
}


// ==================== Main AIChat Component ====================
export default function AIChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [expandedChart, setExpandedChart] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);
    const [messages, setMessages] = useState([
        {
            role: 'bot',
            text: 'สวัสดีครับ! ผม MJU AI Assistant (Powered by Gemini) พร้อมช่วยตอบคำถามเกี่ยวกับข้อมูลมหาวิทยาลัยแม่โจ้ ถามมาได้เลยครับ!\n\n**ใหม่!** ลองพิมพ์ "พยากรณ์งบประมาณคณะวิทยาศาสตร์ ปี 70 71 เป็นกราฟ"',
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
            recognitionRef.current.lang = 'th-TH'; // Thai language

            recognitionRef.current.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setInput(prev => (prev + ' ' + transcript).trim());
                setIsListening(false);
            };

            recognitionRef.current.onerror = (event) => {
                console.error("Speech recognition error:", event.error);
                setIsListening(false);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
        } else {
            console.warn("Speech Recognition API is not supported in this browser.");
        }
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) return alert("เบราว์เซอร์ของคุณไม่รองรับการสั่งงานด้วยเสียง");

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            try {
                recognitionRef.current.start();
                setIsListening(true);
            } catch (error) {
                console.error("Failed to start listening:", error);
            }
        }
    };

    // ── Draggable FAB state ──
    const [fabPos, setFabPos] = useState({ right: 24, bottom: 24 });
    const dragRef = useRef({ dragging: false, hasMoved: false, startX: 0, startY: 0, startR: 0, startB: 0 });

    const onDragStart = useCallback((clientX, clientY) => {
        dragRef.current = {
            dragging: true, hasMoved: false,
            startX: clientX, startY: clientY,
            startR: fabPos.right, startB: fabPos.bottom,
        };
    }, [fabPos]);

    const onDragMove = useCallback((clientX, clientY) => {
        const d = dragRef.current;
        if (!d.dragging) return;
        const dx = clientX - d.startX;
        const dy = clientY - d.startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.hasMoved = true;
        if (!d.hasMoved) return;
        const maxR = window.innerWidth - 60;
        const maxB = window.innerHeight - 60;
        setFabPos({
            right: Math.max(0, Math.min(maxR, d.startR - dx)),
            bottom: Math.max(0, Math.min(maxB, d.startB - dy)),
        });
    }, []);

    const onDragEnd = useCallback(() => {
        dragRef.current.dragging = false;
    }, []);

    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        onDragStart(e.clientX, e.clientY);
        const moveHandler = (ev) => onDragMove(ev.clientX, ev.clientY);
        const upHandler = () => {
            onDragEnd();
            window.removeEventListener('mousemove', moveHandler);
            window.removeEventListener('mouseup', upHandler);
        };
        window.addEventListener('mousemove', moveHandler);
        window.addEventListener('mouseup', upHandler);
    }, [onDragStart, onDragMove, onDragEnd]);

    const handleTouchStart = useCallback((e) => {
        const t = e.touches[0];
        onDragStart(t.clientX, t.clientY);
    }, [onDragStart]);

    const handleTouchMove = useCallback((e) => {
        const t = e.touches[0];
        onDragMove(t.clientX, t.clientY);
    }, [onDragMove]);

    const handleTouchEnd = useCallback(() => {
        onDragEnd();
    }, [onDragEnd]);

    const handleFabClick = useCallback(() => {
        if (!dragRef.current.hasMoved) {
            setIsOpen(prev => !prev);
        }
    }, []);

    useEffect(() => {
        messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, typing]);

    // Reset conversation when chat is closed
    const handleClose = useCallback(() => {
        setIsOpen(false);
        resetConversation();
    }, []);

    // Robust auto-retry with live countdown for quota errors
    const retryWithCountdown = async (buildMessage, retryId) => {
        const MAX_RETRIES = 3;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            let waitSec = Math.max(getWaitSeconds(), 5) + 2;
            await new Promise(resolve => {
                let remaining = waitSec;
                const update = () => {
                    setMessages(prev => prev.map(m =>
                        m._retryId === retryId
                            ? { ...m, text: `**API ถูกใช้งานบ่อยเกินไป** — รอ ${remaining} วินาที แล้วจะลองใหม่อัตโนมัติ (ครั้งที่ ${attempt}/${MAX_RETRIES})\n\nกรุณารอสักครู่ ระบบจะลองส่งคำถามให้ใหม่โดยอัตโนมัติ` }
                            : m
                    ));
                };
                update();
                const id = setInterval(() => {
                    remaining--;
                    if (remaining <= 0) { clearInterval(id); resolve(); }
                    else update();
                }, 1000);
            });
            try {
                const aiText = await sendMessageToGemini(buildMessage());
                const parsedAI = parseAIResponse(aiText);
                setMessages(prev => prev.map(m =>
                    m._retryId === retryId
                        ? { role: 'bot', text: `✅ _ลองใหม่สำเร็จ!_\n\n${parsedAI.text}`, chart: parsedAI.chart }
                        : m
                ));
                return;
            } catch (retryErr) {
                const isStillQuota = /รอ|quota|API ถูกใช้งาน|QUOTA/.test(retryErr.message || '');
                if (!isStillQuota || attempt === MAX_RETRIES) {
                    const finalMsg = isStillQuota
                        ? `**ไม่สามารถเชื่อมต่อ AI ได้หลังจากลอง ${MAX_RETRIES} ครั้ง**\n\nAPI ถูกจำกัดการใช้งาน กรุณารอ 3-5 นาทีแล้วลองใหม่\n\n_ระหว่างรอ ลองใช้ฟีเจอร์พยากรณ์หรือค้นหานักศึกษา ซึ่งทำงานได้โดยไม่ต้องใช้ AI_`
                        : `${retryErr.message || 'ไม่สามารถเชื่อมต่อ AI ได้'}\n\nลองถามคำถามใหม่อีกครั้ง`;
                    setMessages(prev => prev.map(m =>
                        m._retryId === retryId ? { role: 'bot', text: finalMsg, chart: null } : m
                    ));
                    return;
                }
            }
        }
    };

    const handleSend = async () => {
        if (!input.trim() || typing) return;

        const userMsg = input.trim();
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInput('');
        setTyping(true);

        try {
            // Try local response first (forecast, student search) — instant results
            const localResult = tryLocalResponse(userMsg);
            if (localResult) {
                setMessages(prev => [...prev, { role: 'bot', text: localResult.text, chart: localResult.chart }]);
                setTyping(false);
                return;
            }
            const aiText = await sendMessageToGemini(userMsg);
            const parsedAI = parseAIResponse(aiText);
            setMessages(prev => [...prev, { role: 'bot', text: parsedAI.text, chart: parsedAI.chart }]);
        } catch (error) {
            console.error('[AIChat] Gemini API error:', error);
            const isQuota = /รอ|quota|API ถูกใช้งาน|QUOTA/.test(error.message || '');
            if (isQuota) {
                const retryId = `retry_${Date.now()}`;
                setMessages(prev => [...prev, {
                    role: 'bot', text: '**API ถูกใช้งานบ่อยเกินไป** — กำลังเตรียมลองใหม่...', chart: null, _retryId: retryId
                }]);
                await retryWithCountdown(() => userMsg, retryId);
            } else {
                setMessages(prev => [...prev, {
                    role: 'bot',
                    text: `${error.message || 'ไม่สามารถเชื่อมต่อ AI ได้'}\n\nลองถามคำถามใหม่อีกครั้ง`,
                    chart: null
                }]);
            }
        } finally {
            setTyping(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSend();
    };

    const quickActions = [
        { label: 'พยากรณ์งบฯ คณะวิทย์', query: 'พยากรณ์งบประมาณคณะวิทยาศาสตร์ ปี 70 71 เป็นกราฟ' },
        { label: 'คาดการณ์นิสิต', query: 'พยากรณ์จำนวนนิสิตมหาวิทยาลัย ปี 70 71 แบบกราฟแท่ง' },
        { label: 'งบฯ มหาวิทยาลัย', query: 'พยากรณ์งบประมาณมหาวิทยาลัย ปี 2570 2571 เป็นกราฟเส้น' },
    ];

    const handleQuickAction = async (query) => {
        if (typing) return;
        setMessages(prev => [...prev, { role: 'user', text: query }]);
        setTyping(true);

        try {
            // Try local response first (forecast, student search)
            const localResult = tryLocalResponse(query);
            if (localResult) {
                setMessages(prev => [...prev, { role: 'bot', text: localResult.text, chart: localResult.chart }]);
                setTyping(false);
                return;
            }
            const aiText = await sendMessageToGemini(query);
            const parsedAI = parseAIResponse(aiText);
            setMessages(prev => [...prev, { role: 'bot', text: parsedAI.text, chart: parsedAI.chart }]);
        } catch (error) {
            console.error('[AIChat] Gemini API error:', error);
            const isQuota = /รอ|quota|API ถูกใช้งาน|QUOTA/.test(error.message || '');
            if (isQuota) {
                const retryId = `retry_${Date.now()}`;
                setMessages(prev => [...prev, {
                    role: 'bot', text: '**API ถูกใช้งานบ่อยเกินไป** — กำลังเตรียมลองใหม่...', chart: null, _retryId: retryId
                }]);
                await retryWithCountdown(() => query, retryId);
            } else {
                setMessages(prev => [...prev, {
                    role: 'bot',
                    text: `${error.message || 'ไม่สามารถเชื่อมต่อ AI ได้'}\n\nลองถามคำถามใหม่อีกครั้ง`,
                    chart: null
                }]);
            }
        } finally {
            setTyping(false);
        }
    };

    return (
        <>
            <button
                className="ai-chat-trigger"
                onClick={handleFabClick}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{
                    right: fabPos.right,
                    bottom: fabPos.bottom,
                    touchAction: 'none',
                    userSelect: 'none',
                }}
            >
                {isOpen ? <X size={26} /> : <MessageCircle size={26} />}
                {!isOpen && <span className="pulse" />}
            </button>

            {isOpen && (() => {
                const panelH = 520, fabSize = 60, gap = 10;
                const fabX = window.innerWidth - fabPos.right - fabSize;
                const onRightHalf = (fabX + fabSize / 2) > window.innerWidth / 2;

                const panelStyle = { position: 'fixed', zIndex: 999 };

                if (onRightHalf) {
                    const r = fabPos.right;
                    panelStyle.right = Math.max(0, r);
                } else {
                    const l = fabX;
                    panelStyle.left = Math.max(0, l);
                }

                let panelBottom = fabPos.bottom + fabSize + gap;
                if (panelBottom + panelH > window.innerHeight) {
                    panelBottom = Math.max(4, window.innerHeight - panelH - 4);
                }
                panelStyle.bottom = panelBottom;

                return (
                    <div className="ai-chat-panel" style={panelStyle}>
                        <div className="ai-chat-header">
                            <div className="ai-chat-header-left">
                                <div className="ai-chat-header-avatar"><Bot size={20} /></div>
                                <div>
                                    <h3>MJU AI Assistant</h3>
                                    <p>Powered by Gemini</p>
                                </div>
                            </div>
                            <button className="ai-chat-close" onClick={handleClose}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="ai-chat-messages">
                            {messages.map((msg, i) => (
                                <ChatMessage key={i} msg={msg} onExpand={setExpandedChart} />
                            ))}
                            {typing && (
                                <div className="typing-indicator">
                                    <span /><span /><span />
                                </div>
                            )}
                            <div ref={messagesEnd} />
                        </div>

                        {/* Quick Actions */}
                        {messages.length <= 2 && (
                            <div className="chat-quick-actions">
                                {quickActions.map((action, i) => (
                                    <button key={i} className="chat-quick-btn" onClick={() => handleQuickAction(action.query)}>
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="ai-chat-input-area">
                            <button
                                className={`ai-chat-mic ${isListening ? 'listening' : ''}`}
                                onClick={toggleListening}
                                disabled={typing}
                                style={{
                                    background: 'transparent', border: 'none', cursor: 'pointer',
                                    padding: '8px', color: isListening ? '#e91e63' : 'var(--text-muted)',
                                    animation: isListening ? 'pulse 1.5s infinite' : 'none'
                                }}
                                aria-label="สั่งงานด้วยเสียง"
                                data-tooltip="สั่งงานด้วยเสียง"
                            >
                                {isListening ? <Mic size={20} /> : <MicOff size={20} />}
                            </button>
                            <input
                                type="text"
                                placeholder={isListening ? "กำลังฟัง..." : "ถามเกี่ยวกับข้อมูลมหาวิทยาลัย..."}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={typing}
                            />
                            <button className="ai-chat-send" onClick={handleSend} disabled={typing}>
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                );
            })()}

            {expandedChart && (() => {
                return (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setExpandedChart(null)}>
                    <div style={{ backgroundColor: 'var(--bg-card)', width: '100%', maxWidth: '900px', height: '80vh', borderRadius: '16px', padding: '0', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.6), 0 0 40px rgba(0, 230, 118, 0.04)', border: '1px solid rgba(0, 230, 118, 0.08)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.015)' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                กราฟขยาย
                            </h3>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button onClick={() => setExpandedChart(null)} style={{ color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'grid', placeItems: 'center' }}>
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="ai-chat-expanded-canvas" style={{ flex: 1, position: 'relative', width: '100%', padding: '16px 20px 8px', minHeight: 0 }}>
                            <ReactChart
                                type={expandedChart.chartType}
                                data={JSON.parse(JSON.stringify(expandedChart.data))}
                                options={{
                                    ...expandedChart.options,
                                    animation: { duration: 600, easing: 'easeOutQuart' },
                                    plugins: {
                                        ...(expandedChart.options?.plugins || {}),
                                        legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 16, font: { size: 11, weight: '500' }, usePointStyle: true } },
                                        tooltip: {
                                            backgroundColor: 'rgba(15, 20, 35, 0.92)',
                                            titleColor: '#fff',
                                            bodyColor: '#e5e7eb',
                                            borderColor: 'rgba(0, 230, 118, 0.2)',
                                            borderWidth: 1,
                                            cornerRadius: 10,
                                            padding: 12,
                                        },
                                        zoom: {
                                            pan: { enabled: true, mode: 'xy' },
                                            zoom: { wheel: { enabled: true, speed: 0.06 }, pinch: { enabled: true }, mode: 'xy' },
                                            limits: { x: { minRange: 2 }, y: { minRange: 1 } },
                                        },
                                    },
                                }}
                                redraw
                            />
                        </div>
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', padding: '8px 20px 14px', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                            Scroll เพื่อซูม • คลิกค้างเพื่อเลื่อน
                        </div>
                    </div>
                </div>
                );
            })()}
        </>
    );
}
