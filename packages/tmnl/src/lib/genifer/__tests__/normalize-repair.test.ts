/**
 * @fileoverview Tests for normalize.ts + repair.ts (Phase 1 deterministic core)
 *
 * Tests against all three LLM JSON formats discovered during spike testing:
 *   - Nested: { type, key, props, children: [{...}] }
 *   - Flat:   { root, elements: { key: {...} } }
 *   - Hybrid: { type, key, children: ["k1","k2"], k1: {...} }
 */

import { describe, it, expect } from "vitest"
import { Effect, Option, HashMap } from "effect"

import {
  extractJson,
  parseJson,
  detectFormat,
  fromNested,
  fromFlat,
  fromHybrid,
  normalize,
  normalizeWithMeta,
  NormalizeError,
} from "../core/normalize"

import {
  repair,
  repairLocal,
  repairGlobal,
  assignMissingKeys,
  inferMissingTypes,
  resolveOrphans,
  breakCircularRefs,
} from "../core/repair"

import { UIElement, UITree } from "../core/schemas"

// =============================================================================
// Helpers
// =============================================================================

const run = <A>(effect: Effect.Effect<A, any>) => Effect.runSync(effect)
const runP = <A>(effect: Effect.Effect<A, any>) => Effect.runPromise(effect)

// =============================================================================
// Cluster 1: extractJson
// =============================================================================

describe("extractJson", () => {
  it("passes through clean JSON", () => {
    const result = run(extractJson('{"type":"Card","key":"c1"}'))
    expect(JSON.parse(result)).toEqual({ type: "Card", key: "c1" })
  })

  it("strips markdown fences", () => {
    const raw = '```json\n{"type":"Card"}\n```'
    const result = run(extractJson(raw))
    expect(JSON.parse(result)).toEqual({ type: "Card" })
  })

  it("strips markdown fences (uppercase JSON)", () => {
    const raw = '```JSON\n{"type":"Card"}\n```'
    const result = run(extractJson(raw))
    expect(JSON.parse(result)).toEqual({ type: "Card" })
  })

  it("extracts JSON from prose wrapper", () => {
    const raw = 'Here is the dashboard:\n\n{"type":"Page","key":"p1"}\n\nEnjoy!'
    const result = run(extractJson(raw))
    expect(JSON.parse(result)).toEqual({ type: "Page", key: "p1" })
  })

  it("removes trailing commas", () => {
    const raw = '{"type":"Card","props":{"a":1,},"children":[1,2,],}'
    const result = run(extractJson(raw))
    expect(JSON.parse(result)).toEqual({ type: "Card", props: { a: 1 }, children: [1, 2] })
  })

  it("strips single-line comments", () => {
    const raw = '{"type":"Card" // this is a card\n}'
    const result = run(extractJson(raw))
    expect(JSON.parse(result)).toEqual({ type: "Card" })
  })

  it("handles nested braces in strings", () => {
    const raw = '{"type":"Card","props":{"template":"{a: {b: c}}"}}'
    const result = run(extractJson(raw))
    expect(JSON.parse(result).props.template).toBe("{a: {b: c}}")
  })

  it("fails on no JSON content", () => {
    expect(() => run(extractJson("no json here"))).toThrow()
  })

  it("recovers truncated JSON by closing open brackets", () => {
    // Partial recovery: force-closes the open brace
    const result = run(extractJson('{"type":"Card"'))
    const parsed = JSON.parse(result)
    expect(parsed.type).toBe("Card")
  })

  it("extracts array format", () => {
    const raw = '[{"type":"Card"},{"type":"Text"}]'
    const result = run(extractJson(raw))
    expect(JSON.parse(result)).toHaveLength(2)
  })

  it("preserves URLs inside string values (// in https://)", () => {
    const raw = '{"type":"Card","props":{"url":"https://example.com/docs","api":"http://localhost:3000/api"}}'
    const result = run(extractJson(raw))
    const parsed = JSON.parse(result)
    expect(parsed.props.url).toBe("https://example.com/docs")
    expect(parsed.props.api).toBe("http://localhost:3000/api")
  })

  it("strips // comments while preserving URLs in same object", () => {
    const raw = '{"type":"Page", // root\n"props":{"url":"https://example.com"}}'
    const result = run(extractJson(raw))
    const parsed = JSON.parse(result)
    expect(parsed.type).toBe("Page")
    expect(parsed.props.url).toBe("https://example.com")
  })

  it("merges multiple root objects into wrapper", () => {
    const raw = '{"type":"A","key":"a1"}\n{"type":"B","key":"b1"}'
    const result = run(extractJson(raw))
    const parsed = JSON.parse(result)
    expect(parsed.type).toBe("Root")
    expect(parsed.children).toHaveLength(2)
    expect(parsed.children[0].type).toBe("A")
    expect(parsed.children[1].type).toBe("B")
  })

  it("recovers truncated JSON after complete children", () => {
    const raw = '{"type":"Page","children":[{"type":"Card","key":"c1"}]'
    // Missing closing }
    const result = run(extractJson(raw))
    const parsed = JSON.parse(result)
    expect(parsed.type).toBe("Page")
    expect(parsed.children[0].key).toBe("c1")
  })
})

// =============================================================================
// Cluster 2: detectFormat
// =============================================================================

describe("detectFormat", () => {
  it("detects nested format", () => {
    const obj = { type: "Page", key: "p1", children: [{ type: "Card" }] }
    expect(run(detectFormat(obj))).toBe("nested")
  })

  it("detects flat format", () => {
    const obj = { root: "p1", elements: { p1: { type: "Page" } } }
    expect(run(detectFormat(obj))).toBe("flat")
  })

  it("detects hybrid format", () => {
    const obj = { type: "Page", key: "p1", children: ["s1", "s2"], s1: { type: "Section" }, s2: { type: "Section" } }
    expect(run(detectFormat(obj))).toBe("hybrid")
  })

  it("detects nested leaf (no children)", () => {
    const obj = { type: "MetricCard", key: "m1", props: { label: "CPU", value: "42%" } }
    expect(run(detectFormat(obj))).toBe("nested")
  })

  it("detects nested with empty children", () => {
    const obj = { type: "Card", key: "c1", children: [] }
    expect(run(detectFormat(obj))).toBe("nested")
  })

  it("fails on array input", () => {
    expect(() => run(detectFormat([1, 2, 3]))).toThrow()
  })

  it("fails on object with no type and no root", () => {
    expect(() => run(detectFormat({ foo: "bar" }))).toThrow()
  })
})

// =============================================================================
// Converters
// =============================================================================

describe("fromNested", () => {
  it("converts simple nested tree", () => {
    const obj = {
      type: "Page", key: "p1", props: { title: "Dashboard" },
      children: [
        { type: "Card", key: "c1", props: { title: "Stats" } },
        { type: "Card", key: "c2", props: { title: "Charts" } },
      ],
    }
    const tree = run(fromNested(obj))
    expect(tree.root).toBe("p1")
    expect(tree.size).toBe(3)
    expect(Option.isSome(tree.getElement("p1"))).toBe(true)
    expect(Option.isSome(tree.getElement("c1"))).toBe(true)
    expect(Option.isSome(tree.getElement("c2"))).toBe(true)

    const page = Option.getOrThrow(tree.getElement("p1"))
    expect(page.children).toEqual(["c1", "c2"])

    const c1 = Option.getOrThrow(tree.getElement("c1"))
    expect(c1.parentKey).toBe("p1")
    expect(c1.type).toBe("Card")
  })

  it("auto-generates keys for keyless nodes", () => {
    const obj = {
      type: "Page",
      children: [
        { type: "Text", props: { text: "hello" } },
      ],
    }
    const tree = run(fromNested(obj))
    expect(tree.size).toBe(2)
    // Root should have auto key or "root" fallback
    expect(tree.root).toBeDefined()
  })

  it("handles deeply nested structure", () => {
    const obj = {
      type: "Page", key: "p",
      children: [{
        type: "Section", key: "s",
        children: [{
          type: "Grid", key: "g",
          children: [{
            type: "Card", key: "c",
            children: [{ type: "Text", key: "t", props: { text: "deep" } }],
          }],
        }],
      }],
    }
    const tree = run(fromNested(obj))
    expect(tree.size).toBe(5)

    const t = Option.getOrThrow(tree.getElement("t"))
    expect(t.parentKey).toBe("c")
    expect(t.props.text).toBe("deep")
  })

  it("collects inlined props (top-level non-meta fields)", () => {
    const obj = { type: "MetricCard", key: "m1", label: "CPU", value: "42%" }
    const tree = run(fromNested(obj))
    const el = Option.getOrThrow(tree.getElement("m1"))
    expect(el.props.label).toBe("CPU")
    expect(el.props.value).toBe("42%")
  })
})

describe("fromFlat", () => {
  it("converts flat format with parent resolution", () => {
    const obj = {
      root: "p1",
      elements: {
        p1: { type: "Page", props: { title: "Dashboard" }, children: ["c1", "c2"] },
        c1: { type: "Card", props: { title: "A" } },
        c2: { type: "Card", props: { title: "B" } },
      },
    }
    const tree = run(fromFlat(obj))
    expect(tree.root).toBe("p1")
    expect(tree.size).toBe(3)

    const c1 = Option.getOrThrow(tree.getElement("c1"))
    expect(c1.parentKey).toBe("p1")

    const p1 = Option.getOrThrow(tree.getElement("p1"))
    expect(p1.children).toEqual(["c1", "c2"])
  })
})

describe("fromHybrid", () => {
  it("converts hybrid format (string children + sibling defs)", () => {
    const obj = {
      type: "Page",
      key: "devops",
      children: ["s1", "s2"],
      s1: {
        type: "Section",
        props: { title: "Pipeline" },
        children: ["m1"],
        m1: { type: "MetricCard", props: { label: "Build", value: "OK" } },
      },
      s2: {
        type: "Section",
        props: { title: "Infra" },
        children: ["m2"],
        m2: { type: "MetricCard", props: { label: "CPU", value: "42%" } },
      },
    }
    const tree = run(fromHybrid(obj))
    expect(tree.root).toBe("devops")
    expect(tree.size).toBeGreaterThanOrEqual(5) // page + 2 sections + 2 metrics

    const s1 = Option.getOrThrow(tree.getElement("s1"))
    expect(s1.type).toBe("Section")
    expect(s1.parentKey).toBe("devops")

    const m1 = Option.getOrThrow(tree.getElement("m1"))
    expect(m1.type).toBe("MetricCard")
    expect(m1.props.label).toBe("Build")
  })

  it("handles deeply nested hybrid", () => {
    const obj = {
      type: "Page", key: "p",
      children: ["s1"],
      s1: {
        type: "Section", children: ["g1"],
        g1: {
          type: "Grid", children: ["c1"],
          c1: { type: "Card", props: { title: "Deep" } },
        },
      },
    }
    const tree = run(fromHybrid(obj))
    expect(tree.size).toBeGreaterThanOrEqual(4)
    expect(Option.isSome(tree.getElement("c1"))).toBe(true)
  })
})

// =============================================================================
// Unified normalize()
// =============================================================================

describe("normalize", () => {
  it("handles nested JSON with markdown fences", () => {
    const raw = '```json\n{"type":"Page","key":"p","children":[{"type":"Card","key":"c"}]}\n```'
    const tree = run(normalize(raw))
    expect(tree.size).toBe(2)
    expect(tree.root).toBe("p")
  })

  it("handles flat JSON with prose", () => {
    const raw = 'Here is the UI:\n{"root":"p","elements":{"p":{"type":"Page","children":["c"]},"c":{"type":"Card"}}}\nDone.'
    const tree = run(normalize(raw))
    expect(tree.size).toBe(2)
  })

  it("handles hybrid JSON", () => {
    const raw = '{"type":"Page","key":"p","children":["s"],"s":{"type":"Section","props":{"title":"A"}}}'
    const tree = run(normalize(raw))
    expect(tree.size).toBe(2)
  })
})

describe("normalize — multi-root", () => {
  it("merges two root objects into nested tree", () => {
    const raw = '{"type":"Section","key":"s1","children":[{"type":"Card","key":"c1"}]}\n{"type":"Section","key":"s2","children":[{"type":"Card","key":"c2"}]}'
    const tree = run(normalize(raw))
    expect(tree.root).toBe("multi-root")
    expect(tree.size).toBeGreaterThanOrEqual(5) // Root + 2 sections + 2 cards
    expect(Option.isSome(tree.getElement("s1"))).toBe(true)
    expect(Option.isSome(tree.getElement("s2"))).toBe(true)
    expect(Option.isSome(tree.getElement("c1"))).toBe(true)
    expect(Option.isSome(tree.getElement("c2"))).toBe(true)
  })
})

describe("normalizeWithMeta", () => {
  it("returns format metadata", () => {
    const raw = '{"type":"Page","key":"p","children":[{"type":"Card","key":"c"}]}'
    const result = run(normalizeWithMeta(raw))
    expect(result.format).toBe("nested")
    expect(result.elementCount).toBe(2)
    expect(result.rawLength).toBe(raw.length)
  })
})

// =============================================================================
// Cluster 3: Repair
// =============================================================================

describe("inferMissingTypes", () => {
  it("infers MetricCard from label+value props", () => {
    const tree = UITree.fromRecord("r", {
      r: new UIElement({ key: "r", type: "Unknown", props: { label: "CPU", value: "42%" }, children: [] }),
    })
    const { tree: repaired, repairs } = run(inferMissingTypes(tree))
    const el = Option.getOrThrow(repaired.getElement("r"))
    expect(el.type).toBe("MetricCard")
    expect(repairs).toHaveLength(1)
    expect(repairs[0].action).toBe("inferType")
  })

  it("infers Text from text prop + no children", () => {
    const tree = UITree.fromRecord("r", {
      r: new UIElement({ key: "r", type: "Unknown", props: { text: "hello" }, children: [] }),
    })
    const el = Option.getOrThrow(run(inferMissingTypes(tree)).tree.getElement("r"))
    expect(el.type).toBe("Text")
  })

  it("infers Grid from columns prop", () => {
    const tree = UITree.fromRecord("r", {
      r: new UIElement({ key: "r", type: "Unknown", props: { columns: 3 }, children: ["c1"] }),
    })
    const el = Option.getOrThrow(run(inferMissingTypes(tree)).tree.getElement("r"))
    expect(el.type).toBe("Grid")
  })

  it("skips elements with valid types", () => {
    const tree = UITree.fromRecord("r", {
      r: new UIElement({ key: "r", type: "Card", props: { label: "CPU", value: "42%" }, children: [] }),
    })
    const { repairs } = run(inferMissingTypes(tree))
    expect(repairs).toHaveLength(0)
  })
})

describe("resolveOrphans", () => {
  it("creates placeholder for missing child reference", () => {
    const tree = UITree.fromRecord("p", {
      p: new UIElement({ key: "p", type: "Page", props: {}, children: ["c1", "missing-child"] }),
      c1: new UIElement({ key: "c1", type: "Card", props: {}, children: [] }),
    })
    const { tree: repaired, repairs } = run(resolveOrphans(tree))
    expect(repaired.size).toBe(3)
    const placeholder = Option.getOrThrow(repaired.getElement("missing-child"))
    expect(placeholder.type).toBe("Placeholder")
    expect(placeholder.parentKey).toBe("p")
    expect(repairs).toHaveLength(1)
  })

  it("no-ops when all children exist", () => {
    const tree = UITree.fromRecord("p", {
      p: new UIElement({ key: "p", type: "Page", props: {}, children: ["c1"] }),
      c1: new UIElement({ key: "c1", type: "Card", props: {}, children: [] }),
    })
    const { repairs } = run(resolveOrphans(tree))
    expect(repairs).toHaveLength(0)
  })
})

describe("breakCircularRefs", () => {
  it("breaks a simple cycle", () => {
    const tree = UITree.fromRecord("a", {
      a: new UIElement({ key: "a", type: "Section", props: {}, children: ["b"] }),
      b: new UIElement({ key: "b", type: "Section", props: {}, children: ["a"] }), // back-edge!
    })
    const { tree: repaired, repairs } = run(breakCircularRefs(tree))
    const b = Option.getOrThrow(repaired.getElement("b"))
    expect(b.children).not.toContain("a")
    expect(repairs.length).toBeGreaterThan(0)
    expect(repairs[0].action).toBe("breakCycle")
  })

  it("handles tree with no cycles", () => {
    const tree = UITree.fromRecord("a", {
      a: new UIElement({ key: "a", type: "Page", props: {}, children: ["b", "c"] }),
      b: new UIElement({ key: "b", type: "Card", props: {}, children: [] }),
      c: new UIElement({ key: "c", type: "Card", props: {}, children: [] }),
    })
    const { repairs } = run(breakCircularRefs(tree))
    expect(repairs).toHaveLength(0)
  })
})

describe("repair (full pipeline)", () => {
  it("runs all repair steps in sequence", () => {
    const tree = UITree.fromRecord("p", {
      p: new UIElement({ key: "p", type: "Page", props: {}, children: ["c1", "orphan-ref"] }),
      c1: new UIElement({ key: "c1", type: "Unknown", props: { label: "CPU", value: "42%" }, children: [] }),
    })
    const result = run(repair(tree))
    expect(result.tree.size).toBe(3) // p + c1 + orphan placeholder

    // c1 should be inferred as MetricCard
    const c1 = Option.getOrThrow(result.tree.getElement("c1"))
    expect(c1.type).toBe("MetricCard")

    // orphan should be resolved
    expect(Option.isSome(result.tree.getElement("orphan-ref"))).toBe(true)

    expect(result.repairs.length).toBeGreaterThan(0)
  })
})

describe("repairLocal vs repairGlobal", () => {
  it("repairLocal does key assignment and type inference", () => {
    const tree = UITree.fromRecord("r", {
      r: new UIElement({ key: "r", type: "Unknown", props: { text: "hello" }, children: [] }),
    })
    const { tree: repaired } = run(repairLocal(tree))
    const el = Option.getOrThrow(repaired.getElement("r"))
    expect(el.type).toBe("Text")
  })

  it("repairGlobal does orphan resolution and cycle breaking", () => {
    const tree = UITree.fromRecord("a", {
      a: new UIElement({ key: "a", type: "Section", props: {}, children: ["b", "missing"] }),
      b: new UIElement({ key: "b", type: "Card", props: {}, children: ["a"] }),
    })
    const { tree: repaired, repairs } = run(repairGlobal(tree))
    // Orphan resolved
    expect(Option.isSome(repaired.getElement("missing"))).toBe(true)
    // Cycle broken
    const b = Option.getOrThrow(repaired.getElement("b"))
    expect(b.children).not.toContain("a")
  })
})

// =============================================================================
// Integration: normalize → repair
// =============================================================================

describe("normalize → repair integration", () => {
  it("full pipeline on real-world nested JSON", () => {
    const raw = `\`\`\`json
{
  "type": "Page",
  "key": "dashboard",
  "props": { "title": "DevOps" },
  "children": [
    {
      "type": "Section",
      "key": "pipeline",
      "props": { "title": "Build Pipeline" },
      "children": [
        {
          "type": "Grid",
          "key": "grid1",
          "props": { "columns": 2 },
          "children": [
            { "type": "MetricCard", "key": "m1", "props": { "label": "Build Status", "value": "PASSING" } },
            { "type": "MetricCard", "key": "m2", "props": { "label": "Coverage", "value": "87%" } }
          ]
        }
      ]
    },
    {
      "type": "Section",
      "key": "infra",
      "children": [
        { "type": "MetricCard", "key": "m3", "props": { "label": "CPU", "value": "42%" } },
        { "type": "MetricCard", "key": "m4", "props": { "label": "Memory", "value": "6.2 GB" } }
      ]
    }
  ]
}
\`\`\``
    const tree = run(normalize(raw))
    const result = run(repair(tree))

    expect(result.tree.size).toBe(8) // Page + 2 Sections + Grid + 4 MetricCards
    expect(result.tree.root).toBe("dashboard")

    // Depth check: dashboard → pipeline → grid1 → m1 = depth 3
    const m1 = Option.getOrThrow(result.tree.getElement("m1"))
    expect(m1.parentKey).toBe("grid1")
    const grid = Option.getOrThrow(result.tree.getElement("grid1"))
    expect(grid.parentKey).toBe("pipeline")
    const pipeline = Option.getOrThrow(result.tree.getElement("pipeline"))
    expect(pipeline.parentKey).toBe("dashboard")
  })

  it("full pipeline on hybrid format", () => {
    const raw = JSON.stringify({
      type: "Page", key: "p",
      children: ["s1", "s2"],
      s1: { type: "Section", props: { title: "A" }, children: ["m1"], m1: { type: "MetricCard", props: { label: "X", value: "1" } } },
      s2: { type: "Section", props: { title: "B" } },
    })
    const tree = run(normalize(raw))
    const result = run(repair(tree))

    expect(result.tree.size).toBeGreaterThanOrEqual(4) // p + s1 + s2 + m1
    expect(result.tree.root).toBe("p")
  })

  it("full pipeline on flat format", () => {
    const raw = JSON.stringify({
      root: "p",
      elements: {
        p: { type: "Page", children: ["c1", "c2"] },
        c1: { type: "Card", props: { title: "A" } },
        c2: { type: "Card", props: { title: "B" } },
      },
    })
    const tree = run(normalize(raw))
    const result = run(repair(tree))

    expect(result.tree.size).toBe(3)
    expect(result.tree.root).toBe("p")
  })
})
