/**
 * Renderer Registry + Leaf/Composite Renderer Tests
 *
 * Tests that:
 * 1. All 11 tags have registered renderers
 * 2. Each renderer produces non-empty string[] output
 * 3. Output respects width constraints
 * 4. Notes are appended by registry (not by renderer)
 * 5. Composites recurse correctly
 *
 * @module
 */

import { describe, it, expect, beforeAll } from 'vitest'
import type { Theme } from '@mariozechner/pi-coding-agent'

// Import barrel to trigger side-effect registration
import {
  ALL_TAGS,
  hasRenderer,
  renderPrimitive,
  tryRenderPrimitive,
  isPrimitive,
  type Primitive,
  type Tbl, type Kv, type Ls, type Tree, type Code, type Diff, type Bar, type Tag, type Txt,
  type Stk, type Row,
  type Note, type Color,
} from '../../../../.pi/extensions/metaskill/primitives/index.ts'

// ─── Mock Theme ──────────────────────────────────────────

const mockTheme: Theme = {
  fg: (_color: string, text: string) => text,
  bg: (_color: string, text: string) => text,
  bold: (text: string) => text,
  dim: (text: string) => text,
  italic: (text: string) => text,
  underline: (text: string) => text,
  strikethrough: (text: string) => text,
} as Theme

// ─── Fixtures ────────────────────────────────────────────

const fixtures: Record<string, Primitive> = {
  tbl: { _v: 'tbl', d: [{ name: 'a', level: 3 }, { name: 'b', level: 2 }] } as Tbl,
  kv: { _v: 'kv', d: { total: 72, stale: 0, clean: true } } as Kv,
  ls: { _v: 'ls', d: ['alpha', 'beta', 'gamma'] } as Ls,
  tree: { _v: 'tree', d: { root: { child1: 'leaf', child2: { nested: 'deep' } } } } as Tree,
  code: { _v: 'code', d: 'const x = 1;\nconst y = 2;', lang: 'javascript' } as Code,
  diff: { _v: 'diff', a: 'hello\nworld', b: 'hello\nearth' } as Diff,
  bar: { _v: 'bar', v: 3, max: 10, label: 'progress' } as Bar,
  tag: { _v: 'tag', text: 'CLEAN', color: 'success' as Color } as Tag,
  txt: { _v: 'txt', d: 'Hello world\nSecond line' } as Txt,
  stk: {
    _v: 'stk',
    items: [
      { _v: 'tag', text: 'OK' } as Tag,
      { _v: 'txt', d: 'Below' } as Txt,
    ],
    gap: 1,
  } as Stk,
  row: {
    _v: 'row',
    items: [
      { _v: 'kv', d: { a: 1 } } as Kv,
      { _v: 'tag', text: 'OK' } as Tag,
    ],
    weights: [2, 1],
  } as Row,
}

// ─── Registration ────────────────────────────────────────

describe('renderer registration', () => {
  it('all 11 tags have registered renderers', () => {
    for (const tag of ALL_TAGS) {
      expect(hasRenderer(tag), `renderer for ${tag}`).toBe(true)
    }
  })
})

// ─── Leaf Renderers ──────────────────────────────────────

describe('leaf renderers', () => {
  const width = 100

  it.each(['tbl', 'kv', 'ls', 'tree', 'code', 'diff', 'bar', 'tag', 'txt'] as const)(
    '%s produces non-empty output',
    (tag) => {
      const prim = fixtures[tag]
      const lines = renderPrimitive(prim, width, mockTheme)
      expect(lines.length).toBeGreaterThan(0)
      expect(lines.every(l => typeof l === 'string')).toBe(true)
    },
  )

  it('tbl renders all rows', () => {
    const prim = fixtures.tbl as Tbl
    const lines = renderPrimitive(prim, 120, mockTheme)
    // Should have header + divider + 2 data rows = 4 lines minimum
    expect(lines.length).toBeGreaterThanOrEqual(4)
  })

  it('kv renders all entries', () => {
    const prim = fixtures.kv as Kv
    const lines = renderPrimitive(prim, 100, mockTheme)
    expect(lines.length).toBeGreaterThanOrEqual(3) // total, stale, clean
  })

  it('ls renders numbered items', () => {
    const prim = fixtures.ls as Ls
    const lines = renderPrimitive(prim, 100, mockTheme)
    expect(lines.length).toBe(3)
    expect(lines[0]).toContain('1')
    expect(lines[0]).toContain('alpha')
  })

  it('tree renders nested structure', () => {
    const prim = fixtures.tree as Tree
    const lines = renderPrimitive(prim, 100, mockTheme)
    expect(lines.length).toBeGreaterThanOrEqual(3) // root + children
  })

  it('bar renders progress bar', () => {
    const prim = fixtures.bar as Bar
    const lines = renderPrimitive(prim, 80, mockTheme)
    expect(lines.length).toBe(1)
    expect(lines[0]).toContain('3/10')
    expect(lines[0]).toContain('30%')
  })

  it('tag renders badge', () => {
    const prim = fixtures.tag as Tag
    const lines = renderPrimitive(prim, 80, mockTheme)
    expect(lines.length).toBe(1)
    expect(lines[0]).toContain('CLEAN')
  })

  it('txt renders lines', () => {
    const prim = fixtures.txt as Txt
    const lines = renderPrimitive(prim, 80, mockTheme)
    expect(lines.length).toBe(2)
    expect(lines[0]).toContain('Hello world')
  })

  it('diff renders unified at narrow width', () => {
    const prim = fixtures.diff as Diff
    const lines = renderPrimitive(prim, 60, mockTheme) // Below 80 → unified
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.some(l => l.includes('---') || l.includes('+++'))).toBe(true)
  })

  it('diff renders side-by-side at wide width', () => {
    const prim = fixtures.diff as Diff
    const lines = renderPrimitive(prim, 120, mockTheme) // Above 80 → side-by-side
    expect(lines.length).toBeGreaterThan(0)
  })
})

// ─── Note Threading ──────────────────────────────────────

describe('note threading', () => {
  it('note is appended to output when present', () => {
    const prim: Tbl = {
      _v: 'tbl',
      d: [{ x: 1 }],
      note: ['📊', 'Stats summary'] as Note,
    }
    const lines = renderPrimitive(prim, 100, mockTheme)
    const lastLine = lines[lines.length - 1]
    expect(lastLine).toContain('📊')
    expect(lastLine).toContain('Stats summary')
  })

  it('no note → no extra line appended', () => {
    const prim: Tag = { _v: 'tag', text: 'OK' }
    const lines = renderPrimitive(prim, 100, mockTheme)
    expect(lines.length).toBe(1) // Just the badge, no note
  })
})

// ─── Composite Renderers ─────────────────────────────────

describe('composite renderers', () => {
  it('stk renders children vertically with gap', () => {
    const prim = fixtures.stk as Stk
    const lines = renderPrimitive(prim, 100, mockTheme)
    expect(lines.length).toBeGreaterThanOrEqual(3) // tag + gap + txt
  })

  it('row renders children side-by-side at wide width', () => {
    const prim = fixtures.row as Row
    const lines = renderPrimitive(prim, 120, mockTheme)
    expect(lines.length).toBeGreaterThan(0)
  })

  it('row collapses to stack at narrow width', () => {
    const prim: Row = {
      _v: 'row',
      items: [
        { _v: 'tag', text: 'A' } as Tag,
        { _v: 'tag', text: 'B' } as Tag,
      ],
    }
    const lines = renderPrimitive(prim, 30, mockTheme) // Below threshold
    // Should still render both items (collapsed to stack)
    expect(lines.some(l => l.includes('A'))).toBe(true)
    expect(lines.some(l => l.includes('B'))).toBe(true)
  })

  it('nested composites render recursively', () => {
    const nested: Stk = {
      _v: 'stk',
      items: [
        {
          _v: 'row',
          items: [
            { _v: 'tag', text: 'LEFT' } as Tag,
            { _v: 'tag', text: 'RIGHT' } as Tag,
          ],
        } as Row,
        { _v: 'bar', v: 5, max: 10 } as Bar,
      ],
    }
    const lines = renderPrimitive(nested, 120, mockTheme)
    expect(lines.some(l => l.includes('LEFT') || l.includes('RIGHT'))).toBe(true)
    expect(lines.some(l => l.includes('5/10'))).toBe(true)
  })
})

// ─── tryRenderPrimitive ──────────────────────────────────

describe('tryRenderPrimitive', () => {
  it('returns lines for a valid primitive', () => {
    const result = tryRenderPrimitive({ _v: 'tag', text: 'OK' }, 80, mockTheme)
    expect(result).not.toBeNull()
    expect(result!.length).toBeGreaterThan(0)
  })

  it('returns null for non-primitives', () => {
    expect(tryRenderPrimitive({ name: 'plain' }, 80, mockTheme)).toBeNull()
    expect(tryRenderPrimitive('string', 80, mockTheme)).toBeNull()
    expect(tryRenderPrimitive(42, 80, mockTheme)).toBeNull()
    expect(tryRenderPrimitive(null, 80, mockTheme)).toBeNull()
  })
})

// ─── Width Sweep ─────────────────────────────────────────

describe('width sweep — no crashes at any width', () => {
  const widths = [20, 40, 60, 80, 100, 120, 200]

  for (const [tag, prim] of Object.entries(fixtures)) {
    it.each(widths)(`${tag} renders at width=%i without crashing`, (w) => {
      const lines = renderPrimitive(prim, w, mockTheme)
      expect(Array.isArray(lines)).toBe(true)
      expect(lines.every(l => typeof l === 'string')).toBe(true)
    })
  }
})

// ─── Empty Data ──────────────────────────────────────────

describe('empty data handling', () => {
  it('empty tbl', () => {
    const lines = renderPrimitive({ _v: 'tbl', d: [] } as Tbl, 80, mockTheme)
    expect(lines.length).toBeGreaterThan(0)
  })

  it('empty kv', () => {
    const lines = renderPrimitive({ _v: 'kv', d: {} } as Kv, 80, mockTheme)
    expect(lines.length).toBeGreaterThan(0)
  })

  it('empty ls', () => {
    const lines = renderPrimitive({ _v: 'ls', d: [] } as Ls, 80, mockTheme)
    expect(lines.length).toBeGreaterThan(0)
  })

  it('empty code', () => {
    const lines = renderPrimitive({ _v: 'code', d: '' } as Code, 80, mockTheme)
    expect(lines.length).toBeGreaterThan(0)
  })

  it('empty txt', () => {
    const lines = renderPrimitive({ _v: 'txt', d: '' } as Txt, 80, mockTheme)
    expect(lines.length).toBeGreaterThan(0)
  })

  it('empty stk', () => {
    const lines = renderPrimitive({ _v: 'stk', items: [] } as Stk, 80, mockTheme)
    expect(lines).toEqual([])
  })

  it('empty row', () => {
    const lines = renderPrimitive({ _v: 'row', items: [] } as Row, 80, mockTheme)
    expect(lines).toEqual([])
  })
})
