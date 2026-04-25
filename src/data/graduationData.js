// ข้อมูลสถิติการสำเร็จการศึกษา คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้
// อ้างอิงจากข้อมูลนักศึกษาในระบบ + ข้อมูลสถิติย้อนหลัง

import { scienceStudentList } from './studentListData.js';

// ข้อมูลผู้สำเร็จการศึกษาย้อนหลัง (แยกตามปีการศึกษา)
export const graduationHistory = [
    { year: 2564, candidates: 180, graduated: 152, rate: 84.4, avgGPA: 2.89 },
    { year: 2565, candidates: 195, graduated: 168, rate: 86.2, avgGPA: 2.93 },
    { year: 2566, candidates: 210, graduated: 185, rate: 88.1, avgGPA: 2.97 },
    { year: 2567, candidates: 205, graduated: 182, rate: 88.8, avgGPA: 3.01 },
    { year: 2568, candidates: 220, graduated: 198, rate: 90.0, avgGPA: 3.05 },
];

// คำนวณข้อมูลจากนักศึกษาปัจจุบัน (ปี 4 = ผู้มีสิทธิ์รับปริญญา)
const year4Students = scienceStudentList.filter(s => s.year === 4 && s.level === 'ปริญญาตรี');
const gradStudents = scienceStudentList.filter(s => s.level === 'ปริญญาโท' || s.level === 'ปริญญาเอก');

// สถานะการสำเร็จการศึกษาของนักศึกษาปี 4 (จำลองจากข้อมูลจริง)
function classifyGraduationStatus(student) {
    if (student.gpa < 1.75) return 'ไม่ผ่านเกณฑ์';
    if (student.gpa >= 1.75 && student.gpa < 2.00) return 'รอพินิจ';
    if (student.status === 'รอพินิจ') return 'รอพินิจ';
    return 'คาดว่าสำเร็จ';
}

export const currentGraduationStats = {
    academicYear: 2569,
    semester: '1/2569',
    totalCandidates: year4Students.length,
    expectedGraduates: year4Students.filter(s => classifyGraduationStatus(s) === 'คาดว่าสำเร็จ').length,
    pending: year4Students.filter(s => classifyGraduationStatus(s) === 'รอพินิจ').length,
    notPassed: year4Students.filter(s => classifyGraduationStatus(s) === 'ไม่ผ่านเกณฑ์').length,
    avgGPA: +(year4Students.reduce((s, st) => s + st.gpa, 0) / year4Students.length).toFixed(2),
    gradStudentsCandidates: gradStudents.length,
};

// แยกตามสาขา
const majorMap = {};
year4Students.forEach(s => {
    if (!majorMap[s.major]) {
        majorMap[s.major] = { total: 0, expected: 0, pending: 0, notPassed: 0, totalGPA: 0 };
    }
    majorMap[s.major].total++;
    majorMap[s.major].totalGPA += s.gpa;
    const status = classifyGraduationStatus(s);
    if (status === 'คาดว่าสำเร็จ') majorMap[s.major].expected++;
    else if (status === 'รอพินิจ') majorMap[s.major].pending++;
    else majorMap[s.major].notPassed++;
});

export const graduationByMajor = Object.entries(majorMap).map(([major, data]) => ({
    major,
    total: data.total,
    expected: data.expected,
    pending: data.pending,
    notPassed: data.notPassed,
    avgGPA: +(data.totalGPA / data.total).toFixed(2),
    rate: +((data.expected / data.total) * 100).toFixed(1),
})).sort((a, b) => b.total - a.total);

// GPA Distribution ของผู้มีสิทธิ์รับปริญญา
export const gpaDistribution = [
    { range: '1.00-1.74', count: year4Students.filter(s => s.gpa >= 1.00 && s.gpa < 1.75).length, color: '#ef4444' },
    { range: '1.75-1.99', count: year4Students.filter(s => s.gpa >= 1.75 && s.gpa < 2.00).length, color: '#f97316' },
    { range: '2.00-2.49', count: year4Students.filter(s => s.gpa >= 2.00 && s.gpa < 2.50).length, color: '#eab308' },
    { range: '2.50-2.99', count: year4Students.filter(s => s.gpa >= 2.50 && s.gpa < 3.00).length, color: '#22c55e' },
    { range: '3.00-3.49', count: year4Students.filter(s => s.gpa >= 3.00 && s.gpa < 3.50).length, color: '#3b82f6' },
    { range: '3.50-4.00', count: year4Students.filter(s => s.gpa >= 3.50 && s.gpa <= 4.00).length, color: '#8b5cf6' },
];

// เกียรตินิยม
export const honorsData = {
    firstClass: year4Students.filter(s => s.gpa >= 3.50).length,       // เกียรตินิยมอันดับ 1
    secondClass: year4Students.filter(s => s.gpa >= 3.25 && s.gpa < 3.50).length, // เกียรตินิยมอันดับ 2
    normal: year4Students.filter(s => s.gpa >= 2.00 && s.gpa < 3.25).length,      // ปกติ
    belowStandard: year4Students.filter(s => s.gpa < 2.00).length,     // ต่ำกว่าเกณฑ์
};

// รายชื่อนักศึกษาปี 4 พร้อมสถานะ
export const graduationCandidateList = year4Students.map(s => ({
    ...s,
    graduationStatus: classifyGraduationStatus(s),
    honors: s.gpa >= 3.50 ? 'เกียรตินิยมอันดับ 1' :
            s.gpa >= 3.25 ? 'เกียรตินิยมอันดับ 2' :
            s.gpa >= 2.00 ? 'ปกติ' : 'ต่ำกว่าเกณฑ์',
}));
