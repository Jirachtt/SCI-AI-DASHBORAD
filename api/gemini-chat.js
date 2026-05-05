/* global process */

import { Buffer } from 'node:buffer';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS || 35000);
const WINDOW_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const ALLOWED_MODELS = new Set([
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
]);

const MODEL_DEFAULTS = {
  'gemini-2.5-flash-lite': { rpm: 15, tpm: 250_000, rpd: 1_000 },
  'gemini-2.5-flash': { rpm: 10, tpm: 250_000, rpd: 250 },
  'gemini-flash-lite-latest': { rpm: 15, tpm: 250_000, rpd: 1_000 },
  'gemini-flash-latest': { rpm: 10, tpm: 250_000, rpd: 250 },
  'gemini-2.0-flash-lite': { rpm: 30, tpm: 1_000_000, rpd: 200 },
  'gemini-2.0-flash': { rpm: 15, tpm: 1_000_000, rpd: 200 },
};

const LIMITS = {
  globalRpm: readPositiveInt('AI_GLOBAL_RPM_LIMIT', 45),
  globalTpm: readPositiveInt('AI_GLOBAL_TPM_LIMIT', 750_000),
  globalRpd: readPositiveInt('AI_GLOBAL_RPD_LIMIT', 500),
  dailyTokenBudget: readPositiveInt('AI_DAILY_TOKEN_BUDGET', 1_000_000),
  clientRpm: readPositiveInt('AI_CLIENT_RPM_LIMIT', 6),
};

const usageState = globalThis.__SCI_AI_GEMINI_USAGE__ || {
  minuteEvents: [],
  dayEvents: [],
};
globalThis.__SCI_AI_GEMINI_USAGE__ = usageState;

function readPositiveInt(key, fallback) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

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
    || process.env.VITE_GEMINI_API_KEY
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
    (sum, event) => sum + Number(event.inputTokens || 0) + Number(event.outputTokens || 0),
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
      dailyTokenBudget: Math.max(0, LIMITS.dailyTokenBudget - dailyTokens),
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
    ['daily_token_budget', projectedDailyTokens > LIMITS.dailyTokenBudget],
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

function recordStart({ req, model, inputTokens }) {
  const event = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    at: Date.now(),
    clientKey: clientKey(req),
    model,
    inputTokens,
    outputTokens: 0,
  };
  usageState.minuteEvents.push(event);
  usageState.dayEvents.push(event);
  return event;
}

function headersFor(model) {
  const current = snapshot(model);
  const remainingPercent = Math.round((current.remaining.globalRpm / current.limits.globalRpm) * 100);
  const tokenPercent = Math.round((current.remaining.dailyTokenBudget / current.limits.dailyTokenBudget) * 100);
  return {
    'X-AI-Model': model,
    'X-AI-RateLimit-Limit': current.limits.globalRpm,
    'X-AI-RateLimit-Remaining': current.remaining.globalRpm,
    'X-AI-RateLimit-Remaining-Percent': remainingPercent,
    'X-AI-Token-Budget': current.limits.dailyTokenBudget,
    'X-AI-Token-Remaining': current.remaining.dailyTokenBudget,
    'X-AI-Token-Remaining-Percent': tokenPercent,
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

  const inputTokens = requestInputTokens(requestBody);
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

  const event = recordStart({ req, model, inputTokens });

  try {
    const response = await fetchGemini({ model, requestBody, key, stream: wantsStream });

    if (wantsStream && response.ok && response.body) {
      res.statusCode = response.status;
      for (const [header, value] of Object.entries(streamHeadersFor(model))) {
        if (value !== undefined && value !== null) res.setHeader(header, String(value));
      }

      let rawStream = '';
      for await (const chunk of response.body) {
        const buffer = Buffer.from(chunk);
        rawStream += buffer.toString('utf8');
        res.write(buffer);
      }
      event.outputTokens = estimateTokens(rawStream);
      res.end();
      return;
    }

    const body = await response.json().catch(() => ({}));
    event.outputTokens = response.ok ? responseOutputTokens(body) : 0;

    sendJson(res, response.status, body, headersFor(model));
  } catch (err) {
    const message = err?.name === 'AbortError'
      ? 'Gemini request timed out.'
      : 'Gemini request failed.';
    sendJson(res, err?.name === 'AbortError' ? 504 : 502, {
      error: err?.name === 'AbortError' ? 'GEMINI_TIMEOUT' : 'GEMINI_PROXY_FAILED',
      message,
    }, headersFor(model));
  }
}
