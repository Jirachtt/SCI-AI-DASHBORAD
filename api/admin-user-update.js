/* global process */

import { readJsonBody } from './mju-sso-exchange.js';
import { getDocument, runTransaction, updateWrite } from './_firestore-server.js';
import { Buffer } from 'node:buffer';

const CANONICAL_ROLES = new Set(['dean', 'chair', 'staff', 'general', 'student', 'admin']);
const LEGACY_ROLE_MAP = {
  super_admin: 'admin',
  system_admin: 'admin',
  executive: 'dean',
  vice_president: 'dean',
  president: 'dean',
  rector: 'dean',
  prorector: 'dean',
  department_head: 'chair',
  program_chair: 'chair',
  lecturer: 'general',
  teacher: 'general',
  faculty: 'general',
  instructor: 'general',
  professor: 'general',
  officer: 'staff',
  employee: 'staff',
  user: 'general',
  viewer: 'general',
};

const ALLOWED_PATCH_KEYS = new Set([
  'role',
  'roleLabel',
  'avatar',
  'status',
  'approvedBy',
  'approvedAt',
  'roleStartedAt',
  'roleExpiresAt',
  'roleDurationYears',
  'roleManagedAt',
  'roleManagedBy',
]);

const ALLOWED_STATUS = new Set(['approved', 'rejected', 'pending']);

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function normalizeRole(role) {
  const key = String(role || '').trim().toLowerCase();
  return LEGACY_ROLE_MAP[key] || key || 'general';
}

function firebaseApiKey() {
  return process.env.FIREBASE_API_KEY
    || process.env.FIREBASE_WEB_API_KEY
    || process.env.VITE_FIREBASE_API_KEY
    || '';
}

function bearerToken(req) {
  const header = String(req.headers?.authorization || req.headers?.Authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

function decodeJwtPayload(token) {
  try {
    const payload = String(token || '').split('.')[1];
    if (!payload) return {};
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return {};
  }
}

export async function verifyFirebaseIdToken(req) {
  const idToken = bearerToken(req);
  if (!idToken) {
    const err = new Error('Missing Firebase ID token.');
    err.statusCode = 401;
    err.code = 'AUTH_REQUIRED';
    throw err;
  }

  const apiKey = firebaseApiKey();
  if (!apiKey) {
    const err = new Error('Missing Firebase API key for server-side token verification.');
    err.statusCode = 503;
    err.code = 'FIREBASE_API_KEY_MISSING';
    throw err;
  }

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.users?.[0]?.localId) {
    const err = new Error(body.error?.message || 'Invalid Firebase ID token.');
    err.statusCode = 401;
    err.code = 'INVALID_ID_TOKEN';
    throw err;
  }

  return {
    uid: body.users[0].localId,
    email: body.users[0].email || '',
    claims: decodeJwtPayload(idToken),
  };
}

function canManageUsers(profile = {}, authUser = {}) {
  const role = normalizeRole(profile.role);
  if (profile.status === 'approved' && (role === 'admin' || profile.canManageUsers === true || profile.systemAdmin === true)) {
    return true;
  }

  // Custom-token admin login can bootstrap the user document on first login.
  const claimRole = normalizeRole(authUser.claims?.role || authUser.claims?.mjuRole);
  return authUser.uid === 'admin-313' && claimRole === 'admin' && (!profile.role || role === 'admin');
}

function cleanString(value, max = 240) {
  return String(value || '').trim().slice(0, max);
}

function sanitizePatch(patch = {}) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    const err = new Error('Patch must be an object.');
    err.statusCode = 400;
    err.code = 'INVALID_PATCH';
    throw err;
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!ALLOWED_PATCH_KEYS.has(key) || value === undefined) continue;

    if (key === 'role') {
      const role = normalizeRole(value);
      if (!CANONICAL_ROLES.has(role)) {
        const err = new Error(`Role "${value}" is not allowed.`);
        err.statusCode = 400;
        err.code = 'INVALID_ROLE';
        throw err;
      }
      sanitized.role = role;
      continue;
    }

    if (key === 'status') {
      const status = cleanString(value, 32);
      if (!ALLOWED_STATUS.has(status)) {
        const err = new Error(`Status "${value}" is not allowed.`);
        err.statusCode = 400;
        err.code = 'INVALID_STATUS';
        throw err;
      }
      sanitized.status = status;
      continue;
    }

    if (key === 'roleDurationYears') {
      const duration = Number(value);
      sanitized.roleDurationYears = Number.isFinite(duration) ? Math.max(0, Math.min(20, duration)) : 1;
      continue;
    }

    sanitized[key] = cleanString(value, key.endsWith('By') ? 160 : 240);
  }

  if (Object.keys(sanitized).length === 0) {
    const err = new Error('No allowed fields to update.');
    err.statusCode = 400;
    err.code = 'EMPTY_PATCH';
    throw err;
  }

  sanitized.updatedAt = new Date().toISOString();
  return sanitized;
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
    const body = await readJsonBody(req);
    const targetUid = cleanString(body.targetUid || body.uid, 160);
    if (!targetUid) {
      sendJson(res, 400, { error: 'TARGET_UID_REQUIRED', message: 'Missing target user id.' });
      return;
    }
    if (targetUid === authUser.uid) {
      sendJson(res, 403, { error: 'SELF_ROLE_CHANGE_BLOCKED', message: 'Admins cannot change their own role from this panel.' });
      return;
    }

    const callerDoc = await getDocument(`users/${authUser.uid}`);
    if (!canManageUsers(callerDoc?.data || {}, authUser)) {
      sendJson(res, 403, { error: 'FORBIDDEN', message: 'This account cannot manage user roles.' });
      return;
    }

    const targetDoc = await getDocument(`users/${targetUid}`);
    if (!targetDoc?.exists) {
      sendJson(res, 404, { error: 'USER_NOT_FOUND', message: 'Target user was not found.' });
      return;
    }

    const sanitized = sanitizePatch(body.patch);
    await runTransaction([`users/${targetUid}`], () => [
      updateWrite(`users/${targetUid}`, sanitized),
    ]);

    sendJson(res, 200, {
      success: true,
      uid: targetUid,
      patch: sanitized,
      managedBy: authUser.uid,
    });
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      error: error.code || 'ADMIN_USER_UPDATE_FAILED',
      message: error.message || 'Failed to update user role.',
    });
  }
}
