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

function publicSnapshot(snapshot) {
  const limits = snapshot.limits || AI_USAGE_LIMITS;
  const used = snapshot.used || {};
  const remaining = snapshot.remaining || {};
  return {
    source: snapshot.source || 'firestore',
    serverBacked: snapshot.serverBacked !== false,
    dayKey: snapshot.dayKey,
    timezone: snapshot.timezone || 'Asia/Bangkok',
    resetAt: snapshot.resetAt,
    resetLabel: snapshot.resetLabel || '00:00 น.',
    budgetTokens: Number(limits.dailyTokenBudget || 0),
    usedTokens: Number(used.usedTokens || 0),
    inFlightInputTokens: Number(used.inFlightInputTokens || 0),
    remainingTokens: Number(remaining.dailyTokenBudget || 0),
    remainingPercent: Number(snapshot.remainingPercent ?? 100),
    requests: Number(used.requestCount || 0),
    completedRequests: Number(used.completedRequests || 0),
    failedRequests: Number(used.failedRequests || 0),
    remainingRequests: Number(remaining.globalRpd || 0),
    limits,
    updatedAt: snapshot.updatedAt || null,
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
      status: 'syncing',
      message: error.message || 'AI usage tracking is not configured in local development.',
      budgetTokens: AI_USAGE_LIMITS.dailyTokenBudget,
      usedTokens: 0,
      remainingTokens: AI_USAGE_LIMITS.dailyTokenBudget,
      remainingPercent: 100,
      requests: 0,
      resetLabel: '00:00 น.',
      limits: AI_USAGE_LIMITS,
      updatedAt: null,
    });
  }
}
