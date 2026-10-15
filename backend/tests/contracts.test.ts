import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ReportSchema, StartRunRequestSchema, TlsProbeDataSchema } from '../src/contracts/index.js';

describe('Contracts & Schema Validation', () => {
  it('validates docs/examples/report.example.json against ReportSchema', () => {
    const examplePath = resolve(__dirname, '../../docs/examples/report.example.json');
    const rawContent = readFileSync(examplePath, 'utf-8');
    const parsedJson = JSON.parse(rawContent);

    const validationResult = ReportSchema.safeParse(parsedJson);
    if (!validationResult.success) {
      console.error(JSON.stringify(validationResult.error.format(), null, 2));
    }
    expect(validationResult.success).toBe(true);
  });

  it('validates and defaults TLS probe data', () => {
    const probe = {
      caller: 'gateway',
      callee: 'orders',
      servername: 'orders',
      success: true,
      authorized: true,
      durationMs: 12.5,
      trustProfile: 'root-a'
    };
    const parsed = TlsProbeDataSchema.parse(probe);
    expect(parsed.connectionFresh).toBe(true);
    expect(parsed.durationMs).toBe(12.5);
  });

  it('rejects invalid scenario ID in StartRunRequestSchema', () => {
    const invalidRequest = {
      environmentId: 'sample-lab',
      scenarioId: 'S99' // Invalid scenario
    };
    const result = StartRunRequestSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
  });
});
