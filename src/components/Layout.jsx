import { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import AIChat from './AIChat';
import { useAuth } from '../contexts/AuthContext';
import { Menu } from 'lucide-react';
import { dashboardSummary } from '../data/mockData';

export default function Layout() {
    const { user } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const location = useLocation();
    const [isTransitioning, setIsTransitioning] = useState(false);
    const prevPath = useRef(location.pathname);

    // Smooth page transition on route change
    useEffect(() => {
        if (prevPath.current !== location.pathname) {
            setIsTransitioning(true);
            prevPath.current = location.pathname;
            const timer = setTimeout(() => setIsTransitioning(false), 50);
            return () => clearTimeout(timer);
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
