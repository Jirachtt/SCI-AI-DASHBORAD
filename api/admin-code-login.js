/* global process */

import { createFirebaseCustomToken, readJsonBody } from './mju-sso-exchange.js';
import { runTransaction, updateWrite } from './_firestore-server.js';

const ADMIN_UID = 'admin-313';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function validAdminCode() {
  return String(process.env.ADMIN_LOGIN_CODE || '').trim();
}

function addYears(isoDate, years) {
  const date = new Date(isoDate);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString();
}

async function ensureAdminProfile(claims) {
  const path = `users/${ADMIN_UID}`;
  const now = new Date().toISOString();

  await runTransaction([path], docs => {
    const current = docs[path]?.data || {};
    const roleStartedAt = current.roleStartedAt || now;
    const roleExpiresAt = current.roleExpiresAt || addYears(roleStartedAt, 1);
    return [
      updateWrite(path, {
        name: claims.name,
        email: claims.email,
        role: 'admin',
        roleLabel: 'ผู้ดูแลผู้ใช้ (Admin)',
        avatar: 'AD',
        status: 'approved',
        authProvider: 'admin_code',
        department: claims.department,
        faculty: claims.faculty,
        createdAt: current.createdAt || now,
        roleStartedAt,
        roleExpiresAt,
        roleDurationYears: Number(current.roleDurationYears || 1),
        updatedAt: now,
        // Never persist the access code as an MJU/employee identifier.
        mjuVerified: false,
        mjuId: null,
        employeeId: null,
        employeeCode: null,
        mjuClaims: {},
        mjuIdentityStatus: 'not_applicable',
      }),
    ];
  });
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

  const expectedCode = validAdminCode();
  if (!expectedCode) {
    sendJson(res, 503, {
      error: 'ADMIN_LOGIN_NOT_CONFIGURED',
      message: 'Admin login is not configured on the server.',
    });
    return;
  }

  const code = String(body?.code || '').trim();
  if (!code || code !== expectedCode) {
    sendJson(res, 401, { error: 'INVALID_ADMIN_CODE', message: 'Invalid admin access code.' });
    return;
  }

  try {
    const claims = {
      role: 'admin',
      authProvider: 'admin_code',
      email: process.env.ADMIN_LOGIN_EMAIL || 'admin@mju.ac.th',
      name: process.env.ADMIN_LOGIN_NAME || 'Admin',
      department: process.env.ADMIN_LOGIN_DEPARTMENT || 'Faculty of Science',
      faculty: process.env.ADMIN_LOGIN_FACULTY || 'Faculty of Science',
    };
    await ensureAdminProfile(claims);
    const token = createFirebaseCustomToken(ADMIN_UID, claims);
    sendJson(res, 200, { token, claims });
  } catch (err) {
    sendJson(res, err.statusCode || 500, {
      error: 'ADMIN_TOKEN_FAILED',
      message: err.message || 'Failed to create admin custom token.',
    });
  }
}
