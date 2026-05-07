export const MAEJO_OFFICIAL_SOURCE_DOMAINS = [
    'mju.ac.th',
    'www.mju.ac.th',
    'science.mju.ac.th',
    'sciencebase.mju.ac.th',
    'admissions.mju.ac.th',
    'reg.mju.ac.th',
    'education.mju.ac.th',
];

export const maejoStudentFaqData = [
    {
        id: 'maejo_contact',
        topic: 'ที่ตั้งและช่องทางติดต่อมหาวิทยาลัยแม่โจ้',
        aliases: ['แม่โจ้อยู่ที่ไหน', 'ที่อยู่แม่โจ้', 'ติดต่อแม่โจ้', 'เบอร์แม่โจ้', 'เดินทางไปแม่โจ้', 'maejo contact', 'mju contact'],
        answer:
            'มหาวิทยาลัยแม่โจ้ตั้งอยู่ที่ 63 หมู่ 4 ต.หนองหาร อ.สันทราย จ.เชียงใหม่ 50290 โทรศัพท์กลาง 053-873000 และอีเมล maejo@mju.ac.th หากเป็นเรื่องรับสมัครระดับปริญญาตรีให้ติดต่อฝ่ายรับสมัคร 0 5387 3460',
        sources: [
            { label: 'MJU Contact', url: 'https://www.mju.ac.th/th/Contact.html', type: 'official' },
        ],
    },
    {
        id: 'science_contact_programs',
        topic: 'คณะวิทยาศาสตร์และหลักสูตรที่เปิดรับ',
        aliases: ['คณะวิทย์มีสาขาอะไร', 'คณะวิทยาศาสตร์มีสาขาอะไร', 'หลักสูตรคณะวิทย์', 'เรียนคณะวิทย์แม่โจ้', 'science programs'],
        answer:
            'คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้มีข้อมูลหลักสูตรและสาขาที่เปิดรับในหน้า TCAS ของคณะ เช่น วิทยาการคอมพิวเตอร์ เทคโนโลยีชีวภาพ เคมี สถิติและการจัดการสารสนเทศ คณิตศาสตร์ เทคโนโลยีสารสนเทศ นวัตกรรมวัสดุ ฟิสิกส์ประยุกต์ และนวัตกรรมเคมีอุตสาหกรรม ทั้งนี้ให้ตรวจประกาศล่าสุดก่อนสมัครจริง',
        sources: [
            { label: 'TCAS Science MJU', url: 'https://sciencebase.mju.ac.th/tcas/', type: 'official' },
        ],
    },
    {
        id: 'admissions_howto',
        topic: 'การสมัครเรียนและ TCAS',
        aliases: ['สมัครแม่โจ้ยังไง', 'สมัครเรียนแม่โจ้', 'TCAS สมัครยังไง', 'tcas มีกี่รอบ', 'รับสมัครแม่โจ้', 'admissions'],
        answer:
            'การสมัครเรียนให้ยึดประกาศล่าสุดจากเว็บไซต์รับสมัครนักศึกษาใหม่ของมหาวิทยาลัยแม่โจ้เป็นหลัก เพราะรอบรับสมัคร เอกสาร วันชำระเงิน และจำนวนรับเปลี่ยนตามปีการศึกษา หากถามจำนวนรับรายสาขา AI จะใช้ข้อมูลในระบบก่อนและค้นประกาศทางการเมื่อข้อมูลไม่ครบ',
        sources: [
            { label: 'MJU Admissions', url: 'https://admissions.mju.ac.th/', type: 'official' },
            { label: 'TCAS Science MJU', url: 'https://sciencebase.mju.ac.th/tcas/', type: 'official' },
        ],
    },
    {
        id: 'registration_howto',
        topic: 'การลงทะเบียนเรียน',
        aliases: ['ลงทะเบียนเรียนยังไง', 'วิธีลงทะเบียน', 'เพิ่มลดรายวิชา', 'รายวิชาที่เปิดสอน', 'ตารางเรียน', 'reg mju'],
        answer:
            'ระบบทะเบียนแม่โจ้มีเมนูเข้าสู่ระบบ, วิชาที่เปิดสอน, ตารางเรียนนักศึกษา, ปฏิทินการศึกษา, หลักสูตรที่เปิดสอน และคำแนะนำการลงทะเบียน โดยการลงทะเบียนต้องยืนยันรายการก่อนจึงถือว่าสิ้นสุด และการเพิ่ม/ลดรายวิชาต้องทำในช่วงเวลาที่ระบบเปิด',
        sources: [
            { label: 'MJU Registrar', url: 'https://reg.mju.ac.th/', type: 'official' },
            { label: 'Registration Guide', url: 'https://reg.mju.ac.th/enrollguide.htm', type: 'official' },
        ],
    },
    {
        id: 'tuition_public',
        topic: 'ค่าเทอมและค่าธรรมเนียม',
        aliases: ['ค่าเทอมแม่โจ้', 'ค่าธรรมเนียมแม่โจ้', 'ค่าเล่าเรียน', 'จ่ายค่าเทอม', 'ค้างชำระ', 'tuition'],
        answer:
            'ค่าเทอม/ค่าธรรมเนียมต้องอ้างประกาศของมหาวิทยาลัยหรือข้อมูลในหน้า Tuition ของระบบก่อนเสมอ เพราะแตกต่างตามหลักสูตร ระดับการศึกษา และปีการศึกษา หากถามค่าธรรมเนียมรายบุคคล AI จะตอบได้เฉพาะเมื่อ role มีสิทธิ์และระบบมีข้อมูลชำระเงินจริง',
        sources: [
            { label: 'MJU Admissions', url: 'https://admissions.mju.ac.th/', type: 'official' },
            { label: 'MJU Registrar', url: 'https://reg.mju.ac.th/', type: 'official' },
        ],
    },
    {
        id: 'honors_rules',
        topic: 'เกียรตินิยมและเงื่อนไขจบ',
        aliases: ['เกียรตินิยมต้องทำยังไง', 'ได้เกียรตินิยม', 'เกียรตินิยมอันดับ', 'เงื่อนไขจบ', 'กฎระเบียบ', 'พ้นสภาพ'],
        answer:
            'เงื่อนไขเกียรตินิยมและการสำเร็จการศึกษาควรใช้หน้ากฎระเบียบ/เกียรตินิยมใน SCI AI Dashboard ก่อน เพราะสรุปไว้สำหรับคณะวิทยาศาสตร์ และต้องตรวจประกาศหรือข้อบังคับมหาวิทยาลัยฉบับล่าสุดประกอบก่อนใช้เป็นเอกสารทางการ',
        sources: [
            { label: 'MJU Rules and Regulations', url: 'https://law.mju.ac.th/', type: 'official' },
        ],
        requiredSections: ['academic_rules'],
    },
    {
        id: 'student_activities',
        topic: 'กิจกรรมและชั่วโมงกิจกรรม',
        aliases: ['กิจกรรมเดือนนี้', 'กิจกรรมเดือนหน้า', 'รับน้อง', 'ไหว้ครู', 'ชั่วโมงกิจกรรม', 'ชั่วโมงคณะ', 'student activity'],
        answer:
            'กิจกรรมของคณะวิทยาศาสตร์ให้ใช้ข้อมูลในหน้า Student Life & Activity ของระบบก่อน เพราะมีปฏิทินกิจกรรมและความคืบหน้าชั่วโมง หากข้อมูลเดือนล่าสุดยังไม่ sync ให้ตรวจประกาศจากคณะหรือช่องทางทางการของคณะวิทยาศาสตร์เพิ่มเติม',
        sources: [
            { label: 'Faculty of Science MJU', url: 'https://www.science.mju.ac.th/', type: 'official' },
        ],
        requiredSections: ['student_life'],
    },
    {
        id: 'course_help',
        topic: 'รายวิชาและความยากง่าย',
        aliases: ['วิชาไหนยาก', 'วิชาไหนง่าย', 'วิชาไหนเกรดดี', 'วิชาไหนเสี่ยง f', 'รายวิชาน่าสนใจ', 'ปี 1 ต้องลงอะไร', 'เรียนอะไรดี'],
        answer:
            'คำถามเรื่องรายวิชาให้ใช้ Course & Grade Analytics ในระบบก่อน โดยความยากง่ายเป็น proxy จาก GPA เฉลี่ยรายวิชาและสัดส่วนเกรด C/D/F ไม่ใช่ป้าย official จากมหาวิทยาลัย หากต้องการยืนยันเป็นทางการต้องใช้ไฟล์ Reg/API รายวิชาจริง',
        sources: [
            { label: 'MJU Registrar Course Search', url: 'https://reg.mju.ac.th/registrar/class_info.asp', type: 'official' },
            { label: 'TCAS Science MJU', url: 'https://sciencebase.mju.ac.th/tcas/', type: 'official' },
        ],
        requiredSections: ['course_analytics'],
    },
];

function normalize(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

export function getMaejoStudentFaqMatches(question, { limit = 4 } = {}) {
    const q = normalize(question);
    if (!q) return [];

    return maejoStudentFaqData
        .map(item => {
            const aliases = [item.topic, ...(item.aliases || [])].map(normalize);
            const score = aliases.reduce((total, alias) => {
                if (!alias) return total;
                if (q === alias) return total + 10;
                if (q.includes(alias) || alias.includes(q)) return total + 6;
                const tokens = alias.split(' ').filter(token => token.length >= 2);
                return total + tokens.filter(token => q.includes(token)).length;
            }, 0);
            return { ...item, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

export function formatMaejoFaqSources(sources = []) {
    return sources
        .map(source => `- [${source.label}](${source.url})`)
        .join('\n');
}

export function getMaejoStudentFaqContext(question, { limit = 5 } = {}) {
    const matches = getMaejoStudentFaqMatches(question, { limit });
    if (!matches.length) {
        return `Maejo student public FAQ: no direct local FAQ match. Use official Maejo sources first: ${MAEJO_OFFICIAL_SOURCE_DOMAINS.join(', ')}`;
    }

    return matches.map(item => {
        const sources = formatMaejoFaqSources(item.sources || []);
        const sections = item.requiredSections?.length ? `requiredSections=${item.requiredSections.join(',')}` : 'public';
        return `FAQ: ${item.topic}\nAccess: ${sections}\nAnswer: ${item.answer}\nSources:\n${sources}`;
    }).join('\n\n');
}

export function findMaejoStudentFaqAnswer(question) {
    return getMaejoStudentFaqMatches(question, { limit: 1 })[0] || null;
}
