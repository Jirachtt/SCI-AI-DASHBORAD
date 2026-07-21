import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import AccessDenied from '../components/AccessDenied';
import { ensureStudentList, getStudentListSync, onStudentDataChange } from '../services/studentDataService';
import { ArrowLeft, Filter, RotateCcw, GraduationCap, BookOpen, Award, FileText, BarChart3, Microscope, MousePointerClick } from 'lucide-react';
import ExportPDFButton from '../components/ExportPDFButton';
import ChartDrilldownModal from '../components/ChartDrilldownModal';
import CompositionBreakdown from '../components/CompositionBreakdown';
import ProductPageHeader from '../components/ProductPageHeader';
import { Doughnut, Line, Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
    Title, Tooltip, Legend, ArcElement, Filler, BarElement
} from 'chart.js';
import { themeAdaptorPlugin } from '../utils/chartTheme';
import { withChartDrilldown } from '../utils/chartDrilldown';
import useDashboardDataset from '../hooks/useDashboardDataset';
import { SCIENCE_MAJORS } from '../data/studentListData';
import { legacyColorToVar, themeAlpha, themeGradient } from '../utils/themeTokens';
import {
    studentAwardRecordsDemo,
    populationForecastReference,
} from '../data/featureCompletionFallbackData';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler, BarElement, themeAdaptorPlugin);

const studentColumns = [
    { key: 'id', label: 'รหัสนักศึกษา' },
    { key: 'name', label: 'ชื่อ-นามสกุล' },
    { key: 'major', label: 'สาขาวิชา' },
    { key: 'level', label: 'ระดับ' },
    { key: 'year', label: 'ชั้นปี', align: 'right' },
    { key: 'status', label: 'สถานะ' },
    { key: 'gpa', label: 'GPA', align: 'right', render: value => typeof value === 'number' ? value.toFixed(2) : '-' },
];

const levelFallbackPalette = [
    'var(--student-level-bachelor)',
    'var(--student-level-master)',
    'var(--student-level-doctoral)',
    'var(--student-level-certificate)',
    'var(--student-level-other)',
];
const levelColorRules = [
    { test: /ตรี|bachelor/i, color: 'var(--student-level-bachelor)' },
    { test: /โท|master/i, color: 'var(--student-level-master)' },
    { test: /เอก|doctoral|phd/i, color: 'var(--student-level-doctoral)' },
    { test: /ประกาศ|cert/i, color: 'var(--student-level-certificate)' },
];

const aggregateLevelColumns = [
    { key: 'level', label: 'ระดับ' },
    { key: 'chartTotal', label: 'จำนวนในกราฟ', align: 'right', render: value => Number(value || 0).toLocaleString('th-TH') },
    { key: 'detailRows', label: 'รายชื่อที่มีในระบบ', align: 'right', render: value => Number(value || 0).toLocaleString('th-TH') },
    { key: 'source', label: 'แหล่งข้อมูล' },
];

function getStudentLevelColor(level, index = 0) {
    const text = String(level || '');
    return levelColorRules.find(rule => rule.test.test(text))?.color || levelFallbackPalette[index % levelFallbackPalette.length];
}

function displayNationalityLabel(nationality) {
    const text = String(nationality || '').trim();
    if (!text || /ไม่มีสัญชาติ|อื่น|international|foreign/i.test(text)) return 'สัญชาติอื่นๆ';
    return text;
}

function buildLevelDrilldownRows(point, rows, sourceLabel, rowNote) {
    const chartTotal = Number(point.value || 0);
    const rowCount = Array.isArray(rows) ? rows.length : 0;
    const rowsMatchChart = rowCount > 0 && rowCount === chartTotal;

    if (rowsMatchChart) {
        return {
            rows,
            columns: studentColumns,
            metrics: [{ label: 'รายชื่อที่แสดง', value: rowCount, unit: 'คน' }],
            note: rowNote,
        };
    }

    return {
        rows: [{
            level: point.label,
            chartTotal,
            detailRows: rowCount,
            source: sourceLabel,
        }],
        columns: aggregateLevelColumns,
        metrics: rowCount > 0 ? [{ label: 'รายชื่อรายคนในระบบ', value: rowCount, unit: 'คน' }] : [],
        note: `จำนวนหลักยึดตามยอดในกราฟจาก ${sourceLabel} ส่วนรายชื่อรายคนจะแสดงเฉพาะเมื่อ dataset รายชื่อนักศึกษาในระบบมีข้อมูลครบตรงกับยอดนั้น`,
    };
}

function noteWhenRowsDiffer(rows, chartValue, baseNote) {
    const rowCount = Array.isArray(rows) ? rows.length : 0;
    const chartTotal = Number(chartValue || 0);
    if (rowCount > 0 && rowCount !== chartTotal) {
        return `${baseNote} • จำนวนหลักในหน้าต่างนี้ยึดตามจุดกราฟ (${chartTotal.toLocaleString('th-TH')} คน) และตารางแสดงเฉพาะรายชื่อที่ระบบมีอยู่ตอนนี้ (${rowCount.toLocaleString('th-TH')} คน)`;
    }
    return baseNote;
}

function levelKeyFromStudent(student) {
    const text = `${student?.level || ''} ${student?.degree || ''} ${student?.degreeLevel || ''}`.toLowerCase();
    if (/โท|master|msc/i.test(text)) return 'master';
    if (/เอก|doctoral|phd/i.test(text)) return 'doctoral';
    if (/ประกาศ|cert/i.test(text)) return 'certificate';
    return 'bachelor';
}

function normalizeMajorRow(row = {}) {
    const bachelor = Number(row.bachelor || 0);
    const master = Number(row.master || 0);
    const doctoral = Number(row.doctoral || 0);
    const certificate = Number(row.certificate || 0);
    const levelTotal = bachelor + master + doctoral + certificate;
    const providedTotal = row.total ?? row.count;
    const total = Number(providedTotal == null ? levelTotal : providedTotal);
    return {
        ...row,
        major: row.major || row.name || 'ไม่ระบุสาขา',
        total,
        count: total,
        bachelor,
        master,
        doctoral,
        certificate,
        avgGPA: row.avgGPA ?? row.avgGpa ?? null,
        lowGpa: row.lowGpa ?? row.lowGPA ?? 0,
    };
}

function buildMajorRowsFromStudents(rows = []) {
    const scienceRows = rows.filter(student => SCIENCE_MAJORS.includes(student?.major));
    const sourceRows = scienceRows.length > 0 ? scienceRows : rows;
    const byMajor = new Map();
    sourceRows.forEach(student => {
        const major = student?.major || 'ไม่ระบุสาขา';
        const levelKey = levelKeyFromStudent(student);
        const gpa = Number(student?.gpa);
        const current = byMajor.get(major) || {
            major,
            total: 0,
            count: 0,
            bachelor: 0,
            master: 0,
            doctoral: 0,
            certificate: 0,
            gpaSum: 0,
            gpaCount: 0,
            lowGpa: 0,
        };
        current.total += 1;
        current.count += 1;
        current[levelKey] = (current[levelKey] || 0) + 1;
        if (Number.isFinite(gpa) && gpa >= 0 && gpa <= 4) {
            current.gpaSum += gpa;
            current.gpaCount += 1;
            if (gpa < 2) current.lowGpa += 1;
        }
        byMajor.set(major, current);
    });
    return [...byMajor.values()].map(row => ({
        ...row,
        avgGPA: row.gpaCount ? Number((row.gpaSum / row.gpaCount).toFixed(2)) : null,
    }));
}

function buildScienceMajorRows(scienceFaculty, studentRows) {
    const rows = Array.isArray(scienceFaculty?.byMajor) && scienceFaculty.byMajor.length > 0
        ? scienceFaculty.byMajor
        : buildMajorRowsFromStudents(studentRows);
    return rows
        .map(normalizeMajorRow)
        .filter(row => row.total > 0)
        .sort((a, b) => b.total - a.total || a.major.localeCompare(b.major, 'th'));
}

const LEVEL_FILTER_LABELS = {
    certificate: 'ประกาศนียบัตร',
    bachelor: 'ป.ตรี',
    master: 'ป.โท',
    doctoral: 'ป.เอก',
};

export default function StudentStatsPage() {
    const { user } = useAuth();
    const [selectedFaculty, setSelectedFaculty] = useState('all');
    const [selectedLevel, setSelectedLevel] = useState('all');
    const [appliedFaculty, setAppliedFaculty] = useState('all');
    const [appliedLevel, setAppliedLevel] = useState('all');
    const [drillDetail, setDrillDetail] = useState(null);
    const [, forceTick] = useState(0);
    const { data: studentStatsData } = useDashboardDataset('student_stats');

    useEffect(() => {
        ensureStudentList().then(() => forceTick(t => t + 1));
        const unsub = onStudentDataChange(() => forceTick(t => t + 1));
        return () => unsub && unsub();
    }, []);

    if (!canAccess(user?.role, 'student_stats')) return <AccessDenied />;

    const { current, byFaculty, byEnrollmentYear, scienceFaculty } = studentStatsData;
    const studentRows = getStudentListSync();
    const scienceMajorRows = buildScienceMajorRows(scienceFaculty, studentRows);

    const isFiltered = appliedFaculty !== 'all' || appliedLevel !== 'all';

    // Apply filters using the committed (applied) values
    const filteredFaculty = appliedFaculty === 'all'
        ? byFaculty
        : byFaculty.filter(f => f.name === appliedFaculty);

    const filteredTotal = filteredFaculty.reduce((sum, f) => {
        if (appliedLevel === 'all') return sum + (f.certificate || 0) + f.bachelor + f.master + f.doctoral;
        if (appliedLevel === 'certificate') return sum + (f.certificate || 0);
        if (appliedLevel === 'bachelor') return sum + f.bachelor;
        if (appliedLevel === 'master') return sum + f.master;
        if (appliedLevel === 'doctoral') return sum + f.doctoral;
        return sum;
    }, 0);

    // Build filtered stat cards from applied filters
    const filteredByLevel = (() => {
        const levels = [
            { level: 'ประกาศนียบัตร', key: 'certificate', color: getStudentLevelColor('ประกาศนียบัตร', 0) },
            { level: 'ปริญญาตรี', key: 'bachelor', color: getStudentLevelColor('ปริญญาตรี', 1) },
            { level: 'ปริญญาโท', key: 'master', color: getStudentLevelColor('ปริญญาโท', 2) },
            { level: 'ปริญญาเอก', key: 'doctoral', color: getStudentLevelColor('ปริญญาเอก', 3) },
        ];
        if (appliedLevel !== 'all') {
            const lvl = levels.find(l => l.key === appliedLevel);
            return lvl ? [{ ...lvl, count: filteredFaculty.reduce((s, f) => s + Number(f[lvl.key] || 0), 0) }] : [];
        }
        return levels.map(l => ({ ...l, count: filteredFaculty.reduce((s, f) => s + Number(f[l.key] || 0), 0) }));
    })();

    const levelCompositionItems = current.byLevel.map((item, i) => ({
        label: item.level,
        value: item.count,
        color: `var(--chart-${(i % 5) + 1})`,
    }));

    // MJU exposes the current headcount split by entry year. This is a cohort
    // snapshot, not a historical total or an original admissions count.
    const overallEntryRows = (Array.isArray(byEnrollmentYear) ? byEnrollmentYear : [])
        .filter(row => Number(row.total || row.count || 0) > 0)
        .sort((a, b) => Number(a.year || 0) - Number(b.year || 0));

    const trendLineData = {
        labels: overallEntryRows.map(row => `ปี ${row.year}`),
        datasets: [
            {
                label: 'นักศึกษาคงอยู่ทั้งหมด',
                data: overallEntryRows.map(row => Number(row.total || row.count || 0)),
                borderColor: 'var(--accent-success)',
                backgroundColor: 'color-mix(in srgb, var(--accent-success) 12%, transparent)',
                fill: true,
                tension: 0.28,
                pointBackgroundColor: 'var(--accent-success)',
                pointRadius: 5,
                pointHoverRadius: 7,
            },
            {
                label: 'ป.ตรี',
                data: overallEntryRows.map(row => Number(row.bachelor || 0)),
                borderColor: 'var(--accent-blue)',
                tension: 0.28,
                pointRadius: 4,
                borderWidth: 2,
            },
            {
                label: 'ป.โท + ป.เอก',
                data: overallEntryRows.map(row => Number(row.master || 0) + Number(row.doctoral || 0)),
                borderColor: 'var(--accent-warning)',
                tension: 0.28,
                pointRadius: 4,
                borderWidth: 2,
            }
        ]
    };

    const trendLineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { color: 'var(--text-muted)', padding: 12, font: { size: 11 } } },
            tooltip: {
                callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString() || '-'} คน` }
            }
        },
        scales: {
            x: { ticks: { color: 'var(--text-muted)' }, grid: { display: false } },
            y: {
                ticks: { color: 'var(--text-muted)', callback: (v) => v.toLocaleString() },
                grid: { color: 'var(--border-color)' }
            }
        }
    };

    // ==================== Science Faculty Charts ====================
    const scienceLevelCompositionItems = scienceFaculty.byLevel
        .filter(item => Number(item.count || 0) > 0)
        .map((item, i) => ({
            label: item.level,
            value: item.count,
            color: `var(--chart-${(i % 5) + 1})`,
        }));

    const majorBarData = {
        labels: scienceMajorRows.map(row => row.major),
        datasets: [{
            label: 'จำนวนนิสิต',
            data: scienceMajorRows.map(row => row.total),
            backgroundColor: scienceMajorRows.map((_, i) => {
                const colors = ['color-mix(in srgb, var(--accent-blue) 78%, transparent)', 'color-mix(in srgb, var(--accent-success) 78%, transparent)', 'color-mix(in srgb, var(--accent-purple) 78%, transparent)', 'color-mix(in srgb, var(--accent-orange) 78%, transparent)', 'color-mix(in srgb, var(--accent-cyan) 78%, transparent)', 'color-mix(in srgb, var(--accent-pink) 76%, transparent)', 'color-mix(in srgb, var(--accent-gold) 78%, transparent)', 'color-mix(in srgb, var(--accent-purple) 76%, transparent)', 'color-mix(in srgb, var(--text-muted) 76%, transparent)'];
                return colors[i] || 'color-mix(in srgb, var(--accent-success) 70%, transparent)';
            }),
            borderColor: scienceMajorRows.map((_, i) => {
                const colors = ['var(--accent-blue)', 'var(--accent-success)', 'var(--accent-purple)', 'var(--accent-orange)', 'var(--accent-cyan)', 'var(--accent-pink)', 'var(--accent-gold)', 'var(--accent-purple)', 'var(--text-muted)'];
                return colors[i] || 'var(--accent-success)';
            }),
            borderWidth: 1,
            borderRadius: 8,
            borderSkipped: false,
        }]
    };

    const majorBarOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: { label: (ctx) => `${ctx.parsed.y.toLocaleString()} คน (คลิกเพื่อดูรายชื่อ)` }
            }
        },
        scales: {
            x: {
                ticks: { color: 'var(--text-muted)', maxRotation: 35, minRotation: 0 },
                grid: { display: false }
            },
            y: {
                ticks: { color: 'var(--text-muted)' },
                grid: { color: 'var(--border-color)' }
            }
        }
    };

    const studentDataNote = 'รายชื่อที่แสดงดึงจาก studentDataService ซึ่งอัปเดตตาม Firestore/ไฟล์อัปโหลดล่าสุดแบบ realtime';

    const openOverallLevelDetail = (point) => {
        const rows = studentRows.filter(student => student.level === point.label);
        const detailRows = buildLevelDrilldownRows(point, rows, 'MJU Dashboard (ภาพรวมมหาวิทยาลัย)', studentDataNote);
        setDrillDetail({
            title: `นักศึกษา ${point.label}`,
            subtitle: 'รายละเอียดจากข้อมูลนักศึกษาที่ระบบมีอยู่',
            valueLabel: point.label,
            value: point.value,
            unit: 'คน',
            accentColor: point.color,
            ...detailRows,
        });
    };

    const openScienceLevelDetail = (point) => {
        const rows = studentRows.filter(student => student.level === point.label);
        const detailRows = buildLevelDrilldownRows(point, rows, 'MJU Dashboard (คณะวิทยาศาสตร์)', studentDataNote);
        setDrillDetail({
            title: `คณะวิทยาศาสตร์: ${point.label}`,
            subtitle: 'รายชื่อนักศึกษาในระดับที่เลือก',
            valueLabel: point.label,
            value: point.value,
            unit: 'คน',
            accentColor: point.color,
            ...detailRows,
        });
    };

    const trendLineDrilldownOptions = withChartDrilldown(trendLineOptions, trendLineData, setDrillDetail, (point) => {
        const row = overallEntryRows[point.index];
        return {
            title: `นักศึกษาคงอยู่ที่รับเข้า ${point.label}`,
            subtitle: `${point.datasetLabel} · ภาพถ่ายข้อมูลปัจจุบันจาก MJU Dashboard`,
            valueLabel: point.datasetLabel,
            value: point.value,
            unit: 'คน',
            accentColor: point.color,
            rows: row ? [row] : [],
            columns: [
                { key: 'year', label: 'ปีที่รับเข้า' },
                { key: 'total', label: 'รวม', align: 'right' },
                { key: 'certificate', label: 'ประกาศนียบัตร', align: 'right' },
                { key: 'bachelor', label: 'ป.ตรี', align: 'right' },
                { key: 'master', label: 'ป.โท', align: 'right' },
                { key: 'doctoral', label: 'ป.เอก', align: 'right' },
            ],
        };
    });

    const majorBarDrilldownOptions = withChartDrilldown(majorBarOptions, majorBarData, setDrillDetail, (point) => {
        const majorRow = scienceMajorRows[point.index] || normalizeMajorRow({ major: point.label, total: point.value });
        const rows = studentRows.filter(student => String(student.major || '') === String(majorRow.major));
        return {
            title: `นิสิตสาขา${majorRow.major}`,
            subtitle: 'รายชื่อนิสิตคณะวิทยาศาสตร์ตามสาขาที่เลือก',
            valueLabel: 'จำนวนนิสิต',
            value: point.value,
            unit: 'คน',
            accentColor: point.color,
            rows,
            columns: studentColumns,
            metrics: [
                { label: 'ปริญญาตรี', value: majorRow.bachelor, unit: 'คน' },
                { label: 'ปริญญาโท', value: majorRow.master, unit: 'คน' },
                { label: 'ปริญญาเอก', value: majorRow.doctoral, unit: 'คน' },
                ...(majorRow.avgGPA ? [{ label: 'GPA เฉลี่ย', value: majorRow.avgGPA }] : []),
            ],
            note: noteWhenRowsDiffer(rows, point.value, studentDataNote),
        };
    });

    const scienceGenderMale = Number(scienceFaculty.byGender?.male);
    const scienceGenderFemale = Number(scienceFaculty.byGender?.female);
    const scienceGenderTotal = scienceGenderMale + scienceGenderFemale;
    const hasScienceGenderData = Number.isFinite(scienceGenderMale)
        && Number.isFinite(scienceGenderFemale)
        && scienceGenderTotal > 0;
    const genderData = {
        labels: ['ชาย', 'หญิง'],
        datasets: [{
            data: [scienceGenderMale || 0, scienceGenderFemale || 0],
            backgroundColor: ['var(--accent-blue)', 'var(--accent-pink)'],
            borderWidth: 0,
            cutout: '65%',
        }]
    };

    const genderOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { color: 'var(--text-muted)', padding: 14, font: { size: 12 } } },
            tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed.toLocaleString()} คน (${((ctx.parsed / scienceGenderTotal) * 100).toFixed(1)}%)` } }
        }
    };

    const genderDrilldownOptions = withChartDrilldown(genderOptions, genderData, setDrillDetail, (point) => {
        const rows = studentRows.filter(student => {
            const prefix = String(student.prefix || '');
            return point.index === 0 ? prefix === 'นาย' : prefix && prefix !== 'นาย';
        });
        return {
            title: `นักศึกษาคณะวิทยาศาสตร์: ${point.label}`,
            subtitle: 'สัดส่วนเพศนักศึกษาจากข้อมูลคณะวิทยาศาสตร์',
            valueLabel: point.label,
            value: point.value,
            unit: 'คน',
            accentColor: point.color,
            rows,
            columns: studentColumns,
            note: rows.length ? noteWhenRowsDiffer(rows, point.value, studentDataNote) : 'กราฟเพศเป็นข้อมูลสรุปรวม หากไฟล์อัปโหลดไม่มีคอลัมน์ prefix/เพศ ระบบจะแสดงเฉพาะยอดรวมจากกราฟ',
        };
    });

    const ratioData = {
        labels: scienceFaculty.studentFacultyRatio.comparison.map(c => c.name),
        datasets: [{
            label: 'อัตราส่วน นศ./อาจารย์',
            data: scienceFaculty.studentFacultyRatio.comparison.map(c => c.ratio),
            backgroundColor: scienceFaculty.studentFacultyRatio.comparison.map((_, i) => {
                const p = ['var(--accent-success)', 'var(--accent-warning)', 'var(--accent-blue)', 'var(--accent-purple)', 'var(--accent-pink)', 'var(--accent-cyan)'];
                return p[i % p.length] + 'cc';
            }),
            borderColor: scienceFaculty.studentFacultyRatio.comparison.map((_, i) => {
                const p = ['var(--accent-success)', 'var(--accent-warning)', 'var(--accent-blue)', 'var(--accent-purple)', 'var(--accent-pink)', 'var(--accent-cyan)'];
                return p[i % p.length];
            }),
            borderWidth: 1, borderRadius: 4,
        }]
    };

    const ratioOptions = {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.x}:1` } }
        },
        scales: {
            x: { ticks: { color: 'var(--text-muted)', callback: v => v + ':1' }, grid: { color: 'var(--border-color)' } },
            y: { ticks: { color: 'var(--text-primary)', font: { size: 11 } }, grid: { display: false } }
        }
    };

    const ratioDrilldownOptions = withChartDrilldown(ratioOptions, ratioData, setDrillDetail, (point) => {
        const row = scienceFaculty.studentFacultyRatio.comparison[point.index];
        if (!row) return null;
        return {
            title: `อัตราส่วนนักศึกษาต่ออาจารย์: ${row.name}`,
            subtitle: 'เปรียบเทียบเกณฑ์และหน่วยงานอ้างอิง',
            valueLabel: 'อัตราส่วน',
            value: row.ratio,
            unit: ':1',
            accentColor: point.color || row.color,
            rows: scienceFaculty.studentFacultyRatio.comparison.map(item => ({
                name: item.name,
                ratio: `${item.ratio}:1`,
                students: item.name === 'คณะวิทยาศาสตร์ มจ.' ? scienceFaculty.studentFacultyRatio.students : '-',
                academicStaff: item.name === 'คณะวิทยาศาสตร์ มจ.' ? scienceFaculty.studentFacultyRatio.academicStaff : '-',
            })),
            columns: [
                { key: 'name', label: 'หน่วยงาน/เกณฑ์' },
                { key: 'ratio', label: 'อัตราส่วน', align: 'right' },
                { key: 'students', label: 'นักศึกษา', align: 'right' },
                { key: 'academicStaff', label: 'อาจารย์', align: 'right' },
            ],
            note: `คณะวิทยาศาสตร์คำนวณจากนักศึกษา ${Number(scienceFaculty.studentFacultyRatio.students || 0).toLocaleString('th-TH')} คน และบุคลากรสายวิชาการ ${Number(scienceFaculty.studentFacultyRatio.academicStaff || 0).toLocaleString('th-TH')} คน`,
        };
    });

    const intakeTrendRows = (Array.isArray(scienceFaculty.newStudentIntake) ? scienceFaculty.newStudentIntake : [])
        .filter(row => Number(row.total || 0) > 0 || Number(row.bachelor || 0) > 0 || Number(row.master || 0) > 0 || Number(row.doctoral || 0) > 0)
        .sort((a, b) => Number(a.year || 0) - Number(b.year || 0))
        .slice(-5);

    const intakeData = {
        labels: intakeTrendRows.map(s => `ปี ${s.year}`),
        datasets: [
            {
                label: 'ป.ตรี',
                data: intakeTrendRows.map(s => s.bachelor),
                backgroundColor: 'color-mix(in srgb, var(--accent-blue) 86%, transparent)',
                borderColor: 'var(--accent-blue)',
                borderWidth: 1,
                borderRadius: 10,
                borderSkipped: false,
                barPercentage: 0.62,
                categoryPercentage: 0.72,
            },
            {
                label: 'ป.โท + ป.เอก',
                data: intakeTrendRows.map(s => s.master + s.doctoral),
                backgroundColor: 'color-mix(in srgb, var(--accent-purple) 84%, transparent)',
                borderColor: 'var(--accent-purple)',
                borderWidth: 1,
                borderRadius: 10,
                borderSkipped: false,
                barPercentage: 0.62,
                categoryPercentage: 0.72,
                minBarLength: 3,
            }
        ]
    };

    const intakeOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: 'var(--text-muted)',
                    padding: 14,
                    usePointStyle: true,
                    pointStyle: 'circle',
                    font: { size: 12, weight: 600 },
                },
            },
            tooltip: {
                backgroundColor: 'var(--chart-tooltip-bg)',
                titleColor: 'var(--text-on-accent)',
                bodyColor: 'var(--chart-muted)',
                borderColor: 'var(--accent-border-soft)',
                borderWidth: 1,
                cornerRadius: 12,
                padding: 12,
                displayColors: true,
                callbacks: {
                    title: (items) => items?.[0]?.label || '',
                    label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('th-TH')} คน`,
                    footer: (items) => {
                        const row = intakeTrendRows[items?.[0]?.dataIndex];
                        return row ? `รวม ${Number(row.total || 0).toLocaleString('th-TH')} คน` : '';
                    },
                },
            },
        },
        scales: {
            x: {
                stacked: true,
                ticks: { color: 'var(--text-muted)', font: { size: 12, weight: 600 } },
                grid: { display: false },
                border: { display: false },
            },
            y: {
                stacked: true,
                beginAtZero: true,
                ticks: { color: 'var(--text-muted)', callback: value => Number(value).toLocaleString('th-TH') },
                grid: { color: 'color-mix(in srgb, var(--text-subtle) 16%, transparent)' },
                border: { display: false },
            }
        }
    };

    const intakeDrilldownOptions = withChartDrilldown(intakeOptions, intakeData, setDrillDetail, (point) => {
        const intake = intakeTrendRows[point.index];
        if (!intake) return null;
        const shortYear = String(intake.year).slice(-2);
        const rows = studentRows.filter(student => {
            const sameYear = String(student.id || '').slice(0, 2) === shortYear;
            const level = String(student.level || '');
            return sameYear && (point.datasetIndex === 0 ? level.includes('ตรี') : !level.includes('ตรี'));
        });
        return {
            title: `นักศึกษาคงอยู่ที่รับเข้าปี ${intake.year}: ${point.datasetLabel}`,
            subtitle: 'จำนวนผู้ที่ยังมีสถานะศึกษาอยู่ แยกตามปีที่รับเข้า ไม่ใช่จำนวนรับเข้าเดิมทั้งหมด',
            valueLabel: point.datasetLabel,
            value: point.value,
            unit: 'คน',
            accentColor: point.color,
            rows,
            columns: studentColumns,
            metrics: [
                { label: 'รวมทั้งปี', value: intake.total, unit: 'คน' },
                { label: 'โควตา', value: intake.channels.quota, unit: 'คน' },
                { label: 'รับตรง', value: intake.channels.directAdmit, unit: 'คน' },
                { label: 'TCAS', value: intake.channels.tcas, unit: 'คน' },
            ],
            note: rows.length ? noteWhenRowsDiffer(rows, point.value, studentDataNote) : 'ข้อมูลนี้เป็นนักศึกษาคงอยู่ปัจจุบันแยกตามปีที่รับเข้า หากต้องการจำนวนผู้สมัคร/รับเข้าเดิมให้ใช้ข้อมูล TCAS หรือ Reg admissions',
        };
    });

    const scienceSharePct = ((scienceFaculty.total / current.total) * 100).toFixed(1);

    return (
        <div>
            <ChartDrilldownModal detail={drillDetail} onClose={() => setDrillDetail(null)} />
            <Link to="/dashboard" className="back-button">
                <ArrowLeft size={16} /> กลับหน้าหลัก
            </Link>

            <ProductPageHeader
                icon={BarChart3}
                eyebrow="STUDENT INTELLIGENCE"
                title="สถิตินิสิตปัจจุบัน"
                subtitle="ภาพรวมนักศึกษาคณะวิทยาศาสตร์ ระดับการศึกษา สาขา และแนวโน้มล่าสุด"
                tone="violet"
                actions={<ExportPDFButton title="สถิตินิสิตปัจจุบัน" />}
            />

            {/* Knowledge Dynamic Dashboard — Filter Bar */}
            <div className="filter-bar">
                <label>ตัวกรอง:</label>
                <select value={selectedFaculty} onChange={(e) => setSelectedFaculty(e.target.value)}>
                    <option value="all">ทุกคณะ</option>
                    {byFaculty.map((f, i) => (
                        <option key={i} value={f.name}>{f.name}</option>
                    ))}
                </select>
                <select value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)}>
                    <option value="all">ทุกระดับ</option>
                    <option value="certificate">ประกาศนียบัตร</option>
                    <option value="bachelor">ปริญญาตรี</option>
                    <option value="master">ปริญญาโท</option>
                    <option value="doctoral">ปริญญาเอก</option>
                </select>
                <button className="filter-apply-btn" onClick={() => { setAppliedFaculty(selectedFaculty); setAppliedLevel(selectedLevel); }}>
                    <Filter size={14} /> Apply Filters
                </button>
                <button className="filter-reset-btn" onClick={() => {
                    setSelectedFaculty('all');
                    setSelectedLevel('all');
                    setAppliedFaculty('all');
                    setAppliedLevel('all');
                }}>
                    <RotateCcw size={12} /> Reset
                </button>
                {isFiltered && (
                    <span style={{ fontSize: '0.85rem', color: 'var(--accent-success)', fontWeight: 600, marginLeft: 'auto' }}>
                        กรอง: {appliedFaculty !== 'all' ? appliedFaculty : 'ทุกคณะ'} / {appliedLevel !== 'all' ? LEVEL_FILTER_LABELS[appliedLevel] : 'ทุกระดับ'} — ผลลัพธ์: {filteredTotal.toLocaleString()} คน
                    </span>
                )}
            </div>

            {/* Summary Stats */}
            <div className="stats-grid">
                {(isFiltered ? filteredByLevel : current.byLevel).map((item, i) => {
                    const levelColor = getStudentLevelColor(item.level, i);
                    return (
                        <div key={i} className="stat-card animate-in">
                            <div className="stat-card-header">
                                <div className="stat-card-icon" style={{ background: themeGradient(levelColor) }}>
                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {item.key === 'bachelor' || (!item.key && i === 0) ? <GraduationCap size={20} color="var(--text-on-accent)" /> : item.key === 'master' || (!item.key && i === 1) ? <BookOpen size={20} color="var(--text-on-accent)" /> : item.key === 'doctoral' || (!item.key && i === 2) ? <Award size={20} color="var(--text-on-accent)" /> : <FileText size={20} color="var(--text-on-accent)" />}
                                    </span>
                                </div>
                            </div>
                            <div className="stat-card-value">{item.count.toLocaleString()}</div>
                            <div className="stat-card-label">{item.level}</div>
                        </div>
                    );
                })}
            </div>

            {/* Charts */}
            <div className="charts-grid">
                <div className="chart-card animate-in">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">สัดส่วนนิสิตแต่ละระดับ</div>
                            <div className="chart-card-subtitle">รวมทั้งหมด {current.total.toLocaleString()} คน</div>
                        </div>
                    </div>
                    <CompositionBreakdown
                        items={levelCompositionItems}
                        total={current.total}
                        ariaLabel="Student level composition"
                        onItemClick={openOverallLevelDetail}
                    />
                </div>

                <div className="chart-card animate-in">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">นักศึกษาคงอยู่ตามปีที่รับเข้า</div>
                            <div className="chart-card-subtitle">ข้อมูลปัจจุบันทุกคณะจาก MJU Dashboard · ไม่ใช่ยอดรับเข้าเดิมหรือยอดรวมย้อนหลัง</div>
                        </div>
                    </div>
                    <div className="chart-container">
                        <Line data={trendLineData} options={trendLineDrilldownOptions} />
                    </div>
                </div>
            </div>

            {/* Faculty Table */}
            <div className="data-table-container animate-in" style={{ marginTop: 32 }}>
                <div className="data-table-header">
                    <span className="data-table-title">จำนวนนิสิตแยกตามคณะ{isFiltered ? ' (กรองแล้ว)' : ''}</span>
                </div>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>คณะ</th>
                            {(appliedLevel === 'all' || appliedLevel === 'certificate') && <th>ประกาศนียบัตร</th>}
                            {(appliedLevel === 'all' || appliedLevel === 'bachelor') && <th>ป.ตรี</th>}
                            {(appliedLevel === 'all' || appliedLevel === 'master') && <th>ป.โท</th>}
                            {(appliedLevel === 'all' || appliedLevel === 'doctoral') && <th>ป.เอก</th>}
                            {appliedLevel === 'all' && <th>รวม</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredFaculty.map((fac, i) => {
                            const total = appliedLevel === 'all'
                                ? Number(fac.certificate || 0) + Number(fac.bachelor || 0) + Number(fac.master || 0) + Number(fac.doctoral || 0)
                                : Number(fac[appliedLevel] || 0);
                            const isSci = fac.name === 'คณะวิทยาศาสตร์';
                            return (
                                <tr key={i} style={isSci ? { background: 'color-mix(in srgb, var(--accent-success-deep) 15%, transparent)', borderLeft: '3px solid var(--accent-success)' } : {}}>
                                    <td style={{ fontWeight: isSci ? 700 : 500, color: isSci ? 'var(--accent-success)' : undefined }}>{fac.name}</td>
                                    {(appliedLevel === 'all' || appliedLevel === 'certificate') && <td style={{ color: 'var(--accent-success)' }}>{Number(fac.certificate || 0).toLocaleString()}</td>}
                                    {(appliedLevel === 'all' || appliedLevel === 'bachelor') && <td style={{ color: 'var(--mju-green-light)' }}>{fac.bachelor.toLocaleString()}</td>}
                                    {(appliedLevel === 'all' || appliedLevel === 'master') && <td style={{ color: 'var(--accent-info)' }}>{fac.master}</td>}
                                    {(appliedLevel === 'all' || appliedLevel === 'doctoral') && <td style={{ color: 'var(--accent-pink)' }}>{fac.doctoral}</td>}
                                    {appliedLevel === 'all' && <td style={{ fontWeight: 700 }}>{total.toLocaleString()}</td>}
                                </tr>
                            );
                        })}
                        <tr style={{ background: 'color-mix(in srgb, var(--accent-success-deep) 10%, transparent)', fontWeight: 700 }}>
                            <td>รวม{isFiltered ? ' (กรองแล้ว)' : 'ทั้งหมด'}</td>
                            {(appliedLevel === 'all' || appliedLevel === 'certificate') && <td style={{ color: 'var(--accent-success)' }}>{filteredFaculty.reduce((s, f) => s + Number(f.certificate || 0), 0).toLocaleString()}</td>}
                            {(appliedLevel === 'all' || appliedLevel === 'bachelor') && <td style={{ color: 'var(--mju-green-light)' }}>{filteredFaculty.reduce((s, f) => s + f.bachelor, 0).toLocaleString()}</td>}
                            {(appliedLevel === 'all' || appliedLevel === 'master') && <td style={{ color: 'var(--accent-info)' }}>{filteredFaculty.reduce((s, f) => s + f.master, 0)}</td>}
                            {(appliedLevel === 'all' || appliedLevel === 'doctoral') && <td style={{ color: 'var(--accent-pink)' }}>{filteredFaculty.reduce((s, f) => s + f.doctoral, 0)}</td>}
                            {appliedLevel === 'all' && <td>{filteredFaculty.reduce((s, f) => s + Number(f.certificate || 0) + Number(f.bachelor || 0) + Number(f.master || 0) + Number(f.doctoral || 0), 0).toLocaleString()}</td>}
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* ==================== คณะวิทยาศาสตร์ Section ==================== */}
            <div style={{ marginTop: 48, paddingTop: 32, borderTop: '2px solid color-mix(in srgb, var(--accent-success) 20%, transparent)' }}>
                <div className="section-header">
                    <div className="section-header-icon" style={{ background: 'linear-gradient(135deg, var(--accent-success-deep), var(--accent-success))' }}>
                        <Microscope size={22} color="var(--text-on-accent)" />
                    </div>
                    <div>
                        <h2>คณะวิทยาศาสตร์</h2>
                        <p>Faculty of Science — ข้อมูลนิสิตและบุคลากร เฉพาะคณะวิทยาศาสตร์</p>
                    </div>
                    <div style={{
                        marginLeft: 'auto',
                        background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-success-deep) 20%, transparent), color-mix(in srgb, var(--accent-success) 10%, transparent))',
                        border: '1px solid color-mix(in srgb, var(--accent-success) 30%, transparent)',
                        borderRadius: 12,
                        padding: '8px 18px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center'
                    }}>
                        <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-success)' }}>{scienceFaculty.total.toLocaleString()}</span>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>คน ({scienceSharePct}% ของทั้งมหาวิทยาลัย)</span>
                    </div>
                </div>

                {/* Science Faculty Stat Cards */}
                <div className="stats-grid">
                    {scienceFaculty.byLevel.map((item, i) => {
                        const levelColor = getStudentLevelColor(item.level, i);
                        return (
                            <div key={i} className="stat-card animate-in" style={{
                                borderTop: `3px solid ${legacyColorToVar(levelColor)}`,
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    top: 0, right: 0,
                                    width: 80, height: 80,
                                    background: `radial-gradient(circle at top right, ${themeAlpha(levelColor, 8)}, transparent 70%)`,
                                    borderRadius: '0 0 0 100%'
                                }} />
                                <div className="stat-card-header">
                                    <div className="stat-card-icon" style={{ background: themeGradient(levelColor) }}>
                                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {i === 0 ? <GraduationCap size={20} color="var(--text-on-accent)" /> : i === 1 ? <BookOpen size={20} color="var(--text-on-accent)" /> : i === 2 ? <Award size={20} color="var(--text-on-accent)" /> : <FileText size={20} color="var(--text-on-accent)" />}
                                        </span>
                                    </div>
                                    {item.count > 0 && (
                                        <span style={{
                                            fontSize: 12,
                                            color: 'var(--text-secondary)',
                                            background: 'var(--bg-secondary)',
                                            padding: '3px 10px',
                                            borderRadius: 8,
                                            fontWeight: 600
                                        }}>
                                            {((item.count / scienceFaculty.total) * 100).toFixed(1)}%
                                        </span>
                                    )}
                                </div>
                                <div className="stat-card-value">{item.count.toLocaleString()}</div>
                                <div className="stat-card-label">{item.level}</div>
                            </div>
                        );
                    })}
                </div>

                {/* Science Faculty Charts */}
                <div className="charts-grid">
                    <div className="chart-card animate-in">
                        <div className="chart-card-header">
                            <div>
                                <div className="chart-card-title">สัดส่วนนิสิต คณะวิทยาศาสตร์</div>
                                <div className="chart-card-subtitle">รวม {scienceFaculty.total.toLocaleString()} คน</div>
                            </div>
                        </div>
                        <CompositionBreakdown
                            items={scienceLevelCompositionItems}
                            total={scienceFaculty.total}
                            ariaLabel="Science faculty student level composition"
                            onItemClick={openScienceLevelDetail}
                        />
                    </div>

                    <div className="chart-card animate-in">
                        <div className="chart-card-header">
                            <div>
                                <div className="chart-card-title">จำนวนนิสิตแยกตามสาขา</div>
                                <div className="chart-card-subtitle">คณะวิทยาศาสตร์ — ใช้ข้อมูลนิสิตล่าสุดชุดเดียวกับ AI</div>
                            </div>
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                fontSize: '0.75rem', color: 'var(--accent-purple)', fontWeight: 600,
                                padding: '4px 10px', background: 'color-mix(in srgb, var(--accent-purple) 12%, transparent)',
                                borderRadius: 999
                            }}>
                                <MousePointerClick size={12} /> คลิกแท่งเพื่อดูรายชื่อ
                            </span>
                        </div>
                        <div className="chart-container">
                            <Bar data={majorBarData} options={majorBarDrilldownOptions} />
                        </div>
                    </div>
                </div>

                {/* ==================== NEW: Gender + Ratio + Intake ==================== */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginTop: 24 }}>
                    {/* Gender Distribution */}
                    <div className="chart-card animate-in">
                        <div className="chart-card-header">
                            <div>
                                <div className="chart-card-title">สัดส่วนเพศนักศึกษา</div>
                                <div className="chart-card-subtitle">คณะวิทยาศาสตร์ — สัดส่วนเพศนักศึกษาปัจจุบัน</div>
                            </div>
                        </div>
                        {hasScienceGenderData ? (
                            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16 }}>
                                <div className="chart-container" style={{ height: 200 }}>
                                    <Doughnut data={genderData} options={genderDrilldownOptions} />
                                </div>
                                <div style={{ display: 'flex', gap: 24, justifyContent: 'flex-start', width: '100%' }}>
                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-info)' }}>{scienceFaculty.byGender.male}</div>
                                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>ชาย ({scienceFaculty.byGender.malePercent}%)</div>
                                    </div>
                                    <div style={{ width: 1, background: 'var(--border-color)' }} />
                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-pink)' }}>{scienceFaculty.byGender.female}</div>
                                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>หญิง ({scienceFaculty.byGender.femalePercent}%)</div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="data-empty-state" style={{ minHeight: 230, padding: 28 }}>
                                <strong>ยังไม่มีข้อมูลแยกเพศที่ยืนยันได้</strong>
                                <span>เมื่อเชื่อมไฟล์ Reg ที่ได้รับอนุญาต ระบบจะแสดงกราฟส่วนนี้อัตโนมัติ</span>
                            </div>
                        )}
                    </div>

                    {/* Student-to-Faculty Ratio */}
                    <div className="chart-card animate-in">
                        <div className="chart-card-header">
                            <div>
                                <div className="chart-card-title">อัตราส่วน นศ. ต่ออาจารย์</div>
                                <div className="chart-card-subtitle">เปรียบเทียบกับเกณฑ์ สกอ. และมหาวิทยาลัยอื่น</div>
                            </div>
                        </div>
                        <div style={{ padding: '0 20px 20px' }}>
                            <div style={{
                                textAlign: 'left', padding: '16px', marginBottom: 16,
                                background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-success-deep) 15%, transparent), color-mix(in srgb, var(--accent-success) 8%, transparent))',
                                border: '1px solid color-mix(in srgb, var(--accent-success) 30%, transparent)', borderRadius: 12
                            }}>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>อัตราส่วน นศ./อาจารย์</div>
                                <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--accent-success)' }}>{scienceFaculty.studentFacultyRatio.ratio}:1</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>({scienceFaculty.studentFacultyRatio.students} นศ. / {scienceFaculty.studentFacultyRatio.academicStaff} อาจารย์)</div>
                            </div>
                            <div className="chart-container" style={{ height: 180 }}>
                                <Bar data={ratioData} options={ratioDrilldownOptions} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* New Student Intake */}
                <div className="chart-card intake-trend-card animate-in">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">นักศึกษาคงอยู่ตามปีที่รับเข้า คณะวิทยาศาสตร์</div>
                            <div className="chart-card-subtitle">ย้อนหลัง 5 ปี — อ้างอิงจาก MJU Dashboard</div>
                        </div>
                    </div>
                    <div className="intake-trend-layout grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)] gap-5">
                        <div className="chart-container intake-trend-chart">
                            <Bar data={intakeData} options={intakeDrilldownOptions} />
                        </div>
                        <div className="intake-year-summary">
                            {intakeTrendRows.map((intake, i) => {
                                const prev = i > 0 ? intakeTrendRows[i - 1].total : null;
                                const growth = prev ? (((intake.total - prev) / prev) * 100).toFixed(1) : null;
                                return (
                                    <div key={intake.year} className="intake-year-card">
                                        <div className="intake-year-card-main">
                                            <span>ปี {intake.year}</span>
                                            <strong>{Number(intake.total || 0).toLocaleString('th-TH')}</strong>
                                        </div>
                                        {growth && (
                                            <span className={parseFloat(growth) >= 0 ? 'intake-growth up' : 'intake-growth down'}>
                                                {parseFloat(growth) >= 0 ? '↑' : '↓'} {growth}%
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Personnel & Nationality Info */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginTop: 24 }}>
                    {/* Personnel Card */}
                    <div className="chart-card animate-in">
                        <div className="chart-card-header">
                            <div>
                                <div className="chart-card-title">บุคลากรคณะวิทยาศาสตร์</div>
                                <div className="chart-card-subtitle">
                                    รวม {scienceFaculty.personnel.total} คน
                                    {Number.isFinite(Number(scienceFaculty.personnel.male)) && Number.isFinite(Number(scienceFaculty.personnel.female))
                                        ? ` (ชาย ${scienceFaculty.personnel.male} / หญิง ${scienceFaculty.personnel.female})`
                                        : ' · MJU Dashboard ยังไม่ส่งข้อมูลแยกเพศในชุดนี้'}
                                </div>
                            </div>
                        </div>
                        <div style={{ padding: '0 20px 20px' }}>
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>ตำแหน่งทางวิชาการ</div>
                                {scienceFaculty.personnel.byPosition.map((pos, i) => {
                                    const pct = ((pos.count / scienceFaculty.personnel.total) * 100).toFixed(0);
                                    const colors = ['var(--accent-success-deep)', 'var(--accent-info)', 'var(--accent-gold)'];
                                    return (
                                        <div key={i} style={{ marginBottom: 10 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                                                <span style={{ color: 'var(--text-primary)' }}>{pos.position}</span>
                                                <span style={{ color: colors[i], fontWeight: 700 }}>{pos.count} คน ({pct}%)</span>
                                            </div>
                                            <div style={{ height: 6, borderRadius: 3, background: 'var(--border-color)', overflow: 'hidden' }}>
                                                <div style={{
                                                    width: `${pct}%`,
                                                    height: '100%',
                                                    background: `linear-gradient(90deg, ${colors[i]}, ${colors[i]}aa)`,
                                                    borderRadius: 3,
                                                    transition: 'width 1s ease-out'
                                                }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>ประเภทการจ้าง</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                                    {scienceFaculty.personnel.byType.map((t, i) => (
                                        <div key={i} style={{
                                            flex: '1 1 140px',
                                            background: 'var(--bg-secondary)',
                                            borderRadius: 10,
                                            padding: '12px 14px',
                                            textAlign: 'center',
                                            border: '1px solid var(--border-color)'
                                        }}>
                                            <div style={{ fontSize: 22, fontWeight: 800, color: i === 0 ? 'var(--accent-success)' : 'var(--accent-gold)' }}>{t.count}</div>
                                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, fontWeight: 500 }}>{t.type}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>ระดับการศึกษา</div>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    {scienceFaculty.personnel.byEducation.map((e, i) => (
                                        <div key={i} style={{
                                            flex: 1,
                                            background: 'var(--bg-secondary)',
                                            borderRadius: 10,
                                            padding: '12px 14px',
                                            textAlign: 'center',
                                            border: '1px solid var(--border-color)'
                                        }}>
                                            <div style={{ fontSize: 22, fontWeight: 800, color: i === 0 ? 'var(--accent-purple)' : 'var(--accent-info)' }}>{e.count}</div>
                                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, fontWeight: 500 }}>{e.level}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Nationality Card */}
                    <div className="chart-card animate-in">
                        <div className="chart-card-header">
                            <div>
                                <div className="chart-card-title">สัญชาตินิสิต คณะวิทยาศาสตร์</div>
                                <div className="chart-card-subtitle">จำแนกตามสัญชาติ</div>
                            </div>
                        </div>
                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {scienceFaculty.byNationality.map((n, i) => {
                                const pct = ((n.count / scienceFaculty.total) * 100).toFixed(1);
                                const color = i === 0 ? 'var(--accent-success-deep)' : 'var(--accent-orange)';
                                return (
                                    <div key={i}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{
                                                    width: 40, height: 40,
                                                    borderRadius: 10,
                                                    background: themeGradient(color),
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: 20
                                                }}>
                                                    {i === 0 ? 'TH' : 'INT'}
                                                </div>
                                                <div>
                                                    <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 15 }}>{displayNationalityLabel(n.nationality)}</div>
                                                    <div style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500 }}>{pct}%</div>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: 24, fontWeight: 800, color }}>
                                                {n.count.toLocaleString()}
                                            </div>
                                        </div>
                                        <div style={{ height: 8, borderRadius: 4, background: 'var(--border-color)', overflow: 'hidden' }}>
                                            <div style={{
                                                width: `${pct}%`,
                                                height: '100%',
                                                background: `linear-gradient(90deg, ${color}, ${color}88)`,
                                                borderRadius: 4,
                                                transition: 'width 1.2s ease-out'
                                            }} />
                                        </div>
                                    </div>
                                );
                            })}

                            <div style={{
                                marginTop: 8,
                                padding: '14px 16px',
                                background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-success-deep) 10%, transparent), color-mix(in srgb, var(--accent-success) 5%, transparent))',
                                border: '1px solid color-mix(in srgb, var(--accent-success) 20%, transparent)',
                                borderRadius: 12,
                                textAlign: 'center'
                            }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>นิสิตสัญชาติไทยคิดเป็น</div>
                                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-success)', marginTop: 4 }}>
                                    {((scienceFaculty.byNationality[0].count / scienceFaculty.total) * 100).toFixed(1)}%
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="charts-grid" style={{ marginTop: 24 }}>
                    <div className="chart-card animate-in">
                        <div className="chart-card-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div className="stat-card-icon" style={{ background: 'linear-gradient(135deg, var(--accent-gold), var(--accent-orange))' }}>
                                    <Award size={18} color="var(--text-on-accent)" />
                                </div>
                                <div>
                                    <div className="chart-card-title">นักศึกษาที่ได้รับรางวัล</div>
                                    <div className="chart-card-subtitle">แสดงประเภท รางวัล ระดับ และแหล่งอ้างอิงของผลงานนักศึกษา</div>
                                </div>
                            </div>
                        </div>
                        <div className="data-table-container" style={{ marginTop: 0 }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>ปี</th>
                                        <th>นักศึกษา</th>
                                        <th>สาขา</th>
                                        <th>รางวัล</th>
                                        <th>ประเภท</th>
                                        <th>ระดับ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {studentAwardRecordsDemo.map(row => (
                                        <tr key={row.studentCode}>
                                            <td>{row.year}</td>
                                            <td>{row.displayName}</td>
                                            <td>{row.major}</td>
                                            <td>{row.award}</td>
                                            <td>{row.category}</td>
                                            <td>{row.level}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="chart-card animate-in">
                        <div className="chart-card-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div className="stat-card-icon" style={{ background: 'linear-gradient(135deg, var(--accent-info), var(--accent-purple))' }}>
                                    <BarChart3 size={18} color="var(--text-on-accent)" />
                                </div>
                                <div>
                                    <div className="chart-card-title">พยากรณ์ตามประชากรประเทศ</div>
                                    <div className="chart-card-subtitle">ใช้เป็นกรอบวางแผนรับเข้าและประเมินความเสี่ยงระยะกลาง</div>
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gap: 10 }}>
                            {populationForecastReference.scenario.map(row => (
                                <div key={row.year} style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                                        <strong style={{ color: 'var(--text-primary)' }}>ปี {row.year}</strong>
                                        <span className={`status-badge ${row.riskLevel === 'high' ? 'rejected' : 'warning'}`}>
                                            {row.riskLevel === 'high' ? 'เสี่ยงสูง' : 'เฝ้าระวัง'}
                                        </span>
                                    </div>
                                    <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                                        <span>ดัชนีประชากรวัยเรียน {row.youthPopulationIndex}</span>
                                        <span>ดัชนีความต้องการคณะวิทย์ {row.expectedScienceDemandIndex}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
