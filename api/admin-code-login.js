/* global process */

import { createFirebaseCustomToken, readJsonBody } from './mju-sso-exchange.js';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function validAdminCode() {
  return String(process.env.ADMIN_LOGIN_CODE || 'admin313').trim();
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
  if (!code || code !== validAdminCode()) {
    sendJson(res, 401, { error: 'INVALID_ADMIN_CODE', message: 'Invalid admin access code.' });
    return;
  }

  try {
    const claims = {
      mjuVerified: true,
      mjuId: 'admin313',
      employeeId: 'admin313',
      role: 'admin',
      mjuRole: 'admin',
      mjuUserType: 'admin',
      authProvider: 'admin_code',
      email: process.env.ADMIN_LOGIN_EMAIL || 'admin@mju.ac.th',
      name: process.env.ADMIN_LOGIN_NAME || 'Admin',
      department: process.env.ADMIN_LOGIN_DEPARTMENT || 'Faculty of Science',
      faculty: process.env.ADMIN_LOGIN_FACULTY || 'Faculty of Science',
    };
    const token = createFirebaseCustomToken('admin-313', claims);
    sendJson(res, 200, { token, claims });
  } catch (err) {
    sendJson(res, err.statusCode || 500, {
      error: 'ADMIN_TOKEN_FAILED',
      message: err.message || 'Failed to create admin custom token.',
    });
  }
}
