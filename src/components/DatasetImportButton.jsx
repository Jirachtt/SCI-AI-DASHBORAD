import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    AlertTriangle,
    CheckCircle2,
    Download,
    FileSpreadsheet,
    Upload,
    X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { hasStudentDataWriteAccess } from '../utils/accessControl';
import { parseFile } from '../utils/fileParsers';
import {
    buildDashboardDatasetImport,
    DATASET_IMPORT_DEFINITIONS,
    saveDashboardDatasetImport,
} from '../services/dashboardDatasetImportService';

function csvCell(value) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function previewValue(value) {
    if (value == null || value === '') return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

export default function DatasetImportButton({
    importTypes = [],
    currentData,
    onImported,
    buttonLabel = 'นำเข้าข้อมูล',
}) {
    const { user } = useAuth();
    const fileInputRef = useRef(null);
    const availableTypes = importTypes.filter(type => DATASET_IMPORT_DEFINITIONS[type]);
    const [open, setOpen] = useState(false);
    const [importType, setImportType] = useState(availableTypes[0] || '');
    const [file, setFile] = useState(null);
    const [parsed, setParsed] = useState(null);
    const [preview, setPreview] = useState(null);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [savedMessage, setSavedMessage] = useState('');

    const canWrite = hasStudentDataWriteAccess(user?.role);
    const definition = DATASET_IMPORT_DEFINITIONS[importType];
    const previewColumns = useMemo(() => {
        const first = preview?.normalizedRows?.[0];
        return first ? Object.keys(first).slice(0, 8) : [];
    }, [preview]);

    if (!canWrite || availableTypes.length === 0) return null;

    function resetState() {
        setFile(null);
        setParsed(null);
        setPreview(null);
        setError('');
        setSavedMessage('');
        setSaving(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    function closeDialog() {
        setOpen(false);
        resetState();
    }

    function rebuild(nextType, nextParsed = parsed, nextFile = file) {
        setError('');
        setSavedMessage('');
        if (!nextParsed || !nextFile) {
            setPreview(null);
            return;
        }
        try {
            setPreview(buildDashboardDatasetImport({
                importType: nextType,
                parsed: nextParsed,
                currentData,
                fileName: nextFile.name,
            }));
        } catch (nextError) {
            setPreview(null);
            setError(nextError?.message || 'ไม่สามารถตรวจสอบไฟล์ได้');
        }
    }

    async function handleFile(event) {
        const nextFile = event.target.files?.[0] || null;
        setFile(nextFile);
        setParsed(null);
        setPreview(null);
        setError('');
        setSavedMessage('');
        if (!nextFile) return;
        try {
            const nextParsed = await parseFile(nextFile);
            if (!nextParsed) throw new Error('ไฟล์ต้องมีหัวตารางและข้อมูลอย่างน้อย 1 แถว');
            setParsed(nextParsed);
            rebuild(importType, nextParsed, nextFile);
        } catch (nextError) {
            setError(nextError?.message || 'อ่านไฟล์ไม่สำเร็จ');
        }
    }

    function changeImportType(event) {
        const nextType = event.target.value;
        setImportType(nextType);
        rebuild(nextType);
    }

    function downloadTemplate() {
        if (!definition) return;
        const csv = `\uFEFF${definition.templateColumns.map(csvCell).join(',')}\r\n`;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `SCI-${importType}-template.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
    }

    async function saveImport() {
        if (!parsed || !file || !preview) return;
        setSaving(true);
        setError('');
        setSavedMessage('');
        try {
            const result = await saveDashboardDatasetImport({
                importType,
                parsed,
                currentData,
                file,
                user,
            });
            setSavedMessage(`บันทึก ${result.rowCount.toLocaleString('th-TH')} แถวแล้ว หน้าเว็บและ AI จะใช้ข้อมูลชุดนี้ทันที`);
            onImported?.(result);
        } catch (nextError) {
            setError(nextError?.message || 'บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสิทธิ์และลองใหม่');
        } finally {
            setSaving(false);
        }
    }

    const dialog = open ? (
        <div className="dataset-import-backdrop" role="presentation" onMouseDown={event => {
            if (event.target === event.currentTarget) closeDialog();
        }}>
            <section className="dataset-import-dialog" role="dialog" aria-modal="true" aria-labelledby="dataset-import-title">
                <header className="dataset-import-header">
                    <div>
                        <span className="dataset-import-kicker">AUTHORIZED DATA IMPORT</span>
                        <h2 id="dataset-import-title">นำเข้าข้อมูลคณะวิทยาศาสตร์</h2>
                        <p>ระบบตรวจรูปแบบก่อนบันทึก และไม่แก้ section อื่นใน dataset</p>
                    </div>
                    <button type="button" className="icon-button" onClick={closeDialog} aria-label="ปิดหน้าต่าง">
                        <X size={18} />
                    </button>
                </header>

                <div className="dataset-import-body">
                    <label className="dataset-import-field">
                        <span>ประเภทข้อมูล</span>
                        <select value={importType} onChange={changeImportType}>
                            {availableTypes.map(type => (
                                <option key={type} value={type}>{DATASET_IMPORT_DEFINITIONS[type].label}</option>
                            ))}
                        </select>
                    </label>

                    <div className="dataset-import-schema">
                        <div>
                            <strong>{definition?.label}</strong>
                            <p>{definition?.description}</p>
                        </div>
                        <button type="button" className="secondary-button" onClick={downloadTemplate}>
                            <Download size={16} /> แม่แบบ CSV
                        </button>
                    </div>

                    <button type="button" className="dataset-import-dropzone" onClick={() => fileInputRef.current?.click()}>
                        <FileSpreadsheet size={24} />
                        <span>{file ? file.name : 'เลือกไฟล์ CSV หรือ Excel (.xlsx)'}</span>
                        <small>สูงสุด 5 MB และ 5,000 แถว</small>
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.tsv,.xlsx,.xls"
                        onChange={handleFile}
                        hidden
                    />

                    {error && (
                        <div className="dataset-import-message dataset-import-message--error">
                            <AlertTriangle size={17} /> <span>{error}</span>
                        </div>
                    )}
                    {savedMessage && (
                        <div className="dataset-import-message dataset-import-message--success">
                            <CheckCircle2 size={17} /> <span>{savedMessage}</span>
                        </div>
                    )}

                    {preview && (
                        <div className="dataset-import-preview">
                            <div className="dataset-import-preview-summary">
                                <div><strong>{preview.rowCount.toLocaleString('th-TH')}</strong><span>แถวพร้อมบันทึก</span></div>
                                <div><strong>{parsed.headers.length.toLocaleString('th-TH')}</strong><span>คอลัมน์ในไฟล์</span></div>
                                <div><strong>{parsed.analysisReadiness?.score ?? '-'}</strong><span>คะแนนความพร้อม</span></div>
                            </div>
                            <div className="dataset-import-table-wrap">
                                <table>
                                    <thead><tr>{previewColumns.map(column => <th key={column}>{column}</th>)}</tr></thead>
                                    <tbody>
                                        {preview.normalizedRows.slice(0, 5).map((row, index) => (
                                            <tr key={`${importType}-${index}`}>
                                                {previewColumns.map(column => <td key={column}>{previewValue(row[column])}</td>)}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {preview.warnings.length > 0 && (
                                <p className="dataset-import-warning">ข้อสังเกต: {preview.warnings.join(' • ')}</p>
                            )}
                        </div>
                    )}
                </div>

                <footer className="dataset-import-footer">
                    <button type="button" className="secondary-button" onClick={closeDialog}>ปิด</button>
                    <button type="button" className="primary-button" onClick={saveImport} disabled={!preview || saving || Boolean(savedMessage)}>
                        <Upload size={16} /> {saving ? 'กำลังบันทึก...' : 'ยืนยันนำเข้า'}
                    </button>
                </footer>
            </section>
        </div>
    ) : null;

    return (
        <>
            <button type="button" className="secondary-button dataset-import-trigger" onClick={() => setOpen(true)}>
                <Upload size={16} /> {buttonLabel}
            </button>
            {dialog && createPortal(dialog, document.body)}
        </>
    );
}
