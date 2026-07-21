import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import AccessDenied from '../components/AccessDenied';
import { ArrowLeft, CreditCard, Info } from 'lucide-react';
import { Bar, Pie } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement,
    Title, Tooltip, Legend, ArcElement
} from 'chart.js';
import { themeAdaptorPlugin } from '../utils/chartTheme';
import ExportPDFButton from '../components/ExportPDFButton';
import ChartDrilldownModal from '../components/ChartDrilldownModal';
import { withChartDrilldown } from '../utils/chartDrilldown';
import useDashboardDataset from '../hooks/useDashboardDataset';
import MjuConnectedPagePanel from '../components/MjuConnectedPagePanel';
import { getMjuConnectedDataStatus } from '../services/mjuConnectedDataService';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, themeAdaptorPlugin);

const TUITION_BREAKDOWN_COLORS = [
    'var(--accent-teal)',
    'var(--accent-orange)',
    'var(--accent-blue)',
    'var(--accent-rose)',
    'var(--accent-purple)',
    'var(--text-secondary)',
    'var(--accent-cyan)',
    'var(--accent-rose)',
];

function toNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function money(value) {
    return `${Math.round(toNumber(value)).toLocaleString('th-TH')} บาท`;
}

function connectedMoney(value) {
    return value == null || value === '' ? '--' : money(value);
}

export default function TuitionPage() {
    const { user } = useAuth();
    const [drillDetail, setDrillDetail] = useState(null);
    const [consentAt, setConsentAt] = useState('');
    const { data: tuitionData } = useDashboardDataset('tuition');

    if (!canAccess(user?.role, 'tuition')) return <AccessDenied />;

    const showDetail = canAccess(user?.role, 'tuition_detail');
    const connectedUser = consentAt ? { ...user, mjuConsentGrantedAt: consentAt } : user;
    const financeConnection = getMjuConnectedDataStatus(connectedUser, 'finance');
    const officialMajors = Array.isArray(tuitionData.officialMajors) ? tuitionData.officialMajors : [];
    const facultyRows = Array.isArray(tuitionData.byFaculty) ? tuitionData.byFaculty : [];
    const isOfficialTuition = officialMajors.length > 0;
    const plannedStudents2570 = facultyRows.reduce((sum, item) => sum + toNumber(item.plannedStudents2570), 0);
    const totalAdditionalFee = officialMajors.reduce((sum, item) => sum + toNumber(item.totalAdditionalFee), 0);
    const tuitionPlanRows = (isOfficialTuition ? officialMajors : facultyRows).map(item => {
        const name = item.major || item.name;
        const fee = toNumber(item.newFee2570 ?? item.fee);
        const currentFee = toNumber(item.fee2567to2569 ?? item.currentFee ?? item.fee);
        const planned = toNumber(item.plannedStudents2570);
        const students2569 = toNumber(item.students2569);
        const projectedTermRevenue = fee * planned;
        return {
            ...item,
            name,
            fee,
            currentFee,
            plannedStudents2570: planned,
            students2569,
            projectedTermRevenue,
        };
    });
    const projectedTermRevenue2570 = tuitionPlanRows.reduce((sum, item) => sum + toNumber(item.projectedTermRevenue), 0);

    const barData = {
        labels: facultyRows.map(f => f.name),
        datasets: [{
            label: 'ค่าเทอม (บาท/เทอม)',
            data: facultyRows.map(f => f.fee),
            backgroundColor: facultyRows.map((_, i) => {
                const colors = ['color-mix(in srgb, var(--accent-purple) 70%, transparent)', 'color-mix(in srgb, var(--accent-success) 70%, transparent)', 'color-mix(in srgb, var(--accent-warning) 70%, transparent)', 'color-mix(in srgb, var(--accent-danger) 70%, transparent)', 'color-mix(in srgb, var(--accent-blue) 70%, transparent)', 'color-mix(in srgb, var(--accent-cyan) 70%, transparent)', 'color-mix(in srgb, var(--accent-pink) 70%, transparent)', 'color-mix(in srgb, var(--accent-purple) 70%, transparent)', 'color-mix(in srgb, var(--accent-teal) 70%, transparent)', 'color-mix(in srgb, var(--accent-orange) 70%, transparent)', 'color-mix(in srgb, var(--accent-purple) 70%, transparent)', 'color-mix(in srgb, var(--text-subtle) 70%, transparent)'];
                return colors[i % colors.length];
            }),
            borderColor: facultyRows.map((_, i) => {
                const colors = ['var(--accent-purple)', 'var(--accent-success)', 'var(--accent-warning)', 'var(--accent-danger)', 'var(--accent-blue)', 'var(--accent-cyan)', 'var(--accent-pink)', 'var(--accent-purple)', 'var(--accent-teal)', 'var(--accent-orange)', 'var(--accent-purple)', 'var(--text-subtle)'];
                return colors[i % colors.length];
            }),
            borderWidth: 1,
            borderRadius: 6,
        }]
    };

    const barOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (ctx) => `${ctx.parsed.y.toLocaleString()} บาท`
                }
            }
        },
        scales: {
            x: {
                ticks: { color: 'var(--chart-muted)', font: { size: 11 } },
                grid: { display: false }
            },
            y: {
                ticks: {
                    color: 'var(--chart-muted)',
                    callback: (v) => v.toLocaleString()
                },
                grid: { color: 'var(--chart-grid)' }
            }
        }
    };

    const pieData = {
        labels: tuitionData.breakdown.map(b => b.label),
        datasets: [{
            data: tuitionData.breakdown.map(b => b.value),
            backgroundColor: tuitionData.breakdown.map((_, index) => TUITION_BREAKDOWN_COLORS[index % TUITION_BREAKDOWN_COLORS.length]),
            borderWidth: 1,
            spacing: 1,
            hoverOffset: 6,
        }]
    };

    const pieOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: { color: 'var(--chart-muted)', padding: 16, font: { size: 12 } }
            },
            tooltip: {
                callbacks: {
                    label: (ctx) => `${ctx.label}: ${ctx.parsed}%`
                }
            }
        }
    };

    const tuitionColumns = [
        { key: 'name', label: 'รายการ' },
        { key: 'fee', label: 'ค่าเทอม/เทอม', align: 'right' },
        { key: 'entryFee', label: isOfficialTuition ? 'แผนรับ 2570' : 'แรกเข้าโดยประมาณ', align: 'right' },
        { key: 'totalCost', label: isOfficialTuition ? 'รายการสมทบ/พื้นฐาน' : 'ตลอดหลักสูตรโดยประมาณ', align: 'right' },
    ];

    const breakdownColumns = [
        { key: 'label', label: 'หมวดค่าใช้จ่าย' },
        { key: 'value', label: 'สัดส่วน', align: 'right' },
        { key: 'estimatedAmount', label: 'ประมาณการต่อเทอม', align: 'right' },
    ];

    const barDrilldownOptions = withChartDrilldown(barOptions, barData, setDrillDetail, (point) => {
        const faculty = facultyRows[point.index];
        if (!faculty) return null;
        const avgEntryFee = Math.round((tuitionData.entryFee.min + tuitionData.entryFee.max) / 2);
        return {
            title: `${isOfficialTuition ? 'ค่าธรรมเนียมหลักสูตร' : 'ค่าเทอม'}${faculty.name}`,
            subtitle: isOfficialTuition ? 'ข้อมูลจากไฟล์ประมาณการปี 2570' : 'เปรียบเทียบค่าเทอมรายคณะ',
            valueLabel: 'ค่าเทอม/เทอม',
            value: faculty.fee,
            unit: 'บาท',
            accentColor: point.color,
            rows: [{
                name: faculty.name,
                fee: `${faculty.fee.toLocaleString('th-TH')} บาท`,
                entryFee: isOfficialTuition ? `${Number(faculty.plannedStudents2570 || 0).toLocaleString('th-TH')} คน` : `${avgEntryFee.toLocaleString('th-TH')} บาท`,
                totalCost: isOfficialTuition ? `${Number(faculty.totalAdditionalFee || 0).toLocaleString('th-TH')} บาท` : `${(faculty.fee * 8 + avgEntryFee).toLocaleString('th-TH')} บาท`,
            }],
            columns: tuitionColumns,
            note: isOfficialTuition ? 'ค่าธรรมเนียมและแผนรับมาจากไฟล์คำนวณประมาณการปี 2570' : 'คำนวณจากค่าเทอมเหมาจ่ายและค่าธรรมเนียมแรกเข้าในระบบ',
        };
    });

    const pieDrilldownOptions = withChartDrilldown(pieOptions, pieData, setDrillDetail, (point) => {
        const item = tuitionData.breakdown[point.index];
        if (!item) return null;
        const avgFee = Math.round((tuitionData.flatRate.min + tuitionData.flatRate.max) / 2);
        return {
            title: `รายละเอียด${item.label}`,
            subtitle: 'สัดส่วนค่าใช้จ่ายต่อเทอม',
            valueLabel: 'สัดส่วน',
            value: item.value,
            unit: '%',
            accentColor: point.color || item.color,
            rows: [{
                label: item.label,
                value: `${item.value}%`,
                estimatedAmount: `${Math.round(avgFee * item.value / 100).toLocaleString('th-TH')} บาท`,
            }],
            columns: breakdownColumns,
            note: 'ยอดประมาณการใช้ค่าเฉลี่ยของช่วงค่าเทอมเหมาจ่ายในระบบ',
        };
    });

    return (
        <div>
            <ChartDrilldownModal detail={drillDetail} onClose={() => setDrillDetail(null)} />
            <Link to="/dashboard" className="back-button">
                <ArrowLeft size={16} /> กลับหน้าหลัก
            </Link>

            <div className="section-header">
                <div className="section-header-icon" style={{ background: 'linear-gradient(135deg, var(--accent-success-deep), var(--accent-success))' }}>
                    <CreditCard size={22} color="var(--text-on-accent)" />
                </div>
                <div>
                    <h2>ค่าธรรมเนียมการศึกษา</h2>
                    <p>{isOfficialTuition ? 'Tuition Fees — ข้อมูลจากไฟล์คำนวณประมาณการปี 2570' : 'Tuition Fees — ระบบเหมาจ่าย (Flat Rate)'}</p>
                </div>
                <div className="section-header-actions">
                    <ExportPDFButton title="ค่าธรรมเนียมการศึกษา" />
                </div>
            </div>

            {user?.mjuVerified && (
                <>
                    <MjuConnectedPagePanel
                        user={connectedUser}
                        compact
                        domainIds={['profile', 'finance']}
                        onConsentGranted={setConsentAt}
                    />
                    {financeConnection.data && (
                        <section className="stats-grid mju-personal-summary-grid" aria-label="ข้อมูลค่าธรรมเนียมของฉันจาก MJU">
                            <article className="stat-card">
                                <div className="stat-card-value">{connectedMoney(financeConnection.data.tuitionAmount)}</div>
                                <div className="stat-card-label">ค่าธรรมเนียมของฉัน</div>
                            </article>
                            <article className="stat-card">
                                <div className="stat-card-value">{connectedMoney(financeConnection.data.outstandingAmount)}</div>
                                <div className="stat-card-label">ยอดค้างชำระ</div>
                            </article>
                            <article className="stat-card">
                                <div className="stat-card-value">{financeConnection.data.paymentStatus || '--'}</div>
                                <div className="stat-card-label">สถานะชำระเงิน</div>
                                <small>{financeConnection.data.lastPaymentDate ? `ชำระล่าสุด ${financeConnection.data.lastPaymentDate}` : financeConnection.message}</small>
                            </article>
                        </section>
                    )}
                </>
            )}

            {/* Info boxes */}
            <div className="stats-grid" style={{ marginBottom: 32 }}>
                <div className="stat-card animate-in">
                    <div className="stat-card-value highlight-value">
                        {tuitionData.flatRate.min.toLocaleString()} - {tuitionData.flatRate.max.toLocaleString()}
                    </div>
                    <div className="stat-card-label">บาท/เทอม (ค่าเทอมเหมาจ่าย)</div>
                </div>
                <div className="stat-card animate-in">
                    <div className="stat-card-value" style={{ color: 'var(--info)' }}>
                        {isOfficialTuition ? plannedStudents2570.toLocaleString() : `${tuitionData.entryFee.min.toLocaleString()} - ${tuitionData.entryFee.max.toLocaleString()}`}
                    </div>
                    <div className="stat-card-label">{isOfficialTuition ? 'คน — แผนนักศึกษาใหม่ปี 2570' : 'บาท (ค่าธรรมเนียมแรกเข้า)'}</div>
                </div>
                <div className="stat-card animate-in">
                    <div className="stat-card-value" style={{ color: 'var(--success)' }}>
                        {isOfficialTuition ? totalAdditionalFee.toLocaleString() : `${tuitionData.totalCost.min.toLocaleString()} - ${tuitionData.totalCost.max.toLocaleString()}`}
                    </div>
                    <div className="stat-card-label">{isOfficialTuition ? 'บาท — รายการสมทบ/รายวิชาพื้นฐานตามแผน' : 'บาท ตลอดหลักสูตร (4 ปี / 8 เทอม)'}</div>
                </div>
            </div>

            {/* Charts */}
            {showDetail && (
                <div className="charts-grid">
                    <div className="chart-card animate-in">
                        <div className="chart-card-header">
                            <div>
                                <div className="chart-card-title">{isOfficialTuition ? 'เปรียบเทียบค่าธรรมเนียมรายหลักสูตร' : 'เปรียบเทียบค่าเทอมแต่ละคณะ'}</div>
                                <div className="chart-card-subtitle">{isOfficialTuition ? 'บาท/คน/เทอม — แผนปี 2570' : 'บาท/เทอม — ภาคปกติ'}</div>
                            </div>
                        </div>
                        <div className="chart-container">
                            <Bar data={barData} options={barDrilldownOptions} />
                        </div>
                    </div>

                    <div className="chart-card animate-in">
                        <div className="chart-card-header">
                            <div>
                                <div className="chart-card-title">สัดส่วนค่าใช้จ่ายต่อเทอม</div>
                                <div className="chart-card-subtitle">แบ่งตามประเภทค่าธรรมเนียม</div>
                            </div>
                        </div>
                        <div className="chart-container">
                            <Pie data={pieData} options={pieDrilldownOptions} />
                        </div>
                    </div>
                </div>
            )}

            {showDetail && tuitionPlanRows.length > 0 && (
                <div className="data-table-container animate-in" style={{ marginTop: 24 }}>
                    <div className="data-table-header">
                        <span className="data-table-title">
                            {isOfficialTuition ? 'รายละเอียดค่าธรรมเนียมรายหลักสูตร ปี 2570' : 'รายละเอียดค่าธรรมเนียมรายคณะ'}
                        </span>
                        {isOfficialTuition && (
                            <span className="status-badge paid">
                                รายรับ/เทอมประมาณ {money(projectedTermRevenue2570)}
                            </span>
                        )}
                    </div>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>หลักสูตร/รายการ</th>
                                <th>ค่าธรรมเนียมปัจจุบัน</th>
                                <th>ค่าธรรมเนียมใหม่ 2570</th>
                                <th>นักศึกษา 2569</th>
                                <th>แผนรับ 2570</th>
                                <th>ประมาณรายรับ/เทอม</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tuitionPlanRows.map((row, index) => (
                                <tr key={`${row.name}-${index}`}>
                                    <td>{row.name}</td>
                                    <td>{money(row.currentFee)}</td>
                                    <td><strong>{money(row.fee)}</strong></td>
                                    <td>{row.students2569 ? `${row.students2569.toLocaleString('th-TH')} คน` : '-'}</td>
                                    <td>{row.plannedStudents2570 ? `${row.plannedStudents2570.toLocaleString('th-TH')} คน` : '-'}</td>
                                    <td>{row.projectedTermRevenue ? money(row.projectedTermRevenue) : '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Payment History */}
            {showDetail && (
                <div className="data-table-container animate-in">
                    <div className="data-table-header">
                        <span className="data-table-title">{isOfficialTuition ? 'ประมาณการรายรับตามเทอม' : 'ประวัติค่าเทอมแต่ละเทอม'}</span>
                    </div>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>เทอม</th>
                                <th>จำนวนเงิน</th>
                                <th>สถานะ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tuitionData.semesterHistory.map((s, i) => (
                                <tr key={i}>
                                    <td>{s.semester}</td>
                                    <td>{s.paid > 0 ? `${s.paid.toLocaleString()} บาท` : '-'}</td>
                                    <td>
                                        <span className={`status-badge ${s.status === 'จ่ายแล้ว' ? 'paid' : 'unpaid'}`}>
                                            {s.status === 'projection' ? 'ประมาณการ' : s.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <footer className="tuition-source-note" aria-label="แหล่งข้อมูลและหมายเหตุ">
                <Info size={14} aria-hidden="true" />
                <p>
                    <strong>{isOfficialTuition ? 'แหล่งข้อมูล:' : 'หมายเหตุ:'}</strong>{' '}
                    {isOfficialTuition
                        ? 'ไฟล์คำนวณประมาณการปี 70_Ver5.xlsx — ค่าธรรมเนียมใหม่ปี 2570 รายหลักสูตรของคณะวิทยาศาสตร์และแผนรับนักศึกษาในปีถัดไป'
                        : 'สาขาคอมพิวเตอร์อาจมีค่าบำรุงห้องปฏิบัติการรวมอยู่ด้วย และเทอมแรกอาจมีค่าธรรมเนียมแรกเข้าเพิ่มเติมประมาณ 2,000–3,000 บาท'}
                </p>
            </footer>
        </div>
    );
}
