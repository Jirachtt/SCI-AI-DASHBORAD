import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canAccess, getRoleBadgeColor } from '../utils/accessControl';
import { Home, CreditCard, DollarSign, Users, LogOut, Lock, FileText, GraduationCap, CheckCircle, BarChart3 } from 'lucide-react';

const navItems = [
    { path: '/dashboard', label: 'หน้าแรก', icon: Home, section: 'dashboard' },
    { path: '/dashboard/tuition', label: 'ค่าธรรมเนียมการศึกษา', icon: CreditCard, section: 'tuition' },
    { path: '/dashboard/student-stats', label: 'สถิตินิสิตปัจจุบัน', icon: BarChart3, section: 'student_stats' },
    { path: '/dashboard/budget', label: 'งบประมาณคณะ', icon: FileText, section: 'budget_forecast' },
    { path: '/dashboard/financial', label: 'การเงิน/งานทะเบียน', icon: DollarSign, section: 'financial' },
    { path: '/dashboard/student-life', label: 'กิจกรรม/พฤติกรรม', icon: Users, section: 'student_life' },
    { path: '/dashboard/students', label: 'รายชื่อนักศึกษา', icon: GraduationCap, section: 'student_list' },
    { path: '/dashboard/graduation', label: 'ตรวจสอบการจบ', icon: CheckCircle, section: 'graduation_check' },
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
                <div className="sidebar-logo">MJU</div>
                <div className="sidebar-title">
                    <h2>MJU Dashboard</h2>
                    <p>AI-Powered University Info</p>
                </div>
            </div>

            <nav className="sidebar-nav">
                <div className="nav-section-label">เมนูหลัก</div>
                {navItems.map((item) => {
                    const hasAccess = canAccess(user?.role, item.section);
                    const Icon = item.icon;
                    return (
                        <NavLink
                            key={item.path}
                            to={hasAccess ? item.path : '#'}
                            end={item.path === '/dashboard'}
                            className={({ isActive }) =>
                                `nav-item ${isActive && hasAccess ? 'active' : ''} ${!hasAccess ? 'locked' : ''}`
                            }
                            onClick={(e) => {
                                if (!hasAccess) e.preventDefault();
                                onClose();
                            }}
                            style={{ position: 'relative', opacity: hasAccess ? 1 : 0.4 }}
                        >
                            <Icon size={20} />
                            <span>{item.label}</span>
                            {!hasAccess && <Lock className="lock-icon" size={14} />}
                        </NavLink>
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
                    </div>
                    <button className="logout-btn" onClick={handleLogout} title="ออกจากระบบ">
                        <LogOut size={18} />
                    </button>
                </div>
            </div>
        </aside>
    );
}
