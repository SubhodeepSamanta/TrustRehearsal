# Implementation instructions

## Authority and scope

The human requested a complete plan for Luna/Terra to implement. This checkout currently contains planning only. On a coding request, follow the docs and complete the requested phase. Do not infer permission to publish, buy infrastructure, send messages, or access Encryption Consulting systems.

## Reading order

Read README.md, docs/PROGRESS.md, docs/01-product-brief.md, and the current phase in docs/09-build-plan.md. Then read only the relevant technical/design documents. Read docs/08-security.md before implementing backend/worker/lab changes. All docs are one coherent specification; the security constraints override convenience examples.

## Working rules

- Work in this directory; do not modify the older Encryption 2 workspace.
- Follow one build phase per invocation unless the human explicitly requests more.
- Inspect existing code before writing. Never replace functioning implementation merely to match an illustrative folder name.
- No subagents unless the human explicitly requests them. Keep tool output short and batch independent inspections.
- Choose exact compatible dependency versions during phase 0, save a lockfile, and reuse them. Do not repeatedly research package choices.
- Build the TLS proof before the full dashboard. Never use random timers, invented metrics, or static fixtures as live results.
- Recorded fixtures must carry a persistent 'Recorded example' label; they do not establish that local tests passed.
- No arbitrary command execution, arbitrary target URLs, browser-supplied paths, Docker socket mounting, public lab control routes, private keys in MongoDB, or global TLS verification bypasses.
- No TODO routes that return success, no silent runtime fallback to fixtures, no unimplemented controls that appear enabled.
- Use clear UI wording, semantic HTML, keyboard access, and all state treatments in the design spec.
- Run checks appropriate to the phase. If a dependency is unavailable, implement what is possible and record the exact verification limitation. Do not report blocked tests as passed.
- A scenario pass can include an expected TLS failure; distinguish test outcome from service health.
- Before ending, update docs/PROGRESS.md with changed files, commands/results, decisions, limitations, and next action. Mention any deviation and its reason.

## Definition of finished

See docs/10-verification.md. A pretty screenshot is not completion. A running backend is not completion. Required workflows, evidence, security boundaries, documentation, and visual QA must all be checked. Avoid claiming production readiness.
