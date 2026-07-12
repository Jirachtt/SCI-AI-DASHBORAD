// ==================== ข้อมูลบุคลากรและโครงสร้างองค์กร (HR & Faculty Profile) ====================
// อ้างอิง: dashboard.mju.ac.th/personnel.aspx + คณะวิทยาศาสตร์

export const hrData = {
    // ภาพรวมบุคลากรทั้งมหาวิทยาลัย
    university: {
        total: 2847,
        academic: 1245,
        support: 1602,
        byType: [
            { type: 'พนักงานมหาวิทยาลัย', count: 2105, color: 'var(--accent-success-deep)' },
            { type: 'ข้าราชการ', count: 342, color: 'var(--accent-gold)' },
            { type: 'พนักงานราชการ', count: 198, color: 'var(--accent-info)' },
            { type: 'ลูกจ้างชั่วคราว', count: 202, color: 'var(--accent-pink)' }
        ],
        byGender: [
            { gender: 'ชาย', count: 1285 },
            { gender: 'หญิง', count: 1562 }
        ]
    },

    // ข้อมูลเฉพาะคณะวิทยาศาสตร์
    // อ้างอิง: dashboard.mju.ac.th/person.aspx?dep=20300 (ตรวจล่าสุด 11 ก.ค. 2569)
    scienceFaculty: {
        name: 'คณะวิทยาศาสตร์',
        total: 173,
        academic: 113,
        support: 60,
        byGender: [
            { gender: 'ยังไม่จำแนกจากแหล่งข้อมูล', count: 173, color: 'var(--accent-info)' }
        ],
        byType: [
            { type: 'พนักงานมหาวิทยาลัย', count: 145, color: 'var(--accent-success-deep)' },
            { type: 'พนักงานส่วนงาน', count: 14, color: 'var(--accent-info)' },
            { type: 'ข้าราชการ', count: 14, color: 'var(--accent-gold)' }
        ],

        // ตำแหน่งทางวิชาการ
        academicPositions: [
            { position: 'ศาสตราจารย์', count: 0, color: 'var(--accent-gold)', icon: 'Prof' },
            { position: 'รองศาสตราจารย์', count: 20, color: 'var(--accent-gold)', icon: 'Assoc' },
            { position: 'ผู้ช่วยศาสตราจารย์', count: 68, color: 'var(--accent-info)', icon: 'Asst' },
            { position: 'อาจารย์', count: 25, color: 'var(--accent-success-deep)', icon: 'Lect' }
        ],

        // วุฒิการศึกษา
        byEducation: [
            { level: 'ปริญญาเอก', count: 106, color: 'var(--accent-pink)', icon: 'PhD' },
            { level: 'ปริญญาโท', count: 34, color: 'var(--accent-info)', icon: 'MSc' },
            { level: 'ปริญญาตรี', count: 28, color: 'var(--accent-success-deep)', icon: 'BSc' },
            { level: 'ปวส.', count: 4, color: 'var(--accent-gold)', icon: 'Diploma' },
            { level: 'ประถมศึกษา', count: 1, color: 'var(--accent-orange)', icon: 'Other' }
        ],

        // หน้า public ปัจจุบันให้ยอดรวมตามกลุ่มตำแหน่ง แต่ไม่แจกแจงรายภาควิชา
        byDepartment: [
            { dept: 'รวมคณะวิทยาศาสตร์', academic: 113, support: 60, total: 173 }
        ],

        // มีเฉพาะ snapshot ล่าสุดจากแหล่ง public จึงไม่สร้างประวัติย้อนหลังเอง
        trend: [
            { year: '2569', academic: 113, support: 60, total: 173, type: 'actual' }
        ],

        // สถิติการได้ตำแหน่งทางวิชาการใหม่สะสมรายปี
        promotionTrend: [],

        // ความหลากหลาย (Diversity)
        diversity: {
            nationality: [
                { label: 'ยังไม่จำแนกจากแหล่งข้อมูล', count: 173 }
            ],
            ageGroup: [
                { group: 'ยังไม่จำแนกจากแหล่งข้อมูล', count: 173, color: 'var(--accent-info)' }
            ],
            retirementIn5Years: 20
        },

        // อัตราส่วนนักศึกษาต่ออาจารย์จาก snapshot ปัจจุบัน 1,759 / 113
        studentFacultyRatio: [
            { year: '2569', ratio: 15.6, type: 'actual' }
        ],
        sourceUrl: 'https://dashboard.mju.ac.th/person.aspx?dep=20300',
        checkedAt: '2026-07-11',
        dataGaps: ['เพศ', 'หน่วยงานย่อย', 'สัญชาติ', 'ช่วงอายุ', 'ประวัติการเลื่อนตำแหน่ง']
    }
};

export default hrData;
