import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, setCsrfToken } from './api/client.js';
import Navigation from './components/Navigation.js';
import LoginModal from './components/LoginModal.js';

import Overview from './pages/Overview.js';
import EnvironmentPage from './pages/EnvironmentPage.js';
import RehearsalsPage from './pages/RehearsalsPage.js';
import RehearsalDetailPage from './pages/RehearsalDetailPage.js';
import RunsPage from './pages/RunsPage.js';
import RunDetailPage from './pages/RunDetailPage.js';
import ReportPage from './pages/ReportPage.js';
import ComparePage from './pages/ComparePage.js';
import DocsPage from './pages/DocsPage.js';

export default function App() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isOperator, setIsOperator] = useState(false);

  const { data: meta } = useQuery({
    queryKey: ['meta'],
    queryFn: () => apiFetch<{ mode: 'LOCAL_OPERATOR' | 'PUBLIC_VIEWER' }>('/meta')
  });

  const mode = meta?.mode || 'LOCAL_OPERATOR';

  const checkSession = async () => {
    try {
      const session = await apiFetch<{ role: string; csrfToken: string | null }>('/operator/session');
      if (session.role === 'operator') {
        setIsOperator(true);
        setCsrfToken(session.csrfToken);
      } else {
        setIsOperator(false);
        setCsrfToken(null);
      }
    } catch {
      setIsOperator(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const handleLogout = async () => {
    try {
      await apiFetch('/operator/session', { method: 'DELETE' });
    } finally {
      setIsOperator(false);
      setCsrfToken(null);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--canvas)' }}>
      <Navigation
        mode={mode}
        isOperator={isOperator}
        onOpenLogin={() => setIsLoginOpen(true)}
        onLogout={handleLogout}
      />

      <main style={{
        flex: 1,
        padding: '36px 40px',
        maxWidth: 1440,
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <Routes>
          <Route path="/" element={<Overview mode={mode} isOperator={isOperator} />} />
          <Route path="/environment" element={<EnvironmentPage isOperator={isOperator} />} />
          <Route path="/rehearsals" element={<RehearsalsPage />} />
          <Route path="/rehearsals/:scenarioId" element={<RehearsalDetailPage mode={mode} isOperator={isOperator} />} />
          <Route path="/runs" element={<RunsPage />} />
          <Route path="/runs/:runId" element={<RunDetailPage mode={mode} isOperator={isOperator} />} />
          <Route path="/runs/:runId/report" element={<ReportPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/docs" element={<DocsPage />} />
        </Routes>
      </main>

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={() => checkSession()}
      />
    </div>
  );
}
