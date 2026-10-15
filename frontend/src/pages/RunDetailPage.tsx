import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, useRunStream } from '../api/client.js';
import StatusChip from '../components/StatusChip.js';
import {
  Clock,
  FileText,
  StopCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Download
} from 'lucide-react';

interface RunDetailPageProps {
  mode: 'LOCAL_OPERATOR' | 'PUBLIC_VIEWER';
  isOperator: boolean;
}

export default function RunDetailPage({ isOperator }: RunDetailPageProps) {
  const { runId } = useParams<{ runId: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'evidence' | 'measurements' | 'recovery'>('evidence');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: run, isLoading: runLoading } = useQuery({
    queryKey: ['run', runId],
    queryFn: () => apiFetch<any>(`/runs/${runId}`),
    refetchInterval: (query) => {
      const currentRun = query.state.data;
      return currentRun?.active ? 2000 : false;
    }
  });

  const { data: eventsData } = useQuery({
    queryKey: ['events', runId],
    queryFn: () => apiFetch<any[]>(`/runs/${runId}/events?limit=200`),
    refetchInterval: run?.active ? 2000 : false
  });

  // Real-time SSE streaming updates
  useRunStream(run?.active ? runId : undefined, () => {
    queryClient.invalidateQueries({ queryKey: ['run', runId] });
    queryClient.invalidateQueries({ queryKey: ['events', runId] });
  });

  const cancelMutation = useMutation({
    mutationFn: () => apiFetch(`/runs/${runId}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['run', runId] });
    }
  });

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const downloadEvidenceJson = () => {
    if (!run) return;
    const exportData = {
      run,
      events: eventsData || [],
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trustrehearsal-${run.id}-evidence.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredEvents = useMemo(() => {
    const list = eventsData || [];
    if (filterType === 'all') return list;
    return list.filter((e) => e.type === filterType);
  }, [eventsData, filterType]);

  const measurements = useMemo(() => {
    return (eventsData || []).filter((e) => e.type === 'tls_probe');
  }, [eventsData]);

  if (runLoading) {
    return <div style={{ padding: 40, color: 'var(--ink-muted)' }}>Loading rehearsal details...</div>;
  }

  if (!run) {
    return <div style={{ padding: 40, color: 'var(--danger)' }}>Rehearsal run not found.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Header */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-md)',
        padding: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '2px 8px', borderRadius: 4 }}>
              {run.scenarioId}
            </span>
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--ink)' }}>
              {run.id}
            </h2>
            <StatusChip status={run.provenance === 'live_lab' ? 'Live lab' : 'Recorded'} />
            <StatusChip status={run.lifecycle} />
            <StatusChip status={run.outcome} variant="outcome" />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, fontSize: 13, color: 'var(--ink-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={14} />
              <span>Created: {new Date(run.createdAt).toLocaleString()}</span>
            </div>
            {run.finishedAt && (
              <div>Finished: {new Date(run.finishedAt).toLocaleTimeString()}</div>
            )}
            <div>Fencing token: #{run.fencingToken || 1}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {run.active && isOperator && (
            <button
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--danger-soft)',
                color: 'var(--danger)',
                border: '1px solid var(--danger)',
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                fontSize: 13
              }}
            >
              <StopCircle size={15} />
              {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Rehearsal'}
            </button>
          )}

          <button
            onClick={downloadEvidenceJson}
            title="Download full execution trace as formatted JSON"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--surface-muted)',
              border: '1px solid var(--line)',
              color: 'var(--ink)',
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            <Download size={15} />
            Raw Evidence (.json)
          </button>

          <Link
            to={`/runs/${run.id}/report`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--surface-muted)',
              border: '1px solid var(--line)',
              color: 'var(--ink)',
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: 13,
              textDecoration: 'none'
            }}
          >
            <FileText size={15} />
            Export Report
          </Link>
        </div>
      </div>

      {/* Main Content Grid: Left 8/12, Right 4/12 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 24 }}>
        {/* Left Column: Timeline & Phases */}
        <div style={{
          gridColumn: 'span 8',
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-md)',
          padding: 24
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>
              Execution Timeline & Observations
            </h3>
            <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
              Showing {filteredEvents.length} of {eventsData?.length || 0} Events
            </span>
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All Events' },
              { id: 'tls_probe', label: 'TLS Probes' },
              { id: 'step_start', label: 'Phase Steps' },
              { id: 'fault_injected', label: 'Faults' },
              { id: 'assertion', label: 'Assertions' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 14,
                  fontSize: 12,
                  fontWeight: 500,
                  border: '1px solid',
                  borderColor: filterType === f.id ? 'var(--accent)' : 'var(--line)',
                  background: filterType === f.id ? 'var(--accent-soft)' : 'var(--surface)',
                  color: filterType === f.id ? 'var(--accent)' : 'var(--ink-secondary)',
                  cursor: 'pointer'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredEvents.map((evt) => {
              const isExpanded = expandedEventId === evt.id;
              const isProbe = evt.type === 'tls_probe';
              const isMismatch = evt.data?.mismatchDetected;

              return (
                <div
                  key={evt.id}
                  style={{
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    background: isMismatch ? 'var(--warning-soft)' : 'var(--surface)'
                  }}
                >
                  <div
                    onClick={() => setExpandedEventId(isExpanded ? null : evt.id)}
                    style={{
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      fontSize: 13
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-muted)' }}>
                        +{evt.elapsedMs}ms
                      </span>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: 3,
                        background: 'var(--surface-muted)',
                        color: 'var(--ink-secondary)',
                        textTransform: 'uppercase'
                      }}>
                        {evt.type}
                      </span>
                      <strong style={{ color: 'var(--ink)' }}>
                        {isProbe ? (
                          <span>
                            Probe {evt.data.caller} → {evt.data.callee}: {evt.data.success ? 'Authenticated' : 'Rejection'} ({evt.data.durationMs}ms)
                          </span>
                        ) : evt.data?.message ? (
                          evt.data.message
                        ) : (
                          `${evt.phase}: ${evt.type}`
                        )}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isProbe && evt.data.certificateFingerprint && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-secondary)' }}>
                          fp: {evt.data.certificateFingerprint.slice(0, 10)}...
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--ink-muted)' }}>#{evt.seq}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{
                      padding: '12px 16px',
                      background: 'var(--surface-muted)',
                      borderTop: '1px solid var(--line)',
                      fontSize: 12
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontWeight: 600, color: 'var(--ink-secondary)' }}>Event ID: {evt.id}</span>
                        <button
                          onClick={() => copyToClipboard(JSON.stringify(evt.data, null, 2), evt.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--accent)',
                            fontSize: 11,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          {copiedId === evt.id ? <Check size={12} /> : <Copy size={12} />}
                          {copiedId === evt.id ? 'Copied' : 'Copy JSON'}
                        </button>
                      </div>
                      <pre style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        background: 'var(--surface)',
                        padding: 10,
                        borderRadius: 4,
                        overflowX: 'auto',
                        border: '1px solid var(--line)'
                      }}>
                        {JSON.stringify(evt.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Verification Assertions */}
        <div style={{
          gridColumn: 'span 4',
          display: 'flex',
          flexDirection: 'column',
          gap: 24
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-md)',
            padding: 24
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>
              Assertions ({run.assertionResults?.length || 0})
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(run.assertionResults || []).map((assertion: any) => {
                const passed = assertion.status === 'pass';
                return (
                  <div
                    key={assertion.id}
                    style={{
                      padding: 14,
                      background: 'var(--surface-muted)',
                      borderRadius: 'var(--radius-sm)',
                      borderLeft: `3px solid ${passed ? 'var(--success)' : 'var(--danger)'}`,
                      fontSize: 13
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{assertion.label}</span>
                      <StatusChip status={assertion.status} variant="assertion" />
                    </div>

                    <p style={{ fontSize: 12, color: 'var(--ink-secondary)', lineHeight: 1.4 }}>
                      {assertion.explanation}
                    </p>

                    {assertion.evidenceEventIds?.length > 0 && (
                      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-muted)' }}>
                        Evidence: {assertion.evidenceEventIds.join(', ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Lower Tabs: Evidence Explorer / Measurements / Recovery */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--line)',
          background: 'var(--surface-muted)',
          padding: '0 16px'
        }}>
          <button
            onClick={() => setActiveTab('evidence')}
            style={{
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'evidence' ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === 'evidence' ? 'var(--accent)' : 'var(--ink-secondary)',
              fontWeight: 600,
              fontSize: 13
            }}
          >
            Evidence Explorer ({filteredEvents.length})
          </button>
          <button
            onClick={() => setActiveTab('measurements')}
            style={{
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'measurements' ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === 'measurements' ? 'var(--accent)' : 'var(--ink-secondary)',
              fontWeight: 600,
              fontSize: 13
            }}
          >
            TLS Measurements ({measurements.length})
          </button>
          <button
            onClick={() => setActiveTab('recovery')}
            style={{
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'recovery' ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === 'recovery' ? 'var(--accent)' : 'var(--ink-secondary)',
              fontWeight: 600,
              fontSize: 13
            }}
          >
            Recovery Verification
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {activeTab === 'evidence' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)' }}>Filter Type:</span>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--line)',
                    background: 'var(--surface)',
                    fontSize: 12
                  }}
                >
                  <option value="all">All Events</option>
                  <option value="tls_probe">tls_probe</option>
                  <option value="certificate_issued">certificate_issued</option>
                  <option value="profile_installed">profile_installed</option>
                  <option value="context_reloaded">context_reloaded</option>
                  <option value="fault_enabled">fault_enabled</option>
                  <option value="recovery_verified">recovery_verified</option>
                </select>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--line)', color: 'var(--ink-secondary)' }}>
                    <th style={{ padding: '8px 12px' }}>Seq</th>
                    <th style={{ padding: '8px 12px' }}>Type</th>
                    <th style={{ padding: '8px 12px' }}>Phase</th>
                    <th style={{ padding: '8px 12px' }}>Service</th>
                    <th style={{ padding: '8px 12px' }}>Time (+Elapsed)</th>
                    <th style={{ padding: '8px 12px' }}>Event ID</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((e) => (
                    <tr key={e.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>{e.seq}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{e.type}</td>
                      <td style={{ padding: '8px 12px' }}>{e.phase}</td>
                      <td style={{ padding: '8px 12px' }}>{e.serviceId || '—'}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>+{e.elapsedMs}ms</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>{e.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'measurements' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--ink-secondary)', marginBottom: 16 }}>
                Each measurement represents a fresh non-resumed TLS connection with strict chain verification.
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--line)', color: 'var(--ink-secondary)' }}>
                    <th style={{ padding: '8px 12px' }}>Caller → Callee</th>
                    <th style={{ padding: '8px 12px' }}>Handshake Result</th>
                    <th style={{ padding: '8px 12px' }}>Latency</th>
                    <th style={{ padding: '8px 12px' }}>Certificate Fingerprint (SHA-256)</th>
                    <th style={{ padding: '8px 12px' }}>Trust Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {measurements.map((m) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 500 }}>
                        {m.data.caller} → {m.data.callee}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <StatusChip status={m.data.success ? 'Authenticated' : 'Rejected'} />
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>{m.data.durationMs}ms</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                        {m.data.certificateFingerprint || '—'}
                      </td>
                      <td style={{ padding: '8px 12px' }}>{m.data.trustProfile}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'recovery' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Recovery Status:</span>
                <StatusChip status={run.recoveryResult?.status || 'not_run'} />
              </div>
              <p style={{ fontSize: 13, color: 'var(--ink-secondary)' }}>
                Baseline reset verification ensures all services are returned to their initial A0 cryptographic state and clean TLS handshakes succeed before the environment is unreserved.
              </p>
              {run.recoveryResult?.completedAt && (
                <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                  Completed at: {new Date(run.recoveryResult.completedAt).toLocaleString()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
