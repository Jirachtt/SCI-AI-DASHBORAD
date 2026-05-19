import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Lock, Mail, ShieldCheck, X, Sun, Moon, Landmark } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { APP_NAME_EN, APP_NAME_TH } from '../config/appBrand';

export default function LoginPage() {
    const { user, loginWithEmail, loginWithGoogle, loginWithMjuSso, loginWithAdminCode } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [mjuLoading, setMjuLoading] = useState(false);
    const [showAdminModal, setShowAdminModal] = useState(false);
    const [adminCode, setAdminCode] = useState('');

    // Belt-and-suspenders navigation: <PublicRoute> also watches the auth
    // context and redirects to /dashboard, but in some Google-popup timings
    // that path didn't fire and the user had to refresh. Explicit effect on
    // `user` guarantees we leave the login screen as soon as auth resolves.
    useEffect(() => {
        if (user) navigate('/dashboard', { replace: true });
    }, [user, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const result = await loginWithEmail(email, password);
        if (!result.success) {
            setError(result.error || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
            setLoading(false);
        }
        // On success: leave loading=true; the useEffect above redirects once user resolves.
    };

    const handleGoogleLogin = async () => {
        if (googleLoading) return;
        setError('');
        setGoogleLoading(true);
        const result = await loginWithGoogle();
        if (!result.success) {
            setError('Google ล้มเหลว: ' + (result.error || 'ไม่ทราบสาเหตุ'));
            setGoogleLoading(false);
        }
        // On success: auth listener will populate user; useEffect navigates.
    };

    const handleMjuLogin = async () => {
        if (mjuLoading) return;
        setError('');
        setMjuLoading(true);
        const result = await loginWithMjuSso('/dashboard');
        if (!result.success) {
            setError(result.error || 'ยังไม่สามารถเชื่อมบัญชีแม่โจ้ได้');
            setMjuLoading(false);
        }
    };

    const handleAdminCodeSubmit = async (e) => {
        e.preventDefault();
        const result = await loginWithAdminCode(adminCode);
        if (!result.success) {
            setError('รหัสผ่าน Admin ไม่ถูกต้อง');
            setTimeout(() => setError(''), 3000);
        }
    };

    return (
        <div className="login-page">
            <button
                className={`theme-toggle ${theme}`}
                onClick={toggleTheme}
                aria-label="เปลี่ยนธีม"
                data-tooltip="เปลี่ยนธีม"
                style={{ position: 'absolute', top: 20, right: 20, zIndex: 10 }}
            >
                <span className="theme-toggle-track">
                    <Sun size={14} className="theme-icon sun" />
                    <Moon size={14} className="theme-icon moon" />
                    <span className="theme-toggle-thumb" />
                </span>
            </button>
            <div className="login-container login-shell">
                <section className="login-hero-panel" aria-label="ภาพรวมระบบ">
                    <div className="login-brand-lockup">
                        <div className="login-brand-badge">MJU</div>
                        <div>
                            <span className="login-kicker">SCIENCE DECISION SUPPORT</span>
                            <h1>{APP_NAME_TH}</h1>
                            <p>{APP_NAME_EN}</p>
                        </div>
                    </div>

                    <div className="login-hero-copy">
                        <h2>แดชบอร์ดอัจฉริยะคณะวิทยาศาสตร์</h2>
                        <p>พื้นที่รวมข้อมูลสำหรับผู้บริหาร บุคลากร และนักศึกษา ในรูปแบบที่อ่านง่ายและพร้อมใช้งานทันที</p>
                    </div>

                    <div className="login-hero-metrics" aria-label="สถานะระบบ">
                        <div>
                            <strong>Live</strong>
                            <span>ข้อมูลเชื่อมต่อ</span>
                        </div>
                        <div>
                            <strong>AI</strong>
                            <span>ผู้ช่วยวิเคราะห์</span>
                        </div>
                        <div>
                            <strong>TCAS</strong>
                            <span>แผนรับนักศึกษา</span>
                        </div>
                    </div>

                    <div className="login-preview-screen" aria-hidden="true">
                        <div className="login-preview-toolbar">
                            <span>SCI AI Dashboard</span>
                            <span>Live Data</span>
                        </div>
                        <div className="login-preview-board login-preview-dashboard">
                            <div className="login-preview-sidebar">
                                <strong>SCI</strong>
                                <span className="active">ภาพรวม</span>
                                <span>นักศึกษา</span>
                                <span>TCAS</span>
                                <span>สำเร็จการศึกษา</span>
                            </div>
                            <div className="login-preview-content">
                                <div className="login-preview-topline">
                                    <div>
                                        <strong>สวัสดี, Admin</strong>
                                        <span>Decision Support Dashboard</span>
                                    </div>
                                    <div className="login-preview-actions">
                                        <span>CSV</span>
                                        <span>PDF</span>
                                    </div>
                                </div>

                                <div className="login-preview-cards">
                                    <div>
                                        <strong>16,506</strong>
                                        <span>นักศึกษาทั้งหมด</span>
                                    </div>
                                    <div>
                                        <strong>847</strong>
                                        <span>รายวิชาเปิดสอน</span>
                                    </div>
                                    <div>
                                        <strong>89.5%</strong>
                                        <span>อัตราสำเร็จ</span>
                                    </div>
                                </div>

                                <div className="login-preview-main">
                                    <div className="login-preview-chart">
                                        <div className="login-preview-chart-head">
                                            <strong>ภาพรวมสถิติ</strong>
                                            <span>ปี 2569</span>
                                        </div>
                                        <div className="login-preview-bars">
                                            <i />
                                            <i />
                                            <i />
                                            <i />
                                            <i />
                                        </div>
                                    </div>

                                    <div className="login-preview-table">
                                        <strong>ข้อมูลล่าสุด</strong>
                                        <span><b>Y1</b> 410 คน</span>
                                        <span><b>Y2</b> 415 คน</span>
                                        <span><b>GPA</b> 3.12</span>
                                    </div>
                                </div>

                                <div className="login-preview-row">
                                    <span>รายชื่อนักศึกษา</span>
                                    <span>ตรวจสอบการจบ</span>
                                    <span>แผนรับ TCAS</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="login-card">
                    <div className="login-logo">
                        <div className="mju-badge">MJU</div>
                        <h1>เข้าสู่ระบบ</h1>
                        <p>เลือกวิธีเข้าสู่ระบบที่ต้องการเพื่อไปยังแดชบอร์ด</p>
                    </div>

                    {error && <div className="login-error">{error}</div>}

                    <form className="login-form" onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>อีเมล</label>
                            <div className="input-wrapper">
                                <Mail />
                                <input
                                    type="email"
                                    placeholder="example@mju.ac.th"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>รหัสผ่าน</label>
                            <div className="input-wrapper">
                                <Lock />
                                <input
                                    type="password"
                                    placeholder="กรอกรหัสผ่าน"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button type="submit" className="login-btn" disabled={loading}>
                            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
                        </button>
                    </form>

                    <div className="login-divider">
                        <span>หรือเข้าสู่ระบบด้วย</span>
                    </div>

                    <div className="login-sso-grid">
                    <button
                        type="button"
                        className="google-login-btn"
                        onClick={handleGoogleLogin}
                        disabled={googleLoading || loading}
                    >
                        <div className="google-btn-inner">
                            <div className="google-icon-box">
                                <svg viewBox="0 0 24 24" width="20" height="20">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                            </div>
                            <span className="google-btn-text">
                                {googleLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย Google'}
                            </span>
                        </div>
                        <div className="google-btn-shine" />
                    </button>

                    <button
                        type="button"
                        className="mju-login-btn"
                        onClick={handleMjuLogin}
                        disabled={mjuLoading || googleLoading || loading}
                    >
                        <div className="mju-login-btn-inner">
                            <div className="mju-login-icon-box">
                                <Landmark size={20} />
                            </div>
                            <span className="mju-login-btn-text">
                                {mjuLoading ? 'กำลังเชื่อมต่อบัญชีแม่โจ้...' : 'เข้าสู่ระบบด้วยบัญชีแม่โจ้'}
                            </span>
                        </div>
                    </button>

                    </div>

                    <div className="login-footer">
                        ยังไม่มีบัญชี? <Link to="/signup" className="link-text">สมัครสมาชิก</Link>
                    </div>

                    <div className="login-admin-access">
                        <button
                            type="button"
                            className="text-btn login-admin-btn"
                            onClick={() => setShowAdminModal(true)}
                        >
                            <ShieldCheck size={16} />
                            เข้าสู่ระบบ Admin
                        </button>
                    </div>
                </div>
            </div>

            {/* Admin Code Modal */}
            {showAdminModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <button
                            className="modal-close"
                            onClick={() => setShowAdminModal(false)}
                        >
                            <X size={20} />
                        </button>

                        <div className="modal-header">
                            <ShieldCheck size={48} color="#10b981" />
                            <h2>เข้าสู่ระบบ Admin</h2>
                            <p>กรุณากรอกรหัสผ่านสำหรับผู้ดูแลระบบเพื่อจัดการผู้ใช้และสิทธิ์</p>
                        </div>

                        <form onSubmit={handleAdminCodeSubmit} className="admin-code-form">
                            <div className="input-group">
                                <input
                                    type="password"
                                    placeholder="รหัสยืนยันตัวตน"
                                    value={adminCode}
                                    onChange={(e) => setAdminCode(e.target.value)}
                                    autoFocus
                                />
                                <button type="submit">ยืนยัน</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
