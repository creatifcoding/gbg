/**
 * Unit tests for ToolManifest — compiled tool guide from contributed sections.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ToolManifest, SLOTS } from '../src/manifest.js'
import { ALL_SECTIONS } from '../src/manifest-sections.js'

describe('ToolManifest: registration', () => {
  let m: ToolManifest

  beforeEach(() => { m = new ToolManifest() })

  it('starts empty', () => {
    expect(m.stats().sections).toBe(0)
    expect(m.compile()).toBe('')
  })

  it('registers a static section', () => {
    m.register({ id: 'foo', slot: 'discipline', content: 'use helpers' })
    expect(m.stats().sections).toBe(1)
    expect(m.stats().slots.discipline).toBe(1)
  })

  it('replaces section with same id', () => {
    m.register({ id: 'foo', slot: 'discipline', content: 'v1' })
    m.register({ id: 'foo', slot: 'discipline', content: 'v2' })
    expect(m.stats().sections).toBe(1)
    expect(m.compile()).toBe('v2')
  })

  it('unregisters section', () => {
    m.register({ id: 'foo', slot: 'api', content: 'text' })
    expect(m.unregister('foo')).toBe(true)
    expect(m.stats().sections).toBe(0)
    expect(m.unregister('nonexistent')).toBe(false)
  })

  it('inventory groups by slot', () => {
    m.register({ id: 'a', slot: 'discipline', content: '1' })
    m.register({ id: 'b', slot: 'api', content: '2' })
    m.register({ id: 'c', slot: 'api', content: '3' })
    const inv = m.inventory()
    expect(inv.discipline).toEqual(['a'])
    expect(inv.api).toEqual(['b', 'c'])
    expect(inv.shapes).toEqual([])
  })
})

describe('ToolManifest: compilation', () => {
  let m: ToolManifest

  beforeEach(() => { m = new ToolManifest() })

  it('compiles static sections in slot order', () => {
    m.register({ id: 'avoid', slot: 'avoid', content: 'AVOID' })
    m.register({ id: 'disc', slot: 'discipline', content: 'DISCIPLINE' })
    m.register({ id: 'api', slot: 'api', content: 'API' })
    const out = m.compile()
    const discIdx = out.indexOf('DISCIPLINE')
    const apiIdx = out.indexOf('API')
    const avoidIdx = out.indexOf('AVOID')
    expect(discIdx).toBeLessThan(apiIdx)
    expect(apiIdx).toBeLessThan(avoidIdx)
  })

  it('respects priority within slot', () => {
    m.register({ id: 'b', slot: 'api', priority: 20, content: 'B' })
    m.register({ id: 'a', slot: 'api', priority: 10, content: 'A' })
    const out = m.compile()
    expect(out.indexOf('A')).toBeLessThan(out.indexOf('B'))
  })

  it('respects after constraint', () => {
    m.register({ id: 'shapes', slot: 'shapes', priority: 10, content: 'SHAPES' })
    m.register({ id: 'examples', slot: 'shapes', priority: 5, after: ['shapes'], content: 'EXAMPLES' })
    const out = m.compile()
    // examples has lower priority (5) but must come after shapes
    expect(out.indexOf('SHAPES')).toBeLessThan(out.indexOf('EXAMPLES'))
  })

  it('compiles provider functions', () => {
    let counter = 0
    m.register({ id: 'dynamic', slot: 'api', content: () => `count: ${++counter}` })
    expect(m.compile()).toBe('count: 1')
  })

  it('handles provider errors gracefully', () => {
    m.register({ id: 'bad', slot: 'api', content: () => { throw new Error('boom') } })
    const out = m.compile()
    expect(out).toContain('bad: provider error')
  })

  it('filters empty resolved sections', () => {
    m.register({ id: 'empty', slot: 'discipline', content: '' })
    m.register({ id: 'real', slot: 'api', content: 'content' })
    expect(m.compile()).toBe('content')
  })
})

describe('ToolManifest: dirty tracking', () => {
  let m: ToolManifest

  beforeEach(() => { m = new ToolManifest() })

  it('starts dirty after register', () => {
    m.register({ id: 'a', slot: 'api', content: 'x' })
    expect(m.isDirty).toBe(true)
  })

  it('clean after compile', () => {
    m.register({ id: 'a', slot: 'api', content: 'x' })
    m.compile()
    expect(m.isDirty).toBe(false)
  })

  it('markDirty flags specific section', () => {
    m.register({ id: 'a', slot: 'api', content: 'x' })
    m.compile()
    expect(m.isDirty).toBe(false)
    m.markDirty('a')
    expect(m.isDirty).toBe(true)
    expect(m.stats().dirtyCount).toBe(1)
  })

  it('markDirty on nonexistent id is no-op', () => {
    m.register({ id: 'a', slot: 'api', content: 'x' })
    m.compile()
    m.markDirty('nonexistent')
    expect(m.isDirty).toBe(false)
  })

  it('incremental compile only re-resolves dirty providers', () => {
    let calls = 0
    m.register({ id: 'static', slot: 'discipline', content: 'STATIC' })
    m.register({ id: 'dynamic', slot: 'api', content: () => { calls++; return `call ${calls}` } })
    m.compile()
    expect(calls).toBe(1)

    // Not dirty — compile returns cached
    m.compile()
    expect(calls).toBe(1) // provider NOT called again

    // Mark dirty — compile re-resolves only the dirty section
    m.markDirty('dynamic')
    const out = m.compile()
    expect(calls).toBe(2)
    expect(out).toContain('call 2')
    expect(out).toContain('STATIC')
  })

  it('update marks dirty and triggers recompile', () => {
    m.register({ id: 'a', slot: 'api', content: 'v1' })
    m.compile()
    m.update('a', 'v2')
    expect(m.isDirty).toBe(true)
    expect(m.compile()).toBe('v2')
  })
})

describe('ToolManifest: output property', () => {
  it('returns last compiled without recompiling', () => {
    const m = new ToolManifest()
    m.register({ id: 'a', slot: 'api', content: 'initial' })
    m.compile()
    m.update('a', 'updated')
    // .output returns cached, not recompiled
    expect(m.output).toBe('initial')
    // compile() returns fresh
    expect(m.compile()).toBe('updated')
    expect(m.output).toBe('updated')
  })
})

describe('ToolManifest: all built-in sections', () => {
  it('registers and compiles all sections without error', () => {
    const m = new ToolManifest()
    for (const s of ALL_SECTIONS) {
      m.register(s)
    }
    const out = m.compile()
    expect(out.length).toBeGreaterThan(100)
    expect(m.stats().sections).toBe(ALL_SECTIONS.length)
  })

  it('slot ordering preserved in full build', () => {
    const m = new ToolManifest()
    for (const s of ALL_SECTIONS) {
      m.register(s)
    }
    const out = m.compile()
    const disc = out.indexOf('## EVAL DISCIPLINE')
    const shapes = out.indexOf('## TUI PRIMITIVES')
    const api = out.indexOf('## RLM STORE v2')
    const patterns = out.indexOf('## PATTERNS')
    const avoid = out.indexOf('## AVOID')
    expect(disc).toBeLessThan(shapes)
    expect(shapes).toBeLessThan(api)
    expect(api).toBeLessThan(patterns)
    expect(patterns).toBeLessThan(avoid)
  })

  it('inventory shows correct distribution', () => {
    const m = new ToolManifest()
    for (const s of ALL_SECTIONS) m.register(s)
    const inv = m.inventory()
    expect(inv.discipline.length).toBeGreaterThanOrEqual(1)
    expect(inv.shapes.length).toBeGreaterThanOrEqual(1)
    expect(inv.api.length).toBeGreaterThanOrEqual(1)
    expect(inv.patterns.length).toBeGreaterThanOrEqual(1)
    expect(inv.avoid.length).toBeGreaterThanOrEqual(1)
  })
})

describe('ToolManifest: stats', () => {
  it('tracks compiled dimensions', () => {
    const m = new ToolManifest()
    m.register({ id: 'a', slot: 'api', content: 'line1\nline2\nline3' })
    m.compile()
    const s = m.stats()
    expect(s.compiledLines).toBe(3)
    expect(s.compiledChars).toBe('line1\nline2\nline3'.length)
    expect(s.lastCompiled).toBeGreaterThan(0)
    expect(s.dirtyCount).toBe(0)
  })
})

describe('ToolManifest: SLOTS constant', () => {
  it('exports slot identifiers', () => {
    expect(SLOTS).toEqual(['discipline', 'shapes', 'api', 'patterns', 'avoid'])
  })
})
