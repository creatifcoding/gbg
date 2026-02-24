import { it, describe } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'
import {
  buildTopic,
  parseTopic,
  makeSeqCounter,
  makeBdSeqCounter,
  makeWillMessage,
  makeDeathPayload,
} from '../src/SparkplugProtocol'

describe('SparkplugProtocol', () => {
  // =========================================================================
  // buildTopic
  // =========================================================================

  describe('buildTopic', () => {
    it('builds a node-level topic (no deviceId)', () => {
      const topic = buildTopic('spBv1.0', 'plant-a', 'NBIRTH', 'edge-01')
      expect(topic).toBe('spBv1.0/plant-a/NBIRTH/edge-01')
    })

    it('builds a device-level topic (with deviceId)', () => {
      const topic = buildTopic('spBv1.0', 'plant-a', 'DDATA', 'edge-01', 'sensor-01')
      expect(topic).toBe('spBv1.0/plant-a/DDATA/edge-01/sensor-01')
    })

    it('builds an NDEATH topic', () => {
      const topic = buildTopic('spBv1.0', 'acme', 'NDEATH', 'node-1')
      expect(topic).toBe('spBv1.0/acme/NDEATH/node-1')
    })
  })

  // =========================================================================
  // parseTopic
  // =========================================================================

  describe('parseTopic', () => {
    it('parses a node-level topic', () => {
      const result = parseTopic('spBv1.0/plant-a/NBIRTH/edge-01')
      expect(result).toEqual({
        version: 'spBv1.0',
        groupId: 'plant-a',
        messageType: 'NBIRTH',
        edgeNodeId: 'edge-01',
        deviceId: undefined,
      })
    })

    it('parses a device-level topic', () => {
      const result = parseTopic('spBv1.0/plant-a/DDATA/edge-01/sensor-01')
      expect(result).toEqual({
        version: 'spBv1.0',
        groupId: 'plant-a',
        messageType: 'DDATA',
        edgeNodeId: 'edge-01',
        deviceId: 'sensor-01',
      })
    })

    it('returns null for too few segments', () => {
      expect(parseTopic('spBv1.0/plant-a')).toBeNull()
    })

    it('returns null for invalid message type', () => {
      expect(parseTopic('spBv1.0/plant-a/INVALID/edge-01')).toBeNull()
    })

    it('handles STATE as invalid (STATE uses different topic format)', () => {
      expect(parseTopic('STATE/host-01')).toBeNull()
    })
  })

  // =========================================================================
  // SeqCounter
  // =========================================================================

  describe('makeSeqCounter', () => {
    it.effect('starts at 0 and increments', () =>
      Effect.gen(function* () {
        const counter = yield* makeSeqCounter()
        const v0 = yield* counter.next
        const v1 = yield* counter.next
        const v2 = yield* counter.next
        expect([v0, v1, v2]).toEqual([0, 1, 2])
      })
    )

    it.effect('wraps at 256 back to 0', () =>
      Effect.gen(function* () {
        const counter = yield* makeSeqCounter()
        for (let i = 0; i < 256; i++) {
          yield* counter.next
        }
        const wrapped = yield* counter.next
        expect(wrapped).toBe(0)
      })
    )

    it.effect('resets to 0', () =>
      Effect.gen(function* () {
        const counter = yield* makeSeqCounter()
        yield* counter.next // 0
        yield* counter.next // 1
        yield* counter.next // 2
        yield* counter.reset
        const afterReset = yield* counter.next
        expect(afterReset).toBe(0)
      })
    )
  })

  // =========================================================================
  // BdSeqCounter
  // =========================================================================

  describe('makeBdSeqCounter', () => {
    it.effect('starts at 0 and increments', () =>
      Effect.gen(function* () {
        const counter = yield* makeBdSeqCounter()
        const v0 = yield* counter.next
        const v1 = yield* counter.next
        expect([v0, v1]).toEqual([0, 1])
      })
    )

    it.effect('wraps at 256 back to 0', () =>
      Effect.gen(function* () {
        const counter = yield* makeBdSeqCounter()
        for (let i = 0; i < 256; i++) {
          yield* counter.next
        }
        const wrapped = yield* counter.next
        expect(wrapped).toBe(0)
      })
    )

    it.effect('provides current value without incrementing', () =>
      Effect.gen(function* () {
        const counter = yield* makeBdSeqCounter()
        yield* counter.next // 0 → now at 1
        const current = yield* counter.current
        const next = yield* counter.next // should still be 1
        expect([current, next]).toEqual([1, 1])
      })
    )
  })

  // =========================================================================
  // makeDeathPayload
  // =========================================================================

  describe('makeDeathPayload', () => {
    it('creates payload with bdSeq metric', () => {
      const payload = makeDeathPayload(42)
      expect(payload.metrics).toHaveLength(1)
      expect(payload.metrics[0]).toEqual({
        name: 'bdSeq',
        value: 42,
        type: 'UInt64',
      })
      expect(payload.timestamp).toBeGreaterThan(0)
    })
  })

  // =========================================================================
  // makeWillMessage
  // =========================================================================

  describe('makeWillMessage', () => {
    it('constructs Will with spec-compliant defaults (QoS 1, retain false)', () => {
      const will = makeWillMessage('spBv1.0', 'plant-a', 'edge-01', 5)
      expect(will.topic).toBe('spBv1.0/plant-a/NDEATH/edge-01')
      expect(will.qos).toBe(1) // Spec: MUST be 1
      expect(will.retain).toBe(false) // Spec: MUST be false
      expect(will.payload.metrics[0]!.value).toBe(5)
    })

    it('allows QoS override for testing', () => {
      const will = makeWillMessage('spBv1.0', 'plant-a', 'edge-01', 0, 0)
      expect(will.qos).toBe(0)
    })

    it('allows retain override for testing', () => {
      const will = makeWillMessage('spBv1.0', 'plant-a', 'edge-01', 0, 1, true)
      expect(will.retain).toBe(true)
    })
  })
})
