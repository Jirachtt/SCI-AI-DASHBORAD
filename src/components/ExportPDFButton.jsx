import { useState } from 'react';
import { FileDown, FileSpreadsheet, Printer } from 'lucide-react';
import { exportExcelReportWorkbook, exportPageAsExcelReport } from '../utils/exportUtils';
import { APP_NAME_TH } from '../config/appBrand';

export default function ExportPDFButton({
    title = `รายงาน ${APP_NAME_TH}`,
    label = 'PDF',
    variant = 'default',        // 'default' | 'ghost'
    includeDataExports = true,
    onCSVExport = null,
    getCSVReportSheets = null,
}) {
    const [printing, setPrinting] = useState(false);
    const [exportingExcel, setExportingExcel] = useState(false);

    const handleClick = () => {
        if (printing) return;
        setPrinting(true);

        const original = document.title;
        const stamp = new Date().toLocaleString('th-TH', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
        document.title = `${title} — ${stamp}`;

        const restore = () => {
            document.title = original;
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

    const handleExcelReport = async () => {
        if (exportingExcel) return;
        setExportingExcel(true);
        try {
            if (getCSVReportSheets) {
                const sheets = await getCSVReportSheets();
                await exportExcelReportWorkbook(title, sheets);
                return;
            }
            if (onCSVExport) {
                await onCSVExport();
                return;
            }
            await exportPageAsExcelReport(title);
        } catch (error) {
            console.error('[ExportPDFButton] Excel report export failed:', error);
        } finally {
            setExportingExcel(false);
        }
    };

    const Icon = variant === 'ghost' ? Printer : FileDown;

    return (
        <div className="export-actions no-print">
            {includeDataExports && (
                <button
                    type="button"
                    onClick={handleExcelReport}
                    className="export-action-btn export-action-btn-csv export-csv-primary no-print"
                    disabled={exportingExcel}
                    aria-label="Export page data and graph images as one Excel workbook"
                    title="Export Excel พร้อมข้อมูลครบถ้วนและรูปกราฟของหน้านี้"
                >
                    <FileSpreadsheet size={15} /> {exportingExcel ? 'Excel...' : 'Excel'}
                </button>
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
