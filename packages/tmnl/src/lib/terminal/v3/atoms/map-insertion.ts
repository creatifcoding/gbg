/**
 * Map Insertion Atoms
 *
 * Cross-context state bridge for terminal → editor MapBlock insertion.
 * Uses Atom-as-State doctrine for reactive updates across contexts.
 *
 * @module terminal/v3/atoms/map-insertion
 */

import { Atom, Registry } from '@effect-atom/atom'
import { Effect, Option } from 'effect'
import type { DetectedMapData } from '../schemas/map-output'
import { terminalRegistry } from '../terminal-stx'

// =============================================================================
// Types
// =============================================================================

/**
 * Status of a pending map insertion
 */
export type InsertionStatus = 'pending' | 'inserting' | 'completed' | 'failed'

/**
 * A map insertion queued for editor
 */
export interface PendingMapInsertion {
  /** Unique ID for this insertion */
  id: string
  /** Detected map data to insert */
  data: DetectedMapData
  /** Current insertion status */
  status: InsertionStatus
  /** When this was queued */
  timestamp: number
  /** Error message if failed */
  error?: string
}

// =============================================================================
// Core Atoms
// =============================================================================

/**
 * Queue of pending map insertions.
 * Maps are added here when user clicks "Open in Editor".
 */
export const pendingMapInsertionsAtom = Atom.make<readonly PendingMapInsertion[]>([])

/**
 * Whether the editor is currently available for insertion.
 * Set by EditorProvider when editor mounts/unmounts.
 */
export const editorAvailableAtom = Atom.make<boolean>(false)

// =============================================================================
// Derived Atoms
// =============================================================================

/**
 * Count of pending (not yet inserted) maps
 */
export const pendingCountAtom = Atom.make((get): number => {
  const insertions = get(pendingMapInsertionsAtom)
  return insertions.filter((p) => p.status === 'pending').length
})

/**
 * Latest pending insertion (first in queue)
 */
export const latestPendingAtom = Atom.make((get): Option.Option<PendingMapInsertion> => {
  const insertions = get(pendingMapInsertionsAtom)
  const pending = insertions.filter((p) => p.status === 'pending')
  return pending.length > 0 ? Option.some(pending[0]) : Option.none()
})

/**
 * Get insertion by ID
 */
export const insertionByIdAtom = (id: string) =>
  Atom.make((get): Option.Option<PendingMapInsertion> => {
    const insertions = get(pendingMapInsertionsAtom)
    const found = insertions.find((p) => p.id === id)
    return found ? Option.some(found) : Option.none()
  })

/**
 * Count of active insertions (inserting status)
 */
export const activeInsertionsCountAtom = Atom.make((get): number => {
  const insertions = get(pendingMapInsertionsAtom)
  return insertions.filter((p) => p.status === 'inserting').length
})

/**
 * All completed insertions
 */
export const completedInsertionsAtom = Atom.make((get): readonly PendingMapInsertion[] => {
  const insertions = get(pendingMapInsertionsAtom)
  return insertions.filter((p) => p.status === 'completed')
})

/**
 * All failed insertions
 */
export const failedInsertionsAtom = Atom.make((get): readonly PendingMapInsertion[] => {
  const insertions = get(pendingMapInsertionsAtom)
  return insertions.filter((p) => p.status === 'failed')
})

// =============================================================================
// Effect-based Operations
// =============================================================================

/**
 * Effect-based operations for map insertion.
 * Use these inside Effect.gen() blocks.
 */
export const mapInsertionOps = {
  /**
   * Queue a detected map for insertion
   */
  queue: (data: DetectedMapData) =>
    Effect.gen(function* () {
      const insertion: PendingMapInsertion = {
        id: data.id,
        data,
        status: 'pending',
        timestamp: Date.now(),
      }

      yield* Atom.update(pendingMapInsertionsAtom, (current) => [...current, insertion])

      return insertion
    }),

  /**
   * Start insertion process for a specific map
   */
  startInsertion: (id: string) =>
    Effect.gen(function* () {
      yield* Atom.update(pendingMapInsertionsAtom, (current) =>
        current.map((p) => (p.id === id ? { ...p, status: 'inserting' as const } : p))
      )
    }),

  /**
   * Mark insertion as completed
   */
  completeInsertion: (id: string) =>
    Effect.gen(function* () {
      yield* Atom.update(pendingMapInsertionsAtom, (current) =>
        current.map((p) => (p.id === id ? { ...p, status: 'completed' as const } : p))
      )
    }),

  /**
   * Mark insertion as failed
   */
  failInsertion: (id: string, error: string) =>
    Effect.gen(function* () {
      yield* Atom.update(pendingMapInsertionsAtom, (current) =>
        current.map((p) =>
          p.id === id ? { ...p, status: 'failed' as const, error } : p
        )
      )
    }),

  /**
   * Remove insertion from queue (cleanup)
   */
  removeInsertion: (id: string) =>
    Effect.gen(function* () {
      yield* Atom.update(pendingMapInsertionsAtom, (current) =>
        current.filter((p) => p.id !== id)
      )
    }),

  /**
   * Clear all completed insertions
   */
  clearCompleted: () =>
    Effect.gen(function* () {
      yield* Atom.update(pendingMapInsertionsAtom, (current) =>
        current.filter((p) => p.status !== 'completed')
      )
    }),

  /**
   * Retry a failed insertion
   */
  retryInsertion: (id: string) =>
    Effect.gen(function* () {
      yield* Atom.update(pendingMapInsertionsAtom, (current) =>
        current.map((p) =>
          p.id === id ? { ...p, status: 'pending' as const, error: undefined } : p
        )
      )
    }),

  /**
   * Set editor availability
   */
  setEditorAvailable: (available: boolean) =>
    Atom.set(editorAvailableAtom, available),
}

// =============================================================================
// Registry Operations (for React callbacks)
// =============================================================================

/**
 * Queue a map synchronously from React callback.
 * Use this in onClick handlers where you can't use Effect.gen.
 */
export function queueMapSync(
  registry: Registry.Registry,
  data: DetectedMapData
): PendingMapInsertion {
  const insertion: PendingMapInsertion = {
    id: data.id,
    data,
    status: 'pending',
    timestamp: Date.now(),
  }

  registry.set(pendingMapInsertionsAtom, [
    ...registry.get(pendingMapInsertionsAtom),
    insertion,
  ])

  return insertion
}

/**
 * Queue a map using terminal registry.
 * Convenience function when registry isn't available.
 */
export function queueMapTerminal(data: DetectedMapData): PendingMapInsertion {
  return queueMapSync(terminalRegistry, data)
}

/**
 * Update insertion status synchronously
 */
export function updateInsertionStatusSync(
  registry: Registry.Registry,
  id: string,
  status: InsertionStatus,
  error?: string
): void {
  registry.set(
    pendingMapInsertionsAtom,
    registry.get(pendingMapInsertionsAtom).map((p) =>
      p.id === id ? { ...p, status, error } : p
    )
  )
}

/**
 * Update insertion status using terminal registry
 */
export function updateInsertionStatusTerminal(
  id: string,
  status: InsertionStatus,
  error?: string
): void {
  updateInsertionStatusSync(terminalRegistry, id, status, error)
}

/**
 * Remove insertion synchronously
 */
export function removeInsertionSync(registry: Registry.Registry, id: string): void {
  registry.set(
    pendingMapInsertionsAtom,
    registry.get(pendingMapInsertionsAtom).filter((p) => p.id !== id)
  )
}

/**
 * Get editor availability synchronously
 */
export function isEditorAvailableSync(registry: Registry.Registry): boolean {
  return registry.get(editorAvailableAtom)
}

/**
 * Set editor availability synchronously
 */
export function setEditorAvailableSync(registry: Registry.Registry, available: boolean): void {
  registry.set(editorAvailableAtom, available)
}

// =============================================================================
// Initialization
// =============================================================================

/**
 * Initialize map insertion atoms in the registry.
 * Called during terminal initialization.
 */
export function initializeMapInsertionAtoms(): void {
  // Touch atoms to ensure they're registered
  terminalRegistry.get(pendingMapInsertionsAtom)
  terminalRegistry.get(editorAvailableAtom)
}
