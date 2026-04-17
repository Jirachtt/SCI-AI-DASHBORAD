import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { lazy, Suspense } from 'react';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import Layout from './components/Layout';
import DashboardHome from './pages/DashboardHome';
import { routeLoaders } from './utils/routePrefetch';
import './index.css';

// Lazy load heavy pages for better performance — shared with prefetchRoute
// so hovering a sidebar link warms the same chunk cache the router uses.
const TuitionPage = lazy(routeLoaders['/dashboard/tuition']);
const StudentStatsPage = lazy(routeLoaders['/dashboard/student-stats']);
const BudgetForecastPage = lazy(routeLoaders['/dashboard/budget']);
const FinancialPage = lazy(routeLoaders['/dashboard/financial']);
const StudentLifePage = lazy(routeLoaders['/dashboard/student-life']);
const StudentListPage = lazy(routeLoaders['/dashboard/students']);
const GraduationCheckPage = lazy(routeLoaders['/dashboard/graduation']);
const HRDashboardPage = lazy(routeLoaders['/dashboard/hr']);
const ResearchDashboardPage = lazy(routeLoaders['/dashboard/research']);
const StrategicDashboardPage = lazy(routeLoaders['/dashboard/strategic']);
const AIChatPage = lazy(routeLoaders['/dashboard/ai-chat']);
const GraduationStatsPage = lazy(routeLoaders['/dashboard/graduation-stats']);
const AdminPanelPage = lazy(routeLoaders['/dashboard/admin']);

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
      <Route path="/" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><SignUpPage /></PublicRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<DashboardHome />} />
        <Route path="tuition" element={<Suspense fallback={<PageLoader />}><TuitionPage /></Suspense>} />
        <Route path="student-stats" element={<Suspense fallback={<PageLoader />}><StudentStatsPage /></Suspense>} />
        <Route path="budget" element={<Suspense fallback={<PageLoader />}><BudgetForecastPage /></Suspense>} />
        <Route path="financial" element={<Suspense fallback={<PageLoader />}><FinancialPage /></Suspense>} />
        <Route path="student-life" element={<Suspense fallback={<PageLoader />}><StudentLifePage /></Suspense>} />
        <Route path="students" element={<Suspense fallback={<PageLoader />}><StudentListPage /></Suspense>} />
        <Route path="graduation" element={<Suspense fallback={<PageLoader />}><GraduationCheckPage /></Suspense>} />
        <Route path="graduation-stats" element={<Suspense fallback={<PageLoader />}><GraduationStatsPage /></Suspense>} />
        <Route path="hr" element={<Suspense fallback={<PageLoader />}><HRDashboardPage /></Suspense>} />
        <Route path="research" element={<Suspense fallback={<PageLoader />}><ResearchDashboardPage /></Suspense>} />
        <Route path="strategic" element={<Suspense fallback={<PageLoader />}><StrategicDashboardPage /></Suspense>} />
        <Route path="ai-chat" element={<Suspense fallback={<PageLoader />}><AIChatPage /></Suspense>} />
        <Route path="admin" element={<Suspense fallback={<PageLoader />}><AdminPanelPage /></Suspense>} />
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
