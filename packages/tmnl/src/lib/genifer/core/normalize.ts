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
 *  2. Strip prose wrapper (find outermost { } or [ ])
 *  3. Remove trailing commas before } or ]
 *  4. Strip single-line // comments
 *
 * Returns the cleaned JSON string or a NormalizeError.
 */
export function extractJson(raw: string): Effect.Effect<string, NormalizeError> {
  return Effect.sync(() => {
    let s = raw.trim()

    // 1. Strip markdown fences
    s = s.replace(/^```(?:json|JSON)?\s*\n?/, "").replace(/\n?\s*```\s*$/, "")

    // 2. Find outermost bracket pair
    const firstBrace = s.indexOf("{")
    const firstBracket = s.indexOf("[")
    let startChar: "{" | "["
    let endChar: "}" | "]"
    let startIdx: number

    if (firstBrace === -1 && firstBracket === -1) {
      throw new NormalizeError({
        stage: "extract",
        message: "No JSON object or array found in response",
        raw: raw.slice(0, 200),
      })
    }

    if (firstBracket === -1 || (firstBrace !== -1 && firstBrace < firstBracket)) {
      startChar = "{"
      endChar = "}"
      startIdx = firstBrace
    } else {
      startChar = "["
      endChar = "]"
      startIdx = firstBracket
    }

    // Find matching closing bracket (respecting nesting + strings)
    let depth = 0
    let inString = false
    let escape = false
    let endIdx = -1

    for (let i = startIdx; i < s.length; i++) {
      const ch = s[i]
      if (escape) { escape = false; continue }
      if (ch === "\\") { escape = true; continue }
      if (ch === '"') { inString = !inString; continue }
      if (inString) continue
      if (ch === startChar) depth++
      if (ch === endChar) { depth--; if (depth === 0) { endIdx = i; break } }
    }

    if (endIdx === -1) {
      throw new NormalizeError({
        stage: "extract",
        message: `Unmatched ${startChar} — no closing ${endChar} found`,
        raw: raw.slice(0, 200),
      })
    }

    s = s.slice(startIdx, endIdx + 1)

    // 3. Remove trailing commas before } or ]
    s = s.replace(/,\s*([}\]])/g, "$1")

    // 4. Strip single-line comments (outside strings)
    s = s.replace(/\/\/[^\n]*/g, "")

    return s
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
        }
        // Skip non-object children (malformed)
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
