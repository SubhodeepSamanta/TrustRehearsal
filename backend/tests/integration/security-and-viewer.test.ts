import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { connectDb } from '../../src/db/connection.js';
import request from 'supertest';
import { createSnapshotRouter } from '../../src/api/snapshotAdapter.js';
import { createApiRouter } from '../../src/api/routes.js';
import { LabController } from '../../src/lab/controller.js';
import { RunExecutionEngine } from '../../src/worker/engine.js';
import fs from 'fs';
import path from 'path';

describe('Phase 5: Security Hardening & Viewer Mode', () => {
  let viewerApp: express.Application;
  let operatorApp: express.Application;
  let controller: LabController;
  let engine: RunExecutionEngine;
  const testCertDir = path.resolve(__dirname, '../../.tmp/certs-sec-test');

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await connectDb('mongodb://127.0.0.1:27017/trustrehearsal_test');
    // 1. Viewer app
    viewerApp = express();
    viewerApp.use(express.json());
    viewerApp.use(cookieParser());
    viewerApp.use('/api/v1', createSnapshotRouter());

    // 2. Operator app
    if (fs.existsSync(testCertDir)) {
      fs.rmSync(testCertDir, { recursive: true, force: true });
    }
    controller = new LabController({ baseDir: testCertDir, ephemeralPorts: true });
    await controller.initialize();
    engine = new RunExecutionEngine(controller);

    process.env.OPERATOR_PASSWORD = 'test-operator-secret';
    operatorApp = express();
    operatorApp.use(express.json());
    operatorApp.use(cookieParser());
    operatorApp.use('/api/v1', createApiRouter('LOCAL_OPERATOR', engine, controller));
  });

  afterAll(async () => {
    await controller.stop();
    if (fs.existsSync(testCertDir)) {
      fs.rmSync(testCertDir, { recursive: true, force: true });
    }
    await mongoose.disconnect();
  });

  it('strictly denies anonymous POST to /api/v1/runs in operator mode', async () => {
    const res = await request(operatorApp)
      .post('/api/v1/runs')
      .send({ environmentId: 'sample-lab', scenarioId: 'S01' });

    expect(res.status).toBe(401);
    expect(res.body.error?.code).toBe('NOT_AUTHENTICATED');
  });

  it('strictly denies mutation with invalid CSRF token on an authenticated session', async () => {
    // 1. Authenticate to establish valid session
    const loginRes = await request(operatorApp)
      .post('/api/v1/operator/session')
      .send({ password: 'test-operator-secret' });

    expect(loginRes.status).toBe(200);
    const sessionCookie = loginRes.headers['set-cookie'];
    expect(sessionCookie).toBeDefined();

    // 2. Perform mutation with valid session but invalid CSRF token
    const res = await request(operatorApp)
      .post('/api/v1/runs')
      .set('Cookie', sessionCookie)
      .set('X-CSRF-Token', 'tampered-invalid-csrf-token')
      .send({ environmentId: 'sample-lab', scenarioId: 'S01' });

    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('FORBIDDEN');
    expect(res.body.error?.message).toContain('CSRF');
  });

  it('strictly denies all mutation routes in PUBLIC_VIEWER mode with LIVE_DISABLED', async () => {
    const runRes = await request(viewerApp)
      .post('/api/v1/runs')
      .send({ environmentId: 'sample-lab', scenarioId: 'S01' });

    expect(runRes.status).toBe(403);
    expect(runRes.body.error?.code).toBe('LIVE_DISABLED');

    const resetRes = await request(viewerApp)
      .post('/api/v1/environments/sample-lab/reset')
      .send();

    expect(resetRes.status).toBe(403);
    expect(resetRes.body.error?.code).toBe('LIVE_DISABLED');

    const loginRes = await request(viewerApp)
      .post('/api/v1/operator/session')
      .send({ password: 'foo' });

    expect(loginRes.status).toBe(403);
    expect(loginRes.body.error?.code).toBe('LIVE_DISABLED');
  });

  it('serves sanitized recorded runs with provenance label in PUBLIC_VIEWER mode', async () => {
    const res = await request(viewerApp).get('/api/v1/runs');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.runs)).toBe(true);
    expect(res.body.runs.length).toBeGreaterThan(0);

    for (const r of res.body.runs) {
      expect(r.provenance).toBe('recorded_example');
      expect(r.active).toBe(false);
    }
  });

  it('verifies exported reports and snapshots contain zero private keys or secrets', () => {
    const snapshotPath = path.resolve(__dirname, '../../src/export/recorded-snapshots.json');
    if (fs.existsSync(snapshotPath)) {
      const content = fs.readFileSync(snapshotPath, 'utf-8');
      expect(content).not.toContain('PRIVATE KEY');
      expect(content).not.toContain('operator-rehearsal');
      expect(content).not.toContain('dev-session-secret');
      expect(content).not.toContain('dev-lab-secret');
    }
  });
});
