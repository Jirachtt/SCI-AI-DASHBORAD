import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import AccessDenied from '../components/AccessDenied';
import { financialData } from '../data/mockData';
import { ArrowLeft } from 'lucide-react';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement,
    Title, Tooltip, Legend, ArcElement
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

export default function FinancialPage() {
    const { user } = useAuth();

    if (!canAccess(user?.role, 'financial')) return <AccessDenied />;

    const showDetail = canAccess(user?.role, 'financial_detail');
    const showFacultyBudget = canAccess(user?.role, 'faculty_budget');

    const paymentBarData = {
        labels: financialData.paymentHistory.map(p => p.semester),
        datasets: [{
            label: 'ค่าเทอมที่จ่าย (บาท)',
            data: financialData.paymentHistory.map(p => p.amount),
            backgroundColor: 'rgba(0, 104, 56, 0.7)',
            borderColor: '#006838',
            borderWidth: 1,
            borderRadius: 6,
        }]
    };

    const paymentBarOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y.toLocaleString()} บาท` } }
        },
        scales: {
            x: { ticks: { color: '#9ca3af' }, grid: { display: false } },
            y: {
                ticks: { color: '#9ca3af', callback: (v) => v.toLocaleString() },
                grid: { color: 'rgba(255,255,255,0.05)' }
            }
        }
    };

    const budgetDoughnutData = showFacultyBudget ? {
        labels: financialData.facultyBudget.categories.map(c => c.name),
        datasets: [{
            data: financialData.facultyBudget.categories.map(c => c.amount),
            backgroundColor: ['#006838', '#C5A028', '#2E86AB', '#A23B72', '#F18F01'],
            borderWidth: 0,
        }]
    } : null;

    return (
        <div>
            <Link to="/dashboard" className="back-button">
                <ArrowLeft size={16} /> กลับหน้าหลัก
            </Link>

            <div className="section-header">
                <div className="section-header-icon" style={{ background: 'linear-gradient(135deg, #C5A028, #9a7d1e)' }}>
                    🏦
                </div>
                <div>
                    <h2>การเงินและงานทะเบียน</h2>
                    <p>Financial & Administrative</p>
                </div>
            </div>

            {/* Current Status */}
            <div className="stats-grid">
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
            </div>

            {/* Scholarship */}
            <div className="info-box animate-in">
                <h3>🎓 ทุนการศึกษา</h3>
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

            {/* Charts */}
            {showDetail && (
                <div className="charts-grid">
                    <div className="chart-card animate-in">
                        <div className="chart-card-header">
                            <div>
                                <div className="chart-card-title">ประวัติการจ่ายค่าเทอม</div>
                                <div className="chart-card-subtitle">บาท/เทอม</div>
                            </div>
                        </div>
                        <div className="chart-container">
                            <Bar data={paymentBarData} options={paymentBarOptions} />
                        </div>
                    </div>

                    {showFacultyBudget && budgetDoughnutData && (
                        <div className="chart-card animate-in">
                            <div className="chart-card-header">
                                <div>
                                    <div className="chart-card-title">งบประมาณคณะ</div>
                                    <div className="chart-card-subtitle">
                                        ใช้ไป {(financialData.facultyBudget.spent / 1000000).toFixed(1)}M / {(financialData.facultyBudget.totalBudget / 1000000).toFixed(1)}M บาท
                                    </div>
                                </div>
                            </div>
                            <div className="chart-container">
                                <Doughnut data={budgetDoughnutData} options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 12, font: { size: 11 } } },
                                        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${(ctx.parsed / 1000000).toFixed(1)}M บาท` } }
                                    }
                                }} />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Requests Table */}
            <div className="data-table-container animate-in" style={{ marginTop: showDetail ? 0 : 24 }}>
                <div className="data-table-header">
                    <span className="data-table-title">📄 สถานะคำร้อง</span>
                </div>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>รหัสคำร้อง</th>
                            <th>ประเภท</th>
                            <th>วันที่ยื่น</th>
                            <th>สถานะ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {financialData.requests.map((req, i) => (
                            <tr key={i}>
                                <td style={{ fontWeight: 600 }}>{req.id}</td>
                                <td>{req.type}</td>
                                <td>{req.date}</td>
                                <td>
                                    <span className={`status-badge ${req.status === 'อนุมัติแล้ว' ? 'approved' :
                                            req.status === 'รออนุมัติ' ? 'pending' : 'docs-needed'
                                        }`}>
                                        {req.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Payment History */}
            {showDetail && (
                <div className="data-table-container animate-in">
                    <div className="data-table-header">
                        <span className="data-table-title">💳 ประวัติการชำระเงิน</span>
                    </div>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>เทอม</th>
                                <th>จำนวน</th>
                                <th>วันที่จ่าย</th>
                                <th>วิธีชำระ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {financialData.paymentHistory.map((p, i) => (
                                <tr key={i}>
                                    <td>{p.semester}</td>
                                    <td style={{ fontWeight: 600 }}>{p.amount.toLocaleString()} บาท</td>
                                    <td>{p.date}</td>
                                    <td>{p.method}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
