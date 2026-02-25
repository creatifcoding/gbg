import { describe, it, expect } from 'bun:test'
import { createSpawnPanelTool, type SpawnPanelBridge } from '../spawn-panel-tool'

describe('spawn_panel tool', () => {
  const makeBridge = (): SpawnPanelBridge => ({
    generate: async () => ({ surfaceId: 'surf-1', surface: { _tag: 'MockSurface' } }),
    refine: async () => {},
    spawnPanel: () => 'panel-1',
    closePanel: () => {},
  })

  it('spawns from prompt', async () => {
    const tool = createSpawnPanelTool(makeBridge())
    const onUpdateCalls: any[] = []
    const result = await tool.execute('call-1', { prompt: 'build ui' } as any, undefined, (u) => onUpdateCalls.push(u))

    expect(result.details?.operation).toBe('spawn')
    expect(result.details?.surfaceId).toBe('surf-1')
    expect(result.details?.panelId).toBe('panel-1')
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

  it('errors when no operation provided', async () => {
    const tool = createSpawnPanelTool(makeBridge())
    const result = await tool.execute('call-5', {} as any, undefined)
    expect(result.isError).toBe(true)
  })
})
