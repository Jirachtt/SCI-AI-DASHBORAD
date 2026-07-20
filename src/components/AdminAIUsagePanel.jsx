import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle, Database, RefreshCw, Server } from 'lucide-react';

const AI_USAGE_ENDPOINT = import.meta.env.VITE_AI_USAGE_ENDPOINT || '/api/ai-usage';

function formatNumber(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'รอข้อมูล';
    return Number(value).toLocaleString('th-TH');
}

function formatDate(value) {
    if (!value) return 'รอข้อมูล';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'รอข้อมูล';
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

    const refresh = useCallback(async (notify = true) => {
        setLoading(true);
        setError('');
        try {
            const body = await fetchAIUsageSnapshot();
            setUsage(body);
            if (notify) onToast?.('success', 'อัปเดตสถานะการใช้งาน AI แล้ว');
        } catch (err) {
            const message = err?.message || 'โหลดสถานะการใช้งาน AI ไม่สำเร็จ';
            setError(message);
            if (notify) onToast?.('error', message);
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
                if (!cancelled) setError(err?.message || 'โหลดสถานะการใช้งาน AI ไม่สำเร็จ');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        void loadInitialUsage();
        return () => {
            cancelled = true;
        };
    }, []);

    const serverReady = usage?.serverBacked === true;
    const budgetAvailable = serverReady
        && usage?.policy?.dailyTokenBudgetEnforced === true
        && usage?.budgetTokens != null
        && usage?.remainingPercent != null;
    const usedPercent = budgetAvailable
        ? Math.max(0, Math.min(100, 100 - Number(usage.remainingPercent)))
        : null;
    const status = useMemo(() => {
        if (loading && !usage) return { tone: 'warning', label: 'กำลังเชื่อมข้อมูล', icon: RefreshCw };
        if (!serverReady) return { tone: 'warning', label: 'รอ Firestore usage', icon: AlertTriangle };
        if (budgetAvailable && Number(usage.remainingPercent) <= 15) {
            return { tone: 'danger', label: 'งบระบบใกล้เต็ม', icon: AlertTriangle };
        }
        return { tone: 'success', label: 'ข้อมูลจาก server', icon: CheckCircle };
    }, [budgetAvailable, loading, serverReady, usage]);
    const StatusIcon = status.icon;

    return (
        <div className="admin-data-section admin-ai-usage-panel">
            <div className="admin-data-status-card admin-ai-usage-hero">
                <div className="admin-data-status-header">
                    <div className="admin-data-status-icon"><Activity size={22} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h3>AI Usage Monitor</h3>
                        <p>ตรวจสอบ token ที่ใช้จริง แหล่งที่มา และนโยบายจำกัดการใช้งาน โดยไม่เก็บ prompt หรือคำตอบเต็ม</p>
                    </div>
                    <span className={`admin-data-badge ${status.tone === 'success' ? 'live' : 'mock'}`}>
                        <StatusIcon size={14} /> {status.label}
                    </span>
                </div>

                {error && (
                    <div className="data-accuracy-reconcile-note warning">
                        <AlertTriangle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                <div className="admin-ai-usage-grid">
                    <div className="admin-ai-usage-card primary">
                        <span>Token ที่ใช้ในรอบปัจจุบัน</span>
                        <strong>{serverReady ? formatNumber(usage?.usedTokens) : 'รอข้อมูลจาก server'}</strong>
                        <small>actual {formatNumber(usage?.providerTokens)} · estimated {formatNumber(usage?.estimatedTokens)}</small>
                    </div>
                    <div className="admin-ai-usage-card">
                        <span>คำขอที่สำเร็จ</span>
                        <strong>{serverReady ? formatNumber(usage?.requests) : 'รอข้อมูล'}</strong>
                        <small>attempts {formatNumber(usage?.attempts)} · failed {formatNumber(usage?.failedRequests)}</small>
                    </div>
                    <div className="admin-ai-usage-card">
                        <span>Usage components</span>
                        <strong>{formatNumber(usage?.inputTokens)} / {formatNumber(usage?.outputTokens)}</strong>
                        <small>input / output · thinking {formatNumber(usage?.thinkingTokens)}</small>
                    </div>
                    <div className="admin-ai-usage-card">
                        <span>Storage</span>
                        <strong>{serverReady ? 'Firestore' : 'Unavailable'}</strong>
                        <small>{usage?.source || 'รอข้อมูล'} · {usage?.dayKey || '-'}</small>
                    </div>
                </div>

                {budgetAvailable ? (
                    <div className="admin-ai-policy-block">
                        <div className="admin-ai-usage-limits">
                            <span><Server size={14} /> งบระบบ {formatNumber(usage.budgetTokens)}</span>
                            <span>เหลือ {formatNumber(usage.remainingTokens)} ({formatNumber(usage.remainingPercent)}%)</span>
                            <span>รีเซ็ต {usage.resetLabel || formatDate(usage.resetAt)}</span>
                        </div>
                        <div className="admin-ai-usage-meter" aria-label={`Application token budget used ${usedPercent}%`}>
                            <span style={{ width: `${usedPercent}%` }} />
                        </div>
                        <small className="admin-ai-usage-caption">นี่คืองบที่ระบบ SCI AI บังคับใช้ ไม่ใช่ quota คงเหลือของผู้ให้บริการ</small>
                    </div>
                ) : (
                    <div className="data-accuracy-reconcile-note">
                        <Database size={16} />
                        <span>ยังไม่มี application token budget ที่ยืนยันจาก backend จึงไม่แสดงเปอร์เซ็นต์หรือเวลารีเซ็ต</span>
                    </div>
                )}

                <div className="data-accuracy-reconcile-note">
                    <Server size={16} />
                    <span>Provider quota: {usage?.providerQuota?.available ? 'พร้อมใช้งาน' : 'ผู้ให้บริการไม่ได้ส่งข้อมูล quota/reset ผ่าน usage metadata'}</span>
                </div>

                <div className="data-accuracy-section-head compact">
                    <div>
                        <h4>ขอบเขตข้อมูล</h4>
                        <p>จัดเก็บเฉพาะ request ID แบบไม่ซ้ำ, model, token, latency และชื่อ dataset ไม่มี API key, prompt หรือคำตอบเต็ม</p>
                    </div>
                    <button type="button" className="admin-data-btn ghost" onClick={() => refresh(true)} disabled={loading}>
                        <RefreshCw size={15} className={loading ? 'spin-animation' : ''} />
                        รีเฟรช
                    </button>
                </div>
            </div>
        </div>
    );
}
