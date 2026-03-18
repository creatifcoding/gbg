/**
 * Renderer Registry — dispatch + note threading
 *
 * Pure `register(tag, fn)` → `Map<tag, renderer>` pattern.
 * Each renderer is `(prim, width, theme) → string[]`.
 * Notes are appended by the registry after rendering — renderers don't handle notes.
 *
 * SAFETY: Every line returned by renderPrimitive is truncated to width.
 * Individual renderers SHOULD respect width, but the registry is the final guard.
 *
 * @module
 */

import type { Theme } from '@mariozechner/pi-coding-agent'
import { truncateToWidth, visibleWidth } from '@mariozechner/pi-tui'
import type { Primitive, PrimitiveTag, Note } from './types.js'
import { isPrimitive } from './types.js'

// ─── Renderer Function ──────────────────────────────────

/**
 * A renderer transforms a Primitive into TUI lines.
 * Pure function — no side effects, no note handling.
 */
export type PrimitiveRenderer<T extends Primitive = Primitive> = (
  prim: T,
  width: number,
  theme: Theme,
) => string[]

// ─── Registry ────────────────────────────────────────────

const renderers = new Map<PrimitiveTag, PrimitiveRenderer>()

/**
 * Register a renderer for a primitive tag.
 * Overwrites any existing renderer for that tag.
 */
export function register<T extends Primitive>(
  tag: T['_v'],
  renderer: PrimitiveRenderer<T>,
): void {
  renderers.set(tag, renderer as PrimitiveRenderer)
}

/**
 * Check if a renderer is registered for a tag.
 */
export function hasRenderer(tag: PrimitiveTag): boolean {
  return renderers.has(tag)
}

/**
 * Get the renderer for a tag (or undefined).
 */
export function getRenderer(tag: PrimitiveTag): PrimitiveRenderer | undefined {
  return renderers.get(tag)
}

// ─── renderPrimitive ─────────────────────────────────────

/**
 * Render a Primitive to TUI lines.
 *
 * Dispatches to the registered renderer for the primitive's `_v` tag.
 * Appends note annotation after the rendered content if present.
 * **Safety net: every line is truncated to width before returning.**
 *
 * @param prim - The primitive to render
 * @param width - Available terminal width
 * @param theme - Theme for styling
 * @returns Array of rendered lines, all guaranteed ≤ width visible chars
 */
export function renderPrimitive(
  prim: Primitive,
  width: number,
  theme: Theme,
): string[] {
  const renderer = renderers.get(prim._v)

  if (!renderer) {
    return [truncateToWidth(theme.fg('warning', `[unknown primitive: ${prim._v}]`), width)]
  }

  const lines = renderer(prim, width, theme)

  // Append note if present
  const note = (prim as { note?: Note }).note
  if (note) {
    lines.push(renderNote(note, theme))
  }

  // ── Safety net: truncate every line to width ──
  // Renderers SHOULD respect width, but this guarantees no TUI crash.
  for (let i = 0; i < lines.length; i++) {
    if (visibleWidth(lines[i]) > width) {
      lines[i] = truncateToWidth(lines[i], width)
    }
  }

  return lines
}

/**
 * Check if a value is a Primitive and render it if so.
 * Returns null if not a primitive (caller uses existing rendering path).
 */
export function tryRenderPrimitive(
  value: unknown,
  width: number,
  theme: Theme,
): string[] | null {
  if (!isPrimitive(value)) return null
  return renderPrimitive(value, width, theme)
}

// ─── Note Rendering ──────────────────────────────────────

function renderNote(note: Note, theme: Theme): string {
  const [icon, message] = note
  return theme.fg('muted', `${icon} ${message}`)
}
