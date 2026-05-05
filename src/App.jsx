import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { lazy, Suspense } from 'react';
import { lazyRouteLoaders } from './utils/routePrefetch';
import './index.css';

// Lazy load heavy pages for better performance — shared with prefetchRoute
// so hovering a sidebar link warms the same chunk cache the router uses.
const Layout = lazy(() => import('./components/Layout'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignUpPage = lazy(() => import('./pages/SignUpPage'));
const MjuAuthCallbackPage = lazy(() => import('./pages/MjuAuthCallbackPage'));
const MjuSignoutPage = lazy(() => import('./pages/MjuSignoutPage'));
const DashboardHome = lazy(lazyRouteLoaders['/dashboard']);
const TuitionPage = lazy(lazyRouteLoaders['/dashboard/tuition']);
const StudentStatsPage = lazy(lazyRouteLoaders['/dashboard/student-stats']);
const TcasPlanningPage = lazy(lazyRouteLoaders['/dashboard/tcas']);
const CourseAnalyticsPage = lazy(lazyRouteLoaders['/dashboard/course-analytics']);
const BudgetForecastPage = lazy(lazyRouteLoaders['/dashboard/budget']);
const FinancialPage = lazy(lazyRouteLoaders['/dashboard/financial']);
const StudentLifePage = lazy(lazyRouteLoaders['/dashboard/student-life']);
const StudentListPage = lazy(lazyRouteLoaders['/dashboard/students']);
const GraduationCheckPage = lazy(lazyRouteLoaders['/dashboard/graduation']);
const HRDashboardPage = lazy(lazyRouteLoaders['/dashboard/hr']);
const ResearchDashboardPage = lazy(lazyRouteLoaders['/dashboard/research']);
const StrategicDashboardPage = lazy(lazyRouteLoaders['/dashboard/strategic']);
const AIChatPage = lazy(lazyRouteLoaders['/dashboard/ai-chat']);
const GraduationStatsPage = lazy(lazyRouteLoaders['/dashboard/graduation-stats']);
const AdminPanelPage = lazy(lazyRouteLoaders['/dashboard/admin']);
const AlertCenterPage = lazy(lazyRouteLoaders['/dashboard/alerts']);
const AcademicRulesPage = lazy(lazyRouteLoaders['/dashboard/academic-rules']);

const PageLoader = () => (
  <div className="page-loader">
    <div className="page-loader-inner">
      <div className="page-loader-bar" />
      <div className="page-loader-content">
        <div className="page-loader-shimmer" style={{ height: 32, width: '45%', borderRadius: 8 }} />
        <div className="page-loader-shimmer" style={{ height: 16, width: '30%', borderRadius: 6, marginTop: 8 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginTop: 28 }}>
          {[1, 2, 3, 4].map(i => <div key={i} className="page-loader-shimmer" style={{ height: 120, borderRadius: 16 }} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginTop: 20 }}>
          <div className="page-loader-shimmer" style={{ height: 200, borderRadius: 16 }} />
          <div className="page-loader-shimmer" style={{ height: 200, borderRadius: 16 }} />
        </div>
      </div>
    </div>
  </div>
);

const AuthLoader = () => (
  <div className="auth-loader">
    <div className="auth-loader-card">
      <div className="auth-loader-logo">SCI</div>
      <div className="auth-loader-spinner" />
      <div className="auth-loader-text">กำลังโหลด...</div>
      <div className="auth-loader-bar"><span /></div>
    </div>
  </div>
);

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoader />;
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoader />;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicRoute><Suspense fallback={<AuthLoader />}><LoginPage /></Suspense></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Suspense fallback={<AuthLoader />}><SignUpPage /></Suspense></PublicRoute>} />
      <Route path="/auth/mju/callback" element={<Suspense fallback={<AuthLoader />}><MjuAuthCallbackPage /></Suspense>} />
      <Route path="/auth/mju/signout" element={<Suspense fallback={<AuthLoader />}><MjuSignoutPage /></Suspense>} />
      <Route path="/dashboard" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><Layout /></Suspense></ProtectedRoute>}>
        <Route index element={<Suspense fallback={<PageLoader />}><DashboardHome /></Suspense>} />
        <Route path="tuition" element={<Suspense fallback={<PageLoader />}><TuitionPage /></Suspense>} />
        <Route path="student-stats" element={<Suspense fallback={<PageLoader />}><StudentStatsPage /></Suspense>} />
        <Route path="tcas" element={<Suspense fallback={<PageLoader />}><TcasPlanningPage /></Suspense>} />
        <Route path="course-analytics" element={<Suspense fallback={<PageLoader />}><CourseAnalyticsPage /></Suspense>} />
        <Route path="budget" element={<Suspense fallback={<PageLoader />}><BudgetForecastPage /></Suspense>} />
        <Route path="financial" element={<Suspense fallback={<PageLoader />}><FinancialPage /></Suspense>} />
        <Route path="student-life" element={<Suspense fallback={<PageLoader />}><StudentLifePage /></Suspense>} />
        <Route path="students" element={<Suspense fallback={<PageLoader />}><StudentListPage /></Suspense>} />
        <Route path="graduation" element={<Suspense fallback={<PageLoader />}><GraduationCheckPage /></Suspense>} />
        <Route path="graduation-stats" element={<Suspense fallback={<PageLoader />}><GraduationStatsPage /></Suspense>} />
        <Route path="academic-rules" element={<Suspense fallback={<PageLoader />}><AcademicRulesPage /></Suspense>} />
        <Route path="hr" element={<Suspense fallback={<PageLoader />}><HRDashboardPage /></Suspense>} />
        <Route path="research" element={<Suspense fallback={<PageLoader />}><ResearchDashboardPage /></Suspense>} />
        <Route path="strategic" element={<Suspense fallback={<PageLoader />}><StrategicDashboardPage /></Suspense>} />
        <Route path="ai-chat" element={<Suspense fallback={<PageLoader />}><AIChatPage /></Suspense>} />
        <Route path="admin" element={<Suspense fallback={<PageLoader />}><AdminPanelPage /></Suspense>} />
        <Route path="alerts" element={<Suspense fallback={<PageLoader />}><AlertCenterPage /></Suspense>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
