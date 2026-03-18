/**
 * ODK as overlay — self-validation dogfood.
 * The ODK overlay validates itself and the metaskill overlay.
 */
import { describe, it, expect } from "vitest"
import { odk, validate, conformance, inspect, inventoryFacets } from "../src/plugins/odk/index.ts"
import { metaskillPlugin } from "../src/plugins/metaskill.ts"
import { NodeFileSystemLayer } from "../src/adapters/filesystem-node.ts"
import type { CodemodeOverlay } from "../src/overlay.ts"

const metaskill = metaskillPlugin(process.cwd(), NodeFileSystemLayer)
const odkov = odk(() => [odkov, metaskill])

// ── ODK Identity ─────────────────────────────────────────────────

describe("ODK overlay: identity", () => {
  it("has id, name, version", () => {
    expect(odkov.id).toBe("odk")
    expect(odkov.name).toBe("Overlay Development Kit")
    expect(odkov.version).toBe("1.0.0")
  })
})

// ── ODK Methods ──────────────────────────────────────────────────

describe("ODK overlay: methods", () => {
  // ODK registers a single `odk` namespace method to avoid collisions
  const odkmethods = odkov.methods.odk as any

  it("has 1 top-level method (odk namespace)", () => {
    expect(Object.keys(odkov.methods).length).toBe(1)
    expect(typeof odkov.methods.odk).toBe("function")
  })

  it("odk namespace has 12 sub-methods", () => {
    const subMethods = ["validate", "rules", "inspect", "conformance", "scaffold",
      "buildManifest", "testHarness",
      "catalog", "compare", "templates", "template", "packageCheck"]
    for (const m of subMethods) {
      expect(typeof odkmethods[m]).toBe("function")
    }
  })

  it("validate method works", () => {
    const r = odkmethods.validate(metaskill)
    expect(r).toBeDefined()
    expect(r.valid).toBe(true)
  })

  it("conformance method works", () => {
    const r = odkmethods.conformance(metaskill)
    expect(r.level).toBeGreaterThanOrEqual(1)
  })

  it("inspect method works", () => {
    const r = odkmethods.inspect(metaskill)
    expect(r.id).toBe("metaskill")
    expect(r.contract.valid).toBe(true)
  })

  it("catalog returns loaded overlays", () => {
    const entries = odkmethods.catalog()
    expect(entries.length).toBe(2)
    expect(entries.some((e: any) => e.id === "odk")).toBe(true)
    expect(entries.some((e: any) => e.id === "metaskill")).toBe(true)
  })

  it("compare detects 0 collisions between odk and metaskill", () => {
    const r = odkmethods.compare(odkov, metaskill)
    // Both have 'odk' namespace, metaskill has 21 domain methods
    // ODK has 1 method (odk), metaskill has 21 — 0 shared
    expect(r.shared.length).toBe(0)
    expect(r.onlyInA.length).toBe(1)
    expect(r.onlyInB.length).toBe(21)
    expect(r.collisionRisk).toBe("none")
  })

  it("templates returns 4 templates", () => {
    const t = odkmethods.templates()
    expect(t.length).toBe(4)
  })

  it("template returns config by name", () => {
    const t = odkmethods.template("minimal")
    expect(t.name).toBe("minimal")
  })

  it("rules returns all 19 contract rules", () => {
    const rules = odkmethods.rules()
    expect(rules.length).toBe(19)
  })

  it("testHarness generates test code", () => {
    const test = odkmethods.testHarness("metaskill", "Skill Governance", "governance", [
      { name: "discover", arity: 0 },
      { name: "inspect", arity: 1 },
    ])
    expect(test).toContain("metaskill")
    expect(test).toContain("validate")
    expect(test).toContain("discover")
  })
})

// ── ODK Guide ────────────────────────────────────────────────────

describe("ODK overlay: guide", () => {
  it("has guide sections", () => {
    expect(odkov.guide!.sections.length).toBe(1)
    expect(odkov.guide!.sections[0].id).toBe("odk-ops")
    expect(odkov.guide!.sections[0].slot).toBe("api")
  })

  it("guide mentions cm.odk.* methods", () => {
    const content = odkov.guide!.sections[0].content
    const text = typeof content === "function" ? content() : content
    expect(text).toContain("cm.odk.validate")
    expect(text).toContain("cm.odk.inspect")
    expect(text).toContain("cm.odk.scaffold")
    expect(text).toContain("cm.odk.catalog")
  })
})

// ── ODK Steer ────────────────────────────────────────────────────

describe("ODK overlay: steer", () => {
  it("has steer fragments", () => {
    expect(odkov.steer!.fragments.length).toBe(1)
    expect(odkov.steer!.fragments[0].id).toBe("odk-guidance")
  })
})

// ── ODK Lifecycle ────────────────────────────────────────────────

describe("ODK overlay: lifecycle", () => {
  it("has onLoad", () => {
    expect(typeof odkov.lifecycle!.onLoad).toBe("function")
  })

  it("has dispose", () => {
    expect(typeof odkov.dispose).toBe("function")
  })
})

// ── Self-Validation (Dogfood) ────────────────────────────────────

describe("ODK overlay: self-validation", () => {
  it("ODK passes its own validate()", () => {
    const r = validate(odkov)
    expect(r.valid).toBe(true)
    expect(r.errors.length).toBe(0)
  })

  it("ODK conformance ≥ 2 (covered)", () => {
    const r = conformance(odkov)
    expect(r.level).toBeGreaterThanOrEqual(2)
  })

  it("ODK full inspection clean", () => {
    const r = inspect(odkov)
    expect(r.id).toBe("odk")
    expect(r.contract.valid).toBe(true)
    expect(r.conformance.level).toBeGreaterThanOrEqual(2)
    expect(r.methods.length).toBe(1) // single `odk` namespace method
  })

  it("ODK facets: id + name + version + methods + guide + steer + lifecycle + dispose", () => {
    const f = inventoryFacets(odkov)
    expect(f.id).toBe(true)
    expect(f.name).toBe(true)
    expect(f.version).toBe(true)
    expect(f.methods).toBe(true)
    expect(f.guide).toBe(true)
    expect(f.steer).toBe(true)
    expect(f.lifecycle).toBe(true)
    expect(f.dispose).toBe(true)
    expect(f.populated).toBeGreaterThanOrEqual(8)
  })

  it("ODK conformance = 3 (complete — all required facets)", () => {
    const r = conformance(odkov)
    expect(r.level).toBe(3)
    expect(r.label).toBe("complete")
  })
})

// ── Metaskill validation via ODK ─────────────────────────────────

describe("ODK: metaskill dogfood", () => {
  it("metaskill passes validate", () => {
    const r = validate(metaskill)
    expect(r.valid).toBe(true)
  })

  it("metaskill conformance ≥ 1", () => {
    const r = conformance(metaskill)
    expect(r.level).toBeGreaterThanOrEqual(1)
  })

  it("metaskill has 21 inspectable methods", () => {
    const r = inspect(metaskill)
    expect(r.methods.length).toBe(21)
    for (const m of r.methods) {
      expect(m.type).toBe("function")
    }
  })
})
