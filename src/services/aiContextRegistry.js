import { canAIUseAnyInternalSection, resolveAIRole } from '../utils/aiAccessPolicy';
import {
    getSharedDashboardDatasetMetaSync,
    getSharedDashboardDatasetSync,
} from './sharedDashboardDataService';
import { getDatasetQualityText } from '../utils/smartChartData';
import { getExecutiveAdviceTrustLevel } from '../utils/aiAdvicePolicy';

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
        keywords: /นักศึกษา|นิสิต|student|gpa|เกรด|สาขา|ชั้นปี|คงอยู่|ลาออก|พ้นสภาพ|รอพินิจ|เสี่ยง/i,
        chartableFields: ['total', 'byLevel', 'byEnrollmentYear', 'byMajor', 'newStudentIntake', 'trend'],
    },
    {
        id: 'tcas_admissions',
        label: 'TCAS / แผนรับนักศึกษา',
        domain: 'tcas',
        sections: ['tcas_admissions'],
        keywords: /tcas|admission|รับสมัคร|รับเข้า|แผนรับ|รอบ\s*[1-4]|portfolio|quota|direct/i,
        chartableFields: ['round3Plan2569', 'roundPlan2569', 'intakeTarget2570', 'majorOutlook'],
    },
    {
        id: 'course_analytics',
        label: 'รายวิชาและการกระจายเกรด',
        domain: 'course_analytics',
        sections: ['course_analytics'],
        keywords: /รายวิชา|วิชา|course|เกรดรายวิชา|กระจายเกรด|วิชาไหน|แผนเรียน|ข้ามสาขา|จุดเด่น/i,
        chartableFields: ['gradeDistributions', 'featuredCourses', 'coursePlanByYear', 'branchStrengths'],
    },
    {
        id: 'academic_rules',
        label: 'กฎระเบียบและเกียรตินิยม',
        domain: 'academic_rules',
        sections: ['academic_rules', 'graduation_check', 'graduation_stats'],
        keywords: /กฎ|กฏ|ระเบียบ|เกียรตินิยม|พ้นสภาพ|สำเร็จการศึกษา|หน่วยกิต|f\s*หรือ\s*u/i,
        chartableFields: [],
    },
    {
        id: 'tuition',
        label: 'ค่าเทอมและค่าธรรมเนียม',
        domain: 'tuition',
        sections: ['tuition'],
        keywords: /ค่าเทอม|ค่าเล่าเรียน|ค่าธรรมเนียม|ชำระ|ค้างจ่าย|tuition/i,
        chartableFields: ['fees', 'byProgram', 'byYear'],
    },
    {
        id: 'graduation',
        label: 'สถิติสำเร็จการศึกษา',
        domain: 'graduation',
        sections: ['graduation_check', 'graduation_stats'],
        keywords: /สำเร็จ|จบ|graduation|ผู้สำเร็จ|อัตราสำเร็จ|เกียรติ/i,
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
        keywords: /วิจัย|research|scopus|citation|สิทธิบัตร|ทุน/i,
        chartableFields: ['publications', 'funding', 'patents'],
    },
    {
        id: 'hr',
        label: 'บุคลากร',
        domain: 'hr',
        sections: ['hr_overview'],
        keywords: /บุคลากร|อาจารย์|staff|hr|เกษียณ|ตำแหน่ง|ผู้บริหาร/i,
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

export function datasetTrustSnapshot(id) {
    const meta = getSharedDashboardDatasetMetaSync(id);
    const data = getSharedDashboardDatasetSync(id);
    const trustLevel = getExecutiveAdviceTrustLevel(meta, { datasetId: id });
    return {
        id,
        hasData: Boolean(data),
        isLive: Boolean(meta?.isLive),
        trustLevel,
        sourceType: meta?.sourceType || 'fallback',
        sourceLabel: getDatasetQualityText(meta),
        sourceUrl: meta?.sourceUrl || '',
        updatedAt: meta?.updatedAt || null,
    };
}

export function getAIContextBundle(question, roleOrUser, options = {}) {
    const q = String(question || '').toLowerCase();
    const role = resolveAIRole(roleOrUser);
    const matched = [];
    const denied = [];

    for (const item of AI_DATASET_REGISTRY) {
        const keywordMatch = item.keywords?.test(q);
        if (!keywordMatch && !options.includeAll) continue;
        const access = datasetAccessStatus(item, role);
        const trust = datasetTrustSnapshot(item.id);
        const row = {
            ...item,
            allowed: access.allowed,
            sections: access.sections,
            trustLevel: trust.trustLevel,
            sourceType: trust.sourceType,
            sourceLabel: trust.sourceLabel,
            sourceUrl: trust.sourceUrl,
            updatedAt: trust.updatedAt,
            hasData: trust.hasData,
            isLive: trust.isLive,
        };
        if (access.allowed) matched.push(row);
        else denied.push(row);
    }

    return {
        intentHint: options.intent || 'auto',
        role,
        contexts: matched,
        deniedSections: denied.flatMap(item => item.sections || []),
        deniedContexts: denied,
        sourceSummary: matched.map(item => ({
            id: item.id,
            label: item.label,
            trustLevel: item.trustLevel,
            sourceType: item.sourceType,
            sourceLabel: item.sourceLabel,
            chartableFields: item.chartableFields,
        })),
    };
}

export function formatAIContextBundleForPrompt(bundle) {
    if (!bundle?.contexts?.length && !bundle?.deniedContexts?.length) {
        return 'AI context registry: no matched internal dataset; use local FAQ/public fallback if allowed.';
    }
    const allowed = (bundle.contexts || [])
        .map(item => `- ${item.id}: allowed, trust=${item.trustLevel}, source=${item.sourceType}, chartable=${(item.chartableFields || []).join('|') || '-'}`)
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
