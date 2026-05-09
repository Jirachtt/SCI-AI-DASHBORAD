/* global process */

import { createSign } from 'node:crypto';
import { Buffer } from 'node:buffer';

const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DATABASE_ID = '(default)';

let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;

function base64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function readServiceAccount() {
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

export function assertFirestoreConfigured() {
  const { projectId, clientEmail, privateKey } = readServiceAccount();
  if (!projectId || !clientEmail || !privateKey) {
    const err = new Error('Missing Firebase service account env for Firestore server usage.');
    err.code = 'FIRESTORE_SERVICE_ACCOUNT_MISSING';
    err.statusCode = 503;
    throw err;
  }
}

async function getAccessToken() {
  assertFirestoreConfigured();
  const nowMs = Date.now();
  if (cachedAccessToken && cachedAccessTokenExpiresAt - nowMs > 60_000) {
    return cachedAccessToken;
  }

  const { clientEmail, privateKey } = readServiceAccount();
  const now = Math.floor(nowMs / 1000);
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

  cachedAccessToken = body.access_token;
  cachedAccessTokenExpiresAt = nowMs + Math.max(1, Number(body.expires_in || 3600) - 30) * 1000;
  return cachedAccessToken;
}

function projectId() {
  const account = readServiceAccount();
  if (!account.projectId) {
    const err = new Error('Missing Firebase project id for Firestore server usage.');
    err.code = 'FIRESTORE_PROJECT_ID_MISSING';
    err.statusCode = 503;
    throw err;
  }
  return account.projectId;
}

function rootUrl() {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId())}/databases/${DATABASE_ID}`;
}

export function documentName(path) {
  return `projects/${projectId()}/databases/${DATABASE_ID}/documents/${path}`;
}

function documentUrl(path) {
  return `${rootUrl()}/documents/${path}`;
}

export function firestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
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

function jsonFromFirestoreValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return Boolean(value.booleanValue);
  if ('integerValue' in value) return Number(value.integerValue || 0);
  if ('doubleValue' in value) return Number(value.doubleValue || 0);
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(jsonFromFirestoreValue);
  if ('mapValue' in value) return jsonFromFirestoreFields(value.mapValue.fields || {});
  return null;
}

export function jsonFromFirestoreFields(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, jsonFromFirestoreValue(value)])
  );
}

function firestoreFields(data = {}) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, firestoreValue(value)])
  );
}

export function updateWrite(path, data = {}) {
  return {
    update: {
      name: documentName(path),
      fields: firestoreFields(data),
    },
    updateMask: {
      fieldPaths: Object.keys(data),
    },
  };
}

export async function getDocument(path) {
  const accessToken = await getAccessToken();
  const response = await fetch(documentUrl(path), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 404) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error?.message || `Firestore read failed with HTTP ${response.status}`);
  }

  return {
    path,
    name: body.name,
    exists: true,
    updateTime: body.updateTime,
    data: jsonFromFirestoreFields(body.fields || {}),
  };
}

function emptyDoc(path) {
  return {
    path,
    name: documentName(path),
    exists: false,
    updateTime: null,
    data: {},
  };
}

export async function runTransaction(paths, updater, options = {}) {
  const maxAttempts = Math.max(1, Number(options.maxAttempts || 3));
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  const accessToken = await getAccessToken();

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const begin = await fetch(`${rootUrl()}/documents:beginTransaction`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ options: { readWrite: {} } }),
    });
    const beginBody = await begin.json().catch(() => ({}));
    if (!begin.ok || !beginBody.transaction) {
      throw new Error(beginBody.error?.message || `Firestore transaction begin failed with HTTP ${begin.status}`);
    }

    const batchGet = await fetch(`${rootUrl()}/documents:batchGet`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documents: uniquePaths.map(documentName),
        transaction: beginBody.transaction,
      }),
    });
    const rawText = await batchGet.text();
    if (!batchGet.ok) {
      const body = rawText ? JSON.parse(rawText) : {};
      throw new Error(body.error?.message || `Firestore transaction read failed with HTTP ${batchGet.status}`);
    }

    const docsByPath = new Map(uniquePaths.map(path => [path, emptyDoc(path)]));
    let batchItems = [];
    const trimmedRaw = rawText.trim();
    if (trimmedRaw.startsWith('[')) {
      batchItems = JSON.parse(trimmedRaw);
    } else if (trimmedRaw) {
      batchItems = trimmedRaw
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => JSON.parse(line));
    }
    for (const item of batchItems) {
      if (item.found?.name) {
        const suffix = '/documents/';
        const path = item.found.name.slice(item.found.name.indexOf(suffix) + suffix.length);
        docsByPath.set(path, {
          path,
          name: item.found.name,
          exists: true,
          updateTime: item.found.updateTime,
          data: jsonFromFirestoreFields(item.found.fields || {}),
        });
      }
    }

    const writes = await updater(Object.fromEntries(docsByPath));
    if (!writes?.length) {
      await fetch(`${rootUrl()}/documents:rollback`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transaction: beginBody.transaction }),
      }).catch(() => {});
      return { committed: false, docs: Object.fromEntries(docsByPath) };
    }

    const commit = await fetch(`${rootUrl()}/documents:commit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: beginBody.transaction,
        writes,
      }),
    });
    const commitBody = await commit.json().catch(() => ({}));
    if (commit.ok) return { committed: true, docs: Object.fromEntries(docsByPath), response: commitBody };

    const status = commitBody.error?.status || '';
    if (attempt < maxAttempts && ['ABORTED', 'FAILED_PRECONDITION'].includes(status)) {
      await new Promise(resolve => setTimeout(resolve, 50 * attempt));
      continue;
    }
    throw new Error(commitBody.error?.message || `Firestore transaction commit failed with HTTP ${commit.status}`);
  }

  throw new Error('Firestore transaction failed after retries.');
}
