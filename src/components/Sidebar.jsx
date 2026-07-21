import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getRoleBadgeColor } from '../utils/accessControl';
import { prefetchRoute } from '../utils/routePrefetch';
import { getAIModelRuntimeStatus, getAITokenBudgetSnapshot, getAITokenUsageSessionSummary, refreshAITokenBudgetSnapshot } from '../services/geminiService';
import { APP_NAME_FULL, APP_NAME_SHORT_EN, APP_NAME_SHORT_TH } from '../config/appBrand';
import { LogOut, Clock, Bot, Settings, UserRound, Palette, Activity, ShieldCheck, X } from 'lucide-react';
import {
    getFeaturedNavigationItem,
    getVisibleNavigationCategories,
} from '../config/navigationConfig';

export default function Sidebar({ isOpen, onClose }) {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [tokenBudget, setTokenBudget] = useState(() => getAITokenBudgetSnapshot());
    const [modelRuntime, setModelRuntime] = useState(() => getAIModelRuntimeStatus());
    const [tokenSession, setTokenSession] = useState(() => getAITokenUsageSessionSummary());

    const handleLogout = async () => {
        setSettingsOpen(false);
        const result = await logout();
        if (!result?.redirecting) navigate('/');
    };

    useEffect(() => {
        if (!settingsOpen) return undefined;
        const refresh = () => {
            setTokenBudget(getAITokenBudgetSnapshot());
            setModelRuntime(getAIModelRuntimeStatus());
            setTokenSession(getAITokenUsageSessionSummary());
            refreshAITokenBudgetSnapshot()
                .then(setTokenBudget)
                .catch(() => setTokenBudget(getAITokenBudgetSnapshot()));
        };
        const handleUsageUpdate = (event) => setTokenBudget(event.detail || getAITokenBudgetSnapshot());
        const handleTokenStatsUpdate = () => setModelRuntime(getAIModelRuntimeStatus());
        const handleSessionUsageUpdate = () => setTokenSession(getAITokenUsageSessionSummary());
        refresh();
        window.addEventListener('sci-ai-usage-updated', handleUsageUpdate);
        window.addEventListener('sci-ai-token-stats-updated', handleTokenStatsUpdate);
        window.addEventListener('sci-ai-token-usage-session-updated', handleSessionUsageUpdate);
        const interval = setInterval(refresh, 15000);
        return () => {
            window.removeEventListener('sci-ai-usage-updated', handleUsageUpdate);
            window.removeEventListener('sci-ai-token-stats-updated', handleTokenStatsUpdate);
            window.removeEventListener('sci-ai-token-usage-session-updated', handleSessionUsageUpdate);
            clearInterval(interval);
        };
    }, [settingsOpen]);

    useEffect(() => {
        if (!settingsOpen) return undefined;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') setSettingsOpen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [settingsOpen]);

    const badgeColor = getRoleBadgeColor(user?.role);
    const featuredItem = getFeaturedNavigationItem();
    const canViewFeatured = Boolean(featuredItem && getVisibleNavigationCategories(user, { includeFeatured: true })
        .some(group => group.items.some(item => item.id === featuredItem.id)));
    const visibleMenuGroups = getVisibleNavigationCategories(user);
    const latestUsage = tokenSession.last || tokenBudget.lastRequest || null;
    const aiReady = tokenBudget.aiReady === true;
    const modelModeLabel = modelRuntime.mode === 'auto' ? 'Auto routing' : 'Manual';
    const modelLastLabel = modelRuntime.lastModelLabel || modelRuntime.lastModel || '-';

    return (
        <aside id="primary-sidebar" className={`sidebar ${isOpen ? 'open' : ''}`} aria-label="Primary navigation">
            <div className="sidebar-header">
                <div className="sidebar-logo">SCI</div>
                <div className="sidebar-title" title={APP_NAME_FULL}>
                    <h2>{APP_NAME_SHORT_TH}</h2>
                    <p>{APP_NAME_SHORT_EN}</p>
                </div>
            </div>

            <nav className="sidebar-nav" aria-label="Dashboard sections">
                {featuredItem && canViewFeatured && (() => {
                    const FeaturedIcon = featuredItem.icon || Bot;
                    const warm = () => { if (featuredItem.path) prefetchRoute(featuredItem.path); };
                    return (
                        <NavLink
                            to={featuredItem.path}
                            className={({ isActive }) =>
                                `nav-featured ${isActive ? 'active' : ''}`
                            }
                            onClick={onClose}
                            onMouseEnter={warm}
                            onFocus={warm}
                            onTouchStart={warm}
                        >
                            <span className="nav-featured-icon">
                                <FeaturedIcon size={22} strokeWidth={2.2} />
                            </span>
                            <span className="nav-featured-body">
                                <span className="nav-featured-title">{featuredItem.label}</span>
                                <span className="nav-featured-sub">{featuredItem.subtitle}</span>
                            </span>
                            {featuredItem.badge && <span className="nav-featured-badge">{featuredItem.badge}</span>}
                        </NavLink>
                    );
                })()}

                {visibleMenuGroups.map((group) => (
                    <div key={group.id} className="nav-section">
                        <div className="nav-section-label">{group.label}</div>
                        <div className="nav-section-items">
                            {group.items.map(item => {
                                const Icon = item.icon;
                                if (item.action === 'settings') {
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            className={`nav-item nav-item-button ${settingsOpen ? 'active' : ''}`}
                                            onClick={() => setSettingsOpen(true)}
                                            aria-expanded={settingsOpen}
                                            aria-haspopup="dialog"
                                        >
                                            <Icon size={18} />
                                            <span>{item.label}</span>
                                        </button>
                                    );
                                }

                                const warm = () => { if (item.path) prefetchRoute(item.path); };
                                return (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        end={item.exactMatch}
                                        className={({ isActive }) =>
                                            `nav-item ${isActive ? 'active' : ''}`
                                        }
                                        onClick={onClose}
                                        onMouseEnter={warm}
                                        onFocus={warm}
                                        onTouchStart={warm}
                                    >
                                        <Icon size={18} />
                                        <span>{item.label}</span>
                                    </NavLink>
                                );
                            })}
                        </div>
                    </div>
                ))}
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
                        {user?.mjuVerified && (
                            <span className="sidebar-mju-connected"><ShieldCheck size={10} /> MJU Connected</span>
                        )}
                        {user?.isPending && (
                            <span className="sidebar-pending-badge" aria-label="คำขอของคุณรอผู้ดูแลระบบอนุมัติ" data-tooltip="รออนุมัติ">
                                <Clock size={10} /> รอการอนุมัติ
                            </span>
                        )}
                    </div>
                </div>
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
                                    {user?.mjuVerified && (
                                        <small className="sidebar-mju-connected"><ShieldCheck size={10} /> MJU Connected</small>
                                    )}
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
                            <div className="settings-token-card" aria-label="สถานะ AI" aria-live="polite">
                                <div className="settings-token-head">
                                    <span className="settings-menu-icon"><Activity size={15} /></span>
                                    <span className="settings-menu-main">
                                        <span>สถานะ AI</span>
                                        <small>ระบบผู้ช่วยวิเคราะห์ข้อมูล</small>
                                    </span>
                                </div>
                                <div className={`settings-ai-readiness ${aiReady ? 'is-ready' : 'is-unavailable'}`}>
                                    {aiReady ? 'AI พร้อมใช้งาน' : 'AI ยังไม่พร้อมใช้งาน'}
                                </div>
                            </div>
                            <div className="settings-token-card settings-model-card" aria-label={`AI model ล่าสุด ${modelLastLabel}`}>
                                <div className="settings-token-head">
                                    <span className="settings-menu-icon"><Bot size={15} /></span>
                                    <span className="settings-menu-main">
                                        <span>AI model / RAG</span>
                                        <small>{modelModeLabel} · {modelRuntime.contextMode}</small>
                                    </span>
                                </div>
                                <div className="settings-token-value-row compact">
                                    <strong>{modelLastLabel}</strong>
                                    <span>{latestUsage?.source === 'provider' ? 'Actual' : latestUsage?.isEstimated ? 'Estimated' : 'พร้อมใช้งาน'}</span>
                                </div>
                                <div className="settings-token-meta">
                                    <span>{modelRuntime.lastContextCount > 0
                                        ? `contexts ล่าสุด ${modelRuntime.lastContextCount.toLocaleString('th-TH')}`
                                        : 'เลือก context อัตโนมัติ'}</span>
                                    {latestUsage?.contextTokens != null && (
                                        <span>{Number(latestUsage.contextTokens).toLocaleString('th-TH')} tokens</span>
                                    )}
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
