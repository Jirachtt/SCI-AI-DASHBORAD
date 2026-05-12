import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const results = [];

function read(relativePath) {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath)) return '';
  return readFileSync(absolutePath, 'utf8');
}

function expect(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition), detail });
}

const aiChat = read('src/components/AIChat.jsx');
const aiChatPage = read('src/pages/AIChatPage.jsx');
const instantAnswerService = read('src/services/aiInstantAnswerService.js');
const dataAccuracy = read('src/services/dataAccuracyService.js');
const dashboardLiveData = read('src/services/dashboardLiveDataService.js');
const autoSyncPanel = read('src/components/AdminAutoSyncPanel.jsx');
const uploadPanel = read('src/components/AdminDataUpload.jsx');
const adminPanel = read('src/pages/AdminPanelPage.jsx');
const geminiService = read('src/services/geminiService.js');
const aiOrchestrator = read('src/services/aiOrchestrator.js');
const aiContextRegistry = read('src/services/aiContextRegistry.js');
const aiChartPlanner = read('src/services/aiChartPlanner.js');
const tcasData = read('src/data/tcasAdmissionsData.js');
const mockData = read('src/data/mockData.js');
const officialStudentSnapshot = read('src/data/mjuOfficialStudentSnapshot.js');
const studentDataService = read('src/services/studentDataService.js');
const rules = read('firestore.rules');
const packageJson = JSON.parse(read('package.json'));
const { scienceStudentList, studentListSummary } = await import('../src/data/studentListData.js');

expect(
  'Floating AI chat lazy-loads AIChatPage helpers',
  /loadAIChatPageModule/.test(aiChat) && !/from\s+['"]\.\.\/pages\/AIChatPage['"]/.test(aiChat),
  'Prevents duplicated AI route chunks and stale lazy-import failures.'
);

expect(
  'Floating AI chat has fallback UI when AI chunk fails',
  /FallbackChatMessage/.test(aiChat) && /aiModuleError/.test(aiChat),
  'Keeps the popup usable instead of taking down the page.'
);

expect(
  'Instant AI answers are shared by main and floating chat',
  /tryInstantAnswer/.test(instantAnswerService)
    && /aiInstantAnswerService/.test(aiChatPage)
    && /aiInstantAnswerService/.test(aiChat)
    && /buildStudentSummaryAnswer/.test(instantAnswerService)
    && /buildTcasAnswer/.test(instantAnswerService),
  'Fast local answers must be committed with both chat entry points so deploys do not reference a missing module.'
);

expect(
  'Dataset trust labels are available',
  /getDatasetTrustStatus/.test(dataAccuracy)
    && /Official Live/.test(dataAccuracy)
    && /Uploaded File/.test(dataAccuracy)
    && /Reference\/Fallback/.test(dataAccuracy),
  'Sync/data accuracy views can clearly distinguish official, uploaded, and fallback data.'
);

expect(
  'Auto Sync panel renders trust status per dataset',
  /getDatasetTrustStatus/.test(autoSyncPanel) && /readyCount/.test(autoSyncPanel),
  'Presentation can show which datasets are trusted and which still need API/file setup.'
);

expect(
  'Public MJU datasets sync only from manual/admin action',
  !/PUBLIC_LATEST_ENABLED/.test(dashboardLiveData)
    && !/refreshPublicDashboardDataForDisplay/.test(dashboardLiveData)
    && /refreshDashboardDatasetFromSource/.test(dashboardLiveData)
    && /refreshDashboardDatasetFromSource/.test(autoSyncPanel),
  'The visible app should not fetch public MJU Dashboard data on page load or on a public timer.'
);

expect(
  'Data Accuracy admin tab is wired',
  /AdminDataAccuracyPanel/.test(adminPanel) && /Data Accuracy/.test(adminPanel),
  'Admin can verify student totals and source health before presenting.'
);

expect(
  'Student upload guard uses official reconciliation',
  /getStudentUploadQualityPreview/.test(uploadPanel) && /acknowledgeMismatch/.test(uploadPanel),
  'Prevents accidental uploads that diverge from official MJU totals.'
);

expect(
  'AI prompt includes data accuracy context',
  /buildDataAccuracyContextForAI/.test(geminiService) && /DATA ACCURACY SNAPSHOT/.test(dataAccuracy),
  'AI must answer with source/reconcile context instead of guessing.'
);

expect(
  'Student row lookups are deterministic before model fallback',
  /isStudentRowLookupQuestion/.test(aiChatPage)
    && /parseStudentLookupLimit/.test(aiChatPage)
    && /GPA สูงสุด/.test(aiChatPage)
    && /isStudentRowLookupQuestion/.test(geminiService)
    && /studentDetailRowsForPrompt/.test(geminiService),
  'Top/low GPA and row-level student questions must use one sorted student source instead of model guesses.'
);

expect(
  'TCAS page has official public data markers',
  /official_public/.test(tcasData) && /round3Plan2569/.test(tcasData) && /tcasSources/.test(tcasData),
  'TCAS section is traceable to official/reference admissions data.'
);

expect(
  'AI orchestrator classifies presentation-critical intents',
  /classifyAIQuestionIntent/.test(aiOrchestrator)
    && /executive_advice/.test(aiOrchestrator)
    && /maejo_public/.test(aiOrchestrator)
    && /blocked_sensitive/.test(aiOrchestrator),
  'AI should route public Maejo, chart, advice, uploaded file, and sensitive questions through one central plan.'
);

expect(
  'AI context registry describes data trust and chartable fields',
  /AI_DATASET_REGISTRY/.test(aiContextRegistry)
    && /trustLevel/.test(aiContextRegistry)
    && /chartableFields/.test(aiContextRegistry)
    && /formatAIContextBundleForPrompt/.test(aiContextRegistry),
  'AI needs a single source summary for local-first answers and graph planning.'
);

expect(
  'Deterministic chart planner covers key presentation graph requests',
  /createPlannedChartAnswer/.test(aiChartPlanner)
    && /buildTcasChartAnswer/.test(aiChartPlanner)
    && /buildCourseChartAnswer/.test(aiChartPlanner)
    && /buildBudgetStudentCompareAnswer/.test(aiChartPlanner)
    && /buildStudentGraduationCompareAnswer/.test(aiChartPlanner),
  'Common graph requests should not rely on raw model-generated JSON.'
);

expect(
  'Gemini prompt receives orchestration and context-registry guidance',
  /createAIOrchestrationPlan/.test(geminiService)
    && /AI ORCHESTRATION \/ CONTEXT REGISTRY/.test(geminiService)
    && /formatAIContextBundleForPrompt/.test(geminiService),
  'Model responses should follow the same local-first and role-aware planning layer.'
);

expect(
  'Firestore rules prevent self role escalation',
  /safeSelfUserUpdate/.test(rules)
    && /get\('role', null\) == resource\.data\.get\('role', null\)/.test(rules)
    && /get\('status', null\) == resource\.data\.get\('status', null\)/.test(rules)
    && /roleValidity/.test(rules),
  'Users should not be able to promote themselves or extend role validity.'
);

expect(
  'Firestore datasets are write-protected',
  /callerCanManageDashboardData/.test(rules)
    && /match \/datasets\/\{datasetId\}/.test(rules)
    && /allow write: if callerCanManageDashboardData\(\)/.test(rules),
  'Shared dashboard data must be writable only by approved operational roles.'
);

expect(
  'Student totals are locked to current MJU Dashboard aggregate',
  /OFFICIAL_SCIENCE_STUDENT_TOTAL\s*=\s*1398/.test(officialStudentSnapshot)
    && /OFFICIAL_STUDENT_TOTAL\s*=\s*16475/.test(officialStudentSnapshot)
    && /totalStudents:\s*16475/.test(mockData)
    && /total:\s*1398/.test(mockData)
    && /totalStudents:\s*1398/.test(mockData),
  'Aggregate student totals must use MJU Dashboard official values, not roster row counts.'
);

expect(
  'Generated student roster matches current MJU Dashboard aggregate',
  scienceStudentList.length === 1398
    && studentListSummary.total === 1398
    && studentListSummary.byYear.year1 === 408
    && studentListSummary.byYear.year2 === 435
    && studentListSummary.byYear.year3 === 345
    && studentListSummary.byYear.year4 === 189
    && studentListSummary.graduate === 21
    && /STALE_GENERATED_ROW_COUNTS\s*=\s*new Set\(\[1451,\s*1452\]\)/.test(studentDataService)
    && /Generated mock roster/.test(studentDataService),
  'Bundled/generated rows must match the official aggregate count while remaining marked as mock data.'
);

expect(
  'Smoke script is registered in package.json',
  packageJson.scripts?.['smoke:presentation'] === 'node scripts/smoke-presentation-flow.mjs',
  'Run with npm run smoke:presentation before demo.'
);

const failed = results.filter(item => !item.ok);
for (const item of results) {
  const icon = item.ok ? 'PASS' : 'FAIL';
  console.log(`${icon} ${item.name}`);
  if (!item.ok && item.detail) console.log(`  ${item.detail}`);
}

if (failed.length > 0) {
  console.error(`\nPresentation smoke check failed: ${failed.length}/${results.length}`);
  process.exit(1);
}

console.log(`\nPresentation smoke check passed: ${results.length}/${results.length}`);
