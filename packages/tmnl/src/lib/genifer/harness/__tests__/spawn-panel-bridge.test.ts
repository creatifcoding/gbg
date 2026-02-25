import { describe, it, expect } from 'bun:test'
import type { SpawnPanelBridge } from '../spawn-panel-tool'

describe('spawn panel bridge contract', () => {
  it('supports generate -> spawn flow', async () => {
    const calls: string[] = []
    const bridge: SpawnPanelBridge = {
      generate: async () => {
        calls.push('generate')
        return { surfaceId: 'surf-x', surface: { id: 'surf-x' } }
      },
      refine: async () => { calls.push('refine') },
      spawnPanel: (surfaceId) => {
        calls.push(`spawn:${surfaceId}`)
        return 'panel-x'
      },
      closePanel: () => { calls.push('close') },
    }

    const gen = await bridge.generate('prompt')
    const panelId = bridge.spawnPanel(gen.surfaceId, { surface: gen.surface })
    expect(panelId).toBe('panel-x')
    expect(calls).toEqual(['generate', 'spawn:surf-x'])
  })

  it('supports refine and close', async () => {
    let refined = false
    let closed = false

    const bridge: SpawnPanelBridge = {
      generate: async () => ({ surfaceId: 'surf-z' }),
      refine: async (surfaceId, instruction) => {
        expect(surfaceId).toBe('surf-z')
        expect(instruction).toBe('tune')
        refined = true
      },
      spawnPanel: () => 'panel-z',
      closePanel: (panelId) => {
        expect(panelId).toBe('panel-z')
        closed = true
      },
    }

    await bridge.refine('surf-z', 'tune')
    bridge.closePanel('panel-z')
    expect(refined).toBe(true)
    expect(closed).toBe(true)
  })
})
