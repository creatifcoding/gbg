import type { CSSProperties } from 'react'

/**
 * TMNL Diff Theme — Vantablack edition.
 *
 * True black (#000000) foundation with surgical accent lighting.
 * The diff should feel like looking at code through a one-way mirror
 * in a SCIF. No warmth. No softness. Just precision.
 *
 * Color philosophy:
 *   - Background: #000 (true black, not "dark gray pretending to be black")
 *   - Additions: emerald at 4-8% opacity — a ghost of green
 *   - Deletions: red at 4-8% opacity — barely perceptible until you focus
 *   - Emphasis: 12-18% opacity — the moment your eyes lock on the change
 *   - Text: neutral-500 for context, emerald-300/red-300 for changes
 *   - Line numbers: neutral-800, nearly invisible until hovered
 *
 * @module chat/msg/tool-block/renderers/diff/tmnl-diff-theme
 */

// =============================================================================
// CSS Variables
// =============================================================================

export const tmnlDiffVars: Record<string, string> = {
  // ── Core ──────────────────────────────────────────
  '--diffs-bg': '#000000',
  '--diffs-fg': '#737373',                            // neutral-500
  '--diffs-font-family': "'Share Tech Mono', 'JetBrains Mono', monospace",
  '--diffs-font-size': '12px',
  '--diffs-line-height': '1.55',
  '--diffs-tab-size': '2',

  // ── Line numbers — near-invisible precision ───────
  '--diffs-fg-number': '#262626',                     // neutral-800
  '--diffs-fg-number-override': '#262626',
  '--diffs-fg-number-addition-override': '#064e3b',   // emerald-950
  '--diffs-fg-number-deletion-override': '#450a0a',   // red-950
  '--diffs-min-number-column-width': '40px',

  // ── Addition (emerald ghost) ──────────────────────
  '--diffs-bg-addition-override': 'rgba(16, 185, 129, 0.04)',
  '--diffs-bg-addition-emphasis-override': 'rgba(16, 185, 129, 0.12)',
  '--diffs-bg-addition-hover-override': 'rgba(16, 185, 129, 0.07)',
  '--diffs-bg-addition-number-override': 'rgba(16, 185, 129, 0.05)',
  '--diffs-addition-color-override': '#6ee7b7',       // emerald-300

  // ── Deletion (red ghost) ──────────────────────────
  '--diffs-bg-deletion-override': 'rgba(239, 68, 68, 0.04)',
  '--diffs-bg-deletion-emphasis-override': 'rgba(239, 68, 68, 0.12)',
  '--diffs-bg-deletion-hover-override': 'rgba(239, 68, 68, 0.07)',
  '--diffs-bg-deletion-number-override': 'rgba(239, 68, 68, 0.05)',
  '--diffs-deletion-color-override': '#fca5a5',       // red-300

  // ── Modified (amber whisper) ──────────────────────
  '--diffs-modified-color-override': '#d97706',        // amber-600

  // ── Context — true void ───────────────────────────
  '--diffs-bg-context-override': '#000000',
  '--diffs-bg-buffer-override': '#000000',
  '--diffs-bg-hover-override': 'rgba(255, 255, 255, 0.015)',

  // ── Separator — hairline in the void ──────────────
  '--diffs-bg-separator-override': '#0a0a0a',

  // ── Selection — cyan trace ────────────────────────
  '--diffs-bg-selection-override': 'rgba(6, 182, 212, 0.08)',
  '--diffs-bg-selection-number-override': 'rgba(6, 182, 212, 0.10)',
  '--diffs-selection-color-override': '#67e8f9',       // cyan-300

  // ── Gap / expander ────────────────────────────────
  '--diffs-gap-style': 'none',
  '--diffs-gap-block': '0',
  '--diffs-gap-inline': '0',
  '--diffs-gap-fallback': '#0a0a0a',
}

export const tmnlDiffStyle: CSSProperties = Object.fromEntries(
  Object.entries(tmnlDiffVars),
) as unknown as CSSProperties


// =============================================================================
// Deep overrides — the scalpel reaches where variables can't
// =============================================================================

export const tmnlDiffUnsafeCSS = `
  /* ── Root container ───────────────────────────── */
  :host, .pierre-diff-container {
    background: #000 !important;
  }

  /* ── File header — we hide it, render our own ── */
  .pierre-file-header {
    display: none !important;
  }

  /* ── Hunk separator — whisper of structure ────── */
  .pierre-hunk-separator,
  .pierre-hunk-info {
    background: #050505 !important;
    color: #333 !important;
    font-size: 11px !important;
    font-family: 'Share Tech Mono', monospace !important;
    border: none !important;
    border-top: 1px solid rgba(38, 38, 38, 0.25) !important;
    border-bottom: 1px solid rgba(38, 38, 38, 0.25) !important;
    padding: 1px 12px !important;
    letter-spacing: 0.02em !important;
  }

  /* ── Diff indicator bars ──────────────────────── */
  .pierre-indicator-addition {
    color: rgba(16, 185, 129, 0.35) !important;
  }

  .pierre-indicator-deletion {
    color: rgba(239, 68, 68, 0.35) !important;
  }

  /* ── Code lines — ghost transitions ───────────── */
  .pierre-line {
    transition: background-color 120ms ease-out, opacity 120ms ease-out !important;
    border: none !important;
  }

  .pierre-line:hover {
    background-color: rgba(255, 255, 255, 0.02) !important;
  }

  /* ── Line number columns — emerge from void ──── */
  .pierre-number-column {
    user-select: none !important;
    opacity: 0.3 !important;
    transition: opacity 200ms ease-out !important;
    font-variant-numeric: tabular-nums !important;
  }

  .pierre-line:hover .pierre-number-column {
    opacity: 0.65 !important;
  }

  /* ── Word-level emphasis — surgical highlights ── */
  .pierre-emphasis-addition {
    border-radius: 1px !important;
    padding: 0 1px !important;
    box-shadow: inset 0 0 0 1px rgba(16, 185, 129, 0.08) !important;
  }

  .pierre-emphasis-deletion {
    border-radius: 1px !important;
    padding: 0 1px !important;
    text-decoration: line-through !important;
    text-decoration-color: rgba(239, 68, 68, 0.2) !important;
    text-decoration-thickness: 1px !important;
    box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.06) !important;
  }

  /* ── Expand/collapse — cyan on approach ────────── */
  .pierre-expand-button,
  .pierre-gap-button,
  [class*="expand"] {
    color: #333 !important;
    font-size: 11px !important;
    font-family: 'Share Tech Mono', monospace !important;
    transition: color 150ms ease-out !important;
    cursor: pointer !important;
    background: #050505 !important;
    border: none !important;
    padding: 1px 8px !important;
  }

  .pierre-expand-button:hover,
  .pierre-gap-button:hover,
  [class*="expand"]:hover {
    color: #06b6d4 !important;
  }

  /* ── Split view gutter — hairline ─────────────── */
  .pierre-split-gutter,
  [class*="gutter"] {
    background: rgba(38, 38, 38, 0.2) !important;
    width: 1px !important;
  }

  /* ── Empty lines in split — void texture ────────── */
  .pierre-empty-line,
  [class*="empty-line"] {
    background: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 5px,
      rgba(23, 23, 23, 0.12) 5px,
      rgba(23, 23, 23, 0.12) 10px
    ) !important;
  }

  /* ── Scrollbar — near-invisible ─────────────────── */
  ::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: rgba(38, 38, 38, 0.4);
    border-radius: 2px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: rgba(64, 64, 64, 0.6);
  }

  /* ── Code token overrides for vantablack ────────── */
  .pierre-line code,
  .pierre-line span[style] {
    text-shadow: none !important;
  }

  /* ── Pre element — kill any inherited bg ────────── */
  pre {
    background: transparent !important;
    margin: 0 !important;
  }
`
