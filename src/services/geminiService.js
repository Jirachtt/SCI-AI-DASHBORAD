// Gemini API Service for MJU AI Dashboard Chatbot
import {
    studentStatsData, universityBudgetData, scienceFacultyBudgetData,
    tuitionData, financialData, studentLifeData, dashboardSummary
} from '../data/mockData';
import { SCIENCE_MAJORS } from '../data/studentListData';
import { getStudentListSync } from './studentDataService';
import { graduationHistory, currentGraduationStats, graduationByMajor, honorsData, gpaDistribution } from '../data/graduationData';
import { researchData } from '../data/researchData';
import { hrData } from '../data/hrData';
import { strategicData } from '../data/strategicData';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
if (!API_KEY) {
    console.warn('[Gemini] ⚠️ VITE_GEMINI_API_KEY is not set.');
}

// Models ordered by free-tier quota: highest RPM / lite first to preserve heavier models
const MODELS = [
    'gemini-2.0-flash-lite',    // 30 RPM free — no google_search support
    'gemini-2.5-flash-lite',    // fallback lite — independent quota pool
    'gemini-flash-lite-latest', // alias to latest lite — extra headroom
    'gemini-2.0-flash',         // 15 RPM free — supports google_search
    'gemini-2.5-flash',         // 10 RPM free — supports google_search
    'gemini-flash-latest',      // alias fallback — supports google_search
];

// Models that support Google Search grounding for real-time web data
const SEARCH_CAPABLE_MODELS = new Set([
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-flash-latest',
]);

// Detect if query should use Google Search for real Maejo website data
function shouldUseWebSearch(msg) {
    const q = msg.toLowerCase();
    // Skip search for chart/data/forecast/student/research/strategic queries (use dashboard data instead)
    const skipKeywords = ['กราฟ', 'chart', 'json_chart', 'พยากรณ์', 'forecast', 'คาดการณ์',
        'รายชื่อ', 'ค้นหานักศึกษา', 'หานักศึกษา', 'รหัส 6', 'เกรดสูง', 'เกรดต่ำ',
        'รอพินิจ', 'เกียรตินิยม', 'combo', 'เปรียบเทียบนิสิต', 'แผนภูมิ', 'แผนภาพ',
        'งานวิจัย', 'ตีพิมพ์', 'scopus', 'สิทธิบัตร', 'ทุนวิจัย', 'h-index', 'citation',
        'ยุทธศาสตร์', 'okr', 'kpi', 'ประสิทธิภาพ', 'เป้าหมาย',
        'บุคลากร', 'อาจารย์คณะวิทย', 'ตำแหน่งวิชาการ', 'เกษียณ', 'ภาควิชา',
        'งบประมาณ', 'รายรับ', 'รายจ่าย', 'budget',
        'สำเร็จการศึกษา', 'จำนวนนิสิต', 'จำนวนนักศึกษา', 'gpa'];
    if (skipKeywords.some(k => q.includes(k))) return false;
    // Enable search for general Maejo knowledge queries
    const searchTriggers = ['ประวัติ', 'คณะ', 'สาขา', 'หลักสูตร', 'รับสมัคร', 'tcas',
        'ที่ตั้ง', 'ที่อยู่', 'อยู่ที่ไหน', 'เดินทาง', 'สถานที่', 'กิจกรรม', 'หอพัก',
        'ค่าเทอม', 'ข้อมูลทั่วไป', 'ผู้บริหาร', 'อธิการบดี', 'ทุนการศึกษา', 'ทุน',
        'วิจัย', 'ผลงาน', 'ติดต่อ', 'เปิดรับ', 'ปฏิทิน', 'เว็บไซต์', 'โทรศัพท์',
        'แม่โจ้คือ', 'แม่โจ้มี', 'แม่โจ้เป็น', 'เกี่ยวกับแม่โจ้', 'mju', 'maejo',
        'อาจารย์', 'บุคลากร', 'เรียนอะไร', 'เรียนที่ไหน', 'คะแนน', 'เกณฑ์',
        'ข่าว', 'ประกาศ', 'สมัคร', 'ลงทะเบียน', 'ปริญญา', 'บัณฑิต',
        'ห้องสมุด', 'สนามกีฬา', 'โรงอาหาร', 'หน่วยงาน', 'สำนัก', 'สถาบัน'];
    return searchTriggers.some(k => q.includes(k));
}

function getApiUrl(modelId) {
    return `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${API_KEY}`;
}

// Request timeout (30 seconds)
const REQUEST_TIMEOUT_MS = 30000;

// Per-model cooldown tracking — fixed 60s window matches Gemini free-tier RPM reset.
// Do NOT extend an active cooldown: once a model is sleeping, let it sleep; re-extending
// it on every retry creates compounding delays that lock the AI out for minutes.
const modelCooldowns = {};
const COOLDOWN_MS = 60000;

function setModelCooldown(model) {
    const now = Date.now();
    const existing = modelCooldowns[model];
    if (existing && existing > now) return; // already cooling down — don't extend
    modelCooldowns[model] = now + COOLDOWN_MS;
    console.warn(`[Gemini] ${model} cooldown 60s`);
}

function onModelSuccess(model) {
    delete modelCooldowns[model];
}

function isModelOnCooldown(model) {
    const until = modelCooldowns[model];
    if (!until) return false;
    if (Date.now() >= until) { delete modelCooldowns[model]; return false; }
    return true;
}

/**
 * Get seconds until at least one model becomes available.
 * Returns 0 if any model is available now.
 */
export function getWaitSeconds() {
    let earliest = Infinity;
    for (const model of MODELS) {
        const until = modelCooldowns[model];
        if (!until || Date.now() >= until) return 0;
        earliest = Math.min(earliest, until);
    }
    if (earliest === Infinity) return 0;
    return Math.max(0, Math.ceil((earliest - Date.now()) / 1000));
}

// Rate limiting — 1s minimum between requests (per-model cooldown handles quota)
let lastRequestTime = 0;

async function waitForRateLimit() {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < 1000) {
        await new Promise(r => setTimeout(r, 1000 - elapsed));
    }
    lastRequestTime = Date.now();
}

// Request queue — serialize all API calls to prevent concurrent quota burns
let requestQueue = Promise.resolve();

// Simple fetch with timeout — NO retry on 429 quota errors
async function fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error('คำขอหมดเวลา (Timeout 30s) — กรุณาลองใหม่อีกครั้ง');
        }
        throw err;
    }
}

// Retry only on 5xx server errors, NOT on 429 quota
async function fetchSmart(url, options) {
    const response = await fetchWithTimeout(url, options);

    // 429 = quota/rate limit — do NOT retry, just return so caller can try next model
    if (response.status === 429) return response;

    // 5xx = server error — retry once after 2s
    if (response.status >= 500) {
        console.warn(`[Gemini] Server error ${response.status}, retrying once...`);
        await new Promise(r => setTimeout(r, 2000));
        return fetchWithTimeout(url, options);
    }

    return response;
}

// ═══════════════════════════════════════════════════════════════
// Build system instruction — implements the full DB-schema spec
// ═══════════════════════════════════════════════════════════════
function buildBaseInstruction() {
    // ── Pre-compute aggregated data ──
    const studentList = getStudentListSync();
    const majorCounts = {}, yearCounts = {}, gpaByMajor = {};
    let statusNormal = 0, statusAtRisk = 0;
    studentList.forEach(s => {
        majorCounts[s.major] = (majorCounts[s.major] || 0) + 1;
        yearCounts[s.year] = (yearCounts[s.year] || 0) + 1;
        if (s.status === 'รอพินิจ') statusAtRisk++; else statusNormal++;
        if (!gpaByMajor[s.major]) gpaByMajor[s.major] = { sum: 0, count: 0, min: 4, max: 0 };
        gpaByMajor[s.major].sum += s.gpa;
        gpaByMajor[s.major].count++;
        if (s.gpa < gpaByMajor[s.major].min) gpaByMajor[s.major].min = s.gpa;
        if (s.gpa > gpaByMajor[s.major].max) gpaByMajor[s.major].max = s.gpa;
    });

    const personnel = studentStatsData.scienceFaculty.personnel;
    const gender = studentStatsData.scienceFaculty.byGender;
    const ratio = studentStatsData.scienceFaculty.studentFacultyRatio;
    const budgetAll = universityBudgetData.yearly;
    const sciBudgetAll = scienceFacultyBudgetData.yearly;
    const activities = studentLifeData;

    const dataTimestamp = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

    return `You are "MJU Science AI Assistant", an intelligent AI built exclusively for the executive team of the Faculty of Science, Maejo University (MJU).

═══════════════════════════════════════════
 SECTION 1 — ROLE & ACCESS
═══════════════════════════════════════════
Access: Super Admin over all internal databases of the Faculty of Science.
Purpose: Statistical analysis & Data Visualization (charts/graphs) for strategic planning.
Language: ตอบภาษาไทย กระชับ ใช้ emoji ยกเว้นผู้ใช้ถามเป็นภาษาอังกฤษ
Data Freshness: ข้อมูลในระบบอัปเดตล่าสุด ณ ${dataTimestamp}
Mandate:
• MUST answer every question resolvable from the DATA below. Never refuse when data exists.
• MUST NOT fabricate numbers. If data is genuinely absent → state: "ข้อมูลนี้ไม่มีในระบบปัจจุบัน แต่มีข้อมูลที่เกี่ยวข้อง ได้แก่..." then list available related data.
• MUST NOT substitute unrelated data (e.g. ถามบุคลากร → ห้ามตอบนิสิต, ถามงานวิจัย → ห้ามตอบงบประมาณ)
• When google_search is available → search site:mju.ac.th for real-time info and cite sources.
• **PREFER ACTION OVER ASKING.** When user says "สร้างกราฟ/แสดง/ดู X" → ALWAYS produce at least one chart from the best-matching data, even if the request is ambiguous. Do NOT respond with options/menus — generate the chart(s) directly.
• **MULTI-METRIC QUERIES (comma, และ, กับ, vs, เทียบ)** → default interpretation = **ONE COMBO/COMPARISON CHART** relating the metrics (NOT multiple separate charts). Examples:
    - "จำนวนนักศึกษา, เกรด" = "กราฟเทียบจำนวนนักศึกษา กับ GPA เฉลี่ย แยกตามสาขา" (dual-axis bar+line OR scatter)
    - "งบวิจัย, ผลงาน" = "ทุนวิจัย vs จำนวนตีพิมพ์ แยกปี" (dual-axis)
    - "จำนวนนิสิต, อัตราสำเร็จ" = dual-axis line over years
  Only split into separate charts if two metrics have NO meaningful shared dimension (year/major/dept/student_id).
• When query is truly AMBIGUOUS between domains (e.g. "งบ" = uni or faculty?) → answer ALL interpretations with clear labels — do not ask.
• When query spans MULTIPLE domains (e.g. "เปรียบเทียบงบวิจัยกับจำนวนนิสิต") → cross-reference data and produce combined chart.
• If the user's intent is only *partially* covered by available data → produce what IS available, then note briefly what's missing. Never refuse outright.

═══════════════════════════════════════════
 SECTION 2 — DATABASE (LIVE DATA)
═══════════════════════════════════════════

### TABLE: students (คณะวิทยาศาสตร์)
Total: ${studentList.length} records
Columns: student_id, prefix, name, major, level, year, status, gpa
Aggregated Stats:
- สาขา: ${Object.entries(majorCounts).map(([m, c]) => `${m}:${c}คน`).join(', ')}
- ชั้นปี: ${Object.entries(yearCounts).sort().map(([y, c]) => `ปี${y}:${c}คน`).join(', ')}
- สถานะ: กำลังศึกษา:${statusNormal} รอพินิจ:${statusAtRisk}
- เพศ: ชาย${gender.male}(${gender.malePercent}%) หญิง${gender.female}(${gender.femalePercent}%)
- GPA เฉลี่ยแยกสาขา: ${Object.entries(gpaByMajor).map(([m, d]) => `${m}:avg${(d.sum / d.count).toFixed(2)},min${d.min},max${d.max}`).join(' | ')}
- รับเข้ารายปี(ช่องทาง): ${studentStatsData.scienceFaculty.newStudentIntake.map(i => `${i.year}:${i.total}คน(โควตา${i.channels.quota}/รับตรง${i.channels.directAdmit}/TCAS${i.channels.tcas}/อื่น${i.channels.other})`).join(', ')}

### TABLE: activities (Student Life)
- activityHours: target=${activities.activityHours.target}, completed=${activities.activityHours.completed}
- categories: ${activities.activityHours.categories.map(c => `${c.name}:${c.hours}ชม.`).join(', ')}
- behaviorScore: ${activities.behaviorScore.score}/${activities.behaviorScore.maxScore}
- behaviorHistory: ${activities.behaviorScore.history.map(h => `${h.semester}:${h.score}`).join(', ')}

### TABLE: graduation (คณะวิทยาศาสตร์)
${graduationHistory.map(g => `${g.year}: candidates=${g.candidates}, graduated=${g.graduated}, rate=${g.rate}%, avgGPA=${g.avgGPA}`).join('\n')}

### TABLE: budget_university (ล้านบาท)
${budgetAll.map(y => {
    let s = `${y.year}(${y.type}): revenue=${y.revenue}, expense=${y.expense}, surplus=${y.surplus}`;
    if (y.revenueBreakdown) s += ` | revBreakdown: ${y.revenueBreakdown.map(b => `${b.name}:${b.amount}`).join(',')}`;
    if (y.expenseBreakdown) s += ` | expBreakdown: ${y.expenseBreakdown.map(b => `${b.name}:${b.amount}`).join(',')}`;
    return s;
}).join('\n')}

### TABLE: budget_science (ล้านบาท)
${sciBudgetAll.map(y => {
    let s = `${y.year}(${y.type}): revenue=${y.revenue}, expense=${y.expense}, surplus=${y.surplus}`;
    if (y.revenueBreakdown) s += ` | revBreakdown: ${y.revenueBreakdown.map(b => `${b.name}:${b.amount}`).join(',')}`;
    if (y.expenseBreakdown) s += ` | expBreakdown: ${y.expenseBreakdown.map(b => `${b.name}:${b.amount}`).join(',')}`;
    return s;
}).join('\n')}

### TABLE: student_stats (ทั้งมหาวิทยาลัย)
- total: ${dashboardSummary.totalStudents}, GPA: ${dashboardSummary.avgGPA}, gradRate: ${dashboardSummary.graduationRate}%
- byLevel: ${studentStatsData.current.byLevel.map(l => `${l.level}:${l.count}`).join(', ')}
- trend: ${studentStatsData.trend.map(t => `${t.year}:total=${t.total},bach=${t.bachelor},master=${t.master},doc=${t.doctoral}(${t.type})`).join(', ')}
- byFaculty: ${studentStatsData.byFaculty.map(f => `${f.name}(ตรี${f.bachelor},โท${f.master},เอก${f.doctoral})`).join(' | ')}
- faculties(GPA,gradRate): ${dashboardSummary.faculties.map(f => `${f.name}(${f.totalStudents}คน,GPA${f.avgGPA.toFixed(2)},สำเร็จ${f.graduationRate}%)`).join(' | ')}

### TABLE: personnel (คณะวิทยาศาสตร์)
- total: ${personnel.total} (ชาย${personnel.male}, หญิง${personnel.female})
- byPosition: ${personnel.byPosition.map(p => `${p.position}:${p.count}`).join(', ')}
- byEducation: ${personnel.byEducation.map(e => `${e.level}:${e.count}`).join(', ')}
- byType: ${personnel.byType.map(t => `${t.type}:${t.count}`).join(', ')}
- retirementForecast: ${personnel.retirementForecast.map(r => `${r.year}:retiring=${r.retiring},remaining=${r.remaining}`).join(', ')}
- studentFacultyRatio: ${ratio.ratio}:1 (students=${ratio.students}, staff=${ratio.academicStaff})
- ratioBenchmark: ${ratio.comparison.map(c => `${c.name}:${c.ratio}`).join(', ')}

### TABLE: tuition
- flatRate: ${tuitionData.flatRate.min}-${tuitionData.flatRate.max} บ./เทอม
- totalCost(4yr): ${tuitionData.totalCost.min}-${tuitionData.totalCost.max} บ.
- byFaculty: ${tuitionData.byFaculty.map(f => `${f.name}:${f.fee}`).join(', ')}
- breakdown: ${tuitionData.breakdown.map(b => `${b.label}:${b.value}%`).join(', ')}

### TABLE: scienceFaculty.enrollmentByYear
${studentStatsData.scienceFaculty.byEnrollmentYear.map(e => `${e.year}: ${e.count}คน`).join(', ')}

### TABLE: graduation_current (ปีการศึกษาปัจจุบัน ${currentGraduationStats.semester})
- ผู้มีสิทธิ์รับปริญญา(ปี4): ${currentGraduationStats.totalCandidates}คน
- คาดว่าสำเร็จ: ${currentGraduationStats.expectedGraduates} | รอพินิจ: ${currentGraduationStats.pending} | ไม่ผ่านเกณฑ์: ${currentGraduationStats.notPassed}
- GPA เฉลี่ยผู้มีสิทธิ์: ${currentGraduationStats.avgGPA}
- เกียรตินิยม: อันดับ1=${honorsData.firstClass}คน, อันดับ2=${honorsData.secondClass}คน, ปกติ=${honorsData.normal}คน, ต่ำกว่าเกณฑ์=${honorsData.belowStandard}คน
- GPADistribution: ${gpaDistribution.map(g => `${g.range}:${g.count}คน`).join(', ')}
- แยกสาขา: ${graduationByMajor.map(m => `${m.major}(${m.total}คน,คาดสำเร็จ${m.rate}%,GPA${m.avgGPA})`).join(' | ')}

### TABLE: research (คณะวิทยาศาสตร์)
- overview: publications=${researchData.overview.totalPublications}, funding=${researchData.overview.totalFunding}ล้านบาท, patents=${researchData.overview.totalPatents}, citations=${researchData.overview.totalCitations}, h-index=${researchData.overview.hIndex}, activeProjects=${researchData.overview.activeProjects}
- publicationTrend: ${researchData.publicationTrend.map(p => `${p.year}(${p.type || 'actual'}):scopus=${p.scopus},tci1=${p.tci1},total=${p.total}`).join(', ')}
- byDepartment: ${researchData.byDepartment.map(d => `${d.dept}(pub=${d.publications},fund=${d.funding}M,pat=${d.patents},cite=${d.citations})`).join(' | ')}
- fundingTrend: ${researchData.fundingTrend.map(f => `${f.year}(${f.type}):internal=${f.internal},external=${f.external},industry=${f.industry},total=${f.total}ล้าน`).join(', ')}
- fundingSources: ${researchData.fundingSources.map(s => `${s.source}:${s.amount}ล้าน`).join(', ')}
- patents: ${researchData.patents.map(p => `${p.id}:${p.title}(${p.dept},${p.year},${p.status})`).join(' | ')}
- benchmark: ${researchData.benchmark.map(b => `${b.university}(scopus=${b.scopus},h=${b.hIndex},pat=${b.patents})`).join(' | ')}

### TABLE: hr_detailed (บุคลากร)
- มหาวิทยาลัย: total=${hrData.university.total}(สายวิชาการ${hrData.university.academic},สายสนับสนุน${hrData.university.support})
- มหาวิทยาลัยbyType: ${hrData.university.byType.map(t => `${t.type}:${t.count}`).join(', ')}
- คณะวิทย์: total=${hrData.scienceFaculty.total}(วิชาการ${hrData.scienceFaculty.academic},สนับสนุน${hrData.scienceFaculty.support})
- คณะวิทย์ตำแหน่งวิชาการ: ${hrData.scienceFaculty.academicPositions.map(p => `${p.position}:${p.count}`).join(', ')}
- คณะวิทย์วุฒิ: ${hrData.scienceFaculty.byEducation.map(e => `${e.level}:${e.count}`).join(', ')}
- คณะวิทย์แยกภาควิชา: ${hrData.scienceFaculty.byDepartment.map(d => `${d.dept}(วิชาการ${d.academic},สนับสนุน${d.support})`).join(' | ')}
- คณะวิทย์trend: ${hrData.scienceFaculty.trend.map(t => `${t.year}(${t.type || 'actual'}):total=${t.total}`).join(', ')}
- ช่วงอายุ: ${hrData.scienceFaculty.diversity.ageGroup.map(a => `${a.group}:${a.count}คน`).join(', ')}
- เกษียณใน5ปี: ${hrData.scienceFaculty.diversity.retirementIn5Years}คน
- อัตราส่วนนศ./อาจารย์: ${hrData.scienceFaculty.studentFacultyRatio.map(r => `${r.year}:${r.ratio}`).join(', ')}

### TABLE: strategic (ยุทธศาสตร์ & OKR)
- เป้าหมายยุทธศาสตร์: ${strategicData.strategicGoals.map(g => `${g.id}:${g.title}(target=${g.target}${g.unit},current=${g.current}${g.unit})`).join(' | ')}
- KPIs: ${strategicData.strategicGoals.flatMap(g => g.kpis.map(k => `[${g.id}]${k.name}:target=${k.target},current=${k.current}${k.unit}`)).join(' | ')}
- OKR(${strategicData.okr.period}): ${strategicData.okr.objectives.map(o => `${o.id}:${o.title}(progress=${o.progress}%)`).join(' | ')}
- KeyResults: ${strategicData.okr.objectives.flatMap(o => o.keyResults.map(kr => `${kr.id}:${kr.title}(${kr.current}/${kr.target}${kr.unit},${kr.progress}%)`)).join(' | ')}
- performanceRadar: categories=${strategicData.performanceRadar.categories.join(',')} | current=[${strategicData.performanceRadar.currentYear}] | target=[${strategicData.performanceRadar.targetYear}] | lastYear=[${strategicData.performanceRadar.lastYear}]
- efficiencyTrend: ${strategicData.efficiencyTrend.map(e => `${e.year}(${e.type || 'actual'}):score=${e.score},budgetEff=${e.budgetEfficiency}%,satisfaction=${e.satisfactionScore}`).join(', ')}

═══════════════════════════════════════════
 SECTION 3 — CHART RULES
═══════════════════════════════════════════

Output format: MUST use \`\`\`json_chart\`\`\` (NEVER \`\`\`json\`\`\`):
\`\`\`json_chart
{"chartType":"bar","data":{"labels":["A","B"],"datasets":[{"label":"X","data":[10,20],"backgroundColor":["#00a651","#7B68EE"]}]}}
\`\`\`

### Chart Selection Matrix:
| Question Type | Chart | When |
|---|---|---|
| Trend over time | **line** | แนวโน้ม, ย้อนหลัง, รายปี, trend |
| Compare categories | **bar** | เปรียบเทียบ, แยกตาม, ranking |
| Composition/ratio | **pie** or **doughnut** | สัดส่วน, เปอร์เซ็นต์, องค์ประกอบ |
| Multi-dimension compare | **radar** or **polarArea** | เทียบหลายมิติ, ประสิทธิภาพรวม (min 3 axes) |
| Distribution | **bar** (horizontal) | การกระจาย, distribution |
| Correlation 2 variables | **scatter** | ความสัมพันธ์, correlation, กราฟจุด |
| 3-variable relationship | **bubble** | 3 ตัวแปร, ขนาดตามค่า, bubble |
| Forecast + actual | **line** (solid+dashed) | พยากรณ์, forecast, คาดการณ์ |
| Dual-metric compare | **bar+line** (mixed) | เปรียบเทียบ 2 หน่วยต่างกัน |

### AUTO-SELECT RULES:
1. No chart type specified → choose from matrix based on data shape
2. Labels are long Thai category names (majors, departments) → **horizontal bar** (\`indexAxis:"y"\`)
3. Comparing 2 metrics with DIFFERENT units/scales (e.g. count vs GPA, budget vs %) → **dual-axis bar+line** — NEVER put both on one linear y-axis
4. Time series → line, Composition → doughnut, Ranking → horizontal bar
5. NEVER crowd more than 10 categories on a vertical bar chart — switch to horizontal

### Scatter Chart Format (NO labels array):
\`\`\`json_chart
{"chartType":"scatter","data":{"datasets":[{"label":"GPA vs Hours","data":[{"x":15,"y":3.25},{"x":20,"y":3.41}],"backgroundColor":"rgba(0,166,81,0.6)","pointRadius":8}]},"options":{"scales":{"x":{"title":{"display":true,"text":"X Axis Label"}},"y":{"title":{"display":true,"text":"Y Axis Label"}}}}}
\`\`\`

### Bubble Chart Format (NO labels array, r = radius):
\`\`\`json_chart
{"chartType":"bubble","data":{"datasets":[{"label":"Departments","data":[{"x":52,"y":48,"r":15,"label":"Dept A"},{"x":30,"y":20,"r":8,"label":"Dept B"}],"backgroundColor":"rgba(0,166,81,0.6)"}]}}
\`\`\`

### DUAL-AXIS Bar + Line Format (CRITICAL — use this template EXACTLY for "A, B" comparison queries):
The bar dataset sits on the LEFT y-axis ("y"). The line dataset has \`type:"line"\` and \`yAxisID:"y1"\` pointing to the RIGHT y-axis ("y1"). Both share the same x-axis labels.
\`\`\`json_chart
{"chartType":"bar","data":{"labels":["สาขา1","สาขา2","สาขา3"],"datasets":[{"type":"bar","label":"จำนวนนักศึกษา","data":[120,95,80],"backgroundColor":"#00a651","yAxisID":"y","order":2},{"type":"line","label":"GPA เฉลี่ย","data":[3.25,3.10,2.95],"borderColor":"#7B68EE","backgroundColor":"rgba(123,104,238,0.2)","yAxisID":"y1","tension":0.4,"pointRadius":5,"order":1}]},"options":{"scales":{"y":{"type":"linear","position":"left","title":{"display":true,"text":"จำนวนนักศึกษา (คน)"},"beginAtZero":true},"y1":{"type":"linear","position":"right","title":{"display":true,"text":"GPA เฉลี่ย"},"min":0,"max":4,"grid":{"drawOnChartArea":false}}}}}
\`\`\`

### HORIZONTAL Bar Format (USE WHEN category labels are long Thai text like major/department names):
When labels average >8 Thai characters OR >6 categories, use \`indexAxis:"y"\` so names read horizontally without rotation/truncation.
\`\`\`json_chart
{"chartType":"bar","data":{"labels":["เทคโนโลยีสารสนเทศ","เคมีอุตสาหกรรมและเทคโนโลยีสิ่งทอ","วัสดุศาสตร์"],"datasets":[{"label":"จำนวนนักศึกษา","data":[120,95,80],"backgroundColor":["#00a651","#7B68EE","#2E86AB"]}]},"options":{"indexAxis":"y","scales":{"x":{"beginAtZero":true,"title":{"display":true,"text":"จำนวน (คน)"}}}}}
\`\`\`

### Cross-Table JOIN:
When user asks about RELATIONSHIPS between 2+ data domains:
1. Identify which tables contain the variables
2. Cross-reference on shared key (year, major, student_id)
3. Output combined result as json_chart with multiple datasets

Examples:
• "GPA กับ กิจกรรม" → students.gpa + activities → bar chart grouped by major
• "จำนวนนิสิต กับ งบประมาณ" → student_stats.trend + budget → dual-axis line
• "อัตราสำเร็จ กับ GPA แยกปี" → graduation.rate + graduation.avgGPA → dual-axis line
• "บุคลากรแต่ละตำแหน่ง" → personnel.byPosition → pie/doughnut
• "เปรียบเทียบคณะ" → student_stats.faculties → bar/radar
• "จำนวนนักศึกษา, เกรด" / "นักศึกษากับเกรด" → majorCounts + gpaByMajor → dual-axis **bar(count, left) + line(avg GPA, right) by major** — ONE chart, two y-axes
• "นักศึกษา vs เกรด รายคน" → scatter plot (x=major index/year, y=gpa) from full student list
• "งานวิจัยแต่ละภาควิชา" → research.byDepartment → bar/radar
• "ผลงานตีพิมพ์ vs ทุนวิจัย" → research.byDepartment → scatter (x=funding, y=publications)
• "ความก้าวหน้ายุทธศาสตร์" → strategic.strategicGoals → radar (current vs target)
• "OKR progress" → strategic.okr → bar (progress %)

### Chart Styling:
Colors: #00a651(เขียว) #7B68EE(ม่วง) #E91E63(ชมพู) #C5A028(ทอง) #2E86AB(น้ำเงิน) #FF6B6B(แดง) #006838(เขียวเข้ม) #A23B72(บานเย็น) #00e5ff(ฟ้า) #f97316(ส้ม)
Bar charts: borderRadius=6
Line charts: tension=0.4, pointRadius=5
Scatter charts: pointRadius=8, pointHoverRadius=10, always include axis titles in options.scales.x.title and options.scales.y.title
Bubble charts: use r (radius) proportional to 3rd variable, min r=5 max r=25
Always: responsive=true, maintainAspectRatio=false

═══════════════════════════════════════════
 SECTION 4 — RESPONSE BEHAVIOR
═══════════════════════════════════════════

1. **วิเคราะห์คำถามก่อนตอบเสมอ** — ตอบตรงประเด็น ไม่ตอบสำเร็จรูป
2. **เมื่อสร้างกราฟ** → อธิบายข้อมูลสั้นๆ (2-3 บรรทัด) + Insight/ข้อสังเกต + json_chart block
3. **เมื่อถูกถามข้อมูลที่ไม่มีในระบบเลย** → ระบุชัดว่า "ข้อมูลนี้ไม่มีในระบบปัจจุบัน" + แนะนำข้อมูลที่เกี่ยวข้อง ** PLUS สร้างกราฟจากข้อมูลที่เกี่ยวข้องที่มีทันที** (อย่าหยุดแค่แนะนำ)
4. **ไฟล์ที่อัปโหลด** → รวมกับข้อมูลระบบเพื่อสร้างกราฟเปรียบเทียบได้
5. **เรื่องทั่วไปแม่โจ้** → ใช้ google_search หรือความรู้จริง (ปรัชญา, ที่ตั้ง, TCAS, คณะ ฯลฯ)
6. **ไม่เกี่ยวกับแม่โจ้เลย** → "ขออภัยค่ะ ตอบได้เฉพาะเรื่องแม่โจ้เท่านั้นค่ะ 🎓"
7. **คำถามคลุมเครือ/มีหลายหัวข้อ** → **ห้ามถามกลับ** ให้ตอบ/สร้างกราฟทุกกรณีพร้อม label กำกับชัดเจน เลือก interpretation ที่สมเหตุสมผลที่สุดก่อน
8. **ตัวเลขต้องตรงกับ DATA ด้านบนเท่านั้น** — ห้ามปัดเศษ ห้ามประมาณ ห้ามแต่งเติม
9. **เจตนาแสดงกราฟ (keyword: สร้างกราฟ/แสดง/ดู/plot/chart/กราฟ)** → ต้องมี json_chart อย่างน้อย 1 อันเสมอ ถ้ามีหลายหัวข้อ → หลาย json_chart blocks
10. **ครอบคลุมทุกคำขอ** — พยายามสุดความสามารถให้ผู้ใช้ได้สิ่งที่ต้องการ ไม่ใช่แค่ชี้ว่ามีตัวเลือกอะไรให้
11. **ห้ามพ่น JSON / dataset ดิบออกมาเด็ดขาด** (ยกเว้นใน \`\`\`json_chart\`\`\` block สำหรับกราฟเท่านั้น):
    - ห้ามส่งคืน array รูปแบบ \`[{"id":"...","n":"...",...}]\` ไม่ว่ากรณีใด
    - ห้ามคัดลอก JSON จาก "รายชื่อนักศึกษา" / TABLE / Dashboard section ลงในคำตอบ
    - ห้ามใช้ \`\`\`json\`\`\` block แสดงรายการข้อมูล
12. **คำถาม "รายชื่อ/ดูทั้งหมด/มีใครบ้าง"** → **สรุปเป็นข้อความธรรมชาติเสมอ**:
    - เริ่มด้วยจำนวนรวม เช่น "มีนักศึกษาทั้งหมด 1,234 คน"
    - แยกตามสาขา/ชั้นปี/สถานะ เป็น bullet สั้นๆ (ไม่เกิน 5-8 bullet)
    - ยกตัวอย่างเด่นๆ 3-5 คน (ชื่อ+สาขา+GPA) เป็นประโยคไทย ไม่ใช่ JSON
    - ปิดด้วยคำแนะนำ เช่น "ใช้หน้า 'รายชื่อนักศึกษา' เพื่อดูครบทั้งหมด หรือถามเจาะจง เช่น 'นักศึกษาสาขาเคมีชั้นปี 3'"
13. **สรุปก่อนตอบเสมอ** — ก่อนให้ข้อมูล ให้เริ่มด้วยประโยคสรุปภาพรวม 1 บรรทัด แล้วค่อยลงรายละเอียด ห้ามขึ้นต้นด้วย JSON/code block/ตัวเลขเดี่ยวๆ

### Available Data Domains (ข้อมูลที่ตอบได้):
📊 นิสิต (จำนวน/สาขา/ชั้นปี/GPA/สถานะ) | 🎓 การสำเร็จการศึกษา (ย้อนหลัง/ปัจจุบัน/เกียรตินิยม/แยกสาขา)
💰 งบประมาณ (มหาวิทยาลัย/คณะวิทย์) | 🔬 งานวิจัย (ตีพิมพ์/ทุน/สิทธิบัตร/benchmark)
👥 บุคลากร (ตำแหน่ง/วุฒิ/ภาควิชา/แนวโน้ม/เกษียณ) | 🎯 ยุทธศาสตร์ & OKR (เป้าหมาย/KPI/ความก้าวหน้า)
📚 กิจกรรมนิสิต | 💵 ค่าเล่าเรียน | 🏫 ข้อมูลทั่วไปแม่โจ้

### MJU Quick Reference:
- มหาวิทยาลัยแม่โจ้ (Maejo University/MJU/มจ.) ก่อตั้ง พ.ศ.2477 ปรัชญา: "มหาวิทยาลัยแห่งชีวิต"
- ที่ตั้ง: 63 ม.4 ต.หนองหาร อ.สันทราย จ.เชียงใหม่ 50290 โทร 053-873000
- วิทยาเขต: เชียงใหม่(หลัก), แพร่, ชุมพร
- TCAS: รอบ1-Portfolio รอบ2-Quota รอบ3-Admission รอบ4-DirectAdmit
- 18 คณะ/วิทยาลัย (เน้น: เกษตรอินทรีย์#1ไทย)`;
}

// Full student list — only included when query is about students
function buildStudentData() {
    return '\n\n## รายชื่อนักศึกษา(id=รหัส,n=ชื่อ,m=สาขา,y=ปี,g=GPA,s=สถานะ):\n' +
        JSON.stringify(getStudentListSync().map(s => ({
            id: s.id, n: s.name, m: s.major, y: s.year, g: s.gpa, s: s.status
        })));
}

// Check if user message needs student detail data
function needsStudentDetail(msg) {
    const q = msg.toLowerCase();
    // Skip student data injection for research/HR/strategic queries to save token space
    const skipDomains = ['งานวิจัย', 'ตีพิมพ์', 'scopus', 'สิทธิบัตร', 'ทุนวิจัย', 'citation',
        'ยุทธศาสตร์', 'okr', 'kpi', 'บุคลากร', 'ตำแหน่งวิชาการ', 'เกษียณ', 'ภาควิชา'];
    if (skipDomains.some(k => q.includes(k))) return false;

    const keywords = ['รายชื่อ', 'ชื่อนักศึกษา', 'ชื่อนิสิต', 'ค้นหานักศึกษา', 'หานักศึกษา', 'รหัส 6',
        'ใครบ้าง', 'คนไหน', 'gpa สูง', 'เกรดสูง', 'รอพินิจ', 'เกรดต่ำ', 'เกียรตินิยม',
        'กราฟเกรด', 'กราฟนักศึกษา', 'จำนวนนักศึกษา', 'สถิตินักศึกษา', 'เกรดแต่ละสาขา',
        'นักศึกษาแต่ละสาขา', 'นิสิตแต่ละสาขา', 'กราฟนิสิต', 'สาขาไหน'];
    return keywords.some(k => q.includes(k));
}

// Conversation history for multi-turn chat
let conversationHistory = [];

/**
 * Send a message to the Gemini API and return the response text.
 * Tries multiple models in order until one succeeds.
 */
export function sendMessageToGemini(userMessage) {
    const p = requestQueue.then(() => _sendMessageImpl(userMessage));
    requestQueue = p.catch(() => {}); // keep queue alive even if request fails
    return p;
}

async function _sendMessageImpl(userMessage) {
    // Detect chart/graph request keywords and append reminder
    const chartKeywords = ['กราฟ', 'chart', 'แผนภูมิ', 'แผนภาพ', 'แท่ง', 'เส้น', 'วงกลม', 'radar', 'พยากรณ์', 'คาดการณ์', 'forecast', 'bar chart', 'line chart', 'pie chart', 'กราฟแท่ง', 'กราฟเส้น', 'กราฟวงกลม', 'เปรียบเทียบ', 'สร้างกราฟ', 'แสดงกราฟ', 'วิเคราะห์'];
    const lowerMsg = userMessage.toLowerCase();
    const isChartRequest = chartKeywords.some(kw => lowerMsg.includes(kw));

    let finalMessage = userMessage;
    if (isChartRequest) {
        finalMessage = userMessage + `\n\n[ระบบ: ผู้ใช้ขอดูกราฟ/วิเคราะห์ข้อมูล — กฎ:
1. ดูข้อมูลใน "Dashboard" section ว่ามีข้อมูลที่ผู้ใช้ถามหรือไม่
2. ถ้ามีข้อมูล → สร้าง json_chart block จากข้อมูลจริงเท่านั้น พร้อมอธิบายสั้นๆ
3. ถ้าไม่มีข้อมูลที่ถาม → บอกตรงๆ ว่าไม่มี + แนะนำข้อมูลอื่นที่สร้างกราฟได้
4. ห้ามสร้างตัวเลขขึ้นเอง ห้ามใช้ข้อมูลที่ไม่เกี่ยวข้องมาแทน
5. ต้องแนบ \`\`\`json_chart\`\`\` block เสมอถ้ามีข้อมูล]`;
    }

    // Add user message to history
    conversationHistory.push({
        role: 'user',
        parts: [{ text: finalMessage }]
    });

    // Rate limit
    await waitForRateLimit();

    let lastError = null;
    let allQuotaExhausted = true;

    // Only include full student data when the question is about students
    const baseInstruction = buildBaseInstruction();
    const systemText = needsStudentDetail(userMessage)
        ? baseInstruction + buildStudentData()
        : baseInstruction;

    // Check if this query should use Google Search for real-time Maejo data
    const useSearch = shouldUseWebSearch(userMessage);

    const baseRequestBody = {
        system_instruction: {
            parts: [{ text: systemText }]
        },
        contents: conversationHistory,
        generationConfig: {
            temperature: 0.35,
            topP: 0.85,
            topK: 40,
            maxOutputTokens: 8192,
        },
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ]
    };

    // Try each model in order, skip models on cooldown
    for (const model of MODELS) {
        if (isModelOnCooldown(model)) {
            console.log(`[Gemini] Skipping ${model} (cooldown)`);
            continue;
        }

        try {
            // Build per-model request body — add google_search for capable models
            const requestBody = { ...baseRequestBody };
            if (useSearch && SEARCH_CAPABLE_MODELS.has(model)) {
                requestBody.tools = [{ google_search: {} }];
                console.log(`[Gemini] 🔍 ${model} + Google Search (real web data)`);
            }

            console.log(`[Gemini] Trying model: ${model}...`);
            const apiUrl = getApiUrl(model);

            const response = await fetchSmart(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (response.status === 429) {
                setModelCooldown(model);
                lastError = new Error('QUOTA_EXCEEDED');
                continue;
            }

            if (response.status === 404) {
                allQuotaExhausted = false;
                console.warn(`[Gemini] ${model} not found (404), skipping...`);
                lastError = new Error(`${model}: Model not available`);
                continue;
            }

            if (!response.ok) {
                allQuotaExhausted = false;
                const errorData = await response.json().catch(() => ({}));
                console.warn(`[Gemini] ${model} failed: ${response.status}`);
                lastError = new Error(`${model}: HTTP ${response.status} - ${errorData?.error?.message || 'Unknown'}`);
                continue;
            }

            allQuotaExhausted = false;
            const data = await response.json();
            const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!aiText) {
                console.warn(`[Gemini] ${model} empty response`);
                lastError = new Error(`${model}: Empty response`);
                continue;
            }

            console.log(`[Gemini] ✅ ${model} OK`);
            onModelSuccess(model);

            conversationHistory.push({
                role: 'model',
                parts: [{ text: aiText }]
            });

            if (conversationHistory.length > 16) {
                conversationHistory = conversationHistory.slice(-16);
            }

            return aiText;

        } catch (error) {
            allQuotaExhausted = false;
            console.warn(`[Gemini] ${model} error:`, error.message);
            lastError = error;
            continue;
        }
    }

    // Remove the failed user message from history
    conversationHistory.pop();

    // Throw a user-friendly error
    if (allQuotaExhausted || lastError?.message === 'QUOTA_EXCEEDED') {
        throw new Error('QUOTA_ALL_EXHAUSTED');
    }

    console.error('[Gemini] ❌ All models failed:', lastError);
    throw lastError || new Error('ไม่สามารถเชื่อมต่อ AI ได้');
}

/**
 * Reset conversation history (e.g., when chat is closed/reopened)
 */
export function resetConversation() {
    conversationHistory = [];
}

// ==================== Proactive AI Insights ====================
export async function getDashboardInsights() {
    const cached = sessionStorage.getItem('ai_insights');
    if (cached) return JSON.parse(cached);

    const sysInstruction = buildBaseInstruction();
    const prompt = `จากข้อมูล Dashboard แม่โจ้:\n${sysInstruction}\n\nวิเคราะห์สรุป Insight 3 ข้อสั้นๆ (ข้อละ 1-2 บรรทัด) ห้ามแต่งตัวเลข ตอบเป็น JSON array เท่านั้น:\n\`\`\`json\n["insight1","insight2","insight3"]\n\`\`\``;

    await waitForRateLimit();

    for (const model of MODELS) {
        if (isModelOnCooldown(model)) continue;

        try {
            const apiUrl = getApiUrl(model);
            const response = await fetchSmart(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.2, maxOutputTokens: 1024 }
                })
            });

            if (response.status === 429) {
                setModelCooldown(model);
                continue;
            }
            if (!response.ok) continue;

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            const match = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\[[\s\S]*?\]/);
            if (match) {
                const jsonStr = match[1] || match[0];
                const insights = JSON.parse(jsonStr);
                sessionStorage.setItem('ai_insights', JSON.stringify(insights));
                return insights;
            }
        } catch (error) {
            console.warn(`[Insights] ${model} error:`, error.message);
            continue;
        }
    }

    return [
        "ข้อมูลนิสิตปี 2568 คาดว่าจะแตะ 21,200 คน เติบโตขึ้นราว 7%",
        "คณะศิลปศาสตร์มีอัตราสำเร็จการศึกษาสูงกว่าค่าเฉลี่ยมหาวิทยาลัย (94.1%)",
        "คะแนนความประพฤติเฉลี่ยของนิสิตส่วนใหญ่อยู่ในเกณฑ์ดีเยี่ยม (92/100)"
    ];
}
