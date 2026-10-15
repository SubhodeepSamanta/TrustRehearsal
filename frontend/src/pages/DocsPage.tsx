import { BookOpen, Shield, Cpu, RefreshCw, AlertTriangle } from 'lucide-react';

export default function DocsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 900 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BookOpen size={24} color="var(--accent)" />
          <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', color: 'var(--ink)' }}>
            System Documentation & Architecture
          </h2>
        </div>
        <p style={{ fontSize: 14, color: 'var(--ink-secondary)', marginTop: 4 }}>
          Engineering specifications, security model, and measurement methodology for TrustRehearsal.
        </p>
      </div>

      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-md)',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 24
      }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Cpu size={18} color="var(--accent)" /> System Overview
          </h3>
          <p style={{ fontSize: 13, color: 'var(--ink-secondary)', lineHeight: 1.6, marginTop: 8 }}>
            TrustRehearsal is an independent engineering platform designed to rehearse cryptographic and trust changes against running applications. Rather than relying on simulated timers or synthetic mocks, every measurement is captured via fresh, non-resumed TLS handshakes with strict hostname and chain validation.
          </p>
        </div>

        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <RefreshCw size={18} color="var(--accent)" /> Tested Scenarios
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
            <div style={{ padding: 12, background: 'var(--surface-muted)', borderRadius: 'var(--radius-sm)' }}>
              <strong>S01 — Renewal without application reload:</strong> Tests the operational distinction between renewing a leaf certificate on disk and the active serving TLS context. Shows mismatch detection and hot reload verification.
            </div>
            <div style={{ padding: 12, background: 'var(--surface-muted)', borderRadius: 'var(--radius-sm)' }}>
              <strong>S02 — Issuance-path unavailability:</strong> Proves that a network partition or proxy failure on the CA route does not disrupt data-plane traffic for services with currently valid certificates.
            </div>
            <div style={{ padding: 12, background: 'var(--surface-muted)', borderRadius: 'var(--radius-sm)' }}>
              <strong>S03 — Trust-root rollover:</strong> Demonstrates the critical difference between abrupt root replacement (which fails with TLS errors) and a controlled dual-trust staged migration sequence.
            </div>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={18} color="var(--accent)" /> Security Boundaries
          </h3>
          <ul style={{ paddingLeft: 20, fontSize: 13, color: 'var(--ink-secondary)', lineHeight: 1.6, marginTop: 8 }}>
            <li>Public deployment operates strictly in read-only viewer mode without execution worker or management credentials.</li>
            <li>No Docker socket access or arbitrary host command execution.</li>
            <li>All mutations require authenticated operator sessions, strict CSRF tokens, and atomic lease fencing.</li>
            <li>Private keys are never exposed over the API or serialized into exported reports.</li>
          </ul>
        </div>

        <div style={{ padding: 16, background: 'var(--surface-muted)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={15} color="var(--warning)" /> Honest Claims Language
          </h4>
          <p style={{ fontSize: 12, color: 'var(--ink-secondary)', lineHeight: 1.5, marginTop: 4 }}>
            Observations reflect explicit sampled windows in the lab environment only. We state: <em>&quot;Observed 0 failed fresh connections across 30 samples in this lab&quot;</em>. We do not claim zero-downtime guarantees, production safety certification, or third-party product integration.
          </p>
        </div>
      </div>
    </div>
  );
}
