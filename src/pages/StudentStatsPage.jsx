import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import AccessDenied from '../components/AccessDenied';
import { studentStatsData } from '../data/mockData';
import { ensureStudentList, getStudentListSync, onStudentDataChange } from '../services/studentDataService';
import { ArrowLeft, Filter, RotateCcw, GraduationCap, BookOpen, Award, FileText, BarChart3, Microscope, X, MousePointerClick } from 'lucide-react';
import ExportPDFButton from '../components/ExportPDFButton';
import { Doughnut, Line, Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
    Title, Tooltip, Legend, ArcElement, Filler, BarElement
} from 'chart.js';
import { themeAdaptorPlugin } from '../utils/chartTheme';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler, BarElement, themeAdaptorPlugin);

export default function StudentStatsPage() {
    const { user } = useAuth();
    const [selectedFaculty, setSelectedFaculty] = useState('all');
    const [selectedLevel, setSelectedLevel] = useState('all');
    const [appliedFaculty, setAppliedFaculty] = useState('all');
    const [appliedLevel, setAppliedLevel] = useState('all');
    const [drillYear, setDrillYear] = useState(null); // e.g. '2565'
    const [, forceTick] = useState(0);

    useEffect(() => {
        ensureStudentList().then(() => forceTick(t => t + 1));
        const unsub = onStudentDataChange(() => forceTick(t => t + 1));
        return () => unsub && unsub();
    }, []);

    if (!canAccess(user?.role, 'student_stats')) return <AccessDenied />;

    const { current, byFaculty, trend, scienceFaculty } = studentStatsData;

    const isFiltered = appliedFaculty !== 'all' || appliedLevel !== 'all';

    // Apply filters using the committed (applied) values
    const filteredFaculty = appliedFaculty === 'all'
        ? byFaculty
        : byFaculty.filter(f => f.name === appliedFaculty);

    const filteredTotal = filteredFaculty.reduce((sum, f) => {
        if (appliedLevel === 'all') return sum + f.bachelor + f.master + f.doctoral;
        if (appliedLevel === 'bachelor') return sum + f.bachelor;
        if (appliedLevel === 'master') return sum + f.master;
        if (appliedLevel === 'doctoral') return sum + f.doctoral;
        return sum;
    }, 0);

    // Build filtered stat cards from applied filters
    const filteredByLevel = useMemo(() => {
        const levels = [
            { level: 'ปริญญาตรี', key: 'bachelor', color: '#006838' },
            { level: 'ปริญญาโท', key: 'master', color: '#2E86AB' },
            { level: 'ปริญญาเอก', key: 'doctoral', color: '#A23B72' },
        ];
        if (appliedLevel !== 'all') {
            const lvl = levels.find(l => l.key === appliedLevel);
            return lvl ? [{ ...lvl, count: filteredFaculty.reduce((s, f) => s + f[lvl.key], 0) }] : [];
        }
        return levels.map(l => ({ ...l, count: filteredFaculty.reduce((s, f) => s + f[l.key], 0) }));
    }, [appliedFaculty, appliedLevel, filteredFaculty]);

    // Doughnut chart for student levels
    const levelPalette = ['#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b'];
    const doughnutData = {
        labels: current.byLevel.map(l => l.level),
        datasets: [{
            data: current.byLevel.map(l => l.count),
            backgroundColor: current.byLevel.map((_, i) => levelPalette[i % levelPalette.length]),
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
                labels: { color: 'var(--text-muted)', padding: 14, font: { size: 11 } }
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
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#22c55e',
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
                borderColor: '#22c55e',
                borderDash: [8, 4],
                backgroundColor: 'rgba(34, 197, 94, 0.05)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#22c55e',
                pointRadius: 6,
                pointHoverRadius: 8,
                pointStyle: 'triangle',
            },
            {
                label: 'ป.ตรี',
                data: trend.map(t => t.bachelor),
                borderColor: '#3b82f6',
                tension: 0.4,
                pointRadius: 4,
                borderWidth: 2,
            },
            {
                label: 'ป.โท + ป.เอก',
                data: trend.map(t => t.master + t.doctoral),
                borderColor: '#f59e0b',
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
            legend: { position: 'bottom', labels: { color: 'var(--text-muted)', padding: 12, font: { size: 11 } } },
            tooltip: {
                callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString() || '-'} คน` }
            }
        },
        scales: {
            x: { ticks: { color: 'var(--text-muted)' }, grid: { display: false } },
            y: {
                ticks: { color: 'var(--text-muted)', callback: (v) => v.toLocaleString() },
                grid: { color: 'var(--border-color)' }
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
            backgroundColor: scienceFaculty.byLevel.filter(l => l.count > 0).map((_, i) => levelPalette[i % levelPalette.length]),
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
                labels: { color: 'var(--text-muted)', padding: 14, font: { size: 11 } }
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
                const colors = ['rgba(100, 116, 139, 0.7)', 'rgba(20, 184, 166, 0.7)', 'rgba(34, 197, 94, 0.7)', 'rgba(59, 130, 246, 0.7)', 'rgba(139, 92, 246, 0.7)', 'rgba(123, 104, 238, 0.7)'];
                return colors[i] || 'rgba(34, 197, 94, 0.7)';
            }),
            borderColor: scienceFaculty.byEnrollmentYear.map((_, i) => {
                const colors = ['#64748b', '#14b8a6', '#22c55e', '#3b82f6', '#8b5cf6', '#7B68EE'];
                return colors[i] || '#22c55e';
            }),
            borderWidth: 1,
            borderRadius: 8,
            borderSkipped: false,
        }]
    };

    const enrollmentBarOptions = {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_evt, elements) => {
            if (!elements || elements.length === 0) return;
            const idx = elements[0].index;
            const year = scienceFaculty.byEnrollmentYear[idx]?.year;
            if (year) setDrillYear(year);
        },
        onHover: (evt, elements) => {
            if (evt?.native?.target) {
                evt.native.target.style.cursor = elements?.length ? 'pointer' : 'default';
            }
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: { label: (ctx) => `${ctx.parsed.y.toLocaleString()} คน (คลิกเพื่อดูรายชื่อ)` }
            }
        },
        scales: {
            x: { ticks: { color: 'var(--text-muted)' }, grid: { display: false } },
            y: {
                ticks: { color: 'var(--text-muted)' },
                grid: { color: 'var(--border-color)' }
            }
        }
    };

    // Drill-down: students whose id starts with 2-digit intake code matching drillYear
    const drillStudents = drillYear
        ? getStudentListSync().filter(s => String(s.id || '').slice(0, 2) === String(drillYear).slice(-2))
        : [];

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
                <div style={{ marginLeft: 'auto' }}>
                    <ExportPDFButton title="สถิตินิสิตปัจจุบัน" />
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
                <button className="filter-apply-btn" onClick={() => { setAppliedFaculty(selectedFaculty); setAppliedLevel(selectedLevel); }}>
                    <Filter size={14} /> Apply Filters
                </button>
                <button className="filter-reset-btn" onClick={() => {
                    setSelectedFaculty('all');
                    setSelectedLevel('all');
                    setAppliedFaculty('all');
                    setAppliedLevel('all');
                }}>
                    <RotateCcw size={12} /> Reset
                </button>
                {isFiltered && (
                    <span style={{ fontSize: '0.85rem', color: '#00a651', fontWeight: 600, marginLeft: 'auto' }}>
                        กรอง: {appliedFaculty !== 'all' ? appliedFaculty : 'ทุกคณะ'} / {appliedLevel !== 'all' ? (appliedLevel === 'bachelor' ? 'ป.ตรี' : appliedLevel === 'master' ? 'ป.โท' : 'ป.เอก') : 'ทุกระดับ'} — ผลลัพธ์: {filteredTotal.toLocaleString()} คน
                    </span>
                )}
            </div>

            {/* Summary Stats */}
            <div className="stats-grid">
                {(isFiltered ? filteredByLevel : current.byLevel).map((item, i) => (
                    <div key={i} className="stat-card animate-in">
                        <div className="stat-card-header">
                            <div className="stat-card-icon" style={{ background: `linear-gradient(135deg, ${item.color}, ${item.color}cc)` }}>
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {item.key === 'bachelor' || (!item.key && i === 0) ? <GraduationCap size={20} color="#fff" /> : item.key === 'master' || (!item.key && i === 1) ? <BookOpen size={20} color="#fff" /> : item.key === 'doctoral' || (!item.key && i === 2) ? <Award size={20} color="#fff" /> : <FileText size={20} color="#fff" />}
                                </span>
                            </div>
                            {!isFiltered && i === 0 && <span className="stat-card-trend up">+{growthYoY}%</span>}
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
                    <span className="data-table-title">จำนวนนิสิตแยกตามคณะ{isFiltered ? ' (กรองแล้ว)' : ''}</span>
                </div>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>คณะ</th>
                            {(appliedLevel === 'all' || appliedLevel === 'bachelor') && <th>ป.ตรี</th>}
                            {(appliedLevel === 'all' || appliedLevel === 'master') && <th>ป.โท</th>}
                            {(appliedLevel === 'all' || appliedLevel === 'doctoral') && <th>ป.เอก</th>}
                            {appliedLevel === 'all' && <th>รวม</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredFaculty.map((fac, i) => {
                            const total = appliedLevel === 'all'
                                ? fac.bachelor + fac.master + fac.doctoral
                                : fac[appliedLevel] || 0;
                            const isSci = fac.name === 'คณะวิทยาศาสตร์';
                            return (
                                <tr key={i} style={isSci ? { background: 'rgba(0, 104, 56, 0.15)', borderLeft: '3px solid #00a651' } : {}}>
                                    <td style={{ fontWeight: isSci ? 700 : 500, color: isSci ? '#00a651' : undefined }}>{isSci ? '⭐ ' : ''}{fac.name}</td>
                                    {(appliedLevel === 'all' || appliedLevel === 'bachelor') && <td style={{ color: 'var(--mju-green-light)' }}>{fac.bachelor.toLocaleString()}</td>}
                                    {(appliedLevel === 'all' || appliedLevel === 'master') && <td style={{ color: '#2E86AB' }}>{fac.master}</td>}
                                    {(appliedLevel === 'all' || appliedLevel === 'doctoral') && <td style={{ color: '#A23B72' }}>{fac.doctoral}</td>}
                                    {appliedLevel === 'all' && <td style={{ fontWeight: 700 }}>{total.toLocaleString()}</td>}
                                </tr>
                            );
                        })}
                        <tr style={{ background: 'rgba(0,104,56,0.1)', fontWeight: 700 }}>
                            <td>รวม{isFiltered ? ' (กรองแล้ว)' : 'ทั้งหมด'}</td>
                            {(appliedLevel === 'all' || appliedLevel === 'bachelor') && <td style={{ color: 'var(--mju-green-light)' }}>{filteredFaculty.reduce((s, f) => s + f.bachelor, 0).toLocaleString()}</td>}
                            {(appliedLevel === 'all' || appliedLevel === 'master') && <td style={{ color: '#2E86AB' }}>{filteredFaculty.reduce((s, f) => s + f.master, 0)}</td>}
                            {(appliedLevel === 'all' || appliedLevel === 'doctoral') && <td style={{ color: '#A23B72' }}>{filteredFaculty.reduce((s, f) => s + f.doctoral, 0)}</td>}
                            {appliedLevel === 'all' && <td>{filteredFaculty.reduce((s, f) => s + f.bachelor + f.master + f.doctoral, 0).toLocaleString()}</td>}
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
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>คน ({scienceSharePct}% ของทั้งมหาวิทยาลัย)</span>
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
                                        fontSize: 12,
                                        color: 'var(--text-secondary)',
                                        background: 'var(--bg-secondary)',
                                        padding: '3px 10px',
                                        borderRadius: 8,
                                        fontWeight: 600
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
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                fontSize: '0.75rem', color: '#7B68EE', fontWeight: 600,
                                padding: '4px 10px', background: 'rgba(123,104,238,0.12)',
                                borderRadius: 999
                            }}>
                                <MousePointerClick size={12} /> คลิกแท่งเพื่อดูรายชื่อ
                            </span>
                        </div>
                        <div className="chart-container">
                            <Bar data={enrollmentBarData} options={enrollmentBarOptions} />
                        </div>
                    </div>
                </div>

                {/* ==================== NEW: Gender + Ratio + Intake ==================== */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginTop: 24 }}>
                    {/* Gender Distribution */}
                    <div className="chart-card animate-in">
                        <div className="chart-card-header">
                            <div>
                                <div className="chart-card-title">👫 สัดส่วนเพศนักศึกษา</div>
                                <div className="chart-card-subtitle">คณะวิทยาศาสตร์ — ข้อมูลจาก MJU Dashboard</div>
                            </div>
                        </div>
                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                            <div className="chart-container" style={{ height: 200 }}>
                                <Doughnut data={{
                                    labels: ['ชาย', 'หญิง'],
                                    datasets: [{
                                        data: [scienceFaculty.byGender.male, scienceFaculty.byGender.female],
                                        backgroundColor: ['#3b82f6', '#ec4899'],
                                        borderWidth: 0,
                                        cutout: '65%',
                                    }]
                                }} options={{
                                    responsive: true, maintainAspectRatio: false,
                                    plugins: {
                                        legend: { position: 'bottom', labels: { color: 'var(--text-muted)', padding: 14, font: { size: 12 } } },
                                        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed.toLocaleString()} คน (${((ctx.parsed / scienceFaculty.total) * 100).toFixed(1)}%)` } }
                                    }
                                }} />
                            </div>
                            <div style={{ display: 'flex', gap: 24, justifyContent: 'center', width: '100%' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 28, fontWeight: 800, color: '#2E86AB' }}>{scienceFaculty.byGender.male}</div>
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>ชาย ({scienceFaculty.byGender.malePercent}%)</div>
                                </div>
                                <div style={{ width: 1, background: 'var(--border-color)' }} />
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 28, fontWeight: 800, color: '#E91E63' }}>{scienceFaculty.byGender.female}</div>
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>หญิง ({scienceFaculty.byGender.femalePercent}%)</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Student-to-Faculty Ratio */}
                    <div className="chart-card animate-in">
                        <div className="chart-card-header">
                            <div>
                                <div className="chart-card-title">👨‍🏫 อัตราส่วน นศ. ต่ออาจารย์</div>
                                <div className="chart-card-subtitle">เปรียบเทียบกับเกณฑ์ สกอ. และมหาวิทยาลัยอื่น</div>
                            </div>
                        </div>
                        <div style={{ padding: '0 20px 20px' }}>
                            <div style={{
                                textAlign: 'center', padding: '16px', marginBottom: 16,
                                background: 'linear-gradient(135deg, rgba(0,104,56,0.15), rgba(0,166,81,0.08))',
                                border: '1px solid rgba(0,166,81,0.3)', borderRadius: 12
                            }}>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>อัตราส่วน นศ./อาจารย์</div>
                                <div style={{ fontSize: 36, fontWeight: 800, color: '#00a651' }}>{scienceFaculty.studentFacultyRatio.ratio}:1</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>({scienceFaculty.studentFacultyRatio.students} นศ. / {scienceFaculty.studentFacultyRatio.academicStaff} อาจารย์)</div>
                            </div>
                            <div className="chart-container" style={{ height: 180 }}>
                                <Bar data={{
                                    labels: scienceFaculty.studentFacultyRatio.comparison.map(c => c.name),
                                    datasets: [{
                                        label: 'อัตราส่วน นศ./อาจารย์',
                                        data: scienceFaculty.studentFacultyRatio.comparison.map(c => c.ratio),
                                        backgroundColor: scienceFaculty.studentFacultyRatio.comparison.map((_, i) => {
                                            const p = ['#22c55e', '#f59e0b', '#3b82f6', '#7B68EE', '#ec4899', '#06b6d4'];
                                            return p[i % p.length] + 'cc';
                                        }),
                                        borderColor: scienceFaculty.studentFacultyRatio.comparison.map((_, i) => {
                                            const p = ['#22c55e', '#f59e0b', '#3b82f6', '#7B68EE', '#ec4899', '#06b6d4'];
                                            return p[i % p.length];
                                        }),
                                        borderWidth: 1, borderRadius: 4,
                                    }]
                                }} options={{
                                    indexAxis: 'y',
                                    responsive: true, maintainAspectRatio: false,
                                    plugins: {
                                        legend: { display: false },
                                        tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.x}:1` } }
                                    },
                                    scales: {
                                        x: { ticks: { color: 'var(--text-muted)', callback: v => v + ':1' }, grid: { color: 'var(--border-color)' } },
                                        y: { ticks: { color: 'var(--text-primary)', font: { size: 11 } }, grid: { display: false } }
                                    }
                                }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* New Student Intake */}
                <div className="chart-card animate-in" style={{ marginTop: 20 }}>
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">🎓 จำนวนนักศึกษาใหม่ (Intake) คณะวิทยาศาสตร์</div>
                            <div className="chart-card-subtitle">ย้อนหลัง 5 ปี — อ้างอิงจาก MJU Dashboard</div>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, padding: '0 20px 20px' }}>
                        <div className="chart-container" style={{ height: 260 }}>
                            <Bar data={{
                                labels: scienceFaculty.newStudentIntake.map(s => `ปี ${s.year}`),
                                datasets: [
                                    {
                                        label: 'ป.ตรี',
                                        data: scienceFaculty.newStudentIntake.map(s => s.bachelor),
                                        backgroundColor: 'rgba(34, 197, 94, 0.7)',
                                        borderColor: '#22c55e', borderWidth: 1, borderRadius: 4,
                                    },
                                    {
                                        label: 'ป.โท + ป.เอก',
                                        data: scienceFaculty.newStudentIntake.map(s => s.master + s.doctoral),
                                        backgroundColor: 'rgba(59, 130, 246, 0.7)',
                                        borderColor: '#3b82f6', borderWidth: 1, borderRadius: 4,
                                    }
                                ]
                            }} options={{
                                responsive: true, maintainAspectRatio: false,
                                plugins: {
                                    legend: { position: 'bottom', labels: { color: 'var(--text-muted)', padding: 12, font: { size: 11 } } },
                                    tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()} คน` } }
                                },
                                scales: {
                                    x: { stacked: true, ticks: { color: 'var(--text-muted)' }, grid: { display: false } },
                                    y: { stacked: true, ticks: { color: 'var(--text-muted)' }, grid: { color: 'var(--border-color)' } }
                                }
                            }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {scienceFaculty.newStudentIntake.map((intake, i) => {
                                const prev = i > 0 ? scienceFaculty.newStudentIntake[i - 1].total : null;
                                const growth = prev ? (((intake.total - prev) / prev) * 100).toFixed(1) : null;
                                return (
                                    <div key={i} style={{
                                        background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 14px',
                                        border: '1px solid var(--border-color)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>ปี {intake.year}</span>
                                            <span style={{ fontSize: 17, fontWeight: 800, color: '#00a651' }}>{intake.total}</span>
                                        </div>
                                        {growth && (
                                            <span style={{
                                                fontSize: 12, fontWeight: 600,
                                                color: parseFloat(growth) >= 0 ? '#00a651' : '#E91E63'
                                            }}>
                                                {parseFloat(growth) >= 0 ? '↑' : '↓'} {growth}%
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
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
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>ตำแหน่งทางวิชาการ</div>
                                {scienceFaculty.personnel.byPosition.map((pos, i) => {
                                    const pct = ((pos.count / scienceFaculty.personnel.total) * 100).toFixed(0);
                                    const colors = ['#006838', '#2E86AB', '#C5A028'];
                                    return (
                                        <div key={i} style={{ marginBottom: 10 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                                                <span style={{ color: 'var(--text-primary)' }}>{pos.position}</span>
                                                <span style={{ color: colors[i], fontWeight: 700 }}>{pos.count} คน ({pct}%)</span>
                                            </div>
                                            <div style={{ height: 6, borderRadius: 3, background: 'var(--border-color)', overflow: 'hidden' }}>
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
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>ประเภทการจ้าง</div>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    {scienceFaculty.personnel.byType.map((t, i) => (
                                        <div key={i} style={{
                                            flex: 1,
                                            background: 'var(--bg-secondary)',
                                            borderRadius: 10,
                                            padding: '12px 14px',
                                            textAlign: 'center',
                                            border: '1px solid var(--border-color)'
                                        }}>
                                            <div style={{ fontSize: 22, fontWeight: 800, color: i === 0 ? '#00a651' : '#C5A028' }}>{t.count}</div>
                                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, fontWeight: 500 }}>{t.type}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>ระดับการศึกษา</div>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    {scienceFaculty.personnel.byEducation.map((e, i) => (
                                        <div key={i} style={{
                                            flex: 1,
                                            background: 'var(--bg-secondary)',
                                            borderRadius: 10,
                                            padding: '12px 14px',
                                            textAlign: 'center',
                                            border: '1px solid var(--border-color)'
                                        }}>
                                            <div style={{ fontSize: 22, fontWeight: 800, color: i === 0 ? '#7B68EE' : '#2E86AB' }}>{e.count}</div>
                                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, fontWeight: 500 }}>{e.level}</div>
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
                                                    <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 15 }}>{n.nationality}</div>
                                                    <div style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500 }}>{pct}%</div>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: 24, fontWeight: 800, color }}>
                                                {n.count.toLocaleString()}
                                            </div>
                                        </div>
                                        <div style={{ height: 8, borderRadius: 4, background: 'var(--border-color)', overflow: 'hidden' }}>
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
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>นิสิตสัญชาติไทยคิดเป็น</div>
                                <div style={{ fontSize: 28, fontWeight: 800, color: '#00a651', marginTop: 4 }}>
                                    {((scienceFaculty.byNationality[0].count / scienceFaculty.total) * 100).toFixed(1)}%
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Drill-down modal */}
            {drillYear && (
                <div
                    className="admin-modal-overlay no-print"
                    onClick={() => setDrillYear(null)}
                    style={{ padding: 20 }}
                >
                    <div
                        className="admin-modal"
                        onClick={e => e.stopPropagation()}
                        style={{ maxWidth: 900, width: '100%', textAlign: 'left' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: 12,
                                background: 'linear-gradient(135deg, #7B68EE, #5B4FCF)',
                                color: '#fff', display: 'flex',
                                alignItems: 'center', justifyContent: 'center'
                            }}>
                                <GraduationCap size={22} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h2 style={{ margin: 0, fontSize: '1.15rem' }}>
                                    นักศึกษารหัส {String(drillYear).slice(-2)} (ปี {drillYear})
                                </h2>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    พบ {drillStudents.length.toLocaleString('th-TH')} รายการจากข้อมูลหลัก
                                </p>
                            </div>
                            <button
                                className="admin-btn-ghost"
                                onClick={() => setDrillYear(null)}
                                style={{ padding: '6px 10px' }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {drillStudents.length === 0 ? (
                            <div className="admin-empty-state" style={{ padding: 24 }}>
                                <p>ไม่พบรายชื่อนักศึกษาที่มีรหัสขึ้นต้นด้วย {String(drillYear).slice(-2)} ในข้อมูลหลัก</p>
                                <p style={{ fontSize: '0.85rem' }}>
                                    อาจเพราะยังไม่ได้อัพโหลดข้อมูลจริง หรือข้อมูลที่อัพโหลดไม่ครอบคลุมปีนี้
                                </p>
                            </div>
                        ) : (
                            <div className="data-table-container" style={{ maxHeight: '60vh', overflow: 'auto' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>รหัส</th>
                                            <th>ชื่อ-นามสกุล</th>
                                            <th>สาขา</th>
                                            <th>ชั้นปี</th>
                                            <th>สถานะ</th>
                                            <th style={{ textAlign: 'right' }}>GPA</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {drillStudents.slice(0, 500).map((s, i) => (
                                            <tr key={s.id || i}>
                                                <td>{s.id}</td>
                                                <td>{s.prefix || ''} {s.name}</td>
                                                <td>{s.major}</td>
                                                <td>{s.year || '-'}</td>
                                                <td>{s.status || '-'}</td>
                                                <td style={{
                                                    textAlign: 'right',
                                                    color: s.gpa < 2 ? '#ef4444' : 'inherit',
                                                    fontWeight: 700
                                                }}>
                                                    {typeof s.gpa === 'number' ? s.gpa.toFixed(2) : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {drillStudents.length > 500 && (
                                    <div style={{ padding: 10, textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        แสดง 500 รายการแรกจาก {drillStudents.length.toLocaleString('th-TH')}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
