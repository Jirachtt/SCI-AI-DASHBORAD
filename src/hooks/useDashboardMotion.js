import { useLayoutEffect } from 'react';
import { Chart as ChartJS } from 'chart.js';

const REVEAL_SELECTOR = [
    '.section-header',
    '.stats-grid > *',
    '.admin-stats-grid > *',
    '.chart-card',
    '.topic-card',
    '.data-table-container',
    '.filter-bar',
    '.admin-stat-card',
    '.admin-pending-card',
    '.admin-data-status-card',
    '.auto-sync-card',
    '.ai-command-status-card',
    '.ai-page-chart-container',
    '.ai-answer-action-row',
    'canvas',
].join(',');

function prefersReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/**
 * Registers one observer for the current dashboard route. Dynamic results such
 * as AI charts are picked up by the same mutation observer and revealed once.
 */
export default function useDashboardMotion(rootRef, routeKey) {
    useLayoutEffect(() => {
        const root = rootRef.current;
        if (!root) return undefined;

        const targets = new Set();
        const reducedMotion = prefersReducedMotion();
        let order = 0;

        const reveal = element => {
            element.classList.add('motion-revealed');
            element.removeAttribute('aria-hidden');

            if (element.tagName === 'CANVAS' && element.dataset.motionChartDeferred === 'true') {
                const chart = ChartJS.getChart(element);
                if (chart && !chart.$mjuViewportMotionPlayed) {
                    chart.$mjuViewportMotionPlayed = true;
                    chart.$mjuHasAnimated = false;
                    chart.reset();
                    chart.update();
                }
            }
        };

        const observer = reducedMotion || typeof IntersectionObserver === 'undefined'
            ? null
            : new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    reveal(entry.target);
                    observer.unobserve(entry.target);
                });
            }, {
                threshold: 0.08,
                rootMargin: '0px 0px -6% 0px',
            });

        const register = scope => {
            const candidates = [];
            if (scope instanceof Element && scope.matches(REVEAL_SELECTOR)) candidates.push(scope);
            scope.querySelectorAll?.(REVEAL_SELECTOR).forEach(element => candidates.push(element));

            candidates.forEach(element => {
                if (element.dataset.motionObserved === 'true') return;
                element.dataset.motionObserved = 'true';
                element.classList.add('motion-reveal-item');
                element.style.setProperty('--motion-order', String(Math.min(order % 6, 5)));
                if (element.tagName === 'CANVAS') {
                    const rect = element.getBoundingClientRect();
                    const outsideViewport = rect.top >= window.innerHeight || rect.bottom <= 0;
                    if (outsideViewport) element.dataset.motionChartDeferred = 'true';
                }
                order += 1;
                targets.add(element);

                if (observer) observer.observe(element);
                else reveal(element);
            });
        };

        const frame = window.requestAnimationFrame(() => register(root));
        const mutations = new MutationObserver(records => {
            records.forEach(record => {
                record.addedNodes.forEach(node => {
                    if (node instanceof Element) register(node);
                });
            });
        });
        mutations.observe(root, { childList: true, subtree: true });

        const clearInactiveChartTooltips = event => {
            if (event.target instanceof HTMLCanvasElement) return;
            Object.values(ChartJS.instances || {}).forEach(chart => {
                const hasActiveElement = chart.getActiveElements?.().length > 0;
                const hasActiveTooltip = chart.tooltip?.getActiveElements?.().length > 0;
                if (!hasActiveElement && !hasActiveTooltip) return;
                chart.setActiveElements([]);
                chart.tooltip?.setActiveElements?.([], { x: 0, y: 0 });
                chart.update('none');
            });
        };
        document.addEventListener('pointerover', clearInactiveChartTooltips, { passive: true });

        return () => {
            window.cancelAnimationFrame(frame);
            mutations.disconnect();
            observer?.disconnect();
            document.removeEventListener('pointerover', clearInactiveChartTooltips);
            targets.forEach(element => {
                element.classList.remove('motion-reveal-item', 'motion-revealed');
                element.removeAttribute('data-motion-observed');
                element.removeAttribute('data-motion-chart-deferred');
                element.style.removeProperty('--motion-order');
            });
        };
    }, [rootRef, routeKey]);
}
