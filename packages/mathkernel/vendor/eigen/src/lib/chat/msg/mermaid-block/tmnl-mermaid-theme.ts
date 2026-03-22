/**
 * TMNL × beautiful-mermaid — Theme Mapping
 *
 * Maps the TMNL design system to beautiful-mermaid's DiagramColors interface.
 * Provides both a static TMNL theme and a Shiki-derived theme (from one-dark-pro)
 * that stays consistent with the syntax highlighting throughout the chat.
 *
 * beautiful-mermaid's theming uses CSS custom properties:
 *   --bg, --fg  (required)  → two-color mono foundation
 *   --line, --accent, --muted, --surface, --border  (optional enrichment)
 *
 * Unset optional vars fall back to color-mix() derivations from bg+fg.
 * We provide all 7 for maximum control.
 *
 * @module chat/msg/mermaid-block/tmnl-mermaid-theme
 */

import type { DiagramColors } from 'beautiful-mermaid'

// =============================================================================
// Static TMNL Theme
// =============================================================================

/**
 * TMNL diagram colors — hand-tuned for the pure-black chat aesthetic.
 *
 * Color mapping rationale:
 *   bg      → neutral-950 (#0a0a0a) — chat message background
 *   fg      → neutral-200 (#e5e5e5) — primary text, node labels
 *   line    → neutral-700 (#404040) — connectors, edges (subdued)
 *   accent  → cyan-400 (#22d3ee)    — arrow heads, highlights (TMNL signature)
 *   muted   → neutral-500 (#737373) — edge labels, secondary text
 *   surface → neutral-900 (#171717) — node fill (barely visible tint)
 *   border  → neutral-800 (#262626) — node strokes, group outlines
 */
export const TMNL_MERMAID_COLORS: DiagramColors = {
  bg: '#0a0a0a',
  fg: '#e5e5e5',
  line: '#404040',
  accent: '#22d3ee',
  muted: '#737373',
  surface: '#171717',
  border: '#262626',
}

/**
 * TMNL Mermaid theme with transparent background.
 * Use when embedding in a container that already has the TMNL bg.
 */
export const TMNL_MERMAID_TRANSPARENT: DiagramColors = {
  ...TMNL_MERMAID_COLORS,
}

// =============================================================================
// Shiki-Derived Theme (one-dark-pro)
// =============================================================================

/**
 * DiagramColors derived from one-dark-pro's palette.
 * This keeps diagrams visually consistent with Shiki-highlighted code blocks.
 *
 * Source mapping (from one-dark-pro theme JSON):
 *   editor.background           → bg (#282c34)
 *   editor.foreground           → fg (#abb2bf)
 *   editorLineNumber.foreground → line (#495162)
 *   keyword token (purple)      → accent (#c678dd)
 *   comment token               → muted (#5c6370)
 *   editor.selectionBackground  → surface (#3e4451)
 *   editorWidget.border         → border (#3a3f4b)
 */
export const ONE_DARK_PRO_MERMAID_COLORS: DiagramColors = {
  bg: '#282c34',
  fg: '#abb2bf',
  line: '#495162',
  accent: '#c678dd',
  muted: '#5c6370',
  surface: '#3e4451',
  border: '#3a3f4b',
}

// =============================================================================
// Theme Variants
// =============================================================================

/**
 * Cyan-accented variant — keeps TMNL's signature cyan instead of
 * one-dark-pro's purple, while using the ODP background palette.
 */
export const TMNL_HYBRID_COLORS: DiagramColors = {
  bg: '#0a0a0a',
  fg: '#abb2bf',
  line: '#3d3d3d',
  accent: '#22d3ee',   // TMNL cyan
  muted: '#5c6370',
  surface: '#141414',
  border: '#2a2a2a',
}

// =============================================================================
// Default Export
// =============================================================================

/**
 * The default TMNL mermaid theme used in chat message rendering.
 * Uses the hybrid palette: TMNL black bg + cyan accent + ODP text colors.
 */
export const TMNL_DIAGRAM_THEME = TMNL_HYBRID_COLORS
