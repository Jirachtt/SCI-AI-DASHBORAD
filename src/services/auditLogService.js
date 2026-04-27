// Append-only audit log for admin data uploads.
// Each doc: { action, who, fileName, rowCount, version, at, meta }
//   action:    'upload_students' | future actions
//   who:       uid/email of actor
//   fileName:  original file name
//   rowCount:  number of rows uploaded
//   version:   schema version of payload
//   at:        server timestamp
//   meta:      optional object (e.g. dedupe counts)

import {
    collection, addDoc, getDocs, query, orderBy, limit as fbLimit,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';

const COLLECTION = 'auditLogs';
const LOCAL_AUDIT_KEY = 'sci_dashboard_local_audit_logs';

function readLocalLogs() {
    try {
        const raw = localStorage.getItem(LOCAL_AUDIT_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function appendLocalLog(entry) {
    try {
        const rows = readLocalLogs();
        rows.unshift({
            id: `local-${Date.now()}`,
            action: entry.action,
            who: entry.who || 'unknown',
            fileName: entry.fileName || null,
            rowCount: entry.rowCount ?? null,
            version: entry.version ?? 1,
            meta: entry.meta || {},
            at: new Date().toISOString(),
        });
        localStorage.setItem(LOCAL_AUDIT_KEY, JSON.stringify(rows.slice(0, 100)));
    } catch (err) {
        console.warn('[auditLogService] local audit fallback failed:', err?.message || err);
    }
}

export async function writeAuditLog(entry) {
    if (!entry || !entry.action) throw new Error('audit entry requires an action');
    try {
        await addDoc(collection(db, COLLECTION), {
            action: entry.action,
            who: entry.who || 'unknown',
            fileName: entry.fileName || null,
            rowCount: entry.rowCount ?? null,
            version: entry.version ?? 1,
            meta: entry.meta || {},
            at: serverTimestamp(),
        });
    } catch {
        // Don't block the primary operation on audit failures.
        appendLocalLog(entry);
    }
}

export async function listRecentAuditLogs(maxEntries = 50) {
    try {
        const q = query(
            collection(db, COLLECTION),
            orderBy('at', 'desc'),
            fbLimit(maxEntries)
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                action: data.action,
                who: data.who || '-',
                fileName: data.fileName || null,
                rowCount: data.rowCount ?? null,
                version: data.version ?? 1,
                meta: data.meta || {},
                at: data.at?.toDate ? data.at.toDate() : null,
            };
        });
    } catch (err) {
        console.warn('[auditLogService] listRecentAuditLogs failed:', err?.message || err);
        return readLocalLogs().slice(0, maxEntries).map(log => ({
            ...log,
            at: log.at ? new Date(log.at) : null,
        }));
    }
}
