import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import AccessDenied from '../components/AccessDenied';
import {
    AlertCircle,
    ArrowLeft,
    CalendarDays,
    CheckCircle2,
    Clock,
    ExternalLink,
    Filter,
    GraduationCap,
    MapPin,
    Sparkles,
    Users,
} from 'lucide-react';
import ExportPDFButton from '../components/ExportPDFButton';
import MjuConnectedPagePanel from '../components/MjuConnectedPagePanel';
import useDashboardDataset from '../hooks/useDashboardDataset';
import {
    formatScienceActivityDate,
    getRecommendedScienceActivities,
    getScienceActivitySummary,
    monthKeyFromDate,
    sumScienceActivityHours,
} from '../data/scienceActivitiesData';
import { getMjuLinkedUserAcademicProfile } from '../services/mjuLinkedUserDataService';

const STATUS_META = {
    open: { label: 'เปิดลงทะเบียน', className: 'open' },
    nearly_full: { label: 'ใกล้เต็ม', className: 'warning' },
    full: { label: 'เต็มแล้ว', className: 'danger' },
    closed: { label: 'ปิดรับแล้ว', className: 'muted' },
    completed: { label: 'เสร็จแล้ว', className: 'muted' },
};

const TYPE_COLORS = {
    รับน้อง: '#00a651',
    ศิลปวัฒนธรรม: '#db2777',
    วิชาการ: '#2563eb',
    จิตอาสา: '#d97706',
    กีฬา: '#7c3aed',
};

function eventMonthKey(event) {
    return monthKeyFromDate(event.startDate);
}

function capacityPercent(event) {
    return event.capacity ? Math.min(100, Math.round((event.registeredCount / event.capacity) * 100)) : 0;
}

function eventStatusMeta(event) {
    return STATUS_META[event.status] || STATUS_META.open;
}

export default function StudentLifePage() {
    const { user } = useAuth();
    const [activeWindow, setActiveWindow] = useState('thisMonth');
    const { data: studentLifeData } = useDashboardDataset('student_life');

    const accessAllowed = canAccess(user?.role, 'student_life');
    const summary = getScienceActivitySummary();
    const linkedProfile = getMjuLinkedUserAcademicProfile(user);
    const activityHours = linkedProfile.isMjuLinked
        ? linkedProfile.activity
        : (studentLifeData?.activityHours || summary.requirement);
    const requirement = summary.requirement;
    const targetHours = Number(activityHours.targetHours ?? activityHours.target ?? requirement.targetHours);
    const completedHours = Number(activityHours.completedHours ?? activityHours.completed ?? requirement.completedHours);
    const events = (Array.isArray(studentLifeData?.scienceActivities) && studentLifeData.scienceActivities.length
        ? studentLifeData.scienceActivities
        : summary.all)
        .filter(event => event.facultyHours)
        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    const missingHours = Math.max(0, targetHours - completedHours);
    const currentKey = summary.currentKey;
    const nextKey = summary.nextKey;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisMonthEvents = events.filter(event => eventMonthKey(event) === currentKey);
    const nextMonthEvents = events.filter(event => eventMonthKey(event) === nextKey);
    const upcomingEvents = events.filter(event => new Date(`${event.startDate}T00:00:00+07:00`) >= today);
    const filteredEvents = activeWindow === 'thisMonth'
        ? thisMonthEvents
        : activeWindow === 'nextMonth'
            ? nextMonthEvents
            : events;
    const recommendation = getRecommendedScienceActivities(missingHours, new Date(), events);

    const typeSummary = Object.entries(events.reduce((acc, event) => {
        const key = event.type || 'อื่นๆ';
        acc[key] = acc[key] || { type: key, count: 0, hours: 0, color: TYPE_COLORS[key] || '#64748b' };
        acc[key].count += 1;
        acc[key].hours += Number(event.hours || 0);
        return acc;
    }, {})).map(([, item]) => item);
    const maxTypeHours = Math.max(...typeSummary.map(item => item.hours), 1);

    const kpis = [
        { label: 'กิจกรรมเดือนนี้', value: thisMonthEvents.length, detail: summary.currentMonthLabel, icon: CalendarDays, color: '#00a651' },
        { label: 'กิจกรรมเดือนหน้า', value: nextMonthEvents.length, detail: summary.nextMonthLabel, icon: Sparkles, color: '#7c3aed' },
        { label: 'ชั่วโมงที่เปิดให้เก็บ', value: sumScienceActivityHours(upcomingEvents), detail: 'รับชั่วโมงคณะวิทยาศาสตร์', icon: Clock, color: '#2563eb' },
        { label: 'ยังขาดเพื่อครบเกณฑ์', value: missingHours, detail: `${completedHours}/${targetHours} ชั่วโมง`, icon: GraduationCap, color: missingHours > 0 ? '#d97706' : '#059669' },
    ];

    if (!accessAllowed) return <AccessDenied />;

    return (
        <div className="science-activity-page">
            <Link to="/dashboard" className="back-button">
                <ArrowLeft size={16} /> กลับหน้าหลัก
            </Link>

            <div className="section-header">
                <div className="section-header-icon" style={{ background: 'linear-gradient(135deg, #00a651, #2E86AB)' }}>
                    <CalendarDays size={22} color="#fff" />
                </div>
                <div>
                    <h2>กิจกรรมคณะวิทยาศาสตร์</h2>
                    <p>Science Faculty Activity Hub — ใช้ชั่วโมงกิจกรรมของคณะวิทยาศาสตร์เป็นหลัก</p>
                </div>
                <div className="section-header-actions">
                    <ExportPDFButton title="กิจกรรมคณะวิทยาศาสตร์" />
                </div>
            </div>

            <MjuConnectedPagePanel
                domains={['profile', 'activities']}
                title="ข้อมูลกิจกรรมจากบัญชี MJU"
                description="ชั่วโมงกิจกรรมรายบุคคลต้องมาจาก MJU Activity และใช้ได้เฉพาะเจ้าของข้อมูลหรือผู้มีสิทธิ์เท่านั้น"
                compact
            />

            {linkedProfile.isMjuLinked && (
                <section className="science-activity-user-link">
                    <CheckCircle2 size={16} />
                    <span>
                        เชื่อมชั่วโมงกิจกรรมของ {linkedProfile.identityLabel} จาก MJU Account · {activityHours.source}
                    </span>
                </section>
            )}

            <section className="science-activity-hero">
                <div>
                    <span className="science-activity-kicker"><CheckCircle2 size={15} /> ข้อมูลกิจกรรมรับชั่วโมงคณะ</span>
                    <h3>ปฏิทินกิจกรรมเดือนนี้และเดือนหน้า พร้อมชั่วโมงที่นำไปใช้ตรวจจบได้</h3>
                    <p>
                        หน้านี้แยกบทบาทจากหน้าตรวจสอบจบ: ใช้สำหรับดูว่าเดือนนี้/เดือนหน้าคณะวิทยาศาสตร์มีกิจกรรมอะไร
                        ได้กี่ชั่วโมง และควรเข้าร่วมกิจกรรมไหนเพื่อเติมชั่วโมงให้ครบ
                    </p>
                </div>
                <div className="science-activity-hero-panel">
                    <span>{requirement.scope}</span>
                    <strong>{completedHours}/{targetHours} ชม.</strong>
                    <small>อัปเดตล่าสุด {requirement.lastUpdated}</small>
                </div>
            </section>

            <div className="science-activity-kpi-grid">
                {kpis.map((item) => {
                    const Icon = item.icon;
                    return (
                        <article key={item.label} className="science-activity-kpi-card">
                            <div className="science-activity-kpi-icon" style={{ color: item.color, background: `${item.color}18` }}>
                                <Icon size={20} />
                            </div>
                            <div>
                                <strong style={{ color: item.color }}>{item.value.toLocaleString('th-TH')}</strong>
                                <span>{item.label}</span>
                                <small>{item.detail}</small>
                            </div>
                        </article>
                    );
                })}
            </div>

            <div className="science-activity-layout">
                <section className="chart-card science-activity-calendar">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">ปฏิทินกิจกรรมคณะวิทยาศาสตร์</div>
                            <div className="chart-card-subtitle">เฉพาะกิจกรรมที่นับชั่วโมงคณะวิทยาศาสตร์</div>
                        </div>
                        <div className="science-activity-tabs" aria-label="ตัวกรองกิจกรรม">
                            {[
                                { id: 'thisMonth', label: 'เดือนนี้' },
                                { id: 'nextMonth', label: 'เดือนหน้า' },
                                { id: 'all', label: 'ทั้งหมด' },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    className={activeWindow === tab.id ? 'active' : ''}
                                    onClick={() => setActiveWindow(tab.id)}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="science-activity-event-list">
                        {filteredEvents.length === 0 ? (
                            <div className="science-activity-empty">
                                <Filter size={24} />
                                ยังไม่มีกิจกรรมในช่วงเวลานี้
                            </div>
                        ) : filteredEvents.map(event => {
                            const status = eventStatusMeta(event);
                            const typeColor = TYPE_COLORS[event.type] || '#64748b';
                            const capacity = capacityPercent(event);
                            return (
                                <article key={event.id} className="science-activity-event-card">
                                    <div className="science-activity-event-date">
                                        <strong>{new Date(`${event.startDate}T00:00:00+07:00`).getDate()}</strong>
                                        <span>{formatScienceActivityDate(event).split(' ')[1]}</span>
                                    </div>
                                    <div className="science-activity-event-main">
                                        <div className="science-activity-event-title-row">
                                            <h3>{event.title}</h3>
                                            <span className={`science-activity-status ${status.className}`}>{status.label}</span>
                                        </div>
                                        <p>{event.description}</p>
                                        <div className="science-activity-event-meta">
                                            <span style={{ color: typeColor }}>{event.type}</span>
                                            <span><Clock size={14} /> {event.hours} ชม.</span>
                                            <span><CalendarDays size={14} /> {formatScienceActivityDate(event)} · {event.time}</span>
                                            <span><MapPin size={14} /> {event.location}</span>
                                            <span><Users size={14} /> {event.registeredCount}/{event.capacity} คน</span>
                                        </div>
                                        <div className="science-activity-capacity">
                                            <span style={{ width: `${capacity}%`, background: typeColor }} />
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>

                <aside className="science-activity-side">
                    <section className="chart-card science-activity-recommend">
                        <div className="chart-card-title">กิจกรรมแนะนำเติมชั่วโมง</div>
                        <div className="chart-card-subtitle">คัดจากกิจกรรมคณะวิทยาศาสตร์ที่กำลังจะจัด</div>
                        <div className="science-activity-missing">
                            <span>ยังขาด</span>
                            <strong>{missingHours}</strong>
                            <span>ชั่วโมง</span>
                        </div>
                        <div className="science-activity-recommend-list">
                            {recommendation.selected.map(event => (
                                <div key={event.id} className="science-activity-recommend-item">
                                    <div>
                                        <strong>{event.title}</strong>
                                        <span>{formatScienceActivityDate(event)} · {event.type}</span>
                                    </div>
                                    <em>+{event.hours} ชม.</em>
                                </div>
                            ))}
                        </div>
                        <div className={`science-activity-complete-note ${recommendation.willComplete ? 'complete' : ''}`}>
                            {recommendation.willComplete
                                ? `เข้าร่วมชุดนี้ได้ ${recommendation.accumulated} ชม. เพียงพอให้ครบเกณฑ์`
                                : `ชุดนี้ได้ ${recommendation.accumulated} ชม. ยังต้องเพิ่มอีก ${Math.max(0, missingHours - recommendation.accumulated)} ชม.`}
                        </div>
                    </section>

                    <section className="chart-card science-activity-breakdown">
                        <div className="chart-card-title">ชั่วโมงตามประเภทกิจกรรม</div>
                        <div className="science-activity-type-bars">
                            {typeSummary.map(item => (
                                <div key={item.type}>
                                    <div className="science-activity-type-head">
                                        <span>{item.type}</span>
                                        <strong>{item.hours} ชม.</strong>
                                    </div>
                                    <div className="science-activity-type-track">
                                        <span style={{ width: `${Math.round((item.hours / maxTypeHours) * 100)}%`, background: item.color }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </aside>
            </div>

            <section className="data-table-container science-activity-admin-hint">
                <div className="data-table-header">
                    <span className="data-table-title">แนวทางต่อข้อมูลจริง</span>
                    <span className="status-badge normal">พร้อมต่อ API/CSV</span>
                </div>
                <div className="science-activity-hint-body">
                    <AlertCircle size={18} />
                    <span>
                        เมื่อมหาวิทยาลัยหรือคณะมี API/ไฟล์กิจกรรมจริง ให้ส่ง fields: ชื่อกิจกรรม, วันที่, สถานที่,
                        ประเภท, ชั่วโมงคณะวิทยาศาสตร์, จำนวนรับ, สถานะ และ organizer เข้าชุดข้อมูลนี้ได้ทันที
                    </span>
                    <Link to="/dashboard/graduation" className="science-activity-inline-link">
                        ดูผลต่อเงื่อนไขจบ <ExternalLink size={14} />
                    </Link>
                </div>
            </section>
        </div>
    );
}
