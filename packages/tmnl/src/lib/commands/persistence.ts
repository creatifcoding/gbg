/**
 * TMNL Commands — Persistence
 *
 * localStorage persistence for keybinding overrides.
 * Uses effect-atom subscription to auto-save changes.
 */

import { useEffect, useContext, useRef } from 'react'
import { RegistryContext } from '@effect-atom/atom-react'
import { bindingOverridesAtom } from './service'
import type { KeyBindingOverride } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'tmnl:keybinding-overrides'
const STORAGE_VERSION = 1

interface StoredData {
  version: number
  overrides: KeyBindingOverride[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load keybinding overrides from localStorage
 */
export function loadOverrides(): KeyBindingOverride[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []

    const data: StoredData = JSON.parse(raw)

    // Version check for future migrations
    if (data.version !== STORAGE_VERSION) {
      console.warn('[commands/persistence] Version mismatch, resetting overrides')
      localStorage.removeItem(STORAGE_KEY)
      return []
    }

    return data.overrides ?? []
  } catch (err) {
    console.error('[commands/persistence] Failed to load overrides:', err)
    return []
  }
}

/**
 * Save keybinding overrides to localStorage
 */
export function saveOverrides(overrides: readonly KeyBindingOverride[]): void {
  try {
    const data: StoredData = {
      version: STORAGE_VERSION,
      overrides: [...overrides],
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (err) {
    console.error('[commands/persistence] Failed to save overrides:', err)
  }
}

/**
 * Clear all persisted overrides
 */
export function clearPersistedOverrides(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.error('[commands/persistence] Failed to clear overrides:', err)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// React Hook
// ─────────────────────────────────────────────────────────────────────────────

export interface UseKeybindingPersistenceOptions {
  /** Enable debug logging */
  debug?: boolean
  /** Disable auto-load on mount */
  skipLoad?: boolean
  /** Disable auto-save on change */
  skipSave?: boolean
}

export interface UseKeybindingPersistenceResult {
  /** Whether initial load has completed */
  isLoaded: boolean
  /** Number of loaded overrides */
  loadedCount: number
}

/**
 * React hook that handles keybinding persistence.
 *
 * - Loads saved overrides into bindingOverridesAtom on mount
 * - Subscribes to changes and persists to localStorage
 *
 * @example
 * ```tsx
 * function App() {
 *   const { isLoaded } = useKeybindingPersistence()
 *
 *   if (!isLoaded) return <Loading />
 *   return <YourApp />
 * }
 * ```
 */
export function useKeybindingPersistence(
  options: UseKeybindingPersistenceOptions = {}
): UseKeybindingPersistenceResult {
  const { debug = false, skipLoad = false, skipSave = false } = options
  const registry = useContext(RegistryContext)
  const isLoadedRef = useRef(false)
  const loadedCountRef = useRef(0)

  // Load on mount
  useEffect(() => {
    if (skipLoad || isLoadedRef.current) return

    const overrides = loadOverrides()
    if (overrides.length > 0) {
      registry.set(bindingOverridesAtom, overrides)
      loadedCountRef.current = overrides.length
      if (debug) {
        console.log(`[commands/persistence] Loaded ${overrides.length} overrides`)
      }
    }
    isLoadedRef.current = true
  }, [registry, skipLoad, debug])

  // Subscribe to changes and save
  useEffect(() => {
    if (skipSave) return

    // Skip first emission (it's the current value)
    let isFirst = true

    const unsubscribe = registry.subscribe(bindingOverridesAtom, (overrides) => {
      if (isFirst) {
        isFirst = false
        return
      }

      saveOverrides(overrides)
      if (debug) {
        console.log(`[commands/persistence] Saved ${overrides.length} overrides`)
      }
    })

    return unsubscribe
  }, [registry, skipSave, debug])

  return {
    isLoaded: isLoadedRef.current,
    loadedCount: loadedCountRef.current,
  }
}
