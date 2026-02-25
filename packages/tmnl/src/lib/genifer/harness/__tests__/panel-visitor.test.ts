import { describe, it, expect } from 'bun:test'
import { Registry } from '@effect-atom/atom-react'
import { geniferPanelSurfaces, setGeniferPanelRegistry, setGeniferPanelSurface } from '../panel-visitor'

describe('panel-visitor atoms', () => {
  it('returns same atom for same surface id', () => {
    const a = geniferPanelSurfaces('surf-1')
    const b = geniferPanelSurfaces('surf-1')
    expect(a).toBe(b)
  })

  it('returns different atoms for different ids', () => {
    const a = geniferPanelSurfaces('surf-1')
    const b = geniferPanelSurfaces('surf-2')
    expect(a).not.toBe(b)
  })

  it('initial value is null and can be updated through helper', () => {
    const registry = Registry.make()
    setGeniferPanelRegistry(registry)

    const atom = geniferPanelSurfaces('surf-3')
    expect(registry.get(atom)).toBe(null)

    setGeniferPanelSurface('surf-3', { id: 'surf-3', treeSnapshot: '{}' } as any)
    const updated = registry.get(atom)
    expect(updated).not.toBe(null)
    expect((updated as any).id).toBe('surf-3')
  })
})
