# โครงร่างพรีเซนเทชั่นโปรเจคจบ: Science AI Dashboard

อ้างอิงรูปแบบจากไฟล์ตัวอย่าง `C:\Users\JR\Downloads\บิ็ม.pdf` โดยใช้ลำดับการเล่าแบบโปรเจคจบ: ปก -> ที่มาและปัญหา -> วัตถุประสงค์/ขอบเขต -> ออกแบบระบบ -> ผลลัพธ์แต่ละหน้าจอ -> การทดสอบ -> สรุปและพัฒนาต่อ

หมายเหตุ: ไฟล์ตัวอย่างเป็น PDF 14 หน้า แต่ข้อความในไฟล์ฝังฟอนต์แบบอ่านตรงได้ไม่สมบูรณ์ จึงใช้เป็นตัวอย่างโครงและจังหวะการนำเสนอ ไม่ได้คัดลอกเนื้อหา

## โครงสไลด์แนะนำ

| สไลด์ | หัวข้อ | หน้าเว็บ/ส่วนที่ใช้ | ข้อมูลที่ต้องหยิบ | ภาพ/กราฟที่ควรใส่ | ประเด็นพูด |
|---:|---|---|---|---|---|
| 1 | ปกโครงงาน | `/dashboard` หรือหน้า Login | ชื่อระบบ, ชื่อผู้จัดทำ, อาจารย์ที่ปรึกษา, มหาวิทยาลัย | ภาพหน้าหลักเต็มจอ | แนะนำระบบ Science AI Dashboard สำหรับคณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้ |
| 2 | ที่มาและปัญหา | Sidebar / โครงเมนูระบบ | ข้อมูลกระจายหลายด้าน: นักศึกษา, บุคลากร, วิจัย, การเงิน, OKR | ภาพเมนูด้านซ้ายหรือผังหมวดข้อมูล | ผู้บริหารและเจ้าหน้าที่ต้องรวมข้อมูลจากหลายแหล่ง ทำให้สรุปช้าและดูแนวโน้มยาก |
| 3 | วัตถุประสงค์ | โครงสร้าง route ทั้งระบบ | Web dashboard, AI Chat, Data Visualization, Alert Center, RBAC, Data Upload | Icon/diagram 5 วัตถุประสงค์ | ระบบต้องช่วยดูภาพรวม ถามข้อมูลภาษาไทย สร้างกราฟ และแจ้งเตือนความเสี่ยง |
| 4 | ขอบเขตและผู้ใช้ | `/dashboard/admin`, `accessControl` | Role: Dean, Chair, Staff, General, Student | ตาราง role หรือภาพหน้า Admin | แต่ละบทบาทเห็นข้อมูลตามสิทธิ์ เช่น ผู้บริหารดูภาพรวม/งบ/OKR, นักศึกษาดูข้อมูลตนเอง |
| 5 | ภาพรวมสถาปัตยกรรม | React app + service layer | React/Vite, Firebase Auth/Firestore, Gemini API, Chart.js, Local fallback data | Architecture diagram | Frontend เป็น SPA มี service สำหรับ student data, Gemini, access control และ upload/parser |
| 6 | โครงสร้างข้อมูล | `src/data/*`, `studentDataService` | นักศึกษาคณะวิทย์ 1,451 คน, ข้อมูล dashboard, graduation, research, HR, budget, OKR | Data flow diagram | ข้อมูลนักศึกษาใช้ Firestore realtime ถ้ามีข้อมูลใหม่ และ fallback เป็น dataset ในโปรเจค |
| 7 | หน้าภาพรวมระบบ | `/dashboard` | นักศึกษาทั้งหมด 16,839, นักศึกษาคณะวิทย์ 1,451, GPA รวม 3.12, GPA คณะ 3.18, อัตราสำเร็จคณะ 91.2% | KPI cards + หมวดรายงาน | หน้านี้เป็น executive overview ก่อนเข้า drill-down รายด้าน |
| 8 | ศูนย์แจ้งเตือน | `/dashboard/alerts` | Alert จาก GPA ต่ำกว่า 2.00, GPA เฝ้าระวัง 2.00-2.25, อัตราจบต่ำ, งบใช้สูง, สิทธิบัตรรอพิจารณา, OKR gap | หน้า Alert Center + badge จำนวนข้อมูล 1,451 | จุดเด่นคือ alert อัปเดตตาม student dataset แบบ realtime เมื่อมีข้อมูลนักศึกษาเปลี่ยน |
| 9 | สถิตินิสิตปัจจุบัน | `/dashboard/student-stats` | รวมมหาวิทยาลัย 16,839, คณะวิทย์ 1,451, ป.ตรี 1,429, โท 17, เอก 5, เพศชาย 566/หญิง 885, ratio 14.0:1 | Doughnut/Bar/Line charts | ใช้แสดงจำนวนตามระดับ, คณะ, ปีเข้า, เพศ, สัญชาติ และอัตราส่วนนักศึกษา:อาจารย์ |
| 10 | รายชื่อนักศึกษา | `/dashboard/students` | รายชื่อนักศึกษา 1,451 คน, สาขา, ชั้นปี, GPA, สถานะ | ตารางรายชื่อ + filter/search | แสดงการค้นหา กรองตามปี/สาขา เพิ่มนักศึกษา และ export CSV |
| 11 | ตรวจสอบการจบ | `/dashboard/graduation` | GPAX 3.15/ขั้นต่ำ 1.75, หน่วยกิต 112/130, กิจกรรม 60/80 | Status cards + progress bar | แสดงการตรวจเงื่อนไขรายคนและกิจกรรมแนะนำเพื่อเก็บชั่วโมงให้ครบ |
| 12 | สถิติสำเร็จการศึกษา | `/dashboard/graduation-stats` | ย้อนหลัง 2564-2568, ปี 2568 candidates 220, graduated 198, rate 90.0%, avg GPA 3.05, แยกสาขา/เกียรตินิยม | Trend + stacked bar + GPA distribution | ใช้วิเคราะห์ผลลัพธ์การเรียนและความเสี่ยงก่อนจบ |
| 13 | กิจกรรม/พฤติกรรมนักศึกษา | `/dashboard/student-life` | ชั่วโมงกิจกรรม 38/60, ยืมหนังสือ, คะแนนพฤติกรรม 92/100 | Gauge/line/table | แสดงมิติ student life ที่ไม่ใช่แค่เกรด เช่น กิจกรรม ห้องสมุด และพฤติกรรม |
| 14 | ภาพรวมบุคลากร | `/dashboard/hr` | บุคลากรคณะ 173, สายวิชาการ 104, สนับสนุน 69, ป.เอก 87, เกษียณใน 5 ปี 18 คน | Department bar + age/position chart | ใช้สนับสนุนการวางแผนอัตรากำลังและภาระนักศึกษาต่ออาจารย์ |
| 15 | ภาพรวมงานวิจัย | `/dashboard/research` | Publications 1,284, funding 28.3 ล้านบาท, patents 18, citations 8,945, h-index 42, active projects 101 | Publication trend + funding/source + department chart | แสดงผลงานวิจัยตามเวลา ภาควิชา แหล่งทุน สิทธิบัตร และ benchmark |
| 16 | การเงิน ค่าธรรมเนียม และงบประมาณ | `/dashboard/financial`, `/dashboard/tuition`, `/dashboard/budget` | ค่าเทอม 16,000-19,000/เทอม, ค้างชำระ 18,500, งบคณะปี 2567 รายรับ 155.6/รายจ่าย 140.5/คงเหลือ 15.1 ล้านบาท, พยากรณ์ 2569 รายรับ 172.5/รายจ่าย 156.0 | Tuition bar/pie + budget combo chart | แสดงการเงินรายบุคคลและภาพรวมงบคณะ พร้อม forecasting |
| 17 | ยุทธศาสตร์และ OKR | `/dashboard/strategic` | SG-1 ถึง SG-5, OKR ปีงบประมาณ 2567: O1 72%, O2 85%, O3 65%, O4 58%, radar 5 ด้าน | OKR cards + radar + efficiency trend | ใช้ติดตามว่าผลงานปัจจุบันห่างจากเป้าหมายเท่าไร |
| 18 | AI Chat และกราฟอัจฉริยะ | `/dashboard/ai-chat` | Gemini context จากทุก data module, ถามภาษาไทย, สร้าง `json_chart`, upload CSV/XLSX, forecast, scatter/dual-axis chart | ภาพแชท + กราฟตัวอย่าง | AI ช่วยถามตอบ สรุป insight สร้างกราฟ และแก้กรณีข้อมูลคนกับ GPA ให้ใช้ dual-axis หรือ scatter |
| 19 | Admin, Data Upload และความปลอดภัย | `/dashboard/admin` | อนุมัติผู้ใช้, เปลี่ยน role, upload CSV/TSV/XLSX, audit log, Firebase Auth | หน้า Admin Panel + Data Upload | ระบบควบคุมสิทธิ์และจัดการข้อมูล โดยไม่เปิดเผย API key ในสไลด์หรือ repo |
| 20 | การทดสอบ สรุป และพัฒนาต่อ | Build/Test + Demo | Build ผ่าน, ตรวจ secret ก่อน push, realtime student update, responsive UI | ภาพสรุป/roadmap | สรุปประโยชน์ ข้อจำกัด และพัฒนาต่อ เช่น backend กลาง, เชื่อมฐานจริงทุกหมวด, notification push |

## ตารางหน้าเว็บกับข้อมูลที่ใช้

| Route | ชื่อเมนู | แหล่งข้อมูลหลัก | ใช้เล่าในสไลด์ |
|---|---|---|---|
| `/dashboard` | ภาพรวม (Overview) | `dashboardSummary`, `getDashboardInsights`, card หมวด HR/Student/Research/Finance/OKR | สไลด์ 7 |
| `/dashboard/alerts` | ศูนย์แจ้งเตือน | `getAllAlerts`, `getAlertSummary`, `onStudentDataChange`, `graduationData`, `researchData`, `strategicData`, `scienceFacultyBudgetData` | สไลด์ 8 |
| `/dashboard/ai-chat` | แชทกับ AI | `geminiService`, `getStudentListSync`, dashboard data ทุกหมวด, uploaded file parser, Chart.js renderer | สไลด์ 18 |
| `/dashboard/hr` | ภาพรวมบุคลากร | `hrData.scienceFaculty`, `hrData.university` | สไลด์ 14 |
| `/dashboard/student-stats` | สถิตินิสิตปัจจุบัน | `studentStatsData`, `getStudentListSync`, `onStudentDataChange` | สไลด์ 9 |
| `/dashboard/students` | รายชื่อนักศึกษา | `scienceStudentList`, `studentListSummary`, `studentDataService`, manual add/localStorage | สไลด์ 10 |
| `/dashboard/graduation` | ตรวจสอบการจบ | inline graduation requirement data: GPAX, credits, activities, recommended activities | สไลด์ 11 |
| `/dashboard/graduation-stats` | สถิติสำเร็จการศึกษา | `graduationHistory`, `currentGraduationStats`, `graduationByMajor`, `gpaDistribution`, `honorsData`, `graduationCandidateList` | สไลด์ 12 |
| `/dashboard/student-life` | กิจกรรม/พฤติกรรม | `studentLifeData.activityHours`, `studentLifeData.library`, `studentLifeData.behaviorScore` | สไลด์ 13 |
| `/dashboard/research` | ภาพรวมงานวิจัย | `researchData.overview`, `publicationTrend`, `byDepartment`, `fundingTrend`, `fundingSources`, `patents`, `benchmark` | สไลด์ 15 |
| `/dashboard/financial` | รายรับ-รายจ่าย | `financialData.tuitionStatus`, `paymentHistory`, `scholarship`, `requests`, `facultyBudget` | สไลด์ 16 |
| `/dashboard/tuition` | ค่าธรรมเนียมการศึกษา | `tuitionData.flatRate`, `entryFee`, `totalCost`, `byFaculty`, `breakdown`, `semesterHistory` | สไลด์ 16 |
| `/dashboard/budget` | พยากรณ์งบประมาณ | `scienceFacultyBudgetData.yearly`, `scienceFacultyBudgetData.summary` | สไลด์ 16 |
| `/dashboard/strategic` | เป้าหมายยุทธศาสตร์ | `strategicData.strategicGoals`, `okr`, `performanceRadar`, `efficiencyTrend` | สไลด์ 17 |
| `/dashboard/admin` | จัดการผู้ใช้/สิทธิ์ | Firestore `users`, `AdminDataUpload`, `AdminAuditLog`, `accessControl` | สไลด์ 4 และ 19 |

## เวอร์ชันย่อถ้าต้องทำ 14 สไลด์ตามตัวอย่าง

| สไลด์ย่อ | รวมสไลด์จากชุดเต็ม | วิธีรวม |
|---:|---|---|
| 1 | 1 | ปก |
| 2 | 2-3 | ที่มา ปัญหา และวัตถุประสงค์ |
| 3 | 4-6 | ขอบเขต ผู้ใช้ สถาปัตยกรรม และข้อมูล |
| 4 | 7 | หน้าภาพรวม |
| 5 | 8 | Alert Center |
| 6 | 9-10 | สถิตินิสิตและรายชื่อนักศึกษา |
| 7 | 11-12 | ตรวจจบและสถิติสำเร็จการศึกษา |
| 8 | 13 | กิจกรรม/พฤติกรรม |
| 9 | 14 | HR |
| 10 | 15 | Research |
| 11 | 16 | Finance/Tuition/Budget |
| 12 | 17 | Strategic/OKR |
| 13 | 18-19 | AI Chat + Admin/Security |
| 14 | 20 | ทดสอบ สรุป และพัฒนาต่อ |

## ลำดับเดโมที่ควรถ่ายภาพหรือเปิดโชว์

1. เปิด `/dashboard` เพื่อให้เห็น KPI รวมและเมนูหมวดระบบ
2. เข้า `/dashboard/alerts` ให้เห็นการรวม alert จากหลาย domain และจำนวน student dataset 1,451
3. เข้า `/dashboard/students` ค้นหา/กรองรายชื่อ แล้วชี้ว่า data service รองรับ realtime + manual add
4. เข้า `/dashboard/student-stats` ให้เห็นกราฟนิสิตคณะวิทย์ตามปีเข้า เพศ ระดับ และ ratio
5. เข้า `/dashboard/ai-chat` ถามตัวอย่าง เช่น "เปรียบเทียบจำนวนนักศึกษากับ GPA แยกสาขา" แล้วโชว์กราฟ dual-axis/scatter
6. เข้า `/dashboard/research` และ `/dashboard/budget` เพื่อโชว์กราฟเชิงบริหารที่ใช้พยากรณ์/แนวโน้ม
7. เข้า `/dashboard/admin` เพื่อปิดท้ายเรื่องสิทธิ์ผู้ใช้และการนำเข้าข้อมูล

## หมายเหตุก่อนทำสไลด์จริง

- ใช้ตัวเลขนักศึกษาคณะวิทยาศาสตร์เป็น 1,451 คนทุกสไลด์
- ถ้าจะถ่ายภาพจากหน้าเว็บ ให้ตรวจข้อความย่อยในหน้า Overview อีกครั้ง เพราะบาง label ใน card อาจเป็น placeholder เก่าจากช่วง prototype
- ไม่ใส่ API key หรือค่า `.env` ลงในสไลด์ ตัวอย่าง architecture ให้เขียนเป็น "Gemini API" และ "Firebase" พอ
- สำหรับกราฟที่เปรียบเทียบคนกับ GPA ให้ใช้ dual-axis หรือ scatter เท่านั้น เพราะหน่วยไม่เท่ากัน
