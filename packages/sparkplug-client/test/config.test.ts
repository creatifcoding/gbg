import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Schema } from 'effect'
import {
  MqttSessionConfig,
  WillConfig,
  PublishConfig,
  StateConfig,
  SparkplugConfig,
} from '../src/config'

// =============================================================================
// Helpers
// =============================================================================

const minimalInput = {
  _tag: 'SparkplugConfig' as const,
  serverUrl: 'mqtt://localhost:1883',
  groupId: 'g1',
  edgeNodeId: 'e1',
}

// =============================================================================
// SparkplugConfig — top-level decode
// =============================================================================

describe('SparkplugConfig', () => {
  describe('minimal input decode', () => {
    it.effect('decodes with only required fields', () =>
      Effect.gen(function* () {
        const result = yield* Schema.decode(SparkplugConfig)(minimalInput)
        expect(result._tag).toBe('SparkplugConfig')
        expect(result.serverUrl).toBe('mqtt://localhost:1883')
        expect(result.groupId).toBe('g1')
        expect(result.edgeNodeId).toBe('e1')
      })
    )
  })

  describe('default values', () => {
    it.effect('fills mqtt defaults', () =>
      Effect.gen(function* () {
        const result = yield* Schema.decode(SparkplugConfig)(minimalInput)
        expect(result.mqtt.cleanSession).toBe(true)
        expect(result.mqtt.keepalive).toBe(65)
        expect(result.mqtt.reconnectPeriod).toBe(1000)
        expect(result.mqtt.connectTimeout).toBe(30000)
      })
    )

    it.effect('fills will defaults', () =>
      Effect.gen(function* () {
        const result = yield* Schema.decode(SparkplugConfig)(minimalInput)
        expect(result.will.qos).toBe(1)
        expect(result.will.retain).toBe(false)
      })
    )

    it.effect('fills publish defaults', () =>
      Effect.gen(function* () {
        const result = yield* Schema.decode(SparkplugConfig)(minimalInput)
        expect(result.publish.qos).toBe(0)
        expect(result.publish.retain).toBe(false)
      })
    )

    it.effect('fills state defaults', () =>
      Effect.gen(function* () {
        const result = yield* Schema.decode(SparkplugConfig)(minimalInput)
        expect(result.state.enabled).toBe(false)
        expect(result.state.qos).toBe(1)
        expect(result.state.retain).toBe(true)
      })
    )
  })

  describe('full config roundtrip', () => {
    it.effect('encodes and decodes a full config', () =>
      Effect.gen(function* () {
        const full = {
          _tag: 'SparkplugConfig' as const,
          serverUrl: 'mqtt://broker.example.com:1883',
          groupId: 'factory-floor',
          edgeNodeId: 'edge-01',
          clientId: 'my-client',
          username: 'admin',
          password: 's3cret',
          mqtt: { cleanSession: false, keepalive: 30, reconnectPeriod: 5000, connectTimeout: 10000 },
          will: { qos: 2 as const, retain: true },
          publish: { qos: 1 as const, retain: true },
          state: { enabled: true, qos: 0 as const, retain: false },
        }

        const decoded = yield* Schema.decode(SparkplugConfig)(full)
        const encoded = yield* Schema.encode(SparkplugConfig)(decoded)
        const roundtripped = yield* Schema.decode(SparkplugConfig)(encoded)

        expect(roundtripped.serverUrl).toBe(full.serverUrl)
        expect(roundtripped.groupId).toBe(full.groupId)
        expect(roundtripped.edgeNodeId).toBe(full.edgeNodeId)
        expect(roundtripped.clientId).toBe(full.clientId)
        expect(roundtripped.username).toBe(full.username)
        expect(roundtripped.password).toBe(full.password)
        expect(roundtripped.mqtt.cleanSession).toBe(false)
        expect(roundtripped.mqtt.keepalive).toBe(30)
        expect(roundtripped.will.qos).toBe(2)
        expect(roundtripped.publish.qos).toBe(1)
        expect(roundtripped.state.enabled).toBe(true)
        expect(roundtripped.state.retain).toBe(false)
      })
    )
  })

  describe('invalid inputs rejected', () => {
    it.effect('rejects missing serverUrl', () =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(
          Schema.decode(SparkplugConfig)({
            _tag: 'SparkplugConfig',
            groupId: 'g1',
            edgeNodeId: 'e1',
          } as any)
        )
        expect(exit._tag).toBe('Failure')
      })
    )

    it.effect('rejects missing groupId', () =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(
          Schema.decode(SparkplugConfig)({
            _tag: 'SparkplugConfig',
            serverUrl: 'mqtt://localhost',
            edgeNodeId: 'e1',
          } as any)
        )
        expect(exit._tag).toBe('Failure')
      })
    )

    it.effect('rejects empty object', () =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(
          Schema.decode(SparkplugConfig)({} as any)
        )
        expect(exit._tag).toBe('Failure')
      })
    )
  })

  describe('optional fields', () => {
    it.effect('omits clientId, username, password when not provided', () =>
      Effect.gen(function* () {
        const result = yield* Schema.decode(SparkplugConfig)(minimalInput)
        expect(result.clientId).toBeUndefined()
        expect(result.username).toBeUndefined()
        expect(result.password).toBeUndefined()
      })
    )

    it.effect('preserves clientId, username, password when provided', () =>
      Effect.gen(function* () {
        const result = yield* Schema.decode(SparkplugConfig)({
          ...minimalInput,
          clientId: 'custom-id',
          username: 'user',
          password: 'pass',
        })
        expect(result.clientId).toBe('custom-id')
        expect(result.username).toBe('user')
        expect(result.password).toBe('pass')
      })
    )
  })
})

// =============================================================================
// Individual nested config schemas
// =============================================================================

describe('MqttSessionConfig', () => {
  it.effect('fills all defaults from empty input', () =>
    Effect.gen(function* () {
      const result = yield* Schema.decode(MqttSessionConfig)({})
      expect(result.cleanSession).toBe(true)
      expect(result.keepalive).toBe(65)
      expect(result.reconnectPeriod).toBe(1000)
      expect(result.connectTimeout).toBe(30000)
    })
  )

  it.effect('accepts overrides', () =>
    Effect.gen(function* () {
      const result = yield* Schema.decode(MqttSessionConfig)({
        cleanSession: false,
        keepalive: 120,
      })
      expect(result.cleanSession).toBe(false)
      expect(result.keepalive).toBe(120)
      expect(result.reconnectPeriod).toBe(1000)
      expect(result.connectTimeout).toBe(30000)
    })
  )
})

describe('WillConfig', () => {
  it.effect('fills defaults from empty input', () =>
    Effect.gen(function* () {
      const result = yield* Schema.decode(WillConfig)({})
      expect(result.qos).toBe(1)
      expect(result.retain).toBe(false)
    })
  )

  it.effect('accepts overrides', () =>
    Effect.gen(function* () {
      const result = yield* Schema.decode(WillConfig)({ qos: 2, retain: true })
      expect(result.qos).toBe(2)
      expect(result.retain).toBe(true)
    })
  )
})

describe('PublishConfig', () => {
  it.effect('fills defaults from empty input', () =>
    Effect.gen(function* () {
      const result = yield* Schema.decode(PublishConfig)({})
      expect(result.qos).toBe(0)
      expect(result.retain).toBe(false)
    })
  )

  it.effect('accepts overrides', () =>
    Effect.gen(function* () {
      const result = yield* Schema.decode(PublishConfig)({ qos: 1, retain: true })
      expect(result.qos).toBe(1)
      expect(result.retain).toBe(true)
    })
  )
})

describe('StateConfig', () => {
  it.effect('fills defaults from empty input', () =>
    Effect.gen(function* () {
      const result = yield* Schema.decode(StateConfig)({})
      expect(result.enabled).toBe(false)
      expect(result.qos).toBe(1)
      expect(result.retain).toBe(true)
    })
  )

  it.effect('accepts overrides', () =>
    Effect.gen(function* () {
      const result = yield* Schema.decode(StateConfig)({
        enabled: true,
        qos: 0,
        retain: false,
      })
      expect(result.enabled).toBe(true)
      expect(result.qos).toBe(0)
      expect(result.retain).toBe(false)
    })
  )
})
