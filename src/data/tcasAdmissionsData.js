export const tcasSources = [
    {
        label: 'TCAS Science MJU',
        url: 'https://sciencebase.mju.ac.th/tcas/',
        note: 'หน้ารวมหลักสูตรคณะวิทยาศาสตร์ที่เปิดรับนักศึกษา',
        status: 'official_public',
    },
    {
        label: 'Admissions MJU 214.pdf',
        url: 'https://admissions.mju.ac.th/FileAnnouncement/214.pdf',
        note: 'ร่างเกณฑ์ TCAS รอบ 3 Admission ปีการศึกษา 2569',
        status: 'official_public',
    },
    {
        label: 'คำนวณประมาณการปี 70_Ver5.xlsx',
        url: '',
        note: 'ใช้แถว 1/2570 ระดับปริญญาตรี ชั้นปี 1 รหัส 70 เป็นเป้าหมายรับเข้า/นิสิตใหม่ปี 2570',
        status: 'internal_file',
    },
    {
        label: 'Admissions/Reg API',
        url: '',
        note: 'ยังต้องเชื่อมข้อมูลสมัคร ผ่าน รายงานตัว คงอยู่ และลาออก/หายไปย้อนหลังจากระบบรับเข้า/ทะเบียน',
        status: 'waiting_for_admissions_reg',
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
    { round: 'Portfolio 1.1', plan: null, enrolled: null, sourceStatus: 'waiting_for_admissions_reg' },
    { round: 'Portfolio 1.2', plan: null, enrolled: null, sourceStatus: 'waiting_for_admissions_reg' },
    { round: 'Quota', plan: null, enrolled: null, sourceStatus: 'waiting_for_admissions_reg' },
    { round: 'Admission', plan: 110, enrolled: null, sourceStatus: 'official_public' },
    { round: 'Direct Admission', plan: null, enrolled: null, sourceStatus: 'waiting_for_admissions_reg' },
];

// ยังไม่พบข้อมูลสมัคร/ผ่าน/รายงานตัว/คงอยู่ย้อนหลังในไฟล์ที่แนบมา จึงไม่ใส่เลข seed แทนข้อมูลจริง
export const tcasFiveYearTrend = [];

export const tcasIntakeTarget2570 = [
    { major: 'เทคโนโลยีชีวภาพ', target2570: 50, tuitionPerTerm: 20000, projectedRevenuePerTerm: 1000000, sourceSheet: 'ประมาณการ-70', sourceStatus: 'internal_file' },
    { major: 'เคมี', target2570: 40, tuitionPerTerm: 20000, projectedRevenuePerTerm: 800000, sourceSheet: 'ประมาณการ-70', sourceStatus: 'internal_file' },
    { major: 'นวัตกรรมวัสดุ', target2570: 40, tuitionPerTerm: 15000, projectedRevenuePerTerm: 600000, sourceSheet: 'ประมาณการ-70', sourceStatus: 'internal_file' },
    { major: 'คณิตศาสตร์', target2570: 25, tuitionPerTerm: 18000, projectedRevenuePerTerm: 450000, sourceSheet: 'ประมาณการ-70', sourceStatus: 'internal_file' },
    { major: 'สถิติและการจัดการสารสนเทศ', target2570: 25, tuitionPerTerm: 16000, projectedRevenuePerTerm: 400000, sourceSheet: 'ประมาณการ-70', sourceStatus: 'internal_file' },
    { major: 'วิทยาการคอมพิวเตอร์', target2570: 60, tuitionPerTerm: 20000, projectedRevenuePerTerm: 1200000, sourceSheet: 'ประมาณการ-70', sourceStatus: 'internal_file' },
    { major: 'เทคโนโลยีสารสนเทศ', target2570: 60, tuitionPerTerm: 14000, projectedRevenuePerTerm: 840000, sourceSheet: 'ประมาณการ-70', sourceStatus: 'internal_file' },
    { major: 'ฟิสิกส์ประยุกต์', target2570: 25, tuitionPerTerm: 16000, projectedRevenuePerTerm: 400000, sourceSheet: 'ประมาณการ-70', sourceStatus: 'internal_file' },
    { major: 'นวัตกรรมเคมีอุตสาหกรรม', target2570: 30, tuitionPerTerm: 22000, projectedRevenuePerTerm: 660000, sourceSheet: 'ประมาณการ-70', sourceStatus: 'internal_file' },
    { major: 'วิทยาการข้อมูลและปัญญาประดิษฐ์', target2570: 40, tuitionPerTerm: 16000, projectedRevenuePerTerm: 640000, sourceSheet: 'ประมาณการ-70', sourceStatus: 'internal_file' },
];

export const tcasMajorOutlook = [
    { major: 'วิทยาการคอมพิวเตอร์', demandIndex: 94, risk: 'แข่งขันสูง', nextAction: 'เพิ่มคอนเทนต์ portfolio + AI/Data showcase', target2570: 60, sourceStatus: 'internal_file' },
    { major: 'เทคโนโลยีสารสนเทศ', demandIndex: 88, risk: 'แข่งขันสูง', nextAction: 'ทำแคมเปญ IT career path และวิชาข้ามสาขา', target2570: 60, sourceStatus: 'internal_file' },
    { major: 'สถิติและการจัดการสารสนเทศ', demandIndex: 84, risk: 'โอกาสเติบโต', nextAction: 'สื่อสารจุดขาย Data/BI/ประกันภัย', target2570: 25, sourceStatus: 'internal_file' },
    { major: 'เคมี', demandIndex: 73, risk: 'ต้องเร่ง conversion', nextAction: 'ชู lab skill + อุตสาหกรรมเคมีสีเขียว', target2570: 40, sourceStatus: 'internal_file' },
    { major: 'เทคโนโลยีชีวภาพ', demandIndex: 76, risk: 'ต้องเร่ง conversion', nextAction: 'เชื่อมงานวิจัย biotech/food/agri innovation', target2570: 50, sourceStatus: 'internal_file' },
    { major: 'คณิตศาสตร์', demandIndex: 68, risk: 'ตลาดเฉพาะทาง', nextAction: 'ทำเส้นทางอาชีพ data/math educator/actuary', target2570: 25, sourceStatus: 'internal_file' },
    { major: 'ฟิสิกส์ประยุกต์', demandIndex: 62, risk: 'ต้องสร้าง awareness', nextAction: 'ชู sensor/material/energy applications', target2570: 25, sourceStatus: 'internal_file' },
    { major: 'นวัตกรรมวัสดุ', demandIndex: 70, risk: 'ต้องสร้าง awareness', nextAction: 'สื่อสารวัสดุเพื่อเกษตรและสิ่งแวดล้อม', target2570: 40, sourceStatus: 'internal_file' },
    { major: 'นวัตกรรมเคมีอุตสาหกรรม', demandIndex: 72, risk: 'หลักสูตรอยู่ระหว่างปรับภาพจำ', nextAction: 'ย้ำอุตสาหกรรมและสหกิจศึกษา', target2570: 30, sourceStatus: 'internal_file' },
    { major: 'วิทยาการข้อมูลและปัญญาประดิษฐ์', demandIndex: 86, risk: 'หลักสูตรใหม่ต้องเร่งรับรู้', nextAction: 'สื่อสารเส้นทางอาชีพ data/AI และผลงานจริงของผู้เรียน', target2570: 40, sourceStatus: 'internal_file' },
];

export const tcasPlanningData = {
    sources: tcasSources,
    round3Plan2569: tcasRound3Plan2569,
    roundPlan2569: tcasRoundPlan2569,
    fiveYearTrend: tcasFiveYearTrend,
    intakeTarget2570: tcasIntakeTarget2570,
    majorOutlook: tcasMajorOutlook,
    planningAssumptions: {
        tuitionPerTerm: 18500,
        termsInProgram: 8,
        targetRetentionRate2570: 0.9,
        note: 'รอบ 3 ปี 2569 ใช้ประกาศทางการจาก Admissions MJU 214.pdf; เป้าหมายปี 2570 ใช้ไฟล์คำนวณประมาณการปี 70_Ver5.xlsx; ข้อมูลสมัคร ผ่าน รายงานตัว คงอยู่ และลาออก/หายไปย้อนหลังยังไม่พบในไฟล์ที่แนบมา จึงรอเชื่อม Admissions/Reg API แทนการใช้เลข seed',
    },
};

export function getTcasSummary(data = tcasPlanningData) {
    const latest = data.fiveYearTrend?.at?.(-1) || null;
    const previous = data.fiveYearTrend?.at?.(-2) || null;
    const officialRound3Plan = (data.round3Plan2569 || []).reduce((sum, item) => sum + Number(item.plan || 0), 0);
    const intakeTarget2570Total = (data.intakeTarget2570 || []).reduce((sum, item) => sum + Number(item.target2570 || 0), 0);
    const retentionRate = latest?.enrolled ? latest.retained / latest.enrolled : null;
    const enrollmentGrowth = previous?.enrolled ? ((latest.enrolled - previous.enrolled) / previous.enrolled) * 100 : null;

    return {
        officialRound3Plan,
        intakeTarget2570Total,
        latestYear: latest?.year || null,
        latestEnrolled: latest?.enrolled ?? null,
        latestRetained: latest?.retained ?? null,
        latestWithdrawn: latest?.withdrawn ?? null,
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
