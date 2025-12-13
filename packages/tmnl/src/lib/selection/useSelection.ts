/**
 * useSelection Hook
 *
 * React hook for consuming selection state and operations.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isSelected, selectedIds, select, deselect } = useSelection()
 *
 *   return (
 *     <div
 *       data-selectable
 *       data-selectable-id="card-1"
 *       onClick={() => select('card-1')}
 *     >
 *       {isSelected('card-1') && <SelectionRing selected />}
 *       Content
 *     </div>
 *   )
 * }
 * ```
 *
 * @module
 */

import { useState, useEffect, useCallback } from 'react'
import {
  subscribeToSelection,
  subscribeToGroups,
  selectItem,
  selectItems,
  deselectItem,
  deselectAll,
  selectAll,
  groupSelected,
  ungroupSelected,
  getSelectedIds,
  isSelected as checkIsSelected,
  getItemGroup,
  getGroup,
  hasSelection,
  getSelectedCount,
} from './selection-stx'
import type { SelectionMode, GroupState } from './types'

// =============================================================================
// Hook
// =============================================================================

export interface UseSelectionReturn {
  /** Set of currently selected IDs */
  selectedIds: Set<string>
  /** Number of selected items */
  selectedCount: number
  /** Whether any items are selected */
  hasSelection: boolean
  /** Check if specific item is selected */
  isSelected: (id: string) => boolean
  /** Select a single item */
  select: (id: string, mode?: SelectionMode) => void
  /** Select multiple items */
  selectMany: (ids: string[], mode?: SelectionMode) => void
  /** Deselect a single item */
  deselect: (id: string) => void
  /** Deselect all items */
  deselectAll: () => void
  /** Select all provided items */
  selectAll: (ids: string[]) => void
  /** Toggle selection of an item */
  toggle: (id: string) => void
  /** Group currently selected items */
  group: () => string | null
  /** Ungroup currently selected items */
  ungroup: () => void
  /** Get group ID for an item */
  getItemGroup: (id: string) => string | undefined
  /** Get group by ID */
  getGroup: (groupId: string) => GroupState | undefined
  /** All groups */
  groups: Map<string, GroupState>
}

export function useSelection(): UseSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => getSelectedIds())
  const [groups, setGroups] = useState<Map<string, GroupState>>(() => new Map())

  // Subscribe to selection changes
  useEffect(() => {
    const unsubSelection = subscribeToSelection(setSelectedIds)
    const unsubGroups = subscribeToGroups(setGroups)
    return () => {
      unsubSelection()
      unsubGroups()
    }
  }, [])

  // Memoized operations
  const select = useCallback((id: string, mode: SelectionMode = 'replace') => {
    selectItem(id, mode)
  }, [])

  const selectMany = useCallback((ids: string[], mode: SelectionMode = 'replace') => {
    selectItems(ids, mode)
  }, [])

  const deselect = useCallback((id: string) => {
    deselectItem(id)
  }, [])

  const toggle = useCallback((id: string) => {
    selectItem(id, 'toggle')
  }, [])

  const group = useCallback(() => {
    return groupSelected()
  }, [])

  const ungroup = useCallback(() => {
    ungroupSelected()
  }, [])

  const isSelected = useCallback((id: string) => {
    return selectedIds.has(id)
  }, [selectedIds])

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    hasSelection: selectedIds.size > 0,
    isSelected,
    select,
    selectMany,
    deselect,
    deselectAll,
    selectAll,
    toggle,
    group,
    ungroup,
    getItemGroup,
    getGroup,
    groups,
  }
}

// =============================================================================
// Selectable Wrapper Hook
// =============================================================================

/**
 * Hook for making an item selectable.
 * Returns props to spread on the element.
 *
 * @example
 * ```tsx
 * function Card({ id }) {
 *   const { selectableProps, isSelected } = useSelectable(id)
 *
 *   return (
 *     <div {...selectableProps} className={isSelected ? 'selected' : ''}>
 *       Content
 *     </div>
 *   )
 * }
 * ```
 */
export interface UseSelectableReturn {
  /** Props to spread on the selectable element */
  selectableProps: {
    'data-selectable': true
    'data-selectable-id': string
    onClick: (e: React.MouseEvent) => void
  }
  /** Whether this item is selected */
  isSelected: boolean
  /** Select this item */
  select: (mode?: SelectionMode) => void
  /** Deselect this item */
  deselect: () => void
  /** Toggle this item's selection */
  toggle: () => void
}

export function useSelectable(id: string): UseSelectableReturn {
  const [isSelected, setIsSelected] = useState(() => checkIsSelected(id))

  // Subscribe to selection changes
  useEffect(() => {
    return subscribeToSelection((selectedIds) => {
      setIsSelected(selectedIds.has(id))
    })
  }, [id])

  const select = useCallback(
    (mode: SelectionMode = 'replace') => {
      selectItem(id, mode)
    },
    [id]
  )

  const deselect = useCallback(() => {
    deselectItem(id)
  }, [id])

  const toggle = useCallback(() => {
    selectItem(id, 'toggle')
  }, [id])

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      const mode: SelectionMode = e.shiftKey ? 'add' : e.ctrlKey || e.metaKey ? 'toggle' : 'replace'
      selectItem(id, mode)
    },
    [id]
  )

  return {
    selectableProps: {
      'data-selectable': true,
      'data-selectable-id': id,
      onClick: handleClick,
    },
    isSelected,
    select,
    deselect,
    toggle,
  }
}

export default useSelection
