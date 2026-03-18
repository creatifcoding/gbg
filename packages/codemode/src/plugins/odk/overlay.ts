/**
 * @module odk/overlay
 *
 * ODK as a CodemodeOverlay — the meta-overlay.
 * Exercises facets: id, name, version, methods, guide, steer, lifecycle, dispose.
 */

import type { CodemodeOverlay } from "../../overlay.js"
import type { CodemodeCore } from "../../types.js"
import type { TemplateName } from "./types.js"
import { validate, CONTRACT_RULES } from "./contract.js"
import { conformance } from "./conformance.js"
import { inspect, inventoryFacets, compare } from "./inspect.js"
import { scaffold, buildManifest, testHarness } from "./scaffold.js"
import { listTemplates, getTemplate } from "./templates.js"

/**
 * Create the ODK overlay.
 * Accepts an optional reference to the overlay manager for catalog().
 */
export function odk(getOverlays?: () => ReadonlyArray<CodemodeOverlay>): CodemodeOverlay {
  return {
    id: "odk",
    name: "Overlay Development Kit",
    version: "1.0.0",

    methods: {
      /**
       * All ODK methods under a single `odk` namespace object.
       * Agent calls: cm.odk.validate(overlay), cm.odk.scaffold({...}), etc.
       * Single key avoids collision with domain overlays.
       */
      odk: Object.assign(function odk() { return "ODK — Overlay Development Kit" }, {
        // ── Validate (2) ──────────────────────────────────
        validate: function validate_(overlay: unknown) { return validate(overlay) },
        rules: function rules() {
          return CONTRACT_RULES.map(r => ({
            id: r.id, category: r.category, severity: r.severity, description: r.description,
          }))
        },

        // ── Inspect (2) ───────────────────────────────────
        inspect: function inspect_(overlay: unknown) { return inspect(overlay) },
        conformance: function conformance_(overlay: unknown) { return conformance(overlay) },

        // ── Scaffold (3) ──────────────────────────────────
        scaffold: function scaffold_(
          name: string,
          opts?: { template?: TemplateName; id?: string; version?: string },
        ) {
          return scaffold({
            name,
            template: opts?.template ?? "minimal",
            id: opts?.id,
            version: opts?.version,
          })
        },
        buildManifest: function buildManifest_(
          overlayName: string,
          overlayId: string,
          methods: Array<{ name: string; arity: number; description?: string }>,
        ) {
          return buildManifest(overlayName, overlayId, methods)
        },
        testHarness: function testHarness_(
          overlayId: string,
          overlayName: string,
          template: TemplateName,
          methods: Array<{ name: string; arity: number }>,
        ) {
          return testHarness(overlayId, overlayName, template, methods)
        },

        // ── Catalog (2) ───────────────────────────────────
        catalog: function catalog() {
          const overlays = getOverlays?.() ?? []
          return overlays.map(o => {
            const facets = inventoryFacets(o)
            const conf = conformance(o)
            return {
              id: o.id,
              name: o.name,
              version: o.version,
              methodCount: Object.keys(o.methods).length,
              facetCount: facets.populated,
              conformanceLevel: conf.level,
              conformanceLabel: conf.label,
            }
          })
        },
        compare: function compare_(a: unknown, b: unknown) { return compare(a, b) },

        // ── Templates (2) ─────────────────────────────────
        templates: function templates() { return listTemplates() },
        template: function template(name: TemplateName) { return getTemplate(name) },

        // ── Package (1) ───────────────────────────────────
        packageCheck: async function packageCheck(overlayOrPath: unknown) {
          // Accept either a live overlay object or a module path
          if (typeof overlayOrPath === "object" && overlayOrPath !== null && "id" in overlayOrPath) {
            // Live overlay — validate directly
            const v = validate(overlayOrPath)
            const c = conformance(overlayOrPath)
            return {
              loads: true,
              validation: v,
              conformance: c,
              missingDeps: [] as string[],
              exportable: true,
              pass: v.valid,
            }
          }
          // Path string — attempt dynamic import
          const path = String(overlayOrPath)
          try {
            const mod = await import(path)
            const overlay = mod.default ?? mod
            if (!overlay || typeof overlay !== "object" || !("id" in overlay)) {
              return {
                loads: false,
                missingDeps: [] as string[],
                exportable: false,
                pass: false,
              }
            }
            const v = validate(overlay)
            const c = conformance(overlay)
            return {
              loads: true,
              validation: v,
              conformance: c,
              missingDeps: [] as string[],
              exportable: true,
              pass: v.valid,
            }
          } catch (err: any) {
            return {
              loads: false,
              missingDeps: err.code === "ERR_MODULE_NOT_FOUND" ? [path] : [],
              exportable: false,
              pass: false,
            }
          }
        },
      }),
    },

    guide: {
      sections: [{
        id: "odk-ops",
        slot: "api" as const,
        priority: 25,
        content: [
          "### ODK (Overlay Development Kit)",
          "  cm.odk.validate(overlay)      → ValidationReport (19 contract rules)",
          "  cm.odk.rules()                → ContractRule[] (all 19 rules)",
          "  cm.odk.inspect(overlay)        → InspectionReport (full health)",
          "  cm.odk.conformance(overlay)    → ConformanceResult (level -1 to 3)",
          "  cm.odk.scaffold(name, opts?)   → CodemodeOverlay (in-memory skeleton)",
          "  cm.odk.buildManifest(name, id, methods) → SectionConfig",
          "  cm.odk.testHarness(id, name, template, methods) → string (test code)",
          "  cm.odk.catalog()               → CatalogEntry[] (all loaded overlays)",
          "  cm.odk.compare(a, b)           → ComparisonReport (method/facet delta)",
          "  cm.odk.templates()             → TemplateConfig[] (available templates)",
          "  cm.odk.template(name)          → TemplateConfig detail",
          "",
          "  Templates: minimal, governance, workflow, full",
          "  Conformance: -1 missing → 0 exists → 1 valid → 2 covered → 3 complete",
        ].join("\n"),
      }],
    },

    steer: {
      fragments: [{
        id: "odk-guidance",
        content: [
          "ODK is loaded. Use cm.odk.* to validate, inspect, and scaffold overlays.",
          "Run cm.odk.catalog() to see loaded overlays.",
          "Run cm.odk.validate(overlay) to check any overlay against 19 contract rules.",
          "Run cm.odk.scaffold('name', {template:'minimal'}) to create a new overlay skeleton.",
        ].join(" "),
        priority: 60,
      }],
    },

    lifecycle: {
      onLoad: async (_core: CodemodeCore) => {
        // ODK could register seed procedures here in the future
      },
    },

    dispose: () => {
      // ODK is stateless — nothing to clean up
    },
  }
}
