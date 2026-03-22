/**
 * React hooks for consuming decorated genifer classes via atoms.
 *
 * Every @state field is an Atom. Every @computed getter is a derived Atom.
 * These hooks subscribe React components to those atoms — re-render on change.
 *
 * @module genifer/decorators/hooks
 */

import { useMemo, useCallback } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import * as Atom from '@effect-atom/atom/Atom'
import { Effect } from 'effect'
import {
  actionGroupsAtom,
  registeredRpcsAtom,
  registeredEventsAtom,
  registeredToolsAtom,
  eventLogAtom,
  subscribeEvent,
  bootstrapResultAtom,
} from './bootstrap'
import type { ActionGroupInstance } from './action-group'

// =============================================================================
// useActionGroup — Subscribe to an ActionGroup's state + dispatch actions
// =============================================================================

/**
 * Subscribe to a hydrated ActionGroup by name.
 *
 * Returns typed state values (reactive), dispatch function, and atom refs.
 *
 * ```tsx
 * function FlightSearchBar() {
 *   const { state, dispatch, atoms } = useActionGroup('flight-search')
 *
 *   return (
 *     <div>
 *       <input
 *         value={state.query}
 *         onChange={e => Atom.set(atoms.query, e.target.value)}
 *       />
 *       <button onClick={() => dispatch('search')}>Search</button>
 *       {state.loading && <Spinner />}
 *       <span>{state.results.length} results</span>
 *     </div>
 *   )
 * }
 * ```
 */
export function useActionGroup(name: string): {
  /** Current state (reactive — re-renders on change) */
  state: Record<string, any>
  /** Dispatch an action by tag */
  dispatch: (tag: string, payload?: unknown) => void
  /** Raw atom refs for direct manipulation */
  atoms: Record<string, Atom.Atom<any>>
  /** Derived values from @computed getters */
  derived: Record<string, any>
  /** The full ActionGroup instance */
  instance: ActionGroupInstance | undefined
} {
  const allGroups = useAtomValue(actionGroupsAtom)
  const instance = allGroups.get(name)

  // Build reactive state by subscribing to each atom
  const state: Record<string, any> = {}
  const atomRefs: Record<string, Atom.Atom<any>> = {}
  const derivedValues: Record<string, any> = {}

  if (instance) {
    for (const [field, atom] of Array.from(instance.atoms.entries())) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      state[field] = useAtomValue(atom)
      atomRefs[field] = atom
    }
    for (const [getter, atom] of Array.from(instance.derived.entries())) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      derivedValues[getter] = useAtomValue(atom)
    }
  }

  const dispatch = useCallback((tag: string, payload?: unknown) => {
    if (!instance) return
    // Run the Effect — provide the ActionGroupAtoms layer
    Effect.runPromise(instance.dispatch(tag, payload)).catch(err => {
      console.error(`ActionGroup '${name}' dispatch '${tag}' failed:`, err)
    })
  }, [instance, name])

  return { state, dispatch, atoms: atomRefs, derived: derivedValues, instance }
}

// =============================================================================
// useActionGroupState — Subscribe to a single field (optimized)
// =============================================================================

/**
 * Subscribe to a single state field from an ActionGroup.
 * More efficient than useActionGroup when you only need one field.
 *
 * ```tsx
 * const query = useActionGroupState('flight-search', 'query')
 * const loading = useActionGroupState('flight-search', 'loading')
 * ```
 */
export function useActionGroupState<T = unknown>(name: string, field: string): T {
  const allGroups = useAtomValue(actionGroupsAtom)
  const instance = allGroups.get(name)
  const atom = instance?.atoms.get(field)

  // If atom exists, subscribe to it
  if (atom) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useAtomValue(atom) as T
  }

  return undefined as T
}

// =============================================================================
// useActionGroupDispatch — Just the dispatch function
// =============================================================================

/**
 * Get the dispatch function for an ActionGroup without subscribing to state.
 * Use when a component only triggers actions but doesn't display state.
 *
 * ```tsx
 * const dispatch = useActionGroupDispatch('flight-search')
 * <button onClick={() => dispatch('clear')}>Clear</button>
 * ```
 */
export function useActionGroupDispatch(name: string): (tag: string, payload?: unknown) => void {
  const allGroups = useAtomValue(actionGroupsAtom)
  const instance = allGroups.get(name)

  return useCallback((tag: string, payload?: unknown) => {
    if (!instance) return
    Effect.runPromise(instance.dispatch(tag, payload)).catch(err => {
      console.error(`ActionGroup '${name}' dispatch '${tag}' failed:`, err)
    })
  }, [instance, name])
}

// =============================================================================
// useGeniferEvents — Subscribe to dynamic events
// =============================================================================

/**
 * Subscribe to a dynamic event tag. Returns the latest event payload.
 *
 * ```tsx
 * const lastSearch = useGeniferEvent('FlightSearched')
 * // lastSearch = { query: 'DLH', resultCount: 42, timestamp: ... }
 * ```
 */
export function useGeniferEvent<T = unknown>(tag: string): T | undefined {
  const log = useAtomValue(eventLogAtom)
  // Find the last event with this tag
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].tag === tag) return log[i].payload as T
  }
  return undefined
}

/**
 * Subscribe to ALL events of a given tag. Returns the full history.
 */
export function useGeniferEvents<T = unknown>(tag: string): readonly T[] {
  const log = useAtomValue(eventLogAtom)
  return useMemo(
    () => log.filter(e => e.tag === tag).map(e => e.payload as T),
    [log, tag]
  )
}

// =============================================================================
// useGeniferRpcs — List available dynamic RPCs
// =============================================================================

export function useGeniferRpcs(): ReadonlySet<string> {
  return useAtomValue(registeredRpcsAtom)
}

// =============================================================================
// useGeniferTools — List available dynamic tools
// =============================================================================

export function useGeniferTools(): ReadonlySet<string> {
  return useAtomValue(registeredToolsAtom)
}

// =============================================================================
// useBootstrapResult — Full system status
// =============================================================================

export function useBootstrapResult() {
  return useAtomValue(bootstrapResultAtom)
}
