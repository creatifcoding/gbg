/**
 * useGeointSelection Hook
 *
 * Multi-selection management for GEOINT entities.
 * Provides reactive access to selection state and batch operations.
 *
 * @module geoint/hooks/useGeointSelection
 */

import { useCallback, useMemo } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { HashSet, Option } from 'effect'
import {
  selectedEntityIds,
  hoveredEntityId,
  pinnedEntityIds,
  liveEntityIds,
  entityOps,
  geointRegistry,
} from '../kori/entity-atoms'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UseGeointSelectionResult {
  // Selection state
  readonly selectedIds: readonly string[]
  readonly selectionCount: number
  readonly hasSelection: boolean
  readonly isMultiSelect: boolean

  // Hover state
  readonly hoveredId: string | null

  // Pinned state
  readonly pinnedIds: readonly string[]
  readonly pinnedCount: number

  // Live state
  readonly liveIds: readonly string[]
  readonly liveCount: number

  // Selection actions
  readonly selectAll: (ids: readonly string[]) => void
  readonly clearSelection: () => void
  readonly invertSelection: (allIds: readonly string[]) => void
  readonly selectRange: (ids: readonly string[]) => void

  // Batch actions
  readonly pinSelected: () => void
  readonly unpinSelected: () => void
  readonly expandSelected: () => void
  readonly collapseSelected: () => void

  // Queries
  readonly isSelected: (entityId: string) => boolean
  readonly isPinned: (entityId: string) => boolean
  readonly isLive: (entityId: string) => boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook for multi-selection management.
 *
 * @example
 * ```tsx
 * function SelectionToolbar() {
 *   const selection = useGeointSelection()
 *
 *   return (
 *     <div>
 *       <span>{selection.selectionCount} selected</span>
 *       <Button onClick={selection.pinSelected}>Pin All</Button>
 *       <Button onClick={selection.clearSelection}>Clear</Button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useGeointSelection(): UseGeointSelectionResult {
  // Subscribe to global selection atoms
  const selected = useAtomValue(selectedEntityIds)
  const hovered = useAtomValue(hoveredEntityId)
  const pinned = useAtomValue(pinnedEntityIds)
  const live = useAtomValue(liveEntityIds)

  // Convert to arrays for easier consumption
  const selectedIds = useMemo(() => HashSet.toValues(selected), [selected])
  const pinnedIds = useMemo(() => HashSet.toValues(pinned), [pinned])
  const liveIds = useMemo(() => HashSet.toValues(live), [live])
  const hoveredId = useMemo(() => Option.getOrNull(hovered), [hovered])

  // Selection actions
  const selectAll = useCallback((ids: readonly string[]) => {
    for (const id of ids) {
      entityOps.select(id)
    }
  }, [])

  const clearSelection = useCallback(() => {
    entityOps.clearSelection()
  }, [])

  const invertSelection = useCallback((allIds: readonly string[]) => {
    const currentSelected = geointRegistry.get(selectedEntityIds)
    for (const id of allIds) {
      if (HashSet.has(currentSelected, id)) {
        entityOps.deselect(id)
      } else {
        entityOps.select(id)
      }
    }
  }, [])

  const selectRange = useCallback((ids: readonly string[]) => {
    // Clear existing and select the range
    entityOps.clearSelection()
    for (const id of ids) {
      entityOps.select(id)
    }
  }, [])

  // Batch actions
  const pinSelected = useCallback(() => {
    const currentSelected = geointRegistry.get(selectedEntityIds)
    HashSet.forEach(currentSelected, (id) => {
      entityOps.pin(id)
    })
  }, [])

  const unpinSelected = useCallback(() => {
    const currentSelected = geointRegistry.get(selectedEntityIds)
    HashSet.forEach(currentSelected, (id) => {
      entityOps.unpin(id)
    })
  }, [])

  const expandSelected = useCallback(() => {
    const currentSelected = geointRegistry.get(selectedEntityIds)
    HashSet.forEach(currentSelected, (id) => {
      entityOps.expand(id)
    })
  }, [])

  const collapseSelected = useCallback(() => {
    const currentSelected = geointRegistry.get(selectedEntityIds)
    HashSet.forEach(currentSelected, (id) => {
      entityOps.collapse(id)
    })
  }, [])

  // Queries
  const isSelected = useCallback(
    (entityId: string) => HashSet.has(selected, entityId),
    [selected]
  )

  const isPinned = useCallback(
    (entityId: string) => HashSet.has(pinned, entityId),
    [pinned]
  )

  const isLive = useCallback(
    (entityId: string) => HashSet.has(live, entityId),
    [live]
  )

  return useMemo(
    () => ({
      // Selection state
      selectedIds,
      selectionCount: selectedIds.length,
      hasSelection: selectedIds.length > 0,
      isMultiSelect: selectedIds.length > 1,
      // Hover state
      hoveredId,
      // Pinned state
      pinnedIds,
      pinnedCount: pinnedIds.length,
      // Live state
      liveIds,
      liveCount: liveIds.length,
      // Selection actions
      selectAll,
      clearSelection,
      invertSelection,
      selectRange,
      // Batch actions
      pinSelected,
      unpinSelected,
      expandSelected,
      collapseSelected,
      // Queries
      isSelected,
      isPinned,
      isLive,
    }),
    [
      selectedIds,
      hoveredId,
      pinnedIds,
      liveIds,
      selectAll,
      clearSelection,
      invertSelection,
      selectRange,
      pinSelected,
      unpinSelected,
      expandSelected,
      collapseSelected,
      isSelected,
      isPinned,
      isLive,
    ]
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight Variants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook for just selection count (minimal subscription).
 */
export function useGeointSelectionCount(): number {
  const selected = useAtomValue(selectedEntityIds)
  return HashSet.size(selected)
}

/**
 * Hook for checking if a specific entity is selected.
 */
export function useIsGeointSelected(entityId: string): boolean {
  const selected = useAtomValue(selectedEntityIds)
  return HashSet.has(selected, entityId)
}

/**
 * Hook for hovered entity ID.
 */
export function useGeointHovered(): string | null {
  const hovered = useAtomValue(hoveredEntityId)
  return Option.getOrNull(hovered)
}
