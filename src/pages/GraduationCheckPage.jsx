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
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import AccessDenied from '../components/AccessDenied';
import ExportPDFButton from '../components/ExportPDFButton';
import {
    SCIENCE_ACTIVITY_REQUIREMENT,
    formatScienceActivityDate,
    getRecommendedScienceActivities,
} from '../data/scienceActivitiesData';

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

const pct = (current, required) => Math.min(100, Math.round((Number(current || 0) / Number(required || 1)) * 100));

export default function GraduationCheckPage() {
    const { user } = useAuth();
    if (!canAccess(user?.role, 'graduation_check')) return <AccessDenied />;

    const activityRequirement = SCIENCE_ACTIVITY_REQUIREMENT;
    const missingHours = Math.max(0, activityRequirement.targetHours - activityRequirement.completedHours);
    const recommendation = getRecommendedScienceActivities(missingHours);
    const creditPercent = pct(graduationData.credits.current, graduationData.credits.required);
    const activityPercent = pct(activityRequirement.completedHours, activityRequirement.targetHours);

    return (
        <div className="graduation-check-page">
            <Link to="/dashboard" className="back-button">
                <ArrowLeft size={16} /> กลับหน้าหลัก
            </Link>

            <div className="section-header graduation-check-header">
                <div className="section-header-icon" style={{ background: 'linear-gradient(135deg, #A23B72, #7B2D8E)' }}>
                    <CheckCircle size={22} color="#fff" />
                </div>
                <div>
                    <h2>ตรวจสอบเงื่อนไขการสำเร็จการศึกษา</h2>
                    <p>Requirements Check for Graduation — สรุปสถานะรายนักศึกษาและเชื่อมกับชั่วโมงกิจกรรมคณะ</p>
                </div>
                <div className="section-header-actions">
                    <ExportPDFButton title="graduation_requirements" />
                </div>
            </div>

            <section className="graduation-status-grid">
                <article className="graduation-status-card">
                    <div className="graduation-status-head">
                        <span><Award size={15} /> เกรดเฉลี่ยสะสม (GPAX)</span>
                        <CheckCircle size={20} color="#22c55e" />
                    </div>
                    <strong className="graduation-status-value success">{graduationData.gpa.current.toFixed(2)}</strong>
                    <p>เกณฑ์ขั้นต่ำ {graduationData.gpa.required.toFixed(2)}</p>
                </article>

                <article className="graduation-status-card">
                    <div className="graduation-status-head">
                        <span><BookOpen size={15} /> หน่วยกิตรวม</span>
                        <span className="graduation-mini-badge">{creditPercent}%</span>
                    </div>
                    <strong className="graduation-status-value info">{graduationData.credits.current}/{graduationData.credits.required}</strong>
                    <div className="graduation-progress-track">
                        <span style={{ width: `${creditPercent}%`, background: '#2E86AB' }} />
                    </div>
                    <div className="graduation-mini-list">
                        {graduationData.credits.details.map(item => (
                            <div key={item.name}>
                                <span>{item.status === 'complete' ? '✓' : '○'} {item.name}</span>
                                <strong>{item.current}/{item.required}</strong>
                            </div>
                        ))}
                    </div>
                </article>

                <article className="graduation-status-card">
                    <div className="graduation-status-head">
                        <span><Clock size={15} /> ชั่วโมงกิจกรรมคณะวิทยาศาสตร์</span>
                        <span className="graduation-mini-badge warning">ชั่วโมงคณะ</span>
                    </div>
                    <strong className="graduation-status-value warning">{activityRequirement.completedHours}/{activityRequirement.targetHours}</strong>
                    <div className="graduation-progress-track">
                        <span style={{ width: `${activityPercent}%`, background: '#E91E63' }} />
                    </div>
                    <p>ยังขาด {missingHours} ชั่วโมง เพื่อครบเกณฑ์ {activityRequirement.programLabel}</p>
                </article>
            </section>

            <section className="graduation-activity-bridge">
                <article className="chart-card graduation-activity-card">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">สถานะชั่วโมงกิจกรรมที่ใช้ตรวจจบ</div>
                            <div className="chart-card-subtitle">หน้านี้แสดงเฉพาะความคืบหน้า ส่วนปฏิทินกิจกรรมย้ายไปอยู่หน้า “กิจกรรมคณะวิทยาศาสตร์”</div>
                        </div>
                        <GraduationCap size={24} color="#00a651" />
                    </div>

                    <div className="graduation-activity-summary">
                        <div>
                            <span>ทำแล้ว</span>
                            <strong>{activityRequirement.completedHours} ชม.</strong>
                        </div>
                        <div>
                            <span>เป้าหมาย</span>
                            <strong>{activityRequirement.targetHours} ชม.</strong>
                        </div>
                        <div>
                            <span>ยังขาด</span>
                            <strong>{missingHours} ชม.</strong>
                        </div>
                    </div>

                    <div className="graduation-category-list">
                        {activityRequirement.categoryTargets.map(item => {
                            const percent = pct(item.currentHours, item.requiredHours);
                            return (
                                <div key={item.name} className="graduation-category-row">
                                    <div className="graduation-category-head">
                                        <span>{item.name}</span>
                                        <strong>{item.currentHours}/{item.requiredHours} ชม.</strong>
                                    </div>
                                    <div className="graduation-progress-track">
                                        <span style={{ width: `${percent}%`, background: item.color }} />
                                    </div>
                                    <small>{item.currentEvents}/{item.requiredEvents} กิจกรรม</small>
                                </div>
                            );
                        })}
                    </div>
                </article>

                <article className="chart-card graduation-recommend-card">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">กิจกรรมที่เติมชั่วโมงได้เร็วสุด</div>
                            <div className="chart-card-subtitle">คัดจากกิจกรรมคณะวิทยาศาสตร์ที่กำลังจะจัด</div>
                        </div>
                        <Star size={22} color="#f59e0b" />
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
                    </div>

                    <div className={`graduation-recommend-note ${recommendation.willComplete ? 'complete' : ''}`}>
                        <AlertCircle size={16} />
                        {recommendation.willComplete
                            ? `เข้าร่วมชุดนี้จะได้ ${recommendation.accumulated} ชั่วโมง เพียงพอให้ครบเกณฑ์`
                            : `ชุดนี้ได้ ${recommendation.accumulated} ชั่วโมง ยังขาดอีก ${Math.max(0, missingHours - recommendation.accumulated)} ชั่วโมง`}
                    </div>

                    <Link to="/dashboard/student-life" className="graduation-activity-link">
                        เปิดปฏิทินกิจกรรมคณะ <ChevronRight size={16} />
                    </Link>
                </article>
            </section>
        </div>
    );
}
