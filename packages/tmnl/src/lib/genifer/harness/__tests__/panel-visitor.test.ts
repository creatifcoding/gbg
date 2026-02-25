import { describe, it, expect } from 'bun:test'
import { Registry } from '@effect-atom/atom-react'
import { geniferPanelSurfaces, setGeniferPanelRegistry, setGeniferPanelSurface } from '../panel-visitor'
import { applyReplaySafeRemotePanelEvent } from '../../../morphchat/hooks/useHarnessAdapter'

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

describe('applyReplaySafeRemotePanelEvent', () => {
  it('deduplicates replayed spawn/update/close churn', () => {
    const remoteToLocalPanelIds = new Map<string, string>()
    const remotePanelSurfaceIds = new Map<string, string>()
    const surfaceToLocalPanelIds = new Map<string, string>()
    const openPanels = new Set<string>()

    const spawnCalls: string[] = []
    const closeCalls: string[] = []
    const surfaceUpdates: string[] = []

    let panelCounter = 0

    const emit = (event: any) => applyReplaySafeRemotePanelEvent(event, {
      registerGeniferPanelVisitor: () => {},
      setGeniferPanelSurface: (surfaceId) => {
        surfaceUpdates.push(surfaceId)
      },
      spawnPanel: () => {
        const localId = `local-${++panelCounter}`
        openPanels.add(localId)
        spawnCalls.push(localId)
        return localId
      },
      closePanel: (panelId) => {
        closeCalls.push(panelId)
        openPanels.delete(panelId)
      },
      remoteToLocalPanelIds,
      remotePanelSurfaceIds,
      surfaceToLocalPanelIds,
      panelExists: (panelId) => openPanels.has(panelId),
    })

    emit({
      _tag: 'panel:spawned',
      panelId: 'remote-1',
      surfaceId: 'surf-1',
      surface: { id: 'surf-1', version: 1 },
    })

    const firstLocalId = remoteToLocalPanelIds.get('remote-1')
    expect(firstLocalId).toBeDefined()

    emit({
      _tag: 'panel:surface_updated',
      surfaceId: 'surf-1',
      surface: { id: 'surf-1', version: 2 },
    })

    emit({
      _tag: 'panel:spawned',
      panelId: 'remote-1',
      surfaceId: 'surf-1',
      surface: { id: 'surf-1', version: 3 },
    })

    emit({
      _tag: 'panel:surface_updated',
      surfaceId: 'surf-1',
      surface: { id: 'surf-1', version: 4 },
    })

    emit({ _tag: 'panel:closed', panelId: 'remote-1' })
    emit({ _tag: 'panel:closed', panelId: 'remote-1' })

    expect(spawnCalls).toHaveLength(1)
    expect(closeCalls).toEqual([firstLocalId])
    expect(remoteToLocalPanelIds.size).toBe(0)
    expect(remotePanelSurfaceIds.size).toBe(0)
    expect(surfaceToLocalPanelIds.size).toBe(0)
    expect(surfaceUpdates).toEqual(['surf-1', 'surf-1', 'surf-1', 'surf-1'])
  })

  it('prunes stale mappings and respawns once when local panel vanished', () => {
    const remoteToLocalPanelIds = new Map<string, string>()
    const remotePanelSurfaceIds = new Map<string, string>()
    const surfaceToLocalPanelIds = new Map<string, string>()
    const openPanels = new Set<string>()

    let panelCounter = 0

    const emit = (event: any) => applyReplaySafeRemotePanelEvent(event, {
      registerGeniferPanelVisitor: () => {},
      setGeniferPanelSurface: () => {},
      spawnPanel: () => {
        const localId = `local-${++panelCounter}`
        openPanels.add(localId)
        return localId
      },
      closePanel: (panelId) => {
        openPanels.delete(panelId)
      },
      remoteToLocalPanelIds,
      remotePanelSurfaceIds,
      surfaceToLocalPanelIds,
      panelExists: (panelId) => openPanels.has(panelId),
    })

    emit({
      _tag: 'panel:spawned',
      panelId: 'remote-2',
      surfaceId: 'surf-2',
      surface: { id: 'surf-2', version: 1 },
    })

    const firstLocalId = remoteToLocalPanelIds.get('remote-2')
    expect(firstLocalId).toBeDefined()

    // Simulate local panel being closed externally (without a matching remote close event)
    openPanels.delete(firstLocalId!)

    emit({
      _tag: 'panel:spawned',
      panelId: 'remote-2',
      surfaceId: 'surf-2',
      surface: { id: 'surf-2', version: 2 },
    })

    const secondLocalId = remoteToLocalPanelIds.get('remote-2')
    expect(secondLocalId).toBeDefined()
    expect(secondLocalId).not.toBe(firstLocalId)
    expect(surfaceToLocalPanelIds.get('surf-2')).toBe(secondLocalId)
    expect(panelCounter).toBe(2)
  })

  it('aliases repeated spawn with same surface to one local panel and cleans aliases on close', () => {
    const remoteToLocalPanelIds = new Map<string, string>()
    const remotePanelSurfaceIds = new Map<string, string>()
    const surfaceToLocalPanelIds = new Map<string, string>()
    const openPanels = new Set<string>()
    const closeCalls: string[] = []

    let panelCounter = 0

    const emit = (event: any) => applyReplaySafeRemotePanelEvent(event, {
      registerGeniferPanelVisitor: () => {},
      setGeniferPanelSurface: () => {},
      spawnPanel: () => {
        const localId = `local-${++panelCounter}`
        openPanels.add(localId)
        return localId
      },
      closePanel: (panelId) => {
        closeCalls.push(panelId)
        openPanels.delete(panelId)
      },
      remoteToLocalPanelIds,
      remotePanelSurfaceIds,
      surfaceToLocalPanelIds,
      panelExists: (panelId) => openPanels.has(panelId),
    })

    emit({ _tag: 'panel:spawned', panelId: 'remote-a', surfaceId: 'surf-shared' })
    const localId = remoteToLocalPanelIds.get('remote-a')
    expect(localId).toBeDefined()

    emit({ _tag: 'panel:spawned', panelId: 'remote-b', surfaceId: 'surf-shared' })

    expect(panelCounter).toBe(1)
    expect(remoteToLocalPanelIds.get('remote-b')).toBe(localId)

    emit({ _tag: 'panel:closed', panelId: 'remote-b' })

    expect(closeCalls).toEqual([localId])
    expect(remoteToLocalPanelIds.size).toBe(0)
    expect(remotePanelSurfaceIds.size).toBe(0)
    expect(surfaceToLocalPanelIds.size).toBe(0)
  })
})
