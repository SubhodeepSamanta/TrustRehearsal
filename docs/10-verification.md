# Verification and release gates

## Test layers

Contracts/unit: Zod parsing, assertion evaluation from independent event samples, error categorization, report redaction, state transitions, timeout/cancel semantics, compatible comparison. Avoid snapshotting massive JSX trees.

Backend integration: real Mongo operations and indexes; duplicate starts; lease expiry/fence rejection; idempotency conflicts; session/CSRF; viewer-mode route denial; persisted SSE replay; worker crash recovery. Tests must exercise atomic operations rather than mocking every repository call.

TLS integration: actual lab certificates and Node handshakes. Validate S01 serving mismatch, S02 issuance failure with valid data-plane TLS, S03 rejection/dual-trust rollover, and final reset. Incorrect SAN and wrong root are meaningful negative tests. Control-plane success alone is insufficient.

Browser: visitor explores recorded evidence without login; operator runs S01; refresh reconstructs state; cancel shows cleanup; evidence filtering works; report downloads; incompatible compare prevented; mode labels survive navigation. Use backend integration where browser setup would duplicate the same test unnecessarily.

## Visual QA

Capture Overview, Run detail, Environment, Report at 1440x900; Run detail and navigation at 1280x800, 768px, 390px. Capture empty, failure, needs_reset and long-evidence states. Inspect screenshots, don't just save them. Record findings and fixes in PROGRESS. Check visible focus, keyboard traversal, dialog focus return, contrast, reduced motion, zoom 200%, table scrolling, and A4 print preview. Automated accessibility checks supplement manual keyboard/visual review.

## Evidence integrity checks

- Every passed assertion references real event IDs from its own run.
- Sample denominators equal stored probe records within explicit windows.
- Missing timestamps/fingerprints remain missing, not zero/default values.
- Report configuration identifies scenario/environment revisions and tool versions.
- Live reports cannot acquire recorded-example metrics via fallback.
- Public export includes no private key PEM, secret, cookie, credential-bearing URL, operator password, or unnecessary personal data.
- Expected negative-control failure is distinguished from failed execution.
- Interrupted runs cannot appear passed just because cleanup later succeeded.

## Release checklist

- [ ] Lockfile and supported tool versions documented.
- [ ] Clean setup tested on actual machine; platform recorded.
- [ ] S01/S02/S03 real repetitions meet gates.
- [ ] Worker crash, cancel, deadline and failed cleanup handled.
- [ ] Mutation/auth/CSRF/fence tests pass.
- [ ] Public artifact contains read-only data and no executor secrets.
- [ ] JSON reports validate and printable report is readable.
- [ ] Screenshots inspected across target widths and important states.
- [ ] No enabled dead controls, invented scores, or unlabeled fixtures.
- [ ] README/SRS/API reflect actual implementation.
- [ ] Known limitations and unsatisfied gates explicitly listed.
- [ ] No claims of production safety, certification, or company integration.

Future code should supply scripts such as npm run typecheck, npm run test, npm run test:integration, npm run test:e2e, npm run build, npm run lab:verify. These are target script names, not currently implemented commands. Update exact commands once code exists.
