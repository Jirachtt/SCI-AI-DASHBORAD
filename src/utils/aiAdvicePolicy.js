const EXECUTIVE_RECOMMENDATION_PATTERN =
    /ควร|วางแผน|แนะนำ|ทำอะไรต่อ|ผู้บริหาร|คณบดี|ตัดสินใจ|เชิงบริหาร|แนวทาง|รับมือ|แก้ไข|ระวัง/i;

const ANALYTICAL_REASONING_PATTERN =
    /พยากรณ์|คาดการณ์|ประมาณการ|แนวโน้ม|วิเคราะห์|เพราะอะไร|ทำไม|อย่างไร|ควร|แนะนำ|เสี่ยง|ความเสี่ยง|เปรียบเทียบ|สรุปเชิงบริหาร|ตัดสินใจ|forecast|predict|projection|trend|analy[sz]e|analysis|why|how|recommend|risk|compare|scenario|confidence/i;

const BLOCKED_SOURCE_PATTERN = /mock|demo|sample|generated/i;
const REFERENCE_SOURCE_PATTERN = /fallback|static|reference/i;
const TRUSTED_SOURCE_PATTERN = /official|api|mju|firestore|sync|dashboard|file|upload|csv|excel|xlsx|manual|linked_realtime/i;
const APPROVED_REFERENCE_DATASETS = new Set(['tcas_admissions']);

export function isExecutiveRecommendationIntent(question) {
    return EXECUTIVE_RECOMMENDATION_PATTERN.test(String(question || '').toLowerCase());
}

export function isAnalyticalReasoningIntent(question) {
    const text = String(question || '').toLowerCase();
    return isExecutiveRecommendationIntent(text) || ANALYTICAL_REASONING_PATTERN.test(text);
}

export function isApprovedReferenceForExecutiveAdvice(meta = {}, options = {}) {
    const datasetId = String(options.datasetId || meta.id || '').trim();
    const sourceType = String(meta.sourceType || meta.lastWriteSource || '').trim();
    if (!APPROVED_REFERENCE_DATASETS.has(datasetId)) return false;
    if (BLOCKED_SOURCE_PATTERN.test(sourceType)) return false;
    return true;
}

export function getExecutiveAdviceTrustLevel(meta = {}, options = {}) {
    const sourceType = String(meta.sourceType || meta.lastWriteSource || '').trim();
    if (BLOCKED_SOURCE_PATTERN.test(sourceType)) return 'untrusted_demo';

    if (meta?.isLive && TRUSTED_SOURCE_PATTERN.test(sourceType)) {
        return 'live_official';
    }

    if (isApprovedReferenceForExecutiveAdvice(meta, options)) {
        return 'approved_reference';
    }

    if (REFERENCE_SOURCE_PATTERN.test(sourceType)) return 'untrusted_demo';
    return TRUSTED_SOURCE_PATTERN.test(sourceType) ? 'approved_reference' : 'untrusted_demo';
}

export function isTrustedForExecutiveAdvice(meta = {}, options = {}) {
    const level = getExecutiveAdviceTrustLevel(meta, options);
    return level === 'live_official' || level === 'approved_reference';
}

export function executiveAdviceDatasetStatus(meta = {}, label = 'ข้อมูล', options = {}) {
    const sourceType = meta?.sourceType || 'fallback';
    const updated = meta?.updatedAt
        ? `, อัปเดต ${meta.updatedAt.toLocaleString('th-TH')}`
        : '';
    const trustLevel = getExecutiveAdviceTrustLevel(meta, options);
    if (trustLevel === 'approved_reference') {
        return `${label}: ใช้เป็นข้อมูลอ้างอิงสำหรับคำแนะนำเชิงทิศทางได้ (status=${sourceType}${updated}) แต่ต้องระบุข้อจำกัดว่ารอข้อมูล live/API เพื่อยืนยัน`;
    }
    return `${label}: ยังไม่พร้อมสำหรับคำแนะนำเชิงบริหารจากสถานการณ์จริง (status=${sourceType}${updated}) ต้อง sync/อัปโหลดข้อมูลจริงก่อน`;
}
