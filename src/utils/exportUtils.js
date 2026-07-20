import ChartJS from 'chart.js/auto';
import {
    dashboardSummary,
    financialData,
    scienceFacultyBudgetData,
    studentLifeData,
    studentStatsData,
    tuitionData,
    universityBudgetData,
} from '../data/mockData';
import {
    currentGraduationStats,
    graduationByMajor,
    graduationCandidateList,
    graduationHistory,
    gpaDistribution,
    honorsData,
} from '../data/graduationData';
import { hrData } from '../data/hrData';
import { researchData } from '../data/researchData';
import { strategicData } from '../data/strategicData';
import { tcasPlanningData } from '../data/tcasAdmissionsData';
import { courseAnalyticsData } from '../data/courseAnalyticsData';
import {
    academicRulesScope,
    academicRulesSources,
    graduationRules,
    honorsRules,
} from '../data/academicRulesData';
import { getStudentListSync } from '../services/studentDataService';
import { DASHBOARD_DATASETS } from '../services/dashboardLiveDataService';
import {
    getSharedDashboardDatasetMetaSync,
    getSharedDashboardDatasetSync,
} from '../services/sharedDashboardDataService';
import { getAllAlerts } from './alerts';
import { APP_NAME_EN, APP_NAME_TH } from '../config/appBrand';
import {
    executiveCompensationDemo,
    getExecutiveCompensationSummary,
    buildStudentPaymentLedgerDemo,
    summarizeStudentPaymentLedgerDemo,
    studentAwardRecordsDemo,
    populationForecastReference,
} from '../data/featureCompletionFallbackData';

const SHEET_NAME_LIMIT = 31;
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});

const encoder = new TextEncoder();

function safeFileName(name = 'export') {
    return String(name)
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, '_')
        .slice(0, 120) || 'export';
}

function dateKey(date = new Date()) {
    const pad = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function routeScope() {
    if (typeof window === 'undefined') return 'server';
    const path = String(window.location?.pathname || '')
        .replace(/^\/dashboard\/?/, '')
        .replace(/^\/+|\/+$/g, '');
    return path || 'overview';
}

function standardReportFileBase(title = 'Report', scope = routeScope()) {
    return safeFileName(`SCI-Dashboard_${title || 'Report'}_${dateKey()}_${scope || 'scope'}`);
}

function generatedAtText() {
    return new Date().toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function sheetName(name, fallback = 'Sheet') {
    const cleaned = String(name || fallback).replace(/[\\/?*[\]:]+/g, ' ').trim();
    return (cleaned || fallback).slice(0, SHEET_NAME_LIMIT);
}

function uniqueSheetName(name, usedNames, fallback = 'Sheet') {
    const baseName = sheetName(name, fallback);
    let finalName = baseName;
    let i = 2;
    while (usedNames.has(finalName)) {
        const suffix = ` ${i}`;
        finalName = `${baseName.slice(0, SHEET_NAME_LIMIT - suffix.length)}${suffix}`;
        i += 1;
    }
    usedNames.add(finalName);
    return finalName;
}

function xmlEscape(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function normalizeRows(rows) {
    if (!Array.isArray(rows)) return [];
    return rows
        .filter(Boolean)
        .map(row => {
            if (Array.isArray(row)) {
                return Object.fromEntries(row.map((value, idx) => [`col_${idx + 1}`, value]));
            }
            if (typeof row === 'object') return row;
            return { value: row };
        });
}

function rowsToCsv(rows) {
    const normalized = normalizeRows(rows);
    if (normalized.length === 0) return '';
    const headers = Array.from(new Set(normalized.flatMap(row => Object.keys(row))));
    const escape = value => {
        const text = value == null ? '' : String(value);
        return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    return [
        headers.map(escape).join(','),
        ...normalized.map(row => headers.map(header => escape(row[header])).join(',')),
    ].join('\n');
}

function reportMetadataRows(title, sheets = {}, chartSheets = [], exportKind = 'workbook') {
    const sheetEntries = Object.entries(sheets || {});
    const rowCount = sheetEntries.reduce((sum, [, rows]) => sum + normalizeRows(rows).length, 0);
    const chartCount = (chartSheets || []).filter(chart => chart?.imageDataUrl || normalizeRows(chart?.rows).length).length;
    const exportStandard = exportKind === 'csv'
        ? 'CSV data report with metadata, source notes, all table sections, and matching PNG chart image files downloaded separately. CSV files cannot embed images.'
        : 'Production report workbook with metadata, data sections, sources, and chart images';
    const meta = [
        ['Report title', title || 'SCI AI Dashboard Report'],
        ['Application', `${APP_NAME_TH} / ${APP_NAME_EN}`],
        ['Generated at', generatedAtText()],
        ['Route scope', routeScope()],
        ['Data sections', sheetEntries.length],
        ['Data rows', rowCount],
        ['Charts', chartCount],
        ['Chart images', chartCount
            ? (exportKind === 'csv' ? 'Downloaded separately as PNG files in report resolution' : 'Embedded in workbook chart sheets at report resolution')
            : 'No charts found on this page'],
        ['Export standard', exportStandard],
    ];
    return meta.map(([field, value], idx) => ({ row: idx + 1, field, value }));
}

function reportNotesRows(sheets = {}, chartSheets = []) {
    const notes = [];
    Object.entries(sheets || {}).forEach(([name, rows]) => {
        const normalized = normalizeRows(rows);
        if (/mock|sample|demo|fallback/i.test(name) || normalized.some(row =>
            /mock|sample|demo|fallback|generated/i.test(JSON.stringify(row || {}))
        )) {
            notes.push({
                section: name,
                note: 'This section may contain sample/fallback/generated records. Verify against the listed source before using as official individual-level data.',
            });
        }
    });
    (chartSheets || []).forEach(chart => {
        if (chart?.name) {
            notes.push({
                section: chart.name,
                note: `Chart image exported at report resolution from the dashboard canvas. Source rows are included in the matching chart sheet when available.`,
            });
        }
    });
    return notes;
}

function chartPngFileName(fileBase, chart, chartIdx) {
    const chartName = chart?.name || `chart-${chartIdx + 1}`;
    return `${safeFileName(fileBase)}_chart-${chartIdx + 1}_${safeFileName(chartName)}.png`;
}

function sheetsToSectionedCsvRows(title, sheets = {}, chartSheets = [], fileBase = standardReportFileBase(title)) {
    const rows = [
        ...reportMetadataRows(title, sheets, chartSheets, 'csv').map(row => ({ section: 'Report Metadata', sheetRow: row.row, field: row.field, value: row.value })),
        { section: '', sheetRow: '', field: '', value: '' },
    ];
    const notes = reportNotesRows(sheets, chartSheets);
    if (notes.length > 0) {
        rows.push({ section: 'Source Notes', sheetRow: '', field: 'Section', value: 'Source Notes' });
        notes.forEach((note, idx) => {
            rows.push({
                section: 'Source Notes',
                sheetRow: idx + 1,
                field: note.section,
                value: note.note,
            });
        });
        rows.push({ section: '', sheetRow: '', field: '', value: '' });
    }
    Object.entries(sheets || {}).forEach(([name, sheetRows]) => {
        const normalized = normalizeRows(sheetRows);
        if (normalized.length === 0) return;
        rows.push({ section: name, sheetRow: '', field: 'Section', value: name });
        normalized.forEach((row, idx) => {
            rows.push({
                section: name,
                sheetRow: idx + 1,
                ...row,
            });
        });
        rows.push({ section: '', sheetRow: '', field: '', value: '' });
    });
    (chartSheets || []).forEach((chart, chartIdx) => {
        const chartName = chart?.name || `Chart ${chartIdx + 1}`;
        const normalized = normalizeRows(chart?.rows);
        rows.push({
            section: `Chart ${chartIdx + 1}`,
            sheetRow: '',
            field: 'Chart image',
            value: chart?.imageDataUrl ? chartPngFileName(fileBase, chart, chartIdx) : 'No image captured; chart data rows are included below.',
        });
        if (normalized.length > 0) {
            rows.push({ section: `Chart ${chartIdx + 1}`, sheetRow: '', field: 'Section', value: `Chart data: ${chartName}` });
            normalized.forEach((row, idx) => {
                rows.push({
                    section: `Chart ${chartIdx + 1}`,
                    sheetRow: idx + 1,
                    ...row,
                });
            });
        }
        rows.push({ section: '', sheetRow: '', field: '', value: '' });
    });
    return rows;
}

function triggerBlobDownload(fileName, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function downloadBlob(fileName, mimeType, content) {
    triggerBlobDownload(fileName, new Blob([content], { type: mimeType }));
}

export function downloadCSV(fileName, rows) {
    const csv = rowsToCsv(rows);
    downloadBlob(`${safeFileName(fileName)}.csv`, 'text/csv;charset=utf-8', `\uFEFF${csv}`);
}

export function downloadCSVReport(fileName, title, sheets, chartSheets = []) {
    const csv = rowsToCsv(sheetsToSectionedCsvRows(title, sheets, chartSheets, fileName));
    downloadBlob(`${safeFileName(fileName)}.csv`, 'text/csv;charset=utf-8', `\uFEFF${csv}`);
}

function dataUrlToBlob(dataUrl) {
    const [header = '', payload = ''] = String(dataUrl || '').split(',');
    const mime = header.match(/data:([^;]+)/)?.[1] || 'image/png';
    if (!payload) return null;
    try {
        const binary = atob(payload);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }
        return new Blob([bytes], { type: mime });
    } catch (error) {
        console.warn('[exportUtils] Unable to decode chart image data:', error);
        return null;
    }
}

function downloadPNG(fileName, dataUrl, delayMs = 0) {
    const blob = dataUrlToBlob(dataUrl);
    if (!blob) return;
    const name = `${safeFileName(fileName)}.png`;
    if (delayMs > 0) {
        setTimeout(() => triggerBlobDownload(name, blob), delayMs);
        return;
    }
    triggerBlobDownload(name, blob);
}

function downloadChartPNGs(fileBase, chartSheets = []) {
    const charts = (chartSheets || []).filter(chart => chart?.imageDataUrl);
    charts.forEach((chart, idx) => {
        downloadPNG(chartPngFileName(fileBase, chart, idx).replace(/\.png$/i, ''), chart.imageDataUrl, idx * 220);
    });
    return charts.length;
}

export function chartToRows(chart, chartName = 'Chart') {
    const labels = Array.isArray(chart?.data?.labels) ? chart.data.labels : [];
    const datasets = Array.isArray(chart?.data?.datasets) ? chart.data.datasets : [];
    if (datasets.length === 0) return [];

    const pointRows = [];
    datasets.forEach(dataset => {
        const label = dataset.label || chartName;
        const data = Array.isArray(dataset.data) ? dataset.data : [];
        data.forEach((point, idx) => {
            if (point && typeof point === 'object' && !Array.isArray(point)) {
                const extraFields = Object.fromEntries(
                    Object.entries(point)
                        .filter(([key, value]) =>
                            !['x', 'y', 'r', 'value', 'label', 'major', 'faculty'].includes(key) &&
                            (value == null || ['string', 'number', 'boolean'].includes(typeof value))
                        )
                );
                pointRows.push({
                    chart: chartName,
                    dataset: label,
                    label: point.label ?? point.major ?? point.faculty ?? labels[idx] ?? idx + 1,
                    x: point.x ?? '',
                    y: point.y ?? '',
                    r: point.r ?? '',
                    major: point.major ?? '',
                    faculty: point.faculty ?? '',
                    count: point.count ?? '',
                    value: point.value ?? '',
                    ...extraFields,
                });
            } else {
                pointRows.push({
                    chart: chartName,
                    dataset: label,
                    label: labels[idx] ?? idx + 1,
                    value: point,
                });
            }
        });
    });
    return pointRows;
}

export function chartToMatrixRows(chart, chartName = 'Chart') {
    const labels = Array.isArray(chart?.data?.labels) ? chart.data.labels : [];
    const datasets = Array.isArray(chart?.data?.datasets) ? chart.data.datasets : [];
    const rowCount = Math.max(labels.length, ...datasets.map(dataset => Array.isArray(dataset?.data) ? dataset.data.length : 0), 0);
    if (!rowCount || !datasets.length) return [];

    const usedSeriesNames = new Map();
    const series = datasets.map((dataset, index) => {
        const base = String(dataset?.label || `Series ${index + 1}`).trim() || `Series ${index + 1}`;
        const count = (usedSeriesNames.get(base) || 0) + 1;
        usedSeriesNames.set(base, count);
        return { dataset, name: count === 1 ? base : `${base} (${count})` };
    });

    return Array.from({ length: rowCount }, (_, index) => {
        const row = {
            row: index + 1,
            chart: chartName,
            category: labels[index] ?? '',
        };
        series.forEach(({ dataset, name }) => {
            const point = Array.isArray(dataset?.data) ? dataset.data[index] : undefined;
            if (point && typeof point === 'object' && !Array.isArray(point)) {
                row[`${name} label`] = point.label ?? point.major ?? point.faculty ?? labels[index] ?? '';
                Object.entries(point).forEach(([key, value]) => {
                    if (value == null || ['string', 'number', 'boolean'].includes(typeof value)) {
                        row[`${name} ${key}`] = value ?? '';
                    }
                });
            } else {
                row[name] = point ?? '';
            }
        });
        return row;
    });
}

export function chartSeriesRows(chart, chartName = 'Chart') {
    const datasets = Array.isArray(chart?.data?.datasets) ? chart.data.datasets : [];
    return datasets.map((dataset, index) => ({
        row: index + 1,
        chart: chartName,
        series: dataset?.label || `Series ${index + 1}`,
        type: dataset?.type || chart?.chartType || chart?.type || 'bar',
        axis: dataset?.yAxisID || dataset?.xAxisID || 'default',
        points: Array.isArray(dataset?.data) ? dataset.data.length : 0,
        unit: dataset?.unit || '',
        hidden: dataset?.hidden === true ? 'yes' : 'no',
    }));
}

function addSheet(sheets, name, rows) {
    const normalized = normalizeRows(rows).filter(row =>
        Object.values(row).some(value => value !== '' && value != null)
    );
    if (normalized.length === 0) return;

    let finalName = String(name || 'Data');
    let i = 2;
    while (sheets[finalName]) {
        finalName = `${name} ${i}`;
        i += 1;
    }
    sheets[finalName] = normalized;
}

function mergeExportSheetMaps(baseSheets = {}, extraSheets = {}, extraSuffix = 'Custom') {
    const merged = { ...(baseSheets || {}) };
    Object.entries(extraSheets || {}).forEach(([name, value]) => {
        let finalName = String(name || 'Data');
        let index = 2;
        while (Object.prototype.hasOwnProperty.call(merged, finalName)) {
            finalName = index === 2 ? `${name} ${extraSuffix}` : `${name} ${extraSuffix} ${index}`;
            index += 1;
        }
        merged[finalName] = value;
    });
    return merged;
}

function exportValue(value) {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) {
        if (value.every(item => item == null || ['string', 'number', 'boolean'].includes(typeof item))) {
            return value.filter(item => item != null).join(' | ');
        }
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }
    if (value && typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }
    return value;
}

function flattenRecord(value, prefix = '', out = {}) {
    if (value == null || typeof value !== 'object' || value instanceof Date || Array.isArray(value)) {
        if (prefix) out[prefix] = exportValue(value);
        return out;
    }

    Object.entries(value).forEach(([key, childValue]) => {
        const childKey = prefix ? `${prefix}.${key}` : key;
        if (
            childValue &&
            typeof childValue === 'object' &&
            !(childValue instanceof Date) &&
            !Array.isArray(childValue)
        ) {
            flattenRecord(childValue, childKey, out);
        } else {
            out[childKey] = exportValue(childValue);
        }
    });
    return out;
}

function rowsFromRecords(records, extra = {}) {
    const list = Array.isArray(records) ? records : (records ? [records] : []);
    return list.map((record, idx) => ({
        row: idx + 1,
        ...extra,
        ...flattenRecord(record),
    }));
}

function rowsFromObject(object, section = 'Summary') {
    return Object.entries(object || {}).map(([label, value], idx) => ({
        row: idx + 1,
        section,
        label,
        value: exportValue(value),
    }));
}

function getDataset(id, fallback) {
    return getSharedDashboardDatasetSync(id) || fallback || null;
}

function datasetMetaRows(ids = DASHBOARD_DATASETS.map(item => item.id)) {
    return ids.map((id, idx) => {
        const meta = getSharedDashboardDatasetMetaSync(id);
        const config = DASHBOARD_DATASETS.find(item => item.id === id);
        return {
            row: idx + 1,
            datasetId: id,
            label: config?.label || meta.label || id,
            section: config?.section || '',
            sourceMode: config?.syncMode || '',
            sourceType: meta.sourceType || '',
            isLive: meta.isLive ? 'live' : 'fallback',
            rowCount: meta.rowCount ?? '',
            updatedAt: meta.updatedAt instanceof Date ? meta.updatedAt.toISOString() : (meta.updatedAt || ''),
            sourceUrl: meta.sourceUrl || config?.source || '',
        };
    });
}

function compactStudentRows(students = getStudentListSync(), extra = {}) {
    return (students || []).map((student, idx) => ({
        row: idx + 1,
        ...extra,
        id: student.id || '',
        prefix: student.prefix || '',
        name: student.name || '',
        major: student.major || '',
        level: student.level || '',
        year: student.year ?? '',
        gpa: typeof student.gpa === 'number' ? student.gpa.toFixed(2) : (student.gpa ?? ''),
        status: student.status || '',
    }));
}

function budgetYearRows(source, datasetName) {
    return (source?.yearly || []).map(({ revenueBreakdown, expenseBreakdown, ...yearRow }, idx) => ({
        row: idx + 1,
        dataset: datasetName,
        unit: source?.unit || 'ล้านบาท',
        ...flattenRecord(yearRow),
        revenueBreakdownItems: Array.isArray(revenueBreakdown) ? revenueBreakdown.length : 0,
        expenseBreakdownItems: Array.isArray(expenseBreakdown) ? expenseBreakdown.length : 0,
    }));
}

function budgetBreakdownRows(source, datasetName) {
    return (source?.yearly || []).flatMap(yearRow => [
        ...(yearRow.revenueBreakdown || []).map((item, idx) => ({
            dataset: datasetName,
            year: yearRow.year,
            type: 'รายรับ',
            row: idx + 1,
            ...flattenRecord(item),
        })),
        ...(yearRow.expenseBreakdown || []).map((item, idx) => ({
            dataset: datasetName,
            year: yearRow.year,
            type: 'รายจ่าย',
            row: idx + 1,
            ...flattenRecord(item),
        })),
    ]);
}

function buildDashboardOverviewSheets() {
    const sheets = {};
    const summary = getDataset('dashboard_summary', dashboardSummary) || {};
    const students = getDataset('student_stats', studentStatsData) || {};
    const scienceFaculty = students.scienceFaculty || {};
    const scienceSummary = (summary.faculties || []).find(item => String(item.name || '').includes('วิทยาศาสตร์')) || {};
    const graduation = getDataset('graduation', {
        current: currentGraduationStats,
        history: graduationHistory,
    }) || {};
    const hr = getDataset('hr', hrData) || {};
    const research = getDataset('research', researchData) || {};
    const scienceBudget = getDataset('science_budget', scienceFacultyBudgetData) || {};
    const latestScienceBudget = (scienceBudget.yearly || []).slice(-1)[0] || {};

    addSheet(sheets, 'Summary', [
        { metric: 'นักศึกษาทั้งหมด', value: students.current?.total ?? summary.totalStudents ?? '' },
        { metric: 'รายวิชาเปิดสอน', value: summary.totalCourses ?? '' },
        { metric: 'เกรดเฉลี่ยรวม (GPA)', value: summary.avgGPA ?? '' },
        { metric: 'อัตราสำเร็จการศึกษา', value: summary.graduationRate ?? '' },
        { metric: 'นักศึกษาคณะวิทยาศาสตร์', value: scienceFaculty.total ?? scienceSummary.totalStudents ?? '' },
        { metric: 'รายวิชาคณะวิทยาศาสตร์', value: scienceSummary.totalCourses ?? '' },
        { metric: 'GPA คณะวิทยาศาสตร์', value: scienceSummary.avgGPA ?? '' },
        { metric: 'อัตราสำเร็จคณะวิทยาศาสตร์', value: scienceSummary.graduationRate ?? '' },
    ]);
    addSheet(sheets, 'Faculties', rowsFromRecords(summary.faculties, { section: 'ภาพรวมรายคณะ' }));
    addSheet(sheets, 'Science Levels', rowsFromRecords(scienceFaculty.byLevel, { section: 'คณะวิทยาศาสตร์ตามระดับ' }));
    addSheet(sheets, 'Science Enrollment', rowsFromRecords(scienceFaculty.byEnrollmentYear, { section: 'คณะวิทยาศาสตร์ตามปีเข้า' }));
    addSheet(sheets, 'Science Intake', rowsFromRecords(scienceFaculty.newStudentIntake, { section: 'รับเข้าใหม่คณะวิทยาศาสตร์' }));
    addSheet(sheets, 'Management Overview', [
        { domain: 'บุคลากร', metric: 'บุคลากรคณะวิทยาศาสตร์', value: hr.scienceFaculty?.total ?? hr.summary?.total ?? '' },
        { domain: 'วิจัย', metric: 'ผลงานตีพิมพ์', value: research.overview?.totalPublications ?? research.summary?.totalPublications ?? '' },
        { domain: 'การเงิน', metric: `รายรับคณะวิทย์ ${latestScienceBudget.year || ''}`.trim(), value: latestScienceBudget.revenue ?? scienceBudget.summary?.latestRevenue ?? '', unit: scienceBudget.unit || 'ล้านบาท' },
        { domain: 'การเงิน', metric: `รายจ่ายคณะวิทย์ ${latestScienceBudget.year || ''}`.trim(), value: latestScienceBudget.expense ?? scienceBudget.summary?.latestExpense ?? '', unit: scienceBudget.unit || 'ล้านบาท' },
        { domain: 'สำเร็จการศึกษา', metric: 'อัตราสำเร็จการศึกษาปัจจุบัน', value: graduation.current?.graduationRate ?? graduation.graduationRate ?? summary.graduationRate ?? '', unit: '%' },
    ]);
    addSheet(sheets, 'Dataset Meta', datasetMetaRows(['dashboard_summary', 'student_stats', 'graduation', 'hr', 'research', 'science_budget']));
    return sheets;
}

function buildStudentStatsSheets() {
    const sheets = {};
    const data = getDataset('student_stats', studentStatsData) || {};
    const science = data.scienceFaculty || {};
    const students = getStudentListSync();

    addSheet(sheets, 'Summary', rowsFromRecords(data.current?.byLevel, { section: 'นักศึกษาปัจจุบันตามระดับ' }));
    addSheet(sheets, 'By Faculty', rowsFromRecords(data.byFaculty, { section: 'นักศึกษาตามคณะ' }));
    addSheet(sheets, 'By Campus', rowsFromRecords(data.byCampus, { section: 'นักศึกษาตามวิทยาเขต' }));
    addSheet(sheets, 'By Nationality', rowsFromRecords(data.byNationality, { section: 'นักศึกษาตามสัญชาติ' }));
    addSheet(sheets, 'By Enrollment Year', rowsFromRecords(data.byEnrollmentYear, { section: 'นักศึกษาตามปีเข้า' }));
    addSheet(sheets, 'Trend', rowsFromRecords(data.trend, { section: 'แนวโน้มนักศึกษา' }));
    addSheet(sheets, 'Science Levels', rowsFromRecords(science.byLevel, { section: 'คณะวิทยาศาสตร์ตามระดับ' }));
    addSheet(sheets, 'Science Majors', rowsFromRecords(science.byMajor, { section: 'คณะวิทยาศาสตร์ตามสาขา' }));
    addSheet(sheets, 'Science Enrollment', rowsFromRecords(science.byEnrollmentYear, { section: 'คณะวิทยาศาสตร์ตามปีเข้า' }));
    addSheet(sheets, 'Science Intake', rowsFromRecords(science.newStudentIntake, { section: 'รับเข้าใหม่คณะวิทยาศาสตร์' }));
    addSheet(sheets, 'Science Nationality', rowsFromRecords(science.byNationality, { section: 'คณะวิทยาศาสตร์ตามสัญชาติ' }));
    addSheet(sheets, 'Science Gender', rowsFromObject(science.byGender, 'คณะวิทยาศาสตร์ตามเพศ'));
    addSheet(sheets, 'Science Ratio', rowsFromRecords(science.studentFacultyRatio?.comparison, { section: 'อัตราส่วนนักศึกษาต่ออาจารย์' }));
    addSheet(sheets, 'Student Rows', compactStudentRows(students, { section: 'รายชื่อนักศึกษาที่ระบบใช้คำนวณ' }));
    addSheet(sheets, 'Student Awards Demo', rowsFromRecords(studentAwardRecordsDemo, { section: 'นักศึกษาที่ได้รับรางวัล (demo)' }));
    addSheet(sheets, 'Population Forecast Demo', rowsFromRecords(populationForecastReference.scenario, { section: 'พยากรณ์ประชากรประเทศ (demo)' }));
    addSheet(sheets, 'Dataset Meta', datasetMetaRows(['student_stats', 'dashboard_summary']));
    return sheets;
}

function buildStudentListSheets() {
    const sheets = {};
    const students = getStudentListSync();
    addSheet(sheets, 'Student Rows', compactStudentRows(students, { section: 'รายชื่อนักศึกษาคณะวิทยาศาสตร์' }));
    return sheets;
}

function buildGraduationSheets() {
    const sheets = {};
    const data = getDataset('graduation', {
        history: graduationHistory,
        current: currentGraduationStats,
        byMajor: graduationByMajor,
        honors: honorsData,
        gpaDistribution,
        candidateList: graduationCandidateList,
    }) || {};
    const candidateRows = data.candidateList || data.candidates || graduationCandidateList;

    addSheet(sheets, 'Summary', rowsFromObject(data.current || currentGraduationStats, 'สถานะผู้มีสิทธิ์สำเร็จการศึกษา'));
    addSheet(sheets, 'History', rowsFromRecords(data.history || data.graduationHistory || graduationHistory, { section: 'ย้อนหลังตามปีการศึกษา' }));
    addSheet(sheets, 'By Major', rowsFromRecords(data.byMajor || graduationByMajor, { section: 'แยกตามสาขาวิชา' }));
    addSheet(sheets, 'GPA Distribution', rowsFromRecords(data.gpaDistribution || gpaDistribution, { section: 'ช่วง GPA' }));
    addSheet(sheets, 'Honors', rowsFromObject(data.honors || honorsData, 'เกียรตินิยม'));
    addSheet(sheets, 'Candidate Rows', compactStudentRows(candidateRows, { section: 'รายชื่อผู้มีสิทธิ์สำเร็จการศึกษา' }).map((row, idx) => ({
        ...row,
        graduationStatus: candidateRows[idx]?.graduationStatus || '',
        honors: candidateRows[idx]?.honors || '',
    })));
    addSheet(sheets, 'Academic Rules', academicRuleRows());
    addSheet(sheets, 'Dataset Meta', datasetMetaRows(['graduation']));
    return sheets;
}

function buildGraduationCheckSheets() {
    const sheets = buildGraduationSheets();
    addSheet(sheets, 'Rules Sources', rowsFromRecords(academicRulesSources, { section: 'แหล่งอ้างอิงกฎสำเร็จการศึกษา' }));
    return sheets;
}

function buildHrSheets() {
    const sheets = {};
    const data = getDataset('hr', hrData) || {};
    const science = data.scienceFaculty || {};

    addSheet(sheets, 'University Summary', rowsFromObject(data.university, 'ภาพรวมบุคลากรมหาวิทยาลัย'));
    addSheet(sheets, 'University Type', rowsFromRecords(data.university?.byType, { section: 'ประเภทบุคลากรมหาวิทยาลัย' }));
    addSheet(sheets, 'University Gender', rowsFromRecords(data.university?.byGender, { section: 'เพศบุคลากรมหาวิทยาลัย' }));
    addSheet(sheets, 'Science Summary', rowsFromObject(science, 'ภาพรวมบุคลากรคณะวิทยาศาสตร์'));
    addSheet(sheets, 'Science Department', rowsFromRecords(science.byDepartment, { section: 'บุคลากรตามภาควิชา' }));
    addSheet(sheets, 'Science Type', rowsFromRecords(science.byType, { section: 'ประเภทบุคลากรคณะวิทยาศาสตร์' }));
    addSheet(sheets, 'Academic Positions', rowsFromRecords(science.academicPositions, { section: 'ตำแหน่งทางวิชาการ' }));
    addSheet(sheets, 'Education', rowsFromRecords(science.byEducation, { section: 'วุฒิการศึกษา' }));
    addSheet(sheets, 'Trend', rowsFromRecords(science.trend, { section: 'แนวโน้มบุคลากร' }));
    addSheet(sheets, 'Promotion Trend', rowsFromRecords(science.promotionTrend, { section: 'แนวโน้มตำแหน่งทางวิชาการ' }));
    addSheet(sheets, 'Diversity Nationality', rowsFromRecords(science.diversity?.nationality, { section: 'ความหลากหลายสัญชาติ' }));
    addSheet(sheets, 'Diversity Age', rowsFromRecords(science.diversity?.ageGroup, { section: 'ช่วงอายุ' }));
    addSheet(sheets, 'Student Faculty Ratio', rowsFromRecords(science.studentFacultyRatio, { section: 'อัตราส่วนนักศึกษาต่ออาจารย์' }));
    addSheet(sheets, 'Executive Pay Demo', rowsFromRecords(executiveCompensationDemo, { section: 'ค่าตอบแทนผู้บริหาร (demo)' }));
    addSheet(sheets, 'Executive Pay Summary', rowsFromObject(getExecutiveCompensationSummary(), 'สรุปค่าตอบแทนผู้บริหาร (demo)'));
    addSheet(sheets, 'Dataset Meta', datasetMetaRows(['hr']));
    return sheets;
}

function buildResearchSheets() {
    const sheets = {};
    const data = getDataset('research', researchData) || {};
    addSheet(sheets, 'Summary', rowsFromObject(data.overview, 'ภาพรวมงานวิจัย'));
    addSheet(sheets, 'Publication Trend', rowsFromRecords(data.publicationTrend, { section: 'ผลงานตีพิมพ์ย้อนหลัง' }));
    addSheet(sheets, 'By Department', rowsFromRecords(data.byDepartment, { section: 'งานวิจัยตามภาควิชา' }));
    addSheet(sheets, 'Funding Trend', rowsFromRecords(data.fundingTrend, { section: 'แนวโน้มงบวิจัย' }));
    addSheet(sheets, 'Funding Sources', rowsFromRecords(data.fundingSources, { section: 'แหล่งทุนวิจัย' }));
    addSheet(sheets, 'Patents', rowsFromRecords(data.patents, { section: 'สิทธิบัตรและนวัตกรรม' }));
    addSheet(sheets, 'Community Impact', rowsFromRecords(data.communityImpact, { section: 'ผลกระทบชุมชน' }));
    addSheet(sheets, 'Benchmark', rowsFromRecords(data.benchmark, { section: 'เปรียบเทียบมหาวิทยาลัย' }));
    addSheet(sheets, 'Dataset Meta', datasetMetaRows(['research']));
    return sheets;
}

function buildFinancialSheets() {
    const sheets = {};
    const data = getDataset('financial', financialData) || {};
    const paymentLedgerDemo = buildStudentPaymentLedgerDemo(getStudentListSync(), { limit: 80 });
    addSheet(sheets, 'Tuition Status', rowsFromRecords(data.tuitionStatus, { section: 'สถานะค่าเทอม' }));
    addSheet(sheets, 'Payment History', rowsFromRecords(data.paymentHistory, { section: 'ประวัติการชำระเงิน' }));
    addSheet(sheets, 'Scholarship', rowsFromRecords(data.scholarship, { section: 'ทุนการศึกษา' }));
    addSheet(sheets, 'Requests', rowsFromRecords(data.requests, { section: 'คำร้อง' }));
    addSheet(sheets, 'Official Estimate', rowsFromObject(data.officialEstimate, 'ประมาณการจากไฟล์จริง'));
    addSheet(sheets, 'Official Top Majors', rowsFromRecords(data.officialEstimate?.topMajors, { section: 'รายหลักสูตรตามประมาณการ' }));
    addSheet(sheets, 'Faculty Budget Summary', rowsFromObject(data.facultyBudget, 'งบประมาณคณะ'));
    addSheet(sheets, 'Faculty Budget Categories', rowsFromRecords(data.facultyBudget?.categories, { section: 'หมวดงบประมาณคณะ' }));
    addSheet(sheets, 'Payment Ledger Demo', rowsFromRecords(paymentLedgerDemo, { section: 'ค่าธรรมเนียมรายคน (demo)' }));
    addSheet(sheets, 'Payment Summary Demo', rowsFromObject(summarizeStudentPaymentLedgerDemo(paymentLedgerDemo), 'สรุปสถานะค่าธรรมเนียมรายคน (demo)'));
    addSheet(sheets, 'Dataset Meta', datasetMetaRows(['financial']));
    return sheets;
}

function buildTuitionSheets() {
    const sheets = {};
    const data = getDataset('tuition', tuitionData) || {};
    addSheet(sheets, 'Summary', [
        { section: 'ค่าเทอม', label: data.flatRate?.label || 'ค่าเทอม', min: data.flatRate?.min ?? '', max: data.flatRate?.max ?? '' },
        { section: 'ค่าแรกเข้า', label: data.entryFee?.label || 'ค่าธรรมเนียมแรกเข้า', min: data.entryFee?.min ?? '', max: data.entryFee?.max ?? '' },
        { section: 'ตลอดหลักสูตร', label: data.totalCost?.label || 'ตลอดหลักสูตร', min: data.totalCost?.min ?? '', max: data.totalCost?.max ?? '' },
    ]);
    addSheet(sheets, 'By Faculty', rowsFromRecords(data.byFaculty, { section: 'ค่าเทอมตามคณะ' }));
    addSheet(sheets, 'Official Majors', rowsFromRecords(data.officialMajors, { section: 'ค่าเทอมรายหลักสูตรจากไฟล์จริง' }));
    addSheet(sheets, 'Breakdown', rowsFromRecords(data.breakdown, { section: 'สัดส่วนค่าใช้จ่าย' }));
    addSheet(sheets, 'Semester History', rowsFromRecords(data.semesterHistory, { section: 'ประวัติรายเทอม' }));
    addSheet(sheets, 'Dataset Meta', datasetMetaRows(['tuition']));
    return sheets;
}

function buildStudentLifeSheets() {
    const sheets = {};
    const data = getDataset('student_life', studentLifeData) || {};
    addSheet(sheets, 'Activity Summary', rowsFromObject(data.activityHours, 'ชั่วโมงกิจกรรม'));
    addSheet(sheets, 'Activity Categories', rowsFromRecords(data.activityHours?.categories, { section: 'กิจกรรมตามหมวด' }));
    addSheet(sheets, 'Science Activities', rowsFromRecords(data.scienceActivities, { section: 'ปฏิทินกิจกรรมคณะวิทยาศาสตร์' }));
    addSheet(sheets, 'Library', rowsFromRecords(data.library, { section: 'การยืมหนังสือ' }));
    addSheet(sheets, 'Behavior Summary', rowsFromObject(data.behaviorScore, 'คะแนนพฤติกรรม'));
    addSheet(sheets, 'Behavior History', rowsFromRecords(data.behaviorScore?.history, { section: 'คะแนนพฤติกรรมย้อนหลัง' }));
    addSheet(sheets, 'Dataset Meta', datasetMetaRows(['student_life']));
    return sheets;
}

function buildTcasSheets() {
    const sheets = {};
    const data = getDataset('tcas_admissions', tcasPlanningData) || {};
    addSheet(sheets, 'TCAS 5Y Trend', rowsFromRecords(data.fiveYearTrend, { section: 'แนวโน้ม TCAS 5 ปี' }));
    addSheet(sheets, 'Round Plan 2569', rowsFromRecords(data.roundPlan2569, { section: 'แผนรับตามรอบ' }));
    addSheet(sheets, 'Round3 Major Plan', rowsFromRecords(data.round3Plan2569, { section: 'รอบ 3 Admission 2569' }));
    addSheet(sheets, 'Major Outlook', rowsFromRecords(data.majorOutlook, { section: 'แผนกลยุทธ์รายสาขา' }));
    addSheet(sheets, 'Sources', rowsFromRecords(data.sources, { section: 'แหล่งข้อมูล' }));
    addSheet(sheets, 'Dataset Meta', datasetMetaRows(['tcas_admissions']));
    return sheets;
}

function buildCourseAnalyticsSheets() {
    const sheets = {};
    const data = getDataset('course_analytics', courseAnalyticsData) || {};
    addSheet(sheets, 'Programs', rowsFromRecords(data.programs?.map(name => ({ name })), { section: 'หลักสูตรปริญญาตรี' }));
    addSheet(sheets, 'Course Plan', rowsFromRecords((data.coursePlanByYear || []).flatMap(year =>
        (year.semesters || []).flatMap(semester =>
            (semester.courses || []).map(course => ({ year: year.year, yearTitle: year.title, semester: semester.semester, ...course }))
        )
    ), { section: 'แผนเรียน ปี 1-4' }));
    addSheet(sheets, 'Featured Courses', rowsFromRecords(data.featuredCourses, { section: 'วิชาน่าสนใจ' }));
    addSheet(sheets, 'Grade Distribution', rowsFromRecords(data.gradeDistributions, { section: 'กระจายเกรดรายวิชา' }));
    addSheet(sheets, 'Branch Strengths', rowsFromRecords(data.branchStrengths, { section: 'จุดเด่นสาขา' }));
    addSheet(sheets, 'Sources', rowsFromRecords(data.sources, { section: 'แหล่งข้อมูล' }));
    addSheet(sheets, 'Dataset Meta', datasetMetaRows(['course_analytics']));
    return sheets;
}

function buildBudgetSheets() {
    const sheets = {};
    const universityBudget = getDataset('university_budget', universityBudgetData) || {};
    const scienceBudget = getDataset('science_budget', scienceFacultyBudgetData) || {};

    addSheet(sheets, 'University Budget', budgetYearRows(universityBudget, 'มหาวิทยาลัยแม่โจ้'));
    addSheet(sheets, 'University Breakdown', budgetBreakdownRows(universityBudget, 'มหาวิทยาลัยแม่โจ้'));
    addSheet(sheets, 'University Summary', rowsFromObject(universityBudget.summary, 'สรุปงบมหาวิทยาลัย'));
    addSheet(sheets, 'Science Budget', budgetYearRows(scienceBudget, 'คณะวิทยาศาสตร์'));
    addSheet(sheets, 'Science Breakdown', budgetBreakdownRows(scienceBudget, 'คณะวิทยาศาสตร์'));
    addSheet(sheets, 'Science Summary', rowsFromObject(scienceBudget.summary, 'สรุปงบคณะวิทยาศาสตร์'));
    addSheet(sheets, 'Dataset Meta', datasetMetaRows(['university_budget', 'science_budget']));
    return sheets;
}

function buildStrategicSheets() {
    const sheets = {};
    const data = getDataset('strategic', strategicData) || {};
    addSheet(sheets, 'Strategic Goals', rowsFromRecords(data.strategicGoals, { section: 'เป้าหมายยุทธศาสตร์' }));
    addSheet(sheets, 'Strategic KPI', (data.strategicGoals || []).flatMap(goal =>
        (goal.kpis || []).map((kpi, idx) => ({
            goalId: goal.id,
            goalTitle: goal.title,
            row: idx + 1,
            ...flattenRecord(kpi),
        }))
    ));
    addSheet(sheets, 'OKR Objectives', rowsFromRecords(data.okr?.objectives, { section: data.okr?.period || 'OKR' }));
    addSheet(sheets, 'OKR Key Results', (data.okr?.objectives || []).flatMap(objective =>
        (objective.keyResults || []).map((kr, idx) => ({
            objectiveId: objective.id,
            objectiveTitle: objective.title,
            row: idx + 1,
            ...flattenRecord(kr),
        }))
    ));
    addSheet(sheets, 'Performance Radar', (data.performanceRadar?.categories || []).map((category, idx) => ({
        row: idx + 1,
        category,
        currentYear: data.performanceRadar?.currentYear?.[idx] ?? '',
        targetYear: data.performanceRadar?.targetYear?.[idx] ?? '',
        lastYear: data.performanceRadar?.lastYear?.[idx] ?? '',
    })));
    addSheet(sheets, 'Efficiency Trend', rowsFromRecords(data.efficiencyTrend, { section: 'แนวโน้มประสิทธิภาพ' }));
    addSheet(sheets, 'KPI Review 2569', rowsFromRecords(data.kpiReviewRows, { section: 'คำรับรอง 2569' }));
    addSheet(sheets, 'Development Plan', rowsFromRecords(data.developmentPlanRows, { section: 'แผนพัฒนาส่วนงาน' }));
    addSheet(sheets, 'Dataset Meta', datasetMetaRows(['strategic']));
    return sheets;
}

function buildAlertSheets() {
    const sheets = {};
    const alerts = getAllAlerts();
    addSheet(sheets, 'Alert Summary', [
        { label: 'ทั้งหมด', value: alerts.length },
        { label: 'วิกฤต', value: alerts.filter(alert => alert.severity === 'critical').length },
        { label: 'เฝ้าระวัง', value: alerts.filter(alert => alert.severity === 'warning').length },
        { label: 'ข้อมูล', value: alerts.filter(alert => alert.severity === 'info').length },
    ]);
    addSheet(sheets, 'Alerts', alerts.map(({ data, ...alert }, idx) => ({
        row: idx + 1,
        ...flattenRecord(alert),
        detailRows: Array.isArray(data) ? data.length : 0,
    })));
    addSheet(sheets, 'Alert Details', alerts.flatMap(alert =>
        (Array.isArray(alert.data) ? alert.data : []).map((item, idx) => ({
            alertId: alert.id,
            alertTitle: alert.title,
            severity: alert.severity,
            domain: alert.domain,
            row: idx + 1,
            ...flattenRecord(item),
        }))
    ));
    return sheets;
}

function academicRuleRows() {
    return [
        { section: 'ขอบเขต', label: 'คณะ', value: academicRulesScope.faculty },
        { section: 'ขอบเขต', label: 'หลักสูตร', value: academicRulesScope.degreeTrack },
        { section: 'ขอบเขต', label: 'ตรวจทานล่าสุด', value: academicRulesScope.reviewedAt },
        { section: 'เกียรตินิยม', label: 'หน่วยกิตขั้นต่ำ', value: honorsRules.creditRequirement },
        { section: 'เกียรตินิยม', label: 'สำเร็จตามหลักสูตร', value: honorsRules.normalCompletion },
        ...(honorsRules.thresholds || []).map(item => ({
            section: 'เกณฑ์ GPA เกียรตินิยม',
            label: item.rank,
            value: item.gpa,
        })),
        ...(honorsRules.mustHave || []).map((value, idx) => ({
            section: 'คุณสมบัติที่ต้องมี',
            label: `ข้อ ${idx + 1}`,
            value,
        })),
        ...(honorsRules.disqualifiers || []).map((value, idx) => ({
            section: 'ลักษณะต้องห้าม',
            label: `ข้อ ${idx + 1}`,
            value,
        })),
    ];
}

function buildAcademicRulesSheets() {
    const sheets = {};
    addSheet(sheets, 'Scope', rowsFromRecords(academicRulesScope, { section: 'ขอบเขตข้อมูล' }));
    addSheet(sheets, 'Honors Rules', academicRuleRows());
    addSheet(sheets, 'Graduation Rules', (graduationRules || []).flatMap(rule =>
        (rule.items || []).map((value, idx) => ({
            section: rule.title,
            row: idx + 1,
            value,
        }))
    ));
    addSheet(sheets, 'Sources', rowsFromRecords(academicRulesSources, { section: 'แหล่งอ้างอิงทางการ' }));
    return sheets;
}

function buildDatasetInventorySheets() {
    const sheets = {};
    addSheet(sheets, 'Dataset Meta', datasetMetaRows());
    return sheets;
}

function normalizeRoutePath(pathname) {
    const path = String(pathname || '').replace(/\/+$/, '');
    return path || '/';
}

function buildRouteExportSheets(pathname) {
    const path = normalizeRoutePath(pathname || (typeof window !== 'undefined' ? window.location?.pathname : ''));
    if (path === '/dashboard') return buildDashboardOverviewSheets();
    if (path.endsWith('/student-stats')) return buildStudentStatsSheets();
    if (path.endsWith('/students')) return buildStudentListSheets();
    if (path.endsWith('/graduation-stats')) return buildGraduationSheets();
    if (path.endsWith('/graduation')) return buildGraduationCheckSheets();
    if (path.endsWith('/academic-rules')) return buildAcademicRulesSheets();
    if (path.endsWith('/hr')) return buildHrSheets();
    if (path.endsWith('/research')) return buildResearchSheets();
    if (path.endsWith('/financial')) return buildFinancialSheets();
    if (path.endsWith('/tuition')) return buildTuitionSheets();
    if (path.endsWith('/student-life')) return buildStudentLifeSheets();
    if (path.endsWith('/tcas')) return buildTcasSheets();
    if (path.endsWith('/course-analytics')) return buildCourseAnalyticsSheets();
    if (path.endsWith('/budget')) return buildBudgetSheets();
    if (path.endsWith('/strategic')) return buildStrategicSheets();
    if (path.endsWith('/alerts')) return buildAlertSheets();
    if (path.endsWith('/ai-chat') || path.endsWith('/admin')) return buildDatasetInventorySheets();
    return {};
}

function rowsToGrid(rows) {
    const normalized = normalizeRows(rows);
    if (normalized.length === 0) return [];
    const headers = Array.from(new Set(normalized.flatMap(row => Object.keys(row))));
    return [
        headers,
        ...normalized.map(row => headers.map(header => row[header] ?? '')),
    ];
}

function estimateColumnWidths(grid, providedWidths, maxCol) {
    if (Array.isArray(providedWidths) && providedWidths.length) {
        return Array.from({ length: Math.min(30, Math.max(1, maxCol)) }, (_, idx) =>
            providedWidths[idx] ?? (idx === 0 ? 20 : 16)
        );
    }

    const sampleRows = grid.slice(0, 220);
    return Array.from({ length: Math.min(30, Math.max(1, maxCol)) }, (_, colIdx) => {
        const longest = sampleRows.reduce((max, row) => {
            const text = String(row[colIdx] ?? '');
            return Math.max(max, Math.min(64, text.length));
        }, colIdx === 0 ? 14 : 10);
        return Math.max(10, Math.min(42, Math.round(longest * 1.25 + 3)));
    });
}

function columnName(index) {
    let n = index + 1;
    let name = '';
    while (n > 0) {
        const r = (n - 1) % 26;
        name = String.fromCharCode(65 + r) + name;
        n = Math.floor((n - 1) / 26);
    }
    return name;
}

function styleAttribute(styleId = 0) {
    return styleId ? ` s="${styleId}"` : '';
}

function cellXml(value, ref, styleId = 0) {
    const style = styleAttribute(styleId);
    if (value == null || value === '') return `<c r="${ref}"${style}/>`;
    if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${style}><v>${value}</v></c>`;
    if (typeof value === 'boolean') return `<c r="${ref}" t="b"${style}><v>${value ? 1 : 0}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${style}><is><t>${xmlEscape(value)}</t></is></c>`;
}

function worksheetXml({
    rows = [],
    title = '',
    dataStartRow = 1,
    drawingRelId = '',
    drawingBounds = null,
    colWidths = null,
    rowHeights = null,
}) {
    const grid = rowsToGrid(rows);
    const rowXml = [];
    let maxCol = Math.max(1, grid[0]?.length || 1, colWidths?.length || 0);
    let maxRow = Math.max(1, dataStartRow + Math.max(0, grid.length - 1));

    if (drawingBounds) {
        maxCol = Math.max(maxCol, drawingBounds.maxCol || 1);
        maxRow = Math.max(maxRow, drawingBounds.maxRow || 1);
    }

    if (title) {
        rowXml.push(`<row r="1" ht="26" customHeight="1">${cellXml(title, 'A1', 1)}</row>`);
    }

    if (grid.length === 0 && !title) {
        rowXml.push(`<row r="1">${cellXml('No exportable data found on this page.', 'A1')}</row>`);
    } else {
        grid.forEach((cells, rowIdx) => {
            const rowNumber = dataStartRow + rowIdx;
            const rowHeight = rowHeights?.[rowNumber] ?? rowHeights?.[String(rowNumber)];
            const rowAttributes = rowHeight
                ? ` r="${rowNumber}" ht="${rowHeight}" customHeight="1"`
                : ` r="${rowNumber}"`;
            maxCol = Math.max(maxCol, cells.length);
            maxRow = Math.max(maxRow, rowNumber);
            rowXml.push(
                `<row${rowAttributes}>${cells.map((value, colIdx) => {
                    const ref = `${columnName(colIdx)}${rowNumber}`;
                    return cellXml(value, ref, rowIdx === 0 ? 2 : 0);
                }).join('')}</row>`
            );
        });
    }

    const dimension = `A1:${columnName(maxCol - 1)}${maxRow}`;
    const widths = estimateColumnWidths(grid, colWidths, maxCol);
    const cols = widths.map((width, idx) => {
        return `<col min="${idx + 1}" max="${idx + 1}" width="${width}" customWidth="1"/>`;
    }).join('');
    const freezePane = grid.length > 1 && dataStartRow <= 3
        ? `<pane ySplit="${dataStartRow}" topLeftCell="A${dataStartRow + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/>`
        : '';
    const gridLastRow = dataStartRow + Math.max(0, grid.length - 1);
    const autoFilter = grid.length > 1
        ? `<autoFilter ref="A${dataStartRow}:${columnName(Math.max(0, grid[0].length - 1))}${gridLastRow}"/>`
        : '';

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<dimension ref="${dimension}"/>
<sheetViews><sheetView workbookViewId="0">${freezePane}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="18"/>
<cols>${cols}</cols>
<sheetData>${rowXml.join('')}</sheetData>
${autoFilter}
${drawingRelId ? `<drawing r:id="${drawingRelId}"/>` : ''}
</worksheet>`;
}

function workbookXml(sheets) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheets.map((sheet, idx) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${idx + 1}" r:id="rId${idx + 1}"/>`).join('')}</sheets>
</workbook>`;
}

function workbookRelsXml(sheets) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, idx) => `<Relationship Id="rId${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${idx + 1}.xml"/>`).join('')}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function rootRelsXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function contentTypesXml(sheets, drawingCount) {
    const worksheetTypes = sheets.map((_, idx) =>
        `<Override PartName="/xl/worksheets/sheet${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    ).join('');
    const drawingTypes = Array.from({ length: drawingCount }, (_, idx) =>
        `<Override PartName="/xl/drawings/drawing${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`
    ).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
${worksheetTypes}
${drawingTypes}
</Types>`;
}

function stylesXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="11">
<font><sz val="11"/><color rgb="FF111827"/><name val="Noto Sans Thai"/></font>
<font><b/><sz val="14"/><color rgb="FFFFFFFF"/><name val="Noto Sans Thai"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Noto Sans Thai"/></font>
<font><b/><sz val="18"/><color rgb="FFFFFFFF"/><name val="Noto Sans Thai"/></font>
<font><b/><sz val="18"/><color rgb="FF0F172A"/><name val="Noto Sans Thai"/></font>
<font><sz val="10"/><color rgb="FF64748B"/><name val="Noto Sans Thai"/></font>
<font><b/><sz val="12"/><color rgb="FF0F172A"/><name val="Noto Sans Thai"/></font>
<font><b/><sz val="11"/><color rgb="FF0F766E"/><name val="Noto Sans Thai"/></font>
<font><sz val="10"/><color rgb="FF475569"/><name val="Noto Sans Thai"/></font>
<font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Noto Sans Thai"/></font>
<font><b/><sz val="13"/><color rgb="FF0F172A"/><name val="Noto Sans Thai"/></font>
</fonts>
<fills count="13">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF006838"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF00A651"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF4F8F7"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE7F6EF"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEAF3FF"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFF7E6"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFCE7F3"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFECFEFF"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEDE9FE"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="3">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFD9E2DD"/></left><right style="thin"><color rgb="FFD9E2DD"/></right><top style="thin"><color rgb="FFD9E2DD"/></top><bottom style="thin"><color rgb="FFD9E2DD"/></bottom><diagonal/></border>
<border><left style="thin"><color rgb="FFE2E8F0"/></left><right style="thin"><color rgb="FFE2E8F0"/></right><top style="thin"><color rgb="FFE2E8F0"/></top><bottom style="thin"><color rgb="FFE2E8F0"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="15">
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1"/>
<xf numFmtId="0" fontId="3" fillId="6" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="5" borderId="2" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="3" fontId="4" fillId="5" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
<xf numFmtId="0" fontId="5" fillId="5" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="9" fillId="6" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="6" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="3" fontId="0" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
<xf numFmtId="10" fontId="0" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
<xf numFmtId="0" fontId="7" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="8" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
<dxfs count="0"/>
<tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleMedium9"/>
</styleSheet>`;
}

function docPropsCoreXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:creator>${xmlEscape(APP_NAME_TH)}</dc:creator>
<cp:lastModifiedBy>${xmlEscape(APP_NAME_EN)}</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
<dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified>
</cp:coreProperties>`;
}

function docPropsAppXml(sheetCount) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
<Application>${xmlEscape(APP_NAME_EN)}</Application>
<DocSecurity>0</DocSecurity>
<ScaleCrop>false</ScaleCrop>
<HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${sheetCount}</vt:i4></vt:variant></vt:vector></HeadingPairs>
</Properties>`;
}

function drawingXml(images = []) {
    const anchors = images.map((image, idx) => {
        const fromCol = Math.max(0, Math.round(image.fromCol ?? 0));
        const toCol = Math.max(fromCol + 1, Math.round(image.toCol ?? 10));
        const fromRow = Math.max(0, Math.round(image.fromRow ?? (1 + idx * 24)));
        const toRow = Math.max(fromRow + 1, Math.round(image.toRow ?? (22 + idx * 24)));
        const imageName = image.name || `Chart ${idx + 1}`;

        return `<xdr:twoCellAnchor editAs="oneCell">
<xdr:from><xdr:col>${fromCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
<xdr:to><xdr:col>${toCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
<xdr:pic>
<xdr:nvPicPr><xdr:cNvPr id="${idx + 1}" name="${xmlEscape(imageName)}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>
<xdr:blipFill><a:blip r:embed="rId${idx + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>
<xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>
</xdr:pic>
<xdr:clientData/>
</xdr:twoCellAnchor>`;
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
${anchors}
</xdr:wsDr>`;
}

function drawingRelsXml(images = [], firstImageIndex = 1) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${images.map((_, idx) => `<Relationship Id="rId${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${firstImageIndex + idx}.png"/>`).join('')}
</Relationships>`;
}

function sheetRelsXml(drawingIndex) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawingIndex}.xml"/>
</Relationships>`;
}

function normalizeDepartmentLabel(value) {
    return String(value || '').replace(/^ภาควิชา/u, '').trim() || String(value || '');
}

function expandWeightedValues(items = [], labelKey = 'label') {
    return (items || []).flatMap(item =>
        Array.from({ length: Math.max(0, Number(item?.count) || 0) }, () => item?.[labelKey] || '')
    );
}

function buildHrPersonnelExportRows(science = {}) {
    const positions = expandWeightedValues((science.academicPositions || []).filter(item => item.count > 0), 'position');
    const education = expandWeightedValues(science.byEducation || [], 'level');
    const genders = expandWeightedValues(science.byGender || [], 'gender');
    const ageGroups = expandWeightedValues(science.diversity?.ageGroup || [], 'group');
    const supportPositions = [
        'เจ้าหน้าที่บริหารงานทั่วไป',
        'นักวิทยาศาสตร์',
        'เจ้าหน้าที่ห้องปฏิบัติการ',
        'เจ้าหน้าที่การเงิน',
        'เจ้าหน้าที่สารสนเทศ',
    ];
    const rows = [];
    let academicCursor = 0;
    let supportCursor = 0;

    (science.byDepartment || []).forEach((dept, deptIndex) => {
        const department = normalizeDepartmentLabel(dept.dept);
        for (let i = 0; i < Number(dept.academic || 0); i += 1) {
            const code = `SCI-A${String(deptIndex + 1).padStart(2, '0')}-${String(i + 1).padStart(3, '0')}`;
            rows.push({
                code,
                name: `บุคลากรสายวิชาการ ${code}`,
                department,
                role: 'สายวิชาการ',
                gender: genders[rows.length % Math.max(1, genders.length)] || '',
                position: positions[academicCursor % Math.max(1, positions.length)] || 'อาจารย์',
                education: education[academicCursor % Math.max(1, education.length)] || 'ปริญญาเอก',
                ageGroup: ageGroups[rows.length % Math.max(1, ageGroups.length)] || '',
            });
            academicCursor += 1;
        }
        for (let i = 0; i < Number(dept.support || 0); i += 1) {
            const code = `SCI-S${String(deptIndex + 1).padStart(2, '0')}-${String(i + 1).padStart(3, '0')}`;
            rows.push({
                code,
                name: `บุคลากรสายสนับสนุน ${code}`,
                department,
                role: 'สายสนับสนุน',
                gender: genders[rows.length % Math.max(1, genders.length)] || '',
                position: supportPositions[supportCursor % supportPositions.length],
                education: supportCursor % 5 === 0 ? 'ปริญญาโท' : 'ปริญญาตรี',
                ageGroup: ageGroups[rows.length % Math.max(1, ageGroups.length)] || '',
            });
            supportCursor += 1;
        }
    });

    return rows;
}

function excelQuoteSheet(name) {
    return `'${String(name).replace(/'/g, "''")}'`;
}

function excelRange(sheet, range) {
    return `${excelQuoteSheet(sheet)}!${range}`;
}

function formulaCell(formula, style = 0, cachedValue = '') {
    return { formula: String(formula || '').replace(/^=/, ''), style, value: cachedValue };
}

function styledCell(value, style = 0) {
    return { value, style };
}

function blankStyledRow(cols, style = 3) {
    return Array.from({ length: cols }, () => styledCell('', style));
}

function setCell(rows, row, col, value, style = 0) {
    if (!rows[row - 1]) rows[row - 1] = [];
    rows[row - 1][col - 1] = styledCell(value, style);
}

function setFormula(rows, row, col, formula, style = 0, cachedValue = '') {
    if (!rows[row - 1]) rows[row - 1] = [];
    rows[row - 1][col - 1] = formulaCell(formula, style, cachedValue);
}

function fillRect(rows, startRow, startCol, endRow, endCol, style = 0) {
    for (let row = startRow; row <= endRow; row += 1) {
        if (!rows[row - 1]) rows[row - 1] = [];
        for (let col = startCol; col <= endCol; col += 1) {
            rows[row - 1][col - 1] = rows[row - 1][col - 1] || styledCell('', style);
        }
    }
}

function professionalCellXml(rawCell, ref) {
    const cell = rawCell && typeof rawCell === 'object' && !Array.isArray(rawCell) && ('value' in rawCell || 'formula' in rawCell || 'style' in rawCell)
        ? rawCell
        : { value: rawCell };
    const style = styleAttribute(cell.style || 0);
    const value = cell.value;
    if (cell.formula) {
        const cached = value == null || value === '' ? '' : `<v>${xmlEscape(value)}</v>`;
        return `<c r="${ref}"${style}><f>${xmlEscape(cell.formula)}</f>${cached}</c>`;
    }
    if (value == null || value === '') return `<c r="${ref}"${style}/>`;
    if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${style}><v>${value}</v></c>`;
    if (typeof value === 'boolean') return `<c r="${ref}" t="b"${style}><v>${value ? 1 : 0}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${style}><is><t>${xmlEscape(value)}</t></is></c>`;
}

function professionalWorksheetXml({
    rows = [],
    colWidths = [],
    rowHeights = {},
    merges = [],
    drawingRelId = '',
    chartBounds = null,
    tableRefs = [],
    freezeRows = 0,
    showGridLines = true,
}) {
    let maxCol = Math.max(1, colWidths.length, ...rows.map(row => row?.length || 0));
    let maxRow = Math.max(1, rows.length);
    if (chartBounds) {
        maxCol = Math.max(maxCol, chartBounds.maxCol || 1);
        maxRow = Math.max(maxRow, chartBounds.maxRow || 1);
    }
    tableRefs.forEach(ref => {
        const match = String(ref).match(/:([A-Z]+)(\d+)$/);
        if (match) {
            maxCol = Math.max(maxCol, columnIndexFromName(match[1]) + 1);
            maxRow = Math.max(maxRow, Number(match[2]));
        }
    });

    const rowXml = [];
    rows.forEach((row, rowIdx) => {
        const rowNumber = rowIdx + 1;
        const rowHeight = rowHeights[rowNumber] ?? rowHeights[String(rowNumber)];
        const cells = [];
        for (let colIdx = 0; colIdx < Math.max(row?.length || 0, maxCol); colIdx += 1) {
            const cell = row?.[colIdx];
            if (cell == null || cell === '') continue;
            cells.push(professionalCellXml(cell, `${columnName(colIdx)}${rowNumber}`));
        }
        if (cells.length === 0 && !rowHeight) return;
        rowXml.push(`<row r="${rowNumber}"${rowHeight ? ` ht="${rowHeight}" customHeight="1"` : ''}>${cells.join('')}</row>`);
    });

    const cols = Array.from({ length: maxCol }, (_, idx) =>
        `<col min="${idx + 1}" max="${idx + 1}" width="${colWidths[idx] || 12}" customWidth="1"/>`
    ).join('');
    const mergeXml = merges.length
        ? `<mergeCells count="${merges.length}">${merges.map(ref => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`
        : '';
    const freezePane = freezeRows > 0
        ? `<pane ySplit="${freezeRows}" topLeftCell="A${freezeRows + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/>`
        : '';
    const tableParts = tableRefs.length
        ? `<tableParts count="${tableRefs.length}">${tableRefs.map((_, idx) => `<tablePart r:id="rId${drawingRelId ? idx + 2 : idx + 1}"/>`).join('')}</tableParts>`
        : '';

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<dimension ref="A1:${columnName(maxCol - 1)}${maxRow}"/>
<sheetViews><sheetView workbookViewId="0" showGridLines="${showGridLines ? 1 : 0}">${freezePane}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="21"/>
<cols>${cols}</cols>
<sheetData>${rowXml.join('')}</sheetData>
${mergeXml}
${drawingRelId ? `<drawing r:id="${drawingRelId}"/>` : ''}
${tableParts}
</worksheet>`;
}

function columnIndexFromName(name) {
    return String(name || 'A').split('').reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function chartBounds(charts = []) {
    if (!charts.length) return null;
    return {
        maxCol: Math.max(...charts.map(chart => chart.toCol || 12)) + 1,
        maxRow: Math.max(...charts.map(chart => chart.toRow || 18)) + 1,
    };
}

function solidFill(color = '#64748B') {
    return `<a:solidFill><a:srgbClr val="${String(color).replace('#', '').toUpperCase()}"/></a:solidFill>`;
}

function chartTitleXml(title) {
    return `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="th-TH" sz="1200" b="1"/><a:t>${xmlEscape(title)}</a:t></a:r></a:p></c:rich></c:tx><c:layout/><c:overlay val="0"/></c:title>`;
}

function chartTextCache(values = []) {
    return `<c:strCache><c:ptCount val="${values.length}"/>${values.map((value, idx) =>
        `<c:pt idx="${idx}"><c:v>${xmlEscape(value)}</c:v></c:pt>`
    ).join('')}</c:strCache>`;
}

function chartNumberCache(values = []) {
    return `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${values.map((value, idx) =>
        `<c:pt idx="${idx}"><c:v>${Number(value) || 0}</c:v></c:pt>`
    ).join('')}</c:numCache>`;
}

function chartFormula(sheet, range) {
    return `${excelQuoteSheet(sheet)}!${range}`;
}

function chartSeriesXml(series, categories, index, { type = 'bar' } = {}) {
    const color = series.color || '#2563EB';
    const marker = type === 'line'
        ? '<c:marker><c:symbol val="circle"/><c:size val="5"/></c:marker>'
        : '';
    const lineProps = type === 'line'
        ? `<c:spPr><a:ln w="25400">${solidFill(color)}</a:ln></c:spPr>`
        : `<c:spPr>${solidFill(color)}<a:ln>${solidFill(color)}</a:ln></c:spPr>`;
    return `<c:ser>
<c:idx val="${index}"/><c:order val="${index}"/>
<c:tx><c:v>${xmlEscape(series.name)}</c:v></c:tx>
${lineProps}
${marker}
<c:cat><c:strRef><c:f>${xmlEscape(chartFormula(categories.sheet, categories.range))}</c:f>${chartTextCache(categories.values)}</c:strRef></c:cat>
<c:val><c:numRef><c:f>${xmlEscape(chartFormula(series.sheet, series.range))}</c:f>${chartNumberCache(series.values)}</c:numRef></c:val>
${type === 'line' ? '<c:smooth val="1"/>' : ''}
</c:ser>`;
}

function doughnutSeriesXml(chart) {
    const series = chart.series[0];
    const colors = chart.colors || ['#0F766E', '#2563EB', '#C5A028', '#64748B', '#7C3AED', '#EC4899'];
    return `<c:ser>
<c:idx val="0"/><c:order val="0"/>
<c:tx><c:v>${xmlEscape(series.name || chart.title)}</c:v></c:tx>
${(chart.categories.values || []).map((_, idx) =>
        `<c:dPt><c:idx val="${idx}"/><c:spPr>${solidFill(colors[idx % colors.length])}</c:spPr></c:dPt>`
    ).join('')}
<c:cat><c:strRef><c:f>${xmlEscape(chartFormula(chart.categories.sheet, chart.categories.range))}</c:f>${chartTextCache(chart.categories.values)}</c:strRef></c:cat>
<c:val><c:numRef><c:f>${xmlEscape(chartFormula(series.sheet, series.range))}</c:f>${chartNumberCache(series.values)}</c:numRef></c:val>
</c:ser>`;
}

function axesXml(catAxisId, valAxisId) {
    return `<c:catAx><c:axId val="${catAxisId}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${valAxisId}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx>
<c:valAx><c:axId val="${valAxisId}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/><c:numFmt formatCode="#,##0" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${catAxisId}"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`;
}

function nativeChartXml(chart, chartIndex) {
    const catAxisId = 100000 + chartIndex * 2;
    const valAxisId = catAxisId + 1;
    let plotXml = '';

    if (chart.type === 'doughnut') {
        plotXml = `<c:doughnutChart><c:varyColors val="1"/>${doughnutSeriesXml(chart)}<c:firstSliceAng val="270"/><c:holeSize val="62"/></c:doughnutChart>`;
    } else if (chart.type === 'line') {
        plotXml = `<c:lineChart><c:grouping val="standard"/>${chart.series.map((series, idx) =>
            chartSeriesXml(series, chart.categories, idx, { type: 'line' })
        ).join('')}<c:axId val="${catAxisId}"/><c:axId val="${valAxisId}"/></c:lineChart>${axesXml(catAxisId, valAxisId)}`;
    } else {
        plotXml = `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${chart.series.map((series, idx) =>
            chartSeriesXml(series, chart.categories, idx, { type: 'bar' })
        ).join('')}<c:gapWidth val="140"/><c:axId val="${catAxisId}"/><c:axId val="${valAxisId}"/></c:barChart>${axesXml(catAxisId, valAxisId)}`;
    }

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<c:date1904 val="0"/><c:lang val="th-TH"/><c:roundedCorners val="0"/>
<c:chart>${chartTitleXml(chart.title)}<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${plotXml}</c:plotArea><c:legend><c:legendPos val="b"/><c:layout/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>
<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="D9E2DD"/></a:solidFill></a:ln></c:spPr>
</c:chartSpace>`;
}

function chartDrawingXml(charts = []) {
    const anchors = charts.map((chart, idx) => `<xdr:twoCellAnchor editAs="oneCell">
<xdr:from><xdr:col>${chart.fromCol || 0}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${chart.fromRow || 0}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
<xdr:to><xdr:col>${chart.toCol || 12}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${chart.toRow || 18}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
<xdr:graphicFrame macro="">
<xdr:nvGraphicFramePr><xdr:cNvPr id="${idx + 2}" name="${xmlEscape(chart.title || `Chart ${idx + 1}`)}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>
<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId${idx + 1}"/></a:graphicData></a:graphic>
</xdr:graphicFrame>
<xdr:clientData/>
</xdr:twoCellAnchor>`).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
${anchors}
</xdr:wsDr>`;
}

function chartDrawingRelsXml(charts = [], firstChartIndex = 1) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${charts.map((_, idx) => `<Relationship Id="rId${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${firstChartIndex + idx}.xml"/>`).join('')}
</Relationships>`;
}

function sheetRelsXmlAdvanced({ drawingIndex = 0, tables = [] }) {
    const rels = [];
    if (drawingIndex) {
        rels.push(`<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawingIndex}.xml"/>`);
    }
    tables.forEach((table, idx) => {
        rels.push(`<Relationship Id="rId${drawingIndex ? idx + 2 : idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table${table.tableIndex}.xml"/>`);
    });
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${rels.join('')}
</Relationships>`;
}

function tableXml({ id, name, ref, headers = [] }) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="${id}" name="${xmlEscape(name)}" displayName="${xmlEscape(name)}" ref="${ref}" totalsRowShown="0">
<autoFilter ref="${ref}"/>
<tableColumns count="${headers.length}">${headers.map((header, idx) => `<tableColumn id="${idx + 1}" name="${xmlEscape(header || `Column ${idx + 1}`)}"/>`).join('')}</tableColumns>
<tableStyleInfo name="TableStyleMedium4" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/>
</table>`;
}

function professionalContentTypesXml(sheets, drawingCount, chartCount, tableCount) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
${sheets.map((_, idx) => `<Override PartName="/xl/worksheets/sheet${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
${Array.from({ length: drawingCount }, (_, idx) => `<Override PartName="/xl/drawings/drawing${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`).join('')}
${Array.from({ length: chartCount }, (_, idx) => `<Override PartName="/xl/charts/chart${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`).join('')}
${Array.from({ length: tableCount }, (_, idx) => `<Override PartName="/xl/tables/table${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>`).join('')}
</Types>`;
}

function buildHrProfessionalWorkbookSheets(title = 'บุคลากรและโครงสร้างองค์กร') {
    const data = getDataset('hr', hrData) || {};
    const science = data.scienceFaculty || {};
    const personnelRows = buildHrPersonnelExportRows(science);
    const rawEndRow = Math.max(2, personnelRows.length + 1);
    const rawHeaders = ['รหัสบุคลากร', 'ชื่อในระบบ', 'ภาควิชา', 'สายงาน', 'เพศ', 'ตำแหน่ง', 'วุฒิ', 'ช่วงอายุ'];
    const departmentRows = (science.byDepartment || []).map(row => ({
        label: normalizeDepartmentLabel(row.dept),
        academic: Number(row.academic) || 0,
        support: Number(row.support) || 0,
    }));
    const positionRows = science.academicPositions || [];
    const genderRows = science.byGender || [];
    const ageRows = science.diversity?.ageGroup || [];
    const educationRows = science.byEducation || [];
    const trendRows = science.trend || [];
    const promotionRows = science.promotionTrend || [];
    const ratioRows = science.studentFacultyRatio || [];
    const assocAssist = Number(positionRows[1]?.count || 0) + Number(positionRows[2]?.count || 0);
    const phdCount = Number(educationRows.find(row => /เอก|phd|doctor/i.test(row.level || ''))?.count || 0);
    const retirement = Number(science.diversity?.retirementIn5Years || 0);

    const rawRows = [
        rawHeaders.map(header => styledCell(header, 10)),
        ...personnelRows.map(row => [
            row.code,
            row.name,
            row.department,
            row.role,
            row.gender,
            row.position,
            row.education,
            row.ageGroup,
        ]),
    ];

    const summaryRows = Array.from({ length: 44 }, () => []);
    setCell(summaryRows, 1, 1, 'สรุปข้อมูลบุคลากร', 4);
    setCell(summaryRows, 2, 2, 'ตัวชี้วัด', 10);
    setCell(summaryRows, 2, 3, 'จำนวน', 10);
    setCell(summaryRows, 2, 4, 'สัดส่วน', 10);

    const roleRange = `${excelRange('Raw Data', `$D$2:$D$${rawEndRow}`)}`;
    const educationRange = `${excelRange('Raw Data', `$G$2:$G$${rawEndRow}`)}`;
    const positionRange = `${excelRange('Raw Data', `$F$2:$F$${rawEndRow}`)}`;
    const codeRange = `${excelRange('Raw Data', `$A$2:$A$${rawEndRow}`)}`;
    const kpis = [
        ['จำนวนบุคลากรทั้งหมด', `COUNTA(${codeRange})`, Number(science.total || personnelRows.length), ''],
        ['สายวิชาการ', `COUNTIF(${roleRange},"สายวิชาการ")`, Number(science.academic || 0), '=C4/$C$3'],
        ['สายสนับสนุน', `COUNTIF(${roleRange},"สายสนับสนุน")`, Number(science.support || 0), '=C5/$C$3'],
        ['ปริญญาเอก', `COUNTIF(${educationRange},"*เอก*")`, phdCount, '=C6/$C$3'],
        ['รศ.+ผศ.', `COUNTIF(${positionRange},"*รองศาสตราจารย์*")+COUNTIF(${positionRange},"*ผู้ช่วยศาสตราจารย์*")`, assocAssist, '=C7/$C$3'],
        ['เกษียณใน 5 ปี', `${retirement}`, retirement, '=C8/$C$3'],
    ];
    kpis.forEach((row, idx) => {
        const excelRow = idx + 3;
        setCell(summaryRows, excelRow, 2, row[0], 13);
        setFormula(summaryRows, excelRow, 3, row[1], 11, row[2]);
        setFormula(summaryRows, excelRow, 4, row[3] || `=C${excelRow}/$C$3`, 12, Number(science.total) ? row[2] / Number(science.total) : 0);
    });

    setCell(summaryRows, 11, 2, 'ภาควิชา', 10);
    setCell(summaryRows, 11, 3, 'สายวิชาการ', 10);
    setCell(summaryRows, 11, 4, 'สายสนับสนุน', 10);
    setCell(summaryRows, 11, 5, 'รวม', 10);
    departmentRows.forEach((dept, idx) => {
        const excelRow = idx + 12;
        const deptRange = excelRange('Raw Data', `$C$2:$C$${rawEndRow}`);
        setCell(summaryRows, excelRow, 2, dept.label, 5);
        setFormula(summaryRows, excelRow, 3, `COUNTIFS(${deptRange},B${excelRow},${roleRange},"สายวิชาการ")`, 11, dept.academic);
        setFormula(summaryRows, excelRow, 4, `COUNTIFS(${deptRange},B${excelRow},${roleRange},"สายสนับสนุน")`, 11, dept.support);
        setFormula(summaryRows, excelRow, 5, `SUM(C${excelRow}:D${excelRow})`, 11, dept.academic + dept.support);
    });

    setCell(summaryRows, 21, 2, 'ตำแหน่งทางวิชาการ', 10);
    setCell(summaryRows, 21, 3, 'จำนวน', 10);
    positionRows.forEach((position, idx) => {
        const excelRow = idx + 22;
        setCell(summaryRows, excelRow, 2, position.position, 5);
        setFormula(summaryRows, excelRow, 3, `COUNTIF(${positionRange},B${excelRow})`, 11, Number(position.count || 0));
    });

    setCell(summaryRows, 28, 2, 'ปี', 10);
    setCell(summaryRows, 28, 3, 'สายวิชาการ', 10);
    setCell(summaryRows, 28, 4, 'สายสนับสนุน', 10);
    setCell(summaryRows, 28, 5, 'รวม', 10);
    trendRows.forEach((trend, idx) => {
        const excelRow = idx + 29;
        setCell(summaryRows, excelRow, 2, trend.year, 5);
        setCell(summaryRows, excelRow, 3, Number(trend.academic || 0), 11);
        setCell(summaryRows, excelRow, 4, Number(trend.support || 0), 11);
        setFormula(summaryRows, excelRow, 5, `SUM(C${excelRow}:D${excelRow})`, 11, Number(trend.total || 0));
    });

    setCell(summaryRows, 11, 7, 'เพศ', 10);
    setCell(summaryRows, 11, 8, 'จำนวน', 10);
    setCell(summaryRows, 11, 9, 'สัดส่วน', 10);
    genderRows.forEach((gender, idx) => {
        const excelRow = idx + 12;
        const genderRange = excelRange('Raw Data', `$E$2:$E$${rawEndRow}`);
        setCell(summaryRows, excelRow, 7, gender.gender, 5);
        setFormula(summaryRows, excelRow, 8, `COUNTIF(${genderRange},G${excelRow})`, 11, Number(gender.count || 0));
        setFormula(summaryRows, excelRow, 9, `H${excelRow}/SUM($H$12:$H$13)`, 12, Number(gender.count || 0) / Math.max(1, Number(science.total || 1)));
    });

    setCell(summaryRows, 16, 7, 'กลุ่มอายุ', 10);
    setCell(summaryRows, 16, 8, 'จำนวน', 10);
    ageRows.forEach((age, idx) => {
        const excelRow = idx + 17;
        const ageRange = excelRange('Raw Data', `$H$2:$H$${rawEndRow}`);
        setCell(summaryRows, excelRow, 7, age.group, 5);
        setFormula(summaryRows, excelRow, 8, `COUNTIF(${ageRange},G${excelRow})`, 11, Number(age.count || 0));
    });

    setCell(summaryRows, 23, 7, 'วุฒิการศึกษา', 10);
    setCell(summaryRows, 23, 8, 'จำนวน', 10);
    setCell(summaryRows, 23, 9, 'สัดส่วน', 10);
    educationRows.forEach((ed, idx) => {
        const excelRow = idx + 24;
        setCell(summaryRows, excelRow, 7, ed.level, 5);
        setFormula(summaryRows, excelRow, 8, `COUNTIF(${educationRange},G${excelRow})`, 11, Number(ed.count || 0));
        setFormula(summaryRows, excelRow, 9, `H${excelRow}/SUM($H$24:$H$${23 + educationRows.length})`, 12, Number(ed.count || 0) / Math.max(1, Number(science.academic || 1)));
    });

    setCell(summaryRows, 28, 7, 'ปี', 10);
    setCell(summaryRows, 28, 8, 'รศ. ใหม่', 10);
    setCell(summaryRows, 28, 9, 'ผศ. ใหม่', 10);
    setCell(summaryRows, 28, 10, 'ศ. ใหม่', 10);
    promotionRows.forEach((promotion, idx) => {
        const excelRow = idx + 29;
        setCell(summaryRows, excelRow, 7, promotion.year, 5);
        setCell(summaryRows, excelRow, 8, Number(promotion.newAssocProf || 0), 11);
        setCell(summaryRows, excelRow, 9, Number(promotion.newAssistProf || 0), 11);
        setCell(summaryRows, excelRow, 10, Number(promotion.newProf || 0), 11);
    });

    setCell(summaryRows, 36, 7, 'ปี', 10);
    setCell(summaryRows, 36, 8, 'อัตราส่วนนักศึกษา:อาจารย์', 10);
    ratioRows.forEach((ratio, idx) => {
        const excelRow = idx + 37;
        setCell(summaryRows, excelRow, 7, ratio.year, 5);
        setCell(summaryRows, excelRow, 8, Number(ratio.ratio || 0), 11);
    });

    const dashboardRows = Array.from({ length: 58 }, () => blankStyledRow(26, 3));
    fillRect(dashboardRows, 2, 2, 4, 25, 4);
    setCell(dashboardRows, 2, 2, title || 'บุคลากรและโครงสร้างองค์กร', 4);
    setCell(dashboardRows, 3, 2, 'HR & Faculty Profile Dashboard - คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้', 4);
    setCell(dashboardRows, 4, 2, `ข้อมูลล่าสุด: ${new Date().toLocaleDateString('th-TH')}`, 4);

    const cardDefs = [
        { label: 'บุคลากรทั้งหมด', value: science.total || personnelRows.length, icon: 'HR', style: 8 },
        { label: 'สายวิชาการ', value: science.academic || 0, icon: 'AC', style: 8 },
        { label: 'สายสนับสนุน', value: science.support || 0, icon: 'SP', style: 8 },
        { label: 'ปริญญาเอก', value: phdCount, icon: 'PhD', style: 8 },
        { label: 'รศ.+ผศ.', value: assocAssist, icon: 'AP', style: 8 },
        { label: 'เกษียณใน 5 ปี', value: retirement, icon: '5Y', style: 8 },
    ];
    cardDefs.forEach((card, idx) => {
        const startCol = 2 + idx * 4;
        fillRect(dashboardRows, 6, startCol, 9, startCol + 3, 5);
        setCell(dashboardRows, 6, startCol, card.icon, card.style);
        setCell(dashboardRows, 6, startCol + 1, card.label, 7);
        setCell(dashboardRows, 7, startCol + 1, Number(card.value || 0), 6);
        setCell(dashboardRows, 8, startCol + 1, 'คน', 7);
    });
    setCell(dashboardRows, 11, 2, 'ภาพรวมตามภาควิชาและโครงสร้างบุคลากร', 9);
    setCell(dashboardRows, 29, 2, 'แนวโน้มและสัดส่วนสำคัญ', 9);

    const chartColors = {
        green: '#0F766E',
        blue: '#2563EB',
        gold: '#C5A028',
        purple: '#7C3AED',
        pink: '#DB2777',
    };
    const chartDefs = {
        department: {
            type: 'bar',
            title: 'บุคลากรแยกตามภาควิชา',
            categories: { sheet: 'Summary', range: `$B$12:$B$${11 + departmentRows.length}`, values: departmentRows.map(row => row.label) },
            series: [
                { name: 'สายวิชาการ', sheet: 'Summary', range: `$C$12:$C$${11 + departmentRows.length}`, values: departmentRows.map(row => row.academic), color: chartColors.green },
                { name: 'สายสนับสนุน', sheet: 'Summary', range: `$D$12:$D$${11 + departmentRows.length}`, values: departmentRows.map(row => row.support), color: chartColors.blue },
            ],
        },
        position: {
            type: 'doughnut',
            title: 'ตำแหน่งทางวิชาการ',
            categories: { sheet: 'Summary', range: `$B$22:$B$${21 + positionRows.length}`, values: positionRows.map(row => row.position) },
            series: [{ name: 'จำนวน', sheet: 'Summary', range: `$C$22:$C$${21 + positionRows.length}`, values: positionRows.map(row => Number(row.count || 0)) }],
            colors: ['#C5A028', '#2563EB', '#0F766E', '#7C3AED'],
        },
        trend: {
            type: 'line',
            title: 'แนวโน้มจำนวนบุคลากร',
            categories: { sheet: 'Summary', range: `$B$29:$B$${28 + trendRows.length}`, values: trendRows.map(row => row.year) },
            series: [
                { name: 'สายวิชาการ', sheet: 'Summary', range: `$C$29:$C$${28 + trendRows.length}`, values: trendRows.map(row => Number(row.academic || 0)), color: chartColors.green },
                { name: 'สายสนับสนุน', sheet: 'Summary', range: `$D$29:$D$${28 + trendRows.length}`, values: trendRows.map(row => Number(row.support || 0)), color: chartColors.blue },
            ],
        },
        gender: {
            type: 'doughnut',
            title: 'สัดส่วนเพศ',
            categories: { sheet: 'Summary', range: `$G$12:$G$${11 + genderRows.length}`, values: genderRows.map(row => row.gender) },
            series: [{ name: 'จำนวน', sheet: 'Summary', range: `$H$12:$H$${11 + genderRows.length}`, values: genderRows.map(row => Number(row.count || 0)) }],
            colors: ['#2563EB', '#DB2777'],
        },
        age: {
            type: 'bar',
            title: 'กลุ่มอายุ',
            categories: { sheet: 'Summary', range: `$G$17:$G$${16 + ageRows.length}`, values: ageRows.map(row => row.group) },
            series: [{ name: 'จำนวน', sheet: 'Summary', range: `$H$17:$H$${16 + ageRows.length}`, values: ageRows.map(row => Number(row.count || 0)), color: chartColors.gold }],
        },
        promotion: {
            type: 'bar',
            title: 'การได้ตำแหน่งทางวิชาการใหม่รายปี',
            categories: { sheet: 'Summary', range: `$G$29:$G$${28 + promotionRows.length}`, values: promotionRows.map(row => row.year) },
            series: [
                { name: 'รศ. ใหม่', sheet: 'Summary', range: `$H$29:$H$${28 + promotionRows.length}`, values: promotionRows.map(row => Number(row.newAssocProf || 0)), color: chartColors.purple },
                { name: 'ผศ. ใหม่', sheet: 'Summary', range: `$I$29:$I$${28 + promotionRows.length}`, values: promotionRows.map(row => Number(row.newAssistProf || 0)), color: chartColors.blue },
                { name: 'ศ. ใหม่', sheet: 'Summary', range: `$J$29:$J$${28 + promotionRows.length}`, values: promotionRows.map(row => Number(row.newProf || 0)), color: chartColors.gold },
            ],
        },
    };

    const dashboardCharts = [
        { ...chartDefs.department, fromRow: 11, fromCol: 1, toRow: 27, toCol: 13 },
        { ...chartDefs.position, fromRow: 11, fromCol: 14, toRow: 27, toCol: 25 },
        { ...chartDefs.trend, fromRow: 30, fromCol: 1, toRow: 45, toCol: 13 },
        { ...chartDefs.gender, fromRow: 30, fromCol: 14, toRow: 45, toCol: 19 },
        { ...chartDefs.age, fromRow: 30, fromCol: 20, toRow: 45, toCol: 25 },
        { ...chartDefs.promotion, fromRow: 47, fromCol: 1, toRow: 57, toCol: 25 },
    ];
    const chartsSheetCharts = [
        { ...chartDefs.department, fromRow: 1, fromCol: 0, toRow: 18, toCol: 12 },
        { ...chartDefs.position, fromRow: 1, fromCol: 13, toRow: 18, toCol: 25 },
        { ...chartDefs.trend, fromRow: 20, fromCol: 0, toRow: 37, toCol: 12 },
        { ...chartDefs.gender, fromRow: 20, fromCol: 13, toRow: 37, toCol: 18 },
        { ...chartDefs.age, fromRow: 20, fromCol: 19, toRow: 37, toCol: 25 },
        { ...chartDefs.promotion, fromRow: 39, fromCol: 0, toRow: 56, toCol: 25 },
    ];

    const chartsRows = Array.from({ length: 58 }, () => blankStyledRow(26, 3));
    setCell(chartsRows, 1, 1, 'Charts', 9);
    const tableRef = `A1:H${rawEndRow}`;

    return [
        {
            name: 'Dashboard',
            rows: dashboardRows,
            colWidths: [3, 12, 11, 11, 4, 12, 11, 11, 4, 12, 11, 11, 4, 12, 11, 11, 4, 12, 11, 11, 4, 12, 11, 11, 4, 3],
            rowHeights: { 1: 10, 2: 30, 3: 24, 4: 22, 5: 10, 6: 26, 7: 30, 8: 20, 9: 12, 11: 24, 29: 24, 47: 20 },
            merges: ['B2:Y2', 'B3:Y3', 'B4:Y4', ...cardDefs.map((_, idx) => {
                const start = columnName(2 + idx * 4);
                const end = columnName(4 + idx * 4);
                return `${start}6:${end}6`;
            })],
            charts: dashboardCharts,
            showGridLines: false,
        },
        {
            name: 'Raw Data',
            rows: rawRows,
            colWidths: [18, 30, 28, 16, 12, 28, 18, 16],
            freezeRows: 1,
            tables: [{ name: 'RawData', ref: tableRef, headers: rawHeaders }],
        },
        {
            name: 'Summary',
            rows: summaryRows,
            colWidths: [3, 28, 15, 14, 14, 4, 24, 15, 14, 14],
            freezeRows: 2,
            showGridLines: false,
        },
        {
            name: 'Charts',
            rows: chartsRows,
            colWidths: Array.from({ length: 26 }, () => 11),
            rowHeights: { 1: 24, 20: 18, 39: 18 },
            charts: chartsSheetCharts,
            showGridLines: false,
        },
    ];
}

function downloadProfessionalWorkbook(fileName, sheetDefs) {
    let drawingIndex = 0;
    let chartIndex = 0;
    let tableIndex = 0;
    const drawingEntries = [];
    const chartEntries = [];
    const tableEntries = [];

    const preparedSheets = sheetDefs.map(sheet => {
        const charts = sheet.charts || [];
        const tables = (sheet.tables || []).map(table => {
            tableIndex += 1;
            return { ...table, tableIndex };
        });
        let sheetDrawingIndex = 0;
        if (charts.length) {
            drawingIndex += 1;
            sheetDrawingIndex = drawingIndex;
            drawingEntries.push({
                drawingIndex,
                charts,
                firstChartIndex: chartIndex + 1,
            });
            charts.forEach(chart => {
                chartIndex += 1;
                chartEntries.push({ chart, chartIndex });
            });
        }
        tables.forEach(table => tableEntries.push(table));
        return {
            ...sheet,
            drawingIndex: sheetDrawingIndex,
            tables,
        };
    });

    const entries = [
        { name: '[Content_Types].xml', content: professionalContentTypesXml(preparedSheets, drawingEntries.length, chartEntries.length, tableEntries.length) },
        { name: '_rels/.rels', content: rootRelsXml() },
        { name: 'docProps/core.xml', content: docPropsCoreXml() },
        { name: 'docProps/app.xml', content: docPropsAppXml(preparedSheets.length) },
        { name: 'xl/workbook.xml', content: workbookXml(preparedSheets) },
        { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml(preparedSheets) },
        { name: 'xl/styles.xml', content: stylesXml() },
    ];

    preparedSheets.forEach((sheet, idx) => {
        entries.push({
            name: `xl/worksheets/sheet${idx + 1}.xml`,
            content: professionalWorksheetXml({
                rows: sheet.rows,
                colWidths: sheet.colWidths,
                rowHeights: sheet.rowHeights,
                merges: sheet.merges,
                drawingRelId: sheet.drawingIndex ? 'rId1' : '',
                chartBounds: chartBounds(sheet.charts),
                tableRefs: sheet.tables?.map(table => table.ref) || [],
                freezeRows: sheet.freezeRows || 0,
                showGridLines: sheet.showGridLines !== false,
            }),
        });
        if (sheet.drawingIndex || sheet.tables?.length) {
            entries.push({
                name: `xl/worksheets/_rels/sheet${idx + 1}.xml.rels`,
                content: sheetRelsXmlAdvanced({ drawingIndex: sheet.drawingIndex, tables: sheet.tables || [] }),
            });
        }
    });

    drawingEntries.forEach(entry => {
        entries.push({
            name: `xl/drawings/drawing${entry.drawingIndex}.xml`,
            content: chartDrawingXml(entry.charts),
        });
        entries.push({
            name: `xl/drawings/_rels/drawing${entry.drawingIndex}.xml.rels`,
            content: chartDrawingRelsXml(entry.charts, entry.firstChartIndex),
        });
    });

    chartEntries.forEach(({ chart, chartIndex: index }) => {
        entries.push({
            name: `xl/charts/chart${index}.xml`,
            content: nativeChartXml(chart, index),
        });
    });

    tableEntries.forEach(table => {
        entries.push({
            name: `xl/tables/table${table.tableIndex}.xml`,
            content: tableXml({
                id: table.tableIndex,
                name: table.name || `Table${table.tableIndex}`,
                ref: table.ref,
                headers: table.headers,
            }),
        });
    });

    triggerBlobDownload(`${safeFileName(fileName)}.xlsx`, createZip(entries));
}

export function buildHrProfessionalDashboardWorkbookBlob(title = 'บุคลากรและโครงสร้างองค์กร') {
    const sheets = buildHrProfessionalWorkbookSheets(title);
    let drawingIndex = 0;
    let chartIndex = 0;
    let tableIndex = 0;
    const drawingEntries = [];
    const chartEntries = [];
    const tableEntries = [];
    const preparedSheets = sheets.map(sheet => {
        const charts = sheet.charts || [];
        const tables = (sheet.tables || []).map(table => {
            tableIndex += 1;
            return { ...table, tableIndex };
        });
        let sheetDrawingIndex = 0;
        if (charts.length) {
            drawingIndex += 1;
            sheetDrawingIndex = drawingIndex;
            drawingEntries.push({ drawingIndex, charts, firstChartIndex: chartIndex + 1 });
            charts.forEach(chart => {
                chartIndex += 1;
                chartEntries.push({ chart, chartIndex });
            });
        }
        tables.forEach(table => tableEntries.push(table));
        return { ...sheet, drawingIndex: sheetDrawingIndex, tables };
    });
    const entries = [
        { name: '[Content_Types].xml', content: professionalContentTypesXml(preparedSheets, drawingEntries.length, chartEntries.length, tableEntries.length) },
        { name: '_rels/.rels', content: rootRelsXml() },
        { name: 'docProps/core.xml', content: docPropsCoreXml() },
        { name: 'docProps/app.xml', content: docPropsAppXml(preparedSheets.length) },
        { name: 'xl/workbook.xml', content: workbookXml(preparedSheets) },
        { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml(preparedSheets) },
        { name: 'xl/styles.xml', content: stylesXml() },
    ];
    preparedSheets.forEach((sheet, idx) => {
        entries.push({
            name: `xl/worksheets/sheet${idx + 1}.xml`,
            content: professionalWorksheetXml({
                rows: sheet.rows,
                colWidths: sheet.colWidths,
                rowHeights: sheet.rowHeights,
                merges: sheet.merges,
                drawingRelId: sheet.drawingIndex ? 'rId1' : '',
                chartBounds: chartBounds(sheet.charts),
                tableRefs: sheet.tables?.map(table => table.ref) || [],
                freezeRows: sheet.freezeRows || 0,
                showGridLines: sheet.showGridLines !== false,
            }),
        });
        if (sheet.drawingIndex || sheet.tables?.length) {
            entries.push({
                name: `xl/worksheets/_rels/sheet${idx + 1}.xml.rels`,
                content: sheetRelsXmlAdvanced({ drawingIndex: sheet.drawingIndex, tables: sheet.tables || [] }),
            });
        }
    });
    drawingEntries.forEach(entry => {
        entries.push({ name: `xl/drawings/drawing${entry.drawingIndex}.xml`, content: chartDrawingXml(entry.charts) });
        entries.push({ name: `xl/drawings/_rels/drawing${entry.drawingIndex}.xml.rels`, content: chartDrawingRelsXml(entry.charts, entry.firstChartIndex) });
    });
    chartEntries.forEach(({ chart, chartIndex: index }) => {
        entries.push({ name: `xl/charts/chart${index}.xml`, content: nativeChartXml(chart, index) });
    });
    tableEntries.forEach(table => {
        entries.push({
            name: `xl/tables/table${table.tableIndex}.xml`,
            content: tableXml({ id: table.tableIndex, name: table.name || `Table${table.tableIndex}`, ref: table.ref, headers: table.headers }),
        });
    });
    return createZip(entries);
}

function crc32(bytes) {
    let crc = 0 ^ -1;
    for (let i = 0; i < bytes.length; i += 1) {
        crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
    }
    return (crc ^ -1) >>> 0;
}

function pushU16(out, value) {
    out.push(value & 0xFF, (value >>> 8) & 0xFF);
}

function pushU32(out, value) {
    out.push(value & 0xFF, (value >>> 8) & 0xFF, (value >>> 16) & 0xFF, (value >>> 24) & 0xFF);
}

function bytes(value) {
    if (value instanceof Uint8Array) return value;
    return encoder.encode(String(value ?? ''));
}

function createZip(entries, mimeType = XLSX_MIME) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    entries.forEach(entry => {
        const nameBytes = bytes(entry.name);
        const dataBytes = bytes(entry.content);
        const crc = crc32(dataBytes);
        const flags = 0x0800; // UTF-8 filenames

        const local = [];
        pushU32(local, 0x04034b50);
        pushU16(local, 20);
        pushU16(local, flags);
        pushU16(local, 0);
        pushU16(local, 0);
        pushU16(local, 0);
        pushU32(local, crc);
        pushU32(local, dataBytes.length);
        pushU32(local, dataBytes.length);
        pushU16(local, nameBytes.length);
        pushU16(local, 0);

        localParts.push(Uint8Array.from(local), nameBytes, dataBytes);

        const central = [];
        pushU32(central, 0x02014b50);
        pushU16(central, 20);
        pushU16(central, 20);
        pushU16(central, flags);
        pushU16(central, 0);
        pushU16(central, 0);
        pushU16(central, 0);
        pushU32(central, crc);
        pushU32(central, dataBytes.length);
        pushU32(central, dataBytes.length);
        pushU16(central, nameBytes.length);
        pushU16(central, 0);
        pushU16(central, 0);
        pushU16(central, 0);
        pushU16(central, 0);
        pushU32(central, 0);
        pushU32(central, offset);

        centralParts.push(Uint8Array.from(central), nameBytes);
        offset += local.length + nameBytes.length + dataBytes.length;
    });

    const centralOffset = offset;
    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = [];
    pushU32(end, 0x06054b50);
    pushU16(end, 0);
    pushU16(end, 0);
    pushU16(end, entries.length);
    pushU16(end, entries.length);
    pushU32(end, centralSize);
    pushU32(end, centralOffset);
    pushU16(end, 0);

    return new Blob([...localParts, ...centralParts, Uint8Array.from(end)], { type: mimeType });
}

function dataUrlToBytes(dataUrl) {
    const [, base64 = ''] = String(dataUrl || '').split(',');
    const binary = atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
}

function imageSizeFromDataUrl(dataUrl) {
    const bytes = dataUrlToBytes(dataUrl);
    if (
        bytes.length >= 24 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4E &&
        bytes[3] === 0x47
    ) {
        const readU32 = offset =>
            ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
        return { width: readU32(16), height: readU32(20) };
    }
    return { width: 960, height: 540 };
}

function numberOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function fitImageToCellBox(image, { maxCols = 10, maxRows = 15, minRows = 8 } = {}) {
    const { width, height } = imageSizeFromDataUrl(image.imageDataUrl);
    const aspect = width > 0 && height > 0 ? width / height : 16 / 9;
    const fromCol = numberOr(image.fromCol, 0);
    const fromRow = numberOr(image.fromRow, 1);
    const toCol = numberOr(image.toCol, fromCol + maxCols);
    const columnSpan = Math.max(1, toCol - fromCol);

    // Approximate Excel geometry: default column width 18 ~= 126 px,
    // row height 18 pt ~= 24 px. Fit height from width so images keep shape.
    const boxWidthPx = columnSpan * 126;
    const desiredHeightPx = boxWidthPx / aspect;
    const rowCount = Math.max(minRows, Math.min(maxRows, Math.round(desiredHeightPx / 24)));

    return {
        ...image,
        fromCol,
        toCol,
        fromRow,
        toRow: fromRow + rowCount,
    };
}

function normalizeSheetImages(source, fallbackName = 'Chart') {
    const rawImages = Array.isArray(source?.images)
        ? source.images
        : (source?.imageDataUrl ? [source] : []);

    return rawImages
        .filter(image => image?.imageDataUrl)
        .map((image, idx) => {
            const fitted = fitImageToCellBox({
                name: image.name || source?.name || `${fallbackName} ${idx + 1}`,
                imageDataUrl: image.imageDataUrl,
                fromCol: image.fromCol,
                toCol: image.toCol,
                fromRow: image.fromRow ?? (1 + idx * 20),
                toRow: image.toRow,
            });
            return {
                ...fitted,
                fromCol: numberOr(fitted.fromCol, 0),
                toCol: numberOr(fitted.toCol, 9),
                fromRow: numberOr(fitted.fromRow, 1 + idx * 18),
                toRow: numberOr(fitted.toRow, 17 + idx * 18),
            };
        });
}

function normalizeSheetInput(value, name) {
    const isConfiguredSheet = value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        ('rows' in value || 'images' in value || 'imageDataUrl' in value || 'dataStartRow' in value);

    if (isConfiguredSheet) {
        return {
            rows: normalizeRows(value.rows),
            images: normalizeSheetImages(value, name),
            dataStartRow: numberOr(value.dataStartRow, 1),
            title: value.title || '',
            colWidths: Array.isArray(value.colWidths) ? value.colWidths : null,
            rowHeights: value.rowHeights || null,
        };
    }

    return {
        rows: normalizeRows(value),
        images: [],
        dataStartRow: 1,
        title: '',
        colWidths: null,
        rowHeights: null,
    };
}

function imageDrawingBounds(images = []) {
    if (!images.length) return null;
    return {
        maxCol: Math.max(...images.map(image => numberOr(image.toCol, 10))) + 1,
        maxRow: Math.max(...images.map(image => numberOr(image.toRow, 22))) + 1,
    };
}

async function downloadXlsx(fileName, sheets, chartSheets = []) {
    const usedNames = new Set();
    const sheetDefs = [];

    Object.entries(sheets || {}).forEach(([name, sheetValue]) => {
        const sheetInput = normalizeSheetInput(sheetValue, name);
        if (sheetInput.rows.length === 0 && sheetInput.images.length === 0) return;
        sheetDefs.push({
            name: uniqueSheetName(name, usedNames),
            rows: sheetInput.rows,
            images: sheetInput.images,
            dataStartRow: sheetInput.dataStartRow,
            title: sheetInput.title,
            colWidths: sheetInput.colWidths,
            rowHeights: sheetInput.rowHeights,
        });
    });

    chartSheets.forEach((chart, idx) => {
        const rows = normalizeRows(chart?.rows);
        const images = normalizeSheetImages(chart, `Chart ${idx + 1}`);
        if (images.length === 0 && rows.length === 0) return;
        const lastImageRow = images.length
            ? Math.max(...images.map(image => numberOr(image.toRow, 18)))
            : 0;
        sheetDefs.push({
            name: uniqueSheetName(chart.name || `Chart ${idx + 1}`, usedNames, `Chart ${idx + 1}`),
            rows: rows.length > 0 ? rows : [{ note: 'Chart image captured from the dashboard page.' }],
            images,
            dataStartRow: images.length ? Math.max(18, lastImageRow + 3) : 1,
            title: images.length ? (chart.name || `Chart ${idx + 1}`) : '',
            colWidths: null,
            rowHeights: null,
        });
    });

    if (sheetDefs.length === 0) {
        sheetDefs.push({
            name: 'Export',
            rows: [{ note: 'No exportable data found on this page.' }],
            images: [],
            dataStartRow: 1,
            title: '',
            colWidths: null,
            rowHeights: null,
        });
    }

    const entries = [
        { name: '[Content_Types].xml', content: contentTypesXml(sheetDefs, sheetDefs.filter(sheet => sheet.images.length).length) },
        { name: '_rels/.rels', content: rootRelsXml() },
        { name: 'docProps/core.xml', content: docPropsCoreXml() },
        { name: 'docProps/app.xml', content: docPropsAppXml(sheetDefs.length) },
        { name: 'xl/workbook.xml', content: workbookXml(sheetDefs) },
        { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml(sheetDefs) },
        { name: 'xl/styles.xml', content: stylesXml() },
    ];

    let drawingIndex = 0;
    let imageIndex = 0;
    sheetDefs.forEach((sheet, sheetIdx) => {
        const images = sheet.images || [];
        const hasImages = images.length > 0;
        if (hasImages) drawingIndex += 1;
        entries.push({
            name: `xl/worksheets/sheet${sheetIdx + 1}.xml`,
            content: worksheetXml({
                rows: sheet.rows,
                title: sheet.title,
                dataStartRow: sheet.dataStartRow,
                drawingRelId: hasImages ? 'rId1' : '',
                drawingBounds: imageDrawingBounds(images),
                colWidths: sheet.colWidths,
                rowHeights: sheet.rowHeights,
            }),
        });
        if (hasImages) {
            const firstImageIndex = imageIndex + 1;
            entries.push({
                name: `xl/worksheets/_rels/sheet${sheetIdx + 1}.xml.rels`,
                content: sheetRelsXml(drawingIndex),
            });
            entries.push({
                name: `xl/drawings/drawing${drawingIndex}.xml`,
                content: drawingXml(images),
            });
            entries.push({
                name: `xl/drawings/_rels/drawing${drawingIndex}.xml.rels`,
                content: drawingRelsXml(images, firstImageIndex),
            });
            images.forEach(image => {
                imageIndex += 1;
                entries.push({
                    name: `xl/media/image${imageIndex}.png`,
                    content: dataUrlToBytes(image.imageDataUrl),
                });
            });
        }
    });

    triggerBlobDownload(`${safeFileName(fileName)}.xlsx`, createZip(entries));
}

export async function exportWorkbook(fileName, sheets, chartSheets = []) {
    await downloadXlsx(fileName, sheets, chartSheets);
}

function tableToRows(table, tableName) {
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.innerText.trim());
    const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
    if (headers.length === 0 || bodyRows.length === 0) return [];
    return bodyRows.map(row => {
        const cells = Array.from(row.children).map(cell => cell.innerText.trim());
        const out = { table: tableName };
        headers.forEach((header, idx) => { out[header || `col_${idx + 1}`] = cells[idx] ?? ''; });
        return out;
    });
}

function statCardsToRows(root) {
    return Array.from(root.querySelectorAll('.stat-card')).map((card, idx) => ({
        card: idx + 1,
        label: card.querySelector('.stat-card-label')?.innerText?.trim() || '',
        value: card.querySelector('.stat-card-value')?.innerText?.trim() || '',
    })).filter(row => row.label || row.value);
}

function isVisibleElement(element) {
    if (!element || !element.getBoundingClientRect) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 10 && rect.height > 10;
}

function nearestReadableTitle(element, fallback) {
    const chart = ChartJS.getChart(element);
    const chartTitle = chart?.options?.plugins?.title?.text;
    if (Array.isArray(chartTitle)) return chartTitle.join(' ');
    if (chartTitle) return chartTitle;

    const container = element.closest('.chart-card, .stat-card, .dashboard-card, .card, section, article, [data-export-title]');
    const title = container?.getAttribute?.('data-export-title') ||
        container?.querySelector?.('h1,h2,h3,h4,.chart-card-title,.chart-title,.card-title')?.innerText;
    return title?.trim?.() || fallback;
}

function nearestReadableSource(element) {
    const container = element.closest('.chart-card, .dashboard-card, .card, section, article, [data-export-source]');
    const source = container?.getAttribute?.('data-export-source') ||
        container?.querySelector?.('.chart-card-subtitle,.chart-source,.source-badge,.status-badge')?.innerText;
    return source?.trim?.() || '';
}

function findSolidBackground(element) {
    let node = element;
    while (node && node !== document.documentElement) {
        const background = getComputedStyle(node).backgroundColor;
        if (background && !/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)|transparent/i.test(background)) {
            return background;
        }
        node = node.parentElement;
    }
    const bodyBackground = getComputedStyle(document.body).backgroundColor;
    if (bodyBackground && !/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)|transparent/i.test(bodyBackground)) {
        return bodyBackground;
    }
    return '#ffffff';
}

function rgbNumbers(color = '') {
    const match = String(color).match(/rgba?\(([^)]+)\)/i);
    if (!match) return null;
    return match[1].split(',').slice(0, 3).map(value => Number.parseFloat(value));
}

function isDarkColor(color) {
    const rgb = rgbNumbers(color);
    if (!rgb || rgb.some(value => Number.isNaN(value))) return false;
    const [r, g, b] = rgb;
    return ((r * 299) + (g * 587) + (b * 114)) / 1000 < 130;
}

function canvasToDataUrl(canvas, {
    title = '',
    source = '',
    minWidth = 1600,
    minHeight = 900,
    padding = 72,
} = {}) {
    const sourceWidth = Math.max(1, canvas.width || canvas.clientWidth || 960);
    const sourceHeight = Math.max(1, canvas.height || canvas.clientHeight || 540);
    const targetWidth = Math.max(minWidth, Math.round(sourceWidth * 1.6));
    const headerHeight = title ? 92 : 42;
    const footerHeight = source ? 58 : 32;
    const chartAreaWidth = targetWidth - (padding * 2);
    const chartAreaHeightByAspect = Math.round((chartAreaWidth * sourceHeight) / sourceWidth);
    const targetHeight = Math.max(minHeight, chartAreaHeightByAspect + headerHeight + footerHeight + padding);

    const out = document.createElement('canvas');
    out.width = targetWidth;
    out.height = targetHeight;
    const ctx = out.getContext('2d');
    const background = findSolidBackground(canvas);
    const textColor = isDarkColor(background) ? '#F8FAFC' : '#0F172A';
    const mutedColor = isDarkColor(background) ? '#CBD5E1' : '#475569';
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    if (title) {
        ctx.fillStyle = textColor;
        ctx.font = '700 34px Arial, sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(title.slice(0, 110), padding, 34);
    }

    const availableHeight = targetHeight - headerHeight - footerHeight;
    const scale = Math.min(chartAreaWidth / sourceWidth, availableHeight / sourceHeight);
    const drawWidth = Math.max(1, Math.round(sourceWidth * scale));
    const drawHeight = Math.max(1, Math.round(sourceHeight * scale));
    const drawX = Math.round((targetWidth - drawWidth) / 2);
    const drawY = headerHeight;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, drawX, drawY, drawWidth, drawHeight);

    const footerText = source || `${APP_NAME_TH} · exported ${generatedAtText()}`;
    ctx.fillStyle = mutedColor;
    ctx.font = '500 22px Arial, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(footerText.slice(0, 140), padding, targetHeight - 30);
    return out.toDataURL('image/png');
}

async function svgToDataUrl(svg) {
    const rect = svg.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || Number(svg.getAttribute('width')) || 960));
    const height = Math.max(1, Math.round(rect.height || Number(svg.getAttribute('height')) || 540));
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));

    const xml = new XMLSerializer().serializeToString(clone);
    const svgUrl = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
    try {
        const image = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = svgUrl;
        });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1400, width * 2);
        canvas.height = Math.max(900, height * 2);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = findSolidBackground(svg);
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const scale = Math.min(canvas.width / width, canvas.height / height);
        const drawWidth = Math.round(width * scale);
        const drawHeight = Math.round(height * scale);
        ctx.drawImage(image, Math.round((canvas.width - drawWidth) / 2), Math.round((canvas.height - drawHeight) / 2), drawWidth, drawHeight);
        return canvas.toDataURL('image/png');
    } finally {
        URL.revokeObjectURL(svgUrl);
    }
}

async function collectChartSheets(root = document) {
    if (typeof requestAnimationFrame === 'function') {
        await new Promise(resolve => requestAnimationFrame(() => resolve()));
    }

    const chartSheets = [];
    const seen = new Set();
    const instanceCanvases = Object.values(ChartJS.instances || {})
        .map(chart => chart?.canvas)
        .filter(Boolean);
    const canvases = Array.from(new Set([
        ...Array.from(root.querySelectorAll('canvas')),
        ...instanceCanvases,
    ])).filter(isVisibleElement);

    for (let idx = 0; idx < canvases.length; idx += 1) {
        const canvas = canvases[idx];
        if (seen.has(canvas)) continue;
        seen.add(canvas);
        const chart = ChartJS.getChart(canvas);
        chart?.update?.('none');
        const title = nearestReadableTitle(canvas, `Chart ${idx + 1}`);
        const source = nearestReadableSource(canvas);
        const rows = chart ? chartToRows(chart, title) : [];
        const matrixRows = chart ? chartToMatrixRows(chart, title) : [];
        const seriesRows = chart ? chartSeriesRows(chart, title) : [];
        try {
            const sourceConfig = chart?.config?._config || chart?.config || {};
            const highResolutionImage = chart
                ? await renderChartImageDataUrl({
                    chartType: sourceConfig.type || chart.config?.type || 'bar',
                    data: sourceConfig.data || chart.data,
                    options: sourceConfig.options || {},
                    title,
                    source,
                })
                : '';
            chartSheets.push({
                name: title,
                rows: matrixRows.length ? matrixRows : rows,
                longRows: rows,
                matrixRows,
                seriesRows,
                imageDataUrl: highResolutionImage || canvasToDataUrl(canvas, { title, source }),
            });
        } catch (error) {
            console.warn('[exportUtils] Unable to capture canvas chart:', error);
        }
    }

    const svgs = Array.from(root.querySelectorAll('.recharts-wrapper svg, svg.recharts-surface')).filter(isVisibleElement);
    for (let idx = 0; idx < svgs.length; idx += 1) {
        const svg = svgs[idx];
        if (seen.has(svg)) continue;
        seen.add(svg);
        const title = nearestReadableTitle(svg, `Chart ${chartSheets.length + 1}`);
        try {
            chartSheets.push({
                name: title,
                rows: [{ note: 'Chart image captured from the dashboard page.' }],
                imageDataUrl: await svgToDataUrl(svg),
            });
        } catch (error) {
            console.warn('[exportUtils] Unable to capture SVG chart:', error);
        }
    }

    return chartSheets;
}

export function extractPageExportPayload(root = document) {
    return extractPageExportData(root).sheets;
}

export function extractPageExportData(root = document, { includeChartRows = true } = {}) {
    const sheets = { ...buildRouteExportSheets() };
    const tables = Array.from(root.querySelectorAll('table'));
    tables.forEach((table, idx) => {
        const rows = tableToRows(table, `Table ${idx + 1}`);
        addSheet(sheets, `Visible Table ${idx + 1}`, rows);
    });

    const statRows = statCardsToRows(root);
    addSheet(sheets, 'Visible Summary', statRows);

    if (includeChartRows) {
        const canvases = Array.from(root.querySelectorAll('canvas'));
        canvases.forEach((canvas, idx) => {
            const chart = ChartJS.getChart(canvas);
            const title = nearestReadableTitle(canvas, `Chart ${idx + 1}`);
            const chartName = String(title);
            addSheet(sheets, `Chart ${idx + 1} Matrix`, chartToMatrixRows(chart, chartName));
            addSheet(sheets, `Chart ${idx + 1} Data`, chartToRows(chart, chartName));
            addSheet(sheets, `Chart ${idx + 1} Series`, chartSeriesRows(chart, chartName));
        });
    }

    return { sheets };
}

function singleFileReportSheets(title, sheets = {}, chartSheets = []) {
    const dataSheets = sheets && typeof sheets === 'object' ? sheets : {};
    const sheetEntries = Object.entries(dataSheets);
    const dataRowCount = sheetEntries.reduce((sum, [, rows]) => sum + normalizeRows(rows).length, 0);
    const embeddedImageCount = (chartSheets || []).filter(chart => chart?.imageDataUrl).length;
    const visibleSummaryRows = normalizeRows(dataSheets['Visible Summary']).slice(0, 30);
    const chartImages = (chartSheets || []).filter(chart => chart?.imageDataUrl);
    const metadataRows = reportMetadataRows(title, dataSheets, chartImages);
    const notesRows = reportNotesRows(dataSheets, chartImages);

    let infoSheetName = 'Full Page Report';
    let index = 2;
    while (Object.prototype.hasOwnProperty.call(dataSheets, infoSheetName)) {
        infoSheetName = `Full Page Report ${index}`;
        index += 1;
    }

    const overviewRows = [
        { section: 'Overview', item: 'รายงาน', value: title || 'page-export' },
        { section: 'Overview', item: 'จำนวนชีตข้อมูล', value: sheetEntries.length },
        { section: 'Overview', item: 'จำนวนแถวข้อมูล', value: dataRowCount },
        { section: 'Overview', item: 'จำนวนกราฟ', value: embeddedImageCount },
        { section: 'Overview', item: 'การใช้งาน', value: 'ชีตสรุปและชีตรายละเอียดถูกจัดรูปแบบสำหรับอ่าน วิเคราะห์ และนำข้อมูลไปใช้ต่อ' },
        { section: '', item: '', value: '' },
        ...visibleSummaryRows.map((row, idx) => ({
            section: 'Visible summary',
            item: row.label || `Card ${row.card || idx + 1}`,
            value: row.value ?? '',
        })),
    ];

    const overviewImages = [];
    const overviewRowHeights = {};
    const blankRow = () => ({ section: '', item: '', value: '' });

    if (chartImages.length > 0) {
        overviewRows.push(
            { section: '', item: '', value: '' },
            { section: 'Charts', item: 'Layout', value: 'กราฟและข้อมูลต้นทางถูกจัดวางไว้ในชีตถัดไป' }
        );
    }

    for (let idx = 0; idx < chartImages.length; idx += 1) {
        const chart = chartImages[idx];
        const chartName = chart?.name || `Chart ${idx + 1}`;

        overviewRows.push(blankRow());
        overviewRows.push({
            section: 'Charts',
            item: `${idx + 1}.`,
            value: chartName,
        });
        overviewRowHeights[overviewRows.length] = 24;

        const fromRow = overviewRows.length + 1;
        const fittedImage = fitImageToCellBox({
            name: chartName,
            imageDataUrl: chart.imageDataUrl,
            fromCol: 0,
            toCol: 9,
            fromRow,
        }, { maxCols: 9, maxRows: 14, minRows: 8 });
        overviewImages.push(fittedImage);

        const chartRowSpan = Math.max(1, fittedImage.toRow - fittedImage.fromRow);
        for (let row = 0; row < chartRowSpan; row += 1) {
            const worksheetRow = overviewRows.length + 2;
            overviewRows.push(blankRow());
            overviewRowHeights[worksheetRow] = 18;
        }
    }

    const chartDetailSheets = Object.fromEntries(chartImages.map((chart, idx) => {
        const chartName = chart?.name || `Chart ${idx + 1}`;
        const images = normalizeSheetImages({
            name: chartName,
            imageDataUrl: chart.imageDataUrl,
        }, `Chart ${idx + 1}`);
        const lastImageRow = images.length
            ? Math.max(...images.map(image => numberOr(image.toRow, 18)))
            : 0;
        return [`Graph ${idx + 1}`, {
            rows: normalizeRows(chart.rows).length > 0
                ? chart.rows
                : [{ note: 'Chart image captured from the dashboard page.' }],
            images,
            dataStartRow: Math.max(18, lastImageRow + 3),
            title: chartName,
        }];
    }));

    const chartLongDataSheets = Object.fromEntries(chartImages.flatMap((chart, idx) => {
        const rows = normalizeRows(chart.longRows);
        return rows.length ? [[`Graph ${idx + 1} Data`, rows]] : [];
    }));
    const chartSeriesSheets = Object.fromEntries(chartImages.flatMap((chart, idx) => {
        const rows = normalizeRows(chart.seriesRows);
        return rows.length ? [[`Graph ${idx + 1} Series`, rows]] : [];
    }));

    return {
        'Report Metadata': {
            rows: metadataRows,
            dataStartRow: 1,
            colWidths: [10, 28, 72],
        },
        [infoSheetName]: {
            rows: overviewRows,
            images: overviewImages,
            dataStartRow: 1,
            colWidths: [16, 18, 52, 14, 14, 14, 14, 14, 14, 14],
            rowHeights: overviewRowHeights,
        },
        Sources: {
            rows: notesRows.length
                ? notesRows
                : [{
                    section: 'Sources',
                    note: 'No additional source warnings were detected. See Dataset Meta and each data sheet for source fields, row counts, and timestamps when available.',
                }],
            dataStartRow: 1,
            colWidths: [26, 90],
        },
        ...dataSheets,
        ...chartDetailSheets,
        ...chartLongDataSheets,
        ...chartSeriesSheets,
    };
}

export async function exportPageAsCSV(title = 'page-export') {
    const { sheets } = extractPageExportData(document);
    await exportCSVReportWorkbook(title, sheets);
}

export async function exportExcelReportWorkbook(title = 'page-export', sheets = {}) {
    const path = normalizeRoutePath(typeof window !== 'undefined' ? window.location?.pathname : '');
    if (path.endsWith('/hr')) {
        downloadProfessionalWorkbook(standardReportFileBase(`${title}_professional_dashboard`), buildHrProfessionalWorkbookSheets(title));
        return;
    }
    const pageSheets = typeof document !== 'undefined' ? extractPageExportData(document).sheets : {};
    const completeSheets = mergeExportSheetMaps(pageSheets, sheets, 'Filtered');
    const chartSheets = await collectChartSheets();
    await exportWorkbook(standardReportFileBase(title), singleFileReportSheets(title, completeSheets, chartSheets));
}

export async function exportCSVReportWorkbook(title = 'page-export', sheets = {}) {
    const fileBase = standardReportFileBase(title);
    const chartSheets = await collectChartSheets();
    downloadCSVReport(fileBase, title, sheets, chartSheets);
    downloadChartPNGs(fileBase, chartSheets);
}

export async function exportPageAsCSVReport(title = 'page-export') {
    const { sheets } = extractPageExportData();
    await exportCSVReportWorkbook(title, sheets);
}

export async function exportPageAsExcelReport(title = 'page-export') {
    await exportExcelReportWorkbook(title);
}

export async function exportPageAsExcel(title = 'page-export') {
    const { sheets } = extractPageExportData();
    const chartSheets = await collectChartSheets();
    await exportWorkbook(standardReportFileBase(title), sheets, chartSheets);
}

export async function exportChartAsCSV(title, chart) {
    const chartTitle = title || 'Chart';
    const imageDataUrl = await renderChartImageDataUrl(chart);
    const chartSheet = {
        name: chartTitle,
        rows: chartToRows(chart, chartTitle),
        imageDataUrl,
    };
    const fileBase = standardReportFileBase(chartTitle, 'chart');
    downloadCSVReport(fileBase, chartTitle, { [chartTitle]: chartSheet.rows }, [chartSheet]);
    downloadChartPNGs(fileBase, [chartSheet]);
}

export async function exportChartAsCSVReport(title, chart) {
    await exportChartAsCSV(title, chart);
}

export async function exportChartAsExcel(title, chart) {
    const chartTitle = title || 'Chart';
    const imageDataUrl = await renderChartImageDataUrl(chart);
    const matrixRows = chartToMatrixRows(chart, chartTitle);
    const longRows = chartToRows(chart, chartTitle);
    const seriesRows = chartSeriesRows(chart, chartTitle);
    const sourceValues = [
        ...(Array.isArray(chart?.sources) ? chart.sources : []),
        chart?.source,
        chart?.subtitle,
    ].filter(Boolean);
    const chartSheet = {
        name: chartTitle,
        rows: longRows,
        imageDataUrl,
    };
    const reportSheets = {
        'Chart Summary': [
            { field: 'ชื่อกราฟ', value: chartTitle },
            { field: 'ชนิดกราฟ', value: chart?.chartType || chart?.type || 'bar' },
            { field: 'จำนวนหมวด/จุด', value: matrixRows.length },
            { field: 'จำนวนชุดข้อมูล', value: seriesRows.length },
            { field: 'จำนวนค่าข้อมูลรวม', value: longRows.length },
            { field: 'วันที่ Export', value: generatedAtText() },
            { field: 'ขอบเขตหน้า', value: routeScope() },
        ],
        'Chart Matrix': matrixRows,
        'Chart Data': longRows,
        'Series Metadata': seriesRows,
        ...(String(chart?.answerText || '').trim() ? {
            'AI Answer': String(chart.answerText)
                .split(/\r?\n/)
                .map(line => line.trim())
                .filter(Boolean)
                .map((line, index) => ({ row: index + 1, content: line })),
        } : {}),
        Sources: sourceValues.length
            ? sourceValues.map((source, index) => ({ row: index + 1, source: exportValue(source) }))
            : [{ row: 1, source: 'แหล่งข้อมูลตามคำตอบและ context ที่แสดงใน AI Chat' }],
    };
    await exportWorkbook(
        standardReportFileBase(chartTitle, 'chart'),
        singleFileReportSheets(chartTitle, reportSheets, [chartSheet])
    );
}

const chartCssColorCache = new Map();
const chartCssVariableFallbacks = {
    '--accent-info': '#2563eb',
    '--accent-blue': '#2563eb',
    '--accent-purple': '#7c3aed',
    '--accent-success': '#059669',
    '--accent-success-deep': '#047857',
    '--accent-warning': '#d97706',
    '--accent-orange': '#ea580c',
    '--accent-pink': '#db2777',
    '--accent-gold': '#ca8a04',
    '--danger': '#dc2626',
    '--text-primary': '#0f172a',
    '--text-secondary': '#334155',
    '--text-muted': '#64748b',
    '--chart-muted': '#475569',
    '--chart-grid': '#e2e8f0',
};

function resolveCssColorForCanvas(value) {
    if (typeof value !== 'string' || !/(?:var\(|color-mix\()/i.test(value) || typeof document === 'undefined') {
        return value;
    }
    if (chartCssColorCache.has(value)) return chartCssColorCache.get(value);

    const rootStyle = getComputedStyle(document.documentElement);
    const normalizedValue = value.replace(/var\(\s*(--[\w-]+)(?:\s*,[^)]*)?\)/g, (_, variableName) => (
        rootStyle.getPropertyValue(variableName).trim()
        || chartCssVariableFallbacks[variableName]
        || '#475569'
    ));
    const probe = document.createElement('span');
    probe.style.position = 'fixed';
    probe.style.left = '-9999px';
    probe.style.visibility = 'hidden';
    probe.style.color = normalizedValue;
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color || normalizedValue;
    probe.remove();
    chartCssColorCache.set(value, resolved);
    return resolved;
}

function professionalizeChartOptions(options = {}) {
    const next = options;
    next.plugins = { ...(next.plugins || {}) };
    next.plugins.legend = {
        ...(next.plugins.legend || {}),
        labels: {
            ...(next.plugins.legend?.labels || {}),
            color: '#334155',
        },
    };
    if (next.plugins.title) {
        next.plugins.title = { ...next.plugins.title, color: '#0f172a' };
    }
    next.scales = { ...(next.scales || {}) };
    Object.keys(next.scales).forEach(axisKey => {
        const axis = next.scales[axisKey] || {};
        next.scales[axisKey] = {
            ...axis,
            ticks: { ...(axis.ticks || {}), color: '#475569' },
            grid: { ...(axis.grid || {}), color: '#e2e8f0' },
            title: axis.title ? { ...axis.title, color: '#334155' } : axis.title,
        };
    });
    return next;
}

function resolveChartCssColors(value, key = '') {
    if (Array.isArray(value)) {
        value.forEach((item, index) => {
            if (typeof item === 'string' && /color/i.test(key)) {
                value[index] = resolveCssColorForCanvas(item);
            } else {
                resolveChartCssColors(item, key);
            }
        });
        return value;
    }
    if (!value || typeof value !== 'object') return value;

    Object.entries(value).forEach(([childKey, childValue]) => {
        if (typeof childValue === 'string' && /color/i.test(childKey)) {
            value[childKey] = resolveCssColorForCanvas(childValue);
        } else {
            resolveChartCssColors(childValue, childKey);
        }
    });
    return value;
}

async function renderChartImageDataUrl(chart) {
    if (!chart?.data || typeof document === 'undefined') return '';
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = findSolidBackground(document.body);
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let instance;
    try {
        const config = JSON.parse(JSON.stringify(chart));
        resolveChartCssColors(config);
        const chartTitle = chart.title || chart.name || config.options?.plugins?.title?.text || 'Chart';
        const requestedType = String(config.chartType || config.type || 'bar').toLowerCase();
        const renderedType = requestedType === 'hbar' ? 'bar' : requestedType;
        config.options = professionalizeChartOptions(config.options || {});
        if (requestedType === 'hbar') {
            config.options = { ...(config.options || {}), indexAxis: 'y' };
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        instance = new ChartJS(canvas, {
            type: renderedType,
            data: config.data,
            options: {
                ...(config.options || {}),
                responsive: false,
                animation: false,
                maintainAspectRatio: false,
            },
            plugins: [{
                id: 'sciExportBackground',
                beforeDraw: ({ ctx: chartContext, width, height }) => {
                    chartContext.save();
                    chartContext.globalCompositeOperation = 'destination-over';
                    chartContext.fillStyle = '#ffffff';
                    chartContext.fillRect(0, 0, width, height);
                    chartContext.restore();
                },
            }],
        });
        instance.update('none');
        await new Promise(resolve => requestAnimationFrame(resolve));
        return canvasToDataUrl(canvas, {
            title: Array.isArray(chartTitle) ? chartTitle.join(' ') : String(chartTitle),
            source: chart.source || chart.subtitle || `${APP_NAME_TH} · ${generatedAtText()}`,
            minWidth: 1600,
            minHeight: 900,
        });
    } catch (error) {
        console.warn('[exportUtils] Unable to render chart image:', error);
        return '';
    } finally {
        instance?.destroy?.();
    }
}
