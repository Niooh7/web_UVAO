import React, { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { User } from './types';
import { ThemeProvider } from './contexts/ThemeContext';
import { Clock } from 'lucide-react';
import Login from './components/Login';
import Layout from './components/Layout';
import axios, { AxiosError } from 'axios';
import api, { setToken, clearToken } from './utils/api';
import debounce from 'lodash.debounce';

// Ленивая загрузка — каждая страница грузится только при переходе на неё
const Dashboard               = lazy(() => import('./components/Dashboards'));
const ReportViewer            = lazy(() => import('./components/ReportViewer'));
const Scripts                 = lazy(() => import('./components/Scripts'));
const Knowledge               = lazy(() => import('./components/Knowledge'));
const ArchiveReports          = lazy(() => import('./components/Analytics/ArchiveReports'));
const AnalyticsDashboard      = lazy(() => import('./components/Analytics/Dashboard'));
const NgOverdueDashboard      = lazy(() => import('./components/Analytics/NgOverdueDashboard'));
const TransferStatisticsReport = lazy(() => import('./components/TransferStatisticsReport'));
const BotTransfers            = lazy(() => import('./components/Analytics/BotTransfers'));
const AdminPanel              = lazy(() => import('./components/AdminPanel'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="relative w-9 h-9">
        <div className="absolute inset-0 rounded-full border-[3px] border-gray-200 dark:border-gray-700" />
        <div className="absolute inset-0 rounded-full border-[3px] border-primary-500 border-t-transparent animate-spin" />
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [lastActivity, setLastActivity] = useState(() => {
    const savedTime = localStorage.getItem('lastActivity');
    return savedTime ? parseInt(savedTime, 10) : Date.now();
  });
  const [showInactivityDialog, setShowInactivityDialog] = useState(false);

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
  };

  const handleActivity = debounce(async () => {
    const now = Date.now();
    setLastActivity(now);
    localStorage.setItem('lastActivity', now.toString());

    if (user) {
      try {
        await api.post('/api/update-last-visit', {
          userId: user.id,
          lastVisit: formatDate(now),
        });
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.error('Axios error:', error.message);
          if (error.response) {
            console.error('Server response:', error.response.data);
            console.error('Status code:', error.response.status);
          } else if (error.request) {
            console.error('No response received:', error.request);
          } else {
            console.error('Request setup error:', error.message);
          }
        } else {
          console.error('Unknown error:', error);
        }
      }
    }
  }, 5000);

  useEffect(() => {
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);

    const checkInactivity = setInterval(() => {
      const inactiveTime = Date.now() - lastActivity;
      if (inactiveTime > 90 * 60 * 1000) {
        setShowInactivityDialog(true);
        handleLogout();
      }
    }, 60000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      clearInterval(checkInactivity);
    };
  }, [lastActivity, user]);

  const handleLogin = (userData: User, token: string) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(token);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('lastActivity');
    clearToken();
  };

  const handleCloseInactivityDialog = () => {
    setShowInactivityDialog(false);
  };

  if (!user) {
    return (
      <ThemeProvider>
        <Login onLogin={(user, token) => handleLogin(user, token)} />
        {showInactivityDialog && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-gray-100 dark:border-gray-800 animate-slide-up">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Сессия завершена
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-5">
                Рабочая сессия автоматически завершается после 90 минут
                неактивности. Для продолжения работы войдите в систему снова.
              </p>
              <button
                onClick={handleCloseInactivityDialog}
                className="w-full bg-primary-600 hover:bg-primary-700 active:scale-[0.98] text-white font-medium py-2.5 rounded-xl transition-all duration-200"
              >
                Понятно
              </button>
            </div>
          </div>
        )}
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Layout user={user} onLogout={handleLogout} />}>
              <Route index element={<Dashboard user={user} />} />
              <Route path="report/bot-transfers" element={<BotTransfers user={user} />} />
              <Route path="report/:type" element={<ReportViewer user={user} />} />
              <Route path="scripts" element={<Scripts />} />
              <Route path="knowledge" element={<Knowledge user={user} />} />

              <Route path="analytics/archive" element={<ArchiveReports user={user} />} />
              <Route path="analytics/dashboard" element={<AnalyticsDashboard user={user} />} />
              <Route path="analytics/ng-overdue" element={<NgOverdueDashboard user={user} />} />
              <Route path="analytics/transfer-statistics" element={<TransferStatisticsReport />} />
              <Route path="admin" element={<AdminPanel />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;