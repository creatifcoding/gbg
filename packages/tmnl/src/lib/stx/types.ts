/**
 * Unified State Types
 *
 * TypeScript types for the tri-library composition:
 * - XState (shape/logic)
 * - Legend-State (hydration/data)
 * - effect-atom (Effect bridge)
 *
 * @module
 */

import type { Effect, Stream, Layer, ManagedRuntime } from 'effect'
import type { ObservableObject } from '@legendapp/state'
import type {
  AnyStateMachine,
  Actor,
  ActorRefFrom,
  SnapshotFrom,
  EventFromLogic,
} from 'xstate'
import { Atom } from '@effect-atom/atom'
import type * as Registry from '@effect-atom/atom/Registry'
import { type Result } from '@effect-atom/atom/Result'

// Re-export Result type for convenience
export type { Result }

// =============================================================================
// Snapshot Types
// =============================================================================

/**
 * Full snapshot of all three stx layers.
 * Safe for JSON.stringify — no proxies, no functions, no observables.
 */
export interface StxSnapshot<
  TData extends object = object,
  TMachine extends AnyStateMachine | undefined = undefined,
  TComputed extends ComputedConfig<TData, TMachine> = ComputedConfig<TData, TMachine>,
> {
  /** Deep-resolved Legend-State data */
  readonly data: TData

  /** XState machine state (undefined if no machine) */
  readonly machine: TMachine extends AnyStateMachine ? {
    /** Current state value (e.g. 'idle', { nested: 'child' }) */
    readonly value: string | Record<string, unknown>
    /** Machine context */
    readonly context: SnapshotFrom<TMachine>['context']
    /** getPersistedSnapshot() output — JSON-safe, restorable */
    readonly persisted: unknown
  } : undefined

  /** Re-evaluated computed values */
  readonly computed: { [K in keyof TComputed]: ReturnType<TComputed[K]> }
}

// =============================================================================
// Core State Configuration
// =============================================================================

/**
 * Configuration for the unified stx({}) factory
 */
export interface StxConfig<
  TMachine extends AnyStateMachine | undefined = undefined,
  TData extends object = object,
  TEffects extends EffectsConfig = EffectsConfig,
  TComputed extends ComputedConfig<TData, TMachine> = ComputedConfig<TData, TMachine>,
> {
  /** XState machine definition (optional - for logic/shape) */
  readonly machine?: TMachine

  /** Input for XState machine context factory (XState v5 `input`) */
  readonly machineInput?: unknown

  /** Initial data shape (Legend-State observable) */
  readonly data: TData

  /** Effect-TS effects (async operations) */
  readonly effects?: TEffects

  /** Computed/derived values */
  readonly computed?: TComputed

  /** Effect Layer for service provision to effect runners */
  readonly layer?: Layer.Layer<any, any, never>

  /** Persistence configuration */
  readonly persist?: PersistConfig

  /** Schema validation */
  readonly schema?: unknown // Schema.Schema<TData> - loose for now
}

// =============================================================================
// Effects Configuration
// =============================================================================

/**
 * Map of named Effect-TS effects
 */
export type EffectsConfig = Record<
  string,
  Effect.Effect<unknown, unknown, unknown> | ((...args: any[]) => Effect.Effect<unknown, unknown, unknown>)
>

/**
 * Extract the return type of an effect
 */
export type EffectResult<T> = T extends Effect.Effect<infer A, infer E, any>
  ? Result<A, E>
  : T extends (...args: any[]) => Effect.Effect<infer A, infer E, any>
  ? Result<A, E>
  : never

// =============================================================================
// Computed Configuration
// =============================================================================

/**
 * Getter context for computed values
 */
export interface StxGetter<TData extends object, TMachine extends AnyStateMachine | undefined> {
  /** Access data fields (Legend-State) */
  readonly data: ObservableObject<TData>

  /** Access machine state (XState) - only if machine defined */
  readonly machine: TMachine extends AnyStateMachine
    ? {
        matches: (state: string) => boolean
        snapshot: SnapshotFrom<TMachine>
        context: SnapshotFrom<TMachine>['context']
      }
    : undefined
}

/**
 * Map of computed value factories
 */
export type ComputedConfig<
  TData extends object,
  TMachine extends AnyStateMachine | undefined,
> = Record<string, (get: StxGetter<TData, TMachine>) => unknown>

// =============================================================================
// Persistence Configuration
// =============================================================================

export interface PersistConfig {
  /** Unique key for storage */
  readonly name: string

  /** Storage plugin — string shorthand, class, or instance */
  readonly plugin?: 'localStorage' | 'indexedDB' | object

  /** Fields to persist (default: all) */
  readonly include?: string[]

  /** Fields to exclude from persistence */
  readonly exclude?: string[]

  /** Debounce writes (ms) */
  readonly debounce?: number
}

// =============================================================================
// Unified State Instance
// =============================================================================

/**
 * The unified state instance returned by stx({})
 */
export interface Stx<
  TMachine extends AnyStateMachine | undefined,
  TData extends object,
  TEffects extends EffectsConfig,
  TComputed extends ComputedConfig<TData, TMachine>,
> {
  /** Legend-State observable for data */
  readonly data: ObservableObject<TData>

  /** effect-atom Registry for reading computed values outside React */
  readonly registry: Registry.Registry

  /** XState actor reference (if machine provided) */
  readonly actor: TMachine extends AnyStateMachine ? ActorRefFrom<TMachine> : undefined

  /** Send events to machine (if machine provided) */
  readonly send: TMachine extends AnyStateMachine
    ? (event: EventFromLogic<TMachine>) => void
    : undefined

  /** Effect runners */
  readonly effects: {
    [K in keyof TEffects]: TEffects[K] extends (...args: infer Args) => Effect.Effect<infer A, infer E, any>
      ? (...args: Args) => Promise<Result<A, E>>
      : TEffects[K] extends Effect.Effect<infer A, infer E, any>
      ? () => Promise<Result<A, E>>
      : never
  }

  /** Computed values as atoms */
  readonly computed: {
    [K in keyof TComputed]: Atom.Atom<ReturnType<TComputed[K]>>
  }

  /** Subscribe to all state changes */
  readonly subscribe: (callback: () => void) => () => void

  /**
   * Full snapshot of all three stx layers: data + machine + computed.
   * Safe for JSON.stringify, structured clone, or cross-boundary transfer.
   */
  readonly snapshot: () => StxSnapshot<TData, TMachine, TComputed>

  /** ManagedRuntime for executing effects with service dependencies (if layer provided) */
  readonly runtime: ManagedRuntime.ManagedRuntime<any, any> | undefined

  /** Reset to initial state */
  readonly reset: () => void

  /** Dispose all resources (async if runtime needs cleanup) */
  readonly dispose: () => void | Promise<void>
}

// =============================================================================
// Hook Return Types
// =============================================================================

/**
 * Return type for useStxValue hook
 */
export type UseStxValueReturn<T> = T

/**
 * Return type for useStxSend hook
 */
export type UseStxSendReturn<TMachine extends AnyStateMachine> = (
  event: EventFromLogic<TMachine>
) => void

/**
 * Return type for useStxMachine hook
 */
export type UseStxMachineReturn<TMachine extends AnyStateMachine> = [
  SnapshotFrom<TMachine>,
  (event: EventFromLogic<TMachine>) => void,
  ActorRefFrom<TMachine>,
]

/**
 * Return type for useStxEffect hook
 */
export type UseStxEffectReturn<TEffects extends EffectsConfig> = <K extends keyof TEffects>(
  name: K,
  ...args: TEffects[K] extends (...args: infer Args) => any ? Args : []
) => Promise<EffectResult<TEffects[K]>>

// =============================================================================
// Stream/Progressive State
// =============================================================================

/**
 * Configuration for stream-based progressive state
 */
export interface StxStreamState {
  value: unknown | undefined
  error: { cause: unknown }
  hasValue: boolean
  hasError: boolean
  buffer: unknown[]
  status: 'idle' | 'streaming' | 'complete' | 'error'
}

export interface StreamStxConfig<A, E> {
  /** The stream source */
  readonly stream: Stream.Stream<A, E>

  /** Initial value before stream emits */
  readonly initial?: A

  /** Buffer strategy */
  readonly buffer?: 'latest' | 'all' | { size: number }

  /** Backpressure handling */
  readonly backpressure?: 'drop' | 'buffer' | 'error'
}

/**
 * Progressive state instance
 */
export interface StxStream<A, E> {
  /** Current value atom (for React via useAtomValue) */
  readonly value: Atom.Atom<{ _tag: 'Success'; value: A } | { _tag: 'Failure'; cause: E } | undefined>

  /** All buffered values atom (for React via useAtomValue) */
  readonly buffer: Atom.Atom<readonly A[]>

  /** Stream status atom (for React via useAtomValue) */
  readonly status: Atom.Atom<'idle' | 'streaming' | 'complete' | 'error'>

  /** Raw Legend-State observable for direct reads outside React */
  readonly state$: ObservableObject<StxStreamState>

  /** Pause streaming */
  readonly pause: () => void

  /** Resume streaming */
  readonly resume: () => void

  /** Reset to initial */
  readonly reset: () => void

  /** Dispose stream consumer */
  readonly dispose: () => void
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Extract data type from a unified state
 */
export type DataOf<S> = S extends Stx<any, infer D, any, any> ? D : never

/**
 * Extract machine type from a unified state
 */
export type MachineOf<S> = S extends Stx<infer M, any, any, any> ? M : never

/**
 * Extract effects type from a unified state
 */
export type EffectsOf<S> = S extends Stx<any, any, infer E, any> ? E : never

/**
 * Extract computed type from a unified state
 */
export type ComputedOf<S> = S extends Stx<any, any, any, infer C> ? C : never
