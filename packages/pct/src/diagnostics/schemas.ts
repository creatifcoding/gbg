/** PCT semantic diagnostics schemas. */

import * as Schema from "effect-v4/Schema"

export const PctDiagnosticSeverity = Schema.Literals(["ok", "warn", "critical", "unknown"] as const)
export type PctDiagnosticSeverity = typeof PctDiagnosticSeverity.Type

export const PctDiagnosticCheckStatus = Schema.Literals(["passed", "failed", "skipped", "degraded", "unknown"] as const)
export type PctDiagnosticCheckStatus = typeof PctDiagnosticCheckStatus.Type

export const PctDiagnosticFinding = Schema.Struct({
  severity: PctDiagnosticSeverity,
  code: Schema.String,
  message: Schema.String,
  layer: Schema.String,
  component: Schema.String,
  safeCause: Schema.optionalKey(Schema.String),
  remediation: Schema.optionalKey(Schema.String),
})
export type PctDiagnosticFinding = typeof PctDiagnosticFinding.Type

export const PctDiagnosticCheck = Schema.Struct({
  checkId: Schema.String,
  layer: Schema.String,
  component: Schema.String,
  status: PctDiagnosticCheckStatus,
  severity: PctDiagnosticSeverity,
  durationMs: Schema.Number,
  findings: Schema.Array(PctDiagnosticFinding),
  observedAt: Schema.Number,
})
export type PctDiagnosticCheck = typeof PctDiagnosticCheck.Type

export const PctDiagnosticReport = Schema.Struct({
  reportId: Schema.String,
  layer: Schema.String,
  severity: PctDiagnosticSeverity,
  checks: Schema.Array(PctDiagnosticCheck),
  generatedAt: Schema.Number,
})
export type PctDiagnosticReport = typeof PctDiagnosticReport.Type

const severityRank: Record<PctDiagnosticSeverity, number> = {
  ok: 0,
  unknown: 1,
  warn: 2,
  critical: 3,
}

export const maxPctDiagnosticSeverity = (items: ReadonlyArray<PctDiagnosticSeverity>): PctDiagnosticSeverity => {
  let current: PctDiagnosticSeverity = "ok"
  for (const item of items) {
    if (severityRank[item] > severityRank[current]) current = item
  }
  return current
}
