import { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import AccessDenied from '../components/AccessDenied';
import { hrData } from '../data/hrData';
import { Bar, Pie, Doughnut, Line } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement,
    Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler
} from 'chart.js';
import { themeAdaptorPlugin } from '../utils/chartTheme';
import { Users, UserCheck, Award, TrendingUp, Building2, GraduationCap } from 'lucide-react';
import ExportPDFButton from '../components/ExportPDFButton';
import ChartDrilldownModal from '../components/ChartDrilldownModal';
import { normalizeThaiText, withChartDrilldown } from '../utils/chartDrilldown';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler, themeAdaptorPlugin);

const cardStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px', padding: '24px',
};

const personnelColumns = [
    { key: 'code', label: 'รหัสบุคลากร' },
    { key: 'name', label: 'ชื่อในระบบ' },
    { key: 'department', label: 'ภาควิชา' },
    { key: 'role', label: 'สายงาน' },
    { key: 'gender', label: 'เพศ' },
    { key: 'position', label: 'ตำแหน่ง' },
    { key: 'education', label: 'วุฒิ' },
    { key: 'ageGroup', label: 'ช่วงอายุ' },
];

function expandWeighted(items, labelKey = 'label') {
    return items.flatMap(item => Array.from({ length: item.count }, () => item[labelKey]));
}

function buildPersonnelDirectory(sci) {
    const academicPositions = expandWeighted(sci.academicPositions.filter(p => p.count > 0), 'position');
    const academicEducation = expandWeighted(sci.byEducation, 'level');
    const ageGroups = expandWeighted(sci.diversity.ageGroup, 'group');
    const genderGroups = expandWeighted(sci.byGender, 'gender');
    const supportPositions = ['เจ้าหน้าที่บริหารงานทั่วไป', 'นักวิทยาศาสตร์', 'เจ้าหน้าที่ห้องปฏิบัติการ', 'เจ้าหน้าที่การเงิน', 'เจ้าหน้าที่สารสนเทศ'];
    const rows = [];
    let academicCursor = 0;
    let supportCursor = 0;

    sci.byDepartment.forEach((dept, deptIndex) => {
        const department = normalizeThaiText(dept.dept);
        for (let i = 0; i < dept.academic; i += 1) {
            const code = `SCI-A${String(deptIndex + 1).padStart(2, '0')}-${String(i + 1).padStart(3, '0')}`;
            rows.push({
                code,
                name: `บุคลากรสายวิชาการ ${code}`,
                department,
                role: 'สายวิชาการ',
                position: academicPositions[academicCursor % academicPositions.length] || 'อาจารย์',
                education: academicEducation[academicCursor % academicEducation.length] || 'ปริญญาเอก',
                ageGroup: ageGroups[academicCursor % ageGroups.length] || '-',
            });
            academicCursor += 1;
        }
        for (let i = 0; i < dept.support; i += 1) {
            const code = `SCI-S${String(deptIndex + 1).padStart(2, '0')}-${String(i + 1).padStart(3, '0')}`;
            rows.push({
                code,
                name: `บุคลากรสายสนับสนุน ${code}`,
                department,
                role: 'สายสนับสนุน',
                position: supportPositions[supportCursor % supportPositions.length],
                education: supportCursor % 5 === 0 ? 'ปริญญาโท' : 'ปริญญาตรี',
                ageGroup: ageGroups[supportCursor % ageGroups.length] || '-',
            });
            supportCursor += 1;
        }
    });

    return rows.map((row, index) => ({
        ...row,
        gender: genderGroups[index] || '-',
        ageGroup: ageGroups[index] || row.ageGroup || '-',
    }));
}

export default function HRDashboardPage() {
    const { user } = useAuth();
    const [drillDetail, setDrillDetail] = useState(null);
    const sci = hrData.scienceFaculty;
    const personnelRows = useMemo(() => buildPersonnelDirectory(sci), [sci]);
    if (!canAccess(user?.role, 'hr_overview')) return <AccessDenied />;

    // Department bar chart
    const deptChartData = {
        labels: sci.byDepartment.map(d => d.dept.replace('ภาควิชา', '')),
        datasets: [
            {
                label: 'สายวิชาการ',
                data: sci.byDepartment.map(d => d.academic),
                backgroundColor: 'rgba(34, 197, 94, 0.7)',
                borderColor: '#22c55e',
                borderWidth: 1,
                borderRadius: 6,
            },
            {
                label: 'สายสนับสนุน',
                data: sci.byDepartment.map(d => d.support),
                backgroundColor: 'rgba(59, 130, 246, 0.7)',
                borderColor: '#3b82f6',
                borderWidth: 1,
                borderRadius: 6,
            }
        ]
    };

    // Academic positions doughnut
    const gradPalette = ['#7B68EE', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#a855f7', '#64748b'];
    const positionData = {
        labels: sci.academicPositions.map(p => p.position),
        datasets: [{
            data: sci.academicPositions.map(p => p.count),
            backgroundColor: sci.academicPositions.map((_, i) => gradPalette[i % gradPalette.length]),
            borderWidth: 0,
        }]
    };

    // Gender pie
    const genderData = {
        labels: sci.byGender.map(g => g.gender),
        datasets: [{
            data: sci.byGender.map(g => g.count),
            backgroundColor: ['#3b82f6', '#ec4899'],
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
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                fill: true,
                tension: 0.4,
                borderDash: sci.trend.map(t => t.type === 'forecast' ? [5, 5] : []),
            },
            {
                label: 'สายสนับสนุน',
                data: sci.trend.map(t => t.support),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.12)',
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
                backgroundColor: 'rgba(139, 92, 246, 0.7)',
                borderColor: '#8b5cf6',
                borderWidth: 1,
                borderRadius: 6,
            },
            {
                label: 'ผศ. ใหม่',
                data: sci.promotionTrend.map(p => p.newAssistProf),
                backgroundColor: 'rgba(59, 130, 246, 0.7)',
                borderColor: '#3b82f6',
                borderWidth: 1,
                borderRadius: 6,
            },
            {
                label: 'ศ. ใหม่',
                data: sci.promotionTrend.map(p => p.newProf),
                backgroundColor: 'rgba(245, 158, 11, 0.7)',
                borderColor: '#f59e0b',
                borderWidth: 1,
                borderRadius: 6,
            }
        ]
    };

    // Age group pie
    const ageData = {
        labels: sci.diversity.ageGroup.map(a => a.group),
        datasets: [{
            data: sci.diversity.ageGroup.map(a => a.count),
            backgroundColor: sci.diversity.ageGroup.map((_, i) => gradPalette[i % gradPalette.length]),
            borderWidth: 0,
        }]
    };

    // Student-Faculty Ratio line
    const ratioData = {
        labels: sci.studentFacultyRatio.map(r => r.year),
        datasets: [{
            label: 'อัตราส่วนนักศึกษา:อาจารย์',
            data: sci.studentFacultyRatio.map(r => r.ratio),
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.12)',
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointBackgroundColor: sci.studentFacultyRatio.map(r => r.type === 'forecast' ? '#f97316' : '#8b5cf6'),
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { color: 'var(--text-secondary)', padding: 12, font: { size: 11 } } },
            tooltip: {
                backgroundColor: 'var(--bg-card)',
                titleColor: 'var(--text-primary)',
                bodyColor: 'var(--text-secondary)',
            }
        },
        scales: {
            x: { ticks: { color: 'var(--text-muted)', font: { size: 10 } }, grid: { color: '#ffffff08' } },
            y: { ticks: { color: 'var(--text-muted)' }, grid: { color: '#ffffff08' } }
        }
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { color: 'var(--text-secondary)', padding: 12, font: { size: 11 } } }
        },
        cutout: '65%',
    };

    const detailNote = 'หมายเหตุ: ชุดข้อมูลบุคลากรปัจจุบันเป็นข้อมูลรวมระดับภาควิชา ระบบจึงแสดงรหัส/รายการบุคลากรตามจำนวนที่มีใน dataset; เมื่อเชื่อม API บุคลากรจริง รายชื่อจะถูกแทนด้วยชื่อจริงจาก API';

    const departmentDrilldownOptions = withChartDrilldown(
        { ...chartOptions, plugins: { ...chartOptions.plugins, legend: { ...chartOptions.plugins.legend, position: 'bottom' } } },
        deptChartData,
        setDrillDetail,
        (point) => {
            const dept = sci.byDepartment[point.index];
            const department = normalizeThaiText(dept?.dept || point.label);
            const role = point.datasetIndex === 0 ? 'สายวิชาการ' : 'สายสนับสนุน';
            const rows = personnelRows.filter(row => row.department === department && row.role === role);
            return {
                title: `บุคลากร${role}: ${department}`,
                subtitle: 'รายละเอียดจากกราฟบุคลากรแยกตามภาควิชา',
                valueLabel: role,
                value: rows.length,
                unit: 'คน',
                accentColor: point.color,
                rows,
                columns: personnelColumns,
                metrics: [
                    { label: 'สายวิชาการ', value: dept?.academic || 0, unit: 'คน' },
                    { label: 'สายสนับสนุน', value: dept?.support || 0, unit: 'คน' },
                    { label: 'รวมภาควิชา', value: dept?.total || 0, unit: 'คน' },
                ],
                note: detailNote,
            };
        }
    );

    const positionDrilldownOptions = withChartDrilldown(
        doughnutOptions,
        positionData,
        setDrillDetail,
        (point) => {
            const rows = personnelRows.filter(row => row.position === point.label);
            return {
                title: `ตำแหน่งทางวิชาการ: ${point.label}`,
                subtitle: 'รายชื่อ/รหัสบุคลากรในตำแหน่งนี้',
                valueLabel: 'จำนวน',
                value: rows.length || point.value,
                unit: 'คน',
                accentColor: point.color,
                rows,
                columns: personnelColumns,
                note: detailNote,
            };
        }
    );

    const genderDrilldownOptions = withChartDrilldown(
        doughnutOptions,
        genderData,
        setDrillDetail,
        (point) => {
            const rows = personnelRows.filter(row => row.gender === point.label);
            return {
                title: `สัดส่วนเพศ: ${point.label}`,
                subtitle: 'รายการบุคลากรที่อยู่ในกลุ่มนี้',
                valueLabel: 'จำนวน',
                value: rows.length || point.value,
                unit: 'คน',
                accentColor: point.color,
                rows,
                columns: personnelColumns,
                note: detailNote,
            };
        }
    );

    const ageDrilldownOptions = withChartDrilldown(
        doughnutOptions,
        ageData,
        setDrillDetail,
        (point) => {
            const rows = personnelRows.filter(row => row.ageGroup === point.label);
            return {
                title: `กลุ่มอายุ: ${point.label}`,
                subtitle: 'รายการบุคลากรในช่วงอายุที่เลือก',
                valueLabel: 'จำนวน',
                value: rows.length || point.value,
                unit: 'คน',
                accentColor: point.color,
                rows,
                columns: personnelColumns,
                note: detailNote,
            };
        }
    );

    const trendDrilldownOptions = withChartDrilldown(
        chartOptions,
        trendData,
        setDrillDetail,
        (point) => {
            const year = sci.trend[point.index];
            return {
                title: `แนวโน้มบุคลากร ปี ${point.label}`,
                subtitle: point.datasetLabel,
                valueLabel: point.datasetLabel,
                value: point.value,
                unit: 'คน',
                accentColor: point.color,
                rows: year ? [year] : [],
                columns: [
                    { key: 'year', label: 'ปี' },
                    { key: 'academic', label: 'สายวิชาการ', align: 'right' },
                    { key: 'support', label: 'สายสนับสนุน', align: 'right' },
                    { key: 'total', label: 'รวม', align: 'right' },
                    { key: 'type', label: 'ประเภท' },
                ],
            };
        }
    );

    const promotionDrilldownOptions = withChartDrilldown(
        chartOptions,
        promotionData,
        setDrillDetail,
        (point) => {
            const year = sci.promotionTrend[point.index];
            return {
                title: `การได้ตำแหน่งใหม่ ปี ${point.label}`,
                subtitle: point.datasetLabel,
                valueLabel: point.datasetLabel,
                value: point.value,
                unit: 'คน',
                accentColor: point.color,
                rows: year ? [year] : [],
                columns: [
                    { key: 'year', label: 'ปี' },
                    { key: 'newAssocProf', label: 'รศ. ใหม่', align: 'right' },
                    { key: 'newAssistProf', label: 'ผศ. ใหม่', align: 'right' },
                    { key: 'newProf', label: 'ศ. ใหม่', align: 'right' },
                    { key: 'type', label: 'ประเภท' },
                ],
            };
        }
    );

    const ratioDrilldownOptions = withChartDrilldown(
        { ...chartOptions, plugins: { ...chartOptions.plugins, legend: { display: false } } },
        ratioData,
        setDrillDetail,
        (point) => {
            const row = sci.studentFacultyRatio[point.index];
            return {
                title: `อัตราส่วนนักศึกษา:อาจารย์ ปี ${point.label}`,
                subtitle: 'แนวโน้มภาระอาจารย์ต่อจำนวนนักศึกษา',
                valueLabel: 'อัตราส่วน',
                value: point.value,
                unit: ':1',
                accentColor: point.color,
                rows: row ? [row] : [],
                columns: [
                    { key: 'year', label: 'ปี' },
                    { key: 'ratio', label: 'อัตราส่วน', align: 'right' },
                    { key: 'type', label: 'ประเภท' },
                ],
            };
        }
    );

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
            <ChartDrilldownModal detail={drillDetail} onClose={() => setDrillDetail(null)} />
            <div className="section-header">
                <div className="section-header-icon" style={{ background: 'linear-gradient(135deg, #2E86AB, #1a5276)' }}>
                    <Users size={22} color="#fff" />
                </div>
                <div>
                    <h1>บุคลากรและโครงสร้างองค์กร</h1>
                    <p>HR & Faculty Profile — คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้</p>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                    <ExportPDFButton title="บุคลากรและโครงสร้างองค์กร" />
                </div>
            </div>

            {/* Scorecards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24, alignItems: 'stretch' }}>
                {scorecards.map((sc, i) => {
                    const Icon = sc.icon;
                    return (
                        <div key={i} style={{ ...cardStyle, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, minHeight: 92, height: '100%' }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${sc.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Icon size={20} color={sc.color} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>{sc.value.toLocaleString()}</div>
                                <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.3 }}>{sc.label}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Row 1: Department bar + Position doughnut */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
                <div style={cardStyle}>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', marginBottom: 16 }}>บุคลากรแยกตามภาควิชา</h3>
                    <div style={{ height: 280 }}>
                        <Bar data={deptChartData} options={departmentDrilldownOptions} />
                    </div>
                </div>
                <div style={cardStyle}>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', marginBottom: 16 }}>ตำแหน่งทางวิชาการ</h3>
                    <div style={{ height: 280 }}>
                        <Doughnut data={positionData} options={positionDrilldownOptions} />
                    </div>
                </div>
            </div>

            {/* Row 2: Trend + Gender + Age */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div style={cardStyle}>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', marginBottom: 16 }}>แนวโน้มจำนวนบุคลากร</h3>
                    <div style={{ height: 250 }}>
                        <Line data={trendData} options={trendDrilldownOptions} />
                    </div>
                </div>
                <div style={cardStyle}>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', marginBottom: 16 }}>สัดส่วนเพศ</h3>
                    <div style={{ height: 250 }}>
                        <Pie data={genderData} options={genderDrilldownOptions} />
                    </div>
                </div>
                <div style={cardStyle}>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', marginBottom: 16 }}>กลุ่มอายุ</h3>
                    <div style={{ height: 250 }}>
                        <Pie data={ageData} options={ageDrilldownOptions} />
                    </div>
                </div>
            </div>

            {/* Row 3: Promotion trend + Student-Faculty ratio */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div style={cardStyle}>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', marginBottom: 16 }}>การได้ตำแหน่งทางวิชาการใหม่รายปี</h3>
                    <div style={{ height: 250 }}>
                        <Bar data={promotionData} options={promotionDrilldownOptions} />
                    </div>
                </div>
                <div style={cardStyle}>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', marginBottom: 16 }}>อัตราส่วนนักศึกษา : อาจารย์</h3>
                    <div style={{ height: 250 }}>
                        <Line data={ratioData} options={ratioDrilldownOptions} />
                    </div>
                </div>
            </div>

            {/* Row 4: Education + Diversity table */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={cardStyle}>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', marginBottom: 16 }}>วุฒิการศึกษาสายวิชาการ</h3>
                    <div style={{ display: 'flex', gap: 16 }}>
                        {sci.byEducation.map((ed, i) => (
                            <div key={i} style={{ flex: 1, background: `${ed.color}15`, borderRadius: 12, padding: 16, textAlign: 'center' }}>
                                <div style={{ fontSize: '2rem' }}>{ed.icon}</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: ed.color }}>{ed.count}</div>
                                <div style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>{ed.level}</div>
                            </div>
                        ))}
                    </div>
                </div>
                <div style={cardStyle}>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', marginBottom: 16 }}>ความหลากหลาย</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '1.1rem', borderBottom: '1px solid var(--border-color)' }}>หมวด</th>
                                <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '1.1rem', borderBottom: '1px solid var(--border-color)' }}>จำนวน</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sci.diversity.nationality.map((n, i) => (
                                <tr key={i}>
                                    <td style={{ padding: '8px 12px', color: 'var(--text-primary)', fontSize: '1rem', borderBottom: '1px solid var(--border-color)' }}>{n.label}</td>
                                    <td style={{ padding: '8px 12px', color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 600, textAlign: 'right', borderBottom: '1px solid var(--border-color)' }}>{n.count} คน</td>
                                </tr>
                            ))}
                            <tr>
                                <td style={{ padding: '8px 12px', color: '#E91E63', fontSize: '1rem' }}>เกษียณภายใน 5 ปี</td>
                                <td style={{ padding: '8px 12px', color: '#E91E63', fontSize: '1rem', fontWeight: 600, textAlign: 'right' }}>{sci.diversity.retirementIn5Years} คน</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
