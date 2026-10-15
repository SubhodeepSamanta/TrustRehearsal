import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client.js';
import StatusChip from '../components/StatusChip.js';
import { ArrowRight, CheckCircle, Network, Clock, GitCompare } from 'lucide-react';

interface OverviewProps {
  mode: 'LOCAL_OPERATOR' | 'PUBLIC_VIEWER';
  isOperator?: boolean;
}

export default function Overview({ mode: _mode }: OverviewProps) {
  const { data: runsData, isLoading: runsLoading } = useQuery({
    queryKey: ['runs', 10],
    queryFn: () => apiFetch<{ runs: any[] }>('/runs?limit=10')
  });

  const { data: envData } = useQuery({
    queryKey: ['environment', 'sample-lab'],
    queryFn: () => apiFetch<any>('/environments/sample-lab')
  });

  const latestRun = runsData?.runs?.[0];

  const scenarios = [
    {
      id: 'S01',
      title: 'Renewal without application reload',
      description: 'Detects mismatch between leaf certificate deployed to disk and the serving TLS context; verifies hot reload recovery.',
      expectedFault: 'Serving context mismatch',
      affected: 'orders service'
    },
    {
      id: 'S02',
      title: 'Issuance-path unavailability',
      description: 'Demonstrates that CA network partition or proxy failure does not affect active valid certificate handshakes.',
      expectedFault: 'CA partition fault',
      affected: 'issuance proxy'
    },
    {
      id: 'S03',
      title: 'Trust-root rollover',
      description: 'Compares abrupt root replacement failure against a controlled dual-trust staged rollover sequence.',
      expectedFault: 'Root A to Root B transition',
      affected: 'gateway & orders'
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--ink)' }}>
            Rehearse cryptographic change.
          </h2>
          <p style={{ fontSize: 15, color: 'var(--ink-secondary)', marginTop: 4 }}>
            Execute bounded trust-change experiments against running services. Measure real TLS behavior before production.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link
            to="/compare"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--surface)',
              color: 'var(--ink)',
              border: '1px solid var(--line)',
              padding: '10px 18px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: 13,
              textDecoration: 'none'
            }}
          >
            <GitCompare size={15} />
            Compare runs
          </Link>

          <Link
            to={latestRun ? `/runs/${latestRun.id}` : '/rehearsals'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--accent)',
              color: '#ffffff',
              padding: '10px 18px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: 13,
              textDecoration: 'none'
            }}
          >
            Explore rehearsal
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      {/* Hero Grid */}
      <div className="overview-hero-grid">
        {/* Main Panel: Latest Result */}
        <div className="hero-panel-main" style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-md)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-muted)', textTransform: 'uppercase' }}>
                Latest Rehearsal Result
              </span>
              {latestRun && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <StatusChip status={latestRun.provenance === 'live_lab' ? 'Live lab' : 'Recorded'} />
                  <StatusChip status={latestRun.outcome} variant="outcome" />
                </div>
              )}
            </div>

            {latestRun ? (
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
                  {latestRun.scenarioId}: {scenarios.find(s => s.id === latestRun.scenarioId)?.title || 'Cryptographic Rehearsal'}
                </h3>
                <p style={{ fontSize: 13, color: 'var(--ink-secondary)', lineHeight: 1.5 }}>
                  {latestRun.scenarioId === 'S01'
                    ? 'Observed leaf certificate differed from active serving TLS context before reload. In-memory TLS context reload successfully updated the served fingerprint without dropping service connections.'
                    : latestRun.scenarioId === 'S02'
                    ? 'Simulated CA proxy network partition. Data-plane requests continued uninterrupted while certificate renewal attempts failed predictably and safely.'
                    : 'Evaluated trust root migration. Abrupt leaf transition strictly rejected by Root A callers, while staged dual-trust bundle enabled seamless zero-downtime rollover.'}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 20, fontSize: 13, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-secondary)' }}>
                    <Clock size={15} />
                    <span>{new Date(latestRun.createdAt).toLocaleString()} {latestRun.provenance === 'recorded_example' ? '(Original Recorded)' : ''}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--success)' }}>
                    <CheckCircle size={15} />
                    <span>{latestRun.assertionsSummary?.passed}/{latestRun.assertionsSummary?.total} Assertions Passed</span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-muted)' }}>
                No rehearsals executed yet. Select a scenario below to explore rehearsal details.
              </div>
            )}
          </div>

          {latestRun && (
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
              <Link
                to={`/runs/${latestRun.id}`}
                style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                Inspect evidence <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>

        {/* Side Panel: Environment Health */}
        <div className="hero-panel-side" style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-md)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-muted)', textTransform: 'uppercase' }}>
                Environment Scope
              </span>
              <StatusChip status={envData?.state || 'ready'} variant="env" />
            </div>

            <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
              {envData?.label || 'Sample Lab'}
            </h4>
            <p style={{ fontSize: 13, color: 'var(--ink-secondary)', lineHeight: 1.5 }}>
              Topology of 3 sample services with dedicated Root CAs. Controlled fault injection with strict TLS verification.
            </p>

            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-secondary)' }}>
                <span>Active Services:</span>
                <strong style={{ color: 'var(--ink)' }}>gateway, orders, ledger</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-secondary)' }}>
                <span>Root Authorities:</span>
                <strong style={{ color: 'var(--ink)' }}>Root CA A, Root CA B</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-secondary)' }}>
                <span>Baseline Profile:</span>
                <strong style={{ color: 'var(--ink)' }}>{envData?.baselineProfile || 'A0'}</strong>
              </div>
            </div>

            <div style={{
              marginTop: 14,
              padding: '10px 12px',
              background: 'var(--surface-muted)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 11,
              color: 'var(--ink-secondary)',
              lineHeight: 1.4
            }}>
              <strong style={{ color: 'var(--ink)' }}>Distinction Note:</strong> Topology services remain healthy (green status) while rehearsal outcomes test and prove intentional TLS trust boundaries.
            </div>
          </div>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
            <Link
              to="/environment"
              style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Network size={14} /> View Topology Diagram
            </Link>
          </div>
        </div>
      </div>

      {/* Scenarios Section */}
      <div>
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>
            Rehearsal Scenarios
          </h3>
          <p style={{ fontSize: 13, color: 'var(--ink-secondary)' }}>
            Controlled, reproducible experiments targeting specific failure modes in certificate lifecycle management.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {scenarios.map((scenario) => (
            <Link
              key={scenario.id}
              to={`/rehearsals/${scenario.id}`}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-md)',
                padding: 20,
                textDecoration: 'none',
                color: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'border-color 0.15s ease'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: 'var(--surface-muted)',
                    color: 'var(--accent)'
                  }}>
                    {scenario.id}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                    {scenario.affected}
                  </span>
                </div>

                <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
                  {scenario.title}
                </h4>
                <p style={{ fontSize: 13, color: 'var(--ink-secondary)', lineHeight: 1.5 }}>
                  {scenario.description}
                </p>
              </div>

              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                <span>Explore rehearsal</span>
                <ArrowRight size={14} />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Runs Table */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
            Recent Rehearsal Activity
          </h3>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Link to="/compare" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <GitCompare size={13} /> Compare runs
            </Link>
            <Link to="/runs" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
              View all runs
            </Link>
          </div>
        </div>

        {runsLoading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-muted)' }}>Loading runs...</div>
        ) : (
          <div className="table-responsive">
            <table style={{ borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--line)', color: 'var(--ink-secondary)' }}>
                  <th style={{ padding: '10px 20px', fontWeight: 600 }}>Run ID</th>
                  <th style={{ padding: '10px 20px', fontWeight: 600 }}>Scenario</th>
                  <th style={{ padding: '10px 20px', fontWeight: 600 }}>Provenance</th>
                  <th style={{ padding: '10px 20px', fontWeight: 600 }}>Lifecycle</th>
                  <th style={{ padding: '10px 20px', fontWeight: 600 }}>Outcome</th>
                  <th style={{ padding: '10px 20px', fontWeight: 600 }}>Execution Time</th>
                </tr>
              </thead>
              <tbody>
                {(runsData?.runs || []).slice(0, 5).map((run) => (
                  <tr key={run.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '12px 20px' }}>
                      <Link to={`/runs/${run.id}`} style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {run.id}
                      </Link>
                    </td>
                    <td style={{ padding: '12px 20px', fontWeight: 500 }}>{run.scenarioId}</td>
                    <td style={{ padding: '12px 20px' }}>
                      <StatusChip status={run.provenance === 'live_lab' ? 'Live lab' : 'Recorded'} />
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <StatusChip status={run.lifecycle} />
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <StatusChip status={run.outcome} variant="outcome" />
                    </td>
                    <td style={{ padding: '12px 20px', color: 'var(--ink-muted)' }}>
                      {new Date(run.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
