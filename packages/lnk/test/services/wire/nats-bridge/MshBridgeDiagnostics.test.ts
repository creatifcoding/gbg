import { describe, expect, it } from "vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { NatsKVService, NatsStreamService } from "@tmnl/msh/nats"

import { trust as trustStreamId } from "../../../../src/contracts/StreamId.js"
import {
  MshBridgeDiagnostics,
  mshBridgeDiagnosticsLayer,
  resolveMshBridgeSubstrateOptions,
  streamNameForStream,
} from "../../../../src/services/wire/nats-bridge/index.js"

const options = resolveMshBridgeSubstrateOptions({
  subjectRoot: "_test.lnk.diagnostics",
  streamNamePrefix: "LNKDIAG",
  metadataBucket: "LNKDIAG_META",
})

const makeLayer = (streamInfo: unknown | null = { config: { name: "ok" }, state: {} }) => {
  const kvLayer = Layer.succeed(NatsKVService)(NatsKVService.of({
    keys: (bucketName: string) => Effect.succeed(bucketName === options.metadataBucket ? ["stream.alpha"] : []),
  } as never))

  const streamLayer = Layer.succeed(NatsStreamService)(NatsStreamService.of({
    getStreamInfo: () => Effect.succeed(streamInfo),
  } as never))

  const substrate = Layer.mergeAll(kvLayer, streamLayer)
  return Layer.mergeAll(substrate, mshBridgeDiagnosticsLayer(options).pipe(Layer.provide(substrate)))
}

describe("MshBridgeDiagnostics", () => {
  it("reports metadata bucket readability", async () => {
    const report = await Effect.runPromise(
      Effect.gen(function* () {
        const diagnostics = yield* MshBridgeDiagnostics
        return yield* diagnostics.report
      }).pipe(Effect.provide(makeLayer())),
    )

    expect(report.layer).toBe("lnk")
    expect(report.severity).toBe("ok")
    expect(report.checks[0]?.checkId).toBe("lnk.mshBridge.metadata.bucket")
    expect(report.checks[0]?.findings[0]?.bucket).toBe(options.metadataBucket)
  })

  it("reports bridge data stream present and missing distinctly", async () => {
    const streamId = trustStreamId("alpha")
    const present = await Effect.runPromise(
      Effect.gen(function* () {
        const diagnostics = yield* MshBridgeDiagnostics
        return yield* diagnostics.checkDataStream(streamId)
      }).pipe(Effect.provide(makeLayer({ config: { name: streamNameForStream(streamId, options) }, state: {} }))),
    )

    const missing = await Effect.runPromise(
      Effect.gen(function* () {
        const diagnostics = yield* MshBridgeDiagnostics
        return yield* diagnostics.checkDataStream(streamId)
      }).pipe(Effect.provide(makeLayer(null))),
    )

    expect(present.status).toBe("passed")
    expect(present.findings[0]?.stream).toBe(streamNameForStream(streamId, options))
    expect(missing.status).toBe("degraded")
    expect(missing.severity).toBe("warn")
    expect(missing.findings[0]?.code).toBe("lnk.mshBridge.stream.info.missing")
  })
})
