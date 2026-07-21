function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isBlankScalar(value) {
    return value == null || (typeof value === 'string' && value.trim() === '');
}

function pathFor(parent, key) {
    return parent ? `${parent}.${key}` : String(key);
}

function noteFallback(target, path) {
    if (path) target.add(path);
}

export function mergeDatasetWithFallback(fallback, payload, options = {}) {
    const fallbackPaths = options.fallbackPaths || new Set();
    const path = options.path || '';

    if (Array.isArray(payload)) {
        if (payload.length > 0 || !Array.isArray(fallback) || fallback.length === 0) return payload;
        noteFallback(fallbackPaths, path);
        return fallback;
    }

    if (isBlankScalar(payload)) {
        if (fallback !== undefined) noteFallback(fallbackPaths, path);
        return fallback;
    }

    if (!isPlainObject(payload)) return payload;
    if (!isPlainObject(fallback)) return payload;

    const result = {};
    const keys = new Set([...Object.keys(fallback), ...Object.keys(payload)]);
    keys.forEach(key => {
        const nextPath = pathFor(path, key);
        if (!Object.prototype.hasOwnProperty.call(payload, key)) {
            result[key] = fallback[key];
            if (fallback[key] !== undefined) noteFallback(fallbackPaths, nextPath);
            return;
        }
        result[key] = mergeDatasetWithFallback(fallback[key], payload[key], {
            fallbackPaths,
            path: nextPath,
        });
    });
    return result;
}

export function mergeDatasetAndReportFallback(fallback, payload) {
    const fallbackPaths = new Set();
    const data = mergeDatasetWithFallback(fallback, payload, { fallbackPaths });
    return {
        data,
        fallbackFields: [...fallbackPaths].sort(),
    };
}
