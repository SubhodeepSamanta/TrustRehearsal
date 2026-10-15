import { Routes, Route } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api/client.js';
import Navigation from './components/Navigation.js';

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
  const configuredMode = (import.meta as any).env?.VITE_APP_MODE;

  const { data: meta } = useQuery({
    queryKey: ['meta'],
    queryFn: () => apiFetch<{ mode: 'LOCAL_OPERATOR' | 'PUBLIC_VIEWER' | 'UNAVAILABLE' }>('/meta'),
    enabled: configuredMode === 'LOCAL_OPERATOR'
  });

  const mode: 'LOCAL_OPERATOR' | 'PUBLIC_VIEWER' = configuredMode === 'LOCAL_OPERATOR'
    ? 'LOCAL_OPERATOR'
    : 'PUBLIC_VIEWER';

  return (
    <div className="app-container">
      <Navigation mode={mode} />

      <main className="app-main">
        {mode === 'LOCAL_OPERATOR' && meta?.mode === 'UNAVAILABLE' && (
          <div style={{ background: '#fef2f2', borderBottom: '1px solid #fee2e2', color: '#991b1b', padding: '10px 24px', fontSize: 13, fontWeight: 500 }}>
            Backend API is unavailable. Live execution is disabled until connection is restored.
          </div>
        )}
        <Routes>
          <Route path="/" element={<Overview mode={mode} />} />
          <Route path="/environment" element={<EnvironmentPage />} />
          <Route path="/rehearsals" element={<RehearsalsPage mode={mode} />} />
          <Route path="/rehearsals/:scenarioId" element={<RehearsalDetailPage mode={mode} />} />
          <Route path="/runs" element={<RunsPage />} />
          <Route path="/runs/:runId" element={<RunDetailPage mode={mode} />} />
          <Route path="/runs/:runId/report" element={<ReportPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/docs" element={<DocsPage />} />
        </Routes>
      </main>
    </div>
  );
}
