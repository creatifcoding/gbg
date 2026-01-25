/**
 * ADRReviewProvider
 *
 * Context provider for ADR review state.
 * Wraps children with registry context and loads ADR data.
 */
import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import {
  ADRReviewRegistryProvider,
  reviewRegistry,
  selectedADRAtom,
  unitStatusFamily,
  unitCommentsFamily,
  makeUnitKey,
} from '../atoms'
import { loadADRUnits, selectADR, recomputeFilteredUnits, recomputeAllSummaries } from '../atoms/operations'
import { extractUnitsFromMarkdown, getADRMetadata, type ADRMetadata } from '../parsing'
import { hydrateADR, type HydratedState } from '../persistence'

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

interface ADRReviewContextValue {
  adrId: string | null
  metadata: ADRMetadata | null
  isLoading: boolean
}

const ADRReviewContext = createContext<ADRReviewContextValue>({
  adrId: null,
  metadata: null,
  isLoading: false,
})

export function useADRReviewContext() {
  return useContext(ADRReviewContext)
}

// -----------------------------------------------------------------------------
// Provider Props
// -----------------------------------------------------------------------------

export interface ADRReviewProviderProps {
  /**
   * The ADR ID to display.
   */
  adrId?: string

  /**
   * Raw markdown content for the ADR.
   * If provided, will be parsed and loaded.
   */
  markdown?: string

  /**
   * Pre-loaded ADR metadata.
   */
  metadata?: ADRMetadata

  /**
   * Children to render.
   */
  children: React.ReactNode
}

// -----------------------------------------------------------------------------
// Inner Provider (uses atoms)
// -----------------------------------------------------------------------------

function ADRReviewProviderInner({
  adrId,
  markdown,
  metadata: propMetadata,
  children,
}: ADRReviewProviderProps) {
  const [isLoading, setIsLoading] = React.useState(!!markdown)
  const [metadata, setMetadata] = React.useState<ADRMetadata | null>(propMetadata || null)
  const hydratedADRs = useRef<Set<string>>(new Set())

  /**
   * Apply hydrated state to atoms.
   * Called after loading persisted state from SQLite.
   */
  const applyHydratedState = (state: HydratedState) => {
    // Apply unit statuses
    for (const [key, status] of state.unitStatuses) {
      reviewRegistry.set(unitStatusFamily(key), status)
    }

    // Apply comments
    for (const [key, comments] of state.unitComments) {
      reviewRegistry.set(unitCommentsFamily(key), comments)
    }

    // Recompute derived state
    recomputeFilteredUnits()
    recomputeAllSummaries()
  }

  // Load markdown content, hydrate from persistence, and select ADR
  useEffect(() => {
    if (markdown && adrId) {
      setIsLoading(true)

      // Parse markdown and extract units first
      const units = extractUnitsFromMarkdown(markdown)
      console.log(`[ADRReview] Parsed ${units.length} units from ${adrId}`)

      // Load units into registry (sets default pending status)
      loadADRUnits(adrId, units)

      // Extract metadata
      const meta = getADRMetadata(markdown)
      if (meta) setMetadata(meta)

      // Hydrate from persistence (async, but we don't block on it)
      if (!hydratedADRs.current.has(adrId)) {
        hydratedADRs.current.add(adrId)

        hydrateADR(adrId)
          .then((state) => {
            if (state.unitStatuses.size > 0 || state.unitComments.size > 0) {
              console.log(`[ADRReview] Applying hydrated state for ${adrId}`)
              applyHydratedState(state)
            }
          })
          .catch((err) => {
            console.error(`[ADRReview] Hydration failed for ${adrId}:`, err)
          })
          .finally(() => {
            // Select ADR after hydration attempt (even if it fails)
            selectADR(adrId)
            setIsLoading(false)
          })
      } else {
        // Already hydrated, just select
        selectADR(adrId)
        setIsLoading(false)
      }
    }
  }, [markdown, adrId])

  // Also select ADR when only adrId changes (without markdown)
  useEffect(() => {
    if (adrId && !markdown) {
      selectADR(adrId)
    }
  }, [adrId, markdown])

  const contextValue = useMemo(
    () => ({
      adrId: adrId || null,
      metadata,
      isLoading,
    }),
    [adrId, metadata, isLoading]
  )

  return <ADRReviewContext.Provider value={contextValue}>{children}</ADRReviewContext.Provider>
}

// -----------------------------------------------------------------------------
// Provider (wraps with registry)
// -----------------------------------------------------------------------------

export function ADRReviewProvider(props: ADRReviewProviderProps) {
  return (
    <ADRReviewRegistryProvider>
      <ADRReviewProviderInner {...props} />
    </ADRReviewRegistryProvider>
  )
}
