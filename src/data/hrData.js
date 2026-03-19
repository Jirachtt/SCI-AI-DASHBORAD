// ==================== ข้อมูลบุคลากรและโครงสร้างองค์กร (HR & Faculty Profile) ====================
// อ้างอิง: dashboard.mju.ac.th/personnel.aspx + คณะวิทยาศาสตร์

export const hrData = {
    // ภาพรวมบุคลากรทั้งมหาวิทยาลัย
    university: {
        total: 2847,
        academic: 1245,
        support: 1602,
        byType: [
            { type: 'พนักงานมหาวิทยาลัย', count: 2105, color: '#006838' },
            { type: 'ข้าราชการ', count: 342, color: '#C5A028' },
            { type: 'พนักงานราชการ', count: 198, color: '#2E86AB' },
            { type: 'ลูกจ้างชั่วคราว', count: 202, color: '#A23B72' }
        ],
        byGender: [
            { gender: 'ชาย', count: 1285 },
            { gender: 'หญิง', count: 1562 }
        ]
    },

    // ข้อมูลเฉพาะคณะวิทยาศาสตร์
    scienceFaculty: {
        name: 'คณะวิทยาศาสตร์',
        total: 113,
        academic: 68,
        support: 45,
        byGender: [
            { gender: 'ชาย', count: 42, color: '#2E86AB' },
            { gender: 'หญิง', count: 71, color: '#E91E63' }
        ],
        byType: [
            { type: 'พนักงานมหาวิทยาลัย', count: 102, color: '#006838' },
            { type: 'ข้าราชการ', count: 11, color: '#C5A028' }
        ],

        // ตำแหน่งทางวิชาการ
        academicPositions: [
            { position: 'ศาสตราจารย์', count: 0, color: '#FFD700', icon: 'Prof' },
            { position: 'รองศาสตราจารย์', count: 18, color: '#C5A028', icon: 'Assoc' },
            { position: 'ผู้ช่วยศาสตราจารย์', count: 27, color: '#2E86AB', icon: 'Asst' },
            { position: 'อาจารย์', count: 23, color: '#006838', icon: 'Lect' }
        ],

        // วุฒิการศึกษา
        byEducation: [
            { level: 'ปริญญาเอก', count: 57, color: '#A23B72', icon: 'PhD' },
            { level: 'ปริญญาโท', count: 11, color: '#2E86AB', icon: 'MSc' }
        ],

        // ข้อมูลบุคลากรแยกตามภาควิชา
        byDepartment: [
            { dept: 'ภาควิชาเคมี', academic: 14, support: 8, total: 22 },
            { dept: 'ภาควิชาชีววิทยา', academic: 12, support: 7, total: 19 },
            { dept: 'ภาควิชาฟิสิกส์', academic: 10, support: 6, total: 16 },
            { dept: 'ภาควิชาคณิตศาสตร์', academic: 10, support: 5, total: 15 },
            { dept: 'ภาควิชาสถิติ', academic: 8, support: 5, total: 13 },
            { dept: 'ภาควิชาวิทยาการคอมพิวเตอร์', academic: 9, support: 7, total: 16 },
            { dept: 'ภาควิชาวิทยาศาสตร์สิ่งแวดล้อม', academic: 5, support: 7, total: 12 }
        ],

        // แนวโน้มจำนวนบุคลากรย้อนหลัง
        trend: [
            { year: '2564', academic: 72, support: 48, total: 120 },
            { year: '2565', academic: 70, support: 47, total: 117 },
            { year: '2566', academic: 69, support: 46, total: 115 },
            { year: '2567', academic: 68, support: 45, total: 113 },
            { year: '2568', academic: 67, support: 44, total: 111, type: 'forecast' },
            { year: '2569', academic: 66, support: 44, total: 110, type: 'forecast' }
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
                { label: 'ไทย', count: 108 },
                { label: 'ต่างชาติ', count: 5 }
            ],
            ageGroup: [
                { group: '25-35 ปี', count: 18, color: '#00a651' },
                { group: '36-45 ปี', count: 35, color: '#2E86AB' },
                { group: '46-55 ปี', count: 42, color: '#C5A028' },
                { group: '56-65 ปี', count: 18, color: '#A23B72' }
            ],
            retirementIn5Years: 12
        },

        // อัตราส่วนนักศึกษาต่ออาจารย์
        studentFacultyRatio: [
            { year: '2564', ratio: 19.2 },
            { year: '2565', ratio: 20.1 },
            { year: '2566', ratio: 21.5 },
            { year: '2567', ratio: 23.4 },
            { year: '2568', ratio: 24.1, type: 'forecast' }
        ]
    }
};

export default hrData;
