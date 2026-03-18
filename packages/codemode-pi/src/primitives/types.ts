/**
 * Primitive Type System for Structured Return Values
 *
 * Tagged return objects: `{ _v: 'tbl', d: [...] }`
 * The `_v` tag routes to a renderer. Agent returns minimal tokens,
 * the TUI gets maximum differentiation.
 *
 * Core invariant: The LLM sees ZERO rendering metadata.
 * `extractLlmContent()` strips all TUI tags before content reaches the model.
 *
 * @module
 */

// ─── Metadata Types ──────────────────────────────────────

/** Icon + message tuple, rendered as footer annotation */
export type Note = [icon: string, message: string]

/** Semantic color tokens — resolved by theme at render time */
export type Color = 'success' | 'error' | 'warning' | 'accent' | 'muted'

// ─── Leaf Primitives ─────────────────────────────────────

export type Tbl = {
  readonly _v: 'tbl'
  readonly d: ReadonlyArray<Record<string, unknown>>
  readonly note?: Note
  readonly flex?: number
}

export type Kv = {
  readonly _v: 'kv'
  readonly d: Readonly<Record<string, unknown>>
  readonly note?: Note
  readonly flex?: number
}

export type Ls = {
  readonly _v: 'ls'
  readonly d: ReadonlyArray<unknown>
  readonly note?: Note
  readonly flex?: number
}

export type Tree = {
  readonly _v: 'tree'
  readonly d: object
  readonly note?: Note
  readonly flex?: number
}

export type Code = {
  readonly _v: 'code'
  readonly d: string
  readonly lang?: string
  readonly note?: Note
  readonly flex?: number
}

export type Diff = {
  readonly _v: 'diff'
  readonly a: string
  readonly b: string
  readonly note?: Note
  readonly flex?: number
}

export type Bar = {
  readonly _v: 'bar'
  readonly v: number
  readonly max: number
  readonly label?: string
  readonly flex?: number
}

export type Tag = {
  readonly _v: 'tag'
  readonly text: string
  readonly color?: Color
  readonly flex?: number
}

export type Txt = {
  readonly _v: 'txt'
  readonly d: string
  readonly color?: Color
  readonly note?: Note
  readonly flex?: number
}

export type Md = {
  readonly _v: 'md'
  readonly text: string
  readonly note?: Note
  readonly flex?: number
}

export type Leaf = Tbl | Kv | Ls | Tree | Code | Diff | Bar | Tag | Txt | Md

// ─── Composite Primitives ────────────────────────────────

export type Stk = {
  readonly _v: 'stk'
  readonly items: ReadonlyArray<Primitive>
  readonly gap?: number
  readonly note?: Note
}

export type Row = {
  readonly _v: 'row'
  readonly items: ReadonlyArray<Primitive>
  readonly gap?: number
  readonly weights?: ReadonlyArray<number>
  readonly note?: Note
}

export type Composite = Stk | Row

// ─── Union ───────────────────────────────────────────────

export type Primitive = Leaf | Composite

// ─── Discriminator Tags ──────────────────────────────────

export const LEAF_TAGS = ['tbl', 'kv', 'ls', 'tree', 'code', 'diff', 'bar', 'tag', 'txt', 'md'] as const
export const COMPOSITE_TAGS = ['stk', 'row'] as const
export const ALL_TAGS = [...LEAF_TAGS, ...COMPOSITE_TAGS] as const

export type LeafTag = (typeof LEAF_TAGS)[number]
export type CompositeTag = (typeof COMPOSITE_TAGS)[number]
export type PrimitiveTag = (typeof ALL_TAGS)[number]

// ─── Reserved Keys ───────────────────────────────────────
// These MUST be stripped from LLM content. If any appear in extractLlmContent
// output, the conformance test fails.

export const RESERVED_KEYS = ['_v', 'note', 'flex', 'color', 'gap', 'weights', 'lang', 'items'] as const
export type ReservedKey = (typeof RESERVED_KEYS)[number]

// ─── Type Guards ─────────────────────────────────────────

/** Check if a value is a tagged Primitive (has `_v` with a known tag) */
export function isPrimitive(x: unknown): x is Primitive {
  if (typeof x !== 'object' || x === null) return false
  const tag = (x as Record<string, unknown>)._v
  return typeof tag === 'string' && (ALL_TAGS as readonly string[]).includes(tag)
}

/** Check if a Primitive is a Leaf (not stk/row) */
export function isLeaf(p: Primitive): p is Leaf {
  return (LEAF_TAGS as readonly string[]).includes(p._v)
}

/** Check if a Primitive is a Composite (stk or row) */
export function isComposite(p: Primitive): p is Composite {
  return p._v === 'stk' || p._v === 'row'
}

// ─── extractLlmContent ──────────────────────────────────
//
// Strips ALL rendering metadata from a primitive result.
// The LLM sees pure domain data — no _v, note, flex, color, gap, weights, lang.
//
// Extraction rules:
//   no _v       → return as-is (backward compat)
//   has _v + .d → return .d
//   bar         → return { v, max, label? } (omit label key if undefined)
//   tag         → return .text
//   diff        → return { a, b }
//   stk/row     → recursively extract items, return as array
//
// CRITICAL: output must NEVER contain any RESERVED_KEYS at any depth.

const RESERVED_SET = new Set<string>(RESERVED_KEYS)

/**
 * Extract clean domain content from a (possibly tagged) result.
 *
 * - Non-primitives pass through unchanged (backward compat).
 * - Primitives have all TUI metadata stripped.
 * - Composites recursively extract children into arrays.
 *
 * @param result - Raw eval result (may or may not be a Primitive)
 * @returns Clean domain data suitable for LLM consumption
 */
export function extractLlmContent(result: unknown): unknown {
  // Non-object → pass through
  if (typeof result !== 'object' || result === null) return result

  // Arrays → pass through (not a tagged primitive)
  if (Array.isArray(result)) return result

  const obj = result as Record<string, unknown>

  // No _v tag → backward compat, pass through unchanged
  if (!('_v' in obj) || typeof obj._v !== 'string') return result

  // Not a known tag → pass through
  if (!(ALL_TAGS as readonly string[]).includes(obj._v)) return result

  const prim = result as Primitive

  switch (prim._v) {
    // ── Data-bearing leaves (have .d) ──
    case 'tbl':
    case 'kv':
    case 'ls':
    case 'tree':
    case 'code':
    case 'txt':
      return prim.d

    // ── Special leaves ──
    case 'bar': {
      const out: Record<string, unknown> = { v: prim.v, max: prim.max }
      if (prim.label !== undefined) out.label = prim.label
      return out
    }

    case 'tag':
      return prim.text

    case 'md':
      return prim.text

    case 'diff':
      return { a: prim.a, b: prim.b }

    // ── Composites ──
    case 'stk':
    case 'row':
      return prim.items.map(item => extractLlmContent(item))

    default: {
      // Exhaustive check — TypeScript will catch missing cases
      const _exhaustive: never = prim
      return result
    }
  }
}

/**
 * Check if a value has any RESERVED_KEYS at any depth.
 * Used in conformance tests to verify extractLlmContent correctness.
 *
 * @returns Array of paths where reserved keys were found (empty = clean)
 */
export function findReservedKeys(value: unknown, path: string = ''): string[] {
  const violations: string[] = []

  if (typeof value !== 'object' || value === null) return violations

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      violations.push(...findReservedKeys(value[i], `${path}[${i}]`))
    }
    return violations
  }

  const obj = value as Record<string, unknown>
  for (const key of Object.keys(obj)) {
    const fullPath = path ? `${path}.${key}` : key
    if (RESERVED_SET.has(key)) {
      violations.push(fullPath)
    }
    violations.push(...findReservedKeys(obj[key], fullPath))
  }

  return violations
}
