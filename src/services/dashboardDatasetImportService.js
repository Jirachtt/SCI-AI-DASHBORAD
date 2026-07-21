import { saveDashboardDataset } from './dashboardLiveDataService';

const GRADE_WEIGHTS = {
    A: 4,
    'B+': 3.5,
    B: 3,
    'C+': 2.5,
    C: 2,
    'D+': 1.5,
    D: 1,
    F: 0,
};

const COMMON_ALIASES = {
    year: ['year', 'academic year', 'academicyear', 'ปี', 'ปีการศึกษา'],
    major: ['major', 'program', 'หลักสูตร', 'สาขา', 'สาขาวิชา'],
    source: ['source', 'source url', 'sourceurl', 'แหล่งข้อมูล', 'แหล่งที่มา', 'url'],
};

export const DATASET_IMPORT_DEFINITIONS = {
    tcas_history: {
        datasetId: 'tcas_admissions',
        label: 'TCAS ย้อนหลัง',
        description: 'ข้อมูลสมัคร ผ่านคัดเลือก รายงานตัว คงอยู่ และลาออก แยกตามปี',
        templateColumns: ['ปีการศึกษา', 'ผู้สมัคร', 'ผ่านคัดเลือก', 'รายงานตัว', 'คงอยู่', 'ลาออก'],
    },
    tcas_plan: {
        datasetId: 'tcas_admissions',
        label: 'แผนรับ TCAS รายสาขา',
        description: 'แผนรับรอบ 3 พร้อม GPAX ขั้นต่ำและกลุ่มวิชาที่ใช้พิจารณา',
        templateColumns: ['สาขาวิชา', 'แผนรับ', 'GPAX ขั้นต่ำ', 'วิชาที่พิจารณา'],
    },
    course_grades: {
        datasetId: 'course_analytics',
        label: 'การกระจายเกรดรายวิชา',
        description: 'รหัสวิชา ชื่อวิชา ภาคเรียน จำนวนผู้เรียน GPA เฉลี่ย และจำนวนแต่ละเกรด',
        templateColumns: ['รหัสวิชา', 'ชื่อวิชา', 'ภาคเรียน', 'จำนวนผู้เรียน', 'GPA เฉลี่ย', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F'],
    },
    student_activities: {
        datasetId: 'student_life',
        label: 'กิจกรรมคณะวิทยาศาสตร์',
        description: 'ปฏิทินกิจกรรม ชั่วโมง สถานที่ ความจุ และจำนวนลงทะเบียน',
        templateColumns: ['ชื่อกิจกรรม', 'ประเภท', 'วันที่เริ่ม', 'วันที่สิ้นสุด', 'เวลา', 'สถานที่', 'ผู้จัด', 'ชั่วโมง', 'ความจุ', 'ลงทะเบียนแล้ว', 'สถานะ'],
    },
    graduation_history: {
        datasetId: 'graduation',
        label: 'สถิติการสำเร็จการศึกษา',
        description: 'จำนวนผู้มีสิทธิ์ จำนวนผู้สำเร็จ อัตราสำเร็จ และ GPA เฉลี่ย แยกตามปี',
        templateColumns: ['ปีการศึกษา', 'ผู้มีสิทธิ์จบ', 'สำเร็จการศึกษา', 'อัตราสำเร็จ', 'GPA เฉลี่ย'],
    },
    student_awards: {
        datasetId: 'student_stats',
        label: 'รางวัลนักศึกษา',
        description: 'รางวัล ประเภท ระดับ และแหล่งอ้างอิงที่ตรวจสอบได้',
        templateColumns: ['ปีการศึกษา', 'รหัสนักศึกษา', 'ชื่อ-นามสกุล', 'สาขาวิชา', 'รางวัล', 'ประเภท', 'ระดับ', 'แหล่งที่มา'],
    },
    population_forecast: {
        datasetId: 'student_stats',
        label: 'ประชากรและอุปสงค์การเรียน',
        description: 'ดัชนีประชากรวัยเรียนและดัชนีความต้องการคณะวิทยาศาสตร์สำหรับวางแผนรับเข้า',
        templateColumns: ['ปีการศึกษา', 'ดัชนีประชากรวัยเรียน', 'ดัชนีความต้องการคณะวิทยาศาสตร์', 'ระดับความเสี่ยง', 'แหล่งที่มา'],
    },
    executive_compensation: {
        datasetId: 'hr',
        label: 'ค่าตอบแทนผู้บริหาร',
        description: 'ค่าตอบแทนรายตำแหน่งและรายการหักจากไฟล์ HR/Payroll ที่ได้รับอนุญาต',
        templateColumns: ['ตำแหน่ง', 'ขอบเขต', 'ฐานเงินเดือน', 'เงินประจำตำแหน่ง', 'กองทุนสำรองเลี้ยงชีพ', 'ภาษีหัก ณ ที่จ่าย', 'รายการหักอื่น'],
    },
    student_payments: {
        datasetId: 'financial',
        label: 'ค่าธรรมเนียมนักศึกษารายคน',
        description: 'ยอดค่าธรรมเนียม การชำระ คงค้าง กำหนดชำระ และวันที่ชำระจริงจาก Finance/Reg',
        templateColumns: ['รหัสนักศึกษา', 'สาขาวิชา', 'ชั้นปี', 'ปีการศึกษา', 'ภาคเรียน', 'ค่าธรรมเนียม', 'ชำระแล้ว', 'คงค้าง', 'กำหนดชำระ', 'วันที่ชำระจริง', 'สถานะ'],
    },
};

function normalizeKey(value) {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[\s_./()-]+/g, '');
}

function rowLookup(row = {}) {
    return new Map(Object.entries(row).map(([key, value]) => [normalizeKey(key), value]));
}

function pick(row, aliases, fallback = '') {
    const lookup = rowLookup(row);
    for (const alias of aliases) {
        const key = normalizeKey(alias);
        if (!lookup.has(key)) continue;
        const value = lookup.get(key);
        if (String(value ?? '').trim() !== '') return value;
    }
    return fallback;
}

function text(value, fallback = '') {
    const result = String(value ?? '').trim();
    return result || fallback;
}

function number(value, fallback = null) {
    const normalized = String(value ?? '')
        .replace(/,/g, '')
        .replace(/%$/, '')
        .trim();
    if (!normalized) return fallback;
    const result = Number(normalized);
    return Number.isFinite(result) ? result : fallback;
}

function positiveNumber(value, fallback = null) {
    const result = number(value, fallback);
    return result == null ? result : Math.max(0, result);
}

function buddhistYear(value) {
    const result = number(value, null);
    if (result == null) return null;
    if (result >= 1900 && result < 2400) return Math.trunc(result + 543);
    return Math.trunc(result);
}

function isoDate(value) {
    const raw = text(value);
    if (!raw) return '';
    const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
        const year = Number(isoMatch[1]) > 2400 ? Number(isoMatch[1]) - 543 : Number(isoMatch[1]);
        return `${year}-${String(isoMatch[2]).padStart(2, '0')}-${String(isoMatch[3]).padStart(2, '0')}`;
    }
    const localMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (localMatch) {
        const year = Number(localMatch[3]) > 2400 ? Number(localMatch[3]) - 543 : Number(localMatch[3]);
        return `${year}-${String(localMatch[2]).padStart(2, '0')}-${String(localMatch[1]).padStart(2, '0')}`;
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function requireRows(rows, message) {
    if (!Array.isArray(rows) || rows.length === 0) throw new Error(message);
    return rows;
}

function requireValue(value, message) {
    if (value == null || String(value).trim() === '') throw new Error(message);
    return value;
}

function calculateAverageGpa(grades) {
    let points = 0;
    let count = 0;
    Object.entries(GRADE_WEIGHTS).forEach(([grade, weight]) => {
        const gradeCount = positiveNumber(grades[grade], 0);
        points += gradeCount * weight;
        count += gradeCount;
    });
    return count > 0 ? Number((points / count).toFixed(2)) : null;
}

function buildTcasHistory(rows) {
    const normalized = rows.map((row, index) => {
        const year = buddhistYear(pick(row, COMMON_ALIASES.year));
        requireValue(year, `แถว ${index + 2}: ไม่พบปีการศึกษา`);
        const applied = positiveNumber(pick(row, ['ผู้สมัคร', 'สมัคร', 'applied', 'applicants']), null);
        const qualified = positiveNumber(pick(row, ['ผ่านคัดเลือก', 'qualified', 'selected', 'admitted']), null);
        const enrolled = positiveNumber(pick(row, ['รายงานตัว', 'ลงทะเบียน', 'enrolled', 'registered']), null);
        const retained = positiveNumber(pick(row, ['คงอยู่', 'retained', 'remaining']), null);
        const withdrawn = positiveNumber(pick(row, ['ลาออก', 'หายไป', 'withdrawn', 'dropout']), null);
        if ([applied, qualified, enrolled, retained, withdrawn].every(value => value == null)) {
            throw new Error(`แถว ${index + 2}: ต้องมีตัวเลขอย่างน้อยหนึ่งช่องใน funnel TCAS`);
        }
        const calculatedRetention = enrolled > 0 && retained != null ? (retained / enrolled) * 100 : null;
        const retentionRate = number(pick(row, ['อัตราคงอยู่', 'retention rate', 'retentionrate']), calculatedRetention);
        return {
            year,
            applied,
            qualified,
            enrolled,
            retained,
            withdrawn: withdrawn ?? (enrolled != null && retained != null ? Math.max(0, enrolled - retained) : null),
            retentionRate: retentionRate == null ? null : Number(retentionRate.toFixed(1)),
            sourceStatus: 'uploaded_file',
        };
    }).sort((a, b) => a.year - b.year);
    return { field: 'fiveYearTrend', rows: normalized };
}

function buildTcasPlan(rows) {
    return {
        field: 'round3Plan2569',
        rows: rows.map((row, index) => {
            const major = text(pick(row, COMMON_ALIASES.major));
            const plan = positiveNumber(pick(row, ['แผนรับ', 'จำนวนรับ', 'plan', 'target', 'quota']), null);
            requireValue(major, `แถว ${index + 2}: ไม่พบสาขาวิชา`);
            requireValue(plan, `แถว ${index + 2}: ไม่พบแผนรับ`);
            return {
                major,
                plan,
                minGpax: number(pick(row, ['GPAX ขั้นต่ำ', 'GPAX', 'min gpax', 'mingpax']), null),
                subjectFocus: text(pick(row, ['วิชาที่พิจารณา', 'กลุ่มวิชา', 'subject focus', 'subjectfocus']), '-'),
                sourceStatus: 'uploaded_file',
            };
        }),
    };
}

function buildCourseGrades(rows) {
    return {
        field: 'gradeDistributions',
        rows: rows.map((row, index) => {
            const code = text(pick(row, ['รหัสวิชา', 'course code', 'coursecode', 'code']));
            const title = text(pick(row, ['ชื่อวิชา', 'course title', 'coursetitle', 'title', 'รายวิชา']));
            if (!code && !title) throw new Error(`แถว ${index + 2}: ต้องมีรหัสวิชาหรือชื่อวิชา`);
            const grades = Object.fromEntries(Object.keys(GRADE_WEIGHTS).map(grade => [
                grade,
                positiveNumber(pick(row, [grade, `เกรด ${grade}`, `grade ${grade}`]), 0),
            ]));
            const gradeTotal = Object.values(grades).reduce((sum, value) => sum + value, 0);
            const enrolled = positiveNumber(pick(row, ['จำนวนผู้เรียน', 'ลงทะเบียน', 'enrolled', 'students']), gradeTotal || null);
            if (!enrolled && !gradeTotal) throw new Error(`แถว ${index + 2}: ไม่พบจำนวนผู้เรียนหรือจำนวนเกรด`);
            return {
                code: code || `COURSE-${String(index + 1).padStart(3, '0')}`,
                title: title || code,
                semester: text(pick(row, ['ภาคเรียน', 'semester', 'term']), '-'),
                enrolled,
                avgGpa: number(pick(row, ['GPA เฉลี่ย', 'เกรดเฉลี่ย', 'average gpa', 'avggpa']), calculateAverageGpa(grades)),
                grades,
                sourceStatus: 'uploaded_file',
            };
        }),
    };
}

function buildActivities(rows) {
    return {
        field: 'scienceActivities',
        rows: rows.map((row, index) => {
            const title = text(pick(row, ['ชื่อกิจกรรม', 'กิจกรรม', 'activity', 'title']));
            const startDate = isoDate(pick(row, ['วันที่เริ่ม', 'วันที่', 'start date', 'startdate', 'date']));
            requireValue(title, `แถว ${index + 2}: ไม่พบชื่อกิจกรรม`);
            requireValue(startDate, `แถว ${index + 2}: วันที่เริ่มไม่ถูกต้อง (ใช้ YYYY-MM-DD หรือ DD/MM/YYYY)`);
            const capacity = positiveNumber(pick(row, ['ความจุ', 'capacity', 'จำนวนรับ']), null);
            const registeredCount = positiveNumber(pick(row, ['ลงทะเบียนแล้ว', 'ผู้ลงทะเบียน', 'registered', 'registeredcount']), 0);
            return {
                id: text(pick(row, ['id', 'รหัสกิจกรรม']), `sci-upload-${startDate}-${index + 1}`),
                title,
                type: text(pick(row, ['ประเภท', 'ประเภทกิจกรรม', 'type']), 'อื่นๆ'),
                startDate,
                endDate: isoDate(pick(row, ['วันที่สิ้นสุด', 'end date', 'enddate'])) || startDate,
                time: text(pick(row, ['เวลา', 'time']), '-'),
                location: text(pick(row, ['สถานที่', 'location']), '-'),
                organizer: text(pick(row, ['ผู้จัด', 'หน่วยงาน', 'organizer']), 'คณะวิทยาศาสตร์'),
                hours: positiveNumber(pick(row, ['ชั่วโมง', 'hours', 'hour']), 0),
                capacity,
                registeredCount,
                status: text(pick(row, ['สถานะ', 'status']), capacity && registeredCount >= capacity ? 'full' : 'open'),
                facultyHours: true,
                audience: text(pick(row, ['กลุ่มเป้าหมาย', 'audience']), 'นักศึกษาคณะวิทยาศาสตร์'),
                description: text(pick(row, ['รายละเอียด', 'description']), ''),
                sourceStatus: 'uploaded_file',
            };
        }).sort((a, b) => a.startDate.localeCompare(b.startDate)),
    };
}

function buildGraduationHistory(rows) {
    return {
        field: 'history',
        rows: rows.map((row, index) => {
            const year = buddhistYear(pick(row, COMMON_ALIASES.year));
            const candidates = positiveNumber(pick(row, ['ผู้มีสิทธิ์จบ', 'ผู้มีสิทธิ์', 'candidates', 'candidate count']), null);
            const graduated = positiveNumber(pick(row, ['สำเร็จการศึกษา', 'ผู้สำเร็จ', 'graduated', 'graduates']), null);
            requireValue(year, `แถว ${index + 2}: ไม่พบปีการศึกษา`);
            requireValue(candidates, `แถว ${index + 2}: ไม่พบจำนวนผู้มีสิทธิ์จบ`);
            requireValue(graduated, `แถว ${index + 2}: ไม่พบจำนวนผู้สำเร็จการศึกษา`);
            const calculatedRate = candidates > 0 ? (graduated / candidates) * 100 : null;
            const rate = number(pick(row, ['อัตราสำเร็จ', 'อัตราสำเร็จการศึกษา', 'rate', 'graduation rate']), calculatedRate);
            return {
                year,
                candidates,
                graduated,
                rate: rate == null ? null : Number(rate.toFixed(1)),
                avgGPA: number(pick(row, ['GPA เฉลี่ย', 'เกรดเฉลี่ย', 'average gpa', 'avggpa']), null),
                sourceStatus: 'uploaded_file',
            };
        }).sort((a, b) => a.year - b.year),
    };
}

function buildStudentAwards(rows, fileName) {
    return {
        field: 'studentAwards',
        rows: rows.map((row, index) => {
            const year = buddhistYear(pick(row, COMMON_ALIASES.year));
            const displayName = text(pick(row, ['ชื่อ-นามสกุล', 'ชื่อนักศึกษา', 'ชื่อ', 'name', 'student name']));
            const award = text(pick(row, ['รางวัล', 'ชื่อรางวัล', 'award']));
            requireValue(year, `แถว ${index + 2}: ไม่พบปีการศึกษา`);
            requireValue(displayName, `แถว ${index + 2}: ไม่พบชื่อนักศึกษา`);
            requireValue(award, `แถว ${index + 2}: ไม่พบชื่อรางวัล`);
            return {
                year,
                studentCode: text(pick(row, ['รหัสนักศึกษา', 'student code', 'studentcode', 'student id']), `AWARD-${year}-${index + 1}`),
                displayName,
                major: text(pick(row, COMMON_ALIASES.major), '-'),
                award,
                category: text(pick(row, ['ประเภท', 'ประเภทรางวัล', 'category']), '-'),
                level: text(pick(row, ['ระดับ', 'level']), '-'),
                source: text(pick(row, COMMON_ALIASES.source), fileName),
                sourceTrust: 'uploaded_file',
            };
        }),
    };
}

function buildPopulationForecast(rows, fileName) {
    return {
        field: 'populationForecast',
        rows: rows.map((row, index) => {
            const year = buddhistYear(pick(row, COMMON_ALIASES.year));
            const youthPopulationIndex = number(pick(row, ['ดัชนีประชากรวัยเรียน', 'ประชากรวัยเรียน', 'youth population index', 'youthpopulationindex']), null);
            const expectedScienceDemandIndex = number(pick(row, ['ดัชนีความต้องการคณะวิทยาศาสตร์', 'ดัชนีความต้องการ', 'science demand index', 'expectedsciencedemandindex']), null);
            requireValue(year, `แถว ${index + 2}: ไม่พบปีการศึกษา`);
            requireValue(youthPopulationIndex, `แถว ${index + 2}: ไม่พบดัชนีประชากรวัยเรียน`);
            requireValue(expectedScienceDemandIndex, `แถว ${index + 2}: ไม่พบดัชนีความต้องการคณะวิทยาศาสตร์`);
            return {
                year,
                youthPopulationIndex,
                expectedScienceDemandIndex,
                riskLevel: text(pick(row, ['ระดับความเสี่ยง', 'ความเสี่ยง', 'risk level', 'risklevel']), 'watch'),
                source: text(pick(row, COMMON_ALIASES.source), fileName),
            };
        }).sort((a, b) => a.year - b.year),
    };
}

function buildExecutiveCompensation(rows, fileName) {
    return {
        field: 'executiveCompensation',
        rows: rows.map((row, index) => {
            const position = text(pick(row, ['ตำแหน่ง', 'position', 'executive position']));
            const monthlyBase = positiveNumber(pick(row, ['ฐานเงินเดือน', 'เงินเดือน', 'monthly base', 'monthlybase', 'salary']), null);
            requireValue(position, `แถว ${index + 2}: ไม่พบตำแหน่ง`);
            requireValue(monthlyBase, `แถว ${index + 2}: ไม่พบฐานเงินเดือน`);
            const positionAllowance = positiveNumber(pick(row, ['เงินประจำตำแหน่ง', 'เงินตำแหน่ง', 'position allowance', 'positionallowance']), 0);
            const providentFund = positiveNumber(pick(row, ['กองทุนสำรองเลี้ยงชีพ', 'กองทุน', 'provident fund', 'providentfund']), 0);
            const taxWithholding = positiveNumber(pick(row, ['ภาษีหัก ณ ที่จ่าย', 'ภาษี', 'tax withholding', 'taxwithholding']), 0);
            const otherDeductions = positiveNumber(pick(row, ['รายการหักอื่น', 'หักอื่น', 'other deductions', 'otherdeductions']), 0);
            const grossMonthly = monthlyBase + positionAllowance;
            const totalDeductions = providentFund + taxWithholding + otherDeductions;
            return {
                position,
                scope: text(pick(row, ['ขอบเขต', 'หน่วยงาน', 'scope', 'department']), '-'),
                monthlyBase,
                positionAllowance,
                providentFund,
                taxWithholding,
                otherDeductions,
                grossMonthly,
                totalDeductions,
                netEstimate: grossMonthly - totalDeductions,
                sourceTrust: 'uploaded_file',
                sourceLabel: fileName,
            };
        }),
    };
}

function normalizePaymentStatus(rawStatus, { remaining, dueDate, paidAt }) {
    const value = text(rawStatus).toLowerCase();
    if (/ค้าง|overdue|unpaid/.test(value) || remaining > 0) return 'overdue';
    if (/ล่าช้า|late/.test(value)) return 'late';
    if (paidAt && dueDate && paidAt > dueDate) return 'late';
    return 'paid';
}

function buildStudentPayments(rows, fileName) {
    return {
        field: 'studentPayments',
        rows: rows.map((row, index) => {
            const studentId = text(pick(row, ['รหัสนักศึกษา', 'รหัส', 'student id', 'studentid', 'student code']));
            const feeAmount = positiveNumber(pick(row, ['ค่าธรรมเนียม', 'ค่าเทอม', 'ยอดเรียกเก็บ', 'fee amount', 'feeamount', 'tuition']), null);
            requireValue(studentId, `แถว ${index + 2}: ไม่พบรหัสนักศึกษา`);
            requireValue(feeAmount, `แถว ${index + 2}: ไม่พบยอดค่าธรรมเนียม`);
            const rawPaid = positiveNumber(pick(row, ['ชำระแล้ว', 'ยอดชำระ', 'paid amount', 'paidamount']), null);
            const rawRemaining = positiveNumber(pick(row, ['คงค้าง', 'ยอดคงเหลือ', 'remaining', 'outstanding']), null);
            const paidAmount = rawPaid ?? Math.max(0, feeAmount - (rawRemaining ?? 0));
            const remaining = rawRemaining ?? Math.max(0, feeAmount - paidAmount);
            const dueDate = isoDate(pick(row, ['กำหนดชำระ', 'วันครบกำหนด', 'due date', 'duedate']));
            const paidAt = isoDate(pick(row, ['วันที่ชำระจริง', 'วันที่ชำระ', 'paid at', 'paidat', 'payment date']));
            const status = normalizePaymentStatus(pick(row, ['สถานะ', 'status']), { remaining, dueDate, paidAt });
            return {
                studentId,
                displayName: text(pick(row, ['ชื่อ-นามสกุล', 'ชื่อนักศึกษา', 'name', 'student name']), ''),
                major: text(pick(row, COMMON_ALIASES.major), '-'),
                year: positiveNumber(pick(row, ['ชั้นปี', 'year level', 'yearlevel']), null),
                academicYear: buddhistYear(pick(row, COMMON_ALIASES.year)),
                semester: text(pick(row, ['ภาคเรียน', 'semester', 'term']), '-'),
                feeAmount,
                paidAmount,
                remaining,
                status,
                statusLabel: status === 'overdue' ? 'ค้างชำระ' : status === 'late' ? 'จ่ายล่าช้า' : 'ชำระแล้ว',
                dueDate,
                paidAt,
                sourceTrust: 'uploaded_file',
                sourceLabel: fileName,
            };
        }),
    };
}

function normalizeImportRows(importType, rows, fileName) {
    if (importType === 'tcas_history') return buildTcasHistory(rows);
    if (importType === 'tcas_plan') return buildTcasPlan(rows);
    if (importType === 'course_grades') return buildCourseGrades(rows);
    if (importType === 'student_activities') return buildActivities(rows);
    if (importType === 'graduation_history') return buildGraduationHistory(rows);
    if (importType === 'student_awards') return buildStudentAwards(rows, fileName);
    if (importType === 'population_forecast') return buildPopulationForecast(rows, fileName);
    if (importType === 'executive_compensation') return buildExecutiveCompensation(rows, fileName);
    if (importType === 'student_payments') return buildStudentPayments(rows, fileName);
    throw new Error('ไม่รองรับประเภทข้อมูลที่เลือก');
}

export function buildDashboardDatasetImport({ importType, parsed, currentData, fileName = '' }) {
    const definition = DATASET_IMPORT_DEFINITIONS[importType];
    if (!definition) throw new Error('ไม่พบรูปแบบการนำเข้าที่เลือก');
    if (!currentData || typeof currentData !== 'object' || Array.isArray(currentData)) {
        throw new Error('ยังโหลดชุดข้อมูลปัจจุบันไม่สำเร็จ กรุณารอสักครู่แล้วลองใหม่เพื่อป้องกันข้อมูลเดิมถูกเขียนทับ');
    }
    requireRows(parsed?.rows, 'ไม่พบแถวข้อมูลในไฟล์');
    const normalized = normalizeImportRows(importType, parsed.rows, fileName);
    const payload = { ...(currentData || {}) };

    if (importType === 'population_forecast') {
        payload[normalized.field] = {
            scenario: normalized.rows,
            sourceTrust: 'uploaded_file',
            sourceLabel: fileName,
            lastUpdated: new Date().toISOString(),
        };
    } else {
        payload[normalized.field] = normalized.rows;
    }

    return {
        importType,
        datasetId: definition.datasetId,
        definition,
        payload,
        normalizedRows: normalized.rows,
        rowCount: normalized.rows.length,
        warnings: parsed.qualityWarnings || [],
    };
}

export async function saveDashboardDatasetImport({ importType, parsed, currentData, file, user }) {
    const built = buildDashboardDatasetImport({
        importType,
        parsed,
        currentData,
        fileName: file?.name || 'uploaded file',
    });
    const now = new Date().toISOString();
    const sourceEvidence = [{
        label: file?.name || built.definition.label,
        type: 'uploaded_file',
        importedAt: now,
        rowCount: built.rowCount,
    }];

    const meta = await saveDashboardDataset(built.datasetId, built.payload, {
        uid: user?.uid,
        who: user?.email || user?.name || user?.uid,
        sourceUrl: `uploaded-file:${file?.name || built.definition.label}`,
        sourceType: 'uploaded_file',
        meta: {
            validation: { valid: true, checkedAt: now, importType },
            importType,
            fileName: file?.name || null,
            headers: parsed?.headers || [],
            rowCount: built.rowCount,
            qualityWarnings: parsed?.qualityWarnings || [],
            sourceEvidence,
        },
    });

    return { ...built, meta };
}
