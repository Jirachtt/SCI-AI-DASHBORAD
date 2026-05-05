import fs from 'node:fs';
import path from 'node:path';
import { dashboardSummary, studentStatsData } from '../src/data/mockData.js';
import { hrData } from '../src/data/hrData.js';
import { researchData } from '../src/data/researchData.js';
import { strategicData } from '../src/data/strategicData.js';

const TEMPLATE_DIR = path.resolve('template_cyber_ai_thesis_unpacked');
const SLIDES_DIR = path.join(TEMPLATE_DIR, 'ppt', 'slides');
const GUIDE_PATH = path.resolve('Science_AI_Dashboard_Canva_Template_หมายเหตุ.md');

const sci = dashboardSummary.faculties.find(f => f.name === 'คณะวิทยาศาสตร์');
const stats = {
  totalStudents: dashboardSummary.totalStudents.toLocaleString('th-TH'),
  scienceStudents: studentStatsData.scienceFaculty.total.toLocaleString('th-TH'),
  gpa: sci?.avgGPA ?? 3.18,
  graduation: sci?.graduationRate ?? 91.2,
  personnel: hrData.scienceFaculty.total.toLocaleString('th-TH'),
  publications: researchData.overview.totalPublications.toLocaleString('th-TH'),
  funding: researchData.overview.totalFunding,
  projects: researchData.overview.activeProjects,
  okrAvg: Math.round(strategicData.okr.objectives.reduce((sum, item) => sum + item.progress, 0) / strategicData.okr.objectives.length),
};

function esc(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const R = {
  1: [
    'Maejo University',
    'Science AI',
    'Science AI Dashboard',
    'Final Project Presentation',
  ],
  2: [
    '01 ปัญหาและความสำคัญ',
    'ข้อมูลคณะอยู่หลายระบบ ทำให้สรุปภาพรวมช้า',
    '02 วัตถุประสงค์',
    'Dashboard + AI Chatbot + Data Visualization + RBAC',
    '03 วิธีพัฒนา',
    'React, Firebase, Gemini API, Chart.js',
    '04 ผลลัพธ์',
    'ระบบต้นแบบ 15+ หน้าจอ พร้อมกราฟและ AI',
    'Agenda',
    'Presentation Flow',
    'Canva-ready Deck',
  ],
  3: [
    'Problem',
    'ข้อมูลกระจัดกระจาย วิเคราะห์ช้า และต้องทำกราฟด้วยมือ',
    'Solution',
    'รวมข้อมูลสำคัญไว้ใน Dashboard เดียว พร้อม AI ช่วยถามตอบ',
    'Outcome',
    'ช่วยผู้บริหารดู insight และตัดสินใจเชิงนโยบายได้เร็วขึ้น',
    'Project Overview',
  ],
  4: [
    'Background',
    'คณะวิทยาศาสตร์มีข้อมูลนักศึกษา บุคลากร งานวิจัย การเงิน และ OKR จำนวนมาก',
    'จึงพัฒนา Dashboard อัจฉริยะเพื่อรวบรวม วิเคราะห์ และแสดงผลข้อมูลในรูปแบบที่เข้าใจง่าย',
    '1',
  ],
  5: [
    'Science AI Dashboard',
    'ระบบ Dashboard อัจฉริยะสำหรับคณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้ โดยใช้เทคโนโลยี AI',
    'นำเสนอโดย นายจิรัชฌา  รหัส 65041...',
  ],
  6: [
    'Objectives',
    'พัฒนา Web Application สำหรับข้อมูล 6 หมวดหลัก',
    'เพิ่ม AI Chatbot สำหรับถามตอบ สร้างกราฟ และพยากรณ์แนวโน้ม',
  ],
  7: [
    'Project Scope',
    '6 Data Domains',
    'HR, Student, Research, Finance, OKR และ AI Chatbot',
    '',
    'Role-Based Access',
    'Dean, Chair, Staff, Student เห็นข้อมูลตามสิทธิ์',
    '',
    'Responsive Web App',
    'รองรับ Desktop, Tablet และ Mobile',
    '',
  ],
  8: [
    'System Idea',
    'รวมข้อมูลหลายด้านเป็นศูนย์กลางเดียว',
    'แล้วใช้ AI เปลี่ยนคำถามเป็นคำตอบและกราฟ',
    '2',
  ],
  9: [
    'Core Modules',
    'HR',
    'Student',
    'Research',
    'Finance',
    'บุคลากรทั้งหมด',
    `${stats.personnel} คน`,
    'นักศึกษาคณะวิทย์',
    `${stats.scienceStudents} คน`,
    'ผลงานวิจัยสะสม',
    `${stats.publications} เรื่อง`,
    'งบและค่าเทอม',
    'พยากรณ์แนวโน้ม',
  ],
  10: [
    'AI + Dashboard Experience',
    'ผู้ใช้ถามภาษาไทย เช่น “พยากรณ์งบประมาณปีหน้า” หรือ “ทำกราฟจำนวนนักศึกษาแยกตามคณะ” แล้วระบบตอบพร้อมกราฟ',
  ],
  11: [
    'Development Flow',
    'Requirement',
    'เก็บความต้องการจากปัญหาข้อมูลหลายแหล่ง',
    '',
    'Design',
    'ออกแบบ SPA, Dashboard layout และสิทธิ์ผู้ใช้',
    '',
    'Implement',
    'React + Firebase + Gemini + Chart.js',
    '',
    'Test',
    'ทดสอบ login, role, chart, AI และ responsive',
  ],
  12: [
    'User Roles',
    'Dean',
    'เข้าถึงทุกหมวดและ Admin Panel',
    'Chair',
    'ดูรายงานเชิงหลักสูตรและข้อมูลบริหาร',
    'Staff',
    'ดูข้อมูลปฏิบัติการและรายงาน',
    'Student',
    'ดูข้อมูลทั่วไป กิจกรรม ค่าเทอม และตรวจจบ',
  ],
  13: [
    'Single Page Application + AI Service + Data Visualization',
  ],
  14: [
    'Key Features',
    'Dashboard, AI Chatbot, RBAC, Data Upload, Forecasting',
    '3',
  ],
  15: [
    'Feature Breakdown',
    'Dashboard Home',
    'KPI Cards, Daily Insights และเมนูข้อมูลหลัก',
    'Student Data',
    'ค้นหา กรอง Export และตรวจสอบการจบ',
    'AI Chatbot',
    'ถามตอบภาษาไทยและสร้าง json_chart',
    'Finance Forecast',
    'พยากรณ์งบประมาณด้วย Linear Regression',
    'OKR Monitor',
    'ติดตาม KPI ผ่าน Radar และ Progress',
    'Admin Upload',
    'อัปโหลด CSV / XLSX เข้า Firestore',
    'What Was Built',
  ],
  16: [
    'ข้อมูลนักศึกษาทั้งหมด',
    `${stats.totalStudents}`,
    'Science Students',
    `${stats.scienceStudents} คน`,
    'GPA คณะวิทยาศาสตร์',
    `${stats.gpa}`,
    'อัตราสำเร็จ',
    `${stats.graduation}%`,
  ],
  17: [
    `${stats.publications}`,
    `ผลงานวิจัยสะสม | ทุนวิจัยปี 2568 ${stats.funding} ล้านบาท | โครงการ active ${stats.projects} โครงการ`,
  ],
  18: [
    '“เปลี่ยนข้อมูลดิบให้เป็น insight ที่ผู้บริหารใช้ตัดสินใจได้เร็วขึ้น”',
    'Science AI Dashboard | Faculty of Science, Maejo University',
  ],
  19: [
    'Technology Stack',
    'React 19 + Vite 7',
    'Firebase Authentication',
    'Google Gemini API',
    'Chart.js / Recharts',
    'CSV & XLSX Import',
    'Role-Based Access Control',
  ],
  20: [
    'Thank you!',
    'Q & A | Science AI Dashboard',
  ],
  21: [
    'Credits',
    'Template source',
    'SlidesCarnival: Cyber-Futuristic AI Technology Thesis Defense',
    'Use in Canva',
    'Upload this PPTX to Canva and edit text, fonts, colors, and screenshots',
    'Recommended fonts',
    'Prompt / Noto Sans Thai / Sarabun',
    '',
    '',
  ],
  22: [
    'This Canva-ready presentation uses a free SlidesCarnival template and customized Science AI Dashboard content.',
    'SlidesCarnival for the presentation template',
    'Project content from Science AI Dashboard repository',
    'Ready for final project presentation',
  ],
};

function replaceTextNodes(xml, replacements) {
  let i = 0;
  return xml.replace(/<a:t>([\s\S]*?)<\/a:t>/g, () => {
    const text = i < replacements.length ? replacements[i] : '';
    i += 1;
    return `<a:t>${esc(text)}</a:t>`;
  });
}

function patchFonts(xml) {
  return xml
    .replace(/typeface="Archivo Black"/g, 'typeface="Prompt"')
    .replace(/typeface="Open Sauce"/g, 'typeface="Noto Sans Thai"')
    .replace(/typeface="Aptos[^"]*"/g, 'typeface="Noto Sans Thai"')
    .replace(/lang="en-US"/g, 'lang="th-TH"');
}

for (const [slideNo, replacements] of Object.entries(R)) {
  const file = path.join(SLIDES_DIR, `slide${slideNo}.xml`);
  if (!fs.existsSync(file)) continue;
  const xml = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, patchFonts(replaceTextNodes(xml, replacements)), 'utf8');
}

const guide = `# Canva Template Deck

ไฟล์นี้ใช้ template จริงจาก SlidesCarnival:

Cyber-Futuristic AI Technology Thesis Defense Slides
https://www.slidescarnival.com/template/tech-thesis-defense/43791

วิธีใช้ใน Canva:

1. เปิด Canva
2. ไปที่ Upload / อัปโหลด
3. เลือกไฟล์ Science_AI_Dashboard_Canva_Template_จากเทมเพลตจริง.pptx
4. Canva จะ import เป็น presentation ให้แก้ต่อได้
5. ถ้าฟอนต์ไทยเพี้ยน ให้เลือกข้อความทั้งหมดแล้วเปลี่ยนเป็น Prompt, Noto Sans Thai หรือ Sarabun

คำแนะนำ:

- เพิ่ม screenshot จริงของระบบลงในสไลด์ 10 หรือ 13 จะทำให้งานดูเป็นโปรเจคจริงมากขึ้น
- ลบหน้า Credits ได้หลังจากตรวจ license แล้ว หากอาจารย์ไม่ต้องการหน้าอ้างอิง template
`;

fs.writeFileSync(GUIDE_PATH, guide, 'utf8');
console.log('Patched template slides.');
console.log(`Created ${GUIDE_PATH}`);
