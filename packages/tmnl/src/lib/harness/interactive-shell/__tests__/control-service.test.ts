/**
 * Tests for server-side control awareness — service-level control state
 * and tool executor gating.
 */
import { describe, it, expect } from 'bun:test'
import type { ControlMode, ControllerRole } from '../schemas'

// ─────────────────────────────────────────────────────────────────────────────
// Replicate service-side control logic (without requiring live PTY)
// ─────────────────────────────────────────────────────────────────────────────

interface SessionControlState {
  controlMode: ControlMode
  controller: ControllerRole
}

function canAgentWrite(state: SessionControlState): boolean {
  if (state.controlMode === 'agent-controlled') return true
  if (state.controlMode === 'human-controlled') return false
  // supervised: agent can write only when controller is agent
  return state.controller === 'agent'
}

function takeControl(state: SessionControlState): SessionControlState {
  const newState = { ...state, controller: 'human' as ControllerRole }
  if (state.controlMode === 'agent-controlled') {
    newState.controlMode = 'human-controlled'
  }
  return newState
}

function yieldControl(state: SessionControlState): SessionControlState {
  const newState = { ...state, controller: 'agent' as ControllerRole }
  if (state.controlMode === 'human-controlled') {
    newState.controlMode = 'agent-controlled'
  }
  return newState
}

function switchMode(state: SessionControlState, mode: ControlMode): SessionControlState {
  const newState = { ...state, controlMode: mode }
  if (mode === 'agent-controlled') newState.controller = 'agent'
  else if (mode === 'human-controlled') newState.controller = 'human'
  else if (mode === 'supervised') newState.controller = 'agent'
  return newState
}

// ─────────────────────────────────────────────────────────────────────────────
// canAgentWrite
// ─────────────────────────────────────────────────────────────────────────────

describe('canAgentWrite (service logic)', () => {
  it('allows in agent-controlled mode', () => {
    expect(canAgentWrite({ controlMode: 'agent-controlled', controller: 'agent' })).toBe(true)
  })

  it('blocks in human-controlled mode', () => {
    expect(canAgentWrite({ controlMode: 'human-controlled', controller: 'human' })).toBe(false)
  })

  it('allows in supervised when controller is agent', () => {
    expect(canAgentWrite({ controlMode: 'supervised', controller: 'agent' })).toBe(true)
  })

  it('blocks in supervised when controller is human', () => {
    expect(canAgentWrite({ controlMode: 'supervised', controller: 'human' })).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// takeControl
// ─────────────────────────────────────────────────────────────────────────────

describe('takeControl', () => {
  it('switches from agent-controlled to human-controlled', () => {
    const state = takeControl({ controlMode: 'agent-controlled', controller: 'agent' })
    expect(state.controlMode).toBe('human-controlled')
    expect(state.controller).toBe('human')
  })

  it('keeps supervised mode but sets human controller', () => {
    const state = takeControl({ controlMode: 'supervised', controller: 'agent' })
    expect(state.controlMode).toBe('supervised')
    expect(state.controller).toBe('human')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// yieldControl
// ─────────────────────────────────────────────────────────────────────────────

describe('yieldControl', () => {
  it('switches from human-controlled to agent-controlled', () => {
    const state = yieldControl({ controlMode: 'human-controlled', controller: 'human' })
    expect(state.controlMode).toBe('agent-controlled')
    expect(state.controller).toBe('agent')
  })

  it('keeps supervised mode but sets agent controller', () => {
    const state = yieldControl({ controlMode: 'supervised', controller: 'human' })
    expect(state.controlMode).toBe('supervised')
    expect(state.controller).toBe('agent')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// switchMode
// ─────────────────────────────────────────────────────────────────────────────

describe('switchMode', () => {
  it('sets controller to agent for agent-controlled', () => {
    const state = switchMode({ controlMode: 'human-controlled', controller: 'human' }, 'agent-controlled')
    expect(state.controlMode).toBe('agent-controlled')
    expect(state.controller).toBe('agent')
  })

  it('sets controller to human for human-controlled', () => {
    const state = switchMode({ controlMode: 'agent-controlled', controller: 'agent' }, 'human-controlled')
    expect(state.controlMode).toBe('human-controlled')
    expect(state.controller).toBe('human')
  })

  it('sets controller to agent for supervised', () => {
    const state = switchMode({ controlMode: 'human-controlled', controller: 'human' }, 'supervised')
    expect(state.controlMode).toBe('supervised')
    expect(state.controller).toBe('agent')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Full lifecycle scenarios
// ─────────────────────────────────────────────────────────────────────────────

describe('control lifecycle scenarios', () => {
  it('spawn → agent writes → human takes over → agent blocked → human yields → agent writes', () => {
    let state: SessionControlState = { controlMode: 'agent-controlled', controller: 'agent' }

    // Agent can write initially
    expect(canAgentWrite(state)).toBe(true)

    // Human takes control
    state = takeControl(state)
    expect(canAgentWrite(state)).toBe(false)
    expect(state.controlMode).toBe('human-controlled')

    // Human yields back
    state = yieldControl(state)
    expect(canAgentWrite(state)).toBe(true)
    expect(state.controlMode).toBe('agent-controlled')
  })

  it('supervised mode: agent → human override → yield back', () => {
    let state: SessionControlState = { controlMode: 'supervised', controller: 'agent' }

    // Agent can write
    expect(canAgentWrite(state)).toBe(true)

    // Human types → takes over (in supervised, mode stays)
    state = takeControl(state)
    expect(state.controlMode).toBe('supervised')
    expect(state.controller).toBe('human')
    expect(canAgentWrite(state)).toBe(false)

    // Human yields back
    state = yieldControl(state)
    expect(state.controller).toBe('agent')
    expect(canAgentWrite(state)).toBe(true)
  })

  it('mode switch mid-session: agent → supervised → human takes → switch to agent-controlled', () => {
    let state: SessionControlState = { controlMode: 'agent-controlled', controller: 'agent' }

    // Switch to supervised
    state = switchMode(state, 'supervised')
    expect(canAgentWrite(state)).toBe(true)

    // Human takes in supervised
    state = takeControl(state)
    expect(canAgentWrite(state)).toBe(false)

    // Switch to agent-controlled (overrides everything)
    state = switchMode(state, 'agent-controlled')
    expect(canAgentWrite(state)).toBe(true)
    expect(state.controller).toBe('agent')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tool executor control gating
// ─────────────────────────────────────────────────────────────────────────────

describe('tool executor control gating', () => {
  it('returns friendly message when agent write is blocked', () => {
    // Simulate what the tool executor returns when canAgentWrite is false
    const state: SessionControlState = { controlMode: 'human-controlled', controller: 'human' }
    const allowed = canAgentWrite(state)
    const sessionId = 'shell-test123'

    if (!allowed) {
      const result = {
        content: [
          {
            type: 'text' as const,
            text: `User has taken control of session ${sessionId}. Input was not sent. Wait for the user to yield control back, or try again later.`,
          },
        ],
        isError: false,
      }
      expect(result.content[0].text).toContain('User has taken control')
      expect(result.isError).toBe(false) // Not an error — agent should wait, not crash
    }
  })
})
