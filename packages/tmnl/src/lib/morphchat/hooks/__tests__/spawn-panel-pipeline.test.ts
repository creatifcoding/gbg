import { describe, it, expect } from 'bun:test'
import { createSpawnPanelTool, type SpawnPanelBridge } from '@/lib/genifer/harness/spawn-panel-tool'
import { applyRemotePanelEvent } from '../panel-event-handler'
import type { PanelEvent } from '@/lib/genifer/harness/panel-events'

describe('spawn_panel mini-pipeline', () => {
  it('tool spawn -> emitted panel event -> client handler applies spawn + mapping + surface sync', async () => {
    const emitted: PanelEvent[] = []

    const LEGIT_SURFACE = {
      _tag: 'GeniferSurface',
      id: 'surf-pipeline-1',
      treeId: null,
      threadId: 'thread-pipeline',
      toolCallId: 'call-pipeline',
      sessionId: 'session-pipeline',
      treeSnapshot: { root: 'root', elements: {}, metadata: {} },
      version: 1,
      parentSurfaceId: null,
      dataBindings: {},
      actionBindings: {},
      quality: { score: 0.95, repairs: 0, model: 'claude-sonnet-4', durationMs: 950 },
      prompt: 'Build pipeline dashboard',
      instruction: null,
      status: 'complete',
      createdAt: Date.now(),
    }

    // Simulate server-side bridge (generate + emit panel event)
    let panelCounter = 0
    const bridge: SpawnPanelBridge = {
      generate: async () => ({ surfaceId: LEGIT_SURFACE.id, surface: LEGIT_SURFACE }),
      refine: async () => {},
      spawnPanel: (surfaceId, opts) => {
        const panelId = `remote-panel-${++panelCounter}`
        emitted.push({
          _tag: 'panel:spawned',
          surfaceId,
          panelId,
          title: opts.title,
          prompt: opts.prompt,
          threadId: opts.threadId,
          mode: opts.mode,
          surface: opts.surface,
        } as any)
        return panelId
      },
      closePanel: (panelId) => {
        emitted.push({ _tag: 'panel:closed', panelId } as any)
      },
    }

    const tool = createSpawnPanelTool(bridge)

    const toolResult = await tool.execute(
      'call-1',
      {
        prompt: 'Build pipeline dashboard',
        title: 'Pipeline Surface',
        mode: 'floating',
      } as any,
      undefined,
    )

    expect(toolResult.details?.operation).toBe('spawn')
    expect(toolResult.details?.surfaceId).toBe(LEGIT_SURFACE.id)
    expect(emitted.length).toBe(1)
    expect((emitted[0] as any)._tag).toBe('panel:spawned')

    // Simulate client-side application of emitted panel event
    const calls: string[] = []
    const mapping = new Map<string, string>()

    applyRemotePanelEvent(emitted[0] as any, {
      registerGeniferPanelVisitor: () => calls.push('register'),
      setGeniferPanelSurface: (surfaceId, surface) => {
        calls.push(`surface:${surfaceId}`)
        expect((surface as any).id).toBe(LEGIT_SURFACE.id)
      },
      spawnPanel: (_visitorId, opts) => {
        calls.push('spawn')
        expect((opts.data as any).surfaceId).toBe(LEGIT_SURFACE.id)
        expect(opts.mode).toBe('floating')
        return 'local-panel-1'
      },
      closePanel: () => calls.push('close'),
      remoteToLocalPanelIds: mapping,
    })

    expect(calls).toEqual(['register', `surface:${LEGIT_SURFACE.id}`, 'spawn'])
    expect(mapping.get('remote-panel-1')).toBe('local-panel-1')
  })

  it('close pipeline event resolves remote->local mapping and closes local panel', () => {
    const calls: string[] = []
    const mapping = new Map<string, string>([['remote-panel-9', 'local-panel-9']])

    applyRemotePanelEvent(
      { _tag: 'panel:closed', panelId: 'remote-panel-9' } as any,
      {
        registerGeniferPanelVisitor: () => {},
        setGeniferPanelSurface: () => {},
        spawnPanel: () => null,
        closePanel: (id) => calls.push(`close:${id}`),
        remoteToLocalPanelIds: mapping,
      },
    )

    expect(calls).toEqual(['close:local-panel-9'])
    expect(mapping.has('remote-panel-9')).toBe(false)
  })
})
