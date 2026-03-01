/**
 * @fileoverview Density tokens — per-tier adaptation values for genifer components.
 *
 * Every mutable dimension (padding, gap, font-size, height) has a value
 * for each density tier. Components read `useSurface().density` and index
 * into these maps.
 *
 * Invariants that NEVER change with density:
 * - border-radius, accent colors, font-family
 * - Alert left-border width (always 2px)
 * - Badge pill shape (always 9999px)
 * - Card bordered-surface style (border, shadow, gradient)
 *
 * @module genifer/catalog/density
 */

import type { SurfaceDensity } from './context'

// =============================================================================
// Per-density value maps
// =============================================================================

/** Grid gap per density */
export const DENSITY_GRID_GAP: Record<SurfaceDensity, string> = {
  compact:  '4px',
  normal:   '8px',
  spacious: '12px',
}

/** Card padding per density */
export const DENSITY_CARD_PADDING: Record<SurfaceDensity, string> = {
  compact:  '8px',
  normal:   '12px',
  spacious: '16px',
}

/** Alert padding per density */
export const DENSITY_ALERT_PADDING: Record<SurfaceDensity, string> = {
  compact:  '6px 8px',
  normal:   '8px 12px',
  spacious: '10px 14px',
}

/** Whether to show Alert title label */
export const DENSITY_ALERT_SHOW_TITLE: Record<SurfaceDensity, boolean> = {
  compact:  false,
  normal:   true,
  spacious: true,
}

/** Heading font sizes per level per density */
export const DENSITY_HEADING_SIZE: Record<SurfaceDensity, Record<1 | 2 | 3, string>> = {
  compact:  { 1: '14px', 2: '13px', 3: '11px' },
  normal:   { 1: '16px', 2: '14px', 3: '11px' },
  spacious: { 1: '18px', 2: '15px', 3: '11px' },
}

/** Text body font size per density */
export const DENSITY_TEXT_SIZE: Record<SurfaceDensity, string> = {
  compact:  '13px',
  normal:   '14px',
  spacious: '14px',
}

/** Code font size per density */
export const DENSITY_CODE_SIZE: Record<SurfaceDensity, string> = {
  compact:  '11px',
  normal:   '12px',
  spacious: '13px',
}

/** Badge font size per density */
export const DENSITY_BADGE_SIZE: Record<SurfaceDensity, string> = {
  compact:  '10px',
  normal:   '11px',
  spacious: '11px',
}

/** Badge padding per density */
export const DENSITY_BADGE_PADDING: Record<SurfaceDensity, string> = {
  compact:  '1px 6px',
  normal:   '2px 8px',
  spacious: '3px 10px',
}

/** Button height per density */
export const DENSITY_BUTTON_HEIGHT: Record<SurfaceDensity, string> = {
  compact:  '28px',
  normal:   '32px',
  spacious: '36px',
}

/** Button font size per density */
export const DENSITY_BUTTON_FONT: Record<SurfaceDensity, string> = {
  compact:  '11px',
  normal:   '12px',
  spacious: '13px',
}

/** Input height per density */
export const DENSITY_INPUT_HEIGHT: Record<SurfaceDensity, string> = {
  compact:  '28px',
  normal:   '32px',
  spacious: '36px',
}

/** Input font size per density */
export const DENSITY_INPUT_FONT: Record<SurfaceDensity, string> = {
  compact:  '12px',
  normal:   '13px',
  spacious: '14px',
}

/** List item padding per density */
export const DENSITY_LIST_PADDING: Record<SurfaceDensity, string> = {
  compact:  '4px 6px',
  normal:   '6px 10px',
  spacious: '8px 12px',
}

/** List gap per density */
export const DENSITY_LIST_GAP: Record<SurfaceDensity, string> = {
  compact:  '2px',
  normal:   '4px',
  spacious: '6px',
}

/** Whether to show Progress bar label */
export const DENSITY_PROGRESS_SHOW_LABEL: Record<SurfaceDensity, boolean> = {
  compact:  false,
  normal:   true,
  spacious: true,
}

/** Whether to show Progress percentage */
export const DENSITY_PROGRESS_SHOW_PCT: Record<SurfaceDensity, boolean> = {
  compact:  false,
  normal:   false,
  spacious: true,
}

// =============================================================================
// Grid column clamping
// =============================================================================

/**
 * Clamp grid columns based on density.
 *
 * - compact:  always 1 (full collapse)
 * - normal:   min(declared, 2)
 * - spacious: as declared
 */
export function clampColumns(declared: number, density: SurfaceDensity): number {
  if (density === 'compact') return 1
  if (density === 'normal') return Math.min(declared, 2)
  return declared
}
