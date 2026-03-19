import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import AccessDenied from '../components/AccessDenied';
import { hrData } from '../data/hrData';
import { Bar, Pie, Doughnut, Line } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement,
    Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler
} from 'chart.js';
import { Users, UserCheck, Award, TrendingUp, Building2, GraduationCap } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler);

const cardStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px', padding: '24px',
};

export default function HRDashboardPage() {
    const { user } = useAuth();
    if (!canAccess(user?.role, 'hr_overview')) return <AccessDenied />;

    const sci = hrData.scienceFaculty;

    // Department bar chart
    const deptChartData = {
        labels: sci.byDepartment.map(d => d.dept.replace('ภาควิชา', '')),
        datasets: [
            {
                label: 'สายวิชาการ',
                data: sci.byDepartment.map(d => d.academic),
                backgroundColor: '#006838cc',
                borderRadius: 6,
            },
            {
                label: 'สายสนับสนุน',
                data: sci.byDepartment.map(d => d.support),
                backgroundColor: '#2E86ABcc',
                borderRadius: 6,
            }
        ]
    };

    // Academic positions doughnut
    const positionData = {
        labels: sci.academicPositions.map(p => p.position),
        datasets: [{
            data: sci.academicPositions.map(p => p.count),
            backgroundColor: sci.academicPositions.map(p => p.color),
            borderWidth: 0,
        }]
    };

    // Gender pie
    const genderData = {
        labels: sci.byGender.map(g => g.gender),
        datasets: [{
            data: sci.byGender.map(g => g.count),
            backgroundColor: sci.byGender.map(g => g.color),
            borderWidth: 0,
        }]
    };

    // Trend line chart
    const trendData = {
        labels: sci.trend.map(t => t.year),
        datasets: [
            {
                label: 'สายวิชาการ',
                data: sci.trend.map(t => t.academic),
                borderColor: '#006838',
                backgroundColor: '#00683822',
                fill: true,
                tension: 0.4,
                borderDash: sci.trend.map(t => t.type === 'forecast' ? [5, 5] : []),
            },
            {
                label: 'สายสนับสนุน',
                data: sci.trend.map(t => t.support),
                borderColor: '#2E86AB',
                backgroundColor: '#2E86AB22',
                fill: true,
                tension: 0.4,
            }
        ]
    };

    // Promotion trend
    const promotionData = {
        labels: sci.promotionTrend.map(p => p.year),
        datasets: [
            {
                label: 'รศ. ใหม่',
                data: sci.promotionTrend.map(p => p.newAssocProf),
                backgroundColor: '#C5A028cc',
                borderRadius: 6,
            },
            {
                label: 'ผศ. ใหม่',
                data: sci.promotionTrend.map(p => p.newAssistProf),
                backgroundColor: '#2E86ABcc',
                borderRadius: 6,
            },
            {
                label: 'ศ. ใหม่',
                data: sci.promotionTrend.map(p => p.newProf),
                backgroundColor: '#FFD700cc',
                borderRadius: 6,
            }
        ]
    };

    // Age group pie
    const ageData = {
        labels: sci.diversity.ageGroup.map(a => a.group),
        datasets: [{
            data: sci.diversity.ageGroup.map(a => a.count),
            backgroundColor: sci.diversity.ageGroup.map(a => a.color),
            borderWidth: 0,
        }]
    };

    // Student-Faculty Ratio line
    const ratioData = {
        labels: sci.studentFacultyRatio.map(r => r.year),
        datasets: [{
            label: 'อัตราส่วนนักศึกษา:อาจารย์',
            data: sci.studentFacultyRatio.map(r => r.ratio),
            borderColor: '#A23B72',
            backgroundColor: '#A23B7222',
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointBackgroundColor: sci.studentFacultyRatio.map(r => r.type === 'forecast' ? '#F18F01' : '#A23B72'),
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: '#ccc', font: { size: 11 } } },
            tooltip: {
                backgroundColor: '#1a1a2e',
                titleColor: '#fff',
                bodyColor: '#ccc',
            }
        },
        scales: {
            x: { ticks: { color: '#888', font: { size: 10 } }, grid: { color: '#ffffff08' } },
            y: { ticks: { color: '#888' }, grid: { color: '#ffffff08' } }
        }
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { color: '#ccc', padding: 12, font: { size: 11 } } }
        },
        cutout: '65%',
    };

    const scorecards = [
        { label: 'บุคลากรทั้งหมด', value: sci.total, icon: Users, color: '#006838', suffix: 'คน' },
        { label: 'สายวิชาการ', value: sci.academic, icon: GraduationCap, color: '#2E86AB', suffix: 'คน' },
        { label: 'สายสนับสนุน', value: sci.support, icon: UserCheck, color: '#C5A028', suffix: 'คน' },
        { label: 'ปริญญาเอก', value: sci.byEducation[0].count, icon: Award, color: '#A23B72', suffix: 'คน' },
        { label: 'รศ.+ ผศ.', value: sci.academicPositions[1].count + sci.academicPositions[2].count, icon: TrendingUp, color: '#7B68EE', suffix: 'คน' },
        { label: 'เกษียณใน 5 ปี', value: sci.diversity.retirementIn5Years, icon: Building2, color: '#E91E63', suffix: 'คน' },
    ];

    return (
        <div style={{ padding: '0 4px' }}>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                    <Users size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} /> บุคลากรและโครงสร้างองค์กร
                </h1>
                <p style={{ color: '#9ca3af', margin: '4px 0 0' }}>HR & Faculty Profile — คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้</p>
            </div>

            {/* Scorecards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
                {scorecards.map((sc, i) => {
                    const Icon = sc.icon;
                    return (
                        <div key={i} style={{ ...cardStyle, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${sc.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Icon size={20} color={sc.color} />
                            </div>
                            <div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>{sc.value.toLocaleString()}</div>
                                <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{sc.label}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Row 1: Department bar + Position doughnut */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
                <div style={cardStyle}>
                    <h3 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: 16 }}>บุคลากรแยกตามภาควิชา</h3>
                    <div style={{ height: 280 }}>
                        <Bar data={deptChartData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, legend: { ...chartOptions.plugins.legend, position: 'top' } } }} />
                    </div>
                </div>
                <div style={cardStyle}>
                    <h3 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: 16 }}>ตำแหน่งทางวิชาการ</h3>
                    <div style={{ height: 280 }}>
                        <Doughnut data={positionData} options={doughnutOptions} />
                    </div>
                </div>
            </div>

            {/* Row 2: Trend + Gender + Age */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div style={cardStyle}>
                    <h3 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: 16 }}>แนวโน้มจำนวนบุคลากร</h3>
                    <div style={{ height: 250 }}>
                        <Line data={trendData} options={chartOptions} />
                    </div>
                </div>
                <div style={cardStyle}>
                    <h3 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: 16 }}>สัดส่วนเพศ</h3>
                    <div style={{ height: 250 }}>
                        <Pie data={genderData} options={doughnutOptions} />
                    </div>
                </div>
                <div style={cardStyle}>
                    <h3 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: 16 }}>กลุ่มอายุ</h3>
                    <div style={{ height: 250 }}>
                        <Pie data={ageData} options={doughnutOptions} />
                    </div>
                </div>
            </div>

            {/* Row 3: Promotion trend + Student-Faculty ratio */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div style={cardStyle}>
                    <h3 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: 16 }}>การได้ตำแหน่งทางวิชาการใหม่รายปี</h3>
                    <div style={{ height: 250 }}>
                        <Bar data={promotionData} options={chartOptions} />
                    </div>
                </div>
                <div style={cardStyle}>
                    <h3 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: 16 }}>อัตราส่วนนักศึกษา : อาจารย์</h3>
                    <div style={{ height: 250 }}>
                        <Line data={ratioData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, legend: { display: false } } }} />
                    </div>
                </div>
            </div>

            {/* Row 4: Education + Diversity table */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={cardStyle}>
                    <h3 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: 16 }}>วุฒิการศึกษาสายวิชาการ</h3>
                    <div style={{ display: 'flex', gap: 16 }}>
                        {sci.byEducation.map((ed, i) => (
                            <div key={i} style={{ flex: 1, background: `${ed.color}15`, borderRadius: 12, padding: 16, textAlign: 'center' }}>
                                <div style={{ fontSize: '2rem' }}>{ed.icon}</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: ed.color }}>{ed.count}</div>
                                <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{ed.level}</div>
                            </div>
                        ))}
                    </div>
                </div>
                <div style={cardStyle}>
                    <h3 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: 16 }}>ความหลากหลาย</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#9ca3af', fontSize: '0.8rem', borderBottom: '1px solid #ffffff10' }}>หมวด</th>
                                <th style={{ padding: '8px 12px', textAlign: 'right', color: '#9ca3af', fontSize: '0.8rem', borderBottom: '1px solid #ffffff10' }}>จำนวน</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sci.diversity.nationality.map((n, i) => (
                                <tr key={i}>
                                    <td style={{ padding: '8px 12px', color: '#ddd', fontSize: '0.85rem', borderBottom: '1px solid #ffffff08' }}>{n.label}</td>
                                    <td style={{ padding: '8px 12px', color: '#fff', fontSize: '0.85rem', fontWeight: 600, textAlign: 'right', borderBottom: '1px solid #ffffff08' }}>{n.count} คน</td>
                                </tr>
                            ))}
                            <tr>
                                <td style={{ padding: '8px 12px', color: '#E91E63', fontSize: '0.85rem' }}>เกษียณภายใน 5 ปี</td>
                                <td style={{ padding: '8px 12px', color: '#E91E63', fontSize: '0.85rem', fontWeight: 600, textAlign: 'right' }}>{sci.diversity.retirementIn5Years} คน</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
