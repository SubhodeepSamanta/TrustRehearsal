import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { DeploymentModeSchema, DeploymentMode } from './contracts/index.js';
import { connectDb, seedEnvironmentAndScenarios } from './db/connection.js';
import { RunModel, LeaseModel, EnvironmentModel } from './db/models.js';
import { LabController } from './lab/controller.js';
import { RunExecutionEngine } from './worker/engine.js';
import { createApiRouter } from './api/routes.js';

// Load root .env file explicitly
const rootEnvPath = path.resolve(process.cwd(), '../.env');
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else {
  const localRootEnv = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(localRootEnv)) {
    dotenv.config({ path: localRootEnv });
  }
}
dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '4000', 10);
const host = process.env.HOST || '127.0.0.1';

// Strict validation of deployment mode (no silent fallback on invalid input)
const rawMode = process.env.MODE || 'LOCAL_OPERATOR';
const modeParse = DeploymentModeSchema.safeParse(rawMode);
if (!modeParse.success) {
  console.error(`[Fatal Configuration Error] Invalid deployment MODE="${rawMode}". Expected 'LOCAL_OPERATOR' or 'PUBLIC_VIEWER'.`);
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
}
const mode: DeploymentMode = modeParse.success ? modeParse.data : 'LOCAL_OPERATOR';

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '32kb' }));

let controller: LabController;
let engine: RunExecutionEngine;

export async function bootstrapApp(): Promise<express.Application> {
  if (mode === 'PUBLIC_VIEWER') {
    const { createSnapshotRouter } = await import('./api/snapshotAdapter.js');
    app.use('/api/v1', createSnapshotRouter());
    return app;
  }

  await connectDb();
  await seedEnvironmentAndScenarios();

  controller = new LabController();
  await controller.initialize();

  engine = new RunExecutionEngine(controller);

  // Startup reconciliation: clean up any abandoned active runs from crashes or hard interrupts
  try {
    const abandoned = await RunModel.find({ active: true });
    for (const run of abandoned) {
      await RunModel.updateOne(
        { _id: run._id },
        {
          $set: {
            lifecycle: 'interrupted',
            outcome: 'inconclusive',
            active: false,
            finishedAt: new Date().toISOString()
          }
        }
      );
    }

    // Release only expired dangling leases
    await LeaseModel.updateMany(
      { expiresAt: { $lt: new Date() } },
      { $set: { ownerId: 'unclaimed', expiresAt: new Date(0) } }
    );

    // Reconcile and verify baseline environment
    try {
      await controller.resetToBaseline();
      const baseReq = await controller.executeApplicationRequest();
      if (baseReq.success) {
        await EnvironmentModel.updateOne(
          { id: 'sample-lab' },
          { $set: { state: 'ready', activeRunId: null, lastVerifiedAt: new Date().toISOString() } }
        );
      } else {
        await EnvironmentModel.updateOne(
          { id: 'sample-lab' },
          { $set: { state: 'needs_reset', activeRunId: null } }
        );
      }
    } catch (err) {
      console.warn('[Startup Reconciliation] Baseline reconciliation failed:', err);
      await EnvironmentModel.updateOne(
        { id: 'sample-lab' },
        { $set: { state: 'needs_reset', activeRunId: null } }
      ).catch(() => {});
    }
  } catch (err) {
    console.warn('[Startup Reconciliation] Error during startup reconciliation:', err);
  }

  const apiRouter = createApiRouter(mode, engine, controller);
  app.use('/api/v1', apiRouter);

  return app;
}

export { app, port, host, mode };

if (process.env.NODE_ENV !== 'test') {
  bootstrapApp()
    .then(() => {
      app.listen(port, host, () => {
        console.log(`[TrustRehearsal API] Running in ${mode} mode at http://${host}:${port}`);
      });
    })
    .catch((err) => {
      console.error('[TrustRehearsal API] Failed to start:', err);
      process.exit(1);
    });
}
