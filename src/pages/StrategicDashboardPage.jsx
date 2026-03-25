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
import { Target, TrendingUp, CheckCircle2, AlertTriangle } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, Filler, RadialLinearScale);

const cardStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px', padding: '24px',
};

function ProgressBar({ value, target, color }) {
    const pct = Math.min((value / target) * 100, 100);
    return (
        <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)' }}>
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
                backgroundColor: 'rgba(255, 215, 0, 0.85)',
                borderColor: '#FFD700',
                borderWidth: 1,
                borderRadius: 4,
                barPercentage: 0.7,
                categoryPercentage: 0.8,
            },
            {
                label: 'ปีปัจจุบัน',
                data: performanceRadar.currentYear,
                backgroundColor: 'rgba(0, 230, 118, 0.85)',
                borderColor: '#00e676',
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
                ticks: { color: '#9ca3af', font: { size: 11 }, callback: v => v + '%' },
                grid: { color: 'rgba(255,255,255,0.06)' },
                title: { display: true, text: 'คะแนน (%)', color: '#9ca3af', font: { size: 11 } }
            },
            y: {
                ticks: {
                    color: '#e5e7eb',
                    font: { size: 13, weight: 'bold', family: "'Noto Sans Thai', 'Inter', sans-serif" },
                },
                grid: { display: false },
            }
        },
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: '#e5e7eb',
                    font: { size: 12, weight: '600', family: "'Noto Sans Thai', 'Inter', sans-serif" },
                    padding: 20,
                    usePointStyle: true,
                    pointStyleWidth: 12,
                }
            },
            tooltip: {
                backgroundColor: 'rgba(13, 17, 23, 0.95)',
                titleColor: '#fff',
                bodyColor: '#e5e7eb',
                titleFont: { size: 13, weight: 'bold' },
                bodyFont: { size: 12 },
                padding: 12,
                borderColor: 'rgba(255,255,255,0.1)',
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
                borderColor: '#006838', backgroundColor: '#00683822', fill: true, tension: 0.4,
            },
            {
                label: 'ประสิทธิภาพงบประมาณ (%)', data: efficiencyTrend.map(e => e.budgetEfficiency),
                borderColor: '#2E86AB', backgroundColor: '#2E86AB22', fill: true, tension: 0.4,
            }
        ]
    };

    const chartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { color: '#ccc', font: { size: 11 } } },
            tooltip: { backgroundColor: '#1a1a2e', titleColor: '#fff', bodyColor: '#ccc' }
        },
        scales: {
            x: { ticks: { color: '#888' }, grid: { color: '#ffffff08' } },
            y: { ticks: { color: '#888' }, grid: { color: '#ffffff08' } }
        }
    };

    const selectedObj = okr.objectives[activeOKR];

    return (
        <div style={{ padding: '0 4px' }}>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}><Target size={24} /> ยุทธศาสตร์และการดำเนินงาน</h1>
                <p style={{ color: '#9ca3af', margin: '4px 0 0' }}>Strategic & OKR Monitoring — คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้</p>
            </div>

            {/* Strategic Goals Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
                {strategicGoals.map((goal) => {
                    const pct = Math.round((goal.current / goal.target) * 100);
                    return (
                        <div key={goal.id} style={{ ...cardStyle, padding: '18px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <span style={{ fontSize: '1.5rem' }}>{goal.icon}</span>
                                <span style={{
                                    fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                                    background: pct >= 90 ? '#00683822' : pct >= 70 ? '#C5A02822' : '#E91E6322',
                                    color: pct >= 90 ? '#00a651' : pct >= 70 ? '#C5A028' : '#E91E63'
                                }}>{pct}%</span>
                            </div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', marginBottom: 4 }}>{goal.title}</div>
                            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginBottom: 10 }}>{goal.subtitle}</div>
                            <ProgressBar value={goal.current} target={goal.target} color={goal.color} />
                            <div style={{ fontSize: '0.7rem', color: '#888', marginTop: 6 }}>
                                {goal.current} / {goal.target} {goal.unit}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Row 2: Radar + KPI Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div style={cardStyle}>
                    <h3 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: 16 }}>📊 ประสิทธิภาพ 5 ด้าน — เปรียบเทียบเป้าหมาย</h3>
                    <div style={{ height: 320 }}>
                        <Bar data={perfBarData} options={perfBarOptions} />
                    </div>
                </div>
                <div style={cardStyle}>
                    <h3 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: 16 }}>KPI แต่ละเป้าหมาย</h3>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                        {strategicGoals.map((g, i) => (
                            <span key={i} style={{ fontSize: '0.7rem' }}>{g.icon} {g.id}</span>
                        ))}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 280, overflowY: 'auto' }}>
                        {strategicGoals.map(goal => (
                            goal.kpis.map((kpi, ki) => {
                                const pct = Math.round((kpi.current / kpi.target) * 100);
                                return (
                                    <div key={`${goal.id}-${ki}`} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 14px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.78rem', color: '#ddd' }}>{goal.icon} {kpi.name}</span>
                                            <span style={{
                                                fontSize: '0.7rem', fontWeight: 700,
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
                <h3 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: 16 }}>OKR Monitoring — {okr.period}</h3>

                {/* OKR tabs */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                    {okr.objectives.map((obj, i) => (
                        <button key={i}
                            onClick={() => setActiveOKR(i)}
                            style={{
                                padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                                fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.2s',
                                background: activeOKR === i ? `${obj.color}33` : 'rgba(255,255,255,0.05)',
                                color: activeOKR === i ? obj.color : '#888',
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
                        background: `conic-gradient(${selectedObj.color} ${selectedObj.progress * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: 12, background: '#0d1117',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.85rem', fontWeight: 700, color: selectedObj.color,
                        }}>{selectedObj.progress}%</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{selectedObj.title}</div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>ความคืบหน้ารวม: {selectedObj.progress}%</div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                    {selectedObj.keyResults.map((kr, i) => (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '14px 18px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <span style={{ fontSize: '0.78rem', color: '#ccc', fontWeight: 600 }}>{kr.id}</span>
                                <span style={{ fontSize: '0.7rem', color: selectedObj.color, fontWeight: 700 }}>{kr.progress}%</span>
                            </div>
                            <div style={{ fontSize: '0.82rem', color: '#fff', marginBottom: 8 }}>{kr.title}</div>
                            <ProgressBar value={kr.current} target={kr.target} color={selectedObj.color} />
                            <div style={{ fontSize: '0.7rem', color: '#888', marginTop: 6 }}>
                                ปัจจุบัน: {kr.current} / เป้าหมาย: {kr.target} {kr.unit}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Row 4: Efficiency Trend */}
            <div style={cardStyle}>
                <h3 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: 16 }}>แนวโน้มประสิทธิภาพรวม</h3>
                <div style={{ height: 260 }}>
                    <Line data={effData} options={chartOptions} />
                </div>
            </div>
        </div>
    );
}
