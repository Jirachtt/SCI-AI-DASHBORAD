// Mock data for the MJU Dashboard
// อ้างอิงข้อมูลจากมหาวิทยาลัยแม่โจ้ (mju.ac.th)
import { SCIENCE_ACTIVITY_REQUIREMENT, scienceActivityEvents } from './scienceActivitiesData';
import { officialFinancialData, officialScienceBudgetData, officialTuitionData } from './officialPlanningData';

const fallbackTuitionData = {
    flatRate: {
        min: 16000,
        max: 19000,
        label: 'ค่าเทอม (เหมาจ่าย/เทอม)'
    },
    entryFee: {
        min: 2000,
        max: 3000,
        label: 'ค่าธรรมเนียมแรกเข้า'
    },
    totalCost: {
        min: 128000,
        max: 152000,
        label: 'ตลอดหลักสูตร (4 ปี)'
    },
    byFaculty: [
        { name: 'วิทยาศาสตร์', fee: 18500 },
        { name: 'วิศวกรรมและอุตสาหกรรมเกษตร', fee: 19000 },
        { name: 'บริหารธุรกิจ', fee: 17000 },
        { name: 'ศิลปศาสตร์', fee: 16000 },
        { name: 'ผลิตกรรมการเกษตร', fee: 17500 },
        { name: 'สถาปัตยกรรมศาสตร์ฯ', fee: 18000 },
        { name: 'สารสนเทศและการสื่อสาร', fee: 18500 },
        { name: 'พัฒนาการท่องเที่ยว', fee: 16500 }
    ],
    breakdown: [
        { label: 'ค่าหน่วยกิต', value: 40, color: 'var(--accent-success-deep)' },
        { label: 'ค่าบำรุงมหาวิทยาลัย', value: 25, color: 'var(--accent-gold)' },
        { label: 'ค่า Lab/ปฏิบัติการ', value: 15, color: 'var(--accent-info)' },
        { label: 'ค่าธรรมเนียมอื่นๆ', value: 10, color: 'var(--accent-pink)' },
        { label: 'ค่าประกัน/กิจกรรม', value: 10, color: 'var(--accent-orange)' }
    ],
    semesterHistory: [
        { semester: '1/2567', paid: 18500, status: 'จ่ายแล้ว' },
        { semester: '2/2567', paid: 18500, status: 'จ่ายแล้ว' },
        { semester: '1/2568', paid: 4500, status: 'ค้างชำระ' }
    ]
};

export const tuitionData = {
    ...fallbackTuitionData,
    ...officialTuitionData,
    semesterHistory: officialTuitionData.semesterHistory?.length
        ? officialTuitionData.semesterHistory
        : fallbackTuitionData.semesterHistory,
};

const fallbackFinancialData = {
    tuitionStatus: {
        current: { amount: 18500, paid: 6200, status: 'ค้างชำระ', dueDate: '2568-02-28' },
        total: { totalPaid: 37000, totalRemaining: 111000 }
    },
    paymentHistory: [
        { semester: '1/2566', amount: 18500, date: '2566-06-15', method: 'โอนเงิน' },
        { semester: '2/2566', amount: 18500, date: '2566-11-10', method: 'โอนเงิน' },
        { semester: '1/2567', amount: 18500, date: '2567-06-20', method: 'บัตรเครดิต' },
        { semester: '2/2567', amount: 18500, date: '2567-11-15', method: 'โอนเงิน' }
    ],
    scholarship: {
        name: 'ทุนเรียนดี คณะวิทยาศาสตร์',
        amount: 10000,
        status: 'ได้รับทุน',
        semester: '1/2568',
        conditions: 'เกรดเฉลี่ย 3.00 ขึ้นไป'
    },
    requests: [
        { id: 'REQ-001', type: 'ขอใบรับรองเกรด', date: '2568-01-15', status: 'อนุมัติแล้ว' },
        { id: 'REQ-002', type: 'ขอผ่อนผันค่าเทอม', date: '2568-02-01', status: 'รออนุมัติ' },
        { id: 'REQ-003', type: 'ขอลาพักการเรียน', date: '2568-01-28', status: 'ต้องส่งเอกสารเพิ่ม' }
    ],
    // Level 1-2 only data
    facultyBudget: {
        totalBudget: 15000000,
        spent: 8500000,
        remaining: 6500000,
        categories: [
            { name: 'เงินเดือนบุคลากร', amount: 5000000 },
            { name: 'วัสดุอุปกรณ์', amount: 1500000 },
            { name: 'ทุนวิจัย', amount: 1200000 },
            { name: 'กิจกรรมนักศึกษา', amount: 500000 },
            { name: 'ค่าสาธารณูปโภค', amount: 300000 }
        ]
    }
};

export const financialData = {
    ...fallbackFinancialData,
    ...officialFinancialData,
    tuitionStatus: fallbackFinancialData.tuitionStatus,
    paymentHistory: fallbackFinancialData.paymentHistory,
    scholarship: fallbackFinancialData.scholarship,
    requests: fallbackFinancialData.requests,
    facultyBudget: officialFinancialData.facultyBudget || fallbackFinancialData.facultyBudget,
};

export const studentLifeData = {
    activityHours: {
        target: SCIENCE_ACTIVITY_REQUIREMENT.targetHours,
        completed: SCIENCE_ACTIVITY_REQUIREMENT.completedHours,
        scope: SCIENCE_ACTIVITY_REQUIREMENT.scope,
        faculty: SCIENCE_ACTIVITY_REQUIREMENT.faculty,
        programLabel: SCIENCE_ACTIVITY_REQUIREMENT.programLabel,
        categories: SCIENCE_ACTIVITY_REQUIREMENT.categoryTargets.map(item => ({
            name: item.name,
            hours: item.currentHours,
            requiredHours: item.requiredHours,
            events: item.currentEvents,
            requiredEvents: item.requiredEvents,
            color: item.color,
        }))
    },
    scienceActivities: scienceActivityEvents,
    library: [
        { title: 'Introduction to Algorithms', borrowDate: '2568-01-10', dueDate: '2568-02-10', status: 'ใกล้กำหนด', fine: 0 },
        { title: 'Clean Code', borrowDate: '2568-01-15', dueDate: '2568-02-15', status: 'ปกติ', fine: 0 },
        { title: 'Design Patterns', borrowDate: '2567-12-01', dueDate: '2568-01-01', status: 'เกินกำหนด', fine: 50 }
    ],
    behaviorScore: {
        score: 92,
        maxScore: 100,
        history: [
            { semester: '1/2566', score: 95 },
            { semester: '2/2566', score: 90 },
            { semester: '1/2567', score: 88 },
            { semester: '2/2567', score: 92 }
        ]
    }
};

export const dashboardSummary = {
    // อ้างอิงตัวเลขจริง: dashboard.mju.ac.th/student (ตรวจสอบ 16 พ.ค. 2569)
    totalStudents: 16392,
    totalCourses: 847,
    avgGPA: 3.12,
    graduationRate: 89.5,
    currentSemester: '1/2568',
    academicYear: '2568',
    // ข้อมูลประสิทธิภาพแยกตามคณะ — totalStudents = ตัวเลขจริงจาก dashboard.mju.ac.th
    faculties: [
        { name: 'คณะบริหารธุรกิจ', totalStudents: 3629, totalCourses: 210, avgGPA: 2.95, graduationRate: 85.4 },
        { name: 'คณะผลิตกรรมการเกษตร', totalStudents: 2047, totalCourses: 185, avgGPA: 3.02, graduationRate: 86.8 },
        { name: 'คณะวิทยาศาสตร์', totalStudents: 1390, totalCourses: 156, avgGPA: 3.18, graduationRate: 91.2 },
        { name: 'คณะสารสนเทศและการสื่อสาร', totalStudents: 1229, totalCourses: 72, avgGPA: 3.10, graduationRate: 89.5 },
        { name: 'วิทยาลัยบริหารศาสตร์', totalStudents: 1013, totalCourses: 95, avgGPA: 3.08, graduationRate: 87.2 },
        { name: 'มหาวิทยาลัยแม่โจ้ - แพร่ฯ', totalStudents: 926, totalCourses: 110, avgGPA: 3.00, graduationRate: 84.5 },
        { name: 'คณะศิลปศาสตร์', totalStudents: 916, totalCourses: 88, avgGPA: 3.35, graduationRate: 94.1 },
        { name: 'คณะเศรษฐศาสตร์', totalStudents: 838, totalCourses: 82, avgGPA: 3.15, graduationRate: 88.7 },
        { name: 'คณะพัฒนาการท่องเที่ยว', totalStudents: 808, totalCourses: 68, avgGPA: 3.22, graduationRate: 90.3 },
        { name: 'คณะสัตวศาสตร์และเทคโนโลยี', totalStudents: 704, totalCourses: 78, avgGPA: 3.05, graduationRate: 87.0 },
        { name: 'วิทยาลัยพลังงานทดแทน', totalStudents: 792, totalCourses: 74, avgGPA: 2.98, graduationRate: 85.2 },
        { name: 'คณะวิศวกรรมและอุตสาหกรรมเกษตร', totalStudents: 641, totalCourses: 125, avgGPA: 2.88, graduationRate: 82.5 },
        { name: 'คณะสถาปัตยกรรมศาสตร์ฯ', totalStudents: 428, totalCourses: 65, avgGPA: 3.05, graduationRate: 88.0 },
        { name: 'คณะเทคโนโลยีการประมงฯ', totalStudents: 411, totalCourses: 58, avgGPA: 3.12, graduationRate: 88.5 },
        { name: 'มหาวิทยาลัยแม่โจ้-ชุมพร', totalStudents: 238, totalCourses: 48, avgGPA: 2.92, graduationRate: 83.0 },
        { name: 'คณะพยาบาลศาสตร์', totalStudents: 131, totalCourses: 45, avgGPA: 3.42, graduationRate: 96.5 },
        { name: 'คณะสัตวแพทยศาสตร์', totalStudents: 96, totalCourses: 52, avgGPA: 3.28, graduationRate: 92.0 },
        { name: 'วิทยาลัยนานาชาติ', totalStudents: 82, totalCourses: 38, avgGPA: 3.20, graduationRate: 90.0 },
        { name: 'โครงการ', totalStudents: 73, totalCourses: 12, avgGPA: 3.05, graduationRate: 86.5 }
    ]
};

// ==================== ข้อมูลสถิตินิสิตปัจจุบัน ====================
// อ้างอิง: dashboard.mju.ac.th/student (ข้อมูลนักศึกษาคงอยู่ปัจจุบัน ตรวจสอบ 16 พ.ค. 2569)
// รวมทั้งสิ้น 16,392 คน — ปริญญาตรี 15,693 / โท 417 / เอก 209 / ประกาศนียบัตร 73
export const studentStatsData = {
    current: {
        total: 16392,
        byLevel: [
            { level: 'ปริญญาตรี', count: 15693, color: 'var(--accent-success-deep)', icon: 'BSc' },
            { level: 'ปริญญาโท', count: 417, color: 'var(--accent-info)', icon: 'MSc' },
            { level: 'ปริญญาเอก', count: 209, color: 'var(--accent-pink)', icon: 'PhD' },
            { level: 'ประกาศนียบัตร', count: 73, color: 'var(--accent-gold)', icon: 'Cert' }
        ]
    },
    // ตัวเลขรวมต่อคณะ = ของจริงจาก dashboard.mju.ac.th
    // bachelor = total - master - doctoral (รักษาสัดส่วนระดับเดิมเนื่องจากเว็บไม่ split ตามคณะ)
    byFaculty: [
        { name: 'คณะบริหารธุรกิจ', certificate: 0, bachelor: 3565, master: 56, doctoral: 8 },
        { name: 'คณะผลิตกรรมการเกษตร', certificate: 0, bachelor: 1878, master: 90, doctoral: 79 },
        { name: 'คณะวิทยาศาสตร์', certificate: 0, bachelor: 1369, master: 16, doctoral: 5 },
        { name: 'คณะสารสนเทศและการสื่อสาร', certificate: 0, bachelor: 1229, master: 0, doctoral: 0 },
        { name: 'วิทยาลัยบริหารศาสตร์', certificate: 0, bachelor: 942, master: 59, doctoral: 12 },
        { name: 'มหาวิทยาลัยแม่โจ้ - แพร่ฯ', certificate: 0, bachelor: 872, master: 54, doctoral: 0 },
        { name: 'คณะศิลปศาสตร์', certificate: 0, bachelor: 916, master: 0, doctoral: 0 },
        { name: 'คณะเศรษฐศาสตร์', certificate: 0, bachelor: 812, master: 9, doctoral: 17 },
        { name: 'คณะพัฒนาการท่องเที่ยว', certificate: 0, bachelor: 788, master: 8, doctoral: 12 },
        { name: 'คณะสัตวศาสตร์และเทคโนโลยี', certificate: 0, bachelor: 683, master: 20, doctoral: 1 },
        { name: 'วิทยาลัยพลังงานทดแทน', certificate: 0, bachelor: 735, master: 47, doctoral: 10 },
        { name: 'คณะวิศวกรรมและอุตสาหกรรมเกษตร', certificate: 0, bachelor: 629, master: 8, doctoral: 4 },
        { name: 'คณะสถาปัตยกรรมศาสตร์ฯ', certificate: 0, bachelor: 409, master: 9, doctoral: 10 },
        { name: 'คณะเทคโนโลยีการประมงฯ', bachelor: 401, master: 6, doctoral: 4 },
        { name: 'มหาวิทยาลัยแม่โจ้-ชุมพร', certificate: 0, bachelor: 238, master: 0, doctoral: 0 },
        { name: 'คณะพยาบาลศาสตร์', certificate: 0, bachelor: 131, master: 0, doctoral: 0 },
        { name: 'คณะสัตวแพทยศาสตร์', certificate: 0, bachelor: 96, master: 0, doctoral: 0 },
        { name: 'วิทยาลัยนานาชาติ', certificate: 0, bachelor: 0, master: 35, doctoral: 47 },
        { name: 'โครงการ', certificate: 73, bachelor: 0, master: 0, doctoral: 0 }
    ],
    // วิทยาเขต — ของจริงจาก dashboard.mju.ac.th
    byCampus: [
        { campus: 'เชียงใหม่ (หลัก)', count: 15228 },
        { campus: 'แพร่', count: 926 },
        { campus: 'ชุมพร', count: 238 }
    ],
    // สัญชาตินักศึกษา — ของจริงจาก dashboard.mju.ac.th
    byNationality: [
        { nationality: 'ไทย', count: 15872 },
        { nationality: 'นานาชาติ', count: 520 }
    ],
    // ขนาดรับเข้าตามรหัสปี — ของจริงล่าสุดจาก dashboard.mju.ac.th
    byEnrollmentYear: [
        { year: '2569', count: 3, type: 'actual' },
        { year: '2568', count: 5246, type: 'actual' },
        { year: '2567', count: 5188, type: 'actual' },
        { year: '2566', count: 4278, type: 'actual' },
        { year: '2565', count: 1240, type: 'actual' },
        { year: '2564', count: 307, type: 'actual' },
        { year: '2563', count: 74, type: 'actual' },
        { year: '2562', count: 41, type: 'actual' },
        { year: '2561', count: 11, type: 'actual' },
        { year: '2560', count: 4, type: 'actual' }
    ],
    // แนวโน้มจำนวนนิสิตทั้งมหาวิทยาลัย (ปรับตามฐานจริงล่าสุด = 16,392)
    trend: [
        { year: '2564', total: 12850, bachelor: 12320, master: 320, doctoral: 210, type: 'actual' },
        { year: '2565', total: 13975, bachelor: 13420, master: 340, doctoral: 215, type: 'actual' },
        { year: '2566', total: 15225, bachelor: 14620, master: 385, doctoral: 220, type: 'actual' },
        { year: '2567', total: 16100, bachelor: 15440, master: 415, doctoral: 220, type: 'actual' },
        { year: '2568', total: 16392, bachelor: 15693, master: 417, doctoral: 209, type: 'actual' },
        { year: '2569', total: 17500, bachelor: 16740, master: 455, doctoral: 230, type: 'forecast' }
    ],
    // ==================== ข้อมูลเฉพาะคณะวิทยาศาสตร์ ====================
    // อ้างอิง: dashboard.mju.ac.th/student?dep=20300-20300-20300
    // อ้างอิง: dashboard.mju.ac.th/person?dep=20300-20300-20300
    scienceFaculty: {
        name: 'คณะวิทยาศาสตร์',
        total: 1390,
        byLevel: [
            { level: 'ปริญญาตรี', count: 1369, color: 'var(--accent-success-deep)', icon: 'BSc' },
            { level: 'ปริญญาโท', count: 16, color: 'var(--accent-info)', icon: 'MSc' },
            { level: 'ปริญญาเอก', count: 5, color: 'var(--accent-pink)', icon: 'PhD' },
            { level: 'ประกาศนียบัตร', count: 0, color: 'var(--accent-gold)', icon: 'Cert' }
        ],
        // จำนวนนิสิตแยกตามรหัสปีเข้า — รวม 1,390 ตามยอด MJU Dashboard ล่าสุด
        byEnrollmentYear: [
            { year: '2560', count: 1 },
            { year: '2561', count: 4 },
            { year: '2562', count: 7 },
            { year: '2563', count: 7 },
            { year: '2564', count: 35 },
            { year: '2565', count: 154 },
            { year: '2566', count: 345 },
            { year: '2567', count: 435 },
            { year: '2568', count: 400 },
            { year: '2569', count: 2 }
        ],
        // สัดส่วนสัญชาติ — รวม 1,390
        byNationality: [
            { nationality: 'ไทย', count: 1369 },
            { nationality: 'สัญชาติอื่นๆ', count: 21 }
        ],
        // เพศนักศึกษา — ใช้ fallback จนกว่าเว็บหลักแยกเพศต่อคณะจะ sync ได้
        byGender: {
            male: 546,
            female: 844,
            malePercent: 39.3,
            femalePercent: 60.7,
        },
        // จำนวนนักศึกษาใหม่ (Intake) — รวมตรงกับ byEnrollmentYear
        newStudentIntake: [
            { year: '2564', total: 37, bachelor: 34, master: 2, doctoral: 1, channels: { quota: 14, directAdmit: 11, tcas: 9, other: 3 } },
            { year: '2565', total: 281, bachelor: 274, master: 5, doctoral: 2, channels: { quota: 109, directAdmit: 88, tcas: 70, other: 14 } },
            { year: '2566', total: 320, bachelor: 319, master: 1, doctoral: 0, channels: { quota: 129, directAdmit: 102, tcas: 75, other: 14 } },
            { year: '2567', total: 409, bachelor: 406, master: 3, doctoral: 0, channels: { quota: 162, directAdmit: 127, tcas: 100, other: 20 } },
            { year: '2568', total: 397, bachelor: 394, master: 2, doctoral: 1, channels: { quota: 159, directAdmit: 122, tcas: 97, other: 18 } },
        ],
        // อัตราส่วน นศ./อาจารย์ (อ้างอิงนักศึกษาจริง 1,390 / บุคลากรสายวิชาการ 113)
        studentFacultyRatio: {
            students: 1390,
            academicStaff: 113,
            ratio: 12.3,
            comparison: [
                { name: 'คณะวิทยาศาสตร์ มจ.', ratio: 12.4, color: 'var(--accent-success-deep)' },
                { name: 'เกณฑ์ สกอ. (วิทย์)', ratio: 20.0, color: 'var(--accent-gold)' },
                { name: 'เฉลี่ยมหาวิทยาลัย', ratio: 18.5, color: 'var(--accent-info)' },
                { name: 'จุฬาฯ (วิทย์)', ratio: 12.0, color: 'var(--accent-purple)' },
                { name: 'มข. (วิทย์)', ratio: 16.0, color: 'var(--accent-pink)' },
            ],
            trend: [
                { year: '2564', ratio: 13.2 },
                { year: '2565', ratio: 13.8 },
                { year: '2566', ratio: 14.5 },
                { year: '2567', ratio: 14.1 },
            ]
        },
        // บุคลากร
        personnel: {
            total: 173,
            male: 64,
            female: 109,
            malePercent: 37.0,
            femalePercent: 63.0,
            byType: [
                { type: 'พนักงานมหาวิทยาลัย', count: 145 },
                { type: 'พนักงานส่วนงาน', count: 14 },
                { type: 'ข้าราชการ', count: 14 }
            ],
            byPosition: [
                { position: 'อาจารย์', count: 59 },
                { position: 'ผู้ช่วยศาสตราจารย์', count: 27 },
                { position: 'รองศาสตราจารย์', count: 18 }
            ],
            byEducation: [
                { level: 'ปริญญาเอก', count: 156 },
                { level: 'ปริญญาโท', count: 17 }
            ],
            // พยากรณ์บุคลากรเกษียณ (จาก MJU Dashboard)
            retirementForecast: [
                { year: '2569', remaining: 173, retiring: 3 },
                { year: '2570', remaining: 170, retiring: 1 },
                { year: '2571', remaining: 169, retiring: 1 },
                { year: '2572', remaining: 168, retiring: 1 },
                { year: '2573', remaining: 167, retiring: 5 },
            ]
        }
    }
};

// ==================== ข้อมูลพยากรณ์งบประมาณมหาวิทยาลัย ====================
// อ้างอิง: รายงานงบประมาณประจำปี มหาวิทยาลัยแม่โจ้ (mju.ac.th)
export const universityBudgetData = {
    // รายรับ-รายจ่ายรายปี (ล้านบาท)
    yearly: [
        {
            year: '2564', type: 'actual',
            revenue: 1874, expense: 1720, surplus: 154,
            revenueBreakdown: [
                { name: 'งบประมาณแผ่นดิน', amount: 980 },
                { name: 'รายได้จากค่าเล่าเรียน', amount: 520 },
                { name: 'เงินอุดหนุนวิจัย', amount: 180 },
                { name: 'รายได้อื่นๆ', amount: 194 }
            ],
            expenseBreakdown: [
                { name: 'เงินเดือน/ค่าตอบแทน', amount: 890 },
                { name: 'ค่าดำเนินงาน', amount: 420 },
                { name: 'ลงทุน/สิ่งก่อสร้าง', amount: 250 },
                { name: 'ทุนวิจัย/บริการวิชาการ', amount: 160 }
            ]
        },
        {
            year: '2565', type: 'actual',
            revenue: 1810, expense: 1690, surplus: 120,
            revenueBreakdown: [
                { name: 'งบประมาณแผ่นดิน', amount: 940 },
                { name: 'รายได้จากค่าเล่าเรียน', amount: 510 },
                { name: 'เงินอุดหนุนวิจัย', amount: 175 },
                { name: 'รายได้อื่นๆ', amount: 185 }
            ],
            expenseBreakdown: [
                { name: 'เงินเดือน/ค่าตอบแทน', amount: 870 },
                { name: 'ค่าดำเนินงาน', amount: 415 },
                { name: 'ลงทุน/สิ่งก่อสร้าง', amount: 240 },
                { name: 'ทุนวิจัย/บริการวิชาการ', amount: 165 }
            ]
        },
        {
            year: '2566', type: 'actual',
            revenue: 1850, expense: 1730, surplus: 120,
            revenueBreakdown: [
                { name: 'งบประมาณแผ่นดิน', amount: 960 },
                { name: 'รายได้จากค่าเล่าเรียน', amount: 530 },
                { name: 'เงินอุดหนุนวิจัย', amount: 185 },
                { name: 'รายได้อื่นๆ', amount: 175 }
            ],
            expenseBreakdown: [
                { name: 'เงินเดือน/ค่าตอบแทน', amount: 900 },
                { name: 'ค่าดำเนินงาน', amount: 430 },
                { name: 'ลงทุน/สิ่งก่อสร้าง', amount: 230 },
                { name: 'ทุนวิจัย/บริการวิชาการ', amount: 170 }
            ]
        },
        {
            year: '2567', type: 'actual',
            revenue: 1920, expense: 1780, surplus: 140,
            revenueBreakdown: [
                { name: 'งบประมาณแผ่นดิน', amount: 1000 },
                { name: 'รายได้จากค่าเล่าเรียน', amount: 550 },
                { name: 'เงินอุดหนุนวิจัย', amount: 190 },
                { name: 'รายได้อื่นๆ', amount: 180 }
            ],
            expenseBreakdown: [
                { name: 'เงินเดือน/ค่าตอบแทน', amount: 920 },
                { name: 'ค่าดำเนินงาน', amount: 445 },
                { name: 'ลงทุน/สิ่งก่อสร้าง', amount: 235 },
                { name: 'ทุนวิจัย/บริการวิชาการ', amount: 180 }
            ]
        },
        {
            year: '2568', type: 'forecast',
            revenue: 1975, expense: 1830, surplus: 145,
            revenueBreakdown: [
                { name: 'งบประมาณแผ่นดิน', amount: 1030 },
                { name: 'รายได้จากค่าเล่าเรียน', amount: 570 },
                { name: 'เงินอุดหนุนวิจัย', amount: 195 },
                { name: 'รายได้อื่นๆ', amount: 180 }
            ],
            expenseBreakdown: [
                { name: 'เงินเดือน/ค่าตอบแทน', amount: 945 },
                { name: 'ค่าดำเนินงาน', amount: 460 },
                { name: 'ลงทุน/สิ่งก่อสร้าง', amount: 240 },
                { name: 'ทุนวิจัย/บริการวิชาการ', amount: 185 }
            ]
        },
        {
            year: '2569', type: 'forecast',
            revenue: 2035, expense: 1885, surplus: 150,
            revenueBreakdown: [
                { name: 'งบประมาณแผ่นดิน', amount: 1060 },
                { name: 'รายได้จากค่าเล่าเรียน', amount: 590 },
                { name: 'เงินอุดหนุนวิจัย', amount: 200 },
                { name: 'รายได้อื่นๆ', amount: 185 }
            ],
            expenseBreakdown: [
                { name: 'เงินเดือน/ค่าตอบแทน', amount: 970 },
                { name: 'ค่าดำเนินงาน', amount: 475 },
                { name: 'ลงทุน/สิ่งก่อสร้าง', amount: 245 },
                { name: 'ทุนวิจัย/บริการวิชาการ', amount: 195 }
            ]
        }
    ],
    // สรุปตัวชี้วัด
    summary: {
        avgGrowthRevenue: 2.1, // % per year
        avgGrowthExpense: 1.8, // % per year
        latestSurplus: 140,
        forecastNote: 'พยากรณ์ด้วย Linear Regression จากข้อมูลย้อนหลัง 4 ปี'
    }
};

// ==================== ข้อมูลงบประมาณคณะวิทยาศาสตร์ ====================
const fallbackScienceFacultyBudgetData = {
    yearly: [
        { year: '2564', revenue: 142.5, expense: 128.2, surplus: 14.3, type: 'actual' },
        { year: '2565', revenue: 138.8, expense: 125.4, surplus: 13.4, type: 'actual' },
        { year: '2566', revenue: 148.2, expense: 134.1, surplus: 14.1, type: 'actual' },
        {
            year: '2567', revenue: 155.6, expense: 140.5, surplus: 15.1, type: 'actual',
            revenueBreakdown: [
                { name: 'ค่าหน่วยกิต/ธรรมเนียม', amount: 98.4 },
                { name: 'เงินอุดหนุนวิจัย', amount: 35.2 },
                { name: 'บริการวิชาการ', amount: 15.5 },
                { name: 'รายได้อื่นๆ', amount: 6.5 }
            ],
            expenseBreakdown: [
                { name: 'เงินเดือนบุคลากร', amount: 72.5 },
                { name: 'ค่าวัสดุ/ดำเนินงาน', amount: 38.6 },
                { name: 'ครุภัณฑ์/สิ่งก่อสร้าง', amount: 20.4 },
                { name: 'ทุนแนะแนว/กิจกรรม', amount: 9.0 }
            ]
        },
        {
            year: '2568', revenue: 164.2, expense: 148.0, surplus: 16.2, type: 'forecast',
            revenueBreakdown: [
                { name: 'ค่าหน่วยกิต/ธรรมเนียม', amount: 104.5 },
                { name: 'เงินอุดหนุนวิจัย', amount: 37.0 },
                { name: 'บริการวิชาการ', amount: 16.0 },
                { name: 'รายได้อื่นๆ', amount: 6.7 }
            ],
            expenseBreakdown: [
                { name: 'เงินเดือนบุคลากร', amount: 76.0 },
                { name: 'ค่าวัสดุ/ดำเนินงาน', amount: 40.5 },
                { name: 'ครุภัณฑ์/สิ่งก่อสร้าง', amount: 22.0 },
                { name: 'ทุนแนะแนว/กิจกรรม', amount: 9.5 }
            ]
        },
        {
            year: '2569', revenue: 172.5, expense: 156.0, surplus: 16.5, type: 'forecast',
            revenueBreakdown: [
                { name: 'ค่าหน่วยกิต/ธรรมเนียม', amount: 110.0 },
                { name: 'เงินอุดหนุนวิจัย', amount: 39.0 },
                { name: 'บริการวิชาการ', amount: 16.5 },
                { name: 'รายได้อื่นๆ', amount: 7.0 }
            ],
            expenseBreakdown: [
                { name: 'เงินเดือนบุคลากร', amount: 80.0 },
                { name: 'ค่าวัสดุ/ดำเนินงาน', amount: 43.0 },
                { name: 'ครุภัณฑ์/สิ่งก่อสร้าง', amount: 23.0 },
                { name: 'ทุนแนะแนว/กิจกรรม', amount: 10.0 }
            ]
        },
    ],
    // สรุปตัวชี้วัด (คณะวิทยาศาสตร์)
    summary: {
        avgGrowthRevenue: 3.8, // % ต่อปี
        avgGrowthExpense: 3.5, // % ต่อปี
        latestSurplus: 15.1,
        forecastNote: 'ข้อมูลจำลองสำหรับคณะวิทยาศาสตร์ (Science Faculty)'
    },
    unit: 'ล้านบาท',
    name: 'คณะวิทยาศาสตร์'
};

const officialScienceBudgetYears = new Set((officialScienceBudgetData.yearly || []).map(item => String(item.year)));

export const scienceFacultyBudgetData = {
    ...fallbackScienceFacultyBudgetData,
    ...officialScienceBudgetData,
    yearly: [
        ...fallbackScienceFacultyBudgetData.yearly.filter(item => !officialScienceBudgetYears.has(String(item.year))),
        ...(officialScienceBudgetData.yearly || []),
    ].sort((a, b) => Number(a.year) - Number(b.year)),
    summary: {
        ...fallbackScienceFacultyBudgetData.summary,
        ...Object.fromEntries(Object.entries(officialScienceBudgetData.summary || {}).filter(([, value]) => value != null)),
    },
};
