/**
 * Diagnostic schemas.
 *
 * Generic, safe-to-log diagnostic vocabulary for package-local diagnostics surfaces.
 * MSH exports the vocabulary, but it deliberately does not encode PCT/LNK
 * policy. Higher layers may use their own `layer` labels in the string field.
 *
 * @module @tmnl/msh/diagnostics/schemas
 */

import * as Schema from 'effect/Schema';

export const DiagnosticSeverity = Schema.Literals([
  'ok',
  'warn',
  'critical',
  'unknown',
] as const);
export type DiagnosticSeverity = typeof DiagnosticSeverity.Type;

export const DiagnosticCheckStatus = Schema.Literals([
  'passed',
  'failed',
  'skipped',
  'degraded',
  'unknown',
] as const);
export type DiagnosticCheckStatus = typeof DiagnosticCheckStatus.Type;

export const DiagnosticFinding = Schema.Struct({
  severity: DiagnosticSeverity,
  code: Schema.String,
  message: Schema.String,
  /** Package/layer that owns this diagnostic: e.g. msh, lnk, pct. */
  layer: Schema.String,
  component: Schema.String,
  subject: Schema.optionalKey(Schema.String),
  stream: Schema.optionalKey(Schema.String),
  bucket: Schema.optionalKey(Schema.String),
  safeCause: Schema.optionalKey(Schema.String),
  remediation: Schema.optionalKey(Schema.String),
});
export type DiagnosticFinding = typeof DiagnosticFinding.Type;

export const DiagnosticCheck = Schema.Struct({
  checkId: Schema.String,
  layer: Schema.String,
  component: Schema.String,
  status: DiagnosticCheckStatus,
  severity: DiagnosticSeverity,
  durationMs: Schema.Number,
  findings: Schema.Array(DiagnosticFinding),
  observedAt: Schema.Number,
});
export type DiagnosticCheck = typeof DiagnosticCheck.Type;

export const DiagnosticReport = Schema.Struct({
  reportId: Schema.String,
  layer: Schema.String,
  severity: DiagnosticSeverity,
  checks: Schema.Array(DiagnosticCheck),
  generatedAt: Schema.Number,
});
export type DiagnosticReport = typeof DiagnosticReport.Type;

const severityRank: Record<DiagnosticSeverity, number> = {
  ok: 0,
  unknown: 1,
  warn: 2,
  critical: 3,
};

export const maxSeverity = (items: ReadonlyArray<DiagnosticSeverity>): DiagnosticSeverity => {
  let current: DiagnosticSeverity = 'ok';
  for (const item of items) {
    if (severityRank[item] > severityRank[current]) current = item;
  }
  return current;
};
