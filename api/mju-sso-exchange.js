/* global process */

import { Buffer } from 'node:buffer';
import { createSign } from 'node:crypto';

const FIREBASE_AUDIENCE = 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';
const DEFAULT_CLIENT_ID = '74dade2afc8449ecb975165f6451619f';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');

  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

function readServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    return {
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key,
    };
  }

  return {
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };
}

function base64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(payload) {
  const { clientEmail, privateKey } = readServiceAccount();
  if (!clientEmail || !privateKey) {
    const err = new Error('Missing Firebase service account env for custom token signing.');
    err.statusCode = 500;
    throw err;
  }

  const header = { alg: 'RS256', typ: 'JWT' };
  const unsignedJwt = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsignedJwt);
  signer.end();
  const signature = signer
    .sign(privateKey, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${unsignedJwt}.${signature}`;
}

export function createFirebaseCustomToken(uid, claims = {}) {
  const { clientEmail } = readServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  return signJwt({
    iss: clientEmail,
    sub: clientEmail,
    aud: FIREBASE_AUDIENCE,
    iat: now,
    exp: now + 3600,
    uid,
    claims,
  });
}

export function firstValue(data, keys) {
  for (const key of keys) {
    const value = data?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function normalizeRole(data = {}) {
  const raw = firstValue(data, ['role', 'mjuRole', 'mju_user_role', 'userType', 'mjuUserType', 'type']).toLowerCase();
  const id = firstValue(data, ['mjuId', 'studentId', 'employeeId', 'username', 'userId', 'uid']);
  if (['dean', 'คณบดี'].includes(raw)) return 'dean';
  if (['chair', 'program_chair', 'head', 'หัวหน้าหลักสูตร', 'ประธานหลักสูตร'].includes(raw)) return 'chair';
  if (['staff', 'teacher', 'lecturer', 'faculty', 'employee', 'บุคลากร', 'อาจารย์', 'เจ้าหน้าที่'].includes(raw)) return 'staff';
  if (['student', 'นักศึกษา', 'นิสิต'].includes(raw)) return 'student';
  if (/^\d{8,13}$/.test(id)) return 'student';
  return 'general';
}

export function tokenFromExchangeBody(data = {}) {
  return firstValue(data, ['token', 'firebaseToken', 'customToken', 'custom_token']);
}

export function buildClaims(data = {}) {
  const id = firstValue(data, ['mjuId', 'studentId', 'employeeId', 'username', 'userId', 'uid']);
  const role = normalizeRole(data);
  return {
    mjuVerified: true,
    mjuId: id,
    studentId: firstValue(data, ['studentId']),
    employeeId: firstValue(data, ['employeeId']),
    mjuRole: role,
    mjuUserType: firstValue(data, ['userType', 'mjuUserType', 'type']) || role,
    email: firstValue(data, ['email', 'mail']),
    name: firstValue(data, ['name', 'displayName', 'fullName', 'fullname', 'thaiName']),
    department: firstValue(data, ['department', 'division', 'major']),
    faculty: firstValue(data, ['faculty']),
  };
}

export async function callMjuExchangeEndpoint({ code, codeParam }) {
  const exchangeUrl = process.env.MJU_SSO_EXCHANGE_URL;
  if (!exchangeUrl) {
    const err = new Error('ได้รับค่า ac จาก MJU SSO แล้ว แต่ยังไม่ได้ตั้ง MJU_SSO_EXCHANGE_URL สำหรับตรวจสอบ/แลก ac เป็นข้อมูลผู้ใช้');
    err.statusCode = 501;
    throw err;
  }

  const method = String(process.env.MJU_SSO_EXCHANGE_METHOD || 'POST').toUpperCase();
  const clientId = process.env.MJU_SSO_CLIENT_ID || process.env.VITE_MJU_AUTH_CLIENT_ID || DEFAULT_CLIENT_ID;
  const payload = {
    [codeParam || 'ac']: code,
    ac: code,
    code,
    cid: clientId,
    clientId,
  };
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.MJU_SSO_CLIENT_SECRET) {
    headers.Authorization = `Bearer ${process.env.MJU_SSO_CLIENT_SECRET}`;
  }

  const url = new URL(exchangeUrl);
  const options = { method, headers };
  if (method === 'GET') {
    Object.entries(payload).forEach(([key, value]) => url.searchParams.set(key, value));
  } else {
    options.body = JSON.stringify(payload);
  }

  const response = await fetch(url, options);
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const err = new Error(data?.message || data?.error || `MJU SSO exchange failed with HTTP ${response.status}`);
    err.statusCode = response.status;
    throw err;
  }
  return data;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: 'INVALID_JSON', message: 'Request body must be valid JSON.' });
    return;
  }

  const code = String(body?.code || '').trim();
  const codeParam = String(body?.codeParam || 'ac').trim();
  if (!code) {
    sendJson(res, 400, { error: 'MJU_SSO_CODE_MISSING', message: 'Missing MJU SSO authorization code.' });
    return;
  }

  try {
    const exchangeData = await callMjuExchangeEndpoint({ code, codeParam });
    const existingToken = tokenFromExchangeBody(exchangeData);
    if (existingToken) {
      sendJson(res, 200, { token: existingToken, claims: buildClaims(exchangeData) });
      return;
    }

    const claims = buildClaims(exchangeData);
    const uid = claims.mjuId || claims.email || firstValue(exchangeData, ['uid', 'id']);
    if (!uid) {
      sendJson(res, 502, {
        error: 'MJU_SSO_PROFILE_INCOMPLETE',
        message: 'MJU SSO exchange succeeded but did not return a user id/email for Firebase custom token.',
      });
      return;
    }

    const token = createFirebaseCustomToken(`mju:${uid}`, claims);
    sendJson(res, 200, { token, claims });
  } catch (err) {
    sendJson(res, err.statusCode || 500, {
      error: 'MJU_SSO_EXCHANGE_FAILED',
      message: err.message || 'MJU SSO exchange failed.',
    });
  }
}
