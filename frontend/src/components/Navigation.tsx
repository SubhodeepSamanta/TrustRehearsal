import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Network,
  FlaskConical,
  History,
  GitCompare,
  BookOpen,
  Lock,
  LogOut,
  ShieldCheck
} from 'lucide-react';

interface NavigationProps {
  mode: 'LOCAL_OPERATOR' | 'PUBLIC_VIEWER';
  isOperator: boolean;
  onLogout: () => void;
  onOpenLogin: () => void;
}

export default function Navigation({ mode, isOperator, onLogout, onOpenLogin }: NavigationProps) {
  const navItems = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/environment', label: 'Environment', icon: Network },
    { to: '/rehearsals', label: 'Rehearsals', icon: FlaskConical },
    { to: '/runs', label: 'Runs', icon: History },
    { to: '/compare', label: 'Compare', icon: GitCompare },
    { to: '/docs', label: 'Documentation', icon: BookOpen }
  ];

  return (
    <aside style={{
      width: 208,
      background: 'var(--surface)',
      borderRight: '1px solid var(--line)',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 12px',
      userSelect: 'none',
      flexShrink: 0
    }}>
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
        {mode === 'LOCAL_OPERATOR' ? (
          isOperator ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--success)' }}>
                <ShieldCheck size={14} />
                <span style={{ fontWeight: 600 }}>Operator active</span>
              </div>
              <button
                onClick={onLogout}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 8px',
                  fontSize: 12,
                  color: 'var(--ink-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <LogOut size={12} />
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              style={{
                width: '100%',
                background: 'var(--surface-muted)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 10px',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--ink)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <Lock size={12} />
              Operator sign in
            </button>
          )
        ) : (
          <div style={{ padding: '0 8px', color: 'var(--ink-muted)' }}>
            Read-only preview
          </div>
        )}
      </div>
    </aside>
  );
}
