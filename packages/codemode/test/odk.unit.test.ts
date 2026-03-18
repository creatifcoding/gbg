/**
 * ODK unit tests — contract validation, conformance, inspection, comparison.
 * Tests run against both synthetic overlays and the live metaskill overlay.
 */
import { describe, it, expect } from "vitest"
import { validate, CONTRACT_RULES, conformance, inspect, inventoryFacets, introspectMethods, compare, CONFORMANCE_LABELS } from "../src/plugins/odk/index.ts"
import { metaskillPlugin } from "../src/plugins/metaskill.ts"
import { NodeFileSystemLayer } from "../src/adapters/filesystem-node.ts"
import type { CodemodeOverlay } from "../src/overlay.ts"

// ── Fixtures ─────────────────────────────────────────────────────

const minimal: CodemodeOverlay = {
  id: "test-minimal",
  name: "Minimal Overlay",
  methods: {
    hello: () => "world",
    greet: (name: string) => `hi ${name}`,
  },
}

const covered: CodemodeOverlay = {
  id: "test-covered",
  name: "Covered Overlay",
  methods: {
    hello: () => "world",
    greet: (name: string) => `hi ${name}`,
  },
  guide: {
    sections: [{
      id: "test-ops",
      slot: "api" as const,
      priority: 20,
      content: "cm.hello() → string\ncm.greet(name) → string",
    }],
  },
  steer: {
    fragments: [{
      id: "test-persona",
      content: "You are a test overlay.",
    }],
  },
}

const complete: CodemodeOverlay = {
  id: "test-complete",
  name: "Complete Overlay",
  version: "1.0.0",
  methods: {
    hello: () => "world",
  },
  guide: {
    sections: [{
      id: "test-ops",
      slot: "api" as const,
      priority: 20,
      content: "cm.hello() → string",
    }],
  },
  steer: {
    fragments: [{ id: "test-persona", content: "You are complete." }],
  },
  lifecycle: {
    onLoad: () => {},
  },
  dispose: () => {},
}

const metaskill = metaskillPlugin(process.cwd(), NodeFileSystemLayer)

// ── Contract Rules ───────────────────────────────────────────────

describe("ODK: contract rules", () => {
  it("has 19 rules across 6 categories", () => {
    expect(CONTRACT_RULES.length).toBe(19)
    const categories = new Set(CONTRACT_RULES.map(r => r.category))
    expect(categories.size).toBe(6)
    expect(categories).toContain("structural")
    expect(categories).toContain("guide")
    expect(categories).toContain("coverage")
    expect(categories).toContain("steer")
    expect(categories).toContain("procedures")
    expect(categories).toContain("lifecycle")
  })

  it("each rule has id, description, category, severity, check", () => {
    for (const rule of CONTRACT_RULES) {
      expect(typeof rule.id).toBe("string")
      expect(typeof rule.description).toBe("string")
      expect(typeof rule.category).toBe("string")
      expect(["error", "warning", "info"]).toContain(rule.severity)
      expect(typeof rule.check).toBe("function")
    }
  })

  it("rule ids are unique", () => {
    const ids = CONTRACT_RULES.map(r => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// ── Validate ─────────────────────────────────────────────────────

describe("ODK: validate", () => {
  it("null/undefined fails structural checks", () => {
    const r = validate(null)
    expect(r.valid).toBe(false)
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.errors.some(e => e.ruleId === "S1")).toBe(true)
  })

  it("empty object fails structural checks", () => {
    const r = validate({})
    expect(r.valid).toBe(false)
    expect(r.errors.some(e => e.ruleId === "S1")).toBe(true)
    expect(r.errors.some(e => e.ruleId === "S2")).toBe(true)
    expect(r.errors.some(e => e.ruleId === "S3")).toBe(true)
  })

  it("minimal overlay passes with 0 errors", () => {
    const r = validate(minimal)
    expect(r.valid).toBe(true)
    expect(r.errors.length).toBe(0)
    expect(r.rulesChecked).toBe(19)
  })

  it("minimal has info about missing guide/steer", () => {
    const r = validate(minimal)
    expect(r.info.some(i => i.ruleId === "C1")).toBe(true)
    expect(r.info.some(i => i.ruleId === "C2")).toBe(true)
  })

  it("covered overlay passes with guide/steer present", () => {
    const r = validate(covered)
    expect(r.valid).toBe(true)
    // C1 and C2 should NOT appear since guide and steer exist
    expect(r.info.some(i => i.ruleId === "C1")).toBe(false)
    expect(r.info.some(i => i.ruleId === "C2")).toBe(false)
  })

  it("detects non-function methods (S4)", () => {
    const bad = { id: "bad", name: "Bad", methods: { ok: () => 1, broken: "not a function" } }
    const r = validate(bad)
    expect(r.warnings.some(w => w.ruleId === "S4")).toBe(true)
  })

  it("detects bad guide sections (G2)", () => {
    const bad = {
      id: "bad", name: "Bad", methods: { a: () => 1 },
      guide: { sections: [{ id: "", slot: 42, priority: "wrong" }] },
    }
    const r = validate(bad)
    expect(r.errors.some(e => e.ruleId === "G2")).toBe(true)
  })

  it("detects bad lifecycle hooks (L1)", () => {
    const bad = {
      id: "bad", name: "Bad", methods: { a: () => 1 },
      lifecycle: { onLoad: "not a function" },
    }
    const r = validate(bad)
    expect(r.errors.some(e => e.ruleId === "L1")).toBe(true)
  })

  it("detects bad dispose (L2)", () => {
    const bad = { id: "bad", name: "Bad", methods: { a: () => 1 }, dispose: 42 }
    const r = validate(bad)
    expect(r.errors.some(e => e.ruleId === "L2")).toBe(true)
  })

  it("detects duplicate guide section ids (G4)", () => {
    const bad = {
      id: "bad", name: "Bad", methods: { a: () => 1 },
      guide: { sections: [
        { id: "dup", slot: "api", priority: 1, content: "a" },
        { id: "dup", slot: "api", priority: 2, content: "b" },
      ] },
    }
    const r = validate(bad)
    expect(r.warnings.some(w => w.ruleId === "G4")).toBe(true)
  })

  it("detects bad steer fragments (T1)", () => {
    const bad = {
      id: "bad", name: "Bad", methods: { a: () => 1 },
      steer: { fragments: [{ id: "", content: 42 }] },
    }
    const r = validate(bad)
    expect(r.errors.some(e => e.ruleId === "T1")).toBe(true)
  })

  it("detects bad procedures (P1)", () => {
    const bad = {
      id: "bad", name: "Bad", methods: { a: () => 1 },
      procedures: [{ name: "", fn: "not a fn", manifest: "" }],
    }
    const r = validate(bad)
    expect(r.errors.some(e => e.ruleId === "P1")).toBe(true)
  })

  it("accepts lazy guide content (function)", () => {
    const lazy = {
      id: "lazy", name: "Lazy", methods: { a: () => 1 },
      guide: { sections: [{ id: "s1", slot: "api", priority: 1, content: () => "lazy content" }] },
    }
    const r = validate(lazy)
    expect(r.valid).toBe(true)
    expect(r.errors.some(e => e.ruleId === "G3")).toBe(false)
  })

  // ── Dogfood: metaskill overlay ──
  it("metaskill overlay passes validation (0 errors)", () => {
    const r = validate(metaskill)
    expect(r.valid).toBe(true)
    expect(r.errors.length).toBe(0)
  })
})

// ── Conformance ──────────────────────────────────────────────────

describe("ODK: conformance", () => {
  it("null → level -1 (missing)", () => {
    const r = conformance(null)
    expect(r.level).toBe(-1)
    expect(r.label).toBe("missing")
  })

  it("empty object → level -1 (missing)", () => {
    const r = conformance({})
    expect(r.level).toBe(-1)
  })

  it("id-only → level -1 (needs methods)", () => {
    const r = conformance({ id: "x", name: "X" })
    expect(r.level).toBe(-1)
  })

  it("broken overlay → level 0 (exists but invalid)", () => {
    const bad = {
      id: "bad", name: "Bad",
      methods: { a: () => 1 },
      lifecycle: { onLoad: "string, not function" },
    }
    const r = conformance(bad)
    expect(r.level).toBe(0)
    expect(r.label).toBe("exists")
    expect(r.detail.some(d => d.includes("L1"))).toBe(true)
  })

  it("minimal → level 1 (valid, no guide/steer)", () => {
    const r = conformance(minimal)
    expect(r.level).toBe(1)
    expect(r.label).toBe("valid")
    expect(r.detail.some(d => d.includes("guide"))).toBe(true)
  })

  it("covered → level 2 (has guide + steer, missing lifecycle)", () => {
    const r = conformance(covered)
    expect(r.level).toBe(2)
    expect(r.label).toBe("covered")
  })

  it("complete → level 3", () => {
    const r = conformance(complete)
    expect(r.level).toBe(3)
    expect(r.label).toBe("complete")
  })

  it("CONFORMANCE_LABELS maps all levels", () => {
    expect(CONFORMANCE_LABELS[-1]).toBe("missing")
    expect(CONFORMANCE_LABELS[0]).toBe("exists")
    expect(CONFORMANCE_LABELS[1]).toBe("valid")
    expect(CONFORMANCE_LABELS[2]).toBe("covered")
    expect(CONFORMANCE_LABELS[3]).toBe("complete")
  })

  // ── Dogfood: metaskill ──
  it("metaskill → level ≥ 1 (valid)", () => {
    const r = conformance(metaskill)
    expect(r.level).toBeGreaterThanOrEqual(1)
  })
})

// ── Facet Inventory ──────────────────────────────────────────────

describe("ODK: inventoryFacets", () => {
  it("null → all false, populated 0", () => {
    const f = inventoryFacets(null)
    expect(f.populated).toBe(0)
    expect(f.total).toBe(13)
  })

  it("minimal → id + name + methods", () => {
    const f = inventoryFacets(minimal)
    expect(f.id).toBe(true)
    expect(f.name).toBe(true)
    expect(f.methods).toBe(true)
    expect(f.guide).toBe(false)
    expect(f.steer).toBe(false)
    expect(f.populated).toBe(3)
  })

  it("complete → many facets populated", () => {
    const f = inventoryFacets(complete)
    expect(f.id).toBe(true)
    expect(f.name).toBe(true)
    expect(f.version).toBe(true)
    expect(f.methods).toBe(true)
    expect(f.guide).toBe(true)
    expect(f.steer).toBe(true)
    expect(f.lifecycle).toBe(true)
    expect(f.dispose).toBe(true)
  })

  it("metaskill has ≥ 4 facets", () => {
    const f = inventoryFacets(metaskill)
    expect(f.populated).toBeGreaterThanOrEqual(4)
    expect(f.id).toBe(true)
    expect(f.name).toBe(true)
    expect(f.methods).toBe(true)
    expect(f.guide).toBe(true)
  })
})

// ── Method Introspection ─────────────────────────────────────────

describe("ODK: introspectMethods", () => {
  it("null → empty array", () => {
    expect(introspectMethods(null)).toEqual([])
  })

  it("introspects typeof, name, length on each method", () => {
    const methods = introspectMethods(minimal)
    expect(methods.length).toBe(2)

    const hello = methods.find(m => m.key === "hello")!
    expect(hello.type).toBe("function")
    expect(hello.name).toBe("hello")
    expect(hello.arity).toBe(0)
    expect(hello.nameMatchesKey).toBe(true)

    const greet = methods.find(m => m.key === "greet")!
    expect(greet.type).toBe("function")
    expect(greet.arity).toBe(1)
  })

  it("metaskill methods all have function type", () => {
    const methods = introspectMethods(metaskill)
    expect(methods.length).toBeGreaterThan(10)
    for (const m of methods) {
      expect(m.type).toBe("function")
    }
  })

  it("metaskill: known arities", () => {
    const methods = introspectMethods(metaskill)
    const discover = methods.find(m => m.key === "discover")!
    const inspectM = methods.find(m => m.key === "inspect")!
    expect(discover.arity).toBe(0)
    expect(inspectM.arity).toBe(1)
  })
})

// ── Full Inspect ─────────────────────────────────────────────────

describe("ODK: inspect", () => {
  it("returns full report for minimal overlay", () => {
    const r = inspect(minimal)
    expect(r.id).toBe("test-minimal")
    expect(r.name).toBe("Minimal Overlay")
    expect(r.contract.valid).toBe(true)
    expect(r.conformance.level).toBe(1)
    expect(r.facets.populated).toBe(3)
    expect(r.methods.length).toBe(2)
  })

  it("metaskill full inspection", () => {
    const r = inspect(metaskill)
    expect(r.id).toBe("metaskill")
    expect(r.contract.valid).toBe(true)
    expect(r.conformance.level).toBeGreaterThanOrEqual(1)
    expect(r.methods.length).toBe(21)
    expect(r.guideSections.length).toBeGreaterThan(0)
  })
})

// ── Compare ──────────────────────────────────────────────────────

describe("ODK: compare", () => {
  it("identical overlays → all shared, no delta", () => {
    const r = compare(minimal, minimal)
    expect(r.onlyInA.length).toBe(0)
    expect(r.onlyInB.length).toBe(0)
    expect(r.shared).toEqual(["hello", "greet"])
  })

  it("disjoint overlays → no shared, all unique", () => {
    const other: CodemodeOverlay = {
      id: "other", name: "Other",
      methods: { foo: () => 1, bar: () => 2 },
    }
    const r = compare(minimal, other)
    expect(r.shared.length).toBe(0)
    expect(r.onlyInA).toEqual(["hello", "greet"])
    expect(r.onlyInB).toEqual(["foo", "bar"])
    expect(r.collisionRisk).toBe("none")
  })

  it("partial overlap → collision detection", () => {
    const overlapping: CodemodeOverlay = {
      id: "overlap", name: "Overlap",
      methods: { hello: () => "overridden", unique: () => 1 },
    }
    const r = compare(minimal, overlapping)
    expect(r.shared).toEqual(["hello"])
    expect(r.onlyInA).toEqual(["greet"])
    expect(r.onlyInB).toEqual(["unique"])
    expect(r.collisionRisk).not.toBe("none")
  })

  it("facet delta detection", () => {
    const r = compare(minimal, covered)
    expect(r.facetDelta.onlyInB).toContain("guide")
    expect(r.facetDelta.onlyInB).toContain("steer")
  })

  it("null vs overlay → graceful", () => {
    const r = compare(null, minimal)
    expect(r.onlyInA.length).toBe(0)
    expect(r.onlyInB.length).toBe(2)
  })
})
