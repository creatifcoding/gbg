/**
 * GEOINT Card Actions
 *
 * Trait-derived entity actions for the radial command dial and context menus.
 * Actions are filtered by entity traits, context, and role.
 *
 * @module geoint/cards/actions
 */

import { Effect } from 'effect'
import type { ActionDefinition, ActionId } from './registry'
import type { ComposedEntity, TraitName } from './traits'
import { getTrait, hasTrait } from './traits'
import { flyTo, selectResult } from '../atoms'

// =============================================================================
// ACTION FACTORY HELPERS
// =============================================================================

/**
 * Create an ActionId with proper branding.
 */
const actionId = (id: string): ActionId => id as ActionId

/**
 * Type guard for specific trait presence.
 */
const hasTraits = (entity: ComposedEntity, ...traits: TraitName[]): boolean =>
  traits.every((t) => hasTrait(entity, t))

// =============================================================================
// NAVIGATION ACTIONS
// =============================================================================

/**
 * Fly to entity location on map.
 */
export const flyToAction: ActionDefinition = {
  id: actionId('flyTo'),
  label: 'Fly To',
  description: 'Center map on this entity',
  icon: 'navigation',
  hotkey: 'g',
  group: 'navigation',
  requiredTraits: ['Positionable'],
  execute: (entity) =>
    Effect.sync(() => {
      const pos = getTrait(entity, 'Positionable')
      if (pos) {
        flyTo(pos.position[0], pos.position[1], 14)
      }
    }),
}

/**
 * Follow entity (track mode).
 */
export const followAction: ActionDefinition = {
  id: actionId('follow'),
  label: 'Follow',
  description: 'Track this entity as it moves',
  icon: 'target',
  hotkey: 'f',
  group: 'navigation',
  requiredTraits: ['Positionable', 'Trackable'],
  execute: (entity) =>
    Effect.sync(() => {
      // TODO: Implement follow mode in viewport atom
      console.log('Follow:', entity.entityId)
    }),
}

/**
 * Show entity history/trajectory.
 */
export const showHistoryAction: ActionDefinition = {
  id: actionId('showHistory'),
  label: 'Show History',
  description: 'Display entity track history',
  icon: 'clock',
  hotkey: 'h',
  group: 'navigation',
  requiredTraits: ['Temporal', 'Trackable'],
  execute: (entity) =>
    Effect.sync(() => {
      // TODO: Implement history display
      console.log('Show history:', entity.entityId)
    }),
}

// =============================================================================
// SELECTION ACTIONS
// =============================================================================

/**
 * Select entity and show details.
 */
export const selectAction: ActionDefinition = {
  id: actionId('select'),
  label: 'Select',
  description: 'Select this entity for detailed view',
  icon: 'check-circle',
  hotkey: 'Enter',
  group: 'primary',
  requiredTraits: [], // Available for all entities
  execute: (entity) =>
    Effect.sync(() => {
      // TODO: Bridge to actual SearchResultItem from entity
      console.log('Select:', entity.entityId)
    }),
}

/**
 * Add to multi-selection.
 */
export const addToSelectionAction: ActionDefinition = {
  id: actionId('addToSelection'),
  label: 'Add to Selection',
  description: 'Add to current selection',
  icon: 'plus-circle',
  hotkey: 'Shift+Enter',
  group: 'secondary',
  requiredTraits: [],
  execute: (entity) =>
    Effect.sync(() => {
      // TODO: Implement multi-selection
      console.log('Add to selection:', entity.entityId)
    }),
}

// =============================================================================
// DATA ACTIONS
// =============================================================================

/**
 * Copy entity ID to clipboard.
 */
export const copyIdAction: ActionDefinition = {
  id: actionId('copyId'),
  label: 'Copy ID',
  description: 'Copy entity identifier to clipboard',
  icon: 'clipboard',
  hotkey: 'c',
  group: 'secondary',
  requiredTraits: ['Identifiable'],
  execute: (entity) =>
    Effect.tryPromise({
      try: async () => {
        const ident = getTrait(entity, 'Identifiable')
        if (ident) {
          await navigator.clipboard.writeText(ident.primaryId)
        }
      },
      catch: (e) => new Error(`Failed to copy: ${e}`),
    }),
}

/**
 * Copy coordinates to clipboard.
 */
export const copyCoordinatesAction: ActionDefinition = {
  id: actionId('copyCoordinates'),
  label: 'Copy Coordinates',
  description: 'Copy position to clipboard',
  icon: 'map-pin',
  hotkey: 'Shift+c',
  group: 'secondary',
  requiredTraits: ['Positionable'],
  execute: (entity) =>
    Effect.tryPromise({
      try: async () => {
        const pos = getTrait(entity, 'Positionable')
        if (pos) {
          const coords = `${pos.position[1].toFixed(6)}, ${pos.position[0].toFixed(6)}`
          await navigator.clipboard.writeText(coords)
        }
      },
      catch: (e) => new Error(`Failed to copy: ${e}`),
    }),
}

/**
 * Export entity data.
 */
export const exportAction: ActionDefinition = {
  id: actionId('export'),
  label: 'Export',
  description: 'Export entity data as JSON',
  icon: 'download',
  hotkey: 'e',
  group: 'secondary',
  requiredTraits: [],
  execute: (entity) =>
    Effect.sync(() => {
      // Convert traits map to plain object
      const data = {
        entityId: entity.entityId,
        traits: Object.fromEntries(entity.traits),
      }
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `entity-${entity.entityId}.json`
      a.click()
      URL.revokeObjectURL(url)
    }),
}

// =============================================================================
// CLASSIFICATION ACTIONS
// =============================================================================

/**
 * Reclassify entity (friend/foe).
 */
export const reclassifyAction: ActionDefinition = {
  id: actionId('reclassify'),
  label: 'Reclassify',
  description: 'Change entity classification',
  icon: 'shield',
  hotkey: 'r',
  group: 'primary',
  requiredTraits: ['Classifiable'],
  execute: (entity) =>
    Effect.sync(() => {
      // TODO: Open reclassification modal
      console.log('Reclassify:', entity.entityId)
    }),
}

/**
 * Mark as friendly.
 */
export const markFriendlyAction: ActionDefinition = {
  id: actionId('markFriendly'),
  label: 'Mark Friendly',
  description: 'Classify as friendly',
  icon: 'user-check',
  hotkey: '1',
  group: 'primary',
  requiredTraits: ['Classifiable'],
  execute: (entity) =>
    Effect.sync(() => {
      // TODO: Update classification
      console.log('Mark friendly:', entity.entityId)
    }),
  isEnabled: (entity) => {
    const cls = getTrait(entity, 'Classifiable')
    return cls?.classification !== 'friendly'
  },
}

/**
 * Mark as hostile.
 */
export const markHostileAction: ActionDefinition = {
  id: actionId('markHostile'),
  label: 'Mark Hostile',
  description: 'Classify as hostile',
  icon: 'user-x',
  hotkey: '2',
  group: 'danger',
  requiredTraits: ['Classifiable'],
  execute: (entity) =>
    Effect.sync(() => {
      // TODO: Update classification
      console.log('Mark hostile:', entity.entityId)
    }),
  isEnabled: (entity) => {
    const cls = getTrait(entity, 'Classifiable')
    return cls?.classification !== 'hostile'
  },
}

// =============================================================================
// IMAGERY ACTIONS
// =============================================================================

/**
 * View full resolution image.
 */
export const viewImageAction: ActionDefinition = {
  id: actionId('viewImage'),
  label: 'View Image',
  description: 'Open full resolution image',
  icon: 'image',
  hotkey: 'v',
  group: 'primary',
  requiredTraits: ['Imageable'],
  execute: (entity) =>
    Effect.sync(() => {
      const img = getTrait(entity, 'Imageable')
      if (img?.fullImageUrl) {
        window.open(img.fullImageUrl, '_blank')
      }
    }),
  isEnabled: (entity) => {
    const img = getTrait(entity, 'Imageable')
    return img?.fullImageUrl !== undefined
  },
}

/**
 * Download imagery.
 */
export const downloadImageryAction: ActionDefinition = {
  id: actionId('downloadImagery'),
  label: 'Download',
  description: 'Download imagery asset',
  icon: 'download',
  hotkey: 'd',
  group: 'secondary',
  requiredTraits: ['Imageable'],
  execute: (entity) =>
    Effect.sync(() => {
      const img = getTrait(entity, 'Imageable')
      if (img?.fullImageUrl) {
        const a = document.createElement('a')
        a.href = img.fullImageUrl
        a.download = `imagery-${entity.entityId}`
        a.click()
      }
    }),
  isEnabled: (entity) => {
    const img = getTrait(entity, 'Imageable')
    return img?.fullImageUrl !== undefined
  },
}

// =============================================================================
// ACTION REGISTRY
// =============================================================================

/**
 * All default actions.
 */
export const defaultActions: readonly ActionDefinition[] = [
  // Navigation
  flyToAction,
  followAction,
  showHistoryAction,
  // Selection
  selectAction,
  addToSelectionAction,
  // Data
  copyIdAction,
  copyCoordinatesAction,
  exportAction,
  // Classification
  reclassifyAction,
  markFriendlyAction,
  markHostileAction,
  // Imagery
  viewImageAction,
  downloadImageryAction,
]

/**
 * Get available actions for an entity.
 */
export const getAvailableActions = (entity: ComposedEntity): readonly ActionDefinition[] => {
  return defaultActions.filter((action) => {
    // Check required traits
    const hasRequiredTraits = action.requiredTraits.every((t) => hasTrait(entity, t))
    if (!hasRequiredTraits) return false

    // Check visibility
    if (action.isVisible && !action.isVisible(entity)) return false

    return true
  })
}

/**
 * Get actions grouped by category.
 */
export const getGroupedActions = (
  entity: ComposedEntity
): Record<ActionDefinition['group'], readonly ActionDefinition[]> => {
  const available = getAvailableActions(entity)
  const groups: Record<ActionDefinition['group'], ActionDefinition[]> = {
    primary: [],
    secondary: [],
    danger: [],
    navigation: [],
  }

  for (const action of available) {
    groups[action.group].push(action)
  }

  return groups
}

/**
 * Find action by hotkey.
 */
export const findActionByHotkey = (
  entity: ComposedEntity,
  hotkey: string
): ActionDefinition | undefined => {
  const available = getAvailableActions(entity)
  return available.find(
    (a) => a.hotkey?.toLowerCase() === hotkey.toLowerCase()
  )
}
