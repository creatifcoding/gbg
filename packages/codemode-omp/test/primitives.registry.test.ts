/**
 * Unit tests for the C1 primitive registry contract.
 *
 * Tests use `createPrimitiveRegistry()` with a minimal fake RenderContext.
 * No host packages (`@mariozechner/*`, `@oh-my-pi/*`) are imported.
 *
 * Covered behaviors:
 *   1. Two registry instances are isolated — they do not share renderer state.
 *   2. Unknown primitive emits a warning line via ctx.theme.fg('warning', ...).
 *   3. tryRenderPrimitive returns null for non-primitives.
 *   4. Lines exceeding width are clamped via ctx.text.truncateToWidth.
 *   5. Note fields are appended after renderer output via ctx.theme.fg('muted', ...).
 */

import { describe, it, expect } from 'vitest'
import type { RenderContext } from '../src/primitives/render-host.ts'
import type { Txt, Stk, Tag, Bar } from '../src/primitives/types.ts'
import { ALL_TAGS } from '../src/primitives/types.ts'
import { createPrimitiveRegistry } from '../src/primitives/registry.ts'
import { registerAllPrimitives } from '../src/primitives/index.ts'
import { registerStkRenderer } from '../src/primitives/renderers/stk.ts'

// ─── Minimal fake RenderContext ──────────────────────────────────────────────
//
// theme.fg(color, text) → `${color}(${text})` — lets assertions check color.
// text.visibleWidth(s)  → s.length             — no ANSI concerns in unit tests.
// text.truncateToWidth  → s.slice(0, w)        — pure slice, predictable.
// code.highlight        → identity             — irrelevant to registry tests.

function makeCtx(): RenderContext {
  return {
    theme: {
      fg(color: string, text: string): string {
        return `${color}(${text})`
      },
    },
    text: {
      visibleWidth(text: string): number {
        return text.length
      },
      truncateToWidth(text: string, width: number): string {
        return text.slice(0, width)
      },
    },
    code: {
      highlight(code: string, _lang: string): string[] {
        return [code]
      },
    },
  }
}

// ─── Minimal fake primitives ──────────────────────────────────────────────────

const txtPrim: Txt = { _v: 'txt', d: 'hello' }
const txtWithNote: Txt = { _v: 'txt', d: 'hello', note: ['📌', 'my note'] }

// ─── 1. Registry isolation ────────────────────────────────────────────────────

describe('createPrimitiveRegistry — isolation', () => {
  it('two instances do not share renderers — registering in r1 does not affect r2', () => {
    const r1 = createPrimitiveRegistry()
    const r2 = createPrimitiveRegistry()
    r1.register('txt', (_p, _w, _c) => ['from r1'])
    expect(r1.hasRenderer('txt')).toBe(true)
    expect(r2.hasRenderer('txt')).toBe(false)
  })

  it('registering in r2 does not affect r1', () => {
    const r1 = createPrimitiveRegistry()
    const r2 = createPrimitiveRegistry()
    r2.register('kv', (_p, _w, _c) => ['from r2'])
    expect(r2.hasRenderer('kv')).toBe(true)
    expect(r1.hasRenderer('kv')).toBe(false)
  })

  it('getRenderer returns undefined on the sibling that did not register', () => {
    const r1 = createPrimitiveRegistry()
    const r2 = createPrimitiveRegistry()
    r1.register('ls', (_p, _w, _c) => ['ls output'])
    expect(r1.getRenderer('ls')).toBeDefined()
    expect(r2.getRenderer('ls')).toBeUndefined()
  })
})

// ─── 2. Unknown primitive warning ─────────────────────────────────────────────

describe('renderPrimitive — unknown renderer warning', () => {
  it('returns a single warning line when no renderer is registered', () => {
    const r = createPrimitiveRegistry()
    const ctx = makeCtx()
    // No renderer registered for 'txt' — fresh registry is empty
    const lines = r.renderPrimitive(txtPrim, 80, ctx)
    expect(lines).toHaveLength(1)
  })

  it('warning line contains the primitive tag name', () => {
    const r = createPrimitiveRegistry()
    const ctx = makeCtx()
    const lines = r.renderPrimitive(txtPrim, 80, ctx)
    expect(lines[0]).toContain('txt')
  })

  it('warning line contains "unknown primitive" text', () => {
    const r = createPrimitiveRegistry()
    const ctx = makeCtx()
    const lines = r.renderPrimitive(txtPrim, 80, ctx)
    expect(lines[0]).toContain('unknown primitive')
  })

  it('warning line is produced via ctx.theme.fg with "warning" color', () => {
    const r = createPrimitiveRegistry()
    const ctx = makeCtx()
    const lines = r.renderPrimitive(txtPrim, 80, ctx)
    // Fake fg produces `warning(...)` — color prefix must be present
    expect(lines[0]).toMatch(/^warning\(/)
  })
})

// ─── 3. tryRenderPrimitive — non-primitive guard ───────────────────────────────

describe('tryRenderPrimitive — returns null for non-primitives', () => {
  it('returns null for a plain string', () => {
    const r = createPrimitiveRegistry()
    const ctx = makeCtx()
    expect(r.tryRenderPrimitive('hello', 80, ctx)).toBeNull()
  })

  it('returns null for a number', () => {
    const r = createPrimitiveRegistry()
    const ctx = makeCtx()
    expect(r.tryRenderPrimitive(42, 80, ctx)).toBeNull()
  })

  it('returns null for null', () => {
    const r = createPrimitiveRegistry()
    const ctx = makeCtx()
    expect(r.tryRenderPrimitive(null, 80, ctx)).toBeNull()
  })

  it('returns null for an object with an unrecognised _v tag', () => {
    const r = createPrimitiveRegistry()
    const ctx = makeCtx()
    expect(r.tryRenderPrimitive({ _v: 'not-a-primitive-tag' }, 80, ctx)).toBeNull()
  })

  it('returns null for a plain object without _v', () => {
    const r = createPrimitiveRegistry()
    const ctx = makeCtx()
    expect(r.tryRenderPrimitive({ d: 'data' }, 80, ctx)).toBeNull()
  })

  it('returns a string[] (not null) for a valid registered primitive', () => {
    const r = createPrimitiveRegistry()
    const ctx = makeCtx()
    r.register('txt', (_p, _w, _c) => ['rendered'])
    const result = r.tryRenderPrimitive(txtPrim, 80, ctx)
    expect(result).not.toBeNull()
    expect(result).toEqual(['rendered'])
  })
})

// ─── 4. Line width safety clamp ───────────────────────────────────────────────

describe('renderPrimitive — width safety clamp', () => {
  it('truncates a renderer output line that exceeds width', () => {
    const r = createPrimitiveRegistry()
    const ctx = makeCtx()
    // Renderer returns a 20-char line, but width is 5
    r.register('txt', (_p, _w, _c) => ['01234567890123456789'])
    const lines = r.renderPrimitive(txtPrim, 5, ctx)
    expect(lines[0]).toHaveLength(5)
    expect(lines[0]).toBe('01234')
  })

  it('does not truncate lines that fit within width', () => {
    const r = createPrimitiveRegistry()
    const ctx = makeCtx()
    r.register('txt', (_p, _w, _c) => ['short'])
    const lines = r.renderPrimitive(txtPrim, 80, ctx)
    expect(lines[0]).toBe('short')
  })

  it('clamps multiple lines independently', () => {
    const r = createPrimitiveRegistry()
    const ctx = makeCtx()
    r.register('txt', (_p, _w, _c) => ['abcdef', 'gh', 'ijklmnop'])
    const lines = r.renderPrimitive(txtPrim, 4, ctx)
    expect(lines[0]).toBe('abcd')
    expect(lines[1]).toBe('gh') // within width — unchanged
    expect(lines[2]).toBe('ijkl')
  })

  it('passes width to the renderer so it can pre-constrain output', () => {
    const r = createPrimitiveRegistry()
    const ctx = makeCtx()
    let capturedWidth = 0
    r.register('txt', (_p, w, _c) => { capturedWidth = w; return ['x'] })
    r.renderPrimitive(txtPrim, 42, ctx)
    expect(capturedWidth).toBe(42)
  })
})

// ─── 5. Note appending ────────────────────────────────────────────────────────

describe('renderPrimitive — note appending', () => {
  it('appends one extra line for a note', () => {
    const r = createPrimitiveRegistry()
    const ctx = makeCtx()
    r.register('txt', (_p, _w, _c) => ['content'])
    const lines = r.renderPrimitive(txtWithNote, 80, ctx)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe('content')
  })

  it('note line uses ctx.theme.fg with "muted" color', () => {
    const r = createPrimitiveRegistry()
    const ctx = makeCtx()
    r.register('txt', (_p, _w, _c) => ['content'])
    const lines = r.renderPrimitive(txtWithNote, 80, ctx)
    // Fake fg produces `muted(icon message)` — color prefix must be present
    expect(lines[1]).toMatch(/^muted\(/)
  })

  it('note line contains the icon and message', () => {
    const r = createPrimitiveRegistry()
    const ctx = makeCtx()
    r.register('txt', (_p, _w, _c) => ['content'])
    const lines = r.renderPrimitive(txtWithNote, 80, ctx)
    expect(lines[1]).toContain('📌')
    expect(lines[1]).toContain('my note')
  })

  it('no note: output length exactly matches renderer output', () => {
    const r = createPrimitiveRegistry()
    const ctx = makeCtx()
    r.register('txt', (_p, _w, _c) => ['line1', 'line2'])
    const prim: Txt = { _v: 'txt', d: 'no note' }
    const lines = r.renderPrimitive(prim, 80, ctx)
    expect(lines).toHaveLength(2)
  })

  it('note line is also subject to the width clamp', () => {
    const r = createPrimitiveRegistry()
    // Give text metrics that show note line as wide, then truncates
    const ctx: RenderContext = {
      theme: {
        fg(_color: string, text: string): string {
          // Return a 40-char note line regardless of color
          return 'N'.repeat(40)
        },
      },
      text: {
        visibleWidth(text: string): number {
          return text.length
        },
        truncateToWidth(text: string, width: number): string {
          return text.slice(0, width)
        },
      },
      code: {
        highlight(code: string, _lang: string): string[] {
          return [code]
        },
      },
    }
    r.register('txt', (_p, _w, _c) => ['ok'])
    const lines = r.renderPrimitive(txtWithNote, 5, ctx)
    // Note line should be clamped to width 5
    const noteLine = lines[lines.length - 1]
    expect(noteLine.length).toBe(5)
  })
})

// ─── C2: registerAllPrimitives + same-registry composite recursion ────────────
//
// These tests prove the C2 contract:
//   6. A fresh registry has no renderers for any tag in ALL_TAGS.
//   7. registerAllPrimitives(registry) registers renderers for every ALL_TAGS member.
//      md is intentionally excluded from ALL_TAGS and therefore not covered here.
//   8. A fully registered registry renders leaf primitives correctly.
//   9. stk composite dispatch uses the same registry instance passed to
//      registerStkRenderer — not a global or sibling instance.

// ─── 6. Fresh registry — no renderers ─────────────────────────────────────────

describe('createPrimitiveRegistry — fresh instance has no renderers', () => {
  it('hasRenderer returns false for every tag in ALL_TAGS before registration', () => {
    const registry = createPrimitiveRegistry()
    for (const tag of ALL_TAGS) {
      expect(registry.hasRenderer(tag), `unexpected renderer for "${tag}" in fresh registry`).toBe(false)
    }
  })

  it('getRenderer returns undefined for every tag in ALL_TAGS before registration', () => {
    const registry = createPrimitiveRegistry()
    for (const tag of ALL_TAGS) {
      expect(registry.getRenderer(tag)).toBeUndefined()
    }
  })
})

// ─── 7. registerAllPrimitives — ALL_TAGS coverage ────────────────────────────

describe('registerAllPrimitives — registers every tag in ALL_TAGS', () => {
  it('hasRenderer is true for every ALL_TAGS member after a single call', () => {
    const registry = createPrimitiveRegistry()
    registerAllPrimitives(registry)
    for (const tag of ALL_TAGS) {
      expect(registry.hasRenderer(tag), `missing renderer for tag "${tag}"`).toBe(true)
    }
  })

  it('a sibling registry stays empty when only the first was populated — registration is instance-scoped', () => {
    const r1 = createPrimitiveRegistry()
    const r2 = createPrimitiveRegistry()
    registerAllPrimitives(r1)
    // r1 is fully populated; r2 must remain untouched
    for (const tag of ALL_TAGS) {
      expect(r2.hasRenderer(tag), `r2 should not have renderer for "${tag}"`).toBe(false)
    }
  })
})

// ─── 8. Full registry — leaf primitive rendering ──────────────────────────────

describe('registerAllPrimitives — registered registry renders leaf primitives', () => {
  it('txt: renders the data string into output lines', () => {
    const registry = createPrimitiveRegistry()
    registerAllPrimitives(registry)
    const ctx = makeCtx()
    const prim: Txt = { _v: 'txt', d: 'hello world' }
    const lines = registry.renderPrimitive(prim, 80, ctx)
    expect(lines.length).toBeGreaterThanOrEqual(1)
    expect(lines.join('\n')).toContain('hello world')
  })

  it('tag: renders the text string wrapped in square brackets', () => {
    const registry = createPrimitiveRegistry()
    registerAllPrimitives(registry)
    const ctx = makeCtx()
    const prim: Tag = { _v: 'tag', text: 'ready' }
    const lines = registry.renderPrimitive(prim, 80, ctx)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('[ready]')
  })

  it('bar: renders the correctly computed percentage string', () => {
    const registry = createPrimitiveRegistry()
    registerAllPrimitives(registry)
    // Identity fg: no printable wrapper around content, so bar width arithmetic
    // uses the same character counts as visibleWidth — the real behaviour under ANSI.
    const ctx: RenderContext = {
      theme: { fg: (_color: string, text: string) => text },
      text: {
        visibleWidth: (text: string) => text.length,
        truncateToWidth: (text: string, width: number) => text.slice(0, width),
      },
      code: { highlight: (code: string, _lang: string) => [code] },
    }
    const prim: Bar = { _v: 'bar', v: 3, max: 10 }
    // 3/10 = 30 % ; barRenderer computes Math.round(0.3 * barWidth) filled blocks
    const lines = registry.renderPrimitive(prim, 80, ctx)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('30%')
  })
})

// ─── 9. Composite recursion — same registry instance ─────────────────────────
//
// The stk renderer captures its `registry` argument in a closure and calls
// `registry.renderPrimitive` for each child.  These tests verify that the
// captured registry is the exact instance passed to `registerStkRenderer`,
// not a global or a different instance.

describe('registerAllPrimitives — stk composite recursion uses same registry', () => {
  it('stk with txt children renders child content when all primitives are registered', () => {
    const registry = createPrimitiveRegistry()
    registerAllPrimitives(registry)
    const ctx = makeCtx()
    const prim: Stk = { _v: 'stk', items: [{ _v: 'txt', d: 'alpha' }, { _v: 'txt', d: 'beta' }] }
    const lines = registry.renderPrimitive(prim, 80, ctx)
    const combined = lines.join('\n')
    expect(combined).toContain('alpha')
    expect(combined).toContain('beta')
  })

  it('stk dispatches through its own registry — txt child gets "unknown primitive" when only stk is registered', () => {
    // Register only stk; txt is absent from this registry.
    // The stk closure captures `partial` as its dispatch target.
    // If stk used any other registry the child would render; it doesn't → warning proves same-registry.
    const partial = createPrimitiveRegistry()
    registerStkRenderer(partial)
    const ctx = makeCtx()
    const prim: Stk = { _v: 'stk', items: [{ _v: 'txt', d: 'invisible' }] }
    const lines = partial.renderPrimitive(prim, 80, ctx)
    expect(lines.some(l => l.includes('unknown primitive'))).toBe(true)
    expect(lines.join('\n')).not.toContain('invisible')
  })

  it('stk in registryB does not inherit txt from a separate full registry — child dispatch is registry-local', () => {
    // registryA has ALL renderers; registryB has only stk (registered into registryB).
    // Rendering a stk through registryB must dispatch children through registryB,
    // not registryA — so txt children get "unknown primitive" despite registryA being full.
    const registryA = createPrimitiveRegistry()
    registerAllPrimitives(registryA)
    const registryB = createPrimitiveRegistry()
    registerStkRenderer(registryB)
    const ctx = makeCtx()
    const prim: Stk = { _v: 'stk', items: [{ _v: 'txt', d: 'never-rendered' }] }
    const lines = registryB.renderPrimitive(prim, 80, ctx)
    expect(lines.some(l => l.includes('unknown primitive'))).toBe(true)
    expect(lines.join('\n')).not.toContain('never-rendered')
  })

  it('row with txt children renders child content when all primitives are registered', () => {
    // row also uses same-registry dispatch; at sufficient width it renders side-by-side.
    const registry = createPrimitiveRegistry()
    registerAllPrimitives(registry)
    const ctx = makeCtx()
    const prim = { _v: 'row' as const, items: [{ _v: 'txt' as const, d: 'left' }, { _v: 'txt' as const, d: 'right' }] }
    const lines = registry.renderPrimitive(prim, 80, ctx)
    const combined = lines.join('\n')
    // Both children must appear regardless of layout (side-by-side or collapsed stack)
    expect(combined).toContain('left')
    expect(combined).toContain('right')
  })
})
