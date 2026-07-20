import { estimateTextTokens, normalizeAIUsage } from '../shared/aiUsageSchema.js';

export { estimateTextTokens };

export function normalizeTokenUsage(rawUsage = {}, options = {}) {
  return normalizeAIUsage(rawUsage, options);
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
    'X-AI-Request-Thinking-Tokens': usage.thinkingTokens ?? usage.reasoningTokens ?? '',
    'X-AI-Request-Reasoning-Tokens': usage.thinkingTokens ?? usage.reasoningTokens ?? '',
    'X-AI-Request-Tool-Tokens': usage.toolTokens ?? '',
    'X-AI-Request-Context-Tokens': usage.contextTokens ?? '',
    'X-AI-Request-Context-Limit': usage.contextLimit ?? '',
    'X-AI-Request-Status': usage.status || '',
  };
}
