/**
 * SearchFilterBridge - Wires FilterBar to SearchProvider
 *
 * Bridges the FilterBarWithMachine XState component to the SearchProvider
 * machine, translating filter changes into search machine events.
 *
 * @module geoint/components/SearchFilterBridge
 */

import { FC, useCallback, memo, type ReactNode } from 'react'
import {
  FilterBarWithMachine,
  type FilterBarWithMachineProps,
  type FilterBarState,
} from './FilterBar'
import {
  useSearch,
  useSearchSources,
  useSearchBounds,
  type SearchFilters,
} from '../machines/SearchProvider'
import type { IntelSource } from '../schemas'

// =============================================================================
// TYPES
// =============================================================================

export interface SearchFilterBridgeProps extends Omit<FilterBarWithMachineProps, 'onFiltersChange' | 'filters'> {
  /** Children to render inside FilterBar */
  children: ReactNode
  /** Callback when filters change (in addition to updating SearchProvider) */
  onFiltersChange?: (filters: FilterBarState) => void
}

// =============================================================================
// HELPER: Convert FilterBarState to SearchProvider calls
// =============================================================================

function filterBarStateToSearchFilters(state: FilterBarState): SearchFilters {
  return {
    minConfidence: state.minConfidence,
    maxAgeHours: null, // FilterBar doesn't have this; could be derived from query
    classifications: [...state.classifications],
    entityTypes: [], // FilterBar doesn't have entity types
  }
}

// =============================================================================
// BRIDGE COMPONENT
// =============================================================================

/**
 * SearchFilterBridge - Connects FilterBarWithMachine to SearchProvider.
 *
 * Usage:
 * ```tsx
 * <SearchProvider>
 *   <SearchFilterBridge>
 *     <FilterBarWithMachine.SourceChips showBatchButtons />
 *     <FilterBarWithMachine.ActiveFilterSummary />
 *   </SearchFilterBridge>
 * </SearchProvider>
 * ```
 */
export const SearchFilterBridge: FC<SearchFilterBridgeProps> = memo(function SearchFilterBridge({
  children,
  onFiltersChange: externalOnFiltersChange,
  initialPreset,
  initialExpandedGroups,
  className,
}) {
  // Get search provider methods
  const { setSources, setFilters, setBounds } = useSearch()

  // Get current search provider state for controlled mode
  const currentSources = useSearchSources()
  const currentBounds = useSearchBounds()

  // Convert SearchProvider state to FilterBarState format
  const filterBarState: FilterBarState = {
    sources: [...currentSources] as IntelSource[],
    classifications: ['friendly', 'hostile', 'neutral', 'unknown'], // Default
    minConfidence: 0,
    bounds: currentBounds,
    query: '',
  }

  // Handle filter changes from FilterBar
  const handleFiltersChange = useCallback((newFilters: FilterBarState) => {
    // Update sources in SearchProvider
    const newSources = [...newFilters.sources] as IntelSource[]
    setSources(newSources)

    // Update filters in SearchProvider
    const searchFilters = filterBarStateToSearchFilters(newFilters)
    setFilters(searchFilters)

    // Update bounds if changed
    if (newFilters.bounds !== currentBounds) {
      setBounds(newFilters.bounds)
    }

    // Call external handler if provided
    externalOnFiltersChange?.(newFilters)
  }, [setSources, setFilters, setBounds, currentBounds, externalOnFiltersChange])

  return (
    <FilterBarWithMachine
      filters={filterBarState}
      onFiltersChange={handleFiltersChange}
      initialPreset={initialPreset}
      initialExpandedGroups={initialExpandedGroups}
      className={className}
    >
      {children}
    </FilterBarWithMachine>
  )
})

// =============================================================================
// CONVENIENCE COMPONENT: Full FilterBar with SearchProvider integration
// =============================================================================

export interface IntegratedSearchFilterBarProps {
  /** Show source chips */
  showSources?: boolean
  /** Show batch buttons on source chips */
  showBatchButtons?: boolean
  /** Show preset selector */
  showPresets?: boolean
  /** Show classification chips */
  showClassifications?: boolean
  /** Show confidence slider */
  showConfidence?: boolean
  /** Show reset button */
  showReset?: boolean
  /** Compact mode */
  compact?: boolean
  /** Additional CSS class */
  className?: string
}

/**
 * IntegratedSearchFilterBar - Pre-composed FilterBar connected to SearchProvider.
 *
 * Usage:
 * ```tsx
 * <SearchProvider>
 *   <IntegratedSearchFilterBar
 *     showSources
 *     showPresets
 *     showBatchButtons
 *   />
 * </SearchProvider>
 * ```
 */
export const IntegratedSearchFilterBar: FC<IntegratedSearchFilterBarProps> = memo(
  function IntegratedSearchFilterBar({
    showSources = true,
    showBatchButtons = false,
    showPresets = true,
    showClassifications = false,
    showConfidence = false,
    showReset = true,
    compact = false,
    className,
  }) {
    return (
      <SearchFilterBridge className={className}>
        {/* Active filter summary with optional preset selector */}
        <FilterBarWithMachine.ActiveFilterSummary
          showPreset={showPresets}
          showReset={showReset}
        />

        {/* Source chips */}
        {showSources && (
          <FilterBarWithMachine.SourceChips
            compact={compact}
            showBatchButtons={showBatchButtons}
          />
        )}

        {/* Classification chips */}
        {showClassifications && (
          <FilterBarWithMachine.ClassificationChips compact={compact} />
        )}

        {/* Confidence slider */}
        {showConfidence && (
          <FilterBarWithMachine.ConfidenceSlider />
        )}
      </SearchFilterBridge>
    )
  }
)

// =============================================================================
// EXPORTS
// =============================================================================

export default SearchFilterBridge
