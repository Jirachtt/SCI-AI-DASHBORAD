// Chat History service — persists user conversations to Firestore.
// Each session doc in `ai_chat_history`:
//   { uid, userEmail, title, messages, messageCount, createdAt, updatedAt }
//
// Notes:
// - Messages may include chart configs containing functions (tick callbacks).
//   Those are stripped before write — Firestore rejects functions.
// - We avoid composite indexes by querying with `where uid` only and sorting
//   client-side. Fine while a user has < a few hundred sessions.

import {
    collection, addDoc, updateDoc, doc, getDoc, getDocs,
    query, where, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

const COLLECTION = 'ai_chat_history';

function sanitizeForFirestore(value) {
    return JSON.parse(JSON.stringify(value, (_k, v) => {
        if (typeof v === 'function') return undefined;
        if (v === undefined) return null;
        return v;
    }));
}

function deriveTitle(messages) {
    const firstUser = messages.find(m => m.role === 'user');
    if (!firstUser?.text) return 'แชทใหม่';
    const t = firstUser.text.replace(/\s+/g, ' ').trim();
    return t.length > 60 ? t.slice(0, 57) + '…' : t;
}

export async function createChatSession({ uid, email, messages }) {
    if (!uid) throw new Error('uid required');
    const ref = await addDoc(collection(db, COLLECTION), {
        uid,
        userEmail: email || null,
        title: deriveTitle(messages),
        messages: sanitizeForFirestore(messages),
        messageCount: messages.length,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return ref.id;
}

export async function updateChatSession(sessionId, messages) {
    if (!sessionId) throw new Error('sessionId required');
    await updateDoc(doc(db, COLLECTION, sessionId), {
        title: deriveTitle(messages),
        messages: sanitizeForFirestore(messages),
        messageCount: messages.length,
        updatedAt: serverTimestamp(),
    });
}

export async function listUserSessions(uid, max = 50) {
    if (!uid) return [];
    const q = query(collection(db, COLLECTION), where('uid', '==', uid));
    const snap = await getDocs(q);
    const items = snap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            title: data.title || 'แชท',
            messageCount: data.messageCount || 0,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : null,
        };
    });
    items.sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0));
    return items.slice(0, max);
}

export async function loadChatSession(sessionId) {
    if (!sessionId) return null;
    const snap = await getDoc(doc(db, COLLECTION, sessionId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
        id: snap.id,
        title: data.title || '',
        messages: Array.isArray(data.messages) ? data.messages : [],
    };
}

export async function deleteChatSession(sessionId) {
    if (!sessionId) return;
    await deleteDoc(doc(db, COLLECTION, sessionId));
}
