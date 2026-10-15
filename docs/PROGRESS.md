# Implementation progress

Last updated: 15 October 2026.

## Current state

Phases 0, 1, 2, and 3 complete. Full product interface implemented in `frontend/` conforming to quiet engineering precision design system (`docs/07-design-system.md`). Complete routes: Overview, Environment topology diagram, Rehearsals catalog & detail, Run detail with real-time SSE stream & timeline disclosure, printable Report, side-by-side Compare, and Documentation. Production build verified.

## Active phase

Next: Phase 4 in 09-build-plan.md (Remaining scenarios and comparison: verify S02 and S03 end-to-end execution, negative control rejection, and multi-run comparison).

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
- Remaining limitations: End-to-end execution of S02 and S03 to be verified with automated test repetitions in Phase 4.
- Next action: Implement Phase 4: Execute S02 (issuance fault) and S03 (trust-root rollover) end-to-end, verify negative control rejection, and validate multi-run comparison.
