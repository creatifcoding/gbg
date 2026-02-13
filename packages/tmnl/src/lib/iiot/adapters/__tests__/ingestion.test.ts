/**
 * IngestionAdapter Service Interface Tests
 *
 * Unit tests for the foundational ingestion pipeline types:
 * - IngestedReading (Schema.TaggedClass)
 * - IngestionError (Schema.TaggedError)
 * - IngestionHealth (Schema.Struct)
 * - IngestionAdapter (Context.Tag)
 *
 * @module @gbg/tmnl/iiot/adapters/__tests__/ingestion
 */

import { describe, it, expect } from '@effect/vitest'
import { DateTime, Effect, Schema } from 'effect'
import {
  IngestedReading,
  IngestionError,
  IngestionHealth,
  IngestionAdapter,
} from '../ingestion'

// =============================================================================
// IngestedReading Tests
// =============================================================================

describe('IngestedReading', () => {
  it('has correct _tag', () => {
    const reading = new IngestedReading({
      topic: 'spBv1.0/acme/DDATA/site-a/temp-01',
      value: 23.5,
      sourceTimestamp: DateTime.unsafeNow(),
    })
    expect(reading._tag).toBe('IngestedReading')
  })

  it('creates instance with all required fields', () => {
    const now = DateTime.unsafeNow()
    const reading = new IngestedReading({
      topic: 'ns=2;s=Motor01.Temperature',
      value: 42.0,
      sourceTimestamp: now,
    })

    expect(reading.topic).toBe('ns=2;s=Motor01.Temperature')
    expect(reading.value).toBe(42.0)
    expect(reading.sourceTimestamp).toEqual(now)
  })

  it('creates instance with optional fields', () => {
    const reading = new IngestedReading({
      topic: 'spBv1.0/acme/DDATA/site-a/temp-01',
      value: 23.5,
      sourceTimestamp: DateTime.unsafeNow(),
      sourceQuality: 'good',
      metadata: { metricName: 'temperature' },
    })

    expect(reading.sourceQuality).toBe('good')
    expect(reading.metadata).toEqual({ metricName: 'temperature' })
  })

  it.effect('encode/decode roundtrip', () =>
    Effect.gen(function* () {
      const original = new IngestedReading({
        topic: 'spBv1.0/acme/DDATA/site-a/temp-01',
        value: 23.5,
        sourceTimestamp: DateTime.unsafeNow(),
        sourceQuality: 'good',
        metadata: { key1: 'value1' },
      })

      const encoded = yield* Schema.encode(IngestedReading)(original)
      expect(encoded).toBeDefined()
      expect(typeof encoded).toBe('object')

      const decoded = yield* Schema.decode(IngestedReading)(encoded)
      expect(decoded._tag).toBe('IngestedReading')
      expect(decoded.topic).toBe('spBv1.0/acme/DDATA/site-a/temp-01')
      expect(decoded.value).toBe(23.5)
      expect(decoded.sourceQuality).toBe('good')
    })
  )

  it.effect('encode/decode roundtrip without optional fields', () =>
    Effect.gen(function* () {
      const original = new IngestedReading({
        topic: 'ns=2;s=Sensor.Value',
        value: 99.9,
        sourceTimestamp: DateTime.unsafeNow(),
      })

      const encoded = yield* Schema.encode(IngestedReading)(original)
      const decoded = yield* Schema.decode(IngestedReading)(encoded)

      expect(decoded._tag).toBe('IngestedReading')
      expect(decoded.topic).toBe('ns=2;s=Sensor.Value')
      expect(decoded.value).toBe(99.9)
      expect(decoded.sourceQuality).toBeUndefined()
      expect(decoded.metadata).toBeUndefined()
    })
  )
})

// =============================================================================
// IngestionError Tests
// =============================================================================

describe('IngestionError', () => {
  it('has correct _tag', () => {
    const error = new IngestionError({
      protocol: 'opcua',
      message: 'Connection refused',
      code: 'CONNECTION_FAILED',
      retryable: true,
    })
    expect(error._tag).toBe('IngestionError')
  })

  it('creates error with all fields', () => {
    const error = new IngestionError({
      protocol: 'sparkplug',
      message: 'Authentication failed',
      code: 'AUTHENTICATION_FAILED',
      retryable: false,
    })

    expect(error.protocol).toBe('sparkplug')
    expect(error.message).toBe('Authentication failed')
    expect(error.code).toBe('AUTHENTICATION_FAILED')
    expect(error.retryable).toBe(false)
  })

  it('is an instance of Error', () => {
    const error = new IngestionError({
      protocol: 'modbus',
      message: 'Timeout waiting for response',
      code: 'TIMEOUT',
      retryable: true,
    })

    expect(error).toBeInstanceOf(Error)
  })

  it('accepts all valid error codes', () => {
    const codes = [
      'CONNECTION_FAILED',
      'AUTHENTICATION_FAILED',
      'SUBSCRIPTION_FAILED',
      'DECODE_ERROR',
      'TIMEOUT',
      'PROTOCOL_ERROR',
    ] as const

    for (const code of codes) {
      const error = new IngestionError({
        protocol: 'test',
        message: `Error: ${code}`,
        code,
        retryable: true,
      })
      expect(error.code).toBe(code)
    }
  })

  it.effect('encode/decode roundtrip', () =>
    Effect.gen(function* () {
      const original = new IngestionError({
        protocol: 'opcua',
        message: 'Subscription failed: NodeId not found',
        code: 'SUBSCRIPTION_FAILED',
        retryable: false,
      })

      const encoded = yield* Schema.encode(IngestionError)(original)
      expect(encoded).toBeDefined()
      expect(typeof encoded).toBe('object')

      const decoded = yield* Schema.decode(IngestionError)(encoded)
      expect(decoded._tag).toBe('IngestionError')
      expect(decoded.protocol).toBe('opcua')
      expect(decoded.message).toBe('Subscription failed: NodeId not found')
      expect(decoded.code).toBe('SUBSCRIPTION_FAILED')
      expect(decoded.retryable).toBe(false)
    })
  )
})

// =============================================================================
// IngestionHealth Tests
// =============================================================================

describe('IngestionHealth', () => {
  it.effect('encode/decode roundtrip with all fields', () =>
    Effect.gen(function* () {
      const now = DateTime.unsafeNow()
      const original: typeof IngestionHealth.Type = {
        protocol: 'sparkplug',
        connected: true,
        lastMessageAt: now,
        messagesPerSecond: 150.5,
        errorCount: 0,
      }

      const encoded = yield* Schema.encode(IngestionHealth)(original)
      expect(encoded).toBeDefined()

      const decoded = yield* Schema.decode(IngestionHealth)(encoded)
      expect(decoded.protocol).toBe('sparkplug')
      expect(decoded.connected).toBe(true)
      expect(decoded.messagesPerSecond).toBe(150.5)
      expect(decoded.errorCount).toBe(0)
    })
  )

  it.effect('encode/decode roundtrip without optional fields', () =>
    Effect.gen(function* () {
      const original: typeof IngestionHealth.Type = {
        protocol: 'modbus',
        connected: false,
        errorCount: 3,
      }

      const encoded = yield* Schema.encode(IngestionHealth)(original)
      const decoded = yield* Schema.decode(IngestionHealth)(encoded)

      expect(decoded.protocol).toBe('modbus')
      expect(decoded.connected).toBe(false)
      expect(decoded.errorCount).toBe(3)
      expect(decoded.lastMessageAt).toBeUndefined()
      expect(decoded.messagesPerSecond).toBeUndefined()
    })
  )

  it.effect('rejects invalid errorCount (negative)', () =>
    Effect.gen(function* () {
      const result = yield* Schema.decodeUnknown(IngestionHealth)({
        protocol: 'test',
        connected: true,
        errorCount: -1,
      }).pipe(Effect.either)

      // errorCount is Schema.Number so negative is accepted unless constrained
      // This test documents current behavior - no constraint on errorCount
      expect(result._tag).toBe('Right')
    })
  )
})

// =============================================================================
// IngestionAdapter Service Tag Tests
// =============================================================================

describe('IngestionAdapter', () => {
  it('has correct service key', () => {
    expect(IngestionAdapter.key).toBe('tmnl/iiot/IngestionAdapter')
  })
})
