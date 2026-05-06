/* global process */

import { Buffer } from 'node:buffer';
import {
  buildClaims,
  callMjuExchangeEndpoint,
  createFirebaseCustomToken,
  firstValue,
  readJsonBody,
  tokenFromExchangeBody,
} from './mju-sso-exchange.js';

const FRONTEND_CALLBACK_PATH = '/auth/mju/callback';
const AUTH_CODE_KEYS = ['ac', 'code', 'ticket', 'sso_ticket', 'session', 'sid'];
const TOKEN_KEYS = ['token', 'firebaseToken', 'customToken', 'custom_token', 'access_token', 'id_token', 'jwt', 'sso_token', 'auth_token', 'authToken'];
const PROFILE_ID_KEYS = [
  'mjuId',
  'studentId',
  'studentID',
  'studentCode',
  'employeeId',
  'personID',
  'humanID',
  'username',
  'userId',
  'uid',
  'email',
  'mail',
  'e_mail',
];

function originFromRequest(req) {
  const configured = process.env.PUBLIC_SITE_URL || process.env.VITE_PUBLIC_SITE_URL || '';
  if (configured) return configured.replace(/\/$/, '');

  const proto = req.headers?.['x-forwarded-proto'] || 'https';
  const host = req.headers?.['x-forwarded-host'] || req.headers?.host || 'sci-ai-dashboardmju.vercel.app';
  return `${proto}://${host}`;
}

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}

function safeJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function flattenQuery(query = {}) {
  return Object.fromEntries(
    Object.entries(query).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
  );
}

function queryFromUrl(req) {
  try {
    const url = new URL(req.url || '', originFromRequest(req));
    return Object.fromEntries(url.searchParams.entries());
  } catch {
    return {};
  }
}

async function readCallbackPayload(req) {
  const query = { ...queryFromUrl(req), ...flattenQuery(req.query || {}) };
  if (req.method === 'GET') return query;

  const contentType = String(req.headers?.['content-type'] || '').toLowerCase();
  let body = {};
  if (contentType.includes('application/json')) {
    body = await readJsonBody(req).catch(() => ({}));
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    body = Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString('utf8')).entries());
  } else {
    body = await readJsonBody(req).catch(() => ({}));
  }
  return { ...query, ...body };
}

function firstPresent(data, keys) {
  for (const key of keys) {
    const value = data?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return { key, value: String(value).trim() };
    }
  }
  return { key: '', value: '' };
}

function frontendUrl(req, fragmentParams = {}) {
  const url = new URL(FRONTEND_CALLBACK_PATH, originFromRequest(req));
  const fragment = new URLSearchParams();
  Object.entries(fragmentParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value)) fragment.set(key, String(value));
  });
  const hash = fragment.toString();
  return `${url.toString()}${hash ? `#${hash}` : ''}`;
}

function canCreateUserToken(data = {}) {
  return Boolean(firstValue(data, PROFILE_ID_KEYS));
}

async function tokenFromProfile(data = {}) {
  const existingToken = tokenFromExchangeBody(data);
  if (existingToken) return existingToken;

  if (!canCreateUserToken(data)) return '';
  const claims = buildClaims(data);
  const uid = claims.mjuId || claims.email || firstValue(data, ['uid', 'id', 'studentID', 'studentCode', 'personID', 'humanID']);
  return createFirebaseCustomToken(`mju:${uid}`, claims);
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    safeJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const payload = await readCallbackPayload(req);
  const state = payload.state || '';
  const directToken = firstPresent(payload, TOKEN_KEYS);

  if (directToken.value) {
    redirect(res, frontendUrl(req, {
      customToken: directToken.value,
      tokenParam: directToken.key,
      state,
    }));
    return;
  }

  if (canCreateUserToken(payload)) {
    try {
      const customToken = await tokenFromProfile(payload);
      if (customToken) {
        redirect(res, frontendUrl(req, {
          customToken,
          tokenParam: 'webhook_profile',
          state,
        }));
        return;
      }
    } catch (err) {
      redirect(res, frontendUrl(req, {
        error: err.message || 'create_custom_token_failed',
        state,
      }));
      return;
    }
  }

  const codeParam = firstPresent(payload, AUTH_CODE_KEYS);
  if (codeParam.value) {
    try {
      const exchangeData = await callMjuExchangeEndpoint({ code: codeParam.value, codeParam: codeParam.key });
      const customToken = await tokenFromProfile(exchangeData);
      if (customToken) {
        redirect(res, frontendUrl(req, {
          customToken,
          tokenParam: 'exchange',
          state,
        }));
        return;
      }
    } catch {
      // Fall through to the frontend callback with ac so the UI can show the actionable message.
    }

    redirect(res, frontendUrl(req, {
      [codeParam.key]: codeParam.value,
      state,
    }));
    return;
  }

  redirect(res, frontendUrl(req, {
    error: 'mju_sso_callback_missing_payload',
    received: Object.keys(payload).join(','),
    state,
  }));
}
