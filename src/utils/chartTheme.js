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
        const textColorStrong = isLight ? '#374151' : '#d1d5db';
        const gridColor = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
        const tooltipBg = isLight ? 'rgba(255, 255, 255, 0.96)' : 'rgba(15, 20, 35, 0.95)';
        const tooltipText = isLight ? '#1A1D26' : '#f1f3f8';
        const tooltipBody = isLight ? '#4B5563' : '#e5e7eb';
        const tooltipBorder = isLight ? 'rgba(0, 104, 56, 0.12)' : 'rgba(0, 230, 118, 0.15)';

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
            // Light mode shadow
            if (isLight) {
                tooltip.backgroundColor = 'rgba(255, 255, 255, 0.97)';
                tooltip.borderColor = 'rgba(0, 104, 56, 0.15)';
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
