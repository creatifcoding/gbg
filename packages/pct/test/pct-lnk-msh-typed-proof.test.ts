/**
 * Proof: PCT HTTP schema resolution + LNK TypedLnk over real MSH/NATS.
 *
 * This intentionally proves the current typed contract before the NATS-native
 * PCT control plane lands:
 *
 *   PCT HTTP registry publishes Vitals schema
 *      ↓
 *   LNK stream stores Schema-Id metadata through MshBridgeWire
 *      ↓
 *   MshBridgeWire writes durable data to real NATS JetStream + KV
 *      ↓
 *   Lnks.connectTypedById resolves schema through PCT SchemaResolverLayer
 *      ↓
 *   TypedLnk rejects malformed vitals before write and decodes valid reads
 *      ↓
 *   A second independent runtime consumes the same NATS-backed stream
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { Readable } from "node:stream"
import net from "node:net"

import { afterAll, beforeAll, expect, it } from "vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as SchemaRepresentation from "effect/SchemaRepresentation"
import * as Stream from "effect/Stream"
import * as EventJournal from "effect/unstable/eventlog/EventJournal"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"
import * as HttpRouter from "effect/unstable/http/HttpRouter"

import { Contracts as LnkContracts, Services as LnkServices } from "@tmnl/lnk"

import * as SchemaResolverHttp from "../src/client/SchemaResolverLayer.js"
import * as IdentityLayers from "../src/identity/Layers.js"
import * as NotaryDefault from "../src/notary/Default.js"
import * as RegistryMemory from "../src/registry/Memory.js"
import { Routes as PactRoutes } from "../src/server/Routes.js"
import { liveDescribe, startLiveNats, type LiveNatsServer } from "../../lnk/test/support/live-nats.js"

// ─── PCT HTTP server harness ────────────────────────────────────────────────

const PctAppLayer = PactRoutes.pipe(
  Layer.provideMerge(NotaryDefault.Default),
  Layer.provideMerge(RegistryMemory.layer),
  Layer.provideMerge(IdentityLayers.layerEphemeral),
  Layer.provideMerge(EventJournal.layerMemory),
)

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (typeof address !== "object" || address === null) {
        server.close(() => reject(new Error("freePort: non-TCP address")))
        return
      }
      const port = address.port
      server.close(() => resolve(port))
    })
  })

interface RunningPctServer {
  readonly baseUrl: string
  readonly stop: () => Promise<void>
}

const bindPctServer = async (): Promise<RunningPctServer> => {
  const port = await freePort()
  const { handler, dispose } = HttpRouter.toWebHandler(PctAppLayer, {
    disableLogger: true,
  })

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`)
      const headers = new Headers()
      for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) value.forEach((v) => headers.append(key, v))
        else if (value !== undefined) headers.set(key, value)
      }
      const init: RequestInit = { method: req.method ?? "GET", headers }
      if (req.method !== "GET" && req.method !== "HEAD") {
        const chunks: Array<Uint8Array> = []
        for await (const chunk of req) chunks.push(chunk as Uint8Array)
        init.body = Buffer.concat(chunks)
      }
      const response = await handler(new Request(url.toString(), init))
      res.statusCode = response.status
      response.headers.forEach((value, key) => res.setHeader(key, value))
      if (response.body) Readable.fromWeb(response.body as never).pipe(res)
      else res.end()
    } catch (err) {
      res.statusCode = 500
      res.end(String(err))
    }
  })

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(port, "127.0.0.1", () => resolve())
  })

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    stop: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()))
      await dispose()
    },
  }
}

// ─── Vitals schema ──────────────────────────────────────────────────────────

const HeartRateMetric = Schema.Struct({
  metric: Schema.Literal("heart_rate"),
  bpm: Schema.Number,
  deviceId: Schema.String,
  observedAt: Schema.String,
})

const Spo2Metric = Schema.Struct({
  metric: Schema.Literal("spo2"),
  percent: Schema.Number,
  deviceId: Schema.String,
  observedAt: Schema.String,
})

const TemperatureMetric = Schema.Struct({
  metric: Schema.Literal("temperature"),
  celsius: Schema.Number,
  deviceId: Schema.String,
  observedAt: Schema.String,
})

const VitalsMetric = Schema.Union([HeartRateMetric, Spo2Metric, TemperatureMetric])
type VitalsMetric = typeof VitalsMetric.Type

const VITALS_SCHEMA_NAME = "vitals.metrics"
const VITALS_SCHEMA_VERSION = "1.0.0"
const VITALS_SCHEMA_ID = `${VITALS_SCHEMA_NAME}@${VITALS_SCHEMA_VERSION}`

const publishVitalsSchema = async (baseUrl: string): Promise<void> => {
  const schemaDocument = Schema.encodeUnknownSync(
    SchemaRepresentation.DocumentFromJson,
  )(SchemaRepresentation.fromAST(VitalsMetric.ast))

  const response = await fetch(`${baseUrl}/publish`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: VITALS_SCHEMA_NAME,
      version: VITALS_SCHEMA_VERSION,
      schemaDocument,
      description: "Vitals metric event used by the PCT/LNK/MSH proof.",
    }),
  })
  expect(response.status).toBe(200)
  const body = (await response.json()) as { readonly schemaId: string }
  expect(body.schemaId).toBe(VITALS_SCHEMA_ID)
}

const collectTyped = <A>(stream: Stream.Stream<A, unknown, never>) =>
  Stream.runCollect(stream) as Effect.Effect<ReadonlyArray<A>, unknown>

// ─── Live proof ─────────────────────────────────────────────────────────────

liveDescribe("PCT HTTP schema resolution + LNK TypedLnk + MshBridgeWire/NATS", () => {
  let nats: LiveNatsServer
  let pct: RunningPctServer

  beforeAll(async () => {
    nats = await startLiveNats()
    pct = await bindPctServer()
    await publishVitalsSchema(pct.baseUrl)
  }, 15_000)

  afterAll(async () => {
    await pct?.stop()
    await nats?.stop()
  }, 15_000)

  it("resolves a PCT schema into TypedLnk and consumes typed vitals from real NATS", async () => {
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e9)}`
    const streamId = LnkContracts.StreamId.trust(`vitals/typed/${suffix}`)
    const subjectRoot = `_tmnl.typed.${suffix}`
    const streamNamePrefix = `TYPED_${suffix}`
    const metadataBucket = `TYPED_META_${suffix}`

    const bridgeLayer = LnkServices.Wire.NatsBridge.MshBridgeWire.layer({
      servers: nats.servers,
      name: `pct-lnk-typed-proof-${suffix}`,
      reconnect: false,
      maxReconnectAttempts: 0,
      reconnectDelayMs: 50,
      subjectRoot,
      streamNamePrefix,
      metadataBucket,
      shardCount: 4,
    })
    const resolverLayer = SchemaResolverHttp.layer({ baseUrl: pct.baseUrl }).pipe(
      Layer.provide(FetchHttpClient.layer),
    )
    const lnksLayer = LnkServices.Lnks.Lnks.layer().pipe(
      Layer.provideMerge(bridgeLayer),
      Layer.provideMerge(resolverLayer),
    )

    const firstRuntime = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const wire = yield* LnkServices.Wire.Wire
          yield* wire.put({
            streamId,
            contentType: LnkServices.Lnks.JSON_CONTENT_TYPE,
            schemaId: VITALS_SCHEMA_ID,
          })

          const lnks = yield* LnkServices.Lnks.Lnks
          const typed = yield* lnks.connectTypedById<VitalsMetric>(streamId, {
            fromOffset: "now",
            pollTimeoutMs: 500,
          })

          const malformed = yield* Effect.result(
            typed.append({
              metric: "heart_rate",
              bpm: "seventy-two",
              deviceId: "watch-001",
              observedAt: new Date().toISOString(),
            } as unknown as VitalsMetric),
          )

          const observedAt = new Date().toISOString()
          const heartRate: VitalsMetric = {
            metric: "heart_rate",
            bpm: 72,
            deviceId: "watch-001",
            observedAt,
          }
          const spo2: VitalsMetric = {
            metric: "spo2",
            percent: 98,
            deviceId: "pulseox-007",
            observedAt,
          }
          const temperature: VitalsMetric = {
            metric: "temperature",
            celsius: 36.8,
            deviceId: "thermo-003",
            observedAt,
          }

          yield* typed.append(heartRate)
          yield* typed.append(spo2)
          yield* typed.append(temperature)

          const readHistoryUntil = (
            remainingAttempts: number,
          ): Effect.Effect<ReadonlyArray<VitalsMetric>, unknown> =>
            Effect.gen(function* () {
              const historyStream = yield* typed.raw.read({ fromOffset: "-1" })
              const history = yield* collectTyped(
                Stream.mapEffect(historyStream, (message) =>
                  Schema.decodeUnknownEffect(VitalsMetric)(
                    JSON.parse(new TextDecoder().decode(message.payload)),
                  ),
                ),
              )
              if (history.length >= 3 || remainingAttempts <= 1) return history
              yield* Effect.sleep("100 millis")
              return yield* readHistoryUntil(remainingAttempts - 1)
            })
          const readLatestUntil = (
            remainingAttempts: number,
          ): Effect.Effect<Option.Option<VitalsMetric>, never> =>
            Effect.gen(function* () {
              const latest = yield* typed.latest
              if (Option.isSome(latest) || remainingAttempts <= 1) return latest
              yield* Effect.sleep("100 millis")
              return yield* readLatestUntil(remainingAttempts - 1)
            })

          const latest = yield* readLatestUntil(10)
          const history = yield* readHistoryUntil(10)
          const head = yield* typed.raw.head()

          return { malformed, latest, history, head }
        }),
      ).pipe(Effect.provide(lnksLayer)),
    )

    expect(firstRuntime.malformed._tag).toBe("Failure")
    if (firstRuntime.malformed._tag === "Failure") {
      expect((firstRuntime.malformed.failure as { _tag?: string })._tag).toBe("SchemaError")
    }
    expect(firstRuntime.head.schemaId).toBe(VITALS_SCHEMA_ID)
    expect(firstRuntime.latest._tag).toBe("Some")
    if (Option.isSome(firstRuntime.latest)) {
      expect(firstRuntime.latest.value.metric).toBe("temperature")
      expect(firstRuntime.latest.value.celsius).toBe(36.8)
    }
    expect(firstRuntime.history.map((metric) => metric.metric)).toEqual([
      "heart_rate",
      "spo2",
      "temperature",
    ])

    // Independent runtime / connection: same PCT HTTP resolver, same NATS
    // JetStream/KV substrate, no shared in-memory Lnk handle state.
    const secondBridgeLayer = LnkServices.Wire.NatsBridge.MshBridgeWire.layer({
      servers: nats.servers,
      name: `pct-lnk-typed-proof-second-${suffix}`,
      reconnect: false,
      maxReconnectAttempts: 0,
      reconnectDelayMs: 50,
      subjectRoot,
      streamNamePrefix,
      metadataBucket,
      shardCount: 4,
    })
    const secondLnksLayer = LnkServices.Lnks.Lnks.layer().pipe(
      Layer.provideMerge(secondBridgeLayer),
      Layer.provideMerge(resolverLayer),
    )

    const secondRuntime = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const lnks = yield* LnkServices.Lnks.Lnks
          const typed = yield* lnks.connectTypedById<VitalsMetric>(streamId, {
            fromOffset: "-1",
            pollTimeoutMs: 500,
          })
          const readHistoryUntil = (
            remainingAttempts: number,
          ): Effect.Effect<ReadonlyArray<VitalsMetric>, unknown> =>
            Effect.gen(function* () {
              const historyStream = yield* typed.raw.read({ fromOffset: "-1" })
              const history = yield* collectTyped(
                Stream.mapEffect(historyStream, (message) =>
                  Schema.decodeUnknownEffect(VitalsMetric)(
                    JSON.parse(new TextDecoder().decode(message.payload)),
                  ),
                ),
              )
              if (history.length >= 3 || remainingAttempts <= 1) return history
              yield* Effect.sleep("100 millis")
              return yield* readHistoryUntil(remainingAttempts - 1)
            })
          const readLatestUntil = (
            remainingAttempts: number,
          ): Effect.Effect<Option.Option<VitalsMetric>, never> =>
            Effect.gen(function* () {
              const latest = yield* typed.latest
              if (Option.isSome(latest) || remainingAttempts <= 1) return latest
              yield* Effect.sleep("100 millis")
              return yield* readLatestUntil(remainingAttempts - 1)
            })

          const latest = yield* readLatestUntil(10)
          const history = yield* readHistoryUntil(10)
          return { latest, history }
        }),
      ).pipe(Effect.provide(secondLnksLayer)),
    )

    expect(secondRuntime.latest._tag).toBe("Some")
    if (Option.isSome(secondRuntime.latest)) {
      expect(secondRuntime.latest.value.metric).toBe("temperature")
    }
    expect(secondRuntime.history.map((metric) => metric.metric)).toEqual([
      "heart_rate",
      "spo2",
      "temperature",
    ])
  }, 20_000)
})
