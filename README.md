# TrustRehearsal

**Rehearse cryptographic change. See what breaks before production.**

Planning pack prepared 15 October 2026. This directory contains the implementation specification, not a working application. No runtime, deployment, or company integration is claimed.

TrustRehearsal will execute bounded certificate and trust-change experiments against a local sample application, measure actual TLS behavior, and export inspectable evidence. It is an independent portfolio project intended to demonstrate product and engineering judgment to Puneet Singh at Encryption Consulting.

## Start here

1. Read [Product brief](docs/01-product-brief.md) and [Build plan](docs/09-build-plan.md).
2. Open this project directory in the coding tool using your chosen Luna or Terra model.
3. Paste [Start prompt](docs/prompts/START-HERE.md). It asks for phase 0 only.
4. Use [Continuation prompt](docs/prompts/CONTINUE.md) for each subsequent phase.
5. Keep [Progress](docs/PROGRESS.md) current. Resume from it instead of replanning.

## Specification map

| Document | Purpose |
|---|---|
| [01 Product brief](docs/01-product-brief.md) | Positioning, audience, scope, honest claims |
| [02 SRS](docs/02-srs.md) | Requirements and acceptance criteria |
| [03 User flows](docs/03-user-flows.md) | Final visitor/operator experience and screen states |
| [04 Architecture](docs/04-architecture.md) | Runtime boundaries, stack, repository structure |
| [05 Data and API](docs/05-data-and-api.md) | Models, contracts, concurrency, events |
| [06 Scenario specifications](docs/06-scenarios.md) | Reproducible experiments and independent assertions |
| [07 Design system](docs/07-design-system.md) | Visual direction and component rules |
| [08 Security](docs/08-security.md) | Threat model, isolation, abuse controls |
| [09 Build plan](docs/09-build-plan.md) | Ordered phases, checks, stop conditions |
| [10 Verification](docs/10-verification.md) | Tests, screenshots, release gates |
| [11 Deployment and demo](docs/11-deployment-and-demo.md) | Operating modes, runbook, walkthrough, outreach |
| [12 Research and decisions](docs/12-research-and-decisions.md) | Evidence, overlap, sources, deferred work |
| [Progress](docs/PROGRESS.md) | Durable implementation handoff |

## Constraints

- TypeScript throughout. React frontend, Express API, MongoDB, separate Node worker and lab services.
- Real TLS evidence is the product. Interface polish cannot substitute for it.
- Version 1 uses lab certificates and sample services only. No third-party scanning.
- No LLM API dependency, paid services, Kubernetes, Redis, or production PKI integration in version 1.
- Public deployment is read-only. Live mutation is operator-only and disabled by default.
- Do not present this as an Encryption Consulting product, an established market gap, a compliance certification, or proof of production safety.
- TrustRehearsal is a working name; name and trademark clearance have not been completed.

See AGENTS.md for implementation instructions. Do not automatically create a new chat, change models, publish the site, or contact anyone.
