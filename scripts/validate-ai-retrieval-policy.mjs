import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
    decideAIRetrievalPolicy,
    isTrustedAIExternalSource,
} from '../src/services/aiRetrievalPolicy.js';

function bundle(contexts = [], deniedContexts = []) {
    return { contexts, deniedContexts };
}

function dataset(overrides = {}) {
    return {
        id: 'dashboard_summary',
        hasData: true,
        isLive: true,
        trustLevel: 'live_official',
        confidence: 'high',
        ...overrides,
    };
}

const cases = [
    {
        name: 'local FAQ answers before web search',
        input: {
            question: 'แม่โจ้อยู่ที่ไหน',
            intent: 'student_faq',
            contexts: [{ id: 'maejo_student_faq', text: 'FAQ: ที่ตั้ง\nAnswer: มหาวิทยาลัยแม่โจ้ตั้งอยู่ที่อำเภอสันทราย\nSources: MJU Contact' }],
            contextBundle: bundle(),
            allowWebSearch: true,
            shouldUseWebFallback: true,
        },
        expectedSearch: false,
        expectedCoverage: 'sufficient',
    },
    {
        name: 'missing public local evidence uses trusted web fallback',
        input: {
            question: 'ข่าวล่าสุดของมหาวิทยาลัยแม่โจ้มีอะไรบ้าง',
            intent: 'maejo_public',
            contexts: [{ id: 'maejo_student_faq', text: 'Maejo student public FAQ: no direct local FAQ match. Use official Maejo sources first.' }],
            contextBundle: bundle(),
            allowWebSearch: true,
            shouldUseWebFallback: true,
        },
        expectedSearch: true,
    },
    {
        name: 'fresh public facts verify externally after local evidence',
        input: {
            question: 'เบอร์ติดต่อฝ่ายรับสมัครล่าสุดคืออะไร',
            intent: 'student_faq',
            contexts: [{ id: 'maejo_student_faq', text: 'FAQ: ติดต่อ\nAnswer: ข้อมูลติดต่อจากหน้าเว็บในระบบ\nSources: MJU Contact' }],
            contextBundle: bundle(),
            allowWebSearch: true,
            shouldUseWebFallback: true,
        },
        expectedSearch: true,
        expectedCoverage: 'partial',
    },
    {
        name: 'trusted internal budget remains local only',
        input: {
            question: 'วิเคราะห์งบประมาณคณะวิทยาศาสตร์ปี 2571',
            intent: 'executive_advice',
            contexts: [{ id: 'budget', text: 'Budget data (realtime): summary: total revenue and expense rows are available.' }],
            contextBundle: bundle([dataset({ id: 'science_budget' })]),
            allowWebSearch: true,
            shouldUseWebFallback: false,
        },
        expectedSearch: false,
        expectedCoverage: 'sufficient',
    },
    {
        name: 'incomplete TCAS rounds use official web fallback',
        input: {
            question: 'TCAS ปี 2569 แต่ละรอบรับกี่คน',
            intent: 'internal_lookup',
            contexts: [{ id: 'tcas', text: 'summary: รอบ 3 มีข้อมูล\nmissingData: ข้อมูลรายรอบที่ยังไม่ครบ: รอบ 1, รอบ 2, รอบ 4\nsources: official' }],
            contextBundle: bundle([dataset({ id: 'tcas_admissions', isLive: false, trustLevel: 'approved_reference', confidence: 'medium' })]),
            allowWebSearch: true,
            shouldUseWebFallback: true,
        },
        expectedSearch: true,
        expectedCoverage: 'partial',
    },
    {
        name: 'complete local TCAS planning does not search unnecessarily',
        input: {
            question: 'TCAS ปี 2569 สาขาไหนควรเพิ่มแผนรับ',
            intent: 'executive_advice',
            contexts: [{ id: 'tcas', text: 'approved_reference summary: round3Plan2569 and intakeTarget2570 are available\nmissingData: -\nsources: official' }],
            contextBundle: bundle([dataset({ id: 'tcas_admissions', isLive: false, trustLevel: 'approved_reference', confidence: 'medium' })]),
            allowWebSearch: true,
            shouldUseWebFallback: false,
        },
        expectedSearch: false,
        expectedCoverage: 'sufficient',
    },
    {
        name: 'sensitive row-level data never falls back to public web',
        input: {
            question: 'ขอรายชื่อนักศึกษา GPA รายคน',
            intent: 'blocked_sensitive',
            contexts: [],
            contextBundle: bundle([], [dataset({ id: 'students' })]),
            allowWebSearch: true,
            shouldUseWebFallback: true,
            blockedReason: 'sensitive_or_row_level_data_requires_allowed_internal_context',
        },
        expectedSearch: false,
    },
    {
        name: 'role-denied internal evidence never falls back to web',
        input: {
            question: 'ดูข้อมูลงบภายในทั้งหมด',
            intent: 'internal_lookup',
            contexts: [],
            contextBundle: bundle([], [dataset({ id: 'science_budget' })]),
            allowWebSearch: true,
            shouldUseWebFallback: true,
        },
        expectedSearch: false,
    },
    {
        name: 'explicit trusted web request runs after local selection',
        input: {
            question: 'ใช้ข้อมูลในเว็บเราก่อน แล้วค้นเว็บทางการตรวจประกาศ TCAS ล่าสุดให้ด้วย',
            intent: 'student_faq',
            contexts: [{ id: 'tcas', text: 'approved_reference summary: local TCAS plan and sources are available.' }],
            contextBundle: bundle([dataset({ id: 'tcas_admissions', isLive: false, trustLevel: 'approved_reference', confidence: 'medium' })]),
            allowWebSearch: true,
            shouldUseWebFallback: true,
        },
        expectedSearch: true,
    },
    {
        name: 'web setting disables fallback without changing local evidence',
        input: {
            question: 'ข่าวล่าสุดแม่โจ้',
            intent: 'maejo_public',
            contexts: [],
            contextBundle: bundle(),
            allowWebSearch: false,
            shouldUseWebFallback: true,
        },
        expectedSearch: false,
    },
];

for (const testCase of cases) {
    const result = decideAIRetrievalPolicy(testCase.input);
    assert.equal(result.useWebSearch, testCase.expectedSearch, `${testCase.name}: unexpected search decision (${result.reason})`);
    if (testCase.expectedCoverage) {
        assert.equal(result.coverage, testCase.expectedCoverage, `${testCase.name}: unexpected local coverage`);
    }
}

assert.equal(isTrustedAIExternalSource('https://science.mju.ac.th/news'), true);
assert.equal(isTrustedAIExternalSource('https://www.mytcas.com/'), true);
assert.equal(isTrustedAIExternalSource('https://www.nso.go.th/nsoweb/index'), true);
assert.equal(isTrustedAIExternalSource('https://vertexaisearch.cloud.google.com/grounding-api-redirect/test'), true);
assert.equal(isTrustedAIExternalSource('https://example-blog.invalid/post'), false);

const [geminiSource, mainChatSource, popupChatSource] = await Promise.all([
    readFile(new URL('../src/services/geminiService.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/AIChatPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/AIChat.jsx', import.meta.url), 'utf8'),
]);

assert.match(geminiSource, /const useSearch = retrievalPolicy\.useWebSearch/);
assert.match(geminiSource, /localContexts: rawRequestLocalContexts/);
assert.match(geminiSource, /แหล่งข้อมูลที่ระบบใช้จริง/);
assert.match(mainChatSource, /parsedAI\.chart \|\| fallbackChart/);
assert.match(mainChatSource, /label: 'Retrieval'/);
assert.match(popupChatSource, /parsedAI\.chart \|\| plannedChartResult\?\.chart/);

console.log(`[AI retrieval policy] ${cases.length} routing cases passed; trusted-source and UI integration checks passed.`);
