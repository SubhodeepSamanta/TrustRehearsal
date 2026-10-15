import path from 'path';
import fs from 'fs';
import { connectDb } from '../backend/src/db/connection.js';
import { RunModel, RunEventModel, LeaseModel, EnvironmentModel } from '../backend/src/db/models.js';
import { LabController } from '../backend/src/lab/controller.js';
import { RunExecutionEngine } from '../backend/src/worker/engine.js';
import { exportSanitizedSnapshots } from '../backend/src/export/exportRuns.js';

async function main() {
  console.log('[CanonicalRuns] Connecting to database...');
  await connectDb();

  // Reset database state for clean canonical generation
  console.log('[CanonicalRuns] Clearing existing runs and active leases...');
  await RunModel.deleteMany({});
  await RunEventModel.deleteMany({});
  await LeaseModel.deleteMany({});
  await EnvironmentModel.updateOne(
    { id: 'sample-lab' },
    { $set: { state: 'ready', activeRunId: null, lastVerifiedAt: new Date().toISOString() } }
  );

  console.log('[CanonicalRuns] Initializing lab controller and execution engine...');
  const controller = new LabController();
  await controller.initialize();
  const engine = new RunExecutionEngine(controller);

  const scenarios: Array<{ id: 'S01' | 'S02' | 'S03'; count: number }> = [
    { id: 'S01', count: 3 },
    { id: 'S02', count: 3 },
    { id: 'S03', count: 3 }
  ];

  try {
    for (const { id, count } of scenarios) {
      for (let i = 1; i <= count; i++) {
        console.log(`\n[CanonicalRuns] Executing real lab run for ${id} (${i}/${count})...`);

        const fence = await engine.acquireLease('sample-lab', `canonical-worker-${process.pid}`);
        if (!fence) {
          throw new Error(`Failed to acquire lease for scenario ${id} iteration ${i}`);
        }

        const runId = `run-${id.toLowerCase()}-${i}-${Date.now().toString(36)}`;
        const runDoc = await RunModel.create({
          runId,
          environmentId: 'sample-lab',
          environmentRevision: 'v1.0.0',
          scenarioId: id,
          scenarioVersion: '1',
          provenance: 'recorded_example',
          lifecycle: 'queued',
          active: true,
          createdAt: new Date().toISOString(),
          fencingToken: fence,
          toolVersions: { node: process.version, platform: process.platform }
        });

        await engine.executeRun(runDoc, fence);
        await engine.releaseLease('sample-lab', `canonical-worker-${process.pid}`, fence);

        const finished = await RunModel.findOne({ runId });
        console.log(
          `[CanonicalRuns] Run ${runId} completed: lifecycle=${finished?.lifecycle}, outcome=${finished?.outcome}, assertions=${finished?.assertionResults?.length}`
        );

        if (finished?.outcome !== 'pass') {
          console.warn(`[CanonicalRuns] Warning: ${runId} finished with outcome=${finished?.outcome}`);
        }
      }
    }

    console.log('\n[CanonicalRuns] All 9 canonical runs executed. Exporting sanitized snapshots...');
    await exportSanitizedSnapshots();

    // Also copy to backend/dist/export/recorded-snapshots.json if dist exists
    const backendDistExport = path.resolve(__dirname, '../backend/dist/export');
    if (fs.existsSync(backendDistExport)) {
      fs.copyFileSync(
        path.resolve(__dirname, '../backend/src/export/recorded-snapshots.json'),
        path.join(backendDistExport, 'recorded-snapshots.json')
      );
      console.log('[CanonicalRuns] Synchronized snapshots to backend/dist/export/recorded-snapshots.json');
    }

    console.log('[CanonicalRuns] Canonical runs generation completed successfully.');
  } finally {
    await controller.stop();
    const mongoose = (await import('mongoose')).default;
    await mongoose.disconnect();
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('[CanonicalRuns] Fatal error:', err);
  process.exit(1);
});
