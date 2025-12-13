/**
 * usePanelPersistence Hook
 *
 * localStorage persistence for floating panel positions and z-index order.
 *
 * @pattern localStorage + debounced writes
 * @module
 */

import { useCallback, useRef } from 'react'
import type {
  PanelStorage,
  PanelPosition,
  PersistedPanelState,
  UsePanelPersistenceReturn,
} from '../types'

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = 'tmnl-floating-panels'
const DEBOUNCE_MS = 250

// =============================================================================
// Helpers
// =============================================================================

/**
 * Safely parse JSON from localStorage
 */
function parseStorage(raw: string | null): PanelStorage | null {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    // Basic shape validation
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.panels === 'object' &&
      Array.isArray(parsed.order)
    ) {
      return parsed as PanelStorage
    }
  } catch {
    // Invalid JSON — ignore
  }

  return null
}

/**
 * Safely write to localStorage
 */
function writeStorage(storage: PanelStorage): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage))
  } catch {
    // Storage quota exceeded or unavailable — fail silently
  }
}

/**
 * Create empty storage object
 */
function emptyStorage(): PanelStorage {
  return {
    panels: {},
    order: [],
  }
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook for persisting floating panel positions to localStorage.
 *
 * @param persistKey Optional custom storage key (defaults to 'tmnl-floating-panels')
 *
 * @example
 * ```tsx
 * const persistence = usePanelPersistence()
 *
 * // On mount, restore positions
 * useEffect(() => {
 *   const stored = persistence.load()
 *   if (stored) {
 *     // Apply stored positions to panels
 *   }
 * }, [])
 *
 * // On drag end, persist position
 * const handleDragEnd = (id: string, position: PanelPosition) => {
 *   persistence.updatePosition(id, position)
 * }
 * ```
 */
export function usePanelPersistence(
  persistKey: string = STORAGE_KEY
): UsePanelPersistenceReturn {
  // Debounce timer ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cached storage ref for debounced writes
  const pendingStorageRef = useRef<PanelStorage | null>(null)

  /**
   * Flush pending storage write immediately
   */
  const flush = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    if (pendingStorageRef.current) {
      writeStorage(pendingStorageRef.current)
      pendingStorageRef.current = null
    }
  }, [])

  /**
   * Schedule a debounced write
   */
  const scheduleWrite = useCallback(
    (storage: PanelStorage) => {
      pendingStorageRef.current = storage

      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      debounceRef.current = setTimeout(() => {
        flush()
      }, DEBOUNCE_MS)
    },
    [flush]
  )

  /**
   * Load persisted state from storage
   */
  const load = useCallback((): PanelStorage | null => {
    if (typeof window === 'undefined') return null

    const raw = localStorage.getItem(persistKey)
    return parseStorage(raw)
  }, [persistKey])

  /**
   * Save full state to storage
   */
  const save = useCallback(
    (storage: PanelStorage): void => {
      scheduleWrite(storage)
    },
    [scheduleWrite]
  )

  /**
   * Update single panel position (merge with existing)
   */
  const updatePosition = useCallback(
    (id: string, position: PanelPosition): void => {
      const current = load() ?? emptyStorage()

      const existingPanel = current.panels[id] ?? {
        position: { x: 0, y: 0 },
        visibility: 'visible' as const,
      }

      current.panels[id] = {
        ...existingPanel,
        position,
      }

      scheduleWrite(current)
    },
    [load, scheduleWrite]
  )

  /**
   * Update panel order (z-index stacking)
   */
  const updateOrder = useCallback(
    (order: string[]): void => {
      const current = load() ?? emptyStorage()
      current.order = order
      scheduleWrite(current)
    },
    [load, scheduleWrite]
  )

  /**
   * Clear all persisted state
   */
  const clear = useCallback((): void => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    pendingStorageRef.current = null

    try {
      localStorage.removeItem(persistKey)
    } catch {
      // Fail silently
    }
  }, [persistKey])

  return {
    load,
    save,
    updatePosition,
    updateOrder,
    clear,
  }
}

export default usePanelPersistence
