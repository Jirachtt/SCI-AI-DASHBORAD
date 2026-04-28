const SSO_STATE_KEY = 'mju_sso_state';
const SSO_RETURN_KEY = 'mju_sso_return_to';

export const MJU_SSO_START_URL = import.meta.env.VITE_MJU_AUTH_START_URL || '';
export const MJU_SSO_TOKEN_PARAM = import.meta.env.VITE_MJU_AUTH_TOKEN_PARAM || 'token';

export function isMjuSsoConfigured() {
    return Boolean(MJU_SSO_START_URL);
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

    const callbackUrl = new URL('/auth/mju/callback', window.location.origin).toString();
    const url = new URL(MJU_SSO_START_URL, window.location.origin);
    url.searchParams.set('redirect_uri', callbackUrl);
    url.searchParams.set('state', state);
    url.searchParams.set('client', 'sci-ai-dashboard');
    return url.toString();
}

export function readMjuSsoCallback(search) {
    const params = new URLSearchParams(search);
    const error = params.get('error') || params.get('error_description');
    if (error) {
        return { ok: false, error };
    }

    const state = params.get('state');
    const expectedState = sessionStorage.getItem(SSO_STATE_KEY);
    if (!state || !expectedState || state !== expectedState) {
        return { ok: false, error: 'MJU SSO state ไม่ตรงกัน กรุณาเริ่มเข้าสู่ระบบใหม่' };
    }

    const token = params.get(MJU_SSO_TOKEN_PARAM) || params.get('firebaseToken') || params.get('customToken');
    if (!token) {
        return { ok: false, error: 'ไม่พบ Firebase custom token จาก MJU SSO bridge' };
    }

    return {
        ok: true,
        token,
        returnTo: sessionStorage.getItem(SSO_RETURN_KEY) || '/dashboard',
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
