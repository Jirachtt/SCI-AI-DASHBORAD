import {
  AI_USAGE_LIMITS,
  clientHashFromRequest,
  getAIUsageSnapshot,
  isProductionUsageRequired,
  usageHeaders,
} from './_ai-usage-store.js';

function sendJson(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined && value !== null) res.setHeader(key, String(value));
  }
  res.end(JSON.stringify(body));
}

function hasConfiguredAIProvider() {
  const env = globalThis.process?.env || {};
  return Boolean(
    env.GEMINI_API_KEY
    || env.GOOGLE_GEMINI_API_KEY
    || env.GOOGLE_API_KEY
  );
}

export function getAIReadiness(snapshot = {}, { providerConfigured = hasConfiguredAIProvider() } = {}) {
  const limits = snapshot.limits || AI_USAGE_LIMITS;
  const remaining = snapshot.remaining || {};
  const hasDailyBudget = snapshot.policy?.dailyTokenBudgetEnforced === true
    && Number.isFinite(Number(limits.dailyTokenBudget))
    && Number(limits.dailyTokenBudget) > 0;
  const dailyBudgetAvailable = !hasDailyBudget || Number(remaining.dailyTokenBudget) > 0;
  const requestCapacityAvailable = [remaining.globalRpd, remaining.globalRpm, remaining.clientRpm]
    .every(value => value === null || value === undefined || Number(value) > 0);

  if (!providerConfigured) return { aiReady: false, readinessReason: 'provider_not_configured' };
  if (!dailyBudgetAvailable) return { aiReady: false, readinessReason: 'daily_budget_exhausted' };
  if (!requestCapacityAvailable) return { aiReady: false, readinessReason: 'rate_limit_reached' };
  return { aiReady: true, readinessReason: 'ready' };
}

function publicSnapshot(snapshot) {
  const limits = snapshot.limits || AI_USAGE_LIMITS;
  const used = snapshot.used || {};
  const remaining = snapshot.remaining || {};
  const hasDailyBudget = snapshot.policy?.dailyTokenBudgetEnforced === true
    && Number.isFinite(Number(limits.dailyTokenBudget))
    && Number(limits.dailyTokenBudget) > 0;
  const readiness = getAIReadiness(snapshot);
  return {
    source: snapshot.source || 'firestore',
    serverBacked: snapshot.serverBacked !== false,
    dayKey: snapshot.dayKey,
    timezone: snapshot.timezone || 'Asia/Bangkok',
    resetAt: snapshot.resetAt,
    resetLabel: hasDailyBudget ? (snapshot.resetLabel || null) : null,
    budgetTokens: hasDailyBudget ? Number(limits.dailyTokenBudget) : null,
    usedTokens: Number(used.usedTokens || 0),
    providerTokens: Number(used.providerTokens || 0),
    estimatedTokens: Number(used.estimatedTokens || 0),
    inputTokens: Number(used.inputTokens || 0),
    outputTokens: Number(used.outputTokens || 0),
    thinkingTokens: Number(used.thinkingTokens || 0),
    cachedTokens: Number(used.cachedTokens || 0),
    toolTokens: Number(used.toolTokens || 0),
    inFlightInputTokens: Number(used.inFlightInputTokens || 0),
    remainingTokens: hasDailyBudget ? Number(remaining.dailyTokenBudget) : null,
    remainingPercent: hasDailyBudget ? Number(snapshot.remainingPercent) : null,
    requests: Number(used.requestCount || 0),
    attempts: Number(used.attemptCount || 0),
    completedRequests: Number(used.completedRequests || 0),
    failedRequests: Number(used.failedRequests || 0),
    remainingRequests: Number(remaining.globalRpd || 0),
    limits,
    policy: snapshot.policy || null,
    ...readiness,
    providerQuota: snapshot.providerQuota || {
      available: false,
      message: 'ผู้ให้บริการไม่ได้ส่งข้อมูล quota หรือ reset time ผ่าน usage metadata',
    },
    updatedAt: snapshot.updatedAt || null,
    lastRequest: snapshot.lastRequest || null,
  };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const snapshot = await getAIUsageSnapshot({
      clientHash: clientHashFromRequest(req),
      limits: AI_USAGE_LIMITS,
    });
    sendJson(res, 200, publicSnapshot(snapshot), usageHeaders(snapshot));
  } catch (error) {
    if (isProductionUsageRequired()) {
      sendJson(res, error.statusCode || 503, {
        error: error.code || 'AI_USAGE_UNAVAILABLE',
        message: error.message || 'AI usage tracking is unavailable.',
        serverBacked: false,
      });
      return;
    }

    sendJson(res, 200, {
      source: 'unavailable',
      serverBacked: false,
      status: 'unavailable',
      message: error.message || 'AI usage tracking is not configured in local development.',
      budgetTokens: null,
      usedTokens: null,
      remainingTokens: null,
      remainingPercent: null,
      requests: null,
      resetLabel: null,
      limits: null,
      policy: null,
      aiReady: hasConfiguredAIProvider(),
      readinessReason: hasConfiguredAIProvider() ? 'ready_without_usage_store' : 'provider_not_configured',
      providerQuota: {
        available: false,
        message: 'ผู้ให้บริการไม่ได้ส่งข้อมูล quota หรือ reset time ผ่าน usage metadata',
      },
      updatedAt: null,
    });
  }
}
