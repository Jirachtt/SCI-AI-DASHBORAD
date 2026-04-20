// Rewrite docx spacing to match friend's document formatting.
// - Line spacing: 312 -> 240 (single)
// - Paragraph after-spacing: normalize large gaps to 0 (keep before-spacing for headings)
// - Alignment: keep both/center; add thaiDistribute feel via tighter line

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const SRC = path.join(__dirname, 'SCI_AI_Dashboard_เอกสารฉบับสมบูรณ์.backup.docx');
const OUT = path.join(__dirname, 'SCI_AI_Dashboard_เอกสารฉบับสมบูรณ์.docx');

(async () => {
  const buf = fs.readFileSync(SRC);
  const zip = await JSZip.loadAsync(buf);
  const docEntry = zip.file('word/document.xml');
  let xml = await docEntry.async('string');

  const before = xml.length;

  // 1) Tighten line spacing from 312 (~1.3x) to 240 (single) everywhere
  xml = xml.replace(/w:line="312"/g, 'w:line="240"');

  // 2) Normalize body paragraph spacing. Drop big after-spacing for body flow.
  //    Keep heading before/after (240/360, 240/120, 180/80) by NOT touching them.
  //    Already mostly after="0"; nothing to do here generically.

  // 3) Convert body justification to thaiDistribute for more even Thai spacing.
  //    Only affects paragraphs that are "both"; leaves center/left/right alone.
  xml = xml.replace(/<w:jc w:val="both"\/>/g, '<w:jc w:val="thaiDistribute"/>');

  console.log('XML length', before, '->', xml.length);

  zip.file('word/document.xml', xml);

  const out = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  fs.writeFileSync(OUT, out);
  console.log('Wrote:', OUT, '(', out.length, 'bytes )');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
