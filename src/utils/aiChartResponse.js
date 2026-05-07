const STRUCTURED_CHART_ERROR = 'รูปแบบกราฟไม่สมบูรณ์ กรุณาลองสั่งสร้างกราฟใหม่';

function normalizeStringArray(value) {
    if (!Array.isArray(value)) return [];
    return value
        .map(item => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 8);
}

function stripCompleteFence(text) {
    const raw = String(text || '').trim();
    const fenced = raw.match(/^`{1,3}(?:json|json_chart)?\s*([\s\S]*?)\s*`{1,3}$/i);
    return fenced ? fenced[1].trim() : raw;
}

function findBalancedJsonEnd(text, start, openChar, closeChar) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i += 1) {
        const char = text[i];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (char === '\\') {
            escaped = true;
            continue;
        }
        if (char === '"') {
            inString = !inString;
            continue;
        }
        if (inString) continue;
        if (char === openChar) depth += 1;
        if (char === closeChar) {
            depth -= 1;
            if (depth === 0) return i + 1;
        }
    }
    return -1;
}

function balancedJsonCandidate(text) {
    const raw = String(text || '').trim();
    const objectStart = raw.indexOf('{');
    const arrayStart = raw.indexOf('[');
    const starts = [
        objectStart === -1 ? null : { index: objectStart, open: '{', close: '}' },
        arrayStart === -1 ? null : { index: arrayStart, open: '[', close: ']' },
    ]
        .filter(Boolean)
        .sort((a, b) => a.index - b.index);

    for (const start of starts) {
        const end = findBalancedJsonEnd(raw, start.index, start.open, start.close);
        if (end > start.index) return raw.slice(start.index, end);
    }
    return '';
}

export function parseJsonLikeText(value, depth = 0) {
    if (value && typeof value === 'object') return value;
    const raw = String(value || '').trim();
    if (!raw || depth > 3) return null;

    const withoutFence = stripCompleteFence(raw);
    const candidates = [
        raw,
        withoutFence,
        balancedJsonCandidate(raw),
        balancedJsonCandidate(withoutFence),
    ].filter(Boolean);

    for (const candidate of [...new Set(candidates)]) {
        try {
            const parsed = JSON.parse(candidate);
            if (typeof parsed === 'string') {
                const nested = parseJsonLikeText(parsed, depth + 1);
                if (nested) return nested;
            }
            return parsed;
        } catch {
            // Try the next candidate.
        }
    }

    return null;
}

export function isValidChartConfig(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (!value.chartType || typeof value.chartType !== 'string') return false;
    const data = value.data;
    if (!data || typeof data !== 'object') return false;
    if (!Array.isArray(data.labels)) return false;
    if (!Array.isArray(data.datasets) || data.datasets.length === 0) return false;
    return data.datasets.every(dataset => dataset && Array.isArray(dataset.data));
}

export function parseChartConfigValue(value) {
    if (!value) return null;
    const parsed = parseJsonLikeText(value);
    if (isValidChartConfig(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') {
        return parseChartConfigValue(parsed.chartJson || parsed.chart || parsed.chartConfig);
    }
    return null;
}

export function normalizeStructuredAIChartResponse(value) {
    const parsed = parseJsonLikeText(value);
    const isStructured = Boolean(
        parsed
        && typeof parsed === 'object'
        && !Array.isArray(parsed)
        && (
            Object.prototype.hasOwnProperty.call(parsed, 'answer')
            || Object.prototype.hasOwnProperty.call(parsed, 'chartJson')
            || Object.prototype.hasOwnProperty.call(parsed, 'sources')
            || Object.prototype.hasOwnProperty.call(parsed, 'actions')
        )
    );

    if (!isStructured) return { isStructured: false };

    const rawChart = parsed.chartJson ?? parsed.chart ?? parsed.chartConfig ?? '';
    const hasChartValue = rawChart != null && String(rawChart).trim() !== '';
    const chart = parseChartConfigValue(rawChart);

    return {
        isStructured: true,
        answer: String(parsed.answer || '').trim(),
        chart,
        hadInvalidChart: Boolean(hasChartValue && !chart),
        sources: normalizeStringArray(parsed.sources),
        actions: normalizeStringArray(parsed.actions),
    };
}

export function structuredAIResponseToMarkdown(normalized, options = {}) {
    if (!normalized?.isStructured) return null;
    const {
        includeChartBlock = true,
        includeInvalidChartMessage = false,
    } = options;

    const sections = [];
    if (normalized.answer) sections.push(normalized.answer);
    if (normalized.chart && includeChartBlock) {
        sections.push(`\`\`\`json_chart\n${JSON.stringify(normalized.chart)}\n\`\`\``);
    } else if (normalized.hadInvalidChart && includeInvalidChartMessage) {
        sections.push(STRUCTURED_CHART_ERROR);
    }

    if (normalized.sources.length) {
        sections.push(`**แหล่งข้อมูลที่ใช้:**\n${normalized.sources.map(source => `- ${source}`).join('\n')}`);
    }
    if (normalized.actions.length) {
        sections.push(`**ต่อยอดได้:**\n${normalized.actions.map(action => `- ${action}`).join('\n')}`);
    }

    return sections.join('\n\n').trim();
}

export function coerceStructuredAIResponseMarkdown(value, options = {}) {
    const normalized = normalizeStructuredAIChartResponse(value);
    if (!normalized.isStructured) return null;
    return structuredAIResponseToMarkdown(normalized, options) || '';
}

export function stripRawStructuredAIResponseText(text, fallback = STRUCTURED_CHART_ERROR) {
    const raw = String(text || '');
    if (!/"(?:answer|chartJson|sources|actions)"\s*:/.test(raw)) return raw;

    let out = raw;
    let removed = false;
    let searchIndex = 0;
    while (searchIndex < out.length) {
        const braceIndex = out.indexOf('{', searchIndex);
        if (braceIndex === -1) break;
        const end = findBalancedJsonEnd(out, braceIndex, '{', '}');
        if (end <= braceIndex) break;
        const candidate = out.slice(braceIndex, end);
        if (/"answer"\s*:/.test(candidate) && /"(?:chartJson|sources|actions)"\s*:/.test(candidate)) {
            out = out.slice(0, braceIndex) + out.slice(end);
            removed = true;
            searchIndex = braceIndex;
        } else {
            searchIndex = end;
        }
    }

    out = out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    return removed && !out ? fallback : out;
}
