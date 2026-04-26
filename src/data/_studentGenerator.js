// Procedural padding for the student dataset.
// Kept in its own module so studentListData.js stays a trivial export
// (some Rollup setups choke when statically analysing top-level
// computed exports).

const MAJOR_CODES = {
    'เคมี': '101',
    'วิทยาการคอมพิวเตอร์': '102',
    'เทคโนโลยีสารสนเทศ': '103',
    'สถิติ': '104',
    'เทคโนโลยีชีวภาพ': '105',
    'คณิตศาสตร์': '106',
    'ฟิสิกส์ประยุกต์': '107',
    'เคมีอุตสาหกรรมและเทคโนโลยีสิ่งทอ': '109',
    'วัสดุศาสตร์': '110',
};

const MAJOR_WEIGHTS = [
    ['วิทยาการคอมพิวเตอร์', 0.22],
    ['เทคโนโลยีสารสนเทศ', 0.17],
    ['เคมี', 0.13],
    ['เทคโนโลยีชีวภาพ', 0.12],
    ['คณิตศาสตร์', 0.10],
    ['สถิติ', 0.08],
    ['ฟิสิกส์ประยุกต์', 0.07],
    ['วัสดุศาสตร์', 0.06],
    ['เคมีอุตสาหกรรมและเทคโนโลยีสิ่งทอ', 0.05],
];

const MALE_FIRST = [
    'กิตติพงศ์', 'ก้องภพ', 'จักรกฤษ', 'จิรายุ', 'ชัยวัฒน์', 'ชัยรัตน์', 'ฐิติพงศ์', 'ณัฐพล', 'ณัฐวุฒิ', 'ดนุสรณ์',
    'ตะวัน', 'ทักษ์ดนัย', 'ธนกฤต', 'ธนวัฒน์', 'ธีรภัทร', 'นพรัตน์', 'นภัสกร', 'ปฏิภาณ', 'ปวริศ', 'พงศกร',
    'พชรพล', 'พีรพัฒน์', 'ภาณุพงศ์', 'ภูวเดช', 'มงคล', 'ยุทธนา', 'รัชชานนท์', 'วชิรวิทย์', 'วรเมธ', 'ศุภวิชญ์',
    'สมชาย', 'สิทธิชัย', 'สุรชัย', 'อนันต์', 'อภิวัฒน์', 'เอกพล', 'กนกพล', 'กฤตเมธ', 'จิรเมธ', 'ชยพล',
];

const FEMALE_FIRST = [
    'กชกร', 'กัญญารัตน์', 'กานต์ธิดา', 'จารุวรรณ', 'จิราพร', 'ชนิตา', 'ชลธิชา', 'ฐิติมา', 'ณัฐนิชา', 'ดารณี',
    'ธัญชนก', 'ธิดารัตน์', 'นภัสสร', 'นันทิกานต์', 'ปนัดดา', 'ปวีณา', 'พรชนก', 'พิชญาภา', 'ภัทรวดี', 'รัตนาภรณ์',
    'วรรณวิภา', 'วราภรณ์', 'ศศิประภา', 'ศุภานัน', 'สุธาทิพย์', 'สุพิชชา', 'อนัญญา', 'อรปรียา', 'อาทิตยา', 'ไอลดา',
    'กมลชนก', 'กรรณิการ์', 'จิดาภา', 'ณิชาภัทร', 'ปาริฉัตร', 'พิมพ์ลภัส', 'มัณฑนา', 'ลลิตา', 'อัจฉรา', 'ฤทัยรัตน์',
];

const LAST = [
    'ทองคำ', 'แก้วมณี', 'ใจดี', 'ปัญญา', 'รัตนกุล', 'สุวรรณ', 'อินทร์ทอง', 'แสนสุข', 'พรหมเมือง', 'จันทร์ส่อง',
    'ดวงแก้ว', 'ศรีวิชัย', 'พงศ์ภัทร', 'ปวงงาม', 'ไชยวงค์', 'อุปนันท์', 'จอมขวัญ', 'ตันสกุล', 'พรพิมล', 'มูลวงศ์',
    'แสงทอง', 'อ่อนสา', 'คำมี', 'ทิพย์มณี', 'ชัยมงคล', 'รุ่งเรือง', 'แก้วเกตุ', 'สมคิด', 'ใจปัญญา', 'ปินตา',
    'อินต๊ะนอน', 'ยศสุรินทร์', 'พิมสาร', 'สิริกุล', 'แก้วนิล', 'ดวงจันทร์', 'อุ่นใจ', 'ลุงทุน', 'เมืองมูล', 'ขันแก้ว',
    'ปานทอง', 'ทับทิม', 'แสงสุวรรณ', 'จันทร์มูล', 'อภัยรุณ', 'เทียนชัย', 'ไชยวรรณ', 'ทิพย์กมล', 'พ่วงพี', 'สีดา',
];

function makeRng(seed) {
    let s = seed >>> 0;
    return function next() {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
}

function gpaSample(rng) {
    let u = 0;
    for (let i = 0; i < 4; i++) u += rng();
    const n = u - 2;
    let g = 3.00 + n * 0.72;
    if (g < 1.50) g = 1.50;
    if (g > 4.00) g = 4.00;
    return Math.round(g * 100) / 100;
}

function pickMajor(rng) {
    let r = rng();
    for (let i = 0; i < MAJOR_WEIGHTS.length; i++) {
        const name = MAJOR_WEIGHTS[i][0];
        const w = MAJOR_WEIGHTS[i][1];
        if (r < w) return name;
        r -= w;
    }
    return MAJOR_WEIGHTS[0][0];
}

function makeStudent(rng, id, major, level, year) {
    const isFemale = rng() < 0.61;
    const first = isFemale ? pick(rng, FEMALE_FIRST) : pick(rng, MALE_FIRST);
    const lastName = pick(rng, LAST);
    const gpa = gpaSample(rng);
    const status = (gpa < 2.00 && rng() < 0.7) ? 'รอพินิจ' : 'กำลังศึกษา';
    return {
        id,
        prefix: isFemale ? 'นางสาว' : 'นาย',
        name: first + ' ' + lastName,
        major,
        level,
        year,
        status,
        gpa,
    };
}

export function generatePaddedStudents(curated) {
    const rng = makeRng(20240425);
    const existingIds = new Set(curated.map(s => s.id));

    const targets = [
        { cohortCode: '65', year: 4, target: 303 },
        { cohortCode: '66', year: 3, target: 320 },
        { cohortCode: '67', year: 2, target: 409 },
        { cohortCode: '68', year: 1, target: 397 },
    ];

    const padded = [];
    for (let ti = 0; ti < targets.length; ti++) {
        const t = targets[ti];
        const existing = curated.filter(s =>
            s.id.indexOf(t.cohortCode) === 0 && s.level === 'ปริญญาตรี' && s.year === t.year
        ).length;
        const need = Math.max(0, t.target - existing);
        const counters = {};
        let made = 0;
        let guard = 0;
        while (made < need && guard < need * 5 + 50) {
            guard++;
            const major = pickMajor(rng);
            const majorCode = MAJOR_CODES[major];
            if (!counters[majorCode]) counters[majorCode] = 1;
            const seq = counters[majorCode]++;
            const id = t.cohortCode + majorCode + '3' + String(seq).padStart(2, '0');
            if (existingIds.has(id)) continue;
            existingIds.add(id);
            padded.push(makeStudent(rng, id, major, 'ปริญญาตรี', t.year));
            made++;
        }
    }

    // ป.โท เพิ่มให้ครบ 17 (curated มี 4)
    const masterExisting = curated.filter(s => s.level === 'ปริญญาโท').length;
    const masterNeed = Math.max(0, 17 - masterExisting);
    for (let i = 0; i < masterNeed; i++) {
        const cohort = i < masterNeed / 2 ? '67' : '68';
        const major = pickMajor(rng);
        const seq = 302 + i;
        const id = cohort + '201' + '3' + String(seq).slice(-2);
        if (existingIds.has(id)) continue;
        existingIds.add(id);
        const stu = makeStudent(rng, id, major, 'ปริญญาโท', i < 4 ? 2 : 1);
        stu.gpa = Math.round((3.30 + rng() * 0.7) * 100) / 100;
        padded.push(stu);
    }

    // ป.เอก ให้ครบ 5 (curated มี 2)
    const docExisting = curated.filter(s => s.level === 'ปริญญาเอก').length;
    const docNeed = Math.max(0, 5 - docExisting);
    for (let i = 0; i < docNeed; i++) {
        const cohort = ['65', '66', '67'][i % 3];
        const major = pickMajor(rng);
        const id = cohort + '301' + String(302 + i);
        if (existingIds.has(id)) continue;
        existingIds.add(id);
        const stu = makeStudent(rng, id, major, 'ปริญญาเอก', 2 + (i % 3));
        stu.gpa = Math.round((3.65 + rng() * 0.35) * 100) / 100;
        padded.push(stu);
    }

    return padded;
}
