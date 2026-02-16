import { Shield } from 'lucide-react';

export default function AccessDenied() {
    return (
        <div className="access-denied">
            <div className="access-denied-icon">
                <Shield />
            </div>
            <h2>ไม่มีสิทธิ์เข้าถึง</h2>
            <p>ระดับสิทธิ์ของคุณไม่สามารถเข้าถึงข้อมูลส่วนนี้ได้ กรุณาติดต่อผู้ดูแลระบบ</p>
        </div>
    );
}
