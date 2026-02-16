import { useState } from 'react';
import { CheckCircle, AlertCircle, Calendar, Star, Clock, BookOpen, Award } from 'lucide-react';

export default function GraduationCheckPage() {
    const graduationData = {
        gpa: { current: 3.15, required: 1.75 },
        credits: {
            current: 112,
            required: 130,
            details: [
                { name: 'หมวดวิชาศึกษาทั่วไป', current: 30, required: 30, status: 'complete' },
                { name: 'หมวดวิชาเฉพาะ', current: 76, required: 94, status: 'incomplete' },
                { name: 'หมวดวิชาเลือกเสรี', current: 6, required: 6, status: 'complete' }
            ]
        },
        activities: {
            current: 60,
            required: 80,
            details: [
                { id: 1, name: 'กิจกรรมระดับมหาวิทยาลัย', requiredActs: 5, requiredHours: 25, currentActs: 4, currentHours: 18, color: '#FF6B6B' },
                { id: 2, name: 'กิจกรรมระดับคณะ/วิทยาลัย', requiredActs: 3, requiredHours: 15, currentActs: 2, currentHours: 12, color: '#4ECDC4' },
                { id: 3, name: 'กิจกรรมเลือกเสรี', requiredActs: 8, requiredHours: 40, currentActs: 6, currentHours: 30, color: '#FFE66D' }
            ]
        }
    };

    const recommendedActivities = [
        { id: 1, name: 'Sci-Week 2025 (สัปดาห์วิทยาศาสตร์)', date: '18-20 ส.ค.', hours: 12, type: 'วิชาการ', category: 'คณะ/วิทยาลัย' },
        { id: 2, name: 'MJU Clean Campus', date: '5 ก.ย.', hours: 6, type: 'จิตอาสา', category: 'มหาวิทยาลัย' },
        { id: 3, name: 'อบรม English for Science', date: '15 ก.ย.', hours: 3, type: 'พัฒนาทักษะ', category: 'เลือกเสรี' },
        { id: 4, name: 'Freshy Games (Staff)', date: '25-27 ต.ค.', hours: 18, type: 'สันทนาการ', category: 'เลือกเสรี' },
    ];

    const pct = (c, r) => Math.min(100, (c / r) * 100);

    // Shared card style
    const cardStyle = {
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        padding: '24px',
    };

    const headerStyle = {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '20px', paddingBottom: '12px',
        borderBottom: '1px solid rgba(255,255,255,0.06)'
    };

    const labelStyle = { fontSize: '0.88rem', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.02em', textTransform: 'uppercase' };

    const trackStyle = (h = 6) => ({ height: h, background: 'rgba(255,255,255,0.08)', borderRadius: h, overflow: 'hidden', width: '100%' });

    const fillStyle = (w, color) => ({ height: '100%', width: `${w}%`, background: color, borderRadius: 'inherit', transition: 'width 0.6s ease' });

    return (
        <div className="dashboard-content">
            <header className="page-header">
                <div>
                    <h1>ตรวจสอบเงื่อนไขการสำเร็จการศึกษา</h1>
                    <p>Requirements Check for Graduation</p>
                </div>
            </header>

            {/* ── Top 3 Status Cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '28px' }}>

                {/* ─── GPA ─── */}
                <div style={cardStyle}>
                    <div style={headerStyle}>
                        <span style={labelStyle}><Award size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />เกรดเฉลี่ยสะสม (GPAX)</span>
                        {graduationData.gpa.current >= graduationData.gpa.required
                            ? <CheckCircle size={20} color="#4CAF50" />
                            : <AlertCircle size={20} color="#F44336" />}
                    </div>
                    <div style={{ textAlign: 'center', padding: '8px 0' }}>
                        <div style={{ fontSize: '2.8rem', fontWeight: 800, color: graduationData.gpa.current >= graduationData.gpa.required ? '#4CAF50' : '#FFC107', lineHeight: 1.1 }}>
                            {graduationData.gpa.current.toFixed(2)}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: '8px' }}>เกณฑ์ขั้นต่ำ: {graduationData.gpa.required.toFixed(2)}</div>
                    </div>
                </div>

                {/* ─── Credits ─── */}
                <div style={cardStyle}>
                    <div style={headerStyle}>
                        <span style={labelStyle}><BookOpen size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />หน่วยกิตรวม (Credits)</span>
                    </div>

                    {/* Big number */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '14px' }}>
                        <span style={{ fontSize: '2rem', fontWeight: 800, color: '#2E86AB' }}>{graduationData.credits.current}</span>
                        <span style={{ fontSize: '1rem', color: '#9ca3af' }}>/ {graduationData.credits.required} หน่วยกิต</span>
                    </div>

                    {/* Progress bar */}
                    <div style={trackStyle(8)}>
                        <div style={fillStyle(pct(graduationData.credits.current, graduationData.credits.required), '#2E86AB')} />
                    </div>

                    {/* Details */}
                    <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {graduationData.credits.details.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                <span style={{ color: item.status === 'complete' ? '#4CAF50' : '#9ca3af' }}>
                                    {item.status === 'complete' ? '✓' : '○'} {item.name}
                                </span>
                                <span style={{ fontWeight: 600, color: item.status === 'complete' ? '#4CAF50' : '#FFC107' }}>
                                    {item.current}/{item.required}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ─── Activity Hours (Summary) ─── */}
                <div style={cardStyle}>
                    <div style={headerStyle}>
                        <span style={labelStyle}><Clock size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />ชั่วโมงกิจกรรม</span>
                        <span style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: '20px', background: 'rgba(233,30,99,0.15)', color: '#E91E63', fontWeight: 600 }}>
                            หลักสูตร 4 ปี
                        </span>
                    </div>

                    {/* Big number */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '14px' }}>
                        <span style={{ fontSize: '2rem', fontWeight: 800, color: '#E91E63' }}>{graduationData.activities.current}</span>
                        <span style={{ fontSize: '1rem', color: '#9ca3af' }}>/ {graduationData.activities.required} ชั่วโมง</span>
                    </div>

                    {/* Progress bar */}
                    <div style={trackStyle(8)}>
                        <div style={fillStyle(pct(graduationData.activities.current, graduationData.activities.required), '#E91E63')} />
                    </div>

                    {graduationData.activities.current < graduationData.activities.required && (
                        <div style={{
                            marginTop: '12px', padding: '8px 12px', borderRadius: '8px',
                            background: 'rgba(255,193,7,0.08)', border: '1px solid rgba(255,193,7,0.2)',
                            display: 'flex', alignItems: 'center', gap: '8px',
                            fontSize: '0.82rem', color: '#FFC107'
                        }}>
                            <AlertCircle size={14} />
                            <span>ขาดอีก <strong>{graduationData.activities.required - graduationData.activities.current}</strong> ชั่วโมง</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Activity Detail Breakdown ── */}
            <div style={{ ...cardStyle, marginBottom: '28px' }}>
                <div style={headerStyle}>
                    <span style={labelStyle}>📊 รายละเอียดการเข้าร่วมกิจกรรม (เกณฑ์หลักสูตร 4 ปี)</span>
                </div>

                {/* Table-like layout */}
                <table className="data-table" style={{ width: '100%' }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left' }}>ประเภทกิจกรรม</th>
                            <th style={{ textAlign: 'center' }}>จำนวนกิจกรรม</th>
                            <th style={{ textAlign: 'center' }}>ชั่วโมง</th>
                            <th style={{ textAlign: 'left', width: '30%' }}>ความคืบหน้า</th>
                            <th style={{ textAlign: 'center' }}>สถานะ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {graduationData.activities.details.map((item) => {
                            const hoursPct = pct(item.currentHours, item.requiredHours);
                            const isComplete = item.currentHours >= item.requiredHours && item.currentActs >= item.requiredActs;
                            return (
                                <tr key={item.id}>
                                    <td style={{ fontWeight: 600 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: 4, height: 28, borderRadius: 2, background: item.color }} />
                                            {item.name}
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span style={{ fontWeight: 700, color: item.currentActs >= item.requiredActs ? '#4CAF50' : '#fff' }}>
                                            {item.currentActs}
                                        </span>
                                        <span style={{ color: '#9ca3af' }}> / ≥{item.requiredActs}</span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span style={{ fontWeight: 700, color: item.currentHours >= item.requiredHours ? '#4CAF50' : '#fff' }}>
                                            {item.currentHours}
                                        </span>
                                        <span style={{ color: '#9ca3af' }}> / ≥{item.requiredHours}</span>
                                    </td>
                                    <td>
                                        <div style={trackStyle(6)}>
                                            <div style={fillStyle(hoursPct, item.color)} />
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        {isComplete
                                            ? <span style={{ color: '#4CAF50', fontWeight: 600 }}>✓ ครบ</span>
                                            : <span style={{ color: '#FFC107', fontWeight: 600 }}>○ ยังไม่ครบ</span>}
                                    </td>
                                </tr>
                            );
                        })}
                        {/* Totals Row */}
                        <tr style={{ borderTop: '2px solid rgba(255,255,255,0.1)', fontWeight: 700 }}>
                            <td>รวม</td>
                            <td style={{ textAlign: 'center' }}>
                                <span>{graduationData.activities.details.reduce((s, i) => s + i.currentActs, 0)}</span>
                                <span style={{ color: '#9ca3af' }}> / ≥{graduationData.activities.details.reduce((s, i) => s + i.requiredActs, 0)}</span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                                <span style={{ color: '#E91E63' }}>{graduationData.activities.current}</span>
                                <span style={{ color: '#9ca3af' }}> / ≥{graduationData.activities.required}</span>
                            </td>
                            <td>
                                <div style={trackStyle(6)}>
                                    <div style={fillStyle(pct(graduationData.activities.current, graduationData.activities.required), '#E91E63')} />
                                </div>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                                {graduationData.activities.current >= graduationData.activities.required
                                    ? <span style={{ color: '#4CAF50' }}>✓ ครบ</span>
                                    : <span style={{ color: '#FFC107' }}>○ ยังไม่ครบ</span>}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* ── กิจกรรมแนะนำ ── */}
            {graduationData.activities.current < graduationData.activities.required && (
                <div style={cardStyle}>
                    <div style={headerStyle}>
                        <span style={labelStyle}><Star size={14} style={{ marginRight: 6, verticalAlign: '-2px', color: '#FFC107' }} />กิจกรรมแนะนำ (ช่วยเก็บชั่วโมง)</span>
                    </div>
                    <table className="data-table" style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th>ชื่อกิจกรรม</th>
                                <th>ประเภทกิจกรรม</th>
                                <th>วันที่จัด</th>
                                <th>ประเภท</th>
                                <th>ชั่วโมงที่ได้รับ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recommendedActivities.map((a) => (
                                <tr key={a.id}>
                                    <td style={{ fontWeight: 500 }}>{a.name}</td>
                                    <td>
                                        <span style={{
                                            fontSize: '0.8rem', padding: '3px 10px', borderRadius: '20px',
                                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                                            whiteSpace: 'nowrap'
                                        }}>{a.category}</span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
                                            <Calendar size={14} color="#9ca3af" /> {a.date}
                                        </div>
                                    </td>
                                    <td><span className="badge">{a.type}</span></td>
                                    <td style={{ color: '#4CAF50', fontWeight: 'bold' }}>+{a.hours} ชม.</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
