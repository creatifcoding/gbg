/**
 * Editor Theme Tokens
 *
 * Design tokens for the IGGY-inspired editor theme.
 * Matches the DocViewer styling from /docs/overhaul.
 *
 * @module editor/v3/theme/tokens
 */

// =============================================================================
// Color Tokens
// =============================================================================

export const colors = {
  // Neutrals (from Tailwind neutral palette)
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0a0a0a',
  },

  // Accent colors
  teal: {
    300: '#5eead4',
    400: '#2dd4bf',
    500: '#14b8a6',
  },

  amber: {
    400: '#fbbf24',
    500: '#f59e0b',
  },

  blue: {
    400: '#60a5fa',
    500: '#3b82f6',
  },

  purple: {
    400: '#a78bfa',
    500: '#8b5cf6',
  },

  // Status colors
  status: {
    success: '#4ade80',
    warning: '#fbbf24',
    error: '#f87171',
    info: '#60a5fa',
  },
} as const;

// =============================================================================
// Typography Tokens
// =============================================================================

export const typography = {
  // Font families
  fontFamily: {
    sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace',
  },

  // Font sizes (rem-based for accessibility)
  fontSize: {
    xs: '0.75rem', // 12px
    sm: '0.875rem', // 14px
    base: '1rem', // 16px
    lg: '1.125rem', // 18px
    xl: '1.25rem', // 20px
    '2xl': '1.5rem', // 24px
    '3xl': '1.875rem', // 30px
  },

  // Line heights
  lineHeight: {
    tight: '1.25',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
    loose: '1.75',
  },

  // Font weights
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

// =============================================================================
// Spacing Tokens
// =============================================================================

export const spacing = {
  0: '0',
  0.5: '0.125rem', // 2px
  1: '0.25rem', // 4px
  1.5: '0.375rem', // 6px
  2: '0.5rem', // 8px
  3: '0.75rem', // 12px
  4: '1rem', // 16px
  5: '1.25rem', // 20px
  6: '1.5rem', // 24px
  8: '2rem', // 32px
  10: '2.5rem', // 40px
  12: '3rem', // 48px
} as const;

// =============================================================================
// Border Radius Tokens
// =============================================================================

export const borderRadius = {
  none: '0',
  sm: '0.25rem', // 4px
  md: '0.375rem', // 6px
  lg: '0.5rem', // 8px
  xl: '0.75rem', // 12px
  full: '9999px',
} as const;

// =============================================================================
// Semantic Theme (applies tokens to UI elements)
// =============================================================================

export const editorTheme = {
  // Surface colors
  surface: {
    background: colors.neutral[950],
    primary: colors.neutral[900],
    secondary: colors.neutral[800],
    elevated: colors.neutral[800],
    border: colors.neutral[800],
    borderSubtle: `${colors.neutral[800]}80`, // 50% opacity
  },

  // Text colors
  text: {
    primary: colors.neutral[100],
    secondary: colors.neutral[200],
    muted: colors.neutral[400],
    subtle: colors.neutral[500],
    accent: colors.teal[400],
    link: colors.teal[400],
    linkHover: colors.teal[300],
  },

  // Prose-specific (matching DocViewer)
  prose: {
    body: colors.neutral[300],
    heading: colors.neutral[100],
    headingSecondary: colors.neutral[200],
    strong: colors.neutral[100],
    code: colors.teal[400],
    codeBackground: colors.neutral[800],
    blockquoteBorder: colors.teal[500],
    blockquoteText: colors.neutral[400],
    listMarker: colors.neutral[500],
    hr: colors.neutral[800],
  },

  // Code block
  codeBlock: {
    background: 'rgb(23, 23, 23)', // oneDark bg
    headerBackground: colors.neutral[900],
    border: colors.neutral[800],
    languageLabel: colors.teal[400],
    filename: colors.neutral[500],
  },

  // Table
  table: {
    headerBackground: colors.neutral[900],
    border: colors.neutral[800],
    borderSubtle: `${colors.neutral[800]}80`,
    headerText: colors.neutral[400],
    cellText: colors.neutral[300],
  },

  // Editor-specific
  editor: {
    placeholder: colors.neutral[600],
    selection: colors.teal[500],
    selectionText: colors.neutral[950],
    cursor: colors.teal[400],
    cursorLabel: colors.neutral[100],
  },

  // Category badges (from DocViewer)
  category: {
    overview: { bg: `${colors.blue[500]}1a`, text: colors.blue[400] },
    architecture: { bg: `${colors.purple[500]}1a`, text: colors.purple[400] },
    patterns: { bg: `${colors.teal[500]}1a`, text: colors.teal[400] },
    guide: { bg: `${colors.amber[500]}1a`, text: colors.amber[400] },
    reference: { bg: `${colors.neutral[500]}1a`, text: colors.neutral[400] },
  },
} as const;

// =============================================================================
// CSS Custom Properties Generator
// =============================================================================

/**
 * Generates CSS custom properties from the theme tokens.
 * Use in a <style> tag or CSS-in-JS.
 */
export function generateCSSVariables(): string {
  return `
    :root {
      /* Surfaces */
      --editor-surface-bg: ${editorTheme.surface.background};
      --editor-surface-primary: ${editorTheme.surface.primary};
      --editor-surface-secondary: ${editorTheme.surface.secondary};
      --editor-surface-elevated: ${editorTheme.surface.elevated};
      --editor-surface-border: ${editorTheme.surface.border};
      --editor-surface-border-subtle: ${editorTheme.surface.borderSubtle};

      /* Text */
      --editor-text-primary: ${editorTheme.text.primary};
      --editor-text-secondary: ${editorTheme.text.secondary};
      --editor-text-muted: ${editorTheme.text.muted};
      --editor-text-subtle: ${editorTheme.text.subtle};
      --editor-text-accent: ${editorTheme.text.accent};
      --editor-text-link: ${editorTheme.text.link};

      /* Prose */
      --editor-prose-body: ${editorTheme.prose.body};
      --editor-prose-heading: ${editorTheme.prose.heading};
      --editor-prose-code: ${editorTheme.prose.code};
      --editor-prose-code-bg: ${editorTheme.prose.codeBackground};

      /* Code Block */
      --editor-code-bg: ${editorTheme.codeBlock.background};
      --editor-code-header-bg: ${editorTheme.codeBlock.headerBackground};
      --editor-code-border: ${editorTheme.codeBlock.border};

      /* Typography */
      --editor-font-sans: ${typography.fontFamily.sans};
      --editor-font-mono: ${typography.fontFamily.mono};
      --editor-line-height-relaxed: ${typography.lineHeight.relaxed};

      /* Spacing */
      --editor-space-1: ${spacing[1]};
      --editor-space-2: ${spacing[2]};
      --editor-space-3: ${spacing[3]};
      --editor-space-4: ${spacing[4]};
      --editor-space-6: ${spacing[6]};
      --editor-space-8: ${spacing[8]};

      /* Border Radius */
      --editor-radius-sm: ${borderRadius.sm};
      --editor-radius-md: ${borderRadius.md};
      --editor-radius-lg: ${borderRadius.lg};
    }
  `;
}

// Type exports
export type EditorTheme = typeof editorTheme;
export type ColorTokens = typeof colors;
export type TypographyTokens = typeof typography;
