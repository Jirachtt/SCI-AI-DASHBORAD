import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import AccessDenied from '../components/AccessDenied';
import { tuitionData } from '../data/mockData';
import { ArrowLeft, CreditCard } from 'lucide-react';
import { Bar, Pie } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement,
    Title, Tooltip, Legend, ArcElement
} from 'chart.js';
import { themeAdaptorPlugin } from '../utils/chartTheme';
import ExportPDFButton from '../components/ExportPDFButton';
import ChartDrilldownModal from '../components/ChartDrilldownModal';
import { withChartDrilldown } from '../utils/chartDrilldown';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, themeAdaptorPlugin);

export default function TuitionPage() {
    const { user } = useAuth();
    const [drillDetail, setDrillDetail] = useState(null);

    if (!canAccess(user?.role, 'tuition')) return <AccessDenied />;

    const showDetail = canAccess(user?.role, 'tuition_detail');

    const barData = {
        labels: tuitionData.byFaculty.map(f => f.name),
        datasets: [{
            label: 'ค่าเทอม (บาท/เทอม)',
            data: tuitionData.byFaculty.map(f => f.fee),
            backgroundColor: tuitionData.byFaculty.map((_, i) => {
                const colors = ['rgba(123, 104, 238, 0.7)', 'rgba(34, 197, 94, 0.7)', 'rgba(245, 158, 11, 0.7)', 'rgba(239, 68, 68, 0.7)', 'rgba(59, 130, 246, 0.7)', 'rgba(6, 182, 212, 0.7)', 'rgba(236, 72, 153, 0.7)', 'rgba(139, 92, 246, 0.7)', 'rgba(20, 184, 166, 0.7)', 'rgba(249, 115, 22, 0.7)', 'rgba(168, 85, 247, 0.7)', 'rgba(100, 116, 139, 0.7)'];
                return colors[i % colors.length];
            }),
            borderColor: tuitionData.byFaculty.map((_, i) => {
                const colors = ['#7B68EE', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#06b6d4', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#a855f7', '#64748b'];
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
                ticks: { color: '#9ca3af', font: { size: 11 } },
                grid: { display: false }
            },
            y: {
                ticks: {
                    color: '#9ca3af',
                    callback: (v) => v.toLocaleString()
                },
                grid: { color: 'rgba(255,255,255,0.05)' }
            }
        }
    };

    const pieData = {
        labels: tuitionData.breakdown.map(b => b.label),
        datasets: [{
            data: tuitionData.breakdown.map(b => b.value),
            backgroundColor: ['#22c55e', '#f59e0b', '#3b82f6', '#8b5cf6', '#f97316', '#ec4899'],
            borderWidth: 0,
        }]
    };

    const pieOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: { color: '#9ca3af', padding: 16, font: { size: 12 } }
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
        { key: 'entryFee', label: 'แรกเข้าโดยประมาณ', align: 'right' },
        { key: 'totalCost', label: 'ตลอดหลักสูตรโดยประมาณ', align: 'right' },
    ];

    const breakdownColumns = [
        { key: 'label', label: 'หมวดค่าใช้จ่าย' },
        { key: 'value', label: 'สัดส่วน', align: 'right' },
        { key: 'estimatedAmount', label: 'ประมาณการต่อเทอม', align: 'right' },
    ];

    const barDrilldownOptions = withChartDrilldown(barOptions, barData, setDrillDetail, (point) => {
        const faculty = tuitionData.byFaculty[point.index];
        if (!faculty) return null;
        const avgEntryFee = Math.round((tuitionData.entryFee.min + tuitionData.entryFee.max) / 2);
        return {
            title: `ค่าเทอม${faculty.name}`,
            subtitle: 'เปรียบเทียบค่าเทอมรายคณะ',
            valueLabel: 'ค่าเทอม/เทอม',
            value: faculty.fee,
            unit: 'บาท',
            accentColor: point.color,
            rows: [{
                name: faculty.name,
                fee: `${faculty.fee.toLocaleString('th-TH')} บาท`,
                entryFee: `${avgEntryFee.toLocaleString('th-TH')} บาท`,
                totalCost: `${(faculty.fee * 8 + avgEntryFee).toLocaleString('th-TH')} บาท`,
            }],
            columns: tuitionColumns,
            note: 'คำนวณจากค่าเทอมเหมาจ่ายและค่าธรรมเนียมแรกเข้าในระบบ',
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
                <div className="section-header-icon" style={{ background: 'linear-gradient(135deg, #006838, #00a651)' }}>
                    <CreditCard size={22} color="#fff" />
                </div>
                <div>
                    <h2>ค่าธรรมเนียมการศึกษา</h2>
                    <p>Tuition Fees — ระบบเหมาจ่าย (Flat Rate)</p>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                    <ExportPDFButton title="ค่าธรรมเนียมการศึกษา" />
                </div>
            </div>

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
                        {tuitionData.entryFee.min.toLocaleString()} - {tuitionData.entryFee.max.toLocaleString()}
                    </div>
                    <div className="stat-card-label">บาท (ค่าธรรมเนียมแรกเข้า)</div>
                </div>
                <div className="stat-card animate-in">
                    <div className="stat-card-value" style={{ color: 'var(--success)' }}>
                        {tuitionData.totalCost.min.toLocaleString()} - {tuitionData.totalCost.max.toLocaleString()}
                    </div>
                    <div className="stat-card-label">บาท ตลอดหลักสูตร (4 ปี / 8 เทอม)</div>
                </div>
            </div>

            {/* Note */}
            <div className="info-box">
                <h3>หมายเหตุ</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.7 }}>
                    สาขาคอมพิวเตอร์มักจะมีค่าบำรุงห้องปฏิบัติการ (Lab) รวมอยู่ด้วย ทำให้สูงกว่าสาขาวิทย์ทั่วไปเล็กน้อย
                    ค่าธรรมเนียมแรกเข้า (ปี 1 เทอม 1) บวกเพิ่มประมาณ 2,000 - 3,000 บาท (ค่าขึ้นทะเบียนนักศึกษา, ค่าบัตร ฯลฯ)
                </p>
            </div>

            {/* Charts */}
            {showDetail && (
                <div className="charts-grid">
                    <div className="chart-card animate-in">
                        <div className="chart-card-header">
                            <div>
                                <div className="chart-card-title">เปรียบเทียบค่าเทอมแต่ละคณะ</div>
                                <div className="chart-card-subtitle">บาท/เทอม — ภาคปกติ</div>
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

            {/* Payment History */}
            {showDetail && (
                <div className="data-table-container animate-in">
                    <div className="data-table-header">
                        <span className="data-table-title">ประวัติค่าเทอมแต่ละเทอม</span>
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
                                            {s.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
