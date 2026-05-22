import { useMemo, useState } from 'react';
import { CheckCircle, Clock, Database, Lock, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
    getMjuConnectedDataSummary,
    grantMjuConnectedDataConsent,
} from '../services/mjuConnectedDataService';

const STATUS_LABELS = {
    connected: 'เชื่อมแล้ว',
    partial: 'รอ consent/ข้อมูลเพิ่ม',
    unavailable: 'รอ endpoint จริง',
    unauthorized: 'ไม่มีสิทธิ์',
    error: 'ตรวจไม่ได้',
};

function statusIcon(status) {
    if (status === 'connected') return <CheckCircle size={14} />;
    if (status === 'unauthorized') return <Lock size={14} />;
    if (status === 'unavailable') return <RefreshCw size={14} />;
    return <Clock size={14} />;
}

function formatDate(value) {
    if (!value) return 'ยังไม่พบเวลาอัปเดต';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'ยังไม่พบเวลาอัปเดต';
    return date.toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function MjuConnectedPagePanel({ user: providedUser, compact = false }) {
    const { user: authUser } = useAuth();
    const user = useMemo(() => providedUser || authUser || {}, [providedUser, authUser]);
    const [consentAt, setConsentAt] = useState(user.mjuConsentGrantedAt || user.mjuConnectedConsentAt || '');
    const summary = useMemo(
        () => getMjuConnectedDataSummary(consentAt ? { ...user, mjuConsentGrantedAt: consentAt } : user),
        [consentAt, user],
    );
    const endpointTodo = summary.domains.filter(item => item.status === 'unavailable').slice(0, compact ? 3 : 9);

    const handleConsent = () => {
        setConsentAt(grantMjuConnectedDataConsent(user));
    };

    return (
        <section className={`mju-connected-panel ${compact ? 'compact' : ''}`} aria-label="MJU Connected Data">
            <div className="mju-connected-header">
                <span className="mju-connected-icon"><ShieldCheck size={18} /></span>
                <div>
                    <h3>MJU Connected Data</h3>
                    <p>ข้อมูลที่เชื่อมกับบัญชี MJU ตามสิทธิ์และ consent ของผู้ใช้</p>
                </div>
            </div>

            <div className="mju-page-status-strip">
                <span><CheckCircle size={14} /> {summary.connectedCount} connected</span>
                <span><Clock size={14} /> {summary.partialCount} partial</span>
                <span><Database size={14} /> {summary.unavailableCount} endpointTodo</span>
                <span><Lock size={14} /> {summary.unauthorizedCount} unauthorized</span>
            </div>

            <div className="mju-connected-identity">
                <div>
                    <small>Role / scope</small>
                    <strong>{summary.identity.roleLabel || summary.identity.role}</strong>
                </div>
                <div>
                    <small>MJU status</small>
                    <strong>{summary.identity.mjuVerified ? 'MJU verified' : 'ยังไม่ได้ยืนยันผ่าน MJU'}</strong>
                </div>
                <div>
                    <small>Last updated</small>
                    <strong>{formatDate(summary.identity.connectedAt)}</strong>
                </div>
            </div>

            {!summary.consentGranted && (
                <button type="button" className="mju-consent-button" onClick={handleConsent}>
                    <ShieldCheck size={15} />
                    ยืนยัน consent เพื่อเชื่อมข้อมูลส่วนบุคคลเมื่อ endpoint พร้อม
                </button>
            )}

            <div className="mju-connected-domain-list">
                {summary.domains.slice(0, compact ? 4 : summary.domains.length).map(item => (
                    <div key={item.id} className={`mju-connected-domain ${item.status}`}>
                        <span className="mju-connected-domain-icon">{statusIcon(item.status)}</span>
                        <div>
                            <strong>{item.label}</strong>
                            <small>{STATUS_LABELS[item.status] || item.status} · {item.source} · scope={item.scope}</small>
                            <p>{item.message}</p>
                        </div>
                    </div>
                ))}
            </div>

            {endpointTodo.length > 0 && (
                <div className="mju-endpoint-todo">
                    <strong>Endpoint ที่ยังรอเชื่อมต่อจริง</strong>
                    {endpointTodo.map(item => (
                        <span key={item.id}>{item.source}: {item.endpointTodo}</span>
                    ))}
                </div>
            )}
        </section>
    );
}
