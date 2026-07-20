import { estimateTextTokens, normalizeAIUsage } from '../../shared/aiUsageSchema.js';

const TOKEN_USAGE_SESSION_KEY = 'sci-ai-dashboard:ai-token-usage-session';

export const estimateTokens = estimateTextTokens;

export function normalizeTokenUsage(rawUsage = {}, options = {}) {
    return normalizeAIUsage(rawUsage, {
        ...options,
        status: options.status || (options.success === false ? 'error' : 'success'),
        sourceDetail: options.sourceDetail || (
            options.source && !['provider', 'count-api', 'estimated', 'local', 'cache'].includes(options.source)
                ? options.source
                : ''
        ),
        source: ['provider', 'count-api', 'estimated', 'local', 'cache'].includes(options.source)
            ? options.source
            : undefined,
    });
}

export function usageKindLabel(usage) {
    if (!usage) return 'รอข้อมูล';
    if (usage.source === 'local') return 'Local answer';
    if (usage.source === 'cache') return 'Cache';
    if (usage.source === 'count-api') return 'Estimated (count API)';
    return usage.isEstimated ? 'Estimated' : 'ข้อมูลจริงจาก Provider';
}

function readSessionRecords() {
    try {
        const raw = sessionStorage.getItem(TOKEN_USAGE_SESSION_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) return [];
        return parsed.map(item => {
            const legacySource = String(item?.source || '');
            const source = legacySource.startsWith('provider_usage_metadata')
                ? 'provider'
                : /estimate/i.test(legacySource)
                    ? 'estimated'
                    : legacySource || (item?.isEstimated ? 'estimated' : 'provider');
            return {
                ...item,
                source,
                sourceDetail: item?.sourceDetail || (source !== legacySource ? legacySource : ''),
                thinkingTokens: item?.thinkingTokens ?? item?.reasoningTokens ?? null,
                requestCount: item?.requestCount ?? (['local', 'cache'].includes(source) ? 0 : 1),
            };
        });
    } catch {
        return [];
    }
}

function writeSessionRecords(records) {
    try {
        sessionStorage.setItem(TOKEN_USAGE_SESSION_KEY, JSON.stringify(records.slice(-120)));
    } catch {
        // Session storage can be disabled; token usage UI still works from memory events.
    }
}

export function recordTokenUsageSession(usage) {
    if (!usage) return getTokenUsageSessionSummary();
    const records = readSessionRecords();
    const requestId = String(usage.requestId || '');
    const existingIndex = requestId
        ? records.findIndex(item => String(item.requestId || '') === requestId)
        : -1;
    const next = existingIndex >= 0
        ? records.map((item, index) => index === existingIndex ? usage : item).slice(-120)
        : [...records, usage].slice(-120);
    writeSessionRecords(next);
    const summary = getTokenUsageSessionSummary(next);
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sci-ai-token-usage-session-updated', { detail: summary }));
    }
    return summary;
}

export function resetTokenUsageSession() {
    writeSessionRecords([]);
    return getTokenUsageSessionSummary([]);
}

export function getTokenUsageSessionSummary(records = readSessionRecords()) {
    const safeRecords = Array.isArray(records) ? records : [];
    const modelRequests = safeRecords.filter(item => item.requestCount !== 0 && !['local', 'cache'].includes(item.source));
    const requestCount = modelRequests.length;
    const totalTokens = safeRecords.reduce((sum, item) => sum + Number(item.totalTokens ?? 0), 0);
    const inputTokens = safeRecords.reduce((sum, item) => sum + Number(item.inputTokens ?? 0), 0);
    const outputTokens = safeRecords.reduce((sum, item) => sum + Number(item.outputTokens ?? 0), 0);
    const thinkingTokens = safeRecords.reduce((sum, item) => sum + Number(item.thinkingTokens ?? item.reasoningTokens ?? 0), 0);
    const cachedTokens = safeRecords.reduce((sum, item) => sum + Number(item.cachedTokens ?? 0), 0);
    const actualTokens = safeRecords
        .filter(item => !item.isEstimated && item.source !== 'cache')
        .reduce((sum, item) => sum + Number(item.totalTokens || 0), 0);
    const estimatedTokens = safeRecords
        .filter(item => item.isEstimated)
        .reduce((sum, item) => sum + Number(item.totalTokens || 0), 0);
    const cacheHits = safeRecords.filter(item => item.source === 'cache').length;
    const localAnswers = safeRecords.filter(item => item.source === 'local').length;
    const last = safeRecords[safeRecords.length - 1] || null;
    const datasetCounts = new Map();
    safeRecords.forEach(item => {
        (item.selectedDatasets || []).forEach(dataset => {
            datasetCounts.set(dataset, (datasetCounts.get(dataset) || 0) + Number(item.totalTokens || 0));
        });
    });
    const topDataset = [...datasetCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([dataset, tokens]) => ({ dataset, tokens }))[0] || null;

    return {
        requestCount,
        interactionCount: safeRecords.length,
        localAnswers,
        totalTokens,
        inputTokens,
        outputTokens,
        thinkingTokens,
        cachedTokens,
        actualTokens,
        estimatedTokens,
        cacheHits,
        averageTokens: requestCount ? Math.round(totalTokens / requestCount) : null,
        last,
        topDataset,
        actualCount: safeRecords.filter(item => item.source === 'provider').length,
        estimatedCount: safeRecords.filter(item => item.isEstimated).length,
        records: safeRecords.slice(-20),
    };
}
