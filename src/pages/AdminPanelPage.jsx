import { useEffect, useMemo, useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, doc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';
import {
    Shield, Users, Clock, Briefcase, Building, Check, X, Search, Filter,
    RefreshCw, CheckCircle, AlertTriangle, UserCog, Mail, IdCard, CalendarDays,
    Database, ScrollText
} from 'lucide-react';
import { canAccess, getRoleBadgeColor, getRoleInfo, isPendingRole } from '../utils/accessControl';
import {
    addRoleMonths,
    buildRoleValidityPatch,
    formatRoleDate,
    fromRoleDateInput,
    getRoleDurationLabel,
    getRoleValidity,
    toRoleDateInput
} from '../utils/roleValidity';
import AdminDataUpload from '../components/AdminDataUpload';
import AdminAuditLog from '../components/AdminAuditLog';
import AdminAutoSyncPanel from '../components/AdminAutoSyncPanel';
import ExportPDFButton from '../components/ExportPDFButton';

const MANAGEABLE_ROLES = ['dean', 'chair', 'staff', 'general', 'student'];
const ROLE_LABELS = {
    dean: 'คณบดี (Dean)',
    chair: 'ประธานหลักสูตร (Chair)',
    staff: 'เจ้าหน้าที่ (Staff)',
    general: 'ผู้ใช้ทั่วไป (General)',
    student: 'นักศึกษา (Student)',
    pending_staff: 'รอการอนุมัติ (Staff)',
    pending_chair: 'รอการอนุมัติ (Chair)'
};
const AVATAR_BY_ROLE = { dean: 'D', chair: 'C', staff: 'S', general: 'U', student: 'U' };
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
    if (validity.status === 'expired') return `หมดอายุแล้ว ${Math.abs(validity.daysRemaining).toLocaleString('th-TH')} วัน`;
    if (validity.status === 'expiring') return `ใกล้หมดอายุ เหลือ ${validity.daysRemaining.toLocaleString('th-TH')} วัน`;
    return `เหลือ ${validity.daysRemaining.toLocaleString('th-TH')} วัน`;
};

const getDisplayStatus = (u = {}) => {
    if (u.status === 'pending' || isPendingRole(u.role)) return 'pending';
    if (u.status === 'rejected') return 'rejected';
    return 'approved';
};

const hasManageableRoleTerm = (u = {}) =>
    MANAGEABLE_ROLES.includes(u.role) && getDisplayStatus(u) === 'approved';

function buildMissingRoleValidityPatch(u = {}) {
    if (!hasManageableRoleTerm(u)) return null;
    const validity = getRoleValidity(u);
    const patch = {};

    if (!u.roleStartedAt) patch.roleStartedAt = validity.startedAt.toISOString();
    if (!u.roleExpiresAt) patch.roleExpiresAt = validity.expiresAt.toISOString();
    if (!Number(u.roleDurationYears)) patch.roleDurationYears = validity.durationYears;
    if (!u.status) patch.status = 'approved';
    if (!u.roleLabel && ROLE_LABELS[u.role]) patch.roleLabel = ROLE_LABELS[u.role];
    if (!u.avatar) patch.avatar = AVATAR_BY_ROLE[u.role] || 'U';

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

    const canViewPanel = canAccess(user?.role, 'admin_panel');
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
                        updateDoc(doc(db, 'users', targetUser.uid), patch)
                    )
                ).then(results => {
                    const failed = results.filter(result => result.status === 'rejected');
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
    }, [isAdminBypass, showToast]);

    useEffect(() => {
        if (canViewPanel) loadUsers();
    }, [canViewPanel, loadUsers]);

    const pendingUsers = useMemo(
        () => users.filter(u => getDisplayStatus(u) === 'pending'),
        [users]
    );

    const stats = useMemo(() => ({
        total: users.length,
        pending: pendingUsers.length,
        staff: users.filter(u => u.role === 'staff').length,
        chair: users.filter(u => u.role === 'chair').length,
        expiring: users.filter(u => hasManageableRoleTerm(u) && getRoleValidity(u).status === 'expiring').length,
        expired: users.filter(u => hasManageableRoleTerm(u) && getRoleValidity(u).status === 'expired').length
    }), [users, pendingUsers]);

    const filteredUsers = useMemo(() => {
        const s = search.trim().toLowerCase();
        return users.filter(u => {
            if (roleFilter !== 'all' && u.role !== roleFilter) return false;
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
        const requested = u.requestedRole || (u.role === 'pending_staff' ? 'staff' : 'chair');
        const info = getRoleInfo(requested);
        const patch = {
            role: requested,
            roleLabel: info?.label ? `${info.label} (${requested.charAt(0).toUpperCase() + requested.slice(1)})` : ROLE_LABELS[requested],
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
        if (newRole === u.role) return;
        const patch = {
            role: newRole,
            roleLabel: ROLE_LABELS[newRole] || newRole,
            avatar: AVATAR_BY_ROLE[newRole] || 'U',
            status: 'approved',
            approvedBy: user?.uid || user?.email || 'admin',
            approvedAt: new Date().toISOString(),
            ...buildRoleValidityPatch(newRole, new Date())
        };
        if (u.uid?.startsWith('demo-')) {
            setUsers(prev => prev.map(x => x.uid === u.uid ? { ...x, ...patch } : x));
            showToast('success', `เปลี่ยน role ของ ${u.name || u.email} เป็น ${ROLE_LABELS[newRole] || newRole}`);
            return;
        }
        setSavingUid(u.uid);
        const result = await updateUserDoc(u.uid, patch);
        setSavingUid(null);
        if (result.success) {
            setUsers(prev => prev.map(x => x.uid === u.uid ? { ...x, ...patch } : x));
            showToast('success', `เปลี่ยน role ของ ${u.name || u.email} เป็น ${ROLE_LABELS[newRole] || newRole}`);
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
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <ExportPDFButton title="admin_users_roles" />
                    <button
                        className="admin-refresh-btn"
                        onClick={loadUsers}
                        disabled={loading}
                        aria-label="โหลดข้อมูลใหม่"
                        data-tooltip="โหลดข้อมูลใหม่"
                    >
                        <RefreshCw size={16} className={loading ? 'spin-animation' : ''} />
                        รีเฟรช
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="admin-stats-grid">
                <div className="admin-stat-card">
                    <div className="admin-stat-icon" style={{ background: 'rgba(123,104,238,0.15)', color: '#7B68EE' }}>
                        <Users size={22} />
                    </div>
                    <div>
                        <p className="admin-stat-label">ผู้ใช้ทั้งหมด</p>
                        <h2 className="admin-stat-value">{stats.total}</h2>
                    </div>
                </div>
                <div className={`admin-stat-card ${stats.pending > 0 ? 'pulse' : ''}`}>
                    <div className="admin-stat-icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                        <Clock size={22} />
                    </div>
                    <div>
                        <p className="admin-stat-label">รออนุมัติ</p>
                        <h2 className="admin-stat-value" style={{ color: stats.pending > 0 ? '#F59E0B' : undefined }}>
                            {stats.pending}
                        </h2>
                    </div>
                </div>
                <div className="admin-stat-card">
                    <div className="admin-stat-icon" style={{ background: 'rgba(0,104,56,0.15)', color: '#00a651' }}>
                        <Briefcase size={22} />
                    </div>
                    <div>
                        <p className="admin-stat-label">เจ้าหน้าที่ (Staff)</p>
                        <h2 className="admin-stat-value">{stats.staff}</h2>
                    </div>
                </div>
                <div className="admin-stat-card">
                    <div className="admin-stat-icon" style={{ background: 'rgba(46,134,171,0.15)', color: '#2E86AB' }}>
                        <Building size={22} />
                    </div>
                    <div>
                        <p className="admin-stat-label">ประธานหลักสูตร (Chair)</p>
                        <h2 className="admin-stat-value">{stats.chair}</h2>
                    </div>
                </div>
                <div className={`admin-stat-card ${stats.expiring > 0 ? 'pulse' : ''}`}>
                    <div className="admin-stat-icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                        <CalendarDays size={22} />
                    </div>
                    <div>
                        <p className="admin-stat-label">Role ใกล้หมดอายุ</p>
                        <h2 className="admin-stat-value" style={{ color: stats.expiring > 0 ? '#F59E0B' : undefined }}>{stats.expiring}</h2>
                    </div>
                </div>
                <div className={`admin-stat-card ${stats.expired > 0 ? 'pulse' : ''}`}>
                    <div className="admin-stat-icon" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                        <AlertTriangle size={22} />
                    </div>
                    <div>
                        <p className="admin-stat-label">Role หมดอายุ</p>
                        <h2 className="admin-stat-value" style={{ color: stats.expired > 0 ? '#ef4444' : undefined }}>{stats.expired}</h2>
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
                    className={`admin-tab ${activeTab === 'data' ? 'active' : ''}`}
                    onClick={() => setActiveTab('data')}
                >
                    <Database size={16} /> ข้อมูลระบบ
                </button>
                <button
                    className={`admin-tab ${activeTab === 'sync' ? 'active' : ''}`}
                    onClick={() => setActiveTab('sync')}
                >
                    <Database size={16} /> Auto Sync
                </button>
                <button
                    className={`admin-tab ${activeTab === 'audit' ? 'active' : ''}`}
                    onClick={() => setActiveTab('audit')}
                >
                    <ScrollText size={16} /> ประวัติการเปลี่ยนแปลง
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
                            <CheckCircle size={48} color="#00a651" />
                            <h3>ไม่มีคำขอที่รออนุมัติ</h3>
                            <p>คำขอใหม่จะปรากฏที่นี่เมื่อมีผู้ใช้สมัครในสิทธิ์ Staff หรือ Chair</p>
                        </div>
                    ) : (
                        <div className="admin-pending-grid">
                            {pendingUsers.map(u => {
                                const requested = u.requestedRole || (u.role === 'pending_staff' ? 'staff' : 'chair');
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
                                <option value="all">ทุก Role</option>
                                <option value="dean">คณบดี (Dean)</option>
                                <option value="chair">Chair</option>
                                <option value="staff">Staff</option>
                                <option value="general">General</option>
                                <option value="student">Student</option>
                                <option value="pending_staff">รอ: Staff</option>
                                <option value="pending_chair">รอ: Chair</option>
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
                                        <th>Role</th>
                                        <th>ระยะสิทธิ์ Role</th>
                                        <th>ปรับเวลา</th>
                                        <th>วันที่สมัคร</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map(u => {
                                        const isSelf = u.uid === user?.uid;
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
                                                <td>
                                                    <span className={`admin-status-badge ${statusClass}`}>
                                                        {statusClass === 'pending' ? 'รออนุมัติ' : statusClass === 'rejected' ? 'ปฏิเสธ' : 'อนุมัติแล้ว'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <select
                                                        className="admin-role-select"
                                                        value={MANAGEABLE_ROLES.includes(u.role) ? u.role : ''}
                                                        onChange={(e) => handleChangeRole(u, e.target.value)}
                                                        disabled={isSelf || savingUid === u.uid}
                                                        style={{ borderColor: getRoleBadgeColor(u.role) }}
                                                    >
                                                        {!MANAGEABLE_ROLES.includes(u.role) && (
                                                            <option value="" disabled>{ROLE_LABELS[u.role] || u.role}</option>
                                                        )}
                                                        {MANAGEABLE_ROLES.map(r => (
                                                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td>
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
                                                <td>
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

            {/* Data management tab */}
            {activeTab === 'data' && (
                <div className="admin-tab-panel">
                    <AdminDataUpload onToast={showToast} />
                </div>
            )}

            {/* Auto sync tab */}
            {activeTab === 'sync' && (
                <div className="admin-tab-panel">
                    <AdminAutoSyncPanel onToast={showToast} />
                </div>
            )}

            {/* Audit log tab */}
            {activeTab === 'audit' && (
                <div className="admin-tab-panel">
                    <AdminAuditLog />
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
                                    const requested = confirmAction.user.requestedRole || (confirmAction.user.role === 'pending_staff' ? 'staff' : 'chair');
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
