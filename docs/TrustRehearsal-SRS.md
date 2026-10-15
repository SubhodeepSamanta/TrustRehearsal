# TrustRehearsal — Software Requirements Specification (SRS)
## Including High-Level Design (HLD) & Low-Level Design (LLD)

**Rehearse cryptographic change. See what breaks before production.**

- **Author:** Subhodeep Samanta
- **Document Version:** 1.0
- **Document Date:** October 16, 2026
- **Status:** Final Consolidated Engineering Specification
- **Classification:** Technical Reference & Design Baseline

---

## 1. Document Control & Table of Contents

### 1.1 Purpose & Audience
This document serves as the authoritative Software Requirements Specification (SRS), High-Level Design (HLD), and Low-Level Design (LLD) for **TrustRehearsal**. It bridges the operational gap between public-key certificate lifecycle operations (issuance, distribution, renewal) and real-world connection-level TLS behavior across multi-tier service dependencies.

The intended audience includes:
- **Prospective Reviewers & Technical Evaluators:** Engineers assessing architecture, cryptographic rigor, and verifiable software design.
- **Platform & Security Engineers:** Practitioners managing enterprise PKI, certificate automation, and mutual or server-authenticated TLS migrations.
- **Project Maintainers:** Developers implementing, testing, or auditing scenarios within the local execution lab or the public recorded viewer.

### 1.2 Revision History
| Version | Date | Author | Summary of Changes |
| :--- | :--- | :--- | :--- |
| **0.1** | 2026-10-15 | Subhodeep Samanta | Initial requirements draft, product brief, and scenario definitions. |
| **0.5** | 2026-10-15 | Subhodeep Samanta | Architecture specification, Zod data contracts, and lab controller design. |
| **0.9** | 2026-10-15 | Subhodeep Samanta | Verification gates, security boundaries, and viewer export adapter. |
| **1.0** | 2026-10-16 | Subhodeep Samanta | Consolidated SRS, HLD, and LLD. Aligned with 16 October independent review: dependency-ordered S03 migration, authenticated issuance proxy, honest empty reports, and multi-tier verification. |

### 1.3 Requirement Classification & Status Taxonomy
Requirements in this specification are designated with stable identifiers and prioritized according to the following scheme:
- **P0 (Mandatory / Foundation):** Required for initial demonstration slice, core cryptographic correctness, and security boundary isolation.
- **P1 (Core Release):** Required for complete functional release, including all three scenarios, reporting, comparison, and operator controls.
- **P2 (Deferred / Roadmap):** Architectural extension or production-hardening capability planned for post-V1 milestones.

Implementation and verification statuses are explicitly categorized:
- **Implemented & Verified:** Fully written in code and confirmed by automated tests (Vitest integration suites or independent review harnesses).
- **Implemented:** Coded and operational in the local or static build; subject to baseline constraints.
- **Deferred / Future:** Documented architecture requirement planned for distributed production environments.

---

### Table of Contents
1. [Document Control & Table of Contents](#1-document-control--table-of-contents)
2. [Product Definition & Scope](#2-product-definition--scope)
3. [User Journeys & Use Cases](#3-user-journeys--use-cases)
4. [Functional Requirements](#4-functional-requirements)
5. [Nonfunctional Requirements](#5-nonfunctional-requirements)
6. [Scenario Specifications (S01, S02, S03)](#6-scenario-specifications)
7. [High-Level Design (HLD)](#7-high-level-design-hld)
8. [Low-Level Design (LLD)](#8-low-level-design-lld)
9. [Security Architecture & Threat Model](#9-security-architecture--threat-model)
10. [User Interface & Evidence Presentation](#10-user-interface--evidence-presentation)
11. [Verification, Traceability & Acceptance](#11-verification-traceability--acceptance)
12. [Risks, Limitations & Future Roadmap](#12-risks-limitations--future-roadmap)
13. [Glossary & References](#13-glossary--references)

---

## 2. Product Definition & Scope

### 2.1 The Core Problem: The Three Disconnects of PKI
In traditional certificate lifecycle management (CLM), success is declared when a Certificate Authority (CA) issues a cryptographic leaf certificate. However, operational enterprise outages routinely occur *after* successful issuance due to three structural disconnects:
1. **The Serving Context Disconnect:** Issuing a certificate and writing it to disk does not update the active in-memory TLS context of running server processes. Without an explicit, graceful context reload (e.g., `tls.SecureContext`), processes continue serving the old certificate until expiration, causing silent, unexpected customer outages.
2. **The Control-Plane vs. Data-Plane Disconnect:** Transient outages in the CA issuance infrastructure (network partitions, proxy 502s, ACME server timeouts) prevent renewals, but running applications often panic or fail closed unnecessarily, failing to recognize that existing issued certificates remain completely valid throughout their scheduled validity lifetime.
3. **The Caller-Callee Trust Ordering Disconnect:** Trust-root rollovers (e.g., migrating from Root A to Root B) fail catastrophically when callee services migrate their serving leaf certificates before callers have expanded their trust stores to accept the new root. Downstream dependencies break even when intermediate probes appear healthy.

TrustRehearsal provides a deterministic, repeatable, and observable platform to rehearse these exact transitions before they are executed in production networks.

```text
[Certificate Authority] ---> Issues Leaf Certificate ---> [On-Disk Storage]
                                                                  |
                                                           (Reload Gap)
                                                                  v
[External Caller] <==== Strict TLS Handshake ===== [Active In-Memory Server Context]
   (Trust Store)                                     (Presents Serving Leaf)
```

### 2.2 Objectives & Business Value
- **Deterministic Rehearsal:** Execute bounded, automated failure scenarios against a running microservice dependency graph.
- **Connection-Level Ground Truth:** Measure actual TLS handshakes, SNI negotiation, certificate fingerprints, and HTTP application transactions rather than relying on configuration logs or static assertions.
- **Decoupled Demonstration:** Provide a completely credential-free, read-only public viewer for evaluators, alongside an authenticated local execution lab for engineers.
- **Technical Humility & Honesty:** Strictly distinguish scenario assertion outcomes (e.g., an expected TLS failure in a negative test) from service health, and never fabricate metrics or zero-downtime claims.

### 2.3 System Scope & Boundaries
- **In-Scope (V1):**
  - Three sample HTTPS services in a realistic dependency chain: `gateway` (port 8443) -> `orders` (port 8444) -> `ledger` (port 8445).
  - Two distinct X.509 Root Certificate Authorities: Root CA A (Baseline) and Root CA B (Target).
  - Three fully implemented and verified scenario pipelines: S01 (Renewal without reload), S02 (Issuance-path failure), and S03 (Staged Root A-to-B rollover).
  - Dual operational modes: `LOCAL_OPERATOR` (loopback Express API, MongoDB persistence, worker engine, authenticated controls) and `PUBLIC_VIEWER` (zero-login static SPA, immutable canonical snapshots, no backend dependencies).
- **Explicit Non-Goals & Exclusions:**
  - Production scanning of external enterprise networks.
  - Mutual TLS (mTLS) client authentication (V1 tests server-authenticated TLS only).
  - Distributed multi-tenant cloud orchestration or billing.
  - Automatic remediation of live customer systems.
  - Claims of compliance certification (SOC2, FIPS 140-2) or quantum-safe cryptography (PQC).

---

## 3. User Journeys & Use Cases

### 3.1 Actors & Roles
- **Public Visitor (Evaluator / Auditor / Engineer):** Accesses the web interface without login or credentials. Inspects recorded scenario executions, verifies event logs and TLS handshakes, compares runs, and downloads canonical reports.
- **Local Operator (Site Reliability Engineer / Cryptographic Engineer):** Operates the local execution lab. Authenticates via local credentials, triggers live scenario executions, monitors real-time Server-Sent Events (SSE), and initiates environment baseline resets.
- **Execution Worker (Automated Agent):** Autonomous background process acquiring monotonic fencing leases to execute scenario phase state machines and write durable evidence records.

### 3.2 Use Case UC-01: Credential-Free Public Exploration
- **Actor:** Public Visitor
- **Preconditions:** Public viewer bundle hosted statically (or Vite preview on loopback); zero active backend processes or database connections required.
- **Normal Flow:**
  1. Visitor opens the web root (`/`). The system detects `VITE_APP_MODE=PUBLIC_VIEWER` and loads `/data/snapshots.json`.
  2. The Overview dashboard displays the three rehearsal cards, hero trust path, environment health, and the 9 canonical pre-recorded runs (3 repetitions per scenario).
  3. Visitor selects scenario **S03: Trust-Root Rollover** and navigates to the latest recorded run (`/runs/:id`).
  4. Visitor expands the execution timeline, reviewing 54 discrete events across 6 phases, inspecting peer leaf SHA-256 fingerprints and strict TLS handshake results.
  5. Visitor selects the **Assertions** tab, verifying that the expected negative control rejection passed alongside the final application probe.
  6. Visitor navigates to **Compare** (`/compare`) to inspect run-to-run consistency against previous executions of S03.
  7. Visitor opens the **Report** view (`/runs/:id/report`) and downloads the canonical JSON report artifact.
- **Alternative / Failure Flow:** If the static snapshot file cannot be loaded, the interface surfaces an explicit error state stating that recorded data is unavailable; it does not attempt to contact a live backend or invent default measurements.

### 3.3 Use Case UC-02: Authenticated Local Scenario Rehearsal
- **Actor:** Local Operator
- **Preconditions:** Local MongoDB running on port 27017, Express API running on port 4000, sample services listening on loopback ports 8443–8445, operator authenticated with session cookie and CSRF token.
- **Normal Flow:**
  1. Operator opens the application in `LOCAL_OPERATOR` mode and authenticates via `/api/v1/operator/session`.
  2. Operator inspects `/environments/sample-lab`, verifying baseline state (`ready`, Root A active, all sample probes passing).
  3. Operator triggers **S01: Renewal Without Reload** (`POST /api/v1/runs`).
  4. Worker acquires the environment lease, assigns an incremented fencing token, and transitions the run to `running`.
  5. The UI subscribes to real-time events via Server-Sent Events (`/api/v1/runs/:id/stream`).
  6. Worker issues leaf certificate `ordersA1`, installs it to disk, and captures 5 fresh TLS probes. The UI immediately highlights the mismatch: disk fingerprint shows `A1`, but served handshake returns `A0`.
  7. Worker executes an atomic context reload via loopback management API (`POST http://127.0.0.1:18444/reload-tls`), captures 5 subsequent probes, and confirms `orders` now serves `A1`.
  8. Worker restores baseline profile `A0`, verifies health, releases the lease, and marks the run `completed` with outcome `pass`.
- **Exception Flow:** If an event persistence failure occurs in MongoDB, the engine halts experimental mutations immediately, logs an interruption, attempts bounded recovery, and marks the environment `needs_reset`.

---

## 4. Functional Requirements

| Identifier | Priority | Title & "Shall" Specification | Acceptance Verification Criteria | Impl. Status |
| :--- | :---: | :--- | :--- | :---: |
| **FR-001** | **P0** | **Operating Mode & Provenance Display:** The system shall explicitly render the active deployment mode (`PUBLIC_VIEWER` or `LOCAL_OPERATOR`) and prominently label all recorded artifacts with immutable provenance tags (`recorded_example` or `live_lab`). | UI renders mode badge in navigation header; recorded runs display persistent provenance chip; no simulated live execution. | Implemented & Verified |
| **FR-002** | **P0** | **Connection-Level TLS Handshake Measurement:** The system shall execute fresh, non-resumed TLS handshakes with explicit SNI to capture peer certificate SHA-256 fingerprints, issuer fingerprints, validity windows, and protocol versions. | Probe never pools connections; captures exact 64-character hex leaf SHA-256 fingerprint; records exact millisecond latency. | Implemented & Verified |
| **FR-003** | **P0** | **S01 Renewal Without Reload Execution:** The system shall issue a renewed leaf certificate `A1`, install it to disk without process restart, detect the serving mismatch against `A0`, execute an in-memory context reload, and confirm serving `A1`. | Assertions `A01` through `A06` evaluate real event references; mismatch detected independently from live probes. | Implemented & Verified |
| **FR-004** | **P0** | **Durable Event Persistence:** The system shall persist every execution event to durable storage prior to SSE broadcast or assertion evaluation. Any persistence failure shall halt execution. | Injected MongoDB insert failure causes worker to abort scenario progression, return null ID, and enter bounded cleanup. | Implemented & Verified |
| **FR-005** | **P0** | **Traceable Assertion Evaluation:** Every assertion result shall explicitly reference specific, persisted event IDs, expected values, actual observed values, and detailed explanatory rationales. | Reports link assertions to event IDs within the same run; zero dangling or fabricated event citations. | Implemented & Verified |
| **FR-006** | **P0** | **Concurrency Control & Monotonic Fencing:** The system shall enforce single-runner mutual exclusion per environment using monotonic integer fencing tokens. Stale workers shall be denied mutation authority. | Concurrent run dispatch returns HTTP 409 Conflict; worker validates fence prior to each state-changing controller mutation. | Implemented & Verified |
| **FR-007** | **P0** | **Safe Baseline Recovery & Reset:** The system shall execute an independent, bounded recovery workflow upon scenario completion, cancellation, or failure, restoring baseline profiles and verifying probes. | Recovery restores `A0` profiles and Root A trust; verifies baseline application probe before setting environment `ready`. | Implemented & Verified |
| **FR-008** | **P1** | **S02 Issuance Proxy Fault Simulation:** The system shall route renewal attempts through a controlled loopback proxy, simulate network 502 partitions, verify that existing TLS handshakes continue unimpeded, and complete renewal after path restoration. | Exactly 3 failed HTTP renewal attempts observed over proxy; normal service probes stay valid; restored renewal succeeds. | Implemented & Verified |
| **FR-009** | **P1** | **S03 Staged Root Migration Sequence:** The system shall execute a strict staged rollover: (1) negative control, (2) expand caller trust to Root A+B, (3) migrate `ledger` to B0, (4) migrate `orders` to B0, (5) prune Root A trust, and (6) verify end-to-end HTTP 200 over Root B. | Negative control strictly fails handshake; callee migration strictly precedes trust pruning; final `gateway -> orders -> ledger` request succeeds. | Implemented & Verified |
| **FR-010** | **P1** | **Graceful Run Cancellation:** The system shall acknowledge operator cancellation requests, cease new experimental phases, execute clean recovery within a reserved budget, and mark the run `cancelled`. | In-flight work terminates within 3 seconds; recovery restores baseline; final lifecycle recorded as `cancelled`. | Implemented & Verified |
| **FR-011** | **P1** | **Evidence Filtering & Structured Inspection:** The system shall provide structured event filtering by phase, event type, and target service, displaying redacted payloads without exposing private keys. | Query parameter parsing (`limit`, `afterSeq`) handles sliced pagination; full structured JSON inspection available for every event. | Implemented & Verified |
| **FR-012** | **P1** | **Canonical JSON & Printable Report Export:** The system shall export canonical reports conforming to the shared Zod schema and render clean, printable A4 layouts. | Exported JSON validates `ReportSchema` with zero schema violations; printable view formats cleanly without clipping. | Implemented & Verified |
| **FR-013** | **P1** | **Run-to-Run Comparison:** The system shall support side-by-side comparison of compatible runs sharing the same scenario and environment revision, highlighting assertion diffs and timing variance. | Incompatible runs (mismatched scenario ID) rejected; assertion outcomes and duration metrics diffed side-by-side. | Implemented & Verified |
| **FR-014** | **P1** | **Authenticated Operator Security Boundary:** All mutating API endpoints shall enforce secure session authentication, origin verification, and double-submit CSRF token validation. | Anonymous requests to `/api/v1/runs` or `/operator/session` return HTTP 401; invalid CSRF tokens return HTTP 403. | Implemented & Verified |
| **FR-015** | **P1** | **Credential-Free Public Static Mode:** The public viewer shall operate directly from pre-rendered static assets and snapshot JSON without requiring backend processes, databases, or credentials. | Zero API calls dispatched in `PUBLIC_VIEWER` mode; navigation, timeline, and reports function entirely offline. | Implemented & Verified |
| **FR-016** | **P1** | **Honest Error Semantics & Empty State Integrity:** The system shall accurately represent missing or inconclusive evidence, reporting 0 samples and `not_run` recovery rather than falling back to fabricated data. | Snapshot with zero events renders 0 samples and empty observation windows; backend HTTP 503 surfaces `UNAVAILABLE`. | Implemented & Verified |

---

## 5. Nonfunctional Requirements

### 5.1 Security & Cryptographic Integrity
- **NFR-SEC-01 (Boundary Enforcement):** The execution lab shall bind all administrative and management listeners exclusively to the loopback interface (`127.0.0.1`). Public viewer distributions shall contain zero management secrets, private keys, or execution endpoints.
- **NFR-SEC-02 (Key Material Scrubbing):** Private keys generated for CAs and sample services shall reside exclusively in memory or temporary lab storage. Private key PEM blocks, passwords, and authorization tokens shall be strictly stripped from database records, API responses, and exported snapshots.
- **NFR-SEC-03 (Strict TLS Verification):** The platform shall enforce strict server hostname and certificate chain validation across all internal probes and inter-service HTTP clients. Under no circumstances shall `NODE_TLS_REJECT_UNAUTHORIZED=0` be set or permitted in production or test harnesses.

### 5.2 Reliability, Recovery & Timing
- **NFR-REL-01 (Bounded Timeouts):** Every TLS probe socket shall enforce a hard 3,000 ms timeout. Controller management calls shall enforce a 5,000 ms timeout. Scenarios shall enforce a 180-second hard deadline, reserving at least 30 seconds for baseline recovery.
- **NFR-REL-02 (Lease & Heartbeat Invariants):** Execution worker leases shall be granted for 20 seconds with an active 5-second heartbeat interval. If a worker fails to renew its lease within 20 seconds, the lease expires and the environment enters `needs_reset`.
- **NFR-REL-03 (Deterministic State Recovery):** Any unhandled error, worker interruption, or failed assertion shall trigger a safe baseline reset. If baseline probes cannot be verified, the environment remains locked in `needs_reset`.

### 5.3 Usability, Accessibility & Portability
- **NFR-USA-01 (Responsive Viewports):** The web user interface shall render cleanly without horizontal scroll or clipping at desktop viewports (1440x900, 1280x800), tablet viewports (768px), and mobile viewports (390px / 375px).
- **NFR-ACC-01 (Accessibility Standards):** The interface shall comply with WCAG 2.1 Level AA contrast standards, support full keyboard navigation across interactive elements, respect `prefers-reduced-motion`, and provide clear focus rings.
- **NFR-POR-01 (Zero-Dependency Portability):** The public viewer shall require nothing more than a static HTTP file server. The local execution lab shall run cleanly on modern LTS Node.js runtimes (Node 22/24) with local MongoDB.

---

## 6. Scenario Specifications

```text
+-----------------------------------------------------------------------------------+
| S01: Renewal Without Reload                                                       |
| Issue A1 -> Install A1 to Disk -> Detect Mismatch (Serving A0) -> Reload -> A1    |
+-----------------------------------------------------------------------------------+
| S02: Issuance-Path Unavailability                                                 |
| Proxy Fault (HTTP 502) -> 3 Failed Requests -> Data Plane Valid -> Restore -> A1  |
+-----------------------------------------------------------------------------------+
| S03: Staged Root A -> Root B Rollover                                              |
| Neg. Control (Reject B0) -> Dual Trust (A+B) -> Migrate Ledger -> Migrate Orders   |
| -> Prune Root A -> Verify End-to-End Application Request (HTTP 200)               |
+-----------------------------------------------------------------------------------+
```

### 6.1 S01: Renewal Without Application Reload (Version 1)
- **Objective:** Demonstrate that issuing and installing a renewed leaf certificate does not update the active server TLS context until an explicit context reload occurs.
- **Baseline:** `orders` serves leaf certificate `ordersA0` signed by Root CA A. Callers trust Root CA A. Initial probes confirm valid authentication and matching fingerprints.
- **Execution Phases:**
  1. `setup`: Probe baseline. Capture initial served fingerprint `ordersA0`.
  2. `issuance`: Issue renewed leaf certificate `ordersA1` with identical Subject Alternative Names (SANs) and new serial/keys.
  3. `installation`: Install `ordersA1` profile to disk without invoking server TLS context reload.
  4. `observation`: Execute 5 fresh TLS probes against `orders`. Assert that served fingerprint remains `ordersA0` while disk profile is `ordersA1`. Surface mismatch finding.
  5. `context_reload`: Dispatch reload request to `orders` loopback management endpoint (`POST :18444/reload-tls`). Server executes `server.setSecureContext()`.
  6. `verification`: Execute 5 fresh TLS probes against `orders`. Assert that served fingerprint is now `ordersA1`.
  7. `recovery`: Re-install baseline profile `ordersA0`, reload context, and verify baseline health.
- **Assertions:**
  - `A01_certificate_issued`: Issued fingerprint != baseline fingerprint.
  - `A02_profile_installed`: Installed profile on disk matches `A1`.
  - `A03_mismatch_detected`: Served fingerprint (`A0`) differs from installed profile (`A1`).
  - `A04_context_reloaded`: Context reload operation completed successfully.
  - `A05_served_renewed`: Served fingerprint after reload matches `A1`.
  - `A06_recovery_verified`: Baseline profile `A0` successfully restored and verified.

### 6.2 S02: Issuance-Path Unavailability (Version 1)
- **Objective:** Demonstrate operational resilience by proving that failure in the certificate issuance infrastructure (CA proxy partition) does not disrupt active data-plane TLS communication for currently valid certificates.
- **Baseline:** All services serve baseline profiles (`A0`) valid for at least 30 days. Issuance proxy operating in normal pass-through mode.
- **Execution Phases:**
  1. `setup`: Verify initial data-plane probes across `gateway`, `orders`, and `ledger`.
  2. `fault_injection`: Configure issuance proxy (`:18440`) to simulated partition mode, returning HTTP 502 Bad Gateway for renewal requests.
  3. `renewal_attempts`: Worker attempts renewal through proxy 3 times at 2-second intervals. All 3 requests fail with HTTP 502.
  4. `data_plane_observation`: Concurrently execute 5 fresh TLS probes against `gateway` and `orders`. Verify 100% successful handshakes and valid data-plane traffic.
  5. `fault_cleared`: Restore issuance proxy to normal relay mode.
  6. `renewal_completion`: Successfully issue renewed profile `ordersA1` through restored proxy, install profile, and reload context.
  7. `recovery`: Restore baseline profile `ordersA0`, reload context, verify baseline probes.
- **Assertions:**
  - `A01_proxy_fault_active`: Issuance attempts correctly fail with HTTP 502.
  - `A02_data_plane_unaffected`: Data-plane TLS handshakes remain 100% authorized during the issuance outage.
  - `A03_restored_issuance`: Renewal succeeds immediately upon proxy restoration.
  - `A04_recovery_verified`: Baseline environment restored and verified.

### 6.3 S03: Staged Root A-to-B Rollover (Version 1)
- **Objective:** Demonstrate the exact sequence required to migrate trust roots across microservice dependencies without service disruption.
- **Baseline:** `gateway`, `orders`, and `ledger` serve Root A certificates. `gateway` and `orders` trust Root A only. Root CA B is available.
- **Execution Phases:**
  1. `negative_control`: Temporarily switch `orders` serving profile to `ordersB0` (signed by Root B) while `gateway` trusts only Root A. Probe `gateway -> orders`. Expect strict TLS handshake failure (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`). This expected failure validates that security enforcement is active. Restore `orders` to `ordersA0`.
  2. `expand_caller_trust`: Update trust stores of `gateway` and `orders` to dual trust: `Root A + Root B`. Reload caller trust contexts. Verify baseline traffic continues authenticated.
  3. `migrate_callees_dependency_order`:
     - *Step 3a (Deepest Callee):* Migrate `ledger` to `ledgerB0` (signed by Root B). Reload `ledger` context. Probe `orders -> ledger` (succeeds via Root B).
     - *Step 3b (Intermediate Callee):* Migrate `orders` to `ordersB0` (signed by Root B). Reload `orders` context. Probe `gateway -> orders` (succeeds via Root B).
  4. `prune_legacy_trust`: Remove Root A from `gateway` and `orders` trust stores, leaving only `Root B`. Reload caller trust contexts.
  5. `e2e_application_verification`: Execute a real, multi-hop HTTP application request: `gateway (8443) -> orders (8444) -> ledger (8445)`. Must return HTTP 200 OK with full cryptographic chain verified over Root B.
  6. `recovery`: Expand caller trust back to A+B, restore `ordersA0` and `ledgerA0`, prune Root B, and verify baseline health.
- **Assertions:**
  - `A01_negative_control_rejected`: Abrupt presentation of Root B leaf rejected by Root A caller.
  - `A02_dual_trust_established`: Dual-trust configuration permits seamless co-existence of Root A and Root B.
  - `A03_callees_migrated`: Callee services migrated in strict dependency order without broken connections.
  - `A04_trust_pruned_and_e2e_verified`: Root A successfully pruned; end-to-end application request succeeds over Root B.
  - `A05_recovery_verified`: Baseline Root A environment restored and verified.

---

## 7. High-Level Design (HLD)

### 7.1 System Context & Deployment Architecture
TrustRehearsal is architected into two decoupled operating models sharing a unified data contract:
1. **Public Static Viewer (Jamstack / Edge):** A pure React 18 single-page application reading immutable JSON snapshots. It mounts a static read-only adapter that rejects mutations with HTTP 403 / 405 and validates report schemas client-side using Zod.
2. **Local Execution Lab (Node.js / Loopback):** A full-featured development environment hosting the Express API gateway, execution engine worker, local MongoDB, loopback PKI manager, and sample HTTPS services.

```text
+----------------------------------------------------------------------------------------------------+
|                                    SYSTEM CONTEXT ARCHITECTURE                                     |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|   [ PUBLIC VIEWER MODE ]                               [ LOCAL OPERATOR LAB ]                      |
|                                                                                                    |
|     +-----------------------+                            +-----------------------+                 |
|     |     Public Visitor    |                            |     Local Operator    |                 |
|     +-----------+-----------+                            +-----------+-----------+                 |
|                 | (HTTPS Read-Only)                                  | (Session + CSRF)            |
|                 v                                                    v                             |
|     +-----------------------+                            +-----------------------+                 |
|     |  React 18 SPA (Vite)  |                            |  Express API Gateway  |                 |
|     |    (Static Client)    |                            |      (Port 4000)      |                 |
|     +-----------+-----------+                            +-----------+-----------+                 |
|                 |                                                    |                             |
|                 v                                                    v                             |
|     +-----------------------+                            +-----------------------+                 |
|     | /data/snapshots.json  |                            |  Worker Engine (Runs) |                 |
|     |  (9 Recorded Runs)    |                            +-----+-----------+-----+                 |
|     +-----------------------+                                  |           |                       |
|                                                                |           v                       |
|                                                (Leases/Events) |   +-------------------+           |
|                                                                v   |  MongoDB (27017)  |           |
|                                                    +---------------+   (Models/Events) |           |
|                                                    |                   +-------------------+       |
|                                                    v                                               |
|                                         +------------------------------------+                     |
|                                         |  Lab Controller & PKI (18440-18445)|                     |
|                                         |  - Root CA A & Root CA B           |                     |
|                                         |  - Proxy Fault Injector (18440)    |                     |
|                                         +------------------+-----------------+                     |
|                                                            | (Management Plane)                    |
|                                                            v                                       |
|                                         +------------------------------------+                     |
|                                         |  Sample HTTPS Services             |                     |
|                                         |  gateway (8443) -> orders (8444)   |                     |
|                                         |                 -> ledger (8445)   |                     |
|                                         +------------------------------------+                     |
+----------------------------------------------------------------------------------------------------+
```

### 7.2 Data Plane vs. Management Plane
Strict network and architectural separation is maintained between the data plane and the management plane:
- **Data Plane (Ports 8443, 8444, 8445):** Live HTTPS services communicating via standard TLS handshakes. Each service validates incoming connections and initiates outbound HTTPS requests using strict hostname verification and its designated local trust bundle.
- **Management Plane (Ports 18440, 18443, 18444, 18445):** Administrative HTTP endpoints bound exclusively to `127.0.0.1`. These endpoints allow authorized profile reloads (`/reload-tls`), trust bundle modifications (`/update-trust`), and proxy fault toggling (`/fault`). All management calls require Bearer authorization and payload size limits.

### 7.3 Microservice Topology & Trust Hierarchy
```text
[Root CA A] (RSA-2048, SHA-256)           [Root CA B] (RSA-2048, SHA-256)
     |                                         |
     +--> gatewayA0 (8443)                     +--> gatewayB0
     +--> ordersA0  (8444)                     +--> ordersB0
     +--> ordersA1  (Renewed)                  +--> ledgerB0
     +--> ledgerA0  (8445)

Data Flow:
[Client / Probe] ===> gateway (8443) ===> orders (8444) ===> ledger (8445)
                       [Trust: A or A+B]   [Trust: A or A+B]   [Trust: A]
```

### 7.4 Architectural Tradeoffs & Decisions
1. **In-Process Node-Forge PKI vs. External Docker Step-CA:**
   - *Decision:* The V1 implementation utilizes an in-process, pure JavaScript PKI manager (`node-forge`) generating standard X.509 certificates and keys dynamically at startup.
   - *Rationale:* Eliminates external Docker daemon dependencies, host socket mounting risks, and complex container orchestration while ensuring 100% deterministic portability across Linux, macOS, and Windows developer machines.
2. **Server-Sent Events (SSE) vs. WebSockets:**
   - *Decision:* Server-Sent Events with persistent sequence replay (`Last-Event-ID`).
   - *Rationale:* Scenario execution is strictly a server-to-client telemetry stream. SSE avoids bidirectional socket overhead, operates over standard HTTP/1.1 proxies, and provides built-in reconnection semantics.

---

## 8. Low-Level Design (LLD)

### 8.1 Module & Source Structure
The project is organized into an npm multi-workspace repository:
- `backend/src/contracts/index.ts`: Shared Zod schemas, TypeScript types, and validation contracts.
- `backend/src/db/models.ts`: Mongoose database schemas and compound indexes.
- `backend/src/lab/ca.ts`: PKI manager, Root CA generation, and leaf signing.
- `backend/src/lab/controller.ts`: Administrative controller, profile switcher, and loopback proxy.
- `backend/src/lab/sampleServices.ts`: HTTPS microservices with atomic `setSecureContext()` reloads.
- `backend/src/lab/probe.ts`: Fresh-connection TLS probe implementation.
- `backend/src/worker/engine.ts`: Execution state machine, lease heartbeats, and scenario drivers.
- `backend/src/api/routes.ts`: Authenticated REST API and SSE streaming endpoints.
- `backend/src/api/snapshotAdapter.ts`: Static read-only snapshot router.
- `frontend/src/api/client.ts`: Dual-mode client handling live API requests and static fallback.
- `frontend/src/pages/`: Modular page views (Overview, Rehearsals, RunDetail, Compare, Report).

### 8.2 Execution Engine Sequence Diagram
```text
Operator          Express API           Worker Engine          Lab Controller       HTTPS Services
   |                   |                      |                      |                     |
   |-- POST /runs ---->|                      |                      |                     |
   |   (Idempotent)    |-- Create Run Job --->|                      |                     |
   |<-- 202 Queued ----|                      |                      |                     |
   |                   |                      |-- Acquire Lease ---->|                     |
   |                   |                      |   (Fence Token = N)  |                     |
   |-- GET /stream --->|                      |                      |                     |
   |   (SSE Connect)   |<-- Stream Events ----|-- Phase: Setup ----->|                     |
   |                   |                      |                      |-- Probe Handshake ->|
   |                   |                      |                      |<-- TLS Meta / Cert -|
   |                   |                      |-- Phase: Mutate ---->|                     |
   |                   |                      |   (Install A1)       |-- Update Profile -->|
   |                   |                      |                      |   (Disk Only)       |
   |                   |                      |-- Phase: Observe --->|                     |
   |                   |                      |   (Assert Mismatch)  |-- Probe Handshake ->|
   |                   |                      |                      |<-- Returns Old A0 --|
   |                   |                      |-- Phase: Reload ---->|                     |
   |                   |                      |                      |-- POST /reload-tls >|
   |                   |                      |                      |<-- 200 Context OK --|
   |                   |                      |-- Phase: Verify ---->|                     |
   |                   |                      |                      |-- Probe Handshake ->|
   |                   |                      |                      |<-- Returns New A1 --|
   |                   |                      |-- Phase: Recovery -->|                     |
   |                   |                      |   (Restore Baseline) |-- Reset Baseline -->|
   |                   |                      |-- Mark Completed --->|                     |
   |                   |<-- Terminal Event ---|                      |                     |
   |<-- Stream Close --|                      |                      |                     |
```

### 8.3 TLS Probe Sequence
The probe mechanism in `backend/src/lab/probe.ts` avoids connection pooling or socket reuse:
1. Opens a raw TCP socket to the target host and port.
2. Initiates a `tls.connect` handshake specifying explicit `servername` (SNI) and custom `ca` root bundle.
3. Enforces `rejectUnauthorized: true` to guarantee strict chain and SAN validation.
4. On `secureConnect`, extracts the peer certificate, computes the SHA-256 fingerprint of the raw DER bytes, extracts serial numbers and validity dates, and measures connection latency.
5. Immediately terminates the socket (`socket.destroy()`) and returns an immutable probe result object.

### 8.4 Database Entity-Relationship & Index Design
- **Runs Collection:** `(environmentId, createdAt)`, partial unique filter `(active: true, environmentId)` ensuring exactly one active execution per environment.
- **RunEvents Collection:** `(runId, seq)` unique compound index ensuring strictly ordered, monotonic event sequences without duplicates.
- **Leases Collection:** `(environmentId)` unique index with `expiresAt` timestamp and integer `fence`.
- **Sessions Collection:** `(expiresAt)` TTL index for automated session expiration.

### 8.5 State Machine Lifecycle & Error Handling
```text
[queued] ---> [preparing] ---> [running] ---> [recovering] ---> [completed] (Pass / Fail)
                                   |                ^
                                   | (Error/Cancel) |
                                   +----------------+
                                   |
                                   v
                             [interrupted] / [timed_out] -> (leaves needs_reset)
```

---

## 9. Security Architecture & Threat Model

### 9.1 Threat Model & STRIDE Analysis
| Threat Category | Potential Attack Vector | Applied Mitigation in TrustRehearsal |
| :--- | :--- | :--- |
| **Spoofing** | Attacker impersonates local operator to trigger unauthorized lab mutations. | Session cookies configured with `HttpOnly`, `SameSite=Strict`, local secret signing, and timing-safe token validation. |
| **Tampering** | Malicious injection of arbitrary target hosts or shell scripts. | Zero arbitrary target parameters. All target hosts, ports, and certificates are strictly seeded in code constants. |
| **Repudiation** | Operator denies initiating destructive scenario mutations. | Immutable event log with monotonic sequence numbers and caller actor IDs persisted in MongoDB. |
| **Information Disclosure**| Exposure of private keys or sensitive lab secrets in reports or browser. | Automated export sanitization scrub; private keys stored exclusively in memory/temporary lab directories. |
| **Denial of Service** | Flooding execution queue or starving environment leases. | Monotonic fencing token rejection; single active run constraint (HTTP 409 Conflict); bounded scenario timeouts. |
| **Elevation of Privilege**| Public viewer user attempts to execute live lab scenarios. | Complete code and route isolation: static snapshot adapter returns HTTP 403 `LIVE_DISABLED`; no worker exists in public distribution. |

### 9.2 Key Scrubbing & Export Redaction
The export utility (`backend/src/export/exportRuns.ts`) processes all recorded runs prior to public packaging:
- Scans all event payloads and assertion objects using regex filters matching `BEGIN (RSA )?PRIVATE KEY`.
- Sanitizes operator session identifiers, CSRF tokens, and internal file paths.
- Embeds the canonical report directly within the snapshot JSON to eliminate runtime synthesis.

---

## 10. User Interface & Evidence Presentation

### 10.1 Navigation & Information Hierarchy
The user interface adheres to a clean, restrained enterprise aesthetic utilizing a 208px fixed navigation rail:
- **Overview:** High-level operational dashboard displaying active mode, hero trust path, environment status, scenario catalog cards, and recent execution records.
- **Rehearsals Catalog:** Detailed catalog of available scenarios with phase descriptions, assertion targets, and execution controls (in operator mode).
- **Run Detail & Timeline:** Interactive execution explorer featuring real-time SSE event streaming, phase accordion disclosures, assertion outcome cards, and raw JSON inspectors.
- **Run Comparison:** Side-by-side run diffing tool aligning compatible runs to highlight timing deviations and assertion variance.
- **Report View:** Canonical audit report view with clean printable A4 styles (`@media print`) and JSON download capabilities.

### 10.2 Screenshots & Visual Evidence
*(Actual application screenshots captured from verified runs in the local execution lab)*
- **Figure 1: Application Overview:** Hero trust path and recent activity.
- **Figure 2: Environment Topology:** SVG dependency diagram (`gateway -> orders -> ledger`).
- **Figure 3: Rehearsal Plan & Assertions:** Scenario execution plan and assertion specifications.
- **Figure 4: Live Run Detail & SSE Timeline:** Live event stream, phase transitions, and assertion cards.
- **Figure 5: Canonical Report & Print Layout:** Validated report export with printable formatting.

---

## 11. Verification, Traceability & Acceptance

### 11.1 Requirement Traceability Matrix
| Requirement ID | Verifying Component / Suite | Evidence File / Test Name | Status |
| :--- | :--- | :--- | :---: |
| **FR-001** | `Navigation.tsx`, `client.ts` | `security-and-viewer.test.ts` (Mode enforcement) | Verified |
| **FR-002** | `probe.ts`, `ca.ts` | `tls-proof.test.ts` (Real socket handshakes) | Verified |
| **FR-003** | `engine.ts` (S01 driver) | `runs-and-api.test.ts` (S01 mismatch detection) | Verified |
| **FR-004** | `engine.ts`, `models.ts` | `R18` Regression Test (Persistence failure trap) | Verified |
| **FR-005** | `engine.ts`, `contracts/` | `contracts.test.ts` (Assertion event reference validation) | Verified |
| **FR-006** | `engine.ts`, `connection.ts` | `runs-and-api.test.ts` (Concurrent lease rejection) | Verified |
| **FR-007** | `engine.ts`, `reset-lab.ts` | `reset-lab.ts` baseline probe check | Verified |
| **FR-008** | `controller.ts`, `engine.ts` | `scenarios-s02-s03.test.ts`, `R17` (Proxy fault & auth) | Verified |
| **FR-009** | `engine.ts` (S03 driver) | `scenarios-s02-s03.test.ts`, `R16` (S03 dependency order) | Verified |
| **FR-010** | `engine.ts`, `routes.ts` | `runs-and-api.test.ts` (Cancellation handling) | Verified |
| **FR-011** | `client.ts`, `RunDetailPage.tsx`| `P1B` Static events query regression check | Verified |
| **FR-012** | `exportRuns.ts`, `ReportPage.tsx`| `contracts.test.ts` (Canonical report validation) | Verified |
| **FR-013** | `ComparePage.tsx` | Visual QA and snapshot compatibility checks | Verified |
| **FR-014** | `routes.ts`, `controller.ts` | `security-and-viewer.test.ts` (Auth & CSRF denial) | Verified |
| **FR-015** | `snapshotAdapter.ts`, `client.ts`| `test-public-viewer.ts` (Zero backend requirement) | Verified |
| **FR-016** | `client.ts`, `StatusChip.tsx` | `P1C` Empty snapshot truthful measurement test | Verified |

### 11.2 Historical vs. Current Independent Verification Results
- **Vitest Automated Suite:** 27 of 27 tests passing across 6 test suites (Contract schemas, TLS proof, Runs & API, S02/S03 scenarios, Security & Viewer, Review regressions).
- **Independent Review Harness (`recheck-16.cjs`):** 8 of 8 targeted defect checks passed:
  - Real certificate chain and authenticated management verified (HTTP 401 on missing token).
  - S03 final application probe strictly verified over Root B (HTTP 200; `ledger` confirmed on Root B).
  - S02 issuance fault traversed HTTP loopback proxy (HTTP 502 observed; data plane uninhibited).
  - Anonymous CA issuance rejected with HTTP 401.
  - Event persistence failure properly halts scenario execution without false pass.
  - API 503 outage truthfully surfaces `UNAVAILABLE` rather than silent fallback.
  - Static query string parsing correctly extracts `limit` and `afterSeq` parameters.
  - Empty evidence snapshots render 0 samples and `not_run` recovery without fabricated metrics.
- **External Public Viewer Verification Harness:** 117 assertions passed across the 9 canonical recorded runs. *(Note: This 117-assertion suite is an external independent review verification harness, not a bundled repository npm script).*

---

## 12. Risks, Limitations & Future Roadmap

### 12.1 Known Limitations of Current Implementation
- **Single-Host Loopback Lab:** All sample services run within a single Node.js process using distinct loopback ports rather than isolated container network namespaces.
- **Server-Authenticated TLS Only:** The lab exercises server-authenticated TLS; mutual TLS (mTLS) client certificates are not evaluated in V1.
- **Sampled Connection Windows:** Probes reflect periodic fresh connection samples (e.g., 5 to 30 handshakes) rather than high-throughput production load.

### 12.2 Future Roadmap (V2 & Beyond)
- **Multi-Node Containerized Lab:** Transition sample services into independent, resource-constrained OCI containers orchestrated via Docker Compose.
- **Post-Quantum Cryptography (PQC) Rehearsals:** Introduce hybrid classical/quantum certificates (e.g., ML-DSA / Dilithium) to evaluate handshake latency and MTU packet fragmentation across legacy clients.
- **Automated GitOps Integration:** Webhook triggers capable of rehearsing certificate changes within pull request preview environments before production deployment.

---

## 13. Glossary & References

### 13.1 Glossary of Terms
- **Certificate Authority (CA):** A trusted entity that issues X.509 digital certificates signing public keys.
- **Subject Alternative Name (SAN):** An X.509 extension specifying the hostnames, IP addresses, or URIs secured by the certificate.
- **Server Name Indication (SNI):** A TLS extension whereby the client indicates the specific hostname it is attempting to connect to at the start of the handshake.
- **SHA-256 Fingerprint:** The 64-character hexadecimal SHA-256 cryptographic digest of a certificate's raw DER-encoded bytes.
- **Fencing Token:** A monotonically increasing integer assigned to an execution lease to prevent stale or zombie processes from mutating state.
- **Dual Trust:** A transitional configuration where a TLS client trust store contains both the expiring Root CA and the new Target Root CA.
- **Negative Control:** An experimental phase intentionally designed to produce a failure (e.g., untrusted root rejection) to prove that verification controls are active and effective.

### 13.2 Authoritative References
- **RFC 5280:** Internet X.509 Public Key Infrastructure Certificate and Certificate Revocation List (CRL) Profile.
- **RFC 8446:** The Transport Layer Security (TLS) Protocol Version 1.3.
- **RFC 6125:** Representation and Verification of Domain-Based Application Service Identity within Internet Public Key Infrastructure.
- **NIST SP 800-52 Rev. 2:** Guidelines for the Selection, Configuration, and Use of Transport Layer Security (TLS) Implementations.
