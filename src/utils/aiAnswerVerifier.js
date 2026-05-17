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
    const cleaned = stripNonEvidenceText(text);
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

function warningText(unsupportedNumbers) {
    const listed = unsupportedNumbers.slice(0, 6).join(', ');
    return `> ${DEFAULT_WARNING_TEXT}${listed ? `: ${listed}` : ''}`;
}

export function verifyAIAnswerAgainstContext(answerText, options = {}) {
    const {
        contextText = '',
        question = '',
        allowExternalNumbers = false,
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

    if (allowExternalNumbers) {
        return {
            text: answer,
            metadata: {
                ...metadata,
                status: 'skipped_external_grounding',
                reason: 'web_search_or_external_grounding_enabled',
            },
        };
    }

    const answerNumbers = extractNumericEvidence(answer);
    const contextNumbers = new Set(extractNumericEvidence(`${question || ''}\n${contextText || ''}`));
    const unsupportedNumbers = answerNumbers
        .filter(value => !shouldIgnoreNumber(value))
        .filter(value => !contextNumbers.has(value))
        .slice(0, maxUnsupported);

    metadata.answerNumberCount = answerNumbers.length;
    metadata.contextNumberCount = contextNumbers.size;
    metadata.unsupportedNumbers = unsupportedNumbers;
    metadata.warningCount = unsupportedNumbers.length ? 1 : 0;
    metadata.status = unsupportedNumbers.length ? 'warning' : 'verified';

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
