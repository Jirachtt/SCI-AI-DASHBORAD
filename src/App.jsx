import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import Layout from './components/Layout';
import DashboardHome from './pages/DashboardHome';
import TuitionPage from './pages/TuitionPage';
import StudentStatsPage from './pages/StudentStatsPage';
import BudgetForecastPage from './pages/BudgetForecastPage';
import FinancialPage from './pages/FinancialPage';
import StudentLifePage from './pages/StudentLifePage';
import StudentListPage from './pages/StudentListPage';
import GraduationCheckPage from './pages/GraduationCheckPage';
import './index.css';

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
        <Route path="tuition" element={<TuitionPage />} />
        <Route path="student-stats" element={<StudentStatsPage />} />
        <Route path="budget" element={<BudgetForecastPage />} />
        <Route path="financial" element={<FinancialPage />} />
        <Route path="student-life" element={<StudentLifePage />} />
        <Route path="students" element={<StudentListPage />} />
        <Route path="graduation" element={<GraduationCheckPage />} />
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
