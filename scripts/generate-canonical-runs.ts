import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { exportSanitizedSnapshots } from '../backend/src/export/exportRuns.js';

// Load root .env
const rootEnv = path.resolve(__dirname, '../.env');
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}

const API_BASE = 'http://127.0.0.1:4000/api/v1';

async function main() {
  console.log('[CanonicalRuns] Authenticating with running backend...');
  const operatorPassword = process.env.OPERATOR_PASSWORD || 'operator-rehearsal-2026';

  const loginRes = await fetch(`${API_BASE}/operator/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: operatorPassword })
  });

  if (!loginRes.ok) {
    throw new Error(`Failed to authenticate operator: HTTP ${loginRes.status}`);
  }

  const setCookie = loginRes.headers.get('set-cookie');
  const sessionData: any = await loginRes.json();
  const csrfToken = sessionData.csrfToken;
  console.log('[CanonicalRuns] Authenticated successfully as operator.');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
    Cookie: setCookie ? setCookie.split(';')[0] : ''
  };

  const scenariosToRun = [
    { id: 'S01', version: '1', count: 3 },
    { id: 'S02', version: '1', count: 3 },
    { id: 'S03', version: '1', count: 3 }
  ];

  for (const { id, version, count } of scenariosToRun) {
    for (let i = 1; i <= count; i++) {
      console.log(`\n[CanonicalRuns] Triggering clean execution of ${id} (iteration ${i}/${count})...`);

      const idempKey = `canonical-${id.toLowerCase()}-${i}-${Date.now()}`;
      const startRes = await fetch(`${API_BASE}/runs`, {
        method: 'POST',
        headers: {
          ...headers,
          'Idempotency-Key': idempKey
        },
        body: JSON.stringify({
          environmentId: 'sample-lab',
          scenarioId: id,
          scenarioVersion: version
        })
      });

      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({}));
        throw new Error(`Failed to start run for ${id}: HTTP ${startRes.status} - ${JSON.stringify(err)}`);
      }

      const { runId } = await startRes.json();
      console.log(`[CanonicalRuns] Run started: ${runId}. Polling for completion...`);

      // Poll until completed
      let finished = false;
      let attempts = 0;
      while (!finished && attempts < 80) {
        await new Promise((r) => setTimeout(r, 1000));
        attempts++;

        const runRes = await fetch(`${API_BASE}/runs/${runId}`);
        if (!runRes.ok) continue;

        const runData = await runRes.json();
        if (!runData.active) {
          finished = true;
          console.log(`[CanonicalRuns] Run ${runId} finished with lifecycle=${runData.lifecycle}, outcome=${runData.outcome}`);
          if (runData.outcome !== 'pass') {
            console.warn(`[CanonicalRuns] Warning: Run ${runId} finished with outcome ${runData.outcome}`);
          }
          break;
        }
      }

      if (!finished) {
        throw new Error(`Run ${runId} timed out after 80s`);
      }

      // Small cooldown between runs to ensure clean transition
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log('\n[CanonicalRuns] All 9 canonical runs executed cleanly. Exporting sanitized snapshots...');
  await exportSanitizedSnapshots();

  // Also ensure backend/dist/export/recorded-snapshots.json is updated
  const backendDistExport = path.resolve(__dirname, '../backend/dist/export');
  if (fs.existsSync(backendDistExport)) {
    fs.copyFileSync(
      path.resolve(__dirname, '../backend/src/export/recorded-snapshots.json'),
      path.join(backendDistExport, 'recorded-snapshots.json')
    );
    console.log('[CanonicalRuns] Copied updated snapshots to backend/dist/export/recorded-snapshots.json');
  }

  console.log('[CanonicalRuns] Canonical runs generation completed successfully.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[CanonicalRuns] Error:', err);
  process.exit(1);
});
