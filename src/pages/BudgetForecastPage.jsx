import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import AccessDenied from '../components/AccessDenied';
import { ArrowLeft, TrendingUp, TrendingDown, ArrowUpRight, Sparkles, BarChart3, Wallet, DollarSign } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement,
    Title, Tooltip, Legend, Filler
} from 'chart.js';
import { themeAdaptorPlugin } from '../utils/chartTheme';
import ExportPDFButton from '../components/ExportPDFButton';
import ChartDrilldownModal from '../components/ChartDrilldownModal';
import { withChartDrilldown } from '../utils/chartDrilldown';
import useDashboardDataset from '../hooks/useDashboardDataset';
import ProductPageHeader from '../components/ProductPageHeader';

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
    const [drillDetail, setDrillDetail] = useState(null);
    const { data: scienceFacultyBudgetData } = useDashboardDataset('science_budget');

    if (!canAccess(user?.role, 'budget_forecast')) return <AccessDenied />;

    const { yearly, summary } = scienceFacultyBudgetData;
    const latestActual = yearly.filter(y => y.type === 'actual');
    const latestYear = latestActual[latestActual.length - 1];
    const prevYear = latestActual[latestActual.length - 2];

    const revenueGrowth = (((latestYear.revenue - prevYear.revenue) / prevYear.revenue) * 100).toFixed(1);
    const expenseGrowth = (((latestYear.expense - prevYear.expense) / prevYear.expense) * 100).toFixed(1);
    const usagePercent = ((latestYear.expense / latestYear.revenue) * 100).toFixed(1);

    /* ── Chart ── */
    const combinedChartData = {
        labels: yearly.map(y => y.year + (y.type === 'forecast' ? ' *' : '')),
        datasets: [
            {
                type: 'bar',
                label: 'ใช้จ่ายจริง',
                data: yearly.map(y => y.expense),
                backgroundColor: yearly.map(y => y.type === 'actual' ? 'color-mix(in srgb, var(--accent-success) 70%, transparent)' : 'color-mix(in srgb, var(--accent-success) 35%, transparent)'),
                borderColor: 'var(--accent-success)',
                borderWidth: 1.5, borderRadius: 6, order: 2,
            },
            {
                type: 'bar',
                label: 'ได้รับจัดสรร',
                data: yearly.map(y => y.revenue),
                backgroundColor: yearly.map(y => y.type === 'actual' ? 'color-mix(in srgb, var(--accent-blue) 70%, transparent)' : 'color-mix(in srgb, var(--accent-blue) 35%, transparent)'),
                borderColor: 'var(--accent-blue)',
                borderWidth: 1.5, borderRadius: 6, order: 2,
            },
            {
                type: 'line',
                label: 'คงเหลือ',
                data: yearly.map(y => y.surplus),
                borderColor: 'var(--accent-warning)',
                backgroundColor: 'color-mix(in srgb, var(--accent-warning) 12%, transparent)',
                borderWidth: 2.5,
                fill: true, tension: 0.4,
                pointBackgroundColor: yearly.map(y => y.type === 'actual' ? 'var(--accent-warning)' : 'var(--accent-warning)'),
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
                    font: { size: 13, weight: '600', family: "'Noto Sans Thai', system-ui, sans-serif" }
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
                title: { display: true, text: 'คงเหลือ', color: 'var(--accent-warning)', font: { size: 12, weight: '600' } }
            }
        }
    };

    const budgetDetailColumns = [
        { key: 'type', label: 'ประเภท' },
        { key: 'name', label: 'รายการ' },
        { key: 'amount', label: 'จำนวน (ล้านบาท)', align: 'right' },
        { key: 'percent', label: 'สัดส่วน', align: 'right' },
    ];

    const yearlyDetailColumns = [
        { key: 'year', label: 'ปีงบประมาณ' },
        { key: 'status', label: 'สถานะ' },
        { key: 'revenue', label: 'รายรับ (ล้านบาท)', align: 'right' },
        { key: 'expense', label: 'รายจ่าย (ล้านบาท)', align: 'right' },
        { key: 'surplus', label: 'คงเหลือ (ล้านบาท)', align: 'right' },
        { key: 'usagePercent', label: 'ใช้จ่าย', align: 'right' },
    ];

    const chartDrilldownOptions = withChartDrilldown(chartOptions, combinedChartData, setDrillDetail, (point) => {
        const year = yearly[point.index];
        if (!year) return null;

        const revenueRows = (year.revenueBreakdown || []).map(item => ({
            type: 'รายรับ',
            name: item.name,
            amount: item.amount,
            percent: `${((item.amount / year.revenue) * 100).toFixed(1)}%`,
        }));
        const expenseRows = (year.expenseBreakdown || []).map(item => ({
            type: 'รายจ่าย',
            name: item.name,
            amount: item.amount,
            percent: `${((item.amount / year.expense) * 100).toFixed(1)}%`,
        }));
        const rows = revenueRows.length || expenseRows.length
            ? [...revenueRows, ...expenseRows]
            : [{
                year: year.year,
                status: year.type === 'actual' ? 'ข้อมูลจริง' : 'พยากรณ์',
                revenue: year.revenue,
                expense: year.expense,
                surplus: year.surplus,
                usagePercent: `${((year.expense / year.revenue) * 100).toFixed(1)}%`,
            }];

        return {
            title: `รายละเอียดงบประมาณปี ${year.year}`,
            subtitle: point.datasetLabel,
            valueLabel: point.datasetLabel,
            value: point.value,
            unit: 'ล้านบาท',
            accentColor: point.color,
            summary: `${year.type === 'actual' ? 'ข้อมูลจริง' : 'ข้อมูลพยากรณ์'} รายรับ ${year.revenue.toLocaleString('th-TH')} ล้านบาท รายจ่าย ${year.expense.toLocaleString('th-TH')} ล้านบาท คงเหลือ ${year.surplus.toLocaleString('th-TH')} ล้านบาท`,
            rows,
            columns: revenueRows.length || expenseRows.length ? budgetDetailColumns : yearlyDetailColumns,
            note: year.type === 'forecast' ? 'จุดนี้เป็นข้อมูลพยากรณ์ จึงควรใช้ประกอบการวางแผน ไม่ใช่ยอดปิดบัญชีจริง' : 'จุดนี้มาจากข้อมูลจริงในชุดข้อมูลงบประมาณของระบบ',
        };
    });

    /* ── Summary Cards Data ── */
    const statCards = [
        {
            Icon: Wallet, label: `งบประมาณปี ${latestYear.year}`,
            value: `฿${(latestYear.revenue).toLocaleString()}`, sub: `↗ ${revenueGrowth > 0 ? '+' : ''}${revenueGrowth}% จากปีก่อน`,
            gradient: 'linear-gradient(135deg, var(--accent-info), var(--accent-info))',
            valueColor: 'var(--text-primary)',
        },
        {
            Icon: TrendingDown, label: 'ใช้จ่ายจริง (ถึงปัจจุบัน)',
            value: `฿${latestYear.expense.toLocaleString()}`, sub: `${usagePercent}% ของงบประมาณ · ${expenseGrowth > 0 ? '+' : ''}${expenseGrowth}% จากปีก่อน`,
            gradient: 'linear-gradient(135deg, var(--accent-pink), var(--accent-pink))',
            valueColor: 'var(--text-primary)',
        },
        {
            Icon: DollarSign, label: 'คงเหลือ',
            value: `฿${latestYear.surplus.toLocaleString()}`, sub: 'เพียงพอสำหรับไตรมาสที่เหลือ',
            gradient: 'linear-gradient(135deg, var(--accent-success-deep), var(--accent-success-deep))',
            valueColor: 'var(--accent-success)',
        },
        {
            Icon: TrendingUp, label: `พยากรณ์รายรับ ${yearly[yearly.length - 1].year}`,
            value: `฿${yearly[yearly.length - 1].revenue.toLocaleString()}`,
            sub: 'คาดการณ์ Linear Regression',
            gradient: 'linear-gradient(135deg, var(--accent-gold), var(--accent-gold))',
            valueColor: 'var(--accent-gold)',
        },
    ];

    const statusColor = (type) => type === 'actual' ? 'var(--accent-success)' : 'var(--accent-gold)';

    return (
        <div className="dashboard-content">
            <ChartDrilldownModal detail={drillDetail} onClose={() => setDrillDetail(null)} />
            <ProductPageHeader
                icon={BarChart3}
                eyebrow="FINANCIAL PLANNING"
                title="งบประมาณคณะวิทยาศาสตร์"
                subtitle="รายรับ รายจ่าย และแนวโน้มงบประมาณตั้งแต่ปี 2560 ถึงปัจจุบัน"
                tone="amber"
                actions={<ExportPDFButton title="งบประมาณคณะวิทยาศาสตร์" label="PDF" />}
            />

            {/* ── Stat Cards ── */}
            <div className="budget-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px', alignItems: 'stretch' }}>
                {statCards.map((sc, i) => (
                    <div key={i} className="budget-kpi-card" style={{ ...card, padding: '18px 20px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 120, height: '100%' }}>
                        <div className="budget-kpi-decoration" style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: sc.gradient, borderRadius: '0 16px 0 60px', opacity: 0.6 }} />
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: 8, position: 'relative', lineHeight: 1.3 }}>
                            <sc.Icon size={16} /> {sc.label}
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: sc.valueColor, marginBottom: '4px', position: 'relative', lineHeight: 1.1 }}>
                            {sc.value}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', position: 'relative', lineHeight: 1.3, marginTop: 'auto' }}>{sc.sub}</div>
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
                    <Bar data={combinedChartData} options={chartDrilldownOptions} />
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
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--accent-info)', fontWeight: 600, fontSize: '0.95rem' }}>
                                            ฿{(y.revenue * 1_000_000).toLocaleString()}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--accent-pink)', fontWeight: 600, fontSize: '0.95rem' }}>
                                            ฿{(y.expense * 1_000_000).toLocaleString()}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--accent-success)', fontWeight: 700, fontSize: '0.95rem' }}>
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
                                                        background: pct > 80 ? 'var(--accent-danger)' : pct > 60 ? 'var(--accent-warning)' : 'var(--accent-success)',
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
                            const colors = ['var(--accent-success-deep)', 'var(--accent-info)', 'var(--accent-gold)', 'var(--accent-pink)'];
                            return (
                                <div key={i} style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                                    <div style={{ width: 5, height: 40, borderRadius: 2, background: colors[i % colors.length], flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                            <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{item.name}</span>
                                            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-success)' }}>{item.amount.toFixed(1)} ล้าน</span>
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
                            const colors = ['var(--accent-danger)', 'var(--accent-warning)', 'var(--accent-blue)', 'var(--accent-purple)'];
                            return (
                                <div key={i} style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                                    <div style={{ width: 5, height: 40, borderRadius: 2, background: colors[i % colors.length], flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                            <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{item.name}</span>
                                            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-pink)' }}>{item.amount.toFixed(1)} ล้าน</span>
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
                borderColor: 'color-mix(in srgb, var(--accent-gold) 40%, transparent)', background: 'color-mix(in srgb, var(--accent-gold) 10%, transparent)',
            }}>
                <Sparkles size={18} style={{ color: 'var(--accent-gold)', flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                    <strong style={{ color: 'var(--accent-gold)' }}>หมายเหตุ:</strong> {summary.forecastNote}
                    <br />
                    อัตราเติบโตรายรับเฉลี่ย <strong style={{ color: 'var(--accent-info)' }}>{summary.avgGrowthRevenue}%</strong>/ปี
                    {' • '}
                    อัตราเติบโตรายจ่ายเฉลี่ย <strong style={{ color: 'var(--accent-pink)' }}>{summary.avgGrowthExpense}%</strong>/ปี
                </div>
            </div>
        </div>
    );
}
