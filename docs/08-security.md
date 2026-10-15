# Security boundaries and threat model

## Assets and actors

Assets: host integrity, lab CA/leaf private keys, controller authority, operator session, evidence accuracy, public visitor safety. Actors: anonymous visitor, authenticated operator, API, worker, lab controller, sample services. Compromise of the worker/controller is privileged within the lab; do not imply container isolation makes it harmless.

## Required boundaries

1. Public host contains only redacted recorded evidence and read-only code. No Docker access, execution service, CA keys, controller secrets, or live run mutations.
2. Local operator API has authenticated state-changing operations. A request cannot override deployment mode.
3. API never starts host processes. Worker calls predefined controller operations on fixed internal destinations.
4. Controller management plane is internal-only and authenticated. Sample service public/data routes cannot invoke management operations.
5. Probe targets come exclusively from seeded server configuration. No arbitrary IP/domain/port inputs, uploaded Compose files, scripts, certificate-key uploads, or executable attachments in V1.

## Specific controls

- Operator credential from a local secret, stored/verified with a maintained password-hashing implementation; no committed default password. Password bootstrap instructions required.
- Opaque server-side session; HttpOnly cookie; SameSite strict; Secure on HTTPS. Local HTTP exception limited to loopback development and documented. Never put authority-bearing JWT/session in localStorage.
- State changes require same-origin checks and CSRF token. CORS allowlist exact configured origin; no wildcard with credentials. GET is side-effect free.
- Login throttling and generic failures. Limit mutation rate and body size. Headers/CSP compatible with actual frontend; no inline executable report scripts.
- Worker and management secrets are deployment-generated, never VITE_ environment variables. Redact authorization/cookies/password/private key PEM in logs and report serializers.
- Separate CA/leaf volumes; restrict key files; no CA private key mount in API/web/worker. Public certificate metadata is okay; private material is not.
- No mount of host Docker socket, privileged containers, host networking, broad host bind mounts, or publicly exposed MongoDB/CA/controller ports. Use resource limits, non-root containers where supported, dropped capabilities, and pinned images. Document any required exception.
- Enforce strict TLS hostname and chain validation. Never set NODE_TLS_REJECT_UNAUTHORIZED=0. An expected authentication failure is evidence, not a reason to bypass verification.
- Lease/fence/idempotency on mutations. Validate ownership again immediately before each action; reject stale fence at controller.
- Reports escape untrusted labels; safe Content-Disposition; no executable HTML from event strings. Snapshot loading validates schema and redaction.
- Originated timestamps and hashes do not by themselves prove non-repudiation. Evidence is inspectable application output, not a certified audit trail.

## Abuse/failure cases to test

Anonymous POST; public deployment POST; CSRF; wrong controller secret; stale fence; duplicate start; duplicate operation; arbitrary hostname/path injection; long request body; worker crash during fault; API restart during streaming; cancellation during reload; report label containing HTML; private-key marker in serialized content. Verification must establish actual boundary enforcement, not only UI hiding.

## Operational scope

Experiments run only against project-owned sample services. Do not revisit or scan Encryption Consulting infrastructure. Public visitor mode can be deployed later after human asks; deployment credentials and hosting selection are not part of this planning task.

Before any live remote lab release, design per-session isolation, quotas, hardened management, abuse handling, and cost controls separately. This is explicitly outside V1.
