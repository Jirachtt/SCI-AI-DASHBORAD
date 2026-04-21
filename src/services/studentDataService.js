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
//
// Callers use:
//   ensureStudentList()    — async, loads once and caches; returns live list (or mock)
//   getStudentListSync()   — synchronous accessor (returns cached / mock); safe anywhere
//   uploadStudentList()    — admin writes new dataset
//   getStudentListMeta()   — lightweight metadata fetch for admin panel
//   onStudentDataChange()  — subscribe to in-session updates after an upload

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { scienceStudentList } from '../data/studentListData';

const DOC_PATH = ['datasets', 'students'];

let _cache = null;
let _isLive = false;           // true once Firestore has returned a valid dataset
let _loadPromise = null;
const _listeners = new Set();

function notify() {
    for (const cb of _listeners) {
        try { cb(_cache); } catch (e) { console.error('[studentDataService] listener error', e); }
    }
}

export function getStudentListSync() {
    return _cache || scienceStudentList;
}

export function isLiveData() {
    return _isLive;
}

export async function ensureStudentList() {
    if (_cache) return _cache;
    if (_loadPromise) return _loadPromise;
    _loadPromise = (async () => {
        try {
            const snap = await getDoc(doc(db, ...DOC_PATH));
            if (snap.exists()) {
                const data = snap.data();
                if (Array.isArray(data.rows) && data.rows.length > 0) {
                    _cache = data.rows;
                    _isLive = true;
                    return _cache;
                }
            }
        } catch (err) {
            console.warn('[studentDataService] Firestore load failed, using mock:', err?.message || err);
        }
        _cache = scienceStudentList;
        _isLive = false;
        return _cache;
    })();
    return _loadPromise;
}

export async function uploadStudentList(rows, { fileName, uid } = {}) {
    if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error('rows must be a non-empty array');
    }
    await setDoc(doc(db, ...DOC_PATH), {
        rows,
        rowCount: rows.length,
        fileName: fileName || 'unknown',
        updatedAt: serverTimestamp(),
        updatedBy: uid || 'unknown',
        version: 1
    });
    _cache = rows;
    _isLive = true;
    _loadPromise = Promise.resolve(rows);
    notify();
    return { rowCount: rows.length };
}

export async function getStudentListMeta() {
    try {
        const snap = await getDoc(doc(db, ...DOC_PATH));
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
    _listeners.add(callback);
    return () => _listeners.delete(callback);
}
