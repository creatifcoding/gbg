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
  type Tbl, type Kv, type Ls, type Tree, type Code, type Diff, type Bar, type Tag, type Txt, type Md,
  type Stk, type Row,
  type Note, type Color, type PrimitiveTag,
  LEAF_TAGS, COMPOSITE_TAGS, ALL_TAGS, RESERVED_KEYS,
  isPrimitive, isLeaf, isComposite,
  extractLlmContent, findReservedKeys,
} from './types.js'

// Flex layout
export { flexLayout, MIN_COL, COLLAPSE_THRESHOLD, DEFAULT_GAP, type FlexChild } from './flex.js'

// Registry
export { register, hasRenderer, getRenderer, renderPrimitive, tryRenderPrimitive } from './registry.js'

// ─── Side-effect: register all renderers ─────────────────
import './renderers/tbl.js'
import './renderers/kv.js'
import './renderers/ls.js'
import './renderers/tree.js'
import './renderers/code.js'
import './renderers/diff.js'
import './renderers/bar.js'
import './renderers/tag.js'
import './renderers/txt.js'
import './renderers/md.js'
import './renderers/stk.js'
import './renderers/row.js'
