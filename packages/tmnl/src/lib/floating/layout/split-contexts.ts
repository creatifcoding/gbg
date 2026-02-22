/**
 * Split layout contexts — direction and collapse state for tiled panels.
 *
 * @module floating/layout/split-contexts
 */

import { createContext, useContext } from 'react'

/**
 * Context for the parent split direction — lets TiledPanel know
 * whether to render a collapsed strip as vertical bar or horizontal bar.
 */
export const SplitDirectionContext = createContext<'horizontal' | 'vertical'>('horizontal')

/** Whether ALL sibling items in this grid level are collapsed */
export const AllSiblingsCollapsedContext = createContext<boolean>(false)

/**
 * Constrained axis context — set when a branch collapses to 36px.
 * Once set, propagates unchanged to ALL descendants.
 *
 * - 'height' → cells are wide × short → horizontal text
 * - 'width' → cells are narrow × tall → vertical text
 * - null → no constraint from ancestor (use local logic)
 */
export const ConstrainedAxisContext = createContext<'height' | 'width' | null>(null)

/** Hook to read the parent split direction */
export function useSplitDirection(): 'horizontal' | 'vertical' {
  return useContext(SplitDirectionContext)
}

/** Hook to check if all siblings in the same grid level are collapsed */
export function useAllSiblingsCollapsed(): boolean {
  return useContext(AllSiblingsCollapsedContext)
}

/** Hook to read the constrained axis from ancestor collapsed branch */
export function useConstrainedAxis(): 'height' | 'width' | null {
  return useContext(ConstrainedAxisContext)
}
