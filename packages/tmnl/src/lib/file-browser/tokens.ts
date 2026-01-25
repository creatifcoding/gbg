/**
 * Dark Side Tokens
 *
 * Pure black aesthetic with zero border radius.
 * Inspired by command-line interfaces and brutalist design.
 *
 * @module file-browser/tokens
 */

// =============================================================================
// Colors
// =============================================================================

export const DARK_SIDE_COLORS = {
  // Backgrounds
  background: '#000000',        // Pure black
  surface: '#0a0a0a',           // Barely visible surface
  surfaceAlt: '#050505',        // Alternative surface
  surfaceHover: '#111111',      // Hover state
  surfaceActive: '#1a1a1a',     // Active/pressed state
  surfaceSelected: '#0f1f0f',   // Selected item (green tint)

  // Text
  text: {
    primary: '#ffffff',         // Pure white
    secondary: '#a0a0a0',       // Muted
    tertiary: '#666666',        // Very muted
    muted: '#333333',           // Nearly invisible
    disabled: '#444444',        // Disabled state
  },

  // Accents
  accent: {
    green: '#00ff41',           // Matrix green - primary action
    greenMuted: '#00aa2a',      // Muted green
    greenGlow: 'rgba(0, 255, 65, 0.3)', // Glow effect

    cyan: '#00ffff',            // Cyan - info/selection
    cyanMuted: '#00aaaa',       // Muted cyan
    cyanGlow: 'rgba(0, 255, 255, 0.3)', // Glow effect

    red: '#ff4444',             // Red - danger/error
    redMuted: '#aa2222',        // Muted red
    redGlow: 'rgba(255, 68, 68, 0.3)', // Glow effect

    amber: '#ffaa00',           // Amber - warning
    amberMuted: '#aa7700',      // Muted amber
    amberGlow: 'rgba(255, 170, 0, 0.3)', // Glow effect

    white: '#ffffff',           // White - neutral action
    whiteMuted: '#888888',      // Muted white
  },

  // Borders
  border: {
    default: '#333333',         // Default border
    subtle: '#222222',          // Subtle border
    focus: '#00ff41',           // Focus ring (green)
    error: '#ff4444',           // Error border
  },

  // File type indicators
  fileType: {
    directory: '#00ffff',       // Cyan for directories
    file: '#ffffff',            // White for files
    executable: '#00ff41',      // Green for executables
    hidden: '#666666',          // Gray for hidden
    symlink: '#ffaa00',         // Amber for symlinks
    special: '#ff4444',         // Red for special files
  },

  // Status
  status: {
    success: '#00ff41',
    warning: '#ffaa00',
    error: '#ff4444',
    info: '#00ffff',
    pending: '#666666',
  },
} as const

// =============================================================================
// Typography
// =============================================================================

export const DARK_SIDE_TYPOGRAPHY = {
  // Font family
  family: {
    mono: "'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace",
    sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },

  // Font sizes (12px floor per CLAUDE.md)
  size: {
    xs: '12px',     // Minimum readable - labels, badges
    sm: '14px',     // Small UI
    base: '16px',   // Body text
    lg: '18px',     // Subheadings
    xl: '20px',     // Headings
    '2xl': '24px',  // Large headings
  },

  // Font weights
  weight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  // Line heights
  lineHeight: {
    tight: '1.2',
    normal: '1.5',
    relaxed: '1.75',
  },

  // Letter spacing
  letterSpacing: {
    tight: '-0.02em',
    normal: '0',
    wide: '0.05em',
    wider: '0.1em',
  },
} as const

// =============================================================================
// Spacing
// =============================================================================

export const DARK_SIDE_SPACING = {
  // Base unit: 4px
  '0': '0px',
  '0.5': '2px',
  '1': '4px',
  '1.5': '6px',
  '2': '8px',
  '2.5': '10px',
  '3': '12px',
  '4': '16px',
  '5': '20px',
  '6': '24px',
  '8': '32px',
  '10': '40px',
  '12': '48px',
  '16': '64px',
} as const

// =============================================================================
// Borders
// =============================================================================

export const DARK_SIDE_BORDERS = {
  // Border radius (zero for brutalist)
  radius: {
    none: '0px',
    sm: '0px',    // Override if needed
    md: '0px',
    lg: '0px',
    full: '0px',  // Even "full" is zero
  },

  // Border widths
  width: {
    thin: '1px',
    medium: '2px',
    thick: '3px',
  },
} as const

// =============================================================================
// Dimensions
// =============================================================================

export const DARK_SIDE_DIMENSIONS = {
  // Row heights
  rowHeight: {
    compact: '28px',
    default: '32px',
    comfortable: '40px',
  },

  // Header heights
  headerHeight: {
    small: '36px',
    default: '44px',
    large: '52px',
  },

  // Footer height
  footerHeight: '28px',

  // Icon sizes
  iconSize: {
    xs: '12px',
    sm: '16px',
    md: '20px',
    lg: '24px',
    xl: '32px',
  },

  // Panel widths
  panelWidth: {
    inspector: '280px',
    sidebar: '240px',
    toolbar: '48px',
  },

  // Minimum dimensions
  minWidth: {
    panel: '400px',
  },
  minHeight: {
    panel: '300px',
  },
} as const

// =============================================================================
// Animation (for future animatification)
// =============================================================================

export const DARK_SIDE_ANIMATION = {
  // Durations
  duration: {
    instant: '0ms',
    fast: '100ms',
    normal: '200ms',
    slow: '300ms',
    slower: '500ms',
  },

  // Easings
  easing: {
    linear: 'linear',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  },
} as const

// =============================================================================
// Shadows (glow-based, not box shadows)
// =============================================================================

export const DARK_SIDE_SHADOWS = {
  none: 'none',
  glow: {
    green: `0 0 10px ${DARK_SIDE_COLORS.accent.greenGlow}`,
    cyan: `0 0 10px ${DARK_SIDE_COLORS.accent.cyanGlow}`,
    red: `0 0 10px ${DARK_SIDE_COLORS.accent.redGlow}`,
    amber: `0 0 10px ${DARK_SIDE_COLORS.accent.amberGlow}`,
  },
  glowIntense: {
    green: `0 0 20px ${DARK_SIDE_COLORS.accent.greenGlow}, 0 0 40px ${DARK_SIDE_COLORS.accent.greenGlow}`,
    cyan: `0 0 20px ${DARK_SIDE_COLORS.accent.cyanGlow}, 0 0 40px ${DARK_SIDE_COLORS.accent.cyanGlow}`,
  },
} as const

// =============================================================================
// Z-Index Scale
// =============================================================================

export const DARK_SIDE_Z_INDEX = {
  behind: -1,
  base: 0,
  content: 10,
  header: 20,
  overlay: 30,
  modal: 40,
  tooltip: 50,
  toast: 60,
} as const

// =============================================================================
// Composite Token
// =============================================================================

export const DARK_SIDE = {
  colors: DARK_SIDE_COLORS,
  typography: DARK_SIDE_TYPOGRAPHY,
  spacing: DARK_SIDE_SPACING,
  borders: DARK_SIDE_BORDERS,
  dimensions: DARK_SIDE_DIMENSIONS,
  animation: DARK_SIDE_ANIMATION,
  shadows: DARK_SIDE_SHADOWS,
  zIndex: DARK_SIDE_Z_INDEX,
} as const

export type DarkSideTokens = typeof DARK_SIDE

// =============================================================================
// CSS Variable Exports
// =============================================================================

/**
 * Generate CSS custom properties from tokens
 */
export function generateCSSVariables(): string {
  return `
    :root {
      /* Colors - Background */
      --fb-bg: ${DARK_SIDE_COLORS.background};
      --fb-surface: ${DARK_SIDE_COLORS.surface};
      --fb-surface-alt: ${DARK_SIDE_COLORS.surfaceAlt};
      --fb-surface-hover: ${DARK_SIDE_COLORS.surfaceHover};
      --fb-surface-active: ${DARK_SIDE_COLORS.surfaceActive};
      --fb-surface-selected: ${DARK_SIDE_COLORS.surfaceSelected};

      /* Colors - Text */
      --fb-text-primary: ${DARK_SIDE_COLORS.text.primary};
      --fb-text-secondary: ${DARK_SIDE_COLORS.text.secondary};
      --fb-text-tertiary: ${DARK_SIDE_COLORS.text.tertiary};
      --fb-text-muted: ${DARK_SIDE_COLORS.text.muted};

      /* Colors - Accent */
      --fb-accent-green: ${DARK_SIDE_COLORS.accent.green};
      --fb-accent-cyan: ${DARK_SIDE_COLORS.accent.cyan};
      --fb-accent-red: ${DARK_SIDE_COLORS.accent.red};
      --fb-accent-amber: ${DARK_SIDE_COLORS.accent.amber};

      /* Colors - Border */
      --fb-border: ${DARK_SIDE_COLORS.border.default};
      --fb-border-subtle: ${DARK_SIDE_COLORS.border.subtle};
      --fb-border-focus: ${DARK_SIDE_COLORS.border.focus};

      /* Typography */
      --fb-font-mono: ${DARK_SIDE_TYPOGRAPHY.family.mono};
      --fb-font-sans: ${DARK_SIDE_TYPOGRAPHY.family.sans};
      --fb-text-xs: ${DARK_SIDE_TYPOGRAPHY.size.xs};
      --fb-text-sm: ${DARK_SIDE_TYPOGRAPHY.size.sm};
      --fb-text-base: ${DARK_SIDE_TYPOGRAPHY.size.base};

      /* Spacing */
      --fb-space-1: ${DARK_SIDE_SPACING['1']};
      --fb-space-2: ${DARK_SIDE_SPACING['2']};
      --fb-space-3: ${DARK_SIDE_SPACING['3']};
      --fb-space-4: ${DARK_SIDE_SPACING['4']};

      /* Dimensions */
      --fb-row-height: ${DARK_SIDE_DIMENSIONS.rowHeight.default};
      --fb-header-height: ${DARK_SIDE_DIMENSIONS.headerHeight.default};
      --fb-icon-size: ${DARK_SIDE_DIMENSIONS.iconSize.md};
      --fb-inspector-width: ${DARK_SIDE_DIMENSIONS.panelWidth.inspector};

      /* Animation */
      --fb-duration-fast: ${DARK_SIDE_ANIMATION.duration.fast};
      --fb-duration-normal: ${DARK_SIDE_ANIMATION.duration.normal};
      --fb-easing: ${DARK_SIDE_ANIMATION.easing.easeOut};
    }
  `.trim()
}
