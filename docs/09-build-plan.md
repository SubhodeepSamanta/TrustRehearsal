# Implementation phases and gates

Use one phase per coding invocation. Complete the gate and record evidence before advancing. A phase may take several turns. Do not equate elapsed time with completion. Estimated effort is intentionally omitted until phase 0 confirms tooling and phase 1 proves TLS behavior.

## Phase 0: Workspace and contracts

Read 01,02,04,05,08. Inspect installed Node/npm/Docker/Compose and available resources. Select exact compatible dependencies and lock them. Scaffold npm workspaces, TypeScript configuration, scripts, .gitignore, .env.example, shared schemas, and basic process health checks. Write concrete local startup instructions. Do not initialize or commit Git unless asked; repository operation is not required to implement files.

Gate: clean dependency install; typecheck; schema validates planning example; no secrets; tool availability recorded. If Docker is unavailable, scaffold and document it, but do not claim TLS proof. Stop after phase 0.

## Phase 1: Real TLS proof, before dashboard

Read 04,06,08. Bootstrap lab root A and sample services. Implement strict probe. Build manual fixed S01 issuance/install/reload/reset sequence through internal controller. CLI verification can precede API. Keep service identities fixed and actual fingerprint observations accessible in redacted evidence.

Gate: A0 observed -> A1 installed while A0 still served -> reload -> A1 observed -> verified baseline reset. Save actual evidence and exact commands. Test expected wrong-trust rejection. Do not proceed on a fixture-only substitute.

## Phase 2: Durable run backend

Read 02,04,05,06,08. Add Mongo models/indexes, sessions/CSRF, mode enforcement, worker state machine, lease/fence, S01 job execution, persisted events, cancellation, recovery, JSON report. Add no frontend complexity beyond a basic client needed to inspect API.

Gate: run survives browser refresh; duplicate start conflicts; idempotency works; worker interruption produces interrupted state and reset; recovery failure sets needs_reset; anonymous/public mutation denied; report schema passes with actual evidence references.

## Phase 3: Product interface

Read 03,07 and relevant contracts. Build tokens, shell, Overview, scenario detail, Run detail/evidence, Environment, Runs and Report. Use real backend data locally. Create clearly labeled recorded fixture for UI states if real evidence not yet available; do not silently use it in live mode. Implement SSE/polling reconciliation, responsive navigation, keyboard states, and print CSS.

Gate: S01 end-to-end via browser; no dead enabled controls; loading/error/empty/partial/stale states; screenshots at specified widths; no overflow. Fix layout findings before adding optional decoration.

## Phase 4: Remaining scenarios and comparison

Read 06. Add issuance-path proxy and root B; implement S02/S03 with assertions and reset. Add compatible-run comparison. Do not add arbitrary scenario editor or target input.

Gate: three clean real executions per scenario with retained observations; negative control fails TLS as expected; controlled rollover and reset verified; compare semantics correct. Missing measurements remain explicit.

## Phase 5: Viewer mode and release hardening

Read 08,10,11. Export selected real redacted runs; implement read-only snapshot adapter and mode labels. If real runs cannot be exported, use declared examples and record that release gate is unmet. Public build contains no live components or management secrets. Add documentation screen and source/demo links as configured. Complete security tests, responsive/keyboard/print checks, startup runbook and known limitations.

Gate: clean checkout startup reproducible; public mutations unavailable; report provenance accurate; required tests pass; screenshots reviewed. Do not publish automatically.

## Phase 6: Presentation pack

Produce final concise README, SRS/architecture updates matching actual code, a measured sample report, a 3-minute demo script with actual observed values, and a follow-up draft. Record a video only if tooling is available; never claim a recording exists without file verification. No outreach sending.

Gate: a reviewer can understand value in 60 seconds and reproduce the principal scenario from documented commands. Document actual limits and untested platforms. User may then choose hosting/publication and outreach timing.

## Credit discipline

Use existing decisions; don't reopen framework choices. Inspect only relevant files. Fix one root cause rather than rerunning broad suites indefinitely. Tests focus on behavior, security boundaries, and evidence, not implementation mirrors. End each phase with a short completion summary and PROGRESS update. Never spend tokens generating long generic explanations instead of implementation.
