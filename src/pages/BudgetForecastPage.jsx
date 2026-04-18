import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import AccessDenied from '../components/AccessDenied';
import { scienceFacultyBudgetData } from '../data/mockData';
import { ArrowLeft, TrendingUp, TrendingDown, ArrowUpRight, Sparkles, Download, BarChart3, Wallet, DollarSign } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement,
    Title, Tooltip, Legend, Filler
} from 'chart.js';
import { themeAdaptorPlugin } from '../utils/chartTheme';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, Filler, themeAdaptorPlugin);

/* ────────────── Shared Styles (matching Student List theme) ────────────── */
const card = {
    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
    borderRadius: '16px', padding: '24px',
};
const thStyle = {
    padding: '12px 16px', textAlign: 'left', fontSize: '0.82rem', fontWeight: 700,
    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em',
};

export default function BudgetForecastPage() {
    const { user } = useAuth();

    if (!canAccess(user?.role, 'budget_forecast')) return <AccessDenied />;

    const { yearly, summary } = scienceFacultyBudgetData;
    const latestActual = yearly.filter(y => y.type === 'actual');
    const latestYear = latestActual[latestActual.length - 1];
    const prevYear = latestActual[latestActual.length - 2];

    const revenueGrowth = (((latestYear.revenue - prevYear.revenue) / prevYear.revenue) * 100).toFixed(1);
    const expenseGrowth = (((latestYear.expense - prevYear.expense) / prevYear.expense) * 100).toFixed(1);
    const usagePercent = ((latestYear.expense / latestYear.revenue) * 100).toFixed(1);

    /* ── Export CSV ── */
    const exportCSV = () => {
        const BOM = '\uFEFF';
        const lines = [
            'รายงานงบประมาณคณะวิทยาศาสตร์ — มหาวิทยาลัยแม่โจ้',
            `วันที่ส่งออก: ${new Date().toLocaleDateString('th-TH')}`,
            '',
            '=== สรุปงบประมาณรายปี (ล้านบาท) ===',
            'ปีงบประมาณ,รายรับ,รายจ่าย,คงเหลือ,% การใช้จ่าย,ประเภท',
            ...yearly.map(y => {
                const pct = ((y.expense / y.revenue) * 100).toFixed(1);
                return `${y.year},${y.revenue.toFixed(2)},${y.expense.toFixed(2)},${y.surplus.toFixed(2)},${pct}%,${y.type === 'actual' ? 'ข้อมูลจริง' : 'พยากรณ์'}`;
            }),
            '',
            `=== โครงสร้างรายรับปี ${latestYear.year} ===`,
            'แหล่งรายรับ,จำนวน (ล้านบาท),สัดส่วน',
            ...latestYear.revenueBreakdown.map(r =>
                `${r.name},${r.amount.toFixed(2)},${((r.amount / latestYear.revenue) * 100).toFixed(1)}%`
            ),
            '',
            `=== โครงสร้างรายจ่ายปี ${latestYear.year} ===`,
            'หมวดรายจ่าย,จำนวน (ล้านบาท),สัดส่วน',
            ...latestYear.expenseBreakdown.map(e =>
                `${e.name},${e.amount.toFixed(2)},${((e.amount / latestYear.expense) * 100).toFixed(1)}%`
            ),
            '',
            `หมายเหตุ: ${summary.forecastNote}`,
            `อัตราเติบโตรายรับเฉลี่ย: ${summary.avgGrowthRevenue}%/ปี`,
            `อัตราเติบโตรายจ่ายเฉลี่ย: ${summary.avgGrowthExpense}%/ปี`,
        ];
        const csv = BOM + lines.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `budget_report_science_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    /* ── Chart ── */
    const combinedChartData = {
        labels: yearly.map(y => y.year + (y.type === 'forecast' ? ' *' : '')),
        datasets: [
            {
                type: 'bar',
                label: 'ใช้จ่ายจริง',
                data: yearly.map(y => y.expense),
                backgroundColor: yearly.map(y => y.type === 'actual' ? 'rgba(162, 59, 114, 0.9)' : 'rgba(162, 59, 114, 0.5)'),
                borderColor: '#A23B72',
                borderWidth: 1.5, borderRadius: 6, order: 2,
            },
            {
                type: 'bar',
                label: 'ได้รับจัดสรร',
                data: yearly.map(y => y.revenue),
                backgroundColor: yearly.map(y => y.type === 'actual' ? 'rgba(46, 134, 171, 0.9)' : 'rgba(46, 134, 171, 0.5)'),
                borderColor: '#2E86AB',
                borderWidth: 1.5, borderRadius: 6, order: 2,
            },
            {
                type: 'line',
                label: 'คงเหลือ',
                data: yearly.map(y => y.surplus),
                borderColor: '#C5A028',
                backgroundColor: 'rgba(197, 160, 40, 0.12)',
                borderWidth: 2.5,
                fill: true, tension: 0.4,
                pointBackgroundColor: yearly.map(y => y.type === 'actual' ? '#C5A028' : '#e0c85a'),
                pointBorderColor: 'var(--bg-card)',
                pointBorderWidth: 2,
                pointRadius: 6, pointHoverRadius: 8,
                pointStyle: yearly.map(y => y.type === 'forecast' ? 'triangle' : 'circle'),
                yAxisID: 'y1', order: 1,
            }
        ]
    };

    const chartOptions = {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: 'var(--text-secondary)', padding: 18, usePointStyle: true, pointStyleWidth: 12,
                    font: { size: 13, weight: '600', family: "'Prompt', 'Noto Sans Thai', 'Inter', sans-serif" }
                }
            },
            tooltip: {
                backgroundColor: 'var(--bg-card)', titleColor: 'var(--text-primary)', bodyColor: 'var(--text-secondary)',
                borderColor: 'var(--border-color)', borderWidth: 1,
                padding: 12, titleFont: { size: 13, weight: 'bold' }, bodyFont: { size: 12 }, displayColors: true,
                callbacks: {
                    label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString() || '-'} ล้านบาท`,
                    afterBody: (items) => {
                        const idx = items[0]?.dataIndex;
                        return idx !== undefined && yearly[idx]?.type === 'forecast' ? '\n* ข้อมูลพยากรณ์' : '';
                    }
                }
            }
        },
        scales: {
            x: { ticks: { color: 'var(--text-muted)', font: { size: 12, weight: '500' } }, grid: { display: false } },
            y: {
                position: 'left',
                ticks: { color: 'var(--text-muted)', font: { size: 12 }, callback: (v) => (v >= 1e6 ? (v / 1e6).toFixed(0) + 'M' : v.toLocaleString()) },
                grid: { color: 'var(--border-color)' },
                title: { display: true, text: 'ล้านบาท', color: 'var(--text-muted)', font: { size: 12, weight: '600' } }
            },
            y1: {
                position: 'right',
                ticks: { color: 'var(--text-muted)', font: { size: 12 }, callback: (v) => v.toLocaleString() },
                grid: { display: false },
                title: { display: true, text: 'คงเหลือ', color: '#C5A028', font: { size: 12, weight: '600' } }
            }
        }
    };

    /* ── Summary Cards Data ── */
    const statCards = [
        {
            Icon: Wallet, label: `งบประมาณปี ${latestYear.year}`,
            value: `฿${(latestYear.revenue).toLocaleString()}`, sub: `↗ ${revenueGrowth > 0 ? '+' : ''}${revenueGrowth}% จากปีก่อน`,
            gradient: 'linear-gradient(135deg, #2E86AB, #1a6a8c)',
            valueColor: 'var(--text-primary)',
        },
        {
            Icon: TrendingDown, label: 'ใช้จ่ายจริง (ถึงปัจจุบัน)',
            value: `฿${latestYear.expense.toLocaleString()}`, sub: `${usagePercent}% ของงบประมาณ`,
            gradient: 'linear-gradient(135deg, #E91E63, #c2185b)',
            valueColor: 'var(--text-primary)',
        },
        {
            Icon: DollarSign, label: 'คงเหลือ',
            value: `฿${latestYear.surplus.toLocaleString()}`, sub: 'เพียงพอสำหรับไตรมาสที่เหลือ',
            gradient: 'linear-gradient(135deg, #006838, #004d29)',
            valueColor: '#4CAF50',
        },
        {
            Icon: TrendingUp, label: `พยากรณ์รายรับ ${yearly[yearly.length - 1].year}`,
            value: `฿${yearly[yearly.length - 1].revenue.toLocaleString()}`,
            sub: 'คาดการณ์ Linear Regression',
            gradient: 'linear-gradient(135deg, #C5A028, #9a7d1e)',
            valueColor: '#C5A028',
        },
    ];

    const statusColor = (type) => type === 'actual' ? '#4CAF50' : '#C5A028';

    return (
        <div className="dashboard-content">
            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <BarChart3 size={24} /> งบประมาณคณะวิทยาศาสตร์
                    </h1>
                    <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: '0.95rem' }}>
                        ข้อมูลจริง ปีงบประมาณ 2560 – ปัจจุบัน + พยากรณ์ • Faculty of Science Budget
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={exportCSV} style={{
                        display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px',
                        borderRadius: '10px', border: 'none',
                        background: 'linear-gradient(135deg, #006838, #00a651)',
                        color: '#fff', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600,
                        transition: 'all 0.2s',
                    }}>
                        <Download size={16} /> Export Report
                    </button>
                </div>
            </div>

            {/* ── Stat Cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                {statCards.map((sc, i) => (
                    <div key={i} style={{ ...card, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: sc.gradient, borderRadius: '0 16px 0 60px', opacity: 0.6 }} />
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                            <sc.Icon size={16} /> {sc.label}
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: sc.valueColor, marginBottom: '4px', position: 'relative' }}>
                            {sc.value}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', position: 'relative' }}>{sc.sub}</div>
                    </div>
                ))}
            </div>

            {/* ── Main Chart ── */}
            <div style={{ ...card, marginBottom: '24px', padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                        แนวโน้มงบประมาณและการใช้จ่าย (2560 – ปัจจุบัน)
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '4px 0 0' }}>
                        ย้อนหลัง + พยากรณ์ 2 ปี (* = พยากรณ์ด้วย Linear Regression)
                    </p>
                </div>
                <div style={{ height: 380, padding: '14px 18px 18px' }}>
                    <Bar data={combinedChartData} options={chartOptions} />
                </div>
            </div>

            {/* ── Yearly Detail Table ── */}
            <div style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: '24px' }}>
                <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>รายละเอียดงบประมาณรายปี</h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={thStyle}>ปีงบประมาณ</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>ได้รับจัดสรร (บาท)</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>ใช้จ่ายจริง (บาท)</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>คงเหลือ (บาท)</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>% การใช้จ่าย</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>สถานะ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {yearly.map((y, idx) => {
                                const pct = ((y.expense / y.revenue) * 100).toFixed(1);
                                return (
                                    <tr key={idx} style={{
                                        borderBottom: '1px solid var(--border-color)',
                                        background: idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)',
                                    }}>
                                        <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.95rem' }}>{y.year}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#2E86AB', fontWeight: 600, fontSize: '0.95rem' }}>
                                            ฿{(y.revenue * 1_000_000).toLocaleString()}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#E91E63', fontWeight: 600, fontSize: '0.95rem' }}>
                                            ฿{(y.expense * 1_000_000).toLocaleString()}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#4CAF50', fontWeight: 700, fontSize: '0.95rem' }}>
                                            ฿{(y.surplus * 1_000_000).toLocaleString()}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                                                <div style={{
                                                    width: 70, height: 8, borderRadius: 4,
                                                    background: 'var(--border-color)', overflow: 'hidden',
                                                }}>
                                                    <div style={{
                                                        width: `${Math.min(100, pct)}%`, height: '100%', borderRadius: 4,
                                                        background: pct > 80 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#4CAF50',
                                                    }} />
                                                </div>
                                                <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{pct}%</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '4px 12px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 600,
                                                color: statusColor(y.type),
                                                background: statusColor(y.type) + '22',
                                                border: `1px solid ${statusColor(y.type)}55`,
                                            }}>
                                                {y.type === 'actual' ? 'ข้อมูลจริง' : '* พยากรณ์'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Revenue & Expense Breakdown (Side by Side) ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                {/* Revenue */}
                <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>โครงสร้างรายรับ ปี {latestYear.year}</h3>
                    </div>
                    <div style={{ padding: '14px 0' }}>
                        {latestYear.revenueBreakdown.map((item, i) => {
                            const pct = ((item.amount / latestYear.revenue) * 100).toFixed(1);
                            const colors = ['#006838', '#2E86AB', '#C5A028', '#A23B72'];
                            return (
                                <div key={i} style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                                    <div style={{ width: 5, height: 40, borderRadius: 2, background: colors[i % colors.length], flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                            <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{item.name}</span>
                                            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#4CAF50' }}>{item.amount.toFixed(1)} ล้าน</span>
                                        </div>
                                        <div style={{ height: 8, borderRadius: 4, background: 'var(--border-color)', overflow: 'hidden' }}>
                                            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: colors[i % colors.length], transition: 'width 0.6s ease' }} />
                                        </div>
                                        <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>{pct}%</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Expense */}
                <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>โครงสร้างรายจ่าย ปี {latestYear.year}</h3>
                    </div>
                    <div style={{ padding: '14px 0' }}>
                        {latestYear.expenseBreakdown.map((item, i) => {
                            const pct = ((item.amount / latestYear.expense) * 100).toFixed(1);
                            const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#a855f7'];
                            return (
                                <div key={i} style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                                    <div style={{ width: 5, height: 40, borderRadius: 2, background: colors[i % colors.length], flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                            <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{item.name}</span>
                                            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#E91E63' }}>{item.amount.toFixed(1)} ล้าน</span>
                                        </div>
                                        <div style={{ height: 8, borderRadius: 4, background: 'var(--border-color)', overflow: 'hidden' }}>
                                            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: colors[i % colors.length], transition: 'width 0.6s ease' }} />
                                        </div>
                                        <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>{pct}%</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Forecast Note ── */}
            <div style={{
                ...card, display: 'flex', alignItems: 'flex-start', gap: '14px',
                borderColor: 'rgba(197, 160, 40, 0.4)', background: 'rgba(197, 160, 40, 0.1)',
            }}>
                <Sparkles size={18} style={{ color: '#C5A028', flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                    <strong style={{ color: '#C5A028' }}>หมายเหตุ:</strong> {summary.forecastNote}
                    <br />
                    อัตราเติบโตรายรับเฉลี่ย <strong style={{ color: '#2E86AB' }}>{summary.avgGrowthRevenue}%</strong>/ปี
                    {' • '}
                    อัตราเติบโตรายจ่ายเฉลี่ย <strong style={{ color: '#E91E63' }}>{summary.avgGrowthExpense}%</strong>/ปี
                </div>
            </div>
        </div>
    );
}
