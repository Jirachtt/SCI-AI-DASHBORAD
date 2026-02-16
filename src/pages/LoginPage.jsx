import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, ShieldCheck, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function LoginPage() {
    const { loginWithEmail, loginWithGoogle, loginWithAdminCode } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showAdminModal, setShowAdminModal] = useState(false);
    const [adminCode, setAdminCode] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const result = await loginWithEmail(email, password);
        if (result.success) {
            navigate('/dashboard');
        } else {
            setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        }
        setLoading(false);
    };

    const handleGoogleLogin = async () => {
        setError('');
        const result = await loginWithGoogle();
        if (result.success) {
            navigate('/dashboard');
        } else {
            setError('Google ล้มเหลว: ' + (result.error || 'ไม่ทราบสาเหตุ'));
        }
    };

    const handleAdminCodeSubmit = async (e) => {
        e.preventDefault();
        const result = await loginWithAdminCode(adminCode);
        if (result.success) {
            navigate('/dashboard');
        } else {
            setError('รหัสผ่านผู้บริหารไม่ถูกต้อง');
            setTimeout(() => setError(''), 3000);
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-card">
                    <div className="login-logo">
                        <div className="mju-badge">MJU</div>
                        <h1>MJU Dashboard</h1>
                        <p>ระบบสารสนเทศมหาวิทยาลัยแม่โจ้</p>
                    </div>

                    {error && <div className="login-error">⚠️ {error}</div>}

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

                    <button
                        type="button"
                        className="google-login-btn"
                        onClick={handleGoogleLogin}
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
                            <span className="google-btn-text">เข้าสู่ระบบด้วย Google</span>
                        </div>
                        <div className="google-btn-shine" />
                    </button>

                    <div className="login-footer">
                        ยังไม่มีบัญชี? <Link to="/signup" className="link-text">สมัครสมาชิก</Link>
                    </div>

                    <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                        <button
                            type="button"
                            className="text-btn"
                            onClick={() => setShowAdminModal(true)}
                            style={{ color: '#6b7280', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', margin: '0 auto' }}
                        >
                            <ShieldCheck size={16} />
                            เข้าสู่ระบบผู้บริหาร
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
                            <h2>เข้าถึงสิทธิ์ผู้บริหาร</h2>
                            <p>กรุณากรอกรหัสผ่านสำหรับ ผจก.คณะ หรือ ประธานหลักสูตร</p>
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
