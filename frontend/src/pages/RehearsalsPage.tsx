import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client.js';
import { ArrowRight, ShieldCheck, ShieldAlert, GitCommit } from 'lucide-react';

export default function RehearsalsPage() {
  const { data: scenarios, isLoading } = useQuery({
    queryKey: ['scenarios'],
    queryFn: () => apiFetch<any[]>('/scenarios')
  });

  if (isLoading) {
    return <div style={{ padding: 40, color: 'var(--ink-muted)' }}>Loading scenarios...</div>;
  }

  const icons: Record<string, any> = {
    S01: ShieldCheck,
    S02: ShieldAlert,
    S03: GitCommit
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', color: 'var(--ink)' }}>
          Rehearsal Catalog
        </h2>
        <p style={{ fontSize: 14, color: 'var(--ink-secondary)', marginTop: 4 }}>
          Standardized scenario definitions targeting real failure modes in certificate lifecycle and trust rollover.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {(scenarios || []).map((s) => {
          const Icon = icons[s.id] || ShieldCheck;
          return (
            <div
              key={s.id}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-md)',
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 16
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ display: 'flex', gap: 14 }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{s.id}</span>
                      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{s.label}</h3>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--ink-secondary)', marginTop: 4, lineHeight: 1.5 }}>
                      {s.description}
                    </p>
                  </div>
                </div>

                <Link
                  to={`/rehearsals/${s.id}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'var(--surface-muted)',
                    border: '1px solid var(--line)',
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--ink)',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Configure & Run <ArrowRight size={14} />
                </Link>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                paddingTop: 14,
                borderTop: '1px solid var(--line)',
                fontSize: 12,
                color: 'var(--ink-secondary)'
              }}>
                <div>Phases: <strong>{s.phasesCount}</strong></div>
                <div>Assertions: <strong>{s.assertionsCount}</strong></div>
                <div>Max Duration: <strong>{s.maxDurationMs / 1000}s</strong></div>
                <div>Expected Faults: <strong>{s.expectedFaults?.join(', ') || 'none'}</strong></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
