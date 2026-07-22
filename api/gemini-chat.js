/* global process */

import { Buffer } from 'node:buffer';
import {
  AI_USAGE_LIMITS,
  completeAIUsage,
  isProductionUsageRequired,
  reserveAIUsage,
  usageHeaders,
} from './_ai-usage-store.js';
import { normalizeTokenUsage, tokenUsageHeaders } from './_token-usage.js';
import { verifyFirebaseIdToken } from './admin-user-update.js';
import {
  AI_ALLOWED_MODEL_IDS,
  getAIModelRateDefaults,
} from '../shared/aiModelConfig.js';
import { detectDirectPromptInjection } from '../shared/aiPromptSecurity.js';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS || 35000);
const WINDOW_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const ALLOWED_MODELS = new Set(AI_ALLOWED_MODEL_IDS);
const MODEL_DEFAULTS = getAIModelRateDefaults();

const LIMITS = AI_USAGE_LIMITS;

const usageState = globalThis.__SCI_AI_GEMINI_USAGE__ || {
  minuteEvents: [],
  dayEvents: [],
};
globalThis.__SCI_AI_GEMINI_USAGE__ = usageState;

function sendJson(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined && value !== null) res.setHeader(key, String(value));
  }
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');

  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

function apiKey() {
  return process.env.GEMINI_API_KEY
    || process.env.GOOGLE_GEMINI_API_KEY
    || process.env.GOOGLE_API_KEY
    || '';
}

function clientKey(req) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || req.headers?.['x-real-ip'] || req.socket?.remoteAddress || 'unknown-ip';
  const userAgent = String(req.headers?.['user-agent'] || '').slice(0, 80);
  return `${ip}|${userAgent}`;
}

function estimateTokens(value) {
  return Math.ceil(String(value || '').length / 3.6);
}

function collectText(value, out = []) {
  if (!value) return out;
  if (typeof value === 'string') {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectText(item, out));
    return out;
  }
  if (typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      if (key === 'text' || key === 'system_instruction' || key === 'contents') collectText(nested, out);
      else if (typeof nested === 'object') collectText(nested, out);
    }
  }
  return out;
}

function requestInputTokens(requestBody) {
  return estimateTokens(collectText(requestBody).join('\n'));
}

function responseOutputTokens(body) {
  const text = body?.candidates?.[0]?.content?.parts
    ?.map(part => part?.text || '')
    .join('\n') || '';
  return estimateTokens(text);
}

function latestUserContent(requestBody) {
  const contents = Array.isArray(requestBody?.contents) ? requestBody.contents : [];
  const latest = [...contents].reverse().find(content => content?.role === 'user');
  return (latest?.parts || []).map(part => String(part?.text || '')).join('\n');
}

export function parseGeminiStreamPayloads(rawStream) {
  return String(rawStream || '')
    .split(/\r?\n\r?\n/)
    .flatMap(block => {
      const data = block
        .split(/\r?\n/)
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trim())
        .filter(Boolean)
        .join('\n');
      if (!data || data === '[DONE]') return [];
      try {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
    });
}

function streamUsageMetadata(rawStream) {
  const payloads = parseGeminiStreamPayloads(rawStream);
  for (let index = payloads.length - 1; index >= 0; index -= 1) {
    if (payloads[index]?.usageMetadata) return payloads[index].usageMetadata;
  }
  return null;
}

function streamOutputTokens(rawStream) {
  const text = parseGeminiStreamPayloads(rawStream)
    .flatMap(payload => payload?.candidates?.[0]?.content?.parts || [])
    .map(part => part?.text || '')
    .join('');
  return estimateTokens(text);
}

function configuredContextLimit(model) {
  try {
    const limits = JSON.parse(process.env.AI_MODEL_CONTEXT_LIMITS_JSON || '{}');
    const value = Number(limits?.[model]);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
  } catch {
    return null;
  }
}

function cleanup(now = Date.now()) {
  usageState.minuteEvents = usageState.minuteEvents.filter(event => now - event.at < WINDOW_MS);
  usageState.dayEvents = usageState.dayEvents.filter(event => now - event.at < DAY_MS);
}

function count(events, predicate) {
  return events.reduce((sum, event) => sum + (predicate(event) ? 1 : 0), 0);
}

function sumTokens(events, predicate) {
  return events.reduce((sum, event) => sum + (predicate(event) ? Number(event.inputTokens || 0) : 0), 0);
}

function dayTokenTotal() {
  return usageState.dayEvents.reduce(
    (sum, event) => sum + (event.status === 'completed' ? Number(event.totalTokens || 0) : 0),
    0
  );
}

function snapshot(model) {
  const modelLimit = MODEL_DEFAULTS[model] || { rpm: 10, tpm: 250_000, rpd: 200 };
  const now = Date.now();
  cleanup(now);

  const globalMinuteRequests = usageState.minuteEvents.length;
  const modelMinuteRequests = count(usageState.minuteEvents, event => event.model === model);
  const globalMinuteInputTokens = sumTokens(usageState.minuteEvents, () => true);
  const modelMinuteInputTokens = sumTokens(usageState.minuteEvents, event => event.model === model);
  const dayRequests = usageState.dayEvents.length;
  const modelDayRequests = count(usageState.dayEvents, event => event.model === model);
  const dailyTokens = dayTokenTotal();

  return {
    windowSeconds: 60,
    limits: {
      globalRpm: LIMITS.globalRpm,
      globalTpm: LIMITS.globalTpm,
      globalRpd: LIMITS.globalRpd,
      dailyTokenBudget: LIMITS.dailyTokenBudget,
      clientRpm: LIMITS.clientRpm,
      modelRpm: modelLimit.rpm,
      modelTpm: modelLimit.tpm,
      modelRpd: modelLimit.rpd,
    },
    used: {
      globalMinuteRequests,
      modelMinuteRequests,
      globalMinuteInputTokens,
      modelMinuteInputTokens,
      dayRequests,
      modelDayRequests,
      dailyTokens,
    },
    remaining: {
      globalRpm: Math.max(0, LIMITS.globalRpm - globalMinuteRequests),
      globalTpm: Math.max(0, LIMITS.globalTpm - globalMinuteInputTokens),
      globalRpd: Math.max(0, LIMITS.globalRpd - dayRequests),
      dailyTokenBudget: Number.isFinite(Number(LIMITS.dailyTokenBudget)) && Number(LIMITS.dailyTokenBudget) > 0
        ? Math.max(0, Number(LIMITS.dailyTokenBudget) - dailyTokens)
        : null,
      modelRpm: Math.max(0, modelLimit.rpm - modelMinuteRequests),
      modelTpm: Math.max(0, modelLimit.tpm - modelMinuteInputTokens),
      modelRpd: Math.max(0, modelLimit.rpd - modelDayRequests),
    },
  };
}

function rejectIfLimited({ req, model, inputTokens }) {
  const now = Date.now();
  cleanup(now);

  const key = clientKey(req);
  const modelLimit = MODEL_DEFAULTS[model] || { rpm: 10, tpm: 250_000, rpd: 200 };
  const clientMinuteRequests = count(usageState.minuteEvents, event => event.clientKey === key);
  const globalMinuteRequests = usageState.minuteEvents.length;
  const modelMinuteRequests = count(usageState.minuteEvents, event => event.model === model);
  const globalMinuteInputTokens = sumTokens(usageState.minuteEvents, () => true);
  const modelMinuteInputTokens = sumTokens(usageState.minuteEvents, event => event.model === model);
  const dayRequests = usageState.dayEvents.length;
  const modelDayRequests = count(usageState.dayEvents, event => event.model === model);
  const projectedDailyTokens = dayTokenTotal() + inputTokens;

  const checks = [
    ['client_rpm', clientMinuteRequests + 1 > LIMITS.clientRpm],
    ['global_rpm', globalMinuteRequests + 1 > LIMITS.globalRpm],
    ['model_rpm', modelMinuteRequests + 1 > modelLimit.rpm],
    ['global_tpm', globalMinuteInputTokens + inputTokens > LIMITS.globalTpm],
    ['model_tpm', modelMinuteInputTokens + inputTokens > modelLimit.tpm],
    ['global_rpd', dayRequests + 1 > LIMITS.globalRpd],
    ['model_rpd', modelDayRequests + 1 > modelLimit.rpd],
    ['daily_token_budget', Number.isFinite(Number(LIMITS.dailyTokenBudget))
      && Number(LIMITS.dailyTokenBudget) > 0
      && projectedDailyTokens > Number(LIMITS.dailyTokenBudget)],
  ];
  const failed = checks.find(([, isLimited]) => isLimited);
  if (!failed) return null;

  const oldestMinute = usageState.minuteEvents[0]?.at || now;
  return {
    reason: failed[0],
    retryAfterSeconds: Math.max(5, Math.ceil((oldestMinute + WINDOW_MS - now) / 1000)),
    snapshot: snapshot(model),
  };
}

function recordStart({ req, model, inputTokens, requestId = '' }) {
  const event = {
    id: requestId || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    at: Date.now(),
    clientKey: clientKey(req),
    model,
    inputTokens,
    outputTokens: 0,
    totalTokens: 0,
    status: 'in_progress',
  };
  usageState.minuteEvents.push(event);
  usageState.dayEvents.push(event);
  return event;
}

function findMemoryEvent(requestId) {
  if (!requestId) return null;
  return usageState.dayEvents.find(event => event.id === requestId) || null;
}

function finalizeMemoryEvent(event, usage, ok) {
  if (!event) return;
  if (!ok) {
    event.status = 'error';
    event.inputTokens = 0;
    event.outputTokens = 0;
    event.totalTokens = 0;
    return;
  }
  event.status = 'completed';
  event.inputTokens = Number(usage?.inputTokens || 0);
  event.outputTokens = Number(usage?.outputTokens || 0);
  event.totalTokens = Number(usage?.totalTokens || (event.inputTokens + event.outputTokens));
}

function headersFor(model, usageSnapshot = null, requestUsage = null) {
  const current = snapshot(model);
  const remainingPercent = Math.round((current.remaining.globalRpm / current.limits.globalRpm) * 100);
  const hasDailyBudget = Number.isFinite(Number(current.limits.dailyTokenBudget))
    && Number(current.limits.dailyTokenBudget) > 0;
  const tokenPercent = hasDailyBudget
    ? Math.round((current.remaining.dailyTokenBudget / current.limits.dailyTokenBudget) * 100)
    : null;
  return {
    'X-AI-Model': model,
    'X-AI-Usage-Source': usageSnapshot?.source || 'memory',
    'X-AI-RateLimit-Limit': current.limits.globalRpm,
    'X-AI-RateLimit-Remaining': current.remaining.globalRpm,
    'X-AI-RateLimit-Remaining-Percent': remainingPercent,
    'X-AI-Token-Budget': hasDailyBudget ? current.limits.dailyTokenBudget : null,
    'X-AI-Token-Remaining': hasDailyBudget ? current.remaining.dailyTokenBudget : null,
    'X-AI-Token-Remaining-Percent': tokenPercent,
    ...(usageSnapshot ? usageHeaders(usageSnapshot) : {}),
    ...(requestUsage ? tokenUsageHeaders(requestUsage) : {}),
  };
}

async function fetchGemini({ model, requestBody, key, stream = false }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const method = stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
  const keySeparator = stream ? '&' : '?';
  try {
    return await fetch(`${GEMINI_BASE_URL}/${encodeURIComponent(model)}:${method}${keySeparator}key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function streamHeadersFor(model) {
  return {
    ...headersFor(model),
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const key = apiKey();
  if (!key) {
    sendJson(res, 500, {
      error: 'GEMINI_API_KEY_MISSING',
      message: 'Server-side Gemini API key is not configured.',
    });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: 'INVALID_JSON', message: 'Request body must be valid JSON.' });
    return;
  }

  const model = String(payload?.model || '').trim();
  const requestBody = payload?.requestBody;
  const wantsStream = payload?.stream === true;
  if (!ALLOWED_MODELS.has(model)) {
    sendJson(res, 400, { error: 'MODEL_NOT_ALLOWED', message: 'This Gemini model is not enabled for SCI AI Dashboard.' });
    return;
  }
  if (!requestBody || typeof requestBody !== 'object') {
    sendJson(res, 400, { error: 'INVALID_REQUEST_BODY', message: 'Missing Gemini request body.' });
    return;
  }

  const promptSecurity = detectDirectPromptInjection(latestUserContent(requestBody));
  if (promptSecurity.detected) {
    sendJson(res, 403, {
      error: 'PROMPT_INJECTION_BLOCKED',
      message: 'คำขอนี้พยายามเปลี่ยนคำสั่งภายในหรือยกระดับสิทธิ์ จึงถูกปฏิเสธก่อนเรียก AI provider',
    });
    return;
  }

  const inputTokens = requestInputTokens(requestBody);
  const requestId = String(payload?.requestId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 96);
  let authUser = null;
  const authorization = String(req.headers?.authorization || req.headers?.Authorization || '');
  if (authorization) {
    try {
      authUser = await verifyFirebaseIdToken(req);
    } catch (error) {
      sendJson(res, error.statusCode || 401, {
        error: error.code || 'INVALID_ID_TOKEN',
        message: error.message || 'Firebase authentication is required for this AI request.',
      });
      return;
    }
  }
  const usageUser = authUser
    ? {
      uid: authUser.uid,
      role: authUser.claims?.role || authUser.claims?.mjuRole || payload?.usageUser?.role || 'general',
    }
    : {};
  let reservation = null;
  let memoryEvent = null;
  try {
    reservation = await reserveAIUsage({
      req,
      model,
      inputTokens,
      limits: LIMITS,
      modelDefaults: MODEL_DEFAULTS,
      usagePayload: usageUser,
      usageMeta: {
        ...(payload?.usageMeta || {}),
        requestId,
        sessionId: payload?.sessionId || payload?.usageMeta?.sessionId || '',
        route: payload?.route || payload?.usageMeta?.route || '',
      },
    });
  } catch (error) {
    if (isProductionUsageRequired()) {
      sendJson(res, error.statusCode || 503, {
        error: error.code || 'AI_USAGE_UNAVAILABLE',
        message: error.message || 'AI usage tracking is unavailable.',
      });
      return;
    }
  }

  if (reservation?.limited) {
    const isUserBudget = reservation.reason === 'user_daily_token_budget';
    sendJson(res, 429, {
      error: 'AI_RATE_LIMITED',
      message: isUserBudget
        ? `โควตา AI ฟรีของบัญชีนี้ครบ ${Number(LIMITS.userDailyTokenBudget).toLocaleString('th-TH')} tokens/วันแล้ว โควตาจะรีเซ็ตเวลา 00:00 น. (เวลาไทย)`
        : 'AI usage is temporarily limited to protect the shared project quota.',
      global: !isUserBudget,
      user: isUserBudget,
      reason: reservation.reason,
      retryAfterSeconds: reservation.retryAfterSeconds,
      quota: reservation.snapshot,
    }, {
      'Retry-After': reservation.retryAfterSeconds,
      ...headersFor(model, reservation.snapshot),
    });
    return;
  }

  if (reservation?.duplicate) {
    sendJson(res, 409, {
      error: 'AI_DUPLICATE_REQUEST',
      message: 'This AI request is already being processed or has completed.',
      requestId: reservation.reservationId,
      status: reservation.duplicateStatus,
    }, headersFor(model, reservation.snapshot));
    return;
  }

  if (!reservation) {
    const duplicateMemoryEvent = findMemoryEvent(requestId);
    if (duplicateMemoryEvent) {
      sendJson(res, 409, {
        error: 'AI_DUPLICATE_REQUEST',
        message: 'This AI request is already being processed or has completed.',
        requestId: duplicateMemoryEvent.id,
        status: duplicateMemoryEvent.status,
      }, headersFor(model));
      return;
    }
    const limited = rejectIfLimited({ req, model, inputTokens });
    if (limited) {
      sendJson(res, 429, {
        error: 'AI_RATE_LIMITED',
        message: 'AI usage is temporarily limited to protect the shared project quota.',
        global: true,
        reason: limited.reason,
        retryAfterSeconds: limited.retryAfterSeconds,
        quota: limited.snapshot,
      }, {
        'Retry-After': limited.retryAfterSeconds,
        ...headersFor(model),
      });
      return;
    }
    memoryEvent = recordStart({ req, model, inputTokens, requestId });
  }

  try {
    const response = await fetchGemini({ model, requestBody, key, stream: wantsStream });

    if (wantsStream && response.ok && response.body) {
      res.statusCode = response.status;
      for (const [header, value] of Object.entries({
        ...streamHeadersFor(model),
        ...(reservation?.snapshot ? usageHeaders(reservation.snapshot) : {}),
        'X-AI-Request-Id': reservation?.reservationId || memoryEvent?.id || '',
      })) {
        if (value !== undefined && value !== null) res.setHeader(header, String(value));
      }

      let rawStream = '';
      for await (const chunk of response.body) {
        const buffer = Buffer.from(chunk);
        rawStream += buffer.toString('utf8');
        res.write(buffer);
      }
      const outputTokens = streamOutputTokens(rawStream);
      const providerStreamUsage = streamUsageMetadata(rawStream);
      const streamUsage = normalizeTokenUsage(providerStreamUsage || {}, {
        provider: 'gemini',
        model,
        requestId: reservation?.reservationId || memoryEvent?.id || '',
        fallbackInputTokens: inputTokens,
        fallbackOutputTokens: outputTokens,
        contextLimit: configuredContextLimit(model),
        route: payload?.route || payload?.usageMeta?.route || '',
        sessionId: payload?.sessionId || payload?.usageMeta?.sessionId || '',
        sourceDetail: providerStreamUsage ? 'gemini_stream_usage_metadata' : 'stream_server_estimate',
      });
      finalizeMemoryEvent(memoryEvent, streamUsage, true);
      let completedSnapshot = null;
      if (reservation) {
        completedSnapshot = await completeAIUsage({
          reservation,
          ok: true,
          totalTokens: streamUsage.totalTokens,
          outputTokens: streamUsage.outputTokens,
          providerMeasured: streamUsage.source === 'provider',
          tokenUsage: streamUsage,
        }).catch(err => {
          console.warn('[AI usage] stream completion failed:', err?.message || err);
          return null;
        });
      }
      res.write(`\nevent: sci_usage\ndata: ${JSON.stringify({
        sciUsage: streamUsage,
        usageSnapshot: completedSnapshot ? {
          usedTokens: completedSnapshot.used?.usedTokens ?? null,
          requestCount: completedSnapshot.used?.requestCount ?? null,
        } : null,
      })}\n\n`);
      res.end();
      return;
    }

    const body = await response.json().catch(() => ({}));
    const requestId = reservation?.reservationId || memoryEvent?.id || '';
    const tokenUsage = response.ok
      ? normalizeTokenUsage(body?.usageMetadata || {}, {
        provider: 'gemini',
        model,
        requestId,
        fallbackInputTokens: inputTokens,
        fallbackOutputTokens: responseOutputTokens(body),
        contextLimit: configuredContextLimit(model),
        route: payload?.route || payload?.usageMeta?.route || '',
        sessionId: payload?.sessionId || payload?.usageMeta?.sessionId || '',
        sourceDetail: body?.usageMetadata ? 'gemini_usage_metadata' : 'server_estimate',
      })
      : normalizeTokenUsage({}, {
        provider: 'gemini',
        model,
        requestId,
        fallbackInputTokens: 0,
        fallbackOutputTokens: 0,
        allowEstimate: false,
        status: 'error',
        sourceDetail: 'error_no_usage',
      });
    finalizeMemoryEvent(memoryEvent, tokenUsage, response.ok);
    const completedSnapshot = reservation
      ? await completeAIUsage({
        reservation,
        ok: response.ok,
        totalTokens: tokenUsage.totalTokens,
        outputTokens: tokenUsage.outputTokens,
        providerMeasured: tokenUsage.source === 'provider',
        tokenUsage,
      }).catch(err => {
        console.warn('[AI usage] completion failed:', err?.message || err);
        return reservation.snapshot;
      })
      : null;

    sendJson(res, response.status, response.ok ? { ...body, sciUsage: tokenUsage } : body, headersFor(model, completedSnapshot || reservation?.snapshot, tokenUsage));
  } catch (err) {
    finalizeMemoryEvent(memoryEvent, null, false);
    if (reservation) {
      completeAIUsage({
        reservation,
        ok: false,
        totalTokens: 0,
        outputTokens: 0,
        providerMeasured: false,
      }).catch(usageErr => console.warn('[AI usage] failure completion failed:', usageErr?.message || usageErr));
    }
    const message = err?.name === 'AbortError'
      ? 'Gemini request timed out.'
      : 'Gemini request failed.';
    sendJson(res, err?.name === 'AbortError' ? 504 : 502, {
      error: err?.name === 'AbortError' ? 'GEMINI_TIMEOUT' : 'GEMINI_PROXY_FAILED',
      message,
    }, headersFor(model, reservation?.snapshot));
  }
}
