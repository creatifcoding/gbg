/**
 * Visual Style Generator
 *
 * Centralized color tokens and CSS generation for annotation visual styles.
 * Used by both extension.ts (renderHTML) and IntentMarkView.tsx (React component).
 *
 * @module editor/v3/extensions/annotations/visual-style-generator
 */

import type { VisualStyle } from './schemas';

// =============================================================================
// TMNL Color Token Registry
// =============================================================================

/**
 * Complete TMNL color token map with hex fallbacks.
 *
 * These map to CSS custom properties: `--tmnl-accent-cyan`, `--tmnl-status-error`, etc.
 * The token format is `category.name` (e.g., `accent.cyan`, `status.error`).
 */
export const TMNL_COLOR_TOKENS: Record<string, string> = {
  // Accent colors
  'accent.cyan': '#00d4aa',
  'accent.yellow': '#ffd93d',
  'accent.blue': '#4da6ff',
  'accent.purple': '#a855f7',
  'accent.orange': '#ff8c00',
  'accent.green': '#22c55e',
  'accent.pink': '#ec4899',
  'accent.red': '#ef4444',

  // Status colors
  'status.error': '#ef4444',
  'status.warning': '#f59e0b',
  'status.success': '#22c55e',
  'status.info': '#3b82f6',

  // Surface colors (for special cases)
  'surface.0': '#0d0d14',
  'surface.1': '#1a1a2e',
  'surface.2': '#2a2a3e',
  'surface.3': '#3a3a4e',

  // Text colors
  'text.primary': '#f0f0f0',
  'text.secondary': '#a0a0a0',
  'text.muted': '#707070',

  // Special
  'transparent': 'transparent',
} as const;

/**
 * Get hex fallback for a color token.
 * Returns the hex value or a default yellow if token unknown.
 */
export const getColorHex = (token: string): string => {
  return TMNL_COLOR_TOKENS[token] ?? '#ffd93d';
};

/**
 * Convert a color token to a CSS variable reference with hex fallback.
 *
 * @example
 * ```typescript
 * getColorVar('accent.cyan')
 * // => 'var(--tmnl-accent-cyan, #00d4aa)'
 * ```
 */
export const getColorVar = (token: string): string => {
  if (token === 'transparent') return 'transparent';

  const hex = getColorHex(token);
  const cssVarName = `--tmnl-${token.replace('.', '-')}`;
  return `var(${cssVarName}, ${hex})`;
};

// =============================================================================
// CSS Generation (String-based for extension.ts renderHTML)
// =============================================================================

/**
 * Generate inline CSS string from a VisualStyle.
 * Used by extension.ts `renderHTML` which needs a style string.
 *
 * @returns CSS string like "background-color: var(--tmnl-accent-yellow, #ffd93d); ..."
 */
export const generateVisualStyleCSSString = (style: VisualStyle): string => {
  const styles: string[] = [];
  const colorVar = getColorVar(style.color);

  // Set --mark-color for CSS animations to use
  styles.push(`--mark-color: ${colorVar}`);

  switch (style.type) {
    case 'highlight':
      styles.push(`background-color: ${colorVar}`);
      styles.push('color: inherit');
      styles.push('border-radius: 2px');
      styles.push('padding: 0 2px');
      break;

    case 'pill':
      styles.push(`background-color: ${colorVar}`);
      styles.push('color: inherit');
      styles.push('border-radius: 9999px');
      styles.push('padding: 0 6px');
      break;

    case 'squiggle':
      styles.push(`text-decoration: wavy underline ${colorVar}`);
      styles.push('text-underline-offset: 2px');
      break;

    case 'underline':
      styles.push(`text-decoration: underline ${colorVar}`);
      styles.push('text-underline-offset: 2px');
      break;

    case 'none':
      // No visual styling, but still set --mark-color for potential effects
      break;
  }

  return styles.join('; ');
};

// =============================================================================
// CSS Generation (Object-based for React components)
// =============================================================================

/**
 * Generate React.CSSProperties from a VisualStyle.
 * Used by IntentMarkView.tsx which needs a CSSProperties object.
 */
export const generateVisualStyleCSSProperties = (style: VisualStyle): React.CSSProperties => {
  const colorVar = getColorVar(style.color);

  // Base properties including --mark-color for CSS animations
  const base: React.CSSProperties & { '--mark-color'?: string } = {
    '--mark-color': colorVar,
  } as React.CSSProperties;

  switch (style.type) {
    case 'highlight':
      return {
        ...base,
        backgroundColor: colorVar,
        color: 'inherit',
        borderRadius: '2px',
        padding: '0 2px',
      };

    case 'pill':
      return {
        ...base,
        backgroundColor: colorVar,
        color: 'inherit',
        borderRadius: '9999px',
        padding: '0 6px',
      };

    case 'squiggle':
      return {
        ...base,
        textDecoration: `wavy underline ${colorVar}`,
        textUnderlineOffset: '2px',
      };

    case 'underline':
      return {
        ...base,
        textDecoration: `underline ${colorVar}`,
        textUnderlineOffset: '2px',
      };

    case 'none':
    default:
      return base;
  }
};

// =============================================================================
// Utility: Parse VisualStyle from JSON
// =============================================================================

/**
 * Safely parse a JSON string into a VisualStyle.
 * Returns null if parsing fails.
 */
export const parseVisualStyle = (json: string | undefined | null): VisualStyle | null => {
  if (!json) return null;

  try {
    const parsed = JSON.parse(json);
    // Basic validation - check required fields exist
    if (parsed && typeof parsed.type === 'string' && typeof parsed.color === 'string') {
      return parsed as VisualStyle;
    }
    return null;
  } catch {
    return null;
  }
};

// =============================================================================
// Utility: Get Default VisualStyle
// =============================================================================

/**
 * Default visual style (yellow highlight).
 */
export const DEFAULT_VISUAL_STYLE: VisualStyle = {
  type: 'highlight',
  color: 'accent.yellow',
  effect: 'none',
  animated: false,
};
