/**
 * StateSyncService — Bidirectional Component State Management
 *
 * Manages per-element mutable state with atom-based reactivity.
 * State flows: LLM → initialState → atoms ↔ user mutations → change log.
 *
 * Registry-based (same pattern as StreamingJsonService):
 *   - Service methods mutate atoms via registry.set()
 *   - React subscribes via registry.subscribe()
 *   - Tests pass Registry.make() for isolation
 *
 * @module genifer/react/state-sync
 */

import * as Atom from '@effect-atom/atom/Atom'
import * as Registry from '@effect-atom/atom/Registry'
import { Option } from 'effect'
import {
  type InteractableElement,
  StateChange,
  type StateChangeBatch,
} from '../core/interactable.js'

// =============================================================================
// Atoms
// =============================================================================

/**
 * Per-element state map.
 * Key = element key, Value = Record<fieldName, currentValue>
 */
export const elementStatesAtom = Atom.make<ReadonlyMap<string, Record<string, unknown>>>(
  new Map(),
).pipe(Atom.keepAlive)

/**
 * Change log — ordered list of all state mutations.
 * Used for undo, replay, and server sync.
 */
const MAX_CHANGE_LOG = 500
export const changeLogAtom = Atom.make<readonly StateChange[]>([]).pipe(Atom.keepAlive)

/**
 * Dirty elements — keys of elements with unsaved state changes.
 */
export const dirtyElementsAtom = Atom.make<ReadonlySet<string>>(new Set()).pipe(Atom.keepAlive)

// =============================================================================
// Service Shape
// =============================================================================

export type StateSyncServiceShape = {
  /** Initialize state for an interactable element. */
  initElement: (element: InteractableElement) => void
  /** Get current state for an element. */
  getState: (elementKey: string) => Record<string, unknown> | undefined
  /** Set a single field on an element's state. Returns validation error or null. */
  setField: (elementKey: string, field: string, value: unknown, source?: 'user' | 'llm' | 'system') => string | null
  /** Set multiple fields atomically. Returns first validation error or null. */
  setFields: (elementKey: string, fields: Record<string, unknown>, source?: 'user' | 'llm' | 'system') => string | null
  /** Remove an element's state (on unmount). */
  removeElement: (elementKey: string) => void
  /** Clear all state. */
  reset: () => void
  /** Mark element as clean (after server sync). */
  markClean: (elementKey: string) => void
  /** The registry for atom access. */
  readonly registry: Registry.Registry
}

// =============================================================================
// Factory
// =============================================================================

// Track InteractableElement schemas for validation
const elementSchemas = new Map<string, InteractableElement>()

/**
 * Creates a StateSyncService bound to a Registry.
 *
 * In React: use the singleton (shared registry with other genifer services).
 * In tests: pass Registry.make() for isolation.
 */
export function createStateSyncService(
  registry: Registry.Registry = Registry.make(),
): StateSyncServiceShape {
  return {
    initElement(element: InteractableElement) {
      if (!element.isInteractable) return

      // Store schema for validation
      elementSchemas.set(element.key, element)

      // Initialize state from defaults
      const states = new Map(registry.get(elementStatesAtom))
      states.set(element.key, element.defaultState)
      registry.set(elementStatesAtom, states)
    },

    getState(elementKey: string) {
      return registry.get(elementStatesAtom).get(elementKey)
    },

    setField(elementKey, field, value, source = 'user') {
      // Validate against schema if available
      const schema = elementSchemas.get(elementKey)
      if (schema) {
        const error = schema.validateField(field, value)
        if (error) return error
      }

      const states = new Map(registry.get(elementStatesAtom))
      const current = states.get(elementKey)
      if (!current) return `Element not initialized: ${elementKey}`

      const previousValue = current[field]
      const nextState = { ...current, [field]: value }
      states.set(elementKey, nextState)
      registry.set(elementStatesAtom, states)

      // Log the change
      const change = new StateChange({
        elementKey,
        field,
        previousValue,
        nextValue: value,
        timestamp: Date.now(),
        source,
      })
      const log = registry.get(changeLogAtom)
      registry.set(
        changeLogAtom,
        log.length >= MAX_CHANGE_LOG ? [...log.slice(-250), change] : [...log, change],
      )

      // Mark dirty
      const dirty = new Set(registry.get(dirtyElementsAtom))
      dirty.add(elementKey)
      registry.set(dirtyElementsAtom, dirty)

      return null // valid
    },

    setFields(elementKey, fields, source = 'user') {
      for (const [field, value] of Object.entries(fields)) {
        const error = this.setField(elementKey, field, value, source)
        if (error) return error
      }
      return null
    },

    removeElement(elementKey) {
      elementSchemas.delete(elementKey)
      const states = new Map(registry.get(elementStatesAtom))
      states.delete(elementKey)
      registry.set(elementStatesAtom, states)
    },

    markClean(elementKey) {
      const dirty = new Set(registry.get(dirtyElementsAtom))
      dirty.delete(elementKey)
      registry.set(dirtyElementsAtom, dirty)
    },

    reset() {
      elementSchemas.clear()
      registry.set(elementStatesAtom, new Map())
      registry.set(changeLogAtom, [])
      registry.set(dirtyElementsAtom, new Set())
    },

    get registry() {
      return registry
    },
  }
}

// =============================================================================
// Singleton
// =============================================================================

let _instance: StateSyncServiceShape | null = null

export function getStateSyncService(): StateSyncServiceShape {
  if (!_instance) {
    _instance = createStateSyncService()
  }
  return _instance
}
