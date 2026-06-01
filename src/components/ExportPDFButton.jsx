import { useState } from 'react';
import { FileDown, FileSpreadsheet, Printer } from 'lucide-react';
import {
    exportExcelReportWorkbook,
    exportPageAsExcelReport,
} from '../utils/exportUtils';
import { APP_NAME_EN, APP_NAME_TH } from '../config/appBrand';

function createPrintReportMetadata(title, stamp) {
    const wrapper = document.createElement('section');
    wrapper.className = 'print-report-metadata';
    wrapper.setAttribute('aria-hidden', 'true');

    const heading = document.createElement('h1');
    heading.textContent = title || APP_NAME_TH;

    const app = document.createElement('p');
    app.textContent = `${APP_NAME_TH} / ${APP_NAME_EN}`;

    const meta = document.createElement('div');
    meta.className = 'print-report-metadata-grid';

    const rows = [
        ['Generated at', stamp],
        ['Route scope', window.location?.pathname || '/dashboard'],
        ['Report standard', 'University production report: visible dashboard state, source notes, filters, and charts'],
    ];

    rows.forEach(([label, value]) => {
        const item = document.createElement('div');
        const key = document.createElement('span');
        key.textContent = label;
        const val = document.createElement('strong');
        val.textContent = value;
        item.append(key, val);
        meta.appendChild(item);
    });

    wrapper.append(heading, app, meta);
    return wrapper;
}

export default function ExportPDFButton({
    title = `รายงาน ${APP_NAME_TH}`,
    label = 'PDF',
    variant = 'default',        // 'default' | 'ghost'
    includeDataExports = true,
    onWorkbookExport = null,
    getWorkbookReportSheets = null,
    onCSVExport = null,
    getCSVReportSheets = null,
}) {
    const [printing, setPrinting] = useState(false);
    const [exportingWorkbook, setExportingWorkbook] = useState(false);

    const handleClick = () => {
        if (printing) return;
        setPrinting(true);

        const original = document.title;
        const stamp = new Date().toLocaleString('th-TH', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
        document.title = `${title} — ${stamp}`;
        const printMeta = createPrintReportMetadata(title, stamp);
        document.body.prepend(printMeta);

        const restore = () => {
            document.title = original;
            printMeta.remove();
            setPrinting(false);
            window.removeEventListener('afterprint', restore);
        };
        window.addEventListener('afterprint', restore);

        setTimeout(() => {
            try { window.print(); }
            finally { /* afterprint handler restores state */ }
            setTimeout(() => { if (document.title !== original) restore(); }, 1500);
        }, 60);
    };

    const handleWorkbookReport = async () => {
        if (exportingWorkbook) return;
        setExportingWorkbook(true);
        try {
            const sheetProvider = getWorkbookReportSheets || getCSVReportSheets;
            if (sheetProvider) {
                const sheets = await sheetProvider();
                await exportExcelReportWorkbook(title, sheets);
                return;
            }
            const customExport = onWorkbookExport || onCSVExport;
            if (customExport) {
                await customExport();
                return;
            }
            await exportPageAsExcelReport(title);
        } catch (error) {
            console.error('[ExportPDFButton] Excel export failed:', error);
        } finally {
            setExportingWorkbook(false);
        }
    };

    const Icon = variant === 'ghost' ? Printer : FileDown;

    return (
        <div className="export-actions no-print">
            {includeDataExports && (
                <>
                    <button
                        type="button"
                        onClick={handleWorkbookReport}
                        className="export-action-btn export-action-btn-workbook export-workbook-primary no-print"
                        disabled={exportingWorkbook}
                        aria-label="Export page data and charts as an Excel workbook"
                        title="Export Excel: ข้อมูลทุก section หลาย sheet พร้อม metadata/source และรูปกราฟคมชัดในไฟล์เดียว"
                    >
                        <FileSpreadsheet size={15} /> {exportingWorkbook ? 'Excel...' : 'Excel'}
                    </button>
                </>
            )}
            <button
                type="button"
                onClick={handleClick}
                className="export-action-btn export-action-btn-pdf export-pdf-secondary no-print"
                disabled={printing}
                aria-label="บันทึกหน้านี้เป็น PDF"
            >
                <Icon size={15} /> {printing ? 'PDF...' : label}
            </button>
        </div>
    );
}
