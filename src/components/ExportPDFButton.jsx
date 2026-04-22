// Thin wrapper that triggers the browser's Print → Save as PDF dialog.
// No external deps — users pick "Save as PDF" destination in the print dialog.
// Uses a `data-export-title` attribute to temporarily rename document.title
// so the generated PDF filename is meaningful (Chrome/Edge respect this).
import { useState } from 'react';
import { FileDown, Printer } from 'lucide-react';

export default function ExportPDFButton({
    title = 'รายงาน Science AI Dashboard',
    label = 'Export PDF',
    variant = 'default',        // 'default' | 'ghost'
}) {
    const [printing, setPrinting] = useState(false);

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

        // Small delay so React commits any DOM changes before print snapshot
        setTimeout(() => {
            try { window.print(); }
            finally { /* afterprint handler restores state */ }
            // Safari fallback (doesn't always fire afterprint)
            setTimeout(() => { if (document.title !== original) restore(); }, 1500);
        }, 60);
    };

    const Icon = variant === 'ghost' ? Printer : FileDown;
    return (
        <button
            type="button"
            onClick={handleClick}
            className={variant === 'ghost' ? 'admin-refresh-btn no-print' : 'filter-apply-btn no-print'}
            disabled={printing}
            title="บันทึกหน้านี้เป็น PDF (เลือกปลายทาง Save as PDF ในกล่องพิมพ์)"
            style={{ gap: 6 }}
        >
            <Icon size={14} /> {printing ? 'กำลังเตรียม...' : label}
        </button>
    );
}
