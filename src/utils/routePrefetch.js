// Central registry of lazy-loaded route chunks.
// React.lazy uses guarded loaders so a stale hashed chunk after deploy can recover
// by refreshing once instead of showing the crash screen.

export const routeLoaders = {
    '/dashboard/tuition': () => import('../pages/TuitionPage'),
    '/dashboard/student-stats': () => import('../pages/StudentStatsPage'),
    '/dashboard/budget': () => import('../pages/BudgetForecastPage'),
    '/dashboard/financial': () => import('../pages/FinancialPage'),
    '/dashboard/student-life': () => import('../pages/StudentLifePage'),
    '/dashboard/students': () => import('../pages/StudentListPage'),
    '/dashboard/graduation': () => import('../pages/GraduationCheckPage'),
    '/dashboard/graduation-stats': () => import('../pages/GraduationStatsPage'),
    '/dashboard/academic-rules': () => import('../pages/AcademicRulesPage'),
    '/dashboard/hr': () => import('../pages/HRDashboardPage'),
    '/dashboard/research': () => import('../pages/ResearchDashboardPage'),
    '/dashboard/strategic': () => import('../pages/StrategicDashboardPage'),
    '/dashboard/ai-chat': () => import('../pages/AIChatPage'),
    '/dashboard/admin': () => import('../pages/AdminPanelPage'),
    '/dashboard/alerts': () => import('../pages/AlertCenterPage'),
};

const prefetched = new Set();
const CHUNK_RETRY_KEY = 'sci-ai-dashboard:chunk-retry';
const CHUNK_RETRY_WINDOW_MS = 30000;
const CHUNK_ERROR_PATTERNS = [
    'failed to fetch dynamically imported module',
    'error loading dynamically imported module',
    'importing a module script failed',
    'loading chunk',
    'chunkloaderror',
];

function readRetryMarker() {
    try {
        return JSON.parse(window.sessionStorage.getItem(CHUNK_RETRY_KEY) || 'null');
    } catch {
        return null;
    }
}

function clearRetryMarker() {
    try {
        window.sessionStorage.removeItem(CHUNK_RETRY_KEY);
    } catch {
        // Ignore storage errors. The reload guard is best effort.
    }
}

export function isChunkLoadError(error) {
    const message = `${error?.name || ''} ${error?.message || ''} ${error?.toString?.() || ''}`.toLowerCase();
    return CHUNK_ERROR_PATTERNS.some(pattern => message.includes(pattern));
}

export function reloadForFreshBuild(routeKey = 'unknown') {
    if (typeof window === 'undefined') return false;

    const now = Date.now();
    const marker = readRetryMarker();
    if (marker?.at && now - marker.at < CHUNK_RETRY_WINDOW_MS) {
        return false;
    }

    try {
        window.sessionStorage.setItem(CHUNK_RETRY_KEY, JSON.stringify({ routeKey, at: now }));
    } catch {
        // Continue with the refresh even if storage is unavailable.
    }

    const url = new URL(window.location.href);
    url.searchParams.set('__freshBuild', String(now));
    window.location.replace(url.toString());
    return true;
}

function withFreshBuildRecovery(loader, routeKey) {
    return async () => {
        try {
            const loadedModule = await loader();
            clearRetryMarker();
            return loadedModule;
        } catch (error) {
            if (isChunkLoadError(error) && reloadForFreshBuild(routeKey)) {
                return new Promise(() => {});
            }
            throw error;
        }
    };
}

export const lazyRouteLoaders = Object.fromEntries(
    Object.entries(routeLoaders).map(([path, loader]) => [path, withFreshBuildRecovery(loader, path)])
);

export function prefetchRoute(path) {
    if (prefetched.has(path)) return;
    const loader = routeLoaders[path];
    if (!loader) return;
    prefetched.add(path);
    // Fire and forget. Browser caches the chunk for the real navigation.
    loader().catch(() => prefetched.delete(path));
}
