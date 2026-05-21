export const OFFICIAL_STUDENT_SNAPSHOT_DATE = '2026-05-16';
export const OFFICIAL_STUDENT_SOURCE_URL = 'https://dashboard.mju.ac.th/student';

export const OFFICIAL_STUDENT_LEVELS = [
    { key: 'certificate', level: 'ประกาศนียบัตร', count: 73, color: 'var(--accent-success)', icon: 'Cert' },
    { key: 'bachelor', level: 'ปริญญาตรี', count: 15693, color: 'var(--accent-success-deep)', icon: 'BSc' },
    { key: 'master', level: 'ปริญญาโท', count: 417, color: 'var(--accent-info)', icon: 'MSc' },
    { key: 'doctoral', level: 'ปริญญาเอก', count: 209, color: 'var(--accent-pink)', icon: 'PhD' },
];

export const OFFICIAL_SCIENCE_STUDENT_LEVELS = [
    { key: 'certificate', level: 'ประกาศนียบัตร', count: 0, color: 'var(--accent-success)', icon: 'Cert' },
    { key: 'bachelor', level: 'ปริญญาตรี', count: 1369, color: 'var(--accent-success-deep)', icon: 'BSc' },
    { key: 'master', level: 'ปริญญาโท', count: 16, color: 'var(--accent-info)', icon: 'MSc' },
    { key: 'doctoral', level: 'ปริญญาเอก', count: 5, color: 'var(--accent-pink)', icon: 'PhD' },
];

export const OFFICIAL_STUDENT_FACULTY_ROWS = [
    { name: 'คณะบริหารธุรกิจ', certificate: 0, bachelor: 3565, master: 56, doctoral: 8, total: 3629 },
    { name: 'คณะผลิตกรรมการเกษตร', certificate: 0, bachelor: 1878, master: 90, doctoral: 79, total: 2047 },
    { name: 'คณะวิทยาศาสตร์', certificate: 0, bachelor: 1369, master: 16, doctoral: 5, total: 1390 },
    { name: 'คณะสารสนเทศและการสื่อสาร', certificate: 0, bachelor: 1229, master: 0, doctoral: 0, total: 1229 },
    { name: 'วิทยาลัยบริหารศาสตร์', certificate: 0, bachelor: 942, master: 59, doctoral: 12, total: 1013 },
    { name: 'มหาวิทยาลัยแม่โจ้ - แพร่ เฉลิมพระเกียรติ', certificate: 0, bachelor: 872, master: 54, doctoral: 0, total: 926 },
    { name: 'คณะศิลปศาสตร์', certificate: 0, bachelor: 916, master: 0, doctoral: 0, total: 916 },
    { name: 'คณะเศรษฐศาสตร์', certificate: 0, bachelor: 812, master: 9, doctoral: 17, total: 838 },
    { name: 'คณะพัฒนาการท่องเที่ยว', certificate: 0, bachelor: 788, master: 8, doctoral: 12, total: 808 },
    { name: 'วิทยาลัยพลังงานทดแทน', certificate: 0, bachelor: 735, master: 47, doctoral: 10, total: 792 },
    { name: 'คณะสัตวศาสตร์และเทคโนโลยี', certificate: 0, bachelor: 683, master: 20, doctoral: 1, total: 704 },
    { name: 'คณะวิศวกรรมและอุตสาหกรรมเกษตร', certificate: 0, bachelor: 629, master: 8, doctoral: 4, total: 641 },
    { name: 'คณะสถาปัตยกรรมศาสตร์และการออกแบบสิ่งแวดล้อม', certificate: 0, bachelor: 409, master: 9, doctoral: 10, total: 428 },
    { name: 'คณะเทคโนโลยีการประมงและทรัพยากรทางน้ำ', certificate: 0, bachelor: 401, master: 6, doctoral: 4, total: 411 },
    { name: 'มหาวิทยาลัยแม่โจ้-ชุมพร', certificate: 0, bachelor: 238, master: 0, doctoral: 0, total: 238 },
    { name: 'คณะพยาบาลศาสตร์', certificate: 0, bachelor: 131, master: 0, doctoral: 0, total: 131 },
    { name: 'คณะสัตวแพทยศาสตร์', certificate: 0, bachelor: 96, master: 0, doctoral: 0, total: 96 },
    { name: 'วิทยาลัยนานาชาติ', certificate: 0, bachelor: 0, master: 35, doctoral: 47, total: 82 },
    { name: 'โครงการ', certificate: 73, bachelor: 0, master: 0, doctoral: 0, total: 73 },
];

export const OFFICIAL_STUDENT_TOTAL = 16392;
export const OFFICIAL_SCIENCE_STUDENT_TOTAL = 1390;

const STALE_SCIENCE_TOTALS = new Set([1398, 1399, 1451, 1452]);
const STALE_CURRENT_TOTALS = new Set([16475, 16505, 16506, 16834, 16839]);
const SCIENCE_MATCH = 'วิทยาศาสตร์';

function clone(value) {
    if (value == null) return value;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return value;
    }
}

function toNumber(value, fallback = null) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function facultyKey(name) {
    return String(name || '').replace(/^คณะ/, '').replace(/\s+/g, '').trim();
}

function rowTotal(row = {}) {
    return toNumber(row.total, null)
        ?? toNumber(row.totalStudents, null)
        ?? (toNumber(row.certificate, 0) + toNumber(row.bachelor, 0) + toNumber(row.master, 0) + toNumber(row.doctoral, 0));
}

function findScienceRow(rows = []) {
    return Array.isArray(rows) ? rows.find(row => String(row?.name || row?.faculty || '').includes(SCIENCE_MATCH)) : null;
}

function officialLevels() {
    return OFFICIAL_STUDENT_LEVELS.map(row => ({
        level: row.level,
        count: row.count,
        color: row.color,
        icon: row.icon,
    }));
}

function officialScienceLevels() {
    return OFFICIAL_SCIENCE_STUDENT_LEVELS.map(row => ({
        level: row.level,
        count: row.count,
        color: row.color,
        icon: row.icon,
    }));
}

function shouldApplyOfficialStudentSnapshot(payload, scienceRow) {
    const scienceTotal = toNumber(payload?.scienceFaculty?.total, null) ?? rowTotal(scienceRow);
    const currentTotal = toNumber(payload?.current?.total, null) ?? toNumber(payload?.totalStudents, null);
    return STALE_SCIENCE_TOTALS.has(scienceTotal) || STALE_CURRENT_TOTALS.has(currentTotal);
}

function mergeOfficialFacultyRows(existingRows = [], { summary = false } = {}) {
    const existingByName = new Map(
        (Array.isArray(existingRows) ? existingRows : []).map(row => [facultyKey(row.name || row.faculty), row])
    );

    return OFFICIAL_STUDENT_FACULTY_ROWS.map(official => {
        const previous = existingByName.get(facultyKey(official.name)) || {};
        if (summary) {
            return {
                ...previous,
                name: previous.name || official.name,
                totalStudents: official.total,
            };
        }
        return {
            ...previous,
            ...official,
        };
    });
}

function applyToStudentStats(payload) {
    const next = clone(payload) || {};
    const scienceRow = findScienceRow(next.byFaculty);
    if (!shouldApplyOfficialStudentSnapshot(next, scienceRow)) return payload;

    next.current = {
        ...(next.current || {}),
        total: OFFICIAL_STUDENT_TOTAL,
        byLevel: officialLevels(),
    };
    next.byFaculty = mergeOfficialFacultyRows(next.byFaculty);

    const previousScience = next.scienceFaculty || {};
    const ratio = previousScience.studentFacultyRatio || {};
    const academicStaff = toNumber(ratio.academicStaff, null);
    next.scienceFaculty = {
        ...previousScience,
        name: previousScience.name || 'คณะวิทยาศาสตร์',
        total: OFFICIAL_SCIENCE_STUDENT_TOTAL,
        byLevel: officialScienceLevels(),
        linkedStudentRows: previousScience.linkedStudentRows
            ? {
                ...previousScience.linkedStudentRows,
                officialTotal: OFFICIAL_SCIENCE_STUDENT_TOTAL,
                rosterRows: previousScience.linkedStudentRows.rowCount,
            }
            : previousScience.linkedStudentRows,
        studentFacultyRatio: ratio
            ? {
                ...ratio,
                students: OFFICIAL_SCIENCE_STUDENT_TOTAL,
                ratio: academicStaff ? Number((OFFICIAL_SCIENCE_STUDENT_TOTAL / academicStaff).toFixed(1)) : ratio.ratio,
            }
            : ratio,
    };
    next.sourceCoverage = {
        ...(next.sourceCoverage || {}),
        officialSnapshot: {
            checkedAt: OFFICIAL_STUDENT_SNAPSHOT_DATE,
            sourceUrl: OFFICIAL_STUDENT_SOURCE_URL,
            fields: ['current.total', 'current.byLevel', 'byFaculty', 'scienceFaculty.total', 'scienceFaculty.byLevel'],
        },
    };
    return next;
}

function applyToDashboardSummary(payload) {
    const next = clone(payload) || {};
    const scienceRow = findScienceRow(next.faculties);
    if (!shouldApplyOfficialStudentSnapshot(next, scienceRow)) return payload;

    next.totalStudents = OFFICIAL_STUDENT_TOTAL;
    next.faculties = mergeOfficialFacultyRows(next.faculties, { summary: true });
    next.sourceCoverage = {
        ...(next.sourceCoverage || {}),
        officialSnapshot: {
            checkedAt: OFFICIAL_STUDENT_SNAPSHOT_DATE,
            sourceUrl: OFFICIAL_STUDENT_SOURCE_URL,
            fields: ['totalStudents', 'faculties.totalStudents'],
        },
    };
    return next;
}

export function applyOfficialStudentSnapshot(id, payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
    if (id === 'student_stats') return applyToStudentStats(payload);
    if (id === 'dashboard_summary') return applyToDashboardSummary(payload);
    return payload;
}
