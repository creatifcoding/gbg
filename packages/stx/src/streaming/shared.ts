/**
 * @tmnl/stx — stx.shared()
 *
 * PubSub-backed multicast stream binding.
 * One source stream → multiple independent subscribers via PubSub.
 *
 * Allows N consumers to subscribe to the same underlying stream without
 * re-running it. Each subscriber gets its own feed atom, independently
 * windowed and independently disposable.
 *
 * Architecture:
 *   source stream → ingest fiber (Effect.runFork)
 *                     └→ PubSub.publish per chunk
 *   subscribe()   → new subscriber atom (PubSub.subscribe via Effect.scoped)
 *
 * Confirmed API (from spike-streaming2.test.ts):
 *   - PubSub.make()          → Effect<PubSub<A>>
 *   - PubSub.publish(ps, a)  → Effect<void>
 *   - PubSub.subscribe(ps)   → Effect<Subscription, never, Scope.Scope>
 *   - PubSub.Subscription.take(sub) → Effect<A>
 *   - PubSub.Subscription.takeAll(sub) → Effect<Chunk<A>>
 *   - PubSub.Subscription is NOT Queue.Dequeue — use Subscription-specific API
 *
 * @module
 */

import { Atom, AtomRegistry } from "effect-v4/unstable/reactivity"
import * as Effect from "effect-v4/Effect"
import * as Stream from "effect-v4/Stream"
import * as PubSub from "effect-v4/PubSub"
import * as Fiber from "effect-v4/Fiber"
import * as Scope from "effect-v4/Scope"
import * as Exit from "effect-v4/Exit"
import { makeStatsAtoms, makeControlAtoms } from "./stats.js"
import { watchFiberExit } from "./fiber-exit.js"
import type { SharedConfig, StxShared, StxSharedSubscription } from "./types.js"

// ─── stx.shared ──────────────────────────────────────────────────────────────

/**
 * Create a multicast streaming binding backed by PubSub.
 *
 * @example
 * ```ts
 * const shared = stxShared(
 *   tokenStream,
 *   { capacity: 64, mode: "window", limit: 200 },
 *   registry
 * )
 * // Subscribe independently
 * const sub1 = shared.subscribe()  // → items atom, latest atom
 * const sub2 = shared.subscribe()
 *
 * // Dispose everything
 * shared.control.dispose()
 * ```
 */
export function stxShared<A, E = never>(
  source:   Stream.Stream<A, E, never>,
  config:   SharedConfig = {},
  registry: AtomRegistry.AtomRegistry,
): StxShared<A, E> {
  const capacity = config.capacity ?? 256
  const mode     = config.mode     ?? "append"
  const limit    = config.limit    ?? Infinity

  // ── Stats + control ─────────────────────────────────────────────────────────
  const stats   = makeStatsAtoms(registry)
  const control = makeControlAtoms(registry, stats)

  // ── PubSub (created synchronously via runSync) ────────────────────────────
  // PubSub.bounded(n) → Effect<PubSub<A>> — use runSync for sync creation
  const pubsub  = Effect.runSync(PubSub.bounded<ReadonlyArray<A>>(capacity))

  // ── Subscriber registry ───────────────────────────────────────────────────
  const subscribers: Array<{
    scope: ReturnType<typeof Scope.makeUnsafe>,
    items: ReturnType<typeof Atom.make<ReadonlyArray<A>>>,
  }> = []

  // ── Ingest fiber: publish chunks to PubSub ────────────────────────────────
  const ingest = Stream.runForEachArray(source, (chunk) => {
    if (control.mutable.paused) {
      stats.mutable.buffered += chunk.length
      stats.mutable.received += chunk.length
      stats.flush()
      return Effect.void
    }

    stats.mutable.received     += chunk.length
    stats.mutable._windowCount += chunk.length
    stats.mutable.lastChunkSize = chunk.length
    stats.mutable.applied      += chunk.length

    return Effect.flatMap(
      PubSub.publish(pubsub, chunk as ReadonlyArray<A>),
      () => {
        stats.flush()
        return Effect.void
      }
    )
  })

  const fiber = Effect.runFork(ingest)

  watchFiberExit(fiber, control.atoms, registry)

  control.mutable.fiber = {
    interrupt: () => { Effect.runFork(Fiber.interrupt(fiber)) }
  }

  // ── Subscribe API ─────────────────────────────────────────────────────────
  const subscribe = (): StxSharedSubscription<A> => {
    const itemsAtom  = Atom.make<ReadonlyArray<A>>([])
    const latestAtom = Atom.make<A | undefined>(undefined)
    registry.mount(itemsAtom)
    registry.mount(latestAtom)

    const subScope = Scope.makeUnsafe("sequential")

    // Subscribe inside a scope — runs the subscription fiber
    const subProgram = Effect.gen(function* () {
      const sub = yield* PubSub.subscribe(pubsub)

      // Loop: take chunks from subscription and update atoms
      // PubSub.takeAll(sub) → Effect<NonEmptyArray<ReadonlyArray<A>>>
      // (we publish ReadonlyArray<A> per chunk — items inside are A)
      yield* Effect.forever(Effect.gen(function* () {
        // take() blocks until at least one item available — no busy loop
        const published = yield* PubSub.take(sub) // ReadonlyArray<A> (one chunk)
        const events = published as ReadonlyArray<A>

        if (events.length === 0) return

        const current = registry.get(itemsAtom)
        let   next: ReadonlyArray<A>

        if (mode === "append") {
          next = [...current, ...events]
        } else {
          const combined = [...current, ...events]
          next = combined.length <= limit
            ? combined
            : combined.slice(combined.length - limit)
        }

        registry.set(itemsAtom as any, next)
        registry.set(latestAtom as any, events[events.length - 1])
      }))
    }).pipe(Effect.scoped)

    const subFiber = Effect.runFork(subProgram)

    const dispose = () => {
      Effect.runFork(Fiber.interrupt(subFiber))
      Effect.runFork(Scope.close(subScope, Exit.void))
    }

    subscribers.push({ scope: subScope, items: itemsAtom })

    return { items: itemsAtom, latest: latestAtom, dispose }
  }

  return {
    subscribe,
    registry,
    control: control.control,
  }
}


