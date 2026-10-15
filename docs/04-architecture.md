# Architecture and implementation decisions

## Stack

Node.js 24 LTS; TypeScript; npm workspaces; React with Vite; React Router; TanStack Query for server state; Express; Zod at boundaries; MongoDB with Mongoose; Vitest; Playwright. Use ordinary CSS with tokens and CSS modules. Lucide icons are optional; choose one consistent set. Accessible headless primitives may be used for dialog/menu/tabs only. Avoid installing a complete dashboard template.

Select exact compatible maintained versions during phase 0 and commit package-lock.json. No package versions are assumed by these docs other than the Node major. Verify package engine requirements before installing. No Next.js, microservice mesh, GraphQL, Redis queue, Kubernetes, or external AI API is needed.

## Components

- web: public interface; calls read API and local operator API when configured.
- api: validates requests, enforces mode/session/CSRF, creates run records, serves persisted events and reports. No process/container execution.
- worker: acquires environment lease, advances state machine, calls fixed controller operations, probes TLS, writes evidence and assertions. It is the only run executor.
- lab-controller: internal authenticated allowlisted operations for the seeded lab: choose named certificate/trust profiles, reload a service context, toggle issuance proxy fault, reset/inspect state. No arbitrary paths, URLs, code, or commands.
- issuer-a / issuer-b: step-ca lab roots/issuers, configured for lab-only certificate profiles. Bootstrap is explicit and idempotent. Issuer passwords/private keys stay in protected local volumes/secrets.
- issuance-proxy: private controllable relay for a fixed issuer endpoint; reject/allow requests with structured events. This is the S02 fault boundary.
- gateway / orders / ledger: simple Node HTTPS sample services. Trust and TLS contexts can be reloaded only via internal authenticated management endpoints. A real sample request travels gateway -> orders -> ledger. Requests on new connections use the configured trust bundle and hostname validation.
- mongodb: durable metadata, leases, event stream and sessions. Never a key store.

## Avoid Docker socket access

Compose starts a fixed lab topology. The worker does not dynamically create containers or need the Docker socket. Faults operate through fixed internal controller APIs. Separate management listeners from TLS data-plane listeners. Only frontend/API bind host ports; use loopback bindings locally. Controller, CA, management ports, and MongoDB are not published.

Controller operations and management requests use a random deployment secret, timing-safe validation, bounded bodies, and fixed enums. Never expose that secret in web build variables or read API responses. Run IDs, fencing token, and operation IDs accompany mutations. Controller tracks last accepted fencing token for environment and rejects stale tokens. Log operation metadata, not secrets.

Persist the highest accepted fence and operation journal in a controller-owned state volume so restart cannot revive stale authority. An operation record transitions accepted -> applied/failed; on an unknown result inspect installed/served state before deciding what to do. Issuance uses a stable operation-specific artifact location: reuse the already-created profile on retry rather than issuing a new identity silently. Fail closed on corrupted/missing journal after prior initialization until an explicit baseline reset reconciles it.

## Baseline topology

gateway -> orders -> ledger, all using server-authenticated TLS with strict hostname/chain validation. V1 does not claim universal mTLS. Each caller trusts root A; sample services initially present A-issued certificates. Root B exists for rollover. Cert SANs are fixed Compose service names. Diagram edges are configured, not discovered.

Profiles A0, A1, B0 are concrete issued leaf certificates with unique keys/serials. A1 differs from A0; trust stays A. Keep private keys outside DB/API. The controller switches installed profile references, and an explicit reload step updates the actual serving context. Persist both configured and observed metadata.

Prefer service-owned volumes and controlled profile installation over sharing CA keys with worker. The CA adapter may invoke a pinned step CLI using execFile with fixed arguments in the trusted lab component; no shell strings or request-provided paths. Document actual bootstrap commands after implementation.

## Repository target

apps/web, apps/api, apps/worker, packages/contracts, packages/scenarios, lab/controller, lab/services, lab/compose.yaml, lab/bootstrap, tests/integration, tests/e2e, docs, scripts, .env.example. Structure may be simplified if boundaries stay explicit. Keep shared contracts free of server secrets.

## Job and event strategy

Use MongoDB-backed jobs and a separate environment lease document. Seed one environment lock document. Atomic findOneAndUpdate with expiry grants a lease and increments fence. Heartbeat every 5s; lease duration 20s by default. Recheck fence before each mutation, and enforce fence at controller. A partial unique index on environmentId for active=true run records prevents duplicate active jobs. Define recovery for crashes between reservation and run insert; idempotency key maps retries to original run.

Worker loss: mark prior active run interrupted after expired lease; new worker obtains a higher fence, resets baseline, then clears active. Never resume a half-executed fault blindly. Controller operations serialized per environment, with operation IDs making retry results recoverable. Unknown operation outcome triggers inspect/reset, not blind repetition.

Persist event before exposing it. SSE is a delivery mechanism, not source of truth. Read API can poll if SSE is unavailable. Terminal state emitted only after recovery result persists.

## Deployment modes

LOCAL_OPERATOR: full Compose lab, authenticated control enabled by server environment variable.

PUBLIC_VIEWER: web plus a read-only snapshot adapter or read API. No worker, issuers, controller, sessions, management secrets, or mutation routes. Use same runtime-validated report contracts. A missing backend never silently enables a fixture adapter.

V1 live lab is single-operator/local. Public concurrent lab execution requires a new isolation design and is deferred.
