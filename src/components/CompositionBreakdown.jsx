import { legacyColorToVar } from '../utils/themeTokens';

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

function pointOnCircle(cx, cy, radius, angleInDegrees) {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
    return {
        x: cx + (radius * Math.cos(angleInRadians)),
        y: cy + (radius * Math.sin(angleInRadians)),
    };
}

function describeDonutSlice(cx, cy, outerRadius, innerRadius, startAngle, endAngle) {
    const outerStart = pointOnCircle(cx, cy, outerRadius, endAngle);
    const outerEnd = pointOnCircle(cx, cy, outerRadius, startAngle);
    const innerStart = pointOnCircle(cx, cy, innerRadius, startAngle);
    const innerEnd = pointOnCircle(cx, cy, innerRadius, endAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

    return [
        `M ${outerStart.x} ${outerStart.y}`,
        `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 0 ${outerEnd.x} ${outerEnd.y}`,
        `L ${innerStart.x} ${innerStart.y}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${innerEnd.x} ${innerEnd.y}`,
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
    const leadingItem = normalizedItems[0];
    const leadingPct = leadingItem ? (leadingItem.value / chartTotal) * 100 : 0;

    if (!normalizedItems.length || !chartTotal) {
        return <div className="composition-breakdown-empty">No chartable composition data</div>;
    }

    return (
        <div className="composition-breakdown composition-pie-panel" role="group" aria-label={ariaLabel}>
            <div className="composition-pie-wrap">
                <div className="composition-pie-figure">
                    <svg className="composition-pie" viewBox="0 0 220 220" role="img">
                        <circle className="composition-pie-bg" cx="110" cy="110" r="100" />
                        {segments.map(item => {
                            const pct = (item.value / chartTotal) * 100;
                            const accent = segmentAccent(item);
                            const title = `${item.label}: ${formatValue(item.value)} (${pct.toFixed(1)}%)`;
                            return (
                                <path
                                    key={`${item.label}-${item.index}`}
                                    d={describeDonutSlice(110, 110, 100, 62, item.startAngle, item.endAngle)}
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
                        <span>รวม</span>
                        <strong>{formatValue(chartTotal)}</strong>
                    </div>
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
