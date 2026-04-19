import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import AccessDenied from '../components/AccessDenied';
import { strategicData } from '../data/strategicData';
import { Bar, Line } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement,
    Title, Tooltip, Legend, PointElement, LineElement, Filler,
    RadialLinearScale
} from 'chart.js';
import { themeAdaptorPlugin } from '../utils/chartTheme';
import { Target, TrendingUp, CheckCircle2, AlertTriangle } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, Filler, RadialLinearScale, themeAdaptorPlugin);

const cardStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px', padding: '24px',
};

function ProgressBar({ value, target, color }) {
    const pct = Math.min((value / target) * 100, 100);
    return (
        <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'var(--bg-secondary)' }}>
            <div style={{
                width: `${pct}%`, height: '100%', borderRadius: 4,
                background: `linear-gradient(90deg, ${color}, ${color}aa)`,
                transition: 'width 0.8s ease'
            }} />
        </div>
    );
}

export default function StrategicDashboardPage() {
    const { user } = useAuth();
    const [activeOKR, setActiveOKR] = useState(0);

    if (!canAccess(user?.role, 'strategic_overview')) return <AccessDenied />;

    const { strategicGoals, okr, performanceRadar, efficiencyTrend } = strategicData;

    // Horizontal grouped bar chart (executive-friendly)
    const perfBarData = {
        labels: performanceRadar.categories,
        datasets: [
            {
                label: 'เป้าหมาย',
                data: performanceRadar.targetYear,
                backgroundColor: 'rgba(245, 158, 11, 0.7)',
                borderColor: '#f59e0b',
                borderWidth: 1,
                borderRadius: 4,
                barPercentage: 0.7,
                categoryPercentage: 0.8,
            },
            {
                label: 'ปีปัจจุบัน',
                data: performanceRadar.currentYear,
                backgroundColor: 'rgba(34, 197, 94, 0.7)',
                borderColor: '#22c55e',
                borderWidth: 1,
                borderRadius: 4,
                barPercentage: 0.7,
                categoryPercentage: 0.8,
            },
            {
                label: 'ปีที่แล้ว',
                data: performanceRadar.lastYear,
                backgroundColor: 'rgba(123, 104, 238, 0.7)',
                borderColor: '#7B68EE',
                borderWidth: 1,
                borderRadius: 4,
                barPercentage: 0.7,
                categoryPercentage: 0.8,
            },
        ]
    };

    const perfBarOptions = {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        scales: {
            x: {
                min: 0, max: 100,
                ticks: { color: 'var(--text-muted)', font: { size: 11 }, callback: v => v + '%' },
                grid: { color: 'var(--border-color)' },
                title: { display: true, text: 'คะแนน (%)', color: 'var(--text-muted)', font: { size: 11 } }
            },
            y: {
                ticks: {
                    color: 'var(--text-primary)',
                    font: { size: 13, weight: 'bold', family: "'Noto Sans Thai', 'Inter', sans-serif" },
                },
                grid: { display: false },
            }
        },
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: 'var(--text-primary)',
                    font: { size: 12, weight: '600', family: "'Noto Sans Thai', 'Inter', sans-serif" },
                    padding: 20,
                    usePointStyle: true,
                    pointStyleWidth: 12,
                }
            },
            tooltip: {
                backgroundColor: 'var(--bg-card)',
                titleColor: 'var(--text-primary)',
                bodyColor: 'var(--text-secondary)',
                titleFont: { size: 13, weight: 'bold' },
                bodyFont: { size: 12 },
                padding: 12,
                borderColor: 'var(--border-color)',
                borderWidth: 1,
                displayColors: true,
                callbacks: {
                    label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.x}%`,
                }
            }
        }
    };

    // Efficiency trend
    const effData = {
        labels: efficiencyTrend.map(e => e.year),
        datasets: [
            {
                label: 'คะแนนประสิทธิภาพรวม', data: efficiencyTrend.map(e => e.score),
                borderColor: '#22c55e', backgroundColor: 'rgba(34, 197, 94, 0.12)', fill: true, tension: 0.4,
            },
            {
                label: 'ประสิทธิภาพงบประมาณ (%)', data: efficiencyTrend.map(e => e.budgetEfficiency),
                borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.12)', fill: true, tension: 0.4,
            }
        ]
    };

    const chartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { color: 'var(--text-secondary)', font: { size: 11 } } },
            tooltip: { backgroundColor: 'var(--bg-card)', titleColor: 'var(--text-primary)', bodyColor: 'var(--text-secondary)' }
        },
        scales: {
            x: { ticks: { color: 'var(--text-muted)' }, grid: { color: 'var(--border-color)' } },
            y: { ticks: { color: 'var(--text-muted)' }, grid: { color: 'var(--border-color)' } }
        }
    };

    const selectedObj = okr.objectives[activeOKR];

    return (
        <div style={{ padding: '0 4px' }}>
            <div className="section-header">
                <div className="section-header-icon" style={{ background: 'linear-gradient(135deg, #A23B72, #7B2D8E)' }}>
                    <Target size={22} color="#fff" />
                </div>
                <div>
                    <h1>ยุทธศาสตร์และการดำเนินงาน</h1>
                    <p>Strategic & OKR Monitoring — คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้</p>
                </div>
            </div>

            {/* Strategic Goals Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24, alignItems: 'stretch' }}>
                {strategicGoals.map((goal) => {
                    const pct = Math.round((goal.current / goal.target) * 100);
                    return (
                        <div key={goal.id} style={{ ...cardStyle, padding: '18px 20px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <span style={{ fontSize: '1.5rem' }}>{goal.icon}</span>
                                <span style={{
                                    fontSize: '0.78rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                                    background: pct >= 90 ? '#00683822' : pct >= 70 ? '#C5A02822' : '#E91E6322',
                                    color: pct >= 90 ? '#00a651' : pct >= 70 ? '#C5A028' : '#E91E63'
                                }}>{pct}%</span>
                            </div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.3 }}>{goal.title}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.3, flex: 1 }}>{goal.subtitle}</div>
                            <ProgressBar value={goal.current} target={goal.target} color={goal.color} />
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 6 }}>
                                {goal.current} / {goal.target} {goal.unit}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Row 2: Radar + KPI Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div style={cardStyle}>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: 16 }}>📊 ประสิทธิภาพ 5 ด้าน — เปรียบเทียบเป้าหมาย</h3>
                    <div style={{ height: 320 }}>
                        <Bar data={perfBarData} options={perfBarOptions} />
                    </div>
                </div>
                <div style={cardStyle}>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: 16 }}>KPI แต่ละเป้าหมาย</h3>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                        {strategicGoals.map((g, i) => (
                            <span key={i} style={{ fontSize: '0.82rem' }}>{g.icon} {g.id}</span>
                        ))}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 280, overflowY: 'auto' }}>
                        {strategicGoals.map(goal => (
                            goal.kpis.map((kpi, ki) => {
                                const pct = Math.round((kpi.current / kpi.target) * 100);
                                return (
                                    <div key={`${goal.id}-${ki}`} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 14px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500 }}>{goal.icon} {kpi.name}</span>
                                            <span style={{
                                                fontSize: '0.82rem', fontWeight: 700,
                                                color: pct >= 90 ? '#00a651' : pct >= 70 ? '#C5A028' : '#E91E63'
                                            }}>{kpi.current}/{kpi.target} {kpi.unit}</span>
                                        </div>
                                        <div style={{ marginTop: 6 }}>
                                            <ProgressBar value={kpi.current} target={kpi.target} color={goal.color} />
                                        </div>
                                    </div>
                                );
                            })
                        ))}
                    </div>
                </div>
            </div>

            {/* Row 3: OKR Section */}
            <div style={{ ...cardStyle, marginBottom: 16 }}>
                <h3 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: 16 }}>OKR Monitoring — {okr.period}</h3>

                {/* OKR tabs */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                    {okr.objectives.map((obj, i) => (
                        <button key={i}
                            onClick={() => setActiveOKR(i)}
                            style={{
                                padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                                fontSize: '0.88rem', fontWeight: 600, transition: 'all 0.2s',
                                background: activeOKR === i ? `${obj.color}33` : 'var(--bg-secondary)',
                                color: activeOKR === i ? obj.color : 'var(--text-muted)',
                                outline: activeOKR === i ? `2px solid ${obj.color}66` : 'none',
                            }}
                        >
                            {obj.id}: {obj.title.substring(0, 20)}...
                        </button>
                    ))}
                </div>

                {/* Selected OKR details */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                    <div style={{
                        width: 60, height: 60, borderRadius: 15,
                        background: `conic-gradient(${selectedObj.color} ${selectedObj.progress * 3.6}deg, var(--bg-secondary) 0deg)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: 12, background: 'var(--bg-card)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.85rem', fontWeight: 700, color: selectedObj.color,
                        }}>{selectedObj.progress}%</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedObj.title}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>ความคืบหน้ารวม: {selectedObj.progress}%</div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                    {selectedObj.keyResults.map((kr, i) => (
                        <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '14px 18px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{kr.id}</span>
                                <span style={{ fontSize: '0.85rem', color: selectedObj.color, fontWeight: 700 }}>{kr.progress}%</span>
                            </div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: 8 }}>{kr.title}</div>
                            <ProgressBar value={kr.current} target={kr.target} color={selectedObj.color} />
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 6 }}>
                                ปัจจุบัน: {kr.current} / เป้าหมาย: {kr.target} {kr.unit}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Row 4: Efficiency Trend */}
            <div style={cardStyle}>
                <h3 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: 16 }}>แนวโน้มประสิทธิภาพรวม</h3>
                <div style={{ height: 260 }}>
                    <Line data={effData} options={chartOptions} />
                </div>
            </div>
        </div>
    );
}
