import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
    dashboardSummary,
    financialData,
    scienceFacultyBudgetData,
    studentLifeData,
    studentStatsData,
    tuitionData,
    universityBudgetData,
} from '../data/mockData';
import {
    currentGraduationStats,
    graduationByMajor,
    graduationHistory,
    gpaDistribution,
    honorsData,
} from '../data/graduationData';
import { hrData } from '../data/hrData';
import { researchData } from '../data/researchData';
import { strategicData } from '../data/strategicData';

const SYNC_ENDPOINT = import.meta.env.VITE_MJU_SYNC_ENDPOINT || '/api/mju-dashboard-sync';
const AUTO_SYNC_ENABLED = String(import.meta.env.VITE_MJU_AUTO_SYNC || '').toLowerCase() === 'true';
const AUTO_SYNC_INTERVAL_MINUTES = Math.max(5, Number(import.meta.env.VITE_MJU_SYNC_INTERVAL_MINUTES || 15));
const LAST_SYNC_KEY = 'sci-ai-dashboard:last-mju-auto-sync';

export const DASHBOARD_DATASETS = [
    {
        id: 'dashboard_summary',
        label: 'Overview Dashboard',
        section: 'dashboard',
        source: 'https://dashboard.mju.ac.th/',
    },
    {
        id: 'student_stats',
        label: 'Student Statistics',
        section: 'student_stats',
        source: 'https://dashboard.mju.ac.th/student',
    },
    {
        id: 'university_budget',
        label: 'University Budget',
        section: 'budget_forecast',
        source: 'MJU finance/API endpoint',
    },
    {
        id: 'science_budget',
        label: 'Faculty Budget',
        section: 'budget_forecast',
        source: 'MJU finance/API endpoint',
    },
    {
        id: 'financial',
        label: 'Financial',
        section: 'financial',
        source: 'MJU finance/API endpoint',
    },
    {
        id: 'tuition',
        label: 'Tuition',
        section: 'tuition',
        source: 'MJU registrar/API endpoint',
    },
    {
        id: 'student_life',
        label: 'Student Life',
        section: 'student_life',
        source: 'MJU student activity/API endpoint',
    },
    {
        id: 'graduation',
        label: 'Graduation',
        section: 'graduation_stats',
        source: 'MJU registrar/API endpoint',
    },
    {
        id: 'hr',
        label: 'HR Dashboard',
        section: 'hr_overview',
        source: 'MJU HR/API endpoint',
    },
    {
        id: 'research',
        label: 'Research Dashboard',
        section: 'research_overview',
        source: 'https://dashboard.mju.ac.th/scopusList?dep=20300-20300',
    },
    {
        id: 'strategic',
        label: 'Strategic / OKR',
        section: 'strategic_overview',
        source: 'MJU strategic/API endpoint',
    },
];

const FALLBACK_DATA = {
    dashboard_summary: dashboardSummary,
    student_stats: studentStatsData,
    university_budget: universityBudgetData,
    science_budget: scienceFacultyBudgetData,
    financial: financialData,
    tuition: tuitionData,
    student_life: studentLifeData,
    graduation: {
        history: graduationHistory,
        current: currentGraduationStats,
        byMajor: graduationByMajor,
        honors: honorsData,
        gpaDistribution,
    },
    hr: hrData,
    research: researchData,
    strategic: strategicData,
};

const REQUIRED_SHAPES = {
    dashboard_summary: payload => Array.isArray(payload?.faculties),
    student_stats: payload => payload?.current && Array.isArray(payload?.byFaculty),
    university_budget: payload => Array.isArray(payload?.yearly),
    science_budget: payload => Array.isArray(payload?.yearly),
    financial: payload => payload?.tuitionStatus || payload?.facultyBudget,
    tuition: payload => payload?.flatRate && Array.isArray(payload?.byFaculty),
    student_life: payload => payload?.activityHours && payload?.behaviorScore,
    graduation: payload => Array.isArray(payload?.history) || Array.isArray(payload?.graduationHistory),
    hr: payload => payload?.scienceFaculty,
    research: payload => payload?.overview || Array.isArray(payload?.publicationTrend),
    strategic: payload => payload?.strategicGoals || payload?.okr,
};

const _cache = new Map();
const _liveCache = new Map();
const _meta = new Map();
const _unsubscribe = new Map();
const _listeners = new Set();
let _autoSyncStop = null;

function datasetDocRef(id) {
    return doc(db, 'datasets', id);
}

function datasetConfig(id) {
    return DASHBOARD_DATASETS.find(item => item.id === id);
}

function isCompatiblePayload(id, payload) {
    if (!payload || typeof payload !== 'object') return false;
    const guard = REQUIRED_SHAPES[id];
    return guard ? Boolean(guard(payload)) : true;
}

function mergePayloadWithFallback(id, payload) {
    const fallback = FALLBACK_DATA[id];
    if (!payload || Array.isArray(payload) || typeof payload !== 'object') return payload;
    if (!fallback || Array.isArray(fallback) || typeof fallback !== 'object') return payload;

    const merged = { ...fallback, ...payload };
    if (id === 'dashboard_summary' && Array.isArray(payload.faculties) && Array.isArray(fallback.faculties)) {
        merged.faculties = payload.faculties.map(faculty => {
            const matchedFallback = fallback.faculties.find(item =>
                String(item.name || '').includes(String(faculty.name || '').replace(/^คณะ/, '')) ||
                String(faculty.name || '').includes(String(item.name || '').replace(/^คณะ/, ''))
            );
            return { ...(matchedFallback || {}), ...faculty };
        });
    }
    for (const [key, value] of Object.entries(payload)) {
        if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            fallback[key] &&
            typeof fallback[key] === 'object' &&
            !Array.isArray(fallback[key])
        ) {
            merged[key] = { ...fallback[key], ...value };
        }
    }
    return merged;
}

function normalizeDocPayload(data) {
    if (!data) return null;
    if (data.payload && typeof data.payload === 'object') return data.payload;
    if (Array.isArray(data.rows)) return data.rows;
    return null;
}

function readTimestamp(value) {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    if (value.seconds) return new Date(value.seconds * 1000);
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

function getRowCount(payload) {
    if (Array.isArray(payload)) return payload.length;
    if (Array.isArray(payload?.rows)) return payload.rows.length;
    if (Array.isArray(payload?.faculties)) return payload.faculties.length;
    if (Array.isArray(payload?.byFaculty)) return payload.byFaculty.length;
    if (Array.isArray(payload?.yearly)) return payload.yearly.length;
    if (Array.isArray(payload?.history)) return payload.history.length;
    if (Array.isArray(payload?.publicationTrend)) return payload.publicationTrend.length;
    return null;
}

function applyDatasetSnapshot(id, snap) {
    const fallback = FALLBACK_DATA[id];
    if (!snap?.exists?.()) {
        _cache.set(id, fallback);
        _liveCache.delete(id);
        _meta.set(id, { id, sourceType: 'fallback', isLive: false });
        return;
    }

    const data = snap.data();
    const rawPayload = normalizeDocPayload(data);
    const payload = mergePayloadWithFallback(id, rawPayload);
    if (!isCompatiblePayload(id, payload)) {
        console.warn(`[dashboardLiveDataService] Ignoring incompatible payload for ${id}`);
        _cache.set(id, fallback);
        _liveCache.delete(id);
        _meta.set(id, {
            id,
            sourceType: 'fallback',
            isLive: false,
            invalidLivePayload: true,
            updatedAt: readTimestamp(data.updatedAt),
            sourceUrl: data.sourceUrl || null,
        });
        return;
    }

    _cache.set(id, payload);
    const sourceType = data.sourceType || data.lastWriteSource || 'firestore';
    const isLiveSource = !/fallback|mock|static|demo|sample/i.test(sourceType);
    if (isLiveSource) _liveCache.set(id, rawPayload || payload);
    else _liveCache.delete(id);
    _meta.set(id, {
        id,
        label: datasetConfig(id)?.label || id,
        sourceType,
        sourceUrl: data.sourceUrl || null,
        updatedAt: readTimestamp(data.updatedAt),
        updatedBy: data.updatedBy || null,
        rowCount: data.rowCount ?? getRowCount(payload),
        version: data.version || 1,
        isLive: isLiveSource,
    });
}

function notify(id) {
    for (const cb of _listeners) {
        try {
            cb({ id, payload: getDashboardDatasetSync(id), meta: getDashboardDatasetMetaSync(id) });
        } catch (err) {
            console.error('[dashboardLiveDataService] listener error:', err);
        }
    }
}

function startDatasetListener(id) {
    if (!db || _unsubscribe.has(id)) return Promise.resolve(getDashboardDatasetSync(id));

    return new Promise(resolve => {
        let settled = false;
        const settle = () => {
            if (!settled) {
                settled = true;
                resolve(getDashboardDatasetSync(id));
            }
        };

        try {
            const unsub = onSnapshot(
                datasetDocRef(id),
                snap => {
                    const wasSettled = settled;
                    applyDatasetSnapshot(id, snap);
                    settle();
                    if (wasSettled) notify(id);
                },
                err => {
                    console.warn(`[dashboardLiveDataService] Firestore listener failed for ${id}:`, err?.message || err);
                    _cache.set(id, FALLBACK_DATA[id]);
                    _liveCache.delete(id);
                    _meta.set(id, { id, sourceType: 'fallback', isLive: false, error: err?.message || String(err) });
                    _unsubscribe.delete(id);
                    settle();
                    notify(id);
                }
            );
            _unsubscribe.set(id, unsub);
        } catch (err) {
            console.warn(`[dashboardLiveDataService] Listener setup failed for ${id}:`, err?.message || err);
            _cache.set(id, FALLBACK_DATA[id]);
            _liveCache.delete(id);
            _meta.set(id, { id, sourceType: 'fallback', isLive: false, error: err?.message || String(err) });
            settle();
        }
    });
}

export function getDashboardDatasetSync(id) {
    return _cache.get(id) || FALLBACK_DATA[id] || null;
}

export function isDashboardDatasetLiveSync(id) {
    return Boolean(getDashboardDatasetMetaSync(id).isLive);
}

export function getLiveDashboardDatasetSync(id) {
    return isDashboardDatasetLiveSync(id) ? (_liveCache.get(id) || null) : null;
}

export function getDashboardDatasetMetaSync(id) {
    return _meta.get(id) || {
        id,
        label: datasetConfig(id)?.label || id,
        sourceType: 'fallback',
        sourceUrl: datasetConfig(id)?.source || null,
        rowCount: getRowCount(FALLBACK_DATA[id]),
        isLive: false,
    };
}

export async function ensureDashboardLiveData(ids = DASHBOARD_DATASETS.map(item => item.id)) {
    const list = Array.isArray(ids) ? ids : [ids];
    await Promise.all(list.map(id => startDatasetListener(id)));
    return Object.fromEntries(list.map(id => [id, getDashboardDatasetSync(id)]));
}

export function onDashboardLiveDataChange(callback) {
    _listeners.add(callback);
    return () => _listeners.delete(callback);
}

export async function getDashboardDatasetMeta(id) {
    if (!db) return getDashboardDatasetMetaSync(id);
    try {
        const snap = await getDoc(datasetDocRef(id));
        applyDatasetSnapshot(id, snap);
        return getDashboardDatasetMetaSync(id);
    } catch (err) {
        return { ...getDashboardDatasetMetaSync(id), error: err?.message || String(err) };
    }
}

export async function saveDashboardDataset(id, payload, { uid, who, sourceUrl, sourceType = 'mju_sync', meta = {} } = {}) {
    const rawPayload = payload;
    const displayPayload = mergePayloadWithFallback(id, rawPayload);
    if (!isCompatiblePayload(id, displayPayload)) {
        throw new Error(`Payload for ${id} does not match the dashboard schema.`);
    }
    if (!db) throw new Error('Firestore is not configured.');

    const rowCount = getRowCount(rawPayload) ?? getRowCount(displayPayload);
    await setDoc(datasetDocRef(id), {
        payload: rawPayload,
        rowCount,
        sourceType,
        sourceUrl: sourceUrl || datasetConfig(id)?.source || null,
        updatedAt: serverTimestamp(),
        updatedBy: who || uid || 'mju-sync',
        version: 1,
        syncMeta: meta,
    }, { merge: true });

    _cache.set(id, displayPayload);
    _liveCache.set(id, rawPayload);
    _meta.set(id, {
        id,
        label: datasetConfig(id)?.label || id,
        sourceType,
        sourceUrl: sourceUrl || datasetConfig(id)?.source || null,
        updatedAt: new Date(),
        updatedBy: who || uid || 'mju-sync',
        rowCount,
        version: 1,
        isLive: true,
    });
    notify(id);
    return getDashboardDatasetMetaSync(id);
}

export async function refreshDashboardDatasetFromSource(id, { uid, who } = {}) {
    const url = new URL(SYNC_ENDPOINT, window.location.origin);
    url.searchParams.set('dataset', id);

    const response = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(result?.error || `MJU sync failed with HTTP ${response.status}`);
    }

    const payload = result.payload || result.data;
    await saveDashboardDataset(id, payload, {
        uid,
        who,
        sourceUrl: result.sourceUrl || datasetConfig(id)?.source,
        sourceType: result.sourceType || 'mju_sync',
        meta: {
            fetchedAt: result.fetchedAt || new Date().toISOString(),
            adapter: result.adapter || 'json',
        },
    });

    return getDashboardDatasetMetaSync(id);
}

function readLastSyncMap() {
    try {
        return JSON.parse(localStorage.getItem(LAST_SYNC_KEY) || '{}');
    } catch {
        return {};
    }
}

function writeLastSyncMap(value) {
    try {
        localStorage.setItem(LAST_SYNC_KEY, JSON.stringify(value));
    } catch {
        // Ignore storage errors; realtime listeners still work.
    }
}

export function startDashboardAutoSync({ uid, who, role } = {}) {
    if (_autoSyncStop) return _autoSyncStop;
    if (!AUTO_SYNC_ENABLED || role !== 'dean') return () => {};

    const intervalMs = AUTO_SYNC_INTERVAL_MINUTES * 60 * 1000;
    let cancelled = false;

    async function runOnce() {
        const last = readLastSyncMap();
        const now = Date.now();
        const due = DASHBOARD_DATASETS
            .filter(item => item.id !== 'students')
            .filter(item => !last[item.id] || now - last[item.id] >= intervalMs);

        for (const item of due) {
            if (cancelled) return;
            try {
                await refreshDashboardDatasetFromSource(item.id, { uid, who });
                last[item.id] = Date.now();
                writeLastSyncMap(last);
            } catch (err) {
                console.warn(`[dashboardLiveDataService] Auto sync skipped for ${item.id}:`, err?.message || err);
            }
        }
    }

    runOnce();
    const timer = window.setInterval(runOnce, intervalMs);
    _autoSyncStop = () => {
        cancelled = true;
        window.clearInterval(timer);
        _autoSyncStop = null;
    };
    return _autoSyncStop;
}

export function getDashboardFreshnessContext() {
    return DASHBOARD_DATASETS.map(item => {
        const meta = getDashboardDatasetMetaSync(item.id);
        const updated = meta.updatedAt ? meta.updatedAt.toLocaleString('th-TH') : 'fallback';
        const status = meta.isLive ? 'live' : 'fallback';
        return `${item.id}: ${status}, updated=${updated}, source=${meta.sourceUrl || item.source}`;
    }).join('\n');
}
