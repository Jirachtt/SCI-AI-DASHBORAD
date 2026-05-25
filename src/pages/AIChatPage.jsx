/* eslint-disable react-refresh/only-export-components */
import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, Send, BarChart3, BarChart2, TrendingUp, Maximize2, Mic, MicOff, X, Bot, Sparkles, Search, ChartLine, AudioLines, Zap, RotateCcw, Paperclip, FileSpreadsheet, History, Trash2, MessageSquarePlus, PieChart, Hexagon, CircleDot, ZoomIn, RotateCw, Database, ShieldCheck, Clock3, Gauge, Layers3, GraduationCap, Copy, CornerDownRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
    createChatSession, updateChatSession, listUserSessions,
    loadChatSession, deleteChatSession, deleteAllUserSessions,
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
import {
    sendMessageToGemini, resetConversation, getWaitSeconds,
    getAIModelRuntimeStatus,
    getAIModelSettings,
    getAITokenBudgetSnapshot,
    refreshAITokenBudgetSnapshot,
} from '../services/geminiService';
import { getRoleTermCoverage } from '../utils/roleValidity';
import { parseCSVContent, parseXLSXContent } from '../utils/fileParsers';
import { SCIENCE_MAJORS } from '../data/studentListData';
import { ensureStudentList, getStudentListSync, getStudentRosterTrustStatus, isLiveData, onStudentDataChange } from '../services/studentDataService';
import { appendStudentAnswerSourceNote, buildDataAccuracyContextForAI, getStudentReconciliationSnapshot } from '../services/dataAccuracyService';
import { buildLiveDashboardMergeSummary, getForecastDataSourceNote, getForecastSeries } from '../services/forecastDataService';
import { exportChartAsCSVReport } from '../utils/exportUtils';
import { AI_ASSISTANT_NAME, APP_NAME_EN, APP_NAME_TH } from '../config/appBrand';
import { tryInstantAnswer } from '../services/aiInstantAnswerService';
import { createPlannedChartAnswer } from '../services/aiChartPlanner';
import {
    buildAIAccessDeniedResult,
    canAIUseAction,
    canAIUseAllInternalSections,
    canAIUseInternalSection,
} from '../utils/aiAccessPolicy';
import { isExecutiveRecommendationIntent } from '../utils/aiAdvicePolicy';
import {
    coerceStructuredAIResponseMarkdown,
    stripRawStructuredAIResponseText,
} from '../utils/aiChartResponse';
import { buildMjuConnectedContextForAI } from '../services/mjuConnectedDataService';
import { legacyColorToVar, themeAlpha } from '../utils/themeTokens';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, RadialLinearScale, Title, Tooltip, Legend, BarElement, Filler, ArcElement, BarController, LineController, PieController, DoughnutController, RadarController, PolarAreaController, ScatterController, BubbleController, zoomPlugin, themeAdaptorPlugin);

const AI_CHART_TOOLTIP_STYLE = {
    backgroundColor: 'var(--chart-tooltip-bg)',
    titleColor: 'var(--chart-text)',
    bodyColor: 'var(--chart-muted)',
    borderColor: 'color-mix(in srgb, var(--accent-purple) 28%, transparent)',
    borderWidth: 1,
    cornerRadius: 12,
    padding: 12,
    caretPadding: 8,
    displayColors: true,
    boxPadding: 5,
};

const AI_THINKING_STEPS = [
    'เลือกโมเดลและสิทธิ์ข้อมูล',
    'อ่านบริบทที่เกี่ยวข้อง',
    'ตรวจแหล่งข้อมูลและตัวเลข',
    'จัดรูปคำตอบและกราฟ',
];

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
        getData: () => getForecastSeries('universityBudgetRevenue'),
        color: 'var(--accent-success)', keywords: ['รายรับ', 'revenue'],
        scopeKeywords: ['มหาวิทยาลัย', 'มจ', 'mju', 'ทั้งหมด']
    },
    universityBudgetExpense: {
        label: 'รายจ่ายมหาวิทยาลัย', unit: 'ล้านบาท', scope: 'มหาวิทยาลัย',
        getData: () => getForecastSeries('universityBudgetExpense'),
        color: 'var(--accent-pink)', keywords: ['รายจ่าย', 'expense', 'ค่าใช้จ่าย'],
        scopeKeywords: ['มหาวิทยาลัย', 'มจ', 'mju', 'ทั้งหมด']
    },
    universityBudget: {
        label: 'งบประมาณมหาวิทยาลัย (รายรับ)', unit: 'ล้านบาท', scope: 'มหาวิทยาลัย',
        getData: () => getForecastSeries('universityBudget'),
        color: 'var(--accent-success)', keywords: ['งบประมาณ', 'budget', 'งบ'],
        scopeKeywords: ['มหาวิทยาลัย', 'มจ', 'mju', 'ทั้งหมด']
    },
    scienceBudgetRevenue: {
        label: 'รายรับคณะวิทยาศาสตร์', unit: 'ล้านบาท', scope: 'คณะวิทยาศาสตร์',
        getData: () => getForecastSeries('scienceBudgetRevenue'),
        color: 'var(--accent-success-deep)', keywords: ['รายรับ', 'revenue', 'งบประมาณ', 'budget', 'งบ'],
        scopeKeywords: ['คณะวิทยาศาสตร์', 'วิทยาศาสตร์', 'science', 'คณะวิทย์']
    },
    scienceBudgetExpense: {
        label: 'รายจ่ายคณะวิทยาศาสตร์', unit: 'ล้านบาท', scope: 'คณะวิทยาศาสตร์',
        getData: () => getForecastSeries('scienceBudgetExpense'),
        color: 'var(--accent-pink)', keywords: ['รายจ่าย', 'expense', 'ค่าใช้จ่าย'],
        scopeKeywords: ['คณะวิทยาศาสตร์', 'วิทยาศาสตร์', 'science', 'คณะวิทย์']
    },
    universityStudents: {
        label: 'จำนวนนักศึกษาในระบบ', unit: 'คน', scope: 'ข้อมูลนักศึกษาในเว็บ',
        getData: () => getForecastSeries('universityStudents'),
        color: 'var(--accent-purple)', keywords: ['นิสิต', 'นักศึกษา', 'student', 'จำนวนนิสิต', 'จำนวนนักศึกษา'],
        scopeKeywords: ['มหาวิทยาลัย', 'มจ', 'mju', 'ทั้งหมด'],
        yAxisID: 'y',
    },
    scienceStudents: {
        label: 'จำนวนนิสิตคณะวิทยาศาสตร์', unit: 'คน', scope: 'คณะวิทยาศาสตร์',
        getData: () => getForecastSeries('scienceStudents'),
        color: 'var(--accent-success-deep)', keywords: ['นิสิต', 'นักศึกษา', 'student', 'จำนวนนิสิต', 'จำนวนนักศึกษา'],
        scopeKeywords: ['คณะวิทยาศาสตร์', 'วิทยาศาสตร์', 'science', 'คณะวิทย์'],
        yAxisID: 'y',
    },
    // ==================== GPA Datasets ====================
    scienceGPA: {
        label: 'เกรดเฉลี่ย (GPA) คณะวิทยาศาสตร์', unit: '', scope: 'คณะวิทยาศาสตร์',
        getData: () => getForecastSeries('scienceGPA'),
        color: 'var(--accent-gold)', keywords: ['เกรด', 'gpa', 'เกรดเฉลี่ย', 'ผลการเรียน', 'grade'],
        scopeKeywords: ['คณะวิทยาศาสตร์', 'วิทยาศาสตร์', 'science', 'คณะวิทย์', 'มหาวิทยาลัย', 'มจ', 'mju', 'ทั้งหมด'],
        yAxisID: 'y1',
    },
    scienceGraduationRate: {
        label: 'อัตราสำเร็จการศึกษา คณะวิทยาศาสตร์', unit: '%', scope: 'คณะวิทยาศาสตร์',
        getData: () => getForecastSeries('scienceGraduationRate'),
        color: 'var(--accent-pink)', keywords: ['อัตราสำเร็จ', 'สำเร็จการศึกษา', 'graduation', 'จบการศึกษา', 'อัตราจบ'],
        scopeKeywords: ['คณะวิทยาศาสตร์', 'วิทยาศาสตร์', 'science', 'คณะวิทย์', 'มหาวิทยาลัย', 'มจ', 'mju', 'ทั้งหมด'],
        yAxisID: 'y1',
    },
    scienceGraduated: {
        label: 'จำนวนผู้สำเร็จการศึกษา คณะวิทยาศาสตร์', unit: 'คน', scope: 'คณะวิทยาศาสตร์',
        getData: () => getForecastSeries('scienceGraduated'),
        color: 'var(--accent-info)', keywords: ['ผู้สำเร็จ', 'จบ', 'graduated', 'สำเร็จการศึกษา', 'จำนวนผู้สำเร็จ'],
        scopeKeywords: ['คณะวิทยาศาสตร์', 'วิทยาศาสตร์', 'science', 'คณะวิทย์', 'มหาวิทยาลัย', 'มจ', 'mju', 'ทั้งหมด'],
        yAxisID: 'y',
    },
};

const FORECAST_DATASET_SECTIONS = {
    universityBudgetRevenue: ['budget_forecast'],
    universityBudgetExpense: ['budget_forecast'],
    universityBudget: ['budget_forecast'],
    scienceBudgetRevenue: ['budget_forecast'],
    scienceBudgetExpense: ['budget_forecast'],
    universityStudents: ['student_stats'],
    scienceStudents: ['student_stats'],
    scienceGPA: ['student_stats'],
    scienceGraduationRate: ['graduation_stats'],
    scienceGraduated: ['graduation_stats'],
};

const BUDGET_FORECAST_KEYWORDS = [
    'งบประมาณ', 'งบ', 'รายรับ', 'รายจ่าย', 'การเงิน', 'ค่าเทอม',
    'budget', 'finance', 'revenue', 'expense',
];

function hasBudgetForecastSignal(text = '') {
    const q = String(text || '').toLowerCase();
    return BUDGET_FORECAST_KEYWORDS.some(keyword => q.includes(keyword));
}

function getForecastRequiredSections(parsed) {
    const datasets = Array.isArray(parsed?.datasets) ? parsed.datasets : [];
    return [...new Set(datasets.flatMap(key => FORECAST_DATASET_SECTIONS[key] || ['dashboard']))];
}

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

    const hasBudget = hasBudgetForecastSignal(q);
    const hasRevenue = ['รายรับ', 'revenue', 'income'].some(k => q.includes(k));
    const hasExpense = ['รายจ่าย', 'expense', 'ค่าใช้จ่าย', 'cost'].some(k => q.includes(k));
    // Budget/finance wins before GPA/course/student because "คณะวิทย์" can otherwise
    // pull course contexts into finance questions.
    if (hasBudget) {
        if (isScience) {
            matchedDatasets = hasRevenue && !hasExpense
                ? ['scienceBudgetRevenue']
                : hasExpense && !hasRevenue
                    ? ['scienceBudgetExpense']
                    : ['scienceBudgetRevenue', 'scienceBudgetExpense'];
        } else {
            matchedDatasets = hasRevenue && !hasExpense
                ? ['universityBudgetRevenue']
                : hasExpense && !hasRevenue
                    ? ['universityBudgetExpense']
                    : ['universityBudgetRevenue', 'universityBudgetExpense'];
        }
        return { years: years.sort(), chartType, datasets: [...new Set(matchedDatasets)], isScience };
    }

    // Check for GPA / grade keywords
    const hasGPA = ['เกรด', 'gpa', 'เกรดเฉลี่ย', 'ผลการเรียน', 'grade'].some(k => q.includes(k));
    // Check for student keywords
    const hasStudent = ['นิสิต', 'นักศึกษา', 'student', 'จำนวนนิสิต'].some(k => q.includes(k));
    // Check for graduation keywords
    const hasGraduation = ['สำเร็จการศึกษา', 'อัตราสำเร็จ', 'จบการศึกษา', 'graduation', 'เรียนจบ'].some(k => q.includes(k));

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

function isBudgetDatasetKey(dsKey = '') {
    return /Budget|Revenue|Expense/i.test(String(dsKey || ''));
}

function formatForecastValue(value, unit = '') {
    const number = Number(value);
    if (!Number.isFinite(number)) return '-';
    const digits = /ล้าน|บาท|%/.test(unit) ? 2 : (Math.abs(number) < 10 && unit !== 'คน' ? 2 : 0);
    return `${number.toLocaleString('th-TH', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    })}${unit ? ` ${unit}` : ''}`;
}

function buildBudgetScenarioForecast(dsKey, ds, dataPoints = [], targetYears = [], model = null) {
    const cleanPoints = [...dataPoints]
        .filter(point => Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)))
        .sort((a, b) => Number(a.x) - Number(b.x));
    if (!cleanPoints.length) return '';

    const latest = cleanPoints[cleanPoints.length - 1];
    const latestYear = Number(latest.x);
    const latestValue = Number(latest.y);
    const isExpense = /Expense/i.test(dsKey) || /รายจ่าย|expense/i.test(ds?.label || '');

    const rows = [...new Set(targetYears)]
        .filter(year => Number(year) > latestYear)
        .map(year => {
            const gap = Math.max(1, Number(year) - latestYear);
            const baseline = model ? Number(model.predict(Number(year))) : latestValue;
            const conservative = isExpense
                ? baseline * Math.pow(1.03, gap)
                : baseline * Math.pow(0.98, gap);
            const growth = isExpense
                ? baseline * Math.pow(1.01, gap)
                : baseline * Math.pow(1.03, gap);
            return {
                year,
                conservative: Math.max(0, Math.round(conservative)),
                baseline: Math.max(0, Math.round(baseline)),
                growth: Math.max(0, Math.round(growth)),
            };
        });

    if (!rows.length) return '';

    const scenarioLines = rows.map(row =>
        `ปี ${row.year}: Conservative ~${formatForecastValue(row.conservative, ds.unit)}, Baseline ~${formatForecastValue(row.baseline, ds.unit)}, Growth ~${formatForecastValue(row.growth, ds.unit)}`
    ).join('\n');

    const confidence = cleanPoints.length >= 4 ? 'กลาง' : cleanPoints.length >= 2 ? 'ต่ำ-กลาง' : 'ต่ำ';
    const confidenceReason = cleanPoints.length >= 4
        ? 'มีข้อมูลย้อนหลังหลายปีพอเห็นทิศทาง แต่ยังต้องยืนยันด้วยงบที่อนุมัติจริง'
        : 'มีจุดข้อมูลจำกัด จึงใช้ฉากทัศน์จากค่าล่าสุดและสมมติฐานแบบระมัดระวัง';

    return [
        `\n**Scenario forecast สำหรับ ${ds.label}**`,
        scenarioLines,
        `**วิธีคิด/สมมติฐาน:** Baseline ใช้แนวโน้มจากข้อมูลล่าสุด${model ? 'ด้วย Linear Regression' : ''}; Conservative = ${isExpense ? 'รายจ่ายสูงกว่า baseline 3% ต่อปี' : 'รายรับต่ำกว่า baseline 2% ต่อปี'}; Growth = ${isExpense ? 'คุมรายจ่ายให้สูงกว่า baseline เพียง 1% ต่อปี' : 'รายรับสูงกว่า baseline 3% ต่อปี'}`,
        `**ระดับความเชื่อมั่น:** ${confidence} — ${confidenceReason}`,
        '**ข้อมูลที่ควรมีเพิ่มเพื่อยืนยัน:** งบอนุมัติจริงปีเป้าหมาย, จำนวนนักศึกษา/ค่าเทอมล่าสุด, เงินอุดหนุน, รายจ่ายบุคลากร และภาระผูกพันโครงการ',
    ].join('\n');
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
        if (dataPoints.length < 3) {
            if (isBudgetDatasetKey(dsKey)) {
                const scenario = buildBudgetScenarioForecast(dsKey, ds, dataPoints, parsed.years);
                results.push(`**${ds.label}**\nแหล่งข้อมูล: ${getForecastDataSourceNote(dsKey)}\nยังไม่มีข้อมูลปีเป้าหมายโดยตรง และข้อมูลย้อนหลังยังไม่พอสำหรับ Linear Regression เต็มรูปแบบ แต่สามารถทำประมาณการแบบ scenario จากข้อมูลล่าสุดได้ดังนี้:\n${scenario}`);
            } else {
                results.push(`**${ds.label}**\nแหล่งข้อมูล: ${getForecastDataSourceNote(dsKey)}\nยังไม่สามารถพยากรณ์ได้ เพราะข้อมูลที่เว็บมีอยู่ตอนนี้ต้องมีอย่างน้อย 3 จุดข้อมูลสำหรับ Linear Regression`);
            }
            continue;
        }

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
        const accentColor = legacyColorToVar(ds.color);

        allDatasets.push({
            label: `${ds.label} (ข้อมูลจริง)`, data: actualValues,
            borderColor: accentColor, backgroundColor: themeAlpha(ds.color, 15),
            fill: parsed.chartType === 'line', tension: 0.4,
            pointBackgroundColor: accentColor, pointBorderColor: 'var(--text-on-accent)',
            pointBorderWidth: 2, pointRadius: 6, pointHoverRadius: 9,
            borderWidth: 2.5,
            borderRadius: parsed.chartType === 'bar' ? 8 : 0,
            yAxisID,
            // Premium shadow effect for bars
            ...(parsed.chartType === 'bar' ? { hoverBackgroundColor: themeAlpha(ds.color, 56) } : {}),
        });
        allDatasets.push({
            label: `${ds.label} (พยากรณ์)`, data: forecastValues,
            borderColor: accentColor, borderDash: [8, 4], backgroundColor: themeAlpha(ds.color, 9),
            tension: 0.4, pointBackgroundColor: accentColor, pointBorderColor: 'var(--text-on-accent)',
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
        const scenarioText = isBudgetDatasetKey(dsKey)
            ? `\n${buildBudgetScenarioForecast(dsKey, ds, dataPoints, parsed.years, model)}`
            : '';
        results.push(`**${ds.label}**\nแหล่งข้อมูล: ${getForecastDataSourceNote(dsKey)}\nข้อมูลจริง: ${existingYears[0]}-${existingYears[existingYears.length - 1]} (${existingYears.length} ปี)\nพยากรณ์ (Linear Regression):\n${forecastSummary}${scenarioText}`);
    }

    // Build scales config — support dual Y-axis
    const scalesConfig = {
        x: { ticks: { color: 'var(--chart-muted)', font: { size: 11, weight: '500' } }, grid: { display: false } },
        y: {
            ticks: { color: 'var(--chart-muted)', font: { size: 11 } },
            grid: { color: 'var(--chart-grid)', lineWidth: 0.5 },
            title: needsDualAxis ? { display: true, text: 'จำนวน (คน)', color: 'var(--chart-muted)', font: { size: 11, weight: '600' } } : {},
        },
    };
    if (needsDualAxis) {
        scalesConfig.y1 = {
            position: 'right',
            ticks: { color: 'var(--accent-gold)', font: { size: 11 } },
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'เกรดเฉลี่ย / %', color: 'var(--accent-gold)', font: { size: 11, weight: '600' } },
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
                    labels: { color: 'var(--chart-muted)', padding: 14, font: { size: 11, weight: '500' }, usePointStyle: true, pointStyleWidth: 10 }
                },
                tooltip: {
                    ...AI_CHART_TOOLTIP_STYLE,
                    titleFont: { weight: '700', size: 12 },
                    bodyFont: { size: 11 },
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

    return { text: results.join('\n\n') + '\n\n_หมายเหตุ: คำนวณจากข้อมูลที่เว็บมีอยู่ตอนนี้ โดยใช้ realtime ก่อนเสมอ และจะเปลี่ยนตามข้อมูลใหม่ทันทีเมื่อ Firestore/MJU API sync เข้ามา (Linear Regression)_', chart: chartConfig };
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

export function isStudentFile(headers) {
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
export function parseUploadedStudents(parsed) {
    if (!parsed || !isStudentFile(parsed.headers)) return [];
    const results = [];
    for (const row of parsed.rows) {
        const normalized = normalizeStudentRow(row, parsed.headers);
        if (normalized) results.push(normalized);
    }
    return results;
}

// Combined student list: mock/Firestore + any uploaded student rows (deduplicated by ID)
export const getAllStudents = () => {
    const base = getStudentListSync();
    if (_uploadedStudentRows.length === 0) return base;
    // Merge: uploaded takes priority on duplicate IDs
    const idSet = new Set(_uploadedStudentRows.map(s => s.id));
    const filtered = base.filter(s => !idSet.has(s.id));
    return [...filtered, ..._uploadedStudentRows];
};

function hasTrustedStudentRowsForChat() {
    return _uploadedStudentRows.length > 0 || getStudentRosterTrustStatus().canAnswerIndividual;
}

function getTrustedStudentsForRows() {
    if (_uploadedStudentRows.length > 0) {
        if (getStudentRosterTrustStatus().canAnswerIndividual) return getAllStudents();
        return _uploadedStudentRows;
    }
    return getStudentRosterTrustStatus().canAnswerIndividual ? getStudentListSync() : [];
}

function getTrustedStudentsForAdvice() {
    const base = getStudentRosterTrustStatus().canAnswerIndividual ? getStudentListSync() : [];
    if (_uploadedStudentRows.length === 0) return base;
    const idSet = new Set(_uploadedStudentRows.map(s => s.id));
    const filtered = base.filter(s => !idSet.has(s.id));
    return [...filtered, ..._uploadedStudentRows];
}

function isStudentRowLookupQuestion(question = '') {
    const text = String(question || '').toLowerCase();
    if (/\b6\d{9}\b/.test(text)) return true;
    if (/(?:รหัส|id)\s*\d{2,}/i.test(text)) return true;
    if (/(ค้นหานักศึกษา|หานักศึกษา|ชื่อนักศึกษา|ชื่อนิสิต)/.test(text)) return true;
    if (/รายชื่อ/.test(text) && /(นักศึกษา|นิสิต|รหัส|gpa|เกรด|คะแนนเฉลี่ย|เกรดเฉลี่ย|ชั้นปี|สาขา|รอพินิจ|เสี่ยง|เกียรตินิยม)/.test(text)) return true;
    if (/(gpa|เกรด|คะแนนเฉลี่ย|เกรดเฉลี่ย).*(สูงสุด|มากสุด|มากที่สุด|top|ต่ำสุด|น้อยสุด|น้อยที่สุด|รอพินิจ|เสี่ยง|ต่ำ)/.test(text)) return true;
    if (/(สูงสุด|มากสุด|มากที่สุด|top|ต่ำสุด|น้อยสุด|น้อยที่สุด).*(gpa|เกรด|คะแนนเฉลี่ย|เกรดเฉลี่ย)/.test(text)) return true;
    if (/(รอพินิจ|เกรดต่ำ|กลุ่มเสี่ยง|เสี่ยงพ้นสภาพ)/.test(text)) return true;
    return false;
}

function parseStudentLookupLimit(question = '', fallback = 10) {
    const text = String(question || '').toLowerCase();
    const match = text.match(/top\s*(\d+)/i) || text.match(/(\d+)\s*(คน|ราย|รายการ|อันดับ)?/);
    const limit = Number(match?.[1]);
    if (!Number.isFinite(limit) || limit <= 0) return fallback;
    return Math.min(Math.max(Math.trunc(limit), 1), 50);
}

function studentDisplayName(student) {
    const prefix = String(student?.prefix || '').trim();
    const name = String(student?.name || '').trim();
    if (!prefix || name.startsWith(prefix)) return name;
    return `${prefix}${name}`.trim();
}

export function setUploadedStudentRows(rows = []) {
    _uploadedStudentRows = Array.isArray(rows) ? rows : [];
    return getAllStudents();
}

function wantsStudentCountGradeChart(question) {
    const q = String(question || '').toLowerCase();
    const hasChartIntent = /กราฟ|chart|plot|แผนภูมิ|แผนภาพ|สร้าง|แสดง|เปรียบเทียบ|วิเคราะห์/.test(q);
    const hasStudentCount = /จำนวนนักศึกษา|จำนวนนิสิต|นักศึกษา|นิสิต|student|students|count/.test(q);
    const hasGrade = /เกรด|gpa|จีพีเอ|grade|เกรดเฉลี่ย|ผลการเรียน/.test(q);
    const wantsIndividualRows = /รายคน|แต่ละคน|รายชื่อ|ชื่อ|รหัส\s*6|\b6\d{9}\b|สูงสุด|ต่ำสุด|top\s*\d*/i.test(q);
    return hasChartIntent && hasStudentCount && hasGrade && !wantsIndividualRows;
}

function getStudentCountGpaByMajorRows() {
    const allStudents = getTrustedStudentsForRows().filter(s => s?.major);
    const scienceStudents = allStudents.filter(s => SCIENCE_MAJORS.includes(s.major));
    const students = scienceStudents.length > 0 ? scienceStudents : allStudents;
    const byMajor = new Map();

    students.forEach(student => {
        const major = student.major || 'ไม่ระบุสาขา';
        const current = byMajor.get(major) || { major, count: 0, gpaSum: 0, gpaCount: 0 };
        const gpa = Number(student.gpa);
        current.count += 1;
        if (Number.isFinite(gpa) && gpa >= 0 && gpa <= 4) {
            current.gpaSum += gpa;
            current.gpaCount += 1;
        }
        byMajor.set(major, current);
    });

    return Array.from(byMajor.values())
        .map(row => ({
            ...row,
            avgGpa: row.gpaCount > 0 ? Number((row.gpaSum / row.gpaCount).toFixed(2)) : 0,
        }))
        .sort((a, b) => b.count - a.count || b.avgGpa - a.avgGpa);
}

function buildStudentCountGpaByMajorChart(question = '') {
    const rows = getStudentCountGpaByMajorRows(question);
    if (rows.length === 0) return null;

    return {
        chartType: 'bar',
        data: {
            labels: rows.map(row => row.major),
            datasets: [
                {
                    type: 'bar',
                    label: 'จำนวนนักศึกษา',
                    data: rows.map(row => row.count),
                    backgroundColor: 'color-mix(in srgb, var(--accent-success) 75%, transparent)',
                    borderColor: 'var(--accent-success)',
                    borderWidth: 0,
                    borderRadius: 8,
                    yAxisID: 'y',
                    order: 2,
                },
                {
                    type: 'bar',
                    label: 'GPA เฉลี่ย',
                    data: rows.map(row => row.avgGpa),
                    backgroundColor: 'color-mix(in srgb, var(--accent-purple) 72%, transparent)',
                    borderColor: 'var(--accent-purple)',
                    borderWidth: 0,
                    borderRadius: 8,
                    yAxisID: 'y1',
                    order: 1,
                },
            ],
        },
        options: {
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const value = Number(ctx.parsed?.y ?? ctx.raw ?? 0);
                            return ctx.dataset?.yAxisID === 'y1'
                                ? ` ${ctx.dataset.label}: ${value.toFixed(2)}`
                                : ` ${ctx.dataset.label}: ${value.toLocaleString('th-TH')} คน`;
                        },
                    },
                },
            },
            scales: {
                y: {
                    type: 'linear',
                    position: 'left',
                    beginAtZero: true,
                    title: { display: true, text: 'จำนวนนักศึกษา (คน)' },
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    min: 0,
                    max: 4,
                    title: { display: true, text: 'GPA เฉลี่ย' },
                    grid: { drawOnChartArea: false },
                },
            },
        },
    };
}

function wantsStudentMajorCountChart(question) {
    const q = String(question || '').toLowerCase();
    const hasChartIntent = /กราฟ|chart|plot|แผนภูมิ|แผนภาพ|สร้าง|แสดง|เปรียบเทียบ|วิเคราะห์/.test(q);
    const hasStudentCount = /จำนวนนักศึกษา|จำนวนนิสิต|นักศึกษา|นิสิต|student|students|count/.test(q);
    const hasMajor = /สาขา|major|program|หลักสูตร/.test(q);
    const hasGrade = /เกรด|gpa|จีพีเอ|grade|เกรดเฉลี่ย|ผลการเรียน/.test(q);
    const wantsIndividualRows = /รายคน|แต่ละคน|รายชื่อ|ชื่อ|รหัส\s*6|\b6\d{9}\b|สูงสุด|ต่ำสุด|top\s*\d*/i.test(q);
    return hasChartIntent && hasStudentCount && hasMajor && !hasGrade && !wantsIndividualRows;
}

function buildStudentMajorCountChartResponse(question = '') {
    const rows = getStudentCountGpaByMajorRows(question);
    if (rows.length === 0) return null;

    const total = rows.reduce((sum, row) => sum + row.count, 0);
    const topMajor = rows[0];
    const updatedAt = new Date().toLocaleString('th-TH');
    const sourceLabel = isLiveData()
        ? 'ข้อมูลนิสิตล่าสุดจากระบบ realtime'
        : 'ข้อมูลนิสิตที่เว็บใช้คำนวณอยู่ตอนนี้';

    return {
        text: `นี่คือกราฟเปรียบเทียบ **จำนวนนิสิตคณะวิทยาศาสตร์แยกตามสาขา** จาก${sourceLabel} ณ ${updatedAt}\n\nรวม ${total.toLocaleString('th-TH')} คน ครอบคลุม ${rows.length} สาขา โดยสาขาที่มีนิสิตมากที่สุดคือ **${topMajor.major}** (${topMajor.count.toLocaleString('th-TH')} คน)`,
        chart: {
            chartType: 'bar',
            data: {
                labels: rows.map(row => row.major),
                datasets: [
                    {
                        label: 'จำนวนนิสิต (คน)',
                        data: rows.map(row => row.count),
                        backgroundColor: 'color-mix(in srgb, var(--accent-blue) 78%, transparent)',
                        borderColor: 'var(--accent-blue)',
                        borderWidth: 0,
                        borderRadius: 8,
                    },
                ],
            },
            options: {
                plugins: {
                    title: {
                        display: true,
                        text: 'จำนวนนิสิตคณะวิทยาศาสตร์แยกตามสาขา',
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.dataset.label}: ${Number(ctx.raw || 0).toLocaleString('th-TH')}`,
                        },
                    },
                },
                scales: {
                    x: {
                        title: { display: true, text: 'สาขา' },
                        ticks: { maxRotation: 35, minRotation: 0 },
                    },
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'จำนวนนิสิต (คน)' },
                    },
                },
            },
        },
    };
}

function buildStudentCountGpaChartResponse(question = '') {
    const rows = getStudentCountGpaByMajorRows(question);
    if (rows.length === 0) return null;

    const chart = buildStudentCountGpaByMajorChart(question);
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    const topCount = rows[0];
    const topGpa = rows.reduce((best, row) => (row.avgGpa > best.avgGpa ? row : best), rows[0]);
    return {
        text: `สร้างกราฟเปรียบเทียบ **จำนวนนิสิตคณะวิทยาศาสตร์** และ **GPA เฉลี่ย** แยกตามสาขาให้แล้วครับ\n\nข้อมูลมาจากฐานข้อมูลนิสิตชุดเดียวกับหน้าสถิตินิสิตปัจจุบัน จำนวน ${total.toLocaleString('th-TH')} คน ครอบคลุม ${rows.length} สาขา\nสาขาที่มีนิสิตมากที่สุดคือ ${topCount.major} (${topCount.count.toLocaleString('th-TH')} คน) และสาขาที่มี GPA เฉลี่ยสูงสุดคือ ${topGpa.major} (${topGpa.avgGpa.toFixed(2)})`,
        chart,
    };
}

function wantsStudentClassYearChart(question) {
    const q = String(question || '').toLowerCase();
    const hasChartIntent = /กราฟ|chart|plot|แผนภูมิ|แผนภาพ|สร้าง|แสดง|เปรียบเทียบ|วิเคราะห์/.test(q);
    const hasStudent = /จำนวนนักศึกษา|จำนวนนิสิต|นักศึกษา|นิสิต|student|students/.test(q);
    const hasClassYear = /ชั้นปี|ปี\s*[1-6]|year|class/.test(q);
    const wantsIndividualRows = /รายคน|แต่ละคน|รายชื่อ|ชื่อ|รหัส\s*6|\b6\d{9}\b|สูงสุด|ต่ำสุด|top\s*\d*/i.test(q);
    return hasChartIntent && hasStudent && hasClassYear && !wantsIndividualRows;
}

function getStudentClassYearRows(question = '') {
    const q = String(question || '').toLowerCase();
    const wantsScienceScope = /คณะวิทย|วิทยาศาสตร์|คณะวิทย์|science/.test(q);
    const allStudents = getTrustedStudentsForRows().filter(s => s?.year);
    const scopedStudents = wantsScienceScope
        ? allStudents.filter(s => SCIENCE_MAJORS.includes(s.major))
        : allStudents;
    const students = scopedStudents.length > 0 ? scopedStudents : allStudents;
    const byYear = new Map();

    students.forEach(student => {
        const year = Number(student.year);
        const key = Number.isFinite(year) ? year : String(student.year || 'ไม่ระบุ');
        byYear.set(key, (byYear.get(key) || 0) + 1);
    });

    return Array.from(byYear.entries())
        .map(([year, count]) => ({
            year,
            label: Number.isFinite(Number(year)) ? `ชั้นปี ${year}` : String(year),
            count,
        }))
        .sort((a, b) => Number(a.year) - Number(b.year));
}

function buildStudentClassYearChartResponse(question = '') {
    const rows = getStudentClassYearRows(question);
    if (rows.length === 0) return null;
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    const topYear = rows.reduce((best, row) => (row.count > best.count ? row : best), rows[0]);

    return {
        text: `สร้างกราฟ **จำนวนนักศึกษาแยกตามชั้นปี** ให้แล้วครับ\n\nข้อมูลมาจากฐานข้อมูลนักศึกษาในเว็บ จำนวน ${total.toLocaleString('th-TH')} คน โดยชั้นปีที่มีนักศึกษามากที่สุดคือ ${topYear.label} (${topYear.count.toLocaleString('th-TH')} คน)`,
        chart: {
            chartType: 'bar',
            data: {
                labels: rows.map(row => row.label),
                datasets: [
                    {
                        label: 'จำนวนนักศึกษา',
                        data: rows.map(row => row.count),
                        backgroundColor: 'color-mix(in srgb, var(--accent-success) 75%, transparent)',
                        borderColor: 'var(--accent-success)',
                        borderWidth: 0,
                        borderRadius: 8,
                    },
                ],
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'จำนวนนักศึกษา (คน)' },
                    },
                },
            },
        },
    };
}

function ensureStudentCountGradeChart(chart, sourceQuestion = '') {
    if (!wantsStudentCountGradeChart(sourceQuestion)) return chart;
    const fallbackChart = buildStudentCountGpaByMajorChart(sourceQuestion);
    if (!fallbackChart) return chart;

    const datasets = chart?.data?.datasets || [];
    const hasCountDataset = datasets.some(isStudentCountDataset);
    const hasGpa = datasets.some(isGpaDataset);
    if (!chart || datasets.length === 0 || (hasCountDataset && !hasGpa)) {
        return fallbackChart;
    }
    return chart;
}

function withStudentSourceNote(result) {
    if (!result?.text) return result;
    const chatUploadNote = _uploadedStudentRows.length > 0
        ? `\n\n_หมายเหตุ: คำตอบนี้รวมข้อมูลจากไฟล์ที่ผู้ใช้แนบในแชท ${_uploadedStudentRows.length.toLocaleString('th-TH')} แถว ซึ่งถือเป็น user-provided data สำหรับคำถามนี้_`
        : '';
    return {
        ...result,
        text: `${appendStudentAnswerSourceNote(result.text)}${chatUploadNote}`,
    };
}

function buildStudentRowsUnavailableChatResult(topic = 'รายชื่อหรือ GPA รายคน') {
    const rec = getStudentReconciliationSnapshot();
    const officialText = rec.officialTotal == null
        ? 'ยังไม่พบยอดรวมทางการจาก MJU Dashboard'
        : `ยอดรวมทางการจาก MJU Dashboard คือ **${rec.officialTotal.toLocaleString('th-TH')} คน**`;
    return {
        text: `ตอนนี้ยังสร้าง/ตอบ${topic}จากข้อมูลจริงไม่ได้ครับ เพราะรายชื่อในระบบยังเป็น **sample/generated** ไม่ใช่รายชื่อจริงจาก Reg/คณะ\n\n${officialText}\n\nวิธีทำให้ตรงของจริงที่สุดตอนยังไม่มี API key คืออัปโหลดไฟล์ CSV/XLSX export จาก Reg/คณะผ่านหน้า Admin Data Upload ก่อน แล้ว AI จะใช้รายชื่อ/GPA จากไฟล์นั้นแทน sample\n\n_แหล่งข้อมูล: ยอดรวมใช้ MJU Dashboard; รายชื่อรายคนตอนนี้ = ${rec.studentSourceLabel} (${rec.studentRosterAccuracyLabel}); ${rec.studentRowsSummary}_`,
        chart: null,
    };
}

// ==================== Smart Student Search ====================
function searchStudents(query) {
    const ALL_STUDENTS = getTrustedStudentsForRows();
    if (ALL_STUDENTS.length === 0) return buildStudentRowsUnavailableChatResult('รายชื่อรายคน');
    const q = query.toLowerCase();
    let limit = 0;
    const limitMatch = q.match(/(\d+)\s*(คน|ราย|รายการ)/);
    if (limitMatch) limit = parseInt(limitMatch[1]);
    const limitMatch2 = q.match(/(?:แค่|ขอ|เอา|แสดง|โชว์)\s*(\d+)/);
    if (!limit && limitMatch2) limit = parseInt(limitMatch2[1]);

    let results = [];
    let searchDesc = '';
    const wantsTopGpa = /(gpa|เกรด|คะแนนเฉลี่ย|เกรดเฉลี่ย).*(สูงสุด|มากสุด|มากที่สุด|top)|(?:สูงสุด|มากสุด|มากที่สุด|top).*(gpa|เกรด|คะแนนเฉลี่ย|เกรดเฉลี่ย)/.test(q);
    const wantsLowGpa = /(gpa|เกรด|คะแนนเฉลี่ย|เกรดเฉลี่ย).*(ต่ำสุด|น้อยสุด|น้อยที่สุด|ต่ำ|รอพินิจ|เสี่ยง)|(?:ต่ำสุด|น้อยสุด|น้อยที่สุด).*(gpa|เกรด|คะแนนเฉลี่ย|เกรดเฉลี่ย)|รอพินิจ|เกรดต่ำ|กลุ่มเสี่ยง|เสี่ยงพ้นสภาพ/.test(q);

    if (wantsTopGpa || wantsLowGpa) {
        const direction = wantsLowGpa ? 'asc' : 'desc';
        results = ALL_STUDENTS
            .filter(student => Number.isFinite(Number(student.gpa)))
            .sort((a, b) => {
                const diff = direction === 'asc' ? Number(a.gpa) - Number(b.gpa) : Number(b.gpa) - Number(a.gpa);
                if (diff !== 0) return diff;
                return String(a.id || '').localeCompare(String(b.id || ''), 'th');
            });
        searchDesc = wantsLowGpa ? 'GPA ต่ำสุด' : 'GPA สูงสุด';
        if (!limit) limit = parseStudentLookupLimit(q, 10);
    }

    // Full 10-digit ID first (exact match), then prefix-based search
    const fullIdMatch = results.length === 0 ? q.match(/\b(6\d{9})\b/) : null;
    if (fullIdMatch) {
        const fullId = fullIdMatch[1];
        results = ALL_STUDENTS.filter(s => s.id === fullId);
        searchDesc = `รหัสนักศึกษา "${fullId}"`;
    }
    if (results.length === 0) {
        const idPrefixMatch = q.match(/(?:รหัส|id)\s*(\d{2,8})/i) || q.match(/\b(6[0-9]\d{0,6})\b/);
        if (idPrefixMatch) {
            const prefix = idPrefixMatch[1];
            results = ALL_STUDENTS.filter(s => s.id.startsWith(prefix));
            searchDesc = `รหัสขึ้นต้นด้วย "${prefix}"`;
        }
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
// Only handle queries that local functions SPECIFICALLY excel at:
// 1. Explicit forecast requests (with "พยากรณ์"/"predict" keywords)
// 2. Student search by ID/name/major/GPA (structured lookups)
// Everything else → Gemini AI (smarter, context-aware answers)
export function tryLocalResponse(question, userContext = {}) {
    const q = question.toLowerCase();
    // Forecast has first priority so budget questions such as "พยากรณ์งบประมาณปี 70 71"
    // cannot be captured by course/grade chart heuristics.
    const forecastParsed = parseForecastRequest(question);
    if (forecastParsed) {
        const requiredSections = getForecastRequiredSections(forecastParsed);
        if (!canAIUseAllInternalSections(userContext, requiredSections)) {
            return buildAIAccessDeniedResult(userContext, requiredSections);
        }
        const result = generateForecastResponse(forecastParsed);
        if (result) return result;
        // If no datasets matched, fall through to AI
    }

    if (isExecutiveRecommendationIntent(question)) return null;

    const chartPlanResult = createPlannedChartAnswer(question, userContext);
    if (chartPlanResult) return chartPlanResult;

    const instantResult = tryInstantAnswer(question, userContext);
    if (instantResult) return instantResult;

    // 2. Deterministic aggregate chart for "student count + grade/GPA".
    // This data already exists in the web app, so do not rely on the model
    // to remember both metrics when building the chart JSON.
    if (wantsStudentCountGradeChart(question)) {
        if (!canAIUseInternalSection(userContext, 'student_stats')) {
            return buildAIAccessDeniedResult(userContext, ['student_stats']);
        }
        if (!hasTrustedStudentRowsForChat()) {
            return buildStudentRowsUnavailableChatResult('กราฟจำนวนนักศึกษา + GPA แยกสาขา');
        }
        const result = buildStudentCountGpaChartResponse(question);
        if (result) return withStudentSourceNote(result);
    }

    // 3. Deterministic aggregate chart for Faculty of Science student counts by major.
    if (wantsStudentMajorCountChart(question)) {
        if (!canAIUseInternalSection(userContext, 'student_stats')) {
            return buildAIAccessDeniedResult(userContext, ['student_stats']);
        }
        if (!hasTrustedStudentRowsForChat()) {
            return buildStudentRowsUnavailableChatResult('กราฟจำนวนนักศึกษาแยกสาขาจากรายชื่อจริง');
        }
        const result = buildStudentMajorCountChartResponse(question);
        if (result) return withStudentSourceNote(result);
    }

    // 4. Deterministic aggregate chart for student counts by class year.
    if (wantsStudentClassYearChart(question)) {
        if (!canAIUseInternalSection(userContext, 'student_stats')) {
            return buildAIAccessDeniedResult(userContext, ['student_stats']);
        }
        if (!hasTrustedStudentRowsForChat()) {
            return buildStudentRowsUnavailableChatResult('กราฟจำนวนนักศึกษาแยกชั้นปีจากรายชื่อจริง');
        }
        const result = buildStudentClassYearChartResponse(question);
        if (result) return withStudentSourceNote(result);
    }

    // 5. Student search — only for specific structured lookups (ID, name, GPA filter)
    const isStudentLookup = isStudentRowLookupQuestion(question);

    if (isStudentLookup) {
        if (!canAIUseInternalSection(userContext, 'student_list')) {
            return buildAIAccessDeniedResult(userContext, ['student_list']);
        }
        const studentResult = searchStudents(q);
        return withStudentSourceNote(studentResult || buildStudentRowsUnavailableChatResult('รายชื่อหรือ GPA รายคน'));
    }

    return null; // Let AI handle everything else
}

export function formatUploadedFileContextForAI(uploadedFileData) {
    if (!uploadedFileData) return '';
    const profiles = (uploadedFileData.columnProfiles || []).slice(0, 16);
    const profileLines = profiles.map(col => {
        const stats = col.numericStats
            ? ` min=${col.numericStats.min}, max=${col.numericStats.max}, avg=${col.numericStats.avg}, sum=${col.numericStats.sum}`
            : '';
        return `- ${col.name}: type=${col.type}, missing=${col.missingCount} (${col.missingPercent}%), unique=${col.uniqueCount}${stats}`;
    }).join('\n');
    const aggregateLines = Object.entries(uploadedFileData.aggregates || {})
        .slice(0, 10)
        .map(([name, stats]) => `- ${name}: count=${stats.count}, min=${stats.min}, max=${stats.max}, avg=${stats.avg}, sum=${stats.sum}`)
        .join('\n');
    const warnings = (uploadedFileData.qualityWarnings || []).map(item => `- ${item}`).join('\n') || '- none';
    const suggestions = (uploadedFileData.suggestedQuestions || []).map(item => `- ${item}`).join('\n') || '- สรุป insight สำคัญจากไฟล์นี้';
    const chartSuggestions = (uploadedFileData.recommendedCharts || [])
        .map(item => `- ${item.type}: ${item.label} (${item.reason})`)
        .join('\n') || '- none';
    const preview = (uploadedFileData.rows || [])
        .slice(0, 5)
        .map(row => (uploadedFileData.headers || []).map(header => `${header}=${row[header]}`).join(' | '))
        .join('\n');

    return [
        '[Uploaded file context]',
        `fileName=${uploadedFileData.fileName || 'uploaded file'}`,
        `schema=${uploadedFileData.schemaSummary || `${uploadedFileData.rowCount || 0} rows, ${(uploadedFileData.headers || []).length} columns`}`,
        `headers=${(uploadedFileData.headers || []).join(', ')}`,
        `numericColumns=${(uploadedFileData.numericCols || []).join(', ') || '-'}`,
        `labelColumn=${uploadedFileData.labelCol || '-'}`,
        `missingTotal=${uploadedFileData.missingValues?.total ?? 0}`,
        `missingPercent=${uploadedFileData.missingValues?.percent ?? 0}`,
        `analysisReadiness=${uploadedFileData.analysisReadiness?.label || 'unknown'} (${uploadedFileData.analysisReadiness?.score ?? '-'} / 100)`,
        `columnTypeCounts=${JSON.stringify(uploadedFileData.columnTypeCounts || {})}`,
        `truncated=${uploadedFileData.truncated ? 'yes' : 'no'}`,
        'columnProfiles:',
        profileLines || '- none',
        'numericAggregates:',
        aggregateLines || '- none',
        'qualityWarnings:',
        warnings,
        'recommendedCharts:',
        chartSuggestions,
        'suggestedQuestions:',
        suggestions,
        'previewRows:',
        preview || '- none',
        'Instruction: use schema/profile/aggregates first. Use preview rows only as examples. If the file is too small or missing key columns, say the limitation instead of guessing.',
    ].join('\n');
}

// ==================== Parse AI Generated Chart ====================
export function buildAIChatPrompt(question, uploadedFileData = null, dashboardMergeSummary = null, userContext = {}) {
    const adviceMode = isExecutiveRecommendationIntent(question);
    const allStudents = adviceMode ? getTrustedStudentsForAdvice() : getTrustedStudentsForRows();
    const studentRosterTrust = getStudentRosterTrustStatus();
    const studentReconcile = getStudentReconciliationSnapshot();
    const qLower = String(question || '').toLowerCase();
    const isTcasPlanningQ = /tcas|admission|รับสมัคร|รับเข้า|แผนรับ|portfolio|quota/.test(qLower);
    const isStudentRecordQ = /gpa|เกรด|ชั้นปี|รายชื่อ|จำนวนนักศึกษาปัจจุบัน|student\s*id|พ้นสภาพ|รอพินิจ|คงอยู่|ลาออก|หายไป/.test(qLower);
    const isStudentQ = /นักศึกษา|นิสิต|gpa|เกรด|สาขา|ชั้นปี|รายชื่อ|จำนวนนักศึกษา|student/.test(qLower)
        && !(isTcasPlanningQ && !isStudentRecordQ);
    const canUseStudentStats = canAIUseInternalSection(userContext, 'student_stats');
    const canUseStudentRows = canAIUseInternalSection(userContext, 'student_list') && hasTrustedStudentRowsForChat();
    const dashboardSummary = dashboardMergeSummary || {
        name: 'ข้อมูล Dashboard',
        ...buildLiveDashboardMergeSummary(),
    };

    const dataAccuracyContext = buildDataAccuracyContextForAI();
    let context = dataAccuracyContext ? `[DATA ACCURACY / SOURCE STATUS]\n${dataAccuracyContext}\n\n` : '';
    const mjuConnectedContext = buildMjuConnectedContextForAI(userContext);
    if (mjuConnectedContext) {
        context += `[MJU CONNECTED IDENTITY]\n${mjuConnectedContext}\n\n`;
    }
    if (adviceMode) {
        context += '[EXECUTIVE ADVICE DATA POLICY]\nคำถามนี้เป็นคำถามเชิงคำแนะนำ/วางแผน ให้ใช้ข้อมูลในเว็บก่อนเสมอ โดย live_official ใช้ได้เต็ม และ approved_reference เช่น TCAS จากประกาศทางการ/ไฟล์ในระบบใช้ตอบเชิงทิศทางได้พร้อมบอกข้อจำกัด ห้ามใช้ mock/demo/sample/generated เป็นฐานคำแนะนำเชิงบริหาร ถ้าข้อมูลไม่พร้อมจริงให้แจ้ง dataset ที่ต้อง sync/อัปโหลดก่อน\n\n';
    }
    if (isStudentQ && !canUseStudentStats) {
        context += '[ACCESS LIMITED]\nRole นี้ไม่มีสิทธิ์อ่านข้อมูลนักศึกษาภายในจากระบบ ห้ามแนบ/เดารายชื่อนักศึกษา GPA หรือสถิติภายใน ให้ตอบเฉพาะข้อมูลสาธารณะหรือแจ้งว่าต้องใช้สิทธิ์สูงกว่า\n\n';
    }
    if (isStudentQ && canUseStudentStats) {
        context += `[STUDENT OFFICIAL AGGREGATE]\nยอดรวม/สถิติรวมต้องอ้าง MJU Dashboard ก่อน: officialTotal=${studentReconcile.officialTotal ?? 'unknown'}, source=${studentReconcile.officialSourceLabel}, status=${studentReconcile.officialIsLive ? 'live' : 'reference/fallback'}\n`;
        context += `studentRows=${studentReconcile.localTotal}, rowSource=${studentReconcile.studentSourceLabel}, rowTrust=${studentReconcile.studentRosterAccuracyLabel}, canUseRowsForRealRoster=${studentRosterTrust.canAnswerIndividual || _uploadedStudentRows.length > 0}, reconcile=${studentReconcile.studentRowsSummary}\n`;
        if (!studentRosterTrust.canAnswerIndividual && _uploadedStudentRows.length === 0) {
            context += 'สำคัญ: รายชื่อในระบบตอนนี้เป็น sample/generated ห้ามใช้ยืนยันรายชื่อจริง, GPA รายคน, กลุ่มเสี่ยงรายคน หรือกราฟจากรายชื่อจริง ให้ตอบยอดรวมจาก MJU Dashboard และบอกให้ผู้ใช้อัปโหลดไฟล์จริงจาก Reg/คณะหากต้องใช้รายคน\n\n';
        }
    }
    if (isStudentQ && canUseStudentStats && allStudents.length > 0) {
        const byMajor = {};
        const byYear = {};
        allStudents.forEach(s => {
            byMajor[s.major] = byMajor[s.major] || { count: 0, gpas: [] };
            byMajor[s.major].count += 1;
            byMajor[s.major].gpas.push(Number(s.gpa) || 0);
            const yKey = `ชั้นปี ${s.year}`;
            byYear[yKey] = (byYear[yKey] || 0) + 1;
        });

        const majorStats = Object.entries(byMajor).map(([major, value]) => {
            const avg = value.gpas.length
                ? (value.gpas.reduce((sum, gpa) => sum + gpa, 0) / value.gpas.length).toFixed(2)
                : '-';
            return `${major}: ${value.count} คน, GPA เฉลี่ย ${avg}`;
        }).join('\n');
        const yearStats = Object.entries(byYear).map(([year, count]) => `${year}: ${count} คน`).join(', ');

        const studentSourceLabel = adviceMode
            ? (isLiveData() && _uploadedStudentRows.length > 0 ? 'ข้อมูล live/realtime + ไฟล์ที่ผู้ใช้อัปโหลด' : isLiveData() ? 'ข้อมูล live/realtime' : 'ไฟล์ที่ผู้ใช้อัปโหลด')
            : 'ข้อมูลระบบ + ข้อมูลที่อัปโหลด';
        context += `[บริบทนักศึกษา: ข้อมูลรวม ${allStudents.length} คน (${studentSourceLabel})\n`;
        context += `สรุปตามสาขา:\n${majorStats}\n`;
        context += `สรุปตามชั้นปี: ${yearStats}\n`;
        if (wantsStudentCountGradeChart(question)) {
            context += `คำสั่งกราฟ: ผู้ใช้ถามทั้งจำนวนนักศึกษาและเกรด/GPA ต้องใส่ทั้ง dataset "จำนวนนักศึกษา" และ "GPA เฉลี่ย" แยกตามสาขา ห้ามตัด metric ใด metric หนึ่งออก\n`;
        }

        const idMentioned = String(question || '').match(/\b6\d{9}\b/);
        if (idMentioned) {
            if (canUseStudentRows) {
                const found = allStudents.find(s => s.id === idMentioned[0]);
                context += found
                    ? `รหัสที่ผู้ใช้ระบุ ${found.id}: ${found.prefix || ''}${found.name}, สาขา${found.major}, ปี ${found.year}, ${found.level || ''}, GPA ${found.gpa}, ${found.status}\n`
                    : `รหัสที่ผู้ใช้ระบุ ${idMentioned[0]}: ไม่พบในฐานข้อมูล\n`;
            } else {
                context += `ผู้ใช้ระบุรหัสนักศึกษา ${idMentioned[0]} แต่ role นี้ไม่มีสิทธิ์ student_list จึงห้ามเปิดเผยข้อมูลรายบุคคล\n`;
            }
        }

        if (canUseStudentRows) {
            const rowLookup = isStudentRowLookupQuestion(question);
            const lowGpaLookup = /(gpa|เกรด|คะแนนเฉลี่ย|เกรดเฉลี่ย).*(ต่ำสุด|น้อยสุด|น้อยที่สุด|ต่ำ|รอพินิจ|เสี่ยง)|(?:ต่ำสุด|น้อยสุด|น้อยที่สุด).*(gpa|เกรด|คะแนนเฉลี่ย|เกรดเฉลี่ย)|รอพินิจ|เกรดต่ำ|กลุ่มเสี่ยง|เสี่ยงพ้นสภาพ/.test(String(question || '').toLowerCase());
            const rowsForPrompt = rowLookup
                ? allStudents
                    .filter(student => Number.isFinite(Number(student.gpa)))
                    .sort((a, b) => {
                        const diff = lowGpaLookup
                            ? Number(a.gpa) - Number(b.gpa)
                            : Number(b.gpa) - Number(a.gpa);
                        if (diff !== 0) return diff;
                        return String(a.id || '').localeCompare(String(b.id || ''), 'th');
                    })
                    .slice(0, parseStudentLookupLimit(question, 10))
                : allStudents.slice(0, 15);
            const sample = rowsForPrompt
                .map(s => `${s.id},${studentDisplayName(s)},${s.major},ปี ${s.year},GPA ${s.gpa},${s.status}`)
                .join('\n');
            const rowLabel = rowLookup
                ? (lowGpaLookup ? 'ข้อมูลเรียง GPA ต่ำสุด/กลุ่มเสี่ยงตามคำถาม' : 'ข้อมูลเรียง GPA สูงสุดตามคำถาม')
                : 'ตัวอย่างข้อมูล (15 คนแรก)';
            context += `${rowLabel}:\n${sample}]\n\n`;
        } else {
            context += 'ไม่มีการแนบตัวอย่างรายชื่อรายบุคคล เพราะ role นี้อ่านได้เฉพาะสถิติรวม ไม่ใช่ student_list\n\n';
        }
    } else if (adviceMode && isStudentQ && canUseStudentStats) {
        context += '[ข้อมูลนักศึกษา]\nข้อมูลนักศึกษาจริงยังไม่พร้อมสำหรับคำแนะนำเชิงบริหารจากสถานการณ์จริง: ตอนนี้ฐานนักศึกษายังไม่ใช่ live/official และไม่มีไฟล์นักศึกษาที่ผู้ใช้อัปโหลดในแชทนี้ ให้แจ้งว่าต้อง sync Firestore หรืออัปโหลดไฟล์นักศึกษาจริงก่อน ห้ามใช้ตัวเลข mock\n\n';
    }

    if (uploadedFileData) {
        const dashRows = Array.isArray(dashboardSummary?.rows) ? dashboardSummary.rows : [];
        const dashHeaders = Array.isArray(dashboardSummary?.headers) ? dashboardSummary.headers : [];
        const dashPreview = dashRows.map(r => Object.values(r).join(', ')).join('\n');
        context += `${formatUploadedFileContextForAI(uploadedFileData)}\n`;
        if (dashRows.length > 0 && !adviceMode) {
            context += `\n\nข้อมูล Dashboard สำหรับเปรียบเทียบ (${dashHeaders.join(', ')}):\n${dashPreview}`;
        } else if (dashRows.length > 0 && adviceMode) {
            context += '\n\nงดแนบข้อมูล Dashboard สำหรับเปรียบเทียบในโหมดคำแนะนำเชิงบริหาร เพราะต้องใช้เฉพาะข้อมูลจริง/ไฟล์ที่อัปโหลดเท่านั้น';
        }
        context += `\n\nสามารถรวมข้อมูลไฟล์กับข้อมูล Dashboard เพื่อสร้างกราฟเปรียบเทียบได้ ถ้าผู้ใช้ขอ]\n\n`;
    }

    return context ? `${context}คำถาม: ${question}` : question;
}

export function parseAIResponse(text, sourceQuestion = '') {
    text = coerceStructuredAIResponseMarkdown(text, { includeInvalidChartMessage: true }) ?? String(text || '');

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
            } catch { /* not valid chart JSON */ }
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
            } catch { /* not valid */ }
        }
    }

    let chartConfig = null;
    let cleanText = text;

    if (match) {
        try {
            let rawJson = JSON.parse(match[1] || match[0]);
            // Remove the chart JSON from the display text
            cleanText = text.replace(match[0].includes('`') ? regex : match[0], '').trim();
            // Clean up leftover fence fragments (empty fences, stray json_chart label)
            cleanText = cleanText
                .replace(/`{1,3}\s*`{1,3}/g, '')
                .replace(/`{1,3}\s*json_chart\s*`{0,3}/g, '')
                .replace(/`{1,3}\s*json\s*`{0,3}/g, '')
                .trim();

            rawJson = ensureStudentCountGradeChart(rawJson, sourceQuestion);
            const isRadar = rawJson.chartType === 'radar' || rawJson.chartType === 'polarArea';

            // Validate radar charts have minimum 3 axes
            if (isRadar && rawJson.data?.labels?.length < 3) {
                rawJson.chartType = 'bar';
            }

            // Apply neon theme to radar/polar charts
            if (isRadar && rawJson.data?.labels?.length >= 3) {
                const neonColors = [
                    { border: 'var(--accent-cyan)', fill: 'color-mix(in srgb, var(--accent-cyan) 25%, transparent)' },
                    { border: 'var(--accent-pink)', fill: 'color-mix(in srgb, var(--accent-pink) 25%, transparent)' },
                    { border: 'var(--accent-success)', fill: 'color-mix(in srgb, var(--accent-success) 25%, transparent)' },
                    { border: 'var(--accent-warning)', fill: 'color-mix(in srgb, var(--accent-warning) 25%, transparent)' }
                ];
                rawJson.data.datasets.forEach((ds, i) => {
                    const colorSet = neonColors[i % neonColors.length];
                    ds.borderColor = colorSet.border;
                    ds.backgroundColor = colorSet.fill;
                    ds.pointBackgroundColor = colorSet.border;
                    ds.pointBorderColor = 'var(--text-on-accent)';
                    ds.pointBorderWidth = 2;
                    ds.pointRadius = 4;
                    ds.pointHoverRadius = 6;
                    ds.borderWidth = 2;
                });
            }

            normalizeStudentGpaComboChart(rawJson);
            normalizeGpaRateComparisonChart(rawJson);
            normalizeCategoricalLineChart(rawJson);

            // Ensure datasets have decent default colors if missing
            const defaultColors = ['var(--accent-purple)', 'var(--accent-success)', 'var(--accent-warning)', 'var(--accent-danger)', 'var(--accent-blue)', 'var(--accent-cyan)', 'var(--accent-purple)', 'var(--accent-pink)', 'var(--accent-teal)', 'var(--accent-orange)', 'var(--accent-purple)', 'var(--text-subtle)'];
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
                    const effectiveType = ds.type || rawJson.chartType;
                    // Ensure bar charts have borderRadius for modern look
                    if ((effectiveType === 'bar') && !ds.borderRadius) {
                        ds.borderRadius = 8;
                    }
                    // Ensure line charts have smooth tension and fill
                    if (effectiveType === 'line') {
                        if (ds.tension == null) ds.tension = 0.4;
                        if (ds.pointRadius == null) ds.pointRadius = 5;
                        if (ds.pointHoverRadius == null) ds.pointHoverRadius = 8;
                        if (ds.pointBorderColor == null) ds.pointBorderColor = 'var(--text-on-accent)';
                        if (ds.pointBorderWidth == null) ds.pointBorderWidth = 2;
                        if (ds.borderWidth == null) ds.borderWidth = 2.5;
                        if (ds.fill == null) ds.fill = rawJson.chartType === 'line';
                    }
                    // Bar enhancement
                    if (effectiveType === 'bar') {
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
                        ds.borderColor = ds.borderColor || 'var(--chart-surface)';
                        ds.hoverOffset = 6;
                        ds.spacing = 1;
                    }
                });
                sanitizeChartDatasetColors(rawJson);
            }

            // Build default scales based on chart type
            let defaultScales;
            if (isRadar) {
                defaultScales = {
                    r: {
                        angleLines: { color: 'var(--chart-grid)' },
                        grid: { color: 'var(--chart-grid)' },
                        pointLabels: { color: 'var(--chart-muted)', font: { size: 11, weight: 'bold' } },
                        ticks: { display: false, min: 0, max: 100 }
                    }
                };
            } else if (rawJson.chartType === 'pie' || rawJson.chartType === 'doughnut') {
                defaultScales = {};
            } else if (isPointChart) {
                defaultScales = {
                    x: { type: 'linear', position: 'bottom', ticks: { color: 'var(--chart-muted)', font: { size: 11 } }, grid: { color: 'var(--chart-grid)' }, title: rawJson.options?.scales?.x?.title || { display: false } },
                    y: { ticks: { color: 'var(--chart-muted)', font: { size: 11 }, callback: (v) => v.toLocaleString() }, grid: { color: 'var(--chart-grid)' }, title: rawJson.options?.scales?.y?.title || { display: false } }
                };
            } else {
                defaultScales = {
                    x: { ticks: { color: 'var(--chart-muted)', font: { size: 11 } }, grid: { display: false } },
                    y: { ticks: { color: 'var(--chart-muted)', font: { size: 11 }, callback: (v) => v.toLocaleString() }, grid: { color: 'var(--chart-grid)' } }
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
                const labelsAllNumeric = Array.isArray(labels) && labels.length === dataLen
                    && labels.every(l => typeof l === 'number' || /^\d+$/.test(String(l)));
                const labelsMissing = !Array.isArray(labels) || labels.length === 0
                    || labels.length !== dataLen;

                if (labelsAllNumeric && dataLen > 0) {
                    // Numeric labels that look like years (e.g. 2564, 2565) → "ปี 2564"
                    const nums = labels.map(Number);
                    const looksLikeYears = nums.every(n => n >= 2500 && n <= 2600);
                    rawJson.data.labels = looksLikeYears
                        ? nums.map(n => `ปี ${n}`)
                        : nums.map(String);
                } else if (labelsMissing && dataLen > 0) {
                    // Try to recover labels from other fields
                    const recovered = rawJson.data.categories
                        || (datasets.length === 1 && Array.isArray(datasets[0].labels) ? datasets[0].labels : null)
                        || Array.from({ length: dataLen }, (_, i) => `รายการที่ ${i + 1}`);
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
                            labels: { color: 'var(--chart-muted)', padding: 14, font: { size: 11, weight: '500' }, usePointStyle: true, pointStyleWidth: 10 }
                        },
                        tooltip: {
                            ...AI_CHART_TOOLTIP_STYLE,
                            titleFont: { weight: '700', size: 12 },
                            bodyFont: { size: 11 },
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
    cleanText = stripRawStructuredAIResponseText(cleanText);

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
    } catch {
        return false;
    }
}

// `hbar` is a UI-only sentinel meaning "bar with indexAxis='y'". It maps
// back to chartType='bar' when handed to Chart.js.
const LIGHT_CHART_PALETTE = ['var(--accent-blue)', 'var(--accent-success)', 'var(--accent-orange)', 'var(--accent-purple)', 'var(--accent-danger)', 'var(--accent-cyan)', 'var(--accent-gold)', 'var(--accent-pink)', 'var(--accent-purple)', 'var(--accent-teal)', 'var(--accent-orange)', 'var(--text-subtle)'];
const DARK_CHART_PALETTE = ['var(--accent-blue)', 'var(--accent-success)', 'var(--accent-orange)', 'var(--accent-purple)', 'var(--accent-danger)', 'var(--accent-cyan)', 'var(--accent-gold)', 'var(--accent-pink)', 'var(--accent-purple)', 'var(--accent-teal)', 'var(--accent-orange)', 'var(--text-subtle)'];
const DEFAULT_BAR_ALPHA = 0.72;
const DEFAULT_HOVER_ALPHA = 0.88;

function getActiveChartPalette() {
    const isDark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
    return isDark ? DARK_CHART_PALETTE : LIGHT_CHART_PALETTE;
}

function parseHexColor(value) {
    const hex = String(value || '').trim().replace(/^#/, '');
    if (![3, 4, 6, 8].includes(hex.length)) return null;
    const expanded = hex.length <= 4
        ? hex.split('').map(ch => ch + ch).join('')
        : hex;
    const rgbHex = expanded.slice(0, 6);
    if (!/^[0-9a-f]{6}$/i.test(rgbHex)) return null;
    return {
        r: parseInt(rgbHex.slice(0, 2), 16),
        g: parseInt(rgbHex.slice(2, 4), 16),
        b: parseInt(rgbHex.slice(4, 6), 16),
    };
}

function parseRgbColor(value) {
    const match = String(value || '').trim().match(/rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)/i);
    if (!match) return null;
    return {
        r: Number(match[1]),
        g: Number(match[2]),
        b: Number(match[3]),
    };
}

function rgbaFromHex(hex, alpha = DEFAULT_BAR_ALPHA) {
    const rgb = parseHexColor(hex);
    if (!rgb) return hex;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function isNearBlackColor(value) {
    if (!value || typeof value !== 'string') return false;
    const color = value.trim().toLowerCase();
    if (color === 'black' || color === '#000' || color === '#000000' || color === '#000000ff') return true;
    const rgb = color.startsWith('#') ? parseHexColor(color) : parseRgbColor(color);
    if (!rgb) return false;
    return rgb.r <= 18 && rgb.g <= 18 && rgb.b <= 18;
}

function safeChartColor(value, fallbackHex, alpha = DEFAULT_BAR_ALPHA) {
    if (!value || isNearBlackColor(value)) return rgbaFromHex(fallbackHex, alpha);
    return value;
}

function safeChartColorList(value, fallbackHex, alpha, count = 0) {
    const palette = getActiveChartPalette();
    if (Array.isArray(value)) {
        return value.map((color, idx) => safeChartColor(color, palette[idx % palette.length], alpha));
    }
    if (value) return safeChartColor(value, fallbackHex, alpha);
    if (count > 0) {
        return Array.from({ length: count }, (_, idx) => rgbaFromHex(palette[idx % palette.length], alpha));
    }
    return rgbaFromHex(fallbackHex, alpha);
}

function hoverChartColor(value, fallbackHex) {
    const palette = getActiveChartPalette();
    if (Array.isArray(value)) return value.map((color, idx) => hoverChartColor(color, palette[idx % palette.length]));
    const safe = safeChartColor(value, fallbackHex, DEFAULT_HOVER_ALPHA);
    if (typeof safe !== 'string') return safe;
    if (safe.startsWith('#')) return rgbaFromHex(safe, DEFAULT_HOVER_ALPHA);
    const rgb = parseRgbColor(safe);
    if (rgb) return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${DEFAULT_HOVER_ALPHA})`;
    return rgbaFromHex(fallbackHex, DEFAULT_HOVER_ALPHA);
}

function sanitizeChartDatasetColors(chart) {
    const datasets = chart?.data?.datasets;
    if (!Array.isArray(datasets)) return chart;
    const chartType = realChartType(chart.chartType || chart.type);
    const labelCount = chart?.data?.labels?.length || 0;
    const palette = getActiveChartPalette();

    datasets.forEach((ds, idx) => {
        const fallback = palette[idx % palette.length];
        const effectiveType = realChartType(ds.type || chartType);
        const isSliceChart = ['pie', 'doughnut', 'polarArea'].includes(chartType);
        const needsColorArray = isSliceChart && labelCount > 0;
        const fillAlpha = effectiveType === 'bar' || effectiveType === 'scatter' || effectiveType === 'bubble'
            ? DEFAULT_BAR_ALPHA
            : 0.28;

        ds.backgroundColor = safeChartColorList(ds.backgroundColor, fallback, fillAlpha, needsColorArray ? labelCount : 0);
        ds.borderColor = safeChartColorList(ds.borderColor, fallback, 0.95, Array.isArray(ds.backgroundColor) ? ds.backgroundColor.length : 0);

        if (effectiveType === 'bar' || isSliceChart) {
            ds.hoverBackgroundColor = hoverChartColor(ds.backgroundColor, fallback);
            ds.hoverBorderColor = safeChartColor(ds.borderColor, fallback, 0.95);
        }

        if (effectiveType === 'line' || effectiveType === 'scatter' || effectiveType === 'bubble') {
            ds.pointBackgroundColor = safeChartColor(ds.pointBackgroundColor || ds.borderColor, fallback, DEFAULT_BAR_ALPHA);
            ds.pointHoverBackgroundColor = hoverChartColor(ds.pointBackgroundColor, fallback);
            ds.pointBorderColor = safeChartColor(ds.pointBorderColor || 'var(--text-on-accent)', 'var(--text-on-accent)', 1);
        }
    });

    return chart;
}

function realChartType(uiType) {
    return uiType === 'hbar' ? 'bar' : uiType;
}

function datasetLabel(ds) {
    return String(ds?.label || '').toLowerCase();
}

function chartLabels(chart) {
    return Array.isArray(chart?.data?.labels) ? chart.data.labels : [];
}

function isTimeSeriesLabel(label) {
    const raw = String(label ?? '').trim().toLowerCase();
    if (!raw) return false;
    const s = raw.replace(/^ปี\s*/, '').replace(/^พ\.ศ\.\s*/, '').trim();
    const thaiMonths = /(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)/;

    return /^(25|20)\d{2}$/.test(s)
        || /^(25|20)\d{2}[-/]\d{1,2}([-/]\d{1,2})?$/.test(s)
        || /^\d{1,2}[-/]\d{1,2}[-/](25|20)\d{2}$/.test(s)
        || /^[1-3]\/(25|20)\d{2}$/.test(s)
        || /^(q[1-4]|ไตรมาส\s*[1-4])\s*[-/]?\s*(25|20)\d{2}$/.test(s)
        || /^(25|20)\d{2}\s*[-/]?\s*(q[1-4]|ไตรมาส\s*[1-4])$/.test(s)
        || (thaiMonths.test(s) && /(25|20)\d{2}/.test(s));
}

function isTimeSeriesChart(chart) {
    const xScaleType = chart?.options?.scales?.x?.type;
    if (xScaleType === 'time' || xScaleType === 'timeseries') return true;

    const labels = chartLabels(chart);
    if (labels.length < 2) return false;
    const hits = labels.filter(isTimeSeriesLabel).length;
    return hits === labels.length || hits >= Math.max(3, Math.ceil(labels.length * 0.8));
}

function isGpaDataset(ds) {
    return /gpa|เกรด/.test(datasetLabel(ds));
}

function isStudentCountDataset(ds) {
    const label = datasetLabel(ds);
    return /จำนวน|นักศึกษา|นิสิต|student|count|คน/.test(label) && !isGpaDataset(ds);
}

function isRateDataset(ds) {
    const label = datasetLabel(ds);
    return /(อัตรา.*สำเร็จ|อัตรา.*จบ|สำเร็จการศึกษา|graduation|grad\s*rate|rate|%|เปอร์เซ็นต์|ร้อยละ)/.test(label)
        && !isGpaDataset(ds);
}

function getStudentGpaDatasets(chart) {
    const datasets = chart?.data?.datasets || [];
    if (datasets.length < 2) return null;
    const countDs = datasets.find(isStudentCountDataset);
    const gpaDs = datasets.find(isGpaDataset);
    if (!countDs || !gpaDs) return null;
    return { countDs, gpaDs };
}

function isStudentGpaComboChart(chart) {
    return Boolean(getStudentGpaDatasets(chart));
}

function getGpaRateDatasets(chart) {
    const datasets = chart?.data?.datasets || [];
    if (datasets.length < 2) return null;
    const gpaDs = datasets.find(isGpaDataset);
    const rateDs = datasets.find(isRateDataset);
    if (!gpaDs || !rateDs) return null;
    return { gpaDs, rateDs };
}

function isGpaRateComboChart(chart) {
    return Boolean(getGpaRateDatasets(chart));
}

function resetLineOnlyProps(ds) {
    delete ds.tension;
    delete ds.fill;
    delete ds.pointRadius;
    delete ds.pointHoverRadius;
    delete ds.pointBackgroundColor;
    delete ds.pointBorderColor;
    delete ds.pointBorderWidth;
}

function normalizeStudentGpaComboChart(chart) {
    const combo = getStudentGpaDatasets(chart);
    if (!combo) return chart;

    const { countDs, gpaDs } = combo;
    const useLineForGpa = isTimeSeriesChart(chart);
    chart.chartType = 'bar';
    chart.options = chart.options || {};
    delete chart.options.indexAxis;

    countDs.type = 'bar';
    countDs.yAxisID = 'y';
    countDs.order = 2;
    countDs.backgroundColor = countDs.backgroundColor || 'color-mix(in srgb, var(--accent-success) 75%, transparent)';
    countDs.borderColor = countDs.borderColor || 'var(--accent-success)';
    countDs.borderWidth = 0;
    countDs.borderRadius = countDs.borderRadius || 8;

    gpaDs.type = useLineForGpa ? 'line' : 'bar';
    gpaDs.yAxisID = 'y1';
    gpaDs.order = 1;
    gpaDs.borderColor = gpaDs.borderColor || 'var(--accent-purple)';
    gpaDs.backgroundColor = gpaDs.backgroundColor || (useLineForGpa ? 'color-mix(in srgb, var(--accent-purple) 18%, transparent)' : 'color-mix(in srgb, var(--accent-purple) 72%, transparent)');
    if (useLineForGpa) {
        gpaDs.pointBackgroundColor = gpaDs.pointBackgroundColor || 'var(--accent-purple)';
        gpaDs.pointBorderColor = gpaDs.pointBorderColor || 'var(--text-on-accent)';
        gpaDs.pointBorderWidth = gpaDs.pointBorderWidth || 2;
        gpaDs.pointRadius = gpaDs.pointRadius || 5;
        gpaDs.pointHoverRadius = gpaDs.pointHoverRadius || 8;
        gpaDs.borderWidth = gpaDs.borderWidth || 2.5;
        gpaDs.tension = gpaDs.tension ?? 0.35;
        gpaDs.fill = false;
    } else {
        resetLineOnlyProps(gpaDs);
        gpaDs.borderWidth = 0;
        gpaDs.borderRadius = gpaDs.borderRadius || 8;
    }

    chart.options.scales = {
        ...(chart.options.scales || {}),
        y: {
            type: 'linear',
            position: 'left',
            beginAtZero: true,
            title: { display: true, text: 'จำนวนนักศึกษา (คน)' },
            ticks: { color: 'var(--chart-muted)', font: { size: 11 }, callback: v => v.toLocaleString() },
            grid: { color: 'var(--chart-grid)' },
        },
        y1: {
            type: 'linear',
            position: 'right',
            min: 0,
            max: 4,
            title: { display: true, text: 'GPA เฉลี่ย' },
            ticks: { color: 'var(--chart-muted)', font: { size: 11 }, stepSize: 1 },
            grid: { drawOnChartArea: false },
        },
    };

    return chart;
}

function normalizeGpaRateComparisonChart(chart) {
    const combo = getGpaRateDatasets(chart);
    if (!combo) return chart;

    const { gpaDs, rateDs } = combo;
    chart.chartType = 'bar';
    chart.options = chart.options || {};
    delete chart.options.indexAxis;

    rateDs.type = 'bar';
    rateDs.yAxisID = 'y';
    rateDs.order = 2;
    rateDs.backgroundColor = rateDs.backgroundColor || 'color-mix(in srgb, var(--accent-purple) 65%, transparent)';
    rateDs.borderColor = rateDs.borderColor || 'var(--accent-purple)';
    rateDs.borderWidth = 0;
    rateDs.borderRadius = rateDs.borderRadius || 8;
    resetLineOnlyProps(rateDs);

    gpaDs.type = 'bar';
    gpaDs.yAxisID = 'y1';
    gpaDs.order = 1;
    gpaDs.backgroundColor = gpaDs.backgroundColor || 'color-mix(in srgb, var(--accent-success) 72%, transparent)';
    gpaDs.borderColor = gpaDs.borderColor || 'var(--accent-success)';
    gpaDs.borderWidth = 0;
    gpaDs.borderRadius = gpaDs.borderRadius || 8;
    resetLineOnlyProps(gpaDs);

    chart.options.scales = {
        ...(chart.options.scales || {}),
        x: {
            ...(chart.options.scales?.x || {}),
            ticks: {
                ...(chart.options.scales?.x?.ticks || {}),
                color: 'var(--chart-muted)',
                font: { size: 10 },
                maxRotation: 45,
                minRotation: 25,
            },
            grid: { display: false },
        },
        y: {
            type: 'linear',
            position: 'left',
            beginAtZero: true,
            min: 0,
            max: 100,
            title: { display: true, text: 'อัตราสำเร็จการศึกษา (%)' },
            ticks: { color: 'var(--chart-muted)', font: { size: 11 }, callback: v => `${v}%` },
            grid: { color: 'var(--chart-grid)' },
        },
        y1: {
            type: 'linear',
            position: 'right',
            min: 0,
            max: 4,
            title: { display: true, text: 'GPA เฉลี่ย' },
            ticks: { color: 'var(--chart-muted)', font: { size: 11 }, stepSize: 1 },
            grid: { drawOnChartArea: false },
        },
    };

    return chart;
}

function normalizeCategoricalLineChart(chart) {
    if (!chart || isTimeSeriesChart(chart)) return chart;
    const datasets = chart.data?.datasets || [];
    const hasLineShape = chart.chartType === 'line' || datasets.some(ds => ds.type === 'line');
    if (!hasLineShape) return chart;

    if (chart.chartType === 'line') chart.chartType = 'bar';

    datasets.forEach(ds => {
        if (ds.type === 'line') delete ds.type;
        resetLineOnlyProps(ds);
        if (ds.borderRadius == null) ds.borderRadius = 8;
    });

    return chart;
}

function buildStudentGpaScatterChart(originalChart) {
    const chart = JSON.parse(JSON.stringify(originalChart || {}));
    const combo = getStudentGpaDatasets(chart);
    if (!combo) return chart;

    const labels = chart.data?.labels || [];
    const counts = labels
        .map((_, idx) => Number(combo.countDs.data?.[idx]))
        .filter(value => Number.isFinite(value) && value > 0);
    const minCount = counts.length ? Math.min(...counts) : 0;
    const maxCount = counts.length ? Math.max(...counts) : 1;
    const radiusForCount = (value) => {
        if (!Number.isFinite(value) || value <= 0) return 5;
        if (maxCount === minCount) return 9;
        const normalized = (Math.sqrt(value) - Math.sqrt(minCount)) / Math.max(1, Math.sqrt(maxCount) - Math.sqrt(minCount));
        return Math.round((6 + normalized * 10) * 10) / 10;
    };
    const points = labels.map((label, idx) => {
        const x = Number(combo.countDs.data?.[idx]);
        const y = Number(combo.gpaDs.data?.[idx]);
        return Number.isFinite(x) && Number.isFinite(y) && y > 0
            ? { x: idx + 1, y, r: radiusForCount(x), count: x, major: String(label) }
            : null;
    }).filter(Boolean);

    return {
        ...chart,
        chartType: 'bubble',
        data: {
            datasets: [{
                label: 'GPA เฉลี่ย (ขนาดจุด = จำนวนนักศึกษา)',
                data: points,
                backgroundColor: 'color-mix(in srgb, var(--accent-success) 72%, transparent)',
                borderColor: 'var(--accent-success)',
                borderWidth: 2,
                pointHoverRadius: 10,
                hoverBorderWidth: 3,
            }],
        },
        options: {
            ...(chart.options || {}),
            indexAxis: undefined,
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    min: 0.5,
                    max: Math.max(1.5, labels.length + 0.5),
                    title: { display: true, text: 'คณะ/สาขา' },
                    ticks: {
                        color: 'var(--chart-muted)',
                        font: { size: 10 },
                        stepSize: 1,
                        maxRotation: 35,
                        minRotation: 20,
                        callback: value => labels[Number(value) - 1] || '',
                    },
                    grid: { color: 'var(--chart-grid)' },
                },
                y: {
                    type: 'linear',
                    min: 2,
                    max: 4,
                    title: { display: true, text: 'GPA เฉลี่ย' },
                    ticks: { color: 'var(--chart-muted)', font: { size: 11 }, stepSize: 0.25 },
                    grid: { color: 'var(--chart-grid)' },
                },
            },
            plugins: {
                ...(chart.options?.plugins || {}),
                legend: {
                    ...(chart.options?.plugins?.legend || {}),
                    display: false,
                },
                tooltip: {
                    ...(chart.options?.plugins?.tooltip || {}),
                    ...AI_CHART_TOOLTIP_STYLE,
                    callbacks: {
                        label: ctx => {
                            const raw = ctx.raw || {};
                            return `${raw.major || 'สาขา'}: ${Number(raw.count || 0).toLocaleString('th-TH')} คน, GPA ${Number(raw.y || 0).toFixed(2)}`;
                        },
                    },
                },
            },
        },
    };
}

function buildGpaRateScatterChart(originalChart) {
    const chart = JSON.parse(JSON.stringify(originalChart || {}));
    const combo = getGpaRateDatasets(chart);
    if (!combo) return chart;

    const labels = chart.data?.labels || [];
    const points = labels.map((label, idx) => {
        const x = Number(combo.rateDs.data?.[idx]);
        const y = Number(combo.gpaDs.data?.[idx]);
        return Number.isFinite(x) && Number.isFinite(y)
            ? { x, y, faculty: String(label) }
            : null;
    }).filter(Boolean);

    return {
        ...chart,
        chartType: 'scatter',
        data: {
            datasets: [{
                label: 'อัตราสำเร็จการศึกษา vs GPA เฉลี่ย',
                data: points,
                backgroundColor: 'color-mix(in srgb, var(--accent-success) 72%, transparent)',
                borderColor: 'var(--accent-success)',
                pointRadius: 7,
                pointHoverRadius: 10,
            }],
        },
        options: {
            ...(chart.options || {}),
            indexAxis: undefined,
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    min: 0,
                    max: 100,
                    title: { display: true, text: 'อัตราสำเร็จการศึกษา (%)' },
                    ticks: { color: 'var(--chart-muted)', font: { size: 11 }, callback: v => `${v}%` },
                    grid: { color: 'var(--chart-grid)' },
                },
                y: {
                    type: 'linear',
                    min: 0,
                    max: 4,
                    title: { display: true, text: 'GPA เฉลี่ย' },
                    ticks: { color: 'var(--chart-muted)', font: { size: 11 } },
                    grid: { color: 'var(--chart-grid)' },
                },
            },
            plugins: {
                ...(chart.options?.plugins || {}),
                tooltip: {
                    ...(chart.options?.plugins?.tooltip || {}),
                    ...AI_CHART_TOOLTIP_STYLE,
                    callbacks: {
                        label: ctx => {
                            const raw = ctx.raw || {};
                            return `${raw.faculty || 'คณะ'}: สำเร็จ ${Number(raw.x || 0).toFixed(1)}%, GPA ${Number(raw.y || 0).toFixed(2)}`;
                        },
                    },
                },
            },
        },
    };
}

function getInitialUiChartType(chart) {
    if (!chart) return 'bar';
    if (isStudentGpaComboChart(chart) || isGpaRateComboChart(chart)) return 'bar';
    if (chart.chartType === 'bar' && chart.options?.indexAxis === 'y') return 'hbar';
    if (chart.chartType === 'line' && !isTimeSeriesChart(chart)) return 'bar';
    return chart.chartType || (isTimeSeriesChart(chart) ? 'line' : 'bar');
}

// Re-derive chart data/options when the user toggles chart type.
// Without this, leftover `indexAxis:'y'`, per-dataset `type` fields, and
// y1 axis references from the original config make the switcher a no-op.
function deriveChartConfig(originalChart, uiTargetType) {
    if (!originalChart) return originalChart;
    let targetType = realChartType(uiTargetType);
    let wantsHorizontal = uiTargetType === 'hbar';
    if (targetType === 'line' && !isTimeSeriesChart(originalChart)) {
        targetType = 'bar';
        wantsHorizontal = false;
    }
    if (isStudentGpaComboChart(originalChart)) {
        if (targetType === 'scatter' || targetType === 'bubble') return buildStudentGpaScatterChart(originalChart);
        return normalizeStudentGpaComboChart(JSON.parse(JSON.stringify(originalChart)));
    }
    if (isGpaRateComboChart(originalChart)) {
        if (targetType === 'scatter') return buildGpaRateScatterChart(originalChart);
        return normalizeGpaRateComparisonChart(JSON.parse(JSON.stringify(originalChart)));
    }
    const sourceWasHorizontal = originalChart.chartType === 'bar' && originalChart.options?.indexAxis === 'y';
    const sameShape = targetType === originalChart.chartType
        && wantsHorizontal === sourceWasHorizontal;
    if (sameShape) return originalChart;

    // Deep-clone via JSON (safe — no functions in chart data after parse).
    const data = JSON.parse(JSON.stringify(originalChart.data || {}));
    const options = JSON.parse(JSON.stringify(originalChart.options || {}));

    // Strip per-dataset `type` so all datasets inherit the parent type.
    if (Array.isArray(data.datasets)) {
        const palette = getActiveChartPalette();
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
                    ds.backgroundColor = ds.backgroundColor || palette[idx % palette.length];
                }
            } else if (targetType === 'pie' || targetType === 'doughnut' || targetType === 'polarArea') {
                // Pie/doughnut need an array of slice colors and no border radius.
                const n = ds.data?.length || 0;
                if (!Array.isArray(ds.backgroundColor)) {
                    ds.backgroundColor = Array.from({ length: n }, (_, i) => palette[i % palette.length]);
                }
                ds.borderColor = 'var(--text-on-accent)';
                ds.borderWidth = 2;
                delete ds.borderRadius;
                delete ds.tension;
            } else if (targetType === 'radar') {
                ds.borderColor = ds.borderColor || palette[idx % palette.length];
                ds.backgroundColor = (ds.borderColor || palette[idx % palette.length]) + '33';
                ds.pointBackgroundColor = ds.borderColor || palette[idx % palette.length];
                ds.pointBorderColor = 'var(--text-on-accent)';
                ds.borderWidth = 2;
                ds.pointRadius = 4;
                delete ds.borderRadius;
            }
        });
        sanitizeChartDatasetColors({ chartType: targetType, data });
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
                angleLines: { color: 'color-mix(in srgb, var(--text-subtle) 18%, transparent)' },
                grid: { color: 'color-mix(in srgb, var(--text-subtle) 18%, transparent)' },
                pointLabels: { color: 'var(--chart-muted)', font: { size: 11, weight: 'bold' } },
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
    if (uiType === 'bar' && categoryCount > 12) {
        return 380;
    }
    if (uiType === 'scatter' || uiType === 'bubble') {
        return Math.min(520, Math.max(360, categoryCount * 20 + 180));
    }
    if (uiType === 'pie' || uiType === 'doughnut' || uiType === 'radar') {
        return 380;
    }
    return 320;
}

function isCartesianChartType(chartType) {
    return ['line', 'bar', 'scatter', 'bubble'].includes(realChartType(chartType));
}

function chartZoomOptions(chart, uiType, expanded = false) {
    const chartType = realChartType(uiType || chart?.chartType);
    if (!isCartesianChartType(chartType)) {
        return {
            pan: { enabled: false },
            zoom: { wheel: { enabled: false }, pinch: { enabled: false }, drag: { enabled: false } },
            limits: {},
        };
    }

    const scaleKeys = Object.keys(chart?.options?.scales || {}).filter(k => k !== 'r');
    const boundedKeys = scaleKeys.length > 0 ? scaleKeys : ['x', 'y'];
    const limits = Object.fromEntries(boundedKeys.map(k => [k, { min: 'original', max: 'original' }]));
    const hasX = boundedKeys.includes('x');
    const hasY = boundedKeys.some(k => k === 'y' || /^y\d+$/.test(k));
    const mode = hasX && hasY ? 'xy' : hasX ? 'x' : 'y';

    return {
        pan: { enabled: true, mode, modifierKey: null },
        zoom: {
            wheel: { enabled: true, speed: expanded ? 0.05 : 0.08 },
            pinch: { enabled: true },
            drag: { enabled: false },
            mode,
        },
        limits,
    };
}

function chartOptionsForRender(chart, uiType, expanded = false) {
    if (!chart) return chart;
    const chartType = realChartType(uiType || chart.chartType);
    const data = JSON.parse(JSON.stringify(chart.data || {}));
    sanitizeChartDatasetColors({ chartType, data });
    return {
        ...chart,
        data,
        options: {
            ...(chart.options || {}),
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                ...(chart.options?.plugins || {}),
                zoom: chartZoomOptions(chart, uiType, expanded),
            },
        },
    };
}

// Pick the toggleable chart options that make sense for the data shape.
function availableChartTypes(chart) {
    if (!chart) return [];
    const dsCount = chart.data?.datasets?.length || 0;
    const catCount = chart.data?.labels?.length || chart.data?.datasets?.[0]?.data?.length || 0;
    const isPoint = chart.chartType === 'scatter' || chart.chartType === 'bubble';
    if (isPoint) return []; // scatter/bubble don't switch sensibly
    if (isStudentGpaComboChart(chart)) {
        return [
            { id: 'bar', label: isTimeSeriesChart(chart) ? 'ผสม' : 'แท่งคู่', icon: BarChart3 },
            { id: 'bubble', label: 'จุด', icon: CircleDot },
        ];
    }
    if (isGpaRateComboChart(chart)) {
        return [
            { id: 'bar', label: 'แท่งคู่', icon: BarChart3 },
            { id: 'scatter', label: 'จุด', icon: CircleDot },
        ];
    }

    const opts = [];
    if (isTimeSeriesChart(chart)) {
        opts.push({ id: 'line', label: 'เส้น', icon: TrendingUp });
    }
    opts.push(
        { id: 'bar', label: 'แท่ง', icon: BarChart3 },
        { id: 'hbar', label: 'แท่งแนวนอน', icon: BarChart2 },
    );
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

function readableChartExportTitle(chart, fallback = 'AI chart') {
    const title = chart?.options?.plugins?.title?.text;
    if (Array.isArray(title)) return title.filter(Boolean).join(' ') || fallback;
    return String(title || chart?.title || fallback).trim() || fallback;
}

// ==================== Chat Message Component ====================
export function ChatMessage({ msg, onExpand, onAskFollowUp }) {
    // UI chart type — uses 'hbar' as a virtual horizontal-bar value.
    const initialUiType = getInitialUiChartType(msg.chart);
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
            const parts = line.split(/(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*\*.*?\*\*|_.*?_|`.*?`)/g).map((part, j) => {
                const linkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
                if (linkMatch) {
                    return (
                        <a
                            key={j}
                            className="ai-page-msg-link"
                            href={linkMatch[2]}
                            target="_blank"
                            rel="noreferrer"
                        >
                            {linkMatch[1]}
                        </a>
                    );
                }
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={j}>{part.slice(2, -2)}</strong>;
                }
                if (part.startsWith('_') && part.endsWith('_')) {
                    return <em key={j} style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>{part.slice(1, -1)}</em>;
                }
                if (part.startsWith('`') && part.endsWith('`')) {
                    return <code key={j} style={{ background: 'color-mix(in srgb, var(--accent-success) 15%, transparent)', color: 'var(--accent-success)', padding: '2px 6px', borderRadius: 4, fontSize: '0.88em' }}>{part.slice(1, -1)}</code>;
                }
                return part;
            });
            return <div key={i}>{parts}</div>;
        });
    };

    const chartData = chartOptionsForRender(renderedChart, chartType);
    const chartExportTitle = readableChartExportTitle(chartData);

    // Deep clone chart for expand to prevent zoom state mutation
    const handleExpand = () => {
        const cloned = deepCloneChart(chartData);
        if (cloned) onExpand(cloned);
    };
    const handleCopy = async () => {
        try {
            await navigator.clipboard?.writeText(String(msg.text || ''));
        } catch {
            // Clipboard can be unavailable in some embedded browsers; keep the UI non-blocking.
        }
    };

    return (
        <div className="ai-page-msg ai-page-msg-bot">
            <div className="ai-page-msg-avatar"><Sparkles size={18} style={{ color: 'var(--accent-success)' }} /></div>
            <div className="ai-page-msg-content">
                <div className="ai-page-msg-bubble bot">{formatText(msg.text)}</div>
                <div className="ai-answer-action-row">
                    <button className="ai-answer-action-btn" type="button" onClick={handleCopy}>
                        <Copy size={13} /> คัดลอกคำตอบ
                    </button>
                    <button
                        className="ai-answer-action-btn"
                        type="button"
                        onClick={() => onAskFollowUp?.(String(msg.text || '').slice(0, 220))}
                    >
                        <CornerDownRight size={13} /> ถามต่อจากคำตอบนี้
                    </button>
                </div>

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
                                            aria-label={opt.label}
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
                            <button
                                className="ai-page-chart-btn"
                                onClick={() => exportChartAsCSVReport(chartExportTitle, { ...chartData, chartType })}
                                aria-label="Export chart data and graph image as one Excel workbook"
                                data-tooltip="Export Excel + รูปกราฟ"
                            >
                                <FileSpreadsheet size={13} /> Excel
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
export function generateChartFromFile(parsed, fileName) {
    if (!parsed || parsed.numericCols.length === 0) return null;

    const colors = getActiveChartPalette();
    const labels = parsed.rows.map(r => String(r[parsed.labelCol] ?? ''));
    const toNum = v => parseFloat(String(v).replace(/,/g, '')) || 0;
    const datasets = parsed.numericCols.slice(0, 6).map((col, i) => ({
        label: col,
        data: parsed.rows.map(r => toNum(r[col])),
        borderColor: colors[i % colors.length],
        backgroundColor: rgbaFromHex(colors[i % colors.length], 0.28),
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
                legend: { position: 'bottom', labels: { color: 'var(--chart-muted)', padding: 8, font: { size: 11 } } },
                title: { display: true, text: `📁 ${fileName}`, color: 'var(--text-on-accent)', font: { size: 14 } },
            },
            scales: {
                x: { ticks: { color: 'var(--chart-muted)', maxRotation: useHorizontal ? 0 : 45 }, grid: { color: 'var(--chart-grid)' } },
                y: { ticks: { color: 'var(--chart-muted)' }, grid: { color: 'var(--chart-grid)' }, beginAtZero: true },
            },
        },
    };
}

export const MAIN_AI_QUICK_ACTIONS = [
    { label: 'วิชาไหนยาก', query: 'วิชาไหนยากที่สุดในคณะวิทยาศาสตร์ จากข้อมูลเกรดที่เว็บมีอยู่ตอนนี้', icon: GraduationCap, group: 'analysis', requiredSections: ['course_analytics'] },
    { label: 'วิชาเกรดดี', query: 'วิชาไหนเกรดเฉลี่ยดีหรือดูง่ายที่สุดจากข้อมูลรายวิชาในระบบ', icon: BarChart3, group: 'analysis', requiredSections: ['course_analytics'] },
    { label: 'เกียรตินิยม', query: 'เกียรตินิยมต้องทำยังไงสำหรับนักศึกษาคณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้', icon: GraduationCap, group: 'student', requiredSections: ['academic_rules'] },
    { label: 'สมัคร TCAS', query: 'TCAS สมัครเรียนมหาวิทยาลัยแม่โจ้ต้องทำยังไง และดูประกาศล่าสุดจากที่ไหน', icon: FileSpreadsheet, group: 'planning' },
    { label: 'กิจกรรมเดือนนี้', query: 'กิจกรรมคณะวิทยาศาสตร์เดือนนี้มีอะไรบ้าง และชั่วโมงกิจกรรมเหลือเท่าไหร่', icon: Sparkles, group: 'student', requiredSections: ['student_life'] },
    { label: 'แผนรับ TCAS 5 ปี', query: 'สรุปแผนรับ TCAS คณะวิทยาศาสตร์ย้อนหลัง 5 ปี พร้อมแนวโน้มและรอบ 3 ปี 2569', icon: FileSpreadsheet, group: 'planning', requiredSections: ['tcas_admissions'] },
    { label: 'กราฟเกรดรายวิชา', query: 'สร้างกราฟการกระจายเกรดรายวิชา SCI331 และสรุป GPA เฉลี่ยรายวิชา', icon: BarChart3, group: 'analysis', requiredSections: ['course_analytics'] },
    { label: 'จำนวน+GPA ตามสาขา', query: 'สร้างกราฟจำนวนนักศึกษาและ GPA เฉลี่ย คณะวิทยาศาสตร์ แยกตามสาขา', icon: BarChart3, group: 'student', requiredSections: ['student_stats'] },
    { label: 'นักศึกษาแยกชั้นปี', query: 'สร้างกราฟจำนวนนักศึกษาคณะวิทยาศาสตร์ แยกตามชั้นปี', icon: TrendingUp, group: 'student', requiredSections: ['student_stats'] },
    { label: 'GPA สูงสุด 10 คน', query: 'แสดงรายชื่อนักศึกษาที่ GPA สูงสุด 10 คน', icon: Search, group: 'lookup', requiredSections: ['student_list'] },
    { label: 'GPA ต่ำ/รอพินิจ', query: 'แสดงรายชื่อนักศึกษาที่เกรดต่ำหรือรอพินิจ 10 คน', icon: Search, group: 'lookup', requiredSections: ['student_list'] },
    { label: 'พยากรณ์ GPA+สำเร็จ', query: 'พยากรณ์อัตราสำเร็จการศึกษาและ GPA เฉลี่ยคณะวิทยาศาสตร์ ปี 2570 2571 เป็นกราฟ', icon: Sparkles, group: 'forecast', requiredSections: ['student_stats', 'graduation_stats'] },
    { label: 'พยากรณ์รายรับคณะวิทย์', query: 'พยากรณ์รายรับงบประมาณคณะวิทยาศาสตร์ ปี 2570 2571 เป็นกราฟ', icon: ChartLine, group: 'forecast', requiredSections: ['budget_forecast'] },
];

const ROLE_DISPLAY = {
    dean: 'คณบดี',
    executive: 'ผู้บริหาร',
    chair: 'ประธานหลักสูตร',
    instructor: 'อาจารย์',
    staff: 'เจ้าหน้าที่',
    student: 'นักศึกษา',
    general: 'ผู้ใช้ทั่วไป',
    admin: 'ผู้ดูแลระบบ',
};

const QUICK_ACTION_GROUPS = [
    { id: 'student', title: 'วิเคราะห์นักศึกษา', desc: 'จำนวน, GPA, ชั้นปี', icon: GraduationCap, color: 'var(--accent-blue)' },
    { id: 'lookup', title: 'ค้นหา/เฝ้าระวัง', desc: 'รายชื่อและกลุ่มเสี่ยง', icon: Search, color: 'var(--accent-purple)' },
    { id: 'forecast', title: 'พยากรณ์', desc: 'แนวโน้มและกราฟ', icon: ChartLine, color: 'var(--accent-teal)' },
    { id: 'planning', title: 'แผนและรับสมัคร', desc: 'TCAS / แผนรับ', icon: FileSpreadsheet, color: 'var(--accent-orange)' },
    { id: 'analysis', title: 'วิเคราะห์เชิงลึก', desc: 'รายวิชาและไฟล์', icon: BarChart3, color: 'var(--accent-rose)' },
];

const DECISION_PROMPTS = [
    { label: 'สาขาไหนมีนักศึกษาลดลงมากที่สุด และควรทำอะไรต่อ', query: 'สาขาไหนมีนักศึกษาลดลงมากที่สุด และควรทำอะไรต่อ', requiredSections: ['student_stats'] },
    { label: 'นักศึกษากลุ่มเสี่ยง GPA ต่ำกว่า 2.00 มีแนวโน้มอย่างไร', query: 'นักศึกษากลุ่มเสี่ยง GPA ต่ำกว่า 2.00 มีแนวโน้มอย่างไร', requiredSections: ['student_stats'] },
    { label: 'TCAS ปี 2569 สาขาไหนควรเพิ่มหรือลดแผนรับ', query: 'TCAS ปี 2569 สาขาไหนควรเพิ่มหรือลดแผนรับ', requiredSections: ['tcas_admissions'] },
    { label: 'งบประมาณคณะวิทย์ปี 2570 ควรระวังจุดไหน', query: 'งบประมาณคณะวิทย์ปี 2570 ควรระวังจุดไหน', requiredSections: ['budget_forecast'] },
];

const SUGGESTED_PROMPTS = [
    { label: 'วิชาไหนยาก', query: 'วิชาไหนยากที่สุดในคณะวิทยาศาสตร์ จากข้อมูลเกรดที่เว็บมีอยู่ตอนนี้', requiredSections: ['course_analytics'] },
    { label: 'วิชาไหนเกรดดี', query: 'วิชาไหนเกรดเฉลี่ยดีหรือดูง่ายที่สุดจากข้อมูลรายวิชาในระบบ', requiredSections: ['course_analytics'] },
    { label: 'เกียรตินิยมต้องทำยังไง', query: 'เกียรตินิยมต้องทำยังไงสำหรับนักศึกษาคณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้', requiredSections: ['academic_rules'] },
    { label: 'TCAS สมัครยังไง', query: 'TCAS สมัครเรียนมหาวิทยาลัยแม่โจ้ต้องทำยังไง และดูประกาศล่าสุดจากที่ไหน' },
    { label: 'กิจกรรมเดือนนี้', query: 'กิจกรรมคณะวิทยาศาสตร์เดือนนี้มีอะไรบ้าง และชั่วโมงกิจกรรมเหลือเท่าไหร่', requiredSections: ['student_life'] },
    { label: 'แม่โจ้อยู่ที่ไหน', query: 'มหาวิทยาลัยแม่โจ้อยู่ที่ไหน ติดต่อได้ทางไหน' },
    { label: 'สร้างกราฟจำนวนนักศึกษาและเกรด', query: 'สร้างกราฟจำนวนนักศึกษาและเกรด', requiredSections: ['student_stats'] },
    { label: 'แม่โจ้มีกี่คณะ แต่ละคณะมีสาขาอะไร', query: 'แม่โจ้มีกี่คณะ แต่ละคณะมีสาขาอะไร' },
    { label: 'การรับสมัคร TCAS มีกี่รอบ', query: 'การรับสมัคร TCAS มีกี่รอบ', requiredSections: ['tcas_admissions'] },
    { label: 'พยากรณ์งบประมาณคณะวิทย์ ปี 70 71', query: 'พยากรณ์งบประมาณคณะวิทย์ ปี 70 71', requiredSections: ['budget_forecast'] },
    { label: 'แสดงนักศึกษาสาขาคอม ชั้นปี 3', query: 'แสดงนักศึกษาสาขาคอม ชั้นปี 3', requiredSections: ['student_list'] },
    { label: 'ค่าเทอมแม่โจ้เท่าไหร่', query: 'ค่าเทอมแม่โจ้เท่าไหร่', requiredSections: ['tuition'] },
    { label: 'นักศึกษาที่มี GPA สูงสุด 10 คน', query: 'นักศึกษาที่มี GPA สูงสุด 10 คน', requiredSections: ['student_list'] },
    { label: 'แม่โจ้อยู่ที่ไหน เดินทางยังไง', query: 'แม่โจ้อยู่ที่ไหน เดินทางยังไง' },
];

function FileIntelligenceSummary({ fileData, onAsk, disabled = false }) {
    if (!fileData) return null;
    const readiness = fileData.analysisReadiness || {};
    const missingPercent = fileData.missingValues?.percent ?? readiness.missingPercent ?? 0;
    const typeCounts = fileData.columnTypeCounts || {};
    const topColumns = (fileData.columnProfiles || []).slice(0, 6);
    const suggestions = (fileData.suggestedQuestions || []).slice(0, 3);
    const charts = (fileData.recommendedCharts || []).slice(0, 2);
    const readinessState = readiness.status || 'partial';

    return (
        <section className={`ai-file-intelligence-card ${readinessState}`} aria-label="File intelligence summary">
            <div className="ai-file-intelligence-head">
                <div>
                    <span>File Intelligence</span>
                    <strong>{readiness.label || 'Ready for analysis'}</strong>
                </div>
                <b>{readiness.score ?? 0}/100</b>
            </div>
            <div className="ai-file-intelligence-metrics">
                <div><span>Rows</span><strong>{Number(fileData.rowCount || 0).toLocaleString('th-TH')}</strong></div>
                <div><span>Columns</span><strong>{(fileData.headers || []).length}</strong></div>
                <div><span>Numeric</span><strong>{(fileData.numericCols || []).length}</strong></div>
                <div><span>Missing</span><strong>{missingPercent}%</strong></div>
            </div>
            <div className="ai-file-intelligence-types">
                {Object.entries(typeCounts).slice(0, 5).map(([type, count]) => (
                    <span key={type}>{type}: {count}</span>
                ))}
                {fileData.truncated && <span className="warn">truncated</span>}
            </div>
            {topColumns.length > 0 && (
                <div className="ai-file-column-profile">
                    {topColumns.map(column => (
                        <div key={column.name}>
                            <strong>{column.name}</strong>
                            <span>{column.type} • missing {column.missingPercent}% • unique {column.uniqueCount}</span>
                        </div>
                    ))}
                </div>
            )}
            {(charts.length > 0 || suggestions.length > 0) && (
                <div className="ai-file-suggestion-row">
                    {charts.map(chart => (
                        <button
                            key={chart.label}
                            type="button"
                            onClick={() => onAsk?.(`สร้างกราฟ ${chart.label}`)}
                            disabled={disabled}
                        >
                            <BarChart3 size={13} /> {chart.label}
                        </button>
                    ))}
                    {suggestions.map(question => (
                        <button
                            key={question}
                            type="button"
                            onClick={() => onAsk?.(question)}
                            disabled={disabled}
                        >
                            <Search size={13} /> {question}
                        </button>
                    ))}
                </div>
            )}
        </section>
    );
}

export default function AIChatPage() {
    const { user } = useAuth();
    const { theme } = useTheme();
    const [expandedChart, setExpandedChart] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);
    const fileInputRef = useRef(null);
    const [uploadedFileData, setUploadedFileData] = useState(null);
    const [, setStudentDataVersion] = useState(0);
    // Chat history state
    const [historyOpen, setHistoryOpen] = useState(false);
    const [sessions, setSessions] = useState([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [deletingAllHistory, setDeletingAllHistory] = useState(false);
    const [quickMenuOpen, setQuickMenuOpen] = useState(false);
    const [systemInfoOpen, setSystemInfoOpen] = useState(false);
    const [aiRuntimeStatus, setAiRuntimeStatus] = useState(() => getAIModelRuntimeStatus());
    const [tokenBudget, setTokenBudget] = useState(() => getAITokenBudgetSnapshot());
    const [lastAIMetadata, setLastAIMetadata] = useState(null);
    const sessionIdRef = useRef(null);
    const saveTimerRef = useRef(null);
    const lastSavedRef = useRef(null);
    // Dashboard summary data for merge context
    const dashboardMergeSummary = {
        name: 'ข้อมูล Dashboard',
        ...buildLiveDashboardMergeSummary(),
    };
    const allStudentsForStatus = getAllStudents();
    const roleLabel = ROLE_DISPLAY[user?.role] || user?.role || 'ยังไม่ระบุ';
    const liveSourceLabel = isLiveData() ? 'Firestore live' : 'ข้อมูลในระบบ';
    const dashboardDatasetCount = Array.isArray(dashboardMergeSummary.rows) ? dashboardMergeSummary.rows.length : 0;
    const uploadedFileLabel = uploadedFileData
        ? `${uploadedFileData.rowCount.toLocaleString('th-TH')} แถว`
        : 'ยังไม่มีไฟล์แนบ';
    const tokenBudgetReady = tokenBudget.isServerBacked || tokenBudget.status === 'ready';
    const tokenBudgetLabel = tokenBudgetReady
        ? `${tokenBudget.remainingPercent}%`
        : 'sync';
    const roleTermCoverage = getRoleTermCoverage();
    const roleTermReadinessValue = roleTermCoverage.ready
        ? `${roleTermCoverage.count} roles`
        : `missing ${roleTermCoverage.missingRoles.join(', ')}`;
    const selectedDatasetLabel = lastAIMetadata?.selectedDatasets?.length
        ? lastAIMetadata.selectedDatasets.slice(0, 3).join(', ')
        : 'Auto';
    const selectedDatasetDetail = lastAIMetadata
        ? `${lastAIMetadata.sourceCount || 0} context • ${lastAIMetadata.latencyMs || 0}ms`
        : 'รอคำถามล่าสุด';
    const aiStatusCards = [
        { icon: Database, label: 'ข้อมูลนักศึกษา', value: allStudentsForStatus.length.toLocaleString('th-TH'), detail: liveSourceLabel, color: 'var(--accent-teal)' },
        { icon: Layers3, label: 'ชุดข้อมูล Dashboard', value: dashboardDatasetCount.toLocaleString('th-TH'), detail: 'อ่านเฉพาะเรื่องที่ถาม', color: 'var(--accent-blue)' },
        { icon: ShieldCheck, label: 'สิทธิ์คำตอบ', value: roleLabel, detail: 'อิงตาม role ในระบบ', color: 'var(--accent-purple)' },
        { icon: Gauge, label: 'AI Context', value: selectedDatasetLabel, detail: selectedDatasetDetail, color: 'var(--accent-cyan)' },
        { icon: FileSpreadsheet, label: 'ไฟล์วิเคราะห์', value: uploadedFileLabel, detail: uploadedFileData ? 'พร้อมนำไปรวมบริบท' : 'CSV / Excel', color: 'var(--accent-orange)' },
        { icon: Bot, label: 'Model ล่าสุด', value: aiRuntimeStatus.lastModelLabel, detail: aiRuntimeStatus.mode === 'auto' ? 'ต่ำไปสูงอัตโนมัติ' : 'manual override', color: 'var(--accent-purple)' },
        { icon: Gauge, label: 'Token คงเหลือ', value: tokenBudgetLabel, detail: tokenBudgetReady ? `${tokenBudget.remainingTokens.toLocaleString('th-TH')} tokens` : 'กำลังซิงก์ server', color: 'var(--accent-cyan)' },
    ];
    const answerVerification = lastAIMetadata?.answerVerification;
    const contextSlimming = lastAIMetadata?.contextSlimming || {};
    const verificationState = answerVerification?.status === 'warning' ? 'warn' : (answerVerification?.status ? 'ready' : 'idle');
    const observabilityRows = [
        { label: 'Intent', value: lastAIMetadata?.intent || 'waiting', detail: lastAIMetadata?.chartRequest ? 'chart request' : 'question router', state: lastAIMetadata ? 'ready' : 'idle' },
        { label: 'Datasets', value: selectedDatasetLabel, detail: selectedDatasetDetail, state: lastAIMetadata ? 'ready' : 'idle' },
        { label: 'Denied', value: lastAIMetadata?.deniedDatasets?.length ? lastAIMetadata.deniedDatasets.slice(0, 3).join(', ') : 'none', detail: 'role policy', state: lastAIMetadata?.deniedDatasets?.length ? 'warn' : 'ready' },
        { label: 'Verification', value: answerVerification?.status || 'waiting', detail: answerVerification?.warningCount ? `${answerVerification.warningCount} warning` : `${answerVerification?.answerNumberCount || 0} numbers`, state: verificationState },
        { label: 'Context budget', value: contextSlimming.usedChars ? `${contextSlimming.usedChars.toLocaleString('th-TH')} chars` : 'waiting', detail: contextSlimming.originalChars ? `from ${contextSlimming.originalChars.toLocaleString('th-TH')}` : 'selected per intent', state: contextSlimming.trimmedContextCount ? 'warn' : (lastAIMetadata ? 'ready' : 'idle') },
        { label: 'Token estimate', value: lastAIMetadata?.tokenEstimate ? lastAIMetadata.tokenEstimate.toLocaleString('th-TH') : '-', detail: lastAIMetadata?.providerTokens ? `provider ${lastAIMetadata.providerTokens.toLocaleString('th-TH')}` : 'estimated', state: lastAIMetadata ? 'ready' : 'idle' },
        { label: 'Latency', value: lastAIMetadata?.latencyMs ? `${lastAIMetadata.latencyMs}ms` : '-', detail: lastAIMetadata?.cached ? 'cache hit' : 'fresh response', state: lastAIMetadata ? 'ready' : 'idle' },
        { label: 'Model route', value: lastAIMetadata?.modelName || aiRuntimeStatus.lastModelLabel, detail: lastAIMetadata?.useSearch ? 'trusted web fallback' : 'local-first', state: 'ready' },
    ];
    const contextSources = [
        { label: 'Student records', value: `${allStudentsForStatus.length.toLocaleString('th-TH')} คน`, state: isLiveData() ? 'live' : 'ready' },
        { label: 'Dashboard datasets', value: `${dashboardDatasetCount.toLocaleString('th-TH')} ชุด`, state: 'ready' },
        { label: 'Forecast engine', value: 'Linear + AI', state: 'ready' },
        { label: 'Uploaded file', value: uploadedFileData ? uploadedFileLabel : 'ไม่มี', state: uploadedFileData ? 'ready' : 'idle' },
        { label: 'RAG mode', value: aiRuntimeStatus.contextMode, state: 'ready' },
        { label: 'Theme-aware charts', value: theme === 'dark' ? 'Dark palette' : 'Light palette', state: 'ready' },
        { label: 'Excel + graph export', value: 'Workbook + images', state: 'ready' },
        { label: 'AI selected context', value: selectedDatasetLabel, state: lastAIMetadata ? 'ready' : 'idle' },
    ];
    const systemReadiness = [
        { label: 'Role term Start/End', value: roleTermReadinessValue, state: roleTermCoverage.ready ? 'ready' : 'warn' },
        { label: 'Alert filters', value: 'severity/domain/source/search', state: 'ready' },
        { label: 'Model escalation', value: 'ต่ำไปสูง + quality check', state: 'ready' },
        { label: 'Token + model', value: aiRuntimeStatus.lastModelLabel, state: 'ready' },
        { label: 'RAG', value: aiRuntimeStatus.contextMode, state: 'ready' },
        { label: 'Theme charts', value: theme === 'dark' ? 'dark mode' : 'light mode', state: 'ready' },
        { label: 'Export Excel+graph', value: 'Excel report + chart image', state: 'ready' },
    ];
    const quickActionGroups = QUICK_ACTION_GROUPS
        .map(group => ({
            ...group,
            actions: MAIN_AI_QUICK_ACTIONS.filter(action => action.group === group.id && canAIUseAction(user, action)),
        }))
        .filter(group => group.actions.length > 0);
    const decisionPrompts = DECISION_PROMPTS.filter(prompt => canAIUseAction(user, prompt));
    const suggestedPrompts = SUGGESTED_PROMPTS.filter(prompt => canAIUseAction(user, prompt));
    const featuredQuickActions = [
        { label: 'วิเคราะห์นักศึกษา', query: 'วิเคราะห์ภาพรวมนักศึกษาคณะวิทยาศาสตร์จากข้อมูลล่าสุด', icon: GraduationCap, requiredSections: ['student_stats'] },
        { label: 'สร้างกราฟ', query: 'สร้างกราฟจำนวนนักศึกษาและเกรด', icon: BarChart3, requiredSections: ['student_stats'] },
        { label: 'พยากรณ์', query: 'พยากรณ์งบประมาณคณะวิทย์ ปี 70 71', icon: ChartLine, requiredSections: ['budget_forecast'] },
        { label: 'ค้นหาข้อมูล', query: 'นักศึกษาที่มี GPA สูงสุด 10 คน', icon: Search, requiredSections: ['student_list'] },
    ].filter(action => canAIUseAction(user, action));
    const [messages, setMessages] = useState([
        {
            role: 'bot',
            text: `สวัสดีครับ ผม **${AI_ASSISTANT_NAME}**\n\nผู้ช่วยของ **${APP_NAME_TH}** พร้อมช่วยตอบคำถามและวิเคราะห์ข้อมูลของคณะวิทยาศาสตร์ครับ\n\n**ฟีเจอร์ทั้งหมด:**\n• ถาม-ตอบทุกเรื่องแม่โจ้ (ประวัติ, คณะ, หลักสูตร, รับสมัคร, สถานที่, วิจัย)\n• สร้างกราฟจำนวนนักศึกษา, เกรด, งบประมาณ และพยากรณ์\n• ค้นหานักศึกษาตามรหัส, ชื่อ, สาขา, GPA\n• สั่งงานด้วยเสียง\n• **อัปโหลดไฟล์ CSV / Excel (.xlsx)** เพื่อวิเคราะห์และสร้างกราฟ\n\nเลือก Quick Action ด้านล่าง หรือพิมพ์คำถามได้เลยครับ`,
            chart: null
        }
    ]);
    const [input, setInput] = useState('');
    const [typing, setTyping] = useState(false);
    const [thinkingStepIndex, setThinkingStepIndex] = useState(0);
    const messagesEnd = useRef(null);
    const sendAI = useCallback(async (prompt, onChunk, sendOptions = {}) => {
        const { onMetadata, ...restOptions } = sendOptions;
        return sendMessageToGemini(prompt, {
            user,
            theme,
            aiSettings: getAIModelSettings(),
            onChunk,
            ...restOptions,
            onMetadata: (meta) => {
                setLastAIMetadata(meta);
                onMetadata?.(meta);
            },
        });
    }, [user, theme]);

    // ── Ensure the live student dataset is loaded before the user can chat ──
    // Layout already calls this on mount, but if the user lands directly on
    // /dashboard/ai-chat we trigger it here too so the very first AI request
    // sees real Firestore data instead of the mock fallback.
    useEffect(() => {
        ensureStudentList();
        return onStudentDataChange(() => setStudentDataVersion(v => v + 1));
    }, []);

    useEffect(() => {
        const refreshRuntime = () => {
            setAiRuntimeStatus(getAIModelRuntimeStatus());
            setTokenBudget(getAITokenBudgetSnapshot());
        };
        refreshRuntime();
        refreshAITokenBudgetSnapshot()
            .then(setTokenBudget)
            .catch(() => setTokenBudget(getAITokenBudgetSnapshot()));
        window.addEventListener('sci-ai-token-stats-updated', refreshRuntime);
        window.addEventListener('sci-ai-usage-updated', refreshRuntime);
        return () => {
            window.removeEventListener('sci-ai-token-stats-updated', refreshRuntime);
            window.removeEventListener('sci-ai-usage-updated', refreshRuntime);
        };
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
        const hasUserMessage = messages.some(m => m.role === 'user');
        if (!hasUserMessage && !typing) return;
        messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, typing]);

    useEffect(() => {
        if (!typing) {
            setThinkingStepIndex(0);
            return undefined;
        }
        const timer = setInterval(() => {
            setThinkingStepIndex(prev => (prev + 1) % AI_THINKING_STEPS.length);
        }, 1400);
        return () => clearInterval(timer);
    }, [typing]);

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

    const handleDeleteAllSessions = useCallback(async () => {
        if (!canPersist || !user?.uid || deletingAllHistory || sessions.length === 0) return;
        if (!confirm(`ลบประวัติการสนทนาทั้งหมด ${sessions.length} รายการถาวร?`)) return;

        setDeletingAllHistory(true);
        try {
            await deleteAllUserSessions(user.uid);
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
                saveTimerRef.current = null;
            }
            resetConversation();
            _uploadedStudentRows = [];
            setUploadedFileData(null);
            sessionIdRef.current = null;
            lastSavedRef.current = null;
            setSessions([]);
            setMessages([{
                role: 'bot',
                text: '**ลบประวัติการสนทนาทั้งหมดแล้ว**\n\nเริ่มถามคำถามใหม่ได้เลยครับ',
                chart: null
            }]);
        } catch (err) {
            console.warn('[chatHistory] delete all failed:', err?.message || err);
            alert('ลบประวัติทั้งหมดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        } finally {
            setDeletingAllHistory(false);
        }
    }, [canPersist, deletingAllHistory, sessions.length, user?.uid]);

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
            const parsedBase = (ext === 'xlsx' || ext === 'xls')
                ? await parseXLSXContent(await file.arrayBuffer())
                : parseCSVContent(await file.text());
            const parsed = parsedBase ? { ...parsedBase, fileName } : null;

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
            summaryText += `**คอลัมน์ตัวเลข:** ${parsed.numericCols.join(', ') || 'ไม่พบ'}\n`;
            summaryText += `**Schema:** ${parsed.schemaSummary || '-'}\n`;
            summaryText += `**Missing values:** ${parsed.missingValues?.total ?? 0} ช่องว่าง\n`;
            if (parsed.analysisReadiness) {
                summaryText += `**File readiness:** ${parsed.analysisReadiness.label} (${parsed.analysisReadiness.score}/100)\n`;
            }
            if (parsed.recommendedCharts?.length) {
                summaryText += `**Recommended charts:** ${parsed.recommendedCharts.map(item => item.label).join(' | ')}\n`;
            }
            if (parsed.qualityWarnings?.length) {
                summaryText += `**Data quality:** ${parsed.qualityWarnings.join(' | ')}\n`;
            }
            if (parsed.suggestedQuestions?.length) {
                summaryText += `**คำถามแนะนำจากไฟล์:**\n${parsed.suggestedQuestions.map(item => `• ${item}`).join('\n')}\n`;
            }
            summaryText += '\n';

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
            const aiPrompt = `ผู้ใช้อัปโหลดไฟล์ "${fileName}" และต้องการวิเคราะห์แบบ decision intelligence\n\n${formatUploadedFileContextForAI(parsed)}\n\nช่วยสรุป insight สำคัญ ความเสี่ยง/ข้อจำกัดของข้อมูล และข้อเสนอแนะที่อิงจาก schema/aggregate ของไฟล์เท่านั้น`;

            try {
                const aiText = await sendAI(aiPrompt, undefined, { disableCache: isExecutiveRecommendationIntent(aiPrompt) });
                const parsedAI = parseAIResponse(aiText, aiPrompt);
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

    const createAIStreamUpdater = useCallback((sourceQuestion) => {
        const streamId = `ai_stream_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        const renderStream = (fullText, isFinal = false) => {
            const parsedAI = parseAIResponse(fullText || '', sourceQuestion);
            const nextMessage = {
                role: 'bot',
                text: parsedAI.text || 'กำลังเรียบเรียงคำตอบจากข้อมูลที่เกี่ยวข้อง...',
                chart: parsedAI.chart,
                streaming: !isFinal,
                _streamId: streamId,
            };

            setMessages(prev => {
                const exists = prev.some(m => m._streamId === streamId);
                if (!exists) return [...prev, nextMessage];
                return prev.map(m => (m._streamId === streamId ? { ...m, ...nextMessage } : m));
            });
        };

        return {
            update(fullText, meta = {}) {
                if (meta.reset) {
                    setMessages(prev => prev.filter(m => m._streamId !== streamId));
                    return;
                }
                renderStream(fullText, false);
            },
            finalize(fullText) {
                renderStream(fullText, true);
            },
            remove() {
                setMessages(prev => prev.filter(m => m._streamId !== streamId));
            },
        };
    }, []);

    // Robust auto-retry with live countdown for quota errors
    const retryWithCountdown = async (buildMessage, retryId, sourceQuestion = '') => {
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
                const aiText = await sendAI(buildMessage(), undefined, { disableCache: isExecutiveRecommendationIntent(sourceQuestion) });
                const parsedAI = parseAIResponse(aiText, sourceQuestion);
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

        let stream = null;
        const adviceMode = isExecutiveRecommendationIntent(userMsg);
        try {
            // Try local response first (forecast, student search)
            const localResult = adviceMode ? null : tryLocalResponse(userMsg, user);
            if (localResult) {
                setMessages(prev => [...prev, { role: 'bot', text: localResult.text, chart: localResult.chart }]);
                setTyping(false);
                return;
            }
            const buildMsg = () => buildAIChatPrompt(userMsg, uploadedFileData, dashboardMergeSummary, user);
            stream = createAIStreamUpdater(userMsg);
            const aiText = await sendAI(buildMsg(), stream.update, { disableCache: adviceMode });
            stream.finalize(aiText);
        } catch (error) {
            stream?.remove();
            console.error('[AIChatPage] Gemini API error:', error);
            const errMsg = error.message || 'ไม่ทราบสาเหตุ';
            const isQuota = /รอ|quota|API ถูกใช้งาน|QUOTA/.test(errMsg);
            if (isQuota) {
                const retryId = `retry_${Date.now()}`;
                setMessages(prev => [...prev, {
                    role: 'bot', text: '**API ถูกใช้งานบ่อยเกินไป** — กำลังเตรียมลองใหม่...', chart: null, _retryId: retryId
                }]);
                const buildMsg = () => buildAIChatPrompt(userMsg, uploadedFileData, dashboardMergeSummary, user);
                await retryWithCountdown(buildMsg, retryId, userMsg);
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

    const handleQuickAction = async (query) => {
        if (typing) return;
        setMessages(prev => [...prev, { role: 'user', text: query }]);
        setTyping(true);
        let stream = null;
        const adviceMode = isExecutiveRecommendationIntent(query);
        try {
            // Try local response first (forecast, student search)
            const localResult = adviceMode ? null : tryLocalResponse(query, user);
            if (localResult) {
                setMessages(prev => [...prev, { role: 'bot', text: localResult.text, chart: localResult.chart }]);
                setTyping(false);
                return;
            }
            stream = createAIStreamUpdater(query);
            const aiText = await sendAI(buildAIChatPrompt(query, uploadedFileData, dashboardMergeSummary, user), stream.update, { disableCache: adviceMode });
            stream.finalize(aiText);
        } catch (error) {
            stream?.remove();
            console.error('[AIChatPage] Quick action error:', error);
            const errMsg = error.message || '';
            const isQuota = /รอ|quota|API ถูกใช้งาน|QUOTA/.test(errMsg);
            if (isQuota) {
                const retryId = `retry_${Date.now()}`;
                setMessages(prev => [...prev, {
                    role: 'bot', text: '**API ถูกใช้งานบ่อยเกินไป** — กำลังเตรียมลองใหม่...', chart: null, _retryId: retryId
                }]);
                await retryWithCountdown(() => buildAIChatPrompt(query, uploadedFileData, dashboardMergeSummary, user), retryId, query);
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
        { icon: Bot, title: 'ถาม-ตอบ AI', desc: 'ตอบทุกเรื่องแม่โจ้: ประวัติ, คณะ, หลักสูตร, รับสมัคร, วิจัย', color: 'var(--accent-success)', gradient: 'linear-gradient(135deg, var(--accent-success) 0%, var(--accent-success) 100%)' },
        { icon: ChartLine, title: 'พยากรณ์ข้อมูล', desc: 'สร้างกราฟพยากรณ์งบประมาณ/จำนวนนิสิต', color: 'var(--accent-cyan)', gradient: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-cyan) 100%)' },
        { icon: Search, title: 'ค้นหานักศึกษา', desc: 'ค้นหาตามรหัส, ชื่อ, สาขา, ชั้นปี, GPA', color: 'var(--accent-purple)', gradient: 'linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-purple) 100%)' },
        { icon: Paperclip, title: 'อัปโหลดไฟล์', desc: 'แนบ CSV/Excel (.xlsx) เพื่อวิเคราะห์และสร้างกราฟอัตโนมัติ', color: 'var(--accent-warning)', gradient: 'linear-gradient(135deg, var(--accent-warning) 0%, var(--accent-orange) 100%)' },
        { icon: AudioLines, title: 'สั่งงานด้วยเสียง', desc: 'กดปุ่มไมค์แล้วพูดคำสั่งเป็นภาษาไทย', color: 'var(--accent-pink)', gradient: 'linear-gradient(135deg, var(--accent-pink) 0%, var(--accent-pink) 100%)' },
        { icon: Maximize2, title: 'ขยาย/ซูมกราฟ', desc: 'คลิก "ขยาย" เพื่อดูกราฟเต็มจอพร้อมซูม', color: 'var(--accent-danger)', gradient: 'linear-gradient(135deg, var(--accent-danger) 0%, var(--accent-rose) 100%)' },
    ];

    const handleQuickMenuAction = (query) => {
        setQuickMenuOpen(false);
        handleQuickAction(query);
    };

    const renderChatInput = (variant = 'default') => {
        const isMinimal = variant === 'minimal';
        return (
            <div className={`ai-chat-page-input-wrapper ${isMinimal ? 'minimal' : 'standard'}`}>
                {uploadedFileData && (
                    <div className="ai-chat-file-pill">
                        <FileSpreadsheet size={14} />
                        <span>ไฟล์ที่โหลด: {uploadedFileData.rowCount} แถว × {uploadedFileData.headers.length} คอลัมน์ — ถามคำถามเกี่ยวกับข้อมูลนี้ได้เลย</span>
                        <button
                            type="button"
                            onClick={() => setUploadedFileData(null)}
                            aria-label="ล้างไฟล์ที่อัปโหลด"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}
                {uploadedFileData && !isMinimal && (
                    <FileIntelligenceSummary
                        fileData={uploadedFileData}
                        onAsk={handleQuickAction}
                        disabled={typing}
                    />
                )}
                <div className={`ai-chat-page-input-area ${isMinimal ? 'minimal' : ''}`}>
                    <button
                        className={`ai-chat-tool-btn ai-chat-tool-btn-upload ${uploadedFileData ? 'has-file' : ''}`}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={typing}
                        aria-label="อัปโหลดไฟล์ CSV/Excel เพื่อวิเคราะห์"
                        data-tooltip="อัปโหลดไฟล์"
                    >
                        <Paperclip size={18} />
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
                        placeholder={isListening ? "กำลังฟัง..." : "ถามข้อมูลคณะ สร้างกราฟ แนบไฟล์วิเคราะห์"}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={typing}
                    />
                    <div className="ai-chat-command-menu-wrap">
                        <button
                            type="button"
                            className={`ai-chat-tool-btn ai-chat-command-menu-btn ${quickMenuOpen ? 'active' : ''}`}
                            onClick={() => setQuickMenuOpen(value => !value)}
                            disabled={typing}
                            aria-expanded={quickMenuOpen}
                            aria-label="เปิดคำสั่งลัด"
                        >
                            <Zap size={16} />
                            <span>คำสั่งลัด</span>
                        </button>
                        {quickMenuOpen && (
                            <div className="ai-chat-command-menu" role="menu">
                                {quickActionGroups.map((group) => {
                                    const GroupIcon = group.icon;
                                    return (
                                        <section key={group.id} className="ai-chat-command-menu-section">
                                            <div className="ai-chat-command-menu-title">
                                                <GroupIcon size={14} />
                                                <span>{group.title}</span>
                                            </div>
                                            <div className="ai-chat-command-menu-list">
                                                {group.actions.map((action) => {
                                                    const ActionIcon = action.icon;
                                                    return (
                                                        <button
                                                            key={action.label}
                                                            type="button"
                                                            onClick={() => handleQuickMenuAction(action.query)}
                                                            role="menuitem"
                                                        >
                                                            <ActionIcon size={14} />
                                                            <span>{action.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </section>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        className={`ai-chat-tool-btn ai-chat-system-info-btn ${systemInfoOpen ? 'active' : ''}`}
                        onClick={() => setSystemInfoOpen(value => !value)}
                        aria-expanded={systemInfoOpen}
                        aria-label="ดูข้อมูลระบบที่ AI ใช้อยู่"
                    >
                        <Database size={16} />
                        <span>ข้อมูลระบบ</span>
                    </button>
                    <button
                        className={`ai-chat-tool-btn ai-chat-tool-btn-voice ${isListening ? 'listening' : ''}`}
                        onClick={toggleListening}
                        disabled={typing}
                        aria-label="สั่งงานด้วยเสียง (ภาษาไทย)"
                        data-tooltip="สั่งงานด้วยเสียง"
                    >
                        {isListening ? <Mic size={18} /> : <MicOff size={18} />}
                    </button>
                    <button className="ai-chat-page-send" onClick={handleSend} disabled={typing || !input.trim()} aria-label="ส่งคำถาม">
                        <Send size={20} />
                    </button>
                </div>
                {!isMinimal && (
                    <div className="ai-chat-page-input-hint">
                        กด Enter เพื่อส่ง • แนบไฟล์ CSV/TSV/Excel • สั่งด้วยเสียง • AI อาจตอบผิดพลาดได้
                    </div>
                )}
            </div>
        );
    };

    const hasStartedConversation = messages.some(msg => msg.role === 'user');
    const startsWithWelcomeMessage = messages[0]?.role === 'bot' && !messages[0]?.chart && messages[0]?.text?.includes(AI_ASSISTANT_NAME);
    const showCommandCenter = !hasStartedConversation;
    const visibleMessages = hasStartedConversation && startsWithWelcomeMessage ? messages.slice(1) : (hasStartedConversation ? messages : []);

    return (
        <div className={`ai-chat-page ${showCommandCenter ? 'is-welcome' : 'is-active'}`}>
            {/* Header */}
            <div className="ai-chat-page-header">
                <div className="ai-chat-page-header-left">
                    <div className="ai-chat-page-header-icon">
                        <Sparkles size={22} />
                    </div>
                    <div>
                        <h1>{AI_ASSISTANT_NAME}</h1>
                        <p>{APP_NAME_TH} / {APP_NAME_EN}</p>
                        <div className="ai-chat-page-header-meta">
                            <span><Database size={12} /> {liveSourceLabel}</span>
                            <span><ShieldCheck size={12} /> {roleLabel}</span>
                            <span><Clock3 size={12} /> บริบทสดในหน้า</span>
                        </div>
                    </div>
                </div>
                <div className="ai-chat-page-header-actions">
                    <button
                        className="ai-chat-page-history-btn ai-chat-page-system-btn"
                        onClick={() => setSystemInfoOpen(true)}
                        aria-label="ดูข้อมูลระบบที่ AI ใช้อยู่"
                    >
                        <Database size={15} /> ข้อมูลระบบ
                    </button>
                    {canPersist && (
                        <button
                            className="ai-chat-page-history-btn"
                            onClick={openHistory}
                            aria-label="ประวัติการสนทนา"
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
                            {sessions.length > 0 && (
                                <button
                                    className="chat-history-clear-all-btn"
                                    onClick={handleDeleteAllSessions}
                                    disabled={sessionsLoading || deletingAllHistory}
                                >
                                    <Trash2 size={15} />
                                    {deletingAllHistory ? 'กำลังลบประวัติ...' : `ลบประวัติทั้งหมด (${sessions.length})`}
                                </button>
                            )}

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
                                                    aria-label="ลบ"
                                                    data-tooltip="ลบ"
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
                    {showCommandCenter && (
                        <section className="ai-minimal-welcome" aria-label="เริ่มถาม Science Decision AI">
                            <div className="ai-minimal-orb">
                                <Sparkles size={24} />
                            </div>
                            <p className="ai-minimal-kicker">Science Decision AI</p>
                            <h2>วันนี้อยากวิเคราะห์อะไรอยู่</h2>
                            <p className="ai-minimal-subtitle">
                                ถามข้อมูลคณะ สร้างกราฟ พยากรณ์ หรือแนบไฟล์ให้ AI ช่วยอ่านได้ทันที
                            </p>
                            <div className="ai-minimal-input-shell">
                                {renderChatInput('minimal')}
                            </div>
                            <div className="ai-minimal-pills" aria-label="คำสั่งแนะนำ">
                                {featuredQuickActions.map((action) => {
                                    const ActionIcon = action.icon;
                                    return (
                                        <button
                                            key={action.label}
                                            type="button"
                                            className="ai-minimal-pill"
                                            onClick={() => handleQuickAction(action.query)}
                                            disabled={typing}
                                        >
                                            <ActionIcon size={15} />
                                            {action.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {showCommandCenter && (
                        <section className="ai-command-briefing" aria-label="AI dashboard briefing">
                            <div className="ai-command-briefing-copy">
                                <div className="ai-command-kicker">
                                    <Gauge size={14} /> Decision Command Center
                                </div>
                                <h2>ถาม วิเคราะห์ และสร้างกราฟจากข้อมูลคณะได้ในที่เดียว</h2>
                                <p>
                                    AI จะเลือกอ่านเฉพาะข้อมูลที่เกี่ยวข้องกับคำถาม เช่น นักศึกษา TCAS งบประมาณ HR และไฟล์ที่แนบ
                                    เพื่อประหยัด token และลดคำตอบลอยจากข้อมูลไม่เกี่ยวข้อง
                                </p>
                            </div>
                            <div className="ai-command-status-grid">
                                {aiStatusCards.map((card) => {
                                    const Icon = card.icon;
                                    return (
                                        <div key={card.label} className="ai-command-status-card" style={{ '--accent': card.color }}>
                                            <div className="ai-command-status-icon"><Icon size={16} /></div>
                                            <div>
                                                <span>{card.label}</span>
                                                <strong>{card.value}</strong>
                                                <small>{card.detail}</small>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* Quick Actions Bar */}
                    {showCommandCenter && (
                        <div className="ai-chat-page-quick-actions">
                            <div className="ai-chat-page-quick-label">
                                <Zap size={13} /> QUICK ACTIONS — เลือกงานที่ต้องการให้ AI ช่วย
                            </div>
                            <div className="ai-chat-page-quick-groups">
                                {quickActionGroups.map((group) => {
                                    const GroupIcon = group.icon;
                                    return (
                                        <section key={group.id} className="ai-chat-page-quick-group" style={{ '--group-color': group.color }}>
                                            <div className="ai-chat-page-quick-group-head">
                                                <span><GroupIcon size={15} /></span>
                                                <div>
                                                    <strong>{group.title}</strong>
                                                    <small>{group.desc}</small>
                                                </div>
                                            </div>
                                            <div className="ai-chat-page-quick-grid">
                                                {group.actions.map((action) => {
                                                    const ActionIcon = action.icon;
                                                    return (
                                                        <button key={action.label} className="ai-chat-page-quick-btn" onClick={() => handleQuickAction(action.query)}>
                                                            <ActionIcon size={14} /> {action.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </section>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Messages */}
                    <div className="ai-chat-page-messages">
                        {visibleMessages.map((msg, i) => (
                            <ChatMessage
                                key={i}
                                msg={msg}
                                onExpand={setExpandedChart}
                                onAskFollowUp={(seed) => setInput(`ต่อจาก insight นี้ ช่วยขยายให้หน่อย: ${seed}`)}
                            />
                        ))}
                        {typing && (
                            <div className="ai-page-msg ai-page-msg-bot">
                                <div className="ai-page-msg-avatar"><Sparkles size={18} style={{ color: 'var(--accent-success)' }} /></div>
                                <div className="ai-page-msg-content">
                                    <div className="ai-page-typing">
                                        <div className="ai-page-typing-dots" aria-hidden="true">
                                            <span /><span /><span />
                                        </div>
                                        <div className="ai-page-typing-text">
                                            <strong>{AI_THINKING_STEPS[thinkingStepIndex]}</strong>
                                            <small>กำลังเตรียมคำตอบจากข้อมูลที่เกี่ยวข้อง</small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEnd} />
                    </div>

                    {/* Input Area */}
                    {!showCommandCenter && renderChatInput('default')}
                    <div className="ai-chat-page-input-wrapper">
                        {uploadedFileData && (
                            <div className="ai-chat-file-pill">
                                <FileSpreadsheet size={14} />
                                <span>ไฟล์ที่โหลด: {uploadedFileData.rowCount} แถว × {uploadedFileData.headers.length} คอลัมน์ — ถามคำถามเกี่ยวกับข้อมูลนี้ได้เลย</span>
                                <button
                                    type="button"
                                    onClick={() => setUploadedFileData(null)}
                                    aria-label="ล้างไฟล์ที่อัปโหลด"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                        <div className="ai-chat-page-input-area">
                            <button
                                className={`ai-chat-tool-btn ai-chat-tool-btn-voice ${isListening ? 'listening' : ''}`}
                                onClick={toggleListening}
                                disabled={typing}
                                aria-label="สั่งงานด้วยเสียง (ภาษาไทย)"
                                data-tooltip="สั่งงานด้วยเสียง"
                            >
                                {isListening ? <Mic size={18} /> : <MicOff size={18} />}
                            </button>
                            <button
                                className={`ai-chat-tool-btn ai-chat-tool-btn-upload ${uploadedFileData ? 'has-file' : ''}`}
                                onClick={() => fileInputRef.current?.click()}
                                disabled={typing}
                                aria-label="อัปโหลดไฟล์ CSV/Excel เพื่อวิเคราะห์"
                                data-tooltip="อัปโหลดไฟล์"
                            >
                                <Paperclip size={18} />
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

                    <h3><Sparkles size={16} /> Context ที่ AI ใช้อยู่</h3>
                    <div className="ai-context-source-list">
                        {contextSources.map((source) => (
                            <div key={source.label} className={`ai-context-source ${source.state}`}>
                                <div>
                                    <span>{source.label}</span>
                                    <strong>{source.value}</strong>
                                </div>
                                <small>{source.state === 'live' ? 'live' : source.state === 'idle' ? 'idle' : 'ready'}</small>
                            </div>
                        ))}
                    </div>

                    {decisionPrompts.length > 0 && (
                        <div className="ai-decision-prompts">
                            <h4><Zap size={14} /> คำถามเชิงตัดสินใจ</h4>
                            {decisionPrompts.map((prompt) => (
                                <button key={prompt.label} type="button" onClick={() => handleQuickAction(prompt.query)} disabled={typing}>
                                    {prompt.label}
                                </button>
                            ))}
                        </div>
                    )}

                    <h3><Sparkles size={16} /> ความสามารถหลัก</h3>
                    <div className="ai-chat-page-feature-list">
                        {featureCards.map((card, i) => {
                            const Icon = card.icon;
                            const accentColor = legacyColorToVar(card.color);
                            return (
                                <div key={i} className="ai-chat-page-feature-card">
                                    <div className="ai-chat-page-feature-icon" style={{ background: themeAlpha(card.color, 9), color: accentColor, boxShadow: `0 2px 8px ${themeAlpha(card.color, 8)}` }}>
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
                            {suggestedPrompts.map(prompt => (
                                <li key={prompt.label}>
                                    <button type="button" onClick={() => handleQuickAction(prompt.query)} disabled={typing}>
                                        "{prompt.label}"
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            {systemInfoOpen && (
                <div className="ai-system-info-backdrop" onClick={() => setSystemInfoOpen(false)}>
                    <aside className="ai-system-info-panel" onClick={(event) => event.stopPropagation()} aria-label="ข้อมูลระบบที่ AI ใช้อยู่">
                        <div className="ai-system-info-head">
                            <div>
                                <span>ข้อมูลระบบ</span>
                                <strong>บริบทที่ AI ใช้ตอบคำถาม</strong>
                            </div>
                            <button type="button" onClick={() => setSystemInfoOpen(false)} aria-label="ปิดข้อมูลระบบ">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="ai-system-info-section">
                            <h4><Database size={15} /> Context ที่พร้อมใช้งาน</h4>
                            <div className="ai-context-source-list compact">
                                {contextSources.map((source) => (
                                    <div key={source.label} className={`ai-context-source ${source.state}`}>
                                        <div>
                                            <span>{source.label}</span>
                                            <strong>{source.value}</strong>
                                        </div>
                                        <small>{source.state === 'live' ? 'live' : source.state === 'idle' ? 'idle' : 'ready'}</small>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="ai-system-info-section">
                            <h4><Gauge size={15} /> สถานะการอ่านข้อมูล</h4>
                            <div className="ai-system-status-grid">
                                {aiStatusCards.map((card) => {
                                    const Icon = card.icon;
                                    return (
                                        <div key={card.label} className="ai-system-status-card" style={{ '--accent': card.color }}>
                                            <Icon size={15} />
                                            <span>{card.label}</span>
                                            <strong>{card.value}</strong>
                                            <small>{card.detail}</small>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="ai-system-info-section ai-observability-panel">
                            <h4><Gauge size={15} /> AI Observability</h4>
                            <div className="ai-observability-grid">
                                {observabilityRows.map((item) => (
                                    <div key={item.label} className={`ai-observability-item ${item.state}`}>
                                        <span>{item.label}</span>
                                        <strong>{item.value}</strong>
                                        <small>{item.detail}</small>
                                    </div>
                                ))}
                            </div>
                            {answerVerification?.unsupportedNumbers?.length > 0 && (
                                <div className="ai-observability-warning">
                                    ตรวจพบตัวเลขที่ยังไม่ตรงกับ context: {answerVerification.unsupportedNumbers.slice(0, 6).join(', ')}
                                </div>
                            )}
                        </div>

                        <div className="ai-system-info-section">
                            <h4><ShieldCheck size={15} /> Capability readiness</h4>
                            <div className="ai-context-source-list compact">
                                {systemReadiness.map((item) => (
                                    <div key={item.label} className={`ai-context-source ${item.state}`}>
                                        <div>
                                            <span>{item.label}</span>
                                            <strong>{item.value}</strong>
                                        </div>
                                        <small>ready</small>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {decisionPrompts.length > 0 && (
                            <div className="ai-system-info-section">
                                <h4><Zap size={15} /> คำถามเชิงตัดสินใจ</h4>
                                <div className="ai-system-prompt-list">
                                    {decisionPrompts.map((prompt) => (
                                        <button
                                            key={prompt.label}
                                            type="button"
                                            onClick={() => {
                                                setSystemInfoOpen(false);
                                                handleQuickAction(prompt.query);
                                            }}
                                            disabled={typing}
                                        >
                                            {prompt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="ai-system-info-section">
                            <h4><Sparkles size={15} /> ความสามารถหลัก</h4>
                            <div className="ai-system-feature-list">
                                {featureCards.slice(0, 4).map((card) => {
                                    const Icon = card.icon;
                                    return (
                                        <div key={card.title} className="ai-system-feature-item">
                                            <span style={{ '--accent': card.color }}><Icon size={15} /></span>
                                            <div>
                                                <strong>{card.title}</strong>
                                                <small>{card.desc}</small>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {suggestedPrompts.length > 0 && (
                            <div className="ai-system-info-section">
                                <h4><MessageCircle size={15} /> ตัวอย่างคำถาม</h4>
                                <div className="ai-system-prompt-list">
                                    {suggestedPrompts.slice(0, 6).map((prompt) => (
                                        <button
                                            key={prompt.label}
                                            type="button"
                                            onClick={() => {
                                                setSystemInfoOpen(false);
                                                handleQuickAction(prompt.query);
                                            }}
                                            disabled={typing}
                                        >
                                            {prompt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </aside>
                </div>
            )}

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
export function ExpandedChartModal({ chart, onClose }) {
    const chartRef = useRef(null);
    const [modalKey, setModalKey] = useState(0);

    // UI chart type — uses 'hbar' as a virtual horizontal-bar value.
    const initialUiType = getInitialUiChartType(chart);
    const [chartType, setChartType] = useState(initialUiType);
    const renderedChart = deriveChartConfig(chart, chartType);
    const renderType = realChartType(chartType);
    const switchOptions = availableChartTypes(chart);

    useEffect(() => {
        const resizeChart = () => {
            const instance = chartRef.current;
            if (!instance) return;
            try {
                instance.resize?.();
                instance.update?.('none');
            } catch (err) {
                console.warn('[AIChatPage] chart resize failed:', err?.message || err);
            }
        };
        const raf = requestAnimationFrame(resizeChart);
        const timeout = setTimeout(resizeChart, 120);
        return () => {
            cancelAnimationFrame(raf);
            clearTimeout(timeout);
        };
    }, [chartType, modalKey, renderedChart]);

    // Reset zoom handler
    const handleResetZoom = () => {
        const instance = chartRef.current;
        if (!instance) return;
        try {
            if (typeof instance.resetZoom === 'function') {
                instance.resetZoom();
            } else {
                setModalKey(prev => prev + 1);
            }
            instance.resize?.();
            instance.update?.('none');
        } catch (err) {
            console.warn('[AIChatPage] reset zoom failed, remounting chart:', err?.message || err);
            setModalKey(prev => prev + 1);
        }
    };

    // Force re-render with fresh data on chart type change
    const handleChartTypeChange = (newType) => {
        setChartType(newType);
        setModalKey(prev => prev + 1);
    };

    // Enhanced options for expanded view — larger fonts, better grid
    const expandedChart = chartOptionsForRender(renderedChart, chartType, true);
    const expandedChartExportTitle = readableChartExportTitle(expandedChart, 'AI chart expanded');
    const expandedOptions = expandedChart ? {
        ...expandedChart.options,
        animation: { duration: 600, easing: 'easeOutQuart' },
        plugins: {
            ...(expandedChart.options?.plugins || {}),
            legend: {
                position: 'bottom',
                labels: {
                    color: 'var(--chart-muted)',
                    padding: 18,
                    font: { size: 12, weight: '500' },
                    usePointStyle: true,
                    pointStyleWidth: 12,
                }
            },
            tooltip: {
                ...(expandedChart.options?.plugins?.tooltip || {}),
                ...AI_CHART_TOOLTIP_STYLE,
                padding: 14,
                titleFont: { weight: '700', size: 13 },
                bodyFont: { size: 12 },
                boxPadding: 6,
            },
        },
    } : {};

    return (
        <div className="ai-page-chart-modal-overlay" onClick={onClose}>
            <div className="ai-page-chart-modal" onClick={e => e.stopPropagation()}>
                <div className="ai-page-chart-modal-header">
                    <h3><ZoomIn size={20} style={{ color: 'var(--accent-success)' }} /> กราฟขยาย</h3>
                    <div className="ai-page-chart-modal-actions">
                        <button
                            className="ai-page-chart-modal-reset"
                            onClick={handleResetZoom}
                            aria-label="รีเซ็ตการซูม"
                        >
                            <RotateCw size={15} /> รีเซ็ตซูม
                        </button>
                        <button
                            className="ai-page-chart-modal-reset"
                            onClick={() => exportChartAsCSVReport(expandedChartExportTitle, expandedChart)}
                            aria-label="Export chart data and graph image as one Excel workbook"
                            data-tooltip="Export Excel + รูปกราฟ"
                        >
                            <FileSpreadsheet size={15} /> Excel
                        </button>
                        <button className="ai-page-chart-modal-close" onClick={onClose} aria-label="ปิดกราฟขยาย" data-tooltip="ปิด">
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
                                    aria-label={opt.label}
                                >
                                    <Icon size={14} /> {opt.label}
                                </button>
                            );
                        })}
                    </div>
                )}

                <div className="ai-page-chart-modal-body">
                    {expandedChart && (
                        <ReactChart
                            key={`${renderType}-${modalKey}`}
                            ref={chartRef}
                            type={renderType}
                            data={expandedChart.data}
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
