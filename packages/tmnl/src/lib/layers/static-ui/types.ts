/**
 * Static UI Layer Types
 *
 * Semantic layer definitions for fixed UI chrome elements.
 * These layers exist outside the canvas z-index space and
 * provide the application's structural chrome.
 *
 * Z-Index Ranges:
 * - Canvas content: 0-999
 * - Static UI: 1000-1999
 * - Overlays (modals, drawers): 2000-2999
 * - System (toasts, command bar): 3000+
 */

import type { PointerEventsBehavior, PositionMode } from '../types';

/**
 * Semantic layer roles for static UI
 */
export type StaticUIRole =
  | 'header' // Top navigation bar
  | 'footer' // Status bar / bottom chrome
  | 'sidebar-left' // Left navigation panel
  | 'sidebar-right' // Right action panel
  | 'toolbar' // Floating or docked toolbars
  | 'overlay' // Modals, sheets, dialogs
  | 'drawer' // Slide-in panels
  | 'command' // Command palette / bar
  | 'toast'; // Notification system

/**
 * Z-index presets for static UI roles
 */
export const STATIC_UI_Z_INDEX: Record<StaticUIRole, number> = {
  header: 1000,
  footer: 1000,
  'sidebar-left': 1100,
  'sidebar-right': 1100,
  toolbar: 1200,
  drawer: 2000,
  overlay: 2500,
  command: 3000,
  toast: 3500,
};

/**
 * Default position modes for static UI roles
 */
export const STATIC_UI_POSITION: Record<StaticUIRole, PositionMode> = {
  header: 'fixed',
  footer: 'fixed',
  'sidebar-left': 'fixed',
  'sidebar-right': 'fixed',
  toolbar: 'fixed',
  drawer: 'fixed',
  overlay: 'fixed',
  command: 'fixed',
  toast: 'fixed',
};

/**
 * Default pointer events for static UI roles
 */
export const STATIC_UI_POINTER: Record<StaticUIRole, PointerEventsBehavior> = {
  header: 'auto',
  footer: 'auto',
  'sidebar-left': 'auto',
  'sidebar-right': 'auto',
  toolbar: 'pass-through',
  drawer: 'auto',
  overlay: 'auto',
  command: 'auto',
  toast: 'pass-through',
};

/**
 * Static UI layer configuration
 */
export interface StaticUILayerConfig {
  role: StaticUIRole;
  name?: string; // Override default name (defaults to role)
  zIndexOffset?: number; // Offset from role's base z-index
  visible?: boolean;
  locked?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Scale configuration for static UI
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
