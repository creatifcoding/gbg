# Phase 5: Stream Processing Architecture (Epic 19)

**Date**: 2026-02-07
**Status**: ARCHITECTURE — Ready for implementation
**Author**: architect-agent (Val)
**Scope**: Epic 19 — Stream Processing & Ingestion Pipeline (13 SP)
**Dependencies**: Phase 4 (HTTP/RPC) ~95% complete, Epics 1-18 delivered

---

## Executive Summary

Epic 19 builds the **real-time ingestion pipeline** that brings industrial sensor data into the IIoT system. Data flows from protocol adapters (OPC-UA, Sparkplug B, Modbus/MQTT) through an Effect Stream pipeline that routes readings to DeviceId, batch-inserts into TimescaleDB, and triggers alarm detection against configured sensor thresholds.

The system already has:
- `SensorReading` schema with OPC-UA quality codes (`src/lib/iiot/schemas/readings.ts`)
- `Sensor` schema with four threshold levels: `thresholdHigh`, `thresholdCritical`, `thresholdLow`, `thresholdCriticalLow`
- `SensorRpcs.Subscribe` RPC with `stream: true` support
- `AlarmTriggered` event schema for EventLog
- `ChannelService` with PubSub-based routing (`src/lib/streams/constructs/ChannelService.ts`)
- `Feed` abstraction for lifecycle-managed stream sources

Epic 19 connects all of this with a production-grade ingestion pipeline.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        Protocol Adapters (external boundary)                 │
│                                                                              │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────┐                   │
│  │ OpcUaAdapter │  │ SparkplugAdapter │  │ ModbusAdapter │                   │
│  │ (node-opcua) │  │ (sparkplug-*  )  │  │ (modbus-serial│                   │
│  └──────┬───────┘  └────────┬─────────┘  │  / jsmodbus) │                   │
│         │                   │            └──────┬───────┘                    │
│         └───────────┬───────┴───────────────────┘                            │
│                     │                                                        │
│                     ▼                                                        │
│         ┌──────────────────────┐                                             │
│         │  IngestionAdapter    │ ← Effect.Service interface                  │
│         │  subscribe(): Stream │                                             │
│         │  <IngestedReading>   │                                             │
│         └──────────┬───────────┘                                             │
│                    │                                                         │
└────────────────────┼─────────────────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     Stream Processing Pipeline                               │
│                                                                              │
│  1. TopicRouter        2. QualityMapper        3. BatchProcessor             │
│  ┌──────────────┐     ┌──────────────┐        ┌──────────────────┐          │
│  │ UNS topic →  │────▶│ Protocol Q → │───────▶│ Stream.grouped   │          │
│  │ DeviceId     │     │ OpcUaQuality │        │ WithinN(100,5s)  │          │
│  └──────────────┘     └──────────────┘        │ → insertBatch()  │          │
│                                               └────────┬─────────┘          │
│                                                        │                    │
│  4. AlarmDetector     5. EventPublisher                 │                    │
│  ┌──────────────┐     ┌──────────────┐                  │                    │
│  │ Stream.scan  │────▶│ AlarmEntity  │◀─────────────────┘                    │
│  │ (threshold)  │     │ .Trigger()   │                                       │
│  └──────────────┘     │ + PubSub     │                                       │
│                       └──────────────┘                                       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Storage Layer                                        │
│                                                                              │
│  ┌────────────────────┐   ┌───────────────────────────┐                     │
│  │ TimescaleDB        │   │ EventLog                  │                     │
│  │ iiot.sensor_readings│   │ AlarmTriggered events     │                     │
│  │ (hypertable)       │   │ (via EntityManager)       │                     │
│  └────────────────────┘   └───────────────────────────┘                     │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Design

### 1. IngestionAdapter Interface (Effect.Service)

**File**: `src/lib/iiot/adapters/ingestion.ts`

The adapter interface is protocol-agnostic. Each protocol adapter wraps its library's push/poll API into an Effect Stream.

```typescript
import { Context, Effect, Layer, Schema, Stream } from 'effect'

// =============================================================================
// IngestedReading — Protocol-normalized reading
// =============================================================================

export class IngestedReading extends Schema.TaggedClass<IngestedReading>()('IngestedReading', {
  /** Raw topic from protocol (e.g., MQTT topic, OPC-UA NodeId) */
  topic: Schema.String,
  /** Numeric value */
  value: Schema.Number,
  /** Timestamp from source (UTC) */
  sourceTimestamp: Schema.DateTimeUtc,
  /** Protocol-specific quality indicator (mapped to OpcUaQuality later) */
  sourceQuality: Schema.optional(Schema.String),
  /** Protocol metadata (extra fields from source) */
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
}) {}

// =============================================================================
// IngestionAdapter — Effect Service
// =============================================================================

export interface IngestionAdapterShape {
  /** Protocol name for logging/metrics */
  readonly protocol: string

  /**
   * Connect to the data source and return a stream of readings.
   * The stream should handle reconnection internally.
   * Backpressure is handled by the pipeline consumer (Stream.groupedWithin).
   */
  readonly subscribe: Effect.Effect<
    Stream.Stream<IngestedReading, IngestionError>,
    IngestionError
  >

  /**
   * Health check — is the connection alive?
   */
  readonly healthCheck: Effect.Effect<IngestionHealth, IngestionError>
}

export class IngestionAdapter extends Context.Tag('tmnl/iiot/IngestionAdapter')<
  IngestionAdapter,
  IngestionAdapterShape
>() {}

// =============================================================================
// Error and Health Types
// =============================================================================

export class IngestionError extends Schema.TaggedError<IngestionError>()(
  'IngestionError',
  {
    protocol: Schema.String,
    message: Schema.String,
    code: Schema.Literal(
      'CONNECTION_FAILED',
      'AUTHENTICATION_FAILED',
      'SUBSCRIPTION_FAILED',
      'DECODE_ERROR',
      'TIMEOUT',
      'PROTOCOL_ERROR'
    ),
    retryable: Schema.Boolean,
  }
) {}

export const IngestionHealth = Schema.Struct({
  protocol: Schema.String,
  connected: Schema.Boolean,
  lastMessageAt: Schema.optional(Schema.DateTimeUtc),
  messagesPerSecond: Schema.optional(Schema.Number),
  errorCount: Schema.Number,
})
export type IngestionHealth = Schema.Schema.Type<typeof IngestionHealth>
```

### 2. Protocol Adapters

#### 2a. OPC-UA Adapter

**File**: `src/lib/iiot/adapters/opcua-adapter.ts`

**npm package**: `node-opcua-client` (from the `node-opcua` ecosystem)
- Mature, production-grade OPC-UA stack for Node.js
- Supports subscriptions, monitored items, security modes
- Large dependency (~40MB) but the standard in the Node.js OPC-UA space

**Pattern**: Use `Stream.asyncPush` to bridge the `node-opcua` subscription callback API.

```typescript
import * as OpcUa from 'node-opcua-client'
import { Effect, Layer, Stream } from 'effect'

const makeOpcUaAdapter = (config: OpcUaConfig) =>
  Effect.gen(function* () {
    // Connection lifecycle managed by Effect scope
    const client = OpcUa.OPCUAClient.create({ /* config */ })

    return {
      protocol: 'opcua' as const,

      subscribe: Effect.gen(function* () {
        yield* Effect.tryPromise(() => client.connect(config.endpointUrl))
        const session = yield* Effect.tryPromise(() => client.createSession())
        const subscription = yield* Effect.tryPromise(() =>
          session.createSubscription2({
            requestedPublishingInterval: config.publishIntervalMs ?? 1000,
            requestedMaxKeepAliveCount: 10,
            maxNotificationsPerPublish: 100,
            priority: 10,
          })
        )

        // Bridge OPC-UA monitored items to Effect Stream
        return Stream.asyncPush<IngestedReading, IngestionError>((emit) =>
          Effect.gen(function* () {
            for (const nodeId of config.nodeIds) {
              const item = yield* Effect.tryPromise(() =>
                subscription.monitor({
                  nodeId,
                  attributeId: OpcUa.AttributeIds.Value,
                })
              )

              item.on('changed', (dataValue) => {
                emit.single(new IngestedReading({
                  topic: nodeId,
                  value: dataValue.value.value as number,
                  sourceTimestamp: dataValue.sourceTimestamp ?? new Date(),
                  sourceQuality: dataValue.statusCode?.name,
                }))
              })
            }

            // Cleanup on scope close
            yield* Effect.addFinalizer(() =>
              Effect.tryPromise(() => client.disconnect()).pipe(Effect.ignore)
            )
          })
        )
      }),

      healthCheck: Effect.succeed({
        protocol: 'opcua',
        connected: client.isReconnecting === false,
        errorCount: 0,
      }),
    }
  })
```

**Key design decisions**:
- `Stream.asyncPush` (not `Stream.async`) because OPC-UA is push-based
- `Effect.addFinalizer` for clean disconnect
- Reconnection handled by `node-opcua-client` internally (built-in reconnect logic)
- Each `MonitoredItem` fires `changed` events that map to `emit.single()`

#### 2b. Sparkplug B / MQTT Adapter

**File**: `src/lib/iiot/adapters/sparkplug-adapter.ts`

**npm packages**:
- `mqtt` (v5.x) — MQTT 3.1.1/5.0 client, lightweight
- `sparkplug-payload` — Sparkplug B protobuf encoder/decoder
- Alternative: `sparkplug-client` — all-in-one (wraps mqtt + protobuf)

**UNS Topic Structure** (Unified Namespace):
```
spBv1.0/{group_id}/DDATA/{edge_node_id}/{device_id}
```
Mapped to ISA-95:
```
spBv1.0/enterprise/DDATA/site.area.line/machine.sensor
```

```typescript
import mqtt from 'mqtt'
import { decodePayload } from 'sparkplug-payload'

const makeSparkplugAdapter = (config: SparkplugConfig) =>
  Effect.gen(function* () {
    return {
      protocol: 'sparkplug' as const,

      subscribe: Effect.gen(function* () {
        const client = yield* Effect.tryPromise(() =>
          new Promise<mqtt.MqttClient>((resolve, reject) => {
            const c = mqtt.connect(config.brokerUrl, {
              clientId: config.clientId ?? `tmnl-ingestion-${Date.now()}`,
              username: config.username,
              password: config.password,
              clean: true,
              reconnectPeriod: 5000, // Auto-reconnect
            })
            c.on('connect', () => resolve(c))
            c.on('error', reject)
          })
        )

        // Subscribe to Sparkplug topics
        yield* Effect.tryPromise(() =>
          client.subscribeAsync(config.topicFilter ?? 'spBv1.0/+/DDATA/#')
        )

        return Stream.asyncPush<IngestedReading, IngestionError>((emit) =>
          Effect.gen(function* () {
            client.on('message', (topic, payload) => {
              try {
                const sparkplugPayload = decodePayload(payload)
                for (const metric of sparkplugPayload.metrics ?? []) {
                  if (typeof metric.value === 'number') {
                    emit.single(new IngestedReading({
                      topic,
                      value: metric.value,
                      sourceTimestamp: new Date(Number(metric.timestamp ?? Date.now())),
                      sourceQuality: String(metric.quality ?? 'good'),
                      metadata: { metricName: metric.name },
                    }))
                  }
                }
              } catch (err) {
                // Log decode errors but don't kill the stream
                emit.single(/* skip or log */)
              }
            })

            yield* Effect.addFinalizer(() =>
              Effect.tryPromise(() => client.endAsync()).pipe(Effect.ignore)
            )
          })
        )
      }),

      healthCheck: /* ... */,
    }
  })
```

#### 2c. Modbus Adapter

**File**: `src/lib/iiot/adapters/modbus-adapter.ts`

**npm packages**:
- `jsmodbus` — Modbus TCP/RTU client (lightweight, well-maintained)
- Alternative: `modbus-serial` — simpler API, serial + TCP

**Pattern**: Modbus is request/response (polling), so use `Stream.repeatEffect` with a configurable interval.

```typescript
const makeModbusAdapter = (config: ModbusConfig) =>
  Effect.gen(function* () {
    return {
      protocol: 'modbus' as const,

      subscribe: Effect.gen(function* () {
        const client = yield* Effect.tryPromise(() => createModbusClient(config))

        // Modbus is poll-based — repeat at configured interval
        return Stream.repeatEffect(
          Effect.gen(function* () {
            const registers = yield* Effect.tryPromise(() =>
              client.readHoldingRegisters(config.startAddress, config.registerCount)
            )

            // Map register addresses to topic names
            return config.registerMap.map((mapping, i) =>
              new IngestedReading({
                topic: mapping.topic,
                value: registers.data[i],
                sourceTimestamp: DateTime.unsafeNow(),
                sourceQuality: 'good',
              })
            )
          })
        ).pipe(
          Stream.flatMap((readings) => Stream.fromIterable(readings)),
          Stream.schedule(Schedule.spaced(config.pollIntervalMs ?? 1000)),
        )
      }),

      healthCheck: /* ... */,
    }
  })
```

### 3. Topic-to-DeviceId Routing

**File**: `src/lib/iiot/adapters/device-routing.ts`

Maps protocol topics to ISA-95 DeviceId using the Unified Namespace (UNS) convention.

```typescript
import { Context, Effect, Schema, HashMap, Ref } from 'effect'
import { DeviceId } from '../schemas/identifiers'
import { IngestedReading } from './ingestion'
import { SensorReading, OpcUaQuality } from '../schemas/readings'

// =============================================================================
// Topic Routing Table
// =============================================================================

/**
 * Route entry mapping a topic pattern to a DeviceId.
 *
 * Supports:
 * - Exact match: 'spBv1.0/acme/DDATA/site-a/temp-01'
 * - Glob match: 'spBv1.0/acme/DDATA/site-a/*'
 * - OPC-UA node: 'ns=2;s=Motor01.Temperature'
 */
export const TopicRoute = Schema.Struct({
  topicPattern: Schema.String,
  deviceId: DeviceId,
  /** Optional transform (e.g., scale factor, offset) */
  transform: Schema.optional(Schema.Struct({
    scale: Schema.optional(Schema.Number),
    offset: Schema.optional(Schema.Number),
  })),
})
export type TopicRoute = Schema.Schema.Type<typeof TopicRoute>

// =============================================================================
// TopicRouter Service
// =============================================================================

export interface TopicRouterShape {
  readonly resolve: (topic: string) => Effect.Effect<DeviceId | null>
  readonly register: (route: TopicRoute) => Effect.Effect<void>
  readonly registerBatch: (routes: ReadonlyArray<TopicRoute>) => Effect.Effect<void>
}

export class TopicRouter extends Context.Tag('tmnl/iiot/TopicRouter')<
  TopicRouter,
  TopicRouterShape
>() {}

// Implementation uses a HashMap<string, DeviceId> for exact matches
// and a list of glob patterns for wildcard matches.
// Glob matching uses simple * wildcard (not full regex).

const makeTopicRouter = Effect.gen(function* () {
  const exactRoutes = yield* Ref.make(HashMap.empty<string, TopicRoute>())
  const globRoutes = yield* Ref.make<ReadonlyArray<TopicRoute>>([])

  const resolve = (topic: string) =>
    Effect.gen(function* () {
      // 1. Try exact match first (O(1))
      const exact = yield* Ref.get(exactRoutes)
      const found = HashMap.get(exact, topic)
      if (found._tag === 'Some') return found.value.deviceId

      // 2. Try glob match (O(n) but glob list is small)
      const globs = yield* Ref.get(globRoutes)
      for (const route of globs) {
        if (matchGlob(route.topicPattern, topic)) {
          return route.deviceId
        }
      }
      return null
    })

  return { resolve, register: /* ... */, registerBatch: /* ... */ }
})
```

### 4. Quality Code Mapping

**File**: `src/lib/iiot/adapters/quality-mapping.ts`

Maps protocol-specific quality codes to the existing `OpcUaQuality` schema.

```typescript
import { OpcUaQuality, QualityScore } from '../schemas/readings'

/**
 * Map source quality strings to OpcUaQuality.
 *
 * Each protocol has its own quality representation:
 * - OPC-UA: StatusCode names (direct mapping)
 * - Sparkplug B: integer quality (192=good, 0=bad)
 * - Modbus: no quality concept (assume 'good' if response received)
 */
export const mapQuality = (protocol: string, sourceQuality?: string): OpcUaQuality => {
  if (!sourceQuality) return 'good' as OpcUaQuality

  switch (protocol) {
    case 'opcua':
      return mapOpcUaStatusCode(sourceQuality)
    case 'sparkplug':
      return mapSparkplugQuality(sourceQuality)
    case 'modbus':
      return 'good' as OpcUaQuality // Modbus doesn't have quality
    default:
      return 'uncertain' as OpcUaQuality
  }
}

// OPC-UA StatusCode → OpcUaQuality is nearly 1:1
const mapOpcUaStatusCode = (statusCode: string): OpcUaQuality => {
  const normalized = statusCode.toLowerCase().replace(/\s+/g, '_')
  // StatusCode names map directly to our OpcUaQuality literals
  const mapping: Record<string, OpcUaQuality> = {
    'good': 'good' as OpcUaQuality,
    'good_localoverride': 'good_local_override' as OpcUaQuality,
    'uncertain': 'uncertain' as OpcUaQuality,
    'bad': 'bad' as OpcUaQuality,
    'bad_sensorfailure': 'bad_sensor_failure' as OpcUaQuality,
    'bad_nocommunication': 'bad_no_communication' as OpcUaQuality,
    // ... additional mappings
  }
  return mapping[normalized] ?? ('uncertain' as OpcUaQuality)
}

// Sparkplug B quality is an integer bitmask
const mapSparkplugQuality = (quality: string): OpcUaQuality => {
  const q = parseInt(quality, 10)
  if (q >= 192) return 'good' as OpcUaQuality
  if (q >= 64) return 'uncertain' as OpcUaQuality
  return 'bad' as OpcUaQuality
}
```

### 5. Reading Batch Processor

**File**: `src/lib/iiot/adapters/reading-processor.ts`

Uses `Stream.groupedWithin` for micro-batching before database insertion.

```typescript
import { Effect, Stream, Duration, Chunk } from 'effect'
import { SensorReading, QualityScore } from '../schemas/readings'
import { DeviceId } from '../schemas/identifiers'

// =============================================================================
// Batch Configuration
// =============================================================================

export const BatchConfig = Schema.Struct({
  /** Max readings per batch (default: 100) */
  maxBatchSize: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  /** Max time to wait for batch (default: 5 seconds) */
  maxBatchWindowMs: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
})

// =============================================================================
// Pipeline Composition
// =============================================================================

/**
 * Create the full ingestion pipeline:
 *
 * IngestedReading → route(DeviceId) → map(SensorReading) → batch → insertBatch
 *                                  ↘ detectAlarms → triggerAlarm
 */
export const makeIngestionPipeline = (config: {
  maxBatchSize?: number
  maxBatchWindowMs?: number
}) =>
  Effect.gen(function* () {
    const router = yield* TopicRouter
    const sensorReadingRepo = yield* SensorReadingRepo

    return (adapterStream: Stream.Stream<IngestedReading, IngestionError>) =>
      adapterStream.pipe(
        // 1. Route topic → DeviceId (drop unroutable readings)
        Stream.mapEffect((reading) =>
          Effect.gen(function* () {
            const deviceId = yield* router.resolve(reading.topic)
            if (!deviceId) return null
            return { reading, deviceId }
          })
        ),
        Stream.filter((r): r is NonNullable<typeof r> => r !== null),

        // 2. Map to SensorReading
        Stream.map(({ reading, deviceId }) =>
          new SensorReading({
            _tag: 'SensorReading',
            time: reading.sourceTimestamp,
            deviceId,
            value: reading.value,
            opcUaQuality: mapQuality('sparkplug', reading.sourceQuality),
            quality: qualityToScore(reading.sourceQuality) as QualityScore,
          })
        ),

        // 3. Fork: one branch for batch insert, one for alarm detection
        Stream.tap((reading) =>
          // Publish to PubSub for alarm detection (non-blocking)
          PubSub.publish(readingPubSub, reading)
        ),

        // 4. Micro-batch for TimescaleDB insertion
        Stream.groupedWithin(
          config.maxBatchSize ?? 100,
          Duration.millis(config.maxBatchWindowMs ?? 5000)
        ),

        // 5. Insert batch
        Stream.mapEffect((batch) =>
          sensorReadingRepo.insertBatch(Chunk.toArray(batch)).pipe(
            Effect.tapError((err) =>
              Effect.logError(`Batch insert failed: ${err}`)
            ),
            Effect.retry(Schedule.exponential(Duration.seconds(1)).pipe(
              Schedule.union(Schedule.recurs(3))
            ))
          )
        ),

        // 6. Run the pipeline
        Stream.runDrain,
      )
  })
```

**Key design decisions**:
- `Stream.groupedWithin(100, 5s)` balances throughput and latency: batch up to 100 readings OR flush every 5 seconds (whichever comes first)
- Alarm detection is forked off via `Stream.tap` + `PubSub.publish` so it doesn't block the insert path
- Retry with exponential backoff (1s, 2s, 4s) for transient database errors

### 6. Alarm Threshold Detection

**File**: `src/lib/iiot/adapters/alarm-detection.ts`

Monitors incoming readings against sensor thresholds and triggers alarms via the entity cluster.

```typescript
import { Effect, Stream, PubSub, HashMap, Ref, Option } from 'effect'
import { SensorReading } from '../schemas/readings'
import { Sensor, ThresholdStatus } from '../schemas/assets/sensor'
import { AlarmTriggered } from '../schemas/events/operational/alarm-events'

// =============================================================================
// Alarm Detector Service
// =============================================================================

export interface AlarmDetectorShape {
  /** Start monitoring a PubSub of readings for threshold violations */
  readonly monitor: (readingsPubSub: PubSub.PubSub<SensorReading>) => Effect.Effect<void>
}

export class AlarmDetector extends Context.Tag('tmnl/iiot/AlarmDetector')<
  AlarmDetector,
  AlarmDetectorShape
>() {}

/**
 * Alarm detection pipeline.
 *
 * Architecture:
 * 1. Subscribe to readings PubSub
 * 2. For each reading, look up sensor thresholds (cached in-memory)
 * 3. Check reading value against thresholds via Sensor.checkThresholds()
 * 4. If threshold exceeded AND not already in alarm, trigger AlarmEntity.Create
 * 5. Track active alarms per device to avoid duplicate triggers (deadband)
 *
 * Deadband logic:
 * - An alarm is triggered when value first exceeds threshold
 * - Subsequent readings that also exceed are NOT re-triggered
 * - Alarm is eligible for re-trigger only after a reading returns to normal
 * - This prevents alarm storms from noisy sensors
 */
const makeAlarmDetector = Effect.gen(function* () {
  // Cache: DeviceId -> Sensor (thresholds)
  const sensorCache = yield* Ref.make(HashMap.empty<string, Sensor>())
  // Active alarm tracking: DeviceId -> current alarm status
  const activeAlarms = yield* Ref.make(HashMap.empty<string, ThresholdStatus>())

  const monitor = (readingsPubSub: PubSub.PubSub<SensorReading>) =>
    Effect.gen(function* () {
      yield* Stream.fromPubSub(readingsPubSub).pipe(
        Stream.mapEffect((reading) =>
          Effect.gen(function* () {
            // Look up sensor for this device
            const cache = yield* Ref.get(sensorCache)
            const sensor = HashMap.get(cache, reading.deviceId)
            if (Option.isNone(sensor)) return // No thresholds configured

            const status = sensor.value.checkThresholds(reading.value)
            const currentAlarmStatus = HashMap.get(
              yield* Ref.get(activeAlarms),
              reading.deviceId
            )

            // Deadband: only trigger if transitioning INTO alarm state
            const wasNormal = Option.isNone(currentAlarmStatus) ||
              currentAlarmStatus.value === 'normal'

            if (status !== 'normal' && wasNormal) {
              // TRIGGER ALARM via cluster entity
              yield* triggerAlarm(reading, sensor.value, status)
            }

            // Update tracking
            yield* Ref.update(activeAlarms, (map) =>
              HashMap.set(map, reading.deviceId, status)
            )

            // If returning to normal from alarm, clear the alarm tracking
            if (status === 'normal' && !wasNormal) {
              yield* Ref.update(activeAlarms, (map) =>
                HashMap.remove(map, reading.deviceId)
              )
            }
          })
        ),
        Stream.runDrain,
        Effect.fork, // Run in background fiber
      )
    })

  return { monitor }
})
```

---

## Data Flow Diagram

```
                ┌─────────────────────────────────────────────────────────────┐
                │                     Ingestion Service                       │
                │                                                             │
  External      │  1. CONNECT     2. SUBSCRIBE     3. RECEIVE                │
  Protocol  ────┤  Effect.gen     Stream.asyncPush  IngestedReading           │
  (OPC-UA,      │  ────────►      ────────────►     ────────────►             │
   MQTT,        │                                                             │
   Modbus)      │                                                             │
                └─────────────────────────────────────────┬───────────────────┘
                                                          │
                                            Stream<IngestedReading>
                                                          │
                                                          ▼
                ┌─────────────────────────────────────────────────────────────┐
                │                    Processing Pipeline                      │
                │                                                             │
                │  4. ROUTE           5. MAP             6. BATCH             │
                │  TopicRouter       quality +           groupedWithin        │
                │  resolve(topic)    DeviceId →          (100, 5s) →          │
                │  → DeviceId       SensorReading       insertBatch()         │
                │       │                                    │                │
                │       │                                    │                │
                │       │  ┌──── FORK (Stream.tap) ────┐    │                │
                │       │  │                            │    │                │
                │       │  ▼                            │    │                │
                │  7. DETECT          8. TRIGGER         │    │                │
                │  checkThresholds    AlarmEntity         │    │                │
                │  + deadband         .Create()           │    │                │
                │                                        │    │                │
                └────────────────────────────────────────┴────┴───────────────┘
                                                          │
                                              ┌───────────┴───────────┐
                                              ▼                       ▼
                                        TimescaleDB             EventLog
                                    sensor_readings          AlarmTriggered
```

---

## Protocol Adapter Research

### npm Package Comparison

| Protocol | Package | Size | Maturity | Notes |
|----------|---------|------|----------|-------|
| **OPC-UA** | `node-opcua-client` | ~40MB | Production | Standard Node.js OPC-UA stack; used by Siemens, ABB |
| **OPC-UA** | `opcua` | ~5MB | Beta | Lighter alternative, less feature-complete |
| **MQTT** | `mqtt` (v5) | ~500KB | Production | Standard MQTT client, 3.1.1/5.0 support |
| **Sparkplug B** | `sparkplug-payload` | ~100KB | Stable | Protobuf encode/decode only |
| **Sparkplug B** | `sparkplug-client` | ~200KB | Stable | Full client (wraps mqtt + protobuf) |
| **Modbus** | `jsmodbus` | ~50KB | Production | TCP/RTU, well-maintained |
| **Modbus** | `modbus-serial` | ~100KB | Production | Simpler API, serial + TCP |

### Recommendation

1. **Start with `mqtt` + `sparkplug-payload`** — Most IIoT deployments use MQTT/Sparkplug B as the edge protocol. This is the highest-value adapter.
2. **OPC-UA second** — `node-opcua-client` for brownfield SCADA integration. Large dependency but production-proven.
3. **Modbus third** — `jsmodbus` for legacy PLC communication. Simple poll-based pattern.

### Adapter Priority (implementation order)

| Priority | Adapter | Reason |
|----------|---------|--------|
| P0 | **MockAdapter** | For testing, dev, and demos without hardware |
| P1 | **SparkplugAdapter** | Most common IIoT edge protocol |
| P2 | **OpcUaAdapter** | Brownfield SCADA integration |
| P3 | **ModbusAdapter** | Legacy PLC communication |

The **MockAdapter** is critical for Phase 5 testing -- it produces synthetic readings at configurable rates without external dependencies.

---

## Backpressure Strategy

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   Adapter    │       │  Processing  │       │   Database   │
│ (push-based) │ ────▶ │   Pipeline   │ ────▶ │   Insert     │
│              │       │              │       │              │
│ 10,000 msg/s │       │ groupedWithin│       │ batch insert │
│              │       │ (100, 5s)    │       │ (100 rows)   │
└──────────────┘       └──────────────┘       └──────────────┘
       │                      │                      │
       ▼                      ▼                      ▼
   If pipeline           Internal              If DB slow,
   can't consume,       buffering via         batch accumulates
   Stream.asyncPush     Chunk (bounded)       and retries with
   uses bounded                              exponential backoff
   Queue (drop-old)
```

**Strategy**:
1. `Stream.asyncPush` uses a bounded internal queue (default 16). If the pipeline can't keep up, the oldest readings are dropped (acceptable for sensor data -- latest values matter more)
2. `Stream.groupedWithin` provides a natural flow-control boundary -- it accumulates up to 100 readings before yielding a batch
3. Database insert retries with exponential backoff (1s, 2s, 4s, max 3 retries)
4. If the database is persistently down, the pipeline surfaces an `IngestionError` that triggers circuit-breaker logic at the adapter level

---

## Integration with Existing Infrastructure

### ChannelService Bridge (optional)

The existing `ChannelService` provides topology-based routing with PubSub. For Phase 5, we can optionally bridge ingested readings into the ChannelService for UI consumption:

```typescript
// Optional: Feed ingested readings into a Channel for UI streaming
const bridgeToChannelService = (channelService: ChannelServiceShape) =>
  Stream.tap((reading: SensorReading) =>
    channelService.connectStream(
      'readings-channel' as ChannelId,
      `inlet:${reading.deviceId}` as InletId,
      Stream.make(reading)
    )
  )
```

This bridge is **optional** for Epic 19 and could be deferred to Epic 20 (WebSocket).

### SensorRpcs.Subscribe Integration

The existing `SensorRpcs.Subscribe` RPC definition has `stream: true`. Once the ingestion pipeline is running, this RPC can be backed by the readings PubSub:

```typescript
// In the RPC handler:
subscribe: (request) =>
  Stream.fromPubSub(readingsPubSub).pipe(
    Stream.filter((r) => r.deviceId === request.deviceId),
    Stream.schedule(Schedule.spaced(request.pollIntervalMs ?? 5000)),
  )
```

---

## File Structure

```
src/lib/iiot/adapters/
├── ingestion.ts              # IngestionAdapter service interface + schemas
├── device-routing.ts         # TopicRouter service (UNS topic → DeviceId)
├── quality-mapping.ts        # Protocol quality → OpcUaQuality mapping
├── reading-processor.ts      # Batch processor (groupedWithin + insertBatch)
├── alarm-detection.ts        # Threshold detector (Stream.scan + deadband)
├── mock-adapter.ts           # MockAdapter for testing (synthetic readings)
├── opcua-adapter.ts          # OPC-UA adapter (node-opcua-client)
├── sparkplug-adapter.ts      # Sparkplug B/MQTT adapter (mqtt + sparkplug-payload)
├── modbus-adapter.ts         # Modbus adapter (jsmodbus, poll-based)
├── ingestion-service.ts      # IngestionService (orchestrates adapters + pipeline)
└── __tests__/
    ├── mock-adapter.test.ts
    ├── device-routing.test.ts
    ├── quality-mapping.test.ts
    ├── reading-processor.test.ts
    ├── alarm-detection.test.ts
    └── ingestion-pipeline.test.ts
```

---

## Implementation Phases

### Phase 19.1: Foundation (Tasks 19.1.1 - 19.1.4)

**Files to create**:
- `src/lib/iiot/adapters/ingestion.ts` — Service interface, IngestedReading, error types
- `src/lib/iiot/adapters/mock-adapter.ts` — MockAdapter for testing
- Adapter stubs (opcua, sparkplug, modbus — implement SparkplugAdapter first)

**Acceptance**:
- [ ] `IngestionAdapter` interface compiles
- [ ] `MockAdapter` produces synthetic readings at configurable rate
- [ ] Unit tests for MockAdapter pass

**Estimated effort**: 5 SP

### Phase 19.2: Routing & Quality (Tasks 19.2.1 - 19.2.3)

**Files to create**:
- `src/lib/iiot/adapters/device-routing.ts` — TopicRouter service
- `src/lib/iiot/adapters/quality-mapping.ts` — Quality code mapping

**Acceptance**:
- [ ] TopicRouter resolves exact and glob topics
- [ ] Quality mapping covers OPC-UA, Sparkplug B, Modbus
- [ ] Unit tests pass

**Estimated effort**: 3 SP

### Phase 19.3: Pipeline & Alarm Detection (Tasks 19.3.1 - 19.3.2)

**Files to create**:
- `src/lib/iiot/adapters/reading-processor.ts` — Batch processor
- `src/lib/iiot/adapters/alarm-detection.ts` — Threshold detector
- `src/lib/iiot/adapters/ingestion-service.ts` — Orchestrator

**Acceptance**:
- [ ] `Stream.groupedWithin` batches correctly
- [ ] Alarm detection fires on threshold crossing (with deadband)
- [ ] Integration test: MockAdapter -> pipeline -> verify batch insert + alarm trigger

**Estimated effort**: 5 SP

### Phase 19.4: Integration Testing (Task 19.4.1)

**Files to create**:
- `src/lib/iiot/adapters/__tests__/ingestion-pipeline.test.ts`

**Acceptance**:
- [ ] E2E test: MockAdapter -> route -> batch -> insert -> verify in TimescaleDB
- [ ] E2E test: MockAdapter -> detect threshold -> AlarmTriggered event emitted
- [ ] Performance: Pipeline handles 1,000 readings/second with mock adapter

**Estimated effort**: 3 SP (included in 13 SP total)

---

## Test Strategy

### Unit Tests (per component)

| Component | Test Focus | Pattern |
|-----------|-----------|---------|
| `MockAdapter` | Produces readings at rate | `it.effect()` + clock control |
| `TopicRouter` | Exact + glob matching | Pure function tests |
| `QualityMapping` | All protocol mappings | Exhaustive literal tests |
| `ReadingProcessor` | Batch size + time window | `TestClock` for time control |
| `AlarmDetector` | Threshold + deadband | State transition sequences |

### Integration Tests

| Test | Setup | Verification |
|------|-------|-------------|
| Full pipeline | MockAdapter + TestRunner cluster | Readings in mock repo + alarm events |
| Backpressure | MockAdapter at 10k/s + slow repo | No OOM, readings eventually processed |
| Reconnection | MockAdapter with intermittent failures | Pipeline resumes after errors |

### Property-Based Tests

- **Threshold detection**: For any sequence of readings, alarms are triggered if and only if value crosses threshold AND previous value was normal (deadband invariant)
- **Batch completeness**: Every reading from the adapter eventually appears in either a batch insert or an error log (no silent drops, except for unroutable topics)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `node-opcua-client` is 40MB | Bundle size | Tree-shake; only import `node-opcua-client`, not full `node-opcua` |
| MQTT broker unavailable | Ingestion stops | Auto-reconnect (built into `mqtt` package, 5s period) + circuit breaker |
| TimescaleDB batch insert failure | Data loss | Retry with backoff; if persistent, buffer to local file/queue |
| Alarm storm from noisy sensor | Operator fatigue | Deadband logic prevents re-trigger until value returns to normal |
| Topic routing misconfiguration | Readings go to wrong device | Validate routes at registration time; log unroutable topics |
| High-frequency sensors (>10k/s) | Pipeline backpressure | `Stream.asyncPush` bounded queue + `groupedWithin` batching |

---

## Open Questions

- [ ] **Q1**: Should the MockAdapter also generate OPC-UA quality code variations for testing quality mapping?
  - Recommendation: Yes -- produce ~5% `uncertain` and ~1% `bad` readings
- [ ] **Q2**: Should the alarm detector cache sensor thresholds from the cluster entity, or query SensorAssetState directly?
  - Recommendation: Query `SensorAssetState` at startup, then subscribe to config change events for live updates
- [ ] **Q3**: What is the target batch size for TimescaleDB insertion? 100 rows? 1000?
  - Recommendation: Start at 100, configurable via `BatchConfig`. TimescaleDB `COPY` is efficient at any batch size.
- [ ] **Q4**: Should we implement the `ChannelService` bridge in Epic 19 or defer to Epic 20?
  - Recommendation: Defer to Epic 20 -- keep Epic 19 focused on ingestion-to-storage path

---

## Success Criteria

1. MockAdapter can produce synthetic readings at 1,000/second
2. Full pipeline: adapter -> route -> batch -> TimescaleDB insert working
3. Alarm detection triggers AlarmTriggered events on threshold crossing
4. Deadband logic prevents duplicate alarms from noisy sensors
5. Pipeline handles adapter reconnection gracefully
6. All unit + integration tests pass
7. TypeScript compiles without errors
