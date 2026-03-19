import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import AccessDenied from '../components/AccessDenied';
import { studentStatsData } from '../data/mockData';
import { ArrowLeft, Filter, RotateCcw, GraduationCap, BookOpen, Award, FileText, BarChart3, Microscope } from 'lucide-react';
import { Doughnut, Line, Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
    Title, Tooltip, Legend, ArcElement, Filler, BarElement
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler, BarElement);

export default function StudentStatsPage() {
    const { user } = useAuth();
    const [selectedFaculty, setSelectedFaculty] = useState('all');
    const [selectedLevel, setSelectedLevel] = useState('all');
    const [filtersApplied, setFiltersApplied] = useState(false);

    if (!canAccess(user?.role, 'student_stats')) return <AccessDenied />;

    const { current, byFaculty, trend, scienceFaculty } = studentStatsData;

    // Apply filters
    const filteredFaculty = selectedFaculty === 'all'
        ? byFaculty
        : byFaculty.filter(f => f.name === selectedFaculty);

    const filteredTotal = filteredFaculty.reduce((sum, f) => {
        if (selectedLevel === 'all') return sum + f.bachelor + f.master + f.doctoral;
        if (selectedLevel === 'bachelor') return sum + f.bachelor;
        if (selectedLevel === 'master') return sum + f.master;
        if (selectedLevel === 'doctoral') return sum + f.doctoral;
        return sum;
    }, 0);

    // Doughnut chart for student levels
    const doughnutData = {
        labels: current.byLevel.map(l => l.level),
        datasets: [{
            data: current.byLevel.map(l => l.count),
            backgroundColor: current.byLevel.map(l => l.color),
            borderWidth: 0,
            cutout: '60%',
        }]
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: { color: '#9ca3af', padding: 14, font: { size: 11 } }
            },
            tooltip: {
                callbacks: {
                    label: (ctx) => `${ctx.label}: ${ctx.parsed.toLocaleString()} คน (${((ctx.parsed / current.total) * 100).toFixed(1)}%)`
                }
            }
        }
    };

    // Line chart for trend (actual + forecast)
    const actualData = trend.filter(t => t.type === 'actual');

    const trendLineData = {
        labels: trend.map(t => `ปี ${t.year}`),
        datasets: [
            {
                label: 'จำนวนนิสิตรวม (ข้อมูลจริง)',
                data: trend.map(t => t.type === 'actual' ? t.total : null),
                borderColor: '#006838',
                backgroundColor: 'rgba(0, 104, 56, 0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#006838',
                pointRadius: 6,
                pointHoverRadius: 8,
                spanGaps: false,
            },
            {
                label: 'จำนวนนิสิตรวม (พยากรณ์)',
                data: trend.map((t, i) => {
                    if (t.type === 'forecast') return t.total;
                    if (i === actualData.length - 1) return t.total;
                    return null;
                }),
                borderColor: '#006838',
                borderDash: [8, 4],
                backgroundColor: 'rgba(0, 104, 56, 0.05)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#00a651',
                pointRadius: 6,
                pointHoverRadius: 8,
                pointStyle: 'triangle',
            },
            {
                label: 'ป.ตรี',
                data: trend.map(t => t.bachelor),
                borderColor: '#2E86AB',
                tension: 0.4,
                pointRadius: 4,
                borderWidth: 2,
            },
            {
                label: 'ป.โท + ป.เอก',
                data: trend.map(t => t.master + t.doctoral),
                borderColor: '#C5A028',
                tension: 0.4,
                pointRadius: 4,
                borderWidth: 2,
            }
        ]
    };

    const trendLineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 12, font: { size: 11 } } },
            tooltip: {
                callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString() || '-'} คน` }
            }
        },
        scales: {
            x: { ticks: { color: '#9ca3af' }, grid: { display: false } },
            y: {
                ticks: { color: '#9ca3af', callback: (v) => v.toLocaleString() },
                grid: { color: 'rgba(255,255,255,0.05)' }
            }
        }
    };

    // Calculate YoY growth
    const lastActual = trend.filter(t => t.type === 'actual');
    const growthYoY = lastActual.length >= 2
        ? (((lastActual[lastActual.length - 1].total - lastActual[lastActual.length - 2].total) / lastActual[lastActual.length - 2].total) * 100).toFixed(1)
        : 0;

    // ==================== Science Faculty Charts ====================
    const sciDoughnutData = {
        labels: scienceFaculty.byLevel.filter(l => l.count > 0).map(l => l.level),
        datasets: [{
            data: scienceFaculty.byLevel.filter(l => l.count > 0).map(l => l.count),
            backgroundColor: scienceFaculty.byLevel.filter(l => l.count > 0).map(l => l.color),
            borderWidth: 0,
            cutout: '60%',
        }]
    };

    const sciDoughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: { color: '#9ca3af', padding: 14, font: { size: 11 } }
            },
            tooltip: {
                callbacks: {
                    label: (ctx) => `${ctx.label}: ${ctx.parsed.toLocaleString()} คน (${((ctx.parsed / scienceFaculty.total) * 100).toFixed(1)}%)`
                }
            }
        }
    };

    const enrollmentBarData = {
        labels: scienceFaculty.byEnrollmentYear.map(e => `รหัส ${e.year.slice(-2)}`),
        datasets: [{
            label: 'จำนวนนิสิต',
            data: scienceFaculty.byEnrollmentYear.map(e => e.count),
            backgroundColor: scienceFaculty.byEnrollmentYear.map((_, i) => {
                const colors = ['#1a3a2a', '#1e5a3a', '#006838', '#00a651', '#2E86AB', '#7B68EE'];
                return colors[i] || '#006838';
            }),
            borderRadius: 8,
            borderSkipped: false,
        }]
    };

    const enrollmentBarOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: { label: (ctx) => `${ctx.parsed.y.toLocaleString()} คน` }
            }
        },
        scales: {
            x: { ticks: { color: '#9ca3af' }, grid: { display: false } },
            y: {
                ticks: { color: '#9ca3af' },
                grid: { color: 'rgba(255,255,255,0.05)' }
            }
        }
    };

    const scienceSharePct = ((scienceFaculty.total / current.total) * 100).toFixed(1);

    return (
        <div>
            <Link to="/dashboard" className="back-button">
                <ArrowLeft size={16} /> กลับหน้าหลัก
            </Link>

            <div className="section-header">
                <div className="section-header-icon" style={{ background: 'linear-gradient(135deg, #7B68EE, #5B4FCF)' }}>
                    <BarChart3 size={22} color="#fff" />
                </div>
                <div>
                    <h2>สถิตินิสิตปัจจุบัน</h2>
                    <p>Current Student Statistics — อ้างอิง มหาวิทยาลัยแม่โจ้</p>
                </div>
            </div>

            {/* Knowledge Dynamic Dashboard — Filter Bar */}
            <div className="filter-bar">
                <label>ตัวกรอง:</label>
                <select value={selectedFaculty} onChange={(e) => setSelectedFaculty(e.target.value)}>
                    <option value="all">ทุกคณะ</option>
                    {byFaculty.map((f, i) => (
                        <option key={i} value={f.name}>{f.name}</option>
                    ))}
                </select>
                <select value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)}>
                    <option value="all">ทุกระดับ</option>
                    <option value="bachelor">ปริญญาตรี</option>
                    <option value="master">ปริญญาโท</option>
                    <option value="doctoral">ปริญญาเอก</option>
                </select>
                <button className="filter-apply-btn" onClick={() => setFiltersApplied(true)}>
                    <Filter size={14} /> Apply Filters
                </button>
                <button className="filter-reset-btn" onClick={() => {
                    setSelectedFaculty('all');
                    setSelectedLevel('all');
                    setFiltersApplied(false);
                }}>
                    <RotateCcw size={12} /> Reset
                </button>
                {(selectedFaculty !== 'all' || selectedLevel !== 'all') && (
                    <span style={{ fontSize: '0.78rem', color: '#00a651', fontWeight: 600, marginLeft: 'auto' }}>
                        ผลลัพธ์: {filteredTotal.toLocaleString()} คน
                    </span>
                )}
            </div>

            {/* Summary Stats */}
            <div className="stats-grid">
                {current.byLevel.map((item, i) => (
                    <div key={i} className="stat-card animate-in">
                        <div className="stat-card-header">
                            <div className="stat-card-icon" style={{ background: `linear-gradient(135deg, ${item.color}, ${item.color}cc)` }}>
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {i === 0 ? <GraduationCap size={20} color="#fff" /> : i === 1 ? <BookOpen size={20} color="#fff" /> : i === 2 ? <Award size={20} color="#fff" /> : <FileText size={20} color="#fff" />}
                                </span>
                            </div>
                            {i === 0 && <span className="stat-card-trend up">+{growthYoY}%</span>}
                        </div>
                        <div className="stat-card-value">{item.count.toLocaleString()}</div>
                        <div className="stat-card-label">{item.level}</div>
                    </div>
                ))}
            </div>

            {/* Charts */}
            <div className="charts-grid">
                <div className="chart-card animate-in">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">สัดส่วนนิสิตแต่ละระดับ</div>
                            <div className="chart-card-subtitle">รวมทั้งหมด {current.total.toLocaleString()} คน</div>
                        </div>
                    </div>
                    <div className="chart-container">
                        <Doughnut data={doughnutData} options={doughnutOptions} />
                    </div>
                </div>

                <div className="chart-card animate-in">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">แนวโน้มจำนวนนิสิต</div>
                            <div className="chart-card-subtitle">ย้อนหลัง 4 ปี + พยากรณ์ 2 ปี (เส้นประ = พยากรณ์)</div>
                        </div>
                    </div>
                    <div className="chart-container">
                        <Line data={trendLineData} options={trendLineOptions} />
                    </div>
                </div>
            </div>

            {/* Faculty Table */}
            <div className="data-table-container animate-in" style={{ marginTop: 32 }}>
                <div className="data-table-header">
                    <span className="data-table-title">จำนวนนิสิตแยกตามคณะ</span>
                </div>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>คณะ</th>
                            <th>ป.ตรี</th>
                            <th>ป.โท</th>
                            <th>ป.เอก</th>
                            <th>รวม</th>
                        </tr>
                    </thead>
                    <tbody>
                        {byFaculty.map((fac, i) => {
                            const total = fac.bachelor + fac.master + fac.doctoral;
                            const isSci = fac.name === 'คณะวิทยาศาสตร์';
                            return (
                                <tr key={i} style={isSci ? { background: 'rgba(0, 104, 56, 0.15)', borderLeft: '3px solid #00a651' } : {}}>
                                    <td style={{ fontWeight: isSci ? 700 : 500, color: isSci ? '#00a651' : undefined }}>{isSci ? '⭐ ' : ''}{fac.name}</td>
                                    <td style={{ color: 'var(--mju-green-light)' }}>{fac.bachelor.toLocaleString()}</td>
                                    <td style={{ color: '#2E86AB' }}>{fac.master}</td>
                                    <td style={{ color: '#A23B72' }}>{fac.doctoral}</td>
                                    <td style={{ fontWeight: 700 }}>{total.toLocaleString()}</td>
                                </tr>
                            );
                        })}
                        <tr style={{ background: 'rgba(0,104,56,0.1)', fontWeight: 700 }}>
                            <td>รวมทั้งหมด</td>
                            <td style={{ color: 'var(--mju-green-light)' }}>{byFaculty.reduce((s, f) => s + f.bachelor, 0).toLocaleString()}</td>
                            <td style={{ color: '#2E86AB' }}>{byFaculty.reduce((s, f) => s + f.master, 0)}</td>
                            <td style={{ color: '#A23B72' }}>{byFaculty.reduce((s, f) => s + f.doctoral, 0)}</td>
                            <td>{byFaculty.reduce((s, f) => s + f.bachelor + f.master + f.doctoral, 0).toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* ==================== คณะวิทยาศาสตร์ Section ==================== */}
            <div style={{ marginTop: 48, paddingTop: 32, borderTop: '2px solid rgba(0, 166, 81, 0.2)' }}>
                <div className="section-header">
                    <div className="section-header-icon" style={{ background: 'linear-gradient(135deg, #006838, #00a651)' }}>
                        <Microscope size={22} color="#fff" />
                    </div>
                    <div>
                        <h2>คณะวิทยาศาสตร์</h2>
                        <p>Faculty of Science — ข้อมูลนิสิตและบุคลากร เฉพาะคณะวิทยาศาสตร์</p>
                    </div>
                    <div style={{
                        marginLeft: 'auto',
                        background: 'linear-gradient(135deg, rgba(0, 104, 56, 0.2), rgba(0, 166, 81, 0.1))',
                        border: '1px solid rgba(0, 166, 81, 0.3)',
                        borderRadius: 12,
                        padding: '8px 18px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center'
                    }}>
                        <span style={{ fontSize: 22, fontWeight: 800, color: '#00a651' }}>{scienceFaculty.total.toLocaleString()}</span>
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>คน ({scienceSharePct}% ของทั้งมหาวิทยาลัย)</span>
                    </div>
                </div>

                {/* Science Faculty Stat Cards */}
                <div className="stats-grid">
                    {scienceFaculty.byLevel.map((item, i) => (
                        <div key={i} className="stat-card animate-in" style={{
                            borderTop: `3px solid ${item.color}`,
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                position: 'absolute',
                                top: 0, right: 0,
                                width: 80, height: 80,
                                background: `radial-gradient(circle at top right, ${item.color}15, transparent 70%)`,
                                borderRadius: '0 0 0 100%'
                            }} />
                            <div className="stat-card-header">
                                <div className="stat-card-icon" style={{ background: `linear-gradient(135deg, ${item.color}, ${item.color}cc)` }}>
                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {i === 0 ? <GraduationCap size={20} color="#fff" /> : i === 1 ? <BookOpen size={20} color="#fff" /> : i === 2 ? <Award size={20} color="#fff" /> : <FileText size={20} color="#fff" />}
                                    </span>
                                </div>
                                {item.count > 0 && (
                                    <span style={{
                                        fontSize: 11,
                                        color: '#9ca3af',
                                        background: 'rgba(255,255,255,0.05)',
                                        padding: '2px 8px',
                                        borderRadius: 8
                                    }}>
                                        {((item.count / scienceFaculty.total) * 100).toFixed(1)}%
                                    </span>
                                )}
                            </div>
                            <div className="stat-card-value">{item.count.toLocaleString()}</div>
                            <div className="stat-card-label">{item.level}</div>
                        </div>
                    ))}
                </div>

                {/* Science Faculty Charts */}
                <div className="charts-grid">
                    <div className="chart-card animate-in">
                        <div className="chart-card-header">
                            <div>
                                <div className="chart-card-title">สัดส่วนนิสิต คณะวิทยาศาสตร์</div>
                                <div className="chart-card-subtitle">รวม {scienceFaculty.total.toLocaleString()} คน</div>
                            </div>
                        </div>
                        <div className="chart-container">
                            <Doughnut data={sciDoughnutData} options={sciDoughnutOptions} />
                        </div>
                    </div>

                    <div className="chart-card animate-in">
                        <div className="chart-card-header">
                            <div>
                                <div className="chart-card-title">จำนวนนิสิตแยกตามรหัสนักศึกษา</div>
                                <div className="chart-card-subtitle">คณะวิทยาศาสตร์ — แยกตามปีที่เข้าศึกษา</div>
                            </div>
                        </div>
                        <div className="chart-container">
                            <Bar data={enrollmentBarData} options={enrollmentBarOptions} />
                        </div>
                    </div>
                </div>

                {/* Personnel & Nationality Info */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginTop: 24 }}>
                    {/* Personnel Card */}
                    <div className="chart-card animate-in">
                        <div className="chart-card-header">
                            <div>
                                <div className="chart-card-title">บุคลากรคณะวิทยาศาสตร์</div>
                                <div className="chart-card-subtitle">รวม {scienceFaculty.personnel.total} คน (ชาย {scienceFaculty.personnel.male} / หญิง {scienceFaculty.personnel.female})</div>
                            </div>
                        </div>
                        <div style={{ padding: '0 20px 20px' }}>
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8, fontWeight: 600 }}>ตำแหน่งทางวิชาการ</div>
                                {scienceFaculty.personnel.byPosition.map((pos, i) => {
                                    const pct = ((pos.count / scienceFaculty.personnel.total) * 100).toFixed(0);
                                    const colors = ['#006838', '#2E86AB', '#C5A028'];
                                    return (
                                        <div key={i} style={{ marginBottom: 10 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                                                <span style={{ color: '#e5e7eb' }}>{pos.position}</span>
                                                <span style={{ color: colors[i], fontWeight: 700 }}>{pos.count} คน ({pct}%)</span>
                                            </div>
                                            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                                <div style={{
                                                    width: `${pct}%`,
                                                    height: '100%',
                                                    background: `linear-gradient(90deg, ${colors[i]}, ${colors[i]}aa)`,
                                                    borderRadius: 3,
                                                    transition: 'width 1s ease-out'
                                                }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8, fontWeight: 600 }}>ประเภทการจ้าง</div>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    {scienceFaculty.personnel.byType.map((t, i) => (
                                        <div key={i} style={{
                                            flex: 1,
                                            background: 'rgba(255,255,255,0.03)',
                                            borderRadius: 10,
                                            padding: '12px 14px',
                                            textAlign: 'center',
                                            border: '1px solid rgba(255,255,255,0.06)'
                                        }}>
                                            <div style={{ fontSize: 20, fontWeight: 800, color: i === 0 ? '#00a651' : '#C5A028' }}>{t.count}</div>
                                            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{t.type}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8, fontWeight: 600 }}>ระดับการศึกษา</div>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    {scienceFaculty.personnel.byEducation.map((e, i) => (
                                        <div key={i} style={{
                                            flex: 1,
                                            background: 'rgba(255,255,255,0.03)',
                                            borderRadius: 10,
                                            padding: '12px 14px',
                                            textAlign: 'center',
                                            border: '1px solid rgba(255,255,255,0.06)'
                                        }}>
                                            <div style={{ fontSize: 20, fontWeight: 800, color: i === 0 ? '#7B68EE' : '#2E86AB' }}>{e.count}</div>
                                            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{e.level}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Nationality Card */}
                    <div className="chart-card animate-in">
                        <div className="chart-card-header">
                            <div>
                                <div className="chart-card-title">สัญชาตินิสิต คณะวิทยาศาสตร์</div>
                                <div className="chart-card-subtitle">จำแนกตามสัญชาติ</div>
                            </div>
                        </div>
                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {scienceFaculty.byNationality.map((n, i) => {
                                const pct = ((n.count / scienceFaculty.total) * 100).toFixed(1);
                                const color = i === 0 ? '#006838' : '#F18F01';
                                return (
                                    <div key={i}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{
                                                    width: 40, height: 40,
                                                    borderRadius: 10,
                                                    background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: 20
                                                }}>
                                                    {i === 0 ? 'TH' : 'INT'}
                                                </div>
                                                <div>
                                                    <div style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 14 }}>{n.nationality}</div>
                                                    <div style={{ color: '#9ca3af', fontSize: 11 }}>{pct}%</div>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: 24, fontWeight: 800, color }}>
                                                {n.count.toLocaleString()}
                                            </div>
                                        </div>
                                        <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                            <div style={{
                                                width: `${pct}%`,
                                                height: '100%',
                                                background: `linear-gradient(90deg, ${color}, ${color}88)`,
                                                borderRadius: 4,
                                                transition: 'width 1.2s ease-out'
                                            }} />
                                        </div>
                                    </div>
                                );
                            })}

                            <div style={{
                                marginTop: 8,
                                padding: '14px 16px',
                                background: 'linear-gradient(135deg, rgba(0,104,56,0.1), rgba(0,166,81,0.05))',
                                border: '1px solid rgba(0,166,81,0.2)',
                                borderRadius: 12,
                                textAlign: 'center'
                            }}>
                                <div style={{ fontSize: 12, color: '#9ca3af' }}>นิสิตสัญชาติไทยคิดเป็น</div>
                                <div style={{ fontSize: 28, fontWeight: 800, color: '#00a651', marginTop: 4 }}>
                                    {((scienceFaculty.byNationality[0].count / scienceFaculty.total) * 100).toFixed(1)}%
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
