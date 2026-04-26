/**
 * Chart.js plugin that automatically adapts chart colors to the current theme.
 * Register this once and all charts will have theme-aware tick/grid/tooltip colors
 * with a premium, modern aesthetic.
 */
export const themeAdaptorPlugin = {
    id: 'themeAdaptor',
    beforeUpdate(chart) {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        const textColor = isLight ? '#5A6577' : '#9ca3af';
        const gridColor = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
        const tooltipBg = isLight ? 'rgba(248, 247, 255, 0.98)' : 'rgba(45, 39, 124, 0.96)';
        const tooltipText = isLight ? '#11135f' : '#ffffff';
        const tooltipBody = isLight ? '#343766' : '#e4e0ff';
        const tooltipBorder = isLight ? 'rgba(91, 95, 239, 0.28)' : 'rgba(167, 139, 250, 0.42)';

        // Adapt scales
        const scales = chart.options.scales || {};
        for (const key of Object.keys(scales)) {
            const scale = scales[key];
            if (scale.ticks) {
                scale.ticks.color = textColor;
                if (!scale.ticks.font) scale.ticks.font = {};
                if (!scale.ticks.font.weight) scale.ticks.font.weight = '500';
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
                scale.pointLabels.color = isLight ? '#1A1D26' : '#e5e7eb';
            }
            // Scale title
            if (scale.title && scale.title.display) {
                scale.title.color = textColor;
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
            if (!tooltip.titleFont) tooltip.titleFont = {};
            tooltip.titleFont.weight = '700';
            if (!tooltip.bodyFont) tooltip.bodyFont = {};
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
            if (!legend.labels.font) legend.labels.font = {};
            if (!legend.labels.font.weight) legend.labels.font.weight = '500';
        }
    }
};
