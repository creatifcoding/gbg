import { describe, expect, it } from "vitest"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Schema from "effect-v4/Schema"
import { SchemaResolver, SchemaResolverNotFound } from "@tmnl/lnk/contracts"

import { ProjectionWorkerScheduler } from "../src/frames/ProjectionScheduler.js"
import { PctDiagnosticsService, pctDiagnosticsServiceLayer } from "../src/diagnostics/PctDiagnostics.js"
import { layerMemory as RegistryMemory } from "../src/registry/Memory.js"
import {
  PctNatsControlPlane,
  resolvePctNatsControlPlaneOptions,
} from "../src/server/NatsControlPlane.js"

const diagnosticsLayer = (...extra: ReadonlyArray<Layer.Layer<any, never, never>>) => {
  const deps = Layer.mergeAll(RegistryMemory, ...extra)
  return Layer.mergeAll(deps, pctDiagnosticsServiceLayer.pipe(Layer.provide(deps)))
}

const schemaResolverLayer = Layer.succeed(SchemaResolver)(SchemaResolver.of({
  fetchSchema: (schemaId) => schemaId === "known@1.0.0"
    ? Effect.succeed(Schema.String)
    : Effect.fail(new SchemaResolverNotFound({ schemaId })),
}))

const controlPlaneLayer = Layer.succeed(PctNatsControlPlane)(PctNatsControlPlane.of({
  options: resolvePctNatsControlPlaneOptions({ subjectRoot: "pct.test" }),
  hosted: {} as never,
  identity: Effect.succeed({} as never),
  info: Effect.succeed({ name: "pct-control-plane", version: "0.1.0" } as never),
  stats: Effect.succeed({} as never),
  stop: () => Effect.void,
}))

const schedulerLayer = (pressure: { readonly parked?: number; readonly failed?: number; readonly rejected?: number } = {}) =>
  Layer.succeed(ProjectionWorkerScheduler)(ProjectionWorkerScheduler.of({
    snapshot: Effect.succeed([]),
    pressure: Effect.succeed({
      inFlight: 0,
      parked: pressure.parked ?? 0,
      completed: 0,
      failed: pressure.failed ?? 0,
      duplicateInFlight: 0,
      rejected: pressure.rejected ?? 0,
      lanePressure: [],
      targetInFlight: {},
      reportedAt: Date.now(),
    }),
  } as never))

describe("PctDiagnosticsService", () => {
  it("reports registry plus skipped optional semantic checks when only registry is in scope", async () => {
    const report = await Effect.runPromise(
      Effect.gen(function* () {
        const diagnostics = yield* PctDiagnosticsService
        return yield* diagnostics.report
      }).pipe(Effect.provide(diagnosticsLayer())),
    )

    expect(report.layer).toBe("pct")
    expect(report.severity).toBe("unknown")
    expect(report.checks.map((check) => check.checkId)).toEqual([
      "pct.registry.snapshot",
      "pct.natsControl.info",
      "pct.projection.scheduler.pressure",
    ])
    expect(report.checks[0]?.status).toBe("passed")
    expect(report.checks[1]?.status).toBe("skipped")
    expect(report.checks[2]?.status).toBe("skipped")
  })

  it("checks schema resolver success and semantic not-found distinctly", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const diagnostics = yield* PctDiagnosticsService
        const found = yield* diagnostics.checkSchemaResolver("known@1.0.0")
        const missing = yield* diagnostics.checkSchemaResolver("missing@1.0.0")
        return { found, missing }
      }).pipe(Effect.provide(diagnosticsLayer(schemaResolverLayer))),
    )

    expect(result.found.status).toBe("passed")
    expect(result.found.findings[0]?.code).toBe("pct.schemaResolver.fetch.available")
    expect(result.missing.status).toBe("degraded")
    expect(result.missing.severity).toBe("warn")
    expect(result.missing.findings[0]?.code).toBe("pct.schemaResolver.fetch.not-found")
  })

  it("checks hosted NATS control-plane semantic surface", async () => {
    const check = await Effect.runPromise(
      Effect.gen(function* () {
        const diagnostics = yield* PctDiagnosticsService
        return yield* diagnostics.checkNatsControlPlane
      }).pipe(Effect.provide(diagnosticsLayer(controlPlaneLayer))),
    )

    expect(check.status).toBe("passed")
    expect(check.findings[0]?.code).toBe("pct.natsControl.info.available")
    expect(check.findings[0]?.subject).toBe("pct.test")
  })

  it("classifies projection scheduler pressure as clear or degraded", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const clearDiagnostics = yield* PctDiagnosticsService
        const clear = yield* clearDiagnostics.checkProjectionScheduler
        return clear
      }).pipe(Effect.provide(diagnosticsLayer(schedulerLayer()))),
    )

    const degraded = await Effect.runPromise(
      Effect.gen(function* () {
        const diagnostics = yield* PctDiagnosticsService
        return yield* diagnostics.checkProjectionScheduler
      }).pipe(Effect.provide(diagnosticsLayer(schedulerLayer({ parked: 2 })))),
    )

    expect(result.status).toBe("passed")
    expect(result.findings[0]?.code).toBe("pct.projection.scheduler.pressure.clear")
    expect(degraded.status).toBe("degraded")
    expect(degraded.severity).toBe("warn")
    expect(degraded.findings[0]?.code).toBe("pct.projection.scheduler.pressure.nonzero")
  })
})
