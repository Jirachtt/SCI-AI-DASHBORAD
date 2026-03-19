import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Lock, Mail, Briefcase } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function SignUpPage() {
    const { signup } = useAuth();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        name: '',
        role: 'general'
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);

    const baseRoles = [
        { value: 'staff', label: 'เจ้าหน้าที่ (Staff)' },
        { value: 'general', label: 'ผู้ใช้งานทั่วไป (General User)' }
    ];

    const adminRoles = [
        { value: 'dean', label: 'ผจก.คณะ (Dean)' },
        { value: 'chair', label: 'ประธานหลักสูตร (Program Chair)' },
        ...baseRoles
    ];

    const currentRoles = isAdminUnlocked ? adminRoles : baseRoles;

    const getRoleLabel = (roleValue) => {
        const role = adminRoles.find(r => r.value === roleValue);
        return role ? role.label.split(' (')[0] : 'ทั่วไป';
    };

    const getAvatar = (roleValue) => {
        switch (roleValue) {
            case 'dean': return 'D';
            case 'chair': return 'C';
            case 'staff': return 'S';
            default: return 'U';
        }
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            return setError('รหัสผ่านไม่ตรงกัน');
        }

        if (formData.password.length < 6) {
            return setError('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
        }

        setLoading(true);
        const userData = {
            name: formData.name,
            role: formData.role,
            roleLabel: getRoleLabel(formData.role),
            avatar: getAvatar(formData.role)
        };

        const result = await signup(formData.email, formData.password, userData);

        if (result.success) {
            navigate('/dashboard');
        } else {
            setError(result.error);
        }
        setLoading(false);
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-card">
                    <div className="login-logo">
                        <div className="mju-badge">MJU</div>
                        <h1>สร้างบัญชีใหม่</h1>
                        <p>ระบบสารสนเทศมหาวิทยาลัยแม่โจ้</p>
                    </div>

                    {error && <div className="login-error">{error}</div>}

                    <form className="login-form" onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>ชื่อ-นามสกุล</label>
                            <div className="input-wrapper">
                                <User />
                                <input
                                    type="text"
                                    name="name"
                                    placeholder="กรอกชื่อ-นามสกุล"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>อีเมล</label>
                            <div className="input-wrapper">
                                <Mail />
                                <input
                                    type="email"
                                    name="email"
                                    placeholder="example@mju.ac.th"
                                    value={formData.email}
                                    onChange={handleChange}
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
                                    name="password"
                                    placeholder="กำหนดรหัสผ่าน"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>ยืนยันรหัสผ่าน</label>
                            <div className="input-wrapper">
                                <Lock />
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    placeholder="ยืนยันรหัสผ่านอีกครั้ง"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <label style={{ marginBottom: 0 }}>ระดับผู้ใช้งาน (Role)</label>
                            </div>
                            <div className="input-wrapper">
                                <Briefcase />
                                <select
                                    name="role"
                                    value={formData.role}
                                    onChange={handleChange}
                                    className="role-select"
                                >
                                    {currentRoles.map(role => (
                                        <option key={role.value} value={role.value}>
                                            {role.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <button type="submit" className="login-btn" disabled={loading}>
                            {loading ? 'กำลังลงทะเบียน...' : 'ลงทะเบียน'}
                        </button>
                    </form>

                    <div className="login-footer">
                        มีบัญชีอยู่แล้ว? <Link to="/" className="link-text">เข้าสู่ระบบ</Link>
                    </div>
                </div>
            </div>

        </div>
    );
}

