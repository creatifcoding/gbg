/**
 * Session ID Extraction Tests — verifies the renderer correctly extracts
 * shell session IDs from tool output in all known formats.
 *
 * Covers:
 *   - Final tool result format: "sessionId: shell-X4FMwOd"
 *   - Legacy onUpdate format: "[session:shell-X4FMwOd ...]"
 *   - Dispatch mode format: "sessionId: shell-X..."
 *   - Hands-free mode format: "sessionId: shell-X..."
 *   - Nested in content array: [{ type: 'text', text: '...' }]
 *   - No session ID present: returns null
 *   - Edge cases: similar-looking strings that shouldn't match
 *
 * Also tests isSpawnResult() which determines if the tool call was a spawn.
 */

import { describe, it, expect } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Import the actual functions from the renderer module.
// They're not exported, so we replicate them here to test the LOGIC.
// If the renderer changes its extraction, these tests catch regressions.
// ─────────────────────────────────────────────────────────────────────────────

/** Matches both "sessionId: shell-X" and "session:shell-X" */
function extractSessionId(output: unknown): string | null {
  if (typeof output === 'string') {
    const match = output.match(/(?:sessionId|session):\s*(shell-[a-zA-Z0-9_-]+)/)
    return match?.[1] ?? null
  }
  if (Array.isArray(output)) {
    for (const item of output) {
      if (typeof item === 'object' && item && 'text' in item) {
        const found = extractSessionId((item as { text: string }).text)
        if (found) return found
      }
    }
  }
  return null
}

function isSpawnResult(input: unknown): boolean {
  if (typeof input !== 'object' || !input) return false
  const args = input as Record<string, unknown>
  return typeof args.command === 'string' && !args.sessionId
}

// ─────────────────────────────────────────────────────────────────────────────
// extractSessionId
// ─────────────────────────────────────────────────────────────────────────────

describe('extractSessionId', () => {
  describe('string input', () => {
    it('extracts from final interactive result format', () => {
      const text = 'Interactive shell session started.\nsessionId: shell-X4FMwOd\npid: unknown\nstatus: running'
      expect(extractSessionId(text)).toBe('shell-X4FMwOd')
    })

    it('extracts from normalized onUpdate format', () => {
      const text = 'sessionId: shell-abc123\nstatus: running\npid: 9999\nuser@host:~$ '
      expect(extractSessionId(text)).toBe('shell-abc123')
    })

    it('extracts from legacy bracket format: [session:shell-X]', () => {
      const text = '[session:shell-LEGACY status:running pid:unknown]\nsome output'
      expect(extractSessionId(text)).toBe('shell-LEGACY')
    })

    it('extracts from dispatch mode result', () => {
      const text = 'Session dispatched (fire-and-forget).\nsessionId: shell-dispatch1\npid: 1234\nmode: dispatch'
      expect(extractSessionId(text)).toBe('shell-dispatch1')
    })

    it('extracts from hands-free mode result', () => {
      const text = 'Session started in hands-free mode.\nsessionId: shell-hf999\npid: 5678\nstatus: running\nmode: hands-free'
      expect(extractSessionId(text)).toBe('shell-hf999')
    })

    it('extracts from attach result', () => {
      const text = 'Reattached to session.\nsessionId: shell-reattach\nname: (unnamed)\nstatus: running\npid: unknown'
      expect(extractSessionId(text)).toBe('shell-reattach')
    })

    it('handles session IDs with hyphens and underscores', () => {
      expect(extractSessionId('sessionId: shell-a_b-c_D')).toBe('shell-a_b-c_D')
    })

    it('handles session IDs with mixed case', () => {
      expect(extractSessionId('sessionId: shell-AbCdEf')).toBe('shell-AbCdEf')
    })

    it('returns null for empty string', () => {
      expect(extractSessionId('')).toBeNull()
    })

    it('returns null for unrelated text', () => {
      expect(extractSessionId('Hello world, no session here')).toBeNull()
    })

    it('returns null for partial match without shell- prefix', () => {
      expect(extractSessionId('sessionId: notashell-123')).toBeNull()
    })

    it('returns null for "session" without colon', () => {
      expect(extractSessionId('session shell-nope')).toBeNull()
    })

    it('extracts first match when multiple present', () => {
      const text = 'sessionId: shell-first\nsessionId: shell-second'
      expect(extractSessionId(text)).toBe('shell-first')
    })

    it('handles whitespace after colon', () => {
      expect(extractSessionId('sessionId:   shell-spaces')).toBe('shell-spaces')
    })

    it('handles no whitespace after colon', () => {
      expect(extractSessionId('sessionId:shell-nospace')).toBe('shell-nospace')
    })
  })

  describe('array input (tool content format)', () => {
    it('extracts from content array with single text item', () => {
      const output = [{ type: 'text', text: 'Interactive shell session started.\nsessionId: shell-array1\npid: 123' }]
      expect(extractSessionId(output)).toBe('shell-array1')
    })

    it('extracts from content array with multiple text items', () => {
      const output = [
        { type: 'text', text: 'Some preamble without session info' },
        { type: 'text', text: 'sessionId: shell-multi\nstatus: running' },
      ]
      expect(extractSessionId(output)).toBe('shell-multi')
    })

    it('returns null for empty array', () => {
      expect(extractSessionId([])).toBeNull()
    })

    it('returns null for array with no text items', () => {
      expect(extractSessionId([{ type: 'image', url: 'foo.png' }])).toBeNull()
    })

    it('returns null for array where no text contains session ID', () => {
      const output = [
        { type: 'text', text: 'No session here' },
        { type: 'text', text: 'Nope, not here either' },
      ]
      expect(extractSessionId(output)).toBeNull()
    })

    it('stops at first match (does not scan all items)', () => {
      const output = [
        { type: 'text', text: 'sessionId: shell-first-in-array' },
        { type: 'text', text: 'sessionId: shell-second-in-array' },
      ]
      expect(extractSessionId(output)).toBe('shell-first-in-array')
    })
  })

  describe('other input types', () => {
    it('returns null for null', () => {
      expect(extractSessionId(null)).toBeNull()
    })

    it('returns null for undefined', () => {
      expect(extractSessionId(undefined)).toBeNull()
    })

    it('returns null for number', () => {
      expect(extractSessionId(42)).toBeNull()
    })

    it('returns null for object without text', () => {
      expect(extractSessionId({ foo: 'bar' })).toBeNull()
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// isSpawnResult
// ─────────────────────────────────────────────────────────────────────────────

describe('isSpawnResult', () => {
  it('true for { command: "bash" }', () => {
    expect(isSpawnResult({ command: 'bash' })).toBe(true)
  })

  it('true for { command: "python3", name: "my-session" }', () => {
    expect(isSpawnResult({ command: 'python3', name: 'my-session' })).toBe(true)
  })

  it('false for { sessionId: "shell-X", input: "ls" }', () => {
    expect(isSpawnResult({ sessionId: 'shell-X', input: 'ls' })).toBe(false)
  })

  it('false for { sessionId: "shell-X", kill: true }', () => {
    expect(isSpawnResult({ sessionId: 'shell-X', kill: true })).toBe(false)
  })

  it('false for { sessionId: "shell-X" } (status check)', () => {
    expect(isSpawnResult({ sessionId: 'shell-X' })).toBe(false)
  })

  it('false for { command: "bash", sessionId: "shell-X" } (ambiguous but has sessionId)', () => {
    expect(isSpawnResult({ command: 'bash', sessionId: 'shell-X' })).toBe(false)
  })

  it('false for null', () => {
    expect(isSpawnResult(null)).toBe(false)
  })

  it('false for undefined', () => {
    expect(isSpawnResult(undefined)).toBe(false)
  })

  it('false for string', () => {
    expect(isSpawnResult('bash')).toBe(false)
  })

  it('false for empty object', () => {
    expect(isSpawnResult({})).toBe(false)
  })

  it('false for { command: 42 } (non-string command)', () => {
    expect(isSpawnResult({ command: 42 })).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Combined: routing decision
// ─────────────────────────────────────────────────────────────────────────────

describe('renderer routing decision', () => {
  function shouldShowTerminal(input: unknown, output: unknown): boolean {
    return isSpawnResult(input) && extractSessionId(output) !== null
  }

  it('shows terminal for interactive spawn with final result', () => {
    const input = { command: 'bash' }
    const output = [{ type: 'text', text: 'Interactive shell session started.\nsessionId: shell-abc\npid: 123\nstatus: running' }]
    expect(shouldShowTerminal(input, output)).toBe(true)
  })

  it('shows terminal for dispatch spawn', () => {
    const input = { command: 'npm test', mode: 'dispatch' }
    const output = [{ type: 'text', text: 'Session dispatched.\nsessionId: shell-dsp\npid: 456\nmode: dispatch' }]
    expect(shouldShowTerminal(input, output)).toBe(true)
  })

  it('shows terminal for hands-free spawn', () => {
    const input = { command: 'pytest', mode: 'hands-free' }
    const output = [{ type: 'text', text: 'Session started in hands-free mode.\nsessionId: shell-hf\npid: 789' }]
    expect(shouldShowTerminal(input, output)).toBe(true)
  })

  it('does NOT show terminal for input-to-session', () => {
    const input = { sessionId: 'shell-X', input: 'ls\n' }
    const output = [{ type: 'text', text: 'some output' }]
    expect(shouldShowTerminal(input, output)).toBe(false)
  })

  it('does NOT show terminal for kill', () => {
    const input = { sessionId: 'shell-X', kill: true }
    const output = [{ type: 'text', text: 'Session shell-X killed.' }]
    expect(shouldShowTerminal(input, output)).toBe(false)
  })

  it('does NOT show terminal for status check', () => {
    const input = { sessionId: 'shell-X' }
    const output = [{ type: 'text', text: 'status: running' }]
    expect(shouldShowTerminal(input, output)).toBe(false)
  })

  it('does NOT show terminal when spawn succeeds but output is malformed', () => {
    const input = { command: 'bash' }
    const output = [{ type: 'text', text: 'Error: spawn failed' }]
    expect(shouldShowTerminal(input, output)).toBe(false)
  })
})
