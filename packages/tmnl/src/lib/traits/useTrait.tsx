/**
 * useTrait Hook
 *
 * Components use this to declare they implement a trait and receive injections.
 * Supports single trait or array of traits (mixin composition).
 */

import { useMemo, type CSSProperties, type ReactNode } from 'react'
import type { Trait, UseTraitResult } from './types'
import { useTraitContextOptional } from './context'

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

function resolveTraitResult<TSlot>(
  trait: Trait<TSlot>,
  targetId: string,
  ctx: ReturnType<typeof useTraitContextOptional>
): UseTraitResult<TSlot> {
  // No provider = no injections
  if (!ctx) {
    return {
      slot: trait.defaultSlot ?? null,
      rendered: trait.defaultSlot ? trait.render(trait.defaultSlot, targetId) : null,
      style: trait.defaultSlot && trait.style ? trait.style(trait.defaultSlot) : {},
      className: trait.defaultSlot && trait.className ? trait.className(trait.defaultSlot) : '',
      isInjected: false,
    }
  }

  const injections = ctx.getInjections(trait)
  const slot = injections.get(targetId) ?? trait.defaultSlot ?? null

  if (!slot) {
    return {
      slot: null,
      rendered: null,
      style: {},
      className: '',
      isInjected: false,
    }
  }

  return {
    slot,
    rendered: trait.render(slot, targetId),
    style: trait.style?.(slot) ?? {},
    className: trait.className?.(slot) ?? '',
    isInjected: injections.has(targetId),
  }
}

// =============================================================================
// MULTI-TRAIT RESULT TYPE
// =============================================================================

/**
 * Result when consuming multiple traits
 * Keyed by trait ID, with merged rendered/style/className at top level
 */
export interface UseTraitsResult<TTraits extends readonly Trait<unknown>[]> {
  /** Individual results keyed by trait ID */
  traits: { [K in TTraits[number]['id']]: UseTraitResult<unknown> }

  /** All rendered JSX stacked in order */
  rendered: ReactNode

  /** All styles merged (later traits override earlier) */
  style: CSSProperties

  /** All classNames joined */
  className: string

  /** True if ANY trait has an active injection */
  isInjected: boolean
}

// =============================================================================
// SINGLE TRAIT HOOK
// =============================================================================

/**
 * Consume a single trait injection
 *
 * @param trait - The trait definition to consume
 * @param targetId - Unique identifier for this target
 * @returns Slot data, rendered JSX, styles, and className
 *
 * @example
 * function DmgBadge({ id }: { id: string }) {
 *   const { rendered, style, isInjected } = useTrait(ClickableAffordance, id)
 *
 *   return (
 *     <span style={style} className={isInjected ? 'injected' : ''}>
 *       DMG
 *       {rendered}
 *     </span>
 *   )
 * }
 */
export function useTrait<TSlot>(
  trait: Trait<TSlot>,
  targetId: string
): UseTraitResult<TSlot> {
  const ctx = useTraitContextOptional()
  return useMemo(() => resolveTraitResult(trait, targetId, ctx), [ctx, trait, targetId])
}

// =============================================================================
// MULTI-TRAIT HOOK
// =============================================================================

/**
 * Consume multiple traits (mixin composition)
 *
 * @param traits - Array of trait definitions to consume
 * @param targetId - Unique identifier for this target
 * @returns Keyed results plus merged rendered/style/className
 *
 * @example
 * function InteractiveCard({ id }: { id: string }) {
 *   const { traits, rendered, style, className } = useTraits(
 *     [ClickableAffordance, TooltipTrait, DraggableTrait],
 *     id
 *   )
 *
 *   // Access individual trait results
 *   const clickable = traits['clickable-affordance']
 *   const tooltip = traits['tooltip']
 *
 *   return (
 *     <div style={style} className={className}>
 *       Content
 *       {rendered}  // All trait renders stacked
 *     </div>
 *   )
 * }
 */
export function useTraits<TTraits extends readonly Trait<unknown>[]>(
  traits: TTraits,
  targetId: string
): UseTraitsResult<TTraits> {
  const ctx = useTraitContextOptional()

  return useMemo(() => {
    const results: Record<string, UseTraitResult<unknown>> = {}
    const renderedParts: ReactNode[] = []
    let mergedStyle: CSSProperties = {}
    const classNames: string[] = []
    let anyInjected = false

    // Process traits in order (later overrides earlier for styles)
    for (const trait of traits) {
      const result = resolveTraitResult(trait, targetId, ctx)
      results[trait.id] = result

      if (result.rendered) {
        renderedParts.push(result.rendered)
      }

      mergedStyle = { ...mergedStyle, ...result.style }

      if (result.className) {
        classNames.push(result.className)
      }

      if (result.isInjected) {
        anyInjected = true
      }
    }

    return {
      traits: results as UseTraitsResult<TTraits>['traits'],
      rendered: renderedParts.length > 0 ? <>{renderedParts}</> : null,
      style: mergedStyle,
      className: classNames.join(' '),
      isInjected: anyInjected,
    }
  }, [ctx, traits, targetId])
}

/**
 * Check if any injections exist for a trait (useful for conditional rendering)
 */
export function useHasInjection<TSlot>(
  trait: Trait<TSlot>,
  targetId: string
): boolean {
  const ctx = useTraitContextOptional()

  return useMemo(() => {
    if (!ctx) return false
    const injections = ctx.getInjections(trait)
    return injections.has(targetId)
  }, [ctx, trait, targetId])
}

/**
 * Get all active injections for a trait (useful for debugging/devtools)
 */
export function useTraitInjections<TSlot>(
  trait: Trait<TSlot>
): Map<string, TSlot> {
  const ctx = useTraitContextOptional()

  return useMemo(() => {
    if (!ctx) return new Map()
    return ctx.getInjections(trait)
  }, [ctx, trait])
}
