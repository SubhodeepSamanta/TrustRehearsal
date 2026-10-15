# Release review prompt

Audit the implemented TrustRehearsal against docs/02-srs.md, 06-scenarios.md, 08-security.md and 10-verification.md. Start from current code and actual test evidence. Check the full user flow, report assertions, observed TLS data, redaction, public-mode route separation, lease/fencing, cancellation, worker interruption, reset and known limitations. Inspect screenshots as required by the design spec.

Find and fix concrete blockers within V1. Do not add features to improve apparent completeness. Do not accept fabricated metrics or mocked results as evidence of live behavior. Re-run the focused checks affected by fixes, then the required release checks once. Update documentation and PROGRESS with passed, failed, and unavailable checks separately. Produce a concise release-readiness report with the remaining gaps. Do not publish, create accounts, commit or contact anyone without a separate human instruction.
