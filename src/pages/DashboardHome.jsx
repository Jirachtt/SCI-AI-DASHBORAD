import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import {
    CreditCard, DollarSign, Users, ChevronRight, GraduationCap, BookOpen,
    TrendingUp, Lock, BarChart3, Sparkles, Settings2, Target,
    UserCheck, LineChart, Microscope, Wallet, FileBarChart2, ArrowUpRight
} from 'lucide-react';
import ExportPDFButton from '../components/ExportPDFButton';
import useDashboardDataset from '../hooks/useDashboardDataset';
import { APP_NAME_EN, APP_NAME_TH } from '../config/appBrand';
import { legacyColorToVar, themeAlpha } from '../utils/themeTokens';

const topics = [
    {
        id: 'hr',
        title: 'บุคลากร (HR)',
        subtitle: 'HR & Faculty Profile',
        description: 'จำนวนบุคลากร ตำแหน่งทางวิชาการ ความหลากหลาย อัตราส่วนนักศึกษา:อาจารย์',
        Icon: Users,
        bgColor: 'linear-gradient(135deg, var(--accent-info), var(--accent-info))',
        accent: 'var(--accent-info)',
        path: '/dashboard/hr',
        section: 'hr_overview',
        stats: '113 คน (คณะวิทย์)'
    },
    {
        id: 'student-stats',
        title: 'นักศึกษา (Student)',
        subtitle: 'Student Lifecycle & Outcomes',
        description: 'สถิตินิสิตปัจจุบัน TCAS รายวิชา-เกรด สำเร็จการศึกษา และกิจกรรมคณะวิทยาศาสตร์',
        Icon: GraduationCap,
        bgColor: 'linear-gradient(135deg, var(--accent-purple), var(--accent-purple))',
        accent: 'var(--accent-purple)',
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
        bgColor: 'linear-gradient(135deg, var(--accent-success-deep), var(--accent-success))',
        accent: 'var(--accent-success)',
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
        bgColor: 'linear-gradient(135deg, var(--accent-gold), var(--accent-gold))',
        accent: 'var(--accent-gold)',
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
        bgColor: 'linear-gradient(135deg, var(--accent-pink), var(--accent-pink))',
        accent: 'var(--accent-pink)',
        path: '/dashboard/strategic',
        section: 'strategic_overview',
        stats: 'OKR Progress'
    }
];

export default function DashboardHome() {
    const { user } = useAuth();
    const { data: dashboardSummary } = useDashboardDataset('dashboard_summary');
    const { data: studentStatsData } = useDashboardDataset('student_stats');
    const { data: hrData } = useDashboardDataset('hr');
    const { data: researchData } = useDashboardDataset('research');
    const { data: scienceBudgetData } = useDashboardDataset('science_budget');
    const { data: strategicData } = useDashboardDataset('strategic');
    const summaryFaculties = Array.isArray(dashboardSummary?.faculties) ? dashboardSummary.faculties : [];
    const sci = summaryFaculties.find(f => f.name === 'คณะวิทยาศาสตร์')
        || summaryFaculties.find(f => String(f.name || '').includes('วิทยาศาสตร์'))
        || summaryFaculties[0]
        || {};
    const liveScienceFaculty = studentStatsData?.scienceFaculty
        || (Array.isArray(studentStatsData?.byFaculty)
            ? (() => {
                const row = studentStatsData.byFaculty.find(f => String(f.name || '').includes('วิทยาศาสตร์'));
                if (!row) return null;
                return {
                    name: 'คณะวิทยาศาสตร์',
                    total: Number(row.total || 0) || Number(row.bachelor || 0) + Number(row.master || 0) + Number(row.doctoral || 0) + Number(row.certificate || 0),
                    byLevel: [
                        { label: 'ปริญญาตรี', value: row.bachelor || 0, color: 'var(--accent-blue)' },
                        { label: 'ปริญญาโท', value: row.master || 0, color: 'var(--accent-purple)' },
                        { label: 'ปริญญาเอก', value: row.doctoral || 0, color: 'var(--accent-orange)' },
                        { label: 'ประกาศนียบัตร', value: row.certificate || 0, color: 'var(--accent-success)' },
                    ],
                };
            })()
            : null);
    const totalStudents = Number(studentStatsData?.current?.total || dashboardSummary?.totalStudents || 0);
    const scienceStudentTotal = Number(liveScienceFaculty?.total || sci.totalStudents || 0);
    const scienceLevelDetails = (liveScienceFaculty?.byLevel || [])
        .map(item => ({
            label: item.label || item.level,
            value: Number(item.value ?? item.count ?? 0),
            color: item.color || 'var(--accent-success)',
        }))
        .filter(item => item.value > 0)
        .map(item => ({ ...item, value: item.value.toLocaleString('th-TH') }));
    const [isEditMode, setIsEditMode] = useState(false);
    const [showForecast, setShowForecast] = useState(false);
    const [showInsights, setShowInsights] = useState(false);
    const [cardOrder, setCardOrder] = useState([0, 1, 2, 3]);
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);
    const scienceSharePct = totalStudents ? ((scienceStudentTotal / totalStudents) * 100).toFixed(1) : '0.0';
    const insights = [
        `คณะวิทยาศาสตร์มีนักศึกษา ${scienceStudentTotal.toLocaleString('th-TH')} คน คิดเป็น ${scienceSharePct}% ของนักศึกษาทั้งมหาวิทยาลัย`,
        `อัตราสำเร็จการศึกษาคณะวิทยาศาสตร์ ${sci.graduationRate || '-'}% เทียบกับค่าเฉลี่ยมหาวิทยาลัย ${dashboardSummary.graduationRate || '-'}%`,
        `ข้อมูลนักศึกษาใช้แหล่งเดียวกับ Alert Center และ AI Chat จึงเห็นความเสี่ยง GPA ตามข้อมูลล่าสุด`,
    ];

    const scienceSubData = [
        {
            key: 'students', value: scienceStudentTotal.toLocaleString('th-TH'), label: 'นักศึกษาคณะวิทยาศาสตร์',
            pct: totalStudents ? ((scienceStudentTotal / totalStudents) * 100).toFixed(1) : '0.0',
            color: 'var(--accent-success-deep)',
            details: scienceLevelDetails.length > 0 ? scienceLevelDetails : [
                { label: 'ปริญญาตรี', value: '1,429', color: 'var(--accent-blue)' },
                { label: 'ปริญญาโท', value: '17', color: 'var(--accent-purple)' },
                { label: 'ปริญญาเอก', value: '5', color: 'var(--accent-orange)' },
            ]
        },
        {
            key: 'courses', value: sci.totalCourses, label: 'รายวิชาคณะวิทยาศาสตร์',
            pct: ((sci.totalCourses / dashboardSummary.totalCourses) * 100).toFixed(1),
            color: 'var(--accent-info)',
            details: [
                { label: 'วิชาบรรยาย', value: '98', color: 'var(--accent-info)' },
                { label: 'วิชาปฏิบัติการ', value: '42', color: 'var(--accent-success)' },
                { label: 'วิชาสัมมนา/วิจัย', value: '16', color: 'var(--accent-gold)' },
            ]
        },
        {
            key: 'gpa', value: sci.avgGPA, label: 'GPA คณะวิทยาศาสตร์',
            pct: null, color: 'var(--accent-gold)',
            comparison: { label: 'สูงกว่ามหาวิทยาลัย', diff: '+0.06' },
            details: [
                { label: 'เกรดเฉลี่ย ป.ตรี', value: '3.15', color: 'var(--accent-success)' },
                { label: 'เกรดเฉลี่ย ป.โท', value: '3.42', color: 'var(--accent-info)' },
                { label: 'เกรดเฉลี่ย ป.เอก', value: '3.68', color: 'var(--accent-pink)' },
            ]
        },
        {
            key: 'graduation', value: sci.graduationRate + '%', label: 'อัตราสำเร็จ คณะวิทยาศาสตร์',
            pct: null, color: 'var(--accent-pink)',
            comparison: { label: 'สูงกว่ามหาวิทยาลัย', diff: '+1.7%' },
            details: [
                { label: 'สำเร็จ ป.ตรี', value: '90.8%', color: 'var(--accent-success)' },
                { label: 'สำเร็จ ป.โท', value: '94.2%', color: 'var(--accent-info)' },
                { label: 'สำเร็จ ป.เอก', value: '88.5%', color: 'var(--accent-pink)' },
            ]
        }
    ];

    const statCards = [
        { icon: <GraduationCap size={22} />, gradient: 'linear-gradient(135deg, var(--accent-success-deep), var(--accent-success))', value: totalStudents.toLocaleString('th-TH'), label: 'นักศึกษาทั้งหมด', trend: '+3.2%' },
        { icon: <BookOpen size={22} />, gradient: 'linear-gradient(135deg, var(--accent-info), var(--accent-info))', value: dashboardSummary.totalCourses, label: 'รายวิชาเปิดสอน', trend: null },
        { icon: <TrendingUp size={22} />, gradient: 'linear-gradient(135deg, var(--accent-gold), var(--accent-gold))', value: dashboardSummary.avgGPA, label: 'เกรดเฉลี่ยรวม (GPA)', trend: null },
        { icon: <Users size={22} />, gradient: 'linear-gradient(135deg, var(--accent-pink), var(--accent-pink))', value: dashboardSummary.graduationRate + '%', label: 'อัตราสำเร็จการศึกษา', trend: '+1.5%' }
    ];

    const actualStudentTrendRows = (studentStatsData?.trend || []).filter(row => row.type !== 'forecast');
    const latestStudentTrend = actualStudentTrendRows[actualStudentTrendRows.length - 1];
    const nextStudentForecast = (studentStatsData?.trend || []).find(row => row.type === 'forecast')
        || (studentStatsData?.trend || [])[studentStatsData?.trend?.length - 1];
    const forecastStudentTotal = Number(nextStudentForecast?.total || latestStudentTrend?.total || totalStudents);
    const forecastStudentTrend = latestStudentTrend?.total
        ? `${forecastStudentTotal >= latestStudentTrend.total ? '+' : ''}${(((forecastStudentTotal - latestStudentTrend.total) / latestStudentTrend.total) * 100).toFixed(1)}%`
        : '+0.0%';
    const latestScienceBudget = (scienceBudgetData?.yearly || []).filter(row => row.type !== 'forecast').slice(-1)[0];
    const forecastScienceBudget = (scienceBudgetData?.yearly || []).find(row => row.type === 'forecast') || latestScienceBudget;
    const scienceBudgetTrend = latestScienceBudget?.revenue
        ? `${Number(forecastScienceBudget?.revenue || 0) >= latestScienceBudget.revenue ? '+' : ''}${(((Number(forecastScienceBudget?.revenue || 0) - latestScienceBudget.revenue) / latestScienceBudget.revenue) * 100).toFixed(1)}%`
        : '+0.0%';

    // Forecast data with lucide icons instead of emojis
    const forecasts = [
        { label: `นักศึกษาปี ${nextStudentForecast?.year || 'ถัดไป'}`, actual: (latestStudentTrend?.total || totalStudents).toLocaleString('th-TH'), forecast: forecastStudentTotal.toLocaleString('th-TH'), trend: forecastStudentTrend, color: 'var(--accent-success-deep)', FcIcon: GraduationCap },
        { label: `งบคณะวิทย์ปี ${forecastScienceBudget?.year || 'ถัดไป'} (ล้าน฿)`, actual: `${Number(latestScienceBudget?.revenue || 0).toLocaleString('th-TH')}`, forecast: `${Number(forecastScienceBudget?.revenue || 0).toLocaleString('th-TH')}`, trend: scienceBudgetTrend, color: 'var(--accent-gold)', FcIcon: Wallet },
        { label: 'ผลงาน Scopus ปี 2569', actual: '78', forecast: '92', trend: '+17.9%', color: 'var(--accent-info)', FcIcon: FileBarChart2 },
        { label: 'อัตราสำเร็จการศึกษา', actual: '89.5%', forecast: '92.1%', trend: '+2.6%', color: 'var(--accent-pink)', FcIcon: TrendingUp },
    ];
    const topicCards = topics.map(topic => {
        if (topic.id === 'student-stats') {
            return { ...topic, stats: `${totalStudents.toLocaleString('th-TH')} คน` };
        }
        if (topic.id === 'hr') {
            const hrTotal = Number(hrData?.scienceFaculty?.total || hrData?.summary?.total || 0);
            return { ...topic, stats: hrTotal ? `${hrTotal.toLocaleString('th-TH')} คน (คณะวิทย์)` : topic.stats };
        }
        if (topic.id === 'research') {
            const publications = Number(researchData?.overview?.totalPublications || researchData?.summary?.totalPublications || 0);
            return { ...topic, stats: publications ? `${publications.toLocaleString('th-TH')} publications` : topic.stats };
        }
        if (topic.id === 'financial') {
            const revenue = Number(latestScienceBudget?.revenue || scienceBudgetData?.summary?.latestRevenue || 0);
            return { ...topic, stats: revenue ? `${revenue.toLocaleString('th-TH')} ล้านบาท/ปี` : topic.stats };
        }
        if (topic.id === 'strategic') {
            const objectives = strategicData?.okr?.objectives?.length || strategicData?.strategicGoals?.length || 0;
            return { ...topic, stats: objectives ? `${objectives} goals / OKR` : topic.stats };
        }
        return topic;
    });

    return (
        <div>
            {/* Welcome Section */}
            <div className="section-header dashboard-home-header">
                <div className="section-header-icon" style={{ background: 'linear-gradient(135deg, var(--accent-success-deep), var(--accent-success))' }}>
                    <Sparkles size={22} color="var(--text-on-accent)" />
                </div>
                <div>
                    <h2 style={{
                        fontSize: '1.7rem', fontWeight: 800, marginBottom: 8, letterSpacing: 0,
                        background: 'linear-gradient(135deg, var(--text-primary) 30%, var(--accent-success))',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    }}>
                        สวัสดี, {user?.name}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', letterSpacing: 0 }}>
                        ยินดีต้อนรับสู่ {APP_NAME_TH}
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', letterSpacing: 0, marginTop: 4 }}>
                        {APP_NAME_EN}
                    </p>
                </div>

                {/* Action buttons */}
                <div className="section-header-actions">
                    <ExportPDFButton title={`ภาพรวม ${APP_NAME_TH}`} label="PDF" />
                    <button
                        className={`dashboard-header-action dashboard-header-action-analytics ${showForecast ? 'active' : ''}`}
                        onClick={() => setShowForecast(!showForecast)}
                    >
                        <LineChart size={15} />
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
                                <LineChart size={18} color="var(--accent-success)" /> Predictive Analytics
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
                            const accentColor = legacyColorToVar(fc.color);
                            return (
                                <div key={i} style={{
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 14, padding: '18px',
                                    transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
                                    display: 'flex', flexDirection: 'column', height: '100%',
                                }}
                                    onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = accentColor; }}
                                    onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = ''; }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                        <div style={{ width: 36, height: 36, borderRadius: 10, background: themeAlpha(fc.color, 8), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <FcIcon size={18} color={accentColor} />
                                        </div>
                                        <span style={{
                                            fontSize: '1.02rem', fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                                            background: themeAlpha(fc.color, 8), color: accentColor,
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
                                            <span style={{ fontSize: '1rem', color: accentColor }}>Forecast</span>
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

            {/* Daily Insights — Premium collapsible panel */}
            {insights && (
                <div style={{ marginBottom: showInsights ? 24 : 20 }}>
                    <button
                        onClick={() => setShowInsights(!showInsights)}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            background: showInsights
                                ? 'linear-gradient(135deg, color-mix(in srgb, var(--accent-success) 12%, transparent), color-mix(in srgb, var(--accent-success) 8%, transparent))'
                                : 'var(--bg-card)',
                            border: showInsights
                                ? '1px solid color-mix(in srgb, var(--accent-success) 25%, transparent)'
                                : '1px solid var(--border-color)',
                            color: showInsights ? 'var(--accent-success)' : 'var(--text-secondary)',
                            padding: '9px 20px', borderRadius: 12, cursor: 'pointer',
                            fontSize: '0.9rem', fontWeight: 600,
                            transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
                            boxShadow: showInsights
                                ? '0 4px 16px color-mix(in srgb, var(--accent-success) 15%, transparent), inset 0 1px 0 var(--chart-grid)'
                                : '0 1px 3px color-mix(in srgb, var(--text-primary) 6%, transparent)',
                        }}
                    >
                        <Sparkles size={15} style={{
                            transition: 'transform 0.3s ease',
                            transform: showInsights ? 'rotate(15deg) scale(1.1)' : 'rotate(0)',
                        }} />
                        Daily Insights
                        <span style={{
                            background: showInsights
                                ? 'linear-gradient(135deg, var(--accent-success), var(--accent-success))'
                                : 'var(--accent-success)',
                            color: 'var(--text-on-accent)', fontSize: '0.68rem',
                            padding: '2px 8px', borderRadius: 10, fontWeight: 700,
                            transition: 'all 0.3s',
                        }}>{insights.length}</span>
                        <ChevronRight size={14} style={{
                            transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
                            transform: showInsights ? 'rotate(90deg)' : 'rotate(0)',
                            opacity: 0.6,
                        }} />
                    </button>

                    {/* Collapsible insights panel */}
                    <div style={{
                        maxHeight: showInsights ? 600 : 0,
                        opacity: showInsights ? 1 : 0,
                        overflow: 'hidden',
                        transition: 'max-height 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.4s ease',
                        marginTop: showInsights ? 14 : 0,
                    }}>
                        <div style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 16,
                            overflow: 'hidden',
                            boxShadow: '0 4px 24px color-mix(in srgb, var(--text-primary) 8%, transparent), 0 0 0 1px color-mix(in srgb, var(--accent-success) 4%, transparent)',
                            position: 'relative',
                        }}>
                            {/* Green accent bar */}
                            <div style={{
                                position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                                background: 'linear-gradient(180deg, var(--accent-success), var(--accent-success), var(--accent-success))',
                                borderRadius: '3px 0 0 3px',
                            }} />

                            {/* Header */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '14px 20px 14px 24px',
                                borderBottom: '1px solid var(--border-color)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{
                                        width: 30, height: 30, borderRadius: 8,
                                        background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-success) 15%, transparent), color-mix(in srgb, var(--accent-success) 8%, transparent))',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <Sparkles size={15} color="var(--accent-success)" />
                                    </div>
                                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                        AI-Generated Insights
                                    </span>
                                </div>
                                <span style={{
                                    fontSize: '0.72rem', color: 'var(--text-muted)',
                                    background: 'var(--bg-secondary)', padding: '3px 10px',
                                    borderRadius: 6, border: '1px solid var(--border-color)',
                                }}>
                                    AI-Generated Insights
                                </span>
                            </div>

                            {/* Insight items with staggered animation */}
                            <div style={{ padding: '16px 20px 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {insights.map((insight, idx) => (
                                    <div key={idx} style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 12,
                                        padding: '12px 14px', borderRadius: 10,
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        transition: 'all 0.25s ease',
                                        cursor: 'default',
                                        animation: showInsights
                                            ? `insightSlideIn 0.4s cubic-bezier(0.22,1,0.36,1) ${idx * 0.1}s both`
                                            : 'none',
                                    }}
                                        onMouseOver={e => {
                                            e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent-success) 25%, transparent)';
                                            e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-success) 3%, transparent)';
                                            e.currentTarget.style.transform = 'translateX(4px)';
                                        }}
                                        onMouseOut={e => {
                                            e.currentTarget.style.borderColor = 'var(--border-color)';
                                            e.currentTarget.style.background = 'var(--bg-secondary)';
                                            e.currentTarget.style.transform = 'translateX(0)';
                                        }}
                                    >
                                        <div style={{
                                            width: 22, height: 22, borderRadius: 6,
                                            background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-success) 15%, transparent), color-mix(in srgb, var(--accent-success) 8%, transparent))',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0, marginTop: 2,
                                        }}>
                                            <TrendingUp size={12} color="var(--accent-success)" />
                                        </div>
                                        <span style={{
                                            color: 'var(--text-secondary)', fontSize: '0.85rem',
                                            lineHeight: 1.6, flex: 1,
                                        }}>{insight}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Stats Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BarChart3 size={18} color="var(--chart-muted)" /> ภาพรวมสถิติ
                </h3>
                <button
                    onClick={() => setIsEditMode(!isEditMode)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: isEditMode ? 'var(--accent-success)' : 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        color: isEditMode ? 'white' : 'var(--text-muted)',
                        padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                        fontSize: '0.98rem', transition: 'all 0.2s',
                        boxShadow: isEditMode ? '0 4px 12px color-mix(in srgb, var(--accent-success) 30%, transparent)' : 'none'
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
                                border: isEditMode ? '2px dashed color-mix(in srgb, var(--accent-success) 40%, transparent)' : '2px dashed transparent',
                                borderRadius: 18, transition: 'border 0.3s',
                                boxShadow: isEditMode ? '0 0 15px color-mix(in srgb, var(--accent-success) 15%, transparent)' : 'none'
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
                                        <div style={{ width: 28, height: 28, borderRadius: 7, background: themeAlpha(sciData.color, 12), color: legacyColorToVar(sciData.color), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Microscope size={14} />
                                        </div>
                                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{sciData.label}</span>
                                    </div>
                                    <div style={{ fontSize: 20, fontWeight: 700, color: legacyColorToVar(sciData.color) }}>{sciData.value}</div>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {sciData.details.map((d, j) => (
                                        <div key={j} style={{ flex: 1, background: 'var(--bg-card)', borderRadius: 8, padding: '10px 8px', textAlign: 'center', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
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
                <FileBarChart2 size={18} color="var(--chart-muted)" /> หมวดข้อมูลหลัก 5 ด้าน
            </h3>
            <div className="topic-cards-grid">
                {topicCards.map((topic) => {
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
                                <TopicIcon size={22} color="var(--text-on-accent)" />
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
