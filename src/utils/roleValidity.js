export const ROLE_DURATION_YEARS = {
    dean: 4,
    chair: 4,
    staff: 10,
    student: 6,
    general: 1,
};

export const ROLE_DURATION_LABELS = {
    dean: '4 ปี',
    chair: '4 ปี',
    staff: '10 ปี',
    student: '6 ปี',
    general: '1 ปี',
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function normalizeRoleDay(value) {
    const d = parseRoleDate(value) || new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}

function addCalendarMonths(value, months = 0) {
    const start = normalizeRoleDay(value);
    const day = start.getDate();
    const next = new Date(start);
    next.setDate(1);
    next.setMonth(next.getMonth() + Number(months || 0));
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(day, lastDay));
    next.setHours(12, 0, 0, 0);
    return next;
}

function getCalendarDiffParts(fromValue, toValue) {
    const from = normalizeRoleDay(fromValue);
    const to = normalizeRoleDay(toValue);
    if (to.getTime() <= from.getTime()) {
        return { years: 0, months: 0, days: 0 };
    }

    let totalMonths = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    let cursor = addCalendarMonths(from, totalMonths);

    if (cursor.getTime() > to.getTime()) {
        totalMonths -= 1;
        cursor = addCalendarMonths(from, totalMonths);
    }

    return {
        years: Math.floor(totalMonths / 12),
        months: totalMonths % 12,
        days: Math.max(0, Math.round((to.getTime() - cursor.getTime()) / ONE_DAY_MS)),
    };
}

function formatDurationParts(parts) {
    const units = [
        ['years', 'ปี'],
        ['months', 'เดือน'],
        ['days', 'วัน'],
    ];
    const text = units
        .filter(([key]) => Number(parts[key]) > 0)
        .map(([key, label]) => `${Number(parts[key]).toLocaleString('th-TH')} ${label}`);

    return text.length ? text.join(' ') : '0 วัน';
}

export function parseRoleDate(value) {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (value?.toDate) {
        const d = value.toDate();
        return Number.isNaN(d.getTime()) ? null : d;
    }
    if (value?.seconds) {
        const d = new Date(value.seconds * 1000);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

export function formatRoleDate(value) {
    const d = parseRoleDate(value);
    if (!d) return '-';
    return d.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

export function toRoleDateInput(value) {
    const d = parseRoleDate(value);
    if (!d) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function fromRoleDateInput(value) {
    if (!value) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    const d = new Date(year, month - 1, day, 12, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
}

export function addRoleYears(value, years = 1) {
    const start = parseRoleDate(value) || new Date();
    const next = new Date(start);
    next.setFullYear(next.getFullYear() + Number(years || 0));
    return next;
}

export function addRoleMonths(value, months = 1) {
    const start = parseRoleDate(value) || new Date();
    const next = new Date(start);
    next.setMonth(next.getMonth() + Number(months || 0));
    return next;
}

export function getDefaultRoleDurationYears(role) {
    return ROLE_DURATION_YEARS[role] || ROLE_DURATION_YEARS.general;
}

export function getRoleDurationLabel(role) {
    return ROLE_DURATION_LABELS[role] || ROLE_DURATION_LABELS.general;
}

export function formatRoleRemainingText(validity = {}) {
    const now = new Date();
    const expiresAt = parseRoleDate(validity.expiresAt) || now;
    const isExpired = validity.status === 'expired' || Number(validity.daysRemaining) < 0;
    const parts = isExpired
        ? getCalendarDiffParts(expiresAt, now)
        : getCalendarDiffParts(now, expiresAt);
    return formatDurationParts(parts);
}

export function buildRoleValidityPatch(role, startValue = new Date()) {
    const start = parseRoleDate(startValue) || new Date();
    const durationYears = getDefaultRoleDurationYears(role);
    const expires = addRoleYears(start, durationYears);
    return {
        roleStartedAt: start.toISOString(),
        roleExpiresAt: expires.toISOString(),
        roleDurationYears: durationYears,
        roleManagedAt: new Date().toISOString(),
    };
}

export function getRoleValidity(user = {}) {
    const role = user.role || 'general';
    const durationYears = Number(user.roleDurationYears) || getDefaultRoleDurationYears(role);
    const startedAt = parseRoleDate(user.roleStartedAt || user.approvedAt || user.createdAt) || new Date();
    const expiresAt = parseRoleDate(user.roleExpiresAt) || addRoleYears(startedAt, durationYears);
    const now = new Date();
    const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / ONE_DAY_MS);
    const totalDays = Math.max(1, Math.ceil((expiresAt.getTime() - startedAt.getTime()) / ONE_DAY_MS));
    const elapsedDays = Math.max(0, Math.ceil((now.getTime() - startedAt.getTime()) / ONE_DAY_MS));
    const progress = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));

    let status = 'active';
    if (daysRemaining < 0) status = 'expired';
    else if (daysRemaining <= 30) status = 'expiring';
    const remainingText = formatRoleRemainingText({ expiresAt, daysRemaining, status });

    return {
        role,
        startedAt,
        expiresAt,
        durationYears,
        daysRemaining,
        totalDays,
        progress,
        status,
        remainingText,
        label: getRoleDurationLabel(role),
    };
}
