import { useState } from 'react';
import { FileDown, Printer, TableProperties } from 'lucide-react';
import { exportCSVReportWorkbook, exportPageAsCSVReport } from '../utils/exportUtils';
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
    const [exportingCSV, setExportingCSV] = useState(false);

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

    const handleCSVReport = async () => {
        if (exportingCSV) return;
        setExportingCSV(true);
        try {
            if (getCSVReportSheets) {
                const sheets = await getCSVReportSheets();
                await exportCSVReportWorkbook(title, sheets);
                return;
            }
            if (onCSVExport) {
                await onCSVExport();
                return;
            }
            await exportPageAsCSVReport(title);
        } catch (error) {
            console.error('[ExportPDFButton] CSV report export failed:', error);
        } finally {
            setExportingCSV(false);
        }
    };

    const Icon = variant === 'ghost' ? Printer : FileDown;

    return (
        <div className="export-actions no-print">
            {includeDataExports && (
                <button
                    type="button"
                    onClick={handleCSVReport}
                    className="export-action-btn export-action-btn-csv export-csv-primary no-print"
                    disabled={exportingCSV}
                    aria-label="Export CSV data and graph images as one Excel workbook"
                >
                    <TableProperties size={15} /> {exportingCSV ? 'CSV+Graph...' : 'CSV+Graph'}
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
