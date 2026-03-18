/**
 * Primitive Type System — Unit + Conformance Tests
 *
 * Tests the discriminated union types, type guards, extractLlmContent(),
 * and the reserved-key conformance checker.
 *
 * Core invariant under test: The LLM sees ZERO rendering metadata.
 *
 * @module
 */

import { describe, it, expect } from 'vitest'
import {
  type Primitive, type Leaf, type Composite, type Note, type Color,
  type Tbl, type Kv, type Ls, type Tree, type Code, type Diff, type Bar, type Tag, type Txt, type Md,
  type Stk, type Row,
  LEAF_TAGS, COMPOSITE_TAGS, ALL_TAGS, RESERVED_KEYS,
  isPrimitive, isLeaf, isComposite,
  extractLlmContent, findReservedKeys,
} from '../src/primitives/types.js'

// ─── Fixtures ────────────────────────────────────────────

const fixtures = {
  tbl: { _v: 'tbl', d: [{ name: 'a', level: 3 }, { name: 'b', level: 2 }] } as Tbl,
  kv: { _v: 'kv', d: { total: 72, stale: 0 } } as Kv,
  ls: { _v: 'ls', d: ['alpha', 'beta', 'gamma'] } as Ls,
  tree: { _v: 'tree', d: { root: { child: {} } } } as Tree,
  code: { _v: 'code', d: 'const x = 1', lang: 'typescript' } as Code,
  diff: { _v: 'diff', a: 'hello', b: 'world' } as Diff,
  bar: { _v: 'bar', v: 3, max: 71, label: 'complete' } as Bar,
  barNoLabel: { _v: 'bar', v: 5, max: 10 } as Bar,
  tag: { _v: 'tag', text: 'CLEAN', color: 'success' as Color } as Tag,
  txt: { _v: 'txt', d: 'Some plain text', color: 'accent' as Color } as Txt,
  md: { _v: 'md', text: '# Title\n\nSome **bold** text.' } as Md,
  stk: {
    _v: 'stk',
    items: [
      { _v: 'bar', v: 3, max: 71 } as Bar,
      { _v: 'tbl', d: [{ name: 'a' }] } as Tbl,
    ],
    gap: 1,
  } as Stk,
  row: {
    _v: 'row',
    items: [
      { _v: 'kv', d: { x: 1 } } as Kv,
      { _v: 'tag', text: 'OK' } as Tag,
    ],
    weights: [2, 1],
  } as Row,

  // With metadata
  tblWithNote: { _v: 'tbl', d: [{ a: 1 }], note: ['📊', 'stats'] as Note, flex: 2 } as Tbl,
  kvWithFlex: { _v: 'kv', d: { total: 42 }, flex: 3 } as Kv,
  tagWithColor: { _v: 'tag', text: 'WARN', color: 'warning' as Color, flex: 1 } as Tag,
} as const

// ─── Tag Constants ───────────────────────────────────────

describe('Tag constants', () => {
  it('LEAF_TAGS has exactly 9 entries', () => {
    expect(LEAF_TAGS).toHaveLength(10)
  })

  it('COMPOSITE_TAGS has exactly 2 entries', () => {
    expect(COMPOSITE_TAGS).toHaveLength(2)
  })

  it('ALL_TAGS = LEAF_TAGS + COMPOSITE_TAGS', () => {
    expect(ALL_TAGS).toHaveLength(12)
    expect([...ALL_TAGS]).toEqual([...LEAF_TAGS, ...COMPOSITE_TAGS])
  })

  it('RESERVED_KEYS lists all TUI metadata keys', () => {
    const expected = ['_v', 'note', 'flex', 'color', 'gap', 'weights', 'lang', 'items']
    expect([...RESERVED_KEYS]).toEqual(expected)
  })
})

// ─── Type Guards ─────────────────────────────────────────

describe('isPrimitive', () => {
  it.each(Object.entries(fixtures))('recognizes %s as primitive', (_name, prim) => {
    expect(isPrimitive(prim)).toBe(true)
  })

  it('rejects null', () => expect(isPrimitive(null)).toBe(false))
  it('rejects undefined', () => expect(isPrimitive(undefined)).toBe(false))
  it('rejects numbers', () => expect(isPrimitive(42)).toBe(false))
  it('rejects strings', () => expect(isPrimitive('hello')).toBe(false))
  it('rejects arrays', () => expect(isPrimitive([1, 2, 3])).toBe(false))
  it('rejects plain objects', () => expect(isPrimitive({ name: 'x' })).toBe(false))
  it('rejects objects with unknown _v', () => expect(isPrimitive({ _v: 'unknown' })).toBe(false))
  it('rejects objects with non-string _v', () => expect(isPrimitive({ _v: 42 })).toBe(false))
})

describe('isLeaf', () => {
  it.each(LEAF_TAGS.map(t => [t]))('identifies %s as leaf', (tag) => {
    const prim = fixtures[tag as keyof typeof fixtures]
    if (prim && isPrimitive(prim)) {
      expect(isLeaf(prim as Primitive)).toBe(true)
    }
  })

  it('stk is not a leaf', () => expect(isLeaf(fixtures.stk)).toBe(false))
  it('row is not a leaf', () => expect(isLeaf(fixtures.row)).toBe(false))
})

describe('isComposite', () => {
  it('stk is composite', () => expect(isComposite(fixtures.stk)).toBe(true))
  it('row is composite', () => expect(isComposite(fixtures.row)).toBe(true))

  it.each(LEAF_TAGS.map(t => [t]))('%s is not composite', (tag) => {
    const prim = fixtures[tag as keyof typeof fixtures]
    if (prim && isPrimitive(prim)) {
      expect(isComposite(prim as Primitive)).toBe(false)
    }
  })
})

// ─── extractLlmContent ──────────────────────────────────

describe('extractLlmContent', () => {
  describe('backward compatibility', () => {
    it('passes through null', () => {
      expect(extractLlmContent(null)).toBe(null)
    })

    it('passes through undefined', () => {
      expect(extractLlmContent(undefined)).toBe(undefined)
    })

    it('passes through numbers', () => {
      expect(extractLlmContent(42)).toBe(42)
    })

    it('passes through strings', () => {
      expect(extractLlmContent('hello')).toBe('hello')
    })

    it('passes through booleans', () => {
      expect(extractLlmContent(true)).toBe(true)
    })

    it('passes through plain arrays', () => {
      const arr = [1, 2, 3]
      expect(extractLlmContent(arr)).toBe(arr)
    })

    it('passes through plain objects (no _v)', () => {
      const obj = { name: 'test', count: 42 }
      expect(extractLlmContent(obj)).toBe(obj)
    })

    it('passes through objects with unknown _v', () => {
      const obj = { _v: 'unknown', data: 'x' }
      expect(extractLlmContent(obj)).toBe(obj)
    })
  })

  describe('extraction correctness matrix', () => {
    it('tbl → returns d (array of records)', () => {
      const result = extractLlmContent(fixtures.tbl)
      expect(result).toEqual([{ name: 'a', level: 3 }, { name: 'b', level: 2 }])
    })

    it('kv → returns d (record)', () => {
      const result = extractLlmContent(fixtures.kv)
      expect(result).toEqual({ total: 72, stale: 0 })
    })

    it('ls → returns d (array)', () => {
      const result = extractLlmContent(fixtures.ls)
      expect(result).toEqual(['alpha', 'beta', 'gamma'])
    })

    it('tree → returns d (object)', () => {
      const result = extractLlmContent(fixtures.tree)
      expect(result).toEqual({ root: { child: {} } })
    })

    it('code → returns d (string)', () => {
      const result = extractLlmContent(fixtures.code)
      expect(result).toBe('const x = 1')
    })

    it('txt → returns d (string)', () => {
      const result = extractLlmContent(fixtures.txt)
      expect(result).toBe('Some plain text')
    })

    it('diff → returns { a, b }', () => {
      const result = extractLlmContent(fixtures.diff)
      expect(result).toEqual({ a: 'hello', b: 'world' })
    })

    it('bar with label → returns { v, max, label }', () => {
      const result = extractLlmContent(fixtures.bar)
      expect(result).toEqual({ v: 3, max: 71, label: 'complete' })
    })

    it('bar without label → returns { v, max } (no undefined key)', () => {
      const result = extractLlmContent(fixtures.barNoLabel)
      expect(result).toEqual({ v: 5, max: 10 })
      // CRITICAL: no undefined key pollution
      expect(Object.keys(result as object)).not.toContain('label')
    })

    it('tag → returns text string', () => {
      const result = extractLlmContent(fixtures.tag)
      expect(result).toBe('CLEAN')
    })
  })

  describe('composite extraction', () => {
    it('stk → recursively extracts items into array', () => {
      const result = extractLlmContent(fixtures.stk)
      expect(result).toEqual([
        { v: 3, max: 71 },           // bar extracted
        [{ name: 'a' }],             // tbl.d extracted
      ])
    })

    it('row → recursively extracts items into array', () => {
      const result = extractLlmContent(fixtures.row)
      expect(result).toEqual([
        { x: 1 },      // kv.d extracted
        'OK',           // tag.text extracted
      ])
    })

    it('stk items.length matches output array length', () => {
      const result = extractLlmContent(fixtures.stk) as unknown[]
      expect(result).toHaveLength(fixtures.stk.items.length)
    })

    it('row items.length matches output array length', () => {
      const result = extractLlmContent(fixtures.row) as unknown[]
      expect(result).toHaveLength(fixtures.row.items.length)
    })

    it('nested composites preserve nesting depth', () => {
      const nested: Stk = {
        _v: 'stk',
        items: [
          {
            _v: 'row',
            items: [
              { _v: 'tag', text: 'inner' } as Tag,
              { _v: 'bar', v: 1, max: 10 } as Bar,
            ],
          } as Row,
          { _v: 'txt', d: 'leaf' } as Txt,
        ],
      }
      const result = extractLlmContent(nested) as unknown[]
      expect(result).toHaveLength(2)
      // First item is the row extraction (array)
      expect(result[0]).toEqual(['inner', { v: 1, max: 10 }])
      // Second item is the txt extraction (string)
      expect(result[1]).toBe('leaf')
    })

    it('stk/row never flatten nested arrays', () => {
      const deep: Stk = {
        _v: 'stk',
        items: [
          { _v: 'stk', items: [{ _v: 'tag', text: 'a' } as Tag] } as Stk,
          { _v: 'tag', text: 'b' } as Tag,
        ],
      }
      const result = extractLlmContent(deep) as unknown[]
      // Outer stk → array of 2
      expect(result).toHaveLength(2)
      // Inner stk → array of 1 (NOT flattened into outer)
      expect(result[0]).toEqual(['a'])
      expect(result[1]).toBe('b')
    })
  })

  describe('metadata stripping', () => {
    it('tbl with note + flex → note and flex stripped', () => {
      const result = extractLlmContent(fixtures.tblWithNote)
      expect(result).toEqual([{ a: 1 }])
      // Result is the .d value, which has no note/flex
    })

    it('kv with flex → flex stripped', () => {
      const result = extractLlmContent(fixtures.kvWithFlex)
      expect(result).toEqual({ total: 42 })
    })

    it('tag with color + flex → only text returned', () => {
      const result = extractLlmContent(fixtures.tagWithColor)
      expect(result).toBe('WARN')
    })
  })
})

// ─── findReservedKeys (conformance checker) ──────────────

describe('findReservedKeys', () => {
  it('clean object returns empty array', () => {
    expect(findReservedKeys({ name: 'test', count: 42 })).toEqual([])
  })

  it('detects _v at top level', () => {
    expect(findReservedKeys({ _v: 'tbl', data: 1 })).toContain('_v')
  })

  it('detects note at top level', () => {
    expect(findReservedKeys({ note: ['📊', 'hi'] })).toContain('note')
  })

  it('detects flex at top level', () => {
    expect(findReservedKeys({ flex: 2 })).toContain('flex')
  })

  it('detects reserved keys in nested objects', () => {
    const violations = findReservedKeys({ outer: { _v: 'leaked' } })
    expect(violations).toContain('outer._v')
  })

  it('detects reserved keys in arrays', () => {
    const violations = findReservedKeys([{ _v: 'leaked' }])
    expect(violations).toContain('[0]._v')
  })

  it('detects all reserved keys', () => {
    const obj: Record<string, unknown> = {}
    for (const key of RESERVED_KEYS) {
      obj[key] = 'some value'
    }
    const violations = findReservedKeys(obj)
    for (const key of RESERVED_KEYS) {
      expect(violations).toContain(key)
    }
  })

  it('returns empty for primitives', () => {
    expect(findReservedKeys(42)).toEqual([])
    expect(findReservedKeys('hello')).toEqual([])
    expect(findReservedKeys(null)).toEqual([])
    expect(findReservedKeys(undefined)).toEqual([])
  })
})

// ─── LLM Content Conformance Matrix ─────────────────────
// Every primitive type must produce clean output with zero reserved keys.

describe('LLM content conformance', () => {
  const conformanceMatrix: Array<[string, Primitive]> = [
    ['tbl', fixtures.tbl],
    ['tbl (with note+flex)', fixtures.tblWithNote],
    ['kv', fixtures.kv],
    ['kv (with flex)', fixtures.kvWithFlex],
    ['ls', fixtures.ls],
    ['tree', fixtures.tree],
    ['code', fixtures.code],
    ['diff', fixtures.diff],
    ['bar (with label)', fixtures.bar],
    ['bar (no label)', fixtures.barNoLabel],
    ['tag', fixtures.tag],
    ['tag (with color+flex)', fixtures.tagWithColor],
    ['txt', fixtures.txt],
    ['md', fixtures.md],
    ['stk', fixtures.stk],
    ['row', fixtures.row],
  ]

  it.each(conformanceMatrix)('%s → zero reserved keys in output', (_label, prim) => {
    const extracted = extractLlmContent(prim)
    const violations = findReservedKeys(extracted)
    expect(violations).toEqual([])
  })

  it.each(conformanceMatrix)('%s → output is valid JSON', (_label, prim) => {
    const extracted = extractLlmContent(prim)
    // Should round-trip through JSON without error
    const json = JSON.stringify(extracted)
    expect(() => JSON.parse(json)).not.toThrow()
  })

  it.each(conformanceMatrix)('%s → output never contains undefined', (_label, prim) => {
    const extracted = extractLlmContent(prim)
    const json = JSON.stringify(extracted)
    expect(json).not.toContain('undefined')
  })

  it('extractLlmContent is deterministic', () => {
    for (const [_name, prim] of conformanceMatrix) {
      const a = JSON.stringify(extractLlmContent(prim))
      const b = JSON.stringify(extractLlmContent(prim))
      expect(a).toBe(b)
    }
  })
})

// ─── Property-Based (Structural Invariants) ──────────────

describe('structural invariants', () => {
  it('every ALL_TAGS entry has a fixture', () => {
    // Ensure our test coverage is complete
    const coveredTags = new Set<string>()
    for (const [_name, prim] of Object.entries(fixtures)) {
      if (isPrimitive(prim)) coveredTags.add(prim._v)
    }
    for (const tag of ALL_TAGS) {
      expect(coveredTags.has(tag)).toBe(true)
    }
  })

  it('composite items.length always equals extracted array length', () => {
    const composites = [fixtures.stk, fixtures.row]
    for (const comp of composites) {
      const extracted = extractLlmContent(comp) as unknown[]
      expect(Array.isArray(extracted)).toBe(true)
      expect(extracted.length).toBe(comp.items.length)
    }
  })

  it('extractLlmContent output type matches expected shape per tag', () => {
    // tbl → array
    expect(Array.isArray(extractLlmContent(fixtures.tbl))).toBe(true)
    // kv → object (not array)
    const kvResult = extractLlmContent(fixtures.kv)
    expect(typeof kvResult).toBe('object')
    expect(Array.isArray(kvResult)).toBe(false)
    // ls → array
    expect(Array.isArray(extractLlmContent(fixtures.ls))).toBe(true)
    // tree → object
    expect(typeof extractLlmContent(fixtures.tree)).toBe('object')
    // code → string
    expect(typeof extractLlmContent(fixtures.code)).toBe('string')
    // txt → string
    expect(typeof extractLlmContent(fixtures.txt)).toBe('string')
    // diff → object with a, b
    const diffResult = extractLlmContent(fixtures.diff) as { a: string; b: string }
    expect(typeof diffResult).toBe('object')
    expect(diffResult).toHaveProperty('a')
    expect(diffResult).toHaveProperty('b')
    // bar → object with v, max
    const barResult = extractLlmContent(fixtures.bar) as { v: number; max: number }
    expect(typeof barResult).toBe('object')
    expect(barResult).toHaveProperty('v')
    expect(barResult).toHaveProperty('max')
    // tag → string
    expect(typeof extractLlmContent(fixtures.tag)).toBe('string')
    // stk → array
    expect(Array.isArray(extractLlmContent(fixtures.stk))).toBe(true)
    // row → array
    expect(Array.isArray(extractLlmContent(fixtures.row))).toBe(true)
  })

  it('no phantom nesting — leaf extraction never returns array-of-array', () => {
    for (const tag of LEAF_TAGS) {
      const prim = fixtures[tag as keyof typeof fixtures]
      if (!prim || !isPrimitive(prim)) continue
      const result = extractLlmContent(prim)
      if (Array.isArray(result)) {
        // If a leaf returns an array, elements should not themselves be arrays
        // (unless the data genuinely contains arrays, which is fine)
        // The point: extraction doesn't wrap in extra array
        expect(result).toBe((prim as any).d)
      }
    }
  })
})
