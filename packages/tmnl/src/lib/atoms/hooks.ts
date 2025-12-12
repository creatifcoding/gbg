/**
 * stx React Hooks
 *
 * React hooks for the stx unified state API.
 *
 * @module
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { useSelector } from '@legendapp/state/react'
import { useSelector as useActorSelector } from '@xstate/react'
import type { AnyStateMachine, EventFromLogic, SnapshotFrom, ActorRefFrom } from 'xstate'

import type {
  Stx,
  EffectsConfig,
  ComputedConfig,
  UseStxValueReturn,
  UseStxSendReturn,
  UseStxMachineReturn,
  UseStxEffectReturn,
} from './types'

// =============================================================================
// useStxValue - Fine-grained value access
// =============================================================================

/**
 * Subscribe to a specific value from stx state with fine-grained reactivity.
 *
 * @example
 * ```tsx
 * const count = useStxValue(counter, s => s.data.count.get())
 * const isIdle = useStxValue(counter, s => s.actor?.getSnapshot().matches('idle'))
 * ```
 */
export function useStxValue<
  TMachine extends AnyStateMachine | undefined,
  TData extends object,
  TEffects extends EffectsConfig,
  TComputed extends ComputedConfig<TData, TMachine>,
  TValue,
>(
  state: Stx<TMachine, TData, TEffects, TComputed>,
  selector: (state: Stx<TMachine, TData, TEffects, TComputed>) => TValue
): UseStxValueReturn<TValue> {
  const subscribe = useCallback(
    (callback: () => void) => state.subscribe(callback),
    [state]
  )

  const getSnapshot = useCallback(() => selector(state), [state, selector])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

// =============================================================================
// useStxData - Legend-State data access
// =============================================================================

/**
 * Subscribe to data fields using Legend-State's fine-grained reactivity.
 * Only re-renders when the selected data changes.
 *
 * @example
 * ```tsx
 * const count = useStxData(counter, d => d.count.get())
 * const user = useStxData(counter, d => d.user.name.get())
 * ```
 */
export function useStxData<
  TMachine extends AnyStateMachine | undefined,
  TData extends object,
  TEffects extends EffectsConfig,
  TComputed extends ComputedConfig<TData, TMachine>,
  TValue,
>(
  state: Stx<TMachine, TData, TEffects, TComputed>,
  selector: (data: Stx<TMachine, TData, TEffects, TComputed>['data']) => TValue
): TValue {
  return useSelector(() => selector(state.data))
}

// =============================================================================
// useStxSend - Machine event dispatch
// =============================================================================

/**
 * Get a stable send function for dispatching events to the XState machine.
 *
 * @example
 * ```tsx
 * const send = useStxSend(counter)
 * // ...
 * send({ type: 'INCREMENT' })
 * ```
 */
export function useStxSend<
  TMachine extends AnyStateMachine,
  TData extends object,
  TEffects extends EffectsConfig,
  TComputed extends ComputedConfig<TData, TMachine>,
>(
  state: Stx<TMachine, TData, TEffects, TComputed>
): UseStxSendReturn<TMachine> {
  return useCallback(
    (event: EventFromLogic<TMachine>) => {
      if (state.send) {
        state.send(event)
      }
    },
    [state]
  ) as UseStxSendReturn<TMachine>
}

// =============================================================================
// useStxMachine - Full machine access
// =============================================================================

/**
 * Get full access to the XState machine: snapshot, send, and actor ref.
 *
 * @example
 * ```tsx
 * const [snapshot, send, actorRef] = useStxMachine(counter)
 * const isActive = snapshot.matches('active')
 * ```
 */
export function useStxMachine<
  TMachine extends AnyStateMachine,
  TData extends object,
  TEffects extends EffectsConfig,
  TComputed extends ComputedConfig<TData, TMachine>,
>(
  state: Stx<TMachine, TData, TEffects, TComputed>
): UseStxMachineReturn<TMachine> {
  const actor = state.actor as ActorRefFrom<TMachine>

  const snapshot = useActorSelector(actor, (s) => s) as SnapshotFrom<TMachine>

  const send = useCallback(
    (event: EventFromLogic<TMachine>) => {
      if (state.send) {
        state.send(event)
      }
    },
    [state]
  )

  return [snapshot, send, actor]
}

// =============================================================================
// useStxMatches - Machine state matching
// =============================================================================

/**
 * Check if the machine matches a specific state.
 * Only re-renders when the match result changes.
 *
 * @example
 * ```tsx
 * const isIdle = useStxMatches(counter, 'idle')
 * const isLoading = useStxMatches(counter, 'loading')
 * ```
 */
export function useStxMatches<
  TMachine extends AnyStateMachine,
  TData extends object,
  TEffects extends EffectsConfig,
  TComputed extends ComputedConfig<TData, TMachine>,
>(
  state: Stx<TMachine, TData, TEffects, TComputed>,
  stateValue: string
): boolean {
  const actor = state.actor as ActorRefFrom<TMachine>

  return useActorSelector(actor, (snapshot) => (snapshot as { matches: (v: string) => boolean }).matches(stateValue))
}

// =============================================================================
// useStxEffect - Effect execution
// =============================================================================

/**
 * Get a function to run named effects.
 *
 * @example
 * ```tsx
 * const runEffect = useStxEffect(counter)
 * // ...
 * const result = await runEffect('fetchData', someArg)
 * if (Result.isSuccess(result)) {
 *   console.log(result.value)
 * }
 * ```
 */
export function useStxEffect<
  TMachine extends AnyStateMachine | undefined,
  TData extends object,
  TEffects extends EffectsConfig,
  TComputed extends ComputedConfig<TData, TMachine>,
>(
  state: Stx<TMachine, TData, TEffects, TComputed>
): UseStxEffectReturn<TEffects> {
  return useCallback(
    <K extends keyof TEffects>(
      name: K,
      ...args: TEffects[K] extends (...args: infer Args) => unknown ? Args : []
    ) => {
      const effect = state.effects[name]
      if (typeof effect === 'function') {
        return (effect as (...args: unknown[]) => Promise<unknown>)(...args)
      }
      throw new Error(`Effect "${String(name)}" not found`)
    },
    [state]
  ) as unknown as UseStxEffectReturn<TEffects>
}

// =============================================================================
// useStxComputed - Computed value access
// =============================================================================

/**
 * Subscribe to a computed value.
 *
 * @example
 * ```tsx
 * const doubled = useStxComputed(counter, 'doubled')
 * ```
 */
export function useStxComputed<
  TMachine extends AnyStateMachine | undefined,
  TData extends object,
  TEffects extends EffectsConfig,
  TComputed extends ComputedConfig<TData, TMachine>,
  K extends keyof TComputed,
>(
  state: Stx<TMachine, TData, TEffects, TComputed>,
  key: K
): ReturnType<TComputed[K]> {
  const atom = state.computed[key]

  const subscribe = useCallback(
    (callback: () => void) => state.subscribe(callback),
    [state]
  )

  const getSnapshot = useCallback(() => {
    // Access the atom value - this will depend on how effect-atom exposes it
    // For now, return undefined and we'll wire this up properly
    return undefined as ReturnType<TComputed[K]>
  }, [atom])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

// =============================================================================
// useStx - Combined hook
// =============================================================================

/**
 * Combined hook providing all stx accessors.
 *
 * @example
 * ```tsx
 * const { data, send, runEffect, matches } = useStx(counter)
 * ```
 */
export function useStx<
  TMachine extends AnyStateMachine | undefined,
  TData extends object,
  TEffects extends EffectsConfig,
  TComputed extends ComputedConfig<TData, TMachine>,
>(state: Stx<TMachine, TData, TEffects, TComputed>) {
  const send = state.send
    ? useCallback(
        (event: unknown) => state.send!(event as EventFromLogic<AnyStateMachine>),
        [state]
      )
    : undefined

  const runEffect = useStxEffect(state)

  const matches = state.actor
    ? useCallback((stateValue: string) => state.actor!.getSnapshot().matches(stateValue), [state])
    : undefined

  return useMemo(
    () => ({
      /** Legend-State observable data */
      data: state.data,

      /** Send event to machine (if machine defined) */
      send,

      /** Run a named effect */
      runEffect,

      /** Check if machine matches state (if machine defined) */
      matches,

      /** Actor reference (if machine defined) */
      actor: state.actor,

      /** Computed values */
      computed: state.computed,

      /** Reset to initial state */
      reset: state.reset,
    }),
    [state, send, runEffect, matches]
  )
}
