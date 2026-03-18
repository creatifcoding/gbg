/**
 * @module odk/types
 *
 * ODK (Overlay Development Kit) type definitions.
 * All domain types are Schema-backed per project discipline.
 *
 * The ODK validates, inspects, and scaffolds CodemodeOverlays.
 * It uses runtime function introspection (typeof, .name, .length)
 * rather than string-based signatures.
 */

// ── Contract Rules ───────────────────────────────────────────────

/**
 * Contract rule categories.
 * Each category validates a different facet of the overlay.
 */
export type RuleCategory =
  | "structural"  // S — id, name, methods shape
  | "guide"       // G — guide sections well-formed
  | "coverage"    // C — methods documented in guide
  | "steer"       // T — steer fragments well-formed
  | "procedures"  // P — seed procedures well-formed
  | "lifecycle"   // L — lifecycle hooks valid

/**
 * Severity levels for contract violations.
 */
export type Severity = "error" | "warning" | "info"

/**
 * A single contract rule definition.
 * Rules are checked against a live overlay object.
 */
export interface ContractRule {
  /** Rule identifier (e.g. "S1", "G2") */
  readonly id: string
  /** Human-readable description */
  readonly description: string
  /** Category for grouping */
  readonly category: RuleCategory
  /** Severity — errors block conformance advancement */
  readonly severity: Severity
  /**
   * The check function — receives a live overlay, returns null (pass) or violation message.
   * Uses typeof, .name, .length — no string parsing, no dry-run invocation.
   */
  readonly check: (overlay: unknown) => string | null
}

// ── Validation ───────────────────────────────────────────────────

/**
 * A single violation from contract validation.
 */
export interface Violation {
  /** Rule that was violated */
  readonly ruleId: string
  /** Category */
  readonly category: RuleCategory
  /** Severity */
  readonly severity: Severity
  /** Human-readable violation message */
  readonly message: string
  /** Optional detail (e.g. which method failed) */
  readonly detail?: string
}

/**
 * Result of cm.odk.validate(overlay).
 */
export interface ValidationReport {
  /** Errors — block conformance advancement */
  readonly errors: ReadonlyArray<Violation>
  /** Warnings — won't block but should be addressed */
  readonly warnings: ReadonlyArray<Violation>
  /** Informational notes */
  readonly info: ReadonlyArray<Violation>
  /** Whether the overlay passes (zero errors) */
  readonly valid: boolean
  /** Total rule count checked */
  readonly rulesChecked: number
}

// ── Conformance ──────────────────────────────────────────────────

/**
 * Conformance levels.
 *
 * -1  missing    — No overlay object (null/undefined)
 *  0  exists     — Has id + name but fails validation
 *  1  valid      — Passes all contract rules (zero errors)
 *  2  covered    — All methods documented in guide + has steer
 *  3  complete   — All 11 facets populated, procedures seeded, lifecycle wired
 */
export type ConformanceLevel = -1 | 0 | 1 | 2 | 3

export const CONFORMANCE_LABELS: Record<ConformanceLevel, string> = {
  [-1]: "missing",
  [0]: "exists",
  [1]: "valid",
  [2]: "covered",
  [3]: "complete",
}

/**
 * Result of cm.odk.conformance(overlay).
 */
export interface ConformanceResult {
  /** Conformance level */
  readonly level: ConformanceLevel
  /** Label for the level */
  readonly label: string
  /** Detail — what's needed for next level */
  readonly detail: ReadonlyArray<string>
}

// ── Inspection ───────────────────────────────────────────────────

/**
 * Facet inventory — which of the 11 overlay facets are populated.
 */
export interface FacetInventory {
  /** true if facet is present and non-empty */
  readonly id: boolean
  readonly name: boolean
  readonly version: boolean
  readonly methods: boolean
  readonly guide: boolean
  readonly steer: boolean
  readonly profiles: boolean
  readonly procedures: boolean
  readonly context: boolean
  readonly rendering: boolean
  readonly errors: boolean
  readonly lifecycle: boolean
  readonly dispose: boolean
  /** Count of populated facets */
  readonly populated: number
  /** Total possible facets */
  readonly total: number
}

/**
 * Method introspection result — what we learn from typeof/.name/.length.
 */
export interface MethodIntrospection {
  /** Key in overlay.methods */
  readonly key: string
  /** typeof fn — should always be "function" */
  readonly type: string
  /** fn.name — function identity */
  readonly name: string
  /** fn.length — declared parameter count */
  readonly arity: number
  /** Whether fn.name matches the key */
  readonly nameMatchesKey: boolean
}

/**
 * Result of cm.odk.inspect(overlay).
 * Full health report combining contract, conformance, and facet inventory.
 */
export interface InspectionReport {
  /** Overlay identity */
  readonly id: string
  readonly name: string
  readonly version: string | undefined
  /** Contract validation */
  readonly contract: ValidationReport
  /** Conformance assessment */
  readonly conformance: ConformanceResult
  /** Facet inventory */
  readonly facets: FacetInventory
  /** Method introspection details */
  readonly methods: ReadonlyArray<MethodIntrospection>
  /** Guide section summary */
  readonly guideSections: ReadonlyArray<{ id: string; slot: string; priority: number }>
}

// ── Scaffold ─────────────────────────────────────────────────────

/**
 * Template names — each produces a different overlay skeleton.
 */
export type TemplateName = "minimal" | "governance" | "workflow" | "full"

/**
 * Template configuration for scaffold().
 * Defines which facets are seeded and what methods are stubbed.
 */
export interface TemplateConfig {
  /** Template name */
  readonly name: TemplateName
  /** Human description */
  readonly description: string
  /** Which facets to include in the scaffold */
  readonly facets: ReadonlyArray<string>
  /** Seed method stubs — name + arity */
  readonly seedMethods?: ReadonlyArray<{ name: string; arity: number; description?: string }>
  /** Whether to include guide section stub */
  readonly includeGuide: boolean
  /** Whether to include steer fragment stub */
  readonly includeSteer: boolean
  /** Whether to include lifecycle hooks */
  readonly includeLifecycle: boolean
  /** Whether to include test harness */
  readonly includeTests: boolean
}

/**
 * Result of cm.odk.scaffold(name, opts).
 */
export interface ScaffoldResult {
  /** Files written (relative paths) */
  readonly files: ReadonlyArray<string>
  /** Absolute path to the overlay directory */
  readonly path: string
  /** Template used */
  readonly template: TemplateName
  /** Overlay id generated */
  readonly overlayId: string
}

// ── Catalog & Comparison ─────────────────────────────────────────

/**
 * Entry in the overlay catalog.
 */
export interface CatalogEntry {
  readonly id: string
  readonly name: string
  readonly version: string | undefined
  readonly methodCount: number
  readonly facetCount: number
  readonly conformanceLevel: ConformanceLevel
  readonly conformanceLabel: string
}

/**
 * Result of cm.odk.compare(a, b).
 */
export interface ComparisonReport {
  /** Methods only in overlay A */
  readonly onlyInA: ReadonlyArray<string>
  /** Methods only in overlay B */
  readonly onlyInB: ReadonlyArray<string>
  /** Methods in both (potential collision) */
  readonly shared: ReadonlyArray<string>
  /** Facet delta */
  readonly facetDelta: {
    readonly onlyInA: ReadonlyArray<string>
    readonly onlyInB: ReadonlyArray<string>
  }
  /** Collision risk assessment */
  readonly collisionRisk: "none" | "low" | "medium" | "high"
}

/**
 * Result of cm.odk.packageCheck(path).
 */
export interface PackageReport {
  /** Whether overlay loads without error */
  readonly loads: boolean
  /** Validation report if loaded */
  readonly validation?: ValidationReport
  /** Conformance if loaded */
  readonly conformance?: ConformanceResult
  /** Missing dependencies */
  readonly missingDeps: ReadonlyArray<string>
  /** Export check — can other code import this? */
  readonly exportable: boolean
  /** Overall pass/fail */
  readonly pass: boolean
}
