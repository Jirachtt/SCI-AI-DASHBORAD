import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import AccessDenied from '../components/AccessDenied';
import { ensureStudentList, getStudentListSync, onStudentDataChange } from '../services/studentDataService';
import { studentStatsData } from '../data/mockData';
import {
    ArrowLeft, TrendingDown, Users, AlertTriangle, CheckCircle, Filter, Info
} from 'lucide-react';
import ExportPDFButton from '../components/ExportPDFButton';
import { Bar, Line } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
    Title, Tooltip, Legend, BarElement, Filler
} from 'chart.js';
import { themeAdaptorPlugin } from '../utils/chartTheme';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, BarElement, Filler, themeAdaptorPlugin);

// Status bucket helpers — falls back to "กำลังศึกษา" if not specified
const ACTIVE_STATUSES = new Set(['กำลังศึกษา', 'active', 'enrolled']);
const DROPOUT_STATUSES = new Set(['พ้นสภาพ', 'ลาออก', 'ตกออก', 'dropped', 'withdrawn']);

// Year code → intake year (B.E.) : '65' → 2565
function intakeFromId(id) {
    if (!id || String(id).length < 2) return null;
    const code = String(id).slice(0, 2);
    const n = parseInt(code, 10);
    if (isNaN(n)) return null;
    return 2500 + n; // 65 → 2565
}

function statusBucket(s) {
    const st = (s.status || '').trim();
    if (DROPOUT_STATUSES.has(st)) return 'dropout';
    if (ACTIVE_STATUSES.has(st)) return 'active';
    // Anything non-empty that isn't clearly dropout → treat as active
    if (st) return 'active';
    return 'active';
}

export default function RetentionPage() {
    const { user } = useAuth();
    const [, setTick] = useState(0);
    const [majorFilter, setMajorFilter] = useState('all');

    useEffect(() => {
        let active = true;
        ensureStudentList().then(() => { if (active) setTick(t => t + 1); });
        const unsub = onStudentDataChange(() => { if (active) setTick(t => t + 1); });
        return () => { active = false; unsub && unsub(); };
    }, []);

    const students = getStudentListSync() || [];

    const majors = useMemo(() => {
        const s = new Set(students.map(x => x.major).filter(Boolean));
        return ['all', ...Array.from(s).sort()];
    }, [students]);

    // Cohort analysis: group by intake year from รหัสนักศึกษา
    const cohorts = useMemo(() => {
        const filtered = majorFilter === 'all' ? students : students.filter(s => s.major === majorFilter);
        const map = new Map();
        filtered.forEach(s => {
            const intake = intakeFromId(s.id);
            if (!intake) return;
            if (!map.has(intake)) map.set(intake, { intake, total: 0, active: 0, dropout: 0 });
            const row = map.get(intake);
            row.total++;
            if (statusBucket(s) === 'dropout') row.dropout++;
            else row.active++;
        });
        return Array.from(map.values())
            .sort((a, b) => a.intake - b.intake)
            .map(r => ({
                ...r,
                retentionRate: r.total > 0 ? +((r.active / r.total) * 100).toFixed(1) : 0,
                dropoutRate: r.total > 0 ? +((r.dropout / r.total) * 100).toFixed(1) : 0,
            }));
    }, [students, majorFilter]);

    // Per-major breakdown
    const byMajor = useMemo(() => {
        const map = new Map();
        students.forEach(s => {
            if (!s.major) return;
            if (!map.has(s.major)) map.set(s.major, { major: s.major, total: 0, active: 0, dropout: 0 });
            const row = map.get(s.major);
            row.total++;
            if (statusBucket(s) === 'dropout') row.dropout++;
            else row.active++;
        });
        return Array.from(map.values())
            .sort((a, b) => b.total - a.total)
            .map(r => ({
                ...r,
                retentionRate: r.total > 0 ? +((r.active / r.total) * 100).toFixed(1) : 0,
                dropoutRate: r.total > 0 ? +((r.dropout / r.total) * 100).toFixed(1) : 0,
            }));
    }, [students]);

    const totals = useMemo(() => {
        const total = students.length;
        const dropout = students.filter(s => statusBucket(s) === 'dropout').length;
        const active = total - dropout;
        return {
            total, active, dropout,
            retentionRate: total ? +((active / total) * 100).toFixed(1) : 0,
            dropoutRate: total ? +((dropout / total) * 100).toFixed(1) : 0
        };
    }, [students]);

    if (!canAccess(user?.role, 'retention')) return <AccessDenied />;

    // ---------- Charts ----------
    const cohortBarData = {
        labels: cohorts.map(c => `รหัส ${String(c.intake).slice(-2)}`),
        datasets: [
            {
                label: 'ยังศึกษาอยู่',
                data: cohorts.map(c => c.active),
                backgroundColor: 'rgba(34, 197, 94, 0.75)',
                borderRadius: 6,
                stack: 'cohort',
            },
            {
                label: 'พ้นสภาพ/ตกออก',
                data: cohorts.map(c => c.dropout),
                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                borderRadius: 6,
                stack: 'cohort',
            }
        ]
    };
    const cohortBarOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { color: 'var(--text-muted)' } },
            tooltip: {
                callbacks: {
                    label: (ctx) => {
                        const row = cohorts[ctx.dataIndex];
                        const pct = ctx.dataset.label.includes('ตกออก')
                            ? row.dropoutRate : row.retentionRate;
                        return `${ctx.dataset.label}: ${ctx.parsed.y} คน (${pct}%)`;
                    }
                }
            }
        },
        scales: {
            x: { stacked: true, ticks: { color: 'var(--text-muted)' }, grid: { display: false } },
            y: { stacked: true, beginAtZero: true, ticks: { color: 'var(--text-muted)' }, grid: { color: 'var(--border-color)' } }
        }
    };

    // Retention-rate line (trend of % retained by intake)
    const retentionLineData = {
        labels: cohorts.map(c => `รหัส ${String(c.intake).slice(-2)}`),
        datasets: [{
            label: 'Retention Rate (%)',
            data: cohorts.map(c => c.retentionRate),
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.15)',
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointBackgroundColor: '#22c55e',
        }]
    };
    const retentionLineOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { ticks: { color: 'var(--text-muted)' }, grid: { display: false } },
            y: {
                min: 70, max: 100,
                ticks: { color: 'var(--text-muted)', callback: v => v + '%' },
                grid: { color: 'var(--border-color)' }
            }
        }
    };

    // Use university-wide intake data as a faculty benchmark
    const newIntake = studentStatsData.scienceFaculty?.newStudentIntake || [];

    return (
        <div>
            <Link to="/dashboard" className="back-button">
                <ArrowLeft size={16} /> กลับหน้าหลัก
            </Link>

            <div className="section-header">
                <div className="section-header-icon" style={{ background: 'linear-gradient(135deg, #ef4444, #f97316)' }}>
                    <TrendingDown size={22} color="#fff" />
                </div>
                <div>
                    <h2>การคงอยู่ของนักศึกษา (Retention / Dropout)</h2>
                    <p>Cohort Analysis — อัตราคงอยู่และตกออกแยกรุ่น/สาขา</p>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                    <ExportPDFButton title="Retention / Dropout Analysis" />
                </div>
            </div>

            {/* Data-quality note */}
            {totals.dropout === 0 && (
                <div className="chart-card" style={{
                    marginTop: 12, padding: 14,
                    borderLeft: '3px solid #3b82f6',
                    background: 'rgba(59,130,246,0.06)',
                    display: 'flex', gap: 10, alignItems: 'flex-start'
                }}>
                    <Info size={18} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ fontSize: '0.9rem' }}>
                        <strong>หมายเหตุข้อมูล:</strong> ข้อมูลปัจจุบันมีเฉพาะสถานะ "กำลังศึกษา" ยังไม่มี "พ้นสภาพ/ตกออก"
                        หน้านี้จะแสดงการตกออก <strong>0 คน</strong> และคงอยู่ 100% เมื่อผู้ดูแลระบบอัปโหลดข้อมูลที่มีสถานะอื่น
                        ระบบจะคำนวณอัตโนมัติโดยไม่ต้องแก้โค้ด
                    </div>
                </div>
            )}

            {/* Summary */}
            <div className="stats-grid" style={{ marginTop: 16 }}>
                <div className="stat-card animate-in">
                    <div className="stat-card-header">
                        <div className="stat-card-icon" style={{ background: 'linear-gradient(135deg, #7B68EE, #5B4FCF)' }}>
                            <Users size={20} color="#fff" />
                        </div>
                    </div>
                    <div className="stat-card-value">{totals.total.toLocaleString('th-TH')}</div>
                    <div className="stat-card-label">นักศึกษาในระบบ</div>
                </div>
                <div className="stat-card animate-in">
                    <div className="stat-card-header">
                        <div className="stat-card-icon" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                            <CheckCircle size={20} color="#fff" />
                        </div>
                    </div>
                    <div className="stat-card-value" style={{ color: '#22c55e' }}>{totals.retentionRate}%</div>
                    <div className="stat-card-label">Retention Rate (คงอยู่ {totals.active.toLocaleString('th-TH')} คน)</div>
                </div>
                <div className="stat-card animate-in">
                    <div className="stat-card-header">
                        <div className="stat-card-icon" style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)' }}>
                            <AlertTriangle size={20} color="#fff" />
                        </div>
                    </div>
                    <div className="stat-card-value" style={{ color: '#ef4444' }}>{totals.dropoutRate}%</div>
                    <div className="stat-card-label">Dropout Rate ({totals.dropout.toLocaleString('th-TH')} คน)</div>
                </div>
                <div className="stat-card animate-in">
                    <div className="stat-card-header">
                        <div className="stat-card-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
                            <TrendingDown size={20} color="#fff" />
                        </div>
                    </div>
                    <div className="stat-card-value">{cohorts.length}</div>
                    <div className="stat-card-label">จำนวนรุ่น (Cohorts)</div>
                </div>
            </div>

            {/* Filter */}
            <div className="filter-bar" style={{ marginTop: 20 }}>
                <label><Filter size={14} style={{ marginRight: 6, verticalAlign: -2 }} />สาขาวิชา:</label>
                <select value={majorFilter} onChange={e => setMajorFilter(e.target.value)}>
                    {majors.map(m => <option key={m} value={m}>{m === 'all' ? 'ทุกสาขา' : m}</option>)}
                </select>
            </div>

            {/* Charts */}
            <div className="charts-grid" style={{ marginTop: 20 }}>
                <div className="chart-card animate-in">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">Cohort Breakdown</div>
                            <div className="chart-card-subtitle">
                                แยกตามรหัสรุ่น · {majorFilter === 'all' ? 'ทุกสาขา' : majorFilter}
                            </div>
                        </div>
                    </div>
                    <div className="chart-container" style={{ height: 320 }}>
                        <Bar data={cohortBarData} options={cohortBarOptions} />
                    </div>
                </div>

                <div className="chart-card animate-in">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">Retention Rate Trend</div>
                            <div className="chart-card-subtitle">อัตราคงอยู่ (%) แต่ละรุ่น</div>
                        </div>
                    </div>
                    <div className="chart-container" style={{ height: 320 }}>
                        <Line data={retentionLineData} options={retentionLineOptions} />
                    </div>
                </div>
            </div>

            {/* Per-major table */}
            <div className="data-table-container animate-in" style={{ marginTop: 24 }}>
                <div className="data-table-header">
                    <span className="data-table-title">การคงอยู่แยกตามสาขาวิชา</span>
                </div>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>สาขาวิชา</th>
                            <th>ทั้งหมด</th>
                            <th>คงอยู่</th>
                            <th>ตกออก</th>
                            <th>Retention %</th>
                            <th>สถานะ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {byMajor.map((m, i) => {
                            const flag = m.retentionRate < 85 ? { color: '#ef4444', label: 'เสี่ยง' }
                                : m.retentionRate < 92 ? { color: '#f59e0b', label: 'เฝ้าระวัง' }
                                : { color: '#22c55e', label: 'ปกติ' };
                            return (
                                <tr key={i}>
                                    <td style={{ fontWeight: 600 }}>{m.major}</td>
                                    <td>{m.total}</td>
                                    <td style={{ color: '#22c55e' }}>{m.active}</td>
                                    <td style={{ color: '#ef4444' }}>{m.dropout}</td>
                                    <td style={{ fontWeight: 700, color: flag.color }}>{m.retentionRate}%</td>
                                    <td>
                                        <span style={{
                                            padding: '3px 10px', borderRadius: 999,
                                            background: `${flag.color}22`, color: flag.color,
                                            fontSize: '0.75rem', fontWeight: 700
                                        }}>{flag.label}</span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Intake vs current (benchmark) */}
            {newIntake.length > 0 && (
                <div className="data-table-container animate-in" style={{ marginTop: 24 }}>
                    <div className="data-table-header">
                        <span className="data-table-title">ขนาดรุ่นแรกเข้า (MJU) เทียบกับข้อมูลปัจจุบัน</span>
                    </div>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>ปีรับเข้า</th>
                                <th>แรกเข้า (MJU)</th>
                                <th>ในระบบตอนนี้</th>
                                <th>Δ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {newIntake.map((row, i) => {
                                const c = cohorts.find(x => String(x.intake) === row.year);
                                const now = c ? c.total : 0;
                                const delta = now - row.total;
                                return (
                                    <tr key={i}>
                                        <td>รหัส {row.year.slice(-2)} ({row.year})</td>
                                        <td>{row.total.toLocaleString('th-TH')}</td>
                                        <td>{now.toLocaleString('th-TH')}</td>
                                        <td style={{ color: delta < 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: 600 }}>
                                            {delta > 0 ? '+' : ''}{delta.toLocaleString('th-TH')}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <p style={{ padding: '8px 16px', fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                        <Info size={12} style={{ verticalAlign: -2 }} /> ตัวเลขแรกเข้าอ้างอิง MJU Dashboard — ตัวเลขปัจจุบันมาจากข้อมูลที่อัปโหลดในระบบ
                    </p>
                </div>
            )}
        </div>
    );
}
