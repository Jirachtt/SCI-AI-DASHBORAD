// ==================== ข้อมูลการวิจัยและนวัตกรรม (Research & Innovation) ====================
// อ้างอิง: dashboard.mju.ac.th + ฐานข้อมูล Scopus/TCI + คณะวิทยาศาสตร์

export const researchData = {
    // ภาพรวมงานวิจัยคณะวิทยาศาสตร์
    overview: {
        totalPublications: 1284,
        totalFunding: 245.8, // ล้านบาท
        totalPatents: 18,
        totalCitations: 8945,
        hIndex: 42,
        activeProjects: 87
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

    // งานวิจัยแยกตามภาควิชา
    byDepartment: [
        { dept: 'ภาควิชาเคมี', publications: 48, funding: 52.3, patents: 5, citations: 2150 },
        { dept: 'ภาควิชาชีววิทยา', publications: 42, funding: 45.8, patents: 4, citations: 1890 },
        { dept: 'ภาควิชาฟิสิกส์', publications: 35, funding: 38.2, patents: 3, citations: 1520 },
        { dept: 'ภาควิชาวิทยาการคอมพิวเตอร์', publications: 28, funding: 35.5, patents: 4, citations: 1280 },
        { dept: 'ภาควิชาคณิตศาสตร์', publications: 18, funding: 22.0, patents: 0, citations: 650 },
        { dept: 'ภาควิชาสถิติ', publications: 12, funding: 18.5, patents: 1, citations: 480 },
        { dept: 'ภาควิชาวิทยาศาสตร์สิ่งแวดล้อม', publications: 12, funding: 33.5, patents: 1, citations: 975 }
    ],

    // งบประมาณวิจัย
    fundingTrend: [
        { year: '2564', internal: 35.2, external: 112.5, industry: 22.8, total: 170.5, type: 'actual' },
        { year: '2565', internal: 38.5, external: 125.0, industry: 28.3, total: 191.8, type: 'actual' },
        { year: '2566', internal: 42.0, external: 135.8, industry: 32.5, total: 210.3, type: 'actual' },
        { year: '2567', internal: 45.5, external: 148.2, industry: 52.1, total: 245.8, type: 'actual' },
        { year: '2568', internal: 48.0, external: 158.0, industry: 58.0, total: 264.0, type: 'forecast' },
        { year: '2569', internal: 51.0, external: 168.0, industry: 65.0, total: 284.0, type: 'forecast' }
    ],

    // แหล่งทุนวิจัยหลัก
    fundingSources: [
        { source: 'สำนักงานการวิจัยแห่งชาติ (วช.)', amount: 52.3, color: '#006838' },
        { source: 'กองทุนส่งเสริมวิทยาศาสตร์ฯ', amount: 38.5, color: '#2E86AB' },
        { source: 'สกสว./สกว.', amount: 35.2, color: '#C5A028' },
        { source: 'มหาวิทยาลัยแม่โจ้ (ทุนภายใน)', amount: 45.5, color: '#A23B72' },
        { source: 'ภาคเอกชน/อุตสาหกรรม', amount: 42.1, color: '#F18F01' },
        { source: 'แหล่งทุนต่างประเทศ', amount: 32.2, color: '#7B68EE' }
    ],

    // สิทธิบัตรและนวัตกรรม
    patents: [
        { id: 'PAT-001', title: 'สารสกัดจากสมุนไพรต้านเชื้อรา', dept: 'ภาควิชาชีววิทยา', year: '2566', status: 'ได้รับแล้ว', type: 'อนุสิทธิบัตร' },
        { id: 'PAT-002', title: 'เซ็นเซอร์ตรวจวัดคุณภาพน้ำ IoT', dept: 'ภาควิชาฟิสิกส์', year: '2566', status: 'ได้รับแล้ว', type: 'สิทธิบัตร' },
        { id: 'PAT-003', title: 'ระบบ AI วิเคราะห์โรคพืช', dept: 'ภาควิชาวิทยาการคอมพิวเตอร์', year: '2567', status: 'ได้รับแล้ว', type: 'อนุสิทธิบัตร' },
        { id: 'PAT-004', title: 'วัสดุนาโนดูดซับสารพิษ', dept: 'ภาควิชาเคมี', year: '2567', status: 'ได้รับแล้ว', type: 'สิทธิบัตร' },
        { id: 'PAT-005', title: 'สูตรปุ๋ยชีวภาพจากจุลินทรีย์', dept: 'ภาควิชาชีววิทยา', year: '2567', status: 'รอพิจารณา', type: 'อนุสิทธิบัตร' },
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
