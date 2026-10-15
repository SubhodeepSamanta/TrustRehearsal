import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  EnvironmentModel,
  ScenarioModel,
  RunModel,
  RunEventModel,
  SessionModel,
  IdempotencyModel,
  LeaseModel
} from '../db/models.js';
import {
  DeploymentMode,
  StartRunRequestSchema,
  ReportSchema,
  Report
} from '../contracts/index.js';
import { RunExecutionEngine } from '../worker/engine.js';
import { LabController } from '../lab/controller.js';

export function createApiRouter(
  mode: DeploymentMode,
  engine: RunExecutionEngine,
  controller: LabController
): Router {
  const router = Router();
  const operatorPassword = process.env.OPERATOR_PASSWORD || 'operator-rehearsal-2026';
  const operatorHash = process.env.OPERATOR_PASSWORD_HASH || bcrypt.hashSync(operatorPassword, 10);

  // Authentication & Session middleware
  const getSession = async (req: Request) => {
    const sessionId = req.cookies?.trust_session;
    if (!sessionId) return null;
    return SessionModel.findOne({ sessionId, expiresAt: { $gt: new Date() } });
  };

  const requireOperator = async (req: Request, res: Response, next: NextFunction) => {
    if (mode === 'PUBLIC_VIEWER') {
      return res.status(403).json({
        error: {
          code: 'LIVE_DISABLED',
          message: 'Mutation operations are disabled in PUBLIC_VIEWER mode.',
          requestId: crypto.randomUUID()
        }
      });
    }

    const session = await getSession(req);
    if (!session || session.role !== 'operator') {
      return res.status(401).json({
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Operator authentication required.',
          requestId: crypto.randomUUID()
        }
      });
    }

    const csrfHeader = req.headers['x-csrf-token'];
    if (!csrfHeader || csrfHeader !== session.csrfToken) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Invalid or missing CSRF token.',
          requestId: crypto.randomUUID()
        }
      });
    }

    (req as any).session = session;
    next();
  };

  // Session routes
  router.post('/operator/session', async (req: Request, res: Response) => {
    if (mode === 'PUBLIC_VIEWER') {
      return res.status(403).json({
        error: { code: 'LIVE_DISABLED', message: 'Operator login disabled in viewer mode.', requestId: crypto.randomUUID() }
      });
    }

    const { password } = req.body;
    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        error: { code: 'INVALID_REQUEST', message: 'Password is required.', requestId: crypto.randomUUID() }
      });
    }

    const match = bcrypt.compareSync(password, operatorHash);
    if (!match) {
      return res.status(401).json({
        error: { code: 'NOT_AUTHENTICATED', message: 'Invalid credentials.', requestId: crypto.randomUUID() }
      });
    }

    const sessionId = crypto.randomBytes(32).toString('hex');
    const csrfToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);

    await SessionModel.create({
      sessionId,
      role: 'operator',
      csrfToken,
      expiresAt
    });

    res.cookie('trust_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: expiresAt
    });

    res.json({
      role: 'operator',
      csrfToken,
      expiresAt: expiresAt.toISOString()
    });
  });

  router.get('/operator/session', async (req: Request, res: Response) => {
    const session = await getSession(req);
    if (!session) {
      return res.json({ role: 'viewer', csrfToken: null });
    }
    res.json({
      role: session.role,
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt.toISOString()
    });
  });

  router.delete('/operator/session', async (req: Request, res: Response) => {
    const sessionId = req.cookies?.trust_session;
    if (sessionId) {
      await SessionModel.deleteOne({ sessionId });
      res.clearCookie('trust_session');
    }
    res.json({ status: 'logged_out' });
  });

  // Meta & Health
  router.get('/meta', (_req: Request, res: Response) => {
    res.json({
      mode,
      capabilities: {
        liveExecution: mode === 'LOCAL_OPERATOR',
        exportReport: true,
        scenarios: ['S01', 'S02', 'S03']
      },
      buildVersion: '1.0.0',
      fixtureProvenance: mode === 'PUBLIC_VIEWER' ? 'recorded_example' : 'live_lab'
    });
  });

  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', mode, timestamp: new Date().toISOString() });
  });

  router.get('/ready', async (_req: Request, res: Response) => {
    try {
      const env = await EnvironmentModel.findOne({ id: 'sample-lab' });
      const ready = !!env && controller.services.size >= 3;
      res.json({
        ready,
        mode,
        database: 'connected',
        controller: 'initialized',
        servicesCount: controller.services.size,
        environmentState: env?.state || 'unknown'
      });
    } catch (err: any) {
      res.status(503).json({ ready: false, error: err.message });
    }
  });

  // Environments
  router.get('/environments', async (_req: Request, res: Response) => {
    const envs = await EnvironmentModel.find().lean();
    res.json(envs.map((env) => ({
      id: env.id,
      revision: env.revision,
      label: env.label,
      state: env.state,
      baselineProfile: env.baselineProfile,
      lastVerifiedAt: env.lastVerifiedAt,
      servicesCount: env.services?.length || 0
    })));
  });

  router.get('/environments/:id', async (req: Request, res: Response) => {
    const env = await EnvironmentModel.findOne({ id: req.params.id }).lean();
    if (!env) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Environment not found', requestId: crypto.randomUUID() } });
    }

    // Attach latest serving fingerprints from running controller services
    const enrichedServices = (env.services || []).map((s: any) => {
      const liveService = controller.services.get(s.role);
      return {
        ...s,
        servingFingerprint: liveService ? liveService.servingProfile.fingerprint : null,
        installedFingerprint: liveService ? liveService.installedProfile.fingerprint : null
      };
    });

    res.json({ ...env, services: enrichedServices });
  });

  // Scenarios
  router.get('/scenarios', async (_req: Request, res: Response) => {
    const scenarios = await ScenarioModel.find().sort({ scenarioId: 1 }).lean();
    res.json(scenarios.map((s) => ({
      id: s.scenarioId,
      version: s.version,
      label: s.label,
      description: s.description,
      expectedFaults: s.expectedFaults,
      maxDurationMs: s.maxDurationMs,
      phasesCount: s.phaseDefinitions?.length || 0,
      assertionsCount: s.assertionDefinitions?.length || 0
    })));
  });

  router.get('/scenarios/:id', async (req: Request, res: Response) => {
    const scenario = await ScenarioModel.findOne({ scenarioId: req.params.id }).lean();
    if (!scenario) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Scenario not found', requestId: crypto.randomUUID() } });
    }
    res.json({ ...scenario, id: scenario.scenarioId });
  });

  // Runs
  router.get('/runs', async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 50);
    const cursor = req.query.cursor as string;

    const query: any = {};
    if (cursor) {
      query.createdAt = { $lt: cursor };
    }

    const runs = await RunModel.find(query).sort({ createdAt: -1 }).limit(limit).lean();
    const nextCursor = runs.length === limit ? runs[runs.length - 1].createdAt : null;

    res.json({
      runs: runs.map((r) => ({
        id: r.runId,
        scenarioId: r.scenarioId,
        scenarioVersion: r.scenarioVersion,
        environmentId: r.environmentId,
        provenance: r.provenance,
        lifecycle: r.lifecycle,
        outcome: r.outcome,
        active: r.active,
        createdAt: r.createdAt,
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
        assertionsSummary: {
          total: r.assertionResults?.length || 0,
          passed: (r.assertionResults || []).filter((a: any) => a.status === 'pass').length
        }
      })),
      nextCursor
    });
  });

  router.get('/runs/:id', async (req: Request, res: Response) => {
    const run = await RunModel.findOne({ runId: req.params.id }).lean();
    if (!run) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Run not found', requestId: crypto.randomUUID() } });
    }
    res.json({ ...run, id: run.runId });
  });

  router.get('/runs/:id/events', async (req: Request, res: Response) => {
    const afterSeq = parseInt(req.query.afterSeq as string || '0', 10);
    const limit = Math.min(parseInt(req.query.limit as string || '100', 10), 200);

    const events = await RunEventModel.find({
      runId: req.params.id,
      seq: { $gt: afterSeq }
    })
      .sort({ seq: 1 })
      .limit(limit)
      .lean();

    res.json(events.map((e) => ({
      id: e.eventId,
      runId: e.runId,
      seq: e.seq,
      type: e.type,
      phase: e.phase,
      serviceId: e.serviceId,
      observedAt: e.observedAt,
      elapsedMs: e.elapsedMs,
      operationId: e.operationId,
      data: e.data
    })));
  });

  // Server-Sent Events (SSE) Stream
  router.get('/runs/:id/stream', async (req: Request, res: Response) => {
    const runId = req.params.id;
    const run = await RunModel.findOne({ runId });
    if (!run) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Run not found', requestId: crypto.randomUUID() } });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    const lastEventId = req.headers['last-event-id'];
    const afterSeq = lastEventId ? parseInt(lastEventId as string, 10) : 0;

    // Send historical events after last delivered
    const pastEvents = await RunEventModel.find({ runId, seq: { $gt: afterSeq } }).sort({ seq: 1 });
    for (const evt of pastEvents) {
      res.write(`id: ${evt.seq}\nevent: run-event\ndata: ${JSON.stringify(evt)}\n\n`);
    }

    // Subscribe to live events
    const unsubscribe = engine.subscribe(runId, (evt) => {
      res.write(`id: ${evt.seq}\nevent: run-event\ndata: ${JSON.stringify(evt)}\n\n`);
    });

    // Heartbeat every 15s
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  // Report Export
  router.get('/runs/:id/report', async (req: Request, res: Response) => {
    const run = await RunModel.findOne({ runId: req.params.id }).lean();
    if (!run) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Run not found', requestId: crypto.randomUUID() } });
    }

    const env = await EnvironmentModel.findOne({ id: run.environmentId }).lean();
    const scenario = await ScenarioModel.findOne({ scenarioId: run.scenarioId }).lean();
    const events = await RunEventModel.find({ runId: run.runId }).sort({ seq: 1 }).lean();

    const report: Report = {
      schemaVersion: '1.0',
      reportId: `report-${run.runId}`,
      generatedAt: new Date().toISOString(),
      run: {
        id: run.runId,
        provenance: run.provenance as any,
        lifecycle: run.lifecycle as any,
        outcome: run.outcome as any,
        scenarioId: run.scenarioId,
        scenarioVersion: run.scenarioVersion,
        environmentId: run.environmentId,
        environmentRevision: run.environmentRevision,
        buildCommit: run.buildCommit,
        toolVersions: run.toolVersions || { node: process.version }
      },
      environmentSnapshot: {
        label: env?.label || 'Local Lab',
        services: env?.services || [],
        edges: env?.edges || []
      },
      scenarioSnapshot: {
        id: scenario?.scenarioId || run.scenarioId,
        version: scenario?.version || '1',
        label: scenario?.label || 'Scenario'
      },
      methodology: {
        description: 'Fresh TLS handshakes using strict SNI, hostname, and chain validation. Monotonic measurement.',
        sampleCount: events.filter((e) => e.type === 'tls_probe').length,
        windows: []
      },
      assertions: (run.assertionResults || []).map((a: any) => ({
        id: a.id,
        label: a.label,
        status: a.status,
        expected: a.expected,
        actual: a.actual,
        evidenceEventIds: a.evidenceEventIds || [],
        explanation: a.explanation
      })),
      measurements: events.filter((e) => e.type === 'tls_probe').map((e) => ({
        caller: e.data?.caller,
        callee: e.data?.callee,
        durationMs: e.data?.durationMs,
        fingerprint: e.data?.certificateFingerprint,
        success: e.data?.success
      })),
      recovery: run.recoveryResult || { status: 'not_run', evidenceEventIds: [] },
      evidenceEvents: events.map((e) => ({
        id: e.eventId,
        runId: e.runId,
        seq: e.seq,
        type: e.type as any,
        phase: e.phase,
        serviceId: e.serviceId,
        observedAt: e.observedAt,
        elapsedMs: e.elapsedMs,
        operationId: e.operationId,
        data: e.data
      })),
      limitations: [
        'Single local sample environment with lab-generated certificates.',
        'No testing of third-party legacy TLS clients or production load.',
        'Observations reflect explicit sampled windows only.'
      ]
    };

    const valid = ReportSchema.safeParse(report);
    if (!valid.success) {
      console.error('Report schema validation failed:', valid.error);
      return res.status(500).json({
        error: {
          code: 'INVALID_REPORT',
          message: 'Generated report failed contract schema validation',
          requestId: crypto.randomUUID(),
          details: valid.error.format()
        }
      });
    }

    res.json(report);
  });

  // Mutating Routes (LOCAL_OPERATOR only)
  router.post('/runs', requireOperator, async (req: Request, res: Response) => {
    const parseResult = StartRunRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: { code: 'INVALID_REQUEST', message: 'Invalid run request parameters', requestId: crypto.randomUUID(), details: parseResult.error.format() }
      });
    }

    const { environmentId, scenarioId, scenarioVersion } = parseResult.data;
    const idempotencyKey = req.headers['idempotency-key'] as string;
    if (!idempotencyKey) {
      return res.status(400).json({
        error: { code: 'INVALID_REQUEST', message: 'Idempotency-Key header is required', requestId: crypto.randomUUID() }
      });
    }

    const requestHash = crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex');
    const existingIdemp = await IdempotencyModel.findOne({ key: idempotencyKey });
    if (existingIdemp) {
      if (existingIdemp.requestHash === requestHash) {
        const existingRun = await RunModel.findOne({ runId: existingIdemp.runId });
        if (existingRun) {
          return res.status(202).json({
            runId: existingRun.runId,
            lifecycle: existingRun.lifecycle,
            eventsUrl: `/api/v1/runs/${existingRun.runId}/events`
          });
        }
      } else {
        return res.status(409).json({
          error: { code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency key used with conflicting payload', requestId: crypto.randomUUID() }
        });
      }
    }

    const env = await EnvironmentModel.findOne({ id: environmentId });
    if (!env) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Environment not found', requestId: crypto.randomUUID() }
      });
    }

    if (env.state === 'needs_reset') {
      return res.status(409).json({
        error: { code: 'ENVIRONMENT_NOT_READY', message: 'Environment requires baseline reset before another run', requestId: crypto.randomUUID() }
      });
    }

    const runId = `run-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const ownerId = `worker-${process.pid}-${runId}`;
    const fence = await engine.acquireLease(environmentId, ownerId);
    if (!fence || !controller.validateFence(fence)) {
      return res.status(409).json({
        error: { code: 'ENVIRONMENT_BUSY', message: 'Another rehearsal is currently running in this environment', requestId: crypto.randomUUID() }
      });
    }

    const now = new Date().toISOString();

    const runDoc = await RunModel.create({
      runId,
      environmentId,
      environmentRevision: env.revision,
      scenarioId,
      scenarioVersion,
      provenance: 'live_lab',
      lifecycle: 'queued',
      active: true,
      createdAt: now,
      fencingToken: fence,
      idempotencyKey,
      toolVersions: { node: process.version }
    });

    await IdempotencyModel.create({
      key: idempotencyKey,
      actorId: 'operator',
      requestHash,
      runId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    // Run execution asynchronously
    engine.executeRun(runDoc, fence).catch((err) => {
      console.error(`Run execution error for ${runId}:`, err);
    });

    res.status(202).json({
      runId,
      lifecycle: 'queued',
      eventsUrl: `/api/v1/runs/${runId}/events`
    });
  });

  router.post('/runs/:id/cancel', requireOperator, async (req: Request, res: Response) => {
    const cancelled = await engine.requestCancel(req.params.id);
    if (!cancelled) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Active run not found or already completed', requestId: crypto.randomUUID() } });
    }
    res.json({ status: 'cancel_requested', runId: req.params.id });
  });

  router.post('/environments/:id/reset', requireOperator, async (req: Request, res: Response) => {
    const env = await EnvironmentModel.findOne({ id: req.params.id });
    if (!env) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Environment not found', requestId: crypto.randomUUID() } });
    }

    if (env.state === 'reserved') {
      return res.status(409).json({ error: { code: 'ENVIRONMENT_BUSY', message: 'Cannot reset while rehearsal is active', requestId: crypto.randomUUID() } });
    }

    await controller.resetToBaseline();
    const probeRes = await controller.executeApplicationRequest();
    if (!probeRes.success) {
      await EnvironmentModel.updateOne(
        { id: req.params.id },
        { $set: { state: 'needs_reset', activeRunId: null } }
      );
      return res.status(500).json({
        error: {
          code: 'RESET_VERIFICATION_FAILED',
          message: `Baseline reset verification failed: ${probeRes.error || 'Probes unsuccessful'}`,
          requestId: crypto.randomUUID()
        }
      });
    }

    await EnvironmentModel.updateOne(
      { id: req.params.id },
      { $set: { state: 'ready', activeRunId: null, lastVerifiedAt: new Date().toISOString() } }
    );

    res.json({ status: 'reset_verified', environmentId: req.params.id, verifiedAt: new Date().toISOString() });
  });

  return router;
}
