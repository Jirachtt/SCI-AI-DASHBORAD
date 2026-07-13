import { useEffect, useRef, useState } from 'react';

const COUNT_DURATION_MS = 360;

function parseMetric(value) {
    const text = value == null || value === '' ? '\u2014' : String(value);
    const match = text.match(/^\s*([-+]?\d[\d,]*(?:\.\d+)?)(.*)$/);
    if (!match) return { text, number: null };

    const number = Number(match[1].replaceAll(',', ''));
    if (!Number.isFinite(number)) return { text, number: null };
    const decimals = match[1].includes('.') ? match[1].split('.')[1].length : 0;
    return { text, number, decimals, suffix: match[2] || '' };
}

function formatMetric(number, decimals, suffix) {
    return `${number.toLocaleString('th-TH', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    })}${suffix}`;
}

export default function AnimatedMetricValue({ value }) {
    const parsed = parseMetric(value);
    const previousValue = useRef(parsed.number);
    const animationFrame = useRef(null);
    const [display, setDisplay] = useState(parsed.text);

    useEffect(() => {
        window.cancelAnimationFrame(animationFrame.current);
        const from = previousValue.current;
        previousValue.current = parsed.number;

        if (
            parsed.number == null
            || from == null
            || from === parsed.number
            || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ) {
            setDisplay(parsed.text);
            return undefined;
        }

        const startedAt = performance.now();
        const tick = now => {
            const progress = Math.min((now - startedAt) / COUNT_DURATION_MS, 1);
            const eased = 1 - ((1 - progress) ** 3);
            const next = from + ((parsed.number - from) * eased);
            setDisplay(formatMetric(next, parsed.decimals, parsed.suffix));
            if (progress < 1) animationFrame.current = window.requestAnimationFrame(tick);
        };
        animationFrame.current = window.requestAnimationFrame(tick);
        return () => window.cancelAnimationFrame(animationFrame.current);
    }, [parsed.decimals, parsed.number, parsed.suffix, parsed.text]);

    return <span className="animated-metric-value">{display}</span>;
}
