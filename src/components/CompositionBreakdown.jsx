import { legacyColorToVar } from '../utils/themeTokens';
import { Doughnut } from 'react-chartjs-2';

function toNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
}

function defaultFormatValue(value) {
    return toNumber(value).toLocaleString('th-TH');
}

const metricPalette = [
    { accent: 'var(--chart-1)' },
    { accent: 'var(--chart-2)' },
    { accent: 'var(--chart-3)' },
    { accent: 'var(--chart-4)' },
    { accent: 'var(--chart-5)' },
];

function segmentAccent(item) {
    const fallbackToken = `--chart-${(item.index % 12) + 1}`;
    return item.color ? legacyColorToVar(item.color, fallbackToken) : item.palette.accent;
}

const compositionCenterTextPlugin = {
    id: 'compositionCenterText',
    afterDraw(chart, _args, options) {
        const firstArc = chart.getDatasetMeta(0)?.data?.[0];
        if (!firstArc || !options?.value) return;

        const styles = getComputedStyle(document.documentElement);
        const muted = styles.getPropertyValue('--text-muted').trim() || '#64748b';
        const primary = styles.getPropertyValue('--text-primary').trim() || '#111827';
        const family = styles.getPropertyValue('--font-sans').trim() || 'sans-serif';
        const { ctx } = chart;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = muted;
        ctx.font = `700 12px ${family}`;
        ctx.fillText(options.label || 'รวม', firstArc.x, firstArc.y - 10);
        ctx.fillStyle = primary;
        ctx.font = `900 18px ${family}`;
        ctx.fillText(options.value, firstArc.x, firstArc.y + 12);
        ctx.restore();
    },
};

export default function CompositionBreakdown({
    items = [],
    total,
    formatValue = defaultFormatValue,
    onItemClick,
    ariaLabel = 'composition breakdown',
}) {
    const normalizedItems = (Array.isArray(items) ? items : [])
        .map((item, index) => ({
            ...item,
            index,
            value: toNumber(item?.value ?? item?.count),
            label: item?.label ?? item?.name ?? item?.level ?? `Item ${index + 1}`,
            palette: metricPalette[index % metricPalette.length],
        }))
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value || a.index - b.index);
    const chartTotal = toNumber(total) || normalizedItems.reduce((sum, item) => sum + item.value, 0);
    const segments = normalizedItems;
    const leadingItem = normalizedItems[0];
    const leadingPct = leadingItem ? (leadingItem.value / chartTotal) * 100 : 0;

    if (!normalizedItems.length || !chartTotal) {
        return <div className="composition-breakdown-empty">No chartable composition data</div>;
    }

    const chartData = {
        labels: segments.map(item => item.label),
        datasets: [{
            label: 'จำนวนนิสิต',
            data: segments.map(item => item.value),
            backgroundColor: segments.map(segmentAccent),
            borderColor: 'var(--chart-surface)',
            borderWidth: 2.75,
            hoverBorderWidth: 3,
            hoverOffset: 5,
            spacing: 1,
        }],
    };
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        layout: { padding: 6 },
        plugins: {
            legend: { display: false },
            compositionCenterText: {
                label: 'รวม',
                value: formatValue(chartTotal),
            },
            tooltip: {
                displayColors: true,
                callbacks: {
                    label: context => {
                        const value = toNumber(context.raw);
                        const pct = chartTotal ? (value / chartTotal) * 100 : 0;
                        return `${formatValue(value)} คน (${pct.toFixed(1)}%)`;
                    },
                },
            },
        },
        onClick: onItemClick ? (_event, activeElements) => {
            const selectedIndex = activeElements?.[0]?.index;
            const item = segments[selectedIndex];
            if (!item) return;
            onItemClick({ ...item, color: segmentAccent(item) }, item.index);
        } : undefined,
        onHover: (event, activeElements) => {
            if (event?.native?.target) {
                event.native.target.style.cursor = onItemClick && activeElements.length ? 'pointer' : 'default';
            }
        },
    };

    return (
        <div className="composition-breakdown composition-pie-panel" role="group" aria-label={ariaLabel}>
            <div className="composition-pie-wrap">
                <div className="composition-pie-figure">
                    <Doughnut
                        className="composition-pie"
                        data={chartData}
                        options={chartOptions}
                        plugins={[compositionCenterTextPlugin]}
                        role="img"
                        aria-label={ariaLabel}
                    />
                </div>
                {leadingItem && (
                    <div className="composition-pie-primary">
                        <span>{leadingItem.label}</span>
                        <strong>{leadingPct.toFixed(1)}%</strong>
                    </div>
                )}
            </div>

            <div className="composition-pie-legend">
                {segments.map(item => {
                    const pct = (item.value / chartTotal) * 100;
                    const RowTag = onItemClick ? 'button' : 'div';
                    const accent = segmentAccent(item);
                    const title = `${item.label}: ${formatValue(item.value)} (${pct.toFixed(1)}%)`;

                    return (
                        <RowTag
                            key={`${item.label}-${item.index}`}
                            type={onItemClick ? 'button' : undefined}
                            className="composition-pie-legend-row"
                            style={{ '--segment-color': accent }}
                            title={onItemClick ? `${title} - click for detail` : title}
                            aria-label={onItemClick ? title : undefined}
                            onClick={onItemClick ? () => onItemClick({ ...item, color: accent }, item.index) : undefined}
                        >
                            <span className="composition-pie-dot" aria-hidden="true" />
                            <div className="composition-pie-legend-copy">
                                <span>{item.label}</span>
                                <strong>{formatValue(item.value)}</strong>
                                <i className="composition-pie-progress" aria-hidden="true">
                                    <b style={{ width: `${Math.max(1, Math.min(100, pct))}%` }} />
                                </i>
                            </div>
                            <em>{pct.toFixed(1)}%</em>
                        </RowTag>
                    );
                })}
            </div>
        </div>
    );
}
