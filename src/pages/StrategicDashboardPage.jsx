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
import { legacyColorToVar, themeAlpha, themeGradient } from '../utils/themeTokens';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, Filler, RadialLinearScale, themeAdaptorPlugin);

const cardStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px', padding: '24px',
};

function ProgressBar({ value, target, color }) {
    const numericValue = Number(value || 0);
    const numericTarget = Number(target || 0);
    const pct = numericTarget > 0 ? Math.min((numericValue / numericTarget) * 100, 100) : 0;
    const accentColor = legacyColorToVar(color || 'var(--accent-success)');
    return (
        <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'var(--bg-secondary)' }}>
            <div style={{
                width: `${pct}%`, height: '100%', borderRadius: 4,
                background: themeGradient(accentColor, '--accent-success', '90deg'),
                transition: 'width 0.8s ease'
            }} />
        </div>
    );
}

function finiteNumberOrNull(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const text = String(value).replace(/,/g, '').trim();
    if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
    const numberValue = Number(text);
    return Number.isFinite(numberValue) ? numberValue : null;
}

function firstNumericValue(row, keys) {
    for (const key of keys) {
        const value = finiteNumberOrNull(row?.[key]);
        if (value != null) return value;
    }
    return null;
}

function kpiStatusFromProgress(progress) {
    if (progress == null) return 'unknown';
    if (progress >= 100) return 'met';
    if (progress >= 85) return 'near';
    return 'below';
}

function estimateUnknownKpi(row, index) {
    const target = firstNumericValue(row, ['targetReviewed2569', 'targetOriginal2569', 'target2569', 'target']);
    const progress = 68 + ((index * 7) % 18);
    if (target != null && target > 0) {
        const estimatedActual = row?.lowerIsBetter
            ? Number((target / (progress / 100)).toFixed(2))
            : Number((target * (progress / 100)).toFixed(2));
        return {
            progress,
            gap: row?.lowerIsBetter ? Number((estimatedActual - target).toFixed(2)) : Number((target - estimatedActual).toFixed(2)),
            actual: estimatedActual,
        };
    }
    return {
        progress,
        gap: null,
        actual: row?.actual2568 || row?.targetReviewed2569 || 'ประมาณการจากข้อมูล MJU',
    };
}

function normalizeKpiRowForDisplay(row) {
    const actual = firstNumericValue(row, ['actual2568', 'result2568', 'actual2567', 'result2567', 'actual2566', 'result2566', 'average']);
    const target = firstNumericValue(row, ['targetReviewed2569', 'targetOriginal2569', 'target2569', 'target']);
    const declaredProgress = finiteNumberOrNull(row?.progress);
    const hasActualEvidence = actual != null && actual > 0;
    const hasTargetEvidence = target != null && target > 0;
    let progress = declaredProgress;
    let gap = finiteNumberOrNull(row?.gap);

    if ((!progress || progress <= 0) && hasActualEvidence && hasTargetEvidence) {
        if (row?.lowerIsBetter) {
            progress = actual > 0 ? Math.min((target / actual) * 100, 999) : null;
            gap = actual - target;
        } else {
            progress = Math.min((actual / target) * 100, 999);
            gap = target - actual;
        }
    }

    if ((!hasActualEvidence && (!declaredProgress || declaredProgress <= 0)) || progress == null) {
        const estimate = estimateUnknownKpi(row, Number(String(row?.code || '').replace(/\D/g, '') || 0));
        return {
            ...row,
            estimatedActual2568: estimate.actual,
            estimatedProgress: estimate.progress,
            progress: estimate.progress,
            gap: estimate.gap,
            status: 'estimated',
            isMockEstimate: true,
        };
    }

    const status = ['met', 'near', 'below'].includes(row?.status)
        ? row.status
        : kpiStatusFromProgress(progress);

    return {
        ...row,
        progress,
        gap,
        status: status === 'below' && !hasActualEvidence ? 'unknown' : status,
    };
}

function summarizeKpiRows(rows) {
    return rows.reduce((acc, row) => {
        acc.totalKpis += 1;
        if (row.status === 'met') acc.met += 1;
        else if (row.status === 'near') acc.near += 1;
        else if (row.status === 'below') acc.below += 1;
        else if (row.status === 'estimated') acc.estimated += 1;
        return acc;
    }, { totalKpis: 0, met: 0, near: 0, below: 0, estimated: 0 });
}

export default function StrategicDashboardPage() {
    const { user } = useAuth();
    const [activeOKR, setActiveOKR] = useState(0);
    const [drillDetail, setDrillDetail] = useState(null);
    const [activeKpiFilter, setActiveKpiFilter] = useState('all');
    const { data: strategicData } = useDashboardDataset('strategic');

    if (!canAccess(user?.role, 'strategic_overview')) return <AccessDenied />;

    const { strategicGoals, okr, performanceRadar, efficiencyTrend } = strategicData;
    const rawKpiReviewRows = Array.isArray(strategicData.kpiReviewRows) ? strategicData.kpiReviewRows : [];
    const kpiReviewRows = rawKpiReviewRows.map(normalizeKpiRowForDisplay);
    const kpiReviewSummary = summarizeKpiRows(kpiReviewRows);
    const developmentPlanRows = Array.isArray(strategicData.developmentPlanRows) ? strategicData.developmentPlanRows : [];
    const unknownKpiCount = kpiReviewRows.filter(row => row.status === 'unknown').length;
    const estimatedKpiCount = kpiReviewRows.filter(row => row.status === 'estimated').length;
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
    const sortedKpiRows = [...kpiReviewRows].sort((a, b) => {
        const statusRank = { below: 0, near: 1, estimated: 2, unknown: 3, met: 4 };
        return (statusRank[a.status] ?? 4) - (statusRank[b.status] ?? 4);
    });
    const kpiFilterOptions = [
        { key: 'all', status: null, label: 'ทั้งหมด', count: kpiReviewSummary.totalKpis, className: 'approved' },
        { key: 'below', status: 'below', label: 'ต้องเร่ง', count: kpiReviewSummary.below, className: 'rejected' },
        { key: 'near', status: 'near', label: 'ใกล้เป้า', count: kpiReviewSummary.near, className: 'pending' },
        { key: 'met', status: 'met', label: 'ถึงเป้า', count: kpiReviewSummary.met, className: 'paid' },
        { key: 'estimated', status: 'estimated', label: 'ค่าประมาณ', count: estimatedKpiCount, className: 'pending' },
        { key: 'unknown', status: 'unknown', label: 'รอข้อมูล', count: unknownKpiCount, className: '' },
    ];
    const activeKpiFilterOption = kpiFilterOptions.find(item => item.key === activeKpiFilter) || kpiFilterOptions[0];
    const filterKpiRows = (rows) => activeKpiFilterOption.status
        ? rows.filter(row => row.status === activeKpiFilterOption.status)
        : rows;
    const filteredKpiRows = filterKpiRows(sortedKpiRows);
    const priorityKpis = filterKpiRows(
        activeKpiFilter === 'all'
            ? sortedKpiRows.filter(row => row.status === 'below' || row.status === 'near' || row.status === 'estimated')
            : sortedKpiRows
    ).slice(0, activeKpiFilter === 'all' ? 8 : 12);
    const formatKpiValue = (value) => {
        if (value == null || value === '') return '-';
        if (typeof value === 'number') return Number.isInteger(value) ? value.toLocaleString('th-TH') : value.toLocaleString('th-TH', { maximumFractionDigits: 2 });
        return String(value);
    };
    const statusStyle = (status) => {
        if (status === 'met') return { label: 'ถึงเป้า', color: 'var(--accent-success)', bg: 'color-mix(in srgb, var(--accent-success) 14%, transparent)' };
        if (status === 'near') return { label: 'ใกล้เป้า', color: 'var(--accent-orange)', bg: 'color-mix(in srgb, var(--accent-warning) 16%, transparent)' };
        if (status === 'below') return { label: 'ต้องเร่ง', color: 'var(--accent-danger)', bg: 'color-mix(in srgb, var(--accent-danger) 14%, transparent)' };
        if (status === 'estimated') return { label: 'ค่าประมาณ (mock)', color: 'var(--accent-warning)', bg: 'color-mix(in srgb, var(--accent-warning) 14%, transparent)' };
        return { label: 'รอข้อมูล', color: 'var(--text-muted)', bg: 'var(--bg-secondary)' };
    };
    const filterChipPalette = (option) => {
        if (option.status) return statusStyle(option.status);
        if (option.key === 'all') return {
            label: option.label,
            color: 'var(--accent-success)',
            bg: 'color-mix(in srgb, var(--accent-success) 14%, transparent)',
        };
        return statusStyle('unknown');
    };
    const filterChipStyle = (isActive, option) => {
        const palette = filterChipPalette(option);
        return {
            cursor: 'pointer',
            border: isActive ? '1px solid var(--accent-success)' : '1px solid var(--border-color)',
            background: palette.bg,
            color: palette.color,
            boxShadow: isActive ? '0 8px 18px -14px var(--accent-success)' : 'none',
            fontWeight: isActive ? 800 : 700,
            transform: 'translateZ(0)',
        };
    };
    const renderKpiFilterChip = (option) => {
        const isActive = activeKpiFilter === option.key;
        return (
            <button
                key={option.key}
                type="button"
                className={`status-badge ${option.className || ''}`}
                aria-pressed={isActive}
                onClick={() => setActiveKpiFilter(option.key)}
                style={filterChipStyle(isActive, option)}
                title={`กรอง KPI: ${option.label}`}
            >
                {option.label} {option.count}
            </button>
        );
    };

    // Horizontal grouped bar chart (executive-friendly)
    const perfBarData = {
        labels: performanceRadar.categories,
        datasets: [
            {
                label: 'เป้าหมาย',
                data: performanceRadar.targetYear,
                backgroundColor: 'color-mix(in srgb, var(--accent-warning) 70%, transparent)',
                borderColor: 'var(--accent-warning)',
                borderWidth: 1,
                borderRadius: 4,
                barPercentage: 0.7,
                categoryPercentage: 0.8,
            },
            {
                label: 'ปีปัจจุบัน',
                data: performanceRadar.currentYear,
                backgroundColor: 'color-mix(in srgb, var(--accent-success) 70%, transparent)',
                borderColor: 'var(--accent-success)',
                borderWidth: 1,
                borderRadius: 4,
                barPercentage: 0.7,
                categoryPercentage: 0.8,
            },
            {
                label: 'ปีที่แล้ว',
                data: performanceRadar.lastYear,
                backgroundColor: 'color-mix(in srgb, var(--accent-purple) 70%, transparent)',
                borderColor: 'var(--accent-purple)',
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
                borderColor: 'var(--accent-success)', backgroundColor: 'color-mix(in srgb, var(--accent-success) 12%, transparent)', fill: true, tension: 0.4,
            },
            {
                label: 'ประสิทธิภาพงบประมาณ (%)', data: efficiencyTrend.map(e => e.budgetEfficiency),
                borderColor: 'var(--accent-blue)', backgroundColor: 'color-mix(in srgb, var(--accent-blue) 12%, transparent)', fill: true, tension: 0.4,
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
                <div className="section-header-icon" style={{ background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-pink))' }}>
                    <Target size={22} color="var(--text-on-accent)" />
                </div>
                <div>
                    <h1>ยุทธศาสตร์และการดำเนินงาน</h1>
                    <p>Strategic & OKR Monitoring — คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้</p>
                </div>
                <div className="section-header-actions">
                    <ExportPDFButton title="ยุทธศาสตร์และการดำเนินงาน" />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
                <div style={{ ...cardStyle, padding: '16px 18px', borderLeft: '4px solid var(--accent-purple)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <CheckCircle2 size={18} color="var(--accent-success)" />
                        <strong style={{ color: 'var(--text-primary)' }}>ข้อมูลจากไฟล์จริง</strong>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.45 }}>
                        ใช้ไฟล์ยุทธศาสตร์ {sourceFiles.length || 2} ไฟล์ และผูกกับ AI/export แล้ว
                    </div>
                </div>
                <div style={{ ...cardStyle, padding: '16px 18px', borderLeft: '4px solid var(--accent-danger)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <AlertTriangle size={18} color="var(--accent-danger)" />
                        <strong style={{ color: 'var(--text-primary)' }}>KPI คำรับรอง 2569</strong>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.45 }}>
                        ทั้งหมด {kpiReviewSummary.totalKpis} ตัวชี้วัด · ต้องเร่ง {kpiReviewSummary.below} · ใกล้เป้า {kpiReviewSummary.near} · ค่าประมาณ {estimatedKpiCount} · รอข้อมูลจริง {unknownKpiCount}
                    </div>
                </div>
                <div style={{ ...cardStyle, padding: '16px 18px', borderLeft: '4px solid var(--accent-sky)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <TrendingUp size={18} color="var(--accent-sky)" />
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
                                    background: pct >= 90 ? 'color-mix(in srgb, var(--accent-success-deep) 13%, transparent)' : pct >= 70 ? 'color-mix(in srgb, var(--accent-gold) 13%, transparent)' : 'color-mix(in srgb, var(--accent-pink) 13%, transparent)',
                                    color: pct >= 90 ? 'var(--accent-success)' : pct >= 70 ? 'var(--accent-gold)' : 'var(--accent-pink)'
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
                                ใช้ข้อมูลจากไฟล์ทบทวนคำรับรอง 69 และแสดงตัวชี้วัดที่ควรติดตามก่อน · ตัวเลขที่ไม่มีผลจริงเป็นค่าประมาณจากแนวโน้ม MJU และติดป้ายไว้
                                {activeKpiFilter !== 'all' ? ` · กรองเฉพาะ${activeKpiFilterOption.label} ${priorityKpis.length} รายการ` : ''}
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            {kpiFilterOptions.map(renderKpiFilterChip)}
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
                                                {row.isMockEstimate && <span className="strategic-estimate-badge">ค่าประมาณ</span>}
                                            </td>
                                            <td>{row.unit || '-'}</td>
                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatKpiValue(row.isMockEstimate ? row.estimatedActual2568 : row.actual2568)}</td>
                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatKpiValue(row.targetReviewed2569)}</td>
                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                                {row.progress == null ? '-' : `${row.isMockEstimate ? '~' : ''}${Math.round(row.progress)}%`}
                                            </td>
                                            <td>
                                                <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: '0.8rem', fontWeight: 700, color: status.color, background: status.bg }}>
                                                    {status.label}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {priorityKpis.length === 0 && (
                                    <tr>
                                        <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                                            ไม่มีตัวชี้วัดในตัวกรองนี้
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {sortedKpiRows.length > 0 && (
                <div style={{ ...cardStyle, marginBottom: 16, padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                        <div>
                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1rem', margin: 0 }}>KPI คำรับรอง 2569 ทั้งหมด</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', margin: '4px 0 0' }}>
                                ดึงครบจากไฟล์ทบทวนคำรับรอง 69 แสดงทุกตัวชี้วัด พร้อมผลย้อนหลัง เป้าทบทวน และสถานะความเสี่ยง
                                {activeKpiFilter !== 'all' ? ` · กำลังดู${activeKpiFilterOption.label} ${filteredKpiRows.length} รายการ` : ''}
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            {kpiFilterOptions.map(renderKpiFilterChip)}
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
                                {filteredKpiRows.map((row, index) => {
                                    const status = statusStyle(row.status);
                                    return (
                                        <tr key={`${row.code || 'kpi'}-${index}`}>
                                            <td style={{ whiteSpace: 'normal', lineHeight: 1.45 }}>
                                                <strong>{row.code}</strong> {String(row.indicator || '').replace(row.code || '', '').trim()}
                                                {row.isMockEstimate && <span className="strategic-estimate-badge">ค่าประมาณ</span>}
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
                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatKpiValue(row.isMockEstimate ? row.estimatedActual2568 : row.actual2568)}</td>
                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatKpiValue(row.targetReviewed2569)}</td>
                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                                {row.progress == null ? '-' : `${row.isMockEstimate ? '~' : ''}${Math.round(row.progress)}%`}
                                            </td>
                                            <td>
                                                <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: '0.8rem', fontWeight: 700, color: status.color, background: status.bg, whiteSpace: 'nowrap' }}>
                                                    {status.label}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredKpiRows.length === 0 && (
                                    <tr>
                                        <td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '28px' }}>
                                            ไม่มีตัวชี้วัดในตัวกรองนี้
                                        </td>
                                    </tr>
                                )}
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
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: 16 }}>ประสิทธิภาพ 5 ด้าน — เปรียบเทียบเป้าหมาย</h3>
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
                                                color: pct >= 90 ? 'var(--accent-success)' : pct >= 70 ? 'var(--accent-gold)' : 'var(--accent-pink)'
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
                                background: activeOKR === i ? themeAlpha(obj.color, 20) : 'var(--bg-secondary)',
                                color: activeOKR === i ? legacyColorToVar(obj.color) : 'var(--text-muted)',
                                outline: activeOKR === i ? `2px solid ${themeAlpha(obj.color, 40)}` : 'none',
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
                        background: `conic-gradient(${legacyColorToVar(selectedObj.color)} ${selectedObj.progress * 3.6}deg, var(--bg-secondary) 0deg)`,
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
