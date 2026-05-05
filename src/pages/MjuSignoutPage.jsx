import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function MjuSignoutPage() {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [done, setDone] = useState(false);

    useEffect(() => {
        let cancelled = false;

        logout({ localOnly: true }).finally(() => {
            if (cancelled) return;
            setDone(true);
            setTimeout(() => navigate('/', { replace: true }), 400);
        });

        return () => {
            cancelled = true;
        };
    }, [logout, navigate]);

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-card mju-callback-card">
                    <div className="login-logo">
                        <div className="mju-badge">MJU</div>
                        <h1>Maejo University Sign out</h1>
                        <p>Clearing SCI AI Dashboard session</p>
                    </div>
                    <div className="mju-callback-status">
                        <div className="mju-callback-icon">
                            <LogOut size={30} />
                            {!done && <Loader2 size={18} className="spin-animation" />}
                        </div>
                        <strong>{done ? 'Signed out' : 'Signing out...'}</strong>
                        <span>{done ? 'Returning to login page.' : 'Please wait a moment.'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
