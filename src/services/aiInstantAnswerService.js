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
import { getStudentListSync, isLiveData } from './studentDataService';

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

export function tryInstantAnswer(question) {
    const builders = [
        buildCourseGradeAnswer,
        buildActivityAnswer,
        buildTcasAnswer,
        buildStudentSummaryAnswer,
    ];

    for (const builder of builders) {
        const result = builder(question);
        if (result) return result;
    }

    return null;
}
