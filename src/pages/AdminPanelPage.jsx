import { useEffect, useMemo, useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import {
    Shield, Users, Clock, Briefcase, Building, Check, X, Search, Filter,
    RefreshCw, CheckCircle, AlertTriangle, UserCog, Mail, IdCard, CalendarDays,
    ScrollText, ShieldCheck, DatabaseZap, Activity
} from 'lucide-react';
import { canManageUsers, getRoleBadgeColor, getRoleInfo, isPendingRole } from '../utils/accessControl';
import { MANAGEABLE_ROLES, ROLE_LABELS_WITH_EN, getRoleInitial, normalizeRole } from '../constants/roles';
import {
    addRoleMonths,
    buildRoleValidityPatch,
    formatRoleDate,
    formatRoleRemainingText,
    fromRoleDateInput,
    getRoleDurationLabel,
    getRoleValidity,
    toRoleDateInput
} from '../utils/roleValidity';
import AdminAuditLog from '../components/AdminAuditLog';
import AdminAutoSyncPanel from '../components/AdminAutoSyncPanel';
import AdminDataAccuracyPanel from '../components/AdminDataAccuracyPanel';
import AdminAIUsagePanel from '../components/AdminAIUsagePanel';
import ExportPDFButton from '../components/ExportPDFButton';

const ROLE_LABELS = {
    ...ROLE_LABELS_WITH_EN,
    pending_staff: 'รอการอนุมัติ (Staff)',
    pending_chair: 'รอการอนุมัติ (Chair)'
};
const AVATAR_BY_ROLE = MANAGEABLE_ROLES.reduce((acc, role) => {
    acc[role] = getRoleInitial(role);
    return acc;
}, { pending_staff: 'S', pending_chair: 'C' });
const DEMO_USERS = [
    {
        uid: 'demo-pending-staff',
        name: 'เจ้าหน้าที่ตัวอย่าง',
        email: 'staff.demo@mju.ac.th',
        role: 'pending_staff',
        requestedRole: 'staff',
        roleLabel: ROLE_LABELS.pending_staff,
        status: 'pending',
        employeeId: 'SCI-DEMO-001',
        department: 'คณะวิทยาศาสตร์',
        createdAt: new Date().toISOString()
    },
    {
        uid: 'demo-chair',
        name: 'ประธานหลักสูตรตัวอย่าง',
        email: 'chair.demo@mju.ac.th',
        role: 'chair',
        roleLabel: ROLE_LABELS.chair,
        status: 'approved',
        employeeId: 'SCI-DEMO-002',
        department: 'วิทยาการคอมพิวเตอร์',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        ...buildRoleValidityPatch('chair', new Date(Date.now() - 86400000))
    },
    {
        uid: 'demo-student',
        name: 'นักศึกษาตัวอย่าง',
        email: 'student.demo@mju.ac.th',
        role: 'student',
        roleLabel: ROLE_LABELS.student,
        status: 'approved',
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        ...buildRoleValidityPatch('student', new Date(Date.now() - 172800000))
    }
];

const formatDate = (value) => {
    if (!value) return '-';
    try {
        let d;
        if (typeof value === 'string') d = new Date(value);
        else if (value?.toDate) d = value.toDate();
        else if (value?.seconds) d = new Date(value.seconds * 1000);
        else d = new Date(value);
        if (Number.isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
        return '-';
    }
};

const getRoleTermText = (validity) => {
    const remainingText = validity.remainingText || formatRoleRemainingText(validity);
    if (validity.status === 'expired') return `หมดอายุแล้ว ${remainingText}`;
    if (validity.status === 'expiring') return `ใกล้หมดอายุ เหลือ ${remainingText}`;
    return `เหลือ ${remainingText}`;
};

const getDisplayStatus = (u = {}) => {
    if (u.status === 'pending' || isPendingRole(u.role)) return 'pending';
    if (u.status === 'rejected') return 'rejected';
    return 'approved';
};

const hasManageableRoleTerm = (u = {}) =>
    MANAGEABLE_ROLES.includes(normalizeRole(u.role)) && getDisplayStatus(u) === 'approved';

function buildMissingRoleValidityPatch(u = {}) {
    if (!hasManageableRoleTerm(u)) return null;
    const validity = getRoleValidity(u);
    const patch = {};

    const normalizedRole = normalizeRole(u.role);
    if (u.role !== normalizedRole) patch.role = normalizedRole;
    if (!u.roleStartedAt) patch.roleStartedAt = validity.startedAt.toISOString();
    if (!u.roleExpiresAt) patch.roleExpiresAt = validity.expiresAt.toISOString();
    if (!Number(u.roleDurationYears)) patch.roleDurationYears = validity.durationYears;
    if (!u.status) patch.status = 'approved';
    if (!u.roleLabel || u.role !== normalizedRole) patch.roleLabel = ROLE_LABELS[normalizedRole];
    if (!u.avatar || u.role !== normalizedRole) patch.avatar = AVATAR_BY_ROLE[normalizedRole] || 'U';

    if (Object.keys(patch).length === 0) return null;
    return {
        ...patch,
        roleManagedAt: u.roleManagedAt || new Date().toISOString(),
        roleManagedBy: u.roleManagedBy || 'system-backfill',
    };
}

const normalizeUserRoleTerm = (u = {}) => {
    const patch = buildMissingRoleValidityPatch(u);
    return patch ? { ...u, ...patch } : u;
};

export default function AdminPanelPage() {
    const { user, updateUserDoc } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('pending');
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [confirmAction, setConfirmAction] = useState(null); // { type: 'approve'|'reject', user }
    const [toast, setToast] = useState(null); // { type, message }
    const [savingUid, setSavingUid] = useState(null);

    const canViewPanel = canManageUsers(user);
    const isAdminBypass = user?.uid?.startsWith('admin-bypass-');

    const showToast = useCallback((type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3200);
    }, []);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        if (isAdminBypass) {
            setUsers(DEMO_USERS);
            setLoading(false);
            return;
        }
        try {
            const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
            const snap = await getDocs(q);
            const rawList = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
            const list = rawList.map(normalizeUserRoleTerm);
            setUsers(list);

            const missingRoleTerms = rawList
                .map(u => ({ user: u, patch: buildMissingRoleValidityPatch(u) }))
                .filter(item => item.patch);
            if (missingRoleTerms.length > 0) {
                Promise.allSettled(
                    missingRoleTerms.map(({ user: targetUser, patch }) =>
                        updateUserDoc(targetUser.uid, patch)
                    )
                ).then(results => {
                    const failed = results.filter(result => result.status === 'rejected' || result.value?.success === false);
                    if (failed.length > 0) {
                        console.warn(`[AdminPanelPage] Role validity backfill failed for ${failed.length} user(s)`);
                    }
                });
            }
        } catch (err) {
            console.error('Load users error:', err);
            showToast('error', 'โหลดข้อมูลผู้ใช้ไม่สำเร็จ: ' + (err.message || 'unknown'));
        } finally {
            setLoading(false);
        }
    }, [isAdminBypass, showToast, updateUserDoc]);

    useEffect(() => {
        if (!canViewPanel) return undefined;
        const timer = window.setTimeout(() => {
            void loadUsers();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [canViewPanel, loadUsers]);

    const pendingUsers = useMemo(
        () => users.filter(u => getDisplayStatus(u) === 'pending'),
        [users]
    );

    const stats = useMemo(() => ({
        total: users.length,
        pending: pendingUsers.length,
        dean: users.filter(u => normalizeRole(u.role) === 'dean').length,
        chair: users.filter(u => normalizeRole(u.role) === 'chair').length,
        staff: users.filter(u => normalizeRole(u.role) === 'staff').length,
        general: users.filter(u => normalizeRole(u.role) === 'general').length,
        student: users.filter(u => normalizeRole(u.role) === 'student').length,
        admin: users.filter(u => normalizeRole(u.role) === 'admin').length,
        expiring: users.filter(u => hasManageableRoleTerm(u) && getRoleValidity(u).status === 'expiring').length,
        expired: users.filter(u => hasManageableRoleTerm(u) && getRoleValidity(u).status === 'expired').length
    }), [users, pendingUsers]);

    const filteredUsers = useMemo(() => {
        const s = search.trim().toLowerCase();
        return users.filter(u => {
            if (roleFilter !== 'all' && normalizeRole(u.role) !== roleFilter) return false;
            if (!s) return true;
            return (
                (u.name || '').toLowerCase().includes(s) ||
                (u.email || '').toLowerCase().includes(s)
            );
        });
    }, [users, search, roleFilter]);

    const saveRoleTimePatch = async (u, patch, successMessage) => {
        const nextPatch = {
            ...patch,
            roleManagedAt: new Date().toISOString(),
            roleManagedBy: user?.uid || user?.email || 'admin',
        };
        if (u.uid?.startsWith('demo-')) {
            setUsers(prev => prev.map(x => x.uid === u.uid ? { ...x, ...nextPatch } : x));
            showToast('success', successMessage);
            return;
        }
        setSavingUid(u.uid);
        const result = await updateUserDoc(u.uid, nextPatch);
        setSavingUid(null);
        if (result.success) {
            setUsers(prev => prev.map(x => x.uid === u.uid ? { ...x, ...nextPatch } : x));
            showToast('success', successMessage);
        } else {
            showToast('error', 'บันทึกระยะเวลา role ไม่สำเร็จ: ' + result.error);
        }
    };

    const handleRoleExpiryDateChange = async (u, value) => {
        const expiresAt = fromRoleDateInput(value);
        if (!expiresAt) return;
        const validity = getRoleValidity(u);
        if (expiresAt <= validity.startedAt) {
            showToast('error', 'วันหมดอายุต้องอยู่หลังวันเริ่มสิทธิ์');
            return;
        }
        await saveRoleTimePatch(u, {
            roleStartedAt: validity.startedAt.toISOString(),
            roleExpiresAt: expiresAt.toISOString(),
        }, `ปรับวันหมดอายุ role ของ ${u.name || u.email} แล้ว`);
    };

    const handleAdjustRoleTime = async (u, months) => {
        const validity = getRoleValidity(u);
        const expiresAt = addRoleMonths(validity.expiresAt, months);
        if (expiresAt <= validity.startedAt) {
            showToast('error', 'ไม่สามารถลดเวลาจนก่อนวันเริ่มสิทธิ์ได้');
            return;
        }
        const label = months > 0 ? `เพิ่ม ${Math.abs(months)} เดือน` : `ลด ${Math.abs(months)} เดือน`;
        await saveRoleTimePatch(u, {
            roleStartedAt: validity.startedAt.toISOString(),
            roleExpiresAt: expiresAt.toISOString(),
        }, `${label} ให้ ${u.name || u.email} แล้ว`);
    };

    const handleApprove = async (u) => {
        const requested = normalizeRole(u.requestedRole || (u.role === 'pending_staff' ? 'staff' : 'chair'));
        const info = getRoleInfo(requested);
        const roleLabel = ROLE_LABELS[requested] || (info?.label ? `${info.label} (${requested.charAt(0).toUpperCase() + requested.slice(1)})` : requested);
        const patch = {
            role: requested,
            roleLabel,
            avatar: AVATAR_BY_ROLE[requested] || 'U',
            status: 'approved',
            approvedBy: user?.uid || user?.email || 'admin',
            approvedAt: new Date().toISOString(),
            ...buildRoleValidityPatch(requested, new Date())
        };
        if (u.uid?.startsWith('demo-')) {
            setUsers(prev => prev.map(x => x.uid === u.uid ? { ...x, ...patch } : x));
            setConfirmAction(null);
            showToast('success', `อนุมัติ ${u.name || u.email} เป็น ${ROLE_LABELS[requested] || requested} เรียบร้อย`);
            return;
        }
        setSavingUid(u.uid);
        const result = await updateUserDoc(u.uid, patch);
        setSavingUid(null);
        setConfirmAction(null);
        if (result.success) {
            setUsers(prev => prev.map(x => x.uid === u.uid ? { ...x, ...patch } : x));
            showToast('success', `อนุมัติ ${u.name || u.email} เป็น ${ROLE_LABELS[requested] || requested} เรียบร้อย`);
        } else {
            showToast('error', 'อนุมัติไม่สำเร็จ: ' + result.error);
        }
    };

    const handleReject = async (u) => {
        const patch = {
            role: 'general',
            roleLabel: ROLE_LABELS.general,
            avatar: 'U',
            status: 'rejected',
            approvedBy: user?.uid || user?.email || 'admin',
            approvedAt: new Date().toISOString(),
            ...buildRoleValidityPatch('general', new Date())
        };
        if (u.uid?.startsWith('demo-')) {
            setUsers(prev => prev.map(x => x.uid === u.uid ? { ...x, ...patch } : x));
            setConfirmAction(null);
            showToast('success', `ปฏิเสธคำขอของ ${u.name || u.email} แล้ว`);
            return;
        }
        setSavingUid(u.uid);
        const result = await updateUserDoc(u.uid, patch);
        setSavingUid(null);
        setConfirmAction(null);
        if (result.success) {
            setUsers(prev => prev.map(x => x.uid === u.uid ? { ...x, ...patch } : x));
            showToast('success', `ปฏิเสธคำขอของ ${u.name || u.email} แล้ว`);
        } else {
            showToast('error', 'ปฏิเสธไม่สำเร็จ: ' + result.error);
        }
    };

    const handleChangeRole = async (u, newRole) => {
        if (u.uid === user?.uid) {
            showToast('error', 'ไม่สามารถเปลี่ยน role ของตัวเองได้');
            return;
        }
        const normalizedNewRole = normalizeRole(newRole);
        if (!MANAGEABLE_ROLES.includes(normalizedNewRole)) {
            showToast('error', 'role นี้ไม่อยู่ในชุดสิทธิ์ใหม่ของระบบ');
            return;
        }
        if (normalizedNewRole === normalizeRole(u.role)) return;
        const patch = {
            role: normalizedNewRole,
            roleLabel: ROLE_LABELS[normalizedNewRole] || normalizedNewRole,
            avatar: AVATAR_BY_ROLE[normalizedNewRole] || 'U',
            status: 'approved',
            approvedBy: user?.uid || user?.email || 'admin',
            approvedAt: new Date().toISOString(),
            ...buildRoleValidityPatch(normalizedNewRole, new Date())
        };
        if (u.uid?.startsWith('demo-')) {
            setUsers(prev => prev.map(x => x.uid === u.uid ? { ...x, ...patch } : x));
            showToast('success', `เปลี่ยน role ของ ${u.name || u.email} เป็น ${ROLE_LABELS[normalizedNewRole] || normalizedNewRole}`);
            return;
        }
        setSavingUid(u.uid);
        const result = await updateUserDoc(u.uid, patch);
        setSavingUid(null);
        if (result.success) {
            setUsers(prev => prev.map(x => x.uid === u.uid ? { ...x, ...patch } : x));
            showToast('success', `เปลี่ยน role ของ ${u.name || u.email} เป็น ${ROLE_LABELS[normalizedNewRole] || normalizedNewRole}`);
        } else {
            showToast('error', 'เปลี่ยน role ไม่สำเร็จ: ' + result.error);
        }
    };

    if (!canViewPanel) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <div className="admin-panel">
            <div className="admin-panel-header">
                <div className="admin-panel-title">
                    <div className="admin-panel-title-icon">
                        <Shield size={22} />
                    </div>
                    <div>
                        <h1>จัดการผู้ใช้ & สิทธิ์การเข้าถึง</h1>
                        <p>อนุมัติคำขอและบริหารสิทธิ์ระดับต่างๆ ของระบบ</p>
                    </div>
                </div>
                <div className="section-header-actions admin-panel-actions">
                    <ExportPDFButton title="admin_users_roles" />
                    <button
                        className="dashboard-header-action admin-refresh-btn"
                        onClick={loadUsers}
                        disabled={loading}
                        aria-label="โหลดข้อมูลใหม่"
                        data-tooltip="โหลดข้อมูลใหม่"
                    >
                        <RefreshCw size={15} className={loading ? 'spin-animation' : ''} />
                        รีเฟรช
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="admin-stats-grid">
                <div className="admin-stat-card">
                    <div className="admin-stat-icon" style={{ background: 'color-mix(in srgb, var(--accent-purple) 15%, transparent)', color: 'var(--accent-purple)' }}>
                        <Users size={22} />
                    </div>
                    <div>
                        <p className="admin-stat-label">ผู้ใช้ทั้งหมด</p>
                        <h2 className="admin-stat-value">{stats.total}</h2>
                    </div>
                </div>
                <div className={`admin-stat-card ${stats.pending > 0 ? 'pulse' : ''}`}>
                    <div className="admin-stat-icon" style={{ background: 'color-mix(in srgb, var(--accent-warning) 15%, transparent)', color: 'var(--accent-warning)' }}>
                        <Clock size={22} />
                    </div>
                    <div>
                        <p className="admin-stat-label">รออนุมัติ</p>
                        <h2 className="admin-stat-value" style={{ color: stats.pending > 0 ? 'var(--accent-warning)' : undefined }}>
                            {stats.pending}
                        </h2>
                    </div>
                </div>
                <div className="admin-stat-card">
                    <div className="admin-stat-icon" style={{ background: 'color-mix(in srgb, var(--accent-purple) 15%, transparent)', color: 'var(--accent-purple)' }}>
                        <ShieldCheck size={22} />
                    </div>
                    <div>
                        <p className="admin-stat-label">คณบดี (Dean)</p>
                        <h2 className="admin-stat-value">{stats.dean}</h2>
                    </div>
                </div>
                <div className="admin-stat-card">
                    <div className="admin-stat-icon" style={{ background: 'color-mix(in srgb, var(--accent-cyan) 15%, transparent)', color: 'var(--accent-cyan)' }}>
                        <IdCard size={22} />
                    </div>
                    <div>
                        <p className="admin-stat-label">ทั่วไป (General)</p>
                        <h2 className="admin-stat-value">{stats.general}</h2>
                    </div>
                </div>
                <div className="admin-stat-card">
                    <div className="admin-stat-icon" style={{ background: 'color-mix(in srgb, var(--accent-success-deep) 15%, transparent)', color: 'var(--accent-success)' }}>
                        <Briefcase size={22} />
                    </div>
                    <div>
                        <p className="admin-stat-label">เจ้าหน้าที่ (Staff)</p>
                        <h2 className="admin-stat-value">{stats.staff}</h2>
                    </div>
                </div>
                <div className="admin-stat-card">
                    <div className="admin-stat-icon" style={{ background: 'color-mix(in srgb, var(--accent-info) 15%, transparent)', color: 'var(--accent-info)' }}>
                        <Building size={22} />
                    </div>
                    <div>
                        <p className="admin-stat-label">หัวหน้าสาขา (Chair)</p>
                        <h2 className="admin-stat-value">{stats.chair}</h2>
                    </div>
                </div>
                <div className={`admin-stat-card ${stats.expiring > 0 ? 'pulse' : ''}`}>
                    <div className="admin-stat-icon" style={{ background: 'color-mix(in srgb, var(--accent-warning) 15%, transparent)', color: 'var(--accent-warning)' }}>
                        <CalendarDays size={22} />
                    </div>
                    <div>
                        <p className="admin-stat-label">Role ใกล้หมดอายุ</p>
                        <h2 className="admin-stat-value" style={{ color: stats.expiring > 0 ? 'var(--accent-warning)' : undefined }}>{stats.expiring}</h2>
                    </div>
                </div>
                <div className={`admin-stat-card ${stats.expired > 0 ? 'pulse' : ''}`}>
                    <div className="admin-stat-icon" style={{ background: 'color-mix(in srgb, var(--accent-danger) 15%, transparent)', color: 'var(--accent-danger)' }}>
                        <AlertTriangle size={22} />
                    </div>
                    <div>
                        <p className="admin-stat-label">Role หมดอายุ</p>
                        <h2 className="admin-stat-value" style={{ color: stats.expired > 0 ? 'var(--accent-danger)' : undefined }}>{stats.expired}</h2>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="admin-tabs">
                <button
                    className={`admin-tab ${activeTab === 'pending' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pending')}
                >
                    <Clock size={16} /> รออนุมัติ
                    {stats.pending > 0 && <span className="admin-tab-badge">{stats.pending}</span>}
                </button>
                <button
                    className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    <UserCog size={16} /> ผู้ใช้ทั้งหมด
                    <span className="admin-tab-badge neutral">{stats.total}</span>
                </button>
                <button
                    className={`admin-tab ${activeTab === 'audit' ? 'active' : ''}`}
                    onClick={() => setActiveTab('audit')}
                >
                    <ScrollText size={16} /> ประวัติการเปลี่ยนแปลง
                </button>
                <button
                    className={`admin-tab ${activeTab === 'auto_sync' ? 'active' : ''}`}
                    onClick={() => setActiveTab('auto_sync')}
                >
                    <DatabaseZap size={16} /> Auto Sync
                </button>
                <button
                    className={`admin-tab ${activeTab === 'data_accuracy' ? 'active' : ''}`}
                    onClick={() => setActiveTab('data_accuracy')}
                >
                    <ShieldCheck size={16} /> Data Accuracy
                </button>
                <button
                    className={`admin-tab ${activeTab === 'ai_usage' ? 'active' : ''}`}
                    onClick={() => setActiveTab('ai_usage')}
                >
                    <Activity size={16} /> AI Usage
                </button>
            </div>

            {/* Pending tab */}
            {activeTab === 'pending' && (
                <div className="admin-tab-panel">
                    {loading ? (
                        <div className="admin-empty-state">
                            <RefreshCw size={40} className="spin-animation" />
                            <p>กำลังโหลดข้อมูล...</p>
                        </div>
                    ) : pendingUsers.length === 0 ? (
                        <div className="admin-empty-state">
                            <CheckCircle size={48} color="var(--accent-success)" />
                            <h3>ไม่มีคำขอที่รออนุมัติ</h3>
                            <p>คำขอใหม่จะปรากฏที่นี่เมื่อมีผู้ใช้สมัครในสิทธิ์ Staff หรือ Chair</p>
                        </div>
                    ) : (
                        <div className="admin-pending-grid">
                            {pendingUsers.map(u => {
                                const requested = normalizeRole(u.requestedRole || (u.role === 'pending_staff' ? 'staff' : 'chair'));
                                return (
                                    <div key={u.uid} className="admin-pending-card">
                                        <div className="admin-pending-header">
                                            <div className="admin-pending-avatar" style={{ background: getRoleBadgeColor(u.role) }}>
                                                {(u.avatar && u.avatar.length <= 2) ? u.avatar : (u.name || 'U').charAt(0)}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <h3 className="admin-pending-name">{u.name || '(ไม่ระบุชื่อ)'}</h3>
                                                <span className="admin-pending-requested">
                                                    ขอสิทธิ์: <strong>{ROLE_LABELS[requested] || requested}</strong>
                                                </span>
                                            </div>
                                        </div>
                                        <div className="admin-pending-body">
                                            <div className="admin-pending-row"><Mail size={14} /> {u.email || '-'}</div>
                                            <div className="admin-pending-row"><IdCard size={14} /> รหัสพนักงาน: {u.employeeId || '-'}</div>
                                            <div className="admin-pending-row"><Building size={14} /> {u.department || '-'}</div>
                                            <div className="admin-pending-row"><CalendarDays size={14} /> ส่งคำขอ: {formatDate(u.createdAt)}</div>
                                            <div className="admin-pending-row"><Clock size={14} /> ระยะสิทธิ์หลังอนุมัติ: {getRoleDurationLabel(requested)}</div>
                                            {u.reason && (
                                                <div className="admin-pending-reason">
                                                    <strong>เหตุผล:</strong>
                                                    <p>{u.reason}</p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="admin-pending-actions">
                                            <button
                                                className="admin-btn-approve"
                                                onClick={() => setConfirmAction({ type: 'approve', user: u })}
                                                disabled={savingUid === u.uid}
                                            >
                                                <Check size={16} /> อนุมัติ
                                            </button>
                                            <button
                                                className="admin-btn-reject"
                                                onClick={() => setConfirmAction({ type: 'reject', user: u })}
                                                disabled={savingUid === u.uid}
                                            >
                                                <X size={16} /> ปฏิเสธ
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Users tab */}
            {activeTab === 'users' && (
                <div className="admin-tab-panel">
                    <div className="admin-toolbar">
                        <div className="admin-search-wrapper">
                            <Search size={16} />
                            <input
                                type="text"
                                placeholder="ค้นหาชื่อหรืออีเมล..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="admin-filter-wrapper">
                            <Filter size={16} />
                            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                                <option value="all">ทุกตำแหน่ง</option>
                                {MANAGEABLE_ROLES.map(role => (
                                    <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {loading ? (
                        <div className="admin-empty-state">
                            <RefreshCw size={40} className="spin-animation" />
                            <p>กำลังโหลดข้อมูล...</p>
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="admin-empty-state">
                            <Users size={48} color="var(--text-muted)" />
                            <h3>ไม่พบผู้ใช้ที่ตรงกับเงื่อนไข</h3>
                            <p>ลองเปลี่ยนคำค้นหาหรือ filter</p>
                        </div>
                    ) : (
                        <div className="admin-users-table-wrapper">
                            <table className="admin-users-table">
                                <colgroup>
                                    <col className="admin-col-user" />
                                    <col className="admin-col-email" />
                                    <col className="admin-col-status" />
                                    <col className="admin-col-role" />
                                    <col className="admin-col-term" />
                                    <col className="admin-col-actions" />
                                    <col className="admin-col-date" />
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th>ผู้ใช้</th>
                                        <th>อีเมล</th>
                                        <th>สถานะ</th>
                                        <th>ตำแหน่ง</th>
                                        <th>ระยะสิทธิ์</th>
                                        <th>ปรับเวลา</th>
                                        <th>วันที่สมัคร</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map(u => {
                                        const isSelf = u.uid === user?.uid;
                                        const normalizedUserRole = normalizeRole(u.role);
                                        const validity = getRoleValidity(u);
                                        const canManageTime = hasManageableRoleTerm(u);
                                        const statusClass = getDisplayStatus(u);
                                        return (
                                            <tr key={u.uid}>
                                                <td>
                                                    <div className="admin-user-cell">
                                                        <div className="admin-user-avatar" style={{ background: getRoleBadgeColor(u.role) }}>
                                                            {(u.avatar && u.avatar.length <= 2) ? u.avatar : (u.name || 'U').charAt(0)}
                                                        </div>
                                                        <div style={{ minWidth: 0 }}>
                                                            <div className="admin-user-name">{u.name || '(ไม่ระบุ)'}{isSelf && <span className="admin-user-self"> (คุณ)</span>}</div>
                                                            {u.employeeId && <div className="admin-user-meta">{u.employeeId}{u.department ? ` · ${u.department}` : ''}</div>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="admin-cell-email">{u.email || '-'}</td>
                                                <td className="admin-status-cell">
                                                    <span className={`admin-status-badge ${statusClass}`}>
                                                        {statusClass === 'pending' ? 'รออนุมัติ' : statusClass === 'rejected' ? 'ปฏิเสธ' : 'อนุมัติแล้ว'}
                                                    </span>
                                                </td>
                                                <td className="admin-role-cell">
                                                    <select
                                                        className="admin-role-select"
                                                        value={MANAGEABLE_ROLES.includes(normalizedUserRole) ? normalizedUserRole : ''}
                                                        onChange={(e) => handleChangeRole(u, e.target.value)}
                                                        disabled={isSelf || savingUid === u.uid}
                                                        style={{ borderColor: getRoleBadgeColor(normalizedUserRole) }}
                                                        title={ROLE_LABELS[normalizedUserRole] || normalizedUserRole}
                                                    >
                                                        {!MANAGEABLE_ROLES.includes(normalizedUserRole) && (
                                                            <option value="" disabled>{ROLE_LABELS[normalizedUserRole] || normalizedUserRole}</option>
                                                        )}
                                                        {MANAGEABLE_ROLES.map(r => (
                                                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="admin-term-cell">
                                                    {canManageTime ? (
                                                        <div className="admin-role-term">
                                                            <span className={`admin-term-badge ${validity.status}`}>
                                                                {getRoleTermText(validity)}
                                                            </span>
                                                            <div className="admin-term-dates">
                                                                <CalendarDays size={13} />
                                                                <span>{formatRoleDate(validity.startedAt)} - {formatRoleDate(validity.expiresAt)}</span>
                                                            </div>
                                                            <div className="admin-term-meta">
                                                                ระยะมาตรฐาน {getRoleDurationLabel(u.role)}
                                                            </div>
                                                            <div className="admin-term-progress" aria-hidden="true">
                                                                <span style={{ width: `${validity.progress}%` }} />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="admin-term-muted">
                                                            {statusClass === 'pending'
                                                                ? `รออนุมัติ · หลังอนุมัติ ${getRoleDurationLabel(u.requestedRole || 'general')}`
                                                                : '-'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="admin-time-cell">
                                                    {canManageTime ? (
                                                        <div className="admin-role-time-actions">
                                                            <input
                                                                type="date"
                                                                value={toRoleDateInput(validity.expiresAt)}
                                                                onChange={(e) => handleRoleExpiryDateChange(u, e.target.value)}
                                                                disabled={savingUid === u.uid}
                                                                aria-label={`กำหนดวันหมดอายุ role ของ ${u.name || u.email || 'user'}`}
                                                            />
                                                            <div className="admin-role-time-shortcuts">
                                                                <button type="button" onClick={() => handleAdjustRoleTime(u, -12)} disabled={savingUid === u.uid}>-1 ปี</button>
                                                                <button type="button" onClick={() => handleAdjustRoleTime(u, -6)} disabled={savingUid === u.uid}>-6 ด.</button>
                                                                <button type="button" onClick={() => handleAdjustRoleTime(u, 6)} disabled={savingUid === u.uid}>+6 ด.</button>
                                                                <button type="button" onClick={() => handleAdjustRoleTime(u, 12)} disabled={savingUid === u.uid}>+1 ปี</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="admin-term-muted">{statusClass === 'pending' ? 'จัดการหลังอนุมัติ' : '-'}</span>
                                                    )}
                                                </td>
                                                <td className="admin-cell-date">{formatDate(u.createdAt)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Audit log tab */}
            {activeTab === 'audit' && (
                <div className="admin-tab-panel">
                    <AdminAuditLog />
                </div>
            )}

            {activeTab === 'auto_sync' && (
                <div className="admin-tab-panel">
                    <AdminAutoSyncPanel onToast={showToast} />
                </div>
            )}

            {activeTab === 'data_accuracy' && (
                <div className="admin-tab-panel">
                    <AdminDataAccuracyPanel onToast={showToast} />
                </div>
            )}

            {activeTab === 'ai_usage' && (
                <div className="admin-tab-panel">
                    <AdminAIUsagePanel onToast={showToast} />
                </div>
            )}

            {/* Confirm modal */}
            {confirmAction && (
                <div className="admin-modal-overlay" onClick={() => setConfirmAction(null)}>
                    <div className="admin-modal" onClick={e => e.stopPropagation()}>
                        <div className={`admin-modal-icon ${confirmAction.type}`}>
                            {confirmAction.type === 'approve' ? <CheckCircle size={32} /> : <AlertTriangle size={32} />}
                        </div>
                        <h2>
                            {confirmAction.type === 'approve' ? 'ยืนยันการอนุมัติ?' : 'ยืนยันการปฏิเสธคำขอ?'}
                        </h2>
                        <p>
                            {confirmAction.type === 'approve'
                                ? (() => {
                                    const requested = normalizeRole(confirmAction.user.requestedRole || (confirmAction.user.role === 'pending_staff' ? 'staff' : 'chair'));
                                    return <>จะให้สิทธิ์ <strong>{ROLE_LABELS[requested] || requested}</strong> แก่ <strong>{confirmAction.user.name}</strong> โดยเริ่มวันนี้และหมดอายุใน {getRoleDurationLabel(requested)}</>;
                                })()
                                : <>คำขอของ <strong>{confirmAction.user.name}</strong> จะถูกปฏิเสธ และถูกลดสิทธิ์เป็นผู้ใช้ทั่วไป</>}
                        </p>
                        <div className="admin-modal-actions">
                            <button className="admin-btn-ghost" onClick={() => setConfirmAction(null)} disabled={!!savingUid}>
                                ยกเลิก
                            </button>
                            <button
                                className={confirmAction.type === 'approve' ? 'admin-btn-approve' : 'admin-btn-reject'}
                                onClick={() => confirmAction.type === 'approve' ? handleApprove(confirmAction.user) : handleReject(confirmAction.user)}
                                disabled={!!savingUid}
                            >
                                {savingUid ? 'กำลังบันทึก...' : (confirmAction.type === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className={`admin-toast ${toast.type}`}>
                    {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                    <span>{toast.message}</span>
                </div>
            )}
        </div>
    );
}
