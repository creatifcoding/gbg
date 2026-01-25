/**
 * SearchHydrationBridge
 *
 * Automatically hydrates Kori entities when search results change.
 * Place inside GeointShell to enable search→entity hydration.
 *
 * @example
 * ```tsx
 * <GeointShell>
 *   <SearchProvider>
 *     <SearchHydrationBridge />
 *     <SearchPanel />
 *   </SearchProvider>
 *   ...
 * </GeointShell>
 * ```
 *
 * @module geoint/components/SearchHydrationBridge
 */

import { memo, useEffect, useRef } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { resultsAtom, searchStatusAtom } from '../atoms'
import { useKoriBridgeOptional } from '../hooks'

export interface SearchHydrationBridgeProps {
  /**
   * Enable/disable auto-hydration.
   * @default true
   */
  enabled?: boolean

  /**
   * Clear stale entities before hydrating new ones.
   * @default true
   */
  clearStale?: boolean

  /**
   * Callback when hydration completes.
   */
  onHydrated?: (entityCount: number) => void

  /**
   * Callback when hydration fails.
   */
  onError?: (error: Error) => void
}

/**
 * Bridge that automatically hydrates entities from search results.
 *
 * This is a renderless component that:
 * 1. Watches resultsAtom for changes
 * 2. When search completes, calls bridge.hydrateFromSearch
 * 3. Entities become available via useGeointEntity hooks
 */
export const SearchHydrationBridge = memo(function SearchHydrationBridge({
  enabled = true,
  clearStale = true,
  onHydrated,
  onError,
}: SearchHydrationBridgeProps) {
  const bridge = useKoriBridgeOptional()
  const status = useAtomValue(searchStatusAtom)
  const results = useAtomValue(resultsAtom)
  const previousResultsRef = useRef(results)
  const isHydratingRef = useRef(false)

  useEffect(() => {
    // Skip if disabled or no bridge
    if (!enabled || !bridge) return

    // Only hydrate when search completes and results changed
    if (status !== 'completed') return
    if (results === previousResultsRef.current) return
    if (results.length === 0) return
    if (isHydratingRef.current) return

    // Update ref before async operation
    previousResultsRef.current = results
    isHydratingRef.current = true

    // Hydrate entities
    const hydrate = async () => {
      try {
        // Clear stale first if enabled
        if (clearStale) {
          await bridge.ops.clearStale()
        }

        // Hydrate from results
        const spawned = await bridge.ops.hydrateFromSearch(results)

        console.log('[SearchHydrationBridge] Hydrated', spawned.length, 'entities')
        onHydrated?.(spawned.length)
      } catch (err) {
        console.error('[SearchHydrationBridge] Hydration failed:', err)
        onError?.(err instanceof Error ? err : new Error(String(err)))
      } finally {
        isHydratingRef.current = false
      }
    }

    hydrate()
  }, [enabled, bridge, status, results, clearStale, onHydrated, onError])

  // Clear entities when search is idle (no results)
  useEffect(() => {
    if (!enabled || !bridge) return
    if (status !== 'idle') return
    if (results.length > 0) return

    // Only clear if we had previous results
    if (previousResultsRef.current.length === 0) return

    previousResultsRef.current = results

    bridge.ops.clearNonPinned().catch((err) => {
      console.error('[SearchHydrationBridge] Clear failed:', err)
    })
  }, [enabled, bridge, status, results])

  // Renderless component
  return null
})

export default SearchHydrationBridge
