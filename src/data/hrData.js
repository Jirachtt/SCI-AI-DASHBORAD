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
    // อ้างอิง: dashboard.mju.ac.th/homeDashboard?dep=20300 (ข้อมูลจริง ปี 2567)
    scienceFaculty: {
        name: 'คณะวิทยาศาสตร์',
        total: 173,
        academic: 104,
        support: 69,
        byGender: [
            { gender: 'ชาย', count: 64, color: 'var(--accent-info)' },
            { gender: 'หญิง', count: 109, color: 'var(--accent-pink)' }
        ],
        byType: [
            { type: 'พนักงานมหาวิทยาลัย', count: 145, color: 'var(--accent-success-deep)' },
            { type: 'พนักงานส่วนงาน', count: 14, color: 'var(--accent-info)' },
            { type: 'ข้าราชการ', count: 14, color: 'var(--accent-gold)' }
        ],

        // ตำแหน่งทางวิชาการ
        academicPositions: [
            { position: 'ศาสตราจารย์', count: 0, color: 'var(--accent-gold)', icon: 'Prof' },
            { position: 'รองศาสตราจารย์', count: 18, color: 'var(--accent-gold)', icon: 'Assoc' },
            { position: 'ผู้ช่วยศาสตราจารย์', count: 27, color: 'var(--accent-info)', icon: 'Asst' },
            { position: 'อาจารย์', count: 59, color: 'var(--accent-success-deep)', icon: 'Lect' }
        ],

        // วุฒิการศึกษา
        byEducation: [
            { level: 'ปริญญาเอก', count: 87, color: 'var(--accent-pink)', icon: 'PhD' },
            { level: 'ปริญญาโท', count: 17, color: 'var(--accent-info)', icon: 'MSc' }
        ],

        // 7 ภาควิชาจริงของคณะวิทยาศาสตร์ มจ. — รวม academic 104 / support 69 / total 173
        byDepartment: [
            { dept: 'ภาควิชาเคมี', academic: 19, support: 13, total: 32 },
            { dept: 'ภาควิชาเทคโนโลยีชีวภาพ', academic: 18, support: 11, total: 29 },
            { dept: 'ภาควิชาฟิสิกส์', academic: 13, support: 10, total: 23 },
            { dept: 'ภาควิชาคณิตศาสตร์และสถิติ', academic: 22, support: 14, total: 36 },
            { dept: 'ภาควิชาวิทยาการคอมพิวเตอร์', academic: 13, support: 9, total: 22 },
            { dept: 'ภาควิชาเทคโนโลยีสารสนเทศ', academic: 11, support: 7, total: 18 },
            { dept: 'ภาควิชาเคมีประยุกต์', academic: 8, support: 5, total: 13 }
        ],

        // แนวโน้มจำนวนบุคลากรย้อนหลัง
        trend: [
            { year: '2564', academic: 98, support: 67, total: 165 },
            { year: '2565', academic: 100, support: 68, total: 168 },
            { year: '2566', academic: 102, support: 69, total: 171 },
            { year: '2567', academic: 104, support: 69, total: 173 },
            { year: '2568', academic: 104, support: 68, total: 172, type: 'forecast' },
            { year: '2569', academic: 103, support: 67, total: 170, type: 'forecast' }
        ],

        // สถิติการได้ตำแหน่งทางวิชาการใหม่สะสมรายปี
        promotionTrend: [
            { year: '2564', newAssocProf: 3, newAssistProf: 4, newProf: 0 },
            { year: '2565', newAssocProf: 2, newAssistProf: 3, newProf: 0 },
            { year: '2566', newAssocProf: 4, newAssistProf: 2, newProf: 0 },
            { year: '2567', newAssocProf: 1, newAssistProf: 5, newProf: 0 },
            { year: '2568', newAssocProf: 2, newAssistProf: 3, newProf: 1, type: 'forecast' }
        ],

        // ความหลากหลาย (Diversity)
        diversity: {
            nationality: [
                { label: 'ไทย', count: 165 },
                { label: 'ต่างชาติ', count: 8 }
            ],
            ageGroup: [
                { group: '25-35 ปี', count: 28, color: 'var(--accent-success)' },
                { group: '36-45 ปี', count: 54, color: 'var(--accent-info)' },
                { group: '46-55 ปี', count: 64, color: 'var(--accent-gold)' },
                { group: '56-65 ปี', count: 27, color: 'var(--accent-pink)' }
            ],
            retirementIn5Years: 18
        },

        // อัตราส่วนนักศึกษาต่ออาจารย์ (ใช้ academic staff = 104)
        studentFacultyRatio: [
            { year: '2564', ratio: 13.8 },
            { year: '2565', ratio: 14.1 },
            { year: '2566', ratio: 13.9 },
            { year: '2567', ratio: 14.0 },
            { year: '2568', ratio: 14.2, type: 'forecast' }
        ]
    }
};

export default hrData;
