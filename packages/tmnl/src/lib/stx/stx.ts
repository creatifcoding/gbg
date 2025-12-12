/**
 * stx - Unified State Factory
 *
 * Composes Legend-State, effect-atom, and XState into a single API
 * with proper bindings between all three systems.
 *
 * @example
 * ```typescript
 * const counter = stx({
 *   machine: counterMachine,
 *   data: { count: 0 },
 *   effects: {
 *     fetchInitial: Effect.gen(function* () { ... }),
 *   },
 *   computed: {
 *     doubled: (get) => get.data.count * 2,
 *   },
 *   // Bindings: wire data changes to machine events
 *   bindings: {
 *     dataToMachine: {
 *       selector: (data) => ({ count: data.count.get() }),
 *       toEvent: (values) => ({ type: 'DATA_SYNC', ...values }),
 *     },
 *   },
 * })
 * ```
 *
 * @module
 */

import { Effect, Exit, Cause } from 'effect'
import { observable, observe, batch, type ObservableObject } from '@legendapp/state'
import { Atom } from '@effect-atom/atom'
import { type Result, success as resultSuccess, failure as resultFailure } from '@effect-atom/atom/Result'
import {
  createActor,
  fromPromise,
  type AnyStateMachine,
  type ActorRefFrom,
  type EventFromLogic,
  type SnapshotFrom,
} from 'xstate'

import type {
  StxConfig,
  Stx,
  EffectsConfig,
  ComputedConfig,
  StxGetter,
} from './types'

// =============================================================================
// Extended Config with Bindings
// =============================================================================

export interface StxBindingsConfig<TData extends object, TMachine extends AnyStateMachine | undefined> {
  /**
   * Automatically send events to machine when data changes.
   * Uses Legend-State's observe() under the hood.
   */
  dataToMachine?: {
    /** Select which data fields to watch */
    selector: (data: ObservableObject<TData>) => unknown
    /** Convert selected data to a machine event */
    toEvent: (values: unknown) => EventFromLogic<NonNullable<TMachine>>
    /** Debounce in ms (default: 0) */
    debounce?: number
  }

  /**
   * Automatically update data when machine context changes.
   * Prevents the update loop with internal flag.
   */
  machineToData?: {
    /** Select which context fields to sync */
    selector: (snapshot: SnapshotFrom<NonNullable<TMachine>>) => Partial<TData>
    /** Fields to update (default: all selected) */
    fields?: (keyof TData)[]
  }

  /**
   * Two-way sync specific fields between machine context and data.
   * Use sparingly - prefer one-way bindings for clarity.
   */
  twoWay?: {
    field: keyof TData
    contextPath: string
  }[]
}

export interface StxConfigWithBindings<
  TMachine extends AnyStateMachine | undefined = undefined,
  TData extends object = object,
  TEffects extends EffectsConfig = EffectsConfig,
  TComputed extends ComputedConfig<TData, TMachine> = ComputedConfig<TData, TMachine>,
> extends StxConfig<TMachine, TData, TEffects, TComputed> {
  /** Bindings between data, machine, and effects */
  bindings?: StxBindingsConfig<TData, TMachine>
}

// =============================================================================
// stx Factory
// =============================================================================

/**
 * Create a unified state instance combining:
 * - XState machine (shape/logic)
 * - Legend-State observable (hydration/data)
 * - effect-atom (Effect bridge)
 *
 * With proper bindings between all three systems.
 */
export function stx<
  TMachine extends AnyStateMachine | undefined = undefined,
  TData extends object = object,
  TEffects extends EffectsConfig = EffectsConfig,
  TComputed extends ComputedConfig<TData, TMachine> = ComputedConfig<TData, TMachine>,
>(
  config: StxConfigWithBindings<TMachine, TData, TEffects, TComputed>
): Stx<TMachine, TData, TEffects, TComputed> {
  // ---------------------------------------------------------------------------
  // 1. Initialize Legend-State observable (data layer)
  // ---------------------------------------------------------------------------
  const data$ = observable(config.data) as ObservableObject<TData>

  // Store initial data for reset
  const initialData = structuredClone(config.data)

  // Track if we're in an update cycle (prevent loops)
  let isUpdatingFromMachine = false
  let isUpdatingFromData = false

  // ---------------------------------------------------------------------------
  // 2. Create Effect actors for the machine
  // ---------------------------------------------------------------------------
  const effectActors: Record<string, ReturnType<typeof fromPromise>> = {}

  if (config.effects) {
    for (const [name, effectOrFn] of Object.entries(config.effects)) {
      effectActors[name] = fromPromise(async ({ input }: { input: unknown }) => {
        let effect: Effect.Effect<unknown, unknown, never>

        if (typeof effectOrFn === 'function') {
          // Effect factory - pass input as argument
          effect = (effectOrFn as (arg: unknown) => Effect.Effect<unknown, unknown, never>)(input)
        } else {
          // Direct effect
          effect = effectOrFn as Effect.Effect<unknown, unknown, never>
        }

        const exit = await Effect.runPromiseExit(effect)

        return Exit.match(exit, {
          onSuccess: (value) => value,
          onFailure: (cause) => {
            throw Cause.squash(cause)
          },
        })
      })
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Initialize XState actor (logic layer) - if machine provided
  // ---------------------------------------------------------------------------
  let actor: ActorRefFrom<AnyStateMachine> | undefined
  let send: ((event: EventFromLogic<AnyStateMachine>) => void) | undefined
  const cleanupFns: (() => void)[] = []

  if (config.machine) {
    // Provide effect actors to the machine
    const machineWithActors = (config.machine as AnyStateMachine).provide({
      actors: effectActors as Record<string, any>,
    })

    actor = createActor(machineWithActors)

    send = (event) => {
      if (!isUpdatingFromData) {
        actor!.send(event)
      }
    }

    // ---------------------------------------------------------------------------
    // 4. Set up bindings
    // ---------------------------------------------------------------------------

    // Binding: Data → Machine
    if (config.bindings?.dataToMachine) {
      const { selector, toEvent, debounce = 0 } = config.bindings.dataToMachine
      let timeoutId: ReturnType<typeof setTimeout> | undefined

      const disposeObserve = observe(() => {
        if (isUpdatingFromMachine) return

        const values = selector(data$)

        if (debounce > 0) {
          clearTimeout(timeoutId)
          timeoutId = setTimeout(() => {
            isUpdatingFromData = true
            actor!.send(toEvent(values) as EventFromLogic<AnyStateMachine>)
            isUpdatingFromData = false
          }, debounce)
        } else {
          isUpdatingFromData = true
          actor!.send(toEvent(values) as EventFromLogic<AnyStateMachine>)
          isUpdatingFromData = false
        }
      })

      cleanupFns.push(() => {
        disposeObserve()
        clearTimeout(timeoutId)
      })
    }

    // Binding: Machine → Data
    if (config.bindings?.machineToData) {
      const { selector, fields } = config.bindings.machineToData

      const subscription = actor.subscribe((snapshot) => {
        if (isUpdatingFromData) return

        const updates = selector(snapshot as SnapshotFrom<NonNullable<TMachine>>)

        isUpdatingFromMachine = true
        batch(() => {
          for (const [key, value] of Object.entries(updates)) {
            if (!fields || fields.includes(key as keyof TData)) {
              const field = (data$ as Record<string, { set: (v: unknown) => void }>)[key]
              field?.set?.(value)
            }
          }
        })
        isUpdatingFromMachine = false
      })

      cleanupFns.push(() => subscription.unsubscribe())
    }

    // Start the actor after bindings are set up
    actor.start()
  }

  // ---------------------------------------------------------------------------
  // 5. Create getter context for computed values
  // ---------------------------------------------------------------------------
  const createGetter = (): StxGetter<TData, TMachine> => ({
    data: data$,
    machine: actor
      ? {
          matches: (state: string) => actor!.getSnapshot().matches(state),
          snapshot: actor!.getSnapshot(),
          context: actor!.getSnapshot().context,
        }
      : undefined,
  } as StxGetter<TData, TMachine>)

  // ---------------------------------------------------------------------------
  // 6. Initialize computed values as atoms
  // ---------------------------------------------------------------------------
  const computed = {} as {
    [K in keyof TComputed]: Atom.Atom<ReturnType<TComputed[K]>>
  }

  if (config.computed) {
    for (const [key, factory] of Object.entries(config.computed)) {
      // Create atom that recomputes when dependencies change
      const atom = Atom.make(() => factory(createGetter()))
      ;(computed as Record<string, Atom.Atom<unknown>>)[key] = atom
    }
  }

  // ---------------------------------------------------------------------------
  // 7. Create effect runners (standalone, not via machine)
  // ---------------------------------------------------------------------------
  const effects = {} as Stx<TMachine, TData, TEffects, TComputed>['effects']

  if (config.effects) {
    for (const [key, effectOrFn] of Object.entries(config.effects)) {
      if (typeof effectOrFn === 'function') {
        // Effect factory function
        ;(effects as Record<string, (...args: unknown[]) => Promise<Result<unknown, unknown>>>)[key] = async (
          ...args: unknown[]
        ) => {
          const effect = (effectOrFn as (...args: unknown[]) => Effect.Effect<unknown, unknown, never>)(...args)
          const exit = await Effect.runPromiseExit(effect)
          return Exit.match(exit, {
            onSuccess: (value) => resultSuccess(value),
            onFailure: (cause) => resultFailure(cause),
          })
        }
      } else {
        // Direct effect
        ;(effects as Record<string, () => Promise<Result<unknown, unknown>>>)[key] = async () => {
          const exit = await Effect.runPromiseExit(effectOrFn as Effect.Effect<unknown, unknown, never>)
          return Exit.match(exit, {
            onSuccess: (value) => resultSuccess(value),
            onFailure: (cause) => resultFailure(cause),
          })
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Subscription management
  // ---------------------------------------------------------------------------
  const subscriptions = new Set<() => void>()

  const subscribe = (callback: () => void): (() => void) => {
    // Subscribe to Legend-State changes
    const disposeObserve = observe(() => {
      // Touch all top-level keys to track them
      for (const key of Object.keys(config.data)) {
        ;(data$ as Record<string, { get: () => unknown }>)[key]?.get?.()
      }
      callback()
    })

    // Subscribe to XState changes
    let disposeActor: (() => void) | undefined
    if (actor) {
      const sub = actor.subscribe(callback)
      disposeActor = () => sub.unsubscribe()
    }

    const dispose = () => {
      disposeObserve()
      disposeActor?.()
      subscriptions.delete(dispose)
    }

    subscriptions.add(dispose)
    return dispose
  }

  // ---------------------------------------------------------------------------
  // 9. Reset and dispose
  // ---------------------------------------------------------------------------
  const reset = () => {
    batch(() => {
      // Reset data to initial
      for (const [key, value] of Object.entries(initialData)) {
        ;(data$ as Record<string, { set: (v: unknown) => void }>)[key]?.set?.(value)
      }
    })

    // Restart actor if exists
    if (actor && config.machine) {
      actor.stop()

      const machineWithActors = (config.machine as AnyStateMachine).provide({
        actors: effectActors as Record<string, any>,
      })

      actor = createActor(machineWithActors)
      actor.start()
      send = (event) => actor!.send(event)
    }
  }

  const dispose = () => {
    // Dispose all subscriptions
    Array.from(subscriptions).forEach((unsub) => unsub())
    subscriptions.clear()

    // Dispose all bindings
    for (const cleanup of cleanupFns) {
      cleanup()
    }
    cleanupFns.length = 0

    // Stop actor
    actor?.stop()
  }

  // ---------------------------------------------------------------------------
  // 10. Return unified instance
  // ---------------------------------------------------------------------------
  return {
    data: data$,
    actor: actor as TMachine extends AnyStateMachine ? ActorRefFrom<TMachine> : undefined,
    send: send as TMachine extends AnyStateMachine ? (event: EventFromLogic<TMachine>) => void : undefined,
    effects,
    computed,
    subscribe,
    reset,
    dispose,
  }
}

// =============================================================================
// Convenience Factories
// =============================================================================

/**
 * Create a stx instance with just data (no machine, no effects)
 * Alias for simple Legend-State usage
 */
export function stxData<TData extends object>(data: TData) {
  return stx({ data })
}

/**
 * Create a stx instance with machine + data
 */
export function stxMachine<
  TMachine extends AnyStateMachine,
  TData extends object = object,
>(machine: TMachine, data: TData) {
  return stx({ machine, data })
}

/**
 * Create a stx instance with machine + data + automatic context sync
 * Machine context and Legend-State data stay in sync automatically.
 */
export function stxSynced<
  TMachine extends AnyStateMachine,
  TData extends object,
>(
  machine: TMachine,
  data: TData,
  options?: {
    /** Fields to sync (default: all matching keys) */
    syncFields?: (keyof TData)[]
    /** Debounce data → machine sync (ms) */
    debounce?: number
  }
) {
  const syncFields = options?.syncFields ?? (Object.keys(data) as (keyof TData)[])

  return stx({
    machine,
    data,
    bindings: {
      dataToMachine: {
        selector: (d) => {
          const result: Partial<TData> = {}
          for (const field of syncFields) {
            result[field] = (d as Record<string, { get: () => unknown }>)[field as string]?.get?.() as TData[typeof field]
          }
          return result
        },
        toEvent: (values) => ({ type: 'DATA_SYNC', ...(values as object) }) as EventFromLogic<TMachine>,
        debounce: options?.debounce,
      },
      machineToData: {
        selector: (snapshot) => (snapshot as { context: unknown }).context as Partial<TData>,
        fields: syncFields as (keyof TData)[],
      },
    },
  })
}
