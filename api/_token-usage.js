function numberValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

export function estimateTextTokens(value) {
  const text = String(value || '');
  if (!text.trim()) return 0;
  return Math.ceil(text.length / 3.6);
}

export function normalizeTokenUsage(rawUsage = {}, {
  provider = 'unknown',
  model = 'unknown',
  requestId = '',
  fallbackInputTokens = null,
  fallbackOutputTokens = null,
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

  if (totalTokens != null && totalTokens > 0) {
    const resolvedInput = inputTokens == null && outputTokens != null
      ? Math.max(0, totalTokens - outputTokens)
      : inputTokens;
    const resolvedOutput = outputTokens == null && inputTokens != null
      ? Math.max(0, totalTokens - inputTokens)
      : outputTokens;
    return {
      provider,
      model,
      inputTokens: resolvedInput ?? null,
      outputTokens: resolvedOutput ?? null,
      totalTokens,
      cachedTokens: cachedTokens ?? null,
      reasoningTokens: reasoningTokens ?? null,
      isEstimated: false,
      source: source || (isOpenAI ? 'provider_usage_metadata:openai' : 'provider_usage_metadata:gemini'),
      requestId,
      createdAt,
    };
  }

  const estimatedInput = numberValue(fallbackInputTokens) ?? 0;
  const estimatedOutput = numberValue(fallbackOutputTokens) ?? 0;
  return {
    provider,
    model,
    inputTokens: estimatedInput,
    outputTokens: estimatedOutput,
    totalTokens: estimatedInput + estimatedOutput,
    cachedTokens: null,
    reasoningTokens: null,
    isEstimated: true,
    source: source || 'server_estimate',
    requestId,
    createdAt,
  };
}

export function tokenUsageHeaders(usage = {}) {
  return {
    'X-AI-Request-Id': usage.requestId || '',
    'X-AI-Request-Provider': usage.provider || '',
    'X-AI-Request-Model': usage.model || '',
    'X-AI-Request-Usage-Source': usage.source || '',
    'X-AI-Request-Usage-Estimated': usage.isEstimated ? 'true' : 'false',
    'X-AI-Request-Input-Tokens': usage.inputTokens ?? '',
    'X-AI-Request-Output-Tokens': usage.outputTokens ?? '',
    'X-AI-Request-Total-Tokens': usage.totalTokens ?? '',
    'X-AI-Request-Cached-Tokens': usage.cachedTokens ?? '',
    'X-AI-Request-Reasoning-Tokens': usage.reasoningTokens ?? '',
  };
}
