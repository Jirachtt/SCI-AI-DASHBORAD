import { Fragment, createElement, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import AccessDenied from '../components/AccessDenied';
import { getStudentListSync } from '../services/studentDataService';
import {
    ensureSharedDashboardData,
    onSharedDashboardDataChange,
} from '../services/sharedDashboardDataService';
import { getAllAlerts } from '../utils/alerts';
import { ALERT_SOURCE_META, fetchUniversityAlerts } from '../services/alertDataService';
import {
    AlertTriangle, Bell, ShieldAlert, Info, ArrowLeft, Filter,
    GraduationCap, Wallet, Microscope, Target, RefreshCw, CheckCircle, Search
} from 'lucide-react';
import ExportPDFButton from '../components/ExportPDFButton';
import { legacyColorToVar, themeGradient } from '../utils/themeTokens';

const SEVERITY_META = {
    critical: { label: 'วิกฤต', color: 'var(--accent-danger)', bg: 'color-mix(in srgb, var(--accent-danger) 12%, transparent)', Icon: ShieldAlert },
    warning: { label: 'เฝ้าระวัง', color: 'var(--accent-warning)', bg: 'color-mix(in srgb, var(--accent-warning) 12%, transparent)', Icon: AlertTriangle },
    info: { label: 'ติดตาม', color: 'var(--accent-blue)', bg: 'color-mix(in srgb, var(--accent-blue) 12%, transparent)', Icon: Info },
};

const DOMAIN_ICON = {
    'นักศึกษา': GraduationCap,
    'การสำเร็จการศึกษา': GraduationCap,
    'งบประมาณ': Wallet,
    'การวิจัย': Microscope,
    'ยุทธศาสตร์ (OKR)': Target,
};

const ALERT_DATASET_IDS = [
    'dashboard_summary',
    'student_stats',
    'graduation',
    'science_budget',
    'research',
    'strategic',
];

export default function AlertCenterPage() {
    const { user } = useAuth();
    const [alertDataVersion, setAlertDataVersion] = useState(0);
    const [loading, setLoading] = useState(true);
    const [studentCount, setStudentCount] = useState(() => getStudentListSync().length);
    const [severityFilter, setSeverityFilter] = useState('all');
    const [domainFilter, setDomainFilter] = useState('all');
    const [sourceFilter, setSourceFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [externalAlerts, setExternalAlerts] = useState([]);
    const [expanded, setExpanded] = useState(null);

    useEffect(() => {
        let active = true;
        const refreshFromSharedData = () => {
            if (!active) return;
            setStudentCount(getStudentListSync().length);
            setAlertDataVersion(t => t + 1);
            setLoading(false);
        };
        ensureSharedDashboardData(ALERT_DATASET_IDS)
            .then(refreshFromSharedData)
            .catch(error => {
                if (!active) return;
                console.warn('[AlertCenterPage] shared alert data unavailable:', error?.message || error);
                refreshFromSharedData();
            });
        const unsub = onSharedDashboardDataChange(event => {
            if (!ALERT_DATASET_IDS.includes(event?.id)) return;
            refreshFromSharedData();
        });
        return () => { active = false; unsub && unsub(); };
    }, []);

    useEffect(() => {
        let active = true;
        fetchUniversityAlerts({ severity: severityFilter, domain: domainFilter, source: sourceFilter })
            .then(result => {
                if (!active) return;
                setExternalAlerts(result.alerts || []);
            })
            .catch(error => {
                if (!active) return;
                console.warn('[AlertCenterPage] external alert API unavailable:', error?.message || error);
                setExternalAlerts([]);
            });
        return () => { active = false; };
    }, [severityFilter, domainFilter, sourceFilter]);

    // Recompute whenever any shared dashboard dataset used by alert rules updates.
    const alerts = useMemo(() => {
        void alertDataVersion;
        return [...getAllAlerts(), ...externalAlerts];
    }, [externalAlerts, alertDataVersion]);
    const summary = useMemo(() => ({
        total: alerts.length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        warning: alerts.filter(a => a.severity === 'warning').length,
        info: alerts.filter(a => a.severity === 'info').length,
    }), [alerts]);

    const domains = useMemo(() => {
        const s = new Set(alerts.map(a => a.domain));
        return ['all', ...Array.from(s)];
    }, [alerts]);

    const sources = useMemo(() => {
        const s = new Set(alerts.map(a => a.source).filter(Boolean));
        return ['all', ...Array.from(s)];
    }, [alerts]);

    const filtered = useMemo(() => alerts.filter(a => {
        if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
        if (domainFilter !== 'all' && a.domain !== domainFilter) return false;
        if (sourceFilter !== 'all' && a.source !== sourceFilter) return false;
        const q = search.trim().toLowerCase();
        if (q) {
            const haystack = [a.title, a.detail, a.domain, a.metric, a.sourceLabel]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            if (!haystack.includes(q)) return false;
        }
        return true;
    }), [alerts, severityFilter, domainFilter, sourceFilter, search]);

    if (!canAccess(user?.role, 'alert_center')) return <AccessDenied />;

    return (
        <div>
            <Link to="/dashboard" className="back-button">
                <ArrowLeft size={16} /> กลับหน้าหลัก
            </Link>

            <div className="section-header">
                <div className="section-header-icon" style={{ background: 'linear-gradient(135deg, var(--accent-danger), var(--accent-warning))' }}>
                    <Bell size={22} color="var(--text-on-accent)" />
                </div>
                <div>
                    <h2>ศูนย์แจ้งเตือน (Alert Center)</h2>
                    <p>
                        Early-warning dashboard — รวมสัญญาณเตือนจากทุกโดเมนไว้ในหน้าเดียว
                        {' '}• ข้อมูลนักศึกษา {studentCount.toLocaleString('th-TH')} คน
                    </p>
                </div>
                <div className="section-header-actions">
                    <ExportPDFButton title="ศูนย์แจ้งเตือน (Alert Center)" />
                    <button
                        className="dashboard-header-action admin-refresh-btn"
                        onClick={() => {
                            setLoading(true);
                            ensureSharedDashboardData(ALERT_DATASET_IDS)
                                .catch(error => {
                                    console.warn('[AlertCenterPage] manual alert recompute failed:', error?.message || error);
                                })
                                .finally(() => {
                                    setStudentCount(getStudentListSync().length);
                                    setAlertDataVersion(t => t + 1);
                                    setLoading(false);
                                });
                        }}
                        aria-label="คำนวณใหม่"
                        data-tooltip="คำนวณใหม่"
                    >
                        <RefreshCw size={15} /> รีเฟรช
                    </button>
                </div>
            </div>

            {/* Summary */}
            <div className="stats-grid alert-summary-grid" style={{ marginTop: 12 }}>
                <SummaryCard label="แจ้งเตือนทั้งหมด" value={summary.total} color="var(--accent-purple)" Icon={Bell} />
                <SummaryCard label="วิกฤต (Critical)" value={summary.critical} color="var(--accent-danger)" Icon={ShieldAlert} pulse={summary.critical > 0} />
                <SummaryCard label="เฝ้าระวัง (Warning)" value={summary.warning} color="var(--accent-warning)" Icon={AlertTriangle} />
                <SummaryCard label="ติดตาม (Info)" value={summary.info} color="var(--accent-blue)" Icon={Info} />
            </div>

            {/* Filters */}
            <div className="filter-bar" style={{ marginTop: 24 }}>
                <label><Filter size={14} style={{ marginRight: 6, verticalAlign: -2 }} />ระดับ:</label>
                <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}>
                    <option value="all">ทั้งหมด</option>
                    <option value="critical">วิกฤต</option>
                    <option value="warning">เฝ้าระวัง</option>
                    <option value="info">ติดตาม</option>
                </select>
                <label>โดเมน:</label>
                <select value={domainFilter} onChange={e => setDomainFilter(e.target.value)}>
                    {domains.map(d => <option key={d} value={d}>{d === 'all' ? 'ทุกโดเมน' : d}</option>)}
                </select>
                <label>แหล่งข้อมูล:</label>
                <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
                    {sources.map(s => (
                        <option key={s} value={s}>
                            {s === 'all' ? 'ทุกแหล่งข้อมูล' : (ALERT_SOURCE_META[s]?.label || s)}
                        </option>
                    ))}
                </select>
                <div className="filter-search">
                    <Search size={14} />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="ค้นหาแจ้งเตือน/ตัวชี้วัด"
                    />
                </div>
                <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    แสดง {filtered.length} / {alerts.length} รายการ
                </span>
            </div>
            {/* Alert list */}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {loading ? (
                    <div className="admin-empty-state">
                        <RefreshCw size={40} className="spin-animation" />
                        <p>กำลังคำนวณสัญญาณเตือน...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="admin-empty-state">
                        <CheckCircle size={48} color="var(--accent-success)" />
                        <h3>ไม่มีสัญญาณเตือนที่ตรงเงื่อนไข</h3>
                        <p>ปลอดภัยดี — หรือลองเปลี่ยนตัวกรอง</p>
                    </div>
                ) : filtered.map((a, idx) => {
                    const meta = SEVERITY_META[a.severity];
                    const DomainIcon = DOMAIN_ICON[a.domain] || Info;
                    const isOpen = expanded === a.id;
                    return (
                        <div
                            key={a.id + idx}
                            className="chart-card animate-in"
                            style={{ padding: 20, borderLeft: `4px solid ${meta.color}` }}
                        >
                            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                                <div style={{
                                    width: 44, height: 44, borderRadius: 12,
                                    background: meta.bg, color: meta.color,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <meta.Icon size={22} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
                                        <span style={{
                                            fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em',
                                            padding: '3px 10px', borderRadius: 999,
                                            background: meta.bg, color: meta.color
                                        }}>
                                            {meta.label.toUpperCase()}
                                        </span>
                                        <span style={{
                                            fontSize: '0.75rem', color: 'var(--text-muted)',
                                            display: 'inline-flex', alignItems: 'center', gap: 4
                                        }}>
                                            <DomainIcon size={12} /> {a.domain}
                                        </span>
                                        {a.sourceLabel && (
                                            <span style={{
                                                fontSize: '0.72rem',
                                                color: a.sourceMode === 'live' ? 'var(--accent-success)' : 'var(--text-muted)',
                                                padding: '3px 9px',
                                                borderRadius: 999,
                                                border: '1px solid color-mix(in srgb, var(--accent-purple) 24%, transparent)',
                                                background: 'color-mix(in srgb, var(--accent-purple) 8%, transparent)'
                                            }}>
                                                {a.sourceLabel}
                                            </span>
                                        )}
                                    </div>
                                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{a.title}</h3>
                                    <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                        {a.detail}
                                    </p>
                                    {a.suggestedAction && (
                                        <div style={{
                                            marginTop: 10, padding: '8px 12px',
                                            background: 'color-mix(in srgb, var(--accent-success) 8%, transparent)',
                                            borderLeft: '3px solid var(--accent-success)',
                                            borderRadius: 6, fontSize: '0.85rem'
                                        }}>
                                            <strong style={{ color: 'var(--accent-success)' }}>แนวทาง:</strong> {a.suggestedAction}
                                        </div>
                                    )}
                                    {a.data && a.data.length > 0 && (
                                        <div style={{ marginTop: 10 }}>
                                            <button
                                                className="admin-refresh-btn"
                                                onClick={() => setExpanded(isOpen ? null : a.id)}
                                                style={{ fontSize: '0.8rem' }}
                                            >
                                                {isOpen ? 'ซ่อนรายการ' : `ดูรายละเอียด (${a.data.length} รายการ)`}
                                            </button>
                                            {isOpen && <AlertDetailList items={a.data} />}
                                        </div>
                                    )}
                                </div>
                                <div style={{ textAlign: 'right', minWidth: 100 }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ค่าที่พบ</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: meta.color }}>
                                        {typeof a.value === 'number' ? a.value.toLocaleString('th-TH') : a.value}
                                    </div>
                                    {a.target != null && (
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                            เป้า: {a.target.toLocaleString?.('th-TH') || a.target}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function SummaryCard({ label, value, color, Icon: IconComponent, pulse }) {
    const accent = legacyColorToVar(color);
    return (
        <div className={`stat-card alert-summary-card animate-in ${pulse ? 'pulse' : ''}`}>
            <div className="stat-card-header">
                <div className="stat-card-icon" style={{ background: themeGradient(color) }}>
                    {createElement(IconComponent, { size: 20, color: 'var(--text-on-accent)' })}
                </div>
            </div>
            <div className="stat-card-value" style={{ color: accent }}>{value}</div>
            <div className="stat-card-label">{label}</div>
        </div>
    );
}

function AlertDetailList({ items }) {
    const isStudent = items[0]?.id && items[0]?.name;
    const groupedStudents = useMemo(() => {
        if (!isStudent) return [];
        const groups = [];
        items.forEach(student => {
            const major = student.major || 'ไม่ระบุสาขา';
            let group = groups.find(entry => entry.major === major);
            if (!group) {
                group = { major, students: [] };
                groups.push(group);
            }
            group.students.push(student);
        });
        return groups.map(group => ({
            ...group,
            minGpa: Math.min(...group.students.map(student => Number(student.gpa) || 99)),
        }));
    }, [isStudent, items]);

    return (
        <div className="data-table-container" style={{ marginTop: 10 }}>
            <table className="data-table">
                <thead>
                    <tr>
                        {isStudent ? (
                            <>
                                <th>รหัส</th>
                                <th>ชื่อ-นามสกุล</th>
                                <th>สาขา</th>
                                <th>ชั้นปี</th>
                                <th>GPA</th>
                            </>
                        ) : (
                            <>
                                <th>รหัส</th>
                                <th>หัวข้อ</th>
                                <th>ภาควิชา</th>
                                <th>สถานะ</th>
                            </>
                        )}
                    </tr>
                </thead>
                <tbody>
                    {isStudent ? groupedStudents.map(group => (
                        <Fragment key={group.major}>
                            <tr className="alert-major-group-row">
                                <td colSpan={5}>
                                    <span>{group.major}</span>
                                    <strong>{group.students.length.toLocaleString('th-TH')} คน</strong>
                                    <em>GPA ต่ำสุด {group.minGpa.toFixed(2)}</em>
                                </td>
                            </tr>
                            {group.students.map((it, i) => (
                                <tr key={`${group.major}-${it.id || i}`}>
                                    <td>{it.id}</td>
                                    <td>{it.prefix || ''} {it.name}</td>
                                    <td>{it.major}</td>
                                    <td>{it.year}</td>
                                    <td style={{ color: it.gpa < 2 ? 'var(--accent-danger)' : 'var(--accent-warning)', fontWeight: 800 }}>
                                        {Number(it.gpa)?.toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </Fragment>
                    )) : items.map((it, i) => (
                        <tr key={i}>
                            <td>{it.id}</td>
                            <td>{it.title}</td>
                            <td>{it.dept}</td>
                            <td>{it.status}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
