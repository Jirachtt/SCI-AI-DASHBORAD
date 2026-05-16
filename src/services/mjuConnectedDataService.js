import { canAccess, getRoleInfo } from '../utils/accessControl';

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

function normalizeUserType(role, user = {}) {
    if (role === 'student' || user.studentCode || user.studentId) return 'student';
    if (['dean', 'executive', 'chair', 'instructor'].includes(role)) return 'lecturer';
    if (role === 'staff') return 'staff';
    return role || 'general';
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
    const role = user.role || user.assignedRole || 'general';
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
    return ['dean', 'executive', 'chair'].includes(role);
}

function isStaffLike(role) {
    return ['dean', 'executive', 'chair', 'instructor', 'staff'].includes(role);
}

export function canUseMjuConnectedDomain(user = {}, domainId) {
    const domain = DOMAIN_BY_ID.get(domainId);
    if (!domain || !user) return false;
    const role = user.role || 'general';
    if (domain.id === 'profile') return Boolean(user.uid || user.email || user.mjuVerified);
    if (domain.scope === 'aggregate') return isExecutiveLike(role) || canAccess(role, domain.section);
    if (domain.scope === 'advisor') return ['dean', 'chair', 'instructor'].includes(role);
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
    const consentGranted = hasMjuConnectedDataConsent(user);
    const permissions = {
        allowed,
        role: identity.role,
        scope: domain.scope,
        requiresConsent: domain.sensitive,
        consentGranted: !domain.sensitive || consentGranted,
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

    if (domain.sensitive && !consentGranted) {
        return {
            data: null,
            source: domain.source,
            lastUpdated: null,
            status: 'partial',
            permissions,
            message: 'รอการยืนยัน consent ก่อนเชื่อมข้อมูลส่วนบุคคล',
        };
    }

    if (domain.id === 'profile' && identity.mjuVerified) {
        return {
            data: {
                fullName: identity.fullName,
                email: identity.email,
                role: identity.role,
                faculty: identity.faculty,
                department: identity.department,
                major: identity.major,
                program: identity.program,
                yearLevel: identity.yearLevel,
                userType: identity.userType,
            },
            source: domain.source,
            lastUpdated: identity.connectedAt,
            status: identity.identifiersStatus === 'connected' ? 'connected' : 'partial',
            permissions,
            message: identity.identifiersStatus === 'connected'
                ? 'เชื่อมตัวตน MJU สำเร็จ'
                : 'เชื่อมตัวตน MJU แล้ว แต่ identifier ยังไม่ครบ',
        };
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
    const domains = MJU_CONNECTED_DATA_DOMAINS.map(domain => ({
        id: domain.id,
        label: domain.label,
        scope: domain.scope,
        sensitive: domain.sensitive,
        endpointTodo: domain.endpointTodo,
        ...getMjuConnectedDataStatus(user, domain.id),
    }));
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
        .map(item => `- ${item.id}: status=${item.status}, source=${item.source}, permission=${item.permissions?.allowed ? 'allowed' : 'denied'}, message=${item.message}`)
        .join('\n');

    return `MJU CONNECTED DATA IDENTITY
userType=${identity.userType}, role=${identity.role}, faculty=${identity.faculty || '-'}, department=${identity.department || '-'}, major=${identity.major || '-'}, yearLevel=${identity.yearLevel || '-'}
studentCode=${identity.studentCode ? 'present' : '-'}, employeeCode=${identity.employeeCode ? 'present' : '-'}, consent=${summary.consentGranted ? 'granted' : 'not_granted'}
Connected data domains:
${domainLines}
Rules:
- ถ้าผู้ใช้ถามข้อมูลส่วนตัว เช่น "เกรดฉัน", "ค่าเทอมฉัน", "ชั่วโมงกิจกรรมฉัน" ให้ใช้เฉพาะ domain ที่ status=connected เท่านั้น
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
