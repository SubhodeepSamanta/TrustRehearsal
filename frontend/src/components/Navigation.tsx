import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client.js';
import {
  LayoutDashboard,
  Network,
  FlaskConical,
  History,
  GitCompare,
  BookOpen,
  Menu,
  X
} from 'lucide-react';

interface NavigationProps {
  mode: 'LOCAL_OPERATOR' | 'PUBLIC_VIEWER';
}

export default function Navigation({ mode }: NavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: healthData, isError } = useQuery({
    queryKey: ['health-check'],
    queryFn: () => apiFetch<{ status: string; mode: string }>('/health'),
    refetchInterval: 15000,
    retry: 1
  });

  const isOnline = !isError && healthData?.status === 'ok';

  const navItems = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/environment', label: 'Environment', icon: Network },
    { to: '/rehearsals', label: 'Rehearsals', icon: FlaskConical },
    { to: '/runs', label: 'Runs', icon: History },
    { to: '/compare', label: 'Compare', icon: GitCompare },
    { to: '/docs', label: 'Documentation', icon: BookOpen }
  ];

  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Top Header */}
      <header className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--ink)' }}>
              TrustRehearsal
            </h1>
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              background: mode === 'LOCAL_OPERATOR' ? 'var(--accent-soft)' : 'var(--surface-muted)',
              color: mode === 'LOCAL_OPERATOR' ? 'var(--accent)' : 'var(--ink-secondary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}>
              <span style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: mode === 'LOCAL_OPERATOR' ? 'var(--accent)' : 'var(--ink-muted)'
              }} />
              {mode === 'LOCAL_OPERATOR' ? 'Live lab' : 'Recorded example'}
            </span>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 6,
              color: 'var(--ink)',
              cursor: 'pointer'
            }}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={handleNavClick}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'var(--accent)' : 'var(--ink-secondary)',
                    background: isActive ? 'var(--accent-soft)' : 'transparent',
                    textDecoration: 'none'
                  })}
                >
                  <Icon size={16} />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        )}
      </header>

      {/* Desktop Sidebar */}
      <aside className="desktop-sidebar">
        <div style={{ padding: '0 8px', marginBottom: 20 }}>
          <h1 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--ink)' }}>
            TrustRehearsal
          </h1>
          <div style={{ marginTop: 6 }}>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              background: mode === 'LOCAL_OPERATOR' ? 'var(--accent-soft)' : 'var(--surface-muted)',
              color: mode === 'LOCAL_OPERATOR' ? 'var(--accent)' : 'var(--ink-secondary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: mode === 'LOCAL_OPERATOR' ? 'var(--accent)' : 'var(--ink-muted)'
              }} />
              {mode === 'LOCAL_OPERATOR' ? 'Live local lab' : 'Recorded example'}
            </span>
          </div>
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--accent)' : 'var(--ink-secondary)',
                  background: isActive ? 'var(--accent-soft)' : 'transparent',
                  textDecoration: 'none',
                  borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent'
                })}
              >
                <Icon size={16} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div style={{
          paddingTop: 16,
          borderTop: '1px solid var(--line)',
          fontSize: 12
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: 'var(--ink-secondary)',
            paddingLeft: 8
          }}>
            <span style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: mode === 'PUBLIC_VIEWER' ? 'var(--accent)' : isOnline ? 'var(--success)' : 'var(--danger)',
              boxShadow: (mode === 'PUBLIC_VIEWER' || isOnline) ? '0 0 6px rgba(36, 87, 197, 0.4)' : 'none'
            }} />
            <span style={{ fontWeight: 500 }}>
              {mode === 'PUBLIC_VIEWER' ? 'Recorded Explorer Ready' : isOnline ? 'Rehearsal API Online' : 'API Offline'}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
