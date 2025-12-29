/**
 * Cursor Persistence Hook
 *
 * Persists and restores cursor state to/from localStorage:
 * - Corner position preference
 * - Expanded/collapsed state
 */

import { useEffect } from 'react'
import { Atom } from '@effect-atom/atom'
import {
  currentCornerAtom,
  cursorStateAtom,
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
// Hook
// -----------------------------------------------------------------------------

/**
 * Hook to persist and restore cursor state.
 * Call this once in a root component (e.g., Cursor or PersistentOverlays).
 */
export function useCursorPersistence(): void {
  // Restore state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const { corner, isExpanded } = JSON.parse(saved) as PersistedState

        // Restore corner preference
        Atom.set(currentCornerAtom, corner)

        // Restore expanded state via actor
        if (isExpanded) {
          cursorActorOps.expand()
        }
      }
    } catch (e) {
      // Ignore parse errors
      console.warn('[useCursorPersistence] Failed to restore state:', e)
    }
  }, [])

  // Persist corner changes
  useEffect(() => {
    const unsubCorner = Atom.subscribe(currentCornerAtom, (corner) => {
      persistState(corner)
    })

    return unsubCorner
  }, [])

  // Persist expanded state changes
  useEffect(() => {
    const unsubSnapshot = Atom.subscribe(cursorSnapshotAtom, (snapshot) => {
      const state = getCursorState(snapshot)
      const isExpanded = state === 'chat' || state === 'expanding'
      const corner = Atom.get(currentCornerAtom)
      persistState(corner, isExpanded)
    })

    return unsubSnapshot
  }, [])
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function persistState(corner: CornerPreset, isExpanded?: boolean): void {
  try {
    // If isExpanded not provided, read from current snapshot
    const expanded = isExpanded ?? (() => {
      const snapshot = Atom.get(cursorSnapshotAtom)
      const state = getCursorState(snapshot)
      return state === 'chat' || state === 'expanding'
    })()

    const state: PersistedState = {
      corner,
      isExpanded: expanded,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('[useCursorPersistence] Failed to persist state:', e)
  }
}
