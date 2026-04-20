// Build SCI AI Dashboard complete Word document
// Uses template mjuF2026 (3).docx; replaces body with Thai article content.

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_DIR = path.join(__dirname, 'template_unpacked');
const OUTPUT_FILE = path.join(__dirname, 'SCI_AI_Dashboard_เอกสารฉบับสมบูรณ์.docx');

// ---------- XML helpers ----------
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// A run of text. opts: {bold, italic, size, sizeCs, superscript, isThai}
function run(text, opts = {}) {
  const {
    bold = false,
    italic = false,
    size = 28,          // half-points (28 = 14pt — template body default)
    sizeCs = size,
    superscript = false,
    isThai = true,
    color = null,
    font = 'TH SarabunPSK',
  } = opts;
  const rpr = [];
  rpr.push(`<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>`);
  if (bold) rpr.push('<w:b/><w:bCs/>');
  if (italic) rpr.push('<w:i/><w:iCs/>');
  if (color) rpr.push(`<w:color w:val="${color}"/>`);
  if (superscript) rpr.push('<w:vertAlign w:val="superscript"/>');
  rpr.push(`<w:sz w:val="${size}"/>`);
  rpr.push(`<w:szCs w:val="${sizeCs}"/>`);
  if (isThai) rpr.push('<w:cs/>');
  const t = `<w:t xml:space="preserve">${esc(text)}</w:t>`;
  return `<w:r><w:rPr>${rpr.join('')}</w:rPr>${t}</w:r>`;
}

// Paragraph wrapper. opts: {align, indent, firstLine, spacingBefore, spacingAfter, keepNext, pageBreakBefore}
function para(runs, opts = {}) {
  const {
    align = 'thaiDistribute',
    indent = null,
    firstLine = null,
    spacingBefore = 0,
    spacingAfter = 0,
    lineRule = 'auto',
    line = 240,
    keepNext = false,
    pageBreakBefore = false,
    defaultFont = 'TH SarabunPSK',
    defaultSize = 28,
  } = opts;
  const ppr = [];
  if (pageBreakBefore) ppr.push('<w:pageBreakBefore/>');
  ppr.push(
    `<w:spacing w:before="${spacingBefore}" w:after="${spacingAfter}" w:line="${line}" w:lineRule="${lineRule}"/>`
  );
  if (indent !== null || firstLine !== null) {
    const parts = [];
    if (indent !== null) parts.push(`w:left="${indent}"`);
    if (firstLine !== null) parts.push(`w:firstLine="${firstLine}"`);
    ppr.push(`<w:ind ${parts.join(' ')}/>`);
  }
  ppr.push(`<w:jc w:val="${align}"/>`);
  if (keepNext) ppr.push('<w:keepNext/>');
  ppr.push(
    `<w:rPr><w:rFonts w:ascii="${defaultFont}" w:hAnsi="${defaultFont}" w:cs="${defaultFont}"/><w:sz w:val="${defaultSize}"/><w:szCs w:val="${defaultSize}"/></w:rPr>`
  );
  const runsStr = Array.isArray(runs) ? runs.join('') : runs;
  return `<w:p><w:pPr>${ppr.join('')}</w:pPr>${runsStr}</w:p>`;
}

// Convenience builders
// Size reference (half-points): 28=14pt body, 32=16pt section/major, 36=18pt chapter title
const BODY_SZ = 28;
const HEAD_SZ = 28;       // template section headings are 14pt bold
const CHAPTER_SZ = 32;    // chapter label (บทที่ N) — 16pt bold
const TITLE_SZ = 32;      // main document title — 16pt bold

const emptyPara = () => para([run('', { size: BODY_SZ })], { defaultSize: BODY_SZ });
const chapterTitle = (line1, line2) => {
  const runs = [];
  runs.push(run(line1, { bold: true, size: CHAPTER_SZ, sizeCs: CHAPTER_SZ }));
  if (line2) {
    runs.push('<w:r><w:br/></w:r>');
    runs.push(run(line2, { bold: true, size: CHAPTER_SZ, sizeCs: CHAPTER_SZ }));
  }
  return para(runs, { align: 'center', spacingBefore: 0, spacingAfter: 240, pageBreakBefore: true, keepNext: true, defaultSize: CHAPTER_SZ });
};
const h2 = (text) =>
  para([run(text, { bold: true, size: HEAD_SZ, sizeCs: HEAD_SZ })], {
    align: 'left',
    spacingBefore: 120,
    spacingAfter: 0,
    keepNext: true,
    defaultSize: HEAD_SZ,
  });
const h3 = (text) =>
  para([run(text, { bold: true, size: HEAD_SZ, sizeCs: HEAD_SZ })], {
    align: 'left',
    spacingBefore: 120,
    spacingAfter: 0,
    keepNext: true,
    defaultSize: HEAD_SZ,
  });
const body = (text, opts = {}) => {
  const runs = Array.isArray(text) ? text : [run(text, { size: BODY_SZ })];
  return para(runs, { align: 'thaiDistribute', firstLine: 720, spacingAfter: 0, defaultSize: BODY_SZ, ...opts });
};
const bodyNoIndent = (text, opts = {}) => {
  const runs = Array.isArray(text) ? text : [run(text, { size: BODY_SZ })];
  return para(runs, { align: 'thaiDistribute', spacingAfter: 0, defaultSize: BODY_SZ, ...opts });
};
// Bulleted item (simple dash bullet)
const bulletItem = (text) => {
  const runs = [
    run('• ', { size: BODY_SZ }),
    ...(Array.isArray(text) ? text : [run(text, { size: BODY_SZ })]),
  ];
  return para(runs, { align: 'thaiDistribute', indent: 720, firstLine: 0, spacingAfter: 0, defaultSize: BODY_SZ });
};
const numberItem = (num, text) => {
  const runs = [
    run(`${num}. `, { size: BODY_SZ }),
    ...(Array.isArray(text) ? text : [run(text, { size: BODY_SZ })]),
  ];
  return para(runs, { align: 'thaiDistribute', indent: 720, firstLine: 0, spacingAfter: 0, defaultSize: BODY_SZ });
};
const subBulletItem = (text) => {
  const runs = [
    run('◦ ', { size: BODY_SZ }),
    ...(Array.isArray(text) ? text : [run(text, { size: BODY_SZ })]),
  ];
  return para(runs, { align: 'thaiDistribute', indent: 1440, firstLine: 0, spacingAfter: 0, defaultSize: BODY_SZ });
};

// Table helpers
function tcell(text, opts = {}) {
  const { width = 2000, bold = false, bg = null, align = 'left' } = opts;
  const tcPr = [];
  tcPr.push(`<w:tcW w:w="${width}" w:type="dxa"/>`);
  tcPr.push(
    '<w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders>'
  );
  if (bg) tcPr.push(`<w:shd w:val="clear" w:color="auto" w:fill="${bg}"/>`);
  const pContent = para([run(text, { bold, size: BODY_SZ })], {
    align,
    spacingAfter: 0,
    spacingBefore: 0,
    line: 240,
    defaultSize: BODY_SZ,
  });
  return `<w:tc><w:tcPr>${tcPr.join('')}</w:tcPr>${pContent}</w:tc>`;
}
function makeTable(rows, colWidths) {
  const total = colWidths.reduce((a, b) => a + b, 0);
  const grid = colWidths.map((w) => `<w:gridCol w:w="${w}"/>`).join('');
  const trs = rows
    .map((row, rowIdx) => {
      const isHeader = rowIdx === 0;
      const cells = row
        .map((text, i) =>
          tcell(text, {
            width: colWidths[i],
            bold: isHeader,
            bg: isHeader ? 'E7E6E6' : null,
            align: isHeader ? 'center' : 'left',
          })
        )
        .join('');
      return `<w:tr>${cells}</w:tr>`;
    })
    .join('');
  return (
    '<w:tbl>' +
    `<w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="${total}" w:type="dxa"/><w:tblLook w:val="04A0"/></w:tblPr>` +
    `<w:tblGrid>${grid}</w:tblGrid>` +
    trs +
    '</w:tbl>' +
    emptyPara()
  );
}

// ---------- Document content ----------
const parts = [];

// --- Title block ---
parts.push(
  para(
    [
      run('ระบบแดชบอร์ดแสดงข้อมูลสารสนเทศคณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้', {
        bold: true,
        size: TITLE_SZ,
      }),
    ],
    { align: 'center', spacingBefore: 0, spacingAfter: 0, defaultSize: TITLE_SZ }
  )
);
parts.push(
  para(
    [run('SCIENCE AI DASHBOARD', { bold: true, size: TITLE_SZ, isThai: false })],
    { align: 'center', spacingAfter: 240, defaultSize: TITLE_SZ }
  )
);

// Authors Thai
parts.push(
  para(
    [
      run('สิรวิชญ์ เกิดชนะ'),
      run('1', { superscript: true, size: 20 }),
      run(', จิรัฎฐ์ ชุติเกียรติญานนท์'),
      run('2', { superscript: true, size: 20 }),
      run(', กิตติกร หาญตระกูล'),
      run('3*', { superscript: true, size: 20 }),
      run(', พาสน์ ปราโมกข์ชน'),
      run('4', { superscript: true, size: 20 }),
      run(' และ ปวีณ เขื่อนแก้ว'),
      run('5', { superscript: true, size: 20 }),
    ],
    { align: 'center', spacingAfter: 0 }
  )
);
// Authors English
parts.push(
  para(
    [
      run('Sirawich Kredchana', { isThai: false }),
      run('1', { superscript: true, size: 20, isThai: false }),
      run(', Jirach Chutikeatyanon', { isThai: false }),
      run('2', { superscript: true, size: 20, isThai: false }),
      run(', Kittikorn Hantrakul', { isThai: false }),
      run('3*', { superscript: true, size: 20, isThai: false }),
      run(', Part Pramokchon', { isThai: false }),
      run('4', { superscript: true, size: 20, isThai: false }),
      run(' and Paween Khoenkaw', { isThai: false }),
      run('5', { superscript: true, size: 20, isThai: false }),
    ],
    { align: 'center', spacingAfter: 120 }
  )
);
parts.push(
  para(
    [
      run(
        'สาขาวิชาวิทยาการคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้ เชียงใหม่ 50290 ประเทศไทย'
      ),
    ],
    { align: 'center', spacingAfter: 120 }
  )
);
parts.push(
  para(
    [
      run('* ผู้นิพนธ์ประสานงาน: กิตติกร หาญตระกูล อีเมล: '),
      run('kittikor@mju.ac.th', { isThai: false }),
    ],
    { align: 'center', spacingAfter: 240 }
  )
);

// --- Abstract Thai ---
parts.push(
  para([run('บทคัดย่อ', { bold: true, size: HEAD_SZ })], {
    align: 'left',
    spacingBefore: 120,
    spacingAfter: 0,
    keepNext: true,
    defaultSize: HEAD_SZ,
  })
);
const absThai = [
  'คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้ มีข้อมูลสารสนเทศจำนวนมากที่จำเป็นต่อการบริหารจัดการและการตัดสินใจ เพื่อเพิ่มประสิทธิภาพในการรวบรวมและวิเคราะห์ข้อมูลเชิงสถิติขององค์กรให้มีความยืดหยุ่นและตอบโจทย์การใช้งานเชิงลึกทั้งสำหรับผู้บริหาร คณาจารย์ และบุคลากรที่เกี่ยวข้อง จึงได้มีการพัฒนาระบบแดชบอร์ดแสดงข้อมูลสารสนเทศคณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้ ที่มีความสามารถในการปรับตัวตามความต้องการของผู้ใช้งาน',
  'บทความนี้มีวัตถุประสงค์เพื่อนำเสนอแนวทางการออกแบบและพัฒนาระบบ SCIENCE AI DASHBOARD โดยมีจุดเด่นสำคัญคือการบูรณาการเทคโนโลยีปัญญาประดิษฐ์ในรูปแบบของผู้ช่วยอัจฉริยะ ระบบสามารถประมวลผลภาษาธรรมชาติเพื่อรับคำสั่งจากผู้ใช้งานในการดึงข้อมูลจากแดชบอร์ดส่วนต่างๆ มาวิเคราะห์ร่วมกัน คาดการณ์แนวโน้มในอนาคตและสร้างการแสดงภาพข้อมูลหรือแดชบอร์ดชุดใหม่ขึ้นมาได้โดยอัตโนมัติตามบริบทที่ถูกถาม',
  'ระบบได้รับการพัฒนาในรูปแบบของเว็บแอปพลิเคชันโดยใช้ไลบรารี React ร่วมกับเครื่องมือ Vite เพื่อเพิ่มประสิทธิภาพความเร็วในการประมวลผลและการแสดงผลข้อมูล โดยทำงานร่วมกับระบบฐานข้อมูลและบริการคลาวด์จาก Firebase ในการบริหารจัดการข้อมูล และเชื่อมต่อกับเทคโนโลยี Generative AI (Gemini API) เพื่อเป็นกลไกหลักในการตอบคำถามและสร้างกราฟแสดงผลข้อมูลแบบพลวัต',
  'ผลการพัฒนาพบว่าระบบสามารถทำงานและตอบสนองต่อคำสั่งได้อย่างมีประสิทธิภาพ ผู้ช่วยอัจฉริยะสามารถวิเคราะห์และนำเสนอข้อมูลสารสนเทศใหม่ๆ รวมถึงพยากรณ์แนวโน้มต่างๆ ได้อย่างถูกต้องและรวดเร็ว นวัตกรรมดังกล่าวไม่เพียงแต่ช่วยลดระยะเวลาในการค้นหาข้อมูล แต่ยังเป็นการยกระดับกระบวนการวางแผน การบริหารจัดการ และการตัดสินใจเชิงกลยุทธ์ของคณะวิทยาศาสตร์ได้อย่างเป็นรูปธรรมและล้ำสมัย',
];
absThai.forEach((p) => parts.push(body(p)));

// Keywords Thai
parts.push(
  para(
    [
      run('คำสำคัญ : ', { bold: true }),
      run(
        'แดชบอร์ดอัจฉริยะ, ปัญญาประดิษฐ์เชิงรู้สร้าง, การวิเคราะห์เชิงคาดการณ์, การแสดงภาพข้อมูลแบบพลวัต, รีแอค'
      ),
    ],
    { align: 'thaiDistribute', indent: 420, firstLine: -420, spacingBefore: 120, spacingAfter: 0 }
  )
);

// --- Abstract English ---
parts.push(
  para([run('Abstract', { bold: true, size: HEAD_SZ, isThai: false })], {
    align: 'left',
    spacingBefore: 120,
    spacingAfter: 0,
    keepNext: true,
    defaultSize: HEAD_SZ,
  })
);
const absEn = [
  "The Faculty of Science, Maejo University, possesses a vast amount of information essential for management and decision-making. To enhance the efficiency of collecting and analyzing the organization's statistical data to be more flexible and meet in-depth operational needs for administrators, faculty members, and related personnel, the Information Dashboard System for the Faculty of Science, Maejo University was developed with the capability to adapt to user requirements.",
  'This paper presents the design and development of the SCIENCE AI DASHBOARD system, highlighting the integration of Artificial Intelligence (AI) technology in the form of an AI Assistant. The system utilizes Natural Language Processing (NLP) to receive user commands, extracting data from various existing dashboards for integrated analysis. It can perform predictive analytics to forecast future trends and automatically generate new dynamic data visualizations or dashboards based on the specific context of the inquiry.',
  'The system was developed as a web application utilizing the React library in conjunction with the Vite build tool to optimize processing speed and data rendering performance. It operates with a cloud-based database and backend services from Firebase for data management, and integrates Generative AI technology (Gemini API) as the core engine for answering queries and generating dynamic graphs.',
  'The development results demonstrate that the system operates efficiently in responding to commands. The AI Assistant can accurately and rapidly analyze and present new informational insights, including forecasting trends. This innovation not only reduces the time required for data retrieval but also tangibly and progressively elevates the planning, management, and strategic decision-making processes of the Faculty of Science.',
];
absEn.forEach((p) =>
  parts.push(body([run(p, { isThai: false })]))
);
parts.push(
  para(
    [
      run('Keywords: ', { bold: true, isThai: false }),
      run(
        'Smart Dashboard, Generative AI, Predictive Analytics, Dynamic Data Visualization, React',
        { isThai: false }
      ),
    ],
    { align: 'thaiDistribute', indent: 420, firstLine: -420, spacingBefore: 120, spacingAfter: 240 }
  )
);

// ========== บทที่ 1 ==========
parts.push(chapterTitle('บทที่ 1', 'บทนำ'));
parts.push(h2('1.1 ความเป็นมาและความสำคัญของปัญหา'));
parts.push(
  body(
    'ในปัจจุบัน สถาบันการศึกษาระดับอุดมศึกษามีข้อมูลจำนวนมากที่เกี่ยวข้องกับการบริหารจัดการ ไม่ว่าจะเป็นข้อมูลนักศึกษา ข้อมูลบุคลากร ข้อมูลงบประมาณ ข้อมูลงานวิจัย และข้อมูลยุทธศาสตร์ต่างๆ การนำข้อมูลเหล่านี้มาวิเคราะห์และแสดงผลในรูปแบบที่เข้าใจง่ายจึงเป็นสิ่งจำเป็นอย่างยิ่งสำหรับผู้บริหารในการตัดสินใจเชิงนโยบาย'
  )
);
parts.push(
  body(
    'คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้ เป็นหน่วยงานที่มีข้อมูลหลากหลายด้าน ทั้งข้อมูลนักศึกษากว่า 19,000 คน ข้อมูลบุคลากรกว่า 200 คน ข้อมูลงบประมาณรายรับ-รายจ่ายรายปี ข้อมูลงานวิจัยและผลงานวิชาการ รวมถึงข้อมูลเป้าหมายเชิงยุทธศาสตร์ (OKR) ซึ่งข้อมูลเหล่านี้อยู่กระจัดกระจายในหลายระบบ ทำให้การวิเคราะห์ภาพรวมเป็นไปอย่างล่าช้าและไม่มีประสิทธิภาพเท่าที่ควร'
  )
);
parts.push(
  body(
    'นอกจากนี้ การนำเทคโนโลยีปัญญาประดิษฐ์ (Artificial Intelligence - AI) มาช่วยในการวิเคราะห์ข้อมูลเชิงลึกและการพยากรณ์แนวโน้มข้อมูล ถือเป็นนวัตกรรมที่กำลังเป็นที่นิยมอย่างแพร่หลายในภาคธุรกิจและการศึกษา การพัฒนาระบบแดชบอร์ดที่มีความสามารถ AI Chatbot จะช่วยให้ผู้ใช้สามารถสอบถามข้อมูล สร้างกราฟ และขอคำวิเคราะห์แนวโน้มได้โดยอัตโนมัติผ่านการพิมพ์ภาษาธรรมชาติ'
  )
);
parts.push(
  body([
    run('จากเหตุผลดังกล่าว ผู้พัฒนาจึงได้พัฒนา '),
    run('"Science AI Dashboard"', { bold: true }),
    run(
      ' ซึ่งเป็นระบบแดชบอร์ดอัจฉริยะสำหรับคณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้ โดยรวบรวมข้อมูลทั้ง 5 ด้านหลักมาแสดงผลในรูปแบบกราฟ ตาราง และการแสดงผลแบบ Interactive พร้อมทั้งมี AI Chatbot ที่ขับเคลื่อนด้วย Google Gemini สำหรับการวิเคราะห์ข้อมูลเชิงลึกและการพยากรณ์'
    ),
  ])
);

parts.push(h2('1.2 วัตถุประสงค์ของโครงงาน'));
const objectives = [
  'เพื่อพัฒนาระบบแดชบอร์ดสำหรับรวบรวมและแสดงผลข้อมูลสำคัญของคณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้ ใน 6 หมวดหลัก ได้แก่ บุคลากร นักศึกษา งานวิจัย การเงิน ยุทธศาสตร์ และ AI Chatbot',
  'เพื่อพัฒนาระบบ AI Chatbot ที่ขับเคลื่อนด้วย Google Gemini API สำหรับการสอบถามข้อมูล สร้างกราฟ และพยากรณ์แนวโน้มข้อมูลอัตโนมัติ',
  'เพื่อพัฒนาระบบแสดงผลข้อมูลแบบ Interactive Data Visualization ที่สามารถกรอง ค้นหา และส่งออกข้อมูลได้',
  'เพื่อพัฒนาระบบควบคุมสิทธิ์การเข้าถึง (Role-Based Access Control - RBAC) รองรับผู้ใช้หลายระดับ',
  'เพื่อพัฒนาระบบ Web Application ที่มี Responsive Design รองรับการใช้งานบนหลากหลายอุปกรณ์',
];
objectives.forEach((t, i) => parts.push(numberItem(i + 1, t)));

parts.push(h2('1.3 ขอบเขตของโครงงาน'));
const scopes = [
  'ระบบเป็น Web Application พัฒนาด้วย React 19 ร่วมกับ Vite 7 ทำงานบน Browser สมัยใหม่ทุกชนิด',
  'ระบบประกอบด้วย 6 หมวดข้อมูลหลัก:',
];
scopes.forEach((t, i) => parts.push(numberItem(i + 1, t)));
const scopeSubItems = [
  ['หมวด 1 - บุคลากร (HR):', ' ข้อมูลภาพรวมบุคลากร, ตำแหน่งวิชาการ, วุฒิการศึกษา, การลา, ผลการประเมิน'],
  ['หมวด 2 - นักศึกษา (Student):', ' สถิตินักศึกษา, รายชื่อนักศึกษา, ตรวจสอบการจบ, กิจกรรม/ความประพฤติ'],
  ['หมวด 3 - งานวิจัย (Research):', ' ผลงานตีพิมพ์, ทุนวิจัย, Innovation'],
  ['หมวด 4 - การเงิน (Finance):', ' รายรับ-รายจ่าย, ค่าธรรมเนียม, พยากรณ์งบประมาณ'],
  ['หมวด 5 - ยุทธศาสตร์ (OKR):', ' เป้าหมายเชิงยุทธศาสตร์, KPI, Radar Chart'],
  ['หมวด 6 - AI Chatbot:', ' ถาม-ตอบ AI, สร้างกราฟ, พยากรณ์, ค้นหานักศึกษา, สั่งงานด้วยเสียง'],
];
scopeSubItems.forEach(([bold, rest]) =>
  parts.push(subBulletItem([run(bold, { bold: true }), run(rest)]))
);
const scopeCont = [
  'ระบบ Authentication ใช้ Firebase Authentication รองรับ Email/Password และ Google Sign-In',
  'ระบบรองรับ 4 ระดับสิทธิ์ผู้ใช้: ผู้บริหาร (Dean), อาจารย์ (Lecturer), เจ้าหน้าที่ (Staff), นักศึกษา (Student)',
  'AI Chatbot ขับเคลื่อนด้วย Google Gemini 2.5 Flash API ตอบเป็นภาษาไทย',
  'ระบบไม่รวมการเชื่อมต่อกับฐานข้อมูลจริงของมหาวิทยาลัย (ใช้ข้อมูลจำลอง)',
];
scopeCont.forEach((t, i) => parts.push(numberItem(i + 3, t)));

parts.push(h2('1.4 ประโยชน์ที่คาดว่าจะได้รับ'));
const benefits = [
  'ผู้บริหารคณะวิทยาศาสตร์สามารถเข้าถึงข้อมูลภาพรวมทุกด้านได้อย่างรวดเร็วผ่านหน้าจอเดียว',
  'ลดเวลาในการรวบรวมและวิเคราะห์ข้อมูลจากหลายแหล่ง โดยมี AI ช่วยวิเคราะห์อัตโนมัติ',
  'สามารถพยากรณ์แนวโน้มงบประมาณและจำนวนนักศึกษาในอนาคตเพื่อการวางแผนเชิงนโยบาย',
  'เป็นต้นแบบ (Prototype) ระบบแดชบอร์ดอัจฉริยะที่สามารถนำไปต่อยอดกับข้อมูลจริงของมหาวิทยาลัยได้ในอนาคต',
  'ได้เรียนรู้และฝึกฝนการพัฒนา Web Application สมัยใหม่ด้วย React, Vite, Firebase และ AI API',
];
benefits.forEach((t, i) => parts.push(numberItem(i + 1, t)));

parts.push(h2('1.5 เครื่องมือที่ใช้ในการพัฒนา'));
parts.push(h3('1.5.1 ฮาร์ดแวร์'));
[
  'คอมพิวเตอร์ส่วนบุคคล (Notebook/Desktop)',
  'หน่วยประมวลผล: Intel Core i5 ขึ้นไป หรือเทียบเท่า',
  'หน่วยความจำ (RAM): 8 GB ขึ้นไป',
  'พื้นที่จัดเก็บ: SSD 256 GB ขึ้นไป',
].forEach((t) => parts.push(bulletItem(t)));

parts.push(h3('1.5.2 ซอฟต์แวร์'));
parts.push(
  makeTable(
    [
      ['ลำดับ', 'ซอฟต์แวร์/เทคโนโลยี', 'เวอร์ชัน', 'วัตถุประสงค์'],
      ['1', 'React', '19.2.0', 'JavaScript Library สำหรับสร้าง UI'],
      ['2', 'Vite', '7.3.1', 'Build Tool และ Dev Server'],
      ['3', 'React Router DOM', '7.13.0', 'จัดการเส้นทาง URL (Routing)'],
      ['4', 'Firebase', '12.9.0', 'Authentication (ระบบยืนยันตัวตน)'],
      ['5', 'Chart.js', '4.5.1', 'สร้างกราฟ (Bar, Line, Pie, Radar)'],
      ['6', 'react-chartjs-2', '5.3.1', 'Chart.js Wrapper สำหรับ React'],
      ['7', 'Recharts', '3.7.0', 'สร้างกราฟเพิ่มเติม'],
      ['8', 'Lucide React', '0.563.0', 'ไอคอน (Icon Library)'],
      ['9', 'chartjs-plugin-zoom', '2.2.0', 'ซูม/แพนกราฟ'],
      ['10', 'Google Gemini API', '2.5-flash', 'AI Chatbot (ถาม-ตอบ, พยากรณ์)'],
      ['11', 'Visual Studio Code', 'ล่าสุด', 'เครื่องมือเขียนโค้ด (IDE)'],
      ['12', 'Google Chrome', 'ล่าสุด', 'เบราว์เซอร์สำหรับทดสอบ'],
      ['13', 'Git / GitHub', 'ล่าสุด', 'ระบบควบคุมเวอร์ชัน'],
      ['14', 'Node.js', '20+', 'สภาพแวดล้อมรันไทม์ JavaScript'],
    ],
    [900, 3500, 1600, 3000]
  )
);

// ========== บทที่ 2 ==========
parts.push(chapterTitle('บทที่ 2', 'ทฤษฎีและเทคโนโลยีที่เกี่ยวข้อง'));
parts.push(
  body(
    'ในบทนี้จะกล่าวถึงทฤษฎีและเทคโนโลยีต่างๆ ที่นำมาใช้ในการพัฒนาระบบ Science AI Dashboard โดยครอบคลุมทั้ง Framework, Library, API และแนวคิดการออกแบบที่สำคัญ'
  )
);

parts.push(h2('2.1 React.js Framework'));
parts.push(
  body(
    'React เป็น JavaScript Library สำหรับสร้าง User Interface (UI) พัฒนาโดย Meta (Facebook) ซึ่งใช้แนวคิด Component-Based Architecture โดยแบ่งหน้าจอออกเป็นส่วนย่อยๆ ที่เรียกว่า Component แต่ละ Component มีหน้าที่เฉพาะ สามารถนำกลับมาใช้ซ้ำได้ (Reusable) และจัดการสถานะข้อมูล (State) ของตัวเองได้อย่างอิสระ'
  )
);
parts.push(
  body(
    'ในโครงงานนี้ใช้ React เวอร์ชัน 19.2.0 ซึ่งเป็นเวอร์ชันล่าสุดที่มีประสิทธิภาพสูง รองรับ Concurrent Features, Hooks API (useState, useEffect, useCallback, useRef) และ Context API สำหรับการจัดการ State ข้ามหลาย Component'
  )
);
parts.push(body('คุณสมบัติสำคัญของ React ที่นำมาใช้:'));
[
  ['Functional Components:', ' ใช้ฟังก์ชันแทน Class ในการสร้าง Component ทำให้โค้ดกระชับและอ่านง่าย'],
  ['React Hooks:', ' ใช้ useState จัดการ State, useEffect จัดการ Side Effects, useCallback ลด re-render, useRef อ้างอิง DOM'],
  ['React Router DOM:', ' จัดการ Client-Side Routing ให้เป็น Single Page Application (SPA)'],
  ['Context API:', ' ใช้ AuthContext สำหรับจัดการสถานะการเข้าสู่ระบบ (Authentication State)'],
].forEach(([b, t]) =>
  parts.push(bulletItem([run(b, { bold: true }), run(t)]))
);

parts.push(h2('2.2 Vite Build Tool'));
parts.push(
  body(
    'Vite เป็น Next-Generation Build Tool สำหรับ Web Development พัฒนาโดย Evan You (ผู้สร้าง Vue.js) ซึ่งมีความเร็วสูงกว่า Webpack แบบดั้งเดิมอย่างมาก เนื่องจากใช้ ES Modules (ESM) ในการโหลดโมดูลแบบ On-Demand แทนการ Bundle ทั้งหมดล่วงหน้า'
  )
);
parts.push(body('ในโครงงานนี้ใช้ Vite เวอร์ชัน 7.3.1 ซึ่งมีคุณสมบัติที่สำคัญ ได้แก่:'));
[
  ['Hot Module Replacement (HMR):', ' อัพเดตหน้าจอทันทีเมื่อแก้ไขโค้ด ไม่ต้อง Refresh ทั้งหน้า'],
  ['Fast Cold Start:', ' เริ่มต้น Dev Server ได้ภายใน 354ms'],
  ['Environment Variables:', ' รองรับไฟล์ .env สำหรับเก็บ API Key โดยใช้ prefix VITE_'],
  ['Optimized Build:', ' สร้าง Production Bundle ที่มีขนาดเล็กด้วย Rollup'],
].forEach(([b, t]) =>
  parts.push(bulletItem([run(b, { bold: true }), run(t)]))
);

parts.push(h2('2.3 Google Gemini AI API'));
parts.push(
  body(
    'Google Gemini เป็น Large Language Model (LLM) ของ Google ที่มีความสามารถในการเข้าใจและสร้างภาษาธรรมชาติ (Natural Language Processing - NLP) รองรับทั้งข้อความ รูปภาพ และเสียง (Multimodal) เป็นตัวขับเคลื่อนหลักของระบบ AI Chatbot ในโครงงานนี้'
  )
);
parts.push(
  body([
    run('ในโครงงานนี้ใช้โมเดล '),
    run('Gemini 2.5 Flash', { bold: true }),
    run(
      ' ซึ่งเป็นโมเดลขนาดกลางที่มีความเร็วสูงและรองรับ Context Window สูงสุด 1,048,576 โทเค็น ผ่าน REST API:'
    ),
  ])
);
[
  ['Endpoint:', ' https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'],
  ['System Instruction:', ' กำหนดบทบาทของ AI ให้เป็น "MJU AI Assistant" ตอบเฉพาะข้อมูลแดชบอร์ดเป็นภาษาไทย'],
  ['Multi-turn Conversation:', ' เก็บประวัติสนทนาไว้ในหน่วยความจำ Browser (สูงสุด 40 รอบสนทนา)'],
  ['Chart Generation:', ' AI สามารถสร้างกราฟผ่าน JSON block (json_chart) ที่ส่งกลับมาพร้อมคำตอบ'],
  ['Fallback Chain:', ' หากโมเดลหลักล้มเหลว ระบบจะลองโมเดลสำรอง (gemini-2.0-flash, gemini-2.0-flash-lite)'],
  ['Rate Limit Retry:', ' ระบบจะลองใหม่อัตโนมัติสูงสุด 3 ครั้ง (Exponential Backoff) เมื่อเจอข้อจำกัด Quota'],
].forEach(([b, t]) =>
  parts.push(bulletItem([run(b, { bold: true }), run(t)]))
);

parts.push(h2('2.4 Firebase Authentication'));
parts.push(
  body(
    'Firebase เป็น Backend-as-a-Service (BaaS) ของ Google ที่ให้บริการหลากหลาย ในโครงงานนี้ใช้ Firebase Authentication สำหรับระบบยืนยันตัวตนผู้ใช้ โดยรองรับ 2 วิธีหลัก:'
  )
);
[
  ['Email/Password Authentication:', ' สมัครสมาชิกและเข้าสู่ระบบด้วยอีเมลและรหัสผ่าน'],
  ['Google Sign-In (OAuth 2.0):', ' เข้าสู่ระบบด้วยบัญชี Google ซึ่งสะดวกสำหรับนักศึกษาและบุคลากร'],
].forEach(([b, t]) =>
  parts.push(bulletItem([run(b, { bold: true }), run(t)]))
);
parts.push(
  body(
    'ระบบจัดการสถานะการเข้าสู่ระบบผ่าน React Context API (AuthContext) โดยใช้ onAuthStateChanged ตรวจสอบสถานะอัตโนมัติ และเก็บข้อมูล User Profile, Role ไว้ใน Context เพื่อให้ Component ทุกตัวเข้าถึงได้'
  )
);

parts.push(h2('2.5 Chart.js และ Data Visualization'));
parts.push(
  body(
    'Chart.js เป็น JavaScript Library สำหรับสร้างกราฟแบบ Interactive บน HTML5 Canvas ในโครงงานนี้ใช้ผ่าน react-chartjs-2 ซึ่งเป็น React Wrapper รองรับกราฟ 7 ประเภท:'
  )
);
[
  ['Bar Chart (กราฟแท่ง):', ' แสดงการเปรียบเทียบข้อมูล เช่น งบประมาณรายปี'],
  ['Line Chart (กราฟเส้น):', ' แสดงแนวโน้มข้อมูล เช่น จำนวนนักศึกษาตามปี'],
  ['Doughnut Chart (กราฟโดนัท):', ' แสดงสัดส่วนข้อมูล เช่น สัดส่วนบุคลากร'],
  ['Pie Chart (กราฟวงกลม):', ' แสดงสัดส่วนค่าธรรมเนียมแยกตามคณะ'],
  ['Radar Chart (กราฟเรดาร์):', ' แสดงผลเปรียบเทียบหลายมิติ เช่น KPI ยุทธศาสตร์'],
  ['Polar Area Chart:', ' แสดงข้อมูลแบบโพลาร์'],
  ['Stacked Bar Chart (กราฟแท่งซ้อน):', ' แสดงข้อมูลหลายชุดในกราฟเดียว'],
].forEach(([b, t]) =>
  parts.push(bulletItem([run(b, { bold: true }), run(t)]))
);
parts.push(
  body([
    run('นอกจากนี้ยังใช้ '),
    run('chartjs-plugin-zoom', { bold: true }),
    run(' สำหรับการซูมเข้า-ออก และแพนกราฟด้วยเมาส์หรือ Touch Gesture'),
  ])
);

parts.push(h2('2.6 Responsive Web Design'));
parts.push(
  body(
    'Responsive Web Design เป็นแนวคิดในการออกแบบเว็บไซต์ให้สามารถปรับขนาดและจัดวางองค์ประกอบได้อัตโนมัติตามขนาดหน้าจอของอุปกรณ์ (Desktop, Tablet, Mobile) ในโครงงานนี้ใช้เทคนิค:'
  )
);
[
  ['CSS Grid Layout:', ' จัดวาง Dashboard Card แบบ Grid ที่ปรับตัวตามขนาดจอ'],
  ['CSS Flexbox:', ' จัดวางองค์ประกอบภายใน Component แบบยืดหยุ่น'],
  ['Media Queries:', ' กำหนดเงื่อนไข CSS ตามขนาดหน้าจอ'],
  ['Dark Theme:', ' ใช้โทนสีเข้มเพื่อลดแสงสว่าง เหมาะกับการใช้งานนาน'],
].forEach(([b, t]) =>
  parts.push(bulletItem([run(b, { bold: true }), run(t)]))
);

parts.push(h2('2.7 Role-Based Access Control (RBAC)'));
parts.push(
  body(
    'RBAC เป็นวิธีการควบคุมสิทธิ์การเข้าถึงทรัพยากรในระบบโดยกำหนดตามบทบาท (Role) ของผู้ใช้ แทนที่จะกำหนดสิทธิ์ให้ผู้ใช้แต่ละคนโดยตรง ในโครงงานนี้กำหนด 4 ระดับสิทธิ์:'
  )
);
[
  ['Dean/Executive (ผู้บริหาร):', ' เข้าถึงข้อมูลทุกหมวด รวมถึงยุทธศาสตร์และ AI Chat'],
  ['Lecturer (อาจารย์):', ' เข้าถึงข้อมูลส่วนใหญ่ ยกเว้นข้อมูลยุทธศาสตร์เชิงลึก'],
  ['Staff (เจ้าหน้าที่):', ' เข้าถึงข้อมูลที่เกี่ยวข้องกับงานปฏิบัติการ'],
  ['Student (นักศึกษา):', ' เข้าถึงเฉพาะข้อมูลส่วนตัวและข้อมูลทั่วไป'],
].forEach(([b, t]) =>
  parts.push(bulletItem([run(b, { bold: true }), run(t)]))
);

// ========== บทที่ 3 ==========
parts.push(chapterTitle('บทที่ 3', 'การออกแบบและพัฒนาระบบ'));

parts.push(h2('3.1 สถาปัตยกรรมของระบบ (System Architecture)'));
parts.push(
  body(
    'ระบบ Science AI Dashboard ออกแบบเป็น Single Page Application (SPA) ที่ทำงานฝั่ง Client (Browser) เป็นหลัก โดยเชื่อมต่อกับบริการภายนอก 2 ส่วน ได้แก่ Firebase Authentication สำหรับระบบยืนยันตัวตน และ Google Gemini API สำหรับ AI Chatbot'
  )
);
parts.push(body('ส่วนประกอบหลักของสถาปัตยกรรม:'));
[
  ['Presentation Layer:', ' React Components ที่แสดงผล UI รวมถึง Sidebar, Dashboard Pages, Charts'],
  ['Business Logic Layer:', ' Functions สำหรับประมวลผลข้อมูล เช่น การคำนวณ Linear Regression, การ Parse คำถาม AI'],
  ['Data Layer:', ' ไฟล์ข้อมูลจำลอง (mockData.js, hrData.js, researchData.js, strategicData.js) และ Firebase Config'],
  ['Service Layer:', ' geminiService.js สำหรับเชื่อมต่อ Gemini API และ firebase.js สำหรับ Authentication'],
].forEach(([b, t]) =>
  parts.push(bulletItem([run(b, { bold: true }), run(t)]))
);

parts.push(h2('3.2 โครงสร้างของโปรเจกต์'));
parts.push(
  body(
    'โครงสร้างไฟล์ของระบบแบ่งออกเป็นส่วนหลักดังนี้ โดยใช้โครงสร้างมาตรฐานของโปรเจกต์ React ที่สร้างด้วย Vite'
  )
);
[
  ['index.html:', ' หน้า HTML หลักที่โหลด Google Fonts และ Entry Point'],
  ['package.json:', ' รายการ Dependencies ทั้งหมด (14 แพ็คเกจ Production)'],
  ['vite.config.js:', ' ไฟล์ตั้งค่า Vite Build Tool'],
  ['src/main.jsx:', ' Entry Point ของแอปพลิเคชัน'],
  ['src/App.jsx:', ' ตั้งค่า Routes ทั้งหมดของระบบ'],
  ['src/components/:', ' Components ที่ใช้ร่วมกัน ได้แก่ Sidebar, Layout, AIChat, AccessDenied'],
  ['src/pages/:', ' หน้าจอทั้งหมด 15 หน้า (Login, SignUp, Dashboard, HR, Students, Research, Finance, OKR, AI Chat)'],
  ['src/contexts/AuthContext.jsx:', ' จัดการสถานะ Login ทั้งระบบด้วย React Context API'],
  ['src/data/:', ' ไฟล์ข้อมูลจำลอง ได้แก่ mockData, hrData, researchData, strategicData, users'],
  ['src/services/geminiService.js:', ' เชื่อมต่อ Gemini AI API พร้อม Fallback Chain และ Retry'],
  ['src/utils/accessControl.js:', ' กำหนดสิทธิ์ตาม Role 4 ระดับ'],
].forEach(([b, t]) =>
  parts.push(bulletItem([run(b, { bold: true }), run(t)]))
);

parts.push(h2('3.3 การออกแบบหน้าจอ (UI/UX Design)'));
parts.push(h3('3.3.1 หลักการออกแบบ'));
parts.push(body('ระบบออกแบบโดยยึดหลัก Modern Dashboard Design ดังนี้:'));
[
  ['Dark Theme:', ' ใช้พื้นหลังสีเข้ม (#0d1117) เพื่อลดความเมื่อยล้าของสายตาและทำให้ข้อมูลกราฟโดดเด่น'],
  ['Card-Based Layout:', ' แสดงข้อมูลแต่ละส่วนใน Card ที่มีขอบโค้งมน มี Shadow เพื่อแยกชั้น'],
  ['Color Coding:', ' ใช้สีที่สื่อความหมาย เช่น เขียว (#00e676) = บวก/สำเร็จ, แดง (#E91E63) = ลบ/รายจ่าย'],
  ['Noto Sans Thai:', ' ใช้ฟอนต์ Noto Sans Thai จาก Google Fonts เพื่อความชัดเจนของตัวอักษรไทย'],
  ['Lucide React Icons:', ' ใช้ชุดไอคอน Lucide สำหรับทุก UI Element เพื่อความสม่ำเสมอ'],
].forEach(([b, t]) =>
  parts.push(bulletItem([run(b, { bold: true }), run(t)]))
);

parts.push(h3('3.3.2 โครงสร้างหน้าจอ'));
parts.push(body('ระบบมีโครงสร้างหน้าจอหลัก ประกอบด้วย:'));
[
  ['Sidebar (แถบเมนูซ้าย):', ' แบ่งเป็น 6 กลุ่มเมนู พร้อมไอคอนและสีประจำกลุ่ม สามารถพับ/ขยายได้'],
  ['Main Content (เนื้อหาหลัก):', ' แสดงหน้าแดชบอร์ดที่เลือกไว้'],
  ['Floating AI Chat:', ' ปุ่มลอยมุมขวาล่างสำหรับเปิด AI Chatbot'],
].forEach(([b, t]) =>
  parts.push(bulletItem([run(b, { bold: true }), run(t)]))
);

parts.push(h3('3.3.3 รายละเอียดหน้าจอแต่ละหน้า'));
parts.push(
  makeTable(
    [
      ['ลำดับ', 'หน้าจอ', 'องค์ประกอบหลัก'],
      ['1', 'หน้าแรก (Dashboard Home)', 'สรุปภาพรวม 4 KPI Cards, Daily Insights จาก AI, หมวดข้อมูล 5 ด้าน, Predictive Analytics'],
      ['2', 'ภาพรวมบุคลากร (HR)', 'จำนวนบุคลากร, แยกตามประเภท/ตำแหน่ง, กราฟสัดส่วน, สถิติการลา, ผลประเมิน'],
      ['3', 'สถิตินักศึกษา', 'จำนวนตามระดับ/คณะ, กราฟแนวโน้ม, ข้อมูลคณะวิทย์, กราฟแท่ง/เส้น'],
      ['4', 'รายชื่อนักศึกษา', 'ตารางพร้อมค้นหา/กรอง, Export CSV, แสดง GPA/สถานะ'],
      ['5', 'ตรวจสอบการจบ', 'สรุปหน่วยกิต, ตรวจเกรด, แสดง Progress, ผลการตรวจสอบ'],
      ['6', 'กิจกรรม/ความประพฤติ', 'ชั่วโมงกิจกรรม, คะแนนความประพฤติ, รายการยืมหนังสือ'],
      ['7', 'ภาพรวมงานวิจัย', 'ผลงานตีพิมพ์, ทุนวิจัย, Impact Factor, สถิติ Citation'],
      ['8', 'รายรับ-รายจ่าย', 'กราฟรายรับ/รายจ่ายรายปี, สรุปคงเหลือ, อัตราการเติบโต'],
      ['9', 'ค่าธรรมเนียม', 'ค่าเทอมแยกตามคณะ, ค่าแรกเข้า, ตลอดหลักสูตร'],
      ['10', 'พยากรณ์งบประมาณ', 'กราฟพยากรณ์ Linear Regression, เปรียบเทียบจริง vs คาดการณ์'],
      ['11', 'ยุทธศาสตร์ (OKR)', 'Radar Chart ผลลัพธ์ 5 ด้าน, Progress Bars, KPI Details, แนวโน้มประสิทธิภาพ'],
      ['12', 'AI Chat เต็มจอ', 'ถาม-ตอบ AI, Quick Actions, สร้างกราฟ, ค้นหานักศึกษา, สั่งเสียง'],
    ],
    [900, 2800, 5300]
  )
);

parts.push(h2('3.4 ระบบ AI Chatbot'));
parts.push(h3('3.4.1 สถาปัตยกรรม AI Chatbot'));
parts.push(
  body(
    'ระบบ AI Chatbot ออกแบบให้ทำงานโดยส่งข้อมูลทั้งหมดของแดชบอร์ด (ข้อมูลจำลอง) ไปเป็น System Instruction ให้ Gemini AI ทุกครั้งที่สนทนา ทำให้ AI สามารถตอบคำถามเกี่ยวกับข้อมูลได้อย่างแม่นยำ'
  )
);
parts.push(body('ขั้นตอนการทำงาน:'));
[
  'ผู้ใช้พิมพ์คำถาม (หรือสั่งด้วยเสียงผ่าน Web Speech API)',
  'ระบบตรวจจับ Keyword เช่น "กราฟ", "พยากรณ์" เพื่อเตือน AI ให้สร้างกราฟ',
  'ส่ง Request ไป Gemini API พร้อม System Instruction ที่มีข้อมูลแดชบอร์ดทั้งหมด',
  'รับ Response กลับมา แยก Text และ json_chart block',
  'แสดงผลข้อความและเรนเดอร์กราฟด้วย Chart.js',
].forEach((t, i) => parts.push(numberItem(i + 1, t)));

parts.push(h3('3.4.2 ฟีเจอร์ของ AI Chatbot'));
[
  ['ถาม-ตอบ AI:', ' สอบถามข้อมูลมหาวิทยาลัยได้ทุกด้าน ตอบเป็นภาษาไทย'],
  ['สร้างกราฟอัตโนมัติ:', ' AI สร้างกราฟ Bar, Line, Pie, Radar จากข้อมูลจริง'],
  ['พยากรณ์ข้อมูล:', ' คำนวณ Linear Regression และแสดงผลเป็นกราฟเส้น/แท่ง'],
  ['ค้นหานักศึกษา:', ' ค้นหาตามรหัส, ชื่อ, สาขา, ชั้นปี, GPA'],
  ['สั่งงานด้วยเสียง:', ' ใช้ Web Speech API รับคำสั่งภาษาไทย'],
  ['ซูมกราฟ:', ' ขยายกราฟเต็มจอ รองรับ Mouse Wheel Zoom และ Pinch Zoom'],
  ['Quick Actions:', ' ปุ่มลัดสำหรับคำสั่งที่ใช้บ่อย'],
].forEach(([b, t]) =>
  parts.push(bulletItem([run(b, { bold: true }), run(t)]))
);

parts.push(h2('3.5 ระบบควบคุมสิทธิ์การเข้าถึง (Access Control)'));
parts.push(
  body([
    run('ระบบ Access Control ใช้ไฟล์ '),
    run('accessControl.js', { bold: true }),
    run(' กำหนดสิทธิ์การเข้าถึงแต่ละ Section ตาม Role ของผู้ใช้:'),
  ])
);
parts.push(
  makeTable(
    [
      ['Section', 'Dean', 'Lecturer', 'Staff', 'Student'],
      ['ภาพรวม (Overview)', '✓', '✓', '✓', '✓'],
      ['บุคลากร (HR)', '✓', '✓', '✓', '-'],
      ['นักศึกษา (Student)', '✓', '✓', '✓', '✓'],
      ['งานวิจัย (Research)', '✓', '✓', '-', '-'],
      ['การเงิน (Finance)', '✓', '✓', '✓', '✓'],
      ['ยุทธศาสตร์ (OKR)', '✓', '-', '-', '-'],
      ['AI Chat', '✓', '✓', '✓', '-'],
    ],
    [3600, 1500, 1500, 1500, 1500]
  )
);
parts.push(
  body(
    'หากผู้ใช้พยายามเข้าถึง Section ที่ไม่มีสิทธิ์ ระบบจะแสดงหน้า "Access Denied" พร้อมแจ้งระดับสิทธิ์ที่จำเป็น'
  )
);

// ========== บทที่ 4 ==========
parts.push(chapterTitle('บทที่ 4', 'ผลการดำเนินงาน'));

parts.push(h2('4.1 ผลการพัฒนาระบบ'));
parts.push(
  body(
    'จากการพัฒนาระบบ Science AI Dashboard ตามที่ได้ออกแบบไว้ในบทที่ 3 สามารถพัฒนาระบบได้ครบถ้วนตามที่กำหนดไว้ทั้ง 6 หมวดหลัก โดยมีรายละเอียดผลการพัฒนาดังนี้'
  )
);

parts.push(h3('4.1.1 หน้าเข้าสู่ระบบ (Login Page)'));
parts.push(
  body(
    'พัฒนาหน้าเข้าสู่ระบบที่รองรับ 2 วิธี คือ Email/Password และ Google Sign-In ผ่าน Firebase Authentication พร้อม Demo Account สำหรับทดสอบ 4 ระดับสิทธิ์'
  )
);

parts.push(h3('4.1.2 หน้าแรก (Dashboard Home)'));
parts.push(body('หน้าแรกแสดงภาพรวมข้อมูลทั้งหมดในรูปแบบ Card ประกอบด้วย:'));
[
  'KPI Cards 4 ตัว: จำนวนนักศึกษา (19,821 คน), รายวิชา (847), GPA เฉลี่ย (3.12), อัตราสำเร็จ (89.5%)',
  'Daily Insights จาก AI: แสดงข้อมูลเชิงวิเคราะห์ 3 ข้อจาก Gemini AI ที่สร้างใหม่ทุกวัน',
  'ข้อมูลเฉพาะคณะวิทยาศาสตร์: นักศึกษา 1,591 คน, GPA 3.18, อัตราสำเร็จ 91.2%',
  'หมวดข้อมูล 5 ด้าน: คลิกเพื่อเข้าสู่แต่ละหมวดได้',
  'ปุ่ม Predictive Analytics: สำหรับดูการวิเคราะห์เชิงคาดการณ์',
].forEach((t) => parts.push(bulletItem(t)));

parts.push(h3('4.1.3 หมวดบุคลากร (HR Dashboard)'));
parts.push(
  body(
    'แสดงข้อมูลบุคลากรคณะวิทยาศาสตร์ ประกอบด้วยกราฟ Doughnut แสดงสัดส่วนตามประเภท/ตำแหน่ง, สถิติการลา, และผลการประเมินผลงาน พร้อม KPI Cards สรุปข้อมูลสำคัญ'
  )
);

parts.push(h3('4.1.4 หมวดนักศึกษา (Student)'));
parts.push(body('ประกอบด้วย 4 หน้าย่อย:'));
[
  ['สถิตินักศึกษา (2.1):', ' กราฟแท่งแยกตามคณะ/ระดับ, กราฟเส้นแนวโน้ม, ข้อมูลคณะวิทยาศาสตร์'],
  ['รายชื่อนักศึกษา (2.2):', ' ตาราง 50 รายการพร้อมค้นหา กรอง และ Export CSV'],
  ['ตรวจสอบการจบ (2.3):', ' ตรวจหน่วยกิต/เกรดอัตโนมัติพร้อม Progress Bar'],
  ['กิจกรรม/ความประพฤติ (2.4):', ' ชั่วโมงกิจกรรม, คะแนนความประพฤติ, รายการยืมห้องสมุด'],
].forEach(([b, t]) =>
  parts.push(bulletItem([run(b, { bold: true }), run(t)]))
);

parts.push(h3('4.1.5 หมวดงานวิจัย (Research Dashboard)'));
parts.push(
  body(
    'แสดงผลงานวิจัยของคณะ ประกอบด้วยจำนวนผลงานตีพิมพ์ ทุนวิจัย Impact Factor รวม และสถิติ Citation พร้อมกราฟรายปี'
  )
);

parts.push(h3('4.1.6 หมวดการเงิน (Finance)'));
parts.push(body('ประกอบด้วย 3 หน้าย่อย:'));
[
  ['รายรับ-รายจ่าย (4.1):', ' กราฟแท่งเปรียบเทียบรายรับ/รายจ่ายรายปี'],
  ['ค่าธรรมเนียม (4.2):', ' แสดงค่าเทอมแยกตามคณะ พร้อมข้อมูลค่าแรกเข้าและตลอดหลักสูตร'],
  ['พยากรณ์งบประมาณ (4.3):', ' กราฟเส้นคาดการณ์งบประมาณ 5 ปีข้างหน้าด้วย Linear Regression'],
].forEach(([b, t]) =>
  parts.push(bulletItem([run(b, { bold: true }), run(t)]))
);

parts.push(h3('4.1.7 หมวดยุทธศาสตร์ (Strategic OKR)'));
parts.push(
  body(
    'แสดงเป้าหมายเชิงยุทธศาสตร์ 5 ด้านผ่าน Radar Chart ที่ออกแบบมาให้อ่านง่าย พร้อม Progress Bars แสดงความคืบหน้า, KPI Details และกราฟเส้นแสดงแนวโน้มประสิทธิภาพ'
  )
);

parts.push(h3('4.1.8 ระบบ AI Chatbot'));
parts.push(
  body(
    'พัฒนา AI Chatbot ที่ขับเคลื่อนด้วย Google Gemini 2.5 Flash สำเร็จทั้ง 2 รูปแบบ:'
  )
);
[
  ['Floating Chat (ปุ่มลอย):', ' เข้าถึงได้จากทุกหน้า คลิกปุ่มมุมขวาล่าง'],
  ['Full-Page Chat (หน้าเต็มจอ):', ' หน้า AI Chat เต็มจอพร้อม Quick Actions และ Feature Cards'],
].forEach(([b, t]) =>
  parts.push(bulletItem([run(b, { bold: true }), run(t)]))
);
parts.push(body('ทดสอบการทำงานของ AI Chatbot โดยถามคำถามหลายรูปแบบ ผลลัพธ์คือ AI สามารถ:'));
[
  'ตอบคำถามข้อมูลมหาวิทยาลัยเป็นภาษาไทยได้ถูกต้อง',
  'สร้างกราฟ Bar, Line, Pie, Radar จากข้อมูลจริงในระบบ',
  'พยากรณ์งบประมาณและจำนวนนักศึกษาพร้อมแสดงกราฟ',
  'ค้นหานักศึกษาตามรหัส ชื่อ สาขา ชั้นปี และ GPA',
].forEach((t) => parts.push(bulletItem(t)));

parts.push(h2('4.2 การทดสอบระบบ'));
parts.push(h3('4.2.1 การทดสอบฟังก์ชัน (Functional Testing)'));
parts.push(
  makeTable(
    [
      ['ลำดับ', 'รายการทดสอบ', 'ผลที่คาดหวัง', 'ผลที่ได้', 'สถานะ'],
      ['1', 'เข้าสู่ระบบด้วย Email/Password', 'เข้าสู่แดชบอร์ดได้', 'เข้าสู่แดชบอร์ดได้สำเร็จ', 'ผ่าน'],
      ['2', 'เข้าสู่ระบบด้วย Google Account', 'เข้าสู่แดชบอร์ดได้', 'เข้าสู่แดชบอร์ดได้สำเร็จ', 'ผ่าน'],
      ['3', 'นักศึกษาเข้าหน้ายุทธศาสตร์', 'แสดง Access Denied', 'แสดง Access Denied ถูกต้อง', 'ผ่าน'],
      ['4', 'แสดงกราฟแท่งงบประมาณ', 'กราฟแสดงถูกต้อง', 'กราฟแสดงข้อมูลถูกต้อง', 'ผ่าน'],
      ['5', 'ค้นหานักศึกษาตามชื่อ', 'แสดงรายชื่อที่ตรง', 'แสดงรายชื่อที่ตรงถูกต้อง', 'ผ่าน'],
      ['6', 'Export CSV รายชื่อนักศึกษา', 'ดาวน์โหลดไฟล์ CSV', 'ดาวน์โหลดไฟล์ CSV ได้', 'ผ่าน'],
      ['7', 'ถาม AI Chatbot "สวัสดี"', 'AI ตอบเป็นภาษาไทย', 'AI ตอบถูกต้อง', 'ผ่าน'],
      ['8', 'สั่ง AI สร้างกราฟ', 'แสดงกราฟในช่อง Chat', 'สร้างกราฟ Bar/Line ได้', 'ผ่าน'],
      ['9', 'พยากรณ์งบประมาณ ปี 70-71', 'แสดงค่าพยากรณ์+กราฟ', 'แสดงผลถูกต้อง', 'ผ่าน'],
      ['10', 'Radar Chart ยุทธศาสตร์', 'แสดง 5 มิติ', 'แสดง Radar 5 มิติถูกต้อง', 'ผ่าน'],
      ['11', 'Responsive บน Mobile', 'แสดงผลปรับตามจอ', 'ปรับ Layout ได้ถูกต้อง', 'ผ่าน'],
      ['12', 'Sidebar พับ/ขยายได้', 'เมนูพับ/ขยายถูกต้อง', 'ทำงานถูกต้อง', 'ผ่าน'],
    ],
    [800, 2600, 2200, 2500, 1000]
  )
);

parts.push(h3('4.2.2 การทดสอบประสิทธิภาพ (Performance Testing)'));
parts.push(
  makeTable(
    [
      ['รายการ', 'ผลการทดสอบ'],
      ['เวลาเริ่ม Dev Server (Cold Start)', '354ms'],
      ['เวลาโหลดหน้าแรก (First Load)', 'น้อยกว่า 2 วินาที'],
      ['เวลาตอบของ AI Chatbot', '2-5 วินาที'],
      ['Hot Module Replacement (HMR)', 'น้อยกว่า 100ms'],
      ['จำนวน Dependencies', '14 แพ็คเกจ (Production)'],
      ['ขนาด Source Code (src/)', 'ประมาณ 320 KB'],
    ],
    [5500, 3500]
  )
);

parts.push(h3('4.2.3 การทดสอบ Browser Compatibility'));
parts.push(
  makeTable(
    [
      ['เบราว์เซอร์', 'เวอร์ชัน', 'ผลการทดสอบ'],
      ['Google Chrome', 'ล่าสุด', 'ทำงานได้สมบูรณ์'],
      ['Mozilla Firefox', 'ล่าสุด', 'ทำงานได้สมบูรณ์'],
      ['Microsoft Edge', 'ล่าสุด', 'ทำงานได้สมบูรณ์'],
      ['Safari (macOS)', 'ล่าสุด', 'ทำงานได้สมบูรณ์'],
    ],
    [3000, 2500, 3500]
  )
);

// ========== บทที่ 5 ==========
parts.push(chapterTitle('บทที่ 5', 'สรุปผลและข้อเสนอแนะ'));

parts.push(h2('5.1 สรุปผลการดำเนินงาน'));
parts.push(
  body(
    'จากการพัฒนาโครงงาน "Science AI Dashboard: ระบบแดชบอร์ดอัจฉริยะสำหรับคณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้ โดยใช้เทคโนโลยี AI" สามารถสรุปผลได้ดังนี้'
  )
);
const conclusions = [
  [
    'ด้านการพัฒนาระบบ:',
    ' สามารถพัฒนาระบบ Web Application ด้วย React 19 ร่วมกับ Vite 7 ที่ครอบคลุมข้อมูล 6 หมวดหลัก ได้แก่ บุคลากร (HR), นักศึกษา (Student), งานวิจัย (Research), การเงิน (Finance), ยุทธศาสตร์ (OKR), และ AI Chatbot รวมทั้งสิ้น 15 หน้าจอ ทั้งหมดสามารถแสดงผลข้อมูลในรูปแบบกราฟ ตาราง และ Card ที่อ่านเข้าใจง่าย',
  ],
  [
    'ด้าน AI Chatbot:',
    ' สามารถพัฒนา AI Chatbot ที่ขับเคลื่อนด้วย Google Gemini 2.5 Flash API ได้สำเร็จ โดย AI สามารถตอบคำถามเกี่ยวกับข้อมูลมหาวิทยาลัยเป็นภาษาไทย, สร้างกราฟ (Bar, Line, Pie, Radar) อัตโนมัติ, พยากรณ์แนวโน้มข้อมูล, ค้นหานักศึกษา และรับคำสั่งด้วยเสียง',
  ],
  [
    'ด้าน Data Visualization:',
    ' สามารถแสดงผลข้อมูลผ่านกราฟ 7 ประเภท (Bar, Line, Doughnut, Pie, Radar, Polar Area, Stacked Bar) โดยใช้ Chart.js พร้อมฟีเจอร์ Zoom และ Pan ที่ช่วยให้ผู้ใช้สำรวจข้อมูลเชิงลึกได้',
  ],
  [
    'ด้าน Role-Based Access Control:',
    ' สามารถพัฒนาระบบควบคุมสิทธิ์ 4 ระดับ (Dean, Lecturer, Staff, Student) ที่ทำงานร่วมกับ Firebase Authentication ได้อย่างมีประสิทธิภาพ',
  ],
  [
    'ด้าน Responsive Design:',
    ' ระบบรองรับการใช้งานบนอุปกรณ์หลากหลายขนาดหน้าจอ ทั้ง Desktop, Tablet และ Mobile โดยใช้ CSS Grid, Flexbox และ Media Queries',
  ],
];
conclusions.forEach(([b, t], i) =>
  parts.push(numberItem(i + 1, [run(b, { bold: true }), run(t)]))
);

parts.push(h2('5.2 ปัญหาและอุปสรรค'));
const problems = [
  [
    'API Rate Limit:',
    ' Google Gemini API เวอร์ชันฟรี (Free Tier) มีข้อจำกัดด้านจำนวน Request ต่อนาที ทำให้ AI Chatbot อาจไม่สามารถตอบสนองได้ทันทีเมื่อใช้งานหนัก ได้แก้ไขโดยเพิ่มระบบ Auto-Retry ด้วย Exponential Backoff',
  ],
  [
    'โมเดล AI ที่เปลี่ยนแปลง:',
    ' Google มีการเปลี่ยนแปลงชื่อโมเดล AI อย่างต่อเนื่อง โมเดลบางตัว (เช่น gemini-pro, gemini-1.5-flash) ถูกยกเลิกไป ต้องอัปเดต Model Fallback Chain อยู่เสมอ',
  ],
  [
    'ข้อมูลจำลอง:',
    ' เนื่องจากไม่สามารถเข้าถึงฐานข้อมูลจริงของมหาวิทยาลัยได้ จึงต้องสร้างข้อมูลจำลอง (Mock Data) ที่สมจริง ซึ่งอาจไม่ตรงกับข้อมูลจริงทุกประการ',
  ],
  [
    'ขนาดของ System Instruction:',
    ' การส่งข้อมูลแดชบอร์ดทั้งหมดไปเป็น System Instruction ของ AI ทำให้ Request มีขนาดใหญ่ ซึ่งอาจส่งผลต่อความเร็วในการตอบสนองและค่าใช้จ่าย Token',
  ],
  [
    'การรองรับภาษาไทยในเสียง:',
    ' Web Speech API มีความแม่นยำในการรับรู้เสียงภาษาไทยไม่สูงมาก โดยเฉพาะคำศัพท์เฉพาะทาง',
  ],
];
problems.forEach(([b, t], i) =>
  parts.push(numberItem(i + 1, [run(b, { bold: true }), run(t)]))
);

parts.push(h2('5.3 ข้อเสนอแนะ'));
parts.push(h3('5.3.1 ข้อเสนอแนะสำหรับการพัฒนาต่อ'));
const suggestions = [
  [
    'เชื่อมต่อฐานข้อมูลจริง:',
    ' เชื่อมต่อกับ API ของระบบทะเบียน ระบบ ERP หรือ Data Warehouse ของมหาวิทยาลัย เพื่อแสดงข้อมูลที่เป็นปัจจุบัน (Real-time Data)',
  ],
  [
    'เพิ่ม Backend Server:',
    ' พัฒนา Backend ด้วย NestJS หรือ Express.js เพื่อจัดการ API Key ฝั่ง Server (ปลอดภัยกว่าฝั่ง Client) และรองรับ Caching, Rate Limiting',
  ],
  [
    'พัฒนาระบบรายงาน (Report Generation):',
    ' เพิ่มฟีเจอร์ Export เป็น PDF หรือ Excel สำหรับรายงานประจำเดือน/ปี',
  ],
  [
    'พัฒนาระบบแจ้งเตือน (Notification):',
    ' แจ้งเตือนผู้บริหารเมื่อมี KPI ต่ำกว่าเป้า หรือข้อมูลผิดปกติ',
  ],
  [
    'เพิ่ม Machine Learning Models:',
    ' พัฒนาโมเดลพยากรณ์เฉพาะทาง เช่น Drop-out Prediction, Budget Optimization',
  ],
  ['รองรับ Multi-Language:', ' เพิ่มภาษาอังกฤษสำหรับผู้ใช้ต่างประเทศ'],
];
suggestions.forEach(([b, t], i) =>
  parts.push(numberItem(i + 1, [run(b, { bold: true }), run(t)]))
);

parts.push(h3('5.3.2 ข้อเสนอแนะสำหรับนักศึกษาที่สนใจ'));
[
  'ศึกษา React Hooks อย่างลึกซึ้ง โดยเฉพาะ useState, useEffect, useCallback เพราะเป็นพื้นฐานของ Modern React',
  'เรียนรู้การใช้ AI API (เช่น Gemini, GPT) ในการพัฒนา Application เพราะเป็นทักษะที่มีความต้องการสูงในตลาดแรงงาน',
  'ให้ความสำคัญกับ UI/UX Design เพราะแดชบอร์ดที่สวยงามและใช้งานง่ายจะช่วยเพิ่มคุณค่าให้โครงงาน',
  'ใช้ Version Control (Git) ตั้งแต่เริ่มโครงงาน เพื่อติดตามการเปลี่ยนแปลงและสามารถย้อนกลับได้เมื่อเกิดปัญหา',
].forEach((t, i) => parts.push(numberItem(i + 1, t)));

// ========== บรรณานุกรม ==========
parts.push(chapterTitle('บรรณานุกรม'));
const refs = [
  [
    'React Documentation. (2025). ',
    'React – A JavaScript library for building user interfaces',
    '. Retrieved from https://react.dev/',
  ],
  [
    'Vite Documentation. (2025). ',
    'Vite – Next Generation Frontend Tooling',
    '. Retrieved from https://vite.dev/',
  ],
  [
    'Google. (2025). ',
    'Gemini API Documentation',
    '. Retrieved from https://ai.google.dev/docs',
  ],
  [
    'Google. (2025). ',
    'Firebase Authentication Documentation',
    '. Retrieved from https://firebase.google.com/docs/auth',
  ],
  [
    'Chart.js Contributors. (2025). ',
    'Chart.js – Simple yet flexible JavaScript charting',
    '. Retrieved from https://www.chartjs.org/',
  ],
  [
    'React Router Contributors. (2025). ',
    'React Router Documentation',
    '. Retrieved from https://reactrouter.com/',
  ],
  [
    'Lucide Contributors. (2025). ',
    'Lucide Icons',
    '. Retrieved from https://lucide.dev/',
  ],
  [
    'Mozilla Developer Network. (2025). ',
    'Web Speech API',
    '. Retrieved from https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API',
  ],
];
refs.forEach(([a, b, c], i) => {
  const prefix = `[${i + 1}] `;
  parts.push(
    para(
      [
        run(prefix),
        run(a, { isThai: false }),
        run(b, { italic: true, isThai: false }),
        run(c, { isThai: false }),
      ],
      { align: 'thaiDistribute', indent: 720, firstLine: -720, spacingAfter: 0 }
    )
  );
});
parts.push(
  para(
    [
      run('[9] คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้. (2568). '),
      run('รายงานประจำปีคณะวิทยาศาสตร์', { italic: true }),
      run('. เชียงใหม่: มหาวิทยาลัยแม่โจ้.'),
    ],
    { align: 'thaiDistribute', indent: 720, firstLine: -720, spacingAfter: 0 }
  )
);
parts.push(
  para(
    [
      run('[10] สำนักบริหารและพัฒนาวิชาการ มหาวิทยาลัยแม่โจ้. (2568). '),
      run('คู่มือการพัฒนาโครงงานคอมพิวเตอร์', { italic: true }),
      run('. เชียงใหม่: มหาวิทยาลัยแม่โจ้.'),
    ],
    { align: 'thaiDistribute', indent: 720, firstLine: -720, spacingAfter: 0 }
  )
);

// ---------- Package into docx ----------
async function build() {
  const bodyContent = parts.join('');
  const templateXml = fs.readFileSync(
    path.join(TEMPLATE_DIR, 'word', 'document.xml'),
    'utf8'
  );
  const bodyOpen = '<w:body>';
  const bodyStart = templateXml.indexOf(bodyOpen) + bodyOpen.length;
  const sectStart = templateXml.indexOf('<w:sectPr', bodyStart);
  const newXml =
    templateXml.substring(0, bodyStart) +
    bodyContent +
    templateXml.substring(sectStart);

  // Build zip from template files
  const zip = new JSZip();

  function addDir(dir, rel = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const abs = path.join(dir, ent.name);
      const zipPath = rel ? rel + '/' + ent.name : ent.name;
      if (ent.isDirectory()) {
        addDir(abs, zipPath);
      } else {
        if (zipPath === 'word/document.xml') {
          zip.file(zipPath, newXml);
        } else {
          zip.file(zipPath, fs.readFileSync(abs));
        }
      }
    }
  }
  addDir(TEMPLATE_DIR);

  const buf = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  fs.writeFileSync(OUTPUT_FILE, buf);
  console.log('Wrote:', OUTPUT_FILE);
  console.log('File size:', buf.length, 'bytes');
  console.log('Body paragraphs/tables:', parts.length);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
