/**
 * Traced Atom Group - Factory for wrapping atom groups with observability
 *
 * Provides Effect-native tracing and logging for logical atom groupings.
 * Follows Atom-as-State Doctrine: registry.set() for sync mutations,
 * traced operations emit structured events to configurable sinks.
 *
 * @module primitives/atoms/observability/traced-group
 */

import type { Atom, Registry } from '@effect-atom/atom'
import {
  AtomRead,
  AtomWrite,
  AtomSubscribe,
  AtomUnsubscribe,
  AtomGroupCreated,
  AtomGroupDisposed,
  type AtomObservabilityEvent,
} from './schemas'
import { emitToDevTools } from './devtools'

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for creating a traced atom group
 */
export interface TracedAtomGroupConfig<T extends Record<string, Atom.Atom<unknown>>> {
  /** Unique identifier for this atom group (e.g., "map:maptool-123") */
  groupId: string

  /** The atoms to trace */
  atoms: T

  /** Registry to use for mutations (must match useAtomValue context) */
  registry: Registry.Registry

  /** Event sink - receives all observability events */
  onEvent?: (event: AtomObservabilityEvent) => void

  /** Enable/disable tracing (can be toggled at runtime) */
  enabled?: boolean

  /** Sample rate for high-frequency atoms (1 = all, 10 = every 10th write) */
  sampleRate?: number

  /** Whether to emit to DevTools hook (default: true in dev) */
  emitToDevTools?: boolean
}

/**
 * Traced atom group interface - wraps atoms with observability
 */
export interface TracedAtomGroup<T extends Record<string, Atom.Atom<unknown>>> {
  /** Original atoms (unchanged) - use with useAtomValue() */
  atoms: T

  /** Group identifier */
  groupId: string

  /**
   * Traced set - logs write event with prevValue/nextValue
   * Use this instead of registry.set() for traced mutations
   */
  set: <K extends keyof T>(
    key: K,
    value: Atom.Atom.Value<T[K]>,
    source?: string
  ) => void

  /**
   * Traced get - logs read event
   * Use this instead of registry.get() for traced reads
   */
  get: <K extends keyof T>(key: K) => Atom.Atom.Value<T[K]>

  /**
   * Traced subscribe - logs subscribe/unsubscribe events
   * Wraps registry.subscribe() with observability
   */
  subscribe: <K extends keyof T>(
    key: K,
    callback: (value: Atom.Atom.Value<T[K]>) => void
  ) => () => void

  /** Toggle tracing on/off at runtime */
  setEnabled: (enabled: boolean) => void

  /** Check if tracing is currently enabled */
  isEnabled: () => boolean

  /** Dispose the traced group (emits AtomGroupDisposed) */
  dispose: () => void
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Create a traced atom group with observability
 *
 * @example
 * ```typescript
 * const tracedMap = createTracedAtomGroup({
 *   groupId: `map:${instanceId}`,
 *   atoms: createMapInstanceAtoms(instanceId),
 *   registry: mapRegistry,
 *   enabled: import.meta.env.DEV,
 *   onEvent: (event) => appendLog('debug', 'atom', event._tag, event),
 * })
 *
 * // Use traced operations instead of registry.set()
 * tracedMap.set('dimensionsAtom', { width: 800, height: 600 }, 'ResizeObserver')
 *
 * // Read atoms normally with useAtomValue
 * const dimensions = useAtomValue(tracedMap.atoms.dimensionsAtom)
 * ```
 */
export function createTracedAtomGroup<T extends Record<string, Atom.Atom<unknown>>>(
  config: TracedAtomGroupConfig<T>
): TracedAtomGroup<T> {
  const {
    groupId,
    atoms,
    registry,
    onEvent,
    enabled = true,
    sampleRate = 1,
    emitToDevTools: shouldEmitToDevTools = typeof window !== 'undefined' &&
      import.meta.env?.DEV,
  } = config

  let isEnabled = enabled
  let writeCount = 0
  const subscriptionIds = new Map<string, number>()
  let subscriptionCounter = 0

  // Emit event to configured sinks
  const emit = (event: AtomObservabilityEvent): void => {
    if (!isEnabled) return

    // Custom sink
    if (onEvent) {
      try {
        onEvent(event)
      } catch (err) {
        console.error('[TracedAtomGroup] Event sink error:', err)
      }
    }

    // DevTools hook
    if (shouldEmitToDevTools) {
      emitToDevTools(event)
    }
  }

  // Emit group creation event
  emit(
    new AtomGroupCreated({
      groupId,
      atomKeys: Object.keys(atoms),
      timestamp: Date.now(),
    })
  )

  const tracedGroup: TracedAtomGroup<T> = {
    atoms,
    groupId,

    set: <K extends keyof T>(
      key: K,
      value: Atom.Atom.Value<T[K]>,
      source?: string
    ): void => {
      const atom = atoms[key]

      // Apply sample rate (skip some writes for high-frequency atoms)
      writeCount++
      if (sampleRate > 1 && writeCount % sampleRate !== 0) {
        registry.set(atom, value)
        return
      }

      // Capture prev value before mutation
      const prevValue = registry.get(atom)

      // Perform mutation
      registry.set(atom, value)

      // Emit write event
      emit(
        new AtomWrite({
          groupId,
          atomKey: String(key),
          prevValue,
          nextValue: value,
          timestamp: Date.now(),
          source,
        })
      )
    },

    get: <K extends keyof T>(key: K): Atom.Atom.Value<T[K]> => {
      const atom = atoms[key]
      const value = registry.get(atom)

      // Emit read event
      emit(
        new AtomRead({
          groupId,
          atomKey: String(key),
          value,
          timestamp: Date.now(),
        })
      )

      return value as Atom.Atom.Value<T[K]>
    },

    subscribe: <K extends keyof T>(
      key: K,
      callback: (value: Atom.Atom.Value<T[K]>) => void
    ): (() => void) => {
      const atom = atoms[key]
      const subscriberId = `${groupId}:${String(key)}:${++subscriptionCounter}`
      subscriptionIds.set(subscriberId, Date.now())

      // Emit subscribe event
      emit(
        new AtomSubscribe({
          groupId,
          atomKey: String(key),
          subscriberId,
          timestamp: Date.now(),
        })
      )

      // Create actual subscription
      const cancel = registry.subscribe(atom, callback as (value: unknown) => void)

      // Return cleanup that emits unsubscribe event
      return () => {
        emit(
          new AtomUnsubscribe({
            groupId,
            atomKey: String(key),
            subscriberId,
            timestamp: Date.now(),
          })
        )
        subscriptionIds.delete(subscriberId)
        cancel()
      }
    },

    setEnabled: (value: boolean): void => {
      isEnabled = value
    },

    isEnabled: (): boolean => isEnabled,

    dispose: (): void => {
      emit(
        new AtomGroupDisposed({
          groupId,
          timestamp: Date.now(),
        })
      )
      isEnabled = false
    },
  }

  return tracedGroup
}

// =============================================================================
// Utility: Traced Operations for Effect Contexts
// =============================================================================

/**
 * Log atom operation with structured data (sync, for use outside Effect)
 *
 * @example
 * ```typescript
 * logAtomOp('map:123', 'dimensionsAtom', 'write', { width: 800, height: 600 })
 * ```
 */
export function logAtomOp(
  groupId: string,
  atomKey: string,
  operation: 'read' | 'write' | 'subscribe' | 'unsubscribe',
  data?: Record<string, unknown>
): void {
  const prefix = `[Atom:${groupId}:${atomKey}]`
  const timestamp = new Date().toISOString()

  if (import.meta.env?.DEV) {
    console.log(`${prefix} ${operation}`, timestamp, data ?? '')
  }
}
