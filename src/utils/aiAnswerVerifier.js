const THAI_DIGITS = new Map([
    ['๐', '0'],
    ['๑', '1'],
    ['๒', '2'],
    ['๓', '3'],
    ['๔', '4'],
    ['๕', '5'],
    ['๖', '6'],
    ['๗', '7'],
    ['๘', '8'],
    ['๙', '9'],
]);

const DEFAULT_WARNING_TEXT = 'หมายเหตุตรวจสอบข้อมูล: พบตัวเลขบางส่วนในคำตอบที่ไม่พบตรงกับบริบทข้อมูลที่ระบบส่งให้ AI รอบนี้ จึงควรตรวจแหล่งข้อมูลหรือกด Sync ก่อนใช้ตัดสินใจ';

function normalizeDigits(value) {
    return String(value || '').replace(/[๐-๙]/g, digit => THAI_DIGITS.get(digit) || digit);
}

function stripNonEvidenceText(text) {
    return normalizeDigits(text)
        .replace(/https?:\/\/\S+/gi, ' ')
        .replace(/```json_chart[\s\S]*?```/gi, ' ')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`[^`]*`/g, ' ');
}

export function normalizeNumericToken(value) {
    const normalized = normalizeDigits(value)
        .replace(/,/g, '')
        .replace(/%/g, '')
        .trim();
    if (!normalized) return '';
    const number = Number(normalized);
    if (!Number.isFinite(number)) return '';
    return Number.isInteger(number) ? String(number) : String(Number(number.toFixed(4)));
}

export function extractNumericEvidence(text) {
    // A hyphen between two numbers is a range separator, not a negative sign
    // (for example 2570-2573 or 10-20). Preserve genuine negatives such as -2.25.
    const cleaned = stripNonEvidenceText(text)
        .replace(/(\d)\s*[-–—]\s*(?=\d)/g, '$1 ');
    const matches = cleaned.match(/[+-]?(?:\d[\d,]*)(?:\.\d+)?%?/g) || [];
    return [...new Set(matches.map(normalizeNumericToken).filter(Boolean))];
}

function isNotableNumber(value) {
    const raw = String(value || '');
    const number = Number(raw);
    if (!Number.isFinite(number)) return false;
    if (raw.includes('.') || Math.abs(number) >= 20) return true;
    return false;
}

function shouldIgnoreNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return true;
    if (!isNotableNumber(value)) return true;
    if (number >= 1900 && number <= 2100) return true;
    if (number >= 2400 && number <= 2600) return true;
    return false;
}

function hasEquivalentYearEvidence(value, contextNumbers) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0 || number > 99) return false;

    const suffix = String(number).padStart(2, '0');
    return [...contextNumbers].some(contextValue => {
        const contextNumber = Number(contextValue);
        if (!Number.isInteger(contextNumber)) return false;
        const isCalendarYear = (contextNumber >= 1900 && contextNumber <= 2199)
            || (contextNumber >= 2400 && contextNumber <= 2699);
        return isCalendarYear && String(contextNumber).endsWith(suffix);
    });
}

function approximatelyEqual(left, right) {
    const a = Number(left);
    const b = Number(right);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    const tolerance = Math.max(0.06, Math.abs(a) * 0.0025);
    return Math.abs(a - b) <= tolerance;
}

function isDerivedFromEvidence(value, answer, contextNumbers) {
    const target = Number(value);
    if (!Number.isFinite(target)) return false;
    const values = [...contextNumbers]
        .map(Number)
        .filter(Number.isFinite)
        .filter(number => Math.abs(number) < 1_000_000_000)
        .slice(0, 180);
    const text = String(answer || '').toLowerCase();
    const mayBePercent = /%|ร้อยละ|เปอร์เซ็นต์|อัตรา|rate/.test(text);
    const mayBeDifference = /เฉลี่ย|average|ส่วนต่าง|ต่างกัน|เพิ่ม|ลด|gap|คงเหลือ|ขาด|เกิน|surplus|deficit/.test(text);

    for (let leftIndex = 0; leftIndex < values.length; leftIndex += 1) {
        const left = values[leftIndex];
        for (let rightIndex = 0; rightIndex < values.length; rightIndex += 1) {
            if (leftIndex === rightIndex) continue;
            const right = values[rightIndex];
            if (mayBePercent && right !== 0 && approximatelyEqual(target, (left / right) * 100)) return true;
            if (mayBeDifference && approximatelyEqual(target, left - right)) return true;
            if (mayBeDifference && approximatelyEqual(target, (left + right) / 2)) return true;
        }
    }
    return false;
}

function warningText(unsupportedNumbers) {
    const listed = unsupportedNumbers.slice(0, 6).join(', ');
    return `> ${DEFAULT_WARNING_TEXT}${listed ? `: ${listed}` : ''}`;
}

export function verifyAIAnswerAgainstContext(answerText, options = {}) {
    const {
        contextText = '',
        question = '',
        allowExternalNumbers = false,
        externalEvidenceText = '',
        maxUnsupported = 6,
    } = options;
    const answer = String(answerText || '').trim();
    const metadata = {
        enabled: true,
        status: 'verified',
        answerNumberCount: 0,
        contextNumberCount: 0,
        unsupportedNumbers: [],
        warningCount: 0,
    };

    if (!answer) return { text: answer, metadata };

    const answerNumbers = extractNumericEvidence(answer);
    const contextNumbers = new Set(extractNumericEvidence(`${question || ''}\n${contextText || ''}\n${externalEvidenceText || ''}`));
    const derivedNumbers = [];
    const unsupportedNumbers = answerNumbers
        .filter(value => !shouldIgnoreNumber(value))
        .filter(value => !contextNumbers.has(value) && !hasEquivalentYearEvidence(value, contextNumbers))
        .filter(value => {
            const derived = isDerivedFromEvidence(value, answer, contextNumbers);
            if (derived) derivedNumbers.push(value);
            return !derived;
        })
        .slice(0, maxUnsupported);

    metadata.answerNumberCount = answerNumbers.length;
    metadata.contextNumberCount = contextNumbers.size;
    metadata.unsupportedNumbers = unsupportedNumbers;
    metadata.derivedNumbers = derivedNumbers;
    metadata.warningCount = unsupportedNumbers.length ? 1 : 0;
    metadata.status = unsupportedNumbers.length
        ? 'warning'
        : allowExternalNumbers && String(externalEvidenceText || '').trim()
            ? 'verified_with_external_grounding'
            : 'verified';
    if (metadata.status === 'verified_with_external_grounding') {
        metadata.reason = 'numbers_matched_local_or_grounded_evidence';
    }

    if (!unsupportedNumbers.length) {
        return { text: answer, metadata };
    }

    if (/หมายเหตุตรวจสอบข้อมูล|ตรวจแหล่งข้อมูล|unsupported/i.test(answer)) {
        return { text: answer, metadata };
    }

    return {
        text: `${answer}\n\n${warningText(unsupportedNumbers)}`.trim(),
        metadata,
    };
}
