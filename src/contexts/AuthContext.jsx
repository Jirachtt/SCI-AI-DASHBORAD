import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, googleProvider } from '../firebase';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    signOut,
    onAuthStateChanged,
    fetchSignInMethodsForEmail
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { isPendingRole } from '../utils/accessControl';
import { buildRoleValidityPatch, getRoleValidity } from '../utils/roleValidity';

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
                const validity = buildRoleValidityPatch('dean', new Date());
                setUser({
                    uid: 'admin-bypass-' + Date.now(),
                    email: 'dean@mju.ac.th',
                    name: 'ผู้บริหาร (Admin)',
                    avatar: '👨‍💼',
                    role: 'dean',
                    roleLabel: 'คณบดี (Dean)',
                    ...validity,
                    roleValidity: getRoleValidity({ role: 'dean', ...validity })
                });
                setLoading(false);
                return true;
            }
            return false;
        };

        if (checkBypass()) return;

        // Handle Google redirect result — we log errors but don't create
        // the user doc here; that's onAuthStateChanged's job (single source
        // of truth, avoids racing setDoc between callers).
        getRedirectResult(auth).catch((err) => {
            console.error('Redirect result error:', err);
        });

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (!mounted) return;

            if (currentUser) {
                // 1. Set basic user info IMMEDIATELY so PublicRoute can
                //    redirect away from the login page without waiting on
                //    the Firestore round-trip.
                const basicUser = {
                    uid: currentUser.uid,
                    email: currentUser.email,
                    name: currentUser.displayName || 'User',
                    avatar: currentUser.photoURL || '👤',
                    role: 'general',
                    roleLabel: 'ทั่วไป'
                };

                setUser(basicUser);
                setLoading(false);

                // 2. Fetch (or create) the user doc in the background.
                try {
                    const userDocRef = doc(db, "users", currentUser.uid);
                    const userDoc = await getDoc(userDocRef);

                    if (!mounted) return;

                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        const role = userData.role || 'student';
                        const roleValidity = getRoleValidity({ ...userData, role });
                        const roleExpired = roleValidity.status === 'expired' && role !== 'general' && !isPendingRole(role);
                        const effectiveRole = roleExpired ? 'general' : role;
                        setUser(prev => ({
                            ...prev,
                            ...userData,
                            assignedRole: role,
                            assignedRoleLabel: userData.roleLabel || 'นักศึกษา (Student)',
                            role: effectiveRole,
                            roleLabel: roleExpired ? 'ผู้ใช้ทั่วไป (สิทธิ์เดิมหมดอายุ)' : (userData.roleLabel || 'นักศึกษา (Student)'),
                            isPending: isPendingRole(role),
                            roleExpired,
                            roleValidity,
                            requestedRole: userData.requestedRole || null,
                            status: userData.status || 'approved',
                            employeeId: userData.employeeId || null,
                            department: userData.department || null,
                            approvedBy: userData.approvedBy || null,
                            approvedAt: userData.approvedAt || null
                        }));
                    } else if (currentUser.providerData?.some(p => p.providerId === 'google.com')) {
                        // First-time Google sign-in — provision a student doc.
                        const createdAt = new Date().toISOString();
                        const newDoc = {
                            name: currentUser.displayName || 'User',
                            email: currentUser.email,
                            role: 'student',
                            roleLabel: 'นักศึกษา (Student)',
                            avatar: currentUser.photoURL || '👤',
                            status: 'approved',
                            createdAt: serverTimestamp(),
                            ...buildRoleValidityPatch('student', createdAt)
                        };
                        await setDoc(userDocRef, newDoc);
                        if (!mounted) return;
                        setUser(prev => ({ ...prev, ...newDoc, role: 'student' }));
                    }
                } catch (err) {
                    console.error("Error fetching user data:", err);
                }
            } else {
                setUser(null);
                setLoading(false);
            }
        }, (error) => {
            console.error("Auth Error:", error);
            if (mounted) setLoading(false);
        });

        // Safety timeout — if Firebase is blocked by ad blocker / network
        // issue we don't want the AuthLoader to spin forever. We use the
        // functional setState so we read the *current* loading value, not
        // the stale closure from when this effect first ran.
        const timeoutId = setTimeout(() => {
            if (!mounted) return;
            if (checkBypass()) return;
            setLoading(prev => {
                if (prev) console.warn("Auth listener timed out — forcing loading=false");
                return false;
            });
        }, 5000);

        return () => {
            mounted = false;
            unsubscribe();
            clearTimeout(timeoutId);
        };
    }, []);

    const loginWithAdminCode = async (code) => {
        if (code === 'admin313') {
            const validity = buildRoleValidityPatch('dean', new Date());
            const adminUser = {
                uid: 'admin-bypass-' + Date.now(),
                email: 'dean@mju.ac.th',
                name: 'ผู้บริหาร (Admin)',
                avatar: '👨‍💼',
                role: 'dean',
                roleLabel: 'คณบดี (Dean)',
                ...validity,
                roleValidity: getRoleValidity({ role: 'dean', ...validity })
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
            const code = error?.code || '';
            let friendly = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
            if (code === 'auth/user-not-found') friendly = 'ไม่พบบัญชีผู้ใช้นี้ในระบบ';
            else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') friendly = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
            else if (code === 'auth/invalid-email') friendly = 'รูปแบบอีเมลไม่ถูกต้อง';
            else if (code === 'auth/user-disabled') friendly = 'บัญชีนี้ถูกระงับการใช้งาน';
            else if (code === 'auth/too-many-requests') friendly = 'พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่';
            else if (code === 'auth/network-request-failed') friendly = 'ไม่สามารถเชื่อมต่อเครือข่ายได้ กรุณาลองใหม่';
            return { success: false, error: friendly, code };
        }
    };

    const loginWithGoogle = async () => {
        try {
            // Popup first — redirect has cookie-policy issues on modern
            // browsers. The popup resolution triggers onAuthStateChanged,
            // which creates the Firestore user doc if needed. We don't
            // await Firestore here so the caller returns as soon as auth
            // is established, letting <PublicRoute> navigate immediately.
            await signInWithPopup(auth, googleProvider);
            return { success: true };
        } catch (error) {
            console.error('Google login error:', error.code, error.message);

            if (error.code === 'auth/unauthorized-domain') {
                return {
                    success: false,
                    error: 'Domain นี้ยังไม่ได้เพิ่มใน Firebase Console → Authentication → Settings → Authorized domains'
                };
            }

            // Popup blocked or otherwise unusable — fall back to redirect.
            if (error.code === 'auth/popup-blocked' ||
                error.code === 'auth/operation-not-supported-in-this-environment') {
                try {
                    await signInWithRedirect(auth, googleProvider);
                    return { success: true };
                } catch (redirectError) {
                    return { success: false, error: redirectError.message };
                }
            }

            if (error.code === 'auth/popup-closed-by-user' ||
                error.code === 'auth/cancelled-popup-request') {
                return { success: false, error: 'คุณปิดหน้าต่าง Google Login กรุณาลองใหม่' };
            }

            if (error.code === 'auth/network-request-failed') {
                return { success: false, error: 'ไม่สามารถเชื่อมต่อเครือข่ายได้ กรุณาลองใหม่' };
            }

            return { success: false, error: error.message };
        }
    };

    // Check if an email is already registered (used to catch duplicates
    // at step 1 of signup before the user fills out later steps).
    // Returns: { exists: boolean, methods: string[] } — `methods` is empty
    // for new emails and lists providers (password, google.com, …) otherwise.
    // On network/policy errors we return exists=false so signup can still
    // proceed and Firebase will surface the real error on createUser.
    const checkEmailExists = async (email) => {
        try {
            const methods = await fetchSignInMethodsForEmail(auth, email);
            return { exists: methods.length > 0, methods };
        } catch (error) {
            console.warn('[checkEmailExists] failed:', error?.message || error);
            return { exists: false, methods: [] };
        }
    };

    const signup = async (email, password, userData) => {
        try {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            const user = result.user;

            // Build base doc and only attach optional pending fields when provided
            const createdAt = new Date().toISOString();
            const docPayload = {
                name: userData.name,
                email: email,
                role: userData.role,
                roleLabel: userData.roleLabel,
                avatar: userData.avatar,
                status: userData.status || 'approved',
                createdAt
            };
            if (docPayload.status === 'approved') {
                Object.assign(docPayload, buildRoleValidityPatch(userData.role, createdAt));
            }

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
            const code = error?.code || '';
            let friendly = error.message;
            if (code === 'auth/email-already-in-use') friendly = 'อีเมลนี้ถูกใช้สมัครไปแล้ว — กรุณาเข้าสู่ระบบหรือใช้อีเมลอื่น';
            else if (code === 'auth/invalid-email') friendly = 'รูปแบบอีเมลไม่ถูกต้อง';
            else if (code === 'auth/weak-password') friendly = 'รหัสผ่านอ่อนเกินไป (อย่างน้อย 6 ตัวอักษร)';
            else if (code === 'auth/network-request-failed') friendly = 'ไม่สามารถเชื่อมต่อเครือข่ายได้ กรุณาลองใหม่';
            return { success: false, error: friendly, code };
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
            checkEmailExists,
            logout,
            loading,
            updateUserDoc
        }}>
            {children}
        </AuthContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}

export default AuthContext;
