/**
 * @tmnl/stx — stx.latest()
 *
 * Tracks the latest value from a stream.
 * Each emission overwrites the previous — only the newest matters.
 *
 * Architecture: ONE fiber. Stream → atom set → done.
 * Completion/error/interrupt handled via Effect.onExit in the same fiber.
 * No Fiber.join, no watchFiberExit, no Scope, no fiber sprawl.
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
import type { StxLatest } from "./types.js"
import { StxDefect } from "./fiber-exit.js"

export function stxLatest<A, E = never>(
  source: Stream.Stream<A, E, never>,
  registry: AtomRegistry.AtomRegistry,
): StxLatest<A, E> {
  // ── Atoms ───────────────────────────────────────────────────────────────────
  const valueAtom   = Atom.make<A | undefined>(undefined)
  const loadingAtom = Atom.make<boolean>(true)
  const runningAtom = Atom.make<boolean>(true)
  const doneAtom    = Atom.make<boolean>(false)
  const errorAtom   = Atom.make<unknown>(undefined)

  registry.mount(valueAtom)
  registry.mount(loadingAtom)
  registry.mount(runningAtom)
  registry.mount(doneAtom)
  registry.mount(errorAtom)

  // ── Single fiber: stream + exit handler ─────────────────────────────────────
  const program = Stream.runForEach(source, (item) =>
    Effect.sync(() => {
      registry.set(valueAtom, item)
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
        if (Cause.hasInterruptsOnly(cause)) {
          // Normal dispose — not an error.
          return
        }

        // Extract typed error or defect
        if (Cause.hasDies(cause)) {
          const found = Cause.findDefect(cause)
          if (Result.isSuccess(found)) {
            let typedError: E | undefined
            if (Cause.hasFails(cause)) {
              const fe = Cause.findError(cause)
              if (Result.isSuccess(fe)) typedError = fe.success
            }
            registry.set(errorAtom, new StxDefect(found.success, cause, typedError))
            return
          }
        }

        if (Cause.hasFails(cause)) {
          const found = Cause.findError(cause)
          if (Result.isSuccess(found)) {
            registry.set(errorAtom, found.success)
          }
        }
      })
    )
  )

  const fiber = Effect.runFork(program)

  // ── Control plane — dispose just interrupts the one fiber ───────────────────
  const control = {
    running: runningAtom,
    done:    doneAtom,
    error:   errorAtom,
    stats:   {
      received: Atom.make(0), applied: Atom.make(0), dropped: Atom.make(0),
      buffered: Atom.make(0), lagMs: Atom.make(0), lastChunkSize: Atom.make(0),
      throughputPerSec: Atom.make(0),
    },
    pause:   () => {},
    resume:  () => {},
    dispose: () => { Effect.runFork(Fiber.interrupt(fiber)) },
  }

  return {
    value:   valueAtom,
    loading: loadingAtom,
    registry,
    control,
  }
}
