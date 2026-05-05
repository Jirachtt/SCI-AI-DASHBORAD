// Shared CSV/XLSX parsers used by the AI chat upload flow and the admin
// data-management upload flow. Both produce the same shape:
//   { headers, rows, numericCols, labelCol, rowCount }

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
        const vals = rows.map(r => parseFloat(String(r[h]).replace(/,/g, ''))).filter(v => !isNaN(v));
        return vals.length >= rows.length * 0.5;
    });
    const labelCol = headers.find(h => !numericCols.includes(h)) || headers[0];
    return { numericCols, labelCol };
}

export function parseCSVContent(text) {
    assertUploadSize(new TextEncoder().encode(text || '').byteLength);
    const clean = String(text || '').replace(/^\uFEFF/, '').trim();
    const lines = clean.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return null;

    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const headers = normalizeHeaders(splitCSVLine(lines[0], delimiter));
    const rows = lines.slice(1, MAX_ROWS + 1).map(line => buildRow(headers, splitCSVLine(line, delimiter)));
    const { numericCols, labelCol } = detectMeta(headers, rows);
    return { headers, rows, numericCols, labelCol, rowCount: rows.length };
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
    const { numericCols, labelCol } = detectMeta(headers, rows);
    return { headers, rows, numericCols, labelCol, rowCount: rows.length };
}

// Unified entry point: pass a File, get back the parsed shape.
export async function parseFile(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') {
        return await parseXLSXContent(await file.arrayBuffer());
    }
    return parseCSVContent(await file.text());
}
