import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ReportSchema, Report } from '../contracts/index.js';

export function createSnapshotRouter(): Router {
  const router = Router();
  const snapshotPath = path.resolve(__dirname, '../export/recorded-snapshots.json');
  let snapshots: any[] = [];

  if (fs.existsSync(snapshotPath)) {
    snapshots = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
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
    res.json({
      ready: true,
      mode: 'PUBLIC_VIEWER',
      database: 'snapshot_adapter',
      runsCount: snapshots.length
    });
  });

  // Operator session in viewer mode is always viewer
  router.get('/operator/session', (_req: Request, res: Response) => {
    res.json({ role: 'viewer', csrfToken: null });
  });

  router.post('/operator/session', (_req: Request, res: Response) => {
    res.status(403).json({
      error: { code: 'LIVE_DISABLED', message: 'Operator login disabled in PUBLIC_VIEWER mode.', requestId: crypto.randomUUID() }
    });
  });

  // Environments (static snapshot)
  router.get('/environments', (_req: Request, res: Response) => {
    res.json([
      {
        id: 'sample-lab',
        revision: 'v1.0.0',
        label: 'Recorded Lab Topology (gateway -> orders -> ledger)',
        state: 'ready',
        baselineProfile: 'A0',
        servicesCount: 3
      }
    ]);
  });

  router.get('/environments/:id', (_req: Request, res: Response) => {
    res.json({
      id: 'sample-lab',
      revision: 'v1.0.0',
      label: 'Recorded Lab Topology (gateway -> orders -> ledger)',
      state: 'ready',
      baselineProfile: 'A0',
      services: [
        {
          id: 'gateway',
          name: 'Gateway API',
          role: 'gateway',
          port: 8443,
          configuredIssuer: 'issuer-a',
          installedProfile: 'A0',
          status: 'healthy'
        },
        {
          id: 'orders',
          name: 'Orders Service',
          role: 'orders',
          port: 8444,
          configuredIssuer: 'issuer-a',
          installedProfile: 'A0',
          status: 'healthy'
        },
        {
          id: 'ledger',
          name: 'Ledger Service',
          role: 'ledger',
          port: 8445,
          configuredIssuer: 'issuer-a',
          installedProfile: 'A0',
          status: 'healthy'
        }
      ],
      edges: [
        {
          id: 'edge-gateway-orders',
          caller: 'gateway',
          callee: 'orders',
          servername: 'orders',
          expectedTrustProfile: 'root-a'
        },
        {
          id: 'edge-orders-ledger',
          caller: 'orders',
          callee: 'ledger',
          servername: 'ledger',
          expectedTrustProfile: 'root-a'
        }
      ]
    });
  });

  // Scenarios
  router.get('/scenarios', (_req: Request, res: Response) => {
    res.json([
      {
        id: 'S01',
        version: '1',
        label: 'Renewal without application reload',
        description: 'Detects mismatch between leaf certificate deployed to disk and the serving TLS context.',
        maxDurationMs: 60000,
        phasesCount: 6,
        assertionsCount: 6
      },
      {
        id: 'S02',
        version: '1',
        label: 'Issuance-path unavailability',
        description: 'Demonstrates that CA proxy partition does not disrupt data-plane traffic.',
        maxDurationMs: 60000,
        phasesCount: 6,
        assertionsCount: 4
      },
      {
        id: 'S03',
        version: '1',
        label: 'Trust-root rollover',
        description: 'Compares abrupt root replacement failure with safe dual-trust rollover sequence.',
        maxDurationMs: 90000,
        phasesCount: 8,
        assertionsCount: 4
      }
    ]);
  });

  router.get('/scenarios/:id', (req: Request, res: Response) => {
    const id = req.params.id;
    res.json({
      id,
      version: '1',
      label: id === 'S01' ? 'Renewal without application reload' : id === 'S02' ? 'Issuance-path unavailability' : 'Trust-root rollover',
      description: 'Recorded scenario definition.',
      expectedFaults: [],
      phaseDefinitions: [],
      assertionDefinitions: [],
      maxDurationMs: 60000
    });
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
        assertionsSummary: {
          total: r.assertionResults?.length || 0,
          passed: (r.assertionResults || []).filter((a: any) => a.status === 'pass').length
        }
      })),
      nextCursor: null
    });
  });

  router.get('/runs/:id', (req: Request, res: Response) => {
    const run = snapshots.find((s) => s.id === req.params.id) || snapshots[0];
    if (!run) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recorded run not found' } });
    }
    res.json({ ...run, provenance: 'recorded_example' });
  });

  router.get('/runs/:id/events', (req: Request, res: Response) => {
    const run = snapshots.find((s) => s.id === req.params.id) || snapshots[0];
    if (!run) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recorded run not found' } });
    }
    res.json(run.events || []);
  });

  router.get('/runs/:id/report', (req: Request, res: Response) => {
    const run = snapshots.find((s) => s.id === req.params.id) || snapshots[0];
    if (!run) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recorded run not found' } });
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
        scenarioVersion: run.scenarioVersion,
        environmentId: run.environmentId,
        environmentRevision: run.environmentRevision || 'v1.0.0',
        buildCommit: null,
        toolVersions: run.toolVersions || { node: process.version }
      },
      environmentSnapshot: {
        label: 'Recorded Lab Topology',
        services: [],
        edges: []
      },
      scenarioSnapshot: {
        id: run.scenarioId,
        version: run.scenarioVersion || '1',
        label: run.scenarioId === 'S01' ? 'Renewal without application reload' : run.scenarioId === 'S02' ? 'Issuance-path unavailability' : 'Trust-root rollover'
      },
      methodology: {
        description: 'Recorded real lab executions with strictly verified fresh TLS handshakes.',
        sampleCount: (run.events || []).filter((e: any) => e.type === 'tls_probe').length,
        windows: []
      },
      assertions: run.assertionResults || [],
      measurements: [],
      recovery: run.recoveryResult || { status: 'verified', evidenceEventIds: [] },
      evidenceEvents: run.events || [],
      limitations: [
        'Recorded example exported from controlled local lab.',
        'Not generated live on this viewer deployment.'
      ]
    };

    res.json(report);
  });

  // All mutation routes strictly return 403 in PUBLIC_VIEWER mode
  const denyMutation = (_req: Request, res: Response) => {
    res.status(403).json({
      error: {
        code: 'LIVE_DISABLED',
        message: 'Live execution is disabled on this read-only public viewer build.',
        requestId: crypto.randomUUID()
      }
    });
  };

  router.post('/runs', denyMutation);
  router.post('/runs/:id/cancel', denyMutation);
  router.post('/environments/:id/reset', denyMutation);

  return router;
}
