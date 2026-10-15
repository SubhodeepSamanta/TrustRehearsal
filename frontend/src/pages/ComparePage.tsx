import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client.js';
import StatusChip from '../components/StatusChip.js';
import { GitCompare, ArrowLeft } from 'lucide-react';

export default function ComparePage() {
  const [searchParams] = useSearchParams();
  const leftId = searchParams.get('left');
  const rightId = searchParams.get('right');

  const { data: leftRun } = useQuery({
    queryKey: ['run', leftId],
    queryFn: () => apiFetch<any>(`/runs/${leftId}`),
    enabled: !!leftId
  });

  const { data: rightRun } = useQuery({
    queryKey: ['run', rightId],
    queryFn: () => apiFetch<any>(`/runs/${rightId}`),
    enabled: !!rightId
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <Link
          to="/runs"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-secondary)', marginBottom: 12 }}
        >
          <ArrowLeft size={14} /> Back to Runs
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <GitCompare size={24} color="var(--accent)" />
          <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', color: 'var(--ink)' }}>
            Compare Rehearsal Runs
          </h2>
        </div>
        <p style={{ fontSize: 14, color: 'var(--ink-secondary)', marginTop: 4 }}>
          Side-by-side comparison of observations, assertions, and TLS measurement samples across runs.
        </p>
      </div>

      {(!leftRun || !rightRun) ? (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-md)',
          padding: 40,
          textAlign: 'center',
          color: 'var(--ink-secondary)'
        }}>
          Select two runs from the <Link to="/runs">Runs Table</Link> to perform side-by-side comparison.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Left Run Card */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-md)',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 20
          }}>
            <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>Run A</span>
                <StatusChip status={leftRun.provenance === 'live_lab' ? 'Live lab' : 'Recorded'} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginTop: 6, fontFamily: 'var(--font-mono)' }}>{leftRun.id}</h3>
              <div style={{ fontSize: 13, color: 'var(--ink-secondary)', marginTop: 4 }}>
                Scenario {leftRun.scenarioId} | {new Date(leftRun.createdAt).toLocaleString()}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <StatusChip status={leftRun.lifecycle} />
                <StatusChip status={leftRun.outcome} variant="outcome" />
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Assertions ({leftRun.assertionResults?.length})</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(leftRun.assertionResults || []).map((a: any) => (
                  <div key={a.id} style={{ padding: 10, background: 'var(--surface-muted)', borderRadius: 4, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong style={{ color: 'var(--ink)' }}>{a.label}</strong>
                      <StatusChip status={a.status} variant="assertion" />
                    </div>
                    <div style={{ color: 'var(--ink-secondary)', marginTop: 4 }}>{a.explanation}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Run Card */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-md)',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 20
          }}>
            <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>Run B</span>
                <StatusChip status={rightRun.provenance === 'live_lab' ? 'Live lab' : 'Recorded'} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginTop: 6, fontFamily: 'var(--font-mono)' }}>{rightRun.id}</h3>
              <div style={{ fontSize: 13, color: 'var(--ink-secondary)', marginTop: 4 }}>
                Scenario {rightRun.scenarioId} | {new Date(rightRun.createdAt).toLocaleString()}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <StatusChip status={rightRun.lifecycle} />
                <StatusChip status={rightRun.outcome} variant="outcome" />
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Assertions ({rightRun.assertionResults?.length})</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(rightRun.assertionResults || []).map((a: any) => (
                  <div key={a.id} style={{ padding: 10, background: 'var(--surface-muted)', borderRadius: 4, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong style={{ color: 'var(--ink)' }}>{a.label}</strong>
                      <StatusChip status={a.status} variant="assertion" />
                    </div>
                    <div style={{ color: 'var(--ink-secondary)', marginTop: 4 }}>{a.explanation}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
