export function resolveChartPoint(chartData, element = {}) {
    const datasetIndex = element.datasetIndex ?? 0;
    const index = element.index ?? 0;
    const dataset = chartData?.datasets?.[datasetIndex] || {};
    const label = chartData?.labels?.[index] ?? dataset.labels?.[index] ?? '';
    const rawValue = Array.isArray(dataset.data) ? dataset.data[index] : undefined;
    const parsed = element?.element?.$context?.parsed;
    const valueFromRaw = typeof rawValue === 'object' && rawValue !== null
        ? rawValue.y ?? rawValue.x ?? rawValue.r ?? rawValue.value
        : rawValue;
    const value = valueFromRaw ?? parsed?.y ?? parsed?.x ?? parsed?.r;
    const color = Array.isArray(dataset.backgroundColor)
        ? dataset.backgroundColor[index]
        : (dataset.borderColor || dataset.backgroundColor);

    return {
        dataset,
        datasetIndex,
        index,
        label,
        value,
        rawValue,
        datasetLabel: dataset.label || '',
        color,
    };
}

export function withChartDrilldown(baseOptions = {}, chartData, openDetail, buildDetail) {
    const originalClick = baseOptions.onClick;
    const originalHover = baseOptions.onHover;

    return {
        ...baseOptions,
        onClick: (event, elements, chart) => {
            originalClick?.(event, elements, chart);
            if (!elements || elements.length === 0) return;
            const point = resolveChartPoint(chart?.data || chartData, elements[0]);
            if (point.value === null || point.value === undefined) return;
            const detail = buildDetail?.(point, chart);
            if (detail) openDetail(detail);
        },
        onHover: (event, elements, chart) => {
            originalHover?.(event, elements, chart);
            const target = event?.native?.target;
            if (target) target.style.cursor = elements?.length ? 'pointer' : 'default';
        },
    };
}

export function buildSimpleChartDetail({ chartTitle, point, unit = '', rows = [], columns, summary, metrics, note }) {
    return {
        title: chartTitle,
        subtitle: [point.datasetLabel, point.label].filter(Boolean).join(' / '),
        valueLabel: point.datasetLabel || 'ค่า',
        value: point.value,
        unit,
        accentColor: point.color,
        rows,
        columns,
        summary,
        metrics,
        note,
    };
}

export function normalizeThaiText(value) {
    return String(value || '').replace(/^ภาควิชา/, '').trim();
}
