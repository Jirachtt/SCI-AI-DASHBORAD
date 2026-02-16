// Import ให้ครบทั้ง Login และ Database
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// import { getAnalytics } from "firebase/analytics";

// รหัสของคุณ (ถูกต้องแล้วครับ)
const firebaseConfig = {
    apiKey: "AIzaSyCHcebwWSYs_TZl-eWct1TRP0hMNHwiXPk",
    authDomain: "sci-ai-dashboard.firebaseapp.com",
    projectId: "sci-ai-dashboard",
    storageBucket: "sci-ai-dashboard.firebasestorage.app",
    messagingSenderId: "369466557100",
    appId: "1:369466557100:web:3581810a643fa9ac5c9509",
    measurementId: "G-ZMT033820E"
};

// เริ่มต้นระบบ Firebase
const app = initializeApp(firebaseConfig);

// ตัวแปรสำหรับใช้งานในโปรเจกต์
// const analytics = getAnalytics(app);
export const auth = getAuth(app);                // ระบบล็อคอิน
export const googleProvider = new GoogleAuthProvider(); // ล็อคอินด้วย Google
export const db = getFirestore(app);             // ฐานข้อมูล

export default app;