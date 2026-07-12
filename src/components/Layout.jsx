import { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import AIChat from './AIChat';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Menu, Sun, Moon } from 'lucide-react';
import { ensureStudentList } from '../services/studentDataService';
import { ensureDashboardLiveData, startDashboardAutoSync } from '../services/dashboardLiveDataService';
import { APP_NAME_EN, APP_NAME_TH } from '../config/appBrand';

export default function Layout() {
    const { theme, toggleTheme } = useTheme();
    const { user } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const location = useLocation();
    const [isTransitioning, setIsTransitioning] = useState(false);
    const prevPath = useRef(location.pathname);
    const mainContentRef = useRef(null);

    // Pre-warm live student data once the user is authenticated.
    // Gemini + page consumers read it synchronously after this resolves;
    // falls back to mock silently if Firestore doesn't have the doc.
    useEffect(() => {
        ensureStudentList();
        ensureDashboardLiveData();
    }, []);

    useEffect(() => {
        return startDashboardAutoSync({
            uid: user?.uid,
            who: user?.email || user?.uid,
            role: user?.role,
        });
    }, [user?.email, user?.role, user?.uid]);

    // Smooth page transition on route change — briefly unmount-style fade
    // (set to 'enter' on navigation, next frame animate to 'enter-active').
    useEffect(() => {
        if (prevPath.current !== location.pathname) {
            prevPath.current = location.pathname;
            setSidebarOpen(false);
            const scrollToPageTop = () => {
                const instantTop = { top: 0, left: 0, behavior: 'auto' };
                window.scrollTo(instantTop);
                document.documentElement.scrollTop = 0;
                document.body.scrollTop = 0;

                const mainContent = mainContentRef.current;
                mainContent?.scrollTo?.(instantTop);
                mainContent?.querySelector?.('.page-content')?.scrollTo?.(instantTop);
            };

            scrollToPageTop();
            const scrollRaf = requestAnimationFrame(scrollToPageTop);
            const settleTimer = window.setTimeout(scrollToPageTop, 120);
            let exitRaf = null;
            const enterRaf = requestAnimationFrame(() => {
                setIsTransitioning(true);
                exitRaf = requestAnimationFrame(() => {
                    setIsTransitioning(false);
                });
            });
            return () => {
                cancelAnimationFrame(scrollRaf);
                window.clearTimeout(settleTimer);
                cancelAnimationFrame(enterRaf);
                if (exitRaf) cancelAnimationFrame(exitRaf);
            };
        }
    }, [location.pathname]);

    useEffect(() => {
        if (!sidebarOpen) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') setSidebarOpen(false);
        };

        document.body.classList.add('sidebar-mobile-open');
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.classList.remove('sidebar-mobile-open');
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [sidebarOpen]);

    return (
        <div className="app-layout">
            <div className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)} />
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div className="main-content" ref={mainContentRef}>
                <header className="main-header">
                    <div className="header-left">
                        <button
                            className="menu-toggle"
                            onClick={() => setSidebarOpen(true)}
                            aria-label="Open navigation"
                            aria-expanded={sidebarOpen}
                            aria-controls="primary-sidebar"
                        >
                            <Menu size={24} />
                        </button>
                        <div className="header-title">
                            <h1>{APP_NAME_TH}</h1>
                            <p>{APP_NAME_EN}</p>
                        </div>
                    </div>
                    <div className="header-right">
                        <button
                            className={`theme-toggle ${theme}`}
                            onClick={toggleTheme}
                            aria-label="เปลี่ยนธีม"
                            data-tooltip="เปลี่ยนธีม"
                        >
                            <span className="theme-toggle-track">
                                <Sun size={14} className="theme-icon sun" />
                                <Moon size={14} className="theme-icon moon" />
                                <span className="theme-toggle-thumb" />
                            </span>
                        </button>
                    </div>
                </header>
                <div className="page-content dashboard-typography">
                    <div className={`page-transition ${isTransitioning ? 'page-enter' : 'page-enter-active'}`}>
                        <Outlet />
                    </div>
                </div>
            </div>
            <AIChat />
        </div>
    );
}
