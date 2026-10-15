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

    const probeEvents = sanitizedEvents.filter((e) => e.type === 'tls_probe');
    const report = {
      schemaVersion: '1.0',
      reportId: `report-${run.runId}`,
      generatedAt: run.finishedAt || run.createdAt || new Date().toISOString(),
      run: {
        id: run.runId,
        provenance: 'recorded_example',
        lifecycle: run.lifecycle,
        outcome: run.outcome,
        scenarioId: run.scenarioId,
        scenarioVersion: run.scenarioVersion || '1',
        environmentId: run.environmentId,
        environmentRevision: run.environmentRevision || 'v1.0.0',
        buildCommit: run.buildCommit || null,
        toolVersions: run.toolVersions || { node: process.version }
      },
      environmentSnapshot: {
        label: 'Recorded Lab Topology (gateway -> orders -> ledger)',
        services: [
          { id: 'gateway', role: 'caller', port: 8443, configuredIssuer: 'issuer-a', installedProfile: 'A0', status: 'healthy' },
          { id: 'orders', role: 'service', port: 8444, configuredIssuer: 'issuer-a', installedProfile: 'A0', status: 'healthy' },
          { id: 'ledger', role: 'service', port: 8445, configuredIssuer: 'issuer-a', installedProfile: 'A0', status: 'healthy' }
        ],
        edges: [
          { id: 'edge-gateway-orders', caller: 'gateway', callee: 'orders', port: 8444 },
          { id: 'edge-orders-ledger', caller: 'orders', callee: 'ledger', port: 8445 }
        ]
      },
      scenarioSnapshot: {
        id: run.scenarioId,
        version: run.scenarioVersion || '1',
        label: run.scenarioId === 'S01' ? 'Renewal without application reload' : run.scenarioId === 'S02' ? 'Issuance-path unavailability' : 'Trust-root rollover'
      },
      methodology: {
        description: 'Fresh TLS handshakes using strict SNI, hostname, and chain validation. Monotonic measurement.',
        sampleCount: probeEvents.length,
        windows: []
      },
      assertions: run.assertionResults || [],
      measurements: probeEvents.map((e) => ({
        caller: e.data?.caller,
        callee: e.data?.callee,
        durationMs: e.data?.durationMs,
        fingerprint: e.data?.certificateFingerprint,
        success: e.data?.success
      })),
      recovery: run.recoveryResult || { status: 'not_run', evidenceEventIds: [] },
      evidenceEvents: sanitizedEvents,
      limitations: [
        'Single local sample environment with lab-generated certificates.',
        'No testing of third-party legacy TLS clients or production load.',
        'Observations reflect explicit sampled windows only.'
      ]
    };

    const sanitizedRun = {
      ...run,
      id: run.runId,
      provenance: 'recorded_example',
      events: sanitizedEvents,
      report
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
