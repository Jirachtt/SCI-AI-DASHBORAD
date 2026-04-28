export const DASHBOARD_FONT_FAMILY = "'Noto Sans Thai', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

function withDashboardFont(font = {}, fallbackWeight) {
    const next = { ...font, family: DASHBOARD_FONT_FAMILY };
    if (fallbackWeight && !next.weight) next.weight = fallbackWeight;
    return next;
}

/**
 * Chart.js plugin that automatically adapts chart colors to the current theme.
 * Register this once and all charts will have theme-aware tick/grid/tooltip colors
 * with a premium, modern aesthetic.
 */
export const themeAdaptorPlugin = {
    id: 'themeAdaptor',
    beforeUpdate(chart) {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        const textColor = isLight ? '#334155' : '#CBD5E1';
        const gridColor = isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(226, 232, 240, 0.08)';
        const tooltipBg = isLight ? 'rgba(248, 247, 255, 0.98)' : 'rgba(45, 39, 124, 0.96)';
        const tooltipText = isLight ? '#11135f' : '#ffffff';
        const tooltipBody = isLight ? '#343766' : '#e4e0ff';
        const tooltipBorder = isLight ? 'rgba(91, 95, 239, 0.28)' : 'rgba(167, 139, 250, 0.42)';

        chart.options.font = withDashboardFont(chart.options.font, '600');

        // Adapt scales
        const scales = chart.options.scales || {};
        for (const key of Object.keys(scales)) {
            const scale = scales[key];
            if (scale.ticks) {
                scale.ticks.color = textColor;
                scale.ticks.font = withDashboardFont(scale.ticks.font, '600');
            }
            if (scale.grid && scale.grid.display !== false) {
                scale.grid.color = gridColor;
                if (scale.grid.lineWidth == null) scale.grid.lineWidth = 0.5;
            }
            // Radar angle/grid lines
            if (scale.angleLines) {
                scale.angleLines.color = gridColor;
            }
            if (scale.pointLabels) {
                scale.pointLabels.color = isLight ? '#111827' : '#F8FAFC';
                scale.pointLabels.font = withDashboardFont(scale.pointLabels.font, '600');
            }
            // Scale title
            if (scale.title && scale.title.display) {
                scale.title.color = textColor;
                scale.title.font = withDashboardFont(scale.title.font, '600');
            }
        }

        // Adapt tooltip — premium glassmorphism style
        const tooltip = chart.options.plugins?.tooltip;
        if (tooltip) {
            tooltip.backgroundColor = tooltipBg;
            tooltip.titleColor = tooltipText;
            tooltip.bodyColor = tooltipBody;
            tooltip.borderColor = tooltipBorder;
            tooltip.borderWidth = 1;
            if (!tooltip.cornerRadius) tooltip.cornerRadius = 10;
            if (!tooltip.padding) tooltip.padding = 12;
            tooltip.titleFont = withDashboardFont(tooltip.titleFont, '700');
            tooltip.bodyFont = withDashboardFont(tooltip.bodyFont, '500');
            if (tooltip.displayColors == null) tooltip.displayColors = true;
            if (tooltip.boxPadding == null) tooltip.boxPadding = 4;
            tooltip.caretPadding = tooltip.caretPadding ?? 8;
            if (isLight) {
                tooltip.backgroundColor = tooltipBg;
                tooltip.borderColor = tooltipBorder;
            }
        }

        // Adapt legend
        const legend = chart.options.plugins?.legend;
        if (legend?.labels) {
            legend.labels.color = textColor;
            legend.labels.font = withDashboardFont(legend.labels.font, '600');
        }
    }
};
