import { courseAnalyticsData } from '../data/courseAnalyticsData';
import { graduationHistory } from '../data/graduationData';
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

const PALETTE = ['var(--accent-success)', 'var(--accent-blue)', 'var(--accent-purple)', 'var(--accent-orange)', 'var(--accent-danger)', 'var(--accent-cyan)'];
const CHART_PATTERN = /กราฟ|chart|plot|แผนภูมิ|แผนภาพ|visual|เปรียบเทียบ|แนวโน้ม|trend|กระจาย|distribution/i;

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
    return `${fallbackLabel} (${status}${updated})`;
}

function hasChartIntent(question) {
    return CHART_PATTERN.test(String(question || ''));
}

function asResult({ text, chart, sources = [], trustWarnings = [], usageMode = 'deterministic_chart' }) {
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
    return {
        text: `${text}${sourceText}${warningText}`.trim(),
        chart: nextChart,
        sources,
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
    const target = Array.isArray(data?.intakeTarget2570) ? data.intakeTarget2570 : [];
    const labels = [...new Set([
        ...round3.map(row => row.major),
        ...target.map(row => row.major),
    ].filter(Boolean))];
    return {
        round3,
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
    if (!budgetRows.length || !studentTrend.length) return null;

    const studentByYear = new Map(studentTrend.map(row => [String(row.year), number(row.total ?? row.count)]));
    const rows = budgetRows
        .map(row => ({
            year: String(row.year),
            revenue: number(row.revenue),
            expense: number(row.expense),
            students: number(row.students ?? studentByYear.get(String(row.year))),
        }))
        .filter(row => row.revenue || row.expense || row.students);

    if (!rows.length) return null;

    return asResult({
        text: 'สร้างกราฟเปรียบเทียบ **งบประมาณคณะวิทยาศาสตร์** กับ **จำนวนนักศึกษา/นิสิตใหม่ที่เชื่อมได้ในระบบ** ให้แล้วครับ ใช้แกนซ้ายเป็นล้านบาทและแกนขวาเป็นคน',
        chart: {
            chartType: 'line',
            data: {
                labels: rows.map(row => row.year),
                datasets: [
                    {
                        type: 'line',
                        label: 'รายรับ (ล้านบาท)',
                        data: rows.map(row => row.revenue),
                        borderColor: PALETTE[0],
                        backgroundColor: `${PALETTE[0]}22`,
                        tension: 0.35,
                        yAxisID: 'y',
                    },
                    {
                        type: 'line',
                        label: 'รายจ่าย (ล้านบาท)',
                        data: rows.map(row => row.expense),
                        borderColor: PALETTE[3],
                        backgroundColor: `${PALETTE[3]}22`,
                        tension: 0.35,
                        yAxisID: 'y',
                    },
                    {
                        type: 'bar',
                        label: 'นักศึกษา/นิสิตใหม่ (คน)',
                        data: rows.map(row => row.students),
                        backgroundColor: `${PALETTE[1]}99`,
                        borderColor: PALETTE[1],
                        borderWidth: 0,
                        borderRadius: 8,
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
        sources: [
            sourceLabel('science_budget', 'Faculty budget dataset'),
            sourceLabel('student_stats', 'Student statistics dataset'),
        ],
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
    const rows = Array.isArray(stats?.scienceFaculty?.byMajor)
        ? stats.scienceFaculty.byMajor
            .map(row => ({
                major: row.major || row.name,
                total: number(row.total ?? row.count),
                avgGPA: row.avgGPA ?? row.avgGpa,
            }))
            .filter(row => row.major && row.total)
        : [];
    if (!rows.length) return null;

    const wantsGpa = /gpa|เกรด|grade/.test(q(question));
    const hasGpa = rows.some(row => Number.isFinite(Number(row.avgGPA)));
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
            ? 'สร้างกราฟเปรียบเทียบ **จำนวนนักศึกษาและ GPA เฉลี่ยตามสาขาคณะวิทยาศาสตร์** ให้แล้วครับ'
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
        sources: [sourceLabel('student_stats', 'Student statistics dataset')],
    });
}

export function createPlannedChartAnswer(question, userContext = {}) {
    if (!hasChartIntent(question)) return null;
    const text = q(question);

    if (/tcas|admission|รับสมัคร|รับเข้า|แผนรับ|portfolio|quota/.test(text)) {
        return buildTcasChartAnswer(question, userContext);
    }
    if (/รายวิชา|วิชา|course|เกรดรายวิชา|กระจายเกรด|วิชาไหน|grade distribution/.test(text)) {
        return buildCourseChartAnswer(question, userContext);
    }
    if (/งบ|budget|รายรับ|รายจ่าย/.test(text) && /นักศึกษา|นิสิต|student/.test(text)) {
        return buildBudgetStudentCompareAnswer(question, userContext);
    }
    if (/สำเร็จ|จบ|graduation|ผู้สำเร็จ/.test(text) && /นักศึกษา|นิสิต|student/.test(text)) {
        return buildStudentGraduationCompareAnswer(question, userContext);
    }
    if (/นักศึกษา|นิสิต|student/.test(text) && /สาขา|major|หลักสูตร|คณะวิทย|science/.test(text) && !/รายชื่อ|รายคน|รหัส\s*6|\b6\d{9}\b/.test(text)) {
        const scienceMajorChart = buildScienceMajorStudentChartAnswer(question, userContext);
        if (scienceMajorChart) return scienceMajorChart;
    }
    if (/นักศึกษา|นิสิต|student/.test(text) && !/รายชื่อ|รายคน|รหัส\s*6|\b6\d{9}\b/.test(text)) {
        return buildDashboardFacultyCompareAnswer(question, userContext);
    }
    if (/งบ|budget|รายรับ|รายจ่าย/.test(text)) {
        return buildBudgetChartAnswer(question, userContext);
    }

    return null;
}
