import { useEffect, useMemo, useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import {
    Shield, Users, Clock, Briefcase, Building, Check, X, Search, Filter,
    RefreshCw, CheckCircle, AlertTriangle, UserCog, Mail, IdCard, CalendarDays,
    Database, ScrollText
} from 'lucide-react';
import { canAccess, getRoleBadgeColor, getRoleInfo } from '../utils/accessControl';
import AdminDataUpload from '../components/AdminDataUpload';
import AdminAuditLog from '../components/AdminAuditLog';

const MANAGEABLE_ROLES = ['dean', 'chair', 'staff', 'general', 'student'];
const ROLE_LABELS = {
    dean: 'ผจก.คณะ (Dean)',
    chair: 'ประธานหลักสูตร (Chair)',
    staff: 'เจ้าหน้าที่ (Staff)',
    general: 'ผู้ใช้ทั่วไป (General)',
    student: 'นักศึกษา (Student)',
    pending_staff: 'รอการอนุมัติ (Staff)',
    pending_chair: 'รอการอนุมัติ (Chair)'
};
const AVATAR_BY_ROLE = { dean: 'D', chair: 'C', staff: 'S', general: 'U', student: 'U' };

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

    const showToast = useCallback((type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3200);
    }, []);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
            setUsers(list);
        } catch (err) {
            console.error('Load users error:', err);
            showToast('error', 'โหลดข้อมูลผู้ใช้ไม่สำเร็จ: ' + (err.message || 'unknown'));
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        if (canViewPanel) loadUsers();
    }, [canViewPanel, loadUsers]);

    const pendingUsers = useMemo(
        () => users.filter(u => u.status === 'pending'),
        [users]
    );

    const stats = useMemo(() => ({
        total: users.length,
        pending: pendingUsers.length,
        staff: users.filter(u => u.role === 'staff').length,
        chair: users.filter(u => u.role === 'chair').length
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

    const handleApprove = async (u) => {
        const requested = u.requestedRole || (u.role === 'pending_staff' ? 'staff' : 'chair');
        const info = getRoleInfo(requested);
        const patch = {
            role: requested,
            roleLabel: info?.label ? `${info.label} (${requested.charAt(0).toUpperCase() + requested.slice(1)})` : ROLE_LABELS[requested],
            avatar: AVATAR_BY_ROLE[requested] || 'U',
            status: 'approved',
            approvedBy: user?.uid || user?.email || 'admin',
            approvedAt: new Date().toISOString()
        };
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
            approvedAt: new Date().toISOString()
        };
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
            approvedAt: new Date().toISOString()
        };
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
                                <option value="dean">Dean</option>
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
                                <thead>
                                    <tr>
                                        <th>ผู้ใช้</th>
                                        <th>อีเมล</th>
                                        <th>สถานะ</th>
                                        <th>Role</th>
                                        <th>วันที่สมัคร</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map(u => {
                                        const isSelf = u.uid === user?.uid;
                                        const statusClass =
                                            u.status === 'pending' ? 'pending'
                                                : u.status === 'rejected' ? 'rejected'
                                                    : 'approved';
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
                                                        {u.status === 'pending' ? 'รออนุมัติ' : u.status === 'rejected' ? 'ปฏิเสธ' : 'อนุมัติแล้ว'}
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
                                ? <>จะให้สิทธิ์ <strong>{ROLE_LABELS[confirmAction.user.requestedRole] || confirmAction.user.requestedRole}</strong> แก่ <strong>{confirmAction.user.name}</strong></>
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
