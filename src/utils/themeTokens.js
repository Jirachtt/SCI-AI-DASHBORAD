const LEGACY_COLOR_TOKENS = new Map([
    ['#006838', '--accent-success-deep'],
    ['#004d29', '--accent-success-deep'],
    ['#00a651', '--accent-success'],
    ['#059669', '--accent-success'],
    ['#0f766e', '--accent-teal'],
    ['#10b981', '--accent-success'],
    ['#22c55e', '--accent-success'],
    ['#4caf50', '--accent-success'],
    ['#2e86ab', '--accent-info'],
    ['#2563eb', '--accent-blue'],
    ['#3b82f6', '--accent-blue'],
    ['#06b6d4', '--accent-cyan'],
    ['#0891b2', '--accent-cyan'],
    ['#0ea5e9', '--accent-sky'],
    ['#0e7490', '--accent-cyan'],
    ['#c5a028', '--accent-gold'],
    ['#ffd700', '--accent-gold'],
    ['#d97706', '--accent-orange'],
    ['#eab308', '--accent-gold'],
    ['#f59e0b', '--accent-warning'],
    ['#ffc107', '--accent-warning'],
    ['#f97316', '--accent-orange'],
    ['#f18f01', '--accent-orange'],
    ['#ea580c', '--accent-orange'],
    ['#7b68ee', '--accent-purple'],
    ['#7c3aed', '--accent-purple'],
    ['#8b5cf6', '--accent-purple'],
    ['#6d28d9', '--accent-purple'],
    ['#5b4fcf', '--accent-purple'],
    ['#a23b72', '--accent-pink'],
    ['#b83280', '--accent-pink'],
    ['#db2777', '--accent-pink'],
    ['#e91e63', '--accent-pink'],
    ['#ec4899', '--accent-pink'],
    ['#be123c', '--accent-rose'],
    ['#ef4444', '--accent-danger'],
    ['#dc2626', '--accent-danger'],
    ['#f43f5e', '--accent-danger'],
    ['#e11d48', '--accent-rose'],
    ['#64748b', '--text-subtle'],
    ['#475569', '--text-muted'],
    ['#334155', '--text-secondary'],
    ['#374151', '--text-secondary'],
    ['#9ca3af', '--chart-muted'],
    ['#e5e7eb', '--chart-muted'],
    ['#ffffff', '--text-on-accent'],
    ['#fff', '--text-on-accent'],
]);

export function normalizeHexColor(value) {
    const raw = String(value || '').trim().toLowerCase();
    const match = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (!match) return null;
    let hex = match[0];
    if (hex.length === 4) {
        hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    if (hex.length === 9) hex = hex.slice(0, 7);
    return hex;
}

export function cssVar(name, fallback) {
    const token = String(name || '').startsWith('--') ? name : `--${name}`;
    return fallback ? `var(${token}, ${fallback})` : `var(${token})`;
}

export function alphaVar(name, amount = 12) {
    return `color-mix(in srgb, ${cssVar(name)} ${amount}%, transparent)`;
}

export function legacyColorToVar(value, fallback = '--accent-primary') {
    if (typeof value === 'string' && (value.startsWith('var(') || value.startsWith('color-mix('))) {
        return value;
    }
    const normalized = normalizeHexColor(value);
    return cssVar((normalized && LEGACY_COLOR_TOKENS.get(normalized)) || fallback);
}

export function legacyAlpha(value, amount = 12, fallback = '--accent-primary') {
    return `color-mix(in srgb, ${legacyColorToVar(value, fallback)} ${amount}%, transparent)`;
}

export function legacyGradient(from, to = from) {
    return `linear-gradient(135deg, ${legacyColorToVar(from)}, ${legacyColorToVar(to, '--accent-secondary')})`;
}

export function themeAlpha(value, amount = 12, fallback = '--accent-primary') {
    return legacyAlpha(value, amount, fallback);
}

export function themeGradient(value, fallback = '--accent-primary', direction = '135deg') {
    const color = legacyColorToVar(value, fallback);
    return `linear-gradient(${direction}, ${color}, color-mix(in srgb, ${color} 72%, var(--bg-primary)))`;
}
