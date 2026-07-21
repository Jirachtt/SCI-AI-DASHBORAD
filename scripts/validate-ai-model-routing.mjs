import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  AI_ALLOWED_MODEL_IDS,
  AI_MODEL_CONFIG,
  AI_MODEL_ORDER,
  AI_SEARCH_MODEL_ORDER,
  FALLBACK_AI_MODEL,
  LEGACY_SEARCH_FALLBACK_AI_MODEL,
  PRIMARY_AI_MODEL,
  getAIModelRateDefaults,
} from '../shared/aiModelConfig.js';
import { isValidChartConfig } from '../src/utils/aiChartResponse.js';

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function argValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const match = process.argv.find(arg => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function responseText(body) {
  return body?.candidates?.[0]?.content?.parts
    ?.map(part => part?.text || '')
    .join('')
    .trim() || '';
}

function chartSchema() {
  return {
    type: 'object',
    properties: {
      chartType: { type: 'string' },
      data: {
        type: 'object',
        properties: {
          labels: { type: 'array', items: { type: 'string' } },
          datasets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                data: { type: 'array', items: { type: 'number' } },
              },
              required: ['label', 'data'],
            },
          },
        },
        required: ['labels', 'datasets'],
      },
    },
    required: ['chartType', 'data'],
  };
}

async function postModelResult(baseUrl, requestBody, suffix, model = PRIMARY_AI_MODEL) {
  const response = await fetch(`${baseUrl}/api/gemini-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId: `model_audit_${Date.now()}_${suffix}`,
      sessionId: 'model-routing-audit',
      route: '/audit/ai-models',
      model,
      requestBody,
      usageUser: { uid: 'model-routing-audit', role: 'dean', email: '' },
    }),
  });
  const body = await response.json().catch(() => ({}));
  return { response, body, model };
}

function assertSuccessfulModelResult(result, suffix) {
  assert.equal(result.response.ok, true, `${suffix} request failed: HTTP ${result.response.status} ${JSON.stringify(result.body?.error || result.body?.message || '')}`);
  assert.equal(result.response.headers.get('x-ai-model'), result.model, `${suffix} returned an unexpected model header`);
  return result.body;
}

async function postModel(baseUrl, requestBody, suffix, model = PRIMARY_AI_MODEL) {
  return assertSuccessfulModelResult(
    await postModelResult(baseUrl, requestBody, suffix, model),
    suffix
  );
}

async function runOffline() {
  assert.equal(PRIMARY_AI_MODEL, 'gemini-3.5-flash');
  assert.equal(FALLBACK_AI_MODEL, 'gemini-3.1-flash-lite');
  assert.deepEqual([...AI_MODEL_ORDER], [PRIMARY_AI_MODEL, FALLBACK_AI_MODEL]);
  assert.deepEqual([...AI_SEARCH_MODEL_ORDER], [PRIMARY_AI_MODEL, LEGACY_SEARCH_FALLBACK_AI_MODEL, FALLBACK_AI_MODEL]);
  assert.deepEqual([...AI_ALLOWED_MODEL_IDS], [PRIMARY_AI_MODEL, FALLBACK_AI_MODEL, LEGACY_SEARCH_FALLBACK_AI_MODEL]);
  assert.ok(AI_ALLOWED_MODEL_IDS.every(model => !model.endsWith('-latest')), 'Hot-swapped aliases are not allowed');
  assert.equal(AI_MODEL_ORDER.includes(LEGACY_SEARCH_FALLBACK_AI_MODEL), false, 'Legacy search fallback must never become a normal default');
  assert.ok(AI_ALLOWED_MODEL_IDS.every(model => AI_MODEL_CONFIG[model]?.searchCapable), 'Every routed model must support trusted web grounding');
  assert.ok(AI_ALLOWED_MODEL_IDS.every(model => getAIModelRateDefaults()[model]?.rpm > 0), 'Every model needs protective app limits');

  const [clientSource, proxySource] = await Promise.all([
    readFile(new URL('../src/services/geminiService.js', import.meta.url), 'utf8'),
    readFile(new URL('../api/gemini-chat.js', import.meta.url), 'utf8'),
  ]);
  assert.match(clientSource, /AI_MODEL_ORDER/);
  assert.match(proxySource, /AI_ALLOWED_MODEL_IDS/);
  assert.doesNotMatch(`${clientSource}\n${proxySource}`, /gemini-2\.0|gemini-(?:flash|flash-lite)-latest/);
  console.log('PASS shared model routing: Gemini 3.5 Flash -> Gemini 3.1 Flash-Lite');
  console.log('PASS retired/hot-swapped IDs are absent; Gemini 2.5 is search-only compatibility');
}

async function runLive() {
  const baseUrl = String(argValue('base-url', process.env.AI_MODEL_TEST_BASE_URL || 'http://127.0.0.1:5175')).replace(/\/$/, '');
  const commonConfig = { temperature: 0.1, maxOutputTokens: 500 };

  const internal = await postModel(baseUrl, {
    system_instruction: { parts: [{ text: 'ตอบภาษาไทยสั้น กระชับ และใช้เฉพาะหลักฐานที่ผู้ใช้ให้' }] },
    contents: [{ role: 'user', parts: [{ text: 'หลักฐาน: คณะวิทยาศาสตร์มีนักศึกษา 1,390 คน ตอบจำนวนจากหลักฐานนี้' }] }],
    generationConfig: commonConfig,
  }, 'internal');
  assert.match(responseText(internal), /1[,.]?390/);
  console.log('PASS primary model answers from supplied internal evidence');

  const groundingRequest = {
    system_instruction: { parts: [{ text: 'ค้นเว็บและตอบจากเว็บไซต์ทางการของมหาวิทยาลัยแม่โจ้ พร้อมกล่าวชื่อโดเมนที่ใช้' }] },
    contents: [{ role: 'user', parts: [{ text: 'มหาวิทยาลัยแม่โจ้ตั้งอยู่จังหวัดใด ตรวจจากเว็บไซต์ทางการ' }] }],
    tools: [{ google_search: {} }],
    generationConfig: commonConfig,
  };
  let groundedResult = await postModelResult(baseUrl, groundingRequest, 'grounding_primary');
  if (!groundedResult.response.ok && groundedResult.response.status === 429) {
    console.log('INFO Gemini 3 grounding is unavailable on this project; checking the supported search fallback');
    groundedResult = await postModelResult(
      baseUrl,
      groundingRequest,
      'grounding_fallback',
      LEGACY_SEARCH_FALLBACK_AI_MODEL
    );
  }
  const grounded = assertSuccessfulModelResult(groundedResult, 'grounding');
  const groundingChunks = grounded?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  assert.ok(groundingChunks.length > 0, 'Google Search returned no grounding evidence');
  assert.ok(responseText(grounded).length > 20, 'Grounded answer is empty');
  console.log(`PASS Google Search grounding returned ${groundingChunks.length} source chunk(s)`);

  const chart = await postModel(baseUrl, {
    system_instruction: { parts: [{ text: 'สร้างกราฟจากตัวเลขที่ให้เท่านั้น' }] },
    contents: [{ role: 'user', parts: [{ text: 'สร้าง bar chart: เคมี 120 คน และคณิตศาสตร์ 90 คน' }] }],
    generationConfig: {
      ...commonConfig,
      responseMimeType: 'application/json',
      responseJsonSchema: chartSchema(),
    },
  }, 'chart');
  const chartConfig = JSON.parse(responseText(chart));
  assert.equal(isValidChartConfig(chartConfig), true, 'Structured chart response is invalid');
  assert.deepEqual(chartConfig.data.datasets[0].data, [120, 90]);
  console.log('PASS structured chart output is valid and preserves evidence values');
}

await runOffline();
if (hasFlag('live') || process.env.AI_MODEL_LIVE === '1') {
  await runLive();
} else {
  console.log('Live checks skipped; run npm run audit:ai-models -- --live');
}
