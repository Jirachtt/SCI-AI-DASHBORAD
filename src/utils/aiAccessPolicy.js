import { canAccess, getRoleInfo } from './accessControl';

const UNRESTRICTED_AI_ROLES = new Set(['dean', 'chair']);

const DOMAIN_SECTION_MAP = {
    students: ['student_stats', 'student_list'],
    student_records: ['student_stats', 'student_list'],
    student_list: ['student_list'],
    tcas: ['tcas_admissions'],
    tcas_admissions: ['tcas_admissions'],
    course_analytics: ['course_analytics'],
    tuition: ['tuition'],
    graduation: ['graduation_check', 'graduation_stats'],
    academic_rules: ['academic_rules'],
    budget: ['budget_forecast', 'financial', 'faculty_budget'],
    finance: ['financial', 'faculty_budget', 'budget_forecast'],
    research: ['research_overview'],
    hr: ['hr_overview'],
    strategic: ['strategic_overview'],
    student_life: ['student_life'],
    dashboard: ['dashboard'],
    maejo_student_faq: [],
    public_maejo: [],
};

export function resolveAIRole(roleOrUser) {
    const rawRole = typeof roleOrUser === 'string' ? roleOrUser : roleOrUser?.role;
    return rawRole && getRoleInfo(rawRole) ? rawRole : 'general';
}
export function isAIUnrestrictedRole(roleOrUser) {
    return UNRESTRICTED_AI_ROLES.has(resolveAIRole(roleOrUser));
}

export function canAIUseInternalSection(roleOrUser, section) {
    if (!section) return true;
    const role = resolveAIRole(roleOrUser);
    if (isAIUnrestrictedRole(role)) return true;
    return canAccess(role, section);
}

export function canAIUseAnyInternalSection(roleOrUser, sections = []) {
    const list = Array.isArray(sections) ? sections.filter(Boolean) : [sections].filter(Boolean);
    if (list.length === 0) return true;
    return list.some(section => canAIUseInternalSection(roleOrUser, section));
}

export function canAIUseAllInternalSections(roleOrUser, sections = []) {
    const list = Array.isArray(sections) ? sections.filter(Boolean) : [sections].filter(Boolean);
    if (list.length === 0) return true;
    return list.every(section => canAIUseInternalSection(roleOrUser, section));
}

export function getSectionsForAIDomain(domain) {
    return DOMAIN_SECTION_MAP[domain] || ['dashboard'];
}

export function canAIUseInternalDomain(roleOrUser, domain) {
    return canAIUseAnyInternalSection(roleOrUser, getSectionsForAIDomain(domain));
}

export function canAIUseAction(roleOrUser, action = {}) {
    return canAIUseAllInternalSections(roleOrUser, action.requiredSections || action.sections || []);
}

export function buildAIAccessDeniedResult(roleOrUser, sections = []) {
    const role = resolveAIRole(roleOrUser);
    const roleInfo = getRoleInfo(role);
    const roleLabel = roleInfo?.label || role;
    const sectionList = Array.isArray(sections) ? sections.filter(Boolean) : [sections].filter(Boolean);
    const sectionText = sectionList.length > 0 ? ` (${sectionList.join(', ')})` : '';

    return {
        text:
            `ข้อมูลนี้อยู่นอกสิทธิ์ของ role ปัจจุบัน: **${roleLabel}**${sectionText}\n\n` +
            'AI จึงไม่ดึงข้อมูลภายในส่วนนั้นมาตอบให้ เพื่อป้องกันข้อมูลที่ถูกล็อคหลุดไปผิดสิทธิ์\n\n' +
            '**ลองถามได้ตามสิทธิ์ที่เปิดอยู่** เช่น ภาพรวม Dashboard, ค่าธรรมเนียม, กฎระเบียบ/เกียรตินิยม, กิจกรรม, รายวิชา หรืออัปโหลดไฟล์ของคุณเองให้ AI วิเคราะห์ได้ครับ',
        chart: null,
        accessDenied: true,
    };
}

export function getAIAccessInstruction(roleOrUser, usePublicWebMode = false) {
    const role = resolveAIRole(roleOrUser);
    if (isAIUnrestrictedRole(role)) {
        return 'role นี้เป็นผู้บริหารที่ AI เข้าถึงข้อมูลภายในได้ครบทุกโดเมนตามระบบ';
    }
    if (usePublicWebMode) {
        return 'ตอบข้อมูลสาธารณะจากเว็บทางการ/แหล่งน่าเชื่อถือได้ แต่ห้ามใช้เว็บนอกเพื่อเลี่ยงสิทธิ์ข้อมูลภายในที่ role นี้ไม่ได้รับอนุญาต';
    }
    return 'ตอบเฉพาะข้อมูลภายในที่ role นี้มีสิทธิ์เข้าถึงเท่านั้น ถ้าข้อมูลอยู่นอกสิทธิ์ให้บอกว่าต้องใช้สิทธิ์สูงกว่า';
}
