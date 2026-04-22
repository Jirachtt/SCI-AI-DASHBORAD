// Central registry of lazy-loaded route chunks.
// Each entry returns the dynamic import promise so the same call
// both loads the chunk on demand (React.lazy) and warms the cache on hover.

export const routeLoaders = {
    '/dashboard/tuition': () => import('../pages/TuitionPage'),
    '/dashboard/student-stats': () => import('../pages/StudentStatsPage'),
    '/dashboard/budget': () => import('../pages/BudgetForecastPage'),
    '/dashboard/financial': () => import('../pages/FinancialPage'),
    '/dashboard/student-life': () => import('../pages/StudentLifePage'),
    '/dashboard/students': () => import('../pages/StudentListPage'),
    '/dashboard/graduation': () => import('../pages/GraduationCheckPage'),
    '/dashboard/graduation-stats': () => import('../pages/GraduationStatsPage'),
    '/dashboard/hr': () => import('../pages/HRDashboardPage'),
    '/dashboard/research': () => import('../pages/ResearchDashboardPage'),
    '/dashboard/strategic': () => import('../pages/StrategicDashboardPage'),
    '/dashboard/ai-chat': () => import('../pages/AIChatPage'),
    '/dashboard/admin': () => import('../pages/AdminPanelPage'),
    '/dashboard/alerts': () => import('../pages/AlertCenterPage'),
    '/dashboard/retention': () => import('../pages/RetentionPage'),
};

const prefetched = new Set();

export function prefetchRoute(path) {
    if (prefetched.has(path)) return;
    const loader = routeLoaders[path];
    if (!loader) return;
    prefetched.add(path);
    // Fire and forget — browser caches the chunk for the real navigation.
    loader().catch(() => prefetched.delete(path));
}
