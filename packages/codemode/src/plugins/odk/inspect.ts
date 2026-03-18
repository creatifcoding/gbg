/**
 * @module odk/inspect
 *
 * Overlay inspection — facet inventory, method introspection, full health report.
 * All inspection uses runtime introspection of live objects.
 */

import { validate } from "./contract.js"
import { conformance } from "./conformance.js"
import type {
  FacetInventory,
  MethodIntrospection,
  InspectionReport,
  ComparisonReport,
} from "./types.js"

// ── Facet Inventory ──────────────────────────────────────────────

/**
 * Inventory which of the 13 overlay facets are populated.
 */
export function inventoryFacets(overlay: unknown): FacetInventory {
  const o = overlay as Record<string, any> | null

  const checks = {
    id: typeof o?.id === "string" && o.id.length > 0,
    name: typeof o?.name === "string" && o.name.length > 0,
    version: typeof o?.version === "string" && o.version.length > 0,
    methods: o?.methods != null && typeof o.methods === "object" && Object.keys(o.methods).length > 0,
    guide: Array.isArray(o?.guide?.sections) && o.guide.sections.length > 0,
    steer: Array.isArray(o?.steer?.fragments) && o.steer.fragments.length > 0,
    profiles: Array.isArray(o?.profiles?.autoLoad) && o.profiles.autoLoad.length > 0,
    procedures: Array.isArray(o?.procedures) && o.procedures.length > 0,
    context: o?.context?.fields != null && typeof o.context.fields === "object" && Object.keys(o.context.fields).length > 0,
    rendering: o?.rendering?.renderers != null && typeof o.rendering.renderers === "object" && Object.keys(o.rendering.renderers).length > 0,
    errors: o?.errors?.formatters != null && typeof o.errors.formatters === "object" && Object.keys(o.errors.formatters).length > 0,
    lifecycle: !!(o?.lifecycle?.onLoad || o?.lifecycle?.onUnload || o?.lifecycle?.onEval || o?.lifecycle?.onResult || o?.lifecycle?.onTurn),
    dispose: typeof o?.dispose === "function",
  }

  const populated = Object.values(checks).filter(Boolean).length

  return { ...checks, populated, total: Object.keys(checks).length }
}

// ── Method Introspection ─────────────────────────────────────────

/**
 * Introspect all methods on a live overlay — typeof, .name, .length.
 */
export function introspectMethods(overlay: unknown): ReadonlyArray<MethodIntrospection> {
  const o = overlay as Record<string, any> | null
  if (!o?.methods || typeof o.methods !== "object") return []

  return Object.entries(o.methods).map(([key, fn]) => ({
    key,
    type: typeof fn,
    name: typeof fn === "function" ? fn.name : "",
    arity: typeof fn === "function" ? fn.length : -1,
    nameMatchesKey: typeof fn === "function" && (fn.name === key || fn.name.includes(key)),
  }))
}

// ── Full Inspection ──────────────────────────────────────────────

/**
 * Full health report — contract + conformance + facets + methods.
 */
export function inspect(overlay: unknown): InspectionReport {
  const o = overlay as Record<string, any> | null

  const contract = validate(overlay)
  const conf = conformance(overlay)
  const facets = inventoryFacets(overlay)
  const methods = introspectMethods(overlay)

  const guideSections: InspectionReport["guideSections"] =
    Array.isArray(o?.guide?.sections)
      ? o.guide.sections.map((s: any) => ({
          id: String(s?.id ?? ""),
          slot: String(s?.slot ?? ""),
          priority: typeof s?.priority === "number" ? s.priority : -1,
        }))
      : []

  return {
    id: String(o?.id ?? ""),
    name: String(o?.name ?? ""),
    version: typeof o?.version === "string" ? o.version : undefined,
    contract,
    conformance: conf,
    facets,
    methods,
    guideSections,
  }
}

// ── Comparison ───────────────────────────────────────────────────

/**
 * Compare two overlays — method delta, facet delta, collision detection.
 */
export function compare(a: unknown, b: unknown): ComparisonReport {
  const oa = a as Record<string, any> | null
  const ob = b as Record<string, any> | null

  const keysA = new Set(Object.keys(oa?.methods ?? {}))
  const keysB = new Set(Object.keys(ob?.methods ?? {}))

  const onlyInA = [...keysA].filter(k => !keysB.has(k))
  const onlyInB = [...keysB].filter(k => !keysA.has(k))
  const shared = [...keysA].filter(k => keysB.has(k))

  const facetsA = inventoryFacets(a)
  const facetsB = inventoryFacets(b)

  const facetKeys = ["methods", "guide", "steer", "profiles", "procedures", "context", "rendering", "errors", "lifecycle", "dispose", "version"] as const
  const facetOnlyA = facetKeys.filter(k => (facetsA as any)[k] && !(facetsB as any)[k])
  const facetOnlyB = facetKeys.filter(k => (facetsB as any)[k] && !(facetsA as any)[k])

  const total = keysA.size + keysB.size
  const collisionRatio = total > 0 ? shared.length / total : 0
  const collisionRisk =
    collisionRatio === 0 ? "none" :
    collisionRatio < 0.1 ? "low" :
    collisionRatio < 0.3 ? "medium" : "high"

  return {
    onlyInA,
    onlyInB,
    shared,
    facetDelta: { onlyInA: facetOnlyA, onlyInB: facetOnlyB },
    collisionRisk,
  }
}
