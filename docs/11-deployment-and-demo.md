# Deployment runbook and presentation

## Current status

Planning only. No running app, test results, hosted URL, or video exists in this directory yet. Replace this section with measured implementation status as work progresses.

## Intended local setup

Prerequisites: supported Node 24 LTS/npm, Docker Engine or Docker Desktop configured for Linux containers, Compose v2, sufficient disk/memory, local ports. Check versions and Docker daemon readiness explicitly. On Windows, use Docker Desktop Linux containers; avoid scripts that assume a native Linux filesystem path unless executing inside the container/WSL. Do not modify the system trust store.

Phase 0 must establish these reproducible scripts: dependency install; generate local secrets; bootstrap lab; start local stack; wait for readiness; verify baseline; execute integration checks; stop stack. Store exact tested commands here. Prefer npm scripts that wrap cross-platform Node setup code and Compose, rather than Bash-only command sequences.

Secrets: operator password/hash and controller secret are generated locally. Keep .env and key volumes ignored. Supply .env.example with names and descriptions, no valid credentials. Separate PUBLIC_VIEWER and LOCAL_OPERATOR configuration; do not reuse local .env in a public build.

Reset: use authenticated application reset for the seeded environment. It removes faults, restores trust in safe sequence, reinstalls baseline profiles, and verifies real TLS. Deleting volumes is not the normal reset. Any destructive key-volume removal must be explicit and documented as destroying lab CA identity.

Troubleshooting: distinguish daemon unavailable, Mongo unreachable, controller authentication failure, CA bootstrap failure, SAN mismatch, certificate expiry, lease busy, and needs_reset. Keep full internal error in safe local logs and concise public UI message. A startup failure must not redirect silently to recorded data.

## Public viewer package

Build frontend with a validated, redacted export of selected recorded runs. Persistent provenance label; public routes read-only. No control-plane services required. Public hosting should support SPA route fallback and static asset caching with correct cache invalidation. Choose host and publish only when requested by human. No hosting provider is assumed here.

Link 'Explore recorded run', 'View evidence', 'Read methodology', and 'Download report'. Do not suggest a visitor can run real experiments. A future 'Watch walkthrough' link appears only when a real video exists. A repository link appears only when configured to an actual accessible repository.

## Three-minute walkthrough

0:00-0:20: 'A renewal can succeed while an application continues serving its old certificate. TrustRehearsal verifies the actual connection.' Show environment and provenance.

0:20-0:45: Show baseline served fingerprint and the scenario's expected observations. If recorded, say so; do not present playback as a live run.

0:45-1:30: Show A1 issuance/installation and independently observed A0 still served. Open one evidence event to show complete fingerprint and timestamp.

1:30-2:00: Reload TLS context. Show A1 served on fresh authenticated connections. Show sample denominators and recovery/reset result.

2:00-2:30: Show root-rollover negative control and controlled sequence in a completed run. Explain that expected authentication rejection can be a passing test.

2:30-3:00: Export report; show methodology and limitations. Describe possible implementation-validation/training use, not guaranteed market value.

Never invent actual durations for the script. Replace descriptions with observed values once measured. If execution takes longer than three minutes, edit the recording transparently or explore a completed run; do not manipulate the experiment clock.

## Follow-up draft: send only after working demonstration

Hi Puneet, I appreciated our conversation last month and your invitation to stay in touch. I've since built TrustRehearsal, a small platform that rehearses certificate and trust changes against a running sample application, shows what breaks, and verifies recovery.

The first scenario catches a renewal that succeeds on disk while the application still serves its previous certificate. Here's a short walkthrough: [actual link]. I thought this might be relevant to implementation validation or customer demonstrations, and I'd value your perspective on its practical usefulness.

Do not send placeholder links. Tailor timeline wording to actual date. The human sends the message; this pack does not authorize messaging Puneet.

## Reviewer deliverables

Working recorded viewer, runnable local lab, exact startup guide, updated SRS/architecture, versioned API contracts, real evidence report, test summary, known limitations, and concise walkthrough. No need for a large pitch deck or inflated financial ROI model.
