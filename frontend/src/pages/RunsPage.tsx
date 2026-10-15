import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client.js';
import StatusChip from '../components/StatusChip.js';
import { FileText, ArrowRight } from 'lucide-react';

export default function RunsPage() {
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);

  const { data: runsData, isLoading } = useQuery({
    queryKey: ['runs', 50],
    queryFn: () => apiFetch<{ runs: any[]; nextCursor: string | null }>('/runs?limit=50'),
    refetchInterval: 5000
  });

  const toggleSelect = (runId: string) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(runId)) {
        return prev.filter((id) => id !== runId);
      }
      if (prev.length >= 2) {
        return [prev[1], runId];
      }
      return [...prev, runId];
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', color: 'var(--ink)' }}>
            Rehearsal Runs
          </h2>
          <p style={{ fontSize: 14, color: 'var(--ink-secondary)', marginTop: 4 }}>
            History of executed and recorded rehearsal runs with verifiable TLS observations.
          </p>
        </div>

        {selectedForCompare.length === 2 && (
          <Link
            to={`/compare?left=${selectedForCompare[0]}&right=${selectedForCompare[1]}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--accent)',
              color: '#ffffff',
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: 13,
              textDecoration: 'none'
            }}
          >
            Compare 2 Selected Runs <ArrowRight size={14} />
          </Link>
        )}
      </div>

      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden'
      }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-muted)' }}>Loading runs...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--line)', color: 'var(--ink-secondary)' }}>
                <th style={{ width: 40, padding: '10px 16px' }}></th>
                <th style={{ padding: '10px 16px', fontWeight: 600 }}>Run ID</th>
                <th style={{ padding: '10px 16px', fontWeight: 600 }}>Scenario</th>
                <th style={{ padding: '10px 16px', fontWeight: 600 }}>Provenance</th>
                <th style={{ padding: '10px 16px', fontWeight: 600 }}>Lifecycle</th>
                <th style={{ padding: '10px 16px', fontWeight: 600 }}>Outcome</th>
                <th style={{ padding: '10px 16px', fontWeight: 600 }}>Assertions</th>
                <th style={{ padding: '10px 16px', fontWeight: 600 }}>Executed At</th>
                <th style={{ padding: '10px 16px', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(runsData?.runs || []).map((run) => {
                const isSelected = selectedForCompare.includes(run.id);
                return (
                  <tr key={run.id} style={{ borderBottom: '1px solid var(--line)', background: isSelected ? 'var(--accent-soft)' : 'transparent' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(run.id)}
                        aria-label={`Select ${run.id} for compare`}
                      />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Link to={`/runs/${run.id}`} style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {run.id}
                      </Link>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>{run.scenarioId}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <StatusChip status={run.provenance === 'live_lab' ? 'Live lab' : 'Recorded'} />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <StatusChip status={run.lifecycle} />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <StatusChip status={run.outcome} variant="outcome" />
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--ink-secondary)' }}>
                      {run.assertionsSummary?.passed}/{run.assertionsSummary?.total} passed
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--ink-muted)' }}>
                      {new Date(run.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Link to={`/runs/${run.id}`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                          Detail
                        </Link>
                        <Link to={`/runs/${run.id}/report`} style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <FileText size={13} /> Report
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
