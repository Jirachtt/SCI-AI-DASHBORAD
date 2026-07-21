import { isAIComparisonIntent } from '../utils/aiAdvicePolicy.js';

const SENSITIVE_DATA_PATTERN =
    /รายชื่อ|รหัสนักศึกษา|gpa\s*รายคน|เกรดรายคน|ค้างชำระรายคน|จ่ายจริง|วันที่จ่าย|เงินเดือน|รายการหัก|salary|payroll|citizen|เลขบัตร|transcript/i;

const PUBLIC_MAEJO_PATTERN =
    /แม่โจ้|maejo|mju|มหาวิทยาลัย|คณะวิทยาศาสตร์|tcas|admission|รับสมัคร|หลักสูตร|ค่าเทอม|ค่าธรรมเนียม|ปฏิทิน|ประกาศ|ข่าว|ติดต่อ|ที่ตั้ง|วิทยาเขต|หอพัก|ทุน|ห้องสมุด|หน่วยงาน|อธิการบดี/i;

const FRESHNESS_PATTERN =
    /ล่าสุด|ปัจจุบัน|วันนี้|ปีนี้|เดือนนี้|เดือนหน้า|ประกาศ|กำหนดการ|เปิดรับ|รับสมัคร|วันไหน|เมื่อไหร่|เบอร์|โทร|ติดต่อ|current|latest|today|now/i;

const EXPLICIT_WEB_PATTERN =
    /ค้นเว็บ|ค้นจากเว็บ|เช็กเว็บ|เช็คเว็บ|ตรวจเว็บ|แหล่งภายนอก|เว็บไซต์ทางการ|search\s+(?:the\s+)?web|look\s*up/i;

const TCAS_DETAIL_PATTERN =
    /tcas.*(?:ย้อนหลัง\s*5\s*ปี|แต่ละรอบ|ทุกรอบ|รอบ\s*[124]|funnel|สมัคร.*ผ่าน|รายงานตัว)|(?:ย้อนหลัง\s*5\s*ปี|แต่ละรอบ|ทุกรอบ|รอบ\s*[124]|funnel).*(?:tcas|รับสมัคร|รับเข้า)/i;

const PUBLIC_AGGREGATE_PATTERN =
    /นักศึกษา|นิสิต|งบ|งบประมาณ|รายรับ|รายจ่าย|tcas|รับเข้า|รายวิชา|เกรด|gpa|สำเร็จการศึกษา|วิจัย|บุคลากร|อาจารย์|student|budget|finance|course|grade|graduation|research|staff|hr/i;

const COMPARISON_TOPIC_PATTERNS = [
    { id: 'student_count', pattern: /จำนวนนักศึกษา|จำนวนนิสิต|ยอดนักศึกษา|student\s*count|enrollment/i },
    { id: 'budget', pattern: /งบ(?:ประมาณ)?|วงเงิน|budget/i },
    { id: 'revenue', pattern: /รายรับ|revenue|income/i },
    { id: 'expense', pattern: /รายจ่าย|ค่าใช้จ่าย|expense|expenditure/i },
    { id: 'tcas', pattern: /tcas|admission|รับสมัคร|รับเข้า/i },
    { id: 'courses', pattern: /จำนวนรายวิชา|รายวิชา|course/i },
    { id: 'gpa', pattern: /เกรด|gpa|grade/i },
    { id: 'graduation', pattern: /อัตราสำเร็จ|จำนวนผู้สำเร็จ|สำเร็จการศึกษา|graduation/i },
    { id: 'hr', pattern: /จำนวนบุคลากร|จำนวนอาจารย์|บุคลากร|staff|hr/i },
    { id: 'research', pattern: /วิจัย|research/i },
];

function comparisonTopics(question) {
    const q = String(question || '');
    return COMPARISON_TOPIC_PATTERNS.filter(topic => topic.pattern.test(q));
}

const MISSING_ONLY_PATTERNS = [
    /no direct local faq match/i,
    /ยังไม่มีข้อมูลในระบบปัจจุบัน/i,
    /ยังไม่พร้อมสำหรับคำแนะนำเชิงบริหาร/i,
    /ไม่มีข้อมูลที่เกี่ยวข้อง/i,
    /no accessible internal evidence/i,
];

const TRUSTED_EXTERNAL_HOST_SUFFIXES = [
    'mju.ac.th',
    'mytcas.com',
    'go.th',
    'ac.th',
];

const GROUNDING_REDIRECT_HOSTS = new Set([
    'vertexaisearch.cloud.google.com',
]);

const USABLE_CONTEXT_PATTERNS = [
    /\banswer:/i,
    /\bsummary:/i,
    /\brealtime\b/i,
    /live_official/i,
    /approved_reference/i,
    /ข้อมูลที่เว็บใช้อยู่ตอนนี้/i,
    /ข้อมูลในหน้า/i,
    /\brows?\b/i,
    /\btotal\b/i,
    /\bsource(?:s|label|trust)?\b/i,
];

function contextText(context) {
    return String(context?.text || '').trim();
}

function looksMissingOnly(context) {
    const text = contextText(context);
    if (!text) return true;
    const hasMissingSignal = MISSING_ONLY_PATTERNS.some(pattern => pattern.test(text));
    if (!hasMissingSignal) return false;
    return !USABLE_CONTEXT_PATTERNS.some(pattern => pattern.test(text));
}

function isDirectLocalContext(context) {
    const text = contextText(context);
    if (text.length < 60 || looksMissingOnly(context)) return false;
    return USABLE_CONTEXT_PATTERNS.some(pattern => pattern.test(text)) || text.length >= 180;
}

function isTrustedRegistryContext(context) {
    if (!context?.hasData) return false;
    if (context.trustLevel === 'untrusted_demo') return false;
    if (context.confidence === 'none') return false;
    return true;
}

function hasIncompleteTcasEvidence(question, contexts = []) {
    if (!TCAS_DETAIL_PATTERN.test(String(question || ''))) return false;
    return contexts.some(context => {
        if (!/tcas/i.test(String(context?.id || ''))) return false;
        const text = contextText(context);
        return /missingData:\s*(?!-)/i.test(text)
            || /ข้อมูลรายรอบที่ยังไม่ครบ/i.test(text)
            || /seed_waiting_file|waiting|missing/i.test(text);
    });
}

export function evaluateAILocalEvidence({ question = '', contexts = [], contextBundle = {} } = {}) {
    const registryContexts = Array.isArray(contextBundle?.contexts) ? contextBundle.contexts : [];
    const directContexts = (Array.isArray(contexts) ? contexts : []).filter(isDirectLocalContext);
    const trustedRegistryContexts = registryContexts.filter(isTrustedRegistryContext);
    const demoRegistryContexts = registryContexts.filter(context => context?.hasData && !isTrustedRegistryContext(context));
    const requiresFreshVerification = FRESHNESS_PATTERN.test(String(question || ''));
    const hasMissingTcasDetail = hasIncompleteTcasEvidence(question, contexts);
    const hasTrustedLiveContext = trustedRegistryContexts.some(context =>
        context?.isLive || context?.trustLevel === 'live_official'
    );
    const comparisonMode = Boolean(contextBundle?.comparisonMode) || isAIComparisonIntent(question);
    const requestedComparisonTopicList = comparisonTopics(question);
    const requestedComparisonTopics = requestedComparisonTopicList.length;
    const evidenceDatasetIds = new Set([
        ...registryContexts.filter(context => context?.hasData).map(context => context.id),
        ...directContexts.map(context => context.id),
    ].filter(Boolean));
    const evidenceDescriptor = [
        ...registryContexts.map(context => `${context.id || ''} ${context.domain || ''} ${context.label || ''}`),
        ...directContexts.map(context => `${context.id || ''} ${contextText(context)}`),
    ].join('\n');
    const coveredComparisonTopics = requestedComparisonTopicList
        .filter(topic => topic.pattern.test(evidenceDescriptor))
        .map(topic => topic.id);
    const comparisonEvidenceComplete = !comparisonMode
        || requestedComparisonTopics < 2
        || coveredComparisonTopics.length === requestedComparisonTopics;

    let coverage = 'none';
    if (trustedRegistryContexts.length > 0 || directContexts.length > 0) coverage = 'sufficient';
    else if (demoRegistryContexts.length > 0 || (contexts || []).some(context => contextText(context).length >= 60)) coverage = 'partial';

    if (hasMissingTcasDetail) coverage = coverage === 'none' ? 'none' : 'partial';
    if (requiresFreshVerification && !hasTrustedLiveContext) coverage = coverage === 'none' ? 'none' : 'partial';
    if (!comparisonEvidenceComplete) coverage = coverage === 'none' ? 'none' : 'partial';

    return {
        coverage,
        directContextCount: directContexts.length,
        trustedDatasetCount: trustedRegistryContexts.length,
        demoDatasetCount: demoRegistryContexts.length,
        hasTrustedLiveContext,
        requiresFreshVerification,
        hasMissingTcasDetail,
        comparisonMode,
        requestedComparisonTopics,
        coveredComparisonTopics,
        comparisonEvidenceComplete,
        evidenceDatasetCount: evidenceDatasetIds.size,
    };
}

export function decideAIRetrievalPolicy({
    question = '',
    intent = 'maejo_public',
    contexts = [],
    contextBundle = {},
    allowWebSearch = true,
    shouldUseWebFallback = false,
    blockedReason = '',
} = {}) {
    const q = String(question || '');
    const evidence = evaluateAILocalEvidence({ question: q, contexts, contextBundle });
    const deniedOnly = Boolean(contextBundle?.deniedContexts?.length)
        && !(contextBundle?.contexts || []).length;
    const sensitive = intent === 'blocked_sensitive' || SENSITIVE_DATA_PATTERN.test(q);
    const explicitWebRequest = EXPLICIT_WEB_PATTERN.test(q);
    const publicEligible = explicitWebRequest
        || shouldUseWebFallback
        || intent === 'maejo_public'
        || intent === 'student_faq'
        || (isAIComparisonIntent(q) && PUBLIC_AGGREGATE_PATTERN.test(q))
        || PUBLIC_MAEJO_PATTERN.test(q);

    let useWebSearch = false;
    let reason = 'local_evidence_sufficient';

    if (!allowWebSearch) {
        reason = 'web_search_disabled';
    } else if (blockedReason || sensitive || deniedOnly) {
        reason = blockedReason || (deniedOnly ? 'role_denied_internal_evidence' : 'sensitive_data_local_only');
    } else if (!publicEligible) {
        reason = evidence.coverage === 'none' ? 'no_public_fallback_for_internal_question' : 'local_internal_evidence_selected';
    } else if (explicitWebRequest) {
        useWebSearch = true;
        reason = 'user_requested_trusted_web_verification_after_local';
    } else if ((intent === 'maejo_public' || intent === 'student_faq') && evidence.directContextCount === 0) {
        useWebSearch = true;
        reason = 'no_direct_local_public_answer';
    } else if (evidence.coverage === 'none') {
        useWebSearch = true;
        reason = 'no_relevant_local_evidence';
    } else if (evidence.coverage === 'partial' && (
        evidence.requiresFreshVerification
        || evidence.hasMissingTcasDetail
        || !evidence.comparisonEvidenceComplete
        || explicitWebRequest
        || shouldUseWebFallback
    )) {
        useWebSearch = true;
        reason = evidence.hasMissingTcasDetail
            ? 'local_tcas_detail_incomplete'
            : !evidence.comparisonEvidenceComplete
                ? 'local_comparison_evidence_incomplete'
            : evidence.requiresFreshVerification
                ? 'local_evidence_needs_fresh_official_verification'
                : 'local_evidence_partial';
    }

    return {
        ...evidence,
        useWebSearch,
        reason,
        publicEligible,
        sensitive,
        deniedOnly,
        mode: useWebSearch ? 'trusted_web_fallback' : 'local_first',
    };
}

export function formatAIRetrievalPolicyForPrompt(policy = {}) {
    return [
        'AI retrieval policy:',
        `mode=${policy.mode || 'local_first'}`,
        `localCoverage=${policy.coverage || 'none'}`,
        `trustedLocalDatasets=${Number(policy.trustedDatasetCount || 0)}`,
        `directLocalContexts=${Number(policy.directContextCount || 0)}`,
        `comparisonEvidence=${policy.comparisonMode ? (policy.comparisonEvidenceComplete ? 'complete' : 'incomplete') : 'not_requested'}`,
        `webSearch=${policy.useWebSearch ? 'fallback_after_local' : 'disabled_for_this_request'}`,
        `decisionReason=${policy.reason || 'unknown'}`,
        policy.useWebSearch
            ? 'Rule: analyze the selected local evidence first, then fill only the missing public facts from official/trusted sources. Clearly distinguish local evidence from external evidence.'
            : 'Rule: answer and calculate from selected local evidence only. Do not imply that external web evidence was used.',
    ].join('\n');
}

export function isTrustedAIExternalSource(url) {
    try {
        const host = new URL(String(url || '')).hostname.toLowerCase();
        if (GROUNDING_REDIRECT_HOSTS.has(host)) return true;
        return TRUSTED_EXTERNAL_HOST_SUFFIXES.some(suffix => host === suffix || host.endsWith(`.${suffix}`));
    } catch {
        return false;
    }
}
