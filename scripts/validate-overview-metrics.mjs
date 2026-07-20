import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
    OFFICIAL_STUDENT_LEVELS,
    OFFICIAL_STUDENT_TOTAL,
} from '../src/data/mjuOfficialStudentSnapshot.js';
import { resolveOverviewMetrics } from '../src/utils/overviewMetricResolver.js';

let passed = 0;

function check(label, callback) {
    callback();
    passed += 1;
    console.log(`PASS ${label}`);
}

const fallbackMetrics = resolveOverviewMetrics({
    dashboardSummary: {
        totalStudents: OFFICIAL_STUDENT_TOTAL,
        totalCourses: 847,
        avgGPA: 3.12,
        graduationRate: 89.5,
        faculties: [
            { name: 'คณะวิทยาศาสตร์', totalCourses: 156, avgGPA: 3.18, graduationRate: 91.2 },
        ],
    },
    dashboardMeta: { sourceType: 'fallback', isLive: false },
    studentStats: {
        current: { total: OFFICIAL_STUDENT_TOTAL },
        sourceCoverage: {
            officialSnapshot: { fields: ['current.total'] },
        },
    },
    studentMeta: { sourceType: 'fallback', isLive: false },
});

check('official student snapshot remains available when live sync is unavailable', () => {
    assert.equal(fallbackMetrics.students.value, OFFICIAL_STUDENT_TOTAL);
    assert.equal(fallbackMetrics.students.status, 'verified');
});

check('overview remains complete with internal reference values when endpoints are unavailable', () => {
    assert.equal(fallbackMetrics.courses.value, 847);
    assert.equal(fallbackMetrics.gpa.value, 3.12);
    assert.equal(fallbackMetrics.graduation.value, 89.5);
    assert.equal(fallbackMetrics.courses.scienceValue, 156);
    assert.equal(fallbackMetrics.gpa.scienceValue, 3.18);
    assert.equal(fallbackMetrics.graduation.scienceValue, 91.2);
    assert.equal(fallbackMetrics.courses.status, 'reference');
    assert.equal(fallbackMetrics.gpa.status, 'reference');
    assert.equal(fallbackMetrics.graduation.status, 'reference');
});

const verifiedCourseMetrics = resolveOverviewMetrics({
    courseAnalytics: {
        coursePlanByYear: [
            { semesters: [{ courses: [{ code: 'SCI101' }, { code: 'SCI102' }] }] },
            { semesters: [{ courses: [{ code: 'SCI101' }] }] },
        ],
        gradeDistributions: [
            { avgGpa: 3, enrolled: 10 },
            { avgGpa: 4, enrolled: 10 },
        ],
    },
    courseMeta: { sourceType: 'file_upload', isLive: true },
});

check('verified course upload resolves unique courses and weighted GPA', () => {
    assert.equal(verifiedCourseMetrics.courses.value, 2);
    assert.equal(verifiedCourseMetrics.courses.scope, 'science');
    assert.equal(verifiedCourseMetrics.gpa.value, 3.5);
    assert.equal(verifiedCourseMetrics.gpa.scope, 'science');
});

const verifiedGraduationMetrics = resolveOverviewMetrics({
    graduation: {
        history: [
            { year: 2567, rate: 88.4, type: 'actual' },
            { year: 2568, rate: 91.2, type: 'actual' },
            { year: 2569, rate: 93.5, type: 'forecast' },
        ],
    },
    graduationMeta: { sourceType: 'file_upload', isLive: true },
});

check('verified graduation upload uses the latest actual row, not forecast', () => {
    assert.equal(verifiedGraduationMetrics.graduation.value, 91.2);
    assert.equal(verifiedGraduationMetrics.graduation.scope, 'science');
});

const linkedGraduationMetrics = resolveOverviewMetrics({
    graduation: {
        current: { totalCandidates: 100, expectedGraduates: 82 },
        history: [{ year: 2568, rate: 99.9, type: 'actual' }],
    },
    graduationMeta: { sourceType: 'linked_realtime', isLive: true },
});

check('linked graduation uses current student calculation before fallback history', () => {
    assert.equal(linkedGraduationMetrics.graduation.value, 82);
    assert.equal(linkedGraduationMetrics.graduation.status, 'calculated');
});

check('official university degree levels reconcile to the current total', () => {
    const total = OFFICIAL_STUDENT_LEVELS.reduce((sum, row) => sum + Number(row.count || 0), 0);
    assert.equal(total, OFFICIAL_STUDENT_TOTAL);
});

const loginSource = await readFile(new URL('../src/pages/LoginPage.jsx', import.meta.url), 'utf8');
const dashboardSource = await readFile(new URL('../src/pages/DashboardHome.jsx', import.meta.url), 'utf8');
const syncPanelSource = await readFile(new URL('../src/components/AdminAutoSyncPanel.jsx', import.meta.url), 'utf8');

check('login and Overview forecast panels do not present legacy mock KPIs', () => {
    assert.doesNotMatch(loginSource, /<strong>847<\/strong>|<strong>89\.5%<\/strong>/);
    assert.doesNotMatch(dashboardSource, /actual:\s*'89\.5%'|forecast:\s*'92\.1%'/);
});

check('source-quality explanation stays in Auto Sync instead of Overview cards', () => {
    assert.doesNotMatch(dashboardSource, /\{card\.statusLabel\}|\{sciData\.statusLabel\}/);
    assert.match(syncPanelSource, /ใช้ชุดข้อมูลในระบบเติมตัวชี้วัดที่ยังรอ endpoint/);
});

console.log(`\nOverview metric audit passed: ${passed} checks`);
