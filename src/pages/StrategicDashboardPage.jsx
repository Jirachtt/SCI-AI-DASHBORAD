import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import AccessDenied from '../components/AccessDenied';
import { Bar, Line } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement,
    Title, Tooltip, Legend, PointElement, LineElement, Filler,
    RadialLinearScale
} from 'chart.js';
import { themeAdaptorPlugin } from '../utils/chartTheme';
import { Target, TrendingUp, CheckCircle2, AlertTriangle } from 'lucide-react';
import ExportPDFButton from '../components/ExportPDFButton';
import ChartDrilldownModal from '../components/ChartDrilldownModal';
import { withChartDrilldown } from '../utils/chartDrilldown';
import useDashboardDataset from '../hooks/useDashboardDataset';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, Filler, RadialLinearScale, themeAdaptorPlugin);

const cardStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px', padding: '24px',
};

function ProgressBar({ value, target, color }) {
    const pct = Math.min((value / target) * 100, 100);
    return (
        <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'var(--bg-secondary)' }}>
            <div style={{
                width: `${pct}%`, height: '100%', borderRadius: 4,
                background: `linear-gradient(90deg, ${color}, ${color}aa)`,
                transition: 'width 0.8s ease'
            }} />
        </div>
    );
}

export default function StrategicDashboardPage() {
    const { user } = useAuth();
    const [activeOKR, setActiveOKR] = useState(0);
    const [drillDetail, setDrillDetail] = useState(null);
    const { data: strategicData } = useDashboardDataset('strategic');

    if (!canAccess(user?.role, 'strategic_overview')) return <AccessDenied />;

    const { strategicGoals, okr, performanceRadar, efficiencyTrend } = strategicData;
    const kpiReviewRows = Array.isArray(strategicData.kpiReviewRows) ? strategicData.kpiReviewRows : [];
    const kpiReviewSummary = strategicData.kpiReviewSummary || {
        totalKpis: kpiReviewRows.length,
        met: kpiReviewRows.filter(row => row.status === 'met').length,
        near: kpiReviewRows.filter(row => row.status === 'near').length,
        below: kpiReviewRows.filter(row => row.status === 'below').length,
    };
    const developmentPlanRows = Array.isArray(strategicData.developmentPlanRows) ? strategicData.developmentPlanRows : [];
    const priorityKpis = kpiReviewRows
        .filter(row => row.status === 'below' || row.status === 'near')
        .sort((a, b) => (a.progress ?? 999) - (b.progress ?? 999))
        .slice(0, 8);
    const unknownKpiCount = kpiReviewRows.filter(row => row.status === 'unknown').length;
    const sourceFiles = Array.isArray(strategicData.sourceFiles) ? strategicData.sourceFiles : [];
    const activeStrategyIssues = [...new Set(developmentPlanRows
        .map(row => row.strategyIssue)
        .filter(Boolean))];
    const planTargets = developmentPlanRows.reduce((acc, row) => {
        ['target2569', 'target2570', 'target2571', 'target2572'].forEach(key => {
            const value = Number(row[key]);
            if (Number.isFinite(value)) acc[key] += value;
        });
        return acc;
    }, { target2569: 0, target2570: 0, target2571: 0, target2572: 0 });
    const fullKpiRows = [...kpiReviewRows].sort((a, b) => {
        const statusRank = { below: 0, near: 1, unknown: 2, met: 3 };
        return (statusRank[a.status] ?? 4) - (statusRank[b.status] ?? 4);
    });
    const formatKpiValue = (value) => {
        if (value == null || value === '') return '-';
        if (typeof value === 'number') return Number.isInteger(value) ? value.toLocaleString('th-TH') : value.toLocaleString('th-TH', { maximumFractionDigits: 2 });
        return String(value);
    };
    const statusStyle = (status) => {
        if (status === 'met') return { label: 'ถึงเป้า', color: '#059669', bg: '#dcfce7' };
        if (status === 'near') return { label: 'ใกล้เป้า', color: '#b45309', bg: '#fef3c7' };
        if (status === 'below') return { label: 'ต้องเร่ง', color: '#dc2626', bg: '#fee2e2' };
        return { label: 'รอข้อมูล', color: 'var(--text-muted)', bg: 'var(--bg-secondary)' };
    };

    // Horizontal grouped bar chart (executive-friendly)
    const perfBarData = {
        labels: performanceRadar.categories,
        datasets: [
            {
                label: 'เป้าหมาย',
                data: performanceRadar.targetYear,
                backgroundColor: 'rgba(245, 158, 11, 0.7)',
                borderColor: '#f59e0b',
                borderWidth: 1,
                borderRadius: 4,
                barPercentage: 0.7,
                categoryPercentage: 0.8,
            },
            {
                label: 'ปีปัจจุบัน',
                data: performanceRadar.currentYear,
                backgroundColor: 'rgba(34, 197, 94, 0.7)',
                borderColor: '#22c55e',
                borderWidth: 1,
                borderRadius: 4,
                barPercentage: 0.7,
                categoryPercentage: 0.8,
            },
            {
                label: 'ปีที่แล้ว',
                data: performanceRadar.lastYear,
                backgroundColor: 'rgba(123, 104, 238, 0.7)',
                borderColor: '#7B68EE',
                borderWidth: 1,
                borderRadius: 4,
                barPercentage: 0.7,
                categoryPercentage: 0.8,
            },
        ]
    };

    const perfBarOptions = {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        scales: {
            x: {
                min: 0, max: 100,
                ticks: { color: 'var(--text-muted)', font: { size: 11 }, callback: v => v + '%' },
                grid: { color: 'var(--border-color)' },
                title: { display: true, text: 'คะแนน (%)', color: 'var(--text-muted)', font: { size: 11 } }
            },
            y: {
                ticks: {
                    color: 'var(--text-primary)',
                    font: { size: 13, weight: 'bold', family: "'Noto Sans Thai', system-ui, sans-serif" },
                },
                grid: { display: false },
            }
        },
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: 'var(--text-primary)',
                    font: { size: 12, weight: '600', family: "'Noto Sans Thai', system-ui, sans-serif" },
                    padding: 20,
                    usePointStyle: true,
                    pointStyleWidth: 12,
                }
            },
            tooltip: {
                backgroundColor: 'var(--bg-card)',
                titleColor: 'var(--text-primary)',
                bodyColor: 'var(--text-secondary)',
                titleFont: { size: 13, weight: 'bold' },
                bodyFont: { size: 12 },
                padding: 12,
                borderColor: 'var(--border-color)',
                borderWidth: 1,
                displayColors: true,
                callbacks: {
                    label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.x}%`,
                }
            }
        }
    };

    // Efficiency trend
    const effData = {
        labels: efficiencyTrend.map(e => e.year),
        datasets: [
            {
                label: 'คะแนนประสิทธิภาพรวม', data: efficiencyTrend.map(e => e.score),
                borderColor: '#22c55e', backgroundColor: 'rgba(34, 197, 94, 0.12)', fill: true, tension: 0.4,
            },
            {
                label: 'ประสิทธิภาพงบประมาณ (%)', data: efficiencyTrend.map(e => e.budgetEfficiency),
                borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.12)', fill: true, tension: 0.4,
            }
        ]
    };

    const chartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { color: 'var(--text-secondary)', font: { size: 11 } } },
            tooltip: { backgroundColor: 'var(--bg-card)', titleColor: 'var(--text-primary)', bodyColor: 'var(--text-secondary)' }
        },
        scales: {
            x: { ticks: { color: 'var(--text-muted)' }, grid: { color: 'var(--border-color)' } },
            y: { ticks: { color: 'var(--text-muted)' }, grid: { color: 'var(--border-color)' } }
        }
    };

    const performanceColumns = [
        { key: 'category', label: 'ด้านยุทธศาสตร์' },
        { key: 'lastYear', label: 'ปีที่แล้ว', align: 'right' },
        { key: 'currentYear', label: 'ปีปัจจุบัน', align: 'right' },
        { key: 'targetYear', label: 'เป้าหมาย', align: 'right' },
        { key: 'gap', label: 'ช่องว่างถึงเป้าหมาย', align: 'right' },
    ];

    const efficiencyColumns = [
        { key: 'year', label: 'ปี' },
        { key: 'score', label: 'คะแนนรวม', align: 'right' },
        { key: 'budgetEfficiency', label: 'ประสิทธิภาพงบประมาณ', align: 'right' },
        { key: 'satisfactionScore', label: 'ความพึงพอใจ', align: 'right' },
        { key: 'type', label: 'สถานะ' },
    ];

    const perfDrilldownOptions = withChartDrilldown(perfBarOptions, perfBarData, setDrillDetail, (point) => {
        const category = performanceRadar.categories[point.index];
        if (!category) return null;
        return {
            title: `ประสิทธิภาพด้าน${category}`,
            subtitle: point.datasetLabel,
            valueLabel: point.datasetLabel,
            value: point.value,
            unit: '%',
            accentColor: point.color,
            rows: [{
                category,
                lastYear: `${performanceRadar.lastYear[point.index]}%`,
                currentYear: `${performanceRadar.currentYear[point.index]}%`,
                targetYear: `${performanceRadar.targetYear[point.index]}%`,
                gap: `${Math.max(performanceRadar.targetYear[point.index] - performanceRadar.currentYear[point.index], 0).toFixed(1)}%`,
            }],
            columns: performanceColumns,
            note: 'ข้อมูลนี้ใช้สำหรับดูช่องว่างระหว่างผลปัจจุบันกับเป้าหมายยุทธศาสตร์',
        };
    });

    const efficiencyDrilldownOptions = withChartDrilldown(chartOptions, effData, setDrillDetail, (point) => {
        const row = efficiencyTrend[point.index];
        if (!row) return null;
        return {
            title: `แนวโน้มประสิทธิภาพรวมปี ${row.year}`,
            subtitle: point.datasetLabel,
            valueLabel: point.datasetLabel,
            value: point.value,
            unit: point.datasetIndex === 1 ? '%' : 'คะแนน',
            accentColor: point.color,
            rows: efficiencyTrend.map(item => ({
                year: item.year,
                score: item.score,
                budgetEfficiency: `${item.budgetEfficiency}%`,
                satisfactionScore: item.satisfactionScore,
                type: item.type === 'forecast' ? 'พยากรณ์' : 'ข้อมูลจริง',
            })),
            columns: efficiencyColumns,
            note: row.type === 'forecast' ? 'ปีนี้เป็นค่าพยากรณ์ จึงควรอ่านร่วมกับแนวโน้มย้อนหลัง' : 'ข้อมูลย้อนหลังจากชุดข้อมูลยุทธศาสตร์ในระบบ',
        };
    });

    const selectedObj = okr.objectives[activeOKR];

    return (
        <div style={{ padding: '0 4px' }}>
            <ChartDrilldownModal detail={drillDetail} onClose={() => setDrillDetail(null)} />
            <div className="section-header">
                <div className="section-header-icon" style={{ background: 'linear-gradient(135deg, #A23B72, #7B2D8E)' }}>
                    <Target size={22} color="#fff" />
                </div>
                <div>
                    <h1>ยุทธศาสตร์และการดำเนินงาน</h1>
                    <p>Strategic & OKR Monitoring — คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้</p>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                    <ExportPDFButton title="ยุทธศาสตร์และการดำเนินงาน" />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
                <div style={{ ...cardStyle, padding: '16px 18px', borderLeft: '4px solid #7B68EE' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <CheckCircle2 size={18} color="#00a651" />
                        <strong style={{ color: 'var(--text-primary)' }}>ข้อมูลจากไฟล์จริง</strong>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.45 }}>
                        ใช้ไฟล์ยุทธศาสตร์ {sourceFiles.length || 2} ไฟล์ และผูกกับ AI/export แล้ว
                    </div>
                </div>
                <div style={{ ...cardStyle, padding: '16px 18px', borderLeft: '4px solid #ef4444' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <AlertTriangle size={18} color="#ef4444" />
                        <strong style={{ color: 'var(--text-primary)' }}>KPI คำรับรอง 2569</strong>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.45 }}>
                        ทั้งหมด {kpiReviewSummary.totalKpis} ตัวชี้วัด · ต้องเร่ง {kpiReviewSummary.below} · ใกล้เป้า {kpiReviewSummary.near} · รอข้อมูล {unknownKpiCount}
                    </div>
                </div>
                <div style={{ ...cardStyle, padding: '16px 18px', borderLeft: '4px solid #0ea5e9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <TrendingUp size={18} color="#0ea5e9" />
                        <strong style={{ color: 'var(--text-primary)' }}>แผนพัฒนา 2569-2572</strong>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.45 }}>
                        แผนทั้งหมด {developmentPlanRows.length} รายการ · {activeStrategyIssues.length} ประเด็นยุทธศาสตร์
                    </div>
                </div>
            </div>

            {/* Strategic Goals Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24, alignItems: 'stretch' }}>
                {strategicGoals.map((goal) => {
                    const pct = Math.round((goal.current / goal.target) * 100);
                    return (
                        <div key={goal.id} style={{ ...cardStyle, padding: '18px 20px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <span style={{ fontSize: '1.5rem' }}>{goal.icon}</span>
                                <span style={{
                                    fontSize: '0.78rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                                    background: pct >= 90 ? '#00683822' : pct >= 70 ? '#C5A02822' : '#E91E6322',
                                    color: pct >= 90 ? '#00a651' : pct >= 70 ? '#C5A028' : '#E91E63'
                                }}>{pct}%</span>
                            </div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.3 }}>{goal.title}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.3, flex: 1 }}>{goal.subtitle}</div>
                            <ProgressBar value={goal.current} target={goal.target} color={goal.color} />
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 6 }}>
                                {goal.current} / {goal.target} {goal.unit}
                            </div>
                        </div>
                    );
                })}
            </div>

            {kpiReviewRows.length > 0 && (
                <div style={{ ...cardStyle, marginBottom: 16, padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                        <div>
                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1rem', margin: 0 }}>คำรับรองการปฏิบัติการ 2569</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', margin: '4px 0 0' }}>
                                ใช้ข้อมูลจากไฟล์ทบทวนคำรับรอง 69 และแสดงตัวชี้วัดที่ควรติดตามก่อน
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <span className="status-badge approved">ทั้งหมด {kpiReviewSummary.totalKpis}</span>
                            <span className="status-badge paid">ถึงเป้า {kpiReviewSummary.met}</span>
                            <span className="status-badge pending">ใกล้เป้า {kpiReviewSummary.near}</span>
                            <span className="status-badge rejected">ต้องเร่ง {kpiReviewSummary.below}</span>
                            <span className="status-badge">แผน {developmentPlanRows.length}</span>
                        </div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table" style={{ margin: 0 }}>
                            <thead>
                                <tr>
                                    <th>ตัวชี้วัด</th>
                                    <th>หน่วย</th>
                                    <th style={{ textAlign: 'right' }}>ผล 2568</th>
                                    <th style={{ textAlign: 'right' }}>เป้า 2569</th>
                                    <th style={{ textAlign: 'right' }}>ความคืบหน้า</th>
                                    <th>สถานะ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {priorityKpis.map(row => {
                                    const status = statusStyle(row.status);
                                    return (
                                        <tr key={row.indicator}>
                                            <td style={{ maxWidth: 520, whiteSpace: 'normal', lineHeight: 1.45 }}>
                                                <strong>{row.code}</strong> {row.indicator.replace(row.code, '').trim()}
                                            </td>
                                            <td>{row.unit || '-'}</td>
                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatKpiValue(row.actual2568)}</td>
                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatKpiValue(row.targetReviewed2569)}</td>
                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                                {row.progress == null ? '-' : `${Math.round(row.progress)}%`}
                                            </td>
                                            <td>
                                                <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: '0.8rem', fontWeight: 700, color: status.color, background: status.bg }}>
                                                    {status.label}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {fullKpiRows.length > 0 && (
                <div style={{ ...cardStyle, marginBottom: 16, padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                        <div>
                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1rem', margin: 0 }}>KPI คำรับรอง 2569 ทั้งหมด</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', margin: '4px 0 0' }}>
                                ดึงครบจากไฟล์ทบทวนคำรับรอง 69 แสดงทุกตัวชี้วัด พร้อมผลย้อนหลัง เป้าทบทวน และสถานะความเสี่ยง
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span className="status-badge rejected">ต้องเร่ง {kpiReviewSummary.below}</span>
                            <span className="status-badge pending">ใกล้เป้า {kpiReviewSummary.near}</span>
                            <span className="status-badge paid">ถึงเป้า {kpiReviewSummary.met}</span>
                            <span className="status-badge">รอข้อมูล {unknownKpiCount}</span>
                        </div>
                    </div>
                    <div style={{ overflow: 'auto', maxHeight: 520 }}>
                        <table className="data-table" style={{ margin: 0, minWidth: 1180 }}>
                            <thead>
                                <tr>
                                    <th style={{ minWidth: 360 }}>ตัวชี้วัด</th>
                                    <th style={{ minWidth: 260 }}>ยุทธศาสตร์ / เป้าประสงค์</th>
                                    <th>หน่วย</th>
                                    <th style={{ textAlign: 'right' }}>น้ำหนัก</th>
                                    <th style={{ textAlign: 'right' }}>ผล 2566</th>
                                    <th style={{ textAlign: 'right' }}>ผล 2567</th>
                                    <th style={{ textAlign: 'right' }}>ผล 2568</th>
                                    <th style={{ textAlign: 'right' }}>เป้า 2569</th>
                                    <th style={{ textAlign: 'right' }}>ความคืบหน้า</th>
                                    <th>สถานะ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fullKpiRows.map((row, index) => {
                                    const status = statusStyle(row.status);
                                    return (
                                        <tr key={`${row.code || 'kpi'}-${index}`}>
                                            <td style={{ whiteSpace: 'normal', lineHeight: 1.45 }}>
                                                <strong>{row.code}</strong> {String(row.indicator || '').replace(row.code || '', '').trim()}
                                                {row.note && (
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 4, lineHeight: 1.35 }}>
                                                        {row.note}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ whiteSpace: 'normal', lineHeight: 1.4, color: 'var(--text-secondary)' }}>
                                                <div>{row.strategyIssue || '-'}</div>
                                                {row.goal && <div style={{ marginTop: 4 }}>{row.goal}</div>}
                                            </td>
                                            <td>{row.unit || '-'}</td>
                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatKpiValue(row.weight)}</td>
                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatKpiValue(row.actual2566)}</td>
                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatKpiValue(row.actual2567)}</td>
                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatKpiValue(row.actual2568)}</td>
                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatKpiValue(row.targetReviewed2569)}</td>
                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                                {row.progress == null ? '-' : `${Math.round(row.progress)}%`}
                                            </td>
                                            <td>
                                                <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: '0.8rem', fontWeight: 700, color: status.color, background: status.bg, whiteSpace: 'nowrap' }}>
                                                    {status.label}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {developmentPlanRows.length > 0 && (
                <div style={{ ...cardStyle, marginBottom: 16, padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                        <div>
                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1rem', margin: 0 }}>แผนพัฒนาส่วนงานและแผนกลยุทธ์ 2569-2572</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', margin: '4px 0 0' }}>
                                ดึงครบจากไฟล์แบบเสนอแผนพัฒนาส่วนงาน แสดงเป้าหมายรายปีและกลยุทธ์ของคณะวิทยาศาสตร์
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span className="status-badge">2569: {formatKpiValue(planTargets.target2569)}</span>
                            <span className="status-badge">2570: {formatKpiValue(planTargets.target2570)}</span>
                            <span className="status-badge">2571: {formatKpiValue(planTargets.target2571)}</span>
                            <span className="status-badge">2572: {formatKpiValue(planTargets.target2572)}</span>
                        </div>
                    </div>
                    <div style={{ overflow: 'auto', maxHeight: 520 }}>
                        <table className="data-table" style={{ margin: 0, minWidth: 1120 }}>
                            <thead>
                                <tr>
                                    <th style={{ minWidth: 260 }}>ประเด็นยุทธศาสตร์</th>
                                    <th style={{ minWidth: 280 }}>เป้าประสงค์ / ตัวชี้วัด</th>
                                    <th>หน่วย</th>
                                    <th style={{ textAlign: 'right' }}>ผล 2568</th>
                                    <th style={{ textAlign: 'right' }}>แผน 2569</th>
                                    <th style={{ textAlign: 'right' }}>แผน 2570</th>
                                    <th style={{ textAlign: 'right' }}>แผน 2571</th>
                                    <th style={{ textAlign: 'right' }}>แผน 2572</th>
                                    <th style={{ minWidth: 280 }}>กลยุทธ์</th>
                                </tr>
                            </thead>
                            <tbody>
                                {developmentPlanRows.map((row, index) => (
                                    <tr key={`${row.indicator || 'plan'}-${index}`}>
                                        <td style={{ whiteSpace: 'normal', lineHeight: 1.4 }}>{row.strategyIssue || '-'}</td>
                                        <td style={{ whiteSpace: 'normal', lineHeight: 1.45 }}>
                                            {row.goal && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 4 }}>{row.goal}</div>}
                                            <strong>{row.indicator || '-'}</strong>
                                        </td>
                                        <td>{row.unit || '-'}</td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatKpiValue(row.result2568)}</td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatKpiValue(row.target2569)}</td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatKpiValue(row.target2570)}</td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatKpiValue(row.target2571)}</td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatKpiValue(row.target2572)}</td>
                                        <td style={{ whiteSpace: 'normal', lineHeight: 1.4 }}>{row.strategy || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Row 2: Radar + KPI Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div style={cardStyle}>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: 16 }}>📊 ประสิทธิภาพ 5 ด้าน — เปรียบเทียบเป้าหมาย</h3>
                    <div style={{ height: 320 }}>
                        <Bar data={perfBarData} options={perfDrilldownOptions} />
                    </div>
                </div>
                <div style={cardStyle}>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: 16 }}>KPI แต่ละเป้าหมาย</h3>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                        {strategicGoals.map((g, i) => (
                            <span key={i} style={{ fontSize: '0.82rem' }}>{g.icon} {g.id}</span>
                        ))}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 280, overflowY: 'auto' }}>
                        {strategicGoals.map(goal => (
                            goal.kpis.map((kpi, ki) => {
                                const pct = Math.round((kpi.current / kpi.target) * 100);
                                return (
                                    <div key={`${goal.id}-${ki}`} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 14px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500 }}>{goal.icon} {kpi.name}</span>
                                            <span style={{
                                                fontSize: '0.82rem', fontWeight: 700,
                                                color: pct >= 90 ? '#00a651' : pct >= 70 ? '#C5A028' : '#E91E63'
                                            }}>{kpi.current}/{kpi.target} {kpi.unit}</span>
                                        </div>
                                        <div style={{ marginTop: 6 }}>
                                            <ProgressBar value={kpi.current} target={kpi.target} color={goal.color} />
                                        </div>
                                    </div>
                                );
                            })
                        ))}
                    </div>
                </div>
            </div>

            {/* Row 3: OKR Section */}
            <div style={{ ...cardStyle, marginBottom: 16 }}>
                <h3 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: 16 }}>OKR Monitoring — {okr.period}</h3>

                {/* OKR tabs */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                    {okr.objectives.map((obj, i) => (
                        <button key={i}
                            onClick={() => setActiveOKR(i)}
                            style={{
                                padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                                fontSize: '0.88rem', fontWeight: 600, transition: 'all 0.2s',
                                background: activeOKR === i ? `${obj.color}33` : 'var(--bg-secondary)',
                                color: activeOKR === i ? obj.color : 'var(--text-muted)',
                                outline: activeOKR === i ? `2px solid ${obj.color}66` : 'none',
                            }}
                        >
                            {obj.id}: {obj.title.substring(0, 20)}...
                        </button>
                    ))}
                </div>

                {/* Selected OKR details */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                    <div style={{
                        width: 60, height: 60, borderRadius: 15,
                        background: `conic-gradient(${selectedObj.color} ${selectedObj.progress * 3.6}deg, var(--bg-secondary) 0deg)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: 12, background: 'var(--bg-card)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.85rem', fontWeight: 700, color: selectedObj.color,
                        }}>{selectedObj.progress}%</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedObj.title}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>ความคืบหน้ารวม: {selectedObj.progress}%</div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                    {selectedObj.keyResults.map((kr, i) => (
                        <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '14px 18px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{kr.id}</span>
                                <span style={{ fontSize: '0.85rem', color: selectedObj.color, fontWeight: 700 }}>{kr.progress}%</span>
                            </div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: 8 }}>{kr.title}</div>
                            <ProgressBar value={kr.current} target={kr.target} color={selectedObj.color} />
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 6 }}>
                                ปัจจุบัน: {kr.current} / เป้าหมาย: {kr.target} {kr.unit}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Row 4: Efficiency Trend */}
            <div style={cardStyle}>
                <h3 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: 16 }}>แนวโน้มประสิทธิภาพรวม</h3>
                <div style={{ height: 260 }}>
                    <Line data={effData} options={efficiencyDrilldownOptions} />
                </div>
            </div>
        </div>
    );
}
