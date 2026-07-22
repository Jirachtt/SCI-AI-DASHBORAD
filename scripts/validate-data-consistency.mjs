import {
    OFFICIAL_SCIENCE_ENROLLMENT_ROWS,
    OFFICIAL_SCIENCE_ROSTER_YEAR_TARGETS,
    OFFICIAL_SCIENCE_STUDENT_LEVELS,
    OFFICIAL_SCIENCE_STUDENT_TOTAL,
    OFFICIAL_STUDENT_ENROLLMENT_ROWS,
    OFFICIAL_STUDENT_FACULTY_ROWS,
    OFFICIAL_STUDENT_LEVELS,
    OFFICIAL_STUDENT_SNAPSHOT_DATE,
    OFFICIAL_STUDENT_SOURCE_URL,
    OFFICIAL_STUDENT_TOTAL,
} from '../src/data/mjuOfficialStudentSnapshot.js';
import { scienceStudentList } from '../src/data/studentListData.js';
import {
    tcasFiveYearTrend,
    tcasIntakeTarget2570,
    tcasRound3Plan2569,
    tcasRoundPlan2569,
} from '../src/data/tcasAdmissionsData.js';
import { gradeDistributions, coursePlanByYear } from '../src/data/courseAnalyticsData.js';
import {
    getScienceActivitySummary,
    SCIENCE_ACTIVITY_REQUIREMENT,
    scienceActivityEvents,
} from '../src/data/scienceActivitiesData.js';
import {
    officialFinancialData,
    officialScienceBudgetData,
    officialStrategicData,
    officialTuitionData,
} from '../src/data/officialPlanningData.js';
import {
    currentGraduationStats,
    graduationByMajor,
    graduationCandidateList,
    graduationHistory,
} from '../src/data/graduationData.js';
import { hrData } from '../src/data/hrData.js';
import { researchData } from '../src/data/researchData.js';
import { scienceFacultyBudgetData } from '../src/data/mockData.js';

const results = [];

function record(status, label, detail = '') {
    results.push({ status, label, detail });
}

function assert(condition, label, detail = '') {
    record(condition ? 'PASS' : 'FAIL', label, detail);
}

function warn(condition, label, detail = '') {
    if (condition) record('WARN', label, detail);
}

function sum(rows, selector) {
    return rows.reduce((total, row) => total + Number(selector(row) || 0), 0);
}

function closeTo(actual, expected, tolerance = 0.01) {
    return Math.abs(Number(actual) - Number(expected)) <= tolerance;
}

function rowPartsTotal(row) {
    return Number(row.certificate || 0)
        + Number(row.bachelor || 0)
        + Number(row.master || 0)
        + Number(row.doctoral || 0);
}

function allFiniteNonNegative(value, path = 'root') {
    if (typeof value === 'number') {
        return Number.isFinite(value) && value >= 0 ? [] : [path];
    }
    if (Array.isArray(value)) {
        return value.flatMap((item, index) => allFiniteNonNegative(item, `${path}[${index}]`));
    }
    if (value && typeof value === 'object') {
        return Object.entries(value).flatMap(([key, item]) => allFiniteNonNegative(item, `${path}.${key}`));
    }
    return [];
}

// Latest official public student snapshot.
assert(
    sum(OFFICIAL_STUDENT_LEVELS, row => row.count) === OFFICIAL_STUDENT_TOTAL,
    'Official university level totals equal the university total',
    `${sum(OFFICIAL_STUDENT_LEVELS, row => row.count).toLocaleString()} / ${OFFICIAL_STUDENT_TOTAL.toLocaleString()}`,
);
assert(
    sum(OFFICIAL_STUDENT_FACULTY_ROWS, row => row.total) === OFFICIAL_STUDENT_TOTAL,
    'Official faculty totals equal the university total',
    `${sum(OFFICIAL_STUDENT_FACULTY_ROWS, row => row.total).toLocaleString()} / ${OFFICIAL_STUDENT_TOTAL.toLocaleString()}`,
);
assert(
    OFFICIAL_STUDENT_FACULTY_ROWS.every(row => rowPartsTotal(row) === row.total),
    'Every official faculty row reconciles by degree level',
);
assert(
    OFFICIAL_STUDENT_ENROLLMENT_ROWS.every(row => rowPartsTotal(row) === row.total)
        && sum(OFFICIAL_STUDENT_ENROLLMENT_ROWS, row => row.total) === OFFICIAL_STUDENT_TOTAL,
    'University entry-year rows reconcile to the official total',
);

const scienceFacultyRow = OFFICIAL_STUDENT_FACULTY_ROWS.find(row => row.name.includes('วิทยาศาสตร์'));
assert(
    scienceFacultyRow?.total === OFFICIAL_SCIENCE_STUDENT_TOTAL,
    'Science faculty total matches the official faculty row',
    `${scienceFacultyRow?.total ?? 'missing'} / ${OFFICIAL_SCIENCE_STUDENT_TOTAL}`,
);
assert(
    sum(OFFICIAL_SCIENCE_STUDENT_LEVELS, row => row.count) === OFFICIAL_SCIENCE_STUDENT_TOTAL,
    'Science degree-level totals equal the science total',
);
assert(
    OFFICIAL_SCIENCE_ENROLLMENT_ROWS.every(row => rowPartsTotal(row) === row.total)
        && sum(OFFICIAL_SCIENCE_ENROLLMENT_ROWS, row => row.total) === OFFICIAL_SCIENCE_STUDENT_TOTAL,
    'Science entry-year rows reconcile to the official total',
);

// Generated demo roster must always align with the latest official aggregate.
const rosterByLevel = new Map();
const rosterByYear = new Map();
for (const student of scienceStudentList) {
    rosterByLevel.set(student.level, (rosterByLevel.get(student.level) || 0) + 1);
    if (student.level === 'ปริญญาตรี') {
        rosterByYear.set(student.year, (rosterByYear.get(student.year) || 0) + 1);
    }
}
assert(
    scienceStudentList.length === OFFICIAL_SCIENCE_STUDENT_TOTAL,
    'Generated roster row count equals the latest official science total',
    `${scienceStudentList.length} / ${OFFICIAL_SCIENCE_STUDENT_TOTAL}`,
);
assert(
    new Set(scienceStudentList.map(student => student.id)).size === scienceStudentList.length,
    'Generated roster student IDs are unique',
);
assert(
    OFFICIAL_SCIENCE_STUDENT_LEVELS.every(row => (rosterByLevel.get(row.level) || 0) === row.count),
    'Generated roster degree levels reconcile to the official snapshot',
);
assert(
    OFFICIAL_SCIENCE_ROSTER_YEAR_TARGETS.every(row => (rosterByYear.get(row.year) || 0) === row.target),
    'Generated bachelor roster year groups match configured cohort targets',
);
assert(
    scienceStudentList.every(student => Number.isFinite(student.gpa) && student.gpa >= 0 && student.gpa <= 4),
    'Generated roster GPA values stay within 0.00-4.00',
);

// TCAS planning arithmetic and source status.
assert(
    tcasRound3Plan2569.length > 0 && tcasRound3Plan2569.every(row => row.plan > 0 && row.sourceStatus === 'official_public'),
    'TCAS round 3 plan rows are official-public and contain positive plans',
    `${sum(tcasRound3Plan2569, row => row.plan)} planned seats`,
);
assert(
    tcasIntakeTarget2570.every(row => row.projectedRevenuePerTerm === row.target2570 * row.tuitionPerTerm),
    'TCAS 2570 projected revenue equals target multiplied by tuition',
);
assert(
    tcasFiveYearTrend.every(row => row.retained + row.withdrawn === row.enrolled
        && closeTo(row.retentionRate, (row.retained / row.enrolled) * 100, 0.11)),
    'TCAS five-year demonstration funnel arithmetic is internally consistent',
);
const mockTcasRows = [...tcasRoundPlan2569, ...tcasFiveYearTrend]
    .filter(row => /mock/i.test(String(row.sourceStatus || ''))).length;
warn(
    mockTcasRows > 0,
    'TCAS historical/funnel rows still include presentation data',
    `${mockTcasRows} rows must not be presented as Reg/Admissions facts`,
);
warn(
    true,
    'Graduation completion history is presentation data until Reg/Graduation is connected',
    'The public employment-survey response rate is intentionally not treated as a graduation rate',
);

// Course and grade consistency.
assert(
    gradeDistributions.every(row => sum(Object.values(row.grades || {}), value => value) === row.enrolled),
    'Every course grade distribution equals its enrolled count',
);
assert(
    gradeDistributions.every(row => row.avgGpa >= 0 && row.avgGpa <= 4),
    'Every course average GPA stays within 0.00-4.00',
);
assert(
    [1, 2, 3, 4].every(year => coursePlanByYear.some(row => row.year === year)),
    'Course plan covers study years 1-4',
);

// Activity records and requirement arithmetic.
assert(
    scienceActivityEvents.every(event => !Number.isNaN(Date.parse(event.startDate))
        && !Number.isNaN(Date.parse(event.endDate || event.startDate))
        && Date.parse(event.endDate || event.startDate) >= Date.parse(event.startDate)),
    'Activity dates are valid and ordered',
);
assert(
    scienceActivityEvents.every(event => event.hours > 0
        && event.capacity >= 0
        && event.registeredCount >= 0
        && event.registeredCount <= event.capacity),
    'Activity hours and registration counts are valid',
);
const presentationActivityWindow = getScienceActivitySummary(new Date('2026-07-22T12:00:00+07:00'));
assert(
    presentationActivityWindow.thisMonth.length >= 3
        && presentationActivityWindow.nextMonth.length >= 3,
    'Activity calendar includes July and August 2569 presentation data',
);
assert(
    [...presentationActivityWindow.thisMonth, ...presentationActivityWindow.nextMonth]
        .every(event => event.isMock === true && /^https:\/\//u.test(event.sourceUrl || '')),
    'Presentation activity mocks retain official MJU source URLs',
);
assert(
    SCIENCE_ACTIVITY_REQUIREMENT.completedHours <= SCIENCE_ACTIVITY_REQUIREMENT.targetHours
        && SCIENCE_ACTIVITY_REQUIREMENT.completedEvents <= SCIENCE_ACTIVITY_REQUIREMENT.requiredEvents,
    'Activity completion does not exceed configured requirements',
);

// Official workbook-derived finance, tuition and strategy data.
assert(
    officialScienceBudgetData.yearly.every(row => closeTo(row.revenue - row.expense, row.surplus, 0.02)),
    'Budget yearly revenue minus expense equals surplus',
);
assert(
    scienceFacultyBudgetData.yearly.every(row => /^ประมาณการ-\d+$/u.test(String(row.source || ''))),
    'Science budget display excludes unsourced mock history when workbook forecasts exist',
);
assert(
    scienceFacultyBudgetData.unit === 'million baht' && scienceFacultyBudgetData.yearly[0]?.year === '2570',
    'Science budget display keeps workbook unit and starts at the first sourced forecast year',
);
const estimate = officialFinancialData.officialEstimate;
assert(
    sum(estimate.terms, row => row.students) === estimate.students
        && sum(estimate.terms, row => row.paid) === estimate.revenueAfterRisk
        && estimate.revenueAfterRisk - estimate.expense === estimate.surplus,
    'Official financial estimate reconciles terms, revenue, expense and surplus',
);
assert(
    officialTuitionData.flatRate.min > 0
        && officialTuitionData.flatRate.max >= officialTuitionData.flatRate.min
        && officialTuitionData.officialMajors.length > 0,
    'Tuition range and official major rows are populated',
);
assert(
    officialStrategicData.kpiReviewRows.length === officialStrategicData.kpiReviewSummary.totalKpis,
    'KPI review row count equals its summary total',
);

// Graduation, HR and research internal arithmetic.
assert(
    currentGraduationStats.expectedGraduates + currentGraduationStats.pending + currentGraduationStats.notPassed
        === currentGraduationStats.totalCandidates,
    'Graduation status counts equal total candidates',
);
assert(
    graduationCandidateList.length === currentGraduationStats.totalCandidates,
    'Graduation candidate rows equal the displayed candidate total',
);
assert(
    graduationByMajor.every(row => row.expected + row.pending + row.notPassed === row.total),
    'Graduation major rows reconcile by status',
);
assert(
    graduationHistory.every(row => closeTo(row.rate, (row.graduated / row.candidates) * 100, 0.11)),
    'Graduation history rates match graduated divided by candidates',
);

const scienceHr = hrData.scienceFaculty;
assert(
    scienceHr.academic + scienceHr.support === scienceHr.total
        && sum(scienceHr.byGender, row => row.count) === scienceHr.total
        && sum(scienceHr.byType, row => row.count) === scienceHr.total,
    'Science HR totals reconcile by employment group and gender',
);
assert(
    scienceHr.total === 173
        && scienceHr.academic === 113
        && scienceHr.support === 60
        && sum(scienceHr.academicPositions, row => row.count) === scienceHr.academic
        && sum(scienceHr.byEducation, row => row.count) === scienceHr.total,
    'Science HR fallback matches the latest public personnel snapshot',
    `total=${scienceHr.total}, academic=${scienceHr.academic}, support=${scienceHr.support}`,
);
assert(
    scienceHr.byDepartment.every(row => row.academic + row.support === row.total)
        && sum(scienceHr.byDepartment, row => row.total) === scienceHr.total,
    'Science HR department rows reconcile to the faculty total',
);
assert(
    researchData.publicationTrend.every(row => row.scopus + row.tci1 + row.tci2 + row.national === row.total),
    'Research publication trend rows reconcile by publication type',
);

const invalidNumericPaths = [
    ...allFiniteNonNegative(OFFICIAL_STUDENT_LEVELS, 'students.levels'),
    ...allFiniteNonNegative(OFFICIAL_STUDENT_FACULTY_ROWS, 'students.faculties'),
    ...allFiniteNonNegative(tcasIntakeTarget2570, 'tcas.targets'),
    ...allFiniteNonNegative(officialScienceBudgetData.yearly, 'budget.yearly'),
].filter(path => !/year$|minGpax$/.test(path));
assert(
    invalidNumericPaths.length === 0,
    'Core numeric datasets contain no negative, NaN or infinite values',
    invalidNumericPaths.slice(0, 5).join(', '),
);

const failures = results.filter(result => result.status === 'FAIL');
const warnings = results.filter(result => result.status === 'WARN');
for (const result of results) {
    const icon = result.status === 'PASS' ? '[PASS]' : result.status === 'WARN' ? '[WARN]' : '[FAIL]';
    console.log(`${icon} ${result.label}${result.detail ? ` - ${result.detail}` : ''}`);
}

console.log('\nData consistency summary');
console.log(`- Snapshot: ${OFFICIAL_STUDENT_SNAPSHOT_DATE} (${OFFICIAL_STUDENT_SOURCE_URL})`);
console.log(`- Checks: ${results.length - warnings.length - failures.length} passed, ${warnings.length} warnings, ${failures.length} failed`);
console.log(`- Official students: university ${OFFICIAL_STUDENT_TOTAL.toLocaleString()}, science ${OFFICIAL_SCIENCE_STUDENT_TOTAL.toLocaleString()}`);

if (failures.length > 0) process.exit(1);
