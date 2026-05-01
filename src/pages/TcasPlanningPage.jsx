import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    AlertTriangle,
    ArrowLeft,
    Calculator,
    ClipboardList,
    FileSpreadsheet,
    GraduationCap,
    LineChart,
    Target,
    TrendingDown,
    TrendingUp,
    Users,
} from 'lucide-react';
import { Bar, Line } from 'react-chartjs-2';
import {
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Filler,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Tooltip,
} from 'chart.js';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import AccessDenied from '../components/AccessDenied';
import ExportPDFButton from '../components/ExportPDFButton';
import useDashboardDataset from '../hooks/useDashboardDataset';
import { themeAdaptorPlugin } from '../utils/chartTheme';
import {
    calculateTcasImpact,
    getTcasSummary,
    tcasPlanningData,
} from '../data/tcasAdmissionsData';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler, themeAdaptorPlugin);

const money = value => Number(value || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 });
const pct = value => `${(Number(value || 0) * 100).toFixed(1)}%`;

function sourceLabel(status) {
    if (status === 'official_public') return 'ข้อมูลทางการ';
    if (status === 'mixed_official_seed') return 'ทางการ+seed';
    if (status === 'waiting_for_internal_file') return 'รอไฟล์จริง';
    return 'working seed';
}

export default function TcasPlanningPage() {
    const { user } = useAuth();
    const { data: liveTcasData } = useDashboardDataset('tcas_admissions');
    const [intake, setIntake] = useState(100);
    const [attritionRate, setAttritionRate] = useState(12);

    const hasAccess = canAccess(user?.role, 'tcas_admissions');
    const data = liveTcasData || tcasPlanningData;
    const summary = getTcasSummary(data);
    const impact = calculateTcasImpact({
        intake,
        attritionRate,
        tuitionPerTerm: data.planningAssumptions.tuitionPerTerm,
        terms: data.planningAssumptions.termsInProgram,
    });

    const trendChartData = {
        labels: data.fiveYearTrend.map(item => `${item.year}`),
        datasets: [
            {
                type: 'bar',
                label: 'รายงานตัว',
                data: data.fiveYearTrend.map(item => item.enrolled),
                backgroundColor: 'rgba(0, 166, 81, 0.72)',
                borderRadius: 6,
            },
            {
                type: 'bar',
                label: 'คงอยู่',
                data: data.fiveYearTrend.map(item => item.retained),
                backgroundColor: 'rgba(46, 134, 171, 0.72)',
                borderRadius: 6,
            },
            {
                type: 'line',
                label: 'หายไป/ออก',
                data: data.fiveYearTrend.map(item => item.withdrawn),
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.14)',
                tension: 0.35,
                fill: false,
                pointRadius: 4,
            },
        ],
    };

    const majorPlanChartData = {
        labels: data.round3Plan2569.map(item => item.major),
        datasets: [{
            label: 'จำนวนรับรอบ 3 Admission 2569',
            data: data.round3Plan2569.map(item => item.plan),
            backgroundColor: data.round3Plan2569.map((_, idx) => ['#00a651', '#2E86AB', '#7B68EE', '#C5A028', '#E91E63'][idx % 5]),
            borderRadius: 6,
        }],
    };

    const roundLineData = {
        labels: data.roundPlan2569.map(item => item.round),
        datasets: [
            {
                label: 'แผนรับ',
                data: data.roundPlan2569.map(item => item.plan),
                borderColor: '#7B68EE',
                backgroundColor: 'rgba(123,104,238,0.16)',
                fill: true,
                tension: 0.35,
            },
            {
                label: 'รายงานตัว',
                data: data.roundPlan2569.map(item => item.enrolled),
                borderColor: '#00a651',
                backgroundColor: 'rgba(0,166,81,0.12)',
                fill: false,
                tension: 0.35,
            },
        ],
    };

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: 'var(--text-secondary)', font: { size: 12 } } },
        },
        scales: {
            x: { ticks: { color: 'var(--text-secondary)' }, grid: { color: 'var(--border-color)' } },
            y: { ticks: { color: 'var(--text-secondary)' }, grid: { color: 'var(--border-color)' } },
        },
    };
    const majorPlanOptions = {
        ...commonOptions,
        indexAxis: 'y',
        scales: {
            x: { ticks: { color: 'var(--text-secondary)' }, grid: { color: 'var(--border-color)' } },
            y: { ticks: { color: 'var(--text-secondary)', font: { size: 11 } }, grid: { color: 'var(--border-color)' } },
        },
    };

    if (!hasAccess) return <AccessDenied />;

    return (
        <div className="tcas-page">
            <Link to="/dashboard" className="back-button">
                <ArrowLeft size={16} /> กลับหน้าหลัก
            </Link>

            <div className="section-header tcas-page-header">
                <div className="section-header-icon" style={{ background: 'linear-gradient(135deg, #006838, #00a651)' }}>
                    <ClipboardList size={22} color="#fff" />
                </div>
                <div>
                    <h2>แผนรับนักศึกษา TCAS</h2>
                    <p>TCAS Planning — ย้อนหลัง 5 ปี, รอบถัดไป, และผลกระทบต่อรายได้ค่าเทอม</p>
                </div>
                <div className="section-header-actions">
                    <ExportPDFButton title="แผนรับนักศึกษา TCAS" />
                </div>
            </div>

            <section className="tcas-source-banner">
                <div>
                    <span><FileSpreadsheet size={15} /> สถานะข้อมูล</span>
                    <strong>ใช้ข้อมูลทางการที่พบได้สำหรับ TCAS รอบ 3 ปี 2569 และเตรียมช่องนำเข้าไฟล์ย้อนหลังจาก Reg/Admissions</strong>
                    <p>{data.planningAssumptions.note}</p>
                </div>
                <div className="tcas-source-links">
                    {data.sources.map(source => (
                        source.url ? (
                            <a key={source.label} href={source.url} target="_blank" rel="noreferrer">
                                {source.label}
                            </a>
                        ) : (
                            <span key={source.label}>{source.label}</span>
                        )
                    ))}
                </div>
            </section>

            <section className="tcas-kpi-grid">
                <article className="tcas-kpi-card">
                    <div><Target size={20} /></div>
                    <strong>{summary.officialRound3Plan}</strong>
                    <span>แผนรับรอบ 3 ปี 2569</span>
                    <small>จาก Admissions MJU PDF</small>
                </article>
                <article className="tcas-kpi-card">
                    <div><Users size={20} /></div>
                    <strong>{summary.latestEnrolled}</strong>
                    <span>รายงานตัวล่าสุด</span>
                    <small>ปี {summary.latestYear} ชุดคำนวณรอไฟล์จริง</small>
                </article>
                <article className="tcas-kpi-card">
                    <div><TrendingUp size={20} /></div>
                    <strong>{pct(summary.retentionRate)}</strong>
                    <span>อัตราคงอยู่</span>
                    <small>{summary.latestRetained}/{summary.latestEnrolled} คน</small>
                </article>
                <article className="tcas-kpi-card">
                    <div><TrendingDown size={20} /></div>
                    <strong>{summary.latestWithdrawn}</strong>
                    <span>หายไป/ออกล่าสุด</span>
                    <small>ใช้วิเคราะห์ผลกระทบรายได้</small>
                </article>
            </section>

            <section className="tcas-layout">
                <article className="chart-card">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">แนวโน้มรับเข้า-คงอยู่-หายไป 5 ปี</div>
                            <div className="chart-card-subtitle">รองรับการแทนค่าด้วยไฟล์ย้อนหลังจริงจาก Admissions/Reg</div>
                        </div>
                    </div>
                    <div className="tcas-chart">
                        <Bar data={trendChartData} options={commonOptions} />
                    </div>
                </article>

                <article className="chart-card">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">แผนตามรอบ TCAS ปี 2569</div>
                            <div className="chart-card-subtitle">รอบ 3 เป็นข้อมูลทางการ, รอบอื่นรอไฟล์ภายใน</div>
                        </div>
                    </div>
                    <div className="tcas-chart tcas-chart-small">
                        <Line data={roundLineData} options={commonOptions} />
                    </div>
                    <div className="tcas-round-list">
                        {data.roundPlan2569.map(round => (
                            <div key={round.round}>
                                <span>{round.round}</span>
                                <strong>{round.plan} คน</strong>
                                <em>{sourceLabel(round.sourceStatus)}</em>
                            </div>
                        ))}
                    </div>
                </article>
            </section>

            <section className="tcas-layout">
                <article className="chart-card">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">จำนวนรับรอบ 3 Admission 2569 แยกสาขา</div>
                            <div className="chart-card-subtitle">อ้างอิงร่างเกณฑ์ TCAS รอบ 3 มหาวิทยาลัยแม่โจ้</div>
                        </div>
                    </div>
                    <div className="tcas-chart">
                        <Bar data={majorPlanChartData} options={majorPlanOptions} />
                    </div>
                </article>

                <article className="chart-card tcas-impact-card">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">Impact Simulator</div>
                            <div className="chart-card-subtitle">ตอบคำถาม: เข้า 100 คน ออกกี่คน กระทบค่าเทอมเท่าไร</div>
                        </div>
                        <Calculator size={22} color="#00a651" />
                    </div>
                    <label>
                        นักศึกษาเข้า
                        <input type="number" min="0" value={intake} onChange={event => setIntake(Number(event.target.value))} />
                    </label>
                    <label>
                        อัตราหายไป/ออก (%)
                        <input type="number" min="0" max="100" value={attritionRate} onChange={event => setAttritionRate(Number(event.target.value))} />
                    </label>
                    <div className="tcas-impact-results">
                        <div><span>คงอยู่</span><strong>{impact.retainedStudents} คน</strong></div>
                        <div><span>หายไป/ออก</span><strong>{impact.lostStudents} คน</strong></div>
                        <div><span>รายได้หายไป</span><strong>{money(impact.lostRevenue)} บาท</strong></div>
                    </div>
                    <p>
                        คิดจากค่าเทอมเฉลี่ย {money(data.planningAssumptions.tuitionPerTerm)} บาท/เทอม และ {data.planningAssumptions.termsInProgram} เทอมตลอดหลักสูตร
                    </p>
                </article>
            </section>

            <section className="data-table-container tcas-table-section">
                <div className="data-table-header">
                    <span className="data-table-title">เกณฑ์และแผนรับรอบ 3 ปี 2569</span>
                    <span className="status-badge normal">official public</span>
                </div>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>สาขา</th>
                            <th>จำนวนรับ</th>
                            <th>GPAX ขั้นต่ำ</th>
                            <th>วิชาที่ควรสื่อสารกับผู้สมัคร</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.round3Plan2569.map(item => (
                            <tr key={item.major}>
                                <td>
                                    <strong>{item.major}</strong>
                                    {item.note && <small>{item.note}</small>}
                                </td>
                                <td>{item.plan}</td>
                                <td>{item.minGpax.toFixed(2)}</td>
                                <td>{item.subjectFocus}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            <section className="tcas-outlook-grid">
                {data.majorOutlook.map(item => (
                    <article key={item.major} className="tcas-outlook-card">
                        <div>
                            <strong>{item.major}</strong>
                            <span>{item.risk}</span>
                        </div>
                        <div className="tcas-demand-meter">
                            <span style={{ width: `${item.demandIndex}%` }} />
                        </div>
                        <p>{item.nextAction}</p>
                        <em>เป้าหมาย 2570: {item.target2570} คน</em>
                    </article>
                ))}
            </section>

            <section className="tcas-next-step">
                <AlertTriangle size={18} />
                <span>
                    ขั้นถัดไปเมื่อนำไฟล์จากอาจารย์ผึ้งเข้ามา: map fields ปี, รอบ TCAS, สาขา, แผนรับ, สมัคร, ผ่าน, รายงานตัว, คงอยู่, ลาออก/หายไป, ค่าเทอม เพื่อให้กราฟนี้เป็นข้อมูลจริง 100%
                </span>
            </section>
        </div>
    );
}
