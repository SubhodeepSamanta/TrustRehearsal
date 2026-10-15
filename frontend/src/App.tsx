import { Routes, Route, Link } from 'react-router-dom';

export default function App() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav style={{ width: 208, borderRight: '1px solid var(--line)', padding: '24px 16px', background: 'var(--surface)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 24 }}>TrustRehearsal</h2>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <li><Link to="/">Overview</Link></li>
          <li><Link to="/environment">Environment</Link></li>
          <li><Link to="/rehearsals">Rehearsals</Link></li>
          <li><Link to="/runs">Runs</Link></li>
        </ul>
      </nav>
      <main style={{ flex: 1, padding: 40, maxWidth: 1440 }}>
        <Routes>
          <Route path="/" element={<div><h1>Rehearse cryptographic change.</h1><p>See what breaks before production.</p></div>} />
          <Route path="/environment" element={<div><h1>Environment Topology</h1></div>} />
          <Route path="/rehearsals" element={<div><h1>Rehearsal Scenarios</h1></div>} />
          <Route path="/runs" element={<div><h1>Rehearsal Runs</h1></div>} />
        </Routes>
      </main>
    </div>
  );
}
