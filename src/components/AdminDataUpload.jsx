import { useEffect, useRef, useState } from 'react';
import {
    Database, Upload, FileSpreadsheet, CheckCircle, AlertTriangle,
    RefreshCw, Save, X, Info
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { parseFile } from '../utils/fileParsers';
import {
    uploadStudentList, getStudentListMeta, ensureStudentList, isLiveData
} from '../services/studentDataService';

// Target schema for student rows stored in Firestore (datasets/students).
// Order determines display order in the mapping UI.
const TARGET_FIELDS = [
    { key: 'id', label: 'รหัสนักศึกษา', required: true, type: 'string',
        hints: ['รหัส', 'id', 'รหัสนักศึกษา', 'studentid', 'student id', 'code'] },
    { key: 'prefix', label: 'คำนำหน้า', required: false, type: 'string',
        hints: ['คำนำหน้า', 'prefix', 'title'] },
    { key: 'name', label: 'ชื่อ-นามสกุล', required: true, type: 'string',
        hints: ['ชื่อ', 'name', 'fullname', 'ชื่อ-นามสกุล', 'ชื่อสกุล'] },
    { key: 'major', label: 'สาขาวิชา', required: true, type: 'string',
        hints: ['สาขา', 'major', 'สาขาวิชา', 'program', 'หลักสูตร'] },
    { key: 'level', label: 'ระดับการศึกษา', required: false, type: 'string',
        hints: ['ระดับ', 'level', 'ระดับการศึกษา', 'degree'] },
    { key: 'year', label: 'ชั้นปี', required: false, type: 'number',
        hints: ['ชั้นปี', 'year', 'ปี', 'yr'] },
    { key: 'status', label: 'สถานะ', required: false, type: 'string',
        hints: ['สถานะ', 'status', 'state'] },
    { key: 'gpa', label: 'GPA / เกรดเฉลี่ย', required: false, type: 'number',
        hints: ['gpa', 'เกรด', 'เกรดเฉลี่ย', 'gpax'] }
];

const normalize = (s) => String(s || '').toLowerCase().replace(/\s+/g, '').trim();

function autoMapHeaders(headers) {
    const mapping = {};
    const usedHeaders = new Set();
    for (const field of TARGET_FIELDS) {
        const match = headers.find(h => {
            if (usedHeaders.has(h)) return false;
            const nh = normalize(h);
            return field.hints.some(hint => nh.includes(normalize(hint)) || normalize(hint).includes(nh));
        });
        if (match) {
            mapping[field.key] = match;
            usedHeaders.add(match);
        } else {
            mapping[field.key] = '';
        }
    }
    return mapping;
}

function buildStudentRows(parsed, mapping) {
    const errors = [];
    const out = [];
    parsed.rows.forEach((r, idx) => {
        const row = {};
        for (const field of TARGET_FIELDS) {
            const src = mapping[field.key];
            const raw = src ? String(r[src] ?? '').trim() : '';
            if (field.required && !raw) {
                errors.push(`แถวที่ ${idx + 2}: ขาดค่า ${field.label}`);
            }
            if (field.type === 'number') {
                const n = parseFloat(raw.replace(/,/g, ''));
                row[field.key] = isNaN(n) ? null : n;
            } else {
                row[field.key] = raw;
            }
        }
        // Provide sensible defaults so downstream consumers don't break
        if (!row.level) row.level = 'ปริญญาตรี';
        if (!row.status) row.status = 'กำลังศึกษา';
        if (row.year == null) row.year = 0;
        if (row.gpa == null) row.gpa = 0;
        out.push(row);
    });
    return { rows: out, errors };
}

function formatDate(d) {
    if (!d) return '-';
    try {
        return new Date(d).toLocaleString('th-TH', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch { return '-'; }
}

export default function AdminDataUpload({ onToast }) {
    const { user } = useAuth();
    const fileInputRef = useRef(null);
    const [meta, setMeta] = useState(null);
    const [metaLoading, setMetaLoading] = useState(true);
    const [parsed, setParsed] = useState(null);      // { headers, rows, numericCols, labelCol, rowCount }
    const [fileName, setFileName] = useState('');
    const [mapping, setMapping] = useState({});
    const [saving, setSaving] = useState(false);
    const [parseError, setParseError] = useState('');

    const loadMeta = async () => {
        setMetaLoading(true);
        await ensureStudentList();
        const m = await getStudentListMeta();
        setMeta(m);
        setMetaLoading(false);
    };

    useEffect(() => { loadMeta(); }, []);

    const resetUpload = () => {
        setParsed(null);
        setFileName('');
        setMapping({});
        setParseError('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setParseError('');
        try {
            const result = await parseFile(file);
            if (!result || result.rows.length === 0) {
                setParseError('ไม่พบข้อมูลในไฟล์ (ต้องมีอย่างน้อย 1 แถวข้อมูลใต้แถวหัวตาราง)');
                return;
            }
            setParsed(result);
            setFileName(file.name);
            setMapping(autoMapHeaders(result.headers));
        } catch (err) {
            console.error('[AdminDataUpload] parse error:', err);
            setParseError('อ่านไฟล์ไม่สำเร็จ: ' + (err?.message || 'unknown'));
        }
    };

    const handleSave = async () => {
        if (!parsed) return;
        const { rows, errors } = buildStudentRows(parsed, mapping);
        if (errors.length > 0) {
            onToast?.('error', `มีข้อผิดพลาด ${errors.length} แถว — ${errors.slice(0, 2).join(' · ')}`);
            return;
        }
        // Dedupe by id (keep last occurrence)
        const uniq = new Map();
        rows.forEach(r => { if (r.id) uniq.set(r.id, r); });
        const finalRows = Array.from(uniq.values());
        if (finalRows.length === 0) {
            onToast?.('error', 'ไม่มีข้อมูลที่ใช้ได้หลังตรวจสอบ');
            return;
        }

        setSaving(true);
        try {
            await uploadStudentList(finalRows, {
                fileName,
                uid: user?.uid || 'admin',
                who: user?.email || user?.uid || 'admin',
                meta: {
                    originalRowCount: parsed.rowCount,
                    dedupedRowCount: finalRows.length,
                    skippedDuplicates: Math.max(0, parsed.rowCount - finalRows.length),
                },
            });
            onToast?.('success', `อัพโหลดข้อมูล ${finalRows.length} รายการสำเร็จ`);
            resetUpload();
            await loadMeta();
        } catch (err) {
            console.error('[AdminDataUpload] save error:', err);
            onToast?.('error', 'อัพโหลดไม่สำเร็จ: ' + (err?.message || 'unknown'));
        } finally {
            setSaving(false);
        }
    };

    const mappedRequired = TARGET_FIELDS.filter(f => f.required).every(f => mapping[f.key]);

    return (
        <div className="admin-data-section">
            {/* Current dataset status */}
            <div className="admin-data-status-card">
                <div className="admin-data-status-header">
                    <div className="admin-data-status-icon"><Database size={22} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h3>ข้อมูลรายชื่อนักศึกษาปัจจุบัน</h3>
                        <p>แหล่งข้อมูลที่ AI และหน้ารายงานใช้อยู่</p>
                    </div>
                    <span className={`admin-data-badge ${isLiveData() ? 'live' : 'mock'}`}>
                        {isLiveData() ? 'Live (Firestore)' : 'Mock (Default)'}
                    </span>
                </div>
                {metaLoading ? (
                    <div className="admin-data-meta-row"><RefreshCw size={14} className="spin-animation" /> กำลังโหลด...</div>
                ) : meta ? (
                    <div className="admin-data-meta-grid">
                        <div><span className="admin-data-meta-label">จำนวนรายการ</span><strong>{meta.rowCount?.toLocaleString('th-TH')}</strong></div>
                        <div><span className="admin-data-meta-label">ไฟล์ล่าสุด</span><strong>{meta.fileName || '-'}</strong></div>
                        <div><span className="admin-data-meta-label">อัพเดทเมื่อ</span><strong>{formatDate(meta.updatedAt)}</strong></div>
                        <div><span className="admin-data-meta-label">โดย</span><strong>{meta.updatedBy || '-'}</strong></div>
                    </div>
                ) : (
                    <div className="admin-data-meta-row">
                        <Info size={14} /> ยังไม่มีข้อมูลใน Firestore — ระบบกำลังใช้ข้อมูลตัวอย่าง (mock) อัพโหลดไฟล์ด้านล่างเพื่อใช้ข้อมูลจริง
                    </div>
                )}
            </div>

            {/* Upload zone */}
            {!parsed && (
                <div className="admin-data-upload-zone" onClick={() => fileInputRef.current?.click()}>
                    <Upload size={36} />
                    <h3>อัพโหลดไฟล์รายชื่อนักศึกษา</h3>
                    <p>รองรับ CSV, TSV, XLSX — แถวแรกต้องเป็นหัวตาราง</p>
                    <button type="button" className="admin-data-btn primary">
                        <FileSpreadsheet size={16} /> เลือกไฟล์
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.tsv,.txt,.xlsx,.xls"
                        onChange={handleFile}
                        style={{ display: 'none' }}
                    />
                    {parseError && (
                        <div className="admin-data-error">
                            <AlertTriangle size={14} /> {parseError}
                        </div>
                    )}
                </div>
            )}

            {/* Mapping + preview */}
            {parsed && (
                <div className="admin-data-mapping">
                    <div className="admin-data-file-header">
                        <FileSpreadsheet size={18} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <strong>{fileName}</strong>
                            <span> · {parsed.rowCount.toLocaleString('th-TH')} แถว · {parsed.headers.length} คอลัมน์</span>
                        </div>
                        <button className="admin-data-btn ghost" onClick={resetUpload} disabled={saving}>
                            <X size={14} /> ยกเลิก
                        </button>
                    </div>

                    <div className="admin-data-mapping-intro">
                        <Info size={14} /> ระบบคาดเดาการจับคู่คอลัมน์ให้แล้ว ตรวจสอบและปรับแก้ได้ก่อนบันทึก
                    </div>

                    <div className="admin-data-mapping-grid">
                        {TARGET_FIELDS.map(field => (
                            <div key={field.key} className="admin-data-mapping-row">
                                <label>
                                    {field.label}
                                    {field.required && <span className="admin-data-required">*</span>}
                                </label>
                                <select
                                    value={mapping[field.key] || ''}
                                    onChange={e => setMapping(m => ({ ...m, [field.key]: e.target.value }))}
                                >
                                    <option value="">— ไม่ใช้ —</option>
                                    {parsed.headers.map(h => (
                                        <option key={h} value={h}>{h}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>

                    <div className="admin-data-preview">
                        <h4>ตัวอย่างข้อมูล (5 แถวแรก)</h4>
                        <div className="admin-data-preview-table-wrapper">
                            <table className="admin-data-preview-table">
                                <thead>
                                    <tr>
                                        {TARGET_FIELDS.map(f => <th key={f.key}>{f.label}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {parsed.rows.slice(0, 5).map((r, i) => (
                                        <tr key={i}>
                                            {TARGET_FIELDS.map(f => {
                                                const src = mapping[f.key];
                                                const val = src ? r[src] : '';
                                                return <td key={f.key}>{val || <span className="admin-data-empty">—</span>}</td>;
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="admin-data-actions">
                        <span className="admin-data-hint">
                            {mappedRequired
                                ? <><CheckCircle size={14} color="#22c55e" /> จับคู่คอลัมน์จำเป็นครบแล้ว</>
                                : <><AlertTriangle size={14} color="#f59e0b" /> ต้องจับคู่คอลัมน์ที่มีเครื่องหมาย * ให้ครบ</>}
                        </span>
                        <button
                            className="admin-data-btn primary"
                            onClick={handleSave}
                            disabled={!mappedRequired || saving}
                        >
                            {saving
                                ? <><RefreshCw size={14} className="spin-animation" /> กำลังบันทึก...</>
                                : <><Save size={14} /> บันทึกเป็นข้อมูลหลัก ({parsed.rowCount} รายการ)</>}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
