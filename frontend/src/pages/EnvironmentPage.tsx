import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client.js';
import TopologyDiagram from '../components/TopologyDiagram.js';
import StatusChip from '../components/StatusChip.js';
import { RotateCcw, CheckCircle, AlertTriangle } from 'lucide-react';

interface EnvironmentPageProps {
  mode?: 'LOCAL_OPERATOR' | 'PUBLIC_VIEWER';
}

export default function EnvironmentPage({ mode }: EnvironmentPageProps) {
  const queryClient = useQueryClient();
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const { data: env, isLoading, error } = useQuery({
    queryKey: ['environment', 'sample-lab'],
    queryFn: () => apiFetch<any>('/environments/sample-lab'),
    refetchInterval: 5000
  });

  const resetMutation = useMutation({
    mutationFn: () => apiFetch('/environments/sample-lab/reset', { method: 'POST' }),
    onSuccess: () => {
      setResetMessage('Environment successfully reset to baseline A0.');
      queryClient.invalidateQueries({ queryKey: ['environment'] });
      setTimeout(() => setResetMessage(null), 4000);
    },
    onError: (err: any) => {
      setResetMessage(`Reset failed: ${err.message}`);
    }
  });

  if (isLoading) {
    return <div style={{ padding: 40, color: 'var(--ink-muted)' }}>Loading environment topology...</div>;
  }

  if (error || !env) {
    return (
      <div style={{ padding: 40, color: 'var(--danger)' }}>
        Lab controller unavailable. Live rehearsals are disabled.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', color: 'var(--ink)' }}>
              Environment Topology
            </h2>
            <StatusChip status={env.state} variant="env" />
          </div>
          <p style={{ fontSize: 14, color: 'var(--ink-secondary)', marginTop: 4 }}>
            Controlled local lab with strict server-authenticated TLS handshakes.
          </p>
        </div>

        {mode === 'LOCAL_OPERATOR' && (
          <button
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending || env.state === 'reserved'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              color: 'var(--ink)',
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: 13,
              cursor: env.state === 'reserved' ? 'not-allowed' : 'pointer'
            }}
          >
            <RotateCcw size={14} className={resetMutation.isPending ? 'spin' : ''} />
            {resetMutation.isPending ? 'Resetting baseline...' : 'Reset to baseline'}
          </button>
        )}
      </div>

      {resetMessage && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          background: resetMessage.includes('failed') ? 'var(--danger-soft)' : 'var(--success-soft)',
          color: resetMessage.includes('failed') ? 'var(--danger)' : 'var(--success)',
          fontSize: 13,
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          {resetMessage.includes('failed') ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
          {resetMessage}
        </div>
      )}

      {env.state === 'needs_reset' && (
        <div style={{
          padding: 16,
          background: 'var(--warning-soft)',
          border: '1px solid var(--warning)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--warning)',
          fontSize: 13,
          fontWeight: 600
        }}>
          Recovery did not finish. Reset and verify the baseline before another run.
        </div>
      )}

      <TopologyDiagram services={env.services || []} edges={env.edges || []} />
    </div>
  );
}
