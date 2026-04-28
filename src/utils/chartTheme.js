export const DASHBOARD_FONT_FAMILY = "'Noto Sans Thai', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export const LIGHT_CHART_PALETTE = [
    '#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2',
    '#9333ea', '#0f766e', '#ea580c', '#be123c', '#4f46e5', '#15803d',
];

export const DARK_CHART_PALETTE = [
    '#7dd3fc', '#c4b5fd', '#34d399', '#fbbf24', '#fb7185', '#22d3ee',
    '#f0abfc', '#86efac', '#fdba74', '#f9a8d4', '#93c5fd', '#fca5a5',
];

const LIGHT_CHART_SURFACE = '#ffffff';
const DARK_CHART_SURFACE = '#131929';

function withDashboardFont(font = {}, fallbackWeight) {
    const next = { ...font, family: DASHBOARD_FONT_FAMILY };
    if (fallbackWeight && !next.weight) next.weight = fallbackWeight;
    return next;
}

function activeThemeName() {
    if (typeof document === 'undefined') return 'light';
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function getChartPalette(theme = activeThemeName()) {
    return theme === 'dark' ? DARK_CHART_PALETTE : LIGHT_CHART_PALETTE;
}

export function getCurrentChartTheme(theme = activeThemeName()) {
    const isLight = theme !== 'dark';
    return {
        theme: isLight ? 'light' : 'dark',
        palette: getChartPalette(theme),
        surface: isLight ? LIGHT_CHART_SURFACE : DARK_CHART_SURFACE,
        text: isLight ? '#1f2937' : '#f1f5f9',
        muted: isLight ? '#475569' : '#d6deea',
        grid: isLight ? 'rgba(15, 23, 42, 0.10)' : 'rgba(226, 232, 240, 0.16)',
        axis: isLight ? 'rgba(15, 23, 42, 0.18)' : 'rgba(226, 232, 240, 0.22)',
        tooltipBg: isLight ? 'rgba(255, 255, 255, 0.98)' : 'rgba(15, 23, 42, 0.96)',
        tooltipTitle: isLight ? '#0f172a' : '#ffffff',
        tooltipBody: isLight ? '#334155' : '#e5edf8',
        tooltipBorder: isLight ? 'rgba(37, 99, 235, 0.28)' : 'rgba(125, 211, 252, 0.38)',
    };
}

function cloneColorValue(value) {
    return Array.isArray(value) ? [...value] : value;
}

function originalColor(dataset, key) {
    if (!dataset.__mjuOriginalColors) {
        Object.defineProperty(dataset, '__mjuOriginalColors', {
            value: {},
            enumerable: false,
            configurable: true,
            writable: true,
        });
    }
    if (!(key in dataset.__mjuOriginalColors)) {
        dataset.__mjuOriginalColors[key] = cloneColorValue(dataset[key]);
    }
    return cloneColorValue(dataset.__mjuOriginalColors[key]);
}

function parseHexColor(value) {
    const hex = String(value || '').trim().replace(/^#/, '');
    if (![3, 4, 6, 8].includes(hex.length)) return null;
    const expanded = hex.length <= 4 ? hex.split('').map(ch => ch + ch).join('') : hex;
    const rgbHex = expanded.slice(0, 6);
    if (!/^[0-9a-f]{6}$/i.test(rgbHex)) return null;
    return {
        r: parseInt(rgbHex.slice(0, 2), 16),
        g: parseInt(rgbHex.slice(2, 4), 16),
        b: parseInt(rgbHex.slice(4, 6), 16),
    };
}

function parseRgbColor(value) {
    const match = String(value || '').trim().match(/rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)(?:[,\s/]+([0-9.]+%?))?/i);
    if (!match) return null;
    return {
        r: Number(match[1]),
        g: Number(match[2]),
        b: Number(match[3]),
    };
}

function parseColor(value) {
    if (typeof value !== 'string') return null;
    const color = value.trim();
    if (!color || color.startsWith('var(') || color.startsWith('linear-gradient')) return null;
    return color.startsWith('#') ? parseHexColor(color) : parseRgbColor(color);
}

function channelToLinear(channel) {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb) {
    return 0.2126 * channelToLinear(rgb.r) + 0.7152 * channelToLinear(rgb.g) + 0.0722 * channelToLinear(rgb.b);
}

function contrastRatio(a, b) {
    const l1 = luminance(a);
    const l2 = luminance(b);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

function rgbaFromHex(hex, alpha = 1) {
    const rgb = parseHexColor(hex);
    if (!rgb) return hex;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function rgbaFromColor(value, fallbackHex, alpha = 1) {
    const rgb = parseColor(value) || parseHexColor(fallbackHex);
    if (!rgb) return value || fallbackHex;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function isNearBlackColor(value) {
    const color = String(value || '').trim().toLowerCase();
    if (!color) return false;
    if (color === 'black' || color === '#000' || color === '#000000' || color === '#000000ff') return true;
    const rgb = parseColor(color);
    return Boolean(rgb && rgb.r <= 24 && rgb.g <= 24 && rgb.b <= 24);
}

function isLowContrastColor(value, themeConfig, minRatio) {
    const rgb = parseColor(value);
    const surface = parseHexColor(themeConfig.surface);
    if (!rgb || !surface) return false;
    return contrastRatio(rgb, surface) < minRatio;
}

function isUnsafeColor(value, themeConfig, minRatio = 2.2) {
    if (!value || typeof value !== 'string') return true;
    const color = value.trim().toLowerCase();
    if (!color || color === 'transparent') return true;
    return isNearBlackColor(color) || isLowContrastColor(color, themeConfig, minRatio);
}

function adaptColorValue(value, fallbackHex, themeConfig, alpha = 0.82, count = 0, minRatio = 2.2) {
    const fallback = rgbaFromHex(fallbackHex, alpha);
    if (Array.isArray(value)) {
        const source = value.length > 0 ? value : Array.from({ length: count }, () => null);
        return source.map((color, index) => {
            const paletteColor = themeConfig.palette[index % themeConfig.palette.length] || fallbackHex;
            return isUnsafeColor(color, themeConfig, minRatio)
                ? rgbaFromHex(paletteColor, alpha)
                : rgbaFromColor(color, paletteColor, alpha);
        });
    }
    if (count > 0 && !value) {
        return Array.from({ length: count }, (_, index) => rgbaFromHex(themeConfig.palette[index % themeConfig.palette.length], alpha));
    }
    return isUnsafeColor(value, themeConfig, minRatio) ? fallback : rgbaFromColor(value, fallbackHex, alpha);
}

function baseChartType(chart) {
    return chart?.config?.type || chart?.type || 'bar';
}

export function sanitizeChartDatasetColors(chart, theme = activeThemeName()) {
    const datasets = chart?.data?.datasets;
    if (!Array.isArray(datasets)) return chart;

    const themeConfig = getCurrentChartTheme(theme);
    const chartType = baseChartType(chart);
    const labelCount = Array.isArray(chart?.data?.labels) ? chart.data.labels.length : 0;
    const sliceTypes = new Set(['pie', 'doughnut', 'polarArea']);

    datasets.forEach((dataset, datasetIndex) => {
        const fallback = themeConfig.palette[datasetIndex % themeConfig.palette.length];
        const type = dataset.type || chartType;
        const isSlice = sliceTypes.has(type) || sliceTypes.has(chartType);
        const dataCount = Array.isArray(dataset.data) ? dataset.data.length : labelCount;
        const count = isSlice ? Math.max(labelCount, dataCount) : 0;
        const isLine = type === 'line' || chartType === 'line';
        const isPointChart = type === 'scatter' || type === 'bubble' || chartType === 'scatter' || chartType === 'bubble';
        const fillAlpha = isLine ? 0.22 : isPointChart ? 0.78 : 0.82;

        const originalBackground = originalColor(dataset, 'backgroundColor');
        const originalBorder = originalColor(dataset, 'borderColor');
        const originalPointBackground = originalColor(dataset, 'pointBackgroundColor');

        dataset.backgroundColor = adaptColorValue(originalBackground, fallback, themeConfig, fillAlpha, count, 3);
        dataset.borderColor = adaptColorValue(originalBorder, fallback, themeConfig, 0.98, Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor.length : 0, 2.8);

        if (type === 'bar' || isSlice) {
            dataset.hoverBackgroundColor = adaptColorValue(dataset.backgroundColor, fallback, themeConfig, 0.96, Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor.length : 0, 2.8);
            dataset.hoverBorderColor = adaptColorValue(dataset.borderColor, fallback, themeConfig, 1, Array.isArray(dataset.borderColor) ? dataset.borderColor.length : 0, 2.8);
            if (dataset.borderWidth == null) dataset.borderWidth = themeConfig.theme === 'dark' ? 1.2 : 1;
        }

        if (isLine || isPointChart) {
            dataset.pointBackgroundColor = adaptColorValue(originalPointBackground || originalBorder, fallback, themeConfig, 1, 0, 2.8);
            dataset.pointHoverBackgroundColor = adaptColorValue(dataset.pointBackgroundColor, fallback, themeConfig, 1, 0, 2.8);
            dataset.pointBorderColor = themeConfig.surface;
            if (dataset.pointBorderWidth == null) dataset.pointBorderWidth = 2;
            if (dataset.borderWidth == null) dataset.borderWidth = themeConfig.theme === 'dark' ? 2.8 : 2.4;
        }
    });

    return chart;
}

export const themeAdaptorPlugin = {
    id: 'themeAdaptor',
    beforeUpdate(chart) {
        const themeConfig = getCurrentChartTheme();

        sanitizeChartDatasetColors(chart, themeConfig.theme);
        chart.options.font = withDashboardFont(chart.options.font, '600');

        const scales = chart.options.scales || {};
        for (const key of Object.keys(scales)) {
            const scale = scales[key];
            if (scale.ticks) {
                scale.ticks.color = themeConfig.muted;
                scale.ticks.font = withDashboardFont(scale.ticks.font, '600');
            }
            if (scale.grid && scale.grid.display !== false) {
                scale.grid.color = themeConfig.grid;
                if (scale.grid.lineWidth == null) scale.grid.lineWidth = 0.5;
            }
            if (scale.border) {
                scale.border.color = themeConfig.axis;
            }
            if (scale.angleLines) {
                scale.angleLines.color = themeConfig.grid;
            }
            if (scale.pointLabels) {
                scale.pointLabels.color = themeConfig.text;
                scale.pointLabels.font = withDashboardFont(scale.pointLabels.font, '700');
            }
            if (scale.title && scale.title.display) {
                scale.title.color = themeConfig.text;
                scale.title.font = withDashboardFont(scale.title.font, '700');
            }
        }

        chart.options.plugins = chart.options.plugins || {};
        if (chart.options.plugins.tooltip == null) chart.options.plugins.tooltip = {};
        const tooltip = chart.options.plugins.tooltip;
        if (tooltip) {
            tooltip.backgroundColor = themeConfig.tooltipBg;
            tooltip.titleColor = themeConfig.tooltipTitle;
            tooltip.bodyColor = themeConfig.tooltipBody;
            tooltip.borderColor = themeConfig.tooltipBorder;
            tooltip.borderWidth = 1;
            if (!tooltip.cornerRadius) tooltip.cornerRadius = 10;
            if (!tooltip.padding) tooltip.padding = 12;
            tooltip.titleFont = withDashboardFont(tooltip.titleFont, '700');
            tooltip.bodyFont = withDashboardFont(tooltip.bodyFont, '600');
            if (tooltip.displayColors == null) tooltip.displayColors = true;
            if (tooltip.boxPadding == null) tooltip.boxPadding = 4;
            tooltip.caretPadding = tooltip.caretPadding ?? 8;
        }

        const legend = chart.options.plugins?.legend;
        if (legend?.labels) {
            legend.labels.color = themeConfig.text;
            legend.labels.font = withDashboardFont(legend.labels.font, '700');
        }

        const title = chart.options.plugins?.title;
        if (title) {
            title.color = themeConfig.text;
            title.font = withDashboardFont(title.font, '700');
        }

        const subtitle = chart.options.plugins?.subtitle;
        if (subtitle) {
            subtitle.color = themeConfig.muted;
            subtitle.font = withDashboardFont(subtitle.font, '600');
        }
    }
};
