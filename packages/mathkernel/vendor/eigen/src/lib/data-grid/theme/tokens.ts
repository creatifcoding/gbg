/**
 * TMNL Design Tokens
 *
 * Canonical design tokens for AG-Grid theming.
 * Parameterized for animation & runtime theming.
 *
 * NOTE: For most use cases, prefer the variant-driven approach via schemas.
 * These tokens are for:
 * 1. Reference documentation
 * 2. Direct AG-Grid theming (bypassing variants)
 * 3. Animation overlays that need raw token access
 *
 * @module
 */

// =============================================================================
// CORE PALETTE
// =============================================================================

/**
 * TMNL color tokens.
 * Pure black aesthetic with neutral gray progression.
 */
export const COLORS = {
  // Backgrounds (darkest to lightest)
  black: '#000000',
  backgroundPrimary: '#0a0a0a',
  backgroundSecondary: '#0d0d0d',
  backgroundTertiary: '#141414',
  backgroundHover: '#1a1a1a',
  backgroundSelected: '#1e1e21',
  backgroundCard: '#0d0d0d',

  // Borders
  borderMuted: '#1a1a1a',
  borderDefault: '#262626',
  borderSubtle: '#333333',

  // Text hierarchy
  textPrimary: '#ffffff',
  textSecondary: '#a3a3a3',
  textMuted: '#737373',
  textDisabled: '#525252',

  // Accents
  accentPrimary: '#ffffff',
  accentCyan: '#00A2FF',
  accentGreen: '#22c55e',
  accentYellow: '#eab308',
  accentRed: '#ef4444',

  // Range selection
  rangeBackground: 'rgba(255, 255, 255, 0.08)',
  rangeBorder: '#ffffff',
} as const

// =============================================================================
// TYPOGRAPHY
// =============================================================================

/**
 * TMNL typography tokens.
 *
 * Typography: Geo (font-stats) - minimalist geometric for data displays
 *
 * GRID EXEMPTION: Sub-12px fonts are intentionally allowed for:
 * - ultra tier: 8px (max density ops console)
 * - dense tier: 9-10px (trading views)
 *
 * Standard UI should respect 12px floor per CLAUDE.md.
 */
export const TYPOGRAPHY = {
  // Primary font: Geo (geometric, minimalist)
  fontFamily: [
    'Geo',
    'ui-monospace',
    'SFMono-Regular',
    '"SF Mono"',
    'Menlo',
    'Consolas',
    'monospace',
  ],
  fontFamilyString: 'Geo, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',

  // CSS variable reference (preferred)
  fontFamilyVar: 'var(--font-stats)',

  // Size scale (grid context — sub-12px allowed)
  fontSizeXs: 12,   // Minimum for standard use
  fontSizeSm: 13,   // Small labels
  fontSizeMd: 14,   // Body text
  fontSizeLg: 16,   // Emphasis

  // Ultra-dense overrides (ops console)
  fontSizeUltra: 8,
  fontSizeDense: 10,
} as const

// =============================================================================
// SPACING
// =============================================================================

/**
 * TMNL spacing tokens.
 * Based on 4px unit grid.
 */
export const SPACING = {
  unit: 4,
  cellPadding: 0.7,
  rowPadding: 0.9,
  headerPadding: 1.0,
} as const

// =============================================================================
// DIMENSIONS
// =============================================================================

/**
 * TMNL dimension tokens.
 * Row heights by density tier:
 * - ultra: 16px
 * - dense: 20px
 * - normal: 24px (default)
 * - relaxed: 32px
 */
export const DIMENSIONS = {
  // Row heights by tier
  rowHeightUltra: 16,
  rowHeightDense: 20,
  rowHeightNormal: 24,
  rowHeightRelaxed: 32,

  // Header heights by tier
  headerHeightUltra: 18,
  headerHeightDense: 22,
  headerHeightNormal: 28,
  headerHeightRelaxed: 36,

  // Common
  borderRadius: 0,
  borderWidth: 1,
  iconSize: 12,
} as const

// =============================================================================
// ANIMATION
// =============================================================================

/**
 * TMNL animation tokens.
 * For use with GSAP/anime.js drivers.
 */
export const ANIMATION = {
  durationFast: 0.1,
  durationNormal: 0.2,
  durationSlow: 0.3,
  durationFlash: 0.3,

  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easingOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easingIn: 'cubic-bezier(0.4, 0, 1, 1)',
} as const

// =============================================================================
// COMBINED TOKEN OBJECT
// =============================================================================

/**
 * Complete TMNL token set for AG-Grid.
 * Consolidated from tldraw/shapes/data-grid-theme.ts.
 */
export const TMNL_TOKENS = {
  colors: COLORS,
  typography: TYPOGRAPHY,
  spacing: SPACING,
  dimensions: DIMENSIONS,
  animation: ANIMATION,
} as const

// =============================================================================
// STATUS COLORS
// =============================================================================

/**
 * Status indicator colors for cell renderers.
 */
export const STATUS_COLORS = {
  active: COLORS.accentGreen,
  pending: COLORS.accentYellow,
  inactive: COLORS.accentRed,
  default: COLORS.textMuted,
} as const

// =============================================================================
// FLASH COLORS
// =============================================================================

/**
 * Cell flash colors by direction.
 */
export const FLASH_COLORS = {
  up: 'rgba(34, 197, 94, 0.4)',
  down: 'rgba(239, 68, 68, 0.4)',
  change: 'rgba(255, 255, 255, 0.2)',
} as const

// =============================================================================
// EXPORTS
// =============================================================================

export type TmnlTokens = typeof TMNL_TOKENS
export type StatusColors = typeof STATUS_COLORS
export type FlashColors = typeof FLASH_COLORS
