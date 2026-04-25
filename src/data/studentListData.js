// ข้อมูลรายชื่อนักศึกษาคณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้
// อ้างอิง: dashboard.mju.ac.th/studentList.aspx?dep=20300-20300-20300
// 9 สาขาจริงของหลักสูตรปริญญาตรี (อ้างอิง วิกิพีเดีย/ทะเบียนหลักสูตร มจ.)
//
// จำนวนรวมในไฟล์นี้ปรับให้ตรงกับ mockData.scienceFaculty.total = 1,450 คน
// 100 รายการแรกเป็นข้อมูลที่จัดทำมือ (curated) เพื่อให้ค้นหาตามรหัสนิสิตจริงได้
// ที่เหลือถูกเติมโดย deterministic generator ด้านล่าง (seed คงที่ → ผลซ้ำได้)

export const SCIENCE_MAJORS = [
    'วิทยาการคอมพิวเตอร์',
    'เทคโนโลยีสารสนเทศ',
    'เคมี',
    'เคมีอุตสาหกรรมและเทคโนโลยีสิ่งทอ',
    'คณิตศาสตร์',
    'สถิติ',
    'เทคโนโลยีชีวภาพ',
    'ฟิสิกส์ประยุกต์',
    'วัสดุศาสตร์',
];

// 100 records ที่ทำมือ — เป็นรายชื่อที่ใช้ทดสอบค้นหา/แสดงในตาราง
const curatedStudentList = [
    // ===== รหัส 65 (ปี 4) =====
    { id: '6501101301', prefix: 'นางสาว', name: 'กนกรดา ดวงรัตน์', major: 'เคมี', level: 'ปริญญาตรี', year: 4, status: 'กำลังศึกษา', gpa: 3.25 },
    { id: '6501101302', prefix: 'นางสาว', name: 'กนกวรรณ เหลาทอง', major: 'เคมี', level: 'ปริญญาตรี', year: 4, status: 'กำลังศึกษา', gpa: 3.41 },
    { id: '6501102301', prefix: 'นาย', name: 'กฤตภาส วงศ์ประสิทธิ์', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 4, status: 'กำลังศึกษา', gpa: 3.18 },
    { id: '6501102302', prefix: 'นาย', name: 'กิตติพงศ์ แสนอินทร์', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 4, status: 'กำลังศึกษา', gpa: 2.89 },
    { id: '6501102303', prefix: 'นางสาว', name: 'จิราพร ตาสิงห์', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 4, status: 'กำลังศึกษา', gpa: 3.55 },
    { id: '6501102304', prefix: 'นาย', name: 'ชยพล อุปนันท์', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 4, status: 'กำลังศึกษา', gpa: 2.45 },
    { id: '6501102305', prefix: 'นาย', name: 'ณฐพงศ์ แก้วมา', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 4, status: 'กำลังศึกษา', gpa: 3.72 },
    { id: '6501103301', prefix: 'นางสาว', name: 'ณัฐวดี ชัยวงค์', major: 'เทคโนโลยีสารสนเทศ', level: 'ปริญญาตรี', year: 4, status: 'กำลังศึกษา', gpa: 3.01 },
    { id: '6501103302', prefix: 'นาย', name: 'ธนกร ปินตา', major: 'เทคโนโลยีสารสนเทศ', level: 'ปริญญาตรี', year: 4, status: 'กำลังศึกษา', gpa: 2.78 },
    { id: '6501103303', prefix: 'นางสาว', name: 'ธนพร สุวรรณ', major: 'เทคโนโลยีสารสนเทศ', level: 'ปริญญาตรี', year: 4, status: 'กำลังศึกษา', gpa: 3.33 },
    { id: '6501104301', prefix: 'นาย', name: 'ธีรภัทร รัตนากร', major: 'สถิติ', level: 'ปริญญาตรี', year: 4, status: 'กำลังศึกษา', gpa: 2.95 },
    { id: '6501104302', prefix: 'นางสาว', name: 'นภัสสร แสงจันทร์', major: 'สถิติ', level: 'ปริญญาตรี', year: 4, status: 'กำลังศึกษา', gpa: 3.48 },
    { id: '6501105301', prefix: 'นางสาว', name: 'ปิยะธิดา คำมูล', major: 'เทคโนโลยีชีวภาพ', level: 'ปริญญาตรี', year: 4, status: 'กำลังศึกษา', gpa: 3.65 },
    { id: '6501105302', prefix: 'นางสาว', name: 'กนกพร โนจิตต์', major: 'เทคโนโลยีชีวภาพ', level: 'ปริญญาตรี', year: 4, status: 'กำลังศึกษา', gpa: 3.12 },
    { id: '6501105303', prefix: 'นางสาว', name: 'กนกวรรณ อภัยรุณ', major: 'เทคโนโลยีชีวภาพ', level: 'ปริญญาตรี', year: 4, status: 'กำลังศึกษา', gpa: 2.67 },
    { id: '6501106301', prefix: 'นางสาว', name: 'พิชญา เมืองแก้ว', major: 'คณิตศาสตร์', level: 'ปริญญาตรี', year: 4, status: 'กำลังศึกษา', gpa: 3.82 },
    { id: '6501106302', prefix: 'นาย', name: 'ภูวดล สมศรี', major: 'คณิตศาสตร์', level: 'ปริญญาตรี', year: 4, status: 'กำลังศึกษา', gpa: 2.55 },
    { id: '6501107301', prefix: 'นาย', name: 'วัชรพล ทองคำ', major: 'ฟิสิกส์ประยุกต์', level: 'ปริญญาตรี', year: 4, status: 'กำลังศึกษา', gpa: 3.15 },
    { id: '6501107302', prefix: 'นางสาว', name: 'ศศิประภา น้อยเรือน', major: 'ฟิสิกส์ประยุกต์', level: 'ปริญญาตรี', year: 4, status: 'กำลังศึกษา', gpa: 3.28 },
    { id: '6501108301', prefix: 'นางสาว', name: 'สิรินทรา วงค์แก้ว', major: 'เทคโนโลยีชีวภาพ', level: 'ปริญญาตรี', year: 4, status: 'กำลังศึกษา', gpa: 2.91 },
    { id: '6501108302', prefix: 'นาย', name: 'อภิสิทธิ์ ใจปัญญา', major: 'เทคโนโลยีชีวภาพ', level: 'ปริญญาตรี', year: 4, status: 'กำลังศึกษา', gpa: 1.85 },
    { id: '6501109301', prefix: 'นางสาว', name: 'กชกร สมนึก', major: 'เคมีอุตสาหกรรมและเทคโนโลยีสิ่งทอ', level: 'ปริญญาตรี', year: 4, status: 'กำลังศึกษา', gpa: 3.45 },
    { id: '6501110301', prefix: 'นาย', name: 'พงศกร ไชยวงค์', major: 'วัสดุศาสตร์', level: 'ปริญญาตรี', year: 4, status: 'กำลังศึกษา', gpa: 3.67 },
    // ===== รหัส 66 (ปี 3) =====
    { id: '6601101301', prefix: 'นางสาว', name: 'กมลชนก จันทร์เพ็ญ', major: 'เคมี', level: 'ปริญญาตรี', year: 3, status: 'กำลังศึกษา', gpa: 3.35 },
    { id: '6601101302', prefix: 'นาย', name: 'กรวิชญ์ อินทะจักร', major: 'เคมี', level: 'ปริญญาตรี', year: 3, status: 'กำลังศึกษา', gpa: 2.78 },
    { id: '6601101303', prefix: 'นางสาว', name: 'กัญญาณัฐ บุญเรือง', major: 'เคมี', level: 'ปริญญาตรี', year: 3, status: 'กำลังศึกษา', gpa: 3.52 },
    { id: '6601102301', prefix: 'นาย', name: 'กชณัฐพัฒน์ พลอยเกิด', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 3, status: 'กำลังศึกษา', gpa: 3.28 },
    { id: '6601102302', prefix: 'นาย', name: 'กนกพล โป้ยขำ', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 3, status: 'กำลังศึกษา', gpa: 2.95 },
    { id: '6601102303', prefix: 'นางสาว', name: 'เกวลิน สุทธิ', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 3, status: 'กำลังศึกษา', gpa: 3.61 },
    { id: '6601102304', prefix: 'นาย', name: 'จิรพัฒน์ แก้วนิล', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 3, status: 'กำลังศึกษา', gpa: 2.45 },
    { id: '6601102305', prefix: 'นาย', name: 'ชัยวัฒน์ ปัญญาดี', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 3, status: 'กำลังศึกษา', gpa: 3.15 },
    { id: '6601102306', prefix: 'นาย', name: 'เจษฎา สุริยา', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 3, status: 'กำลังศึกษา', gpa: 1.75 },
    { id: '6601102307', prefix: 'นางสาว', name: 'ณัฐณิชา ชัยมงคล', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 3, status: 'กำลังศึกษา', gpa: 3.88 },
    { id: '6601103301', prefix: 'นางสาว', name: 'กชพรรณ ธรรมชื่น', major: 'เทคโนโลยีสารสนเทศ', level: 'ปริญญาตรี', year: 3, status: 'กำลังศึกษา', gpa: 3.21 },
    { id: '6601103302', prefix: 'นาย', name: 'ณัฐพงศ์ คำเงิน', major: 'เทคโนโลยีสารสนเทศ', level: 'ปริญญาตรี', year: 3, status: 'กำลังศึกษา', gpa: 2.88 },
    { id: '6601103303', prefix: 'นางสาว', name: 'กนกวรรณ ยานะแสง', major: 'เทคโนโลยีสารสนเทศ', level: 'ปริญญาตรี', year: 3, status: 'กำลังศึกษา', gpa: 3.42 },
    { id: '6601103304', prefix: 'นาย', name: 'ธนดล แสงทอง', major: 'เทคโนโลยีสารสนเทศ', level: 'ปริญญาตรี', year: 3, status: 'กำลังศึกษา', gpa: 2.55 },
    { id: '6601104301', prefix: 'นาย', name: 'กนกพิชญ์ ถาอ้าย', major: 'สถิติ', level: 'ปริญญาตรี', year: 3, status: 'กำลังศึกษา', gpa: 3.05 },
    { id: '6601104302', prefix: 'นางสาว', name: 'ปรารถนา อุ่นใจ', major: 'สถิติ', level: 'ปริญญาตรี', year: 3, status: 'กำลังศึกษา', gpa: 3.71 },
    { id: '6601105301', prefix: 'นางสาว', name: 'จิราวรรณ บุญครอง', major: 'เทคโนโลยีชีวภาพ', level: 'ปริญญาตรี', year: 3, status: 'กำลังศึกษา', gpa: 3.15 },
    { id: '6601105302', prefix: 'นาย', name: 'พิชชากร ดวงจันทร์', major: 'เทคโนโลยีชีวภาพ', level: 'ปริญญาตรี', year: 3, status: 'กำลังศึกษา', gpa: 2.68 },
    { id: '6601106301', prefix: 'นาย', name: 'ศุภวิชญ์ วังทอง', major: 'คณิตศาสตร์', level: 'ปริญญาตรี', year: 3, status: 'กำลังศึกษา', gpa: 3.55 },
    { id: '6601106302', prefix: 'นางสาว', name: 'อารยา ลุงทุน', major: 'คณิตศาสตร์', level: 'ปริญญาตรี', year: 3, status: 'กำลังศึกษา', gpa: 2.92 },
    { id: '6601107301', prefix: 'นาย', name: 'ณภัทร ใจเที่ยง', major: 'ฟิสิกส์ประยุกต์', level: 'ปริญญาตรี', year: 3, status: 'กำลังศึกษา', gpa: 3.38 },
    { id: '6601108301', prefix: 'นางสาว', name: 'วรัญญา สีดา', major: 'เทคโนโลยีชีวภาพ', level: 'ปริญญาตรี', year: 3, status: 'กำลังศึกษา', gpa: 3.08 },
    { id: '6601108302', prefix: 'นาย', name: 'รัฐพล บุตรดี', major: 'เทคโนโลยีชีวภาพ', level: 'ปริญญาตรี', year: 3, status: 'กำลังศึกษา', gpa: 2.35 },
    { id: '6601109301', prefix: 'นางสาว', name: 'สุพิชชา ปัญญาวงค์', major: 'เคมีอุตสาหกรรมและเทคโนโลยีสิ่งทอ', level: 'ปริญญาตรี', year: 3, status: 'กำลังศึกษา', gpa: 3.25 },
    { id: '6601110301', prefix: 'นาย', name: 'ปฏิพัทธ์ รินทร์แก้ว', major: 'วัสดุศาสตร์', level: 'ปริญญาตรี', year: 3, status: 'กำลังศึกษา', gpa: 3.75 },
    { id: '6601110302', prefix: 'นางสาว', name: 'พิมพ์ลภัส จ๋อมแก้ว', major: 'วัสดุศาสตร์', level: 'ปริญญาตรี', year: 3, status: 'กำลังศึกษา', gpa: 3.45 },
    // ===== รหัส 67 (ปี 2) =====
    { id: '6701101301', prefix: 'นางสาว', name: 'กัลยา แสงประทีป', major: 'เคมี', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 3.18 },
    { id: '6701101302', prefix: 'นาย', name: 'ณัฐวุฒิ จิตรเจริญ', major: 'เคมี', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 2.65 },
    { id: '6701101303', prefix: 'นางสาว', name: 'พัชริดา ใจสม', major: 'เคมี', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 3.52 },
    { id: '6701101304', prefix: 'นาย', name: 'สิทธิพล ชัยศรี', major: 'เคมี', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 2.88 },
    { id: '6701102301', prefix: 'นาย', name: 'กิตติศักดิ์ วงค์คำ', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 3.42 },
    { id: '6701102302', prefix: 'นางสาว', name: 'ชลธิชา แก้วมณี', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 3.15 },
    { id: '6701102303', prefix: 'นาย', name: 'ณัฐชนน พ่วงพี', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 2.75 },
    { id: '6701102304', prefix: 'นาย', name: 'ธนภัทร เงินยวง', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 3.58 },
    { id: '6701102305', prefix: 'นางสาว', name: 'ปวีณา ทองสกุล', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 3.82 },
    { id: '6701102306', prefix: 'นาย', name: 'พีรพัฒน์ คำปัน', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 2.35 },
    { id: '6701102307', prefix: 'นาย', name: 'ภาณุวัฒน์ ไชยวรรณ', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 3.05 },
    { id: '6701102308', prefix: 'นางสาว', name: 'รัตนาภรณ์ แซ่ว่าง', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 3.35 },
    { id: '6701102309', prefix: 'นาย', name: 'วรากร สุภาพ', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 1.95 },
    { id: '6701103301', prefix: 'นาย', name: 'กรวิวัฒน์ ทิพย์กมล', major: 'เทคโนโลยีสารสนเทศ', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 3.22 },
    { id: '6701103302', prefix: 'นางสาว', name: 'จุฑามาศ เนตรนิล', major: 'เทคโนโลยีสารสนเทศ', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 3.68 },
    { id: '6701103303', prefix: 'นาย', name: 'ธนกฤต ดวงแก้ว', major: 'เทคโนโลยีสารสนเทศ', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 2.58 },
    { id: '6701103304', prefix: 'นางสาว', name: 'บุษยมาส อินต๊ะนอน', major: 'เทคโนโลยีสารสนเทศ', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 3.75 },
    { id: '6701103305', prefix: 'นาย', name: 'ปฏิภาณ มูลวงศ์', major: 'เทคโนโลยีสารสนเทศ', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 2.92 },
    { id: '6701104301', prefix: 'นางสาว', name: 'จารุวรรณ ศรีบุญเรือง', major: 'สถิติ', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 3.15 },
    { id: '6701104302', prefix: 'นาย', name: 'พงศ์ภัค ทับทิม', major: 'สถิติ', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 2.78 },
    { id: '6701105301', prefix: 'นางสาว', name: 'ธัญชนก เขียวสดใส', major: 'เทคโนโลยีชีวภาพ', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 3.45 },
    { id: '6701105302', prefix: 'นาย', name: 'ภัทรดนัย จิตธรรม', major: 'เทคโนโลยีชีวภาพ', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 2.55 },
    { id: '6701106301', prefix: 'นางสาว', name: 'มัณฑนา คำปินตา', major: 'คณิตศาสตร์', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 3.62 },
    { id: '6701106302', prefix: 'นาย', name: 'อัครพนธ์ สุขสำราญ', major: 'คณิตศาสตร์', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 2.45 },
    { id: '6701107301', prefix: 'นาย', name: 'ชยุตพงศ์ ปวงงาม', major: 'ฟิสิกส์ประยุกต์', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 3.12 },
    { id: '6701107302', prefix: 'นางสาว', name: 'ปาริฉัตร สุริยะ', major: 'ฟิสิกส์ประยุกต์', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 3.38 },
    { id: '6701108301', prefix: 'นาย', name: 'ทิวากร เมืองมูล', major: 'เทคโนโลยีชีวภาพ', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 2.81 },
    { id: '6701108302', prefix: 'นางสาว', name: 'สุทธิดา ยะเชียงแก้ว', major: 'เทคโนโลยีชีวภาพ', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 3.55 },
    { id: '6701109301', prefix: 'นาย', name: 'พุฒิพงศ์ ชุมภู', major: 'เคมีอุตสาหกรรมและเทคโนโลยีสิ่งทอ', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 3.02 },
    { id: '6701109302', prefix: 'นางสาว', name: 'อมลวรรณ แสนสุข', major: 'เคมีอุตสาหกรรมและเทคโนโลยีสิ่งทอ', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 3.72 },
    { id: '6701110301', prefix: 'นาย', name: 'ศิวกร อ่อนสา', major: 'วัสดุศาสตร์', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 3.85 },
    { id: '6701110302', prefix: 'นางสาว', name: 'ธิดารัตน์ ปันแก้ว', major: 'วัสดุศาสตร์', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 3.25 },
    { id: '6701110303', prefix: 'นาย', name: 'นพรุจ วิชัยวงค์', major: 'วัสดุศาสตร์', level: 'ปริญญาตรี', year: 2, status: 'กำลังศึกษา', gpa: 2.92 },
    // ===== รหัส 68 (ปี 1) =====
    { id: '6801101301', prefix: 'นางสาว', name: 'กนกพิชญ์ วันดี', major: 'เคมี', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 3.35 },
    { id: '6801101302', prefix: 'นาย', name: 'จักรพงศ์ ไทยสมุทร', major: 'เคมี', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 2.72 },
    { id: '6801101303', prefix: 'นางสาว', name: 'ณิชา ธรรมวิชัย', major: 'เคมี', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 3.65 },
    { id: '6801101304', prefix: 'นาย', name: 'ธีรนันท์ ศรีสะอาด', major: 'เคมี', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 2.45 },
    { id: '6801102301', prefix: 'นาย', name: 'กิตติชัย จันทร์สว่าง', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 3.55 },
    { id: '6801102302', prefix: 'นางสาว', name: 'จิรัชญา สุขเกษม', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 3.82 },
    { id: '6801102303', prefix: 'นาย', name: 'ชัยนันท์ ประดิษฐ์', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 2.15 },
    { id: '6801102304', prefix: 'นาย', name: 'ณฐกร แก้วตาปี', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 3.25 },
    { id: '6801102305', prefix: 'นางสาว', name: 'ธัญญาภรณ์ คำมี', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 3.72 },
    { id: '6801102306', prefix: 'นาย', name: 'นนทกร รุ่งเรืองมณี', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 2.88 },
    { id: '6801102307', prefix: 'นาย', name: 'ปัญจพล ยศสุรินทร์', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 3.45 },
    { id: '6801102308', prefix: 'นางสาว', name: 'ภาวิดา สิทธิชัย', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 3.18 },
    { id: '6801102309', prefix: 'นาย', name: 'รัชชานนท์ แสงสุวรรณ', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 2.65 },
    { id: '6801102310', prefix: 'นาย', name: 'วชิรวิทย์ อุปจักร์', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 3.92 },
    { id: '6801103301', prefix: 'นางสาว', name: 'กานต์ธิดา ปันดอน', major: 'เทคโนโลยีสารสนเทศ', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 3.42 },
    { id: '6801103302', prefix: 'นาย', name: 'ณัฏฐ์ธนัน เลิศวิไล', major: 'เทคโนโลยีสารสนเทศ', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 2.78 },
    { id: '6801103303', prefix: 'นางสาว', name: 'ปาณิสรา สุขอิ่ม', major: 'เทคโนโลยีสารสนเทศ', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 3.55 },
    { id: '6801103304', prefix: 'นาย', name: 'ภูวนาท คิดหา', major: 'เทคโนโลยีสารสนเทศ', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 3.08 },
    { id: '6801103305', prefix: 'นางสาว', name: 'วาสิตา แก้วเมือง', major: 'เทคโนโลยีสารสนเทศ', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 2.95 },
    { id: '6801103306', prefix: 'นาย', name: 'สุริยา ปัญญาพิพัฒน์', major: 'เทคโนโลยีสารสนเทศ', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 3.15 },
    { id: '6801104301', prefix: 'นางสาว', name: 'กุลธิดา เทียนชัย', major: 'สถิติ', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 3.28 },
    { id: '6801104302', prefix: 'นาย', name: 'ภูรินทร์ จันทร์มูล', major: 'สถิติ', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 2.82 },
    { id: '6801104303', prefix: 'นางสาว', name: 'สิริยากร วิวัฒน์', major: 'สถิติ', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 3.65 },
    { id: '6801105301', prefix: 'นางสาว', name: 'กัญญาพัชร ดอกจำปา', major: 'เทคโนโลยีชีวภาพ', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 3.38 },
    { id: '6801105302', prefix: 'นาย', name: 'ธนวัฒน์ พิมสาร', major: 'เทคโนโลยีชีวภาพ', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 2.52 },
    { id: '6801105303', prefix: 'นางสาว', name: 'ภัทราภรณ์ เกตุแก้ว', major: 'เทคโนโลยีชีวภาพ', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 3.75 },
    { id: '6801106301', prefix: 'นางสาว', name: 'ชุติมา แก้วมูล', major: 'คณิตศาสตร์', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 3.48 },
    { id: '6801106302', prefix: 'นาย', name: 'ธนวินท์ อินทร์แก้ว', major: 'คณิตศาสตร์', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 2.68 },
    { id: '6801107301', prefix: 'นาย', name: 'กฤษณะ จอมขวัญ', major: 'ฟิสิกส์ประยุกต์', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 3.12 },
    { id: '6801107302', prefix: 'นางสาว', name: 'วรรณพร ชัยวุฒิ', major: 'ฟิสิกส์ประยุกต์', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 3.55 },
    { id: '6801108301', prefix: 'นาย', name: 'อนุวัฒน์ ลำพึง', major: 'เทคโนโลยีชีวภาพ', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 2.75 },
    { id: '6801108302', prefix: 'นางสาว', name: 'ปิยวรรณ ทิพย์จักร', major: 'เทคโนโลยีชีวภาพ', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 3.32 },
    { id: '6801108303', prefix: 'นาย', name: 'ไกรวิชญ์ อ้อยหวาน', major: 'เทคโนโลยีชีวภาพ', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 1.88 },
    { id: '6801109301', prefix: 'นางสาว', name: 'ปวันรัตน์ สุมาลี', major: 'เคมีอุตสาหกรรมและเทคโนโลยีสิ่งทอ', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 3.42 },
    { id: '6801109302', prefix: 'นาย', name: 'ศักดิ์ชัย ประเสริฐ', major: 'เคมีอุตสาหกรรมและเทคโนโลยีสิ่งทอ', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 2.92 },
    { id: '6801110301', prefix: 'นางสาว', name: 'อภิชญา สิริกุล', major: 'วัสดุศาสตร์', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 3.78 },
    { id: '6801110302', prefix: 'นาย', name: 'จิรายุ ชัยเทพ', major: 'วัสดุศาสตร์', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 3.35 },
    { id: '6801110303', prefix: 'นาย', name: 'ปัณณวิชญ์ ขันแก้ว', major: 'วัสดุศาสตร์', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 3.05 },
    { id: '6801110304', prefix: 'นางสาว', name: 'รมิตา สาริกัน', major: 'วัสดุศาสตร์', level: 'ปริญญาตรี', year: 1, status: 'กำลังศึกษา', gpa: 3.62 },
    // ===== บัณฑิตศึกษา =====
    { id: '6501201301', prefix: 'นาย', name: 'ดร.ศุภชัย ทองประเสริฐ', major: 'เคมี', level: 'ปริญญาโท', year: 1, status: 'กำลังศึกษา', gpa: 3.85 },
    { id: '6601201301', prefix: 'นางสาว', name: 'วิภาวดี สมบูรณ์', major: 'เทคโนโลยีชีวภาพ', level: 'ปริญญาโท', year: 1, status: 'กำลังศึกษา', gpa: 3.72 },
    { id: '6601201302', prefix: 'นาย', name: 'เทพพิทักษ์ ปิ่นทอง', major: 'วิทยาการคอมพิวเตอร์', level: 'ปริญญาโท', year: 1, status: 'กำลังศึกษา', gpa: 3.65 },
    { id: '6701201301', prefix: 'นางสาว', name: 'ปรียานุช แก้วเกตุ', major: 'เคมี', level: 'ปริญญาโท', year: 1, status: 'กำลังศึกษา', gpa: 3.92 },
    { id: '6501301301', prefix: 'นาย', name: 'ภัควัต สุขใจ', major: 'เคมี', level: 'ปริญญาเอก', year: 3, status: 'กำลังศึกษา', gpa: 3.95 },
    { id: '6601301301', prefix: 'นางสาว', name: 'สุวรรณี อินทะสอน', major: 'เทคโนโลยีชีวภาพ', level: 'ปริญญาเอก', year: 2, status: 'กำลังศึกษา', gpa: 3.88 },
];

// ───────────────────────────────────────────────────────────────────────
// Procedural padding to reach 1,450 records (matches dashboard total)
// ───────────────────────────────────────────────────────────────────────

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

// สัดส่วน 9 สาขา (รวม = 1.0) — ปรับสะท้อนสัดส่วนจริงของคณะวิทย์ มจ.
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

// LCG ที่ใช้ seed คงที่ — ผลออกมาเหมือนกันทุกครั้งที่โหลด
function makeRng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function gpaSample(rng) {
    // Irwin–Hall(4) → mean 2, sd ≈ 0.577 → recenter & scale to mean 3.00, sd ≈ 0.42
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
    for (const [name, w] of MAJOR_WEIGHTS) {
        if (r < w) return name;
        r -= w;
    }
    return MAJOR_WEIGHTS[0][0];
}

function generateCohort({ rng, count, cohortCode, year, level, runningPrefix, startCounters, existingIds }) {
    const out = [];
    const counters = { ...startCounters };
    let made = 0;
    let guard = 0;
    while (made < count && guard < count * 5) {
        guard++;
        const major = pickMajor(rng);
        const majorCode = MAJOR_CODES[major];
        if (!counters[majorCode]) counters[majorCode] = 1;
        const seq = counters[majorCode]++;
        const id = `${cohortCode}${majorCode}${runningPrefix}${String(seq).padStart(2, '0')}`;
        if (existingIds.has(id)) continue;
        existingIds.add(id);
        const isFemale = rng() < 0.61; // อิงสัดส่วนเพศคณะวิทย์
        const first = isFemale ? pick(rng, FEMALE_FIRST) : pick(rng, MALE_FIRST);
        const lastName = pick(rng, LAST);
        const gpa = gpaSample(rng);
        const status = gpa < 2.00 && rng() < 0.7 ? 'รอพินิจ' : 'กำลังศึกษา';
        out.push({
            id,
            prefix: isFemale ? 'นางสาว' : 'นาย',
            name: `${first} ${lastName}`,
            major,
            level,
            year,
            status,
            gpa,
        });
        made++;
    }
    return out;
}

function generatePaddedStudents() {
    const rng = makeRng(20240425); // seed คงที่
    const existingIds = new Set(curatedStudentList.map(s => s.id));
    // นับเลข running ที่ใช้ไปแล้วต่อรหัสปี+สาขา เพื่อหลีกเลี่ยงชนกับ curated
    const startCountersByCohort = {};
    for (const s of curatedStudentList) {
        const cohort = s.id.slice(0, 2);
        const majorCode = MAJOR_CODES[s.major];
        if (!majorCode) continue;
        const key = `${cohort}|${majorCode}`;
        const tail = parseInt(s.id.slice(-2), 10) || 0;
        if (!startCountersByCohort[key] || tail >= startCountersByCohort[key]) {
            startCountersByCohort[key] = tail + 1;
        }
    }
    const counters = (cohort) => {
        const out = {};
        for (const k of Object.keys(startCountersByCohort)) {
            const [c, code] = k.split('|');
            if (c === cohort) out[code] = startCountersByCohort[k];
        }
        return out;
    };

    // เป้าหมายแต่ละ cohort (สอดคล้อง mockData.byEnrollmentYear)
    // ปี 4 (รหัส 65): 281 + 22 ค้างปี 5 = 303 รวม
    // ปี 3 (รหัส 66): 320
    // ปี 2 (รหัส 67): 409
    // ปี 1 (รหัส 68): 396
    // ป.โท: 17 / ป.เอก: 5 = 22 graduate
    const targets = [
        { cohortCode: '65', year: 4, level: 'ปริญญาตรี', target: 303, runningPrefix: '3' },
        { cohortCode: '66', year: 3, level: 'ปริญญาตรี', target: 320, runningPrefix: '3' },
        { cohortCode: '67', year: 2, level: 'ปริญญาตรี', target: 409, runningPrefix: '3' },
        { cohortCode: '68', year: 1, level: 'ปริญญาตรี', target: 396, runningPrefix: '3' },
    ];

    const padded = [];
    for (const t of targets) {
        const existing = curatedStudentList.filter(s =>
            s.id.startsWith(t.cohortCode) && s.level === 'ปริญญาตรี' && s.year === t.year
        ).length;
        const need = Math.max(0, t.target - existing);
        if (need === 0) continue;
        padded.push(...generateCohort({
            rng,
            count: need,
            cohortCode: t.cohortCode,
            year: t.year,
            level: t.level,
            runningPrefix: t.runningPrefix,
            startCounters: counters(t.cohortCode),
            existingIds,
        }));
    }

    // ป.โท เพิ่มอีกให้ครบ 17 (curated มีอยู่ 4)
    const masterExisting = curatedStudentList.filter(s => s.level === 'ปริญญาโท').length;
    const masterNeed = Math.max(0, 17 - masterExisting);
    if (masterNeed > 0) {
        // กระจายเข้า cohort 66/67/68 (รหัส ป.โท ใช้ 201)
        const distrib = [
            ['66', 2, Math.ceil(masterNeed / 3)],
            ['67', 2, Math.ceil(masterNeed / 3)],
            ['68', 1, masterNeed - 2 * Math.ceil(masterNeed / 3)],
        ].filter(([, , n]) => n > 0);
        for (const [cohort, year, n] of distrib) {
            const startC = {};
            for (const s of [...curatedStudentList, ...padded]) {
                if (!s.id.startsWith(cohort)) continue;
                if (s.id.slice(2, 5) !== '201') continue;
                const tail = parseInt(s.id.slice(-2), 10) || 0;
                startC['201'] = Math.max(startC['201'] || 1, tail + 1);
            }
            for (let i = 0; i < n; i++) {
                const major = pickMajor(rng);
                const seq = (startC['201'] || 1) + i;
                const id = `${cohort}201${'3'}${String(seq).padStart(2, '0')}`;
                if (existingIds.has(id)) continue;
                existingIds.add(id);
                const isFemale = rng() < 0.55;
                const first = isFemale ? pick(rng, FEMALE_FIRST) : pick(rng, MALE_FIRST);
                const lastName = pick(rng, LAST);
                const gpa = Math.round((3.30 + rng() * 0.7) * 100) / 100;
                padded.push({
                    id,
                    prefix: isFemale ? 'นางสาว' : 'นาย',
                    name: `${first} ${lastName}`,
                    major,
                    level: 'ปริญญาโท',
                    year,
                    status: 'กำลังศึกษา',
                    gpa,
                });
            }
        }
    }

    // ป.เอก ให้ครบ 5 (curated มีอยู่ 2)
    const docExisting = curatedStudentList.filter(s => s.level === 'ปริญญาเอก').length;
    const docNeed = Math.max(0, 5 - docExisting);
    for (let i = 0; i < docNeed; i++) {
        const cohort = ['65', '66', '67'][i % 3];
        const major = pickMajor(rng);
        const seq = 302 + i;
        const id = `${cohort}301${String(seq)}`;
        if (existingIds.has(id)) continue;
        existingIds.add(id);
        const isFemale = rng() < 0.5;
        const first = isFemale ? pick(rng, FEMALE_FIRST) : pick(rng, MALE_FIRST);
        const lastName = pick(rng, LAST);
        padded.push({
            id,
            prefix: isFemale ? 'นางสาว' : 'นาย',
            name: `${first} ${lastName}`,
            major,
            level: 'ปริญญาเอก',
            year: 2 + (i % 3),
            status: 'กำลังศึกษา',
            gpa: Math.round((3.65 + rng() * 0.35) * 100) / 100,
        });
    }

    return padded;
}

export const scienceStudentList = [...curatedStudentList, ...generatePaddedStudents()];

// สรุปสถิติ
export const studentListSummary = {
    total: scienceStudentList.length,
    byYear: {
        year4: scienceStudentList.filter(s => s.year === 4 && s.level === 'ปริญญาตรี').length,
        year3: scienceStudentList.filter(s => s.year === 3 && s.level === 'ปริญญาตรี').length,
        year2: scienceStudentList.filter(s => s.year === 2 && s.level === 'ปริญญาตรี').length,
        year1: scienceStudentList.filter(s => s.year === 1 && s.level === 'ปริญญาตรี').length,
    },
    graduate: scienceStudentList.filter(s => s.level !== 'ปริญญาตรี').length,
    source: 'dashboard.mju.ac.th/studentList.aspx?dep=20300-20300-20300'
};
 
