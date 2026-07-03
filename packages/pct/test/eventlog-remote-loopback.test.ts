/**
 * Flow C spike — EventLogRemote loopback replication.
 *
 * This intentionally bypasses PCT Manifest/RegistryDelta replay and
 * exercises Effect-smol's native remote runner:
 *
 *   EventLog.Registry.registerRemote(remote)
 *     → EventJournal.nextRemoteSequence(remote.id)
 *     → remote.changes(...)
 *     → EventJournal.writeFromRemote(...)
 *     → registry event handlers fold into PCT Registry state
 *
 * The remote is in-process for the spike, but it implements the real
 * EventLogRemote service shape and sends real RemoteEntry values.
 */

import { describe, expect, it } from "vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as ManagedRuntime from "effect/ManagedRuntime"
import * as Queue from "effect/Queue"
import * as Schema from "effect/Schema"
import * as EventJournal from "effect/unstable/eventlog/EventJournal"
import * as EventLog from "effect/unstable/eventlog/EventLog"
import * as EventLogRemote from "effect/unstable/eventlog/EventLogRemote"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"

import { layer as federationLayer } from "../src/federation/Default.js"
import { Federation } from "../src/federation/Federation.js"
import * as IdentityLayers from "../src/identity/Layers.js"
import * as NotaryDefault from "../src/notary/Default.js"
import { Notary } from "../src/notary/Notary.js"
import * as RegistryMemory from "../src/registry/Memory.js"
import { Registry } from "../src/registry/Registry.js"

const Order = Schema.Struct({
  orderId: Schema.String,
  total: Schema.Number,
})

const NodeServicesLayer = NotaryDefault.Default.pipe(
  Layer.provideMerge(RegistryMemory.layer),
  Layer.provideMerge(IdentityLayers.layerEphemeral),
  Layer.provideMerge(EventJournal.layerMemory),
)

const FederationNodeLayer = federationLayer({
  pollIntervalMs: 60_000,
  syncOnAdd: false,
}).pipe(
  Layer.provideMerge(RegistryMemory.layer),
  Layer.provideMerge(IdentityLayers.layerEphemeral),
  Layer.provideMerge(EventJournal.layerMemory),
  Layer.provide(FetchHttpClient.layer),
)

const waitForSchema = (schemaId: string) =>
  Effect.gen(function* () {
    const registry = yield* Registry
    for (let i = 0; i < 100; i++) {
      const entry = yield* registry.getSchema(schemaId)
      if (entry !== undefined) return entry
      yield* Effect.sleep("5 millis")
    }
    return undefined
  })

describe("Flow C spike — EventLogRemote loopback", () => {
  it("replicates registry entries through EventLogRemote RemoteEntry values", async () => {
    const runtimeA = ManagedRuntime.make(
      NodeServicesLayer as unknown as Layer.Layer<never, never, never>,
    )
    const runtimeB = ManagedRuntime.make(
      FederationNodeLayer as unknown as Layer.Layer<never, never, never>,
    )

    try {
      const sourceEntries = await runtimeA.runPromise(
        Effect.gen(function* () {
          const notary = yield* Notary
          yield* notary.registerSchema("orders/Order", "1.0.0", Order)
          const log = yield* EventLog.EventLog
          return yield* log.entries
        }) as Effect.Effect<ReadonlyArray<EventJournal.Entry>, unknown, never>,
      )

      expect(sourceEntries).toHaveLength(1)

      const result = await runtimeB.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const queue = yield* Queue.make<
              EventJournal.RemoteEntry,
              EventLogRemote.EventLogRemoteError
            >()
            const remoteId = EventJournal.makeRemoteIdUnsafe()
            let observedStartSequence: number | undefined
            let writesBack = 0

            const remote = EventLogRemote.EventLogRemote.of({
              id: remoteId,
              changes: ({ startSequence }) =>
                Effect.sync(() => {
                  observedStartSequence = startSequence
                  return queue
                }),
              write: ({ entries }) =>
                Effect.sync(() => {
                  writesBack += entries.length
                }),
              whenAuthenticated: (effect) => effect,
            })

            const federation = yield* Federation
            yield* federation.peerEventLogRemote(remote)

            yield* Queue.offerAll(
              queue,
              sourceEntries.map(
                (entry, index) =>
                  new EventJournal.RemoteEntry({
                    remoteSequence: index + 1,
                    entry,
                  }),
              ),
            )

            const imported = yield* waitForSchema("orders/Order@1.0.0")
            const registry = yield* Registry
            const snapshot = yield* registry.snapshot
            const journal = yield* EventJournal.EventJournal
            const nextRemoteSequence = yield* journal.nextRemoteSequence(remoteId)

            return {
              imported,
              revision: snapshot.revision,
              changelogLength: snapshot.changelog.length,
              observedStartSequence,
              nextRemoteSequence,
              writesBack,
            }
          }),
        ) as Effect.Effect<
          {
            readonly imported: unknown
            readonly revision: number
            readonly changelogLength: number
            readonly observedStartSequence: number | undefined
            readonly nextRemoteSequence: number
            readonly writesBack: number
          },
          unknown,
          never
        >,
      )

      expect(result.imported).toBeDefined()
      expect(result.revision).toBe(1)
      expect(result.changelogLength).toBe(1)
      expect(result.observedStartSequence).toBe(0)
      expect(result.nextRemoteSequence).toBe(1)
      expect(result.writesBack).toBe(0)
    } finally {
      await runtimeA.dispose()
      await runtimeB.dispose()
    }
  })
})
