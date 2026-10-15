# Product brief

## Thesis

Cryptographic changes have consequences beyond issuing a certificate. TrustRehearsal makes selected consequences observable in a representative lab, and records what was actually tested.

**One sentence:** TrustRehearsal rehearses certificate and trust changes against running applications, reveals failed connections, and verifies recovery.

**Business hypothesis:** a repeatable testbed may support customer demonstrations, implementation validation, and engineer training. These uses are hypotheses, not validated demand. Encryption Consulting already publishes closely related testing guidance and operates adjacent products. We are building a useful engineering work sample, not asserting they have missed this problem.

## Audience

- Visitor: Puneet, an engineering reviewer, recruiter, or prospective collaborator. Wants to grasp the value in 60 seconds and inspect the proof in 5 minutes.
- Operator: project owner running controlled experiments. Wants repeatability, trustworthy observations, and recovery.
- Technical reviewer: wants source code, a reproducible environment, acceptance criteria, and explicit limitations.

## V1 scope

One seeded sample environment, three sample services, two lab issuers/trust roots, three scenarios, one active run per environment, evidence explorer, comparison, and an exportable JSON/printable report. Local operator and public recorded-result modes are separate deployment configurations.

Scenario S01: a renewed certificate is on disk while the application still serves its previous certificate; detect mismatch, reload, verify correction.

Scenario S02: certificate issuance/renewal requests fail through a controlled proxy; verify failure detection while currently valid service certificates continue working; restore and verify renewal. This is an issuance-path outage, not a claim that a CA process or regional infrastructure failed.

Scenario S03: compare abrupt root replacement with a controlled dual-trust rollover. Show an expected connection failure and then a safe sequence for the sample topology.

## Non-goals

Production scanning, replacing CLM/CA products, universal crypto discovery, PQC readiness scores, arbitrary uploaded projects, agent autonomy, multi-tenancy, billing, full HSM recovery, CRL/OCSP infrastructure, signed compliance attestations, automated remediation of customer systems, and broad algorithm migrations.

PQC and agent-authorization experiments are separate future proposals. A successful root rollover does not prove PQC migration readiness.

## Success criteria

- A visitor understands the problem and inspects a real or clearly marked recorded run without login.
- A local operator completes S01 end-to-end with independently captured TLS fingerprints.
- All three scenario outcomes reproduce across three clean local executions, with actual run records retained during verification.
- Every headline result links to evidence and a defined assertion.
- Recovery and reset are explicit. Failed cleanup blocks the environment until reset succeeds.
- No application private key or privileged lab credential is exposed to browser/public report.
- Live operations cannot be enabled by a request parameter or frontend setting.

## Claims language

Use: 'Observed 0 failed fresh connections across 30 samples in this lab.'

Avoid: 'Zero downtime guaranteed', 'quantum safe', 'FIPS compliant', 'unhackable', 'production validated', and 'tamper-proof'.

Use public company sources only for motivation. Use neutral 'issuer adapter' language; no CertSecure logo or integration claim. Outreach should link to a working demo only after release checks.
