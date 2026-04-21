// Shared CSV/XLSX parsers used by the AI chat upload flow and the admin
// data-management upload flow. Both produce the same shape:
//   { headers, rows, numericCols, labelCol, rowCount }
import * as XLSX from 'xlsx';

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
    const clean = text.replace(/^\uFEFF/, '').trim();
    const lines = clean.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return null;

    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const headers = splitCSVLine(lines[0], delimiter);
    const rows = lines.slice(1).map(line => {
        const vals = splitCSVLine(line, delimiter);
        const obj = {};
        headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
        return obj;
    });
    const { numericCols, labelCol } = detectMeta(headers, rows);
    return { headers, rows, numericCols, labelCol, rowCount: rows.length };
}

export function parseXLSXContent(arrayBuffer) {
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return null;
    const ws = wb.Sheets[sheetName];
    const rowsArr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
    if (!rowsArr || rowsArr.length < 2) return null;

    const headers = rowsArr[0].map(h => String(h ?? '').trim()).filter(h => h !== '');
    const dataRows = rowsArr.slice(1).filter(r => r.some(v => String(v ?? '').trim() !== ''));
    const rows = dataRows.map(r => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = String(r[i] ?? '').trim(); });
        return obj;
    });
    const { numericCols, labelCol } = detectMeta(headers, rows);
    return { headers, rows, numericCols, labelCol, rowCount: rows.length };
}

// Unified entry point: pass a File, get back the parsed shape.
export async function parseFile(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') {
        return parseXLSXContent(await file.arrayBuffer());
    }
    return parseCSVContent(await file.text());
}
