// Mock data for the MJU Dashboard
// อ้างอิงข้อมูลจากมหาวิทยาลัยแม่โจ้ (mju.ac.th)

export const tuitionData = {
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
        { label: 'ค่าหน่วยกิต', value: 40, color: '#006838' },
        { label: 'ค่าบำรุงมหาวิทยาลัย', value: 25, color: '#C5A028' },
        { label: 'ค่า Lab/ปฏิบัติการ', value: 15, color: '#2E86AB' },
        { label: 'ค่าธรรมเนียมอื่นๆ', value: 10, color: '#A23B72' },
        { label: 'ค่าประกัน/กิจกรรม', value: 10, color: '#F18F01' }
    ],
    semesterHistory: [
        { semester: '1/2567', paid: 18500, status: 'จ่ายแล้ว' },
        { semester: '2/2567', paid: 18500, status: 'จ่ายแล้ว' },
        { semester: '1/2568', paid: 0, status: 'ค้างชำระ' }
    ]
};

export const financialData = {
    tuitionStatus: {
        current: { amount: 18500, paid: 0, status: 'ค้างชำระ', dueDate: '2568-02-28' },
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

export const studentLifeData = {
    activityHours: {
        target: 60,
        completed: 38,
        categories: [
            { name: 'จิตอาสา', hours: 15 },
            { name: 'กีฬา', hours: 8 },
            { name: 'วิชาการ', hours: 10 },
            { name: 'ศิลปวัฒนธรรม', hours: 5 }
        ]
    },
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
    totalStudents: 19821,
    totalCourses: 847,
    avgGPA: 3.12,
    graduationRate: 89.5,
    currentSemester: '1/2568',
    academicYear: '2568',
    // ข้อมูลประสิทธิภาพแยกตามคณะ (สำหรับเปรียบเทียบ Radar Chart)
    faculties: [
        {
            name: 'คณะบริหารธุรกิจ',
            totalStudents: 4387,
            totalCourses: 210,
            avgGPA: 2.95,
            graduationRate: 85.4
        },
        {
            name: 'คณะผลิตกรรมการเกษตร',
            totalStudents: 2493,
            totalCourses: 185,
            avgGPA: 3.02,
            graduationRate: 86.8
        },
        {
            name: 'คณะวิทยาศาสตร์',
            totalStudents: 1591,
            totalCourses: 156,
            avgGPA: 3.18,
            graduationRate: 91.2
        },
        {
            name: 'คณะสารสนเทศและการสื่อสาร',
            totalStudents: 1493,
            totalCourses: 72,
            avgGPA: 3.10,
            graduationRate: 89.5
        },
        {
            name: 'วิทยาลัยบริหารศาสตร์',
            totalStudents: 1297,
            totalCourses: 95,
            avgGPA: 3.08,
            graduationRate: 87.2
        },
        {
            name: 'คณะศิลปศาสตร์',
            totalStudents: 1220,
            totalCourses: 88,
            avgGPA: 3.35,
            graduationRate: 94.1
        },
        {
            name: 'มหาวิทยาลัยแม่โจ้ - แพร่ฯ',
            totalStudents: 1156,
            totalCourses: 110,
            avgGPA: 3.00,
            graduationRate: 84.5
        },
        {
            name: 'คณะพัฒนาการท่องเที่ยว',
            totalStudents: 987,
            totalCourses: 68,
            avgGPA: 3.22,
            graduationRate: 90.3
        },
        {
            name: 'คณะเศรษฐศาสตร์',
            totalStudents: 968,
            totalCourses: 82,
            avgGPA: 3.15,
            graduationRate: 88.7
        },
        {
            name: 'คณะสัตวศาสตร์และเทคโนโลยี',
            totalStudents: 901,
            totalCourses: 78,
            avgGPA: 3.05,
            graduationRate: 87.0
        },
        {
            name: 'วิทยาลัยพลังงานทดแทน',
            totalStudents: 856,
            totalCourses: 74,
            avgGPA: 2.98,
            graduationRate: 85.2
        },
        {
            name: 'คณะวิศวกรรมและอุตสาหกรรมเกษตร',
            totalStudents: 801,
            totalCourses: 125,
            avgGPA: 2.88,
            graduationRate: 82.5
        },
        {
            name: 'คณะเทคโนโลยีการประมงฯ',
            totalStudents: 503,
            totalCourses: 58,
            avgGPA: 3.12,
            graduationRate: 88.5
        },
        {
            name: 'คณะสถาปัตยกรรมศาสตร์ฯ',
            totalStudents: 431,
            totalCourses: 65,
            avgGPA: 3.05,
            graduationRate: 88.0
        },
        {
            name: 'มหาวิทยาลัยแม่โจ้-ชุมพร',
            totalStudents: 304,
            totalCourses: 48,
            avgGPA: 2.92,
            graduationRate: 83.0
        },
        {
            name: 'คณะพยาบาลศาสตร์',
            totalStudents: 184,
            totalCourses: 45,
            avgGPA: 3.42,
            graduationRate: 96.5
        },
        {
            name: 'คณะสัตวแพทยศาสตร์',
            totalStudents: 96,
            totalCourses: 52,
            avgGPA: 3.28,
            graduationRate: 92.0
        },
        {
            name: 'วิทยาลัยนานาชาติ',
            totalStudents: 80,
            totalCourses: 38,
            avgGPA: 3.20,
            graduationRate: 90.0
        }
    ]
};

// ==================== ข้อมูลสถิตินิสิตปัจจุบัน ====================
// อ้างอิง: dashboard.mju.ac.th/student.aspx (ข้อมูลนักศึกษาคงอยู่ปัจจุบัน)
export const studentStatsData = {
    current: {
        total: 19821,
        byLevel: [
            { level: 'ปริญญาตรี', count: 19062, color: '#006838', icon: 'BSc' },
            { level: 'ปริญญาโท', count: 450, color: '#2E86AB', icon: 'MSc' },
            { level: 'ปริญญาเอก', count: 236, color: '#A23B72', icon: 'PhD' },
            { level: 'ประกาศนียบัตร', count: 73, color: '#C5A028', icon: 'Cert' }
        ]
    },
    byFaculty: [
        { name: 'คณะบริหารธุรกิจ', bachelor: 4323, master: 56, doctoral: 8 },
        { name: 'คณะผลิตกรรมการเกษตร', bachelor: 2299, master: 98, doctoral: 96 },
        { name: 'คณะวิทยาศาสตร์', bachelor: 1572, master: 15, doctoral: 4 },
        { name: 'คณะสารสนเทศและการสื่อสาร', bachelor: 1493, master: 0, doctoral: 0 },
        { name: 'วิทยาลัยบริหารศาสตร์', bachelor: 1213, master: 63, doctoral: 21 },
        { name: 'คณะศิลปศาสตร์', bachelor: 1220, master: 0, doctoral: 0 },
        { name: 'มหาวิทยาลัยแม่โจ้ - แพร่ฯ', bachelor: 1093, master: 63, doctoral: 0 },
        { name: 'คณะพัฒนาการท่องเที่ยว', bachelor: 967, master: 8, doctoral: 12 },
        { name: 'คณะเศรษฐศาสตร์', bachelor: 944, master: 9, doctoral: 15 },
        { name: 'คณะสัตวศาสตร์และเทคโนโลยี', bachelor: 879, master: 21, doctoral: 1 },
        { name: 'วิทยาลัยพลังงานทดแทน', bachelor: 787, master: 54, doctoral: 15 },
        { name: 'คณะวิศวกรรมและอุตสาหกรรมเกษตร', bachelor: 784, master: 13, doctoral: 4 },
        { name: 'คณะเทคโนโลยีการประมงฯ', bachelor: 492, master: 7, doctoral: 4 },
        { name: 'คณะสถาปัตยกรรมศาสตร์ฯ', bachelor: 412, master: 9, doctoral: 10 },
        { name: 'มหาวิทยาลัยแม่โจ้-ชุมพร', bachelor: 304, master: 0, doctoral: 0 },
        { name: 'คณะพยาบาลศาสตร์', bachelor: 184, master: 0, doctoral: 0 },
        { name: 'คณะสัตวแพทยศาสตร์', bachelor: 96, master: 0, doctoral: 0 },
        { name: 'วิทยาลัยนานาชาติ', bachelor: 0, master: 34, doctoral: 46 }
    ],
    // แนวโน้มจำนวนนิสิต (ย้อนหลัง 4 ปี + พยากรณ์ 2 ปี)
    // อ้างอิง: dashboard.mju.ac.th/studentByYear.aspx
    trend: [
        { year: '2564', total: 15128, bachelor: 14500, master: 380, doctoral: 248, type: 'actual' },
        { year: '2565', total: 16450, bachelor: 15800, master: 400, doctoral: 250, type: 'actual' },
        { year: '2566', total: 17920, bachelor: 17200, master: 420, doctoral: 240, type: 'actual' },
        { year: '2567', total: 19821, bachelor: 19062, master: 450, doctoral: 236, type: 'actual' },
        { year: '2568', total: 21200, bachelor: 20400, master: 480, doctoral: 245, type: 'forecast' },
        { year: '2569', total: 22500, bachelor: 21700, master: 510, doctoral: 255, type: 'forecast' }
    ],
    // ==================== ข้อมูลเฉพาะคณะวิทยาศาสตร์ ====================
    // อ้างอิง: dashboard.mju.ac.th/student?dep=20300-20300-20300
    // อ้างอิง: dashboard.mju.ac.th/person?dep=20300-20300-20300
    scienceFaculty: {
        name: 'คณะวิทยาศาสตร์',
        total: 1451,
        byLevel: [
            { level: 'ปริญญาตรี', count: 1429, color: '#006838', icon: 'BSc' },
            { level: 'ปริญญาโท', count: 17, color: '#2E86AB', icon: 'MSc' },
            { level: 'ปริญญาเอก', count: 5, color: '#A23B72', icon: 'PhD' },
            { level: 'ประกาศนียบัตร', count: 0, color: '#C5A028', icon: 'Cert' }
        ],
        // จำนวนนิสิตแยกตามรหัสนักศึกษา (ปีที่เข้าศึกษา)
        byEnrollmentYear: [
            { year: '2563', count: 8 },
            { year: '2564', count: 40 },
            { year: '2565', count: 304 },
            { year: '2566', count: 347 },
            { year: '2567', count: 443 },
            { year: '2568', count: 429 }
        ],
        // สัดส่วนสัญชาติ
        byNationality: [
            { nationality: 'ไทย', count: 1429 },
            { nationality: 'สัญชาติอื่นๆ', count: 22 }
        ],
        // ==================== เพศนักศึกษา (ใหม่) ====================
        // อ้างอิง: dashboard.mju.ac.th/student?dep=20300-20300-20300 (ตัวกรองเพศ)
        byGender: {
            male: 567,
            female: 884,
            malePercent: 39.1,
            femalePercent: 60.9,
        },
        // ==================== จำนวนนักศึกษาใหม่ (Intake) ====================
        // อ้างอิง: dashboard.mju.ac.th/student?dep=20300-20300-20300 (แยกตามรหัส)
        newStudentIntake: [
            { year: '2564', total: 40, bachelor: 37, master: 2, doctoral: 1, channels: { quota: 15, directAdmit: 12, tcas: 10, other: 3 } },
            { year: '2565', total: 304, bachelor: 296, master: 6, doctoral: 2, channels: { quota: 118, directAdmit: 95, tcas: 76, other: 15 } },
            { year: '2566', total: 347, bachelor: 346, master: 1, doctoral: 0, channels: { quota: 140, directAdmit: 110, tcas: 82, other: 15 } },
            { year: '2567', total: 443, bachelor: 440, master: 3, doctoral: 0, channels: { quota: 175, directAdmit: 138, tcas: 108, other: 22 } },
            { year: '2568', total: 429, bachelor: 426, master: 2, doctoral: 1, channels: { quota: 172, directAdmit: 132, tcas: 105, other: 20 } },
        ],
        // ==================== อัตราส่วน นศ./อาจารย์ ====================
        studentFacultyRatio: {
            students: 1451,
            academicStaff: 104, // อาจารย์ + ผศ. + รศ. (สัดส่วนจากบุคลากรรวม 173)
            ratio: 14.0, // 1451 / 104
            comparison: [
                { name: 'คณะวิทยาศาสตร์ มจ.', ratio: 14.0, color: '#006838' },
                { name: 'เกณฑ์ สกอ. (วิทย์)', ratio: 20.0, color: '#C5A028' },
                { name: 'เฉลี่ยมหาวิทยาลัย', ratio: 18.5, color: '#2E86AB' },
                { name: 'จุฬาฯ (วิทย์)', ratio: 12.0, color: '#7B68EE' },
                { name: 'มข. (วิทย์)', ratio: 16.0, color: '#E91E63' },
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
export const scienceFacultyBudgetData = {
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
