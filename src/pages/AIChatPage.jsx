import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, Send, BarChart3, TrendingUp, Maximize2, Mic, MicOff, X, Bot, Sparkles, Search, ChartLine, AudioLines, Zap, RotateCcw, Paperclip, FileSpreadsheet } from 'lucide-react';
import { Chart as ReactChart } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
    Title, Tooltip, Legend, BarElement, Filler, ArcElement, RadialLinearScale,
    BarController, LineController, PieController, DoughnutController,
    RadarController, PolarAreaController, ScatterController, BubbleController,
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { themeAdaptorPlugin } from '../utils/chartTheme';
import { sendMessageToGemini, resetConversation } from '../services/geminiService';
import {
    studentStatsData, universityBudgetData, scienceFacultyBudgetData,
    dashboardSummary,
} from '../data/mockData';
import { scienceStudentList, SCIENCE_MAJORS } from '../data/studentListData';
import { graduationHistory } from '../data/graduationData';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, RadialLinearScale, Title, Tooltip, Legend, BarElement, Filler, ArcElement, BarController, LineController, PieController, DoughnutController, RadarController, PolarAreaController, ScatterController, BubbleController, zoomPlugin, themeAdaptorPlugin);

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
        color: '#7B68EE', keywords: ['นิสิต', 'นักศึกษา', 'student', 'จำนวนนิสิต', 'จำนวนนักศึกษา'],
        scopeKeywords: ['มหาวิทยาลัย', 'มจ', 'mju', 'ทั้งหมด'],
        yAxisID: 'y',
    },
    scienceStudents: {
        label: 'จำนวนนิสิตคณะวิทยาศาสตร์', unit: 'คน', scope: 'คณะวิทยาศาสตร์',
        getData: () => studentStatsData.scienceFaculty.byEnrollmentYear.map(e => ({ x: parseInt(e.year), y: e.count })),
        color: '#006838', keywords: ['นิสิต', 'นักศึกษา', 'student', 'จำนวนนิสิต', 'จำนวนนักศึกษา'],
        scopeKeywords: ['คณะวิทยาศาสตร์', 'วิทยาศาสตร์', 'science', 'คณะวิทย์'],
        yAxisID: 'y',
    },
    // ==================== GPA Datasets ====================
    scienceGPA: {
        label: 'เกรดเฉลี่ย (GPA) คณะวิทยาศาสตร์', unit: '', scope: 'คณะวิทยาศาสตร์',
        getData: () => graduationHistory.map(g => ({ x: g.year, y: g.avgGPA })),
        color: '#C5A028', keywords: ['เกรด', 'gpa', 'เกรดเฉลี่ย', 'ผลการเรียน', 'grade'],
        scopeKeywords: ['คณะวิทยาศาสตร์', 'วิทยาศาสตร์', 'science', 'คณะวิทย์', 'มหาวิทยาลัย', 'มจ', 'mju', 'ทั้งหมด'],
        yAxisID: 'y1',
    },
    scienceGraduationRate: {
        label: 'อัตราสำเร็จการศึกษา คณะวิทยาศาสตร์', unit: '%', scope: 'คณะวิทยาศาสตร์',
        getData: () => graduationHistory.map(g => ({ x: g.year, y: g.rate })),
        color: '#A23B72', keywords: ['อัตราสำเร็จ', 'สำเร็จการศึกษา', 'graduation', 'จบการศึกษา', 'อัตราจบ'],
        scopeKeywords: ['คณะวิทยาศาสตร์', 'วิทยาศาสตร์', 'science', 'คณะวิทย์', 'มหาวิทยาลัย', 'มจ', 'mju', 'ทั้งหมด'],
        yAxisID: 'y1',
    },
    scienceGraduated: {
        label: 'จำนวนผู้สำเร็จการศึกษา คณะวิทยาศาสตร์', unit: 'คน', scope: 'คณะวิทยาศาสตร์',
        getData: () => graduationHistory.map(g => ({ x: g.year, y: g.graduated })),
        color: '#2E86AB', keywords: ['ผู้สำเร็จ', 'จบ', 'graduated', 'สำเร็จการศึกษา', 'จำนวนผู้สำเร็จ'],
        scopeKeywords: ['คณะวิทยาศาสตร์', 'วิทยาศาสตร์', 'science', 'คณะวิทย์', 'มหาวิทยาลัย', 'มจ', 'mju', 'ทั้งหมด'],
        yAxisID: 'y',
    },
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

    // Check for GPA / grade keywords
    const hasGPA = ['เกรด', 'gpa', 'เกรดเฉลี่ย', 'ผลการเรียน', 'grade'].some(k => q.includes(k));
    // Check for student keywords
    const hasStudent = ['นิสิต', 'นักศึกษา', 'student', 'จำนวนนิสิต'].some(k => q.includes(k));
    // Check for graduation keywords
    const hasGraduation = ['สำเร็จการศึกษา', 'อัตราสำเร็จ', 'จบการศึกษา', 'graduation', 'เรียนจบ'].some(k => q.includes(k));
    // Check for budget keywords
    const hasBudget = ['งบประมาณ', 'budget', 'งบ', 'รายรับ', 'รายจ่าย', 'revenue', 'expense'].some(k => q.includes(k));

    // Multi-topic matching: user asks "นักศึกษากับเกรด" -> match BOTH
    if (hasStudent && hasGPA) {
        matchedDatasets = isScience ? ['scienceStudents', 'scienceGPA'] : ['universityStudents', 'scienceGPA'];
    } else if (hasStudent && hasGraduation) {
        matchedDatasets = ['scienceStudents', 'scienceGraduationRate', 'scienceGraduated'];
    } else if (hasGPA && hasGraduation) {
        matchedDatasets = ['scienceGPA', 'scienceGraduationRate'];
    } else if (hasGPA) {
        matchedDatasets = ['scienceGPA'];
    } else if (hasGraduation) {
        matchedDatasets = ['scienceGraduationRate', 'scienceGraduated'];
    } else {
        // Original matching logic for budget and students
        for (const [key, ds] of Object.entries(DATASETS)) {
            const hasKeyword = ds.keywords.some(k => q.includes(k));
            const hasScopeMatch = isScience
                ? ds.scopeKeywords.some(k => ['คณะวิทยาศาสตร์', 'วิทยาศาสตร์', 'science', 'คณะวิทย์'].includes(k))
                : ds.scopeKeywords.some(k => ['มหาวิทยาลัย', 'มจ', 'mju', 'ทั้งหมด'].includes(k));
            if (hasKeyword && hasScopeMatch) matchedDatasets.push(key);
        }

        if (matchedDatasets.length === 0 && isScience) {
            if (hasBudget) {
                matchedDatasets = (q.includes('รายจ่าย') || q.includes('expense')) ? ['scienceBudgetExpense'] : ['scienceBudgetRevenue'];
            } else if (hasStudent) {
                matchedDatasets = ['scienceStudents'];
            }
        }

        if (matchedDatasets.length === 0) {
            if (q.includes('งบประมาณ') || q.includes('budget') || q.includes('งบ')) matchedDatasets = ['universityBudget'];
            else if (q.includes('รายรับ') || q.includes('revenue')) matchedDatasets = ['universityBudgetRevenue'];
            else if (q.includes('รายจ่าย') || q.includes('expense')) matchedDatasets = ['universityBudgetExpense'];
            else if (hasStudent) matchedDatasets = ['universityStudents'];
        }
    }

    // Remove duplicates
    if (matchedDatasets.includes('universityBudget') && matchedDatasets.includes('universityBudgetRevenue')) {
        matchedDatasets = matchedDatasets.filter(d => d !== 'universityBudget');
    }
    matchedDatasets = [...new Set(matchedDatasets)];

    return { years: years.sort(), chartType, datasets: matchedDatasets, isScience };
}

// ==================== Generate Forecast Response ====================
function generateForecastResponse(parsed) {
    if (!parsed || parsed.datasets.length === 0) {
        return null;
    }

    const results = [];
    const allLabels = [];
    const allDatasets = [];
    let needsDualAxis = false;

    // Check if we need dual Y-axis (mixing count + GPA/rate)
    const yAxisIDs = parsed.datasets.map(k => DATASETS[k]?.yAxisID).filter(Boolean);
    if (yAxisIDs.includes('y') && yAxisIDs.includes('y1')) {
        needsDualAxis = true;
    }

    for (const dsKey of parsed.datasets) {
        const ds = DATASETS[dsKey];
        if (!ds) continue;
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
            const predicted = model.predict(y);
            // For GPA, keep 2 decimal places
            return ds.yAxisID === 'y1' && ds.unit === '' ? +(model.slope * y + model.intercept).toFixed(2) : predicted;
        });

        if (allLabels.length === 0) allLabels.push(...labels);
        // If different datasets have different labels, merge
        else if (labels.length > allLabels.length) {
            allLabels.length = 0;
            allLabels.push(...labels);
        }

        const yAxisID = needsDualAxis ? (ds.yAxisID || 'y') : 'y';

        allDatasets.push({
            label: `${ds.label} (ข้อมูลจริง)`, data: actualValues,
            borderColor: ds.color, backgroundColor: ds.color + '20',
            fill: parsed.chartType === 'line', tension: 0.4,
            pointBackgroundColor: ds.color, pointRadius: 5, borderWidth: 2.5,
            borderRadius: parsed.chartType === 'bar' ? 6 : 0,
            yAxisID,
        });
        allDatasets.push({
            label: `${ds.label} (พยากรณ์)`, data: forecastValues,
            borderColor: ds.color, borderDash: [6, 3], backgroundColor: ds.color + '40',
            tension: 0.4, pointBackgroundColor: ds.color + 'cc', pointRadius: 5,
            pointStyle: 'triangle', borderWidth: 2,
            borderRadius: parsed.chartType === 'bar' ? 6 : 0,
            yAxisID,
        });

        const forecastSummary = parsed.years.map(y => {
            const val = ds.yAxisID === 'y1' && ds.unit === '' 
                ? (model.slope * y + model.intercept).toFixed(2)
                : model.predict(y).toLocaleString();
            return `   ปี ${y}: ~${val} ${ds.unit}`;
        }).join('\n');
        results.push(`📊 **${ds.label}**\nข้อมูลจริง: ${existingYears[0]}-${existingYears[existingYears.length - 1]} (${existingYears.length} ปี)\nพยากรณ์ (Linear Regression):\n${forecastSummary}`);
    }

    // Build scales config — support dual Y-axis
    const scalesConfig = {
        x: { ticks: { color: '#9ca3af', font: { size: 11 } }, grid: { display: false } },
        y: {
            ticks: { color: '#9ca3af', font: { size: 11 } },
            grid: { color: 'rgba(255,255,255,0.04)' },
            title: needsDualAxis ? { display: true, text: 'จำนวน (คน)', color: '#9ca3af', font: { size: 11 } } : {},
        },
    };
    if (needsDualAxis) {
        scalesConfig.y1 = {
            position: 'right',
            ticks: { color: '#C5A028', font: { size: 11 } },
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'เกรดเฉลี่ย / %', color: '#C5A028', font: { size: 11 } },
        };
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
                            const dsIdx = Math.floor(ctx.datasetIndex / 2);
                            const ds = DATASETS[parsed.datasets[dsIdx]] || DATASETS[parsed.datasets[0]];
                            return `${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString() || '-'} ${ds?.unit || ''}`;
                        }
                    }
                }
            },
            scales: scalesConfig,
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

// ==================== Combo Chart: Students vs Graduation Rate ====================
function generateComboChart() {
    const faculties = dashboardSummary.faculties;
    const maxStudents = Math.max(...faculties.map(f => f.totalStudents));

    const labels = faculties.map(f => {
        const n = f.name.replace(/^คณะ|^มหาวิทยาลัย|^วิทยาลัย/g, '').trim();
        return n.length > 14 ? n.slice(0, 14) + '…' : n;
    });

    const normalizedStudents = faculties.map(f => +((f.totalStudents / maxStudents) * 100).toFixed(1));
    const gradRates = faculties.map(f => f.graduationRate);

    const chart = {
        chartType: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'จำนวนนิสิต (Index 0-100)',
                    data: normalizedStudents,
                    backgroundColor: 'rgba(0, 166, 81, 0.65)',
                    borderColor: '#00a651',
                    borderWidth: 1,
                    borderRadius: 6,
                    order: 2,
                },
                {
                    type: 'line',
                    label: 'อัตราสำเร็จการศึกษา (%)',
                    data: gradRates,
                    borderColor: '#C5A028',
                    backgroundColor: 'rgba(197, 160, 40, 0.15)',
                    borderWidth: 2.5,
                    pointBackgroundColor: '#C5A028',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    tension: 0.35,
                    fill: true,
                    order: 1,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 14, font: { size: 11 }, usePointStyle: true } },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            if (ctx.datasetIndex === 0) {
                                const actual = faculties[ctx.dataIndex].totalStudents.toLocaleString();
                                return `${ctx.dataset.label}: ${ctx.parsed.y} (จริง: ${actual} คน)`;
                            }
                            return `${ctx.dataset.label}: ${ctx.parsed.y}%`;
                        }
                    }
                },
                zoom: { pan: { enabled: true, mode: 'x' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' } }
            },
            scales: {
                x: { ticks: { color: '#9ca3af', font: { size: 10 }, maxRotation: 45, minRotation: 25 }, grid: { display: false } },
                y: { min: 0, max: 100, ticks: { color: '#9ca3af', font: { size: 11 }, callback: v => v }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    };

    let text = `📊 **Combo Chart: จำนวนนิสิต vs อัตราสำเร็จการศึกษา (แยกตามคณะ)**\n\n`;
    text += `📌 **หมายเหตุ:** จำนวนนิสิตถูก Normalize เป็น Index (0-100) เพื่อให้เปรียบเทียบกับ % อัตราสำเร็จได้ในแกน Y เดียวกัน\n`;
    text += `โดยคณะที่มีนิสิตมากสุด = 100 (${faculties.reduce((a, b) => a.totalStudents > b.totalStudents ? a : b).name}: ${maxStudents.toLocaleString()} คน)\n\n`;

    text += `📋 **จำนวนนิสิตจริง (ก่อน Normalize):**\n`;
    faculties.forEach(f => {
        const idx = normalizedStudents[faculties.indexOf(f)];
        text += `• ${f.name}: **${f.totalStudents.toLocaleString()}** คน (Index: ${idx}) | สำเร็จ: ${f.graduationRate}%\n`;
    });

    text += `\n🔍 **Insight:**\n`;
    const topGrad = [...faculties].sort((a, b) => b.graduationRate - a.graduationRate)[0];
    const lowGrad = [...faculties].sort((a, b) => a.graduationRate - b.graduationRate)[0];
    text += `• 🏆 อัตราสำเร็จสูงสุด: ${topGrad.name} (${topGrad.graduationRate}%)\n`;
    text += `• ⚠️ อัตราสำเร็จต่ำสุด: ${lowGrad.name} (${lowGrad.graduationRate}%)\n`;
    text += `• คณะที่มีนิสิตมากไม่ได้หมายความว่าจะมีอัตราสำเร็จสูงเสมอไป`;

    return { text, chart };
}

// ==================== Check if query needs local handling ====================
// Only handle queries that local functions SPECIFICALLY excel at:
// 1. Explicit forecast requests (with "พยากรณ์"/"predict" keywords)
// 2. Student search by ID/name/major/GPA (structured lookups)
// Everything else → Gemini AI (smarter, context-aware answers)
function tryLocalResponse(question) {
    const q = question.toLowerCase();

    // 1. Explicit forecast requests ONLY when forecast keyword + known data topic
    const forecastParsed = parseForecastRequest(question);
    if (forecastParsed) {
        const result = generateForecastResponse(forecastParsed);
        if (result) return result;
        // If no datasets matched, fall through to AI
    }

    // 2. Student search — only for specific structured lookups (ID, name, GPA filter)
    const isStudentLookup =
        (q.match(/(?:รหัส|id)\s*\d{2,}/i)) ||  // search by ID
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
    // Try json_chart first, then fall back to json blocks that contain chartType
    let regex = /```json_chart\s*([\s\S]*?)\s*```/;
    let match = text.match(regex);

    // Fallback: detect ```json blocks that contain chart data (chartType + data)
    if (!match) {
        const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
        const jsonMatch = text.match(jsonRegex);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[1]);
                if (parsed.chartType && parsed.data) {
                    match = jsonMatch;
                    regex = jsonRegex;
                }
            } catch (_) { /* not valid chart JSON */ }
        }
    }

    // Last fallback: try to find raw JSON object with chartType (no code block)
    if (!match) {
        const rawJsonRegex = /(\{"chartType"[\s\S]*?"datasets"[\s\S]*?\})\s*(?:\})\s*$/;
        const rawMatch = text.match(rawJsonRegex);
        if (rawMatch) {
            try {
                // Try to find complete JSON by matching braces
                const startIdx = text.indexOf('{"chartType"');
                if (startIdx !== -1) {
                    let depth = 0;
                    let endIdx = startIdx;
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
                }
            } catch (_) { /* not valid */ }
        }
    }

    let chartConfig = null;
    let cleanText = text;

    if (match) {
        try {
            const rawJson = JSON.parse(match[1] || match[0]);
            // Remove the chart JSON from the display text
            cleanText = text.replace(match[0].includes('```') ? regex : match[0], '').trim();
            // Clean up any leftover empty code fences
            cleanText = cleanText.replace(/```\s*```/g, '').trim();

            const isRadar = rawJson.chartType === 'radar' || rawJson.chartType === 'polarArea';

            // Validate radar charts have minimum 3 axes
            if (isRadar && rawJson.data?.labels?.length < 3) {
                rawJson.chartType = 'bar';
            }

            // Apply neon theme to radar/polar charts
            if (isRadar && rawJson.data?.labels?.length >= 3) {
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

            // Ensure datasets have decent default colors if missing
            const defaultColors = ['#00a651', '#7B68EE', '#E91E63', '#C5A028', '#2E86AB', '#FF6B6B', '#006838', '#A23B72'];
            const isScatter = rawJson.chartType === 'scatter';
            const isBubble = rawJson.chartType === 'bubble';
            const isPointChart = isScatter || isBubble;

            if (rawJson.data?.datasets) {
                rawJson.data.datasets.forEach((ds, i) => {
                    if (!ds.borderColor && !ds.backgroundColor) {
                        const c = defaultColors[i % defaultColors.length];
                        ds.borderColor = c;
                        ds.backgroundColor = isPointChart ? c + '99' : c + '40';
                    }
                    // Ensure bar charts have borderRadius for modern look
                    if ((rawJson.chartType === 'bar') && !ds.borderRadius) {
                        ds.borderRadius = 6;
                    }
                    // Ensure scatter/bubble have visible point sizes
                    if (isPointChart && !ds.pointRadius) {
                        ds.pointRadius = isScatter ? 7 : undefined;
                        ds.pointHoverRadius = isScatter ? 10 : undefined;
                    }
                });
            }

            // Build default scales based on chart type
            let defaultScales;
            if (isRadar) {
                defaultScales = {
                    r: {
                        angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        pointLabels: { color: '#e5e7eb', font: { size: 11, weight: 'bold' } },
                        ticks: { display: false, min: 0, max: 100 }
                    }
                };
            } else if (rawJson.chartType === 'pie' || rawJson.chartType === 'doughnut') {
                defaultScales = {};
            } else if (isPointChart) {
                defaultScales = {
                    x: { type: 'linear', position: 'bottom', ticks: { color: '#9ca3af', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.05)' }, title: rawJson.options?.scales?.x?.title || { display: false } },
                    y: { ticks: { color: '#9ca3af', font: { size: 11 }, callback: (v) => v.toLocaleString() }, grid: { color: 'rgba(255,255,255,0.05)' }, title: rawJson.options?.scales?.y?.title || { display: false } }
                };
            } else {
                defaultScales = {
                    x: { ticks: { color: '#9ca3af', font: { size: 11 } }, grid: { display: false } },
                    y: { ticks: { color: '#9ca3af', font: { size: 11 }, callback: (v) => v.toLocaleString() }, grid: { color: 'rgba(255,255,255,0.05)' } }
                };
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
                    scales: defaultScales
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
    // Dashboard summary data for merge context
    const dashboardMergeSummary = (() => {
        const trendActual = studentStatsData.trend.filter(t => t.type === 'actual');
        const budgetActual = universityBudgetData.yearly.filter(y => y.type === 'actual');
        return {
            name: 'ข้อมูล Dashboard',
            headers: ['ปี', 'จำนวนนิสิต', 'งบรายรับ(ล้าน)', 'งบรายจ่าย(ล้าน)'],
            rows: trendActual.map(t => ({
                'ปี': t.year,
                'จำนวนนิสิต': t.total,
                'งบรายรับ(ล้าน)': budgetActual.find(b => b.year === t.year)?.revenue || 0,
                'งบรายจ่าย(ล้าน)': budgetActual.find(b => b.year === t.year)?.expense || 0,
            }))
        };
    })();
    const [messages, setMessages] = useState([
        {
            role: 'bot',
            text: 'สวัสดีครับ! ผม **MJU AI Assistant** (Powered by Gemini ✨)\n\nพร้อมช่วยตอบ **ทุกเรื่องเกี่ยวกับมหาวิทยาลัยแม่โจ้** ถามมาได้เลยครับ!\n\n🔮 **ฟีเจอร์ทั้งหมด:**\n• 💬 ถาม-ตอบทุกเรื่องแม่โจ้ (ประวัติ, คณะ, หลักสูตร, รับสมัคร, สถานที่, วิจัย)\n• 📊 สร้างกราฟจำนวนนักศึกษา, เกรด, งบประมาณ และพยากรณ์\n• 🔍 ค้นหานักศึกษาตามรหัส, ชื่อ, สาขา, GPA\n• 🎤 สั่งงานด้วยเสียง\n• 📎 **อัปโหลดไฟล์ CSV** เพื่อวิเคราะห์และสร้างกราฟ\n\nลองเลือก Quick Action ด้านล่าง หรือพิมพ์คำถามได้เลยครับ!',
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
                summaryText += `\n\n🔗 **รวมกับข้อมูล Dashboard ได้!** ลองถาม:`;
                summaryText += `\n• "เปรียบเทียบข้อมูลไฟล์กับจำนวนนิสิตในระบบ"`;
                summaryText += `\n• "รวมข้อมูลไฟล์กับงบประมาณเป็นกราฟ"`;
                summaryText += `\n• "สร้างกราฟเปรียบเทียบไฟล์กับข้อมูล Dashboard"`;
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
            // If user has uploaded file data, include it + dashboard summary in context for merging
            let contextMsg = userMsg;
            if (uploadedFileData) {
                const filePreview = uploadedFileData.rows.slice(0, 10).map(r => Object.values(r).join(', ')).join('\n');
                const dashPreview = dashboardMergeSummary.rows.map(r => Object.values(r).join(', ')).join('\n');
                contextMsg = `[บริบท: ผู้ใช้มีข้อมูลไฟล์ที่อัปโหลด คอลัมน์: ${uploadedFileData.headers.join(', ')} จำนวน ${uploadedFileData.rowCount} แถว ตัวอย่าง:\n${filePreview}\n\nข้อมูล Dashboard สำหรับเปรียบเทียบ (${dashboardMergeSummary.headers.join(', ')}):\n${dashPreview}\n\nสามารถรวมข้อมูลไฟล์กับข้อมูล Dashboard เพื่อสร้างกราฟเปรียบเทียบได้ ถ้าผู้ใช้ขอ]\n\nคำถาม: ${userMsg}`;
            }
            const aiText = await sendMessageToGemini(contextMsg);
            const parsedAI = parseAIResponse(aiText);
            setMessages(prev => [...prev, { role: 'bot', text: parsedAI.text, chart: parsedAI.chart }]);
        } catch (error) {
            console.error('[AIChatPage] Gemini API error:', error);
            const errMsg = error.message || 'ไม่ทราบสาเหตุ';
            const isQuota = errMsg.includes('รอ') || errMsg.includes('quota') || errMsg.includes('API ถูกใช้งาน');
            if (isQuota) {
                // Show countdown message and auto-retry after 60s
                const retryTime = Date.now() + 60000;
                const countdownMsgIdx = { current: null };
                setMessages(prev => {
                    countdownMsgIdx.current = prev.length;
                    return [...prev, {
                        role: 'bot',
                        text: `⏳ **API ถูกใช้งานบ่อยเกินไป — กำลังรอ 60 วินาที แล้วจะลองใหม่อัตโนมัติ...**\n\n🔄 กรุณารอสักครู่ ระบบจะลองส่งคำถามให้ใหม่เองค่ะ`,
                        chart: null
                    }];
                });
                // Auto-retry after cooldown
                setTimeout(async () => {
                    setTyping(true);
                    try {
                        let retryMsg = userMsg;
                        if (uploadedFileData) {
                            const filePreview = uploadedFileData.rows.slice(0, 10).map(r => Object.values(r).join(', ')).join('\n');
                            const dashPreview = dashboardMergeSummary.rows.map(r => Object.values(r).join(', ')).join('\n');
                            retryMsg = `[บริบท: ข้อมูลไฟล์ คอลัมน์: ${uploadedFileData.headers.join(', ')} ${uploadedFileData.rowCount} แถว ตัวอย่าง:\n${filePreview}\n\nDashboard (${dashboardMergeSummary.headers.join(', ')}):\n${dashPreview}]\n\nคำถาม: ${userMsg}`;
                        }
                        const aiText = await sendMessageToGemini(retryMsg);
                        const parsedAI = parseAIResponse(aiText);
                        setMessages(prev => {
                            const updated = [...prev];
                            // Replace countdown message with success
                            if (countdownMsgIdx.current !== null && updated[countdownMsgIdx.current]) {
                                updated[countdownMsgIdx.current] = { role: 'bot', text: `✅ _ลองใหม่สำเร็จแล้ว!_\n\n${parsedAI.text}`, chart: parsedAI.chart };
                            } else {
                                updated.push({ role: 'bot', text: parsedAI.text, chart: parsedAI.chart });
                            }
                            return updated;
                        });
                    } catch (retryErr) {
                        setMessages(prev => {
                            const updated = [...prev];
                            if (countdownMsgIdx.current !== null && updated[countdownMsgIdx.current]) {
                                updated[countdownMsgIdx.current] = { role: 'bot', text: `⏳ **ยังไม่สามารถเชื่อมต่อ AI ได้**\n\nกรุณารอ 1-2 นาทีแล้วลองถามใหม่อีกครั้งค่ะ 🙏\n\n💡 _ระหว่างรอ ลองใช้ Quick Actions เช่น พยากรณ์ข้อมูล หรือค้นหานักศึกษา ซึ่งทำงานได้โดยไม่ต้องใช้ AI_`, chart: null };
                            }
                            return updated;
                        });
                    } finally {
                        setTyping(false);
                    }
                }, 60000);
            } else {
                setMessages(prev => [...prev, {
                    role: 'bot',
                    text: `⚠️ ${errMsg}\n\n💡 ลองถามคำถามใหม่อีกครั้ง`,
                    chart: null
                }]);
            }
        } finally {
            setTyping(false);
        }
    };

    const handleKeyDown = (e) => { if (e.key === 'Enter') handleSend(); };

    const quickActions = [
        { label: '📊 กราฟนิสิตแยกคณะ', query: 'สร้างกราฟแท่งแสดงจำนวนนิสิตแยกตามคณะ พร้อมเรียงลำดับจากมากไปน้อย', icon: BarChart3 },
        { label: '📈 เปรียบเทียบ GPA ทุกคณะ', query: 'สร้างกราฟเปรียบเทียบ GPA เฉลี่ยและอัตราสำเร็จการศึกษาของทุกคณะ', icon: TrendingUp },
        { label: '👩‍🏫 บุคลากรคณะวิทย์', query: 'แสดงกราฟข้อมูลบุคลากรคณะวิทยาศาสตร์ ตำแหน่งวิชาการ วุฒิการศึกษา และพยากรณ์เกษียณ', icon: Search },
        { label: '💰 วิเคราะห์งบประมาณ', query: 'วิเคราะห์งบประมาณมหาวิทยาลัยแม่โจ้ ย้อนหลัง 4 ปี แสดงกราฟรายรับ-รายจ่าย พร้อมสรุปแนวโน้ม', icon: ChartLine },
        { label: '🎓 สถิติสำเร็จการศึกษา', query: 'แสดงกราฟแนวโน้มอัตราสำเร็จการศึกษาและ GPA เฉลี่ยคณะวิทยาศาสตร์ ย้อนหลัง 5 ปี', icon: Sparkles },
        { label: '🔮 พยากรณ์งบฯ คณะวิทย์', query: 'พยากรณ์งบประมาณคณะวิทยาศาสตร์ ปี 70 71 เป็นกราฟ', icon: ChartLine },
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
            console.error('[AIChatPage] Quick action error:', error);
            const errMsg = error.message || '';
            const isQuota = errMsg.includes('รอ') || errMsg.includes('quota') || errMsg.includes('API ถูกใช้งาน');
            setMessages(prev => [...prev, {
                role: 'bot',
                text: isQuota
                    ? `⏳ **API ถูกใช้งานบ่อยเกินไป**\n\nกรุณารอ 1 นาทีแล้วลองใหม่ค่ะ 🙏\n\n💡 _ระหว่างรอ ลองใช้ฟีเจอร์พยากรณ์หรือค้นหานักศึกษาที่ทำงานได้โดยไม่ต้องเชื่อมต่อ AI_`
                    : `⚠️ ${errMsg || 'ไม่สามารถเชื่อมต่อ AI ได้'}\n\n💡 ลองถามคำถามใหม่อีกครั้ง`,
                chart: null
            }]);
        } finally {
            setTyping(false);
        }
    };

    const featureCards = [
        { icon: Bot, title: 'ถาม-ตอบ AI', desc: 'ตอบทุกเรื่องแม่โจ้: ประวัติ, คณะ, หลักสูตร, รับสมัคร, วิจัย', color: '#00e676' },
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
                            <li>"สร้างกราฟจำนวนนักศึกษาและเกรด"</li>
                            <li>"แม่โจ้มีกี่คณะ แต่ละคณะมีสาขาอะไร"</li>
                            <li>"การรับสมัคร TCAS มีกี่รอบ"</li>
                            <li>"พยากรณ์งบประมาณคณะวิทย์ ปี 70 71"</li>
                            <li>"แสดงนักศึกษาสาขาคอม ชั้นปี 3"</li>
                            <li>"ค่าเทอมแม่โจ้เท่าไหร่"</li>
                            <li>"นักศึกษาที่มี GPA สูงสุด 10 คน"</li>
                            <li>"แม่โจ้อยู่ที่ไหน เดินทางยังไง"</li>
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
