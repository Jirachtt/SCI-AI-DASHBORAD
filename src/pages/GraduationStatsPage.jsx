import { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import AccessDenied from '../components/AccessDenied';
import {
    graduationHistory, currentGraduationStats, graduationByMajor,
    gpaDistribution, honorsData, graduationCandidateList
} from '../data/graduationData';
import useDashboardDataset from '../hooks/useDashboardDataset';
import {
    GraduationCap, Award, Users, TrendingUp, AlertTriangle,
    CheckCircle, XCircle, Clock, Search, Download
} from 'lucide-react';
import ExportPDFButton from '../components/ExportPDFButton';
import ChartDrilldownModal from '../components/ChartDrilldownModal';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
    Title, Tooltip, Legend, ArcElement, Filler, BarElement
} from 'chart.js';
import { themeAdaptorPlugin } from '../utils/chartTheme';
import { withChartDrilldown } from '../utils/chartDrilldown';
import {
    buildSmartRows,
    percentOf,
    summarizeSmartRows,
} from '../utils/smartChartData';
import { legacyColorToVar, themeAlpha } from '../utils/themeTokens';

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

const studentColumns = [
    { key: 'id', label: 'รหัสนักศึกษา' },
    { key: 'name', label: 'ชื่อ-นามสกุล' },
    { key: 'major', label: 'สาขาวิชา' },
    { key: 'year', label: 'ชั้นปี', align: 'right' },
    { key: 'gpa', label: 'GPA', align: 'right', render: value => typeof value === 'number' ? value.toFixed(2) : '-' },
    { key: 'graduationStatus', label: 'สถานะ' },
    { key: 'honors', label: 'เกียรตินิยม' },
];

function finiteNumber(...values) {
    for (const value of values) {
        const number = Number(value);
        if (Number.isFinite(number)) return number;
    }
    return null;
}

function usableArray(value, fallback, isUsable = item => Boolean(item)) {
    if (Array.isArray(value) && value.length > 0 && value.some(isUsable)) return value;
    return fallback;
}

function normalizeGraduationHistoryRows(rows, fallbackRows = graduationHistory) {
    const sourceRows = Array.isArray(rows) && rows.length > 0 ? rows : fallbackRows;
    const fallbackByYear = new Map(
        fallbackRows
            .filter(row => row?.year != null)
            .map(row => [Number(row.year), row])
    );

    const normalized = sourceRows
        .map(row => {
            const year = finiteNumber(row?.year, row?.academicYear);
            const fallback = fallbackByYear.get(Number(year)) || {};
            const candidates = finiteNumber(row?.candidates, row?.candidateCount, row?.totalCandidates, row?.total, fallback.candidates);
            const graduated = finiteNumber(row?.graduated, row?.graduateCount, row?.expectedGraduates, row?.expected, fallback.graduated);
            const calculatedRate = candidates && graduated != null ? (graduated / candidates) * 100 : null;
            const rate = finiteNumber(row?.rate, row?.graduationRate, row?.successRate, row?.completionRate, calculatedRate, fallback.rate);
            const avgGPA = finiteNumber(row?.avgGPA, row?.avgGpa, row?.gpa, fallback.avgGPA);

            return {
                ...fallback,
                ...row,
                year,
                candidates,
                graduated,
                rate: rate == null ? null : Number(rate.toFixed(1)),
                avgGPA: avgGPA == null ? null : Number(avgGPA.toFixed(2)),
            };
        })
        .filter(row => row.year != null);

    const hasUsableRate = normalized.some(row => Number.isFinite(Number(row.rate)));
    const hasUsableVolume = normalized.some(row =>
        Number(row.candidates) > 0 || Number(row.graduated) > 0
    );

    if (!hasUsableRate && !hasUsableVolume) return fallbackRows;
    return normalized;
}

function normalizeGraduationStats(liveStats = {}, fallbackStats = currentGraduationStats) {
    const merged = { ...fallbackStats };
    Object.entries(liveStats || {}).forEach(([key, value]) => {
        const fallbackValue = fallbackStats?.[key];
        if (typeof fallbackValue === 'number') {
            const number = Number(value);
            if (!Number.isFinite(number)) return;
            if (number === 0 && fallbackValue > 0) return;
            merged[key] = number;
            return;
        }
        if (value !== undefined && value !== null && value !== '') merged[key] = value;
    });
    return merged;
}

function normalizeHonorsData(value, fallback = honorsData) {
    const sum = item => ['firstClass', 'secondClass', 'normal', 'belowStandard']
        .reduce((total, key) => total + (Number(item?.[key]) || 0), 0);
    return value && sum(value) > 0 ? value : fallback;
}

function rowsByGpaRange(range, candidates = graduationCandidateList) {
    const [min, max] = String(range).split('-').map(Number);
    return candidates.filter(student => {
        const gpa = Number(student.gpa);
        return gpa >= min && gpa <= max;
    });
}

function normalizeGraduationStatus(value) {
    return String(value || '').replace('คาดว่าจะสำเร็จ', 'คาดว่าสำเร็จ').trim();
}

export default function GraduationStatsPage() {
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterMajor, setFilterMajor] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [drillDetail, setDrillDetail] = useState(null);
    const hasGraduationAccess = canAccess(user?.role, 'graduation_stats');
    const { data: liveGraduationData } = useDashboardDataset('graduation');

    const rawGraduationHistory = liveGraduationData?.graduationHistory || liveGraduationData?.history;
    const graduationHistoryData = normalizeGraduationHistoryRows(rawGraduationHistory, graduationHistory);
    const stats = normalizeGraduationStats(
        liveGraduationData?.current || liveGraduationData?.currentGraduationStats,
        currentGraduationStats
    );
    const candidateRows = usableArray(
        liveGraduationData?.candidateList || liveGraduationData?.candidates,
        graduationCandidateList,
        row => row?.id && row?.name
    );
    const graduationByMajorRows = usableArray(
        liveGraduationData?.byMajor || liveGraduationData?.graduationByMajor,
        graduationByMajor,
        row => Number(row?.total || row?.expected || row?.rate) > 0
    );
    const gpaDistributionRows = usableArray(
        liveGraduationData?.gpaDistribution,
        gpaDistribution,
        row => Number(row?.count) > 0
    );
    const honorsSummary = normalizeHonorsData(liveGraduationData?.honors, honorsData);

    // Filter candidate list
    const filteredCandidates = useMemo(() => candidateRows.filter(s => {
        const matchSearch = searchTerm === '' ||
            s.name.includes(searchTerm) ||
            s.id.includes(searchTerm);
        const matchMajor = filterMajor === 'all' || s.major === filterMajor;
        const matchStatus = filterStatus === 'all' || normalizeGraduationStatus(s.graduationStatus) === filterStatus;
        return matchSearch && matchMajor && matchStatus;
    }), [candidateRows, searchTerm, filterMajor, filterStatus]);

    if (!hasGraduationAccess) return <AccessDenied />;

    // Summary cards data
    const summaryCards = [
        { label: 'ผู้มีสิทธิ์รับปริญญา', value: stats.totalCandidates, sub: 'ป.ตรี ชั้นปีที่ 4', icon: GraduationCap, color: 'var(--accent-purple)', bg: 'color-mix(in srgb, var(--accent-purple) 12%, transparent)' },
        { label: 'คาดว่าสำเร็จ', value: stats.expectedGraduates, sub: `${((stats.expectedGraduates / stats.totalCandidates) * 100).toFixed(1)}%`, icon: CheckCircle, color: 'var(--accent-success)', bg: 'color-mix(in srgb, var(--accent-success) 12%, transparent)' },
        { label: 'รอพินิจ', value: stats.pending, sub: `${((stats.pending / stats.totalCandidates) * 100).toFixed(1)}%`, icon: Clock, color: 'var(--accent-warning)', bg: 'color-mix(in srgb, var(--accent-warning) 12%, transparent)' },
        { label: 'ไม่ผ่านเกณฑ์', value: stats.notPassed, sub: 'GPA < 1.75', icon: XCircle, color: 'var(--accent-danger)', bg: 'color-mix(in srgb, var(--accent-danger) 12%, transparent)' },
        { label: 'GPA เฉลี่ย', value: stats.avgGPA, sub: 'ของผู้มีสิทธิ์ทั้งหมด', icon: Award, color: 'var(--accent-blue)', bg: 'color-mix(in srgb, var(--accent-blue) 12%, transparent)' },
        { label: 'บัณฑิตศึกษา', value: stats.gradStudentsCandidates, sub: 'ป.โท + ป.เอก', icon: Users, color: 'var(--accent-cyan)', bg: 'color-mix(in srgb, var(--accent-cyan) 12%, transparent)' },
    ];

    // Graduation history line chart
    const historyChartData = {
        labels: graduationHistoryData.map(h => `${h.year}`),
        datasets: [
            {
                label: 'ผู้มีสิทธิ์',
                data: graduationHistoryData.map(h => h.candidates),
                borderColor: 'var(--accent-purple)',
                backgroundColor: 'color-mix(in srgb, var(--accent-purple) 10%, transparent)',
                fill: true,
                tension: 0.4,
            },
            {
                label: 'สำเร็จการศึกษา',
                data: graduationHistoryData.map(h => h.graduated),
                borderColor: 'var(--accent-success)',
                backgroundColor: 'color-mix(in srgb, var(--accent-success) 10%, transparent)',
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
        labels: graduationHistoryData.map(h => `${h.year}`),
        datasets: [{
            label: 'อัตราสำเร็จ (%)',
            data: graduationHistoryData.map(h => h.rate),
            borderColor: 'var(--accent-warning)',
            backgroundColor: 'color-mix(in srgb, var(--accent-warning) 15%, transparent)',
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointBackgroundColor: 'var(--accent-warning)',
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
    const majorChartData = {
        labels: graduationByMajorRows.map(m => m.major),
        datasets: [
            {
                label: 'คาดว่าสำเร็จ',
                data: graduationByMajorRows.map(m => m.expected),
                backgroundColor: 'color-mix(in srgb, var(--accent-success) 70%, transparent)',
            },
            {
                label: 'รอพินิจ',
                data: graduationByMajorRows.map(m => m.pending),
                backgroundColor: 'color-mix(in srgb, var(--accent-warning) 70%, transparent)',
            },
            {
                label: 'ไม่ผ่านเกณฑ์',
                data: graduationByMajorRows.map(m => m.notPassed),
                backgroundColor: 'color-mix(in srgb, var(--accent-danger) 70%, transparent)',
            },
        ]
    };

    const majorChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        interaction: {
            mode: 'index',
            axis: 'y',
            intersect: false,
        },
        layout: {
            padding: { left: 4, right: 16 }
        },
        plugins: {
            legend: { labels: { color: 'var(--text-muted)', font: { size: 11 } } },
            tooltip: {
                mode: 'index',
                axis: 'y',
                intersect: false,
                callbacks: {
                    title: (items) => graduationByMajorRows[items?.[0]?.dataIndex]?.major || items?.[0]?.label || '',
                    label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.x} คน`
                }
            }
        },
        scales: {
            x: { stacked: true, ticks: { color: 'var(--text-muted)' }, grid: { color: 'var(--border-color)' } },
            y: {
                stacked: true,
                ticks: {
                    color: 'var(--text-muted)',
                    font: { size: 12 },
                    autoSkip: false,
                },
                grid: { display: false },
                afterFit: (axis) => {
                    axis.width = Math.max(axis.width, 160);
                }
            }
        }
    };

    // GPA Distribution bar chart
    const gpaChartData = {
        labels: gpaDistributionRows.map(g => g.range),
        datasets: [{
            label: 'จำนวน (คน)',
            data: gpaDistributionRows.map(g => g.count),
            backgroundColor: gpaDistributionRows.map(g => themeAlpha(g.color, 80)),
            borderColor: gpaDistributionRows.map(g => legacyColorToVar(g.color)),
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
            data: [honorsSummary.firstClass, honorsSummary.secondClass, honorsSummary.normal, honorsSummary.belowStandard],
            backgroundColor: ['var(--accent-purple)', 'var(--accent-blue)', 'var(--accent-success)', 'var(--accent-danger)'],
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

    const statusRows = buildSmartRows([
        { label: 'คาดว่าสำเร็จ', value: stats.expectedGraduates, color: 'var(--accent-success)', description: 'GPA ผ่านเกณฑ์และอยู่ชั้นปีที่มีสิทธิ์' },
        { label: 'รอพินิจ', value: stats.pending, color: 'var(--accent-warning)', description: 'GPA 1.75-1.99 หรือมีสถานะรอพินิจ' },
        { label: 'ไม่ผ่านเกณฑ์', value: stats.notPassed, color: 'var(--accent-danger)', description: 'GPA ต่ำกว่า 1.75' },
    ], { meta: { isLive: true, sourceType: 'calculated' } });
    const statusSummary = summarizeSmartRows(statusRows);
    const statusTotal = Number(stats.totalCandidates) || statusSummary.total || 0;

    const uniqueMajors = [...new Set(candidateRows.map(s => s.major))].sort();

    const openStatusDetail = (statusRow) => {
        const rows = candidateRows.filter(student => normalizeGraduationStatus(student.graduationStatus) === statusRow.label);
        setDrillDetail({
            title: `สถานะการสำเร็จ: ${statusRow.label}`,
            subtitle: 'รายชื่อนักศึกษาปี 4 ที่อยู่ในกลุ่มนี้',
            valueLabel: 'จำนวน',
            value: rows.length || statusRow.value || 0,
            unit: 'คน',
            accentColor: statusRow.color,
            rows,
            columns: studentColumns,
            note: 'สถานะนี้คำนวณจาก GPA และชั้นปีของนักศึกษาปัจจุบัน ไม่ใช่ผลอนุมัติจบจริงจาก Reg',
        });
    };

    const historyDrilldownOptions = withChartDrilldown(historyChartOptions, historyChartData, setDrillDetail, (point) => {
        const row = graduationHistoryData[point.index];
        return {
            title: `แนวโน้มการสำเร็จการศึกษา ปี ${point.label}`,
            subtitle: point.datasetLabel,
            valueLabel: point.datasetLabel,
            value: point.value,
            unit: 'คน',
            accentColor: point.color,
            rows: row ? [row] : [],
            columns: [
                { key: 'year', label: 'ปี' },
                { key: 'candidates', label: 'ผู้มีสิทธิ์', align: 'right' },
                { key: 'graduated', label: 'สำเร็จการศึกษา', align: 'right' },
                { key: 'rate', label: 'อัตรา (%)', align: 'right' },
                { key: 'avgGPA', label: 'GPA เฉลี่ย', align: 'right' },
            ],
        };
    });

    const majorDrilldownOptions = withChartDrilldown(majorChartOptions, majorChartData, setDrillDetail, (point) => {
        const major = graduationByMajorRows[point.index]?.major || point.label;
        const status = point.datasetLabel;
        const rows = candidateRows.filter(student => student.major === major && normalizeGraduationStatus(student.graduationStatus) === status);
        const allMajorRows = candidateRows.filter(student => student.major === major);
        return {
            title: `${major}: ${status}`,
            subtitle: 'รายละเอียดนักศึกษาตามสาขาและสถานะที่เลือก',
            valueLabel: status,
            value: rows.length || point.value,
            unit: 'คน',
            accentColor: point.color,
            rows,
            columns: studentColumns,
            metrics: [
                { label: 'รวมสาขา', value: allMajorRows.length, unit: 'คน' },
                { label: 'GPA เฉลี่ย', value: allMajorRows.length ? (allMajorRows.reduce((sum, student) => sum + Number(student.gpa || 0), 0) / allMajorRows.length).toFixed(2) : '-' },
            ],
        };
    });

    const gpaDrilldownOptions = withChartDrilldown(gpaChartOptions, gpaChartData, setDrillDetail, (point) => {
        const rows = rowsByGpaRange(point.label, candidateRows);
        return {
            title: `ช่วง GPA ${point.label}`,
            subtitle: 'รายชื่อนักศึกษาที่อยู่ในช่วง GPA นี้',
            valueLabel: 'จำนวน',
            value: rows.length || point.value,
            unit: 'คน',
            accentColor: point.color,
            rows,
            columns: studentColumns,
        };
    });

    const rateDrilldownOptions = withChartDrilldown(rateChartOptions, rateChartData, setDrillDetail, (point) => {
        const row = graduationHistoryData[point.index];
        return {
            title: `อัตราสำเร็จการศึกษา ปี ${point.label}`,
            subtitle: 'ข้อมูลสรุปรายปี',
            valueLabel: 'อัตราสำเร็จ',
            value: point.value,
            unit: '%',
            accentColor: point.color,
            rows: row ? [row] : [],
            columns: [
                { key: 'year', label: 'ปี' },
                { key: 'candidates', label: 'ผู้มีสิทธิ์', align: 'right' },
                { key: 'graduated', label: 'สำเร็จการศึกษา', align: 'right' },
                { key: 'rate', label: 'อัตรา (%)', align: 'right' },
                { key: 'avgGPA', label: 'GPA เฉลี่ย', align: 'right' },
            ],
        };
    });

    const honorsDrilldownOptions = withChartDrilldown(honorsOptions, honorsChartData, setDrillDetail, (point) => {
        const rows = candidateRows.filter(student => student.honors === point.label);
        return {
            title: `เกียรตินิยม: ${point.label}`,
            subtitle: 'รายชื่อนักศึกษาที่อยู่ในกลุ่มนี้',
            valueLabel: 'จำนวน',
            value: rows.length || point.value,
            unit: 'คน',
            accentColor: point.color,
            rows,
            columns: studentColumns,
        };
    });

    return (
        <div className="graduation-stats-page">
            <ChartDrilldownModal detail={drillDetail} onClose={() => setDrillDetail(null)} />
            {/* Header */}
            <div className="section-header">
                <div className="section-header-icon" style={{ background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-purple))' }}>
                    <GraduationCap size={22} color="var(--text-on-accent)" />
                </div>
                <div>
                    <h1>สถิติการสำเร็จการศึกษา</h1>
                    <p>คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้ | ปีการศึกษา {stats.academicYear}</p>
                </div>
                <div className="section-header-actions">
                    <ExportPDFButton title="สถิติการสำเร็จการศึกษา" />
                </div>
            </div>

            {/* Summary Cards — matches Research page compact style */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24, alignItems: 'stretch' }}>
                {summaryCards.map((card, i) => {
                    const Icon = card.icon;
                    return (
                        <div key={i} style={{
                            ...cardStyle,
                            padding: '16px 18px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            minHeight: 92,
                            height: '100%',
                        }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: 10,
                                background: card.bg,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                <Icon size={20} color={card.color} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                                <div style={{ fontSize: '1.35rem', fontWeight: 700, color: card.color, lineHeight: 1.1 }}>{card.value}</div>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600, marginTop: 4, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} data-tooltip={card.label}>{card.label}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} data-tooltip={card.sub}>{card.sub}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Row 1: Smart status summary + Graduation Trend */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 18, marginBottom: 18 }}>
                {/* Smart Status Summary */}
                <div style={cardStyle}>
                    <div style={headerStyle}>
                        <CheckCircle size={18} color="var(--accent-success)" />
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>สถานะการสำเร็จ (ปัจจุบัน)</span>
                    </div>
                    <div className="smart-status-grid">
                        {statusRows.map(row => (
                            <button
                                type="button"
                                key={row.label}
                                className={`smart-status-card smart-status-${row.valueStatus}`}
                                onClick={() => openStatusDetail(row)}
                                style={{ '--smart-accent': row.color }}
                            >
                                <span className="smart-status-label">{row.label}</span>
                                <strong>{Number(row.value || 0).toLocaleString('th-TH')}</strong>
                                <small>{percentOf(row.value, statusTotal)} · {row.description}</small>
                            </button>
                        ))}
                    </div>
                    {statusSummary.hasNoChartableData ? (
                        <div className="smart-empty-state">รอข้อมูลจริง / sync หรืออัปโหลดข้อมูลก่อน</div>
                    ) : (
                        <div className="smart-stacked-bar" aria-label="สัดส่วนสถานะการสำเร็จ">
                            {statusRows.map(row => {
                                const width = statusTotal ? (Number(row.value || 0) / statusTotal) * 100 : 0;
                                if (width <= 0) return null;
                                return (
                                    <button
                                        type="button"
                                        key={row.label}
                                        className="smart-stacked-segment"
                                        style={{ width: `${Math.max(width, 1.2)}%`, background: row.color }}
                                        onClick={() => openStatusDetail(row)}
                                        aria-label={`${row.label} ${percentOf(row.value, statusTotal)}`}
                                    />
                                );
                            })}
                        </div>
                    )}
                    <div className="smart-chart-note">
                        รวม {statusTotal.toLocaleString('th-TH')} คน · คำนวณจาก GPA และชั้นปีของนักศึกษาปัจจุบัน
                    </div>
                </div>

                {/* Graduation History Line */}
                <div style={cardStyle}>
                    <div style={headerStyle}>
                        <TrendingUp size={18} color="var(--accent-purple)" />
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>แนวโน้มการสำเร็จการศึกษา (ย้อนหลัง 5 ปี)</span>
                    </div>
                    <div style={{ height: 280 }}>
                        <Line data={historyChartData} options={historyDrilldownOptions} />
                    </div>
                </div>
            </div>

            {/* Row 2: By Major + GPA Distribution */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18, marginBottom: 18 }}>
                {/* By Major */}
                <div style={cardStyle}>
                    <div style={headerStyle}>
                        <Users size={18} color="var(--accent-blue)" />
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>แยกตามสาขาวิชา</span>
                    </div>
                    <div style={{ height: Math.max(320, graduationByMajorRows.length * 42) }}>
                        <Bar data={majorChartData} options={majorDrilldownOptions} />
                    </div>
                </div>

                {/* GPA Distribution */}
                <div style={cardStyle}>
                    <div style={headerStyle}>
                        <Award size={18} color="var(--accent-warning)" />
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>การกระจายตัวของ GPA</span>
                    </div>
                    <div style={{ height: 280 }}>
                        <Bar data={gpaChartData} options={gpaDrilldownOptions} />
                    </div>
                </div>
            </div>

            {/* Row 3: Graduation Rate + Honors */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, marginBottom: 18 }}>
                {/* Graduation Rate */}
                <div style={cardStyle}>
                    <div style={headerStyle}>
                        <TrendingUp size={18} color="var(--accent-warning)" />
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>อัตราสำเร็จการศึกษา (%)</span>
                    </div>
                    <div style={{ height: 260 }}>
                        <Line data={rateChartData} options={rateDrilldownOptions} />
                    </div>
                </div>

                {/* Honors */}
                <div style={cardStyle}>
                    <div style={headerStyle}>
                        <Award size={18} color="var(--accent-purple)" />
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>เกียรตินิยม</span>
                    </div>
                    <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Doughnut data={honorsChartData} options={honorsDrilldownOptions} />
                    </div>
                </div>
            </div>

            {/* Major Stats Table */}
            <div style={{ ...cardStyle, marginBottom: 18 }}>
                <div style={headerStyle}>
                    <GraduationCap size={18} color="var(--accent-cyan)" />
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
                            {graduationByMajorRows.map((m, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 500 }}>{m.major}</td>
                                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', textAlign: 'center' }}>{m.total}</td>
                                    <td style={{ padding: '10px 12px', color: 'var(--accent-success)', textAlign: 'center', fontWeight: 600 }}>{m.expected}</td>
                                    <td style={{ padding: '10px 12px', color: 'var(--accent-warning)', textAlign: 'center' }}>{m.pending}</td>
                                    <td style={{ padding: '10px 12px', color: 'var(--accent-danger)', textAlign: 'center' }}>{m.notPassed}</td>
                                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', textAlign: 'center' }}>{m.avgGPA}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                        <span style={{
                                            background: m.rate >= 90 ? 'color-mix(in srgb, var(--accent-success) 15%, transparent)' : m.rate >= 70 ? 'color-mix(in srgb, var(--accent-warning) 15%, transparent)' : 'color-mix(in srgb, var(--accent-danger) 15%, transparent)',
                                            color: m.rate >= 90 ? 'var(--accent-success)' : m.rate >= 70 ? 'var(--accent-warning)' : 'var(--accent-danger)',
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
                        <Users size={18} color="var(--accent-purple)" />
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
                                    <td style={{ padding: '9px 10px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{s.id}</td>
                                    <td style={{ padding: '9px 10px', color: 'var(--text-primary)', fontWeight: 500 }}>{s.prefix}{s.name}</td>
                                    <td style={{ padding: '9px 10px', color: 'var(--text-muted)' }}>{s.major}</td>
                                    <td style={{ padding: '9px 10px', color: s.gpa >= 3.50 ? 'var(--accent-purple)' : s.gpa >= 3.00 ? 'var(--accent-blue)' : s.gpa >= 2.00 ? 'var(--accent-success)' : 'var(--accent-danger)', fontWeight: 600 }}>{s.gpa.toFixed(2)}</td>
                                    <td style={{ padding: '9px 10px' }}>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            padding: '2px 8px',
                                            borderRadius: 12,
                                            background: s.honors === 'เกียรตินิยมอันดับ 1' ? 'color-mix(in srgb, var(--accent-purple) 15%, transparent)' :
                                                        s.honors === 'เกียรตินิยมอันดับ 2' ? 'color-mix(in srgb, var(--accent-blue) 15%, transparent)' :
                                                        s.honors === 'ปกติ' ? 'color-mix(in srgb, var(--accent-success) 10%, transparent)' : 'color-mix(in srgb, var(--accent-danger) 15%, transparent)',
                                            color: s.honors === 'เกียรตินิยมอันดับ 1' ? 'var(--accent-purple)' :
                                                   s.honors === 'เกียรตินิยมอันดับ 2' ? 'var(--accent-blue)' :
                                                   s.honors === 'ปกติ' ? 'var(--accent-success)' : 'var(--accent-danger)',
                                        }}>{s.honors}</span>
                                    </td>
                                    <td style={{ padding: '9px 10px' }}>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            padding: '2px 8px',
                                            borderRadius: 12,
                                            fontWeight: 600,
                                            background: s.graduationStatus === 'คาดว่าสำเร็จ' ? 'color-mix(in srgb, var(--accent-success) 15%, transparent)' :
                                                        s.graduationStatus === 'รอพินิจ' ? 'color-mix(in srgb, var(--accent-warning) 15%, transparent)' : 'color-mix(in srgb, var(--accent-danger) 15%, transparent)',
                                            color: s.graduationStatus === 'คาดว่าสำเร็จ' ? 'var(--accent-success)' :
                                                   s.graduationStatus === 'รอพินิจ' ? 'var(--accent-warning)' : 'var(--accent-danger)',
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
