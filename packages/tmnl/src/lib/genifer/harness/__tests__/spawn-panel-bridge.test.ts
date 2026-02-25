import { describe, it, expect } from 'bun:test'
import { Either, Schema } from 'effect'

import type { SpawnPanelBridge } from '../spawn-panel-tool'
import { PanelEvent } from '../panel-events'
import { HarnessWsEventEnvelope } from '../../../harness/HarnessBrowserRemoteSchemas'

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

describe('panel event schema contract', () => {
  it('decodes panel:spawned with optional payload compatibility mirror', () => {
    const event = {
      _tag: 'panel:spawned',
      surfaceId: 'surf-1',
      panelId: 'panel-1',
      title: 'Generated UI',
      mode: 'floating',
      payload: {
        surfaceId: 'surf-1',
        panelId: 'panel-1',
        title: 'Generated UI',
        mode: 'floating',
      },
    }

    const decoded = Schema.decodeUnknownEither(PanelEvent)(event)
    expect(Either.isRight(decoded)).toBe(true)
  })

  it('decodes remote:ws_event envelope containing remote:panel_event compatibility payload', () => {
    const envelope = {
      _tag: 'remote:ws_event',
      event: {
        _tag: 'remote:panel_event',
        event: {
          _tag: 'panel:closed',
          panelId: 'panel-4',
        },
        payload: {
          _tag: 'panel:closed',
          panelId: 'panel-4',
        },
      },
    }

    const decoded = Schema.decodeUnknownEither(HarnessWsEventEnvelope)(envelope)
    expect(Either.isRight(decoded)).toBe(true)
  })

  it('rejects panel:spawned without required surfaceId', () => {
    const malformed = {
      _tag: 'panel:spawned',
      panelId: 'panel-1',
    }

    const decoded = Schema.decodeUnknownEither(PanelEvent)(malformed)
    expect(Either.isLeft(decoded)).toBe(true)
  })

  it('rejects panel:spawned with malformed payload shape', () => {
    const malformed = {
      _tag: 'panel:spawned',
      surfaceId: 'surf-1',
      panelId: 'panel-1',
      payload: {
        surfaceId: 'surf-1',
        panelId: 'panel-1',
        width: '480px',
      },
    }

    const decoded = Schema.decodeUnknownEither(PanelEvent)(malformed)
    expect(Either.isLeft(decoded)).toBe(true)
  })

  it('rejects panel:spawned when payload identifiers diverge from top-level fields', () => {
    const malformed = {
      _tag: 'panel:spawned',
      surfaceId: 'surf-1',
      panelId: 'panel-1',
      payload: {
        surfaceId: 'surf-2',
        panelId: 'panel-1',
      },
    }

    const decoded = Schema.decodeUnknownEither(PanelEvent)(malformed)
    expect(Either.isLeft(decoded)).toBe(true)
  })

  it('rejects remote:panel_event when compatibility payload tag diverges from event tag', () => {
    const malformedEnvelope = {
      _tag: 'remote:ws_event',
      event: {
        _tag: 'remote:panel_event',
        event: {
          _tag: 'panel:closed',
          panelId: 'panel-1',
        },
        payload: {
          _tag: 'panel:surface_updated',
          surfaceId: 'surf-1',
          surface: { id: 'surf-1' },
        },
      },
    }

    const decoded = Schema.decodeUnknownEither(HarnessWsEventEnvelope)(malformedEnvelope)
    expect(Either.isLeft(decoded)).toBe(true)
  })
})
