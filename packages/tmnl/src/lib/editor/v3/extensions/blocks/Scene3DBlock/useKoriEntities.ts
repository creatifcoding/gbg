/**
 * useKoriEntities Hook
 *
 * React hook that queries kori World for Renderable3D entities
 * and converts them to Scene3D EntityData format.
 *
 * Enables kori World as an alternative entity source for Scene3DBlock.
 *
 * @module editor/v3/extensions/blocks/Scene3DBlock/useKoriEntities
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { Atom } from '@effect-atom/atom-react'
import { Effect, Layer, Scope } from 'effect'
import { KoriWorld, KoriWorldLive, type KoriEntity } from '@/lib/kori/services/world'
import type { TraitId } from '@/lib/kori/schemas/trait'
import { entitiesToEntityData } from './kori-bridge'
import type { EntityData } from './atoms'

// =============================================================================
// Types
// =============================================================================

export interface UseKoriEntitiesOptions {
  /** Polling interval in ms (default: 100) */
  pollInterval?: number
  /** Enable polling (default: true when enabled) */
  enablePolling?: boolean
  /** Enable the hook (default: true) */
  enabled?: boolean
}

export interface UseKoriEntitiesReturn {
  /** Entities from kori World as EntityData[] */
  entities: EntityData[]
  /** Whether query is loading */
  isLoading: boolean
  /** Last error */
  error: Error | null
  /** Refresh entities from kori World */
  refresh: () => void
  /** Entity count */
  count: number
}

// =============================================================================
// Runtime Atom for KoriWorld
// =============================================================================

/**
 * Runtime atom for kori World queries.
 * Provides scoped access to KoriWorld service.
 */
export const koriWorldRuntimeAtom = Atom.runtime(KoriWorldLive)

// =============================================================================
// Hook
// =============================================================================

/**
 * Query kori World for Renderable3D entities.
 *
 * Returns entities as Scene3D EntityData format for rendering.
 * Optionally polls for updates at configured interval.
 *
 * @example
 * ```tsx
 * function Scene3DWithKori() {
 *   const { entities, isLoading, error, refresh } = useKoriEntities({
 *     pollInterval: 100,
 *     enablePolling: true,
 *   })
 *
 *   // Use entities for rendering...
 * }
 * ```
 */
export function useKoriEntities(options: UseKoriEntitiesOptions = {}): UseKoriEntitiesReturn {
  const { pollInterval = 100, enablePolling = true, enabled = true } = options

  const [entities, setEntities] = useState<EntityData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * Query kori World for Renderable3D entities.
   */
  const queryEntities = useCallback(async () => {
    if (!enabled) return

    try {
      setIsLoading(true)

      // Use Atom.runtime to get access to KoriWorld
      const program = Effect.gen(function* () {
        const world = yield* KoriWorld
        const koriEntities = yield* world.queryWith('Renderable3D' as TraitId)
        return entitiesToEntityData(koriEntities)
      }).pipe(Effect.provide(KoriWorldLive))

      // Run the Effect
      const result = await Effect.runPromise(
        Effect.scoped(program)
      ).catch((e) => {
        console.error('[useKoriEntities] Query failed:', e)
        throw e
      })

      setEntities(result)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setIsLoading(false)
    }
  }, [enabled])

  /**
   * Set up polling.
   */
  useEffect(() => {
    if (!enabled || !enablePolling) return

    // Initial query
    queryEntities()

    // Set up polling interval
    intervalRef.current = setInterval(queryEntities, pollInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, enablePolling, pollInterval, queryEntities])

  /**
   * Manual refresh.
   */
  const refresh = useCallback(() => {
    queryEntities()
  }, [queryEntities])

  return {
    entities,
    isLoading,
    error,
    refresh,
    count: entities.length,
  }
}

// =============================================================================
// Effect-based Query (for use in Effect programs)
// =============================================================================

/**
 * Query kori World for Scene3D-compatible entities.
 * Returns Effect for use in Effect programs.
 */
export const queryKoriEntities = Effect.gen(function* () {
  const world = yield* KoriWorld
  const koriEntities = yield* world.queryWith('Renderable3D' as TraitId)
  return entitiesToEntityData(koriEntities)
})
