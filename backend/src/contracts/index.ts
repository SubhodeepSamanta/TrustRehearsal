import { z } from 'zod';

// Mode & Provenance
export const DeploymentModeSchema = z.enum(['LOCAL_OPERATOR', 'PUBLIC_VIEWER']);
export type DeploymentMode = z.infer<typeof DeploymentModeSchema>;

export const ProvenanceSchema = z.enum(['live_lab', 'recorded_example']);
export type Provenance = z.infer<typeof ProvenanceSchema>;

// Environment & Topology
export const ServiceRoleSchema = z.enum(['gateway', 'orders', 'ledger']);
export type ServiceRole = z.infer<typeof ServiceRoleSchema>;

export const ServiceNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: ServiceRoleSchema,
  port: z.number(),
  managementPort: z.number().optional(),
  configuredIssuer: z.string(), // e.g. "issuer-a", "issuer-b"
  installedProfile: z.string(), // e.g. "A0", "A1", "B0"
  servingFingerprint: z.string().nullable().optional(),
  status: z.enum(['healthy', 'degraded', 'offline', 'unknown']).default('unknown'),
  lastCheckedAt: z.string().datetime().nullable().optional()
});
export type ServiceNode = z.infer<typeof ServiceNodeSchema>;

export const TopologyEdgeSchema = z.object({
  id: z.string(),
  caller: z.string(),
  callee: z.string(),
  servername: z.string(),
  expectedTrustProfile: z.string(), // e.g. "root-a", "root-a-and-b", "root-b"
  lastProbeSuccess: z.boolean().nullable().optional(),
  lastHandshakeAt: z.string().datetime().nullable().optional()
});
export type TopologyEdge = z.infer<typeof TopologyEdgeSchema>;

export const EnvironmentStateSchema = z.enum(['ready', 'reserved', 'needs_reset', 'offline']);
export type EnvironmentState = z.infer<typeof EnvironmentStateSchema>;

export const EnvironmentSchema = z.object({
  id: z.string(),
  revision: z.string(),
  label: z.string(),
  state: EnvironmentStateSchema,
  services: z.array(ServiceNodeSchema),
  edges: z.array(TopologyEdgeSchema),
  baselineProfile: z.string(),
  lastVerifiedAt: z.string().datetime().nullable().optional(),
  activeRunId: z.string().nullable().optional()
});
export type Environment = z.infer<typeof EnvironmentSchema>;

// Scenario Definitions
export const ScenarioIdSchema = z.enum(['S01', 'S02', 'S03']);
export type ScenarioId = z.infer<typeof ScenarioIdSchema>;

export const ScenarioPhaseDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  isMutation: z.boolean().default(false)
});
export type ScenarioPhaseDef = z.infer<typeof ScenarioPhaseDefSchema>;

export const AssertionDefSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  expectedOutcome: z.enum(['pass', 'fail'])
});
export type AssertionDef = z.infer<typeof AssertionDefSchema>;

export const ScenarioSchema = z.object({
  id: ScenarioIdSchema,
  version: z.string(),
  label: z.string(),
  description: z.string(),
  expectedFaults: z.array(z.string()),
  phaseDefinitions: z.array(ScenarioPhaseDefSchema),
  assertionDefinitions: z.array(AssertionDefSchema),
  maxDurationMs: z.number().nonnegative()
});
export type Scenario = z.infer<typeof ScenarioSchema>;

// TLS Probe
export const TlsProbeDataSchema = z.object({
  caller: z.string(),
  callee: z.string(),
  servername: z.string(),
  success: z.boolean(),
  authorized: z.boolean(),
  errorCode: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  certificateFingerprint: z.string().nullable().optional(), // full 64 chars sha256 hex
  issuerFingerprint: z.string().nullable().optional(),
  subjectAltNames: z.array(z.string()).optional(),
  validFrom: z.string().datetime().nullable().optional(),
  validTo: z.string().datetime().nullable().optional(),
  serialNumber: z.string().nullable().optional(),
  protocol: z.string().nullable().optional(),
  durationMs: z.number().nonnegative(),
  trustProfile: z.string(),
  connectionFresh: z.literal(true).default(true),
  sampleIndex: z.number().optional()
});
export type TlsProbeData = z.infer<typeof TlsProbeDataSchema>;

// Run Events
export const RunEventTypeSchema = z.enum([
  'phase_started',
  'phase_finished',
  'certificate_issued',
  'profile_installed',
  'context_reloaded',
  'tls_probe',
  'sample_request',
  'fault_enabled',
  'fault_disabled',
  'assertion_evaluated',
  'recovery_started',
  'recovery_verified',
  'run_interrupted',
  'log_message'
]);
export type RunEventType = z.infer<typeof RunEventTypeSchema>;

export const RunEventSchema = z.object({
  id: z.string(),
  runId: z.string(),
  seq: z.number().int().nonnegative(),
  type: RunEventTypeSchema,
  phase: z.string(),
  serviceId: z.string().nullable().optional(),
  observedAt: z.string().datetime(),
  elapsedMs: z.number().nonnegative(),
  operationId: z.string().nullable().optional(),
  data: z.record(z.any()).default({})
});
export type RunEvent = z.infer<typeof RunEventSchema>;

// Assertions & Outcomes
export const AssertionStatusSchema = z.enum(['pass', 'fail', 'inconclusive']);
export type AssertionStatus = z.infer<typeof AssertionStatusSchema>;

export const AssertionResultSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: AssertionStatusSchema,
  expected: z.any(),
  actual: z.any(),
  evidenceEventIds: z.array(z.string()),
  explanation: z.string()
});
export type AssertionResult = z.infer<typeof AssertionResultSchema>;

// Run Lifecycle & Record
export const RunLifecycleSchema = z.enum([
  'queued',
  'preparing',
  'running',
  'recovering',
  'completed',
  'failed',
  'cancelled',
  'interrupted',
  'timed_out'
]);
export type RunLifecycle = z.infer<typeof RunLifecycleSchema>;

export const RunOutcomeSchema = z.enum(['pass', 'fail', 'inconclusive']);
export type RunOutcome = z.infer<typeof RunOutcomeSchema>;

export const RecoveryResultSchema = z.object({
  status: z.enum(['not_run', 'verified', 'failed']),
  evidenceEventIds: z.array(z.string()),
  explanation: z.string().optional(),
  completedAt: z.string().datetime().optional()
});
export type RecoveryResult = z.infer<typeof RecoveryResultSchema>;

export const RunSchema = z.object({
  id: z.string(),
  environmentId: z.string(),
  environmentRevision: z.string(),
  scenarioId: ScenarioIdSchema,
  scenarioVersion: z.string(),
  provenance: ProvenanceSchema,
  lifecycle: RunLifecycleSchema,
  outcome: RunOutcomeSchema.nullable().optional(),
  active: z.boolean().default(false),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable().optional(),
  finishedAt: z.string().datetime().nullable().optional(),
  actorId: z.string().optional(),
  phase: z.string().default('init'),
  cancelRequestedAt: z.string().datetime().nullable().optional(),
  heartbeatAt: z.string().datetime().nullable().optional(),
  fencingToken: z.number().int().optional(),
  idempotencyKey: z.string().optional(),
  buildCommit: z.string().nullable().optional(),
  toolVersions: z.record(z.string()).default({}),
  configurationSnapshot: z.record(z.any()).default({}),
  assertionResults: z.array(AssertionResultSchema).default([]),
  recoveryResult: RecoveryResultSchema.default({ status: 'not_run', evidenceEventIds: [] }),
  limitations: z.array(z.string()).default([])
});
export type Run = z.infer<typeof RunSchema>;

// Report Contract
export const ReportRunSummarySchema = z.object({
  id: z.string(),
  provenance: ProvenanceSchema,
  lifecycle: RunLifecycleSchema,
  outcome: RunOutcomeSchema.nullable().optional(),
  scenarioId: z.string(),
  scenarioVersion: z.string(),
  environmentId: z.string(),
  environmentRevision: z.string(),
  buildCommit: z.string().nullable().optional(),
  toolVersions: z.record(z.string()).default({})
});

export const ReportEnvironmentSnapshotSchema = z.object({
  label: z.string(),
  services: z.array(z.any()),
  edges: z.array(z.any())
});

export const ReportScenarioSnapshotSchema = z.object({
  id: z.string(),
  version: z.string(),
  label: z.string()
});

export const ReportMethodologySchema = z.object({
  description: z.string(),
  sampleCount: z.number().nonnegative(),
  windows: z.array(z.any())
});

export const ReportSchema = z.object({
  schemaVersion: z.literal('1.0'),
  reportId: z.string(),
  generatedAt: z.string().datetime(),
  run: ReportRunSummarySchema,
  environmentSnapshot: ReportEnvironmentSnapshotSchema,
  scenarioSnapshot: ReportScenarioSnapshotSchema,
  methodology: ReportMethodologySchema,
  assertions: z.array(AssertionResultSchema).default([]),
  measurements: z.array(z.any()).default([]),
  recovery: RecoveryResultSchema,
  evidenceEvents: z.array(RunEventSchema).default([]),
  limitations: z.array(z.string())
});
export type Report = z.infer<typeof ReportSchema>;

// Leases & Jobs
export const LeaseSchema = z.object({
  environmentId: z.string(),
  ownerId: z.string(),
  fence: z.number().int().nonnegative(),
  expiresAt: z.date(),
  heartbeatAt: z.date()
});
export type Lease = z.infer<typeof LeaseSchema>;

// API Request/Response Schemas
export const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: z.enum([
      'INVALID_REQUEST',
      'NOT_AUTHENTICATED',
      'FORBIDDEN',
      'LIVE_DISABLED',
      'ENVIRONMENT_BUSY',
      'ENVIRONMENT_NOT_READY',
      'IDEMPOTENCY_CONFLICT',
      'NOT_FOUND',
      'RATE_LIMITED',
      'DEPENDENCY_UNAVAILABLE'
    ]),
    message: z.string(),
    requestId: z.string(),
    details: z.any().optional()
  })
});
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

export const StartRunRequestSchema = z.object({
  environmentId: z.string(),
  scenarioId: ScenarioIdSchema,
  scenarioVersion: z.string().default('1')
});
export type StartRunRequest = z.infer<typeof StartRunRequestSchema>;

export const OperatorLoginRequestSchema = z.object({
  password: z.string().min(1)
});
export type OperatorLoginRequest = z.infer<typeof OperatorLoginRequestSchema>;
