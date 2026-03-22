/**
 * Grid Variants
 *
 * Pre-defined variant configurations for TMNL data grids.
 */

export { tmnlDenseDark } from './tmnl-dense-dark'
export { tmnlDenseDarkMuted } from './tmnl-dense-dark-muted'
export { tmnlUltraOps } from './tmnl-ultra-ops'
export { tmnlAnalystLight } from './tmnl-analyst-light'
export { rvnBrutalist } from './rvn-brutalist'

// Re-export all variants as a record for programmatic access
import { tmnlDenseDark } from './tmnl-dense-dark'
import { tmnlDenseDarkMuted } from './tmnl-dense-dark-muted'
import { tmnlUltraOps } from './tmnl-ultra-ops'
import { tmnlAnalystLight } from './tmnl-analyst-light'
import { rvnBrutalist } from './rvn-brutalist'
import type { GridVariant } from '../schemas'

export const GRID_VARIANTS: Record<string, GridVariant> = {
  'tmnl-dense-dark': tmnlDenseDark,
  'tmnl-dense-dark-muted': tmnlDenseDarkMuted,
  'tmnl-ultra-ops': tmnlUltraOps,
  'tmnl-analyst-light': tmnlAnalystLight,
  'rvn-brutalist': rvnBrutalist,
}

/** Default variant for new grids */
export const DEFAULT_VARIANT = tmnlDenseDark
