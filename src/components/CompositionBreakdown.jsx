function toNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
}

function defaultFormatValue(value) {
    return toNumber(value).toLocaleString('th-TH');
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
            color: item?.color || ['#2563eb', '#0f766e', '#d97706', '#7c3aed', '#be123c'][index % 5],
        }))
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value || a.index - b.index);
    const chartTotal = toNumber(total) || normalizedItems.reduce((sum, item) => sum + item.value, 0);

    if (!normalizedItems.length || !chartTotal) {
        return <div className="composition-breakdown-empty">No chartable composition data</div>;
    }

    return (
        <div className="composition-breakdown" role="group" aria-label={ariaLabel}>
            <div className="composition-strip" aria-hidden="true">
                {normalizedItems.map(item => {
                    const pct = (item.value / chartTotal) * 100;
                    const style = {
                        flexGrow: item.value,
                        background: item.color,
                        minWidth: pct < 2 ? 10 : 0,
                    };
                    const title = `${item.label}: ${formatValue(item.value)} (${pct.toFixed(1)}%)`;
                    return onItemClick ? (
                        <button
                            key={`${item.label}-${item.index}`}
                            type="button"
                            className="composition-segment"
                            style={style}
                            title={title}
                            aria-label={title}
                            onClick={() => onItemClick(item, item.index)}
                        />
                    ) : (
                        <span
                            key={`${item.label}-${item.index}`}
                            className="composition-segment"
                            style={style}
                            title={title}
                        />
                    );
                })}
            </div>

            <div className="composition-list">
                {normalizedItems.map(item => {
                    const pct = (item.value / chartTotal) * 100;
                    const RowTag = onItemClick ? 'button' : 'div';
                    return (
                        <RowTag
                            key={`${item.label}-${item.index}`}
                            type={onItemClick ? 'button' : undefined}
                            className="composition-row"
                            onClick={onItemClick ? () => onItemClick(item, item.index) : undefined}
                            title={onItemClick ? `${item.label} detail` : undefined}
                        >
                            <span className="composition-swatch" style={{ background: item.color }} />
                            <span className="composition-label">{item.label}</span>
                            <span className="composition-track">
                                <span style={{ width: `${Math.max(pct, pct > 0 ? 1.4 : 0)}%`, background: item.color }} />
                            </span>
                            <strong>{formatValue(item.value)}</strong>
                            <em>{pct.toFixed(1)}%</em>
                        </RowTag>
                    );
                })}
            </div>
        </div>
    );
}
