const ALERT_API_URL = import.meta.env.VITE_MJU_ALERT_API_URL || '';

const VALID_SEVERITIES = new Set(['critical', 'warning', 'info']);

export const ALERT_SOURCE_META = {
    local_students: { label: 'ข้อมูลนักศึกษาในระบบ', mode: 'live' },
    graduation: { label: 'ข้อมูลสำเร็จการศึกษา', mode: 'local' },
    budget: { label: 'ข้อมูลงบประมาณ', mode: 'local' },
    research: { label: 'ข้อมูลงานวิจัย', mode: 'local' },
    strategic: { label: 'ข้อมูลยุทธศาสตร์/OKR', mode: 'local' },
    mju_api: { label: 'MJU API', mode: 'external' },
};

function normalizeSeverity(value) {
    const severity = String(value || '').toLowerCase();
    return VALID_SEVERITIES.has(severity) ? severity : 'info';
}

export function normalizeExternalAlert(raw = {}) {
    return {
        id: raw.id || raw.alertId || `mju-api-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        severity: normalizeSeverity(raw.severity || raw.level),
        domain: raw.domain || raw.category || 'MJU API',
        title: raw.title || raw.name || 'แจ้งเตือนจาก API',
        detail: raw.detail || raw.description || raw.message || '',
        metric: raw.metric || raw.indicator || '',
        value: raw.value ?? raw.current ?? '',
        target: raw.target ?? null,
        suggestedAction: raw.suggestedAction || raw.action || '',
        data: Array.isArray(raw.data) ? raw.data : [],
        source: 'mju_api',
        sourceLabel: ALERT_SOURCE_META.mju_api.label,
        updatedAt: raw.updatedAt || raw.timestamp || new Date().toISOString(),
    };
}

export async function fetchUniversityAlerts(filters = {}) {
    if (!ALERT_API_URL) {
        return { alerts: [], source: 'disabled', message: 'VITE_MJU_ALERT_API_URL is not configured.' };
    }

    const url = new URL(ALERT_API_URL);
    Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') url.searchParams.set(key, value);
    });

    const response = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
        throw new Error(`MJU Alert API ${response.status}`);
    }

    const payload = await response.json();
    const rawAlerts = Array.isArray(payload) ? payload : payload.alerts || payload.data || [];
    return {
        alerts: rawAlerts.map(normalizeExternalAlert),
        source: 'mju_api',
        message: payload.message || '',
    };
}

export function getAlertApiStatus() {
    return {
        configured: Boolean(ALERT_API_URL),
        url: ALERT_API_URL ? new URL(ALERT_API_URL).origin : '',
    };
}
