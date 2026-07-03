#!/usr/bin/env bun
/**
 * Human-readable proof/demo for the PCT NATS control plane.
 *
 * Run:
 *   cd packages/pct
 *   bun run demo:nats-control-plane
 */

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as EventJournal from "effect/unstable/eventlog/EventJournal"

import {
  MshMicroEndpointHost,
  NatsCodec,
  NatsConnectionService,
} from "@tmnl/msh/nats"
import { SchemaResolver } from "@tmnl/lnk/contracts"

import { layer as natsSchemaResolverLayer } from "../src/client/NatsSchemaResolverLayer.js"
import * as IdentityLayers from "../src/identity/Layers.js"
import { Manifest } from "../src/manifest/Manifest.js"
import { Notary } from "../src/notary/Notary.js"
import * as NotaryDefault from "../src/notary/Default.js"
import * as RegistryMemory from "../src/registry/Memory.js"
import {
  PctNatsControlPlane,
  layer as pctNatsControlPlaneLayer,
} from "../src/server/NatsControlPlane.js"
import { CapabilitiesGetRequest } from "../src/server/wire.js"
import { startLiveNats } from "../../lnk/test/support/live-nats.js"

process.env.LNK_LIVE_NATS ??= "1"

const VitalsMetric = Schema.Struct({
  metric: Schema.Literal("heart_rate"),
  bpm: Schema.Number,
  deviceId: Schema.String,
})

type VitalsMetric = typeof VitalsMetric.Type

const hr = (label: string) => `\n━━ ${label} ${"━".repeat(Math.max(1, 66 - label.length))}`

const main = async () => {
  console.log(hr("PCT NATS control-plane proof"))
  console.log("Starting live NATS with JetStream + WebSocket…")
  const nats = await startLiveNats()
  console.log(`✓ NATS ready: ${nats.servers}`)

  try {
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e9)}`
    const subjectRoot = `pct.v1.demo.${suffix}`
    console.log(`✓ Subject root: ${subjectRoot}`)

    const connectionLayer = NatsConnectionService.layerCustom({
      servers: nats.servers,
      name: `pct-nats-demo-${suffix}`,
      reconnect: false,
      maxReconnectAttempts: 0,
      reconnectDelayMs: 50,
      debug: false,
    })
    const controlPlaneLayer = pctNatsControlPlaneLayer({
      subjectRoot,
      serviceName: `pct-demo-${suffix}`,
      serviceVersion: "0.1.0",
      serviceDescription: "PCT NATS control-plane demo",
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
          console.log(hr("Publish schema into PCT registry"))
          const notary = yield* Notary
          const published = yield* notary.registerSchema(
            "vitals.metrics",
            "1.0.0",
            VitalsMetric,
            { description: "Vitals metric schema from NATS control-plane demo" },
          )
          console.log(`✓ Published schema: ${published.schemaId}`)

          console.log(hr("Resolve schema through NATS schema.get"))
          const resolver = yield* SchemaResolver
          const schema = yield* resolver.fetchSchema(published.schemaId)
          const decoded = yield* Schema.decodeUnknownEffect(schema)({
            metric: "heart_rate",
            bpm: 72,
            deviceId: "watch-demo",
          }) as Effect.Effect<VitalsMetric, Schema.SchemaError>
          console.log(`✓ Decoded payload: ${JSON.stringify(decoded)}`)

          console.log(hr("Discover hosted micro endpoints"))
          const controlPlane = yield* PctNatsControlPlane
          const info = yield* controlPlane.info
          for (const endpoint of info.endpoints) {
            console.log(`✓ ${endpoint.name.padEnd(18)} ${endpoint.subject}`)
          }

          console.log(hr("Fetch capabilities through NATS capabilities.get"))
          const { nc } = yield* NatsConnectionService
          const request = yield* NatsCodec.encodeJson(CapabilitiesGetRequest, {})
          const msg = yield* Effect.promise(() =>
            nc.request(`${subjectRoot}.capabilities.get`, request, { timeout: 2_000 }),
          )
          const manifest = yield* NatsCodec.decodeJson(Manifest, { subject: msg.subject })(msg.data)
          console.log(`✓ Manifest node: ${manifest.nodeId}`)
          console.log(`✓ Manifest schemas: ${manifest.schemas.map((s) => `${s.schemaId}@${s.version}`).join(", ")}`)

          return { published, decoded, manifest }
        }).pipe(Effect.provide(appLayer)),
      ),
    )

    console.log(hr("Proof complete"))
    console.log(`✓ SchemaResolver.fetchSchema stayed unchanged: ${result.published.schemaId}`)
    console.log("✓ PCT owned schema semantics; MSH only hosted generic endpoints")
    console.log("✓ LNK can keep consuming SchemaResolver without transport knowledge")
  } finally {
    await nats.stop()
    console.log("✓ NATS stopped")
  }
}

main().catch((err) => {
  console.error("✗ PCT NATS control-plane demo failed")
  console.error(err)
  process.exitCode = 1
})
