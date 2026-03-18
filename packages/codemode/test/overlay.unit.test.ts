/**
 * @module test/overlay.unit
 *
 * Tests for OverlayManager — stack management, compilation, lifecycle.
 */

import { describe, it, expect, vi } from 'vitest'
import { OverlayManager, pluginToOverlay, type CodemodeOverlay } from '../src/overlay.js'
import type { CodemodeCore } from '../src/types.js'

// ── Helpers ──────────────────────────────────────────────────────

function makeOverlay(id: string, opts: Partial<CodemodeOverlay> = {}): CodemodeOverlay {
  return {
    id,
    name: `Overlay ${id}`,
    methods: { [`${id}Method`]: () => `${id} result` },
    ...opts,
  }
}

function makeMockCore(): CodemodeCore {
  return {
    store: {} as any,
    procedures: {} as any,
    cwd: '/tmp/test',
    read: () => '',
    write: () => {},
    sh: () => '',
  }
}

// ── Stack Management ─────────────────────────────────────────────

describe('OverlayManager — stack management', () => {
  it('starts empty', () => {
    const mgr = new OverlayManager()
    expect(mgr.active()).toEqual([])
    expect(mgr.size).toBe(0)
    expect(mgr.compiled().stack).toEqual([])
  })

  it('loads an overlay', async () => {
    const mgr = new OverlayManager()
    mgr.setCore(makeMockCore())
    await mgr.load(makeOverlay('alpha'))

    expect(mgr.size).toBe(1)
    expect(mgr.has('alpha')).toBe(true)
    expect(mgr.active()).toEqual([{ id: 'alpha', name: 'Overlay alpha', version: undefined }])
  })

  it('rejects duplicate load', async () => {
    const mgr = new OverlayManager()
    mgr.setCore(makeMockCore())
    await mgr.load(makeOverlay('alpha'))

    await expect(mgr.load(makeOverlay('alpha'))).rejects.toThrow('already loaded')
  })

  it('unloads an overlay', async () => {
    const mgr = new OverlayManager()
    mgr.setCore(makeMockCore())
    await mgr.load(makeOverlay('alpha'))
    await mgr.unload('alpha')

    expect(mgr.size).toBe(0)
    expect(mgr.has('alpha')).toBe(false)
  })

  it('rejects unloading non-existent overlay', async () => {
    const mgr = new OverlayManager()
    await expect(mgr.unload('ghost')).rejects.toThrow('not loaded')
  })

  it('loads batch in order', async () => {
    const mgr = new OverlayManager()
    mgr.setCore(makeMockCore())
    await mgr.loadBatch([makeOverlay('a'), makeOverlay('b'), makeOverlay('c')])

    expect(mgr.compiled().stack).toEqual(['a', 'b', 'c'])
  })

  it('clears all overlays', async () => {
    const mgr = new OverlayManager()
    mgr.setCore(makeMockCore())
    await mgr.loadBatch([makeOverlay('a'), makeOverlay('b')])
    await mgr.clear()

    expect(mgr.size).toBe(0)
    expect(mgr.compiled().stack).toEqual([])
  })

  it('switchTo clears and loads single', async () => {
    const mgr = new OverlayManager()
    mgr.setCore(makeMockCore())
    await mgr.loadBatch([makeOverlay('a'), makeOverlay('b')])
    await mgr.switchTo(makeOverlay('c'))

    expect(mgr.compiled().stack).toEqual(['c'])
    expect(mgr.has('a')).toBe(false)
    expect(mgr.has('b')).toBe(false)
  })

  it('get returns overlay by id', async () => {
    const mgr = new OverlayManager()
    mgr.setCore(makeMockCore())
    const overlay = makeOverlay('alpha')
    await mgr.load(overlay)

    expect(mgr.get('alpha')).toBe(overlay)
    expect(mgr.get('nope')).toBeUndefined()
  })
})

// ── Compilation ──────────────────────────────────────────────────

describe('OverlayManager — compilation', () => {
  it('merges methods — later wins', async () => {
    const mgr = new OverlayManager()
    mgr.setCore(makeMockCore())

    await mgr.loadBatch([
      makeOverlay('a', { methods: { shared: () => 'a', aOnly: () => 'a' } }),
      makeOverlay('b', { methods: { shared: () => 'b', bOnly: () => 'b' } }),
    ])

    const compiled = mgr.compiled()
    expect(compiled.methods.shared()).toBe('b') // later wins
    expect(compiled.methods.aOnly()).toBe('a')
    expect(compiled.methods.bOnly()).toBe('b')
  })

  it('accumulates guide sections', async () => {
    const mgr = new OverlayManager()
    mgr.setCore(makeMockCore())

    await mgr.loadBatch([
      makeOverlay('a', { guide: { sections: [{ id: 'sec-a', slot: 'api', content: 'A' }] } }),
      makeOverlay('b', { guide: { sections: [{ id: 'sec-b', slot: 'api', content: 'B' }] } }),
    ])

    const compiled = mgr.compiled()
    expect(compiled.guideSections).toHaveLength(2)
    expect(compiled.guideSections.map(s => s.id)).toEqual(['sec-a', 'sec-b'])
  })

  it('merges guide priority overrides', async () => {
    const mgr = new OverlayManager()
    mgr.setCore(makeMockCore())

    await mgr.loadBatch([
      makeOverlay('a', { guide: { sections: [], priorities: { 'core-api': 10 } } }),
      makeOverlay('b', { guide: { sections: [], priorities: { 'core-api': 99, 'other': 5 } } }),
    ])

    const compiled = mgr.compiled()
    expect(compiled.guidePriorities['core-api']).toBe(99) // later wins
    expect(compiled.guidePriorities['other']).toBe(5)
  })

  it('accumulates steer fragments sorted by priority', async () => {
    const mgr = new OverlayManager()
    mgr.setCore(makeMockCore())

    await mgr.loadBatch([
      makeOverlay('a', { steer: { fragments: [{ id: 'f1', content: 'A', priority: 30 }] } }),
      makeOverlay('b', { steer: { fragments: [{ id: 'f2', content: 'B', priority: 10 }] } }),
    ])

    const compiled = mgr.compiled()
    expect(compiled.steerFragments).toHaveLength(2)
    expect(compiled.steerFragments[0].id).toBe('f2') // priority 10 first
    expect(compiled.steerFragments[1].id).toBe('f1') // priority 30 second
  })

  it('unions profiles', async () => {
    const mgr = new OverlayManager()
    mgr.setCore(makeMockCore())

    await mgr.loadBatch([
      makeOverlay('a', { profiles: { autoLoad: ['prof-a', 'shared'] } }),
      makeOverlay('b', { profiles: { autoLoad: ['prof-b', 'shared'] } }),
    ])

    const compiled = mgr.compiled()
    // 'shared' should appear once
    expect(compiled.profiles).toEqual(['prof-a', 'shared', 'prof-b'])
  })

  it('accumulates procedures with overlay provenance', async () => {
    const mgr = new OverlayManager()
    mgr.setCore(makeMockCore())

    await mgr.loadBatch([
      makeOverlay('a', { procedures: [{ name: 'procA', fn: () => {}, manifest: 'ms.fn.procA()' }] }),
      makeOverlay('b', { procedures: [{ name: 'procB', fn: () => {}, manifest: 'ms.fn.procB()' }] }),
    ])

    const compiled = mgr.compiled()
    expect(compiled.procedures).toHaveLength(2)
    expect(compiled.procedures[0].overlayId).toBe('a')
    expect(compiled.procedures[1].overlayId).toBe('b')
  })

  it('merges context fields — later wins, replace respected', async () => {
    const mgr = new OverlayManager()
    mgr.setCore(makeMockCore())

    await mgr.loadBatch([
      makeOverlay('a', { context: { fields: { x: () => 1, shared: () => 'a' } } }),
      makeOverlay('b', { context: { fields: { y: () => 2, shared: () => 'b' }, replace: true } }),
    ])

    const compiled = mgr.compiled()
    expect(compiled.contextFields.x()).toBe(1)
    expect(compiled.contextFields.y()).toBe(2)
    expect(compiled.contextFields.shared()).toBe('b') // later wins
    expect(compiled.contextReplace).toBe(true)
  })

  it('merges error formatters — later wins', async () => {
    const mgr = new OverlayManager()
    mgr.setCore(makeMockCore())

    await mgr.loadBatch([
      makeOverlay('a', { errors: { formatters: { SkillNotFound: (e: any) => `A: ${e.name}` } } }),
      makeOverlay('b', { errors: { formatters: { SkillNotFound: (e: any) => `B: ${e.name}` } } }),
    ])

    const compiled = mgr.compiled()
    expect(compiled.errorFormatters.SkillNotFound({ name: 'x' })).toBe('B: x')
  })

  it('recompiles on unload', async () => {
    const mgr = new OverlayManager()
    mgr.setCore(makeMockCore())

    await mgr.loadBatch([
      makeOverlay('a', { methods: { aMethod: () => 'a' } }),
      makeOverlay('b', { methods: { bMethod: () => 'b' } }),
    ])

    expect(mgr.compiled().methods.bMethod).toBeDefined()

    await mgr.unload('b')

    expect(mgr.compiled().methods.aMethod).toBeDefined()
    expect(mgr.compiled().methods.bMethod).toBeUndefined()
  })
})

// ── Lifecycle ────────────────────────────────────────────────────

describe('OverlayManager — lifecycle', () => {
  it('calls onLoad when overlay is loaded', async () => {
    const onLoad = vi.fn()
    const mgr = new OverlayManager()
    mgr.setCore(makeMockCore())

    await mgr.load(makeOverlay('a', { lifecycle: { onLoad } }))

    expect(onLoad).toHaveBeenCalledOnce()
    expect(onLoad).toHaveBeenCalledWith(expect.objectContaining({ cwd: '/tmp/test' }))
  })

  it('calls onUnload when overlay is unloaded', async () => {
    const onUnload = vi.fn()
    const mgr = new OverlayManager()
    mgr.setCore(makeMockCore())

    await mgr.load(makeOverlay('a', { lifecycle: { onUnload } }))
    await mgr.unload('a')

    expect(onUnload).toHaveBeenCalledOnce()
  })

  it('calls dispose on unload', async () => {
    const dispose = vi.fn()
    const mgr = new OverlayManager()
    mgr.setCore(makeMockCore())

    await mgr.load(makeOverlay('a', { dispose }))
    await mgr.unload('a')

    expect(dispose).toHaveBeenCalledOnce()
  })

  it('clear calls onUnload top-down', async () => {
    const order: string[] = []
    const mgr = new OverlayManager()
    mgr.setCore(makeMockCore())

    await mgr.loadBatch([
      makeOverlay('a', { lifecycle: { onUnload: () => { order.push('a') } } }),
      makeOverlay('b', { lifecycle: { onUnload: () => { order.push('b') } } }),
      makeOverlay('c', { lifecycle: { onUnload: () => { order.push('c') } } }),
    ])

    await mgr.clear()

    expect(order).toEqual(['c', 'b', 'a']) // top-down
  })

  it('onRecompile callback fires on every mutation', async () => {
    const onRecompile = vi.fn()
    const mgr = new OverlayManager({ onRecompile })
    mgr.setCore(makeMockCore())

    await mgr.load(makeOverlay('a'))
    expect(onRecompile).toHaveBeenCalledTimes(1)

    await mgr.load(makeOverlay('b'))
    expect(onRecompile).toHaveBeenCalledTimes(2)

    await mgr.unload('a')
    expect(onRecompile).toHaveBeenCalledTimes(3)

    await mgr.clear()
    expect(onRecompile).toHaveBeenCalledTimes(4)
  })
})

// ── Backward Compat ──────────────────────────────────────────────

describe('pluginToOverlay', () => {
  it('converts legacy plugin to overlay', () => {
    const plugin = {
      id: 'legacy',
      name: 'Legacy Plugin',
      methods: { foo: () => 'bar' },
      manifest: { id: 'legacy-ops', slot: 'api' as const, content: 'stuff' },
      setup: async () => {},
      dispose: async () => {},
    }

    const overlay = pluginToOverlay(plugin)

    expect(overlay.id).toBe('legacy')
    expect(overlay.name).toBe('Legacy Plugin')
    expect(overlay.methods.foo()).toBe('bar')
    expect(overlay.guide?.sections).toHaveLength(1)
    expect(overlay.guide?.sections[0].id).toBe('legacy-ops')
    expect(overlay.lifecycle?.onLoad).toBeDefined()
    expect(overlay.dispose).toBeDefined()
  })
})

// ── Steer Suppress ───────────────────────────────────────────────

describe('OverlayManager — steer suppression', () => {
  it('accumulates suppression rules', async () => {
    const mgr = new OverlayManager()
    mgr.setCore(makeMockCore())

    await mgr.load(makeOverlay('a', {
      steer: {
        fragments: [{ id: 'verbose', content: 'lots of text' }],
        suppress: { threshold: 0.8, fragmentIds: ['verbose'] },
      },
    }))

    const compiled = mgr.compiled()
    expect(compiled.steerSuppress).toHaveLength(1)
    expect(compiled.steerSuppress[0].threshold).toBe(0.8)
    expect(compiled.steerSuppress[0].fragmentIds).toEqual(['verbose'])
    expect(compiled.steerSuppress[0].overlayId).toBe('a')
  })
})
