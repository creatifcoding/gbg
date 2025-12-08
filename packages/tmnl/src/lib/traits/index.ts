/**
 * Trait System
 *
 * A trait-based injection system for React components.
 *
 * @example
 * // Define a component that implements a trait
 * function DmgBadge({ id }: { id: string }) {
 *   const { rendered, style } = useTrait(ClickableAffordance, id)
 *   return (
 *     <span style={style}>
 *       DMG
 *       {rendered}
 *     </span>
 *   )
 * }
 *
 * // Inject from anywhere within TraitProvider
 * const { inject } = useInject()
 * inject(ClickableAffordance, 'dmg-123', {
 *   tooltip: 'Click to view damage report',
 *   glow: 'orange',
 * })
 */

// Core
export { createTrait } from './createTrait'
export { TraitProvider, useInject, useInjectOnMount, useTraitContext, useTraitContextOptional } from './context'
export { useTrait, useTraits, useHasInjection, useTraitInjections, type UseTraitsResult } from './useTrait'

// Types
export type {
  Trait,
  TraitRegistry,
  TraitInjections,
  TraitProviderProps,
  TraitContextValue,
  UseTraitResult,
  ClickableAffordanceSlot,
  TooltipSlot,
  PortalTargetSlot,
} from './types'

// Built-in Traits
export { ClickableAffordance } from './traits/ClickableAffordance'
