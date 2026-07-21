// Fallback/reference datasets for presentation completeness.
// These are never official records. Replace with approved MJU API/export data
// when available. UI pages can stay presentation-clean while Admin Auto Sync
// and AI guardrails still know the data provenance.

export const FEATURE_COMPLETION_FALLBACK_NOTE =
    'ข้อมูลชุดนี้เป็น demo/generated fallback เพื่อพรีเซน workflow เท่านั้น รอ API หรือไฟล์ export ที่ได้รับอนุญาตจากมหาวิทยาลัยแม่โจ้ก่อนใช้งานจริง';

export const executiveCompensationDemo = [
    {
        position: 'คณบดี',
        scope: 'ผู้บริหารคณะ',
        monthlyBase: 78000,
        positionAllowance: 12000,
        providentFund: 3900,
        taxWithholding: 8200,
        otherDeductions: 1200,
        sourceTrust: 'generated_mock',
    },
    {
        position: 'รองคณบดี',
        scope: 'ผู้บริหารคณะ',
        monthlyBase: 64000,
        positionAllowance: 7500,
        providentFund: 3200,
        taxWithholding: 5900,
        otherDeductions: 900,
        sourceTrust: 'generated_mock',
    },
    {
        position: 'ประธานหลักสูตร',
        scope: 'ผู้บริหารหลักสูตร',
        monthlyBase: 52000,
        positionAllowance: 4500,
        providentFund: 2600,
        taxWithholding: 4100,
        otherDeductions: 700,
        sourceTrust: 'generated_mock',
    },
].map(row => {
    const grossMonthly = row.monthlyBase + row.positionAllowance;
    const totalDeductions = row.providentFund + row.taxWithholding + row.otherDeductions;
    return {
        ...row,
        grossMonthly,
        totalDeductions,
        netEstimate: grossMonthly - totalDeductions,
        sourceLabel: 'Demo payroll structure - waiting for authorized HR/Payroll export',
    };
});

export function getExecutiveCompensationSummary(rows = executiveCompensationDemo) {
    const totalGross = rows.reduce((sum, row) => sum + Number(row.grossMonthly || 0), 0);
    const totalDeductions = rows.reduce((sum, row) => sum + Number(row.totalDeductions || 0), 0);
    const isUploaded = rows.length > 0 && rows.every(row => row.sourceTrust === 'uploaded_file');
    return {
        positions: rows.length,
        totalGross,
        totalDeductions,
        netEstimate: totalGross - totalDeductions,
        sourceTrust: isUploaded ? 'uploaded_file' : 'generated_mock',
        sourceLabel: isUploaded ? 'Authorized HR/Payroll uploaded file' : 'Demo payroll structure - not official salary data',
        note: isUploaded ? '' : FEATURE_COMPLETION_FALLBACK_NOTE,
    };
}

function tuitionAmountForStudent(student = {}) {
    const level = String(student.level || '').toLowerCase();
    if (/เอก|doctoral|phd/.test(level)) return 45000;
    if (/โท|master/.test(level)) return 38000;
    return 15000 + ((Number(student.year) || 1) % 3) * 1500;
}

function paymentStatusForIndex(index) {
    if (index % 13 === 0) return 'overdue';
    if (index % 7 === 0) return 'late';
    return 'paid';
}

export function buildStudentPaymentLedgerDemo(students = [], { limit = 80 } = {}) {
    const rows = (Array.isArray(students) ? students : []).slice(0, limit);
    return rows.map((student, index) => {
        const status = paymentStatusForIndex(index + 1);
        const feeAmount = tuitionAmountForStudent(student);
        const remaining = status === 'paid' || status === 'late' ? 0 : feeAmount;
        return {
            studentId: student.id || `SCI-DEMO-${String(index + 1).padStart(4, '0')}`,
            displayName: `นักศึกษา ${String(student.id || '').slice(-4) || String(index + 1).padStart(4, '0')}`,
            major: student.major || 'ไม่ระบุสาขา',
            year: student.year || '-',
            academicYear: 2569,
            semester: '2/2569',
            feeAmount,
            paidAmount: feeAmount - remaining,
            remaining,
            status,
            statusLabel: status === 'overdue' ? 'ค้างชำระ' : status === 'late' ? 'จ่ายล่าช้า' : 'ชำระแล้ว',
            dueDate: '2569-12-15',
            paidAt: status === 'paid' ? '2569-12-02' : status === 'late' ? '2569-12-26' : '',
            sourceTrust: 'generated_mock',
            sourceLabel: 'Generated payment ledger demo - waiting for MJU Reg/Finance export',
        };
    });
}

export function summarizeStudentPaymentLedgerDemo(rows = []) {
    const isUploaded = rows.length > 0 && rows.every(row => row.sourceTrust === 'uploaded_file');
    const summary = rows.reduce((acc, row) => {
        acc.totalRows += 1;
        acc.totalFee += Number(row.feeAmount || 0);
        acc.totalPaid += Number(row.paidAmount || 0);
        acc.totalRemaining += Number(row.remaining || 0);
        acc[row.status] = (acc[row.status] || 0) + 1;
        return acc;
    }, {
        totalRows: 0,
        totalFee: 0,
        totalPaid: 0,
        totalRemaining: 0,
        paid: 0,
        late: 0,
        overdue: 0,
        sourceTrust: isUploaded ? 'uploaded_file' : 'generated_mock',
        sourceLabel: isUploaded ? 'Authorized Finance/Reg uploaded file' : 'Generated payment ledger demo - not official finance data',
    });
    summary.note = isUploaded ? '' : FEATURE_COMPLETION_FALLBACK_NOTE;
    return summary;
}

export const studentAwardRecordsDemo = [
    {
        year: 2569,
        studentCode: 'SCI-AWARD-001',
        displayName: 'นักศึกษาตัวอย่าง 001',
        major: 'วิทยาการคอมพิวเตอร์',
        award: 'ผลงานนวัตกรรมซอฟต์แวร์ดีเด่นระดับคณะ',
        category: 'นวัตกรรม/เทคโนโลยี',
        level: 'คณะ',
        source: 'Demo student award register - waiting for Student Affairs export',
        sourceTrust: 'generated_mock',
    },
    {
        year: 2569,
        studentCode: 'SCI-AWARD-002',
        displayName: 'นักศึกษาตัวอย่าง 002',
        major: 'เคมี',
        award: 'รางวัลนำเสนอผลงานวิจัยนักศึกษาระดับดี',
        category: 'วิจัย',
        level: 'มหาวิทยาลัย',
        source: 'Demo student award register - waiting for Student Affairs export',
        sourceTrust: 'generated_mock',
    },
    {
        year: 2569,
        studentCode: 'SCI-AWARD-003',
        displayName: 'นักศึกษาตัวอย่าง 003',
        major: 'เทคโนโลยีชีวภาพ',
        award: 'รางวัลกิจกรรมจิตอาสาและความเป็นผู้นำ',
        category: 'กิจกรรม/ภาวะผู้นำ',
        level: 'คณะ',
        source: 'Demo student award register - waiting for Student Affairs export',
        sourceTrust: 'generated_mock',
    },
];

export const populationForecastReference = {
    sourceTrust: 'generated_mock',
    sourceLabel: 'Population scenario demo - waiting for official NESDC/NSO feed',
    note: FEATURE_COMPLETION_FALLBACK_NOTE,
    scenario: [
        { year: 2570, youthPopulationIndex: 98, expectedScienceDemandIndex: 96, riskLevel: 'medium' },
        { year: 2571, youthPopulationIndex: 96, expectedScienceDemandIndex: 94, riskLevel: 'medium' },
        { year: 2572, youthPopulationIndex: 94, expectedScienceDemandIndex: 91, riskLevel: 'high' },
        { year: 2573, youthPopulationIndex: 92, expectedScienceDemandIndex: 89, riskLevel: 'high' },
    ],
    executiveUse: [
        'ใช้ดูทิศทางเชิงสถานการณ์เท่านั้น ไม่ใช่ตัวเลขคาดการณ์ทางการ',
        'เมื่อได้ feed ประชากรจริง ให้แทน youthPopulationIndex และ recalibrate demand model',
        'เชื่อมกับ TCAS funnel เพื่อแยกผลกระทบจากประชากรกับจุดแข็ง/จุดอ่อนของหลักสูตร',
    ],
};

export const featureCompletionDataSummary = [
    {
        feature: 'ยอดรวมนักศึกษา / Dashboard aggregate',
        currentSource: 'MJU Dashboard sync + Firestore cache',
        status: 'real_or_synced',
        displayStatus: 'ข้อมูลจริงเมื่อกด Sync ล่าสุด',
        owner: 'MJU Dashboard public data',
        usedIn: 'Overview, Student Stats, AI aggregate, Export',
    },
    {
        feature: 'Overview: รายวิชา / GPA / สำเร็จการศึกษา',
        currentSource: 'MJU Dashboard, MJU Reg และชุดข้อมูลการศึกษาที่มีอยู่ในระบบ',
        status: 'approved_reference',
        displayStatus: 'ใช้ค่าที่ Sync ก่อน และใช้ชุดข้อมูลในระบบเมื่อ endpoint ต้นทางยังไม่พร้อม',
        owner: 'MJU Dashboard / Reg / ข้อมูลคณะวิทยาศาสตร์',
        usedIn: 'Overview, AI aggregate, Export',
    },
    {
        feature: 'รายชื่อนักศึกษา / GPA รายคน',
        currentSource: 'Generated roster aligned to latest synced total, unless uploaded roster exists',
        status: 'generated_until_upload',
        displayStatus: 'ยังไม่ใช่รายชื่อจริงจนกว่าจะอัปโหลด Reg/คณะ',
        owner: 'รอ Reg export/API หรือไฟล์คณะ',
        usedIn: 'Student List, GPA lookup, Alert Center',
    },
    {
        feature: 'TCAS / แผนรับ / รอบถัดไป',
        currentSource: 'Official/reference files in system + TCAS page dataset',
        status: 'approved_reference',
        displayStatus: 'ข้อมูลอ้างอิงในระบบ ใช้วิเคราะห์เชิงทิศทางได้',
        owner: 'Admissions/Reg export + planning files',
        usedIn: 'TCAS Planning, AI, Export',
    },
    {
        feature: 'งบประมาณ / รายรับรายจ่าย / KPI',
        currentSource: 'Excel files provided by faculty',
        status: 'file_extract',
        displayStatus: 'ข้อมูลจากไฟล์ที่ได้รับมา',
        owner: 'ไฟล์ประมาณการ/แผน/คำรับรอง',
        usedIn: 'Budget, Financial, Strategic, AI',
    },
    {
        feature: 'ค่าธรรมเนียมรายคน / ค้างชำระ / วันที่ชำระ',
        currentSource: 'Workflow data generated from current roster shape',
        status: 'generated_until_upload',
        displayStatus: 'รอ Reg/Finance รายคน',
        owner: 'รอ Finance/Reg export/API',
        usedIn: 'Financial, Export, AI',
    },
    {
        feature: 'ข้อมูลเงินเดือนผู้บริหาร / รายการหัก',
        currentSource: 'Position-level workflow structure',
        status: 'generated_until_upload',
        displayStatus: 'รอ HR/Payroll ที่ได้รับอนุญาต',
        owner: 'รอ HR/Payroll export/API',
        usedIn: 'HR, Export, AI',
    },
    {
        feature: 'รางวัลนักศึกษา',
        currentSource: 'Student award workflow structure',
        status: 'generated_until_upload',
        displayStatus: 'รอไฟล์กิจการนักศึกษาจริง',
        owner: 'รอ Student Affairs export/API',
        usedIn: 'Student Stats, Export, AI',
    },
    {
        feature: 'พยากรณ์จากประชากรประเทศ',
        currentSource: 'Scenario planning structure',
        status: 'generated_until_feed',
        displayStatus: 'รอ feed ประชากรทางการ',
        owner: 'รอ NSO/NESDC หรือแหล่งประชากรที่อนุมัติ',
        usedIn: 'Student Stats, TCAS strategy, AI',
    },
    {
        feature: 'รายวิชา / กระจายเกรด',
        currentSource: 'Course analytics dataset in system',
        status: 'seed_or_upload',
        displayStatus: 'ใช้ข้อมูลในเว็บก่อน รอ Reg course/grade export เพื่อยืนยัน',
        owner: 'รอ Reg course/grade export/API',
        usedIn: 'Course Analytics, AI, Chart',
    },
];
