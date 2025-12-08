/**
 * PortHub Service
 *
 * Typed pub/sub ports for overlay-to-overlay communication.
 * Each container has isolated port namespaces.
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Ref from "effect/Ref"
import * as PubSub from "effect/PubSub"
import * as Stream from "effect/Stream"
import * as Queue from "effect/Queue"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import type { Scope } from "effect/Scope"
import { type ContainerId, type PortId } from "../schemas"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/** Port message envelope */
export interface PortMessage<T = unknown> {
  readonly portId: PortId
  readonly containerId: ContainerId
  readonly payload: T
  readonly timestamp: number
}

/** Internal port state */
interface PortState {
  readonly pubsub: PubSub.PubSub<PortMessage>
  readonly latest: Ref.Ref<Option.Option<PortMessage>>
}

/** Composite key for port lookup */
type PortKey = `${ContainerId}:${PortId}`

const makePortKey = (containerId: ContainerId, portId: PortId): PortKey =>
  `${containerId}:${portId}` as PortKey

// ─────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────

/** Operations provided by PortHub */
export interface PortHubOps {
  /**
   * Publish a message to a port.
   * Creates the port if it doesn't exist.
   */
  readonly publish: <T>(
    containerId: ContainerId,
    portId: PortId,
    payload: T
  ) => Effect.Effect<void>

  /**
   * Subscribe to a port, receiving a Stream of messages.
   * The stream will emit all messages published after subscription.
   */
  readonly subscribe: <T>(
    containerId: ContainerId,
    portId: PortId
  ) => Effect.Effect<Stream.Stream<T>, never, Scope>

  /**
   * Read the latest value from a port (sync access).
   * Returns None if no message has been published.
   */
  readonly read: <T>(
    containerId: ContainerId,
    portId: PortId
  ) => Effect.Effect<Option.Option<T>>

  /**
   * Read the latest value, failing if no message exists.
   */
  readonly readOrFail: <T>(
    containerId: ContainerId,
    portId: PortId
  ) => Effect.Effect<T, Error>

  /**
   * Check if a port exists.
   */
  readonly hasPort: (
    containerId: ContainerId,
    portId: PortId
  ) => Effect.Effect<boolean>

  /**
   * List all ports in a container.
   */
  readonly listPorts: (containerId: ContainerId) => Effect.Effect<ReadonlyArray<PortId>>

  /**
   * Destroy a port (cleanup).
   */
  readonly destroyPort: (
    containerId: ContainerId,
    portId: PortId
  ) => Effect.Effect<void>

  /**
   * Destroy all ports in a container.
   */
  readonly destroyContainerPorts: (containerId: ContainerId) => Effect.Effect<void>
}

// ─────────────────────────────────────────────────────────────
// Service Tag
// ─────────────────────────────────────────────────────────────

export class PortHub extends Context.Tag("tmnl/overlays/PortHub")<
  PortHub,
  PortHubOps
>() {
  /**
   * Default implementation using PubSub per port
   */
  static Default = Layer.effect(
    PortHub,
    Effect.gen(function* () {
      // State: Map of PortKey -> PortState
      const portsRef = yield* Ref.make<Map<PortKey, PortState>>(new Map())

      // ─── Helpers ───

      const getOrCreatePort = (
        containerId: ContainerId,
        portId: PortId
      ): Effect.Effect<PortState> =>
        Effect.gen(function* () {
          const key = makePortKey(containerId, portId)
          const ports = yield* Ref.get(portsRef)
          const existing = ports.get(key)

          if (existing) {
            return existing
          }

          // Create new port
          const pubsub = yield* PubSub.unbounded<PortMessage>()
          const latest = yield* Ref.make<Option.Option<PortMessage>>(Option.none())

          const state: PortState = { pubsub, latest }

          yield* Ref.update(portsRef, (map) => {
            const next = new Map(map)
            next.set(key, state)
            return next
          })

          return state
        })

      const getPort = (
        containerId: ContainerId,
        portId: PortId
      ): Effect.Effect<Option.Option<PortState>> =>
        Effect.map(Ref.get(portsRef), (map) =>
          Option.fromNullable(map.get(makePortKey(containerId, portId)))
        )

      // ─── Implementation ───

      return PortHub.of({
        publish: (containerId, portId, payload) =>
          Effect.gen(function* () {
            const port = yield* getOrCreatePort(containerId, portId)

            const message: PortMessage = {
              portId,
              containerId,
              payload,
              timestamp: Date.now(),
            }

            // Update latest value
            yield* Ref.set(port.latest, Option.some(message))

            // TRACE: Log publish
            yield* Effect.log(`[PORT:PUB] ${containerId}:${portId} payload=${JSON.stringify(payload).slice(0, 100)}`)

            // Publish to subscribers
            yield* PubSub.publish(port.pubsub, message)
          }),

        subscribe: (containerId, portId) =>
          Effect.gen(function* () {
            const port = yield* getOrCreatePort(containerId, portId)

            // TRACE: Log subscription
            yield* Effect.log(`[PORT:SUB] ${containerId}:${portId} subscribed`)

            // Create a subscription queue
            const queue = yield* PubSub.subscribe(port.pubsub)

            // Convert queue to stream, extracting payload
            return Stream.fromQueue(queue).pipe(
              Stream.map((msg) => msg.payload as any)
            )
          }),

        read: (containerId, portId) =>
          Effect.gen(function* () {
            const portOpt = yield* getPort(containerId, portId)

            if (Option.isNone(portOpt)) {
              return Option.none()
            }

            const latest = yield* Ref.get(portOpt.value.latest)
            return Option.map(latest, (msg) => msg.payload as any)
          }),

        readOrFail: (containerId, portId) =>
          Effect.gen(function* () {
            const valueOpt = yield* PortHub.pipe(
              Effect.flatMap((hub) => hub.read(containerId, portId))
            )

            if (Option.isNone(valueOpt)) {
              return yield* Effect.fail(
                new Error(`No value in port: ${containerId}:${portId}`)
              )
            }

            return valueOpt.value
          }),

        hasPort: (containerId, portId) =>
          Effect.map(Ref.get(portsRef), (map) =>
            map.has(makePortKey(containerId, portId))
          ),

        listPorts: (containerId) =>
          Effect.map(Ref.get(portsRef), (map) => {
            const prefix = `${containerId}:`
            const ports: PortId[] = []

            for (const key of map.keys()) {
              if (key.startsWith(prefix)) {
                ports.push(key.slice(prefix.length) as PortId)
              }
            }

            return ports
          }),

        destroyPort: (containerId, portId) =>
          Effect.gen(function* () {
            const key = makePortKey(containerId, portId)
            const ports = yield* Ref.get(portsRef)
            const port = ports.get(key)

            if (port) {
              // Shutdown the pubsub
              yield* PubSub.shutdown(port.pubsub)

              // Remove from map
              yield* Ref.update(portsRef, (map) => {
                const next = new Map(map)
                next.delete(key)
                return next
              })
            }
          }),

        destroyContainerPorts: (containerId) =>
          Effect.gen(function* () {
            const ports = yield* Ref.get(portsRef)
            const prefix = `${containerId}:`

            // Find all ports for this container
            const toRemove: PortKey[] = []
            for (const [key, port] of ports.entries()) {
              if (key.startsWith(prefix)) {
                toRemove.push(key)
                yield* PubSub.shutdown(port.pubsub)
              }
            }

            // Remove from map
            yield* Ref.update(portsRef, (map) => {
              const next = new Map(map)
              for (const key of toRemove) {
                next.delete(key)
              }
              return next
            })
          }),
      })
    })
  )
}

/**
 * Standalone layer export for direct composition.
 */
export const PortHubLive = PortHub.Default
