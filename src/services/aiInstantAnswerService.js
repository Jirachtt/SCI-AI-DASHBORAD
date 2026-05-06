import { courseAnalyticsData } from '../data/courseAnalyticsData';
import {
    calculateTcasImpact,
    getTcasSummary,
    tcasPlanningData,
} from '../data/tcasAdmissionsData';
import {
    formatScienceActivityDate,
    getScienceActivitySummary,
} from '../data/scienceActivitiesData';
import { SCIENCE_MAJORS } from '../data/studentListData';
import { scienceFacultyBudgetData } from '../data/mockData';
import { getStudentListSync, isLiveData } from './studentDataService';
import {
    getSharedDashboardDatasetMetaSync,
    getSharedDashboardDatasetSync,
} from './sharedDashboardDataService';
import { buildAIAccessDeniedResult, canAIUseAnyInternalSection } from '../utils/aiAccessPolicy';

const CHART_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2'];

function normalizeText(value) {
    return String(value || '').toLowerCase().trim();
}

function isChartIntent(text) {
    return /กราฟ|chart|plot|แผนภูมิ|แผนภาพ|visual|เปรียบเทียบ|กระจาย/.test(text);
}

function formatNumber(value, digits = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '-';
    return number.toLocaleString('th-TH', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
}

function average(values = []) {
    const nums = values.map(Number).filter(Number.isFinite);
    if (nums.length === 0) return null;
    return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function sum(values = []) {
    return values.map(Number).filter(Number.isFinite).reduce((total, value) => total + value, 0);
}

function percent(value, total, digits = 1) {
    const numerator = Number(value);
    const denominator = Number(total);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return '-';
    return `${formatNumber((numerator / denominator) * 100, digits)}%`;
}

function datasetSourceLine(datasetId, label) {
    const meta = getSharedDashboardDatasetMetaSync(datasetId);
    const status = meta?.isLive ? 'live/realtime' : 'ข้อมูลที่เว็บใช้ตอนนี้';
    const updated = meta?.updatedAt ? `, อัปเดต ${meta.updatedAt.toLocaleString('th-TH')}` : '';
    const source = meta?.sourceUrl ? ` — ${meta.sourceUrl}` : '';
    return `แหล่งข้อมูล: ${label} (${status}${updated})${source}`;
}

function sourceLine() {
    return isLiveData()
        ? 'แหล่งข้อมูล: ข้อมูลนักศึกษา live/realtime จาก Firestore หรือไฟล์อัปโหลดล่าสุด'
        : 'แหล่งข้อมูล: ข้อมูลนักศึกษาที่เว็บใช้ตอนนี้ (fallback/demo จนกว่าจะ sync ข้อมูลจริง)';
}

function getScienceStudents() {
    const rows = getStudentListSync();
    const scienceRows = rows.filter(student => SCIENCE_MAJORS.includes(student.major));
    return scienceRows.length > 0 ? scienceRows : rows;
}

function buildStudentRiskTrendAnswer(question) {
    const q = normalizeText(question);
    const isRiskQuestion = /กลุ่มเสี่ยง|เสี่ยง|พ้นสภาพ|รอพินิจ|gpa\s*<\s*2|gpa\s*ต่ำกว่า|ต่ำกว่า\s*2|เกรดต่ำ/.test(q);
    const isStudentQuestion = /นักศึกษา|นิสิต|student|gpa|เกรด/.test(q);
    if (!isRiskQuestion || !isStudentQuestion) return null;

    const students = getScienceStudents();
    if (students.length === 0) return null;

    const riskRows = students
        .map(student => ({ ...student, gpaValue: Number(student.gpa) }))
        .filter(student => Number.isFinite(student.gpaValue) && student.gpaValue < 2);

    const byMajor = new Map();
    const byYear = new Map();
    const severity = { critical: 0, warning: 0, watch: 0 };

    riskRows.forEach(student => {
        const major = student.major || 'ไม่ระบุสาขา';
        const year = student.year || '-';
        const current = byMajor.get(major) || { count: 0, gpas: [], years: new Map(), critical: 0 };
        current.count += 1;
        current.gpas.push(student.gpaValue);
        current.years.set(year, (current.years.get(year) || 0) + 1);
        if (student.gpaValue < 1.75) current.critical += 1;
        byMajor.set(major, current);
        byYear.set(year, (byYear.get(year) || 0) + 1);

        if (student.gpaValue < 1.75) severity.critical += 1;
        else if (student.gpaValue < 1.9) severity.warning += 1;
        else severity.watch += 1;
    });

    const majorRows = [...byMajor.entries()]
        .map(([major, value]) => {
            const topYear = [...value.years.entries()].sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))[0];
            return {
                major,
                count: value.count,
                minGpa: Math.min(...value.gpas),
                avgGpa: average(value.gpas),
                critical: value.critical,
                topYear: topYear ? topYear[0] : '-',
                topYearCount: topYear ? topYear[1] : 0,
            };
        })
        .sort((a, b) => b.count - a.count || a.minGpa - b.minGpa || a.major.localeCompare(b.major, 'th'));

    const lowerYearRisk = sum([byYear.get(1), byYear.get('1'), byYear.get(2), byYear.get('2')]);
    const upperYearRisk = sum([byYear.get(3), byYear.get('3'), byYear.get(4), byYear.get('4')]);
    const trendNote = lowerYearRisk > upperYearRisk
        ? 'สัญญาณเสี่ยงกระจุกในชั้นปีต้นมากกว่า ควรรีบแก้ตั้งแต่รายวิชาพื้นฐานและระบบอาจารย์ที่ปรึกษา'
        : upperYearRisk > lowerYearRisk
        ? 'สัญญาณเสี่ยงกระจุกในชั้นปีปลายมากกว่า ควรเร่งทำแผนเรียนซ่อม/ลงซ้ำและตรวจเงื่อนไขจบรายบุคคล'
        : 'สัญญาณเสี่ยงกระจายหลายชั้นปี ควรจัดการทั้งรายวิชาพื้นฐานและแผนจบควบคู่กัน';

    let text = `**นักศึกษากลุ่มเสี่ยง GPA ต่ำกว่า 2.00**\n\n`;
    text += `จากข้อมูลในเว็บตอนนี้พบ **${formatNumber(riskRows.length)} คน** จากนักศึกษาคณะวิทยาศาสตร์ **${formatNumber(students.length)} คน** (${percent(riskRows.length, students.length)})\n`;
    text += `ภาพแนวโน้มจากข้อมูลปัจจุบัน: **${trendNote}**\n`;
    text += `หมายเหตุ: ระบบมี snapshot ปัจจุบันครบพอสำหรับจัดลำดับความเสี่ยง แต่ยังไม่มี time-series รายบุคคลหลายเทอม จึงยังไม่สรุปว่า “เพิ่มขึ้น/ลดลงจากเทอมก่อน” แบบยืนยันได้\n\n`;
    text += `**ระดับความเร่งด่วน**\n`;
    text += `- วิกฤต GPA < 1.75: **${formatNumber(severity.critical)} คน**\n`;
    text += `- เฝ้าระวังสูง GPA 1.75-1.89: **${formatNumber(severity.warning)} คน**\n`;
    text += `- ใกล้เส้น GPA 1.90-1.99: **${formatNumber(severity.watch)} คน**\n\n`;

    if (majorRows.length > 0) {
        text += `**สาขาที่ควรดูแลก่อน**\n`;
        text += majorRows.slice(0, 5).map((row, index) =>
            `${index + 1}. ${row.major}: ${formatNumber(row.count)} คน, GPA ต่ำสุด ${formatNumber(row.minGpa, 2)}, เฉลี่ยกลุ่มเสี่ยง ${formatNumber(row.avgGpa, 2)}, พบมากสุดปี ${row.topYear} (${formatNumber(row.topYearCount)} คน)`
        ).join('\n');
        text += '\n\n';
    }

    text += `**ควรทำต่อทันที**\n`;
    text += `1. ให้อาจารย์ที่ปรึกษานัดกลุ่ม GPA < 1.75 ภายในสัปดาห์นี้ก่อน\n`;
    text += `2. แยกสาเหตุรายวิชา: ติด F/U, ถอนรายวิชา, หน่วยกิตค้าง, หรือขาดเรียน แล้วทำแผนลงซ้ำ/ติวเสริม\n`;
    text += `3. ติดตามหลังกลางภาคและก่อนลงทะเบียนรอบถัดไป โดยใช้ Alert Center เรียง GPA ต่ำสุดขึ้นก่อน\n`;
    text += `4. หากเป็นปี 3-4 ให้ตรวจเงื่อนไขจบควบคู่กับชั่วโมงกิจกรรมและหน่วยกิตทันที\n\n`;
    text += `_${sourceLine()}_`;

    return { text, chart: null };
}

function buildStudentMajorDeclineAnswer(question) {
    const q = normalizeText(question);
    const asksDecline = /ลดลง|น้อยลง|หายไป|drop|decline|แนวโน้ม/.test(q);
    const asksMajor = /สาขา|major|หลักสูตร/.test(q);
    const asksStudent = /นักศึกษา|นิสิต|student/.test(q);
    if (!asksDecline || !asksMajor || !asksStudent) return null;

    const students = getScienceStudents();
    if (students.length === 0) return null;

    const byMajor = new Map();
    students.forEach(student => {
        const major = student.major || 'ไม่ระบุสาขา';
        const year = Number(student.year);
        const current = byMajor.get(major) || { major, total: 0, years: { 1: 0, 2: 0, 3: 0, 4: 0 }, gpas: [] };
        current.total += 1;
        if ([1, 2, 3, 4].includes(year)) current.years[year] += 1;
        if (Number.isFinite(Number(student.gpa))) current.gpas.push(Number(student.gpa));
        byMajor.set(major, current);
    });

    const rows = [...byMajor.values()]
        .map(row => {
            const upperAvg = average([row.years[2], row.years[3], row.years[4]]) || 0;
            const intakeGap = Math.max(0, upperAvg - row.years[1]);
            const y4Gap = Math.max(0, row.years[4] - row.years[1]);
            return {
                ...row,
                upperAvg,
                intakeGap,
                y4Gap,
                avgGpa: average(row.gpas),
            };
        })
        .sort((a, b) => b.intakeGap - a.intakeGap || b.y4Gap - a.y4Gap || b.total - a.total);

    const top = rows[0];
    let text = `**สาขาที่มีสัญญาณนักศึกษาลดลงมากที่สุด**\n\n`;
    text += `ระบบยังไม่มีข้อมูล Reg/Admissions ย้อนหลังรายสาขาแบบ time-series ครบทุกปี จึงใช้ **cohort proxy จากข้อมูลในเว็บตอนนี้**: เปรียบเทียบจำนวนนักศึกษาปี 1 กับค่าเฉลี่ยปี 2-4 ของสาขาเดียวกัน\n\n`;

    if (top && top.intakeGap > 0) {
        text += `สาขาที่ควรตรวจสอบก่อนคือ **${top.major}**: ปี 1 มี ${formatNumber(top.years[1])} คน เทียบกับค่าเฉลี่ยปี 2-4 ที่ ${formatNumber(top.upperAvg, 1)} คน ส่วนต่างประมาณ **${formatNumber(top.intakeGap, 1)} คน**\n\n`;
    } else {
        text += `จากข้อมูลชั้นปีปัจจุบันยังไม่เห็นสาขาที่ปี 1 ต่ำกว่าค่าเฉลี่ยปี 2-4 อย่างชัดเจน แต่ควรตรวจด้วยข้อมูลรับเข้า/คงอยู่ย้อนหลังจาก Reg เพื่อยืนยันอีกชั้น\n\n`;
    }

    text += `**อันดับสัญญาณลดลงจาก cohort proxy**\n`;
    text += rows.slice(0, 5).map((row, index) =>
        `${index + 1}. ${row.major}: ปี 1 ${formatNumber(row.years[1])} คน, เฉลี่ยปี 2-4 ${formatNumber(row.upperAvg, 1)} คน, gap ${formatNumber(row.intakeGap, 1)} คน, GPA เฉลี่ย ${row.avgGpa == null ? '-' : formatNumber(row.avgGpa, 2)}`
    ).join('\n');

    text += `\n\n**ควรทำอะไรต่อ**\n`;
    text += `1. ดึงข้อมูล Reg/TCAS ย้อนหลัง 5 ปีของสาขาที่ติดอันดับ เพื่อแยก “รับเข้าน้อย” ออกจาก “คงอยู่น้อย/ลาออกเยอะ”\n`;
    text += `2. ตรวจจุดหลุดใน funnel: สมัคร > ผ่านคัดเลือก > รายงานตัว > คงอยู่หลังปี 1\n`;
    text += `3. ใช้จุดเด่นสาขาและรายวิชาที่น่าสนใจทำแคมเปญ TCAS รอบถัดไป เฉพาะสาขาที่ gap สูง\n`;
    text += `4. ถ้า gap มาพร้อม GPA ต่ำ ให้เพิ่มพี่เลี้ยง/ติวพื้นฐานในปี 1 ก่อนจะกลายเป็นกลุ่มเสี่ยงพ้นสภาพ\n\n`;
    text += `_${sourceLine()}_`;

    return { text, chart: null };
}

function buildBudgetCautionAnswer(question) {
    const q = normalizeText(question);
    const asksBudget = /งบ|budget|รายรับ|รายจ่าย|การเงิน/.test(q);
    const asksCaution = /ระวัง|จุดไหน|เสี่ยง|ควร|วิเคราะห์|ปี\s*2570|2570/.test(q);
    if (!asksBudget || !asksCaution || isChartIntent(q)) return null;

    const dataset = getSharedDashboardDatasetSync('science_budget') || scienceFacultyBudgetData;
    const yearly = Array.isArray(dataset?.yearly) ? dataset.yearly : [];
    if (yearly.length === 0) return null;

    const requestedYear = q.match(/25\d{2}/)?.[0] || '2570';
    const current = yearly.find(row => String(row.year) === requestedYear) || yearly[yearly.length - 1];
    const previous = [...yearly].reverse().find(row => Number(row.year) < Number(current.year));
    const revenue = Number(current.revenue);
    const expense = Number(current.expense);
    const surplus = Number(current.surplus ?? (revenue - expense));
    const expenseRatio = Number.isFinite(revenue) && revenue !== 0 ? (expense / revenue) * 100 : null;
    const margin = Number.isFinite(revenue) && revenue !== 0 ? (surplus / revenue) * 100 : null;
    const previousRevenue = Number(previous?.revenue);
    const previousExpense = Number(previous?.expense);
    const comparablePrevious = previous &&
        Number.isFinite(previousRevenue) &&
        Number.isFinite(previousExpense) &&
        previousRevenue > 0 &&
        previousExpense > 0 &&
        Math.max(Math.abs(revenue), Math.abs(previousRevenue)) / Math.max(1, Math.min(Math.abs(revenue), Math.abs(previousRevenue))) <= 5;
    const revenueChange = comparablePrevious ? revenue - previousRevenue : null;
    const expenseChange = comparablePrevious ? expense - previousExpense : null;
    const topExpenses = [...(current.expenseBreakdown || [])]
        .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
        .slice(0, 3);
    const topRevenues = [...(current.revenueBreakdown || [])]
        .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
        .slice(0, 3);

    let text = `**จุดที่ควรระวังของงบประมาณคณะวิทยาศาสตร์ ปี ${current.year}**\n\n`;
    text += `จากข้อมูลในเว็บตอนนี้ ปี ${current.year} เป็นข้อมูลประเภท **${current.type || 'forecast'}** หน่วยเป็นล้านบาท\n`;
    text += `- รายรับ: **${formatNumber(revenue, 2)} ล้านบาท**\n`;
    text += `- รายจ่าย: **${formatNumber(expense, 2)} ล้านบาท**\n`;
    text += `- ส่วนต่าง/คงเหลือ: **${formatNumber(surplus, 2)} ล้านบาท**`;
    if (margin != null) text += ` (margin ${formatNumber(margin, 1)}%)`;
    text += '\n';
    if (expenseRatio != null) text += `- สัดส่วนรายจ่ายต่อรายรับ: **${formatNumber(expenseRatio, 1)}%**\n`;
    if (comparablePrevious) {
        text += `- เทียบกับปี ${previous.year}: รายรับ ${revenueChange >= 0 ? '+' : ''}${formatNumber(revenueChange, 2)} ล้านบาท, รายจ่าย ${expenseChange >= 0 ? '+' : ''}${formatNumber(expenseChange, 2)} ล้านบาท\n`;
    } else if (previous) {
        text += `- ไม่เทียบตัวเลขตรงกับปี ${previous.year} เพราะข้อมูลปี ${current.year} มาจากไฟล์ forecast/ประมาณการที่ฐานข้อมูลต่างจากชุดย้อนหลังเดิม ควรใช้ปี ${current.year} เป็นฐานตัดสินใจแยกต่างหาก\n`;
    }
    if (Number.isFinite(Number(current.students))) {
        text += `- ฐานนักศึกษาที่ใช้คำนวณ: **${formatNumber(current.students)} คน**\n`;
    }

    text += `\n**จุดเสี่ยงที่ควรจับตา**\n`;
    text += `1. รายรับยังผูกกับจำนวนนักศึกษา/ค่าธรรมเนียมสูง ถ้ารับเข้าไม่ถึงเป้าหรือมีลาออก จะกระทบกระแสเงินสดทันที\n`;
    text += `2. รายจ่ายประจำและงบกลางเป็นต้นทุนที่ลดได้ยาก ควรล็อกวงเงินและติดตามรายเดือน\n`;
    text += `3. ตัวเลขปี ${current.year} เป็น forecast ควรแยก “อนุมัติแล้ว” กับ “คาดการณ์” ก่อนใช้ตัดสินใจจริง\n`;
    text += `4. โครงการยุทธศาสตร์/โครงการคณะควรผูก KPI ชัดเจน เพื่อไม่ให้ใช้งบโดยไม่เห็นผลลัพธ์\n`;

    if (topExpenses.length > 0) {
        text += `\n**รายจ่ายก้อนใหญ่**\n`;
        text += topExpenses.map(item => `- ${item.name}: ${formatNumber(item.amount, 2)} ล้านบาท`).join('\n');
        text += '\n';
    }

    if (topRevenues.length > 0) {
        text += `\n**รายรับหลักที่ต้องติดตาม**\n`;
        text += topRevenues.map(item => {
            const suffix = Number.isFinite(Number(item.students)) ? ` (${formatNumber(item.students)} คน)` : '';
            return `- ${item.name}: ${formatNumber(item.amount, 2)} ล้านบาท${suffix}`;
        }).join('\n');
        text += '\n';
    }

    text += `\n**ข้อเสนอแนะสำหรับคณบดี/ผู้บริหาร**\n`;
    text += `- ทำ sensitivity 3 ฉากทัศน์: รับนักศึกษาได้ 90%, 100%, 110% ของเป้า แล้วดูผลต่อรายรับ\n`;
    text += `- ตั้ง alert เมื่อรายจ่ายจริงเกินแผนรายไตรมาส หรือรายรับค่าธรรมเนียมต่ำกว่าแผน\n`;
    text += `- ผูกงบโครงการยุทธศาสตร์กับ KPI ที่ขาดเป้าหมายก่อนเป็นอันดับแรก\n\n`;
    text += `_${datasetSourceLine('science_budget', dataset?.source || 'Faculty Budget / คำนวณประมาณการปี 70')}_`;

    return { text, chart: null };
}

function buildStudentSummaryAnswer(question) {
    const q = normalizeText(question);
    const isStudentQuestion = /นักศึกษา|นิสิต|student|gpa|เกรด|สาขา|ชั้นปี|พ้นสภาพ|รอพินิจ|เสี่ยง/.test(q);
    const asksAggregate = /กี่|จำนวน|ทั้งหมด|รวม|เฉลี่ย|เท่าไหร่|สรุป|แยก|รายงาน|ภาพรวม/.test(q);
    const shouldSkip =
        isChartIntent(q) ||
        /tcas|รับเข้า|รับสมัคร|ย้อนหลัง|ค้าง|ชำระ|ค่าเทอม|กิจกรรม|รายวิชา|course|รายชื่อ|ค้นหา|ใคร|รหัส\s*6|\b6\d{9}\b|สูงสุด|ต่ำสุด|top\s*\d*/i.test(q);

    if (!isStudentQuestion || !asksAggregate || shouldSkip) return null;

    const students = getScienceStudents();
    if (students.length === 0) return null;

    const byMajor = new Map();
    const byYear = new Map();
    let atRisk = 0;

    students.forEach(student => {
        const major = student.major || 'ไม่ระบุสาขา';
        const gpa = Number(student.gpa);
        const current = byMajor.get(major) || { count: 0, gpas: [] };
        current.count += 1;
        if (Number.isFinite(gpa)) current.gpas.push(gpa);
        byMajor.set(major, current);
        byYear.set(student.year || '-', (byYear.get(student.year || '-') || 0) + 1);
        if (Number.isFinite(gpa) && gpa < 2) atRisk += 1;
    });

    const overallGpa = average(students.map(student => student.gpa));
    const majorRows = [...byMajor.entries()]
        .map(([major, value]) => ({
            major,
            count: value.count,
            avgGpa: average(value.gpas),
        }))
        .sort((a, b) => b.count - a.count || a.major.localeCompare(b.major, 'th'));
    const yearRows = [...byYear.entries()]
        .sort((a, b) => Number(a[0]) - Number(b[0]));

    let text = `**สรุปข้อมูลนักศึกษาคณะวิทยาศาสตร์**\n\n`;
    text += `- นักศึกษาทั้งหมด: **${formatNumber(students.length)} คน**\n`;
    text += `- GPA เฉลี่ยรวม: **${overallGpa == null ? '-' : formatNumber(overallGpa, 2)}**\n`;
    text += `- กลุ่มเสี่ยง GPA < 2.00: **${formatNumber(atRisk)} คน**\n`;

    if (/สาขา|major|แยก/.test(q)) {
        text += `\n**แยกตามสาขา**\n`;
        text += majorRows.map(row =>
            `- ${row.major}: ${formatNumber(row.count)} คน, GPA เฉลี่ย ${row.avgGpa == null ? '-' : formatNumber(row.avgGpa, 2)}`
        ).join('\n');
        text += '\n';
    }

    if (/ชั้นปี|ปี\s*[1-4]|year|แยก/.test(q)) {
        text += `\n**แยกตามชั้นปี**\n`;
        text += yearRows.map(([year, count]) => `- ปี ${year}: ${formatNumber(count)} คน`).join('\n');
        text += '\n';
    }

    text += `\n_${sourceLine()}_`;
    return { text, chart: null };
}

function buildActivityAnswer(question) {
    const q = normalizeText(question);
    if (!/กิจกรรม|รับน้อง|ไหว้ครู|ชั่วโมงคณะ|ชั่วโมงกิจกรรม|เดือนนี้|เดือนหน้า/.test(q)) return null;

    const summary = getScienceActivitySummary();
    const wantsNext = /เดือนหน้า|ถัดไป|next/.test(q);
    const wantsCurrent = /เดือนนี้|current/.test(q);
    const targetEvents = wantsNext ? summary.nextMonth : wantsCurrent ? summary.thisMonth : summary.upcoming.slice(0, 8);
    const label = wantsNext
        ? summary.nextMonthLabel
        : wantsCurrent
        ? summary.currentMonthLabel
        : 'กิจกรรมที่กำลังจะมาถึง';

    const requirement = summary.requirement;
    const completedEvents = Number(requirement.completedEvents || 0);
    const requiredEvents = Number(requirement.requiredEvents || 0);
    const completedHours = Number(requirement.completedHours || 0);
    const targetHours = Number(requirement.targetHours || 0);
    const eventProgress = requiredEvents ? Math.round((completedEvents / requiredEvents) * 100) : 0;
    const hourProgress = targetHours ? Math.round((completedHours / targetHours) * 100) : 0;

    let text = `**กิจกรรมคณะวิทยาศาสตร์ ${label}**\n\n`;
    text += `ความคืบหน้าชั่วโมงกิจกรรมคณะ: **${completedHours}/${targetHours} ชม. (${hourProgress}%)** เหลือ **${summary.missingHours} ชม.**\n`;
    text += `ความคืบหน้าจำนวนกิจกรรม: **${completedEvents}/${requiredEvents} กิจกรรม (${eventProgress}%)**\n\n`;

    if (targetEvents.length === 0) {
        text += 'ยังไม่มีกิจกรรมในช่วงเวลานี้จากข้อมูลที่เว็บมีอยู่ตอนนี้\n';
    } else {
        text += targetEvents.map((event, index) => {
            const seatsLeft = Math.max(0, Number(event.capacity || 0) - Number(event.registeredCount || 0));
            return `**${index + 1}. ${event.title}**\n` +
                `- วันที่: ${formatScienceActivityDate(event)} เวลา ${event.time || '-'}\n` +
                `- ประเภท: ${event.type || '-'} | ชั่วโมงคณะ: ${event.hours || 0} ชม.\n` +
                `- สถานที่: ${event.location || '-'}\n` +
                `- รับได้ ${formatNumber(event.capacity)} คน, ลงทะเบียนแล้ว ${formatNumber(event.registeredCount)} คน, เหลือ ${formatNumber(seatsLeft)} ที่`;
        }).join('\n\n');
        text += '\n';
    }

    if (!wantsNext && !wantsCurrent) {
        text += `\nเดือนนี้ (${summary.currentMonthLabel}) มี ${summary.thisMonth.length} กิจกรรม รวม ${summary.thisMonthHours} ชม.`;
        text += `\nเดือนหน้า (${summary.nextMonthLabel}) มี ${summary.nextMonth.length} กิจกรรม รวม ${summary.nextMonthHours} ชม.`;
    }

    text += '\n\n_แหล่งข้อมูล: ตารางกิจกรรมคณะวิทยาศาสตร์ในระบบ_';
    return { text, chart: null };
}

function chartForCourse(course) {
    const labels = Object.keys(course.grades || {});
    const data = labels.map(label => Number(course.grades[label] || 0));
    return {
        chartType: 'bar',
        data: {
            labels,
            datasets: [{
                label: `จำนวนนักศึกษา ${course.code}`,
                data,
                backgroundColor: labels.map((_, index) => `${CHART_COLORS[index % CHART_COLORS.length]}cc`),
                borderColor: labels.map((_, index) => CHART_COLORS[index % CHART_COLORS.length]),
                borderWidth: 1,
                borderRadius: 6,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                title: { display: true, text: `การกระจายเกรดรายวิชา ${course.code}` },
            },
            scales: {
                x: { title: { display: true, text: 'เกรด' } },
                y: { beginAtZero: true, title: { display: true, text: 'จำนวนนักศึกษา' } },
            },
        },
    };
}

function buildCourseGradeAnswer(question) {
    const q = normalizeText(question);
    const isCourseQuestion = /รายวิชา|วิชา|course|เกรดรายวิชา|กระจายเกรด|grade distribution|sci\d{3}|csc\d{3}|sta\d{3}|mat\d{3}|che\d{3}|phy\d{3}/i.test(q);
    if (!isCourseQuestion || !/เกรด|gpa|กระจาย|กราฟ|chart|รายวิชา|course/i.test(q)) return null;

    const requestedCode = q.match(/\b[a-z]{2,4}\d{3}\b/i)?.[0]?.toUpperCase();
    const courses = courseAnalyticsData.gradeDistributions || [];
    const course = requestedCode
        ? courses.find(item => item.code.toUpperCase() === requestedCode)
        : courses[0];

    if (!course) {
        const available = courses.map(item => item.code).join(', ') || '-';
        return {
            text: `ยังไม่พบข้อมูลเกรดของรายวิชา ${requestedCode || ''} ในระบบตอนนี้\n\nรายวิชาที่มีข้อมูล: ${available}`,
            chart: null,
        };
    }

    const gradeRows = Object.entries(course.grades || {})
        .map(([grade, count]) => `- ${grade}: ${formatNumber(count)} คน`)
        .join('\n');

    let text = `**การกระจายเกรดรายวิชา ${course.code}: ${course.title}**\n\n`;
    text += `- ภาคการศึกษา: ${course.semester}\n`;
    text += `- จำนวนนักศึกษา: ${formatNumber(course.enrolled)} คน\n`;
    text += `- GPA เฉลี่ยรายวิชา: ${formatNumber(course.avgGpa, 2)}\n\n`;
    text += `${gradeRows}\n\n`;
    text += `_แหล่งข้อมูล: ข้อมูลรายวิชา/grade distribution ที่เว็บมีอยู่ตอนนี้ (${courseAnalyticsData.dataStatus?.gradeDistribution || 'system data'})_`;

    return { text, chart: chartForCourse(course) };
}

function buildTcasAnswer(question) {
    const q = normalizeText(question);
    if (!/tcas|รับเข้า|รับสมัคร|admission|รอบ\s*[1-4]|แผนรับ/.test(q)) return null;
    if (/รายชื่อ|ค้าง|ชำระ|ค่าเทอมรายคน/.test(q)) return null;

    const summary = getTcasSummary();
    const impact = /100|ผลกระทบ|รายได้|ออกกี่คน|หายไป/.test(q)
        ? calculateTcasImpact({ intake: 100, attritionRate: 12 })
        : null;

    const round3Rows = (tcasPlanningData.round3Plan2569 || [])
        .map(row => `- ${row.major}: แผนรับรอบ 3 ${formatNumber(row.plan)} คน, GPAX ขั้นต่ำ ${formatNumber(row.minGpax, 1)}`)
        .join('\n');
    const targetRows = (tcasPlanningData.intakeTarget2570 || [])
        .map(row => `- ${row.major}: เป้ารับปี 2570 ${formatNumber(row.target2570)} คน, รายได้คาดการณ์/เทอม ${formatNumber(row.projectedRevenuePerTerm)} บาท`)
        .join('\n');

    let text = `**แผนรับนักศึกษา TCAS คณะวิทยาศาสตร์**\n\n`;
    text += `- แผนรับรอบ 3 ปี 2569 จากประกาศ/ข้อมูลในระบบ: **${formatNumber(summary.officialRound3Plan)} คน**\n`;
    text += `- เป้ารับปี 2570 จากไฟล์ประมาณการ: **${formatNumber(summary.intakeTarget2570Total)} คน**\n`;
    text += `- สถานะข้อมูลย้อนหลัง 5 ปี: ยังรอเชื่อมข้อมูล Admissions/Reg API สำหรับสมัคร-ผ่าน-รายงานตัว-คงอยู่-ลาออกย้อนหลัง\n\n`;
    text += `**รอบ 3 ปี 2569 แยกสาขา**\n${round3Rows}\n\n`;
    text += `**เป้ารับปี 2570 แยกสาขา**\n${targetRows}`;

    if (impact) {
        text += `\n\n**Impact scenario: รับเข้า ${impact.intake} คน**\n`;
        text += `- สมมติ attrition 12% จะหายไปประมาณ ${formatNumber(impact.lostStudents)} คน เหลือ ${formatNumber(impact.retainedStudents)} คน\n`;
        text += `- รายได้ที่อาจหายไปตลอดหลักสูตร: ${formatNumber(impact.lostRevenue)} บาท`;
    }

    const chart = isChartIntent(q) ? {
        chartType: 'bar',
        data: {
            labels: (tcasPlanningData.intakeTarget2570 || []).map(row => row.major),
            datasets: [{
                label: 'เป้ารับปี 2570',
                data: (tcasPlanningData.intakeTarget2570 || []).map(row => Number(row.target2570 || 0)),
                backgroundColor: '#059669cc',
                borderColor: '#059669',
                borderWidth: 1,
                borderRadius: 6,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { position: 'bottom' },
                title: { display: true, text: 'เป้ารับนักศึกษา TCAS ปี 2570 แยกสาขา' },
            },
            scales: {
                x: { beginAtZero: true, title: { display: true, text: 'จำนวนรับเป้าหมาย (คน)' } },
            },
        },
    } : null;

    text += '\n\n_แหล่งข้อมูล: tcasAdmissionsData ในระบบ, ไฟล์คำนวณประมาณการปี 70 และประกาศรอบ 3 ปี 2569_';
    return { text, chart };
}

export function tryInstantAnswer(question, userContext = {}) {
    const builders = [
        { build: buildCourseGradeAnswer, sections: ['course_analytics'] },
        { build: buildActivityAnswer, sections: ['student_life'] },
        { build: buildBudgetCautionAnswer, sections: ['budget_forecast', 'financial', 'faculty_budget'] },
        { build: buildStudentRiskTrendAnswer, sections: ['student_stats'] },
        { build: buildStudentMajorDeclineAnswer, sections: ['student_stats'] },
        { build: buildTcasAnswer, sections: ['tcas_admissions'] },
        { build: buildStudentSummaryAnswer, sections: ['student_stats'] },
    ];

    for (const { build, sections } of builders) {
        const result = build(question);
        if (!result) continue;
        if (!canAIUseAnyInternalSection(userContext, sections)) {
            return buildAIAccessDeniedResult(userContext, sections);
        }
        return result;
    }

    return null;
}
