import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { canAccess, getRoleBadgeColor } from '../utils/accessControl';
import { prefetchRoute } from '../utils/routePrefetch';
import { getAIRateLimitSnapshot, getAITokenStats } from '../services/geminiService';
import {
    Home, CreditCard, DollarSign, Users, LogOut, Lock, FileText,
    GraduationCap, CheckCircle, BarChart3,
    Microscope, Target, UserCheck, BookOpen, Award,
    Shield, UserCog, Clock, Bell, Bot, Settings, Gauge, ChevronDown,
    ChevronRight, UserRound, Palette, Activity
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
    const [rateLimitsOpen, setRateLimitsOpen] = useState(false);
    const [rateLimitSnapshot, setRateLimitSnapshot] = useState(() => getAIRateLimitSnapshot());
    const [tokenStats, setTokenStats] = useState(() => getAITokenStats());

    const handleLogout = () => {
        setSettingsOpen(false);
        logout();
        navigate('/');
    };

    useEffect(() => {
        if (!settingsOpen) return undefined;
        const refresh = () => {
            setRateLimitSnapshot(getAIRateLimitSnapshot());
            setTokenStats(getAITokenStats());
        };
        refresh();
        const interval = setInterval(refresh, 5000);
        return () => clearInterval(interval);
    }, [settingsOpen]);

    const badgeColor = getRoleBadgeColor(user?.role);
    const totalTokens = Number(tokenStats.estimatedInputTokens || 0) + Number(tokenStats.estimatedOutputTokens || 0);

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
                    onClick={() => setSettingsOpen(true)}
                    aria-label="เปิด Settings"
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
                            <button
                                type="button"
                                className="settings-menu-row"
                                onClick={() => setRateLimitsOpen(open => !open)}
                                aria-expanded={rateLimitsOpen}
                            >
                                <span className="settings-menu-icon"><Gauge size={15} /></span>
                                <span className="settings-menu-main">
                                    <span>Rate limits remaining</span>
                                    <small>{rateLimitSnapshot.remaining} / {rateLimitSnapshot.totalLimit} requests · {rateLimitSnapshot.windowSeconds}s window</small>
                                </span>
                                <strong className="settings-rate-percent">{rateLimitSnapshot.remainingPercent}%</strong>
                                {rateLimitsOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            </button>
                            <div className="settings-rate-bar" aria-hidden="true">
                                <span style={{ width: `${rateLimitSnapshot.remainingPercent}%` }} />
                            </div>
                            {rateLimitSnapshot.waitSeconds > 0 && (
                                <div className="settings-rate-wait">
                                    <Clock size={13} /> รอประมาณ {rateLimitSnapshot.waitSeconds}s ก่อนส่งคำถามต่อไป
                                </div>
                            )}
                            {rateLimitsOpen && (
                                <div className="settings-rate-detail">
                                    {rateLimitSnapshot.byModel.map(model => (
                                        <div key={model.id} className="settings-rate-model">
                                            <div>
                                                <span>{model.label}</span>
                                                <small>{model.cooldownSeconds > 0 ? `cooldown ${model.cooldownSeconds}s` : `${model.remaining}/${model.limit} left`}</small>
                                            </div>
                                            <div className="settings-rate-mini">
                                                <span style={{ width: `${model.remainingPercent}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="settings-popover-section">
                            <div className="settings-usage-row">
                                <Activity size={15} />
                                <span>{Number(tokenStats.requests || 0).toLocaleString()} AI requests</span>
                                <strong>{totalTokens.toLocaleString()} tokens</strong>
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
