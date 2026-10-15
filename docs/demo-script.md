# TrustRehearsal — 3-Minute Walkthrough Script

Measured execution timings from local laboratory runs.

---

### Segment 1: The Problem (0:00 – 0:30)
- **Visual**: Land on Overview (`http://localhost:5173`).
- **Narrative**:
  > *"Cryptographic changes have consequences beyond issuing a certificate. In production, a renewed certificate can be placed on disk while an application continues serving its previous certificate in memory. TrustRehearsal makes this failure mode visible in a representative environment before production."*
- **Callout**: Note the persistent `Live local lab` mode badge and environment readiness indicator.

---

### Segment 2: Scenario S01 Execution & Mismatch Detection (0:30 – 1:30)
- **Visual**: Open Rehearsal S01 detail, click `Start rehearsal`.
- **Observations**:
  - Baseline probes capture serving profile `A0` on `orders` (5 consecutive fresh handshakes, ~12ms each).
  - Controller issues `A1` and writes it atomically to disk.
  - Subsequent fresh TLS handshakes confirm `orders` is **still serving A0** in memory.
  - System evaluates assertion `A04_mismatch_detected` as **PASSED** — capturing the stale context without service downtime.

---

### Segment 3: Hot Reload & Recovery (1:30 – 2:15)
- **Visual**: Live event timeline streams `context_reloaded`.
- **Observations**:
  - `orders` updates its in-memory TLS context dynamically via loopback control plane without process termination.
  - Probes confirm `A1` fingerprint is now actively served on all fresh connections.
  - Recovery sequence safely resets baseline profile back to `A0` and verifies 5 fresh healthy handshakes.

---

### Segment 4: Scenarios S02 & S03 (2:15 – 2:45)
- **Visual**: Navigate to Runs history and compare S02 and S03.
- **Key Takeaways**:
  - **S02 (Issuance Path Outage)**: Proves that while renewal requests fail across an issuance proxy fault, existing valid service certificates continue serving traffic with 100% data-plane availability.
  - **S03 (Root Rollover)**: Highlights the negative control where an abrupt root replacement is strictly rejected by callers (`SELF_SIGNED_CERT_IN_CHAIN`), followed by a controlled dual-trust migration sequence.

---

### Segment 5: Evidence & Report Export (2:45 – 3:00)
- **Visual**: Open `/runs/:id/report`.
- **Output**:
  - Canonical JSON report export conforming to `ReportSchema`.
  - Clean printable A4 layout with methodology, sample counts, and complete event evidence references.
