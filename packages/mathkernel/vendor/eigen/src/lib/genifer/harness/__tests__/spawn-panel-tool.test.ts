import { describe, it, expect } from 'bun:test'
import { Effect } from 'effect'
import { createSpawnPanelTool, type SpawnPanelBridge } from '../spawn-panel-tool'

describe('spawn_panel tool', () => {
  const LEGIT_SURFACE = {
    _tag: 'GeniferSurface',
    id: 'surf-1',
    treeId: null,
    threadId: 'thread-1',
    toolCallId: 'call-1',
    sessionId: 'session-1',
    treeSnapshot: { root: 'root', elements: {}, metadata: {} },
    version: 1,
    parentSurfaceId: null,
    dataBindings: {},
    actionBindings: {},
    quality: { score: 0.92, repairs: 0, model: 'claude-sonnet-4', durationMs: 1200 },
    prompt: 'build ui',
    instruction: null,
    status: 'complete',
    createdAt: Date.now(),
  }

  const makeBridge = (): SpawnPanelBridge => ({
    generate: async () => ({ surfaceId: 'surf-1', surface: LEGIT_SURFACE }),
    refine: async () => {},
    spawnPanel: () => 'panel-1',
    closePanel: () => {},
  })

  it('spawns from prompt and forwards legitimate surface payload', async () => {
    let receivedSurface: unknown = null
    const tool = createSpawnPanelTool({
      ...makeBridge(),
      spawnPanel: (_surfaceId, opts) => {
        receivedSurface = opts.surface
        return 'panel-1'
      },
    })
    const onUpdateCalls: any[] = []
    const result = await tool.execute('call-1', { prompt: 'build ui' } as any, undefined, (u) => onUpdateCalls.push(u))

    expect(result.details?.operation).toBe('spawn')
    expect(result.details?.surfaceId).toBe('surf-1')
    expect(result.details?.panelId).toBe('panel-1')
    expect((receivedSurface as any)?._tag).toBe('GeniferSurface')
    expect((receivedSurface as any)?.id).toBe('surf-1')
    expect(onUpdateCalls.length).toBe(1)
  })

  it('displays existing surface', async () => {
    const tool = createSpawnPanelTool(makeBridge())
    const result = await tool.execute('call-2', { surfaceId: 'surf-2' } as any, undefined)
    expect(result.details?.operation).toBe('display')
    expect(result.details?.surfaceId).toBe('surf-2')
  })

  it('updates existing surface', async () => {
    let called = false
    const tool = createSpawnPanelTool({
      ...makeBridge(),
      refine: async (surfaceId, instruction) => {
        called = true
        expect(surfaceId).toBe('surf-3')
        expect(instruction).toBe('add chart')
      },
    })

    const result = await tool.execute('call-3', { surfaceId: 'surf-3', update: 'add chart' } as any, undefined)
    expect(called).toBe(true)
    expect(result.details?.operation).toBe('update')
  })

  it('closes panel', async () => {
    let closed: string | null = null
    const tool = createSpawnPanelTool({
      ...makeBridge(),
      closePanel: (id) => { closed = id },
    })

    const result = await tool.execute('call-4', { panelId: 'panel-9', close: true } as any, undefined)
    expect(closed).toBe('panel-9')
    expect(result.details?.operation).toBe('close')
  })

  it('attaches subscription after panel spawn when requested', async () => {
    let attached:
      | {
          panelId: string
          surfaceId: string
          config: { mode: string; intervalMs?: number }
        }
      | null = null

    const tool = createSpawnPanelTool({
      ...makeBridge(),
      spawnPanel: () => 'panel-sub-1',
      subscriptionManager: {
        attach: (panelId, surfaceId, config) =>
          Effect.sync(() => {
            attached = {
              panelId,
              surfaceId,
              config: {
                mode: config.mode,
                intervalMs: config.intervalMs,
              },
            }

            return {
              _tag: 'PanelSubscription',
              id: 'sub-1',
              panelId,
              surfaceId,
              mode: config.mode,
              intervalMs: config.intervalMs,
              dependsOn: config.dependsOn,
              promptTemplate: config.promptTemplate,
              ttlMs: config.ttlMs,
              status: 'active',
              createdAt: Date.now(),
              refreshCount: 0,
            } as any
          }),
        detach: () => Effect.void,
        pause: () => Effect.void,
        resume: () => Effect.void,
        status: () => Effect.fail(new Error('unused') as any),
        activeSubscriptions: () => Effect.succeed([]),
      },
    })

    const result = await tool.execute(
      'call-sub-1',
      {
        surfaceId: 'surf-2',
        subscription: {
          mode: 'poll',
          intervalMs: 500,
        },
      } as any,
      undefined,
    )

    expect(result.details?.operation).toBe('display')
    expect(result.details?.subscriptionAttached).toBe(true)
    expect(result.details?.subscriptionError).toBeUndefined()
    expect(attached).toEqual({
      panelId: 'panel-sub-1',
      surfaceId: 'surf-2',
      config: {
        mode: 'poll',
        intervalMs: 500,
      },
    })
  })

  it('errors when no operation provided', async () => {
    const tool = createSpawnPanelTool(makeBridge())
    const result = await tool.execute('call-5', {} as any, undefined)
    expect(result.isError).toBe(true)
  })
})
