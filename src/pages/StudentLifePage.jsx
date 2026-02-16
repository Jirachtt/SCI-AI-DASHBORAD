import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import AccessDenied from '../components/AccessDenied';
import { studentLifeData } from '../data/mockData';
import { ArrowLeft } from 'lucide-react';
import { Doughnut, Line } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
    Title, Tooltip, Legend, ArcElement, Filler
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler);

export default function StudentLifePage() {
    const { user } = useAuth();

    if (!canAccess(user?.role, 'student_life')) return <AccessDenied />;

    const showDetail = canAccess(user?.role, 'student_life_detail');

    const { activityHours, library, behaviorScore } = studentLifeData;
    const pct = Math.round((activityHours.completed / activityHours.target) * 100);

    const gaugeData = {
        labels: ['สำเร็จแล้ว', 'คงเหลือ'],
        datasets: [{
            data: [activityHours.completed, activityHours.target - activityHours.completed],
            backgroundColor: ['#00a651', 'rgba(255,255,255,0.05)'],
            borderWidth: 0,
            cutout: '75%',
        }]
    };

    const gaugeOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed} ชั่วโมง` }
            }
        }
    };

    const behaviorLineData = {
        labels: behaviorScore.history.map(h => h.semester),
        datasets: [{
            label: 'คะแนนความประพฤติ',
            data: behaviorScore.history.map(h => h.score),
            borderColor: '#C5A028',
            backgroundColor: 'rgba(197, 160, 40, 0.1)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#C5A028',
            pointRadius: 6,
            pointHoverRadius: 8,
        }]
    };

    const behaviorLineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
        },
        scales: {
            x: { ticks: { color: '#9ca3af' }, grid: { display: false } },
            y: {
                min: 70, max: 100,
                ticks: { color: '#9ca3af' },
                grid: { color: 'rgba(255,255,255,0.05)' }
            }
        }
    };

    return (
        <div>
            <Link to="/dashboard" className="back-button">
                <ArrowLeft size={16} /> กลับหน้าหลัก
            </Link>

            <div className="section-header">
                <div className="section-header-icon" style={{ background: 'linear-gradient(135deg, #A23B72, #7B2D8E)' }}>
                    🎯
                </div>
                <div>
                    <h2>กิจกรรมและพฤติกรรม</h2>
                    <p>Student Life & Activity</p>
                </div>
            </div>

            {/* Activity Hours + Behavior */}
            <div className="charts-grid">
                <div className="chart-card animate-in">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">ชั่วโมงกิจกรรม</div>
                            <div className="chart-card-subtitle">{activityHours.completed}/{activityHours.target} ชั่วโมง ({pct}%)</div>
                        </div>
                    </div>
                    <div className="chart-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                        <div style={{ width: '220px', height: '220px', position: 'relative' }}>
                            <Doughnut data={gaugeData} options={gaugeOptions} />
                            <div style={{
                                position: 'absolute', inset: 0,
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center',
                                pointerEvents: 'none'
                            }}>
                                <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--mju-green-light)' }}>{pct}%</span>
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{activityHours.completed}/{activityHours.target} ชม.</span>
                            </div>
                        </div>
                    </div>
                    {/* Activity breakdown */}
                    <div style={{ marginTop: 20 }}>
                        {activityHours.categories.map((cat, i) => (
                            <div key={i} className="progress-bar-container">
                                <div className="progress-bar-label">
                                    <span style={{ color: 'var(--text-secondary)' }}>{cat.name}</span>
                                    <span style={{ fontWeight: 600 }}>{cat.hours} ชม.</span>
                                </div>
                                <div className="progress-bar-track">
                                    <div className="progress-bar-fill" style={{
                                        width: `${(cat.hours / activityHours.target) * 100}%`,
                                        background: ['#006838', '#2E86AB', '#C5A028', '#A23B72'][i]
                                    }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {showDetail && (
                    <div className="chart-card animate-in">
                        <div className="chart-card-header">
                            <div>
                                <div className="chart-card-title">คะแนนความประพฤติ</div>
                                <div className="chart-card-subtitle">ปัจจุบัน: {behaviorScore.score}/{behaviorScore.maxScore}</div>
                            </div>
                            <span style={{
                                fontSize: '2rem', fontWeight: 700,
                                color: behaviorScore.score >= 90 ? 'var(--success)' : 'var(--warning)'
                            }}>
                                {behaviorScore.score}
                            </span>
                        </div>
                        <div className="chart-container">
                            <Line data={behaviorLineData} options={behaviorLineOptions} />
                        </div>
                    </div>
                )}
            </div>

            {/* Library */}
            <div className="data-table-container animate-in" style={{ marginTop: 8 }}>
                <div className="data-table-header">
                    <span className="data-table-title">📖 สถานะห้องสมุด</span>
                </div>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>ชื่อหนังสือ</th>
                            <th>วันยืม</th>
                            <th>กำหนดคืน</th>
                            <th>สถานะ</th>
                            <th>ค่าปรับ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {library.map((book, i) => (
                            <tr key={i}>
                                <td style={{ fontWeight: 500 }}>{book.title}</td>
                                <td>{book.borrowDate}</td>
                                <td>{book.dueDate}</td>
                                <td>
                                    <span className={`status-badge ${book.status === 'เกินกำหนด' ? 'overdue' :
                                            book.status === 'ใกล้กำหนด' ? 'due-soon' : 'normal'
                                        }`}>
                                        {book.status}
                                    </span>
                                </td>
                                <td style={{ color: book.fine > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                                    {book.fine > 0 ? `${book.fine} บาท` : '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
