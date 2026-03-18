/**
 * Flex Layout Engine — Unit + Property-Based Tests
 *
 * Tests the 3-pass yoga-like width distribution algorithm.
 * Every test asserts structural invariants (conservation, non-negative, etc.)
 *
 * @module
 */

import { describe, it, expect } from 'vitest'
import {
  flexLayout,
  MIN_COL,
  COLLAPSE_THRESHOLD,
  DEFAULT_GAP,
  type FlexChild,
} from '../src/primitives/flex.js'

// ─── Invariant Helpers ───────────────────────────────────

/**
 * Assert structural invariants on a flexLayout result.
 * Called after every successful (non-null) layout.
 */
function assertInvariants(
  widths: number[],
  children: FlexChild[],
  totalWidth: number,
  gap: number,
  label: string = '',
) {
  const n = children.length
  const prefix = label ? `[${label}] ` : ''

  // Conservation: sum(widths) + (n-1)*gap === totalWidth
  const contentSum = widths.reduce((s, w) => s + w, 0)
  const gapSum = Math.max(0, n - 1) * gap
  expect(contentSum + gapSum, `${prefix}conservation`).toBe(totalWidth)

  // Non-negative: no width is negative
  for (let i = 0; i < widths.length; i++) {
    expect(widths[i], `${prefix}non-negative [${i}]`).toBeGreaterThanOrEqual(0)
  }

  // Length matches children
  expect(widths.length, `${prefix}length`).toBe(n)
}

// ─── Constants ───────────────────────────────────────────

describe('constants', () => {
  it('MIN_COL is 8', () => expect(MIN_COL).toBe(8))
  it('COLLAPSE_THRESHOLD is 40', () => expect(COLLAPSE_THRESHOLD).toBe(40))
  it('DEFAULT_GAP is 2', () => expect(DEFAULT_GAP).toBe(2))
})

// ─── Edge Cases ──────────────────────────────────────────

describe('edge cases', () => {
  it('zero children → empty array', () => {
    const result = flexLayout([], 100)
    expect(result).toEqual([])
  })

  it('single child → full width', () => {
    const result = flexLayout([{ flex: 1 }], 100)
    expect(result).toEqual([100])
  })

  it('collapse: width below threshold → null', () => {
    const result = flexLayout([{ flex: 1 }, { flex: 1 }], COLLAPSE_THRESHOLD - 1)
    expect(result).toBeNull()
  })

  it('collapse: width = 1 → null', () => {
    expect(flexLayout([{ flex: 1 }], 1)).toBeNull()
  })

  it('boundary: width exactly at threshold → returns widths', () => {
    const result = flexLayout([{ flex: 1 }, { flex: 1 }], COLLAPSE_THRESHOLD)
    expect(result).not.toBeNull()
    assertInvariants(result!, [{}, {}], COLLAPSE_THRESHOLD, DEFAULT_GAP, 'boundary')
  })
})

// ─── Equal Flex ──────────────────────────────────────────

describe('equal flex distribution', () => {
  it('3 children, flex:1 each, width:120, gap:2', () => {
    const children: FlexChild[] = [{ flex: 1 }, { flex: 1 }, { flex: 1 }]
    const result = flexLayout(children, 120, 2)!
    assertInvariants(result, children, 120, 2, 'equal-3')

    // Available = 120 - 4 = 116. Each ~38.67 → 38, 38, 40 or similar
    // Just check they're roughly equal
    for (const w of result) {
      expect(w).toBeGreaterThanOrEqual(37)
      expect(w).toBeLessThanOrEqual(40)
    }
  })

  it('2 children, no flex specified (default 1), width:80, gap:0', () => {
    const children: FlexChild[] = [{}, {}]
    const result = flexLayout(children, 80, 0)!
    assertInvariants(result, children, 80, 0, 'equal-2-no-flex')
    expect(result[0]).toBe(40)
    expect(result[1]).toBe(40)
  })
})

// ─── Weighted Flex ───────────────────────────────────────

describe('weighted flex', () => {
  it('flex:1 + flex:2, width:90, gap:0 → [30, 60]', () => {
    const children: FlexChild[] = [{ flex: 1 }, { flex: 2 }]
    const result = flexLayout(children, 90, 0)!
    assertInvariants(result, children, 90, 0, 'weighted-1-2')
    expect(result[0]).toBe(30)
    expect(result[1]).toBe(60)
  })

  it('flex:1 + flex:3, width:100, gap:0 → [25, 75]', () => {
    const children: FlexChild[] = [{ flex: 1 }, { flex: 3 }]
    const result = flexLayout(children, 100, 0)!
    assertInvariants(result, children, 100, 0, 'weighted-1-3')
    expect(result[0]).toBe(25)
    expect(result[1]).toBe(75)
  })

  it('flex ordering: higher flex gets wider or equal', () => {
    const children: FlexChild[] = [{ flex: 1 }, { flex: 5 }, { flex: 2 }]
    const result = flexLayout(children, 120, 2)!
    assertInvariants(result, children, 120, 2, 'flex-ordering')
    expect(result[1]).toBeGreaterThanOrEqual(result[0])
    expect(result[1]).toBeGreaterThanOrEqual(result[2])
    expect(result[2]).toBeGreaterThanOrEqual(result[0])
  })
})

// ─── Min/Max Constraints ─────────────────────────────────

describe('constraints', () => {
  it('minW respected when budget allows', () => {
    const children: FlexChild[] = [
      { flex: 1, minW: 30 },
      { flex: 1, minW: 30 },
    ]
    const result = flexLayout(children, 100, 0)!
    assertInvariants(result, children, 100, 0, 'minW-basic')
    expect(result[0]).toBeGreaterThanOrEqual(30)
    expect(result[1]).toBeGreaterThanOrEqual(30)
  })

  it('maxW clamp: child cannot exceed maxW', () => {
    const children: FlexChild[] = [
      { flex: 1, maxW: 20 },
      { flex: 1 },
    ]
    const result = flexLayout(children, 100, 0)!
    assertInvariants(result, children, 100, 0, 'maxW-clamp')
    expect(result[0]).toBeLessThanOrEqual(20)
    // Remainder goes to second child
    expect(result[1]).toBe(80)
  })

  it('maxW redistribution: clamped child surplus goes to unclamped', () => {
    const children: FlexChild[] = [
      { flex: 1, maxW: 20 },
      { flex: 1 },
      { flex: 1 },
    ]
    const result = flexLayout(children, 100, 0)!
    assertInvariants(result, children, 100, 0, 'maxW-redistribute')
    expect(result[0]).toBeLessThanOrEqual(20)
    expect(result[1] + result[2]).toBe(100 - result[0])
  })

  it('tight budget: 2 children, width:20, minW:8 each, gap:2', () => {
    const children: FlexChild[] = [
      { flex: 1, minW: 8 },
      { flex: 1, minW: 8 },
    ]
    const result = flexLayout(children, 40, 2)!
    assertInvariants(result, children, 40, 2, 'tight')
    expect(result[0]).toBeGreaterThanOrEqual(8)
    expect(result[1]).toBeGreaterThanOrEqual(8)
  })

  it('mixed constraints: 3 children with different min/max/flex', () => {
    const children: FlexChild[] = [
      { flex: 2, minW: 10, maxW: 50 },
      { flex: 1, minW: 15 },
      { flex: 3, maxW: 40 },
    ]
    const result = flexLayout(children, 120, 2)!
    assertInvariants(result, children, 120, 2, 'mixed')
    expect(result[0]).toBeGreaterThanOrEqual(10)
    expect(result[0]).toBeLessThanOrEqual(50)
    expect(result[1]).toBeGreaterThanOrEqual(15)
    expect(result[2]).toBeLessThanOrEqual(40)
  })
})

// ─── Graceful Degradation ────────────────────────────────

describe('graceful degradation', () => {
  it('all children at minW and still overflows → proportional shrink', () => {
    // 3 children, minW:30 each, but only 60 total available (after gap)
    const children: FlexChild[] = [
      { flex: 1, minW: 30 },
      { flex: 1, minW: 30 },
      { flex: 1, minW: 30 },
    ]
    const result = flexLayout(children, 60, 0)!
    assertInvariants(result, children, 60, 0, 'overflow-shrink')
    // Each should get ~20 (proportional shrink below minW)
    for (const w of result) {
      expect(w).toBeGreaterThanOrEqual(0)
    }
  })

  it('pathological: flex:1000 + flex:1 → big gets almost everything', () => {
    const children: FlexChild[] = [{ flex: 1000 }, { flex: 1 }]
    const result = flexLayout(children, 100, 0)!
    assertInvariants(result, children, 100, 0, 'pathological-flex')
    expect(result[0]).toBeGreaterThan(90)
    expect(result[1]).toBeGreaterThanOrEqual(0)
  })
})

// ─── Stress Tests ────────────────────────────────────────

describe('stress', () => {
  it('20 children, width:200 → conservation holds', () => {
    const children: FlexChild[] = Array.from({ length: 20 }, (_, i) => ({
      flex: (i % 4) + 1,
    }))
    const result = flexLayout(children, 200, 1)!
    assertInvariants(result, children, 200, 1, 'stress-20')
  })

  it('8 children with mixed constraints, width:300', () => {
    const children: FlexChild[] = [
      { flex: 1, minW: 10 },
      { flex: 2, maxW: 50 },
      { flex: 3 },
      { flex: 1, minW: 20, maxW: 40 },
      { flex: 4 },
      { flex: 1, minW: 5 },
      { flex: 2, maxW: 100 },
      { flex: 1 },
    ]
    const result = flexLayout(children, 300, 2)!
    assertInvariants(result, children, 300, 2, 'stress-mixed')
  })
})

// ─── Determinism ─────────────────────────────────────────

describe('determinism', () => {
  it('same input → same output across multiple calls', () => {
    const children: FlexChild[] = [
      { flex: 2, minW: 10, maxW: 50 },
      { flex: 1, minW: 15 },
      { flex: 3, maxW: 40 },
    ]
    const a = flexLayout(children, 120, 2)
    const b = flexLayout(children, 120, 2)
    expect(a).toEqual(b)
  })
})

// ─── Property-Based Tests (Random Inputs) ────────────────

describe('property-based', () => {
  // Simple PRNG for deterministic random tests
  function* prng(seed: number) {
    let s = seed
    while (true) {
      s = (s * 1103515245 + 12345) & 0x7fffffff
      yield s
    }
  }

  function nextInt(gen: Generator<number>, min: number, max: number): number {
    const v = gen.next().value
    return min + (v % (max - min + 1))
  }

  function generateCase(gen: Generator<number>): {
    children: FlexChild[]
    totalWidth: number
    gap: number
  } {
    const n = nextInt(gen, 1, 8)
    const children: FlexChild[] = []
    for (let i = 0; i < n; i++) {
      const child: FlexChild = { flex: nextInt(gen, 1, 5) }
      if (nextInt(gen, 0, 1)) child.minW = nextInt(gen, 4, 20)
      if (nextInt(gen, 0, 1)) child.maxW = nextInt(gen, 30, 200)
      children.push(child)
    }
    return {
      children,
      totalWidth: nextInt(gen, COLLAPSE_THRESHOLD, 300),
      gap: nextInt(gen, 0, 4),
    }
  }

  const ITERATIONS = 200

  it(`conservation holds for ${ITERATIONS} random cases`, () => {
    const gen = prng(42)
    for (let i = 0; i < ITERATIONS; i++) {
      const { children, totalWidth, gap } = generateCase(gen)
      const result = flexLayout(children, totalWidth, gap)
      if (result === null) continue // collapsed
      const sum = result.reduce((s, w) => s + w, 0) + Math.max(0, result.length - 1) * gap
      expect(sum, `case ${i}`).toBe(totalWidth)
    }
  })

  it(`non-negative for ${ITERATIONS} random cases`, () => {
    const gen = prng(123)
    for (let i = 0; i < ITERATIONS; i++) {
      const { children, totalWidth, gap } = generateCase(gen)
      const result = flexLayout(children, totalWidth, gap)
      if (result === null) continue
      for (let j = 0; j < result.length; j++) {
        expect(result[j], `case ${i} child ${j}`).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it(`max-respect for ${ITERATIONS} random cases (multi-child only)`, () => {
    // maxW is only meaningful with multiple children — single child
    // must take full width to satisfy conservation invariant.
    const gen = prng(456)
    for (let i = 0; i < ITERATIONS; i++) {
      const { children, totalWidth, gap } = generateCase(gen)
      const result = flexLayout(children, totalWidth, gap)
      if (result === null) continue
      if (children.length <= 1) continue // conservation > maxW for single child
      for (let j = 0; j < result.length; j++) {
        if (children[j].maxW !== undefined) {
          expect(result[j], `case ${i} child ${j} maxW`).toBeLessThanOrEqual(children[j].maxW!)
        }
      }
    }
  })

  it(`deterministic for ${ITERATIONS} random cases`, () => {
    const gen = prng(789)
    for (let i = 0; i < ITERATIONS; i++) {
      const { children, totalWidth, gap } = generateCase(gen)
      const a = flexLayout(children, totalWidth, gap)
      const b = flexLayout(children, totalWidth, gap)
      expect(a, `case ${i}`).toEqual(b)
    }
  })

  it(`flex ordering for ${ITERATIONS} random cases (2 equal-constraint children)`, () => {
    const gen = prng(999)
    for (let i = 0; i < ITERATIONS; i++) {
      const flexA = nextInt(gen, 1, 5)
      const flexB = nextInt(gen, 1, 5)
      const children: FlexChild[] = [{ flex: flexA }, { flex: flexB }]
      const totalWidth = nextInt(gen, COLLAPSE_THRESHOLD, 200)
      const result = flexLayout(children, totalWidth, 0)
      if (result === null) continue
      if (flexA > flexB) {
        expect(result[0], `case ${i} flex ordering`).toBeGreaterThanOrEqual(result[1])
      } else if (flexB > flexA) {
        expect(result[1], `case ${i} flex ordering`).toBeGreaterThanOrEqual(result[0])
      }
    }
  })
})
