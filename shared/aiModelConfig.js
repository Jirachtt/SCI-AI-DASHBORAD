// The project currently has reliable quota for 3.1 Flash-Lite. Keep 3.5 as
// an escalation fallback instead of spending one failed request before every
// successful answer.
export const PRIMARY_AI_MODEL = 'gemini-3.1-flash-lite';
export const FALLBACK_AI_MODEL = 'gemini-3.5-flash';
export const LEGACY_SEARCH_FALLBACK_AI_MODEL = 'gemini-2.5-flash';

// Keep model capabilities and application-side safety limits in one shared
// module so the browser router and Vercel proxy cannot drift apart.
export const AI_MODEL_CONFIG = Object.freeze({
  [PRIMARY_AI_MODEL]: Object.freeze({
    tier: 'lite',
    label: 'Gemini 3.1 Flash-Lite',
    bestFor: 'คำถามทั่วไป งานวิเคราะห์ RAG และการสร้างกราฟที่รวดเร็ว',
    searchCapable: true,
    rateLimits: Object.freeze({ rpm: 15, tpm: 250_000, rpd: 1_000 }),
  }),
  [FALLBACK_AI_MODEL]: Object.freeze({
    tier: 'standard',
    label: 'Gemini 3.5 Flash',
    bestFor: 'โมเดลสำรองสำหรับงานวิเคราะห์ที่ต้องยกระดับเมื่อโควตาพร้อม',
    searchCapable: true,
    rateLimits: Object.freeze({ rpm: 10, tpm: 250_000, rpd: 250 }),
  }),
  // Gemini 3 web grounding requires a paid project. Keep this supported stable
  // model only as a search fallback for existing free-tier deployments. Google
  // lists 2026-10-16 as its earliest shutdown date, so it is never the default.
  [LEGACY_SEARCH_FALLBACK_AI_MODEL]: Object.freeze({
    tier: 'standard',
    label: 'Gemini 2.5 Flash (Web fallback)',
    bestFor: 'ค้นเว็บสำรองระหว่างรอเปิด Billing สำหรับ Gemini 3',
    searchCapable: true,
    selectable: false,
    rateLimits: Object.freeze({ rpm: 10, tpm: 250_000, rpd: 250 }),
  }),
});

// Production uses pinned stable model IDs. Avoid *-latest aliases because
// their behavior can change without a code deployment.
export const AI_MODEL_ORDER = Object.freeze([
  PRIMARY_AI_MODEL,
  FALLBACK_AI_MODEL,
]);

export const AI_SEARCH_MODEL_ORDER = Object.freeze(
  [LEGACY_SEARCH_FALLBACK_AI_MODEL, PRIMARY_AI_MODEL, FALLBACK_AI_MODEL]
    .filter(model => AI_MODEL_CONFIG[model]?.searchCapable)
);

export const AI_ALLOWED_MODEL_IDS = Object.freeze(Object.keys(AI_MODEL_CONFIG));

export function isAllowedAIModel(model) {
  return AI_ALLOWED_MODEL_IDS.includes(String(model || '').trim());
}

export function getAIModelRateDefaults() {
  return Object.fromEntries(
    AI_ALLOWED_MODEL_IDS.map(model => [model, { ...AI_MODEL_CONFIG[model].rateLimits }])
  );
}
