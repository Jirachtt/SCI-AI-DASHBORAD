import assert from 'node:assert/strict';
import {
  isProviderMeasuredUsage,
  normalizeAIUsage,
  usageHasTokenValues,
} from '../shared/aiUsageSchema.js';
import { parseGeminiStreamPayloads } from '../api/gemini-chat.js';

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

globalThis.sessionStorage = new MemoryStorage();
const {
  getTokenUsageSessionSummary,
  recordTokenUsageSession,
  resetTokenUsageSession,
} = await import('../src/utils/aiTokenUsage.js');

const checks = [];
function check(name, fn) {
  fn();
  checks.push(name);
}

check('Gemini usageMetadata maps to actual token fields', () => {
  const usage = normalizeAIUsage({
    promptTokenCount: 120,
    candidatesTokenCount: 40,
    thoughtsTokenCount: 8,
    cachedContentTokenCount: 20,
    totalTokenCount: 168,
  }, { provider: 'gemini', model: 'gemini-3.5-flash', requestId: 'gemini_actual' });
  assert.equal(usage.inputTokens, 120);
  assert.equal(usage.outputTokens, 40);
  assert.equal(usage.thinkingTokens, 8);
  assert.equal(usage.cachedTokens, 20);
  assert.equal(usage.totalTokens, 168);
  assert.equal(usage.isEstimated, false);
  assert.equal(isProviderMeasuredUsage(usage), true);
});

check('OpenAI usage maps cached and reasoning details', () => {
  const usage = normalizeAIUsage({
    input_tokens: 200,
    output_tokens: 80,
    total_tokens: 280,
    input_tokens_details: { cached_tokens: 50 },
    output_tokens_details: { reasoning_tokens: 20 },
  }, { provider: 'openai', model: 'future-model', requestId: 'openai_actual' });
  assert.equal(usage.cachedTokens, 50);
  assert.equal(usage.thinkingTokens, 20);
  assert.equal(usage.totalTokens, 280);
  assert.equal(usage.source, 'provider');
});

check('Missing provider metadata is explicitly estimated', () => {
  const shortUsage = normalizeAIUsage({}, {
    provider: 'gemini',
    fallbackInputText: 'short question',
    fallbackOutputText: 'short answer',
  });
  const longUsage = normalizeAIUsage({}, {
    provider: 'gemini',
    fallbackInputText: 'long context '.repeat(500),
    fallbackOutputText: 'long answer '.repeat(100),
  });
  assert.equal(shortUsage.isEstimated, true);
  assert.equal(shortUsage.source, 'estimated');
  assert.ok(longUsage.totalTokens > shortUsage.totalTokens);
});

check('Errors without metadata do not display a fabricated zero', () => {
  const usage = normalizeAIUsage({}, {
    provider: 'gemini',
    allowEstimate: false,
    status: 'error',
  });
  assert.equal(usage.totalTokens, null);
  assert.equal(usageHasTokenValues(usage), false);
});

check('Local answers are zero-token interactions, not model requests', () => {
  const usage = normalizeAIUsage({}, {
    provider: 'local',
    model: 'local',
    requestId: 'local_1',
    fallbackInputTokens: 0,
    fallbackOutputTokens: 0,
    source: 'local',
    isLocal: true,
  });
  assert.equal(usage.totalTokens, 0);
  assert.equal(usage.requestCount, 0);
  assert.equal(usage.source, 'local');
});

check('Streaming parser reads final Gemini usage exactly once', () => {
  const stream = [
    'data: {"candidates":[{"content":{"parts":[{"text":"hello"}]}}]}',
    'data: {"candidates":[{"content":{"parts":[{"text":" world"}]}}],"usageMetadata":{"promptTokenCount":11,"candidatesTokenCount":2,"totalTokenCount":13}}',
  ].join('\n\n');
  const payloads = parseGeminiStreamPayloads(stream);
  assert.equal(payloads.length, 2);
  const finalUsage = normalizeAIUsage(payloads.at(-1).usageMetadata, { provider: 'gemini' });
  assert.equal(finalUsage.totalTokens, 13);
  assert.equal(finalUsage.source, 'provider');
});

check('RAG, chart and file metadata survive normalization without raw content', () => {
  const usage = normalizeAIUsage({ promptTokenCount: 300, candidatesTokenCount: 90, totalTokenCount: 390 }, {
    provider: 'gemini',
    requestId: 'rag_chart_file',
    selectedDatasets: ['student_stats', 'uploaded_file:test.xlsx', 'chart_analysis'],
    contextCount: 3,
    contextChars: 8_400,
  });
  assert.deepEqual(usage.selectedDatasets, ['student_stats', 'uploaded_file:test.xlsx', 'chart_analysis']);
  assert.equal(usage.contextCount, 3);
  assert.equal(usage.contextChars, 8_400);
  assert.equal(Object.hasOwn(usage, 'prompt'), false);
  assert.equal(Object.hasOwn(usage, 'response'), false);
});

check('Session totals are idempotent and persist across reload-style reads', () => {
  resetTokenUsageSession();
  const records = [
    normalizeAIUsage({ promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 }, { provider: 'gemini', requestId: 'req_1' }),
    normalizeAIUsage({ promptTokenCount: 20, candidatesTokenCount: 8, totalTokenCount: 28 }, { provider: 'gemini', requestId: 'req_2' }),
    normalizeAIUsage({ promptTokenCount: 30, candidatesTokenCount: 12, totalTokenCount: 42 }, { provider: 'gemini', requestId: 'req_3' }),
  ];
  records.forEach(recordTokenUsageSession);
  recordTokenUsageSession(records[1]);
  const summary = getTokenUsageSessionSummary();
  assert.equal(summary.requestCount, 3);
  assert.equal(summary.totalTokens, 85);
  assert.equal(summary.actualTokens, 85);
  assert.equal(summary.records.length, 3);
});

check('Invalid component totals carry a sanity warning', () => {
  const usage = normalizeAIUsage({ promptTokenCount: 10, candidatesTokenCount: 8, totalTokenCount: 12 }, { provider: 'gemini' });
  assert.equal(usage.sanityWarning, 'input_output_exceeds_total');
});

function parseUsageEvent(raw) {
  const match = String(raw).match(/event:\s*sci_usage\s*\r?\ndata:\s*(\{[^\r\n]+\})/);
  return match ? JSON.parse(match[1]).sciUsage : null;
}

async function callLive(baseUrl, requestId, prompt, stream = false) {
  const response = await fetch(`${baseUrl}/api/gemini-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId,
      sessionId: 'usage_audit_session',
      route: '/audit/ai-usage',
      model: 'gemini-3.5-flash',
      stream,
      requestBody: {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 120, temperature: 0.1 },
      },
      usageMeta: {
        selectedIntent: stream ? 'chart' : 'general',
        selectedDatasets: stream ? ['chart_analysis'] : [],
        contextCount: stream ? 1 : 0,
      },
    }),
  });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('text/event-stream')
    ? await response.text()
    : await response.json().catch(() => ({}));
  const usage = typeof body === 'string' ? parseUsageEvent(body) : body.sciUsage;
  return { response, usage };
}

async function runLiveChecks() {
  const baseUrl = String(process.env.AI_USAGE_TEST_BASE_URL || 'http://127.0.0.1:5175').replace(/\/$/, '');
  const stamp = Date.now();
  const requests = [
    [`usage_live_${stamp}_1`, 'ตอบคำเดียวว่า พร้อม', false],
    [`usage_live_${stamp}_2`, `สรุปหลักการวิเคราะห์ข้อมูลมหาวิทยาลัยอย่างกระชับจากข้อความนี้: ${'ข้อมูลบริบท '.repeat(120)}`, false],
    [`usage_live_${stamp}_3`, 'เสนอชื่อกราฟหนึ่งชื่อสำหรับเปรียบเทียบจำนวนนักศึกษาตามสาขา', true],
  ];
  const measured = [];
  for (const [requestId, prompt, stream] of requests) {
    const result = await callLive(baseUrl, requestId, prompt, stream);
    assert.equal(result.response.ok, true, `Live request failed: HTTP ${result.response.status}`);
    assert.ok(result.usage, 'Live response did not contain normalized usage');
    assert.ok(Number(result.usage.totalTokens) > 0, 'Live usage must be greater than zero');
    measured.push({
      requestId,
      source: result.usage.source,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      thinkingTokens: result.usage.thinkingTokens,
      totalTokens: result.usage.totalTokens,
      stream,
    });
  }
  const duplicate = await callLive(baseUrl, requests[0][0], requests[0][1], false);
  assert.equal(duplicate.response.status, 409, 'Duplicate requestId must be rejected without recounting');
  const total = measured.reduce((sum, item) => sum + Number(item.totalTokens || 0), 0);
  console.log(JSON.stringify({ baseUrl, measured, verifiedTotal: total, duplicateStatus: duplicate.response.status }, null, 2));
}

if (process.argv.includes('--live')) {
  await runLiveChecks();
}

console.log(`AI usage meter audit passed: ${checks.length} deterministic checks${process.argv.includes('--live') ? ' + 3 live provider requests' : ''}.`);
