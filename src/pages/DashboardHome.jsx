import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import { dashboardSummary } from '../data/mockData';
import { getDashboardInsights } from '../services/geminiService';
import {
    CreditCard, DollarSign, Users, ChevronRight, GraduationCap, BookOpen,
    TrendingUp, Lock, BarChart3, Sparkles, Settings2, Target,
    UserCheck, LineChart, Microscope, Wallet, FileBarChart2, ArrowUpRight
} from 'lucide-react';
import ExportPDFButton from '../components/ExportPDFButton';

const topics = [
    {
        id: 'hr',
        title: 'บุคลากร (HR)',
        subtitle: 'HR & Faculty Profile',
        description: 'จำนวนบุคลากร ตำแหน่งทางวิชาการ ความหลากหลาย อัตราส่วนนักศึกษา:อาจารย์',
        Icon: Users,
        bgColor: 'linear-gradient(135deg, #2E86AB, #1a5276)',
        accent: '#2E86AB',
        path: '/dashboard/hr',
        section: 'hr_overview',
        stats: '113 คน (คณะวิทย์)'
    },
    {
        id: 'student-stats',
        title: 'นักศึกษา (Student)',
        subtitle: 'Student Lifecycle & Outcomes',
        description: 'สถิตินิสิตปัจจุบัน การรับเข้า สำเร็จการศึกษา กิจกรรม/พฤติกรรม',
        Icon: GraduationCap,
        bgColor: 'linear-gradient(135deg, #7B68EE, #5B4FCF)',
        accent: '#7B68EE',
        path: '/dashboard/student-stats',
        section: 'student_stats',
        stats: '19,821 คน (อ้างอิง MJU)'
    },
    {
        id: 'research',
        title: 'การวิจัย (Research)',
        subtitle: 'Research & Innovation',
        description: 'ผลงานตีพิมพ์ งบวิจัย สิทธิบัตร นวัตกรรม Benchmarking กับมหาวิทยาลัยอื่น',
        Icon: Microscope,
        bgColor: 'linear-gradient(135deg, #006838, #00a651)',
        accent: '#00a651',
        path: '/dashboard/research',
        section: 'research_overview',
        stats: '1,284 publications'
    },
    {
        id: 'financial',
        title: 'การเงิน (Finance)',
        subtitle: 'Financial Viability',
        description: 'รายรับ-รายจ่าย ค่าธรรมเนียม งบประมาณคณะ พยากรณ์งบประมาณ AI',
        Icon: Wallet,
        bgColor: 'linear-gradient(135deg, #C5A028, #9a7d1e)',
        accent: '#C5A028',
        path: '/dashboard/financial',
        section: 'financial',
        stats: '~1,920 ล้านบาท/ปี'
    },
    {
        id: 'strategic',
        title: 'ยุทธศาสตร์ (OKR)',
        subtitle: 'Strategic & OKR Monitoring',
        description: 'เป้าหมายยุทธศาสตร์ OKR Monitoring ประสิทธิภาพ 5 ด้าน',
        Icon: Target,
        bgColor: 'linear-gradient(135deg, #A23B72, #7B2D8E)',
        accent: '#A23B72',
        path: '/dashboard/strategic',
        section: 'strategic_overview',
        stats: 'OKR Progress'
    }
];

export default function DashboardHome() {
    const { user } = useAuth();
    const sci = dashboardSummary.faculties.find(f => f.name === 'คณะวิทยาศาสตร์');
    const [insights, setInsights] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [showForecast, setShowForecast] = useState(false);
    const [showInsights, setShowInsights] = useState(false);
    const [cardOrder, setCardOrder] = useState([0, 1, 2, 3]);
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);

    useEffect(() => {
        getDashboardInsights().then(data => setInsights(data));
    }, []);

    const scienceSubData = [
        {
            key: 'students', value: sci.totalStudents.toLocaleString(), label: 'นักศึกษาคณะวิทยาศาสตร์',
            pct: ((sci.totalStudents / dashboardSummary.totalStudents) * 100).toFixed(1),
            color: '#006838',
            details: [
                { label: 'ปริญญาตรี', value: '1,572', color: '#00a651' },
                { label: 'ปริญญาโท', value: '15', color: '#2E86AB' },
                { label: 'ปริญญาเอก', value: '4', color: '#A23B72' },
            ]
        },
        {
            key: 'courses', value: sci.totalCourses, label: 'รายวิชาคณะวิทยาศาสตร์',
            pct: ((sci.totalCourses / dashboardSummary.totalCourses) * 100).toFixed(1),
            color: '#2E86AB',
            details: [
                { label: 'วิชาบรรยาย', value: '98', color: '#2E86AB' },
                { label: 'วิชาปฏิบัติการ', value: '42', color: '#00a651' },
                { label: 'วิชาสัมมนา/วิจัย', value: '16', color: '#C5A028' },
            ]
        },
        {
            key: 'gpa', value: sci.avgGPA, label: 'GPA คณะวิทยาศาสตร์',
            pct: null, color: '#C5A028',
            comparison: { label: 'สูงกว่ามหาวิทยาลัย', diff: '+0.06' },
            details: [
                { label: 'เกรดเฉลี่ย ป.ตรี', value: '3.15', color: '#00a651' },
                { label: 'เกรดเฉลี่ย ป.โท', value: '3.42', color: '#2E86AB' },
                { label: 'เกรดเฉลี่ย ป.เอก', value: '3.68', color: '#A23B72' },
            ]
        },
        {
            key: 'graduation', value: sci.graduationRate + '%', label: 'อัตราสำเร็จ คณะวิทยาศาสตร์',
            pct: null, color: '#A23B72',
            comparison: { label: 'สูงกว่ามหาวิทยาลัย', diff: '+1.7%' },
            details: [
                { label: 'สำเร็จ ป.ตรี', value: '90.8%', color: '#00a651' },
                { label: 'สำเร็จ ป.โท', value: '94.2%', color: '#2E86AB' },
                { label: 'สำเร็จ ป.เอก', value: '88.5%', color: '#A23B72' },
            ]
        }
    ];

    const statCards = [
        { icon: <GraduationCap size={22} />, gradient: 'linear-gradient(135deg, #006838, #00a651)', value: dashboardSummary.totalStudents.toLocaleString(), label: 'นักศึกษาทั้งหมด', trend: '+3.2%' },
        { icon: <BookOpen size={22} />, gradient: 'linear-gradient(135deg, #2E86AB, #1a5276)', value: dashboardSummary.totalCourses, label: 'รายวิชาเปิดสอน', trend: null },
        { icon: <TrendingUp size={22} />, gradient: 'linear-gradient(135deg, #C5A028, #9a7d1e)', value: dashboardSummary.avgGPA, label: 'เกรดเฉลี่ยรวม (GPA)', trend: null },
        { icon: <Users size={22} />, gradient: 'linear-gradient(135deg, #A23B72, #7B2D8E)', value: dashboardSummary.graduationRate + '%', label: 'อัตราสำเร็จการศึกษา', trend: '+1.5%' }
    ];

    // Forecast data with lucide icons instead of emojis
    const forecasts = [
        { label: 'นักศึกษาปี 2569', actual: '19,821', forecast: '22,500', trend: '+13.5%', color: '#006838', FcIcon: GraduationCap },
        { label: 'งบประมาณปี 2569 (ล้าน฿)', actual: '1,920', forecast: '2,035', trend: '+6.0%', color: '#C5A028', FcIcon: Wallet },
        { label: 'ผลงาน Scopus ปี 2569', actual: '78', forecast: '92', trend: '+17.9%', color: '#2E86AB', FcIcon: FileBarChart2 },
        { label: 'อัตราสำเร็จการศึกษา', actual: '89.5%', forecast: '92.1%', trend: '+2.6%', color: '#A23B72', FcIcon: TrendingUp },
    ];

    return (
        <div>
            {/* Welcome Section */}
            <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h2 style={{
                        fontSize: '1.7rem', fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em',
                        background: 'linear-gradient(135deg, var(--text-primary) 30%, #00a651)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    }}>
                        สวัสดี, {user?.name}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', letterSpacing: '0.01em' }}>
                        ยินดีต้อนรับสู่ Science AI Dashboard — คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้
                    </p>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <ExportPDFButton title="ภาพรวม Science AI Dashboard" label="Export PDF" />
                <button
                    onClick={() => setShowForecast(!showForecast)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: showForecast
                            ? 'linear-gradient(135deg, #006838, #00a651)'
                            : 'var(--bg-card)',
                        border: showForecast ? 'none' : '1px solid var(--border-color)',
                        color: showForecast ? '#fff' : 'var(--text-secondary)',
                        padding: '10px 22px', borderRadius: 12, cursor: 'pointer',
                        fontSize: '1rem', fontWeight: 600,
                        boxShadow: showForecast ? '0 6px 20px rgba(0,104,56,0.35)' : 'none',
                        transition: 'all 0.3s ease',
                    }}
                >
                    <LineChart size={18} />
                    Predictive Analytics
                </button>
                </div>
            </div>

            {/* Forecast Panel (Toggle) */}
            {showForecast && (
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 16, padding: '24px', marginBottom: 28,
                    animation: 'slideDown 0.4s ease',
                    boxShadow: 'var(--shadow-sm)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                        <div>
                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <LineChart size={18} color="#00a651" /> Predictive Analytics
                            </h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: 4 }}>
                                Linear Regression จากข้อมูลย้อนหลัง 4 ปี — พยากรณ์ล่วงหน้า 2 ปี
                            </p>
                        </div>
                        <span style={{ fontSize: '1rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '4px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                            Forecast FY2569
                        </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, alignItems: 'stretch' }}>
                        {forecasts.map((fc, i) => {
                            const FcIcon = fc.FcIcon;
                            return (
                                <div key={i} style={{
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 14, padding: '18px',
                                    transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
                                    display: 'flex', flexDirection: 'column', height: '100%',
                                }}
                                    onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = `${fc.color}44`; }}
                                    onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = ''; }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${fc.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <FcIcon size={18} color={fc.color} />
                                        </div>
                                        <span style={{
                                            fontSize: '1.02rem', fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                                            background: `${fc.color}15`, color: fc.color,
                                            display: 'flex', alignItems: 'center', gap: 3,
                                        }}>
                                            <ArrowUpRight size={12} />{fc.trend}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: 6 }}>{fc.label}</div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                                        <div>
                                            <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Actual</span>
                                            <div style={{ fontSize: '1.02rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{fc.actual}</div>
                                        </div>
                                        <div style={{ width: 1, height: 28, background: 'var(--border-color)' }} />
                                        <div>
                                            <span style={{ fontSize: '1rem', color: fc.color }}>Forecast</span>
                                            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>{fc.forecast}</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                        <Link to="/dashboard/budget" style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '8px 16px', borderRadius: 10,
                            background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                            fontSize: '0.95rem', fontWeight: 500, textDecoration: 'none',
                            border: '1px solid var(--border-color)',
                            transition: 'background 0.2s',
                        }}
                            onMouseOver={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                            onMouseOut={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                        >
                            <Wallet size={14} /> รายละเอียดพยากรณ์งบประมาณ <ChevronRight size={14} />
                        </Link>
                        <Link to="/dashboard/student-stats" style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '8px 16px', borderRadius: 10,
                            background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                            fontSize: '0.95rem', fontWeight: 500, textDecoration: 'none',
                            border: '1px solid var(--border-color)',
                            transition: 'background 0.2s',
                        }}
                            onMouseOver={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                            onMouseOut={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                        >
                            <GraduationCap size={14} /> พยากรณ์จำนวนนักศึกษา <ChevronRight size={14} />
                        </Link>
                    </div>
                </div>
            )}

            {/* Daily Insights — Compact popup */}
            {insights && (
                <>
                    <button
                        onClick={() => setShowInsights(!showInsights)}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            background: showInsights ? 'rgba(0,166,81,0.15)' : 'var(--bg-card)',
                            border: showInsights ? '1px solid rgba(0,166,81,0.3)' : '1px solid var(--border-color)',
                            color: showInsights ? '#00a651' : 'var(--text-secondary)',
                            padding: '8px 18px', borderRadius: 10, cursor: 'pointer',
                            fontSize: '0.92rem', fontWeight: 600, marginBottom: 20,
                            transition: 'all 0.25s ease',
                            boxShadow: showInsights ? '0 2px 12px rgba(0,166,81,0.12)' : 'none',
                        }}
                    >
                        <Sparkles size={15} />
                        Daily Insights
                        <span style={{
                            background: '#00a651', color: '#fff', fontSize: '0.7rem',
                            padding: '1px 7px', borderRadius: 10, fontWeight: 700, lineHeight: '18px',
                        }}>{insights.length}</span>
                    </button>

                    {showInsights && (
                        <div style={{
                            position: 'fixed', inset: 0, zIndex: 9999,
                            background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            animation: 'fadeIn 0.2s ease',
                        }}
                            onClick={() => setShowInsights(false)}
                        >
                            <div style={{
                                background: 'var(--bg-card)',
                                border: '1px solid rgba(0,166,81,0.15)',
                                borderRadius: 18, padding: 0,
                                width: '100%', maxWidth: 520,
                                boxShadow: '0 20px 50px rgba(0,0,0,0.3), 0 0 30px rgba(0,166,81,0.06)',
                                animation: 'modalSlideIn 0.3s ease',
                                overflow: 'hidden',
                            }}
                                onClick={e => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '18px 24px', borderBottom: '1px solid var(--border-color)',
                                    background: 'rgba(0,166,81,0.04)',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{
                                            width: 34, height: 34, borderRadius: 10,
                                            background: 'rgba(0,166,81,0.12)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <Sparkles size={17} color="#00a651" />
                                        </div>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                Daily Insights
                                            </h3>
                                            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                AI-generated analysis from today's data
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowInsights(false)}
                                        style={{
                                            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)',
                                            color: 'var(--text-muted)', cursor: 'pointer',
                                            width: 32, height: 32, borderRadius: 8,
                                            display: 'grid', placeItems: 'center',
                                            transition: 'all 0.2s',
                                        }}
                                        onMouseOver={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
                                        onMouseOut={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                                    >
                                        ✕
                                    </button>
                                </div>

                                {/* Body */}
                                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    {insights.map((insight, idx) => (
                                        <div key={idx} style={{
                                            display: 'flex', alignItems: 'flex-start', gap: 12,
                                            padding: '14px 16px', borderRadius: 12,
                                            background: 'var(--bg-secondary)',
                                            border: '1px solid var(--border-color)',
                                            transition: 'border-color 0.2s',
                                        }}
                                            onMouseOver={e => e.currentTarget.style.borderColor = 'rgba(0,166,81,0.25)'}
                                            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                                        >
                                            <div style={{
                                                width: 24, height: 24, borderRadius: 6,
                                                background: 'rgba(0,166,81,0.1)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                flexShrink: 0, marginTop: 1,
                                            }}>
                                                <TrendingUp size={13} color="#00a651" />
                                            </div>
                                            <span style={{
                                                color: 'var(--text-secondary)', fontSize: '0.9rem',
                                                lineHeight: 1.6, flex: 1,
                                            }}>{insight}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Footer */}
                                <div style={{
                                    padding: '12px 24px', borderTop: '1px solid var(--border-color)',
                                    textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem',
                                }}>
                                    Powered by Gemini AI — ข้อมูลวิเคราะห์อัตโนมัติจากระบบ
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Quick Stats Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BarChart3 size={18} color="#9ca3af" /> ภาพรวมสถิติ
                </h3>
                <button
                    onClick={() => setIsEditMode(!isEditMode)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: isEditMode ? '#00a651' : 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        color: isEditMode ? 'white' : 'var(--text-muted)',
                        padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                        fontSize: '0.98rem', transition: 'all 0.2s',
                        boxShadow: isEditMode ? '0 4px 12px rgba(0, 166, 81, 0.3)' : 'none'
                    }}
                >
                    <Settings2 size={15} /> {isEditMode ? 'บันทึก' : 'จัดเรียง'}
                </button>
            </div>

            {/* Quick Stats Grid */}
            <div className="stats-grid">
                {cardOrder.map((orderIdx, displayIdx) => {
                    const card = statCards[orderIdx];
                    const sciData = scienceSubData[orderIdx];
                    return (
                        <div key={orderIdx}
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
                                border: isEditMode ? '2px dashed rgba(0, 166, 81, 0.4)' : '2px dashed transparent',
                                borderRadius: 18, transition: 'border 0.3s',
                                boxShadow: isEditMode ? '0 0 15px rgba(0, 166, 81, 0.15)' : 'none'
                            }}
                        >
                            <div className="stat-card animate-in" style={{ marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottom: 'none', position: 'relative', zIndex: 2 }}>
                                <div className="stat-card-header">
                                    <div className="stat-card-icon" style={{ background: card.gradient }}>{card.icon}</div>
                                    {card.trend && <span className="stat-card-trend up">{card.trend}</span>}
                                </div>
                                <div className="stat-card-value">{card.value}</div>
                                <div className="stat-card-label">{card.label}</div>
                            </div>
                            <div style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)', borderTop: '1px dashed var(--border-color)',
                                borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
                                padding: '18px 20px', position: 'relative', display: 'flex', flexDirection: 'column', gap: 14,
                            }}>
                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: sciData.color }} />
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ width: 28, height: 28, borderRadius: 7, background: `${sciData.color}20`, color: sciData.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Microscope size={14} />
                                        </div>
                                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{sciData.label}</span>
                                    </div>
                                    <div style={{ fontSize: 20, fontWeight: 700, color: sciData.color }}>{sciData.value}</div>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {sciData.details.map((d, j) => (
                                        <div key={j} style={{ flex: 1, background: 'var(--bg-card)', borderRadius: 8, padding: '10px 8px', textAlign: 'center', border: '1px solid var(--border-color)', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)' }}>
                                            <div style={{ fontSize: 18, fontWeight: 700, color: d.color }}>{d.value}</div>
                                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, fontWeight: 500 }}>{d.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Topic Cards — 5 Data Domains */}
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 20, marginTop: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileBarChart2 size={18} color="#9ca3af" /> หมวดข้อมูลหลัก 5 ด้าน
            </h3>
            <div className="topic-cards-grid">
                {topics.map((topic) => {
                    const hasAccess = canAccess(user?.role, topic.section);
                    const TopicIcon = topic.Icon;
                    return (
                        <Link key={topic.id} to={hasAccess ? topic.path : '#'}
                            className="topic-card"
                            onClick={(e) => !hasAccess && e.preventDefault()}
                            style={{
                                opacity: hasAccess ? 1 : 0.5,
                                '--topic-accent': topic.bgColor,
                                '--topic-glow': `${topic.accent}10`,
                                '--topic-shadow': `${topic.accent}15`,
                                '--topic-border': `${topic.accent}30`,
                            }}
                        >
                            <div className="topic-card-icon" style={{ background: topic.bgColor }}>
                                <TopicIcon size={22} color="#fff" />
                            </div>
                            <h3>{topic.title}</h3>
                            <div className="topic-card-subtitle">{topic.subtitle}</div>
                            <p>{topic.description}</p>
                            <div className="topic-card-footer">
                                <span>{topic.stats}</span>
                                {hasAccess ? (
                                    <span className="view-more">ดูรายละเอียด <ChevronRight size={14} /></span>
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
