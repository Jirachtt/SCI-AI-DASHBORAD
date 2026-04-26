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
//   getStudentListSync()   — synchronous accessor (returns cached / mock + manual adds); safe anywhere
//   uploadStudentList()    — admin writes new dataset
//   getStudentListMeta()   — lightweight metadata fetch for admin panel
//   onStudentDataChange()  — subscribe to realtime student-data updates
//   addStudent()           — persist a single manually added student (localStorage)
//   removeStudent()        — remove a manually added student by ID

import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { scienceStudentList } from '../data/studentListData.js';
import { writeAuditLog } from './auditLogService';

const DOC_PATH = ['datasets', 'students'];
const MANUAL_STUDENTS_KEY = 'sci_dashboard_manual_students';
const MIN_TRUSTED_LIVE_ROWS = 1000;

let _cache = null;
let _isLive = false;           // true once Firestore has returned a valid dataset
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

/**
 * Add a single student manually. Persisted in localStorage and immediately
 * visible to getStudentListSync() and AI chat.
 */
export function addStudent(student) {
    const manual = loadManualStudents();
    // Prevent duplicates by ID
    const exists = manual.findIndex(s => s.id === student.id);
    if (exists >= 0) {
        manual[exists] = student; // Update existing
    } else {
        manual.push(student);
    }
    saveManualStudents(manual);
    notify();
    return manual;
}

/**
 * Remove a manually added student by ID.
 */
export function removeStudent(studentId) {
    const manual = loadManualStudents().filter(s => s.id !== studentId);
    saveManualStudents(manual);
    notify();
    return manual;
}

/**
 * Get all manually added students (for UI to distinguish them).
 */
export function getManualStudents() {
    return loadManualStudents();
}

// ─── Core data functions ───

function studentDocRef() {
    return doc(db, ...DOC_PATH);
}

function setBundledFallback() {
    _cache = scienceStudentList;
    _isLive = false;
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
    const base = _cache || scienceStudentList;
    const manual = loadManualStudents();
    if (manual.length === 0) return base;
    // Merge: manual students override base by ID
    const manualIds = new Set(manual.map(s => s.id));
    const filtered = base.filter(s => !manualIds.has(s.id));
    return [...filtered, ...manual];
}

export function isLiveData() {
    return _isLive;
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
