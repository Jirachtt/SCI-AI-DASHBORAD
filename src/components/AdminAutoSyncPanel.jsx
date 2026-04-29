import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, Cloud, DatabaseZap, Link as LinkIcon, RefreshCw, Wifi } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
    DASHBOARD_DATASETS,
    ensureDashboardLiveData,
    getDashboardDatasetMetaSync,
    onDashboardLiveDataChange,
    refreshDashboardDatasetFromSource,
} from '../services/dashboardLiveDataService';

function formatDate(value) {
    if (!value) return 'ยังไม่ sync';
    try {
        return value.toLocaleString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return 'ยังไม่ sync';
    }
}

export default function AdminAutoSyncPanel({ onToast }) {
    const { user } = useAuth();
    const [metas, setMetas] = useState(() => Object.fromEntries(
        DASHBOARD_DATASETS.map(item => [item.id, getDashboardDatasetMetaSync(item.id)])
    ));
    const [syncingId, setSyncingId] = useState('');

    useEffect(() => {
        let mounted = true;
        ensureDashboardLiveData().then(() => {
            if (!mounted) return;
            setMetas(Object.fromEntries(DASHBOARD_DATASETS.map(item => [item.id, getDashboardDatasetMetaSync(item.id)])));
        });
        const unsubscribe = onDashboardLiveDataChange(({ id, meta }) => {
            setMetas(prev => ({ ...prev, [id]: meta }));
        });
        return () => {
            mounted = false;
            unsubscribe();
        };
    }, []);

    const liveCount = useMemo(
        () => DASHBOARD_DATASETS.filter(item => metas[item.id]?.isLive).length,
        [metas]
    );

    const handleSync = useCallback(async (id) => {
        setSyncingId(id);
        try {
            const meta = await refreshDashboardDatasetFromSource(id, {
                uid: user?.uid || 'admin',
                who: user?.email || user?.uid || 'admin',
            });
            setMetas(prev => ({ ...prev, [id]: meta }));
            onToast?.('success', `Sync ${id} สำเร็จ`);
        } catch (err) {
            onToast?.('error', `Sync ${id} ไม่สำเร็จ: ${err?.message || 'unknown'}`);
        } finally {
            setSyncingId('');
        }
    }, [onToast, user?.email, user?.uid]);

    return (
        <div className="admin-data-section">
            <div className="admin-data-status-card auto-sync-hero">
                <div className="admin-data-status-header">
                    <div className="admin-data-status-icon auto-sync">
                        <DatabaseZap size={22} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h3>Auto Sync จาก MJU Dashboard / API</h3>
                        <p>ทุกหน้าและ AI อ่านจาก Firestore realtime cache เดียวกัน เมื่อข้อมูล sync เข้ามา ทุกเครื่องจะเห็นข้อมูลล่าสุดทันที</p>
                    </div>
                    <span className={`admin-data-badge ${liveCount > 0 ? 'live' : 'mock'}`}>
                        {liveCount}/{DASHBOARD_DATASETS.length} live
                    </span>
                </div>

                <div className="auto-sync-flow" aria-label="MJU auto sync flow">
                    <div><Cloud size={16} /> MJU API</div>
                    <span />
                    <div><DatabaseZap size={16} /> Firestore</div>
                    <span />
                    <div><Wifi size={16} /> Web + AI</div>
                </div>

                <div className="admin-data-meta-row auto-sync-note">
                    <AlertTriangle size={15} />
                    ถ้าเป็นข้อมูลภายในที่ต้องใช้สิทธิ์ ต้องตั้งค่า endpoint/API token ฝั่ง Vercel หรือ Cloud Function เท่านั้น ห้ามใส่ secret ไว้ในหน้าเว็บ
                </div>
            </div>

            <div className="auto-sync-grid">
                {DASHBOARD_DATASETS.map(item => {
                    const meta = metas[item.id] || getDashboardDatasetMetaSync(item.id);
                    const isSyncing = syncingId === item.id;
                    const needsApi = !meta.isLive && item.syncMode === 'api';
                    const badgeLabel = meta.isLive ? 'Live' : needsApi ? 'ต้องใช้ API' : 'Fallback';
                    return (
                        <div key={item.id} className="auto-sync-card">
                            <div className="auto-sync-card-head">
                                <div>
                                    <h4>{item.label}</h4>
                                    <p>{item.id}</p>
                                </div>
                                <span className={`admin-data-badge ${meta.isLive ? 'live' : 'mock'}`}>
                                    {badgeLabel}
                                </span>
                            </div>

                            <div className="auto-sync-meta">
                                <div><Clock size={14} /> {formatDate(meta.updatedAt)}</div>
                                <div><CheckCircle size={14} /> {meta.rowCount == null ? '-' : `${meta.rowCount.toLocaleString('th-TH')} rows`}</div>
                                <div><LinkIcon size={14} /> <span title={meta.sourceUrl || item.source}>{meta.sourceUrl || item.source}</span></div>
                            </div>
                            {needsApi && (
                                <div className="auto-sync-card-note">
                                    ต้องตั้งค่า MJU_DASHBOARD_SOURCE_{item.id.toUpperCase()} หรือ official API/token ก่อน จึงจะ sync เป็นข้อมูลจริงได้
                                </div>
                            )}

                            <button
                                type="button"
                                className="admin-data-btn primary auto-sync-button"
                                onClick={() => handleSync(item.id)}
                                disabled={Boolean(syncingId)}
                            >
                                <RefreshCw size={14} className={isSyncing ? 'spin-animation' : ''} />
                                {isSyncing ? 'กำลัง Sync...' : 'Sync ตอนนี้'}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
