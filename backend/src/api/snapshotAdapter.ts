import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Report, ReportSchema } from '../contracts/index.js';

export function createSnapshotRouter(): Router {
  const router = Router();
  const dir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

  const possiblePaths = [
    path.resolve(dir, '../export/recorded-snapshots.json'),
    path.resolve(dir, '../../export/recorded-snapshots.json'),
    path.resolve(dir, '../../../backend/src/export/recorded-snapshots.json'),
    path.resolve(process.cwd(), 'dist/export/recorded-snapshots.json'),
    path.resolve(process.cwd(), 'src/export/recorded-snapshots.json'),
    path.resolve(process.cwd(), 'backend/dist/export/recorded-snapshots.json'),
    path.resolve(process.cwd(), 'backend/src/export/recorded-snapshots.json')
  ];

  let snapshotPath = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      snapshotPath = p;
      break;
    }
  }

  let snapshots: any[] = [];
  if (snapshotPath && fs.existsSync(snapshotPath)) {
    try {
      snapshots = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
    } catch {
      snapshots = [];
    }
  }

  // Meta
  router.get('/meta', (_req: Request, res: Response) => {
    res.json({
      mode: 'PUBLIC_VIEWER',
      capabilities: {
        liveExecution: false,
        exportReport: true,
        scenarios: ['S01', 'S02', 'S03']
      },
      buildVersion: '1.0.0',
      fixtureProvenance: 'recorded_example'
    });
  });

  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', mode: 'PUBLIC_VIEWER', timestamp: new Date().toISOString() });
  });

  router.get('/ready', (_req: Request, res: Response) => {
    if (snapshots.length === 0) {
      return res.status(503).json({
        ready: false,
        mode: 'PUBLIC_VIEWER',
        database: 'snapshot_adapter',
        runsCount: 0,
        error: 'RECORDED_DATA_UNAVAILABLE',
        message: 'No recorded snapshot data found in export location'
      });
    }
    res.json({
      ready: true,
      mode: 'PUBLIC_VIEWER',
      database: 'snapshot_adapter',
      runsCount: snapshots.length
    });
  });

  // Operator session in viewer mode is always disabled
  router.get('/operator/session', (_req: Request, res: Response) => {
    res.json({ role: 'viewer', csrfToken: null });
  });

  router.post('/operator/session', (_req: Request, res: Response) => {
    res.status(403).json({
      error: { code: 'LIVE_DISABLED', message: 'Operator login disabled in PUBLIC_VIEWER mode.', requestId: crypto.randomUUID() }
    });
  });

  // Environments
  router.get('/environments', (_req: Request, res: Response) => {
    res.json([
      {
        id: 'sample-lab',
        revision: 'v1.0.0',
        label: 'Recorded Lab Topology (gateway -> orders -> ledger)',
        baselineProfile: 'A0',
        state: 'ready',
        services: [
          {
            id: 'gateway',
            name: 'gateway',
            role: 'caller',
            port: 8443,
            configuredIssuer: 'issuer-a',
            installedProfile: 'A0',
            servingFingerprint: '4d18ec03ebbf6e9c...',
            status: 'healthy'
          },
          {
            id: 'orders',
            name: 'orders',
            role: 'service',
            port: 8444,
            configuredIssuer: 'issuer-a',
            installedProfile: 'A0',
            servingFingerprint: '9f5f27f1b9835aaa...',
            status: 'healthy'
          },
          {
            id: 'ledger',
            name: 'ledger',
            role: 'service',
            port: 8445,
            configuredIssuer: 'issuer-a',
            installedProfile: 'A0',
            servingFingerprint: '0c5a7ed1a441f152...',
            status: 'healthy'
          }
        ],
        trustRoots: [
          {
            id: 'root-a',
            name: 'Root Authority A',
            fingerprint: '3b2d18ac94f0...',
            status: 'active'
          },
          {
            id: 'root-b',
            name: 'Root Authority B (Migration Target)',
            fingerprint: '9e7a4128fbb0...',
            status: 'active'
          }
        ]
      }
    ]);
  });

  router.get('/environments/:id', (req: Request, res: Response) => {
    if (req.params.id !== 'sample-lab') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: `Environment ${req.params.id} not found.` } });
    }
    res.json({
      id: 'sample-lab',
      revision: 'v1.0.0',
      label: 'Recorded Lab Topology (gateway -> orders -> ledger)',
      baselineProfile: 'A0',
      state: 'ready',
      services: [
        { id: 'gateway', name: 'gateway', port: 8443, installedProfile: 'A0', status: 'healthy' },
        { id: 'orders', name: 'orders', port: 8444, installedProfile: 'A0', status: 'healthy' },
        { id: 'ledger', name: 'ledger', port: 8445, installedProfile: 'A0', status: 'healthy' }
      ]
    });
  });

  const scenarioDefinitions: Record<string, any> = {
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
      maxDurationMs: 90000
    }
  };

  router.get('/scenarios', (_req: Request, res: Response) => {
    res.json(Object.values(scenarioDefinitions));
  });

  router.get('/scenarios/:id', (req: Request, res: Response) => {
    const scenario = scenarioDefinitions[req.params.id];
    if (!scenario) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: `Scenario ${req.params.id} not found.` }
      });
    }
    res.json(scenario);
  });

  // Runs
  router.get('/runs', (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 50);
    res.json({
      runs: snapshots.slice(0, limit).map((r) => ({
        id: r.id,
        scenarioId: r.scenarioId,
        scenarioVersion: r.scenarioVersion,
        environmentId: r.environmentId,
        provenance: 'recorded_example',
        lifecycle: r.lifecycle,
        outcome: r.outcome,
        active: false,
        createdAt: r.createdAt,
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
        assertionsSummary: r.assertionsSummary || {
          total: (r.assertionResults || []).length,
          passed: (r.assertionResults || []).filter((assertion: any) => assertion.status === 'pass').length
        }
      })),
      nextCursor: null
    });
  });

  router.get('/runs/:id', (req: Request, res: Response) => {
    const run = snapshots.find((s) => s.id === req.params.id);
    if (!run) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: `Recorded run ${req.params.id} not found.` } });
    }
    res.json({ ...run, provenance: 'recorded_example' });
  });

  router.get('/runs/:id/events', (req: Request, res: Response) => {
    const run = snapshots.find((s) => s.id === req.params.id);
    if (!run) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: `Recorded run ${req.params.id} not found.` } });
    }
    res.json(run.events || []);
  });

  router.get('/runs/:id/report', (req: Request, res: Response) => {
    const run = snapshots.find((s) => s.id === req.params.id);
    if (!run) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: `Recorded run ${req.params.id} not found.` } });
    }

    if (run.report) {
      const parsed = ReportSchema.safeParse(run.report);
      if (!parsed.success || parsed.data.run.id !== run.id || parsed.data.run.provenance !== 'recorded_example') {
        return res.status(503).json({ error: { code: 'INVALID_RECORDED_REPORT', message: 'Recorded evidence failed validation.' } });
      }
      return res.json(parsed.data);
    }

    const report: Report = {
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
        toolVersions: run.toolVersions || {}
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
        label: scenarioDefinitions[run.scenarioId]?.label || run.scenarioId
      },
      methodology: {
        description: scenarioDefinitions[run.scenarioId]?.description || 'Rehearsal execution methodology',
        sampleCount: run.events?.filter((e: any) => e.type === 'tls_probe').length || 0,
        windows: run.methodology?.windows || []
      },
      assertions: run.assertionResults || [],
      measurements: run.events?.filter((e: any) => e.type === 'tls_probe').map((e: any) => e.data) || [],
      recovery: run.recoveryResult || { status: 'not_run', evidenceEventIds: [] },
      evidenceEvents: run.events || [],
      limitations: run.limitations || []
    };

    res.json(report);
  });

  const mutationHandler = (_req: Request, res: Response) => {
    return res.status(403).json({
      error: {
        code: 'LIVE_DISABLED',
        message: 'Mutation operations are disabled in PUBLIC_VIEWER mode.',
        requestId: crypto.randomUUID()
      }
    });
  };

  router.post('*', mutationHandler);
  router.put('*', mutationHandler);
  router.delete('*', mutationHandler);
  router.patch('*', mutationHandler);

  return router;
}
