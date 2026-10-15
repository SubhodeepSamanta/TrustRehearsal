# Design direction: quiet engineering precision

## Desired impression

An instrument for examining a consequential change: open, composed, precise, and readable. The work should feel deliberately designed rather than assembled from default dashboard components. The principal visual material is the trust path, event sequence, and evidence. There is no stock photo or generative illustration requirement.

## Layout and tokens

Light theme only for V1. Warm neutral canvas, white working surfaces, deep charcoal typography, restrained blue interaction color.

```css
:root {
  --canvas: #f7f8fa;
  --surface: #ffffff;
  --surface-muted: #f1f3f5;
  --ink: #182126;
  --ink-secondary: #52616b;
  --ink-muted: #61707a;
  --line: #dfe4e8;
  --accent: #2457c5;
  --accent-soft: #edf2ff;
  --success: #176247;
  --success-soft: #eaf5ef;
  --warning: #80520a;
  --warning-soft: #fff5dd;
  --danger: #a33030;
  --danger-soft: #fceeee;
  --radius-sm: 6px;
  --radius-md: 10px;
  --shadow-popover: 0 8px 28px rgb(24 33 38 / .10);
}
```

Verify actual foreground/background contrast in implementation, especially muted text and status chips. Never use color as sole status indicator.

Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64px. Left navigation width 208px. Desktop content padding 40px; 24px tablet; 16px mobile. Main content max width 1440px, centered within available area. Use 12 columns with 24px gaps; do not force every block into a card. Header height 72px, primary controls 40px high, dense table row 48-56px. Give primary page content space before lower sections.

Typography: self-host one neutral sans such as Inter if available with appropriate license, otherwise system UI. Use system monospace for serials/fingerprints, not whole paragraphs. Page title 30/38px weight 550-600; section title 18/26px 600; body 14/22px; labels 12/18px weight 500; table values 13/20px. Avoid excessively tight tracking. Tabular numerals for timings. Long certificate fingerprints wrap or scroll in details without breaking page width.

## Composition

Overview should feel like a deliberate workspace, not a SaaS template. Start with a short heading, one supporting sentence, one primary action. Main content is a large trust-path diagram with a quiet observation panel. Scenario choices are ordered rows with concise descriptions. Recent activity is a table.

Run view: headline and phase state above a strong timeline, with assertions in the adjacent column. Use alignment, thin separators, and whitespace to create hierarchy. No giant animated health ring, neon chart, floating glass panel, gradient headline, or stock shield/lock mascot.

## Components

- Navigation: small wordmark 'TrustRehearsal', subtle active background and 2px accent mark; icons 18px, stroke 1.5-1.75.
- Buttons: primary solid accent, secondary white with border, tertiary text. One main primary action per screen region. Disabled state includes reason when useful.
- Status: compact labeled chip, 6px dot optional. Service 'Rejected' can coexist with assertion 'Passed as expected'.
- Tables: aligned text, small uppercase headers only if readable, fine row separators, no zebra unless scanability benefits. Entire row may navigate if semantics and keyboard behavior are clear.
- Timeline: phase names, actual relative time, one observation sentence, disclosure to raw evidence. Do not animate replay as if it were a live run.
- Diagram: SVG or CSS/SVG hybrid with three named nodes and labeled directed edges. Use native layout for this small fixed topology, not a heavy graph dependency. Node selection syncs details and accessible edge table.
- Evidence panel: summary, source, timestamp, event ID, full fingerprint, raw JSON disclosure, copy control with announcement.
- Dialogs: use accessible primitive; focus trap/return, Escape close when safe, clear action wording.
- Toasts: noncritical transient confirmations only. Failures and recovery problems remain inline.
- Empty states: textual guidance and one relevant action. No decorative illustration needed.

## Motion

120-180ms opacity/color/focus transitions. No bouncing counts, mouse-following effects, parallax, continuous particle animations, or typewriter text. Honor prefers-reduced-motion. A small progress indicator may denote ongoing work; progress percentage must not be invented from elapsed time.

## Responsive behavior

At <=1024px, side details stack below main content. At <=768px, collapse rail into an accessible compact menu; keep mode visible. At 390px, stack diagram nodes, make evidence controls wrap, and scroll wide tables inside their own region. No document-level horizontal scrolling.

## Quality bar

Review screenshots at 1440x900, 1280x800, 768px, and 390px. Check visible focus, long identifiers, multiple-line errors, no-data state, running state, partial evidence, and needs_reset. Check 200% browser zoom. Use realistic certificate labels and timestamps; never lorem ipsum or marketing filler. Charts must answer a real measurement question; V1 may ship without a chart library.

Build polished versions of Overview, Run detail, and Report first. Derive other screens from the same tokens/components. Do not spend a whole phase on a landing page while the actual run view remains unfinished.
