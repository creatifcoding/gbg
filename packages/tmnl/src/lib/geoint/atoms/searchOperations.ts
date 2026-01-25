/**
 * GEOINT Panel-Scoped Search Operations
 *
 * Pure functions that mutate panel-scoped search atoms.
 * All operations use geointRegistry for synchronous atom access.
 *
 * Pattern: get current state → compute new state → set new state
 *
 * @module geoint/atoms/searchOperations
 */

import { geointRegistry } from './index'
import type { PanelId } from './families'
import { getPanelAtoms } from './families'

// =============================================================================
// SEARCH OPERATIONS FACTORY
// =============================================================================

/**
 * Create panel-scoped search operations.
 *
 * Returns an object with search manipulation methods that operate on
 * panel-specific atoms via geointRegistry.
 *
 * @example
 * ```typescript
 * const panelId = asPanelId('panel-1')
 * const ops = createSearchOperations(panelId)
 *
 * ops.clearSearch()          // Clear search query and results
 * ops.toggleSearchPanel()    // Show/hide search sidebar
 * ops.executeSearch()        // Trigger search
 * ```
 */
export function createSearchOperations(panelId: PanelId) {
  const atoms = getPanelAtoms(panelId)

  return {
    /**
     * Clear search query and results.
     *
     * Resets:
     * - searchQueryAtom → null
     * - resultsAtom → []
     * - searchStatusAtom → 'idle'
     * - searchErrorAtom → null
     *
     * Bound: `Escape` key (when search is focused)
     */
    clearSearch(): void {
      geointRegistry.set(atoms.searchQueryAtom, null)
      geointRegistry.set(atoms.resultsAtom, [])
      geointRegistry.set(atoms.searchStatusAtom, 'idle')
      geointRegistry.set(atoms.searchErrorAtom, null)
    },

    /**
     * Toggle search panel visibility.
     *
     * Cycles sidebar between:
     * - 'default' → 'collapsed' (hide)
     * - 'collapsed' → 'default' (show)
     *
     * Bound: `Ctrl+/` key
     */
    toggleSearchPanel(): void {
      const current = geointRegistry.get(atoms.panelStateAtom)
      const newSidebarMode = current.sidebar === 'default' ? 'collapsed' : 'default'

      geointRegistry.set(atoms.panelStateAtom, {
        ...current,
        sidebar: newSidebarMode,
      })
    },

    /**
     * Execute search operation.
     *
     * Note: Actual search execution happens via searchOps.execute()
     * in the SearchProvider. This is a placeholder for keybinding.
     *
     * TODO: Wire to SearchProvider's search execution logic
     *
     * Bound: `Enter` key (when search input is focused)
     */
    executeSearch(): void {
      // Set status to searching (SearchProvider will handle actual execution)
      const currentQuery = geointRegistry.get(atoms.searchQueryAtom)

      if (currentQuery) {
        geointRegistry.set(atoms.searchStatusAtom, 'searching')
        // SearchProvider's Effect-based search will pick this up
      }
    },

    /**
     * Focus search input.
     *
     * Uses DOM query selector to find and focus search input.
     *
     * Bound: `/` key
     */
    focusSearch(): void {
      const input = document.querySelector<HTMLInputElement>('[data-geoint-search-input]')
      input?.focus()
    },

    /**
     * Get current search query (read-only).
     */
    getSearchQuery() {
      return geointRegistry.get(atoms.searchQueryAtom)
    },

    /**
     * Get current search status (read-only).
     */
    getSearchStatus() {
      return geointRegistry.get(atoms.searchStatusAtom)
    },
  }
}

/**
 * Search operations type (for type inference and testing).
 */
export type SearchOperations = ReturnType<typeof createSearchOperations>
