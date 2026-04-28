import { scienceFacultyBudgetData, universityBudgetData } from '../data/mockData';
import { graduationHistory } from '../data/graduationData';
import { getStudentListSync, isLiveData } from './studentDataService';
import { getDashboardDatasetSync } from './dashboardLiveDataService';

const STATIC_BUDGET_DATA = { scienceFacultyBudgetData, universityBudgetData };

function actualBudgetRows(source) {
    return (source?.yearly || []).filter(row => row.type === 'actual');
}

function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function yearFromStudentId(student) {
    const explicitYear = toNumber(student.admissionYear || student.enrollmentYear || student.entryYear);
    if (explicitYear >= 2500 && explicitYear <= 2600) return explicitYear;
    if (explicitYear >= 60 && explicitYear <= 99) return explicitYear + 2500;

    const id = String(student.id || student.student_id || student.studentId || '');
    const match = id.match(/^(\d{2})/);
    if (!match) return null;

    const shortYear = Number(match[1]);
    return shortYear >= 40 && shortYear <= 99 ? 2500 + shortYear : null;
}

function currentAcademicYearFromIds(students) {
    const years = students.map(yearFromStudentId).filter(Boolean);
    return years.length > 0 ? Math.max(...years) : new Date().getFullYear() + 543;
}

export function getLiveStudentAdmissionSeries() {
    const students = getStudentListSync();
    const currentAcademicYear = currentAcademicYearFromIds(students);
    const counts = new Map();

    for (const student of students) {
        let year = yearFromStudentId(student);
        if (!year) {
            const classYear = toNumber(student.year);
            if (classYear > 0) year = currentAcademicYear - classYear + 1;
        }
        if (!year) continue;
        counts.set(year, (counts.get(year) || 0) + 1);
    }

    return [...counts.entries()]
        .sort(([a], [b]) => a - b)
        .map(([x, y]) => ({ x, y }));
}

export function getLiveStudentSummary() {
    const students = getStudentListSync();
    const byMajor = {};
    const byClassYear = {};
    const byStatus = {};
    let gpaSum = 0;
    let gpaCount = 0;

    for (const student of students) {
        const major = student.major || 'ไม่ระบุสาขา';
        const classYear = student.year || 'ไม่ระบุ';
        const status = student.status || 'ไม่ระบุสถานะ';
        const gpa = Number(student.gpa);

        byMajor[major] = (byMajor[major] || 0) + 1;
        byClassYear[classYear] = (byClassYear[classYear] || 0) + 1;
        byStatus[status] = (byStatus[status] || 0) + 1;
        if (Number.isFinite(gpa)) {
            gpaSum += gpa;
            gpaCount += 1;
        }
    }

    return {
        total: students.length,
        source: isLiveData() ? 'ข้อมูล realtime จาก Firestore/การอัปโหลดล่าสุด' : 'ข้อมูล fallback ในระบบระหว่างรอการอัปโหลด',
        isLive: isLiveData(),
        avgGpa: gpaCount ? +(gpaSum / gpaCount).toFixed(2) : null,
        admissionSeries: getLiveStudentAdmissionSeries(),
        byMajor,
        byClassYear,
        byStatus,
    };
}

export function getForecastSeries(key) {
    const universityBudgetData = getDashboardDatasetSync('university_budget') || STATIC_BUDGET_DATA.universityBudgetData;
    const scienceFacultyBudgetData = getDashboardDatasetSync('science_budget') || STATIC_BUDGET_DATA.scienceFacultyBudgetData;
    switch (key) {
        case 'universityBudgetRevenue':
        case 'universityBudget':
            return actualBudgetRows(universityBudgetData).map(row => ({ x: Number(row.year), y: row.revenue }));
        case 'universityBudgetExpense':
            return actualBudgetRows(universityBudgetData).map(row => ({ x: Number(row.year), y: row.expense }));
        case 'scienceBudgetRevenue':
            return actualBudgetRows(scienceFacultyBudgetData).map(row => ({ x: Number(row.year), y: row.revenue }));
        case 'scienceBudgetExpense':
            return actualBudgetRows(scienceFacultyBudgetData).map(row => ({ x: Number(row.year), y: row.expense }));
        case 'universityStudents':
        case 'scienceStudents':
            return getLiveStudentAdmissionSeries();
        case 'scienceGPA':
            return graduationHistory.map(row => ({ x: row.year, y: row.avgGPA }));
        case 'scienceGraduationRate':
            return graduationHistory.map(row => ({ x: row.year, y: row.rate }));
        case 'scienceGraduated':
            return graduationHistory.map(row => ({ x: row.year, y: row.graduated }));
        default:
            return [];
    }
}

export function getForecastDataSourceNote(key) {
    if (key === 'universityStudents' || key === 'scienceStudents') {
        const summary = getLiveStudentSummary();
        return `${summary.source}; รวม ${summary.total.toLocaleString()} คน`;
    }
    if (key.includes('Budget')) {
        return 'ข้อมูลจริงชุดเดียวกับหน้า Budget Forecast ในเว็บ (actual rows only)';
    }
    return 'ข้อมูลจริงชุดเดียวกับหน้าเว็บในระบบ';
}

export function buildLiveDashboardMergeSummary() {
    const studentSeries = getLiveStudentAdmissionSeries();
    const revenueSeries = getForecastSeries('universityBudgetRevenue');
    const expenseSeries = getForecastSeries('universityBudgetExpense');
    const years = [...new Set([
        ...studentSeries.map(row => row.x),
        ...revenueSeries.map(row => row.x),
        ...expenseSeries.map(row => row.x),
    ])].sort((a, b) => a - b);

    return {
        headers: ['ปี', 'นักศึกษาในระบบ (ตามปีเข้า)', 'รายรับมหาวิทยาลัย (ล้านบาท)', 'รายจ่ายมหาวิทยาลัย (ล้านบาท)'],
        rows: years.map(year => ({
            year,
            students: studentSeries.find(row => row.x === year)?.y ?? null,
            universityRevenue: revenueSeries.find(row => row.x === year)?.y ?? null,
            universityExpense: expenseSeries.find(row => row.x === year)?.y ?? null,
        })),
    };
}

export function buildStudentStatsContextForAI() {
    const summary = getLiveStudentSummary();
    const byMajor = Object.entries(summary.byMajor)
        .sort((a, b) => b[1] - a[1])
        .map(([major, count]) => `${major}:${count}คน`)
        .join(', ');
    const byClassYear = Object.entries(summary.byClassYear)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([year, count]) => `ปี${year}:${count}คน`)
        .join(', ');
    const byStatus = Object.entries(summary.byStatus)
        .map(([status, count]) => `${status}:${count}คน`)
        .join(', ');
    const admission = summary.admissionSeries
        .map(row => `${row.x}:${row.y}คน`)
        .join(', ');

    return [
        `แหล่งข้อมูล: ${summary.source}`,
        `รวม: ${summary.total.toLocaleString()} คน`,
        `GPA เฉลี่ยจากรายชื่อปัจจุบัน: ${summary.avgGpa ?? 'ไม่มีข้อมูล'}`,
        `ตามสาขา: ${byMajor}`,
        `ตามชั้นปี: ${byClassYear}`,
        `ตามสถานะ: ${byStatus}`,
        `ตามปีเข้า/รหัสนักศึกษา: ${admission}`,
    ].join('\n');
}
