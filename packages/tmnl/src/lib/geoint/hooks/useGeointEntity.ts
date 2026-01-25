/**
 * useGeointEntity Hook
 *
 * Per-entity UI state management hook.
 * Provides reactive access to entity state and mutation operations.
 *
 * IMPORTANT: Components using this hook must be wrapped in GeointRegistryProvider.
 *
 * @module geoint/hooks/useGeointEntity
 */

import { useCallback, useMemo } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import {
  entityUIStateFamily,
  entityAnimationFamily,
  entityLiveDataFamily,
  entityOps,
  type EntityUIState,
  type EntityAnimationState,
  type EntityLiveData,
} from '../kori/entity-atoms'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UseGeointEntityResult {
  // State
  readonly uiState: EntityUIState
  readonly animation: EntityAnimationState
  readonly liveData: EntityLiveData | null

  // Derived flags
  readonly isSelected: boolean
  readonly isHovered: boolean
  readonly isPinned: boolean
  readonly isLive: boolean
  readonly isAnimating: boolean

  // Actions
  readonly select: () => void
  readonly deselect: () => void
  readonly toggleSelect: () => void
  readonly selectOnly: () => void
  readonly hover: () => void
  readonly unhover: () => void
  readonly pin: () => void
  readonly unpin: () => void
  readonly togglePin: () => void
  readonly expand: () => void
  readonly collapse: () => void
  readonly toggleExpand: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook for per-entity UI state and actions.
 *
 * @example
 * ```tsx
 * function EntityCard({ entityId }: { entityId: string }) {
 *   const entity = useGeointEntity(entityId)
 *
 *   return (
 *     <div
 *       className={cn(
 *         entity.isSelected && 'ring-2 ring-accent',
 *         entity.isHovered && 'bg-surface-2'
 *       )}
 *       onClick={entity.toggleSelect}
 *       onMouseEnter={entity.hover}
 *       onMouseLeave={entity.unhover}
 *     >
 *       {entity.liveData?.label}
 *       {entity.isPinned && <PinIcon />}
 *     </div>
 *   )
 * }
 * ```
 */
export function useGeointEntity(entityId: string): UseGeointEntityResult {
  // Subscribe to entity-specific atoms (registry provided via context)
  const uiAtom = entityUIStateFamily(entityId)
  const animationAtom = entityAnimationFamily(entityId)
  const liveDataAtom = entityLiveDataFamily(entityId)

  const uiState = useAtomValue(uiAtom)
  const animation = useAtomValue(animationAtom)
  const liveData = useAtomValue(liveDataAtom)

  // Memoized actions (stable references)
  const select = useCallback(() => entityOps.select(entityId), [entityId])
  const deselect = useCallback(() => entityOps.deselect(entityId), [entityId])
  const toggleSelect = useCallback(() => entityOps.toggleSelect(entityId), [entityId])
  const selectOnly = useCallback(() => entityOps.selectOnly(entityId), [entityId])
  const hover = useCallback(() => entityOps.hover(entityId), [entityId])
  const unhover = useCallback(() => entityOps.unhover(entityId), [entityId])
  const pin = useCallback(() => entityOps.pin(entityId), [entityId])
  const unpin = useCallback(() => entityOps.unpin(entityId), [entityId])
  const togglePin = useCallback(() => entityOps.togglePin(entityId), [entityId])
  const expand = useCallback(() => entityOps.expand(entityId), [entityId])
  const collapse = useCallback(() => entityOps.collapse(entityId), [entityId])
  const toggleExpand = useCallback(() => entityOps.toggleExpand(entityId), [entityId])

  return useMemo(
    () => ({
      // State
      uiState,
      animation,
      liveData,
      // Derived flags (from UI state)
      isSelected: uiState.selected,
      isHovered: uiState.hovered,
      isPinned: uiState.pinned,
      isLive: liveData?.isLive ?? false,
      isAnimating: animation.isAnimating,
      // Actions
      select,
      deselect,
      toggleSelect,
      selectOnly,
      hover,
      unhover,
      pin,
      unpin,
      togglePin,
      expand,
      collapse,
      toggleExpand,
    }),
    [
      uiState,
      animation,
      liveData,
      select,
      deselect,
      toggleSelect,
      selectOnly,
      hover,
      unhover,
      pin,
      unpin,
      togglePin,
      expand,
      collapse,
      toggleExpand,
    ]
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight Variants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lightweight hook for just UI state (no live data subscription).
 * Use when you only need selection/hover state.
 */
export function useGeointEntityUI(entityId: string) {
  const uiAtom = entityUIStateFamily(entityId)
  const uiState = useAtomValue(uiAtom)

  return useMemo(
    () => ({
      selected: uiState.selected,
      hovered: uiState.hovered,
      expanded: uiState.expanded,
      highlighted: uiState.highlighted,
      pinned: uiState.pinned,
      viewed: uiState.viewed,
      select: () => entityOps.select(entityId),
      deselect: () => entityOps.deselect(entityId),
      toggleSelect: () => entityOps.toggleSelect(entityId),
    }),
    [uiState, entityId]
  )
}

/**
 * Hook for entity animation state only.
 */
export function useGeointEntityAnimation(entityId: string): EntityAnimationState {
  const animationAtom = entityAnimationFamily(entityId)
  return useAtomValue(animationAtom)
}

/**
 * Hook for entity live data only.
 */
export function useGeointEntityLiveData(entityId: string): EntityLiveData | null {
  const liveDataAtom = entityLiveDataFamily(entityId)
  return useAtomValue(liveDataAtom)
}
