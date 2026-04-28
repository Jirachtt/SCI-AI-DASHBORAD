import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import AccessDenied from '../components/AccessDenied';
import { ArrowLeft, Users } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
    Title, Tooltip, Legend, Filler
} from 'chart.js';
import { themeAdaptorPlugin } from '../utils/chartTheme';
import ExportPDFButton from '../components/ExportPDFButton';
import ChartDrilldownModal from '../components/ChartDrilldownModal';
import { withChartDrilldown } from '../utils/chartDrilldown';
import useDashboardDataset from '../hooks/useDashboardDataset';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, themeAdaptorPlugin);

export default function StudentLifePage() {
    const { user } = useAuth();
    const [drillDetail, setDrillDetail] = useState(null);
    const { data: studentLifeData } = useDashboardDataset('student_life');

    if (!canAccess(user?.role, 'student_life')) return <AccessDenied />;

    const showDetail = canAccess(user?.role, 'student_life_detail');

    const { activityHours, library, behaviorScore } = studentLifeData;
    const pct = Math.round((activityHours.completed / activityHours.target) * 100);
    const remainingHours = Math.max(activityHours.target - activityHours.completed, 0);
    const overallPct = Math.min(100, pct);
    const completedCategoryTotal = activityHours.categories.reduce((sum, cat) => sum + cat.hours, 0);
    const activityPalette = [
        { color: '#2563EB', soft: 'rgba(37, 99, 235, 0.14)' },
        { color: '#D97706', soft: 'rgba(217, 119, 6, 0.16)' },
        { color: '#7C3AED', soft: 'rgba(124, 58, 237, 0.14)' },
        { color: '#DB2777', soft: 'rgba(219, 39, 119, 0.14)' },
    ];
    const activityBreakdown = activityHours.categories.map((cat, index) => ({
        ...cat,
        color: activityPalette[index % activityPalette.length].color,
        soft: activityPalette[index % activityPalette.length].soft,
        targetPercent: Math.round((cat.hours / activityHours.target) * 100),
        completedShare: completedCategoryTotal > 0 ? Math.round((cat.hours / completedCategoryTotal) * 100) : 0,
    }));

    const behaviorLineData = {
        labels: behaviorScore.history.map(h => h.semester),
        datasets: [{
            label: 'คะแนนความประพฤติ',
            data: behaviorScore.history.map(h => h.score),
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#f59e0b',
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

    const activityColumns = [
        { key: 'name', label: 'หมวดกิจกรรม' },
        { key: 'hours', label: 'ชั่วโมง', align: 'right' },
        { key: 'percent', label: 'คิดเป็น', align: 'right' },
    ];

    const behaviorColumns = [
        { key: 'semester', label: 'ภาคเรียน' },
        { key: 'score', label: 'คะแนน', align: 'right' },
        { key: 'status', label: 'สถานะ' },
    ];

    const openActivityDetail = (selectedCategory = null) => setDrillDetail({
        title: selectedCategory ? `รายละเอียดกิจกรรม: ${selectedCategory.name}` : 'รายละเอียดชั่วโมงกิจกรรม',
        subtitle: `${activityHours.completed}/${activityHours.target} ชั่วโมง (${overallPct}%)`,
        valueLabel: selectedCategory ? selectedCategory.name : 'ทำแล้วทั้งหมด',
        value: selectedCategory ? selectedCategory.hours : activityHours.completed,
        unit: 'ชั่วโมง',
        accentColor: selectedCategory?.color || '#16A34A',
        summary: selectedCategory
            ? `${selectedCategory.name} ${selectedCategory.hours.toLocaleString('th-TH')} ชั่วโมง คิดเป็น ${selectedCategory.completedShare}% ของชั่วโมงที่ทำแล้ว`
            : `ทำแล้ว ${activityHours.completed.toLocaleString('th-TH')} ชั่วโมง เหลือ ${remainingHours.toLocaleString('th-TH')} ชั่วโมง จากเป้าหมาย ${activityHours.target.toLocaleString('th-TH')} ชั่วโมง`,
        rows: activityBreakdown.map(cat => ({
            name: cat.name,
            hours: cat.hours,
            percent: `${cat.targetPercent}% ของเป้าหมายรวม`,
        })),
        columns: activityColumns,
        note: 'แยกตามหมวดกิจกรรมที่บันทึกไว้ในระบบ',
    });

    const behaviorDrilldownOptions = withChartDrilldown(behaviorLineOptions, behaviorLineData, setDrillDetail, (point) => {
        const row = behaviorScore.history[point.index];
        if (!row) return null;
        return {
            title: `คะแนนความประพฤติ ${row.semester}`,
            subtitle: 'แนวโน้มคะแนนความประพฤติรายภาคเรียน',
            valueLabel: 'คะแนน',
            value: row.score,
            unit: `จาก ${behaviorScore.maxScore}`,
            accentColor: point.color,
            rows: behaviorScore.history.map(item => ({
                semester: item.semester,
                score: item.score,
                status: item.score >= 90 ? 'ดีมาก' : item.score >= 80 ? 'ดี' : 'ต้องติดตาม',
            })),
            columns: behaviorColumns,
            note: 'คลิกจุดแต่ละภาคเรียนเพื่อดูบริบทคะแนนย้อนหลังทั้งหมด',
        };
    });

    return (
        <div>
            <ChartDrilldownModal detail={drillDetail} onClose={() => setDrillDetail(null)} />
            <Link to="/dashboard" className="back-button">
                <ArrowLeft size={16} /> กลับหน้าหลัก
            </Link>

            <div className="section-header">
                <div className="section-header-icon" style={{ background: 'linear-gradient(135deg, #A23B72, #7B2D8E)' }}>
                    <Users size={22} color="#fff" />
                </div>
                <div>
                    <h2>กิจกรรมและพฤติกรรม</h2>
                    <p>Student Life & Activity</p>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                    <ExportPDFButton title="กิจกรรมและพฤติกรรม" />
                </div>
            </div>

            {/* Activity Hours + Behavior */}
            <div className="charts-grid">
                <div className="chart-card animate-in">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">ชั่วโมงกิจกรรม</div>
                            <div className="chart-card-subtitle">เป้าหมายรวม {activityHours.target} ชั่วโมง แยกความคืบหน้าและหมวดกิจกรรม</div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 12, marginBottom: 18 }}>
                        {[
                            { label: 'ทำแล้ว', value: activityHours.completed, unit: 'ชม.', color: '#16A34A' },
                            { label: 'เป้าหมาย', value: activityHours.target, unit: 'ชม.', color: 'var(--text-primary)' },
                            { label: remainingHours > 0 ? 'ยังขาด' : 'ครบเกณฑ์', value: remainingHours, unit: 'ชม.', color: remainingHours > 0 ? '#D97706' : '#16A34A' },
                        ].map((item) => (
                            <button
                                key={item.label}
                                type="button"
                                onClick={() => openActivityDetail()}
                                style={{
                                    textAlign: 'left',
                                    padding: '14px 16px',
                                    borderRadius: 10,
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)',
                                    cursor: 'pointer',
                                }}
                            >
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 6 }}>{item.label}</div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, color: item.color }}>
                                    <span style={{ fontSize: '1.55rem', fontWeight: 800, lineHeight: 1 }}>{item.value}</span>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{item.unit}</span>
                                </div>
                            </button>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={() => openActivityDetail()}
                        style={{
                            width: '100%',
                            padding: 0,
                            border: 0,
                            background: 'transparent',
                            cursor: 'pointer',
                            textAlign: 'left',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8, fontSize: '0.86rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>ความคืบหน้ารวม</span>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{overallPct}%</span>
                        </div>
                        <div style={{
                            height: 18,
                            borderRadius: 999,
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            overflow: 'hidden',
                            display: 'flex',
                        }}>
                            <div style={{
                                width: `${overallPct}%`,
                                background: '#16A34A',
                                borderRadius: 999,
                                transition: 'width 0.8s ease',
                            }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            <span>ทำแล้ว {activityHours.completed} ชม.</span>
                            <span>ยังขาด {remainingHours} ชม.</span>
                        </div>
                    </button>

                    <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>แยกตามประเภทกิจกรรม</span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>รวม {completedCategoryTotal} ชม.</span>
                        </div>
                        <div style={{ display: 'grid', gap: 12 }}>
                            {activityBreakdown.map((cat) => (
                                <button
                                    key={cat.name}
                                    type="button"
                                    onClick={() => openActivityDetail(cat)}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'minmax(96px, 145px) 1fr minmax(92px, auto)',
                                        alignItems: 'center',
                                        gap: 12,
                                        width: '100%',
                                        padding: '10px 12px',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 10,
                                        background: cat.soft,
                                        cursor: 'pointer',
                                    }}
                                >
                                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.86rem', textAlign: 'left' }}>{cat.name}</span>
                                    <span style={{
                                        height: 10,
                                        borderRadius: 999,
                                        background: 'rgba(148, 163, 184, 0.18)',
                                        overflow: 'hidden',
                                    }}>
                                        <span style={{
                                            display: 'block',
                                            width: `${cat.targetPercent}%`,
                                            height: '100%',
                                            borderRadius: 999,
                                            background: cat.color,
                                        }} />
                                    </span>
                                    <span style={{ textAlign: 'right', color: cat.color, fontWeight: 800, fontSize: '0.9rem' }}>
                                        {cat.hours} ชม. ({cat.targetPercent}%)
                                    </span>
                                </button>
                            ))}
                        </div>
                        <div style={{ marginTop: 10, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            เปอร์เซ็นต์ของแต่ละแถบเทียบกับเป้าหมายรวม {activityHours.target} ชั่วโมง
                        </div>
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
                            <Line data={behaviorLineData} options={behaviorDrilldownOptions} />
                        </div>
                    </div>
                )}
            </div>

            {/* Library */}
            <div className="data-table-container animate-in" style={{ marginTop: 8 }}>
                <div className="data-table-header">
                    <span className="data-table-title">สถานะห้องสมุด</span>
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
