import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
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
import './BudgetForecastPage.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, Filler, themeAdaptorPlugin);

const budgetForecastZonePlugin = {
    id: 'budgetForecastZone',
    beforeDatasetsDraw(chart, _args, options = {}) {
        const startIndex = Number(options.startIndex);
        const xScale = chart?.scales?.x;
        const area = chart?.chartArea;
        if (!Number.isInteger(startIndex) || startIndex < 0 || !xScale || !area) return;

        const startCenter = xScale.getPixelForValue(startIndex);
        const previousCenter = startIndex > 0 ? xScale.getPixelForValue(startIndex - 1) : area.left;
        const startX = startIndex > 0 ? (previousCenter + startCenter) / 2 : area.left;
        const width = Math.max(0, area.right - startX);
        if (!Number.isFinite(startX) || width <= 0) return;

        const { ctx } = chart;
        ctx.save();
        ctx.fillStyle = options.backgroundColor || 'rgba(245, 158, 11, 0.05)';
        ctx.fillRect(startX, area.top, width, area.bottom - area.top);
        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = options.borderColor || 'rgba(217, 119, 6, 0.4)';
        ctx.lineWidth = 1;
        ctx.moveTo(startX, area.top);
        ctx.lineTo(startX, area.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = options.labelColor || '#92400e';
        ctx.font = "600 11px 'Noto Sans Thai', system-ui, sans-serif";
        ctx.textAlign = 'left';
        ctx.fillText(options.label || 'ช่วงประมาณการ', Math.min(startX + 10, area.right - 72), area.top + 16);
        ctx.restore();
    },
};

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
    const { theme } = useTheme();
    const [drillDetail, setDrillDetail] = useState(null);
    const { data: scienceFacultyBudgetData, meta: budgetMeta } = useDashboardDataset('science_budget');

    if (!canAccess(user?.role, 'budget_forecast')) return <AccessDenied />;

    const officialYearly = [...(scienceFacultyBudgetData?.yearly || [])]
        .filter(row => Number.isFinite(Number(row.year)) && Number.isFinite(Number(row.revenue)) && Number.isFinite(Number(row.expense)))
        .sort((a, b) => Number(a.year) - Number(b.year));
    const officialYears = new Set(officialYearly.map(row => String(row.year)));
    const historicalRows = [...(scienceFacultyBudgetData?.historicalSample || [])]
        .filter(row => Number.isFinite(Number(row.year)) && Number.isFinite(Number(row.revenue)) && Number.isFinite(Number(row.expense)))
        .filter(row => !officialYears.has(String(row.year)));
    const yearly = [...historicalRows, ...officialYearly]
        .sort((a, b) => Number(a.year) - Number(b.year));
    const summary = scienceFacultyBudgetData?.summary || {};
    const actualRows = yearly.filter(row => row.type === 'actual');
    const forecastRows = yearly.filter(row => row.type === 'forecast');
    const primaryYear = actualRows.at(-1) || forecastRows[0] || yearly[0];
    const latestForecast = forecastRows.at(-1) || yearly.at(-1);
    const comparableRows = primaryYear?.type === 'actual' ? actualRows : forecastRows;
    const primaryIndex = comparableRows.findIndex(row => row === primaryYear);
    const prevYear = primaryIndex > 0 ? comparableRows[primaryIndex - 1] : null;
    const revenueGrowth = prevYear?.revenue
        ? (((Number(primaryYear.revenue) - Number(prevYear.revenue)) / Number(prevYear.revenue)) * 100).toFixed(1)
        : null;
    const usagePercent = primaryYear?.revenue
        ? ((Number(primaryYear.expense) / Number(primaryYear.revenue)) * 100).toFixed(1)
        : null;
    const primaryIsForecast = primaryYear?.type === 'forecast';
    const firstForecastIndex = yearly.findIndex(y => y.type === 'forecast');
    const breakdownYear = [...actualRows].reverse().find(row => (
        Array.isArray(row.revenueBreakdown) || Array.isArray(row.expenseBreakdown)
    )) || primaryYear;
    const revenueBreakdown = Array.isArray(breakdownYear?.revenueBreakdown) ? breakdownYear.revenueBreakdown : [];
    const expenseBreakdown = Array.isArray(breakdownYear?.expenseBreakdown) ? breakdownYear.expenseBreakdown : [];
    const sourceName = scienceFacultyBudgetData?.source
        || budgetMeta?.sourceUrl
        || 'ชุดข้อมูลงบประมาณคณะวิทยาศาสตร์';
    const updatedLabel = budgetMeta?.updatedAt
        ? budgetMeta.updatedAt.toLocaleString('th-TH')
        : null;
    const formatMillion = value => `${Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ล้านบาท`;
    const formatBaht = value => `ประมาณ ${Math.round(Number(value || 0) * 1_000_000).toLocaleString('th-TH')} บาท`;

    /* ── Chart ── */
    const combinedChartData = {
        labels: yearly.map(y => y.year + (y.type === 'forecast' ? ' *' : '')),
        datasets: [
            {
                type: 'bar',
                label: 'รายจ่าย',
                data: yearly.map(y => y.expense),
                backgroundColor: 'var(--accent-cyan)',
                borderColor: 'var(--accent-cyan)',
                hoverBackgroundColor: 'var(--accent-cyan)',
                borderWidth: 0,
                borderRadius: 7,
                borderSkipped: false,
                categoryPercentage: 0.72,
                barPercentage: 0.78,
                maxBarThickness: 42,
                order: 2,
            },
            {
                type: 'bar',
                label: 'รายรับ',
                data: yearly.map(y => y.revenue),
                backgroundColor: 'var(--accent-blue)',
                borderColor: 'var(--accent-blue)',
                hoverBackgroundColor: 'var(--accent-blue)',
                borderWidth: 0,
                borderRadius: 7,
                borderSkipped: false,
                categoryPercentage: 0.72,
                barPercentage: 0.78,
                maxBarThickness: 42,
                order: 2,
            },
            {
                type: 'line',
                label: 'ส่วนต่างรายรับ-รายจ่าย',
                data: yearly.map(y => y.surplus),
                borderColor: 'var(--accent-warning)',
                backgroundColor: 'color-mix(in srgb, var(--accent-warning) 12%, transparent)',
                borderWidth: 2.75,
                fill: true,
                tension: 0.38,
                segment: {
                    borderDash: (ctx) => yearly[ctx.p1DataIndex]?.type === 'forecast' ? [7, 5] : undefined,
                },
                pointBackgroundColor: yearly.map(y => y.type === 'actual' ? 'var(--accent-warning)' : 'var(--accent-warning)'),
                pointBorderColor: 'var(--bg-card)',
                pointBorderWidth: 2,
                pointRadius: yearly.map(y => y.type === 'forecast' ? 4.5 : 4),
                pointHoverRadius: 7,
                pointHitRadius: 14,
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
                    color: 'var(--text-secondary)', padding: 22, usePointStyle: true, pointStyleWidth: 10,
                    font: { size: 13, weight: '600', family: "'Noto Sans Thai', system-ui, sans-serif" }
                }
            },
            budgetForecastZone: {
                startIndex: firstForecastIndex,
                label: 'ช่วงประมาณการ',
                backgroundColor: theme === 'dark' ? 'rgba(245, 158, 11, 0.065)' : 'rgba(245, 158, 11, 0.045)',
                borderColor: theme === 'dark' ? 'rgba(251, 191, 36, 0.42)' : 'rgba(180, 83, 9, 0.34)',
                labelColor: theme === 'dark' ? '#fbbf24' : '#92400e',
            },
            tooltip: {
                backgroundColor: 'var(--bg-card)', titleColor: 'var(--text-primary)', bodyColor: 'var(--text-secondary)',
                borderColor: 'var(--border-color)', borderWidth: 1,
                padding: 12, titleFont: { size: 13, weight: 'bold' }, bodyFont: { size: 12 }, displayColors: true,
                callbacks: {
                    title: (items) => {
                        const idx = items[0]?.dataIndex;
                        const year = yearly[idx];
                        return year ? `ปีงบประมาณ ${year.year}${year.type === 'forecast' ? ' · ประมาณการ' : ''}` : '';
                    },
                    label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString('th-TH') || '-'} ล้านบาท`,
                    afterBody: (items) => {
                        const idx = items[0]?.dataIndex;
                        return idx !== undefined && yearly[idx]?.type === 'forecast' ? '\nเส้นประและพื้นสีอ่อน = ค่าประมาณการ' : '';
                    }
                }
            }
        },
        scales: {
            x: {
                offset: true,
                ticks: { color: 'var(--text-muted)', font: { size: 12, weight: '600' }, padding: 7 },
                grid: { display: false },
                border: { display: false },
            },
            y: {
                position: 'left',
                beginAtZero: true,
                grace: '10%',
                ticks: { color: 'var(--text-muted)', font: { size: 12 }, callback: (v) => (v >= 1e6 ? (v / 1e6).toFixed(0) + 'M' : v.toLocaleString()) },
                grid: { color: 'var(--border-color)' },
                border: { display: false },
                title: { display: true, text: 'ล้านบาท', color: 'var(--text-muted)', font: { size: 12, weight: '600' } }
            },
            y1: {
                position: 'right',
                beginAtZero: true,
                grace: '10%',
                ticks: { color: 'var(--text-muted)', font: { size: 12 }, callback: (v) => v.toLocaleString() },
                grid: { display: false },
                border: { display: false },
                title: { display: true, text: 'ส่วนต่าง', color: 'var(--accent-warning)', font: { size: 12, weight: '600' } }
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
        { key: 'surplus', label: 'ส่วนต่าง (ล้านบาท)', align: 'right' },
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
                status: year.type === 'actual' ? 'ข้อมูลจริง' : 'ประมาณการ',
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
            summary: `${year.type === 'actual' ? 'ข้อมูลจริง' : 'ข้อมูลประมาณการ'} รายรับ ${year.revenue.toLocaleString('th-TH')} ล้านบาท รายจ่าย ${year.expense.toLocaleString('th-TH')} ล้านบาท ส่วนต่าง ${year.surplus.toLocaleString('th-TH')} ล้านบาท`,
            rows,
            columns: revenueRows.length || expenseRows.length ? budgetDetailColumns : yearlyDetailColumns,
            note: year.type === 'forecast' ? 'จุดนี้เป็นข้อมูลประมาณการจากไฟล์แผน จึงควรใช้ประกอบการวางแผน ไม่ใช่ยอดปิดบัญชีจริง' : 'จุดนี้มาจากข้อมูลจริงในชุดข้อมูลงบประมาณของระบบ',
        };
    });

    /* ── Summary Cards Data ── */
    const statCards = [
        {
            Icon: Wallet,
            label: `${primaryIsForecast ? 'ประมาณการรายรับ' : 'รายรับ'} ปี ${primaryYear.year}`,
            value: formatMillion(primaryYear.revenue),
            sub: revenueGrowth == null
                ? formatBaht(primaryYear.revenue)
                : `${revenueGrowth > 0 ? '+' : ''}${revenueGrowth}% จากปีก่อน · ${formatBaht(primaryYear.revenue)}`,
            gradient: 'linear-gradient(135deg, var(--accent-info), var(--accent-info))',
            valueColor: 'var(--text-primary)',
        },
        {
            Icon: TrendingDown,
            label: `${primaryIsForecast ? 'ประมาณการรายจ่าย' : 'รายจ่ายจริง'} ปี ${primaryYear.year}`,
            value: formatMillion(primaryYear.expense),
            sub: `${usagePercent ?? '-'}% ของรายรับ · ${formatBaht(primaryYear.expense)}`,
            gradient: 'linear-gradient(135deg, var(--accent-pink), var(--accent-pink))',
            valueColor: 'var(--text-primary)',
        },
        {
            Icon: DollarSign,
            label: primaryIsForecast ? 'ส่วนต่างตามประมาณการ' : 'คงเหลือ',
            value: formatMillion(primaryYear.surplus),
            sub: `รายรับ - รายจ่าย · ${formatBaht(primaryYear.surplus)}`,
            gradient: 'linear-gradient(135deg, var(--accent-success-deep), var(--accent-success-deep))',
            valueColor: 'var(--accent-success)',
        },
        {
            Icon: TrendingUp,
            label: `ประมาณการรายรับ ${latestForecast.year}`,
            value: formatMillion(latestForecast.revenue),
            sub: `${formatBaht(latestForecast.revenue)} · จากไฟล์แผนประมาณการ`,
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
                subtitle={`ประมาณการรายรับ รายจ่าย และส่วนต่าง ปี ${yearly[0]?.year || '-'}-${yearly.at(-1)?.year || '-'}`}
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

            <div style={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
                gap: 8, padding: '12px 16px', marginBottom: 24, borderRadius: 10,
                border: '1px solid color-mix(in srgb, var(--accent-gold) 35%, var(--border-color))',
                background: 'color-mix(in srgb, var(--accent-gold) 7%, var(--bg-card))',
                color: 'var(--text-secondary)', fontSize: '0.88rem',
            }}>
                <span><strong>แหล่งข้อมูล:</strong> {sourceName}</span>
                <span>{updatedLabel ? `อัปเดต ${updatedLabel}` : 'หน่วย: ล้านบาท (ตัวเลขหลัก) และบาท (บรรทัดอธิบาย)'}</span>
            </div>

            {/* ── Main Chart ── */}
            <section className="budget-trend-card">
                <header className="budget-trend-card__header">
                    <div>
                        <span className="budget-trend-card__eyebrow">BUDGET PERFORMANCE</span>
                        <h3>ประมาณการรายรับ รายจ่าย และส่วนต่าง</h3>
                        <p>ค่าทั้งหมดในกราฟมีหน่วยเป็นล้านบาท และเป็นประมาณการจากไฟล์แผน</p>
                    </div>
                    <div className="budget-trend-card__status" aria-label="สถานะชุดข้อมูล">
                        {actualRows.length > 0 && <span><i className="budget-status-dot budget-status-dot--actual" />ข้อมูลจริงถึงปี {actualRows.at(-1).year}</span>}
                        <span><i className="budget-status-dot budget-status-dot--forecast" />ประมาณการ {forecastRows.length} ปี</span>
                    </div>
                </header>
                <div className="budget-trend-card__canvas">
                    <Bar data={combinedChartData} options={chartDrilldownOptions} plugins={[budgetForecastZonePlugin]} />
                </div>
                <footer className="budget-trend-card__footer">
                    <span>คลิกแท่งหรือจุดข้อมูลเพื่อดูรายละเอียดรายปี</span>
                    <span>* พื้นหลังสีอ่อนและเส้นประเป็นค่าประมาณการ ไม่ใช่ยอดปิดบัญชีจริง</span>
                </footer>
            </section>

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
                                <th style={{ ...thStyle, textAlign: 'right' }}>รายรับ (บาท)</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>รายจ่าย (บาท)</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>ส่วนต่าง (บาท)</th>
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
                                                {y.type === 'actual' ? 'ข้อมูลจริง' : '* ประมาณการ'}
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
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>โครงสร้างรายรับ ปี {breakdownYear?.year || '-'}</h3>
                    </div>
                    <div style={{ padding: '14px 0' }}>
                        {revenueBreakdown.map((item, i) => {
                            const pct = ((item.amount / breakdownYear.revenue) * 100).toFixed(1);
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
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>โครงสร้างรายจ่าย ปี {breakdownYear?.year || '-'}</h3>
                    </div>
                    <div style={{ padding: '14px 0' }}>
                        {expenseBreakdown.map((item, i) => {
                            const pct = ((item.amount / breakdownYear.expense) * 100).toFixed(1);
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
                    <strong style={{ color: 'var(--accent-gold)' }}>การตีความ:</strong>{' '}
                    {primaryIsForecast
                        ? `ตัวเลขปี ${yearly[0]?.year}-${yearly.at(-1)?.year} เป็นประมาณการจาก ${sourceName} ไม่ใช่ยอดรับจริงหรือยอดเงินสดคงเหลือปัจจุบัน`
                        : (summary.forecastNote || 'ใช้ข้อมูลจริงล่าสุดจากชุดข้อมูลงบประมาณของระบบ')}
                    <br />
                    ส่วนต่างคำนวณจาก <strong>รายรับ - รายจ่าย</strong> และแสดงหน่วยหลักเป็นล้านบาท
                    {Number.isFinite(Number(summary.avgGrowthExpense)) && (
                        <>
                            {' • '}อัตราเพิ่มรายจ่ายตามแผนเฉลี่ย <strong style={{ color: 'var(--accent-pink)' }}>{summary.avgGrowthExpense}%</strong>/ปี
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
