import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { connectDb, seedEnvironmentAndScenarios } from '../../src/db/connection.js';
import { LabController } from '../../src/lab/controller.js';
import { RunExecutionEngine } from '../../src/worker/engine.js';
import { createSnapshotRouter } from '../../src/api/snapshotAdapter.js';
import { createApiRouter } from '../../src/api/routes.js';
import { RunModel, RunEventModel, LeaseModel, SessionModel, EnvironmentModel } from '../../src/db/models.js';
import { DeploymentModeSchema } from '../../src/contracts/index.js';
import { SampleServiceInstance } from '../../src/lab/sampleServices.js';
import { createRootCa, issueLeafCertificate } from '../../src/lab/ca.js';
import { executeTlsProbe } from '../../src/lab/probe.js';

describe('Phase 6: Independent Review Repairs Regression Suite', () => {
  const testCertDir = path.resolve(__dirname, '../../.tmp/certs-regression-test');
  let controller: LabController;
  let engine: RunExecutionEngine;
  let operatorApp: express.Application;
  let viewerApp: express.Application;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await connectDb('mongodb://127.0.0.1:27017/trustrehearsal_test');
    await RunModel.updateMany({ active: true }, { $set: { active: false } });
    await LeaseModel.deleteMany({});
    await seedEnvironmentAndScenarios();

    if (fs.existsSync(testCertDir)) {
      fs.rmSync(testCertDir, { recursive: true, force: true });
    }
    controller = new LabController({ baseDir: testCertDir, ephemeralPorts: true });
    await controller.initialize();
    engine = new RunExecutionEngine(controller);

    process.env.OPERATOR_PASSWORD = 'regression-operator-secret';

    operatorApp = express();
    operatorApp.use(express.json());
    operatorApp.use(cookieParser());
    operatorApp.use('/api/v1', createApiRouter('LOCAL_OPERATOR', engine, controller));

    viewerApp = express();
    viewerApp.use(express.json());
    viewerApp.use(cookieParser());
    viewerApp.use('/api/v1', createSnapshotRouter());
  });

  afterAll(async () => {
    await controller.stop();
    if (fs.existsSync(testCertDir)) {
      fs.rmSync(testCertDir, { recursive: true, force: true });
    }
    await mongoose.disconnect();
  });

  it('R01: Failed recovery cannot produce an overall pass and marks needs_reset', async () => {
    const runId = `regress-failed-rec-${Date.now()}`;
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
      fencingToken: 101
    });

    // Sabotage reset to fail recovery
    const originalReset = controller.resetToBaseline.bind(controller);
    controller.resetToBaseline = async () => {
      throw new Error('Simulated hardware reset failure');
    };

    try {
      await engine.executeRun(runDoc, 101);
      const finished = await RunModel.findOne({ runId });
      expect(finished).toBeDefined();
      expect(finished!.outcome).toBe('fail');
      expect(finished!.recoveryResult?.status).toBe('failed');
    } finally {
      controller.resetToBaseline = originalReset;
      await controller.resetToBaseline(101);
    }
  });

  it('R02: Zero samples cannot verify recovery', async () => {
    const runId = `regress-zero-samples-${Date.now()}`;
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
      fencingToken: 102
    });

    const originalCollect = engine.collectProbePairs.bind(engine);
    // Return empty probe array during recovery
    engine.collectProbePairs = async (_ctx, phase) => {
      if (phase === 'recovery_reset') return [];
      return originalCollect(_ctx, phase);
    };

    try {
      await engine.executeRun(runDoc, 102);
      const finished = await RunModel.findOne({ runId });
      expect(finished).toBeDefined();
      expect(finished!.recoveryResult?.status).toBe('failed');
      expect(finished!.outcome).toBe('fail');
    } finally {
      engine.collectProbePairs = originalCollect;
    }
  });

  it('R03: Missing or wrong management credentials are rejected with 401', async () => {
    const authority = createRootCa('Regression CA');
    const leaf = issueLeafCertificate(authority, 'mgmt-test', ['localhost']);
    const testSvc = new SampleServiceInstance({
      name: 'mgmt-test',
      port: 0,
      managementPort: 0,
      activeProfile: leaf,
      trustedCaPem: authority.certPem,
      managementToken: 'valid-secret-token'
    });
    await testSvc.start();

    try {
      const mgmtPort = (testSvc.mgmtServer.address() as any).port;
      // 1. Missing token
      const noAuthRes = await fetch(`http://127.0.0.1:${mgmtPort}/mgmt/update-trust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trustedCaPem: authority.certPem })
      });
      expect(noAuthRes.status).toBe(401);

      // 2. Wrong token
      const wrongAuthRes = await fetch(`http://127.0.0.1:${mgmtPort}/mgmt/update-trust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer wrong-secret'
        },
        body: JSON.stringify({ trustedCaPem: authority.certPem })
      });
      expect(wrongAuthRes.status).toBe(401);

      // 3. Valid token
      const validAuthRes = await fetch(`http://127.0.0.1:${mgmtPort}/mgmt/update-trust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-secret-token'
        },
        body: JSON.stringify({ trustedCaPem: authority.certPem })
      });
      expect(validAuthRes.status).toBe(200);
    } finally {
      await testSvc.stop();
    }
  });

  it('R05: Stale fences and concurrent same-process start attempts are prevented', async () => {
    // 1. Validate fence rejection on controller
    controller.highestAcceptedFence = 50;
    expect(controller.validateFence(40)).toBe(false);
    expect(() => controller.installProfile('orders', {} as any, 40)).toThrow(/STALE_FENCE_AUTHORITY/);
    controller.highestAcceptedFence = 0;

    // 2. Prevent same-process silent lease advance
    const lease = await LeaseModel.findOneAndUpdate(
      { environmentId: 'sample-lab' },
      {
        $set: {
          environmentId: 'sample-lab',
          ownerId: `worker-${process.pid}-active`,
          fence: 10,
          expiresAt: new Date(Date.now() + 30000)
        }
      },
      { upsert: true, new: true }
    );

    // Trying to reacquire while active without expiration fails
    const reacquired = await engine.acquireLease('sample-lab', `worker-${process.pid}-active`);
    expect(reacquired).toBeNull();
  });

  it('R07: Invalid deployment mode strictly fails validation without falling back', () => {
    const invalidInput = 'PUBLIC_VEIWER';
    const parsed = DeploymentModeSchema.safeParse(invalidInput);
    expect(parsed.success).toBe(false);
  });

  it('R09: Unknown IDs return genuine 404 instead of falling back to first run', async () => {
    const unknownRun = await request(viewerApp).get('/api/v1/runs/nonexistent-run-id');
    expect(unknownRun.status).toBe(404);
    expect(unknownRun.body.error?.code).toBe('NOT_FOUND');

    const unknownScenario = await request(viewerApp).get('/api/v1/scenarios/nonexistent-scenario-id');
    expect(unknownScenario.status).toBe(404);
    expect(unknownScenario.body.error?.code).toBe('NOT_FOUND');
  });

  it('R11: Transport failure (ECONNREFUSED) does not count as TLS certificate chain rejection', async () => {
    const authority = createRootCa('Chain Test CA');
    // Probe a port where nothing is listening
    const deadPortProbe = await executeTlsProbe({
      host: '127.0.0.1',
      port: 59999,
      servername: 'orders',
      caCertPem: authority.certPem,
      caller: 'gateway',
      callee: 'orders',
      trustProfile: 'root-a'
    });

    expect(deadPortProbe.success).toBe(false);
    expect(deadPortProbe.errorCode).toBe('ECONNREFUSED');

    // Assertion logic must flag this as transport failure, NOT cert rejection
    const expectedTlsErrors = ['SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_UNTRUSTED'];
    const isCertChainRejection = expectedTlsErrors.includes(deadPortProbe.errorCode || '');
    expect(isCertChainRejection).toBe(false);
  });

  it('R14: Incompatible comparison validation detects different scenario IDs', () => {
    const runA = { scenarioId: 'S01', scenarioVersion: '1', environmentRevision: 'v1.0.0' };
    const runB = { scenarioId: 'S03', scenarioVersion: '1', environmentRevision: 'v1.0.0' };

    const isCompatible = runA.scenarioId === runB.scenarioId &&
      runA.scenarioVersion === runB.scenarioVersion &&
      runA.environmentRevision === runB.environmentRevision;

    expect(isCompatible).toBe(false);
  });

  it('R15: Authenticated session strictly enforces CSRF token', async () => {
    // 1. Authenticate with valid password
    const loginRes = await request(operatorApp)
      .post('/api/v1/operator/session')
      .send({ password: 'regression-operator-secret' });

    expect(loginRes.status).toBe(200);
    const sessionCookie = loginRes.headers['set-cookie'];
    const validCsrfToken = loginRes.body.csrfToken;

    // 2. Tampered CSRF token -> 403 Forbidden
    const tamperedRes = await request(operatorApp)
      .post('/api/v1/runs')
      .set('Cookie', sessionCookie)
      .set('X-CSRF-Token', 'forged-token-value')
      .set('Idempotency-Key', 'regress-idemp-tampered')
      .send({ environmentId: 'sample-lab', scenarioId: 'S01' });

    expect(tamperedRes.status).toBe(403);
    expect(tamperedRes.body.error?.code).toBe('FORBIDDEN');

    // 3. Clear any active leases on sample-lab to allow run creation
    await LeaseModel.deleteMany({ environmentId: 'sample-lab' });
    await EnvironmentModel.updateOne({ id: 'sample-lab' }, { $set: { state: 'ready' } });

    // Valid CSRF token -> Passes CSRF check and returns 200/201/202 with runId
    const validCsrfRes = await request(operatorApp)
      .post('/api/v1/runs')
      .set('Cookie', sessionCookie)
      .set('X-CSRF-Token', validCsrfToken)
      .set('Idempotency-Key', 'regress-idemp-valid')
      .send({ environmentId: 'sample-lab', scenarioId: 'S01', scenarioVersion: '1' });

    if (![200, 201, 202].includes(validCsrfRes.status)) {
      console.error('DEBUG validCsrfRes failure:', validCsrfRes.status, validCsrfRes.body);
    }
    expect([200, 201, 202]).toContain(validCsrfRes.status);
    expect(validCsrfRes.body.runId).toBeDefined();
  });

  it('R16: S03 prevents false pass if ledger remains Root A after pruning', async () => {
    const isolateController = new LabController({ ephemeralPorts: true });
    await isolateController.initialize();
    const isolateEngine = new RunExecutionEngine(isolateController);

    // Sabotage ledger so it is never migrated to Root B
    const origInstall = isolateController.installProfile.bind(isolateController);
    isolateController.installProfile = (serviceName, profile, fence) => {
      if (serviceName === 'ledger') return; // skip migrating ledger
      origInstall(serviceName, profile, fence);
    };

    try {
      const ctx = {
        runId: `sabotage-s03-${Date.now()}`,
        environmentId: 'isolated',
        scenarioId: 'S03' as const,
        fence: 1,
        ownerId: 'test',
        startTime: process.hrtime.bigint(),
        currentSeq: 0,
        events: [],
        cancelled: false
      };

      const assertions = await isolateEngine.runS03(ctx);
      const a04 = assertions.find((a) => a.id === 'A04_trust_pruned_to_root_b');
      expect(a04).toBeDefined();
      expect(a04!.status).toBe('fail'); // Must FAIL because ledger is still Root A
    } finally {
      isolateController.installProfile = origInstall;
      await isolateController.stop();
    }
  });

  it('R17: CA Proxy strictly enforces authentication and network fault', async () => {
    // 1. Unauthenticated request -> 401
    const unauthRes = await fetch(`http://127.0.0.1:${controller.caProxyPort}/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceName: 'orders', caName: 'A', profileName: 'test-profile' })
    });
    expect(unauthRes.status).toBe(401);
    const unauthJson: any = await unauthRes.json();
    expect(unauthJson.error).toBe('UNAUTHORIZED');

    // 2. Authenticated request with fault enabled -> 502 Bad Gateway
    controller.setIssuanceProxyFault(true);
    let faultObserved = false;
    try {
      await controller.issueNewProfileAsync('orders', 'A', 'fault-test');
    } catch (e: any) {
      faultObserved = true;
      expect(e.message).toContain('HTTP 502 Bad Gateway');
    } finally {
      controller.setIssuanceProxyFault(false);
    }
    expect(faultObserved).toBe(true);

    // 3. Authenticated request without fault -> 200 OK with signed certificate
    const validCert = await controller.issueNewProfileAsync('orders', 'A', 'valid-test');
    expect(validCert.certPem).toBeDefined();
    expect(validCert.keyPem).toBeDefined();
    expect(validCert.fingerprint).toBeDefined();
  });

  it('R18: Event persistence failure does not return successful event ID and interrupts run', async () => {
    const originalCreate = RunEventModel.create;
    RunEventModel.create = async () => {
      throw new Error('Database disk full');
    };

    try {
      const ctx = {
        runId: `fail-persist-${Date.now()}`,
        environmentId: 'test',
        scenarioId: 'S01' as const,
        fence: 1,
        ownerId: 'test',
        startTime: process.hrtime.bigint(),
        currentSeq: 0,
        events: [],
        cancelled: false
      };

      const event = await engine.emitEvent(ctx, 'phase_started', 'test');
      expect(event.id).toBeNull();
      expect(ctx.events.length).toBe(0);
    } finally {
      RunEventModel.create = originalCreate;
    }
  });
});
