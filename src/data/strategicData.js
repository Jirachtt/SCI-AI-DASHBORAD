// ==================== ข้อมูลยุทธศาสตร์และการดำเนินงาน (Strategic & OKR Monitoring) ====================
// อ้างอิง: แผนยุทธศาสตร์คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้ 2566-2570

export const strategicData = {
    // เป้าหมายยุทธศาสตร์หลัก (Strategic Goals 2030)
    strategicGoals: [
        {
            id: 'SG-1',
            title: 'ผลิตบัณฑิตที่มีคุณภาพ',
            subtitle: 'Quality Graduate Production',
            icon: 'S1',
            color: '#006838',
            target: 95,
            current: 89.5,
            unit: '%',
            description: 'อัตราการสำเร็จการศึกษาภายในเวลาที่กำหนด',
            kpis: [
                { name: 'อัตราสำเร็จการศึกษาภายในเวลา', target: 95, current: 89.5, unit: '%' },
                { name: 'เกรดเฉลี่ยบัณฑิต', target: 3.20, current: 3.18, unit: 'GPA' },
                { name: 'อัตราการได้งานภายใน 1 ปี', target: 90, current: 85.2, unit: '%' },
                { name: 'คะแนนความพึงพอใจผู้ใช้บัณฑิต', target: 4.5, current: 4.2, unit: '/5.0' }
            ]
        },
        {
            id: 'SG-2',
            title: 'วิจัยและนวัตกรรมชั้นนำ',
            subtitle: 'Leading Research & Innovation',
            icon: 'S2',
            color: '#2E86AB',
            target: 100,
            current: 78,
            unit: 'publications',
            description: 'จำนวนผลงานตีพิมพ์ในฐาน Scopus ต่อปี',
            kpis: [
                { name: 'ผลงานตีพิมพ์ Scopus/ปี', target: 100, current: 78, unit: 'เรื่อง' },
                { name: 'ทุนวิจัยภายนอก', target: 200, current: 148.2, unit: 'ล้านบาท' },
                { name: 'สิทธิบัตร/อนุสิทธิบัตร สะสม', target: 25, current: 18, unit: 'ชิ้น' },
                { name: 'Citation Impact Factor เฉลี่ย', target: 3.5, current: 2.8, unit: 'IF' }
            ]
        },
        {
            id: 'SG-3',
            title: 'บริการวิชาการเพื่อชุมชน',
            subtitle: 'Community Academic Service',
            icon: 'S3',
            color: '#C5A028',
            target: 20,
            current: 15,
            unit: 'projects',
            description: 'จำนวนโครงการบริการวิชาการสู่ชุมชน',
            kpis: [
                { name: 'โครงการบริการวิชาการ/ปี', target: 20, current: 15, unit: 'โครงการ' },
                { name: 'ผู้ได้รับประโยชน์', target: 3000, current: 2800, unit: 'คน' },
                { name: 'รายได้จากบริการวิชาการ', target: 20, current: 15.5, unit: 'ล้านบาท' },
                { name: 'ความพึงพอใจของชุมชน', target: 4.5, current: 4.3, unit: '/5.0' }
            ]
        },
        {
            id: 'SG-4',
            title: 'บริหารจัดการที่เป็นเลิศ',
            subtitle: 'Excellence Management',
            icon: 'S4',
            color: '#A23B72',
            target: 90,
            current: 82,
            unit: '%',
            description: 'ประสิทธิภาพการใช้งบประมาณ',
            kpis: [
                { name: 'ประสิทธิภาพการใช้งบประมาณ', target: 90, current: 82, unit: '%' },
                { name: 'ความพึงพอใจบุคลากร', target: 4.5, current: 4.1, unit: '/5.0' },
                { name: 'อัตราการลาออกบุคลากร', target: 3, current: 4.5, unit: '%' },
                { name: 'คะแนน EdPEx', target: 300, current: 265, unit: 'คะแนน' }
            ]
        },
        {
            id: 'SG-5',
            title: 'ลดความเหลื่อมล้ำ',
            subtitle: 'Reducing Inequality',
            icon: 'S5',
            color: '#7B68EE',
            target: 30,
            current: 22,
            unit: '%',
            description: 'สัดส่วนนักศึกษาที่ได้รับทุน',
            kpis: [
                { name: 'สัดส่วนนศ.ที่ได้ทุนการศึกษา', target: 30, current: 22, unit: '%' },
                { name: 'ทุนการศึกษาที่มอบ/ปี', target: 5, current: 3.8, unit: 'ล้านบาท' },
                { name: 'อัตราคงอยู่ของนศ. (Retention)', target: 95, current: 91.2, unit: '%' },
                { name: 'นศ.ด้อยโอกาสที่เรียนจบ', target: 90, current: 82, unit: '%' }
            ]
        }
    ],

    // OKR ล่าสุด (ปี 2567)
    okr: {
        period: 'ปีงบประมาณ 2567',
        objectives: [
            {
                id: 'O1',
                title: 'ยกระดับคุณภาพหลักสูตรสู่มาตรฐานสากล',
                progress: 72,
                color: '#006838',
                keyResults: [
                    { id: 'KR1.1', title: 'หลักสูตรผ่าน AUN-QA ≥ 2 หลักสูตร', target: 2, current: 1, unit: 'หลักสูตร', progress: 50 },
                    { id: 'KR1.2', title: 'บัณฑิตได้งานภายใน 1 ปี ≥ 90%', target: 90, current: 85.2, unit: '%', progress: 95 },
                    { id: 'KR1.3', title: 'นักศึกษาแลกเปลี่ยนต่างประเทศ ≥ 20 คน', target: 20, current: 14, unit: 'คน', progress: 70 }
                ]
            },
            {
                id: 'O2',
                title: 'เพิ่มผลงานวิจัยตีพิมพ์ Scopus 15%',
                progress: 85,
                color: '#2E86AB',
                keyResults: [
                    { id: 'KR2.1', title: 'ผลงาน Scopus ≥ 85 เรื่อง', target: 85, current: 78, unit: 'เรื่อง', progress: 92 },
                    { id: 'KR2.2', title: 'ทุนวิจัยภายนอก ≥ 150 ล้าน', target: 150, current: 148.2, unit: 'ล้านบาท', progress: 99 },
                    { id: 'KR2.3', title: 'สิทธิบัตร/อนุสิทธิบัตรใหม่ ≥ 5 ชิ้น', target: 5, current: 3, unit: 'ชิ้น', progress: 60 }
                ]
            },
            {
                id: 'O3',
                title: 'พัฒนาระบบดิจิทัลสนับสนุนการเรียนรู้',
                progress: 65,
                color: '#C5A028',
                keyResults: [
                    { id: 'KR3.1', title: 'รายวิชาออนไลน์ ≥ 30% ของทั้งหมด', target: 30, current: 22, unit: '%', progress: 73 },
                    { id: 'KR3.2', title: 'ระบบ LMS ครอบคลุม 100% ของรายวิชา', target: 100, current: 85, unit: '%', progress: 85 },
                    { id: 'KR3.3', title: 'ความพึงพอใจนศ.ต่อสื่อดิจิทัล ≥ 4.0', target: 4.0, current: 3.6, unit: '/5.0', progress: 90 }
                ]
            },
            {
                id: 'O4',
                title: 'สร้างเครือข่ายความร่วมมือเชิงยุทธศาสตร์',
                progress: 58,
                color: '#A23B72',
                keyResults: [
                    { id: 'KR4.1', title: 'MOU กับสถาบันต่างประเทศ ≥ 5 แห่ง', target: 5, current: 3, unit: 'แห่ง', progress: 60 },
                    { id: 'KR4.2', title: 'โครงการวิจัยร่วมกับภาคเอกชน ≥ 10', target: 10, current: 6, unit: 'โครงการ', progress: 60 },
                    { id: 'KR4.3', title: 'รายได้จากความร่วมมือ ≥ 20 ล้าน', target: 20, current: 10.5, unit: 'ล้านบาท', progress: 53 }
                ]
            }
        ]
    },

    // ข้อมูลเปรียบเทียบประสิทธิภาพ 5 ด้าน (Radar Chart)
    performanceRadar: {
        categories: ['การศึกษา', 'การวิจัย', 'บริการวิชาการ', 'บริหารจัดการ', 'ทำนุศิลปวัฒนธรรม'],
        currentYear: [85, 78, 75, 82, 70],
        targetYear: [95, 90, 85, 90, 80],
        lastYear: [80, 72, 70, 78, 68]
    },

    // แนวโน้มประสิทธิภาพรวมย้อนหลัง
    efficiencyTrend: [
        { year: '2564', score: 72.5, budgetEfficiency: 78, satisfactionScore: 3.8 },
        { year: '2565', score: 75.0, budgetEfficiency: 80, satisfactionScore: 3.9 },
        { year: '2566', score: 78.2, budgetEfficiency: 81, satisfactionScore: 4.0 },
        { year: '2567', score: 80.5, budgetEfficiency: 82, satisfactionScore: 4.1 },
        { year: '2568', score: 83.0, budgetEfficiency: 85, satisfactionScore: 4.2, type: 'forecast' }
    ]
};

export default strategicData;
