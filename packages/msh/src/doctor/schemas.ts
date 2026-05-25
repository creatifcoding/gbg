/**
 * Doctor diagnostic schemas.
 *
 * Generic, safe-to-log diagnostic vocabulary for package-local doctor surfaces.
 * MSH exports the vocabulary, but it deliberately does not encode PCT/LNK
 * policy. Higher layers may use their own `layer` labels in the string field.
 *
 * @module @tmnl/msh/doctor/schemas
 */

import * as Schema from 'effect-v4/Schema';

export const DoctorSeverity = Schema.Literals([
  'ok',
  'warn',
  'critical',
  'unknown',
] as const);
export type DoctorSeverity = typeof DoctorSeverity.Type;

export const DoctorCheckStatus = Schema.Literals([
  'passed',
  'failed',
  'skipped',
  'degraded',
  'unknown',
] as const);
export type DoctorCheckStatus = typeof DoctorCheckStatus.Type;

export const DoctorFinding = Schema.Struct({
  severity: DoctorSeverity,
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
export type DoctorFinding = typeof DoctorFinding.Type;

export const DoctorCheck = Schema.Struct({
  checkId: Schema.String,
  layer: Schema.String,
  component: Schema.String,
  status: DoctorCheckStatus,
  severity: DoctorSeverity,
  durationMs: Schema.Number,
  findings: Schema.Array(DoctorFinding),
  observedAt: Schema.Number,
});
export type DoctorCheck = typeof DoctorCheck.Type;

export const DoctorReport = Schema.Struct({
  reportId: Schema.String,
  layer: Schema.String,
  severity: DoctorSeverity,
  checks: Schema.Array(DoctorCheck),
  generatedAt: Schema.Number,
});
export type DoctorReport = typeof DoctorReport.Type;

const severityRank: Record<DoctorSeverity, number> = {
  ok: 0,
  unknown: 1,
  warn: 2,
  critical: 3,
};

export const maxSeverity = (items: ReadonlyArray<DoctorSeverity>): DoctorSeverity => {
  let current: DoctorSeverity = 'ok';
  for (const item of items) {
    if (severityRank[item] > severityRank[current]) current = item;
  }
  return current;
};
