/**
 * Replay Buffer Tests — verifies data buffering when no listener is subscribed.
 *
 * Covers the critical timing window between:
 *   1. Tool execution starts → shell:data events dispatched (no listener yet)
 *   2. React renderer mounts → subscribeShellData() called
 *   3. Buffered data replayed into the new listener
 *
 * This is the fix for the "empty terminal" bug where the ghostty-web terminal
 * mounted but showed nothing because the initial PTY output (prompt, command
 * echo) was dispatched and dropped before the renderer subscribed.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Registry } from '@effect-atom/atom-react'
import {
  shellSessionFamily,
  subscribeShellData,
  dispatchShellEvent,
  cleanupSession,
  setShellRegistry,
  activeSessionIds$,
} from '../shell-session-atoms'
import type { ShellEvent } from '../schemas'

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

let registry: Registry.Registry

beforeEach(() => {
  registry = Registry.make()
  setShellRegistry(registry)
  registry.set(activeSessionIds$, [])
})

afterEach(() => {
  const ids = registry.get(activeSessionIds$)
  for (const id of ids) cleanupSession(id)
})

function dispatchData(sessionId: string, data: string) {
  dispatchShellEvent({ _tag: 'shell:data', sessionId, data } as ShellEvent)
}

// ─────────────────────────────────────────────────────────────────────────────
// Core replay behavior
// ─────────────────────────────────────────────────────────────────────────────

describe('replay buffer — core', () => {
  it('buffers data when no listener is subscribed', () => {
    // Dispatch data BEFORE any listener
    dispatchData('shell-replay-1', 'prompt$ ')
    dispatchData('shell-replay-1', 'echo hello\r\n')
    dispatchData('shell-replay-1', 'hello\r\n')

    // Now subscribe — should replay all buffered data
    const received: string[] = []
    const unsub = subscribeShellData('shell-replay-1', (d) => received.push(d))

    expect(received).toEqual(['prompt$ ', 'echo hello\r\n', 'hello\r\n'])
    unsub()
  })

  it('replays in correct chronological order', () => {
    dispatchData('shell-order', 'A')
    dispatchData('shell-order', 'B')
    dispatchData('shell-order', 'C')
    dispatchData('shell-order', 'D')
    dispatchData('shell-order', 'E')

    const received: string[] = []
    const unsub = subscribeShellData('shell-order', (d) => received.push(d))

    expect(received).toEqual(['A', 'B', 'C', 'D', 'E'])
    unsub()
  })

  it('clears buffer after first subscriber drains it', () => {
    dispatchData('shell-clear', 'buffered')

    // First subscriber gets replay
    const first: string[] = []
    const unsub1 = subscribeShellData('shell-clear', (d) => first.push(d))
    expect(first).toEqual(['buffered'])
    unsub1()

    // Second subscriber does NOT get the old replay
    const second: string[] = []
    const unsub2 = subscribeShellData('shell-clear', (d) => second.push(d))
    expect(second).toEqual([])
    unsub2()
  })

  it('transitions from buffering to live delivery after subscriber attaches', () => {
    // Phase 1: buffer
    dispatchData('shell-transition', 'before-sub')

    // Phase 2: subscribe — gets replay
    const received: string[] = []
    const unsub = subscribeShellData('shell-transition', (d) => received.push(d))
    expect(received).toEqual(['before-sub'])

    // Phase 3: new data goes live (not buffered)
    dispatchData('shell-transition', 'after-sub')
    expect(received).toEqual(['before-sub', 'after-sub'])

    unsub()
  })

  it('does not buffer when a listener IS subscribed', () => {
    const received: string[] = []
    const unsub = subscribeShellData('shell-no-buffer', (d) => received.push(d))

    dispatchData('shell-no-buffer', 'live-data')

    // Unsubscribe, re-subscribe — should NOT get 'live-data' replayed
    unsub()
    const second: string[] = []
    const unsub2 = subscribeShellData('shell-no-buffer', (d) => second.push(d))
    expect(second).toEqual([])
    unsub2()
  })

  it('buffers again when all listeners unsubscribe', () => {
    // Subscribe, get live data
    const first: string[] = []
    const unsub1 = subscribeShellData('shell-rebuffer', (d) => first.push(d))
    dispatchData('shell-rebuffer', 'live')
    expect(first).toEqual(['live'])
    unsub1()

    // No listeners — should buffer
    dispatchData('shell-rebuffer', 'buffered-after-unsub')

    // Re-subscribe — should replay
    const second: string[] = []
    const unsub2 = subscribeShellData('shell-rebuffer', (d) => second.push(d))
    expect(second).toEqual(['buffered-after-unsub'])
    unsub2()
  })

  it('empty buffer produces no replay', () => {
    // Subscribe without any prior data
    const received: string[] = []
    const unsub = subscribeShellData('shell-empty', (d) => received.push(d))
    expect(received).toEqual([])
    unsub()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Session isolation
// ─────────────────────────────────────────────────────────────────────────────

describe('replay buffer — session isolation', () => {
  it('buffers are per-session (no cross-contamination)', () => {
    dispatchData('shell-iso-a', 'data-for-A')
    dispatchData('shell-iso-b', 'data-for-B')

    const receivedA: string[] = []
    const receivedB: string[] = []

    const unsubA = subscribeShellData('shell-iso-a', (d) => receivedA.push(d))
    const unsubB = subscribeShellData('shell-iso-b', (d) => receivedB.push(d))

    expect(receivedA).toEqual(['data-for-A'])
    expect(receivedB).toEqual(['data-for-B'])

    unsubA()
    unsubB()
  })

  it('subscribing to one session does not drain another', () => {
    dispatchData('shell-iso-c', 'buffered-c')
    dispatchData('shell-iso-d', 'buffered-d')

    // Only subscribe to C
    const receivedC: string[] = []
    const unsubC = subscribeShellData('shell-iso-c', (d) => receivedC.push(d))
    expect(receivedC).toEqual(['buffered-c'])
    unsubC()

    // D's buffer should still be intact
    const receivedD: string[] = []
    const unsubD = subscribeShellData('shell-iso-d', (d) => receivedD.push(d))
    expect(receivedD).toEqual(['buffered-d'])
    unsubD()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Buffer size limits
// ─────────────────────────────────────────────────────────────────────────────

describe('replay buffer — size limits', () => {
  it('trims from front when exceeding 64KB', () => {
    const sessionId = 'shell-limit'

    // Dispatch ~80KB of data in chunks
    const chunkSize = 1024 // 1KB per chunk
    const numChunks = 80  // 80KB total
    for (let i = 0; i < numChunks; i++) {
      dispatchData(sessionId, `chunk-${String(i).padStart(3, '0')}-${'x'.repeat(chunkSize - 15)}`)
    }

    // Subscribe — should get data, but not all of it
    const received: string[] = []
    const unsub = subscribeShellData(sessionId, (d) => received.push(d))

    // Total replayed data should be <= 64KB
    const totalBytes = received.reduce((sum, d) => sum + d.length, 0)
    expect(totalBytes).toBeLessThanOrEqual(65536)
    expect(totalBytes).toBeGreaterThan(0)

    // The LAST chunks should survive (trimmed from front)
    const lastChunk = received[received.length - 1]
    expect(lastChunk).toContain('chunk-079')

    // Early chunks should be trimmed
    const allText = received.join('')
    expect(allText).not.toContain('chunk-000')

    unsub()
  })

  it('small data stays fully intact', () => {
    dispatchData('shell-small', 'tiny')

    const received: string[] = []
    const unsub = subscribeShellData('shell-small', (d) => received.push(d))

    expect(received).toEqual(['tiny'])
    unsub()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Cleanup
// ─────────────────────────────────────────────────────────────────────────────

describe('replay buffer — cleanup', () => {
  it('cleanupSession clears the replay buffer', () => {
    dispatchData('shell-cleanup', 'buffered')
    cleanupSession('shell-cleanup')

    // Subscribe after cleanup — should NOT get replay
    const received: string[] = []
    const unsub = subscribeShellData('shell-cleanup', (d) => received.push(d))
    expect(received).toEqual([])
    unsub()
  })

  it('cleanupSession is safe to call on non-existent session', () => {
    // Should not throw
    expect(() => cleanupSession('shell-nonexistent')).not.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Error resilience
// ─────────────────────────────────────────────────────────────────────────────

describe('replay buffer — error resilience', () => {
  it('bad listener during replay does not break subsequent replay items', () => {
    dispatchData('shell-err', 'chunk-1')
    dispatchData('shell-err', 'chunk-2')
    dispatchData('shell-err', 'chunk-3')

    let callCount = 0
    const received: string[] = []

    const unsub = subscribeShellData('shell-err', (d) => {
      callCount++
      if (callCount === 2) throw new Error('simulated listener error on replay')
      received.push(d)
    })

    // Should have called listener 3 times, skipping the thrown one
    expect(callCount).toBe(3)
    expect(received).toEqual(['chunk-1', 'chunk-3'])

    unsub()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Multiple subscribers during replay
// ─────────────────────────────────────────────────────────────────────────────

describe('replay buffer — multiple subscribers', () => {
  it('only first subscriber gets replay (buffer cleared after)', () => {
    dispatchData('shell-multi', 'first-only')

    const first: string[] = []
    const second: string[] = []

    const unsub1 = subscribeShellData('shell-multi', (d) => first.push(d))
    // Buffer already drained by first subscriber
    const unsub2 = subscribeShellData('shell-multi', (d) => second.push(d))

    expect(first).toEqual(['first-only'])
    expect(second).toEqual([])

    // But BOTH get live data going forward
    dispatchData('shell-multi', 'live-data')
    expect(first).toEqual(['first-only', 'live-data'])
    expect(second).toEqual(['live-data'])

    unsub1()
    unsub2()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Real-world scenario: tool execution timing
// ─────────────────────────────────────────────────────────────────────────────

describe('replay buffer — tool execution scenario', () => {
  it('simulates exact bug scenario: data arrives during 500ms window before renderer mounts', () => {
    const sessionId = 'shell-scenario'

    // Step 1: Tool executor spawns PTY
    dispatchShellEvent({
      _tag: 'shell:started',
      sessionId,
      info: {
        sessionId,
        name: 'bash',
        pid: 9999,
        shell: '/bin/bash',
        cwd: '/home/user',
        cols: 120,
        rows: 24,
        status: 'running',
        createdAt: Date.now(),
      },
    })

    // Step 2: PTY output arrives (shell prompt, echo, etc.)
    // This happens during the 500ms sleep in tool.ts before any React renderer mounts
    dispatchData(sessionId, '\x1b[?2004h') // bracketed paste mode
    dispatchData(sessionId, 'user@host:~$ ')  // prompt
    dispatchData(sessionId, 'echo HELLO\r\n') // command echo
    dispatchData(sessionId, 'HELLO\r\n')       // command output
    dispatchData(sessionId, 'user@host:~$ ')  // next prompt

    // Step 3: Tool returns, renderer mounts, subscribes
    // (This is 500ms+ later in the real app)
    const terminalWrites: string[] = []
    const unsub = subscribeShellData(sessionId, (data) => {
      terminalWrites.push(data)
    })

    // Step 4: Verify ALL data was replayed to the terminal
    expect(terminalWrites).toEqual([
      '\x1b[?2004h',
      'user@host:~$ ',
      'echo HELLO\r\n',
      'HELLO\r\n',
      'user@host:~$ ',
    ])

    // Step 5: Session metadata is also correct
    const session = shellSessionFamily(sessionId)
    expect(registry.get(session.status$)).toBe('running')
    expect(registry.get(session.info$)?.pid).toBe(9999)
    expect(registry.get(session.outputSeq$)).toBe(5) // 5 data events

    // Step 6: Future live data still works
    dispatchData(sessionId, 'new-live-data')
    expect(terminalWrites).toHaveLength(6)
    expect(terminalWrites[5]).toBe('new-live-data')

    unsub()
  })
})
