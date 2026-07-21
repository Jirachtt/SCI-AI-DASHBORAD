import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowLeft,
    Award,
    BarChart3,
    BookOpen,
    CheckCircle2,
    FlaskConical,
    GraduationCap,
    Layers3,
    Microscope,
    Network,
    Star,
} from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    Tooltip,
} from 'chart.js';
import ProductPageHeader from '../components/ProductPageHeader';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../utils/accessControl';
import AccessDenied from '../components/AccessDenied';
import ExportPDFButton from '../components/ExportPDFButton';
import useDashboardDataset from '../hooks/useDashboardDataset';
import { themeAdaptorPlugin } from '../utils/chartTheme';
import MjuConnectedPagePanel from '../components/MjuConnectedPagePanel';
import { getMjuConnectedDataStatus } from '../services/mjuConnectedDataService';
import {
    courseAnalyticsData,
    getCourseAnalyticsSummary,
} from '../data/courseAnalyticsData';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend, themeAdaptorPlugin);

const gradePalette = ['var(--accent-success)', 'var(--accent-info)', 'var(--accent-purple)', 'var(--accent-gold)', 'var(--accent-warning)', 'var(--accent-danger)', 'var(--text-subtle)'];

export default function CourseAnalyticsPage() {
    const { user } = useAuth();
    const { data: liveCourseData } = useDashboardDataset('course_analytics');
    const [selectedProgram, setSelectedProgram] = useState('all');
    const [selectedCourseCode, setSelectedCourseCode] = useState('SCI331');
    const [consentAt, setConsentAt] = useState('');

    const hasAccess = canAccess(user?.role, 'course_analytics');
    const data = liveCourseData || courseAnalyticsData;
    const summary = getCourseAnalyticsSummary(data);
    const selectedGrade = data.gradeDistributions.find(course => course.code === selectedCourseCode) || data.gradeDistributions[0];
    const connectedUser = consentAt ? { ...user, mjuConsentGrantedAt: consentAt } : user;
    const enrollmentConnection = getMjuConnectedDataStatus(connectedUser, 'enrollment');
    const gradeConnection = getMjuConnectedDataStatus(connectedUser, 'grades');

    const visibleYearPlan = useMemo(() => data.coursePlanByYear.map(year => ({
        ...year,
        semesters: year.semesters.map(semester => ({
            ...semester,
            courses: semester.courses.filter(course =>
                selectedProgram === 'all' || course.crossMajor || course.major === selectedProgram
            ),
        })).filter(semester => semester.courses.length > 0),
    })).filter(year => year.semesters.length > 0), [data.coursePlanByYear, selectedProgram]);

    const gradeChartData = {
        labels: Object.keys(selectedGrade.grades),
        datasets: [{
            label: selectedGrade.title,
            data: Object.values(selectedGrade.grades),
            backgroundColor: Object.keys(selectedGrade.grades).map((_, idx) => gradePalette[idx % gradePalette.length]),
            borderRadius: 6,
        }],
    };

    const gradeChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: context => `${context.label}: ${context.parsed.y} คน`,
                },
            },
        },
        scales: {
            x: { ticks: { color: 'var(--text-secondary)' }, grid: { color: 'var(--border-color)' } },
            y: { ticks: { color: 'var(--text-secondary)' }, grid: { color: 'var(--border-color)' } },
        },
    };

    if (!hasAccess) return <AccessDenied />;

    return (
        <div className="course-page">
            <Link to="/dashboard" className="back-button">
                <ArrowLeft size={16} /> กลับหน้าหลัก
            </Link>

            <ProductPageHeader
                icon={BookOpen}
                eyebrow="ACADEMIC ANALYTICS"
                title="รายวิชา เกรด และจุดเด่นสาขา"
                subtitle="แผนเรียนปี 1-4 การกระจายเกรด วิชาข้ามสาขา และความเชี่ยวชาญของแต่ละหลักสูตร"
                tone="cyan"
                className="course-page-header"
                actions={<ExportPDFButton title="รายวิชาและกราฟกระจายเกรด" />}
            />

            {user?.mjuVerified && (
                <>
                    <MjuConnectedPagePanel
                        user={connectedUser}
                        compact
                        domainIds={['profile', 'enrollment', 'grades']}
                        onConsentGranted={setConsentAt}
                    />
                    {(enrollmentConnection.data || gradeConnection.data) && (
                        <section className="stats-grid mju-personal-summary-grid" aria-label="ข้อมูลการเรียนจากบัญชี MJU">
                            <article className="stat-card">
                                <div className="stat-card-value">{gradeConnection.data?.gpax ?? '--'}</div>
                                <div className="stat-card-label">GPAX ของฉัน</div>
                                <small>{gradeConnection.source} · {gradeConnection.status === 'connected' ? 'เชื่อมแล้ว' : 'ข้อมูลบางส่วน'}</small>
                            </article>
                            <article className="stat-card">
                                <div className="stat-card-value">{enrollmentConnection.data?.registeredCredits ?? '--'}</div>
                                <div className="stat-card-label">หน่วยกิตที่ลงทะเบียนภาคนี้</div>
                                <small>{enrollmentConnection.source} · {enrollmentConnection.data?.academicYear || '-'} / {enrollmentConnection.data?.semester || '-'}</small>
                            </article>
                            <article className="stat-card">
                                <div className="stat-card-value">{enrollmentConnection.data?.courseCount ?? '--'}</div>
                                <div className="stat-card-label">รายวิชาที่ลงทะเบียน</div>
                                <small>{enrollmentConnection.data?.enrollmentStatus || enrollmentConnection.message}</small>
                            </article>
                        </section>
                    )}
                </>
            )}

            <section className="course-source-banner">
                <div>
                    <span><CheckCircle2 size={15} /> Scope</span>
                    <strong>ใช้กับหลักสูตรปริญญาตรีคณะวิทยาศาสตร์ และเตรียมเชื่อมข้อมูลรายวิชา/เกรดจาก Reg</strong>
                    <p>{data.dataStatus.note}</p>
                </div>
                <div className="course-source-tags">
                    {data.sources.map(source => (
                        <a key={source.label} href={source.url} target="_blank" rel="noreferrer">
                            {source.label}
                        </a>
                    ))}
                </div>
            </section>

            <section className="course-kpi-grid">
                <article className="course-kpi-card">
                    <div><GraduationCap size={20} /></div>
                    <strong>{summary.programCount}</strong>
                    <span>หลักสูตรปริญญาตรี</span>
                    <small>อ้างอิง TCAS Science MJU</small>
                </article>
                <article className="course-kpi-card">
                    <div><Star size={20} /></div>
                    <strong>{summary.featuredCount}</strong>
                    <span>วิชาน่าสนใจ</span>
                    <small>ใช้สื่อสาร/แนะนำผู้เรียนได้</small>
                </article>
                <article className="course-kpi-card">
                    <div><Network size={20} /></div>
                    <strong>{summary.crossMajorCount}</strong>
                    <span>วิชาข้ามสาขา</span>
                    <small>เรียนร่วมได้หลายหลักสูตร</small>
                </article>
                <article className="course-kpi-card">
                    <div><Award size={20} /></div>
                    <strong>{summary.avgCourseGpa.toFixed(2)}</strong>
                    <span>GPA รายวิชาเฉลี่ย</span>
                    <small>seed รอ export จาก Reg</small>
                </article>
            </section>

            <section className="course-layout">
                <article className="chart-card course-plan-panel">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">รายวิชาที่ควรลงทะเบียน ปี 1-4</div>
                            <div className="chart-card-subtitle">เลือกสาขาเพื่อดูวิชาแกน + วิชาข้ามสาขาที่เรียนร่วมได้</div>
                        </div>
                        <select value={selectedProgram} onChange={event => setSelectedProgram(event.target.value)} aria-label="เลือกสาขา">
                            <option value="all">ทุกสาขา</option>
                            {data.programs.map(program => (
                                <option key={program} value={program}>{program}</option>
                            ))}
                        </select>
                    </div>

                    <div className="course-year-list">
                        {visibleYearPlan.map(year => (
                            <section key={year.year} className="course-year-section">
                                <div className="course-year-head">
                                    <strong>{year.title}</strong>
                                    <span>ปี {year.year}</span>
                                </div>
                                <div className="course-semester-grid">
                                    {year.semesters.map(semester => (
                                        <div key={semester.semester} className="course-semester">
                                            <h3>{semester.semester}</h3>
                                            {semester.courses.map(course => (
                                                <div key={`${semester.semester}-${course.code}`} className="course-chip-row">
                                                    <span>{course.code}</span>
                                                    <strong>{course.title}</strong>
                                                    <em>{course.credits} หน่วยกิต</em>
                                                    {course.crossMajor && <small>ข้ามสาขาได้</small>}
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                </article>

                <aside className="course-side">
                    <article className="chart-card">
                        <div className="chart-card-title">วิชาน่าสนใจ</div>
                        <div className="course-featured-list">
                            {data.featuredCourses.map(course => (
                                <button
                                    key={course.code}
                                    type="button"
                                    className={selectedCourseCode === course.code ? 'active' : ''}
                                    onClick={() => setSelectedCourseCode(course.code)}
                                >
                                    <span>{course.code}</span>
                                    <strong>{course.title}</strong>
                                    <small>{course.reason}</small>
                                    <em>{course.interestScore}%</em>
                                </button>
                            ))}
                        </div>
                    </article>

                    <article className="chart-card course-reg-note">
                        <div className="chart-card-title">Fields ที่ต้องใช้จาก Reg</div>
                        <div className="course-reg-fields">
                            {['รหัสวิชา', 'ชื่อวิชา', 'หลักสูตร', 'ชั้นปี', 'section', 'จำนวนลงทะเบียน', 'เกรดรายคน/แจกแจงเกรด'].map(field => (
                                <span key={field}>{field}</span>
                            ))}
                        </div>
                    </article>
                </aside>
            </section>

            <section className="course-layout course-grade-strength-layout">
                <article className="chart-card">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">กราฟการกระจายเกรดรายวิชา</div>
                            <div className="chart-card-subtitle">{selectedGrade.code} · {selectedGrade.title} · {selectedGrade.semester}</div>
                        </div>
                        <BarChart3 size={22} color="var(--accent-success)" />
                    </div>
                    <div className="course-grade-chart">
                        <Bar data={gradeChartData} options={gradeChartOptions} />
                    </div>
                    <div className="course-grade-summary">
                        <div><span>ผู้ลงทะเบียน</span><strong>{selectedGrade.enrolled} คน</strong></div>
                        <div><span>GPA เฉลี่ยรายวิชา</span><strong>{selectedGrade.avgGpa.toFixed(2)}</strong></div>
                        <div><span>F rate</span><strong>{((selectedGrade.grades.F / selectedGrade.enrolled) * 100).toFixed(1)}%</strong></div>
                    </div>
                </article>

                <article className="chart-card course-strength-panel">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">จุดเด่นของแต่ละสาขา</div>
                            <div className="chart-card-subtitle">ใช้ตอบโจทย์ด้านบุคลากร/หลักสูตร ว่าแต่ละสาขาเชี่ยวชาญอะไร</div>
                        </div>
                        <Microscope size={22} color="var(--accent-purple)" />
                    </div>
                    <div className="course-strength-grid">
                        {data.branchStrengths.map((branch, index) => (
                            <article key={branch.major} className="course-strength-card">
                                <div className="course-strength-card-top">
                                    <span className="course-strength-icon"><FlaskConical size={16} /></span>
                                    <div>
                                        <span className="course-strength-kicker">#{String(index + 1).padStart(2, '0')}</span>
                                        <strong>{branch.major}</strong>
                                    </div>
                                </div>
                                <p>{branch.showcase}</p>
                                <div className="course-strength-tags">
                                    {branch.strengths.map(strength => <span key={strength}>{strength}</span>)}
                                </div>
                                <div className="course-strength-courses">
                                    <span>รายวิชาเด่น</span>
                                    <small>{branch.flagshipCourses.join(' / ')}</small>
                                </div>
                            </article>
                        ))}
                    </div>
                </article>
            </section>

            <section className="data-table-container course-table-section">
                <div className="data-table-header">
                    <span className="data-table-title">รายการวิชาที่มี grade distribution</span>
                    <span className="status-badge warning">รอ Reg export</span>
                </div>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>รหัส</th>
                            <th>รายวิชา</th>
                            <th>เทอม</th>
                            <th>ลงทะเบียน</th>
                            <th>GPA เฉลี่ย</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.gradeDistributions.map(course => (
                            <tr key={course.code}>
                                <td>{course.code}</td>
                                <td>{course.title}</td>
                                <td>{course.semester}</td>
                                <td>{course.enrolled}</td>
                                <td>{course.avgGpa.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            <section className="course-next-step">
                <Layers3 size={18} />
                <span>
                    เมื่อได้ไฟล์ Reg จริง หน้านี้จะแทน seed ด้วยข้อมูลจริงได้ทันที ทั้งรายวิชา section จำนวนลงทะเบียน และการแจกแจงเกรดรายวิชา
                </span>
            </section>
        </div>
    );
}
