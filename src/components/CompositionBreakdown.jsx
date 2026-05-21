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

function pointOnCircle(cx, cy, radius, angleInDegrees) {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
    return {
        x: cx + (radius * Math.cos(angleInRadians)),
        y: cy + (radius * Math.sin(angleInRadians)),
    };
}

function describePieSlice(cx, cy, radius, startAngle, endAngle) {
    const start = pointOnCircle(cx, cy, radius, endAngle);
    const end = pointOnCircle(cx, cy, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

    return [
        `M ${cx} ${cy}`,
        `L ${start.x} ${start.y}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
        'Z',
    ].join(' ');
}

function buildVisibleSegments(items, total) {
    const minAngle = 3.25;
    const rawAngles = items.map(item => (item.value / total) * 360);
    const fixedAngles = rawAngles.map(angle => (angle > 0 && angle < minAngle ? minAngle : null));
    const fixedTotal = fixedAngles.reduce((sum, angle) => sum + (angle || 0), 0);
    const flexibleRawTotal = rawAngles.reduce((sum, angle, index) => sum + (fixedAngles[index] ? 0 : angle), 0);
    const flexibleTarget = Math.max(0, 360 - fixedTotal);
    let cursor = 0;

    return items.map((item, index) => {
        const visualAngle = fixedAngles[index] || (flexibleRawTotal ? (rawAngles[index] / flexibleRawTotal) * flexibleTarget : 0);
        const startAngle = cursor;
        const endAngle = cursor + visualAngle;
        cursor = endAngle;
        return {
            ...item,
            startAngle,
            endAngle,
            visualAngle,
        };
    });
}

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
    const segments = buildVisibleSegments(normalizedItems, chartTotal);

    if (!normalizedItems.length || !chartTotal) {
        return <div className="composition-breakdown-empty">No chartable composition data</div>;
    }

    return (
        <div className="composition-breakdown composition-pie-panel" role="group" aria-label={ariaLabel}>
            <div className="composition-pie-wrap">
                <svg className="composition-pie" viewBox="0 0 220 220" role="img">
                    <circle className="composition-pie-bg" cx="110" cy="110" r="101" />
                    {segments.map(item => {
                        const pct = (item.value / chartTotal) * 100;
                        const accent = item.color || item.palette.accent;
                        const title = `${item.label}: ${formatValue(item.value)} (${pct.toFixed(1)}%)`;
                        return (
                            <path
                                key={`${item.label}-${item.index}`}
                                d={describePieSlice(110, 110, 100, item.startAngle, item.endAngle)}
                                fill={accent}
                                className="composition-pie-slice"
                                role={onItemClick ? 'button' : 'img'}
                                tabIndex={onItemClick ? 0 : undefined}
                                aria-label={title}
                                onClick={onItemClick ? () => onItemClick({ ...item, color: accent }, item.index) : undefined}
                                onKeyDown={onItemClick ? (event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        onItemClick({ ...item, color: accent }, item.index);
                                    }
                                } : undefined}
                            />
                        );
                    })}
                </svg>
                <div className="composition-pie-center">
                    <span>Total</span>
                    <strong>{formatValue(chartTotal)}</strong>
                </div>
            </div>

            <div className="composition-pie-legend">
                {segments.map(item => {
                    const pct = (item.value / chartTotal) * 100;
                    const RowTag = onItemClick ? 'button' : 'div';
                    const accent = item.color || item.palette.accent;
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
                            </div>
                            <em>{pct.toFixed(1)}%</em>
                        </RowTag>
                    );
                })}
            </div>
        </div>
    );
}
