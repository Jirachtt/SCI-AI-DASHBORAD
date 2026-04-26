import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
    User, Lock, Mail, Sun, Moon, ChevronLeft, ChevronRight,
    GraduationCap, Briefcase, Building, Check, Clock, AlertTriangle, IdCard
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const ROLE_OPTIONS = [
    {
        value: 'general',
        realRole: 'general',
        pending: false,
        icon: User,
        gradient: 'linear-gradient(135deg, #7B68EE, #5e4fe0)',
        title: 'ผู้ใช้งานทั่วไป',
        subtitle: 'General User',
        description: 'สำหรับผู้สนใจทั่วไปที่ต้องการดูภาพรวมคณะและสอบถามข้อมูลเบื้องต้น เริ่มใช้งานได้ทันที ไม่ต้องรอการอนุมัติ',
        features: [
            'ภาพรวมคณะ (Dashboard)',
            'ค่าธรรมเนียมการศึกษา',
            'AI แชทบอทสอบถามข้อมูล',
        ],
        avatar: 'U',
        roleLabel: 'ผู้ใช้ทั่วไป (General)'
    },
    {
        value: 'student',
        realRole: 'student',
        pending: false,
        icon: GraduationCap,
        gradient: 'linear-gradient(135deg, #E91E63, #b83280)',
        title: 'นักศึกษา',
        subtitle: 'Student',
        description: 'สำหรับนักศึกษาที่ต้องการดูข้อมูลการเรียน กิจกรรม และสถานะที่เกี่ยวข้องกับตนเอง เริ่มใช้งานได้ทันที',
        features: [
            'ภาพรวมคณะ (Dashboard)',
            'ค่าธรรมเนียมการศึกษา',
            'กิจกรรม/พฤติกรรมนักศึกษา',
            'ตรวจสอบการสำเร็จการศึกษา',
            'สถิตินิสิตปัจจุบัน',
        ],
        avatar: 'ST',
        roleLabel: 'นักศึกษา (Student)'
    },
    {
        value: 'staff',
        realRole: 'pending_staff',
        pending: true,
        icon: Briefcase,
        gradient: 'linear-gradient(135deg, #006838, #00a651)',
        title: 'เจ้าหน้าที่',
        subtitle: 'Staff',
        description: 'บุคลากรสายสนับสนุน ผู้ช่วยงานในภาควิชา ต้องยืนยันตัวตนโดยผู้ดูแลระบบก่อนใช้งานเต็มสิทธิ์',
        features: [
            'ทุกอย่างที่ผู้ใช้ทั่วไปเห็น',
            'ข้อมูลการเงิน (Financial)',
            'ภาพรวมบุคลากร (HR)',
            'ภาพรวมงานวิจัย (Research)',
            'พยากรณ์งบประมาณ',
        ],
        avatar: 'S',
        roleLabel: 'รอการอนุมัติ (Staff)'
    },
    {
        value: 'chair',
        realRole: 'pending_chair',
        pending: true,
        icon: Building,
        gradient: 'linear-gradient(135deg, #2E86AB, #1e5f85)',
        title: 'ประธานหลักสูตร',
        subtitle: 'Program Chair',
        description: 'หัวหน้า/ประธานหลักสูตร มีสิทธิ์ดูข้อมูลเชิงลึก รายงาน และวางแผนงบประมาณ ต้องผ่านการอนุมัติจากผู้บริหาร',
        features: [
            'ทุกอย่างที่เจ้าหน้าที่เห็น',
            'รายชื่อนักศึกษา (Student List)',
            'รายละเอียดการเงิน/ค่าธรรมเนียม',
            'ยุทธศาสตร์ (Strategic OKR)',
            'วางแผนงบประมาณ (Budget Planning)',
        ],
        avatar: 'C',
        roleLabel: 'รอการอนุมัติ (Chair)'
    },
];

export default function SignUpPage() {
    const { signup, checkEmailExists } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();

    const [step, setStep] = useState(1);
    const [selectedRole, setSelectedRole] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        employeeId: '',
        department: '',
        reason: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [checkingEmail, setCheckingEmail] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const roleMeta = ROLE_OPTIONS.find(r => r.value === selectedRole) || null;
    const needsStep3 = roleMeta?.pending;
    const totalSteps = needsStep3 ? 3 : 2;

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const validateStep1 = () => {
        if (!formData.name.trim()) return 'กรุณากรอกชื่อ-นามสกุล';
        if (!formData.email.trim()) return 'กรุณากรอกอีเมล';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return 'รูปแบบอีเมลไม่ถูกต้อง';
        if (formData.password.length < 6) return 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร';
        if (formData.password !== formData.confirmPassword) return 'รหัสผ่านไม่ตรงกัน';
        return null;
    };

    const validateStep3 = () => {
        if (!formData.employeeId.trim()) return 'กรุณากรอกรหัสพนักงาน';
        if (!formData.department.trim()) return 'กรุณากรอกหน่วยงาน/ภาควิชา';
        return null;
    };

    const nextStep = async () => {
        setError('');
        if (step === 1) {
            const err = validateStep1();
            if (err) return setError(err);
            // Duplicate-email guard — catch it here so the user doesn't
            // waste time on later steps only to fail at createUser.
            setCheckingEmail(true);
            const { exists } = await checkEmailExists(formData.email.trim());
            setCheckingEmail(false);
            if (exists) {
                return setError('อีเมลนี้ถูกใช้สมัครไปแล้ว — กรุณาเข้าสู่ระบบหรือใช้อีเมลอื่น');
            }
            setStep(2);
            return;
        }
        if (step === 2) {
            if (!selectedRole) return setError('กรุณาเลือกประเภทผู้ใช้');
            if (needsStep3) {
                setStep(3);
            } else {
                handleSubmit();
            }
            return;
        }
        if (step === 3) {
            const err = validateStep3();
            if (err) return setError(err);
            handleSubmit();
        }
    };

    const prevStep = () => {
        setError('');
        if (step > 1) setStep(step - 1);
    };

    const handleSubmit = async () => {
        if (!roleMeta) return;
        setError('');
        setLoading(true);

        const userData = {
            name: formData.name.trim(),
            role: roleMeta.realRole,
            roleLabel: roleMeta.roleLabel,
            avatar: roleMeta.avatar,
            status: roleMeta.pending ? 'pending' : 'approved'
        };
        if (roleMeta.pending) {
            userData.requestedRole = roleMeta.value;
            userData.employeeId = formData.employeeId.trim();
            userData.department = formData.department.trim();
            if (formData.reason.trim()) userData.reason = formData.reason.trim();
        }

        const result = await signup(formData.email.trim(), formData.password, userData);
        setLoading(false);

        if (!result.success) {
            setError(result.error);
            // If the root cause is a duplicate email, bounce back to step 1
            // so the user can change it without re-picking a role.
            if (result.code === 'auth/email-already-in-use' || result.code === 'auth/invalid-email') {
                setStep(1);
            }
            return;
        }

        if (result.isPending) {
            setShowSuccess(true);
        } else {
            navigate('/dashboard');
        }
    };

    const closeSuccess = () => {
        setShowSuccess(false);
        navigate('/dashboard');
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

            <div className="login-container">
                <div className="login-card signup-card-wide">
                    <div className="login-logo">
                        <div className="mju-badge">MJU</div>
                        <h1>สร้างบัญชีใหม่</h1>
                        <p>ระบบสารสนเทศคณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้</p>
                    </div>

                    {/* Step indicator */}
                    <div className="signup-steps" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={totalSteps}>
                        {[1, 2, 3].slice(0, totalSteps).map((n, idx, arr) => (
                            <div key={n} className="signup-step-wrap">
                                <div className={`signup-step ${step >= n ? 'active' : ''} ${step > n ? 'done' : ''}`}>
                                    {step > n ? <Check size={14} /> : n}
                                </div>
                                <span className="signup-step-label">
                                    {n === 1 && 'ข้อมูลบัญชี'}
                                    {n === 2 && 'ประเภทผู้ใช้'}
                                    {n === 3 && 'ข้อมูลเพิ่มเติม'}
                                </span>
                                {idx < arr.length - 1 && <span className={`signup-step-line ${step > n ? 'done' : ''}`} />}
                            </div>
                        ))}
                    </div>

                    {error && <div className="login-error">{error}</div>}

                    {/* Step 1: Basic info */}
                    {step === 1 && (
                        <div className="login-form signup-step-content">
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
                                        autoComplete="name"
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
                                        autoComplete="email"
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
                                        placeholder="อย่างน้อย 6 ตัวอักษร"
                                        value={formData.password}
                                        onChange={handleChange}
                                        autoComplete="new-password"
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
                                        placeholder="พิมพ์รหัสผ่านอีกครั้ง"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        autoComplete="new-password"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Role cards */}
                    {step === 2 && (
                        <div className="signup-step-content">
                            <div className="signup-role-grid">
                                {ROLE_OPTIONS.map(role => {
                                    const Icon = role.icon;
                                    const selected = selectedRole === role.value;
                                    return (
                                        <button
                                            type="button"
                                            key={role.value}
                                            className={`signup-role-card ${selected ? 'selected' : ''}`}
                                            onClick={() => setSelectedRole(role.value)}
                                        >
                                            {role.pending && (
                                                <span className="signup-role-badge">
                                                    <Clock size={12} /> ต้องอนุมัติ
                                                </span>
                                            )}
                                            <div className="signup-role-icon" style={{ background: role.gradient }}>
                                                <Icon size={26} />
                                            </div>
                                            <h3 className="signup-role-title">{role.title}</h3>
                                            <p className="signup-role-subtitle">{role.subtitle}</p>
                                            <p className="signup-role-desc">{role.description}</p>
                                            <ul className="signup-role-features">
                                                {role.features.map(f => (
                                                    <li key={f}><Check size={14} /> {f}</li>
                                                ))}
                                            </ul>
                                        </button>
                                    );
                                })}
                            </div>
                            {roleMeta?.pending && (
                                <div className="signup-pending-notice">
                                    <AlertTriangle size={18} />
                                    <div>
                                        <strong>บัญชีนี้ต้องรอการอนุมัติจากผู้ดูแลระบบ</strong>
                                        <p>ระหว่างรอการอนุมัติ คุณจะสามารถเข้าใช้งานได้ในสิทธิ์ระดับทั่วไป (General) ก่อน</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: Extra info for staff/chair */}
                    {step === 3 && (
                        <div className="login-form signup-step-content">
                            <div className="form-group">
                                <label>รหัสพนักงาน / รหัสบุคลากร</label>
                                <div className="input-wrapper">
                                    <IdCard />
                                    <input
                                        type="text"
                                        name="employeeId"
                                        placeholder="เช่น 6400001"
                                        value={formData.employeeId}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>หน่วยงาน / ภาควิชา</label>
                                <div className="input-wrapper">
                                    <Building />
                                    <input
                                        type="text"
                                        name="department"
                                        placeholder="เช่น ภาควิชาวิทยาการคอมพิวเตอร์"
                                        value={formData.department}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>เหตุผลที่ขอสิทธิ์นี้ <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(ไม่บังคับ)</span></label>
                                <textarea
                                    name="reason"
                                    placeholder="เช่น ดูแลรายงานการเงินของภาควิชา..."
                                    value={formData.reason}
                                    onChange={handleChange}
                                    rows={3}
                                    className="signup-textarea"
                                />
                            </div>

                            <div className="signup-pending-notice">
                                <AlertTriangle size={18} />
                                <div>
                                    <strong>รอการอนุมัติจากผู้ดูแลระบบ</strong>
                                    <p>คำขอของคุณจะถูกส่งให้ผู้บริหารตรวจสอบ สามารถใช้งานระดับทั่วไปได้ก่อนระหว่างรอการอนุมัติ</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step actions */}
                    <div className="signup-step-actions">
                        {step > 1 ? (
                            <button type="button" className="signup-btn-back" onClick={prevStep} disabled={loading}>
                                <ChevronLeft size={16} /> ย้อนกลับ
                            </button>
                        ) : <span />}
                        <button
                            type="button"
                            className="login-btn signup-btn-next"
                            onClick={nextStep}
                            disabled={loading || checkingEmail || (step === 2 && !selectedRole)}
                        >
                            {loading ? 'กำลังสร้างบัญชี...' : checkingEmail ? 'กำลังตรวจสอบอีเมล...' : (
                                step === totalSteps
                                    ? <>ยืนยันและสมัคร <Check size={16} /></>
                                    : <>ถัดไป <ChevronRight size={16} /></>
                            )}
                        </button>
                    </div>

                    <div className="login-footer">
                        มีบัญชีอยู่แล้ว? <Link to="/" className="link-text">เข้าสู่ระบบ</Link>
                    </div>
                </div>
            </div>

            {/* Success modal for pending accounts */}
            {showSuccess && (
                <div className="admin-modal-overlay" onClick={closeSuccess}>
                    <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="admin-modal-icon pending">
                            <Clock size={32} />
                        </div>
                        <h2>ส่งคำขอเรียบร้อย</h2>
                        <p>
                            คำขอของคุณในสิทธิ์ <strong>{roleMeta?.title}</strong> ถูกส่งให้ผู้ดูแลระบบแล้ว
                            ระหว่างรอการอนุมัติ คุณสามารถเข้าใช้งานได้ในสิทธิ์ระดับทั่วไปก่อน
                        </p>
                        <div className="admin-modal-actions">
                            <button className="login-btn" onClick={closeSuccess}>
                                เข้าสู่แดชบอร์ด
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
