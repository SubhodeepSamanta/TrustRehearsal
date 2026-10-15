import mongoose, { Schema, Document } from 'mongoose';
import {
  Environment,
  Scenario,
  Run,
  RunEvent,
  Lease
} from '../contracts/index.js';

export interface EnvironmentDoc extends Document, Omit<Environment, 'id'> {}
export interface ScenarioDoc extends Document, Omit<Scenario, 'id'> { scenarioId: string; }
export interface RunDoc extends Document, Omit<Run, 'id'> { runId: string; }
export interface RunEventDoc extends Document, Omit<RunEvent, 'id'> { eventId: string; }
export interface LeaseDoc extends Document, Lease {}

export interface SessionDoc extends Document {
  sessionId: string;
  role: 'operator' | 'viewer';
  csrfToken: string;
  expiresAt: Date;
}

export interface IdempotencyDoc extends Document {
  key: string;
  actorId: string;
  requestHash: string;
  runId: string;
  expiresAt: Date;
}

const EnvironmentSchema = new Schema({
  id: { type: String, required: true, unique: true },
  revision: { type: String, required: true },
  label: { type: String, required: true },
  state: { type: String, required: true, enum: ['ready', 'reserved', 'needs_reset', 'offline'] },
  services: { type: [Schema.Types.Mixed], default: [] },
  edges: { type: [Schema.Types.Mixed], default: [] },
  baselineProfile: { type: String, required: true },
  lastVerifiedAt: { type: String },
  activeRunId: { type: String }
}, { timestamps: true });

const ScenarioSchema = new Schema({
  scenarioId: { type: String, required: true, unique: true },
  version: { type: String, required: true },
  label: { type: String, required: true },
  description: { type: String, required: true },
  expectedFaults: { type: [String], default: [] },
  phaseDefinitions: { type: [Schema.Types.Mixed], default: [] },
  assertionDefinitions: { type: [Schema.Types.Mixed], default: [] },
  maxDurationMs: { type: Number, required: true }
}, { timestamps: true });

const RunSchema = new Schema({
  runId: { type: String, required: true, unique: true },
  environmentId: { type: String, required: true },
  environmentRevision: { type: String, required: true },
  scenarioId: { type: String, required: true },
  scenarioVersion: { type: String, required: true },
  provenance: { type: String, required: true, enum: ['live_lab', 'recorded_example'] },
  lifecycle: {
    type: String,
    required: true,
    enum: ['queued', 'preparing', 'running', 'recovering', 'completed', 'failed', 'cancelled', 'interrupted', 'timed_out']
  },
  outcome: { type: String, enum: ['pass', 'fail', 'inconclusive'], default: null },
  active: { type: Boolean, default: false },
  createdAt: { type: String, required: true },
  startedAt: { type: String, default: null },
  finishedAt: { type: String, default: null },
  actorId: { type: String },
  phase: { type: String, default: 'init' },
  cancelRequestedAt: { type: String, default: null },
  heartbeatAt: { type: String, default: null },
  fencingToken: { type: Number },
  idempotencyKey: { type: String },
  buildCommit: { type: String, default: null },
  toolVersions: { type: Schema.Types.Mixed, default: {} },
  configurationSnapshot: { type: Schema.Types.Mixed, default: {} },
  assertionResults: { type: [Schema.Types.Mixed], default: [] },
  recoveryResult: { type: Schema.Types.Mixed, default: { status: 'not_run', evidenceEventIds: [] } },
  limitations: { type: [String], default: [] }
}, { timestamps: true });

RunSchema.index({ environmentId: 1, createdAt: -1 });
RunSchema.index(
  { environmentId: 1, active: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);

const RunEventSchema = new Schema({
  eventId: { type: String, required: true, unique: true },
  runId: { type: String, required: true },
  seq: { type: Number, required: true },
  type: { type: String, required: true },
  phase: { type: String, required: true },
  serviceId: { type: String, default: null },
  observedAt: { type: String, required: true },
  elapsedMs: { type: Number, required: true },
  operationId: { type: String, default: null },
  data: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true });

RunEventSchema.index({ runId: 1, seq: 1 }, { unique: true });

const LeaseSchema = new Schema({
  environmentId: { type: String, required: true, unique: true },
  ownerId: { type: String, required: true },
  fence: { type: Number, required: true, default: 1 },
  expiresAt: { type: Date, required: true },
  heartbeatAt: { type: Date, required: true }
}, { timestamps: true });

const SessionSchema = new Schema({
  sessionId: { type: String, required: true, unique: true },
  role: { type: String, required: true, enum: ['operator', 'viewer'] },
  csrfToken: { type: String, required: true },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const IdempotencySchema = new Schema({
  key: { type: String, required: true },
  actorId: { type: String, required: true },
  requestHash: { type: String, required: true },
  runId: { type: String, required: true },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

IdempotencySchema.index({ actorId: 1, key: 1 }, { unique: true });
IdempotencySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EnvironmentModel = mongoose.model<EnvironmentDoc>('Environment', EnvironmentSchema);
export const ScenarioModel = mongoose.model<ScenarioDoc>('Scenario', ScenarioSchema);
export const RunModel = mongoose.model<RunDoc>('Run', RunSchema);
export const RunEventModel = mongoose.model<RunEventDoc>('RunEvent', RunEventSchema);
export const LeaseModel = mongoose.model<LeaseDoc>('Lease', LeaseSchema);
export const SessionModel = mongoose.model<SessionDoc>('Session', SessionSchema);
export const IdempotencyModel = mongoose.model<IdempotencyDoc>('Idempotency', IdempotencySchema);
