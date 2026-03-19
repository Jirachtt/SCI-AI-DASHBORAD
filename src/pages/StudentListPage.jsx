import { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Search, Download, UserPlus, X, ChevronLeft, ChevronRight, GraduationCap, Users, AlertTriangle } from 'lucide-react';

/* ────────────── Seed-based Stable Mock Data ────────────── */
const MAJORS = ['วิทยาการคอมพิวเตอร์', 'เทคโนโลยีสารสนเทศ', 'คณิตศาสตร์', 'เคมี', 'ฟิสิกส์', 'ชีววิทยา', 'วิทยาการข้อมูล', 'สถิติ'];
const FIRST_NAMES = ['สมชาย', 'สมหญิง', 'กิตติ', 'ปิยะ', 'วรัญญา', 'จิรา', 'ณัฐ', 'พิมพ์', 'อรุณ', 'ธนา', 'สุภา', 'ชัยวัฒน์', 'นภา', 'วิภา', 'เอก', 'ภูมิ', 'แก้ว', 'ดวง', 'พลอย', 'มาลี'];
const LAST_NAMES = ['ใจดี', 'สุขสันต์', 'รัตนา', 'ศรีสุข', 'วงศ์ดี', 'จันทร์เพ็ญ', 'แสงทอง', 'มาลัย', 'พงษ์ดี', 'บุญมา', 'ทองดี', 'สมบูรณ์', 'เจริญ', 'รุ่งเรือง', 'สว่าง'];

function seededRandom(seed) {
    let s = seed;
    return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

const generateStudents = () => {
    const rng = seededRandom(42);
    return Array.from({ length: 50 }, (_, i) => {
        const year = [1, 2, 3, 4][Math.floor(rng() * 4)];
        const major = MAJORS[Math.floor(rng() * MAJORS.length)];
        const gpa = +(1.5 + rng() * 2.5).toFixed(2);
        const fn = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
        const ln = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
        return {
            id: `6${6 - year}01${String(i).padStart(4, '0')}`,
            name: `${fn} ${ln}`,
            major, year, gpa,
            status: gpa < 2.0 ? 'รอพินิจ' : 'ปกติ'
        };
    });
};

/* ────────────── Styles ────────────── */
const card = {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px', padding: '24px',
};
const inputBase = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px', color: '#fff', padding: '10px 14px', fontSize: '0.9rem',
    outline: 'none', width: '100%', transition: 'border-color 0.2s',
};
const selectStyle = {
    ...inputBase, cursor: 'pointer', appearance: 'auto',
    backgroundColor: '#1a1d23',
};
const optionStyle = {
    backgroundColor: '#1a1d23', color: '#fff',
};
const modalOverlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
};
const modalBox = {
    background: '#1a1d23', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '20px',
    padding: '32px', width: '95%', maxWidth: '520px', position: 'relative',
};

const ROWS_PER_PAGE = 15;

/* ────────────── Component ────────────── */
export default function StudentListPage() {
    const { user } = useAuth();
    const canManage = user?.role === 'dean' || user?.role === 'admin';

    const [students, setStudents] = useState(generateStudents);
    const [searchTerm, setSearchTerm] = useState('');
    const [yearFilter, setYearFilter] = useState('all');
    const [majorFilter, setMajorFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [showAll, setShowAll] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [newStudent, setNewStudent] = useState({ id: '', name: '', major: MAJORS[0], year: '1', gpa: '' });

    /* ── Filtering ── */
    const filtered = useMemo(() => students.filter(s => {
        const q = searchTerm.toLowerCase();
        return (s.name.toLowerCase().includes(q) || s.id.includes(q))
            && (yearFilter === 'all' || s.year === +yearFilter)
            && (majorFilter === 'all' || s.major === majorFilter);
    }), [students, searchTerm, yearFilter, majorFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
    const paged = showAll ? filtered : filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

    /* ── Year Stats  ── */
    const yearStats = [1, 2, 3, 4].map(y => ({
        year: y,
        count: students.filter(s => s.year === y).length,
        icon: [`Y1`, `Y2`, `Y3`, `Y4`][y - 1],
        gradient: [
            'linear-gradient(135deg, #2E86AB, #1a6a8c)',
            'linear-gradient(135deg, #006838, #004d29)',
            'linear-gradient(135deg, #C5A028, #9a7d1e)',
            'linear-gradient(135deg, #E91E63, #c2185b)',
        ][y - 1]
    }));

    /* ── Export CSV ── */
    const exportCSV = () => {
        const BOM = '\uFEFF';
        const header = 'รหัสนักศึกษา,ชื่อ-นามสกุล,สาขาวิชา,ชั้นปี,เกรดเฉลี่ย,สถานะ';
        const rows = filtered.map(s =>
            `${s.id},${s.name},${s.major},${s.year},${s.gpa.toFixed(2)},${s.status}`
        );
        const csv = BOM + [header, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `student_list_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    /* ── Add Student ── */
    const handleAdd = () => {
        if (!newStudent.id || !newStudent.name || !newStudent.gpa) return;
        const gpa = parseFloat(newStudent.gpa);
        if (isNaN(gpa) || gpa < 0 || gpa > 4) return;
        setStudents(prev => [
            ...prev,
            {
                id: newStudent.id,
                name: newStudent.name,
                major: newStudent.major,
                year: parseInt(newStudent.year),
                gpa,
                status: gpa < 2.0 ? 'รอพินิจ' : 'ปกติ'
            }
        ]);
        setNewStudent({ id: '', name: '', major: MAJORS[0], year: '1', gpa: '' });
        setShowModal(false);
    };

    const statusColor = (s) => s === 'ปกติ' ? '#4CAF50' : s === 'รอพินิจ' ? '#FFC107' : '#ef4444';

    return (
        <div className="dashboard-content">
            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>
                        <GraduationCap size={24} style={{ verticalAlign: '-4px', marginRight: 8 }} />
                        รายชื่อนักศึกษา
                    </h1>
                    <p style={{ color: '#9ca3af', margin: '4px 0 0', fontSize: '0.9rem' }}>
                        ข้อมูลนักศึกษาคณะวิทยาศาสตร์ (ปี 1 – ปี 4) • ทั้งหมด <strong style={{ color: '#fff' }}>{students.length}</strong> คน
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={exportCSV} style={{
                        display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px',
                        borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
                        color: '#fff', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, transition: 'all 0.2s',
                    }}>
                        <Download size={16} /> Export CSV
                    </button>
                    {canManage && (
                        <button onClick={() => setShowModal(true)} style={{
                            display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px',
                            borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #006838, #00a651)',
                            color: '#fff', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, transition: 'all 0.2s',
                        }}>
                            <UserPlus size={16} /> เพิ่มนักศึกษา
                        </button>
                    )}
                </div>
            </div>

            {/* ── Year Stat Cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                {yearStats.map(ys => (
                    <div key={ys.year} onClick={() => { setYearFilter(String(ys.year)); setPage(1); }}
                        style={{
                            ...card, cursor: 'pointer', position: 'relative', overflow: 'hidden',
                            borderColor: yearFilter === String(ys.year) ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.08)',
                            transition: 'border-color 0.2s',
                        }}>
                        <div style={{ position: 'absolute', top: 0, right: 0, width: '60px', height: '60px', background: ys.gradient, borderRadius: '0 16px 0 40px', opacity: 0.25 }} />
                        <div style={{ fontSize: '0.82rem', color: '#9ca3af', fontWeight: 600, marginBottom: '6px' }}>
                            {ys.icon} นักศึกษาปี {ys.year}
                        </div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{ys.count} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#9ca3af' }}>คน</span></div>
                    </div>
                ))}
            </div>

            {/* ── Search & Filters ── */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 280px' }}>
                    <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input
                        type="text" placeholder="ค้นหาชื่อ หรือ รหัสนักศึกษา..."
                        value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
                        style={{ ...inputBase, paddingLeft: '38px' }}
                    />
                </div>
                <select value={yearFilter} onChange={e => { setYearFilter(e.target.value); setPage(1); }}
                    style={{ ...selectStyle, width: 'auto', minWidth: '140px' }}>
                    <option value="all" style={optionStyle}>ทุกชั้นปี</option>
                    {[1, 2, 3, 4].map(y => <option key={y} value={y} style={optionStyle}>ปี {y}</option>)}
                </select>
                <select value={majorFilter} onChange={e => { setMajorFilter(e.target.value); setPage(1); }}
                    style={{ ...selectStyle, width: 'auto', minWidth: '200px' }}>
                    <option value="all" style={optionStyle}>ทุกสาขาวิชา</option>
                    {MAJORS.map(m => <option key={m} value={m} style={optionStyle}>{m}</option>)}
                </select>
            </div>

            {/* ── Table ── */}
            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                                <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: '0.82rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>รหัส</th>
                                <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: '0.82rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>ชื่อ-นามสกุล</th>
                                <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: '0.82rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>สาขาวิชา</th>
                                <th style={{ padding: '14px 18px', textAlign: 'center', fontSize: '0.82rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>ชั้นปี</th>
                                <th style={{ padding: '14px 18px', textAlign: 'center', fontSize: '0.82rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>GPA</th>
                                <th style={{ padding: '14px 18px', textAlign: 'center', fontSize: '0.82rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>สถานะ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paged.length > 0 ? paged.map((s, idx) => (
                                <tr key={s.id} style={{
                                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                                    transition: 'background 0.15s',
                                }}>
                                    <td style={{ padding: '12px 18px', fontFamily: 'monospace', fontSize: '0.88rem', color: '#9ca3af' }}>{s.id}</td>
                                    <td style={{ padding: '12px 18px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                                width: 32, height: 32, borderRadius: '50%',
                                                background: 'linear-gradient(135deg, #2E86AB, #1a6a8c)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.75rem', fontWeight: 700, color: '#fff', flexShrink: 0
                                            }}>
                                                {s.name.charAt(0)}
                                            </div>
                                            <span style={{ fontWeight: 600 }}>{s.name}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px 18px', fontSize: '0.88rem' }}>{s.major}</td>
                                    <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                                        <span style={{ padding: '3px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, background: 'rgba(255,255,255,0.08)' }}>
                                            ปี {s.year}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 18px', textAlign: 'center', fontWeight: 700, color: s.gpa < 2.0 ? '#ef4444' : s.gpa >= 3.5 ? '#4CAF50' : '#fff' }}>
                                        {s.gpa.toFixed(2)}
                                    </td>
                                    <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                                        <span style={{
                                            padding: '4px 14px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600,
                                            color: statusColor(s.status),
                                            background: statusColor(s.status) + '18',
                                            border: `1px solid ${statusColor(s.status)}30`,
                                        }}>
                                            {s.status}
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                                        <Users size={40} style={{ marginBottom: 12, opacity: 0.3 }} /><br />
                                        ไม่พบข้อมูลนักศึกษาที่ตรงกับเงื่อนไข
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination & Show All */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 18px', borderTop: '1px solid rgba(255,255,255,0.06)',
                    fontSize: '0.85rem', color: '#9ca3af', flexWrap: 'wrap', gap: '10px'
                }}>
                    <span>
                        {showAll
                            ? `แสดงทั้งหมด ${filtered.length} รายการ`
                            : `แสดง ${(page - 1) * ROWS_PER_PAGE + 1}–${Math.min(page * ROWS_PER_PAGE, filtered.length)} จาก ${filtered.length} รายการ`
                        }
                    </span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button onClick={() => { setShowAll(!showAll); setPage(1); }}
                            style={{
                                ...inputBase, width: 'auto', padding: '6px 14px', textAlign: 'center', cursor: 'pointer',
                                background: showAll ? 'rgba(0,104,56,0.4)' : inputBase.background,
                                borderColor: showAll ? '#006838' : 'rgba(255,255,255,0.12)',
                                fontWeight: 600, fontSize: '0.82rem',
                            }}>
                            {showAll ? 'แบ่งหน้า' : 'แสดงทั้งหมด'}
                        </button>
                        {!showAll && totalPages > 1 && (
                            <>
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                    style={{ ...inputBase, width: 36, padding: '6px', textAlign: 'center', cursor: page === 1 ? 'default' : 'pointer', opacity: page === 1 ? 0.3 : 1 }}>
                                    <ChevronLeft size={16} />
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                    <button key={p} onClick={() => setPage(p)}
                                        style={{
                                            ...inputBase, width: 36, padding: '6px', textAlign: 'center', cursor: 'pointer',
                                            background: p === page ? 'rgba(0,104,56,0.4)' : inputBase.background,
                                            borderColor: p === page ? '#006838' : inputBase.borderColor,
                                            fontWeight: p === page ? 700 : 400,
                                        }}>
                                        {p}
                                    </button>
                                ))}
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                    style={{ ...inputBase, width: 36, padding: '6px', textAlign: 'center', cursor: page === totalPages ? 'default' : 'pointer', opacity: page === totalPages ? 0.3 : 1 }}>
                                    <ChevronRight size={16} />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Add Student Modal ── */}
            {showModal && (
                <div style={modalOverlay} onClick={() => setShowModal(false)}>
                    <div style={modalBox} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setShowModal(false)}
                            style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                            <X size={20} />
                        </button>

                        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 6px' }}>
                            <UserPlus size={20} style={{ verticalAlign: '-3px', marginRight: 8 }} />เพิ่มนักศึกษาใหม่
                        </h2>
                        <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '24px' }}>กรอกข้อมูลนักศึกษาที่ต้องการเพิ่มเข้าระบบ</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Student ID */}
                            <div>
                                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', display: 'block' }}>รหัสนักศึกษา *</label>
                                <input value={newStudent.id} onChange={e => setNewStudent(p => ({ ...p, id: e.target.value }))}
                                    placeholder="เช่น 65010050" style={inputBase} />
                            </div>
                            {/* Name */}
                            <div>
                                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', display: 'block' }}>ชื่อ-นามสกุล *</label>
                                <input value={newStudent.name} onChange={e => setNewStudent(p => ({ ...p, name: e.target.value }))}
                                    placeholder="เช่น สมชาย ใจดี" style={inputBase} />
                            </div>
                            {/* Major & Year */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', display: 'block' }}>สาขาวิชา</label>
                                    <select value={newStudent.major} onChange={e => setNewStudent(p => ({ ...p, major: e.target.value }))}
                                        style={selectStyle}>
                                        {MAJORS.map(m => <option key={m} value={m} style={optionStyle}>{m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', display: 'block' }}>ชั้นปี</label>
                                    <select value={newStudent.year} onChange={e => setNewStudent(p => ({ ...p, year: e.target.value }))}
                                        style={selectStyle}>
                                        {[1, 2, 3, 4].map(y => <option key={y} value={y} style={optionStyle}>ปี {y}</option>)}
                                    </select>
                                </div>
                            </div>
                            {/* GPA */}
                            <div>
                                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', display: 'block' }}>เกรดเฉลี่ย (GPA) *</label>
                                <input type="number" step="0.01" min="0" max="4"
                                    value={newStudent.gpa} onChange={e => setNewStudent(p => ({ ...p, gpa: e.target.value }))}
                                    placeholder="0.00 - 4.00" style={inputBase} />
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '12px', marginTop: '28px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowModal(false)}
                                style={{ padding: '10px 24px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                                ยกเลิก
                            </button>
                            <button onClick={handleAdd}
                                style={{
                                    padding: '10px 24px', borderRadius: '10px', border: 'none', fontWeight: 600,
                                    background: (!newStudent.id || !newStudent.name || !newStudent.gpa) ? '#333' : 'linear-gradient(135deg, #006838, #00a651)',
                                    color: (!newStudent.id || !newStudent.name || !newStudent.gpa) ? '#666' : '#fff',
                                    cursor: (!newStudent.id || !newStudent.name || !newStudent.gpa) ? 'not-allowed' : 'pointer',
                                }}>
                                เพิ่มนักศึกษา
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
