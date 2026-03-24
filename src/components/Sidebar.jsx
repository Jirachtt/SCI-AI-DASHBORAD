import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canAccess, getRoleBadgeColor } from '../utils/accessControl';
import {
    Home, CreditCard, DollarSign, Users, LogOut, Lock, FileText,
    GraduationCap, CheckCircle, BarChart3, ChevronDown, ChevronRight,
    Microscope, Target, UserCheck, BookOpen, Award, TrendingUp,
    Building2, Globe2, MessageCircle
} from 'lucide-react';

const menuGroups = [
    {
        id: 'home',
        label: 'หน้าแรก',
        icon: Home,
        items: [
            { path: '/dashboard', label: 'ภาพรวม (Overview)', icon: Home, section: 'dashboard' },
        ]
    },
    {
        id: 'hr',
        label: '1. บุคลากร (HR)',
        icon: Users,
        color: '#2E86AB',
        items: [
            { path: '/dashboard/hr', label: '1.1 ภาพรวมบุคลากร', icon: UserCheck, section: 'hr_overview' },
        ]
    },
    {
        id: 'student',
        label: '2. นักศึกษา (Student)',
        icon: GraduationCap,
        color: '#7B68EE',
        items: [
            { path: '/dashboard/student-stats', label: '2.1 สถิตินิสิตปัจจุบัน', icon: BarChart3, section: 'student_stats' },
            { path: '/dashboard/students', label: '2.2 รายชื่อนักศึกษา', icon: GraduationCap, section: 'student_list' },
            { path: '/dashboard/graduation', label: '2.3 ตรวจสอบการจบ', icon: CheckCircle, section: 'graduation_check' },
            { path: '/dashboard/student-life', label: '2.4 กิจกรรม/พฤติกรรม', icon: Users, section: 'student_life' },
        ]
    },
    {
        id: 'research',
        label: '3. การวิจัย (Research)',
        icon: Microscope,
        color: '#006838',
        items: [
            { path: '/dashboard/research', label: '3.1 ภาพรวมงานวิจัย', icon: BookOpen, section: 'research_overview' },
        ]
    },
    {
        id: 'finance',
        label: '4. การเงิน (Finance)',
        icon: DollarSign,
        color: '#C5A028',
        items: [
            { path: '/dashboard/financial', label: '4.1 รายรับ-รายจ่าย', icon: DollarSign, section: 'financial' },
            { path: '/dashboard/tuition', label: '4.2 ค่าธรรมเนียมการศึกษา', icon: CreditCard, section: 'tuition' },
            { path: '/dashboard/budget', label: '4.3 พยากรณ์งบประมาณ', icon: FileText, section: 'budget_forecast' },
        ]
    },
    {
        id: 'strategic',
        label: '5. ยุทธศาสตร์ (OKR)',
        icon: Target,
        color: '#A23B72',
        items: [
            { path: '/dashboard/strategic', label: '5.1 เป้าหมายยุทธศาสตร์', icon: Target, section: 'strategic_overview' },
        ]
    },
    {
        id: 'ai_chat',
        label: '6. AI แชทบอท (Chat)',
        icon: MessageCircle,
        color: '#00e676',
        items: [
            { path: '/dashboard/ai-chat', label: '6.1 แชทกับ AI', icon: MessageCircle, section: 'ai_chat' },
        ]
    }
];

export default function Sidebar({ isOpen, onClose }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [expandedGroups, setExpandedGroups] = useState({ home: true, student: true, finance: true, hr: true, research: true, strategic: true, ai_chat: true });

    const toggleGroup = (groupId) => {
        setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const badgeColor = getRoleBadgeColor(user?.role);

    return (
        <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
            <div className="sidebar-header">
                <div className="sidebar-logo" style={{
                    background: 'linear-gradient(135deg, #006838, #00a651)',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    letterSpacing: '0.5px',
                }}>SCI</div>
                <div className="sidebar-title">
                    <h2>Science AI Dashboard</h2>
                    <p>คณะวิทยาศาสตร์ มจ.</p>
                </div>
            </div>

            <nav className="sidebar-nav" style={{ overflowY: 'auto', flex: 1 }}>
                {menuGroups.map((group) => {
                    const isExpanded = expandedGroups[group.id];
                    const GroupIcon = group.icon;
                    const hasAnyAccess = group.items.some(item => canAccess(user?.role, item.section));

                    // For home group, render directly without collapsible header
                    if (group.id === 'home') {
                        return group.items.map(item => {
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
                                    style={{ opacity: hasAccess ? 1 : 0.4 }}
                                >
                                    <Icon size={18} />
                                    <span>{item.label}</span>
                                    {!hasAccess && <Lock className="lock-icon" size={14} />}
                                </NavLink>
                            );
                        });
                    }

                    return (
                        <div key={group.id} style={{ marginBottom: 4 }}>
                            {/* Group Header */}
                            <button
                                onClick={() => toggleGroup(group.id)}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '10px 14px',
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    borderRadius: 10,
                                    transition: 'all 0.2s',
                                    opacity: hasAnyAccess ? 1 : 0.4,
                                }}
                                onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <GroupIcon size={16} color={group.color || '#9ca3af'} />
                                <span style={{
                                    flex: 1,
                                    textAlign: 'left',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    color: group.color || '#ccc',
                                    letterSpacing: '0.01em',
                                    fontFamily: "'Noto Sans Thai', 'Inter', sans-serif",
                                }}>{group.label}</span>
                                {isExpanded
                                    ? <ChevronDown size={14} color="#666" />
                                    : <ChevronRight size={14} color="#666" />
                                }
                            </button>

                            {/* Group Items */}
                            <div style={{
                                maxHeight: isExpanded ? 300 : 0,
                                overflow: 'hidden',
                                transition: 'max-height 0.3s ease',
                                paddingLeft: 8,
                            }}>
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
                                            style={{
                                                opacity: hasAccess ? 1 : 0.4,
                                                fontSize: '0.84rem',
                                                padding: '9px 14px',
                                                fontFamily: "'Noto Sans Thai', 'Inter', sans-serif",
                                            }}
                                        >
                                            <Icon size={16} />
                                            <span>{item.label}</span>
                                            {!hasAccess && <Lock className="lock-icon" size={12} />}
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
                    </div>
                    <button className="logout-btn" onClick={handleLogout} title="ออกจากระบบ">
                        <LogOut size={18} />
                    </button>
                </div>
            </div>
        </aside>
    );
}
