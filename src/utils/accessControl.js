// Access control utility
// Defines which sections each role can access

const ACCESS_LEVELS = {
    dean: {
        label: 'ผจก.คณะ',
        level: 1,
        color: '#C5A028',
        sections: [
            'dashboard', 'tuition', 'tuition_detail',
            'financial', 'financial_detail', 'financial_faculty', 'student_life',
            'student_life_detail', 'faculty_budget', 'staff_management', 'reports',
            'budget_planning', 'student_list', 'graduation_check',
            'student_stats', 'budget_forecast'
        ]
    },
    chair: {
        label: 'ประธานหลักสูตร',
        level: 2,
        color: '#2E86AB',
        sections: [
            'dashboard', 'tuition', 'tuition_detail',
            'financial', 'financial_detail', 'student_life', 'student_life_detail', 'reports',
            'budget_planning', 'student_list', 'graduation_check',
            'student_stats', 'budget_forecast'
        ]
    },
    staff: {
        label: 'Staff',
        level: 3,
        color: '#006838',
        sections: [
            'dashboard', 'tuition',
            'financial', 'student_life', 'student_life_detail',
            'graduation_check', 'student_stats', 'budget_forecast'
        ]
    },
    general: {
        label: 'ทั่วไป',
        level: 4,
        color: '#7B68EE',
        sections: [
            'dashboard', 'tuition', 'student_life',
            'graduation_check', 'student_stats'
        ]
    },
    student: {
        label: 'นักศึกษา',
        level: 4,
        color: '#E91E63',
        sections: [
            'dashboard', 'tuition', 'student_life',
            'graduation_check', 'student_stats'
        ]
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

export default ACCESS_LEVELS;
