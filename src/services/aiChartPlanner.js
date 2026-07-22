import { courseAnalyticsData } from '../data/courseAnalyticsData';
import { currentGraduationStats, graduationByMajor, graduationHistory } from '../data/graduationData';
import { getScienceActivitySummary } from '../data/scienceActivitiesData';
import { hrData } from '../data/hrData';
import { strategicData } from '../data/strategicData';
import { scienceFacultyBudgetData, studentStatsData, dashboardSummary } from '../data/mockData';
import { tcasPlanningData } from '../data/tcasAdmissionsData';
import {
    buildAIAccessDeniedResult,
    canAIUseAllInternalSections,
    canAIUseAnyInternalSection,
} from '../utils/aiAccessPolicy';
import { isValidChartConfig } from '../utils/aiChartResponse';
import { getDatasetQualityText } from '../utils/smartChartData';
import {
    getSharedDashboardDatasetMetaSync,
    getSharedDashboardDatasetSync,
} from './sharedDashboardDataService';
import { getStudentListSync, getStudentRosterTrustStatus } from './studentDataService';

const PALETTE = ['var(--accent-success)', 'var(--accent-blue)', 'var(--accent-purple)', 'var(--accent-orange)', 'var(--accent-danger)', 'var(--accent-cyan)'];
const CHART_PATTERN = /กราฟ|chart|plot|แผนภูมิ|แผนภาพ|visual|เปรียบเทียบ|compare|comparison|แนวโน้ม|trend|กระจาย|distribution/i;
const SOURCE_DATASET_IDS = new Map();

function q(value) {
    return String(value || '').toLowerCase();
}

function number(value, fallback = 0) {
    if (value == null || value === '') return fallback;
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
}

function format(value, digits = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '-';
    return n.toLocaleString('th-TH', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
}

function sharedDataset(id, fallback) {
    return getSharedDashboardDatasetSync(id) || fallback;
}

function sourceLabel(id, fallbackLabel) {
    const meta = getSharedDashboardDatasetMetaSync(id);
    const status = getDatasetQualityText(meta);
    const updated = meta?.updatedAt ? `, อัปเดต ${meta.updatedAt.toLocaleString('th-TH')}` : '';
    const trust = String(meta?.sourceType || meta?.lastWriteSource || '').toLowerCase();
    const sampleNotice = /mock|demo|sample|generated|fallback|static|seed/.test(trust)
        ? ', ข้อมูลตัวอย่าง/ข้อมูลตั้งต้น ไม่ใช่ข้อมูลจริงจาก API'
        : '';
    const label = `${fallbackLabel} (${status}${updated}${sampleNotice})`;
    SOURCE_DATASET_IDS.set(label, id);
    return label;
}

function hasChartIntent(question) {
    return CHART_PATTERN.test(String(question || ''));
}

function asResult({
    text,
    chart,
    sources = [],
    trustWarnings = [],
    usageMode = 'deterministic_chart',
    selectedDatasets = [],
}) {
    if (!chart || !isValidChartConfig(chart)) return null;
    const nextChart = {
        ...chart,
        options: {
            ...(chart.options || {}),
            plugins: {
                ...((chart.options || {}).plugins || {}),
                title: {
                    display: true,
                    text: (chart.options?.plugins?.title?.text || chart.title || 'AI chart').toString(),
                    ...((chart.options || {}).plugins?.title || {}),
                },
                subtitle: {
                    display: Boolean(sources.length),
                    text: sources.slice(0, 2).join(' • '),
                    ...((chart.options || {}).plugins?.subtitle || {}),
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    ...((chart.options || {}).plugins?.tooltip || {}),
                },
            },
        },
        sourceLabel: sources.join(' • '),
    };
    const sourceText = sources.length ? `\n\n**แหล่งข้อมูลที่ใช้:**\n${sources.map(item => `- ${item}`).join('\n')}` : '';
    const warningText = trustWarnings.length ? `\n\n${trustWarnings.map(item => `_หมายเหตุ: ${item}_`).join('\n')}` : '';
    const inferredDatasets = sources.map(source => {
        if (/^Uploaded file:/i.test(source)) return 'uploaded_file';
        return SOURCE_DATASET_IDS.get(source) || '';
    }).filter(Boolean);
    return {
        text: `${text}${sourceText}${warningText}`.trim(),
        chart: nextChart,
        sources,
        selectedDatasets: [...new Set([...selectedDatasets, ...inferredDatasets])],
        trustWarnings,
        blockedReason: '',
        usageMode,
    };
}

function denyIfNoAccess(userContext, sections = []) {
    return canAIUseAnyInternalSection(userContext, sections)
        ? null
        : buildAIAccessDeniedResult(userContext, sections);
}

function denyIfMissingAll(userContext, sections = []) {
    return canAIUseAllInternalSections(userContext, sections)
        ? null
        : buildAIAccessDeniedResult(userContext, sections);
}

function tcasRows(data) {
    const round3 = Array.isArray(data?.round3Plan2569) ? data.round3Plan2569 : [];
    const roundPlan = Array.isArray(data?.roundPlan2569) ? data.roundPlan2569 : [];
    const target = Array.isArray(data?.intakeTarget2570) ? data.intakeTarget2570 : [];
    const labels = [...new Set([
        ...round3.map(row => row.major),
        ...target.map(row => row.major),
    ].filter(Boolean))];
    return {
        round3,
        roundPlan,
        target,
        labels,
        round3Total: round3.reduce((sum, row) => sum + number(row.plan), 0),
        targetTotal: target.reduce((sum, row) => sum + number(row.target2570), 0),
    };
}

function buildTcasChartAnswer(question, userContext) {
    const accessDenied = denyIfNoAccess(userContext, ['tcas_admissions']);
    if (accessDenied) return accessDenied;

    const data = sharedDataset('tcas_admissions', tcasPlanningData);
    const rows = tcasRows(data);
    if (!rows.labels.length) return null;

    const questionText = q(question);
    const wantsAllRounds = /แต่ละรอบ|ทุกรอบ|รอบไหน|portfolio|quota|direct/.test(questionText)
        && rows.roundPlan.length > 0;
    if (wantsAllRounds) {
        const hasSampleRows = rows.roundPlan.some(row => /mock|sample|presentation/i.test(String(row?.sourceStatus || '')));
        return asResult({
            text: `สร้างกราฟเปรียบเทียบแผนรับและจำนวนลงทะเบียน TCAS ปี 2569 แยกตามรอบให้แล้วครับ${hasSampleRows ? ' ตัวเลขรายรอบชุดนี้เป็นข้อมูลตัวอย่าง/ข้อมูลตั้งต้นสำหรับสาธิต จึงยังไม่ใช่ข้อมูลจริงจาก Admissions/Reg' : ''}`,
            chart: {
                chartType: 'bar',
                data: {
                    labels: rows.roundPlan.map(row => row.round),
                    datasets: [
                        {
                            label: 'แผนรับ (คน)',
                            data: rows.roundPlan.map(row => number(row.plan)),
                            backgroundColor: 'color-mix(in srgb, var(--accent-blue) 73%, transparent)',
                            borderColor: 'var(--accent-blue)',
                            borderRadius: 8,
                        },
                        {
                            label: 'ลงทะเบียน (คน)',
                            data: rows.roundPlan.map(row => number(row.enrolled)),
                            backgroundColor: 'color-mix(in srgb, var(--accent-success) 73%, transparent)',
                            borderColor: 'var(--accent-success)',
                            borderRadius: 8,
                        },
                    ],
                },
                options: {
                    plugins: {
                        title: { display: true, text: 'แผนรับและลงทะเบียน TCAS ปี 2569 แยกตามรอบ' },
                        legend: { position: 'bottom' },
                    },
                    scales: {
                        y: { beginAtZero: true, title: { display: true, text: 'จำนวน (คน)' } },
                    },
                },
            },
            sources: [sourceLabel('tcas_admissions', 'TCAS admissions dataset')],
            trustWarnings: hasSampleRows
                ? ['ข้อมูลรายรอบเป็นข้อมูลตัวอย่าง/ข้อมูลตั้งต้น ต้อง Sync Admissions/Reg ก่อนใช้เป็นตัวเลขทางการ']
                : [],
        });
    }
    const compare = /เปรียบเทียบ|เพิ่ม|ลด|ควร|2570|แผนรับ/.test(questionText);
    const useRound3Only = /รอบ\s*3|admission|2569/.test(questionText) && !compare;
    const labels = useRound3Only ? rows.round3.map(row => row.major) : rows.labels;
    const round3ByMajor = new Map(rows.round3.map(row => [row.major, number(row.plan)]));
    const targetByMajor = new Map(rows.target.map(row => [row.major, number(row.target2570)]));

    const datasets = useRound3Only
        ? [{
            label: 'แผนรับ TCAS รอบ 3 ปี 2569',
            data: labels.map(label => round3ByMajor.get(label) || 0),
            backgroundColor: 'color-mix(in srgb, var(--accent-blue) 80%, transparent)',
            borderColor: 'var(--accent-blue)',
            borderWidth: 0,
            borderRadius: 8,
        }]
        : [
            {
                label: 'รอบ 3 ปี 2569',
                data: labels.map(label => round3ByMajor.get(label) || 0),
                backgroundColor: 'color-mix(in srgb, var(--accent-blue) 73%, transparent)',
                borderColor: 'var(--accent-blue)',
                borderWidth: 0,
                borderRadius: 8,
            },
            {
                label: 'เป้ารับปี 2570',
                data: labels.map(label => targetByMajor.get(label) || 0),
                backgroundColor: 'color-mix(in srgb, var(--accent-success) 73%, transparent)',
                borderColor: 'var(--accent-success)',
                borderWidth: 0,
                borderRadius: 8,
            },
        ];

    return asResult({
        text: useRound3Only
            ? `สร้างกราฟ **แผนรับ TCAS รอบ 3 ปี 2569** ให้แล้วครับ รวมแผนรับ ${format(rows.round3Total)} คน`
            : `สร้างกราฟเปรียบเทียบ **แผนรับ TCAS รอบ 3 ปี 2569** กับ **เป้ารับปี 2570** ให้แล้วครับ รอบ 3 รวม ${format(rows.round3Total)} คน และเป้าปี 2570 รวม ${format(rows.targetTotal)} คน`,
        chart: {
            chartType: 'bar',
            data: { labels, datasets },
            options: {
                indexAxis: 'y',
                plugins: {
                    title: { display: true, text: useRound3Only ? 'แผนรับ TCAS รอบ 3 ปี 2569' : 'เปรียบเทียบแผนรับ TCAS 2569 กับเป้ารับ 2570' },
                    legend: { position: 'bottom' },
                },
                scales: {
                    x: { beginAtZero: true, title: { display: true, text: 'จำนวนรับ (คน)' } },
                },
            },
        },
        sources: [sourceLabel('tcas_admissions', 'TCAS admissions dataset')],
        trustWarnings: ['ใช้ข้อมูลในหน้า TCAS/ไฟล์อ้างอิงที่เว็บมีตอนนี้ หากต้องการยืนยัน funnel สมัคร-ผ่าน-รายงานตัว ต้อง sync Admissions/Reg เพิ่ม'],
    });
}

function courseRows(data) {
    return (Array.isArray(data?.gradeDistributions) ? data.gradeDistributions : [])
        .map(course => {
            const grades = course.grades || {};
            const enrolled = number(course.enrolled);
            const low = number(grades.C) + number(grades.D) + number(grades.F);
            const fail = number(grades.F);
            return {
                code: course.code,
                title: course.title,
                label: `${course.code} ${course.title}`.trim(),
                avgGpa: number(course.avgGpa, null),
                enrolled,
                lowGradeRate: enrolled ? Number(((low / enrolled) * 100).toFixed(1)) : 0,
                failRate: enrolled ? Number(((fail / enrolled) * 100).toFixed(1)) : 0,
            };
        })
        .filter(row => row.label && Number.isFinite(row.avgGpa));
}

function buildCourseChartAnswer(question, userContext) {
    const accessDenied = denyIfNoAccess(userContext, ['course_analytics']);
    if (accessDenied) return accessDenied;

    const data = sharedDataset('course_analytics', courseAnalyticsData);
    const rows = courseRows(data);
    if (!rows.length) return null;

    const text = q(question);
    const easy = /ง่าย|เกรดดี|เกรดสูง|gpa\s*สูง|คะแนนดี/.test(text);
    const fail = /เสี่ยง\s*f|f\s*สูง|ตก|ไม่ผ่าน/.test(text);
    const sorted = [...rows].sort((a, b) => {
        if (easy) return b.avgGpa - a.avgGpa || a.lowGradeRate - b.lowGradeRate;
        if (fail) return b.failRate - a.failRate || a.avgGpa - b.avgGpa;
        return a.avgGpa - b.avgGpa || b.lowGradeRate - a.lowGradeRate;
    }).slice(0, 8);

    const title = easy
        ? 'รายวิชาที่มี GPA เฉลี่ยสูง'
        : fail
            ? 'รายวิชาที่มีสัดส่วน F สูง'
            : 'รายวิชาที่มีความยากจาก proxy เกรด';

    return asResult({
        text: `สร้างกราฟ **${title}** ให้แล้วครับ ใช้ proxy จาก GPA เฉลี่ย, สัดส่วน C/D/F และสัดส่วน F ของรายวิชาที่เว็บมีอยู่ตอนนี้`,
        chart: {
            chartType: 'bar',
            data: {
                labels: sorted.map(row => row.label),
                datasets: [
                    {
                        type: 'bar',
                        label: 'GPA เฉลี่ย',
                        data: sorted.map(row => row.avgGpa),
                        backgroundColor: 'color-mix(in srgb, var(--accent-purple) 73%, transparent)',
                        borderColor: 'var(--accent-purple)',
                        borderWidth: 0,
                        borderRadius: 8,
                        yAxisID: 'y',
                    },
                    {
                        type: 'line',
                        label: fail ? 'F (%)' : 'C/D/F (%)',
                        data: sorted.map(row => fail ? row.failRate : row.lowGradeRate),
                        borderColor: 'var(--accent-danger)',
                        backgroundColor: 'color-mix(in srgb, var(--accent-danger) 13%, transparent)',
                        borderWidth: 3,
                        pointRadius: 4,
                        tension: 0.35,
                        yAxisID: 'y1',
                    },
                ],
            },
            options: {
                plugins: {
                    title: { display: true, text: title },
                    legend: { position: 'bottom' },
                },
                scales: {
                    x: { ticks: { maxRotation: 35, minRotation: 0 } },
                    y: { beginAtZero: true, max: 4, title: { display: true, text: 'GPA เฉลี่ย' } },
                    y1: { beginAtZero: true, position: 'right', title: { display: true, text: 'สัดส่วน (%)' }, grid: { drawOnChartArea: false } },
                },
            },
        },
        sources: [sourceLabel('course_analytics', 'Course analytics dataset')],
        trustWarnings: ['ความยากรายวิชาเป็น proxy จาก grade distribution ในระบบ ไม่ใช่ป้าย official ของมหาวิทยาลัย'],
    });
}

function buildBudgetStudentCompareAnswer(question, userContext) {
    const accessDenied = denyIfMissingAll(userContext, ['budget_forecast', 'student_stats']);
    if (accessDenied) return accessDenied;

    const budget = sharedDataset('science_budget', scienceFacultyBudgetData);
    const students = sharedDataset('student_stats', studentStatsData);
    const budgetRows = Array.isArray(budget?.yearly) ? budget.yearly : [];
    const studentTrend = Array.isArray(students?.scienceFaculty?.newStudentIntake)
        ? students.scienceFaculty.newStudentIntake
        : (Array.isArray(students?.trend) ? students.trend : []);
    if (!budgetRows.length) return null;

    const studentByYear = new Map(studentTrend.map(row => [
        String(row.year),
        number(row.total ?? row.count, null),
    ]));
    const rows = budgetRows
        .map(row => {
            const year = String(row.year);
            const budgetValue = number(row.budget ?? row.allocatedBudget ?? row.revenue, null);
            const budgetStudentCount = number(row.students, null);
            const trendStudentCount = studentByYear.get(year) ?? null;
            return {
                year,
                budgetValue,
                students: budgetStudentCount ?? trendStudentCount,
                studentSource: budgetStudentCount != null ? 'budget_assumption' : 'student_stats',
            };
        })
        .filter(row => Number.isFinite(row.budgetValue) && Number.isFinite(row.students));

    if (!rows.length) {
        return {
            text: 'ยังสร้างกราฟเปรียบเทียบงบประมาณกับจำนวนนักศึกษาไม่ได้ เพราะข้อมูลทั้งสองชุดยังไม่มีปีหรือช่วงเวลาเดียวกัน ระบบจึงไม่สร้างกราฟงบประมาณอย่างเดียวแทนคำสั่งนี้ กรุณา Sync ข้อมูลนักศึกษาและงบประมาณแล้วลองอีกครั้ง',
            chart: null,
            sources: [
                sourceLabel('science_budget', 'แผนงบประมาณคณะวิทยาศาสตร์'),
                sourceLabel('student_stats', 'สถิตินักศึกษา'),
            ],
            trustWarnings: ['ต้องมีค่าของงบประมาณและจำนวนนักศึกษาในปีเดียวกันก่อนจึงจะเปรียบเทียบได้อย่างถูกต้อง'],
            blockedReason: 'comparison_period_mismatch',
            usageMode: 'deterministic_chart_insufficient_data',
        };
    }

    const usesBudgetStudentAssumption = rows.some(row => row.studentSource === 'budget_assumption');
    const usesStudentStats = rows.some(row => row.studentSource === 'student_stats');
    const sources = [sourceLabel('science_budget', 'แผนงบประมาณคณะวิทยาศาสตร์')];
    if (usesStudentStats) sources.push(sourceLabel('student_stats', 'สถิตินักศึกษา'));
    const trustWarnings = usesBudgetStudentAssumption
        ? ['จำนวนผู้เรียนเป็นยอดตามฐานคำนวณรายรับในไฟล์แผนงบประมาณ ซึ่งอาจรวมยอดข้ามภาคการศึกษา ไม่ใช่จำนวนนักศึกษาคงอยู่แบบไม่ซ้ำคน ณ วันปัจจุบัน']
        : [];

    return asResult({
        text: `สร้างกราฟเปรียบเทียบ **2 ข้อมูล** ให้แล้วครับ: **ประมาณการรายรับ/งบประมาณคณะวิทยาศาสตร์** กับ **จำนวนผู้เรียน${usesBudgetStudentAssumption ? 'ตามฐานคำนวณในแผนงบประมาณ' : 'จากสถิตินักศึกษา'}** โดยใช้แกนซ้ายเป็นล้านบาทและแกนขวาเป็นจำนวนคน`,
        chart: {
            chartType: 'bar',
            data: {
                labels: rows.map(row => row.year),
                datasets: [
                    {
                        type: 'bar',
                        label: 'ประมาณการรายรับ/งบประมาณ (ล้านบาท)',
                        data: rows.map(row => row.budgetValue),
                        borderColor: PALETTE[0],
                        backgroundColor: `${PALETTE[0]}B8`,
                        borderWidth: 1,
                        borderRadius: 7,
                        yAxisID: 'y',
                    },
                    {
                        type: 'line',
                        label: usesBudgetStudentAssumption
                            ? 'จำนวนผู้เรียนตามฐานคำนวณ (คน)'
                            : 'จำนวนนักศึกษา (คน)',
                        data: rows.map(row => row.students),
                        borderColor: PALETTE[1],
                        backgroundColor: `${PALETTE[1]}22`,
                        pointBackgroundColor: PALETTE[1],
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        borderWidth: 3,
                        tension: 0.3,
                        yAxisID: 'y1',
                    },
                ],
            },
            options: {
                plugins: {
                    title: { display: true, text: 'งบประมาณคณะวิทยาศาสตร์เทียบกับจำนวนนักศึกษา' },
                    legend: { position: 'bottom' },
                },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'งบประมาณ (ล้านบาท)' } },
                    y1: { beginAtZero: true, position: 'right', title: { display: true, text: 'จำนวนคน' }, grid: { drawOnChartArea: false } },
                },
            },
        },
        sources,
        trustWarnings,
    });
}

function buildGraduationChartAnswer(question, userContext) {
    const accessDenied = denyIfNoAccess(userContext, ['graduation_check', 'graduation_stats']);
    if (accessDenied) return accessDenied;

    const data = sharedDataset('graduation', {
        current: currentGraduationStats,
        byMajor: graduationByMajor,
        history: graduationHistory,
    });
    const text = q(question);
    const current = data?.current || data?.currentGraduationStats || currentGraduationStats;
    const byMajor = Array.isArray(data?.byMajor) ? data.byMajor : graduationByMajor;
    const history = Array.isArray(data?.history) ? data.history : graduationHistory;
    const wantsTrend = /ย้อนหลัง|แนวโน้ม|trend|ปี/.test(text) && history.length > 1;

    if (wantsTrend) {
        return asResult({
            text: 'สร้างกราฟแนวโน้มผู้มีสิทธิ์และผู้สำเร็จการศึกษาให้แล้วครับ',
            chart: {
                chartType: 'line',
                data: {
                    labels: history.map(row => String(row.year)),
                    datasets: [
                        { label: 'ผู้มีสิทธิ์ (คน)', data: history.map(row => number(row.candidates)), borderColor: 'var(--accent-blue)', tension: 0.3 },
                        { label: 'สำเร็จการศึกษา (คน)', data: history.map(row => number(row.graduated)), borderColor: 'var(--accent-success)', tension: 0.3 },
                    ],
                },
                options: {
                    plugins: { title: { display: true, text: 'แนวโน้มการสำเร็จการศึกษา' }, legend: { position: 'bottom' } },
                    scales: { y: { beginAtZero: true, title: { display: true, text: 'จำนวน (คน)' } } },
                },
            },
            sources: [sourceLabel('graduation', 'Graduation dataset')],
        });
    }

    const statusValues = [
        number(current?.expectedGraduates),
        number(current?.pending),
        number(current?.notPassed),
    ];
    if (statusValues.some(value => value > 0)) {
        return asResult({
            text: `สร้างกราฟสถานะความพร้อมจบให้แล้วครับ จากผู้มีสิทธิ์ ${format(current?.totalCandidates)} คน คาดว่าสำเร็จ ${format(current?.expectedGraduates)} คน`,
            chart: {
                chartType: 'bar',
                data: {
                    labels: ['คาดว่าสำเร็จ', 'รอพินิจ', 'ไม่ผ่านเกณฑ์'],
                    datasets: [{
                        label: 'จำนวน (คน)',
                        data: statusValues,
                        backgroundColor: ['var(--accent-success)', 'var(--accent-orange)', 'var(--accent-danger)'],
                        borderRadius: 8,
                    }],
                },
                options: {
                    plugins: { title: { display: true, text: 'สถานะความพร้อมสำเร็จการศึกษา' }, legend: { display: false } },
                    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                },
            },
            sources: [sourceLabel('graduation', 'Graduation dataset')],
        });
    }

    if (!byMajor.length) return null;
    return asResult({
        text: 'สร้างกราฟความพร้อมจบแยกตามสาขาให้แล้วครับ',
        chart: {
            chartType: 'bar',
            data: {
                labels: byMajor.map(row => row.major),
                datasets: [
                    { label: 'คาดว่าสำเร็จ', data: byMajor.map(row => number(row.expected)), backgroundColor: 'var(--accent-success)' },
                    { label: 'รอพินิจ', data: byMajor.map(row => number(row.pending)), backgroundColor: 'var(--accent-orange)' },
                    { label: 'ไม่ผ่านเกณฑ์', data: byMajor.map(row => number(row.notPassed)), backgroundColor: 'var(--accent-danger)' },
                ],
            },
            options: { plugins: { title: { display: true, text: 'ความพร้อมจบแยกตามสาขา' }, legend: { position: 'bottom' } } },
        },
        sources: [sourceLabel('graduation', 'Graduation dataset')],
    });
}

function buildStudentLifeChartAnswer(question, userContext) {
    const accessDenied = denyIfNoAccess(userContext, ['student_life']);
    if (accessDenied) return accessDenied;

    const data = sharedDataset('student_life', null);
    const fallback = getScienceActivitySummary();
    const activity = data?.activityHours || fallback.requirement;
    const events = Array.isArray(data?.scienceActivities) ? data.scienceActivities : fallback.all;
    const text = q(question);
    const wantsMonthly = /เดือนนี้|เดือนหน้า|รายเดือน|monthly|กิจกรรม.*เดือน/.test(text);

    if (wantsMonthly && events.length) {
        const currentKey = fallback.currentKey;
        const nextKey = fallback.nextKey;
        const eventMonth = event => String(event?.startDate || '').slice(0, 7);
        const currentRows = events.filter(event => eventMonth(event) === currentKey);
        const nextRows = events.filter(event => eventMonth(event) === nextKey);
        return asResult({
            text: 'สร้างกราฟเปรียบเทียบจำนวนกิจกรรมและชั่วโมงที่เปิดให้เก็บของเดือนนี้กับเดือนหน้าให้แล้วครับ',
            chart: {
                chartType: 'bar',
                data: {
                    labels: [fallback.currentMonthLabel, fallback.nextMonthLabel],
                    datasets: [
                        { label: 'จำนวนกิจกรรม', data: [currentRows.length, nextRows.length], backgroundColor: 'var(--accent-blue)', borderRadius: 8, yAxisID: 'y' },
                        { label: 'ชั่วโมงกิจกรรม', data: [currentRows.reduce((sum, row) => sum + number(row.hours), 0), nextRows.reduce((sum, row) => sum + number(row.hours), 0)], backgroundColor: 'var(--accent-purple)', borderRadius: 8, yAxisID: 'y1' },
                    ],
                },
                options: {
                    plugins: { title: { display: true, text: 'กิจกรรมคณะวิทยาศาสตร์เดือนนี้และเดือนหน้า' }, legend: { position: 'bottom' } },
                    scales: {
                        y: { beginAtZero: true, title: { display: true, text: 'จำนวนกิจกรรม' }, ticks: { precision: 0 } },
                        y1: { beginAtZero: true, position: 'right', title: { display: true, text: 'ชั่วโมง' }, grid: { drawOnChartArea: false } },
                    },
                },
            },
            sources: [sourceLabel('student_life', 'Student life dataset')],
        });
    }

    const completed = number(activity?.completedHours ?? activity?.completed);
    const target = number(activity?.targetHours ?? activity?.target);
    if (!target) return null;
    const remaining = Math.max(0, target - completed);
    return asResult({
        text: `สร้างกราฟความคืบหน้าชั่วโมงกิจกรรมให้แล้วครับ ทำแล้ว ${format(completed)} ชั่วโมง เหลือ ${format(remaining)} ชั่วโมงจากเป้าหมาย ${format(target)} ชั่วโมง`,
        chart: {
            chartType: 'doughnut',
            data: {
                labels: ['ทำแล้ว', 'ยังขาด'],
                datasets: [{ data: [completed, remaining], backgroundColor: ['var(--accent-success)', 'var(--accent-orange)'], borderWidth: 0 }],
            },
            options: { plugins: { title: { display: true, text: 'ความคืบหน้าชั่วโมงกิจกรรม' }, legend: { position: 'bottom' } } },
        },
        sources: [sourceLabel('student_life', 'Student life dataset')],
    });
}

function buildHrChartAnswer(question, userContext) {
    const accessDenied = denyIfNoAccess(userContext, ['hr_overview']);
    if (accessDenied) return accessDenied;

    const data = sharedDataset('hr', hrData);
    const science = data?.scienceFaculty || data?.summary || hrData.scienceFaculty;
    const text = q(question);
    const ageRows = Array.isArray(science?.diversity?.ageGroup) ? science.diversity.ageGroup : [];
    if (/เกษียณ|อายุ|retire/.test(text) && ageRows.length) {
        return asResult({
            text: `สร้างกราฟโครงสร้างช่วงอายุบุคลากรให้แล้วครับ โดยมีผู้ใกล้เกษียณใน 5 ปี ${format(science?.diversity?.retirementIn5Years)} คน`,
            chart: {
                chartType: 'bar',
                data: { labels: ageRows.map(row => row.group), datasets: [{ label: 'บุคลากร (คน)', data: ageRows.map(row => number(row.count)), backgroundColor: ageRows.map((_, index) => PALETTE[index % PALETTE.length]), borderRadius: 8 }] },
                options: { plugins: { title: { display: true, text: 'โครงสร้างช่วงอายุบุคลากร' }, legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
            },
            sources: [sourceLabel('hr', 'HR dataset')],
        });
    }

    const academic = number(science?.academic);
    const support = number(science?.support);
    if (!academic && !support) return null;
    return asResult({
        text: `สร้างกราฟภาพรวมบุคลากรคณะวิทยาศาสตร์ให้แล้วครับ สายวิชาการ ${format(academic)} คน และสายสนับสนุน ${format(support)} คน`,
        chart: {
            chartType: 'doughnut',
            data: { labels: ['สายวิชาการ', 'สายสนับสนุน'], datasets: [{ data: [academic, support], backgroundColor: ['var(--accent-blue)', 'var(--accent-success)'], borderWidth: 0 }] },
            options: { plugins: { title: { display: true, text: 'สัดส่วนบุคลากรคณะวิทยาศาสตร์' }, legend: { position: 'bottom' } } },
        },
        sources: [sourceLabel('hr', 'HR dataset')],
    });
}

function buildStrategicChartAnswer(question, userContext) {
    const accessDenied = denyIfNoAccess(userContext, ['strategic_overview']);
    if (accessDenied) return accessDenied;

    const data = sharedDataset('strategic', strategicData);
    const text = q(question);
    const trend = Array.isArray(data?.efficiencyTrend) ? data.efficiencyTrend : [];
    if (/ย้อนหลัง|3\s*ปี|แนวโน้ม|เฉลี่ย|คาดการณ์|forecast|trend/.test(text) && trend.length) {
        return asResult({
            text: 'สร้างกราฟแนวโน้มผลการดำเนินงานเชิงยุทธศาสตร์ย้อนหลังให้แล้วครับ',
            chart: {
                chartType: 'line',
                data: {
                    labels: trend.map(row => String(row.year)),
                    datasets: [
                        { label: 'คะแนนประสิทธิภาพ', data: trend.map(row => number(row.score)), borderColor: 'var(--accent-blue)', tension: 0.3, yAxisID: 'y' },
                        { label: 'ประสิทธิภาพงบประมาณ (%)', data: trend.map(row => number(row.budgetEfficiency)), borderColor: 'var(--accent-success)', tension: 0.3, yAxisID: 'y' },
                    ],
                },
                options: { plugins: { title: { display: true, text: 'แนวโน้มผลการดำเนินงานเชิงยุทธศาสตร์' }, legend: { position: 'bottom' } }, scales: { y: { beginAtZero: false, title: { display: true, text: 'คะแนน / ร้อยละ' } } } },
            },
            sources: [sourceLabel('strategic', 'Strategic KPI dataset')],
        });
    }

    const goals = Array.isArray(data?.strategicGoals) ? data.strategicGoals : [];
    if (!goals.length) return null;
    return asResult({
        text: 'สร้างกราฟเปรียบเทียบผลงานปัจจุบันกับเป้าหมาย KPI ให้แล้วครับ',
        chart: {
            chartType: 'bar',
            data: {
                labels: goals.map(row => row.title),
                datasets: [
                    { label: 'ผลปัจจุบัน', data: goals.map(row => number(row.current)), backgroundColor: 'var(--accent-blue)', borderRadius: 8 },
                    { label: 'เป้าหมาย', data: goals.map(row => number(row.target)), backgroundColor: 'var(--accent-success)', borderRadius: 8 },
                ],
            },
            options: { indexAxis: 'y', plugins: { title: { display: true, text: 'ผลปัจจุบันเทียบเป้าหมาย KPI' }, legend: { position: 'bottom' } }, scales: { x: { beginAtZero: true } } },
        },
        sources: [sourceLabel('strategic', 'Strategic KPI dataset')],
    });
}

function buildUploadedFileChartAnswer(question, uploadedFileData) {
    if (!uploadedFileData || !hasChartIntent(question)) return null;
    const rows = Array.isArray(uploadedFileData.rows) ? uploadedFileData.rows.slice(0, 80) : [];
    const numericColumns = Array.isArray(uploadedFileData.numericCols) ? uploadedFileData.numericCols.slice(0, 4) : [];
    const labelColumn = uploadedFileData.labelCol || uploadedFileData.headers?.find(header => !numericColumns.includes(header));
    if (!rows.length || !numericColumns.length || !labelColumn) return null;

    const labels = rows.map((row, index) => String(row?.[labelColumn] ?? `แถว ${index + 1}`));
    const datasets = numericColumns.map((column, index) => ({
        label: column,
        data: rows.map(row => number(String(row?.[column] ?? '').replace(/,/g, ''), 0)),
        backgroundColor: PALETTE[index % PALETTE.length],
        borderColor: PALETTE[index % PALETTE.length],
        borderWidth: 2,
        borderRadius: 7,
    }));
    const chartType = /แนวโน้ม|trend|เวลา|ปี|เดือน/.test(q(question)) ? 'line' : 'bar';
    if (chartType === 'line') {
        datasets.forEach(dataset => {
            dataset.backgroundColor = 'transparent';
            dataset.tension = 0.3;
            dataset.pointRadius = 4;
        });
    }

    return asResult({
        text: `สร้างกราฟจากไฟล์ **${uploadedFileData.fileName || 'ไฟล์ที่อัปโหลด'}** โดยใช้ ${labelColumn} เป็นแกนหมวดหมู่ และ ${numericColumns.join(', ')} เป็นตัวชี้วัดให้แล้วครับ`,
        chart: {
            chartType,
            data: { labels, datasets },
            options: {
                plugins: { title: { display: true, text: `กราฟจาก ${uploadedFileData.fileName || 'ไฟล์ที่อัปโหลด'}` }, legend: { position: 'bottom' } },
                scales: { y: { beginAtZero: true } },
            },
        },
        sources: [`Uploaded file: ${uploadedFileData.fileName || 'user-provided data'} (ข้อมูลที่ผู้ใช้อัปโหลด)`],
        usageMode: 'deterministic_uploaded_chart',
    });
}

function buildBudgetChartAnswer(question, userContext) {
    const accessDenied = denyIfNoAccess(userContext, ['budget_forecast', 'financial', 'faculty_budget']);
    if (accessDenied) return accessDenied;

    const budget = sharedDataset('science_budget', scienceFacultyBudgetData);
    const rows = Array.isArray(budget?.yearly) ? budget.yearly : [];
    if (!rows.length) return null;

    return asResult({
        text: 'สร้างกราฟ **รายรับ รายจ่าย และส่วนเกิน/ขาดดุลงบประมาณคณะวิทยาศาสตร์** ให้แล้วครับ',
        chart: {
            chartType: 'line',
            data: {
                labels: rows.map(row => String(row.year)),
                datasets: [
                    {
                        label: 'รายรับ (ล้านบาท)',
                        data: rows.map(row => number(row.revenue)),
                        borderColor: PALETTE[0],
                        backgroundColor: `${PALETTE[0]}22`,
                        tension: 0.35,
                    },
                    {
                        label: 'รายจ่าย (ล้านบาท)',
                        data: rows.map(row => number(row.expense)),
                        borderColor: PALETTE[3],
                        backgroundColor: `${PALETTE[3]}22`,
                        tension: 0.35,
                    },
                    {
                        label: 'ส่วนเกิน/ขาดดุล (ล้านบาท)',
                        data: rows.map(row => number(row.surplus)),
                        borderColor: PALETTE[2],
                        backgroundColor: `${PALETTE[2]}22`,
                        tension: 0.35,
                    },
                ],
            },
            options: {
                plugins: {
                    title: { display: true, text: 'งบประมาณคณะวิทยาศาสตร์ตามปี' },
                    legend: { position: 'bottom' },
                },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'ล้านบาท' } },
                },
            },
        },
        sources: [sourceLabel('science_budget', 'Faculty budget dataset')],
    });
}

function buildStudentGraduationCompareAnswer(question, userContext) {
    const accessDenied = denyIfMissingAll(userContext, ['student_stats', 'graduation_stats']);
    if (accessDenied) return accessDenied;

    const students = sharedDataset('student_stats', studentStatsData);
    const trend = Array.isArray(students?.scienceFaculty?.newStudentIntake)
        ? students.scienceFaculty.newStudentIntake
        : (Array.isArray(students?.trend) ? students.trend : []);
    const grad = sharedDataset('graduation', { history: graduationHistory });
    const gradRows = Array.isArray(grad?.history) ? grad.history : graduationHistory;
    if (!trend.length || !gradRows.length) return null;

    const gradByYear = new Map(gradRows.map(row => [String(row.year), number(row.graduated ?? row.count)]));
    const trendByYear = new Map(trend.map(row => [String(row.year), number(row.total ?? row.count)]));
    const labels = trend.map(row => String(row.year)).filter(year => gradByYear.has(year) || trendByYear.get(year));
    if (!labels.length) return null;

    return asResult({
        text: 'สร้างกราฟเปรียบเทียบ **จำนวนนักศึกษา/นิสิตใหม่** และ **จำนวนผู้สำเร็จการศึกษา** ตามปีให้แล้วครับ',
        chart: {
            chartType: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'นักศึกษา/นิสิตใหม่',
                        data: labels.map(year => {
                            return trendByYear.get(year) || 0;
                        }),
                        backgroundColor: 'color-mix(in srgb, var(--accent-blue) 73%, transparent)',
                        borderColor: 'var(--accent-blue)',
                        borderRadius: 8,
                    },
                    {
                        label: 'ผู้สำเร็จการศึกษา',
                        data: labels.map(year => gradByYear.get(year) || 0),
                        backgroundColor: 'color-mix(in srgb, var(--accent-success) 73%, transparent)',
                        borderColor: 'var(--accent-success)',
                        borderRadius: 8,
                    },
                ],
            },
            options: {
                plugins: {
                    title: { display: true, text: 'นักศึกษา/นิสิตใหม่เทียบผู้สำเร็จการศึกษา' },
                    legend: { position: 'bottom' },
                },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'จำนวน (คน)' } },
                },
            },
        },
        sources: [
            sourceLabel('student_stats', 'Student statistics dataset'),
            sourceLabel('graduation', 'Graduation dataset'),
        ],
    });
}

function buildDashboardFacultyCompareAnswer(question, userContext) {
    const accessDenied = denyIfNoAccess(userContext, ['dashboard']);
    if (accessDenied) return accessDenied;

    const summary = sharedDataset('dashboard_summary', dashboardSummary);
    const rows = Array.isArray(summary?.faculties) ? summary.faculties : [];
    if (!rows.length) return null;

    const text = q(question);
    const wantsGpa = /gpa|เกรด|grade/.test(text);
    const labels = rows.map(row => row.name || row.faculty).filter(Boolean);
    const gpaValues = rows.map(row => number(row.avgGPA ?? row.avgGpa, null));
    const hasGpa = gpaValues.some(value => Number.isFinite(value) && value > 0 && value <= 4);
    if (wantsGpa && !hasGpa) return null;
    const datasets = [
        {
            type: 'bar',
            label: 'จำนวนนักศึกษา',
            data: rows.map(row => number(row.totalStudents ?? row.total)),
            backgroundColor: 'color-mix(in srgb, var(--accent-blue) 73%, transparent)',
            borderColor: 'var(--accent-blue)',
            borderRadius: 8,
            yAxisID: 'y',
        },
    ];
    if (wantsGpa) {
        datasets.push({
            type: 'line',
            label: 'GPA เฉลี่ย',
            data: gpaValues,
            borderColor: 'var(--accent-purple)',
            backgroundColor: 'color-mix(in srgb, var(--accent-purple) 13%, transparent)',
            tension: 0.35,
            yAxisID: 'y1',
        });
    }

    return asResult({
        text: wantsGpa
            ? 'สร้างกราฟเปรียบเทียบ **จำนวนนักศึกษาและ GPA เฉลี่ยตามคณะ/หน่วยงาน** ให้แล้วครับ'
            : 'สร้างกราฟ **จำนวนนักศึกษาตามคณะ/หน่วยงาน** ให้แล้วครับ',
        chart: {
            chartType: 'bar',
            data: { labels, datasets },
            options: {
                plugins: {
                    title: { display: true, text: wantsGpa ? 'จำนวนนักศึกษาและ GPA เฉลี่ยตามคณะ' : 'จำนวนนักศึกษาตามคณะ' },
                    legend: { position: 'bottom' },
                },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'จำนวนนักศึกษา (คน)' } },
                    ...(wantsGpa ? {
                        y1: { beginAtZero: true, max: 4, position: 'right', title: { display: true, text: 'GPA เฉลี่ย' }, grid: { drawOnChartArea: false } },
                    } : {}),
                },
            },
        },
        sources: [sourceLabel('dashboard_summary', 'Dashboard summary dataset')],
    });
}

function buildScienceMajorStudentChartAnswer(question, userContext) {
    const accessDenied = denyIfNoAccess(userContext, ['student_stats']);
    if (accessDenied) return accessDenied;

    const stats = sharedDataset('student_stats', studentStatsData);
    let rows = Array.isArray(stats?.scienceFaculty?.byMajor)
        ? stats.scienceFaculty.byMajor
            .map(row => ({
                major: row.major || row.name,
                total: number(row.total ?? row.count),
                avgGPA: row.avgGPA ?? row.avgGpa,
            }))
            .filter(row => row.major && row.total)
        : [];

    const wantsGpa = /gpa|เกรด|grade/.test(q(question));
    let hasGpa = rows.some(row => Number.isFinite(Number(row.avgGPA)));
    const rosterTrust = getStudentRosterTrustStatus();
    let usedRoster = false;
    if ((!rows.length || (wantsGpa && !hasGpa)) && rosterTrust.canUseForChatRows) {
        const byMajor = new Map();
        getStudentListSync().forEach(student => {
            const major = String(student?.major || '').trim();
            if (!major) return;
            const current = byMajor.get(major) || { major, total: 0, gpaSum: 0, gpaCount: 0 };
            const gpa = Number(student?.gpa);
            current.total += 1;
            if (Number.isFinite(gpa)) {
                current.gpaSum += gpa;
                current.gpaCount += 1;
            }
            byMajor.set(major, current);
        });
        rows = [...byMajor.values()]
            .map(row => ({
                major: row.major,
                total: row.total,
                avgGPA: row.gpaCount ? Number((row.gpaSum / row.gpaCount).toFixed(2)) : null,
            }))
            .filter(row => row.total > 0)
            .sort((a, b) => b.total - a.total || a.major.localeCompare(b.major, 'th'));
        hasGpa = rows.some(row => Number.isFinite(Number(row.avgGPA)));
        usedRoster = rows.length > 0;
    }
    if (!rows.length) return null;
    if (wantsGpa && !hasGpa) return null;

    const datasets = [
        {
            type: 'bar',
            label: 'จำนวนนักศึกษา',
            data: rows.map(row => row.total),
            backgroundColor: 'color-mix(in srgb, var(--accent-success) 73%, transparent)',
            borderColor: 'var(--accent-success)',
            borderRadius: 8,
            yAxisID: 'y',
        },
    ];
    if (wantsGpa && hasGpa) {
        datasets.push({
            type: 'line',
            label: 'GPA เฉลี่ย',
            data: rows.map(row => number(row.avgGPA)),
            borderColor: 'var(--accent-purple)',
            backgroundColor: 'color-mix(in srgb, var(--accent-purple) 13%, transparent)',
            tension: 0.35,
            yAxisID: 'y1',
        });
    }

    return asResult({
        text: wantsGpa
            ? `สร้างกราฟเปรียบเทียบ **จำนวนนักศึกษาและ GPA เฉลี่ยตามสาขาคณะวิทยาศาสตร์** ให้แล้วครับ${usedRoster && rosterTrust.canAnswerDemoIndividual ? ' โดยข้อมูลรายสาขาและ GPA เป็น generated mock/ข้อมูลจำลองสำหรับสาธิต ไม่ใช่ข้อมูลจริงจาก Reg' : ''}`
            : 'สร้างกราฟ **จำนวนนักศึกษาตามสาขาคณะวิทยาศาสตร์** ให้แล้วครับ',
        chart: {
            chartType: 'bar',
            data: {
                labels: rows.map(row => row.major),
                datasets,
            },
            options: {
                plugins: {
                    title: { display: true, text: wantsGpa ? 'จำนวนนักศึกษาและ GPA เฉลี่ยตามสาขาคณะวิทยาศาสตร์' : 'จำนวนนักศึกษาตามสาขาคณะวิทยาศาสตร์' },
                    legend: { position: 'bottom' },
                },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'จำนวนนักศึกษา (คน)' } },
                    ...(wantsGpa && hasGpa ? {
                        y1: { beginAtZero: true, max: 4, position: 'right', title: { display: true, text: 'GPA เฉลี่ย' }, grid: { drawOnChartArea: false } },
                    } : {}),
                },
            },
        },
        sources: [
            sourceLabel('student_stats', 'Student statistics dataset'),
            ...(usedRoster ? [`Student roster (${rosterTrust.accuracyLabel})`] : []),
        ],
        selectedDatasets: [
            'student_stats',
            ...(usedRoster ? [rosterTrust.canAnswerDemoIndividual ? 'student_roster_mock' : 'student_roster_uploaded'] : []),
        ],
        trustWarnings: usedRoster && rosterTrust.warning ? [rosterTrust.warning] : [],
    });
}

function wantsStudentTrendChart(question) {
    const text = q(question);
    const hasChart = /กราฟ|chart|plot|แผนภูมิ|แผนภาพ|สร้าง|แสดง|เปรียบเทียบ|วิเคราะห์/.test(text);
    const hasStudent = /นักศึกษา|นิสิต|student|students/.test(text);
    const hasTrend = /ย้อนหลัง|แนวโน้ม|รายปี|ตามปี|ต่อปี|trend|historical|history/.test(text);
    const isForecast = /พยากรณ์|คาดการณ์|ประมาณการ|ทำนาย|predict|forecast/.test(text);
    const wantsIndividualRows = /รายชื่อ|รายคน|รหัส\s*6|\b6\d{9}\b/.test(text);
    return hasChart && hasStudent && hasTrend && !isForecast && !wantsIndividualRows;
}

function buildScienceStudentTrendChartAnswer(question, userContext) {
    const accessDenied = denyIfNoAccess(userContext, ['student_stats']);
    if (accessDenied) return accessDenied;

    const stats = sharedDataset('student_stats', studentStatsData);
    const rows = Array.isArray(stats?.scienceFaculty?.newStudentIntake)
        ? stats.scienceFaculty.newStudentIntake
            .map(row => ({ year: String(row.year), total: number(row.total ?? row.count, null) }))
            .filter(row => row.year && Number.isFinite(row.total))
            .sort((a, b) => Number(a.year) - Number(b.year))
        : [];
    if (rows.length < 2) return null;

    const latest = rows[rows.length - 1];
    return asResult({
        text: `สร้างกราฟเส้นแนวโน้ม **จำนวนนักศึกษาใหม่คณะวิทยาศาสตร์รายปี** ย้อนหลัง ${rows.length} ปีให้แล้วครับ\n\nปีล่าสุด ${latest.year} มีนักศึกษาใหม่ ${format(latest.total)} คน`,
        chart: {
            chartType: 'line',
            data: {
                labels: rows.map(row => row.year),
                datasets: [{
                    label: 'นักศึกษาใหม่ (คน)',
                    data: rows.map(row => row.total),
                    borderColor: 'var(--accent-blue)',
                    backgroundColor: 'color-mix(in srgb, var(--accent-blue) 14%, transparent)',
                    pointBackgroundColor: 'var(--accent-blue)',
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    borderWidth: 3,
                    tension: 0.3,
                    fill: true,
                }],
            },
            options: {
                plugins: {
                    title: { display: true, text: 'แนวโน้มนักศึกษาใหม่คณะวิทยาศาสตร์รายปี' },
                    legend: { position: 'bottom' },
                },
                scales: {
                    x: { title: { display: true, text: 'ปีการศึกษา' } },
                    y: { beginAtZero: true, title: { display: true, text: 'นักศึกษาใหม่ (คน)' } },
                },
            },
        },
        sources: [sourceLabel('student_stats', 'Student statistics dataset')],
        trustWarnings: ['ชุดข้อมูลนี้เป็นนักศึกษาใหม่ (intake) รายปี ไม่ใช่ยอดนักศึกษาคงอยู่ทั้งหมด ณ ปัจจุบัน; หากต้องการยอดคงอยู่ควร Sync ข้อมูลทะเบียนรายปีเพิ่มเติม'],
    });
}

function buildPopulationForecastChartAnswer(question, userContext) {
    const accessDenied = denyIfNoAccess(userContext, ['student_stats']);
    if (accessDenied) return accessDenied;

    const stats = sharedDataset('student_stats', studentStatsData);
    const forecast = stats?.populationForecast;
    const rows = Array.isArray(forecast?.scenario)
        ? forecast.scenario
            .map(row => ({
                year: row.year,
                youthPopulationIndex: number(row.youthPopulationIndex, null),
                expectedScienceDemandIndex: number(row.expectedScienceDemandIndex, null),
            }))
            .filter(row => row.year && Number.isFinite(row.youthPopulationIndex) && Number.isFinite(row.expectedScienceDemandIndex))
            .sort((a, b) => Number(a.year) - Number(b.year))
        : [];

    // Deterministic charts must not present bundled demo scenarios as current evidence.
    if (!rows.length || forecast?.sourceTrust !== 'uploaded_file') return null;

    const source = sourceLabel('student_stats', forecast.sourceLabel || 'Population forecast dataset');
    return asResult({
        text: 'สร้างกราฟแนวโน้มประชากรวัยเรียนและอุปสงค์ต่อคณะวิทยาศาสตร์จากข้อมูลที่นำเข้าแล้วครับ',
        chart: {
            chartType: 'line',
            data: {
                labels: rows.map(row => String(row.year)),
                datasets: [
                    {
                        label: 'ดัชนีประชากรวัยเรียน',
                        data: rows.map(row => row.youthPopulationIndex),
                        borderColor: 'var(--accent-blue)',
                        backgroundColor: 'color-mix(in srgb, var(--accent-blue) 12%, transparent)',
                        tension: 0.3,
                        fill: false,
                    },
                    {
                        label: 'ดัชนีความต้องการคณะวิทยาศาสตร์',
                        data: rows.map(row => row.expectedScienceDemandIndex),
                        borderColor: 'var(--accent-success)',
                        backgroundColor: 'color-mix(in srgb, var(--accent-success) 12%, transparent)',
                        tension: 0.3,
                        fill: false,
                    },
                ],
            },
            options: {
                plugins: {
                    title: { display: true, text: 'แนวโน้มประชากรวัยเรียนและอุปสงค์ต่อคณะวิทยาศาสตร์' },
                    legend: { position: 'bottom' },
                },
                scales: {
                    y: { beginAtZero: false, title: { display: true, text: 'ดัชนี' } },
                    x: { title: { display: true, text: 'ปีการศึกษา' } },
                },
            },
        },
        sources: [source],
    });
}

function buildStudentAwardsChartAnswer(question, userContext) {
    const accessDenied = denyIfNoAccess(userContext, ['student_stats']);
    if (accessDenied) return accessDenied;

    const stats = sharedDataset('student_stats', studentStatsData);
    const rows = Array.isArray(stats?.studentAwards)
        ? stats.studentAwards.filter(row => row && row.sourceTrust !== 'generated_mock')
        : [];
    if (!rows.length) return null;

    const text = q(question);
    const field = /สาขา|major/.test(text) ? 'major' : (/ระดับ|level/.test(text) ? 'level' : 'category');
    const label = field === 'major' ? 'สาขาวิชา' : (field === 'level' ? 'ระดับรางวัล' : 'ประเภทรางวัล');
    const counts = new Map();
    rows.forEach(row => {
        const key = String(row[field] || 'ไม่ระบุ').trim() || 'ไม่ระบุ';
        counts.set(key, (counts.get(key) || 0) + 1);
    });
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);

    return asResult({
        text: `สร้างกราฟจำนวนรางวัลนักศึกษาแยกตาม${label}จากทะเบียนรางวัลที่นำเข้าแล้วครับ`,
        chart: {
            chartType: 'bar',
            data: {
                labels: ranked.map(([name]) => name),
                datasets: [{
                    label: 'จำนวนรางวัล',
                    data: ranked.map(([, count]) => count),
                    backgroundColor: ranked.map((_, index) => PALETTE[index % PALETTE.length]),
                    borderRadius: 8,
                }],
            },
            options: {
                indexAxis: ranked.length > 6 ? 'y' : 'x',
                plugins: {
                    title: { display: true, text: `รางวัลนักศึกษาแยกตาม${label}` },
                    legend: { position: 'bottom' },
                },
                scales: {
                    y: { beginAtZero: true, ticks: { precision: 0 } },
                },
            },
        },
        sources: [sourceLabel('student_stats', 'Student awards register')],
    });
}

export function createPlannedChartAnswer(question, userContext = {}, options = {}) {
    const uploadedChart = buildUploadedFileChartAnswer(question, options.uploadedFileData);
    if (uploadedChart) return uploadedChart;
    const text = q(question);
    const hasAnalyticalChartSignal = /แผนรับ|จำนวน|กี่คน|กี่ชั่วโมง|กี่เปอร์เซ็นต์|สัดส่วน|แยกตาม|รายปี|รายรอบ|แต่ละรอบ|ภาพรวม|สรุป|แนวโน้ม|คืบหน้า|ต่ำกว่าเป้าหมาย|ความเสี่ยง|เร่ง|วิเคราะห์|เปรียบเทียบ|เทียบ|มากน้อย|แค่ไหน|ติดเงื่อนไข|ขาดเงื่อนไข|compare|comparison/.test(text);
    const hasChartableDomain = /tcas|admission|รับสมัคร|รับเข้า|สำเร็จ|พร้อมจบ|graduation|กิจกรรม|ชั่วโมงกิจกรรม|บุคลากร|อาจารย์|staff|hr|เกษียณ|ยุทธศาสตร์|okr|kpi|งบ|budget|รายรับ|รายจ่าย/.test(text);
    const inferredChartIntent = hasAnalyticalChartSignal && hasChartableDomain;
    if (!hasChartIntent(question) && !inferredChartIntent) return null;

    if (/tcas|admission|รับสมัคร|รับเข้า|แผนรับ|portfolio|quota/.test(text)) {
        return buildTcasChartAnswer(question, userContext);
    }
    if (/รายวิชา|วิชา|course|เกรดรายวิชา|กระจายเกรด|วิชาไหน|grade distribution/.test(text)) {
        return buildCourseChartAnswer(question, userContext);
    }
    if (/รางวัล|award/.test(text)) {
        return buildStudentAwardsChartAnswer(question, userContext);
    }
    if (/นักศึกษา|นิสิต|นศ\.?|student/.test(text) && /ประชากร|population|พยากรณ์|forecast/.test(text)) {
        return buildPopulationForecastChartAnswer(question, userContext);
    }
    if (/กิจกรรม|ชั่วโมงกิจกรรม|รับน้อง|ไหว้ครู|student life/.test(text)) {
        return buildStudentLifeChartAnswer(question, userContext);
    }
    if (/บุคลากร|อาจารย์|staff|hr|เกษียณ/.test(text)) {
        return buildHrChartAnswer(question, userContext);
    }
    if (/ยุทธศาสตร์|okr|kpi|ตัวชี้วัด|คำรับรอง/.test(text)) {
        return buildStrategicChartAnswer(question, userContext);
    }
    if (wantsStudentTrendChart(question)) {
        const studentTrendChart = buildScienceStudentTrendChartAnswer(question, userContext);
        if (studentTrendChart) return studentTrendChart;
    }
    if (/งบ|budget|รายรับ|รายจ่าย/.test(text) && /นักศึกษา|นิสิต|นศ\.?|student/.test(text)) {
        return buildBudgetStudentCompareAnswer(question, userContext);
    }
    if (/สำเร็จ|พร้อมจบ|เงื่อนไขจบ|graduation|ผู้สำเร็จ/.test(text)) {
        const comparison = /นักศึกษา|นิสิต|นศ\.?|student/.test(text) && /เปรียบเทียบ|เทียบ|เทียบกับ|compare|comparison/.test(text)
            ? buildStudentGraduationCompareAnswer(question, userContext)
            : null;
        return comparison || buildGraduationChartAnswer(question, userContext);
    }
    if (/นักศึกษา|นิสิต|นศ\.?|student/.test(text) && /สาขา|major|หลักสูตร|คณะวิทย|science/.test(text) && !/รายชื่อ|รายคน|รหัส\s*6|\b6\d{9}\b/.test(text)) {
        const scienceMajorChart = buildScienceMajorStudentChartAnswer(question, userContext);
        if (scienceMajorChart) return scienceMajorChart;
    }
    if (/นักศึกษา|นิสิต|นศ\.?|student/.test(text) && !/รายชื่อ|รายคน|รหัส\s*6|\b6\d{9}\b/.test(text)) {
        return buildDashboardFacultyCompareAnswer(question, userContext);
    }
    if (/งบ|budget|รายรับ|รายจ่าย/.test(text)) {
        return buildBudgetChartAnswer(question, userContext);
    }

    return null;
}

export function shouldPreferDeterministicChartAnswer(question) {
    const text = q(question);
    if (/กราฟ|chart|plot|แผนภูมิ|แผนภาพ/.test(text)) return true;
    return /tcas.*(?:แต่ละรอบ|รับกี่คน|รอบไหน.*(?:เสี่ยง|ไม่เต็ม))|(?:แต่ละรอบ|รับกี่คน).*(?:tcas|รับสมัคร)|(?:kpi|ตัวชี้วัด).*(?:ต้องเร่ง|เร่งด่วน|จัดลำดับ)/.test(text);
}
