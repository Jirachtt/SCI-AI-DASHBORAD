export const ROLES = {
    DEAN: 'dean',
    CHAIR: 'chair',
    STAFF: 'staff',
    GENERAL: 'general',
    STUDENT: 'student',
    ADMIN: 'admin',
};

export const ROLE_VALUES = Object.values(ROLES);

export const ROLE_LABELS = {
    [ROLES.DEAN]: 'คณบดี',
    [ROLES.CHAIR]: 'หัวหน้าสาขา',
    [ROLES.STAFF]: 'เจ้าหน้าที่',
    [ROLES.GENERAL]: 'ทั่วไป',
    [ROLES.STUDENT]: 'นักศึกษา',
    [ROLES.ADMIN]: 'ผู้ดูแลผู้ใช้',
};

export const ROLE_LABELS_WITH_EN = {
    [ROLES.DEAN]: 'คณบดี (Dean)',
    [ROLES.CHAIR]: 'หัวหน้าสาขา (Chair)',
    [ROLES.STAFF]: 'เจ้าหน้าที่ (Staff)',
    [ROLES.GENERAL]: 'ทั่วไป (General)',
    [ROLES.STUDENT]: 'นักศึกษา (Student)',
    [ROLES.ADMIN]: 'ผู้ดูแลผู้ใช้ (Admin)',
};

export const ROLE_ORDER = [
    ROLES.DEAN,
    ROLES.CHAIR,
    ROLES.STAFF,
    ROLES.GENERAL,
    ROLES.STUDENT,
    ROLES.ADMIN,
];

export const MANAGEABLE_ROLES = ROLE_ORDER;

const LEGACY_ROLE_MAP = {
    admin: ROLES.ADMIN,
    super_admin: ROLES.ADMIN,
    system_admin: ROLES.ADMIN,
    dean: ROLES.DEAN,
    executive: ROLES.DEAN,
    vice_president: ROLES.DEAN,
    president: ROLES.DEAN,
    rector: ROLES.DEAN,
    prorector: ROLES.DEAN,
    department_head: ROLES.CHAIR,
    program_chair: ROLES.CHAIR,
    head: ROLES.CHAIR,
    chair: ROLES.CHAIR,
    officer: ROLES.STAFF,
    employee: ROLES.STAFF,
    staff: ROLES.STAFF,
    lecturer: ROLES.GENERAL,
    teacher: ROLES.GENERAL,
    faculty: ROLES.GENERAL,
    instructor: ROLES.GENERAL,
    professor: ROLES.GENERAL,
    user: ROLES.GENERAL,
    viewer: ROLES.GENERAL,
    pending_staff: ROLES.GENERAL,
    pending_chair: ROLES.GENERAL,
    general: ROLES.GENERAL,
    student: ROLES.STUDENT,
};

export function normalizeRole(role) {
    const key = String(role || '').trim().toLowerCase();
    return LEGACY_ROLE_MAP[key] || ROLES.GENERAL;
}

export function isCanonicalRole(role) {
    return ROLE_VALUES.includes(role);
}

export function getRoleLabel(role, { withEnglish = false } = {}) {
    const normalized = normalizeRole(role);
    return (withEnglish ? ROLE_LABELS_WITH_EN : ROLE_LABELS)[normalized] || ROLE_LABELS[ROLES.GENERAL];
}

export function getRoleInitial(role) {
    const normalized = normalizeRole(role);
    return {
        [ROLES.DEAN]: 'D',
        [ROLES.CHAIR]: 'C',
        [ROLES.STAFF]: 'S',
        [ROLES.GENERAL]: 'U',
        [ROLES.STUDENT]: 'ST',
        [ROLES.ADMIN]: 'AD',
    }[normalized] || 'U';
}
