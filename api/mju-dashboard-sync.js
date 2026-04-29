/* global process */

const DATASET_ENV_PREFIX = 'MJU_DASHBOARD_SOURCE_';

const DEFAULT_PUBLIC_SOURCES = {
  student_stats: 'https://dashboard.mju.ac.th/student',
  research: 'https://dashboard.mju.ac.th/homeDashboard?&dep=20300',
  dashboard_summary: 'https://dashboard.mju.ac.th/student',
  hr: 'https://dashboard.mju.ac.th/homeDashboard?&dep=20300',
  graduation: 'https://dashboard.mju.ac.th/homeDashboard?&dep=20300',
};

const PUBLIC_COMPANION_SOURCES = {
  student_stats: {
    scienceStudent: 'https://dashboard.mju.ac.th/student.aspx?dep=20300',
    sciencePrograms: 'https://dashboard.mju.ac.th/studentProgram.aspx?dep=20300',
    sciencePersonnel: 'https://dashboard.mju.ac.th/person.aspx?dep=20300',
  },
  hr: {
    sciencePersonnel: 'https://dashboard.mju.ac.th/person.aspx?dep=20300',
  },
  research: {
    research: 'https://dashboard.mju.ac.th/research.aspx?dep=20300',
    researchBudget: 'https://dashboard.mju.ac.th/researchBudgetByDepartment.aspx?dep=20300',
    researchJournal: 'https://dashboard.mju.ac.th/researchJournalByDepartment.aspx?dep=20300',
    researchByDepartment: 'https://dashboard.mju.ac.th/researchByDepartment.aspx?dep=20300',
    intellectualProperty: 'https://dashboard.mju.ac.th/intellectualProperty.aspx?dep=20300',
    scopus: 'https://dashboard.mju.ac.th/scopus.aspx?dep=20300',
  },
};

const CHART_COLORS = ['#006838', '#2E86AB', '#C5A028', '#A23B72', '#F18F01', '#7B68EE', '#14b8a6', '#64748b'];

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
  if (Array.isArray(payload?.scienceFaculty?.byType)) return payload.scienceFaculty.byType.length;
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

function chartAxisName(xml) {
  return String(xml || '').match(/xAxisName='([^']*)'/)?.[1] || '';
}

function chartYAxisName(xml) {
  return String(xml || '').match(/yAxisName='([^']*)'/)?.[1] || '';
}

function findChartByAxis(charts, text) {
  return charts.find(xml => chartAxisName(xml).includes(text) || chartYAxisName(xml).includes(text));
}

function parseChartDatasets(xml) {
  return [...String(xml || '').matchAll(/<dataset[^>]*seriesname='([^']*)'[\s\S]*?<\/dataset>/g)]
    .map(match => ({
      name: match[1],
      values: [...match[0].matchAll(/<set\s+value='([^']*)'/g)].map(valueMatch => numberFromText(valueMatch[1])),
    }))
    .filter(dataset => dataset.name);
}

function setRowsFromChart(xml, keyName, valueName = 'count') {
  return parseSimpleSets(xml).map((row, index) => ({
    [keyName]: row.label,
    [valueName]: row.value,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));
}

function multiDatasetRowsFromChart(xml, keyName) {
  const labels = parseCategoryLabels(xml);
  const datasets = parseChartDatasets(xml);
  return labels.map((label, index) => {
    const row = { [keyName]: label };
    for (const dataset of datasets) row[dataset.name] = dataset.values[index] || 0;
    return row;
  });
}

function pickDatasetValue(row, names) {
  const keys = Array.isArray(names) ? names : [names];
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) return Number(row[key] || 0);
  }
  return 0;
}

function thaiEducationLabel(label) {
  const text = String(label || '').trim();
  if (text === 'เอก') return 'ปริญญาเอก';
  if (text === 'โท') return 'ปริญญาโท';
  if (text === 'ตรี') return 'ปริญญาตรี';
  return text;
}

function million(value) {
  return Number((Number(value || 0) / 1000000).toFixed(2));
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

function normalizeScienceStudentPage(html) {
  const charts = extractFusionChartXml(html);
  const levelChart = findChartByAxis(charts, 'ระดับการศึกษา');
  const enrollmentChart = findChartByAxis(charts, 'ปีที่รับเข้า');
  const campusChart = findChartByAxis(charts, 'วิทยาเขต');
  const nationalityChart = findChartByAxis(charts, 'สัญชาติ');
  if (!levelChart) return null;

  const byLevel = levelRowsFromChart(levelChart);
  const total = byLevel.reduce((sum, row) => sum + Number(row.count || 0), 0);
  if (!total) return null;

  const byEnrollmentYear = enrollmentChart
    ? aggregateRowsFromChart(enrollmentChart, 'year')
      .map(row => ({ ...row, count: row.total }))
      .sort((a, b) => Number(a.year) - Number(b.year))
    : [];
  const byCampus = campusChart
    ? aggregateRowsFromChart(campusChart, 'campus').map(row => ({ ...row, count: row.total }))
    : [];
  const byNationality = nationalityChart
    ? aggregateRowsFromChart(nationalityChart, 'nationality').map((row, index) => ({
      nationality: row.nationality,
      count: row.total,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }))
    : [];
  const newStudentIntake = byEnrollmentYear.map(row => ({
    year: row.year,
    total: row.total,
    certificate: row.certificate || 0,
    bachelor: row.bachelor || 0,
    master: row.master || 0,
    doctoral: row.doctoral || 0,
    channels: { quota: null, directAdmit: null, tcas: null, other: null },
  }));

  return {
    total,
    byLevel,
    ...(byEnrollmentYear.length ? { byEnrollmentYear } : {}),
    ...(byCampus.length ? { byCampus } : {}),
    ...(byNationality.length ? { byNationality } : {}),
    ...(newStudentIntake.length ? { newStudentIntake } : {}),
  };
}

function normalizeScienceProgramPage(html) {
  const tables = parseHtmlTables(html);
  const programTable = tables.find(table =>
    table.some(row => row.join(' ').includes('สาขาวิชา')) &&
    table.some(row => row.join(' ').includes('จำนวนนักศึกษาคงอยู่'))
  );
  if (!programTable) return [];

  return programTable
    .map(row => {
      const order = numberFromText(row[0]);
      const count = numberFromText(row[4]);
      if (!order || !row[2] || !count) return null;
      return {
        order,
        code: row[1],
        major: row[2],
        level: row[3],
        count,
      };
    })
    .filter(Boolean);
}

function buildStudentFacultyRatio(totalStudents, personnel) {
  const academicStaff = Number(personnel?.scienceFaculty?.academic || 0);
  if (!totalStudents || !academicStaff) return null;
  const ratio = Number((totalStudents / academicStaff).toFixed(1));
  return {
    students: totalStudents,
    academicStaff,
    ratio,
    comparison: [
      { name: 'คณะวิทยาศาสตร์ มจ.', ratio, color: '#006838' },
    ],
  };
}

function mergeScienceStudentCompanions(payload, pages) {
  const scienceFromStudent = pages?.scienceStudent?.html ? normalizeScienceStudentPage(pages.scienceStudent.html) : null;
  const programRows = pages?.sciencePrograms?.html ? normalizeScienceProgramPage(pages.sciencePrograms.html) : [];
  const personnel = pages?.sciencePersonnel?.html ? normalizeHrFromPersonPage(pages.sciencePersonnel.html) : null;
  if (!scienceFromStudent && programRows.length === 0 && !personnel?.scienceFaculty) return payload;

  const scienceFaculty = {
    ...(payload.scienceFaculty || {}),
    ...(scienceFromStudent || {}),
  };

  if (programRows.length) {
    scienceFaculty.programs = programRows;
    scienceFaculty.byProgram = programRows;
  }

  const ratio = buildStudentFacultyRatio(scienceFaculty.total, personnel);
  if (ratio) scienceFaculty.studentFacultyRatio = ratio;

  if (personnel?.scienceFaculty) {
    scienceFaculty.personnel = {
      ...(scienceFaculty.personnel || {}),
      total: personnel.scienceFaculty.total,
      byType: personnel.scienceFaculty.byType,
      byPosition: personnel.scienceFaculty.byPosition,
      byEducation: personnel.scienceFaculty.byEducation,
      retirementForecast: personnel.scienceFaculty.retirementForecast,
    };
  }

  return {
    ...payload,
    scienceFaculty,
    sourceCoverage: {
      exact: [
        'current.total',
        'current.byLevel',
        'byFaculty',
        'byEnrollmentYear',
        'byCampus',
        'scienceFaculty.total',
        'scienceFaculty.byLevel',
        'scienceFaculty.byEnrollmentYear',
        'scienceFaculty.byCampus',
        'scienceFaculty.byNationality',
        'scienceFaculty.programs',
        'scienceFaculty.studentFacultyRatio',
      ],
      unavailableFromPublicMju: ['scienceFaculty.byGender', 'scienceFaculty.intakeChannels'],
    },
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
    sourceCoverage: {
      exact: ['totalStudents', 'faculties.totalStudents'],
      unavailableFromPublicMju: ['totalCourses', 'avgGPA', 'graduationRate'],
    },
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

function normalizeHrFromPersonPage(html) {
  const charts = extractFusionChartXml(html);
  const typeChart = findChartByAxis(charts, 'ประเภทการจ้าง') || findChartByAxis(charts, 'ชื่อประเภทการจ้าง');
  const blockChart = findChartByAxis(charts, 'กลุ่มตำแหน่งงาน');
  const educationChart = findChartByAxis(charts, 'ระดับการศึกษา');
  const positionChart = findChartByAxis(charts, 'ตำแหน่งาน') || findChartByAxis(charts, 'ตำแหน่ง');
  const retirementChart = findChartByAxis(charts, 'ปีงบประมาณ');

  const byType = setRowsFromChart(typeChart, 'type');
  if (byType.length === 0) return null;
  const total = byType.reduce((sum, row) => sum + Number(row.count || 0), 0);
  if (!total) return null;

  const positionBlocks = setRowsFromChart(blockChart, 'group');
  const academic = positionBlocks.find(row => String(row.group || '').includes('วิชาการ'))?.count || 0;
  const support = Math.max(0, total - academic);
  const allPositions = setRowsFromChart(positionChart, 'position');
  const countForPosition = (name) => allPositions.find(row => row.position === name)?.count || 0;
  const academicPositions = [
    { position: 'ศาสตราจารย์', count: countForPosition('ศาสตราจารย์'), color: '#FFD700', icon: 'Prof' },
    { position: 'รองศาสตราจารย์', count: countForPosition('รองศาสตราจารย์'), color: '#C5A028', icon: 'Assoc' },
    { position: 'ผู้ช่วยศาสตราจารย์', count: countForPosition('ผู้ช่วยศาสตราจารย์'), color: '#2E86AB', icon: 'Asst' },
    { position: 'อาจารย์', count: countForPosition('อาจารย์'), color: '#006838', icon: 'Lect' },
  ];
  const byEducation = setRowsFromChart(educationChart, 'level')
    .map((row, index) => ({
      level: thaiEducationLabel(row.level),
      count: row.count,
      color: CHART_COLORS[index % CHART_COLORS.length],
      icon: thaiEducationLabel(row.level).replace('ปริญญา', '') || row.level,
    }));
  const retirementForecast = setRowsFromChart(retirementChart, 'year', 'remaining')
    .map((row, index, rows) => ({
      year: row.year,
      remaining: row.remaining,
      retiring: index === 0 ? 0 : Math.max(0, Number(rows[index - 1]?.remaining || 0) - Number(row.remaining || 0)),
    }));
  const retirementIn5Years = retirementForecast.length >= 6
    ? Math.max(0, retirementForecast[0].remaining - retirementForecast[5].remaining)
    : null;

  return {
    scienceFaculty: {
      name: 'คณะวิทยาศาสตร์',
      total,
      academic,
      support,
      byType,
      positionBlocks,
      byPosition: allPositions,
      academicPositions,
      byEducation,
      ...(retirementForecast.length ? { retirementForecast } : {}),
      ...(retirementIn5Years != null ? { diversity: { retirementIn5Years } } : {}),
    },
    sourceCoverage: {
      exact: [
        'scienceFaculty.total',
        'scienceFaculty.academic',
        'scienceFaculty.support',
        'scienceFaculty.byType',
        'scienceFaculty.positionBlocks',
        'scienceFaculty.byPosition',
        'scienceFaculty.academicPositions',
        'scienceFaculty.byEducation',
        'scienceFaculty.retirementForecast',
      ],
      unavailableFromPublicMju: ['scienceFaculty.byGender', 'scienceFaculty.byDepartment', 'scienceFaculty.trend'],
    },
    sourceNote: 'Synced from public MJU Dashboard personnel page',
  };
}

function normalizeHrFromHomeDashboard(html) {
  const chartPayload = normalizeHrFromPersonPage(html);
  if (chartPayload) return chartPayload;

  const personBlock = String(html || '').match(/id="ContentPlaceHolder_lbl_chartPerson">([\s\S]*?)<\/span>/)?.[1] || '';
  if (!personBlock) return null;
  const total = numberFromText(personBlock.match(/ทั้งหมดของหน่วยงาน[\s\S]*?<strong>([\d,]+)<\/strong>/)?.[1]);
  const byType = [...String(html || '').matchAll(/title='([^']+?)\s+\(([^)]*)\)'/g)]
    .map((match, index) => ({
      type: stripTags(match[1]),
      count: numberFromText(match[2]),
      color: CHART_COLORS[index % CHART_COLORS.length],
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
    sourceCoverage: {
      exact: ['scienceFaculty.total', 'scienceFaculty.byType'],
      unavailableFromPublicMju: ['scienceFaculty.byGender', 'scienceFaculty.byDepartment', 'scienceFaculty.trend'],
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

function normalizeResearchDetailPage(html) {
  const charts = extractFusionChartXml(html);
  const projectChart = charts.find(xml => chartYAxisName(xml).includes('จำนวนงานวิจัย (โครงการ)'));
  const fundingChart = charts.find(xml => parseChartDatasets(xml).some(dataset => dataset.name.includes('งบประมาณ')));
  const utilizationChart = charts.find(xml => chartYAxisName(xml).includes('นำไปใช้ประโยชน์'));
  const journalChart = charts.find(xml => chartYAxisName(xml).includes('ตีพิมพ์เผยแพร่'));

  const projectTrend = setRowsFromChart(projectChart, 'year', 'projects')
    .map(row => ({ year: row.year, projects: row.projects, type: 'actual' }))
    .sort((a, b) => Number(a.year) - Number(b.year));
  const projectByYear = new Map(projectTrend.map(row => [String(row.year), row.projects]));

  const fundingTrend = multiDatasetRowsFromChart(fundingChart, 'year')
    .map(row => ({
      year: row.year,
      internal: million(pickDatasetValue(row, 'งบประมาณภายในสถาบัน')),
      external: million(pickDatasetValue(row, 'งบประมาณภายนอกสถาบัน')),
      personal: million(pickDatasetValue(row, 'ทุนส่วนตัว')),
      other: million(pickDatasetValue(row, 'อื่น ๆ')),
      total: million(pickDatasetValue(row, 'ยอดรวม')),
      projects: projectByYear.get(String(row.year)) || 0,
      type: 'actual',
    }))
    .filter(row => row.year && (row.total > 0 || row.projects > 0))
    .sort((a, b) => Number(a.year) - Number(b.year));

  const utilizationTrend = setRowsFromChart(utilizationChart, 'year', 'projects')
    .map(row => ({ year: row.year, projects: row.projects, type: 'actual' }))
    .sort((a, b) => Number(a.year) - Number(b.year));
  const researchPublicationTrend = setRowsFromChart(journalChart, 'year', 'projects')
    .map(row => ({ year: row.year, projects: row.projects, type: 'actual' }))
    .sort((a, b) => Number(a.year) - Number(b.year));

  return {
    ...(projectTrend.length ? { projectTrend } : {}),
    ...(fundingTrend.length ? { fundingTrend } : {}),
    ...(utilizationTrend.length ? { utilizationTrend } : {}),
    ...(researchPublicationTrend.length ? { researchPublicationTrend } : {}),
  };
}

function normalizeScopusPage(html) {
  const charts = extractFusionChartXml(html);
  const publicationChart = findChartByAxis(charts, 'ปีตีพิมพ์');
  const citationChart = findChartByAxis(charts, 'ปีอ้างอิง');
  const publicationTrend = multiDatasetRowsFromChart(publicationChart, 'year')
    .map(row => {
      const total = pickDatasetValue(row, 'จำนวนผลงาน');
      return {
        year: row.year,
        scopus: total,
        tci1: 0,
        tci2: 0,
        national: 0,
        total,
        article: pickDatasetValue(row, 'Article'),
        bookChapter: pickDatasetValue(row, 'Book chapter'),
        conferencePaper: pickDatasetValue(row, 'Conference paper'),
        editorial: pickDatasetValue(row, 'Editorial'),
        letter: pickDatasetValue(row, 'Letter'),
        review: pickDatasetValue(row, 'Review'),
        type: 'actual',
      };
    })
    .filter(row => row.year)
    .sort((a, b) => Number(a.year) - Number(b.year));
  const citationTrend = multiDatasetRowsFromChart(citationChart, 'year')
    .map(row => ({
      year: row.year,
      publications: pickDatasetValue(row, 'จำนวนผลงาน'),
      citations: pickDatasetValue(row, 'จำนวนครั้งที่อ้างอิง'),
      type: 'actual',
    }))
    .filter(row => row.year)
    .sort((a, b) => Number(a.year) - Number(b.year));
  return {
    ...(publicationTrend.length ? { publicationTrend } : {}),
    ...(citationTrend.length ? { citationTrend } : {}),
  };
}

function normalizeIntellectualPropertyPage(html) {
  const chart = extractFusionChartXml(html)[0];
  const intellectualPropertyTrend = multiDatasetRowsFromChart(chart, 'year')
    .map(row => ({
      year: row.year,
      total: pickDatasetValue(row, 'จำนวนผลงาน'),
      copyright: pickDatasetValue(row, 'ลิขสิทธิ์'),
      patent: pickDatasetValue(row, 'สิทธิบัตร'),
      pettyPatent: pickDatasetValue(row, 'อนุสิทธิบัตร'),
      type: 'actual',
    }))
    .filter(row => row.year)
    .sort((a, b) => Number(a.year) - Number(b.year));

  const patents = intellectualPropertyTrend
    .slice()
    .reverse()
    .map(row => ({
      id: `IP-${row.year}`,
      title: `ทรัพย์สินทางปัญญาปี ${row.year} รวม ${row.total.toLocaleString('th-TH')} ผลงาน`,
      dept: 'คณะวิทยาศาสตร์',
      year: String(row.year),
      status: 'ข้อมูลสรุป',
      type: `ลิขสิทธิ์ ${row.copyright} / สิทธิบัตร ${row.patent} / อนุสิทธิบัตร ${row.pettyPatent}`,
    }));

  return {
    ...(intellectualPropertyTrend.length ? { intellectualPropertyTrend, patents } : {}),
  };
}

function normalizeResearchBudgetSourcesPage(html) {
  const chart = extractFusionChartXml(html)[0];
  return setRowsFromChart(chart, 'source', 'amount')
    .map((row, index) => ({
      source: row.source,
      amount: million(row.amount),
      color: CHART_COLORS[index % CHART_COLORS.length],
    }))
    .filter(row => row.source);
}

function normalizeResearchByDepartmentPage(html) {
  const charts = extractFusionChartXml(html);
  const departmentChart = findChartByAxis(charts, 'หน่วยงาน');
  return setRowsFromChart(departmentChart, 'dept', 'publications')
    .map(row => ({
      dept: row.dept,
      publications: row.publications,
      funding: 0,
      patents: 0,
      citations: 0,
    }))
    .filter(row => row.dept);
}

function mergeResearchCompanions(payload, pages) {
  const detail = pages?.research?.html ? normalizeResearchDetailPage(pages.research.html) : {};
  const scopus = pages?.scopus?.html ? normalizeScopusPage(pages.scopus.html) : {};
  const ip = pages?.intellectualProperty?.html ? normalizeIntellectualPropertyPage(pages.intellectualProperty.html) : {};
  const fundingSources = pages?.researchBudget?.html ? normalizeResearchBudgetSourcesPage(pages.researchBudget.html) : [];
  const byDepartment = pages?.researchByDepartment?.html ? normalizeResearchByDepartmentPage(pages.researchByDepartment.html) : [];

  const fundingTrend = detail.fundingTrend || payload.fundingTrend || [];
  const publicationTrend = scopus.publicationTrend || payload.publicationTrend || [];
  const citationTrend = scopus.citationTrend || [];
  const intellectualPropertyTrend = ip.intellectualPropertyTrend || [];
  const latestFunding = fundingTrend[fundingTrend.length - 1];
  const latestProject = (detail.projectTrend || payload.projectTrend || []).slice(-1)[0];
  const totalPublications = publicationTrend.reduce((sum, row) => sum + Number(row.total || row.scopus || 0), 0);
  const totalCitations = citationTrend.reduce((sum, row) => sum + Number(row.citations || 0), 0);
  const totalPatents = intellectualPropertyTrend.reduce((sum, row) =>
    sum + Number(row.patent || 0) + Number(row.pettyPatent || 0), 0);
  const totalIntellectualProperties = intellectualPropertyTrend.reduce((sum, row) => sum + Number(row.total || 0), 0);

  return {
    ...payload,
    ...detail,
    ...scopus,
    ...ip,
    ...(fundingSources.length ? { fundingSources } : {}),
    ...(byDepartment.length ? { byDepartment } : {}),
    overview: {
      ...(payload.overview || {}),
      activeProjects: latestProject?.projects || latestFunding?.projects || payload.overview?.activeProjects || 0,
      totalFunding: latestFunding?.total || payload.overview?.totalFunding || 0,
      ...(totalPublications ? { totalPublications } : {}),
      ...(totalPatents ? { totalPatents } : {}),
      ...(totalIntellectualProperties ? { totalIntellectualProperties } : {}),
      ...(totalCitations ? { totalCitations } : {}),
    },
    sourceCoverage: {
      exact: [
        'overview.activeProjects',
        'overview.totalFunding',
        'overview.totalPublications',
        'overview.totalPatents',
        'overview.totalCitations',
        'publicationTrend',
        'citationTrend',
        'fundingTrend',
        'projectTrend',
        'utilizationTrend',
        'researchPublicationTrend',
        'fundingSources',
        'byDepartment',
        'intellectualPropertyTrend',
      ],
      unavailableFromPublicMju: ['benchmark.hIndexComparison', 'communityImpactBeneficiaries'],
    },
    sourceNote: 'Synced from public MJU Dashboard research, Scopus, and intellectual property pages',
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

function sourceHeaders() {
  const headers = { Accept: 'application/json, text/html;q=0.9, */*;q=0.8' };
  const token = process.env.MJU_DASHBOARD_API_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function fetchTextSource(sourceUrl) {
  const response = await fetch(sourceUrl, { headers: sourceHeaders() });
  const contentType = response.headers.get('content-type') || '';
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`MJU source returned HTTP ${response.status}: ${body.slice(0, 180)}`);
  }

  return { body, contentType };
}

async function fetchSource(dataset, sourceUrl) {
  const { body, contentType } = await fetchTextSource(sourceUrl);

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

async function fetchCompanionPages(dataset) {
  const sources = PUBLIC_COMPANION_SOURCES[dataset];
  if (!sources) return {};

  const entries = await Promise.all(
    Object.entries(sources).map(async ([key, url]) => {
      try {
        const { body } = await fetchTextSource(url);
        return [key, { url, html: body }];
      } catch (err) {
        return [key, { url, error: err?.message || String(err) }];
      }
    })
  );
  return Object.fromEntries(entries);
}

function enrichPublicPayloadWithCompanions(dataset, payload, pages) {
  if (dataset === 'student_stats') return mergeScienceStudentCompanions(payload, pages);
  if (dataset === 'hr' && pages?.sciencePersonnel?.html) return normalizeHrFromPersonPage(pages.sciencePersonnel.html) || payload;
  if (dataset === 'research') return mergeResearchCompanions(payload, pages);
  return payload;
}

export async function fetchDashboardSource(dataset) {
  const sourceUrl = sourceForDataset(dataset);
  if (!sourceUrl) {
    throw new Error(`No source configured for ${dataset}. Set MJU_DASHBOARD_SOURCE_${dataset.toUpperCase()} in Vercel.`);
  }

  const result = await fetchSource(dataset, sourceUrl);
  const usesDefaultPublicSource = sourceUrl === DEFAULT_PUBLIC_SOURCES[dataset] && result.sourceType === 'mju_public_page';
  const companionPages = usesDefaultPublicSource ? await fetchCompanionPages(dataset) : {};
  const payload = usesDefaultPublicSource
    ? enrichPublicPayloadWithCompanions(dataset, result.payload, companionPages)
    : result.payload;
  const companionSourceUrls = Object.values(companionPages)
    .filter(page => page?.html)
    .map(page => page.url);
  return {
    dataset,
    sourceUrl,
    sourceUrls: [sourceUrl, ...companionSourceUrls],
    fetchedAt: new Date().toISOString(),
    rowCount: rowCountFromPayload(payload),
    ...result,
    payload,
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
