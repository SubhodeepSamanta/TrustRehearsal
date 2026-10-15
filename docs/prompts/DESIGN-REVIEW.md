# Design implementation / refinement prompt

Review TrustRehearsal's interface against docs/03-user-flows.md and docs/07-design-system.md. Inspect current UI and existing evidence before changing code. Preserve working APIs and scenario semantics. Prioritize Overview, Run detail and Report, then apply the same system to the remaining screens.

Make the interface feel deliberately composed: restrained light palette, readable typography, generous negative space, consistent alignment, one primary action, subtle separators, a clear trust-path diagram, and an evidence-first run timeline. Avoid stock dashboard card grids, neon/glass effects, oversized decorative type, random charts and generic security imagery. Handle loading, unavailable, partial, stale, denied, cancelled and needs_reset states as carefully as the success state.

Use the project's existing screenshot/browser tooling if available. Capture and inspect the documented widths and meaningful states; check keyboard access, visible focus, 200% zoom, overflow, long fingerprints, mode labels and print layout. If browser inspection is unavailable, record that limitation rather than claiming visual QA. Fix concrete findings; do not redesign the entire product. Update docs/PROGRESS.md with evidence and remaining issues.
