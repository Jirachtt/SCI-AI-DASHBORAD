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
import { scienceStudentList } from '../data/studentListData.js';
import { writeAuditLog } from './auditLogService';

const DOC_PATH = ['datasets', 'students'];
const MANUAL_STUDENTS_KEY = 'sci_dashboard_manual_students';
const DEMO_DATASET_KEY = 'sci_dashboard_demo_student_dataset';
const MIN_TRUSTED_LIVE_ROWS = 1000;

let _cache = null;
let _isLive = false;           // true once Firestore has returned a valid dataset
let _usesLocalOnlyData = false;
let _loadPromise = null;
let _unsubscribeLive = null;
const _listeners = new Set();

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

function saveDemoDataset(payload) {
    try {
        localStorage.setItem(DEMO_DATASET_KEY, JSON.stringify(payload));
    } catch (e) {
        console.warn('[studentDataService] demo dataset save failed:', e);
    }
}

/**
 * Add a single student manually. Real signed-in dean sessions persist to
 * Firestore so every device receives the realtime update. Admin-bypass/demo
 * sessions do not mutate local student counts because that would diverge
 * between devices.
 */
export async function addStudent(student, { uid, who } = {}) {
    if (!student?.id) throw new Error('student.id is required');

    if (db && !isBypassUid(uid)) {
        try {
            const rows = upsertStudent(await readAuthoritativeRows(), student);
            await persistRows(rows, {
                uid,
                source: 'manual_add',
                manualAction: 'add_student',
                manualStudentId: student.id,
            });
            removeManualStudent(student.id);
            _cache = rows;
            _isLive = true;
            _usesLocalOnlyData = false;
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

    notify();
    return { rowCount: getStudentListSync().length, scope: isBypassUid(uid) ? 'auth_required' : 'no_firebase' };
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
        _cache = demo.rows;
        _isLive = true;
        _usesLocalOnlyData = true;
        return;
    }
    _cache = scienceStudentList;
    _isLive = false;
    _usesLocalOnlyData = false;
}

function isTrustedLiveRows(rows) {
    return Array.isArray(rows) && rows.length >= MIN_TRUSTED_LIVE_ROWS;
}

function applySnapshot(snap) {
    if (snap.exists()) {
        const data = snap.data();
        const rows = Array.isArray(data.rows) ? data.rows : [];
        if (isTrustedLiveRows(rows) || data.allowSmallDataset === true) {
            _cache = rows;
            _isLive = true;
            _usesLocalOnlyData = false;
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
        if (isTrustedLiveRows(rows) || data.allowSmallDataset === true) return rows;
    }
    return _cache || scienceStudentList;
}

async function persistRows(rows, { uid, source, manualAction, manualStudentId } = {}) {
    await setDoc(studentDocRef(), {
        rows,
        rowCount: rows.length,
        updatedAt: serverTimestamp(),
        updatedBy: uid || 'unknown',
        version: 1,
        allowSmallDataset: true,
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
            allowSmallDataset: true
        });
        _cache = rows;
        _isLive = true;
        _usesLocalOnlyData = true;
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
        allowSmallDataset: true
    });
    _cache = rows;
    _isLive = true;
    _usesLocalOnlyData = false;
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
            version: demo.version || 1
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
            version: d.version || 1
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
