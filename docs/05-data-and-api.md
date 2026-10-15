# Data models and API contract

Implement shared Zod schemas and inferred TypeScript types before UI/server diverge. All dates ISO-8601 UTC; display timezone explicitly. IDs opaque UUIDs. Durations nonnegative ms. Fingerprints normalized lowercase SHA-256 hex, full 64 chars in evidence; shorten in UI only.

## Collections

Environment: id, revision, label, state, services[], edges[], baselineProfile, lastVerifiedAt. Edges contain caller, callee, fixed servername and expected trust profile. Configured endpoints are server-owned, never supplied in public API.

Scenario: id, version, label, description, expectedFaults[], phaseDefinitions[], assertionDefinitions[], maxDurationMs. Version registry in code; persist immutable definition snapshot at run start.

Run: id, environmentId/revision, scenarioId/version, provenance ('live_lab' | 'recorded_example'), lifecycle, outcome nullable until evaluation, active, createdAt/startedAt/finishedAt, actorId, phase, cancelRequestedAt, heartbeatAt, fencingToken, idempotencyKey, buildCommit nullable, toolVersions, configurationSnapshot (redacted), assertionResults[], recoveryResult, limitations[]. Never serialize actor session/worker secret in public report.

RunEvent: id, runId, seq, type, phase, serviceId nullable, observedAt, elapsedMs, operationId nullable, data (discriminated schema). Unique index (runId, seq). Event types: phase_started, phase_finished, certificate_issued, profile_installed, context_reloaded, tls_probe, sample_request, fault_enabled, fault_disabled, assertion_evaluated, recovery_verified, run_interrupted. No unbounded arbitrary log payload.

TLS probe data: caller, callee, servername, success, authorized, errorCode nullable, certificateFingerprint nullable, issuerFingerprint nullable, protocol nullable, durationMs, trustProfile, connectionFresh=true. If strict handshake fails before certificate can be collected, fingerprint may be null. Any separate diagnostic unverified inspection must be clearly marked non-authenticating and must never count as a successful authenticated probe.

AssertionResult: id, label, status ('pass'|'fail'|'inconclusive'), expected, actual, evidenceEventIds[], explanation. Expected/actual must conform to assertion-specific schemas. No evidence reference outside the run.

Lease: environmentId unique, ownerId, fence increasing integer, expiresAt, heartbeatAt. Job: runId unique, state, claimedBy, attempt. Session: hashed opaque ID, actor role, expiry; TTL index. Idempotency: unique actor+key, requestHash, runId, expiresAt.

Indexes: Runs(environmentId,createdAt), Runs(active,environmentId) with unique partial filter active=true, Events(runId,seq) unique, Sessions(expiresAt) TTL, Lease(environmentId) unique. Events and runs do not auto-expire in V1. Implement explicit retention later. Mongo TTL is not immediate; enforce session expiry in code.

## HTTP routes

Prefix /api/v1. JSON schemas strip/reject unknown mutation keys. Max JSON request 32 KiB; exports stream with configured size cap.

| Method/path | Mode | Contract |
|---|---|---|
| GET /meta | Both | mode, capabilities, build version, fixture provenance |
| GET /health | Both | process liveness only |
| GET /ready | Local | dependency readiness; no sensitive connection strings |
| GET /environments | Both | redacted environment summaries |
| GET /environments/:id | Both | service topology and latest observations |
| GET /scenarios | Both | registry summaries |
| GET /scenarios/:id | Both | versioned scenario plan |
| GET /runs?cursor=&limit= | Both | cursor pagination, limit <=50 |
| GET /runs/:id | Both | run and assertion summary |
| GET /runs/:id/events?afterSeq=&limit= | Both | ordered persisted events, limit <=200 |
| GET /runs/:id/stream | Local | SSE replay; authenticated session |
| GET /runs/:id/report | Both | canonical report JSON |
| POST /operator/session | Local | password -> secure session; generic failure |
| DELETE /operator/session | Local | logout, CSRF protected |
| GET /operator/session | Local | role and CSRF token; no password material |
| POST /runs | Local | environmentId, scenarioId, scenarioVersion; Idempotency-Key required |
| POST /runs/:id/cancel | Local | request cancellation; does not imply immediate cleanup |
| POST /environments/:id/reset | Local | queue reset job; conflicts with active execution |

POST /runs returns 202 {runId, lifecycle:'queued', eventsUrl}. Same key + same request returns same run; same key + different request returns 409. Start must validate scenario, mode, session, CSRF and readiness. Queue consumer rechecks readiness. Cannot transition needs_reset to ready without baseline probes.

Use error shape {error:{code,message,requestId,details?}}. Codes: INVALID_REQUEST, NOT_AUTHENTICATED, FORBIDDEN, LIVE_DISABLED, ENVIRONMENT_BUSY, ENVIRONMENT_NOT_READY, IDEMPOTENCY_CONFLICT, NOT_FOUND, RATE_LIMITED, DEPENDENCY_UNAVAILABLE. HTTP: 400,401,403,404,409,429,503 respectively as appropriate. Public mutation routes return 404/405 and never reach an executor.

## SSE

id = seq; event = run-event; data = versioned event JSON. Last-Event-ID replays seq greater than last delivered; preserve ascending order. Subscribe/replay must avoid gaps by using persisted polling tail or a tested equivalent. Heartbeat comments every 15s. Client deduplicates by runId+seq, caps mounted rows, handles reconnect/backoff, and fetches final summary after terminal event. Public recorded runs do not pretend to stream live execution.

## Report contract

schemaVersion='1.0', reportId, generatedAt, run, environmentSnapshot, scenarioSnapshot, methodology, assertions, measurements, recovery, evidenceEvents, limitations. Validate before download and after loading public snapshots. Include sample windows, denominators, actual tool versions, and provenance. Evidence hash may detect accidental change only; no authenticity claim without an independent signature/trust design.

Example in examples/report.example.json is planning-only, with no fabricated measurement or passed assertions.
