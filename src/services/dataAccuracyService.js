import {
    DASHBOARD_DATASETS,
    ensureDashboardLiveData,
    getDashboardDatasetMetaSync,
    getDashboardDatasetSync,
    onDashboardLiveDataChange,
} from './dashboardLiveDataService';
import {
    ensureStudentList,
    getStudentDataSourceStatus,
    getStudentListMeta,
    getStudentListSync,
    isLiveData,
    onStudentDataChange,
} from './studentDataService';
import { APP_NAME_EN } from '../config/appBrand';

const SCIENCE_FACULTY_MATCH = 'วิทยาศาสตร์';

const LEVELS = [
    { key: 'bachelor', label: 'ปริญญาตรี' },
    { key: 'master', label: 'ปริญญาโท' },
    { key: 'doctoral', label: 'ปริญญาเอก' },
    { key: 'certificate', label: 'ประกาศนียบัตร' },
];

let _studentMetaCache = null;

function toNumber(value, fallback = 0) {
    if (value == null || value === '') return fallback;
    const n = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(n) ? n : fallback;
}

function readDate(value) {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    if (value.seconds) return new Date(value.seconds * 1000);
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateTime(value) {
    const d = readDate(value);
    if (!d) return '-';
    return d.toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

const DATASET_TRUST_STATUSES = {
    officialLive: {
        key: 'official_live',
        label: 'Official Live',
        shortLabel: 'Official',
        tone: 'success',
        description: 'Synced from an official MJU Dashboard/API source.',
        isReady: true,
    },
    uploadedFile: {
        key: 'uploaded_file',
        label: 'Uploaded File',
        shortLabel: 'File',
        tone: 'info',
        description: 'Using an uploaded CSV/Excel file as the current source.',
        isReady: true,
    },
    firestoreLive: {
        key: 'firestore_live',
        label: 'Firestore Live',
        shortLabel: 'Live',
        tone: 'success',
        description: 'Using shared Firestore realtime data.',
        isReady: true,
    },
    mjuApiNeeded: {
        key: 'mju_api_needed',
        label: 'MJU API Needed',
        shortLabel: 'Needs API',
        tone: 'warning',
        description: 'Needs an official MJU endpoint/token before it can be treated as live.',
        isReady: false,
    },
    uploadedFileNeeded: {
        key: 'uploaded_file_needed',
        label: 'Official File Needed',
        shortLabel: 'Needs File',
        tone: 'warning',
        description: 'Needs the official CSV/Excel source file before presentation use.',
        isReady: false,
    },
    referenceFallback: {
        key: 'reference_fallback',
        label: 'Reference/Fallback',
        shortLabel: 'Reference',
        tone: 'warning',
        description: 'Reference cache only; verify with MJU source before relying on it.',
        isReady: false,
    },
};

function isUploadedFileSource(sourceType = '') {
    return /file|upload|csv|excel|xlsx|manual/i.test(String(sourceType || ''));
}

function isOfficialSource(sourceType = '') {
    return /mju|api|sync|official|dashboard/i.test(String(sourceType || ''));
}

export function getDatasetTrustStatus(itemOrId, meta = null) {
    const item = typeof itemOrId === 'string'
        ? DASHBOARD_DATASETS.find(dataset => dataset.id === itemOrId)
        : itemOrId;
    const resolvedMeta = meta || getDashboardDatasetMetaSync(item?.id);
    const sourceType = resolvedMeta?.sourceType || '';
    const isLive = Boolean(resolvedMeta?.isLive);

    if (isLive && (item?.syncMode === 'file' || isUploadedFileSource(sourceType))) {
        return DATASET_TRUST_STATUSES.uploadedFile;
    }
    if (isLive && (item?.syncMode === 'public' || isOfficialSource(sourceType))) {
        return DATASET_TRUST_STATUSES.officialLive;
    }
    if (isLive) return DATASET_TRUST_STATUSES.firestoreLive;
    if (item?.syncMode === 'api') return DATASET_TRUST_STATUSES.mjuApiNeeded;
    if (item?.syncMode === 'file') return DATASET_TRUST_STATUSES.uploadedFileNeeded;
    return DATASET_TRUST_STATUSES.referenceFallback;
}

function emptyLevelCounts() {
    return LEVELS.reduce((acc, item) => ({ ...acc, [item.key]: 0 }), {});
}

function levelKeyFromText(value = '') {
    const text = String(value || '').toLowerCase();
    if (/ประกาศ|cert/.test(text)) return 'certificate';
    if (/ปริญญาเอก|เอก|doctoral|phd/.test(text)) return 'doctoral';
    if (/ปริญญาโท|โท|master|msc/.test(text)) return 'master';
    if (/ปริญญาตรี|ตรี|bachelor|bsc/.test(text)) return 'bachelor';
    return 'bachelor';
}

function levelKeyFromStudent(row = {}) {
    return levelKeyFromText(`${row.level || ''} ${row.degree || ''} ${row.degreeLevel || ''}`);
}

function sumLevelCounts(counts = {}) {
    return LEVELS.reduce((sum, item) => sum + toNumber(counts[item.key]), 0);
}

function countsFromLevelRows(rows = []) {
    const counts = emptyLevelCounts();
    if (!Array.isArray(rows)) return counts;
    rows.forEach(row => {
        const key = levelKeyFromText(row?.level || row?.name || row?.label || row?.degree);
        counts[key] += toNumber(row?.count ?? row?.total ?? row?.value);
    });
    return counts;
}

function countsFromStudentRows(rows = []) {
    const counts = emptyLevelCounts();
    rows.forEach(row => {
        counts[levelKeyFromStudent(row)] += 1;
    });
    return counts;
}

function findScienceFacultyRow(rows = []) {
    if (!Array.isArray(rows)) return null;
    return rows.find(row => String(row?.name || row?.faculty || '').includes(SCIENCE_FACULTY_MATCH)) || null;
}

function getOfficialScienceFromStudentStats(data = {}) {
    const science = data?.scienceFaculty || {};
    const facultyRow = findScienceFacultyRow(data?.byFaculty);
    const byLevel = sumLevelCounts(countsFromLevelRows(science.byLevel))
        ? countsFromLevelRows(science.byLevel)
        : {
            ...emptyLevelCounts(),
            bachelor: toNumber(facultyRow?.bachelor),
            master: toNumber(facultyRow?.master),
            doctoral: toNumber(facultyRow?.doctoral),
            certificate: toNumber(facultyRow?.certificate),
        };
    const total = toNumber(science.total, null)
        ?? toNumber(facultyRow?.total, null)
        ?? sumLevelCounts(byLevel);

    return {
        total: Number.isFinite(total) ? total : null,
        byLevel,
        datasetId: 'student_stats',
        sourceLabel: 'MJU Dashboard: Student Statistics',
    };
}

function getOfficialScienceFromDashboardSummary(data = {}) {
    const facultyRow = findScienceFacultyRow(data?.faculties);
    const total = toNumber(facultyRow?.totalStudents ?? facultyRow?.total, null);
    return {
        total: Number.isFinite(total) ? total : null,
        byLevel: countsFromLevelRows(facultyRow?.byLevel || []),
        datasetId: 'dashboard_summary',
        sourceLabel: 'MJU Dashboard: Overview',
    };
}

function getOfficialScienceSnapshot() {
    const studentStats = getOfficialScienceFromStudentStats(getDashboardDatasetSync('student_stats') || {});
    const dashboard = getOfficialScienceFromDashboardSummary(getDashboardDatasetSync('dashboard_summary') || {});
    const official = studentStats.total != null ? studentStats : dashboard;
    const meta = getDashboardDatasetMetaSync(official.datasetId || 'student_stats');
    return {
        ...official,
        meta,
        updatedAt: meta.updatedAt || null,
        sourceUrl: meta.sourceUrl || DASHBOARD_DATASETS.find(item => item.id === official.datasetId)?.source || null,
        isLive: Boolean(meta.isLive),
        sourceType: meta.sourceType || 'fallback',
    };
}

function getStudentRowsSnapshot() {
    const rows = getStudentListSync();
    const sourceStatus = getStudentDataSourceStatus();
    return {
        rows,
        total: Array.isArray(rows) ? rows.length : 0,
        byLevel: countsFromStudentRows(Array.isArray(rows) ? rows : []),
        sourceStatus,
        meta: _studentMetaCache,
        isLive: isLiveData(),
    };
}

function buildLevelDiffs(officialByLevel = {}, localByLevel = {}) {
    return LEVELS.map(level => {
        const official = toNumber(officialByLevel[level.key]);
        const local = toNumber(localByLevel[level.key]);
        return {
            key: level.key,
            label: level.label,
            official,
            local,
            difference: official - local,
        };
    });
}

function getReconcileStatus({ officialTotal, localTotal, officialLive }) {
    if (officialTotal == null) {
        return {
            status: 'no_official_source',
            tone: 'warning',
            label: 'ยังไม่มีแหล่งอ้างอิงทางการ',
        };
    }
    const difference = officialTotal - localTotal;
    if (difference === 0) {
        return {
            status: officialLive ? 'match' : 'match_with_reference_cache',
            tone: officialLive ? 'success' : 'info',
            label: officialLive ? 'ตรงกับแหล่งทางการ' : 'ตรงกับข้อมูลอ้างอิงในระบบ',
        };
    }
    return {
        status: difference > 0 ? 'missing_rows' : 'extra_rows',
        tone: 'warning',
        label: difference > 0 ? 'รายชื่อในระบบน้อยกว่าแหล่งอ้างอิง' : 'รายชื่อในระบบมากกว่าแหล่งอ้างอิง',
    };
}

export async function ensureDataAccuracy() {
    await Promise.all([
        ensureDashboardLiveData(['dashboard_summary', 'student_stats', 'graduation']),
        ensureStudentList(),
    ]);
    try {
        _studentMetaCache = await getStudentListMeta();
    } catch {
        _studentMetaCache = null;
    }
    return getDataAccuracySnapshot();
}

export function getStudentReconciliationSnapshot() {
    const official = getOfficialScienceSnapshot();
    const local = getStudentRowsSnapshot();
    const officialTotal = official.total;
    const localTotal = local.total;
    const difference = officialTotal == null ? null : officialTotal - localTotal;
    const accuracyPercent = officialTotal
        ? Math.min(100, Math.round((localTotal / officialTotal) * 1000) / 10)
        : null;
    const status = getReconcileStatus({
        officialTotal,
        localTotal,
        officialLive: official.isLive,
    });

    return {
        ...status,
        officialTotal,
        localTotal,
        difference,
        accuracyPercent,
        officialByLevel: official.byLevel,
        localByLevel: local.byLevel,
        levelDiffs: buildLevelDiffs(official.byLevel, local.byLevel),
        officialSourceLabel: official.sourceLabel,
        officialSourceUrl: official.sourceUrl,
        officialUpdatedAt: official.updatedAt,
        officialIsLive: official.isLive,
        officialSourceType: official.sourceType,
        studentSourceLabel: local.sourceStatus.label,
        studentSourceMode: local.sourceStatus.mode,
        studentUpdatedAt: local.meta?.updatedAt || null,
        studentFileName: local.meta?.fileName || null,
        studentIsLive: local.isLive,
        recommendation: difference === 0
            ? 'ใช้ยอดนักศึกษาชุดนี้ตอบคำถามและคำนวณต่อได้'
            : difference > 0
                ? `ต้องเติม/อัปโหลดรายชื่ออีก ${Math.abs(difference).toLocaleString('th-TH')} คน เพื่อให้รายชื่อรายบุคคลตรงกับยอดรวม`
                : `ตรวจรายชื่อซ้ำหรือข้อมูลเกิน ${Math.abs(difference).toLocaleString('th-TH')} คน เมื่อเทียบกับยอดอ้างอิง`,
    };
}

export function getStudentUploadQualityPreview(rows = [], extra = {}) {
    const official = getOfficialScienceSnapshot();
    const uploadRows = Array.isArray(rows) ? rows : [];
    const localByLevel = countsFromStudentRows(uploadRows);
    const officialTotal = official.total;
    const localTotal = uploadRows.length;
    const difference = officialTotal == null ? null : officialTotal - localTotal;
    const accuracyPercent = officialTotal
        ? Math.min(100, Math.round((localTotal / officialTotal) * 1000) / 10)
        : null;
    const status = getReconcileStatus({
        officialTotal,
        localTotal,
        officialLive: official.isLive,
    });

    return {
        ...status,
        officialTotal,
        localTotal,
        difference,
        accuracyPercent,
        officialByLevel: official.byLevel,
        localByLevel,
        levelDiffs: buildLevelDiffs(official.byLevel, localByLevel),
        officialSourceLabel: official.sourceLabel,
        officialSourceUrl: official.sourceUrl,
        officialUpdatedAt: official.updatedAt,
        officialIsLive: official.isLive,
        ...extra,
    };
}

export function getDataAccuracySnapshot() {
    const datasets = DASHBOARD_DATASETS.map(item => {
        const meta = getDashboardDatasetMetaSync(item.id);
        const updatedAt = readDate(meta.updatedAt);
        const ageHours = updatedAt ? (Date.now() - updatedAt.getTime()) / 36e5 : null;
        const isFresh = meta.isLive && (ageHours == null || ageHours <= 24);
        const trustStatus = getDatasetTrustStatus(item, meta);
        return {
            id: item.id,
            label: item.label,
            syncMode: item.syncMode,
            source: meta.sourceUrl || item.source,
            sourceType: meta.sourceType || 'fallback',
            isLive: Boolean(meta.isLive),
            isFresh,
            updatedAt,
            updatedText: formatDateTime(updatedAt),
            rowCount: meta.rowCount ?? null,
            trustStatus,
            description: trustStatus.description,
            confidenceLabel: trustStatus.label,
            tone: meta.isLive ? (isFresh ? trustStatus.tone : 'info') : trustStatus.tone,
            statusLabel: meta.isLive && !isFresh ? `${trustStatus.label} (stale)` : trustStatus.label,
        };
    });
    const liveCount = datasets.filter(item => item.isLive).length;
    const freshCount = datasets.filter(item => item.isFresh).length;
    const studentReconcile = getStudentReconciliationSnapshot();
    const studentScore = studentReconcile.accuracyPercent ?? 0;
    const liveScore = Math.round((liveCount / Math.max(1, datasets.length)) * 100);
    const score = Math.round((studentScore * 0.55) + (liveScore * 0.45));

    return {
        score,
        liveCount,
        freshCount,
        totalDatasets: datasets.length,
        datasets,
        studentReconcile,
        generatedAt: new Date(),
    };
}

export function onDataAccuracyChange(callback) {
    const emit = () => callback(getDataAccuracySnapshot());
    const unsubDashboard = onDashboardLiveDataChange(emit);
    const unsubStudents = onStudentDataChange(async () => {
        try {
            _studentMetaCache = await getStudentListMeta();
        } catch {
            _studentMetaCache = null;
        }
        emit();
    });
    return () => {
        unsubDashboard();
        unsubStudents();
    };
}

export function buildStudentAnswerSourceNote() {
    const reconcile = getStudentReconciliationSnapshot();
    const officialText = reconcile.officialTotal == null
        ? 'ยังไม่มี snapshot ทางการจาก MJU Dashboard'
        : `ยอดอ้างอิง MJU Dashboard ${reconcile.officialTotal.toLocaleString('th-TH')} คน`;
    const diffText = reconcile.difference == null
        ? 'ยังเทียบส่วนต่างไม่ได้'
        : reconcile.difference === 0
            ? 'ยอดตรงกัน'
            : `ส่วนต่าง ${Math.abs(reconcile.difference).toLocaleString('th-TH')} คน (${reconcile.difference > 0 ? 'รายชื่อในระบบน้อยกว่า' : 'รายชื่อในระบบมากกว่า'})`;

    return `_แหล่งข้อมูล: รายชื่อในระบบ ${reconcile.localTotal.toLocaleString('th-TH')} คน (${reconcile.studentSourceLabel}); ${officialText}; ${diffText}; อัปเดตล่าสุด ${formatDateTime(reconcile.studentUpdatedAt || reconcile.officialUpdatedAt)}_`;
}

export function appendStudentAnswerSourceNote(text) {
    if (!text) return text;
    return `${text}\n\n${buildStudentAnswerSourceNote()}`;
}

export function buildDataAccuracyContextForAI() {
    const snapshot = getDataAccuracySnapshot();
    const rec = snapshot.studentReconcile;
    const datasetSummary = snapshot.datasets
        .map(item => `${item.id}: ${item.statusLabel}, rows=${item.rowCount ?? '-'}, updated=${item.updatedText}, note=${item.description}`)
        .join('\n');

    return `DATA ACCURACY SNAPSHOT
- overall score: ${snapshot.score}/100
- student official total: ${rec.officialTotal ?? 'unknown'} (${rec.officialSourceLabel}, ${rec.officialIsLive ? 'live' : 'reference/fallback'}, updated=${formatDateTime(rec.officialUpdatedAt)})
- student row list: ${rec.localTotal} (${rec.studentSourceLabel}, updated=${formatDateTime(rec.studentUpdatedAt)})
- student reconcile: ${rec.label}${rec.difference == null ? '' : `, difference=${rec.difference}`}
- rule: ถ้าถามยอดรวมคณะวิทยาศาสตร์ ให้ตอบยอดอ้างอิง MJU Dashboard ก่อน; ถ้าถามรายชื่อ/รายบุคคล ให้ใช้ datasets/students และบอกสถานะ reconcile ถ้ายอดไม่ตรง
- rule: ห้ามเดาตัวเลข ถ้าข้อมูลชุดใดเป็น fallback/reference ให้บอกแหล่งข้อมูลและสถานะ
DATASET HEALTH
${datasetSummary}`;
}

export function buildDataAccuracyReportRows(snapshot = getDataAccuracySnapshot()) {
    const rec = snapshot.studentReconcile;
    const rows = [
        {
            section: 'summary',
            item: 'accuracy_score',
            source: APP_NAME_EN,
            value: snapshot.score,
            status: `${snapshot.liveCount}/${snapshot.totalDatasets} live datasets`,
            updatedAt: formatDateTime(snapshot.generatedAt),
            note: 'คะแนนรวมจากความตรงของรายชื่อนักศึกษาและสถานะ live dataset',
        },
        {
            section: 'student_reconcile',
            item: 'official_total',
            source: rec.officialSourceLabel,
            value: rec.officialTotal ?? '',
            status: rec.officialIsLive ? 'live' : 'reference/fallback',
            updatedAt: formatDateTime(rec.officialUpdatedAt),
            note: rec.officialSourceUrl || '',
        },
        {
            section: 'student_reconcile',
            item: 'student_rows',
            source: rec.studentSourceLabel,
            value: rec.localTotal,
            status: rec.studentIsLive ? 'live' : rec.studentSourceMode,
            updatedAt: formatDateTime(rec.studentUpdatedAt),
            note: rec.studentFileName || 'datasets/students',
        },
        {
            section: 'student_reconcile',
            item: 'difference',
            source: 'official_total - student_rows',
            value: rec.difference ?? '',
            status: rec.label,
            updatedAt: formatDateTime(snapshot.generatedAt),
            note: rec.recommendation,
        },
        ...rec.levelDiffs.map(row => ({
            section: 'student_level_reconcile',
            item: row.label,
            source: 'MJU Dashboard vs datasets/students',
            value: row.difference,
            status: row.difference === 0 ? 'match' : 'mismatch',
            updatedAt: formatDateTime(snapshot.generatedAt),
            note: `official=${row.official}; local=${row.local}`,
        })),
        ...snapshot.datasets.map(item => ({
            section: 'dataset_health',
            item: item.id,
            source: item.source,
            value: item.rowCount ?? '',
            status: item.statusLabel,
            updatedAt: item.updatedText,
            note: item.label,
        })),
    ];
    return rows;
}
