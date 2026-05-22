/** PCT NATS SchemaResolver provider over the generic MSH micro endpoint host. */

import { afterAll, beforeAll, expect, it } from "vitest"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Schema from "effect-v4/Schema"
import * as SchemaRepresentation from "effect-v4/SchemaRepresentation"
import * as EventJournal from "effect-v4/unstable/eventlog/EventJournal"

import {
  MshMicroEndpointHost,
  NatsCodec,
  NatsConnectionService,
} from "@tmnl/msh/nats"
import { FetchError, SchemaResolver, SchemaResolverNotFound } from "@tmnl/lnk/contracts"

import {
  SchemaGetRequest,
  SchemaGetResponse,
  layer as natsSchemaResolverLayer,
} from "../src/client/NatsSchemaResolverLayer.js"
import * as IdentityLayers from "../src/identity/Layers.js"
import { Manifest } from "../src/manifest/Manifest.js"
import { Notary } from "../src/notary/Notary.js"
import * as NotaryDefault from "../src/notary/Default.js"
import * as RegistryMemory from "../src/registry/Memory.js"
import {
  CapabilitiesGetRequest,
} from "../src/server/wire.js"
import {
  PctNatsControlPlane,
  layer as pctNatsControlPlaneLayer,
} from "../src/server/NatsControlPlane.js"
import { liveDescribe, startLiveNats, type LiveNatsServer } from "../../lnk/test/support/live-nats.js"

const VitalsMetric = Schema.Struct({
  metric: Schema.Literal("heart_rate"),
  bpm: Schema.Number,
  deviceId: Schema.String,
})

type VitalsMetric = typeof VitalsMetric.Type

const schemaDocument = Schema.encodeUnknownSync(
  SchemaRepresentation.DocumentFromJson,
)(SchemaRepresentation.fromAST(VitalsMetric.ast))

const schemaEntry = {
  schemaId: "vitals.metrics",
  version: "1.0.0",
  schemaDocument,
  description: "Vitals metric schema",
  registeredAt: 1,
  originNodeId: "pct:test",
  deprecated: null,
}

liveDescribe("PCT NATS SchemaResolverLayer", () => {
  let nats: LiveNatsServer

  beforeAll(async () => {
    nats = await startLiveNats()
  }, 10_000)

  afterAll(async () => {
    await nats?.stop()
  }, 10_000)

  it("resolves schema.get through a hosted MSH micro endpoint", async () => {
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e9)}`
    const subjectRoot = `pct.v1.${suffix}`
    const connectionLayer = NatsConnectionService.layerCustom({
      servers: nats.servers,
      name: `pct-nats-schema-resolver-${suffix}`,
      reconnect: false,
      maxReconnectAttempts: 0,
      reconnectDelayMs: 50,
      debug: false,
    })
    const hostLayer = MshMicroEndpointHost.layer.pipe(Layer.provide(connectionLayer))
    const resolverLayer = natsSchemaResolverLayer({ subjectRoot, timeoutMs: 2_000 }).pipe(
      Layer.provide(connectionLayer),
    )

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const host = yield* MshMicroEndpointHost
          const hosted = yield* host.host(
            {
              name: `pct-schema-${suffix}`,
              version: "0.1.0",
              description: "PCT schema.get proof service",
              metadata: { domain: "pct" },
            },
            [
              {
                name: "schema-get",
                subject: `${subjectRoot}.schema.get`,
                metadata: {
                  request: "PctSchemaGetRequest",
                  response: "PctGetSchemaResponse",
                },
                requestSchema: SchemaGetRequest,
                responseSchema: SchemaGetResponse,
                handle: (request) =>
                  request.schemaId === "vitals.metrics@1.0.0"
                    ? Effect.succeed(schemaEntry)
                    : Effect.fail(new SchemaResolverNotFound({ schemaId: request.schemaId })),
                mapError: (cause) =>
                  cause instanceof SchemaResolverNotFound
                    ? { code: 404, message: `schema not found: ${cause.schemaId}` }
                    : { code: 500, message: String(cause) },
              },
            ],
          )

          const resolver = yield* SchemaResolver
          const schema = yield* resolver.fetchSchema("vitals.metrics@1.0.0")
          const decoded = yield* Schema.decodeUnknownEffect(schema)({
            metric: "heart_rate",
            bpm: 72,
            deviceId: "watch-001",
          }) as Effect.Effect<VitalsMetric, Schema.SchemaError>
          const malformed = yield* Effect.result(
            Schema.decodeUnknownEffect(schema)({
              metric: "heart_rate",
              bpm: "bad",
              deviceId: "watch-001",
            }),
          )
          const missing = yield* Effect.result(resolver.fetchSchema("missing@1.0.0"))
          const info = yield* hosted.info

          return { decoded, malformed, missing, info }
        }).pipe(Effect.provide(resolverLayer)),
      ).pipe(Effect.provide(hostLayer)),
    )

    expect(result.decoded).toEqual({
      metric: "heart_rate",
      bpm: 72,
      deviceId: "watch-001",
    })
    expect(result.malformed._tag).toBe("Failure")
    expect(result.missing._tag).toBe("Failure")
    if (result.missing._tag === "Failure") {
      expect(result.missing.failure).toBeInstanceOf(SchemaResolverNotFound)
    }
    expect(result.info.endpoints[0]).toMatchObject({
      name: "schema-get",
      subject: `${subjectRoot}.schema.get`,
      metadata: {
        request: "PctSchemaGetRequest",
        response: "PctGetSchemaResponse",
      },
    })
  }, 20_000)

  it("resolves through the production PCT NATS control-plane host", async () => {
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e9)}`
    const subjectRoot = `pct.v1.hosted.${suffix}`
    const connectionLayer = NatsConnectionService.layerCustom({
      servers: nats.servers,
      name: `pct-nats-control-plane-${suffix}`,
      reconnect: false,
      maxReconnectAttempts: 0,
      reconnectDelayMs: 50,
      debug: false,
    })
    const controlPlaneLayer = pctNatsControlPlaneLayer({
      subjectRoot,
      serviceName: `pct-control-${suffix}`,
      serviceVersion: "0.1.0",
    }).pipe(
      Layer.provideMerge(MshMicroEndpointHost.layer),
      Layer.provideMerge(NotaryDefault.Default),
      Layer.provideMerge(RegistryMemory.layer),
      Layer.provideMerge(IdentityLayers.layerEphemeral),
      Layer.provideMerge(EventJournal.layerMemory),
      Layer.provideMerge(connectionLayer),
    )
    const resolverLayer = natsSchemaResolverLayer({ subjectRoot, timeoutMs: 2_000 }).pipe(
      Layer.provide(connectionLayer),
    )
    const appLayer = Layer.mergeAll(controlPlaneLayer, resolverLayer)

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const notary = yield* Notary
          const published = yield* notary.registerSchema(
            "vitals.metrics",
            "1.0.0",
            VitalsMetric,
            { description: "Vitals metric schema from production NATS host" },
          )

          const resolver = yield* SchemaResolver
          const schema = yield* resolver.fetchSchema(published.schemaId)
          const decoded = yield* Schema.decodeUnknownEffect(schema)({
            metric: "heart_rate",
            bpm: 72,
            deviceId: "watch-001",
          }) as Effect.Effect<VitalsMetric, Schema.SchemaError>

          const controlPlane = yield* PctNatsControlPlane
          const info = yield* controlPlane.info
          const { nc } = yield* NatsConnectionService
          const request = yield* NatsCodec.encodeJson(CapabilitiesGetRequest, {})
          const capabilitiesMsg = yield* Effect.promise(() =>
            nc.request(`${subjectRoot}.capabilities.get`, request, { timeout: 2_000 }),
          )
          const manifest = yield* NatsCodec.decodeJson(Manifest, {
            subject: capabilitiesMsg.subject,
          })(capabilitiesMsg.data)

          return { decoded, info, manifest, published }
        }).pipe(Effect.provide(appLayer)),
      ),
    )

    expect(result.decoded).toEqual({
      metric: "heart_rate",
      bpm: 72,
      deviceId: "watch-001",
    })
    expect(result.manifest.schemas.map((schema) => `${schema.schemaId}@${schema.version}`)).toContain(
      result.published.schemaId,
    )
    expect(result.info.endpoints.map((endpoint) => endpoint.name).sort()).toEqual([
      "capabilities-get",
      "schema-get",
    ])
  }, 20_000)

  it("maps non-404 service errors to FetchError", async () => {
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e9)}`
    const subjectRoot = `pct.v1.error.${suffix}`
    const connectionLayer = NatsConnectionService.layerCustom({
      servers: nats.servers,
      name: `pct-nats-schema-resolver-error-${suffix}`,
      reconnect: false,
      maxReconnectAttempts: 0,
      reconnectDelayMs: 50,
      debug: false,
    })
    const hostLayer = MshMicroEndpointHost.layer.pipe(Layer.provide(connectionLayer))
    const resolverLayer = natsSchemaResolverLayer({ subjectRoot, timeoutMs: 2_000 }).pipe(
      Layer.provide(connectionLayer),
    )

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const host = yield* MshMicroEndpointHost
          yield* host.host(
            { name: `pct-schema-error-${suffix}`, version: "0.1.0" },
            [
              {
                name: "schema-get",
                subject: `${subjectRoot}.schema.get`,
                requestSchema: SchemaGetRequest,
                responseSchema: SchemaGetResponse,
                handle: () => Effect.fail(new Error("registry projection unavailable")),
                mapError: () => ({ code: 503, message: "registry projection unavailable" }),
              },
            ],
          )
          const resolver = yield* SchemaResolver
          return yield* Effect.result(resolver.fetchSchema("vitals.metrics@1.0.0"))
        }).pipe(Effect.provide(resolverLayer)),
      ).pipe(Effect.provide(hostLayer)),
    )

    expect(result._tag).toBe("Failure")
    if (result._tag === "Failure") {
      expect(result.failure).toBeInstanceOf(FetchError)
    }
  }, 20_000)
})
