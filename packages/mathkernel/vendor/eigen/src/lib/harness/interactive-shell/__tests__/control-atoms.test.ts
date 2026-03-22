/**
 * Tests for control model atom wiring — machine ↔ atom sync,
 * activity log, throughput metrics, agent writing indicator.
 */
import { describe, it, expect, beforeEach } from 'bun:test'
import { Registry } from '@effect-atom/atom-react'
import {
  shellSessionFamily,
  setShellRegistry,
  dispatchShellEvent,
  cleanupSession,
  notifyAgentWrite,
  clearAgentWriting,
  notifyHumanKeystroke,
  getControlActor,
  sendShellTakeControl,
  sendShellYieldControl,
  sendShellSwitchMode,
  registerShellCommandSender,
  clearShellCommandSender,
} from '../shell-session-atoms'
import type { ShellSessionId, ShellSessionInfo } from '../schemas'

const sid = 'shell-ctrl-test' as ShellSessionId & string

function makeInfo(): ShellSessionInfo {
  return {
    sessionId: sid as ShellSessionId,
    shell: '/bin/bash',
    cwd: '/home/test',
    cols: 120,
    rows: 24,
    status: 'running',
    createdAt: Date.now(),
    pid: 12345,
  }
}

let registry: Registry.Registry

beforeEach(() => {
  cleanupSession(sid)
  registry = Registry.make()
  setShellRegistry(registry)
})

// ─────────────────────────────────────────────────────────────────────────────
// Control Mode Atoms
// ─────────────────────────────────────────────────────────────────────────────

describe('control mode atom sync', () => {
  it('initializes to agent-controlled', () => {
    const session = shellSessionFamily(sid)
    expect(registry.get(session.controlMode$)).toBe('agent-controlled')
    expect(registry.get(session.controller$)).toBe('agent')
  })

  it('shell:started creates control actor and syncs atoms', () => {
    dispatchShellEvent({
      _tag: 'shell:started',
      sessionId: sid as ShellSessionId,
      info: makeInfo(),
    })
    const session = shellSessionFamily(sid)
    // After started, actor is created → atoms synced
    expect(registry.get(session.controlMode$)).toBe('agent-controlled')
    expect(registry.get(session.controller$)).toBe('agent')
  })

  it('notifyHumanKeystroke triggers takeover in agent-controlled mode', () => {
    dispatchShellEvent({
      _tag: 'shell:started',
      sessionId: sid as ShellSessionId,
      info: makeInfo(),
    })
    notifyHumanKeystroke(sid, 1)
    const session = shellSessionFamily(sid)
    // Machine should have transitioned to humanControlled
    expect(registry.get(session.controlMode$)).toBe('human-controlled')
    expect(registry.get(session.controller$)).toBe('human')
  })

  it('shell:control_changed event updates atoms', () => {
    dispatchShellEvent({
      _tag: 'shell:started',
      sessionId: sid as ShellSessionId,
      info: makeInfo(),
    })
    dispatchShellEvent({
      _tag: 'shell:control_changed',
      sessionId: sid as ShellSessionId,
      mode: 'supervised',
      controller: 'agent',
      timestamp: Date.now(),
    })
    const session = shellSessionFamily(sid)
    expect(registry.get(session.controlMode$)).toBe('supervised')
    expect(registry.get(session.controller$)).toBe('agent')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Agent Writing Indicator
// ─────────────────────────────────────────────────────────────────────────────

describe('agent writing indicator', () => {
  it('notifyAgentWrite sets agentWriting$ true', () => {
    dispatchShellEvent({
      _tag: 'shell:started',
      sessionId: sid as ShellSessionId,
      info: makeInfo(),
    })
    const session = shellSessionFamily(sid)
    expect(registry.get(session.agentWriting$)).toBe(false)
    notifyAgentWrite(sid, 'ls -la\n')
    expect(registry.get(session.agentWriting$)).toBe(true)
  })

  it('clearAgentWriting sets agentWriting$ false', () => {
    dispatchShellEvent({
      _tag: 'shell:started',
      sessionId: sid as ShellSessionId,
      info: makeInfo(),
    })
    notifyAgentWrite(sid, 'pwd\n')
    clearAgentWriting(sid)
    const session = shellSessionFamily(sid)
    expect(registry.get(session.agentWriting$)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Throughput Metrics
// ─────────────────────────────────────────────────────────────────────────────

describe('throughput metrics', () => {
  it('shell:data increments bytesOut$', () => {
    dispatchShellEvent({
      _tag: 'shell:started',
      sessionId: sid as ShellSessionId,
      info: makeInfo(),
    })
    const session = shellSessionFamily(sid)
    expect(registry.get(session.bytesOut$)).toBe(0)

    dispatchShellEvent({
      _tag: 'shell:data',
      sessionId: sid as ShellSessionId,
      data: 'hello world', // 11 bytes
    })
    expect(registry.get(session.bytesOut$)).toBe(11)

    dispatchShellEvent({
      _tag: 'shell:data',
      sessionId: sid as ShellSessionId,
      data: 'more', // 4 bytes
    })
    expect(registry.get(session.bytesOut$)).toBe(15)
  })

  it('notifyAgentWrite increments bytesIn$ and commandCount$', () => {
    dispatchShellEvent({
      _tag: 'shell:started',
      sessionId: sid as ShellSessionId,
      info: makeInfo(),
    })
    const session = shellSessionFamily(sid)
    notifyAgentWrite(sid, 'ls -la\n') // 7 bytes, 1 command
    expect(registry.get(session.bytesIn$)).toBe(7)
    expect(registry.get(session.commandCount$)).toBe(1)

    notifyAgentWrite(sid, 'pwd\n') // 4 bytes, 1 command
    expect(registry.get(session.bytesIn$)).toBe(11)
    expect(registry.get(session.commandCount$)).toBe(2)
  })

  it('notifyHumanKeystroke increments bytesIn$', () => {
    dispatchShellEvent({
      _tag: 'shell:started',
      sessionId: sid as ShellSessionId,
      info: makeInfo(),
    })
    const session = shellSessionFamily(sid)
    notifyHumanKeystroke(sid, 5)
    expect(registry.get(session.bytesIn$)).toBe(5)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Activity Log
// ─────────────────────────────────────────────────────────────────────────────

describe('activity log', () => {
  it('shell:started adds system entry', () => {
    dispatchShellEvent({
      _tag: 'shell:started',
      sessionId: sid as ShellSessionId,
      info: makeInfo(),
    })
    const session = shellSessionFamily(sid)
    const log = registry.get(session.activityLog$)
    expect(log.length).toBe(1)
    expect(log[0].source).toBe('system')
    expect(log[0].action).toBe('Session started')
  })

  it('notifyAgentWrite adds agent entry with command', () => {
    dispatchShellEvent({
      _tag: 'shell:started',
      sessionId: sid as ShellSessionId,
      info: makeInfo(),
    })
    notifyAgentWrite(sid, 'npm install\n')
    const session = shellSessionFamily(sid)
    const log = registry.get(session.activityLog$)
    const agentEntry = log.find((e) => e.source === 'agent')
    expect(agentEntry).toBeDefined()
    expect(agentEntry!.command).toBe('npm install')
  })

  it('shell:exited adds system entry with exit code', () => {
    dispatchShellEvent({
      _tag: 'shell:started',
      sessionId: sid as ShellSessionId,
      info: makeInfo(),
    })
    dispatchShellEvent({
      _tag: 'shell:exited',
      sessionId: sid as ShellSessionId,
      exitCode: 0,
    })
    const session = shellSessionFamily(sid)
    const log = registry.get(session.activityLog$)
    const exitEntry = log.find((e) => e.action.includes('Exited'))
    expect(exitEntry).toBeDefined()
    expect(exitEntry!.action).toBe('Exited with code 0')
  })

  it('shell:control_changed adds system entry', () => {
    dispatchShellEvent({
      _tag: 'shell:started',
      sessionId: sid as ShellSessionId,
      info: makeInfo(),
    })
    dispatchShellEvent({
      _tag: 'shell:control_changed',
      sessionId: sid as ShellSessionId,
      mode: 'human-controlled',
      controller: 'human',
      timestamp: Date.now(),
    })
    const session = shellSessionFamily(sid)
    const log = registry.get(session.activityLog$)
    const ctrlEntry = log.find((e) => e.action.includes('Control'))
    expect(ctrlEntry).toBeDefined()
    expect(ctrlEntry!.action).toContain('human')
  })

  it('truncates long commands to 200 chars', () => {
    dispatchShellEvent({
      _tag: 'shell:started',
      sessionId: sid as ShellSessionId,
      info: makeInfo(),
    })
    const longCmd = 'a'.repeat(300) + '\n'
    notifyAgentWrite(sid, longCmd)
    const session = shellSessionFamily(sid)
    const log = registry.get(session.activityLog$)
    const entry = log.find((e) => e.source === 'agent')!
    expect(entry.command!.length).toBeLessThanOrEqual(201) // 200 + '…'
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Control Command Senders
// ─────────────────────────────────────────────────────────────────────────────

describe('control command senders', () => {
  it('sendShellTakeControl dispatches correct WS command', () => {
    const sent: any[] = []
    registerShellCommandSender((cmd) => sent.push(cmd))
    sendShellTakeControl(sid)
    expect(sent).toHaveLength(1)
    expect(sent[0]._tag).toBe('remote:shell_take_control')
    expect(sent[0].sessionId).toBe(sid)
    clearShellCommandSender()
  })

  it('sendShellYieldControl dispatches correct WS command', () => {
    const sent: any[] = []
    registerShellCommandSender((cmd) => sent.push(cmd))
    sendShellYieldControl(sid)
    expect(sent).toHaveLength(1)
    expect(sent[0]._tag).toBe('remote:shell_yield_control')
    clearShellCommandSender()
  })

  it('sendShellSwitchMode dispatches with mode', () => {
    const sent: any[] = []
    registerShellCommandSender((cmd) => sent.push(cmd))
    sendShellSwitchMode(sid, 'supervised')
    expect(sent).toHaveLength(1)
    expect(sent[0]._tag).toBe('remote:shell_switch_mode')
    expect(sent[0].mode).toBe('supervised')
    clearShellCommandSender()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Cleanup
// ─────────────────────────────────────────────────────────────────────────────

describe('cleanup stops control actor', () => {
  it('cleanupSession stops the actor', () => {
    dispatchShellEvent({
      _tag: 'shell:started',
      sessionId: sid as ShellSessionId,
      info: makeInfo(),
    })
    const actor = getControlActor(sid)
    expect(actor.getSnapshot().status).toBe('active')
    cleanupSession(sid)
    // Actor should be stopped (status = 'done' after SESSION_ENDED → ended final state)
    expect(actor.getSnapshot().status).toBe('done')
  })
})
