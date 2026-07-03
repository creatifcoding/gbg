/**
 * PCT semantic diagnostics service.
 *
 * PCT owns registry, schema resolver, NATS control-plane, and projection
 * scheduler semantics. Transport substrate diagnostics stay in MSH; durable
 * stream bridge diagnostics stay in LNK.
 */

import * as Cause from "effect/Cause"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { SchemaResolver, SchemaResolverNotFound } from "@tmnl/lnk/contracts"
import {
  DiagnosticCheck,
  DiagnosticFinding,
  DiagnosticReport,
  maxSeverity,
  redactCause,
} from "@tmnl/msh/diagnostics"

import { ProjectionWorkerScheduler } from "../frames/ProjectionScheduler.js"
import { Registry } from "../registry/Registry.js"
import { PctNatsControlPlane } from "../server/NatsControlPlane.js"

export interface PctDiagnosticsShape {
  readonly checkRegistry: Effect.Effect<DiagnosticCheck>
  readonly checkSchemaResolver: (schemaId: string) => Effect.Effect<DiagnosticCheck>
  readonly checkNatsControlPlane: Effect.Effect<DiagnosticCheck>
  readonly checkProjectionScheduler: Effect.Effect<DiagnosticCheck>
  readonly report: Effect.Effect<DiagnosticReport>
}

export class PctDiagnosticsService extends Context.Service<
  PctDiagnosticsService,
  PctDiagnosticsShape
>()("@tmnl/pct/diagnostics/PctDiagnosticsService") {}

const finding = (input: typeof DiagnosticFinding.Type): DiagnosticFinding =>
  DiagnosticFinding.make(input)

const passedCheck = (
  checkId: string,
  component: string,
  durationMs: number,
  observedAt: number,
  findings: ReadonlyArray<DiagnosticFinding>,
): DiagnosticCheck => DiagnosticCheck.make({
  checkId,
  layer: "pct",
  component,
  status: "passed",
  severity: maxSeverity(findings.map((item) => item.severity)),
  durationMs,
  findings: [...findings],
  observedAt,
})

const failedCheck = (
  checkId: string,
  component: string,
  durationMs: number,
  observedAt: number,
  cause: Cause.Cause<unknown>,
  remediation: string,
): DiagnosticCheck => DiagnosticCheck.make({
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
    safeCause: redactCause(cause),
    remediation,
  })],
  observedAt,
})

const skippedCheck = (
  checkId: string,
  component: string,
  message: string,
): DiagnosticCheck => DiagnosticCheck.make({
  checkId,
  layer: "pct",
  component,
  status: "skipped",
  severity: "unknown",
  durationMs: 0,
  findings: [finding({
    severity: "unknown",
    code: `${checkId}.skipped`,
    message,
    layer: "pct",
    component,
  })],
  observedAt: Date.now(),
})

const degradedCheck = (
  checkId: string,
  component: string,
  durationMs: number,
  observedAt: number,
  findings: ReadonlyArray<DiagnosticFinding>,
): DiagnosticCheck => DiagnosticCheck.make({
  checkId,
  layer: "pct",
  component,
  status: "degraded",
  severity: maxSeverity(findings.map((item) => item.severity)),
  durationMs,
  findings: [...findings],
  observedAt,
})

const schemaNotFound = (cause: Cause.Cause<unknown>): SchemaResolverNotFound | undefined => {
  const error = Cause.findErrorOption(cause)
  return Option.isSome(error) && error.value instanceof SchemaResolverNotFound
    ? error.value
    : undefined
}

export const makePctDiagnostics = (): Effect.Effect<PctDiagnosticsShape, never, Registry> =>
  Effect.gen(function* () {
    const registry = yield* Registry
    const resolverOption = yield* Effect.serviceOption(SchemaResolver)
    const controlPlaneOption = yield* Effect.serviceOption(PctNatsControlPlane)
    const schedulerOption = yield* Effect.serviceOption(ProjectionWorkerScheduler)

    const checkRegistry: Effect.Effect<DiagnosticCheck> = Effect.gen(function* () {
      const started = Date.now()
      const exit = yield* Effect.exit(registry.snapshot)
      const observedAt = Date.now()
      const durationMs = observedAt - started
      if (exit._tag === "Failure") {
        return failedCheck(
          "pct.registry.snapshot",
          "registry",
          durationMs,
          observedAt,
          exit.cause,
          "Verify PCT registry layer composition and journal availability.",
        )
      }

      const state = exit.value
      return passedCheck("pct.registry.snapshot", "registry", durationMs, observedAt, [finding({
        severity: "ok",
        code: "pct.registry.snapshot.available",
        message: `registry revision=${state.revision} schemas=${state.schemas.size} operations=${state.operations.size}`,
        layer: "pct",
        component: "registry",
      })])
    })

    const checkSchemaResolver = (schemaId: string): Effect.Effect<DiagnosticCheck> => Effect.gen(function* () {
      if (Option.isNone(resolverOption)) {
        return skippedCheck("pct.schemaResolver.fetch", "schema-resolver", "SchemaResolver is not in scope.")
      }
      const started = Date.now()
      const exit = yield* Effect.exit(resolverOption.value.fetchSchema(schemaId))
      const observedAt = Date.now()
      const durationMs = observedAt - started
      if (exit._tag === "Failure") {
        const notFound = schemaNotFound(exit.cause)
        if (notFound !== undefined) {
          return degradedCheck("pct.schemaResolver.fetch", "schema-resolver", durationMs, observedAt, [finding({
            severity: "warn",
            code: "pct.schemaResolver.fetch.not-found",
            message: `schema '${notFound.schemaId}' was not found`,
            layer: "pct",
            component: "schema-resolver",
            remediation: "Publish the schema to the registry or correct the stream metadata schema id.",
          })])
        }
        return failedCheck(
          "pct.schemaResolver.fetch",
          "schema-resolver",
          durationMs,
          observedAt,
          exit.cause,
          "Verify schema resolver configuration and upstream registry/control-plane availability.",
        )
      }
      return passedCheck("pct.schemaResolver.fetch", "schema-resolver", durationMs, observedAt, [finding({
        severity: "ok",
        code: "pct.schemaResolver.fetch.available",
        message: `schema '${schemaId}' resolved successfully`,
        layer: "pct",
        component: "schema-resolver",
      })])
    })

    const checkNatsControlPlane: Effect.Effect<DiagnosticCheck> = Effect.gen(function* () {
      if (Option.isNone(controlPlaneOption)) {
        return skippedCheck("pct.natsControl.info", "control-plane", "PctNatsControlPlane is not in scope.")
      }
      const control = controlPlaneOption.value
      const started = Date.now()
      const infoExit = yield* Effect.exit(control.info)
      const statsExit = infoExit._tag === "Success"
        ? yield* Effect.exit(control.stats)
        : undefined
      const observedAt = Date.now()
      const durationMs = observedAt - started
      if (infoExit._tag === "Failure") {
        return failedCheck(
          "pct.natsControl.info",
          "control-plane",
          durationMs,
          observedAt,
          infoExit.cause,
          "Verify PCT NATS control-plane host lifecycle and MSH micro service availability.",
        )
      }
      if (statsExit?._tag === "Failure") {
        return failedCheck(
          "pct.natsControl.info",
          "control-plane",
          durationMs,
          observedAt,
          statsExit.cause,
          "Verify PCT NATS control-plane stats/discovery permissions.",
        )
      }
      return passedCheck("pct.natsControl.info", "control-plane", durationMs, observedAt, [finding({
        severity: "ok",
        code: "pct.natsControl.info.available",
        message: `control-plane service '${control.options.serviceName}' is hosted at root '${control.options.subjectRoot}'`,
        layer: "pct",
        component: "control-plane",
        subject: control.options.subjectRoot,
      })])
    })

    const checkProjectionScheduler: Effect.Effect<DiagnosticCheck> = Effect.gen(function* () {
      if (Option.isNone(schedulerOption)) {
        return skippedCheck("pct.projection.scheduler.pressure", "projection-scheduler", "ProjectionWorkerScheduler is not in scope.")
      }
      const scheduler = schedulerOption.value
      const started = Date.now()
      const pressureExit = yield* Effect.exit(scheduler.pressure)
      const snapshotExit = pressureExit._tag === "Success"
        ? yield* Effect.exit(scheduler.snapshot)
        : undefined
      const observedAt = Date.now()
      const durationMs = observedAt - started
      if (pressureExit._tag === "Failure") {
        return failedCheck(
          "pct.projection.scheduler.pressure",
          "projection-scheduler",
          durationMs,
          observedAt,
          pressureExit.cause,
          "Verify projection scheduler/admission controller layer composition.",
        )
      }
      if (snapshotExit?._tag === "Failure") {
        return failedCheck(
          "pct.projection.scheduler.pressure",
          "projection-scheduler",
          durationMs,
          observedAt,
          snapshotExit.cause,
          "Verify projection scheduler worker snapshot state.",
        )
      }
      const pressure = pressureExit.value
      const workers = snapshotExit?.value ?? []
      const hasPressure = pressure.failed > 0 || pressure.rejected > 0 || pressure.parked > 0
      const baseFinding = finding({
        severity: hasPressure ? "warn" : "ok",
        code: hasPressure
          ? "pct.projection.scheduler.pressure.nonzero"
          : "pct.projection.scheduler.pressure.clear",
        message: `projection pressure inFlight=${pressure.inFlight} parked=${pressure.parked} failed=${pressure.failed} rejected=${pressure.rejected} workers=${workers.length}`,
        layer: "pct",
        component: "projection-scheduler",
        ...(hasPressure
          ? { remediation: "Inspect parked/rejected work lanes before starting soak or chaos runs." }
          : {}),
      })
      return hasPressure
        ? degradedCheck("pct.projection.scheduler.pressure", "projection-scheduler", durationMs, observedAt, [baseFinding])
        : passedCheck("pct.projection.scheduler.pressure", "projection-scheduler", durationMs, observedAt, [baseFinding])
    })

    const report: Effect.Effect<DiagnosticReport> = Effect.gen(function* () {
      const checks = yield* Effect.all([
        checkRegistry,
        checkNatsControlPlane,
        checkProjectionScheduler,
      ], { concurrency: "unbounded" })
      return DiagnosticReport.make({
        reportId: `pct:${Date.now()}`,
        layer: "pct",
        severity: maxSeverity(checks.map((check) => check.severity)),
        checks,
        generatedAt: Date.now(),
      })
    })

    return PctDiagnosticsService.of({
      checkRegistry,
      checkSchemaResolver,
      checkNatsControlPlane,
      checkProjectionScheduler,
      report,
    })
  })

export const pctDiagnosticsServiceLayer: Layer.Layer<PctDiagnosticsService, never, Registry> =
  Layer.effect(PctDiagnosticsService, makePctDiagnostics())
