// Generates a sample Excel file with 100 fake Thai students
// for the Admin "อัปโหลดข้อมูลนักศึกษา" upload flow.
// Run: node scripts/generate-sample-students.cjs
const XLSX = require('xlsx');
const path = require('path');

const MAJORS = [
    { code: '101', name: 'เคมี' },
    { code: '102', name: 'วิทยาการคอมพิวเตอร์' },
    { code: '103', name: 'เทคโนโลยีสารสนเทศ' },
    { code: '104', name: 'สถิติและการจัดการสารสนเทศ' },
    { code: '105', name: 'เทคโนโลยีชีวภาพ' },
    { code: '106', name: 'คณิตศาสตร์' },
    { code: '107', name: 'ฟิสิกส์ประยุกต์' },
    { code: '108', name: 'ชีววิทยา' },
    { code: '109', name: 'นวัตกรรมเคมีอุตสาหกรรม' },
    { code: '110', name: 'วิทยาการข้อมูล' },
    { code: '111', name: 'เคมีอุตสาหกรรมและเทคโนโลยีสิ่งทอ' },
    { code: '112', name: 'เทคโนโลยีนาโน' },
];

const FIRST_MALE = [
    'กิตติพงศ์','ชยพล','ณฐพงศ์','ธนกร','ธีรภัทร','ภูวดล','วัชรพล','อภิสิทธิ์','พงศกร','กรวิชญ์',
    'กชณัฐพัฒน์','จิรพัฒน์','ชัยวัฒน์','เจษฎา','ณัฐพงศ์','ธนดล','ศุภวิชญ์','ณภัทร','รัฐพล','ปฏิพัทธ์',
    'ณัฐวุฒิ','สิทธิพล','กิตติศักดิ์','ณัฐชนน','ธนภัทร','พีรพัฒน์','ภาณุวัฒน์','วรากร','กรวิวัฒน์','ธนกฤต',
    'ปฏิภาณ','พงศ์ภัค','ภัทรดนัย','อัครพนธ์','ชยุตพงศ์','ทิวากร','พุฒิพงศ์','ศิวกร','นพรุจ','จักรพงศ์',
    'ธีรนันท์','กิตติชัย','ชัยนันท์','ณฐกร','นนทกร','ปัญจพล','รัชชานนท์','วชิรวิทย์','ณัฏฐ์ธนัน','ภูวนาท',
    'สุริยา','ภูรินทร์','ธนวัฒน์','ธนวินท์','กฤษณะ','อนุวัฒน์','ไกรวิชญ์','ศักดิ์ชัย','จิรายุ','ปัณณวิชญ์',
];

const FIRST_FEMALE = [
    'กนกรดา','กนกวรรณ','จิราพร','ณัฐวดี','ธนพร','นภัสสร','ปิยะธิดา','กนกพร','พิชญา','ศศิประภา',
    'สิรินทรา','กชกร','กมลชนก','กัญญาณัฐ','เกวลิน','ณัฐณิชา','กชพรรณ','ปรารถนา','จิราวรรณ','อารยา',
    'วรัญญา','สุพิชชา','พิมพ์ลภัส','กัลยา','พัชริดา','ชลธิชา','ปวีณา','รัตนาภรณ์','จุฑามาศ','บุษยมาส',
    'จารุวรรณ','ธัญชนก','มัณฑนา','ปาริฉัตร','สุทธิดา','อมลวรรณ','ธิดารัตน์','กนกพิชญ์','ณิชา','จิรัชญา',
    'ธัญญาภรณ์','ภาวิดา','กานต์ธิดา','ปาณิสรา','วาสิตา','กุลธิดา','สิริยากร','กัญญาพัชร','ภัทราภรณ์','ชุติมา',
    'วรรณพร','ปิยวรรณ','ปวันรัตน์','อภิชญา','รมิตา','พิมพกานต์','ธารารัตน์','นันทิชา','อรวรรณ','ลลิตา',
];

const LAST_NAMES = [
    'ดวงรัตน์','เหลาทอง','วงศ์ประสิทธิ์','แสนอินทร์','ตาสิงห์','อุปนันท์','แก้วมา','ชัยวงค์','ปินตา','สุวรรณ',
    'รัตนากร','แสงจันทร์','คำมูล','โนจิตต์','อภัยรุณ','เมืองแก้ว','สมศรี','ทองคำ','น้อยเรือน','วงค์แก้ว',
    'ใจปัญญา','สมนึก','ไชยวงค์','จันทร์เพ็ญ','อินทะจักร','บุญเรือง','พลอยเกิด','โป้ยขำ','สุทธิ','แก้วนิล',
    'ปัญญาดี','สุริยา','ชัยมงคล','ธรรมชื่น','คำเงิน','ยานะแสง','แสงทอง','ถาอ้าย','อุ่นใจ','บุญครอง',
    'ดวงจันทร์','วังทอง','ลุงทุน','ใจเที่ยง','สีดา','บุตรดี','ปัญญาวงค์','รินทร์แก้ว','จ๋อมแก้ว','แสงประทีป',
    'จิตรเจริญ','ใจสม','ชัยศรี','วงค์คำ','แก้วมณี','พ่วงพี','เงินยวง','ทองสกุล','คำปัน','ไชยวรรณ',
    'แซ่ว่าง','สุภาพ','ทิพย์กมล','เนตรนิล','ดวงแก้ว','อินต๊ะนอน','มูลวงศ์','ศรีบุญเรือง','ทับทิม','เขียวสดใส',
    'จิตธรรม','คำปินตา','สุขสำราญ','ปวงงาม','เมืองมูล','ยะเชียงแก้ว','ชุมภู','แสนสุข','อ่อนสา','ปันแก้ว',
    'วิชัยวงค์','วันดี','ไทยสมุทร','ธรรมวิชัย','ศรีสะอาด','จันทร์สว่าง','สุขเกษม','ประดิษฐ์','แก้วตาปี','คำมี',
    'รุ่งเรืองมณี','ยศสุรินทร์','สิทธิชัย','แสงสุวรรณ','อุปจักร์','ปันดอน','เลิศวิไล','สุขอิ่ม','คิดหา','แก้วเมือง',
    'ปัญญาพิพัฒน์','เทียนชัย','จันทร์มูล','วิวัฒน์','ดอกจำปา','พิมสาร','เกตุแก้ว','แก้วมูล','อินทร์แก้ว','จอมขวัญ',
    'ชัยวุฒิ','ลำพึง','ทิพย์จักร','อ้อยหวาน','สุมาลี','ประเสริฐ','สิริกุล','ชัยเทพ','ขันแก้ว','สาริกัน',
];

// Seeded RNG for reproducible output
let seed = 20260423;
function rand() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
}
function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
function randInt(min, max) { return Math.floor(rand() * (max - min + 1)) + min; }
function randGPA() {
    // Mostly 2.00-3.95, few outliers
    const r = rand();
    if (r < 0.05) return Number((1.50 + rand() * 0.49).toFixed(2)); // struggling
    if (r < 0.20) return Number((2.00 + rand() * 0.50).toFixed(2));
    if (r < 0.70) return Number((2.50 + rand() * 1.00).toFixed(2));
    return Number((3.50 + rand() * 0.50).toFixed(2));
}

// Year code (รหัสรุ่น) → year level
// 65 → ปี 4, 66 → ปี 3, 67 → ปี 2, 68 → ปี 1
const YEAR_CODES = [
    { code: '65', year: 4, weight: 22 },
    { code: '66', year: 3, weight: 25 },
    { code: '67', year: 2, weight: 26 },
    { code: '68', year: 1, weight: 27 },
];

function weightedYearCode() {
    const total = YEAR_CODES.reduce((s, y) => s + y.weight, 0);
    let r = rand() * total;
    for (const y of YEAR_CODES) {
        r -= y.weight;
        if (r <= 0) return y;
    }
    return YEAR_CODES[YEAR_CODES.length - 1];
}

// Track used IDs so nothing collides
const usedIds = new Set();
function makeId(yearCode, majorCode) {
    for (let attempt = 0; attempt < 50; attempt++) {
        const seq = String(randInt(301, 399));
        const id = `${yearCode}01${majorCode}${seq}`;
        if (!usedIds.has(id)) {
            usedIds.add(id);
            return id;
        }
    }
    // Fallback: extend sequence
    const id = `${yearCode}01${majorCode}${randInt(400, 499)}`;
    usedIds.add(id);
    return id;
}

const records = [];

// 96 undergraduate students, evenly-ish spread across majors
for (let i = 0; i < 96; i++) {
    const major = MAJORS[i % MAJORS.length];
    const yc = weightedYearCode();
    const isFemale = rand() < 0.55;
    const prefix = isFemale ? 'นางสาว' : 'นาย';
    const first = pick(isFemale ? FIRST_FEMALE : FIRST_MALE);
    const last = pick(LAST_NAMES);

    records.push({
        'รหัสนักศึกษา': makeId(yc.code, major.code),
        'คำนำหน้า': prefix,
        'ชื่อ-นามสกุล': `${first} ${last}`,
        'สาขาวิชา': major.name,
        'ระดับการศึกษา': 'ปริญญาตรี',
        'ชั้นปี': yc.year,
        'สถานะ': 'กำลังศึกษา',
        'GPA': randGPA(),
    });
}

// 3 graduate (ปริญญาโท) + 1 doctoral (ปริญญาเอก) for variety
const gradMajors = ['เคมี', 'วิทยาการคอมพิวเตอร์', 'เทคโนโลยีชีวภาพ'];
gradMajors.forEach((m, idx) => {
    const majorCode = MAJORS.find(x => x.name === m).code;
    const yc = YEAR_CODES[idx % 3]; // 65/66/67
    const isFemale = rand() < 0.5;
    records.push({
        'รหัสนักศึกษา': `${yc.code}012${majorCode.slice(1)}30${idx + 1}`,
        'คำนำหน้า': isFemale ? 'นางสาว' : 'นาย',
        'ชื่อ-นามสกุล': `${pick(isFemale ? FIRST_FEMALE : FIRST_MALE)} ${pick(LAST_NAMES)}`,
        'สาขาวิชา': m,
        'ระดับการศึกษา': 'ปริญญาโท',
        'ชั้นปี': randInt(1, 2),
        'สถานะ': 'กำลังศึกษา',
        'GPA': Number((3.50 + rand() * 0.49).toFixed(2)),
    });
});
records.push({
    'รหัสนักศึกษา': '6501301401',
    'คำนำหน้า': 'นาย',
    'ชื่อ-นามสกุล': `${pick(FIRST_MALE)} ${pick(LAST_NAMES)}`,
    'สาขาวิชา': 'ชีววิทยา',
    'ระดับการศึกษา': 'ปริญญาเอก',
    'ชั้นปี': 3,
    'สถานะ': 'กำลังศึกษา',
    'GPA': Number((3.70 + rand() * 0.29).toFixed(2)),
});

// Build workbook
const ws = XLSX.utils.json_to_sheet(records, {
    header: [
        'รหัสนักศึกษา',
        'คำนำหน้า',
        'ชื่อ-นามสกุล',
        'สาขาวิชา',
        'ระดับการศึกษา',
        'ชั้นปี',
        'สถานะ',
        'GPA',
    ],
});

// Column widths for readability
ws['!cols'] = [
    { wch: 14 }, // รหัสนักศึกษา
    { wch: 10 }, // คำนำหน้า
    { wch: 28 }, // ชื่อ-นามสกุล
    { wch: 28 }, // สาขาวิชา
    { wch: 14 }, // ระดับการศึกษา
    { wch: 8 },  // ชั้นปี
    { wch: 12 }, // สถานะ
    { wch: 8 },  // GPA
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'นักศึกษา');

const outPath = path.join(__dirname, '..', 'sample-students-100.xlsx');
XLSX.writeFile(wb, outPath);
console.log(`OK: wrote ${records.length} records to ${outPath}`);
