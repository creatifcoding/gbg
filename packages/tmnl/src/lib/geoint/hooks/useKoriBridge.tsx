/**
 * useKoriBridge Hook
 *
 * React hook for accessing GeointKoriBridge operations.
 * Wraps Effect operations in React-friendly async callbacks.
 *
 * @module geoint/hooks/useKoriBridge
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  type ReactNode,
} from 'react'
import { Effect, Exit, ManagedRuntime } from 'effect'
import type { SearchResultItem } from '../schemas/search'
import {
  GeointKoriBridge,
  GeointKoriBridgeLive,
  type EntityId,
  type SpawnResult,
} from '../kori'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bridge operations exposed to React components.
 */
export interface KoriBridgeOps {
  /**
   * Hydrate entities from search results.
   * Clears stale entities and spawns new ones.
   */
  hydrateFromSearch: (results: readonly SearchResultItem[]) => Promise<readonly SpawnResult[]>

  /**
   * Spawn a single entity from a search result.
   */
  spawnEntity: (
    result: SearchResultItem,
    options?: { startLiveTracking?: boolean }
  ) => Promise<SpawnResult>

  /**
   * Despawn an entity.
   */
  despawn: (entityId: EntityId) => Promise<void>

  /**
   * Clear all non-pinned entities.
   */
  clearNonPinned: () => Promise<void>

  /**
   * Clear stale entities (not pinned, not live).
   */
  clearStale: () => Promise<void>

  /**
   * Get bridge statistics.
   */
  getStats: () => Promise<{
    totalEntities: number
    liveEntities: number
    pinnedEntities: number
    selectedEntities: number
  }>

  /**
   * Check if bridge is ready.
   */
  isReady: boolean
}

/**
 * Context value for Kori bridge.
 */
export interface KoriBridgeContextValue {
  readonly ops: KoriBridgeOps
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const KoriBridgeContext = createContext<KoriBridgeContextValue | null>(null)

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Access Kori bridge operations.
 *
 * @example
 * ```tsx
 * function SearchResults() {
 *   const { ops } = useKoriBridge()
 *
 *   const handleSearch = async (results: SearchResultItem[]) => {
 *     await ops.hydrateFromSearch(results)
 *   }
 * }
 * ```
 */
export function useKoriBridge(): KoriBridgeContextValue {
  const ctx = useContext(KoriBridgeContext)
  if (!ctx) {
    throw new Error('useKoriBridge must be used within KoriBridgeProvider')
  }
  return ctx
}

/**
 * Optional hook that returns null outside provider.
 */
export function useKoriBridgeOptional(): KoriBridgeContextValue | null {
  return useContext(KoriBridgeContext)
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Props
// ─────────────────────────────────────────────────────────────────────────────

export interface KoriBridgeProviderProps {
  readonly children: ReactNode
}

// ─────────────────────────────────────────────────────────────────────────────
// Effect Builders (typed correctly)
// ─────────────────────────────────────────────────────────────────────────────

const makeHydrateEffect = (results: readonly SearchResultItem[]) =>
  Effect.flatMap(GeointKoriBridge, (bridge) =>
    Effect.flatMap(bridge.clearStaleEntities(), () =>
      bridge.hydrateFromSearch(results)
    )
  )

const makeSpawnEffect = (
  result: SearchResultItem,
  options?: { startLiveTracking?: boolean }
) =>
  Effect.flatMap(GeointKoriBridge, (bridge) =>
    bridge.spawnFromSearchResult(result, options)
  )

const makeDespawnEffect = (entityId: EntityId) =>
  Effect.flatMap(GeointKoriBridge, (bridge) => bridge.despawn(entityId))

const makeClearNonPinnedEffect = () =>
  Effect.flatMap(GeointKoriBridge, (bridge) => bridge.clearNonPinned())

const makeClearStaleEffect = () =>
  Effect.flatMap(GeointKoriBridge, (bridge) => bridge.clearStaleEntities())

const makeGetStatsEffect = () =>
  Effect.flatMap(GeointKoriBridge, (bridge) => bridge.getStats())

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Provider for Kori bridge operations.
 *
 * Creates an Effect runtime and provides bridge operations to children.
 *
 * @example
 * ```tsx
 * <KoriBridgeProvider>
 *   <GeointShell>...</GeointShell>
 * </KoriBridgeProvider>
 * ```
 */
export function KoriBridgeProvider({
  children,
}: KoriBridgeProviderProps): React.ReactElement {
  // Create managed runtime for bridge service
  const runtimeRef = useRef<ManagedRuntime.ManagedRuntime<GeointKoriBridge, never> | null>(null)
  const isReadyRef = useRef(false)

  // Initialize runtime on mount
  useEffect(() => {
    const runtime = ManagedRuntime.make(GeointKoriBridgeLive)
    runtimeRef.current = runtime
    isReadyRef.current = true

    return () => {
      // Cleanup runtime on unmount
      runtime.dispose().catch(console.error)
      runtimeRef.current = null
      isReadyRef.current = false
    }
  }, [])

  /**
   * Run an effect using the managed runtime.
   */
  const runEffect = useCallback(
    async <A,>(effect: Effect.Effect<A, unknown, GeointKoriBridge>): Promise<A> => {
      const runtime = runtimeRef.current
      if (!runtime) {
        throw new Error('KoriBridge runtime not initialized')
      }

      const exit = await runtime.runPromiseExit(effect)
      if (Exit.isFailure(exit)) {
        console.error('[KoriBridge] Effect failed:', exit.cause)
        throw new Error('Bridge operation failed')
      }
      return exit.value
    },
    []
  )

  // ─────────────────────────────────────────────────────────────────────────
  // Operations
  // ─────────────────────────────────────────────────────────────────────────

  const hydrateFromSearch = useCallback(
    async (results: readonly SearchResultItem[]): Promise<readonly SpawnResult[]> => {
      return runEffect(makeHydrateEffect(results))
    },
    [runEffect]
  )

  const spawnEntity = useCallback(
    async (
      result: SearchResultItem,
      options?: { startLiveTracking?: boolean }
    ): Promise<SpawnResult> => {
      return runEffect(makeSpawnEffect(result, options))
    },
    [runEffect]
  )

  const despawn = useCallback(
    async (entityId: EntityId): Promise<void> => {
      return runEffect(makeDespawnEffect(entityId))
    },
    [runEffect]
  )

  const clearNonPinned = useCallback(async (): Promise<void> => {
    return runEffect(makeClearNonPinnedEffect())
  }, [runEffect])

  const clearStale = useCallback(async (): Promise<void> => {
    return runEffect(makeClearStaleEffect())
  }, [runEffect])

  const getStats = useCallback(async () => {
    return runEffect(makeGetStatsEffect())
  }, [runEffect])

  // ─────────────────────────────────────────────────────────────────────────
  // Context Value
  // ─────────────────────────────────────────────────────────────────────────

  const ops = useMemo<KoriBridgeOps>(
    () => ({
      hydrateFromSearch,
      spawnEntity,
      despawn,
      clearNonPinned,
      clearStale,
      getStats,
      get isReady() {
        return isReadyRef.current
      },
    }),
    [hydrateFromSearch, spawnEntity, despawn, clearNonPinned, clearStale, getStats]
  )

  const contextValue = useMemo<KoriBridgeContextValue>(
    () => ({ ops }),
    [ops]
  )

  return (
    <KoriBridgeContext.Provider value={contextValue}>
      {children}
    </KoriBridgeContext.Provider>
  )
}

export default KoriBridgeProvider
