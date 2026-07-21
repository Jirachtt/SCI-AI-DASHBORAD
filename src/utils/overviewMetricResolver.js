const TRUSTED_SOURCE_PATTERN = /mju|api|sync|official|dashboard|firestore|file|upload|csv|excel|xlsx|manual|linked/i;
const UNTRUSTED_SOURCE_PATTERN = /fallback|mock|sample|demo|generated|seed|presentation/i;

function finiteNumber(...values) {
    for (const value of values) {
        if (value === null || value === undefined || value === '') continue;
        const number = Number(value);
        if (Number.isFinite(number)) return number;
    }
    return null;
}

function sourceType(meta = {}) {
    return String(meta?.sourceType || meta?.lastWriteSource || '').toLowerCase();
}

function isValidatedMeta(meta = {}) {
    const type = sourceType(meta);
    if (!meta?.isLive || UNTRUSTED_SOURCE_PATTERN.test(type)) return false;
    const needsValidation = /mju_public|mju_api|mju_sync|official_sync|dashboard_sync/.test(type);
    const validation = meta?.validation || meta?.syncMeta?.validation;
    return (!needsValidation || validation?.valid === true) && TRUSTED_SOURCE_PATTERN.test(type || 'firestore');
}

function coverage(payload = {}, path) {
    const exact = payload?.sourceCoverage?.exact || [];
    const derived = payload?.sourceCoverage?.derived || [];
    const unavailable = payload?.sourceCoverage?.unavailableFromPublicMju || [];
    if (unavailable.includes(path)) return 'unavailable';
    if (exact.includes(path)) return 'exact';
    if (derived.includes(path)) return 'derived';
    return 'unspecified';
}

function hasOfficialSnapshot(payload = {}, path) {
    const fields = payload?.sourceCoverage?.officialSnapshot?.fields || [];
    return fields.includes(path);
}

function isFallbackFilledField(meta = {}, path) {
    const fallbackFields = Array.isArray(meta?.fallbackFields) ? meta.fallbackFields : [];
    return fallbackFields.some(field => (
        field === path || field.startsWith(`${path}.`) || path.startsWith(`${field}.`)
    ));
}

function scienceFacultyRow(payload = {}) {
    const rows = Array.isArray(payload?.faculties) ? payload.faculties : [];
    return rows.find(row => String(row?.name || '').trim() === 'คณะวิทยาศาสตร์')
        || rows.find(row => String(row?.name || '').includes('วิทยาศาสตร์'))
        || null;
}

function canUseField(payload, meta, path, { allowOfficialSnapshot = false } = {}) {
    const fieldCoverage = coverage(payload, path);
    if (fieldCoverage === 'unavailable') return false;
    if (allowOfficialSnapshot && hasOfficialSnapshot(payload, path)) return true;
    if (isFallbackFilledField(meta, path)) return false;
    if (!isValidatedMeta(meta)) return false;
    return fieldCoverage !== 'unavailable';
}

function sourceLabel(meta = {}, fallback = 'ข้อมูลที่ผ่านการตรวจสอบ') {
    const type = sourceType(meta);
    if (/file|upload|csv|excel|xlsx|manual/.test(type)) return 'ไฟล์ทางการที่อัปโหลด';
    if (/linked/.test(type)) return 'ข้อมูลเชื่อมโยงในระบบ';
    if (/mju|api|sync|official|dashboard/.test(type)) return 'MJU Official';
    if (/firestore/.test(type)) return 'Firestore ที่ผ่านการตรวจสอบ';
    return fallback;
}

function uniqueCourseCount(payload = {}) {
    const direct = finiteNumber(
        payload?.totalCourses,
        payload?.summary?.totalCourses,
        payload?.current?.totalCourses,
    );
    if (direct !== null) return { value: direct, derived: false };

    const codes = new Set();
    (payload?.coursePlanByYear || []).forEach(year => {
        (year?.semesters || []).forEach(semester => {
            (semester?.courses || []).forEach(course => {
                const code = String(course?.code || '').trim();
                if (code) codes.add(code);
            });
        });
    });
    return codes.size ? { value: codes.size, derived: true } : { value: null, derived: false };
}

function weightedCourseGpa(payload = {}) {
    const direct = finiteNumber(payload?.avgGPA, payload?.avgGpa, payload?.summary?.avgGPA, payload?.summary?.avgGpa);
    if (direct !== null) return direct;

    const rows = Array.isArray(payload?.gradeDistributions) ? payload.gradeDistributions : [];
    let weightedTotal = 0;
    let enrolledTotal = 0;
    rows.forEach(row => {
        const gpa = finiteNumber(row?.avgGPA, row?.avgGpa);
        const enrolled = finiteNumber(row?.enrolled, row?.total, row?.count);
        if (gpa === null || enrolled === null || enrolled <= 0) return;
        weightedTotal += gpa * enrolled;
        enrolledTotal += enrolled;
    });
    return enrolledTotal ? Number((weightedTotal / enrolledTotal).toFixed(2)) : null;
}

function latestGraduationRate(payload = {}) {
    const direct = finiteNumber(payload?.graduationRate, payload?.successRate, payload?.current?.graduationRate, payload?.current?.rate);
    if (direct !== null) return { value: direct, calculated: false };

    // Linked student data patches the current candidate counts into the graduation
    // dataset while legacy history can still be present as display fallback. Prefer
    // the linked current calculation so presentation history is never promoted to fact.
    const total = finiteNumber(payload?.current?.totalCandidates, payload?.current?.total);
    const expected = finiteNumber(payload?.current?.expectedGraduates, payload?.current?.expected);
    if (total && expected !== null) {
        return { value: Number(((expected / total) * 100).toFixed(1)), calculated: true };
    }

    const history = payload?.history || payload?.graduationHistory || [];
    const actualRows = history.filter(row => row?.type !== 'forecast');
    const latest = actualRows[actualRows.length - 1];
    const latestRate = finiteNumber(latest?.rate, latest?.graduationRate, latest?.successRate);
    if (latestRate !== null) return { value: latestRate, calculated: false };
    return { value: null, calculated: false };
}

function missingMetric(key, label, sourceHint) {
    return {
        key,
        value: null,
        displayValue: 'รอข้อมูลจริง',
        label,
        status: 'missing',
        statusLabel: sourceHint,
        sourceLabel: sourceHint,
    };
}

export function resolveOverviewMetrics({
    dashboardSummary = {},
    dashboardMeta = {},
    studentStats = {},
    studentMeta = {},
    courseAnalytics = {},
    courseMeta = {},
    graduation = {},
    graduationMeta = {},
} = {}) {
    const scienceSummary = scienceFacultyRow(dashboardSummary);
    const dashboardTotal = finiteNumber(dashboardSummary?.totalStudents);
    const studentTotal = finiteNumber(studentStats?.current?.total);
    const totalStudents = canUseField(studentStats, studentMeta, 'current.total', { allowOfficialSnapshot: true })
        ? studentTotal
        : canUseField(dashboardSummary, dashboardMeta, 'totalStudents', { allowOfficialSnapshot: true })
            ? dashboardTotal
            : studentTotal ?? dashboardTotal;

    const students = {
        key: 'students',
        value: totalStudents,
        displayValue: totalStudents === null ? 'รอข้อมูลจริง' : totalStudents.toLocaleString('th-TH'),
        label: 'นักศึกษาทั้งมหาวิทยาลัย',
        status: totalStudents === null ? 'missing' : 'verified',
        statusLabel: totalStudents === null ? 'รอ MJU Dashboard' : sourceLabel(studentMeta?.isLive ? studentMeta : dashboardMeta, 'Snapshot ทางการ'),
        sourceLabel: sourceLabel(studentMeta?.isLive ? studentMeta : dashboardMeta, 'Snapshot ทางการ'),
    };

    const summaryCourseValue = finiteNumber(dashboardSummary?.totalCourses);
    const scienceSummaryCourses = finiteNumber(scienceSummary?.totalCourses);
    const courseCount = uniqueCourseCount(courseAnalytics);
    let courses = missingMetric('courses', 'รายวิชาเปิดสอน', 'รอระบบทะเบียน');
    if (summaryCourseValue !== null && canUseField(dashboardSummary, dashboardMeta, 'totalCourses')) {
        courses = {
            key: 'courses', value: summaryCourseValue, displayValue: summaryCourseValue.toLocaleString('th-TH'),
            label: 'รายวิชาเปิดสอนทั้งมหาวิทยาลัย', status: 'verified',
            statusLabel: sourceLabel(dashboardMeta), sourceLabel: sourceLabel(dashboardMeta), scope: 'university',
        };
    } else if (isValidatedMeta(courseMeta)) {
        if (courseCount.value !== null) {
            courses = {
                key: 'courses', value: courseCount.value, displayValue: courseCount.value.toLocaleString('th-TH'),
                label: courseCount.derived ? 'รายวิชาในแผนคณะ' : 'รายวิชาเปิดสอนคณะวิทย์',
                status: courseCount.derived ? 'calculated' : 'verified',
                statusLabel: courseCount.derived ? 'นับรหัสวิชาไม่ซ้ำ' : sourceLabel(courseMeta),
                sourceLabel: sourceLabel(courseMeta), scope: 'science',
            };
        }
    }
    if (courses.value === null && summaryCourseValue !== null) {
        courses = {
            key: 'courses', value: summaryCourseValue, displayValue: summaryCourseValue.toLocaleString('th-TH'),
            label: 'รายวิชาเปิดสอน', status: 'reference', statusLabel: 'ชุดข้อมูลในระบบ',
            sourceLabel: 'MJU Dashboard / ชุดข้อมูลหลักสูตรในระบบ', scope: 'university',
        };
    } else if (courses.value === null && courseCount.value !== null) {
        courses = {
            key: 'courses', value: courseCount.value, displayValue: courseCount.value.toLocaleString('th-TH'),
            label: 'รายวิชาในแผนคณะ', status: 'reference', statusLabel: 'ชุดข้อมูลในระบบ',
            sourceLabel: 'MJU Reg / แผนหลักสูตรคณะวิทยาศาสตร์', scope: 'science',
        };
    }
    courses.scienceValue = scienceSummaryCourses
        ?? (courses.scope === 'science' ? courses.value : courseCount.value);

    const summaryGpa = finiteNumber(dashboardSummary?.avgGPA, dashboardSummary?.avgGpa);
    const scienceSummaryGpa = finiteNumber(scienceSummary?.avgGPA, scienceSummary?.avgGpa);
    const studentScienceGpa = finiteNumber(studentStats?.scienceFaculty?.avgGPA, studentStats?.scienceFaculty?.avgGpa);
    const courseGpa = weightedCourseGpa(courseAnalytics);
    let gpa = missingMetric('gpa', 'เกรดเฉลี่ยรวม (GPA)', 'รอข้อมูลเกรด');
    if (summaryGpa !== null && canUseField(dashboardSummary, dashboardMeta, 'avgGPA')) {
        gpa = {
            key: 'gpa', value: summaryGpa, displayValue: summaryGpa.toFixed(2),
            label: 'เกรดเฉลี่ยรวม (GPA)', status: 'verified', statusLabel: sourceLabel(dashboardMeta),
            sourceLabel: sourceLabel(dashboardMeta), scope: 'university',
        };
    } else {
        if (studentScienceGpa !== null && canUseField(studentStats, studentMeta, 'scienceFaculty.avgGPA')) {
            gpa = {
                key: 'gpa', value: studentScienceGpa, displayValue: studentScienceGpa.toFixed(2),
                label: 'GPA เฉลี่ยคณะวิทย์', status: 'verified', statusLabel: sourceLabel(studentMeta),
                sourceLabel: sourceLabel(studentMeta), scope: 'science',
            };
        } else if (isValidatedMeta(courseMeta)) {
            if (courseGpa !== null) {
                gpa = {
                    key: 'gpa', value: courseGpa, displayValue: courseGpa.toFixed(2),
                    label: 'GPA เฉลี่ยรายวิชาคณะ', status: 'calculated', statusLabel: 'ถ่วงน้ำหนักจากรายวิชา',
                    sourceLabel: sourceLabel(courseMeta), scope: 'science',
                };
            }
        }
    }
    if (gpa.value === null && summaryGpa !== null) {
        gpa = {
            key: 'gpa', value: summaryGpa, displayValue: summaryGpa.toFixed(2),
            label: 'เกรดเฉลี่ยรวม (GPA)', status: 'reference', statusLabel: 'ชุดข้อมูลในระบบ',
            sourceLabel: 'MJU Dashboard / ชุดข้อมูลการศึกษาในระบบ', scope: 'university',
        };
    } else if (gpa.value === null && (scienceSummaryGpa ?? courseGpa) !== null) {
        const fallbackScienceGpa = scienceSummaryGpa ?? courseGpa;
        gpa = {
            key: 'gpa', value: fallbackScienceGpa, displayValue: fallbackScienceGpa.toFixed(2),
            label: 'GPA เฉลี่ยคณะวิทย์', status: 'reference', statusLabel: 'ชุดข้อมูลในระบบ',
            sourceLabel: 'ชุดข้อมูลการศึกษาคณะวิทยาศาสตร์', scope: 'science',
        };
    }
    gpa.scienceValue = studentScienceGpa
        ?? scienceSummaryGpa
        ?? (gpa.scope === 'science' ? gpa.value : courseGpa);

    const summaryGraduation = finiteNumber(dashboardSummary?.graduationRate);
    const scienceSummaryGraduation = finiteNumber(scienceSummary?.graduationRate);
    const resolvedGraduation = latestGraduationRate(graduation);
    let graduationMetric = missingMetric('graduation', 'อัตราสำเร็จการศึกษา', 'รอผลอนุมัติจบ');
    if (summaryGraduation !== null && canUseField(dashboardSummary, dashboardMeta, 'graduationRate')) {
        graduationMetric = {
            key: 'graduation', value: summaryGraduation, displayValue: `${summaryGraduation.toFixed(1)}%`,
            label: 'อัตราสำเร็จการศึกษา', status: 'verified', statusLabel: sourceLabel(dashboardMeta),
            sourceLabel: sourceLabel(dashboardMeta), scope: 'university',
        };
    } else if (isValidatedMeta(graduationMeta)) {
        if (resolvedGraduation.value !== null) {
            graduationMetric = {
                key: 'graduation', value: resolvedGraduation.value, displayValue: `${resolvedGraduation.value.toFixed(1)}%`,
                label: resolvedGraduation.calculated ? 'คาดว่าสำเร็จคณะวิทย์' : 'อัตราสำเร็จคณะวิทย์',
                status: resolvedGraduation.calculated ? 'calculated' : 'verified',
                statusLabel: resolvedGraduation.calculated ? 'คำนวณจากผู้มีสิทธิ์ปัจจุบัน' : sourceLabel(graduationMeta),
                sourceLabel: sourceLabel(graduationMeta), scope: 'science',
            };
        }
    }
    if (graduationMetric.value === null && summaryGraduation !== null) {
        graduationMetric = {
            key: 'graduation', value: summaryGraduation, displayValue: `${summaryGraduation.toFixed(1)}%`,
            label: 'อัตราสำเร็จการศึกษา', status: 'reference', statusLabel: 'ชุดข้อมูลในระบบ',
            sourceLabel: 'MJU Dashboard / ชุดข้อมูลสำเร็จการศึกษาในระบบ', scope: 'university',
        };
    } else if (graduationMetric.value === null && (scienceSummaryGraduation ?? resolvedGraduation.value) !== null) {
        const fallbackScienceGraduation = scienceSummaryGraduation ?? resolvedGraduation.value;
        graduationMetric = {
            key: 'graduation', value: fallbackScienceGraduation, displayValue: `${fallbackScienceGraduation.toFixed(1)}%`,
            label: 'อัตราสำเร็จคณะวิทย์', status: 'reference', statusLabel: 'ชุดข้อมูลในระบบ',
            sourceLabel: 'ชุดข้อมูลสำเร็จการศึกษาคณะวิทยาศาสตร์', scope: 'science',
        };
    }
    graduationMetric.scienceValue = (isValidatedMeta(graduationMeta) ? resolvedGraduation.value : null)
        ?? scienceSummaryGraduation
        ?? (graduationMetric.scope === 'science' ? graduationMetric.value : resolvedGraduation.value);

    return { students, courses, gpa, graduation: graduationMetric };
}

export const overviewMetricInternals = {
    finiteNumber,
    isValidatedMeta,
    uniqueCourseCount,
    weightedCourseGpa,
    latestGraduationRate,
    scienceFacultyRow,
};
