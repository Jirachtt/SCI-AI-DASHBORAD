import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import AIChat from './AIChat';
import { useAuth } from '../contexts/AuthContext';
import { Menu } from 'lucide-react';
import { dashboardSummary } from '../data/mockData';

export default function Layout() {
    const { user } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);

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
                            <h1>🎓 MJU Dashboard</h1>
                            <p>ระบบสารสนเทศ มหาวิทยาลัยแม่โจ้</p>
                        </div>
                    </div>
                    <div className="header-right">

                    </div>
                </header>
                <div className="page-content">
                    <Outlet />
                </div>
            </div>
            <AIChat />
        </div>
    );
}
