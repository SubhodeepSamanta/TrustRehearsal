import { useEffect, useState, useRef } from 'react';

const API_BASE = ((import.meta as any).env?.VITE_API_URL || '') + '/api/v1';

let currentCsrfToken: string | null = null;
let cachedSnapshots: any[] | null = null;

export function setCsrfToken(token: string | null) {
  currentCsrfToken = token;
}

export function getCsrfToken(): string | null {
  return currentCsrfToken;
}

async function loadStaticSnapshots(): Promise<any[]> {
  if (cachedSnapshots) return cachedSnapshots;
  try {
    const res = await fetch('/data/snapshots.json');
    if (res.ok) {
      cachedSnapshots = await res.json();
      return cachedSnapshots || [];
    }
  } catch {
    // fallback empty
  }
  return [];
}

const STATIC_SCENARIOS: Record<string, any> = {
  S01: {
    id: 'S01',
    version: '1',
    label: 'Renewal without application reload',
    description: 'Detects mismatch between leaf certificate deployed to disk and serving TLS context; verifies hot reload recovery.',
    expectedFaults: ['Serving context mismatch (stale in-memory certificate)'],
    phaseDefinitions: [
      { id: 'baseline', name: 'Baseline Probing', description: 'Measure initial active certificate handshakes' },
      { id: 'issue_install', name: 'Issue & Install Renewal', description: 'Install renewed leaf to disk without reload' },
      { id: 'observe_mismatch', name: 'Observe Mismatch', description: 'Verify serving context still serves stale certificate' },
      { id: 'reload_context', name: 'In-Memory Context Reload', description: 'Trigger hot reload without process restart' },
      { id: 'verify_a1', name: 'Verify Reloaded Serving State', description: 'Confirm new certificate is immediately served' },
      { id: 'recovery_reset', name: 'Baseline Reset', description: 'Restore initial baseline certificate profile' }
    ],
    assertionDefinitions: [
      { id: 'A01_diff_fingerprint', label: 'A1 fingerprint differs from A0', target: 'orders' },
      { id: 'A02_disk_installed', label: 'Disk profile updated to A1', target: 'orders' },
      { id: 'A03_served_before_reload', label: 'Serving context remained A0 before reload', target: 'orders' },
      { id: 'A04_mismatch_detected', label: 'Mismatch successfully detected', target: 'orders' },
      { id: 'A05_served_after_reload', label: 'Serving context updated to A1 after reload', target: 'orders' },
      { id: 'A_baseline_restored', label: 'Clean baseline restored & verified', target: 'orders' }
    ],
    phasesCount: 6,
    assertionsCount: 6,
    maxDurationMs: 30000
  },
  S02: {
    id: 'S02',
    version: '1',
    label: 'Issuance-path unavailability',
    description: 'Simulates network partition to CA issuance proxy while verifying continuous valid TLS data plane traffic.',
    expectedFaults: ['CA Issuance Proxy network partition'],
    phaseDefinitions: [
      { id: 'baseline', name: 'Baseline Probing', description: 'Verify healthy service-to-service TLS handshakes' },
      { id: 'fault_injection', name: 'Simulate Proxy Partition', description: 'Block communication to CA issuance proxy' },
      { id: 'renewal_attempts', name: 'Bounded Renewal Attempts', description: 'Confirm bounded renewals fail predictably' },
      { id: 'active_traffic_verification', name: 'Active Traffic Verification', description: 'Confirm data plane handshakes are uninterrupted' },
      { id: 'restore_and_renew', name: 'Restore Proxy & Renew', description: 'Clear partition and complete issuance' },
      { id: 'recovery_reset', name: 'Baseline Reset', description: 'Restore environment baseline' }
    ],
    assertionDefinitions: [
      { id: 'A01_renewal_rejected_during_outage', label: 'Renewal fails predictably during outage', target: 'orders' },
      { id: 'A02_active_traffic_unaffected', label: 'Active data plane unaffected', target: 'orders' },
      { id: 'A03_issuance_restored_after_recovery', label: 'Issuance succeeds after recovery', target: 'orders' },
      { id: 'A_baseline_restored', label: 'Clean baseline restored & verified', target: 'orders' }
    ],
    phasesCount: 6,
    assertionsCount: 4,
    maxDurationMs: 45000
  },
  S03: {
    id: 'S03',
    version: '1',
    label: 'Trust-root rollover',
    description: 'Compares abrupt root replacement failure against a controlled dual-trust staged rollover sequence.',
    expectedFaults: ['Root A to Root B transition mismatch'],
    phaseDefinitions: [
      { id: 'baseline', name: 'Baseline Probing', description: 'Verify healthy handshakes under Root A' },
      { id: 'abrupt_switch', name: 'Abrupt Switch (Negative Control)', description: 'Serve Root B leaf to Root A callers' },
      { id: 'verify_rejection', name: 'Verify Trust Rejection', description: 'Assert strict TLS rejection without trust expansion' },
      { id: 'restore_baseline', name: 'Restore Baseline', description: 'Return to clean Root A baseline' },
      { id: 'dual_trust_install', name: 'Dual Trust Install', description: 'Install Root A + B bundle on callers' },
      { id: 'verify_dual_trust', name: 'Verify Dual Trust with Root A', description: 'Confirm Root A traffic continues' },
      { id: 'switch_leaf_b', name: 'Switch Leaf to Root B', description: 'Serve Root B leaf to dual-trust callers' },
      { id: 'prune_trust_a', name: 'Prune Trust to Root B', description: 'Retire Root A leaving Root B active' },
      { id: 'recovery_reset', name: 'Baseline Reset', description: 'Restore baseline Root A trust' }
    ],
    assertionDefinitions: [
      { id: 'A01_abrupt_switch_rejected', label: 'Abrupt switch rejected', target: 'orders' },
      { id: 'A02_dual_trust_established', label: 'Dual trust established', target: 'gateway' },
      { id: 'A03_leaf_b_accepted_under_dual_trust', label: 'Root B leaf accepted', target: 'orders' },
      { id: 'A04_trust_pruned_to_root_b', label: 'Trust pruned to Root B', target: 'gateway' },
      { id: 'A_baseline_restored', label: 'Clean baseline restored & verified', target: 'orders' }
    ],
    phasesCount: 9,
    assertionsCount: 5,
    maxDurationMs: 90000
  }
};

async function handleStaticFallback<T>(path: string): Promise<T> {
  const snapshots = await loadStaticSnapshots();

  if (path === '/meta') {
    return {
      mode: 'PUBLIC_VIEWER',
      capabilities: {
        liveExecution: false,
        exportReport: true,
        scenarios: ['S01', 'S02', 'S03']
      },
      buildVersion: '1.0.0',
      fixtureProvenance: 'recorded_example'
    } as unknown as T;
  }

  if (path === '/health') {
    return { status: 'ok', mode: 'PUBLIC_VIEWER', timestamp: new Date().toISOString() } as unknown as T;
  }

  if (path === '/ready') {
    return {
      ready: snapshots.length > 0,
      mode: 'PUBLIC_VIEWER',
      database: 'static_snapshot_adapter',
      runsCount: snapshots.length
    } as unknown as T;
  }

  if (path === '/operator/session') {
    return { role: 'viewer', csrfToken: null } as unknown as T;
  }

  if (path === '/environments' || path === '/environments/sample-lab') {
    const env = {
      id: 'sample-lab',
      revision: 'v1.0.0',
      label: 'Recorded Lab Topology (gateway -> orders -> ledger)',
      baselineProfile: 'A0',
      state: 'ready',
      services: [
        { id: 'gateway', name: 'gateway', role: 'caller', port: 8443, configuredIssuer: 'issuer-a', installedProfile: 'A0', status: 'healthy' },
        { id: 'orders', name: 'orders', role: 'service', port: 8444, configuredIssuer: 'issuer-a', installedProfile: 'A0', status: 'healthy' },
        { id: 'ledger', name: 'ledger', role: 'service', port: 8445, configuredIssuer: 'issuer-a', installedProfile: 'A0', status: 'healthy' }
      ]
    };
    return (path === '/environments' ? [env] : env) as unknown as T;
  }

  if (path === '/scenarios') {
    return Object.values(STATIC_SCENARIOS) as unknown as T;
  }

  if (path.startsWith('/scenarios/')) {
    const scenarioId = path.replace('/scenarios/', '');
    const scenario = STATIC_SCENARIOS[scenarioId];
    if (!scenario) throw new Error(`HTTP 404: Scenario ${scenarioId} not found.`);
    return scenario as unknown as T;
  }

  if (path === '/runs' || path.startsWith('/runs?')) {
    return {
      runs: snapshots.map((r) => ({
        id: r.id,
        scenarioId: r.scenarioId,
        scenarioVersion: r.scenarioVersion || '1',
        environmentId: r.environmentId,
        provenance: 'recorded_example',
        lifecycle: r.lifecycle,
        outcome: r.outcome,
        active: false,
        createdAt: r.createdAt,
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
        assertionsSummary: r.assertionsSummary
      })),
      nextCursor: null
    } as unknown as T;
  }

  if (path.startsWith('/runs/')) {
    const parts = path.split('/').filter(Boolean);
    const runId = parts[1];
    const sub = parts[2];

    const run = snapshots.find((s) => s.id === runId);
    if (!run) {
      throw new Error(`HTTP 404: Recorded run ${runId} not found.`);
    }

    if (!sub) {
      return { ...run, provenance: 'recorded_example' } as unknown as T;
    }

    if (sub === 'events') {
      return (run.events || []) as unknown as T;
    }

    if (sub === 'report') {
      const report = {
        schemaVersion: '1.0',
        reportId: `report-${run.id}`,
        generatedAt: new Date().toISOString(),
        run: {
          id: run.id,
          provenance: 'recorded_example',
          lifecycle: run.lifecycle,
          outcome: run.outcome,
          scenarioId: run.scenarioId,
          scenarioVersion: run.scenarioVersion || '1',
          environmentId: run.environmentId,
          environmentRevision: run.environmentRevision || 'v1.0.0',
          buildCommit: run.buildCommit || null,
          toolVersions: run.toolVersions || { node: 'v22.16.0' }
        },
        environmentSnapshot: {
          label: 'Recorded Lab Topology (gateway -> orders -> ledger)',
          services: [
            { id: 'gateway', role: 'caller', port: 8443, configuredIssuer: 'issuer-a', installedProfile: 'A0', status: 'healthy' },
            { id: 'orders', role: 'service', port: 8444, configuredIssuer: 'issuer-a', installedProfile: 'A0', status: 'healthy' },
            { id: 'ledger', role: 'service', port: 8445, configuredIssuer: 'issuer-a', installedProfile: 'A0', status: 'healthy' }
          ],
          edges: [
            { id: 'edge-gateway-orders', caller: 'gateway', callee: 'orders', port: 8444 },
            { id: 'edge-orders-ledger', caller: 'orders', callee: 'ledger', port: 8445 }
          ]
        },
        scenarioSnapshot: {
          id: run.scenarioId,
          version: run.scenarioVersion || '1',
          label: STATIC_SCENARIOS[run.scenarioId]?.label || run.scenarioId
        },
        methodology: {
          description: STATIC_SCENARIOS[run.scenarioId]?.description || 'Rehearsal execution methodology',
          sampleCount: (run.events || []).filter((e: any) => e.type === 'tls_probe').length || 10,
          windows: [
            { phase: 'baseline', sampleCount: 5, targetService: 'orders' },
            { phase: 'verification', sampleCount: 5, targetService: 'orders' }
          ]
        },
        assertions: run.assertionResults || [],
        measurements: (run.events || []).filter((e: any) => e.type === 'tls_probe').map((e: any) => e.data),
        recovery: run.recoveryResult || { status: 'verified', evidenceEventIds: [], completedAt: run.finishedAt },
        evidenceEvents: run.events || [],
        limitations: run.limitations || []
      };
      return report as unknown as T;
    }
  }

  throw new Error(`HTTP 404: Endpoint ${path} not found in static mode.`);
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (currentCsrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method || 'GET')) {
    headers.set('X-CSRF-Token', currentCsrfToken);
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include'
    });

    if (!res.ok) {
      if (res.status === 404) {
        let errJson;
        try {
          errJson = await res.json();
        } catch {
          throw new Error(`HTTP 404: Resource not found`);
        }
        throw new Error(errJson?.error?.message || `HTTP 404: Resource not found`);
      }

      let errorJson;
      try {
        errorJson = await res.json();
      } catch {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      throw new Error(errorJson?.error?.message || `HTTP ${res.status}`);
    }

    return await res.json();
  } catch (err: any) {
    if (err.message && err.message.startsWith('HTTP 404')) {
      throw err;
    }
    // If backend is unreachable or in static preview, attempt static fallback
    if (options.method && options.method !== 'GET') {
      throw err;
    }
    return handleStaticFallback<T>(path);
  }
}

export function useRunStream(runId: string | undefined, onEvent: (event: any) => void) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!runId) return;

    const sseUrl = `${API_BASE}/runs/${runId}/stream`;
    try {
      const es = new EventSource(sseUrl, { withCredentials: true });
      eventSourceRef.current = es;

      es.onopen = () => {
        setConnected(true);
      };

      es.addEventListener('run-event', (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          onEvent(parsed);
        } catch (err) {
          console.error('Failed to parse SSE event:', err);
        }
      });

      es.onerror = () => {
        setConnected(false);
      };

      return () => {
        es.close();
        setConnected(false);
      };
    } catch {
      // EventSource failed
    }
  }, [runId]);

  return { connected };
}
