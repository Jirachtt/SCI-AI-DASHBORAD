import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});

try {
  const evaluation = await vite.ssrLoadModule('/src/data/aiExecutiveEvaluationSet.js');
  const advice = await vite.ssrLoadModule('/src/utils/aiAdvicePolicy.js');
  const orchestrator = await vite.ssrLoadModule('/src/services/aiOrchestrator.js');
  const planner = await vite.ssrLoadModule('/src/services/aiChartPlanner.js');
  const retrieval = await vite.ssrLoadModule('/src/services/aiRetrievalPolicy.js');

  const compareCase = evaluation.aiExecutiveEvaluationSet
    .find(item => item.id === 'exec-budget-student-compare-019');
  assert.ok(compareCase, 'budget/student comparison evaluation case is required');

  const comparisonVariants = [
    compareCase.question,
    'งบประมาณเทียบกับจำนวนนักศึกษา',
    'เทียบกันระหว่างงบประมาณและจำนวนนักศึกษา',
    'งบประมาณกับจำนวนนักศึกษาต่างกันอย่างไร',
  ];
  for (const question of comparisonVariants) {
    assert.equal(advice.isAIComparisonIntent(question), true, `comparison intent not detected: ${question}`);
    assert.equal(advice.isAnalyticalReasoningIntent(question), true, `reasoning intent not detected: ${question}`);
  }

  const plan = orchestrator.createAIOrchestrationPlan(compareCase.question, { role: 'dean' });
  assert.equal(plan.intent, 'chart');
  assert.equal(plan.comparisonMode, true);
  assert.equal(plan.reasoningMode, true);
  assert.ok(plan.selectedDatasets.includes('science_budget'), 'science budget must be selected');
  assert.ok(plan.selectedDatasets.includes('student_stats'), 'student statistics must be selected');

  const planned = planner.createPlannedChartAnswer(compareCase.question, { role: 'dean' });
  assert.ok(planned?.chart, 'comparison chart must be generated');
  assert.equal(planned.chart.data.datasets.length, 2, 'comparison chart must contain exactly two requested metrics');
  assert.match(planned.chart.data.datasets[0].label, /งบประมาณ|รายรับ/);
  assert.match(planned.chart.data.datasets[1].label, /นักศึกษา|ผู้เรียน/);
  assert.equal(planned.chart.data.datasets[0].yAxisID, 'y');
  assert.equal(planned.chart.data.datasets[1].yAxisID, 'y1');
  assert.equal(planned.chart.data.labels.length, planned.chart.data.datasets[0].data.length);
  assert.equal(planned.chart.data.labels.length, planned.chart.data.datasets[1].data.length);

  const trustedDataset = id => ({
    id,
    hasData: true,
    isLive: true,
    trustLevel: 'live_official',
    confidence: 'high',
  });
  const directContext = (id, text) => ({ id, text: `${text}\nsource: live_official\nrows: 4` });

  const completePolicy = retrieval.decideAIRetrievalPolicy({
    question: compareCase.question,
    intent: 'chart',
    contexts: [
      directContext('budget', 'งบประมาณปี 2570-2573 มีข้อมูลครบ'),
      directContext('students', 'จำนวนนักศึกษาปี 2570-2573 มีข้อมูลครบ'),
    ],
    contextBundle: {
      comparisonMode: true,
      contexts: [trustedDataset('science_budget'), trustedDataset('student_stats')],
      deniedContexts: [],
    },
    allowWebSearch: true,
  });
  assert.equal(completePolicy.useWebSearch, false, 'complete local comparison must not search the web');
  assert.equal(completePolicy.comparisonEvidenceComplete, true);

  const incompletePolicy = retrieval.decideAIRetrievalPolicy({
    question: compareCase.question,
    intent: 'chart',
    contexts: [directContext('budget', 'งบประมาณปี 2570-2573 มีข้อมูลครบ')],
    contextBundle: {
      comparisonMode: true,
      contexts: [trustedDataset('science_budget')],
      deniedContexts: [],
    },
    allowWebSearch: true,
  });
  assert.equal(incompletePolicy.useWebSearch, true, 'missing public comparison evidence must use trusted web fallback');
  assert.equal(incompletePolicy.reason, 'local_comparison_evidence_incomplete');

  const financeQuestion = 'เปรียบเทียบรายรับกับรายจ่ายของคณะวิทยาศาสตร์';
  const completeFinancePolicy = retrieval.decideAIRetrievalPolicy({
    question: financeQuestion,
    intent: 'chart',
    contexts: [directContext('budget', 'รายรับและรายจ่ายของคณะมีข้อมูลครบตามปี')],
    contextBundle: {
      comparisonMode: true,
      contexts: [trustedDataset('science_budget')],
      deniedContexts: [],
    },
    allowWebSearch: true,
  });
  assert.equal(completeFinancePolicy.comparisonEvidenceComplete, true, 'revenue/expense evidence must be recognized separately');

  const incompleteFinancePolicy = retrieval.decideAIRetrievalPolicy({
    question: financeQuestion,
    intent: 'chart',
    contexts: [directContext('budget', 'มีเฉพาะข้อมูลรายรับของคณะ')],
    contextBundle: {
      comparisonMode: true,
      contexts: [trustedDataset('science_budget')],
      deniedContexts: [],
    },
    allowWebSearch: true,
  });
  assert.equal(incompleteFinancePolicy.comparisonEvidenceComplete, false, 'missing expense evidence must be detected');
  assert.equal(incompleteFinancePolicy.useWebSearch, true, 'missing public expense evidence must use trusted web fallback');

  const [serviceSource, mainChatSource, popupChatSource] = await Promise.all([
    readFile(new URL('../src/services/geminiService.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/AIChatPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/AIChat.jsx', import.meta.url), 'utf8'),
  ]);
  assert.match(serviceSource, /STRICT COMPARISON MODE/);
  assert.match(serviceSource, /buildUploadedFileEvidenceContext/);
  assert.match(serviceSource, /comparisonVerification/);
  assert.match(serviceSource, /intent === 'analysis' \|\| intent === 'chart_analysis'/);
  assert.match(serviceSource, /reasoningMode\s*\? uniqueModels\(\[\.\.\.SEARCH_MODEL_ORDER, \.\.\.PRIMARY_MODEL_ORDER\]\)/);
  assert.match(mainChatSource, /uploadedFileData,\s*\n\s*aiSettings/);
  assert.match(popupChatSource, /uploadedFileData,\s*\n\s*aiSettings/);

  console.log('PASS comparison intent, dual-dataset chart, local-first retrieval, trusted web fallback, and uploaded evidence integration');
} finally {
  await vite.close();
}
