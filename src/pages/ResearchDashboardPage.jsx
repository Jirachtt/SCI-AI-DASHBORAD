import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import AccessDenied from '../components/AccessDenied';
import { researchData } from '../data/researchData';
import { Bar, Line, Doughnut, Pie } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement,
    Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler
} from 'chart.js';
import { themeAdaptorPlugin } from '../utils/chartTheme';
import { FileText, DollarSign, Award, BookOpen, Globe2, TrendingUp, Microscope } from 'lucide-react';
import ExportPDFButton from '../components/ExportPDFButton';
import ChartDrilldownModal from '../components/ChartDrilldownModal';
import { withChartDrilldown } from '../utils/chartDrilldown';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler, themeAdaptorPlugin);

const cardStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px', padding: '24px',
};
const thStyle = { padding: '10px 14px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' };
const tdStyle = { padding: '10px 14px', fontSize: '0.88rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)' };

export default function ResearchDashboardPage() {
    const { user } = useAuth();
    const [drillDetail, setDrillDetail] = useState(null);
    if (!canAccess(user?.role, 'research_overview')) return <AccessDenied />;

    const { overview, publicationTrend, byDepartment, fundingTrend, fundingSources, patents, communityImpact, benchmark } = researchData;

    // Publication trend line chart
    const pubChartData = {
        labels: publicationTrend.map(p => p.year),
        datasets: [
            { label: 'Scopus', data: publicationTrend.map(p => p.scopus), borderColor: '#22c55e', backgroundColor: 'rgba(34, 197, 94, 0.12)', fill: true, tension: 0.4 },
            { label: 'TCI-1', data: publicationTrend.map(p => p.tci1), borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.12)', fill: true, tension: 0.4 },
            { label: 'TCI-2', data: publicationTrend.map(p => p.tci2), borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.12)', fill: true, tension: 0.4 },
            { label: 'ระดับชาติ', data: publicationTrend.map(p => p.national), borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.12)', fill: true, tension: 0.4 },
        ]
    };

    // Research by department bar
    const deptChartData = {
        labels: byDepartment.map(d => d.dept.replace('ภาควิชา', '')),
        datasets: [
            { label: 'ผลงานตีพิมพ์', data: byDepartment.map(d => d.publications), backgroundColor: 'rgba(34, 197, 94, 0.7)', borderColor: '#22c55e', borderWidth: 1, borderRadius: 6 },
            { label: 'สิทธิบัตร', data: byDepartment.map(d => d.patents), backgroundColor: 'rgba(245, 158, 11, 0.7)', borderColor: '#f59e0b', borderWidth: 1, borderRadius: 6 },
        ]
    };

    // Funding trend
    const fundChartData = {
        labels: fundingTrend.map(f => f.year),
        datasets: [
            { label: 'ทุนภายใน', data: fundingTrend.map(f => f.internal), backgroundColor: 'rgba(34, 197, 94, 0.7)', borderColor: '#22c55e', borderWidth: 1, borderRadius: 6 },
            { label: 'ทุนภายนอก', data: fundingTrend.map(f => f.external), backgroundColor: 'rgba(59, 130, 246, 0.7)', borderColor: '#3b82f6', borderWidth: 1, borderRadius: 6 },
            { label: 'ภาคเอกชน', data: fundingTrend.map(f => f.industry), backgroundColor: 'rgba(245, 158, 11, 0.7)', borderColor: '#f59e0b', borderWidth: 1, borderRadius: 6 },
        ]
    };

    // Funding sources pie
    const gradPalette = ['#7B68EE', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#a855f7', '#64748b'];
    const sourceData = {
        labels: fundingSources.map(s => s.source),
        datasets: [{
            data: fundingSources.map(s => s.amount),
            backgroundColor: fundingSources.map((_, i) => gradPalette[i % gradPalette.length]),
            borderWidth: 0,
        }]
    };

    // Benchmark bar chart
    const benchData = {
        labels: benchmark.map(b => b.university),
        datasets: [
            { label: 'Scopus Papers', data: benchmark.map(b => b.scopus), backgroundColor: 'rgba(34, 197, 94, 0.7)', borderColor: '#22c55e', borderWidth: 1, borderRadius: 6 },
            { label: 'h-Index', data: benchmark.map(b => b.hIndex), backgroundColor: 'rgba(59, 130, 246, 0.7)', borderColor: '#3b82f6', borderWidth: 1, borderRadius: 6 },
            { label: 'สิทธิบัตร', data: benchmark.map(b => b.patents), backgroundColor: 'rgba(245, 158, 11, 0.7)', borderColor: '#f59e0b', borderWidth: 1, borderRadius: 6 },
        ]
    };

    const chartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { color: 'var(--text-secondary)', padding: 12, font: { size: 11 } } },
            tooltip: { backgroundColor: 'var(--bg-card)', titleColor: 'var(--text-primary)', bodyColor: 'var(--text-secondary)' }
        },
        scales: {
            x: { ticks: { color: 'var(--text-muted)', font: { size: 10 } }, grid: { color: '#ffffff08' } },
            y: { ticks: { color: 'var(--text-muted)' }, grid: { color: '#ffffff08' } }
        }
    };

    const doughnutOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: 'var(--text-secondary)', padding: 10, font: { size: 10 } } } },
        cutout: '60%',
    };

    const publicationDrilldownOptions = withChartDrilldown(chartOptions, pubChartData, setDrillDetail, (point) => {
        const row = publicationTrend[point.index];
        return {
            title: `แนวโน้มผลงานตีพิมพ์ ปี ${point.label}`,
            subtitle: point.datasetLabel,
            valueLabel: point.datasetLabel,
            value: point.value,
            unit: 'เรื่อง',
            accentColor: point.color,
            rows: row ? [row] : [],
            columns: [
                { key: 'year', label: 'ปี' },
                { key: 'scopus', label: 'Scopus', align: 'right' },
                { key: 'tci1', label: 'TCI-1', align: 'right' },
                { key: 'tci2', label: 'TCI-2', align: 'right' },
                { key: 'national', label: 'ระดับชาติ', align: 'right' },
                { key: 'total', label: 'รวม', align: 'right' },
                { key: 'type', label: 'ประเภท' },
            ],
        };
    });

    const sourceDrilldownOptions = withChartDrilldown(doughnutOptions, sourceData, setDrillDetail, (point) => {
        const row = fundingSources[point.index];
        return {
            title: `แหล่งทุนวิจัย: ${point.label}`,
            subtitle: 'รายละเอียดแหล่งทุนวิจัยปีล่าสุด',
            valueLabel: 'จำนวนเงิน',
            value: point.value,
            unit: 'ล้านบาท',
            accentColor: point.color,
            rows: row ? [row] : [],
            columns: [
                { key: 'source', label: 'แหล่งทุน' },
                { key: 'amount', label: 'จำนวนเงิน (ล้านบาท)', align: 'right' },
            ],
        };
    });

    const deptDrilldownOptions = withChartDrilldown(chartOptions, deptChartData, setDrillDetail, (point) => {
        const row = byDepartment[point.index];
        return {
            title: `ผลงานวิจัย: ${point.label}`,
            subtitle: point.datasetLabel,
            valueLabel: point.datasetLabel,
            value: point.value,
            accentColor: point.color,
            rows: row ? [row] : [],
            columns: [
                { key: 'dept', label: 'ภาควิชา' },
                { key: 'publications', label: 'ผลงานตีพิมพ์', align: 'right' },
                { key: 'funding', label: 'ทุน (ล้านบาท)', align: 'right' },
                { key: 'patents', label: 'สิทธิบัตร', align: 'right' },
                { key: 'citations', label: 'Citations', align: 'right' },
            ],
        };
    });

    const fundingDrilldownOptions = withChartDrilldown(
        { ...chartOptions, scales: { ...chartOptions.scales, x: { ...chartOptions.scales.x, stacked: true }, y: { ...chartOptions.scales.y, stacked: true } } },
        fundChartData,
        setDrillDetail,
        (point) => {
            const row = fundingTrend[point.index];
            return {
                title: `แนวโน้มงบวิจัย ปี ${point.label}`,
                subtitle: point.datasetLabel,
                valueLabel: point.datasetLabel,
                value: point.value,
                unit: 'ล้านบาท',
                accentColor: point.color,
                rows: row ? [row] : [],
                columns: [
                    { key: 'year', label: 'ปี' },
                    { key: 'internal', label: 'ทุนภายใน', align: 'right' },
                    { key: 'external', label: 'ทุนภายนอก', align: 'right' },
                    { key: 'industry', label: 'ภาคเอกชน', align: 'right' },
                    { key: 'total', label: 'รวม', align: 'right' },
                    { key: 'type', label: 'ประเภท' },
                ],
            };
        }
    );

    const benchmarkDrilldownOptions = withChartDrilldown(chartOptions, benchData, setDrillDetail, (point) => {
        const row = benchmark[point.index];
        return {
            title: `Benchmark: ${point.label}`,
            subtitle: point.datasetLabel,
            valueLabel: point.datasetLabel,
            value: point.value,
            accentColor: point.color,
            rows: row ? [row] : [],
            columns: [
                { key: 'university', label: 'มหาวิทยาลัย' },
                { key: 'scopus', label: 'Scopus Papers', align: 'right' },
                { key: 'hIndex', label: 'h-Index', align: 'right' },
                { key: 'patents', label: 'สิทธิบัตร', align: 'right' },
            ],
        };
    });

    const scorecards = [
        { label: 'ผลงานตีพิมพ์รวม', value: overview.totalPublications.toLocaleString(), icon: FileText, color: '#006838' },
        { label: 'งบวิจัยรวม (ล้าน฿)', value: overview.totalFunding.toFixed(1), icon: DollarSign, color: '#2E86AB' },
        { label: 'สิทธิบัตร', value: overview.totalPatents, icon: Award, color: '#C5A028' },
        { label: 'Citations', value: overview.totalCitations.toLocaleString(), icon: BookOpen, color: '#A23B72' },
        { label: 'h-Index', value: overview.hIndex, icon: TrendingUp, color: '#7B68EE' },
        { label: 'โครงการดำเนินการ', value: overview.activeProjects, icon: Globe2, color: '#F18F01' },
    ];

    return (
        <div style={{ padding: '0 4px' }}>
            <ChartDrilldownModal detail={drillDetail} onClose={() => setDrillDetail(null)} />
            <div className="section-header">
                <div className="section-header-icon" style={{ background: 'linear-gradient(135deg, #006838, #00a651)' }}>
                    <Microscope size={22} color="#fff" />
                </div>
                <div>
                    <h1>การวิจัยและนวัตกรรม</h1>
                    <p>Research & Innovation — คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้</p>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                    <ExportPDFButton title="การวิจัยและนวัตกรรม" />
                </div>
            </div>

            {/* Scorecards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24, alignItems: 'stretch' }}>
                {scorecards.map((sc, i) => {
                    const Icon = sc.icon;
                    return (
                        <div key={i} style={{ ...cardStyle, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, minHeight: 92, height: '100%' }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${sc.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Icon size={20} color={sc.color} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>{sc.value}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.3 }}>{sc.label}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Row 1: Publication trend + Funding sources */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
                <div style={cardStyle}>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: 16 }}>แนวโน้มผลงานตีพิมพ์</h3>
                    <div style={{ height: 280 }}>
                        <Line data={pubChartData} options={publicationDrilldownOptions} />
                    </div>
                </div>
                <div style={cardStyle}>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: 16 }}>แหล่งทุนวิจัย</h3>
                    <div style={{ height: 280 }}>
                        <Doughnut data={sourceData} options={sourceDrilldownOptions} />
                    </div>
                </div>
            </div>

            {/* Row 2: Department + Funding trend */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div style={cardStyle}>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: 16 }}>ผลงานแยกตามภาควิชา</h3>
                    <div style={{ height: 260 }}>
                        <Bar data={deptChartData} options={deptDrilldownOptions} />
                    </div>
                </div>
                <div style={cardStyle}>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: 16 }}>แนวโน้มงบวิจัย (ล้านบาท)</h3>
                    <div style={{ height: 260 }}>
                        <Bar data={fundChartData} options={fundingDrilldownOptions} />
                    </div>
                </div>
            </div>

            {/* Row 3: Benchmark chart */}
            <div style={{ ...cardStyle, marginBottom: 16 }}>
                <h3 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: 16 }}>เปรียบเทียบกับมหาวิทยาลัยอื่น (Benchmarking)</h3>
                <div style={{ height: 280 }}>
                    <Bar data={benchData} options={benchmarkDrilldownOptions} />
                </div>
            </div>

            {/* Row 4: Patents table + Community impact */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={cardStyle}>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: 16 }}>สิทธิบัตรและนวัตกรรม</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={thStyle}>ID</th>
                                    <th style={thStyle}>ชื่อ</th>
                                    <th style={thStyle}>ประเภท</th>
                                    <th style={thStyle}>สถานะ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {patents.map((p, i) => (
                                    <tr key={i}>
                                        <td style={tdStyle}>{p.id}</td>
                                        <td style={{ ...tdStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</td>
                                        <td style={tdStyle}>{p.type}</td>
                                        <td style={tdStyle}>
                                            <span style={{
                                                padding: '3px 10px', borderRadius: 20, fontSize: '0.82rem', fontWeight: 600,
                                                background: p.status === 'ได้รับแล้ว' ? '#00683822' : '#C5A02822',
                                                color: p.status === 'ได้รับแล้ว' ? '#00a651' : '#C5A028',
                                            }}>{p.status}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div style={cardStyle}>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: 16 }}>งานวิจัยสู่ชุมชน</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {communityImpact.map((ci, i) => (
                            <div key={i} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '12px 16px' }}>
                                <div style={{ fontSize: '0.92rem', color: 'var(--text-primary)', fontWeight: 600 }}>{ci.title}</div>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 4, display: 'flex', gap: 12 }}>
                                    <span>{ci.area}</span>
                                    <span>{ci.beneficiaries.toLocaleString()} คน</span>
                                    <span>{ci.year}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
