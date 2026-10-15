import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { DeploymentModeSchema } from './contracts/index.js';
import { connectDb, seedEnvironmentAndScenarios } from './db/connection.js';
import { LabController } from './lab/controller.js';
import { RunExecutionEngine } from './worker/engine.js';
import { createApiRouter } from './api/routes.js';

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '4000', 10);
const host = process.env.HOST || '127.0.0.1';
const mode = DeploymentModeSchema.catch('LOCAL_OPERATOR').parse(process.env.MODE);

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '32kb' }));

let controller: LabController;
let engine: RunExecutionEngine;

export async function bootstrapApp(): Promise<express.Application> {
  await connectDb();
  await seedEnvironmentAndScenarios();

  controller = new LabController();
  await controller.initialize();

  engine = new RunExecutionEngine(controller);

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
