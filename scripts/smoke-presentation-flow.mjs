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
const autoSyncPanel = read('src/components/AdminAutoSyncPanel.jsx');
const uploadPanel = read('src/components/AdminDataUpload.jsx');
const adminPanel = read('src/pages/AdminPanelPage.jsx');
const geminiService = read('src/services/geminiService.js');
const aiOrchestrator = read('src/services/aiOrchestrator.js');
const aiContextRegistry = read('src/services/aiContextRegistry.js');
const aiChartPlanner = read('src/services/aiChartPlanner.js');
const tcasData = read('src/data/tcasAdmissionsData.js');
const rules = read('firestore.rules');
const packageJson = JSON.parse(read('package.json'));

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
