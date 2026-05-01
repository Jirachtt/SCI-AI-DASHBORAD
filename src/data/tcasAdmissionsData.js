export const tcasSources = [
    {
        label: 'TCAS Science MJU',
        url: 'https://sciencebase.mju.ac.th/tcas/',
        note: 'รายชื่อหลักสูตรคณะวิทยาศาสตร์ที่เปิดรับนักศึกษา',
        status: 'official_public',
    },
    {
        label: 'Admissions MJU 214.pdf',
        url: 'https://admissions.mju.ac.th/FileAnnouncement/214.pdf',
        note: 'ร่างเกณฑ์ TCAS รอบ 3 Admission ปีการศึกษา 2569',
        status: 'official_public',
    },
    {
        label: 'ไฟล์ย้อนหลังจากหน่วยรับเข้า/Reg',
        url: '',
        note: 'ต้องนำเข้าเพิ่มเพื่อให้ตัวเลขย้อนหลัง 5 ปีเป็นข้อมูลจริงครบทุก TCAS round',
        status: 'waiting_for_internal_file',
    },
];

export const tcasRound3Plan2569 = [
    { major: 'วิทยาการคอมพิวเตอร์', plan: 10, minGpax: 3.0, subjectFocus: 'คณิตศาสตร์/วิทยาศาสตร์/ภาษาอังกฤษ', sourceStatus: 'official_public' },
    { major: 'เทคโนโลยีชีวภาพ', plan: 10, minGpax: 2.0, subjectFocus: 'ชีววิทยา/เคมี/วิทยาศาสตร์ประยุกต์', sourceStatus: 'official_public' },
    { major: 'เคมี', plan: 10, minGpax: 2.0, subjectFocus: 'เคมี/คณิตศาสตร์/วิทยาศาสตร์ประยุกต์', sourceStatus: 'official_public' },
    { major: 'สถิติและการจัดการสารสนเทศ', plan: 20, minGpax: 2.0, subjectFocus: 'คณิตศาสตร์/สถิติ/ภาษาอังกฤษ', sourceStatus: 'official_public', note: 'รวมแบบที่ 1 และแบบที่ 2' },
    { major: 'คณิตศาสตร์', plan: 10, minGpax: 2.0, subjectFocus: 'คณิตศาสตร์ประยุกต์', sourceStatus: 'official_public' },
    { major: 'เทคโนโลยีสารสนเทศ', plan: 20, minGpax: 2.5, subjectFocus: 'คณิตศาสตร์/วิทยาศาสตร์/ภาษาอังกฤษ', sourceStatus: 'official_public' },
    { major: 'นวัตกรรมวัสดุ', plan: 10, minGpax: 2.0, subjectFocus: 'วิทยาศาสตร์ประยุกต์/ฟิสิกส์/เคมี', sourceStatus: 'official_public' },
    { major: 'นวัตกรรมเคมีอุตสาหกรรม', plan: 10, minGpax: 2.5, subjectFocus: 'เคมี/คณิตศาสตร์/วิทยาศาสตร์ประยุกต์', sourceStatus: 'official_public' },
    { major: 'ฟิสิกส์ประยุกต์', plan: 10, minGpax: 2.0, subjectFocus: 'ฟิสิกส์/คณิตศาสตร์', sourceStatus: 'official_public' },
];

export const tcasRoundPlan2569 = [
    { round: 'Portfolio 1.1', plan: 42, enrolled: 31, sourceStatus: 'waiting_for_internal_file' },
    { round: 'Portfolio 1.2', plan: 28, enrolled: 19, sourceStatus: 'waiting_for_internal_file' },
    { round: 'Quota', plan: 52, enrolled: 36, sourceStatus: 'waiting_for_internal_file' },
    { round: 'Admission', plan: 110, enrolled: null, sourceStatus: 'official_public' },
    { round: 'Direct Admission', plan: 24, enrolled: null, sourceStatus: 'waiting_for_internal_file' },
];

export const tcasFiveYearTrend = [
    { year: 2565, plan: 210, applicants: 690, admitted: 185, enrolled: 146, retained: 128, withdrawn: 18, lateReport: 9, sourceStatus: 'seed_waiting_file' },
    { year: 2566, plan: 205, applicants: 742, admitted: 192, enrolled: 151, retained: 136, withdrawn: 15, lateReport: 12, sourceStatus: 'seed_waiting_file' },
    { year: 2567, plan: 215, applicants: 768, admitted: 201, enrolled: 158, retained: 142, withdrawn: 16, lateReport: 10, sourceStatus: 'seed_waiting_file' },
    { year: 2568, plan: 220, applicants: 801, admitted: 206, enrolled: 163, retained: 149, withdrawn: 14, lateReport: 11, sourceStatus: 'seed_waiting_file' },
    { year: 2569, plan: 256, applicants: 840, admitted: 224, enrolled: 171, retained: 158, withdrawn: 13, lateReport: 8, sourceStatus: 'mixed_official_seed' },
];

export const tcasMajorOutlook = [
    { major: 'วิทยาการคอมพิวเตอร์', demandIndex: 94, risk: 'แข่งขันสูง', nextAction: 'เพิ่มคอนเทนต์ portfolio + AI/Data showcase', target2570: 35 },
    { major: 'เทคโนโลยีสารสนเทศ', demandIndex: 88, risk: 'แข่งขันสูง', nextAction: 'ทำแคมเปญ IT career path และวิชาข้ามสาขา', target2570: 38 },
    { major: 'สถิติและการจัดการสารสนเทศ', demandIndex: 84, risk: 'โอกาสเติบโต', nextAction: 'สื่อสารจุดขาย Data/BI/ประกันภัย', target2570: 34 },
    { major: 'เคมี', demandIndex: 73, risk: 'ต้องเร่ง conversion', nextAction: 'ชู lab skill + อุตสาหกรรมเคมีสีเขียว', target2570: 24 },
    { major: 'เทคโนโลยีชีวภาพ', demandIndex: 76, risk: 'ต้องเร่ง conversion', nextAction: 'เชื่อมงานวิจัย biotech/food/agri innovation', target2570: 25 },
    { major: 'คณิตศาสตร์', demandIndex: 68, risk: 'ตลาดเฉพาะทาง', nextAction: 'ทำเส้นทางอาชีพ data/math educator/actuary', target2570: 18 },
    { major: 'ฟิสิกส์ประยุกต์', demandIndex: 62, risk: 'ต้องสร้าง awareness', nextAction: 'ชู sensor/material/energy applications', target2570: 16 },
    { major: 'นวัตกรรมวัสดุ', demandIndex: 70, risk: 'ต้องสร้าง awareness', nextAction: 'สื่อสารวัสดุเพื่อเกษตรและสิ่งแวดล้อม', target2570: 20 },
    { major: 'นวัตกรรมเคมีอุตสาหกรรม', demandIndex: 72, risk: 'หลักสูตรอยู่ระหว่างปรับภาพจำ', nextAction: 'ย้ำอุตสาหกรรมและสหกิจศึกษา', target2570: 21 },
];

export const tcasPlanningData = {
    sources: tcasSources,
    round3Plan2569: tcasRound3Plan2569,
    roundPlan2569: tcasRoundPlan2569,
    fiveYearTrend: tcasFiveYearTrend,
    majorOutlook: tcasMajorOutlook,
    planningAssumptions: {
        tuitionPerTerm: 18500,
        termsInProgram: 8,
        targetRetentionRate2570: 0.9,
        note: 'ตัวเลขย้อนหลังเป็น working seed เพื่อออกแบบ dashboard รอไฟล์จริงจาก Admissions/Reg',
    },
};

export function getTcasSummary(data = tcasPlanningData) {
    const latest = data.fiveYearTrend.at(-1);
    const previous = data.fiveYearTrend.at(-2);
    const officialRound3Plan = data.round3Plan2569.reduce((sum, item) => sum + item.plan, 0);
    const retentionRate = latest?.enrolled ? latest.retained / latest.enrolled : 0;
    const enrollmentGrowth = previous?.enrolled ? ((latest.enrolled - previous.enrolled) / previous.enrolled) * 100 : 0;

    return {
        officialRound3Plan,
        latestYear: latest?.year,
        latestEnrolled: latest?.enrolled || 0,
        latestRetained: latest?.retained || 0,
        latestWithdrawn: latest?.withdrawn || 0,
        retentionRate,
        enrollmentGrowth,
    };
}

export function calculateTcasImpact({
    intake = 100,
    attritionRate = 12,
    tuitionPerTerm = 18500,
    terms = 8,
} = {}) {
    const lostStudents = Math.round(Number(intake || 0) * (Number(attritionRate || 0) / 100));
    const retainedStudents = Math.max(0, Number(intake || 0) - lostStudents);
    const revenuePerStudent = Number(tuitionPerTerm || 0) * Number(terms || 0);
    const lostRevenue = lostStudents * revenuePerStudent;
    const retainedRevenue = retainedStudents * revenuePerStudent;

    return {
        intake: Number(intake || 0),
        lostStudents,
        retainedStudents,
        revenuePerStudent,
        lostRevenue,
        retainedRevenue,
    };
}
