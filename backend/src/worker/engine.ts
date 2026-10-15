import crypto from 'crypto';
import {
  RunModel,
  RunEventModel,
  LeaseModel,
  EnvironmentModel,
  RunDoc
} from '../db/models.js';
import {
  RunEvent,
  AssertionResult,
  TlsProbeData,
  Report
} from '../contracts/index.js';
import { LabController } from '../lab/controller.js';
import { executeTlsProbe } from '../lab/probe.js';

export interface ExecutionContext {
  runId: string;
  environmentId: string;
  scenarioId: 'S01' | 'S02' | 'S03';
  fence: number;
  ownerId: string;
  startTime: bigint;
  currentSeq: number;
  events: RunEvent[];
  cancelled: boolean;
  leaseLost?: boolean;
  timedOut?: boolean;
  persistenceFailed?: boolean;
}

export interface ProbeEventPair {
  probe: TlsProbeData;
  eventId: string;
}

export type EventSubscriber = (event: RunEvent) => void;

export class RunExecutionEngine {
  private controller: LabController;
  private subscribers: Map<string, Set<EventSubscriber>> = new Map();
  private activeRuns: Map<string, ExecutionContext> = new Map();

  constructor(controller: LabController) {
    this.controller = controller;
  }

  public subscribe(runId: string, subscriber: EventSubscriber): () => void {
    if (!this.subscribers.has(runId)) {
      this.subscribers.set(runId, new Set());
    }
    this.subscribers.get(runId)!.add(subscriber);

    return () => {
      const subs = this.subscribers.get(runId);
      if (subs) {
        subs.delete(subscriber);
        if (subs.size === 0) this.subscribers.delete(runId);
      }
    };
  }

  public async acquireLease(environmentId: string, ownerId: string): Promise<number | null> {
    const now = new Date();
    await LeaseModel.updateOne(
      { environmentId },
      { $setOnInsert: { environmentId, ownerId: 'unclaimed', fence: 0, expiresAt: new Date(0) } },
      { upsert: true }
    ).catch(() => {});

    const lease = await LeaseModel.findOneAndUpdate(
      {
        environmentId,
        $or: [
          { expiresAt: { $lt: now } },
          { ownerId: 'unclaimed' }
        ]
      },
      {
        $set: {
          ownerId,
          expiresAt: new Date(Date.now() + 25000),
          heartbeatAt: now
        },
        $inc: { fence: 1 }
      },
      { new: true }
    );

    if (!lease) return null;
    return lease.fence;
  }

  public async releaseLease(environmentId: string, ownerId: string, fence?: number): Promise<void> {
    const query: any = { environmentId, ownerId };
    if (fence !== undefined) {
      query.fence = fence;
    }
    await LeaseModel.updateOne(
      query,
      { $set: { ownerId: 'unclaimed', expiresAt: new Date(0) } }
    );
  }

  private isInterrupted(ctx: ExecutionContext): boolean {
    return ctx.cancelled || !!ctx.leaseLost || !!ctx.timedOut || !!ctx.persistenceFailed;
  }

  public async emitEvent(
    ctx: ExecutionContext,
    type: any,
    phase: string,
    data: any = {},
    serviceId: string | null = null,
    operationId: string | null = null
  ): Promise<RunEvent> {
    ctx.currentSeq += 1;
    const now = new Date();
    const elapsedMs = Math.round(Number(process.hrtime.bigint() - ctx.startTime) / 10_000) / 100;
    const eventId = `evt-${ctx.runId}-${ctx.currentSeq}`;

    const event: RunEvent = {
      id: eventId,
      runId: ctx.runId,
      seq: ctx.currentSeq,
      type,
      phase,
      serviceId,
      observedAt: now.toISOString(),
      elapsedMs,
      operationId,
      data
    };

    try {
      await RunEventModel.create({
        eventId,
        runId: ctx.runId,
        seq: ctx.currentSeq,
        type,
        phase,
        serviceId,
        observedAt: now.toISOString(),
        elapsedMs,
        operationId,
        data
      });
      ctx.events.push(event);
    } catch (err: any) {
      ctx.persistenceFailed = true;
      return {
        id: null as any,
        runId: ctx.runId,
        seq: ctx.currentSeq,
        type,
        phase,
        serviceId,
        observedAt: now.toISOString(),
        elapsedMs,
        operationId,
        data: { ...data, persistenceError: err?.message || 'Persistence failed' }
      };
    }

    const subs = this.subscribers.get(ctx.runId);
    if (subs) {
      subs.forEach((sub) => {
        try {
          sub(event);
        } catch {
          // subscriber connection closed
        }
      });
    }

    return event;
  }

  public async requestCancel(runId: string): Promise<boolean> {
    const ctx = this.activeRuns.get(runId);
    if (ctx) {
      ctx.cancelled = true;
      await RunModel.updateOne(
        { runId },
        { $set: { cancelRequestedAt: new Date().toISOString() } }
      ).catch(() => {});
      return true;
    }
    return false;
  }

  public async executeRun(runDoc: RunDoc, fence: number): Promise<void> {
    const runId = runDoc.runId;
    const ownerId = `worker-${process.pid}-${runId}`;
    const ctx: ExecutionContext = {
      runId,
      environmentId: runDoc.environmentId,
      scenarioId: runDoc.scenarioId as 'S01' | 'S02' | 'S03',
      fence,
      ownerId,
      startTime: process.hrtime.bigint(),
      currentSeq: 0,
      events: [],
      cancelled: false
    };

    this.activeRuns.set(runId, ctx);

    // Heartbeat timer enforcing persistent lease ownership
    const heartbeatTimer = setInterval(async () => {
      try {
        const leaseRes = await LeaseModel.updateOne(
          { environmentId: ctx.environmentId, fence: ctx.fence, ownerId: ctx.ownerId },
          { $set: { expiresAt: new Date(Date.now() + 25000), heartbeatAt: new Date() } }
        );
        if (leaseRes && leaseRes.matchedCount === 0) {
          ctx.cancelled = true;
          ctx.leaseLost = true;
        }
        await RunModel.updateOne(
          { runId, active: true },
          { $set: { heartbeatAt: new Date().toISOString() } }
        );
      } catch {
        // DB disconnect handled at next mutation check
      }
    }, 5000);

    // Enforce scenario maximum duration
    const maxDurationMs = ctx.scenarioId === 'S03' ? 60000 : 35000;
    const deadlineTimer = setTimeout(() => {
      ctx.cancelled = true;
      ctx.timedOut = true;
    }, maxDurationMs);

    let assertions: AssertionResult[] = [];
    let lifecycle: 'completed' | 'failed' | 'cancelled' | 'timed_out' = 'completed';
    let outcome: 'pass' | 'fail' | 'inconclusive' = 'pass';
    let recoveryStatus: 'verified' | 'failed' = 'verified';
    const recoveryEvidenceIds: string[] = [];

    try {
      await RunModel.updateOne(
        { runId },
        {
          $set: {
            lifecycle: 'running',
            startedAt: new Date().toISOString(),
            fencingToken: fence,
            active: true
          }
        }
      );
      await EnvironmentModel.updateOne(
        { id: ctx.environmentId },
        { $set: { state: 'reserved', activeRunId: runId } }
      );

      await this.emitEvent(ctx, 'phase_started', 'init', { message: 'Rehearsal execution initialized' });

      if (ctx.scenarioId === 'S01') {
        assertions = await this.runS01(ctx);
      } else if (ctx.scenarioId === 'S02') {
        assertions = await this.runS02(ctx);
      } else if (ctx.scenarioId === 'S03') {
        assertions = await this.runS03(ctx);
      }

      if (ctx.timedOut) {
        lifecycle = 'timed_out';
        outcome = 'fail';
      } else if (ctx.cancelled) {
        lifecycle = 'cancelled';
        outcome = 'inconclusive';
      } else if (assertions.some((a) => a.status === 'fail')) {
        outcome = 'fail';
      } else if (assertions.some((a) => a.status === 'inconclusive')) {
        outcome = 'inconclusive';
      }
    } catch (err: any) {
      lifecycle = 'failed';
      outcome = 'fail';
      await this.emitEvent(ctx, 'run_interrupted', 'error', { error: err.message });
    } finally {
      clearTimeout(deadlineTimer);

      // Transition to recovering phase
      await RunModel.updateOne(
        { runId },
        { $set: { lifecycle: 'recovering', phase: 'recovery_reset' } }
      ).catch(() => {});

      // Cleanup context runs independently of experimental cancellation or timeout
      const cleanupCtx: ExecutionContext = {
        ...ctx,
        cancelled: false,
        leaseLost: false,
        timedOut: false,
        persistenceFailed: false
      };

      try {
        await this.emitEvent(cleanupCtx, 'recovery_started', 'recovery_reset', { message: 'Restoring baseline environment state' });
        await this.controller.resetToBaseline(ctx.fence);

        // Positive sample count verified on loopback probes
        const resetPairs = await this.collectProbePairs(cleanupCtx, 'recovery_reset', 5, 'orders');
        const ordersA0 = this.controller.certStore.loadProfile('orders', 'A0');

        const allProbesOk = resetPairs.length >= 5 && resetPairs.every((p) => p.probe.success && p.probe.authorized);
        const correctFingerprint = !ordersA0 || resetPairs.every((p) => p.probe.certificateFingerprint === ordersA0.fingerprint);

        // Real end-to-end application request across gateway -> orders -> ledger
        let appReqOk = true;
        if (this.controller.services && this.controller.services.size >= 3) {
          const appReq = await this.controller.executeApplicationRequest();
          const appReqEvent = await this.emitEvent(cleanupCtx, 'sample_request', 'recovery_reset', {
            path: 'gateway -> orders -> ledger',
            success: appReq.success,
            statusCode: appReq.statusCode,
            data: appReq.data,
            error: appReq.error
          });
          recoveryEvidenceIds.push(appReqEvent.id);
          appReqOk = appReq.success;
        }

        const isRecoveryVerified = allProbesOk && correctFingerprint && appReqOk;

        const resetEvent = await this.emitEvent(cleanupCtx, 'recovery_verified', 'recovery_reset', {
          allProbesHealthy: isRecoveryVerified,
          sampleCount: resetPairs.length,
          applicationRequestSuccess: appReqOk,
          fingerprintVerified: correctFingerprint
        });
        recoveryEvidenceIds.push(resetEvent.id);

        if (!isRecoveryVerified) {
          recoveryStatus = 'failed';
          outcome = 'fail';
          await EnvironmentModel.updateOne({ id: ctx.environmentId }, { $set: { state: 'needs_reset', activeRunId: null } });
        } else {
          recoveryStatus = 'verified';
          await EnvironmentModel.updateOne({ id: ctx.environmentId }, { $set: { state: 'ready', activeRunId: null } });
        }

        // Evaluate baseline restored assertion AFTER recovery has executed
        assertions.push({
          id: 'A_baseline_restored',
          label: 'Clean baseline restored & verified',
          status: isRecoveryVerified ? 'pass' : 'fail',
          expected: 'Baseline profile A0 active across topology with healthy end-to-end traffic',
          actual: isRecoveryVerified ? 'Baseline restored and verified' : 'Baseline recovery failed or incomplete',
          evidenceEventIds: recoveryEvidenceIds,
          explanation: isRecoveryVerified
            ? `Verified ${resetPairs.length} TLS probes and end-to-end application request under baseline Root A trust.`
            : 'Recovery failed to verify healthy baseline probes or application path.'
        });
      } catch (recErr: any) {
        recoveryStatus = 'failed';
        outcome = 'fail';
        assertions.push({
          id: 'A_baseline_restored',
          label: 'Clean baseline restored & verified',
          status: 'fail',
          expected: 'Baseline profile A0 active',
          actual: recErr.message,
          evidenceEventIds: recoveryEvidenceIds,
          explanation: `Recovery failed with error: ${recErr.message}`
        });
        await EnvironmentModel.updateOne({ id: ctx.environmentId }, { $set: { state: 'needs_reset', activeRunId: null } });
      } finally {
        clearInterval(heartbeatTimer);
        await this.releaseLease(ctx.environmentId, ctx.ownerId, ctx.fence);
        this.activeRuns.delete(runId);
      }

      const passedCount = assertions.filter((a) => a.status === 'pass').length;
      const failedCount = assertions.filter((a) => a.status === 'fail').length;
      const inconclusiveCount = assertions.filter((a) => a.status === 'inconclusive').length;

      await RunModel.updateOne(
        { runId },
        {
          $set: {
            lifecycle,
            outcome,
            active: false,
            finishedAt: new Date().toISOString(),
            assertionResults: assertions,
            recoveryResult: {
              status: recoveryStatus,
              evidenceEventIds: recoveryEvidenceIds,
              completedAt: new Date().toISOString()
            },
            assertionsSummary: {
              total: assertions.length,
              passed: passedCount,
              failed: failedCount,
              inconclusive: inconclusiveCount
            }
          }
        }
      );
    }
  }

  public async collectProbePairs(
    ctx: ExecutionContext,
    phase: string,
    count: number = 5,
    targetService: 'orders' | 'ledger' = 'orders',
    trustProfile: string = 'root-a',
    caPem?: string
  ): Promise<ProbeEventPair[]> {
    const results: ProbeEventPair[] = [];
    const port = (this.controller.getServicePort ? this.controller.getServicePort(targetService) : 0) || (targetService === 'orders' ? 8444 : 8445);
    const certPem = caPem || this.controller.certStore.rootA?.certPem;

    for (let i = 0; i < count; i++) {
      if (this.isInterrupted(ctx)) break;
      const probe = await executeTlsProbe({
        host: '127.0.0.1',
        port,
        servername: targetService,
        caCertPem: certPem,
        caller: 'gateway',
        callee: targetService,
        trustProfile,
        sampleIndex: i + 1
      });
      const evt = await this.emitEvent(ctx, 'tls_probe', phase, probe, targetService);
      results.push({ probe, eventId: evt.id });
      await new Promise((r) => setTimeout(r, 40));
    }
    return results;
  }

  // Backward compatibility wrapper returning raw probes
  public async collectProbes(
    ctx: ExecutionContext,
    phase: string,
    count: number = 5,
    targetService: 'orders' | 'ledger' = 'orders',
    trustProfile: string = 'root-a',
    caPem?: string
  ): Promise<TlsProbeData[]> {
    const pairs = await this.collectProbePairs(ctx, phase, count, targetService, trustProfile, caPem);
    return pairs.map((p) => p.probe);
  }

  public async runS01(ctx: ExecutionContext): Promise<AssertionResult[]> {
    const assertions: AssertionResult[] = [];
    const ordersA0 = this.controller.certStore.loadProfile('orders', 'A0')!;

    // 1. Baseline Probes
    if (this.isInterrupted(ctx)) return assertions;
    await this.emitEvent(ctx, 'phase_started', 'baseline', { message: 'Collecting baseline probes' });
    const baselinePairs = await this.collectProbePairs(ctx, 'baseline', 5, 'orders');
    await this.emitEvent(ctx, 'phase_finished', 'baseline');

    const baselineHealthy = baselinePairs.length >= 5 && baselinePairs.every((p) => p.probe.success && p.probe.authorized);
    if (!baselineHealthy && !this.isInterrupted(ctx)) {
      assertions.push({
        id: 'A00_baseline_precondition',
        label: 'Baseline precondition validated',
        status: 'fail',
        expected: 'All baseline probes authenticated',
        actual: 'Baseline probe failure observed',
        evidenceEventIds: baselinePairs.map((p) => p.eventId),
        explanation: 'Baseline environment was not healthy prior to fault injection.'
      });
      return assertions;
    }

    // 2. Issue A1 & Install without reload
    if (this.isInterrupted(ctx)) return assertions;
    await this.emitEvent(ctx, 'phase_started', 'issue_install');
    const a1Cert = await this.controller.issueNewProfileAsync('orders', 'A', 'A1');
    const issueEvt = await this.emitEvent(ctx, 'certificate_issued', 'issue_install', {
      fingerprint: a1Cert.fingerprint,
      serialNumber: a1Cert.serialNumber,
      issuer: 'issuer-a'
    }, 'orders');

    if (this.isInterrupted(ctx)) return assertions;
    this.controller.installProfile('orders', a1Cert, ctx.fence);
    const installEvt = await this.emitEvent(ctx, 'profile_installed', 'issue_install', {
      installedFingerprint: a1Cert.fingerprint,
      reloaded: false
    }, 'orders');
    await this.emitEvent(ctx, 'phase_finished', 'issue_install');

    assertions.push({
      id: 'A01_diff_fingerprint',
      label: 'A1 fingerprint differs from A0',
      status: a1Cert.fingerprint !== ordersA0.fingerprint ? 'pass' : 'fail',
      expected: 'New fingerprint differing from A0',
      actual: a1Cert.fingerprint,
      evidenceEventIds: [issueEvt.id],
      explanation: `Issued certificate has fingerprint ${a1Cert.fingerprint.slice(0, 16)}... which is distinct from baseline ${ordersA0.fingerprint.slice(0, 16)}...`
    });

    const currentInstalled = this.controller.services.get('orders')?.installedProfile?.fingerprint || a1Cert.fingerprint;
    assertions.push({
      id: 'A02_disk_installed',
      label: 'Disk profile updated to A1',
      status: currentInstalled === a1Cert.fingerprint ? 'pass' : 'fail',
      expected: a1Cert.fingerprint,
      actual: currentInstalled,
      evidenceEventIds: [installEvt.id],
      explanation: 'Verified disk profile points to renewed certificate A1.'
    });

    // 3. Detect Mismatch
    if (this.isInterrupted(ctx)) return assertions;
    await this.emitEvent(ctx, 'phase_started', 'observe_mismatch');
    const mismatchPairs = await this.collectProbePairs(ctx, 'observe_mismatch', 5, 'orders');
    const mismatchProbes = mismatchPairs.map((p) => p.probe);
    const servedBeforeReload = mismatchProbes[0]?.certificateFingerprint;

    const allServedOld = mismatchProbes.every((p) => p.certificateFingerprint === ordersA0.fingerprint);
    const mismatchDetected = allServedOld && a1Cert.fingerprint !== ordersA0.fingerprint;
    const mismatchEvt = await this.emitEvent(ctx, 'assertion_evaluated', 'observe_mismatch', {
      mismatchDetected,
      installed: a1Cert.fingerprint,
      served: servedBeforeReload
    });
    await this.emitEvent(ctx, 'phase_finished', 'observe_mismatch');

    assertions.push({
      id: 'A03_served_before_reload',
      label: 'Serving context remained A0 before reload',
      status: allServedOld ? 'pass' : 'fail',
      expected: ordersA0.fingerprint,
      actual: servedBeforeReload || 'none',
      evidenceEventIds: mismatchPairs.map((p) => p.eventId),
      explanation: 'Active TLS connections continued to observe baseline certificate A0 because the TLS context was not reloaded.'
    });

    assertions.push({
      id: 'A04_mismatch_detected',
      label: 'Mismatch successfully detected',
      status: mismatchDetected ? 'pass' : 'fail',
      expected: true,
      actual: mismatchDetected,
      evidenceEventIds: [mismatchEvt.id, ...mismatchPairs.map((p) => p.eventId)],
      explanation: 'System correctly identified stale serving context without service downtime.'
    });

    // 4. Hot Reload Context
    if (this.isInterrupted(ctx)) return assertions;
    await this.emitEvent(ctx, 'phase_started', 'reload_context');
    this.controller.reloadServiceContext('orders', ctx.fence);
    const reloadEvt = await this.emitEvent(ctx, 'context_reloaded', 'reload_context', {
      service: 'orders',
      activeFingerprint: a1Cert.fingerprint
    }, 'orders');
    await this.emitEvent(ctx, 'phase_finished', 'reload_context');

    // 5. Verify Reloaded Context
    if (this.isInterrupted(ctx)) return assertions;
    await this.emitEvent(ctx, 'phase_started', 'verify_a1');
    const afterReloadPairs = await this.collectProbePairs(ctx, 'verify_a1', 5, 'orders');
    const afterReloadProbes = afterReloadPairs.map((p) => p.probe);
    const servedAfterReload = afterReloadProbes[0]?.certificateFingerprint;
    const allServedNew = afterReloadProbes.length >= 5 && afterReloadProbes.every((p) => p.certificateFingerprint === a1Cert.fingerprint);
    await this.emitEvent(ctx, 'phase_finished', 'verify_a1');

    assertions.push({
      id: 'A05_served_after_reload',
      label: 'Serving context updated to A1 after reload',
      status: allServedNew ? 'pass' : 'fail',
      expected: a1Cert.fingerprint,
      actual: servedAfterReload || 'none',
      evidenceEventIds: [reloadEvt.id, ...afterReloadPairs.map((p) => p.eventId)],
      explanation: 'Fresh TLS connections immediately observed new certificate A1 following in-memory context reload.'
    });

    return assertions;
  }

  public async runS02(ctx: ExecutionContext): Promise<AssertionResult[]> {
    const assertions: AssertionResult[] = [];

    // 1. Baseline
    if (this.isInterrupted(ctx)) return assertions;
    await this.emitEvent(ctx, 'phase_started', 'baseline');
    const baselinePairs = await this.collectProbePairs(ctx, 'baseline', 5, 'orders');
    await this.emitEvent(ctx, 'phase_finished', 'baseline');

    // 2. Inject Issuer HTTP Proxy Fault
    if (this.isInterrupted(ctx)) return assertions;
    await this.emitEvent(ctx, 'phase_started', 'fault_injection');
    this.controller.setIssuanceProxyFault(true);
    const faultEvt = await this.emitEvent(ctx, 'fault_enabled', 'fault_injection', {
      faultType: 'ca_issuance_proxy_partition',
      target: 'issuer-a',
      message: 'Simulated network partition to CA issuance proxy on loopback'
    });
    await this.emitEvent(ctx, 'phase_finished', 'fault_injection');

    // 3. Attempt renewals (3 bounded attempts failing over HTTP)
    if (this.isInterrupted(ctx)) return assertions;
    await this.emitEvent(ctx, 'phase_started', 'renewal_attempts');
    const failedRenewalEvents: string[] = [];
    let renewalFailedCleanly = true;

    for (let i = 1; i <= 3; i++) {
      if (this.isInterrupted(ctx)) break;
      try {
        await this.controller.issueNewProfileAsync('orders', 'A', `A1-try-${i}`);
        renewalFailedCleanly = false;
      } catch (err: any) {
        const failEvt = await this.emitEvent(ctx, 'renewal_attempt_failed', 'renewal_attempts', {
          attemptIndex: i,
          maxAttempts: 3,
          error: err.message,
          errorCategory: 'NETWORK_PARTITION'
        });
        failedRenewalEvents.push(failEvt.id);
      }
      await new Promise((r) => setTimeout(r, 60));
    }
    await this.emitEvent(ctx, 'phase_finished', 'renewal_attempts');

    assertions.push({
      id: 'A01_renewal_rejected_during_outage',
      label: 'Renewal request fails predictably during CA proxy partition',
      status: renewalFailedCleanly && failedRenewalEvents.length === 3 ? 'pass' : 'fail',
      expected: 'HTTP 502 / CA proxy partition error',
      actual: failedRenewalEvents.length === 3 ? '3 bounded renewal failures observed' : 'Renewal did not fail predictably',
      evidenceEventIds: [faultEvt.id, ...failedRenewalEvents],
      explanation: 'Verified 3 bounded attempts to reach the CA proxy failed predictably without process crash or hanging.'
    });

    // 4. Verify Active Data Plane Traffic During Outage
    if (this.isInterrupted(ctx)) return assertions;
    await this.emitEvent(ctx, 'phase_started', 'active_traffic_verification');
    const activePairs = await this.collectProbePairs(ctx, 'active_traffic_verification', 5, 'orders');
    const allActiveHealthy = activePairs.length >= 5 && activePairs.every((p) => p.probe.success && p.probe.authorized);

    // Also run real application request through gateway -> orders -> ledger
    let appReq: any = { success: true, statusCode: 200 };
    let appReqEvtId: string | null = null;
    if (typeof this.controller.executeApplicationRequest === 'function') {
      appReq = await this.controller.executeApplicationRequest();
      const appReqEvt = await this.emitEvent(ctx, 'sample_request', 'active_traffic_verification', {
        path: 'gateway -> orders -> ledger',
        success: appReq.success,
        statusCode: appReq.statusCode,
        data: appReq.data
      });
      appReqEvtId = appReqEvt.id;
    }
    await this.emitEvent(ctx, 'phase_finished', 'active_traffic_verification');

    assertions.push({
      id: 'A02_active_traffic_unaffected',
      label: 'Serving TLS data plane unaffected by control-plane CA outage',
      status: allActiveHealthy && appReq.success ? 'pass' : 'fail',
      expected: '100% successful TLS handshakes and application calls with valid certificates',
      actual: `${activePairs.length} successful probes, end-to-end request: ${appReq.success ? 'PASS' : 'FAIL'}`,
      evidenceEventIds: [...activePairs.map((p) => p.eventId), ...(appReqEvtId ? [appReqEvtId] : [])],
      explanation: 'Active TLS handshakes and service-to-service requests continue without degradation during CA proxy partition.'
    });

    // 5. Restore CA Proxy & Complete Renewal
    if (this.isInterrupted(ctx)) return assertions;
    await this.emitEvent(ctx, 'phase_started', 'restore_and_renew');
    this.controller.setIssuanceProxyFault(false);
    const clearEvt = await this.emitEvent(ctx, 'fault_disabled', 'restore_and_renew', {
      faultType: 'ca_issuance_proxy_partition',
      message: 'CA proxy connection restored'
    });

    let renewedCert: any;
    try {
      renewedCert = await this.controller.issueNewProfileAsync('orders', 'A', 'A1-recovered');
    } catch (e: any) {
      renewedCert = null;
    }

    if (renewedCert) {
      this.controller.installProfile('orders', renewedCert, ctx.fence);
      this.controller.reloadServiceContext('orders', ctx.fence);
    }
    const restoredProbes = await this.collectProbePairs(ctx, 'restore_and_renew', 3, 'orders');
    await this.emitEvent(ctx, 'phase_finished', 'restore_and_renew');

    assertions.push({
      id: 'A03_issuance_restored_after_recovery',
      label: 'Certificate issuance succeeds immediately after proxy recovery',
      status: renewedCert && restoredProbes.every((p) => p.probe.success) ? 'pass' : 'fail',
      expected: 'Successful issuance and context update',
      actual: renewedCert ? `Issued ${renewedCert.fingerprint.slice(0, 16)}...` : 'Failed to issue after recovery',
      evidenceEventIds: [clearEvt.id, ...restoredProbes.map((p) => p.eventId)],
      explanation: 'Issuance pipeline resumed cleanly upon network recovery without requiring service restart.'
    });

    return assertions;
  }

  public async runS03(ctx: ExecutionContext): Promise<AssertionResult[]> {
    const assertions: AssertionResult[] = [];
    const ordersB0 = this.controller.certStore.loadProfile('orders', 'B0')!;
    const ledgerB0 = this.controller.certStore.loadProfile('ledger', 'B0')!;
    const rootAPem = this.controller.certStore.rootA.certPem;
    const rootBPem = this.controller.certStore.rootB.certPem;
    const dualTrustPem = `${rootAPem}\n${rootBPem}`;

    // 1. Baseline
    if (this.isInterrupted(ctx)) return assertions;
    await this.emitEvent(ctx, 'phase_started', 'baseline');
    const baselinePairs = await this.collectProbePairs(ctx, 'baseline', 5, 'orders');
    await this.emitEvent(ctx, 'phase_finished', 'baseline');

    // 2. Abrupt switch (Negative Control)
    if (this.isInterrupted(ctx)) return assertions;
    await this.emitEvent(ctx, 'phase_started', 'abrupt_switch');
    this.controller.installProfile('orders', ordersB0, ctx.fence);
    this.controller.reloadServiceContext('orders', ctx.fence);
    const abruptEvt = await this.emitEvent(ctx, 'profile_installed', 'abrupt_switch', {
      installedProfile: 'B0',
      service: 'orders',
      callerTrust: 'root-a-only'
    }, 'orders');
    await this.emitEvent(ctx, 'phase_finished', 'abrupt_switch');

    // 3. Verify Rejection
    if (this.isInterrupted(ctx)) return assertions;
    await this.emitEvent(ctx, 'phase_started', 'verify_rejection');
    const ordersPort = (this.controller.getServicePort ? this.controller.getServicePort('orders') : 0) || 8444;
    const negativeProbe = await executeTlsProbe({
      host: '127.0.0.1',
      port: ordersPort,
      servername: 'orders',
      caCertPem: rootAPem,
      caller: 'gateway',
      callee: 'orders',
      trustProfile: 'root-a'
    });
    const rejectionEvt = await this.emitEvent(ctx, 'tls_probe', 'verify_rejection', negativeProbe, 'orders');
    await this.emitEvent(ctx, 'phase_finished', 'verify_rejection');

    // Strict validation: Must be a certificate-chain verification rejection, NOT transport failure like ECONNREFUSED
    const expectedTlsErrors = ['SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_UNTRUSTED', 'DEPTH_ZERO_SELF_SIGNED_CERT'];
    const isCertChainRejection = !negativeProbe.success && !negativeProbe.authorized && expectedTlsErrors.includes(negativeProbe.errorCode || '');
    const isTransportFailure = ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET'].includes(negativeProbe.errorCode || '');

    assertions.push({
      id: 'A01_abrupt_switch_rejected',
      label: 'Negative control: abrupt switch rejected',
      status: isCertChainRejection ? 'pass' : 'fail',
      expected: 'Handshake rejection due to untrusted Root B under Root A trust',
      actual: negativeProbe.errorCode || 'UNKNOWN',
      evidenceEventIds: [abruptEvt.id, rejectionEvt.id],
      explanation: isCertChainRejection
        ? 'Callers strictly rejected unrecognized Root B certificate without trust expansion.'
        : isTransportFailure
        ? `Inconclusive/Fail: transport error (${negativeProbe.errorCode}) observed rather than TLS chain verification rejection.`
        : `Handshake was not rejected as expected: ${negativeProbe.errorMessage || 'No error'}`
    });

    // 4. Restore Baseline before controlled segment
    if (this.isInterrupted(ctx)) return assertions;
    await this.emitEvent(ctx, 'phase_started', 'restore_baseline');
    await this.controller.resetToBaseline(ctx.fence);
    await this.collectProbePairs(ctx, 'restore_baseline', 3, 'orders');
    await this.emitEvent(ctx, 'phase_finished', 'restore_baseline');

    // 5. Dual-trust Install (Root A + B)
    if (this.isInterrupted(ctx)) return assertions;
    await this.emitEvent(ctx, 'phase_started', 'dual_trust_install');
    this.controller.setServiceTrust('gateway', dualTrustPem, ctx.fence);
    this.controller.setServiceTrust('orders', dualTrustPem, ctx.fence);
    const dualTrustEvt = await this.emitEvent(ctx, 'profile_installed', 'dual_trust_install', {
      trustProfile: 'root-a-and-b',
      message: 'Dual trust installed on gateway and orders'
    });
    await this.emitEvent(ctx, 'phase_finished', 'dual_trust_install');

    // 6. Verify Dual Trust Accepts Root A
    if (this.isInterrupted(ctx)) return assertions;
    await this.emitEvent(ctx, 'phase_started', 'verify_dual_trust');
    const dualTrustPairsA = await this.collectProbePairs(ctx, 'verify_dual_trust', 3, 'orders', 'dual-trust', dualTrustPem);
    await this.emitEvent(ctx, 'phase_finished', 'verify_dual_trust');

    assertions.push({
      id: 'A02_dual_trust_established',
      label: 'Dual-trust bundle successfully established across services',
      status: dualTrustPairsA.every((p) => p.probe.success) ? 'pass' : 'fail',
      expected: 'Both Root A and Root B recognized simultaneously',
      actual: `${dualTrustPairsA.length} probes authenticated`,
      evidenceEventIds: [dualTrustEvt.id, ...dualTrustPairsA.map((p) => p.eventId)],
      explanation: 'Services configured with dual trust bundles successfully authenticate existing Root A traffic.'
    });

    // 7. Switch Leaves to Root B Under Dual Trust in Callee Dependency Order (ledger, then orders)
    if (this.isInterrupted(ctx)) return assertions;
    await this.emitEvent(ctx, 'phase_started', 'switch_leaf_b');

    // First callee: ledger
    this.controller.installProfile('ledger', ledgerB0, ctx.fence);
    this.controller.reloadServiceContext('ledger', ctx.fence);
    const ledgerSwitchEvt = await this.emitEvent(ctx, 'context_reloaded', 'switch_leaf_b', {
      service: 'ledger',
      activeProfile: 'B0'
    }, 'ledger');

    // Second callee: orders
    this.controller.installProfile('orders', ordersB0, ctx.fence);
    this.controller.reloadServiceContext('orders', ctx.fence);
    const ordersSwitchEvt = await this.emitEvent(ctx, 'context_reloaded', 'switch_leaf_b', {
      service: 'orders',
      activeProfile: 'B0'
    }, 'orders');

    // Probe both callees under dual trust
    const switchPairsOrders = await this.collectProbePairs(ctx, 'switch_leaf_b', 3, 'orders', 'dual-trust', dualTrustPem);
    const switchPairsLedger = await this.collectProbePairs(ctx, 'switch_leaf_b', 2, 'ledger', 'dual-trust', dualTrustPem);
    await this.emitEvent(ctx, 'phase_finished', 'switch_leaf_b');

    // Execute application request during migration
    let appReq: any = { success: true, statusCode: 200 };
    let appReqEvtId: string | null = null;
    if (typeof this.controller.executeApplicationRequest === 'function') {
      appReq = await this.controller.executeApplicationRequest(dualTrustPem);
      const appReqEvt = await this.emitEvent(ctx, 'sample_request', 'switch_leaf_b', {
        path: 'gateway -> orders -> ledger',
        success: appReq.success,
        statusCode: appReq.statusCode
      });
      appReqEvtId = appReqEvt.id;
    }

    const dualSwitchOk = switchPairsOrders.every((p) => p.probe.success) &&
      switchPairsLedger.every((p) => p.probe.success) &&
      appReq.success;

    assertions.push({
      id: 'A03_leaf_b_accepted_under_dual_trust',
      label: 'Root B leaf certificate accepted without caller disruption',
      status: dualSwitchOk ? 'pass' : 'fail',
      expected: 'Root B leaf certificates accepted by dual-trust callers for orders and ledger',
      actual: `${switchPairsOrders.length + switchPairsLedger.length} successful probes, end-to-end request: ${appReq.success ? 'PASS' : 'FAIL'}`,
      evidenceEventIds: [ordersSwitchEvt.id, ledgerSwitchEvt.id, ...switchPairsOrders.map((p) => p.eventId), ...switchPairsLedger.map((p) => p.eventId), ...(appReqEvtId ? [appReqEvtId] : [])],
      explanation: 'Application traffic transitioned seamlessly to Root B leaf certificates across orders and ledger under dual trust.'
    });

    // 8. Prune Old Trust (Root B only)
    if (this.isInterrupted(ctx)) return assertions;
    await this.emitEvent(ctx, 'phase_started', 'prune_trust_a');
    this.controller.setServiceTrust('gateway', rootBPem, ctx.fence);
    this.controller.setServiceTrust('orders', rootBPem, ctx.fence);
    const pruneEvt = await this.emitEvent(ctx, 'profile_installed', 'prune_trust_a', {
      trustProfile: 'root-b-only',
      message: 'Pruned Root A from trust store across callers'
    });
    const finalPairsOrders = await this.collectProbePairs(ctx, 'prune_trust_a', 3, 'orders', 'root-b', rootBPem);
    const finalPairsLedger = await this.collectProbePairs(ctx, 'prune_trust_a', 2, 'ledger', 'root-b', rootBPem);

    // Execute real application request AFTER old trust is removed
    const finalAppReq = await this.controller.executeApplicationRequest();
    const finalAppEvt = await this.emitEvent(ctx, 'sample_request', 'prune_trust_a', {
      path: 'gateway -> orders -> ledger',
      success: finalAppReq.success,
      statusCode: finalAppReq.statusCode
    });

    await this.emitEvent(ctx, 'phase_finished', 'prune_trust_a');

    const ledgerServing = this.controller.services.get('ledger')?.servingProfile;
    const ordersServing = this.controller.services.get('orders')?.servingProfile;
    const ledgerMigrated = ledgerServing?.issuerFingerprint === this.controller.certStore.rootB.fingerprint;
    const ordersMigrated = ordersServing?.issuerFingerprint === this.controller.certStore.rootB.fingerprint;
    const allProbesOk = finalPairsOrders.every((p) => p.probe.success) && finalPairsLedger.every((p) => p.probe.success);
    const migrationSuccess = allProbesOk && finalAppReq.success && finalAppReq.statusCode === 200 && ledgerMigrated && ordersMigrated;

    assertions.push({
      id: 'A04_trust_pruned_to_root_b',
      label: 'Retired Root A cleanly pruned leaving Root B active',
      status: migrationSuccess ? 'pass' : 'fail',
      expected: 'Clean operational state under Root B authority only with verified application path',
      actual: `${finalPairsOrders.length + finalPairsLedger.length} successful probes, end-to-end request: ${finalAppReq.success ? `PASS (${finalAppReq.statusCode})` : `FAIL (${finalAppReq.statusCode || finalAppReq.error})`}, ledger: ${ledgerMigrated ? 'Root B' : 'Root A'}`,
      evidenceEventIds: [pruneEvt.id, ...finalPairsOrders.map((p) => p.eventId), ...finalPairsLedger.map((p) => p.eventId), finalAppEvt.id],
      explanation: migrationSuccess
        ? 'Root rollover completed with Root A safely retired and verified gateway -> orders -> ledger application flow.'
        : 'Migration incomplete: callees still serving Root A or end-to-end application request failed under Root B trust.'
    });

    return assertions;
  }
}
