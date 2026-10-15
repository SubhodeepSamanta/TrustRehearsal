import fs from 'fs';
import path from 'path';
import { connectDb } from '../db/connection.js';
import { RunModel, RunEventModel } from '../db/models.js';

export async function exportSanitizedSnapshots(): Promise<void> {
  await connectDb();

  const runs = await RunModel.find({ lifecycle: 'completed' }).sort({ createdAt: -1 }).limit(10).lean();

  const exportedRuns = [];

  for (const run of runs) {
    const events = await RunEventModel.find({ runId: run.runId }).sort({ seq: 1 }).lean();

    const sanitizedEvents = events.map((e) => ({
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
    }));

    const sanitizedRun = {
      ...run,
      id: run.runId,
      provenance: 'recorded_example',
      events: sanitizedEvents
    };

    delete (sanitizedRun as any)._id;
    delete (sanitizedRun as any).__v;
    delete (sanitizedRun as any).actorId;

    exportedRuns.push(sanitizedRun);
  }

  const outputDirBackend = path.resolve(__dirname);
  const outputDirFrontend = path.resolve(__dirname, '../../../frontend/public/data');

  if (!fs.existsSync(outputDirFrontend)) {
    fs.mkdirSync(outputDirFrontend, { recursive: true });
  }

  const jsonContent = JSON.stringify(exportedRuns, null, 2);

  fs.writeFileSync(path.join(outputDirBackend, 'recorded-snapshots.json'), jsonContent);
  fs.writeFileSync(path.join(outputDirFrontend, 'snapshots.json'), jsonContent);

  console.log(`[Export] Exported ${exportedRuns.length} sanitized recorded runs.`);
}

if (process.argv[1] && process.argv[1].includes('exportRuns')) {
  exportSanitizedSnapshots().then(() => process.exit(0));
}
