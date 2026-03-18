/**
 * @tmnl/stx — stx.reduce()
 *
 * Event → state reducer. ONE fiber. No Scope, no watchFiberExit.
 *
 * @module
 */

import { Atom, AtomRegistry } from "effect-v4/unstable/reactivity"
import * as Effect from "effect-v4/Effect"
import * as Stream from "effect-v4/Stream"
import * as Fiber from "effect-v4/Fiber"
import * as Exit from "effect-v4/Exit"
import * as Cause from "effect-v4/Cause"
import * as Result from "effect-v4/Result"
import { StxDefect } from "./fiber-exit.js"
import type { ReduceConfig, StxReduce } from "./types.js"

export function stxReduce<S, A, E = never>(
  source: Stream.Stream<A, E, never>,
  config: ReduceConfig<S, A>,
  registry: AtomRegistry.AtomRegistry,
): StxReduce<S, A, E> {
  // ── Atoms ───────────────────────────────────────────────────────────────────
  const stateAtom   = Atom.make<S>(config.initial)
  const loadingAtom = Atom.make<boolean>(true)
  const runningAtom = Atom.make<boolean>(true)
  const doneAtom    = Atom.make<boolean>(false)
  const errorAtom   = Atom.make<unknown>(undefined)

  registry.mount(stateAtom)
  registry.mount(loadingAtom)
  registry.mount(runningAtom)
  registry.mount(doneAtom)
  registry.mount(errorAtom)

  // ── Single fiber ────────────────────────────────────────────────────────────
  const program = Stream.runForEach(source, (item) =>
    Effect.sync(() => {
      const current = registry.get(stateAtom)
      const next = config.apply(current, item)
      registry.set(stateAtom, next)
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

  const reset = () => {
    registry.set(stateAtom, config.initial)
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
    state:   stateAtom,
    loading: loadingAtom,
    registry,
    control,
    reset,
  }
}
