# Executable scenario specifications

Every scenario has: versioned setup, verified baseline, fault, observations, assertions, recovery, and final baseline verification. Assertions evaluate event data, not the control operation's return message. Use separate issuance/install/served observations. Probe only fixed seeded service endpoints. Do not disable verification to get a green result.

## Measurement rules

- Capture UTC wall timestamps and monotonic elapsed duration in the worker. Preserve actual sample count; do not substitute intended schedule count.
- Use fresh, non-resumed TLS connections with explicit SNI/service SAN and configured caller trust. No HTTP keep-alive reuse for these measurements.
- Classify transport, TLS authentication, application, controller and issuance errors separately.
- Healthy-window observations: collect at least 5 successful samples per required edge before mutation.
- Post-recovery: at least 5 consecutive successful fresh probes on every required edge plus a successful end-to-end sample request.
- Missing evidence -> inconclusive. Unexpected behavior -> fail. Expected rejection -> pass for the corresponding security assertion.
- Recovery time: from logged recovery_started to final successful recovery assertion. Detection delay: from confirmed fault activation to first qualifying observation. If boundaries are not observable, report unavailable.
- No percentage without numerator and denominator. No tail-latency statistics from tiny samples. Do not call an expected TLS rejection 'downtime prevented'.

## S01: Renewal without application reload (version 1)

Purpose: distinguish certificate issuance/installation from the actual serving context.

Baseline: orders serves A0; caller trusts A; disk profile A0; strict probes pass.

Steps:
1. Issue A1 for orders with same valid SAN and issuer A, new key/serial/fingerprint. Log public issuance metadata.
2. Install A1 profile atomically without reloading orders' server TLS context. Preserve A0 securely as baseline profile.
3. Probe orders on >=5 fresh connections. Record served fingerprint A0, installed fingerprint A1, validity, and successful authentication.
4. Evaluate mismatch assertion; surface 'New certificate installed; previous certificate still served.' This condition need not cause an outage while A0 remains valid.
5. Request fixed context reload; no process restart needed. Probe >=5 fresh connections, now A1. Check application path.
6. Recovery restores A0 configuration and verifies baseline (or records the explicitly configured clean baseline revision).

Assertions: A1 fingerprint != A0; installed=A1; served-before-reload=A0; mismatch detected from independent observations; served-after-reload=A1; strict auth remained valid during sampled windows; final reset verified. Expected pass includes detection of a stale serving context, not fabricated application failure.

Failure handling: if issuance fails, stop before mutation and preserve evidence. If TLS library automatically reloads, experiment fails setup; do not fake mismatch. If reload unknown outcome, inspect serving fingerprint and reset if necessary.

## S02: Issuance-path unavailability (version 1)

Purpose: demonstrate operational separation between requesting a certificate and validating a currently valid certificate.

Baseline: A0 valid for more than entire run deadline plus safety margin; root trust A; proxy permits renewal requests.

Steps:
1. Enable issuance-proxy reject mode for fixed issuer A route only. Confirm proxy state with operation ID.
2. Attempt bounded renewal through proxy 3 times, at 2-second intervals by default. Record each request and error without credentials. Retry policy belongs to this scenario, not global mutation retry.
3. While requests fail, probe normal service edges for >=5 fresh connections. Certificates must still be valid; do not wait for expiry.
4. Disable proxy fault, issue/renew A1 through restored path, install and reload safely, verify served A1.
5. Restore baseline; verify no proxy fault remains.

Assertions: issuance failures actually observed; alert/event produced; existing service TLS stays authenticated in sampled window; restored issuance succeeds; expected served fingerprint observed after reload; recovery verified.

Limitations: no claim about CA process crash, regional failover, OCSP/CRL resilience, or behavior after certificate expiry. This experiment fails the issuance path intentionally. CA-unreachable fault modes can be separate later scenarios.

## S03: Trust-root rollover (version 1)

Purpose: show sequencing of caller trust and callee identity.

Baseline: orders and ledger present A-issued certificates; gateway and orders trust A. B-issued profiles already available or issued under tested adapter.

Negative-control segment:
1. Switch orders serving certificate to B0 while gateway still trusts A.
2. Probe gateway -> orders: expect certificate-chain authentication rejection. Show actual TLS error. This expected failure is a passing negative-control assertion.
3. Restore orders to A; verify authenticated baseline before continuing.

Controlled segment:
4. Install trust A+B at gateway and orders, reload caller trust contexts, verify existing A services still work.
5. Switch ledger then orders to B profiles, one at a time, verifying relevant edges and end-to-end sample request after each switch.
6. Confirm every configured in-scope callee serves B. Change caller trust from A+B to B-only.
7. Probe each edge and application path; capture actual sample counts and failures.
8. Recovery first expands caller trust to A+B, restores A-issued leaves, verifies, then removes B from caller trust. Never restore A leaves under B-only callers.

Assertions: negative control rejects B under A-only trust; restored baseline works; both A and B authenticate during dual-trust stage using controlled profiles; controlled sequence has successful required sampled connections; final trust B-only accepts B and rejects a dedicated A test leaf; baseline recovery verified.

Limitations: configured topology only, selected Node client behavior only, no discovery of hidden clients, no testing of persistent sessions, caches, mobile/JVM/legacy clients or production load. Report sampled connection results, never universal zero downtime.

## Execution invariants

All mutations include active fence and idempotent operation ID. Phase driver owns try/finally recovery. Deadline/cancel stops new experimental work and enters recovery; recovery has its own bounded budget. If total experiment budget is 180s, reserve at least 30s for recovery. Log deadline exhaustion explicitly. Worker crash is handled by lease recovery design, not JavaScript finally alone.

Reset is a state machine too: remove proxy faults; expand needed trust; restore leaves and contexts; restore baseline trust; strict probes; mark ready only on verified success. Reset actions must be safe to repeat. Keep operation journal sufficient to reconcile an interrupted change.
