/**
 * Identity Schema Tests
 *
 * Unit: branded type construction, validation, rejection
 * Behavior: mapping relationships, type safety at boundaries
 */

import { describe, it, expect } from '@effect/vitest'
import { Schema, Effect } from 'effect'
import { HarnessSessionId, PiSessionId, EntryId, SessionIdMapping } from '../identity'

describe('Identity Schemas', () => {
  // ===========================================================================
  // Unit: HarnessSessionId
  // ===========================================================================

  describe('HarnessSessionId', () => {
    it('accepts valid non-empty strings', () => {
      const result = Schema.decodeUnknownSync(HarnessSessionId)('session-abc-123')
      expect(result).toBe('session-abc-123')
    })

    it('rejects empty string', () => {
      expect(() => Schema.decodeUnknownSync(HarnessSessionId)('')).toThrow()
    })

    it('rejects non-string types', () => {
      expect(() => Schema.decodeUnknownSync(HarnessSessionId)(42)).toThrow()
      expect(() => Schema.decodeUnknownSync(HarnessSessionId)(null)).toThrow()
      expect(() => Schema.decodeUnknownSync(HarnessSessionId)(undefined)).toThrow()
    })

    it('round-trips through encode/decode', () => {
      const id = Schema.decodeUnknownSync(HarnessSessionId)('test-id')
      const encoded = Schema.encodeSync(HarnessSessionId)(id)
      const decoded = Schema.decodeUnknownSync(HarnessSessionId)(encoded)
      expect(decoded).toBe(id)
    })
  })

  // ===========================================================================
  // Unit: PiSessionId
  // ===========================================================================

  describe('PiSessionId', () => {
    it('accepts valid non-empty strings', () => {
      const result = Schema.decodeUnknownSync(PiSessionId)('pi-session-xyz')
      expect(result).toBe('pi-session-xyz')
    })

    it('rejects empty string', () => {
      expect(() => Schema.decodeUnknownSync(PiSessionId)('')).toThrow()
    })
  })

  // ===========================================================================
  // Unit: EntryId
  // ===========================================================================

  describe('EntryId', () => {
    it('accepts valid non-empty strings', () => {
      const result = Schema.decodeUnknownSync(EntryId)('entry-001')
      expect(result).toBe('entry-001')
    })

    it('rejects empty string', () => {
      expect(() => Schema.decodeUnknownSync(EntryId)('')).toThrow()
    })
  })

  // ===========================================================================
  // Behavior: SessionIdMapping
  // ===========================================================================

  describe('SessionIdMapping', () => {
    const validMapping = {
      harnessId: 'harness-session-1',
      piId: 'pi-session-1',
      createdAt: new Date('2026-01-15T10:00:00Z'),
    }

    it('accepts valid mapping', () => {
      const result = Schema.decodeUnknownSync(SessionIdMapping)(validMapping)
      expect(result.harnessId).toBe('harness-session-1')
      expect(result.piId).toBe('pi-session-1')
      expect(result.createdAt).toBeInstanceOf(Date)
    })

    it('rejects mapping with empty harnessId', () => {
      expect(() =>
        Schema.decodeUnknownSync(SessionIdMapping)({ ...validMapping, harnessId: '' }),
      ).toThrow()
    })

    it('rejects mapping with empty piId', () => {
      expect(() =>
        Schema.decodeUnknownSync(SessionIdMapping)({ ...validMapping, piId: '' }),
      ).toThrow()
    })

    it('rejects mapping without createdAt', () => {
      const { createdAt, ...noDate } = validMapping
      expect(() => Schema.decodeUnknownSync(SessionIdMapping)(noDate)).toThrow()
    })

    it('round-trips through encode/decode', () => {
      const decoded = Schema.decodeUnknownSync(SessionIdMapping)(validMapping)
      const encoded = Schema.encodeSync(SessionIdMapping)(decoded)
      const reDec = Schema.decodeUnknownSync(SessionIdMapping)(encoded)
      expect(reDec.harnessId).toBe(decoded.harnessId)
      expect(reDec.piId).toBe(decoded.piId)
    })
  })

  // ===========================================================================
  // Behavior: Type separation
  // ===========================================================================

  describe('Type separation', () => {
    it('HarnessSessionId and PiSessionId are distinct branded types', () => {
      // Both decode the same string, but the brands differ at compile time.
      // At runtime we verify they both produce strings.
      const harness = Schema.decodeUnknownSync(HarnessSessionId)('shared-value')
      const pi = Schema.decodeUnknownSync(PiSessionId)('shared-value')

      // Same runtime value...
      expect(harness).toBe('shared-value')
      expect(pi).toBe('shared-value')

      // ...but TypeScript prevents cross-assignment at compile time.
      // This test documents that the schemas produce structurally identical
      // values — brand safety is a compile-time concern.
    })
  })
})
