/**
 * Floating Panel Design Tokens
 *
 * Vantablack palette — pure neutral grayscale, no green tint.
 * Surgical green accent (#22c55e) only for interactive highlights.
 *
 * @module
 */

export const PANEL = {
  /** Panel body background */
  bg: '#0a0a0a',
  /** Title bar / header background */
  headerBg: '#0f0f0f',
  /** Tab background within title bar */
  tabBg: '#121212',
  /** Border — idle state */
  border: '#1a1a1a',
  /** Border — active (dragging/resizing) */
  borderActive: '#2a2a2a',
  /** Secondary text */
  text: '#525252',
  /** Primary text */
  textStrong: '#d4d4d4',
  /** Chrome button idle color */
  btnIdle: '#404040',
  /** Title bar height in px */
  headerHeight: 32,
  /** Border radius (0 = sharp corners, vantablack aesthetic) */
  radius: 0,
} as const

/** Type for the PANEL token object */
export type PanelTokens = typeof PANEL
