// Shared CSV/XLSX parsers used by the AI chat upload flow and the admin
// data-management upload flow. Both produce the same base shape:
//   { headers, rows, numericCols, labelCol, rowCount }
// AI chat also receives schema metadata so it can reason over uploaded files
// without sending large raw tables into the model.

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;
const MAX_COLUMNS = 80;
const MAX_CELL_CHARS = 1000;
const DANGEROUS_HEADER_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function assertUploadSize(byteLength) {
    if (byteLength > MAX_UPLOAD_BYTES) {
        throw new Error(`ไฟล์มีขนาดใหญ่เกินไป (จำกัด ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB)`);
    }
}

function normalizeCell(value) {
    return String(value ?? '').trim().slice(0, MAX_CELL_CHARS);
}

function isBlankCell(value) {
    return String(value ?? '').trim() === '';
}

function parseNumericCell(value) {
    const normalized = String(value ?? '')
        .replace(/,/g, '')
        .replace(/%$/, '')
        .trim();
    if (!normalized) return null;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
}

function parseDateCell(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(raw) || /^\d{4}-\d{1,2}-\d{1,2}$/.test(raw)) {
        const date = new Date(raw);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
}

function normalizeHeaders(values) {
    const seen = new Map();
    return values
        .slice(0, MAX_COLUMNS)
        .map((value, index) => {
            const raw = normalizeCell(value) || `column_${index + 1}`;
            const safe = DANGEROUS_HEADER_KEYS.has(raw.toLowerCase()) ? `column_${index + 1}` : raw;
            const count = seen.get(safe) || 0;
            seen.set(safe, count + 1);
            return count === 0 ? safe : `${safe}_${count + 1}`;
        });
}

function buildRow(headers, values) {
    const obj = {};
    headers.forEach((header, index) => {
        obj[header] = normalizeCell(values[index]);
    });
    return obj;
}

// RFC-4180 style splitter: respects "quoted, fields" and "" escapes.
export function splitCSVLine(line, delimiter) {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
            else if (ch === '"') { inQuotes = false; }
            else { cur += ch; }
        } else {
            if (ch === '"') inQuotes = true;
            else if (ch === delimiter) { out.push(cur); cur = ''; }
            else cur += ch;
        }
    }
    out.push(cur);
    return out.map(v => v.trim());
}

function detectMeta(headers, rows) {
    const numericCols = headers.filter(h => {
        const vals = rows.map(r => parseNumericCell(r[h])).filter(v => v !== null);
        const nonBlank = rows.filter(r => !isBlankCell(r[h])).length;
        return vals.length > 0 && vals.length >= Math.max(1, nonBlank * 0.6);
    });
    const labelCol = headers.find(h => !numericCols.includes(h)) || headers[0];
    return { numericCols, labelCol };
}

function detectColumnType(header, values) {
    const nonBlankValues = values.filter(value => !isBlankCell(value));
    if (nonBlankValues.length === 0) return 'empty';

    const numericCount = nonBlankValues.filter(value => parseNumericCell(value) !== null).length;
    const dateCount = nonBlankValues.filter(value => parseDateCell(value) !== null).length;
    const booleanCount = nonBlankValues.filter(value => /^(true|false|yes|no|y|n|0|1|ใช่|ไม่ใช่)$/i.test(String(value).trim())).length;
    const lowerHeader = String(header || '').toLowerCase();

    if (numericCount >= nonBlankValues.length * 0.8) return 'number';
    if (dateCount >= nonBlankValues.length * 0.7 || /date|วันที่|วันชำระ|กำหนด/.test(lowerHeader)) return 'date';
    if (booleanCount >= nonBlankValues.length * 0.8) return 'boolean';
    if (/id|รหัส|code|student/.test(lowerHeader) && numericCount >= nonBlankValues.length * 0.5) return 'identifier';
    return 'text';
}

function profileColumns(headers, rows) {
    return headers.map(header => {
        const values = rows.map(row => row[header]);
        const missingCount = values.filter(isBlankCell).length;
        const nonBlankValues = values.filter(value => !isBlankCell(value));
        const uniqueValues = new Set(nonBlankValues.map(value => String(value).trim()));
        const type = detectColumnType(header, values);
        const numericValues = nonBlankValues
            .map(parseNumericCell)
            .filter(value => value !== null);
        const numericStats = numericValues.length
            ? {
                count: numericValues.length,
                min: Math.min(...numericValues),
                max: Math.max(...numericValues),
                avg: Number((numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length).toFixed(2)),
                sum: Number(numericValues.reduce((sum, value) => sum + value, 0).toFixed(2)),
            }
            : null;

        return {
            name: header,
            type,
            missingCount,
            missingPercent: rows.length ? Number(((missingCount / rows.length) * 100).toFixed(1)) : 0,
            uniqueCount: uniqueValues.size,
            sampleValues: [...uniqueValues].slice(0, 5),
            numericStats,
        };
    });
}

function buildQualityWarnings(columnProfiles, rowCount, truncated) {
    const warnings = [];
    if (truncated) warnings.push(`File was truncated to ${MAX_ROWS.toLocaleString('en-US')} rows for browser performance.`);
    if (rowCount === 0) warnings.push('No data rows were detected.');
    const heavyMissing = columnProfiles.filter(col => col.missingPercent >= 30);
    if (heavyMissing.length) {
        warnings.push(`High missing values: ${heavyMissing.slice(0, 5).map(col => `${col.name} ${col.missingPercent}%`).join(', ')}`);
    }
    const emptyColumns = columnProfiles.filter(col => col.type === 'empty');
    if (emptyColumns.length) {
        warnings.push(`Empty columns: ${emptyColumns.slice(0, 5).map(col => col.name).join(', ')}`);
    }
    return warnings;
}

function buildSuggestedQuestions(headers, numericCols, labelCol) {
    const firstMetric = numericCols[0];
    const secondMetric = numericCols[1];
    const suggestions = [];
    if (firstMetric && labelCol) suggestions.push(`สร้างกราฟ ${firstMetric} แยกตาม ${labelCol}`);
    if (firstMetric && secondMetric && labelCol) suggestions.push(`เปรียบเทียบ ${firstMetric} กับ ${secondMetric} ตาม ${labelCol}`);
    if (firstMetric) suggestions.push(`สรุปค่าเฉลี่ย/สูงสุด/ต่ำสุดของ ${firstMetric}`);
    suggestions.push('สรุป insight สำคัญจากไฟล์นี้');
    return [...new Set(suggestions)].slice(0, 5);
}

function enrichParsedTable(headers, rows, extra = {}) {
    const { numericCols, labelCol } = detectMeta(headers, rows);
    const columnProfiles = profileColumns(headers, rows);
    const missingByColumn = Object.fromEntries(columnProfiles.map(col => [col.name, col.missingCount]));
    const missingTotal = columnProfiles.reduce((sum, col) => sum + col.missingCount, 0);
    const aggregates = Object.fromEntries(
        columnProfiles
            .filter(col => col.numericStats)
            .map(col => [col.name, col.numericStats])
    );

    return {
        headers,
        rows,
        numericCols,
        labelCol,
        rowCount: rows.length,
        columnProfiles,
        dataTypes: Object.fromEntries(columnProfiles.map(col => [col.name, col.type])),
        missingValues: {
            total: missingTotal,
            byColumn: missingByColumn,
        },
        aggregates,
        schemaSummary: `${rows.length.toLocaleString('th-TH')} rows, ${headers.length.toLocaleString('th-TH')} columns, ${numericCols.length.toLocaleString('th-TH')} numeric columns, label=${labelCol || '-'}`,
        qualityWarnings: buildQualityWarnings(columnProfiles, rows.length, extra.truncated),
        suggestedQuestions: buildSuggestedQuestions(headers, numericCols, labelCol),
        truncated: Boolean(extra.truncated),
        originalRowCount: extra.originalRowCount ?? rows.length,
    };
}

export function parseCSVContent(text) {
    assertUploadSize(new TextEncoder().encode(text || '').byteLength);
    const clean = String(text || '').replace(/^\uFEFF/, '').trim();
    const lines = clean.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return null;

    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const headers = normalizeHeaders(splitCSVLine(lines[0], delimiter));
    const rows = lines.slice(1, MAX_ROWS + 1).map(line => buildRow(headers, splitCSVLine(line, delimiter)));
    return enrichParsedTable(headers, rows, {
        originalRowCount: Math.max(0, lines.length - 1),
        truncated: lines.length - 1 > MAX_ROWS,
    });
}

export async function parseXLSXContent(arrayBuffer) {
    assertUploadSize(arrayBuffer.byteLength || 0);
    const XLSX = await import('xlsx');
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return null;
    const ws = wb.Sheets[sheetName];
    const rowsArr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
    if (!rowsArr || rowsArr.length < 2) return null;

    const headers = normalizeHeaders(rowsArr[0]).filter(h => h !== '');
    const dataRows = rowsArr
        .slice(1, MAX_ROWS + 1)
        .filter(row => row.slice(0, headers.length).some(value => normalizeCell(value) !== ''));
    const rows = dataRows.map(row => buildRow(headers, row));
    return enrichParsedTable(headers, rows, {
        originalRowCount: Math.max(0, rowsArr.length - 1),
        truncated: rowsArr.length - 1 > MAX_ROWS,
    });
}

// Unified entry point: pass a File, get back the parsed shape.
export async function parseFile(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') {
        return await parseXLSXContent(await file.arrayBuffer());
    }
    return parseCSVContent(await file.text());
}
