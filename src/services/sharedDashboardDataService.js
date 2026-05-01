import {
    DASHBOARD_DATASETS,
    ensureDashboardLiveData,
    getDashboardDatasetMetaSync,
    getDashboardDatasetSync,
    onDashboardLiveDataChange,
} from './dashboardLiveDataService';
import {
    ensureStudentList,
    getStudentListSync,
    isLiveData as isStudentListLive,
    onStudentDataChange,
} from './studentDataService';

const SCIENCE_FACULTY_NAME = 'คณะวิทยาศาสตร์';
const LINKED_STUDENT_DATASETS = new Set(['dashboard_summary', 'student_stats', 'graduation']);

const LEVEL_DEFS = [
    { key: 'bachelor', label: 'ปริญญาตรี', color: '#2563eb', icon: 'BSc', pattern: /ตรี|bachelor|bsc/i },
    { key: 'master', label: 'ปริญญาโท', color: '#7c3aed', icon: 'MSc', pattern: /โท|master|msc/i },
    { key: 'doctoral', label: 'ปริญญาเอก', color: '#ea580c', icon: 'PhD', pattern: /เอก|doctoral|phd/i },
    { key: 'certificate', label: 'ประกาศนียบัตร', color: '#059669', icon: 'Cert', pattern: /ประกาศ|cert/i },
];

function clone(value) {
    if (value == null) return value;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return value;
    }
}

function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function round(value, digits = 2) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Number(n.toFixed(digits));
}

function sumLevelCounts(counts) {
    return LEVEL_DEFS.reduce((sum, level) => sum + toNumber(counts[level.key]), 0);
}

function levelKeyFromText(text) {
    const source = String(text || '');
    return LEVEL_DEFS.find(level => level.pattern.test(source))?.key || 'bachelor';
}

function levelKeyFromStudent(student) {
    return levelKeyFromText(`${student?.level || ''} ${student?.degree || ''} ${student?.degreeLevel || ''}`);
}

function emptyLevelCounts() {
    return Object.fromEntries(LEVEL_DEFS.map(level => [level.key, 0]));
}

function levelCountsFromRows(rows = []) {
    const counts = emptyLevelCounts();
    rows.forEach(student => {
        const key = levelKeyFromStudent(student);
        counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
}

function levelCountsFromLevelRows(rows = []) {
    const counts = emptyLevelCounts();
    (rows || []).forEach(row => {
        const key = levelKeyFromText(row.level || row.label || row.key);
        counts[key] += toNumber(row.count ?? row.value);
    });
    return counts;
}

function levelCountsFromFacultyRow(row = {}) {
    return {
        ...emptyLevelCounts(),
        certificate: toNumber(row.certificate),
        bachelor: toNumber(row.bachelor),
        master: toNumber(row.master),
        doctoral: toNumber(row.doctoral),
    };
}

function levelRowsFromCounts(counts, existingRows = []) {
    const used = new Set();
    const ordered = [];

    (existingRows || []).forEach(row => {
        const def = LEVEL_DEFS.find(level => levelKeyFromText(row.level || row.label || row.key) === level.key);
        if (def && !used.has(def.key)) {
            ordered.push(def);
            used.add(def.key);
        }
    });

    LEVEL_DEFS.forEach(def => {
        if (!used.has(def.key)) ordered.push(def);
    });

    return ordered.map((def, index) => {
        const existing = (existingRows || []).find(row => levelKeyFromText(row.level || row.label || row.key) === def.key) || {};
        return {
            ...existing,
            level: existing.level || existing.label || def.label,
            count: toNumber(counts[def.key]),
            color: existing.color || def.color,
            icon: existing.icon || def.icon,
            order: existing.order ?? index + 1,
        };
    });
}

function studentEntryYear(student, fallbackCurrentYear) {
    const explicit = toNumber(student?.admissionYear || student?.enrollmentYear || student?.entryYear, null);
    if (explicit >= 2500 && explicit <= 2600) return String(explicit);
    if (explicit >= 40 && explicit <= 99) return String(2500 + explicit);

    const id = String(student?.id || student?.studentId || student?.student_id || '');
    const match = id.match(/^(\d{2})/);
    if (match) {
        const shortYear = Number(match[1]);
        if (shortYear >= 40 && shortYear <= 99) return String(2500 + shortYear);
    }

    const classYear = toNumber(student?.year, null);
    if (classYear > 0 && fallbackCurrentYear) return String(fallbackCurrentYear - classYear + 1);
    return null;
}

function countRowsByYear(rows = []) {
    const idYears = rows
        .map(student => studentEntryYear(student, null))
        .filter(Boolean)
        .map(Number);
    const fallbackCurrentYear = idYears.length ? Math.max(...idYears) : new Date().getFullYear() + 543;
    const byYear = new Map();

    rows.forEach(student => {
        const year = studentEntryYear(student, fallbackCurrentYear);
        if (!year) return;
        const key = String(year);
        const level = levelKeyFromStudent(student);
        const current = byYear.get(key) || { year: key, total: 0, ...emptyLevelCounts() };
        current.total += 1;
        current[level] = (current[level] || 0) + 1;
        byYear.set(key, current);
    });

    return [...byYear.values()].sort((a, b) => Number(a.year) - Number(b.year));
}

function scaleExistingRowsToTotal(rows = [], total, countKey = 'count') {
    const sourceTotal = rows.reduce((sum, row) => sum + toNumber(row[countKey]), 0);
    if (!sourceTotal || !Number.isFinite(Number(total))) return rows;
    let remaining = total;
    return rows.map((row, index) => {
        const isLast = index === rows.length - 1;
        const next = isLast ? remaining : Math.round((toNumber(row[countKey]) / sourceTotal) * total);
        remaining -= next;
        return { ...row, [countKey]: Math.max(0, next) };
    });
}

function buildStudentSnapshot(rows = []) {
    const total = rows.length;
    const levelCounts = levelCountsFromRows(rows);
    const enrollment = countRowsByYear(rows);
    const byMajorMap = new Map();
    let gpaSum = 0;
    let gpaCount = 0;
    let male = 0;
    let female = 0;
    let knownGender = 0;
    let knownNationality = 0;
    let thai = 0;
    let international = 0;

    rows.forEach(student => {
        const major = student?.major || 'ไม่ระบุสาขา';
        const levelKey = levelKeyFromStudent(student);
        const gpa = Number(student?.gpa);
        const currentMajor = byMajorMap.get(major) || {
            major,
            count: 0,
            total: 0,
            ...emptyLevelCounts(),
            gpaSum: 0,
            gpaCount: 0,
            lowGpa: 0,
        };

        currentMajor.count += 1;
        currentMajor.total += 1;
        currentMajor[levelKey] = (currentMajor[levelKey] || 0) + 1;
        if (Number.isFinite(gpa) && gpa > 0) {
            currentMajor.gpaSum += gpa;
            currentMajor.gpaCount += 1;
            gpaSum += gpa;
            gpaCount += 1;
            if (gpa < 2) currentMajor.lowGpa += 1;
        }
        byMajorMap.set(major, currentMajor);

        const prefix = String(student?.prefix || '').trim();
        if (prefix.startsWith('นาย')) {
            male += 1;
            knownGender += 1;
        } else if (prefix.startsWith('นาง') || prefix.startsWith('น.ส')) {
            female += 1;
            knownGender += 1;
        }

        const nationality = String(student?.nationality || student?.nation || '').trim();
        if (nationality) {
            knownNationality += 1;
            if (/ไทย|thai/i.test(nationality)) thai += 1;
            else international += 1;
        }
    });

    const byMajor = [...byMajorMap.values()]
        .map(({ gpaSum: majorGpaSum, gpaCount: majorGpaCount, ...major }) => ({
            ...major,
            avgGPA: majorGpaCount ? round(majorGpaSum / majorGpaCount) : null,
        }))
        .sort((a, b) => b.total - a.total || a.major.localeCompare(b.major, 'th'));

    return {
        total,
        levelCounts,
        byLevel: levelRowsFromCounts(levelCounts),
        byEnrollmentYear: enrollment.map(row => ({ year: row.year, count: row.total })),
        newStudentIntake: enrollment.map(row => ({
            year: row.year,
            total: row.total,
            bachelor: row.bachelor || 0,
            master: row.master || 0,
            doctoral: row.doctoral || 0,
            certificate: row.certificate || 0,
            channels: {
                uploaded: row.total,
                quota: 0,
                directAdmit: 0,
                tcas: 0,
                other: 0,
            },
        })),
        byMajor,
        avgGPA: gpaCount ? round(gpaSum / gpaCount) : null,
        gpaDistribution: buildGpaDistribution(rows),
        gender: knownGender
            ? {
                male,
                female,
                malePercent: total ? round((male / total) * 100, 1) : 0,
                femalePercent: total ? round((female / total) * 100, 1) : 0,
            }
            : null,
        nationality: knownNationality
            ? [
                { nationality: 'ไทย', count: thai },
                { nationality: 'สัญชาติอื่นๆ', count: international },
            ]
            : null,
    };
}

function buildGpaDistribution(rows = []) {
    const ranges = [
        { range: 'ต่ำกว่า 2.00', min: -Infinity, max: 1.999 },
        { range: '2.00-2.49', min: 2, max: 2.499 },
        { range: '2.50-2.99', min: 2.5, max: 2.999 },
        { range: '3.00-3.49', min: 3, max: 3.499 },
        { range: '3.50-4.00', min: 3.5, max: 4.001 },
    ];
    return ranges.map(range => ({
        range: range.range,
        count: rows.filter(student => {
            const gpa = Number(student?.gpa);
            return Number.isFinite(gpa) && gpa >= range.min && gpa <= range.max;
        }).length,
    }));
}

function findScienceFaculty(rows = []) {
    return (rows || []).find(row => String(row?.name || '').includes('วิทยาศาสตร์'));
}

function computeScienceBaseline(studentStats = {}) {
    const science = studentStats.scienceFaculty || {};
    const facultyRow = findScienceFaculty(studentStats.byFaculty) || {};
    const scienceLevelCounts = science.byLevel?.length
        ? levelCountsFromLevelRows(science.byLevel)
        : levelCountsFromFacultyRow(facultyRow);
    const scienceTotal = toNumber(science.total) || toNumber(facultyRow.total) || sumLevelCounts(scienceLevelCounts);
    return { science, facultyRow, scienceLevelCounts, scienceTotal };
}

function patchTrendRows(trend = [], baseScienceCounts, snapshot) {
    const rows = Array.isArray(trend) ? clone(trend) : [];
    const actualRows = rows.filter(row => row.type !== 'forecast');
    const latestActual = actualRows[actualRows.length - 1];
    if (!latestActual) return rows;

    const totalDelta = snapshot.total - sumLevelCounts(baseScienceCounts);
    latestActual.total = Math.max(0, toNumber(latestActual.total) + totalDelta);
    LEVEL_DEFS.forEach(level => {
        if (level.key === 'certificate') return;
        const delta = toNumber(snapshot.levelCounts[level.key]) - toNumber(baseScienceCounts[level.key]);
        latestActual[level.key] = Math.max(0, toNumber(latestActual[level.key]) + delta);
    });
    return rows;
}

function patchOverallEnrollmentRows(overallRows = [], baseScienceRows = [], snapshotRows = []) {
    const rows = Array.isArray(overallRows) ? clone(overallRows) : [];
    const baseByYear = new Map((baseScienceRows || []).map(row => [String(row.year), toNumber(row.count)]));
    const nextByYear = new Map((snapshotRows || []).map(row => [String(row.year), toNumber(row.count)]));
    const allYears = new Set([...baseByYear.keys(), ...nextByYear.keys()]);
    const existingYears = new Set(rows.map(row => String(row.year)));

    allYears.forEach(year => {
        const delta = toNumber(nextByYear.get(year)) - toNumber(baseByYear.get(year));
        if (delta === 0) return;
        const existing = rows.find(row => String(row.year) === year);
        if (existing) {
            existing.count = Math.max(0, toNumber(existing.count) + delta);
        } else if (delta > 0 && !existingYears.has(year)) {
            rows.push({ year, count: delta, type: 'actual' });
            existingYears.add(year);
        }
    });

    return rows.sort((a, b) => Number(b.year) - Number(a.year));
}

function patchStudentStats(baseData) {
    const data = clone(baseData) || {};
    const rows = getStudentListSync();
    if (!Array.isArray(rows) || rows.length === 0) return data;

    const snapshot = buildStudentSnapshot(rows);
    const { science, facultyRow, scienceLevelCounts, scienceTotal } = computeScienceBaseline(data);
    const currentLevelCounts = levelCountsFromLevelRows(data.current?.byLevel || []);
    const totalDelta = snapshot.total - scienceTotal;
    const nextCurrentCounts = { ...currentLevelCounts };

    LEVEL_DEFS.forEach(level => {
        const delta = toNumber(snapshot.levelCounts[level.key]) - toNumber(scienceLevelCounts[level.key]);
        nextCurrentCounts[level.key] = Math.max(0, toNumber(nextCurrentCounts[level.key]) + delta);
    });

    const nextTotal = sumLevelCounts(nextCurrentCounts) || Math.max(0, toNumber(data.current?.total) + totalDelta);
    const nextScienceLevelRows = levelRowsFromCounts(snapshot.levelCounts, science.byLevel || []);

    data.current = {
        ...(data.current || {}),
        total: nextTotal,
        byLevel: levelRowsFromCounts(nextCurrentCounts, data.current?.byLevel || []),
    };

    data.byFaculty = Array.isArray(data.byFaculty) ? clone(data.byFaculty) : [];
    const scienceFacultyIndex = data.byFaculty.findIndex(row => String(row?.name || '').includes('วิทยาศาสตร์'));
    const nextScienceFacultyRow = {
        ...facultyRow,
        name: facultyRow.name || SCIENCE_FACULTY_NAME,
        total: snapshot.total,
        certificate: snapshot.levelCounts.certificate,
        bachelor: snapshot.levelCounts.bachelor,
        master: snapshot.levelCounts.master,
        doctoral: snapshot.levelCounts.doctoral,
    };
    if (scienceFacultyIndex >= 0) data.byFaculty[scienceFacultyIndex] = nextScienceFacultyRow;
    else data.byFaculty.push(nextScienceFacultyRow);

    data.byEnrollmentYear = patchOverallEnrollmentRows(
        data.byEnrollmentYear || [],
        science.byEnrollmentYear || [],
        snapshot.byEnrollmentYear
    );
    data.trend = patchTrendRows(data.trend || [], scienceLevelCounts, snapshot);

    const baseRatio = science.studentFacultyRatio || {};
    const academicStaff = toNumber(baseRatio.academicStaff);
    const nextScience = {
        ...science,
        name: science.name || SCIENCE_FACULTY_NAME,
        total: snapshot.total,
        byLevel: nextScienceLevelRows,
        byEnrollmentYear: snapshot.byEnrollmentYear,
        newStudentIntake: mergeIntakeChannels(snapshot.newStudentIntake, science.newStudentIntake || []),
        byMajor: snapshot.byMajor,
        gpaDistribution: snapshot.gpaDistribution,
        avgGPA: snapshot.avgGPA ?? science.avgGPA,
        byGender: snapshot.gender || scaleGender(science.byGender, snapshot.total),
        byNationality: snapshot.nationality || scaleExistingRowsToTotal(science.byNationality || [], snapshot.total),
        linkedStudentRows: {
            source: 'datasets/students',
            rowCount: snapshot.total,
            isLive: isStudentListLive(),
        },
        studentFacultyRatio: {
            ...baseRatio,
            students: snapshot.total,
            ratio: academicStaff ? round(snapshot.total / academicStaff, 1) : baseRatio.ratio,
        },
    };

    data.scienceFaculty = nextScience;
    data.sharedSource = {
        ...(data.sharedSource || {}),
        students: 'datasets/students',
        rowCount: snapshot.total,
        linkedAt: new Date().toISOString(),
        totalDelta,
    };
    return data;
}

function mergeIntakeChannels(nextIntake = [], existingIntake = []) {
    const existingByYear = new Map((existingIntake || []).map(row => [String(row.year), row]));
    return nextIntake.map(row => {
        const existing = existingByYear.get(String(row.year));
        return {
            ...row,
            channels: existing?.channels || row.channels,
        };
    });
}

function scaleGender(gender, total) {
    if (!gender || !total) return gender || { male: 0, female: 0, malePercent: 0, femalePercent: 0 };
    const sourceTotal = toNumber(gender.male) + toNumber(gender.female);
    if (!sourceTotal) return gender;
    const male = Math.round((toNumber(gender.male) / sourceTotal) * total);
    const female = Math.max(0, total - male);
    return {
        ...gender,
        male,
        female,
        malePercent: round((male / total) * 100, 1),
        femalePercent: round((female / total) * 100, 1),
    };
}

function patchDashboardSummary(baseData) {
    const data = clone(baseData) || {};
    const rows = getStudentListSync();
    if (!Array.isArray(rows) || rows.length === 0) return data;

    const snapshot = buildStudentSnapshot(rows);
    const faculties = Array.isArray(data.faculties) ? clone(data.faculties) : [];
    const scienceIndex = faculties.findIndex(row => String(row?.name || '').includes('วิทยาศาสตร์'));
    const science = scienceIndex >= 0 ? faculties[scienceIndex] : { name: SCIENCE_FACULTY_NAME };
    const originalScienceTotal = toNumber(science.totalStudents, snapshot.total);
    const originalOverallTotal = toNumber(data.totalStudents);
    const totalDelta = snapshot.total - originalScienceTotal;

    const nextScience = {
        ...science,
        name: science.name || SCIENCE_FACULTY_NAME,
        totalStudents: snapshot.total,
        avgGPA: snapshot.avgGPA ?? science.avgGPA,
        byLevel: snapshot.byLevel,
    };

    if (scienceIndex >= 0) faculties[scienceIndex] = nextScience;
    else faculties.push(nextScience);

    data.faculties = faculties;
    data.totalStudents = Math.max(0, originalOverallTotal + totalDelta);
    data.avgGPA = computeWeightedOverallGpa({
        overallAvg: data.avgGPA,
        overallTotal: originalOverallTotal,
        scienceAvg: science.avgGPA,
        scienceTotal: originalScienceTotal,
        nextScienceAvg: snapshot.avgGPA,
        nextScienceTotal: snapshot.total,
    }) ?? data.avgGPA;
    data.sharedSource = {
        ...(data.sharedSource || {}),
        students: 'datasets/students',
        scienceStudentRows: snapshot.total,
        totalDelta,
        linkedAt: new Date().toISOString(),
    };
    return data;
}

function graduationStatus(student) {
    const gpa = Number(student?.gpa);
    const status = String(student?.status || '');
    if (Number.isFinite(gpa) && gpa < 1.75) return 'ไม่ผ่านเกณฑ์';
    if (Number.isFinite(gpa) && gpa < 2) return 'รอพินิจ';
    if (status.includes('รอพินิจ')) return 'รอพินิจ';
    return 'คาดว่าจะสำเร็จ';
}

function honorsLabel(student) {
    const gpa = Number(student?.gpa);
    if (!Number.isFinite(gpa)) return 'ไม่ระบุ';
    if (gpa >= 3.5) return 'เกียรตินิยมอันดับ 1';
    if (gpa >= 3.25) return 'เกียรตินิยมอันดับ 2';
    if (gpa >= 2) return 'ปกติ';
    return 'ต่ำกว่าเกณฑ์';
}

function buildGraduationGpaDistribution(rows = []) {
    const ranges = [
        { range: '1.00-1.74', min: 1, max: 1.74, color: '#ef4444' },
        { range: '1.75-1.99', min: 1.75, max: 1.99, color: '#f97316' },
        { range: '2.00-2.49', min: 2, max: 2.49, color: '#eab308' },
        { range: '2.50-2.99', min: 2.5, max: 2.99, color: '#22c55e' },
        { range: '3.00-3.49', min: 3, max: 3.49, color: '#3b82f6' },
        { range: '3.50-4.00', min: 3.5, max: 4, color: '#8b5cf6' },
    ];
    return ranges.map(range => ({
        range: range.range,
        color: range.color,
        count: rows.filter(student => {
            const gpa = Number(student?.gpa);
            return Number.isFinite(gpa) && gpa >= range.min && gpa <= range.max;
        }).length,
    }));
}

function buildGraduationByMajor(rows = []) {
    const majorMap = new Map();
    rows.forEach(student => {
        const major = student?.major || 'ไม่ระบุสาขา';
        const gpa = Number(student?.gpa);
        const status = graduationStatus(student);
        const current = majorMap.get(major) || {
            major,
            total: 0,
            expected: 0,
            pending: 0,
            notPassed: 0,
            gpaSum: 0,
            gpaCount: 0,
        };
        current.total += 1;
        if (status === 'คาดว่าจะสำเร็จ') current.expected += 1;
        else if (status === 'รอพินิจ') current.pending += 1;
        else current.notPassed += 1;
        if (Number.isFinite(gpa)) {
            current.gpaSum += gpa;
            current.gpaCount += 1;
        }
        majorMap.set(major, current);
    });

    return [...majorMap.values()]
        .map(row => ({
            major: row.major,
            total: row.total,
            expected: row.expected,
            pending: row.pending,
            notPassed: row.notPassed,
            avgGPA: row.gpaCount ? round(row.gpaSum / row.gpaCount) : null,
            rate: row.total ? round((row.expected / row.total) * 100, 1) : 0,
        }))
        .sort((a, b) => b.total - a.total || a.major.localeCompare(b.major, 'th'));
}

function patchGraduationData(baseData) {
    const data = clone(baseData) || {};
    const rows = getStudentListSync();
    if (!Array.isArray(rows) || rows.length === 0) return data;

    const candidates = rows
        .filter(student => Number(student?.year) === 4 && levelKeyFromStudent(student) === 'bachelor')
        .map(student => ({
            ...student,
            graduationStatus: graduationStatus(student),
            honors: honorsLabel(student),
        }));
    const gradStudents = rows.filter(student => ['master', 'doctoral'].includes(levelKeyFromStudent(student)));
    const expectedGraduates = candidates.filter(student => student.graduationStatus === 'คาดว่าจะสำเร็จ').length;
    const pending = candidates.filter(student => student.graduationStatus === 'รอพินิจ').length;
    const notPassed = candidates.filter(student => student.graduationStatus === 'ไม่ผ่านเกณฑ์').length;
    const avgGPA = candidates.length
        ? round(candidates.reduce((sum, student) => sum + toNumber(student.gpa), 0) / candidates.length)
        : null;

    data.current = {
        ...(data.current || {}),
        totalCandidates: candidates.length,
        expectedGraduates,
        pending,
        notPassed,
        avgGPA,
        gradStudentsCandidates: gradStudents.length,
    };
    data.byMajor = buildGraduationByMajor(candidates);
    data.gpaDistribution = buildGraduationGpaDistribution(candidates);
    data.honors = {
        firstClass: candidates.filter(student => student.honors === 'เกียรตินิยมอันดับ 1').length,
        secondClass: candidates.filter(student => student.honors === 'เกียรตินิยมอันดับ 2').length,
        normal: candidates.filter(student => student.honors === 'ปกติ').length,
        belowStandard: candidates.filter(student => student.honors === 'ต่ำกว่าเกณฑ์').length,
    };
    data.candidateList = candidates;
    data.sharedSource = {
        ...(data.sharedSource || {}),
        students: 'datasets/students',
        rowCount: rows.length,
        candidateRows: candidates.length,
        isLive: isStudentListLive(),
        linkedAt: new Date().toISOString(),
    };
    return data;
}

function computeWeightedOverallGpa({
    overallAvg,
    overallTotal,
    scienceAvg,
    scienceTotal,
    nextScienceAvg,
    nextScienceTotal,
}) {
    if (
        !Number.isFinite(Number(overallAvg)) ||
        !Number.isFinite(Number(scienceAvg)) ||
        !Number.isFinite(Number(nextScienceAvg)) ||
        !overallTotal ||
        !scienceTotal ||
        !nextScienceTotal
    ) {
        return null;
    }

    const otherTotal = Math.max(0, overallTotal - scienceTotal);
    const otherGpaSum = (Number(overallAvg) * overallTotal) - (Number(scienceAvg) * scienceTotal);
    const nextTotal = otherTotal + nextScienceTotal;
    if (!nextTotal) return null;
    return round((otherGpaSum + (Number(nextScienceAvg) * nextScienceTotal)) / nextTotal, 2);
}

function getLinkedDataset(id) {
    const base = getDashboardDatasetSync(id);
    if (id === 'student_stats') return patchStudentStats(base);
    if (id === 'dashboard_summary') return patchDashboardSummary(base);
    if (id === 'graduation') return patchGraduationData(base);
    return base;
}

function getPayloadRowCount(payload) {
    if (Array.isArray(payload)) return payload.length;
    if (Array.isArray(payload?.rows)) return payload.rows.length;
    if (Array.isArray(payload?.faculties)) return payload.faculties.length;
    if (Array.isArray(payload?.byFaculty)) return payload.byFaculty.length;
    if (Array.isArray(payload?.yearly)) return payload.yearly.length;
    return payload ? null : 0;
}

export function getSharedDashboardDatasetSync(id) {
    return LINKED_STUDENT_DATASETS.has(id) ? getLinkedDataset(id) : getDashboardDatasetSync(id);
}

export function getSharedDashboardDatasetMetaSync(id) {
    const meta = getDashboardDatasetMetaSync(id);
    if (!LINKED_STUDENT_DATASETS.has(id)) return meta;

    const payload = getSharedDashboardDatasetSync(id);
    const studentRows = getStudentListSync();
    const studentLive = isStudentListLive();
    return {
        ...meta,
        isLive: Boolean(meta.isLive || studentLive),
        sourceType: studentLive ? 'linked_realtime' : meta.sourceType,
        rowCount: getPayloadRowCount(payload),
        linkedSources: [
            ...(Array.isArray(meta.linkedSources) ? meta.linkedSources : []),
            'datasets/students',
        ],
        linkedStudentRows: Array.isArray(studentRows) ? studentRows.length : 0,
        usesSharedDataHub: true,
    };
}

export async function ensureSharedDashboardData(ids = DASHBOARD_DATASETS.map(item => item.id)) {
    const list = Array.isArray(ids) ? ids : [ids];
    const needsStudents = list.some(id => LINKED_STUDENT_DATASETS.has(id));
    await Promise.all([
        ensureDashboardLiveData(list),
        needsStudents ? ensureStudentList() : Promise.resolve(),
    ]);
    return Object.fromEntries(list.map(id => [id, getSharedDashboardDatasetSync(id)]));
}

export function onSharedDashboardDataChange(callback) {
    const unsubscribeDashboard = onDashboardLiveDataChange(event => {
        const id = event?.id;
        if (!id) return;
        callback({
            id,
            payload: getSharedDashboardDatasetSync(id),
            meta: getSharedDashboardDatasetMetaSync(id),
        });
    });

    const unsubscribeStudents = onStudentDataChange(() => {
        LINKED_STUDENT_DATASETS.forEach(id => {
            callback({
                id,
                payload: getSharedDashboardDatasetSync(id),
                meta: getSharedDashboardDatasetMetaSync(id),
            });
        });
    });

    return () => {
        unsubscribeDashboard();
        unsubscribeStudents();
    };
}

export function getSharedDashboardFreshnessContext() {
    return DASHBOARD_DATASETS.map(item => {
        const meta = getSharedDashboardDatasetMetaSync(item.id);
        const updated = meta.updatedAt ? meta.updatedAt.toLocaleString('th-TH') : 'fallback';
        const status = meta.isLive ? 'live' : 'fallback';
        const linked = meta.usesSharedDataHub ? `, linkedStudents=${meta.linkedStudentRows}` : '';
        return `${item.id}: ${status}, updated=${updated}, source=${meta.sourceUrl || item.source}${linked}`;
    }).join('\n');
}
