import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Landmark, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function MjuAuthCallbackPage() {
    const { completeMjuSsoLogin } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;

        completeMjuSsoLogin(window.location.search).then(result => {
            if (cancelled) return;
            if (result.success) {
                navigate(result.returnTo || '/dashboard', { replace: true });
                return;
            }
            setError(result.error || 'เข้าสู่ระบบผ่านบัญชีแม่โจ้ไม่สำเร็จ');
        });

        return () => { cancelled = true; };
    }, [completeMjuSsoLogin, navigate]);

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-card mju-callback-card">
                    <div className="login-logo">
                        <div className="mju-badge">MJU</div>
                        <h1>Maejo University Login</h1>
                        <p>กำลังตรวจสอบสิทธิ์จากบัญชีมหาวิทยาลัยแม่โจ้</p>
                    </div>

                    {error ? (
                        <>
                            <div className="mju-callback-icon error"><AlertTriangle size={30} /></div>
                            <div className="login-error">{error}</div>
                            <button type="button" className="login-btn" onClick={() => navigate('/', { replace: true })}>
                                กลับไปหน้าเข้าสู่ระบบ
                            </button>
                        </>
                    ) : (
                        <div className="mju-callback-status">
                            <div className="mju-callback-icon">
                                <Landmark size={30} />
                                <Loader2 size={18} className="spin-animation" />
                            </div>
                            <strong>กำลังเข้าสู่ระบบ...</strong>
                            <span>ระบบจะกำหนด role จากข้อมูลที่ยืนยันโดย MJU SSO bridge</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
