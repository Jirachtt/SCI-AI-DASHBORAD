import { Chart as ChartJS } from 'chart.js';

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

function rowsToGrid(rows) {
    const normalized = normalizeRows(rows);
    if (normalized.length === 0) return [];
    const headers = Array.from(new Set(normalized.flatMap(row => Object.keys(row))));
    return [
        headers,
        ...normalized.map(row => headers.map(header => row[header] ?? '')),
    ];
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

function cellXml(value, ref) {
    if (value == null || value === '') return `<c r="${ref}"/>`;
    if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"><v>${value}</v></c>`;
    if (typeof value === 'boolean') return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
    return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
}

function worksheetXml({ rows = [], title = '', dataStartRow = 1, drawingRelId = '' }) {
    const grid = rowsToGrid(rows);
    const rowXml = [];
    let maxCol = Math.max(1, grid[0]?.length || 1);
    let maxRow = Math.max(1, dataStartRow + Math.max(0, grid.length - 1));

    if (title) {
        rowXml.push(`<row r="1">${cellXml(title, 'A1')}</row>`);
    }

    if (grid.length === 0 && !title) {
        rowXml.push(`<row r="1">${cellXml('No exportable data found on this page.', 'A1')}</row>`);
    } else {
        grid.forEach((cells, rowIdx) => {
            const rowNumber = dataStartRow + rowIdx;
            maxCol = Math.max(maxCol, cells.length);
            maxRow = Math.max(maxRow, rowNumber);
            rowXml.push(
                `<row r="${rowNumber}">${cells.map((value, colIdx) => {
                    const ref = `${columnName(colIdx)}${rowNumber}`;
                    return cellXml(value, ref);
                }).join('')}</row>`
            );
        });
    }

    const dimension = `A1:${columnName(maxCol - 1)}${maxRow}`;
    const cols = Array.from({ length: Math.min(14, Math.max(1, maxCol)) }, (_, idx) =>
        `<col min="${idx + 1}" max="${idx + 1}" width="${idx === 0 ? 24 : 18}" customWidth="1"/>`
    ).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<dimension ref="${dimension}"/>
<sheetViews><sheetView workbookViewId="0"/></sheetViews>
<sheetFormatPr defaultRowHeight="18"/>
<cols>${cols}</cols>
<sheetData>${rowXml.join('')}</sheetData>
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
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
${worksheetTypes}
${drawingTypes}
</Types>`;
}

function docPropsCoreXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:creator>SCI AI Dashboard</dc:creator>
<cp:lastModifiedBy>SCI AI Dashboard</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
<dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified>
</cp:coreProperties>`;
}

function docPropsAppXml(sheetCount) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
<Application>SCI AI Dashboard</Application>
<DocSecurity>0</DocSecurity>
<ScaleCrop>false</ScaleCrop>
<HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${sheetCount}</vt:i4></vt:variant></vt:vector></HeadingPairs>
</Properties>`;
}

function drawingXml(imageName) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<xdr:twoCellAnchor editAs="oneCell">
<xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
<xdr:to><xdr:col>10</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>22</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
<xdr:pic>
<xdr:nvPicPr><xdr:cNvPr id="1" name="${xmlEscape(imageName)}"/><xdr:cNvPicPr/></xdr:nvPicPr>
<xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>
<xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>
</xdr:pic>
<xdr:clientData/>
</xdr:twoCellAnchor>
</xdr:wsDr>`;
}

function drawingRelsXml(imageIndex) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${imageIndex}.png"/>
</Relationships>`;
}

function sheetRelsXml(drawingIndex) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawingIndex}.xml"/>
</Relationships>`;
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

function createZip(entries) {
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

    return new Blob([...localParts, ...centralParts, Uint8Array.from(end)], { type: XLSX_MIME });
}

function dataUrlToBytes(dataUrl) {
    const [, base64 = ''] = String(dataUrl || '').split(',');
    const binary = atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
}

async function downloadXlsx(fileName, sheets, chartSheets = []) {
    const usedNames = new Set();
    const sheetDefs = [];
    Object.entries(sheets || {}).forEach(([name, rows]) => {
        const normalized = normalizeRows(rows);
        if (normalized.length === 0) return;
        sheetDefs.push({
            name: uniqueSheetName(name, usedNames),
            rows: normalized,
            imageDataUrl: '',
            dataStartRow: 1,
        });
    });

    chartSheets.forEach((chart, idx) => {
        if (!chart?.imageDataUrl && normalizeRows(chart?.rows).length === 0) return;
        sheetDefs.push({
            name: uniqueSheetName(chart.name || `Chart ${idx + 1}`, usedNames, `Chart ${idx + 1}`),
            rows: normalizeRows(chart.rows).length > 0 ? chart.rows : [{ note: 'Chart image captured from the dashboard page.' }],
            imageDataUrl: chart.imageDataUrl || '',
            dataStartRow: chart.imageDataUrl ? 25 : 1,
        });
    });

    if (sheetDefs.length === 0) {
        sheetDefs.push({
            name: 'Export',
            rows: [{ note: 'No exportable data found on this page.' }],
            imageDataUrl: '',
            dataStartRow: 1,
        });
    }

    const entries = [
        { name: '[Content_Types].xml', content: contentTypesXml(sheetDefs, sheetDefs.filter(sheet => sheet.imageDataUrl).length) },
        { name: '_rels/.rels', content: rootRelsXml() },
        { name: 'docProps/core.xml', content: docPropsCoreXml() },
        { name: 'docProps/app.xml', content: docPropsAppXml(sheetDefs.length) },
        { name: 'xl/workbook.xml', content: workbookXml(sheetDefs) },
        { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml(sheetDefs) },
    ];

    let drawingIndex = 0;
    sheetDefs.forEach((sheet, sheetIdx) => {
        const hasImage = Boolean(sheet.imageDataUrl);
        if (hasImage) drawingIndex += 1;
        entries.push({
            name: `xl/worksheets/sheet${sheetIdx + 1}.xml`,
            content: worksheetXml({
                rows: sheet.rows,
                title: hasImage ? sheet.name : '',
                dataStartRow: sheet.dataStartRow,
                drawingRelId: hasImage ? 'rId1' : '',
            }),
        });
        if (hasImage) {
            entries.push({
                name: `xl/worksheets/_rels/sheet${sheetIdx + 1}.xml.rels`,
                content: sheetRelsXml(drawingIndex),
            });
            entries.push({
                name: `xl/drawings/drawing${drawingIndex}.xml`,
                content: drawingXml(sheet.name),
            });
            entries.push({
                name: `xl/drawings/_rels/drawing${drawingIndex}.xml.rels`,
                content: drawingRelsXml(drawingIndex),
            });
            entries.push({
                name: `xl/media/image${drawingIndex}.png`,
                content: dataUrlToBytes(sheet.imageDataUrl),
            });
        }
    });

    const blob = createZip(entries);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeFileName(fileName)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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
        container?.querySelector?.('h1,h2,h3,h4,.chart-title,.card-title')?.innerText;
    return title?.trim?.() || fallback;
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
    return getComputedStyle(document.body).backgroundColor || '#ffffff';
}

function canvasToDataUrl(canvas) {
    const out = document.createElement('canvas');
    out.width = Math.max(1, canvas.width || canvas.clientWidth || 960);
    out.height = Math.max(1, canvas.height || canvas.clientHeight || 540);
    const ctx = out.getContext('2d');
    ctx.fillStyle = findSolidBackground(canvas);
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0, out.width, out.height);
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
        canvas.width = width * 2;
        canvas.height = height * 2;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = findSolidBackground(svg);
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/png');
    } finally {
        URL.revokeObjectURL(svgUrl);
    }
}

async function collectChartSheets(root = document) {
    const chartSheets = [];
    const seen = new Set();
    const canvases = Array.from(root.querySelectorAll('canvas')).filter(isVisibleElement);

    canvases.forEach((canvas, idx) => {
        if (seen.has(canvas)) return;
        seen.add(canvas);
        const chart = ChartJS.getChart(canvas);
        const title = nearestReadableTitle(canvas, `Chart ${idx + 1}`);
        const rows = chart ? chartToRows(chart, title) : [];
        try {
            chartSheets.push({
                name: title,
                rows,
                imageDataUrl: canvasToDataUrl(canvas),
            });
        } catch (error) {
            console.warn('[exportUtils] Unable to capture canvas chart:', error);
        }
    });

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

export function extractPageExportData(root = document) {
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

    return { sheets };
}

export function exportPageAsCSV(title = 'page-export') {
    const sheets = extractPageExportPayload();
    const rows = Object.entries(sheets).flatMap(([sheet, sheetRows]) =>
        sheetRows.map(row => ({ sheet, ...row }))
    );
    downloadCSV(title, rows);
}

export async function exportPageAsExcel(title = 'page-export') {
    const { sheets } = extractPageExportData();
    const chartSheets = await collectChartSheets();
    await exportWorkbook(title, {
        README: [{
            note: 'Chart sheets include a captured chart image from the dashboard and source data when available.',
        }],
        ...sheets,
    }, chartSheets);
}

export function exportChartAsCSV(title, chart) {
    downloadCSV(title, chartToRows(chart, title));
}

export async function exportChartAsExcel(title, chart) {
    const imageDataUrl = await renderChartImageDataUrl(chart);
    await exportWorkbook(title, {
        README: [{
            note: 'Chart sheets include a captured chart image and source data.',
        }],
    }, [{
        name: title || 'Chart',
        rows: chartToRows(chart, title || 'Chart'),
        imageDataUrl,
    }]);
}

async function renderChartImageDataUrl(chart) {
    if (!chart?.data || typeof document === 'undefined') return '';
    const canvas = document.createElement('canvas');
    canvas.width = 1100;
    canvas.height = 620;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = findSolidBackground(document.body);
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let instance;
    try {
        const config = JSON.parse(JSON.stringify(chart));
        instance = new ChartJS(canvas, {
            type: config.chartType || 'bar',
            data: config.data,
            options: {
                ...(config.options || {}),
                responsive: false,
                animation: false,
                maintainAspectRatio: false,
            },
        });
        instance.update('none');
        await new Promise(resolve => requestAnimationFrame(resolve));
        return canvasToDataUrl(canvas);
    } catch (error) {
        console.warn('[exportUtils] Unable to render chart image:', error);
        return '';
    } finally {
        instance?.destroy?.();
    }
}
