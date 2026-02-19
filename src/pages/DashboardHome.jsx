import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import { dashboardSummary } from '../data/mockData';
import { getDashboardInsights } from '../services/geminiService';
import { CreditCard, DollarSign, Users, ChevronRight, GraduationCap, BookOpen, TrendingUp, Lock, BarChart3, Microscope, Sparkles, Settings2 } from 'lucide-react';

const topics = [
    {
        id: 'tuition',
        title: 'ค่าธรรมเนียมการศึกษา',
        subtitle: 'Tuition Fees',
        description: 'ข้อมูลค่าเทอม ค่าธรรมเนียมแรกเข้า และค่าใช้จ่ายตลอดหลักสูตร ระบบเหมาจ่าย (Flat Rate)',
        icon: '💰',
        bgColor: 'linear-gradient(135deg, #006838, #00a651)',
        path: '/dashboard/tuition',
        section: 'tuition',
        stats: '16,000 - 19,000 ฿/เทอม'
    },
    {
        id: 'student-stats',
        title: 'สถิตินิสิตปัจจุบัน',
        subtitle: 'Current Student Statistics',
        description: 'จำนวนนิสิตแยกตามระดับ ป.ตรี ป.โท ป.เอก แนวโน้มและพยากรณ์จำนวนนิสิต',
        icon: '📊',
        bgColor: 'linear-gradient(135deg, #7B68EE, #5B4FCF)',
        path: '/dashboard/student-stats',
        section: 'student_stats',
        stats: '19,821 คน (อ้างอิง MJU)'
    },
    {
        id: 'budget-forecast',
        title: 'พยากรณ์งบประมาณ',
        subtitle: 'Budget Forecast',
        description: 'รายรับ-รายจ่ายมหาวิทยาลัยย้อนหลัง 4 ปี พร้อมพยากรณ์ 2 ปีข้างหน้า',
        icon: '📈',
        bgColor: 'linear-gradient(135deg, #E91E63, #C2185B)',
        path: '/dashboard/budget-forecast',
        section: 'budget_forecast',
        stats: '~1,920 ล้านบาท/ปี'
    },
    {
        id: 'financial',
        title: 'การเงินและงานทะเบียน',
        subtitle: 'Financial & Administrative',
        description: 'สถานะค่าเทอม ทุนการศึกษา คำร้องต่างๆ และประวัติการเงิน',
        icon: '🏦',
        bgColor: 'linear-gradient(135deg, #C5A028, #9a7d1e)',
        path: '/dashboard/financial',
        section: 'financial',
        stats: 'ค้างชำระ 18,500 ฿'
    },
    {
        id: 'student-life',
        title: 'กิจกรรมและพฤติกรรม',
        subtitle: 'Student Life & Activity',
        description: 'ชั่วโมงกิจกรรม สถานะห้องสมุด และคะแนนความประพฤติ',
        icon: '🎯',
        bgColor: 'linear-gradient(135deg, #A23B72, #7B2D8E)',
        path: '/dashboard/student-life',
        section: 'student_life',
        stats: '38/60 ชั่วโมง'
    }
];

export default function DashboardHome() {
    const { user } = useAuth();
    const sci = dashboardSummary.faculties.find(f => f.name === 'คณะวิทยาศาสตร์');
    const [insights, setInsights] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [cardOrder, setCardOrder] = useState([0, 1, 2, 3]);
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);

    useEffect(() => {
        getDashboardInsights().then(data => setInsights(data));
    }, []);

    // Science faculty sub-card data for each stat card
    const scienceSubData = [
        {
            key: 'students',
            value: sci.totalStudents.toLocaleString(),
            label: 'นักศึกษาคณะวิทยาศาสตร์',
            pct: ((sci.totalStudents / dashboardSummary.totalStudents) * 100).toFixed(1),
            color: '#006838',
            details: [
                { label: 'ปริญญาตรี', value: '1,572', color: '#00a651' },
                { label: 'ปริญญาโท', value: '15', color: '#2E86AB' },
                { label: 'ปริญญาเอก', value: '4', color: '#A23B72' },
            ]
        },
        {
            key: 'courses',
            value: sci.totalCourses,
            label: 'รายวิชาคณะวิทยาศาสตร์',
            pct: ((sci.totalCourses / dashboardSummary.totalCourses) * 100).toFixed(1),
            color: '#2E86AB',
            details: [
                { label: 'วิชาบรรยาย', value: '98', color: '#2E86AB' },
                { label: 'วิชาปฏิบัติการ', value: '42', color: '#00a651' },
                { label: 'วิชาสัมมนา/วิจัย', value: '16', color: '#C5A028' },
            ]
        },
        {
            key: 'gpa',
            value: sci.avgGPA,
            label: 'GPA คณะวิทยาศาสตร์',
            pct: null,
            color: '#C5A028',
            comparison: { label: 'สูงกว่ามหาวิทยาลัย', diff: '+0.06' },
            details: [
                { label: 'เกรดเฉลี่ย ป.ตรี', value: '3.15', color: '#00a651' },
                { label: 'เกรดเฉลี่ย ป.โท', value: '3.42', color: '#2E86AB' },
                { label: 'เกรดเฉลี่ย ป.เอก', value: '3.68', color: '#A23B72' },
            ]
        },
        {
            key: 'graduation',
            value: sci.graduationRate + '%',
            label: 'อัตราสำเร็จ คณะวิทยาศาสตร์',
            pct: null,
            color: '#A23B72',
            comparison: { label: 'สูงกว่ามหาวิทยาลัย', diff: '+1.7%' },
            details: [
                { label: 'สำเร็จ ป.ตรี', value: '90.8%', color: '#00a651' },
                { label: 'สำเร็จ ป.โท', value: '94.2%', color: '#2E86AB' },
                { label: 'สำเร็จ ป.เอก', value: '88.5%', color: '#A23B72' },
            ]
        }
    ];

    const statCards = [
        {
            icon: <GraduationCap size={22} />,
            gradient: 'linear-gradient(135deg, #006838, #00a651)',
            value: dashboardSummary.totalStudents.toLocaleString(),
            label: 'นักศึกษาทั้งหมด',
            trend: '+3.2%',
        },
        {
            icon: <BookOpen size={22} />,
            gradient: 'linear-gradient(135deg, #2E86AB, #1a5276)',
            value: dashboardSummary.totalCourses,
            label: 'รายวิชาเปิดสอน',
            trend: null,
        },
        {
            icon: <TrendingUp size={22} />,
            gradient: 'linear-gradient(135deg, #C5A028, #9a7d1e)',
            value: dashboardSummary.avgGPA,
            label: 'เกรดเฉลี่ยรวม (GPA)',
            trend: null,
        },
        {
            icon: <Users size={22} />,
            gradient: 'linear-gradient(135deg, #A23B72, #7B2D8E)',
            value: dashboardSummary.graduationRate + '%',
            label: 'อัตราสำเร็จการศึกษา',
            trend: '+1.5%',
        }
    ];

    return (
        <div>
            {/* Welcome Section */}
            <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 8 }}>
                    สวัสดี, {user?.name} 👋
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                    ยินดีต้อนรับสู่ระบบ MJU Dashboard — ข้อมูลสรุปสำหรับ{user?.roleLabel}
                </p>
            </div>

            {/* Proactive AI Insights */}
            {insights && (
                <div style={{
                    background: 'linear-gradient(145deg, rgba(29, 29, 44, 0.8), rgba(20, 20, 30, 0.9))',
                    border: '1px solid rgba(0, 255, 136, 0.3)',
                    borderRadius: 16,
                    padding: '24px',
                    marginBottom: 32,
                    boxShadow: '0 8px 32px rgba(0, 255, 136, 0.1)',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        position: 'absolute', top: -50, right: -50, width: 150, height: 150,
                        background: 'radial-gradient(circle, rgba(0,255,136,0.2) 0%, rgba(0,0,0,0) 70%)',
                        borderRadius: '50%'
                    }} />
                    <h3 style={{
                        color: '#00ff88', fontSize: '1.2rem', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16
                    }}>
                        <Sparkles size={20} /> AI Daily Insights
                    </h3>
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {insights.map((insight, idx) => (
                            <li key={idx} style={{
                                display: 'flex', alignItems: 'flex-start', gap: 12,
                                color: '#e5e7eb', fontSize: '0.95rem', lineHeight: 1.5
                            }}>
                                <div style={{
                                    minWidth: 8, height: 8, borderRadius: '50%',
                                    background: '#00ff88', marginTop: 6, boxShadow: '0 0 10px #00ff88'
                                }} />
                                <span>{insight}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Quick Stats Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-secondary)' }}>📊 ภาพรวมสถิติ</h3>
                <button
                    onClick={() => setIsEditMode(!isEditMode)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: isEditMode ? '#00a651' : 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: isEditMode ? 'white' : '#9ca3af',
                        padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                        fontSize: '0.9rem', transition: 'all 0.2s',
                        boxShadow: isEditMode ? '0 4px 12px rgba(0, 166, 81, 0.3)' : 'none'
                    }}
                >
                    <Settings2 size={16} /> {isEditMode ? 'บันทึก Canvas' : 'จัดเรียง Widget'}
                </button>
            </div>

            {/* Quick Stats Grid (Draggable Canvas) */}
            <div className="stats-grid">
                {cardOrder.map((orderIdx, displayIdx) => {
                    const card = statCards[orderIdx];
                    const sciData = scienceSubData[orderIdx];

                    return (
                        <div
                            key={orderIdx}
                            draggable={isEditMode}
                            onDragStart={() => { dragItem.current = displayIdx; }}
                            onDragEnter={() => { dragOverItem.current = displayIdx; }}
                            onDragEnd={() => {
                                const newOrder = [...cardOrder];
                                const draggedItem = newOrder[dragItem.current];
                                newOrder.splice(dragItem.current, 1);
                                newOrder.splice(dragOverItem.current, 0, draggedItem);
                                setCardOrder(newOrder);
                                dragItem.current = null;
                                dragOverItem.current = null;
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            style={{
                                display: 'flex', flexDirection: 'column',
                                cursor: isEditMode ? 'grab' : 'default',
                                opacity: 1,
                                border: isEditMode ? '2px dashed rgba(0, 166, 81, 0.4)' : '2px dashed transparent',
                                borderRadius: 18,
                                transition: 'border 0.3s, box-shadow 0.3s',
                                boxShadow: isEditMode ? '0 0 15px rgba(0, 166, 81, 0.15)' : 'none'
                            }}
                        >
                            {/* Main Stat Card */}
                            <div className="stat-card animate-in" style={{
                                marginBottom: 0,
                                borderBottomLeftRadius: 0,
                                borderBottomRightRadius: 0,
                                borderBottom: 'none',
                                position: 'relative',
                                zIndex: 2
                            }}>
                                <div className="stat-card-header">
                                    <div className="stat-card-icon" style={{ background: card.gradient }}>
                                        {card.icon}
                                    </div>
                                    {card.trend && <span className="stat-card-trend up">{card.trend}</span>}
                                </div>
                                <div className="stat-card-value">{card.value}</div>
                                <div className="stat-card-label">{card.label}</div>
                            </div>

                            {/* Science Faculty Inline Sub-card (Always Visible) */}
                            <div style={{
                                background: 'rgba(0, 0, 0, 0.2)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid var(--border-color)',
                                borderTop: '1px dashed rgba(255, 255, 255, 0.1)',
                                borderBottomLeftRadius: 16,
                                borderBottomRightRadius: 16,
                                padding: '16px 20px',
                                position: 'relative',
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 12
                            }}>
                                {/* Decorative side line */}
                                <div style={{
                                    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                                    background: sciData.color
                                }} />

                                {/* Header */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{
                                            width: 24, height: 24, borderRadius: 6,
                                            background: `${sciData.color}20`,
                                            color: sciData.color,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 12
                                        }}>🔬</div>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>
                                            {sciData.label}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: sciData.color }}>
                                        {sciData.value}
                                    </div>
                                </div>

                                {/* Detail breakdown */}
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {sciData.details.map((d, j) => (
                                        <div key={j} style={{
                                            flex: 1,
                                            background: 'rgba(255, 255, 255, 0.03)',
                                            borderRadius: 8,
                                            padding: '8px',
                                            textAlign: 'center',
                                            border: '1px solid rgba(255, 255, 255, 0.05)'
                                        }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: d.color }}>{d.value}</div>
                                            <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2 }}>{d.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Topic Cards */}
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 20, color: 'var(--text-secondary)' }}>
                📋 หมวดข้อมูลหลัก
            </h3>
            <div className="topic-cards-grid">
                {topics.map((topic) => {
                    const hasAccess = canAccess(user?.role, topic.section);
                    return (
                        <Link
                            key={topic.id}
                            to={hasAccess ? topic.path : '#'}
                            className="topic-card animate-in"
                            onClick={(e) => !hasAccess && e.preventDefault()}
                            style={{ opacity: hasAccess ? 1 : 0.5 }}
                        >
                            <div className="topic-card-icon" style={{ background: topic.bgColor }}>
                                {topic.icon}
                            </div>
                            <h3>{topic.title}</h3>
                            <p>{topic.description}</p>
                            <div className="topic-card-footer">
                                <span>{topic.stats}</span>
                                {hasAccess ? (
                                    <span className="view-more">
                                        ดูรายละเอียด <ChevronRight size={14} />
                                    </span>
                                ) : (
                                    <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Lock size={12} /> ไม่มีสิทธิ์
                                    </span>
                                )}
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
