/**
 * MessageDecoder Tests
 *
 * Validates Effect-native encoding/decoding for NATS messages.
 */

import { describe, it, expect } from 'vitest'
import { Effect, Schema, Exit } from 'effect'
import { MessageDecoder } from '../decoder'
import { DecodeError } from '../errors'

// Test schema
const TestSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  active: Schema.Boolean,
})
type TestData = Schema.Schema.Type<typeof TestSchema>

// Run effect with MessageDecoder layer
const runWithDecoder = <A, E>(
  effect: Effect.Effect<A, E, MessageDecoder>
): Promise<A> =>
  Effect.runPromise(Effect.provide(effect, MessageDecoder.Default))

describe('MessageDecoder', () => {
  describe('decodeJson', () => {
    it('should decode valid JSON string', async () => {
      const json = '{"id": 123, "name": "test", "active": true}'

      const result = await runWithDecoder(
        Effect.gen(function* () {
          const decoder = yield* MessageDecoder
          return yield* decoder.decodeJson(TestSchema)(json)
        })
      )

      expect(result.id).toBe(123)
      expect(result.name).toBe('test')
      expect(result.active).toBe(true)
    })

    it('should fail on invalid JSON', async () => {
      const invalidJson = '{ invalid json }'

      const exit = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const decoder = yield* MessageDecoder
          return yield* decoder.decodeJson(TestSchema)(invalidJson)
        }).pipe(Effect.provide(MessageDecoder.Default))
      )

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const error = exit.cause
        // Should be a DecodeError
        expect(error._tag).toBe('Fail')
      }
    })

    it('should fail on schema mismatch', async () => {
      const json = '{"id": "not-a-number", "name": 123, "active": "yes"}'

      const exit = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const decoder = yield* MessageDecoder
          return yield* decoder.decodeJson(TestSchema)(json)
        }).pipe(Effect.provide(MessageDecoder.Default))
      )

      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  describe('decodeBytes', () => {
    it('should decode valid Uint8Array', async () => {
      const data: TestData = { id: 456, name: 'bytes-test', active: false }
      const bytes = new TextEncoder().encode(JSON.stringify(data))

      const result = await runWithDecoder(
        Effect.gen(function* () {
          const decoder = yield* MessageDecoder
          return yield* decoder.decodeBytes(TestSchema)(bytes)
        })
      )

      expect(result.id).toBe(456)
      expect(result.name).toBe('bytes-test')
      expect(result.active).toBe(false)
    })

    it('should handle UTF-8 encoded content', async () => {
      const data: TestData = { id: 1, name: 'utf8-tëst-名前', active: true }
      const bytes = new TextEncoder().encode(JSON.stringify(data))

      const result = await runWithDecoder(
        Effect.gen(function* () {
          const decoder = yield* MessageDecoder
          return yield* decoder.decodeBytes(TestSchema)(bytes)
        })
      )

      expect(result.name).toBe('utf8-tëst-名前')
    })

    it('should fail on invalid bytes', async () => {
      const invalidBytes = new Uint8Array([0x80, 0x81, 0x82]) // Invalid UTF-8

      const exit = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const decoder = yield* MessageDecoder
          return yield* decoder.decodeBytes(TestSchema)(invalidBytes)
        }).pipe(Effect.provide(MessageDecoder.Default))
      )

      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  describe('encodeJson', () => {
    it('should encode to JSON string', async () => {
      const data: TestData = { id: 789, name: 'encode-test', active: true }

      const result = await runWithDecoder(
        Effect.gen(function* () {
          const decoder = yield* MessageDecoder
          return yield* decoder.encodeJson(TestSchema)(data)
        })
      )

      const parsed = JSON.parse(result)
      expect(parsed.id).toBe(789)
      expect(parsed.name).toBe('encode-test')
      expect(parsed.active).toBe(true)
    })
  })

  describe('encodeBytes', () => {
    it('should encode to Uint8Array', async () => {
      const data: TestData = { id: 999, name: 'bytes-encode', active: false }

      const result = await runWithDecoder(
        Effect.gen(function* () {
          const decoder = yield* MessageDecoder
          return yield* decoder.encodeBytes(TestSchema)(data)
        })
      )

      expect(result).toBeInstanceOf(Uint8Array)

      const decoded = JSON.parse(new TextDecoder().decode(result))
      expect(decoded.id).toBe(999)
      expect(decoded.name).toBe('bytes-encode')
    })

    it('should roundtrip encode/decode', async () => {
      const original: TestData = { id: 42, name: 'roundtrip', active: true }

      const result = await runWithDecoder(
        Effect.gen(function* () {
          const decoder = yield* MessageDecoder

          // Encode to bytes
          const bytes = yield* decoder.encodeBytes(TestSchema)(original)

          // Decode back
          return yield* decoder.decodeBytes(TestSchema)(bytes)
        })
      )

      expect(result).toEqual(original)
    })
  })

  describe('complex schemas', () => {
    const NestedSchema = Schema.Struct({
      outer: Schema.Struct({
        inner: Schema.Array(Schema.Number),
        optional: Schema.optional(Schema.String),
      }),
      timestamp: Schema.DateFromString,
    })

    it('should handle nested structures', async () => {
      const json = JSON.stringify({
        outer: { inner: [1, 2, 3] },
        timestamp: '2026-01-24T10:00:00Z',
      })

      const result = await runWithDecoder(
        Effect.gen(function* () {
          const decoder = yield* MessageDecoder
          return yield* decoder.decodeJson(NestedSchema)(json)
        })
      )

      expect(result.outer.inner).toEqual([1, 2, 3])
      expect(result.outer.optional).toBeUndefined()
      expect(result.timestamp).toBeInstanceOf(Date)
    })

    const TaggedSchema = Schema.TaggedStruct('MyEvent', {
      id: Schema.String,
      payload: Schema.Unknown,
    })

    it('should handle tagged structs', async () => {
      const json = JSON.stringify({
        _tag: 'MyEvent',
        id: 'evt-123',
        payload: { data: [1, 2, 3] },
      })

      const result = await runWithDecoder(
        Effect.gen(function* () {
          const decoder = yield* MessageDecoder
          return yield* decoder.decodeJson(TaggedSchema)(json)
        })
      )

      expect(result._tag).toBe('MyEvent')
      expect(result.id).toBe('evt-123')
    })
  })
})
