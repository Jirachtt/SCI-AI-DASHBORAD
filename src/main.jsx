import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { isChunkLoadError, reloadForFreshBuild } from './utils/routePrefetch'

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', event => {
    if (isChunkLoadError(event.reason) && reloadForFreshBuild('unhandled-rejection')) {
      event.preventDefault();
    }
  });
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, isRecovering: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    if (isChunkLoadError(error) && reloadForFreshBuild('error-boundary')) {
      this.setState({ isRecovering: true });
      return;
    }

    this.setState({ error, errorInfo });
    console.error('Uncaught error:', error, errorInfo);
  }

  handleReload() {
    const url = new URL(window.location.href);
    url.searchParams.set('__manualReload', String(Date.now()));
    window.location.replace(url.toString());
  }

  render() {
    if (this.state.hasError) {
      const isChunkError = isChunkLoadError(this.state.error);
      const title = this.state.isRecovering
        ? 'กำลังโหลดหน้าเว็บเวอร์ชันล่าสุด'
        : 'โหลดหน้าเว็บไม่สำเร็จ';
      const message = isChunkError
        ? 'ระบบตรวจพบไฟล์หน้าเว็บจาก build เก่าหลังอัปเดตเว็บ กำลังพาไปโหลดเวอร์ชันล่าสุดให้อัตโนมัติ'
        : 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาโหลดหน้าใหม่อีกครั้ง';

      return (
        <div style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          background: 'linear-gradient(135deg, #f7f7ff 0%, #eef7ff 48%, #fdf6ff 100%)',
          color: '#111827',
          fontFamily: '"Noto Sans Thai", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}>
          <div style={{
            width: 'min(560px, 100%)',
            border: '1px solid rgba(99, 102, 241, 0.18)',
            borderRadius: 20,
            boxShadow: '0 24px 70px rgba(79, 70, 229, 0.16)',
            background: 'rgba(255, 255, 255, 0.86)',
            padding: 28,
            backdropFilter: 'blur(18px)',
          }}>
            <div style={{
              width: 54,
              height: 54,
              borderRadius: 16,
              display: 'grid',
              placeItems: 'center',
              color: '#4f46e5',
              background: 'linear-gradient(135deg, #eef2ff, #e0f2fe)',
              fontWeight: 800,
              marginBottom: 18,
            }}>
              SCI
            </div>
            <h1 style={{ margin: '0 0 10px', fontSize: 26, lineHeight: 1.25, color: '#0f172a' }}>
              {title}
            </h1>
            <p style={{ margin: '0 0 20px', color: '#475569', lineHeight: 1.75, fontSize: 15 }}>
              {message}
            </p>
            {!this.state.isRecovering && (
              <button
                type="button"
                onClick={() => this.handleReload()}
                style={{
                  border: 0,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: 700,
                  padding: '12px 18px',
                  boxShadow: '0 14px 30px rgba(79, 70, 229, 0.24)',
                }}
              >
                โหลดหน้าใหม่
              </button>
            )}
            {!isChunkError && this.state.error && (
              <details style={{ marginTop: 18, color: '#64748b', fontSize: 12, whiteSpace: 'pre-wrap' }}>
                {this.state.error.toString()}
                <br />
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
