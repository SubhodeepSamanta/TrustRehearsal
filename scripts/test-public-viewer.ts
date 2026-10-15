import path from 'path';
import fs from 'fs';
import Module from 'module';
import ts from 'typescript';

const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'frontend/src/api/client.ts');
const source = fs.readFileSync(filename, 'utf8').replace(/\(import\.meta as any\)/g, '({env:{VITE_APP_MODE:"PUBLIC_VIEWER"}})');

const mod = new Module(filename, module as any);
(mod as any).filename = filename;
(mod as any).paths = (Module as any)._nodeModulePaths(path.dirname(filename));
(mod as any)._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);

async function testPublicAdapter() {
  const originalFetch = global.fetch;
  global.fetch = (url: any, opts?: any) => originalFetch('http://127.0.0.1:4173' + url, opts);

  try {
    const meta: any = await (mod.exports as any).apiFetch('/meta');
    console.log('1. /meta:', meta.mode, 'capabilities:', meta.capabilities);
    if (meta.mode !== 'PUBLIC_VIEWER') throw new Error(`Expected PUBLIC_VIEWER, got ${meta.mode}`);

    const envs: any = await (mod.exports as any).apiFetch('/environments');
    console.log('2. /environments:', envs.length, 'environment(s), topology:', envs[0].services.map((s: any) => s.id).join(' -> '));

    const runsData: any = await (mod.exports as any).apiFetch('/runs');
    console.log('3. /runs total:', runsData.runs.length);
    if (runsData.runs.length < 9) throw new Error(`Expected at least 9 canonical runs, got ${runsData.runs.length}`);

    const s03Run = runsData.runs.find((r: any) => r.scenarioId === 'S03');
    console.log('4. Canonical S03 run:', s03Run.id, 'outcome:', s03Run.outcome);

    const detail: any = await (mod.exports as any).apiFetch(`/runs/${s03Run.id}`);
    console.log('5. Detail id:', detail.id, 'provenance:', detail.provenance, 'assertions count:', detail.assertionResults.length);
    if (detail.provenance !== 'recorded_example') throw new Error(`Expected provenance recorded_example, got ${detail.provenance}`);

    const events: any = await (mod.exports as any).apiFetch(`/runs/${s03Run.id}/events?limit=200`);
    console.log('6. Events with ?limit=200 count:', events.length);
    if (events.length === 0) throw new Error('Expected non-empty events array');

    const report: any = await (mod.exports as any).apiFetch(`/runs/${s03Run.id}/report`);
    console.log('7. Report sampleCount:', report.methodology.sampleCount, 'measurements:', report.measurements.length, 'recovery:', report.recovery.status);
    if (report.methodology.sampleCount === 0 || report.measurements.length === 0) {
      throw new Error('Expected positive measurement counts in canonical report');
    }

    // Negative test: unknown run ID must throw 404
    let notFoundCaught = false;
    try {
      await (mod.exports as any).apiFetch('/runs/nonexistent-run-id-123');
    } catch (e: any) {
      notFoundCaught = true;
      console.log('8. Unknown ID threw expected 404:', e.message);
    }
    if (!notFoundCaught) throw new Error('Unknown ID did not throw 404');

    // Negative test: empty snapshot report verification
    const emptySnapshot = { id: 'test-empty', scenarioId: 'S01', environmentId: 'sample-lab', lifecycle: 'completed', outcome: 'inconclusive', createdAt: '2026-10-16T00:00:00Z', events: [] };
    const emptySource = fs.readFileSync(filename, 'utf8').replace(/\(import\.meta as any\)/g, '({env:{VITE_APP_MODE:"PUBLIC_VIEWER"}})');
    const emptyMod = new Module(filename, module as any);
    (emptyMod as any).filename = filename;
    (emptyMod as any).paths = (Module as any)._nodeModulePaths(path.dirname(filename));
    (emptyMod as any)._compile(ts.transpileModule(emptySource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);

    global.fetch = async (url: any) => String(url).includes('/data/snapshots.json')
      ? new Response(JSON.stringify([emptySnapshot]), { status: 200, headers: { 'Content-Type': 'application/json' } })
      : new Response(JSON.stringify({ error: { message: 'Not found' } }), { status: 404 });

    const emptyReport: any = await (emptyMod.exports as any).apiFetch('/runs/test-empty/report');
    console.log('9. Empty snapshot report check: samples =', emptyReport.methodology.sampleCount, 'recovery =', emptyReport.recovery.status, 'windows =', emptyReport.methodology.windows.length);
    if (emptyReport.methodology.sampleCount !== 0) throw new Error('Empty snapshot sampleCount must be 0');
    if (emptyReport.recovery.status !== 'not_run') throw new Error('Empty snapshot recovery must be not_run');
    if (emptyReport.methodology.windows.length !== 0) throw new Error('Empty snapshot windows must be empty');

    console.log('\n[SUCCESS] ALL PUBLIC VIEWER ADAPTER CHECKS VERIFIED CLEANLY.');
  } finally {
    global.fetch = originalFetch;
  }
}

testPublicAdapter().catch((err) => {
  console.error('[FAILED] Public viewer check failed:', err);
  process.exit(1);
});
