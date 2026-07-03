/** Cross-layer diagnostics rollup helpers. */

import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  DiagnosticFinding,
  DiagnosticReport,
  DiagnosticSeverity,
  maxSeverity,
} from "@tmnl/msh/diagnostics"

import { PctDiagnosticsService } from "./PctDiagnostics.js"

export const DiagnosticsRollupReport = Schema.Struct({
  reportId: Schema.String,
  severity: DiagnosticSeverity,
  reports: Schema.Array(DiagnosticReport),
  findings: Schema.Array(DiagnosticFinding),
  generatedAt: Schema.Number,
})
export type DiagnosticsRollupReport = typeof DiagnosticsRollupReport.Type

export interface DiagnosticsRollupOptions {
  readonly reportId?: string
  readonly generatedAt?: number
}

export const rollupDiagnosticsReports = (
  reports: ReadonlyArray<DiagnosticReport>,
  options: DiagnosticsRollupOptions = {},
): DiagnosticsRollupReport => {
  const generatedAt = options.generatedAt ?? Date.now()
  const reportId = options.reportId ?? `pct-lnk-msh:${generatedAt}`
  const findings = reports.flatMap((report) =>
    report.checks.flatMap((check) => check.findings),
  )
  return DiagnosticsRollupReport.make({
    reportId,
    severity: maxSeverity(reports.map((report) => report.severity)),
    reports: [...reports],
    findings,
    generatedAt,
  })
}

export const collectPctDiagnosticsRollup = (
  options: DiagnosticsRollupOptions = {},
): Effect.Effect<DiagnosticsRollupReport, never, PctDiagnosticsService> =>
  Effect.gen(function* () {
    const pct = yield* PctDiagnosticsService
    const pctReport = yield* pct.report
    return rollupDiagnosticsReports([pctReport], options)
  })
