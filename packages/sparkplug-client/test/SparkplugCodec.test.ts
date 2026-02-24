import { it, describe } from '@effect/vitest'
import { expect } from 'vitest'
import {
  encodePayload,
  decodePayload,
  decodeMetricValue,
  extractQuality,
  type UMetric,
  type UPayload,
} from '../src/SparkplugCodec'

describe('SparkplugCodec', () => {
  // =========================================================================
  // encodePayload / decodePayload roundtrip
  // =========================================================================

  describe('encode/decode roundtrip', () => {
    it('roundtrips a payload with numeric metrics', () => {
      const original: UPayload = {
        timestamp: Date.now(),
        metrics: [
          { name: 'temperature', value: 72.5, type: 'Double' },
          { name: 'pressure', value: 1013, type: 'Int32' },
        ],
      }

      const encoded = encodePayload(original)
      expect(encoded).toBeInstanceOf(Uint8Array)
      expect(encoded.length).toBeGreaterThan(0)

      const decoded = decodePayload(encoded)
      expect(decoded.metrics).toHaveLength(2)
      expect(decoded.metrics![0]!.name).toBe('temperature')
      expect(decoded.metrics![1]!.name).toBe('pressure')
    })

    it('roundtrips a payload with boolean metric', () => {
      const original: UPayload = {
        timestamp: Date.now(),
        metrics: [
          { name: 'running', value: true, type: 'Boolean' },
        ],
      }

      const encoded = encodePayload(original)
      const decoded = decodePayload(encoded)
      expect(decoded.metrics![0]!.name).toBe('running')
    })

    it('roundtrips the bdSeq death payload', () => {
      const original: UPayload = {
        timestamp: Date.now(),
        metrics: [
          { name: 'bdSeq', value: 42, type: 'UInt64' },
        ],
      }

      const encoded = encodePayload(original)
      const decoded = decodePayload(encoded)
      expect(decoded.metrics![0]!.name).toBe('bdSeq')
    })
  })

  // =========================================================================
  // decodeMetricValue
  // =========================================================================

  describe('decodeMetricValue', () => {
    it('extracts Double value', () => {
      const metric: UMetric = { name: 'temp', value: 72.5, type: 'Double' }
      expect(decodeMetricValue(metric)).toBe(72.5)
    })

    it('extracts Float value', () => {
      const metric: UMetric = { name: 'temp', value: 72.5, type: 'Float' }
      expect(decodeMetricValue(metric)).toBe(72.5)
    })

    it('extracts Int32 value', () => {
      const metric: UMetric = { name: 'count', value: 42, type: 'Int32' }
      expect(decodeMetricValue(metric)).toBe(42)
    })

    it('extracts UInt16 value', () => {
      const metric: UMetric = { name: 'rpm', value: 1500, type: 'UInt16' }
      expect(decodeMetricValue(metric)).toBe(1500)
    })

    it('converts Boolean true to 1', () => {
      const metric: UMetric = { name: 'running', value: true, type: 'Boolean' }
      expect(decodeMetricValue(metric)).toBe(1)
    })

    it('converts Boolean false to 0', () => {
      const metric: UMetric = { name: 'running', value: false, type: 'Boolean' }
      expect(decodeMetricValue(metric)).toBe(0)
    })

    it('returns null for String type', () => {
      const metric: UMetric = { name: 'label', value: 'hello', type: 'String' }
      expect(decodeMetricValue(metric)).toBeNull()
    })

    it('returns null for null value', () => {
      const metric: UMetric = { name: 'temp', value: null, type: 'Double' }
      expect(decodeMetricValue(metric)).toBeNull()
    })

    it('returns null for undefined value', () => {
      const metric: UMetric = { name: 'temp', type: 'Double' }
      expect(decodeMetricValue(metric)).toBeNull()
    })

    it('handles Long-like objects (protobufjs 64-bit)', () => {
      const longValue = { low: 100, high: 0, unsigned: true, toNumber: () => 100 }
      const metric: UMetric = { name: 'bigint', value: longValue, type: 'UInt64' }
      expect(decodeMetricValue(metric)).toBe(100)
    })
  })

  // =========================================================================
  // extractQuality
  // =========================================================================

  describe('extractQuality', () => {
    it('extracts quality when present', () => {
      const metric: UMetric = {
        name: 'temp',
        value: 72.5,
        type: 'Double',
        properties: {
          Quality: { type: 'Int32', value: 192 },
        },
      }
      expect(extractQuality(metric)).toBe('192')
    })

    it('returns undefined when no properties', () => {
      const metric: UMetric = { name: 'temp', value: 72.5, type: 'Double' }
      expect(extractQuality(metric)).toBeUndefined()
    })

    it('returns undefined when Quality property missing', () => {
      const metric: UMetric = {
        name: 'temp',
        value: 72.5,
        type: 'Double',
        properties: {
          Timestamp: { type: 'Int64', value: Date.now() },
        },
      }
      expect(extractQuality(metric)).toBeUndefined()
    })

    it('returns "0" for bad quality', () => {
      const metric: UMetric = {
        name: 'temp',
        value: 72.5,
        type: 'Double',
        properties: {
          Quality: { type: 'Int32', value: 0 },
        },
      }
      expect(extractQuality(metric)).toBe('0')
    })

    it('returns "64" for uncertain quality', () => {
      const metric: UMetric = {
        name: 'temp',
        value: 72.5,
        type: 'Double',
        properties: {
          Quality: { type: 'Int32', value: 64 },
        },
      }
      expect(extractQuality(metric)).toBe('64')
    })
  })
})
