import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiFetch } from '../api/client.js';
import { Play, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface RehearsalDetailPageProps {
  mode: 'LOCAL_OPERATOR' | 'PUBLIC_VIEWER';
  isOperator: boolean;
}

export default function RehearsalDetailPage({ mode, isOperator }: RehearsalDetailPageProps) {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const navigate = useNavigate();
  const [startError, setStartError] = useState<string | null>(null);

  const { data: scenario, isLoading } = useQuery({
    queryKey: ['scenario', scenarioId],
    queryFn: () => apiFetch<any>(`/scenarios/${scenarioId}`)
  });

  const { data: env } = useQuery({
    queryKey: ['environment', 'sample-lab'],
    queryFn: () => apiFetch<any>('/environments/sample-lab')
  });

  const startMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ runId: string }>('/runs', {
        method: 'POST',
        headers: {
          'Idempotency-Key': `idemp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        },
        body: JSON.stringify({
          environmentId: 'sample-lab',
          scenarioId: scenarioId,
          scenarioVersion: scenario?.version || '1'
        })
      }),
    onSuccess: (data) => {
      navigate(`/runs/${data.runId}`);
    },
    onError: (err: any) => {
      setStartError(err.message);
    }
  });

  if (isLoading) {
    return <div style={{ padding: 40, color: 'var(--ink-muted)' }}>Loading scenario details...</div>;
  }

  if (!scenario) {
    return <div style={{ padding: 40, color: 'var(--danger)' }}>Scenario not found.</div>;
  }

  const isBusy = env?.state === 'reserved';
  const needsReset = env?.state === 'needs_reset';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <Link
          to="/rehearsals"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-secondary)', marginBottom: 12 }}
        >
          <ArrowLeft size={14} /> Back to Catalog
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '2px 8px', borderRadius: 4 }}>
            {scenario.id}
          </span>
          <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', color: 'var(--ink)' }}>
            {scenario.label}
          </h2>
        </div>
        <p style={{ fontSize: 14, color: 'var(--ink-secondary)', marginTop: 4 }}>
          {scenario.description}
        </p>
      </div>

      {startError && (
        <div style={{
          padding: 14,
          background: 'var(--danger-soft)',
          border: '1px solid var(--danger)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--danger)',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <AlertTriangle size={16} />
          {startError}
        </div>
      )}

      {/* Execution Control Banner */}
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
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
            Execution Review & Readiness
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-secondary)', marginTop: 4 }}>
            Target: <strong>sample-lab</strong> | Max Duration: <strong>{scenario.maxDurationMs / 1000}s</strong> | State: <strong>{env?.state || 'ready'}</strong>
          </div>
        </div>

        <div>
          {mode === 'LOCAL_OPERATOR' ? (
            <button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending || isBusy || needsReset || !isOperator}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: isBusy || needsReset || !isOperator ? 'var(--surface-muted)' : 'var(--accent)',
                color: isBusy || needsReset || !isOperator ? 'var(--ink-muted)' : '#ffffff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                fontSize: 14,
                cursor: isBusy || needsReset || !isOperator ? 'not-allowed' : 'pointer'
              }}
            >
              <Play size={16} fill={isBusy || needsReset || !isOperator ? 'var(--ink-muted)' : '#ffffff'} />
              {startMutation.isPending ? 'Starting Rehearsal...' : isBusy ? 'Lab Busy' : needsReset ? 'Reset Required' : !isOperator ? 'Operator Sign-In Required' : 'Start Rehearsal'}
            </button>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
              Live execution disabled in public viewer mode.
            </div>
          )}
        </div>
      </div>

      {/* Plan Phases */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-md)',
        padding: 24
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>
          Execution Sequence ({scenario.phaseDefinitions?.length} Phases)
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(scenario.phaseDefinitions || []).map((phase: any, index: number) => (
            <div
              key={phase.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
                padding: '12px 16px',
                background: 'var(--surface-muted)',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              <div style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: 12,
                color: 'var(--ink-secondary)',
                flexShrink: 0
              }}>
                {index + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{phase.name}</span>
                  {phase.isMutation && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: 'var(--warning-soft)',
                      color: 'var(--warning)',
                      textTransform: 'uppercase'
                    }}>
                      Mutation
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-secondary)', marginTop: 2 }}>
                  {phase.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Assertions */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-md)',
        padding: 24
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>
          Verification Assertions ({scenario.assertionDefinitions?.length})
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(scenario.assertionDefinitions || []).map((assertion: any) => (
            <div
              key={assertion.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13
              }}
            >
              <CheckCircle2 size={16} color="var(--accent)" />
              <div style={{ flex: 1 }}>
                <strong style={{ color: 'var(--ink)' }}>{assertion.label}</strong>
                <span style={{ color: 'var(--ink-secondary)', marginLeft: 8 }}>— {assertion.description}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
