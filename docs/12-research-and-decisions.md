# Research, decisions, and limitations

Research checked 15 October 2026. Public pages are vendor statements or technical guidance, not independent verification of deployed product behavior. Internal Encryption Consulting roadmap and willingness to hire/buy are unknown. Project name availability is unchecked.

## Relevant evidence

1. Encryption Consulting already offers certificate lifecycle, CBOM, code signing, PKI/HSM services and adjacent capabilities: https://www.encryptionconsulting.com/
2. Puneet is quoted discussing shorter certificate cycles and F5 automation: https://www.encryptionconsulting.com/encryption-consulting-teams-with-f5-to-deliver-zero-touch-clm/
3. Company guidance emphasizes testing actual recovery: https://www.encryptionconsulting.com/pkiaas-disaster-recovery-ciso-questions/
4. Very close conceptual overlap exists in a staging article about verifying actual certificate deployment: https://staging.encryptionconsulting.com/trust-but-verify-certificate-deployment/ . Staging publication is weaker evidence of a released offering. Do not access private/test systems to investigate further.
5. PQC performance testing is also discussed: https://www.encryptionconsulting.com/pqc-tls-performance-testing-lab-plan/
6. CBOM V1.1 describes inventory, risk, AI/MCP foundations and deployment: https://www.encryptionconsulting.com/cbom-secure-v1-1/
7. Existing AI-agent authorization direction: https://www.encryptionconsulting.com/agent-to-tool-authorization/ and https://www.encryptionconsulting.com/certsecure-mcp-server-agentic-ai-clm/
8. Vendor-evidence workbench remains an alternative, motivated by: https://www.encryptionconsulting.com/pqc-vendor-readiness-questionnaire/

## Standards and implementation references

- Current CA/Browser Forum public TLS requirements, section 6.3.2: https://cabforum.org/working-groups/server/baseline-requirements/requirements/ . Current schedule checked: 200-day maximum for issuance from 15 March 2026; 100 from 15 March 2027; 47 from 15 March 2029. These are public TLS requirements, not universal private-CA policy.
- NIST crypto-agility guidance: https://csrc.nist.gov/Projects/crypto-agility/publications . Transition must preserve security and operations. Consult current publication status instead of relying on old draft summaries.
- Trust-bundle rollover pitfalls and overlap: https://cert-manager.io/docs/trust/trust-manager/
- Smallstep renewal reference: https://smallstep.com/docs/step-cli/reference/ca/renew/ . Verify min certificate lifetime/profile controls against pinned version. CLI reload examples in docs are not a license to accept user shell commands.
- Node release status: https://nodejs.org/en/blog/release . Node 24 LTS selected for plan; pin maintained compatible patch during implementation.
- Docker daemon security: https://docs.docker.com/engine/security/ and https://docs.docker.com/engine/security/protect-access/ . Avoid socket access in application components.
- OQS experimental interoperability: https://test.openquantumsafe.org/ . Useful future reference; experimental combinations must not be presented as production-certified support.

## Architectural decisions

ADR01: MERN plus TypeScript fits builder skills; add minimal separate worker/lab components because browser alone cannot prove TLS deployment behavior.

ADR02: Fixed Compose lab and explicit control API instead of Docker socket orchestration. Reduces host authority and scope. This is a controlled lab, not an arbitrary environment platform.

ADR03: Local operator plus public read-only export. Keeps public experience easy to review and avoids unauthenticated mutation/cost/tenant isolation complexity.

ADR04: Mongo jobs/leases instead of Redis. Adequate for one environment and one active run, provided actual atomic indexes, fencing and crash recovery are tested.

ADR05: JSON plus printable HTML report instead of server PDF generation. Preserves inspectable evidence with smaller dependency footprint.

ADR06: Certificate/trust changes before PQC. Establishes real repeatable behavior without promising unsupported library interoperability.

ADR07: No LLM in V1. Assertions are deterministic; AI-generated explanations are unnecessary to establish evidence.

ADR08: Restrained light interface and evidence-first layout. No decorative security imagery or default dashboard composition.

## Open implementation questions

- Does selected step-ca profile support a practical local test lifetime? Choose enough lifetime for full run and recovery, not fastest possible expiry.
- Can all TLS contexts reload predictably on chosen Node version? Phase 1 proves it before UI investment.
- Which images/tool versions are compatible on the actual Windows Docker environment? Record tested values.
- How much reliable memory/disk is available? Keep fixed small topology; optimize only if measured.

## Revisit only with evidence

PQC, mTLS workload identity, external CA adapters, CRL/OCSP, human approvals, arbitrary environment onboarding, cloud execution, signed third-party attestations, and multi-tenancy need separate requirements and tests. Do not append them during a V1 phase simply because they sound impressive.
