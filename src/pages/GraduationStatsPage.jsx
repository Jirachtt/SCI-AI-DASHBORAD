import { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import AccessDenied from '../components/AccessDenied';
import {
    graduationHistory, currentGraduationStats, graduationByMajor,
    gpaDistribution, honorsData, graduationCandidateList
} from '../data/graduationData';
import {
    GraduationCap, Award, Users, TrendingUp, AlertTriangle,
    CheckCircle, XCircle, Clock, Search, Download
} from 'lucide-react';
import { Bar, Line, Doughnut, Pie } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
    Title, Tooltip, Legend, ArcElement, Filler, BarElement
} from 'chart.js';
import { themeAdaptorPlugin } from '../utils/chartTheme';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler, BarElement, themeAdaptorPlugin);

const cardStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    padding: '24px',
};

const headerStyle = {
    display: 'flex', alignItems: 'center', gap: 10,
    marginBottom: '20px', paddingBottom: '12px',
    borderBottom: '1px solid var(--border-color)'
};

export default function GraduationStatsPage() {
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterMajor, setFilterMajor] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');

    if (!canAccess(user?.role, 'graduation_stats')) return <AccessDenied />;

    const stats = currentGraduationStats;

    // Filter candidate list
    const filteredCandidates = useMemo(() => graduationCandidateList.filter(s => {
        const matchSearch = searchTerm === '' ||
            s.name.includes(searchTerm) ||
            s.id.includes(searchTerm);
        const matchMajor = filterMajor === 'all' || s.major === filterMajor;
        const matchStatus = filterStatus === 'all' || s.graduationStatus === filterStatus;
        return matchSearch && matchMajor && matchStatus;
    }), [searchTerm, filterMajor, filterStatus]);

    // Summary cards data
    const summaryCards = [
        { label: 'ผู้มีสิทธิ์รับปริญญา', value: stats.totalCandidates, sub: 'ป.ตรี ชั้นปีที่ 4', icon: GraduationCap, color: '#7B68EE', bg: 'rgba(123,104,238,0.12)' },
        { label: 'คาดว่าสำเร็จ', value: stats.expectedGraduates, sub: `${((stats.expectedGraduates / stats.totalCandidates) * 100).toFixed(1)}%`, icon: CheckCircle, color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
        { label: 'รอพินิจ', value: stats.pending, sub: `${((stats.pending / stats.totalCandidates) * 100).toFixed(1)}%`, icon: Clock, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
        { label: 'ไม่ผ่านเกณฑ์', value: stats.notPassed, sub: 'GPA < 1.75', icon: XCircle, color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
        { label: 'GPA เฉลี่ย', value: stats.avgGPA, sub: 'ของผู้มีสิทธิ์ทั้งหมด', icon: Award, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
        { label: 'บัณฑิตศึกษา', value: stats.gradStudentsCandidates, sub: 'ป.โท + ป.เอก', icon: Users, color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
    ];

    // Graduation history line chart
    const historyChartData = {
        labels: graduationHistory.map(h => `${h.year}`),
        datasets: [
            {
                label: 'ผู้มีสิทธิ์',
                data: graduationHistory.map(h => h.candidates),
                borderColor: '#7B68EE',
                backgroundColor: 'rgba(123,104,238,0.1)',
                fill: true,
                tension: 0.4,
            },
            {
                label: 'สำเร็จการศึกษา',
                data: graduationHistory.map(h => h.graduated),
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34,197,94,0.1)',
                fill: true,
                tension: 0.4,
            }
        ]
    };

    const historyChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: 'var(--text-muted)', font: { size: 12 } } },
            tooltip: {
                callbacks: {
                    label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} คน`
                }
            }
        },
        scales: {
            x: { ticks: { color: 'var(--text-muted)' }, grid: { color: 'var(--border-color)' } },
            y: { ticks: { color: 'var(--text-muted)' }, grid: { color: 'var(--border-color)' } }
        }
    };

    // Graduation rate line chart
    const rateChartData = {
        labels: graduationHistory.map(h => `${h.year}`),
        datasets: [{
            label: 'อัตราสำเร็จ (%)',
            data: graduationHistory.map(h => h.rate),
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245,158,11,0.15)',
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointBackgroundColor: '#f59e0b',
        }]
    };

    const rateChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: 'var(--text-muted)', font: { size: 12 } } },
            tooltip: {
                callbacks: {
                    label: (ctx) => `${ctx.parsed.y}%`
                }
            }
        },
        scales: {
            x: { ticks: { color: 'var(--text-muted)' }, grid: { color: 'var(--border-color)' } },
            y: { min: 75, max: 100, ticks: { color: 'var(--text-muted)', callback: v => v + '%' }, grid: { color: 'var(--border-color)' } }
        }
    };

    // By major bar chart
    const majorColors = ['#7B68EE', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#06b6d4', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#a855f7', '#64748b'];
    const majorChartData = {
        labels: graduationByMajor.map(m => m.major.length > 12 ? m.major.slice(0, 12) + '...' : m.major),
        datasets: [
            {
                label: 'คาดว่าสำเร็จ',
                data: graduationByMajor.map(m => m.expected),
                backgroundColor: 'rgba(34,197,94,0.7)',
            },
            {
                label: 'รอพินิจ',
                data: graduationByMajor.map(m => m.pending),
                backgroundColor: 'rgba(245,158,11,0.7)',
            },
            {
                label: 'ไม่ผ่านเกณฑ์',
                data: graduationByMajor.map(m => m.notPassed),
                backgroundColor: 'rgba(239,68,68,0.7)',
            },
        ]
    };

    const majorChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
            legend: { labels: { color: 'var(--text-muted)', font: { size: 11 } } },
            tooltip: {
                callbacks: {
                    label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.x} คน`
                }
            }
        },
        scales: {
            x: { stacked: true, ticks: { color: 'var(--text-muted)' }, grid: { color: 'var(--border-color)' } },
            y: { stacked: true, ticks: { color: 'var(--text-muted)', font: { size: 11 } }, grid: { display: false } }
        }
    };

    // GPA Distribution bar chart
    const gpaChartData = {
        labels: gpaDistribution.map(g => g.range),
        datasets: [{
            label: 'จำนวน (คน)',
            data: gpaDistribution.map(g => g.count),
            backgroundColor: gpaDistribution.map(g => g.color + 'cc'),
            borderColor: gpaDistribution.map(g => g.color),
            borderWidth: 1,
            borderRadius: 6,
        }]
    };

    const gpaChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (ctx) => `${ctx.parsed.y} คน`
                }
            }
        },
        scales: {
            x: { ticks: { color: 'var(--text-muted)', font: { size: 11 } }, grid: { display: false } },
            y: { ticks: { color: 'var(--text-muted)' }, grid: { color: 'var(--border-color)' } }
        }
    };

    // Honors doughnut
    const honorsChartData = {
        labels: ['เกียรตินิยมอันดับ 1', 'เกียรตินิยมอันดับ 2', 'ปกติ', 'ต่ำกว่าเกณฑ์'],
        datasets: [{
            data: [honorsData.firstClass, honorsData.secondClass, honorsData.normal, honorsData.belowStandard],
            backgroundColor: ['#8b5cf6', '#3b82f6', '#22c55e', '#ef4444'],
            borderWidth: 0,
            cutout: '55%',
        }]
    };

    const honorsOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: { color: 'var(--text-muted)', padding: 12, font: { size: 11 }, usePointStyle: true }
            },
            tooltip: {
                callbacks: {
                    label: (ctx) => {
                        const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                        return `${ctx.label}: ${ctx.parsed} คน (${((ctx.parsed / total) * 100).toFixed(1)}%)`;
                    }
                }
            }
        }
    };

    // Status doughnut (current year)
    const statusChartData = {
        labels: ['คาดว่าสำเร็จ', 'รอพินิจ', 'ไม่ผ่านเกณฑ์'],
        datasets: [{
            data: [stats.expectedGraduates, stats.pending, stats.notPassed],
            backgroundColor: ['#22c55e', '#f59e0b', '#ef4444'],
            borderWidth: 0,
            cutout: '60%',
        }]
    };

    const statusOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: { color: 'var(--text-muted)', padding: 12, font: { size: 11 }, usePointStyle: true }
            },
            tooltip: {
                callbacks: {
                    label: (ctx) => `${ctx.label}: ${ctx.parsed} คน (${((ctx.parsed / stats.totalCandidates) * 100).toFixed(1)}%)`
                }
            }
        }
    };

    const uniqueMajors = [...new Set(graduationCandidateList.map(s => s.major))].sort();

    return (
        <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <GraduationCap size={28} color="#7B68EE" />
                    สถิติการสำเร็จการศึกษา
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: 6 }}>
                    คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้ | ปีการศึกษา {stats.academicYear}
                </p>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 24 }}>
                {summaryCards.map((card, i) => {
                    const Icon = card.icon;
                    return (
                        <div key={i} style={{
                            ...cardStyle,
                            padding: '18px 20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                            minHeight: 92,
                        }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: 12,
                                background: card.bg,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                <Icon size={22} color={card.color} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: card.color, lineHeight: 1.15 }}>{card.value}</div>
                                <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 600, marginTop: 2 }}>{card.label}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>{card.sub}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Row 1: Status Doughnut + Graduation Trend */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 18, marginBottom: 18 }}>
                {/* Status Doughnut */}
                <div style={cardStyle}>
                    <div style={headerStyle}>
                        <CheckCircle size={18} color="#22c55e" />
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>สถานะการสำเร็จ (ปัจจุบัน)</span>
                    </div>
                    <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Doughnut data={statusChartData} options={statusOptions} />
                    </div>
                    <div style={{ textAlign: 'center', marginTop: 8, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        รวม {stats.totalCandidates} คน | คาดว่าสำเร็จ {((stats.expectedGraduates / stats.totalCandidates) * 100).toFixed(1)}%
                    </div>
                </div>

                {/* Graduation History Line */}
                <div style={cardStyle}>
                    <div style={headerStyle}>
                        <TrendingUp size={18} color="#7B68EE" />
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>แนวโน้มการสำเร็จการศึกษา (ย้อนหลัง 5 ปี)</span>
                    </div>
                    <div style={{ height: 280 }}>
                        <Line data={historyChartData} options={historyChartOptions} />
                    </div>
                </div>
            </div>

            {/* Row 2: By Major + GPA Distribution */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18, marginBottom: 18 }}>
                {/* By Major */}
                <div style={cardStyle}>
                    <div style={headerStyle}>
                        <Users size={18} color="#3b82f6" />
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>แยกตามสาขาวิชา</span>
                    </div>
                    <div style={{ height: Math.max(280, graduationByMajor.length * 35) }}>
                        <Bar data={majorChartData} options={majorChartOptions} />
                    </div>
                </div>

                {/* GPA Distribution */}
                <div style={cardStyle}>
                    <div style={headerStyle}>
                        <Award size={18} color="#f59e0b" />
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>การกระจายตัวของ GPA</span>
                    </div>
                    <div style={{ height: 280 }}>
                        <Bar data={gpaChartData} options={gpaChartOptions} />
                    </div>
                </div>
            </div>

            {/* Row 3: Graduation Rate + Honors */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, marginBottom: 18 }}>
                {/* Graduation Rate */}
                <div style={cardStyle}>
                    <div style={headerStyle}>
                        <TrendingUp size={18} color="#f59e0b" />
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>อัตราสำเร็จการศึกษา (%)</span>
                    </div>
                    <div style={{ height: 260 }}>
                        <Line data={rateChartData} options={rateChartOptions} />
                    </div>
                </div>

                {/* Honors */}
                <div style={cardStyle}>
                    <div style={headerStyle}>
                        <Award size={18} color="#8b5cf6" />
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>เกียรตินิยม</span>
                    </div>
                    <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Doughnut data={honorsChartData} options={honorsOptions} />
                    </div>
                </div>
            </div>

            {/* Major Stats Table */}
            <div style={{ ...cardStyle, marginBottom: 18 }}>
                <div style={headerStyle}>
                    <GraduationCap size={18} color="#06b6d4" />
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>สรุปตามสาขาวิชา</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                {['สาขาวิชา', 'ผู้มีสิทธิ์', 'คาดว่าสำเร็จ', 'รอพินิจ', 'ไม่ผ่าน', 'GPA เฉลี่ย', 'อัตราสำเร็จ'].map(h => (
                                    <th key={h} style={{ padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {graduationByMajor.map((m, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 500 }}>{m.major}</td>
                                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', textAlign: 'center' }}>{m.total}</td>
                                    <td style={{ padding: '10px 12px', color: '#22c55e', textAlign: 'center', fontWeight: 600 }}>{m.expected}</td>
                                    <td style={{ padding: '10px 12px', color: '#f59e0b', textAlign: 'center' }}>{m.pending}</td>
                                    <td style={{ padding: '10px 12px', color: '#ef4444', textAlign: 'center' }}>{m.notPassed}</td>
                                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', textAlign: 'center' }}>{m.avgGPA}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                        <span style={{
                                            background: m.rate >= 90 ? 'rgba(34,197,94,0.15)' : m.rate >= 70 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                                            color: m.rate >= 90 ? '#22c55e' : m.rate >= 70 ? '#f59e0b' : '#ef4444',
                                            padding: '3px 10px',
                                            borderRadius: 20,
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                        }}>{m.rate}%</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Candidate List */}
            <div style={cardStyle}>
                <div style={{ ...headerStyle, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Users size={18} color="#7B68EE" />
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            รายชื่อผู้มีสิทธิ์รับปริญญา ({filteredCandidates.length} คน)
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginLeft: 'auto' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="ค้นหาชื่อ / รหัส..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 8,
                                    padding: '7px 10px 7px 32px',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.82rem',
                                    outline: 'none',
                                    width: 180,
                                }}
                            />
                        </div>
                        <select
                            value={filterMajor}
                            onChange={e => setFilterMajor(e.target.value)}
                            style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 8,
                                padding: '7px 10px',
                                color: 'var(--text-primary)',
                                fontSize: '0.82rem',
                            }}
                        >
                            <option value="all">ทุกสาขา</option>
                            {uniqueMajors.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                            style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 8,
                                padding: '7px 10px',
                                color: 'var(--text-primary)',
                                fontSize: '0.82rem',
                            }}
                        >
                            <option value="all">ทุกสถานะ</option>
                            <option value="คาดว่าสำเร็จ">คาดว่าสำเร็จ</option>
                            <option value="รอพินิจ">รอพินิจ</option>
                            <option value="ไม่ผ่านเกณฑ์">ไม่ผ่านเกณฑ์</option>
                        </select>
                    </div>
                </div>
                <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)' }}>
                            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                {['#', 'รหัสนักศึกษา', 'ชื่อ-นามสกุล', 'สาขาวิชา', 'GPA', 'เกียรตินิยม', 'สถานะ'].map(h => (
                                    <th key={h} style={{ padding: '10px 10px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCandidates.map((s, i) => (
                                <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}
                                    onMouseOver={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    <td style={{ padding: '9px 10px', color: 'var(--text-muted)' }}>{i + 1}</td>
                                    <td style={{ padding: '9px 10px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{s.id}</td>
                                    <td style={{ padding: '9px 10px', color: 'var(--text-primary)', fontWeight: 500 }}>{s.prefix}{s.name}</td>
                                    <td style={{ padding: '9px 10px', color: 'var(--text-muted)' }}>{s.major}</td>
                                    <td style={{ padding: '9px 10px', color: s.gpa >= 3.50 ? '#8b5cf6' : s.gpa >= 3.00 ? '#3b82f6' : s.gpa >= 2.00 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{s.gpa.toFixed(2)}</td>
                                    <td style={{ padding: '9px 10px' }}>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            padding: '2px 8px',
                                            borderRadius: 12,
                                            background: s.honors === 'เกียรตินิยมอันดับ 1' ? 'rgba(139,92,246,0.15)' :
                                                        s.honors === 'เกียรตินิยมอันดับ 2' ? 'rgba(59,130,246,0.15)' :
                                                        s.honors === 'ปกติ' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.15)',
                                            color: s.honors === 'เกียรตินิยมอันดับ 1' ? '#8b5cf6' :
                                                   s.honors === 'เกียรตินิยมอันดับ 2' ? '#3b82f6' :
                                                   s.honors === 'ปกติ' ? '#22c55e' : '#ef4444',
                                        }}>{s.honors}</span>
                                    </td>
                                    <td style={{ padding: '9px 10px' }}>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            padding: '2px 8px',
                                            borderRadius: 12,
                                            fontWeight: 600,
                                            background: s.graduationStatus === 'คาดว่าสำเร็จ' ? 'rgba(34,197,94,0.15)' :
                                                        s.graduationStatus === 'รอพินิจ' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                                            color: s.graduationStatus === 'คาดว่าสำเร็จ' ? '#22c55e' :
                                                   s.graduationStatus === 'รอพินิจ' ? '#f59e0b' : '#ef4444',
                                        }}>{s.graduationStatus}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
