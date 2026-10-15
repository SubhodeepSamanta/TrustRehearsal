import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { DeploymentModeSchema } from './contracts/index.js';

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

// Liveness
app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    mode,
    timestamp: new Date().toISOString()
  });
});

// Meta
app.get('/api/v1/meta', (_req: Request, res: Response) => {
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

export { app, port, host, mode };

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, host, () => {
    console.log(`[TrustRehearsal API] Running in ${mode} mode at http://${host}:${port}`);
  });
}
