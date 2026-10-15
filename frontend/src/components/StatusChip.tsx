interface StatusChipProps {
  status: string | null | undefined;
  variant?: 'lifecycle' | 'outcome' | 'env' | 'tls' | 'assertion';
}

export default function StatusChip({ status, variant = 'lifecycle' }: StatusChipProps) {
  if (!status) return null;

  const normalized = status.toLowerCase();

  let bg = 'var(--surface-muted)';
  let color = 'var(--ink-secondary)';
  let label = status;

  if (['completed', 'pass', 'ready', 'authenticated', 'verified'].includes(normalized)) {
    bg = 'var(--success-soft)';
    color = 'var(--success)';
  } else if (['running', 'preparing', 'queued', 'reserved'].includes(normalized)) {
    bg = 'var(--accent-soft)';
    color = 'var(--accent)';
  } else if (['inconclusive', 'needs_reset', 'degraded'].includes(normalized)) {
    bg = 'var(--warning-soft)';
    color = 'var(--warning)';
  } else if (['failed', 'fail', 'cancelled', 'interrupted', 'offline', 'error'].includes(normalized)) {
    bg = 'var(--danger-soft)';
    color = 'var(--danger)';
  }

  if (variant === 'assertion') {
    if (normalized === 'pass') label = 'Passed';
    if (normalized === 'fail') label = 'Failed';
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        backgroundColor: bg,
        color: color,
        textTransform: 'capitalize',
        whiteSpace: 'nowrap'
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          backgroundColor: color
        }}
      />
      {label}
    </span>
  );
}
