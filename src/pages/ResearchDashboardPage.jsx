import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import AccessDenied from '../components/AccessDenied';
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
import useDashboardDataset from '../hooks/useDashboardDataset';
import {
    buildSmartRows,
    percentOf,
    summarizeSmartRows,
} from '../utils/smartChartData';
import { legacyColorToVar, themeAlpha } from '../utils/themeTokens';

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
    const { data: researchData, meta: researchMeta } = useDashboardDataset('research');
    if (!canAccess(user?.role, 'research_overview')) return <AccessDenied />;

    const safeResearchData = researchData || {};
    const overview = safeResearchData.overview || safeResearchData.summary || {};
    const publicationTrend = Array.isArray(safeResearchData.publicationTrend) ? safeResearchData.publicationTrend : [];
    const byDepartment = Array.isArray(safeResearchData.byDepartment) ? safeResearchData.byDepartment : [];
    const fundingTrend = Array.isArray(safeResearchData.fundingTrend) ? safeResearchData.fundingTrend : [];
    const fundingSources = Array.isArray(safeResearchData.fundingSources) ? safeResearchData.fundingSources : [];
    const patents = Array.isArray(safeResearchData.patents) ? safeResearchData.patents : [];
    const communityImpact = Array.isArray(safeResearchData.communityImpact) ? safeResearchData.communityImpact : [];
    const benchmark = Array.isArray(safeResearchData.benchmark) ? safeResearchData.benchmark : [];

    // Publication trend line chart
    const pubChartData = {
        labels: publicationTrend.map(p => p.year),
        datasets: [
            { label: 'Scopus', data: publicationTrend.map(p => p.scopus), borderColor: 'var(--accent-success)', backgroundColor: 'color-mix(in srgb, var(--accent-success) 12%, transparent)', fill: true, tension: 0.4 },
            { label: 'TCI-1', data: publicationTrend.map(p => p.tci1), borderColor: 'var(--accent-blue)', backgroundColor: 'color-mix(in srgb, var(--accent-blue) 12%, transparent)', fill: true, tension: 0.4 },
            { label: 'TCI-2', data: publicationTrend.map(p => p.tci2), borderColor: 'var(--accent-warning)', backgroundColor: 'color-mix(in srgb, var(--accent-warning) 12%, transparent)', fill: true, tension: 0.4 },
            { label: 'ระดับชาติ', data: publicationTrend.map(p => p.national), borderColor: 'var(--accent-purple)', backgroundColor: 'color-mix(in srgb, var(--accent-purple) 12%, transparent)', fill: true, tension: 0.4 },
        ]
    };

    const publicationRows = buildSmartRows(
        byDepartment.map(row => ({
            ...row,
            label: String(row.dept || '').replace('ภาควิชา', '').trim() || row.dept,
            value: row.publications,
        })),
        { meta: researchMeta }
    );
    const publicationSummary = summarizeSmartRows(publicationRows);
    const chartablePublicationRows = publicationRows.filter(row => row.isChartable);
    const notChartedPublicationRows = publicationRows.filter(row => !row.isChartable);
    const patentDeptRows = buildSmartRows(
        byDepartment.map(row => ({
            ...row,
            label: String(row.dept || '').replace('ภาควิชา', '').trim() || row.dept,
            value: row.patents,
        })),
        { meta: researchMeta }
    ).sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
    const patentPositiveRows = patentDeptRows.filter(row => row.isChartable);
    const patentTotal = patentDeptRows.reduce((sum, row) => sum + Number(row.value || 0), 0);

    // Research publications by department bar. Patents are shown separately because
    // their scale is much smaller than publication counts.
    const deptChartData = {
        labels: chartablePublicationRows.map(d => d.label),
        datasets: [
            {
                label: 'ผลงานตีพิมพ์',
                data: chartablePublicationRows.map(d => d.value),
                backgroundColor: chartablePublicationRows.map(row => row.isFallback ? 'color-mix(in srgb, var(--text-subtle) 72%, transparent)' : 'color-mix(in srgb, var(--accent-success) 76%, transparent)'),
                borderColor: chartablePublicationRows.map(row => row.isFallback ? 'var(--text-subtle)' : 'var(--accent-success)'),
                borderWidth: 1,
                borderRadius: 6,
                valueStatus: chartablePublicationRows.map(row => row.valueStatus),
            },
        ]
    };

    // Funding trend
    const fundChartData = {
        labels: fundingTrend.map(f => f.year),
        datasets: [
            { label: 'ทุนภายใน', data: fundingTrend.map(f => f.internal), backgroundColor: 'color-mix(in srgb, var(--accent-success) 70%, transparent)', borderColor: 'var(--accent-success)', borderWidth: 1, borderRadius: 6 },
            { label: 'ทุนภายนอก', data: fundingTrend.map(f => f.external), backgroundColor: 'color-mix(in srgb, var(--accent-blue) 70%, transparent)', borderColor: 'var(--accent-blue)', borderWidth: 1, borderRadius: 6 },
            { label: 'ภาคเอกชน', data: fundingTrend.map(f => f.industry), backgroundColor: 'color-mix(in srgb, var(--accent-warning) 70%, transparent)', borderColor: 'var(--accent-warning)', borderWidth: 1, borderRadius: 6 },
        ]
    };

    // Funding sources pie
    const gradPalette = ['var(--accent-purple)', 'var(--accent-success)', 'var(--accent-warning)', 'var(--accent-danger)', 'var(--accent-blue)', 'var(--accent-cyan)', 'var(--accent-purple)', 'var(--accent-pink)', 'var(--accent-teal)', 'var(--accent-orange)', 'var(--accent-purple)', 'var(--text-subtle)'];
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
            { label: 'Scopus Papers', data: benchmark.map(b => b.scopus), backgroundColor: 'color-mix(in srgb, var(--accent-success) 70%, transparent)', borderColor: 'var(--accent-success)', borderWidth: 1, borderRadius: 6 },
            { label: 'h-Index', data: benchmark.map(b => b.hIndex), backgroundColor: 'color-mix(in srgb, var(--accent-blue) 70%, transparent)', borderColor: 'var(--accent-blue)', borderWidth: 1, borderRadius: 6 },
            { label: 'สิทธิบัตร', data: benchmark.map(b => b.patents), backgroundColor: 'color-mix(in srgb, var(--accent-warning) 70%, transparent)', borderColor: 'var(--accent-warning)', borderWidth: 1, borderRadius: 6 },
        ]
    };

    const chartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { color: 'var(--text-secondary)', padding: 12, font: { size: 11 } } },
            tooltip: { backgroundColor: 'var(--bg-card)', titleColor: 'var(--text-primary)', bodyColor: 'var(--text-secondary)' }
        },
        scales: {
            x: { ticks: { color: 'var(--text-muted)', font: { size: 10 } }, grid: { color: 'var(--chart-grid)' } },
            y: { ticks: { color: 'var(--text-muted)' }, grid: { color: 'var(--chart-grid)' } }
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
        const row = chartablePublicationRows[point.index];
        return {
            title: `ผลงานวิจัย: ${point.label}`,
            subtitle: point.datasetLabel,
            valueLabel: point.datasetLabel,
            value: point.value,
            unit: 'เรื่อง',
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
        { label: 'ผลงานตีพิมพ์รวม', value: Number(overview.totalPublications || 0).toLocaleString('th-TH'), icon: FileText, color: 'var(--accent-success-deep)' },
        { label: 'งบวิจัยรวม (ล้าน฿)', value: Number(overview.totalFunding || 0).toFixed(1), icon: DollarSign, color: 'var(--accent-info)' },
        { label: 'สิทธิบัตร', value: Number(overview.totalPatents ?? patentTotal ?? 0).toLocaleString('th-TH'), icon: Award, color: 'var(--accent-gold)' },
        { label: 'Citations', value: Number(overview.totalCitations || 0).toLocaleString('th-TH'), icon: BookOpen, color: 'var(--accent-pink)' },
        { label: 'h-Index', value: overview.hIndex ?? '-', icon: TrendingUp, color: 'var(--accent-purple)' },
        { label: 'โครงการดำเนินการ', value: overview.activeProjects ?? '-', icon: Globe2, color: 'var(--accent-orange)' },
    ];

    return (
        <div style={{ padding: '0 4px' }}>
            <ChartDrilldownModal detail={drillDetail} onClose={() => setDrillDetail(null)} />
            <div className="section-header">
                <div className="section-header-icon" style={{ background: 'linear-gradient(135deg, var(--accent-success-deep), var(--accent-success))' }}>
                    <Microscope size={22} color="var(--text-on-accent)" />
                </div>
                <div>
                    <h1>การวิจัยและนวัตกรรม</h1>
                    <p>Research & Innovation — คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้</p>
                </div>
                <div className="section-header-actions">
                    <ExportPDFButton title="การวิจัยและนวัตกรรม" />
                </div>
            </div>

            {/* Scorecards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24, alignItems: 'stretch' }}>
                {scorecards.map((sc, i) => {
                    const Icon = sc.icon;
                    const accentColor = legacyColorToVar(sc.color);
                    return (
                        <div key={i} style={{ ...cardStyle, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, minHeight: 92, height: '100%' }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: themeAlpha(sc.color, 13), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Icon size={20} color={accentColor} />
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
            <div className="research-dashboard-grid is-featured">
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
            <div className="research-dashboard-grid">
                <div style={cardStyle}>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: 6 }}>ผลงานตีพิมพ์แยกตามภาควิชา</h3>
                    <p className="smart-chart-subtitle">แยกสิทธิบัตรออกจากกราฟนี้ เพราะสเกลเล็กกว่าผลงานตีพิมพ์มาก</p>
                    {publicationSummary.hasNoChartableData ? (
                        <div className="smart-empty-state">รอข้อมูลจริง / sync หรืออัปโหลดข้อมูลก่อน</div>
                    ) : (
                        <div style={{ height: 260 }}>
                            <Bar data={deptChartData} options={deptDrilldownOptions} />
                        </div>
                    )}
                    {notChartedPublicationRows.length > 0 && (
                        <div className="smart-chart-note">ไม่แสดงในกราฟ {notChartedPublicationRows.length} ภาควิชาที่มีค่าเป็นศูนย์</div>
                    )}
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
            <div className="research-dashboard-grid no-bottom-gap">
                <div style={cardStyle}>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: 16 }}>สิทธิบัตรและนวัตกรรม</h3>
                    <div className="smart-patent-summary">
                        <div className="smart-patent-total">
                            <span>สิทธิบัตรรวม</span>
                            <strong>{Number(overview.totalPatents ?? patentTotal ?? 0).toLocaleString('th-TH')}</strong>
                        </div>
                        <div className="smart-mini-bar-list">
                            {patentPositiveRows.length === 0 ? (
                                <div className="smart-empty-state compact">ยังไม่มีข้อมูลสิทธิบัตรแยกภาควิชา</div>
                            ) : patentPositiveRows.slice(0, 5).map(row => (
                                <div key={row.dept || row.label} className={`smart-mini-bar-row smart-status-${row.valueStatus}`}>
                                    <span>{row.label}</span>
                                    <div className="smart-mini-bar-track">
                                        <div style={{ width: percentOf(row.value, Math.max(1, patentTotal)), background: row.isFallback ? 'var(--text-subtle)' : 'var(--accent-warning)' }} />
                                    </div>
                                    <strong>{Number(row.value || 0).toLocaleString('th-TH')}</strong>
                                </div>
                            ))}
                        </div>
                    </div>
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
                                                background: p.status === 'ได้รับแล้ว' ? 'color-mix(in srgb, var(--accent-success-deep) 13%, transparent)' : 'color-mix(in srgb, var(--accent-gold) 13%, transparent)',
                                                color: p.status === 'ได้รับแล้ว' ? 'var(--accent-success)' : 'var(--accent-gold)',
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
