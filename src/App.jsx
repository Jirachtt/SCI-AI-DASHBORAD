import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { lazy, Suspense } from 'react';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import Layout from './components/Layout';
import DashboardHome from './pages/DashboardHome';
import './index.css';

// Lazy load heavy pages for better performance
const TuitionPage = lazy(() => import('./pages/TuitionPage'));
const StudentStatsPage = lazy(() => import('./pages/StudentStatsPage'));
const BudgetForecastPage = lazy(() => import('./pages/BudgetForecastPage'));
const FinancialPage = lazy(() => import('./pages/FinancialPage'));
const StudentLifePage = lazy(() => import('./pages/StudentLifePage'));
const StudentListPage = lazy(() => import('./pages/StudentListPage'));
const GraduationCheckPage = lazy(() => import('./pages/GraduationCheckPage'));
const HRDashboardPage = lazy(() => import('./pages/HRDashboardPage'));
const ResearchDashboardPage = lazy(() => import('./pages/ResearchDashboardPage'));
const StrategicDashboardPage = lazy(() => import('./pages/StrategicDashboardPage'));
const AIChatPage = lazy(() => import('./pages/AIChatPage'));
const GraduationStatsPage = lazy(() => import('./pages/GraduationStatsPage'));

const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', fontSize: '0.95rem', color: '#9ca3af', gap: 10 }}>
    <div style={{ width: 20, height: 20, border: '2px solid rgba(0,166,81,0.3)', borderTopColor: '#00a651', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
    กำลังโหลด...
  </div>
);

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: '1.2rem', color: '#9ca3af' }}>กำลังโหลด...</div>;
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ color: 'white', textAlign: 'center', marginTop: '50px' }}>กำลังโหลดข้อมูล... (หากรอนานเกินไป กรุณารีเฟรช)</div>;
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
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
