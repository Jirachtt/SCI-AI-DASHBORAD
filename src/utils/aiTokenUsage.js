const TOKEN_USAGE_SESSION_KEY = 'sci-ai-dashboard:ai-token-usage-session';

function numberValue(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

export function estimateTokens(value) {
    const text = String(value || '');
    if (!text.trim()) return 0;
    return Math.ceil(text.length / 3.6);
}

export function normalizeTokenUsage(rawUsage = {}, {
    provider = 'unknown',
    model = 'unknown',
    requestId = '',
    fallbackInputText = '',
    fallbackOutputText = '',
    fallbackInputTokens = null,
    fallbackOutputTokens = null,
    selectedDatasets = [],
    contextChars = 0,
    contextCount = 0,
    latencyMs = null,
    success = true,
    error = '',
    source = '',
    createdAt = new Date().toISOString(),
} = {}) {
    const isOpenAI = provider === 'openai' || rawUsage.prompt_tokens != null || rawUsage.completion_tokens != null;
    const inputTokens = numberValue(rawUsage.promptTokenCount)
        ?? numberValue(rawUsage.inputTokenCount)
        ?? numberValue(rawUsage.prompt_tokens)
        ?? numberValue(rawUsage.input_tokens);
    const outputTokens = numberValue(rawUsage.candidatesTokenCount)
        ?? numberValue(rawUsage.outputTokenCount)
        ?? numberValue(rawUsage.completion_tokens)
        ?? numberValue(rawUsage.output_tokens);
    const totalTokens = numberValue(rawUsage.totalTokenCount)
        ?? numberValue(rawUsage.total_tokens)
        ?? (inputTokens != null || outputTokens != null ? Number(inputTokens || 0) + Number(outputTokens || 0) : null);
    const cachedTokens = numberValue(rawUsage.cachedContentTokenCount)
        ?? numberValue(rawUsage.cached_tokens)
        ?? numberValue(rawUsage.prompt_tokens_details?.cached_tokens);
    const reasoningTokens = numberValue(rawUsage.thoughtsTokenCount)
        ?? numberValue(rawUsage.reasoningTokenCount)
        ?? numberValue(rawUsage.completion_tokens_details?.reasoning_tokens);

    const hasActualUsage = totalTokens != null && totalTokens > 0;
    const resolvedInput = hasActualUsage && inputTokens == null && outputTokens != null
        ? Math.max(0, totalTokens - outputTokens)
        : inputTokens;
    const resolvedOutput = hasActualUsage && outputTokens == null && inputTokens != null
        ? Math.max(0, totalTokens - inputTokens)
        : outputTokens;
    const estimatedInput = numberValue(fallbackInputTokens) ?? estimateTokens(fallbackInputText);
    const estimatedOutput = numberValue(fallbackOutputTokens) ?? estimateTokens(fallbackOutputText);

    return {
        provider,
        model,
        inputTokens: hasActualUsage ? (resolvedInput ?? null) : estimatedInput,
        outputTokens: hasActualUsage ? (resolvedOutput ?? null) : estimatedOutput,
        totalTokens: hasActualUsage ? totalTokens : estimatedInput + estimatedOutput,
        cachedTokens: cachedTokens ?? null,
        reasoningTokens: reasoningTokens ?? null,
        isEstimated: !hasActualUsage,
        source: source || (hasActualUsage
            ? (isOpenAI ? 'provider_usage_metadata:openai' : 'provider_usage_metadata:gemini')
            : 'client_estimate'),
        requestId,
        createdAt,
        selectedDatasets: Array.isArray(selectedDatasets) ? selectedDatasets.slice(0, 12) : [],
        contextChars: Number(contextChars || 0),
        contextCount: Number(contextCount || 0),
        latencyMs: latencyMs == null ? null : Number(latencyMs),
        success: Boolean(success),
        error: String(error || '').slice(0, 160),
    };
}

export function usageKindLabel(usage) {
    if (!usage) return 'Waiting';
    if (usage.source === 'cache') return 'Cache';
    return usage.isEstimated ? 'Estimated' : 'Actual';
}

function readSessionRecords() {
    try {
        const raw = sessionStorage.getItem(TOKEN_USAGE_SESSION_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
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
    const next = [...records, usage].slice(-120);
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
    const requestCount = safeRecords.length;
    const totalTokens = safeRecords.reduce((sum, item) => sum + Number(item.totalTokens || 0), 0);
    const actualTokens = safeRecords
        .filter(item => !item.isEstimated && item.source !== 'cache')
        .reduce((sum, item) => sum + Number(item.totalTokens || 0), 0);
    const estimatedTokens = safeRecords
        .filter(item => item.isEstimated)
        .reduce((sum, item) => sum + Number(item.totalTokens || 0), 0);
    const cacheHits = safeRecords.filter(item => item.source === 'cache').length;
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
        totalTokens,
        actualTokens,
        estimatedTokens,
        cacheHits,
        averageTokens: requestCount ? Math.round(totalTokens / requestCount) : 0,
        last,
        topDataset,
        actualCount: safeRecords.filter(item => !item.isEstimated && item.source !== 'cache').length,
        estimatedCount: safeRecords.filter(item => item.isEstimated).length,
        records: safeRecords.slice(-20),
    };
}
