# TrustRehearsal

**Rehearse cryptographic change. See what breaks before production.**

TrustRehearsal executes bounded certificate and trust-change experiments against running applications, measures actual TLS behavior across fresh handshakes, explains observed failures, and exports inspectable evidence.

---

## Architecture & Project Structure

The project is cleanly structured into two primary workspace folders:

- **`frontend/`**: Complete React web application powered by Vite and TypeScript.
  - Quiet engineering precision design system (`docs/07-design-system.md`).
  - Interactive topology diagram with live serving and installed certificate profiles.
  - Real-time Server-Sent Events (SSE) execution timeline with raw JSON disclosures.
  - Verification assertions linking to real evidence event IDs.
  - Printable A4 reports and JSON export.
  - Side-by-side run comparison with provenance indicators.
- **`backend/`**: Node.js and Express API server with durable run worker.
  - **`src/contracts/`**: Zod schemas and TypeScript types for all models, probes, and reports.
  - **`src/lab/`**: PKI manager generating Root CAs A and B, leaf certificates with SANs, live HTTPS sample services (`gateway`, `orders`, `ledger`), and strict TLS probe.
  - **`src/worker/`**: Worker execution engine managing atomic leases with monotonic fencing tokens, heartbeat timers, and S01, S02, S03 scenario state machines.
  - **`src/db/`**: MongoDB persistence with Mongoose models, partial unique indexes preventing concurrent runs, and TTL sessions.
  - **`src/api/`**: REST API routes, CSRF and session management, and read-only snapshot router for viewer mode.
  - **`src/export/`**: Sanitized snapshot exporter ensuring zero private keys or secrets in public builds.

---

## Operating Modes

1. **`LOCAL_OPERATOR`**: Full local lab with live execution worker, authenticated operator control, and dynamic context reloading.
2. **`PUBLIC_VIEWER`**: Read-only distribution backed by sanitized recorded runs from real lab executions. All mutation endpoints return `403 LIVE_DISABLED`.

---

## Getting Started

### Prerequisites

- Node.js 22 LTS or newer
- npm 11 or newer
- MongoDB running locally on `127.0.0.1:27017` (or configured via `MONGODB_URI`)

### Setup

```bash
# Clone and enter the workspace
cd TrustRehearsal

# Install dependencies for both frontend and backend
npm install

# Copy environment variables
cp .env.example .env
```

### Running Locally

```bash
# Start backend API (runs on http://127.0.0.1:4000)
npm run dev:backend

# Start frontend application (runs on http://127.0.0.1:5173)
npm run dev:frontend
```

### Operator Credentials

- **Default Password**: `operator-rehearsal-2026`
- Operator authentication is required for state-changing actions (starting rehearsals, baseline reset, cancellation).

### Service Ports

- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:4000`
- **Gateway Service (HTTPS)**: `https://127.0.0.1:8443`
- **Orders Service (HTTPS)**: `https://127.0.0.1:8444`
- **Ledger Service (HTTPS)**: `https://127.0.0.1:8445`
- **Management Ports (Internal Loopback)**: `18443`, `18444`, `18445`

---

## Verification & Tests

```bash
# Typecheck both frontend and backend
npm run typecheck

# Run complete test suite (contracts, TLS proof, scenarios S01-S03, security)
npm run test

# Production build
npm run build
```

---

## Scenarios Proven

1. **S01 — Renewal without application reload**: Proves the distinction between disk certificate renewal and active serving TLS context. Detects mismatch and verifies hot reload without process restart.
2. **S02 — Issuance-path unavailability**: Simulates CA network partition via controlled proxy; proves currently valid certificates continue authenticating without disruption, and restores renewal.
3. **S03 — Trust-root rollover**: Demonstrates abrupt root replacement failure (strict negative control) and proves a safe dual-trust staged rollover sequence.

---

## Honest Claims

- Observations reflect explicit sampled windows in the local lab environment.
- Phrase used: *"Observed 0 failed fresh connections across 30 samples in this lab."*
- TrustRehearsal is an independent engineering portfolio project. No production safety guarantee, compliance certification, or external company integration is claimed.
