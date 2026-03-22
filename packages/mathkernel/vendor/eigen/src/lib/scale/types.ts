/**
 * Scale System Types
 *
 * CSS custom property injection for scalable UI elements.
 * Independent from layer management.
 */

/**
 * Scale configuration
 */
export interface ScaleConfig {
  /** Base scale factor (1.0 = 100%) */
  base: number;
  /** Minimum scale factor */
  min: number;
  /** Maximum scale factor */
  max: number;
  /** Scale step for adjustments */
  step: number;
}

/**
 * Default scale configuration
 */
export const DEFAULT_SCALE_CONFIG: ScaleConfig = {
  base: 1.0,
  min: 0.75,
  max: 2.0,
  step: 0.125,
};

/**
 * Typography scale tokens (base sizes in px, before scaling)
 *
 * These are the "unscaled" base sizes. The actual rendered size
 * will be: baseSize * scaleFactor
 *
 * NOTE: Sizes bumped from original (xs:10, sm:12, base:14) to provide
 * readable defaults at scale=1.0. Scale is for adjustment, not rescue.
 */
export const TYPOGRAPHY_BASE_SIZES = {
  /** Tiny labels, badges */
  xs: 12,
  /** Small labels, captions */
  sm: 14,
  /** Body text, inputs */
  base: 16,
  /** Subheadings */
  lg: 18,
  /** Headings */
  xl: 22,
  /** Display text */
  '2xl': 28,
  /** Large display */
  '3xl': 36,
} as const;

/**
 * Spacing scale tokens (base sizes in px, before scaling)
 */
export const SPACING_BASE_SIZES = {
  '0': 0,
  '0.5': 2,
  '1': 4,
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '8': 32,
  '10': 40,
  '12': 48,
} as const;

/**
 * Component sizing tokens (base heights in px, before scaling)
 */
export const COMPONENT_BASE_SIZES = {
  /** Extra small button height */
  'button-xs': 24,
  /** Small button height */
  'button-sm': 28,
  /** Medium button height */
  'button-md': 32,
  /** Large button height */
  'button-lg': 40,
  /** Header bar height */
  header: 48,
  /** Footer bar height */
  footer: 36,
  /** Input height */
  input: 36,
  /** Toolbar height */
  toolbar: 44,
} as const;

export type TypographySize = keyof typeof TYPOGRAPHY_BASE_SIZES;
export type SpacingSize = keyof typeof SPACING_BASE_SIZES;
export type ComponentSize = keyof typeof COMPONENT_BASE_SIZES;
