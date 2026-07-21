import { canAIUseAnyInternalSection, resolveAIRole } from '../utils/aiAccessPolicy';
import {
    getSharedDashboardDatasetMetaSync,
    getSharedDashboardDatasetSync,
} from './sharedDashboardDataService';
import { getDatasetQualityText } from '../utils/smartChartData';
import { getExecutiveAdviceTrustLevel, isAIComparisonIntent } from '../utils/aiAdvicePolicy';

export const AI_DATASET_REGISTRY = [
    {
        id: 'dashboard_summary',
        label: 'ภาพรวม Dashboard',
        domain: 'dashboard',
        sections: ['dashboard'],
        keywords: /ภาพรวม|dashboard|ทั้งหมด|สรุป|overview|นักศึกษาทั้งหมด|รายวิชาเปิดสอน|สำเร็จการศึกษา/i,
        chartableFields: ['totalStudents', 'totalCourses', 'avgGPA', 'graduationRate'],
    },
    {
        id: 'student_stats',
        label: 'สถิตินักศึกษา',
        domain: 'students',
        sections: ['student_stats'],
        keywords: /นักศึกษา|นิสิต|student|gpa|เกรด|สาขา|ชั้นปี|คงอยู่|retention|ลดลง|ลาออก|พ้นสภาพ|รอพินิจ|เสี่ยง|อัตราสำเร็จ|สำเร็จการศึกษา|ความพร้อมจบ/i,
        chartableFields: ['total', 'byLevel', 'byEnrollmentYear', 'byMajor', 'newStudentIntake', 'trend', 'studentAwards', 'populationForecast'],
    },
    {
        id: 'tcas_admissions',
        label: 'TCAS / แผนรับนักศึกษา',
        domain: 'tcas',
        sections: ['tcas_admissions'],
        keywords: /tcas|admission|รับสมัคร|รับเข้า|เข้า\s*\d+|สมัคร|ผ่านคัดเลือก|รายงานตัว|คงอยู่หลังปี\s*1|funnel|แผนรับ|รับเข้าน้อย|ลดลง|รอบ\s*[1-4]|portfolio|quota|direct/i,
        chartableFields: ['round3Plan2569', 'roundPlan2569', 'intakeTarget2570', 'majorOutlook'],
    },
    {
        id: 'course_analytics',
        label: 'รายวิชาและการกระจายเกรด',
        domain: 'course_analytics',
        sections: ['course_analytics'],
        keywords: /รายวิชา|วิชา|วิชาข้าม|course|เกรดรายวิชา|กระจายเกรด|วิชาไหน|แผนเรียน|ข้ามสาขา|จุดเด่น/i,
        chartableFields: ['gradeDistributions', 'featuredCourses', 'coursePlanByYear', 'branchStrengths'],
    },
    {
        id: 'academic_rules',
        label: 'กฎระเบียบและเกียรตินิยม',
        domain: 'academic_rules',
        sections: ['academic_rules', 'graduation_check', 'graduation_stats'],
        keywords: /กฎ|กฏ|ระเบียบ|เกียรตินิยม|gpa|ต่ำกว่า\s*2|2\.00|รอพินิจ|พ้นสภาพ|สำเร็จการศึกษา|ตรวจสอบการจบ|เงื่อนไขจบ|เงื่อนไข|จบ|หน่วยกิต|f\s*หรือ\s*u/i,
        chartableFields: [],
    },
    {
        id: 'tuition',
        label: 'ค่าเทอมและค่าธรรมเนียม',
        domain: 'tuition',
        sections: ['tuition'],
        keywords: /ค่าเทอม|ค่าเล่าเรียน|ค่าธรรมเนียม|รายได้|รายรับ|กระทบรายได้|ผลต่อรายได้|ชำระ|ค้างจ่าย|tuition/i,
        chartableFields: ['fees', 'byProgram', 'byYear'],
    },
    {
        id: 'graduation',
        label: 'สถิติสำเร็จการศึกษา',
        domain: 'graduation',
        sections: ['graduation_check', 'graduation_stats'],
        keywords: /สำเร็จ|จบ|graduation|ผู้สำเร็จ|อัตราสำเร็จ|ชั่วโมงกิจกรรม|กิจกรรม.*ครบ|ความพร้อมจบ|เกียรติ/i,
        chartableFields: ['history', 'byMajor', 'gpaDistribution'],
    },
    {
        id: 'science_budget',
        label: 'งบประมาณคณะวิทยาศาสตร์',
        domain: 'budget',
        sections: ['budget_forecast', 'financial', 'faculty_budget'],
        keywords: /งบ|budget|รายรับ|รายจ่าย|เงิน|finance|ประมาณการ|คณะวิทย/i,
        chartableFields: ['yearly', 'revenueBreakdown', 'expenseBreakdown', 'topMajors'],
    },
    {
        id: 'university_budget',
        label: 'งบประมาณมหาวิทยาลัย',
        domain: 'budget',
        sections: ['budget_forecast', 'financial'],
        keywords: /งบมหาวิทยาลัย|งบประมาณมหาวิทยาลัย|รายรับมหาวิทยาลัย|รายจ่ายมหาวิทยาลัย/i,
        chartableFields: ['yearly', 'revenueBreakdown', 'expenseBreakdown'],
    },
    {
        id: 'student_life',
        label: 'กิจกรรมคณะวิทยาศาสตร์',
        domain: 'student_life',
        sections: ['student_life'],
        keywords: /กิจกรรม|ชั่วโมงกิจกรรม|รับน้อง|ไหว้ครู|เดือนนี้|เดือนหน้า|พฤติกรรม/i,
        chartableFields: ['monthly', 'activities', 'hours'],
    },
    {
        id: 'research',
        label: 'งานวิจัย',
        domain: 'research',
        sections: ['research_overview'],
        keywords: /วิจัย|งานวิจัย|ภาพรวมงานวิจัย|research|scopus|citation|สิทธิบัตร|ทุน|ทุนวิจัย|ความเชี่ยวชาญ|จุดเด่น/i,
        chartableFields: ['publications', 'funding', 'patents'],
    },
    {
        id: 'hr',
        label: 'บุคลากร',
        domain: 'hr',
        sections: ['hr_overview'],
        keywords: /บุคลากร|อาจารย์|staff|hr|เกษียณ|ตำแหน่ง|ผู้บริหาร|สายวิชาการ|สายสนับสนุน|ความเชี่ยวชาญ|จุดเด่น/i,
        chartableFields: ['byPosition', 'byEducation', 'retirementForecast'],
    },
    {
        id: 'strategic',
        label: 'ยุทธศาสตร์ KPI และ OKR',
        domain: 'strategic',
        sections: ['strategic_overview'],
        keywords: /ยุทธศาสตร์|กลยุทธ์|okr|kpi|เป้าหมาย|ตัวชี้วัด|คำรับรอง/i,
        chartableFields: ['kpis', 'okr', 'targets', 'history'],
    },
    {
        id: 'alerts',
        label: 'Alert Center และเงื่อนไขความเสี่ยง',
        domain: 'alerts',
        sections: ['alert_center'],
        keywords: /alert|แจ้งเตือน|เตือน|เสี่ยง|วิกฤต|เฝ้าระวัง|threshold|เงื่อนไข/i,
        chartableFields: ['severityCounts', 'domainCounts', 'topAlerts'],
    },
];

const PUBLIC_CONTEXTS = new Set(['maejo_public', 'maejo_student_faq']);

export function datasetRegistryItem(id) {
    return AI_DATASET_REGISTRY.find(item => item.id === id || item.domain === id) || null;
}

export function datasetAccessStatus(item, roleOrUser) {
    if (!item) return { allowed: false, sections: [] };
    const sections = item.sections || [];
    if (sections.length === 0 || PUBLIC_CONTEXTS.has(item.id)) return { allowed: true, sections };
    return { allowed: canAIUseAnyInternalSection(roleOrUser, sections), sections };
}

function rowCountFromData(data) {
    if (!data) return 0;
    if (Array.isArray(data)) return data.length;
    if (Array.isArray(data.rows)) return data.rows.length;
    if (Array.isArray(data.items)) return data.items.length;
    if (Array.isArray(data.records)) return data.records.length;
    if (Array.isArray(data.data)) return data.data.length;
    if (Number.isFinite(Number(data.rowCount))) return Number(data.rowCount);
    if (Number.isFinite(Number(data.total))) return Number(data.total);
    if (Number.isFinite(Number(data.totalStudents))) return Number(data.totalStudents);
    return Object.keys(data || {}).length;
}

function confidenceFromTrust({ trustLevel, sourceType, hasData, isLive }) {
    if (!hasData) return 'none';
    if (isLive || trustLevel === 'live_official') return 'high';
    if (trustLevel === 'approved_reference' || /official|uploaded|firestore|api/i.test(String(sourceType || ''))) return 'medium';
    if (/fallback|mock|sample|demo|generated/i.test(String(sourceType || ''))) return 'low';
    return 'medium';
}

function freshnessLabel(updatedAt) {
    if (!updatedAt) return 'unknown';
    try {
        const date = new Date(updatedAt);
        if (Number.isNaN(date.getTime())) return 'unknown';
        return date.toISOString();
    } catch {
        return 'unknown';
    }
}

function keywordScore(item, q) {
    if (!item?.keywords) return 0;
    item.keywords.lastIndex = 0;
    if (!item.keywords.test(q)) return 0;
    let score = 10;
    const idParts = `${item.id} ${item.domain} ${(item.sections || []).join(' ')}`.toLowerCase().split(/[_\s]+/);
    for (const part of idParts) {
        if (part && q.includes(part)) score += 2;
    }
    return score;
}

const BUDGET_PRIORITY_PATTERN = /งบ|งบประมาณ|รายรับ|รายจ่าย|การเงิน|ค่าเทอม|ค่าธรรมเนียม|budget|finance|revenue|expense/i;
const COURSE_EXPLICIT_PATTERN = /รายวิชา|วิชาไหน|เกรดรายวิชา|กระจายเกรด|course|grade distribution/i;

export function datasetTrustSnapshot(id) {
    const meta = getSharedDashboardDatasetMetaSync(id);
    const data = getSharedDashboardDatasetSync(id);
    const trustLevel = getExecutiveAdviceTrustLevel(meta, { datasetId: id });
    const hasData = Boolean(data);
    const sourceType = meta?.sourceType || 'fallback';
    return {
        id,
        hasData,
        isLive: Boolean(meta?.isLive),
        trustLevel,
        sourceType,
        sourceLabel: getDatasetQualityText(meta),
        sourceUrl: meta?.sourceUrl || '',
        updatedAt: meta?.updatedAt || null,
        lastUpdated: freshnessLabel(meta?.updatedAt),
        rowCount: rowCountFromData(data),
        confidence: confidenceFromTrust({
            trustLevel,
            sourceType,
            hasData,
            isLive: Boolean(meta?.isLive),
        }),
    };
}

export function getAIContextBundle(question, roleOrUser, options = {}) {
    const q = String(question || '').toLowerCase();
    const role = resolveAIRole(roleOrUser);
    const isBudgetFinanceQuery = BUDGET_PRIORITY_PATTERN.test(q) && !COURSE_EXPLICIT_PATTERN.test(q);
    const matched = [];
    const denied = [];
    const comparisonMode = Boolean(options.comparisonMode) || isAIComparisonIntent(question);
    const configuredMaxContexts = Number.isFinite(Number(options.maxContexts))
        ? Number(options.maxContexts)
        : options.intent === 'executive_advice'
            ? 6
            : 5;
    const maxContexts = comparisonMode ? Math.max(6, configuredMaxContexts) : configuredMaxContexts;

    for (const item of AI_DATASET_REGISTRY) {
        let score = options.includeAll ? 1 : keywordScore(item, q);
        if (isBudgetFinanceQuery) {
            if (item.domain === 'budget' || item.id === 'science_budget' || item.id === 'university_budget') score += 100;
            if (item.id === 'course_analytics') score = 0;
        }
        const keywordMatch = score > 0;
        if (!keywordMatch && !options.includeAll) continue;
        const access = datasetAccessStatus(item, role);
        const trust = datasetTrustSnapshot(item.id);
        const row = {
            ...item,
            score,
            allowed: access.allowed,
            sections: access.sections,
            trustLevel: trust.trustLevel,
            sourceType: trust.sourceType,
            sourceLabel: trust.sourceLabel,
            sourceUrl: trust.sourceUrl,
            updatedAt: trust.updatedAt,
            lastUpdated: trust.lastUpdated,
            rowCount: trust.rowCount,
            confidence: trust.confidence,
            scope: item.domain,
            hasData: trust.hasData,
            isLive: trust.isLive,
        };
        if (access.allowed) matched.push(row);
        else denied.push(row);
    }

    matched.sort((a, b) => {
        const confidenceRank = { high: 3, medium: 2, low: 1, none: 0 };
        const trustRank = { live_official: 4, approved_reference: 3, uploaded_file: 3, system_fallback: 2, untrusted_demo: 1 };
        return (b.score - a.score)
            || ((confidenceRank[b.confidence] || 0) - (confidenceRank[a.confidence] || 0))
            || ((trustRank[b.trustLevel] || 0) - (trustRank[a.trustLevel] || 0))
            || String(a.id).localeCompare(String(b.id));
    });

    return {
        intentHint: options.intent || 'auto',
        comparisonMode,
        role,
        contexts: matched.slice(0, maxContexts),
        deniedSections: denied.flatMap(item => item.sections || []),
        deniedContexts: denied,
        sourceSummary: matched.slice(0, maxContexts).map(item => ({
            id: item.id,
            label: item.label,
            trustLevel: item.trustLevel,
            sourceType: item.sourceType,
            sourceLabel: item.sourceLabel,
            lastUpdated: item.lastUpdated,
            rowCount: item.rowCount,
            confidence: item.confidence,
            scope: item.scope,
            chartableFields: item.chartableFields,
        })),
    };
}

function inferEvidenceFlags(item = {}) {
    const raw = [
        item.sourceType,
        item.trustLevel,
        item.sourceLabel,
        item.id,
    ].filter(Boolean).join(' ').toLowerCase();
    const isMock = /mock|demo|sample|generated/.test(raw);
    const isStaticSeed = /static|seed|fallback|reference/.test(raw);
    const isRealtime = Boolean(item.isLive)
        || item.trustLevel === 'live_official'
        || /firestore|api|sync|linked_realtime|dashboard/.test(raw);
    return { isMock, isStaticSeed, isRealtime };
}

export function formatAIEvidencePackForPrompt(bundle, retrievedContexts = [], options = {}) {
    const retrievedIds = new Set((retrievedContexts || [])
        .map(context => context?.id)
        .filter(Boolean));
    let contexts = (bundle?.contexts || [])
        .filter(item => !retrievedIds.size || retrievedIds.has(item.id) || retrievedIds.has(item.domain))
        .slice(0, Number.isFinite(Number(options.limit)) ? Number(options.limit) : 8);
    if (!contexts.length && bundle?.contexts?.length) {
        contexts = bundle.contexts.slice(0, Number.isFinite(Number(options.limit)) ? Number(options.limit) : 8);
    }

    if (!contexts.length) {
        return [
            'AI evidence pack:',
            '- selectedDatasets=-',
            '- note=No accessible internal evidence matched this question. If answering, use public/official context only and state the limitation clearly.',
        ].join('\n');
    }

    const lines = contexts.map((item, index) => {
        const flags = inferEvidenceFlags(item);
        const fields = (item.chartableFields || []).join('|') || '-';
        const notes = [];
        if (flags.isMock) notes.push('mock/sample/generator: do not present as real data');
        if (flags.isStaticSeed) notes.push('static/fallback/reference: use only as best-effort context with caveat');
        if (!item.hasData) notes.push('no loaded data snapshot');
        if (!notes.length) notes.push('usable evidence within role permission');
        return [
            `Evidence ${index + 1}: dataset=${item.id}`,
            `  label=${item.label || item.id}`,
            `  scope=${item.scope || item.domain || '-'}`,
            `  sourceType=${item.sourceType || 'fallback'}`,
            `  sourceName=${item.sourceLabel || '-'}`,
            `  trustLevel=${item.trustLevel || 'unknown'}`,
            `  isMock=${flags.isMock}`,
            `  isStaticSeed=${flags.isStaticSeed}`,
            `  isRealtime=${flags.isRealtime}`,
            `  lastUpdated=${item.lastUpdated || 'unknown'}`,
            `  rowCount=${Number.isFinite(Number(item.rowCount)) ? Number(item.rowCount) : 0}`,
            `  confidence=${item.confidence || 'unknown'}`,
            `  fields=${fields}`,
            `  dataQualityNotes=${notes.join('; ')}`,
        ].join('\n');
    });

    const denied = (bundle?.deniedContexts || [])
        .slice(0, 6)
        .map(item => `${item.id}:${(item.sections || []).join('|') || '-'}`)
        .join(', ');

    return [
        'AI evidence pack:',
        `intentHint=${bundle?.intentHint || 'auto'}, role=${bundle?.role || 'unknown'}`,
        ...lines,
        denied ? `Denied evidence for this role: ${denied}` : '',
    ].filter(Boolean).join('\n');
}

export function formatAIContextBundleForPrompt(bundle) {
    if (!bundle?.contexts?.length && !bundle?.deniedContexts?.length) {
        return 'AI context registry: no matched internal dataset; use local FAQ/public fallback if allowed.';
    }
    const allowed = (bundle.contexts || [])
        .map(item => `- ${item.id}: allowed, scope=${item.scope || item.domain}, trust=${item.trustLevel}, confidence=${item.confidence}, source=${item.sourceType}, rows=${item.rowCount ?? 0}, updated=${item.lastUpdated || 'unknown'}, chartable=${(item.chartableFields || []).join('|') || '-'}`)
        .join('\n');
    const denied = (bundle.deniedContexts || [])
        .map(item => `- ${item.id}: denied for role=${bundle.role}, sections=${(item.sections || []).join('|')}`)
        .join('\n');
    return [
        'AI context registry:',
        allowed ? `Allowed datasets:\n${allowed}` : '',
        denied ? `Denied datasets:\n${denied}` : '',
    ].filter(Boolean).join('\n');
}
