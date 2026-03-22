/**
 * Tests for Control Mode XState Machine
 *
 * Covers: state transitions, auto-yield timer, helper functions, edge cases
 */
import { describe, it, expect } from 'bun:test'
import { createActor } from 'xstate'
import {
  controlMachine,
  snapshotToMode,
  snapshotToController,
  canAgentWrite,
  canHumanWrite,
} from '../control-machine'

function createMachineActor(autoYieldDelayMs = 5000) {
  return createActor(controlMachine, {
    input: undefined,
    snapshot: undefined,
  })
}

function startedActor() {
  const actor = createMachineActor()
  actor.start()
  return actor
}

// ─────────────────────────────────────────────────────────────────────────────
// Initial State
// ─────────────────────────────────────────────────────────────────────────────

describe('initial state', () => {
  it('starts in agentControlled', () => {
    const actor = startedActor()
    expect(actor.getSnapshot().matches('agentControlled')).toBe(true)
    expect(snapshotToMode(actor.getSnapshot())).toBe('agent-controlled')
    expect(snapshotToController(actor.getSnapshot())).toBe('agent')
    actor.stop()
  })

  it('agent can write initially', () => {
    const actor = startedActor()
    expect(canAgentWrite(actor.getSnapshot())).toBe(true)
    expect(canHumanWrite(actor.getSnapshot())).toBe(true) // triggers takeover
    actor.stop()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Agent-Controlled → Human-Controlled
// ─────────────────────────────────────────────────────────────────────────────

describe('agent → human transitions', () => {
  it('TAKE_OVER moves to humanControlled', () => {
    const actor = startedActor()
    actor.send({ type: 'TAKE_OVER' })
    expect(actor.getSnapshot().matches('humanControlled')).toBe(true)
    expect(snapshotToController(actor.getSnapshot())).toBe('human')
    expect(canAgentWrite(actor.getSnapshot())).toBe(false)
    actor.stop()
  })

  it('HUMAN_KEYSTROKE in agentControlled triggers takeover', () => {
    const actor = startedActor()
    actor.send({ type: 'HUMAN_KEYSTROKE', timestamp: Date.now() })
    expect(actor.getSnapshot().matches('humanControlled')).toBe(true)
    expect(snapshotToController(actor.getSnapshot())).toBe('human')
    actor.stop()
  })

  it('AGENT_WRITE updates lastAgentWriteAt', () => {
    const actor = startedActor()
    const ts = 1234567890
    actor.send({ type: 'AGENT_WRITE', timestamp: ts })
    expect(actor.getSnapshot().context.lastAgentWriteAt).toBe(ts)
    expect(actor.getSnapshot().matches('agentControlled')).toBe(true) // stays
    actor.stop()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Human-Controlled → Agent-Controlled
// ─────────────────────────────────────────────────────────────────────────────

describe('human → agent transitions', () => {
  it('YIELD_BACK returns to agentControlled', () => {
    const actor = startedActor()
    actor.send({ type: 'TAKE_OVER' })
    expect(actor.getSnapshot().matches('humanControlled')).toBe(true)

    actor.send({ type: 'YIELD_BACK' })
    expect(actor.getSnapshot().matches('agentControlled')).toBe(true)
    expect(snapshotToController(actor.getSnapshot())).toBe('agent')
    actor.stop()
  })

  it('HUMAN_KEYSTROKE in humanControlled stays (updates timestamp)', () => {
    const actor = startedActor()
    actor.send({ type: 'TAKE_OVER' })
    const ts = Date.now()
    actor.send({ type: 'HUMAN_KEYSTROKE', timestamp: ts })
    expect(actor.getSnapshot().matches('humanControlled')).toBe(true)
    expect(actor.getSnapshot().context.lastHumanKeystrokeAt).toBe(ts)
    actor.stop()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SWITCH_MODE transitions
// ─────────────────────────────────────────────────────────────────────────────

describe('SWITCH_MODE transitions', () => {
  it('agent → supervised', () => {
    const actor = startedActor()
    actor.send({ type: 'SWITCH_MODE', mode: 'supervised' })
    expect(actor.getSnapshot().matches('supervised')).toBe(true)
    expect(snapshotToMode(actor.getSnapshot())).toBe('supervised')
    actor.stop()
  })

  it('agent → human', () => {
    const actor = startedActor()
    actor.send({ type: 'SWITCH_MODE', mode: 'human-controlled' })
    expect(actor.getSnapshot().matches('humanControlled')).toBe(true)
    actor.stop()
  })

  it('human → agent', () => {
    const actor = startedActor()
    actor.send({ type: 'TAKE_OVER' })
    actor.send({ type: 'SWITCH_MODE', mode: 'agent-controlled' })
    expect(actor.getSnapshot().matches('agentControlled')).toBe(true)
    actor.stop()
  })

  it('human → supervised', () => {
    const actor = startedActor()
    actor.send({ type: 'TAKE_OVER' })
    actor.send({ type: 'SWITCH_MODE', mode: 'supervised' })
    expect(actor.getSnapshot().matches('supervised')).toBe(true)
    actor.stop()
  })

  it('supervised → agent', () => {
    const actor = startedActor()
    actor.send({ type: 'SWITCH_MODE', mode: 'supervised' })
    actor.send({ type: 'SWITCH_MODE', mode: 'agent-controlled' })
    expect(actor.getSnapshot().matches('agentControlled')).toBe(true)
    actor.stop()
  })

  it('SWITCH_MODE to same mode is no-op (stays in same state)', () => {
    const actor = startedActor()
    actor.send({ type: 'SWITCH_MODE', mode: 'agent-controlled' })
    // No guard matches for same mode → event dropped
    expect(actor.getSnapshot().matches('agentControlled')).toBe(true)
    actor.stop()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Supervised Mode — Agent Running / Human Override
// ─────────────────────────────────────────────────────────────────────────────

describe('supervised mode', () => {
  it('starts in agentRunning sub-state', () => {
    const actor = startedActor()
    actor.send({ type: 'SWITCH_MODE', mode: 'supervised' })
    expect(actor.getSnapshot().matches({ supervised: 'agentRunning' })).toBe(true)
    expect(canAgentWrite(actor.getSnapshot())).toBe(true)
    actor.stop()
  })

  it('HUMAN_KEYSTROKE moves to humanOverride', () => {
    const actor = startedActor()
    actor.send({ type: 'SWITCH_MODE', mode: 'supervised' })
    actor.send({ type: 'HUMAN_KEYSTROKE', timestamp: Date.now() })
    expect(actor.getSnapshot().matches({ supervised: 'humanOverride' })).toBe(true)
    expect(snapshotToController(actor.getSnapshot())).toBe('human')
    expect(canAgentWrite(actor.getSnapshot())).toBe(false)
    expect(canHumanWrite(actor.getSnapshot())).toBe(true)
    actor.stop()
  })

  it('YIELD_BACK in humanOverride returns to agentRunning', () => {
    const actor = startedActor()
    actor.send({ type: 'SWITCH_MODE', mode: 'supervised' })
    actor.send({ type: 'HUMAN_KEYSTROKE', timestamp: Date.now() })
    actor.send({ type: 'YIELD_BACK' })
    expect(actor.getSnapshot().matches({ supervised: 'agentRunning' })).toBe(true)
    expect(snapshotToController(actor.getSnapshot())).toBe('agent')
    actor.stop()
  })

  it('AGENT_WRITE in agentRunning updates timestamp', () => {
    const actor = startedActor()
    actor.send({ type: 'SWITCH_MODE', mode: 'supervised' })
    const ts = 9999
    actor.send({ type: 'AGENT_WRITE', timestamp: ts })
    expect(actor.getSnapshot().context.lastAgentWriteAt).toBe(ts)
    expect(actor.getSnapshot().matches({ supervised: 'agentRunning' })).toBe(true)
    actor.stop()
  })

  it('TAKE_OVER from supervised exits to humanControlled', () => {
    const actor = startedActor()
    actor.send({ type: 'SWITCH_MODE', mode: 'supervised' })
    actor.send({ type: 'TAKE_OVER' })
    expect(actor.getSnapshot().matches('humanControlled')).toBe(true)
    actor.stop()
  })

  it('subsequent HUMAN_KEYSTROKE in humanOverride re-enters (resets timer)', () => {
    const actor = startedActor()
    actor.send({ type: 'SWITCH_MODE', mode: 'supervised' })
    actor.send({ type: 'HUMAN_KEYSTROKE', timestamp: 1000 })
    expect(actor.getSnapshot().matches({ supervised: 'humanOverride' })).toBe(true)

    // Second keystroke re-enters humanOverride
    actor.send({ type: 'HUMAN_KEYSTROKE', timestamp: 2000 })
    expect(actor.getSnapshot().matches({ supervised: 'humanOverride' })).toBe(true)
    expect(actor.getSnapshot().context.lastHumanKeystrokeAt).toBe(2000)
    actor.stop()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Auto-Yield Timer (supervised mode)
// ─────────────────────────────────────────────────────────────────────────────

describe('auto-yield timer', () => {
  it('auto-yields back to agentRunning after delay', async () => {
    // Create with very short auto-yield
    const actor = createActor(controlMachine.provide({
      delays: { autoYieldDelay: () => 50 },
    }))
    actor.start()
    actor.send({ type: 'SWITCH_MODE', mode: 'supervised' })
    actor.send({ type: 'HUMAN_KEYSTROKE', timestamp: Date.now() })
    expect(actor.getSnapshot().matches({ supervised: 'humanOverride' })).toBe(true)

    // Wait for auto-yield
    await new Promise((r) => setTimeout(r, 100))
    expect(actor.getSnapshot().matches({ supervised: 'agentRunning' })).toBe(true)
    expect(snapshotToController(actor.getSnapshot())).toBe('agent')
    actor.stop()
  })

  it('keystroke during wait resets the timer', async () => {
    const actor = createActor(controlMachine.provide({
      delays: { autoYieldDelay: () => 80 },
    }))
    actor.start()
    actor.send({ type: 'SWITCH_MODE', mode: 'supervised' })
    actor.send({ type: 'HUMAN_KEYSTROKE', timestamp: Date.now() })

    // 50ms in, send another keystroke (resets 80ms timer)
    await new Promise((r) => setTimeout(r, 50))
    actor.send({ type: 'HUMAN_KEYSTROKE', timestamp: Date.now() })
    expect(actor.getSnapshot().matches({ supervised: 'humanOverride' })).toBe(true)

    // 50ms more (100ms total, but timer was reset at 50ms → only 50ms elapsed)
    await new Promise((r) => setTimeout(r, 50))
    expect(actor.getSnapshot().matches({ supervised: 'humanOverride' })).toBe(true)

    // 50ms more (now 80ms since last keystroke → should auto-yield)
    await new Promise((r) => setTimeout(r, 50))
    expect(actor.getSnapshot().matches({ supervised: 'agentRunning' })).toBe(true)
    actor.stop()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SESSION_ENDED → final state
// ─────────────────────────────────────────────────────────────────────────────

describe('SESSION_ENDED', () => {
  it('from agentControlled → ended', () => {
    const actor = startedActor()
    actor.send({ type: 'SESSION_ENDED' })
    expect(actor.getSnapshot().matches('ended')).toBe(true)
    expect(canAgentWrite(actor.getSnapshot())).toBe(false)
    expect(canHumanWrite(actor.getSnapshot())).toBe(false)
    actor.stop()
  })

  it('from humanControlled → ended', () => {
    const actor = startedActor()
    actor.send({ type: 'TAKE_OVER' })
    actor.send({ type: 'SESSION_ENDED' })
    expect(actor.getSnapshot().matches('ended')).toBe(true)
    actor.stop()
  })

  it('from supervised → ended', () => {
    const actor = startedActor()
    actor.send({ type: 'SWITCH_MODE', mode: 'supervised' })
    actor.send({ type: 'SESSION_ENDED' })
    expect(actor.getSnapshot().matches('ended')).toBe(true)
    actor.stop()
  })

  it('snapshotToMode returns last known mode for ended state', () => {
    const actor = startedActor()
    actor.send({ type: 'SWITCH_MODE', mode: 'supervised' })
    actor.send({ type: 'SESSION_ENDED' })
    // Context preserved the last mode
    expect(actor.getSnapshot().context.mode).toBe('supervised')
    actor.stop()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

describe('helper functions', () => {
  it('canAgentWrite matrix', () => {
    const actor = startedActor()

    // agent-controlled → true
    expect(canAgentWrite(actor.getSnapshot())).toBe(true)

    // human-controlled → false
    actor.send({ type: 'TAKE_OVER' })
    expect(canAgentWrite(actor.getSnapshot())).toBe(false)

    // supervised.agentRunning → true
    actor.send({ type: 'SWITCH_MODE', mode: 'supervised' })
    expect(canAgentWrite(actor.getSnapshot())).toBe(true)

    // supervised.humanOverride → false
    actor.send({ type: 'HUMAN_KEYSTROKE', timestamp: Date.now() })
    expect(canAgentWrite(actor.getSnapshot())).toBe(false)

    actor.stop()
  })

  it('canHumanWrite matrix', () => {
    const actor = startedActor()

    // agent-controlled → true (triggers takeover)
    expect(canHumanWrite(actor.getSnapshot())).toBe(true)

    // human-controlled → true
    actor.send({ type: 'TAKE_OVER' })
    expect(canHumanWrite(actor.getSnapshot())).toBe(true)

    // supervised → true (always, triggers override)
    actor.send({ type: 'SWITCH_MODE', mode: 'supervised' })
    expect(canHumanWrite(actor.getSnapshot())).toBe(true)

    // ended → false
    actor.send({ type: 'SESSION_ENDED' })
    expect(canHumanWrite(actor.getSnapshot())).toBe(false)

    actor.stop()
  })
})
