/**
 * @tmnl/stx — stx.feed()
 *
 * Append / windowed / ring-buffer feed materializer.
 * ONE fiber. No Scope, no watchFiberExit, no fiber sprawl.
 *
 * @module
 */

import { Atom, AtomRegistry } from "effect/unstable/reactivity"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Fiber from "effect/Fiber"
import * as Exit from "effect/Exit"
import * as Cause from "effect/Cause"
import * as Result from "effect/Result"
import { StxDefect } from "./fiber-exit.js"
import type { FeedConfig, StxFeed } from "./types.js"

export function stxFeed<A, E = never>(
  source: Stream.Stream<A, E, never>,
  config: FeedConfig = {},
  registry: AtomRegistry.AtomRegistry,
): StxFeed<A, E> {
  const mode  = config.mode  ?? "append"
  const limit = config.limit ?? Infinity

  // ── Atoms ───────────────────────────────────────────────────────────────────
  const itemsAtom   = Atom.make<ReadonlyArray<A>>([])
  const countAtom   = Atom.make<number>(0)
  const loadingAtom = Atom.make<boolean>(true)
  const runningAtom = Atom.make<boolean>(true)
  const doneAtom    = Atom.make<boolean>(false)
  const errorAtom   = Atom.make<unknown>(undefined)

  registry.mount(itemsAtom)
  registry.mount(countAtom)
  registry.mount(loadingAtom)
  registry.mount(runningAtom)
  registry.mount(doneAtom)
  registry.mount(errorAtom)

  let totalReceived = 0
  let totalDropped  = 0

  // ── Merge policy ────────────────────────────────────────────────────────────
  const applyItem = (current: ReadonlyArray<A>, item: A): ReadonlyArray<A> => {
    if (mode === "drop-newest" && current.length >= limit) {
      totalDropped++
      return current
    }
    const next = [...current, item]
    if (next.length <= limit || mode === "append") return next
    // window / ring: keep last `limit`
    totalDropped += next.length - limit
    return next.slice(next.length - limit)
  }

  // ── Single fiber ────────────────────────────────────────────────────────────
  const program = Stream.runForEach(source, (item) =>
    Effect.sync(() => {
      totalReceived++
      const current = registry.get(itemsAtom)
      const next = applyItem(current, item)
      registry.set(itemsAtom, next)
      registry.set(countAtom, totalReceived)
      registry.set(loadingAtom, false)
    })
  ).pipe(
    Effect.onExit((exit) =>
      Effect.sync(() => {
        registry.set(runningAtom, false)
        if (Exit.isSuccess(exit)) {
          registry.set(doneAtom, true)
          return
        }
        const cause = exit.cause
        if (Cause.hasInterruptsOnly(cause)) return
        if (Cause.hasDies(cause)) {
          const found = Cause.findDefect(cause)
          if (Result.isSuccess(found)) {
            registry.set(errorAtom, new StxDefect(found.success, cause))
            return
          }
        }
        if (Cause.hasFails(cause)) {
          const found = Cause.findError(cause)
          if (Result.isSuccess(found)) registry.set(errorAtom, found.success)
        }
      })
    )
  )

  const fiber = Effect.runFork(program)

  const clear = () => {
    registry.set(itemsAtom, [])
    totalReceived = 0
    totalDropped  = 0
  }

  const control = {
    running: runningAtom,
    done:    doneAtom,
    error:   errorAtom,
    stats: {
      received: Atom.make(0), applied: Atom.make(0), dropped: Atom.make(0),
      buffered: Atom.make(0), lagMs: Atom.make(0), lastChunkSize: Atom.make(0),
      throughputPerSec: Atom.make(0),
    },
    pause:  () => {},
    resume: () => {},
    dispose: () => { Effect.runFork(Fiber.interrupt(fiber)) },
  }

  return {
    items:   itemsAtom,
    count:   countAtom,
    loading: loadingAtom,
    registry,
    control,
    clear,
  }
}
