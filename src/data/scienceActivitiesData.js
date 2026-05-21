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
];

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

export function getScienceActivityWindow(referenceDate = new Date()) {
    const current = new Date(referenceDate);
    const next = new Date(current);
    next.setMonth(current.getMonth() + 1);
    const currentKey = monthKeyFromDate(current);
    const nextKey = monthKeyFromDate(next);
    const events = scienceActivityEvents.filter(event => event.facultyHours);
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
        recommendation: getRecommendedScienceActivities(missingHours, referenceDate),
    };
}
