import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import { LabController } from '../src/lab/controller.js';
import { executeTlsProbe } from '../src/lab/probe.js';

describe('Phase 1: Real TLS Proof', () => {
  const testCertDir = path.resolve(__dirname, '../.tmp/certs-test');
  let controller: LabController;

  beforeAll(async () => {
    if (fs.existsSync(testCertDir)) {
      fs.rmSync(testCertDir, { recursive: true, force: true });
    }
    controller = new LabController({ baseDir: testCertDir, ephemeralPorts: true });
    await controller.initialize();
  });

  afterAll(async () => {
    await controller.stop();
    if (fs.existsSync(testCertDir)) {
      fs.rmSync(testCertDir, { recursive: true, force: true });
    }
  });

  it('proves S01 issuance, installed-vs-served mismatch, context reload, and baseline reset', async () => {
    const ordersA0 = controller.certStore.loadProfile('orders', 'A0');
    expect(ordersA0).toBeDefined();
    const a0Fingerprint = ordersA0!.fingerprint;
    const ordersPort = controller.getServicePort('orders');

    // 1. Initial probe of orders: must observe A0
    const probe1 = await executeTlsProbe({
      host: '127.0.0.1',
      port: ordersPort,
      servername: 'orders',
      caCertPem: controller.certStore.rootA.certPem,
      caller: 'gateway',
      callee: 'orders',
      trustProfile: 'root-a'
    });

    expect(probe1.success).toBe(true);
    expect(probe1.authorized).toBe(true);
    expect(probe1.certificateFingerprint).toBe(a0Fingerprint);

    // 2. Issue A1 profile for orders (new key, new serial, distinct fingerprint)
    const ordersA1 = controller.issueNewProfile('orders', 'A', 'A1');
    expect(ordersA1.fingerprint).not.toBe(a0Fingerprint);

    // 3. Atomically install A1 profile without reloading orders' context
    controller.installProfile('orders', ordersA1);

    // 4. Probe orders again: server is still serving A0
    const probe2 = await executeTlsProbe({
      host: '127.0.0.1',
      port: ordersPort,
      servername: 'orders',
      caCertPem: controller.certStore.rootA.certPem,
      caller: 'gateway',
      callee: 'orders',
      trustProfile: 'root-a'
    });

    expect(probe2.success).toBe(true);
    expect(probe2.certificateFingerprint).toBe(a0Fingerprint);
    // Mismatch detected: installed is A1, served is A0
    expect(controller.services.get('orders')!.installedProfile.fingerprint).toBe(ordersA1.fingerprint);
    expect(probe2.certificateFingerprint).not.toBe(controller.services.get('orders')!.installedProfile.fingerprint);

    // 5. Reload server context
    controller.reloadServiceContext('orders');

    // 6. Probe orders: now serving A1
    const probe3 = await executeTlsProbe({
      host: '127.0.0.1',
      port: ordersPort,
      servername: 'orders',
      caCertPem: controller.certStore.rootA.certPem,
      caller: 'gateway',
      callee: 'orders',
      trustProfile: 'root-a'
    });

    expect(probe3.success).toBe(true);
    expect(probe3.certificateFingerprint).toBe(ordersA1.fingerprint);

    // 7. Reset to baseline A0 and verify
    await controller.resetToBaseline();

    const probe4 = await executeTlsProbe({
      host: '127.0.0.1',
      port: ordersPort,
      servername: 'orders',
      caCertPem: controller.certStore.rootA.certPem,
      caller: 'gateway',
      callee: 'orders',
      trustProfile: 'root-a'
    });

    expect(probe4.success).toBe(true);
    expect(probe4.certificateFingerprint).toBe(a0Fingerprint);
  });

  it('rejects connection when untrusted CA is provided (strict negative control)', async () => {
    const ordersPort = controller.getServicePort('orders');
    // Orders serves A-issued certificate. Probe with Root B only.
    const probeUntrusted = await executeTlsProbe({
      host: '127.0.0.1',
      port: ordersPort,
      servername: 'orders',
      caCertPem: controller.certStore.rootB.certPem, // Wrong root!
      caller: 'gateway',
      callee: 'orders',
      trustProfile: 'root-b'
    });

    expect(probeUntrusted.success).toBe(false);
    expect(probeUntrusted.authorized).toBe(false);
    expect([
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
      'SELF_SIGNED_CERT_IN_CHAIN',
      'ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE'
    ]).toContain(probeUntrusted.errorCode);
  });
});
