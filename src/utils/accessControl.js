// Access control utility
// Defines which sections each role can access

const GENERAL_SECTIONS = ['dashboard', 'tuition', 'ai_chat'];

const ACCESS_LEVELS = {
    dean: {
        label: 'ผจก.คณะ',
        level: 1,
        dataRows: 1000000,
        color: '#C5A028',
        sections: [
            'dashboard', 'tuition', 'tuition_detail',
            'financial', 'financial_detail', 'financial_faculty', 'student_life',
            'student_life_detail', 'faculty_budget', 'staff_management', 'reports',
            'budget_planning', 'student_list', 'graduation_check',
            'student_stats', 'budget_forecast',
            'hr_overview', 'research_overview', 'strategic_overview', 'ai_chat',
            'graduation_stats',
            'admin_panel'
        ]
    },
    chair: {
        label: 'ประธานหลักสูตร',
        level: 2,
        dataRows: 500000,
        color: '#2E86AB',
        sections: [
            'dashboard', 'tuition', 'tuition_detail',
            'financial', 'student_life', 'student_life_detail', 'reports',
            'student_list', 'graduation_check',
            'student_stats', 'budget_forecast',
            'hr_overview', 'research_overview', 'strategic_overview', 'ai_chat',
            'graduation_stats'
        ]
    },
    staff: {
        label: 'Staff',
        level: 3,
        dataRows: 300000,
        color: '#006838',
        sections: [
            'dashboard', 'financial',
            'student_stats', 'graduation_stats', 'budget_forecast',
            'hr_overview', 'research_overview', 'ai_chat'
        ]
    },
    general: {
        label: 'ทั่วไป',
        level: 4,
        dataRows: 100000,
        color: '#7B68EE',
        sections: GENERAL_SECTIONS
    },
    student: {
        label: 'นักศึกษา',
        level: 4,
        dataRows: 100000,
        color: '#E91E63',
        sections: [
            'dashboard', 'tuition', 'student_life',
            'graduation_check', 'student_stats'
        ]
    },
    // Pending approval roles — same access as general, amber badge
    pending_staff: {
        label: 'รอการอนุมัติ (Staff)',
        level: 4,
        dataRows: 100000,
        color: '#F59E0B',
        sections: GENERAL_SECTIONS
    },
    pending_chair: {
        label: 'รอการอนุมัติ (Chair)',
        level: 4,
        dataRows: 100000,
        color: '#F59E0B',
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
    return info ? info.color : '#888';
}

export function getDataRowLimit(role) {
    const info = ACCESS_LEVELS[role];
    return info ? info.dataRows : 100000;
}

export function isPendingRole(role) {
    return role === 'pending_staff' || role === 'pending_chair';
}

export default ACCESS_LEVELS;
