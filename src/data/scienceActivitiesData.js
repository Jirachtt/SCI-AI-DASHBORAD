const THAI_MONTHS = [
    'มกราคม',
    'กุมภาพันธ์',
    'มีนาคม',
    'เมษายน',
    'พฤษภาคม',
    'มิถุนายน',
    'กรกฎาคม',
    'สิงหาคม',
    'กันยายน',
    'ตุลาคม',
    'พฤศจิกายน',
    'ธันวาคม',
];

export const SCIENCE_ACTIVITY_REQUIREMENT = {
    faculty: 'คณะวิทยาศาสตร์',
    scope: 'ชั่วโมงกิจกรรมคณะวิทยาศาสตร์',
    programLabel: 'หลักสูตร 4 ปี',
    targetHours: 80,
    completedHours: 60,
    requiredEvents: 16,
    completedEvents: 12,
    lastUpdated: '2026-05-01',
    categoryTargets: [
        { name: 'กิจกรรมคณะวิทยาศาสตร์', currentEvents: 6, requiredEvents: 8, currentHours: 32, requiredHours: 40, color: 'var(--accent-success)' },
        { name: 'วิชาการ/ทักษะวิทยาศาสตร์', currentEvents: 3, requiredEvents: 4, currentHours: 13, requiredHours: 18, color: 'var(--accent-blue)' },
        { name: 'จิตอาสาและบริการชุมชน', currentEvents: 2, requiredEvents: 3, currentHours: 10, requiredHours: 14, color: 'var(--accent-orange)' },
        { name: 'กีฬา/ศิลปวัฒนธรรม', currentEvents: 1, requiredEvents: 1, currentHours: 5, requiredHours: 8, color: 'var(--accent-pink)' },
    ],
};

export const scienceActivityEvents = [
    {
        id: 'sci-2026-05-08-coop',
        title: 'อบรมเตรียมความพร้อมสหกิจศึกษาและทักษะวิทยาศาสตร์',
        type: 'วิชาการ',
        startDate: '2026-05-08',
        endDate: '2026-05-08',
        time: '09:00-12:00',
        location: 'ห้องประชุมคณะวิทยาศาสตร์',
        organizer: 'งานบริการการศึกษา คณะวิทยาศาสตร์',
        hours: 4,
        capacity: 160,
        registeredCount: 126,
        status: 'open',
        facultyHours: true,
        audience: 'นักศึกษาชั้นปีที่ 3-4',
        description: 'กิจกรรมเสริมทักษะอาชีพและการเตรียมความพร้อมก่อนออกสหกิจศึกษา',
    },
    {
        id: 'sci-2026-05-14-volunteer',
        title: 'Science Volunteer: ห้องแล็บปลอดภัยและพื้นที่สีเขียว',
        type: 'จิตอาสา',
        startDate: '2026-05-14',
        endDate: '2026-05-14',
        time: '13:00-16:00',
        location: 'อาคารปฏิบัติการรวม คณะวิทยาศาสตร์',
        organizer: 'สโมสรนักศึกษาคณะวิทยาศาสตร์',
        hours: 6,
        capacity: 120,
        registeredCount: 88,
        status: 'open',
        facultyHours: true,
        audience: 'นักศึกษาคณะวิทยาศาสตร์ทุกชั้นปี',
        description: 'กิจกรรมจิตอาสาดูแลพื้นที่คณะและเตรียมความพร้อมพื้นที่ปฏิบัติการ',
    },
    {
        id: 'sci-2026-05-22-ai',
        title: 'Data & AI Clinic for Science Students',
        type: 'วิชาการ',
        startDate: '2026-05-22',
        endDate: '2026-05-22',
        time: '13:00-16:00',
        location: 'ห้องคอมพิวเตอร์ SCI-IT',
        organizer: 'คณะวิทยาศาสตร์',
        hours: 3,
        capacity: 80,
        registeredCount: 72,
        status: 'nearly_full',
        facultyHours: true,
        audience: 'นักศึกษาที่สนใจทักษะข้อมูลและ AI',
        description: 'เวิร์กช็อปใช้ข้อมูลและ AI เพื่อทำรายงาน/โครงงานวิทยาศาสตร์',
    },
    {
        id: 'sci-2026-05-29-sports',
        title: 'กีฬา SCIสัมพันธ์ ประจำเดือนพฤษภาคม',
        type: 'กีฬา',
        startDate: '2026-05-29',
        endDate: '2026-05-29',
        time: '15:00-18:00',
        location: 'สนามกีฬาในร่ม มหาวิทยาลัยแม่โจ้',
        organizer: 'สโมสรนักศึกษาคณะวิทยาศาสตร์',
        hours: 5,
        capacity: 240,
        registeredCount: 154,
        status: 'open',
        facultyHours: true,
        audience: 'นักศึกษาคณะวิทยาศาสตร์ทุกชั้นปี',
        description: 'กิจกรรมเสริมสร้างความสัมพันธ์ระหว่างสาขาวิชาและชั้นปี',
    },
    {
        id: 'sci-2026-06-06-freshy',
        title: 'ปฐมนิเทศและรับน้องคณะวิทยาศาสตร์',
        type: 'รับน้อง',
        startDate: '2026-06-06',
        endDate: '2026-06-06',
        time: '08:30-16:30',
        location: 'อาคารแผ่พืชน์ คณะวิทยาศาสตร์',
        organizer: 'คณะวิทยาศาสตร์ และสโมสรนักศึกษา',
        hours: 8,
        capacity: 520,
        registeredCount: 318,
        status: 'open',
        facultyHours: true,
        audience: 'นักศึกษาใหม่และพี่เลี้ยงกิจกรรม',
        description: 'กิจกรรมต้อนรับนักศึกษาใหม่ แนะนำคณะ หลักสูตร และระบบชั่วโมงกิจกรรม',
    },
    {
        id: 'sci-2026-06-13-wai-kru',
        title: 'พิธีไหว้ครูคณะวิทยาศาสตร์',
        type: 'ศิลปวัฒนธรรม',
        startDate: '2026-06-13',
        endDate: '2026-06-13',
        time: '09:00-11:30',
        location: 'ห้องประชุมใหญ่ คณะวิทยาศาสตร์',
        organizer: 'งานกิจการนักศึกษา คณะวิทยาศาสตร์',
        hours: 3,
        capacity: 420,
        registeredCount: 271,
        status: 'open',
        facultyHours: true,
        audience: 'นักศึกษาคณะวิทยาศาสตร์ทุกชั้นปี',
        description: 'กิจกรรมส่งเสริมอัตลักษณ์ ความกตัญญู และความสัมพันธ์ระหว่างครูกับศิษย์',
    },
    {
        id: 'sci-2026-06-18-lab-safety',
        title: 'Science Lab Safety Orientation',
        type: 'วิชาการ',
        startDate: '2026-06-18',
        endDate: '2026-06-18',
        time: '13:00-16:30',
        location: 'อาคารปฏิบัติการเคมี คณะวิทยาศาสตร์',
        organizer: 'คณะกรรมการความปลอดภัยห้องปฏิบัติการ',
        hours: 4,
        capacity: 140,
        registeredCount: 92,
        status: 'open',
        facultyHours: true,
        audience: 'นักศึกษาที่ลงเรียนรายวิชาปฏิบัติการ',
        description: 'ปฐมนิเทศความปลอดภัยในห้องปฏิบัติการและการจัดการสารเคมีเบื้องต้น',
    },
    {
        id: 'sci-2026-06-27-community',
        title: 'ค่ายอาสาวิทย์บริการชุมชน',
        type: 'จิตอาสา',
        startDate: '2026-06-27',
        endDate: '2026-06-28',
        time: '08:00-16:00',
        location: 'พื้นที่บริการวิชาการจังหวัดเชียงใหม่',
        organizer: 'คณะวิทยาศาสตร์',
        hours: 10,
        capacity: 90,
        registeredCount: 44,
        status: 'open',
        facultyHours: true,
        audience: 'นักศึกษาคณะวิทยาศาสตร์ที่ต้องการเก็บชั่วโมงจิตอาสา',
        description: 'กิจกรรมบริการวิชาการและวิทยาศาสตร์สู่ชุมชน พร้อมบันทึกชั่วโมงคณะ',
    },
    {
        id: 'sci-2026-07-23-wai-kru',
        title: 'พิธีไหว้ครู มหาวิทยาลัยแม่โจ้ ประจำปีการศึกษา 2569',
        type: 'ศิลปวัฒนธรรม',
        startDate: '2026-07-23',
        endDate: '2026-07-23',
        time: '08:30-12:00',
        location: 'มหาวิทยาลัยแม่โจ้ จังหวัดเชียงใหม่',
        organizer: 'มหาวิทยาลัยแม่โจ้',
        hours: 3,
        capacity: 520,
        registeredCount: 438,
        status: 'nearly_full',
        facultyHours: true,
        audience: 'นักศึกษาคณะวิทยาศาสตร์ทุกชั้นปี',
        description: 'กิจกรรมส่งเสริมความกตัญญูและความสัมพันธ์ระหว่างศิษย์กับอาจารย์ อ้างอิงวันไหว้ครูจากปฏิทินการศึกษา MJU ปี 2569',
        isMock: true,
        source: 'official_mju_reference_with_mock_participation',
        sourceLabel: 'ปฏิทินการศึกษา MJU ปี 2569',
        sourceUrl: 'https://www.reg.mju.ac.th/registrar/calendar.asp?acadyear=2568&d1=2&schedulegroupid=1000&semester=1',
    },
    {
        id: 'sci-2026-07-25-new-student-identity',
        title: 'กิจกรรมพัฒนาศักยภาพนักศึกษาใหม่และอัตลักษณ์ลูกแม่โจ้',
        type: 'รับน้อง',
        startDate: '2026-07-25',
        endDate: '2026-07-25',
        time: '08:30-15:30',
        location: 'คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้',
        organizer: 'งานกิจการนักศึกษา คณะวิทยาศาสตร์',
        hours: 6,
        capacity: 420,
        registeredCount: 286,
        status: 'open',
        facultyHours: true,
        audience: 'นักศึกษาใหม่คณะวิทยาศาสตร์',
        description: 'กิจกรรมตัวอย่างตามข้อกำหนดการเข้าร่วมกิจกรรมพัฒนาศักยภาพนักศึกษาใหม่และเสริมสร้างอัตลักษณ์ลูกแม่โจ้ ปีการศึกษา 2569',
        isMock: true,
        source: 'official_mju_reference_with_mock_schedule',
        sourceLabel: 'ประกาศรับนักศึกษาใหม่ MJU ปี 2569',
        sourceUrl: 'https://admissions.mju.ac.th/FileAnnouncement/209.pdf',
    },
    {
        id: 'sci-2026-07-29-science-week-volunteer',
        title: 'ปฐมนิเทศอาสาสมัครงานสัปดาห์วิทยาศาสตร์แห่งชาติ 2569',
        type: 'จิตอาสา',
        startDate: '2026-07-29',
        endDate: '2026-07-29',
        time: '13:00-16:30',
        location: 'คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้',
        organizer: 'คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้',
        hours: 4,
        capacity: 180,
        registeredCount: 104,
        status: 'open',
        facultyHours: true,
        audience: 'นักศึกษาคณะวิทยาศาสตร์ที่สมัครเป็นอาสาสมัคร',
        description: 'กิจกรรมเตรียมความพร้อมอาสาสมัครสำหรับงานสัปดาห์วิทยาศาสตร์แห่งชาติ ส่วนภูมิภาค ประจำปี 2569',
        isMock: true,
        source: 'official_mju_event_with_mock_orientation',
        sourceLabel: 'Science Week 2026 · MJU',
        sourceUrl: 'https://sciencebase.mju.ac.th/scienceweekmju/',
    },
    {
        id: 'sci-2026-08-18-science-week',
        title: 'สัปดาห์วิทยาศาสตร์แห่งชาติ ส่วนภูมิภาค ประจำปี 2569',
        type: 'วิชาการ',
        startDate: '2026-08-18',
        endDate: '2026-08-20',
        time: '08:30-16:30',
        location: 'คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้',
        organizer: 'คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้',
        hours: 8,
        capacity: 1200,
        registeredCount: 846,
        status: 'open',
        facultyHours: true,
        audience: 'นักศึกษา นักเรียน ครู และประชาชนทั่วไป',
        description: 'นิทรรศการ การแข่งขัน และกิจกรรมวิทยาศาสตร์ ระหว่างวันที่ 18-20 สิงหาคม 2569 ตามประกาศคณะวิทยาศาสตร์',
        isMock: true,
        source: 'official_mju_event_with_mock_participation',
        sourceLabel: 'Science Week 2026 · MJU',
        sourceUrl: 'https://sciencebase.mju.ac.th/scienceweekmju/',
    },
    {
        id: 'sci-2026-08-19-rov',
        title: 'การแข่งขัน E-Sports Arena of Valor: RoV ประจำปี 2569',
        type: 'กีฬา',
        startDate: '2026-08-19',
        endDate: '2026-08-19',
        time: '09:00-16:30',
        location: 'ห้องปฏิบัติการคอมพิวเตอร์ 3203 อาคารจุฬาภรณ์',
        organizer: 'หลักสูตรวิทยาการคอมพิวเตอร์ คณะวิทยาศาสตร์',
        hours: 6,
        capacity: 96,
        registeredCount: 72,
        status: 'open',
        facultyHours: true,
        audience: 'นักศึกษาและผู้สนใจทั่วไป',
        description: 'การแข่งขัน RoV ภายในงานสัปดาห์วิทยาศาสตร์แห่งชาติ วันที่ 19 สิงหาคม 2569 ตามประกาศผู้จัดงาน',
        isMock: true,
        source: 'official_mju_event_with_mock_participation',
        sourceLabel: 'Science Week 2026 · MJU',
        sourceUrl: 'https://sciencebase.mju.ac.th/scienceweekmju/',
    },
    {
        id: 'sci-2026-08-20-science-service',
        title: 'อาสาวิทยาศาสตร์บริการผู้เข้าชมงาน Science Week 2026',
        type: 'จิตอาสา',
        startDate: '2026-08-20',
        endDate: '2026-08-20',
        time: '08:00-16:30',
        location: 'คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้',
        organizer: 'คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้',
        hours: 8,
        capacity: 160,
        registeredCount: 112,
        status: 'open',
        facultyHours: true,
        audience: 'นักศึกษาคณะวิทยาศาสตร์ทุกชั้นปี',
        description: 'กิจกรรมตัวอย่างสำหรับนักศึกษาที่ช่วยงานนิทรรศการและบริการผู้เข้าชมในวันสุดท้ายของสัปดาห์วิทยาศาสตร์แห่งชาติ',
        isMock: true,
        source: 'official_mju_event_with_mock_activity_hours',
        sourceLabel: 'Science Week 2026 · MJU',
        sourceUrl: 'https://sciencebase.mju.ac.th/scienceweekmju/',
    },
];

// The bundled calendar is a historical fixture. When it no longer overlaps
// the current or next month, create a small, clearly marked MJU-style demo
// calendar so the dashboard never renders an empty activity view between
// official calendar synchronisations.
export function createRollingScienceActivityEvents(referenceDate = new Date()) {
    const current = new Date(referenceDate);
    current.setHours(0, 0, 0, 0);
    const monthDate = (offset, day) => {
        const month = new Date(current.getFullYear(), current.getMonth() + offset, 1);
        const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
        const date = new Date(month.getFullYear(), month.getMonth(), Math.min(day, lastDay));
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    const templates = [
        {
            key: 'ai-clinic', offset: 0, day: 6, title: 'Data & AI Clinic for Science Students', type: 'วิชาการ', hours: 3,
            time: '13:00-16:00', location: 'ห้องคอมพิวเตอร์ SCI-IT', organizer: 'คณะวิทยาศาสตร์', capacity: 80, registeredCount: 46,
            audience: 'นักศึกษาที่สนใจทักษะข้อมูลและ AI', description: 'เวิร์กช็อปใช้ข้อมูลและ AI เพื่อทำรายงานและโครงงานวิทยาศาสตร์', status: 'open',
        },
        {
            key: 'volunteer', offset: 0, day: 15, title: 'Science Volunteer: ห้องแล็บปลอดภัยและพื้นที่สีเขียว', type: 'จิตอาสา', hours: 6,
            time: '09:00-15:00', location: 'อาคารปฏิบัติการรวม คณะวิทยาศาสตร์', organizer: 'สโมสรนักศึกษาคณะวิทยาศาสตร์', capacity: 120, registeredCount: 71,
            audience: 'นักศึกษาคณะวิทยาศาสตร์ทุกชั้นปี', description: 'กิจกรรมจิตอาสาดูแลพื้นที่คณะและเตรียมความพร้อมพื้นที่ปฏิบัติการ', status: 'open',
        },
        {
            key: 'sci-sport', offset: 0, day: 24, title: 'กีฬา SCI สัมพันธ์ ประจำเดือน', type: 'กีฬา', hours: 5,
            time: '15:00-18:00', location: 'สนามกีฬาในร่ม มหาวิทยาลัยแม่โจ้', organizer: 'สโมสรนักศึกษาคณะวิทยาศาสตร์', capacity: 240, registeredCount: 132,
            audience: 'นักศึกษาคณะวิทยาศาสตร์ทุกชั้นปี', description: 'กิจกรรมเสริมสร้างความสัมพันธ์ระหว่างสาขาวิชาและชั้นปี', status: 'open',
        },
        {
            key: 'lab-safety', offset: 1, day: 5, title: 'Science Lab Safety Orientation', type: 'วิชาการ', hours: 4,
            time: '13:00-16:30', location: 'อาคารปฏิบัติการเคมี คณะวิทยาศาสตร์', organizer: 'คณะกรรมการความปลอดภัยห้องปฏิบัติการ', capacity: 140, registeredCount: 83,
            audience: 'นักศึกษาที่ลงเรียนรายวิชาปฏิบัติการ', description: 'ปฐมนิเทศความปลอดภัยในห้องปฏิบัติการและการจัดการสารเคมีเบื้องต้น', status: 'open',
        },
        {
            key: 'community', offset: 1, day: 15, title: 'ค่ายอาสาวิทย์บริการชุมชน', type: 'จิตอาสา', hours: 10,
            time: '08:00-16:00', location: 'พื้นที่บริการวิชาการจังหวัดเชียงใหม่', organizer: 'คณะวิทยาศาสตร์', capacity: 90, registeredCount: 39,
            audience: 'นักศึกษาที่ต้องการเก็บชั่วโมงจิตอาสา', description: 'กิจกรรมบริการวิชาการและวิทยาศาสตร์สู่ชุมชน พร้อมบันทึกชั่วโมงคณะ', status: 'open',
        },
        {
            key: 'culture', offset: 1, day: 24, title: 'กิจกรรมศิลปวัฒนธรรม SCI', type: 'ศิลปวัฒนธรรม', hours: 3,
            time: '09:00-12:00', location: 'ห้องประชุมใหญ่ คณะวิทยาศาสตร์', organizer: 'งานกิจการนักศึกษา คณะวิทยาศาสตร์', capacity: 180, registeredCount: 64,
            audience: 'นักศึกษาคณะวิทยาศาสตร์ทุกชั้นปี', description: 'กิจกรรมส่งเสริมอัตลักษณ์และความสัมพันธ์ระหว่างครูกับศิษย์', status: 'open',
        },
    ];

    return templates.map(item => {
        const startDate = monthDate(item.offset, item.day);
        const key = item.key;
        const event = { ...item };
        delete event.key;
        delete event.offset;
        delete event.day;
        return {
            ...event,
            id: `sci-mock-${startDate}-${key}`,
            startDate,
            endDate: startDate,
            facultyHours: true,
            isMock: true,
            source: 'mock_rolling_mju',
        };
    });
}

function asDate(value) {
    return new Date(`${value}T00:00:00+07:00`);
}

export function monthKeyFromDate(date) {
    const d = date instanceof Date ? date : asDate(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatThaiMonth(date) {
    const d = date instanceof Date ? date : asDate(date);
    return `${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

export function formatScienceActivityDate(activity) {
    const start = asDate(activity.startDate);
    const end = asDate(activity.endDate || activity.startDate);
    const startText = `${start.getDate()} ${THAI_MONTHS[start.getMonth()]} ${start.getFullYear() + 543}`;
    if (activity.endDate && activity.endDate !== activity.startDate) {
        return `${start.getDate()}-${end.getDate()} ${THAI_MONTHS[end.getMonth()]} ${end.getFullYear() + 543}`;
    }
    return startText;
}

export function getScienceActivityEventsForDate(referenceDate = new Date()) {
    const currentKey = monthKeyFromDate(referenceDate);
    const next = new Date(referenceDate);
    next.setMonth(next.getMonth() + 1);
    const nextKey = monthKeyFromDate(next);
    const staticEvents = scienceActivityEvents.filter(event => event.facultyHours);
    const hasCurrentWindow = staticEvents.some(event => {
        const key = monthKeyFromDate(event.startDate);
        return key === currentKey || key === nextKey;
    });
    return hasCurrentWindow ? staticEvents : [...staticEvents, ...createRollingScienceActivityEvents(referenceDate)];
}

export function getScienceActivityWindow(referenceDate = new Date()) {
    const current = new Date(referenceDate);
    const next = new Date(current);
    next.setMonth(current.getMonth() + 1);
    const currentKey = monthKeyFromDate(current);
    const nextKey = monthKeyFromDate(next);
    const events = getScienceActivityEventsForDate(referenceDate);
    const thisMonth = events.filter(event => monthKeyFromDate(event.startDate) === currentKey);
    const nextMonth = events.filter(event => monthKeyFromDate(event.startDate) === nextKey);
    const upcoming = events
        .filter(event => asDate(event.startDate) >= new Date(current.getFullYear(), current.getMonth(), current.getDate()))
        .sort((a, b) => asDate(a.startDate) - asDate(b.startDate));

    return {
        currentKey,
        nextKey,
        currentMonthLabel: formatThaiMonth(current),
        nextMonthLabel: formatThaiMonth(next),
        thisMonth,
        nextMonth,
        all: events,
        upcoming,
    };
}

export function sumScienceActivityHours(events = []) {
    return events.reduce((sum, event) => sum + Number(event.hours || 0), 0);
}

export function getRecommendedScienceActivities(missingHours, referenceDate = new Date(), sourceEvents = scienceActivityEvents) {
    const needed = Math.max(0, Number(missingHours || 0));
    if (needed === 0) {
        return {
            needed,
            selected: [],
            accumulated: 0,
            willComplete: true,
        };
    }
    const current = new Date(referenceDate);
    current.setHours(0, 0, 0, 0);
    const upcoming = (sourceEvents || scienceActivityEvents)
        .filter(event => event.facultyHours && asDate(event.startDate) >= current)
        .sort((a, b) => asDate(a.startDate) - asDate(b.startDate));
    const selected = [];
    let accumulated = 0;

    for (const event of upcoming.filter(event => event.status !== 'closed' && event.status !== 'completed')) {
        if (accumulated >= needed && selected.length >= 3) break;
        selected.push(event);
        accumulated += Number(event.hours || 0);
        if (accumulated >= needed && selected.length >= 3) break;
    }

    return {
        needed,
        selected,
        accumulated,
        willComplete: needed > 0 ? accumulated >= needed : true,
    };
}

export function getScienceActivitySummary(referenceDate = new Date()) {
    const window = getScienceActivityWindow(referenceDate);
    const missingHours = Math.max(0, SCIENCE_ACTIVITY_REQUIREMENT.targetHours - SCIENCE_ACTIVITY_REQUIREMENT.completedHours);
    return {
        ...window,
        requirement: SCIENCE_ACTIVITY_REQUIREMENT,
        missingHours,
        thisMonthHours: sumScienceActivityHours(window.thisMonth),
        nextMonthHours: sumScienceActivityHours(window.nextMonth),
        upcomingHours: sumScienceActivityHours(window.upcoming),
        recommendation: getRecommendedScienceActivities(missingHours, referenceDate, window.all),
    };
}
