/**
 * RVN Design Tokens
 *
 * Brutalist design system tokens for the RVN component library.
 */

export * from './colors'
export * from './typography'
export * from './spacing'
export * from './borders'

import { RVN_COLOR_VARS } from './colors'
import { RVN_TYPOGRAPHY_VARS } from './typography'
import { RVN_SPACING_VARS } from './spacing'
import { RVN_BORDER_VARS } from './borders'

/**
 * All CSS custom properties combined
 * Apply to :root or RvnProvider
 */
export const RVN_CSS_VARS = {
  ...RVN_COLOR_VARS,
  ...RVN_TYPOGRAPHY_VARS,
  ...RVN_SPACING_VARS,
  ...RVN_BORDER_VARS,
} as const

export type RvnCssVars = typeof RVN_CSS_VARS
