import {
    isAIComparisonIntent,
    isAnalyticalReasoningIntent,
    isExecutiveRecommendationIntent,
} from '../utils/aiAdvicePolicy';
import { canAIUseAnyInternalSection, canRoleUseAI, resolveAIRole } from '../utils/aiAccessPolicy';
import { getAIContextBundle } from './aiContextRegistry';

const CHART_PATTERN = /กราฟ|chart|plot|แผนภูมิ|แผนภาพ|visual|เปรียบเทียบ|เทียบ(?:กับ|กัน|ระหว่าง)?|ต่างกัน|แนวโน้ม|trend|กระจาย|distribution|compare|comparison|versus|\bvs\.?\b/i;
const STUDENT_FAQ_PATTERN = /เกียรตินิยม|ค่าเทอม|สมัคร|tcas|ลงทะเบียน|รายวิชา|วิชาไหน|วิชาข้าม|ข้ามสาขา|กิจกรรม|ชั่วโมง|ที่ตั้ง|ติดต่อ|เบอร์|หอพัก|ปฏิทิน|ประกาศ/i;
const MAEJO_PUBLIC_PATTERN = /แม่โจ้|maejo|mju|มหาวิทยาลัย|คณะ|หลักสูตร|รับสมัคร|สถานที่|วิทยาเขต|ประวัติ|ข่าว|หน่วยงาน/i;
const INTERNAL_LOOKUP_PATTERN = /นักศึกษา|นิสิต|งบ|budget|kpi|okr|บุคลากร|วิจัย|สำเร็จการศึกษา|ตรวจสอบการจบ|เงื่อนไขจบ|จบ|รายชื่อ|gpa|เกรด|ชั่วโมงกิจกรรม/i;
const SENSITIVE_PATTERN = /รายชื่อ|รหัสนักศึกษา|gpa\s*รายคน|เกรดรายคน|ค้างชำระรายคน|เงินเดือน|หักเงิน|citizen|บัตรประชาชน|เลขบัตร/i;
const BUDGET_PRIORITY_PATTERN = /งบ|งบประมาณ|รายรับ|รายจ่าย|การเงิน|budget|finance|revenue|expense/i;
const TCAS_QUANT_LOOKUP_PATTERN = /tcas.*(รับกี่คน|กี่คน|รอบไหน|แผนรับ|ไม่เต็มแผน)|รอบ\s*[1-4].*(รับ|กี่คน|แผน)|แผนรับ.*tcas/i;
const ACTIVITY_PROGRESS_PATTERN = /ชั่วโมงกิจกรรม.*(เหลือ|ครบ|ขาด)|กิจกรรม.*(เหลือ|ครบ|ขาด)/i;
const OVERVIEW_LOOKUP_PATTERN = /ภาพรวม.*(นักศึกษา|วิจัย|บุคลากร|งานวิจัย)|สรุปภาพรวม.*(นักศึกษา|วิจัย|บุคลากร)|student overview|research overview|hr overview/i;
const STUDENT_ROW_LEVEL_PATTERN = /รายชื่อ|รหัสนักศึกษา|gpa\s*รายคน|เกรดรายคน|รายคน|แต่ละคน|top\s*\d+|สูงสุด\s*\d*|ต่ำสุด\s*\d*/i;
const FINANCE_ROW_LEVEL_PATTERN = /ค้างชำระรายคน|ชำระรายคน|จ่ายจริง|วันที่จ่าย|รายชื่อคนค้าง|รายชื่อ.*ค้าง|ค่าธรรมเนียม.*รายคน/i;
const HR_SENSITIVE_PATTERN = /เงินเดือน|หักเงิน|รายการหัก|salary|payroll/i;

function hasUploadedFile(options = {}) {
    return Boolean(options.uploadedFileData?.rowCount || options.uploadedFileData?.rows?.length);
}

export function classifyAIQuestionIntent(question, options = {}) {
    const q = String(question || '');
    if (hasUploadedFile(options)) return 'uploaded_file';
    if (SENSITIVE_PATTERN.test(q)) return 'blocked_sensitive';
    if (CHART_PATTERN.test(q)) return 'chart';
    if (ACTIVITY_PROGRESS_PATTERN.test(q)) return 'internal_lookup';
    if (OVERVIEW_LOOKUP_PATTERN.test(q)) return 'internal_lookup';
    if (isExecutiveRecommendationIntent(q)) return 'executive_advice';
    if (BUDGET_PRIORITY_PATTERN.test(q)) return 'internal_lookup';
    if (TCAS_QUANT_LOOKUP_PATTERN.test(q)) return 'internal_lookup';
    if (STUDENT_FAQ_PATTERN.test(q)) return 'student_faq';
    if (INTERNAL_LOOKUP_PATTERN.test(q)) return 'internal_lookup';
    if (MAEJO_PUBLIC_PATTERN.test(q)) return 'maejo_public';
    return 'maejo_public';
}

function sensitiveRequiredSections(question) {
    const q = String(question || '');
    const sections = [];
    if (STUDENT_ROW_LEVEL_PATTERN.test(q)) sections.push('student_list');
    if (FINANCE_ROW_LEVEL_PATTERN.test(q)) sections.push('financial_detail');
    if (HR_SENSITIVE_PATTERN.test(q)) sections.push('hr_overview');
    return sections.length ? sections : ['student_list'];
}

export function createAIOrchestrationPlan(question, userContext = {}, options = {}) {
    const intent = classifyAIQuestionIntent(question, options);
    const role = resolveAIRole(userContext);
    const aiAccessAllowed = canRoleUseAI(role);
    const comparisonMode = isAIComparisonIntent(question);
    const contextBundle = getAIContextBundle(question, role, { intent, comparisonMode });
    const hasDeniedContext = contextBundle.deniedContexts.length > 0;
    const hasAllowedContext = contextBundle.contexts.length > 0;
    const priorityDeniedContexts = contextBundle.deniedContexts
        .filter(item => Number(item.score || 0) >= 100);
    const priorityDeniedDomains = new Set(priorityDeniedContexts.map(item => item.domain));
    const hasAllowedPriorityDomain = contextBundle.contexts.some(item =>
        Number(item.score || 0) >= 100 && priorityDeniedDomains.has(item.domain)
    );
    const requestedPriorityDomainDenied = priorityDeniedContexts.length > 0 && !hasAllowedPriorityDomain;
    const priorityDeniedSections = [...new Set(priorityDeniedContexts.flatMap(item => item.sections || []))];
    const adviceMode = intent === 'executive_advice';
    const reasoningMode = isAnalyticalReasoningIntent(question);
    const shouldDisableCache = adviceMode || reasoningMode || intent === 'uploaded_file';
    const shouldUseWebFallback =
        intent === 'maejo_public'
        || intent === 'student_faq'
        || (intent === 'executive_advice' && !hasAllowedContext);

    const sensitiveSections = sensitiveRequiredSections(question);
    const sensitiveButAllowed = intent === 'blocked_sensitive'
        && canAIUseAnyInternalSection(role, sensitiveSections);

    return {
        intent,
        role,
        aiAccessAllowed,
        adviceMode,
        reasoningMode,
        comparisonMode,
        shouldDisableCache,
        shouldUseWebFallback,
        hasDeniedContext,
        blockedReason: !aiAccessAllowed
            ? 'role_not_allowed_to_use_ai'
            : intent === 'blocked_sensitive' && !sensitiveButAllowed
                ? 'sensitive_or_row_level_data_requires_allowed_internal_context'
                : requestedPriorityDomainDenied
                    ? 'requested_domain_requires_allowed_internal_context'
                : '',
        sensitiveSections: intent === 'blocked_sensitive' ? sensitiveSections : [],
        blockedSections: intent === 'blocked_sensitive'
            ? sensitiveSections
            : requestedPriorityDomainDenied
                ? priorityDeniedSections
                : [],
        contextBundle,
        selectedDatasets: contextBundle.contexts.map(item => item.id),
        deniedDatasets: contextBundle.deniedContexts.map(item => item.id),
        sourceCount: contextBundle.contexts.length,
        requiresClarification: ['internal_lookup', 'chart', 'executive_advice'].includes(intent) && !hasAllowedContext,
        usageMode: reasoningMode ? 'llm_reasoning_first' : intent === 'chart' ? 'deterministic_chart_first' : 'local_first_rag',
    };
}

export function formatAIOrchestrationPlanForPrompt(plan) {
    if (!plan) return '';
    return [
        `AI orchestration: intent=${plan.intent}, usageMode=${plan.usageMode}, role=${plan.role}`,
        `selectedDatasets=${(plan.selectedDatasets || []).join('|') || '-'}, deniedDatasets=${(plan.deniedDatasets || []).join('|') || '-'}`,
        `reasoningMode=${plan.reasoningMode ? 'true' : 'false'}, comparisonMode=${plan.comparisonMode ? 'true' : 'false'}, cache=${plan.shouldDisableCache ? 'disabled' : 'allowed'}, webFallback=${plan.shouldUseWebFallback ? 'allowed_when_needed' : 'only_if_settings_allow'}`,
        plan.requiresClarification ? 'clarificationPolicy=if selected datasets are empty, state the missing data or ask a targeted follow-up instead of guessing' : '',
        plan.blockedReason ? `blockedSensitive=${plan.blockedReason}` : '',
    ].filter(Boolean).join('\n');
}
