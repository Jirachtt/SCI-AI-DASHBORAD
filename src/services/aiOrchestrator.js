import { isExecutiveRecommendationIntent } from '../utils/aiAdvicePolicy';
import { canAIUseAnyInternalSection, resolveAIRole } from '../utils/aiAccessPolicy';
import { getAIContextBundle } from './aiContextRegistry';

const CHART_PATTERN = /กราฟ|chart|plot|แผนภูมิ|แผนภาพ|visual|เปรียบเทียบ|แนวโน้ม|trend|กระจาย|distribution/i;
const STUDENT_FAQ_PATTERN = /เกียรตินิยม|ค่าเทอม|สมัคร|tcas|ลงทะเบียน|รายวิชา|วิชาไหน|กิจกรรม|ชั่วโมง|ที่ตั้ง|ติดต่อ|เบอร์|หอพัก|ปฏิทิน|ประกาศ/i;
const MAEJO_PUBLIC_PATTERN = /แม่โจ้|maejo|mju|มหาวิทยาลัย|คณะ|หลักสูตร|รับสมัคร|สถานที่|วิทยาเขต|ประวัติ|ข่าว|หน่วยงาน/i;
const INTERNAL_LOOKUP_PATTERN = /นักศึกษา|นิสิต|งบ|budget|kpi|okr|บุคลากร|วิจัย|สำเร็จการศึกษา|รายชื่อ|gpa|เกรด/i;
const SENSITIVE_PATTERN = /รายชื่อ|รหัสนักศึกษา|gpa\s*รายคน|เกรดรายคน|ค้างชำระรายคน|เงินเดือน|หักเงิน|citizen|บัตรประชาชน|เลขบัตร/i;
const BUDGET_PRIORITY_PATTERN = /งบ|งบประมาณ|รายรับ|รายจ่าย|การเงิน|budget|finance|revenue|expense/i;

function hasUploadedFile(options = {}) {
    return Boolean(options.uploadedFileData?.rowCount || options.uploadedFileData?.rows?.length);
}

export function classifyAIQuestionIntent(question, options = {}) {
    const q = String(question || '');
    if (hasUploadedFile(options)) return 'uploaded_file';
    if (isExecutiveRecommendationIntent(q)) return 'executive_advice';
    if (CHART_PATTERN.test(q)) return 'chart';
    if (SENSITIVE_PATTERN.test(q)) return 'blocked_sensitive';
    if (BUDGET_PRIORITY_PATTERN.test(q)) return 'internal_lookup';
    if (STUDENT_FAQ_PATTERN.test(q)) return 'student_faq';
    if (INTERNAL_LOOKUP_PATTERN.test(q)) return 'internal_lookup';
    if (MAEJO_PUBLIC_PATTERN.test(q)) return 'maejo_public';
    return 'maejo_public';
}

export function createAIOrchestrationPlan(question, userContext = {}, options = {}) {
    const intent = classifyAIQuestionIntent(question, options);
    const role = resolveAIRole(userContext);
    const contextBundle = getAIContextBundle(question, role, { intent });
    const hasDeniedContext = contextBundle.deniedContexts.length > 0;
    const hasAllowedContext = contextBundle.contexts.length > 0;
    const adviceMode = intent === 'executive_advice';
    const shouldDisableCache = adviceMode || intent === 'uploaded_file';
    const shouldUseWebFallback =
        intent === 'maejo_public'
        || intent === 'student_faq'
        || (intent === 'executive_advice' && !hasAllowedContext);

    const sensitiveButAllowed = intent === 'blocked_sensitive'
        && contextBundle.contexts.some(item => canAIUseAnyInternalSection(role, item.sections || []));

    return {
        intent,
        role,
        adviceMode,
        shouldDisableCache,
        shouldUseWebFallback,
        hasDeniedContext,
        blockedReason: intent === 'blocked_sensitive' && !sensitiveButAllowed
            ? 'sensitive_or_row_level_data_requires_allowed_internal_context'
            : '',
        contextBundle,
        selectedDatasets: contextBundle.contexts.map(item => item.id),
        deniedDatasets: contextBundle.deniedContexts.map(item => item.id),
        sourceCount: contextBundle.contexts.length,
        requiresClarification: ['internal_lookup', 'chart', 'executive_advice'].includes(intent) && !hasAllowedContext,
        usageMode: intent === 'chart' ? 'deterministic_chart_first' : 'local_first_rag',
    };
}

export function formatAIOrchestrationPlanForPrompt(plan) {
    if (!plan) return '';
    return [
        `AI orchestration: intent=${plan.intent}, usageMode=${plan.usageMode}, role=${plan.role}`,
        `selectedDatasets=${(plan.selectedDatasets || []).join('|') || '-'}, deniedDatasets=${(plan.deniedDatasets || []).join('|') || '-'}`,
        `cache=${plan.shouldDisableCache ? 'disabled' : 'allowed'}, webFallback=${plan.shouldUseWebFallback ? 'allowed_when_needed' : 'only_if_settings_allow'}`,
        plan.requiresClarification ? 'clarificationPolicy=if selected datasets are empty, state the missing data or ask a targeted follow-up instead of guessing' : '',
        plan.blockedReason ? `blockedSensitive=${plan.blockedReason}` : '',
    ].filter(Boolean).join('\n');
}
