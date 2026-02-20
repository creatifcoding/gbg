/**
 * @fileoverview Response Normalization — Cluster 1 + 2
 *
 * Converts raw LLM output into canonical UITree.
 *
 * Pipeline:
 *   extractJson(raw)  → clean JSON string
 *   detectFormat(obj)  → Nested | Flat | Hybrid discriminant
 *   toCanonical(obj)   → UITree
 *
 * Design decisions (INCREMENTAL-NORMALIZATION.md §10):
 *   - Format detection is per-element (Q3)
 *   - Error boundary is quarantine (Q4)
 *   - Pure functions, no streaming dependency
 *
 * @module genifer/core/normalize
 */

import { Schema, Effect, Option, HashMap } from "effect"
import { UIElement, UITree } from "./schemas"

// =============================================================================
// Cluster 1: Response Extraction
// =============================================================================

/**
 * Tagged error for JSON extraction failures.
 */
export class NormalizeError extends Schema.TaggedClass<NormalizeError>()(
  "NormalizeError",
  {
    stage: Schema.Literal("extract", "parse", "detect", "convert", "repair"),
    message: Schema.String,
    raw: Schema.optional(Schema.String),
    context: Schema.optional(Schema.Unknown),
  }
) {}

/**
 * Extract clean JSON from raw LLM output.
 *
 * Ordered strategies:
 *  1. Strip markdown fences (```json ... ```)
 *  2. Strip single-line // comments (STRING-AWARE — preserves URLs in values)
 *  3. Remove trailing commas before } or ]
 *  4. Find outermost { } or [ ] bracket pair
 *  5. If unmatched brackets, attempt partial recovery (close open brackets)
 *  6. If multiple root objects found, merge into wrapper
 *
 * Returns the cleaned JSON string or a NormalizeError.
 */
export function extractJson(raw: string): Effect.Effect<string, NormalizeError> {
  return Effect.sync(() => {
    let s = raw.trim()

    // 1. Strip markdown fences
    s = s.replace(/^```(?:json|JSON)?\s*\n?/, "").replace(/\n?\s*```\s*$/, "")

    // 2. Strip single-line // comments — STRING-AWARE
    // Walk character by character, only strip // when outside JSON strings
    s = stripCommentsStringAware(s)

    // 3. Remove trailing commas before } or ]
    s = s.replace(/,\s*([}\]])/g, "$1")

    // 4. Find ALL top-level JSON objects/arrays
    const blocks = findJsonBlocks(s)

    if (blocks.length === 0) {
      throw new NormalizeError({
        stage: "extract",
        message: "No JSON object or array found in response",
        raw: raw.slice(0, 200),
      })
    }

    // 6. If multiple root objects, merge into a wrapper
    if (blocks.length > 1) {
      // Try: wrap in { "type": "Root", "children": [...] }
      // But only if each block is an object (not array)
      const allObjects = blocks.every(b => b.startsWith("{"))
      if (allObjects) {
        return `{"type":"Root","key":"multi-root","children":[${blocks.join(",")}]}`
      }
      // Fallback: return first block
      return blocks[0]
    }

    return blocks[0]
  }).pipe(
    Effect.catchAll((e) =>
      e instanceof NormalizeError
        ? Effect.fail(e)
        : Effect.fail(new NormalizeError({
            stage: "extract",
            message: e instanceof Error ? e.message : String(e),
            raw: raw.slice(0, 200),
          }))
    )
  )
}

/**
 * Strip // comments while preserving URLs inside JSON string values.
 * Walks the string character-by-character tracking string state.
 * @internal
 */
function stripCommentsStringAware(s: string): string {
  const out: string[] = []
  let inString = false
  let escape = false

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]

    if (escape) {
      out.push(ch)
      escape = false
      continue
    }

    if (ch === "\\") {
      out.push(ch)
      escape = true
      continue
    }

    if (ch === '"') {
      inString = !inString
      out.push(ch)
      continue
    }

    if (inString) {
      out.push(ch)
      continue
    }

    // Outside string: check for //
    if (ch === "/" && i + 1 < s.length && s[i + 1] === "/") {
      // Skip until end of line
      while (i < s.length && s[i] !== "\n") i++
      // Don't skip the \n itself — push it
      if (i < s.length) out.push("\n")
      continue
    }

    out.push(ch)
  }

  return out.join("")
}

/**
 * Find all top-level JSON blocks in a string.
 * Handles multiple { } objects or [ ] arrays.
 * Attempts partial recovery for truncated JSON (closes open brackets).
 * @internal
 */
function findJsonBlocks(s: string): string[] {
  const blocks: string[] = []
  let i = 0

  while (i < s.length) {
    // Skip non-JSON characters
    if (s[i] !== "{" && s[i] !== "[") { i++; continue }

    const startChar = s[i] as "{" | "["
    const endChar = startChar === "{" ? "}" : "]"
    const startIdx = i

    // Find matching close
    let depth = 0
    let inStr = false
    let esc = false
    let endIdx = -1
    let lastBalancedIdx = -1

    for (let j = startIdx; j < s.length; j++) {
      const ch = s[j]
      if (esc) { esc = false; continue }
      if (ch === "\\") { esc = true; continue }
      if (ch === '"') { inStr = !inStr; continue }
      if (inStr) continue

      if (ch === "{" || ch === "[") depth++
      if (ch === "}" || ch === "]") {
        depth--
        if (depth === 0) { endIdx = j; break }
        // Track last position where depth was 1 and we closed something
        if (depth === 1 && (ch === "}" || ch === "]")) {
          lastBalancedIdx = j
        }
      }
    }

    if (endIdx !== -1) {
      blocks.push(s.slice(startIdx, endIdx + 1))
      i = endIdx + 1
    } else {
      // Truncated JSON — attempt partial recovery
      let truncated = s.slice(startIdx)

      // If we were inside a string when truncation happened, close it
      if (inStr) truncated += '"'

      // Track bracket stack in nesting order to close correctly
      // Walk the (now string-closed) truncated content and record open brackets
      const bracketStack: Array<"}" | "]"> = []
      let tInStr = false
      let tEsc = false
      for (let k = 0; k < truncated.length; k++) {
        const ch = truncated[k]
        if (tEsc) { tEsc = false; continue }
        if (ch === "\\") { tEsc = true; continue }
        if (ch === '"') { tInStr = !tInStr; continue }
        if (tInStr) continue
        if (ch === "{") bracketStack.push("}")
        else if (ch === "[") bracketStack.push("]")
        else if (ch === "}" || ch === "]") bracketStack.pop()
      }

      // Close in reverse nesting order (innermost first)
      while (bracketStack.length > 0) {
        truncated += bracketStack.pop()
      }

      blocks.push(truncated)
      break // No more blocks after a truncation
    }
  }

  return blocks
}

/**
 * Parse a cleaned JSON string into an unknown object.
 */
export function parseJson(clean: string): Effect.Effect<unknown, NormalizeError> {
  return Effect.try({
    try: () => JSON.parse(clean),
    catch: (e) =>
      new NormalizeError({
        stage: "parse",
        message: e instanceof Error ? e.message : String(e),
        raw: clean.slice(0, 200),
      }),
  })
}

// =============================================================================
// Cluster 2: Format Detection + Canonical Conversion
// =============================================================================

/**
 * Detected JSON format — the coproduct discriminant.
 *
 * Nested:  { type, key?, props?, children: [{...}, ...] }
 * Flat:    { root: string, elements: { key: {...} } }
 * Hybrid:  { type, key?, children: ["k1","k2"], k1: {...}, k2: {...} }
 */
export const ResponseFormat = Schema.Literal("nested", "flat", "hybrid")
export type ResponseFormat = typeof ResponseFormat.Type

/**
 * Detect which JSON format the LLM used.
 *
 * Discrimination order:
 *  1. Has `root` + `elements` + no `type` → Flat
 *  2. Has `type` + `children[0]` is string → Hybrid
 *  3. Has `type` → Nested
 *  4. Unknown → NormalizeError
 */
export function detectFormat(obj: unknown): Effect.Effect<ResponseFormat, NormalizeError> {
  return Effect.sync(() => {
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
      throw new NormalizeError({
        stage: "detect",
        message: `Expected JSON object, got ${Array.isArray(obj) ? "array" : typeof obj}`,
      })
    }
    const o = obj as Record<string, unknown>

    // Format B: Flat { root, elements }
    if (
      typeof o.root === "string" &&
      typeof o.elements === "object" &&
      o.elements !== null &&
      !Array.isArray(o.elements) &&
      typeof o.type !== "string"
    ) {
      return "flat" as const
    }

    // Must have type for nested/hybrid
    if (typeof o.type !== "string") {
      throw new NormalizeError({
        stage: "detect",
        message: "JSON has no 'type' field and is not flat format (no 'root'+'elements')",
        context: Object.keys(o).slice(0, 10),
      })
    }

    // Check children format
    if (Array.isArray(o.children) && o.children.length > 0) {
      const first = o.children[0]
      if (typeof first === "string") return "hybrid" as const
      if (typeof first === "object" && first !== null) return "nested" as const
    }

    // Has type, no children or empty children — treat as nested (leaf node)
    return "nested" as const
  }).pipe(
    Effect.catchAll((e) =>
      e instanceof NormalizeError
        ? Effect.fail(e)
        : Effect.fail(new NormalizeError({ stage: "detect", message: String(e) }))
    )
  )
}

// =============================================================================
// Converters: Format → UITree
// =============================================================================

/**
 * Convert nested format { type, key, props, children: [{...}] } → UITree.
 *
 * Recursively walks the nested structure, auto-generating keys where missing.
 */
export function fromNested(obj: Record<string, unknown>): Effect.Effect<UITree, NormalizeError> {
  return Effect.sync(() => {
    const rootKey = (obj.key as string) ?? "root"
    let elements: Record<string, UIElement> = {}
    let autoId = 0

    function ensureKey(node: Record<string, unknown>): string {
      if (typeof node.key === "string" && node.key.length > 0) return node.key
      return `auto-${autoId++}`
    }

    function walk(node: Record<string, unknown>, parentKey: string | null): string {
      const key = ensureKey(node)
      const children = Array.isArray(node.children) ? node.children : []
      const childKeys: string[] = []

      for (const child of children) {
        if (typeof child === "object" && child !== null && !Array.isArray(child)) {
          childKeys.push(walk(child as Record<string, unknown>, key))
        } else if (typeof child === "string" && child.length > 0) {
          // String child reference (hybrid-in-nested) — keep as ref
          childKeys.push(child)
        }
        // Skip null, number, boolean children — they're junk
      }

      // Extract props: everything except meta-fields
      const metaKeys = new Set(["type", "key", "props", "children", "_tag"])
      const rawProps = typeof node.props === "object" && node.props !== null
        ? (node.props as Record<string, unknown>)
        : {}

      // Also collect top-level non-meta fields as props (some models inline props)
      const inlinedProps: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(node)) {
        if (!metaKeys.has(k) && typeof v !== "object") {
          inlinedProps[k] = v
        }
      }

      const props = { ...inlinedProps, ...rawProps }

      elements[key] = new UIElement({
        key,
        type: (node.type as string) ?? "Unknown",
        props,
        children: childKeys.length > 0 ? childKeys : [],
        parentKey,
      })

      return key
    }

    walk(obj, null)
    return UITree.fromRecord(rootKey, elements)
  }).pipe(
    Effect.catchAll((e) =>
      e instanceof NormalizeError
        ? Effect.fail(e)
        : Effect.fail(new NormalizeError({ stage: "convert", message: String(e) }))
    )
  )
}

/**
 * Convert flat format { root, elements: { key: {...} } } → UITree.
 *
 * Resolves parentKey from children references.
 */
export function fromFlat(obj: Record<string, unknown>): Effect.Effect<UITree, NormalizeError> {
  return Effect.sync(() => {
    const rootKey = obj.root as string
    const rawElements = obj.elements as Record<string, Record<string, unknown>>
    const elements: Record<string, UIElement> = {}

    // First pass: create elements
    for (const [key, val] of Object.entries(rawElements)) {
      if (typeof val !== "object" || val === null) continue
      const childArr = Array.isArray(val.children)
        ? (val.children as unknown[]).filter((c): c is string => typeof c === "string")
        : []

      const rawProps = typeof val.props === "object" && val.props !== null
        ? (val.props as Record<string, unknown>)
        : {}

      elements[key] = new UIElement({
        key,
        type: (val.type as string) ?? "Unknown",
        props: rawProps,
        children: childArr,
        parentKey: null,
      })
    }

    // Second pass: fill parentKey from children references
    for (const [key, val] of Object.entries(rawElements)) {
      if (typeof val !== "object" || val === null) continue
      if (Array.isArray(val.children)) {
        for (const ck of val.children) {
          if (typeof ck === "string" && elements[ck]) {
            elements[ck] = new UIElement({ ...elements[ck], parentKey: key })
          }
        }
      }
    }

    return UITree.fromRecord(rootKey, elements)
  }).pipe(
    Effect.catchAll((e) =>
      e instanceof NormalizeError
        ? Effect.fail(e)
        : Effect.fail(new NormalizeError({ stage: "convert", message: String(e) }))
    )
  )
}

/**
 * Convert hybrid format → UITree.
 *
 * Hybrid: { type, key?, children: ["k1","k2"], k1: {...}, k2: {...} }
 * Root has type + string children, sibling keys hold component definitions.
 * Recursively collects all sibling definitions.
 */
export function fromHybrid(obj: Record<string, unknown>): Effect.Effect<UITree, NormalizeError> {
  return Effect.sync(() => {
    const rootKey = (obj.key as string) ?? "root"
    const metaKeys = new Set(["type", "key", "props", "children", "_tag"])

    // Collect all element definitions
    const flatElements: Record<string, Record<string, unknown>> = {}

    function collect(node: Record<string, unknown>, key: string) {
      flatElements[key] = {
        type: node.type,
        props: node.props ?? {},
        children: Array.isArray(node.children)
          ? (node.children as unknown[]).filter((c): c is string => typeof c === "string")
          : [],
      }

      // Sibling definitions: non-meta keys holding objects with `type`
      for (const [k, v] of Object.entries(node)) {
        if (metaKeys.has(k)) continue
        if (typeof v === "object" && v !== null && !Array.isArray(v)) {
          const child = v as Record<string, unknown>
          if (typeof child.type === "string" && !flatElements[k]) {
            collect(child, k)
          }
        }
      }

      // Also check if children keys reference sibling definitions on the node
      if (Array.isArray(node.children)) {
        for (const ck of node.children) {
          if (typeof ck === "string" && typeof node[ck] === "object" && node[ck] !== null) {
            const child = node[ck] as Record<string, unknown>
            if (typeof child.type === "string" && !flatElements[ck]) {
              collect(child, ck)
            }
          }
        }
      }
    }

    collect(obj, rootKey)

    // Now convert flat elements → UITree via fromFlat logic
    const elements: Record<string, UIElement> = {}
    for (const [key, val] of Object.entries(flatElements)) {
      const childArr = Array.isArray(val.children)
        ? (val.children as string[])
        : []

      const rawProps = typeof val.props === "object" && val.props !== null
        ? (val.props as Record<string, unknown>)
        : {}

      elements[key] = new UIElement({
        key,
        type: (val.type as string) ?? "Unknown",
        props: rawProps,
        children: childArr,
        parentKey: null,
      })
    }

    // Fill parentKey
    for (const [key, val] of Object.entries(flatElements)) {
      if (Array.isArray(val.children)) {
        for (const ck of val.children as string[]) {
          if (elements[ck]) {
            elements[ck] = new UIElement({ ...elements[ck], parentKey: key })
          }
        }
      }
    }

    return UITree.fromRecord(rootKey, elements)
  }).pipe(
    Effect.catchAll((e) =>
      e instanceof NormalizeError
        ? Effect.fail(e)
        : Effect.fail(new NormalizeError({ stage: "convert", message: String(e) }))
    )
  )
}

// =============================================================================
// Unified Normalizer
// =============================================================================

/**
 * Normalize raw LLM output → UITree.
 *
 * Full pipeline: extract → parse → detect → convert.
 * Per-element format detection (Design Decision Q3).
 */
export function normalize(raw: string): Effect.Effect<UITree, NormalizeError> {
  return Effect.gen(function* () {
    const clean = yield* extractJson(raw)
    const parsed = yield* parseJson(clean)
    const format = yield* detectFormat(parsed)
    const obj = parsed as Record<string, unknown>

    switch (format) {
      case "nested": return yield* fromNested(obj)
      case "flat":   return yield* fromFlat(obj)
      case "hybrid": return yield* fromHybrid(obj)
    }
  })
}

/**
 * Normalize with metadata — returns tree + detected format + extraction info.
 */
export function normalizeWithMeta(raw: string): Effect.Effect<NormalizeResult, NormalizeError> {
  return Effect.gen(function* () {
    const clean = yield* extractJson(raw)
    const parsed = yield* parseJson(clean)
    const format = yield* detectFormat(parsed)
    const obj = parsed as Record<string, unknown>

    let tree: UITree
    switch (format) {
      case "nested": tree = yield* fromNested(obj); break
      case "flat":   tree = yield* fromFlat(obj); break
      case "hybrid": tree = yield* fromHybrid(obj); break
    }

    return {
      tree,
      format,
      extractedLength: clean.length,
      rawLength: raw.length,
      elementCount: tree.size,
    } satisfies NormalizeResult
  })
}

/** Result of normalization with metadata */
export interface NormalizeResult {
  readonly tree: UITree
  readonly format: ResponseFormat
  readonly extractedLength: number
  readonly rawLength: number
  readonly elementCount: number
}
