/**
 * Schema Encode/Decode Tests — WS protocol types.
 *
 * Tests branded types, literal unions, struct schemas,
 * and discriminated union (ShellEvent).
 */

import { describe, it, expect } from 'vitest'
import { Schema, Either } from 'effect'
import {
  ShellSessionId,
  ShellSessionStatus,
  InteractiveShellToolArgs,
} from '../schemas'

// ─────────────────────────────────────────────────────────────────────────────
// ShellSessionId (branded string)
// ─────────────────────────────────────────────────────────────────────────────

describe('ShellSessionId', () => {
  const decode = Schema.decodeUnknownEither(ShellSessionId)

  it('accepts valid session ID string', () => {
    const result = decode('shell-abc123')
    expect(Either.isRight(result)).toBe(true)
  })

  it('accepts any string (brand is nominal, not validated)', () => {
    const result = decode('anything')
    expect(Either.isRight(result)).toBe(true)
  })

  it('rejects non-string', () => {
    const result = decode(42)
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects null', () => {
    const result = decode(null)
    expect(Either.isLeft(result)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ShellSessionStatus (literal union)
// ─────────────────────────────────────────────────────────────────────────────

describe('ShellSessionStatus', () => {
  const decode = Schema.decodeUnknownEither(ShellSessionStatus)

  it.each([
    'starting',
    'running',
    'exited',
    'killed',
    'error',
  ])('accepts valid status: %s', (status) => {
    const result = decode(status)
    expect(Either.isRight(result)).toBe(true)
  })

  it('rejects unknown status', () => {
    const result = decode('paused')
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects non-string', () => {
    const result = decode(0)
    expect(Either.isLeft(result)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// InteractiveShellToolArgs
// ─────────────────────────────────────────────────────────────────────────────

describe('InteractiveShellToolArgs', () => {
  const decode = Schema.decodeUnknownEither(InteractiveShellToolArgs)
  const decodeSync = Schema.decodeUnknownSync(InteractiveShellToolArgs)

  it('decodes spawn command', () => {
    const result = decode({ command: 'bash' })
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
      expect(result.right.command).toBe('bash')
    }
  })

  it('decodes input with session ID', () => {
    const result = decode({ sessionId: 'shell-123', input: 'ls\n' })
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
      expect(result.right.sessionId).toBe('shell-123')
      expect(result.right.input).toBe('ls\n')
    }
  })

  it('decodes kill command', () => {
    const result = decode({ sessionId: 'shell-123', kill: true })
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
      expect(result.right.kill).toBe(true)
    }
  })

  it('decodes structured input keys', () => {
    const args = decodeSync({
      sessionId: 'shell-123',
      inputKeys: ['ctrl+c', 'enter'],
    })
    expect(args.inputKeys).toEqual(['ctrl+c', 'enter'])
  })

  it('decodes structured input hex', () => {
    const args = decodeSync({
      sessionId: 'shell-123',
      inputHex: ['0x1b', '0x5b', '0x41'],
    })
    expect(args.inputHex).toEqual(['0x1b', '0x5b', '0x41'])
  })

  it('decodes inputPaste', () => {
    const args = decodeSync({
      sessionId: 'shell-123',
      inputPaste: 'multi\nline\ntext',
    })
    expect(args.inputPaste).toBe('multi\nline\ntext')
  })

  it('decodes with custom cols/rows', () => {
    const args = decodeSync({ command: 'bash', cols: 200, rows: 50 })
    expect(args.cols).toBe(200)
    expect(args.rows).toBe(50)
  })

  it('decodes empty object (all optional)', () => {
    const result = decode({})
    expect(Either.isRight(result)).toBe(true)
  })

  it('rejects invalid types for fields', () => {
    const result = decode({ command: 123 })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects invalid kill type', () => {
    const result = decode({ sessionId: 'x', kill: 'yes' })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects inputKeys as non-array', () => {
    const result = decode({ sessionId: 'x', inputKeys: 'ctrl+c' })
    expect(Either.isLeft(result)).toBe(true)
  })
})
