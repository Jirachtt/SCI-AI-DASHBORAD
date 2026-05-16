import { useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
    getMjuConnectedDataSummary,
    grantMjuConnectedDataConsent,
    hasMjuConnectedDataConsent,
} from '../services/mjuConnectedDataService';

const SESSION_DISMISS_KEY = 'sci-ai-dashboard:mju-connected-consent-dismissed';

export default function MjuConnectedConsent() {
    const { user } = useAuth();
    const [dismissed, setDismissed] = useState(() => {
        try {
            return sessionStorage.getItem(SESSION_DISMISS_KEY) === 'true';
        } catch {
            return false;
        }
    });
    const [consentVersion, setConsentVersion] = useState(0);
    void consentVersion;
    const accepted = hasMjuConnectedDataConsent(user || {});
    const summary = getMjuConnectedDataSummary(user || {});
    const shouldShow = Boolean(user?.mjuVerified && !accepted && !dismissed);
    if (!shouldShow) return null;

    const handleAccept = () => {
        grantMjuConnectedDataConsent(user);
        setConsentVersion(value => value + 1);
        window.dispatchEvent(new CustomEvent('sci-mju-consent-updated'));
    };

    const handleDismiss = () => {
        try {
            sessionStorage.setItem(SESSION_DISMISS_KEY, 'true');
        } catch {
            // Session persistence is optional.
        }
        setDismissed(true);
    };

    return (
        <div className="mju-consent-panel" role="dialog" aria-label="MJU connected data consent">
            <button type="button" className="mju-consent-close" onClick={handleDismiss} aria-label="ปิด">
                <X size={14} />
            </button>
            <div className="mju-consent-icon">
                <ShieldCheck size={20} />
            </div>
            <div className="mju-consent-body">
                <strong>เชื่อมข้อมูลบัญชี MJU อย่างปลอดภัย</strong>
                <p>
                    ระบบจะใช้ตัวตน MJU ของคุณเพื่อแสดงข้อมูลที่มีสิทธิ์เท่านั้น เช่น โปรไฟล์,
                    รายวิชา, เกรด, กิจกรรม, สถานะจบ และค่าธรรมเนียมเมื่อมี endpoint จริงจากมหาวิทยาลัย
                </p>
                <div className="mju-consent-meta">
                    <span>Role: {summary.identity.roleLabel}</span>
                    <span>ข้อมูลส่วนบุคคล: ต้องมีสิทธิ์และ consent</span>
                </div>
                <div className="mju-consent-actions">
                    <button type="button" onClick={handleAccept}>ยินยอมและดำเนินการต่อ</button>
                    <button type="button" className="secondary" onClick={handleDismiss}>ไว้ภายหลัง</button>
                </div>
            </div>
        </div>
    );
}
