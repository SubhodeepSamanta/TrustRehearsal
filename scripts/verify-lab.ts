import { LabController } from '../backend/src/lab/controller.js';
import { executeTlsProbe } from '../backend/src/lab/probe.js';

async function main() {
  console.log('[VerifyLab] Initializing lab controller and sample services...');
  const controller = new LabController();
  await controller.initialize();

  console.log('[VerifyLab] Services booted on loopback (gateway: 8443, orders: 8444, ledger: 8445)');

  // Probe orders
  const probeOrders = await executeTlsProbe({
    host: '127.0.0.1',
    port: 8444,
    servername: 'orders',
    caCertPem: controller.certStore.rootA.certPem,
    caller: 'gateway',
    callee: 'orders',
    trustProfile: 'root-a'
  });

  console.log('[VerifyLab] Orders Probe:', {
    success: probeOrders.success,
    authorized: probeOrders.authorized,
    fingerprint: probeOrders.certificateFingerprint?.slice(0, 16) + '...',
    durationMs: probeOrders.durationMs
  });

  // Probe ledger
  const probeLedger = await executeTlsProbe({
    host: '127.0.0.1',
    port: 8445,
    servername: 'ledger',
    caCertPem: controller.certStore.rootA.certPem,
    caller: 'orders',
    callee: 'ledger',
    trustProfile: 'root-a'
  });

  console.log('[VerifyLab] Ledger Probe:', {
    success: probeLedger.success,
    authorized: probeLedger.authorized,
    fingerprint: probeLedger.certificateFingerprint?.slice(0, 16) + '...',
    durationMs: probeLedger.durationMs
  });

  await controller.stop();
  console.log('[VerifyLab] Lab verification completed cleanly.');
}

main().catch((err) => {
  console.error('[VerifyLab] Failed:', err);
  process.exit(1);
});
