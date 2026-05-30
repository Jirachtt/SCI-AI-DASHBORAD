/* global process */

import { createHash } from 'node:crypto';
import {
  getDocument,
  runTransaction,
  updateWrite,
} from './_firestore-server.js';

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

export const AI_USAGE_LIMITS = {
  globalRpm: readPositiveInt('AI_GLOBAL_RPM_LIMIT', 45),
  globalTpm: readPositiveInt('AI_GLOBAL_TPM_LIMIT', 750_000),
  globalRpd: readPositiveInt('AI_GLOBAL_RPD_LIMIT', 500),
  dailyTokenBudget: readPositiveInt('AI_DAILY_TOKEN_BUDGET', 1_000_000),
  clientRpm: readPositiveInt('AI_CLIENT_RPM_LIMIT', 6),
};

function readPositiveInt(key, fallback) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export function isProductionUsageRequired() {
  return process.env.VERCEL_ENV === 'production' || process.env.AI_USAGE_REQUIRE_FIRESTORE === 'true';
}

function pad(value) {
  return String(value).padStart(2, '0');
}

export function bangkokTimeParts(date = new Date()) {
  const shifted = new Date(date.getTime() + BANGKOK_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

export function usageKeys(now = new Date()) {
  const parts = bangkokTimeParts(now);
  const dayKey = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}_TH`;
  const minuteKey = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}-${pad(parts.minute)}_TH`;
  const resetAt = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1, 0, 0, 0) - BANGKOK_OFFSET_MS);
  return {
    dayKey,
    minuteKey,
    resetAt: resetAt.toISOString(),
    timezone: 'Asia/Bangkok',
    resetLabel: '00:00 น.',
  };
}

export function clientHashFromRequest(req) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || req.headers?.['x-real-ip'] || req.socket?.remoteAddress || 'unknown-ip';
  const userAgent = String(req.headers?.['user-agent'] || '').slice(0, 120);
  return createHash('sha256').update(`${ip}|${userAgent}`).digest('hex').slice(0, 32);
}

function hashText(value) {
  const text = String(value || '').trim().toLowerCase();
  return text ? createHash('sha256').update(text).digest('hex').slice(0, 32) : '';
}

function usageUser(payload = {}) {
  return {
    uid: String(payload.uid || '').slice(0, 120),
    role: String(payload.role || 'unknown').slice(0, 40),
    emailHash: hashText(payload.email),
  };
}

function safeList(value, max = 12) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => String(item || '').replace(/[^\w:./-]/g, '').slice(0, 80))
    .filter(Boolean)
    .slice(0, max);
}

function safeText(value, max = 120) {
  return String(value || '').replace(/[^\w:./ -]/g, '').slice(0, max);
}

function sanitizeUsageMeta(payload = {}) {
  return {
    selectedIntent: safeText(payload.selectedIntent || payload.intent, 80),
    selectedDatasets: safeList(payload.selectedDatasets || payload.datasets),
    sourceCount: numberValue(payload.sourceCount),
    contextCount: numberValue(payload.contextCount),
    contextChars: numberValue(payload.contextChars),
    chartRequest: Boolean(payload.chartRequest),
    useSearch: Boolean(payload.useSearch),
    sourceTypes: safeList(payload.sourceTypes, 8),
  };
}

function numberValue(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function limitSnapshotFromDocs({ daily = {}, minute = {}, clientMinute = {}, limits = AI_USAGE_LIMITS, keys = usageKeys() }) {
  const usedTokens = numberValue(daily.usedTokens);
  const inFlightInputTokens = numberValue(daily.inFlightInputTokens);
  const requestCount = numberValue(daily.requestCount);
  const minuteRequests = numberValue(minute.requestCount);
  const minuteInputTokens = numberValue(minute.inputTokens);
  const clientMinuteRequests = numberValue(clientMinute.requestCount);
  const remainingTokens = Math.max(0, limits.dailyTokenBudget - usedTokens - inFlightInputTokens);
  const remainingRequests = Math.max(0, limits.globalRpd - requestCount);
  const remainingGlobalMinute = Math.max(0, limits.globalRpm - minuteRequests);
  const remainingClientMinute = Math.max(0, limits.clientRpm - clientMinuteRequests);
  const remainingGlobalTpm = Math.max(0, limits.globalTpm - minuteInputTokens);

  return {
    source: 'firestore',
    serverBacked: true,
    dayKey: keys.dayKey,
    minuteKey: keys.minuteKey,
    timezone: keys.timezone,
    resetAt: daily.resetAt || keys.resetAt,
    resetLabel: keys.resetLabel,
    limits,
    used: {
      requestCount,
      completedRequests: numberValue(daily.completedRequests),
      failedRequests: numberValue(daily.failedRequests),
      usedTokens,
      inFlightInputTokens,
      providerTokens: numberValue(daily.providerTokens),
      estimatedTokens: numberValue(daily.estimatedTokens),
      inputTokens: numberValue(daily.inputTokens),
      outputTokens: numberValue(daily.outputTokens),
      minuteRequests,
      minuteInputTokens,
      clientMinuteRequests,
    },
    remaining: {
      dailyTokenBudget: remainingTokens,
      globalRpd: remainingRequests,
      globalRpm: remainingGlobalMinute,
      globalTpm: remainingGlobalTpm,
      clientRpm: remainingClientMinute,
    },
    remainingPercent: limits.dailyTokenBudget
      ? Math.max(0, Math.min(100, Math.round((remainingTokens / limits.dailyTokenBudget) * 100)))
      : 100,
    updatedAt: daily.updatedAt || null,
  };
}

function defaultDailyDoc(keys, limits) {
  return {
    dayKey: keys.dayKey,
    timezone: keys.timezone,
    resetAt: keys.resetAt,
    resetLabel: keys.resetLabel,
    budgetTokens: limits.dailyTokenBudget,
    requestCount: 0,
    completedRequests: 0,
    failedRequests: 0,
    usedTokens: 0,
    inFlightInputTokens: 0,
    providerTokens: 0,
    estimatedTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    updatedAt: null,
  };
}

function addNumbers(doc, patch) {
  const next = { ...doc };
  for (const [key, delta] of Object.entries(patch)) {
    next[key] = numberValue(next[key]) + Number(delta || 0);
  }
  return next;
}

function clampDailyDoc(doc) {
  return {
    ...doc,
    inFlightInputTokens: Math.max(0, numberValue(doc.inFlightInputTokens)),
    usedTokens: Math.max(0, numberValue(doc.usedTokens)),
  };
}

function limitFailure({ daily, minute, clientMinute, limits, inputTokens, modelLimit }) {
  const projectedTokens = numberValue(daily.usedTokens) + numberValue(daily.inFlightInputTokens) + inputTokens;
  const checks = [
    ['client_rpm', numberValue(clientMinute.requestCount) + 1 > limits.clientRpm],
    ['global_rpm', numberValue(minute.requestCount) + 1 > limits.globalRpm],
    ['model_rpm', numberValue(minute[`model_${modelLimit.id}_requests`]) + 1 > modelLimit.rpm],
    ['global_tpm', numberValue(minute.inputTokens) + inputTokens > limits.globalTpm],
    ['model_tpm', numberValue(minute[`model_${modelLimit.id}_inputTokens`]) + inputTokens > modelLimit.tpm],
    ['global_rpd', numberValue(daily.requestCount) + 1 > limits.globalRpd],
    ['model_rpd', numberValue(daily[`model_${modelLimit.id}_requests`]) + 1 > modelLimit.rpd],
    ['daily_token_budget', projectedTokens > limits.dailyTokenBudget],
  ];
  return checks.find(([, failed]) => failed)?.[0] || null;
}

function modelKey(model) {
  return String(model || 'unknown').replace(/[^A-Za-z0-9_]/g, '_').slice(0, 80);
}

export async function getAIUsageSnapshot({ clientHash = '', now = new Date(), limits = AI_USAGE_LIMITS } = {}) {
  const keys = usageKeys(now);
  const dailyPath = `ai_usage/daily_${keys.dayKey}`;
  const minutePath = `ai_usage/minute_${keys.minuteKey}`;
  const clientPath = clientHash ? `ai_usage_clients/${keys.dayKey}_${keys.minuteKey}_${clientHash}` : '';

  const [dailyDoc, minuteDoc, clientDoc] = await Promise.all([
    getDocument(dailyPath),
    getDocument(minutePath),
    clientPath ? getDocument(clientPath) : Promise.resolve(null),
  ]);

  const daily = { ...defaultDailyDoc(keys, limits), ...(dailyDoc?.data || {}) };
  return limitSnapshotFromDocs({
    daily,
    minute: minuteDoc?.data || {},
    clientMinute: clientDoc?.data || {},
    limits,
    keys,
  });
}

export async function reserveAIUsage({ req, model, inputTokens, limits = AI_USAGE_LIMITS, modelDefaults = {}, usagePayload = {}, usageMeta = {} }) {
  const keys = usageKeys();
  const clientHash = clientHashFromRequest(req);
  const modelId = modelKey(model);
  const modelLimit = {
    id: modelId,
    ...(modelDefaults[model] || { rpm: 10, tpm: 250_000, rpd: 200 }),
  };
  const dailyPath = `ai_usage/daily_${keys.dayKey}`;
  const minutePath = `ai_usage/minute_${keys.minuteKey}`;
  const clientPath = `ai_usage_clients/${keys.dayKey}_${keys.minuteKey}_${clientHash}`;
  const reservationId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const nowIso = new Date().toISOString();
  const user = usageUser(usagePayload);
  const safeUsageMeta = sanitizeUsageMeta(usageMeta);

  let result;
  await runTransaction([dailyPath, minutePath, clientPath], docs => {
    const daily = { ...defaultDailyDoc(keys, limits), ...(docs[dailyPath]?.data || {}) };
    const minute = docs[minutePath]?.data || {};
    const clientMinute = docs[clientPath]?.data || {};
    const reason = limitFailure({ daily, minute, clientMinute, limits, inputTokens, modelLimit });
    const snapshot = limitSnapshotFromDocs({ daily, minute, clientMinute, limits, keys });
    if (reason) {
      result = {
        limited: true,
        reason,
        retryAfterSeconds: 60,
        snapshot,
      };
      return [];
    }

    const nextDaily = addNumbers(daily, {
      requestCount: 1,
      inFlightInputTokens: inputTokens,
      inputTokens,
      [`model_${modelId}_requests`]: 1,
    });
    const nextMinute = {
      minuteKey: keys.minuteKey,
      dayKey: keys.dayKey,
      timezone: keys.timezone,
      resetAt: keys.resetAt,
      requestCount: 0,
      inputTokens: 0,
      ...minute,
    };
    const reservedMinute = addNumbers(nextMinute, {
      requestCount: 1,
      inputTokens,
      [`model_${modelId}_requests`]: 1,
      [`model_${modelId}_inputTokens`]: inputTokens,
    });
    const nextClient = {
      minuteKey: keys.minuteKey,
      dayKey: keys.dayKey,
      clientHash,
      requestCount: 0,
      ...clientMinute,
    };
    const reservedClient = addNumbers(nextClient, { requestCount: 1, inputTokens });

    const baseDaily = {
      ...nextDaily,
      budgetTokens: limits.dailyTokenBudget,
      updatedAt: nowIso,
      lastReservationId: reservationId,
    };
    const baseMinute = {
      ...reservedMinute,
      updatedAt: nowIso,
    };
    const baseClient = {
      ...reservedClient,
      updatedAt: nowIso,
      lastUserRole: user.role,
      lastUserId: user.uid,
      lastUserEmailHash: user.emailHash,
    };

    result = {
      limited: false,
      reservationId,
      inputTokens,
      model,
      modelId,
      clientHash,
      dailyPath,
      minutePath,
      clientPath,
      keys,
      user,
      usageMeta: safeUsageMeta,
      startedAtMs: Date.now(),
      snapshot: limitSnapshotFromDocs({
        daily: baseDaily,
        minute: baseMinute,
        clientMinute: baseClient,
        limits,
        keys,
      }),
    };

    return [
      updateWrite(dailyPath, baseDaily),
      updateWrite(minutePath, baseMinute),
      updateWrite(clientPath, baseClient),
    ];
  });

  return result;
}

export async function completeAIUsage({ reservation, ok, totalTokens, outputTokens, providerMeasured = false, tokenUsage = null }) {
  if (!reservation?.dailyPath) return null;
  const nowIso = new Date().toISOString();
  const eventPath = `ai_usage_events/${reservation.keys.dayKey}_${reservation.reservationId}`;
  let result;
  await runTransaction([reservation.dailyPath, eventPath], docs => {
    const daily = {
      ...defaultDailyDoc(reservation.keys, AI_USAGE_LIMITS),
      ...(docs[reservation.dailyPath]?.data || {}),
    };
    const inputTokens = numberValue(reservation.inputTokens);
    const finalTotalTokens = Math.max(0, numberValue(totalTokens));
    const finalOutputTokens = Math.max(0, numberValue(outputTokens));
    const next = addNumbers(daily, {
      inFlightInputTokens: -inputTokens,
      completedRequests: ok ? 1 : 0,
      failedRequests: ok ? 0 : 1,
      usedTokens: ok ? finalTotalTokens : 0,
      outputTokens: ok ? finalOutputTokens : 0,
      providerTokens: ok && providerMeasured ? finalTotalTokens : 0,
      estimatedTokens: ok && !providerMeasured ? finalTotalTokens : 0,
    });
    const completedAtMs = Date.now();
    const usage = tokenUsage || {};
    const eventDoc = {
      requestId: reservation.reservationId,
      dayKey: reservation.keys.dayKey,
      minuteKey: reservation.keys.minuteKey,
      createdAt: nowIso,
      completedAt: nowIso,
      latencyMs: Math.max(0, completedAtMs - Number(reservation.startedAtMs || completedAtMs)),
      success: Boolean(ok),
      provider: usage.provider || 'gemini',
      model: usage.model || reservation.model,
      modelId: reservation.modelId,
      source: usage.source || (providerMeasured ? 'provider_usage_metadata' : 'server_estimate'),
      isEstimated: !providerMeasured,
      inputTokens,
      outputTokens: finalOutputTokens,
      totalTokens: finalTotalTokens,
      cachedTokens: numberValue(usage.cachedTokens),
      reasoningTokens: numberValue(usage.reasoningTokens),
      userRole: reservation.user?.role || 'unknown',
      userId: reservation.user?.uid || '',
      userEmailHash: reservation.user?.emailHash || '',
      clientHash: reservation.clientHash || '',
      selectedIntent: reservation.usageMeta?.selectedIntent || '',
      selectedDatasets: reservation.usageMeta?.selectedDatasets || [],
      sourceTypes: reservation.usageMeta?.sourceTypes || [],
      sourceCount: numberValue(reservation.usageMeta?.sourceCount),
      contextCount: numberValue(reservation.usageMeta?.contextCount),
      contextChars: numberValue(reservation.usageMeta?.contextChars),
      chartRequest: Boolean(reservation.usageMeta?.chartRequest),
      useSearch: Boolean(reservation.usageMeta?.useSearch),
    };
    const clamped = clampDailyDoc({
      ...next,
      updatedAt: nowIso,
      lastCompletedReservationId: reservation.reservationId,
      lastStatus: ok ? 'ok' : 'failed',
    });
    result = limitSnapshotFromDocs({
      daily: clamped,
      minute: {},
      clientMinute: {},
      limits: AI_USAGE_LIMITS,
      keys: reservation.keys,
    });
    return [
      updateWrite(reservation.dailyPath, clamped),
      updateWrite(eventPath, eventDoc),
    ];
  });
  return result;
}

export function usageHeaders(snapshot = {}) {
  const limits = snapshot.limits || AI_USAGE_LIMITS;
  const remaining = snapshot.remaining || {};
  const used = snapshot.used || {};
  return {
    'X-AI-Usage-Source': snapshot.source || 'unknown',
    'X-AI-Usage-Day': snapshot.dayKey || '',
    'X-AI-Usage-Reset-At': snapshot.resetAt || '',
    'X-AI-Token-Budget': limits.dailyTokenBudget,
    'X-AI-Token-Remaining': remaining.dailyTokenBudget ?? 0,
    'X-AI-Token-Remaining-Percent': snapshot.remainingPercent ?? 0,
    'X-AI-Token-Used': used.usedTokens ?? 0,
    'X-AI-Provider-Tokens': used.providerTokens ?? 0,
    'X-AI-Estimated-Tokens': used.estimatedTokens ?? 0,
    'X-AI-Input-Tokens': used.inputTokens ?? 0,
    'X-AI-Output-Tokens': used.outputTokens ?? 0,
    'X-AI-Requests-Used': used.requestCount ?? 0,
    'X-AI-Requests-Remaining': remaining.globalRpd ?? 0,
  };
}
