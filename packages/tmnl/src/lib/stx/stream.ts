/**
 * stxStream — Progressive State from Effect Streams
 *
 * Architecture: Stream → Fiber (consumer) → observable (Legend-State) → Atom (React)
 * - Consumer fiber reads from the stream, writes to Legend-State observables
 * - Atoms derived from observables for React consumption via useAtomValue
 * - Pause interrupts the fiber, resume restarts it
 * - Buffer strategy controls what happens when values arrive fast
 *
 * @module
 */

import { Effect, Stream, Fiber, Exit } from 'effect'
import { observable, type ObservableObject } from '@legendapp/state'
import { Atom } from '@effect-atom/atom'

import type { StxStream, StreamStxConfig, StxStreamState } from './types'

// =============================================================================
// stxStream Factory
// =============================================================================

export function stxStream<A, E = never>(
  config: StreamStxConfig<A, E>,
): StxStream<A, E> {
  // ---- Mutable core state (Legend-State observables for reactivity) ----
  const state$ = observable({
    value: config.initial as unknown | undefined,
    error: { cause: undefined as unknown },
    hasValue: config.initial !== undefined,
    hasError: false,
    buffer: [] as unknown[],
    status: 'idle' as StxStreamState['status'],
  } satisfies StxStreamState) as ObservableObject<StxStreamState>

  // ---- Effect-atom atoms derived from observables for React ----
  // These are readable atoms that React components subscribe to via useAtomValue
  const valueAtom = Atom.make(() => {
    const s = state$.get()
    if (s.hasError) return { _tag: 'Failure' as const, cause: s.error.cause as E }
    if (s.hasValue) return { _tag: 'Success' as const, value: s.value as A }
    return undefined
  })

  const bufferAtom = Atom.make(() => state$.buffer.get() as readonly A[])
  const statusAtom = Atom.make(() => state$.status.get())

  // ---- Buffer config ----
  const bufferStrategy = config.buffer ?? 'latest'
  const bufferSize = typeof bufferStrategy === 'object' ? bufferStrategy.size : undefined

  // ---- Consumer fiber tracking ----
  let consumerFiber: Fiber.RuntimeFiber<void, unknown> | null = null

  // Build the consumer effect
  const makeConsumer = () =>
    config.stream.pipe(
      Stream.runForEach((value) =>
        Effect.sync(() => {
          // Update value
          state$.value.set(value as any)
          state$.hasValue.set(true)
          state$.hasError.set(false)
          state$.error.set({ cause: undefined })

          // Update buffer based on strategy
          if (bufferStrategy === 'all') {
            state$.buffer.set([...state$.buffer.get(), value] as unknown[])
          } else if (typeof bufferStrategy === 'object' && bufferSize) {
            const current = state$.buffer.get()
            const updated = [...current, value]
            state$.buffer.set(
              updated.length > bufferSize ? updated.slice(-bufferSize) : updated
            )
          }
          // 'latest': no buffer accumulation
        })
      ),
    )

  // Start consuming the stream
  const start = () => {
    if (consumerFiber) return

    state$.status.set('streaming')

    consumerFiber = Effect.runFork(
      Effect.gen(function* () {
        const exit = yield* Effect.exit(makeConsumer())

        Exit.match(exit, {
          onSuccess: () => {
            state$.status.set('complete')
          },
          onFailure: (cause) => {
            if (cause._tag !== 'Interrupt') {
              state$.status.set('error')
              state$.hasError.set(true)
              state$.error.set({ cause })
            }
          },
        })
      })
    )
  }

  // Pause: interrupt the consumer fiber
  const pause = () => {
    if (consumerFiber) {
      Effect.runFork(Fiber.interrupt(consumerFiber))
      consumerFiber = null
      state$.status.set('idle')
    }
  }

  // Resume: restart the consumer
  const resume = () => {
    start()
  }

  // Reset: stop, clear, restore initial
  const reset = () => {
    pause()
    state$.value.set(config.initial as any)
    state$.hasValue.set(config.initial !== undefined)
    state$.hasError.set(false)
    state$.error.set({ cause: undefined })
    state$.buffer.set([])
    state$.status.set('idle')
  }

  // Dispose: stop consumer
  const dispose = () => {
    pause()
  }

  // Auto-start
  start()

  return {
    value: valueAtom,
    buffer: bufferAtom,
    status: statusAtom,
    // Expose the observable for direct reads outside React
    state$,
    pause,
    resume,
    reset,
    dispose,
  }
}
