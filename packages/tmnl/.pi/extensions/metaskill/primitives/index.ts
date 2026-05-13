/**
 * Primitives — Structured Return Values for ms tool
 *
 * Import this module to register all renderers.
 * Side-effect imports trigger `register()` calls.
 *
 * @module
 */

// Types (re-exported for consumers)
export {
  type Primitive, type Leaf, type Composite,
  type Tbl, type Kv, type Ls, type Tree, type Code, type Diff, type Bar, type Tag, type Txt,
  type Stk, type Row,
  type Note, type Color, type PrimitiveTag,
  LEAF_TAGS, COMPOSITE_TAGS, ALL_TAGS, RESERVED_KEYS,
  isPrimitive, isLeaf, isComposite,
  extractLlmContent, findReservedKeys,
} from './types.ts'

// Flex layout
export { flexLayout, MIN_COL, COLLAPSE_THRESHOLD, DEFAULT_GAP, type FlexChild } from './flex.ts'

// Registry
export { register, hasRenderer, getRenderer, renderPrimitive, tryRenderPrimitive } from './registry.ts'

// ─── Side-effect: register all renderers ─────────────────
import './renderers/tbl.ts'
import './renderers/kv.ts'
import './renderers/ls.ts'
import './renderers/tree.ts'
import './renderers/code.ts'
import './renderers/diff.ts'
import './renderers/bar.ts'
import './renderers/tag.ts'
import './renderers/txt.ts'
import './renderers/stk.ts'
import './renderers/row.ts'
