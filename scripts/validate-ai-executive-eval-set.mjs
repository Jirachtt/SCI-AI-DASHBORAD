import { aiExecutiveEvaluationSet } from '../src/data/aiExecutiveEvaluationSet.js';

const REQUIRED_FIELDS = [
  'id',
  'category',
  'role',
  'question',
  'intent',
  'expectedDatasets',
  'expectedBehavior',
  'mustInclude',
  'mustNotInclude',
  'requiresChart',
  'privacy',
];

const ALLOWED_DATASETS = new Set([
  'dashboard_summary',
  'student_stats',
  'tcas_admissions',
  'course_analytics',
  'academic_rules',
  'tuition',
  'graduation',
  'science_budget',
  'university_budget',
  'student_life',
  'research',
  'hr',
  'strategic',
  'uploaded_file',
  'data_accuracy',
  'maejo_public',
]);

const REQUIRED_INTENTS = new Set([
  'executive_advice',
  'chart',
  'blocked_sensitive',
  'uploaded_file',
  'maejo_public',
]);

const REQUIRED_CATEGORIES = new Set([
  'students',
  'tcas',
  'courses',
  'graduation',
  'student_life',
  'budget',
  'hr',
  'strategic',
  'role_access',
  'uploaded_file',
]);

const issues = [];
const ids = new Set();
const intents = new Set();
const categories = new Set();

function fail(message) {
  issues.push(message);
}

if (!Array.isArray(aiExecutiveEvaluationSet)) {
  fail('Evaluation set must export an array.');
} else {
  if (aiExecutiveEvaluationSet.length < 30 || aiExecutiveEvaluationSet.length > 50) {
    fail(`Expected 30-50 cases, found ${aiExecutiveEvaluationSet.length}.`);
  }

  aiExecutiveEvaluationSet.forEach((item, index) => {
    const label = item?.id || `case[${index}]`;
    for (const field of REQUIRED_FIELDS) {
      if (!(field in item)) fail(`${label}: missing field "${field}".`);
    }

    if (ids.has(item.id)) fail(`${label}: duplicate id.`);
    ids.add(item.id);
    intents.add(item.intent);
    categories.add(item.category);

    if ('expectedAnswer' in item || 'answer' in item) {
      fail(`${label}: must not hardcode expected answers.`);
    }

    if (!Array.isArray(item.expectedDatasets)) {
      fail(`${label}: expectedDatasets must be an array.`);
    } else {
      for (const dataset of item.expectedDatasets) {
        if (!ALLOWED_DATASETS.has(dataset)) fail(`${label}: unknown dataset "${dataset}".`);
      }
    }

    if (!Array.isArray(item.expectedBehavior) || item.expectedBehavior.length === 0) {
      fail(`${label}: expectedBehavior must be a non-empty array.`);
    }

    if (!Array.isArray(item.mustInclude) || !Array.isArray(item.mustNotInclude)) {
      fail(`${label}: mustInclude and mustNotInclude must be arrays.`);
    }

    if (typeof item.question !== 'string' || item.question.trim().length < 12) {
      fail(`${label}: question is too short or not a string.`);
    }

    if (item.intent === 'chart' && item.requiresChart !== true) {
      fail(`${label}: chart intent must set requiresChart=true.`);
    }

    if (item.intent === 'blocked_sensitive' && !item.expectedBehavior.includes('deny_or_limit')) {
      fail(`${label}: blocked sensitive cases must expect deny_or_limit.`);
    }

    if (
      item.intent !== 'blocked_sensitive'
      && item.expectedDatasets.length > 0
      && !item.expectedBehavior.includes('cite_sources')
    ) {
      fail(`${label}: data-backed cases must expect source citation.`);
    }
  });
}

for (const requiredIntent of REQUIRED_INTENTS) {
  if (!intents.has(requiredIntent)) fail(`Missing required intent "${requiredIntent}".`);
}

for (const requiredCategory of REQUIRED_CATEGORIES) {
  if (!categories.has(requiredCategory)) fail(`Missing required category "${requiredCategory}".`);
}

if (issues.length > 0) {
  console.error('AI executive evaluation set validation failed:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`PASS AI executive evaluation set: ${aiExecutiveEvaluationSet.length} cases`);
console.log(`PASS Categories covered: ${[...categories].sort().join(', ')}`);
console.log(`PASS Intents covered: ${[...intents].sort().join(', ')}`);
