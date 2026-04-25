import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, Send, BarChart3, BarChart2, TrendingUp, Maximize2, Mic, MicOff, X, Bot, Sparkles, Search, ChartLine, AudioLines, Zap, RotateCcw, Paperclip, FileSpreadsheet, History, Trash2, MessageSquarePlus, PieChart, Hexagon, CircleDot, ZoomIn, RotateCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
    createChatSession, updateChatSession, listUserSessions,
    loadChatSession, deleteChatSession,
} from '../services/chatHistoryService';
import { Chart as ReactChart } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
    Title, Tooltip, Legend, BarElement, Filler, ArcElement, RadialLinearScale,
    BarController, LineController, PieController, DoughnutController,
    RadarController, PolarAreaController, ScatterController, BubbleController,
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { themeAdaptorPlugin } from '../utils/chartTheme';
import { sendMessageToGemini, resetConversation, getWaitSeconds } from '../services/geminiService';
import { parseCSVContent, parseXLSXContent } from '../utils/fileParsers';
import {
    studentStatsData, universityBudgetData, scienceFacultyBudgetData,
    dashboardSummary,
} from '../data/mockData';
import { SCIENCE_MAJORS } from '../data/studentListData';
import { ensureStudentList, getStudentListSync, onStudentDataChange } from '../services/studentDataService';
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
        if (dataPoints.length < 3) { results.push(`${ds.label}: ข้อมูลไม่เพียงพอสำหรับการพยากรณ์`); continue; }

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
            borderColor: ds.color, backgroundColor: ds.color + '25',
            fill: parsed.chartType === 'line', tension: 0.4,
            pointBackgroundColor: ds.color, pointBorderColor: '#fff',
            pointBorderWidth: 2, pointRadius: 6, pointHoverRadius: 9,
            borderWidth: 2.5,
            borderRadius: parsed.chartType === 'bar' ? 8 : 0,
            yAxisID,
            // Premium shadow effect for bars
            ...(parsed.chartType === 'bar' ? { hoverBackgroundColor: ds.color + '90' } : {}),
        });
        allDatasets.push({
            label: `${ds.label} (พยากรณ์)`, data: forecastValues,
            borderColor: ds.color + 'bb', borderDash: [8, 4], backgroundColor: ds.color + '18',
            tension: 0.4, pointBackgroundColor: ds.color + 'cc', pointBorderColor: '#fff',
            pointBorderWidth: 2, pointRadius: 6, pointHoverRadius: 9,
            pointStyle: 'triangle', borderWidth: 2,
            borderRadius: parsed.chartType === 'bar' ? 8 : 0,
            yAxisID,
        });

        const forecastSummary = parsed.years.map(y => {
            const val = ds.yAxisID === 'y1' && ds.unit === '' 
                ? (model.slope * y + model.intercept).toFixed(2)
                : model.predict(y).toLocaleString();
            return `   ปี ${y}: ~${val} ${ds.unit}`;
        }).join('\n');
        results.push(`**${ds.label}**\nข้อมูลจริง: ${existingYears[0]}-${existingYears[existingYears.length - 1]} (${existingYears.length} ปี)\nพยากรณ์ (Linear Regression):\n${forecastSummary}`);
    }

    // Build scales config — support dual Y-axis
    const scalesConfig = {
        x: { ticks: { color: '#9ca3af', font: { size: 11, weight: '500' } }, grid: { display: false } },
        y: {
            ticks: { color: '#9ca3af', font: { size: 11 } },
            grid: { color: 'rgba(255,255,255,0.04)', lineWidth: 0.5 },
            title: needsDualAxis ? { display: true, text: 'จำนวน (คน)', color: '#9ca3af', font: { size: 11, weight: '600' } } : {},
        },
    };
    if (needsDualAxis) {
        scalesConfig.y1 = {
            position: 'right',
            ticks: { color: '#C5A028', font: { size: 11 } },
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'เกรดเฉลี่ย / %', color: '#C5A028', font: { size: 11, weight: '600' } },
        };
    }

    const chartConfig = allDatasets.length > 0 ? {
        chartType: parsed.chartType,
        data: { labels: allLabels, datasets: allDatasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            animation: { duration: 800, easing: 'easeOutQuart' },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#9ca3af', padding: 14, font: { size: 11, weight: '500' }, usePointStyle: true, pointStyleWidth: 10 }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 20, 35, 0.92)',
                    titleColor: '#fff',
                    bodyColor: '#e5e7eb',
                    borderColor: 'rgba(0, 230, 118, 0.2)',
                    borderWidth: 1,
                    cornerRadius: 10,
                    padding: 12,
                    titleFont: { weight: '700', size: 12 },
                    bodyFont: { size: 11 },
                    displayColors: true,
                    boxPadding: 4,
                    callbacks: {
                        label: (ctx) => {
                            const dsIdx = Math.floor(ctx.datasetIndex / 2);
                            const ds = DATASETS[parsed.datasets[dsIdx]] || DATASETS[parsed.datasets[0]];
                            return ` ${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString() || '-'} ${ds?.unit || ''}`;
                        }
                    }
                },
                zoom: {
                    pan: { enabled: true, mode: 'x', modifierKey: null },
                    zoom: {
                        wheel: { enabled: true, speed: 0.08 },
                        pinch: { enabled: true },
                        mode: 'x',
                    },
                    limits: { x: { minRange: 2 } },
                },
            },
            scales: scalesConfig,
        }
    } : null;

    return { text: results.join('\n\n') + '\n\n_หมายเหตุ: อ้างอิงจากข้อมูลในระบบเท่านั้น (Linear Regression)_', chart: chartConfig };
}

// ==================== Student Data (Real from MJU) ====================
const MAJORS = SCIENCE_MAJORS;
// Live-backed: resolves to Firestore-uploaded list when available, falls back to mock.
// Uploaded CSV/XLSX rows that look like student data are merged here.
let _uploadedStudentRows = [];

// Detection: does an uploaded file look like student data?
// We check for common column-name patterns.
const STUDENT_HEADER_HINTS = [
    'รหัสนักศึกษา', 'student_id', 'studentid', 'รหัส',
    'ชื่อ-นามสกุล', 'ชื่อ', 'name',
    'สาขาวิชา', 'สาขา', 'major',
    'เกรดเฉลี่ย', 'gpa', 'เกรด',
];

function isStudentFile(headers) {
    if (!Array.isArray(headers)) return false;
    const lc = headers.map(h => h.toLowerCase().trim());
    // Need at least 2 student-like columns to treat it as a student file
    let hits = 0;
    for (const hint of STUDENT_HEADER_HINTS) {
        if (lc.some(h => h.includes(hint.toLowerCase()))) hits++;
    }
    return hits >= 2;
}

// Normalize a raw CSV/XLSX row (keyed by original headers) to our standard schema.
function normalizeStudentRow(row, headers) {
    const lc = {};
    for (const h of headers) lc[h.toLowerCase().trim()] = h;

    const find = (...hints) => {
        for (const hint of hints) {
            const key = Object.keys(lc).find(k => k.includes(hint.toLowerCase()));
            if (key) return row[lc[key]];
        }
        return undefined;
    };

    const rawId = find('รหัสนักศึกษา', 'student_id', 'studentid', 'รหัส') || '';
    const prefix = find('คำนำหน้า', 'prefix') || '';
    const rawName = find('ชื่อ-นามสกุล', 'ชื่อ', 'name') || '';
    const major = find('สาขาวิชา', 'สาขา', 'major') || 'ไม่ระบุ';
    const level = find('ระดับการศึกษา', 'ระดับ', 'level') || 'ปริญญาตรี';
    const year = parseInt(find('ชั้นปี', 'year', 'ปี') || '1') || 1;
    const status = find('สถานะ', 'status') || 'กำลังศึกษา';
    const gpa = parseFloat(find('เกรดเฉลี่ย', 'gpa', 'เกรด') || '0') || 0;

    const id = String(rawId).trim();
    const name = prefix ? `${prefix}${rawName}` : rawName;

    if (!id && !rawName) return null; // skip empty rows

    return { id: id || `uploaded_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, prefix, name: name.trim(), major: major.trim(), level, year, status, gpa };
}

// Parse uploaded rows → normalized student array
function parseUploadedStudents(parsed) {
    if (!parsed || !isStudentFile(parsed.headers)) return [];
    const results = [];
    for (const row of parsed.rows) {
        const normalized = normalizeStudentRow(row, parsed.headers);
        if (normalized) results.push(normalized);
    }
    return results;
}

// Combined student list: mock/Firestore + any uploaded student rows (deduplicated by ID)
const getAllStudents = () => {
    const base = getStudentListSync();
    if (_uploadedStudentRows.length === 0) return base;
    // Merge: uploaded takes priority on duplicate IDs
    const idSet = new Set(_uploadedStudentRows.map(s => s.id));
    const filtered = base.filter(s => !idSet.has(s.id));
    return [...filtered, ..._uploadedStudentRows];
};

// ==================== Smart Student Search ====================
function searchStudents(query) {
    const ALL_STUDENTS = getAllStudents();
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
                    backgroundColor: 'rgba(34, 197, 94, 0.7)',
                    borderColor: '#22c55e',
                    borderWidth: 1,
                    borderRadius: 6,
                    order: 2,
                },
                {
                    type: 'line',
                    label: 'อัตราสำเร็จการศึกษา (%)',
                    data: gradRates,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.12)',
                    borderWidth: 2.5,
                    pointBackgroundColor: '#f59e0b',
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

    let text = `**Combo Chart: จำนวนนิสิต vs อัตราสำเร็จการศึกษา (แยกตามคณะ)**\n\n`;
    text += `**หมายเหตุ:** จำนวนนิสิตถูก Normalize เป็น Index (0-100) เพื่อให้เปรียบเทียบกับ % อัตราสำเร็จได้ในแกน Y เดียวกัน\n`;
    text += `โดยคณะที่มีนิสิตมากสุด = 100 (${faculties.reduce((a, b) => a.totalStudents > b.totalStudents ? a : b).name}: ${maxStudents.toLocaleString()} คน)\n\n`;

    text += `**จำนวนนิสิตจริง (ก่อน Normalize):**\n`;
    faculties.forEach(f => {
        const idx = normalizedStudents[faculties.indexOf(f)];
        text += `• ${f.name}: **${f.totalStudents.toLocaleString()}** คน (Index: ${idx}) | สำเร็จ: ${f.graduationRate}%\n`;
    });

    text += `\n**Insight:**\n`;
    const topGrad = [...faculties].sort((a, b) => b.graduationRate - a.graduationRate)[0];
    const lowGrad = [...faculties].sort((a, b) => a.graduationRate - b.graduationRate)[0];
    text += `• อัตราสำเร็จสูงสุด: ${topGrad.name} (${topGrad.graduationRate}%)\n`;
    text += `• อัตราสำเร็จต่ำสุด: ${lowGrad.name} (${lowGrad.graduationRate}%)\n`;
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
    // Accept 1-3 backticks on the fence — Gemini occasionally emits a single
    // backtick or markdown that renders as inline code instead of a block.
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
            } catch (_) { /* not valid chart JSON */ }
        }
    }

    // Last fallback: locate a raw `{"chartType":...}` anywhere in text by
    // brace-counting. Works even when the AI forgot the closing fence or
    // appended more prose (e.g. an Insight paragraph) after the JSON.
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
            } catch (_) { /* not valid */ }
        }
    }

    let chartConfig = null;
    let cleanText = text;

    if (match) {
        try {
            const rawJson = JSON.parse(match[1] || match[0]);
            // Remove the chart JSON from the display text
            cleanText = text.replace(match[0].includes('`') ? regex : match[0], '').trim();
            // Clean up leftover fence fragments (empty fences, stray json_chart label)
            cleanText = cleanText
                .replace(/`{1,3}\s*`{1,3}/g, '')
                .replace(/`{1,3}\s*json_chart\s*`{0,3}/g, '')
                .replace(/`{1,3}\s*json\s*`{0,3}/g, '')
                .trim();

            const isRadar = rawJson.chartType === 'radar' || rawJson.chartType === 'polarArea';

            // Validate radar charts have minimum 3 axes
            if (isRadar && rawJson.data?.labels?.length < 3) {
                rawJson.chartType = 'bar';
            }

            // Apply neon theme to radar/polar charts
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

            // Ensure datasets have decent default colors if missing
            const defaultColors = ['#7B68EE', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#a855f7', '#64748b'];
            const isScatter = rawJson.chartType === 'scatter';
            const isBubble = rawJson.chartType === 'bubble';
            const isPointChart = isScatter || isBubble;

            if (rawJson.data?.datasets) {
                rawJson.data.datasets.forEach((ds, i) => {
                    if (!ds.borderColor && !ds.backgroundColor) {
                        const c = defaultColors[i % defaultColors.length];
                        ds.borderColor = c;
                        ds.backgroundColor = isPointChart ? c + '99' : c + '25';
                    }
                    // Ensure bar charts have borderRadius for modern look
                    if ((rawJson.chartType === 'bar') && !ds.borderRadius) {
                        ds.borderRadius = 8;
                    }
                    // Ensure line charts have smooth tension and fill
                    if (rawJson.chartType === 'line') {
                        if (ds.tension == null) ds.tension = 0.4;
                        if (ds.pointRadius == null) ds.pointRadius = 5;
                        if (ds.pointHoverRadius == null) ds.pointHoverRadius = 8;
                        if (ds.pointBorderColor == null) ds.pointBorderColor = '#fff';
                        if (ds.pointBorderWidth == null) ds.pointBorderWidth = 2;
                        if (ds.borderWidth == null) ds.borderWidth = 2.5;
                        if (ds.fill == null) ds.fill = true;
                    }
                    // Bar enhancement
                    if (rawJson.chartType === 'bar') {
                        if (ds.borderWidth == null) ds.borderWidth = 0;
                        if (ds.hoverBackgroundColor == null && ds.backgroundColor) {
                            const baseColor = typeof ds.backgroundColor === 'string' ? ds.backgroundColor.slice(0, 7) : '';
                            if (baseColor) ds.hoverBackgroundColor = baseColor + 'cc';
                        }
                    }
                    // Ensure scatter/bubble have visible point sizes
                    if (isPointChart && !ds.pointRadius) {
                        ds.pointRadius = isScatter ? 7 : undefined;
                        ds.pointHoverRadius = isScatter ? 10 : undefined;
                    }
                    // Pie/doughnut enhancement
                    if ((rawJson.chartType === 'pie' || rawJson.chartType === 'doughnut') && Array.isArray(ds.backgroundColor)) {
                        ds.borderWidth = ds.borderWidth || 2;
                        ds.borderColor = ds.borderColor || 'rgba(15, 20, 35, 0.8)';
                        ds.hoverOffset = ds.hoverOffset || 8;
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

            // ── Validator: ensure category charts have proper labels ──
            // If labels are missing/empty/all-numeric, derive sensible ones from
            // datasets so users see real names instead of 1..N tick numbers.
            const isCategorical = !isPointChart && !['pie', 'doughnut'].includes(rawJson.chartType);
            if (isCategorical && rawJson.data) {
                const labels = rawJson.data.labels;
                const datasets = rawJson.data.datasets || [];
                const dataLen = datasets[0]?.data?.length || 0;
                const labelsBad = !Array.isArray(labels) || labels.length === 0
                    || labels.length !== dataLen
                    || labels.every(l => typeof l === 'number' || /^\d+$/.test(String(l)));

                if (labelsBad && dataLen > 0) {
                    // Try to recover names from a `categories` field, dataset names,
                    // or fall back to "หมวดที่ N" so the axis isn't numeric.
                    const recovered = rawJson.data.categories
                        || (datasets.length === 1 && Array.isArray(datasets[0].labels) ? datasets[0].labels : null)
                        || Array.from({ length: dataLen }, (_, i) => `หมวดที่ ${i + 1}`);
                    rawJson.data.labels = recovered;
                }

                // Dual-axis horizontal bars over many categories are unreadable
                // (the screenshot bug). Force vertical when we detect that combo.
                const hasDualAxis = datasets.some(ds => ds.yAxisID === 'y1' || ds.type === 'line');
                if (hasDualAxis && rawJson.options?.indexAxis === 'y' && dataLen > 6) {
                    if (rawJson.options) rawJson.options.indexAxis = undefined;
                }
            }

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
                    animation: { duration: 800, easing: 'easeOutQuart' },
                    indexAxis: rawJson.options?.indexAxis,
                    elements: isRadar ? { line: { tension: 0.1 } } : undefined,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: '#9ca3af', padding: 14, font: { size: 11, weight: '500' }, usePointStyle: true, pointStyleWidth: 10 }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(15, 20, 35, 0.92)',
                            titleColor: '#fff',
                            bodyColor: '#e5e7eb',
                            borderColor: 'rgba(0, 230, 118, 0.2)',
                            borderWidth: 1,
                            cornerRadius: 10,
                            padding: 12,
                            titleFont: { weight: '700', size: 12 },
                            bodyFont: { size: 11 },
                            displayColors: true,
                            boxPadding: 4,
                        },
                        zoom: {
                            pan: { enabled: true, mode: 'xy', modifierKey: null },
                            zoom: {
                                wheel: { enabled: true, speed: 0.08 },
                                pinch: { enabled: true },
                                mode: 'xy'
                            },
                            limits: { x: { minRange: 2 }, y: { minRange: 1 } },
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

    // Safety net: strip raw dataset dumps the model sometimes emits
    // (e.g. `[{"id":"...","n":"..."}, ...]`) after json_chart extraction.
    // json_chart blocks were already removed above, so anything left is unwanted.
    cleanText = stripRawDatasetDumps(cleanText);

    return { text: cleanText, chart: chartConfig };
}

// Remove raw JSON arrays-of-objects, ```json fenced data lists, and any
// stray json_chart blocks/labels the AI may emit unwrapped.
// Preserves normal prose and short inline code.
function stripRawDatasetDumps(text) {
    if (!text) return text;
    let out = text;

    // 1a. Strip any fenced ```json_chart``` / ```json``` / ```jsonl``` block.
    out = out.replace(/`{3}json[_a-z]*\s*[\s\S]*?`{3}/gi, '');
    // 1b. Strip JSON-array-of-objects fenced blocks (any language tag).
    out = out.replace(/`{3}[a-z]*\s*\[\s*\{[\s\S]*?\}\s*\]\s*`{3}/gi, '');

    // 2. Strip BARE chart configs (no backticks): the model sometimes emits
    //    `json_chart\n{ "chartType": ... }` without a fence. Detect the keyword
    //    and balance-count braces forward to remove the entire object.
    out = stripBareChartConfigs(out);

    // 3. Strip any standalone {"chartType":...} object even without a label —
    //    these never belong in user-visible prose.
    out = stripStandaloneChartObjects(out);

    // 4. Strip orphan `json_chart` / `json` labels left behind, with or
    //    without surrounding backticks/whitespace.
    out = out.replace(/`{0,3}\s*json_chart\s*`{0,3}/gi, '');
    out = out.replace(/`{1,3}\s*json[l]?\s*`{1,3}/gi, '');

    // 5. Drop bare JSON arrays-of-objects (dataset dumps).
    const stripped = [];
    let i = 0;
    while (i < out.length) {
        const ch = out[i];
        if (ch === '[') {
            const end = findBalancedArrayEnd(out, i);
            if (end > i) {
                const candidate = out.slice(i, end);
                if (looksLikeDatasetDump(candidate)) {
                    i = end;
                    continue;
                }
            }
        }
        stripped.push(ch);
        i++;
    }
    out = stripped.join('');

    // 6. Collapse leftover empty lines and trim.
    out = out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    return out;
}

// Find `json_chart` / `json` keywords (with or without backticks) followed
// by `{` and remove the keyword + the balanced `{...}` that follows.
function stripBareChartConfigs(text) {
    const re = /`{0,3}\s*json(?:_chart)?\s*`{0,3}\s*\n?\s*\{/gi;
    let out = text;
    let match;
    // Iterate via a cursor since out length changes on each removal.
    while ((match = re.exec(out)) !== null) {
        const braceStart = match.index + match[0].length - 1; // points at `{`
        const end = findBalancedObjectEnd(out, braceStart);
        if (end <= braceStart) break;
        // Try to validate it looks like a chart config before removing.
        const slice = out.slice(braceStart, end);
        const looksLikeChart = /["']?chartType["']?\s*:/i.test(slice)
            || /["']?datasets["']?\s*:/i.test(slice);
        if (!looksLikeChart) {
            re.lastIndex = end;
            continue;
        }
        out = out.slice(0, match.index) + out.slice(end);
        re.lastIndex = match.index;
    }
    return out;
}

// Strip standalone `{"chartType": ...}` JSON objects that have no label,
// catching any leftover after the primary parser missed them.
function stripStandaloneChartObjects(text) {
    let out = text;
    let idx = out.indexOf('{"chartType"');
    while (idx !== -1) {
        const end = findBalancedObjectEnd(out, idx);
        if (end <= idx) break;
        out = out.slice(0, idx) + out.slice(end);
        idx = out.indexOf('{"chartType"');
    }
    // Also handle the spaced variant `{ "chartType"`.
    idx = out.search(/\{\s*"chartType"/);
    while (idx !== -1) {
        const end = findBalancedObjectEnd(out, idx);
        if (end <= idx) break;
        out = out.slice(0, idx) + out.slice(end);
        idx = out.search(/\{\s*"chartType"/);
    }
    return out;
}

function findBalancedObjectEnd(s, start) {
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < s.length; i++) {
        const c = s[i];
        if (esc) { esc = false; continue; }
        if (c === '\\') { esc = true; continue; }
        if (c === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) return i + 1; }
    }
    // Best-effort: even if JSON is malformed/unbalanced (truncated by AI),
    // assume the rest of the buffer is the broken config and drop it.
    return depth > 0 ? s.length : -1;
}

function findBalancedArrayEnd(s, start) {
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < s.length; i++) {
        const c = s[i];
        if (esc) { esc = false; continue; }
        if (c === '\\') { esc = true; continue; }
        if (c === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (c === '[') depth++;
        else if (c === ']') { depth--; if (depth === 0) return i + 1; }
    }
    return -1;
}

function looksLikeDatasetDump(s) {
    if (s.length < 40) return false;
    try {
        const parsed = JSON.parse(s);
        if (!Array.isArray(parsed)) return false;
        if (parsed.length === 0) return false;
        // Array of objects with common dataset keys → dump
        const first = parsed[0];
        if (first && typeof first === 'object' && !Array.isArray(first)) {
            const keys = Object.keys(first);
            if (keys.length >= 2) return true;
        }
        // Long flat array of primitives (> 10 items) → likely data dump too
        if (parsed.length > 10 && parsed.every(x => typeof x !== 'object')) return true;
        return false;
    } catch (_) {
        return false;
    }
}

// `hbar` is a UI-only sentinel meaning "bar with indexAxis='y'". It maps
// back to chartType='bar' when handed to Chart.js.
const PALETTE = ['#00a651', '#7B68EE', '#E91E63', '#C5A028', '#2E86AB', '#F18F01', '#06b6d4', '#a855f7', '#22c55e', '#f97316', '#ef4444', '#14b8a6', '#A23B72', '#0ea5e9', '#84cc16', '#ec4899', '#8b5cf6', '#fb923c'];

function realChartType(uiType) {
    return uiType === 'hbar' ? 'bar' : uiType;
}

// Re-derive chart data/options when the user toggles chart type.
// Without this, leftover `indexAxis:'y'`, per-dataset `type` fields, and
// y1 axis references from the original config make the switcher a no-op.
function deriveChartConfig(originalChart, uiTargetType) {
    if (!originalChart) return originalChart;
    const targetType = realChartType(uiTargetType);
    const wantsHorizontal = uiTargetType === 'hbar';
    const sourceWasHorizontal = originalChart.chartType === 'bar' && originalChart.options?.indexAxis === 'y';
    const sameShape = targetType === originalChart.chartType
        && wantsHorizontal === sourceWasHorizontal;
    if (sameShape) return originalChart;

    // Deep-clone via JSON (safe — no functions in chart data after parse).
    const data = JSON.parse(JSON.stringify(originalChart.data || {}));
    const options = JSON.parse(JSON.stringify(originalChart.options || {}));

    // Strip per-dataset `type` so all datasets inherit the parent type.
    if (Array.isArray(data.datasets)) {
        data.datasets.forEach((ds, idx) => {
            delete ds.type;
            // y1 axis is for dual-axis bar+line; collapse to default y when
            // switching to a homogeneous chart.
            if (ds.yAxisID === 'y1') delete ds.yAxisID;

            if (targetType === 'line') {
                delete ds.borderRadius;
                if (ds.tension == null) ds.tension = 0.4;
                if (ds.pointRadius == null) ds.pointRadius = 4;
                if (typeof ds.backgroundColor === 'string' && ds.backgroundColor.length === 9) {
                    ds.backgroundColor = ds.backgroundColor.slice(0, 7) + '33';
                }
            } else if (targetType === 'bar') {
                if (ds.borderRadius == null) ds.borderRadius = 6;
                // For horizontal bar, single color reads better than rainbow.
                if (wantsHorizontal && !Array.isArray(ds.backgroundColor)) {
                    ds.backgroundColor = ds.backgroundColor || PALETTE[idx % PALETTE.length];
                }
            } else if (targetType === 'pie' || targetType === 'doughnut' || targetType === 'polarArea') {
                // Pie/doughnut need an array of slice colors and no border radius.
                const n = ds.data?.length || 0;
                if (!Array.isArray(ds.backgroundColor)) {
                    ds.backgroundColor = Array.from({ length: n }, (_, i) => PALETTE[i % PALETTE.length]);
                }
                ds.borderColor = '#ffffff';
                ds.borderWidth = 2;
                delete ds.borderRadius;
                delete ds.tension;
            } else if (targetType === 'radar') {
                ds.borderColor = ds.borderColor || PALETTE[idx % PALETTE.length];
                ds.backgroundColor = (ds.borderColor || PALETTE[idx % PALETTE.length]) + '33';
                ds.pointBackgroundColor = ds.borderColor || PALETTE[idx % PALETTE.length];
                ds.pointBorderColor = '#fff';
                ds.borderWidth = 2;
                ds.pointRadius = 4;
                delete ds.borderRadius;
            }
        });
    }

    // For pie/doughnut, only the first dataset is meaningful; keep it alone
    // so legend doesn't overflow with stacked series labels.
    if ((targetType === 'pie' || targetType === 'doughnut') && data.datasets?.length > 1) {
        data.datasets = [data.datasets[0]];
    }

    // Axis tweaks per type.
    if (targetType === 'line' || targetType === 'bar') {
        options.indexAxis = wantsHorizontal ? 'y' : undefined;
    } else {
        delete options.indexAxis;
    }

    // Remove the right-hand y1 scale since dual-axis is gone.
    if (options.scales && options.scales.y1) {
        delete options.scales.y1;
        if (options.scales.y?.grid) options.scales.y.grid.drawOnChartArea = true;
    }

    // Pie/doughnut/radar don't use cartesian scales.
    if (targetType === 'pie' || targetType === 'doughnut') {
        options.scales = {};
    } else if (targetType === 'radar') {
        options.scales = {
            r: {
                angleLines: { color: 'rgba(127,127,127,0.18)' },
                grid: { color: 'rgba(127,127,127,0.18)' },
                pointLabels: { color: '#9ca3af', font: { size: 11, weight: 'bold' } },
                ticks: { display: false, beginAtZero: true }
            }
        };
    }

    return { ...originalChart, chartType: targetType, data, options };
}

// Compute a chart container height that scales with category count for
// horizontal bars and a sane fixed height for everything else. Without
// this, 18-faculty horizontal charts cram labels into ~14px each.
function computeChartHeight(uiType, categoryCount = 0) {
    if (uiType === 'hbar') {
        // ~28px per row + headroom for axis/legend.
        return Math.min(900, Math.max(320, categoryCount * 28 + 110));
    }
    if (uiType === 'pie' || uiType === 'doughnut' || uiType === 'radar') {
        return 380;
    }
    return 320;
}

// Pick the toggleable chart options that make sense for the data shape.
function availableChartTypes(chart) {
    if (!chart) return [];
    const dsCount = chart.data?.datasets?.length || 0;
    const catCount = chart.data?.labels?.length || chart.data?.datasets?.[0]?.data?.length || 0;
    const isPoint = chart.chartType === 'scatter' || chart.chartType === 'bubble';
    if (isPoint) return []; // scatter/bubble don't switch sensibly

    const opts = [
        { id: 'line', label: 'เส้น', icon: TrendingUp },
        { id: 'bar', label: 'แท่ง', icon: BarChart3 },
        { id: 'hbar', label: 'แท่งแนวนอน', icon: BarChart2 },
    ];
    if (dsCount === 1 && catCount > 0 && catCount <= 10) {
        opts.push({ id: 'pie', label: 'พาย', icon: PieChart });
        opts.push({ id: 'doughnut', label: 'โดนัท', icon: CircleDot });
    }
    if (catCount >= 3 && catCount <= 12) {
        opts.push({ id: 'radar', label: 'เรดาร์', icon: Hexagon });
    }
    return opts;
}

// ==================== Deep Clone Helper ====================
function deepCloneChart(chart) {
    if (!chart) return null;
    try {
        const cloned = JSON.parse(JSON.stringify(chart));
        // Restore any function-based callbacks that JSON.stringify lost
        // (tooltip callbacks etc. — we use static config so this is safe)
        return cloned;
    } catch {
        return { ...chart };
    }
}

// ==================== Chat Message Component ====================
function ChatMessage({ msg, onExpand }) {
    // UI chart type — uses 'hbar' as a virtual horizontal-bar value.
    const initialUiType = msg.chart?.chartType === 'bar' && msg.chart?.options?.indexAxis === 'y'
        ? 'hbar'
        : (msg.chart?.chartType || 'line');
    const [chartType, setChartType] = useState(initialUiType);
    const renderedChart = deriveChartConfig(msg.chart, chartType);
    const renderType = realChartType(chartType);
    const switchOptions = availableChartTypes(msg.chart);
    const categoryCount = renderedChart?.data?.labels?.length
        || renderedChart?.data?.datasets?.[0]?.data?.length
        || 0;
    const wrapperHeight = computeChartHeight(chartType, categoryCount);
    const chartRef = useRef(null);

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
                    return <em key={j} style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>{part.slice(1, -1)}</em>;
                }
                if (part.startsWith('`') && part.endsWith('`')) {
                    return <code key={j} style={{ background: 'rgba(0,230,118,0.15)', color: '#00e676', padding: '2px 6px', borderRadius: 4, fontSize: '0.88em' }}>{part.slice(1, -1)}</code>;
                }
                return part;
            });
            return <div key={i}>{parts}</div>;
        });
    };

    const chartData = renderedChart;

    // Deep clone chart for expand to prevent zoom state mutation
    const handleExpand = () => {
        const cloned = deepCloneChart(chartData);
        if (cloned) onExpand(cloned);
    };

    return (
        <div className="ai-page-msg ai-page-msg-bot">
            <div className="ai-page-msg-avatar"><Sparkles size={18} style={{ color: '#00e676' }} /></div>
            <div className="ai-page-msg-content">
                <div className="ai-page-msg-bubble bot">{formatText(msg.text)}</div>

                {chartData && (
                    <div className="ai-page-chart-container">
                        <div className="ai-page-chart-toolbar">
                            <div className="ai-page-chart-type-row">
                                {switchOptions.map(opt => {
                                    const Icon = opt.icon;
                                    return (
                                        <button
                                            key={opt.id}
                                            className={`ai-page-chart-btn ${chartType === opt.id ? 'active' : ''}`}
                                            onClick={() => setChartType(opt.id)}
                                            title={opt.label}
                                        >
                                            <Icon size={13} /> {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                className="ai-page-chart-btn ai-page-chart-expand-btn"
                                onClick={handleExpand}
                                style={{ marginLeft: 'auto' }}
                            >
                                <Maximize2 size={13} /> ขยาย
                            </button>
                        </div>
                        <div className="ai-page-chart-wrapper" style={{ height: wrapperHeight }}>
                            <ReactChart
                                ref={chartRef}
                                type={renderType}
                                data={chartData.data}
                                options={chartData.options}
                                redraw={false}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}


// ==================== Main AIChatPage Component ====================
function generateChartFromFile(parsed, fileName) {
    if (!parsed || parsed.numericCols.length === 0) return null;

    const colors = ['#7B68EE', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#a855f7', '#64748b'];
    const labels = parsed.rows.map(r => String(r[parsed.labelCol] ?? ''));
    const toNum = v => parseFloat(String(v).replace(/,/g, '')) || 0;
    const datasets = parsed.numericCols.slice(0, 6).map((col, i) => ({
        label: col,
        data: parsed.rows.map(r => toNum(r[col])),
        borderColor: colors[i % colors.length],
        backgroundColor: colors[i % colors.length] + '40',
        fill: false,
        tension: 0.4,
        pointRadius: 4,
        borderWidth: 2,
        borderRadius: 6,
    }));

    // Decide time-series vs category: labels look like years → line, otherwise bar.
    const looksLikeYear = labels.every(l => /^\d{4}$/.test(l) || /^25\d{2}$/.test(l));
    // Long Thai labels or many categories → horizontal bar for readability.
    const avgLen = labels.reduce((a, l) => a + l.length, 0) / Math.max(1, labels.length);
    const useHorizontal = !looksLikeYear && (avgLen > 8 || labels.length > 10);
    const chartType = looksLikeYear ? 'line' : 'bar';

    return {
        chartType,
        data: { labels, datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            indexAxis: useHorizontal ? 'y' : 'x',
            plugins: {
                legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 8, font: { size: 11 } } },
                title: { display: true, text: `📁 ${fileName}`, color: '#fff', font: { size: 14 } },
            },
            scales: {
                x: { ticks: { color: '#9ca3af', maxRotation: useHorizontal ? 0 : 45 }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true },
            },
        },
    };
}

export default function AIChatPage() {
    const { user } = useAuth();
    const [expandedChart, setExpandedChart] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);
    const fileInputRef = useRef(null);
    const [uploadedFileData, setUploadedFileData] = useState(null);
    // Chat history state
    const [historyOpen, setHistoryOpen] = useState(false);
    const [sessions, setSessions] = useState([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const sessionIdRef = useRef(null);
    const saveTimerRef = useRef(null);
    const lastSavedRef = useRef(null);
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
            text: 'สวัสดีครับ ผม **MJU AI Assistant** (Powered by Gemini)\n\nพร้อมช่วยตอบ **ทุกเรื่องเกี่ยวกับมหาวิทยาลัยแม่โจ้** ถามมาได้เลยครับ\n\n**ฟีเจอร์ทั้งหมด:**\n• ถาม-ตอบทุกเรื่องแม่โจ้ (ประวัติ, คณะ, หลักสูตร, รับสมัคร, สถานที่, วิจัย)\n• สร้างกราฟจำนวนนักศึกษา, เกรด, งบประมาณ และพยากรณ์\n• ค้นหานักศึกษาตามรหัส, ชื่อ, สาขา, GPA\n• สั่งงานด้วยเสียง\n• **อัปโหลดไฟล์ CSV / Excel (.xlsx)** เพื่อวิเคราะห์และสร้างกราฟ\n\nเลือก Quick Action ด้านล่าง หรือพิมพ์คำถามได้เลยครับ',
            chart: null
        }
    ]);
    const [input, setInput] = useState('');
    const [typing, setTyping] = useState(false);
    const messagesEnd = useRef(null);

    // ── Ensure the live student dataset is loaded before the user can chat ──
    // Layout already calls this on mount, but if the user lands directly on
    // /dashboard/ai-chat we trigger it here too so the very first AI request
    // sees real Firestore data instead of the mock fallback.
    useEffect(() => {
        ensureStudentList();
        return onStudentDataChange(() => {});
    }, []);

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
        // Clear uploaded data so next conversation starts fresh
        _uploadedStudentRows = [];
        setUploadedFileData(null);
        // Drop session pointer so the next first user message creates a new doc.
        sessionIdRef.current = null;
        lastSavedRef.current = null;
        if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
        setMessages([{
            role: 'bot',
            text: '**เริ่มบทสนทนาใหม่แล้ว**\n\nถามมาได้เลยครับ พร้อมช่วยเสมอ',
            chart: null
        }]);
    }, []);

    // ── Chat History: auto-save on message changes ──
    // Skip if not signed in with a real Firebase uid (admin-bypass uids start
    // with 'admin-bypass-' and don't have Firestore permission).
    const canPersist = !!user?.uid && !user.uid.startsWith('admin-bypass-');

    useEffect(() => {
        if (!canPersist) return;
        // Only persist after the user has actually said something.
        const hasUserMsg = messages.some(m => m.role === 'user');
        if (!hasUserMsg) return;
        // Cheap dedupe — avoid writing identical snapshots.
        const sig = messages.length + ':' + (messages[messages.length - 1]?.text || '').slice(0, 80);
        if (sig === lastSavedRef.current) return;

        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
            try {
                if (sessionIdRef.current) {
                    await updateChatSession(sessionIdRef.current, messages);
                } else {
                    const id = await createChatSession({
                        uid: user.uid,
                        email: user.email,
                        messages,
                    });
                    sessionIdRef.current = id;
                }
                lastSavedRef.current = sig;
            } catch (err) {
                console.warn('[chatHistory] save failed:', err?.message || err);
            }
        }, 1200); // debounce 1.2s — covers typing/streaming bursts

        return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    }, [messages, canPersist, user?.uid, user?.email]);

    const refreshSessions = useCallback(async () => {
        if (!canPersist) return;
        setSessionsLoading(true);
        try {
            const list = await listUserSessions(user.uid, 50);
            setSessions(list);
        } catch (err) {
            console.warn('[chatHistory] list failed:', err?.message || err);
        } finally {
            setSessionsLoading(false);
        }
    }, [canPersist, user?.uid]);

    const openHistory = useCallback(() => {
        setHistoryOpen(true);
        refreshSessions();
    }, [refreshSessions]);

    const handleLoadSession = useCallback(async (sessionId) => {
        try {
            const session = await loadChatSession(sessionId);
            if (!session) return;
            // Replace current conversation with the loaded one.
            // Reset Gemini's in-memory turn history so it starts fresh on next send.
            resetConversation();
            sessionIdRef.current = session.id;
            lastSavedRef.current = null;
            setMessages(session.messages.length > 0 ? session.messages : [{
                role: 'bot', text: 'แชทเดิมว่างเปล่า — เริ่มถามใหม่ได้เลย', chart: null
            }]);
            setHistoryOpen(false);
        } catch (err) {
            console.warn('[chatHistory] load failed:', err?.message || err);
        }
    }, []);

    const handleDeleteSession = useCallback(async (sessionId, e) => {
        e?.stopPropagation();
        if (!confirm('ลบประวัติแชทนี้ถาวร?')) return;
        try {
            await deleteChatSession(sessionId);
            // If user deletes the active session, drop the pointer.
            if (sessionIdRef.current === sessionId) {
                sessionIdRef.current = null;
                lastSavedRef.current = null;
            }
            setSessions(prev => prev.filter(s => s.id !== sessionId));
        } catch (err) {
            console.warn('[chatHistory] delete failed:', err?.message || err);
        }
    }, []);

    // ── File Upload Handler ──
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        const fileName = file.name;
        const ext = fileName.split('.').pop().toLowerCase();

        if (!['csv', 'txt', 'tsv', 'xlsx', 'xls'].includes(ext)) {
            setMessages(prev => [...prev, {
                role: 'bot',
                text: `**รองรับเฉพาะไฟล์ CSV, TSV, TXT, XLSX, XLS**\n\nไฟล์ "${fileName}" ไม่รองรับ`,
                chart: null
            }]);
            return;
        }

        setMessages(prev => [...prev, { role: 'user', text: `อัปโหลดไฟล์: **${fileName}**` }]);
        setTyping(true);

        try {
            const parsed = (ext === 'xlsx' || ext === 'xls')
                ? parseXLSXContent(await file.arrayBuffer())
                : parseCSVContent(await file.text());

            if (!parsed || parsed.rows.length === 0) {
                setMessages(prev => [...prev, {
                    role: 'bot',
                    text: `ไม่สามารถอ่านข้อมูลจากไฟล์ "${fileName}" ได้\n\nตรวจสอบว่าไฟล์มีหัวคอลัมน์ (header row) และข้อมูลอย่างน้อย 1 แถว`,
                    chart: null
                }]);
                return;
            }

            setUploadedFileData(parsed);

            // ── Detect and merge student data ──
            const uploadedStudents = parseUploadedStudents(parsed);
            if (uploadedStudents.length > 0) {
                _uploadedStudentRows = uploadedStudents;
            }

            const chart = generateChartFromFile(parsed, fileName);

            // Build summary text
            let summaryText = `**วิเคราะห์ไฟล์: ${fileName}**\n\n`;
            summaryText += `**ข้อมูล:** ${parsed.rowCount} แถว × ${parsed.headers.length} คอลัมน์\n`;
            summaryText += `**คอลัมน์:** ${parsed.headers.join(', ')}\n`;
            summaryText += `**คอลัมน์ตัวเลข:** ${parsed.numericCols.join(', ') || 'ไม่พบ'}\n\n`;

            // Notify about student data merge
            if (uploadedStudents.length > 0) {
                const allNow = getAllStudents();
                summaryText += `**ตรวจพบข้อมูลนักศึกษา ${uploadedStudents.length} คน** — รวมกับข้อมูลระบบแล้ว\n`;
                summaryText += `**รวมนักศึกษาทั้งหมดในระบบ:** ${allNow.length} คน\n\n`;
                summaryText += `**ลองถาม:**\n`;
                summaryText += `• "แสดงรายชื่อนักศึกษาสาขาคอม"\n`;
                summaryText += `• "สร้างกราฟจำนวนนักศึกษาแต่ละสาขา"\n`;
                summaryText += `• "นักศึกษาที่มี GPA สูงสุด 10 คน"\n`;
                summaryText += `• "เปรียบเทียบ GPA แต่ละสาขา"\n`;
            } else {
                // Show sample data for non-student files
                summaryText += `**ตัวอย่างข้อมูล (5 แถวแรก):**\n`;
                parsed.rows.slice(0, 5).forEach((row, i) => {
                    summaryText += `${i + 1}. ${parsed.headers.map(h => `${h}: ${row[h]}`).join(' | ')}\n`;
                });

                if (parsed.numericCols.length > 0) {
                    summaryText += `\n**สร้างกราฟจากข้อมูลให้แล้ว**`;
                    summaryText += `\n\n**รวมกับข้อมูล Dashboard ได้** ลองถาม:`;
                    summaryText += `\n• "เปรียบเทียบข้อมูลไฟล์กับจำนวนนิสิตในระบบ"`;
                    summaryText += `\n• "รวมข้อมูลไฟล์กับงบประมาณเป็นกราฟ"`;
                    summaryText += `\n• "สร้างกราฟเปรียบเทียบไฟล์กับข้อมูล Dashboard"`;
                } else {
                    summaryText += `\nไม่พบคอลัมน์ตัวเลข จึงไม่สามารถสร้างกราฟอัตโนมัติได้`;
                }
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
                    text: `**AI วิเคราะห์เพิ่มเติม:**\n\n${parsedAI.text}`,
                    chart: parsedAI.chart
                }]);
            } catch (err) {
                console.log('AI analysis skipped:', err.message);
            }

        } catch (err) {
            setMessages(prev => [...prev, {
                role: 'bot',
                text: `อ่านไฟล์ล้มเหลว: ${err.message}`,
                chart: null
            }]);
        } finally {
            setTyping(false);
        }
    };

    // Robust auto-retry with live countdown for quota errors
    const retryWithCountdown = async (buildMessage, retryId) => {
        const MAX_RETRIES = 3;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            let waitSec = Math.max(getWaitSeconds(), 5) + 2;
            // Live countdown
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
                        ? { role: 'bot', text: `_ลองใหม่สำเร็จ_\n\n${parsedAI.text}`, chart: parsedAI.chart }
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
            // Try local response first (forecast, student search)
            const localResult = tryLocalResponse(userMsg);
            if (localResult) {
                setMessages(prev => [...prev, { role: 'bot', text: localResult.text, chart: localResult.chart }]);
                setTyping(false);
                return;
            }
            const buildMsg = () => {
                // Always include student data summary for student-related questions
                const allStudents = getAllStudents();
                const qLower = userMsg.toLowerCase();
                const isStudentQ = /นักศึกษา|นิสิต|gpa|เกรด|สาขา|ชั้นปี|รายชื่อ|จำนวนนักศึกษา|student/.test(qLower);

                let context = '';

                if (isStudentQ && allStudents.length > 0) {
                    // Build a compact student stats summary for Gemini
                    const byMajor = {};
                    const byYear = {};
                    allStudents.forEach(s => {
                        byMajor[s.major] = byMajor[s.major] || { count: 0, gpas: [] };
                        byMajor[s.major].count++;
                        byMajor[s.major].gpas.push(s.gpa);
                        const yKey = `ชั้นปี ${s.year}`;
                        byYear[yKey] = (byYear[yKey] || 0) + 1;
                    });
                    const majorStats = Object.entries(byMajor).map(([m, v]) => {
                        const avg = (v.gpas.reduce((a, b) => a + b, 0) / v.gpas.length).toFixed(2);
                        return `${m}: ${v.count} คน, GPA เฉลี่ย ${avg}`;
                    }).join('\n');
                    const yearStats = Object.entries(byYear).map(([y, c]) => `${y}: ${c} คน`).join(', ');

                    context += `[บริบทนักศึกษา: ข้อมูลรวม ${allStudents.length} คน (ข้อมูลระบบ + ข้อมูลที่อัปโหลด)\n`;
                    context += `สรุปตามสาขา:\n${majorStats}\n`;
                    context += `สรุปตามชั้นปี: ${yearStats}\n`;
                    // Include sample rows for AI to reference
                    const sample = allStudents.slice(0, 15).map(s => `${s.id},${s.name},${s.major},ปี ${s.year},GPA ${s.gpa},${s.status}`).join('\n');
                    context += `ตัวอย่างข้อมูล (15 คนแรก):\n${sample}]\n\n`;
                }

                if (uploadedFileData && !isStudentFile(uploadedFileData.headers)) {
                    // Non-student uploaded file
                    const filePreview = uploadedFileData.rows.slice(0, 10).map(r => Object.values(r).join(', ')).join('\n');
                    const dashPreview = dashboardMergeSummary.rows.map(r => Object.values(r).join(', ')).join('\n');
                    context += `[บริบท: ผู้ใช้มีข้อมูลไฟล์ที่อัปโหลด คอลัมน์: ${uploadedFileData.headers.join(', ')} จำนวน ${uploadedFileData.rowCount} แถว ตัวอย่าง:\n${filePreview}\n\nข้อมูล Dashboard สำหรับเปรียบเทียบ (${dashboardMergeSummary.headers.join(', ')}):\n${dashPreview}\n\nสามารถรวมข้อมูลไฟล์กับข้อมูล Dashboard เพื่อสร้างกราฟเปรียบเทียบได้ ถ้าผู้ใช้ขอ]\n\n`;
                }

                return context ? `${context}คำถาม: ${userMsg}` : userMsg;
            };
            const aiText = await sendMessageToGemini(buildMsg());
            const parsedAI = parseAIResponse(aiText);
            setMessages(prev => [...prev, { role: 'bot', text: parsedAI.text, chart: parsedAI.chart }]);
        } catch (error) {
            console.error('[AIChatPage] Gemini API error:', error);
            const errMsg = error.message || 'ไม่ทราบสาเหตุ';
            const isQuota = /รอ|quota|API ถูกใช้งาน|QUOTA/.test(errMsg);
            if (isQuota) {
                const retryId = `retry_${Date.now()}`;
                setMessages(prev => [...prev, {
                    role: 'bot', text: '**API ถูกใช้งานบ่อยเกินไป** — กำลังเตรียมลองใหม่...', chart: null, _retryId: retryId
                }]);
                const buildMsg = () => {
                    // Reuse the same enriched context builder as handleSend
                    const allStudents = getAllStudents();
                    const qLower = userMsg.toLowerCase();
                    const isStudentQ = /นักศึกษา|นิสิต|gpa|เกรด|สาขา|ชั้นปี|รายชื่อ|จำนวนนักศึกษา|student/.test(qLower);
                    let context = '';
                    if (isStudentQ && allStudents.length > 0) {
                        const byMajor = {};
                        allStudents.forEach(s => {
                            byMajor[s.major] = byMajor[s.major] || { count: 0, gpas: [] };
                            byMajor[s.major].count++;
                            byMajor[s.major].gpas.push(s.gpa);
                        });
                        const majorStats = Object.entries(byMajor).map(([m, v]) => {
                            const avg = (v.gpas.reduce((a, b) => a + b, 0) / v.gpas.length).toFixed(2);
                            return `${m}: ${v.count} คน, GPA เฉลี่ย ${avg}`;
                        }).join('\n');
                        context += `[บริบทนักศึกษาทั้งหมด ${allStudents.length} คน:\n${majorStats}]\n\n`;
                    }
                    if (uploadedFileData && !isStudentFile(uploadedFileData.headers)) {
                        const filePreview = uploadedFileData.rows.slice(0, 10).map(r => Object.values(r).join(', ')).join('\n');
                        const dashPreview = dashboardMergeSummary.rows.map(r => Object.values(r).join(', ')).join('\n');
                        context += `[บริบท: ข้อมูลไฟล์ คอลัมน์: ${uploadedFileData.headers.join(', ')} ${uploadedFileData.rowCount} แถว ตัวอย่าง:\n${filePreview}\n\nDashboard (${dashboardMergeSummary.headers.join(', ')}):\n${dashPreview}]\n\n`;
                    }
                    return context ? `${context}คำถาม: ${userMsg}` : userMsg;
                };
                await retryWithCountdown(buildMsg, retryId);
            } else {
                setMessages(prev => [...prev, {
                    role: 'bot',
                    text: `${errMsg}\n\nลองถามคำถามใหม่อีกครั้ง`,
                    chart: null
                }]);
            }
        } finally {
            setTyping(false);
        }
    };

    const handleKeyDown = (e) => { if (e.key === 'Enter') handleSend(); };

    const quickActions = [
        { label: 'กราฟนิสิตแยกคณะ', query: 'สร้างกราฟแท่งแสดงจำนวนนิสิตแยกตามคณะ พร้อมเรียงลำดับจากมากไปน้อย', icon: BarChart3 },
        { label: 'เปรียบเทียบ GPA ทุกคณะ', query: 'สร้างกราฟเปรียบเทียบ GPA เฉลี่ยและอัตราสำเร็จการศึกษาของทุกคณะ', icon: TrendingUp },
        { label: 'บุคลากรคณะวิทย์', query: 'แสดงกราฟข้อมูลบุคลากรคณะวิทยาศาสตร์ ตำแหน่งวิชาการ วุฒิการศึกษา และพยากรณ์เกษียณ', icon: Search },
        { label: 'วิเคราะห์งบประมาณ', query: 'วิเคราะห์งบประมาณมหาวิทยาลัยแม่โจ้ ย้อนหลัง 4 ปี แสดงกราฟรายรับ-รายจ่าย พร้อมสรุปแนวโน้ม', icon: ChartLine },
        { label: 'สถิติสำเร็จการศึกษา', query: 'แสดงกราฟแนวโน้มอัตราสำเร็จการศึกษาและ GPA เฉลี่ยคณะวิทยาศาสตร์ ย้อนหลัง 5 ปี', icon: Sparkles },
        { label: 'พยากรณ์งบฯ คณะวิทย์', query: 'พยากรณ์งบประมาณคณะวิทยาศาสตร์ ปี 70 71 เป็นกราฟ', icon: ChartLine },
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
            const isQuota = /รอ|quota|API ถูกใช้งาน|QUOTA/.test(errMsg);
            if (isQuota) {
                const retryId = `retry_${Date.now()}`;
                setMessages(prev => [...prev, {
                    role: 'bot', text: '**API ถูกใช้งานบ่อยเกินไป** — กำลังเตรียมลองใหม่...', chart: null, _retryId: retryId
                }]);
                await retryWithCountdown(() => query, retryId);
            } else {
                setMessages(prev => [...prev, {
                    role: 'bot',
                    text: `${errMsg || 'ไม่สามารถเชื่อมต่อ AI ได้'}\n\nลองถามคำถามใหม่อีกครั้ง`,
                    chart: null
                }]);
            }
        } finally {
            setTyping(false);
        }
    };

    const featureCards = [
        { icon: Bot, title: 'ถาม-ตอบ AI', desc: 'ตอบทุกเรื่องแม่โจ้: ประวัติ, คณะ, หลักสูตร, รับสมัคร, วิจัย', color: '#10b981', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
        { icon: ChartLine, title: 'พยากรณ์ข้อมูล', desc: 'สร้างกราฟพยากรณ์งบประมาณ/จำนวนนิสิต', color: '#06b6d4', gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' },
        { icon: Search, title: 'ค้นหานักศึกษา', desc: 'ค้นหาตามรหัส, ชื่อ, สาขา, ชั้นปี, GPA', color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' },
        { icon: Paperclip, title: 'อัปโหลดไฟล์', desc: 'แนบ CSV/Excel (.xlsx) เพื่อวิเคราะห์และสร้างกราฟอัตโนมัติ', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
        { icon: AudioLines, title: 'สั่งงานด้วยเสียง', desc: 'กดปุ่มไมค์แล้วพูดคำสั่งเป็นภาษาไทย', color: '#ec4899', gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)' },
        { icon: Maximize2, title: 'ขยาย/ซูมกราฟ', desc: 'คลิก "ขยาย" เพื่อดูกราฟเต็มจอพร้อมซูม', color: '#f43f5e', gradient: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)' },
    ];

    return (
        <div className="ai-chat-page">
            {/* Header */}
            <div className="ai-chat-page-header">
                <div className="ai-chat-page-header-left">
                    <div className="ai-chat-page-header-icon">
                        <Sparkles size={22} />
                    </div>
                    <div>
                        <h1>MJU AI Assistant</h1>
                        <p>Powered by Gemini — ระบบ AI อัจฉริยะสำหรับคณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้</p>
                    </div>
                </div>
                <div className="ai-chat-page-header-actions">
                    {canPersist && (
                        <button
                            className="ai-chat-page-history-btn"
                            onClick={openHistory}
                            title="ประวัติการสนทนา"
                        >
                            <History size={15} /> ประวัติ
                        </button>
                    )}
                    <button className="ai-chat-page-new-chat" onClick={handleNewChat}>
                        <RotateCcw size={15} /> เริ่มใหม่
                    </button>
                </div>
            </div>

            {/* Chat History Drawer */}
            {historyOpen && (
                <div className="chat-history-overlay" onClick={() => setHistoryOpen(false)}>
                    <aside className="chat-history-drawer" onClick={(e) => e.stopPropagation()}>
                        <div className="chat-history-header">
                            <div className="chat-history-title">
                                <History size={18} />
                                <span>ประวัติการสนทนา</span>
                            </div>
                            <button
                                className="chat-history-close"
                                onClick={() => setHistoryOpen(false)}
                                aria-label="ปิด"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="chat-history-body">
                            <button
                                className="chat-history-new-btn"
                                onClick={() => { handleNewChat(); setHistoryOpen(false); }}
                            >
                                <MessageSquarePlus size={15} /> เริ่มแชทใหม่
                            </button>

                            {sessionsLoading ? (
                                <div className="chat-history-empty">กำลังโหลด…</div>
                            ) : sessions.length === 0 ? (
                                <div className="chat-history-empty">
                                    ยังไม่มีประวัติแชท<br />
                                    <small>ส่งข้อความครั้งแรกเพื่อเริ่มบันทึก</small>
                                </div>
                            ) : (
                                <ul className="chat-history-list">
                                    {sessions.map(s => {
                                        const active = s.id === sessionIdRef.current;
                                        const ts = s.updatedAt ? s.updatedAt.toLocaleString('th-TH', {
                                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                        }) : '';
                                        return (
                                            <li
                                                key={s.id}
                                                className={`chat-history-item ${active ? 'active' : ''}`}
                                                onClick={() => handleLoadSession(s.id)}
                                            >
                                                <div className="chat-history-item-main">
                                                    <div className="chat-history-item-title">{s.title}</div>
                                                    <div className="chat-history-item-meta">
                                                        {ts} · {s.messageCount} ข้อความ
                                                    </div>
                                                </div>
                                                <button
                                                    className="chat-history-item-del"
                                                    onClick={(e) => handleDeleteSession(s.id, e)}
                                                    title="ลบ"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </aside>
                </div>
            )}

            <div className="ai-chat-page-body">
                {/* Main Chat Area */}
                <div className="ai-chat-page-main">
                    {/* Quick Actions Bar */}
                    {messages.length <= 2 && (
                        <div className="ai-chat-page-quick-actions">
                            <div className="ai-chat-page-quick-label">
                                <Zap size={13} /> QUICK ACTIONS — คลิกเพื่อลองใช้งาน
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
                                <div className="ai-page-msg-avatar"><Sparkles size={18} style={{ color: '#00e676' }} /></div>
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', marginBottom: 6, borderRadius: '8px', background: 'rgba(0,166,81,0.12)', border: '1px solid rgba(0,166,81,0.25)', fontSize: '0.85rem', color: '#00a651' }}>
                                <FileSpreadsheet size={14} />
                                <span>ไฟล์ที่โหลด: {uploadedFileData.rowCount} แถว × {uploadedFileData.headers.length} คอลัมน์ — ถามคำถามเกี่ยวกับข้อมูลนี้ได้เลย</span>
                                <button onClick={() => setUploadedFileData(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}><X size={14} /></button>
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
                                title="อัปโหลดไฟล์ CSV/Excel เพื่อวิเคราะห์"
                                style={{ color: '#C5A028' }}
                            >
                                <Paperclip size={20} />
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept=".csv,.tsv,.txt,.xlsx,.xls"
                                style={{ display: 'none' }}
                            />
                            <input
                                type="text"
                                placeholder={isListening ? "กำลังฟัง..." : "พิมพ์คำถามที่นี่... หรือแนบไฟล์ CSV/Excel เพื่อวิเคราะห์"}
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
                            กด Enter เพื่อส่ง • แนบไฟล์ CSV/TSV/Excel • สั่งด้วยเสียง • AI อาจตอบผิดพลาดได้
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
                                    <div className="ai-chat-page-feature-icon" style={{ background: card.color + '18', color: card.color, boxShadow: `0 2px 8px ${card.color}15` }}>
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
                        <h4>ตัวอย่างคำถาม</h4>
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
                <ExpandedChartModal
                    chart={expandedChart}
                    onClose={() => setExpandedChart(null)}
                />
            )}
        </div>
    );
}

// ==================== Expanded Chart Modal Component ====================
function ExpandedChartModal({ chart, onClose }) {
    const chartRef = useRef(null);
    const [modalKey, setModalKey] = useState(0);

    // UI chart type — uses 'hbar' as a virtual horizontal-bar value.
    const initialUiType = chart?.chartType === 'bar' && chart?.options?.indexAxis === 'y'
        ? 'hbar'
        : (chart?.chartType || 'line');
    const [chartType, setChartType] = useState(initialUiType);
    const renderedChart = deriveChartConfig(chart, chartType);
    const renderType = realChartType(chartType);
    const switchOptions = availableChartTypes(chart);

    // Reset zoom handler
    const handleResetZoom = () => {
        if (chartRef.current) {
            chartRef.current.resetZoom();
        }
    };

    // Force re-render with fresh data on chart type change
    const handleChartTypeChange = (newType) => {
        setChartType(newType);
        setModalKey(prev => prev + 1);
    };

    // Enhanced options for expanded view — larger fonts, better grid
    const expandedOptions = renderedChart ? {
        ...renderedChart.options,
        animation: { duration: 600, easing: 'easeOutQuart' },
        plugins: {
            ...(renderedChart.options?.plugins || {}),
            legend: {
                position: 'bottom',
                labels: {
                    color: '#9ca3af',
                    padding: 18,
                    font: { size: 12, weight: '500' },
                    usePointStyle: true,
                    pointStyleWidth: 12,
                }
            },
            tooltip: {
                backgroundColor: 'rgba(15, 20, 35, 0.95)',
                titleColor: '#fff',
                bodyColor: '#e5e7eb',
                borderColor: 'rgba(0, 230, 118, 0.25)',
                borderWidth: 1,
                cornerRadius: 12,
                padding: 14,
                titleFont: { weight: '700', size: 13 },
                bodyFont: { size: 12 },
                displayColors: true,
                boxPadding: 6,
                ...(renderedChart.options?.plugins?.tooltip || {}),
            },
            zoom: {
                pan: { enabled: true, mode: 'xy', modifierKey: null },
                zoom: {
                    wheel: { enabled: true, speed: 0.06 },
                    pinch: { enabled: true },
                    drag: { enabled: false },
                    mode: 'xy',
                },
                limits: { x: { minRange: 2 }, y: { minRange: 1 } },
            },
        },
    } : {};

    return (
        <div className="ai-page-chart-modal-overlay" onClick={onClose}>
            <div className="ai-page-chart-modal" onClick={e => e.stopPropagation()}>
                <div className="ai-page-chart-modal-header">
                    <h3><ZoomIn size={20} style={{ color: '#00e676' }} /> กราฟขยาย</h3>
                    <div className="ai-page-chart-modal-actions">
                        <button
                            className="ai-page-chart-modal-reset"
                            onClick={handleResetZoom}
                            title="รีเซ็ตการซูม"
                        >
                            <RotateCw size={15} /> รีเซ็ตซูม
                        </button>
                        <button className="ai-page-chart-modal-close" onClick={onClose}>
                            <X size={22} />
                        </button>
                    </div>
                </div>

                {/* Chart type switcher in modal */}
                {switchOptions.length > 0 && (
                    <div className="ai-page-chart-modal-toolbar">
                        {switchOptions.map(opt => {
                            const Icon = opt.icon;
                            return (
                                <button
                                    key={opt.id}
                                    className={`ai-page-chart-btn ${chartType === opt.id ? 'active' : ''}`}
                                    onClick={() => handleChartTypeChange(opt.id)}
                                    title={opt.label}
                                >
                                    <Icon size={14} /> {opt.label}
                                </button>
                            );
                        })}
                    </div>
                )}

                <div className="ai-page-chart-modal-body">
                    {renderedChart && (
                        <ReactChart
                            key={modalKey}
                            ref={chartRef}
                            type={renderType}
                            data={renderedChart.data}
                            options={expandedOptions}
                            redraw
                        />
                    )}
                </div>
                <div className="ai-page-chart-modal-hint">
                    Scroll เพื่อซูม
                    <span className="ai-page-chart-modal-hint-sep">•</span>
                    คลิกค้างเพื่อเลื่อน
                    <span className="ai-page-chart-modal-hint-sep">•</span>
                    กดปุ่มรีเซ็ตเพื่อกลับเริ่มต้น
                </div>
            </div>
        </div>
    );
}
