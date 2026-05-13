import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, googleProvider, isFirebaseConfigured } from '../firebase';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signInWithRedirect,
    signInWithCustomToken,
    getRedirectResult,
    signOut,
    onAuthStateChanged,
    fetchSignInMethodsForEmail
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { isPendingRole } from '../utils/accessControl';
import { buildRoleValidityPatch, getRoleValidity } from '../utils/roleValidity';
import {
    buildMjuSsoSignoutUrl,
    buildMjuSsoStartUrl,
    clearMjuSsoState,
    exchangeMjuSsoCode,
    normalizeMjuRoleFromClaims,
    readMjuSsoCallback,
    roleLabelForMjuRole
} from '../services/mjuSsoService';

const AuthContext = createContext(null);

const ROLE_LABELS_BY_ROLE = {
    dean: 'คณบดี (Dean)',
    chair: 'ประธานหลักสูตร (Chair)',
    executive: 'ผู้บริหาร (Executive)',
    instructor: 'อาจารย์ (Instructor)',
    staff: 'เจ้าหน้าที่ (Staff)',
    general: 'ผู้ใช้ทั่วไป (General)',
    student: 'นักศึกษา (Student)',
    pending_staff: 'รอการอนุมัติ (Staff)',
    pending_chair: 'รอการอนุมัติ (Chair)'
};

const normalizeRoleLabel = (role, roleLabel, fallback = 'นักศึกษา (Student)') => {
    const current = String(roleLabel || fallback);
    if (!roleLabel && ROLE_LABELS_BY_ROLE[role]) return ROLE_LABELS_BY_ROLE[role];
    if (role === 'dean' && /ผจก|ผู้จัดการ\s*คณะ|ผู้จัดการคณะ|ผู้บริหาร|dean/i.test(current)) {
        return ROLE_LABELS_BY_ROLE.dean;
    }
    return current;
};

const hasManualRoleOverride = (userData = {}, nextRole) => {
    const currentRole = userData.role;
    return Boolean(
        currentRole &&
        nextRole &&
        currentRole !== nextRole &&
        (userData.approvedBy || userData.roleManagedBy || userData.roleOverride || userData.canManageUsers || userData.systemAdmin)
    );
};

const preserveManualRolePatch = (mjuPatch = {}, claims = {}) => {
    const identityPatch = { ...mjuPatch };
    const detectedRole = identityPatch.role;
    const detectedRoleLabel = identityPatch.roleLabel;
    [
        'role',
        'roleLabel',
        'roleStartedAt',
        'roleExpiresAt',
        'roleDurationYears',
        'roleManagedAt',
        'status',
    ].forEach(key => { delete identityPatch[key]; });
    if (!claims.photoURL) delete identityPatch.avatar;
    return {
        ...identityPatch,
        mjuDetectedRole: detectedRole,
        mjuDetectedRoleLabel: detectedRoleLabel,
    };
};

const hasMjuSsoClaims = (claims = {}) => Boolean(
    claims.mjuVerified ||
    claims.mjuId ||
    claims.mjuRole ||
    claims.mjuUserType ||
    claims.studentId ||
    claims.studentID ||
    claims.studentCode ||
    claims.employeeId ||
    claims.personID ||
    claims.humanID
);

const firstClaimValue = (claims = {}, keys = []) => {
    for (const key of keys) {
        if (claims[key] != null && claims[key] !== '') return claims[key];
    }
    return null;
};

const MJU_CLAIM_PERSIST_KEYS = [
    'mjuVerified', 'mjuId', 'mjuRole', 'mjuUserType', 'studentId', 'studentID', 'studentCode',
    'employeeId', 'personID', 'humanID', 'username', 'email', 'name', 'displayName', 'faculty',
    'department', 'position', 'positionName', 'personType', 'gpax', 'gpa', 'gradePointAverage',
    'earnedCredits', 'totalCredits', 'creditEarned', 'completedCredits', 'requiredCredits',
    'creditRequired', 'graduationCredits', 'activityHoursCompleted', 'completedActivityHours',
    'activityHours', 'activityHoursTarget', 'requiredActivityHours', 'completedActivityEvents',
    'requiredActivityEvents',
];

const buildMjuLinkedDataFromClaims = (claims = {}) => {
    const mjuAcademic = {
        gpax: firstClaimValue(claims, ['gpax', 'gpa', 'gradePointAverage', 'cumGpa', 'cumulativeGpa']),
        earnedCredits: firstClaimValue(claims, ['earnedCredits', 'totalCredits', 'creditEarned', 'completedCredits']),
        requiredCredits: firstClaimValue(claims, ['requiredCredits', 'creditRequired', 'graduationCredits']),
        creditDetails: Array.isArray(claims.creditDetails) ? claims.creditDetails : null,
        minimumGpax: firstClaimValue(claims, ['minimumGpax', 'requiredGpax']),
    };
    const mjuActivity = {
        completedHours: firstClaimValue(claims, ['activityHoursCompleted', 'completedActivityHours', 'activityHours']),
        targetHours: firstClaimValue(claims, ['activityHoursTarget', 'requiredActivityHours']),
        completedEvents: firstClaimValue(claims, ['completedActivityEvents', 'activityEventsCompleted']),
        requiredEvents: firstClaimValue(claims, ['requiredActivityEvents']),
        categoryTargets: Array.isArray(claims.activityCategories) ? claims.activityCategories : null,
    };
    return {
        mjuClaims: Object.fromEntries(MJU_CLAIM_PERSIST_KEYS
            .filter(key => claims[key] != null)
            .map(key => [key, claims[key]])),
        mjuAcademic: Object.fromEntries(Object.entries(mjuAcademic).filter(([, value]) => value != null)),
        mjuActivity: Object.fromEntries(Object.entries(mjuActivity).filter(([, value]) => value != null)),
    };
};

const buildMjuUserPatchFromClaims = (claims = {}, currentUser, createdAt = new Date().toISOString()) => {
    const role = normalizeMjuRoleFromClaims(claims);
    return {
        name: claims.name || claims.displayName || currentUser.displayName || 'MJU User',
        email: currentUser.email || claims.email || '',
        role,
        roleLabel: roleLabelForMjuRole(role),
        avatar: claims.photoURL || (role === 'student' ? 'ST' : 'MJU'),
        photoURL: claims.photoURL || null,
        status: 'approved',
        authProvider: claims.authProvider || 'mju_sso',
        mjuVerified: true,
        mjuId: claims.mjuId || claims.studentId || claims.studentID || claims.studentCode || claims.employeeId || claims.personID || claims.humanID || claims.username || null,
        studentId: claims.studentId || claims.studentID || claims.studentCode || null,
        employeeId: claims.employeeId || claims.personID || claims.humanID || null,
        department: claims.department || claims.faculty || null,
        faculty: claims.faculty || null,
        ...buildMjuLinkedDataFromClaims(claims),
        ...buildRoleValidityPatch(role, createdAt),
    };
};

const firebaseUnavailable = () => ({
    success: false,
    code: 'firebase/not-configured',
    error: 'ระบบ Firebase ยังไม่ได้ตั้งค่า Environment Variables บน Vercel กรุณาตั้งค่า VITE_FIREBASE_* ก่อนใช้ล็อกอิน/สมัครสมาชิก'
});

const buildAdminBypassUser = () => {
    const validity = buildRoleValidityPatch('dean', new Date());
    return {
        uid: 'admin-bypass-' + Date.now(),
        email: 'dean@mju.ac.th',
        name: 'คณบดี (Admin)',
        avatar: '👨‍💼',
        role: 'dean',
        assignedRole: 'dean',
        roleLabel: 'คณบดี (Dean)',
        assignedRoleLabel: 'คณบดี (Dean)',
        status: 'approved',
        authProvider: 'admin_code_fallback',
        isAdminCodeSession: true,
        isPrivilegedAdmin: true,
        ...validity,
        roleValidity: getRoleValidity({ role: 'dean', ...validity })
    };
};

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
                if (isFirebaseConfigured && auth) {
                    localStorage.removeItem('admin_bypass');
                    return false;
                }
                console.log("Restoring Admin Bypass session");
                setUser(buildAdminBypassUser());
                setLoading(false);
                return true;
            }
            return false;
        };

        if (checkBypass()) return;

        if (!isFirebaseConfigured || !auth) {
            console.warn('[Auth] Firebase is not configured; rendering app without Firebase auth.');
            const fallbackId = setTimeout(() => {
                if (!mounted) return;
                setUser(null);
                setLoading(false);
            }, 0);

            return () => {
                mounted = false;
                clearTimeout(fallbackId);
            };
        }

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
                    const tokenResult = await currentUser.getIdTokenResult().catch(() => null);
                    const claims = tokenResult?.claims || {};
                    const isMjuSsoLogin = hasMjuSsoClaims(claims);

                    if (!mounted) return;

                    if (userDoc.exists()) {
                        let userData = userDoc.data();
                        if (isMjuSsoLogin) {
                            const rawMjuPatch = buildMjuUserPatchFromClaims(claims, currentUser, userData.createdAt || new Date().toISOString());
                            const mjuPatch = hasManualRoleOverride(userData, rawMjuPatch.role)
                                ? preserveManualRolePatch(rawMjuPatch, claims)
                                : rawMjuPatch;
                            await updateDoc(userDocRef, mjuPatch).catch((err) => {
                                console.warn('[Auth] Failed to update MJU SSO role:', err?.message || err);
                            });
                            userData = { ...userData, ...mjuPatch };
                        }
                        const role = userData.role || 'student';
                        const roleValidity = getRoleValidity({ ...userData, role });
                        const roleExpired = roleValidity.status === 'expired' && role !== 'general' && !isPendingRole(role);
                        const effectiveRole = roleExpired ? 'general' : role;
                        const normalizedRoleLabel = normalizeRoleLabel(role, userData.roleLabel);
                        if (normalizedRoleLabel !== userData.roleLabel) {
                            updateDoc(userDocRef, { roleLabel: normalizedRoleLabel }).catch((err) => {
                                console.warn('[Auth] Failed to normalize role label:', err?.message || err);
                            });
                        }
                        setUser(prev => ({
                            ...prev,
                            ...userData,
                            assignedRole: role,
                            assignedRoleLabel: normalizedRoleLabel,
                            role: effectiveRole,
                            roleLabel: roleExpired ? 'ผู้ใช้ทั่วไป (สิทธิ์เดิมหมดอายุ)' : normalizedRoleLabel,
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
                    } else if (isMjuSsoLogin) {
                        const createdAt = new Date().toISOString();
                        const newDoc = {
                            ...buildMjuUserPatchFromClaims(claims, currentUser, createdAt),
                            createdAt: serverTimestamp(),
                        };
                        await setDoc(userDocRef, newDoc);
                        if (!mounted) return;
                        setUser(prev => ({ ...prev, ...newDoc, role: newDoc.role }));
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
        const trimmedCode = String(code || '').trim();
        if (auth) {
            try {
                const response = await fetch('/api/admin-code-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: trimmedCode }),
                });
                const data = await response.json().catch(() => ({}));
                if (response.ok && data?.token) {
                    localStorage.removeItem('admin_bypass');
                    await signInWithCustomToken(auth, data.token);
                    return { success: true };
                }
                if (response.status === 401) {
                    return { success: false, error: 'รหัสผ่านไม่ถูกต้อง' };
                }
                console.warn('[Auth] Admin custom-token login unavailable:', data?.message || data?.error || response.status);
            } catch (err) {
                console.warn('[Auth] Admin custom-token login failed, using local fallback:', err?.message || err);
            }
        }

        if (trimmedCode === 'admin313') {
            const adminUser = buildAdminBypassUser();
            localStorage.setItem('admin_bypass', 'true');
            setUser(adminUser);
            return { success: true };
        }
        return { success: false, error: 'รหัสผ่านไม่ถูกต้อง' };
    };

    const loginWithEmail = async (email, password) => {
        if (!auth) return firebaseUnavailable();
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
        if (!auth || !googleProvider) return firebaseUnavailable();
        try {
            // Popup first — redirect has cookie-policy issues on modern
            // browsers. The popup resolution triggers onAuthStateChanged,
            // which creates the Firestore user doc if needed. We don't
            // await Firestore here so the caller returns as soon as auth
            // is established, letting <PublicRoute> navigate immediately.
            await signInWithPopup(auth, googleProvider);
            return { success: true };
        } catch (error) {
            const code = error?.code || 'auth/google-login-failed';
            console.error('Google login error:', code);

            if (code === 'auth/unauthorized-domain') {
                return {
                    success: false,
                    code,
                    error: 'Domain นี้ยังไม่ได้เพิ่มใน Firebase Console → Authentication → Settings → Authorized domains'
                };
            }

            // Popup blocked or otherwise unusable — fall back to redirect.
            if (code === 'auth/popup-blocked' ||
                code === 'auth/operation-not-supported-in-this-environment') {
                try {
                    await signInWithRedirect(auth, googleProvider);
                    return { success: true };
                } catch (redirectError) {
                    const redirectCode = redirectError?.code || 'auth/google-redirect-failed';
                    console.error('Google redirect error:', redirectCode);
                    return {
                        success: false,
                        code: redirectCode,
                        error: 'Google Login ล้มเหลว กรุณาตรวจสอบ Firebase Authorized domains แล้วลองใหม่'
                    };
                }
            }

            if (code === 'auth/popup-closed-by-user' ||
                code === 'auth/cancelled-popup-request') {
                return { success: false, code, error: 'คุณปิดหน้าต่าง Google Login กรุณาลองใหม่' };
            }

            if (code === 'auth/network-request-failed') {
                return { success: false, code, error: 'ไม่สามารถเชื่อมต่อเครือข่ายได้ กรุณาลองใหม่' };
            }

            return {
                success: false,
                code,
                error: 'Google Login ล้มเหลว กรุณาตรวจสอบ Firebase Authorized domains แล้วลองใหม่'
            };
        }
    };

    const loginWithMjuSso = async (returnTo = '/dashboard') => {
        if (!auth) return firebaseUnavailable();
        try {
            window.location.assign(buildMjuSsoStartUrl(returnTo));
            return { success: true, redirecting: true };
        } catch (error) {
            return {
                success: false,
                code: 'mju-sso/not-configured',
                error: error?.message || 'ยังไม่ได้ตั้งค่า MJU SSO'
            };
        }
    };

    const completeMjuSsoLogin = async (search, hash = '') => {
        if (!auth) return firebaseUnavailable();
        const callback = readMjuSsoCallback(search, hash);
        if (!callback.ok) {
            if (callback.exchangeCode) {
                const exchange = await exchangeMjuSsoCode({
                    code: callback.exchangeCode,
                    codeParam: callback.exchangeParam,
                    detectedParamKeys: callback.detectedParamKeys,
                });
                if (exchange.ok) {
                    try {
                        await signInWithCustomToken(auth, exchange.token);
                        clearMjuSsoState();
                        return { success: true, returnTo: sessionStorage.getItem('mju_sso_return_to') || '/dashboard' };
                    } catch (error) {
                        clearMjuSsoState();
                        return {
                            success: false,
                            code: error?.code || 'mju-sso/exchanged-token-failed',
                            error: error?.message || 'เข้าสู่ระบบด้วย token ที่แลกจาก MJU SSO ไม่สำเร็จ',
                            detectedParamKeys: callback.detectedParamKeys || [],
                        };
                    }
                }
                clearMjuSsoState();
                return {
                    success: false,
                    error: exchange.error,
                    detectedParamKeys: callback.detectedParamKeys || [],
                };
            }
            clearMjuSsoState();
            return {
                success: false,
                error: callback.error,
                detectedParamKeys: callback.detectedParamKeys || [],
            };
        }

        try {
            await signInWithCustomToken(auth, callback.token);
            clearMjuSsoState();
            return { success: true, returnTo: callback.returnTo };
        } catch (error) {
            clearMjuSsoState();
            const invalidCustomToken = ['auth/invalid-custom-token', 'auth/custom-token-mismatch'].includes(error?.code);
            return {
                success: false,
                code: error?.code || 'mju-sso/login-failed',
                error: invalidCustomToken
                    ? `ระบบแม่โจ้ส่งค่า ${callback.tokenParam || 'token'} กลับมาแล้ว แต่ยังใช้กับ Firebase ไม่ได้ ต้องมี backend/bridge แปลง token จาก MJU SSO เป็น Firebase custom token ก่อน`
                    : error?.message || 'เข้าสู่ระบบผ่านบัญชีแม่โจ้ไม่สำเร็จ',
                detectedParamKeys: callback.detectedParamKeys || [],
            };
        }
    };

    // Check if an email is already registered (used to catch duplicates
    // at step 1 of signup before the user fills out later steps).
    // Returns: { exists: boolean, methods: string[] } — `methods` is empty
    // for new emails and lists providers (password, google.com, …) otherwise.
    // On network/policy errors we return exists=false so signup can still
    // proceed and Firebase will surface the real error on createUser.
    const checkEmailExists = async (email) => {
        if (!auth) return { exists: false, methods: [] };
        try {
            const methods = await fetchSignInMethodsForEmail(auth, email);
            return { exists: methods.length > 0, methods };
        } catch (error) {
            console.warn('[checkEmailExists] failed:', error?.message || error);
            return { exists: false, methods: [] };
        }
    };

    const signup = async (email, password, userData) => {
        if (!auth || !db) return firebaseUnavailable();
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

    const logout = async (options = {}) => {
        try {
            const shouldRedirectToMjuSignout = user?.authProvider === 'mju_sso' && !options.localOnly;
            localStorage.removeItem('admin_bypass');
            if (auth) await signOut(auth);
            setUser(null);
            if (shouldRedirectToMjuSignout) {
                window.location.assign(buildMjuSsoSignoutUrl());
                return { success: true, redirecting: true };
            }
            return { success: true, redirecting: false };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const updateUserDoc = async (uid, patch) => {
        if (!db) return firebaseUnavailable();
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
            loginWithMjuSso,
            completeMjuSsoLogin,
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
