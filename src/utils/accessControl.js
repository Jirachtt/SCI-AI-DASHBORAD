// Access control utility
// Defines which sections each role can access

const GENERAL_SECTIONS = ['dashboard', 'tuition', 'ai_chat', 'academic_rules'];
const FULL_DATA_SECTIONS = [
    'dashboard', 'tuition', 'tuition_detail',
    'admin_panel',
    'financial', 'financial_detail', 'financial_faculty', 'student_life',
    'student_life_detail', 'faculty_budget', 'staff_management', 'reports',
    'budget_planning', 'student_list', 'graduation_check',
    'student_stats', 'budget_forecast',
    'tcas_admissions', 'course_analytics',
    'hr_overview', 'research_overview', 'strategic_overview', 'ai_chat',
    'graduation_stats',
    'alert_center',
    'academic_rules'
];

const ACCESS_LEVELS = {
    admin: {
        label: 'Admin',
        level: 1,
        dataRows: 100000,
        color: 'var(--accent-teal)',
        sections: FULL_DATA_SECTIONS
    },
    dean: {
        label: 'คณบดี',
        level: 1,
        dataRows: 1000000,
        color: 'var(--accent-gold)',
        sections: FULL_DATA_SECTIONS
    },
    chair: {
        label: 'ประธานหลักสูตร',
        level: 2,
        dataRows: 500000,
        color: 'var(--accent-info)',
        sections: [
            'dashboard', 'tuition', 'tuition_detail',
            'financial', 'student_life', 'student_life_detail', 'reports',
            'student_list', 'graduation_check',
            'student_stats', 'budget_forecast',
            'tcas_admissions', 'course_analytics',
            'hr_overview', 'research_overview', 'strategic_overview', 'ai_chat',
            'graduation_stats',
            'alert_center',
            'academic_rules'
        ]
    },
    executive: {
        label: 'ผู้บริหาร',
        level: 2,
        dataRows: 750000,
        color: 'var(--accent-purple)',
        sections: [
            'dashboard', 'tuition', 'tuition_detail',
            'financial', 'financial_detail', 'financial_faculty', 'student_life',
            'student_life_detail', 'faculty_budget', 'reports',
            'budget_planning', 'graduation_check',
            'student_stats', 'budget_forecast',
            'tcas_admissions', 'course_analytics',
            'hr_overview', 'research_overview', 'strategic_overview', 'ai_chat',
            'graduation_stats',
            'alert_center',
            'academic_rules'
        ]
    },
    instructor: {
        label: 'อาจารย์',
        level: 3,
        dataRows: 200000,
        color: 'var(--accent-cyan)',
        sections: [
            'dashboard', 'student_life', 'student_life_detail',
            'graduation_check', 'student_stats',
            'tcas_admissions', 'course_analytics',
            'research_overview', 'ai_chat',
            'graduation_stats',
            'academic_rules'
        ]
    },
    staff: {
        label: 'Staff',
        level: 3,
        dataRows: 300000,
        color: 'var(--accent-success-deep)',
        sections: [
            'dashboard', 'financial',
            'student_stats', 'graduation_stats', 'budget_forecast',
            'tcas_admissions', 'course_analytics',
            'hr_overview', 'research_overview', 'ai_chat',
            'alert_center',
            'academic_rules'
        ]
    },
    general: {
        label: 'ทั่วไป',
        level: 4,
        dataRows: 100000,
        color: 'var(--accent-purple)',
        sections: GENERAL_SECTIONS
    },
    student: {
        label: 'นักศึกษา',
        level: 4,
        dataRows: 100000,
        color: 'var(--accent-pink)',
        sections: [
            'dashboard', 'tuition', 'tuition_detail', 'student_life',
            'graduation_check', 'student_stats',
            'course_analytics',
            'ai_chat',
            'academic_rules'
        ]
    },
    // Pending approval roles — same access as general, amber badge
    pending_staff: {
        label: 'รอการอนุมัติ (Staff)',
        level: 4,
        dataRows: 100000,
        color: 'var(--accent-warning)',
        sections: GENERAL_SECTIONS
    },
    pending_chair: {
        label: 'รอการอนุมัติ (Chair)',
        level: 4,
        dataRows: 100000,
        color: 'var(--accent-warning)',
        sections: GENERAL_SECTIONS
    }
};

export function canAccess(role, section) {
    const access = ACCESS_LEVELS[role];
    if (!access) return false;
    return access.sections.includes(section);
}

export function getRoleInfo(role) {
    return ACCESS_LEVELS[role] || null;
}

export function getRoleBadgeColor(role) {
    const info = ACCESS_LEVELS[role];
    return info ? info.color : 'var(--text-subtle)';
}

export function getDataRowLimit(role) {
    const info = ACCESS_LEVELS[role];
    return info ? info.dataRows : 100000;
}

export function canManageUsers(userOrRole) {
    const role = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
    if (typeof userOrRole === 'object' && (userOrRole?.canManageUsers === true || userOrRole?.systemAdmin === true)) {
        return true;
    }
    return role === 'admin' || role === 'dean';
}

export function isPendingRole(role) {
    return role === 'pending_staff' || role === 'pending_chair';
}

export default ACCESS_LEVELS;
