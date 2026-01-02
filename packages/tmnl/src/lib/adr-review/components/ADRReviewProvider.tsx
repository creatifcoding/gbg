/**
 * ADRReviewProvider
 *
 * Context provider for ADR review state.
 * Wraps children with registry context and loads ADR data.
 */
import React, { createContext, useContext, useEffect, useMemo } from 'react'
import { useAtomValue } from 'effect-atom'
import { ADRReviewRegistryProvider, reviewRegistry, selectedADRAtom } from '../atoms'
import { loadADRUnits, selectADR } from '../atoms/operations'
import { extractUnitsFromMarkdown, getADRMetadata, type ADRMetadata } from '../parsing'

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

  // Load markdown content
  useEffect(() => {
    if (markdown && adrId) {
      setIsLoading(true)
      try {
        // Parse markdown and extract units
        const units = extractUnitsFromMarkdown(markdown)
        loadADRUnits(adrId, units)

        // Extract metadata
        const meta = getADRMetadata(markdown)
        if (meta) setMetadata(meta)
      } finally {
        setIsLoading(false)
      }
    }
  }, [markdown, adrId])

  // Select ADR when adrId changes
  useEffect(() => {
    if (adrId) {
      selectADR(adrId)
    }
  }, [adrId])

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
