/**
 * @module odk/conformance
 *
 * Conformance levels for CodemodeOverlay.
 * Levels represent progressive quality gates:
 *
 *   -1  missing   — No overlay object
 *    0  exists    — Has id + name but fails validation
 *    1  valid     — Passes all contract rules (zero errors)
 *    2  covered   — Methods documented in guide + has steer
 *    3  complete  — All facets populated, procedures seeded, lifecycle wired
 */

import { validate } from "./contract.js"
import { inventoryFacets } from "./inspect.js"
import type { ConformanceLevel, ConformanceResult, CONFORMANCE_LABELS } from "./types.js"

const LABELS: Record<number, string> = {
  [-1]: "missing",
  [0]: "exists",
  [1]: "valid",
  [2]: "covered",
  [3]: "complete",
}

/**
 * Calculate conformance level for a live overlay object.
 */
export function conformance(overlay: unknown): ConformanceResult {
  // ── Level -1: missing ──
  if (overlay == null || typeof overlay !== "object") {
    return { level: -1, label: LABELS[-1], detail: ["Overlay is null/undefined — provide a CodemodeOverlay object"] }
  }

  const o = overlay as Record<string, any>

  // ── Level 0 check: does it exist with basic identity? ──
  const hasId = typeof o.id === "string" && o.id.length > 0
  const hasName = typeof o.name === "string" && o.name.length > 0
  const hasMethods = o.methods != null && typeof o.methods === "object" && Object.keys(o.methods).length > 0

  if (!hasId || !hasName || !hasMethods) {
    const missing: string[] = []
    if (!hasId) missing.push("id")
    if (!hasName) missing.push("name")
    if (!hasMethods) missing.push("methods (non-empty)")
    return { level: -1, label: LABELS[-1], detail: [`Missing required: ${missing.join(", ")}`] }
  }

  // ── Level 1 check: passes validation? ──
  const report = validate(overlay)
  if (!report.valid) {
    const detail = report.errors.map(e => `${e.ruleId}: ${e.detail ?? e.message}`)
    detail.push(`→ Fix ${report.errors.length} error(s) to reach level 1 (valid)`)
    return { level: 0, label: LABELS[0], detail }
  }

  // ── Level 2 check: methods covered in guide + has steer? ──
  const hasGuide = Array.isArray(o.guide?.sections) && o.guide.sections.length > 0
  const hasSteer = Array.isArray(o.steer?.fragments) && o.steer.fragments.length > 0

  if (!hasGuide || !hasSteer) {
    const detail: string[] = []
    if (!hasGuide) detail.push("Add guide.sections to document methods")
    if (!hasSteer) detail.push("Add steer.fragments for prompt-level guidance")
    detail.push("→ Add guide + steer to reach level 2 (covered)")
    return { level: 1, label: LABELS[1], detail }
  }

  // ── Level 3 check: all facets populated ──
  const facets = inventoryFacets(overlay)
  const LEVEL_3_REQUIRED = ["id", "name", "methods", "guide", "steer", "lifecycle", "dispose"]
  const missingFacets = LEVEL_3_REQUIRED.filter(f => !(facets as any)[f])

  if (missingFacets.length > 0) {
    return {
      level: 2,
      label: LABELS[2],
      detail: [
        `Missing facets for level 3: ${missingFacets.join(", ")}`,
        `→ Populate ${missingFacets.join(", ")} to reach level 3 (complete)`,
      ],
    }
  }

  // ── Level 3: complete ──
  return { level: 3, label: LABELS[3], detail: ["All contract rules pass, all required facets populated"] }
}
