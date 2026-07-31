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
const layout = read('src/components/Layout.jsx');
const dataSourceStatusPill = read('src/components/DataSourceStatusPill.jsx');
const instantAnswerService = read('src/services/aiInstantAnswerService.js');
const dataAccuracy = read('src/services/dataAccuracyService.js');
const dashboardLiveData = read('src/services/dashboardLiveDataService.js');
const autoSyncPanel = read('src/components/AdminAutoSyncPanel.jsx');
const uploadPanel = read('src/components/AdminDataUpload.jsx');
const adminPanel = read('src/pages/AdminPanelPage.jsx');
const adminAIUsagePanel = read('src/components/AdminAIUsagePanel.jsx');
const mjuConnectedPanel = read('src/components/MjuConnectedPagePanel.jsx');
const mjuConnectedDataService = read('src/services/mjuConnectedDataService.js');
const geminiService = read('src/services/geminiService.js');
const aiAnswerVerifier = read('src/utils/aiAnswerVerifier.js');
const fileParsers = read('src/utils/fileParsers.js');
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
const {
  OFFICIAL_STUDENT_TOTAL,
  OFFICIAL_SCIENCE_STUDENT_TOTAL,
  OFFICIAL_SCIENCE_STUDENT_LEVELS,
  OFFICIAL_SCIENCE_ROSTER_YEAR_TARGETS,
} = await import('../src/data/mjuOfficialStudentSnapshot.js');
const { aiExecutiveEvaluationSet } = await import('../src/data/aiExecutiveEvaluationSet.js');

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
  'Data Accuracy remains available without cluttering the global header',
  !/DataSourceStatusPill/.test(layout)
    && /ensureDataAccuracy/.test(dataSourceStatusPill)
    && /studentReconcile/.test(dataSourceStatusPill),
  'Data quality remains available to Admin and AI while the command bar stays focused.'
);

expect(
  'AI quota monitor is wired into Admin',
  /AdminAIUsagePanel/.test(adminPanel)
    && /AI Usage/.test(adminPanel)
    && /\/api\/ai-usage/.test(adminAIUsagePanel)
    && /serverBacked/.test(adminAIUsagePanel),
  'Admin needs production usage/quota visibility before and during presentation.'
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
  'MJU Connected panel exposes data status and endpoint gaps',
  /mju-page-status-strip/.test(mjuConnectedPanel)
    && /endpointTodo/.test(mjuConnectedPanel)
    && /scope/.test(mjuConnectedDataService)
    && /sensitive/.test(mjuConnectedDataService),
  'Users should see what MJU data is connected, waiting for consent, unavailable, or unauthorized.'
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
  /callerCanManageDashboardDataset/.test(rules)
    && /match \/datasets\/\{datasetId\}/.test(rules)
    && /allow write: if callerCanManageDashboardDataset\(datasetId\)/.test(rules)
    && /callerHasApprovedRole\(\['admin', 'dean', 'staff'\]\)/.test(rules)
    && /callerHasApprovedRole\(\['chair'\]\)/.test(rules),
  'Shared dashboard data must be writable only by approved roles and dataset scope.'
);

expect(
  'Student totals are locked to current MJU Dashboard aggregate',
  OFFICIAL_SCIENCE_STUDENT_TOTAL > 0
    && OFFICIAL_STUDENT_TOTAL > OFFICIAL_SCIENCE_STUDENT_TOTAL
    && /export const OFFICIAL_SCIENCE_STUDENT_TOTAL/.test(officialStudentSnapshot)
    && /export const OFFICIAL_STUDENT_TOTAL/.test(officialStudentSnapshot)
    && /dashboardSummary\.totalStudents\s*=\s*OFFICIAL_STUDENT_TOTAL/.test(mockData)
    && /scienceFallback\.total\s*=\s*OFFICIAL_SCIENCE_STUDENT_TOTAL/.test(mockData),
  'Aggregate student totals must use MJU Dashboard official values, not roster row counts.'
);

const rosterTargets = Object.fromEntries(
  OFFICIAL_SCIENCE_ROSTER_YEAR_TARGETS.map(row => [`year${row.year}`, row.target])
);
const postgraduateTarget = OFFICIAL_SCIENCE_STUDENT_LEVELS
  .filter(row => row.key === 'master' || row.key === 'doctoral')
  .reduce((sum, row) => sum + Number(row.count || 0), 0);

expect(
  'Generated student roster matches current MJU Dashboard aggregate',
  scienceStudentList.length === OFFICIAL_SCIENCE_STUDENT_TOTAL
    && studentListSummary.total === OFFICIAL_SCIENCE_STUDENT_TOTAL
    && studentListSummary.byYear.year1 === rosterTargets.year1
    && studentListSummary.byYear.year2 === rosterTargets.year2
    && studentListSummary.byYear.year3 === rosterTargets.year3
    && studentListSummary.byYear.year4 === rosterTargets.year4
    && studentListSummary.graduate === postgraduateTarget
    && /STALE_GENERATED_ROW_COUNTS/.test(studentDataService)
    && /Generated mock roster/.test(studentDataService),
  'Bundled/generated rows must match the official aggregate count while remaining marked as mock data.'
);

expect(
  'Smoke script is registered in package.json',
  packageJson.scripts?.['smoke:presentation'] === 'node scripts/smoke-presentation-flow.mjs',
  'Run with npm run smoke:presentation before demo.'
);

expect(
  'Executive AI evaluation set is registered and presentation-sized',
  packageJson.scripts?.['eval:executive'] === 'node scripts/validate-ai-executive-eval-set.mjs'
    && packageJson.scripts?.['eval:e2e'] === 'node scripts/run-ai-e2e-eval.mjs'
    && Array.isArray(aiExecutiveEvaluationSet)
    && aiExecutiveEvaluationSet.length >= 30
    && aiExecutiveEvaluationSet.length <= 50
    && aiExecutiveEvaluationSet.some(item => item.intent === 'executive_advice')
    && aiExecutiveEvaluationSet.some(item => item.intent === 'chart')
    && aiExecutiveEvaluationSet.some(item => item.intent === 'blocked_sensitive'),
  'Use npm run eval:executive to verify decision prompts, chart prompts, and role-denied prompts.'
);

expect(
  'Post-answer verifier is wired into Gemini responses',
  /verifyAIAnswerAgainstContext/.test(aiAnswerVerifier)
    && /extractNumericEvidence/.test(aiAnswerVerifier)
    && /answerVerification/.test(geminiService),
  'AI answers with unsupported numbers should be flagged and surfaced in debug metadata.'
);

expect(
  'Context slimming is wired into Gemini prompts and metadata',
  /slimRetrievedContexts/.test(geminiService)
    && /contextSlimming/.test(geminiService)
    && /CONTEXT SELECTION \/ SLIMMING/.test(geminiService),
  'AI prompts should send only selected, budgeted context and report trimming metadata.'
);

expect(
  'AI observability panel surfaces runtime and verification metadata',
  /ai-observability-panel/.test(aiChatPage)
    && /observabilityRows/.test(aiChatPage)
    && /answerVerification/.test(aiChatPage),
  'The AI system panel should show selected datasets, verification, token, latency, and context budget.'
);

expect(
  'File intelligence upload UI exposes schema readiness and chart suggestions',
  /FileIntelligenceSummary/.test(aiChatPage)
    && /analysisReadiness/.test(fileParsers)
    && /recommendedCharts/.test(fileParsers),
  'Uploaded CSV/XLSX files should show schema health, missing values, and suggested chart/questions.'
);

expect(
  'Role and stability audits are registered',
  packageJson.scripts?.['audit:roles'] === 'node scripts/validate-role-access-matrix.mjs'
    && packageJson.scripts?.['smoke:vercel'] === 'node scripts/smoke-vercel-production.mjs'
    && /eval:executive/.test(packageJson.scripts?.['verify:stability'] || '')
    && /eval:e2e/.test(packageJson.scripts?.['verify:stability'] || '')
    && /audit:roles/.test(packageJson.scripts?.['verify:stability'] || '')
    && /smoke:presentation/.test(packageJson.scripts?.['verify:stability'] || ''),
  'Run npm run verify:stability before a presentation freeze.'
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
