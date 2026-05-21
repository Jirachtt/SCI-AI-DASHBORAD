import { Link } from 'react-router-dom';
import {
    ArrowLeft, Award, BookOpen, CheckCircle2, ExternalLink,
    FileText, GraduationCap, Info, ScrollText, ShieldCheck, XCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import AccessDenied from '../components/AccessDenied';
import ExportPDFButton from '../components/ExportPDFButton';
import {
    academicRulesScope,
    academicRulesSources,
    graduationRules,
    honorsRules,
} from '../data/academicRulesData';
import { legacyColorToVar, themeAlpha } from '../utils/themeTokens';

export default function AcademicRulesPage() {
    const { user } = useAuth();
    if (!canAccess(user?.role, 'academic_rules')) return <AccessDenied />;

    const firstClass = honorsRules.thresholds[0];
    const secondClass = honorsRules.thresholds[1];
    const firstClassColor = legacyColorToVar(firstClass.color, '--accent-gold');
    const secondClassColor = legacyColorToVar(secondClass.color, '--accent-info');

    return (
        <div className="academic-rules-page">
            <Link to="/dashboard" className="back-button">
                <ArrowLeft size={16} /> กลับหน้าหลัก
            </Link>

            <div className="section-header academic-rules-header">
                <div className="section-header-icon" style={{ background: 'linear-gradient(135deg, var(--accent-success-deep), var(--accent-success))' }}>
                    <ScrollText size={22} color="var(--text-on-accent)" />
                </div>
                <div>
                    <h2>กฎระเบียบและเกียรตินิยม</h2>
                    <p>{academicRulesScope.faculty} · อ้างอิงข้อบังคับมหาวิทยาลัยแม่โจ้ฉบับทางการ</p>
                </div>
                <div className="section-header-actions">
                    <ExportPDFButton title="กฎระเบียบและเกียรตินิยม" />
                </div>
            </div>

            <div className="academic-rules-scope">
                <div className="academic-rules-scope-main">
                    <div className="academic-rules-kicker"><ShieldCheck size={16} /> ขอบเขตข้อมูล</div>
                    <h3>ใช้สำหรับนักศึกษาปริญญาตรีคณะวิทยาศาสตร์เท่านั้น</h3>
                    <p>{academicRulesScope.disclaimer}</p>
                </div>
                <div className="academic-rules-scope-meta">
                    <span>{academicRulesScope.degreeTrack}</span>
                    <span>ตรวจอ้างอิง: {academicRulesScope.reviewedAt}</span>
                </div>
            </div>

            <div className="stats-grid academic-rules-stats">
                <div className="stat-card animate-in">
                    <div className="stat-card-header">
                        <div className="stat-card-icon" style={{ background: 'linear-gradient(135deg,var(--accent-gold),var(--accent-warning))' }}>
                            <Award />
                        </div>
                    </div>
                    <div className="stat-card-value" style={{ color: firstClassColor }}>{firstClass.gpa}</div>
                    <div className="stat-card-label">{firstClass.rank}</div>
                </div>
                <div className="stat-card animate-in">
                    <div className="stat-card-header">
                        <div className="stat-card-icon" style={{ background: 'linear-gradient(135deg,var(--accent-info),var(--accent-cyan))' }}>
                            <Award />
                        </div>
                    </div>
                    <div className="stat-card-value" style={{ color: secondClassColor }}>{secondClass.gpa}</div>
                    <div className="stat-card-label">{secondClass.rank}</div>
                </div>
                <div className="stat-card animate-in">
                    <div className="stat-card-header">
                        <div className="stat-card-icon" style={{ background: 'linear-gradient(135deg,var(--accent-success-deep),var(--accent-success))' }}>
                            <BookOpen />
                        </div>
                    </div>
                    <div className="stat-card-value">120+</div>
                    <div className="stat-card-label">หน่วยกิตที่ต้องศึกษาในมหาวิทยาลัย</div>
                </div>
                <div className="stat-card animate-in">
                    <div className="stat-card-header">
                        <div className="stat-card-icon" style={{ background: 'linear-gradient(135deg,var(--accent-danger),var(--accent-orange))' }}>
                            <XCircle />
                        </div>
                    </div>
                    <div className="stat-card-value">0</div>
                    <div className="stat-card-label">รายวิชา F หรือ U ตลอดหลักสูตร</div>
                </div>
            </div>

            <div className="academic-rules-grid">
                <section className="chart-card academic-rules-card academic-rules-honors">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">ทำอย่างไรถึงได้เกียรตินิยม</div>
                            <div className="chart-card-subtitle">{honorsRules.appliesTo}</div>
                        </div>
                        <GraduationCap size={24} color="var(--accent-success)" />
                    </div>
                    <div className="honors-rank-row">
                        {honorsRules.thresholds.map(rule => (
                            <div key={rule.rank} className="honors-rank-card" style={{ borderColor: themeAlpha(rule.color, 33) }}>
                                <span style={{ color: legacyColorToVar(rule.color, '--accent-gold') }}>{rule.rank}</span>
                                <strong>{rule.gpa}</strong>
                            </div>
                        ))}
                    </div>
                    <div className="academic-rule-note">
                        <Info size={16} />
                        {honorsRules.creditRequirement} และต้องเรียนครบตามโครงสร้างหลักสูตรในระยะเวลาที่กำหนด
                    </div>
                </section>

                <section className="chart-card academic-rules-card">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">เช็กลิสต์คุณสมบัติ</div>
                            <div className="chart-card-subtitle">ต้องครบก่อนเสนอชื่อรับปริญญาเกียรตินิยม</div>
                        </div>
                        <CheckCircle2 size={24} color="var(--accent-success)" />
                    </div>
                    <ul className="academic-rules-list positive">
                        {honorsRules.mustHave.map(item => (
                            <li key={item}><CheckCircle2 size={16} /> {item}</li>
                        ))}
                    </ul>
                </section>

                <section className="chart-card academic-rules-card">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">ลักษณะต้องห้าม</div>
                            <div className="chart-card-subtitle">หากเข้าเงื่อนไขนี้จะเสียสิทธิ์เกียรตินิยม</div>
                        </div>
                        <XCircle size={24} color="var(--accent-danger)" />
                    </div>
                    <ul className="academic-rules-list danger">
                        {honorsRules.disqualifiers.map(item => (
                            <li key={item}><XCircle size={16} /> {item}</li>
                        ))}
                    </ul>
                </section>
            </div>

            <div className="academic-rules-rule-grid">
                {graduationRules.map(rule => (
                    <section key={rule.title} className="chart-card academic-rules-card">
                        <div className="chart-card-header">
                            <div>
                                <div className="chart-card-title">{rule.title}</div>
                                <div className="chart-card-subtitle">สรุปจากข้อบังคับ ป.ตรี พ.ศ. 2569</div>
                            </div>
                            <FileText size={22} color="var(--accent-purple)" />
                        </div>
                        <ul className="academic-rules-list neutral">
                            {rule.items.map(item => (
                                <li key={item}><span className="academic-rules-dot" /> {item}</li>
                            ))}
                        </ul>
                    </section>
                ))}
            </div>

            <section className="chart-card academic-rules-card">
                <div className="chart-card-header">
                    <div>
                        <div className="chart-card-title">สาขาคณะวิทยาศาสตร์ในระบบ</div>
                        <div className="chart-card-subtitle">ใช้ประกอบการตีความเฉพาะข้อมูลของคณะวิทยาศาสตร์</div>
                    </div>
                </div>
                <div className="academic-rules-major-list">
                    {academicRulesScope.majors.map(major => <span key={major}>{major}</span>)}
                </div>
            </section>

            <section className="chart-card academic-rules-card academic-rules-sources">
                <div className="chart-card-header">
                    <div>
                        <div className="chart-card-title">แหล่งอ้างอิงทางการ</div>
                        <div className="chart-card-subtitle">เปิดตรวจสอบเอกสารจริงก่อนยื่นคำร้อง</div>
                    </div>
                </div>
                <div className="academic-rules-source-list">
                    {academicRulesSources.map(source => (
                        <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="academic-rules-source-item">
                            <div>
                                <strong>{source.title}</strong>
                                <span>{source.note}</span>
                            </div>
                            <ExternalLink size={16} />
                        </a>
                    ))}
                </div>
            </section>
        </div>
    );
}
