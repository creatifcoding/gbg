/**
 * GEOINT Card Hooks
 *
 * React hooks for entity card rendering and interaction.
 * Integrates card registry with effect-atom for reactive state.
 *
 * @module geoint/cards/hooks
 */

import { useCallback, useMemo } from 'react'
import { Effect } from 'effect'
import { Atom } from '@effect-atom/atom'
import { useAtomValue } from '@effect-atom/atom-react'
import type { SearchResultItem } from '../schemas'
import type {
  ComposedEntity,
  TraitName,
  AnyTrait,
} from './traits'
import { hasTrait, getTrait } from './traits'
import type {
  RenderContext,
  CardSlots,
  ActionDefinition,
} from './registry'
import { searchResultToEntity } from './registry'
import { getAvailableActions, getGroupedActions, findActionByHotkey } from './actions'
import { getRenderersForContext } from './renderers'
import {
  selectedResultAtom,
  hoveredResultAtom,
} from '../atoms'

// =============================================================================
// ENTITY CONVERSION HOOK
// =============================================================================

/**
 * Convert a SearchResultItem to a ComposedEntity.
 */
export const useEntity = (result: SearchResultItem | null): ComposedEntity | null => {
  return useMemo(() => {
    if (!result) return null
    return searchResultToEntity(result)
  }, [result])
}

// =============================================================================
// TRAIT ACCESS HOOKS
// =============================================================================

/**
 * Check if entity has specific traits.
 */
export const useHasTraits = (
  entity: ComposedEntity | null,
  ...traits: TraitName[]
): boolean => {
  return useMemo(() => {
    if (!entity) return false
    return traits.every((t) => hasTrait(entity, t))
  }, [entity, ...traits])
}

/**
 * Get a specific trait from an entity.
 */
export const useTrait = <T extends TraitName>(
  entity: ComposedEntity | null,
  traitName: T
): Extract<AnyTrait, { _trait: T }> | undefined => {
  return useMemo(() => {
    if (!entity) return undefined
    return getTrait(entity, traitName)
  }, [entity, traitName])
}

/**
 * Get all traits from an entity.
 */
export const useTraits = (entity: ComposedEntity | null): readonly AnyTrait[] => {
  return useMemo(() => {
    if (!entity) return []
    return Array.from(entity.traits.values())
  }, [entity])
}

// =============================================================================
// CARD RENDERING HOOKS
// =============================================================================

/**
 * Get renderers for an entity.
 */
export const useRenderers = (
  entity: ComposedEntity | null,
  context: RenderContext
) => {
  return useMemo(() => {
    if (!entity) return []
    const traitNames = Array.from(entity.traits.keys())
    return getRenderersForContext(context, traitNames)
  }, [entity, context])
}

/**
 * Render card slots for an entity.
 */
export const useCardSlots = (
  entity: ComposedEntity | null,
  context: RenderContext,
  isSelected: boolean = false,
  isHovered: boolean = false
): CardSlots => {
  return useMemo(() => {
    if (!entity) return {}

    const renderers = getRenderersForContext(context, Array.from(entity.traits.keys()))
    const contributions: Array<{ slot: string; priority: number; content: React.ReactNode }> = []

    // Collect contributions from all renderers
    for (const renderer of renderers) {
      const trait = entity.traits.get(renderer.traitName as TraitName)
      if (!trait) continue

      const ctx = {
        trait,
        entityId: entity.entityId,
        renderContext: context,
        isSelected,
        isHovered,
      }

      contributions.push(...renderer.render(ctx))
    }

    // Merge contributions by slot, highest priority wins
    const slots: CardSlots = {}
    const slotPriorities = new Map<string, number>()

    for (const contrib of contributions) {
      const currentPriority = slotPriorities.get(contrib.slot) ?? -Infinity
      if (contrib.priority > currentPriority) {
        (slots as Record<string, React.ReactNode>)[contrib.slot] = contrib.content
        slotPriorities.set(contrib.slot, contrib.priority)
      }
    }

    return slots
  }, [entity, context, isSelected, isHovered])
}

// =============================================================================
// ACTION HOOKS
// =============================================================================

/**
 * Get available actions for an entity.
 */
export const useEntityActions = (
  entity: ComposedEntity | null
): readonly ActionDefinition[] => {
  return useMemo(() => {
    if (!entity) return []
    return getAvailableActions(entity)
  }, [entity])
}

/**
 * Get grouped actions for an entity (for radial dial sections).
 */
export const useGroupedActions = (
  entity: ComposedEntity | null
): Record<ActionDefinition['group'], readonly ActionDefinition[]> => {
  return useMemo(() => {
    if (!entity) {
      return { primary: [], secondary: [], danger: [], navigation: [] }
    }
    return getGroupedActions(entity)
  }, [entity])
}

/**
 * Execute an action on an entity.
 */
export const useActionExecutor = () => {
  return useCallback((action: ActionDefinition, entity: ComposedEntity) => {
    Effect.runPromise(action.execute(entity)).catch((err) => {
      console.error(`Action ${action.id} failed:`, err)
    })
  }, [])
}

/**
 * Find and execute action by hotkey.
 */
export const useHotkeyAction = (entity: ComposedEntity | null) => {
  const executeAction = useActionExecutor()

  return useCallback(
    (hotkey: string): boolean => {
      if (!entity) return false
      const action = findActionByHotkey(entity, hotkey)
      if (!action) return false
      if (action.isEnabled && !action.isEnabled(entity)) return false
      executeAction(action, entity)
      return true
    },
    [entity, executeAction]
  )
}

// =============================================================================
// SELECTION HOOKS
// =============================================================================

/**
 * Get currently selected entity.
 */
export const useSelectedEntity = (): ComposedEntity | null => {
  const result = useAtomValue(selectedResultAtom)
  return useEntity(result)
}

/**
 * Get currently hovered entity.
 */
export const useHoveredEntity = (): ComposedEntity | null => {
  const result = useAtomValue(hoveredResultAtom)
  return useEntity(result)
}

/**
 * Check if an entity is selected.
 */
export const useIsSelected = (entityId: string): boolean => {
  const selected = useSelectedEntity()
  return selected?.entityId === entityId
}

/**
 * Check if an entity is hovered.
 */
export const useIsHovered = (entityId: string): boolean => {
  const hovered = useHoveredEntity()
  return hovered?.entityId === entityId
}

// =============================================================================
// CARD STATE ATOMS
// =============================================================================

/**
 * Derived atom for selected entity.
 */
export const selectedEntityAtom = Atom.make((get): ComposedEntity | null => {
  const result = get(selectedResultAtom)
  if (!result) return null
  return searchResultToEntity(result)
})

/**
 * Derived atom for hovered entity.
 */
export const hoveredEntityAtom = Atom.make((get): ComposedEntity | null => {
  const result = get(hoveredResultAtom)
  if (!result) return null
  return searchResultToEntity(result)
})

/**
 * Derived atom for selected entity's actions.
 */
export const selectedEntityActionsAtom = Atom.make((get): readonly ActionDefinition[] => {
  const entity = get(selectedEntityAtom)
  if (!entity) return []
  return getAvailableActions(entity)
})

// =============================================================================
// CARD PROVIDER TYPES
// =============================================================================

/**
 * Card context value for nested components.
 */
export interface CardContextValue {
  readonly entity: ComposedEntity
  readonly renderContext: RenderContext
  readonly isSelected: boolean
  readonly isHovered: boolean
  readonly slots: CardSlots
  readonly actions: readonly ActionDefinition[]
  readonly executeAction: (action: ActionDefinition) => void
}
