import { LabController } from '../backend/src/lab/controller.js';
import { executeTlsProbe } from '../backend/src/lab/probe.js';
import { createRootCa, issueLeafCertificate } from '../backend/src/lab/ca.js';

async function verifyRunningLab(): Promise<boolean> {
  // Check if live lab is up on default ports
  try {
    const authority = createRootCa('Probe Root Check');
    // Fast probe to check if port 8444 is alive
    const ping = await executeTlsProbe({
      host: '127.0.0.1',
      port: 8444,
      servername: 'orders',
      caCertPem: authority.certPem,
      caller: 'verifier',
      callee: 'orders',
      trustProfile: 'check'
    });
    // If we received ECONNREFUSED, lab is not running
    if (ping.errorCode === 'ECONNREFUSED') {
      return false;
    }
  } catch {
    return false;
  }

  console.log('[VerifyLab] Live lab detected on default ports (8443-8445). Running read-only health checks...');

  // In live lab, Root A is used
  const controller = new LabController();
  controller.certStore.initializeRoots();
  const rootAPem = controller.certStore.rootA.certPem;

  const probeOrders = await executeTlsProbe({
    host: '127.0.0.1',
    port: 8444,
    servername: 'orders',
    caCertPem: rootAPem,
    caller: 'gateway',
    callee: 'orders',
    trustProfile: 'root-a'
  });

  const probeLedger = await executeTlsProbe({
    host: '127.0.0.1',
    port: 8445,
    servername: 'ledger',
    caCertPem: rootAPem,
    caller: 'orders',
    callee: 'ledger',
    trustProfile: 'root-a'
  });

  const probeGateway = await executeTlsProbe({
    host: '127.0.0.1',
    port: 8443,
    servername: 'gateway',
    caCertPem: rootAPem,
    caller: 'verifier',
    callee: 'gateway',
    trustProfile: 'root-a'
  });

  console.log('[VerifyLab] Gateway Probe:', {
    success: probeGateway.success,
    authorized: probeGateway.authorized,
    durationMs: probeGateway.durationMs
  });
  console.log('[VerifyLab] Orders Probe:', {
    success: probeOrders.success,
    authorized: probeOrders.authorized,
    durationMs: probeOrders.durationMs
  });
  console.log('[VerifyLab] Ledger Probe:', {
    success: probeLedger.success,
    authorized: probeLedger.authorized,
    durationMs: probeLedger.durationMs
  });

  const allPassed = probeGateway.success && probeOrders.success && probeLedger.success &&
                    probeGateway.authorized && probeOrders.authorized && probeLedger.authorized;

  if (!allPassed) {
    console.error('[VerifyLab] One or more live probes failed verification.');
    process.exit(1);
  }

  console.log('[VerifyLab] Live lab verified successfully.');
  return true;
}

async function verifyIsolatedSelfTest(): Promise<void> {
  console.log('[VerifyLab] Running explicitly isolated self-test on ephemeral ports...');
  const controller = new LabController({ ephemeralPorts: true });
  await controller.initialize();

  try {
    const ordersPort = controller.getServicePort('orders');
    const ledgerPort = controller.getServicePort('ledger');
    const gatewayPort = controller.getServicePort('gateway');

    const probeOrders = await executeTlsProbe({
      host: '127.0.0.1',
      port: ordersPort,
      servername: 'orders',
      caCertPem: controller.certStore.rootA.certPem,
      caller: 'gateway',
      callee: 'orders',
      trustProfile: 'root-a'
    });

    const probeLedger = await executeTlsProbe({
      host: '127.0.0.1',
      port: ledgerPort,
      servername: 'ledger',
      caCertPem: controller.certStore.rootA.certPem,
      caller: 'orders',
      callee: 'ledger',
      trustProfile: 'root-a'
    });

    const probeGateway = await executeTlsProbe({
      host: '127.0.0.1',
      port: gatewayPort,
      servername: 'gateway',
      caCertPem: controller.certStore.rootA.certPem,
      caller: 'verifier',
      callee: 'gateway',
      trustProfile: 'root-a'
    });

    console.log('[VerifyLab] Ephemeral Gateway Probe:', { success: probeGateway.success, authorized: probeGateway.authorized });
    console.log('[VerifyLab] Ephemeral Orders Probe:', { success: probeOrders.success, authorized: probeOrders.authorized });
    console.log('[VerifyLab] Ephemeral Ledger Probe:', { success: probeLedger.success, authorized: probeLedger.authorized });

    const allPassed = probeGateway.success && probeOrders.success && probeLedger.success &&
                      probeGateway.authorized && probeOrders.authorized && probeLedger.authorized;

    if (!allPassed) {
      console.error('[VerifyLab] Isolated self-test probes failed.');
      process.exit(1);
    }

    console.log('[VerifyLab] Isolated self-test passed cleanly.');
  } finally {
    await controller.stop();
  }
}

async function main() {
  const ranLive = await verifyRunningLab();
  if (!ranLive) {
    await verifyIsolatedSelfTest();
  }
}

main().catch((err) => {
  console.error('[VerifyLab] Failed:', err);
  process.exit(1);
});
