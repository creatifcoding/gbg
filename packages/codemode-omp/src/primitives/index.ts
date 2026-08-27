/**
 * Primitives — Structured Return Values for mt tool
 *
 * Importing this module populates the default (legacy) registry so existing
 * callers of `renderPrimitive` / `tryRenderPrimitive` continue to work.
 *
 * New host adapters should call `registerAllPrimitives(createPrimitiveRegistry())`
 * and pass the resulting registry explicitly through their render context.
 *
 * @module
 */

// ─── Primitive types ─────────────────────────────────────────────────────────

export {
  type Primitive, type Leaf, type Composite,
  type Tbl, type Kv, type Ls, type Tree, type Code, type Diff, type Bar, type Tag, type Txt,
  type Stk, type Row,
  type Note, type Color, type PrimitiveTag,
  LEAF_TAGS, COMPOSITE_TAGS, ALL_TAGS, RESERVED_KEYS,
  isPrimitive, isLeaf, isComposite,
  extractLlmContent, findReservedKeys,
} from './types.ts'

// ─── Flex layout ─────────────────────────────────────────────────────────────

export { flexLayout, MIN_COL, COLLAPSE_THRESHOLD, DEFAULT_GAP, type FlexChild } from './flex.ts'

// ─── Host-neutral render context ─────────────────────────────────────────────

export type {
  RenderContext, RendererTheme, TextMetrics, CodeHighlighter, MarkdownRenderer, KeyHinter,
} from './render-host.ts'

// ─── Registry — legacy + factory API ─────────────────────────────────────────

export {
  // Legacy module-level API (backed by the default registry)
  register, hasRenderer, getRenderer, renderPrimitive, tryRenderPrimitive,
  // Factory API for isolated host registries
  createPrimitiveRegistry, legacyRegistry,
  // Types
  type PrimitiveRegistry, type PrimitiveRenderer, type RegistryRenderer,
} from './registry.ts'

// ─── Per-renderer registration functions ─────────────────────────────────────

import { registerBarRenderer } from './renderers/bar.ts'
import { registerCodeRenderer } from './renderers/code.ts'
import { registerDiffRenderer } from './renderers/diff.ts'
import { registerKvRenderer } from './renderers/kv.ts'
import { registerLsRenderer } from './renderers/ls.ts'
import { registerRowRenderer } from './renderers/row.ts'
import { registerStkRenderer } from './renderers/stk.ts'
import { registerTagRenderer } from './renderers/tag.ts'
import { registerTblRenderer } from './renderers/tbl.ts'
import { registerTreeRenderer } from './renderers/tree.ts'
import { registerTxtRenderer } from './renderers/txt.ts'

import type { PrimitiveRegistry } from './registry.ts'
import { legacyRegistry } from './registry.ts'

/**
 * Register all 11 standard primitive renderers into `registry`.
 * `md` is intentionally excluded — it requires Pi host packages and
 * must be registered separately by the Pi host adapter.
 *
 * @example
 *   const registry = createPrimitiveRegistry()
 *   registerAllPrimitives(registry)
 *   // registry now has all ALL_TAGS except 'md'
 */
export function registerAllPrimitives(registry: PrimitiveRegistry): void {
  registerBarRenderer(registry)
  registerCodeRenderer(registry)
  registerDiffRenderer(registry)
  registerKvRenderer(registry)
  registerLsRenderer(registry)
  registerRowRenderer(registry)
  registerStkRenderer(registry)
  registerTagRenderer(registry)
  registerTblRenderer(registry)
  registerTreeRenderer(registry)
  registerTxtRenderer(registry)
}

// ─── Legacy: populate default registry on import ─────────────────────────────
//
// Existing callers that do `import './primitives/index.ts'` and then use the
// module-level `renderPrimitive` / `tryRenderPrimitive` functions rely on the
// default registry being populated. Satisfy that contract through an explicit
// function call rather than renderer module side effects.

registerAllPrimitives(legacyRegistry)
