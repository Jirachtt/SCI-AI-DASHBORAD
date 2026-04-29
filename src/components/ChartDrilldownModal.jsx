import { useEffect, useRef } from 'react';
import { X, TableProperties, Info } from 'lucide-react';

function inferColumns(rows) {
    const first = rows?.[0];
    return first ? Object.keys(first).map(key => ({ key, label: key })) : [];
}

function renderCell(value) {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'number') return value.toLocaleString('th-TH');
    return String(value);
}

export default function ChartDrilldownModal({ detail, onClose }) {
    const modalRef = useRef(null);

    useEffect(() => {
        if (!detail) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') onClose();
        };
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKeyDown);
        window.requestAnimationFrame(() => {
            modalRef.current?.focus({ preventScroll: true });
        });
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [detail, onClose]);

    if (!detail) return null;

    const rows = Array.isArray(detail.rows) ? detail.rows : [];
    const columns = detail.columns || inferColumns(rows);
    const accent = detail.accentColor || '#00a651';
    const visibleRows = rows.slice(0, detail.maxRows || 500);

    return (
        <div className="chart-drilldown-overlay no-print" onClick={onClose} role="presentation">
            <section
                ref={modalRef}
                className="chart-drilldown-modal"
                role="dialog"
                aria-modal="true"
                aria-label={detail.title || 'รายละเอียดกราฟ'}
                tabIndex={-1}
                onClick={event => event.stopPropagation()}
                style={{ '--chart-drilldown-accent': accent }}
            >
                <header className="chart-drilldown-header">
                    <div className="chart-drilldown-icon" aria-hidden="true">
                        <TableProperties size={20} />
                    </div>
                    <div className="chart-drilldown-title-wrap">
                        <h2>{detail.title || 'รายละเอียดกราฟ'}</h2>
                        {detail.subtitle && <p>{detail.subtitle}</p>}
                    </div>
                    <button className="chart-drilldown-close" type="button" onClick={onClose} aria-label="ปิดรายละเอียด">
                        <X size={18} />
                    </button>
                </header>

                {(detail.value !== undefined || detail.summary || detail.metrics?.length) && (
                    <div className="chart-drilldown-summary">
                        {detail.value !== undefined && (
                            <div className="chart-drilldown-value-card">
                                <span>{detail.valueLabel || 'ค่า'}</span>
                                <strong>{renderCell(detail.value)}{detail.unit ? ` ${detail.unit}` : ''}</strong>
                            </div>
                        )}
                        {detail.summary && <p>{detail.summary}</p>}
                        {detail.metrics?.map(metric => (
                            <div className="chart-drilldown-mini-stat" key={metric.label}>
                                <span>{metric.label}</span>
                                <strong>{renderCell(metric.value)}{metric.unit ? ` ${metric.unit}` : ''}</strong>
                            </div>
                        ))}
                    </div>
                )}

                {detail.note && (
                    <div className="chart-drilldown-note">
                        <Info size={15} />
                        <span>{detail.note}</span>
                    </div>
                )}

                <div className="chart-drilldown-table-wrap">
                    {rows.length === 0 ? (
                        <div className="chart-drilldown-empty">
                            ไม่มีข้อมูลแถวรายละเอียดสำหรับจุดนี้ในชุดข้อมูลปัจจุบัน
                        </div>
                    ) : (
                        <table className="chart-drilldown-table">
                            <thead>
                                <tr>
                                    {columns.map(col => <th key={col.key}>{col.label}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {visibleRows.map((row, rowIndex) => (
                                    <tr key={row.id || row.code || rowIndex}>
                                        {columns.map(col => (
                                            <td key={col.key} className={col.align === 'right' ? 'is-right' : ''}>
                                                {col.render ? col.render(row[col.key], row) : renderCell(row[col.key])}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {rows.length > visibleRows.length && (
                    <div className="chart-drilldown-limit">
                        แสดง {visibleRows.length.toLocaleString('th-TH')} รายการแรกจากทั้งหมด {rows.length.toLocaleString('th-TH')} รายการ
                    </div>
                )}
            </section>
        </div>
    );
}
