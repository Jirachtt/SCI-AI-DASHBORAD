export const courseAnalyticsSources = [
    {
        label: 'TCAS Science MJU',
        url: 'https://sciencebase.mju.ac.th/tcas/',
        note: 'รายชื่อหลักสูตรคณะวิทยาศาสตร์ระดับปริญญาตรี',
        status: 'official_public',
    },
    {
        label: 'Reg MJU program info',
        url: 'https://reg.mju.ac.th/registrar/program_info.asp',
        note: 'ระบบทะเบียนสำหรับข้อมูลหลักสูตร/รายวิชา ต้องใช้การเชื่อมต่อหรือนำเข้าไฟล์เพื่อ grade distribution จริง',
        status: 'official_system',
    },
];

export const sciencePrograms = [
    'วิทยาการคอมพิวเตอร์',
    'เทคโนโลยีชีวภาพ',
    'เคมี',
    'สถิติและการจัดการสารสนเทศ',
    'คณิตศาสตร์',
    'เทคโนโลยีสารสนเทศ',
    'นวัตกรรมวัสดุ',
    'ฟิสิกส์ประยุกต์',
    'นวัตกรรมเคมีอุตสาหกรรม',
];

export const branchStrengths = [
    {
        major: 'วิทยาการคอมพิวเตอร์',
        strengths: ['AI & Data Engineering', 'Software Engineering', 'Cybersecurity'],
        showcase: 'สร้างระบบข้อมูลและ AI สำหรับงานวิทยาศาสตร์/องค์กร',
        flagshipCourses: ['Data Structures', 'Machine Learning', 'Cloud Application'],
    },
    {
        major: 'เทคโนโลยีสารสนเทศ',
        strengths: ['Business Intelligence', 'Web & Mobile', 'IT Infrastructure'],
        showcase: 'ออกแบบระบบสารสนเทศและ dashboard สำหรับองค์กร',
        flagshipCourses: ['Database Systems', 'UX for IT', 'Network & Cloud'],
    },
    {
        major: 'สถิติและการจัดการสารสนเทศ',
        strengths: ['Statistics', 'Decision Analytics', 'Risk & Insurance'],
        showcase: 'วิเคราะห์ข้อมูลเชิงสถิติและจัดการสารสนเทศเพื่อการตัดสินใจ',
        flagshipCourses: ['Statistical Modeling', 'Data Visualization', 'Actuarial Analytics'],
    },
    {
        major: 'เคมี',
        strengths: ['Analytical Chemistry', 'Green Chemistry', 'Quality Control'],
        showcase: 'ทักษะห้องปฏิบัติการและการวิเคราะห์สารสำหรับอุตสาหกรรม',
        flagshipCourses: ['Organic Chemistry', 'Instrumental Analysis', 'Industrial Chemistry Lab'],
    },
    {
        major: 'เทคโนโลยีชีวภาพ',
        strengths: ['Microbiology', 'Bioprocess', 'Food & Agri Biotechnology'],
        showcase: 'ต่อยอดชีวภาพสู่นวัตกรรมเกษตร อาหาร และสุขภาพ',
        flagshipCourses: ['Bioprocess Technology', 'Molecular Biology', 'Fermentation'],
    },
    {
        major: 'คณิตศาสตร์',
        strengths: ['Applied Mathematics', 'Optimization', 'Mathematics Education'],
        showcase: 'ฐานคิดเชิงคณิตศาสตร์สำหรับ data, finance และการศึกษา',
        flagshipCourses: ['Linear Algebra', 'Optimization', 'Mathematical Modeling'],
    },
    {
        major: 'ฟิสิกส์ประยุกต์',
        strengths: ['Sensors', 'Energy Materials', 'Instrumentation'],
        showcase: 'ประยุกต์ฟิสิกส์กับเครื่องมือวัดและเทคโนโลยีพลังงาน',
        flagshipCourses: ['Electronics', 'Sensor Technology', 'Modern Physics Lab'],
    },
    {
        major: 'นวัตกรรมวัสดุ',
        strengths: ['Advanced Materials', 'Polymer', 'Sustainable Materials'],
        showcase: 'วัสดุเพื่ออุตสาหกรรม เกษตร และสิ่งแวดล้อม',
        flagshipCourses: ['Materials Characterization', 'Polymer Science', 'Smart Materials'],
    },
    {
        major: 'นวัตกรรมเคมีอุตสาหกรรม',
        strengths: ['Industrial Process', 'Product Development', 'Chemical Safety'],
        showcase: 'เชื่อมเคมีพื้นฐานกับกระบวนการผลิตและสหกิจศึกษา',
        flagshipCourses: ['Industrial Process Chemistry', 'Product Formulation', 'Safety Management'],
    },
];

export const coursePlanByYear = [
    {
        year: 1,
        title: 'ปี 1: พื้นฐานวิทยาศาสตร์และมหาวิทยาลัย',
        semesters: [
            {
                semester: '1/2569',
                courses: [
                    { code: 'SCI101', title: 'คณิตศาสตร์สำหรับวิทยาศาสตร์', credits: 3, type: 'core', crossMajor: true },
                    { code: 'SCI102', title: 'เคมีพื้นฐานและปฏิบัติการ', credits: 4, type: 'lab', crossMajor: true },
                    { code: 'SCI103', title: 'ชีววิทยาพื้นฐาน', credits: 3, type: 'core', crossMajor: true },
                    { code: 'MJU101', title: 'อัตลักษณ์แม่โจ้และทักษะชีวิต', credits: 2, type: 'general', crossMajor: true },
                ],
            },
            {
                semester: '2/2569',
                courses: [
                    { code: 'SCI104', title: 'ฟิสิกส์พื้นฐานและปฏิบัติการ', credits: 4, type: 'lab', crossMajor: true },
                    { code: 'SCI105', title: 'สถิติสำหรับวิทยาศาสตร์', credits: 3, type: 'core', crossMajor: true },
                    { code: 'SCI106', title: 'การเขียนโปรแกรมเบื้องต้น', credits: 3, type: 'skill', crossMajor: true },
                ],
            },
        ],
    },
    {
        year: 2,
        title: 'ปี 2: วิชาแกนสาขาและทักษะปฏิบัติการ',
        semesters: [
            {
                semester: '1/2570',
                courses: [
                    { code: 'SCI221', title: 'ระเบียบวิธีวิจัยทางวิทยาศาสตร์', credits: 3, type: 'research', crossMajor: true },
                    { code: 'CSC231', title: 'โครงสร้างข้อมูล', credits: 3, type: 'major', major: 'วิทยาการคอมพิวเตอร์' },
                    { code: 'BIO241', title: 'จุลชีววิทยา', credits: 4, type: 'major', major: 'เทคโนโลยีชีวภาพ' },
                    { code: 'CHE241', title: 'เคมีอินทรีย์', credits: 4, type: 'major', major: 'เคมี' },
                ],
            },
            {
                semester: '2/2570',
                courses: [
                    { code: 'SCI222', title: 'การวิเคราะห์ข้อมูลด้วยโปรแกรมสำเร็จรูป', credits: 3, type: 'skill', crossMajor: true },
                    { code: 'IT242', title: 'ระบบฐานข้อมูล', credits: 3, type: 'major', major: 'เทคโนโลยีสารสนเทศ' },
                    { code: 'STA242', title: 'แบบจำลองสถิติ', credits: 3, type: 'major', major: 'สถิติและการจัดการสารสนเทศ' },
                    { code: 'MAT242', title: 'พีชคณิตเชิงเส้น', credits: 3, type: 'major', major: 'คณิตศาสตร์' },
                ],
            },
        ],
    },
    {
        year: 3,
        title: 'ปี 3: วิชาชีพ โครงงาน และวิชาข้ามสาขา',
        semesters: [
            {
                semester: '1/2571',
                courses: [
                    { code: 'SCI331', title: 'Data Visualization for Science', credits: 3, type: 'elective', crossMajor: true },
                    { code: 'SCI332', title: 'Lab Safety & Quality System', credits: 2, type: 'skill', crossMajor: true },
                    { code: 'PHY331', title: 'Sensor Technology', credits: 3, type: 'major', major: 'ฟิสิกส์ประยุกต์' },
                    { code: 'MAT331', title: 'Materials Characterization', credits: 3, type: 'major', major: 'นวัตกรรมวัสดุ' },
                ],
            },
            {
                semester: '2/2571',
                courses: [
                    { code: 'SCI333', title: 'Entrepreneurship for Science Innovation', credits: 3, type: 'elective', crossMajor: true },
                    { code: 'CHE333', title: 'Industrial Process Chemistry', credits: 3, type: 'major', major: 'นวัตกรรมเคมีอุตสาหกรรม' },
                    { code: 'CSC333', title: 'Machine Learning', credits: 3, type: 'major', major: 'วิทยาการคอมพิวเตอร์' },
                ],
            },
        ],
    },
    {
        year: 4,
        title: 'ปี 4: สหกิจศึกษา โครงงาน และความพร้อมจบ',
        semesters: [
            {
                semester: '1/2572',
                courses: [
                    { code: 'SCI441', title: 'สัมมนาวิทยาศาสตร์และนวัตกรรม', credits: 1, type: 'seminar', crossMajor: true },
                    { code: 'SCI442', title: 'โครงงานวิจัย/โครงงานพิเศษ', credits: 3, type: 'project', crossMajor: true },
                ],
            },
            {
                semester: '2/2572',
                courses: [
                    { code: 'SCI443', title: 'สหกิจศึกษา/ฝึกประสบการณ์วิชาชีพ', credits: 6, type: 'coop', crossMajor: true },
                ],
            },
        ],
    },
];

export const featuredCourses = [
    { code: 'SCI331', title: 'Data Visualization for Science', credits: 3, interestScore: 96, reason: 'ใช้ได้ทุกสาขาและต่อยอด dashboard/AI', crossMajor: true },
    { code: 'CSC333', title: 'Machine Learning', credits: 3, interestScore: 94, reason: 'รองรับงาน AI และวิทยาศาสตร์ข้อมูล', crossMajor: true },
    { code: 'SCI332', title: 'Lab Safety & Quality System', credits: 2, interestScore: 88, reason: 'จำเป็นกับห้องปฏิบัติการและการตรวจจบ', crossMajor: true },
    { code: 'STA242', title: 'แบบจำลองสถิติ', credits: 3, interestScore: 86, reason: 'ใช้วิเคราะห์ข้อมูลวิจัยและงานประกันคุณภาพ', crossMajor: true },
    { code: 'SCI333', title: 'Entrepreneurship for Science Innovation', credits: 3, interestScore: 82, reason: 'เชื่อมวิทยาศาสตร์กับธุรกิจนวัตกรรม', crossMajor: true },
];

export const gradeDistributions = [
    { code: 'SCI331', title: 'Data Visualization for Science', semester: '2/2568', enrolled: 118, avgGpa: 3.34, grades: { A: 34, 'B+': 30, B: 27, 'C+': 15, C: 8, D: 3, F: 1 } },
    { code: 'CSC333', title: 'Machine Learning', semester: '2/2568', enrolled: 76, avgGpa: 3.18, grades: { A: 16, 'B+': 21, B: 19, 'C+': 10, C: 6, D: 3, F: 1 } },
    { code: 'SCI332', title: 'Lab Safety & Quality System', semester: '1/2568', enrolled: 142, avgGpa: 3.52, grades: { A: 58, 'B+': 42, B: 28, 'C+': 9, C: 4, D: 1, F: 0 } },
    { code: 'STA242', title: 'แบบจำลองสถิติ', semester: '2/2568', enrolled: 64, avgGpa: 3.08, grades: { A: 11, 'B+': 15, B: 19, 'C+': 10, C: 6, D: 2, F: 1 } },
    { code: 'SCI333', title: 'Entrepreneurship for Science Innovation', semester: '1/2568', enrolled: 98, avgGpa: 3.41, grades: { A: 36, 'B+': 24, B: 22, 'C+': 10, C: 5, D: 1, F: 0 } },
];

export const courseAnalyticsData = {
    sources: courseAnalyticsSources,
    programs: sciencePrograms,
    branchStrengths,
    coursePlanByYear,
    featuredCourses,
    gradeDistributions,
    dataStatus: {
        courseCatalog: 'official_public_program_list',
        gradeDistribution: 'seed_waiting_reg_export',
        note: 'Grade distribution เป็น seed สำหรับออกแบบหน้า รอไฟล์ Reg จริงเพื่อแทนค่ารายวิชา/section/grade',
    },
};

export function getCourseAnalyticsSummary(data = courseAnalyticsData) {
    const crossMajorCourses = data.coursePlanByYear
        .flatMap(year => year.semesters)
        .flatMap(semester => semester.courses)
        .filter(course => course.crossMajor);
    const avgCourseGpa = data.gradeDistributions.reduce((sum, course) => sum + course.avgGpa, 0) / Math.max(1, data.gradeDistributions.length);

    return {
        programCount: data.programs.length,
        featuredCount: data.featuredCourses.length,
        crossMajorCount: crossMajorCourses.length,
        avgCourseGpa,
    };
}
