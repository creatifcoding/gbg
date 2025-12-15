/**
 * TMNL Variables — Persistence Layer
 *
 * localStorage adapter for persisting user customizations.
 * Uses Effect for error handling.
 */

import { Effect, Data, Schema } from 'effect'
import { Atom } from '@effect-atom/atom'
import { userValuesAtom, setUserValue, removeUserValue } from './atoms'
import type { ValueSource } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'tmnl:variables:user'

// ─────────────────────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────────────────────

/** Error reading from storage */
export class StorageReadError extends Data.TaggedError('StorageReadError')<{
  readonly cause: unknown
}> {}

/** Error writing to storage */
export class StorageWriteError extends Data.TaggedError('StorageWriteError')<{
  readonly cause: unknown
}> {}

/** Error parsing stored data */
export class StorageParseError extends Data.TaggedError('StorageParseError')<{
  readonly cause: unknown
}> {}

// ─────────────────────────────────────────────────────────────────────────────
// Storage Schema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schema for persisted variable values.
 */
const PersistedValue = Schema.Struct({
  value: Schema.Unknown,
  updatedAt: Schema.String, // ISO date string
})

const PersistedVariables = Schema.Record({
  key: Schema.String,
  value: PersistedValue,
})

// ─────────────────────────────────────────────────────────────────────────────
// Load from Storage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load persisted variables from localStorage.
 */
export const loadPersistedVariables = Effect.gen(function* () {
  // Read from localStorage
  const raw = yield* Effect.try({
    try: () => localStorage.getItem(STORAGE_KEY),
    catch: (cause) => new StorageReadError({ cause }),
  })

  if (!raw) {
    // No persisted data
    return
  }

  // Parse JSON
  const parsed = yield* Effect.try({
    try: () => JSON.parse(raw),
    catch: (cause) => new StorageParseError({ cause }),
  })

  // Validate against schema
  const decoded = yield* Schema.decodeUnknown(PersistedVariables)(parsed).pipe(
    Effect.mapError((cause) => new StorageParseError({ cause }))
  )

  // Restore values to userValuesAtom
  for (const [variableId, stored] of Object.entries(decoded)) {
    setUserValue(variableId, stored.value)
  }

  yield* Effect.log(`Loaded ${Object.keys(decoded).length} persisted variables`)
})

/**
 * Synchronous load for initialization.
 * Catches errors and logs them.
 */
export function loadPersistedVariablesSync(): void {
  Effect.runSync(
    loadPersistedVariables.pipe(
      Effect.catchAll((err) =>
        Effect.logWarning('Failed to load persisted variables', err)
      )
    )
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Save to Storage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save current user values to localStorage.
 */
export const savePersistedVariables = Effect.gen(function* () {
  const userValues = Atom.get(userValuesAtom)

  // Convert to persistable format
  const toSave: Record<string, { value: unknown; updatedAt: string }> = {}
  for (const [variableId, stored] of userValues) {
    toSave[variableId] = {
      value: stored.value,
      updatedAt: stored.updatedAt.toISOString(),
    }
  }

  // Serialize and write
  yield* Effect.try({
    try: () => {
      const json = JSON.stringify(toSave, null, 2)
      localStorage.setItem(STORAGE_KEY, json)
    },
    catch: (cause) => new StorageWriteError({ cause }),
  })

  yield* Effect.log(`Saved ${Object.keys(toSave).length} variables to storage`)
})

/**
 * Synchronous save.
 * Catches errors and logs them.
 */
export function savePersistedVariablesSync(): void {
  Effect.runSync(
    savePersistedVariables.pipe(
      Effect.catchAll((err) =>
        Effect.logWarning('Failed to save persisted variables', err)
      )
    )
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Clear Storage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clear all persisted variables.
 */
export const clearPersistedVariables = Effect.gen(function* () {
  yield* Effect.try({
    try: () => localStorage.removeItem(STORAGE_KEY),
    catch: (cause) => new StorageWriteError({ cause }),
  })

  // Also clear the atom
  Atom.set(userValuesAtom, new Map())

  yield* Effect.log('Cleared all persisted variables')
})

/**
 * Synchronous clear.
 */
export function clearPersistedVariablesSync(): void {
  Effect.runSync(
    clearPersistedVariables.pipe(
      Effect.catchAll((err) =>
        Effect.logWarning('Failed to clear persisted variables', err)
      )
    )
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-Save Hook
// ─────────────────────────────────────────────────────────────────────────────

let saveTimeout: ReturnType<typeof setTimeout> | null = null

/**
 * Subscribe to userValuesAtom and auto-save on changes.
 * Debounced to avoid excessive writes.
 */
export function setupAutoSave(debounceMs = 1000): () => void {
  const unsubscribe = Atom.subscribe(userValuesAtom, () => {
    // Clear existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }

    // Schedule save
    saveTimeout = setTimeout(() => {
      savePersistedVariablesSync()
      saveTimeout = null
    }, debounceMs)
  })

  return () => {
    unsubscribe()
    if (saveTimeout) {
      clearTimeout(saveTimeout)
      // Save immediately on cleanup
      savePersistedVariablesSync()
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// React Hook for Persistence
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react'

/**
 * React hook that sets up variable persistence.
 * Call once at app root.
 *
 * @example
 * ```tsx
 * function App() {
 *   useVariablePersistence()
 *   return <YourApp />
 * }
 * ```
 */
export function useVariablePersistence(options?: { debounceMs?: number }): void {
  useEffect(() => {
    // Load on mount
    loadPersistedVariablesSync()

    // Setup auto-save
    const cleanup = setupAutoSave(options?.debounceMs ?? 1000)

    // Save on unmount
    return () => {
      cleanup()
    }
  }, [options?.debounceMs])
}
