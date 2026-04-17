import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, googleProvider } from '../firebase';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    signOut,
    onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { isPendingRole } from '../utils/accessControl';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        console.log("Setting up auth listener");
        let mounted = true;

        // Check for Admin Bypass (Virtual Session)
        const checkBypass = () => {
            const isBypass = localStorage.getItem('admin_bypass');
            if (isBypass === 'true') {
                console.log("Restoring Admin Bypass session");
                setUser({
                    uid: 'admin-bypass-' + Date.now(),
                    email: 'dean@mju.ac.th',
                    name: 'ผู้บริหาร (Admin)',
                    avatar: '👨‍💼',
                    role: 'dean',
                    roleLabel: 'ผจก.คณะ (Dean)'
                });
                setLoading(false);
                return true;
            }
            return false;
        };

        if (checkBypass()) return;

        // Handle Google redirect result
        getRedirectResult(auth).then(async (result) => {
            if (result?.user) {
                const u = result.user;
                const userDocRef = doc(db, "users", u.uid);
                const userDoc = await getDoc(userDocRef);
                if (!userDoc.exists()) {
                    await setDoc(userDocRef, {
                        name: u.displayName,
                        email: u.email,
                        role: 'student',
                        roleLabel: 'นักศึกษา (Student)',
                        avatar: u.photoURL || '👤',
                        status: 'approved',
                        createdAt: serverTimestamp()
                    });
                }
            }
        }).catch((err) => console.error('Redirect result error:', err));

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            console.log("Auth state changed:", currentUser);
            if (!mounted) return;

            if (currentUser) {
                // 1. Set basic user info IMMEDIATELLY to allow app access
                const basicUser = {
                    uid: currentUser.uid,
                    email: currentUser.email,
                    name: currentUser.displayName || 'User',
                    avatar: currentUser.photoURL || '👤',
                    role: 'general', // Default role until fetched
                    roleLabel: 'ทั่วไป'
                };

                setUser(basicUser);
                setLoading(false); // Unblock UI immediately!

                // 2. Fetch role data in background
                try {
                    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
                    if (mounted && userDoc.exists()) {
                        const userData = userDoc.data();

                        // Merge firestore data with current user state
                        // Ensure role is valid or fallback to 'student'
                        const role = userData.role || 'student';

                        setUser(prev => ({
                            ...prev,
                            ...userData,
                            role: role,
                            roleLabel: userData.roleLabel || 'นักศึกษา (Student)',
                            isPending: isPendingRole(role),
                            requestedRole: userData.requestedRole || null,
                            status: userData.status || 'approved',
                            employeeId: userData.employeeId || null,
                            department: userData.department || null,
                            approvedBy: userData.approvedBy || null,
                            approvedAt: userData.approvedAt || null
                        }));
                    }
                } catch (err) {
                    console.error("Error fetching user data in background:", err);
                }
            } else {
                setUser(null);
                setLoading(false);
            }
        }, (error) => {
            console.error("Auth Error:", error);
            if (mounted) setLoading(false);
        });

        // Safety timeout in case Firebase is blocked or slow
        const timeoutId = setTimeout(() => {
            if (loading && mounted) {
                // Try bypass one last time before giving up
                if (checkBypass()) return;

                console.warn("Auth listener timed out - Forcing loading false");
                setLoading(false);
            }
        }, 5000); // 5 seconds timeout

        return () => {
            mounted = false;
            unsubscribe();
            clearTimeout(timeoutId);
        };
    }, []);

    const loginWithAdminCode = async (code) => {
        if (code === 'admin313') {
            const adminUser = {
                uid: 'admin-bypass-' + Date.now(),
                email: 'dean@mju.ac.th',
                name: 'ผู้บริหาร (Admin)',
                avatar: '👨‍💼',
                role: 'dean',
                roleLabel: 'ผจก.คณะ (Dean)'
            };
            localStorage.setItem('admin_bypass', 'true');
            setUser(adminUser);
            return { success: true };
        }
        return { success: false, error: 'รหัสผ่านไม่ถูกต้อง' };
    };

    const loginWithEmail = async (email, password) => {
        try {
            await signInWithEmailAndPassword(auth, email, password);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const loginWithGoogle = async () => {
        try {
            // Always use popup first — signInWithRedirect has known issues
            // with third-party cookie restrictions in modern browsers
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;

            // Save user document to Firestore
            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(userDocRef);
                if (!userDoc.exists()) {
                    await setDoc(userDocRef, {
                        name: user.displayName,
                        email: user.email,
                        role: 'student',
                        roleLabel: 'นักศึกษา (Student)',
                        avatar: user.photoURL || '👤',
                        status: 'approved',
                        createdAt: serverTimestamp()
                    });
                }
            } catch (firestoreError) {
                console.warn('Firestore save skipped:', firestoreError.message);
            }

            return { success: true };
        } catch (error) {
            console.error('Google login error:', error.code, error.message);

            // Handle specific errors
            if (error.code === 'auth/unauthorized-domain') {
                return {
                    success: false,
                    error: 'Domain นี้ยังไม่ได้เพิ่มใน Firebase Console → Authentication → Settings → Authorized domains'
                };
            }

            // If popup is blocked, fall back to redirect
            if (error.code === 'auth/popup-blocked') {
                try {
                    await signInWithRedirect(auth, googleProvider);
                    return { success: true };
                } catch (redirectError) {
                    return { success: false, error: redirectError.message };
                }
            }

            if (error.code === 'auth/popup-closed-by-user') {
                return { success: false, error: 'คุณปิดหน้าต่าง Google Login กรุณาลองใหม่' };
            }

            return { success: false, error: error.message };
        }
    };

    const signup = async (email, password, userData) => {
        try {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            const user = result.user;

            // Build base doc and only attach optional pending fields when provided
            const docPayload = {
                name: userData.name,
                email: email,
                role: userData.role,
                roleLabel: userData.roleLabel,
                avatar: userData.avatar,
                status: userData.status || 'approved',
                createdAt: new Date().toISOString()
            };

            if (userData.requestedRole) docPayload.requestedRole = userData.requestedRole;
            if (userData.employeeId) docPayload.employeeId = userData.employeeId;
            if (userData.department) docPayload.department = userData.department;
            if (userData.reason) docPayload.reason = userData.reason;
            if (userData.status === 'pending') {
                docPayload.approvedBy = null;
                docPayload.approvedAt = null;
            }

            await setDoc(doc(db, "users", user.uid), docPayload);

            return { success: true, isPending: userData.status === 'pending' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const logout = async () => {
        try {
            localStorage.removeItem('admin_bypass');
            await signOut(auth);
            setUser(null);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const updateUserDoc = async (uid, patch) => {
        try {
            await updateDoc(doc(db, 'users', uid), patch);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            loginWithEmail,
            loginWithGoogle,
            loginWithAdminCode,
            signup,
            logout,
            loading,
            updateUserDoc
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}

export default AuthContext;
