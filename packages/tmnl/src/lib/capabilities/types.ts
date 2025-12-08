/**
 * Capability Types
 *
 * Pure data interfaces for each capability.
 * Consumer owns render logic. Injector just attaches data.
 *
 * Naming convention: [Verb]-able
 */

import type { ReactNode } from 'react'
import type { AccentColor } from './tokens'

// =============================================================================
// CAPABILITY REGISTRY TYPE
// =============================================================================

/**
 * All known capabilities and their data shapes.
 * This is the single source of truth for capability types.
 */
export interface CapabilityMap {
  glowable: GlowableData
  tooltippable: TooltippableData
  pulsable: PulsableData
  badgeable: BadgeableData
  clickable: ClickableData
  draggable: DraggableData
  selectable: SelectableData
  focusable: FocusableData
}

export type CapabilityName = keyof CapabilityMap

// =============================================================================
// INDIVIDUAL CAPABILITY DATA SHAPES
// =============================================================================

/**
 * Glowable - Ring glow effect around element
 */
export interface GlowableData {
  color: AccentColor
  intensity?: 'sm' | 'md' | 'lg'
  /** Animate the glow (uses Pulsable internally if true) */
  animated?: boolean
}

/**
 * Tooltippable - Hover tooltip
 */
export interface TooltippableData {
  text: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Custom content instead of text */
  content?: ReactNode
  /** Delay before showing (ms) */
  delay?: number
}

/**
 * Pulsable - Pulsing animation
 */
export interface PulsableData {
  /** Use accent color for pulse effect */
  color?: AccentColor
  /** Pulse speed */
  speed?: 'slow' | 'normal' | 'fast'
  /** Scale amount (1.0 = no scale, 1.1 = 10% larger) */
  scale?: number
}

/**
 * Badgeable - Corner badge indicator
 */
export interface BadgeableData {
  text: string
  color?: AccentColor
  /** Position relative to element */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  /** Dot instead of text */
  dot?: boolean
}

/**
 * Clickable - Indicates element is interactive
 */
export interface ClickableData {
  cursor?: 'pointer' | 'grab' | 'cell' | 'zoom-in' | 'help' | 'not-allowed'
  /** Visual feedback on hover */
  hoverEffect?: 'brighten' | 'scale' | 'glow' | 'none'
  /** ARIA role hint */
  role?: 'button' | 'link' | 'menuitem'
}

/**
 * Draggable - Drag affordance
 */
export interface DraggableData {
  /** Show drag handle indicator */
  showHandle?: boolean
  /** Axis constraint */
  axis?: 'x' | 'y' | 'both'
  /** Visual feedback when dragging */
  dragEffect?: 'ghost' | 'outline' | 'none'
}

/**
 * Selectable - Selection state
 */
export interface SelectableData {
  selected: boolean
  /** Selection style */
  style?: 'ring' | 'background' | 'border'
  color?: AccentColor
}

/**
 * Focusable - Focus ring affordance
 */
export interface FocusableData {
  /** Show focus ring */
  ring?: boolean
  color?: AccentColor
  /** Focus ring offset */
  offset?: number
}

// =============================================================================
// ENTITY & COMPONENT TYPES (ECS terminology)
// =============================================================================

/**
 * Entity = targetId (the thing being injected into)
 */
export type EntityId = string

/**
 * Component = Capability data attached to an entity
 */
export type Component<K extends CapabilityName> = CapabilityMap[K]

/**
 * Entity's full component set
 */
export type EntityComponents = Partial<CapabilityMap>

// =============================================================================
// PROVIDER & HOOK TYPES
// =============================================================================

export interface CapabilityProviderProps {
  children: ReactNode
}

export interface CapabilityContextValue {
  /** Get all capabilities for an entity */
  getEntity: (entityId: EntityId) => EntityComponents

  /** Get specific capability for an entity */
  getCapability: <K extends CapabilityName>(
    entityId: EntityId,
    capability: K
  ) => CapabilityMap[K] | null

  /** Attach capability to entity */
  attach: <K extends CapabilityName>(
    entityId: EntityId,
    capability: K,
    data: CapabilityMap[K]
  ) => void

  /** Detach capability from entity */
  detach: (entityId: EntityId, capability: CapabilityName) => void

  /** Detach all capabilities from entity */
  detachAll: (entityId: EntityId) => void

  /** Check if entity has capability */
  hasCapability: (entityId: EntityId, capability: CapabilityName) => boolean
}

// =============================================================================
// RENDER COMPONENT PROPS
// =============================================================================

export interface GlowRingProps extends GlowableData {
  className?: string
}

export interface TooltipProps extends TooltippableData {
  visible: boolean
  className?: string
}

export interface PulseWrapperProps extends PulsableData {
  children: ReactNode
  className?: string
}

export interface BadgeProps extends BadgeableData {
  className?: string
}
