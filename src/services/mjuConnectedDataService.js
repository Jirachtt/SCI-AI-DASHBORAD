import { canAccess, getRoleInfo, normalizeRole } from '../utils/accessControl';

const CONSENT_KEY_PREFIX = 'sci-ai-dashboard:mju-connected-consent:';

export const MJU_CONNECTED_DATA_DOMAINS = [
    {
        id: 'profile',
        label: 'ข้อมูลโปรไฟล์ MJU',
        source: 'MJU SSO / Identity',
        section: 'dashboard',
        scope: 'self',
        sensitive: false,
        endpointTodo: 'MJU identity/profile endpoint',
    },
    {
        id: 'enrollment',
        label: 'การลงทะเบียนและรายวิชาปัจจุบัน',
        source: 'MJU Reg',
        section: 'course_analytics',
        scope: 'self',
        sensitive: true,
        endpointTodo: 'MJU Reg enrollment API',
    },
    {
        id: 'grades',
        label: 'เกรด GPA และ transcript summary',
        source: 'MJU Grade',
        section: 'course_analytics',
        scope: 'self',
        sensitive: true,
        endpointTodo: 'MJU Grade/GPA API',
    },
    {
        id: 'activities',
        label: 'ชั่วโมงและประวัติกิจกรรม',
        source: 'MJU Activity',
        section: 'student_life',
        scope: 'self',
        sensitive: true,
        endpointTodo: 'MJU Activity hours API',
    },
    {
        id: 'graduation',
        label: 'สถานะความพร้อมสำเร็จการศึกษา',
        source: 'MJU Graduation / Reg',
        section: 'graduation_check',
        scope: 'self',
        sensitive: true,
        endpointTodo: 'MJU graduation requirement API',
    },
    {
        id: 'finance',
        label: 'ค่าธรรมเนียมและสถานะการเงิน',
        source: 'MJU Finance',
        section: 'tuition',
        scope: 'self',
        sensitive: true,
        endpointTodo: 'MJU finance/tuition API',
    },
    {
        id: 'advisor',
        label: 'นักศึกษาในที่ปรึกษา',
        source: 'MJU Advisor / Reg',
        section: 'student_list',
        scope: 'advisor',
        sensitive: true,
        endpointTodo: 'MJU advisor advisee API',
    },
    {
        id: 'hr',
        label: 'ข้อมูลบุคลากรและภาระงาน',
        source: 'MJU HR',
        section: 'hr_overview',
        scope: 'staff_self',
        sensitive: true,
        endpointTodo: 'MJU HR profile API',
    },
    {
        id: 'faculty_scope',
        label: 'ข้อมูลภาพรวมตามขอบเขตผู้บริหาร',
        source: 'MJU Dashboard / Faculty scope',
        section: 'dashboard',
        scope: 'aggregate',
        sensitive: false,
        endpointTodo: 'MJU scoped dashboard API',
    },
];

const DOMAIN_BY_ID = new Map(MJU_CONNECTED_DATA_DOMAINS.map(domain => [domain.id, domain]));

function safeString(value) {
    return value == null ? '' : String(value).trim();
}

function firstNonEmpty(...values) {
    return values.map(safeString).find(Boolean) || '';
}

function firstDefined(...values) {
    return values.find(value => value !== undefined && value !== null && value !== '') ?? null;
}

function toNumberOrNull(value) {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
}

function compactObject(value = {}) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => (
        item !== undefined && item !== null && item !== ''
    )));
}

function firstArray(...values) {
    return values.find(value => Array.isArray(value) && value.length > 0) || [];
}

function connectedDataUpdatedAt(user = {}, identity = {}) {
    return firstDefined(
        user.mjuDataUpdatedAt,
        user.mjuClaims?.dataUpdatedAt,
        user.mjuClaims?.updatedAt,
        identity.connectedAt,
    );
}

function buildDomainPayload(user = {}, domainId, identity = normalizeMjuIdentity(user)) {
    const claims = user.mjuClaims || {};
    const academic = user.mjuAcademic || {};
    const enrollment = user.mjuEnrollment || {};
    const activity = user.mjuActivity || {};
    const finance = user.mjuFinance || {};
    const hr = user.mjuHr || {};
    const updatedAt = connectedDataUpdatedAt(user, identity);

    if (domainId === 'profile') {
        const data = compactObject({
            fullName: identity.fullName,
            email: identity.email,
            role: identity.role,
            faculty: identity.faculty,
            department: identity.department,
            major: identity.major,
            program: identity.program,
            yearLevel: identity.yearLevel,
            position: identity.position,
            userType: identity.userType,
        });
        return {
            data,
            status: identity.identifiersStatus === 'connected' ? 'connected' : 'partial',
            lastUpdated: updatedAt,
            message: identity.identifiersStatus === 'connected'
                ? 'เชื่อมข้อมูลตัวตนที่ MJU SSO ส่งกลับมาแล้ว'
                : 'เชื่อมตัวตน MJU แล้ว แต่ identifier ยังไม่ครบ',
        };
    }

    if (domainId === 'enrollment') {
        const courses = firstArray(enrollment.courses, enrollment.registrations, user.mjuCourses);
        const data = compactObject({
            academicYear: firstDefined(enrollment.academicYear, claims.academicYear),
            semester: firstDefined(enrollment.semester, claims.currentSemester),
            registeredCredits: toNumberOrNull(firstDefined(enrollment.registeredCredits, claims.registeredCredits)),
            courseCount: toNumberOrNull(firstDefined(enrollment.courseCount, claims.courseCount, courses.length || null)),
            enrollmentStatus: firstDefined(enrollment.status, claims.enrollmentStatus),
            courses: courses.length ? courses : null,
        });
        if (!Object.keys(data).length) return null;
        return {
            data,
            status: courses.length ? 'connected' : 'partial',
            lastUpdated: updatedAt,
            message: courses.length
                ? `เชื่อมรายการลงทะเบียน ${courses.length.toLocaleString('th-TH')} รายวิชาแล้ว`
                : 'พบข้อมูลสถานะการศึกษา/ภาคเรียนจาก MJU แต่ยังไม่มีรายการรายวิชาเต็ม',
        };
    }

    if (domainId === 'grades') {
        const gradeItems = firstArray(academic.grades, academic.transcript, user.mjuGrades);
        const gpax = toNumberOrNull(firstDefined(academic.gpax, academic.gpa, user.gpax, claims.gpax, claims.gpa));
        const currentGpa = toNumberOrNull(firstDefined(academic.currentGpa, claims.currentGpa));
        const data = compactObject({ gpax, currentGpa, gradeItems: gradeItems.length ? gradeItems : null });
        if (!Object.keys(data).length) return null;
        return {
            data,
            status: gradeItems.length ? 'connected' : 'partial',
            lastUpdated: updatedAt,
            message: gradeItems.length
                ? `เชื่อมผลการเรียน ${gradeItems.length.toLocaleString('th-TH')} รายการแล้ว`
                : 'เชื่อม GPA/GPAX summary ที่ MJU ส่งกลับมาแล้ว แต่ยังไม่มี transcript รายวิชา',
        };
    }

    if (domainId === 'activities') {
        const history = firstArray(activity.history, activity.events, user.mjuActivityHistory);
        const data = compactObject({
            completedHours: toNumberOrNull(firstDefined(activity.completedHours, claims.activityHoursCompleted)),
            targetHours: toNumberOrNull(firstDefined(activity.targetHours, claims.activityHoursTarget)),
            completedEvents: toNumberOrNull(firstDefined(activity.completedEvents, claims.completedActivityEvents)),
            requiredEvents: toNumberOrNull(firstDefined(activity.requiredEvents, claims.requiredActivityEvents)),
            history: history.length ? history : null,
        });
        if (!Object.keys(data).length) return null;
        return {
            data,
            status: history.length ? 'connected' : 'partial',
            lastUpdated: updatedAt,
            message: history.length
                ? `เชื่อมประวัติกิจกรรม ${history.length.toLocaleString('th-TH')} รายการแล้ว`
                : 'เชื่อมยอดชั่วโมงกิจกรรมที่ MJU ส่งกลับมาแล้ว แต่ยังไม่มีประวัติรายกิจกรรม',
        };
    }

    if (domainId === 'graduation') {
        const gpax = toNumberOrNull(firstDefined(academic.gpax, academic.gpa, claims.gpax, claims.gpa));
        const earnedCredits = toNumberOrNull(firstDefined(academic.earnedCredits, academic.totalCredits, claims.earnedCredits));
        const requiredCredits = toNumberOrNull(firstDefined(academic.requiredCredits, claims.requiredCredits));
        const data = compactObject({
            gpax,
            minimumGpax: toNumberOrNull(firstDefined(academic.minimumGpax, claims.minimumGpax)),
            earnedCredits,
            requiredCredits,
            activityHoursCompleted: toNumberOrNull(firstDefined(activity.completedHours, claims.activityHoursCompleted)),
            activityHoursTarget: toNumberOrNull(firstDefined(activity.targetHours, claims.activityHoursTarget)),
            graduationStatus: firstDefined(user.graduationStatus, claims.graduationStatus),
        });
        if (!Object.keys(data).length) return null;
        const hasCoreRequirement = gpax != null && earnedCredits != null && requiredCredits != null;
        return {
            data,
            status: hasCoreRequirement ? 'connected' : 'partial',
            lastUpdated: updatedAt,
            message: hasCoreRequirement
                ? 'เชื่อมข้อมูลหลักสำหรับตรวจความพร้อมสำเร็จการศึกษาแล้ว'
                : 'เชื่อมข้อมูลตรวจจบได้บางส่วน ยังต้องมี GPA/หน่วยกิต/เงื่อนไขจาก Reg เพิ่ม',
        };
    }

    if (domainId === 'finance') {
        const data = compactObject({
            tuitionAmount: toNumberOrNull(firstDefined(finance.tuitionAmount, claims.tuitionAmount)),
            paidAmount: toNumberOrNull(firstDefined(finance.paidAmount, claims.paidAmount)),
            outstandingAmount: toNumberOrNull(firstDefined(finance.outstandingAmount, claims.outstandingAmount)),
            paymentStatus: firstDefined(finance.paymentStatus, claims.paymentStatus),
            lastPaymentDate: firstDefined(finance.lastPaymentDate, claims.lastPaymentDate),
        });
        if (!Object.keys(data).length) return null;
        return {
            data,
            status: data.paymentStatus && data.tuitionAmount != null ? 'connected' : 'partial',
            lastUpdated: updatedAt,
            message: 'เชื่อมข้อมูลสรุปค่าธรรมเนียมที่ MJU ส่งกลับมาแล้ว',
        };
    }

    if (domainId === 'advisor') {
        const advisees = firstArray(user.mjuAdvisees, user.mjuAdvisor?.advisees);
        const data = compactObject({
            advisorName: firstDefined(user.mjuAdvisor?.advisorName, claims.advisorName),
            adviseeCount: toNumberOrNull(firstDefined(user.mjuAdvisor?.adviseeCount, claims.adviseeCount, advisees.length || null)),
            advisees: advisees.length ? advisees : null,
        });
        if (!Object.keys(data).length) return null;
        return {
            data,
            status: advisees.length ? 'connected' : 'partial',
            lastUpdated: updatedAt,
            message: advisees.length ? 'เชื่อมรายชื่อนักศึกษาในที่ปรึกษาแล้ว' : 'พบข้อมูลที่ปรึกษาแบบสรุป แต่ยังไม่มีรายชื่อเต็ม',
        };
    }

    if (domainId === 'hr') {
        const data = compactObject({
            employeeCode: identity.employeeCode,
            position: firstDefined(hr.position, identity.position),
            department: firstDefined(hr.department, identity.department),
            employmentStatus: firstDefined(hr.employmentStatus, claims.employmentStatus),
        });
        if (!identity.employeeCode && !data.position && !data.employmentStatus) return null;
        return {
            data,
            status: data.employmentStatus ? 'connected' : 'partial',
            lastUpdated: updatedAt,
            message: 'เชื่อมโปรไฟล์บุคลากรที่ MJU SSO ส่งกลับมาแล้ว; ภาระงานเชิงลึกยังต้องใช้ MJU HR API',
        };
    }

    if (domainId === 'faculty_scope') {
        const data = user.mjuFacultyScope || user.mjuAggregateScope || null;
        if (!data || typeof data !== 'object') return null;
        return {
            data,
            status: 'connected',
            lastUpdated: updatedAt,
            message: 'เชื่อมขอบเขตข้อมูลภาพรวมสำหรับผู้บริหารแล้ว',
        };
    }

    return null;
}

function safeDomainDataForAI(domainId, data = {}) {
    const allowedFields = {
        enrollment: ['academicYear', 'semester', 'registeredCredits', 'courseCount', 'enrollmentStatus'],
        grades: ['gpax', 'currentGpa'],
        activities: ['completedHours', 'targetHours', 'completedEvents', 'requiredEvents'],
        graduation: ['gpax', 'minimumGpax', 'earnedCredits', 'requiredCredits', 'activityHoursCompleted', 'activityHoursTarget', 'graduationStatus'],
        finance: ['tuitionAmount', 'paidAmount', 'outstandingAmount', 'paymentStatus', 'lastPaymentDate'],
        advisor: ['adviseeCount'],
        hr: ['position', 'department', 'employmentStatus'],
        faculty_scope: ['faculty', 'department', 'scope'],
    };
    const keys = allowedFields[domainId] || [];
    return compactObject(Object.fromEntries(keys.map(key => [key, data?.[key]])));
}

function normalizeUserType(role, user = {}) {
    if (role === 'admin') return 'admin';
    if (role === 'student' || user.studentCode || user.studentId) return 'student';
    if (['dean', 'chair', 'general'].includes(role)) return 'lecturer';
    if (role === 'staff') return 'staff';
    return role || 'general';
}

function hasElevatedMjuDataScope(user = {}, role = user?.role) {
    return normalizeRole(role) === 'dean' && user.mjuVerified === true;
}

function getConsentKey(user = {}) {
    const id = firstNonEmpty(user.uid, user.mjuId, user.email, 'anonymous');
    return `${CONSENT_KEY_PREFIX}${id}`;
}

export function hasMjuConnectedDataConsent(user = {}) {
    if (!user?.mjuVerified) return false;
    if (user.mjuConsentGrantedAt || user.mjuConnectedConsentAt) return true;
    try {
        return Boolean(localStorage.getItem(getConsentKey(user)));
    } catch {
        return false;
    }
}

export function grantMjuConnectedDataConsent(user = {}) {
    const grantedAt = new Date().toISOString();
    try {
        localStorage.setItem(getConsentKey(user), grantedAt);
    } catch {
        // Consent can still be represented in-memory by the caller.
    }
    return grantedAt;
}

export function normalizeMjuIdentity(user = {}) {
    const role = normalizeRole(user.role || user.assignedRole || 'general');
    const roleInfo = getRoleInfo(role);
    const studentCode = firstNonEmpty(user.studentCode, user.studentId, user.studentID);
    const employeeCode = firstNonEmpty(user.employeeCode, user.employeeId, user.personID, user.humanID);
    const mjuUserId = firstNonEmpty(user.mjuUserId, user.mjuId, studentCode, employeeCode, user.email, user.uid);
    const hasPrimaryId = Boolean(mjuUserId || user.email);

    return {
        mjuUserId: mjuUserId || null,
        studentCode: studentCode || null,
        employeeCode: employeeCode || null,
        email: firstNonEmpty(user.email) || null,
        fullName: firstNonEmpty(user.fullName, user.name, user.displayName) || null,
        role,
        roleLabel: user.roleLabel || roleInfo?.label || role,
        faculty: firstNonEmpty(user.faculty) || null,
        department: firstNonEmpty(user.department) || null,
        major: firstNonEmpty(user.major) || null,
        program: firstNonEmpty(user.program) || null,
        yearLevel: firstNonEmpty(user.yearLevel, user.year) || null,
        position: firstNonEmpty(user.position, user.positionName, user.jobTitle) || null,
        userType: normalizeUserType(role, { ...user, studentCode }),
        authProvider: user.authProvider || null,
        mjuVerified: Boolean(user.mjuVerified),
        identifiersStatus: hasPrimaryId ? 'connected' : 'partial',
        connectedAt: user.mjuConnectedAt || user.lastLoginAt || null,
    };
}

function isExecutiveLike(role) {
    return ['dean', 'chair'].includes(normalizeRole(role));
}

function isStaffLike(role) {
    return ['dean', 'chair', 'staff', 'general'].includes(normalizeRole(role));
}

export function canUseMjuConnectedDomain(user = {}, domainId) {
    const domain = DOMAIN_BY_ID.get(domainId);
    if (!domain || !user) return false;
    const role = normalizeRole(user.role || 'general');
    if (domain.id === 'profile') return Boolean(user.uid || user.email || user.mjuVerified);
    if (domain.scope === 'aggregate') return isExecutiveLike(role) || canAccess(role, domain.section);
    if (domain.scope === 'advisor') return ['dean', 'chair'].includes(role);
    if (domain.scope === 'staff_self') return isStaffLike(role) && canAccess(role, domain.section);
    if (domain.scope === 'self') {
        if (role === 'student') return Boolean(user.studentCode || user.studentId || user.mjuVerified);
        if (domain.id === 'finance') return role === 'student';
        return ['student', 'dean'].includes(role);
    }
    return canAccess(role, domain.section);
}

function unavailableMessage(domain) {
    return `รอเชื่อมต่อ endpoint จริงจาก ${domain.source} (${domain.endpointTodo})`;
}

export function getMjuConnectedDataStatus(user = {}, domainId) {
    const domain = DOMAIN_BY_ID.get(domainId);
    if (!domain) {
        return {
            data: null,
            source: 'MJU',
            lastUpdated: null,
            status: 'error',
            permissions: { allowed: false },
            message: 'ไม่พบชนิดข้อมูล MJU ที่ร้องขอ',
        };
    }

    const identity = normalizeMjuIdentity(user);
    const allowed = canUseMjuConnectedDomain(user, domain.id);
    const elevatedDataScope = hasElevatedMjuDataScope(user, identity.role);
    const consentGranted = elevatedDataScope || hasMjuConnectedDataConsent(user);
    const permissions = {
        allowed,
        role: identity.role,
        scope: elevatedDataScope ? 'faculty_scope' : domain.scope,
        requiresConsent: domain.sensitive && !elevatedDataScope,
        consentGranted: !domain.sensitive || consentGranted,
        elevated: elevatedDataScope,
    };

    if (!allowed) {
        return {
            data: null,
            source: domain.source,
            lastUpdated: null,
            status: 'unauthorized',
            permissions,
            message: 'สิทธิ์ของบัญชีนี้ยังไม่สามารถเปิดข้อมูลระดับนี้ได้',
        };
    }

    if (domain.sensitive && permissions.requiresConsent && !consentGranted) {
        return {
            data: null,
            source: domain.source,
            lastUpdated: null,
            status: 'partial',
            permissions,
            message: 'รอการยืนยัน consent ก่อนเชื่อมข้อมูลส่วนบุคคล',
        };
    }

    if (identity.mjuVerified) {
        const payload = buildDomainPayload(user, domain.id, identity);
        if (payload) {
            return {
                ...payload,
                source: domain.source,
                permissions,
            };
        }
    }

    return {
        data: null,
        source: domain.source,
        lastUpdated: null,
        status: 'unavailable',
        permissions,
        message: unavailableMessage(domain),
    };
}

export function getMjuConnectedDataSummary(user = {}) {
    const identity = normalizeMjuIdentity(user || {});
    const domains = MJU_CONNECTED_DATA_DOMAINS.map(domain => {
        const status = getMjuConnectedDataStatus(user, domain.id);
        return {
            id: domain.id,
            label: domain.label,
            scope: status.permissions?.scope || domain.scope,
            sensitive: domain.sensitive,
            endpointTodo: domain.endpointTodo,
            ...status,
        };
    });
    const counts = domains.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
    }, {});
    return {
        identity,
        consentGranted: hasMjuConnectedDataConsent(user),
        domains,
        counts,
        connectedCount: counts.connected || 0,
        partialCount: counts.partial || 0,
        unavailableCount: counts.unavailable || 0,
        unauthorizedCount: counts.unauthorized || 0,
    };
}

export function buildMjuConnectedContextForAI(user = {}) {
    if (!user?.uid && !user?.mjuVerified) return '';
    const summary = getMjuConnectedDataSummary(user);
    const identity = summary.identity;
    const domainLines = summary.domains
        .filter(item => ['connected', 'partial', 'unavailable', 'unauthorized'].includes(item.status))
        .map(item => {
            const safeData = ['connected', 'partial'].includes(item.status) && item.permissions?.consentGranted
                ? safeDomainDataForAI(item.id, item.data)
                : null;
            const dataText = safeData && Object.keys(safeData).length
                ? `, data=${JSON.stringify(safeData)}`
                : '';
            return `- ${item.id}: status=${item.status}, source=${item.source}, permission=${item.permissions?.allowed ? 'allowed' : 'denied'}${dataText}, message=${item.message}`;
        })
        .join('\n');

    return `MJU CONNECTED DATA IDENTITY
userType=${identity.userType}, role=${identity.role}, faculty=${identity.faculty || '-'}, department=${identity.department || '-'}, major=${identity.major || '-'}, yearLevel=${identity.yearLevel || '-'}
studentCode=${identity.studentCode ? 'present' : '-'}, employeeCode=${identity.employeeCode ? 'present' : '-'}, consent=${summary.consentGranted ? 'granted' : 'not_granted'}
Connected data domains:
${domainLines}
Rules:
- ถ้าผู้ใช้ถามข้อมูลส่วนตัว เช่น "เกรดฉัน", "ค่าเทอมฉัน", "ชั่วโมงกิจกรรมฉัน" ให้ใช้เฉพาะ field ที่ปรากฏใน data ของ domain ที่ status=connected/partial และ consent=granted
- domain ที่ status=partial ใช้อธิบายเฉพาะ field ที่มีอยู่ใน data ได้ แต่ต้องบอกว่าข้อมูลยังไม่ครบ ห้ามอนุมาน field อื่น
- ถ้า domain เป็น partial/unavailable ให้ตอบตรง ๆ ว่ายังไม่พบข้อมูลจากระบบ MJU และระบุ source ที่รอเชื่อมต่อ ห้ามใช้ mock/dashboard aggregate แทนข้อมูลส่วนตัว
- ผู้บริหารให้ใช้ aggregate dashboard ตามสิทธิ์ ไม่เปิดเผยข้อมูลรายบุคคลเกินจำเป็น`;
}

export function getMjuApiTodoEndpoints() {
    return MJU_CONNECTED_DATA_DOMAINS
        .filter(domain => domain.id !== 'profile')
        .map(domain => ({
            id: domain.id,
            label: domain.label,
            endpointTodo: domain.endpointTodo,
            source: domain.source,
        }));
}
