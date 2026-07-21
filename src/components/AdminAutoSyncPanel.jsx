import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, Cloud, DatabaseZap, Link as LinkIcon, RefreshCw, ShieldCheck, Wifi } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getDatasetTrustStatus } from '../services/dataAccuracyService';
import {
    DASHBOARD_DATASETS,
    ensureDashboardLiveData,
    getDashboardDatasetMetaSync,
    getDashboardSyncCapabilities,
    onDashboardLiveDataChange,
    refreshDashboardDatasetFromSource,
    refreshDashboardDatasetsFromSources,
} from '../services/dashboardLiveDataService';
import { featureCompletionDataSummary } from '../data/featureCompletionFallbackData';

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
    const [capabilities, setCapabilities] = useState([]);
    const [capabilitiesLoading, setCapabilitiesLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        ensureDashboardLiveData().then(() => {
            if (!mounted) return;
            setMetas(Object.fromEntries(DASHBOARD_DATASETS.map(item => [item.id, getDashboardDatasetMetaSync(item.id)])));
        });
        getDashboardSyncCapabilities()
            .then(items => {
                if (mounted) setCapabilities(items);
            })
            .finally(() => {
                if (mounted) setCapabilitiesLoading(false);
            });
        const unsubscribe = onDashboardLiveDataChange(({ id, meta }) => {
            setMetas(prev => ({ ...prev, [id]: meta }));
        });
        return () => {
            mounted = false;
            unsubscribe();
        };
    }, []);

    const readyCount = useMemo(
        () => DASHBOARD_DATASETS.filter(item => getDatasetTrustStatus(item, metas[item.id]).isReady).length,
        [metas]
    );
    const capabilityMap = useMemo(
        () => Object.fromEntries(capabilities.map(item => [item.dataset, item])),
        [capabilities]
    );
    const configuredIds = useMemo(
        () => capabilities.filter(item => item.configured).map(item => item.dataset),
        [capabilities]
    );
    const sourceSummary = useMemo(() => {
        const official = featureCompletionDataSummary.filter(item =>
            ['real_or_synced', 'file_extract', 'approved_reference'].includes(item.status)
        );
        const waiting = featureCompletionDataSummary.filter(item =>
            !['real_or_synced', 'file_extract', 'approved_reference'].includes(item.status)
        );
        return { official, waiting };
    }, []);

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
    }, [onToast, user]);

    const handleSyncAll = useCallback(async () => {
        if (configuredIds.length === 0) return;
        setSyncingId('all');
        try {
            const result = await refreshDashboardDatasetsFromSources(configuredIds, {
                uid: user?.uid || 'admin',
                who: user?.email || user?.uid || 'admin',
            });
            setMetas(prev => ({ ...prev, ...(result.metas || {}) }));
            onToast?.('success', `Sync แบบ atomic สำเร็จ ${configuredIds.length} ชุดข้อมูล`);
        } catch (err) {
            onToast?.('error', `Sync ทั้งหมดไม่สำเร็จและไม่มีข้อมูลใดถูกเขียน: ${err?.message || 'unknown'}`);
        } finally {
            setSyncingId('');
        }
    }, [configuredIds, onToast, user]);

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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <span className={`admin-data-badge ${readyCount > 0 ? 'live' : 'mock'}`}>
                            {readyCount}/{DASHBOARD_DATASETS.length} verified
                        </span>
                        <button
                            type="button"
                            className="admin-data-btn primary"
                            onClick={handleSyncAll}
                            disabled={Boolean(syncingId) || capabilitiesLoading || configuredIds.length === 0}
                        >
                            <RefreshCw size={14} className={syncingId === 'all' ? 'spin-animation' : ''} />
                            {syncingId === 'all' ? 'กำลังตรวจและ Sync...' : `Sync ที่พร้อมทั้งหมด (${configuredIds.length})`}
                        </button>
                    </div>
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

            <div className="admin-data-status-card" style={{ marginTop: 16 }}>
                <div className="admin-data-status-header">
                    <div className="admin-data-status-icon data-accuracy-icon">
                        <ShieldCheck size={22} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h3>สรุปแหล่งข้อมูลที่ใช้ในระบบ</h3>
                        <p>รวมสถานะข้อมูลจริง/ไฟล์อ้างอิง/ข้อมูลที่ยังรอ API ไว้ในหน้านี้ หน้า Dashboard จะเลือกข้อมูลที่ Sync ล่าสุดก่อน และใช้ชุดข้อมูลในระบบเติมตัวชี้วัดที่ยังรอ endpoint โดยไม่แสดงป้ายแหล่งข้อมูลบนหน้าหลัก</p>
                    </div>
                    <span className="admin-data-badge live">
                        {sourceSummary.official.length}/{featureCompletionDataSummary.length} usable
                    </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginTop: 14 }}>
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: 14, padding: 14, background: 'var(--bg-card)' }}>
                        <h4 style={{ margin: '0 0 10px', color: 'var(--text-primary)', fontSize: '0.98rem' }}>ข้อมูลที่ใช้เป็นหลักได้ตอนนี้</h4>
                        <div style={{ display: 'grid', gap: 8 }}>
                            {sourceSummary.official.map(item => (
                                <div key={item.feature} style={{ padding: 10, borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                                    <div style={{ fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.35 }}>{item.feature}</div>
                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 4 }}>{item.displayStatus}</div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>{item.currentSource}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ border: '1px solid var(--border-color)', borderRadius: 14, padding: 14, background: 'var(--bg-card)' }}>
                        <h4 style={{ margin: '0 0 10px', color: 'var(--text-primary)', fontSize: '0.98rem' }}>ข้อมูลที่ยังต้องเชื่อมต่อเพิ่ม</h4>
                        <div style={{ display: 'grid', gap: 8 }}>
                            {sourceSummary.waiting.map(item => (
                                <div key={item.feature} style={{ padding: 10, borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                                    <div style={{ fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.35 }}>{item.feature}</div>
                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 4 }}>{item.displayStatus}</div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>{item.owner}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="auto-sync-grid">
                {DASHBOARD_DATASETS.map(item => {
                    const meta = metas[item.id] || getDashboardDatasetMetaSync(item.id);
                    const isSyncing = syncingId === item.id;
                    const trust = getDatasetTrustStatus(item, meta);
                    const capability = capabilityMap[item.id] || null;
                    const configured = Boolean(capability?.configured);
                    const validation = meta.validation || meta.syncMeta?.validation || null;
                    const evidence = Array.isArray(meta.sourceEvidence) ? meta.sourceEvidence : [];
                    const latestHash = evidence[0]?.sha256 || '';
                    const needsSetup = !configured;
                    return (
                        <div key={item.id} className="auto-sync-card">
                            <div className="auto-sync-card-head">
                                <div>
                                    <h4>{item.label}</h4>
                                    <p>{item.id}</p>
                                </div>
                                <span className={`admin-data-badge trust ${trust.tone}`}>
                                    {trust.label}
                                </span>
                            </div>

                            <div className="auto-sync-meta">
                                <div><ShieldCheck size={14} /> <span>{trust.description}</span></div>
                                <div><Clock size={14} /> {formatDate(meta.updatedAt)}</div>
                                <div><CheckCircle size={14} /> {meta.rowCount == null ? '-' : `${meta.rowCount.toLocaleString('th-TH')} rows`}</div>
                                <div><LinkIcon size={14} /> <span title={meta.sourceUrl || capability?.sourceUrl || item.source}>{meta.sourceUrl || capability?.sourceUrl || item.source}</span></div>
                                {validation && (
                                    <div><ShieldCheck size={14} /> ผ่าน {validation.checks?.filter(check => check.passed).length || 0}/{validation.checks?.length || 0} reconciliation checks</div>
                                )}
                                {latestHash && (
                                    <div><DatabaseZap size={14} /> <span title={latestHash}>Source SHA-256: {latestHash.slice(0, 12)}...</span></div>
                                )}
                                {meta.usesFallbackCoverage && (
                                    <div>
                                        <DatabaseZap size={14} />
                                        <span title={(meta.fallbackFields || []).join(', ')}>
                                            เติม {meta.fallbackFieldCount || meta.fallbackFields?.length || 0} ช่องข้อมูลจากชุดข้อมูลในระบบ
                                        </span>
                                    </div>
                                )}
                            </div>
                            {needsSetup && (
                                <div className="auto-sync-card-note">
                                    ยังไม่มี endpoint ที่ตรวจสอบได้ ตั้งค่า <strong>{capability?.envKey || `MJU_DASHBOARD_SOURCE_${item.id.toUpperCase()}`}</strong> ฝั่ง Vercel ก่อนเปิด Sync ชุดนี้
                                </div>
                            )}

                            <button
                                type="button"
                                className="admin-data-btn primary auto-sync-button"
                                onClick={() => handleSync(item.id)}
                                disabled={Boolean(syncingId) || !configured || capabilitiesLoading}
                            >
                                <RefreshCw size={14} className={isSyncing ? 'spin-animation' : ''} />
                                {isSyncing ? 'กำลังตรวจและ Sync...' : configured ? 'Sync ตอนนี้' : 'รอตั้งค่า endpoint'}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
