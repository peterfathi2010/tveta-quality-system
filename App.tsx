import React, { Component, Suspense, lazy, ReactNode, ErrorInfo } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { DataProvider } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';
import Login from './pages/Login';

// --- Error Boundary Component ---
interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState;
  public props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-6 text-center">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl max-w-md w-full border border-rose-100 dark:border-rose-900">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-600">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2">حدث خطأ غير متوقع</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6">نواجه مشكلة في تحميل التطبيق على جهازك. يرجى التأكد من تحديث المتصفح والمحاولة مرة أخرى.</p>
            <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg text-left text-xs text-slate-400 font-mono mb-6 overflow-hidden">
               {this.state.error?.message}
            </div>
            <button 
              onClick={() => window.location.reload()} 
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              <RefreshCw size={18} /> إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children || null;
  }
}

// Utility to retry lazy imports if network fails (fixes "ChunkLoadError")
const lazyRetry = (importFn: () => Promise<{ default: React.ComponentType }>) => {
  return lazy(async () => {
    try {
      return await importFn();
    } catch (error) {
      console.warn("Chunk load failed, retrying...", error);
      // Wait 1 second and try again
      await new Promise(resolve => setTimeout(resolve, 1000));
      try {
        return await importFn();
      } catch (retryError) {
        console.error("Chunk load failed permanently", retryError);
        throw retryError; // Let ErrorBoundary handle it
      }
    }
  });
};

// Lazy loading pages with retry
const Dashboard = lazyRetry(() => import('./pages/Dashboard'));
const Team = lazyRetry(() => import('./pages/Team'));
const Auditors = lazyRetry(() => import('./pages/Auditors'));
const Visits = lazyRetry(() => import('./pages/Visits'));
const Reports = lazyRetry(() => import('./pages/Reports'));
const AIAssistant = lazyRetry(() => import('./pages/AIAssistant'));
const SystemBackup = lazyRetry(() => import('./pages/SystemBackup'));
const DriveManager = lazyRetry(() => import('./pages/DriveManager')); // New Page

const LoadingScreen = () => (
  <div className="h-full min-h-[500px] w-full flex items-center justify-center flex-col gap-4">
    <Loader2 className="animate-spin text-blue-500" size={40} />
    <p className="text-slate-500 dark:text-slate-400 font-medium animate-pulse text-sm">جاري تحميل البيانات...</p>
  </div>
);

// Performance Optimization: 
// Only wrap authenticated routes with DataProvider. 
const ProtectedRoute = ({ children }: { children?: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return (
    <DataProvider>
      {children}
    </DataProvider>
  );
};

// Redirect to Dashboard if already authenticated
const PublicRoute = ({ children }: { children?: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

// Admin Only Route Protection
const AdminRoute = ({ children }: { children?: ReactNode }) => {
    const { user } = useAuth();
    if (user?.role !== 'admin') {
        return <Navigate to="/" />;
    }
    return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Suspense fallback={<LoadingScreen />}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/support-team" element={<Team />} />
                  <Route path="/quality-officers" element={<Team />} />
                  <Route path="/auditors" element={<Auditors />} />
                  <Route path="/visits" element={<Visits />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/ai-assistant" element={<AIAssistant />} />
                  <Route path="/backup" element={<AdminRoute><SystemBackup /></AdminRoute>} />
                  <Route path="/drive" element={<AdminRoute><DriveManager /></AdminRoute>} />
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </Suspense>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

const App = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <HashRouter>
            <AppRoutes />
          </HashRouter>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;