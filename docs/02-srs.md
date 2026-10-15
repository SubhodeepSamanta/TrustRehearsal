# Software requirements specification

Priority P0 means required for first demonstrable slice; P1 means required for V1 release; P2 means deferred.

| ID | Priority | Requirement | Acceptance evidence |
|---|---|---|---|
| FR01 | P0 | Display environment and explicit operating mode | Viewer sees Recorded / Live local and evidence provenance |
| FR02 | P0 | Read observed certificate metadata | Fingerprint comes from a fresh TLS handshake, not issuance response |
| FR03 | P0 | Execute S01 | Disk fingerprint changes, served fingerprint remains old, reload corrects it |
| FR04 | P0 | Persist ordered run events | Refresh reconstructs run without an in-memory-only source |
| FR05 | P0 | Explain assertions | Each assertion links to supporting event IDs and expected/actual values |
| FR06 | P0 | Prevent concurrent environment mutation | Second start returns 409; stale worker cannot execute after loss of lease |
| FR07 | P0 | Recover/reset | Reset produces baseline fingerprints and successful probes |
| FR08 | P1 | Execute S02 and S03 | Assertions specified in scenario document pass across clean repetitions |
| FR09 | P1 | Cancel a run | Cancellation acknowledged, bounded in-flight work stops, cleanup occurs |
| FR10 | P1 | Explore evidence | Filter by phase/type/service and inspect redacted structured event |
| FR11 | P1 | Export report | JSON validates schema; HTML print view matches run data |
| FR12 | P1 | Compare runs | Only same scenario/environment revision comparisons; missing data shown explicitly |
| FR13 | P1 | Authenticated operator actions | Server enforces login, role, CSRF defense, mode and environment allowlist |
| FR14 | P1 | Public read-only deployment | Mutation endpoints unavailable; no privileged services in deployment |
| FR15 | P1 | Handle all UI states | Loading, empty, unavailable, denied, failed, cancelled, stale, partial evidence |
| FR16 | P2 | Live external adapters | Deferred until documented access and separate security review |

## Nonfunctional requirements

- Local target: one developer machine with Docker Compose Linux containers, Node 24 LTS, MongoDB, and available ports. Record actual supported platform after testing; do not promise native Windows CA binaries.
- Public mode: no run execution. It works from a redacted immutable export, without MongoDB or worker credentials in the public host.
- Local service probes: default 1 fresh TLS handshake per second per required edge; no session resumption or pooled connection can substitute for a fresh-handshake measurement. Store sample counts and window boundaries.
- Bound each probe to 3 seconds, controller request to 5 seconds, and whole scenario to 180 seconds by default. Timings are configuration proposals verified against the selected CA version. Deadline includes recovery budget; failed cleanup becomes needs_reset.
- Persist events incrementally; do not lose all evidence when a scenario fails.
- Default local concurrency 1. No retries of a mutating phase unless documented as idempotent.
- Desktop design verified at 1440x900 and 1280x800; usable at 768px and 390px widths. Primary routes keyboard accessible; respect reduced motion and WCAG AA contrast.
- No external paid APIs, analytics, tracking pixels, or LLM inference required.
- Do not impose an unmeasured performance SLA. Report local route latency and run duration during release verification.

## Outcome semantics

Run lifecycle: queued -> preparing -> running -> recovering -> completed. Cancellation/error branches still enter recovering when mutation may have occurred. Final states: completed, failed, cancelled, interrupted.

Outcome: pass / fail / inconclusive, separate from lifecycle. Completed means execution finished; it does not mean assertions passed.

Environment state: ready / reserved / needs_reset / offline. An unavailable dependency is not a healthy environment. Recovery failure always causes needs_reset regardless of expected scenario success.

No observed failed connections means only that the recorded probes succeeded. It excludes unsampled intervals, pooled sessions, client stacks not tested, and production load.
