import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle, Clock, RefreshCw, Server } from 'lucide-react';

const AI_USAGE_ENDPOINT = import.meta.env.VITE_AI_USAGE_ENDPOINT || '/api/ai-usage';

function formatNumber(value) {
    return Number.isFinite(Number(value)) ? Number(value).toLocaleString('th-TH') : '-';
}

function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

async function fetchAIUsageSnapshot() {
    const response = await fetch(AI_USAGE_ENDPOINT, { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.message || body?.error || `HTTP ${response.status}`);
    return body;
}

export default function AdminAIUsagePanel({ onToast }) {
    const [usage, setUsage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const refresh = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const body = await fetchAIUsageSnapshot();
            setUsage(body);
            onToast?.('success', 'อัปเดตสถานะ AI quota แล้ว');
        } catch (err) {
            setError(err?.message || 'โหลด AI quota ไม่สำเร็จ');
            onToast?.('error', `โหลด AI quota ไม่สำเร็จ: ${err?.message || 'unknown'}`);
        } finally {
            setLoading(false);
        }
    }, [onToast]);

    useEffect(() => {
        let cancelled = false;
        async function loadInitialUsage() {
            try {
                const body = await fetchAIUsageSnapshot();
                if (!cancelled) setUsage(body);
            } catch (err) {
                if (!cancelled) setError(err?.message || 'โหลด AI quota ไม่สำเร็จ');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        void loadInitialUsage();
        return () => {
            cancelled = true;
        };
    }, []);

    const percent = Math.max(0, Math.min(100, Number(usage?.remainingPercent ?? 0)));
    const usedPercent = Math.max(0, Math.min(100, 100 - percent));
    const limits = usage?.limits || {};
    const status = useMemo(() => {
        if (!usage) return { tone: 'warning', label: 'กำลังซิงก์', icon: RefreshCw };
        if (usage.serverBacked === false) return { tone: 'warning', label: 'ยังไม่ต่อ Firestore usage', icon: AlertTriangle };
        if (percent <= 15) return { tone: 'danger', label: 'ใกล้เต็มโควตา', icon: AlertTriangle };
        return { tone: 'success', label: 'พร้อมใช้งาน', icon: CheckCircle };
    }, [percent, usage]);
    const StatusIcon = status.icon;

    return (
        <div className="admin-data-section admin-ai-usage-panel">
            <div className="admin-data-status-card admin-ai-usage-hero">
                <div className="admin-data-status-header">
                    <div className="admin-data-status-icon">
                        <Activity size={22} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h3>AI Usage / Quota Monitor</h3>
                        <p>ติดตาม token budget และ rate limit กลางจาก server เพื่อกัน AI หยุดตอบตอนพรีเซน</p>
                    </div>
                    <span className={`admin-data-badge ${status.tone === 'success' ? 'live' : 'mock'}`}>
                        <StatusIcon size={14} /> {status.label}
                    </span>
                </div>

                {error ? (
                    <div className="data-accuracy-reconcile-note warning">
                        <AlertTriangle size={16} />
                        <span>{error}</span>
                    </div>
                ) : null}

                <div className="admin-ai-usage-grid">
                    <div className="admin-ai-usage-card primary">
                        <span>Token remaining</span>
                        <strong>{formatNumber(usage?.remainingTokens)}</strong>
                        <small>{formatNumber(usage?.usedTokens)} used / {formatNumber(usage?.budgetTokens)} budget</small>
                    </div>
                    <div className="admin-ai-usage-card">
                        <span>Requests today</span>
                        <strong>{formatNumber(usage?.requests)}</strong>
                        <small>เหลือ {formatNumber(usage?.remainingRequests)} requests</small>
                    </div>
                    <div className="admin-ai-usage-card">
                        <span>Reset</span>
                        <strong>{usage?.resetLabel || '00:00 น.'}</strong>
                        <small>{formatDate(usage?.resetAt)} · {usage?.timezone || 'Asia/Bangkok'}</small>
                    </div>
                    <div className="admin-ai-usage-card">
                        <span>Storage</span>
                        <strong>{usage?.serverBacked === false ? 'Local fallback' : 'Firestore'}</strong>
                        <small>{usage?.source || 'unknown'} · {usage?.dayKey || '-'}</small>
                    </div>
                </div>

                <div className="admin-ai-usage-meter" aria-label={`AI token used ${usedPercent}%`}>
                    <span style={{ width: `${usedPercent}%` }} />
                </div>

                <div className="admin-ai-usage-limits">
                    <span><Server size={14} /> Daily token {formatNumber(limits.dailyTokenBudget)}</span>
                    <span><Clock size={14} /> Global RPM {formatNumber(limits.globalRpm)}</span>
                    <span>Client RPM {formatNumber(limits.clientRpm)}</span>
                    <span>Global RPD {formatNumber(limits.globalRpd)}</span>
                </div>

                <div className="data-accuracy-section-head compact">
                    <div>
                        <h4>Operational rule</h4>
                        <p>ตัวเลขนี้เป็น quota ที่ระบบเว็บเราบังคับจริงผ่าน API ฝั่ง Vercel และ reset ทุกวันตามเวลาไทย</p>
                    </div>
                    <button type="button" className="admin-data-btn ghost" onClick={refresh} disabled={loading}>
                        <RefreshCw size={15} className={loading ? 'spin-animation' : ''} />
                        รีเฟรช
                    </button>
                </div>
            </div>
        </div>
    );
}
