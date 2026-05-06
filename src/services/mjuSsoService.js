const SSO_STATE_KEY = 'mju_sso_state';
const SSO_RETURN_KEY = 'mju_sso_return_to';
const DEFAULT_MJU_SSO_CLIENT_ID = '74dade2afc8449ecb975165f6451619f';
const MJU_SSO_WEBHOOK_PATH = '/api/mju-sso-callback';
const MJU_SSO_AFTER_SIGNOUT_PATH = '/auth/mju/signout';

export const MJU_SSO_CLIENT_ID = import.meta.env.VITE_MJU_AUTH_CLIENT_ID || DEFAULT_MJU_SSO_CLIENT_ID;
export const MJU_SSO_START_URL = import.meta.env.VITE_MJU_AUTH_START_URL || `https://sso.mju.ac.th/signin.aspx?cid=${MJU_SSO_CLIENT_ID}`;
export const MJU_SSO_SIGNOUT_URL = import.meta.env.VITE_MJU_AUTH_SIGNOUT_URL || `https://sso.mju.ac.th/signout.aspx?cid=${MJU_SSO_CLIENT_ID}`;
export const MJU_SSO_TOKEN_PARAM = import.meta.env.VITE_MJU_AUTH_TOKEN_PARAM || 'token';
const MJU_SSO_TOKEN_PARAM_CANDIDATES = [
    MJU_SSO_TOKEN_PARAM,
    'token',
    'firebaseToken',
    'customToken',
    'custom_token',
    'access_token',
    'id_token',
    'jwt',
    'sso_token',
    'auth_token',
    'authToken',
];
const MJU_SSO_EXCHANGE_PARAM_CANDIDATES = ['ac', 'code', 'ticket', 'sso_ticket', 'session', 'sid'];
export const MJU_SSO_EXCHANGE_ENDPOINT = import.meta.env.VITE_MJU_AUTH_EXCHANGE_ENDPOINT || '/api/mju-sso-exchange';

export function isMjuSsoConfigured() {
    return Boolean(MJU_SSO_CLIENT_ID && MJU_SSO_START_URL);
}

function randomState() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function buildMjuSsoStartUrl(returnTo = '/dashboard') {
    if (!MJU_SSO_START_URL) {
        throw new Error('ยังไม่ได้ตั้งค่า VITE_MJU_AUTH_START_URL สำหรับเชื่อม MJU SSO/REG อย่างเป็นทางการ');
    }

    const state = randomState();
    sessionStorage.setItem(SSO_STATE_KEY, state);
    sessionStorage.setItem(SSO_RETURN_KEY, returnTo);

    const callbackUrl = new URL(MJU_SSO_WEBHOOK_PATH, window.location.origin).toString();
    const url = new URL(MJU_SSO_START_URL, window.location.origin);
    url.searchParams.set('redirect_uri', callbackUrl);
    url.searchParams.set('state', state);
    url.searchParams.set('cid', url.searchParams.get('cid') || MJU_SSO_CLIENT_ID);
    url.searchParams.set('client', MJU_SSO_CLIENT_ID);
    return url.toString();
}

export function buildMjuSsoSignoutUrl() {
    const afterSignoutUrl = new URL(MJU_SSO_AFTER_SIGNOUT_PATH, window.location.origin).toString();
    const url = new URL(MJU_SSO_SIGNOUT_URL, window.location.origin);
    url.searchParams.set('cid', url.searchParams.get('cid') || MJU_SSO_CLIENT_ID);
    url.searchParams.set('redirect_uri', afterSignoutUrl);
    url.searchParams.set('return_url', afterSignoutUrl);
    return url.toString();
}

export function getMjuSsoRegisteredUrls(origin = window.location.origin) {
    return {
        webhookUrl: new URL(MJU_SSO_WEBHOOK_PATH, origin).toString(),
        afterSignoutUrl: new URL(MJU_SSO_AFTER_SIGNOUT_PATH, origin).toString(),
    };
}

function callbackParams(search = '', hash = '') {
    const params = new URLSearchParams(search);
    const hashText = String(hash || '').replace(/^#/, '');
    if (hashText) {
        const hashParams = new URLSearchParams(hashText);
        hashParams.forEach((value, key) => {
            if (!params.has(key)) params.set(key, value);
        });
    }
    return params;
}

function uniqueKeys(params) {
    return [...new Set([...params.keys()])].filter(Boolean);
}

function findFirstParam(params, keys) {
    const lowered = new Map(uniqueKeys(params).map(key => [key.toLowerCase(), key]));
    for (const key of keys) {
        const actual = lowered.get(String(key).toLowerCase());
        const value = actual ? params.get(actual) : '';
        if (value) return { key: actual, value };
    }
    return { key: '', value: '' };
}

export function readMjuSsoCallback(search, hash = '') {
    const params = callbackParams(search, hash);
    const detectedParamKeys = uniqueKeys(params);
    const error = params.get('error') || params.get('error_description');
    if (error) {
        return { ok: false, error, detectedParamKeys };
    }

    const state = params.get('state');
    const expectedState = sessionStorage.getItem(SSO_STATE_KEY);
    if (state && expectedState && state !== expectedState) {
        return {
            ok: false,
            error: 'MJU SSO state ไม่ตรงกัน กรุณาเริ่มเข้าสู่ระบบใหม่',
            detectedParamKeys,
        };
    }

    const tokenParam = findFirstParam(params, MJU_SSO_TOKEN_PARAM_CANDIDATES);
    const token = tokenParam.value;
    if (!token) {
        const exchangeParam = findFirstParam(params, MJU_SSO_EXCHANGE_PARAM_CANDIDATES);
        const foundText = detectedParamKeys.length
            ? ` ระบบส่ง parameter มา: ${detectedParamKeys.join(', ')}`
            : ' ระบบยังไม่ได้ส่ง parameter กลับมา';
        const hint = exchangeParam.key
            ? `พบ ${exchangeParam.key} แล้ว แต่ยังไม่ใช่ Firebase custom token ต้องมี backend/bridge สำหรับแลกค่า ${exchangeParam.key} เป็น custom token ก่อน`
            : 'ยังไม่พบ token ที่ใช้เข้าสู่ระบบได้';
        return {
            ok: false,
            error: `${hint}.${foundText}`,
            exchangeParam: exchangeParam.key,
            exchangeCode: exchangeParam.value,
            detectedParamKeys,
        };
    }

    return {
        ok: true,
        token,
        tokenParam: tokenParam.key,
        detectedParamKeys,
        stateWarning: expectedState && !state ? 'MJU SSO ไม่ได้ส่ง state กลับมา แต่ระบบยอมรับ token เพื่อรองรับ SSO ของมหาวิทยาลัย' : '',
        returnTo: sessionStorage.getItem(SSO_RETURN_KEY) || '/dashboard',
    };
}

export async function exchangeMjuSsoCode({ code, codeParam, detectedParamKeys } = {}) {
    if (!code) {
        return { ok: false, error: 'ไม่พบรหัสสำหรับแลก token จาก MJU SSO' };
    }

    const response = await fetch(MJU_SSO_EXCHANGE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            code,
            codeParam: codeParam || 'ac',
            detectedParamKeys: detectedParamKeys || [],
        }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body?.token) {
        return {
            ok: false,
            error: body?.message || body?.error || 'แลก token จาก MJU SSO ไม่สำเร็จ',
            status: response.status,
        };
    }
    return {
        ok: true,
        token: body.token,
        claims: body.claims || {},
    };
}

export function clearMjuSsoState() {
    sessionStorage.removeItem(SSO_STATE_KEY);
    sessionStorage.removeItem(SSO_RETURN_KEY);
}

export function normalizeMjuRoleFromClaims(claims = {}) {
    const raw = String(
        claims.role ||
        claims.mjuRole ||
        claims.mju_user_role ||
        claims.userType ||
        claims.mjuUserType ||
        ''
    ).toLowerCase();
    const mjuId = String(claims.mjuId || claims.studentId || claims.employeeId || claims.username || '');

    if (['dean', 'คณบดี'].includes(raw)) return 'dean';
    if (['chair', 'program_chair', 'head', 'หัวหน้าหลักสูตร', 'ประธานหลักสูตร'].includes(raw)) return 'chair';
    if (['staff', 'teacher', 'lecturer', 'faculty', 'employee', 'บุคลากร', 'อาจารย์', 'เจ้าหน้าที่'].includes(raw)) return 'staff';
    if (['student', 'นิสิต', 'นักศึกษา'].includes(raw)) return 'student';
    if (/^\d{8,13}$/.test(mjuId)) return 'student';
    return 'general';
}

export function roleLabelForMjuRole(role) {
    const labels = {
        dean: 'คณบดี (MJU SSO)',
        chair: 'ประธานหลักสูตร (MJU SSO)',
        staff: 'บุคลากร/อาจารย์ (MJU SSO)',
        student: 'นักศึกษา (MJU SSO)',
        general: 'ผู้ใช้ทั่วไป (MJU SSO)',
    };
    return labels[role] || labels.general;
}
