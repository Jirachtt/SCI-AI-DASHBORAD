import { readJsonBody } from './mju-sso-exchange.js';
import { getDocument, runTransaction, updateWrite } from './_firestore-server.js';
import { normalizeRole, verifyFirebaseIdToken } from './admin-user-update.js';
import {
  DASHBOARD_SYNC_DATASETS,
  dashboardSyncCapabilities,
  fetchDashboardSource,
} from './mju-dashboard-sync.js';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function canTriggerSync(profile = {}, authUser = {}) {
  if (authUser.uid === 'admin-313' && normalizeRole(authUser.claims?.role) === 'admin') return true;
  if (profile.status !== 'approved') return false;
  return profile.canSyncData === true
    || profile.systemAdmin === true
    || ['dean', 'staff'].includes(normalizeRole(profile.role));
}

function normalizeRequestedDatasets(value, configuredIds) {
  const requested = value === 'all' || value == null
    ? configuredIds
    : Array.isArray(value)
      ? value
      : [value];
  return [...new Set(requested.map(item => String(item || '').trim()).filter(Boolean))];
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' });
    return;
  }

  try {
    const authUser = await verifyFirebaseIdToken(req);
    const callerDoc = await getDocument(`users/${authUser.uid}`);
    if (!canTriggerSync(callerDoc?.data || {}, authUser)) {
      sendJson(res, 403, {
        error: 'SYNC_PERMISSION_REQUIRED',
        message: 'This account cannot trigger dashboard data sync.',
      });
      return;
    }

    const body = await readJsonBody(req);
    const capabilities = dashboardSyncCapabilities();
    const configuredIds = capabilities.filter(item => item.configured).map(item => item.dataset);
    const datasets = normalizeRequestedDatasets(body.datasets ?? body.dataset, configuredIds);
    const unknown = datasets.filter(id => !DASHBOARD_SYNC_DATASETS.includes(id));
    const unconfigured = datasets.filter(id => !configuredIds.includes(id));
    if (unknown.length || unconfigured.length || datasets.length === 0) {
      sendJson(res, 424, {
        error: 'SYNC_SOURCE_NOT_READY',
        message: 'One or more requested datasets do not have a validated source configuration.',
        unknown,
        unconfigured,
        configured: configuredIds,
      });
      return;
    }

    const settled = await Promise.allSettled(datasets.map(dataset => fetchDashboardSource(dataset)));
    const failures = settled
      .map((result, index) => result.status === 'rejected'
        ? {
            dataset: datasets[index],
            code: result.reason?.code || 'SOURCE_FETCH_FAILED',
            error: result.reason?.message || String(result.reason),
            validation: result.reason?.validation || null,
            companionFailures: result.reason?.companionFailures || null,
          }
        : null)
      .filter(Boolean);
    if (failures.length) {
      sendJson(res, 502, {
        error: 'SYNC_VALIDATION_FAILED',
        message: 'No data was written because at least one source failed validation.',
        failures,
      });
      return;
    }

    const results = settled.map(result => result.value);
    const now = new Date().toISOString();
    const historyKey = now.replace(/[:.]/g, '-');
    const paths = results.flatMap(result => [
      `datasets/${result.dataset}`,
      `datasets/${result.dataset}/history/${historyKey}`,
    ]);
    paths.push(`auditLogs/dashboard-sync-${historyKey}`);

    await runTransaction(paths, () => {
      const writes = [];
      for (const result of results) {
        const common = {
          rowCount: result.rowCount,
          sourceType: result.sourceType,
          sourceUrl: result.sourceUrl,
          sourceUrls: result.sourceUrls || [],
          sourceEvidence: result.sourceEvidence || [],
          updatedAt: now,
          updatedBy: authUser.uid,
          version: 2,
          syncMeta: {
            fetchedAt: result.fetchedAt,
            adapter: result.adapter,
            validation: result.validation,
            atomicBatch: datasets.length > 1,
          },
        };
        writes.push(updateWrite(`datasets/${result.dataset}`, {
          ...common,
          payload: result.payload,
        }));
        writes.push(updateWrite(`datasets/${result.dataset}/history/${historyKey}`, {
          ...common,
          dataset: result.dataset,
          payload: result.payload,
        }));
      }
      writes.push(updateWrite(`auditLogs/dashboard-sync-${historyKey}`, {
        action: 'dashboard_sync',
        datasets,
        actorUid: authUser.uid,
        actorEmail: authUser.email || '',
        createdAt: now,
        sourceCount: results.reduce((total, result) => total + (result.sourceUrls?.length || 1), 0),
        validationPassed: true,
      }));
      return writes;
    });

    sendJson(res, 200, {
      success: true,
      atomic: datasets.length > 1,
      syncedAt: now,
      datasets: results.map(result => ({
        dataset: result.dataset,
        rowCount: result.rowCount,
        sourceType: result.sourceType,
        sourceUrl: result.sourceUrl,
        sourceUrls: result.sourceUrls,
        validation: result.validation,
      })),
    });
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      error: error.code || 'ADMIN_DASHBOARD_SYNC_FAILED',
      message: error.message || 'Dashboard sync failed.',
    });
  }
}
