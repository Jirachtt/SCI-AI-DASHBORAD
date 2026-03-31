/**
 * Chart.js plugin that automatically adapts chart colors to the current theme.
 * Register this once and all charts will have theme-aware tick/grid/tooltip colors.
 */
export const themeAdaptorPlugin = {
    id: 'themeAdaptor',
    beforeUpdate(chart) {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        const textColor = isLight ? '#5A6577' : '#9ca3af';
        const gridColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';
        const tooltipBg = isLight ? '#ffffff' : '#1e293b';
        const tooltipText = isLight ? '#1A1D26' : '#f1f3f8';
        const tooltipBorder = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';

        // Adapt scales
        const scales = chart.options.scales || {};
        for (const key of Object.keys(scales)) {
            const scale = scales[key];
            if (scale.ticks) {
                scale.ticks.color = textColor;
            }
            if (scale.grid && scale.grid.display !== false) {
                scale.grid.color = gridColor;
            }
            // Radar angle/grid lines
            if (scale.angleLines) {
                scale.angleLines.color = gridColor;
            }
            if (scale.pointLabels) {
                scale.pointLabels.color = isLight ? '#1A1D26' : '#e5e7eb';
            }
        }

        // Adapt tooltip
        const tooltip = chart.options.plugins?.tooltip;
        if (tooltip) {
            tooltip.backgroundColor = tooltipBg;
            tooltip.titleColor = tooltipText;
            tooltip.bodyColor = tooltipText;
            tooltip.borderColor = tooltipBorder;
            tooltip.borderWidth = 1;
        }

        // Adapt legend
        const legend = chart.options.plugins?.legend;
        if (legend?.labels) {
            legend.labels.color = textColor;
        }
    }
};
