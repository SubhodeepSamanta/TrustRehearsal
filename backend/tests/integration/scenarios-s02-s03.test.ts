import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { connectDb, seedEnvironmentAndScenarios } from '../../src/db/connection.js';
import { LabController } from '../../src/lab/controller.js';
import { RunExecutionEngine } from '../../src/worker/engine.js';
import { RunModel, RunEventModel, LeaseModel } from '../../src/db/models.js';

describe('Phase 4: S02, S03 Scenarios and Repetitions', () => {
  const testCertDir = path.resolve(__dirname, '../../.tmp/certs-scenarios-test');
  let controller: LabController;
  let engine: RunExecutionEngine;

  beforeAll(async () => {
    if (fs.existsSync(testCertDir)) {
      fs.rmSync(testCertDir, { recursive: true, force: true });
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await connectDb('mongodb://127.0.0.1:27017/trustrehearsal_test');
    await RunModel.updateMany({ active: true }, { $set: { active: false } });
    await LeaseModel.deleteMany({});
    await seedEnvironmentAndScenarios();

    controller = new LabController({ baseDir: testCertDir, ephemeralPorts: true });
    await controller.initialize();
    engine = new RunExecutionEngine(controller);
  });

  afterAll(async () => {
    await controller.stop();
    if (fs.existsSync(testCertDir)) {
      fs.rmSync(testCertDir, { recursive: true, force: true });
    }
    await mongoose.disconnect();
  });

  it('executes Scenario S02 (Issuance-path unavailability) cleanly', async () => {
    const runId = `test-s02-${Date.now()}`;
    const runDoc = await RunModel.create({
      runId,
      environmentId: 'sample-lab',
      environmentRevision: 'v1.0.0',
      scenarioId: 'S02',
      scenarioVersion: '1',
      provenance: 'live_lab',
      lifecycle: 'queued',
      active: true,
      createdAt: new Date().toISOString(),
      fencingToken: 10
    });

    await engine.executeRun(runDoc, 10);

    const finished = await RunModel.findOne({ runId });
    expect(finished).toBeDefined();
    expect(finished!.lifecycle).toBe('completed');
    expect(finished!.outcome).toBe('pass');
    expect(finished!.assertionResults.length).toBe(4);

    for (const a of finished!.assertionResults) {
      expect(a.status).toBe('pass');
    }

    const events = await RunEventModel.find({ runId });
    expect(events.some((e) => e.type === 'fault_enabled')).toBe(true);
    expect(events.some((e) => e.type === 'fault_disabled')).toBe(true);
  });

  it('executes Scenario S03 (Trust-root rollover with negative control) cleanly', async () => {
    const runId = `test-s03-${Date.now()}`;
    const runDoc = await RunModel.create({
      runId,
      environmentId: 'sample-lab',
      environmentRevision: 'v1.0.0',
      scenarioId: 'S03',
      scenarioVersion: '1',
      provenance: 'live_lab',
      lifecycle: 'queued',
      active: true,
      createdAt: new Date().toISOString(),
      fencingToken: 20
    });

    await engine.executeRun(runDoc, 20);

    const finished = await RunModel.findOne({ runId });
    expect(finished).toBeDefined();
    expect(finished!.lifecycle).toBe('completed');
    expect(finished!.outcome).toBe('pass');
    expect(finished!.assertionResults.length).toBe(5);

    // Verify negative control assertion passed
    const negControl = finished!.assertionResults.find((a: any) => a.id === 'A01_abrupt_switch_rejected');
    expect(negControl).toBeDefined();
    expect(negControl.status).toBe('pass');

    // Verify dual trust assertion passed
    const dualTrust = finished!.assertionResults.find((a: any) => a.id === 'A02_dual_trust_established' || a.id === 'A02_dual_trust_accepted_both');
    expect(dualTrust).toBeDefined();
    expect(dualTrust.status).toBe('pass');
  });

  it('reproduces clean consecutive runs and verifies baseline reset', async () => {
    for (let i = 1; i <= 2; i++) {
      const repId = `test-rep-s01-${i}-${Date.now()}`;
      const doc = await RunModel.create({
        runId: repId,
        environmentId: 'sample-lab',
        environmentRevision: 'v1.0.0',
        scenarioId: 'S01',
        scenarioVersion: '1',
        provenance: 'live_lab',
        lifecycle: 'queued',
        active: true,
        createdAt: new Date().toISOString(),
        fencingToken: 30 + i
      });
      await engine.executeRun(doc, 30 + i);

      const res = await RunModel.findOne({ runId: repId });
      expect(res!.lifecycle).toBe('completed');
      expect(res!.outcome).toBe('pass');
    }
  });
});
