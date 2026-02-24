/**
 * Tests for Control Model schemas — ControlMode, ControlEvent, WS commands/events, ActivityEntry
 */
import { describe, it, expect } from 'bun:test'
import { Schema } from 'effect'
import {
  ControlMode,
  ControllerRole,
  RequestTakeover,
  YieldControl,
  AgentWrite,
  HumanKeystroke,
  ModeSwitch,
  ControlEvent,
  ActivitySource,
  ActivityEntry,
  ShellTakeControlCommand,
  ShellYieldControlCommand,
  ShellSwitchModeCommand,
  ShellControlChangedEvent,
  ShellCommand,
  ShellEvent,
  ShellSessionId,
} from '../schemas'

const decodeSync = <A, I>(schema: Schema.Schema<A, I>) =>
  Schema.decodeUnknownSync(schema)

const sid = 'shell-abc123' as ShellSessionId & string

// ─────────────────────────────────────────────────────────────────────────────
// ControlMode
// ─────────────────────────────────────────────────────────────────────────────

describe('ControlMode', () => {
  it('accepts all three modes', () => {
    expect(decodeSync(ControlMode)('agent-controlled')).toBe('agent-controlled')
    expect(decodeSync(ControlMode)('human-controlled')).toBe('human-controlled')
    expect(decodeSync(ControlMode)('supervised')).toBe('supervised')
  })

  it('rejects invalid mode', () => {
    expect(() => decodeSync(ControlMode)('auto')).toThrow()
    expect(() => decodeSync(ControlMode)('')).toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ControllerRole
// ─────────────────────────────────────────────────────────────────────────────

describe('ControllerRole', () => {
  it('accepts agent and human', () => {
    expect(decodeSync(ControllerRole)('agent')).toBe('agent')
    expect(decodeSync(ControllerRole)('human')).toBe('human')
  })

  it('rejects invalid role', () => {
    expect(() => decodeSync(ControllerRole)('system')).toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Control Events
// ─────────────────────────────────────────────────────────────────────────────

describe('RequestTakeover', () => {
  it('decodes valid event', () => {
    const e = decodeSync(RequestTakeover)({
      _tag: 'control:request_takeover',
      sessionId: sid,
      timestamp: Date.now(),
    })
    expect(e._tag).toBe('control:request_takeover')
    expect(e.sessionId).toBe(sid)
  })
})

describe('YieldControl', () => {
  it('decodes with from field', () => {
    const e = decodeSync(YieldControl)({
      _tag: 'control:yield',
      sessionId: sid,
      from: 'human',
      timestamp: 1000,
    })
    expect(e.from).toBe('human')
  })

  it('rejects invalid from', () => {
    expect(() =>
      decodeSync(YieldControl)({
        _tag: 'control:yield',
        sessionId: sid,
        from: 'system',
        timestamp: 1000,
      }),
    ).toThrow()
  })
})

describe('AgentWrite', () => {
  it('decodes with data field', () => {
    const e = decodeSync(AgentWrite)({
      _tag: 'control:agent_write',
      sessionId: sid,
      data: 'ls -la\n',
      timestamp: 1000,
    })
    expect(e.data).toBe('ls -la\n')
  })
})

describe('HumanKeystroke', () => {
  it('tracks byte count not content', () => {
    const e = decodeSync(HumanKeystroke)({
      _tag: 'control:human_keystroke',
      sessionId: sid,
      byteCount: 3,
      timestamp: 1000,
    })
    expect(e.byteCount).toBe(3)
  })
})

describe('ModeSwitch', () => {
  it('decodes mode switch', () => {
    const e = decodeSync(ModeSwitch)({
      _tag: 'control:mode_switch',
      sessionId: sid,
      mode: 'supervised',
      timestamp: 1000,
    })
    expect(e.mode).toBe('supervised')
  })
})

describe('ControlEvent (union)', () => {
  it('discriminates by _tag', () => {
    const takeover = decodeSync(ControlEvent)({
      _tag: 'control:request_takeover',
      sessionId: sid,
      timestamp: 1000,
    })
    expect(takeover._tag).toBe('control:request_takeover')

    const agentWrite = decodeSync(ControlEvent)({
      _tag: 'control:agent_write',
      sessionId: sid,
      data: 'pwd\n',
      timestamp: 2000,
    })
    expect(agentWrite._tag).toBe('control:agent_write')
  })

  it('rejects unknown _tag', () => {
    expect(() =>
      decodeSync(ControlEvent)({
        _tag: 'control:unknown',
        sessionId: sid,
        timestamp: 1000,
      }),
    ).toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ActivityEntry
// ─────────────────────────────────────────────────────────────────────────────

describe('ActivityEntry', () => {
  it('decodes full entry', () => {
    const e = decodeSync(ActivityEntry)({
      source: 'agent',
      action: 'Sent command',
      timestamp: 1000,
      command: 'ls -la',
    })
    expect(e.source).toBe('agent')
    expect(e.command).toBe('ls -la')
  })

  it('decodes without optional command', () => {
    const e = decodeSync(ActivityEntry)({
      source: 'system',
      action: 'Session started',
      timestamp: 1000,
    })
    expect(e.source).toBe('system')
    expect(e.command).toBeUndefined()
  })

  it('accepts all three sources', () => {
    expect(decodeSync(ActivitySource)('agent')).toBe('agent')
    expect(decodeSync(ActivitySource)('human')).toBe('human')
    expect(decodeSync(ActivitySource)('system')).toBe('system')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Control WS Commands
// ─────────────────────────────────────────────────────────────────────────────

describe('ShellTakeControlCommand', () => {
  it('decodes', () => {
    const cmd = decodeSync(ShellTakeControlCommand)({
      _tag: 'remote:shell_take_control',
      sessionId: sid,
    })
    expect(cmd._tag).toBe('remote:shell_take_control')
  })
})

describe('ShellSwitchModeCommand', () => {
  it('decodes with mode', () => {
    const cmd = decodeSync(ShellSwitchModeCommand)({
      _tag: 'remote:shell_switch_mode',
      sessionId: sid,
      mode: 'supervised',
    })
    expect(cmd.mode).toBe('supervised')
  })

  it('rejects invalid mode', () => {
    expect(() =>
      decodeSync(ShellSwitchModeCommand)({
        _tag: 'remote:shell_switch_mode',
        sessionId: sid,
        mode: 'invalid',
      }),
    ).toThrow()
  })
})

describe('ShellCommand (union includes control commands)', () => {
  it('accepts take_control', () => {
    const cmd = decodeSync(ShellCommand)({
      _tag: 'remote:shell_take_control',
      sessionId: sid,
    })
    expect(cmd._tag).toBe('remote:shell_take_control')
  })

  it('accepts yield_control', () => {
    const cmd = decodeSync(ShellCommand)({
      _tag: 'remote:shell_yield_control',
      sessionId: sid,
    })
    expect(cmd._tag).toBe('remote:shell_yield_control')
  })

  it('accepts switch_mode', () => {
    const cmd = decodeSync(ShellCommand)({
      _tag: 'remote:shell_switch_mode',
      sessionId: sid,
      mode: 'human-controlled',
    })
    expect(cmd._tag).toBe('remote:shell_switch_mode')
  })

  it('still accepts original commands', () => {
    const cmd = decodeSync(ShellCommand)({
      _tag: 'remote:shell_input',
      sessionId: sid,
      data: 'hello',
    })
    expect(cmd._tag).toBe('remote:shell_input')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ShellControlChangedEvent
// ─────────────────────────────────────────────────────────────────────────────

describe('ShellControlChangedEvent', () => {
  it('decodes', () => {
    const e = decodeSync(ShellControlChangedEvent)({
      _tag: 'shell:control_changed',
      sessionId: sid,
      mode: 'human-controlled',
      controller: 'human',
      timestamp: 1000,
    })
    expect(e.mode).toBe('human-controlled')
    expect(e.controller).toBe('human')
  })
})

describe('ShellEvent (union includes control_changed)', () => {
  it('accepts control_changed', () => {
    const e = decodeSync(ShellEvent)({
      _tag: 'shell:control_changed',
      sessionId: sid,
      mode: 'supervised',
      controller: 'agent',
      timestamp: 1000,
    })
    expect(e._tag).toBe('shell:control_changed')
  })

  it('still accepts original events', () => {
    const e = decodeSync(ShellEvent)({
      _tag: 'shell:data',
      sessionId: sid,
      data: 'hello',
    })
    expect(e._tag).toBe('shell:data')
  })
})
