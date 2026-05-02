import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    CheckCircle,
    Clock,
    Database,
    Download,
    FileSpreadsheet,
    GitCompareArrows,
    RefreshCw,
    ShieldCheck,
} from 'lucide-react';
import {
    buildDataAccuracyReportRows,
    ensureDataAccuracy,
    getDataAccuracySnapshot,
    onDataAccuracyChange,
} from '../services/dataAccuracyService';

const nf = new Intl.NumberFormat('th-TH');

function formatNumber(value) {
    return Number.isFinite(Number(value)) ? nf.format(Number(value)) : '-';
}

function formatDate(value) {
    if (!value) return '-';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function toneIcon(tone) {
    if (tone === 'success') return <CheckCircle size={16} />;
    if (tone === 'warning') return <AlertTriangle size={16} />;
    return <Database size={16} />;
}

function csvEscape(value) {
    const text = String(value ?? '');
    if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
}

function downloadAccuracyReport(snapshot) {
    const rows = buildDataAccuracyReportRows(snapshot);
    const headers = ['section', 'item', 'source', 'value', 'status', 'updatedAt', 'note'];
    const csv = [
        headers.join(','),
        ...rows.map(row => headers.map(key => csvEscape(row[key])).join(',')),
    ].join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `sci-ai-data-accuracy-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

export default function AdminDataAccuracyPanel({ onToast }) {
    const [snapshot, setSnapshot] = useState(() => getDataAccuracySnapshot());
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const next = await ensureDataAccuracy();
            setSnapshot(next);
            onToast?.('success', 'ตรวจความตรงข้อมูลล่าสุดแล้ว');
        } catch (err) {
            onToast?.('error', `ตรวจข้อมูลไม่สำเร็จ: ${err?.message || 'unknown'}`);
        } finally {
            setLoading(false);
        }
    }, [onToast]);

    useEffect(() => {
        let mounted = true;
        ensureDataAccuracy().then(next => {
            if (mounted) setSnapshot(next);
        });
        const unsubscribe = onDataAccuracyChange(next => {
            setSnapshot(next);
        });
        return () => {
            mounted = false;
            unsubscribe();
        };
    }, []);

    const rec = snapshot.studentReconcile;
    const visibleDatasets = useMemo(
        () => snapshot.datasets.slice().sort((a, b) => Number(b.isLive) - Number(a.isLive) || a.label.localeCompare(b.label)),
        [snapshot.datasets]
    );

    const handleExport = useCallback(() => {
        downloadAccuracyReport(snapshot);
        onToast?.('success', 'Export รายงาน Data Accuracy แล้ว');
    }, [onToast, snapshot]);

    return (
        <div className="admin-data-section data-accuracy-panel">
            <div className="admin-data-status-card data-accuracy-hero">
                <div className="admin-data-status-header">
                    <div className="admin-data-status-icon data-accuracy-icon">
                        <ShieldCheck size={22} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h3>Data Accuracy / Sync Health</h3>
                        <p>ตรวจว่ายอดทางการ รายชื่อในระบบ หน้า Dashboard และ AI ใช้ข้อมูลชุดเดียวกันหรือไม่</p>
                    </div>
                    <span className={`admin-data-badge ${rec.tone === 'success' ? 'live' : 'mock'}`}>
                        {rec.label}
                    </span>
                </div>

                <div className="data-accuracy-score-grid">
                    <div className="data-accuracy-score-card primary">
                        <span>คะแนนความพร้อม</span>
                        <strong>{formatNumber(snapshot.score)}%</strong>
                        <small>{formatNumber(snapshot.liveCount)}/{formatNumber(snapshot.totalDatasets)} datasets live</small>
                    </div>
                    <div className="data-accuracy-score-card">
                        <span>MJU Dashboard</span>
                        <strong>{formatNumber(rec.officialTotal)} คน</strong>
                        <small>{rec.officialIsLive ? 'Live sync' : 'Reference / fallback'} · {formatDate(rec.officialUpdatedAt)}</small>
                    </div>
                    <div className="data-accuracy-score-card">
                        <span>รายชื่อในระบบ</span>
                        <strong>{formatNumber(rec.localTotal)} คน</strong>
                        <small>{rec.studentSourceLabel} · {formatDate(rec.studentUpdatedAt)}</small>
                    </div>
                    <div className="data-accuracy-score-card">
                        <span>ส่วนต่าง</span>
                        <strong className={rec.difference === 0 ? 'is-match' : 'is-warning'}>
                            {rec.difference == null ? '-' : formatNumber(Math.abs(rec.difference))} คน
                        </strong>
                        <small>{rec.difference === 0 ? 'พร้อมใช้ตอบและคำนวณ' : rec.recommendation}</small>
                    </div>
                </div>

                <div className={`data-accuracy-reconcile-note ${rec.tone}`}>
                    {toneIcon(rec.tone)}
                    <span>{rec.recommendation}</span>
                </div>
            </div>

            <div className="data-accuracy-grid">
                <section className="admin-data-status-card data-accuracy-card">
                    <div className="data-accuracy-section-head">
                        <div>
                            <h4><GitCompareArrows size={18} /> Reconcile นักศึกษาคณะวิทยาศาสตร์</h4>
                            <p>เทียบยอดตามระดับการศึกษาระหว่าง snapshot จาก MJU Dashboard กับรายชื่อรายบุคคลในระบบ</p>
                        </div>
                    </div>

                    <div className="data-accuracy-table-wrapper">
                        <table className="data-accuracy-table">
                            <thead>
                                <tr>
                                    <th>ระดับ</th>
                                    <th>MJU Dashboard</th>
                                    <th>รายชื่อในระบบ</th>
                                    <th>ส่วนต่าง</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rec.levelDiffs.map(row => (
                                    <tr key={row.key}>
                                        <td>{row.label}</td>
                                        <td>{formatNumber(row.official)}</td>
                                        <td>{formatNumber(row.local)}</td>
                                        <td className={row.difference === 0 ? 'is-match' : 'is-warning'}>
                                            {row.difference === 0 ? 'ตรงกัน' : `${row.difference > 0 ? '+' : ''}${formatNumber(row.difference)} คน`}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="admin-data-status-card data-accuracy-card">
                    <div className="data-accuracy-section-head">
                        <div>
                            <h4><FileSpreadsheet size={18} /> ข้อมูลที่ AI จะอ้างอิง</h4>
                            <p>AI จะใช้ยอดทางการตอบยอดรวม และใช้รายชื่อในระบบเมื่อต้องตอบรายบุคคลหรือสร้างกราฟจากรายชื่อ</p>
                        </div>
                    </div>
                    <div className="data-accuracy-source-list">
                        <div>
                            <span>MJU Dashboard source</span>
                            <strong>{rec.officialSourceLabel}</strong>
                            <small>{rec.officialSourceUrl || '-'}</small>
                        </div>
                        <div>
                            <span>Student rows source</span>
                            <strong>{rec.studentSourceLabel}</strong>
                            <small>{rec.studentFileName || 'datasets/students'}</small>
                        </div>
                        <div>
                            <span>AI rule</span>
                            <strong>ตอบพร้อมสถานะแหล่งข้อมูล</strong>
                            <small>ถ้ายอดไม่ตรง AI ต้องบอกส่วนต่าง ไม่เดาตัวเลขเอง</small>
                        </div>
                    </div>
                </section>
            </div>

            <div className="admin-data-status-card data-accuracy-card">
                <div className="data-accuracy-section-head">
                    <div>
                        <h4><Database size={18} /> Sync Health ทุก dataset</h4>
                        <p>ใช้ดูว่าหน้าไหนได้ข้อมูล live แล้ว และหน้าไหนยังรอ endpoint/API/file ทางการ</p>
                    </div>
                    <button type="button" className="admin-data-btn ghost" onClick={refresh} disabled={loading}>
                        <RefreshCw size={15} className={loading ? 'spin-animation' : ''} />
                        ตรวจอีกครั้ง
                    </button>
                    <button type="button" className="admin-data-btn ghost" onClick={handleExport}>
                        <Download size={15} />
                        Export CSV
                    </button>
                </div>

                <div className="data-accuracy-dataset-grid">
                    {visibleDatasets.map(item => (
                        <article key={item.id} className={`data-accuracy-dataset ${item.tone}`}>
                            <div>
                                <h5>{item.label}</h5>
                                <p>{item.id}</p>
                            </div>
                            <span>{item.statusLabel}</span>
                            <small><Clock size={13} /> {item.updatedText}</small>
                            <small>{item.rowCount == null ? '-' : `${formatNumber(item.rowCount)} rows`}</small>
                            <small>{item.description}</small>
                        </article>
                    ))}
                </div>
            </div>
        </div>
    );
}
