/**
 * Shell Session Atoms Tests — Atom.family, dispatch, hot/cold channels.
 *
 * Tests the reactive state layer used by React components.
 * Uses effect-atom Registry directly (no React rendering needed).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Registry } from '@effect-atom/atom-react'
import {
  shellSessionFamily,
  activeSessionIds$,
  activeSessionCount$,
  subscribeShellData,
  dispatchShellEvent,
  cleanupSession,
  setShellRegistry,
} from '../shell-session-atoms'
import type { ShellEvent, ShellSessionInfo } from '../schemas'

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

let registry: Registry.Registry

beforeEach(() => {
  registry = Registry.make()
  setShellRegistry(registry)
  // Reset active sessions
  registry.set(activeSessionIds$, [])
})

afterEach(() => {
  // Clean up any lingering sessions
  const ids = registry.get(activeSessionIds$)
  for (const id of ids) {
    cleanupSession(id)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Atom.family identity
// ─────────────────────────────────────────────────────────────────────────────

describe('shellSessionFamily', () => {
  it('returns same atom bundle for same session ID', () => {
    const a = shellSessionFamily('shell-abc')
    const b = shellSessionFamily('shell-abc')
    expect(a.status$).toBe(b.status$)
    expect(a.info$).toBe(b.info$)
    expect(a.exitCode$).toBe(b.exitCode$)
    expect(a.error$).toBe(b.error$)
    expect(a.outputSeq$).toBe(b.outputSeq$)
  })

  it('returns different atom bundle for different session IDs', () => {
    const a = shellSessionFamily('shell-1')
    const b = shellSessionFamily('shell-2')
    expect(a.status$).not.toBe(b.status$)
  })

  it('initial status is "starting"', () => {
    const session = shellSessionFamily('shell-init')
    expect(registry.get(session.status$)).toBe('starting')
  })

  it('initial info is null', () => {
    const session = shellSessionFamily('shell-init2')
    expect(registry.get(session.info$)).toBeNull()
  })

  it('initial exitCode is null', () => {
    const session = shellSessionFamily('shell-init3')
    expect(registry.get(session.exitCode$)).toBeNull()
  })

  it('initial error is null', () => {
    const session = shellSessionFamily('shell-init4')
    expect(registry.get(session.error$)).toBeNull()
  })

  it('initial outputSeq is 0', () => {
    const session = shellSessionFamily('shell-init5')
    expect(registry.get(session.outputSeq$)).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// dispatchShellEvent — cold path (atom updates)
// ─────────────────────────────────────────────────────────────────────────────

describe('dispatchShellEvent — cold path', () => {
  it('shell:started sets status to running + stores info', () => {
    const info: ShellSessionInfo = {
      sessionId: 'shell-dispatch-1',
      name: 'test',
      pid: 1234,
      shell: '/bin/bash',
      cwd: '/tmp',
      cols: 120,
      rows: 24,
      status: 'running',
      createdAt: Date.now(),
    }
    const event: ShellEvent = {
      _tag: 'shell:started',
      sessionId: 'shell-dispatch-1',
      info,
    }

    dispatchShellEvent(event)

    const session = shellSessionFamily('shell-dispatch-1')
    expect(registry.get(session.status$)).toBe('running')
    expect(registry.get(session.info$)).toEqual(info)
  })

  it('shell:exited sets status to exited + stores exit code', () => {
    const event: ShellEvent = {
      _tag: 'shell:exited',
      sessionId: 'shell-dispatch-2',
      exitCode: 42,
    }

    dispatchShellEvent(event)

    const session = shellSessionFamily('shell-dispatch-2')
    expect(registry.get(session.status$)).toBe('exited')
    expect(registry.get(session.exitCode$)).toBe(42)
  })

  it('shell:error sets status to error + stores message', () => {
    const event: ShellEvent = {
      _tag: 'shell:error',
      sessionId: 'shell-dispatch-3',
      message: 'spawn failed',
    }

    dispatchShellEvent(event)

    const session = shellSessionFamily('shell-dispatch-3')
    expect(registry.get(session.status$)).toBe('error')
    expect(registry.get(session.error$)).toBe('spawn failed')
  })

  it('shell:data bumps outputSeq counter', () => {
    const session = shellSessionFamily('shell-dispatch-4')
    expect(registry.get(session.outputSeq$)).toBe(0)

    dispatchShellEvent({
      _tag: 'shell:data',
      sessionId: 'shell-dispatch-4',
      data: 'hello',
    } as ShellEvent)

    expect(registry.get(session.outputSeq$)).toBe(1)

    dispatchShellEvent({
      _tag: 'shell:data',
      sessionId: 'shell-dispatch-4',
      data: 'world',
    } as ShellEvent)

    expect(registry.get(session.outputSeq$)).toBe(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// dispatchShellEvent — hot path (data listeners)
// ─────────────────────────────────────────────────────────────────────────────

describe('dispatchShellEvent — hot path', () => {
  it('fans out data to subscribers', () => {
    const received: string[] = []
    const unsub = subscribeShellData('shell-hot-1', (data) => {
      received.push(data)
    })

    dispatchShellEvent({
      _tag: 'shell:data',
      sessionId: 'shell-hot-1',
      data: 'chunk1',
    } as ShellEvent)

    dispatchShellEvent({
      _tag: 'shell:data',
      sessionId: 'shell-hot-1',
      data: 'chunk2',
    } as ShellEvent)

    expect(received).toEqual(['chunk1', 'chunk2'])
    unsub()
  })

  it('supports multiple subscribers', () => {
    const a: string[] = []
    const b: string[] = []

    const unsub1 = subscribeShellData('shell-hot-2', (d) => a.push(d))
    const unsub2 = subscribeShellData('shell-hot-2', (d) => b.push(d))

    dispatchShellEvent({
      _tag: 'shell:data',
      sessionId: 'shell-hot-2',
      data: 'hello',
    } as ShellEvent)

    expect(a).toEqual(['hello'])
    expect(b).toEqual(['hello'])

    unsub1()
    unsub2()
  })

  it('unsubscribe stops delivery', () => {
    const received: string[] = []
    const unsub = subscribeShellData('shell-hot-3', (d) => received.push(d))

    dispatchShellEvent({
      _tag: 'shell:data',
      sessionId: 'shell-hot-3',
      data: 'before',
    } as ShellEvent)

    unsub()

    dispatchShellEvent({
      _tag: 'shell:data',
      sessionId: 'shell-hot-3',
      data: 'after',
    } as ShellEvent)

    expect(received).toEqual(['before'])
  })

  it('isolates sessions (no cross-talk)', () => {
    const a: string[] = []
    const b: string[] = []

    const unsub1 = subscribeShellData('shell-hot-4a', (d) => a.push(d))
    const unsub2 = subscribeShellData('shell-hot-4b', (d) => b.push(d))

    dispatchShellEvent({
      _tag: 'shell:data',
      sessionId: 'shell-hot-4a',
      data: 'for-a',
    } as ShellEvent)

    expect(a).toEqual(['for-a'])
    expect(b).toEqual([])

    unsub1()
    unsub2()
  })

  it('bad listener does not break fan-out', () => {
    const good: string[] = []

    const unsub1 = subscribeShellData('shell-hot-5', () => {
      throw new Error('bad listener')
    })
    const unsub2 = subscribeShellData('shell-hot-5', (d) => good.push(d))

    // Should not throw
    dispatchShellEvent({
      _tag: 'shell:data',
      sessionId: 'shell-hot-5',
      data: 'resilient',
    } as ShellEvent)

    expect(good).toEqual(['resilient'])

    unsub1()
    unsub2()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Active session tracking
// ─────────────────────────────────────────────────────────────────────────────

describe('active session tracking', () => {
  it('adds session to activeSessionIds$ on first event', () => {
    expect(registry.get(activeSessionIds$)).toEqual([])

    dispatchShellEvent({
      _tag: 'shell:data',
      sessionId: 'shell-track-1',
      data: 'x',
    } as ShellEvent)

    expect(registry.get(activeSessionIds$)).toContain('shell-track-1')
  })

  it('does not duplicate session ID on multiple events', () => {
    dispatchShellEvent({
      _tag: 'shell:data',
      sessionId: 'shell-track-2',
      data: 'a',
    } as ShellEvent)

    dispatchShellEvent({
      _tag: 'shell:data',
      sessionId: 'shell-track-2',
      data: 'b',
    } as ShellEvent)

    const ids = registry.get(activeSessionIds$)
    const count = ids.filter((id) => id === 'shell-track-2').length
    expect(count).toBe(1)
  })

  it('cleanupSession removes from activeSessionIds$', () => {
    dispatchShellEvent({
      _tag: 'shell:data',
      sessionId: 'shell-track-3',
      data: 'x',
    } as ShellEvent)

    expect(registry.get(activeSessionIds$)).toContain('shell-track-3')

    cleanupSession('shell-track-3')

    expect(registry.get(activeSessionIds$)).not.toContain('shell-track-3')
  })

  it('cleanupSession also removes data listeners', () => {
    const received: string[] = []
    const unsub = subscribeShellData('shell-track-4', (d) => received.push(d))

    cleanupSession('shell-track-4')

    dispatchShellEvent({
      _tag: 'shell:data',
      sessionId: 'shell-track-4',
      data: 'should-not-arrive',
    } as ShellEvent)

    expect(received).toEqual([])
    unsub() // no-op but safe
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// activeSessionCount$ (derived)
// ─────────────────────────────────────────────────────────────────────────────

describe('activeSessionCount$', () => {
  it('counts only running/starting sessions', () => {
    // Add two sessions, one running one exited
    dispatchShellEvent({
      _tag: 'shell:started',
      sessionId: 'shell-count-1',
      info: { sessionId: 'shell-count-1', status: 'running' } as any,
    })

    dispatchShellEvent({
      _tag: 'shell:exited',
      sessionId: 'shell-count-2',
      exitCode: 0,
    } as ShellEvent)

    const count = registry.get(activeSessionCount$)
    // shell-count-1 is running, shell-count-2 is exited
    expect(count).toBe(1)
  })
})
