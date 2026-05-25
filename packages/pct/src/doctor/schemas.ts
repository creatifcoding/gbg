/** PCT semantic doctor schemas. */

import * as Schema from "effect-v4/Schema"

export const PctDoctorSeverity = Schema.Literals(["ok", "warn", "critical", "unknown"] as const)
export type PctDoctorSeverity = typeof PctDoctorSeverity.Type

export const PctDoctorCheckStatus = Schema.Literals(["passed", "failed", "skipped", "degraded", "unknown"] as const)
export type PctDoctorCheckStatus = typeof PctDoctorCheckStatus.Type

export const PctDoctorFinding = Schema.Struct({
  severity: PctDoctorSeverity,
  code: Schema.String,
  message: Schema.String,
  layer: Schema.String,
  component: Schema.String,
  safeCause: Schema.optionalKey(Schema.String),
  remediation: Schema.optionalKey(Schema.String),
})
export type PctDoctorFinding = typeof PctDoctorFinding.Type

export const PctDoctorCheck = Schema.Struct({
  checkId: Schema.String,
  layer: Schema.String,
  component: Schema.String,
  status: PctDoctorCheckStatus,
  severity: PctDoctorSeverity,
  durationMs: Schema.Number,
  findings: Schema.Array(PctDoctorFinding),
  observedAt: Schema.Number,
})
export type PctDoctorCheck = typeof PctDoctorCheck.Type

export const PctDoctorReport = Schema.Struct({
  reportId: Schema.String,
  layer: Schema.String,
  severity: PctDoctorSeverity,
  checks: Schema.Array(PctDoctorCheck),
  generatedAt: Schema.Number,
})
export type PctDoctorReport = typeof PctDoctorReport.Type

const severityRank: Record<PctDoctorSeverity, number> = {
  ok: 0,
  unknown: 1,
  warn: 2,
  critical: 3,
}

export const maxPctDoctorSeverity = (items: ReadonlyArray<PctDoctorSeverity>): PctDoctorSeverity => {
  let current: PctDoctorSeverity = "ok"
  for (const item of items) {
    if (severityRank[item] > severityRank[current]) current = item
  }
  return current
}
