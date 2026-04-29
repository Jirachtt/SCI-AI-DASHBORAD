/* global process */

const DATASET_ENV_PREFIX = 'MJU_DASHBOARD_SOURCE_';

const DEFAULT_PUBLIC_SOURCES = {
  student_stats: 'https://dashboard.mju.ac.th/student',
  research: 'https://dashboard.mju.ac.th/homeDashboard?&dep=20300',
  dashboard_summary: 'https://dashboard.mju.ac.th/student',
  hr: 'https://dashboard.mju.ac.th/homeDashboard?&dep=20300',
  graduation: 'https://dashboard.mju.ac.th/homeDashboard?&dep=20300',
};

export const DASHBOARD_SYNC_DATASETS = [
  'dashboard_summary',
  'student_stats',
  'university_budget',
  'science_budget',
  'financial',
  'tuition',
  'student_life',
  'graduation',
  'hr',
  'research',
  'strategic',
];

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function sourceForDataset(dataset) {
  const envKey = `${DATASET_ENV_PREFIX}${String(dataset || '').toUpperCase()}`;
  return process.env[envKey] || DEFAULT_PUBLIC_SOURCES[dataset] || '';
}

export function rowCountFromPayload(payload) {
  if (Array.isArray(payload)) return payload.length;
  if (Array.isArray(payload?.rows)) return payload.rows.length;
  if (Array.isArray(payload?.faculties)) return payload.faculties.length;
  if (Array.isArray(payload?.byFaculty)) return payload.byFaculty.length;
  if (Array.isArray(payload?.yearly)) return payload.yearly.length;
  if (Array.isArray(payload?.history)) return payload.history.length;
  if (Array.isArray(payload?.graduationHistory)) return payload.graduationHistory.length;
  if (Array.isArray(payload?.publicationTrend)) return payload.publicationTrend.length;
  return null;
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

function parseSimpleSets(xml) {
  return [...String(xml || '').matchAll(/<set\s+label='([^']*)'[^>]*value='([^']*)'[^>]*\/>/g)]
    .map(match => ({ label: match[1], value: numberFromText(match[2]) }))
    .filter(row => row.label);
}

function rowTotal(row) {
  return Number(row?.certificate || 0) + Number(row?.bachelor || 0) + Number(row?.master || 0) + Number(row?.doctoral || 0);
}

function normalizeFacultyName(name) {
  const text = String(name || '').trim();
  const facultyPrefixes = [
    'บริหารธุรกิจ',
    'ผลิตกรรมการเกษตร',
    'วิทยาศาสตร์',
    'สารสนเทศและการสื่อสาร',
    'ศิลปศาสตร์',
    'เศรษฐศาสตร์',
    'พัฒนาการท่องเที่ยว',
    'สัตวศาสตร์และเทคโนโลยี',
    'วิศวกรรมและอุตสาหกรรมเกษตร',
    'สถาปัตยกรรมศาสตร์และการออกแบบสิ่งแวดล้อม',
    'เทคโนโลยีการประมงและทรัพยากรทางน้ำ',
    'พยาบาลศาสตร์',
    'สัตวแพทยศาสตร์',
  ];
  if (facultyPrefixes.includes(text)) return `คณะ${text}`;
  return text;
}

function levelRowsFromChart(chartXml) {
  const levelMeta = [
    { pattern: /ปริญญาตรี/, color: '#2563eb', icon: 'BSc' },
    { pattern: /ปริญญาโท/, color: '#7c3aed', icon: 'MSc' },
    { pattern: /ปริญญาเอก/, color: '#ea580c', icon: 'PhD' },
    { pattern: /ประกาศนียบัตร/, color: '#059669', icon: 'Cert' },
  ];
  const labels = parseCategoryLabels(chartXml);
  const totals = parseDatasetValues(chartXml, 'ยอดรวม');
  return labels.map((level, index) => {
    const meta = levelMeta.find(item => item.pattern.test(level)) || {};
    return { level, count: totals[index] || 0, color: meta.color, icon: meta.icon };
  }).filter(row => row.count > 0);
}

function aggregateRowsFromChart(chartXml, labelKey = 'label') {
  const labels = parseCategoryLabels(chartXml);
  const cert = parseDatasetValues(chartXml, 'ประกาศนียบัตร');
  const bachelor = parseDatasetValues(chartXml, 'ปริญญาตรี');
  const master = parseDatasetValues(chartXml, 'ปริญญาโท');
  const doctoral = parseDatasetValues(chartXml, 'ปริญญาเอก');
  return labels.map((label, index) => {
    const row = {
      [labelKey]: label,
      certificate: cert[index] || 0,
      bachelor: bachelor[index] || 0,
      master: master[index] || 0,
      doctoral: doctoral[index] || 0,
    };
    row.total = rowTotal(row);
    return row;
  }).filter(row => row[labelKey] && row.total > 0);
}

function simpleForecastFromActualRows(rows) {
  const actual = [...rows].sort((a, b) => Number(a.year) - Number(b.year));
  if (actual.length < 2) return actual.map(row => ({ ...row, type: 'actual' }));

  const last = actual[actual.length - 1];
  const previous = actual[actual.length - 2];
  const project = (key) => Math.max(0, Math.round(Number(last[key] || 0) + (Number(last[key] || 0) - Number(previous[key] || 0))));
  return [
    ...actual.map(row => ({ ...row, type: 'actual' })),
    {
      year: String(Number(last.year) + 1),
      certificate: project('certificate'),
      bachelor: project('bachelor'),
      master: project('master'),
      doctoral: project('doctoral'),
      total: project('total'),
      type: 'forecast',
    },
  ];
}

function buildScienceFaculty(byFaculty, fallback = {}) {
  const row = byFaculty.find(item => String(item.name || '').includes('วิทยาศาสตร์'));
  if (!row) return null;
  const byLevel = [
    { level: 'ปริญญาตรี', count: row.bachelor || 0, color: '#2563eb', icon: 'BSc' },
    { level: 'ปริญญาโท', count: row.master || 0, color: '#7c3aed', icon: 'MSc' },
    { level: 'ปริญญาเอก', count: row.doctoral || 0, color: '#ea580c', icon: 'PhD' },
    { level: 'ประกาศนียบัตร', count: row.certificate || 0, color: '#059669', icon: 'Cert' },
  ];
  return {
    ...fallback,
    name: 'คณะวิทยาศาสตร์',
    total: row.total || rowTotal(row),
    byLevel,
  };
}

function normalizeStudentStatsFromFusionCharts(html) {
  const charts = extractFusionChartXml(html);
  const levelChart = charts.find(xml => xml.includes("xAxisName='ระดับการศึกษา'"));
  const facultyChart = charts.find(xml => xml.includes("xAxisName='หน่วยงาน'"));
  const enrollmentChart = charts.find(xml => xml.includes("xAxisName='ปีที่รับเข้า'"));
  const campusChart = charts.find(xml => xml.includes("xAxisName='วิทยาเขต'"));
  if (!levelChart || !facultyChart) return null;

  const byLevel = levelRowsFromChart(levelChart);
  const byFaculty = aggregateRowsFromChart(facultyChart, 'name')
    .map(row => ({ ...row, name: normalizeFacultyName(row.name) }));
  const byEnrollmentYear = enrollmentChart
    ? aggregateRowsFromChart(enrollmentChart, 'year').sort((a, b) => Number(b.year) - Number(a.year))
    : [];
  const byCampus = campusChart
    ? aggregateRowsFromChart(campusChart, 'campus').map(row => ({ ...row, count: row.total }))
    : [];
  const trend = simpleForecastFromActualRows(byEnrollmentYear);
  const scienceFaculty = buildScienceFaculty(byFaculty);

  const total = byLevel.reduce((sum, row) => sum + row.count, 0)
    || byFaculty.reduce((sum, row) => sum + row.total, 0);

  if (!total || byFaculty.length === 0) return null;

  return {
    current: { total, byLevel },
    byFaculty,
    byEnrollmentYear,
    byCampus,
    trend,
    ...(scienceFaculty ? { scienceFaculty } : {}),
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
    byFaculty: byFaculty.map(row => ({ ...row, name: normalizeFacultyName(row.name), total: rowTotal(row) })),
    sourceNote: 'Synced from public MJU Dashboard student page',
  };
}

function normalizeDashboardSummaryFromStudentPage(html) {
  const studentStats = normalizeStudentStatsFromFusionCharts(html) || normalizeStudentStatsFromTables(parseHtmlTables(html));
  if (!studentStats?.byFaculty?.length) return null;
  return {
    totalStudents: studentStats.current.total,
    faculties: studentStats.byFaculty.map(row => ({
      name: row.name,
      totalStudents: row.total || rowTotal(row),
    })),
    sourceNote: 'Synced from public MJU Dashboard student page',
  };
}

function normalizeResearchFromHomeDashboard(html, tables) {
  const charts = extractFusionChartXml(html);
  const scopusChart = charts.find(xml => xml.includes("xAxisName='ปีตีพิมพ์'"));
  const researchSets = charts
    .filter(xml => !xml.includes("xAxisName='ปีตีพิมพ์'"))
    .map(xml => parseSimpleSets(xml))
    .find(rows => rows.length >= 5 && rows.some(row => row.value > 50)) || [];
  const projectTrend = researchSets
    .map(row => ({ year: row.label, projects: row.value, type: 'actual' }))
    .sort((a, b) => Number(a.year) - Number(b.year));
  const publicationTrend = parseSimpleSets(scopusChart)
    .map(row => ({
      year: row.label,
      scopus: row.value,
      tci1: 0,
      tci2: 0,
      national: 0,
      total: row.value,
      type: 'actual',
    }))
    .sort((a, b) => Number(a.year) - Number(b.year));

  const fundingTable = tables.find(table =>
    table.some(row => row.join(' ').includes('ปีงบประมาณ')) &&
    table.some(row => row.join(' ').includes('งบประมาณ'))
  );
  const fundingTrend = (fundingTable || [])
    .map(row => {
      const yearIndex = row.findIndex(cell => /^\d{4}$/.test(String(cell || '').trim()));
      if (yearIndex < 0) return null;
      const total = numberFromText(row[yearIndex + 2]) / 1000000;
      return {
        year: row[yearIndex],
        internal: Number((total * 0.2).toFixed(2)),
        external: Number((total * 0.65).toFixed(2)),
        industry: Number((total * 0.15).toFixed(2)),
        total: Number(total.toFixed(2)),
        projects: numberFromText(row[yearIndex + 1]),
        type: 'actual',
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.year) - Number(b.year));

  const latestFunding = fundingTrend[fundingTrend.length - 1];
  const latestPublication = publicationTrend[publicationTrend.length - 1];
  const activeProjects = latestFunding?.projects || projectTrend[projectTrend.length - 1]?.projects || 0;
  const payload = {
    overview: {
      activeProjects,
      totalFunding: latestFunding?.total || 0,
      totalPublications: publicationTrend.reduce((sum, row) => sum + Number(row.scopus || 0), 0),
    },
    ...(publicationTrend.length ? { publicationTrend } : {}),
    ...(fundingTrend.length ? { fundingTrend } : {}),
    ...(projectTrend.length ? { projectTrend } : {}),
    sourceNote: 'Synced from public MJU Dashboard faculty home page',
  };
  if (!latestPublication && !latestFunding && !projectTrend.length) return null;
  return payload;
}

function normalizeHrFromHomeDashboard(html) {
  const personBlock = String(html || '').match(/id="ContentPlaceHolder_lbl_chartPerson">([\s\S]*?)<\/span>/)?.[1] || '';
  if (!personBlock) return null;
  const total = numberFromText(personBlock.match(/ทั้งหมดของหน่วยงาน[\s\S]*?<strong>([\d,]+)<\/strong>/)?.[1]);
  const byType = [...String(html || '').matchAll(/title='([^']+?)\s+\(([^)]*)\)'/g)]
    .map((match, index) => ({
      type: stripTags(match[1]),
      count: numberFromText(match[2]),
      color: ['#006838', '#2E86AB', '#C5A028', '#A23B72'][index % 4],
    }))
    .filter(row => row.type && !row.type.includes('ร้อยละ') && row.count > 0)
    .slice(0, 8);
  if (!total || byType.length === 0) return null;
  return {
    scienceFaculty: {
      name: 'คณะวิทยาศาสตร์',
      total,
      byType,
    },
    sourceNote: 'Synced from public MJU Dashboard faculty home page',
  };
}

function normalizeGraduationFromHomeDashboard(tables) {
  const surveyTable = tables.find(table =>
    table.some(row => row.join(' ').includes('ปีสำเร็จ')) &&
    table.some(row => row.join(' ').includes('สำเร็จ')) &&
    table.some(row => row.join(' ').includes('ร้อยละ'))
  );
  if (!surveyTable) return null;

  const history = surveyTable
    .map(row => {
      const yearIndex = row.findIndex(cell => /^\d{4}$/.test(String(cell || '').trim()));
      if (yearIndex < 0) return null;
      const graduated = numberFromText(row[yearIndex + 1]);
      const responded = numberFromText(row[yearIndex + 2]);
      const responseRate = numberFromText(row[yearIndex + 3]);
      return {
        year: Number(row[yearIndex]),
        candidates: graduated,
        graduated,
        responded,
        rate: responseRate,
        type: 'actual',
      };
    })
    .filter(row => row && row.year && (row.graduated > 0 || row.responded > 0))
    .sort((a, b) => Number(a.year) - Number(b.year));

  if (history.length === 0) return null;
  const latest = history[history.length - 1];
  return {
    history,
    graduationHistory: history,
    current: {
      academicYear: latest.year,
      totalCandidates: latest.candidates,
      expectedGraduates: latest.graduated,
      pending: Math.max(0, latest.candidates - latest.graduated),
      notPassed: 0,
      responseRate: latest.rate,
      responded: latest.responded,
    },
    sourceNote: 'Synced from public MJU Dashboard graduate employment survey on faculty home page',
  };
}

function normalizeHtmlDataset(dataset, html, sourceUrl) {
  const tables = parseHtmlTables(html);
  if (dataset === 'student_stats') {
    const normalized = normalizeStudentStatsFromFusionCharts(html) || normalizeStudentStatsFromTables(tables);
    if (normalized) return normalized;
  }
  if (dataset === 'dashboard_summary') {
    const normalized = normalizeDashboardSummaryFromStudentPage(html);
    if (normalized) return normalized;
  }
  if (dataset === 'research') {
    const normalized = normalizeResearchFromHomeDashboard(html, tables);
    if (normalized) return normalized;
  }
  if (dataset === 'hr') {
    const normalized = normalizeHrFromHomeDashboard(html);
    if (normalized) return normalized;
  }
  if (dataset === 'graduation') {
    const normalized = normalizeGraduationFromHomeDashboard(tables);
    if (normalized) return normalized;
  }

  const tableCount = tables.length;
  const textLength = stripTags(html).length;
  throw new Error(
    `No structured HTML adapter for ${dataset}. ` +
    `Fetched ${textLength} text chars and ${tableCount} tables from ${sourceUrl}, ` +
    'but this dataset needs a JSON/API source or a dedicated parser before it can be written to Firestore.'
  );
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

export async function fetchDashboardSource(dataset) {
  const sourceUrl = sourceForDataset(dataset);
  if (!sourceUrl) {
    throw new Error(`No source configured for ${dataset}. Set MJU_DASHBOARD_SOURCE_${dataset.toUpperCase()} in Vercel.`);
  }

  const result = await fetchSource(dataset, sourceUrl);
  return {
    dataset,
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    rowCount: rowCountFromPayload(result.payload),
    ...result,
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

  try {
    sendJson(res, 200, await fetchDashboardSource(dataset));
  } catch (err) {
    sendJson(res, 502, {
      dataset,
      sourceUrl: sourceForDataset(dataset),
      error: err?.message || 'Unable to fetch MJU dashboard source',
    });
  }
}
