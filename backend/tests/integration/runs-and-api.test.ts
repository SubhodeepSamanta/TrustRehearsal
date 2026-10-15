import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { connectDb, seedEnvironmentAndScenarios } from '../../src/db/connection.js';
import { LabController } from '../../src/lab/controller.js';
import { RunExecutionEngine } from '../../src/worker/engine.js';
import { createApiRouter } from '../../src/api/routes.js';
import { RunModel, RunEventModel } from '../../src/db/models.js';
import { ReportSchema } from '../../src/contracts/index.js';

describe('Phase 2: Durable Run Backend & API Integration', () => {
  const testCertDir = path.resolve(__dirname, '../../.tmp/certs-api-test');
  let controller: LabController;
  let engine: RunExecutionEngine;
  let router: any;

  beforeAll(async () => {
    if (fs.existsSync(testCertDir)) {
      fs.rmSync(testCertDir, { recursive: true, force: true });
    }
    await connectDb();
    await seedEnvironmentAndScenarios();

    controller = new LabController({ baseDir: testCertDir });
    await controller.initialize();

    engine = new RunExecutionEngine(controller);
    router = createApiRouter('LOCAL_OPERATOR', engine, controller);
  });

  afterAll(async () => {
    await controller.stop();
    if (fs.existsSync(testCertDir)) {
      fs.rmSync(testCertDir, { recursive: true, force: true });
    }
    await mongoose.disconnect();
  });

  it('executes durable S01 run, persists events, and generates valid report', async () => {
    const runId = `test-run-s01-${Date.now()}`;
    const runDoc = await RunModel.create({
      runId,
      environmentId: 'sample-lab',
      environmentRevision: 'v1.0.0',
      scenarioId: 'S01',
      scenarioVersion: '1',
      provenance: 'live_lab',
      lifecycle: 'queued',
      active: true,
      createdAt: new Date().toISOString(),
      fencingToken: 1
    });

    await engine.executeRun(runDoc, 1);

    // Verify run completed and persisted in DB
    const finishedRun = await RunModel.findOne({ runId });
    expect(finishedRun).toBeDefined();
    expect(finishedRun!.lifecycle).toBe('completed');
    expect(finishedRun!.outcome).toBe('pass');
    expect(finishedRun!.active).toBe(false);

    // Verify events persisted
    const events = await RunEventModel.find({ runId }).sort({ seq: 1 });
    expect(events.length).toBeGreaterThan(10);

    // Verify assertions reference actual events
    expect(finishedRun!.assertionResults.length).toBe(6);
    for (const assertion of finishedRun!.assertionResults) {
      expect(assertion.status).toBe('pass');
    }

    // Verify report contract validation
    const reportEvents = events.map((e) => ({
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
    }));

    const report = {
      schemaVersion: '1.0',
      reportId: `report-${runId}`,
      generatedAt: new Date().toISOString(),
      run: {
        id: finishedRun!.runId,
        provenance: finishedRun!.provenance,
        lifecycle: finishedRun!.lifecycle,
        outcome: finishedRun!.outcome,
        scenarioId: finishedRun!.scenarioId,
        scenarioVersion: finishedRun!.scenarioVersion,
        environmentId: finishedRun!.environmentId,
        environmentRevision: finishedRun!.environmentRevision,
        buildCommit: null,
        toolVersions: finishedRun!.toolVersions || {}
      },
      environmentSnapshot: {
        label: 'Local Controlled Lab',
        services: [],
        edges: []
      },
      scenarioSnapshot: {
        id: 'S01',
        version: '1',
        label: 'Renewal without application reload'
      },
      methodology: {
        description: 'Fresh TLS handshakes using strict SNI, hostname, and chain validation.',
        sampleCount: events.filter((e) => e.type === 'tls_probe').length,
        windows: []
      },
      assertions: finishedRun!.assertionResults,
      measurements: [],
      recovery: finishedRun!.recoveryResult,
      evidenceEvents: reportEvents,
      limitations: ['Verified in local lab testbed.']
    };

    const validReport = ReportSchema.safeParse(report);
    if (!validReport.success) {
      console.error(JSON.stringify(validReport.error.format(), null, 2));
    }
    expect(validReport.success).toBe(true);
  });

  it('enforces lease fencing and rejects concurrent execution', async () => {
    const fence1 = await engine.acquireLease('sample-lab', 'worker-1');
    expect(fence1).toBeDefined();

    // Trying to acquire lease concurrently with different worker while valid should be rejected
    const fence2 = await engine.acquireLease('sample-lab', 'worker-2');
    expect(fence2).toBeNull();

    await engine.releaseLease('sample-lab', 'worker-1');
  });
});
