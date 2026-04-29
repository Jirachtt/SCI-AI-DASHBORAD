// Aggregates threshold-based alerts across domains (students, graduation,
// budget, research, OKR) into a single ranked feed for the Alert Center.
//
// Each alert: { id, severity, domain, title, detail, metric, value, target,
//               suggestedAction, data }
//   severity: 'critical' | 'warning' | 'info'

import { getStudentListSync } from '../services/studentDataService';
import { graduationByMajor, currentGraduationStats } from '../data/graduationData';
import { scienceFacultyBudgetData } from '../data/mockData';
import { researchData } from '../data/researchData';
import { strategicData } from '../data/strategicData';
import { ALERT_SOURCE_META } from '../services/alertDataService';

const SEVERITY_RANK = { critical: 3, warning: 2, info: 1 };

// ---------- Thresholds (tunable) ----------
const T = {
    lowGPA: 2.00,            // GPA < 2.00 → critical
    probationGPA: 2.25,      // 2.00 ≤ GPA < 2.25 → warning
    gradRateWarn: 88,        // อัตราจบ < 88% → warning (per major)
    gradRateCrit: 80,        // < 80% → critical
    budgetUseWarn: 0.90,     // ใช้งบ > 90% → warning
    budgetUseCrit: 1.00,     // เกินงบ → critical
    okrGapCrit: 20,          // ต่ำกว่าเป้า > 20% → critical
    okrGapWarn: 10,          // > 10% → warning
    patentPendingDays: 180,  // สิทธิบัตร "รอพิจารณา" → info (monitor)
};

function severityFromGap(gapPct) {
    if (gapPct >= T.okrGapCrit) return 'critical';
    if (gapPct >= T.okrGapWarn) return 'warning';
    return null;
}

function withSource(alert, source) {
    const meta = ALERT_SOURCE_META[source] || { label: source, mode: 'local' };
    return {
        ...alert,
        source,
        sourceLabel: meta.label,
        sourceMode: meta.mode,
        updatedAt: alert.updatedAt || new Date().toISOString(),
    };
}

function sortStudentsByMajorRisk(students = []) {
    const majorLowestGpa = new Map();
    students.forEach(student => {
        const major = student.major || 'ไม่ระบุสาขา';
        const gpa = Number(student.gpa);
        const current = majorLowestGpa.get(major);
        if (!Number.isFinite(current) || gpa < current) {
            majorLowestGpa.set(major, gpa);
        }
    });

    return [...students].sort((a, b) => {
        const majorA = a.major || 'ไม่ระบุสาขา';
        const majorB = b.major || 'ไม่ระบุสาขา';
        const majorRiskDiff = (majorLowestGpa.get(majorA) ?? 99) - (majorLowestGpa.get(majorB) ?? 99);
        if (majorRiskDiff !== 0) return majorRiskDiff;

        const majorDiff = majorA.localeCompare(majorB, 'th');
        if (majorDiff !== 0) return majorDiff;

        const gpaDiff = (Number(a.gpa) || 99) - (Number(b.gpa) || 99);
        if (gpaDiff !== 0) return gpaDiff;

        const yearDiff = (Number(b.year) || 0) - (Number(a.year) || 0);
        if (yearDiff !== 0) return yearDiff;

        return String(a.id || '').localeCompare(String(b.id || ''), 'th');
    });
}

// ---------- Builders ----------
function buildStudentAlerts() {
    const students = getStudentListSync() || [];
    const atRisk = sortStudentsByMajorRisk(students.filter(s =>
        typeof s.gpa === 'number' && s.gpa > 0 && s.gpa < T.lowGPA
    ));
    const probation = sortStudentsByMajorRisk(students.filter(s =>
        typeof s.gpa === 'number' && s.gpa >= T.lowGPA && s.gpa < T.probationGPA
    ));

    const out = [];
    if (atRisk.length > 0) {
        out.push(withSource({
            id: 'stu-low-gpa',
            severity: 'critical',
            domain: 'นักศึกษา',
            title: `นักศึกษาเสี่ยงพ้นสภาพ ${atRisk.length} คน (GPA < ${T.lowGPA.toFixed(2)})`,
            detail: `พบนักศึกษา GPA ต่ำกว่า ${T.lowGPA.toFixed(2)} ซึ่งเข้าข่ายรอพินิจ/พ้นสภาพตามระเบียบ`,
            metric: 'GPA',
            value: atRisk.length,
            target: 0,
            suggestedAction: 'นัดอาจารย์ที่ปรึกษาพบกลุ่มเสี่ยงภายในสัปดาห์นี้',
            data: atRisk,
        }, 'local_students'));
    }
    if (probation.length > 0) {
        out.push(withSource({
            id: 'stu-probation',
            severity: 'warning',
            domain: 'นักศึกษา',
            title: `นักศึกษาเฝ้าระวัง ${probation.length} คน (${T.lowGPA.toFixed(2)} ≤ GPA < ${T.probationGPA.toFixed(2)})`,
            detail: 'GPA ใกล้เกณฑ์วิกฤต ควรติดตาม/ให้คำปรึกษาก่อนตกเกณฑ์',
            metric: 'GPA',
            value: probation.length,
            target: 0,
            suggestedAction: 'ส่งรายงานให้อาจารย์ที่ปรึกษา และเปิดคลินิกวิชาการ',
            data: probation,
        }, 'local_students'));
    }
    return out;
}

function buildGraduationAlerts() {
    const out = [];
    const lowRateMajors = (graduationByMajor || []).filter(m =>
        m.total >= 3 && m.rate < T.gradRateWarn
    );
    lowRateMajors.forEach(m => {
        const sev = m.rate < T.gradRateCrit ? 'critical' : 'warning';
        out.push(withSource({
            id: `grad-rate-${m.major}`,
            severity: sev,
            domain: 'การสำเร็จการศึกษา',
            title: `อัตราจบต่ำ — ${m.major}: ${m.rate.toFixed(1)}%`,
            detail: `คาดว่าสำเร็จ ${m.expected}/${m.total} · รอพินิจ ${m.pending} · ไม่ผ่าน ${m.notPassed}`,
            metric: 'Graduation Rate',
            value: m.rate,
            target: T.gradRateWarn,
            suggestedAction: 'ประชุมภาควิชา วิเคราะห์ bottleneck รายวิชา/โครงงาน',
        }, 'graduation'));
    });

    // Candidate-level pending
    if (currentGraduationStats.pending > 0) {
        out.push(withSource({
            id: 'grad-pending',
            severity: 'warning',
            domain: 'การสำเร็จการศึกษา',
            title: `ผู้คาดว่าสำเร็จ "รอพินิจ" ${currentGraduationStats.pending} คน`,
            detail: `GPA ก้ำกึ่งเกณฑ์ (1.75–1.99) — ต้องพิจารณารายกรณีก่อนปิดภาคเรียน`,
            metric: 'Pending Review',
            value: currentGraduationStats.pending,
            target: 0,
            suggestedAction: 'ส่งคณะกรรมการวิชาการพิจารณาก่อนกำหนดยื่นสำเร็จ',
        }, 'graduation'));
    }
    return out;
}

function buildBudgetAlerts() {
    const out = [];
    const yrly = scienceFacultyBudgetData?.yearly || [];
    const actual = yrly.filter(y => y.type === 'actual');
    const last = actual[actual.length - 1];
    if (last) {
        const ratio = last.expense / last.revenue;
        if (ratio >= T.budgetUseCrit) {
            out.push(withSource({
                id: 'budget-overrun',
                severity: 'critical',
                domain: 'งบประมาณ',
                title: `งบประมาณใช้เกินรายรับ (${last.year})`,
                detail: `รายจ่าย ${last.expense.toFixed(1)} ล้าน > รายรับ ${last.revenue.toFixed(1)} ล้าน`,
                metric: 'Expense/Revenue',
                value: (ratio * 100).toFixed(1),
                target: 100,
                suggestedAction: 'ทบทวนงบลงทุนไตรมาสถัดไป — ชะลอรายการไม่จำเป็น',
            }, 'budget'));
        } else if (ratio >= T.budgetUseWarn) {
            out.push(withSource({
                id: 'budget-warn',
                severity: 'warning',
                domain: 'งบประมาณ',
                title: `งบประมาณใช้สูง (${last.year}) — ${(ratio * 100).toFixed(1)}% ของรายรับ`,
                detail: `รายจ่าย ${last.expense.toFixed(1)} / รายรับ ${last.revenue.toFixed(1)} ล้านบาท`,
                metric: 'Expense/Revenue',
                value: (ratio * 100).toFixed(1),
                target: 90,
                suggestedAction: 'ติดตามการเบิกจ่ายเป็นรายเดือน',
            }, 'budget'));
        }
    }
    return out;
}

function buildResearchAlerts() {
    const out = [];
    const pendingPatents = (researchData?.patents || []).filter(p => p.status === 'รอพิจารณา');
    if (pendingPatents.length > 0) {
        out.push(withSource({
            id: 'research-patents-pending',
            severity: 'info',
            domain: 'การวิจัย',
            title: `สิทธิบัตรรอพิจารณา ${pendingPatents.length} รายการ`,
            detail: pendingPatents.map(p => `${p.id}: ${p.title}`).slice(0, 3).join(' · '),
            metric: 'Pending Patents',
            value: pendingPatents.length,
            target: 0,
            suggestedAction: 'สอบถามสถานะกับกรมทรัพย์สินทางปัญญา / ติดตามเอกสารเพิ่ม',
            data: pendingPatents,
        }, 'research'));
    }

    // Funding YoY drop check
    const funding = (researchData?.fundingTrend || []).filter(f => f.type === 'actual');
    if (funding.length >= 2) {
        const a = funding[funding.length - 2];
        const b = funding[funding.length - 1];
        const drop = ((a.total - b.total) / a.total) * 100;
        if (drop > 20) {
            out.push(withSource({
                id: 'research-funding-drop',
                severity: 'warning',
                domain: 'การวิจัย',
                title: `งบวิจัยลดลง ${drop.toFixed(1)}% (${a.year} → ${b.year})`,
                detail: `จาก ${a.total} ล้าน เหลือ ${b.total} ล้านบาท`,
                metric: 'Funding YoY',
                value: drop.toFixed(1),
                target: 0,
                suggestedAction: 'ผลักดันข้อเสนอทุน วช./สกสว. รอบหน้า',
            }, 'research'));
        }
    }
    return out;
}

function buildStrategicAlerts() {
    const out = [];
    const goals = strategicData?.strategicGoals || [];
    goals.forEach(g => {
        if (!g.target || g.target === 0) return;
        // Exclude goals where "lower is better" — all sample goals are higher-is-better
        const gapPct = ((g.target - g.current) / g.target) * 100;
        const sev = severityFromGap(gapPct);
        if (!sev) return;
        out.push(withSource({
            id: `okr-${g.id}`,
            severity: sev,
            domain: 'ยุทธศาสตร์ (OKR)',
            title: `${g.title} — ห่างจากเป้า ${gapPct.toFixed(1)}%`,
            detail: `${g.description} · ปัจจุบัน ${g.current}${g.unit || ''} / เป้า ${g.target}${g.unit || ''}`,
            metric: g.subtitle,
            value: g.current,
            target: g.target,
            suggestedAction: 'ทบทวน KPI ใน OKR workshop ถัดไป',
        }, 'strategic'));
    });
    return out;
}

// ---------- Public API ----------
export function getAllAlerts() {
    const alerts = [
        ...buildStudentAlerts(),
        ...buildGraduationAlerts(),
        ...buildBudgetAlerts(),
        ...buildResearchAlerts(),
        ...buildStrategicAlerts(),
    ];
    // Sort critical → warning → info
    alerts.sort((a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0));
    return alerts;
}

export function getAlertSummary() {
    const all = getAllAlerts();
    return {
        total: all.length,
        critical: all.filter(a => a.severity === 'critical').length,
        warning: all.filter(a => a.severity === 'warning').length,
        info: all.filter(a => a.severity === 'info').length,
    };
}

export const ALERT_THRESHOLDS = T;
