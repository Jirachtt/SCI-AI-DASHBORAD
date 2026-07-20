export const DASHBOARD_FONT_FAMILY = "'Noto Sans Thai', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const MIN_CHART_FONT_SIZE = 12;
const DEFAULT_CHART_FONT_SIZE = 13;

const CHART_COLOR_COUNT = 12;
export const LIGHT_CHART_PALETTE = Array.from({ length: CHART_COLOR_COUNT }, (_, index) => `var(--chart-${index + 1})`);
export const DARK_CHART_PALETTE = LIGHT_CHART_PALETTE;

function withDashboardFont(font = {}, fallbackWeight) {
    const next = { family: DASHBOARD_FONT_FAMILY };
    if (font && typeof font === 'object') {
        ['size', 'style', 'weight', 'lineHeight'].forEach((key) => {
            const value = font[key];
            if (value != null) next[key] = value;
        });
    }
    next.size = Math.max(Number(next.size) || DEFAULT_CHART_FONT_SIZE, MIN_CHART_FONT_SIZE);
    if (fallbackWeight && !next.weight) next.weight = fallbackWeight;
    return next;
}

function activeThemeName() {
    if (typeof document === 'undefined') return 'light';
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function cssVarValue(name, fallback) {
    if (typeof document === 'undefined') return fallback;
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
}

function resolveCssColor(value) {
    if (typeof value !== 'string' || typeof document === 'undefined') return value;
    const color = value.trim();
    const match = color.match(/^var\(\s*(--[\w-]+)(?:\s*,\s*([^)]+))?\s*\)$/);
    if (!match) return color;
    return cssVarValue(match[1], match[2]?.trim() || color);
}

function readChartPalette(theme = activeThemeName()) {
    const fallback = theme === 'dark' ? DARK_CHART_PALETTE : LIGHT_CHART_PALETTE;
    if (typeof document === 'undefined') return fallback;
    return Array.from({ length: CHART_COLOR_COUNT }, (_, index) => {
        const token = `--chart-${index + 1}`;
        return cssVarValue(token, fallback[index % fallback.length]);
    });
}

export function getChartPalette(theme = activeThemeName()) {
    return readChartPalette(theme);
}

export function getCurrentChartTheme(theme = activeThemeName()) {
    const isLight = theme !== 'dark';
    const palette = getChartPalette(theme);
    return {
        theme: isLight ? 'light' : 'dark',
        palette,
        surface: cssVarValue('--chart-surface', 'var(--bg-card)'),
        text: cssVarValue('--chart-text', 'var(--text-primary)'),
        muted: cssVarValue('--chart-muted', 'var(--text-muted)'),
        grid: cssVarValue('--chart-grid', 'var(--border-color)'),
        axis: cssVarValue('--chart-axis', 'var(--border-color)'),
        tooltipBg: cssVarValue('--chart-tooltip-bg', 'var(--bg-card)'),
        tooltipTitle: cssVarValue('--chart-tooltip-text', 'var(--text-primary)'),
        tooltipBody: isLight
            ? cssVarValue('--chart-muted', 'var(--text-muted)')
            : cssVarValue('--chart-text', 'var(--text-primary)'),
        tooltipBorder: cssVarValue('--accent-border-soft', 'var(--border-color)'),
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
    const color = resolveCssColor(value).trim();
    if (!color || color.startsWith('linear-gradient') || color.startsWith('color-mix(')) return null;
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

function chartLinearGradient(context, fallbackHex, topAlpha, bottomAlpha, horizontal = false) {
    const chart = context?.chart;
    const area = chart?.chartArea;
    const ctx = chart?.ctx;
    if (!ctx || !area) return rgbaFromHex(fallbackHex, topAlpha);

    const gradient = horizontal
        ? ctx.createLinearGradient(area.left, 0, area.right, 0)
        : ctx.createLinearGradient(0, area.top, 0, area.bottom);
    gradient.addColorStop(0, rgbaFromHex(fallbackHex, topAlpha));
    gradient.addColorStop(0.58, rgbaFromHex(fallbackHex, Math.max(bottomAlpha + 0.10, topAlpha * 0.58)));
    gradient.addColorStop(1, rgbaFromHex(fallbackHex, bottomAlpha));
    return gradient;
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
    const color = resolveCssColor(value).trim().toLowerCase();
    if (!color || color === 'transparent') return true;
    return isNearBlackColor(color) || isLowContrastColor(color, themeConfig, minRatio);
}

function isThemeTokenColor(value) {
    return typeof value === 'string' && value.trim().startsWith('var(');
}

function adaptColorValue(value, fallbackHex, themeConfig, alpha = 0.82, count = 0, minRatio = 2.2) {
    const fallback = rgbaFromHex(fallbackHex, alpha);
    if (Array.isArray(value)) {
        const source = value.length > 0 ? value : Array.from({ length: count }, () => null);
        return source.map((color, index) => {
            const paletteColor = themeConfig.palette[index % themeConfig.palette.length] || fallbackHex;
            if (isThemeTokenColor(color) && !isUnsafeColor(color, themeConfig, minRatio)) {
                return rgbaFromColor(color, paletteColor, alpha);
            }
            return rgbaFromHex(paletteColor, alpha);
        });
    }
    if (count > 0 && !value) {
        return Array.from({ length: count }, (_, index) => rgbaFromHex(themeConfig.palette[index % themeConfig.palette.length], alpha));
    }
    if (isThemeTokenColor(value) && !isUnsafeColor(value, themeConfig, minRatio)) {
        return rgbaFromColor(value, fallbackHex, alpha);
    }
    return fallback;
}

function baseChartType(chart) {
    return chart?.config?.type || chart?.type || 'bar';
}

function isStackedBarChart(chart) {
    const chartType = baseChartType(chart);
    const datasets = Array.isArray(chart?.data?.datasets) ? chart.data.datasets : [];
    const hasBarDataset = chartType === 'bar' || datasets.some(dataset => (dataset?.type || chartType) === 'bar');
    if (!hasBarDataset) return false;

    const scales = chart?.config?.options?.scales || chart?.options?.scales || {};
    const hasStackedScale = Object.values(scales).some(scale => scale?.stacked === true);
    const hasDatasetStack = datasets.some(dataset => dataset?.stack != null);
    return hasStackedScale || hasDatasetStack;
}

function numericBarValue(dataset, dataIndex, indexAxis = 'x') {
    const raw = Array.isArray(dataset?.data) ? dataset.data[dataIndex] : null;
    if (typeof raw === 'number') return raw;
    if (Array.isArray(raw)) {
        const start = Number(raw[0]);
        const end = Number(raw[1]);
        if (Number.isFinite(start) && Number.isFinite(end)) return end - start;
        return Number.isFinite(end) ? end : 0;
    }
    if (raw && typeof raw === 'object') {
        const value = indexAxis === 'y' ? raw.x : raw.y;
        const fallback = indexAxis === 'y' ? raw.y : raw.x;
        const numeric = Number(value ?? fallback);
        return Number.isFinite(numeric) ? numeric : 0;
    }
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : 0;
}

function datasetStackKey(dataset) {
    return dataset?.stack ?? '__mju_default_stack__';
}

function datasetIsVisible(chart, datasetIndex) {
    if (typeof chart?.isDatasetVisible === 'function') return chart.isDatasetVisible(datasetIndex);
    return !chart?.getDatasetMeta?.(datasetIndex)?.hidden;
}

function visibleStackIndexes(context) {
    const chart = context?.chart;
    const datasets = Array.isArray(chart?.data?.datasets) ? chart.data.datasets : [];
    const datasetIndex = Number(context?.datasetIndex);
    const currentDataset = datasets[datasetIndex];
    if (!currentDataset) return [];

    const chartType = baseChartType(chart);
    const indexAxis = chart?.config?.options?.indexAxis === 'y' ? 'y' : 'x';
    const currentValue = numericBarValue(currentDataset, context?.dataIndex, indexAxis);
    if (!currentValue) return [];

    const currentSign = currentValue < 0 ? -1 : 1;
    const currentStack = datasetStackKey(currentDataset);

    return datasets
        .map((dataset, index) => ({ dataset, index }))
        .filter(({ dataset, index }) => {
            const type = dataset?.type || chartType;
            if (type !== 'bar') return false;
            if (datasetStackKey(dataset) !== currentStack) return false;
            if (!datasetIsVisible(chart, index)) return false;
            const value = numericBarValue(dataset, context?.dataIndex, indexAxis);
            if (!value) return false;
            return (value < 0 ? -1 : 1) === currentSign;
        })
        .map(({ index }) => index);
}

function stackedBarBorderRadius(context) {
    const indexes = visibleStackIndexes(context);
    const datasetIndex = Number(context?.datasetIndex);
    if (!indexes.includes(datasetIndex)) return 0;

    const radius = 8;
    const first = indexes[0];
    const last = indexes[indexes.length - 1];
    if (first === last) return radius;

    const chart = context?.chart;
    const indexAxis = chart?.config?.options?.indexAxis === 'y' ? 'y' : 'x';
    const value = numericBarValue(chart?.data?.datasets?.[datasetIndex], context?.dataIndex, indexAxis);
    const isNegative = value < 0;
    const isFirst = datasetIndex === first;
    const isLast = datasetIndex === last;

    if (indexAxis === 'y') {
        return {
            topLeft: isNegative ? (isLast ? radius : 0) : (isFirst ? radius : 0),
            bottomLeft: isNegative ? (isLast ? radius : 0) : (isFirst ? radius : 0),
            topRight: isNegative ? (isFirst ? radius : 0) : (isLast ? radius : 0),
            bottomRight: isNegative ? (isFirst ? radius : 0) : (isLast ? radius : 0),
        };
    }

    return {
        topLeft: isNegative ? (isFirst ? radius : 0) : (isLast ? radius : 0),
        topRight: isNegative ? (isFirst ? radius : 0) : (isLast ? radius : 0),
        bottomLeft: isNegative ? (isLast ? radius : 0) : (isFirst ? radius : 0),
        bottomRight: isNegative ? (isLast ? radius : 0) : (isFirst ? radius : 0),
    };
}

function mutableChartOptions(chart) {
    if (!chart.config.options || typeof chart.config.options !== 'object') {
        chart.config.options = {};
    }
    return chart.config.options;
}

export function sanitizeChartDatasetColors(chart, theme = activeThemeName()) {
    const datasets = chart?.data?.datasets;
    if (!Array.isArray(datasets)) return chart;

    const themeConfig = getCurrentChartTheme(theme);
    const chartType = baseChartType(chart);
    const labelCount = Array.isArray(chart?.data?.labels) ? chart.data.labels.length : 0;
    const sliceTypes = new Set(['pie', 'doughnut', 'polarArea']);
    const stackedBar = isStackedBarChart(chart);

    datasets.forEach((dataset, datasetIndex) => {
        const fallback = themeConfig.palette[datasetIndex % themeConfig.palette.length];
        const type = dataset.type || chartType;
        const isSlice = sliceTypes.has(type) || sliceTypes.has(chartType);
        const dataCount = Array.isArray(dataset.data) ? dataset.data.length : labelCount;
        const count = isSlice ? Math.max(labelCount, dataCount) : 0;
        const isLine = type === 'line' || chartType === 'line';
        const isPointChart = type === 'scatter' || type === 'bubble' || chartType === 'scatter' || chartType === 'bubble';
        const fillAlpha = isLine ? 0.18 : isPointChart ? 0.82 : (themeConfig.theme === 'dark' ? 0.90 : 0.84);

        const originalBackground = originalColor(dataset, 'backgroundColor');
        const originalBorder = originalColor(dataset, 'borderColor');
        const originalPointBackground = originalColor(dataset, 'pointBackgroundColor');

        dataset.backgroundColor = adaptColorValue(originalBackground, fallback, themeConfig, fillAlpha, count, 3);
        dataset.borderColor = adaptColorValue(originalBorder, fallback, themeConfig, 0.98, Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor.length : 0, 2.8);

        if (type === 'bar' || isSlice) {
            dataset.hoverBackgroundColor = adaptColorValue(dataset.backgroundColor, fallback, themeConfig, 0.96, Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor.length : 0, 2.8);
            dataset.hoverBorderColor = adaptColorValue(dataset.borderColor, fallback, themeConfig, 1, Array.isArray(dataset.borderColor) ? dataset.borderColor.length : 0, 2.8);
            if (dataset.borderWidth == null) dataset.borderWidth = themeConfig.theme === 'dark' ? 1.2 : 1;
            if (type === 'bar') {
                if (stackedBar) {
                    dataset.borderWidth = 0;
                    dataset.hoverBorderWidth = 0;
                    dataset.borderColor = 'transparent';
                    dataset.hoverBorderColor = 'transparent';
                    dataset.borderRadius = stackedBarBorderRadius;
                } else if (!Array.isArray(dataset.backgroundColor)) {
                    dataset.backgroundColor = rgbaFromColor(originalBackground, fallback, themeConfig.theme === 'dark' ? 0.90 : 0.84);
                    dataset.hoverBackgroundColor = rgbaFromColor(originalBackground, fallback, 0.98);
                }
                if (dataset.borderRadius == null) dataset.borderRadius = 6;
                if (dataset.borderSkipped == null) dataset.borderSkipped = false;
                if (dataset.maxBarThickness == null) dataset.maxBarThickness = 54;
            }
            if (isSlice) {
                dataset.borderColor = themeConfig.surface;
                if (dataset.borderWidth == null || dataset.borderWidth < 2) dataset.borderWidth = 2;
                const requestedHoverOffset = Number(dataset.hoverOffset);
                dataset.hoverOffset = Number.isFinite(requestedHoverOffset)
                    ? Math.min(Math.max(requestedHoverOffset, 4), 8)
                    : 6;
                dataset.spacing = Math.min(Number(dataset.spacing) || 1, 2);
            }
        }

        if (isLine || isPointChart) {
            if (isLine && dataset.fill && !Array.isArray(dataset.backgroundColor)) {
                dataset.backgroundColor = (context) => chartLinearGradient(context, fallback, themeConfig.theme === 'dark' ? 0.30 : 0.22, 0.02);
            }
            dataset.pointBackgroundColor = adaptColorValue(originalPointBackground || originalBorder, fallback, themeConfig, 1, 0, 2.8);
            dataset.pointHoverBackgroundColor = adaptColorValue(dataset.pointBackgroundColor, fallback, themeConfig, 1, 0, 2.8);
            dataset.pointBorderColor = themeConfig.surface;
            if (dataset.pointBorderWidth == null) dataset.pointBorderWidth = 2;
            if (dataset.borderWidth == null) dataset.borderWidth = themeConfig.theme === 'dark' ? 2.8 : 2.4;
            if (dataset.tension == null) dataset.tension = 0.34;
            if (dataset.pointRadius == null) dataset.pointRadius = isPointChart ? 4.8 : 3.6;
            if (dataset.pointHoverRadius == null) dataset.pointHoverRadius = isPointChart ? 7 : 6;
            if (dataset.pointHitRadius == null) dataset.pointHitRadius = 12;
        }
    });

    return chart;
}

const PREMIUM_CHART_MOTION = {
    initialDuration: 700,
    updateDuration: 240,
    sliceDuration: 720,
    maxInitialDelay: 160,
    maxUpdateDelay: 24,
    easing: 'easeOutQuart',
};

function prefersReducedMotion() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function chartUpdateMode(args) {
    return args?.mode || 'default';
}

function isMotionSuppressed(mode, animationConfig) {
    return mode === 'none' || animationConfig === false || prefersReducedMotion();
}

function chartDatasetCount(chart) {
    return Array.isArray(chart?.data?.datasets) ? chart.data.datasets.length : 0;
}

function chartDataCount(chart) {
    const labelCount = Array.isArray(chart?.data?.labels) ? chart.data.labels.length : 0;
    const maxDatasetLength = Array.isArray(chart?.data?.datasets)
        ? chart.data.datasets.reduce((max, dataset) => Math.max(max, Array.isArray(dataset?.data) ? dataset.data.length : 0), 0)
        : 0;
    return Math.max(labelCount, maxDatasetLength, 1);
}

function chartElementDelay(context, chart, isSliceChart, isInitialMotion) {
    if (context?.type !== 'data') return 0;
    const mode = context?.mode || 'default';
    if (!['default', 'reset', 'show'].includes(mode)) return 0;

    const datasetIndex = Number(context?.datasetIndex) || 0;
    const dataIndex = Number(context?.dataIndex) || 0;
    const maxDelay = isInitialMotion ? PREMIUM_CHART_MOTION.maxInitialDelay : PREMIUM_CHART_MOTION.maxUpdateDelay;
    const dataCount = Math.max(chartDataCount(chart), 1);
    const datasetCount = Math.max(chartDatasetCount(chart), 1);
    const perDataDelay = isSliceChart ? 36 : Math.max(12, Math.min(32, 390 / dataCount));
    const perDatasetDelay = isSliceChart ? 18 : Math.max(24, Math.min(66, 160 / datasetCount));

    return Math.min(datasetIndex * perDatasetDelay + dataIndex * perDataDelay, maxDelay);
}

function baselineForScale(context, axisKey) {
    const scale = context?.chart?.scales?.[axisKey];
    if (!scale || typeof scale.getPixelForValue !== 'function') return undefined;
    return scale.getPixelForValue(0);
}

function applyPremiumChartMotion(chart, options, chartType, isSliceChart, args) {
    const mode = chartUpdateMode(args);
    const existingAnimation = options.animation;
    if (isMotionSuppressed(mode, existingAnimation)) return;

    const isInitialMotion = !chart.$mjuHasAnimated;
    const isBarChart = chartType === 'bar';
    const isLineChart = chartType === 'line';
    const isPointChart = ['scatter', 'bubble'].includes(chartType);
    const duration = isInitialMotion
        ? (isSliceChart ? PREMIUM_CHART_MOTION.sliceDuration : PREMIUM_CHART_MOTION.initialDuration)
        : PREMIUM_CHART_MOTION.updateDuration;
    const easing = PREMIUM_CHART_MOTION.easing;
    const previousWasPremiumMotion = existingAnimation?.$mjuPremiumMotion === true;
    const previousDelay = typeof existingAnimation?.delay === 'function' && !existingAnimation.delay.$mjuPremiumDelay
        ? existingAnimation.delay
        : null;

    const premiumDelay = (context) => {
        const inheritedDelay = previousDelay ? Number(previousDelay(context)) || 0 : 0;
        return Math.min(
            inheritedDelay + chartElementDelay(context, chart, isSliceChart, isInitialMotion),
            isInitialMotion ? PREMIUM_CHART_MOTION.maxInitialDelay : PREMIUM_CHART_MOTION.maxUpdateDelay
        );
    };
    premiumDelay.$mjuPremiumDelay = true;

    options.animation = {
        ...(existingAnimation && typeof existingAnimation === 'object' ? existingAnimation : {}),
        duration: previousWasPremiumMotion || !(Number(existingAnimation?.duration) > 0)
            ? duration
            : existingAnimation.duration,
        easing: existingAnimation?.easing || easing,
        delay: premiumDelay,
        $mjuPremiumMotion: true,
    };

    if (isSliceChart) {
        options.animation.animateRotate = existingAnimation?.animateRotate ?? true;
        options.animation.animateScale = existingAnimation?.animateScale ?? true;
    }

    const animations = { ...(options.animations || {}) };
    animations.colors = {
        duration: isInitialMotion ? 360 : 220,
        easing,
        ...(animations.colors || {}),
    };

    if (isBarChart) {
        const indexAxis = options.indexAxis === 'y' ? 'y' : 'x';
        const valueAxis = indexAxis === 'y' ? 'x' : 'y';
        animations[valueAxis] = {
            duration,
            easing,
            from: (context) => baselineForScale(context, valueAxis),
            ...(animations[valueAxis] || {}),
        };
    }

    if (isLineChart || isPointChart) {
        animations.x = {
            duration: Math.round(duration * 0.92),
            easing,
            ...(isInitialMotion ? {
                from: context => context?.chart?.scales?.x?.left,
            } : {}),
            ...(animations.x || {}),
        };
        animations.y = {
            duration,
            easing,
            ...(animations.y || {}),
        };
        animations.radius = {
            duration: Math.round(duration * 0.72),
            easing,
            from: 0,
            ...(animations.radius || {}),
        };
    }

    if (isSliceChart) {
        animations.outerRadius = {
            duration,
            easing,
            from: 0,
            ...(animations.outerRadius || {}),
        };
        animations.circumference = {
            duration,
            easing,
            ...(animations.circumference || {}),
        };
    }

    options.animations = animations;
}

export const themeAdaptorPlugin = {
    id: 'themeAdaptor',
    beforeUpdate(chart, args) {
        const themeConfig = getCurrentChartTheme();
        const options = mutableChartOptions(chart);

        const chartType = baseChartType(chart);
        const isSliceChart = ['pie', 'doughnut', 'polarArea'].includes(chartType);

        sanitizeChartDatasetColors(chart, themeConfig.theme);
        applyPremiumChartMotion(chart, options, chartType, isSliceChart, args);
        options.font = withDashboardFont(options.font, '500');
        options.interaction = isSliceChart
            ? { ...(options.interaction || {}), mode: 'nearest', intersect: true }
            : { mode: 'index', intersect: false, ...(options.interaction || {}) };
        options.transitions = options.transitions || {};
        options.transitions.active = {
            ...(options.transitions.active || {}),
            animation: {
                duration: isSliceChart ? 180 : 160,
                easing: PREMIUM_CHART_MOTION.easing,
                ...(options.transitions.active?.animation || {}),
            },
        };
        options.hover = {
            mode: isSliceChart ? 'nearest' : 'index',
            intersect: isSliceChart,
            ...(options.hover || {}),
        };
        options.transitions.resize = {
            ...(options.transitions.resize || {}),
            animation: {
                duration: 0,
                ...(options.transitions.resize?.animation || {}),
            },
        };
        options.elements = options.elements || {};
        options.elements.line = {
            borderCapStyle: 'round',
            borderJoinStyle: 'round',
            ...(options.elements.line || {}),
        };
        options.elements.point = {
            hoverBorderWidth: 3,
            ...(options.elements.point || {}),
        };
        options.elements.bar = {
            borderRadius: 6,
            borderSkipped: false,
            ...(options.elements.bar || {}),
        };

        const scales = options.scales || {};
        for (const key of Object.keys(scales)) {
            const scale = scales[key];
            if (scale.ticks) {
                scale.ticks.color = themeConfig.muted;
                scale.ticks.font = withDashboardFont(scale.ticks.font, '500');
                scale.ticks.padding = scale.ticks.padding ?? 7;
                scale.ticks.autoSkipPadding = scale.ticks.autoSkipPadding ?? 12;
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
                scale.pointLabels.font = withDashboardFont(scale.pointLabels.font, '600');
            }
            if (scale.title && scale.title.display) {
                scale.title.color = themeConfig.text;
                scale.title.font = withDashboardFont(scale.title.font, '600');
            }
        }

        options.plugins = options.plugins || {};
        if (options.plugins.tooltip == null) options.plugins.tooltip = {};
        const tooltip = options.plugins.tooltip;
        if (tooltip) {
            tooltip.backgroundColor = themeConfig.tooltipBg;
            tooltip.titleColor = themeConfig.tooltipTitle;
            tooltip.bodyColor = themeConfig.tooltipBody;
            tooltip.borderColor = themeConfig.tooltipBorder;
            tooltip.borderWidth = 1;
            if (!tooltip.cornerRadius) tooltip.cornerRadius = 10;
            if (!tooltip.padding) tooltip.padding = 12;
            tooltip.titleFont = withDashboardFont(tooltip.titleFont, '600');
            tooltip.bodyFont = withDashboardFont(tooltip.bodyFont, '500');
            if (tooltip.displayColors == null) tooltip.displayColors = true;
            if (tooltip.boxPadding == null) tooltip.boxPadding = 7;
            tooltip.caretPadding = tooltip.caretPadding ?? 12;
            tooltip.titleMarginBottom = tooltip.titleMarginBottom ?? 8;
            tooltip.bodySpacing = tooltip.bodySpacing ?? 5;
            tooltip.usePointStyle = tooltip.usePointStyle ?? true;
            tooltip.multiKeyBackground = themeConfig.surface;
            tooltip.animation = {
                duration: prefersReducedMotion() ? 0 : 160,
                easing: PREMIUM_CHART_MOTION.easing,
                ...(tooltip.animation || {}),
            };
        }

        const legend = options.plugins?.legend;
        if (legend?.labels) {
            legend.labels.color = themeConfig.text;
            legend.labels.font = withDashboardFont(legend.labels.font, '600');
            legend.labels.usePointStyle = legend.labels.usePointStyle ?? true;
            legend.labels.pointStyle = legend.labels.pointStyle || 'roundedRect';
            legend.labels.boxWidth = legend.labels.boxWidth ?? 10;
            legend.labels.boxHeight = legend.labels.boxHeight ?? 10;
            legend.labels.padding = Math.max(Number(legend.labels.padding) || 0, 14);
        }

        const title = options.plugins?.title;
        if (title) {
            title.color = themeConfig.text;
            title.font = withDashboardFont(title.font, '600');
        }

        const subtitle = options.plugins?.subtitle;
        if (subtitle) {
            subtitle.color = themeConfig.muted;
            subtitle.font = withDashboardFont(subtitle.font, '500');
        }
    },
    afterUpdate(chart) {
        chart.$mjuHasAnimated = true;
    },
    afterEvent(chart, args) {
        const eventType = args?.event?.type;
        const pointerLeftChart = ['mouseout', 'mouseleave'].includes(eventType) || args?.inChartArea === false;
        if (!pointerLeftChart) return;

        const hasActiveElement = chart.getActiveElements?.().length > 0;
        const hasActiveTooltip = chart.tooltip?.getActiveElements?.().length > 0;
        if (!hasActiveElement && !hasActiveTooltip) return;

        chart.setActiveElements([]);
        if (chart.tooltip?.setActiveElements) {
            chart.tooltip.setActiveElements([], { x: 0, y: 0 });
        }
        chart.update('none');
    }
};
