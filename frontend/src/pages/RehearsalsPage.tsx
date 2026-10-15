import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client.js';
import { ArrowRight, ShieldCheck, ShieldAlert, GitCommit } from 'lucide-react';

interface RehearsalsPageProps {
  mode?: 'LOCAL_OPERATOR' | 'PUBLIC_VIEWER';
}

export default function RehearsalsPage({ mode: _mode }: RehearsalsPageProps) {
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
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
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
                    background: 'var(--accent)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Explore rehearsal <ArrowRight size={14} />
                </Link>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                paddingTop: 14,
                borderTop: '1px solid var(--line)',
                fontSize: 12,
                color: 'var(--ink-secondary)',
                flexWrap: 'wrap'
              }}>
                <div>Phases: <strong>{s.phasesCount || s.phaseDefinitions?.length || 6}</strong></div>
                <div>Assertions: <strong>{s.assertionsCount || s.assertionDefinitions?.length || 5}</strong></div>
                <div>Max Duration: <strong>{(s.maxDurationMs || 30000) / 1000}s</strong></div>
                <div>Expected Faults: <strong>{s.expectedFaults?.join(', ') || 'Controlled TLS mutation'}</strong></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
