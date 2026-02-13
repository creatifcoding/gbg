/**
 * SparkplugPipelineLayer Integration Tests
 *
 * Tests the Sparkplug-backed pipeline composition:
 * SparkplugAdapter -> TopicRouter -> ReadingProcessor -> AlarmDetector -> IngestionService
 *
 * These tests verify Layer composition and service wiring WITHOUT connecting
 * to a real MQTT broker. The SparkplugAdapter's subscribe Effect will not be
 * executed -- we test that the Layer composes correctly and that service
 * accessors (protocol, healthCheck) work as expected.
 *
 * @see ingestion-service.ts (19.1.3)
 * @see sparkplug-adapter.ts (F27.1-F27.3)
 */

import { describe, it, expect } from '@effect/vitest'
import { Effect, Layer, Schema, Stream, Chunk } from 'effect'
import {
  IngestionService,
  SparkplugPipelineLayer,
  setupPipeline,
  type ProcessedBatch,
} from '../ingestion-service'
import { IngestionAdapter } from '../ingestion'
import { TopicRouter } from '../device-routing'
import { ReadingProcessor } from '../reading-processor'
import { AlarmDetector } from '../alarm-detection'
import { SparkplugAdapterConfig } from '../sparkplug-adapter'

// =============================================================================
// Test Config
// =============================================================================

const testSparkplugConfig: SparkplugAdapterConfig = {
  serverUrl: 'mqtt://test-broker:1883',
  groupIds: ['test-group'],
}

const testSparkplugConfigMultiGroup: SparkplugAdapterConfig = {
  serverUrl: 'mqtt://test-broker:1883',
  groupIds: ['factory-a', 'factory-b'],
  username: 'admin',
  password: 's3cret',
  clientId: 'test-adapter',
}

const emptyGroupConfig: SparkplugAdapterConfig = {
  serverUrl: 'mqtt://test-broker:1883',
  groupIds: [],
}

// =============================================================================
// SparkplugPipelineLayer — Layer Composition
// =============================================================================

describe('SparkplugPipelineLayer', () => {
  describe('layer composition', () => {
    it('builds with valid sparkplug config', () => {
      const layer = SparkplugPipelineLayer({ sparkplug: testSparkplugConfig })
      expect(layer).toBeDefined()
    })

    it('builds with sparkplug config and custom batch config', () => {
      const layer = SparkplugPipelineLayer({
        sparkplug: testSparkplugConfig,
        batch: { maxBatchSize: 5, maxBatchWindowMs: 200 },
      })
      expect(layer).toBeDefined()
    })

    it('builds with multi-group config', () => {
      const layer = SparkplugPipelineLayer({
        sparkplug: testSparkplugConfigMultiGroup,
      })
      expect(layer).toBeDefined()
    })

    it('builds with empty groupIds', () => {
      const layer = SparkplugPipelineLayer({
        sparkplug: emptyGroupConfig,
      })
      expect(layer).toBeDefined()
    })

    it.effect('provides all required services', () =>
      Effect.gen(function* () {
        const service = yield* IngestionService
        const adapter = yield* IngestionAdapter
        const router = yield* TopicRouter
        const detector = yield* AlarmDetector

        expect(service).toBeDefined()
        expect(adapter).toBeDefined()
        expect(router).toBeDefined()
        expect(detector).toBeDefined()
      }).pipe(
        Effect.provide(SparkplugPipelineLayer({ sparkplug: testSparkplugConfig }))
      )
    )
  })

  // ===========================================================================
  // Service Identity — protocol
  // ===========================================================================

  describe('service identity', () => {
    it.effect('IngestionService.protocol returns sparkplug', () =>
      Effect.gen(function* () {
        const service = yield* IngestionService
        expect(service.protocol).toBe('sparkplug')
      }).pipe(
        Effect.provide(SparkplugPipelineLayer({ sparkplug: testSparkplugConfig }))
      )
    )

    it.effect('IngestionAdapter.protocol returns sparkplug', () =>
      Effect.gen(function* () {
        const adapter = yield* IngestionAdapter
        expect(adapter.protocol).toBe('sparkplug')
      }).pipe(
        Effect.provide(SparkplugPipelineLayer({ sparkplug: testSparkplugConfig }))
      )
    )
  })

  // ===========================================================================
  // Health Check
  // ===========================================================================

  describe('healthCheck', () => {
    it.effect('returns initial sparkplug health from IngestionService', () =>
      Effect.gen(function* () {
        const service = yield* IngestionService
        const health = yield* service.healthCheck
        expect(health.protocol).toBe('sparkplug')
        expect(health.connected).toBe(false)
        expect(health.errorCount).toBe(0)
      }).pipe(
        Effect.provide(SparkplugPipelineLayer({ sparkplug: testSparkplugConfig }))
      )
    )

    it.effect('returns initial sparkplug health from IngestionAdapter directly', () =>
      Effect.gen(function* () {
        const adapter = yield* IngestionAdapter
        const health = yield* adapter.healthCheck
        expect(health.protocol).toBe('sparkplug')
        expect(health.connected).toBe(false)
        expect(health.errorCount).toBe(0)
      }).pipe(
        Effect.provide(SparkplugPipelineLayer({ sparkplug: testSparkplugConfig }))
      )
    )

    it.effect('healthCheck consistent across service and adapter', () =>
      Effect.gen(function* () {
        const service = yield* IngestionService
        const adapter = yield* IngestionAdapter
        const serviceHealth = yield* service.healthCheck
        const adapterHealth = yield* adapter.healthCheck
        expect(serviceHealth.protocol).toBe(adapterHealth.protocol)
        expect(serviceHealth.connected).toBe(adapterHealth.connected)
        expect(serviceHealth.errorCount).toBe(adapterHealth.errorCount)
      }).pipe(
        Effect.provide(SparkplugPipelineLayer({ sparkplug: testSparkplugConfig }))
      )
    )
  })

  // ===========================================================================
  // Pipeline stream accessibility
  // ===========================================================================

  describe('pipeline', () => {
    it.effect('pipeline Effect is accessible from IngestionService', () =>
      Effect.gen(function* () {
        const service = yield* IngestionService
        // pipeline is an Effect that returns a Stream
        // We verify it exists without executing subscribe (which would try MQTT)
        expect(service.pipeline).toBeDefined()
        expect(typeof service.pipeline.pipe).toBe('function')
      }).pipe(
        Effect.provide(SparkplugPipelineLayer({ sparkplug: testSparkplugConfig }))
      )
    )
  })

  // ===========================================================================
  // Empty groupIds — stream completes immediately
  // ===========================================================================

  describe('empty groupIds pipeline', () => {
    it.effect('pipeline stream completes immediately with empty groupIds', () =>
      Effect.gen(function* () {
        const service = yield* IngestionService
        const stream = yield* service.pipeline
        // With empty groupIds, SparkplugAdapter.subscribe returns Stream.empty
        // The pipeline should therefore emit no batches
        const batches = yield* stream.pipe(Stream.runCollect)
        expect(Chunk.size(batches)).toBe(0)
      }).pipe(
        Effect.provide(SparkplugPipelineLayer({ sparkplug: emptyGroupConfig }))
      )
    )
  })

  // ===========================================================================
  // Config Validation via Schema
  // ===========================================================================

  describe('config validation', () => {
    it.effect('Schema.decode validates SparkplugAdapterConfig for pipeline', () =>
      Effect.gen(function* () {
        const decoded = yield* Schema.decode(SparkplugAdapterConfig)({
          serverUrl: 'mqtt://prod-broker:1883',
          groupIds: ['production'],
          username: 'prod-user',
          password: 'prod-pass',
        })
        // Verify the config is valid before passing to SparkplugPipelineLayer
        expect(decoded.serverUrl).toBe('mqtt://prod-broker:1883')
        expect(decoded.groupIds).toEqual(['production'])

        // Build layer with decoded config
        const layer = SparkplugPipelineLayer({ sparkplug: decoded })
        expect(layer).toBeDefined()
      })
    )

    it.effect('rejects invalid config before pipeline creation', () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(SparkplugAdapterConfig)({
          serverUrl: 12345, // invalid
          groupIds: ['test'],
        }).pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )
  })

  // ===========================================================================
  // setupPipeline integration
  // ===========================================================================

  describe('setupPipeline with sparkplug layer', () => {
    it.effect('registers routes in TopicRouter via sparkplug pipeline', () =>
      Effect.gen(function* () {
        yield* setupPipeline({
          routes: [
            { topicPattern: 'spBv1.0/test-group/DDATA/node-1/device-1/temp', deviceId: 'SPK-TEMP-001' },
          ],
          thresholds: [],
        })
        const router = yield* TopicRouter
        const resolved = yield* router.resolve('spBv1.0/test-group/DDATA/node-1/device-1/temp')
        expect(resolved).toBe('SPK-TEMP-001')
      }).pipe(
        Effect.provide(SparkplugPipelineLayer({ sparkplug: testSparkplugConfig }))
      )
    )

    it.effect('registers thresholds in AlarmDetector via sparkplug pipeline', () =>
      Effect.gen(function* () {
        const { DateTime } = yield* Effect.promise(() => import('effect'))
        yield* setupPipeline({
          routes: [],
          thresholds: [
            { deviceId: 'SPK-TEMP-001', thresholdHigh: 85, thresholdCritical: 95 },
          ],
        })
        const detector = yield* AlarmDetector
        const violation = yield* detector.checkReading(
          'SPK-TEMP-001',
          90,
          DateTime.unsafeNow(),
        )
        expect(violation).not.toBeNull()
        expect(violation!.status).toBe('high')
      }).pipe(
        Effect.provide(SparkplugPipelineLayer({ sparkplug: testSparkplugConfig }))
      )
    )
  })
})
