import assert from 'node:assert/strict';
import {
  DASHBOARD_SYNC_DATASETS,
  dashboardSyncCapabilities,
  fetchDashboardSource,
} from '../api/mju-dashboard-sync.js';

const EXPECTED_DATASETS = [
  'dashboard_summary',
  'student_stats',
  'tcas_admissions',
  'course_analytics',
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

assert.deepEqual(DASHBOARD_SYNC_DATASETS, EXPECTED_DATASETS, 'Sync registry must include every dashboard dataset exactly once.');

const capabilities = dashboardSyncCapabilities();
assert.equal(capabilities.length, EXPECTED_DATASETS.length, 'Every dataset must expose sync capability metadata.');
for (const capability of capabilities) {
  assert.ok(capability.dataset, 'Capability must include dataset id.');
  assert.ok(capability.envKey, `${capability.dataset} must expose its server env key.`);
  assert.ok(['mju_public_html', 'json_api', 'unconfigured'].includes(capability.adapter), `${capability.dataset} has an unknown adapter.`);
  if (capability.configured) assert.ok(capability.sourceUrl, `${capability.dataset} is configured without a source URL.`);
}

const defaultPublicIds = ['dashboard_summary', 'student_stats', 'hr', 'research'];
for (const id of defaultPublicIds) {
  assert.equal(capabilities.find(item => item.dataset === id)?.configured, true, `${id} public source must be configured.`);
}

if (process.argv.includes('--live')) {
  const results = await Promise.all(defaultPublicIds.map(id => fetchDashboardSource(id)));
  for (const result of results) {
    assert.equal(result.validation?.valid, true, `${result.dataset} live payload failed validation.`);
    assert.ok(result.validation.checks.length > 1, `${result.dataset} must run reconciliation checks.`);
    assert.ok(result.validation.checks.every(check => check.passed), `${result.dataset} has a failed reconciliation check.`);
    assert.ok(result.sourceEvidence?.length > 0, `${result.dataset} must retain source evidence.`);
    assert.ok(result.sourceEvidence.every(item => /^[a-f0-9]{64}$/.test(item.sha256)), `${result.dataset} source evidence must include SHA-256.`);
  }

  const student = results.find(item => item.dataset === 'student_stats')?.payload;
  assert.ok(student?.current?.total > 0, 'Student total must be positive.');
  assert.ok(student?.scienceFaculty?.total > 0, 'Science faculty total must be positive.');
  assert.equal((student?.trend || []).some(row => row.type === 'forecast'), false, 'Synced student source must not contain generated forecast rows.');

  console.log(JSON.stringify({
    ok: true,
    mode: 'live',
    datasets: results.map(result => ({
      id: result.dataset,
      rows: result.rowCount,
      checks: result.validation.checks.length,
      sources: result.sourceEvidence.length,
    })),
  }, null, 2));
} else {
  console.log(JSON.stringify({
    ok: true,
    mode: 'registry',
    configured: capabilities.filter(item => item.configured).map(item => item.dataset),
    waitingForEndpoint: capabilities.filter(item => !item.configured).map(item => item.dataset),
  }, null, 2));
}
