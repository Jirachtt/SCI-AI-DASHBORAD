import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
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
import { tcasPlanningData } from '../data/tcasAdmissionsData';
import { courseAnalyticsData } from '../data/courseAnalyticsData';
import { applyOfficialStudentSnapshot } from '../data/mjuOfficialStudentSnapshot';
import { mergeDatasetAndReportFallback } from '../utils/datasetFallback';

const SYNC_ENDPOINT = import.meta.env.VITE_MJU_SYNC_ENDPOINT || '/api/mju-dashboard-sync';
const ADMIN_SYNC_ENDPOINT = import.meta.env.VITE_MJU_ADMIN_SYNC_ENDPOINT || '/api/admin-dashboard-sync';
const AUTO_SYNC_ENABLED = String(import.meta.env.VITE_MJU_AUTO_SYNC || '').toLowerCase() === 'true';
const AUTO_SYNC_INTERVAL_MINUTES = Math.max(5, Number(import.meta.env.VITE_MJU_SYNC_INTERVAL_MINUTES || 15));
const LAST_SYNC_KEY = 'sci-ai-dashboard:last-mju-auto-sync';

export const DASHBOARD_DATASETS = [
    {
        id: 'dashboard_summary',
        label: 'Overview Dashboard',
        section: 'dashboard',
        source: 'https://dashboard.mju.ac.th/student',
        syncMode: 'public',
    },
    {
        id: 'student_stats',
        label: 'Student Statistics',
        section: 'student_stats',
        source: 'https://dashboard.mju.ac.th/student',
        syncMode: 'public',
    },
    {
        id: 'tcas_admissions',
        label: 'TCAS Admissions',
        section: 'tcas_admissions',
        source: 'MJU Admissions/Reg export + https://admissions.mju.ac.th',
        syncMode: 'api',
    },
    {
        id: 'course_analytics',
        label: 'Course & Grade Analytics',
        section: 'course_analytics',
        source: 'MJU Reg course/grade export (requires official API or CSV)',
        syncMode: 'api',
    },
    {
        id: 'university_budget',
        label: 'University Budget',
        section: 'budget_forecast',
        source: 'MJU finance/API endpoint (requires MJU Passport/API token)',
        syncMode: 'api',
    },
    {
        id: 'science_budget',
        label: 'Faculty Budget',
        section: 'budget_forecast',
        source: 'Excel extract: คำนวณประมาณการปี 70_Ver5.xlsx',
        syncMode: 'file',
    },
    {
        id: 'financial',
        label: 'Financial',
        section: 'financial',
        source: 'Excel extract: ประมาณการรายรับ-จ่าย + คำนวณประมาณการปี 70',
        syncMode: 'file',
    },
    {
        id: 'tuition',
        label: 'Tuition',
        section: 'tuition',
        source: 'Excel extract: คำนวณประมาณการปี 70_Ver5.xlsx',
        syncMode: 'file',
    },
    {
        id: 'student_life',
        label: 'Science Activities',
        section: 'student_life',
        source: 'Faculty of Science activity calendar/API endpoint (requires official API)',
        syncMode: 'api',
    },
    {
        id: 'graduation',
        label: 'Graduation',
        section: 'graduation_stats',
        source: 'MJU Reg/Graduation export or authorized API endpoint',
        syncMode: 'api',
    },
    {
        id: 'hr',
        label: 'HR Dashboard',
        section: 'hr_overview',
        source: 'https://dashboard.mju.ac.th/homeDashboard?&dep=20300',
        syncMode: 'public',
    },
    {
        id: 'research',
        label: 'Research Dashboard',
        section: 'research_overview',
        source: 'https://dashboard.mju.ac.th/homeDashboard?&dep=20300',
        syncMode: 'public',
    },
    {
        id: 'strategic',
        label: 'Strategic / OKR',
        section: 'strategic_overview',
        source: 'Excel extract: คำรับรอง 2569 + แผนพัฒนาส่วนงาน',
        syncMode: 'file',
    },
];

const FALLBACK_DATA = {
    dashboard_summary: dashboardSummary,
    student_stats: studentStatsData,
    tcas_admissions: tcasPlanningData,
    course_analytics: courseAnalyticsData,
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

function fallbackDataset(id) {
    return applyOfficialStudentSnapshot(id, FALLBACK_DATA[id]);
}

const REQUIRED_SHAPES = {
    dashboard_summary: payload => Array.isArray(payload?.faculties),
    student_stats: payload => payload?.current && Array.isArray(payload?.byFaculty),
    tcas_admissions: payload => Array.isArray(payload?.fiveYearTrend) && Array.isArray(payload?.round3Plan2569),
    course_analytics: payload => Array.isArray(payload?.coursePlanByYear) && Array.isArray(payload?.gradeDistributions),
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
    const fallback = fallbackDataset(id);
    if (!payload || Array.isArray(payload) || typeof payload !== 'object') return payload;
    if (!fallback || Array.isArray(fallback) || typeof fallback !== 'object') return payload;

    const { data: merged } = mergeDatasetAndReportFallback(fallback, payload);
    if (id === 'dashboard_summary' && Array.isArray(payload.faculties) && payload.faculties.length > 0 && Array.isArray(fallback.faculties)) {
        merged.faculties = payload.faculties.map(faculty => {
            const matchedFallback = fallback.faculties.find(item =>
                String(item.name || '').includes(String(faculty.name || '').replace(/^คณะ/, '')) ||
                String(faculty.name || '').includes(String(item.name || '').replace(/^คณะ/, ''))
            );
            return { ...(matchedFallback || {}), ...faculty };
        });
    }
    return applyOfficialStudentSnapshot(id, merged);
}

function displayPayloadForDocument(id, rawPayload) {
    return mergePayloadWithFallback(id, rawPayload);
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
    if (Array.isArray(payload?.fiveYearTrend)) return payload.fiveYearTrend.length;
    if (Array.isArray(payload?.coursePlanByYear)) return payload.coursePlanByYear.length;
    if (Array.isArray(payload?.yearly)) return payload.yearly.length;
    if (Array.isArray(payload?.history)) return payload.history.length;
    if (Array.isArray(payload?.publicationTrend)) return payload.publicationTrend.length;
    if (Array.isArray(payload?.scienceFaculty?.byType)) return payload.scienceFaculty.byType.length;
    return null;
}

function applyDatasetSnapshot(id, snap) {
    const fallback = fallbackDataset(id);
    if (!snap?.exists?.()) {
        _cache.set(id, fallback);
        _liveCache.delete(id);
        _meta.set(id, { id, sourceType: 'fallback', isLive: false });
        return;
    }

    const data = snap.data();
    const incomingUpdatedAt = readTimestamp(data.updatedAt);
    const rawPayload = normalizeDocPayload(data);
    const payload = displayPayloadForDocument(id, rawPayload);
    const fallbackFields = rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload)
        ? mergeDatasetAndReportFallback(fallback, rawPayload).fallbackFields
        : [];
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
    const validation = data.syncMeta?.validation || null;
    const requiresSourceValidation = /mju_public|mju_api|mju_sync|official_sync|dashboard_sync/i.test(sourceType);
    const isLiveSource = !/fallback|mock|static|demo|sample/i.test(sourceType)
        && (!requiresSourceValidation || validation?.valid === true);
    if (isLiveSource) _liveCache.set(id, rawPayload || payload);
    else _liveCache.delete(id);
    _meta.set(id, {
        id,
        label: datasetConfig(id)?.label || id,
        sourceType,
        sourceUrl: data.sourceUrl || null,
        updatedAt: incomingUpdatedAt,
        updatedBy: data.updatedBy || null,
        rowCount: data.rowCount ?? getRowCount(payload),
        version: data.version || 1,
        isLive: isLiveSource,
        syncMeta: data.syncMeta || null,
        validation,
        sourceEvidence: data.sourceEvidence || [],
        sourceUrls: data.sourceUrls || [],
        fallbackFields,
        fallbackFieldCount: fallbackFields.length,
        usesFallbackCoverage: fallbackFields.length > 0,
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

async function readJsonResponse(response) {
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = result?.message || result?.error || `MJU sync failed with HTTP ${response.status}`;
        const error = new Error(message);
        error.code = result?.error || result?.code || 'MJU_SYNC_FAILED';
        error.details = result;
        throw error;
    }
    return result;
}

export async function getDashboardSyncCapabilities() {
    const url = new URL(SYNC_ENDPOINT, window.location.origin);
    url.searchParams.set('status', '1');
    try {
        const result = await readJsonResponse(await fetch(url.toString(), {
            headers: { Accept: 'application/json' },
            cache: 'no-store',
        }));
        return Array.isArray(result.datasets) ? result.datasets : [];
    } catch (error) {
        console.warn('[dashboardLiveDataService] Unable to read server sync capabilities:', error?.message || error);
        return DASHBOARD_DATASETS.map(item => ({
            dataset: item.id,
            configured: item.syncMode === 'public',
            syncMode: item.syncMode,
            adapter: item.syncMode === 'public' ? 'mju_public_html' : 'unconfigured',
            sourceUrl: item.syncMode === 'public' ? item.source : '',
            envKey: `MJU_DASHBOARD_SOURCE_${item.id.toUpperCase()}`,
            statusUnavailable: true,
        }));
    }
}

async function requestServerDashboardSync(datasets) {
    const currentUser = auth?.currentUser;
    if (!currentUser) {
        const error = new Error('กรุณาเข้าสู่ระบบอีกครั้งก่อน Sync ข้อมูล');
        error.code = 'AUTH_REQUIRED';
        throw error;
    }
    const idToken = await currentUser.getIdToken();
    const response = await fetch(ADMIN_SYNC_ENDPOINT, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ datasets }),
    });
    return readJsonResponse(response);
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
                    _cache.set(id, fallbackDataset(id));
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
            _cache.set(id, fallbackDataset(id));
            _liveCache.delete(id);
            _meta.set(id, { id, sourceType: 'fallback', isLive: false, error: err?.message || String(err) });
            settle();
        }
    });
}

export function getDashboardDatasetSync(id) {
    return _cache.get(id) || fallbackDataset(id) || null;
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
        rowCount: getRowCount(fallbackDataset(id)),
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
    const displayPayload = displayPayloadForDocument(id, rawPayload, { sourceType, syncMeta: meta });
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
        isLive: !/mju_public|mju_api|mju_sync|official_sync|dashboard_sync/i.test(sourceType)
            || meta?.validation?.valid === true,
        syncMeta: meta,
        validation: meta?.validation || null,
        sourceEvidence: meta?.sourceEvidence || [],
        sourceUrls: meta?.sourceUrls || [],
    });
    notify(id);
    return getDashboardDatasetMetaSync(id);
}

export async function refreshDashboardDatasetsFromSources(ids = 'all', { uid, who } = {}) {
    const requested = ids === 'all' ? 'all' : (Array.isArray(ids) ? ids : [ids]);
    const result = await requestServerDashboardSync(requested);
    const syncedIds = (result.datasets || []).map(item => item.dataset).filter(Boolean);

    await Promise.all(syncedIds.map(id => getDashboardDatasetMeta(id)));

    if (syncedIds.some(id => id === 'student_stats' || id === 'dashboard_summary')) {
        try {
            const { reconcileGeneratedRosterWithLatestOfficialTotal } = await import('./studentDataService');
            await reconcileGeneratedRosterWithLatestOfficialTotal({
                uid,
                who,
                reason: `sync:${syncedIds.join(',')}`,
            });
        } catch (err) {
            console.warn('[dashboardLiveDataService] Student roster reconciliation skipped:', err?.message || err);
        }
    }

    return {
        ...result,
        metas: Object.fromEntries(syncedIds.map(id => [id, getDashboardDatasetMetaSync(id)])),
    };
}

export async function refreshDashboardDatasetFromSource(id, options = {}) {
    const result = await refreshDashboardDatasetsFromSources([id], options);
    return result.metas?.[id] || getDashboardDatasetMetaSync(id);
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
        const capabilities = await getDashboardSyncCapabilities();
        const configured = new Set(capabilities.filter(item => item.configured).map(item => item.dataset));
        const due = DASHBOARD_DATASETS
            .map(item => item.id)
            .filter(id => configured.has(id))
            .filter(id => !last[id] || now - last[id] >= intervalMs);

        if (!cancelled && due.length > 0) {
            try {
                await refreshDashboardDatasetsFromSources(due, { uid, who });
                const completedAt = Date.now();
                due.forEach(id => { last[id] = completedAt; });
                writeLastSyncMap(last);
            } catch (err) {
                console.warn('[dashboardLiveDataService] Atomic auto sync skipped:', err?.message || err);
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
