import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import AccessDenied from '../components/AccessDenied';
import { ArrowLeft, DollarSign, ReceiptText } from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement,
    Title, Tooltip, Legend, ArcElement
} from 'chart.js';
import { themeAdaptorPlugin } from '../utils/chartTheme';
import ExportPDFButton from '../components/ExportPDFButton';
import ProductPageHeader from '../components/ProductPageHeader';
import ChartDrilldownModal from '../components/ChartDrilldownModal';
import { withChartDrilldown } from '../utils/chartDrilldown';
import useDashboardDataset from '../hooks/useDashboardDataset';
import { getStudentListSync } from '../services/studentDataService';
import {
    buildStudentPaymentLedgerDemo,
    summarizeStudentPaymentLedgerDemo,
} from '../data/featureCompletionFallbackData';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, themeAdaptorPlugin);

export default function FinancialPage() {
    const { user } = useAuth();
    const [drillDetail, setDrillDetail] = useState(null);
    const { data: financialData } = useDashboardDataset('financial');
    const paymentLedgerRows = (
        Array.isArray(financialData?.studentPayments) && financialData.studentPayments.length > 0
            ? financialData.studentPayments
            : buildStudentPaymentLedgerDemo(getStudentListSync(), { limit: 48 })
    );
    const paymentLedgerSummary = summarizeStudentPaymentLedgerDemo(paymentLedgerRows);

    if (!canAccess(user?.role, 'financial')) return <AccessDenied />;

    const showFacultyBudget = canAccess(user?.role, 'faculty_budget');
    const officialEstimate = financialData.officialEstimate;

    const budgetDoughnutData = showFacultyBudget ? {
        labels: financialData.facultyBudget.categories.map(c => c.name),
        datasets: [{
            data: financialData.facultyBudget.categories.map(c => c.amount),
            backgroundColor: ['var(--accent-success)', 'var(--accent-warning)', 'var(--accent-blue)', 'var(--accent-purple)', 'var(--accent-pink)'],
            borderWidth: 0,
        }]
    } : null;

    const budgetColumns = [
        { key: 'name', label: 'หมวดงบประมาณ' },
        { key: 'amount', label: 'จำนวนเงิน', align: 'right' },
        { key: 'percent', label: 'สัดส่วนของงบใช้ไป', align: 'right' },
    ];

    const budgetDoughnutOptions = withChartDrilldown({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { color: 'var(--chart-muted)', padding: 12, font: { size: 11 } } },
            tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${(ctx.parsed / 1000000).toFixed(1)}M บาท` } }
        }
    }, budgetDoughnutData, setDrillDetail, (point) => {
        const category = financialData.facultyBudget.categories[point.index];
        if (!category) return null;
        return {
            title: `รายละเอียดงบคณะ: ${category.name}`,
            subtitle: 'งบประมาณคณะตามหมวดรายจ่าย',
            valueLabel: 'จำนวนเงิน',
            value: category.amount,
            unit: 'บาท',
            accentColor: point.color,
            rows: financialData.facultyBudget.categories.map(item => ({
                name: item.name,
                amount: `${item.amount.toLocaleString('th-TH')} บาท`,
                percent: `${((item.amount / financialData.facultyBudget.spent) * 100).toFixed(1)}%`,
            })),
            columns: budgetColumns,
            metrics: [
                { label: 'งบทั้งหมด', value: financialData.facultyBudget.totalBudget, unit: 'บาท' },
                { label: 'ใช้ไป', value: financialData.facultyBudget.spent, unit: 'บาท' },
                { label: 'คงเหลือ', value: financialData.facultyBudget.remaining, unit: 'บาท' },
            ],
            note: 'สัดส่วนคำนวณจากยอดใช้ไปของงบคณะ',
        };
    });

    return (
        <div>
            <ChartDrilldownModal detail={drillDetail} onClose={() => setDrillDetail(null)} />
            <Link to="/dashboard" className="back-button">
                <ArrowLeft size={16} /> กลับหน้าหลัก
            </Link>

            <ProductPageHeader
                icon={DollarSign}
                eyebrow="FINANCIAL OPERATIONS"
                title="การเงินและงานทะเบียน"
                subtitle="ภาพรวมรายรับ ภาระการชำระ และข้อมูลประกอบการบริหาร"
                tone="amber"
                actions={<ExportPDFButton title="การเงินและงานทะเบียน" />}
            />

            {/* Current Status */}
            <div className="stats-grid">
                {officialEstimate ? (
                    <>
                        <div className="stat-card animate-in">
                            <div className="stat-card-value" style={{ color: 'var(--success)' }}>
                                {officialEstimate.totalTuitionRevenue.toLocaleString()}
                            </div>
                            <div className="stat-card-label">บาท — รายรับค่าธรรมเนียมรวม ปีงบ {officialEstimate.fiscalYear}</div>
                        </div>
                        <div className="stat-card animate-in">
                            <div className="stat-card-value" style={{ color: 'var(--info)' }}>
                                {officialEstimate.revenueAfterRisk.toLocaleString()}
                            </div>
                            <div className="stat-card-label">บาท — รายรับหลังกันความเสี่ยง</div>
                        </div>
                        <div className="stat-card animate-in">
                            <div className="stat-card-value highlight-value">
                                {officialEstimate.surplus.toLocaleString()}
                            </div>
                            <div className="stat-card-label">บาท — ส่วนต่างหลังแผนรายจ่ายคณะ</div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="stat-card animate-in">
                            <div className="stat-card-value" style={{ color: 'var(--danger)' }}>
                                {financialData.tuitionStatus.current.amount.toLocaleString()}
                            </div>
                            <div className="stat-card-label">บาท — ค่าเทอมค้างชำระ (1/2568)</div>
                        </div>
                        <div className="stat-card animate-in">
                            <div className="stat-card-value" style={{ color: 'var(--success)' }}>
                                {financialData.tuitionStatus.total.totalPaid.toLocaleString()}
                            </div>
                            <div className="stat-card-label">บาท — จ่ายแล้วทั้งหมด</div>
                        </div>
                        <div className="stat-card animate-in">
                            <div className="stat-card-value highlight-value">
                                {financialData.tuitionStatus.total.totalRemaining.toLocaleString()}
                            </div>
                            <div className="stat-card-label">บาท — คงเหลือตลอดหลักสูตร</div>
                        </div>
                    </>
                )}
            </div>

            {officialEstimate ? (
                <div className="info-box animate-in">
                    <h3>ข้อมูลจากไฟล์ประมาณการปี 2570</h3>
                    <div className="info-item">
                        <span className="info-item-label">จำนวนนักศึกษาที่ใช้คำนวณ</span>
                        <span className="info-item-value">{officialEstimate.students.toLocaleString('th-TH')} คน</span>
                    </div>
                    <div className="info-item">
                        <span className="info-item-label">รายจ่ายคณะตามแผน</span>
                        <span className="info-item-value highlight-value">{officialEstimate.expense.toLocaleString('th-TH')} บาท</span>
                    </div>
                    <div className="info-item">
                        <span className="info-item-label">เทอมที่รวมในปีงบประมาณ</span>
                        <span className="info-item-value">{officialEstimate.terms.map(item => item.semester).join(', ')}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-item-label">หมายเหตุ</span>
                        <span className="info-item-value" style={{ fontSize: '0.85rem' }}>
                            สรุปสถานะแหล่งข้อมูลรายคนและรายการที่ต้องเชื่อมต่อเพิ่ม ดูได้ที่ Admin / Auto Sync
                        </span>
                    </div>
                </div>
            ) : (
                <div className="info-box animate-in">
                    <h3>ทุนการศึกษา</h3>
                    <div className="info-item">
                        <span className="info-item-label">ชื่อทุน</span>
                        <span className="info-item-value">{financialData.scholarship.name}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-item-label">จำนวนเงิน</span>
                        <span className="info-item-value highlight-value">{financialData.scholarship.amount.toLocaleString()} บาท</span>
                    </div>
                    <div className="info-item">
                        <span className="info-item-label">สถานะ</span>
                        <span className="status-badge approved">{financialData.scholarship.status}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-item-label">เงื่อนไข</span>
                        <span className="info-item-value" style={{ fontSize: '0.85rem' }}>{financialData.scholarship.conditions}</span>
                    </div>
                </div>
            )}

            <div className="chart-card animate-in" style={{ marginTop: 24 }}>
                <div className="chart-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="stat-card-icon" style={{ background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-gold))' }}>
                            <ReceiptText size={18} color="var(--text-on-accent)" />
                        </div>
                        <div>
                            <div className="chart-card-title">ทะเบียนค่าธรรมเนียมรายคน</div>
                            <div className="chart-card-subtitle">ติดตามค้างชำระ จ่ายล่าช้า วันที่กำหนดชำระ และวันที่ชำระจริง</div>
                        </div>
                    </div>
                </div>

                <div className="stats-grid" style={{ marginBottom: 16 }}>
                    <div className="stat-card">
                        <div className="stat-card-value">{paymentLedgerSummary.totalRows.toLocaleString('th-TH')}</div>
                        <div className="stat-card-label">รายการชำระที่ระบบมี</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-value" style={{ color: 'var(--danger)' }}>{paymentLedgerSummary.overdue.toLocaleString('th-TH')}</div>
                        <div className="stat-card-label">ค้างชำระ</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-value" style={{ color: 'var(--warning)' }}>{paymentLedgerSummary.late.toLocaleString('th-TH')}</div>
                        <div className="stat-card-label">จ่ายล่าช้า</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-value">{paymentLedgerSummary.totalRemaining.toLocaleString('th-TH')}</div>
                        <div className="stat-card-label">ยอดคงค้าง (บาท)</div>
                    </div>
                </div>

                <div className="data-table-container" style={{ marginTop: 0 }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>รหัส</th>
                                <th>สาขา</th>
                                <th>ชั้นปี</th>
                                <th>ภาคเรียน</th>
                                <th>สถานะ</th>
                                <th>กำหนดชำระ</th>
                                <th>วันที่ชำระจริง</th>
                                <th style={{ textAlign: 'right' }}>คงค้าง</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paymentLedgerRows.slice(0, 12).map(row => (
                                <tr key={row.studentId}>
                                    <td>{row.studentId}</td>
                                    <td>{row.major}</td>
                                    <td>ปี {row.year}</td>
                                    <td>{row.semester}</td>
                                    <td>
                                        <span className={`status-badge ${row.status === 'paid' ? 'approved' : row.status === 'late' ? 'warning' : 'rejected'}`}>
                                            {row.statusLabel}
                                        </span>
                                    </td>
                                    <td>{row.dueDate}</td>
                                    <td>{row.paidAt || '-'}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{row.remaining.toLocaleString('th-TH')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Charts */}
            {showFacultyBudget && budgetDoughnutData && (
                <div className="charts-grid">
                    <div className="chart-card animate-in">
                        <div className="chart-card-header">
                            <div>
                                <div className="chart-card-title">{officialEstimate ? 'แผนรายจ่ายคณะ ปีงบ 2570' : 'งบประมาณคณะ'}</div>
                                <div className="chart-card-subtitle">
                                    {officialEstimate
                                        ? `รวม ${(financialData.facultyBudget.totalBudget / 1000000).toFixed(1)}M บาท จากไฟล์ประมาณการ`
                                        : `ใช้ไป ${(financialData.facultyBudget.spent / 1000000).toFixed(1)}M / ${(financialData.facultyBudget.totalBudget / 1000000).toFixed(1)}M บาท`}
                                </div>
                            </div>
                        </div>
                        <div className="chart-container">
                            <Doughnut data={budgetDoughnutData} options={budgetDoughnutOptions} />
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
