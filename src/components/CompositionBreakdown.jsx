function toNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
}

function defaultFormatValue(value) {
    return toNumber(value).toLocaleString('th-TH');
}

const metricPalette = [
    { accent: '#2563eb', soft: '#eff6ff', track: '#dbeafe', badge: '#dbeafe' },
    { accent: '#7c3aed', soft: '#f5f3ff', track: '#ede9fe', badge: '#ede9fe' },
    { accent: '#f97316', soft: '#fff7ed', track: '#ffedd5', badge: '#ffedd5' },
    { accent: '#0d9488', soft: '#f0fdfa', track: '#ccfbf1', badge: '#ccfbf1' },
    { accent: '#db2777', soft: '#fdf2f8', track: '#fce7f3', badge: '#fce7f3' },
];

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

    if (!normalizedItems.length || !chartTotal) {
        return <div className="composition-breakdown-empty">No chartable composition data</div>;
    }

    return (
        <div className="composition-breakdown composition-metric-grid grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3" role="group" aria-label={ariaLabel}>
            {normalizedItems.map(item => {
                const pct = (item.value / chartTotal) * 100;
                const CardTag = onItemClick ? 'button' : 'article';
                const accent = item.color || item.palette.accent;
                const title = `${item.label}: ${formatValue(item.value)} (${pct.toFixed(1)}%)`;
                const style = {
                    '--metric-accent': accent,
                    '--metric-soft': item.softColor || item.palette.soft,
                    '--metric-track': item.trackColor || item.palette.track,
                    '--metric-badge': item.badgeColor || item.palette.badge,
                    '--metric-progress': `${Math.max(pct, pct > 0 ? 1.5 : 0)}%`,
                };

                return (
                    <CardTag
                        key={`${item.label}-${item.index}`}
                        type={onItemClick ? 'button' : undefined}
                        className="composition-metric-card bg-white rounded-2xl shadow-sm p-4 transition"
                        style={style}
                        title={onItemClick ? `${title} - click for detail` : title}
                        aria-label={title}
                        onClick={onItemClick ? () => onItemClick({ ...item, color: accent }, item.index) : undefined}
                    >
                        <span className="composition-metric-accent" aria-hidden="true" />
                        <div className="composition-metric-head flex items-start justify-between gap-3">
                            <span className="composition-metric-label">{item.label}</span>
                            <span className="composition-metric-badge">{pct.toFixed(1)}%</span>
                        </div>
                        <strong className="composition-metric-value font-bold">
                            {formatValue(item.value)}
                        </strong>
                        <div className="composition-metric-progress" aria-hidden="true">
                            <span />
                        </div>
                    </CardTag>
                );
            })}
        </div>
    );
}
