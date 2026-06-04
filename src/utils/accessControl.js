import { ROLES, getRoleLabel, normalizeRole } from '../constants/roles.js';

// Access control utility
// Keep user-management permissions separate from dashboard/data permissions.

const ADMIN_SECTIONS = ['admin_panel', 'user_management', 'role_management'];

const DEAN_SECTIONS = [
    'dashboard', 'tuition', 'tuition_detail',
    'financial', 'financial_detail', 'financial_faculty', 'student_life',
    'student_life_detail', 'faculty_budget', 'staff_management', 'reports',
    'budget_planning', 'student_list', 'graduation_check',
    'student_stats', 'budget_forecast',
    'tcas_admissions', 'course_analytics',
    'hr_overview', 'research_overview', 'strategic_overview', 'ai_chat',
    'graduation_stats',
    'alert_center',
    'academic_rules',
];

const CHAIR_SECTIONS = [
    'dashboard', 'tuition', 'tuition_detail',
    'student_life', 'student_life_detail', 'reports',
    'student_list', 'graduation_check',
    'student_stats', 'budget_forecast',
    'tcas_admissions', 'course_analytics',
    'research_overview', 'strategic_overview', 'ai_chat',
    'graduation_stats',
    'alert_center',
    'academic_rules',
];

const STAFF_SECTIONS = [
    'dashboard', 'tuition', 'tuition_detail',
    'financial', 'student_life', 'student_life_detail',
    'student_list', 'graduation_check',
    'student_stats', 'budget_forecast',
    'tcas_admissions', 'course_analytics',
    'hr_overview', 'research_overview', 'ai_chat',
    'graduation_stats',
    'alert_center',
    'academic_rules',
];

const GENERAL_SECTIONS = ['dashboard', 'tuition', 'tcas_admissions', 'ai_chat', 'academic_rules'];

const STUDENT_SECTIONS = [
    'dashboard', 'tuition', 'tuition_detail', 'student_life',
    'graduation_check', 'student_stats',
    'tcas_admissions', 'course_analytics',
    'ai_chat',
    'academic_rules',
];

const ACCESS_LEVELS = {
    [ROLES.DEAN]: {
        label: getRoleLabel(ROLES.DEAN),
        level: 1,
        dataRows: 1000000,
        color: 'var(--accent-gold)',
        sections: DEAN_SECTIONS,
    },
    [ROLES.CHAIR]: {
        label: getRoleLabel(ROLES.CHAIR),
        level: 2,
        dataRows: 500000,
        color: 'var(--accent-info)',
        sections: CHAIR_SECTIONS,
    },
    [ROLES.STAFF]: {
        label: getRoleLabel(ROLES.STAFF),
        level: 3,
        dataRows: 300000,
        color: 'var(--accent-success-deep)',
        sections: STAFF_SECTIONS,
    },
    [ROLES.GENERAL]: {
        label: getRoleLabel(ROLES.GENERAL),
        level: 4,
        dataRows: 100000,
        color: 'var(--accent-purple)',
        sections: GENERAL_SECTIONS,
    },
    [ROLES.STUDENT]: {
        label: getRoleLabel(ROLES.STUDENT),
        level: 4,
        dataRows: 100000,
        color: 'var(--accent-pink)',
        sections: STUDENT_SECTIONS,
    },
    [ROLES.ADMIN]: {
        label: getRoleLabel(ROLES.ADMIN),
        level: 9,
        dataRows: 0,
        color: 'var(--accent-danger)',
        sections: ADMIN_SECTIONS,
    },
};

export function canAccess(role, section) {
    if (!section) return false;
    const normalizedRole = normalizeRole(role);
    const access = ACCESS_LEVELS[normalizedRole];
    if (!access) return false;
    return access.sections.includes(section);
}

export function getRoleInfo(role) {
    const normalizedRole = normalizeRole(role);
    return ACCESS_LEVELS[normalizedRole] || null;
}

export function getRoleBadgeColor(role) {
    const info = getRoleInfo(role);
    return info ? info.color : 'var(--text-subtle)';
}

export function getDataRowLimit(role) {
    const info = getRoleInfo(role);
    return info ? info.dataRows : 100000;
}

export function canManageUsers(userOrRole) {
    const role = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
    if (
        typeof userOrRole === 'object'
        && (userOrRole?.canManageUsers === true || userOrRole?.systemAdmin === true)
    ) {
        return true;
    }
    return normalizeRole(role) === ROLES.ADMIN;
}

export function isPendingRole(role) {
    return role === 'pending_staff' || role === 'pending_chair';
}

export function hasStudentDataWriteAccess(role) {
    return [ROLES.DEAN, ROLES.CHAIR, ROLES.STAFF].includes(normalizeRole(role));
}

export { normalizeRole };
export default ACCESS_LEVELS;
