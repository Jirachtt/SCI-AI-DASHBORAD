const DEFAULT_BASE_URL = 'https://sci-ai-dashboradmju.vercel.app';

function argValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const match = process.argv.find(arg => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function trimSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function okStatus(status, allowProtected = false) {
  if (status >= 200 && status < 400) return true;
  if (allowProtected && [401, 403, 405].includes(status)) return true;
  return false;
}

async function checkRoute({ baseUrl, path, method = 'GET', body = null, allowProtected = false, expectJson = false, timeoutMs = 15000 }) {
  const url = `${baseUrl}${path}`;
  const started = Date.now();
  try {
    const response = await fetchWithTimeout(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'follow',
    }, timeoutMs);
    const ms = Date.now() - started;
    const contentType = response.headers.get('content-type') || '';
    const ok = okStatus(response.status, allowProtected) && (!expectJson || contentType.includes('application/json'));
    return {
      ok,
      path,
      status: response.status,
      ms,
      detail: ok ? '' : `status=${response.status} content-type=${contentType || 'unknown'}`,
    };
  } catch (error) {
    return {
      ok: false,
      path,
      status: 0,
      ms: Date.now() - started,
      detail: error?.name === 'AbortError' ? 'timeout' : (error?.message || 'request failed'),
    };
  }
}

function minimalAIRequest(model) {
  return {
    model,
    requestBody: {
      system_instruction: {
        parts: [{ text: 'Return one short Thai sentence. This is a production smoke test.' }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: 'ทดสอบระบบ AI สั้น ๆ' }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 256,
      },
    },
    usageUser: {
      uid: 'vercel-smoke',
      role: 'dean',
      email: '',
    },
  };
}

async function main() {
  const baseUrl = trimSlash(argValue('base-url', process.env.VERCEL_SMOKE_BASE_URL || process.env.PRODUCTION_BASE_URL || DEFAULT_BASE_URL));
  const includeAI = hasFlag('ai') || process.env.VERCEL_SMOKE_AI === '1';
  const model = argValue('model', process.env.VERCEL_SMOKE_MODEL || 'gemini-3.5-flash');

  const checks = [
    { baseUrl, path: '/', allowProtected: false },
    { baseUrl, path: '/dashboard', allowProtected: false },
    { baseUrl, path: '/api/ai-usage', allowProtected: true, expectJson: true },
    { baseUrl, path: '/api/gemini-chat', allowProtected: true },
  ];

  if (includeAI) {
    checks.push({
      baseUrl,
      path: '/api/gemini-chat',
      method: 'POST',
      body: minimalAIRequest(model),
      allowProtected: false,
      expectJson: true,
      // A cold Vercel Function plus provider reasoning can legitimately exceed
      // the 15-second budget used for ordinary HTTP health checks.
      timeoutMs: 60000,
    });
  }

  console.log(`Vercel production smoke: ${baseUrl}`);
  console.log(includeAI ? 'AI call: enabled' : 'AI call: skipped (use --ai to spend one tiny request)');

  const results = [];
  for (const check of checks) {
    const result = await checkRoute(check);
    results.push(result);
    console.log(`${result.ok ? 'PASS' : 'FAIL'} ${check.method || 'GET'} ${result.path} HTTP ${result.status} ${result.ms}ms${result.detail ? ` ${result.detail}` : ''}`);
  }

  const failed = results.filter(item => !item.ok);
  if (failed.length) {
    console.error(`\nVercel production smoke failed: ${failed.length}/${results.length}`);
    process.exit(1);
  }

  console.log(`\nVercel production smoke passed: ${results.length}/${results.length}`);
}

await main();
