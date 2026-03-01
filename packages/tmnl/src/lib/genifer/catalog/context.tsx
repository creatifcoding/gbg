/**
 * @fileoverview SurfaceProvider — container-aware responsive DI for genifer components.
 *
 * Every genifer render surface (inline thread, tool card, floating panel) wraps its
 * Renderer in a SurfaceProvider. Components call `useSurface()` to read the current
 * density tier and adapt layout, spacing, font sizing, and content visibility.
 *
 * Density tiers are derived from the actual container width via ResizeObserver,
 * NOT the viewport. This means the same Grid component automatically collapses
 * from 3 columns to 1 when rendered in a 340px chat thread band.
 *
 * @example
 * ```tsx
 * // At render boundary
 * <SurfaceProvider tier="inline">
 *   <Renderer tree={tree} />
 * </SurfaceProvider>
 *
 * // Inside any renderer
 * function CardRenderer({ element, children }) {
 *   const { density } = useSurface()
 *   const pad = density === 'compact' ? '8px' : '16px'
 *   // ...
 * }
 * ```
 *
 * @module genifer/catalog/context
 */

'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

// =============================================================================
// Types
// =============================================================================

/**
 * Density tier — derived from container width.
 *
 * - `compact`: <360px — collapse multi-column grids, tighten padding, shrink fonts
 * - `normal`:  360–560px — balanced density, cap grid columns at 2
 * - `spacious`: >560px — full design intent, no overrides
 */
export type SurfaceDensity = 'compact' | 'normal' | 'spacious'

/**
 * Surface tier — the type of host container.
 * Allows structural decisions beyond just width (e.g., inline may hide chrome
 * that a panel would show).
 *
 * - `inline`: Chat thread band — tightest, no chrome, embedded in message flow
 * - `panel`:  Tool card or floating panel — medium, has chrome/header
 * - `page`:   Full page or standalone — widest, full design intent
 */
export type SurfaceTier = 'inline' | 'panel' | 'page'

/**
 * Full surface constraint — everything a component needs to adapt.
 */
export interface SurfaceConstraint {
  /** Density tier derived from container width */
  readonly density: SurfaceDensity
  /** Observed container width in px, or null if not yet measured */
  readonly maxWidth: number | null
  /** Host container type */
  readonly tier: SurfaceTier
}

// =============================================================================
// Breakpoints
// =============================================================================

/** Compact threshold — below this, grids collapse to 1 column */
const COMPACT_THRESHOLD = 360

/** Normal threshold — below this, grids cap at 2 columns */
const NORMAL_THRESHOLD = 560

/**
 * Classify container width into density tier.
 */
export function classifyDensity(width: number): SurfaceDensity {
  if (width < COMPACT_THRESHOLD) return 'compact'
  if (width < NORMAL_THRESHOLD) return 'normal'
  return 'spacious'
}

// =============================================================================
// Context
// =============================================================================

const DEFAULT_CONSTRAINT: SurfaceConstraint = {
  density: 'normal',
  maxWidth: null,
  tier: 'page',
}

const SurfaceContext = createContext<SurfaceConstraint>(DEFAULT_CONSTRAINT)

// =============================================================================
// Provider
// =============================================================================

export interface SurfaceProviderProps {
  /** Host container type */
  tier: SurfaceTier
  /** Override density (skips ResizeObserver, useful for testing) */
  density?: SurfaceDensity
  children: ReactNode
}

/**
 * SurfaceProvider — wraps a genifer render surface with container-aware context.
 *
 * Attaches a ResizeObserver to measure the actual container width and derives
 * the density tier. Components inside read via `useSurface()`.
 *
 * When `density` prop is provided, the observer is skipped (test/storybook mode).
 */
export function SurfaceProvider({ tier, density: densityOverride, children }: SurfaceProviderProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | null>(null)

  useEffect(() => {
    if (densityOverride != null) return // Skip observer when overridden
    const el = ref.current
    if (!el) return

    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width)
    })
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [densityOverride])

  const density: SurfaceDensity = densityOverride ?? (
    width != null ? classifyDensity(width) : 'normal'
  )

  const constraint: SurfaceConstraint = {
    density,
    maxWidth: width,
    tier,
  }

  return (
    <SurfaceContext.Provider value={constraint}>
      <div ref={ref} style={{ width: '100%' }}>
        {children}
      </div>
    </SurfaceContext.Provider>
  )
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Read the current surface constraint.
 *
 * Safe to call outside a SurfaceProvider — returns default (normal/page).
 * Components should never crash if no provider is mounted.
 */
export function useSurface(): SurfaceConstraint {
  return useContext(SurfaceContext)
}
