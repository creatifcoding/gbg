/**
 * TableService Persistence
 *
 * localStorage helpers with versioned schemas and migration support.
 *
 * @module
 */

import { Effect, Schema, Option } from 'effect'
import {
  TableServiceState,
  PersistedState,
  STORAGE_KEY,
  CURRENT_VERSION,
  initialState,
} from './types'

// =============================================================================
// PERSISTENCE ERRORS
// =============================================================================

export class PersistenceError {
  readonly _tag = 'PersistenceError'
  constructor(
    readonly reason: 'parse' | 'validation' | 'storage' | 'migration',
    readonly message: string,
    readonly cause?: unknown
  ) {}
}

// =============================================================================
// DEEP MERGE UTILITY
// =============================================================================

/**
 * Deep merge two objects, with source taking precedence.
 * Handles nested objects, preserves arrays (doesn't merge them).
 */
export function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target }

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = source[key]
    const targetValue = target[key]

    if (sourceValue === undefined) {
      continue
    }

    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      // Recursively merge nested objects
      result[key] = deepMerge(targetValue as object, sourceValue as object) as T[keyof T]
    } else {
      // Overwrite with source value
      result[key] = sourceValue as T[keyof T]
    }
  }

  return result
}

// =============================================================================
// LOAD FROM STORAGE
// =============================================================================

/**
 * Load persisted state from localStorage.
 * Returns Option.none if no stored state or parse/validation fails.
 */
export const loadPersistedState = Effect.gen(function* () {
  // Read raw JSON
  const raw = yield* Effect.try({
    try: () => {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return null
      return JSON.parse(stored)
    },
    catch: (error) =>
      new PersistenceError('parse', 'Failed to parse stored state', error),
  })

  if (raw === null) {
    return Option.none<TableServiceState>()
  }

  // Validate envelope
  const envelope = yield* Effect.tryPromise({
    try: () => Schema.decodeUnknownPromise(PersistedState)(raw),
    catch: (error) =>
      new PersistenceError('validation', 'Invalid stored state schema', error),
  })

  // Check version and migrate if needed
  const migratedState = yield* migrateState(envelope.state, envelope.version)

  return Option.some(migratedState)
}).pipe(
  Effect.catchAll((error) => {
    // Log error but don't fail - just return empty state
    console.warn('[TableService] Persistence load failed:', error)
    return Effect.succeed(Option.none<TableServiceState>())
  })
)

// =============================================================================
// SAVE TO STORAGE
// =============================================================================

/**
 * Save state to localStorage with envelope.
 */
export const savePersistedState = (state: TableServiceState) =>
  Effect.gen(function* () {
    const envelope: PersistedState = {
      version: CURRENT_VERSION,
      state,
      lastPersistedAt: new Date(),
    }

    // Encode to JSON-safe format
    const encoded = yield* Effect.tryPromise({
      try: () => Schema.encodePromise(PersistedState)(envelope),
      catch: (error) =>
        new PersistenceError('validation', 'Failed to encode state', error),
    })

    // Write to localStorage
    yield* Effect.try({
      try: () => localStorage.setItem(STORAGE_KEY, JSON.stringify(encoded)),
      catch: (error) =>
        new PersistenceError('storage', 'Failed to write to localStorage', error),
    })
  }).pipe(
    Effect.catchAll((error) => {
      console.error('[TableService] Persistence save failed:', error)
      return Effect.void
    })
  )

// =============================================================================
// MIGRATION
// =============================================================================

/**
 * Migrate state from older versions to current.
 * Add migration steps as schema evolves.
 */
const migrateState = (
  state: TableServiceState,
  fromVersion: number
): Effect.Effect<TableServiceState, PersistenceError> =>
  Effect.gen(function* () {
    let current = state
    let version = fromVersion

    // Migration chain (add cases as needed)
    while (version < CURRENT_VERSION) {
      switch (version) {
        case 0:
          // Example: v0 → v1 migration
          current = { ...current, version: 1 }
          version = 1
          break
        default:
          // Unknown version, reset to initial
          yield* Effect.logWarning(
            `Unknown version ${version}, resetting to initial state`
          )
          return { ...initialState, version: CURRENT_VERSION }
      }
    }

    return current
  })

// =============================================================================
// DEBOUNCED PERSIST
// =============================================================================

/**
 * Create a debounced persist function.
 * Returns a function that schedules persistence after delay.
 */
export function createDebouncedPersist(delayMs: number = 500) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return (state: TableServiceState) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      Effect.runPromise(savePersistedState(state)).catch(console.error)
      timeoutId = null
    }, delayMs)
  }
}
