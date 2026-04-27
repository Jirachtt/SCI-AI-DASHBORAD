import { Chart as ChartJS } from 'chart.js';

const SHEET_NAME_LIMIT = 31;

function safeFileName(name = 'export') {
    return String(name)
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, '_')
        .slice(0, 120) || 'export';
}

function sheetName(name, fallback = 'Sheet') {
    const cleaned = String(name || fallback).replace(/[\\/?*[\]:]+/g, ' ').trim();
    return (cleaned || fallback).slice(0, SHEET_NAME_LIMIT);
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

function downloadBlob(fileName, mimeType, content) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

export function downloadCSV(fileName, rows) {
    const csv = rowsToCsv(rows);
    downloadBlob(`${safeFileName(fileName)}.csv`, 'text/csv;charset=utf-8', `\uFEFF${csv}`);
}

export async function exportWorkbook(fileName, sheets) {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const usedNames = new Set();

    Object.entries(sheets || {}).forEach(([name, rows]) => {
        const normalized = normalizeRows(rows);
        if (normalized.length === 0) return;
        let baseName = sheetName(name);
        let finalName = baseName;
        let i = 2;
        while (usedNames.has(finalName)) {
            finalName = sheetName(`${baseName} ${i}`);
            i += 1;
        }
        usedNames.add(finalName);
        const ws = XLSX.utils.json_to_sheet(normalized);
        XLSX.utils.book_append_sheet(wb, ws, finalName);
    });

    if (wb.SheetNames.length === 0) {
        const ws = XLSX.utils.json_to_sheet([{ note: 'No exportable data found on this page.' }]);
        XLSX.utils.book_append_sheet(wb, ws, 'Export');
    }

    XLSX.writeFile(wb, `${safeFileName(fileName)}.xlsx`);
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
                pointRows.push({
                    chart: chartName,
                    dataset: label,
                    label: point.label ?? point.major ?? point.faculty ?? labels[idx] ?? idx + 1,
                    x: point.x ?? '',
                    y: point.y ?? '',
                    r: point.r ?? '',
                    value: point.value ?? '',
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

export function extractPageExportPayload(root = document) {
    const sheets = {};
    const tables = Array.from(root.querySelectorAll('table'));
    tables.forEach((table, idx) => {
        const rows = tableToRows(table, `Table ${idx + 1}`);
        if (rows.length > 0) sheets[`Table ${idx + 1}`] = rows;
    });

    const statRows = statCardsToRows(root);
    if (statRows.length > 0) sheets.Summary = statRows;

    const canvases = Array.from(root.querySelectorAll('canvas'));
    canvases.forEach((canvas, idx) => {
        const chart = ChartJS.getChart(canvas);
        const title = chart?.options?.plugins?.title?.text || `Chart ${idx + 1}`;
        const rows = chartToRows(chart, String(title));
        if (rows.length > 0) sheets[`Chart ${idx + 1}`] = rows;
    });

    return sheets;
}

export function exportPageAsCSV(title = 'page-export') {
    const sheets = extractPageExportPayload();
    const rows = Object.entries(sheets).flatMap(([sheet, sheetRows]) =>
        sheetRows.map(row => ({ sheet, ...row }))
    );
    downloadCSV(title, rows);
}

export async function exportPageAsExcel(title = 'page-export') {
    await exportWorkbook(title, {
        README: [{
            note: 'Each Chart sheet contains the source data used by charts on the page. Open this workbook in Excel and use Insert Chart if you need an editable native Excel chart.',
        }],
        ...extractPageExportPayload(),
    });
}

export function exportChartAsCSV(title, chart) {
    downloadCSV(title, chartToRows(chart, title));
}

export async function exportChartAsExcel(title, chart) {
    await exportWorkbook(title, {
        README: [{
            note: 'This workbook contains chart source data ready for Excel chart creation.',
        }],
        [title || 'Chart']: chartToRows(chart, title || 'Chart'),
    });
}
