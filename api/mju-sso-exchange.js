/* global process */

import { Buffer } from 'node:buffer';
import { createSign } from 'node:crypto';

const FIREBASE_AUDIENCE = 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';
const DEFAULT_CLIENT_ID = '74dade2afc8449ecb975165f6451619f';
const DEFAULT_MJU_TOKEN_URL = 'https://sso.mju.ac.th/token.aspx';

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

function envList(name) {
  return String(process.env[name] || '')
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
}

function hasExecutiveSignal(text = '') {
  return /executive|vice[_\s-]?president|president|rector|prorector|university[_\s-]?admin|รองอธิการ|อธิการบดี|ผู้บริหาร/i.test(text);
}

function hasInstructorSignal(text = '') {
  return /teacher|lecturer|faculty|instructor|professor|อาจารย์|ผู้สอน|คณาจารย์/i.test(text);
}

function hasStaffSignal(text = '') {
  return /staff|employee|officer|เจ้าหน้าที่|บุคลากร/i.test(text);
}

function normalizeRole(data = {}) {
  const raw = firstValue(data, ['role', 'mjuRole', 'mju_user_role', 'userType', 'mjuUserType', 'type']).toLowerCase();
  const studentId = firstValue(data, ['studentId', 'studentID', 'studentCode']);
  const staffId = firstValue(data, ['employeeId', 'personID', 'humanID']);
  const id = firstValue(data, ['mjuId', 'studentId', 'studentID', 'studentCode', 'employeeId', 'personID', 'humanID', 'username', 'userId', 'uid']);
  const email = firstValue(data, ['email', 'mail', 'e_mail']).toLowerCase();
  const executiveEmails = envList('MJU_EXECUTIVE_EMAILS');
  const roleText = [
    raw,
    firstValue(data, ['position', 'positionName', 'jobTitle', 'title', 'userGroup', 'personType', 'personnelType', 'departmentRole']),
  ].filter(Boolean).join(' ');
  if (executiveEmails.includes(email) || hasExecutiveSignal(roleText)) return 'executive';
  if (['dean', 'คณบดี'].includes(raw)) return 'dean';
  if (['chair', 'program_chair', 'head', 'หัวหน้าหลักสูตร', 'ประธานหลักสูตร'].includes(raw)) return 'chair';
  if (hasInstructorSignal(roleText)) return 'instructor';
  if (['staff', 'employee', 'บุคลากร', 'เจ้าหน้าที่'].includes(raw) || hasStaffSignal(roleText)) return 'staff';
  if (['student', 'นักศึกษา', 'นิสิต'].includes(raw)) return 'student';
  if (studentId) return 'student';
  if (staffId) return 'staff';
  if (/^\d{8,13}$/.test(id)) return 'student';
  return 'general';
}

export function tokenFromExchangeBody(data = {}) {
  return firstValue(data, ['token', 'firebaseToken', 'customToken', 'custom_token', 'access_token', 'id_token', 'jwt', 'sso_token', 'auth_token', 'authToken']);
}

function fullNameFromMjuData(data = {}) {
  const directName = firstValue(data, ['name', 'displayName', 'fullName', 'fullname', 'thaiName']);
  if (directName) return directName;

  const title = firstValue(data, ['titleName', 'titleNameTh', 'title']);
  const firstName = firstValue(data, ['firstName', 'firstNameTh']);
  const lastName = firstValue(data, ['lastName', 'lastNameTh']);
  return `${title}${firstName}${lastName ? ` ${lastName}` : ''}`.trim();
}

export function buildClaims(data = {}) {
  const studentId = firstValue(data, ['studentId', 'studentID', 'studentCode']);
  const employeeId = firstValue(data, ['employeeId', 'personID', 'humanID']);
  const id = firstValue(data, ['mjuId', 'studentId', 'studentID', 'studentCode', 'employeeId', 'personID', 'humanID', 'username', 'userId', 'uid']);
  const role = normalizeRole(data);
  return {
    mjuVerified: true,
    mjuId: id,
    studentId,
    employeeId,
    mjuRole: role,
    mjuUserType: firstValue(data, ['userType', 'mjuUserType', 'type']) || role,
    email: firstValue(data, ['email', 'mail', 'e_mail']),
    name: fullNameFromMjuData(data),
    photoURL: firstValue(data, ['photoURL', 'pictureUrl', 'personnelPhoto']),
    department: firstValue(data, ['department', 'division', 'major']),
    faculty: firstValue(data, ['faculty']),
  };
}

export async function callMjuExchangeEndpoint({ code, codeParam }) {
  const exchangeUrl = process.env.MJU_SSO_EXCHANGE_URL || DEFAULT_MJU_TOKEN_URL;
  if (!exchangeUrl) {
    const err = new Error('ได้รับค่า ac จาก MJU SSO แล้ว แต่ยังไม่ได้ตั้ง MJU_SSO_EXCHANGE_URL สำหรับตรวจสอบ/แลก ac เป็นข้อมูลผู้ใช้');
    err.statusCode = 501;
    throw err;
  }

  const method = String(process.env.MJU_SSO_EXCHANGE_METHOD || 'POST').toUpperCase();
  const clientId = process.env.MJU_SSO_CLIENT_ID || process.env.VITE_MJU_AUTH_CLIENT_ID || DEFAULT_CLIENT_ID;
  const payload = {
    clientID: clientId,
    code,
  };
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.MJU_SSO_CLIENT_SECRET) {
    headers.Authorization = `Bearer ${process.env.MJU_SSO_CLIENT_SECRET}`;
  }

  const url = new URL(exchangeUrl);
  const options = { method, headers };
  if (method === 'GET') {
    Object.entries(payload).forEach(([key, value]) => url.searchParams.set(key, value));
    if (codeParam && codeParam !== 'code') url.searchParams.set(codeParam, code);
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
    const uid = claims.mjuId || claims.email || firstValue(exchangeData, ['uid', 'id', 'studentID', 'studentCode', 'personID', 'humanID']);
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
