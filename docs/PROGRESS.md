# Implementation progress

Last updated: 15 October 2026.

## Current state

Phases 0, 1, 2, 3, and 4 complete. All 3 scenarios (S01, S02, S03) executed with real cryptographic proofs and retained evidence:
- S01: Renewal mismatch detection and context reload recovery.
- S02: Controlled CA proxy partition, verified data plane authentication, and restored renewal.
- S03: Negative control rejection under Root A trust, controlled dual-trust rollover, and baseline reset.

## Active phase

Next: Phase 5 in 09-build-plan.md (Viewer mode and release hardening: export redacted runs, implement public read-only adapter, and security tests).

## Completed

- Product brief, SRS, flows, architecture, models/API, scenario specifications.
- Design system, security model, phases, verification gates, deployment/demo plan.
- Research/decision record and coding handoff prompts.
- Planning-only report example; no measured results.

## Planning verification

- Inspected all 20 initial documentation/example files: nonempty and present.
- Checked relative Markdown links using PowerShell: no broken links.
- Parsed docs/examples/report.example.json with ConvertFrom-Json: successful. Runtime schema validation is a phase 0 task, not yet performed.
- Added root .gitignore as the 21st file to exclude dependencies, local secrets, key files, and generated runtime artifacts.
- Reviewed scope consistency: public viewer has no executor; real TLS evidence is required; controller authority is fenced and persisted; expected TLS failures are distinguished from failed assertions.
- No application or visual-runtime checks were performed because this is a planning pack.

## Known constraints

- Single seeded local environment; public read-only mode.
- Real TLS observations required; fixtures explicitly labeled.
- No Docker socket, arbitrary targets, paid APIs, automatic publication or outreach.

## Phase log template

### Phase 0 — Workspace and contracts — 15 October 2026

- Status: complete.
- Changes: Root workspace package.json configured with `frontend` and `backend`; `.env.example`, `.env`, `.gitignore` set up; TypeScript configs, Zod contracts in `backend/src/contracts/index.ts`; `backend/src/index.ts` API entrypoint with healthcheck; `frontend/` Vite React setup with design tokens in `frontend/src/index.css`; Vitest contracts test.
- Commands and results:
  - `node -v` (v22.16.0), `npm -v` (11.17.0), `docker --version` (29.2.1), local MongoDB (27017) running.
  - `npm install`: succeeded, 256 packages installed, lockfile generated.
  - `npm run test --workspace=backend`: 3/3 passed (validates `docs/examples/report.example.json` and Zod schemas).
  - `npm run typecheck`: passed cleanly for both backend and frontend.
  - `git init`: initialized.
- Evidence: `backend/tests/contracts.test.ts` passing report schema validation against `docs/examples/report.example.json`.
- Decisions/deviations: Implemented strict folder layout with `frontend` and `backend` folders per user explicit request.
- Remaining limitations: Lab CAs and sample HTTPS services not yet booted (Phase 1).
### Phase 1 — Real TLS proof, before dashboard — 15 October 2026

- Status: complete.
- Changes:
  - `backend/src/lab/ca.ts`: PKI manager generating Root CAs A and B, leaf certificates with SANs (`orders`, `ledger`, `gateway`, `localhost`, `127.0.0.1`), SHA-256 fingerprint extraction.
  - `backend/src/lab/sampleServices.ts`: Live HTTPS sample services with atomic profile install and live context reload (`server.setSecureContext`).
  - `backend/src/lab/probe.ts`: Fresh-connection TLS probe with explicit SNI, chain validation, timing and peer certificate fingerprint extraction.
  - `backend/src/lab/controller.ts`: Controller managing CAs, baseline profiles A0/B0, context reload, trust updates, proxy fault injection, and baseline reset.
  - `backend/tests/tls-proof.test.ts`: Integration test verifying A0 served -> A1 issued & installed without reload (mismatch detected) -> context reloaded -> A1 served -> reset to A0 -> negative control with untrusted CA rejected.
- Commands and results:
  - `npm run test --workspace=backend`: 5/5 passed (contracts and tls-proof).
- Evidence: `backend/tests/tls-proof.test.ts` real handshakes on ports 8443, 8444, 8445; observed distinct SHA-256 leaf fingerprints and verified reload without process restart.
- Decisions/deviations: None.
### Phase 2 — Durable run backend — 15 October 2026

- Status: complete.
- Changes:
  - `backend/src/db/models.ts`: Mongoose models for Environment, Scenario, Run, RunEvent, Lease, Session, and Idempotency with unique and partial indexes.
  - `backend/src/db/connection.ts`: MongoDB connection and idempotently seeds `sample-lab` and S01, S02, S03 scenario specs.
  - `backend/src/worker/engine.ts`: Worker state machine (`queued` -> `running` -> `recovering` -> `completed`), atomic lease acquisition with monotonic fencing token, 5s heartbeat, real execution of S01, S02, and S03, event emission, SSE fan-out, and assertion evaluation.
  - `backend/src/api/routes.ts`: Full REST API with session management, CSRF validation, deployment mode enforcement, run creation with idempotency key, cancel, reset, SSE streaming, and canonical JSON report export.
  - `backend/tests/integration/runs-and-api.test.ts`: Integration test verifying S01 execution, event streaming/persistence, report contract validation, and concurrent lease rejection.
- Commands and results:
  - `npm run test:integration --workspace=backend`: 2/2 passed.
  - `npm run test --workspace=backend`: 7/7 passed.
- Evidence: Durable run record `test-run-s01-...` executed, emitted >10 events, all 6 assertions passed with real event references, and report validated against `ReportSchema`.
- Decisions/deviations: None.
### Phase 3 — Product interface — 15 October 2026

- Status: complete.
- Changes:
  - `frontend/src/api/client.ts`: Typed REST client with CSRF token injection and `useRunStream` SSE subscription.
  - `frontend/src/components/Navigation.tsx`: 208px fixed rail navigation with live mode badge and operator session control.
  - `frontend/src/components/StatusChip.tsx`: Compact accessible status indicators for lifecycles, outcomes, environments, and assertions.
  - `frontend/src/components/TopologyDiagram.tsx`: SVG/CSS dependency diagram (gateway -> orders -> ledger) with interactive node inspection and edge table.
  - `frontend/src/components/LoginModal.tsx`: Operator password modal with CSRF token exchange.
  - `frontend/src/pages/Overview.tsx`: Hero trust path panel, environment health summary, 3 scenario cards, and recent activity table.
  - `frontend/src/pages/EnvironmentPage.tsx`: Interactive topology inspection and operator baseline reset.
  - `frontend/src/pages/RehearsalsPage.tsx`: Rehearsal catalog with phase and assertion metrics.
  - `frontend/src/pages/RehearsalDetailPage.tsx`: Complete scenario execution plan, pre-execution review, and trigger.
  - `frontend/src/pages/RunDetailPage.tsx`: Live SSE timeline, phase disclosures, raw JSON inspection, assertions panel, and evidence explorer tabs.
  - `frontend/src/pages/ReportPage.tsx`: Canonical report export, download JSON, and clean printable A4 styles.
  - `frontend/src/pages/ComparePage.tsx`: Side-by-side run comparison with provenance indicators and assertion diffs.
  - `frontend/src/pages/DocsPage.tsx`: Architecture overview, scenario documentation, and honest claims statement.
- Commands and results:
  - `npm run typecheck`: passed cleanly for both backend and frontend.
  - `npm run build`: built backend `dist/` and frontend Vite production bundle (`dist/index.html` + chunks) in 2.87s.
- Evidence: Verified clean build and typecheck with zero errors.
- Decisions/deviations: None.
### Phase 4 — Remaining scenarios and comparison — 15 October 2026

- Status: complete.
- Changes:
  - `backend/tests/integration/scenarios-s02-s03.test.ts`: Integration test executing S02 and S03 end-to-end with real TLS handshakes and assertions.
  - S02 proven: 3 bounded renewal requests rejected during simulated CA partition, existing data plane verified valid across fresh TLS handshakes, proxy restored, renewal completed, context reloaded.
  - S03 proven: Negative control strictly rejected abrupt Root B certificate under Root A trust, baseline restored, dual-trust expanded across gateway and orders, sequential leaf switch completed, trust pruned to Root B only, and safe baseline reset back to Root A.
  - Consecutive clean runs verified across scenario repetitions.
- Commands and results:
  - `npx vitest run tests/integration/scenarios-s02-s03.test.ts`: 3/3 passed in 8.66s.
  - `npm run test --workspace=backend`: 10/10 passed across all suites.
- Evidence: Run records for S02 (`test-s02-...`) and S03 (`test-s03-...`) persisted in MongoDB with verified assertion outcomes.
- Decisions/deviations: None.
- Remaining limitations: Export of sanitized runs for public viewer mode to be generated in Phase 5.
- Next action: Implement Phase 5: Viewer mode and release hardening with snapshot export, security verification (CSRF, mode denial, auth), and responsive review.
