// Import ให้ครบทั้ง Login และ Database
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

export const isFirebaseConfigured = Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);

if (!isFirebaseConfigured) {
    console.warn('[firebase] Missing Vite Firebase env vars. Check .env / Vercel Environment Variables.');
}

// เริ่มต้นระบบ Firebase เฉพาะเมื่อ config พร้อม เพื่อไม่ให้ production ขาวทั้งหน้า
const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;

// ตัวแปรสำหรับใช้งานในโปรเจกต์
// const analytics = getAnalytics(app);
export const auth = app ? getAuth(app) : null;                // ระบบล็อคอิน
// Persist auth state in localStorage so refreshes / new tabs reuse the
// session without bouncing the user back to the login screen.
if (auth) {
    setPersistence(auth, browserLocalPersistence).catch((err) => {
        console.warn('[firebase] setPersistence failed:', err?.message || err);
    });
}
export const googleProvider = app ? new GoogleAuthProvider() : null; // ล็อคอินด้วย Google
if (googleProvider) googleProvider.setCustomParameters({ prompt: 'select_account' });
export const db = app ? getFirestore(app) : null;             // ฐานข้อมูล

export default app;
