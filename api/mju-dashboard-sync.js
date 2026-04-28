/* global process */

const DATASET_ENV_PREFIX = 'MJU_DASHBOARD_SOURCE_';

const DEFAULT_PUBLIC_SOURCES = {
  student_stats: 'https://dashboard.mju.ac.th/student',
  research: 'https://dashboard.mju.ac.th/scopusList?dep=20300-20300',
  dashboard_summary: 'https://dashboard.mju.ac.th/',
};

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function sourceForDataset(dataset) {
  const envKey = `${DATASET_ENV_PREFIX}${String(dataset || '').toUpperCase()}`;
  return process.env[envKey] || DEFAULT_PUBLIC_SOURCES[dataset] || '';
}

function stripTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseHtmlTables(html) {
  const tables = [];
  const tableMatches = String(html || '').match(/<table[\s\S]*?<\/table>/gi) || [];
  for (const tableHtml of tableMatches) {
    const rowMatches = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    const rows = rowMatches.map(rowHtml => {
      const cellMatches = rowHtml.match(/<t[hd][\s\S]*?<\/t[hd]>/gi) || [];
      return cellMatches.map(cell => stripTags(cell));
    }).filter(row => row.some(Boolean));
    if (rows.length) tables.push(rows);
  }
  return tables;
}

function numberFromText(value) {
  const n = Number(String(value || '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function extractFusionChartXml(html) {
  const out = [];
  const regex = /setDataXML\("([\s\S]*?)"\);/g;
  let match;
  while ((match = regex.exec(String(html || '')))) {
    out.push(match[1]);
  }
  return out;
}

function parseCategoryLabels(xml) {
  return [...String(xml || '').matchAll(/<category\s+label='([^']*)'\s*\/>/g)].map(match => match[1]);
}

function parseDatasetValues(xml, seriesName) {
  const datasetRegex = new RegExp(`<dataset[^>]*seriesname='${seriesName}'[\\s\\S]*?<\\/dataset>`);
  const dataset = String(xml || '').match(datasetRegex)?.[0] || '';
  return [...dataset.matchAll(/<set\s+value='([^']*)'/g)].map(match => numberFromText(match[1]));
}

function normalizeStudentStatsFromFusionCharts(html) {
  const charts = extractFusionChartXml(html);
  const levelChart = charts.find(xml => xml.includes("xAxisName='ระดับการศึกษา'"));
  const facultyChart = charts.find(xml => xml.includes("xAxisName='หน่วยงาน'"));
  if (!levelChart || !facultyChart) return null;

  const levelMeta = [
    { pattern: /ปริญญาตรี/, color: '#006838', icon: 'BSc' },
    { pattern: /ปริญญาโท/, color: '#2E86AB', icon: 'MSc' },
    { pattern: /ปริญญาเอก/, color: '#A23B72', icon: 'PhD' },
    { pattern: /ประกาศนียบัตร/, color: '#C5A028', icon: 'Cert' },
  ];

  const levelLabels = parseCategoryLabels(levelChart);
  const levelTotals = parseDatasetValues(levelChart, 'ยอดรวม');
  const byLevel = levelLabels.map((level, index) => {
    const meta = levelMeta.find(item => item.pattern.test(level)) || {};
    return { level, count: levelTotals[index] || 0, color: meta.color, icon: meta.icon };
  }).filter(row => row.count > 0);

  const facultyLabels = parseCategoryLabels(facultyChart);
  const cert = parseDatasetValues(facultyChart, 'ประกาศนียบัตร');
  const bachelor = parseDatasetValues(facultyChart, 'ปริญญาตรี');
  const master = parseDatasetValues(facultyChart, 'ปริญญาโท');
  const doctoral = parseDatasetValues(facultyChart, 'ปริญญาเอก');
  const byFaculty = facultyLabels.map((name, index) => ({
    name,
    certificate: cert[index] || 0,
    bachelor: bachelor[index] || 0,
    master: master[index] || 0,
    doctoral: doctoral[index] || 0,
  })).filter(row => row.name && (row.certificate + row.bachelor + row.master + row.doctoral) > 0);

  const total = byLevel.reduce((sum, row) => sum + row.count, 0)
    || byFaculty.reduce((sum, row) => sum + row.certificate + row.bachelor + row.master + row.doctoral, 0);

  if (!total || byFaculty.length === 0) return null;

  return {
    current: { total, byLevel },
    byFaculty,
    sourceNote: 'Synced from public MJU Dashboard student page',
  };
}

function normalizeStudentStatsFromTables(tables) {
  const levelTable = tables.find(table => table.some(row => row.join(' ').includes('ปริญญาตรี')));
  const facultyTable = tables.find(table => table.some(row => row.join(' ').includes('วิทยาศาสตร์')));

  if (!levelTable || !facultyTable) return null;

  const levelMeta = [
    { pattern: /ปริญญาตรี/, color: '#006838', icon: 'BSc' },
    { pattern: /ปริญญาโท/, color: '#2E86AB', icon: 'MSc' },
    { pattern: /ปริญญาเอก/, color: '#A23B72', icon: 'PhD' },
    { pattern: /ประกาศนียบัตร/, color: '#C5A028', icon: 'Cert' },
  ];

  const byLevel = levelTable
    .flatMap(row => row)
    .reduce((acc, cell, index, cells) => {
      if (/ประกาศนียบัตร|ปริญญาตรี|ปริญญาโท|ปริญญาเอก/.test(cell)) {
        const total = numberFromText(cells[index + 2] || cells[index + 1]);
        const meta = levelMeta.find(item => item.pattern.test(cell)) || {};
        if (total > 0) acc.push({ level: cell, count: total, color: meta.color, icon: meta.icon });
      }
      return acc;
    }, []);

  const byFaculty = facultyTable
    .filter(row => row.length >= 5)
    .map(row => {
      const name = row[0];
      const bachelor = numberFromText(row[row.length - 4]);
      const master = numberFromText(row[row.length - 3]);
      const doctoral = numberFromText(row[row.length - 2]);
      return { name, bachelor, master, doctoral };
    })
    .filter(row => row.name && (row.bachelor + row.master + row.doctoral) > 0);

  const total = byFaculty.reduce((sum, row) => sum + row.bachelor + row.master + row.doctoral, 0)
    || byLevel.reduce((sum, row) => sum + row.count, 0);

  if (!total || byFaculty.length === 0) return null;

  return {
    current: { total, byLevel },
    byFaculty,
    sourceNote: 'Synced from public MJU Dashboard student page',
  };
}

function normalizeHtmlDataset(dataset, html, sourceUrl) {
  const tables = parseHtmlTables(html);
  if (dataset === 'student_stats') {
    const normalized = normalizeStudentStatsFromFusionCharts(html) || normalizeStudentStatsFromTables(tables);
    if (normalized) return normalized;
  }

  return {
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    textSummary: stripTags(html).slice(0, 12000),
    tables,
  };
}

async function fetchSource(dataset, sourceUrl) {
  const headers = { Accept: 'application/json, text/html;q=0.9, */*;q=0.8' };
  const token = process.env.MJU_DASHBOARD_API_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(sourceUrl, { headers });
  const contentType = response.headers.get('content-type') || '';
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`MJU source returned HTTP ${response.status}: ${body.slice(0, 180)}`);
  }

  if (contentType.includes('application/json') || body.trim().startsWith('{') || body.trim().startsWith('[')) {
    const parsed = JSON.parse(body);
    return {
      payload: parsed.payload || parsed.data || parsed,
      adapter: 'json',
      sourceType: 'mju_api',
    };
  }

  return {
    payload: normalizeHtmlDataset(dataset, body, sourceUrl),
    adapter: 'html',
    sourceType: 'mju_public_page',
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const dataset = String(req.query?.dataset || '').trim();
  if (!dataset) {
    sendJson(res, 400, { error: 'Missing dataset parameter' });
    return;
  }

  const sourceUrl = sourceForDataset(dataset);
  if (!sourceUrl) {
    sendJson(res, 400, {
      error: `No source configured for ${dataset}. Set MJU_DASHBOARD_SOURCE_${dataset.toUpperCase()} in Vercel.`,
    });
    return;
  }

  try {
    const result = await fetchSource(dataset, sourceUrl);
    sendJson(res, 200, {
      dataset,
      sourceUrl,
      fetchedAt: new Date().toISOString(),
      ...result,
    });
  } catch (err) {
    sendJson(res, 502, {
      dataset,
      sourceUrl,
      error: err?.message || 'Unable to fetch MJU dashboard source',
    });
  }
}
