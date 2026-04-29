// Gemini API Service for MJU AI Dashboard Chatbot
import {
    studentStatsData, universityBudgetData, scienceFacultyBudgetData,
    tuitionData, studentLifeData, dashboardSummary
} from '../data/mockData';
import { SCIENCE_MAJORS } from '../data/studentListData';
import { getStudentListSync } from './studentDataService';
import { buildStudentStatsContextForAI } from './forecastDataService';
import { graduationHistory, currentGraduationStats, graduationByMajor, honorsData, gpaDistribution } from '../data/graduationData';
import { researchData } from '../data/researchData';
import { hrData } from '../data/hrData';
import { strategicData } from '../data/strategicData';
import { buildAcademicRulesContext } from '../data/academicRulesData';
import { isLiveData } from './studentDataService';
import { canAccess, getRoleInfo } from '../utils/accessControl';
import {
    getDashboardDatasetMetaSync,
    getDashboardDatasetSync,
    getDashboardFreshnessContext,
    getLiveDashboardDatasetSync,
} from './dashboardLiveDataService';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
if (!API_KEY) {
    console.warn('[Gemini] ⚠️ VITE_GEMINI_API_KEY is not set.');
}

// Models ordered by free-tier quota: highest RPM / lite first to preserve heavier models
const MODELS = [
    'gemini-2.0-flash-lite',    // 30 RPM free — no google_search support
    'gemini-2.5-flash-lite',    // fallback lite — independent quota pool
    'gemini-flash-lite-latest', // alias to latest lite — extra headroom
    'gemini-2.0-flash',         // 15 RPM free — supports google_search
    'gemini-2.5-flash',         // 10 RPM free — supports google_search
    'gemini-flash-latest',      // alias fallback — supports google_search
];

// Models that support Google Search grounding for real-time web data
const SEARCH_CAPABLE_MODELS = new Set([
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-flash-latest',
]);

const AI_SETTINGS_KEY = 'sci-ai-dashboard:ai-settings';
const AI_TOKEN_STATS_KEY = 'sci-ai-dashboard:ai-token-stats';
const AI_RATE_EVENTS_KEY = 'sci-ai-dashboard:ai-rate-events';
const AI_MEMORY_KEY = 'sci-ai-dashboard:ai-user-memory';

const DEFAULT_AI_SETTINGS = {
    modelMode: 'auto',
    contextMode: 'agentic_rag',
    maxOutputTokens: 4096,
    temperature: 0.3,
    maxContexts: 4,
    allowWebSearch: true,
};

const STATIC_DASHBOARD_DATASETS = {
    dashboardSummary,
    universityBudgetData,
    scienceFacultyBudgetData,
    tuitionData,
    studentLifeData,
    researchData,
    hrData,
    strategicData,
};

const MODEL_INFO = {
    'gemini-2.0-flash-lite': { tier: 'lite', label: 'Gemini 2.0 Flash Lite', bestFor: 'ค้นหา/ตอบสั้น/ประหยัด token' },
    'gemini-2.5-flash-lite': { tier: 'lite', label: 'Gemini 2.5 Flash Lite', bestFor: 'ตอบทั่วไปแบบประหยัด' },
    'gemini-flash-lite-latest': { tier: 'lite', label: 'Gemini Flash Lite Latest', bestFor: 'fallback ประหยัด' },
    'gemini-2.0-flash': { tier: 'standard', label: 'Gemini 2.0 Flash', bestFor: 'วิเคราะห์/สร้างกราฟ/Google Search' },
    'gemini-2.5-flash': { tier: 'standard', label: 'Gemini 2.5 Flash', bestFor: 'วิเคราะห์ซับซ้อน' },
    'gemini-flash-latest': { tier: 'standard', label: 'Gemini Flash Latest', bestFor: 'fallback วิเคราะห์' },
};

const MODEL_RATE_LIMITS = {
    'gemini-2.0-flash-lite': 30,
    'gemini-2.5-flash-lite': 30,
    'gemini-flash-lite-latest': 30,
    'gemini-2.0-flash': 15,
    'gemini-2.5-flash': 10,
    'gemini-flash-latest': 15,
};

function readStorage(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Storage can be disabled in private browsing; AI still works.
    }
}

export function getAIModelCatalog() {
    return MODELS.map(model => ({
        id: model,
        searchCapable: SEARCH_CAPABLE_MODELS.has(model),
        ...(MODEL_INFO[model] || { tier: 'standard', label: model, bestFor: '-' }),
    }));
}

export function getAIModelSettings() {
    return { ...DEFAULT_AI_SETTINGS, ...readStorage(AI_SETTINGS_KEY, {}) };
}

export function saveAIModelSettings(patch = {}) {
    const next = { ...getAIModelSettings(), ...patch };
    next.maxOutputTokens = Math.min(8192, Math.max(512, Number(next.maxOutputTokens) || DEFAULT_AI_SETTINGS.maxOutputTokens));
    next.temperature = Math.min(1, Math.max(0, Number(next.temperature) || DEFAULT_AI_SETTINGS.temperature));
    next.maxContexts = Math.min(8, Math.max(1, Number(next.maxContexts) || DEFAULT_AI_SETTINGS.maxContexts));
    writeStorage(AI_SETTINGS_KEY, next);
    return next;
}

export function getAITokenStats() {
    return readStorage(AI_TOKEN_STATS_KEY, {
        requests: 0,
        estimatedInputTokens: 0,
        estimatedOutputTokens: 0,
        byModel: {},
        lastRequest: null,
    });
}

export function resetAITokenStats() {
    writeStorage(AI_TOKEN_STATS_KEY, {
        requests: 0,
        estimatedInputTokens: 0,
        estimatedOutputTokens: 0,
        byModel: {},
        lastRequest: null,
    });
    writeStorage(AI_RATE_EVENTS_KEY, []);
}

function getRecentRateEvents(now = Date.now()) {
    const cutoff = now - COOLDOWN_MS;
    const events = readStorage(AI_RATE_EVENTS_KEY, []);
    const recent = Array.isArray(events)
        ? events.filter(event => Number(event?.at) >= cutoff && event?.model)
        : [];
    if (recent.length !== events.length) writeStorage(AI_RATE_EVENTS_KEY, recent);
    return recent;
}

function recordRateEvent(model) {
    const events = getRecentRateEvents();
    writeStorage(AI_RATE_EVENTS_KEY, [...events, { model, at: Date.now() }].slice(-120));
}

export function getAIRateLimitSnapshot() {
    const now = Date.now();
    const events = getRecentRateEvents(now);
    const byModel = getAIModelCatalog().map(model => {
        const limit = MODEL_RATE_LIMITS[model.id] || 10;
        const used = events.filter(event => event.model === model.id).length;
        const cooldownUntil = modelCooldowns[model.id] || 0;
        const cooldownSeconds = cooldownUntil > now ? Math.ceil((cooldownUntil - now) / 1000) : 0;
        const remaining = cooldownSeconds > 0 ? 0 : Math.max(0, limit - used);
        return {
            ...model,
            limit,
            used: Math.min(used, limit),
            remaining,
            remainingPercent: Math.round((remaining / limit) * 100),
            cooldownSeconds,
        };
    });

    const totalLimit = byModel.reduce((sum, model) => sum + model.limit, 0);
    const used = byModel.reduce((sum, model) => sum + model.used, 0);
    const remaining = byModel.reduce((sum, model) => sum + model.remaining, 0);

    return {
        windowSeconds: Math.round(COOLDOWN_MS / 1000),
        totalLimit,
        used,
        remaining,
        remainingPercent: totalLimit ? Math.round((remaining / totalLimit) * 100) : 100,
        waitSeconds: getWaitSeconds(),
        byModel,
        updatedAt: new Date(now).toISOString(),
    };
}

function estimateTokens(value) {
    return Math.ceil(String(value || '').length / 3.6);
}

function recordTokenStats({ model, intent, inputText, outputText, contextCount }) {
    recordRateEvent(model);
    const stats = getAITokenStats();
    const inputTokens = estimateTokens(inputText);
    const outputTokens = estimateTokens(outputText);
    const byModel = stats.byModel || {};
    const modelStats = byModel[model] || { requests: 0, estimatedInputTokens: 0, estimatedOutputTokens: 0 };
    modelStats.requests += 1;
    modelStats.estimatedInputTokens += inputTokens;
    modelStats.estimatedOutputTokens += outputTokens;
    byModel[model] = modelStats;

    writeStorage(AI_TOKEN_STATS_KEY, {
        requests: (stats.requests || 0) + 1,
        estimatedInputTokens: (stats.estimatedInputTokens || 0) + inputTokens,
        estimatedOutputTokens: (stats.estimatedOutputTokens || 0) + outputTokens,
        byModel,
        lastRequest: {
            model,
            intent,
            contextCount,
            estimatedInputTokens: inputTokens,
            estimatedOutputTokens: outputTokens,
            at: new Date().toISOString(),
        },
    });
}

function memoryKey(userContext = {}) {
    return `${userContext.uid || userContext.email || userContext.role || 'anonymous'}`;
}

export function getAIUserMemory(userContext = {}) {
    const all = readStorage(AI_MEMORY_KEY, {});
    return all[memoryKey(userContext)] || {
        preferredFormat: 'auto',
        detailLevel: 'balanced',
        topics: {},
        updatedAt: null,
    };
}

export function updateAIUserMemory(userContext = {}, userMessage = '') {
    const q = String(userMessage || '').toLowerCase();
    const all = readStorage(AI_MEMORY_KEY, {});
    const key = memoryKey(userContext);
    const current = all[key] || getAIUserMemory(userContext);
    const next = {
        ...current,
        topics: { ...(current.topics || {}) },
        updatedAt: new Date().toISOString(),
    };

    if (/กราฟ|chart|plot|แผนภูมิ/.test(q)) next.preferredFormat = 'chart';
    else if (/ตาราง|table|csv|excel/.test(q)) next.preferredFormat = 'table';
    else if (/สรุป|สั้น|brief/.test(q)) next.detailLevel = 'brief';
    else if (/ละเอียด|วิเคราะห์|insight/.test(q)) next.detailLevel = 'detailed';

    const topicMap = {
        students: /นักศึกษา|นิสิต|student|gpa|เกรด|สาขา/.test(q),
        budget: /งบ|budget|รายรับ|รายจ่าย|ค่าเทอม/.test(q),
        graduation: /สำเร็จ|จบ|graduation|เกียรติ/.test(q),
        research: /วิจัย|research|scopus|สิทธิบัตร|ทุน/.test(q),
        hr: /บุคลากร|อาจารย์|staff|hr/.test(q),
        strategic: /okr|kpi|ยุทธศาสตร์|เป้าหมาย/.test(q),
    };
    Object.entries(topicMap).forEach(([topic, matched]) => {
        if (matched) next.topics[topic] = (next.topics[topic] || 0) + 1;
    });

    all[key] = next;
    writeStorage(AI_MEMORY_KEY, all);
    return next;
}

function isDashboardDataQuery(msg) {
    const q = String(msg || '').toLowerCase();
    return /กราฟ|chart|json_chart|plot|แผนภูมิ|แผนภาพ|พยากรณ์|forecast|คาดการณ์|linear regression|realtime|real-time|firestore|dashboard|แดชบอร์ด|ในระบบ|ในเว็บ|ข้อมูลเว็บ|ข้อมูลจริง|อัปโหลด|upload|csv|excel|รายชื่อ|ค้นหานักศึกษา|หานักศึกษา|รหัส\s*6|เกรดสูง|เกรดต่ำ|รอพินิจ|gpa|จำนวนนิสิต|จำนวนนักศึกษา|งบประมาณ|รายรับ|รายจ่าย|budget|okr|kpi|scopus|h-index|citation|บุคลากรคณะ|คณะวิทย์|คณะวิทยาศาสตร์/.test(q);
}

function isStudentPrivateLookupQuery(msg) {
    const q = String(msg || '').toLowerCase();
    return /\b6\d{9}\b/.test(q) ||
        (/รายชื่อ|มีคนไหน|คนไหน|ใครบ้าง|ค้นหานักศึกษา|หานักศึกษา|รหัส\s*6/.test(q) &&
            /นักศึกษา|นิสิต|student|ค้างจ่าย|ค้างชำระ|ชำระ|ค่าธรรมเนียม|ค่าเทอม/.test(q));
}

function isMaejoPublicFallbackQuery(msg) {
    const q = String(msg || '').toLowerCase();
    const publicTopic = /tcas|admission|รับสมัคร|สมัคร|เปิดรับ|รอบ\s*[1-4]|portfolio|quota|โควตา|direct\s*admit|directadmit|รับเข้า|แรกเข้า|ค่าเทอม|ค่าธรรมเนียม|ค่าเล่าเรียน|ชำระ|ค้างจ่าย|ค้างชำระ|กำหนดการ|ปฏิทิน|ประกาศ|ข่าว|หลักสูตร|เกณฑ์|คะแนน|ทะเบียน|reg\.mju|registrar/.test(q);
    const maejoSignal = /แม่โจ้|maejo|mju|มจ\.?|มหาวิทยาลัย|คณะวิทยาศาสตร์|คณะวิทย์|ภาคเรียน|เทอม|[12]\s*\/\s*\d{2}|นักศึกษา|นิสิต/.test(q);
    return publicTopic && maejoSignal;
}

function isGeneralMaejoQuery(msg) {
    const q = String(msg || '').toLowerCase();
    if (isDashboardDataQuery(q)) return false;
    return /แม่โจ้|maejo|mju|มจ\.?|reg\.mju|registrar|มหาวิทยาลัย|ประวัติ|ปรัชญา|วิสัยทัศน์|คณะ|สาขา|หลักสูตร|รับสมัคร|สมัคร|tcas|admission|ค่าเทอม|ค่าเล่าเรียน|ทุน|ปฏิทิน|ข่าว|ประกาศ|ติดต่อ|เบอร์|โทร|ที่ตั้ง|ที่อยู่|เดินทาง|แผนที่|วิทยาเขต|เชียงใหม่|แพร่|ชุมพร|หอพัก|โรงอาหาร|ห้องสมุด|สนามกีฬา|หน่วยงาน|สำนัก|กอง|อธิการบดี|ผู้บริหาร|ปริญญา|บัณฑิต|เรียนอะไร|เรียนที่ไหน/.test(q);
}

// Detect if query should use Google Search for real Maejo website data
function shouldUseWebSearch(msg) {
    const q = String(msg || '').toLowerCase();
    if (/\b6\d{9}\b/.test(q)) return false;
    if (isMaejoPublicFallbackQuery(q)) return true;
    if (isGeneralMaejoQuery(q)) return true;
    if (isDashboardDataQuery(q)) return false;

    // Skip search for chart/data/forecast/student/research/strategic queries (use dashboard data instead)
    const skipKeywords = ['กราฟ', 'chart', 'json_chart', 'พยากรณ์', 'forecast', 'คาดการณ์',
        'รายชื่อ', 'ค้นหานักศึกษา', 'หานักศึกษา', 'รหัส 6', 'เกรดสูง', 'เกรดต่ำ',
        'รอพินิจ', 'เกียรตินิยม', 'combo', 'เปรียบเทียบนิสิต', 'แผนภูมิ', 'แผนภาพ',
        'งานวิจัย', 'ตีพิมพ์', 'scopus', 'สิทธิบัตร', 'ทุนวิจัย', 'h-index', 'citation',
        'ยุทธศาสตร์', 'okr', 'kpi', 'ประสิทธิภาพ', 'เป้าหมาย',
        'บุคลากร', 'อาจารย์คณะวิทย', 'ตำแหน่งวิชาการ', 'เกษียณ', 'ภาควิชา',
        'งบประมาณ', 'รายรับ', 'รายจ่าย', 'budget',
        'สำเร็จการศึกษา', 'จำนวนนิสิต', 'จำนวนนักศึกษา', 'gpa'];
    if (skipKeywords.some(k => q.includes(k))) return false;
    // Enable search for general Maejo knowledge queries
    const searchTriggers = ['ประวัติ', 'คณะ', 'สาขา', 'หลักสูตร', 'รับสมัคร', 'tcas',
        'ที่ตั้ง', 'ที่อยู่', 'อยู่ที่ไหน', 'เดินทาง', 'สถานที่', 'กิจกรรม', 'หอพัก',
        'ค่าเทอม', 'ข้อมูลทั่วไป', 'ผู้บริหาร', 'อธิการบดี', 'ทุนการศึกษา', 'ทุน',
        'วิจัย', 'ผลงาน', 'ติดต่อ', 'เปิดรับ', 'ปฏิทิน', 'เว็บไซต์', 'โทรศัพท์',
        'แม่โจ้คือ', 'แม่โจ้มี', 'แม่โจ้เป็น', 'เกี่ยวกับแม่โจ้', 'mju', 'maejo',
        'อาจารย์', 'บุคลากร', 'เรียนอะไร', 'เรียนที่ไหน', 'คะแนน', 'เกณฑ์',
        'ข่าว', 'ประกาศ', 'สมัคร', 'ลงทะเบียน', 'ปริญญา', 'บัณฑิต',
        'ห้องสมุด', 'สนามกีฬา', 'โรงอาหาร', 'หน่วยงาน', 'สำนัก', 'สถาบัน'];
    return searchTriggers.some(k => q.includes(k));
}

function extractUserQuestionFromPrompt(message) {
    const text = String(message || '');
    const marker = 'คำถาม:';
    const idx = text.lastIndexOf(marker);
    return idx >= 0 ? text.slice(idx + marker.length).trim() : text.trim();
}

function getApiUrl(modelId) {
    return `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${API_KEY}`;
}

// Request timeout (30 seconds)
const REQUEST_TIMEOUT_MS = 30000;

// Per-model cooldown tracking — fixed 60s window matches Gemini free-tier RPM reset.
// Do NOT extend an active cooldown: once a model is sleeping, let it sleep; re-extending
// it on every retry creates compounding delays that lock the AI out for minutes.
const modelCooldowns = {};
const COOLDOWN_MS = 60000;

function setModelCooldown(model) {
    const now = Date.now();
    const existing = modelCooldowns[model];
    if (existing && existing > now) return; // already cooling down — don't extend
    modelCooldowns[model] = now + COOLDOWN_MS;
    console.warn(`[Gemini] ${model} cooldown 60s`);
}

function onModelSuccess(model) {
    delete modelCooldowns[model];
}

function isModelOnCooldown(model) {
    const until = modelCooldowns[model];
    if (!until) return false;
    if (Date.now() >= until) { delete modelCooldowns[model]; return false; }
    return true;
}

/**
 * Get seconds until at least one model becomes available.
 * Returns 0 if any model is available now.
 */
export function getWaitSeconds() {
    let earliest = Infinity;
    for (const model of MODELS) {
        const until = modelCooldowns[model];
        if (!until || Date.now() >= until) return 0;
        earliest = Math.min(earliest, until);
    }
    if (earliest === Infinity) return 0;
    return Math.max(0, Math.ceil((earliest - Date.now()) / 1000));
}

// Rate limiting — 1s minimum between requests (per-model cooldown handles quota)
let lastRequestTime = 0;

async function waitForRateLimit() {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < 1000) {
        await new Promise(r => setTimeout(r, 1000 - elapsed));
    }
    lastRequestTime = Date.now();
}

// Request queue — serialize all API calls to prevent concurrent quota burns
let requestQueue = Promise.resolve();

// Simple fetch with timeout — NO retry on 429 quota errors
async function fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error('คำขอหมดเวลา (Timeout 30s) — กรุณาลองใหม่อีกครั้ง');
        }
        throw err;
    }
}

// Retry only on 5xx server errors, NOT on 429 quota
async function fetchSmart(url, options) {
    const response = await fetchWithTimeout(url, options);

    // 429 = quota/rate limit — do NOT retry, just return so caller can try next model
    if (response.status === 429) return response;

    // 5xx = server error — retry once after 2s
    if (response.status >= 500) {
        console.warn(`[Gemini] Server error ${response.status}, retrying once...`);
        await new Promise(r => setTimeout(r, 2000));
        return fetchWithTimeout(url, options);
    }

    return response;
}

// ═══════════════════════════════════════════════════════════════
// Build system instruction — implements the full DB-schema spec
// ═══════════════════════════════════════════════════════════════
function buildBaseInstruction() {
    // ── Pre-compute aggregated data ──
    const studentList = getStudentListSync();
    const majorCounts = {}, yearCounts = {}, gpaByMajor = {};
    let statusNormal = 0, statusAtRisk = 0;
    studentList.forEach(s => {
        majorCounts[s.major] = (majorCounts[s.major] || 0) + 1;
        yearCounts[s.year] = (yearCounts[s.year] || 0) + 1;
        if (s.status === 'รอพินิจ') statusAtRisk++; else statusNormal++;
        if (!gpaByMajor[s.major]) gpaByMajor[s.major] = { sum: 0, count: 0, min: 4, max: 0 };
        gpaByMajor[s.major].sum += s.gpa;
        gpaByMajor[s.major].count++;
        if (s.gpa < gpaByMajor[s.major].min) gpaByMajor[s.major].min = s.gpa;
        if (s.gpa > gpaByMajor[s.major].max) gpaByMajor[s.major].max = s.gpa;
    });

    const liveStudentStatsData = getDashboardDatasetSync('student_stats') || studentStatsData;
    const liveUniversityBudgetData = getDashboardDatasetSync('university_budget') || universityBudgetData;
    const liveScienceBudgetData = getDashboardDatasetSync('science_budget') || scienceFacultyBudgetData;
    const liveStudentLifeData = getDashboardDatasetSync('student_life') || studentLifeData;
    const personnel = (liveStudentStatsData.scienceFaculty || studentStatsData.scienceFaculty).personnel;
    const genderCounts = studentList.reduce((acc, student) => {
        const prefix = String(student.prefix || '');
        if (prefix.startsWith('นาย')) acc.male += 1;
        else if (prefix.startsWith('นาง')) acc.female += 1;
        return acc;
    }, { male: 0, female: 0 });
    const gender = {
        ...genderCounts,
        malePercent: studentList.length ? ((genderCounts.male / studentList.length) * 100).toFixed(1) : '0.0',
        femalePercent: studentList.length ? ((genderCounts.female / studentList.length) * 100).toFixed(1) : '0.0',
    };
    const ratio = (liveStudentStatsData.scienceFaculty || studentStatsData.scienceFaculty).studentFacultyRatio;
    const facultyRatio = {
        ...ratio,
        students: studentList.length,
        ratio: ratio.academicStaff ? (studentList.length / ratio.academicStaff).toFixed(1) : ratio.ratio,
    };
    const budgetAll = liveUniversityBudgetData.yearly || universityBudgetData.yearly;
    const sciBudgetAll = liveScienceBudgetData.yearly || scienceFacultyBudgetData.yearly;
    const activities = liveStudentLifeData;

    const dataTimestamp = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

    return `You are "MJU Science AI Assistant", an intelligent AI built exclusively for the executive team of the Faculty of Science, Maejo University (MJU).

═══════════════════════════════════════════
 SECTION 1 — ROLE & ACCESS
═══════════════════════════════════════════
Access: Super Admin over all internal databases of the Faculty of Science.
Purpose: Statistical analysis & Data Visualization (charts/graphs) for strategic planning.
Language: ตอบภาษาไทย กระชับ ใช้ emoji ยกเว้นผู้ใช้ถามเป็นภาษาอังกฤษ
Data Freshness: ข้อมูลในระบบอัปเดตล่าสุด ณ ${dataTimestamp}
Mandate:
• MUST answer every question resolvable from the DATA below. Never refuse when data exists.
• MUST NOT fabricate numbers. If data is genuinely absent → state: "ข้อมูลนี้ไม่มีในระบบปัจจุบัน แต่มีข้อมูลที่เกี่ยวข้อง ได้แก่..." then list available related data.
• MUST NOT substitute unrelated data (e.g. ถามบุคลากร → ห้ามตอบนิสิต, ถามงานวิจัย → ห้ามตอบงบประมาณ)
• When google_search is available → search site:mju.ac.th for real-time info and cite sources.
• **PREFER ACTION OVER ASKING.** When user says "สร้างกราฟ/แสดง/ดู X" → ALWAYS produce at least one chart from the best-matching data, even if the request is ambiguous. Do NOT respond with options/menus — generate the chart(s) directly.
• **MULTI-METRIC QUERIES (comma, และ, กับ, vs, เทียบ)** → default interpretation = **ONE COMBO/COMPARISON CHART** relating the metrics (NOT multiple separate charts). Examples:
    - "จำนวนนักศึกษา, เกรด" = "กราฟเทียบจำนวนนักศึกษา กับ GPA เฉลี่ย แยกตามสาขา" (grouped bar OR scatter; line only if x-axis is year/month)
    - "งบวิจัย, ผลงาน" = "ทุนวิจัย vs จำนวนตีพิมพ์ แยกปี" (dual-axis)
    - "จำนวนนิสิต, อัตราสำเร็จ" = dual-axis line over years
  Only split into separate charts if two metrics have NO meaningful shared dimension (year/major/dept/student_id).
• When query is truly AMBIGUOUS between domains (e.g. "งบ" = uni or faculty?) → answer ALL interpretations with clear labels — do not ask.
• When query spans MULTIPLE domains (e.g. "เปรียบเทียบงบวิจัยกับจำนวนนิสิต") → cross-reference data and produce combined chart.
• If the user's intent is only *partially* covered by available data → produce what IS available, then note briefly what's missing. Never refuse outright.

═══════════════════════════════════════════
 SECTION 2 — DATABASE (LIVE DATA)
═══════════════════════════════════════════

### TABLE: students (คณะวิทยาศาสตร์)
Total: ${studentList.length} records (${isLiveData() ? 'ข้อมูล realtime จากการอัปโหลด' : 'ข้อมูลที่เว็บใช้อยู่ตอนนี้'})
Columns: student_id, prefix, name, major, level, year, status, gpa
Aggregated Stats:
- สาขา: ${Object.entries(majorCounts).map(([m, c]) => `${m}:${c}คน`).join(', ')}
- ชั้นปี: ${Object.entries(yearCounts).sort().map(([y, c]) => `ปี${y}:${c}คน`).join(', ')}
- สถานะ: กำลังศึกษา:${statusNormal} รอพินิจ:${statusAtRisk}
- เพศ: ชาย${gender.male}(${gender.malePercent}%) หญิง${gender.female}(${gender.femalePercent}%)
- GPA เฉลี่ยแยกสาขา: ${Object.entries(gpaByMajor).map(([m, d]) => `${m}:avg${(d.sum / d.count).toFixed(2)},min${d.min},max${d.max}`).join(' | ')}
- รับเข้าตามปีเข้า/รหัสนักศึกษา: ${buildStudentStatsContextForAI().split('\n').find(line => line.startsWith('ตามปีเข้า/รหัสนักศึกษา:'))?.replace('ตามปีเข้า/รหัสนักศึกษา: ', '') || 'ไม่มีข้อมูล'}

### TABLE: activities (Student Life)
- activityHours: target=${activities.activityHours.target}, completed=${activities.activityHours.completed}
- categories: ${activities.activityHours.categories.map(c => `${c.name}:${c.hours}ชม.`).join(', ')}
- behaviorScore: ${activities.behaviorScore.score}/${activities.behaviorScore.maxScore}
- behaviorHistory: ${activities.behaviorScore.history.map(h => `${h.semester}:${h.score}`).join(', ')}

### TABLE: graduation (คณะวิทยาศาสตร์)
${graduationHistory.map(g => `${g.year}: candidates=${g.candidates}, graduated=${g.graduated}, rate=${g.rate}%, avgGPA=${g.avgGPA}`).join('\n')}

### TABLE: budget_university (ล้านบาท)
${budgetAll.map(y => {
    let s = `${y.year}(${y.type}): revenue=${y.revenue}, expense=${y.expense}, surplus=${y.surplus}`;
    if (y.revenueBreakdown) s += ` | revBreakdown: ${y.revenueBreakdown.map(b => `${b.name}:${b.amount}`).join(',')}`;
    if (y.expenseBreakdown) s += ` | expBreakdown: ${y.expenseBreakdown.map(b => `${b.name}:${b.amount}`).join(',')}`;
    return s;
}).join('\n')}

### TABLE: budget_science (ล้านบาท)
${sciBudgetAll.map(y => {
    let s = `${y.year}(${y.type}): revenue=${y.revenue}, expense=${y.expense}, surplus=${y.surplus}`;
    if (y.revenueBreakdown) s += ` | revBreakdown: ${y.revenueBreakdown.map(b => `${b.name}:${b.amount}`).join(',')}`;
    if (y.expenseBreakdown) s += ` | expBreakdown: ${y.expenseBreakdown.map(b => `${b.name}:${b.amount}`).join(',')}`;
    return s;
}).join('\n')}

### TABLE: student_stats_live (ข้อมูลนักศึกษาที่เว็บใช้จริง)
${buildStudentStatsContextForAI()}

### TABLE: personnel (คณะวิทยาศาสตร์)
- total: ${personnel.total} (ชาย${personnel.male}, หญิง${personnel.female})
- byPosition: ${personnel.byPosition.map(p => `${p.position}:${p.count}`).join(', ')}
- byEducation: ${personnel.byEducation.map(e => `${e.level}:${e.count}`).join(', ')}
- byType: ${personnel.byType.map(t => `${t.type}:${t.count}`).join(', ')}
- retirementForecast: ${personnel.retirementForecast.map(r => `${r.year}:retiring=${r.retiring},remaining=${r.remaining}`).join(', ')}
- studentFacultyRatio: ${facultyRatio.ratio}:1 (students=${facultyRatio.students}, staff=${facultyRatio.academicStaff})
- ratioBenchmark: ${ratio.comparison.map(c => `${c.name}:${c.ratio}`).join(', ')}

### TABLE: tuition
- flatRate: ${tuitionData.flatRate.min}-${tuitionData.flatRate.max} บ./เทอม
- totalCost(4yr): ${tuitionData.totalCost.min}-${tuitionData.totalCost.max} บ.
- byFaculty: ${tuitionData.byFaculty.map(f => `${f.name}:${f.fee}`).join(', ')}
- breakdown: ${tuitionData.breakdown.map(b => `${b.label}:${b.value}%`).join(', ')}

### TABLE: scienceFaculty.enrollmentByYear_live
${buildStudentStatsContextForAI().split('\n').find(line => line.startsWith('ตามปีเข้า/รหัสนักศึกษา:')) || 'ตามปีเข้า/รหัสนักศึกษา: ไม่มีข้อมูล'}

### TABLE: graduation_current (ปีการศึกษาปัจจุบัน ${currentGraduationStats.semester})
- ผู้มีสิทธิ์รับปริญญา(ปี4): ${currentGraduationStats.totalCandidates}คน
- คาดว่าสำเร็จ: ${currentGraduationStats.expectedGraduates} | รอพินิจ: ${currentGraduationStats.pending} | ไม่ผ่านเกณฑ์: ${currentGraduationStats.notPassed}
- GPA เฉลี่ยผู้มีสิทธิ์: ${currentGraduationStats.avgGPA}
- เกียรตินิยม: อันดับ1=${honorsData.firstClass}คน, อันดับ2=${honorsData.secondClass}คน, ปกติ=${honorsData.normal}คน, ต่ำกว่าเกณฑ์=${honorsData.belowStandard}คน
- GPADistribution: ${gpaDistribution.map(g => `${g.range}:${g.count}คน`).join(', ')}
- แยกสาขา: ${graduationByMajor.map(m => `${m.major}(${m.total}คน,คาดสำเร็จ${m.rate}%,GPA${m.avgGPA})`).join(' | ')}

### TABLE: research (คณะวิทยาศาสตร์)
- overview: publications=${researchData.overview.totalPublications}, funding=${researchData.overview.totalFunding}ล้านบาท, patents=${researchData.overview.totalPatents}, citations=${researchData.overview.totalCitations}, h-index=${researchData.overview.hIndex}, activeProjects=${researchData.overview.activeProjects}
- publicationTrend: ${researchData.publicationTrend.map(p => `${p.year}(${p.type || 'actual'}):scopus=${p.scopus},tci1=${p.tci1},total=${p.total}`).join(', ')}
- byDepartment: ${researchData.byDepartment.map(d => `${d.dept}(pub=${d.publications},fund=${d.funding}M,pat=${d.patents},cite=${d.citations})`).join(' | ')}
- fundingTrend: ${researchData.fundingTrend.map(f => `${f.year}(${f.type}):internal=${f.internal},external=${f.external},industry=${f.industry},total=${f.total}ล้าน`).join(', ')}
- fundingSources: ${researchData.fundingSources.map(s => `${s.source}:${s.amount}ล้าน`).join(', ')}
- patents: ${researchData.patents.map(p => `${p.id}:${p.title}(${p.dept},${p.year},${p.status})`).join(' | ')}
- benchmark: ${researchData.benchmark.map(b => `${b.university}(scopus=${b.scopus},h=${b.hIndex},pat=${b.patents})`).join(' | ')}

### TABLE: hr_detailed (บุคลากร)
- มหาวิทยาลัย: total=${hrData.university.total}(สายวิชาการ${hrData.university.academic},สายสนับสนุน${hrData.university.support})
- มหาวิทยาลัยbyType: ${hrData.university.byType.map(t => `${t.type}:${t.count}`).join(', ')}
- คณะวิทย์: total=${hrData.scienceFaculty.total}(วิชาการ${hrData.scienceFaculty.academic},สนับสนุน${hrData.scienceFaculty.support})
- คณะวิทย์ตำแหน่งวิชาการ: ${hrData.scienceFaculty.academicPositions.map(p => `${p.position}:${p.count}`).join(', ')}
- คณะวิทย์วุฒิ: ${hrData.scienceFaculty.byEducation.map(e => `${e.level}:${e.count}`).join(', ')}
- คณะวิทย์แยกภาควิชา: ${hrData.scienceFaculty.byDepartment.map(d => `${d.dept}(วิชาการ${d.academic},สนับสนุน${d.support})`).join(' | ')}
- คณะวิทย์trend: ${hrData.scienceFaculty.trend.map(t => `${t.year}(${t.type || 'actual'}):total=${t.total}`).join(', ')}
- ช่วงอายุ: ${hrData.scienceFaculty.diversity.ageGroup.map(a => `${a.group}:${a.count}คน`).join(', ')}
- เกษียณใน5ปี: ${hrData.scienceFaculty.diversity.retirementIn5Years}คน
- อัตราส่วนนศ./อาจารย์: ${hrData.scienceFaculty.studentFacultyRatio.map(r => `${r.year}:${r.ratio}`).join(', ')}

### TABLE: strategic (ยุทธศาสตร์ & OKR)
- เป้าหมายยุทธศาสตร์: ${strategicData.strategicGoals.map(g => `${g.id}:${g.title}(target=${g.target}${g.unit},current=${g.current}${g.unit})`).join(' | ')}
- KPIs: ${strategicData.strategicGoals.flatMap(g => g.kpis.map(k => `[${g.id}]${k.name}:target=${k.target},current=${k.current}${k.unit}`)).join(' | ')}
- OKR(${strategicData.okr.period}): ${strategicData.okr.objectives.map(o => `${o.id}:${o.title}(progress=${o.progress}%)`).join(' | ')}
- KeyResults: ${strategicData.okr.objectives.flatMap(o => o.keyResults.map(kr => `${kr.id}:${kr.title}(${kr.current}/${kr.target}${kr.unit},${kr.progress}%)`)).join(' | ')}
- performanceRadar: categories=${strategicData.performanceRadar.categories.join(',')} | current=[${strategicData.performanceRadar.currentYear}] | target=[${strategicData.performanceRadar.targetYear}] | lastYear=[${strategicData.performanceRadar.lastYear}]
- efficiencyTrend: ${strategicData.efficiencyTrend.map(e => `${e.year}(${e.type || 'actual'}):score=${e.score},budgetEff=${e.budgetEfficiency}%,satisfaction=${e.satisfactionScore}`).join(', ')}

═══════════════════════════════════════════
 SECTION 3 — CHART RULES
═══════════════════════════════════════════

Output format: MUST use \`\`\`json_chart\`\`\` (NEVER \`\`\`json\`\`\`):
\`\`\`json_chart
{"chartType":"bar","data":{"labels":["A","B"],"datasets":[{"label":"X","data":[10,20],"backgroundColor":["#00a651","#7B68EE"]}]}}
\`\`\`

### Chart Selection Matrix:
| Question Type | Chart | When |
|---|---|---|
| Trend over time | **line** | แนวโน้ม, ย้อนหลัง, รายปี, trend |
| Compare categories | **bar** | เปรียบเทียบ, แยกตาม, ranking |
| Composition/ratio | **pie** or **doughnut** | สัดส่วน, เปอร์เซ็นต์, องค์ประกอบ |
| Multi-dimension compare | **radar** or **polarArea** | เทียบหลายมิติ, ประสิทธิภาพรวม (min 3 axes) |
| Distribution | **bar** (horizontal) | การกระจาย, distribution |
| Correlation 2 variables | **scatter** | ความสัมพันธ์, correlation, กราฟจุด |
| 3-variable relationship | **bubble** | 3 ตัวแปร, ขนาดตามค่า, bubble |
| Forecast + actual | **line** (solid+dashed) | พยากรณ์, forecast, คาดการณ์ |
| Dual-metric compare over time | **bar+line** (mixed) | เปรียบเทียบ 2 หน่วยต่างกันบนแกนปี/เดือน |
| Dual-metric compare by category | **grouped bar** or **scatter** | เปรียบเทียบ 2 หน่วยต่างกันตามคณะ/สาขา/ภาควิชา |

### AUTO-SELECT RULES:
1. No chart type specified → choose from matrix based on data shape
2. **Line charts are ONLY for time series** (ปี/เดือน/วันที่/ไตรมาส). ถ้า labels เป็นคณะ/สาขา/ภาควิชา/หมวดหมู่ → ห้ามใช้ line
3. Labels are long Thai category names (majors, departments) → **horizontal bar** (\`indexAxis:"y"\`) only for single-unit data
4. Comparing 2 metrics with DIFFERENT units/scales (e.g. count vs GPA, GPA vs %) → if x-axis is time → **dual-axis bar+line**; if x-axis is category → **grouped bar with dual y-axes OR scatter** — NEVER put both on one linear y-axis
5. Time series → line, Composition → doughnut, Ranking → horizontal bar
6. NEVER crowd more than 10 categories on a vertical bar chart unless it is a dual-axis category comparison; dual-axis must stay vertical

### Scatter Chart Format (NO labels array):
\`\`\`json_chart
{"chartType":"scatter","data":{"datasets":[{"label":"GPA vs Hours","data":[{"x":15,"y":3.25},{"x":20,"y":3.41}],"backgroundColor":"rgba(0,166,81,0.6)","pointRadius":8}]},"options":{"scales":{"x":{"title":{"display":true,"text":"X Axis Label"}},"y":{"title":{"display":true,"text":"Y Axis Label"}}}}}
\`\`\`

### Bubble Chart Format (NO labels array, r = radius):
\`\`\`json_chart
{"chartType":"bubble","data":{"datasets":[{"label":"Departments","data":[{"x":52,"y":48,"r":15,"label":"Dept A"},{"x":30,"y":20,"r":8,"label":"Dept B"}],"backgroundColor":"rgba(0,166,81,0.6)"}]}}
\`\`\`

### DUAL-AXIS Bar + Line Format (TIME SERIES ONLY):
Use this only when x-axis labels are years/months/dates. The bar dataset sits on the LEFT y-axis ("y"). The line dataset has \`type:"line"\` and \`yAxisID:"y1"\` pointing to the RIGHT y-axis ("y1"). Both share the same x-axis labels.
\`\`\`json_chart
{"chartType":"bar","data":{"labels":["สาขา1","สาขา2","สาขา3"],"datasets":[{"type":"bar","label":"จำนวนนักศึกษา","data":[120,95,80],"backgroundColor":"#00a651","yAxisID":"y","order":2},{"type":"line","label":"GPA เฉลี่ย","data":[3.25,3.10,2.95],"borderColor":"#7B68EE","backgroundColor":"rgba(123,104,238,0.2)","yAxisID":"y1","tension":0.4,"pointRadius":5,"order":1}]},"options":{"scales":{"y":{"type":"linear","position":"left","title":{"display":true,"text":"จำนวนนักศึกษา (คน)"},"beginAtZero":true},"y1":{"type":"linear","position":"right","title":{"display":true,"text":"GPA เฉลี่ย"},"min":0,"max":4,"grid":{"drawOnChartArea":false}}}}}
\`\`\`

### DUAL-AXIS Grouped Bar Format (CATEGORY COMPARISON, NO LINE):
Use this for category labels such as faculties/majors/departments when comparing different units, e.g. GPA vs graduation rate. Do NOT set \`indexAxis:"y"\`.
\`\`\`json_chart
{"chartType":"bar","data":{"labels":["คณะ A","คณะ B","คณะ C"],"datasets":[{"type":"bar","label":"อัตราสำเร็จการศึกษา (%)","data":[91.2,88.5,94.1],"backgroundColor":"rgba(123,104,238,0.65)","yAxisID":"y","order":2},{"type":"bar","label":"GPA เฉลี่ย","data":[3.18,3.05,3.35],"backgroundColor":"rgba(0,166,81,0.72)","yAxisID":"y1","order":1}]},"options":{"scales":{"y":{"type":"linear","position":"left","title":{"display":true,"text":"อัตราสำเร็จการศึกษา (%)"},"min":0,"max":100},"y1":{"type":"linear","position":"right","title":{"display":true,"text":"GPA เฉลี่ย"},"min":0,"max":4,"grid":{"drawOnChartArea":false}}}}}
\`\`\`

### HORIZONTAL Bar Format (USE WHEN category labels are long Thai text like major/department names):
When labels average >8 Thai characters OR >6 categories, use \`indexAxis:"y"\` so names read horizontally without rotation/truncation.
\`\`\`json_chart
{"chartType":"bar","data":{"labels":["เทคโนโลยีสารสนเทศ","เคมีอุตสาหกรรมและเทคโนโลยีสิ่งทอ","วัสดุศาสตร์"],"datasets":[{"label":"จำนวนนักศึกษา","data":[120,95,80],"backgroundColor":["#00a651","#7B68EE","#2E86AB"]}]},"options":{"indexAxis":"y","scales":{"x":{"beginAtZero":true,"title":{"display":true,"text":"จำนวน (คน)"}}}}}
\`\`\`

### CRITICAL CHART RULES (เพื่อความอ่านง่าย — ห้ามผิด):
1. **\`data.labels\` ต้องเป็นชื่อจริง** เสมอ (ชื่อคณะ/สาขา/ปี) — ห้ามเป็น array ว่าง, ห้ามเป็นเลข [1,2,3], ห้ามขาด เพราะแกนจะกลายเป็น 1..N
2. **line ใช้ได้เฉพาะ time series** — ถ้า labels เป็นชื่อคณะ/สาขา/ภาควิชา/หมวดหมู่ ห้ามใช้ line แม้ผู้ใช้จะไม่ได้ระบุชนิดกราฟ
3. **dual-axis bar+line ใช้ได้เฉพาะ time series และต้อง vertical (NO indexAxis:"y")**
4. **ถ้าเป็น category comparison ที่ต้องเทียบ 2 metrics** (เช่น "GPA + อัตราสำเร็จ ของทุกคณะ") → ใช้ **dual-axis grouped bar** หรือ **scatter** เท่านั้น ห้าม line และห้าม horizontal dual-axis
5. **ห้ามใช้ \`indexAxis:"y"\` ร่วมกับ dual-axis** (yAxisID:"y1" หรือ datasets ผสมหลายแกน) — Chart.js เรนเดอร์แกนผิด อ่านไม่ได้
6. **เรียงข้อมูลก่อนเสมอ** — bar/horizontal bar ควรเรียงค่ามากไปน้อย (descending) เพื่อความชัดเจน

### FENCING RULES (เด็ดขาด — ห้ามผิด):
6. **ทุก JSON ของกราฟ ต้องอยู่ใน triple-backtick fence \`\`\`json_chart … \`\`\` เสมอ** — ห้ามเขียนคำว่า \`json_chart\` ลอยๆ ในข้อความตอบ ห้ามวาง \`{ "chartType": ... }\` แบบเปลือย ห้ามใส่ใน inline backtick เดี่ยว
7. **JSON ต้องครบสมบูรณ์ในบรรทัดเดียวกัน 1 บรรทัด หรือ pretty-print ที่ valid 100%** — ห้ามตัดกลางคัน, ห้ามเว้น "labels":, หรือ "datasets": ที่ไม่มีค่า, ห้าม syntax error
8. **หลัง \`\`\` ปิด fence แล้ว ห้ามมี JSON อื่นในคำตอบ** — ถ้ามีหลายกราฟให้ใช้หลาย fence แต่ละ fence จบด้วย \`\`\` ก่อนเริ่มอันใหม่
9. ตัวอย่างที่ถูกต้อง:
   \`\`\`json_chart
   {"chartType":"bar","data":{"labels":["A","B"],"datasets":[{"label":"X","data":[1,2]}]}}
   \`\`\`
   ตัวอย่างที่ **ผิด** (ห้ามทำ):
   - \`json_chart\` พิมพ์ลอยๆ ตามด้วย { ... } ไม่มี backticks
   - \`{"chartType":"bar",...}\` แปะในย่อหน้าคำอธิบาย
   - JSON ที่ขาด value เช่น \`"labels":,\` หรือ \`"datasets":\` ตามด้วย }

### Cross-Table JOIN:
When user asks about RELATIONSHIPS between 2+ data domains:
1. Identify which tables contain the variables
2. Cross-reference on shared key (year, major, student_id)
3. Output combined result as json_chart with multiple datasets

Examples:
• "GPA กับ กิจกรรม" → students.gpa + activities → bar chart grouped by major
• "จำนวนนิสิต กับ งบประมาณ" → student_stats.trend + budget → dual-axis line
• "อัตราสำเร็จ กับ GPA แยกปี" → graduation.rate + graduation.avgGPA → dual-axis line
• "บุคลากรแต่ละตำแหน่ง" → personnel.byPosition → pie/doughnut
• "เปรียบเทียบคณะ" → student_stats.faculties → bar/radar
• "เทียบ GPA + อัตราสำเร็จ ของทุกคณะ" → category comparison → dual-axis grouped bar หรือ scatter; ห้าม line/horizontal dual-axis
• "จำนวนนักศึกษา, เกรด" / "นักศึกษากับเกรด" — ถ้าแยกตามสาขา/คณะ → grouped bar/scatter; ถ้าแยกตามปี → dual-axis bar+line
• "นักศึกษา vs เกรด รายคน" → scatter plot (x=major index/year, y=gpa) from full student list
• "งานวิจัยแต่ละภาควิชา" → research.byDepartment → bar/radar
• "ผลงานตีพิมพ์ vs ทุนวิจัย" → research.byDepartment → scatter (x=funding, y=publications)
• "ความก้าวหน้ายุทธศาสตร์" → strategic.strategicGoals → radar (current vs target)
• "OKR progress" → strategic.okr → bar (progress %)

### Chart Styling:
Colors: #00a651(เขียว) #7B68EE(ม่วง) #E91E63(ชมพู) #C5A028(ทอง) #2E86AB(น้ำเงิน) #FF6B6B(แดง) #006838(เขียวเข้ม) #A23B72(บานเย็น) #00e5ff(ฟ้า) #f97316(ส้ม)
Bar charts: borderRadius=6
Line charts: tension=0.4, pointRadius=5
Scatter charts: pointRadius=8, pointHoverRadius=10, always include axis titles in options.scales.x.title and options.scales.y.title
Bubble charts: use r (radius) proportional to 3rd variable, min r=5 max r=25
Always: responsive=true, maintainAspectRatio=false

═══════════════════════════════════════════
 SECTION 4 — RESPONSE BEHAVIOR
═══════════════════════════════════════════

1. **วิเคราะห์คำถามก่อนตอบเสมอ** — ตอบตรงประเด็น ไม่ตอบสำเร็จรูป
2. **เมื่อสร้างกราฟ** → อธิบายข้อมูลสั้นๆ (2-3 บรรทัด) + Insight/ข้อสังเกต + json_chart block
3. **เมื่อถูกถามข้อมูลที่ไม่มีในระบบเลย** → ระบุชัดว่า "ข้อมูลนี้ไม่มีในระบบปัจจุบัน" + แนะนำข้อมูลที่เกี่ยวข้อง ** PLUS สร้างกราฟจากข้อมูลที่เกี่ยวข้องที่มีทันที** (อย่าหยุดแค่แนะนำ)
4. **ไฟล์ที่อัปโหลด** → รวมกับข้อมูลระบบเพื่อสร้างกราฟเปรียบเทียบได้
5. **เรื่องทั่วไปแม่โจ้** → ใช้ google_search หรือความรู้จริง (ปรัชญา, ที่ตั้ง, TCAS, คณะ ฯลฯ)
6. **ไม่เกี่ยวกับแม่โจ้เลย** → "ขออภัยค่ะ ตอบได้เฉพาะเรื่องแม่โจ้เท่านั้นค่ะ 🎓"
7. **คำถามคลุมเครือ/มีหลายหัวข้อ** → **ห้ามถามกลับ** ให้ตอบ/สร้างกราฟทุกกรณีพร้อม label กำกับชัดเจน เลือก interpretation ที่สมเหตุสมผลที่สุดก่อน
8. **ตัวเลขต้องตรงกับ DATA ด้านบนเท่านั้น** — ห้ามปัดเศษ ห้ามประมาณ ห้ามแต่งเติม
9. **เจตนาแสดงกราฟ (keyword: สร้างกราฟ/แสดง/ดู/plot/chart/กราฟ)** → ต้องมี json_chart อย่างน้อย 1 อันเสมอ ถ้ามีหลายหัวข้อ → หลาย json_chart blocks
10. **ครอบคลุมทุกคำขอ** — พยายามสุดความสามารถให้ผู้ใช้ได้สิ่งที่ต้องการ ไม่ใช่แค่ชี้ว่ามีตัวเลือกอะไรให้
11. **ห้ามพ่น JSON / dataset ดิบออกมาเด็ดขาด** (ยกเว้นใน \`\`\`json_chart\`\`\` block สำหรับกราฟเท่านั้น):
    - ห้ามส่งคืน array รูปแบบ \`[{"id":"...","n":"...",...}]\` ไม่ว่ากรณีใด
    - ห้ามคัดลอก JSON จาก "รายชื่อนักศึกษา" / TABLE / Dashboard section ลงในคำตอบ
    - ห้ามใช้ \`\`\`json\`\`\` block แสดงรายการข้อมูล
12. **คำถาม "รายชื่อ/ดูทั้งหมด/มีใครบ้าง"** → **สรุปเป็นข้อความธรรมชาติเสมอ**:
    - เริ่มด้วยจำนวนรวม เช่น "มีนักศึกษาทั้งหมด 1,234 คน"
    - แยกตามสาขา/ชั้นปี/สถานะ เป็น bullet สั้นๆ (ไม่เกิน 5-8 bullet)
    - ยกตัวอย่างเด่นๆ 3-5 คน (ชื่อ+สาขา+GPA) เป็นประโยคไทย ไม่ใช่ JSON
    - ปิดด้วยคำแนะนำ เช่น "ใช้หน้า 'รายชื่อนักศึกษา' เพื่อดูครบทั้งหมด หรือถามเจาะจง เช่น 'นักศึกษาสาขาเคมีชั้นปี 3'"
13. **สรุปก่อนตอบเสมอ** — ก่อนให้ข้อมูล ให้เริ่มด้วยประโยคสรุปภาพรวม 1 บรรทัด แล้วค่อยลงรายละเอียด ห้ามขึ้นต้นด้วย JSON/code block/ตัวเลขเดี่ยวๆ

### Available Data Domains (ข้อมูลที่ตอบได้):
📊 นิสิต (จำนวน/สาขา/ชั้นปี/GPA/สถานะ) | 🎓 การสำเร็จการศึกษา (ย้อนหลัง/ปัจจุบัน/เกียรตินิยม/แยกสาขา)
💰 งบประมาณ (มหาวิทยาลัย/คณะวิทย์) | 🔬 งานวิจัย (ตีพิมพ์/ทุน/สิทธิบัตร/benchmark)
👥 บุคลากร (ตำแหน่ง/วุฒิ/ภาควิชา/แนวโน้ม/เกษียณ) | 🎯 ยุทธศาสตร์ & OKR (เป้าหมาย/KPI/ความก้าวหน้า)
📚 กิจกรรมนิสิต | 💵 ค่าเล่าเรียน | 🏫 ข้อมูลทั่วไปแม่โจ้

### MJU Quick Reference:
- มหาวิทยาลัยแม่โจ้ (Maejo University/MJU/มจ.) ก่อตั้ง พ.ศ.2477 ปรัชญา: "มหาวิทยาลัยแห่งชีวิต"
- ที่ตั้ง: 63 ม.4 ต.หนองหาร อ.สันทราย จ.เชียงใหม่ 50290 โทร 053-873000
- วิทยาเขต: เชียงใหม่(หลัก), แพร่, ชุมพร
- TCAS: รอบ1-Portfolio รอบ2-Quota รอบ3-Admission รอบ4-DirectAdmit
- 18 คณะ/วิทยาลัย (เน้น: เกษตรอินทรีย์#1ไทย)`;
}

// Full student list — only included when query needs row-level detail
// (search by name/id, top-N GPA, etc.). Aggregate queries are already
// covered by the per-major / per-year stats in the base instruction.
function buildStudentData() {
    const list = getStudentListSync();
    const sourceLabel = isLiveData()
        ? 'realtime จาก Firestore/การอัปโหลดล่าสุด'
        : 'ข้อมูลที่เว็บใช้อยู่ตอนนี้';
    // Compact JSON keeps tokens low even at ~1,451 rows.
    return `\n\n## รายชื่อนักศึกษา (${sourceLabel}; id=รหัส,n=ชื่อ,m=สาขา,y=ปี,g=GPA,s=สถานะ):\n` +
        JSON.stringify(list.map(s => ({
            id: s.id, n: s.name, m: s.major, y: s.year, g: s.gpa, s: s.status
        })));
}

const LIVE_RAG_ONLY_LEGACY_BUILDERS = { buildBaseInstruction, buildStudentData };
void LIVE_RAG_ONLY_LEGACY_BUILDERS;

// Check if user message needs student detail data (row-level only).
// Aggregate-style queries (counts, charts, by-major) are answered from
// the precomputed stats already inlined in the base instruction.
function needsStudentDetail(msg) {
    const q = msg.toLowerCase();
    const skipDomains = ['งานวิจัย', 'ตีพิมพ์', 'scopus', 'สิทธิบัตร', 'ทุนวิจัย', 'citation',
        'ยุทธศาสตร์', 'okr', 'kpi', 'บุคลากร', 'ตำแหน่งวิชาการ', 'เกษียณ', 'ภาควิชา'];
    if (skipDomains.some(k => q.includes(k))) return false;

    // Bare student-id pattern (10 digits starting with 6) — user pasting an ID
    // to look someone up should always inject row-level data.
    if (/\b6\d{9}\b/.test(msg)) return true;

    // Row-level keywords ONLY — anything that requires looking at individual records.
    const keywords = ['รายชื่อ', 'ชื่อนักศึกษา', 'ชื่อนิสิต', 'ค้นหานักศึกษา', 'หานักศึกษา', 'รหัส 6',
        'ใครบ้าง', 'คนไหน', 'gpa สูง', 'เกรดสูง', 'รอพินิจ', 'เกรดต่ำ', 'เกียรตินิยม'];
    return keywords.some(k => q.includes(k));
}

function classifyQueryIntent(msg) {
    const q = String(msg || '').toLowerCase();
    if (/กราฟ|chart|plot|แผนภูมิ|เปรียบเทียบ|พยากรณ์|forecast|วิเคราะห์/.test(q)) return 'chart_analysis';
    if (shouldUseWebSearch(q)) return 'web_lookup';
    if (/\b6\d{9}\b/.test(q) || /ชื่อ|รายชื่อ|ค้นหา|หา.*นักศึกษา|student/.test(q)) return 'lookup';
    if (/สรุป|ภาพรวม|insight|แนวโน้ม|เหตุผล|ทำไม/.test(q)) return 'analysis';
    return 'general';
}

function modelOrderForIntent(intent, settings) {
    if (settings.modelMode && settings.modelMode !== 'auto' && MODELS.includes(settings.modelMode)) {
        return [settings.modelMode, ...MODELS.filter(model => model !== settings.modelMode)];
    }
    if (intent === 'web_lookup') {
        return ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-flash-latest', ...MODELS.filter(model => !SEARCH_CAPABLE_MODELS.has(model))];
    }
    if (intent === 'chart_analysis' || intent === 'analysis') {
        return ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-flash-lite-latest'];
    }
    return MODELS;
}

function domainAllowed(role, domain) {
    if (!role || role === 'dean') return true;
    const accessMap = {
        students: ['student_stats', 'student_list'],
        tuition: ['tuition'],
        graduation: ['graduation_check', 'graduation_stats'],
        budget: ['budget_forecast', 'financial', 'faculty_budget'],
        research: ['research_overview'],
        hr: ['hr_overview'],
        strategic: ['strategic_overview'],
        student_life: ['student_life'],
        dashboard: ['dashboard'],
    };
    return (accessMap[domain] || ['dashboard']).some(section => canAccess(role, section));
}

function liveDatasetContext(id, label) {
    const meta = getDashboardDatasetMetaSync(id);
    const liveData = getLiveDashboardDatasetSync(id);
    if (liveData) {
        const updated = meta.updatedAt ? `, updated=${meta.updatedAt.toLocaleString('th-TH')}` : '';
        return { data: liveData, sourceLabel: `realtime${updated}`, missing: null };
    }

    const currentData = getDashboardDatasetSync(id);
    if (currentData) {
        return {
            data: currentData,
            sourceLabel: 'ข้อมูลที่เว็บใช้อยู่ตอนนี้',
            missing: null,
        };
    }

    return {
        data: null,
        missing: `${label}: ยังไม่มีข้อมูลในระบบปัจจุบัน (status=${meta.sourceType || 'empty'})`,
    };
}

function studentAggregateContext(includeRows = false) {
    const list = getStudentListSync();
    const sourceLabel = isLiveData() ? 'live/realtime' : 'ข้อมูลที่เว็บใช้อยู่ตอนนี้';
    const byMajor = {};
    const byYear = {};
    let atRisk = 0;
    list.forEach(s => {
        byMajor[s.major] = byMajor[s.major] || { count: 0, gpaSum: 0 };
        byMajor[s.major].count += 1;
        byMajor[s.major].gpaSum += Number(s.gpa) || 0;
        byYear[s.year] = (byYear[s.year] || 0) + 1;
        if ((Number(s.gpa) || 0) < 2) atRisk += 1;
    });
    const majorSummary = Object.entries(byMajor).map(([major, v]) =>
        `${major}: ${v.count} คน, GPA เฉลี่ย ${(v.gpaSum / Math.max(1, v.count)).toFixed(2)}`
    ).join('\n');
    const yearSummary = Object.entries(byYear).map(([year, count]) => `ปี ${year}: ${count} คน`).join(', ');
    const rows = includeRows
        ? `\nตัวอย่างแถวที่เกี่ยวข้อง:\n${list.slice(0, 40).map(s => `${s.id}, ${s.name}, ${s.major}, ปี ${s.year}, GPA ${s.gpa}, ${s.status}`).join('\n')}`
        : '';
    return `ข้อมูลนักศึกษา (${sourceLabel}) รวม ${list.length} คน\nตามสาขา:\n${majorSummary}\nตามชั้นปี: ${yearSummary}\nGPA < 2.00: ${atRisk} คน${rows}`;
}

function budgetContext() {
    const universityLive = liveDatasetContext('university_budget', 'งบประมาณมหาวิทยาลัย');
    const scienceLive = liveDatasetContext('science_budget', 'งบประมาณคณะวิทยาศาสตร์');
    const sections = [];

    if (universityLive.data) {
        const university = (universityLive.data.yearly || []).map(y => `${y.year}: รายรับ ${y.revenue}, รายจ่าย ${y.expense}, ${y.type}`).join('\n');
        sections.push(`งบประมาณมหาวิทยาลัย (${universityLive.sourceLabel}):\n${university}`);
    } else {
        sections.push(universityLive.missing);
    }

    if (scienceLive.data) {
        const science = (scienceLive.data.yearly || []).map(y => `${y.year}: รายรับ ${y.revenue}, รายจ่าย ${y.expense}, ${y.type}`).join('\n');
        sections.push(`งบประมาณคณะวิทยาศาสตร์ (${scienceLive.sourceLabel}):\n${science}`);
    } else {
        sections.push(scienceLive.missing);
    }

    return sections.join('\n\n');
}

function graduationContext() {
    const live = liveDatasetContext('graduation', 'สถิติสำเร็จการศึกษา');
    if (!live.data) return live.missing;

    const history = live.data.history || live.data.graduationHistory || [];
    const current = live.data.current || live.data.currentGraduationStats || {};
    const byMajor = live.data.byMajor || live.data.graduationByMajor || [];
    const honors = live.data.honors || {};
    const distribution = live.data.gpaDistribution || [];
    return `สถิติสำเร็จการศึกษา (${live.sourceLabel}):\n${history.map(g => `${g.year}: สำเร็จ ${g.graduated}, อัตรา ${g.rate}%, GPA เฉลี่ย ${g.avgGPA}`).join('\n')}\nปัจจุบัน: ${JSON.stringify(current)}\nแยกสาขา: ${byMajor.map(m => `${m.major}: ${m.rate}% (${m.expected}/${m.total})`).join('; ')}\nเกียรตินิยม: ${Object.entries(honors || {}).map(([k, v]) => `${k}:${v}`).join(', ')}\nGPA distribution: ${distribution.map(g => `${g.range}:${g.count}`).join(', ')}`;
}

function researchContext() {
    const live = liveDatasetContext('research', 'งานวิจัย');
    if (!live.data) return live.missing;
    const source = live.data;
    const researchData = {
        ...source,
        summary: source.summary || source.overview,
        publicationsTrend: source.publicationsTrend || source.publicationTrend,
    };
    return `งานวิจัย (${live.sourceLabel}):\n${JSON.stringify({
        summary: researchData.summary,
        publicationsTrend: researchData.publicationsTrend,
        fundingTrend: researchData.fundingTrend,
        patents: researchData.patents,
        benchmark: researchData.benchmark,
    })}`;
}

function hrContext() {
    const live = liveDatasetContext('hr', 'บุคลากร');
    if (!live.data) return live.missing;
    const source = live.data;
    const hrData = {
        ...source,
        summary: source.summary || source.scienceFaculty?.summary,
        byDepartment: source.byDepartment || source.scienceFaculty?.byDepartment,
        byPosition: source.byPosition || source.scienceFaculty?.byPosition,
        trends: source.trends || source.scienceFaculty?.trends,
    };
    return `บุคลากร (${live.sourceLabel}):\n${JSON.stringify({
        summary: hrData.summary,
        byDepartment: hrData.byDepartment,
        byPosition: hrData.byPosition,
        trends: hrData.trends,
    })}`;
}

function strategicContext() {
    const live = liveDatasetContext('strategic', 'ยุทธศาสตร์และ OKR');
    if (!live.data) return live.missing;
    const strategicData = live.data;
    return `ยุทธศาสตร์และ OKR (${live.sourceLabel}):\n${JSON.stringify(strategicData)}`;
}

function academicRulesContext() {
    return buildAcademicRulesContext();
}

function tuitionContext() {
    const live = liveDatasetContext('tuition', 'ค่าเล่าเรียน');
    if (!live.data) return live.missing;
    const tuitionData = live.data;
    return `ค่าเล่าเรียน (${live.sourceLabel}):\n${JSON.stringify(tuitionData)}`;
}

function studentLifeContext() {
    const live = liveDatasetContext('student_life', 'กิจกรรมนักศึกษา/ชีวิตนักศึกษา');
    if (!live.data) return live.missing;
    const studentLifeData = live.data;
    return `กิจกรรมนักศึกษา/ชีวิตนักศึกษา (${live.sourceLabel}):\n${JSON.stringify(studentLifeData)}`;
}

function retrieveRelevantContexts(userMessage, userContext = {}, settings = {}) {
    const q = String(userMessage || '').toLowerCase();
    const includeStudentRows = needsStudentDetail(userMessage);
    const candidates = [
        { id: 'students', sections: ['student_stats', 'student_list'], keywords: /นักศึกษา|นิสิต|student|gpa|เกรด|สาขา|รายชื่อ|รหัส|ชั้นปี|tcas|admission|รับสมัคร|รับเข้า|รอบ/, text: () => studentAggregateContext(includeStudentRows) },
        { id: 'academic_rules', sections: ['academic_rules', 'graduation_check', 'graduation_stats'], keywords: /กฎ|กฏ|ระเบียบ|ข้อบังคับ|เกียรตินิยม|เรียนดี|สำเร็จการศึกษา|พ้นสภาพ|หน่วยกิต|คะแนนความประพฤติ|f\s*หรือ\s*u|gpa\s*3\./i, text: academicRulesContext },
        { id: 'tuition', sections: ['tuition'], keywords: /ค่าเทอม|ค่าเล่าเรียน|tuition|ค่าธรรมเนียม|ชำระ|ค้างจ่าย|ค้างชำระ/, text: tuitionContext },
        { id: 'graduation', sections: ['graduation_check', 'graduation_stats'], keywords: /สำเร็จ|จบ|graduation|เกียรติ|pending|รอพินิจ/, text: graduationContext },
        { id: 'budget', sections: ['budget_forecast', 'financial', 'faculty_budget'], keywords: /งบ|budget|รายรับ|รายจ่าย|เงิน|finance/, text: budgetContext },
        { id: 'research', sections: ['research_overview'], keywords: /วิจัย|research|scopus|citation|สิทธิบัตร|ทุน/, text: researchContext },
        { id: 'hr', sections: ['hr_overview'], keywords: /บุคลากร|อาจารย์|staff|hr|เกษียณ|ตำแหน่ง/, text: hrContext },
        { id: 'strategic', sections: ['strategic_overview'], keywords: /ยุทธศาสตร์|okr|kpi|เป้าหมาย|ตัวชี้วัด/, text: strategicContext },
        { id: 'student_life', sections: ['student_life'], keywords: /กิจกรรม|พฤติกรรม|student life|ชั่วโมงกิจกรรม/, text: studentLifeContext },
    ];

    const role = userContext?.role || 'general';
    const scored = candidates
        .filter(c => domainAllowed(role, c.id) || c.sections.some(section => canAccess(role, section)))
        .map(c => ({ ...c, score: c.keywords.test(q) ? 10 : 0 }))
        .filter(c => c.score > 0);

    if (scored.length === 0 && domainAllowed(role, 'dashboard')) {
        scored.push({
            id: 'dashboard',
            score: 1,
            text: () => {
                const live = liveDatasetContext('dashboard_summary', 'ภาพรวม Dashboard');
                return live.data
                    ? `ภาพรวม Dashboard (realtime):\n${JSON.stringify(live.data)}`
                    : live.missing;
            },
        });
    }

    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, settings.maxContexts || DEFAULT_AI_SETTINGS.maxContexts)
        .map(c => ({ id: c.id, text: c.text() }));
}

function maejoLocalFirstContext(userMessage, localContexts = []) {
    const privateLookup = isStudentPrivateLookupQuery(userMessage);
    const localContextIds = localContexts.map(c => c.id).join(', ') || 'dashboard';
    return `หลักการตอบแบบ local-first ของ SCI AI Dashboard:
- ใช้ข้อมูลในเว็บ/ระบบนี้ก่อนเสมอ โดย context ที่ดึงได้ตอนนี้คือ: ${localContextIds}
- ถ้าข้อมูลในเว็บเราเป็น aggregate เช่น จำนวนนักศึกษาตามสาขา/ชั้นปี ให้ใช้ตอบหรือคำนวณก่อน
- ถ้าถาม TCAS/การรับสมัคร/จำนวนรับเข้าแต่ละรอบ/ค่าเทอม/กำหนดการ/ประกาศล่าสุด และใน context ไม่มีตัวเลขหรือไม่มีรายละเอียดรายรอบ ให้ใช้ Google Search grounding ต่อจากแหล่งทางการ
- สาขาคณะวิทยาศาสตร์ที่เว็บเรารู้จัก: ${SCIENCE_MAJORS.join(', ')}
- ข้อมูลทั่วไปที่รู้ในเว็บ: มหาวิทยาลัยแม่โจ้ (Maejo University/MJU/มจ.), วิทยาเขตหลักเชียงใหม่ พร้อมวิทยาเขตแพร่และชุมพร, ใช้แหล่งทางการของมหาวิทยาลัยเป็นหลักเมื่อต้องตรวจข้อมูลล่าสุด
${privateLookup ? '- คำถามนี้มีลักษณะข้อมูลรายบุคคล/การเงินของนักศึกษา: ห้ามเดารายชื่อหรือสถานะชำระเงิน ถ้าไม่มี field สถานะชำระในระบบ ให้บอกชัดว่าเว็บเรายังไม่มีข้อมูลส่วนนี้ และให้ค้นเว็บได้เฉพาะกำหนดการ/ประกาศ/ระเบียบค่าธรรมเนียมแบบสาธารณะเท่านั้น' : ''}`;
}

function maejoTrustedFallbackContext() {
    return `เมื่อต้องใช้ข้อมูลนอกเว็บเรา ให้เรียงความน่าเชื่อถือดังนี้:
1. เว็บไซต์ทางการของมหาวิทยาลัยแม่โจ้และหน่วยงานภายใน เช่น mju.ac.th, admission.mju.ac.th, reg.mju.ac.th, education.mju.ac.th, science.mju.ac.th
2. ประกาศ PDF/ข่าวทางการจากมหาวิทยาลัยหรือคณะ
3. แหล่งรัฐหรือระบบ TCAS ที่เกี่ยวข้อง
หลีกเลี่ยงการใช้เว็บไม่เป็นทางการเมื่อเป็นข้อมูลที่เปลี่ยนบ่อย เช่น TCAS68, จำนวนรับเข้า, ค่าเทอม, ปฏิทิน, เบอร์ติดต่อ และให้ระบุที่มาหรือชื่อแหล่งข้อมูลในคำตอบเมื่อใช้ข้อมูลภายนอก`;
}

function chartPaletteInstruction(theme = 'light') {
    const dark = theme === 'dark';
    const palette = dark
        ? ['#7dd3fc', '#c4b5fd', '#34d399', '#fbbf24', '#fb7185', '#22d3ee']
        : ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2'];
    return `Theme-aware chart palette: current theme=${theme}. Use high-contrast dataset colors only: ${palette.join(', ')}. Avoid black, near-black, low-contrast gray, or dark green chart fills/hover colors.`;
}

function buildAgenticRagInstruction(userMessage, userContext = {}, settings = {}) {
    const role = userContext?.role || 'general';
    const roleInfo = getRoleInfo(role);
    const memory = getAIUserMemory(userContext);
    const useMaejoWebMode = shouldUseWebSearch(userMessage);
    const localContexts = retrieveRelevantContexts(userMessage, userContext, settings);
    const contexts = useMaejoWebMode
        ? [
            {
                id: 'sci_ai_dashboard_local_first',
                text: maejoLocalFirstContext(userMessage, localContexts),
            },
            ...localContexts,
            {
                id: 'trusted_external_fallback',
                text: maejoTrustedFallbackContext(),
            }
        ]
        : localContexts;
    const contextText = contexts.map((c, idx) => `### Context ${idx + 1}: ${c.id}\n${c.text}`).join('\n\n');
    const roleLabel = roleInfo?.label || userContext?.roleLabel || role;
    const accessNote = useMaejoWebMode
        ? 'ข้อมูลสาธารณะของมหาวิทยาลัยแม่โจ้ตอบได้ทุก role แต่ห้ามเปิดเผยข้อมูลส่วนบุคคลหรือข้อมูลภายในที่ไม่มีสิทธิ์'
        : role === 'dean'
        ? 'คณบดีเข้าถึงข้อมูลได้ครบทุกโดเมนตามระบบ'
        : 'ตอบเฉพาะข้อมูลในบริบทและสิทธิ์ของ role นี้เท่านั้น ถ้าข้อมูลอยู่นอกสิทธิ์ให้บอกว่าต้องใช้สิทธิ์สูงกว่า';
    const answerScopeRule = useMaejoWebMode
        ? 'ตอบภาษาไทย กระชับ ใช้ข้อมูลในเว็บ/ระบบนี้ก่อน หากข้อมูลไม่ครบให้ใช้ Google Search จากเว็บทางการหรือแหล่งน่าเชื่อถือเป็น fallback พร้อมบอกแหล่งที่มา และไม่ต้องสร้างกราฟถ้าผู้ใช้ไม่ได้ขอ'
        : 'ตอบภาษาไทย กระชับ อ้างอิงเฉพาะข้อมูลใน RETRIEVED CONTEXTS และห้ามเดาตัวเลข';

    return `You are MJU Science AI Assistant for SCI-AI-DASHBOARD.
${answerScopeRule}

ROLE CONTEXT:
- role=${role} (${roleLabel})
- ${accessNote}
- user preference memory: preferredFormat=${memory.preferredFormat}, detailLevel=${memory.detailLevel}, frequentTopics=${Object.entries(memory.topics || {}).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v]) => `${k}:${v}`).join(', ') || '-'}

LIVE DATA FRESHNESS:
${getDashboardFreshnessContext()}

TOKEN SAVING RULES:
- Maejo public web mode: ถ้าคำถามเป็นเรื่องทั่วไปของมหาวิทยาลัยแม่โจ้ เช่น ประวัติ คณะ หลักสูตร รับสมัคร TCAS ค่าเทอม ค่าธรรมเนียม ข่าว หน่วยงาน เบอร์ติดต่อ หรือสถานที่ ให้ตรวจ RETRIEVED CONTEXTS ของเว็บเราก่อน แล้วค่อยใช้ Google Search/เว็บทางการเมื่อข้อมูลไม่ครบ
- ห้ามตอบว่า “ไม่พบข้อมูล” ทันทีใน Maejo public web mode จนกว่าจะใช้ทั้ง context ในเว็บเราและ trusted external fallback แล้ว
- ถ้าถามจำนวนรับเข้า TCAS/แต่ละรอบ/ประกาศล่าสุด ให้ค้นจากเว็บทางการล่าสุด และแยกให้ชัดว่า “ข้อมูลในเว็บเรา” กับ “ข้อมูลจากแหล่งภายนอกทางการ”
- ถ้าถามรายชื่อหรือสถานะค้างจ่ายค่าธรรมเนียมรายบุคคล ให้ใช้เฉพาะข้อมูลในระบบที่มีสิทธิ์เท่านั้น ห้ามเดารายชื่อและห้ามอ้างว่าเว็บสาธารณะมีข้อมูลรายบุคคล; ถ้าเว็บเรายังไม่มี field ชำระเงิน ให้บอกว่าไม่มีข้อมูลส่วนนี้ในระบบ พร้อมเสนอว่าต้องเชื่อมฐานทะเบียน/การเงิน แต่สามารถให้ข้อมูลประกาศ/กำหนดการชำระค่าธรรมเนียมจากแหล่งทางการได้
- ถ้าเป็นข้อมูลที่อาจเปลี่ยนบ่อย ต้องบอกตามข้อมูลล่าสุดที่ค้นได้ และถ้าไม่พบหลักฐานให้บอกว่าไม่พบข้อมูลล่าสุดแทนการเดา
- Source priority: ใช้ context ที่ระบุว่า realtime/live ก่อนเสมอ; ถ้ายังไม่มี realtime ให้ใช้ context ที่ระบุว่า "ข้อมูลที่เว็บใช้อยู่ตอนนี้" เพื่อคำนวณ/สร้างกราฟไปก่อน พร้อมบอกแหล่งข้อมูลให้ชัดเจน
- ถ้าจะคำนวณ พยากรณ์ หรือสร้างกราฟ ต้องคำนวณจากตัวเลขใน RETRIEVED CONTEXTS เท่านั้น ห้ามเดาหรือเติมตัวเลขเอง
- ใช้เฉพาะ context ที่เกี่ยวข้องจาก retrieval ด้านล่าง ไม่ต้องอ่านทุกหน้าเว็บ
- ถ้าคำถามเป็น lookup ธรรมดาให้ตอบสั้น ไม่สร้างกราฟ
- ถ้าขอกราฟ ให้สร้าง json_chart จากตัวเลขใน RETRIEVED CONTEXTS เท่านั้น
- ถ้าผู้ใช้ระบุหลาย metric ในคำถามเดียว เช่น "จำนวนนักศึกษา เกรด/GPA" ต้องใส่ทุก metric ที่ผู้ใช้ขอในกราฟ ห้ามตัดเหลือแค่ dataset เดียว
- สำหรับคำถาม "จำนวนนักศึกษา + เกรด/GPA คณะวิทยาศาสตร์" ให้ใช้ Context students ตามสาขา: dataset 1 = "จำนวนนักศึกษา" (คน), dataset 2 = "GPA เฉลี่ย" (0-4) และใช้ dual y-axis y/y1
- กราฟเส้นใช้เฉพาะ time series ปี/เดือน/วันที่/ไตรมาส ถ้าเป็นหมวดหมู่ให้ใช้ bar/hbar/scatter
- ${chartPaletteInstruction(settings.theme || 'light')}

OUTPUT FORMAT:
- ถ้าสร้างกราฟ ต้องใช้ block \`\`\`json_chart ... \`\`\`
- กราฟจำนวนนักศึกษา + เกรด/GPA ต้องมี datasets อย่างน้อย 2 ชุด ได้แก่ "จำนวนนักศึกษา" และ "GPA เฉลี่ย"
- ห้ามปล่อย raw JSON/dataset นอก block กราฟ

RETRIEVED CONTEXTS:
${contextText || 'ไม่มี context ที่เข้าถึงได้สำหรับคำถามนี้'}`;
}

// Conversation history for multi-turn chat
let conversationHistory = [];

/**
 * Send a message to the Gemini API and return the response text.
 * Tries multiple models in order until one succeeds.
 */
export function sendMessageToGemini(userMessage, options = {}) {
    const p = requestQueue.then(() => _sendMessageImpl(userMessage, options));
    requestQueue = p.catch(() => {}); // keep queue alive even if request fails
    return p;
}

async function _sendMessageImpl(userMessage, options = {}) {
    const settings = saveAIModelSettings({ ...getAIModelSettings(), ...(options.aiSettings || {}) });
    settings.theme = options.theme || settings.theme || (typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : 'light') || 'light';
    const originalQuestion = extractUserQuestionFromPrompt(userMessage);
    const intent = classifyQueryIntent(originalQuestion);
    updateAIUserMemory(options.user || {}, originalQuestion);

    // Detect chart/graph request keywords and append reminder
    const chartKeywords = ['กราฟ', 'chart', 'แผนภูมิ', 'แผนภาพ', 'แท่ง', 'เส้น', 'วงกลม', 'radar', 'พยากรณ์', 'คาดการณ์', 'forecast', 'bar chart', 'line chart', 'pie chart', 'กราฟแท่ง', 'กราฟเส้น', 'กราฟวงกลม', 'เปรียบเทียบ', 'สร้างกราฟ', 'แสดงกราฟ', 'วิเคราะห์'];
    const lowerMsg = originalQuestion.toLowerCase();
    const isChartRequest = chartKeywords.some(kw => lowerMsg.includes(kw));

    let finalMessage = userMessage;
    if (isChartRequest) {
        finalMessage = userMessage + `\n\n[ระบบ: ผู้ใช้ขอดูกราฟ/วิเคราะห์ข้อมูล — กฎ:
1. ดูข้อมูลใน "Dashboard" section ว่ามีข้อมูลที่ผู้ใช้ถามหรือไม่
2. ถ้ามีข้อมูล realtime/live ใน RETRIEVED CONTEXTS → ใช้ชุดนั้นก่อน
3. ถ้ายังไม่มี realtime แต่มี "ข้อมูลที่เว็บใช้อยู่ตอนนี้" → ใช้ชุดนั้นคำนวณ/สร้างกราฟไปก่อนและระบุแหล่งข้อมูล
4. ห้ามสร้างตัวเลขขึ้นเอง ห้ามใช้ข้อมูลที่ไม่เกี่ยวข้อง
5. ถ้าคำถามขอหลายตัวชี้วัด เช่น จำนวนนักศึกษา + เกรด/GPA ต้องใส่ทุกตัวชี้วัดในกราฟเดียวหรือหลายกราฟ ห้ามตัดบางตัวออก
6. ต้องแนบ \`\`\`json_chart\`\`\` block เสมอถ้ามีข้อมูล]`;
    }

    // Add user message to history
    conversationHistory.push({
        role: 'user',
        parts: [{ text: finalMessage }]
    });

    // Rate limit
    await waitForRateLimit();

    let lastError = null;
    let allQuotaExhausted = true;

    // Always use retrieved contexts only; realtime wins, current web datasets are used as the interim source.
    const baseInstruction = buildAgenticRagInstruction(originalQuestion, options.user || {}, settings);
    const systemText = baseInstruction;

    // Check if this query should use Google Search for real-time Maejo data
    const useSearch = settings.allowWebSearch && shouldUseWebSearch(originalQuestion);
    const retrievedContextCount = retrieveRelevantContexts(originalQuestion, options.user || {}, settings).length + (useSearch ? 2 : 0);

    const baseRequestBody = {
        system_instruction: {
            parts: [{ text: systemText }]
        },
        contents: conversationHistory,
        generationConfig: {
            temperature: settings.temperature,
            topP: 0.85,
            topK: 40,
            maxOutputTokens: settings.maxOutputTokens,
        },
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ]
    };

    // Try each model in order, skip models on cooldown
    const candidateModels = useSearch
        ? ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-flash-latest', ...MODELS.filter(model => !SEARCH_CAPABLE_MODELS.has(model))]
        : modelOrderForIntent(intent, settings);
    for (const model of candidateModels) {
        if (isModelOnCooldown(model)) {
            console.log(`[Gemini] Skipping ${model} (cooldown)`);
            continue;
        }

        try {
            // Build per-model request body — add google_search for capable models
            const requestBody = { ...baseRequestBody };
            if (useSearch && SEARCH_CAPABLE_MODELS.has(model)) {
                requestBody.tools = [{ google_search: {} }];
                console.log(`[Gemini] 🔍 ${model} + Google Search (real web data)`);
            }

            console.log(`[Gemini] Trying model: ${model}...`);
            const apiUrl = getApiUrl(model);

            const response = await fetchSmart(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (response.status === 429) {
                setModelCooldown(model);
                lastError = new Error('QUOTA_EXCEEDED');
                continue;
            }

            if (response.status === 404) {
                allQuotaExhausted = false;
                console.warn(`[Gemini] ${model} not found (404), skipping...`);
                lastError = new Error(`${model}: Model not available`);
                continue;
            }

            if (!response.ok) {
                allQuotaExhausted = false;
                const errorData = await response.json().catch(() => ({}));
                console.warn(`[Gemini] ${model} failed: ${response.status}`);
                lastError = new Error(`${model}: HTTP ${response.status} - ${errorData?.error?.message || 'Unknown'}`);
                continue;
            }

            allQuotaExhausted = false;
            const data = await response.json();
            const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!aiText) {
                console.warn(`[Gemini] ${model} empty response`);
                lastError = new Error(`${model}: Empty response`);
                continue;
            }

            console.log(`[Gemini] ✅ ${model} OK`);
            onModelSuccess(model);
            recordTokenStats({
                model,
                intent,
                inputText: `${systemText}\n${JSON.stringify(conversationHistory)}`,
                outputText: aiText,
                contextCount: retrievedContextCount,
            });

            conversationHistory.push({
                role: 'model',
                parts: [{ text: aiText }]
            });

            if (conversationHistory.length > 16) {
                conversationHistory = conversationHistory.slice(-16);
            }

            return aiText;

        } catch (error) {
            allQuotaExhausted = false;
            console.warn(`[Gemini] ${model} error:`, error.message);
            lastError = error;
            continue;
        }
    }

    // Remove the failed user message from history
    conversationHistory.pop();

    // Throw a user-friendly error
    if (allQuotaExhausted || lastError?.message === 'QUOTA_EXCEEDED') {
        throw new Error('QUOTA_ALL_EXHAUSTED');
    }

    console.error('[Gemini] ❌ All models failed:', lastError);
    throw lastError || new Error('ไม่สามารถเชื่อมต่อ AI ได้');
}

/**
 * Reset conversation history (e.g., when chat is closed/reopened)
 */
export function resetConversation() {
    conversationHistory = [];
}

// ==================== Proactive AI Insights ====================
export async function getDashboardInsights() {
    const insightCacheKey = 'ai_insights_current_web_v3';
    const cached = sessionStorage.getItem(insightCacheKey);
    if (cached) return JSON.parse(cached);

    const sysInstruction = buildAgenticRagInstruction(
        'สรุป insight dashboard จากข้อมูล realtime',
        { role: 'dean' },
        { ...DEFAULT_AI_SETTINGS, maxContexts: 4 }
    );
    const prompt = `จากข้อมูล Dashboard แม่โจ้:\n${sysInstruction}\n\nวิเคราะห์สรุป Insight 3 ข้อสั้นๆ (ข้อละ 1-2 บรรทัด) ใช้ตัวเลขจาก context เท่านั้น โดยให้ใช้ realtime/live ก่อน และถ้ายังไม่มีให้ใช้ข้อมูลที่เว็บใช้อยู่ตอนนี้ ห้ามแต่งตัวเลข ตอบเป็น JSON array เท่านั้น:\n\`\`\`json\n["insight1","insight2","insight3"]\n\`\`\``;

    await waitForRateLimit();

    for (const model of MODELS) {
        if (isModelOnCooldown(model)) continue;

        try {
            const apiUrl = getApiUrl(model);
            const response = await fetchSmart(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.2, maxOutputTokens: 1024 }
                })
            });

            if (response.status === 429) {
                setModelCooldown(model);
                continue;
            }
            if (!response.ok) continue;

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            const match = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\[[\s\S]*?\]/);
            if (match) {
                const jsonStr = match[1] || match[0];
                const insights = JSON.parse(jsonStr);
                sessionStorage.setItem(insightCacheKey, JSON.stringify(insights));
                return insights;
            }
        } catch (error) {
            console.warn(`[Insights] ${model} error:`, error.message);
            continue;
        }
    }

    const liveStudents = getStudentListSync();
    const atRisk = liveStudents.filter(student => (Number(student.gpa) || 0) < 2).length;
    const majors = [...new Set(liveStudents.map(student => student.major).filter(Boolean))].length;
    const source = isLiveData() ? 'ข้อมูล realtime/อัปโหลดล่าสุด' : 'ข้อมูลที่เว็บใช้อยู่ตอนนี้';
    return [
        `ข้อมูลนักศึกษาปัจจุบันในระบบรวม ${liveStudents.length.toLocaleString()} คน จาก ${majors} สาขา (${source})`,
        `นักศึกษาที่ควรเฝ้าระวังจาก GPA < 2.00 มี ${atRisk.toLocaleString()} คน`,
        'ข้อมูลกราฟพยากรณ์นักศึกษาจะคำนวณจากปีเข้า/รหัสนักศึกษาที่เว็บมีอยู่ตอนนี้ และจะเปลี่ยนเมื่อข้อมูลกลาง sync เข้ามา'
    ];
}
