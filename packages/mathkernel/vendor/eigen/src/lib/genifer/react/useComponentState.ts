/**
 * useComponentState — Per-element bidirectional state hook
 *
 * Provides a useState-like API for interactable genifer components.
 * State is managed by StateSyncService (atom-based), not local useState.
 *
 * @module genifer/react/useComponentState
 */

'use client'

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import {
  elementStatesAtom,
  getStateSyncService,
  type StateSyncServiceShape,
} from './state-sync.js'
import type { InteractableElement } from '../core/interactable.js'

// =============================================================================
// Types
// =============================================================================

export interface UseComponentStateReturn {
  /** Current state for this element (or empty object if not initialized) */
  state: Record<string, unknown>
  /** Set a single field. Returns validation error or null. */
  setField: (field: string, value: unknown) => string | null
  /** Set multiple fields atomically. Returns first validation error or null. */
  setFields: (fields: Record<string, unknown>) => string | null
  /** Whether this element has unsaved changes */
  isDirty: boolean
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Per-element state management hook for interactable components.
 *
 * Automatically initializes state on mount and cleans up on unmount.
 *
 * Usage:
 * ```tsx
 * function MySlider({ element }: { element: InteractableElement }) {
 *   const { state, setField } = useComponentState(element)
 *
 *   return (
 *     <input
 *       type="range"
 *       value={state.value as number}
 *       onChange={(e) => setField('value', Number(e.target.value))}
 *     />
 *   )
 * }
 * ```
 */
export function useComponentState(element: InteractableElement): UseComponentStateReturn {
  const serviceRef = useRef<StateSyncServiceShape | null>(null)
  if (!serviceRef.current) {
    serviceRef.current = getStateSyncService()
  }
  const service = serviceRef.current
  const r = service.registry
  const key = element.key

  // Initialize state on mount, cleanup on unmount
  useEffect(() => {
    service.initElement(element)
    return () => {
      service.removeElement(key)
    }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to element states atom, extract this element's state
  const state = useSyncExternalStore(
    (cb) => r.subscribe(elementStatesAtom, cb),
    () => r.get(elementStatesAtom).get(key) ?? {},
    () => r.get(elementStatesAtom).get(key) ?? {},
  )

  // Stable callbacks
  const setField = useCallback(
    (field: string, value: unknown) => service.setField(key, field, value, 'user'),
    [service, key],
  )

  const setFields = useCallback(
    (fields: Record<string, unknown>) => service.setFields(key, fields, 'user'),
    [service, key],
  )

  // Dirty state (simplified — just check if key is in dirty set)
  const isDirty = useSyncExternalStore(
    (cb) => r.subscribe(elementStatesAtom, cb), // re-check on any state change
    () => {
      // We use the dirtyElementsAtom but subscribe to states for simplicity
      // (dirty updates happen alongside state updates)
      try {
        const { dirtyElementsAtom } = require('./state-sync.js')
        return r.get(dirtyElementsAtom).has(key)
      } catch {
        return false
      }
    },
    () => false,
  )

  return { state, setField, setFields, isDirty }
}
