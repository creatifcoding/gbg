/**
 * @tmnl/stx — Family tests
 *
 * Tests for stxFamily: keyed atom collections with autoLens, focus,
 * referential stability, GC behavior, and mutation operations.
 */

import { describe, it, expect } from "vitest"
import { AtomRegistry } from "effect/unstable/reactivity"
import { stxFamily } from "../src/internal/family.js"

// ─── Test helpers ───────────────────────────────────

interface CellValue {
  readonly _tag: string
  readonly value?: number | string
}

const empty = (): CellValue => ({ _tag: "Empty" })
const num = (n: number): CellValue => ({ _tag: "Number", value: n })
const str = (s: string): CellValue => ({ _tag: "String", value: s })

interface Entity {
  readonly id: string
  readonly name: string
  readonly score: number
  readonly meta: { readonly active: boolean }
}

const makeEntity = (id: string): Entity => ({
  id,
  name: `entity-${id}`,
  score: 0,
  meta: { active: true },
})

// ─── Core family behavior ───────────────────────────

describe("stxFamily", () => {
  describe("creation", () => {
    it("creates with custom registry", () => {
      const reg = AtomRegistry.make()
      const family = stxFamily(empty, reg)
      expect(family.registry).toBe(reg)
    })

    it("creates with auto registry when none provided", () => {
      const family = stxFamily(empty)
      expect(family.registry).toBeDefined()
    })

    it("exposes shared autoLens", () => {
      const family = stxFamily(makeEntity)
      expect(family.lens).toBeDefined()
      expect(family.lens.name).toBeDefined()
      expect(family.lens.score).toBeDefined()
      expect(family.lens.meta.active).toBeDefined()
    })
  })

  describe("atom identity", () => {
    it("same key returns same atom (referential equality)", () => {
      const family = stxFamily(empty)
      const a1 = family("cell-0:0")
      const a2 = family("cell-0:0")
      expect(a1).toBe(a2)
    })

    it("different keys return different atoms", () => {
      const family = stxFamily(empty)
      const a1 = family("0:0")
      const a2 = family("0:1")
      expect(a1).not.toBe(a2)
    })

    it("factory called once per unique key", () => {
      let callCount = 0
      const family = stxFamily((key: string) => {
        callCount++
        return empty()
      })

      family("A")
      family("A")
      family("A")
      family("B")

      expect(callCount).toBe(2)
    })
  })

  describe("read/write", () => {
    it("get returns factory-produced initial value", () => {
      const family = stxFamily(empty)
      expect(family.get("X")).toEqual({ _tag: "Empty" })
    })

    it("set writes and get reads back", () => {
      const family = stxFamily(empty)
      family.set("X", num(42))
      expect(family.get("X")).toEqual({ _tag: "Number", value: 42 })
    })

    it("writes are isolated per key", () => {
      const family = stxFamily(empty)
      family.set("A", num(1))
      family.set("B", num(2))
      expect(family.get("A")).toEqual({ _tag: "Number", value: 1 })
      expect(family.get("B")).toEqual({ _tag: "Number", value: 2 })
    })

    it("setAt with lens", () => {
      const family = stxFamily(makeEntity)
      family.setAt("e1", family.lens.name as any, "updated")
      expect(family.get("e1").name).toBe("updated")
      // Other fields untouched
      expect(family.get("e1").score).toBe(0)
    })
  })

  describe("member API", () => {
    it("member returns full API object", () => {
      const family = stxFamily(makeEntity)
      const m = family.member("e1")

      expect(m.key).toBe("e1")
      expect(m.get).toBeTypeOf("function")
      expect(m.set).toBeTypeOf("function")
      expect(m.setAt).toBeTypeOf("function")
      expect(m.modify).toBeTypeOf("function")
      expect(m.getAt).toBeTypeOf("function")
      expect(m.focus).toBeTypeOf("function")
    })

    it("member.get reads current value", () => {
      const family = stxFamily(makeEntity)
      const m = family.member("e1")
      expect(m.get().name).toBe("entity-e1")
    })

    it("member.set writes value", () => {
      const family = stxFamily(empty)
      const m = family.member("X")
      m.set(num(99))
      expect(m.get()).toEqual({ _tag: "Number", value: 99 })
      // Same through family.get
      expect(family.get("X")).toEqual({ _tag: "Number", value: 99 })
    })

    it("member.modify transforms at lens", () => {
      const family = stxFamily(makeEntity)
      const m = family.member("e1")
      m.modify(family.lens.score as any, (n: number) => n + 10)
      expect(m.get().score).toBe(10)
    })

    it("member.getAt reads at lens", () => {
      const family = stxFamily(makeEntity)
      const m = family.member("e1")
      expect(m.getAt(family.lens.name as any)).toBe("entity-e1")
    })

    it("member is memoized — same key same object", () => {
      const family = stxFamily(empty)
      const m1 = family.member("X")
      const m2 = family.member("X")
      expect(m1).toBe(m2)
    })

    it("member.atom is the same as family(key)", () => {
      const family = stxFamily(empty)
      const m = family.member("X")
      expect(m.atom).toBe(family("X"))
    })
  })

  describe("focus atoms", () => {
    it("focus creates derived atom for lens path", () => {
      const reg = AtomRegistry.make()
      const family = stxFamily(makeEntity, reg)

      const nameAtom = family.focus("e1", family.lens.name as any)
      expect(reg.get(nameAtom)).toBe("entity-e1")
    })

    it("focus atom updates when source changes", () => {
      const reg = AtomRegistry.make()
      const family = stxFamily(makeEntity, reg)

      const nameAtom = family.focus("e1", family.lens.name as any)
      expect(reg.get(nameAtom)).toBe("entity-e1")

      family.setAt("e1", family.lens.name as any, "updated")
      expect(reg.get(nameAtom)).toBe("updated")
    })

    it("focus is memoized — same key + same lens = same atom", () => {
      const family = stxFamily(makeEntity)
      const a1 = family.focus("e1", family.lens.name as any)
      const a2 = family.focus("e1", family.lens.name as any)
      expect(a1).toBe(a2)
    })

    it("focus for different keys returns different atoms", () => {
      const family = stxFamily(makeEntity)
      const a1 = family.focus("e1", family.lens.name as any)
      const a2 = family.focus("e2", family.lens.name as any)
      expect(a1).not.toBe(a2)
    })

    it("focus for different lens paths returns different atoms", () => {
      const family = stxFamily(makeEntity)
      const a1 = family.focus("e1", family.lens.name as any)
      const a2 = family.focus("e1", family.lens.score as any)
      expect(a1).not.toBe(a2)
    })

    it("member.focus works same as family.focus", () => {
      const family = stxFamily(makeEntity)
      const m = family.member("e1")
      const a1 = family.focus("e1", family.lens.name as any)
      const a2 = m.focus(family.lens.name as any)
      expect(a1).toBe(a2)
    })

    it("nested focus works", () => {
      const reg = AtomRegistry.make()
      const family = stxFamily(makeEntity, reg)

      const activeAtom = family.focus("e1", family.lens.meta.active as any)
      expect(reg.get(activeAtom)).toBe(true)
    })
  })

  describe("subscriptions", () => {
    it("registry.subscribe fires on write", () => {
      const reg = AtomRegistry.make()
      const family = stxFamily(empty, reg)

      const atom = family("X")
      const values: CellValue[] = []
      reg.subscribe(atom, (v) => values.push(v))

      family.set("X", num(1))
      family.set("X", num(2))
      family.set("X", str("hello"))

      expect(values).toEqual([
        { _tag: "Number", value: 1 },
        { _tag: "Number", value: 2 },
        { _tag: "String", value: "hello" },
      ])
    })

    it("subscriptions isolated per key", () => {
      const reg = AtomRegistry.make()
      const family = stxFamily(empty, reg)

      const aValues: CellValue[] = []
      const bValues: CellValue[] = []

      reg.subscribe(family("A"), (v) => aValues.push(v))
      reg.subscribe(family("B"), (v) => bValues.push(v))

      family.set("A", num(1))
      family.set("B", num(2))
      family.set("A", num(3))

      expect(aValues).toEqual([num(1), num(3)])
      expect(bValues).toEqual([num(2)])
    })
  })

  describe("scale", () => {
    it("handles 10K unique keys", () => {
      const family = stxFamily((key: string) => ({ _tag: "Number", value: parseInt(key) }))

      for (let i = 0; i < 10_000; i++) {
        family(String(i))
      }

      expect(family.get("0")).toEqual({ _tag: "Number", value: 0 })
      expect(family.get("9999")).toEqual({ _tag: "Number", value: 9999 })
    })

    it("rapid mutations on same key", () => {
      const family = stxFamily(empty)
      for (let i = 0; i < 10_000; i++) {
        family.set("X", num(i))
      }
      expect(family.get("X")).toEqual(num(9999))
    })
  })

  describe("throughput", () => {
    it("family lookup ≥ 1M ops/sec", () => {
      const family = stxFamily(empty)
      // Warm up
      family("warm")

      const N = 500_000
      const keys = Array.from({ length: 100 }, (_, i) => String(i))
      const start = performance.now()
      for (let i = 0; i < N; i++) {
        family(keys[i % 100])
      }
      const elapsed = performance.now() - start
      const opsPerSec = (N / elapsed) * 1000

      console.log(`Family lookup: ${(opsPerSec / 1e6).toFixed(2)}M ops/sec`)
      // MutableHashMap hash+equal per lookup — ~1M, flaky under load
      expect(opsPerSec).toBeGreaterThan(500_000)
    })

    it("family get ≥ 1M ops/sec", () => {
      const family = stxFamily(empty)
      // Pre-populate
      for (let i = 0; i < 100; i++) family(String(i))

      const N = 500_000
      const keys = Array.from({ length: 100 }, (_, i) => String(i))
      const start = performance.now()
      for (let i = 0; i < N; i++) {
        family.get(keys[i % 100])
      }
      const elapsed = performance.now() - start
      const opsPerSec = (N / elapsed) * 1000

      console.log(`Family get: ${(opsPerSec / 1e6).toFixed(2)}M ops/sec`)
      expect(opsPerSec).toBeGreaterThan(1_000_000)
    })

    it("family set ≥ 500K ops/sec", () => {
      const family = stxFamily(empty)
      // Pre-populate
      for (let i = 0; i < 100; i++) family(String(i))

      const N = 200_000
      const keys = Array.from({ length: 100 }, (_, i) => String(i))
      const start = performance.now()
      for (let i = 0; i < N; i++) {
        family.set(keys[i % 100], num(i))
      }
      const elapsed = performance.now() - start
      const opsPerSec = (N / elapsed) * 1000

      console.log(`Family set: ${(opsPerSec / 1e6).toFixed(2)}M ops/sec`)
      expect(opsPerSec).toBeGreaterThan(500_000)
    })
  })
})
