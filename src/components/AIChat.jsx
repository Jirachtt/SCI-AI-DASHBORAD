import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, BarChart3, TrendingUp } from 'lucide-react';
import { Line, Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
    Title, Tooltip, Legend, BarElement, Filler
} from 'chart.js';
import { studentStatsData, universityBudgetData, scienceFacultyBudgetData } from '../data/mockData';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, BarElement, Filler);

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
    // University Budget
    universityBudgetRevenue: {
        label: 'รายรับมหาวิทยาลัย',
        unit: 'ล้านบาท',
        scope: 'มหาวิทยาลัย',
        getData: () => universityBudgetData.yearly.filter(y => y.type === 'actual').map(y => ({ x: parseInt(y.year), y: y.revenue })),
        color: '#00a651',
        keywords: ['รายรับ', 'revenue'],
        scopeKeywords: ['มหาวิทยาลัย', 'มจ', 'mju', 'ทั้งหมด']
    },
    universityBudgetExpense: {
        label: 'รายจ่ายมหาวิทยาลัย',
        unit: 'ล้านบาท',
        scope: 'มหาวิทยาลัย',
        getData: () => universityBudgetData.yearly.filter(y => y.type === 'actual').map(y => ({ x: parseInt(y.year), y: y.expense })),
        color: '#E91E63',
        keywords: ['รายจ่าย', 'expense', 'ค่าใช้จ่าย'],
        scopeKeywords: ['มหาวิทยาลัย', 'มจ', 'mju', 'ทั้งหมด']
    },
    universityBudget: {
        label: 'งบประมาณมหาวิทยาลัย (รายรับ)',
        unit: 'ล้านบาท',
        scope: 'มหาวิทยาลัย',
        getData: () => universityBudgetData.yearly.filter(y => y.type === 'actual').map(y => ({ x: parseInt(y.year), y: y.revenue })),
        color: '#00a651',
        keywords: ['งบประมาณ', 'budget', 'งบ'],
        scopeKeywords: ['มหาวิทยาลัย', 'มจ', 'mju', 'ทั้งหมด']
    },
    // Science Faculty Budget
    scienceBudgetRevenue: {
        label: 'รายรับคณะวิทยาศาสตร์',
        unit: 'ล้านบาท',
        scope: 'คณะวิทยาศาสตร์',
        getData: () => scienceFacultyBudgetData.yearly.filter(y => y.type === 'actual').map(y => ({ x: parseInt(y.year), y: y.revenue })),
        color: '#006838',
        keywords: ['รายรับ', 'revenue', 'งบประมาณ', 'budget', 'งบ'],
        scopeKeywords: ['คณะวิทยาศาสตร์', 'วิทยาศาสตร์', 'science', 'คณะวิทย์']
    },
    scienceBudgetExpense: {
        label: 'รายจ่ายคณะวิทยาศาสตร์',
        unit: 'ล้านบาท',
        scope: 'คณะวิทยาศาสตร์',
        getData: () => scienceFacultyBudgetData.yearly.filter(y => y.type === 'actual').map(y => ({ x: parseInt(y.year), y: y.expense })),
        color: '#A23B72',
        keywords: ['รายจ่าย', 'expense', 'ค่าใช้จ่าย'],
        scopeKeywords: ['คณะวิทยาศาสตร์', 'วิทยาศาสตร์', 'science', 'คณะวิทย์']
    },
    // Students
    universityStudents: {
        label: 'จำนวนนิสิตมหาวิทยาลัย',
        unit: 'คน',
        scope: 'มหาวิทยาลัย',
        getData: () => studentStatsData.trend.filter(t => t.type === 'actual').map(t => ({ x: parseInt(t.year), y: t.total })),
        color: '#7B68EE',
        keywords: ['นิสิต', 'นักศึกษา', 'student', 'จำนวนนิสิต'],
        scopeKeywords: ['มหาวิทยาลัย', 'มจ', 'mju', 'ทั้งหมด']
    },
    scienceStudents: {
        label: 'จำนวนนิสิตคณะวิทยาศาสตร์',
        unit: 'คน',
        scope: 'คณะวิทยาศาสตร์',
        getData: () => studentStatsData.scienceFaculty.byEnrollmentYear.map(e => ({ x: parseInt(e.year), y: e.count })),
        color: '#006838',
        keywords: ['นิสิต', 'นักศึกษา', 'student', 'จำนวนนิสิต'],
        scopeKeywords: ['คณะวิทยาศาสตร์', 'วิทยาศาสตร์', 'science', 'คณะวิทย์']
    }
};

// ==================== Request Parser ====================
function parseForecastRequest(question) {
    const q = question.toLowerCase();

    // Check if it's a forecast request
    const forecastKeywords = ['พยากรณ์', 'คาดการณ์', 'ประมาณการ', 'ทำนาย', 'predict', 'forecast', 'คาดว่า'];
    const isForecast = forecastKeywords.some(k => q.includes(k));
    if (!isForecast) return null;

    // Detect chart type
    let chartType = 'line'; // default
    if (q.includes('แท่ง') || q.includes('bar')) chartType = 'bar';
    if (q.includes('เส้น') || q.includes('line') || q.includes('กราฟเส้น')) chartType = 'line';

    // Detect target years
    const years = [];
    // Match "ปี 70", "ปี 71", "ปี 2570"
    const yearPatterns = q.matchAll(/ปี\s*(\d{2,4})/g);
    for (const match of yearPatterns) {
        let y = parseInt(match[1]);
        if (y < 100) y += 2500; // Convert BE short to full
        years.push(y);
    }
    // Match standalone year numbers like "2570 2571" or "70 71"
    if (years.length === 0) {
        const numMatches = q.matchAll(/\b(\d{2,4})\b/g);
        for (const match of numMatches) {
            let y = parseInt(match[1]);
            if (y >= 2500 && y <= 2600) years.push(y);
            else if (y >= 60 && y <= 99) years.push(y + 2500);
        }
    }
    // Default: forecast next 2 years from latest data
    if (years.length === 0) {
        years.push(2570, 2571);
    }

    // Detect scope (Science Faculty vs University)
    const isScience = ['คณะวิทยาศาสตร์', 'วิทยาศาสตร์', 'science', 'คณะวิทย์'].some(k => q.includes(k));

    // Detect data type
    let matchedDatasets = [];

    // Check for specific data keywords with scope
    for (const [key, ds] of Object.entries(DATASETS)) {
        const hasKeyword = ds.keywords.some(k => q.includes(k));
        const hasScopeMatch = isScience
            ? ds.scopeKeywords.some(k => ['คณะวิทยาศาสตร์', 'วิทยาศาสตร์', 'science', 'คณะวิทย์'].includes(k))
            : ds.scopeKeywords.some(k => ['มหาวิทยาลัย', 'มจ', 'mju', 'ทั้งหมด'].includes(k));

        if (hasKeyword && hasScopeMatch) {
            matchedDatasets.push(key);
        }
    }

    // If budget mentioned for science without specific revenue/expense, use revenue
    if (matchedDatasets.length === 0 && isScience) {
        if (q.includes('งบประมาณ') || q.includes('budget') || q.includes('งบ') || q.includes('รายรับ') || q.includes('รายจ่าย')) {
            if (q.includes('รายจ่าย') || q.includes('expense')) {
                matchedDatasets = ['scienceBudgetExpense'];
            } else {
                matchedDatasets = ['scienceBudgetRevenue'];
            }
        } else if (q.includes('นิสิต') || q.includes('นักศึกษา') || q.includes('student')) {
            matchedDatasets = ['scienceStudents'];
        }
    }

    // If still no match, default based on keywords
    if (matchedDatasets.length === 0) {
        if (q.includes('งบประมาณ') || q.includes('budget') || q.includes('งบ')) {
            matchedDatasets = ['universityBudget'];
        } else if (q.includes('รายรับ') || q.includes('revenue')) {
            matchedDatasets = ['universityBudgetRevenue'];
        } else if (q.includes('รายจ่าย') || q.includes('expense')) {
            matchedDatasets = ['universityBudgetExpense'];
        } else if (q.includes('นิสิต') || q.includes('นักศึกษา') || q.includes('student')) {
            matchedDatasets = ['universityStudents'];
        }
    }

    // Remove duplicates (e.g. universityBudget and universityBudgetRevenue)
    if (matchedDatasets.includes('universityBudget') && matchedDatasets.includes('universityBudgetRevenue')) {
        matchedDatasets = matchedDatasets.filter(d => d !== 'universityBudget');
    }

    return {
        years: years.sort(),
        chartType,
        datasets: matchedDatasets,
        isScience
    };
}

// ==================== Generate Forecast Response ====================
function generateForecastResponse(parsed) {
    if (!parsed || parsed.datasets.length === 0) {
        return {
            text: '⚠️ **ข้อมูลไม่เพียงพอในการคาดการณ์**\n\nระบบมีข้อมูลสำหรับพยากรณ์ดังนี้:\n' +
                '• 📈 งบประมาณมหาวิทยาลัย (รายรับ/รายจ่าย)\n' +
                '• 🔬 งบประมาณคณะวิทยาศาสตร์ (รายรับ/รายจ่าย)\n' +
                '• 👨‍🎓 จำนวนนิสิตมหาวิทยาลัย\n' +
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

        if (dataPoints.length < 3) {
            results.push(`⚠️ ${ds.label}: ข้อมูลไม่เพียงพอ (ต้องมีอย่างน้อย 3 ปี)`);
            continue;
        }

        const model = linearRegression(dataPoints);
        if (!model) {
            results.push(`⚠️ ${ds.label}: ไม่สามารถสร้างโมเดลพยากรณ์ได้`);
            continue;
        }

        // Build labels and data
        const existingYears = dataPoints.map(d => d.x);
        const allYears = [...new Set([...existingYears, ...parsed.years])].sort();
        const labels = allYears.map(y => `ปี ${y}`);
        const actualValues = allYears.map(y => {
            const found = dataPoints.find(d => d.x === y);
            return found ? found.y : null;
        });
        const forecastValues = allYears.map(y => {
            if (existingYears.includes(y)) {
                // Connect line at the last actual point
                if (y === Math.max(...existingYears)) return dataPoints.find(d => d.x === y).y;
                return null;
            }
            return model.predict(y);
        });

        if (allLabels.length === 0) {
            allLabels.push(...labels);
        }

        allDatasets.push({
            label: `${ds.label} (ข้อมูลจริง)`,
            data: actualValues,
            borderColor: ds.color,
            backgroundColor: ds.color + '20',
            fill: parsed.chartType === 'line',
            tension: 0.4,
            pointBackgroundColor: ds.color,
            pointRadius: 5,
            borderWidth: 2,
            borderRadius: parsed.chartType === 'bar' ? 6 : 0,
        });

        allDatasets.push({
            label: `${ds.label} (พยากรณ์)`,
            data: forecastValues,
            borderColor: ds.color,
            borderDash: [6, 3],
            backgroundColor: ds.color + '40',
            tension: 0.4,
            pointBackgroundColor: ds.color + 'cc',
            pointRadius: 5,
            pointStyle: 'triangle',
            borderWidth: 2,
            borderRadius: parsed.chartType === 'bar' ? 6 : 0,
        });

        // Text summary
        const forecastSummary = parsed.years.map(y => {
            const val = model.predict(y);
            return `   ปี ${y}: ~${val.toLocaleString()} ${ds.unit}`;
        }).join('\n');

        results.push(`📊 **${ds.label}**\n` +
            `ข้อมูลจริง: ${existingYears[0]}-${existingYears[existingYears.length - 1]} (${existingYears.length} ปี)\n` +
            `พยากรณ์ (Linear Regression):\n${forecastSummary}`);
    }

    // Build chart config
    const chartConfig = allDatasets.length > 0 ? {
        chartType: parsed.chartType,
        data: {
            labels: allLabels,
            datasets: allDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#9ca3af', padding: 8, font: { size: 10 } }
                },
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
                y: {
                    ticks: { color: '#9ca3af', font: { size: 10 }, callback: (v) => v.toLocaleString() },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                }
            }
        }
    } : null;

    const text = results.join('\n\n') + '\n\n💡 _อ้างอิงจากข้อมูลในระบบเท่านั้น (Linear Regression)_';

    return { text, chart: chartConfig };
}

// ==================== Student Data (same seed as StudentListPage) ====================
const MAJORS = ['วิทยาการคอมพิวเตอร์', 'เทคโนโลยีสารสนเทศ', 'คณิตศาสตร์', 'เคมี', 'ฟิสิกส์', 'ชีววิทยา', 'วิทยาการข้อมูล', 'สถิติ'];
const FIRST_NAMES = ['สมชาย', 'สมหญิง', 'กิตติ', 'ปิยะ', 'วรัญญา', 'จิรา', 'ณัฐ', 'พิมพ์', 'อรุณ', 'ธนา', 'สุภา', 'ชัยวัฒน์', 'นภา', 'วิภา', 'เอก', 'ภูมิ', 'แก้ว', 'ดวง', 'พลอย', 'มาลี'];
const LAST_NAMES = ['ใจดี', 'สุขสันต์', 'รัตนา', 'ศรีสุข', 'วงศ์ดี', 'จันทร์เพ็ญ', 'แสงทอง', 'มาลัย', 'พงษ์ดี', 'บุญมา', 'ทองดี', 'สมบูรณ์', 'เจริญ', 'รุ่งเรือง', 'สว่าง'];

function seededRandom(seed) {
    let s = seed;
    return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

const ALL_STUDENTS = (() => {
    const rng = seededRandom(42);
    return Array.from({ length: 50 }, (_, i) => {
        const year = [1, 2, 3, 4][Math.floor(rng() * 4)];
        const major = MAJORS[Math.floor(rng() * MAJORS.length)];
        const gpa = +(1.5 + rng() * 2.5).toFixed(2);
        const fn = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
        const ln = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
        return {
            id: `6${6 - year}01${String(i).padStart(4, '0')}`,
            name: `${fn} ${ln}`,
            major, year, gpa,
            status: gpa < 2.0 ? 'รอพินิจ' : 'ปกติ'
        };
    });
})();

// ==================== Smart Student Search ====================
function searchStudents(query) {
    const q = query.toLowerCase();

    // Extract limit ("5 คน", "แค่ 3", "ขอ 10")
    let limit = 0;
    const limitMatch = q.match(/(\d+)\s*(คน|ราย|รายการ)/);
    if (limitMatch) limit = parseInt(limitMatch[1]);
    const limitMatch2 = q.match(/(?:แค่|ขอ|เอา|แสดง|โชว์)\s*(\d+)/);
    if (!limit && limitMatch2) limit = parseInt(limitMatch2[1]);

    let results = [];
    let searchDesc = '';

    // Search by ID prefix ("รหัส 63", "63010", "6301")
    const idPrefixMatch = q.match(/(?:รหัส|id)\s*(\d{2,8})/i) || q.match(/\b(6[0-9]\d{0,6})\b/);
    if (idPrefixMatch) {
        const prefix = idPrefixMatch[1];
        results = ALL_STUDENTS.filter(s => s.id.startsWith(prefix));
        searchDesc = `รหัสขึ้นต้นด้วย "${prefix}"`;
    }

    // Search by name
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

    // Search by major
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

    // Search by year
    if (results.length === 0) {
        const yearMatch = q.match(/(?:ชั้นปี|ปี)\s*(\d)/);
        if (yearMatch && (q.includes('นักศึกษา') || q.includes('นิสิต') || q.includes('รายชื่อ') || q.includes('คน') || q.includes('ใคร'))) {
            const yr = parseInt(yearMatch[1]);
            results = ALL_STUDENTS.filter(s => s.year === yr);
            searchDesc = `ชั้นปี ${yr}`;
        }
    }

    // Search by GPA ("เกรดต่ำ", "รอพินิจ", "gpa สูง")
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

// ==================== Standard AI Response ====================
function getAIResponse(question) {
    const q = question.toLowerCase();

    // 1. Check forecast first (graphs/charts)
    const forecastParsed = parseForecastRequest(question);
    if (forecastParsed) {
        return generateForecastResponse(forecastParsed);
    }

    // 2. Check student search
    const studentKeywords = ['รหัส', 'รายชื่อ', 'หานักศึกษา', 'ค้นหานักศึกษา', 'นักศึกษา', 'นิสิต', 'สาขา', 'ชั้นปี', 'รอพินิจ', 'เกรดต่ำ', 'เกรดสูง', 'เกียรตินิยม'];
    const hasStudentQuery = studentKeywords.some(k => q.includes(k)) &&
        (q.match(/\d{2,}/) || q.includes('สาขา') || q.includes('ชั้นปี') || q.includes('รอพินิจ') || q.includes('เกรดต่ำ') || q.includes('เกรดสูง') || q.includes('เกียรตินิยม') || q.includes('รายชื่อ') || q.includes('ใคร') || q.includes('คน'));
    if (hasStudentQuery) {
        const studentResult = searchStudents(q);
        if (studentResult) return studentResult;
    }

    // 3. Budget data queries (non-forecast)
    if (q.includes('งบประมาณ') || q.includes('budget') || q.includes('รายรับ') || q.includes('รายจ่าย') || q.includes('คงเหลือ')) {
        const isScience = ['คณะวิทยาศาสตร์', 'วิทยาศาสตร์', 'คณะวิทย์'].some(k => q.includes(k));
        const data = isScience ? scienceFacultyBudgetData : universityBudgetData;
        const scope = isScience ? 'คณะวิทยาศาสตร์' : 'มหาวิทยาลัยแม่โจ้';
        const actual = data.yearly.filter(y => y.type === 'actual');
        const latest = actual[actual.length - 1];

        // Check if asking about a specific year
        const yearMatch = q.match(/ปี\s*(\d{2,4})/);
        if (yearMatch) {
            let yr = parseInt(yearMatch[1]);
            if (yr < 100) yr += 2500;
            const found = data.yearly.find(y => parseInt(y.year) === yr);
            if (found) {
                return {
                    text: `📊 **งบประมาณ${scope} ปี ${found.year}** ${found.type === 'forecast' ? '(พยากรณ์)' : ''}\n\n` +
                        `💰 รายรับ: **${found.revenue.toLocaleString()}** ล้านบาท\n` +
                        `📉 รายจ่าย: **${found.expense.toLocaleString()}** ล้านบาท\n` +
                        `💎 คงเหลือ: **${found.surplus.toLocaleString()}** ล้านบาท\n` +
                        `📈 % การใช้จ่าย: ${((found.expense / found.revenue) * 100).toFixed(1)}%`
                };
            }
        }

        return {
            text: `📊 **งบประมาณ${scope}**\n\n` +
                `📅 ข้อมูลล่าสุด ปี ${latest.year}:\n` +
                `💰 รายรับ: **${latest.revenue.toLocaleString()}** ล้านบาท\n` +
                `📉 รายจ่าย: **${latest.expense.toLocaleString()}** ล้านบาท\n` +
                `💎 คงเหลือ: **${latest.surplus.toLocaleString()}** ล้านบาท\n` +
                `📈 % การใช้จ่าย: ${((latest.expense / latest.revenue) * 100).toFixed(1)}%\n\n` +
                `📋 ข้อมูลย้อนหลัง ${actual.length} ปี (${actual[0].year}–${latest.year})\n` +
                actual.map(y => `• ปี ${y.year}: รับ ${y.revenue.toLocaleString()} / จ่าย ${y.expense.toLocaleString()} / เหลือ ${y.surplus.toLocaleString()}`).join('\n') +
                '\n\n💡 ลองถาม "พยากรณ์งบประมาณปี 70 71 เป็นกราฟ" เพื่อดูกราฟ'
        };
    }

    // 4. Student statistics
    if (q.includes('นิสิต') || q.includes('นักศึกษา') || q.includes('จำนวน') || q.includes('student') || q.includes('สถิติ')) {
        const isScience = ['คณะวิทยาศาสตร์', 'วิทยาศาสตร์', 'คณะวิทย์'].some(k => q.includes(k));
        if (isScience) {
            const sci = studentStatsData.scienceFaculty;
            return {
                text: `🔬 **สถิตินิสิตคณะวิทยาศาสตร์**\n\n` +
                    sci.byLevel.map(l => `${l.icon} ${l.level}: ${l.count.toLocaleString()} คน`).join('\n') +
                    `\n━━━━━━━━━━━━━━━━━━━\n📌 รวม: **${sci.total.toLocaleString()}** คน\n\n` +
                    `📊 แยกตามปีเข้า:\n` +
                    sci.byEnrollmentYear.map(e => `• ปี ${e.year}: ${e.count} คน`).join('\n') +
                    '\n\n👥 บุคลากร: ' + sci.personnel.total + ' คน (ป.เอก ' + sci.personnel.byEducation[0].count + ' คน)'
            };
        }
        return {
            text: '📊 **สถิตินิสิตคงอยู่ปัจจุบัน มหาวิทยาลัยแม่โจ้**\n(อ้างอิง dashboard.mju.ac.th)\n\n' +
                studentStatsData.current.byLevel.map(l => `${l.icon} ${l.level}: ${l.count.toLocaleString()} คน`).join('\n') +
                '\n━━━━━━━━━━━━━━━━━━━\n📌 รวมทั้งหมด: **' + studentStatsData.current.total.toLocaleString() + '** คน\n\n' +
                '🏫 **แยกตามคณะ (5 อันดับแรก):**\n' +
                studentStatsData.byFaculty.slice(0, 5).map((f, i) =>
                    `${i + 1}. ${f.name}: ${(f.bachelor + f.master + f.doctoral).toLocaleString()} คน`
                ).join('\n') +
                '\n\n💡 ลอง "พยากรณ์จำนวนนิสิตปี 70 71 แบบกราฟ"'
        };
    }

    // 5. Tuition
    if (q.includes('ค่าเทอม') || q.includes('tuition') || q.includes('ค่าธรรมเนียม') || q.includes('ค่าเรียน')) {
        return {
            text: '💰 **ค่าธรรมเนียมการศึกษา ม.แม่โจ้** (เหมาจ่าย)\n\n' +
                '📌 ค่าเทอม: **16,000 - 19,000** บาท/เทอม\n' +
                '📌 ค่าแรกเข้า: **2,000 - 3,000** บาท\n' +
                '📌 ตลอดหลักสูตร 4 ปี: **128,000 - 152,000** บาท\n\n' +
                '🏫 **แยกตามคณะ:**\n' +
                '• วิทยาศาสตร์: 17,500 บาท\n• วิศวกรรม: 19,000 บาท\n• บริหาร: 16,000 บาท\n• คอมพิวเตอร์: 18,500 บาท (รวมค่า Lab)\n\n' +
                '_สาขาคอมพิวเตอร์สูงกว่าเล็กน้อยเนื่องจากมีค่า Lab_'
        };
    }

    // 6. Financial
    if (q.includes('การเงิน') || q.includes('จ่ายเงิน') || q.includes('ทุน') || q.includes('scholarship') || q.includes('ค้างชำระ')) {
        return {
            text: '💳 **สถานะการเงิน**\n\n' +
                '📋 ค่าเทอม 1/2568: **18,500** บาท — สถานะ: ⚠️ **ค้างชำระ**\n' +
                '📅 ครบกำหนด: 28 ก.พ. 2568\n\n' +
                '🎓 **ทุนการศึกษา:**\n• ทุนเรียนดี คณะวิทยาศาสตร์: 10,000 บาท ✅ ได้รับทุน\n\n' +
                '📊 ยอดชำระแล้ว: 37,000 บาท | คงค้าง: 111,000 บาท'
        };
    }

    // 7. Activities
    if (q.includes('กิจกรรม') || q.includes('activity') || q.includes('ชั่วโมง') || q.includes('จิตอาสา')) {
        return {
            text: '🎯 **ชั่วโมงกิจกรรม**\n\n' +
                '📊 ผ่านแล้ว: **38/60** ชม. (63.3%)\n\n' +
                '• 🤝 จิตอาสา: 15 ชม.\n• ⚽ กีฬา: 8 ชม.\n• 📚 วิชาการ: 10 ชม.\n• 🎨 ศิลปวัฒนธรรม: 5 ชม.\n\n' +
                '⏳ ต้องทำเพิ่มอีก **22 ชั่วโมง**'
        };
    }

    // 8. Library
    if (q.includes('ห้องสมุด') || q.includes('library') || q.includes('หนังสือ') || q.includes('ยืม')) {
        return {
            text: '📖 **รายการยืมหนังสือ** (3 เล่ม)\n\n' +
                '1. 📕 Introduction to Algorithms — ⏰ ใกล้กำหนดคืน\n' +
                '2. 📗 Clean Code — ✅ สถานะปกติ\n' +
                '3. 📘 Design Patterns — ⚠️ **เกินกำหนด** (ค่าปรับ 50 บาท)'
        };
    }

    // 9. GPA
    if (q.includes('เกรด') || q.includes('gpa') || q.includes('ผลการเรียน')) {
        const avgGpa = (ALL_STUDENTS.reduce((s, st) => s + st.gpa, 0) / ALL_STUDENTS.length).toFixed(2);
        const above3 = ALL_STUDENTS.filter(s => s.gpa >= 3.0).length;
        const below2 = ALL_STUDENTS.filter(s => s.gpa < 2.0).length;
        return {
            text: `📊 **สรุป GPA นักศึกษา** (จากข้อมูลในระบบ ${ALL_STUDENTS.length} คน)\n\n` +
                `📈 GPA เฉลี่ย: **${avgGpa}**\n` +
                `🟢 GPA ≥ 3.00: ${above3} คน (${((above3 / ALL_STUDENTS.length) * 100).toFixed(0)}%)\n` +
                `🔴 GPA < 2.00 (รอพินิจ): ${below2} คน (${((below2 / ALL_STUDENTS.length) * 100).toFixed(0)}%)\n\n` +
                '💡 ลอง "นักศึกษาเกรดสูง" หรือ "นักศึกษารอพินิจ" เพื่อดูรายชื่อ'
        };
    }

    // 10. Behavior
    if (q.includes('ความประพฤติ') || q.includes('behavior') || q.includes('คะแนนความ')) {
        return {
            text: '📋 **คะแนนความประพฤติ**\n\n' +
                '🏆 คะแนนปัจจุบัน: **92/100**\n📈 แนวโน้ม: ดีขึ้น (88 → 92)\n\n' +
                '📊 ย้อนหลัง:\n• 1/2566: 95 | 2/2566: 90 | 1/2567: 88 | 2/2567: 92'
        };
    }

    // 11. University info
    if (q.includes('แม่โจ้') || q.includes('mju') || q.includes('มหาวิทยาลัย')) {
        return {
            text: '🏫 **มหาวิทยาลัยแม่โจ้**\n📍 อ.สันทราย จ.เชียงใหม่\n\n' +
                '👨‍🎓 นิสิตคงอยู่: **19,821** คน\n' +
                '📚 18 คณะ/วิทยาลัย\n' +
                '🎓 อัตราสำเร็จการศึกษา: 89.5%\n' +
                '📊 GPA เฉลี่ย: 3.12\n\n' +
                '🔬 คณะวิทยาศาสตร์: 1,591 คน | บุคลากร 113 คน\n' +
                '💰 งบประมาณคณะวิทย์ ปีล่าสุด: 14.5 ล้านบาท'
        };
    }

    // 12. Graduation
    if (q.includes('จบ') || q.includes('สำเร็จ') || q.includes('graduation') || q.includes('หน่วยกิต')) {
        return {
            text: '🎓 **ข้อมูลการสำเร็จการศึกษา**\n\n' +
                '📊 อัตราสำเร็จ: **89.5%**\n' +
                '📚 หน่วยกิตขั้นต่ำ: 120-140 หน่วยกิต (ขึ้นอยู่กับหลักสูตร)\n' +
                '🎯 ชั่วโมงกิจกรรม: 60 ชั่วโมง\n' +
                '📝 GPA ขั้นต่ำ: 2.00\n\n' +
                'เข้าดูรายละเอียดที่หน้า "ตรวจสอบการจบ" ได้ครับ'
        };
    }

    // 13. Dashboard
    if (q.includes('dashboard') || q.includes('กราฟ') || q.includes('chart') || q.includes('หน้า')) {
        return {
            text: '📊 **หน้าต่างๆ ใน Dashboard:**\n\n' +
                '🏠 หน้าแรก — สรุปข้อมูลทั้งหมด\n' +
                '💳 ค่าธรรมเนียม — ค่าเทอมแยกคณะ\n' +
                '📊 สถิตินิสิต — จำนวนนิสิตแยกคณะ/ระดับ\n' +
                '💰 งบประมาณคณะ — รายรับ-รายจ่าย พร้อมกราฟพยากรณ์\n' +
                '💵 การเงิน — สถานะค่าเทอม/ทุน\n' +
                '🎯 กิจกรรม — ชั่วโมงกิจกรรม/ความประพฤติ\n' +
                '📋 รายชื่อนักศึกษา — ค้นหา/กรอง/Export CSV\n' +
                '🎓 ตรวจสอบการจบ — ตรวจหน่วยกิต/เกรด'
        };
    }

    // 14. Greetings
    if (q.includes('สวัสดี') || q.includes('hello') || q.includes('hi') || q.includes('หวัดดี')) {
        return {
            text: 'สวัสดีครับ! 👋 ผม MJU AI Assistant ช่วยได้หลายอย่างเลยครับ:\n\n' +
                '🔍 **ค้นหานักศึกษา** — "รายชื่อนักศึกษารหัส 63" / "นักศึกษาสาขาคอม 5 คน"\n' +
                '📊 **ข้อมูลสถิติ** — "สถิตินิสิตคณะวิทย์" / "งบประมาณปี 2568"\n' +
                '🔮 **พยากรณ์** — "พยากรณ์งบฯ คณะวิทย์ ปี 70 71 เป็นกราฟ"\n' +
                '💰 **อื่นๆ** — ค่าเทอม, การเงิน, กิจกรรม, ห้องสมุด, เกรด'
        };
    }

    // 15. Help
    if (q.includes('ช่วย') || q.includes('help') || q.includes('ทำอะไรได้')) {
        return {
            text: '📚 **ผมช่วยได้ดังนี้:**\n\n' +
                '🔍 **ค้นหานักศึกษา:**\n' +
                '• "รายชื่อรหัส 63" — หาตามรหัส\n' +
                '• "นักศึกษาสาขาคอม" — หาตามสาขา\n' +
                '• "นิสิตชั้นปี 2" — หาตามชั้นปี\n' +
                '• "นักศึกษารอพินิจ" — สถานะเสี่ยง\n' +
                '• "นักศึกษาเกรดสูง 5 คน" — จำกัดจำนวน\n\n' +
                '📊 **ข้อมูลระบบ:**\n' +
                '• งบประมาณ (มหาวิทยาลัย/คณะวิทย์)\n' +
                '• สถิตินิสิต, GPA, ค่าเทอม\n' +
                '• การเงิน, กิจกรรม, ห้องสมุด\n\n' +
                '🔮 **พยากรณ์ + กราฟ:**\n' +
                '• "พยากรณ์งบฯ คณะวิทย์ ปี 70 71 เป็นกราฟ"\n' +
                '• "คาดการณ์นิสิต ปี 2570 แบบกราฟแท่ง"'
        };
    }

    return { text: 'ไม่มีข้อมูลนี้ในระบบ 🙏\n\nลองถามเกี่ยวกับ: นักศึกษา (รหัส/สาขา/ชั้นปี), งบประมาณ, สถิตินิสิต, ค่าเทอม, การเงิน, กิจกรรม, หรือพิมพ์ "ช่วย" เพื่อดูสิ่งที่ผมทำได้ครับ' };
}


// ==================== Chat Message with Chart Component ====================
function ChatMessage({ msg }) {
    const [chartType, setChartType] = useState(msg.chart?.chartType || 'line');

    if (msg.role === 'user') {
        return <div className="chat-message user">{msg.text}</div>;
    }

    // Format text with markdown-like bold
    const formatText = (text) => {
        if (!text) return null;
        return text.split('\n').map((line, i) => {
            const parts = line.split(/(\*\*.*?\*\*|_.*?_)/g).map((part, j) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={j}>{part.slice(2, -2)}</strong>;
                }
                if (part.startsWith('_') && part.endsWith('_')) {
                    return <em key={j} style={{ fontSize: '0.85em', color: '#9ca3af' }}>{part.slice(1, -1)}</em>;
                }
                return part;
            });
            return <div key={i}>{parts}</div>;
        });
    };

    const chartData = msg.chart;

    return (
        <div className="chat-message bot">
            {formatText(msg.text)}

            {chartData && (
                <div className="chat-chart-container">
                    {/* Chart type toggle */}
                    <div className="chat-chart-toggle">
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
                    </div>

                    {/* Chart */}
                    <div className="chat-chart-wrapper">
                        {chartType === 'line' ? (
                            <Line data={chartData.data} options={chartData.options} />
                        ) : (
                            <Bar data={chartData.data} options={chartData.options} />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}


// ==================== Main AIChat Component ====================
export default function AIChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        {
            role: 'bot',
            text: 'สวัสดีครับ! 🎓 ผม MJU AI Assistant พร้อมช่วยตอบคำถามเกี่ยวกับข้อมูลมหาวิทยาลัยแม่โจ้ ถามมาได้เลยครับ!\n\n🔮 **ใหม่!** ลองพิมพ์ "พยากรณ์งบประมาณคณะวิทยาศาสตร์ ปี 70 71 เป็นกราฟ"',
            chart: null
        }
    ]);
    const [input, setInput] = useState('');
    const [typing, setTyping] = useState(false);
    const messagesEnd = useRef(null);

    // ── Draggable FAB state ──
    const [fabPos, setFabPos] = useState({ right: 24, bottom: 24 });
    const dragRef = useRef({ dragging: false, hasMoved: false, startX: 0, startY: 0, startR: 0, startB: 0 });

    const onDragStart = useCallback((clientX, clientY) => {
        dragRef.current = {
            dragging: true,
            hasMoved: false,
            startX: clientX,
            startY: clientY,
            startR: fabPos.right,
            startB: fabPos.bottom,
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

    // Mouse events
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

    // Touch events
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
        // Only toggle chat if we didn't drag
        if (!dragRef.current.hasMoved) {
            setIsOpen(prev => !prev);
        }
    }, []);

    useEffect(() => {
        messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, typing]);

    const handleSend = () => {
        if (!input.trim()) return;

        const userMsg = input.trim();
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInput('');
        setTyping(true);

        setTimeout(() => {
            const response = getAIResponse(userMsg);
            setMessages(prev => [...prev, {
                role: 'bot',
                text: response.text,
                chart: response.chart || null
            }]);
            setTyping(false);
        }, 800 + Math.random() * 700);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSend();
    };

    // Quick action suggestions
    const quickActions = [
        { label: '🔮 พยากรณ์งบฯ คณะวิทย์', query: 'พยากรณ์งบประมาณคณะวิทยาศาสตร์ ปี 70 71 เป็นกราฟ' },
        { label: '📊 คาดการณ์นิสิต', query: 'พยากรณ์จำนวนนิสิตมหาวิทยาลัย ปี 70 71 แบบกราฟแท่ง' },
        { label: '📈 งบฯ มหาวิทยาลัย', query: 'พยากรณ์งบประมาณมหาวิทยาลัย ปี 2570 2571 เป็นกราฟเส้น' },
    ];

    const handleQuickAction = (query) => {
        setInput(query);
        setTimeout(() => {
            setMessages(prev => [...prev, { role: 'user', text: query }]);
            setTyping(true);
            setTimeout(() => {
                const response = getAIResponse(query);
                setMessages(prev => [...prev, {
                    role: 'bot',
                    text: response.text,
                    chart: response.chart || null
                }]);
                setTyping(false);
            }, 800 + Math.random() * 700);
        }, 100);
        setInput('');
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
                const panelW = 400, panelH = 520, fabSize = 60, gap = 10;
                const fabX = window.innerWidth - fabPos.right - fabSize;  // left edge of FAB
                const fabY = window.innerHeight - fabPos.bottom - fabSize; // top edge of FAB
                const onRightHalf = (fabX + fabSize / 2) > window.innerWidth / 2;

                const panelStyle = { position: 'fixed', zIndex: 999 };

                // Horizontal: open away from nearest edge
                if (onRightHalf) {
                    // FAB is on right side → panel opens to left
                    const r = fabPos.right;
                    panelStyle.right = Math.max(0, r);
                } else {
                    // FAB is on left side → panel opens to right
                    const l = fabX;
                    panelStyle.left = Math.max(0, l);
                }

                // Vertical: panel above FAB, clamped to viewport
                let panelBottom = fabPos.bottom + fabSize + gap;
                if (panelBottom + panelH > window.innerHeight) {
                    panelBottom = Math.max(4, window.innerHeight - panelH - 4);
                }
                panelStyle.bottom = panelBottom;

                return (
                    <div className="ai-chat-panel" style={panelStyle}>
                        <div className="ai-chat-header">
                            <div className="ai-chat-header-left">
                                <div className="ai-chat-header-avatar">🤖</div>
                                <div>
                                    <h3>MJU AI Assistant</h3>
                                    <p>พยากรณ์ข้อมูลได้ 🔮 พร้อมกราฟ</p>
                                </div>
                            </div>
                            <button className="ai-chat-close" onClick={() => setIsOpen(false)}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="ai-chat-messages">
                            {messages.map((msg, i) => (
                                <ChatMessage key={i} msg={msg} />
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
                            <input
                                type="text"
                                placeholder="ถามหรือพยากรณ์ข้อมูล เช่น พยากรณ์งบฯ ปี 70..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                            />
                            <button className="ai-chat-send" onClick={handleSend}>
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                );
            })()}
        </>
    );
}
