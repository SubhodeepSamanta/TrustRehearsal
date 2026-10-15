# TrustRehearsal Lab Architecture

The lab operates a sealed loopback topology representing microservices with strict mutual or server-authenticated TLS:

- **Gateway Service**: Port 8443 (HTTPS) / 18443 (Internal Control Plane)
- **Orders Service**: Port 8444 (HTTPS) / 18444 (Internal Control Plane)
- **Ledger Service**: Port 8445 (HTTPS) / 18445 (Internal Control Plane)

## Security Boundaries

- Node.js processes manage their own ephemeral cryptographic contexts.
- Controller communications are bound to loopback only (`127.0.0.1`) and never published to external networks.
- No mounting of the host Docker socket.
