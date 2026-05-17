import { aiExecutiveEvaluationSet } from '../src/data/aiExecutiveEvaluationSet.js';

const DEFAULT_ENDPOINT = 'https://sci-ai-dashboradmju.vercel.app/api/gemini-chat';
const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

function argValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const match = process.argv.find(arg => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function takeCases(limit) {
  const selected = aiExecutiveEvaluationSet.slice(0, limit || aiExecutiveEvaluationSet.length);
  return selected.map((item, index) => ({ ...item, index: index + 1 }));
}

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function responseText(body) {
  return body?.candidates?.[0]?.content?.parts
    ?.map(part => part?.text || '')
    .join('\n')
    .trim() || '';
}

function buildSystemInstruction(item) {
  return [
    'You are SCI AI Dashboard evaluation assistant.',
    'Answer in Thai, professionally and concisely.',
    'Do not invent numbers. If evidence is missing, state the limitation.',
    'Separate facts from recommendations.',
    'Always include a short "แหล่งข้อมูลที่ใช้" section.',
    item.requiresChart
      ? 'If the question asks for a chart, include a valid json_chart block with labels and datasets.'
      : 'Do not include a chart unless the question clearly needs one.',
    `Evaluation intent: ${item.intent}`,
    `Expected datasets: ${(item.expectedDatasets || []).join(', ') || 'none'}`,
    `Privacy mode: ${item.privacy}`,
  ].join('\n');
}

function buildGeminiRequest(item, model) {
  return {
    model,
    requestBody: {
      system_instruction: {
        parts: [{ text: buildSystemInstruction(item) }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: item.question }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        topP: 0.85,
        maxOutputTokens: item.requiresChart ? 1400 : 900,
      },
    },
    usageUser: {
      uid: 'ai-e2e-eval',
      role: item.role,
      email: '',
    },
  };
}

function evaluateText(item, text) {
  const normalized = normalizeText(text);
  const issues = [];
  const warnings = [];

  if (normalized.length < 40) issues.push('empty_or_too_short_response');

  for (const forbidden of item.mustNotInclude || []) {
    if (forbidden && normalized.includes(normalizeText(forbidden))) {
      issues.push(`forbidden_text:${forbidden}`);
    }
  }

  const missingRequired = (item.mustInclude || [])
    .filter(required => required && !normalized.includes(normalizeText(required)));
  if (missingRequired.length) {
    warnings.push(`missing_expected_terms:${missingRequired.slice(0, 3).join('|')}`);
  }

  if (item.expectedDatasets?.length && !/source|แหล่งข้อมูล|dataset|context/i.test(text)) {
    warnings.push('missing_visible_source_section');
  }

  if (item.requiresChart && !/```json_chart|chartType|datasets/i.test(text)) {
    warnings.push('missing_chart_payload');
  }

  return { issues, warnings };
}

async function runLiveCase(endpoint, model, item, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildGeminiRequest(item, model)),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    const text = responseText(body);
    const evaluation = evaluateText(item, text);
    return {
      id: item.id,
      ok: response.ok && evaluation.issues.length === 0,
      status: response.status,
      warnings: evaluation.warnings,
      issues: response.ok ? evaluation.issues : [`http_${response.status}:${body?.error || body?.message || 'request_failed'}`],
      textLength: text.length,
      tokenCount: body?.usageMetadata?.totalTokenCount || null,
    };
  } catch (error) {
    return {
      id: item.id,
      ok: false,
      status: 0,
      warnings: [],
      issues: [error?.name === 'AbortError' ? 'timeout' : (error?.message || 'request_failed')],
      textLength: 0,
      tokenCount: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function runOffline() {
  const cases = aiExecutiveEvaluationSet;
  const checks = [
    ['case_count_30_to_50', cases.length >= 30 && cases.length <= 50],
    ['has_executive_advice', cases.some(item => item.intent === 'executive_advice')],
    ['has_chart_cases', cases.filter(item => item.requiresChart).length >= 8],
    ['has_blocked_sensitive', cases.some(item => item.intent === 'blocked_sensitive')],
    ['has_student_and_general_roles', cases.some(item => item.role === 'student') && cases.some(item => item.role === 'general')],
    ['no_hardcoded_answers', cases.every(item => !('answer' in item) && !('expectedAnswer' in item))],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (failed.length) {
    console.error(`\nAI E2E offline gate failed: ${failed.length}/${checks.length}`);
    process.exit(1);
  }
  console.log(`\nAI E2E eval runner ready: ${cases.length} cases`);
  console.log(`Live mode: npm run eval:e2e -- --live --limit=5 --endpoint=${DEFAULT_ENDPOINT}`);
}

async function main() {
  const live = hasFlag('live') || process.env.AI_E2E_LIVE === '1';
  if (!live) {
    runOffline();
    return;
  }

  const endpoint = argValue('endpoint', process.env.AI_E2E_ENDPOINT || DEFAULT_ENDPOINT);
  const model = argValue('model', process.env.AI_E2E_MODEL || DEFAULT_MODEL);
  const limit = Number(argValue('limit', process.env.AI_E2E_LIMIT || '8'));
  const timeoutMs = Number(argValue('timeout', process.env.AI_E2E_TIMEOUT_MS || '45000'));
  const cases = takeCases(Number.isFinite(limit) && limit > 0 ? limit : 8);
  const results = [];

  console.log(`Running live AI E2E eval: ${cases.length} cases`);
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Model: ${model}`);

  for (const item of cases) {
    const result = await runLiveCase(endpoint, model, item, timeoutMs);
    results.push(result);
    const label = result.ok ? 'PASS' : 'FAIL';
    const warn = result.warnings.length ? ` WARN ${result.warnings.join(', ')}` : '';
    const issue = result.issues.length ? ` ${result.issues.join(', ')}` : '';
    console.log(`${label} ${item.index}. ${item.id} HTTP ${result.status} len=${result.textLength}${warn}${issue}`);
  }

  const failed = results.filter(item => !item.ok);
  const warned = results.filter(item => item.warnings.length);
  console.log(`\nAI E2E live summary: passed ${results.length - failed.length}/${results.length}, warnings ${warned.length}`);
  if (failed.length) process.exit(1);
}

await main();
