import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canAccess, getRoleBadgeColor } from '../utils/accessControl';
import {
    Home, CreditCard, DollarSign, Users, LogOut, Lock, FileText,
    GraduationCap, CheckCircle, BarChart3,
    Microscope, Target, UserCheck, BookOpen, Award,
    MessageCircle, Shield, UserCog, Clock
} from 'lucide-react';

const menuGroups = [
    {
        id: 'home',
        label: 'OVERVIEW',
        items: [
            { path: '/dashboard', label: 'ภาพรวม (Overview)', icon: Home, section: 'dashboard' },
        ]
    },
    {
        id: 'hr',
        label: 'บุคลากร · HR',
        items: [
            { path: '/dashboard/hr', label: 'ภาพรวมบุคลากร', icon: UserCheck, section: 'hr_overview' },
        ]
    },
    {
        id: 'student',
        label: 'นักศึกษา · STUDENT',
        items: [
            { path: '/dashboard/student-stats', label: 'สถิตินิสิตปัจจุบัน', icon: BarChart3, section: 'student_stats' },
            { path: '/dashboard/students', label: 'รายชื่อนักศึกษา', icon: GraduationCap, section: 'student_list' },
            { path: '/dashboard/graduation', label: 'ตรวจสอบการจบ', icon: CheckCircle, section: 'graduation_check' },
            { path: '/dashboard/student-life', label: 'กิจกรรม/พฤติกรรม', icon: Users, section: 'student_life' },
            { path: '/dashboard/graduation-stats', label: 'สถิติสำเร็จการศึกษา', icon: Award, section: 'graduation_stats' },
        ]
    },
    {
        id: 'research',
        label: 'การวิจัย · RESEARCH',
        items: [
            { path: '/dashboard/research', label: 'ภาพรวมงานวิจัย', icon: BookOpen, section: 'research_overview' },
        ]
    },
    {
        id: 'finance',
        label: 'การเงิน · FINANCE',
        items: [
            { path: '/dashboard/financial', label: 'รายรับ-รายจ่าย', icon: DollarSign, section: 'financial' },
            { path: '/dashboard/tuition', label: 'ค่าธรรมเนียมการศึกษา', icon: CreditCard, section: 'tuition' },
            { path: '/dashboard/budget', label: 'พยากรณ์งบประมาณ', icon: FileText, section: 'budget_forecast' },
        ]
    },
    {
        id: 'strategic',
        label: 'ยุทธศาสตร์ · OKR',
        items: [
            { path: '/dashboard/strategic', label: 'เป้าหมายยุทธศาสตร์', icon: Target, section: 'strategic_overview' },
        ]
    },
    {
        id: 'ai_chat',
        label: 'ผู้ช่วย AI · AI',
        items: [
            { path: '/dashboard/ai-chat', label: 'แชทกับ AI', icon: MessageCircle, section: 'ai_chat' },
        ]
    },
    {
        id: 'admin',
        label: 'จัดการระบบ · ADMIN',
        items: [
            { path: '/dashboard/admin', label: 'จัดการผู้ใช้/สิทธิ์', icon: UserCog, section: 'admin_panel' },
        ]
    }
];

export default function Sidebar({ isOpen, onClose }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const badgeColor = getRoleBadgeColor(user?.role);

    return (
        <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
            <div className="sidebar-header">
                <div className="sidebar-logo">SCI</div>
                <div className="sidebar-title">
                    <h2>Science AI Dashboard</h2>
                    <p>คณะวิทยาศาสตร์ มจ.</p>
                </div>
            </div>

            <nav className="sidebar-nav">
                {menuGroups.map((group) => {
                    const hasAnyAccess = group.items.some(item => canAccess(user?.role, item.section));
                    if (!hasAnyAccess && group.id !== 'home') {
                        // Still render label for visual structure; items will show lock icons
                    }

                    return (
                        <div key={group.id} className="nav-section">
                            <div className="nav-section-label">{group.label}</div>
                            <div className="nav-section-items">
                                {group.items.map(item => {
                                    const Icon = item.icon;
                                    const hasAccess = canAccess(user?.role, item.section);
                                    return (
                                        <NavLink
                                            key={item.path}
                                            to={hasAccess ? item.path : '#'}
                                            end={item.path === '/dashboard'}
                                            className={({ isActive }) =>
                                                `nav-item ${isActive && hasAccess ? 'active' : ''} ${!hasAccess ? 'locked' : ''}`
                                            }
                                            onClick={(e) => { if (!hasAccess) e.preventDefault(); onClose(); }}
                                        >
                                            <Icon size={18} />
                                            <span>{item.label}</span>
                                            {!hasAccess && <Lock className="lock-icon" size={14} />}
                                        </NavLink>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </nav>

            <div className="sidebar-footer">
                <div className="sidebar-user">
                    <div className="sidebar-avatar">
                        {user?.avatar && user.avatar.startsWith('http') ? (
                            <img src={user.avatar} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '10px', objectFit: 'cover' }} />
                        ) : (
                            user?.avatar
                        )}
                    </div>
                    <div className="sidebar-user-info">
                        <div className="sidebar-user-name">{user?.name}</div>
                        <span className="sidebar-user-role" style={{ background: `${badgeColor}22`, color: badgeColor }}>
                            {user?.roleLabel}
                        </span>
                        {user?.isPending && (
                            <span className="sidebar-pending-badge" title="คำขอของคุณรอผู้ดูแลระบบอนุมัติ">
                                <Clock size={10} /> รอการอนุมัติ
                            </span>
                        )}
                    </div>
                    <button className="logout-btn" onClick={handleLogout} title="ออกจากระบบ">
                        <LogOut size={18} />
                    </button>
                </div>
                <div className="sidebar-status-row">
                    <span className="sidebar-status-dot" />
                    <span className="sidebar-status-text">ออนไลน์</span>
                    <span className="sidebar-version">v1.0.0</span>
                </div>
            </div>
        </aside>
    );
}
