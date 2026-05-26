/**
 * PCT semantic diagnostics service.
 *
 * First slice: registry read-surface health. Transport diagnostics stay in MSH;
 * stream protocol diagnostics stay in LNK.
 */

import * as Cause from "effect-v4/Cause"
import * as Context from "effect-v4/Context"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"

import { Registry } from "../registry/Registry.js"
import {
  PctDiagnosticCheck,
  PctDiagnosticFinding,
  PctDiagnosticReport,
  maxPctDiagnosticSeverity,
} from "./schemas.js"

export interface PctDiagnosticsShape {
  readonly checkRegistry: Effect.Effect<PctDiagnosticCheck>
  readonly report: Effect.Effect<PctDiagnosticReport>
}

export class PctDiagnosticsService extends Context.Service<
  PctDiagnosticsService,
  PctDiagnosticsShape
>()("@tmnl/pct/diagnostics/PctDiagnosticsService") {}

const finding = (input: typeof PctDiagnosticFinding.Type): PctDiagnosticFinding =>
  PctDiagnosticFinding.make(input)

const failedCheck = (
  checkId: string,
  component: string,
  durationMs: number,
  observedAt: number,
  cause: Cause.Cause<unknown>,
): PctDiagnosticCheck => PctDiagnosticCheck.make({
  checkId,
  layer: "pct",
  component,
  status: "failed",
  severity: "critical",
  durationMs,
  findings: [finding({
    severity: "critical",
    code: `${checkId}.failed`,
    message: `${component} check failed`,
    layer: "pct",
    component,
    safeCause: Cause.pretty(cause),
    remediation: "Verify PCT registry layer composition and journal availability.",
  })],
  observedAt,
})

export const makePctDiagnostics = (): Effect.Effect<PctDiagnosticsShape, never, Registry> =>
  Effect.gen(function* () {
    const registry = yield* Registry

    const checkRegistry: Effect.Effect<PctDiagnosticCheck> = Effect.gen(function* () {
      const started = Date.now()
      const exit = yield* Effect.exit(registry.snapshot)
      const observedAt = Date.now()
      const durationMs = observedAt - started
      if (exit._tag === "Failure") {
        return failedCheck("pct.registry.snapshot", "registry", durationMs, observedAt, exit.cause)
      }

      const state = exit.value
      const findings = [finding({
        severity: "ok",
        code: "pct.registry.snapshot.available",
        message: `registry revision=${state.revision} schemas=${state.schemas.size} operations=${state.operations.size}`,
        layer: "pct",
        component: "registry",
      })]

      return PctDiagnosticCheck.make({
        checkId: "pct.registry.snapshot",
        layer: "pct",
        component: "registry",
        status: "passed",
        severity: maxPctDiagnosticSeverity(findings.map((item) => item.severity)),
        durationMs,
        findings,
        observedAt,
      })
    })

    const report: Effect.Effect<PctDiagnosticReport> = Effect.gen(function* () {
      const checks = yield* Effect.all([checkRegistry], { concurrency: "unbounded" })
      return PctDiagnosticReport.make({
        reportId: `pct:${Date.now()}`,
        layer: "pct",
        severity: maxPctDiagnosticSeverity(checks.map((check) => check.severity)),
        checks,
        generatedAt: Date.now(),
      })
    })

    return PctDiagnosticsService.of({ checkRegistry, report })
  })

export const pctDiagnosticsServiceLayer: Layer.Layer<PctDiagnosticsService, never, Registry> =
  Layer.effect(PctDiagnosticsService, makePctDiagnostics())
