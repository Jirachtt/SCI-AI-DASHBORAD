// Live student-data loader with Firestore persistence and mock fallback.
//
// Data model (Firestore):
//   collection: datasets
//   document:   students
//   fields:
//     rows:       Array<StudentRow>   — authoritative list
//     rowCount:   number
//     fileName:   string              — original upload filename
//     updatedAt:  serverTimestamp
//     updatedBy:  string (uid)        — admin who uploaded
//     version:    number              — schema version (currently 1)
//     allowSmallDataset: boolean       — true for intentional demo/test uploads
//
// Callers use:
//   ensureStudentList()    — async, attaches realtime listener; returns live list (or mock)
//   getStudentListSync()   — synchronous accessor (returns cached live/mock data); safe anywhere
//   uploadStudentList()    — admin writes new dataset
//   getStudentListMeta()   — lightweight metadata fetch for admin panel
//   onStudentDataChange()  — subscribe to realtime student-data updates
//   addStudent()           — persist a single manually added student (Firestore when possible)
//   removeStudent()        — remove a manually added student by ID
//   syncManualStudentsToRemote() — migrate old local-only manual rows to Firestore

import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { generateScienceMockRoster, scienceStudentList } from '../data/studentListData.js';
import { writeAuditLog } from './auditLogService';

const DOC_PATH = ['datasets', 'students'];
const MANUAL_STUDENTS_KEY = 'sci_dashboard_manual_students';
const DEMO_DATASET_KEY = 'sci_dashboard_demo_student_dataset';
const MIN_TRUSTED_LIVE_ROWS = 1000;
const STALE_GENERATED_ROW_COUNTS = new Set([1383, 1390, 1398, 1399, 1451, 1452, 1528]);

let _cache = null;
let _isLive = false;           // true once Firestore has returned a valid dataset
let _usesLocalOnlyData = false;
let _sourceMeta = null;
let _loadPromise = null;
let _unsubscribeLive = null;
let _latestOfficialSnapshot = null;
const _listeners = new Set();

function toNumber(value, fallback = 0) {
    if (value == null || value === '') return fallback;
    const n = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(n) ? n : fallback;
}

function readTimestamp(value) {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    if (value.seconds) return new Date(value.seconds * 1000);
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

// ─── Manual Students (localStorage) ───
function loadManualStudents() {
    try {
        const raw = localStorage.getItem(MANUAL_STUDENTS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveManualStudents(list) {
    try {
        localStorage.setItem(MANUAL_STUDENTS_KEY, JSON.stringify(list));
    } catch (e) {
        console.warn('[studentDataService] localStorage save failed:', e);
    }
}

function upsertStudent(rows, student) {
    const list = Array.isArray(rows) ? rows : [];
    const next = list.filter(s => s.id !== student.id);
    next.push(student);
    return next;
}

function removeStudentFromRows(rows, studentId) {
    return (Array.isArray(rows) ? rows : []).filter(s => s.id !== studentId);
}

function removeManualStudent(studentId) {
    saveManualStudents(loadManualStudents().filter(s => s.id !== studentId));
}

function isBypassUid(uid) {
    return String(uid || '').startsWith('admin-bypass-');
}

function loadDemoDataset() {
    try {
        const raw = localStorage.getItem(DEMO_DATASET_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function isGeneratedMockSource(data = {}) {
    const sourceTrust = String(data.sourceTrust || data.trustLevel || '').toLowerCase();
    const lastWriteSource = String(data.lastWriteSource || data.sourceType || '').toLowerCase();
    const fileName = String(data.fileName || '').toLowerCase();
    return sourceTrust === 'generated_mock'
        || sourceTrust === 'manual_adjusted_mock'
        || sourceTrust === 'sample'
        || lastWriteSource === 'generated_mock'
        || lastWriteSource === 'generated_mock_reconcile'
        || lastWriteSource === 'sample'
        || /sample|generated|mock|demo/.test(fileName);
}

function isManualAdjustedMockSource(data = {}) {
    const sourceTrust = String(data.sourceTrust || data.trustLevel || '').toLowerCase();
    const lastWriteSource = String(data.lastWriteSource || data.sourceType || '').toLowerCase();
    return sourceTrust === 'manual_adjusted_mock'
        || (sourceTrust === 'generated_mock' && /manual/.test(lastWriteSource));
}

function setSourceMeta(data = {}, rows = [], overrides = {}) {
    _sourceMeta = {
        sourceTrust: data.sourceTrust || data.trustLevel || null,
        sourceLabel: data.sourceLabel || null,
        fileName: data.fileName || null,
        updatedAt: readTimestamp(data.updatedAt) || (typeof data.updatedAt === 'string' ? new Date(data.updatedAt) : null),
        updatedBy: data.updatedBy || null,
        rowCount: data.rowCount ?? (Array.isArray(rows) ? rows.length : 0),
        officialTotal: data.officialTotal ?? null,
        officialSourceLabel: data.officialSourceLabel || null,
        lastWriteSource: data.lastWriteSource || data.sourceType || null,
        lastManualAction: data.lastManualAction || null,
        ...overrides,
    };
}

function isStaleGeneratedDataset(data = {}, rows = []) {
    if (!Array.isArray(rows) || !STALE_GENERATED_ROW_COUNTS.has(rows.length)) return false;
    return isGeneratedMockSource(data) || !data.fileName;
}

function saveDemoDataset(payload) {
    try {
        localStorage.setItem(DEMO_DATASET_KEY, JSON.stringify(payload));
    } catch (e) {
        console.warn('[studentDataService] demo dataset save failed:', e);
    }
}

function findScienceFacultyRow(rows = []) {
    if (!Array.isArray(rows)) return null;
    return rows.find(row => String(row?.name || row?.faculty || '').includes('วิทยาศาสตร์')) || null;
}

function extractOfficialScienceFromStudentStats(data = {}) {
    const science = data.scienceFaculty || {};
    const facultyRow = findScienceFacultyRow(data.byFaculty);
    const total = toNumber(science.total, null) ?? toNumber(facultyRow?.total, null);
    if (!Number.isFinite(total)) return null;
    return {
        total,
        byLevel: Array.isArray(science.byLevel) ? science.byLevel : [],
        datasetId: 'student_stats',
        sourceLabel: 'MJU Dashboard: Student Statistics',
    };
}

function extractOfficialScienceFromDashboardSummary(data = {}) {
    const facultyRow = findScienceFacultyRow(data.faculties);
    const total = toNumber(facultyRow?.totalStudents ?? facultyRow?.total, null);
    if (!Number.isFinite(total)) return null;
    return {
        total,
        byLevel: Array.isArray(facultyRow?.byLevel) ? facultyRow.byLevel : [],
        datasetId: 'dashboard_summary',
        sourceLabel: 'MJU Dashboard: Overview',
    };
}

async function getLatestOfficialScienceStudentSnapshot() {
    const {
        getDashboardDatasetMetaSync,
        getDashboardDatasetSync,
    } = await import('./dashboardLiveDataService');
    const fromStudentStats = extractOfficialScienceFromStudentStats(getDashboardDatasetSync('student_stats') || {});
    const fromDashboard = extractOfficialScienceFromDashboardSummary(getDashboardDatasetSync('dashboard_summary') || {});
    const candidates = [fromStudentStats, fromDashboard]
        .filter(candidate => candidate?.total)
        .map(candidate => ({
            ...candidate,
            meta: getDashboardDatasetMetaSync(candidate.datasetId),
        }))
        .sort((a, b) => {
            const liveDelta = Number(Boolean(b.meta?.isLive)) - Number(Boolean(a.meta?.isLive));
            if (liveDelta) return liveDelta;
            const updatedDelta = (readTimestamp(b.meta?.updatedAt)?.getTime() || 0)
                - (readTimestamp(a.meta?.updatedAt)?.getTime() || 0);
            if (updatedDelta) return updatedDelta;
            return a.datasetId === 'student_stats' ? -1 : 1;
        });
    const official = candidates[0];
    if (!official) return null;
    const { meta = {}, ...officialData } = official;
    const snapshot = {
        ...officialData,
        total: Math.round(official.total),
        updatedAt: meta.updatedAt || null,
        sourceType: meta.sourceType || 'fallback',
        isLive: Boolean(meta.isLive),
    };
    _latestOfficialSnapshot = snapshot;
    return snapshot;
}

function isGeneratedRosterOutOfSync(data = {}, rows = []) {
    if (!isGeneratedMockSource(data) || !_latestOfficialSnapshot?.total) return false;
    // A manual adjustment is an intentional overlay on the last synced
    // baseline. Keep it until an explicit Sync writes a fresh generated roster.
    if (
        isManualAdjustedMockSource(data)
        && Number(data.officialTotal || 0) === _latestOfficialSnapshot.total
    ) {
        return false;
    }
    return rows.length !== _latestOfficialSnapshot.total
        || Number(data.officialTotal || 0) !== _latestOfficialSnapshot.total;
}

function shouldReplaceWithGeneratedRoster(data = {}, rows = []) {
    if (!Array.isArray(rows) || rows.length === 0) return true;
    if (isStaleGeneratedDataset(data, rows)) return true;
    if (isGeneratedMockSource(data)) return true;
    if (!_isLive && !_usesLocalOnlyData) return true;
    return false;
}

async function writeGeneratedRoster(rows, official, { uid, who, reason, persist = true } = {}) {
    const payload = {
        rows,
        rowCount: rows.length,
        fileName: 'generated-mock-roster-aligned-to-mju-sync.json',
        updatedBy: who || uid || 'mju-sync',
        version: 1,
        allowSmallDataset: true,
        sourceTrust: 'generated_mock',
        sourceLabel: 'Generated mock roster aligned to latest MJU sync',
        officialTotal: official.total,
        officialSourceLabel: official.sourceLabel,
        lastWriteSource: 'generated_mock_reconcile',
        reconcileReason: reason || 'mju_sync',
    };

    if (persist && db && !isBypassUid(uid)) {
        await setDoc(studentDocRef(), {
            ...payload,
            updatedAt: serverTimestamp(),
        }, { merge: true });
        _usesLocalOnlyData = false;
    } else if (persist) {
        const localPayload = {
            ...payload,
            updatedAt: new Date().toISOString(),
            updatedBy: uid || 'admin-bypass',
        };
        saveDemoDataset(localPayload);
        _usesLocalOnlyData = true;
    } else {
        // Read-only sessions still need every page to show the same count as
        // the latest synced Overview. Keep this alignment in memory and let an
        // authorized Sync action persist the generated roster centrally.
        payload.updatedAt = official.updatedAt || new Date().toISOString();
        payload.updatedBy = 'overview-reconcile';
        _usesLocalOnlyData = true;
    }

    _cache = rows;
    _isLive = true;
    setSourceMeta(payload, rows, {
        storage: persist && db && !isBypassUid(uid) ? 'firestore' : (persist ? 'local_demo' : 'memory_aligned'),
    });
    _loadPromise = Promise.resolve(getStudentListSync());
    notify();
}

export async function reconcileGeneratedRosterWithLatestOfficialTotal({
    uid,
    who,
    reason = 'mju_sync',
    force = false,
    persist = true,
} = {}) {
    const official = await getLatestOfficialScienceStudentSnapshot();
    if (!official?.total) {
        return { status: 'no_official_total', rowCount: getStudentListSync().length };
    }

    let data = _sourceMeta || {};
    let rows = getStudentListSync();
    if (persist && db && !isBypassUid(uid)) {
        try {
            const snap = await getDoc(studentDocRef());
            if (snap.exists()) {
                data = snap.data();
                rows = Array.isArray(data.rows) ? data.rows : rows;
            }
        } catch (err) {
            console.warn('[studentDataService] reconcile read failed, using cached rows:', err?.message || err);
        }
    } else if (persist) {
        const demo = loadDemoDataset();
        if (Array.isArray(demo?.rows)) {
            data = demo;
            rows = demo.rows;
        }
    }

    if (
        !persist
        && !force
        && isManualAdjustedMockSource(data)
        && Number(data.officialTotal || 0) === official.total
    ) {
        return {
            status: 'manual_overlay_preserved',
            rowCount: rows.length,
            officialTotal: official.total,
            difference: official.total - rows.length,
            persisted: false,
        };
    }

    if (
        !persist
        && !force
        && isGeneratedMockSource(data)
        && rows.length === official.total
        && Number(data.officialTotal || 0) === official.total
    ) {
        return {
            status: 'generated_roster_matches',
            rowCount: rows.length,
            officialTotal: official.total,
            difference: 0,
            persisted: false,
        };
    }

    if (!force && !shouldReplaceWithGeneratedRoster(data, rows)) {
        return {
            status: rows.length === official.total ? 'real_roster_matches' : 'real_roster_mismatch',
            rowCount: rows.length,
            officialTotal: official.total,
            difference: official.total - rows.length,
        };
    }

    const generated = generateScienceMockRoster({
        total: official.total,
        byLevel: official.byLevel,
    });
    await writeGeneratedRoster(generated, official, { uid, who, reason, persist });
    if (persist) {
        writeAuditLog({
            action: 'reconcile_generated_student_roster',
            who: who || uid || 'mju-sync',
            fileName: 'generated-mock-roster-aligned-to-mju-sync.json',
            rowCount: generated.length,
            version: 1,
            meta: {
                reason,
                officialTotal: official.total,
                officialSourceLabel: official.sourceLabel,
            },
        });
    }
    return {
        status: 'generated_roster_rebuilt',
        rowCount: generated.length,
        officialTotal: official.total,
        difference: 0,
        persisted: persist,
    };
}

/**
 * Align a generated/demo roster to the current Overview snapshot without
 * requiring write access. Uploaded/official rosters are never overwritten.
 */
export async function ensureStudentRosterAlignedWithOverview(options = {}) {
    return reconcileGeneratedRosterWithLatestOfficialTotal({
        ...options,
        persist: false,
        reason: options.reason || 'app_boot_overview_alignment',
    });
}

/**
 * Add a single student manually. Real signed-in dean sessions persist to
 * Firestore so every device receives the realtime update. Admin-bypass/demo
 * sessions keep the same behavior locally for presentation testing.
 */
export async function addStudent(student, { uid, who } = {}) {
    if (!student?.id) throw new Error('student.id is required');
    const wasGeneratedMock = isGeneratedMockSource(_sourceMeta || {}) || (!_isLive && !_usesLocalOnlyData);
    const nextSourceTrust = wasGeneratedMock ? 'manual_adjusted_mock' : 'manual_adjusted_roster';
    const official = await getLatestOfficialScienceStudentSnapshot().catch(() => null);

    if (db && !isBypassUid(uid)) {
        try {
            const rows = upsertStudent(await readAuthoritativeRows(), student);
            await persistRows(rows, {
                uid,
                source: 'manual_add',
                manualAction: 'add_student',
                manualStudentId: student.id,
                sourceTrust: nextSourceTrust,
                sourceLabel: wasGeneratedMock
                    ? 'Generated mock roster aligned to latest MJU sync + manual adjustment'
                    : 'Uploaded/Firestore roster + manual adjustment',
                officialTotal: official?.total ?? _sourceMeta?.officialTotal ?? null,
                officialSourceLabel: official?.sourceLabel || _sourceMeta?.officialSourceLabel || null,
            });
            removeManualStudent(student.id);
            _cache = rows;
            _isLive = true;
            _usesLocalOnlyData = false;
            setSourceMeta({
                ...(_sourceMeta || {}),
                sourceTrust: nextSourceTrust,
                sourceLabel: wasGeneratedMock
                    ? 'Generated mock roster aligned to latest MJU sync + manual adjustment'
                    : 'Uploaded/Firestore roster + manual adjustment',
                rowCount: rows.length,
                officialTotal: official?.total ?? _sourceMeta?.officialTotal ?? null,
                officialSourceLabel: official?.sourceLabel || _sourceMeta?.officialSourceLabel || null,
                lastWriteSource: 'manual_add',
                lastManualAction: 'add_student',
                updatedBy: uid || 'unknown',
            }, rows, { storage: 'firestore' });
            _loadPromise = Promise.resolve(getStudentListSync());
            notify();
            writeAuditLog({
                action: 'add_student',
                who: who || uid || 'unknown',
                fileName: 'manual-entry',
                rowCount: rows.length,
                version: 1,
                meta: { studentId: student.id },
            });
            return { rowCount: rows.length, scope: 'live' };
        } catch (err) {
            throw new Error('บันทึกนักศึกษาลงข้อมูลกลางไม่สำเร็จ: ' + (err?.message || 'unknown'));
        }
    }

    const rows = upsertStudent(getStudentListSync(), student);
    const payload = {
        rows,
        rowCount: rows.length,
        fileName: _sourceMeta?.fileName || 'local-manual-student-adjustment.json',
        updatedAt: new Date().toISOString(),
        updatedBy: uid || 'admin-bypass',
        version: 1,
        allowSmallDataset: true,
        sourceTrust: nextSourceTrust,
        sourceLabel: wasGeneratedMock
            ? 'Generated mock roster aligned to latest MJU sync + manual adjustment'
            : 'Local roster + manual adjustment',
        officialTotal: official?.total ?? _sourceMeta?.officialTotal ?? null,
        officialSourceLabel: official?.sourceLabel || _sourceMeta?.officialSourceLabel || null,
        lastWriteSource: 'manual_add',
        lastManualAction: 'add_student',
        lastManualStudentId: student.id,
    };
    saveDemoDataset(payload);
    _cache = rows;
    _isLive = true;
    _usesLocalOnlyData = true;
    setSourceMeta(payload, rows, { storage: 'local_demo' });
    _loadPromise = Promise.resolve(getStudentListSync());
    notify();
    return { rowCount: rows.length, scope: isBypassUid(uid) ? 'local_demo' : 'no_firebase' };
}

/**
 * Remove a student by ID from the shared dataset when possible.
 */
export async function removeStudent(studentId, { uid, who } = {}) {
    if (!studentId) throw new Error('studentId is required');

    if (db && !isBypassUid(uid)) {
        try {
            const rows = removeStudentFromRows(await readAuthoritativeRows(), studentId);
            await persistRows(rows, {
                uid,
                source: 'manual_remove',
                manualAction: 'remove_student',
                manualStudentId: studentId,
            });
            removeManualStudent(studentId);
            _cache = rows;
            _isLive = true;
            _usesLocalOnlyData = false;
            _loadPromise = Promise.resolve(getStudentListSync());
            notify();
            writeAuditLog({
                action: 'remove_student',
                who: who || uid || 'unknown',
                fileName: 'manual-entry',
                rowCount: rows.length,
                version: 1,
                meta: { studentId },
            });
            return { rowCount: rows.length, scope: 'live' };
        } catch (err) {
            throw new Error('ลบนักศึกษาจากข้อมูลกลางไม่สำเร็จ: ' + (err?.message || 'unknown'));
        }
    }

    notify();
    return { rowCount: getStudentListSync().length, scope: isBypassUid(uid) ? 'auth_required' : 'no_firebase' };
}

/**
 * Get all manually added students (for UI to distinguish them).
 */
export function getManualStudents() {
    return loadManualStudents();
}

export async function syncManualStudentsToRemote({ uid, who } = {}) {
    const manual = loadManualStudents();
    if (manual.length === 0) return { synced: 0, scope: 'none' };
    if (!db || isBypassUid(uid)) return { synced: 0, scope: isBypassUid(uid) ? 'local_demo' : 'no_firebase' };

    const rows = manual.reduce((acc, student) => upsertStudent(acc, student), await readAuthoritativeRows());
    await persistRows(rows, {
        uid,
        source: 'manual_migration',
        manualAction: 'migrate_local_students',
        manualStudentId: null,
    });
    saveManualStudents([]);
    _cache = rows;
    _isLive = true;
    _usesLocalOnlyData = false;
    _loadPromise = Promise.resolve(getStudentListSync());
    notify();
    writeAuditLog({
        action: 'migrate_local_students',
        who: who || uid || 'unknown',
        fileName: 'local-manual-students',
        rowCount: rows.length,
        version: 1,
        meta: { migratedRows: manual.length },
    });
    return { synced: manual.length, rowCount: rows.length, scope: 'live' };
}

// ─── Core data functions ───

function studentDocRef() {
    return doc(db, ...DOC_PATH);
}

function setBundledFallback() {
    const demo = loadDemoDataset();
    if (Array.isArray(demo?.rows) && demo.rows.length > 0) {
        if (isStaleGeneratedDataset(demo, demo.rows)) {
            console.warn(
                `[studentDataService] Ignoring stale local generated roster (${demo.rows.length} rows); ` +
                `using bundled ${scienceStudentList.length}-row generated mock.`
            );
        } else {
            _cache = demo.rows;
            _isLive = true;
            _usesLocalOnlyData = true;
            setSourceMeta(demo, demo.rows, { storage: 'local_demo' });
            return;
        }
    }
    _cache = scienceStudentList;
    _isLive = false;
    _usesLocalOnlyData = false;
    setSourceMeta({
        sourceTrust: 'generated_mock',
        sourceLabel: 'Generated mock roster bundled with app',
        fileName: 'bundled-generated-science-roster',
        lastWriteSource: 'bundled_sample',
    }, scienceStudentList, { storage: 'bundled' });
}

function isTrustedLiveRows(rows) {
    return Array.isArray(rows) && rows.length >= MIN_TRUSTED_LIVE_ROWS;
}

function applySnapshot(snap) {
    if (snap.exists()) {
        const data = snap.data();
        const rows = Array.isArray(data.rows) ? data.rows : [];
        if (isStaleGeneratedDataset(data, rows) || isGeneratedRosterOutOfSync(data, rows)) {
            console.warn(
                `[studentDataService] Ignoring stale generated Firestore roster (${rows.length} rows); ` +
                `keeping the roster aligned to the latest Overview total.`
            );
            if (_latestOfficialSnapshot?.total) {
                const generated = generateScienceMockRoster({
                    total: _latestOfficialSnapshot.total,
                    byLevel: _latestOfficialSnapshot.byLevel,
                });
                _cache = generated;
                _isLive = true;
                _usesLocalOnlyData = true;
                setSourceMeta({
                    sourceTrust: 'generated_mock',
                    sourceLabel: 'Generated mock roster aligned to latest MJU sync',
                    fileName: 'generated-mock-roster-aligned-to-mju-sync.json',
                    officialTotal: _latestOfficialSnapshot.total,
                    officialSourceLabel: _latestOfficialSnapshot.sourceLabel,
                    lastWriteSource: 'memory_overview_reconcile',
                    updatedAt: _latestOfficialSnapshot.updatedAt,
                }, generated, { storage: 'memory_aligned' });
            } else {
                setBundledFallback();
            }
            return;
        }
        if (isTrustedLiveRows(rows) || data.allowSmallDataset === true) {
            _cache = rows;
            _isLive = true;
            _usesLocalOnlyData = false;
            setSourceMeta(data, rows, { storage: 'firestore' });
            return;
        }
        if (rows.length > 0) {
            console.warn(
                `[studentDataService] Ignoring stale Firestore student dataset (${rows.length} rows); ` +
                `using bundled ${scienceStudentList.length}-row fallback until a complete upload arrives.`
            );
        }
    }
    setBundledFallback();
}

async function readAuthoritativeRows() {
    const snap = await getDoc(studentDocRef());
    if (snap.exists()) {
        const data = snap.data();
        const rows = Array.isArray(data.rows) ? data.rows : [];
        if (isStaleGeneratedDataset(data, rows) || isGeneratedRosterOutOfSync(data, rows)) {
            return _cache || scienceStudentList;
        }
        if (isTrustedLiveRows(rows) || data.allowSmallDataset === true) return rows;
    }
    return _cache || scienceStudentList;
}

async function persistRows(rows, {
    uid,
    source,
    manualAction,
    manualStudentId,
    sourceTrust,
    sourceLabel,
    officialTotal,
    officialSourceLabel,
} = {}) {
    await setDoc(studentDocRef(), {
        rows,
        rowCount: rows.length,
        updatedAt: serverTimestamp(),
        updatedBy: uid || 'unknown',
        version: 1,
        allowSmallDataset: true,
        sourceTrust: sourceTrust || _sourceMeta?.sourceTrust || null,
        sourceLabel: sourceLabel || _sourceMeta?.sourceLabel || null,
        officialTotal: officialTotal ?? _sourceMeta?.officialTotal ?? null,
        officialSourceLabel: officialSourceLabel || _sourceMeta?.officialSourceLabel || null,
        lastWriteSource: source || 'manual',
        lastManualAction: manualAction || null,
        lastManualStudentId: manualStudentId || null,
    }, { merge: true });
}

function startRealtimeSubscription() {
    if (_unsubscribeLive) return;

    _loadPromise = new Promise(resolve => {
        let settled = false;
        const settle = () => {
            if (!settled) {
                settled = true;
                resolve(getStudentListSync());
            }
        };

        try {
            _unsubscribeLive = onSnapshot(
                studentDocRef(),
                snap => {
                    const wasSettled = settled;
                    applySnapshot(snap);
                    settle();
                    if (wasSettled) notify();
                },
                err => {
                    console.warn('[studentDataService] Firestore realtime load failed, using mock:', err?.message || err);
                    setBundledFallback();
                    _unsubscribeLive = null;
                    settle();
                    _loadPromise = null;
                    notify();
                }
            );
        } catch (err) {
            console.warn('[studentDataService] Firestore listener setup failed, using mock:', err?.message || err);
            setBundledFallback();
            _unsubscribeLive = null;
            settle();
            _loadPromise = null;
        }
    });
}

function notify() {
    const all = getStudentListSync();
    for (const cb of _listeners) {
        try { cb(all); } catch (e) { console.error('[studentDataService] listener error', e); }
    }
}

export function getStudentListSync() {
    return _cache || scienceStudentList;
}

export function isLiveData() {
    return _isLive && !_usesLocalOnlyData;
}

export function getStudentDataSourceStatus() {
    const rows = getStudentListSync();
    if (isGeneratedMockSource(_sourceMeta || {})) {
        const manualAdjusted = isManualAdjustedMockSource(_sourceMeta || {});
        return {
            mode: manualAdjusted ? 'manual_adjusted_mock' : 'generated_mock',
            label: manualAdjusted
                ? 'Generated mock roster + manual adjustment'
                : 'Generated mock roster aligned to latest MJU sync',
            rowCount: rows.length,
            isUploaded: false,
            isShared: _isLive && !_usesLocalOnlyData,
            isBundledSample: true,
            isGeneratedMock: true,
            sourceTrust: _sourceMeta?.sourceTrust || 'generated_mock',
            sourceLabel: _sourceMeta?.sourceLabel || null,
            officialTotal: _sourceMeta?.officialTotal ?? null,
            officialSourceLabel: _sourceMeta?.officialSourceLabel || null,
        };
    }
    if (String(_sourceMeta?.sourceTrust || '').toLowerCase() === 'manual_adjusted_roster') {
        return {
            mode: 'manual_adjusted_roster',
            label: _usesLocalOnlyData ? 'Local roster + manual adjustment' : 'Firestore roster + manual adjustment',
            rowCount: rows.length,
            isUploaded: true,
            isShared: _isLive && !_usesLocalOnlyData,
            isBundledSample: false,
            isGeneratedMock: false,
            sourceTrust: _sourceMeta?.sourceTrust,
            sourceLabel: _sourceMeta?.sourceLabel || null,
            officialTotal: _sourceMeta?.officialTotal ?? null,
            officialSourceLabel: _sourceMeta?.officialSourceLabel || null,
        };
    }
    if (_isLive && !_usesLocalOnlyData) {
        return {
            mode: 'firestore',
            label: 'Live (Firestore)',
            rowCount: rows.length,
            isUploaded: true,
            isShared: true,
            isBundledSample: false,
            isGeneratedMock: false,
            sourceTrust: _sourceMeta?.sourceTrust || 'uploaded_file',
            sourceLabel: _sourceMeta?.sourceLabel || null,
            officialTotal: _sourceMeta?.officialTotal ?? null,
            officialSourceLabel: _sourceMeta?.officialSourceLabel || null,
        };
    }
    if (_isLive && _usesLocalOnlyData) {
        return {
            mode: 'local_upload',
            label: 'Local uploaded file',
            rowCount: rows.length,
            isUploaded: true,
            isShared: false,
            isBundledSample: false,
            isGeneratedMock: false,
            sourceTrust: _sourceMeta?.sourceTrust || 'uploaded_file',
            sourceLabel: _sourceMeta?.sourceLabel || null,
            officialTotal: _sourceMeta?.officialTotal ?? null,
            officialSourceLabel: _sourceMeta?.officialSourceLabel || null,
        };
    }
    return {
        mode: 'bundled_sample',
        label: 'Generated mock roster',
        rowCount: rows.length,
        isUploaded: false,
        isShared: false,
        isBundledSample: true,
        isGeneratedMock: true,
        sourceTrust: _sourceMeta?.sourceTrust || 'generated_mock',
        sourceLabel: _sourceMeta?.sourceLabel || null,
        officialTotal: _sourceMeta?.officialTotal ?? null,
        officialSourceLabel: _sourceMeta?.officialSourceLabel || null,
    };
}

export function getStudentRosterTrustStatus() {
    const source = getStudentDataSourceStatus();
    const canAnswerIndividual = Boolean(source.isUploaded && !source.isBundledSample);
    const canAnswerDemoIndividual = Boolean(source.isGeneratedMock && source.rowCount > 0);
    const canUseForChatRows = canAnswerIndividual || canAnswerDemoIndividual;
    const isOfficialRoster = source.mode === 'firestore';
    const isUserUploadedRoster = source.mode === 'local_upload';

    return {
        ...source,
        canAnswerIndividual,
        canAnswerDemoIndividual,
        canUseForChatRows,
        canUseForOfficialRoster: canAnswerIndividual,
        canUseForDerivedStats: canAnswerIndividual,
        isOfficialRoster,
        isUserUploadedRoster,
        accuracyLabel: canAnswerIndividual
            ? (isOfficialRoster ? 'Official/Firestore roster' : 'Uploaded roster')
            : 'Generated mock roster',
        warning: canAnswerIndividual
            ? ''
            : canAnswerDemoIndividual
                ? 'รายชื่อเป็น generated mock ใช้สาธิตการค้นหาแบบ realtime ได้ แต่ห้ามอ้างว่าเป็นรายชื่อหรือ GPA จริงจาก Reg'
                : 'ยังไม่มี roster ที่ใช้ตอบรายชื่อรายคนได้',
    };
}

export function canUseStudentRowsAsRealRoster() {
    return getStudentRosterTrustStatus().canAnswerIndividual;
}

export function isUsingBundledSampleData() {
    return getStudentDataSourceStatus().isBundledSample;
}

export async function ensureStudentList() {
    if (!_unsubscribeLive && !_loadPromise) startRealtimeSubscription();
    if (_cache) return getStudentListSync();
    return _loadPromise || getStudentListSync();
}

export async function uploadStudentList(rows, { fileName, uid, who, meta } = {}) {
    if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error('rows must be a non-empty array');
    }

    if (isBypassUid(uid)) {
        const updatedAt = new Date().toISOString();
        saveDemoDataset({
            rows,
            rowCount: rows.length,
            fileName: fileName || 'unknown',
            updatedAt,
            updatedBy: uid || 'admin-bypass',
            version: 1,
            allowSmallDataset: true,
            sourceTrust: 'uploaded_file',
            sourceLabel: 'Uploaded student roster file',
            lastWriteSource: 'upload_students',
        });
        _cache = rows;
        _isLive = true;
        _usesLocalOnlyData = true;
        setSourceMeta({
            sourceTrust: 'uploaded_file',
            sourceLabel: 'Uploaded student roster file',
            fileName: fileName || 'unknown',
            updatedAt,
            updatedBy: uid || 'admin-bypass',
            lastWriteSource: 'upload_students',
        }, rows, { storage: 'local_demo' });
        _loadPromise = Promise.resolve(getStudentListSync());
        notify();
        writeAuditLog({
            action: 'upload_students',
            who: who || uid || 'admin-bypass',
            fileName: fileName || 'unknown',
            rowCount: rows.length,
            version: 1,
            meta: { ...(meta || {}), storage: 'local_demo' },
        });
        return { rowCount: rows.length };
    }

    await setDoc(studentDocRef(), {
        rows,
        rowCount: rows.length,
        fileName: fileName || 'unknown',
        updatedAt: serverTimestamp(),
        updatedBy: uid || 'unknown',
        version: 1,
        allowSmallDataset: true,
        sourceTrust: 'uploaded_file',
        sourceLabel: 'Uploaded student roster file',
        lastWriteSource: 'upload_students',
    });
    _cache = rows;
    _isLive = true;
    _usesLocalOnlyData = false;
    setSourceMeta({
        sourceTrust: 'uploaded_file',
        sourceLabel: 'Uploaded student roster file',
        fileName: fileName || 'unknown',
        updatedBy: uid || 'unknown',
        lastWriteSource: 'upload_students',
    }, rows, { storage: 'firestore' });
    _loadPromise = Promise.resolve(getStudentListSync());
    notify();
    // Fire-and-forget audit log; failures are swallowed inside the service.
    writeAuditLog({
        action: 'upload_students',
        who: who || uid || 'unknown',
        fileName: fileName || 'unknown',
        rowCount: rows.length,
        version: 1,
        meta: meta || {},
    });
    return { rowCount: rows.length };
}

export async function getStudentListMeta() {
    const demo = loadDemoDataset();
    if ((!_isLive || _usesLocalOnlyData) && Array.isArray(demo?.rows) && demo.rows.length > 0) {
        return {
            rowCount: demo.rowCount ?? demo.rows.length,
            fileName: demo.fileName || null,
            updatedAt: demo.updatedAt ? new Date(demo.updatedAt) : null,
            updatedBy: demo.updatedBy || null,
            version: demo.version || 1,
            sourceTrust: demo.sourceTrust || null,
            sourceLabel: demo.sourceLabel || null,
            officialTotal: demo.officialTotal ?? null,
            officialSourceLabel: demo.officialSourceLabel || null,
            lastWriteSource: demo.lastWriteSource || null,
        };
    }

    try {
        const snap = await getDoc(studentDocRef());
        if (!snap.exists()) return null;
        const d = snap.data();
        return {
            rowCount: d.rowCount ?? (Array.isArray(d.rows) ? d.rows.length : 0),
            fileName: d.fileName || null,
            updatedAt: d.updatedAt?.toDate ? d.updatedAt.toDate() : null,
            updatedBy: d.updatedBy || null,
            version: d.version || 1,
            sourceTrust: d.sourceTrust || null,
            sourceLabel: d.sourceLabel || null,
            officialTotal: d.officialTotal ?? null,
            officialSourceLabel: d.officialSourceLabel || null,
            lastWriteSource: d.lastWriteSource || null,
        };
    } catch (err) {
        console.warn('[studentDataService] getStudentListMeta failed:', err?.message || err);
        return null;
    }
}

export function onStudentDataChange(callback) {
    if (!_unsubscribeLive && !_loadPromise) startRealtimeSubscription();
    _listeners.add(callback);
    return () => _listeners.delete(callback);
}
