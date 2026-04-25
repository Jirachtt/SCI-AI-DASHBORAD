// ==================== ข้อมูลการวิจัยและนวัตกรรม (Research & Innovation) ====================
// อ้างอิง: dashboard.mju.ac.th + ฐานข้อมูล Scopus/TCI + คณะวิทยาศาสตร์

export const researchData = {
    // ภาพรวมงานวิจัยคณะวิทยาศาสตร์
    // อ้างอิง: dashboard.mju.ac.th/homeDashboard?dep=20300 (projects + budget ปี 2568)
    overview: {
        totalPublications: 1284,
        totalFunding: 28.3, // ล้านบาท (งบวิจัยโครงการปี 2568)
        totalPatents: 18,
        totalCitations: 8945,
        hIndex: 42,
        activeProjects: 101 // โครงการวิจัยปี 2568 จาก MJU Dashboard
    },

    // จำนวนงานวิจัยย้อนหลัง
    publicationTrend: [
        { year: '2562', scopus: 42, tci1: 28, tci2: 15, national: 35, total: 120 },
        { year: '2563', scopus: 48, tci1: 32, tci2: 18, national: 38, total: 136 },
        { year: '2564', scopus: 55, tci1: 35, tci2: 20, national: 42, total: 152 },
        { year: '2565', scopus: 62, tci1: 38, tci2: 22, national: 40, total: 162 },
        { year: '2566', scopus: 71, tci1: 42, tci2: 19, national: 45, total: 177 },
        { year: '2567', scopus: 78, tci1: 45, tci2: 24, national: 48, total: 195 },
        { year: '2568', scopus: 85, tci1: 48, tci2: 26, national: 50, total: 209, type: 'forecast' },
        { year: '2569', scopus: 92, tci1: 51, tci2: 28, national: 52, total: 223, type: 'forecast' }
    ],

    // งานวิจัยแยกตามภาควิชา — 7 ภาควิชาจริงของคณะวิทย์ มจ. (funding รวม 28.3 ลบ.)
    byDepartment: [
        { dept: 'ภาควิชาเคมี', publications: 48, funding: 6.0, patents: 5, citations: 2150 },
        { dept: 'ภาควิชาเทคโนโลยีชีวภาพ', publications: 42, funding: 5.3, patents: 4, citations: 1890 },
        { dept: 'ภาควิชาฟิสิกส์', publications: 35, funding: 4.4, patents: 3, citations: 1520 },
        { dept: 'ภาควิชาวิทยาการคอมพิวเตอร์', publications: 28, funding: 4.1, patents: 4, citations: 1280 },
        { dept: 'ภาควิชาคณิตศาสตร์และสถิติ', publications: 30, funding: 4.6, patents: 1, citations: 1130 },
        { dept: 'ภาควิชาเทคโนโลยีสารสนเทศ', publications: 18, funding: 2.5, patents: 1, citations: 650 },
        { dept: 'ภาควิชาเคมีประยุกต์', publications: 12, funding: 1.4, patents: 1, citations: 380 }
    ],

    // งบประมาณวิจัย (ล้านบาท) — อ้างอิงจริง: dashboard.mju.ac.th?dep=20300
    // total ตรงกับ MJU Dashboard; internal/external/industry เป็นสัดส่วนประมาณ
    fundingTrend: [
        { year: '2564', internal: 5.7, external: 18.7, industry: 4.3, total: 28.7, type: 'actual' },
        { year: '2565', internal: 5.1, external: 16.6, industry: 3.9, total: 25.6, type: 'actual' },
        { year: '2566', internal: 3.2, external: 10.3, industry: 2.3, total: 15.8, type: 'actual' },
        { year: '2567', internal: 4.5, external: 14.6, industry: 3.4, total: 22.5, type: 'actual' },
        { year: '2568', internal: 5.7, external: 18.4, industry: 4.2, total: 28.3, type: 'actual' },
        { year: '2569', internal: 4.2, external: 13.5, industry: 3.1, total: 20.8, type: 'forecast' }
    ],

    // แหล่งทุนวิจัยหลัก (ล้านบาท รวม 28.3 ตาม MJU Dashboard 2568)
    fundingSources: [
        { source: 'สำนักงานการวิจัยแห่งชาติ (วช.)', amount: 6.0, color: '#006838' },
        { source: 'กองทุนส่งเสริมวิทยาศาสตร์ฯ', amount: 4.4, color: '#2E86AB' },
        { source: 'สกสว./สกว.', amount: 4.1, color: '#C5A028' },
        { source: 'มหาวิทยาลัยแม่โจ้ (ทุนภายใน)', amount: 5.2, color: '#A23B72' },
        { source: 'ภาคเอกชน/อุตสาหกรรม', amount: 4.9, color: '#F18F01' },
        { source: 'แหล่งทุนต่างประเทศ', amount: 3.7, color: '#7B68EE' }
    ],

    // สิทธิบัตรและนวัตกรรม
    patents: [
        { id: 'PAT-001', title: 'สารสกัดจากสมุนไพรต้านเชื้อรา', dept: 'ภาควิชาเทคโนโลยีชีวภาพ', year: '2566', status: 'ได้รับแล้ว', type: 'อนุสิทธิบัตร' },
        { id: 'PAT-002', title: 'เซ็นเซอร์ตรวจวัดคุณภาพน้ำ IoT', dept: 'ภาควิชาฟิสิกส์', year: '2566', status: 'ได้รับแล้ว', type: 'สิทธิบัตร' },
        { id: 'PAT-003', title: 'ระบบ AI วิเคราะห์โรคพืช', dept: 'ภาควิชาวิทยาการคอมพิวเตอร์', year: '2567', status: 'ได้รับแล้ว', type: 'อนุสิทธิบัตร' },
        { id: 'PAT-004', title: 'วัสดุนาโนดูดซับสารพิษ', dept: 'ภาควิชาเคมี', year: '2567', status: 'ได้รับแล้ว', type: 'สิทธิบัตร' },
        { id: 'PAT-005', title: 'สูตรปุ๋ยชีวภาพจากจุลินทรีย์', dept: 'ภาควิชาเทคโนโลยีชีวภาพ', year: '2567', status: 'รอพิจารณา', type: 'อนุสิทธิบัตร' },
        { id: 'PAT-006', title: 'แอปพลิเคชันติดตามสุขภาพ', dept: 'ภาควิชาวิทยาการคอมพิวเตอร์', year: '2567', status: 'รอพิจารณา', type: 'ลิขสิทธิ์ซอฟต์แวร์' }
    ],

    // งานวิจัยเด่นที่นำไปใช้ประโยชน์ต่อชุมชน
    communityImpact: [
        { title: 'โครงการปรับปรุงดินเกษตร จ.เชียงใหม่', area: 'เกษตรกรรม', beneficiaries: 450, year: '2567' },
        { title: 'ระบบตรวจวัดคุณภาพอากาศชุมชน', area: 'สิ่งแวดล้อม', beneficiaries: 1200, year: '2567' },
        { title: 'อบรมเกษตรกรใช้เทคโนโลยีชีวภาพ', area: 'บริการวิชาการ', beneficiaries: 320, year: '2566' },
        { title: 'น้ำสมุนไพรเสริมสุขภาพ ชุมชนบ้านแม่แจ่ม', area: 'สุขภาพ', beneficiaries: 680, year: '2566' },
        { title: 'พัฒนาระบบ IoT โรงเรือนเกษตรอัจฉริยะ', area: 'เทคโนโลยี', beneficiaries: 150, year: '2567' }
    ],

    // เปรียบเทียบกับมหาวิทยาลัยอื่น (Benchmarking)
    benchmark: [
        { university: 'มจ. คณะวิทย์', scopus: 78, hIndex: 42, patents: 18 },
        { university: 'มช. คณะวิทย์', scopus: 185, hIndex: 68, patents: 35 },
        { university: 'มข. คณะวิทย์', scopus: 142, hIndex: 55, patents: 28 },
        { university: 'จุฬา คณะวิทย์', scopus: 320, hIndex: 95, patents: 52 },
        { university: 'มก. คณะวิทย์', scopus: 210, hIndex: 72, patents: 40 }
    ]
};

export default researchData;
