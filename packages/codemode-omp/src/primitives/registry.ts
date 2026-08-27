/**
 * Renderer Registry — dispatch + note threading
 *
 * Provides two APIs:
 *
 * 1. **Factory API** (`createPrimitiveRegistry`): returns an isolated instance.
 *    Renderers registered in one instance are invisible to all others.
 *    Use this in host adapters to keep Pi and OMP renderer sets separate.
 *
 * 2. **Legacy module-level API** (`register`, `renderPrimitive`, etc.):
 *    backed by a single default instance so existing side-effect renderer
 *    imports continue to work without changes.
 *
 * SAFETY: Every line returned by `renderPrimitive` is clamped to width via
 * the host TextMetrics — renderers SHOULD respect width but the registry is
 * the final guard.
 *
 * @module
 */

import type { Primitive, PrimitiveTag } from './types.ts'
import { isPrimitive } from './types.ts'
import type { RenderContext, RendererTheme } from './render-host.ts'
import { createLegacyRenderContext } from './render-host.ts'

// ─── Renderer Function ──────────────────────────────────

/**
 * A renderer transforms a Primitive into TUI lines.
 * Pure function — no side effects, no note handling.
 *
 * The context parameter is `RendererTheme` for backward compatibility:
 * existing renderers call `ctx.fg(...)` directly.  The registry internally
 * passes `ctx.theme` (extracted from the full `RenderContext`) so renderers
 * work without changes.
 *
 * Migration path: C2/F3 will update renderer files to accept `RegistryRenderer`
 * (full `RenderContext`) once each renderer is migrated.
 */
export type PrimitiveRenderer<T extends Primitive = Primitive> = (
  prim: T,
  width: number,
  ctx: RendererTheme,
) => string[]

// ─── Context-Aware Renderer ───────────────────────────────

/**
 * A renderer that receives the full host RenderContext.
 * Used by PrimitiveRegistry (factory API). Prefer this over the legacy
 * PrimitiveRenderer for new code.
 */
export type RegistryRenderer<T extends Primitive = Primitive> = (
  prim: T,
  width: number,
  ctx: RenderContext,
) => string[]

// ─── PrimitiveRegistry interface ─────────────────────────

export interface PrimitiveRegistry {
  /** Register a renderer for a primitive tag. Overwrites any existing renderer. */
  register<T extends Primitive>(tag: T['_v'], renderer: RegistryRenderer<T>): void
  /** Check if a renderer is registered for a tag. */
  hasRenderer(tag: PrimitiveTag): boolean
  /** Get the renderer for a tag, or undefined. */
  getRenderer(tag: PrimitiveTag): RegistryRenderer | undefined
  /** Render a Primitive to TUI lines. Note appending and width clamping are applied. */
  renderPrimitive(prim: Primitive, width: number, ctx: RenderContext): string[]
  /**
   * Render only if `value` is a Primitive; return null otherwise.
   * Callers use null to fall back to their own rendering path.
   */
  tryRenderPrimitive(value: unknown, width: number, ctx: RenderContext): string[] | null
}

// ─── Factory ──────────────────────────────────────────────

/**
 * Create an isolated PrimitiveRegistry instance.
 *
 * Each call returns a fresh Map — instances never share renderer state.
 * This allows Pi and OMP hosts to maintain separate registries without
 * global side effects.
 */
export function createPrimitiveRegistry(): PrimitiveRegistry {
  const map = new Map<PrimitiveTag, RegistryRenderer>()

  return {
    register<T extends Primitive>(tag: T['_v'], renderer: RegistryRenderer<T>): void {
      map.set(tag, renderer as RegistryRenderer)
    },

    hasRenderer(tag: PrimitiveTag): boolean {
      return map.has(tag)
    },

    getRenderer(tag: PrimitiveTag): RegistryRenderer | undefined {
      return map.get(tag)
    },

    renderPrimitive(prim: Primitive, width: number, ctx: RenderContext): string[] {
      const renderer = map.get(prim._v)

      if (!renderer) {
        return [ctx.text.truncateToWidth(
          ctx.theme.fg('warning', `[unknown primitive: ${prim._v}]`),
          width,
        )]
      }

      const lines = renderer(prim, width, ctx)

      // Append note if present. Use `in` narrowing — Bar and Tag lack `note`,
      // so a cast would silently trust a shape the compiler never checked.
      if ('note' in prim && prim.note !== undefined) {
        const [icon, message] = prim.note
        lines.push(ctx.theme.fg('muted', `${icon} ${message}`))
      }

      // Safety net: every line is clamped to width via host text metrics.
      for (let i = 0; i < lines.length; i++) {
        if (ctx.text.visibleWidth(lines[i]) > width) {
          lines[i] = ctx.text.truncateToWidth(lines[i], width)
        }
      }

      return lines
    },

    tryRenderPrimitive(value: unknown, width: number, ctx: RenderContext): string[] | null {
      if (!isPrimitive(value)) return null
      return this.renderPrimitive(value, width, ctx)
    },
  }
}

// ─── Legacy module-level API ─────────────────────────────
//
// Backed by a single default PrimitiveRegistry instance.
// Existing side-effect renderer imports call module-level register() here,
// which stores them in _defaultRegistry wrapped as RegistryRenderer.
// All legacy callers (render.ts, layout.ts, steer.ts) continue to work
// because their current theme object satisfies RendererTheme structurally.

const _defaultRegistry = createPrimitiveRegistry()

/**
 * Register a renderer for a primitive tag.
 * Overwrites any existing renderer for that tag.
 *
 * The renderer is adapted from PrimitiveRenderer (RendererTheme context) to
 * RegistryRenderer (full RenderContext): the factory calls the lambda with
 * ctx.theme so the renderer receives the RendererTheme it has always expected.
 */
export function register<T extends Primitive>(
  tag: T['_v'],
  renderer: PrimitiveRenderer<T>,
): void {
  _defaultRegistry.register(tag, (prim, width, ctx) => renderer(prim, width, ctx.theme))
}

/**
 * Check if a renderer is registered for a tag.
 */
export function hasRenderer(tag: PrimitiveTag): boolean {
  return _defaultRegistry.hasRenderer(tag)
}

/**
 * Get the renderer for a tag (or undefined).
 * Returns a PrimitiveRenderer wrapper that accepts a RendererTheme argument
 * so any caller that invokes the function directly continues to work.
 */
export function getRenderer(tag: PrimitiveTag): PrimitiveRenderer | undefined {
  const r = _defaultRegistry.getRenderer(tag)
  if (!r) return undefined
  return (prim, width, theme) => r(prim, width, createLegacyRenderContext(theme))
}

/**
 * Render a Primitive to TUI lines.
 *
 * Accepts any RendererTheme-compatible context. Builds a full RenderContext via
 * `createLegacyRenderContext` so the factory's safety-net truncation always
 * fires.
 */
export function renderPrimitive(
  prim: Primitive,
  width: number,
  theme: RendererTheme,
): string[] {
  return _defaultRegistry.renderPrimitive(prim, width, createLegacyRenderContext(theme))
}

/**
 * Check if a value is a Primitive and render it if so.
 * Returns null if not a primitive — caller falls back to its own rendering path.
 */
export function tryRenderPrimitive(
  value: unknown,
  width: number,
  theme: RendererTheme,
): string[] | null {
  if (!isPrimitive(value)) return null
  return renderPrimitive(value, width, theme)
}

/**
 * The default registry backing the legacy module-level API.
 * Pass to `registerAllPrimitives(legacyRegistry)` from `primitives/index.ts`
 * so the default registry is populated through an explicit call rather than
 * through renderer module side effects.
 */
export const legacyRegistry: PrimitiveRegistry = _defaultRegistry
