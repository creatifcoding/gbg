/**
 * Terminal Theme Configuration
 *
 * TMNL-compatible terminal themes for ghostty-web
 * Integrates with the TMNL color system
 */

import type { ITheme } from 'ghostty-web';

/**
 * Configuration for terminal theme creation
 */
export interface TerminalThemeConfig {
  /** Background color (hex) */
  background?: string;
  /** Foreground color (hex) */
  foreground?: string;
  /** Cursor color (hex) */
  cursor?: string;
  /** Selection background (hex) */
  selectionBackground?: string;
  /** Selection foreground (hex) */
  selectionForeground?: string;
  /** ANSI palette override */
  palette?: Partial<{
    black: string;
    red: string;
    green: string;
    yellow: string;
    blue: string;
    magenta: string;
    cyan: string;
    white: string;
    brightBlack: string;
    brightRed: string;
    brightGreen: string;
    brightYellow: string;
    brightBlue: string;
    brightMagenta: string;
    brightCyan: string;
    brightWhite: string;
  }>;
}

/**
 * Default TMNL terminal theme
 * Matches the TMNL design system colors
 */
export const tmnlTerminalTheme: ITheme = {
  // Base colors - TMNL surface hierarchy
  background: '#0a0a0c', // surface-base (near black)
  foreground: '#e8e8e8', // high contrast text
  cursor: '#50fa7b', // accent-primary (cyan-green)
  cursorAccent: '#0a0a0c',

  // Selection - semi-transparent accent
  selectionBackground: '#44475a',
  selectionForeground: '#f8f8f2',

  // ANSI Standard Colors - TMNL palette
  black: '#21222c',
  red: '#ff5555',
  green: '#50fa7b', // accent-primary
  yellow: '#f1fa8c',
  blue: '#6272a4',
  magenta: '#ff79c6',
  cyan: '#8be9fd', // accent-secondary
  white: '#f8f8f2',

  // ANSI Bright Colors
  brightBlack: '#6272a4',
  brightRed: '#ff6e6e',
  brightGreen: '#69ff94',
  brightYellow: '#ffffa5',
  brightBlue: '#d6acff',
  brightMagenta: '#ff92df',
  brightCyan: '#a4ffff',
  brightWhite: '#ffffff',
};

/**
 * Create a terminal theme from configuration
 * Merges with TMNL defaults
 */
export function createTerminalTheme(config: TerminalThemeConfig): ITheme {
  return {
    ...tmnlTerminalTheme,
    ...(config.background && { background: config.background }),
    ...(config.foreground && { foreground: config.foreground }),
    ...(config.cursor && { cursor: config.cursor }),
    ...(config.selectionBackground && { selectionBackground: config.selectionBackground }),
    ...(config.selectionForeground && { selectionForeground: config.selectionForeground }),
    ...config.palette,
  };
}

/**
 * Ghostty-native theme (matches Ghostty's defaults)
 * For users who prefer the authentic Ghostty look
 */
export const ghosttyNativeTheme: ITheme = {
  background: '#282a36',
  foreground: '#f8f8f2',
  cursor: '#f8f8f2',
  cursorAccent: '#282a36',
  selectionBackground: '#44475a',
  selectionForeground: '#f8f8f2',

  // Dracula-inspired palette (Ghostty default)
  black: '#21222c',
  red: '#ff5555',
  green: '#50fa7b',
  yellow: '#f1fa8c',
  blue: '#bd93f9',
  magenta: '#ff79c6',
  cyan: '#8be9fd',
  white: '#f8f8f2',
  brightBlack: '#6272a4',
  brightRed: '#ff6e6e',
  brightGreen: '#69ff94',
  brightYellow: '#ffffa5',
  brightBlue: '#d6acff',
  brightMagenta: '#ff92df',
  brightCyan: '#a4ffff',
  brightWhite: '#ffffff',
};
