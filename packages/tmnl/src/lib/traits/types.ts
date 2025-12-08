/**
 * Trait System Types
 *
 * A trait-based injection system for React components.
 * Components declare traits they implement, external code injects slots.
 */

import type { ReactNode, CSSProperties } from 'react'

// =============================================================================
// CORE TYPES
// =============================================================================

/**
 * Trait definition - the contract for an injection point
 *
 * @template TSlot - The shape of data that can be injected
 */
export interface Trait<TSlot> {
  /** Unique identifier for this trait type */
  readonly id: string

  /** Render the injected slot into JSX */
  render: (slot: TSlot, targetId: string) => ReactNode

  /** Optional: merge styles onto the host element */
  style?: (slot: TSlot) => CSSProperties

  /** Optional: merge className onto the host element */
  className?: (slot: TSlot) => string

  /** Optional: default slot value if none injected */
  defaultSlot?: TSlot
}

/**
 * Injection record - maps targetId to slot value
 */
export type TraitInjections<TSlot> = Map<string, TSlot>

/**
 * Registry - maps traitId to its injections
 */
export type TraitRegistry = Map<string, TraitInjections<unknown>>

// =============================================================================
// PROVIDER TYPES
// =============================================================================

export interface TraitProviderProps {
  children: ReactNode
}

export interface TraitContextValue {
  /** Get injections for a trait */
  getInjections: <TSlot>(trait: Trait<TSlot>) => TraitInjections<TSlot>

  /** Inject a slot into a target */
  inject: <TSlot>(trait: Trait<TSlot>, targetId: string, slot: TSlot) => void

  /** Clear an injection */
  clear: <TSlot>(trait: Trait<TSlot>, targetId: string) => void

  /** Clear all injections for a trait */
  clearAll: <TSlot>(trait: Trait<TSlot>) => void
}

// =============================================================================
// HOOK TYPES
// =============================================================================

export interface UseTraitResult<TSlot> {
  /** The injected slot, or null if none */
  slot: TSlot | null

  /** Rendered JSX from the trait's render function */
  rendered: ReactNode

  /** Styles to merge onto host element */
  style: CSSProperties

  /** ClassName to merge onto host element */
  className: string

  /** Whether this target has an active injection */
  isInjected: boolean
}

// =============================================================================
// BUILT-IN SLOT TYPES
// =============================================================================

/**
 * ClickableAffordance slot - makes elements obviously interactive
 */
export interface ClickableAffordanceSlot {
  /** Tooltip text on hover */
  tooltip?: string

  /** Glow ring color */
  glow?: 'orange' | 'cyan' | 'violet' | 'green' | 'red' | 'amber'

  /** Cursor style */
  cursor?: 'pointer' | 'grab' | 'cell' | 'zoom-in' | 'help'

  /** Pulsing animation */
  pulse?: boolean

  /** Badge text (small indicator) */
  badge?: string
}

/**
 * TooltipSlot - simple tooltip injection
 */
export interface TooltipSlot {
  content: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  delay?: number
}

/**
 * PortalTargetSlot - named portal destination
 */
export interface PortalTargetSlot {
  content: ReactNode
  priority?: number
}
