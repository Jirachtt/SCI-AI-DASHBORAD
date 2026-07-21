import { useCallback, useEffect, useState } from 'react';
import { ScrollText, RefreshCw, Upload, Info, FileSpreadsheet, UserCog, DatabaseZap } from 'lucide-react';
import { listRecentAuditLogs } from '../services/auditLogService';
import { legacyColorToVar, themeAlpha } from '../utils/themeTokens';

const ACTION_LABEL = {
    upload_students: { label: 'อัพโหลดรายชื่อนักศึกษา', Icon: Upload, color: 'var(--accent-success)' },
    admin_user_update: { label: 'จัดการผู้ใช้/สิทธิ์', Icon: UserCog, color: 'var(--accent-blue)' },
    dashboard_sync: { label: 'Sync Dashboard', Icon: DatabaseZap, color: 'var(--accent-purple)' },
    dashboard_cron: { label: 'Auto Sync Dashboard', Icon: DatabaseZap, color: 'var(--accent-purple)' },
};

function getLogDetail(log) {
    if (log.meta?.summary) {
        const target = log.meta?.targetName ? ` · ${log.meta.targetName}` : '';
        return `${log.meta.summary}${target}`;
    }
    const duplicateCount = Number(log.meta?.skippedDuplicates || 0);
    return duplicateCount > 0 ? `ข้ามซ้ำ ${duplicateCount} แถว` : '-';
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

export default function AdminAuditLog() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        const rows = await listRecentAuditLogs(100);
        setLogs(rows);
        setLoading(false);
    }, []);

    useEffect(() => {
        let active = true;
        listRecentAuditLogs(100)
            .then(rows => {
                if (active) setLogs(rows);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, []);

    return (
        <div className="admin-data-section">
            <div className="admin-data-status-card">
                <div className="admin-data-status-header">
                    <div className="admin-data-status-icon"><ScrollText size={22} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h3>บันทึกการเปลี่ยนแปลงข้อมูล (Audit Log)</h3>
                        <p>ประวัติการจัดการสิทธิ์ อัพโหลด และ Sync ข้อมูล — append-only ใน Firestore</p>
                    </div>
                    <button className="admin-refresh-btn" onClick={load} disabled={loading}>
                        <RefreshCw size={14} className={loading ? 'spin-animation' : ''} /> รีเฟรช
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="admin-empty-state">
                    <RefreshCw size={40} className="spin-animation" />
                    <p>กำลังโหลดประวัติ...</p>
                </div>
            ) : logs.length === 0 ? (
                <div className="admin-empty-state">
                    <Info size={44} color="var(--text-muted)" />
                    <h3>ยังไม่มีบันทึก</h3>
                    <p>บันทึกจะถูกสร้างอัตโนมัติเมื่อมีการเปลี่ยนสิทธิ์ อัพโหลด หรือ Sync ข้อมูลใหม่</p>
                </div>
            ) : (
                <div className="admin-users-table-wrapper" style={{ marginTop: 12 }}>
                    <table className="admin-users-table">
                        <thead>
                            <tr>
                                <th>เวลา</th>
                                <th>การกระทำ</th>
                                <th>ผู้กระทำ</th>
                                <th>ไฟล์</th>
                                <th style={{ textAlign: 'right' }}>จำนวนแถว</th>
                                <th>รายละเอียด</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map(log => {
                                const meta = ACTION_LABEL[log.action] || { label: log.action, Icon: Info, color: 'var(--accent-purple)' };
                                const M = meta.Icon;
                                return (
                                    <tr key={log.id}>
                                        <td className="admin-cell-date">{formatDate(log.at)}</td>
                                        <td>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                                padding: '3px 10px', borderRadius: 999,
                                                background: themeAlpha(meta.color, 12), color: legacyColorToVar(meta.color),
                                                fontSize: '0.8rem', fontWeight: 600
                                            }}>
                                                <M size={12} /> {meta.label}
                                            </span>
                                        </td>
                                        <td className="admin-cell-email">{log.who}</td>
                                        <td>
                                            {log.fileName ? (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                    <FileSpreadsheet size={12} /> {log.fileName}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                            {log.rowCount != null ? log.rowCount.toLocaleString('th-TH') : '-'}
                                        </td>
                                        <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            {getLogDetail(log)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
