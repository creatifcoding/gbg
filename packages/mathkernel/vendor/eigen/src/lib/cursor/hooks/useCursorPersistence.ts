/**
 * Cursor Persistence Hook
 *
 * Persists and restores cursor state to/from localStorage:
 * - Corner position preference
 * - Expanded/collapsed state
 *
 * Uses registry subscriptions (not useAtomValue) to avoid React re-renders.
 */

import { useEffect, useRef } from 'react'
import {
  cursorRegistry,
  currentCornerAtom,
  cursorActorOps,
  cursorSnapshotAtom,
} from '../atoms'
import { getCursorState } from '../machines'
import type { CornerPreset } from '../schemas/position'

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const STORAGE_KEY = 'tmnl:cursor'

interface PersistedState {
  corner: CornerPreset
  isExpanded: boolean
}

// -----------------------------------------------------------------------------
// Persistence Logic (no React re-renders)
// -----------------------------------------------------------------------------

let hasRestored = false

/**
 * Persist current state to localStorage.
 * Called by registry subscriptions, not React effects.
 */
function persistState(): void {
  if (!hasRestored) return

  try {
    const corner = cursorRegistry.get(currentCornerAtom)
    const snapshot = cursorRegistry.get(cursorSnapshotAtom)
    const state = getCursorState(snapshot)
    const isExpanded = state === 'chat' || state === 'expanding'

    const persistedState: PersistedState = { corner, isExpanded }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState))
  } catch (e) {
    console.warn('[useCursorPersistence] Failed to persist state:', e)
  }
}

/**
 * Restore state from localStorage.
 * Called once on initialization.
 */
function restoreState(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as PersistedState

      // Restore corner preference
      cursorRegistry.set(currentCornerAtom, parsed.corner)

      // Restore expanded state via actor
      if (parsed.isExpanded) {
        cursorActorOps.expand()
      }
    }
  } catch (e) {
    console.warn('[useCursorPersistence] Failed to restore state:', e)
  }

  // Mark as restored after a tick
  requestAnimationFrame(() => {
    hasRestored = true
  })
}

// -----------------------------------------------------------------------------
// Registry Subscriptions (module-level, runs once)
// -----------------------------------------------------------------------------

let subscriptionsInitialized = false

function initSubscriptions(): void {
  if (subscriptionsInitialized) return
  subscriptionsInitialized = true

  // Subscribe to corner changes → persist
  cursorRegistry.subscribe(currentCornerAtom, () => {
    persistState()
  })

  // Subscribe to snapshot changes → persist (for expanded state)
  cursorRegistry.subscribe(cursorSnapshotAtom, () => {
    persistState()
  })
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * Hook to initialize cursor persistence.
 * Sets up registry subscriptions (once) and restores state on mount.
 * Does NOT cause React re-renders on atom changes.
 */
export function useCursorPersistence(): void {
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // Initialize subscriptions (module-level, runs once globally)
    initSubscriptions()

    // Restore state from localStorage
    restoreState()
  }, [])
}
