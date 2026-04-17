import { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import AIChat from './AIChat';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Menu, Sun, Moon } from 'lucide-react';
import { dashboardSummary } from '../data/mockData';

export default function Layout() {
    const { user } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const location = useLocation();
    const [isTransitioning, setIsTransitioning] = useState(false);
    const prevPath = useRef(location.pathname);

    // Smooth page transition on route change — briefly unmount-style fade
    // (set to 'enter' on navigation, next frame animate to 'enter-active').
    useEffect(() => {
        if (prevPath.current !== location.pathname) {
            setIsTransitioning(true);
            prevPath.current = location.pathname;
            // One frame to apply the initial state, then release to trigger the transition.
            const raf = requestAnimationFrame(() => {
                setIsTransitioning(false);
            });
            return () => cancelAnimationFrame(raf);
        }
    }, [location.pathname]);

    return (
        <div className="app-layout">
            <div className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)} />
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div className="main-content">
                <header className="main-header">
                    <div className="header-left">
                        <button className="menu-toggle" onClick={() => setSidebarOpen(true)}>
                            <Menu size={24} />
                        </button>
                        <div className="header-title">
                            <h1>Science AI Dashboard</h1>
                            <p>คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้</p>
                        </div>
                    </div>
                    <div className="header-right">
                        <button
                            className={`theme-toggle ${theme}`}
                            onClick={toggleTheme}
                            title="เปลี่ยนธีม"
                        >
                            <span className="theme-toggle-track">
                                <Sun size={14} className="theme-icon sun" />
                                <Moon size={14} className="theme-icon moon" />
                                <span className="theme-toggle-thumb" />
                            </span>
                        </button>
                    </div>
                </header>
                <div className="page-content">
                    <div className={`page-transition ${isTransitioning ? 'page-enter' : 'page-enter-active'}`}>
                        <Outlet />
                    </div>
                </div>
            </div>
            <AIChat />
        </div>
    );
}
