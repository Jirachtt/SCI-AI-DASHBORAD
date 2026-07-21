import { Link } from 'react-router-dom';
import {
    AlertCircle,
    ArrowLeft,
    Award,
    BookOpen,
    CalendarDays,
    CheckCircle,
    ChevronRight,
    Clock,
    GraduationCap,
    Star,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import AccessDenied from '../components/AccessDenied';
import ExportPDFButton from '../components/ExportPDFButton';
import {
    SCIENCE_ACTIVITY_REQUIREMENT,
    formatScienceActivityDate,
    getRecommendedScienceActivities,
} from '../data/scienceActivitiesData';
import { getMjuLinkedUserAcademicProfile } from '../services/mjuLinkedUserDataService';
import MjuConnectedPagePanel from '../components/MjuConnectedPagePanel';

const graduationData = {
    gpa: { current: 3.15, required: 1.75 },
    credits: {
        current: 112,
        required: 130,
        details: [
            { name: 'หมวดวิชาศึกษาทั่วไป', current: 30, required: 30, status: 'complete' },
            { name: 'หมวดวิชาเฉพาะ', current: 76, required: 94, status: 'incomplete' },
            { name: 'หมวดวิชาเลือกเสรี', current: 6, required: 6, status: 'complete' },
        ],
    },
};

const pct = (current, required) => {
    const currentValue = Number(current);
    const requiredValue = Number(required);
    if (!Number.isFinite(currentValue) || !Number.isFinite(requiredValue) || requiredValue <= 0) return null;
    return Math.min(100, Math.round((currentValue / requiredValue) * 100));
};

const displayNumber = (value, digits = 0) => {
    if (value === null || value === undefined || value === '') return '--';
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(digits) : '--';
};

export default function GraduationCheckPage() {
    const { user } = useAuth();
    const [consentAt, setConsentAt] = useState('');
    if (!canAccess(user?.role, 'graduation_check')) return <AccessDenied />;

    const connectedUser = consentAt ? { ...user, mjuConsentGrantedAt: consentAt } : user;
    const linkedProfile = getMjuLinkedUserAcademicProfile(connectedUser);
    const gpaData = linkedProfile.gpa || graduationData.gpa;
    const creditData = linkedProfile.credits || graduationData.credits;
    const activityRequirement = linkedProfile.activity || SCIENCE_ACTIVITY_REQUIREMENT;
    const hasGpa = gpaData.available !== false && Number.isFinite(Number(gpaData.current));
    const hasCredits = creditData.available !== false && Number.isFinite(Number(creditData.current));
    const hasActivity = activityRequirement.available !== false && Number.isFinite(Number(activityRequirement.completedHours));
    const missingHours = hasActivity && Number.isFinite(Number(activityRequirement.targetHours))
        ? Math.max(0, Number(activityRequirement.targetHours) - Number(activityRequirement.completedHours))
        : null;
    const recommendation = hasActivity
        ? getRecommendedScienceActivities(missingHours)
        : { selected: [], accumulated: 0, willComplete: false };
    const creditPercent = pct(creditData.current, creditData.required);
    const activityPercent = pct(activityRequirement.completedHours, activityRequirement.targetHours);
    return (
        <div className="graduation-check-page">
            <Link to="/dashboard" className="back-button">
                <ArrowLeft size={16} /> กลับหน้าหลัก
            </Link>

            <div className="section-header graduation-check-header">
                <div className="section-header-icon" style={{ background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-pink))' }}>
                    <CheckCircle size={22} color="var(--text-on-accent)" />
                </div>
                <div>
                    <h2>ตรวจสอบเงื่อนไขการสำเร็จการศึกษา</h2>
                    <p>Requirements Check for Graduation — สรุปสถานะรายนักศึกษาและเชื่อมกับชั่วโมงกิจกรรมคณะ</p>
                </div>
                <div className="section-header-actions">
                    <ExportPDFButton title="graduation_requirements" />
                </div>
            </div>

            {linkedProfile.isMjuLinked && (
                <MjuConnectedPagePanel
                    user={connectedUser}
                    compact
                    domainIds={['profile', 'grades', 'activities', 'graduation']}
                    onConsentGranted={setConsentAt}
                />
            )}

            <section className="graduation-status-grid">
                <article className="graduation-status-card">
                    <div className="graduation-status-head">
                        <span><Award size={15} /> เกรดเฉลี่ยสะสม (GPAX)</span>
                        {hasGpa
                            ? <CheckCircle size={20} color="var(--accent-success)" />
                            : <AlertCircle size={20} color="var(--accent-warning)" />}
                    </div>
                    <strong className="graduation-status-value success">{displayNumber(gpaData.current, 2)}</strong>
                    <p>{hasGpa
                        ? `เกณฑ์ขั้นต่ำ ${displayNumber(gpaData.required, 2)} · ${gpaData.source}`
                        : gpaData.message}</p>
                </article>

                <article className="graduation-status-card">
                    <div className="graduation-status-head">
                        <span><BookOpen size={15} /> หน่วยกิตรวม</span>
                        <span className="graduation-mini-badge">{creditPercent == null ? 'รอข้อมูล' : `${creditPercent}%`}</span>
                    </div>
                    <strong className="graduation-status-value info">{displayNumber(creditData.current)}/{displayNumber(creditData.required)}</strong>
                    {creditPercent != null && <div className="graduation-progress-track">
                        <span style={{ width: `${creditPercent}%`, background: 'var(--accent-info)' }} />
                    </div>}
                    {Array.isArray(creditData.details) && creditData.details.length > 0 && <div className="graduation-mini-list">
                        {creditData.details.map(item => (
                            <div key={item.name}>
                                <span>{item.status === 'complete' ? '✓' : '○'} {item.name}</span>
                                <strong>{item.current}/{item.required}</strong>
                            </div>
                        ))}
                    </div>}
                    <p>{hasCredits ? creditData.source : creditData.message}</p>
                </article>

                <article className="graduation-status-card">
                    <div className="graduation-status-head">
                        <span><Clock size={15} /> ชั่วโมงกิจกรรมคณะวิทยาศาสตร์</span>
                        <span className="graduation-mini-badge warning">ชั่วโมงคณะ</span>
                    </div>
                    <strong className="graduation-status-value warning">{displayNumber(activityRequirement.completedHours)}/{displayNumber(activityRequirement.targetHours)}</strong>
                    {activityPercent != null && <div className="graduation-progress-track">
                        <span style={{ width: `${activityPercent}%`, background: 'var(--accent-pink)' }} />
                    </div>}
                    <p>{hasActivity
                        ? `ยังขาด ${missingHours} ชั่วโมง เพื่อครบเกณฑ์ ${activityRequirement.programLabel} · ${activityRequirement.source}`
                        : activityRequirement.message}</p>
                </article>
            </section>

            <section className="graduation-activity-bridge">
                <article className="chart-card graduation-activity-card">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">สถานะชั่วโมงกิจกรรมที่ใช้ตรวจจบ</div>
                            <div className="chart-card-subtitle">หน้านี้แสดงเฉพาะความคืบหน้า ส่วนปฏิทินกิจกรรมย้ายไปอยู่หน้า “กิจกรรมคณะวิทยาศาสตร์”</div>
                        </div>
                        <GraduationCap size={24} color="var(--accent-success)" />
                    </div>

                    <div className="graduation-activity-summary">
                        <div>
                            <span>ทำแล้ว</span>
                            <strong>{displayNumber(activityRequirement.completedHours)} ชม.</strong>
                        </div>
                        <div>
                            <span>เป้าหมาย</span>
                            <strong>{displayNumber(activityRequirement.targetHours)} ชม.</strong>
                        </div>
                        <div>
                            <span>ยังขาด</span>
                            <strong>{displayNumber(missingHours)} ชม.</strong>
                        </div>
                    </div>

                    <div className="graduation-category-list">
                        {Array.isArray(activityRequirement.categoryTargets) && activityRequirement.categoryTargets.length > 0 ? activityRequirement.categoryTargets.map(item => {
                            const percent = pct(item.currentHours, item.requiredHours);
                            return (
                                <div key={item.name} className="graduation-category-row">
                                    <div className="graduation-category-head">
                                        <span>{item.name}</span>
                                        <strong>{item.currentHours}/{item.requiredHours} ชม.</strong>
                                    </div>
                                    <div className="graduation-progress-track">
                                        <span style={{ width: `${percent || 0}%`, background: item.color }} />
                                    </div>
                                    <small>{item.currentEvents}/{item.requiredEvents} กิจกรรม</small>
                                </div>
                            );
                        }) : (
                            <div className="science-activity-empty">
                                <AlertCircle size={22} />
                                {activityRequirement.message || 'ยังไม่พบรายละเอียดกิจกรรมจาก MJU Activity'}
                            </div>
                        )}
                    </div>
                </article>

                <article className="chart-card graduation-recommend-card">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">กิจกรรมที่เติมชั่วโมงได้เร็วสุด</div>
                            <div className="chart-card-subtitle">คัดจากกิจกรรมคณะวิทยาศาสตร์ที่กำลังจะจัด</div>
                        </div>
                        <Star size={22} color="var(--accent-warning)" />
                    </div>

                    <div className="graduation-recommend-list">
                        {recommendation.selected.slice(0, 3).map(event => (
                            <div key={event.id} className="graduation-recommend-item">
                                <div className="graduation-recommend-date">
                                    <CalendarDays size={15} />
                                    <span>{formatScienceActivityDate(event)}</span>
                                </div>
                                <strong>{event.title}</strong>
                                <div>
                                    <span>{event.type}</span>
                                    <em>+{event.hours} ชม.</em>
                                </div>
                            </div>
                        ))}
                        {!hasActivity && (
                            <div className="science-activity-empty">
                                <AlertCircle size={22} />
                                เชื่อม MJU Activity ก่อน ระบบจึงจะแนะนำกิจกรรมตามชั่วโมงที่ขาดจริงได้
                            </div>
                        )}
                    </div>

                    {hasActivity && <div className={`graduation-recommend-note ${recommendation.willComplete ? 'complete' : ''}`}>
                        <AlertCircle size={16} />
                        {recommendation.willComplete
                            ? `เข้าร่วมชุดนี้จะได้ ${recommendation.accumulated} ชั่วโมง เพียงพอให้ครบเกณฑ์`
                            : `ชุดนี้ได้ ${recommendation.accumulated} ชั่วโมง ยังขาดอีก ${Math.max(0, missingHours - recommendation.accumulated)} ชั่วโมง`}
                    </div>}

                    <Link to="/dashboard/student-life" className="graduation-activity-link">
                        เปิดปฏิทินกิจกรรมคณะ <ChevronRight size={16} />
                    </Link>
                </article>
            </section>
        </div>
    );
}
