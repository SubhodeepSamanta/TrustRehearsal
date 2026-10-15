import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client.js';
import StatusChip from '../components/StatusChip.js';
import { Download, Printer, ArrowLeft } from 'lucide-react';

export default function ReportPage() {
  const { runId } = useParams<{ runId: string }>();

  const { data: report, isLoading } = useQuery({
    queryKey: ['report', runId],
    queryFn: () => apiFetch<any>(`/runs/${runId}/report`)
  });

  const downloadJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trustrehearsal-${report.reportId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <div style={{ padding: 40, color: 'var(--ink-muted)' }}>Generating report...</div>;
  }

  if (!report) {
    return <div style={{ padding: 40, color: 'var(--danger)' }}>Report not found.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 960, margin: '0 auto' }}>
      {/* Action Bar (hidden on print) */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link
          to={`/runs/${runId}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-secondary)' }}
        >
          <ArrowLeft size={14} /> Back to Run
        </Link>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => window.print()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Printer size={15} /> Print Report
          </button>
          <button
            onClick={downloadJson}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--accent)',
              color: '#ffffff',
              border: 'none',
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Download size={15} /> Download JSON
          </button>
        </div>
      </div>

      {/* Report Document */}
      <div style={{
        background: '#ffffff',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-md)',
        padding: '40px 48px',
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
      }}>
        {/* Document Header */}
        <div style={{ borderBottom: '2px solid var(--line)', paddingBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                TrustRehearsal Cryptographic Change Report
              </span>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)', marginTop: 4 }}>
                {report.scenarioSnapshot.label}
              </h1>
              <div style={{ fontSize: 13, color: 'var(--ink-secondary)', marginTop: 4 }}>
                Scenario {report.scenarioSnapshot.id} (v{report.scenarioSnapshot.version}) | Environment: {report.run.environmentId}
              </div>
            </div>

            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <StatusChip status={report.run.outcome} variant="outcome" />
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>
                {report.reportId}
              </span>
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Methodology & Sample Window
          </h2>
          <p style={{ fontSize: 13, color: 'var(--ink-secondary)', lineHeight: 1.6 }}>
            {report.methodology.description} Tested sample count: <strong>{report.methodology.sampleCount} fresh TLS connections</strong>. Monotonic durations captured in worker. Handshake observations verified against declared trust roots.
          </p>
        </div>

        {/* Assertions Table */}
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Evaluated Assertions
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--line)' }}>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Assertion</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Expected vs Actual</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {report.assertions.map((a: any) => (
                <tr key={a.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '12px', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{a.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-secondary)', marginTop: 2 }}>{a.explanation}</div>
                  </td>
                  <td style={{ padding: '12px', verticalAlign: 'top' }}>
                    <StatusChip status={a.status} variant="assertion" />
                  </td>
                  <td style={{ padding: '12px', verticalAlign: 'top', fontSize: 12 }}>
                    <div><strong>Exp:</strong> {String(a.expected)}</div>
                    <div><strong>Act:</strong> {String(a.actual)}</div>
                  </td>
                  <td style={{ padding: '12px', verticalAlign: 'top', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-muted)' }}>
                    {a.evidenceEventIds?.join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Limitations */}
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Known Limitations & Scope
          </h2>
          <ul style={{ paddingLeft: 20, fontSize: 13, color: 'var(--ink-secondary)', lineHeight: 1.6 }}>
            {report.limitations.map((limit: string, idx: number) => (
              <li key={idx}>{limit}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
