import { describe, expect, it } from "vitest"
import { DiagnosticReport } from "@tmnl/msh/diagnostics"

import { rollupDiagnosticsReports } from "../src/diagnostics/Rollup.js"

const report = (layer: string, severity: "ok" | "warn" | "critical" | "unknown") =>
  DiagnosticReport.make({
    reportId: `${layer}:1`,
    layer,
    severity,
    generatedAt: 1,
    checks: [{
      checkId: `${layer}.check`,
      layer,
      component: "component",
      status: severity === "ok" ? "passed" : "degraded",
      severity,
      durationMs: 1,
      observedAt: 1,
      findings: [{
        severity,
        code: `${layer}.check.${severity}`,
        message: `${layer} ${severity}`,
        layer,
        component: "component",
      }],
    }],
  })

describe("diagnostics rollup", () => {
  it("preserves raw layer reports and rolls up maximum severity", () => {
    const msh = report("msh", "ok")
    const lnk = report("lnk", "warn")
    const pct = report("pct", "critical")

    const rollup = rollupDiagnosticsReports([msh, lnk, pct], {
      reportId: "rollup:test",
      generatedAt: 123,
    })

    expect(rollup.reportId).toBe("rollup:test")
    expect(rollup.generatedAt).toBe(123)
    expect(rollup.severity).toBe("critical")
    expect(rollup.reports).toEqual([msh, lnk, pct])
    expect(rollup.findings.map((finding) => finding.code)).toEqual([
      "msh.check.ok",
      "lnk.check.warn",
      "pct.check.critical",
    ])
  })
})
