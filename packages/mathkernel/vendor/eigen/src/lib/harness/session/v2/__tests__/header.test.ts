/**
 * Session Header Schema Tests
 *
 * Unit: field validation, version constraint
 * Behavior: fork headers with parentSession
 * Integration: JSONL first-line simulation
 */

import { describe, it, expect } from '@effect/vitest'
import { Schema } from 'effect'
import { SessionHeader, SESSION_SCHEMA_VERSION } from '../header'

// =============================================================================
// Fixtures
// =============================================================================

const VALID_HEADER = {
  _tag: 'SessionHeader' as const,
  version: 1,
  id: 'session-001',
  timestamp: '2026-02-28T14:00:00.000Z',
  cwd: '/home/user/project',
}

// =============================================================================
// Unit: SessionHeader
// =============================================================================

describe('SessionHeader — Unit', () => {
  it('accepts valid header', () => {
    const result = Schema.decodeUnknownSync(SessionHeader)(VALID_HEADER)
    expect(result._tag).toBe('SessionHeader')
    expect(result.version).toBe(1)
    expect(result.id).toBe('session-001')
    expect(result.cwd).toBe('/home/user/project')
  })

  it('SESSION_SCHEMA_VERSION is 1', () => {
    expect(SESSION_SCHEMA_VERSION).toBe(1)
  })

  it('rejects version 0', () => {
    expect(() =>
      Schema.decodeUnknownSync(SessionHeader)({ ...VALID_HEADER, version: 0 }),
    ).toThrow()
  })

  it('rejects negative version', () => {
    expect(() =>
      Schema.decodeUnknownSync(SessionHeader)({ ...VALID_HEADER, version: -1 }),
    ).toThrow()
  })

  it('rejects non-integer version', () => {
    expect(() =>
      Schema.decodeUnknownSync(SessionHeader)({ ...VALID_HEADER, version: 1.5 }),
    ).toThrow()
  })

  it('rejects empty id', () => {
    expect(() =>
      Schema.decodeUnknownSync(SessionHeader)({ ...VALID_HEADER, id: '' }),
    ).toThrow()
  })

  it('rejects empty timestamp', () => {
    expect(() =>
      Schema.decodeUnknownSync(SessionHeader)({ ...VALID_HEADER, timestamp: '' }),
    ).toThrow()
  })
})

// =============================================================================
// Behavior: Fork headers
// =============================================================================

describe('SessionHeader — Behavior (forks)', () => {
  it('accepts header with parentSession for forks', () => {
    const result = Schema.decodeUnknownSync(SessionHeader)({
      ...VALID_HEADER,
      parentSession: 'parent-session-001',
    })
    expect(result.parentSession).toBe('parent-session-001')
  })

  it('parentSession is optional (normal sessions)', () => {
    const result = Schema.decodeUnknownSync(SessionHeader)(VALID_HEADER)
    expect(result.parentSession).toBeUndefined()
  })

  it('rejects empty parentSession when provided', () => {
    expect(() =>
      Schema.decodeUnknownSync(SessionHeader)({
        ...VALID_HEADER,
        parentSession: '',
      }),
    ).toThrow()
  })
})

// =============================================================================
// Integration: JSONL first-line simulation
// =============================================================================

describe('SessionHeader — Integration (JSONL)', () => {
  it('survives JSON round-trip (first line of JSONL file)', () => {
    const decoded = Schema.decodeUnknownSync(SessionHeader)(VALID_HEADER)
    const jsonLine = JSON.stringify(decoded)
    const reDecoded = Schema.decodeUnknownSync(SessionHeader)(JSON.parse(jsonLine))

    expect(reDecoded.version).toBe(decoded.version)
    expect(reDecoded.id).toBe(decoded.id)
    expect(reDecoded.cwd).toBe(decoded.cwd)
    expect(reDecoded.timestamp).toBe(decoded.timestamp)
  })

  it('forked header survives JSON round-trip', () => {
    const forked = {
      ...VALID_HEADER,
      id: 'fork-session-001',
      parentSession: 'parent-session-001',
    }
    const decoded = Schema.decodeUnknownSync(SessionHeader)(forked)
    const json = JSON.stringify(decoded)
    const reDecoded = Schema.decodeUnknownSync(SessionHeader)(JSON.parse(json))

    expect(reDecoded.parentSession).toBe('parent-session-001')
  })
})
