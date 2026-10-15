import { useState, useEffect, useRef } from 'react';
import { apiFetch, setCsrfToken } from '../api/client.js';
import { Lock, X, AlertTriangle } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<{ role: string; csrfToken: string }>('/operator/session', {
        method: 'POST',
        body: JSON.stringify({ password })
      });
      setCsrfToken(data.csrfToken);
      setPassword('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid operator credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(24, 33, 38, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={{
        background: '#ffffff',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-popover)',
        width: '100%',
        maxWidth: 400,
        padding: 24,
        position: 'relative'
      }}>
        <button
          onClick={onClose}
          aria-label="Close dialog"
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'transparent',
            border: 'none',
            color: 'var(--ink-muted)',
            cursor: 'pointer',
            padding: 4
          }}
        >
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Lock size={16} />
          </div>
          <h3 id="login-modal-title" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
            Operator Authentication
          </h3>
        </div>

        <p style={{ fontSize: 13, color: 'var(--ink-secondary)', marginBottom: 20 }}>
          Enter operator password to enable state-changing lab actions and rehearsals.
        </p>

        {error && (
          <div style={{
            padding: '10px 12px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--danger-soft)',
            color: 'var(--danger)',
            fontSize: 12,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label htmlFor="operator-password-input" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
              Operator Password
            </label>
            <input
              id="operator-password-input"
              ref={inputRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password..."
              required
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--line)',
                fontSize: 13,
                outline: 'none',
                fontFamily: 'inherit'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '1px solid var(--line)',
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--ink-secondary)'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                background: 'var(--accent)',
                color: '#ffffff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
