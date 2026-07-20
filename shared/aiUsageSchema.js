const TOKEN_SOURCE_VALUES = new Set(['provider', 'count-api', 'estimated', 'local', 'cache']);

function tokenNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.floor(number) : null;
}

function firstTokenNumber(...values) {
    for (const value of values) {
        const number = tokenNumber(value);
        if (number !== null) return number;
    }
    return null;
}

function safeList(value, max = 12) {
    return Array.isArray(value)
        ? value.map(item => String(item || '').slice(0, 80)).filter(Boolean).slice(0, max)
        : [];
}

export function estimateTextTokens(value) {
    const text = String(value || '');
    if (!text.trim()) return 0;
    return Math.ceil(text.length / 3.6);
}

export function normalizeAIUsage(rawUsage = {}, options = {}) {
    const provider = String(options.provider || rawUsage.provider || 'unknown');
    const model = String(options.model || rawUsage.model || 'unknown');
    const inputTokens = firstTokenNumber(
        rawUsage.promptTokenCount,
        rawUsage.inputTokenCount,
        rawUsage.prompt_tokens,
        rawUsage.input_tokens,
        rawUsage.inputTokens
    );
    const outputTokens = firstTokenNumber(
        rawUsage.candidatesTokenCount,
        rawUsage.outputTokenCount,
        rawUsage.completion_tokens,
        rawUsage.output_tokens,
        rawUsage.outputTokens
    );
    const providerTotal = firstTokenNumber(rawUsage.totalTokenCount, rawUsage.total_tokens, rawUsage.totalTokens);
    const cachedTokens = firstTokenNumber(
        rawUsage.cachedContentTokenCount,
        rawUsage.cached_tokens,
        rawUsage.prompt_tokens_details?.cached_tokens,
        rawUsage.input_tokens_details?.cached_tokens,
        rawUsage.cachedTokens
    );
    const thinkingTokens = firstTokenNumber(
        rawUsage.thoughtsTokenCount,
        rawUsage.reasoningTokenCount,
        rawUsage.completion_tokens_details?.reasoning_tokens,
        rawUsage.output_tokens_details?.reasoning_tokens,
        rawUsage.thinkingTokens,
        rawUsage.reasoningTokens
    );
    const toolTokens = firstTokenNumber(rawUsage.toolTokenCount, rawUsage.tool_tokens, rawUsage.toolTokens);
    const hasProviderMetadata = providerTotal !== null
        || inputTokens !== null
        || outputTokens !== null
        || cachedTokens !== null
        || thinkingTokens !== null;
    const allowEstimate = options.allowEstimate !== false;
    const estimatedInput = firstTokenNumber(options.fallbackInputTokens)
        ?? (allowEstimate ? estimateTextTokens(options.fallbackInputText) : null);
    const estimatedOutput = firstTokenNumber(options.fallbackOutputTokens)
        ?? (allowEstimate ? estimateTextTokens(options.fallbackOutputText) : null);

    let source = String(options.source || rawUsage.source || '');
    if (!TOKEN_SOURCE_VALUES.has(source)) {
        source = hasProviderMetadata ? 'provider' : (allowEstimate ? 'estimated' : 'estimated');
    }
    if (options.isCountApi === true) source = 'count-api';
    if (options.isLocal === true) source = 'local';
    if (options.isCache === true) source = 'cache';

    const resolvedInput = hasProviderMetadata ? inputTokens : estimatedInput;
    const resolvedOutput = hasProviderMetadata ? outputTokens : estimatedOutput;
    const totalTokens = providerTotal
        ?? (resolvedInput !== null || resolvedOutput !== null
            ? Number(resolvedInput || 0) + Number(resolvedOutput || 0)
            : null);
    const contextTokens = firstTokenNumber(options.contextTokens, rawUsage.contextTokens)
        ?? resolvedInput;
    const contextLimit = firstTokenNumber(options.contextLimit, rawUsage.contextLimit);
    const isEstimated = source === 'estimated' || source === 'count-api';
    const componentTotal = Number(resolvedInput || 0) + Number(resolvedOutput || 0);
    const sanityWarning = totalTokens !== null && componentTotal > totalTokens
        ? 'input_output_exceeds_total'
        : '';

    return {
        requestId: String(options.requestId || rawUsage.requestId || ''),
        userId: String(options.userId || rawUsage.userId || ''),
        sessionId: String(options.sessionId || rawUsage.sessionId || ''),
        provider,
        model,
        route: String(options.route || rawUsage.route || ''),
        inputTokens: resolvedInput,
        outputTokens: resolvedOutput,
        thinkingTokens,
        reasoningTokens: thinkingTokens,
        cachedTokens,
        toolTokens,
        totalTokens,
        contextTokens,
        contextLimit,
        requestCount: firstTokenNumber(options.requestCount, rawUsage.requestCount)
            ?? (source === 'local' || source === 'cache' ? 0 : 1),
        latencyMs: firstTokenNumber(options.latencyMs, rawUsage.latencyMs),
        status: String(options.status || rawUsage.status || 'success'),
        source,
        sourceDetail: String(options.sourceDetail || rawUsage.sourceDetail || ''),
        isEstimated,
        selectedDatasets: safeList(options.selectedDatasets || rawUsage.selectedDatasets),
        contextCount: firstTokenNumber(options.contextCount, rawUsage.contextCount) ?? 0,
        contextChars: firstTokenNumber(options.contextChars, rawUsage.contextChars) ?? 0,
        estimatedCost: rawUsage.estimatedCost == null ? null : Number(rawUsage.estimatedCost),
        currency: rawUsage.currency || null,
        costSource: rawUsage.costSource || null,
        sanityWarning,
        createdAt: String(options.createdAt || rawUsage.createdAt || new Date().toISOString()),
    };
}

export function isProviderMeasuredUsage(usage) {
    return usage?.source === 'provider' && usage?.isEstimated === false;
}

export function usageHasTokenValues(usage) {
    return usage?.totalTokens !== null && usage?.totalTokens !== undefined;
}
