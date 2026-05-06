import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { canAccess, getRoleBadgeColor } from '../utils/accessControl';
import { prefetchRoute } from '../utils/routePrefetch';
import { getAITokenBudgetSnapshot } from '../services/geminiService';
import { APP_NAME_FULL, APP_NAME_SHORT_EN, APP_NAME_SHORT_TH } from '../config/appBrand';
import {
    Home, CreditCard, DollarSign, LogOut, Lock, FileText,
    GraduationCap, CheckCircle, BarChart3,
    Microscope, Target, UserCheck, BookOpen, Award,
    Shield, UserCog, Clock, Bell, Bot, Settings,
    ChevronRight, UserRound, Palette, Activity, ScrollText, CalendarDays,
    ClipboardList, X
} from 'lucide-react';

const FEATURED_AI_CHAT = {
    path: '/dashboard/ai-chat',
    label: 'แชทกับ AI',
    subtitle: 'ผู้ช่วยอัจฉริยะของคณะ',
    section: 'ai_chat',
};

const menuGroups = [
    {
        id: 'home',
        label: 'OVERVIEW',
        items: [
            { path: '/dashboard', label: 'ภาพรวม (Overview)', icon: Home, section: 'dashboard' },
            { path: '/dashboard/alerts', label: 'ศูนย์แจ้งเตือน', icon: Bell, section: 'alert_center' },
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
            { path: '/dashboard/tcas', label: 'แผนรับ TCAS', icon: ClipboardList, section: 'tcas_admissions' },
            { path: '/dashboard/course-analytics', label: 'รายวิชา/เกรด', icon: BookOpen, section: 'course_analytics' },
            { path: '/dashboard/students', label: 'รายชื่อนักศึกษา', icon: GraduationCap, section: 'student_list' },
            { path: '/dashboard/graduation', label: 'ตรวจสอบการจบ', icon: CheckCircle, section: 'graduation_check' },
            { path: '/dashboard/student-life', label: 'กิจกรรมคณะวิทยาศาสตร์', icon: CalendarDays, section: 'student_life' },
            { path: '/dashboard/graduation-stats', label: 'สถิติสำเร็จการศึกษา', icon: Award, section: 'graduation_stats' },
            { path: '/dashboard/academic-rules', label: 'กฎระเบียบ/เกียรตินิยม', icon: ScrollText, section: 'academic_rules' },
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
        id: 'admin',
        label: 'จัดการระบบ · ADMIN',
        items: [
            { path: '/dashboard/admin', label: 'จัดการผู้ใช้/สิทธิ์', icon: UserCog, section: 'admin_panel' },
        ]
    }
];

export default function Sidebar({ isOpen, onClose }) {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [tokenBudget, setTokenBudget] = useState(() => getAITokenBudgetSnapshot());

    const handleLogout = async () => {
        setSettingsOpen(false);
        const result = await logout();
        if (!result?.redirecting) navigate('/');
    };

    useEffect(() => {
        if (!settingsOpen) return undefined;
        const refresh = () => setTokenBudget(getAITokenBudgetSnapshot());
        refresh();
        const interval = setInterval(refresh, 5000);
        return () => clearInterval(interval);
    }, [settingsOpen]);

    useEffect(() => {
        if (!settingsOpen) return undefined;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') setSettingsOpen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [settingsOpen]);

    const badgeColor = getRoleBadgeColor(user?.role);

    return (
        <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
            <div className="sidebar-header">
                <div className="sidebar-logo">SCI</div>
                <div className="sidebar-title" title={APP_NAME_FULL}>
                    <h2>{APP_NAME_SHORT_TH}</h2>
                    <p>{APP_NAME_SHORT_EN}</p>
                </div>
            </div>

            <nav className="sidebar-nav">
                {(() => {
                    const hasAccess = canAccess(user?.role, FEATURED_AI_CHAT.section);
                    const warm = () => { if (hasAccess) prefetchRoute(FEATURED_AI_CHAT.path); };
                    return (
                        <NavLink
                            to={hasAccess ? FEATURED_AI_CHAT.path : '#'}
                            className={({ isActive }) =>
                                `nav-featured ${isActive && hasAccess ? 'active' : ''} ${!hasAccess ? 'locked' : ''}`
                            }
                            onClick={(e) => { if (!hasAccess) e.preventDefault(); onClose(); }}
                            onMouseEnter={warm}
                            onFocus={warm}
                            onTouchStart={warm}
                        >
                            <span className="nav-featured-icon">
                                <Bot size={22} strokeWidth={2.2} />
                            </span>
                            <span className="nav-featured-body">
                                <span className="nav-featured-title">{FEATURED_AI_CHAT.label}</span>
                                <span className="nav-featured-sub">{FEATURED_AI_CHAT.subtitle}</span>
                            </span>
                            {hasAccess
                                ? <span className="nav-featured-badge">หลัก</span>
                                : <Lock className="lock-icon" size={14} />}
                        </NavLink>
                    );
                })()}

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
                                    const warm = () => { if (hasAccess) prefetchRoute(item.path); };
                                    return (
                                        <NavLink
                                            key={item.path}
                                            to={hasAccess ? item.path : '#'}
                                            end={item.path === '/dashboard'}
                                            className={({ isActive }) =>
                                                `nav-item ${isActive && hasAccess ? 'active' : ''} ${!hasAccess ? 'locked' : ''}`
                                            }
                                            onClick={(e) => { if (!hasAccess) e.preventDefault(); onClose(); }}
                                            onMouseEnter={warm}
                                            onFocus={warm}
                                            onTouchStart={warm}
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
                            <span className="sidebar-pending-badge" aria-label="คำขอของคุณรอผู้ดูแลระบบอนุมัติ" data-tooltip="รออนุมัติ">
                                <Clock size={10} /> รอการอนุมัติ
                            </span>
                        )}
                    </div>
                </div>
                <button
                    type="button"
                    className={`sidebar-settings-button ${settingsOpen ? 'active' : ''}`}
                    onClick={() => setSettingsOpen(open => !open)}
                    aria-expanded={settingsOpen}
                    aria-label={settingsOpen ? 'ปิด Settings' : 'เปิด Settings'}
                >
                    <Settings size={16} />
                    <span>Settings</span>
                    <ChevronRight size={15} />
                </button>
                <div className="sidebar-status-row">
                    <span className="sidebar-status-dot" />
                    <span className="sidebar-status-text">ออนไลน์</span>
                    <span className="sidebar-version">v1.0.0</span>
                </div>
            </div>
            {settingsOpen && (
                <div className="settings-popover-overlay" onClick={() => setSettingsOpen(false)}>
                    <section
                        className="settings-popover"
                        role="dialog"
                        aria-label="Settings"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            className="settings-popover-close"
                            onClick={() => setSettingsOpen(false)}
                            aria-label="ปิด Settings"
                        >
                            <X size={15} />
                        </button>
                        <div className="settings-popover-section">
                            <div className="settings-popover-label">
                                <UserRound size={13} />
                                <span>Personal account</span>
                            </div>
                            <div className="settings-account-card">
                                <div className="sidebar-avatar settings-account-avatar">
                                    {user?.avatar && user.avatar.startsWith('http') ? (
                                        <img src={user.avatar} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: 10, objectFit: 'cover' }} />
                                    ) : (
                                        user?.avatar
                                    )}
                                </div>
                                <div className="settings-account-text">
                                    <strong>{user?.name || 'ผู้ใช้'}</strong>
                                    <span style={{ background: `${badgeColor}22`, color: badgeColor }}>{user?.roleLabel || user?.role || 'General'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="settings-popover-section">
                            <div className="settings-popover-label">
                                <Settings size={13} />
                                <span>Settings</span>
                            </div>
                            <button type="button" className="settings-menu-row" onClick={toggleTheme}>
                                <span className="settings-menu-icon"><Palette size={15} /></span>
                                <span className="settings-menu-main">
                                    <span>Theme</span>
                                    <small>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</small>
                                </span>
                                <span className="settings-theme-pill">{theme === 'dark' ? 'Dark' : 'Light'}</span>
                            </button>
                        </div>

                        <div className="settings-popover-section">
                            <div className="settings-token-card" aria-label={`AI token คงเหลือ ${tokenBudget.remainingPercent}%`}>
                                <div className="settings-token-head">
                                    <span className="settings-menu-icon"><Activity size={15} /></span>
                                    <span className="settings-menu-main">
                                        <span>AI token คงเหลือ</span>
                                        <small>สำหรับการตอบคำถามของเว็บ</small>
                                    </span>
                                </div>
                                <div className="settings-token-value-row">
                                    <strong>{tokenBudget.remainingTokens.toLocaleString()}</strong>
                                    <span>{tokenBudget.remainingPercent}%</span>
                                </div>
                                <div className="settings-rate-bar settings-token-bar" aria-hidden="true">
                                    <span style={{ width: `${tokenBudget.remainingPercent}%` }} />
                                </div>
                                <div className="settings-token-meta">
                                    <span>ใช้ไป {tokenBudget.usedTokens.toLocaleString()} tokens</span>
                                    <span>{tokenBudget.requests.toLocaleString()} คำถาม</span>
                                </div>
                            </div>
                            <button type="button" className="settings-logout-row" onClick={handleLogout}>
                                <LogOut size={16} />
                                <span>ออกจากระบบ</span>
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </aside>
    );
}
