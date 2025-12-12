/**
 * stx Bindings
 *
 * Bridge layer connecting:
 * - XState actors ↔ Effect.Effect (via fromPromise)
 * - XState actors ↔ Legend-State (via fromCallback)
 * - Legend-State → XState (via observe → send)
 *
 * @module
 */

import { Effect, Exit, Cause } from 'effect'
import { fromPromise, fromCallback, fromObservable, type AnyActorLogic } from 'xstate'
import { observable, observe, batch, type Observable } from '@legendapp/state'
import { interval, map, type Observable as RxObservable } from 'rxjs'

// =============================================================================
// Effect → XState Actor (fromPromise wrapper)
// =============================================================================

/**
 * Create an XState actor from an Effect.Effect.
 *
 * @example
 * ```typescript
 * const fetchUserActor = fromEffect(
 *   ({ input }: { input: { userId: string } }) =>
 *     Effect.gen(function* () {
 *       const client = yield* HttpClient
 *       return yield* client.get(`/users/${input.userId}`)
 *     })
 * )
 *
 * const machine = createMachine({
 *   // ...
 *   invoke: {
 *     src: 'fetchUser',
 *     input: ({ event }) => ({ userId: event.userId }),
 *     onDone: { actions: assign({ user: ({ event }) => event.output }) },
 *   }
 * }).provide({ actors: { fetchUser: fetchUserActor } })
 * ```
 */
export function fromEffect<TInput, TOutput, TError>(
  effectCreator: (params: { input: TInput }) => Effect.Effect<TOutput, TError, never>
) {
  return fromPromise<TOutput, TInput>(async ({ input }) => {
    const effect = effectCreator({ input })
    const exit = await Effect.runPromiseExit(effect)

    return Exit.match(exit, {
      onSuccess: (value) => value,
      onFailure: (cause) => {
        throw Cause.squash(cause)
      },
    })
  })
}

/**
 * Create an XState actor from an Effect.Effect that can emit multiple values.
 * Uses fromCallback for streaming results back to the machine.
 *
 * @example
 * ```typescript
 * const streamDataActor = fromEffectStream(
 *   ({ input, sendBack }) =>
 *     Effect.gen(function* () {
 *       const stream = yield* DataService.stream(input.query)
 *       yield* Stream.runForEach(stream, (item) =>
 *         Effect.sync(() => sendBack({ type: 'DATA_ITEM', item }))
 *       )
 *     })
 * )
 * ```
 */
export function fromEffectCallback<TInput, TEvent extends { type: string }>(
  effectCreator: (params: {
    input: TInput
    sendBack: (event: TEvent) => void
    signal: AbortSignal
  }) => Effect.Effect<void, unknown, never>
) {
  return fromCallback<TEvent, TInput>(({ input, sendBack, system }) => {
    const controller = new AbortController()

    const effect = effectCreator({
      input,
      sendBack,
      signal: controller.signal,
    })

    // Run the effect
    Effect.runPromise(effect).catch((error) => {
      sendBack({ type: 'ERROR', error } as unknown as TEvent)
    })

    // Cleanup function
    return () => {
      controller.abort()
    }
  })
}

// =============================================================================
// Legend-State → XState Actor (fromCallback wrapper)
// =============================================================================

/**
 * Create an XState actor that subscribes to a Legend-State observable.
 * Sends events to the machine whenever the observable changes.
 *
 * @example
 * ```typescript
 * const dataObserver = fromLegendState(
 *   configObservable$,
 *   (value) => ({ type: 'CONFIG_CHANGED', config: value })
 * )
 *
 * const machine = createMachine({
 *   invoke: { src: 'configObserver' },
 *   on: {
 *     CONFIG_CHANGED: { actions: 'handleConfigChange' }
 *   }
 * }).provide({ actors: { configObserver: dataObserver } })
 * ```
 */
export function fromLegendState<TValue, TEvent extends { type: string }>(
  observable$: Observable<TValue>,
  toEvent: (value: TValue, previous: TValue | undefined) => TEvent
) {
  return fromCallback<TEvent>(({ sendBack }) => {
    let previous: TValue | undefined

    const dispose = observe(() => {
      const value = (observable$ as { get: () => TValue }).get()

      // Send event to machine
      sendBack(toEvent(value, previous))
      previous = value
    })

    return () => {
      dispose()
    }
  })
}

/**
 * Create an XState actor that subscribes to multiple Legend-State observables.
 *
 * @example
 * ```typescript
 * const stateObserver = fromLegendStateMulti(
 *   { count: count$, name: name$ },
 *   (values) => ({ type: 'STATE_SYNC', ...values })
 * )
 * ```
 */
export function fromLegendStateMulti<
  TObservables extends Record<string, Observable<unknown>>,
  TEvent extends { type: string },
>(
  observables: TObservables,
  toEvent: (values: { [K in keyof TObservables]: TObservables[K] extends Observable<infer V> ? V : never }) => TEvent
) {
  return fromCallback<TEvent>(({ sendBack }) => {
    const dispose = observe(() => {
      const values = {} as { [K in keyof TObservables]: unknown }

      for (const [key, obs$] of Object.entries(observables)) {
        values[key as keyof TObservables] = (obs$ as { get: () => unknown }).get()
      }

      sendBack(toEvent(values as any))
    })

    return () => {
      dispose()
    }
  })
}

// =============================================================================
// XState Actions → Legend-State
// =============================================================================

/**
 * Create an XState action that updates a Legend-State observable.
 *
 * @example
 * ```typescript
 * const machine = createMachine({
 *   // ...
 *   on: {
 *     INCREMENT: {
 *       actions: updateLegendState(count$, (ctx, event) => ctx.count + 1)
 *     }
 *   }
 * })
 * ```
 */
export function updateLegendState<TContext, TEvent, TValue>(
  observable$: Observable<TValue>,
  updater: (context: TContext, event: TEvent) => TValue
) {
  return ({ context, event }: { context: TContext; event: TEvent }) => {
    const newValue = updater(context, event)
    ;(observable$ as { set: (v: TValue) => void }).set(newValue)
  }
}

/**
 * Create an XState action that batches multiple Legend-State updates.
 *
 * @example
 * ```typescript
 * const machine = createMachine({
 *   on: {
 *     RESET: {
 *       actions: batchLegendState((ctx, event) => {
 *         count$.set(0)
 *         name$.set('')
 *         status$.set('idle')
 *       })
 *     }
 *   }
 * })
 * ```
 */
export function batchLegendState<TContext, TEvent>(
  updater: (context: TContext, event: TEvent) => void
) {
  return ({ context, event }: { context: TContext; event: TEvent }) => {
    batch(() => {
      updater(context, event)
    })
  }
}

// =============================================================================
// Reactive Bridge (observe → send)
// =============================================================================

/**
 * Create a reactive bridge that sends events to an XState actor
 * whenever Legend-State observables change.
 *
 * @example
 * ```typescript
 * const actor = createActor(machine)
 * actor.start()
 *
 * const dispose = bridgeToActor(
 *   () => ({
 *     count: count$.get(),
 *     name: name$.get(),
 *   }),
 *   (values) => ({ type: 'STATE_CHANGED', ...values }),
 *   actor
 * )
 *
 * // Later: cleanup
 * dispose()
 * ```
 */
export function bridgeToActor<TValues, TEvent extends { type: string }>(
  selector: () => TValues,
  toEvent: (values: TValues) => TEvent,
  actor: { send: (event: TEvent) => void }
): () => void {
  return observe(() => {
    const values = selector()
    actor.send(toEvent(values))
  })
}

/**
 * Create a two-way bridge between Legend-State and XState.
 * - Legend-State changes → machine events
 * - Machine state changes → Legend-State updates
 *
 * @example
 * ```typescript
 * const dispose = createTwoWayBridge({
 *   observable$: data$,
 *   actor,
 *   toEvent: (data) => ({ type: 'DATA_CHANGED', data }),
 *   fromSnapshot: (snapshot) => snapshot.context.data,
 * })
 * ```
 */
export function createTwoWayBridge<TData, TEvent extends { type: string }, TActor extends {
  send: (event: TEvent) => void
  subscribe: (callback: (snapshot: { context: unknown }) => void) => { unsubscribe: () => void }
  getSnapshot: () => { context: unknown }
}>(config: {
  observable$: Observable<TData>
  actor: TActor
  toEvent: (data: TData) => TEvent
  fromSnapshot: (snapshot: ReturnType<TActor['getSnapshot']>) => TData
  /** Prevent infinite loops by checking if update came from this bridge */
  equals?: (a: TData, b: TData) => boolean
}): () => void {
  const { observable$, actor, toEvent, fromSnapshot, equals = Object.is } = config

  let isUpdating = false

  // Legend-State → XState
  const disposeObserve = observe(() => {
    if (isUpdating) return

    const value = (observable$ as { get: () => TData }).get()
    actor.send(toEvent(value))
  })

  // XState → Legend-State
  const subscription = actor.subscribe((snapshot) => {
    const newValue = fromSnapshot(snapshot as ReturnType<TActor['getSnapshot']>)
    const currentValue = (observable$ as { get: () => TData }).get()

    if (!equals(newValue, currentValue)) {
      isUpdating = true
      ;(observable$ as { set: (v: TData) => void }).set(newValue)
      isUpdating = false
    }
  })

  return () => {
    disposeObserve()
    subscription.unsubscribe()
  }
}

// =============================================================================
// Effect Stream → XState (via RxJS Observable)
// =============================================================================

/**
 * Create an XState actor from an Effect Stream.
 * Converts the Effect Stream to an RxJS Observable for XState compatibility.
 *
 * @example
 * ```typescript
 * import { Stream } from 'effect'
 *
 * const streamActor = fromEffectStream(
 *   Stream.fromIterable([1, 2, 3]).pipe(
 *     Stream.tap((n) => Effect.log(`Emitting ${n}`))
 *   )
 * )
 * ```
 */
export function fromEffectStreamToObservable<A, E>(
  streamEffect: Effect.Effect<A, E, never>
): RxObservable<A> {
  return new (class extends (require('rxjs').Observable as typeof RxObservable<A>) {
    constructor() {
      super((subscriber) => {
        Effect.runPromise(streamEffect)
          .then((value) => {
            subscriber.next(value)
            subscriber.complete()
          })
          .catch((error) => {
            subscriber.error(error)
          })
      })
    }
  })()
}
