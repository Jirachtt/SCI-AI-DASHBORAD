/* global process */

import { createSign } from 'node:crypto';
import { Buffer } from 'node:buffer';
import {
  DASHBOARD_SYNC_DATASETS,
  fetchDashboardSource,
  rowCountFromPayload,
} from './mju-dashboard-sync.js';

const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function base64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function readServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key,
    };
  }

  return {
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };
}

function assertCronAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.VERCEL_ENV === 'production') {
      const err = new Error('Missing CRON_SECRET in production.');
      err.statusCode = 500;
      throw err;
    }
    return;
  }

  const auth = req.headers?.authorization || req.headers?.Authorization || '';
  if (auth !== `Bearer ${secret}`) {
    const err = new Error('Unauthorized cron request');
    err.statusCode = 401;
    throw err;
  }
}

async function getAccessToken() {
  const { clientEmail, privateKey } = readServiceAccount();
  if (!clientEmail || !privateKey) {
    throw new Error('Missing Firebase service account env. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: clientEmail,
    scope: FIRESTORE_SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };
  const unsignedJwt = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsignedJwt);
  signer.end();
  const signature = signer
    .sign(privateKey, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsignedJwt}.${signature}`,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error_description || body.error || `OAuth token failed with HTTP ${response.status}`);
  }
  return body.access_token;
}

function firestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(firestoreValue) } };
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() };

  switch (typeof value) {
    case 'string':
      return { stringValue: value };
    case 'boolean':
      return { booleanValue: value };
    case 'number':
      if (Number.isInteger(value)) return { integerValue: String(value) };
      return { doubleValue: value };
    case 'object':
      return {
        mapValue: {
          fields: Object.fromEntries(
            Object.entries(value).map(([key, nested]) => [key, firestoreValue(nested)])
          ),
        },
      };
    default:
      return { stringValue: String(value) };
  }
}

async function writeDatasetToFirestore(dataset, syncResult, accessToken) {
  const { projectId } = readServiceAccount();
  if (!projectId) throw new Error('Missing Firebase project id for Firestore write.');

  const now = new Date();
  const rowCount = syncResult.rowCount ?? rowCountFromPayload(syncResult.payload);
  const fields = {
    payload: syncResult.payload,
    rowCount,
    sourceType: syncResult.sourceType || 'mju_sync',
    sourceUrl: syncResult.sourceUrl || '',
    updatedAt: now,
    updatedBy: 'mju-dashboard-cron',
    version: 1,
    syncMeta: {
      fetchedAt: syncResult.fetchedAt || now.toISOString(),
      adapter: syncResult.adapter || 'unknown',
      cron: true,
      dataset,
    },
  };

  const updateMask = Object.keys(fields)
    .map(field => `updateMask.fieldPaths=${encodeURIComponent(field)}`)
    .join('&');
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/datasets/${encodeURIComponent(dataset)}?${updateMask}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [key, firestoreValue(value)])
      ),
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error?.message || `Firestore write failed with HTTP ${response.status}`);
  }

  return { rowCount, updatedAt: now.toISOString() };
}

function requestedDatasets(req) {
  const queryDataset = String(req.query?.dataset || '').trim();
  if (queryDataset) return queryDataset === 'all' ? DASHBOARD_SYNC_DATASETS : [queryDataset];

  const envList = String(process.env.MJU_SYNC_DATASETS || '').trim();
  if (envList) {
    return envList
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }

  return DASHBOARD_SYNC_DATASETS;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    assertCronAuthorized(req);
  } catch (err) {
    sendJson(res, err.statusCode || 401, { error: err.message });
    return;
  }

  const datasets = requestedDatasets(req);
  const results = [];
  let accessToken = null;

  for (const dataset of datasets) {
    try {
      const syncResult = await fetchDashboardSource(dataset);
      accessToken ||= await getAccessToken();
      const write = await writeDatasetToFirestore(dataset, syncResult, accessToken);
      results.push({
        dataset,
        ok: true,
        sourceType: syncResult.sourceType,
        adapter: syncResult.adapter,
        sourceUrl: syncResult.sourceUrl,
        ...write,
      });
    } catch (err) {
      results.push({
        dataset,
        ok: false,
        error: err?.message || 'Sync failed',
      });
    }
  }

  const okCount = results.filter(item => item.ok).length;
  sendJson(okCount > 0 ? 200 : 502, {
    ok: okCount > 0,
    synced: okCount,
    total: results.length,
    results,
  });
}
