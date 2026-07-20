// Gemini API Service for MJU AI Dashboard Chatbot
import {
    studentStatsData, universityBudgetData, scienceFacultyBudgetData,
    tuitionData, studentLifeData, dashboardSummary
} from '../data/mockData';
import { SCIENCE_MAJORS } from '../data/studentListData';
import { getStudentListSync, getStudentRosterTrustStatus, isLiveData } from './studentDataService';
import { buildStudentStatsContextForAI } from './forecastDataService';
import { graduationHistory, currentGraduationStats, graduationByMajor, honorsData, gpaDistribution } from '../data/graduationData';
import { researchData } from '../data/researchData';
import { hrData } from '../data/hrData';
import { strategicData } from '../data/strategicData';
import { buildAcademicRulesContext } from '../data/academicRulesData';
import { getTcasSummary, tcasPlanningData } from '../data/tcasAdmissionsData';
import { courseAnalyticsData } from '../data/courseAnalyticsData';
import { getRoleInfo } from '../utils/accessControl';
import {
    canAIUseAnyInternalSection,
    canAIUseInternalSection,
    canAIUseInternalDomain,
    getAIAccessInstruction,
    isAIUnrestrictedRole,
    resolveAIRole,
} from '../utils/aiAccessPolicy';
import {
    getSharedDashboardDatasetMetaSync,
    getSharedDashboardDatasetSync,
    getSharedDashboardFreshnessContext,
} from './sharedDashboardDataService';
import { buildDataAccuracyContextForAI, getStudentReconciliationSnapshot } from './dataAccuracyService';
import { AI_ASSISTANT_NAME, APP_NAME_EN, APP_NAME_TH } from '../config/appBrand';
import {
    executiveAdviceDatasetStatus,
    getExecutiveAdviceTrustLevel,
    isAnalyticalReasoningIntent,
    isExecutiveRecommendationIntent,
    isTrustedForExecutiveAdvice,
} from '../utils/aiAdvicePolicy';
import { coerceStructuredAIResponseMarkdown } from '../utils/aiChartResponse';
import { getDatasetQualityForAI } from '../utils/smartChartData';
import {
    getMaejoStudentFaqContext,
    MAEJO_OFFICIAL_SOURCE_DOMAINS,
} from '../data/maejoStudentFaqData';
import {
    createAIOrchestrationPlan,
    formatAIOrchestrationPlanForPrompt,
} from './aiOrchestrator';
import { formatAIContextBundleForPrompt, formatAIEvidencePackForPrompt } from './aiContextRegistry';
import {
    decideAIRetrievalPolicy,
    formatAIRetrievalPolicyForPrompt,
    isTrustedAIExternalSource,
} from './aiRetrievalPolicy';
import { buildMjuConnectedContextForAI } from './mjuConnectedDataService';
import { getAllAlerts } from '../utils/alerts';
import { verifyAIAnswerAgainstContext } from '../utils/aiAnswerVerifier';
import {
    normalizeTokenUsage,
    recordTokenUsageSession,
    getTokenUsageSessionSummary,
} from '../utils/aiTokenUsage';
import {
    executiveCompensationDemo,
    getExecutiveCompensationSummary,
    buildStudentPaymentLedgerDemo,
    summarizeStudentPaymentLedgerDemo,
    studentAwardRecordsDemo,
    populationForecastReference,
    FEATURE_COMPLETION_FALLBACK_NOTE,
} from '../data/featureCompletionFallbackData';

const GEMINI_PROXY_ENDPOINT = import.meta.env.VITE_GEMINI_PROXY_ENDPOINT || '/api/gemini-chat';
const AI_USAGE_ENDPOINT = import.meta.env.VITE_AI_USAGE_ENDPOINT || '/api/ai-usage';
if (!GEMINI_PROXY_ENDPOINT) {
    console.warn('[Gemini] ⚠️ VITE_GEMINI_API_KEY is not set.');
}

// Models ordered for decision-support quality first, with lite models kept near
// the front so the shared free-tier quota stays usable during busy sessions.
const MODELS = [
    'gemini-2.5-flash-lite',    // fast, cost-efficient, supports google_search
    'gemini-2.5-flash',         // stronger analysis / chart reasoning
    'gemini-flash-lite-latest', // alias to latest lite — extra headroom
    'gemini-flash-latest',      // alias fallback — supports google_search
    'gemini-2.0-flash-lite',    // older high-RPM fallback
    'gemini-2.0-flash',         // older search-capable fallback
];

const LOW_TO_HIGH_MODEL_ORDER = [
    'gemini-2.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-2.0-flash-lite',
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-2.0-flash',
];

const LOW_TO_HIGH_SEARCH_MODEL_ORDER = [
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-2.0-flash',
];

// Models that support Google Search grounding for real-time web data
const SEARCH_CAPABLE_MODELS = new Set([
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-2.0-flash',
]);

const AI_SETTINGS_KEY = 'sci-ai-dashboard:ai-settings';
const AI_TOKEN_STATS_KEY = 'sci-ai-dashboard:ai-token-stats';
const AI_RATE_EVENTS_KEY = 'sci-ai-dashboard:ai-rate-events';
const AI_MEMORY_KEY = 'sci-ai-dashboard:ai-user-memory';
const DEFAULT_AI_TOKEN_BUDGET = 1_000_000;
const AI_TOKEN_BUDGET = Math.max(
    1,
    Number(import.meta.env.VITE_AI_TOKEN_BUDGET || import.meta.env.VITE_AI_MONTHLY_TOKEN_LIMIT || DEFAULT_AI_TOKEN_BUDGET)
);
let aiUsageSnapshotCache = null;

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
    tcasPlanningData,
    courseAnalyticsData,
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

const MODEL_TIER_RANK = {
    'gemini-2.5-flash-lite': 1,
    'gemini-flash-lite-latest': 1,
    'gemini-2.0-flash-lite': 1,
    'gemini-2.5-flash': 2,
    'gemini-flash-latest': 2,
    'gemini-2.0-flash': 2,
};

const MODEL_RATE_LIMITS = {
    'gemini-2.5-flash-lite': 15,
    'gemini-2.5-flash': 10,
    'gemini-flash-lite-latest': 15,
    'gemini-flash-latest': 10,
    'gemini-2.0-flash-lite': 30,
    'gemini-2.0-flash': 15,
};

const AI_STRUCTURED_RESPONSE_SCHEMA = {
    type: 'object',
    propertyOrdering: ['answer', 'chartJson', 'sources', 'actions'],
    properties: {
        answer: {
            type: 'string',
            description: 'Thai answer for the user. Keep it concise and decision-oriented.',
        },
        chartJson: {
            type: 'string',
            description: 'Empty string if no chart is needed. If a chart is needed, provide only a valid JSON string with chartType, data, and optional options.',
        },
        sources: {
            type: 'array',
            description: 'Human-readable source labels used to answer.',
            items: { type: 'string' },
        },
        actions: {
            type: 'array',
            description: 'Short follow-up actions the UI can suggest, in Thai.',
            items: { type: 'string' },
        },
    },
    required: ['answer', 'sources', 'actions'],
    additionalProperties: false,
};

const AI_RESPONSE_CACHE_TTL_MS = 5 * 60 * 1000;
const AI_WEB_RESPONSE_CACHE_TTL_MS = 60 * 1000;
const AI_RESPONSE_CACHE_MAX_ENTRIES = 40;
const aiResponseCache = new Map();

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

function normalizeAIUsageSnapshot(value = {}) {
    const budgetTokens = Math.max(1, Number(value.budgetTokens || value.limits?.dailyTokenBudget || AI_TOKEN_BUDGET));
    const usedTokens = Math.max(0, Number(value.usedTokens || 0));
    const remainingTokens = Math.max(0, Number(value.remainingTokens ?? (budgetTokens - usedTokens)));
    return {
        budgetTokens,
        usedTokens,
        inFlightInputTokens: Math.max(0, Number(value.inFlightInputTokens || 0)),
        remainingTokens,
        remainingPercent: Math.max(0, Math.min(100, Number(value.remainingPercent ?? Math.round((remainingTokens / budgetTokens) * 100)))),
        requests: Number(value.requests || 0),
        completedRequests: Number(value.completedRequests || 0),
        failedRequests: Number(value.failedRequests || 0),
        providerTokens: Math.max(0, Number(value.providerTokens || 0)),
        estimatedTokens: Math.max(0, Number(value.estimatedTokens || 0)),
        inputTokens: Math.max(0, Number(value.inputTokens || 0)),
        outputTokens: Math.max(0, Number(value.outputTokens || 0)),
        remainingRequests: Number(value.remainingRequests || 0),
        resetAt: value.resetAt || null,
        resetLabel: value.resetLabel || '00:00 น.',
        source: value.source || 'server',
        status: value.status || 'ready',
        isServerBacked: value.serverBacked !== false,
        updatedAt: value.updatedAt || null,
        lastRequest: value.lastRequest || null,
    };
}

function syncingAIUsageSnapshot(status = 'syncing') {
    return {
        budgetTokens: AI_TOKEN_BUDGET,
        usedTokens: 0,
        inFlightInputTokens: 0,
        remainingTokens: 0,
        remainingPercent: 0,
        requests: 0,
        completedRequests: 0,
        failedRequests: 0,
        remainingRequests: 0,
        resetAt: null,
        resetLabel: '00:00 น.',
        source: 'server',
        status,
        isServerBacked: false,
        updatedAt: null,
        lastRequest: null,
    };
}

function setAIUsageSnapshot(snapshot) {
    aiUsageSnapshotCache = normalizeAIUsageSnapshot(snapshot);
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sci-ai-usage-updated', { detail: aiUsageSnapshotCache }));
    }
    return aiUsageSnapshotCache;
}

export function getAITokenBudgetSnapshot() {
    return aiUsageSnapshotCache || syncingAIUsageSnapshot('loading');
}

export async function refreshAITokenBudgetSnapshot() {
    const response = await fetch(AI_USAGE_ENDPOINT, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
    });
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        throw new Error('AI usage endpoint did not return JSON.');
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(body?.message || body?.error || `AI usage snapshot failed with HTTP ${response.status}`);
    }
    return setAIUsageSnapshot(body);
}

function updateAITokenBudgetFromHeaders(headers) {
    if (!headers?.get) return null;
    const budget = Number(headers.get('X-AI-Token-Budget') || 0);
    const remaining = Number(headers.get('X-AI-Token-Remaining') || 0);
    if (!budget) return null;
    const used = Number(headers.get('X-AI-Token-Used') || Math.max(0, budget - remaining));
    return setAIUsageSnapshot({
        budgetTokens: budget,
        usedTokens: used,
        providerTokens: Number(headers.get('X-AI-Provider-Tokens') || 0),
        estimatedTokens: Number(headers.get('X-AI-Estimated-Tokens') || 0),
        inputTokens: Number(headers.get('X-AI-Input-Tokens') || 0),
        outputTokens: Number(headers.get('X-AI-Output-Tokens') || 0),
        remainingTokens: remaining,
        remainingPercent: Number(headers.get('X-AI-Token-Remaining-Percent') || Math.round((remaining / budget) * 100)),
        requests: Number(headers.get('X-AI-Requests-Used') || 0),
        remainingRequests: Number(headers.get('X-AI-Requests-Remaining') || 0),
        resetAt: headers.get('X-AI-Usage-Reset-At') || null,
        resetLabel: '00:00 น.',
        source: headers.get('X-AI-Usage-Source') || 'server',
        serverBacked: true,
        updatedAt: new Date().toISOString(),
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

function recordTokenStats({
    model,
    intent,
    inputText,
    outputText,
    contextCount,
    tokenUsage = null,
    selectedDatasets = [],
    latencyMs = null,
}) {
    recordRateEvent(model);
    const stats = getAITokenStats();
    const inputTokens = Number(tokenUsage?.inputTokens ?? estimateTokens(inputText));
    const outputTokens = Number(tokenUsage?.outputTokens ?? estimateTokens(outputText));
    const totalTokens = Number(tokenUsage?.totalTokens ?? (inputTokens + outputTokens));
    const isEstimated = tokenUsage ? Boolean(tokenUsage.isEstimated) : true;
    const byModel = stats.byModel || {};
    const modelStats = byModel[model] || { requests: 0, estimatedInputTokens: 0, estimatedOutputTokens: 0, actualTokens: 0, estimatedTokens: 0 };
    modelStats.requests += 1;
    modelStats.estimatedInputTokens += inputTokens;
    modelStats.estimatedOutputTokens += outputTokens;
    if (isEstimated) modelStats.estimatedTokens += totalTokens;
    else modelStats.actualTokens += totalTokens;
    byModel[model] = modelStats;

    const sessionSummary = recordTokenUsageSession(tokenUsage || normalizeTokenUsage({}, {
        provider: 'gemini',
        model,
        fallbackInputTokens: inputTokens,
        fallbackOutputTokens: outputTokens,
        selectedDatasets,
        contextCount,
        latencyMs,
        source: 'client_estimate',
    }));

    const nextStats = {
        requests: (stats.requests || 0) + 1,
        estimatedInputTokens: (stats.estimatedInputTokens || 0) + inputTokens,
        estimatedOutputTokens: (stats.estimatedOutputTokens || 0) + outputTokens,
        actualTokens: Number(stats.actualTokens || 0) + (isEstimated ? 0 : totalTokens),
        estimatedTokens: Number(stats.estimatedTokens || 0) + (isEstimated ? totalTokens : 0),
        byModel,
        lastRequest: {
            model,
            intent,
            contextCount,
            estimatedInputTokens: inputTokens,
            estimatedOutputTokens: outputTokens,
            totalTokens,
            isEstimated,
            source: tokenUsage?.source || 'client_estimate',
            selectedDatasets: Array.isArray(selectedDatasets) ? selectedDatasets.slice(0, 12) : [],
            latencyMs,
            at: new Date().toISOString(),
        },
        sessionSummary: {
            requestCount: sessionSummary.requestCount,
            totalTokens: sessionSummary.totalTokens,
            actualTokens: sessionSummary.actualTokens,
            estimatedTokens: sessionSummary.estimatedTokens,
            averageTokens: sessionSummary.averageTokens,
        },
    };

    writeStorage(AI_TOKEN_STATS_KEY, nextStats);
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sci-ai-token-stats-updated', { detail: nextStats }));
    }
}

export function getAIModelRuntimeStatus() {
    const settings = getAIModelSettings();
    const stats = getAITokenStats();
    const lastModel = stats.lastRequest?.model || (settings.modelMode !== 'auto' ? settings.modelMode : LOW_TO_HIGH_MODEL_ORDER[0]);
    const catalog = getAIModelCatalog();
    return {
        mode: settings.modelMode || 'auto',
        contextMode: settings.contextMode || DEFAULT_AI_SETTINGS.contextMode,
        lastModel,
        lastModelLabel: MODEL_INFO[lastModel]?.label || lastModel,
        lastIntent: stats.lastRequest?.intent || '-',
        lastContextCount: Number(stats.lastRequest?.contextCount || 0),
        lastRequestAt: stats.lastRequest?.at || null,
        lastTokenUsage: stats.lastRequest ? {
            totalTokens: Number(stats.lastRequest.totalTokens || 0),
            isEstimated: Boolean(stats.lastRequest.isEstimated),
            source: stats.lastRequest.source || 'unknown',
            selectedDatasets: stats.lastRequest.selectedDatasets || [],
            latencyMs: stats.lastRequest.latencyMs || null,
        } : null,
        escalationOrder: modelOrderForIntent('general', settings),
        catalog,
        totalRequests: Number(stats.requests || 0),
        actualTokens: Number(stats.actualTokens || 0),
        estimatedTokens: Number(stats.estimatedTokens || 0),
    };
}

function partText(part) {
    return String(part?.text || '');
}

function contentText(content) {
    return (content?.parts || []).map(partText).join('');
}

function candidateText(candidate) {
    return contentText(candidate?.content);
}

function responseText(data) {
    return candidateText(data?.candidates?.[0]);
}

function uniqueModels(models) {
    return [...new Set(models.filter(model => MODELS.includes(model)))];
}

function parseJsonLikeText(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;
    const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    const candidate = (fenced?.[1] || raw).trim();
    try {
        return JSON.parse(candidate);
    } catch {
        return null;
    }
}

function coerceStructuredAIResponse(text) {
    const normalized = coerceStructuredAIResponseMarkdown(text, { includeInvalidChartMessage: true });
    return normalized ?? String(text || '').trim();
}

const CONTEXT_SOURCE_LABELS = {
    students: 'Student records / Shared Data Hub',
    tcas: 'TCAS admissions dataset',
    course_analytics: 'Course analytics dataset',
    academic_rules: 'Academic rules dataset',
    tuition: 'Tuition dataset',
    graduation: 'Graduation dataset',
    budget: 'Budget and finance dataset',
    research: 'Research dataset',
    hr: 'HR dataset',
    strategic: 'Strategic OKR dataset',
    alerts: 'Alert Center threshold/filter context',
    student_life: 'Student life dataset',
    dashboard: 'Dashboard summary dataset',
    sci_ai_dashboard_local_first: 'SCI AI Dashboard local-first context',
    maejo_student_faq: 'Maejo student FAQ / official public knowledge',
    trusted_external_fallback: 'Trusted external public sources',
};

const CONTEXT_DATASET_IDS = {
    students: 'student_stats',
    tcas: 'tcas_admissions',
    course_analytics: 'course_analytics',
    academic_rules: 'academic_rules',
    tuition: 'tuition',
    graduation: 'graduation',
    budget: 'science_budget',
    research: 'research',
    hr: 'hr',
    strategic: 'strategic',
    alerts: 'alerts',
    student_life: 'student_life',
    dashboard: 'dashboard_summary',
};

function localContextSourceLines(localContexts = []) {
    return localContexts
        .map(context => context?.id)
        .filter(Boolean)
        .map(id => {
            const label = CONTEXT_SOURCE_LABELS[id] || id;
            const datasetId = CONTEXT_DATASET_IDS[id];
            if (!datasetId) return `- ${label}`;
            const meta = getSharedDashboardDatasetMetaSync(datasetId);
            const sourceType = meta?.sourceType || 'system';
            const updatedAt = meta?.updatedAt instanceof Date
                ? meta.updatedAt.toLocaleString('th-TH')
                : meta?.updatedAt
                    ? new Date(meta.updatedAt).toLocaleString('th-TH')
                    : '';
            const details = [sourceType, updatedAt ? `อัปเดต ${updatedAt}` : ''].filter(Boolean).join(', ');
            if (meta?.sourceUrl) {
                return `- [${safeMarkdownLinkLabel(label)}](${meta.sourceUrl})${details ? ` — ${details}` : ''}`;
            }
            return `- ${label}${details ? ` — ${details}` : ''}`;
        });
}

function safeMarkdownLinkLabel(text) {
    return String(text || 'Source')
        .replace(/[[\]\n\r]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 140) || 'Source';
}

function groundingSourceLines(candidate) {
    const chunks = candidate?.groundingMetadata?.groundingChunks || [];
    const sources = chunks
        .map(chunk => chunk?.web)
        .filter(web => web?.uri && isTrustedAIExternalSource(web.uri))
        .map(web => {
            const label = safeMarkdownLinkLabel(web.title || web.uri);
            return `- [${label}](${web.uri})`;
        });
    return [...new Set(sources)].slice(0, 8);
}

function appendAnswerMetadata(text, { data, localContexts }) {
    const candidate = data?.candidates?.[0];
    const groundedSources = groundingSourceLines(candidate);
    const localSources = localContextSourceLines(localContexts);
    const sourceLines = [...new Set([...localSources, ...groundedSources])].slice(0, 10);
    let output = String(text || '').trim();

    if (sourceLines.length && !output.includes('แหล่งข้อมูลที่ระบบใช้จริง')) {
        output += `\n\n**แหล่งข้อมูลที่ระบบใช้จริง:**\n${sourceLines.join('\n')}`;
    }

    return output.trim();
}

function normalizeNumberToken(value) {
    return String(value || '').replace(/,/g, '').replace(/%/g, '').trim();
}

function extractNumberTokens(text) {
    const cleaned = String(text || '')
        .replace(/https?:\/\/\S+/g, ' ')
        .replace(/```[\s\S]*?```/g, match => match.replace(/[A-Za-z_{}"[\]:,]/g, ' '));
    const matches = cleaned.match(/\b\d{2,}(?:,\d{3})*(?:\.\d+)?%?\b/g) || [];
    return [...new Set(matches.map(normalizeNumberToken).filter(Boolean))];
}

let lastAnswerVerificationMetadata = null;

function appendNumericEvidenceGuardrail(text, { evidenceText, question, useSearch }) {
    const verification = verifyAIAnswerAgainstContext(text, {
        contextText: evidenceText,
        question,
        allowExternalNumbers: useSearch,
    });
    lastAnswerVerificationMetadata = verification.metadata;
    if (verification.metadata?.enabled) return verification.text;

    if (useSearch) return String(text || '').trim();
    const output = String(text || '').trim();
    const answerNumbers = extractNumberTokens(output);
    if (!answerNumbers.length) return output;

    const evidenceNumbers = new Set(extractNumberTokens(`${question || ''}\n${evidenceText || ''}`));
    const unsupported = answerNumbers
        .filter(value => !evidenceNumbers.has(value))
        .filter(value => !/^20\d{2}$/.test(value))
        .filter(value => !/^25\d{2}$/.test(value))
        .slice(0, 6);

    if (!unsupported.length) return output;
    if (/ข้อควรระวัง:.*ตัวเลข/.test(output)) return output;
    return `${output}\n\n> ข้อควรระวัง: มีตัวเลขบางส่วน (${unsupported.join(', ')}) ที่ไม่พบตรงใน context ที่ส่งให้ AI รอบนี้ จึงควรตรวจสอบจากแหล่งข้อมูลก่อนนำไปใช้ตัดสินใจ`;
}

function emitAIDebugMetadata(meta, callback) {
    const safeMeta = {
        ...meta,
        at: new Date().toISOString(),
    };
    try {
        console.info('[SCI AI] decision metadata', safeMeta);
    } catch {
        // no-op
    }
    try {
        callback?.(safeMeta);
    } catch (error) {
        console.warn('[SCI AI] metadata callback failed:', error?.message || error);
    }
    try {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sci-ai-debug-metadata', { detail: safeMeta }));
        }
    } catch {
        // no-op
    }
}

function normalizeCacheText(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 12000);
}

function currentConversationCacheScope() {
    return conversationHistory
        .slice(-4)
        .map(item => `${item.role}:${(item.parts || []).map(partText).join(' ').slice(0, 220)}`)
        .join('|');
}

function shouldScopeCacheToHistory(question) {
    const q = String(question || '').toLowerCase();
    return /อันนี้|เรื่องนี้|ก่อนหน้า|เมื่อกี้|ด้านบน|ต่อจาก|แล้วถ้า|แล้วกรณี|แล้วแบบ/.test(q);
}

function buildAIResponseCacheKey({ finalMessage, originalQuestion, userContext, settings, useSearch }) {
    const settingScope = {
        modelMode: settings.modelMode,
        contextMode: settings.contextMode,
        maxContexts: settings.maxContexts,
        allowWebSearch: Boolean(settings.allowWebSearch),
        theme: settings.theme || 'light',
    };
    return JSON.stringify({
        q: normalizeCacheText(finalMessage || originalQuestion),
        role: userContext?.role || 'general',
        uid: userContext?.uid || userContext?.email || 'anonymous',
        useSearch: Boolean(useSearch),
        settings: settingScope,
        rows: getStudentListSync().length,
        freshness: getSharedDashboardFreshnessContext(),
        history: shouldScopeCacheToHistory(originalQuestion) ? currentConversationCacheScope() : '',
    });
}

function readAIResponseCache(cacheKey, useSearch) {
    const entry = aiResponseCache.get(cacheKey);
    if (!entry) return null;
    const ttl = useSearch ? AI_WEB_RESPONSE_CACHE_TTL_MS : AI_RESPONSE_CACHE_TTL_MS;
    if (Date.now() - entry.at > ttl) {
        aiResponseCache.delete(cacheKey);
        return null;
    }
    return entry.text;
}

function writeAIResponseCache(cacheKey, text, useSearch) {
    if (!cacheKey || !text) return;
    aiResponseCache.set(cacheKey, { text, at: Date.now(), useSearch: Boolean(useSearch) });
    while (aiResponseCache.size > AI_RESPONSE_CACHE_MAX_ENTRIES) {
        const oldestKey = aiResponseCache.keys().next().value;
        aiResponseCache.delete(oldestKey);
    }
}

function resolveMaxOutputTokens(settings, intent, isChartRequest, useSearch) {
    const requested = Number(settings.maxOutputTokens) || DEFAULT_AI_SETTINGS.maxOutputTokens;
    if (isChartRequest) return Math.min(requested, 4096);
    if (useSearch) return Math.min(requested, 2048);
    if (intent === 'lookup' || intent === 'general') return Math.min(requested, 1536);
    if (intent === 'analysis') return Math.min(requested, 3072);
    return Math.min(requested, DEFAULT_AI_SETTINGS.maxOutputTokens);
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
    const publicTopic = /tcas|admission|รับสมัคร|สมัคร|เปิดรับ|รอบ\s*[1-4]|portfolio|quota|โควตา|direct\s*admit|directadmit|รับเข้า|แรกเข้า|ค่าเทอม|ค่าธรรมเนียม|ค่าเล่าเรียน|ชำระ|ค้างจ่าย|ค้างชำระ|กำหนดการ|ปฏิทิน|ประกาศ|ข่าว|หลักสูตร|เกณฑ์|คะแนน|ทะเบียน|reg\.mju|registrar|งบประมาณ|งบ|รายรับ|รายจ่าย|budget|ยุทธศาสตร์|กลยุทธ์|แผนพัฒนา|แผนปฏิบัติ|คำรับรอง|kpi|okr|ตัวชี้วัด|รายงานประจำปี/.test(q);
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
    if (/กราฟ|chart|json_chart|plot|แผนภูมิ|แผนภาพ|course_analytics|วิชาไหนยาก|วิชาไหนง่าย|เกรดรายวิชา|กระจายเกรด|grade distribution/.test(q)) return false;
    if (isDashboardDataQuery(q)) return false;
    if (isMaejoPublicFallbackQuery(q)) return true;
    if (isGeneralMaejoQuery(q)) return true;

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

async function postGeminiModel(model, requestBody, options = {}) {
    return fetchSmart(GEMINI_PROXY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            requestBody,
            stream: options.stream === true,
            usageUser: options.user ? {
                uid: options.user.uid || '',
                role: options.user.role || '',
                email: options.user.email || '',
            } : undefined,
            usageMeta: options.usageMeta || undefined,
        }),
    });
}

function parseGeminiSseEvent(eventText) {
    const dataLines = String(eventText || '')
        .split(/\r?\n/)
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trim())
        .filter(Boolean);
    if (!dataLines.length) return null;
    const dataText = dataLines.join('\n');
    if (dataText === '[DONE]') return { done: true };
    return parseJsonLikeText(dataText);
}

async function readGeminiStream(response, onChunk) {
    if (!response.body?.getReader) {
        const data = await response.json();
        return { text: responseText(data), data };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    let lastData = null;

    const handleEvent = (eventText) => {
        const data = parseGeminiSseEvent(eventText);
        if (!data || data.done) return;
        lastData = data;
        const delta = responseText(data);
        if (!delta) return;
        text += delta;
        onChunk?.(text, delta);
    };

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || '';
        events.forEach(handleEvent);
    }

    buffer += decoder.decode();
    if (buffer.trim()) handleEvent(buffer);
    return { text, data: lastData };
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

    const liveStudentStatsData = getSharedDashboardDatasetSync('student_stats') || studentStatsData;
    const liveTcasData = getSharedDashboardDatasetSync('tcas_admissions') || tcasPlanningData;
    const liveCourseData = getSharedDashboardDatasetSync('course_analytics') || courseAnalyticsData;
    const liveUniversityBudgetData = getSharedDashboardDatasetSync('university_budget') || universityBudgetData;
    const liveScienceBudgetData = getSharedDashboardDatasetSync('science_budget') || scienceFacultyBudgetData;
    const liveStudentLifeData = getSharedDashboardDatasetSync('student_life') || studentLifeData;
    const liveTuitionData = getSharedDashboardDatasetSync('tuition') || tuitionData;
    const liveGraduationData = getSharedDashboardDatasetSync('graduation') || {};
    const liveResearchData = getSharedDashboardDatasetSync('research') || researchData;
    const liveHrData = getSharedDashboardDatasetSync('hr') || hrData;
    const liveStrategicData = getSharedDashboardDatasetSync('strategic') || strategicData;
    const graduationMeta = getSharedDashboardDatasetMetaSync('graduation');
    const researchMeta = getSharedDashboardDatasetMetaSync('research');
    const scienceStudentStats = liveStudentStatsData.scienceFaculty || studentStatsData.scienceFaculty || {};
    const scienceByLevelRows = Array.isArray(scienceStudentStats.byLevel) ? scienceStudentStats.byLevel : [];
    const scienceByMajorRows = Array.isArray(scienceStudentStats.byMajor) && scienceStudentStats.byMajor.length > 0
        ? scienceStudentStats.byMajor
        : Object.entries(majorCounts).map(([major, count]) => ({ major, total: count, count }));
    const scienceStudentTotal = Number(scienceStudentStats.total || studentList.length || 0);
    const personnel = scienceStudentStats.personnel || studentStatsData.scienceFaculty.personnel;
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
    const ratio = scienceStudentStats.studentFacultyRatio || studentStatsData.scienceFaculty.studentFacultyRatio;
    const facultyRatio = {
        ...ratio,
        students: studentList.length,
        ratio: ratio.academicStaff ? (studentList.length / ratio.academicStaff).toFixed(1) : ratio.ratio,
    };
    const budgetAll = liveUniversityBudgetData.yearly || universityBudgetData.yearly;
    const sciBudgetAll = liveScienceBudgetData.yearly || scienceFacultyBudgetData.yearly;
    const activities = liveStudentLifeData;
    const scienceActivities = Array.isArray(activities.scienceActivities)
        ? activities.scienceActivities.filter(event => event.facultyHours)
        : [];
    const activityHours = activities.activityHours || {};
    const activityCategories = Array.isArray(activityHours.categories) ? activityHours.categories : [];
    const activityMissingHours = Math.max(0, Number(activityHours.target || 0) - Number(activityHours.completed || 0));
    const tuition = liveTuitionData;
    const graduationRows = liveGraduationData.history || liveGraduationData.graduationHistory || graduationHistory;
    const graduationCurrent = liveGraduationData.current || liveGraduationData.currentGraduationStats || currentGraduationStats;
    const graduationMajors = liveGraduationData.byMajor || liveGraduationData.graduationByMajor || graduationByMajor;
    const graduationHonors = liveGraduationData.honors || honorsData;
    const graduationDistribution = liveGraduationData.gpaDistribution || gpaDistribution;
    const researchOverview = liveResearchData.overview || liveResearchData.summary || researchData.overview;
    const researchPublicationTrend = liveResearchData.publicationTrend || liveResearchData.publicationsTrend || researchData.publicationTrend || [];
    const researchDepartments = liveResearchData.byDepartment || researchData.byDepartment || [];
    const researchFundingTrend = liveResearchData.fundingTrend || researchData.fundingTrend || [];
    const researchFundingSources = liveResearchData.fundingSources || researchData.fundingSources || [];
    const researchPatents = liveResearchData.patents || researchData.patents || [];
    const researchBenchmark = liveResearchData.benchmark || researchData.benchmark || [];
    const hrUniversity = liveHrData.university || hrData.university || {};
    const hrScience = liveHrData.scienceFaculty || liveHrData.summary || hrData.scienceFaculty || {};
    const hrAcademicPositions = hrScience.academicPositions || hrScience.byPosition || [];
    const hrEducation = hrScience.byEducation || [];
    const hrDepartments = hrScience.byDepartment || [];
    const hrTrend = hrScience.trend || hrScience.trends || [];
    const hrAgeGroup = hrScience.diversity?.ageGroup || hrScience.ageGroup || [];
    const hrRetirementIn5Years = hrScience.diversity?.retirementIn5Years ?? hrScience.retirementIn5Years ?? '-';
    const hrRatioTrend = hrScience.studentFacultyRatio || hrScience.studentFacultyRatioTrend || [];
    const strategicGoals = liveStrategicData.strategicGoals || [];
    const strategicOkr = liveStrategicData.okr || { period: '-', objectives: [] };
    const strategicRadar = liveStrategicData.performanceRadar || { categories: [], currentYear: [], targetYear: [], lastYear: [] };
    const strategicEfficiencyTrend = liveStrategicData.efficiencyTrend || [];
    const tcasTrend = liveTcasData.fiveYearTrend || [];
    const tcasRound3Plan = liveTcasData.round3Plan2569 || [];
    const courseGradeRows = liveCourseData.gradeDistributions || [];
    const branchStrengthRows = liveCourseData.branchStrengths || [];

    const dataTimestamp = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

    return `You are "${AI_ASSISTANT_NAME}", an intelligent AI assistant for "${APP_NAME_EN}" (${APP_NAME_TH}).

═══════════════════════════════════════════
 SECTION 1 — ROLE & ACCESS
═══════════════════════════════════════════
Access: Role-aware decision intelligence only. Use the current role policy and retrieved context registry; never assume super-admin access.
Purpose: Statistical analysis & Data Visualization (charts/graphs) for strategic planning.
Language: ตอบภาษาไทย กระชับ ใช้ emoji ยกเว้นผู้ใช้ถามเป็นภาษาอังกฤษ
Data Freshness: ข้อมูลในระบบอัปเดตล่าสุด ณ ${dataTimestamp}
Mandate:
• University-grade decision intelligence behavior:
  - Product quality bar: behave like an enterprise AI data assistant in the spirit of Microsoft Copilot, Tableau Pulse, ThoughtSpot, Retool AI, and Linear-style product UX: grounded, concise, explainable, action-oriented, low-friction, and visually/chart aware.
  - Adapt that quality bar to a Thai university setting: use Maejo/Faculty of Science language such as คณะ, สาขาวิชา, TCAS, ปีการศึกษา, ภาคเรียน, เกียรตินิยม, คณบดี, ประธานหลักสูตร, อาจารย์, เจ้าหน้าที่.
  - Do not sound like a generic chatbot or a marketing assistant; sound like a trusted university decision analyst.
  - For decision questions, answer in this order: short executive summary -> evidence from data -> risks/limitations -> recommendations -> sources used.
  - Separate facts from analytical recommendations. Do not present recommendations as facts.
  - If the question does not match any dataset, answer as general Maejo/public knowledge and clearly say no internal dataset was used.
  - If data is insufficient, ask one targeted follow-up question or state the missing dataset instead of guessing.
  - Never cite a dataset name unless it appears in the retrieved context list for this request.
• MUST answer every question resolvable from the DATA below. Never refuse when data exists.
• MUST NOT fabricate numbers. If data is genuinely absent → state: "ข้อมูลนี้ไม่มีในระบบปัจจุบัน แต่มีข้อมูลที่เกี่ยวข้อง ได้แก่..." then list available related data.
• DATA QUALITY RULE: Treat missing/null/undefined as "ยังไม่มีข้อมูลจริง"; treat numeric 0 as "ศูนย์จริง" only when the source says actual/live; if source quality is fallback, say "ข้อมูลสำรอง/รอ sync" instead of presenting it as official.
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

### TABLE: science_student_stats_current (หน้าสถิตินิสิตปัจจุบัน)
- scope: คณะวิทยาศาสตร์เท่านั้น; ถ้าผู้ใช้ถามสถิตินิสิต/นักศึกษาของหน้านี้ ให้ใช้ชุดนี้ก่อนเสมอ
- total: ${scienceStudentTotal.toLocaleString('th-TH')} คน
- byLevel: ${scienceByLevelRows.map(row => `${row.level}:${Number(row.count || 0).toLocaleString('th-TH')}คน`).join(', ')}
- byMajor: ${scienceByMajorRows.map(row => `${row.major || row.name}:${Number(row.total ?? row.count ?? 0).toLocaleString('th-TH')}คน`).join(', ')}
- answer rule: คำถาม "จำนวนนิสิตแต่ละสาขา/แยกตามสาขา" ให้ตอบจาก byMajor และสร้างกราฟแท่งตามสาขา ห้ามใช้ตาราง byFaculty ของทั้งมหาวิทยาลัยแทน เว้นแต่ผู้ใช้ระบุชัดว่าอยากดูภาพรวมมหาวิทยาลัย

### TABLE: science_activities (กิจกรรมคณะวิทยาศาสตร์)
- scope: ${activityHours.scope || 'ชั่วโมงกิจกรรมคณะวิทยาศาสตร์เท่านั้น'}
- requirement: target=${activityHours.target ?? '-'}ชม., completed=${activityHours.completed ?? '-'}ชม., missing=${activityMissingHours}ชม.
- categories: ${activityCategories.map(c => `${c.name}:${c.hours}/${c.requiredHours ?? '-'}ชม., events=${c.events ?? '-'}/${c.requiredEvents ?? '-'}`).join(' | ')}
- calendar_events: ${scienceActivities.map(event => `${event.startDate}${event.endDate && event.endDate !== event.startDate ? `-${event.endDate}` : ''}: ${event.title}, type=${event.type}, hours=${event.hours}, status=${event.status}, location=${event.location}`).join('\n')}
- answer rules: ถาม "เดือนนี้/เดือนหน้า/รับน้อง/ไหว้ครู/ชั่วโมงคณะ" ให้ใช้ calendar_events ก่อนเสมอ และบอกว่าเป็นกิจกรรมที่นับชั่วโมงคณะวิทยาศาสตร์เท่านั้น

### TABLE: student_life_behavior
- behaviorScore: ${activities.behaviorScore.score}/${activities.behaviorScore.maxScore}
- behaviorHistory: ${activities.behaviorScore.history.map(h => `${h.semester}:${h.score}`).join(', ')}

### TABLE: graduation (คณะวิทยาศาสตร์)
${graduationRows.map(g => `${g.year}: candidates=${g.candidates ?? '-'}, graduated=${g.graduated}, rate=${g.rate}%, avgGPA=${g.avgGPA}`).join('\n')}

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

### TABLE: tcas_admissions (คณะวิทยาศาสตร์)
- fiveYearTrend: ${tcasTrend.map(row => `${row.year}: plan=${row.plan}, applicants=${row.applicants}, admitted=${row.admitted}, enrolled=${row.enrolled}, retained=${row.retained}, withdrawn=${row.withdrawn}, source=${row.sourceStatus}`).join(' | ')}
- round3Plan2569: ${tcasRound3Plan.map(row => `${row.major}:${row.plan}คน, minGPAX=${row.minGpax}`).join(' | ')}
- rule: ถาม TCAS ย้อนหลัง/แผนรับ/รับเข้า 100 คนออกกี่คน ให้ใช้ TABLE นี้ก่อน ถ้า field เป็น seed_waiting_file ให้บอกชัดว่ารอไฟล์ย้อนหลังจริง

### TABLE: course_grade_analytics (รายวิชา/เกรด/จุดเด่นสาขา)
- programs: ${(liveCourseData.programs || []).join(', ')}
- gradeDistribution: ${courseGradeRows.map(row => `${row.code} ${row.title}: enrolled=${row.enrolled}, avgGPA=${row.avgGpa}, grades=${JSON.stringify(row.grades)}`).join(' | ')}
- branchStrengths: ${branchStrengthRows.map(row => `${row.major}: ${row.strengths?.join(', ')}`).join(' | ')}
- rule: ถามรายวิชา/วิชาน่าสนใจ/วิชาข้ามสาขา/กราฟเกรดรายวิชา/จุดเด่นสาขา ให้ใช้ TABLE นี้ก่อน

### TABLE: personnel (คณะวิทยาศาสตร์)
- total: ${personnel.total} (ชาย${personnel.male}, หญิง${personnel.female})
- byPosition: ${personnel.byPosition.map(p => `${p.position}:${p.count}`).join(', ')}
- byEducation: ${personnel.byEducation.map(e => `${e.level}:${e.count}`).join(', ')}
- byType: ${personnel.byType.map(t => `${t.type}:${t.count}`).join(', ')}
- retirementForecast: ${personnel.retirementForecast.map(r => `${r.year}:retiring=${r.retiring},remaining=${r.remaining}`).join(', ')}
- studentFacultyRatio: ${facultyRatio.ratio}:1 (students=${facultyRatio.students}, staff=${facultyRatio.academicStaff})
- ratioBenchmark: ${ratio.comparison.map(c => `${c.name}:${c.ratio}`).join(', ')}

### TABLE: tuition
- flatRate: ${tuition.flatRate?.min ?? '-'}-${tuition.flatRate?.max ?? '-'} บ./เทอม
- totalCost(4yr): ${tuition.totalCost?.min ?? '-'}-${tuition.totalCost?.max ?? '-'} บ.
- byFaculty: ${(tuition.byFaculty || []).map(f => `${f.name}:${f.fee}`).join(', ')}
- breakdown: ${(tuition.breakdown || []).map(b => `${b.label}:${b.value}%`).join(', ')}

### TABLE: scienceFaculty.enrollmentByYear_live
${buildStudentStatsContextForAI().split('\n').find(line => line.startsWith('ตามปีเข้า/รหัสนักศึกษา:')) || 'ตามปีเข้า/รหัสนักศึกษา: ไม่มีข้อมูล'}

### TABLE: graduation_current (ปีการศึกษาปัจจุบัน ${graduationCurrent.semester || '-'})
- dataQuality: ${getDatasetQualityForAI('graduation', 'สถิติสำเร็จการศึกษา', graduationMeta, { calculated: true })}; note=สถานะปัจจุบันเป็นการคำนวณจาก GPA และชั้นปี ไม่ใช่ผลอนุมัติจบจริงจาก Reg
- ผู้มีสิทธิ์รับปริญญา(ปี4): ${graduationCurrent.totalCandidates ?? '-'}คน
- คาดว่าสำเร็จ: ${graduationCurrent.expectedGraduates ?? '-'} | รอพินิจ: ${graduationCurrent.pending ?? '-'} | ไม่ผ่านเกณฑ์: ${graduationCurrent.notPassed ?? '-'}
- GPA เฉลี่ยผู้มีสิทธิ์: ${graduationCurrent.avgGPA ?? '-'}
- เกียรตินิยม: อันดับ1=${graduationHonors.firstClass ?? '-'}คน, อันดับ2=${graduationHonors.secondClass ?? '-'}คน, ปกติ=${graduationHonors.normal ?? '-'}คน, ต่ำกว่าเกณฑ์=${graduationHonors.belowStandard ?? '-'}คน
- GPADistribution: ${graduationDistribution.map(g => `${g.range}:${g.count}คน`).join(', ')}
- แยกสาขา: ${graduationMajors.map(m => `${m.major}(${m.total}คน,คาดสำเร็จ${m.rate}%,GPA${m.avgGPA})`).join(' | ')}

### TABLE: research (คณะวิทยาศาสตร์)
- dataQuality: ${getDatasetQualityForAI('research', 'งานวิจัย', researchMeta)}; rule=ถ้า quality=fallback ให้บอกว่าเป็นข้อมูลสำรอง/รอ sync ไม่ใช่ข้อมูล official live
- overview: publications=${researchOverview.totalPublications ?? '-'}, funding=${researchOverview.totalFunding ?? '-'}ล้านบาท, patents=${researchOverview.totalPatents ?? '-'}, citations=${researchOverview.totalCitations ?? '-'}, h-index=${researchOverview.hIndex ?? '-'}, activeProjects=${researchOverview.activeProjects ?? '-'}
- publicationTrend: ${researchPublicationTrend.map(p => `${p.year}(${p.type || 'actual'}):scopus=${p.scopus},tci1=${p.tci1},total=${p.total}`).join(', ')}
- byDepartment: ${researchDepartments.map(d => `${d.dept}(pub=${d.publications},fund=${d.funding}M,pat=${d.patents},cite=${d.citations})`).join(' | ')}
- fundingTrend: ${researchFundingTrend.map(f => `${f.year}(${f.type}):internal=${f.internal},external=${f.external},industry=${f.industry},total=${f.total}ล้าน`).join(', ')}
- fundingSources: ${researchFundingSources.map(s => `${s.source}:${s.amount}ล้าน`).join(', ')}
- patents: ${researchPatents.map(p => `${p.id}:${p.title}(${p.dept},${p.year},${p.status})`).join(' | ')}
- benchmark: ${researchBenchmark.map(b => `${b.university}(scopus=${b.scopus},h=${b.hIndex},pat=${b.patents})`).join(' | ')}

### TABLE: hr_detailed (บุคลากร)
- มหาวิทยาลัย: total=${hrUniversity.total ?? '-'}(สายวิชาการ${hrUniversity.academic ?? '-'},สายสนับสนุน${hrUniversity.support ?? '-'})
- มหาวิทยาลัยbyType: ${(hrUniversity.byType || []).map(t => `${t.type}:${t.count}`).join(', ')}
- คณะวิทย์: total=${hrScience.total ?? '-'}(วิชาการ${hrScience.academic ?? '-'},สนับสนุน${hrScience.support ?? '-'})
- คณะวิทย์ตำแหน่งวิชาการ: ${hrAcademicPositions.map(p => `${p.position}:${p.count}`).join(', ')}
- คณะวิทย์วุฒิ: ${hrEducation.map(e => `${e.level}:${e.count}`).join(', ')}
- คณะวิทย์แยกภาควิชา: ${hrDepartments.map(d => `${d.dept}(วิชาการ${d.academic},สนับสนุน${d.support})`).join(' | ')}
- คณะวิทย์trend: ${hrTrend.map(t => `${t.year}(${t.type || 'actual'}):total=${t.total}`).join(', ')}
- ช่วงอายุ: ${hrAgeGroup.map(a => `${a.group}:${a.count}คน`).join(', ')}
- เกษียณใน5ปี: ${hrRetirementIn5Years}คน
- อัตราส่วนนศ./อาจารย์: ${hrRatioTrend.map(r => `${r.year}:${r.ratio}`).join(', ')}

### TABLE: strategic (ยุทธศาสตร์ & OKR)
- เป้าหมายยุทธศาสตร์: ${strategicGoals.map(g => `${g.id}:${g.title}(target=${g.target}${g.unit},current=${g.current}${g.unit})`).join(' | ')}
- KPIs: ${strategicGoals.flatMap(g => (g.kpis || []).map(k => `[${g.id}]${k.name}:target=${k.target},current=${k.current}${k.unit}`)).join(' | ')}
- OKR(${strategicOkr.period}): ${(strategicOkr.objectives || []).map(o => `${o.id}:${o.title}(progress=${o.progress}%)`).join(' | ')}
- KeyResults: ${(strategicOkr.objectives || []).flatMap(o => (o.keyResults || []).map(kr => `${kr.id}:${kr.title}(${kr.current}/${kr.target}${kr.unit},${kr.progress}%)`)).join(' | ')}
- performanceRadar: categories=${(strategicRadar.categories || []).join(',')} | current=[${strategicRadar.currentYear || []}] | target=[${strategicRadar.targetYear || []}] | lastYear=[${strategicRadar.lastYear || []}]
- efficiencyTrend: ${strategicEfficiencyTrend.map(e => `${e.year}(${e.type || 'actual'}):score=${e.score},budgetEff=${e.budgetEfficiency}%,satisfaction=${e.satisfactionScore}`).join(', ')}

═══════════════════════════════════════════
 SECTION 3 — CHART RULES
═══════════════════════════════════════════

Output format: MUST use \`\`\`json_chart\`\`\` (NEVER \`\`\`json\`\`\`):
\`\`\`json_chart
{"chartType":"bar","data":{"labels":["A","B"],"datasets":[{"label":"X","data":[10,20],"backgroundColor":["var(--accent-success)","var(--accent-purple)"]}]}}
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
{"chartType":"scatter","data":{"datasets":[{"label":"GPA vs Hours","data":[{"x":15,"y":3.25},{"x":20,"y":3.41}],"backgroundColor":"color-mix(in srgb, var(--accent-success) 60%, transparent)","pointRadius":8}]},"options":{"scales":{"x":{"title":{"display":true,"text":"X Axis Label"}},"y":{"title":{"display":true,"text":"Y Axis Label"}}}}}
\`\`\`

### Bubble Chart Format (NO labels array, r = radius):
\`\`\`json_chart
{"chartType":"bubble","data":{"datasets":[{"label":"Departments","data":[{"x":52,"y":48,"r":15,"label":"Dept A"},{"x":30,"y":20,"r":8,"label":"Dept B"}],"backgroundColor":"color-mix(in srgb, var(--accent-success) 60%, transparent)"}]}}
\`\`\`

### DUAL-AXIS Bar + Line Format (TIME SERIES ONLY):
Use this only when x-axis labels are years/months/dates. The bar dataset sits on the LEFT y-axis ("y"). The line dataset has \`type:"line"\` and \`yAxisID:"y1"\` pointing to the RIGHT y-axis ("y1"). Both share the same x-axis labels.
\`\`\`json_chart
{"chartType":"bar","data":{"labels":["สาขา1","สาขา2","สาขา3"],"datasets":[{"type":"bar","label":"จำนวนนักศึกษา","data":[120,95,80],"backgroundColor":"var(--accent-success)","yAxisID":"y","order":2},{"type":"line","label":"GPA เฉลี่ย","data":[3.25,3.10,2.95],"borderColor":"var(--accent-purple)","backgroundColor":"color-mix(in srgb, var(--accent-purple) 20%, transparent)","yAxisID":"y1","tension":0.4,"pointRadius":5,"order":1}]},"options":{"scales":{"y":{"type":"linear","position":"left","title":{"display":true,"text":"จำนวนนักศึกษา (คน)"},"beginAtZero":true},"y1":{"type":"linear","position":"right","title":{"display":true,"text":"GPA เฉลี่ย"},"min":0,"max":4,"grid":{"drawOnChartArea":false}}}}}
\`\`\`

### DUAL-AXIS Grouped Bar Format (CATEGORY COMPARISON, NO LINE):
Use this for category labels such as faculties/majors/departments when comparing different units, e.g. GPA vs graduation rate. Do NOT set \`indexAxis:"y"\`.
\`\`\`json_chart
{"chartType":"bar","data":{"labels":["คณะ A","คณะ B","คณะ C"],"datasets":[{"type":"bar","label":"อัตราสำเร็จการศึกษา (%)","data":[91.2,88.5,94.1],"backgroundColor":"color-mix(in srgb, var(--accent-purple) 65%, transparent)","yAxisID":"y","order":2},{"type":"bar","label":"GPA เฉลี่ย","data":[3.18,3.05,3.35],"backgroundColor":"color-mix(in srgb, var(--accent-success) 72%, transparent)","yAxisID":"y1","order":1}]},"options":{"scales":{"y":{"type":"linear","position":"left","title":{"display":true,"text":"อัตราสำเร็จการศึกษา (%)"},"min":0,"max":100},"y1":{"type":"linear","position":"right","title":{"display":true,"text":"GPA เฉลี่ย"},"min":0,"max":4,"grid":{"drawOnChartArea":false}}}}}
\`\`\`

### HORIZONTAL Bar Format (USE WHEN category labels are long Thai text like major/department names):
When labels average >8 Thai characters OR >6 categories, use \`indexAxis:"y"\` so names read horizontally without rotation/truncation.
\`\`\`json_chart
{"chartType":"bar","data":{"labels":["เทคโนโลยีสารสนเทศ","เคมีอุตสาหกรรมและเทคโนโลยีสิ่งทอ","วัสดุศาสตร์"],"datasets":[{"label":"จำนวนนักศึกษา","data":[120,95,80],"backgroundColor":["var(--accent-success)","var(--accent-purple)","var(--accent-info)"]}]},"options":{"indexAxis":"y","scales":{"x":{"beginAtZero":true,"title":{"display":true,"text":"จำนวน (คน)"}}}}}
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
• "GPA กับ กิจกรรม" → students.gpa + science_activities → bar chart grouped by major หรือ activity-hours summary
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
Colors: var(--accent-success)(เขียว) var(--accent-purple)(ม่วง) var(--accent-pink)(ชมพู) var(--accent-gold)(ทอง) var(--accent-info)(น้ำเงิน) var(--accent-danger)(แดง) var(--accent-success-deep)(เขียวเข้ม) var(--accent-pink)(บานเย็น) var(--accent-cyan)(ฟ้า) var(--accent-orange)(ส้ม)
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
    const trust = getStudentRosterTrustStatus();
    const sourceLabel = trust.canAnswerDemoIndividual
        ? 'generated mock ที่ปรับจำนวนตาม Overview; ใช้สาธิตเท่านั้น'
        : isLiveData()
        ? 'realtime จาก Firestore/การอัปโหลดล่าสุด'
        : 'ข้อมูลที่เว็บใช้อยู่ตอนนี้';
    // Compact JSON keeps tokens low even when a full roster is uploaded.
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
    const q = String(msg || '').toLowerCase();
    const skipDomains = ['งานวิจัย', 'ตีพิมพ์', 'scopus', 'สิทธิบัตร', 'ทุนวิจัย', 'citation',
        'ยุทธศาสตร์', 'okr', 'kpi', 'บุคลากร', 'ตำแหน่งวิชาการ', 'เกษียณ', 'ภาควิชา'];
    if (skipDomains.some(k => q.includes(k))) return false;

    return isStudentRowLookupQuestion(q);
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
        return uniqueModels([...LOW_TO_HIGH_SEARCH_MODEL_ORDER, ...LOW_TO_HIGH_MODEL_ORDER]);
    }
    return uniqueModels(LOW_TO_HIGH_MODEL_ORDER);
}

function hasHigherTierRemaining(model, candidateModels = []) {
    const currentRank = MODEL_TIER_RANK[model] || 1;
    const currentIndex = candidateModels.indexOf(model);
    return candidateModels
        .slice(Math.max(0, currentIndex + 1))
        .some(candidate => (MODEL_TIER_RANK[candidate] || 1) > currentRank);
}

function shouldEscalateAnswerQuality(text, model, candidateModels = [], { blockedReason = '' } = {}) {
    const answer = String(text || '').trim();
    if (!answer || !hasHigherTierRemaining(model, candidateModels)) return false;
    if (blockedReason || /ไม่มีสิทธิ์|สิทธิ์ของ role|permission|access denied/i.test(answer)) return false;
    if (/```json_chart|chartJson|แหล่งข้อมูลที่ใช้/i.test(answer) && answer.length > 450) return false;

    const weakPatterns = [
        /ไม่พบข้อมูล(?:ที่เกี่ยวข้อง|ในระบบ|ในบริบท|ใน context)?/i,
        /ไม่มีข้อมูล(?:เพียงพอ|ในระบบ|ในบริบท|ที่เกี่ยวข้อง)?/i,
        /ไม่สามารถ(?:ตอบ|วิเคราะห์|สร้างกราฟ|ให้คำตอบ)/i,
        /ตอบไม่ได้|ยังตอบไม่ได้|ไม่ทราบ|ไม่แน่ใจ/i,
        /กรุณา(?:ระบุ|ให้ข้อมูล|อัปโหลด|เพิ่มข้อมูล)/i,
        /I (?:do not|don't) have enough information/i,
    ];

    return weakPatterns.some(pattern => pattern.test(answer));
}

function domainAllowed(role, domain) {
    return canAIUseInternalDomain(role, domain);
}

function liveDatasetContext(id, label, { adviceMode = false } = {}) {
    const meta = getSharedDashboardDatasetMetaSync(id);
    const currentData = getSharedDashboardDatasetSync(id);
    const trustLevel = getExecutiveAdviceTrustLevel(meta, { datasetId: id });
    if (adviceMode && !isTrustedForExecutiveAdvice(meta, { datasetId: id })) {
        return {
            data: null,
            sourceLabel: null,
            missing: executiveAdviceDatasetStatus(meta, `${label} (${id})`, { datasetId: id }),
            untrusted: true,
            dataTrust: trustLevel,
        };
    }
    if (currentData) {
        const updated = meta.updatedAt ? `, updated=${meta.updatedAt.toLocaleString('th-TH')}` : '';
        const linked = meta.usesSharedDataHub ? `, linked students=${meta.linkedStudentRows || 0}` : '';
        const referenceLabel = trustLevel === 'approved_reference'
            ? `approved_reference: ข้อมูลอ้างอิงที่เว็บใช้ตอนนี้${updated}${linked}`
            : `ข้อมูลที่เว็บใช้อยู่ตอนนี้${linked}`;
        return {
            data: currentData,
            sourceLabel: meta.isLive ? `realtime${updated}${linked}` : referenceLabel,
            missing: null,
            dataTrust: trustLevel,
        };
    }

    return {
        data: null,
        missing: `${label}: ยังไม่มีข้อมูลในระบบปัจจุบัน (status=${meta.sourceType || 'empty'})`,
        dataTrust: trustLevel,
    };
}

function isStudentTopGpaQuery(question = '') {
    const q = String(question || '').toLowerCase();
    return /(gpa|เกรด|คะแนนเฉลี่ย|เกรดเฉลี่ย).*(สูงสุด|มากสุด|มากที่สุด|top)|(?:สูงสุด|มากสุด|มากที่สุด|top).*(gpa|เกรด|คะแนนเฉลี่ย|เกรดเฉลี่ย)/.test(q);
}

function isStudentLowGpaQuery(question = '') {
    const q = String(question || '').toLowerCase();
    return /(gpa|เกรด|คะแนนเฉลี่ย|เกรดเฉลี่ย).*(ต่ำสุด|น้อยสุด|น้อยที่สุด|ต่ำ|รอพินิจ|เสี่ยง)|(?:ต่ำสุด|น้อยสุด|น้อยที่สุด).*(gpa|เกรด|คะแนนเฉลี่ย|เกรดเฉลี่ย)|รอพินิจ|เกรดต่ำ|กลุ่มเสี่ยง|เสี่ยงพ้นสภาพ/.test(q);
}

function isStudentRowLookupQuestion(question = '') {
    const q = String(question || '').toLowerCase();
    if (/\b6\d{9}\b/.test(q)) return true;
    if (/(?:รหัส|id)\s*\d{2,}/i.test(q)) return true;
    if (/(ค้นหานักศึกษา|หานักศึกษา|ชื่อนักศึกษา|ชื่อนิสิต)/.test(q)) return true;
    if (/รายชื่อ/.test(q) && /(นักศึกษา|นิสิต|รหัส|gpa|เกรด|คะแนนเฉลี่ย|เกรดเฉลี่ย|ชั้นปี|สาขา|รอพินิจ|เสี่ยง|เกียรตินิยม)/.test(q)) return true;
    if (isStudentTopGpaQuery(q) || isStudentLowGpaQuery(q)) return true;
    if (/(เกียรตินิยม).*(รายชื่อ|ใครบ้าง|คนไหน|top|\d+\s*(คน|ราย|อันดับ)?)/.test(q)) return true;
    return false;
}

function parseStudentDetailLimit(question = '', fallback = 10) {
    const q = String(question || '').toLowerCase();
    const match = q.match(/top\s*(\d+)/i) || q.match(/(\d+)\s*(คน|ราย|รายการ|อันดับ)?/);
    const limit = Number(match?.[1]);
    if (!Number.isFinite(limit) || limit <= 0) return fallback;
    return Math.min(Math.max(Math.trunc(limit), 1), 50);
}

function studentDetailRowsForPrompt(list = [], question = '') {
    const wantsTop = isStudentTopGpaQuery(question);
    const wantsLow = isStudentLowGpaQuery(question);
    if (wantsTop || wantsLow) {
        const direction = wantsLow ? 'asc' : 'desc';
        return list
            .filter(student => Number.isFinite(Number(student.gpa)))
            .sort((a, b) => {
                const diff = direction === 'asc'
                    ? Number(a.gpa) - Number(b.gpa)
                    : Number(b.gpa) - Number(a.gpa);
                if (diff !== 0) return diff;
                return String(a.id || '').localeCompare(String(b.id || ''), 'th');
            })
            .slice(0, parseStudentDetailLimit(question, 10));
    }
    return list.slice(0, 40);
}

function studentAggregateContext(includeRows = false, { adviceMode = false, question = '' } = {}) {
    const rosterTrust = getStudentRosterTrustStatus();
    const reconcile = getStudentReconciliationSnapshot();
    const canUseRealRows = rosterTrust.canAnswerIndividual;
    const canUseRows = adviceMode ? canUseRealRows : rosterTrust.canUseForChatRows;
    if (adviceMode && !canUseRealRows) {
        return `ข้อมูลนักศึกษาคณะวิทยาศาสตร์: ยังไม่พร้อมสำหรับคำแนะนำเชิงบริหารจากสถานการณ์จริงในระดับรายคน/รายสาขาจากรายชื่อ เพราะ datasets/students เป็น ${rosterTrust.accuracyLabel} ต้อง sync Firestore หรืออัปโหลดไฟล์นักศึกษาจริงก่อน\nยอดรวมทางการที่ใช้ตอบได้: ${reconcile.officialTotal ?? 'unknown'} คน จาก ${reconcile.officialSourceLabel}`;
    }
    const list = canUseRows ? getStudentListSync() : [];
    const sourceLabel = canUseRows
        ? rosterTrust.canAnswerDemoIndividual
            ? 'generated mock aligned to Overview; demo-only realtime lookup'
            : (isLiveData() ? 'live/realtime' : rosterTrust.accuracyLabel)
        : 'official aggregate only; no usable student rows';
    const stats = getSharedDashboardDatasetSync('student_stats') || {};
    const scienceStats = stats.scienceFaculty || {};
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
    const liveMajorRows = Array.isArray(scienceStats.byMajor) && scienceStats.byMajor.length > 0
        ? scienceStats.byMajor
        : [];
    const majorSummary = liveMajorRows.length > 0
        ? liveMajorRows.map(row => {
            const count = Number(row.total ?? row.count ?? 0);
            const gpa = row.avgGPA ?? row.avgGpa;
            return `${row.major || row.name}: ${count.toLocaleString('th-TH')} คน${gpa ? `, GPA เฉลี่ย ${Number(gpa).toFixed(2)}` : ''}`;
        }).join('\n')
        : Object.entries(byMajor).map(([major, v]) =>
            `${major}: ${v.count} คน, GPA เฉลี่ย ${(v.gpaSum / Math.max(1, v.count)).toFixed(2)}`
        ).join('\n');
    const levelSummary = Array.isArray(scienceStats.byLevel)
        ? scienceStats.byLevel.map(row => `${row.level}:${Number(row.count || 0).toLocaleString('th-TH')} คน`).join(', ')
        : '';
    const contextTotal = Number(reconcile.currentDashboardTotal ?? reconcile.officialTotal ?? scienceStats.total ?? list.length ?? 0);
    const yearSummary = Object.entries(byYear).map(([year, count]) => `ปี ${year}: ${count} คน`).join(', ');
    const rowLabel = isStudentTopGpaQuery(question)
        ? 'แถวที่เกี่ยวข้องเรียง GPA สูงสุดตามคำถาม'
        : isStudentLowGpaQuery(question)
            ? 'แถวที่เกี่ยวข้องเรียง GPA ต่ำสุด/กลุ่มเสี่ยงตามคำถาม'
            : 'ตัวอย่างแถวที่เกี่ยวข้อง';
    const rows = includeRows && canUseRows
        ? `\n${rowLabel}:\n${studentDetailRowsForPrompt(list, question).map(s => `${s.id}, ${s.name}, ${s.major}, ปี ${s.year}, GPA ${s.gpa}, ${s.status}`).join('\n')}`
        : includeRows && !canUseRows
            ? '\nรายชื่อรายบุคคล: ไม่แนบ เพราะยังไม่มี roster ที่ใช้ตอบได้'
        : '';
    const rowScope = rosterTrust.canAnswerDemoIndividual
        ? 'จาก generated mock เพื่อสาธิต ไม่ใช่ข้อมูล Reg จริง'
        : 'จากรายชื่อจริง/ไฟล์อัปโหลด';
    const totalLabel = reconcile.manualOverlayActive
        ? `ยอด Dashboard ปัจจุบันหลัง manual adjustment (ฐาน Sync ${reconcile.officialTotal ?? 'unknown'})`
        : 'ยอด Sync จาก MJU Dashboard';
    return `ข้อมูลนักศึกษาคณะวิทยาศาสตร์ (${sourceLabel})\n${totalLabel}: ${contextTotal.toLocaleString('th-TH')} คน\nสถานะรายชื่อรายคน: ${reconcile.studentSourceLabel} / ${reconcile.studentRosterAccuracyLabel}; ${reconcile.studentRowsSummary}\n${rosterTrust.canAnswerDemoIndividual ? 'คำเตือนบังคับ: รายชื่อและ GPA ต่อไปนี้เป็นข้อมูลจำลอง ต้องระบุคำว่า generated mock/ข้อมูลจำลองในคำตอบ\n' : ''}${levelSummary ? `ตามระดับจาก MJU Dashboard: ${levelSummary}\n` : ''}${majorSummary ? `ตามสาขา${canUseRows ? rowScope : 'จากข้อมูลทางการเท่าที่มี'}:\n${majorSummary}\n` : ''}${yearSummary && canUseRows ? `ตามชั้นปี${rowScope}: ${yearSummary}\n` : ''}${canUseRows ? `GPA < 2.00: ${atRisk} คน (${rowScope})` : 'ยังไม่มี roster สำหรับตอบรายชื่อ/GPA รายคน'}${rows}`;
}

function budgetContext(options = {}) {
    const universityLive = liveDatasetContext('university_budget', 'งบประมาณมหาวิทยาลัย', options);
    const scienceLive = liveDatasetContext('science_budget', 'งบประมาณคณะวิทยาศาสตร์', options);
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

function graduationContext(options = {}) {
    const live = liveDatasetContext('graduation', 'สถิติสำเร็จการศึกษา', options);
    if (!live.data) return live.missing;

    const history = live.data.history || live.data.graduationHistory || [];
    const current = live.data.current || live.data.currentGraduationStats || {};
    const byMajor = live.data.byMajor || live.data.graduationByMajor || [];
    const honors = live.data.honors || {};
    const distribution = live.data.gpaDistribution || [];
    return `สถิติสำเร็จการศึกษา (${live.sourceLabel}):\n${history.map(g => `${g.year}: สำเร็จ ${g.graduated}, อัตรา ${g.rate}%, GPA เฉลี่ย ${g.avgGPA}`).join('\n')}\nปัจจุบัน: ${JSON.stringify(current)}\nแยกสาขา: ${byMajor.map(m => `${m.major}: ${m.rate}% (${m.expected}/${m.total})`).join('; ')}\nเกียรตินิยม: ${Object.entries(honors || {}).map(([k, v]) => `${k}:${v}`).join(', ')}\nGPA distribution: ${distribution.map(g => `${g.range}:${g.count}`).join(', ')}`;
}

function researchContext(options = {}) {
    const live = liveDatasetContext('research', 'งานวิจัย', options);
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

function hrContext(options = {}) {
    const live = liveDatasetContext('hr', 'บุคลากร', options);
    const compensationContext = `\nExecutive compensation and deduction fallback (sourceTrust=generated_mock, not official payroll):\n${JSON.stringify({
        summary: getExecutiveCompensationSummary(),
        rows: executiveCompensationDemo,
        rule: 'Use only as demo workflow. Do not claim this is real salary data. Real payroll requires authorized HR/Payroll export or API.',
        note: FEATURE_COMPLETION_FALLBACK_NOTE,
    })}`;
    if (!live.data) return `${live.missing}${compensationContext}`;
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
    })}${compensationContext}`;
}

export function getAITokenUsageSessionSummary() {
    return getTokenUsageSessionSummary();
}

function strategicContext(options = {}) {
    const live = liveDatasetContext('strategic', 'ยุทธศาสตร์และ OKR', options);
    if (!live.data) return live.missing;
    const strategicData = live.data;
    return `ยุทธศาสตร์และ OKR (${live.sourceLabel}):\n${JSON.stringify(strategicData)}`;
}

function alertCenterContext() {
    const alerts = getAllAlerts();
    const severityCounts = alerts.reduce((acc, alert) => {
        const key = alert.severity || 'info';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
    const domainCounts = alerts.reduce((acc, alert) => {
        const key = alert.domain || 'ไม่ระบุ';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
    const topAlerts = alerts.slice(0, 12).map(alert => ({
        severity: alert.severity,
        domain: alert.domain,
        title: alert.title,
        metric: alert.metric,
        value: alert.value,
        target: alert.target,
        source: alert.sourceLabel || alert.source,
        suggestedAction: alert.suggestedAction,
    }));
    return `Alert Center filtered conditions:
- ใช้ alert rules/thresholds ของระบบก่อนตอบคำถามเกี่ยวกับความเสี่ยง
- severityCounts=${JSON.stringify(severityCounts)}
- domainCounts=${JSON.stringify(domainCounts)}
- topAlerts=${JSON.stringify(topAlerts)}`;
}

function academicRulesContext() {
    return buildAcademicRulesContext();
}

function tuitionContext(options = {}) {
    const live = liveDatasetContext('tuition', 'ค่าเล่าเรียน', options);
    const paymentLedger = buildStudentPaymentLedgerDemo(getStudentListSync(), { limit: 60 });
    const paymentContext = `\nStudent payment ledger fallback (sourceTrust=generated_mock, not official finance data):\n${JSON.stringify({
        summary: summarizeStudentPaymentLedgerDemo(paymentLedger),
        rows: paymentLedger.slice(0, 20),
        rule: 'Use only to demonstrate tuition/late-payment workflow. Real overdue/paid-at dates require MJU Reg/Finance export or API.',
        note: FEATURE_COMPLETION_FALLBACK_NOTE,
    })}`;
    if (!live.data) return `${live.missing}${paymentContext}`;
    const tuitionData = live.data;
    return `ค่าเล่าเรียน (${live.sourceLabel}):\n${JSON.stringify(tuitionData)}${paymentContext}`;
}

function studentAwardsAndPopulationContext() {
    return `Student awards and population forecast fallback context (sourceTrust=generated_mock):\n${JSON.stringify({
        awards: studentAwardRecordsDemo,
        populationForecast: populationForecastReference,
        rule: 'Use as demo/reference only. Say clearly that awards and population scenario are waiting for official Student Affairs and population feeds before production use.',
        note: FEATURE_COMPLETION_FALLBACK_NOTE,
    })}`;
}

function studentLifeContext(options = {}) {
    const live = liveDatasetContext('student_life', 'กิจกรรมคณะวิทยาศาสตร์/ชั่วโมงกิจกรรม', options);
    if (!live.data) return live.missing;
    const studentLifeData = live.data;
    return `กิจกรรมคณะวิทยาศาสตร์และชั่วโมงกิจกรรม (${live.sourceLabel}):\n${JSON.stringify(studentLifeData)}`;
}

function buildTcasApprovedReferenceContext(data = tcasPlanningData, sourceLabel = 'approved_reference: ข้อมูลในหน้า TCAS/ไฟล์อ้างอิงที่เว็บใช้ตอนนี้', dataTrust = 'approved_reference') {
    const summary = getTcasSummary(data);
    const roundPlan = Array.isArray(data.roundPlan2569) ? data.roundPlan2569 : [];
    const round3Plan = Array.isArray(data.round3Plan2569) ? data.round3Plan2569 : [];
    const intakeTarget = Array.isArray(data.intakeTarget2570) ? data.intakeTarget2570 : [];
    const majorOutlook = Array.isArray(data.majorOutlook) ? data.majorOutlook : [];
    const fiveYearTrend = Array.isArray(data.fiveYearTrend) ? data.fiveYearTrend : [];
    const missingRounds = roundPlan
        .filter(row => row.plan == null || row.enrolled == null || /waiting|missing|empty/i.test(String(row.sourceStatus || '')))
        .map(row => row.round)
        .filter(Boolean);
    const missingItems = [
        fiveYearTrend.length === 0 ? 'ข้อมูล TCAS/Reg ย้อนหลัง 5 ปีรายสาขา' : null,
        missingRounds.length > 0 ? `ข้อมูลรายรอบที่ยังไม่ครบ: ${missingRounds.join(', ')}` : null,
        'funnel สมัคร > ผ่านคัดเลือก > ยืนยันสิทธิ์ > รายงานตัว > คงอยู่หลังปี 1',
    ].filter(Boolean);

    return `แผนรับนักศึกษา TCAS คณะวิทยาศาสตร์ (${sourceLabel}; dataTrust=${dataTrust})
คำสั่งใช้งานข้อมูล: ใช้ชุดนี้ตอบคำถาม TCAS/การรับสมัคร/แผนรับแบบ local-first ได้ทันที แม้ยังไม่ใช่ live API โดยให้ระบุว่าเป็นข้อมูลอ้างอิงจากเว็บ/ประกาศ/ไฟล์ในระบบ และห้ามตอบตัดบทว่าไม่มีข้อมูลเพียงเพราะยังรอ sync
summary: รอบ 3 ปี 2569 รวม ${summary.officialRound3Plan || 0} คน; เป้ารับปี 2570 รวม ${summary.intakeTarget2570Total || 0} คน
roundPlan2569: ${JSON.stringify(roundPlan)}
round3Plan2569: ${JSON.stringify(round3Plan)}
intakeTarget2570: ${JSON.stringify(intakeTarget)}
majorOutlook: ${JSON.stringify(majorOutlook)}
sources: ${JSON.stringify(data.sources || [])}
planningAssumptions: ${JSON.stringify(data.planningAssumptions || {})}
missingData: ${missingItems.join(' | ') || '-'}
answer rule: ถ้าถาม "สาขาไหนควรเพิ่มหรือลดแผนรับ" ให้เปรียบเทียบแผนรอบ 3 ปี 2569, เป้าปี 2570, demandIndex/risk/nextAction เท่าที่มี แล้วจัดกลุ่ม เพิ่ม/คง/ลดหรือเฝ้าระวัง พร้อมเหตุผลและข้อจำกัดเรื่องข้อมูลสมัคร-ผ่าน-รายงานตัวที่ยังต้องเชื่อมเพิ่ม
chart rule: ถ้าขอกราฟ TCAS ให้ใช้ intakeTarget2570 หรือ round3Plan2569 จาก context นี้ก่อน`;
}

function tcasContext(options = {}) {
    const live = liveDatasetContext('tcas_admissions', 'แผนรับนักศึกษา TCAS', options);
    if (live.data) {
        return buildTcasApprovedReferenceContext(live.data, live.sourceLabel, live.dataTrust);
    }
    return buildTcasApprovedReferenceContext(
        tcasPlanningData,
        'approved_reference: ข้อมูลในหน้า TCAS/ประกาศทางการและไฟล์ประมาณการที่เว็บใช้ตอนนี้',
        'approved_reference'
    );
}

function courseAnalyticsContext(options = {}) {
    const live = liveDatasetContext('course_analytics', 'รายวิชา เกรด และจุดเด่นสาขา', options);
    if (!live.data) return live.missing;
    return `รายวิชา เกรด และจุดเด่นสาขา (${live.sourceLabel}):\n${JSON.stringify(live.data)}`;
}

function maejoStudentFaqContext(userMessage) {
    return getMaejoStudentFaqContext(userMessage, { limit: 5 });
}

const BUDGET_PRIORITY_PATTERN = /งบ|งบประมาณ|รายรับ|รายจ่าย|การเงิน|ค่าเทอม|ค่าธรรมเนียม|budget|finance|revenue|expense/i;
const COURSE_EXPLICIT_PATTERN = /รายวิชา|วิชาไหน|เกรดรายวิชา|กระจายเกรด|course|grade distribution/i;

function retrieveRelevantContexts(userMessage, userContext = {}, settings = {}) {
    const q = String(userMessage || '').toLowerCase();
    const role = resolveAIRole(userContext);
    const includeStudentRows = needsStudentDetail(userMessage) && canAIUseInternalSection(role, 'student_list');
    const adviceMode = isExecutiveRecommendationIntent(userMessage);
    const contextOptions = { adviceMode, question: userMessage };
    const isBudgetFinanceQuery = BUDGET_PRIORITY_PATTERN.test(q) && !COURSE_EXPLICIT_PATTERN.test(q);
    const isTcasPlanningQuery = /tcas|admission|รับสมัคร|รับเข้า|แผนรับ|portfolio|quota/.test(q);
    const isStudentRecordQuery = /gpa|เกรด|รายชื่อ|รหัส|student\s*id|ชั้นปี|พ้นสภาพ|รอพินิจ|คงอยู่|ลาออก|หายไป|จำนวนนักศึกษาปัจจุบัน/.test(q);
    const candidates = [
        { id: 'maejo_student_faq', sections: [], keywords: /แม่โจ้|maejo|mju|สมัคร|tcas|ลงทะเบียน|ค่าเทอม|ค่าธรรมเนียม|เกียรตินิยม|กฎ|ระเบียบ|กิจกรรม|ชั่วโมง|รายวิชา|วิชา|ที่ตั้ง|ติดต่อ|เบอร์|โทร|คณะวิทย์|คณะวิทยาศาสตร์|เรียนอะไร|เรียนที่ไหน|หอพัก|ปฏิทิน|ประกาศ/i, text: () => maejoStudentFaqContext(userMessage) },
        { id: 'students', sections: ['student_stats', 'student_list'], keywords: /นักศึกษา|นิสิต|student|gpa|เกรด|สาขา|รายชื่อ|รหัส|ชั้นปี|tcas|admission|รับสมัคร|รับเข้า|รอบ/, text: () => studentAggregateContext(includeStudentRows, contextOptions) },
        { id: 'tcas', sections: ['tcas_admissions'], keywords: /tcas|admission|รับสมัคร|รับเข้า|แผนรับ|รอบ\s*tcas|portfolio|quota|ผลกระทบ|ออกกี่คน|ค่าเทอมรวม/i, text: () => tcasContext(contextOptions) },
        { id: 'course_analytics', sections: ['course_analytics'], keywords: /รายวิชา|วิชา|course|เกรดรายวิชา|กระจายเกรด|แผนเรียน|ข้ามสาขา|จุดเด่นสาขา|เชี่ยวชาญ|expertise/i, text: () => courseAnalyticsContext(contextOptions) },
        { id: 'academic_rules', sections: ['academic_rules', 'graduation_check', 'graduation_stats'], keywords: /กฎ|กฏ|ระเบียบ|ข้อบังคับ|เกียรตินิยม|เรียนดี|สำเร็จการศึกษา|พ้นสภาพ|หน่วยกิต|คะแนนความประพฤติ|f\s*หรือ\s*u|gpa\s*3\./i, text: academicRulesContext },
        { id: 'tuition', sections: ['tuition'], keywords: /ค่าเทอม|ค่าเล่าเรียน|tuition|ค่าธรรมเนียม|ชำระ|ค้างจ่าย|ค้างชำระ/, text: () => tuitionContext(contextOptions) },
        { id: 'graduation', sections: ['graduation_check', 'graduation_stats'], keywords: /สำเร็จ|จบ|graduation|เกียรติ|pending|รอพินิจ/, text: () => graduationContext(contextOptions) },
        { id: 'budget', sections: ['budget_forecast', 'financial', 'faculty_budget'], keywords: /งบ|budget|รายรับ|รายจ่าย|เงิน|finance/, text: () => budgetContext(contextOptions) },
        { id: 'research', sections: ['research_overview'], keywords: /วิจัย|research|scopus|citation|สิทธิบัตร|ทุน/, text: () => researchContext(contextOptions) },
        { id: 'hr', sections: ['hr_overview'], keywords: /บุคลากร|อาจารย์|staff|hr|เกษียณ|ตำแหน่ง/, text: () => hrContext(contextOptions) },
        { id: 'strategic', sections: ['strategic_overview'], keywords: /ยุทธศาสตร์|okr|kpi|เป้าหมาย|ตัวชี้วัด/, text: () => strategicContext(contextOptions) },
        { id: 'alerts', sections: ['alert_center'], keywords: /alert|แจ้งเตือน|เตือน|เสี่ยง|วิกฤต|เฝ้าระวัง|threshold|เงื่อนไข/, text: alertCenterContext },
        { id: 'student_life', sections: ['student_life'], keywords: /กิจกรรม|พฤติกรรม|student life|ชั่วโมงกิจกรรม|ชั่วโมงคณะ|รับน้อง|ไหว้ครู|เดือนนี้|เดือนหน้า/, text: () => studentLifeContext(contextOptions) },
    ];

    const scored = candidates
        .filter(c => domainAllowed(role, c.id) || canAIUseAnyInternalSection(role, c.sections))
        .filter(c => !(c.id === 'students' && isTcasPlanningQuery && !isStudentRecordQuery))
        .map(c => {
            let score = c.keywords.test(q) ? 10 : 0;
            if (isBudgetFinanceQuery) {
                if (c.id === 'budget') score += 100;
                if (c.id === 'course_analytics' || c.id === 'maejo_student_faq') score = 0;
            }
            return { ...c, score };
        })
        .filter(c => c.score > 0);

    if (/รางวัล|award|ประชากร|population|พยากรณ์.*นักศึกษา|เงินเดือน|salary|หักเงิน|deduction|ค้างชำระ|จ่ายล่าช้า|paid\s*date/i.test(q)) {
        const fallbackParts = [];
        if (canAIUseAnyInternalSection(role, ['student_stats'])) {
            fallbackParts.push(studentAwardsAndPopulationContext());
        }
        if (canAIUseAnyInternalSection(role, ['hr_overview'])) {
            fallbackParts.push(`Executive compensation fallback:\n${JSON.stringify({
                summary: getExecutiveCompensationSummary(),
                rows: executiveCompensationDemo,
                sourceTrust: 'generated_mock',
                note: FEATURE_COMPLETION_FALLBACK_NOTE,
            })}`);
        }
        if (canAIUseAnyInternalSection(role, ['tuition', 'financial'])) {
            const ledger = buildStudentPaymentLedgerDemo(getStudentListSync(), { limit: 40 });
            fallbackParts.push(`Student payment ledger fallback:\n${JSON.stringify({
                summary: summarizeStudentPaymentLedgerDemo(ledger),
                rows: ledger.slice(0, 16),
                sourceTrust: 'generated_mock',
                note: FEATURE_COMPLETION_FALLBACK_NOTE,
            })}`);
        }
        if (fallbackParts.length) {
            scored.push({
                id: 'feature_completion_fallback',
                score: 9,
                text: () => fallbackParts.join('\n\n'),
            });
        }
    }

    if (scored.length === 0 && domainAllowed(role, 'dashboard')) {
        scored.push({
            id: 'dashboard',
            score: 1,
            text: () => {
                const live = liveDatasetContext('dashboard_summary', 'ภาพรวม Dashboard', contextOptions);
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

function contextBudgetForIntent(intent, settings = {}) {
    const configured = Number(settings.maxContextChars || 0);
    if (Number.isFinite(configured) && configured > 2000) {
        return { total: configured, perContext: Math.max(1200, Math.floor(configured / 4)) };
    }
    if (intent === 'executive_advice') return { total: 12000, perContext: 3000 };
    if (intent === 'chart_analysis' || intent === 'chart') return { total: 14000, perContext: 3400 };
    if (intent === 'web_lookup') return { total: 9000, perContext: 2200 };
    return { total: 10000, perContext: 2600 };
}

function slimContextText(text, limit) {
    const raw = String(text || '').trim();
    if (raw.length <= limit) {
        return { text: raw, originalChars: raw.length, slimmedChars: raw.length, truncated: false };
    }
    const headLength = Math.max(600, Math.floor(limit * 0.72));
    const tailLength = Math.max(260, limit - headLength - 180);
    const head = raw.slice(0, headLength).trimEnd();
    const tail = raw.slice(-tailLength).trimStart();
    const textOut = `${head}\n\n[context_slimmed: omitted ${(raw.length - head.length - tail.length).toLocaleString('en-US')} chars that were less relevant]\n\n${tail}`;
    return {
        text: textOut,
        originalChars: raw.length,
        slimmedChars: textOut.length,
        truncated: true,
    };
}

function slimRetrievedContexts(contexts = [], { intent, settings = {} } = {}) {
    const budget = contextBudgetForIntent(intent, settings);
    let remaining = budget.total;
    let trimmedCount = 0;
    const slimmed = [];

    for (const context of contexts) {
        if (!context?.text || remaining <= 0) continue;
        const limit = Math.max(700, Math.min(budget.perContext, remaining));
        const result = slimContextText(context.text, limit);
        if (result.truncated) trimmedCount += 1;
        remaining -= result.slimmedChars;
        slimmed.push({
            ...context,
            text: result.text,
            originalChars: result.originalChars,
            slimmedChars: result.slimmedChars,
            truncated: result.truncated,
        });
    }

    return {
        contexts: slimmed,
        meta: {
            totalBudgetChars: budget.total,
            perContextBudgetChars: budget.perContext,
            usedChars: slimmed.reduce((sum, context) => sum + Number(context.slimmedChars || 0), 0),
            originalChars: slimmed.reduce((sum, context) => sum + Number(context.originalChars || 0), 0),
            trimmedContextCount: trimmedCount,
            droppedContextCount: Math.max(0, contexts.length - slimmed.length),
        },
    };
}

function maejoLocalFirstContext(userMessage, localContexts = []) {
    const privateLookup = isStudentPrivateLookupQuery(userMessage);
    const adviceMode = isExecutiveRecommendationIntent(userMessage);
    const localContextIds = localContexts.map(c => c.id).join(', ') || 'dashboard';
    return `หลักการตอบแบบ local-first ของ ${APP_NAME_TH}:
- ใช้ข้อมูลในเว็บ/ระบบนี้ก่อนเสมอ โดย context ที่ดึงได้ตอนนี้คือ: ${localContextIds}
- ถ้าข้อมูลในเว็บเราเป็น aggregate เช่น จำนวนนักศึกษาตามสาขา/ชั้นปี ให้ใช้ตอบหรือคำนวณก่อน
- ถ้าถาม TCAS/การรับสมัคร/จำนวนรับเข้าแต่ละรอบ/ค่าเทอม/งบประมาณ/แผนยุทธศาสตร์/KPI/กำหนดการ/ประกาศล่าสุด และใน context ไม่มีตัวเลขหรือไม่มีรายละเอียดรายรอบ ให้ใช้ Google Search grounding ต่อจากแหล่งทางการ
- ถ้าข้อมูลในเว็บมีแค่ snapshot ปัจจุบัน แต่ผู้ใช้ถามแนวโน้มหรือควรทำอะไรต่อ ให้สรุปจาก snapshot เป็น "สัญญาณ/ข้อสังเกตจากข้อมูลปัจจุบัน" และบอกข้อจำกัดเรื่อง time-series ให้ชัด ห้ามหยุดที่คำว่าไม่มีข้อมูล
- ถ้าข้อมูลนอกเว็บเป็นข้อมูลสาธารณะ ให้ใช้เฉพาะแหล่งทางการ/น่าเชื่อถือ และแยกให้ชัดว่าอะไรคือข้อมูลในเว็บเรา อะไรคือข้อมูล fallback ภายนอก
- สาขาคณะวิทยาศาสตร์ที่เว็บเรารู้จัก: ${SCIENCE_MAJORS.join(', ')}
- ข้อมูลทั่วไปที่รู้ในเว็บ: มหาวิทยาลัยแม่โจ้ (Maejo University/MJU/มจ.), วิทยาเขตหลักเชียงใหม่ พร้อมวิทยาเขตแพร่และชุมพร, ใช้แหล่งทางการของมหาวิทยาลัยเป็นหลักเมื่อต้องตรวจข้อมูลล่าสุด
${adviceMode ? '- โหมดคำแนะนำเชิงบริหาร: ใช้ live_official ได้เต็ม และใช้ approved_reference เช่นข้อมูล TCAS จากประกาศทางการ/ไฟล์ในระบบเพื่อคำแนะนำเชิงทิศทางได้พร้อม caveat; ห้ามใช้ mock/demo/sample/generated เป็นฐานคำแนะนำ ถ้า context บอกว่าข้อมูลไม่พร้อมจริงให้บอกข้อจำกัดและรายการข้อมูลที่ต้อง sync/อัปโหลดก่อน' : ''}
${privateLookup ? '- คำถามนี้มีลักษณะข้อมูลรายบุคคล/การเงินของนักศึกษา: ห้ามเดารายชื่อหรือสถานะชำระเงิน ถ้าไม่มี field สถานะชำระในระบบ ให้บอกชัดว่าเว็บเรายังไม่มีข้อมูลส่วนนี้ และให้ค้นเว็บได้เฉพาะกำหนดการ/ประกาศ/ระเบียบค่าธรรมเนียมแบบสาธารณะเท่านั้น' : ''}`;
}

function maejoTrustedFallbackContext() {
    return `Official Maejo/public source priority domains: ${MAEJO_OFFICIAL_SOURCE_DOMAINS.join(', ')}
ถ้าใช้แหล่งอื่นที่ไม่ใช่โดเมนแม่โจ้ ให้บอกว่าเป็นแหล่งภายนอกประกอบเท่านั้น และห้ามใช้เว็บนอกเพื่อเลี่ยงสิทธิ์ข้อมูลภายในที่ role นี้เข้าไม่ถึง

เมื่อต้องใช้ข้อมูลนอกเว็บเรา ให้เรียงความน่าเชื่อถือดังนี้:
1. เว็บไซต์ทางการของมหาวิทยาลัยแม่โจ้และหน่วยงานภายใน เช่น mju.ac.th, admission.mju.ac.th, reg.mju.ac.th, education.mju.ac.th, science.mju.ac.th
2. ประกาศ PDF/ข่าวทางการจากมหาวิทยาลัยหรือคณะ
3. แหล่งรัฐหรือระบบ TCAS ที่เกี่ยวข้อง
หลีกเลี่ยงการใช้เว็บไม่เป็นทางการเมื่อเป็นข้อมูลที่เปลี่ยนบ่อย เช่น TCAS68, จำนวนรับเข้า, ค่าเทอม, ปฏิทิน, เบอร์ติดต่อ และให้ระบุที่มาหรือชื่อแหล่งข้อมูลในคำตอบเมื่อใช้ข้อมูลภายนอก`;
}

function chartPaletteInstruction(theme = 'light') {
    const dark = theme === 'dark';
    const palette = dark
        ? ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)']
        : ['var(--accent-blue)', 'var(--accent-purple)', 'var(--accent-success)', 'var(--accent-orange)', 'var(--accent-danger)', 'var(--accent-cyan)'];
    return `Theme-aware chart palette: current theme=${theme}. Use high-contrast dataset colors only: ${palette.join(', ')}. Avoid black, near-black, low-contrast gray, or dark green chart fills/hover colors.`;
}

function buildAgenticRagInstruction(userMessage, userContext = {}, settings = {}, runtime = {}) {
    const role = resolveAIRole(userContext);
    const roleInfo = getRoleInfo(role);
    const memory = getAIUserMemory(userContext);
    const orchestrationPlan = createAIOrchestrationPlan(userMessage, userContext);
    const rawLocalContexts = runtime.localContexts || retrieveRelevantContexts(userMessage, userContext, settings);
    const retrievalPolicy = runtime.retrievalPolicy || decideAIRetrievalPolicy({
        question: userMessage,
        intent: orchestrationPlan.intent,
        contexts: rawLocalContexts,
        contextBundle: orchestrationPlan.contextBundle,
        allowWebSearch: settings.allowWebSearch,
        shouldUseWebFallback: orchestrationPlan.shouldUseWebFallback,
        blockedReason: orchestrationPlan.blockedReason,
    });
    const useMaejoWebMode = retrievalPolicy.useWebSearch;
    const evidencePackText = formatAIEvidencePackForPrompt(orchestrationPlan.contextBundle, rawLocalContexts, {
        limit: 8,
    });
    if (import.meta.env?.DEV) {
        console.debug('[AI] evidence selection', {
            intent: orchestrationPlan.intent,
            usageMode: orchestrationPlan.usageMode,
            reasoningMode: orchestrationPlan.reasoningMode,
            selectedDatasets: orchestrationPlan.selectedDatasets,
            deniedDatasets: orchestrationPlan.deniedDatasets,
            sourceCount: orchestrationPlan.sourceCount,
        });
    }
    const slimmedLocal = slimRetrievedContexts(rawLocalContexts, {
        intent: orchestrationPlan.intent,
        settings,
    });
    const localContexts = slimmedLocal.contexts;
    const dataAccuracyContext = buildDataAccuracyContextForAI();
    const mjuConnectedContext = buildMjuConnectedContextForAI(userContext);
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
    const contextText = contexts.map((c, idx) => {
        const slimmingNote = c.truncated
            ? `\n[context metadata: originalChars=${c.originalChars}, keptChars=${c.slimmedChars}, slimmed=true]`
            : '';
        return `### Context ${idx + 1}: ${c.id}${slimmingNote}\n${c.text}`;
    }).join('\n\n');
    const roleLabel = roleInfo?.label || userContext?.roleLabel || role;
    const accessNote = getAIAccessInstruction(role, useMaejoWebMode);
    const executiveRecommendationMode = isExecutiveRecommendationIntent(userMessage);
    const reasoningMode = orchestrationPlan.reasoningMode || isAnalyticalReasoningIntent(userMessage);
    const reasoningInstruction = reasoningMode
        ? `REAL REASONING MODE:
- This is an analytical/forecast/trend/risk/comparison/recommendation question. Do not answer from canned templates.
- First use the EVIDENCE PACK and RETRIEVED CONTEXTS to decide which dataset is relevant, whether it is real/live, uploaded, static seed, or mock/sample.
- Do not expose private chain-of-thought. Show only a concise method summary, assumptions, limits, and confidence.
- Separate facts from the selected evidence and analytical recommendations.
- If evidence is mock/sample/generated/static seed, say it is sample/seed context and do not present it as real official data.
- If the user asks for real data but only mock/sample evidence exists, answer: "ตอนนี้ยังไม่มีข้อมูลจริงในระบบ แต่สามารถสาธิตวิธีวิเคราะห์จากข้อมูลตัวอย่างได้" and then provide a best-effort demo analysis with low confidence.
- Forecast method rule: with 2 historical points use simple change/range estimate; with 3-5 points use trend plus scenario; with more than 5 points you may use regression/moving average; if volatility is high, prefer scenarios over a single number.
- Forecast answers must include data used, selected method and reason, estimate/range, uncertainty, confidence, and what data would improve accuracy.
- Validate numbers against the evidence pack. If a number is derived, state the formula or assumption briefly.
- Standard analytical format: สรุปคำตอบสั้น → ข้อมูลที่ใช้ → วิธีวิเคราะห์โดยย่อ/สมมติฐาน → Insight หลัก → ข้อจำกัด/ความเชื่อมั่น → Next action → แหล่งข้อมูลที่ใช้.`
        : '';
    const executiveRecommendationInstruction = executiveRecommendationMode
        ? `EXECUTIVE RECOMMENDATION MODE:
- ผู้ใช้ถามเชิง "ควรวางแผน/แนะนำ/ตัดสินใจ" ให้ตอบเหมือน brief สำหรับคณบดีหรือผู้บริหาร
- โครงคำตอบหลัก: สรุปสถานการณ์ → ความหมายต่อคณะ → ข้อเสนอแนะเชิงบริหาร → KPI/ตัวชี้วัดติดตาม → ข้อมูลที่ควรเชื่อมเพิ่ม
- ข้อเสนอแนะหลักต้องเป็นการตัดสินใจ/แผนที่ทำได้จากข้อมูลปัจจุบัน เช่น แผนรับเข้า, retention, งบ, KPI, เจ้าของงาน, รอบติดตาม
- ห้ามให้คำแนะนำหลักเป็นแค่ "ไปดึงข้อมูลเพิ่ม" หรือ "ต้องหาข้อมูลก่อน"; ถ้าข้อมูลยังขาด ให้ย้ายไปท้ายคำตอบในหัวข้อ "ข้อมูลที่ควรเชื่อมเพิ่มเพื่อยืนยัน"
- ใช้ข้อมูลระดับ live_official เป็นหลัก; ถ้า context ระบุ dataTrust=approved_reference เช่น TCAS จากประกาศทางการ/ไฟล์ในระบบ ให้ตอบ best-effort เชิงทิศทางพร้อมบอกข้อจำกัด ไม่ปฏิเสธทันที
- ห้ามใช้ mock/demo/sample/generated เป็นฐานคำแนะนำเชิงบริหาร ถ้า context บอกว่าข้อมูลจริงยังไม่พร้อม ให้ตอบว่า "ยังให้ข้อเสนอเชิงบริหารจากสถานการณ์จริงไม่ได้" และระบุ dataset ที่ต้อง sync/อัปโหลดก่อน
- ถ้าข้อมูลเป็น snapshot ให้บอกข้อจำกัดสั้นๆ แต่ยังต้องสรุปสัญญาณและแผนบริหารจาก snapshot โดยไม่แต่งตัวเลขใหม่
`
        : '';
    const answerScopeRule = useMaejoWebMode
        ? 'ตอบภาษาไทย กระชับ ใช้ข้อมูลในเว็บ/ระบบนี้ก่อน หากข้อมูลไม่ครบให้ใช้ Google Search จากเว็บทางการหรือแหล่งน่าเชื่อถือเป็น fallback พร้อมบอกแหล่งที่มา และไม่ต้องสร้างกราฟถ้าผู้ใช้ไม่ได้ขอ'
        : 'ตอบภาษาไทย กระชับ อ้างอิงเฉพาะข้อมูลใน RETRIEVED CONTEXTS และห้ามเดาตัวเลข';

    return `You are ${AI_ASSISTANT_NAME} for ${APP_NAME_EN} (${APP_NAME_TH}).
${answerScopeRule}

ROLE CONTEXT:
- role=${role} (${roleLabel})
- ${accessNote}
- unrestricted_internal_access=${isAIUnrestrictedRole(role) ? 'yes' : 'no'}
- user preference memory: preferredFormat=${memory.preferredFormat}, detailLevel=${memory.detailLevel}, frequentTopics=${Object.entries(memory.topics || {}).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v]) => `${k}:${v}`).join(', ') || '-'}

LIVE DATA FRESHNESS:
${getSharedDashboardFreshnessContext()}

DATA ACCURACY / SOURCE STATUS:
${dataAccuracyContext}

MJU CONNECTED IDENTITY / PRIVACY:
${mjuConnectedContext || 'ไม่มี MJU connected identity context สำหรับผู้ใช้นี้'}

AI ORCHESTRATION / CONTEXT REGISTRY:
${formatAIOrchestrationPlanForPrompt(orchestrationPlan)}
${formatAIContextBundleForPrompt(orchestrationPlan.contextBundle)}
${formatAIRetrievalPolicyForPrompt(retrievalPolicy)}

${reasoningInstruction}

${executiveRecommendationInstruction}

TOKEN SAVING RULES:
- Maejo public web mode: ถ้าคำถามเป็นเรื่องทั่วไปหรือข้อมูลสาธารณะของมหาวิทยาลัยแม่โจ้ เช่น ประวัติ คณะ หลักสูตร รับสมัคร TCAS ค่าเทอม ค่าธรรมเนียม งบประมาณ แผนยุทธศาสตร์ KPI ข่าว หน่วยงาน เบอร์ติดต่อ หรือสถานที่ ให้ตรวจ RETRIEVED CONTEXTS ของเว็บเราก่อน แล้วค่อยใช้ Google Search/เว็บทางการเมื่อข้อมูลไม่ครบ
- ห้ามตอบว่า “ไม่พบข้อมูล” ทันทีใน Maejo public web mode จนกว่าจะใช้ทั้ง context ในเว็บเราและ trusted external fallback แล้ว
- ถ้าถามจำนวนรับเข้า TCAS/แต่ละรอบ/ประกาศล่าสุด ให้ค้นจากเว็บทางการล่าสุด และแยกให้ชัดว่า “ข้อมูลในเว็บเรา” กับ “ข้อมูลจากแหล่งภายนอกทางการ”
- ถ้าถามรายชื่อหรือสถานะค้างจ่ายค่าธรรมเนียมรายบุคคล ให้ใช้เฉพาะข้อมูลในระบบที่มีสิทธิ์เท่านั้น ห้ามเดารายชื่อและห้ามอ้างว่าเว็บสาธารณะมีข้อมูลรายบุคคล; ถ้าเว็บเรายังไม่มี field ชำระเงิน ให้บอกว่าไม่มีข้อมูลส่วนนี้ในระบบ พร้อมเสนอว่าต้องเชื่อมฐานทะเบียน/การเงิน แต่สามารถให้ข้อมูลประกาศ/กำหนดการชำระค่าธรรมเนียมจากแหล่งทางการได้
- ถ้าเป็นข้อมูลที่อาจเปลี่ยนบ่อย ต้องบอกตามข้อมูลล่าสุดที่ค้นได้ และถ้าไม่พบหลักฐานให้บอกว่าไม่พบข้อมูลล่าสุดแทนการเดา
- Source priority: ใช้ context ที่ระบุว่า realtime/live ก่อนเสมอ; ถ้ายังไม่มี realtime ให้ใช้ context ที่ระบุว่า "ข้อมูลที่เว็บใช้อยู่ตอนนี้" เพื่อคำนวณ/สร้างกราฟไปก่อน พร้อมบอกแหล่งข้อมูลให้ชัดเจน
- สำหรับคำถามรายวิชา/วิชาไหนยาก/ง่าย ให้ใช้ course_analytics ที่ retrieve ได้ก่อน ถ้าเป็น fallback/seed ให้ตอบแบบ best-effort พร้อม caveat เรื่องรอ Reg export/API ห้ามตอบตัดบทว่าไม่มี API หาก context มี gradeDistribution อยู่แล้ว
- Maejo student FAQ เป็น public knowledge ใช้ตอบคำถามง่ายๆ ของนักศึกษาได้ทุก role แต่ข้อมูลรายบุคคล/งบ/HR/ยุทธศาสตร์ภายในยังต้องเคารพสิทธิ์ role เดิม
- ถ้า context มี snapshot ปัจจุบันแต่ไม่มี time-series ให้ตอบเป็นข้อสังเกตจาก snapshot, ระบุข้อจำกัด, และเสนอ next action เชิงปฏิบัติได้ ห้ามตอบแบบตัดบทว่าไม่สามารถวิเคราะห์ได้
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

EVIDENCE PACK:
${evidencePackText}

RETRIEVED CONTEXTS:
${contextText || 'ไม่มี context ที่เข้าถึงได้สำหรับคำถามนี้'}

CONTEXT SELECTION / SLIMMING:
- selectedContextCount=${localContexts.length}
- originalChars=${slimmedLocal.meta.originalChars}
- keptChars=${slimmedLocal.meta.usedChars}
- trimmedContextCount=${slimmedLocal.meta.trimmedContextCount}
- droppedContextCount=${slimmedLocal.meta.droppedContextCount}`;
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
    const requestStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const settings = saveAIModelSettings({ ...getAIModelSettings(), ...(options.aiSettings || {}) });
    settings.theme = options.theme || settings.theme || (typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : 'light') || 'light';
    const originalQuestion = extractUserQuestionFromPrompt(userMessage);
    const orchestrationPlan = createAIOrchestrationPlan(originalQuestion, options.user || {}, {
        uploadedFileData: options.uploadedFileData,
    });
    const intent = orchestrationPlan.intent === 'chart'
        ? 'chart_analysis'
        : orchestrationPlan.intent === 'executive_advice'
            ? 'analysis'
            : classifyQueryIntent(originalQuestion);
    const executiveRecommendationMode = orchestrationPlan.adviceMode || isExecutiveRecommendationIntent(originalQuestion);
    const reasoningMode = orchestrationPlan.reasoningMode || isAnalyticalReasoningIntent(originalQuestion);
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

    const rawRequestLocalContexts = retrieveRelevantContexts(originalQuestion, options.user || {}, settings);
    const retrievalPolicy = decideAIRetrievalPolicy({
        question: originalQuestion,
        intent: orchestrationPlan.intent,
        contexts: rawRequestLocalContexts,
        contextBundle: orchestrationPlan.contextBundle,
        allowWebSearch: settings.allowWebSearch,
        shouldUseWebFallback: orchestrationPlan.shouldUseWebFallback,
        blockedReason: orchestrationPlan.blockedReason,
    });
    const useSearch = retrievalPolicy.useWebSearch;
    const wantsStructuredOutput = isChartRequest && !useSearch && settings.structuredOutput !== false;
    if (wantsStructuredOutput) {
        finalMessage += `\n\n[System: Return a JSON object that matches the configured responseJsonSchema. Put user-facing Thai prose in "answer". Put chart config JSON as a string in "chartJson" only when a chart is needed. Fill "sources" with the retrieved dataset labels used and "actions" with 1-3 useful next actions.]`;
    }
    const requestContextBundle = slimRetrievedContexts(rawRequestLocalContexts, {
        intent: orchestrationPlan.intent,
        settings,
    });
    const requestLocalContexts = requestContextBundle.contexts;
    const contextSlimming = requestContextBundle.meta;
    const selectedDatasets = requestLocalContexts.map(context => context.id).filter(Boolean);
    const responseCacheKey = buildAIResponseCacheKey({
        finalMessage,
        originalQuestion,
        userContext: options.user || {},
        settings,
        useSearch,
    });
    const retrievedContextCount = requestLocalContexts.length + (useSearch ? 1 : 0);
    const disableCacheForPlan = options.disableCache || executiveRecommendationMode || reasoningMode || orchestrationPlan.shouldDisableCache;
    const cachedResponse = disableCacheForPlan ? null : readAIResponseCache(responseCacheKey, useSearch);
    if (cachedResponse) {
        conversationHistory.push({
            role: 'user',
            parts: [{ text: finalMessage }]
        });
        conversationHistory.push({
            role: 'model',
            parts: [{ text: cachedResponse }]
        });
        if (conversationHistory.length > 16) {
            conversationHistory = conversationHistory.slice(-16);
        }
        options.onChunk?.(cachedResponse, { cached: true });
        const cacheUsage = {
            provider: 'cache',
            model: 'cache',
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            cachedTokens: null,
            reasoningTokens: null,
            isEstimated: false,
            source: 'cache',
            requestId: `cache_${Date.now()}`,
            createdAt: new Date().toISOString(),
            selectedDatasets,
            contextChars: Number(contextSlimming.usedChars || 0),
            contextCount: retrievedContextCount,
            latencyMs: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - requestStartedAt),
            success: true,
            error: '',
        };
        recordTokenUsageSession(cacheUsage);
        emitAIDebugMetadata({
            cached: true,
            intent,
            role: orchestrationPlan.role,
            selectedDatasets,
            deniedDatasets: orchestrationPlan.deniedDatasets || [],
            sourceCount: selectedDatasets.length,
            tokenEstimate: estimateTokens(finalMessage),
            contextSlimming,
            latencyMs: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - requestStartedAt),
            modelName: 'cache',
            tokenUsage: cacheUsage,
            useSearch,
            retrievalMode: retrievalPolicy.mode,
            localCoverage: retrievalPolicy.coverage,
            retrievalReason: retrievalPolicy.reason,
            chartRequest: isChartRequest,
        }, options.onMetadata);
        return cachedResponse;
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
    const baseInstruction = buildAgenticRagInstruction(originalQuestion, options.user || {}, settings, {
        localContexts: rawRequestLocalContexts,
        retrievalPolicy,
    });
    const systemText = baseInstruction;

    const baseRequestBody = {
        system_instruction: {
            parts: [{ text: systemText }]
        },
        contents: conversationHistory,
        generationConfig: {
            temperature: settings.temperature,
            topP: 0.85,
            topK: 40,
            maxOutputTokens: resolveMaxOutputTokens(settings, intent, isChartRequest, useSearch),
        },
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ]
    };

    if (wantsStructuredOutput) {
        baseRequestBody.generationConfig.responseMimeType = 'application/json';
        baseRequestBody.generationConfig.responseJsonSchema = AI_STRUCTURED_RESPONSE_SCHEMA;
    }

    // Try each model in order, skip models on cooldown
    const candidateModels = useSearch
        ? modelOrderForIntent('web_lookup', settings)
        : modelOrderForIntent(intent, settings);
    const wantsStreaming = typeof options.onChunk === 'function' && !wantsStructuredOutput;
    for (const model of candidateModels) {
        if (isModelOnCooldown(model)) {
            console.log(`[Gemini] Skipping ${model} (cooldown)`);
            continue;
        }

        try {
            // Build per-model request body — add google_search for capable models
            const requestBody = {
                ...baseRequestBody,
                generationConfig: { ...baseRequestBody.generationConfig },
            };
            if (useSearch && SEARCH_CAPABLE_MODELS.has(model)) {
                requestBody.tools = [{ google_search: {} }];
                console.log(`[Gemini] 🔍 ${model} + Google Search (real web data)`);
            }

            console.log(`[Gemini] Trying model: ${model}...`);
            if (wantsStreaming) options.onChunk?.('', { reset: true, model });
            const response = await postGeminiModel(model, requestBody, {
                stream: wantsStreaming,
                user: options.user,
                usageMeta: {
                    selectedIntent: intent,
                    selectedDatasets,
                    sourceCount: selectedDatasets.length,
                    contextCount: retrievedContextCount,
                    contextChars: contextSlimming.usedChars || 0,
                    chartRequest: isChartRequest,
                    useSearch,
                    retrievalMode: retrievalPolicy.mode,
                    localCoverage: retrievalPolicy.coverage,
                    retrievalReason: retrievalPolicy.reason,
                    sourceTypes: requestLocalContexts
                        .map(context => context?.meta?.sourceType || context?.sourceType || context?.meta?.trustLevel || '')
                        .filter(Boolean),
                },
            });
            updateAITokenBudgetFromHeaders(response.headers);

            if (response.status === 429) {
                const quotaError = await response.clone().json().catch(() => ({}));
                if (quotaError?.global) {
                    lastError = new Error('QUOTA_EXCEEDED');
                    allQuotaExhausted = true;
                    break;
                }
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
            let data;
            let rawAiText;
            const contentType = response.headers.get('content-type') || '';
            if (wantsStreaming && contentType.includes('text/event-stream')) {
                const streamed = await readGeminiStream(response, (fullText, delta) => {
                    options.onChunk?.(fullText, { delta, model });
                });
                data = streamed.data || {};
                rawAiText = streamed.text;
            } else {
                data = await response.json();
                rawAiText = responseText(data);
            }
            if (!String(rawAiText || '').trim()) {
                console.warn(`[Gemini] ${model} empty response`);
                lastError = new Error(`${model}: Empty response`);
                continue;
            }
            const normalizedAiText = wantsStructuredOutput ? coerceStructuredAIResponse(rawAiText) : rawAiText;
            if (shouldEscalateAnswerQuality(normalizedAiText, model, candidateModels, { blockedReason: orchestrationPlan.blockedReason })) {
                console.warn(`[Gemini] ${model} answer looked insufficient; escalating to a higher-tier model...`);
                lastError = new Error(`${model}: Insufficient answer quality`);
                if (wantsStreaming) options.onChunk?.('', { reset: true, model, escalated: true });
                continue;
            }
            let aiText = appendAnswerMetadata(normalizedAiText, {
                data,
                localContexts: requestLocalContexts,
                model,
                useSearch,
            });
            aiText = appendNumericEvidenceGuardrail(aiText, {
                evidenceText: `${systemText}\n${requestLocalContexts.map(context => context.text).join('\n')}`,
                question: originalQuestion,
                useSearch,
            });
            const answerVerification = lastAnswerVerificationMetadata;

            console.log(`[Gemini] ✅ ${model} OK`);
            onModelSuccess(model);
            const latencyMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - requestStartedAt);
            const providerUsage = data?.usageMetadata || {};
            const headerUsage = {
                promptTokenCount: Number(response.headers.get('X-AI-Request-Input-Tokens') || 0) || undefined,
                candidatesTokenCount: Number(response.headers.get('X-AI-Request-Output-Tokens') || 0) || undefined,
                totalTokenCount: Number(response.headers.get('X-AI-Request-Total-Tokens') || 0) || undefined,
                cachedContentTokenCount: Number(response.headers.get('X-AI-Request-Cached-Tokens') || 0) || undefined,
                thoughtsTokenCount: Number(response.headers.get('X-AI-Request-Reasoning-Tokens') || 0) || undefined,
            };
            const headerHasUsage = Number(headerUsage.totalTokenCount || 0) > 0;
            const headerEstimated = response.headers.get('X-AI-Request-Usage-Estimated') === 'true';
            let tokenUsage = normalizeTokenUsage(
                providerUsage?.totalTokenCount ? providerUsage : (headerHasUsage ? headerUsage : providerUsage),
                {
                provider: 'gemini',
                model,
                requestId: response.headers.get('X-AI-Request-Id') || '',
                fallbackInputText: `${systemText}\n${JSON.stringify(conversationHistory)}`,
                fallbackOutputText: aiText,
                selectedDatasets,
                contextChars: contextSlimming.usedChars || 0,
                contextCount: retrievedContextCount,
                latencyMs,
                success: true,
                source: providerUsage?.totalTokenCount ? '' : (response.headers.get('X-AI-Request-Usage-Source') || (wantsStreaming ? 'stream_client_estimate' : 'client_estimate')),
                }
            );
            if (!providerUsage?.totalTokenCount && headerHasUsage && headerEstimated) {
                tokenUsage = { ...tokenUsage, isEstimated: true, source: response.headers.get('X-AI-Request-Usage-Source') || 'server_estimate' };
            }
            emitAIDebugMetadata({
                cached: false,
                intent,
                role: orchestrationPlan.role,
                selectedDatasets,
                deniedDatasets: orchestrationPlan.deniedDatasets || [],
                sourceCount: selectedDatasets.length,
                tokenEstimate: estimateTokens(`${systemText}\n${finalMessage}`),
                providerTokens: tokenUsage.isEstimated ? null : tokenUsage.totalTokens,
                tokenUsage,
                tokenUsageSource: tokenUsage.source,
                contextSlimming,
                latencyMs,
                modelName: model,
                useSearch,
                retrievalMode: retrievalPolicy.mode,
                localCoverage: retrievalPolicy.coverage,
                retrievalReason: retrievalPolicy.reason,
                chartRequest: isChartRequest,
                structuredOutput: wantsStructuredOutput,
                answerVerification,
            }, options.onMetadata);
            recordTokenStats({
                model,
                intent,
                inputText: `${systemText}\n${JSON.stringify(conversationHistory)}`,
                outputText: aiText,
                contextCount: retrievedContextCount,
                tokenUsage,
                selectedDatasets,
                latencyMs,
            });
            refreshAITokenBudgetSnapshot().catch(() => {});

            conversationHistory.push({
                role: 'model',
                parts: [{ text: aiText }]
            });

            if (conversationHistory.length > 16) {
                conversationHistory = conversationHistory.slice(-16);
            }

            if (!executiveRecommendationMode) {
                if (!disableCacheForPlan) {
                    writeAIResponseCache(responseCacheKey, aiText, useSearch);
                }
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
            const response = await postGeminiModel(model, {
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 1024 }
            }, { user: { role: 'dean', uid: 'dashboard-insights' } });
            updateAITokenBudgetFromHeaders(response.headers);

            if (response.status === 429) {
                const quotaError = await response.clone().json().catch(() => ({}));
                if (quotaError?.global) break;
                setModelCooldown(model);
                continue;
            }
            if (!response.ok) continue;

            const data = await response.json();
            refreshAITokenBudgetSnapshot().catch(() => {});
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

    const rosterTrust = getStudentRosterTrustStatus();
    const reconcile = getStudentReconciliationSnapshot();
    const liveStudents = rosterTrust.canAnswerIndividual ? getStudentListSync() : [];
    const atRisk = liveStudents.filter(student => (Number(student.gpa) || 0) < 2).length;
    const majors = [...new Set(liveStudents.map(student => student.major).filter(Boolean))].length;
    const source = rosterTrust.canAnswerIndividual ? (isLiveData() ? 'ข้อมูล realtime/อัปโหลดล่าสุด' : rosterTrust.accuracyLabel) : 'ยอดรวมทางการจาก MJU Dashboard; รายชื่อรายคนเป็น sample/generated';
    return [
        `ยอดรวมนักศึกษาคณะวิทยาศาสตร์จาก MJU Dashboard คือ ${(reconcile.officialTotal ?? liveStudents.length).toLocaleString('th-TH')} คน (${source})`,
        rosterTrust.canAnswerIndividual
            ? `นักศึกษาที่ควรเฝ้าระวังจาก GPA < 2.00 มี ${atRisk.toLocaleString('th-TH')} คน จาก ${majors} สาขา`
            : 'ยังไม่ยืนยันรายชื่อจริงหรือ GPA รายคน เพราะ datasets/students เป็น sample/generated ต้องอัปโหลดไฟล์จริงจาก Reg/คณะก่อน',
        'ข้อมูลกราฟพยากรณ์/รายคนจะเปลี่ยนเมื่อข้อมูลกลาง sync หรือมีไฟล์รายชื่อจริงอัปโหลดเข้าระบบ'
    ];
}
