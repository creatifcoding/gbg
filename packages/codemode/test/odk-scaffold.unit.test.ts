/**
 * ODK Scaffold + Templates — unit tests.
 *
 * §1  Templates — list, get, shape
 * §2  scaffold() — overlay generation from templates
 * §3  Contract compliance — scaffolded overlays pass validation
 * §4  Conformance — scaffolded overlays reach expected levels
 * §5  buildManifest — guide section generation
 * §6  testHarness — test code generation
 * §7  Method stubs — correct .name, .length, throw behavior
 * §8  Custom options — id, version, methods, guideSlot overrides
 * §9  packageCheck — pre-publish validation
 * §10 ODK overlay — the meta-overlay itself
 */

import { describe, it, expect } from "vitest"
import {
  scaffold,
  buildManifest,
  testHarness,
  type ScaffoldOptions,
} from "../src/plugins/odk/scaffold"
import { listTemplates, getTemplate, TEMPLATES } from "../src/plugins/odk/templates"
import { validate } from "../src/plugins/odk/contract"
import { conformance } from "../src/plugins/odk/conformance"
import { inspect, inventoryFacets } from "../src/plugins/odk/inspect"
import { odk } from "../src/plugins/odk/overlay"
import type { TemplateName, TemplateConfig } from "../src/plugins/odk/types"

// ── §1 Templates ─────────────────────────────────────────────────

describe("§1 Templates", () => {
  it("lists all 4 templates", () => {
    const templates = listTemplates()
    expect(templates).toHaveLength(4)
    expect(templates.map(t => t.name).sort()).toEqual(["full", "governance", "minimal", "workflow"])
  })

  it("getTemplate returns correct config", () => {
    const minimal = getTemplate("minimal")
    expect(minimal.name).toBe("minimal")
    expect(minimal.facets).toContain("methods")
    expect(minimal.facets).toContain("guide")
    expect(minimal.includeGuide).toBe(true)
    expect(minimal.includeSteer).toBe(false)
  })

  it("each template has seedMethods", () => {
    for (const tpl of listTemplates()) {
      if (tpl.name !== "minimal") {
        expect(tpl.seedMethods!.length).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it("governance template has discover/inspect/audit/conformance", () => {
    const gov = getTemplate("governance")
    const names = gov.seedMethods!.map(m => m.name)
    expect(names).toContain("discover")
    expect(names).toContain("inspect")
    expect(names).toContain("audit")
    expect(names).toContain("conformance")
  })

  it("workflow template has start/status/step/rollback/complete", () => {
    const wf = getTemplate("workflow")
    const names = wf.seedMethods!.map(m => m.name)
    expect(names).toEqual(["start", "status", "step", "rollback", "complete"])
  })

  it("full template covers all 11 facets", () => {
    const full = getTemplate("full")
    expect(full.facets.length).toBe(11)
  })

  it("TEMPLATES object is frozen-ish (no mutation footguns)", () => {
    // Ensure each template name matches its key
    for (const [key, tpl] of Object.entries(TEMPLATES)) {
      expect(tpl.name).toBe(key)
    }
  })
})

// ── §2 scaffold() — overlay generation ───────────────────────────

describe("§2 scaffold()", () => {
  const templateNames: TemplateName[] = ["minimal", "governance", "workflow", "full"]

  it.each(templateNames)("scaffold(%s) returns a CodemodeOverlay", (tpl) => {
    const overlay = scaffold({ name: "Test Overlay", template: tpl })
    expect(overlay.id).toBe("test-overlay")
    expect(overlay.name).toBe("Test Overlay")
    expect(overlay.version).toBe("0.1.0")
    expect(typeof overlay.methods).toBe("object")
  })

  it("kebab-cases the name for id", () => {
    expect(scaffold({ name: "My Cool Plugin", template: "minimal" }).id).toBe("my-cool-plugin")
    expect(scaffold({ name: "camelCase", template: "minimal" }).id).toBe("camel-case")
    expect(scaffold({ name: "PascalCase", template: "minimal" }).id).toBe("pascal-case")
    expect(scaffold({ name: "already-kebab", template: "minimal" }).id).toBe("already-kebab")
  })

  it("minimal template produces methods + guide", () => {
    const overlay = scaffold({ name: "Tiny", template: "minimal" })
    expect(Object.keys(overlay.methods).length).toBeGreaterThanOrEqual(1)
    expect(overlay.guide).toBeDefined()
    expect(overlay.guide!.sections.length).toBeGreaterThanOrEqual(1)
    expect(overlay.steer).toBeUndefined()
    expect((overlay as any).lifecycle).toBeUndefined()
  })

  it("governance template produces methods + guide + steer + lifecycle", () => {
    const overlay = scaffold({ name: "Gov", template: "governance" })
    expect(overlay.guide).toBeDefined()
    expect(overlay.steer).toBeDefined()
    expect((overlay as any).lifecycle).toBeDefined()
    expect((overlay as any).lifecycle.onLoad).toBeDefined()
    // governance methods
    expect(overlay.methods.discover).toBeDefined()
    expect(overlay.methods.inspect).toBeDefined()
    expect(overlay.methods.audit).toBeDefined()
  })

  it("full template populates most facets", () => {
    const overlay = scaffold({ name: "Full", template: "full" })
    const facets = inventoryFacets(overlay)
    // Full should have: id, name, version, methods, guide, steer, lifecycle, dispose
    expect(facets.id).toBe(true)
    expect(facets.name).toBe(true)
    expect(facets.version).toBe(true)
    expect(facets.methods).toBe(true)
    expect(facets.guide).toBe(true)
    expect(facets.steer).toBe(true)
    expect(facets.lifecycle).toBe(true)
    expect(facets.dispose).toBe(true)
  })
})

// ── §3 Contract compliance ───────────────────────────────────────

describe("§3 Contract compliance", () => {
  it.each(["minimal", "governance", "workflow", "full"] as TemplateName[])(
    "scaffold(%s) passes contract validation",
    (tpl) => {
      const overlay = scaffold({ name: "Compliant", template: tpl })
      const report = validate(overlay)
      expect(report.valid).toBe(true)
      expect(report.errors).toHaveLength(0)
    }
  )
})

// ── §4 Conformance ───────────────────────────────────────────────

describe("§4 Conformance", () => {
  it("minimal reaches level >= 1 (valid)", () => {
    const overlay = scaffold({ name: "Min", template: "minimal" })
    const result = conformance(overlay)
    expect(result.level).toBeGreaterThanOrEqual(1)
  })

  it("governance reaches level >= 1 (valid)", () => {
    const overlay = scaffold({ name: "Gov", template: "governance" })
    const result = conformance(overlay)
    expect(result.level).toBeGreaterThanOrEqual(1)
  })

  it("full reaches level >= 2 (covered — has guide + steer)", () => {
    const overlay = scaffold({ name: "Full", template: "full" })
    const result = conformance(overlay)
    expect(result.level).toBeGreaterThanOrEqual(2)
  })
})

// ── §5 buildManifest ─────────────────────────────────────────────

describe("§5 buildManifest", () => {
  it("generates a valid SectionConfig", () => {
    const section = buildManifest("Schema Gov", "schema-gov", [
      { name: "discover", arity: 0, description: "List schemas" },
      { name: "validate", arity: 1, description: "Validate a schema" },
    ])
    expect(section.id).toBe("schema-gov-ops")
    expect(section.slot).toBe("api")
    expect(section.priority).toBe(50)
    expect(section.content).toContain("Schema Gov")
    expect(section.content).toContain("cm.discover()")
    expect(section.content).toContain("cm.validate(name)")
  })

  it("supports custom slot and priority", () => {
    const section = buildManifest("Test", "test", [], "patterns", 99)
    expect(section.slot).toBe("patterns")
    expect(section.priority).toBe(99)
  })
})

// ── §6 testHarness ───────────────────────────────────────────────

describe("§6 testHarness", () => {
  it("generates valid TypeScript test code", () => {
    const code = testHarness("my-overlay", "My Overlay", "minimal", [
      { name: "hello", arity: 0 },
    ])
    expect(code).toContain('import { describe, it, expect } from "vitest"')
    expect(code).toContain("validate")
    expect(code).toContain("conformance")
    expect(code).toContain("inspect")
    expect(code).toContain("my-overlay")
    expect(code).toContain("My Overlay")
    expect(code).toContain("hello")
  })

  it("includes facet assertions for governance", () => {
    const code = testHarness("gov", "Gov", "governance", [
      { name: "discover", arity: 0 },
    ])
    expect(code).toContain("facets.guide")
    expect(code).toContain("facets.steer")
    expect(code).toContain("facets.lifecycle")
  })

  it("method assertions check .name, .length", () => {
    const code = testHarness("test", "Test", "minimal", [
      { name: "greet", arity: 2 },
    ])
    expect(code).toContain('expect(overlay.methods.greet.name).toBe("greet")')
    expect(code).toContain("expect(overlay.methods.greet.length).toBe(2)")
  })
})

// ── §7 Method stubs ──────────────────────────────────────────────

describe("§7 Method stubs", () => {
  it("stubs have correct .name", () => {
    const overlay = scaffold({ name: "Stubs", template: "governance" })
    expect(overlay.methods.discover.name).toBe("discover")
    expect(overlay.methods.inspect.name).toBe("inspect")
    expect(overlay.methods.audit.name).toBe("audit")
    expect(overlay.methods.conformance.name).toBe("conformance")
  })

  it("stubs have correct .length (arity)", () => {
    const overlay = scaffold({ name: "Stubs", template: "governance" })
    expect(overlay.methods.discover.length).toBe(0)
    expect(overlay.methods.inspect.length).toBe(1)
    expect(overlay.methods.audit.length).toBe(0)
    expect(overlay.methods.conformance.length).toBe(1)
  })

  it("stubs throw 'not implemented' when called", () => {
    const overlay = scaffold({ name: "Stubs", template: "minimal" })
    const fn = overlay.methods.hello
    expect(() => fn()).toThrow("not implemented")
  })

  it("stubs include description in error message", () => {
    const overlay = scaffold({
      name: "Custom",
      template: "minimal",
      methods: [{ name: "doStuff", arity: 1, description: "does stuff" }],
    })
    expect(() => overlay.methods.doStuff("x")).toThrow("does stuff")
  })
})

// ── §8 Custom options ────────────────────────────────────────────

describe("§8 Custom options", () => {
  it("custom id overrides kebab conversion", () => {
    const overlay = scaffold({ name: "Foo Bar", template: "minimal", id: "custom-id" })
    expect(overlay.id).toBe("custom-id")
  })

  it("custom version", () => {
    const overlay = scaffold({ name: "V", template: "minimal", version: "2.0.0" })
    expect(overlay.version).toBe("2.0.0")
  })

  it("custom methods override template defaults", () => {
    const overlay = scaffold({
      name: "Custom",
      template: "governance",
      methods: [
        { name: "scan", arity: 0 },
        { name: "fix", arity: 1 },
      ],
    })
    // Should have scan + fix, NOT discover/inspect/audit/conformance
    expect(overlay.methods.scan).toBeDefined()
    expect(overlay.methods.fix).toBeDefined()
    expect(overlay.methods.discover).toBeUndefined()
    expect(overlay.methods.inspect).toBeUndefined()
  })

  it("custom guideSlot", () => {
    const overlay = scaffold({
      name: "Patterns",
      template: "minimal",
      guideSlot: "patterns",
    })
    expect(overlay.guide!.sections[0].slot).toBe("patterns")
  })

  it("custom guidePriority", () => {
    const overlay = scaffold({
      name: "Priority",
      template: "minimal",
      guidePriority: 99,
    })
    expect(overlay.guide!.sections[0].priority).toBe(99)
  })
})

// ── §9 packageCheck ──────────────────────────────────────────

describe("§9 packageCheck", () => {
  const odkOverlay = odk()
  const ns = odkOverlay.methods.odk as any

  it("validates a live overlay object", async () => {
    const overlay = scaffold({ name: "Pkg Test", template: "minimal" })
    const report = await ns.packageCheck(overlay)
    expect(report.loads).toBe(true)
    expect(report.pass).toBe(true)
    expect(report.validation.valid).toBe(true)
    expect(report.exportable).toBe(true)
  })

  it("fails on invalid overlay object", async () => {
    const bad = { id: "bad" } // missing name, methods
    const report = await ns.packageCheck(bad)
    expect(report.loads).toBe(true)
    expect(report.pass).toBe(false)
  })

  it("fails on non-existent module path", async () => {
    const report = await ns.packageCheck("/tmp/does-not-exist-overlay-xyz.js")
    expect(report.loads).toBe(false)
    expect(report.pass).toBe(false)
  })
})

// ── §10 ODK overlay ──────────────────────────────────────────────

describe("§10 ODK overlay", () => {
  const odkOverlay = odk()

  it("has correct identity", () => {
    expect(odkOverlay.id).toBe("odk")
    expect(odkOverlay.name).toBe("Overlay Development Kit")
    expect(odkOverlay.version).toBe("1.0.0")
  })

  it("exposes odk namespace method", () => {
    expect(typeof odkOverlay.methods.odk).toBe("function")
    // Calling it returns description
    expect(odkOverlay.methods.odk()).toContain("ODK")
  })

  it("odk namespace has all sub-methods", () => {
    const ns = odkOverlay.methods.odk as any
    const expectedMethods = [
      "validate", "rules", "inspect", "conformance",
      "scaffold", "buildManifest", "testHarness",
      "catalog", "compare",
      "templates", "template",
      "packageCheck",
    ]
    for (const m of expectedMethods) {
      expect(typeof ns[m]).toBe("function")
    }
  })

  it("odk.scaffold returns a CodemodeOverlay", () => {
    const ns = odkOverlay.methods.odk as any
    const overlay = ns.scaffold("Test")
    expect(overlay.id).toBe("test")
    expect(overlay.name).toBe("Test")
    expect(overlay.methods).toBeDefined()
  })

  it("odk.validate works on a scaffolded overlay", () => {
    const ns = odkOverlay.methods.odk as any
    const overlay = ns.scaffold("Check", { template: "governance" })
    const report = ns.validate(overlay)
    expect(report.valid).toBe(true)
  })

  it("odk.templates lists all", () => {
    const ns = odkOverlay.methods.odk as any
    const templates = ns.templates()
    expect(templates).toHaveLength(4)
  })

  it("odk.catalog returns empty when no overlays registered", () => {
    const ns = odkOverlay.methods.odk as any
    expect(ns.catalog()).toEqual([])
  })

  it("odk.catalog returns entries when overlays provided", () => {
    const withOverlays = odk(() => [odkOverlay])
    const ns = withOverlays.methods.odk as any
    const catalog = ns.catalog()
    expect(catalog).toHaveLength(1)
    expect(catalog[0].id).toBe("odk")
    expect(catalog[0].conformanceLevel).toBeGreaterThanOrEqual(1)
  })

  it("passes its own contract validation", () => {
    const report = validate(odkOverlay)
    expect(report.valid).toBe(true)
  })

  it("has guide sections", () => {
    expect(odkOverlay.guide).toBeDefined()
    expect(odkOverlay.guide!.sections.length).toBeGreaterThanOrEqual(1)
    expect(odkOverlay.guide!.sections[0].id).toBe("odk-ops")
  })

  it("has steer fragments", () => {
    expect(odkOverlay.steer).toBeDefined()
    expect(odkOverlay.steer!.fragments.length).toBeGreaterThanOrEqual(1)
  })

  it("has lifecycle and dispose", () => {
    expect((odkOverlay as any).lifecycle).toBeDefined()
    expect(odkOverlay.dispose).toBeDefined()
    expect(typeof odkOverlay.dispose).toBe("function")
  })
})
