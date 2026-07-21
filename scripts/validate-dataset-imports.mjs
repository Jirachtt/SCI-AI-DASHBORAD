import { createServer } from 'vite';

const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
});

const cases = [
    {
        type: 'tcas_history',
        rows: [{ ปีการศึกษา: '2565', ผู้สมัคร: '100', ผ่านคัดเลือก: '70', รายงานตัว: '55', คงอยู่: '50', ลาออก: '5' }],
        base: { round3Plan2569: [], fiveYearTrend: [] },
        assert: result => result.payload.fiveYearTrend[0].retentionRate === 90.9,
    },
    {
        type: 'tcas_plan',
        rows: [{ สาขาวิชา: 'วิทยาการคอมพิวเตอร์', แผนรับ: '60', 'GPAX ขั้นต่ำ': '2.75' }],
        base: { round3Plan2569: [], fiveYearTrend: [] },
        assert: result => result.payload.round3Plan2569[0].plan === 60,
    },
    {
        type: 'course_grades',
        rows: [{ รหัสวิชา: 'CS101', ชื่อวิชา: 'Programming', ภาคเรียน: '1/2569', A: '10', 'B+': '8', B: '5', C: '2', F: '1' }],
        base: { coursePlanByYear: [], gradeDistributions: [] },
        assert: result => result.payload.gradeDistributions[0].enrolled === 26,
    },
    {
        type: 'student_activities',
        rows: [{ ชื่อกิจกรรม: 'Science Day', ประเภท: 'วิชาการ', วันที่เริ่ม: '21/07/2026', ชั่วโมง: '4', ความจุ: '100', ลงทะเบียนแล้ว: '80' }],
        base: { activityHours: {}, behaviorScore: {} },
        assert: result => result.payload.scienceActivities[0].startDate === '2026-07-21',
    },
    {
        type: 'graduation_history',
        rows: [{ ปีการศึกษา: '2568', ผู้มีสิทธิ์จบ: '220', สำเร็จการศึกษา: '198', 'GPA เฉลี่ย': '3.05' }],
        base: { history: [] },
        assert: result => result.payload.history[0].rate === 90,
    },
    {
        type: 'student_awards',
        rows: [{ ปีการศึกษา: '2569', รหัสนักศึกษา: '6500000001', 'ชื่อ-นามสกุล': 'ผู้ทดสอบ', สาขาวิชา: 'เคมี', รางวัล: 'รางวัลวิจัย', ประเภท: 'วิจัย', ระดับ: 'มหาวิทยาลัย', แหล่งที่มา: 'กิจการนักศึกษา' }],
        base: { current: {}, byFaculty: [] },
        assert: result => result.payload.studentAwards[0].sourceTrust === 'uploaded_file',
    },
    {
        type: 'population_forecast',
        rows: [{ ปีการศึกษา: '2570', ดัชนีประชากรวัยเรียน: '98', ดัชนีความต้องการคณะวิทยาศาสตร์: '96', ระดับความเสี่ยง: 'medium', แหล่งที่มา: 'NSO' }],
        base: { current: {}, byFaculty: [] },
        assert: result => result.payload.populationForecast.scenario[0].expectedScienceDemandIndex === 96,
    },
    {
        type: 'executive_compensation',
        rows: [{ ตำแหน่ง: 'คณบดี', ขอบเขต: 'คณะวิทยาศาสตร์', ฐานเงินเดือน: '78,000', เงินประจำตำแหน่ง: '12,000', กองทุนสำรองเลี้ยงชีพ: '3,900', 'ภาษีหัก ณ ที่จ่าย': '8,200', รายการหักอื่น: '1,200' }],
        base: { scienceFaculty: {} },
        assert: result => result.payload.executiveCompensation[0].netEstimate === 76700,
    },
    {
        type: 'student_payments',
        rows: [{ รหัสนักศึกษา: '6500000001', สาขาวิชา: 'เคมี', ชั้นปี: '4', ปีการศึกษา: '2569', ภาคเรียน: '2/2569', ค่าธรรมเนียม: '15,000', ชำระแล้ว: '15,000', คงค้าง: '0', กำหนดชำระ: '15/12/2569', วันที่ชำระจริง: '26/12/2569' }],
        base: { tuitionStatus: {}, facultyBudget: {} },
        assert: result => result.payload.studentPayments[0].status === 'late'
            && result.payload.facultyBudget != null,
    },
];

let failures = 0;

try {
    const { buildDashboardDatasetImport } = await server.ssrLoadModule('/src/services/dashboardDatasetImportService.js');
    for (const testCase of cases) {
        try {
            const result = buildDashboardDatasetImport({
                importType: testCase.type,
                parsed: {
                    rows: testCase.rows,
                    headers: Object.keys(testCase.rows[0]),
                    qualityWarnings: [],
                },
                currentData: testCase.base,
                fileName: 'authorized-test.xlsx',
            });
            if (result.rowCount !== 1 || !testCase.assert(result)) throw new Error('normalized payload assertion failed');
            console.log(`PASS ${testCase.type}`);
        } catch (error) {
            failures += 1;
            console.error(`FAIL ${testCase.type}: ${error.message}`);
        }
    }

    try {
        buildDashboardDatasetImport({
            importType: 'tcas_history',
            parsed: { rows: [{ หมายเหตุ: 'ไม่มีปีและตัวเลข' }], headers: ['หมายเหตุ'] },
            currentData: { round3Plan2569: [], fiveYearTrend: [] },
            fileName: 'invalid.csv',
        });
        failures += 1;
        console.error('FAIL invalid schema was accepted');
    } catch {
        console.log('PASS invalid schema rejected');
    }

    try {
        buildDashboardDatasetImport({
            importType: 'student_payments',
            parsed: { rows: cases.at(-1).rows, headers: Object.keys(cases.at(-1).rows[0]) },
            fileName: 'unsafe-no-current-data.xlsx',
        });
        failures += 1;
        console.error('FAIL import without current dataset was accepted');
    } catch {
        console.log('PASS import without current dataset rejected');
    }
} finally {
    await server.close();
}

if (failures > 0) process.exitCode = 1;
else console.log(`Dataset import audit passed: ${cases.length} formats + schema/preserve guards.`);
