import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getRoleBadgeColor } from '../utils/accessControl';
import { prefetchRoute } from '../utils/routePrefetch';
import {
    getAIModelCatalog,
    getAIModelRuntimeStatus,
    getAIModelSettings,
    getAITokenBudgetSnapshot,
    getAITokenUsageSessionSummary,
    refreshAITokenBudgetSnapshot,
    saveAIModelSettings,
} from '../services/geminiService';
import { APP_NAME_FULL, APP_NAME_SHORT_EN, APP_NAME_SHORT_TH } from '../config/appBrand';
import { LogOut, Clock, Bot, Settings, UserRound, ShieldCheck, X, ChevronDown, Gauge } from 'lucide-react';
import {
    getFeaturedNavigationItem,
    getVisibleNavigationCategories,
} from '../config/navigationConfig';

export default function Sidebar({ isOpen, onClose }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [tokenBudget, setTokenBudget] = useState(() => getAITokenBudgetSnapshot());
    const [modelRuntime, setModelRuntime] = useState(() => getAIModelRuntimeStatus());
    const [modelSettings, setModelSettings] = useState(() => getAIModelSettings());
    const [tokenSession, setTokenSession] = useState(() => getAITokenUsageSessionSummary());

    const handleLogout = async () => {
        setSettingsOpen(false);
        const result = await logout();
        if (!result?.redirecting) navigate('/');
    };

    const handleModelChange = (event) => {
        const nextSettings = saveAIModelSettings({ modelMode: event.target.value });
        setModelSettings(nextSettings);
        setModelRuntime(getAIModelRuntimeStatus());
    };

    useEffect(() => {
        if (!settingsOpen) return undefined;
        const refresh = () => {
            setTokenBudget(getAITokenBudgetSnapshot());
            setModelRuntime(getAIModelRuntimeStatus());
            setModelSettings(getAIModelSettings());
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
    }, [settingsOpen, user?.uid]);

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
    const visibleMenuGroups = getVisibleNavigationCategories(user)
        .map((group) => ({
            ...group,
            items: group.items.filter(item => item.action !== 'settings'),
        }))
        .filter(group => group.items.length > 0);
    const modelCatalog = getAIModelCatalog();
    const selectedModel = modelSettings.modelMode || 'auto';
    const selectedModelMeta = modelCatalog.find(model => model.id === selectedModel) || null;
    const modelLastLabel = modelRuntime.lastModelLabel || modelRuntime.lastModel || '-';
    const numericValue = (value) => value === null || value === undefined || value === '' ? null : Number(value);
    const tokenNumber = (value) => Number.isFinite(numericValue(value))
        ? numericValue(value).toLocaleString('th-TH')
        : '—';
    const accountQuota = tokenBudget.userQuota || {};
    const accountQuotaAvailable = tokenBudget.userBudgetPolicyAvailable && accountQuota.authenticated;
    const displayedRemainingTokens = accountQuotaAvailable ? accountQuota.remainingTokens : tokenBudget.remainingTokens;
    const displayedUsedTokens = accountQuotaAvailable ? accountQuota.usedTokens : tokenBudget.usedTokens;
    const displayedRemainingPercent = accountQuotaAvailable ? accountQuota.remainingPercent : tokenBudget.remainingPercent;
    const remainingPercent = Number.isFinite(numericValue(displayedRemainingPercent))
        ? Math.max(0, Math.min(100, numericValue(displayedRemainingPercent)))
        : null;
    const usageResetLabel = tokenBudget.resetLabel || (tokenBudget.resetAt
        ? new Date(tokenBudget.resetAt).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        : 'รอข้อมูลรอบรีเซ็ต');
    const sessionTokens = tokenSession.totalTokens || 0;

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
                <button
                    type="button"
                    className="sidebar-user sidebar-account-trigger"
                    onClick={() => setSettingsOpen(true)}
                    aria-expanded={settingsOpen}
                    aria-haspopup="dialog"
                    aria-label={`เปิดเมนูบัญชี ${user?.name || ''}`.trim()}
                >
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
                    <ChevronDown className="sidebar-account-chevron" size={16} aria-hidden="true" />
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
                        aria-label="เมนูบัญชีและการตั้งค่า"
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
                                    {user?.email && <small className="settings-account-email">{user.email}</small>}
                                    <span style={{ background: `${badgeColor}22`, color: badgeColor }}>{user?.roleLabel || user?.role || 'General'}</span>
                                    {user?.mjuVerified && (
                                        <small className="sidebar-mju-connected"><ShieldCheck size={10} /> MJU Connected</small>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="settings-popover-section">
                            <div className="settings-popover-label">
                                <Gauge size={13} />
                                <span>Usage remaining</span>
                            </div>
                            <div className="settings-usage-card" aria-label="โควตา AI ของบัญชีนี้และการใช้งานเซสชันนี้" aria-live="polite">
                                <div className="settings-usage-head">
                                    <span className="settings-menu-icon"><Gauge size={15} /></span>
                                    <span className="settings-menu-main">
                                        <span>โควตา AI ของบัญชีนี้</span>
                                        <small>{accountQuotaAvailable
                                            ? `ฟรี ${tokenNumber(accountQuota.budgetTokens)} tokens/วัน · รีเซ็ต ${usageResetLabel}`
                                            : 'เข้าสู่ระบบเพื่ออ่านโควตารายบัญชี'}</small>
                                    </span>
                                    <strong className="settings-usage-percent">
                                        {remainingPercent === null ? '—' : `${remainingPercent}%`}
                                    </strong>
                                </div>
                                <div className="settings-usage-progress" aria-hidden="true">
                                    <span style={{ width: `${remainingPercent ?? 0}%` }} />
                                </div>
                                <div className="settings-usage-meta">
                                    <span>เหลือ {tokenNumber(displayedRemainingTokens)} tokens</span>
                                    <span>บัญชีนี้ใช้ {tokenNumber(displayedUsedTokens)} tokens</span>
                                </div>
                                <div className="settings-usage-provider">เซสชันนี้ใช้ {tokenNumber(sessionTokens)} tokens</div>
                                {tokenBudget.providerQuota?.available && (
                                    <div className="settings-usage-provider">
                                        Provider เหลือ {tokenNumber(tokenBudget.providerQuota.remainingTokens ?? tokenBudget.providerQuota.remaining)} tokens
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="settings-popover-section">
                            <div className="settings-popover-label">
                                <Settings size={13} />
                                <span>Settings</span>
                            </div>
                            <div
                                className="settings-token-card settings-model-card"
                                aria-label={`ตั้งค่า AI model ปัจจุบัน ${selectedModel === 'auto' ? 'Auto routing' : selectedModelMeta?.label || selectedModel}`}
                            >
                                <div className="settings-token-head">
                                    <span className="settings-menu-icon"><Bot size={15} /></span>
                                    <span className="settings-menu-main">
                                        <span>AI model</span>
                                        <small>RAG: {modelRuntime.contextMode}</small>
                                    </span>
                                </div>
                                <label className="settings-model-field">
                                    <span>โมเดลที่ใช้ตอบ</span>
                                    <select value={selectedModel} onChange={handleModelChange} aria-label="เลือก AI model">
                                        <option value="auto">Auto routing (แนะนำ)</option>
                                        {modelCatalog.map(model => (
                                            <option key={model.id} value={model.id}>{model.label}</option>
                                        ))}
                                    </select>
                                </label>
                                <p className="settings-model-help">
                                    {selectedModel === 'auto'
                                        ? 'ระบบเลือกโมเดลตามประเภทคำถามและสลับ fallback อัตโนมัติ'
                                        : selectedModelMeta?.bestFor || 'ใช้โมเดลนี้เป็นลำดับแรกและ fallback เมื่อจำเป็น'}
                                </p>
                                <div className="settings-token-meta">
                                    <span>ใช้ล่าสุด {modelLastLabel}</span>
                                    <span>{modelRuntime.lastContextCount > 0
                                        ? `${modelRuntime.lastContextCount.toLocaleString('th-TH')} contexts`
                                        : 'เลือก context อัตโนมัติ'}</span>
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
