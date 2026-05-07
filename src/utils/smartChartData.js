const FALLBACK_SOURCE_PATTERN = /fallback|mock|static|demo|sample/i;

export function smartNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
}

export function getValueStatus(value, meta = {}) {
    const numberValue = smartNumber(value);
    if (numberValue === null) return 'missing';

    const sourceType = String(meta?.sourceType || meta?.lastWriteSource || '');
    if (!meta?.isLive && FALLBACK_SOURCE_PATTERN.test(sourceType || 'fallback')) return 'fallback';
    if (numberValue === 0) return 'zero';
    return 'actual';
}

export function buildSmartRows(rows = [], { labelKey = 'label', valueKey = 'value', meta = {} } = {}) {
    return (Array.isArray(rows) ? rows : []).map(row => {
        const value = smartNumber(row?.[valueKey]);
        const valueStatus = getValueStatus(row?.[valueKey], meta);
        return {
            ...row,
            label: row?.[labelKey] ?? row?.label ?? '',
            value,
            valueStatus,
            isMissing: valueStatus === 'missing',
            isZero: valueStatus === 'zero',
            isFallback: valueStatus === 'fallback',
            isChartable: valueStatus !== 'missing' && value !== null && value > 0,
        };
    });
}

export function summarizeSmartRows(rows = []) {
    const values = rows.map(row => smartNumber(row?.value)).filter(value => value !== null && value > 0);
    const total = values.reduce((sum, value) => sum + value, 0);
    const max = values.length ? Math.max(...values) : 0;
    const dominantRatio = total ? max / total : 0;

    return {
        total,
        max,
        dominantRatio,
        hasOnlyOnePositive: values.length === 1,
        hasNoChartableData: values.length === 0,
        isDominatedByOneSlice: dominantRatio >= 0.9,
        missingCount: rows.filter(row => row?.valueStatus === 'missing').length,
        zeroCount: rows.filter(row => row?.valueStatus === 'zero').length,
        fallbackCount: rows.filter(row => row?.valueStatus === 'fallback').length,
    };
}

export function percentOf(value, total, digits = 1) {
    const numberValue = smartNumber(value);
    const numberTotal = smartNumber(total);
    if (numberValue === null || !numberTotal) return '0.0%';
    return `${((numberValue / numberTotal) * 100).toFixed(digits)}%`;
}

export function getDatasetQuality(meta = {}, { calculated = false } = {}) {
    const sourceType = String(meta?.sourceType || 'fallback');
    if (calculated) return 'calculated';
    if (meta?.isLive) return 'actual';
    if (FALLBACK_SOURCE_PATTERN.test(sourceType)) return 'fallback';
    return 'missing';
}

export function getDatasetQualityText(meta = {}, { calculated = false } = {}) {
    const quality = getDatasetQuality(meta, { calculated });
    if (quality === 'calculated') return 'คำนวณจากข้อมูลนักศึกษาปัจจุบัน';
    if (quality === 'actual') return 'อิงข้อมูล live/realtime ที่ sync เข้าระบบ';
    if (quality === 'fallback') return 'ข้อมูลสำรอง รอ sync หรืออัปโหลดข้อมูลจริง';
    return 'ยังไม่มีข้อมูลจริงในระบบ';
}

export function getDatasetQualityForAI(id, label, meta = {}, { calculated = false } = {}) {
    const quality = getDatasetQuality(meta, { calculated });
    const updated = meta?.updatedAt ? `, updated=${meta.updatedAt.toLocaleString('th-TH')}` : '';
    const source = meta?.sourceUrl ? `, source=${meta.sourceUrl}` : '';
    return `${id} (${label}): quality=${quality}, sourceType=${meta?.sourceType || 'fallback'}${updated}${source}`;
}
