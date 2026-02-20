/**
 * Surface Machine v2 — Comprehensive Test Suite
 *
 * Tests all 3 parallel regions, guards, delayed transitions,
 * emitted events, and inter-region behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { surfaceMachine, type SurfaceMachineEvent } from '../surface-machine'
import { Conductor as conductorSpec } from '../../specs/conductor'
import { Dock as dockSpec } from '../../specs/dock'
import { Widget as widgetSpec } from '../../specs/widget'

// =============================================================================
// Helpers
// =============================================================================

function createTestActor(spec = conductorSpec) {
  return createActor(surfaceMachine, {
    input: { surfaceId: 'test-surface', initialSpec: spec },
  })
}

function getParallelStates(actor: ReturnType<typeof createTestActor>) {
  const value = actor.getSnapshot().value as Record<string, string>
  return {
    connection: value.connection,
    streaming: value.streaming,
    presentation: value.presentation,
  }
}

// =============================================================================
// Initial State
// =============================================================================

describe('Surface Machine — Initial State', () => {
  it('starts in parallel idle states', () => {
    const actor = createTestActor()
    actor.start()

    expect(getParallelStates(actor)).toEqual({
      connection: 'idle',
      streaming: 'idle',
      presentation: 'ready',
    })

    actor.stop()
  })

  it('initializes context from input', () => {
    const actor = createTestActor(conductorSpec)
    actor.start()

    const ctx = actor.getSnapshot().context
    expect(ctx.surfaceId).toBe('test-surface')
    expect(ctx.activeSpec._tag).toBe('Conductor')
    expect(ctx.contentView.density).toBe('full')
    expect(ctx.previousSpec).toBeNull()
    expect(ctx.streamingMessageId).toBeNull()
    expect(ctx.connectionError).toBeNull()

    actor.stop()
  })

  it('derives ContentViewSpec from initial spec', () => {
    const conductorActor = createTestActor(conductorSpec)
    conductorActor.start()
    expect(conductorActor.getSnapshot().context.contentView.density).toBe('full')
    conductorActor.stop()

    const dockActor = createTestActor(dockSpec)
    dockActor.start()
    expect(dockActor.getSnapshot().context.contentView.density).toBe('compact')
    dockActor.stop()

    const widgetActor = createTestActor(widgetSpec)
    widgetActor.start()
    expect(widgetActor.getSnapshot().context.contentView.density).toBe('pill')
    widgetActor.stop()
  })
})

// =============================================================================
// Connection Region
// =============================================================================

describe('Surface Machine — Connection Region', () => {
  it('idle → connecting on CONNECT', () => {
    const actor = createTestActor()
    actor.start()

    actor.send({ type: 'CONNECT' })
    expect(getParallelStates(actor).connection).toBe('connecting')

    actor.stop()
  })

  it('connecting → connected on ADAPTER_CONNECTED', () => {
    const actor = createTestActor()
    actor.start()

    actor.send({ type: 'CONNECT' })
    actor.send({ type: 'ADAPTER_CONNECTED' })
    expect(getParallelStates(actor).connection).toBe('connected')
    expect(actor.getSnapshot().context.connectionError).toBeNull()

    actor.stop()
  })

  it('connecting → error on ADAPTER_ERROR', () => {
    const actor = createTestActor()
    actor.start()

    actor.send({ type: 'CONNECT' })
    actor.send({ type: 'ADAPTER_ERROR', error: 'WebSocket failed' })
    expect(getParallelStates(actor).connection).toBe('error')
    expect(actor.getSnapshot().context.connectionError).toBe('WebSocket failed')

    actor.stop()
  })

  it('connected → reconnecting on ADAPTER_DISCONNECTED', () => {
    const actor = createTestActor()
    actor.start()

    actor.send({ type: 'CONNECT' })
    actor.send({ type: 'ADAPTER_CONNECTED' })
    actor.send({ type: 'ADAPTER_DISCONNECTED', reason: 'network timeout' })
    expect(getParallelStates(actor).connection).toBe('reconnecting')
    expect(actor.getSnapshot().context.connectionError).toBe('network timeout')

    actor.stop()
  })

  it('error → connecting on RECONNECT', () => {
    const actor = createTestActor()
    actor.start()

    actor.send({ type: 'CONNECT' })
    actor.send({ type: 'ADAPTER_ERROR', error: 'fail' })
    actor.send({ type: 'RECONNECT' })
    expect(getParallelStates(actor).connection).toBe('connecting')

    actor.stop()
  })

  it('connected → disconnecting → idle on DISCONNECT', () => {
    const actor = createTestActor()
    actor.start()

    actor.send({ type: 'CONNECT' })
    actor.send({ type: 'ADAPTER_CONNECTED' })
    actor.send({ type: 'DISCONNECT' })
    expect(getParallelStates(actor).connection).toBe('disconnecting')

    actor.send({ type: 'ADAPTER_DISCONNECTED' })
    expect(getParallelStates(actor).connection).toBe('idle')

    actor.stop()
  })

  it('reconnecting auto-retries after delay', async () => {
    vi.useFakeTimers()

    const actor = createTestActor()
    actor.start()

    actor.send({ type: 'CONNECT' })
    actor.send({ type: 'ADAPTER_CONNECTED' })
    actor.send({ type: 'ADAPTER_DISCONNECTED' })
    expect(getParallelStates(actor).connection).toBe('reconnecting')

    vi.advanceTimersByTime(2000)
    expect(getParallelStates(actor).connection).toBe('connecting')

    actor.stop()
    vi.useRealTimers()
  })

  it('disconnecting safety timeout forces idle after 2s', () => {
    vi.useFakeTimers()

    const actor = createTestActor()
    actor.start()

    actor.send({ type: 'CONNECT' })
    actor.send({ type: 'ADAPTER_CONNECTED' })
    actor.send({ type: 'DISCONNECT' })
    expect(getParallelStates(actor).connection).toBe('disconnecting')

    // Adapter never confirms — safety timeout fires
    vi.advanceTimersByTime(2000)
    expect(getParallelStates(actor).connection).toBe('idle')

    actor.stop()
    vi.useRealTimers()
  })
})

// =============================================================================
// Streaming Region
// =============================================================================

describe('Surface Machine — Streaming Region', () => {
  it('idle → active on STREAM_START', () => {
    const actor = createTestActor()
    actor.start()

    actor.send({ type: 'STREAM_START', messageId: 'msg-1' })
    expect(getParallelStates(actor).streaming).toBe('active')
    expect(actor.getSnapshot().context.streamingMessageId).toBe('msg-1')
    expect(actor.getSnapshot().context.streamDeltaCount).toBe(0)

    actor.stop()
  })

  it('active increments delta count on STREAM_DELTA', () => {
    const actor = createTestActor()
    actor.start()

    actor.send({ type: 'STREAM_START', messageId: 'msg-1' })
    actor.send({ type: 'STREAM_DELTA', messageId: 'msg-1' })
    actor.send({ type: 'STREAM_DELTA', messageId: 'msg-1' })
    actor.send({ type: 'STREAM_DELTA', messageId: 'msg-1' })
    expect(actor.getSnapshot().context.streamDeltaCount).toBe(3)

    actor.stop()
  })

  it('active → finalizing on STREAM_END (with autoCollapse preset)', () => {
    // Dock has autoCollapse=true, so it stays in finalizing waiting for delay
    const actor = createTestActor(dockSpec)
    actor.start()

    actor.send({ type: 'STREAM_START', messageId: 'msg-1' })
    actor.send({ type: 'STREAM_END', messageId: 'msg-1' })
    expect(getParallelStates(actor).streaming).toBe('finalizing')
    expect(actor.getSnapshot().context.shouldAutoCollapse).toBe(true)

    actor.stop()
  })

  it('active → idle immediately on STREAM_END (conductor, no autoCollapse)', () => {
    // Conductor has autoCollapse=false, so skipAutoCollapse fires immediately
    const actor = createTestActor(conductorSpec)
    actor.start()

    actor.send({ type: 'STREAM_START', messageId: 'msg-1' })
    actor.send({ type: 'STREAM_END', messageId: 'msg-1' })
    expect(getParallelStates(actor).streaming).toBe('idle')
    expect(actor.getSnapshot().context.streamingMessageId).toBeNull()

    actor.stop()
  })

  it('active → idle on STREAM_ERROR', () => {
    const actor = createTestActor()
    actor.start()

    actor.send({ type: 'STREAM_START', messageId: 'msg-1' })
    actor.send({ type: 'STREAM_ERROR', messageId: 'msg-1', error: 'timeout' })
    expect(getParallelStates(actor).streaming).toBe('idle')
    expect(actor.getSnapshot().context.streamingMessageId).toBeNull()

    actor.stop()
  })

  it('active → idle on CANCEL', () => {
    const actor = createTestActor()
    actor.start()

    actor.send({ type: 'STREAM_START', messageId: 'msg-1' })
    actor.send({ type: 'CANCEL' })
    expect(getParallelStates(actor).streaming).toBe('idle')
    expect(actor.getSnapshot().context.streamingMessageId).toBeNull()

    actor.stop()
  })

  it('finalizing → idle with auto-collapse for conductor (autoCollapse=false means immediate)', () => {
    // Conductor has autoCollapse: false, so finalizing always-transitions to idle immediately
    const actor = createTestActor(conductorSpec)
    actor.start()

    actor.send({ type: 'STREAM_START', messageId: 'msg-1' })
    actor.send({ type: 'STREAM_END', messageId: 'msg-1' })

    // With autoCollapse=false, the `always` guard fires immediately
    expect(getParallelStates(actor).streaming).toBe('idle')

    actor.stop()
  })

  it('finalizing → idle with auto-collapse delay for dock (autoCollapse=true)', () => {
    vi.useFakeTimers()

    const actor = createTestActor(dockSpec)
    actor.start()

    actor.send({ type: 'STREAM_START', messageId: 'msg-1' })
    actor.send({ type: 'STREAM_END', messageId: 'msg-1' })

    // Dock has autoCollapse=true, so finalizing waits for autoCollapseDelay (500ms)
    expect(getParallelStates(actor).streaming).toBe('finalizing')

    vi.advanceTimersByTime(500)
    expect(getParallelStates(actor).streaming).toBe('idle')

    actor.stop()
    vi.useRealTimers()
  })
})

// =============================================================================
// Presentation / Morphing Region
// =============================================================================

describe('Surface Machine — Presentation Region', () => {
  it('ready → morphing on MORPH with different spec', () => {
    const actor = createTestActor(conductorSpec)
    actor.start()

    actor.send({ type: 'MORPH', targetSpec: dockSpec })
    expect(getParallelStates(actor).presentation).toBe('morphing')
    expect(actor.getSnapshot().context.morphTarget?._tag).toBe('Dock')
    expect(actor.getSnapshot().context.previousSpec?._tag).toBe('Conductor')

    actor.stop()
  })

  it('MORPH with same spec is noop (stays ready)', () => {
    const actor = createTestActor(conductorSpec)
    actor.start()

    actor.send({ type: 'MORPH', targetSpec: conductorSpec })
    expect(getParallelStates(actor).presentation).toBe('ready')

    actor.stop()
  })

  it('morphing → settling → ready on MORPH_DONE', () => {
    vi.useFakeTimers()

    const actor = createTestActor(conductorSpec)
    actor.start()

    actor.send({ type: 'MORPH', targetSpec: dockSpec })
    expect(getParallelStates(actor).presentation).toBe('morphing')

    actor.send({ type: 'MORPH_DONE' })
    expect(getParallelStates(actor).presentation).toBe('settling')
    expect(actor.getSnapshot().context.activeSpec._tag).toBe('Dock')
    expect(actor.getSnapshot().context.contentView.density).toBe('compact')

    vi.advanceTimersByTime(100)
    expect(getParallelStates(actor).presentation).toBe('ready')

    actor.stop()
    vi.useRealTimers()
  })

  it('MORPH_CANCEL returns to ready without applying target', () => {
    const actor = createTestActor(conductorSpec)
    actor.start()

    actor.send({ type: 'MORPH', targetSpec: dockSpec })
    actor.send({ type: 'MORPH_CANCEL' })
    expect(getParallelStates(actor).presentation).toBe('ready')
    expect(actor.getSnapshot().context.activeSpec._tag).toBe('Conductor')

    actor.stop()
  })

  it('interruptible: new MORPH during morphing applies current and starts new', () => {
    const actor = createTestActor(conductorSpec)
    actor.start()

    actor.send({ type: 'MORPH', targetSpec: dockSpec })
    expect(getParallelStates(actor).presentation).toBe('morphing')

    // Interrupt with a new morph
    actor.send({ type: 'MORPH', targetSpec: widgetSpec })
    expect(getParallelStates(actor).presentation).toBe('morphing')
    // Previous morph applied, now morphing to widget
    expect(actor.getSnapshot().context.activeSpec._tag).toBe('Dock')
    expect(actor.getSnapshot().context.morphTarget?._tag).toBe('Widget')

    actor.stop()
  })

  it('safety timeout auto-completes morph after 3s', () => {
    vi.useFakeTimers()

    const actor = createTestActor(conductorSpec)
    actor.start()

    actor.send({ type: 'MORPH', targetSpec: dockSpec })
    expect(getParallelStates(actor).presentation).toBe('morphing')

    // Nobody sends MORPH_DONE — safety timeout fires
    vi.advanceTimersByTime(3000)
    // Should be in settling or ready
    const state = getParallelStates(actor).presentation
    expect(['settling', 'ready']).toContain(state)
    expect(actor.getSnapshot().context.activeSpec._tag).toBe('Dock')

    actor.stop()
    vi.useRealTimers()
  })

  it('morph updates ContentViewSpec density', () => {
    vi.useFakeTimers()

    const actor = createTestActor(conductorSpec)
    actor.start()
    expect(actor.getSnapshot().context.contentView.density).toBe('full')

    actor.send({ type: 'MORPH', targetSpec: widgetSpec })
    actor.send({ type: 'MORPH_DONE' })
    expect(actor.getSnapshot().context.contentView.density).toBe('pill')

    actor.stop()
    vi.useRealTimers()
  })
})

// =============================================================================
// Parallel Independence
// =============================================================================

describe('Surface Machine — Parallel Independence', () => {
  it('connection and streaming regions are independent', () => {
    const actor = createTestActor()
    actor.start()

    // Drive connection
    actor.send({ type: 'CONNECT' })
    actor.send({ type: 'ADAPTER_CONNECTED' })
    expect(getParallelStates(actor).connection).toBe('connected')
    expect(getParallelStates(actor).streaming).toBe('idle')

    // Drive streaming independently
    actor.send({ type: 'STREAM_START', messageId: 'msg-1' })
    expect(getParallelStates(actor).connection).toBe('connected')
    expect(getParallelStates(actor).streaming).toBe('active')

    // Connection error doesn't affect streaming
    actor.send({ type: 'ADAPTER_ERROR', error: 'dropped' })
    expect(getParallelStates(actor).connection).toBe('error')
    expect(getParallelStates(actor).streaming).toBe('active')

    actor.stop()
  })

  it('morphing doesn\'t affect connection or streaming', () => {
    const actor = createTestActor(conductorSpec)
    actor.start()

    actor.send({ type: 'CONNECT' })
    actor.send({ type: 'ADAPTER_CONNECTED' })
    actor.send({ type: 'STREAM_START', messageId: 'msg-1' })
    actor.send({ type: 'MORPH', targetSpec: dockSpec })

    expect(getParallelStates(actor)).toEqual({
      connection: 'connected',
      streaming: 'active',
      presentation: 'morphing',
    })

    actor.stop()
  })

  it('all three regions can transition simultaneously', () => {
    vi.useFakeTimers()

    const actor = createTestActor(conductorSpec)
    actor.start()

    // Set up: connected, streaming, morphing
    actor.send({ type: 'CONNECT' })
    actor.send({ type: 'ADAPTER_CONNECTED' })
    actor.send({ type: 'STREAM_START', messageId: 'msg-1' })
    actor.send({ type: 'MORPH', targetSpec: dockSpec })

    expect(getParallelStates(actor)).toEqual({
      connection: 'connected',
      streaming: 'active',
      presentation: 'morphing',
    })

    // Now trigger transitions in all three
    actor.send({ type: 'ADAPTER_DISCONNECTED' })
    actor.send({ type: 'STREAM_END', messageId: 'msg-1' })
    actor.send({ type: 'MORPH_DONE' })

    expect(getParallelStates(actor).connection).toBe('reconnecting')
    expect(getParallelStates(actor).presentation).toBe('settling')
    // Streaming depends on autoCollapse — dock has autoCollapse=true

    actor.stop()
    vi.useRealTimers()
  })
})

// =============================================================================
// Emitted Events
// =============================================================================

describe('Surface Machine — Emitted Events', () => {
  it('emits surface.morphStart on MORPH', () => {
    const actor = createTestActor(conductorSpec)
    const morphEvents: any[] = []

    actor.on('surface.morphStart', (evt) => morphEvents.push(evt))
    actor.start()

    actor.send({ type: 'MORPH', targetSpec: dockSpec })
    expect(morphEvents).toHaveLength(1)
    expect(morphEvents[0].from._tag).toBe('Conductor')
    expect(morphEvents[0].to._tag).toBe('Dock')

    actor.stop()
  })

  it('emits surface.morphEnd on MORPH_DONE', () => {
    const actor = createTestActor(conductorSpec)
    const endEvents: any[] = []

    actor.on('surface.morphEnd', (evt) => endEvents.push(evt))
    actor.start()

    actor.send({ type: 'MORPH', targetSpec: dockSpec })
    actor.send({ type: 'MORPH_DONE' })
    expect(endEvents).toHaveLength(1)
    expect(endEvents[0].spec._tag).toBe('Dock')

    actor.stop()
  })

  it('emits surface.autoCollapse after stream finalizes with autoCollapse=true', () => {
    vi.useFakeTimers()

    const actor = createTestActor(dockSpec) // dock has autoCollapse=true
    const collapseEvents: any[] = []

    actor.on('surface.autoCollapse', (evt) => collapseEvents.push(evt))
    actor.start()

    actor.send({ type: 'STREAM_START', messageId: 'msg-1' })
    actor.send({ type: 'STREAM_END', messageId: 'msg-1' })

    expect(collapseEvents).toHaveLength(0) // Not yet — waiting for delay

    vi.advanceTimersByTime(500)
    expect(collapseEvents).toHaveLength(1)

    actor.stop()
    vi.useRealTimers()
  })
})

// =============================================================================
// Guards
// =============================================================================

describe('Surface Machine — Guards', () => {
  it('isSameSpec guard prevents morph to same preset', () => {
    const actor = createTestActor(conductorSpec)
    actor.start()

    actor.send({ type: 'MORPH', targetSpec: conductorSpec })
    expect(getParallelStates(actor).presentation).toBe('ready') // No transition

    actor.stop()
  })

  it('hasValidMorphTarget guard rejects null targetSpec', () => {
    const actor = createTestActor(conductorSpec)
    actor.start()

    // @ts-expect-error — deliberately passing invalid event
    actor.send({ type: 'MORPH', targetSpec: null })
    expect(getParallelStates(actor).presentation).toBe('ready') // No transition

    actor.stop()
  })
})

// =============================================================================
// ContentViewSpec Derivation
// =============================================================================

describe('Surface Machine — ContentViewSpec Derivation', () => {
  it('conductor → full density with all interactivity', () => {
    const actor = createTestActor(conductorSpec)
    actor.start()

    const cv = actor.getSnapshot().context.contentView
    expect(cv.density).toBe('full')
    expect(cv.interactivity.expandCollapse).toBe(true)
    expect(cv.interactivity.approvalActions).toBe(true)
    expect(cv.interactivity.copyButton).toBe(true)
    expect(cv.interactivity.footerActions).toBe(true)
    expect(cv.tokenBudgetVisible).toBe(true)
    expect(cv.autoCollapse).toBe(false)

    actor.stop()
  })

  it('dock → compact density with reduced interactivity', () => {
    const actor = createTestActor(dockSpec)
    actor.start()

    const cv = actor.getSnapshot().context.contentView
    expect(cv.density).toBe('compact')
    expect(cv.interactivity.approvalActions).toBe(false)
    expect(cv.interactivity.footerActions).toBe(false)
    expect(cv.autoCollapse).toBe(true)
    expect(cv.groupAdjacent).toBe(true)

    actor.stop()
  })

  it('widget → pill density with minimal everything', () => {
    const actor = createTestActor(widgetSpec)
    actor.start()

    const cv = actor.getSnapshot().context.contentView
    expect(cv.density).toBe('pill')
    expect(cv.interactivity.expandCollapse).toBe(false)
    expect(cv.interactivity.approvalActions).toBe(false)
    expect(cv.interactivity.copyButton).toBe(false)
    expect(cv.animation.enterExit).toBe(false)
    expect(cv.tokenBudgetVisible).toBe(false)

    actor.stop()
  })

  it('morph from conductor to widget transitions density full → pill', () => {
    vi.useFakeTimers()

    const actor = createTestActor(conductorSpec)
    actor.start()
    expect(actor.getSnapshot().context.contentView.density).toBe('full')

    actor.send({ type: 'MORPH', targetSpec: widgetSpec })
    actor.send({ type: 'MORPH_DONE' })
    expect(actor.getSnapshot().context.contentView.density).toBe('pill')

    actor.stop()
    vi.useRealTimers()
  })
})
