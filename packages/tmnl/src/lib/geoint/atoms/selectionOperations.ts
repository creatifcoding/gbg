/**
 * GEOINT Panel-Scoped Selection Operations
 *
 * Pure functions that mutate panel-scoped selection atoms.
 * All operations use geointRegistry for synchronous atom access.
 *
 * Pattern: get current state → compute new state → set new state
 *
 * @module geoint/atoms/selectionOperations
 */

import { geointRegistry } from './index'
import type { PanelId } from './families'
import { getPanelAtoms } from './families'
import type { SearchResultItem } from '../schemas'

// =============================================================================
// SELECTION OPERATIONS FACTORY
// =============================================================================

/**
 * Create panel-scoped selection operations.
 *
 * Returns an object with selection manipulation methods that operate on
 * panel-specific atoms via geointRegistry.
 *
 * @example
 * ```typescript
 * const panelId = asPanelId('panel-1')
 * const ops = createSelectionOperations(panelId)
 *
 * ops.selectAll()           // Select all results
 * ops.clearSelection()      // Clear selection
 * ops.invertSelection()     // Invert current selection
 * ops.deleteSelected()      // Delete selected results
 * ```
 */
export function createSelectionOperations(panelId: PanelId) {
  const atoms = getPanelAtoms(panelId)

  return {
    /**
     * Select all results.
     *
     * Copies all items from resultsAtom to selectedResultsAtom.
     *
     * Bound: `Ctrl+A` key (when map/results are focused)
     */
    selectAll(): void {
      const allResults = geointRegistry.get(atoms.resultsAtom)
      geointRegistry.set(atoms.selectedResultsAtom, allResults)
    },

    /**
     * Clear selection.
     *
     * Resets selectedResultsAtom to empty array.
     *
     * Bound: `Escape` key (when selection exists)
     */
    clearSelection(): void {
      geointRegistry.set(atoms.selectedResultsAtom, [])
    },

    /**
     * Invert selection.
     *
     * Selects all results that are NOT currently selected.
     * Uses result IDs to determine which items to invert.
     *
     * Bound: `Ctrl+Shift+I` key
     */
    invertSelection(): void {
      const allResults = geointRegistry.get(atoms.resultsAtom)
      const currentSelection = geointRegistry.get(atoms.selectedResultsAtom)

      // Create Set of currently selected IDs for fast lookup
      const selectedIds = new Set(currentSelection.map((item) => item.id))

      // Filter to items that are NOT currently selected
      const inverted = allResults.filter((item) => !selectedIds.has(item.id))

      geointRegistry.set(atoms.selectedResultsAtom, inverted)
    },

    /**
     * Delete selected results.
     *
     * Removes selected items from resultsAtom and clears selection.
     *
     * Warning: This modifies the results list. If results are backed by
     * a service layer, consider dispatching a delete action instead.
     *
     * Bound: `Delete` or `Backspace` key (when selection exists)
     */
    deleteSelected(): void {
      const allResults = geointRegistry.get(atoms.resultsAtom)
      const selectedItems = geointRegistry.get(atoms.selectedResultsAtom)

      // Create Set of selected IDs for fast lookup
      const selectedIds = new Set(selectedItems.map((item) => item.id))

      // Filter out selected items
      const remaining = allResults.filter((item) => !selectedIds.has(item.id))

      // Update results and clear selection
      geointRegistry.set(atoms.resultsAtom, remaining)
      geointRegistry.set(atoms.selectedResultsAtom, [])
    },

    /**
     * Toggle selection of a specific result.
     *
     * If result is currently selected, removes it from selection.
     * If result is not selected, adds it to selection.
     *
     * @param result - Result item to toggle
     */
    toggleSelection(result: SearchResultItem): void {
      const currentSelection = geointRegistry.get(atoms.selectedResultsAtom)
      const selectedIds = new Set(currentSelection.map((item) => item.id))

      if (selectedIds.has(result.id)) {
        // Remove from selection
        const newSelection = currentSelection.filter(
          (item) => item.id !== result.id
        )
        geointRegistry.set(atoms.selectedResultsAtom, newSelection)
      } else {
        // Add to selection
        geointRegistry.set(atoms.selectedResultsAtom, [
          ...currentSelection,
          result,
        ])
      }
    },

    /**
     * Select a single result (clears previous selection).
     *
     * @param result - Result item to select
     */
    selectSingle(result: SearchResultItem): void {
      geointRegistry.set(atoms.selectedResultsAtom, [result])
    },

    /**
     * Add result to selection (without clearing).
     *
     * @param result - Result item to add
     */
    addToSelection(result: SearchResultItem): void {
      const currentSelection = geointRegistry.get(atoms.selectedResultsAtom)
      const selectedIds = new Set(currentSelection.map((item) => item.id))

      // Only add if not already selected
      if (!selectedIds.has(result.id)) {
        geointRegistry.set(atoms.selectedResultsAtom, [
          ...currentSelection,
          result,
        ])
      }
    },

    /**
     * Get current selection (read-only).
     */
    getSelection() {
      return geointRegistry.get(atoms.selectedResultsAtom)
    },

    /**
     * Get selection count (read-only).
     */
    getSelectionCount() {
      return geointRegistry.get(atoms.selectedResultsAtom).length
    },

    /**
     * Check if a result is selected (read-only).
     *
     * @param result - Result item to check
     */
    isSelected(result: SearchResultItem): boolean {
      const currentSelection = geointRegistry.get(atoms.selectedResultsAtom)
      return currentSelection.some((item) => item.id === result.id)
    },
  }
}

/**
 * Selection operations type (for type inference and testing).
 */
export type SelectionOperations = ReturnType<typeof createSelectionOperations>
