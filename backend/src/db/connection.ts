import mongoose from 'mongoose';
import { EnvironmentModel, ScenarioModel, LeaseModel } from './models.js';

export async function connectDb(uri?: string): Promise<typeof mongoose> {
  const mongoUri = uri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/trustrehearsal';
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }
  return mongoose.connect(mongoUri);
}

export async function seedEnvironmentAndScenarios(): Promise<void> {
  const existingEnv = await EnvironmentModel.findOne({ id: 'sample-lab' });
  if (!existingEnv) {
    await EnvironmentModel.create({
      id: 'sample-lab',
      revision: 'v1.0.0',
      label: 'Local Controlled Lab (gateway -> orders -> ledger)',
      state: 'ready',
      baselineProfile: 'A0',
      services: [
        {
          id: 'gateway',
          name: 'Gateway API',
          role: 'gateway',
          port: 8443,
          managementPort: 18443,
          configuredIssuer: 'issuer-a',
          installedProfile: 'A0',
          status: 'healthy'
        },
        {
          id: 'orders',
          name: 'Orders Service',
          role: 'orders',
          port: 8444,
          managementPort: 18444,
          configuredIssuer: 'issuer-a',
          installedProfile: 'A0',
          status: 'healthy'
        },
        {
          id: 'ledger',
          name: 'Ledger Service',
          role: 'ledger',
          port: 8445,
          managementPort: 18445,
          configuredIssuer: 'issuer-a',
          installedProfile: 'A0',
          status: 'healthy'
        }
      ],
      edges: [
        {
          id: 'edge-gateway-orders',
          caller: 'gateway',
          callee: 'orders',
          servername: 'orders',
          expectedTrustProfile: 'root-a'
        },
        {
          id: 'edge-orders-ledger',
          caller: 'orders',
          callee: 'ledger',
          servername: 'ledger',
          expectedTrustProfile: 'root-a'
        }
      ]
    });
  }

  const existingLease = await LeaseModel.findOne({ environmentId: 'sample-lab' });
  if (!existingLease) {
    await LeaseModel.create({
      environmentId: 'sample-lab',
      ownerId: 'unclaimed',
      fence: 0,
      expiresAt: new Date(0),
      heartbeatAt: new Date(0)
    });
  }

  const scenarios = [
    {
      scenarioId: 'S01',
      version: '1',
      label: 'Renewal without application reload',
      description: 'Detect mismatch between newly installed leaf certificate and running TLS context; verify hot reload recovery.',
      expectedFaults: ['serving_mismatch'],
      maxDurationMs: 60000,
      phaseDefinitions: [
        { id: 'baseline', name: 'Baseline Probing', description: 'Sample fresh TLS handshakes against running orders service', isMutation: false },
        { id: 'issue_install', name: 'Issue & Install A1', description: 'Write renewed certificate A1 to disk without reloading context', isMutation: true },
        { id: 'observe_mismatch', name: 'Detect Mismatch', description: 'Verify served certificate remains A0 while installed certificate is A1', isMutation: false },
        { id: 'reload_context', name: 'Hot Reload Context', description: 'Trigger in-memory TLS context update via management control plane', isMutation: true },
        { id: 'verify_a1', name: 'Verify Reloaded Context', description: 'Sample fresh handshakes confirming A1 is actively served', isMutation: false },
        { id: 'recovery_reset', name: 'Baseline Reset', description: 'Reinstall A0 baseline profile and verify healthy TLS baseline', isMutation: true }
      ],
      assertionDefinitions: [
        { id: 'A01_diff_fingerprint', label: 'A1 fingerprint differs from A0', description: 'Issued renewal profile has a distinct cryptographic identity', expectedOutcome: 'pass' },
        { id: 'A02_disk_installed', label: 'Disk profile updated to A1', description: 'Controller confirmed atomic profile installation', expectedOutcome: 'pass' },
        { id: 'A03_served_before_reload', label: 'Serving context remained A0 before reload', description: 'Active TLS connections continued to observe previous certificate', expectedOutcome: 'pass' },
        { id: 'A04_mismatch_detected', label: 'Mismatch successfully detected', description: 'System identified stale serving context without service downtime', expectedOutcome: 'pass' },
        { id: 'A05_served_after_reload', label: 'Serving context updated to A1 after reload', description: 'Hot reload immediately presented new certificate on fresh connections', expectedOutcome: 'pass' },
        { id: 'A06_baseline_restored', label: 'Clean baseline restored', description: 'Environment reset to initial baseline profile A0 with verified probes', expectedOutcome: 'pass' }
      ]
    },
    {
      scenarioId: 'S02',
      version: '1',
      label: 'Issuance-path unavailability',
      description: 'Demonstrate that failure to issue a certificate does not impact traffic on currently valid certificates.',
      expectedFaults: ['issuance_proxy_reject'],
      maxDurationMs: 60000,
      phaseDefinitions: [
        { id: 'baseline', name: 'Baseline Probing', description: 'Verify healthy service-to-service TLS handshakes', isMutation: false },
        { id: 'fault_proxy', name: 'Enable Issuance Partition', description: 'Simulate CA network partition via controlled issuance proxy', isMutation: true },
        { id: 'attempt_renewals', name: 'Bounded Renewal Attempts', description: 'Execute bounded renewal requests expecting rejection', isMutation: false },
        { id: 'probe_dataplane', name: 'Verify Data Plane Integrity', description: 'Confirm existing services continue authenticating on fresh handshakes', isMutation: false },
        { id: 'restore_proxy', name: 'Restore Issuance Path', description: 'Remove network partition, complete renewal, and reload service', isMutation: true },
        { id: 'recovery_reset', name: 'Baseline Reset', description: 'Reset proxy and restore baseline profiles', isMutation: true }
      ],
      assertionDefinitions: [
        { id: 'A01_issuance_rejected', label: 'Issuance failure observed', description: 'Proxy rejected renewal request with structured alert', expectedOutcome: 'pass' },
        { id: 'A02_dataplane_unaffected', label: 'Data plane remained authenticated', description: 'Existing leaf certificates continued validating during CA outage', expectedOutcome: 'pass' },
        { id: 'A03_restored_issuance', label: 'Post-recovery renewal succeeded', description: 'Restored path successfully issued and installed valid certificate', expectedOutcome: 'pass' },
        { id: 'A04_baseline_restored', label: 'Clean baseline restored', description: 'Verified proxy fault removed and baseline restored', expectedOutcome: 'pass' }
      ]
    },
    {
      scenarioId: 'S03',
      version: '1',
      label: 'Trust-root rollover',
      description: 'Compare abrupt root replacement failure with safe dual-trust rollover sequence.',
      expectedFaults: ['abrupt_root_switch_failure'],
      maxDurationMs: 90000,
      phaseDefinitions: [
        { id: 'baseline', name: 'Baseline Probing', description: 'Verify initial Root A chain validation', isMutation: false },
        { id: 'abrupt_switch', name: 'Abrupt Switch (Negative Control)', description: 'Switch orders to Root B while callers trust Root A only', isMutation: true },
        { id: 'verify_rejection', name: 'Verify Rejection', description: 'Verify callers reject unexpected Root B certificate with TLS error', isMutation: false },
        { id: 'restore_baseline', name: 'Restore Baseline', description: 'Restore Root A certificate before dual-trust staging', isMutation: true },
        { id: 'dual_trust_install', name: 'Expand Trust (Root A + B)', description: 'Install dual trust bundle on gateway and orders callers', isMutation: true },
        { id: 'sequential_leaf_switch', name: 'Sequential Leaf Switch to B', description: 'Switch ledger then orders to Root B certificates with verified probes', isMutation: true },
        { id: 'prune_old_trust', name: 'Prune Trust to Root B Only', description: 'Remove retired Root A from caller trust bundles', isMutation: true },
        { id: 'recovery_reset', name: 'Baseline Reset', description: 'Safely roll back to Root A baseline and verify clean topology', isMutation: true }
      ],
      assertionDefinitions: [
        { id: 'A01_abrupt_switch_rejected', label: 'Negative control: abrupt switch rejected', description: 'Callers rejected Root B certificate under A-only trust as expected', expectedOutcome: 'pass' },
        { id: 'A02_dual_trust_accepted_both', label: 'Dual trust accepted both roots', description: 'Callers validated both Root A and Root B leaves during transition', expectedOutcome: 'pass' },
        { id: 'A03_b_only_accepted_b', label: 'Final Root B accepted B-only leaves', description: 'Topology successfully completed rollover to Root B', expectedOutcome: 'pass' },
        { id: 'A04_baseline_restored', label: 'Clean baseline restored', description: 'Safe expansion and restoration back to baseline Root A', expectedOutcome: 'pass' }
      ]
    }
  ];

  for (const scenario of scenarios) {
    await ScenarioModel.findOneAndUpdate(
      { scenarioId: scenario.scenarioId },
      scenario,
      { upsert: true, new: true }
    );
  }
}
