/**
 * PCT semantic doctor service.
 *
 * First slice: registry read-surface health. Transport diagnostics stay in MSH;
 * stream protocol diagnostics stay in LNK.
 */

import * as Context from "effect-v4/Context"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"

import { Registry } from "../registry/Registry.js"
import {
  PctDoctorCheck,
  PctDoctorFinding,
  PctDoctorReport,
  maxPctDoctorSeverity,
} from "./schemas.js"

export interface PctDoctorShape {
  readonly checkRegistry: Effect.Effect<PctDoctorCheck>
  readonly report: Effect.Effect<PctDoctorReport>
}

export class PctDoctorService extends Context.Service<
  PctDoctorService,
  PctDoctorShape
>()("@tmnl/pct/doctor/PctDoctorService") {}

const safeCauseText = (cause: unknown): string => {
  if (cause instanceof Error) return cause.message
  if (typeof cause === "object" && cause !== null && "message" in cause) {
    return String((cause as { readonly message?: unknown }).message ?? cause)
  }
  return String(cause)
}

const finding = (input: typeof PctDoctorFinding.Type): PctDoctorFinding =>
  PctDoctorFinding.make(input)

const failedCheck = (
  checkId: string,
  component: string,
  durationMs: number,
  observedAt: number,
  cause: unknown,
): PctDoctorCheck => PctDoctorCheck.make({
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
    safeCause: safeCauseText(cause),
    remediation: "Verify PCT registry layer composition and journal availability.",
  })],
  observedAt,
})

export const makePctDoctor = (): Effect.Effect<PctDoctorShape, never, Registry> =>
  Effect.gen(function* () {
    const registry = yield* Registry

    const checkRegistry: Effect.Effect<PctDoctorCheck> = Effect.gen(function* () {
      const started = Date.now()
      const result = yield* Effect.result(registry.snapshot)
      const observedAt = Date.now()
      const durationMs = observedAt - started
      if (result._tag === "Failure") {
        return failedCheck("pct.registry.snapshot", "registry", durationMs, observedAt, result.failure)
      }

      const state = result.success
      const findings = [finding({
        severity: "ok",
        code: "pct.registry.snapshot.available",
        message: `registry revision=${state.revision} schemas=${state.schemas.size} operations=${state.operations.size}`,
        layer: "pct",
        component: "registry",
      })]

      return PctDoctorCheck.make({
        checkId: "pct.registry.snapshot",
        layer: "pct",
        component: "registry",
        status: "passed",
        severity: maxPctDoctorSeverity(findings.map((item) => item.severity)),
        durationMs,
        findings,
        observedAt,
      })
    })

    const report: Effect.Effect<PctDoctorReport> = Effect.gen(function* () {
      const checks = yield* Effect.all([checkRegistry], { concurrency: "unbounded" })
      return PctDoctorReport.make({
        reportId: `pct:${Date.now()}`,
        layer: "pct",
        severity: maxPctDoctorSeverity(checks.map((check) => check.severity)),
        checks,
        generatedAt: Date.now(),
      })
    })

    return PctDoctorService.of({ checkRegistry, report })
  })

export const pctDoctorServiceLayer: Layer.Layer<PctDoctorService, never, Registry> =
  Layer.effect(PctDoctorService, makePctDoctor())
