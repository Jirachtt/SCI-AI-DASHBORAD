const EXECUTIVE_RECOMMENDATION_PATTERN =
    /ควร|วางแผน|แนะนำ|ทำอะไรต่อ|ผู้บริหาร|คณบดี|ตัดสินใจ|เชิงบริหาร|แนวทาง|รับมือ|แก้ไข|ระวัง/i;

const UNTRUSTED_SOURCE_PATTERN = /fallback|mock|static|demo|sample|reference/i;
const TRUSTED_SOURCE_PATTERN = /official|api|mju|firestore|sync|dashboard|file|upload|csv|excel|xlsx|manual|linked_realtime/i;

export function isExecutiveRecommendationIntent(question) {
    return EXECUTIVE_RECOMMENDATION_PATTERN.test(String(question || '').toLowerCase());
}

export function isTrustedForExecutiveAdvice(meta = {}) {
    if (!meta?.isLive) return false;
    const sourceType = String(meta.sourceType || meta.lastWriteSource || '').trim();
    if (UNTRUSTED_SOURCE_PATTERN.test(sourceType)) return false;
    return TRUSTED_SOURCE_PATTERN.test(sourceType);
}

export function executiveAdviceDatasetStatus(meta = {}, label = 'ข้อมูล') {
    const sourceType = meta?.sourceType || 'fallback';
    const updated = meta?.updatedAt
        ? `, อัปเดต ${meta.updatedAt.toLocaleString('th-TH')}`
        : '';
    return `${label}: ยังไม่พร้อมสำหรับคำแนะนำเชิงบริหารจากสถานการณ์จริง (status=${sourceType}${updated}) ต้อง sync/อัปโหลดข้อมูลจริงก่อน`;
}
