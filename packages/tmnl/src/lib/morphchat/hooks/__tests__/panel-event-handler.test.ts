import { describe, it, expect } from 'bun:test'
import { applyRemotePanelEvent } from '../panel-event-handler'

describe('applyRemotePanelEvent', () => {
  it('spawns panel and stores remote->local mapping for panel:spawned', () => {
    const calls: string[] = []
    const map = new Map<string, string>()

    applyRemotePanelEvent(
      {
        _tag: 'panel:spawned',
        surfaceId: 'surf-1',
        panelId: 'remote-panel-1',
        title: 'Surface',
        mode: 'floating',
        surface: { id: 'surf-1' },
      } as any,
      {
        registerGeniferPanelVisitor: () => calls.push('register'),
        setGeniferPanelSurface: (id) => calls.push(`set:${id}`),
        spawnPanel: (_visitor, _opts) => {
          calls.push('spawn')
          return 'local-panel-1'
        },
        closePanel: () => calls.push('close'),
        remoteToLocalPanelIds: map,
      },
    )

    expect(calls).toEqual(['register', 'set:surf-1', 'spawn'])
    expect(map.get('remote-panel-1')).toBe('local-panel-1')
  })

  it('closes mapped local panel on panel:closed', () => {
    const calls: string[] = []
    const map = new Map<string, string>([['remote-panel-2', 'local-panel-2']])

    applyRemotePanelEvent(
      {
        _tag: 'panel:closed',
        panelId: 'remote-panel-2',
      } as any,
      {
        registerGeniferPanelVisitor: () => {},
        setGeniferPanelSurface: () => {},
        spawnPanel: () => null,
        closePanel: (id) => calls.push(`close:${id}`),
        remoteToLocalPanelIds: map,
      },
    )

    expect(calls).toEqual(['close:local-panel-2'])
    expect(map.has('remote-panel-2')).toBe(false)
  })

  it('updates surface atom on panel:surface_updated', () => {
    const calls: string[] = []

    applyRemotePanelEvent(
      {
        _tag: 'panel:surface_updated',
        surfaceId: 'surf-3',
        surface: { id: 'surf-3', version: 2 },
      } as any,
      {
        registerGeniferPanelVisitor: () => {},
        setGeniferPanelSurface: (id) => calls.push(`set:${id}`),
        spawnPanel: () => null,
        closePanel: () => {},
        remoteToLocalPanelIds: new Map(),
      },
    )

    expect(calls).toEqual(['set:surf-3'])
  })

  it('ignores malformed spawned event without required ids', () => {
    const calls: string[] = []

    applyRemotePanelEvent(
      {
        _tag: 'panel:spawned',
        panelId: 'p-only',
      } as any,
      {
        registerGeniferPanelVisitor: () => calls.push('register'),
        setGeniferPanelSurface: () => calls.push('set'),
        spawnPanel: () => {
          calls.push('spawn')
          return 'x'
        },
        closePanel: () => calls.push('close'),
        remoteToLocalPanelIds: new Map(),
      },
    )

    expect(calls).toEqual([])
  })
})
