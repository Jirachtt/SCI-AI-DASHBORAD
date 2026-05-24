import { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import AccessDenied from '../components/AccessDenied';
import { Bar, Pie, Doughnut, Line } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement,
    Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler
} from 'chart.js';
import { themeAdaptorPlugin } from '../utils/chartTheme';
import { Users, UserCheck, Award, TrendingUp, Building2, GraduationCap, DollarSign } from 'lucide-react';
import ExportPDFButton from '../components/ExportPDFButton';
import ChartDrilldownModal from '../components/ChartDrilldownModal';
import { normalizeThaiText, withChartDrilldown } from '../utils/chartDrilldown';
import useDashboardDataset from '../hooks/useDashboardDataset';
import { legacyColorToVar, themeAlpha } from '../utils/themeTokens';
import {
    executiveCompensationDemo,
    getExecutiveCompensationSummary,
} from '../data/featureCompletionFallbackData';

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

const EDUCATION_DEFS = [
    { key: 'doctoral', label: 'ปริญญาเอก', shortLabel: 'ป.เอก', color: 'var(--accent-teal)', pattern: /เอก|doctoral|doctor|phd/i },
    { key: 'master', label: 'ปริญญาโท', shortLabel: 'ป.โท', color: 'var(--accent-cyan)', pattern: /โท|master|msc/i },
    { key: 'bachelor', label: 'ปริญญาตรี', shortLabel: 'ป.ตรี', color: 'var(--accent-orange)', pattern: /ตรี|bachelor|bsc/i },
    { key: 'vocational', label: 'ปวส.', shortLabel: 'ปวส.', color: 'var(--accent-pink)', pattern: /ปวส|ประกาศนียบัตรวิชาชีพชั้นสูง|higher vocational|diploma/i },
    { key: 'primary', label: 'ประถมศึกษา', shortLabel: 'ประถม', color: 'var(--accent-orange)', pattern: /ประถม|primary/i },
];

const EDUCATION_YEAR_SOURCE_KEYS = [
    'byEducationByYear',
    'educationByYear',
    'educationTrend',
    'educationHistory',
    'educationByAcademicYear',
];

function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function educationMetaFor(value, index = 0) {
    const text = String(value || '');
    return EDUCATION_DEFS.find(def => def.pattern.test(text)) || {
        key: `other-${index}`,
        label: text || 'ไม่ระบุ',
        shortLabel: text || 'อื่นๆ',
        color: ['var(--text-subtle)', 'var(--accent-purple)', 'var(--accent-cyan)', 'var(--accent-gold)'][index % 4],
    };
}

function normalizeEducationRows(rows = []) {
    return (rows || [])
        .map((row, index) => {
            const level = row?.level || row?.label || row?.name || row?.degree || row?.education || row?.key || '';
            const meta = educationMetaFor(level, index);
            return {
                ...row,
                key: row?.key || meta.key,
                level: meta.label,
                shortLabel: row?.shortLabel || meta.shortLabel,
                count: toNumber(row?.count ?? row?.value ?? row?.total ?? row?.amount),
                color: meta.color,
                order: row?.order ?? index + 1,
            };
        })
        .filter(row => row.count > 0)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
}

function educationRowsFromEntry(entry) {
    if (Array.isArray(entry)) return normalizeEducationRows(entry);
    if (!entry || typeof entry !== 'object') return [];

    const nestedRows = entry.byEducation || entry.education || entry.items || entry.rows || entry.data;
    if (Array.isArray(nestedRows)) return normalizeEducationRows(nestedRows);

    const rows = EDUCATION_DEFS
        .map(def => ({
            key: def.key,
            level: def.label,
            count: entry[def.key] ?? entry[def.label] ?? entry[def.shortLabel],
        }))
        .filter(row => row.count != null);
    return normalizeEducationRows(rows);
}

function entryYear(entry, fallbackYear) {
    const value = entry?.year ?? entry?.academicYear ?? entry?.fiscalYear ?? entry?.budgetYear ?? fallbackYear;
    if (value == null) return null;
    return String(value).replace(/^ปี\s*/u, '');
}

function collectEducationYearRows(source, targetMap) {
    if (Array.isArray(source)) {
        source.forEach(entry => {
            const year = entryYear(entry);
            const rows = educationRowsFromEntry(entry);
            if (year && rows.length) targetMap.set(String(year), { year: String(year), rows, source: 'direct' });
        });
        return;
    }

    if (source && typeof source === 'object') {
        Object.entries(source).forEach(([year, value]) => {
            const rows = educationRowsFromEntry(value);
            if (rows.length) targetMap.set(String(year), { year: String(year), rows, source: 'direct' });
        });
    }
}

function scaleEducationRows(rows = [], targetTotal = 0) {
    const sourceTotal = rows.reduce((sum, row) => sum + toNumber(row.count), 0);
    if (!sourceTotal || !targetTotal) return rows;

    let remaining = Math.max(0, Math.round(targetTotal));
    return rows.map((row, index) => {
        const count = index === rows.length - 1
            ? remaining
            : Math.max(0, Math.round((toNumber(row.count) / sourceTotal) * targetTotal));
        remaining -= count;
        return { ...row, count };
    }).filter(row => row.count > 0);
}

function buildEducationYearOptions(sci = {}) {
    const byYear = new Map();
    EDUCATION_YEAR_SOURCE_KEYS.forEach(key => collectEducationYearRows(sci[key], byYear));

    const baseRows = normalizeEducationRows(sci.byEducation || []);
    if (!baseRows.length) return [];

    const latestActualTrend = [...(sci.trend || [])].reverse().find(row => row.type !== 'forecast') || sci.trend?.[sci.trend.length - 1];
    const latestYear = String(sci.educationYear || sci.year || latestActualTrend?.year || new Date().getFullYear() + 543);
    if (!byYear.has(latestYear)) {
        byYear.set(latestYear, { year: latestYear, rows: baseRows, source: 'current' });
    }

    const baseTotal = baseRows.reduce((sum, row) => sum + toNumber(row.count), 0);
    const targetField = Math.abs(baseTotal - toNumber(sci.academic)) <= Math.abs(baseTotal - toNumber(sci.total))
        ? 'academic'
        : 'total';

    (sci.trend || []).forEach(row => {
        const year = entryYear(row);
        if (!year || byYear.has(year)) return;
        const targetTotal = toNumber(row[targetField]);
        if (!targetTotal) return;
        byYear.set(String(year), {
            year: String(year),
            rows: scaleEducationRows(baseRows, targetTotal),
            source: row.type === 'forecast' ? 'forecast' : 'scaled',
        });
    });

    return [...byYear.values()]
        .map(option => ({
            ...option,
            total: option.rows.reduce((sum, row) => sum + toNumber(row.count), 0),
        }))
        .sort((a, b) => toNumber(b.year) - toNumber(a.year));
}

function educationSourceLabel(source) {
    if (source === 'direct') return 'ข้อมูลวุฒิรายปีจากระบบ';
    if (source === 'scaled') return 'อ้างอิงสัดส่วนวุฒิล่าสุดกับยอดบุคลากรรายปี';
    if (source === 'forecast') return 'คาดการณ์จากสัดส่วนวุฒิล่าสุด';
    return 'ข้อมูลวุฒิล่าสุด';
}

function educationCount(rows = [], key) {
    return rows.find(row => row.key === key)?.count || 0;
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
    const [educationYear, setEducationYear] = useState('');
    const { data: hrData } = useDashboardDataset('hr');
    const sci = hrData.scienceFaculty;
    const personnelRows = useMemo(() => buildPersonnelDirectory(sci), [sci]);
    const educationYearOptions = useMemo(() => buildEducationYearOptions(sci), [sci]);
    const selectedEducationYear = educationYearOptions.some(option => option.year === educationYear)
        ? educationYear
        : educationYearOptions[0]?.year || '';
    const selectedEducation = educationYearOptions.find(option => option.year === selectedEducationYear) || educationYearOptions[0];
    if (!canAccess(user?.role, 'hr_overview')) return <AccessDenied />;

    // Department bar chart
    const deptChartData = {
        labels: sci.byDepartment.map(d => d.dept.replace('ภาควิชา', '')),
        datasets: [
            {
                label: 'สายวิชาการ',
                data: sci.byDepartment.map(d => d.academic),
                backgroundColor: 'color-mix(in srgb, var(--accent-success) 70%, transparent)',
                borderColor: 'var(--accent-success)',
                borderWidth: 1,
                borderRadius: 6,
            },
            {
                label: 'สายสนับสนุน',
                data: sci.byDepartment.map(d => d.support),
                backgroundColor: 'color-mix(in srgb, var(--accent-blue) 70%, transparent)',
                borderColor: 'var(--accent-blue)',
                borderWidth: 1,
                borderRadius: 6,
            }
        ]
    };

    // Academic positions doughnut
    const gradPalette = ['var(--accent-purple)', 'var(--accent-success)', 'var(--accent-warning)', 'var(--accent-danger)', 'var(--accent-blue)', 'var(--accent-cyan)', 'var(--accent-purple)', 'var(--accent-pink)', 'var(--accent-teal)', 'var(--accent-orange)', 'var(--accent-purple)', 'var(--text-subtle)'];
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
            backgroundColor: ['var(--accent-blue)', 'var(--accent-pink)'],
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
                borderColor: 'var(--accent-success)',
                backgroundColor: 'color-mix(in srgb, var(--accent-success) 12%, transparent)',
                fill: true,
                tension: 0.4,
                borderDash: sci.trend.map(t => t.type === 'forecast' ? [5, 5] : []),
            },
            {
                label: 'สายสนับสนุน',
                data: sci.trend.map(t => t.support),
                borderColor: 'var(--accent-blue)',
                backgroundColor: 'color-mix(in srgb, var(--accent-blue) 12%, transparent)',
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
                backgroundColor: 'color-mix(in srgb, var(--accent-purple) 70%, transparent)',
                borderColor: 'var(--accent-purple)',
                borderWidth: 1,
                borderRadius: 6,
            },
            {
                label: 'ผศ. ใหม่',
                data: sci.promotionTrend.map(p => p.newAssistProf),
                backgroundColor: 'color-mix(in srgb, var(--accent-blue) 70%, transparent)',
                borderColor: 'var(--accent-blue)',
                borderWidth: 1,
                borderRadius: 6,
            },
            {
                label: 'ศ. ใหม่',
                data: sci.promotionTrend.map(p => p.newProf),
                backgroundColor: 'color-mix(in srgb, var(--accent-warning) 70%, transparent)',
                borderColor: 'var(--accent-warning)',
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
            borderColor: 'var(--accent-purple)',
            backgroundColor: 'color-mix(in srgb, var(--accent-purple) 12%, transparent)',
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointBackgroundColor: sci.studentFacultyRatio.map(r => r.type === 'forecast' ? 'var(--accent-orange)' : 'var(--accent-purple)'),
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
            x: { ticks: { color: 'var(--text-muted)', font: { size: 10 } }, grid: { color: 'var(--chart-grid)' } },
            y: { ticks: { color: 'var(--text-muted)' }, grid: { color: 'var(--chart-grid)' } }
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
        { label: 'บุคลากรทั้งหมด', value: sci.total, icon: Users, color: 'var(--accent-success-deep)', suffix: 'คน' },
        { label: 'สายวิชาการ', value: sci.academic, icon: GraduationCap, color: 'var(--accent-info)', suffix: 'คน' },
        { label: 'สายสนับสนุน', value: sci.support, icon: UserCheck, color: 'var(--accent-gold)', suffix: 'คน' },
        { label: 'ปริญญาเอก', value: educationCount(normalizeEducationRows(sci.byEducation), 'doctoral'), icon: Award, color: 'var(--accent-teal)', suffix: 'คน' },
        { label: 'รศ.+ ผศ.', value: sci.academicPositions[1].count + sci.academicPositions[2].count, icon: TrendingUp, color: 'var(--accent-purple)', suffix: 'คน' },
        { label: 'เกษียณใน 5 ปี', value: sci.diversity.retirementIn5Years, icon: Building2, color: 'var(--accent-pink)', suffix: 'คน' },
    ];
    const compensationSummary = getExecutiveCompensationSummary(executiveCompensationDemo);

    return (
        <div style={{ padding: '0 4px' }}>
            <ChartDrilldownModal detail={drillDetail} onClose={() => setDrillDetail(null)} />
            <div className="section-header">
                <div className="section-header-icon" style={{ background: 'linear-gradient(135deg, var(--accent-info), var(--accent-info))' }}>
                    <Users size={22} color="var(--text-on-accent)" />
                </div>
                <div>
                    <h1>บุคลากรและโครงสร้างองค์กร</h1>
                    <p>HR & Faculty Profile — คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้</p>
                </div>
                <div className="section-header-actions">
                    <ExportPDFButton title="บุคลากรและโครงสร้างองค์กร" />
                </div>
            </div>

            {/* Scorecards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24, alignItems: 'stretch' }}>
                {scorecards.map((sc, i) => {
                    const Icon = sc.icon;
                    const accentColor = legacyColorToVar(sc.color);
                    return (
                        <div key={i} style={{ ...cardStyle, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, minHeight: 92, height: '100%' }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: themeAlpha(sc.color, 13), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Icon size={20} color={accentColor} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>{sc.value.toLocaleString()}</div>
                                <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.3 }}>{sc.label}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div style={{ ...cardStyle, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, var(--accent-gold), var(--accent-orange))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <DollarSign size={21} color="var(--text-on-accent)" />
                        </div>
                        <div>
                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', margin: 0 }}>ค่าตอบแทนผู้บริหารและรายการหักเงิน</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', margin: '4px 0 0' }}>สรุปตามตำแหน่งเพื่อวิเคราะห์ภาระงบบุคลากรและรายการหักเงิน</p>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
                    <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{compensationSummary.positions}</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>ตำแหน่งใน demo</div>
                    </div>
                    <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-success)' }}>{compensationSummary.totalGross.toLocaleString('th-TH')}</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>รายรับรวมต่อเดือน (บาท)</div>
                    </div>
                    <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-orange)' }}>{compensationSummary.totalDeductions.toLocaleString('th-TH')}</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>รายการหักรวม (บาท)</div>
                    </div>
                    <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-info)' }}>{compensationSummary.netEstimate.toLocaleString('th-TH')}</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>ประมาณการสุทธิ (บาท)</div>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>ตำแหน่ง</th>
                                <th>ขอบเขต</th>
                                <th style={{ textAlign: 'right' }}>ฐานเงินเดือน</th>
                                <th style={{ textAlign: 'right' }}>เงินประจำตำแหน่ง</th>
                                <th style={{ textAlign: 'right' }}>หักรวม</th>
                                <th style={{ textAlign: 'right' }}>สุทธิประมาณการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {executiveCompensationDemo.map(row => (
                                <tr key={row.position}>
                                    <td style={{ fontWeight: 700 }}>{row.position}</td>
                                    <td>{row.scope}</td>
                                    <td style={{ textAlign: 'right' }}>{row.monthlyBase.toLocaleString('th-TH')}</td>
                                    <td style={{ textAlign: 'right' }}>{row.positionAllowance.toLocaleString('th-TH')}</td>
                                    <td style={{ textAlign: 'right', color: 'var(--accent-orange)', fontWeight: 700 }}>{row.totalDeductions.toLocaleString('th-TH')}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 800 }}>{row.netEstimate.toLocaleString('th-TH')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                        <div>
                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', marginBottom: 4 }}>วุฒิการศึกษาสายวิชาการ</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
                                ปี {selectedEducation?.year || '-'} · {educationSourceLabel(selectedEducation?.source)}
                            </p>
                        </div>
                        {educationYearOptions.length > 1 && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: '0.86rem', fontWeight: 700 }}>
                                ปี
                                <select
                                    value={selectedEducationYear}
                                    onChange={(event) => setEducationYear(event.target.value)}
                                    style={{
                                        minWidth: 108,
                                        height: 38,
                                        borderRadius: 10,
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-primary)',
                                        color: 'var(--text-primary)',
                                        fontWeight: 700,
                                        padding: '0 10px',
                                    }}
                                >
                                    {educationYearOptions.map(option => (
                                        <option key={option.year} value={option.year}>{option.year}</option>
                                    ))}
                                </select>
                            </label>
                        )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))', gap: 12 }}>
                        {(selectedEducation?.rows || []).map((ed) => (
                            <div
                                key={ed.key}
                                style={{
                                    minHeight: 132,
                                    background: `linear-gradient(180deg, ${themeAlpha(ed.color, 9)}, ${themeAlpha(ed.color, 3)})`,
                                    border: `1px solid ${themeAlpha(ed.color, 18)}`,
                                    borderRadius: 14,
                                    padding: '16px 12px',
                                    textAlign: 'left',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                    justifyContent: 'flex-start',
                                }}
                            >
                                <div style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{ed.shortLabel}</div>
                                <div style={{ fontSize: '1.55rem', fontWeight: 800, color: ed.color, marginTop: 12, lineHeight: 1 }}>{ed.count.toLocaleString('th-TH')}</div>
                                <div style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: 8, lineHeight: 1.3 }}>{ed.level}</div>
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
                                <td style={{ padding: '8px 12px', color: 'var(--accent-pink)', fontSize: '1rem' }}>เกษียณภายใน 5 ปี</td>
                                <td style={{ padding: '8px 12px', color: 'var(--accent-pink)', fontSize: '1rem', fontWeight: 600, textAlign: 'right' }}>{sci.diversity.retirementIn5Years} คน</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
