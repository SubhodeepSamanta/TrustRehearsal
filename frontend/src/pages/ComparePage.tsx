import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client.js';
import StatusChip from '../components/StatusChip.js';
import { GitCompare, ArrowLeft, ArrowLeftRight, CheckCircle2, XCircle, FileText, ExternalLink, AlertTriangle } from 'lucide-react';

interface AssertionEntry {
  label: string;
  left?: any;
  right?: any;
}

export default function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const leftId = searchParams.get('left') || '';
  const rightId = searchParams.get('right') || '';

  const { data: runsData } = useQuery({
    queryKey: ['runs', 50],
    queryFn: () => apiFetch<{ runs: any[] }>('/runs?limit=50')
  });

  const allRuns = runsData?.runs || [];

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

  const handleSelectLeft = (id: string) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('left', id);
    else next.delete('left');
    setSearchParams(next);
  };

  const handleSelectRight = (id: string) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('right', id);
    else next.delete('right');
    setSearchParams(next);
  };

  const handleSwap = () => {
    const next = new URLSearchParams(searchParams);
    if (rightId) next.set('left', rightId);
    else next.delete('left');
    if (leftId) next.set('right', leftId);
    else next.delete('right');
    setSearchParams(next);
  };

  const isDifferentScenario = leftRun && rightRun && leftRun.scenarioId !== rightRun.scenarioId;
  const isDifferentProvenance = leftRun && rightRun && leftRun.provenance !== rightRun.provenance;

  const assertionsMap = new Map<string, AssertionEntry>();
  if (leftRun?.assertionResults) {
    for (const a of leftRun.assertionResults) {
      assertionsMap.set(a.id, { label: a.label, left: a });
    }
  }
  if (rightRun?.assertionResults) {
    for (const a of rightRun.assertionResults) {
      const existing: AssertionEntry = assertionsMap.get(a.id) || { label: a.label };
      existing.right = a;
      assertionsMap.set(a.id, existing);
    }
  }

  const assertionsList = Array.from(assertionsMap.entries());

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
          Side-by-side comparison of assertions, observed TLS evidence values, and outcomes across rehearsal runs.
        </p>
      </div>

      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-md)',
        padding: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 280, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
              Run A (Baseline)
            </label>
            <select
              value={leftId}
              onChange={(e) => handleSelectLeft(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--surface-muted)',
                color: 'var(--ink)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                fontSize: 13,
                fontFamily: 'inherit'
              }}
            >
              <option value="">-- Select Run A --</option>
              {allRuns.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id.slice(0, 16)}... | {r.scenarioId} | {r.outcome} | {new Date(r.createdAt).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSwap}
            title="Swap Run A and B"
            style={{
              marginTop: 18,
              background: 'var(--surface-muted)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              color: 'var(--ink)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ArrowLeftRight size={15} />
          </button>

          <div style={{ flex: 1, minWidth: 220 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
              Run B (Comparison)
            </label>
            <select
              value={rightId}
              onChange={(e) => handleSelectRight(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--surface-muted)',
                color: 'var(--ink)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                fontSize: 13,
                fontFamily: 'inherit'
              }}
            >
              <option value="">-- Select Run B --</option>
              {allRuns.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id.slice(0, 16)}... | {r.scenarioId} | {r.outcome} | {new Date(r.createdAt).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isDifferentScenario && (
        <div style={{
          padding: '14px 18px',
          background: 'var(--warning-soft)',
          border: '1px solid var(--warning)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--warning)',
          fontSize: 13,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12
        }}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Incompatible Scenarios Selected ({leftRun.scenarioId} vs {rightRun.scenarioId}):</strong>
            <p style={{ marginTop: 4, lineHeight: 1.4 }}>
              Run A tests scenario <strong>{leftRun.scenarioId}</strong> while Run B tests scenario <strong>{rightRun.scenarioId}</strong>. Cross-scenario comparison does not establish equivalence because assertions, fault injections, and target services differ. Compatible runs are listed below.
            </p>
          </div>
        </div>
      )}

      {isDifferentProvenance && (
        <div style={{
          padding: '10px 14px',
          background: 'var(--surface-muted)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--ink-secondary)',
          fontSize: 12
        }}>
          <strong>Note on Provenance:</strong> Run A is from <strong>{leftRun.provenance}</strong> and Run B is from <strong>{rightRun.provenance}</strong>.
        </div>
      )}

      {(!leftRun || !rightRun) ? (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-md)',
          padding: 48,
          textAlign: 'center',
          color: 'var(--ink-secondary)'
        }}>
          <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)', marginBottom: 8 }}>
            Select two runs from the selectors above or the <Link to="/runs">Runs Table</Link>.
          </p>
          <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
            Compare TLS verification evidence, assertion passes, and lifecycle outcomes across runs.
          </p>
        </div>
      ) : (
        <>
          <div className="compare-grid">
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-md)',
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>Run A</span>
                <StatusChip status={leftRun.provenance === 'live_lab' ? 'Live lab' : 'Recorded'} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-mono)' }} className="mono-break">{leftRun.id}</h3>
              <div style={{ fontSize: 13, color: 'var(--ink-secondary)' }}>
                Scenario: <strong>{leftRun.scenarioId}</strong> | {new Date(leftRun.createdAt).toLocaleString()}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <StatusChip status={leftRun.lifecycle} />
                <StatusChip status={leftRun.outcome} variant="outcome" />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                <Link to={`/runs/${leftRun.id}`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <ExternalLink size={12} /> Inspect evidence
                </Link>
                <Link to={`/runs/${leftRun.id}/report`} style={{ fontSize: 12, color: 'var(--ink-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <FileText size={12} /> Download report
                </Link>
              </div>
            </div>

            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-md)',
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>Run B</span>
                <StatusChip status={rightRun.provenance === 'live_lab' ? 'Live lab' : 'Recorded'} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-mono)' }} className="mono-break">{rightRun.id}</h3>
              <div style={{ fontSize: 13, color: 'var(--ink-secondary)' }}>
                Scenario: <strong>{rightRun.scenarioId}</strong> | {new Date(rightRun.createdAt).toLocaleString()}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <StatusChip status={rightRun.lifecycle} />
                <StatusChip status={rightRun.outcome} variant="outcome" />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                <Link to={`/runs/${rightRun.id}`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <ExternalLink size={12} /> Inspect evidence
                </Link>
                <Link to={`/runs/${rightRun.id}/report`} style={{ fontSize: 12, color: 'var(--ink-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <FileText size={12} /> Download report
                </Link>
              </div>
            </div>
          </div>

          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
                  Assertion Comparison Matrix
                </h3>
                <p style={{ fontSize: 12, color: 'var(--ink-secondary)', marginTop: 2 }}>
                  Side-by-side verification of assertions, status, and observed actual evidence values.
                </p>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                {assertionsList.length} total assertions evaluated
              </div>
            </div>

            <div className="table-responsive">
              <table style={{ borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--line)', color: 'var(--ink-secondary)' }}>
                    <th style={{ padding: '10px 20px', fontWeight: 600, width: '35%' }}>Assertion Target</th>
                    <th style={{ padding: '10px 20px', fontWeight: 600, width: '25%' }}>Run A Observed</th>
                    <th style={{ padding: '10px 20px', fontWeight: 600, width: '25%' }}>Run B Observed</th>
                    <th style={{ padding: '10px 20px', fontWeight: 600, width: '15%' }}>Evidence Comparison</th>
                  </tr>
                </thead>
                <tbody>
                  {assertionsList.map(([id, item]) => {
                    const leftStatus = item.left?.status;
                    const rightStatus = item.right?.status;
                    const isStatusMatch = leftStatus && rightStatus && leftStatus === rightStatus;
                    const isActualMatch = item.left?.actual && item.right?.actual && item.left.actual === item.right.actual;
                    const isFullMatch = isStatusMatch && isActualMatch;

                    return (
                      <tr key={id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{item.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{id}</div>
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          {item.left ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <StatusChip status={item.left.status} variant="assertion" />
                              {item.left.actual && (
                                <span style={{ fontSize: 11, color: 'var(--ink)', fontWeight: 500 }} className="mono-break">
                                  {item.left.actual}
                                </span>
                              )}
                              {item.left.explanation && (
                                <span style={{ fontSize: 11, color: 'var(--ink-secondary)' }}>{item.left.explanation}</span>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>Not in Run A</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          {item.right ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <StatusChip status={item.right.status} variant="assertion" />
                              {item.right.actual && (
                                <span style={{ fontSize: 11, color: 'var(--ink)', fontWeight: 500 }} className="mono-break">
                                  {item.right.actual}
                                </span>
                              )}
                              {item.right.explanation && (
                                <span style={{ fontSize: 11, color: 'var(--ink-secondary)' }}>{item.right.explanation}</span>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>Not in Run B</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          {isFullMatch ? (
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle2 size={13} /> Identical evidence
                            </span>
                          ) : isStatusMatch ? (
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle2 size={13} /> Status match (diff value)
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <XCircle size={13} /> Divergent status
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
