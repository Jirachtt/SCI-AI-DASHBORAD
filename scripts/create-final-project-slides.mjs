import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { dashboardSummary, studentStatsData } from '../src/data/mockData.js';
import { hrData } from '../src/data/hrData.js';
import { researchData } from '../src/data/researchData.js';
import { strategicData } from '../src/data/strategicData.js';

const OUT_PPTX = path.resolve('Science_AI_Dashboard_สไลด์พรีเซนโปรเจคจบ.pptx');
const OUT_CANVA_PPTX = path.resolve('Science_AI_Dashboard_Canva_สวยพร้อมอัปโหลด.pptx');
const OUT_SCRIPT = path.resolve('Science_AI_Dashboard_สคริปต์พรีเซน.md');
const OUT_CANVA_GUIDE = path.resolve('Science_AI_Dashboard_Canva_วิธีอัปโหลด.md');

const EMU = 914400;
const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const FONT = 'Tahoma';

const C = {
  bg: 'F7F9F6',
  bg2: 'EEF6EF',
  white: 'FFFFFF',
  ink: '14231B',
  muted: '5D6B61',
  green: '006838',
  lime: '00A651',
  gold: 'C5A028',
  blue: '2E86AB',
  magenta: 'A23B72',
  violet: '7B68EE',
  orange: 'F18F01',
  red: 'D64545',
  line: 'D7E2DA',
  dark: '0B1F17',
  softGreen: 'E7F4EA',
  softGold: 'FFF5D6',
  softBlue: 'E8F4FA',
  softMagenta: 'F7E7F0',
  softViolet: 'F0EEFF',
  softOrange: 'FFF0DA',
};

const stats = {
  universityStudents: dashboardSummary.totalStudents.toLocaleString('th-TH'),
  scienceStudents: studentStatsData.scienceFaculty.total.toLocaleString('th-TH'),
  avgGpa: dashboardSummary.faculties.find(f => f.name === 'คณะวิทยาศาสตร์')?.avgGPA ?? 3.18,
  graduationRate: dashboardSummary.faculties.find(f => f.name === 'คณะวิทยาศาสตร์')?.graduationRate ?? 91.2,
  personnel: hrData.scienceFaculty.total.toLocaleString('th-TH'),
  publications: researchData.overview.totalPublications.toLocaleString('th-TH'),
  researchFunding: researchData.overview.totalFunding,
  activeProjects: researchData.overview.activeProjects,
  okrAvg: Math.round(
    strategicData.okr.objectives.reduce((sum, o) => sum + o.progress, 0) /
    strategicData.okr.objectives.length
  ),
};

function esc(v) {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function emu(n) {
  return Math.round(n * EMU);
}

function crc32(buf) {
  const table = crc32.table || (crc32.table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    return c >>> 0;
  }));
  let c = 0xFFFFFFFF;
  for (const b of buf) c = table[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function u16(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
}

function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

class ZipFile {
  constructor() {
    this.files = [];
  }
  add(name, content) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    this.files.push({ name: name.replace(/\\/g, '/'), data });
  }
  toBuffer() {
    const locals = [];
    const centrals = [];
    let offset = 0;
    const dt = dosDateTime();
    for (const file of this.files) {
      const name = Buffer.from(file.name, 'utf8');
      const compressed = zlib.deflateRawSync(file.data);
      const crc = crc32(file.data);
      const local = Buffer.concat([
        u32(0x04034b50), u16(20), u16(0x0800), u16(8), u16(dt.time), u16(dt.day),
        u32(crc), u32(compressed.length), u32(file.data.length), u16(name.length), u16(0),
        name,
      ]);
      locals.push(local, compressed);
      centrals.push(Buffer.concat([
        u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(8), u16(dt.time), u16(dt.day),
        u32(crc), u32(compressed.length), u32(file.data.length), u16(name.length), u16(0), u16(0),
        u16(0), u16(0), u32(0), u32(offset), name,
      ]));
      offset += local.length + compressed.length;
    }
    const centralSize = centrals.reduce((sum, b) => sum + b.length, 0);
    const end = Buffer.concat([
      u32(0x06054b50), u16(0), u16(0), u16(this.files.length), u16(this.files.length),
      u32(centralSize), u32(offset), u16(0),
    ]);
    return Buffer.concat([...locals, ...centrals, end]);
  }
}

class Slide {
  constructor(index, bg = C.bg) {
    this.index = index;
    this.bg = bg;
    this.id = 2;
    this.parts = [];
  }
  nextId() {
    return this.id++;
  }
}

function solidFill(color) {
  return color ? `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill>` : '<a:noFill/>';
}

function lineXml(color = C.line, width = 1) {
  return color ? `<a:ln w="${Math.round(width * 12700)}">${solidFill(color)}</a:ln>` : '<a:ln><a:noFill/></a:ln>';
}

function shape(slide, prst, x, y, w, h, opts = {}) {
  const id = slide.nextId();
  const rot = opts.rot ? ` rot="${Math.round(opts.rot * 60000)}"` : '';
  const fillColor = opts.fill === undefined ? C.white : opts.fill;
  const lineColor = opts.line === undefined ? C.line : opts.line;
  const xml = `
    <p:sp>
      <p:nvSpPr>
        <p:cNvPr id="${id}" name="${esc(opts.name || prst + id)}"/>
        <p:cNvSpPr/>
        <p:nvPr/>
      </p:nvSpPr>
      <p:spPr>
        <a:xfrm${rot}><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>
        <a:prstGeom prst="${prst}"><a:avLst/></a:prstGeom>
        ${solidFill(fillColor)}
        ${lineXml(lineColor, opts.lineWidth ?? 1)}
      </p:spPr>
    </p:sp>`;
  slide.parts.push(xml);
  return id;
}

function textRun(text, opts = {}) {
  const size = Math.round((opts.size ?? 22) * 100);
  const bold = opts.bold ? ' b="1"' : '';
  const italic = opts.italic ? ' i="1"' : '';
  const color = opts.color ?? C.ink;
  return `<a:r>
    <a:rPr lang="th-TH" sz="${size}"${bold}${italic} dirty="0">
      ${solidFill(color)}
      <a:latin typeface="${FONT}"/><a:ea typeface="${FONT}"/><a:cs typeface="${FONT}"/>
    </a:rPr>
    <a:t>${esc(text)}</a:t>
  </a:r>`;
}

function paragraph(text, opts = {}) {
  const align = opts.align ? ` algn="${opts.align}"` : '';
  const bullet = opts.bullet
    ? `<a:pPr${align} marL="${emu(0.24)}" indent="-${emu(0.14)}"><a:buFont typeface="${FONT}"/><a:buChar char="•"/></a:pPr>`
    : `<a:pPr${align}/>`;
  return `<a:p>${bullet}${textRun(text, opts)}<a:endParaRPr lang="th-TH" sz="${Math.round((opts.size ?? 22) * 100)}"/></a:p>`;
}

function textbox(slide, text, x, y, w, h, opts = {}) {
  const id = slide.nextId();
  const lines = Array.isArray(text) ? text : String(text).split('\n');
  const bodyAnchor = opts.valign ? ` anchor="${opts.valign}"` : '';
  const fill = opts.fill !== undefined ? solidFill(opts.fill) : '<a:noFill/>';
  const line = opts.line !== undefined ? lineXml(opts.line, opts.lineWidth ?? 1) : '<a:ln><a:noFill/></a:ln>';
  const paras = lines.map((lineText) => paragraph(lineText, opts)).join('');
  slide.parts.push(`
    <p:sp>
      <p:nvSpPr>
        <p:cNvPr id="${id}" name="${esc(opts.name || 'TextBox ' + id)}"/>
        <p:cNvSpPr txBox="1"/>
        <p:nvPr/>
      </p:nvSpPr>
      <p:spPr>
        <a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>
        <a:prstGeom prst="${opts.prst || 'rect'}"><a:avLst/></a:prstGeom>
        ${fill}
        ${line}
      </p:spPr>
      <p:txBody>
        <a:bodyPr wrap="square"${bodyAnchor}><a:spAutoFit/></a:bodyPr>
        <a:lstStyle/>
        ${paras}
      </p:txBody>
    </p:sp>`);
  return id;
}

function bullets(slide, items, x, y, w, h, opts = {}) {
  const id = slide.nextId();
  const paras = items.map((item) => paragraph(item, { ...opts, bullet: true })).join('');
  slide.parts.push(`
    <p:sp>
      <p:nvSpPr><p:cNvPr id="${id}" name="Bullet List ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
      <p:spPr>
        <a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>
        <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        <a:noFill/><a:ln><a:noFill/></a:ln>
      </p:spPr>
      <p:txBody>
        <a:bodyPr wrap="square"><a:spAutoFit/></a:bodyPr>
        <a:lstStyle/>
        ${paras}
      </p:txBody>
    </p:sp>`);
}

function addFooter(slide) {
  shape(slide, 'rect', 0.55, 7.07, 12.2, 0.02, { fill: C.line, line: null });
  textbox(slide, 'Science AI Dashboard | Final Project Presentation', 0.55, 7.13, 6.7, 0.22, {
    size: 8.8, color: C.muted, valign: 'mid',
  });
  textbox(slide, String(slide.index).padStart(2, '0'), 12.0, 7.1, 0.72, 0.26, {
    size: 9.5, color: C.muted, bold: true, align: 'r', valign: 'mid',
  });
}

function addSoftPattern(slide) {
  shape(slide, 'ellipse', 10.55, -0.85, 3.25, 2.05, { fill: 'E4F3E8', line: null });
  shape(slide, 'ellipse', 11.48, 5.78, 2.58, 2.05, { fill: 'FFF1C8', line: null });
  shape(slide, 'rect', -0.75, 6.55, 3.95, 0.12, { fill: C.gold, line: null, rot: -9 });
  shape(slide, 'rect', 11.7, 0.95, 1.55, 0.09, { fill: C.lime, line: null, rot: -18 });
  textbox(slide, 'SCI', 11.04, 0.15, 1.34, 0.42, {
    size: 16,
    color: 'B8D7C0',
    bold: true,
    align: 'ctr',
  });
}

function addTitle(slide, title, kicker = '') {
  addSoftPattern(slide);
  shape(slide, 'rect', 0, 0, SLIDE_W, 0.18, { fill: C.green, line: null });
  shape(slide, 'rect', 0, 0.18, 2.15, 0.055, { fill: C.gold, line: null });
  textbox(slide, kicker || 'Science AI Dashboard', 0.58, 0.38, 3.4, 0.28, {
    size: 11, color: C.green, bold: true, valign: 'mid',
  });
  textbox(slide, title, 0.58, 0.72, 10.9, 0.55, {
    size: 27, color: C.ink, bold: true,
  });
}

function card(slide, x, y, w, h, title, value, opts = {}) {
  shape(slide, 'roundRect', x, y, w, h, { fill: opts.fill ?? C.white, line: opts.line ?? C.line });
  if (opts.accent) shape(slide, 'rect', x, y, 0.08, h, { fill: opts.accent, line: null });
  textbox(slide, title, x + 0.25, y + 0.2, w - 0.45, 0.32, {
    size: opts.titleSize ?? 12, color: opts.titleColor ?? C.muted, bold: true,
  });
  textbox(slide, value, x + 0.25, y + 0.58, w - 0.45, h - 0.7, {
    size: opts.valueSize ?? 27, color: opts.valueColor ?? C.ink, bold: true,
  });
}

function pill(slide, label, x, y, w, color) {
  shape(slide, 'roundRect', x, y, w, 0.38, { fill: color, line: null });
  textbox(slide, label, x + 0.08, y + 0.075, w - 0.16, 0.22, {
    size: 10.2, color: C.white, bold: true, align: 'ctr', valign: 'mid',
  });
}

function sectionChip(slide, label, x, y, w, color, softColor) {
  shape(slide, 'roundRect', x, y, w, 0.68, { fill: softColor, line: color });
  shape(slide, 'ellipse', x + 0.17, y + 0.18, 0.32, 0.32, { fill: color, line: null });
  textbox(slide, label, x + 0.62, y + 0.19, w - 0.74, 0.28, {
    size: 12, color: C.ink, bold: true, valign: 'mid',
  });
}

function barChart(slide, x, y, w, h, values, labels, colors) {
  const max = Math.max(...values);
  shape(slide, 'rect', x, y + h, w, 0.018, { fill: C.line, line: null });
  const gap = 0.22;
  const bw = (w - gap * (values.length - 1)) / values.length;
  values.forEach((value, i) => {
    const bh = (value / max) * (h - 0.42);
    const bx = x + i * (bw + gap);
    shape(slide, 'roundRect', bx, y + h - bh, bw, bh, { fill: colors[i], line: null });
    textbox(slide, String(value), bx - 0.05, y + h - bh - 0.28, bw + 0.1, 0.2, {
      size: 9.5, color: C.ink, bold: true, align: 'ctr',
    });
    textbox(slide, labels[i], bx - 0.12, y + h + 0.07, bw + 0.24, 0.38, {
      size: 8.4, color: C.muted, align: 'ctr',
    });
  });
}

function table(slide, x, y, cols, rows, opts = {}) {
  const rowH = opts.rowH ?? 0.48;
  const headerH = opts.headerH ?? 0.48;
  const totalW = cols.reduce((sum, c) => sum + c.w, 0);
  shape(slide, 'roundRect', x, y, totalW, headerH + rows.length * rowH, { fill: C.white, line: C.line });
  shape(slide, 'rect', x, y, totalW, headerH, { fill: opts.headerFill ?? C.green, line: null });
  let cx = x;
  cols.forEach((col) => {
    textbox(slide, col.label, cx + 0.08, y + 0.11, col.w - 0.16, 0.22, {
      size: 9.5, color: C.white, bold: true, align: col.align || 'l',
    });
    cx += col.w;
  });
  rows.forEach((row, r) => {
    const ry = y + headerH + r * rowH;
    if (r % 2 === 1) shape(slide, 'rect', x, ry, totalW, rowH, { fill: C.bg2, line: null });
    shape(slide, 'rect', x, ry, totalW, 0.01, { fill: C.line, line: null });
    let px = x;
    cols.forEach((col, c) => {
      textbox(slide, row[c], px + 0.08, ry + 0.12, col.w - 0.16, 0.2, {
        size: opts.size ?? 9.5,
        color: c === row.length - 1 && row[c] === 'ผ่าน' ? C.green : C.ink,
        bold: c === 0 || row[c] === 'ผ่าน',
        align: col.align || 'l',
      });
      px += col.w;
    });
  });
}

function slideXml(slide) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg><p:bgPr>${solidFill(slide.bg)}<a:effectLst/></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm>
      </p:grpSpPr>
      ${slide.parts.join('\n')}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

function buildSlides() {
  const slides = [];
  const make = (bg = C.bg) => {
    const s = new Slide(slides.length + 1, bg);
    slides.push(s);
    return s;
  };

  let s = make(C.dark);
  shape(s, 'rect', 0, 0, SLIDE_W, SLIDE_H, { fill: C.dark, line: null });
  shape(s, 'rect', 0, 0, 0.34, SLIDE_H, { fill: C.green, line: null });
  shape(s, 'rect', 0.34, 0, 0.09, SLIDE_H, { fill: C.gold, line: null });
  textbox(s, 'FINAL PROJECT PRESENTATION', 0.72, 0.68, 4.4, 0.32, { size: 12, color: C.gold, bold: true });
  textbox(s, 'Science AI\nDashboard', 0.72, 1.18, 6.6, 1.62, { size: 41, color: C.white, bold: true });
  textbox(s, 'ระบบ Dashboard อัจฉริยะสำหรับคณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้\nโดยใช้เทคโนโลยี AI', 0.76, 3.02, 8.6, 0.82, { size: 20, color: 'DDECE0' });
  pill(s, 'React 19', 0.78, 4.28, 1.45, C.blue);
  pill(s, 'Firebase Auth', 2.42, 4.28, 1.72, C.green);
  pill(s, 'Gemini AI', 4.35, 4.28, 1.55, C.magenta);
  pill(s, 'Chart.js', 6.1, 4.28, 1.35, C.gold);
  shape(s, 'roundRect', 8.62, 1.0, 3.86, 4.75, { fill: '102C20', line: '285A42' });
  card(s, 9.02, 1.38, 3.06, 0.9, 'นักศึกษาทั้งมหาวิทยาลัย', stats.universityStudents, { fill: '173A2B', line: '285A42', titleColor: 'BBD7C2', valueColor: C.white, accent: C.lime, valueSize: 25 });
  card(s, 9.02, 2.52, 3.06, 0.9, 'นักศึกษาคณะวิทยาศาสตร์', stats.scienceStudents, { fill: '173A2B', line: '285A42', titleColor: 'BBD7C2', valueColor: C.white, accent: C.gold, valueSize: 25 });
  card(s, 9.02, 3.66, 3.06, 0.9, 'AI + Data Visualization', '15 หน้าจอ', { fill: '173A2B', line: '285A42', titleColor: 'BBD7C2', valueColor: C.white, accent: C.blue, valueSize: 23 });
  textbox(s, 'คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้', 0.78, 6.68, 5.2, 0.3, { size: 12.5, color: 'DDECE0' });

  s = make();
  addTitle(s, 'ปัญหาที่พบและเหตุผลที่พัฒนา');
  card(s, 0.78, 1.72, 3.65, 3.9, '01 ข้อมูลกระจัดกระจาย', 'ข้อมูลนักศึกษา บุคลากร งบประมาณ งานวิจัย และยุทธศาสตร์อยู่คนละระบบ ทำให้มองภาพรวมยาก', { fill: C.softGreen, accent: C.green, valueSize: 18 });
  card(s, 4.84, 1.72, 3.65, 3.9, '02 วิเคราะห์ช้า', 'ผู้บริหารต้องใช้เวลารวบรวม สรุป และแปลงข้อมูลเป็นกราฟก่อนตัดสินใจ', { fill: C.softGold, accent: C.gold, valueSize: 18 });
  card(s, 8.9, 1.72, 3.65, 3.9, '03 ต้องการ AI ช่วยถามตอบ', 'การค้นข้อมูลด้วยภาษาธรรมชาติและการสร้างกราฟอัตโนมัติช่วยลดขั้นตอนการใช้งาน', { fill: C.softBlue, accent: C.blue, valueSize: 18 });
  textbox(s, 'แนวคิดหลัก: รวมข้อมูลสำคัญไว้ใน Dashboard เดียว แล้วให้ AI ช่วยแปลคำถามเป็น insight และกราฟ', 1.0, 6.18, 11.3, 0.44, { size: 16, color: C.green, bold: true, align: 'ctr', fill: C.white, line: C.line, prst: 'roundRect' });
  addFooter(s);

  s = make();
  addTitle(s, 'วัตถุประสงค์ของโครงงาน');
  bullets(s, [
    'พัฒนา Web Application สำหรับรวบรวมและแสดงข้อมูลสำคัญของคณะวิทยาศาสตร์',
    'สร้าง AI Chatbot ที่ถามตอบ สร้างกราฟ และพยากรณ์แนวโน้มจากข้อมูลในระบบได้',
    'ออกแบบ Interactive Data Visualization ที่ค้นหา กรอง และส่งออกข้อมูลได้',
    'พัฒนาระบบสิทธิ์ผู้ใช้แบบ Role-Based Access Control',
    'รองรับการใช้งานบน Desktop, Tablet และ Mobile',
  ], 0.95, 1.72, 6.8, 3.2, { size: 17, color: C.ink });
  shape(s, 'roundRect', 8.25, 1.58, 3.95, 3.46, { fill: C.dark, line: null });
  textbox(s, 'เกณฑ์สำเร็จ', 8.62, 1.9, 2.5, 0.35, { size: 18, color: C.gold, bold: true });
  textbox(s, 'ระบบต้องใช้งานจริงในรูปแบบต้นแบบได้\nแสดงข้อมูล 6 หมวดหลักได้ครบ\nAI ต้องตอบเป็นภาษาไทยและสร้างกราฟได้\nผู้ใช้แต่ละบทบาทเห็นข้อมูลตามสิทธิ์', 8.62, 2.46, 3.18, 1.85, { size: 15, color: C.white });
  textbox(s, 'ผลลัพธ์ที่ต้องการคือเครื่องมือช่วยตัดสินใจ ไม่ใช่เพียงหน้าแสดงตัวเลข', 0.95, 5.62, 11.2, 0.54, { size: 17, color: C.white, bold: true, align: 'ctr', fill: C.green, line: null, prst: 'roundRect' });
  addFooter(s);

  s = make();
  addTitle(s, 'ขอบเขตระบบและกลุ่มผู้ใช้');
  textbox(s, 'ขอบเขตข้อมูล 6 หมวดหลัก', 0.8, 1.52, 4.3, 0.36, { size: 17, color: C.green, bold: true });
  sectionChip(s, 'บุคลากร (HR)', 0.88, 2.05, 3.35, C.green, C.softGreen);
  sectionChip(s, 'นักศึกษา (Student)', 0.88, 2.9, 3.35, C.violet, C.softViolet);
  sectionChip(s, 'งานวิจัย (Research)', 0.88, 3.75, 3.35, C.blue, C.softBlue);
  sectionChip(s, 'การเงิน (Finance)', 0.88, 4.6, 3.35, C.gold, C.softGold);
  sectionChip(s, 'ยุทธศาสตร์ (OKR)', 0.88, 5.45, 3.35, C.magenta, C.softMagenta);
  sectionChip(s, 'AI Chatbot', 0.88, 6.3, 3.35, C.orange, C.softOrange);
  textbox(s, 'กลุ่มผู้ใช้', 5.18, 1.52, 3.0, 0.36, { size: 17, color: C.green, bold: true });
  table(s, 5.16, 2.04, [
    { label: 'Role', w: 1.35 },
    { label: 'การใช้งานหลัก', w: 3.6 },
  ], [
    ['Dean', 'ดูภาพรวมทุกหมวด / ยุทธศาสตร์ / Admin'],
    ['Chair', 'ดูข้อมูลหลักสูตร รายงาน และ AI'],
    ['Staff', 'ดูข้อมูลปฏิบัติการและรายงาน'],
    ['Student', 'ดูข้อมูลส่วนตัว/ทั่วไปตามสิทธิ์'],
  ], { rowH: 0.62, headerH: 0.52, size: 9.2 });
  textbox(s, 'ข้อจำกัดสำคัญ', 9.65, 1.52, 2.2, 0.36, { size: 17, color: C.green, bold: true });
  card(s, 9.42, 2.04, 2.95, 2.05, 'Data Scope', 'ใช้ข้อมูลจำลองและข้อมูลอ้างอิง เพื่อทำต้นแบบก่อนเชื่อมระบบจริง', { fill: C.white, accent: C.red, valueSize: 15.5 });
  card(s, 9.42, 4.36, 2.95, 1.72, 'Platform', 'React SPA ทำงานบน Browser สมัยใหม่', { fill: C.white, accent: C.blue, valueSize: 16 });
  addFooter(s);

  s = make();
  addTitle(s, 'ภาพรวมแนวทางแก้ปัญหา');
  shape(s, 'ellipse', 4.75, 2.12, 3.82, 1.86, { fill: C.green, line: null });
  textbox(s, 'Science AI\nDashboard', 5.1, 2.57, 3.1, 0.68, { size: 24, color: C.white, bold: true, align: 'ctr' });
  const modules = [
    ['HR', 1.0, 1.62, C.green, C.softGreen],
    ['Student', 1.35, 4.75, C.violet, C.softViolet],
    ['Research', 4.78, 5.36, C.blue, C.softBlue],
    ['Finance', 8.8, 4.75, C.gold, C.softGold],
    ['OKR', 9.25, 1.62, C.magenta, C.softMagenta],
    ['AI Chat', 4.9, 0.92, C.orange, C.softOrange],
  ];
  modules.forEach(([label, x, y, color, soft]) => {
    shape(s, 'roundRect', x, y, 2.6, 0.82, { fill: soft, line: color });
    textbox(s, label, x + 0.1, y + 0.25, 2.4, 0.25, { size: 15, color, bold: true, align: 'ctr' });
  });
  textbox(s, 'รวบรวมข้อมูล -> แสดงผลเป็นกราฟ/ตาราง -> วิเคราะห์ด้วย AI -> สนับสนุนการตัดสินใจ', 1.16, 6.48, 11.0, 0.36, { size: 15.5, color: C.ink, bold: true, align: 'ctr' });
  addFooter(s);

  s = make();
  addTitle(s, 'เทคโนโลยีที่ใช้ในการพัฒนา');
  table(s, 0.86, 1.55, [
    { label: 'Layer', w: 2.1 },
    { label: 'Technology', w: 3.2 },
    { label: 'บทบาทในระบบ', w: 5.85 },
  ], [
    ['Frontend', 'React 19 + Vite 7', 'สร้าง Single Page Application และโหลดหน้าแบบรวดเร็ว'],
    ['Routing', 'React Router DOM 7', 'จัดการเส้นทางของ Dashboard 15 หน้าจอ'],
    ['Visualization', 'Chart.js / Recharts', 'สร้าง Bar, Line, Pie, Doughnut, Radar และกราฟอื่น ๆ'],
    ['Authentication', 'Firebase Auth', 'เข้าสู่ระบบด้วย Email/Password และ Google Sign-In'],
    ['AI Service', 'Google Gemini API', 'ตอบคำถามภาษาไทย สร้างกราฟ และช่วยพยากรณ์ข้อมูล'],
    ['Data Import', 'CSV / XLSX Parser', 'อัปโหลดรายชื่อนักศึกษาและ map column ได้'],
  ], { rowH: 0.62, headerH: 0.54, size: 10.2 });
  addFooter(s);

  s = make();
  addTitle(s, 'สถาปัตยกรรมของระบบ');
  shape(s, 'roundRect', 0.82, 1.62, 3.1, 3.85, { fill: C.softGreen, line: C.green });
  textbox(s, 'Client Browser', 1.18, 1.96, 2.38, 0.32, { size: 17, color: C.green, bold: true, align: 'ctr' });
  bullets(s, ['React Components', 'Router + Lazy Loading', 'Chart Rendering', 'Theme / Auth Context'], 1.15, 2.55, 2.3, 1.8, { size: 12.5, color: C.ink });
  textbox(s, '>', 4.26, 3.25, 0.35, 0.25, { size: 22, color: C.muted, bold: true, align: 'ctr' });
  shape(s, 'roundRect', 4.82, 1.62, 3.45, 3.85, { fill: C.white, line: C.line });
  textbox(s, 'Service & Logic Layer', 5.14, 1.96, 2.8, 0.32, { size: 17, color: C.green, bold: true, align: 'ctr' });
  bullets(s, ['Access Control', 'Student Data Service', 'File Parser', 'Gemini Service', 'Forecast Calculation'], 5.18, 2.55, 2.75, 1.95, { size: 12.5, color: C.ink });
  textbox(s, '>', 8.62, 3.25, 0.35, 0.25, { size: 22, color: C.muted, bold: true, align: 'ctr' });
  shape(s, 'roundRect', 9.12, 1.62, 3.15, 1.6, { fill: C.softBlue, line: C.blue });
  textbox(s, 'Firebase Auth', 9.47, 2.1, 2.45, 0.3, { size: 17, color: C.blue, bold: true, align: 'ctr' });
  shape(s, 'roundRect', 9.12, 3.55, 3.15, 1.92, { fill: C.softMagenta, line: C.magenta });
  textbox(s, 'Google Gemini API', 9.36, 4.12, 2.68, 0.3, { size: 17, color: C.magenta, bold: true, align: 'ctr' });
  textbox(s, 'รูปแบบนี้ทำให้ระบบเป็น Web App ที่เบา ใช้ข้อมูลฝั่ง Client เป็นหลัก และแยกบริการ AI/Auth ชัดเจน', 0.96, 6.05, 11.25, 0.45, { size: 15.2, color: C.white, bold: true, align: 'ctr', fill: C.green, line: null, prst: 'roundRect' });
  addFooter(s);

  s = make();
  addTitle(s, 'ข้อมูลและ Data Visualization');
  card(s, 0.84, 1.56, 2.55, 1.1, 'นักศึกษา', `${stats.universityStudents} คน`, { fill: C.softViolet, accent: C.violet, valueSize: 23 });
  card(s, 3.68, 1.56, 2.55, 1.1, 'บุคลากรคณะ', `${stats.personnel} คน`, { fill: C.softGreen, accent: C.green, valueSize: 23 });
  card(s, 6.52, 1.56, 2.55, 1.1, 'งานวิจัยสะสม', `${stats.publications} เรื่อง`, { fill: C.softBlue, accent: C.blue, valueSize: 22 });
  card(s, 9.36, 1.56, 2.55, 1.1, 'ทุนวิจัย 2568', `${stats.researchFunding} ลบ.`, { fill: C.softGold, accent: C.gold, valueSize: 22 });
  textbox(s, 'ประเภทกราฟที่รองรับ', 0.92, 3.06, 2.8, 0.3, { size: 17, color: C.green, bold: true });
  const chartTypes = ['Bar', 'Line', 'Pie', 'Doughnut', 'Radar', 'Polar Area', 'Stacked Bar'];
  chartTypes.forEach((label, i) => {
    const x = 0.94 + (i % 4) * 2.78;
    const y = 3.58 + Math.floor(i / 4) * 0.82;
    pill(s, label, x, y, 2.25, [C.green, C.blue, C.gold, C.magenta][i % 4]);
  });
  shape(s, 'roundRect', 8.05, 3.26, 3.72, 2.2, { fill: C.white, line: C.line });
  barChart(s, 8.48, 3.92, 2.9, 0.95, [78, 85, 92], ['2567', '2568', '2569'], [C.blue, C.green, C.gold]);
  textbox(s, 'ตัวอย่างแนวโน้ม Scopus\nactual + forecast', 8.52, 5.0, 2.84, 0.3, { size: 10.6, color: C.muted, align: 'ctr' });
  textbox(s, 'เป้าหมายคือให้ผู้ใช้ไม่ต้องอ่านตารางยาว แต่เห็นแนวโน้ม สัดส่วน และจุดที่ต้องตัดสินใจได้ทันที', 0.98, 6.22, 11.3, 0.44, { size: 15.5, color: C.ink, bold: true, align: 'ctr', fill: C.white, line: C.line, prst: 'roundRect' });
  addFooter(s);

  s = make();
  addTitle(s, 'ผลลัพธ์หน้าหลักของ Dashboard');
  card(s, 0.82, 1.56, 2.72, 1.25, 'นักศึกษาทั้งหมด', stats.universityStudents, { fill: C.white, accent: C.green, valueSize: 27 });
  card(s, 3.83, 1.56, 2.72, 1.25, 'นักศึกษาคณะวิทย์', stats.scienceStudents, { fill: C.white, accent: C.violet, valueSize: 27 });
  card(s, 6.84, 1.56, 2.72, 1.25, 'GPA คณะวิทย์', String(stats.avgGpa), { fill: C.white, accent: C.gold, valueSize: 27 });
  card(s, 9.85, 1.56, 2.72, 1.25, 'อัตราสำเร็จ', `${stats.graduationRate}%`, { fill: C.white, accent: C.magenta, valueSize: 27 });
  textbox(s, 'ฟีเจอร์ที่พัฒนาแล้ว', 0.88, 3.25, 2.8, 0.34, { size: 17, color: C.green, bold: true });
  bullets(s, [
    'Dashboard Home พร้อม KPI Cards และ Daily Insights',
    'หน้าแสดงข้อมูล HR, Student, Research, Finance, OKR และ AI Chat',
    'ตารางรายชื่อนักศึกษา ค้นหา/กรอง/ส่งออก CSV',
    'ตรวจสอบการจบและแสดง Progress ของนักศึกษา',
    'พยากรณ์งบประมาณและตัวชี้วัดด้วย Linear Regression',
  ], 0.92, 3.78, 5.8, 2.2, { size: 14.6, color: C.ink });
  shape(s, 'roundRect', 7.35, 3.42, 4.62, 2.28, { fill: C.dark, line: null });
  textbox(s, '15 หน้าจอ', 7.8, 3.84, 3.75, 0.48, { size: 31, color: C.white, bold: true, align: 'ctr' });
  textbox(s, 'ครอบคลุมตั้งแต่ภาพรวมผู้บริหาร\nจนถึงรายละเอียดนักศึกษาและรายงานเฉพาะด้าน', 7.78, 4.6, 3.78, 0.58, { size: 14.5, color: 'DDECE0', align: 'ctr' });
  addFooter(s);

  s = make();
  addTitle(s, 'AI Chatbot และการสร้างกราฟอัตโนมัติ');
  shape(s, 'roundRect', 0.82, 1.65, 2.55, 0.82, { fill: C.softBlue, line: C.blue });
  textbox(s, 'ผู้ใช้ถามภาษาไทย', 1.0, 1.92, 2.18, 0.25, { size: 14, color: C.blue, bold: true, align: 'ctr' });
  textbox(s, '>', 3.64, 1.93, 0.35, 0.25, { size: 22, color: C.muted, bold: true, align: 'ctr' });
  shape(s, 'roundRect', 4.2, 1.65, 2.55, 0.82, { fill: C.softGreen, line: C.green });
  textbox(s, 'ระบบเลือกข้อมูล', 4.43, 1.92, 2.1, 0.25, { size: 14, color: C.green, bold: true, align: 'ctr' });
  textbox(s, '>', 7.03, 1.93, 0.35, 0.25, { size: 22, color: C.muted, bold: true, align: 'ctr' });
  shape(s, 'roundRect', 7.58, 1.65, 2.55, 0.82, { fill: C.softMagenta, line: C.magenta });
  textbox(s, 'Gemini วิเคราะห์', 7.82, 1.92, 2.06, 0.25, { size: 14, color: C.magenta, bold: true, align: 'ctr' });
  textbox(s, '>', 10.42, 1.93, 0.35, 0.25, { size: 22, color: C.muted, bold: true, align: 'ctr' });
  shape(s, 'roundRect', 10.95, 1.65, 1.55, 0.82, { fill: C.softGold, line: C.gold });
  textbox(s, 'กราฟ', 11.12, 1.92, 1.22, 0.25, { size: 14, color: C.gold, bold: true, align: 'ctr' });
  textbox(s, 'ความสามารถหลัก', 0.92, 3.06, 2.8, 0.32, { size: 17, color: C.green, bold: true });
  bullets(s, [
    'ตอบคำถามจากข้อมูล Dashboard เป็นภาษาไทย',
    'สร้าง json_chart เพื่อแสดง Bar, Line, Pie, Radar และ Scatter',
    'พยากรณ์แนวโน้ม เช่น งบประมาณ นักศึกษา ผลงานวิจัย',
    'ค้นหานักศึกษาตามรหัส ชื่อ สาขา ชั้นปี GPA และสถานะ',
    'มี fallback model และ cooldown เพื่อจัดการ rate limit ของ API',
  ], 0.95, 3.55, 5.9, 2.2, { size: 14.6, color: C.ink });
  shape(s, 'roundRect', 7.42, 3.18, 4.68, 2.3, { fill: C.dark, line: null });
  textbox(s, 'ตัวอย่างคำถาม', 7.82, 3.58, 3.88, 0.28, { size: 15, color: C.gold, bold: true });
  textbox(s, '“เปรียบเทียบจำนวนนักศึกษากับ GPA เฉลี่ยแยกตามสาขา”\n“พยากรณ์งบประมาณปีหน้าและทำกราฟเส้น”', 7.82, 4.08, 3.82, 0.7, { size: 13.2, color: C.white });
  addFooter(s);

  s = make();
  addTitle(s, 'ระบบสิทธิ์ผู้ใช้และการจัดการข้อมูล');
  table(s, 0.82, 1.55, [
    { label: 'Role', w: 1.35 },
    { label: 'Level', w: 0.85, align: 'ctr' },
    { label: 'ตัวอย่างสิทธิ์', w: 5.2 },
  ], [
    ['Dean', '1', 'ดูข้อมูลทุกหมวด, ยุทธศาสตร์, Alert Center, Admin Panel'],
    ['Chair', '2', 'ดูข้อมูลหลักสูตร, รายงาน, AI Chat, ข้อมูลเชิงบริหาร'],
    ['Staff', '3', 'ดูข้อมูลปฏิบัติการ เช่น นักศึกษา งานวิจัย งบประมาณ'],
    ['Student', '4', 'ดู Dashboard, ค่าเทอม, กิจกรรม และตรวจสอบการจบ'],
  ], { rowH: 0.58, headerH: 0.52, size: 9.5 });
  shape(s, 'roundRect', 8.85, 1.55, 3.35, 3.0, { fill: C.softGreen, line: C.green });
  textbox(s, 'Admin Data Upload', 9.18, 1.92, 2.7, 0.32, { size: 17, color: C.green, bold: true, align: 'ctr' });
  bullets(s, [
    'รองรับ CSV, TSV, XLSX',
    'Map column อัตโนมัติ',
    'ตรวจข้อมูลซ้ำตามรหัส',
    'อัปโหลดเข้า Firestore',
    'AI ใช้ข้อมูลชุดล่าสุด',
  ], 9.22, 2.55, 2.45, 1.45, { size: 12.2, color: C.ink });
  textbox(s, 'ความสำคัญ: ข้อมูลเชิงบริหารต้องควบคุมสิทธิ์ และชุดข้อมูลต้องอัปเดตได้โดยผู้ดูแลระบบ', 1.0, 5.78, 11.2, 0.48, { size: 15.5, color: C.white, bold: true, align: 'ctr', fill: C.green, line: null, prst: 'roundRect' });
  addFooter(s);

  s = make();
  addTitle(s, 'การทดสอบระบบ');
  table(s, 0.74, 1.45, [
    { label: 'หมวดทดสอบ', w: 2.4 },
    { label: 'รายการ', w: 6.6 },
    { label: 'ผล', w: 1.1, align: 'ctr' },
  ], [
    ['Authentication', 'เข้าสู่ระบบด้วย Email/Password และ Google Sign-In', 'ผ่าน'],
    ['Access Control', 'ผู้ใช้แต่ละ role เข้าถึงเมนูตามสิทธิ์', 'ผ่าน'],
    ['Dashboard', 'KPI Cards และกราฟแสดงข้อมูลถูกต้อง', 'ผ่าน'],
    ['Student Data', 'ค้นหา กรอง ส่งออก และตรวจการจบ', 'ผ่าน'],
    ['AI Chatbot', 'ตอบคำถาม สร้างกราฟ และพยากรณ์แนวโน้ม', 'ผ่าน'],
    ['Responsive', 'ใช้งานได้บน Desktop, Tablet และ Mobile', 'ผ่าน'],
  ], { rowH: 0.58, headerH: 0.52, size: 9.4 });
  card(s, 10.95, 1.55, 1.52, 1.0, 'Pages', '15', { fill: C.softBlue, accent: C.blue, valueSize: 25 });
  card(s, 10.95, 2.85, 1.52, 1.0, 'Roles', '4+', { fill: C.softGreen, accent: C.green, valueSize: 25 });
  card(s, 10.95, 4.15, 1.52, 1.0, 'Charts', '7', { fill: C.softGold, accent: C.gold, valueSize: 25 });
  textbox(s, 'ผลการทดสอบยืนยันว่าระบบทำงานครบตามวัตถุประสงค์หลักของโครงงาน', 0.96, 6.28, 11.25, 0.42, { size: 15.5, color: C.ink, bold: true, align: 'ctr', fill: C.white, line: C.line, prst: 'roundRect' });
  addFooter(s);

  s = make();
  addTitle(s, 'ประโยชน์ที่คาดว่าจะได้รับ');
  const benefits = [
    ['ผู้บริหาร', 'เห็นภาพรวมคณะได้เร็วขึ้นและใช้ข้อมูลประกอบการตัดสินใจ', C.green, C.softGreen],
    ['อาจารย์/เจ้าหน้าที่', 'ลดเวลาค้นหาและจัดทำรายงานจากหลายแหล่งข้อมูล', C.blue, C.softBlue],
    ['นักศึกษา', 'ตรวจสอบข้อมูลพื้นฐาน ค่าเทอม กิจกรรม และสถานะการจบได้สะดวก', C.violet, C.softViolet],
    ['ผู้พัฒนา', 'ได้ฝึกทำ Web App สมัยใหม่ที่รวม React, Firebase, Visualization และ AI API', C.gold, C.softGold],
  ];
  benefits.forEach(([title, body, color, fill], i) => {
    const x = 0.9 + (i % 2) * 5.92;
    const y = 1.62 + Math.floor(i / 2) * 2.12;
    shape(s, 'roundRect', x, y, 5.25, 1.58, { fill, line: color });
    textbox(s, title, x + 0.32, y + 0.24, 1.75, 0.32, { size: 18, color, bold: true });
    textbox(s, body, x + 0.32, y + 0.72, 4.6, 0.46, { size: 14.8, color: C.ink });
  });
  textbox(s, 'โครงงานนี้เป็น Prototype ที่ต่อยอดไปสู่ระบบข้อมูลจริงของมหาวิทยาลัยได้', 1.18, 6.02, 10.95, 0.52, { size: 18, color: C.white, bold: true, align: 'ctr', fill: C.green, line: null, prst: 'roundRect' });
  addFooter(s);

  s = make();
  addTitle(s, 'ข้อจำกัดและแนวทางพัฒนาต่อ');
  textbox(s, 'ข้อจำกัดปัจจุบัน', 0.9, 1.5, 3.1, 0.32, { size: 17, color: C.red, bold: true });
  bullets(s, [
    'ใช้ข้อมูลจำลอง/ข้อมูลอ้างอิง ยังไม่เชื่อมฐานข้อมูลจริงของมหาวิทยาลัย',
    'Gemini API มีข้อจำกัดด้าน quota และ rate limit',
    'API Key อยู่ฝั่ง Client ในต้นแบบ จึงควรมี Backend ในระบบจริง',
    'การรับคำสั่งเสียงภาษาไทยยังมีความคลาดเคลื่อนจาก Web Speech API',
  ], 0.9, 2.0, 5.25, 2.32, { size: 14.2, color: C.ink });
  textbox(s, 'พัฒนาต่อ', 7.02, 1.5, 2.2, 0.32, { size: 17, color: C.green, bold: true });
  bullets(s, [
    'เชื่อม API / Data Warehouse ของมหาวิทยาลัยแบบ Real-time',
    'เพิ่ม Backend สำหรับ security, caching และ rate limiting',
    'เพิ่ม Report Generation เป็น PDF/Excel สำหรับรายงานประจำเดือน',
    'เพิ่มระบบแจ้งเตือน KPI ต่ำกว่าเป้าหมาย',
    'พัฒนาโมเดล ML เฉพาะทาง เช่น Drop-out Prediction',
  ], 7.02, 2.0, 5.45, 2.72, { size: 14.2, color: C.ink });
  shape(s, 'roundRect', 0.96, 5.65, 11.16, 0.56, { fill: C.dark, line: null });
  textbox(s, 'เป้าหมายระยะถัดไป: จาก Prototype ไปสู่ Decision Support System ที่เชื่อมข้อมูลจริง', 1.18, 5.83, 10.72, 0.2, { size: 15.3, color: C.white, bold: true, align: 'ctr' });
  addFooter(s);

  s = make(C.dark);
  shape(s, 'rect', 0, 0, SLIDE_W, SLIDE_H, { fill: C.dark, line: null });
  shape(s, 'rect', 0, 0, SLIDE_W, 0.18, { fill: C.green, line: null });
  textbox(s, 'สรุปโครงงาน', 0.9, 0.86, 4.0, 0.42, { size: 18, color: C.gold, bold: true });
  textbox(s, 'Science AI Dashboard', 0.9, 1.36, 7.3, 0.72, { size: 36, color: C.white, bold: true });
  textbox(s, 'รวมข้อมูลสำคัญของคณะวิทยาศาสตร์ไว้ใน Dashboard เดียว\nและใช้ AI ช่วยเปลี่ยนคำถามให้เป็นคำตอบ กราฟ และ insight เพื่อการตัดสินใจ', 0.94, 2.45, 8.1, 0.86, { size: 19, color: 'DDECE0' });
  shape(s, 'roundRect', 9.18, 1.08, 2.8, 3.42, { fill: '102C20', line: '285A42' });
  textbox(s, 'Demo Flow', 9.52, 1.48, 2.12, 0.3, { size: 17, color: C.gold, bold: true, align: 'ctr' });
  bullets(s, ['Login', 'Dashboard Home', 'Student Data', 'AI Chat', 'RBAC/Admin'], 9.55, 2.08, 2.02, 1.55, { size: 12.5, color: C.white });
  textbox(s, 'Q & A', 0.9, 5.22, 3.5, 0.72, { size: 43, color: C.gold, bold: true });
  textbox(s, 'ขอบคุณครับ', 0.96, 6.14, 3.0, 0.36, { size: 19, color: C.white, bold: true });

  return slides;
}

function contentTypes(count) {
  const slideOverrides = Array.from({ length: count }, (_, i) =>
    `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  ${slideOverrides}
</Types>`;
}

function rootRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function presentationXml(count) {
  const ids = Array.from({ length: count }, (_, i) =>
    `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>${ids}</p:sldIdLst>
  <p:sldSz cx="${emu(SLIDE_W)}" cy="${emu(SLIDE_H)}" type="wide"/>
  <p:notesSz cx="6858000" cy="9144000"/>
  <p:defaultTextStyle>
    <a:defPPr><a:defRPr lang="th-TH"><a:latin typeface="${FONT}"/><a:ea typeface="${FONT}"/><a:cs typeface="${FONT}"/></a:defRPr></a:defPPr>
  </p:defaultTextStyle>
</p:presentation>`;
}

function presentationRels(count) {
  const slideRels = Array.from({ length: count }, (_, i) =>
    `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  ${slideRels}
</Relationships>`;
}

function slideRel() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;
}

function slideMasterXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
  </p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
  <p:txStyles>
    <p:titleStyle><a:lvl1pPr><a:defRPr sz="3200"><a:latin typeface="${FONT}"/><a:ea typeface="${FONT}"/><a:cs typeface="${FONT}"/></a:defRPr></a:lvl1pPr></p:titleStyle>
    <p:bodyStyle><a:lvl1pPr><a:defRPr sz="2000"><a:latin typeface="${FONT}"/><a:ea typeface="${FONT}"/><a:cs typeface="${FONT}"/></a:defRPr></a:lvl1pPr></p:bodyStyle>
    <p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"><a:latin typeface="${FONT}"/><a:ea typeface="${FONT}"/><a:cs typeface="${FONT}"/></a:defRPr></a:lvl1pPr></p:otherStyle>
  </p:txStyles>
</p:sldMaster>`;
}

function slideMasterRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`;
}

function slideLayoutXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
  <p:cSld name="Blank"><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
  </p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`;
}

function slideLayoutRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;
}

function themeXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Science AI Dashboard">
  <a:themeElements>
    <a:clrScheme name="MJU Science">
      <a:dk1><a:srgbClr val="${C.ink}"/></a:dk1>
      <a:lt1><a:srgbClr val="${C.bg}"/></a:lt1>
      <a:dk2><a:srgbClr val="${C.dark}"/></a:dk2>
      <a:lt2><a:srgbClr val="${C.white}"/></a:lt2>
      <a:accent1><a:srgbClr val="${C.green}"/></a:accent1>
      <a:accent2><a:srgbClr val="${C.gold}"/></a:accent2>
      <a:accent3><a:srgbClr val="${C.blue}"/></a:accent3>
      <a:accent4><a:srgbClr val="${C.magenta}"/></a:accent4>
      <a:accent5><a:srgbClr val="${C.violet}"/></a:accent5>
      <a:accent6><a:srgbClr val="${C.orange}"/></a:accent6>
      <a:hlink><a:srgbClr val="${C.blue}"/></a:hlink>
      <a:folHlink><a:srgbClr val="${C.magenta}"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Sarabun">
      <a:majorFont><a:latin typeface="${FONT}"/><a:ea typeface="${FONT}"/><a:cs typeface="${FONT}"/></a:majorFont>
      <a:minorFont><a:latin typeface="${FONT}"/><a:ea typeface="${FONT}"/><a:cs typeface="${FONT}"/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Office">
      <a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
      <a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>
      <a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
      <a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>`;
}

function coreProps() {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:dcmitype="http://purl.org/dc/dcmitype/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Science AI Dashboard Final Project Presentation</dc:title>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

function appProps(count) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
  xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Office PowerPoint</Application>
  <PresentationFormat>On-screen Show (16:9)</PresentationFormat>
  <Slides>${count}</Slides>
  <Notes>0</Notes>
  <HiddenSlides>0</HiddenSlides>
  <MMClips>0</MMClips>
  <ScaleCrop>false</ScaleCrop>
  <Company>Maejo University</Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>16.0000</AppVersion>
</Properties>`;
}

function speakerScript() {
  return `# สคริปต์พรีเซนต์ Science AI Dashboard

## Slide 1: เปิดเรื่อง
สวัสดีครับ วันนี้ผมนำเสนอ Science AI Dashboard ระบบ Dashboard อัจฉริยะสำหรับคณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้ จุดเด่นคือรวมข้อมูลสำคัญไว้ในที่เดียว และใช้ AI ช่วยถามตอบ สร้างกราฟ และสรุป insight เพื่อช่วยการตัดสินใจ

## Slide 2: ปัญหา
ปัญหาหลักคือข้อมูลอยู่หลายแหล่ง ทำให้ผู้บริหารต้องใช้เวลาในการรวบรวมและสรุปผล ระบบนี้จึงถูกออกแบบให้ลดขั้นตอนเหล่านั้น โดยให้ผู้ใช้เห็นภาพรวมผ่าน Dashboard และถามข้อมูลด้วยภาษาไทยได้

## Slide 3: วัตถุประสงค์
โครงงานนี้มีเป้าหมาย 5 ด้าน คือพัฒนา Web App, สร้าง AI Chatbot, ทำ Data Visualization, ควบคุมสิทธิ์ผู้ใช้ และรองรับหลายอุปกรณ์ ผลลัพธ์ที่ต้องการคือระบบต้นแบบที่ใช้งานนำเสนอข้อมูลได้จริง

## Slide 4: ขอบเขตและผู้ใช้
ระบบแบ่งข้อมูลเป็น 6 หมวด ได้แก่ HR, Student, Research, Finance, OKR และ AI Chatbot ผู้ใช้มีหลายระดับ เช่น Dean, Chair, Staff และ Student โดยแต่ละบทบาทจะเห็นข้อมูลตามสิทธิ์ของตน

## Slide 5: ภาพรวมระบบ
แนวคิดหลักคือรวมข้อมูลหลายด้านเข้าสู่ Dashboard เดียว จากนั้นแสดงผลเป็นกราฟ ตาราง และ KPI Card พร้อมให้ AI ช่วยตีความคำถามของผู้ใช้และสร้างคำตอบที่อ่านง่าย

## Slide 6: เทคโนโลยี
ระบบพัฒนาด้วย React 19 และ Vite 7 ใช้ React Router สำหรับเส้นทาง ใช้ Chart.js และ Recharts สำหรับกราฟ ใช้ Firebase Authentication สำหรับการเข้าสู่ระบบ และ Google Gemini API สำหรับ AI Chatbot

## Slide 7: สถาปัตยกรรม
สถาปัตยกรรมเป็น Single Page Application ฝั่ง Client มี Service Layer สำหรับ access control, file parser, student data service และ gemini service จากนั้นเชื่อมต่อ Firebase Auth และ Gemini API

## Slide 8: ข้อมูลและกราฟ
ระบบรองรับข้อมูลนักศึกษา บุคลากร งานวิจัย งบประมาณ และยุทธศาสตร์ จุดสำคัญคือเปลี่ยนข้อมูลดิบให้เป็นกราฟหลายรูปแบบ เช่น Bar, Line, Pie, Doughnut และ Radar เพื่อให้อ่านแนวโน้มได้เร็ว

## Slide 9: ผลลัพธ์หน้าหลัก
หน้าหลักแสดง KPI สำคัญ เช่น จำนวนนักศึกษา ${stats.universityStudents} คน นักศึกษาคณะวิทยาศาสตร์ ${stats.scienceStudents} คน GPA เฉลี่ย ${stats.avgGpa} และอัตราสำเร็จ ${stats.graduationRate}% พร้อมเมนูเข้าสู่รายงานแต่ละด้าน

## Slide 10: AI Chatbot
AI Chatbot รับคำถามภาษาไทย เลือกข้อมูลที่เกี่ยวข้อง ส่งให้ Gemini วิเคราะห์ และถ้าผู้ใช้ต้องการกราฟ ระบบจะให้ AI ส่งรูปแบบ json_chart กลับมาเพื่อ render เป็นกราฟใน Dashboard

## Slide 11: สิทธิ์และข้อมูล
ระบบใช้ Role-Based Access Control เพื่อกำหนดเมนูตามบทบาท และมี Admin Data Upload สำหรับนำเข้าไฟล์ CSV, TSV หรือ XLSX พร้อม map column และตรวจข้อมูลก่อนใช้จริง

## Slide 12: การทดสอบ
ทดสอบแล้วในด้าน Authentication, Access Control, Dashboard, Student Data, AI Chatbot และ Responsive Design ผลลัพธ์คือฟังก์ชันหลักทำงานตามวัตถุประสงค์ที่วางไว้

## Slide 13: ประโยชน์
ระบบช่วยให้ผู้บริหารเห็นข้อมูลเร็วขึ้น เจ้าหน้าที่ลดเวลาทำรายงาน นักศึกษาตรวจข้อมูลของตนเองได้สะดวก และผู้พัฒนาได้ฝึกทำระบบจริงที่รวม Web, Data Visualization, Auth และ AI

## Slide 14: ข้อจำกัดและพัฒนาต่อ
ข้อจำกัดคือยังเป็น Prototype ที่ใช้ข้อมูลจำลอง/อ้างอิง และ AI API ยังมี quota ในอนาคตควรเชื่อมต่อฐานข้อมูลจริง เพิ่ม Backend สำหรับความปลอดภัย และเพิ่มระบบแจ้งเตือน KPI

## Slide 15: สรุป
สรุปคือ Science AI Dashboard เป็นระบบต้นแบบที่ช่วยให้ข้อมูลของคณะวิทยาศาสตร์ถูกนำเสนออย่างเป็นระบบ และเพิ่มความสามารถ AI เพื่อช่วยตอบคำถาม สร้างกราฟ และสนับสนุนการตัดสินใจครับ
`;
}

function canvaGuide() {
  return `# วิธีเอาไฟล์เข้า Canva

ไฟล์ที่แนะนำให้อัปโหลด:

Science_AI_Dashboard_Canva_สวยพร้อมอัปโหลด.pptx

วิธีใช้:

1. เข้า Canva
2. กด Upload หรือ อัปโหลดไฟล์
3. เลือกไฟล์ PowerPoint ด้านบน
4. Canva จะ import เป็น presentation ให้แก้ข้อความ สี และ layout ต่อได้
5. ถ้าฟอนต์ไทยเพี้ยน ให้เปลี่ยนฟอนต์ใน Canva เป็น Sarabun, Noto Sans Thai หรือ Prompt

หมายเหตุ:

- ไฟล์นี้ออกแบบเป็นอัตราส่วน 16:9 เหมาะกับการพรีเซนต์หน้าห้อง
- ข้อความในสไลด์ตั้งใจให้สั้น เพื่อให้พูดประกอบจากไฟล์สคริปต์ได้
- ถ้าต้องการตกแต่งต่อใน Canva แนะนำเพิ่ม screenshot หน้าระบบจริงลงในสไลด์ผลลัพธ์และ Demo Flow
`;
}

function buildPptx() {
  const slides = buildSlides();
  const zip = new ZipFile();
  zip.add('[Content_Types].xml', contentTypes(slides.length));
  zip.add('_rels/.rels', rootRels());
  zip.add('docProps/core.xml', coreProps());
  zip.add('docProps/app.xml', appProps(slides.length));
  zip.add('ppt/presentation.xml', presentationXml(slides.length));
  zip.add('ppt/_rels/presentation.xml.rels', presentationRels(slides.length));
  zip.add('ppt/theme/theme1.xml', themeXml());
  zip.add('ppt/slideMasters/slideMaster1.xml', slideMasterXml());
  zip.add('ppt/slideMasters/_rels/slideMaster1.xml.rels', slideMasterRels());
  zip.add('ppt/slideLayouts/slideLayout1.xml', slideLayoutXml());
  zip.add('ppt/slideLayouts/_rels/slideLayout1.xml.rels', slideLayoutRels());
  slides.forEach((slide, i) => {
    zip.add(`ppt/slides/slide${i + 1}.xml`, slideXml(slide));
    zip.add(`ppt/slides/_rels/slide${i + 1}.xml.rels`, slideRel());
  });

  const deckBuffer = zip.toBuffer();
  fs.writeFileSync(OUT_PPTX, deckBuffer);
  fs.writeFileSync(OUT_CANVA_PPTX, deckBuffer);
  fs.writeFileSync(OUT_SCRIPT, speakerScript(), 'utf8');
  fs.writeFileSync(OUT_CANVA_GUIDE, canvaGuide(), 'utf8');
  console.log(`Created ${OUT_PPTX}`);
  console.log(`Created ${OUT_CANVA_PPTX}`);
  console.log(`Created ${OUT_SCRIPT}`);
  console.log(`Created ${OUT_CANVA_GUIDE}`);
}

buildPptx();
