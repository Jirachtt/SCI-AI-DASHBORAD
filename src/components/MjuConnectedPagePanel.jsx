import { useEffect, useMemo, useState } from 'react';
import { Database, Lock, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getMjuConnectedDataSummary } from '../services/mjuConnectedDataService';

const STATUS_LABELS = {
    connected: 'เชื่อมแล้ว',
    partial: 'รอ consent/ข้อมูลไม่ครบ',
    unavailable: 'รอ API จริง',
    unauthorized: 'ไม่มีสิทธิ์',
    error: 'ผิดพลาด',
};

const STATUS_ICON = {
    connected: ShieldCheck,
    partial: RefreshCw,
    unavailable: Database,
    unauthorized: Lock,
    error: Lock,
};

function formatDate(value) {
    if (!value) return 'ยังไม่มีเวลาอัปเดต';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'ยังไม่มีเวลาอัปเดต';
    return date.toLocaleString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function MjuConnectedPagePanel({
    domains = [],
    title = 'ข้อมูลที่เชื่อมกับบัญชี MJU',
    description = 'ข้อมูลส่วนบุคคลจะแสดงเฉพาะเมื่อมีสิทธิ์และมี endpoint จริงจาก MJU เท่านั้น',
    compact = false,
}) {
    const { user } = useAuth();
    const [version, setVersion] = useState(0);

    useEffect(() => {
        const handleUpdate = () => setVersion(value => value + 1);
        window.addEventListener('sci-mju-consent-updated', handleUpdate);
        return () => window.removeEventListener('sci-mju-consent-updated', handleUpdate);
    }, []);

    const summary = useMemo(() => {
        void version;
        return getMjuConnectedDataSummary(user || {});
    }, [user, version]);
    const selectedDomains = useMemo(() => {
        const wanted = new Set(domains);
        const list = wanted.size
            ? summary.domains.filter(item => wanted.has(item.id))
            : summary.domains;
        return list.slice(0, compact ? 4 : 6);
    }, [compact, domains, summary.domains]);
    const statusChips = [
        { key: 'connected', label: 'เชื่อมแล้ว', value: summary.connectedCount },
        { key: 'partial', label: 'รอ consent/ข้อมูล', value: summary.partialCount },
        { key: 'unavailable', label: 'รอ API', value: summary.unavailableCount },
        { key: 'unauthorized', label: 'นอกสิทธิ์', value: summary.unauthorizedCount },
    ].filter(item => item.value > 0);

    if (!user?.mjuVerified || selectedDomains.length === 0) return null;

    return (
        <section className={`mju-page-panel ${compact ? 'compact' : ''}`} aria-label={title}>
            <div className="mju-page-panel-head">
                <div>
                    <span className="mju-page-kicker">
                        <ShieldCheck size={14} /> MJU Connected
                    </span>
                    <h3>{title}</h3>
                    <p>{description}</p>
                </div>
                <div className="mju-page-identity">
                    <strong>{summary.identity.roleLabel}</strong>
                    <span>{summary.identity.userType || 'user'} · {summary.consentGranted ? 'consent granted' : 'รอ consent'}</span>
                </div>
            </div>

            <div className="mju-page-status-strip">
                {statusChips.map(item => (
                    <span key={item.key} className={`mju-page-status-chip ${item.key}`}>
                        {item.label} <strong>{item.value}</strong>
                    </span>
                ))}
            </div>

            <div className="mju-page-domain-grid">
                {selectedDomains.map(domain => {
                    const Icon = STATUS_ICON[domain.status] || Database;
                    return (
                        <article key={domain.id} className={`mju-page-domain ${domain.status}`}>
                            <div className="mju-page-domain-top">
                                <span className="mju-page-domain-icon"><Icon size={15} /></span>
                                <span className={`mju-page-status ${domain.status}`}>
                                    {STATUS_LABELS[domain.status] || domain.status}
                                </span>
                            </div>
                            <strong>{domain.label}</strong>
                            <p>{domain.message}</p>
                            <div className="mju-page-domain-meta">
                                <span>{domain.source}</span>
                                <span>{formatDate(domain.lastUpdated)}</span>
                            </div>
                            {domain.status === 'unavailable' && domain.endpointTodo ? (
                                <small className="mju-page-domain-todo">รอ endpoint: {domain.endpointTodo}</small>
                            ) : null}
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
