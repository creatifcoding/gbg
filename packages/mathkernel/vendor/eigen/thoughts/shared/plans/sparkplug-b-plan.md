# Feature Plan: Sparkplug B Protocol Adapter + Test Infrastructure

Created: 2026-02-07
Author: architect-agent (Val)
Status: ARCHITECTURE — Decisions resolved, ready for implementation

---

## Overview

Sparkplug B is the Eclipse Foundation's MQTT-based industrial protocol that standardizes topic namespaces, message types, and protobuf payloads for IIoT edge-to-cloud communication. This plan covers three deliverables: (1) a `SparkplugAdapter` that implements the existing `IngestionAdapter` Effect Service interface, (2) a `SparkplugPublisher` test tool for synthetic data generation, and (3) Nix/Docker infrastructure for local development with an EMQX broker.

## Requirements

- [ ] SparkplugAdapter implements `IngestionAdapterShape` (subscribe + healthCheck)
- [ ] Decodes Sparkplug B protobuf payloads via `sparkplug-payload` into `IngestedReading`
- [ ] Handles NBIRTH/DBIRTH for device discovery, DDATA for streaming data
- [ ] **Multi-group support** — adapter subscribes to multiple Sparkplug B groups simultaneously (DECIDED)
- [ ] **STATE message handling** — SCADA Primary/Standby awareness for HA (DECIDED)
- [ ] Reconnection logic via Effect retry with exponential backoff
- [ ] Health check reports MQTT connection state + throughput
- [ ] SparkplugPublisher emits synthetic NBIRTH, DBIRTH, DDATA messages
- [ ] Topic routing entries for Sparkplug B namespace (`spBv1.0/*/DDATA/*/*`)
- [ ] **All metrics flow through adapter** — filtering is a TopicRouter concern, not adapter (DECIDED)
- [ ] Integration tests with local EMQX broker
- [ ] Nix module with mission-control scripts
- [ ] OPC-UA and Modbus stub adapters for type-level completeness
- [ ] **EMQX as MQTT layer** — NATS stays internal; L2 bridge service forwards EMQX→NATS JetStream (DECIDED)

---

## Sparkplug B Protocol Reference

### Topic Namespace

```
spBv1.0/{group_id}/{message_type}/{edge_node_id}[/{device_id}]
```

| Message Type | Direction | Purpose | Device ID? |
|-------------|-----------|---------|------------|
| `NBIRTH`    | Edge→Broker | Node birth certificate (metrics catalog) | No |
| `NDEATH`    | Edge→Broker | Node death (via MQTT Will) | No |
| `DBIRTH`    | Edge→Broker | Device birth certificate (metrics catalog) | Yes |
| `DDEATH`    | Edge→Broker | Device death | Yes |
| `NDATA`     | Edge→Broker | Node-level data | No |
| `DDATA`     | Edge→Broker | Device-level data (primary data stream) | Yes |
| `NCMD`      | App→Edge   | Node command | No |
| `DCMD`      | App→Edge   | Device command | Yes |
| `STATE`     | App→Broker | Application state (SCADA host awareness) | N/A |

### Protobuf Payload (UPayload)

```typescript
interface UPayload {
  timestamp?: number | Long    // Epoch ms
  seq?: number | Long          // Sequence number (0-255, wraps)
  metrics?: UMetric[]          // Array of metric values
  uuid?: string
  body?: Uint8Array
}

interface UMetric {
  name?: string                // Metric name (e.g., "Temperature")
  alias?: number | Long       // Numeric alias (after BIRTH establishes mapping)
  timestamp?: number | Long   // Per-metric timestamp (epoch ms)
  dataType?: number           // DataType enum (see below)
  value: number | Long | boolean | string | Uint8Array | UDataSet | UTemplate | null
  type: TypeStr               // "Int32" | "Double" | "Boolean" | "String" | ...
  properties?: Record<string, UPropertyValue>  // Metadata (quality, engineering units)
}
```

### Quality Encoding

Sparkplug B metric quality is encoded as an integer bitmask in `metric.properties.Quality`:

| Range     | Meaning     | OpcUaQuality Mapping |
|-----------|-------------|---------------------|
| >= 192    | Good        | `'good'`            |
| >= 64     | Uncertain   | `'uncertain'`       |
| < 64      | Bad         | `'bad'`             |

**Already implemented**: `mapSparkplugQuality()` in `quality-mapping.ts:83-89`.

### Sequence Numbers

- NBIRTH resets sequence to 0
- Each subsequent message increments (0-255, wraps)
- Consumers use seq to detect out-of-order / dropped messages
- bdSeq (birth-death sequence) in NBIRTH/NDEATH for session tracking

### Metric Aliasing

- BIRTH messages establish `name` → `alias` mapping
- Subsequent DDATA messages can use `alias` instead of `name` (bandwidth optimization)
- Adapter must maintain alias registry per edge node

---

## Design

### Architecture

```
                         EMQX Broker (MQTT 3.1.1/5.0)
                              │
                   ┌──────────┴──────────┐
                   │                     │
          SparkplugPublisher      SparkplugAdapter
          (test tool)            (IngestionAdapter impl)
                   │                     │
                   │              ┌──────┴──────┐
                   │              │             │
                   │        AliasRegistry  MetricDecoder
                   │              │             │
                   │              └──────┬──────┘
                   │                     │
                   │                     ▼
                   │            Stream<IngestedReading>
                   │                     │
                   │              TopicRouter → DeviceId
                   │                     │
                   │            ReadingProcessor (batch)
                   │                     │
                   │            AlarmDetector (threshold)
                   │                     │
                   │              IngestionService
                   │                     │
                   └─────────────────────┘
```

### Key Design Decisions

#### Decision 1: sparkplug-client vs raw mqtt.js + sparkplug-payload

**Choice: Use `sparkplug-client` (v3.2.4)**

Rationale:
- Handles NBIRTH/NDEATH/DBIRTH/DDEATH lifecycle automatically
- Manages bdSeq and seq counters
- Handles payload compression/decompression (GZIP/DEFLATE via pako)
- Handles Will message setup for NDEATH
- Event-based API maps cleanly to `Stream.async`
- Maintained by Eclipse Tahu project (same team as the spec)

Risk: Depends on `mqtt@^4.2.8` (v4), not latest v5. Acceptable because Sparkplug B uses MQTT 3.1.1 features only; v5 features (shared subscriptions, etc.) are not needed.

#### Decision 2: Adapter Architecture — Subscribe-Only vs Full Lifecycle

**Choice: Subscribe-only for initial implementation**

The SparkplugAdapter will act as a **Sparkplug Application** (consumer), not an Edge Node. It subscribes to DDATA topics and processes incoming readings. It does NOT publish NBIRTH/DBIRTH (that's the publisher's job).

For the SparkplugAdapter:
- Subscribe to `spBv1.0/+/DDATA/+/+` for device data
- Subscribe to `spBv1.0/+/DBIRTH/+/+` for device birth certificates (alias registry)
- Subscribe to `spBv1.0/+/NBIRTH/+` for node birth certificates
- Subscribe to `spBv1.0/+/DDEATH/+/+` and `spBv1.0/+/NDEATH/+` for death notifications

#### Decision 3: Alias Registry Scope

**Choice: Per-EdgeNode alias maps stored in Effect Ref**

Each edge node establishes its own metric alias namespace in NBIRTH/DBIRTH. The adapter maintains a `HashMap<string, HashMap<number, string>>` mapping `edgeNodeId → (alias → metricName)`.

On NBIRTH: Clear and rebuild alias map for that edge node.
On DBIRTH: Add device-scoped aliases to the edge node's map.

#### Decision 4: Effect-Native Stream Bridge

The `sparkplug-client` is an EventEmitter. We bridge to Effect Stream using `Stream.async`:

```typescript
Stream.async<IngestedReading, IngestionError>((emit) => {
  client.on('message', (topic, payload) => {
    // decode + emit
  })
  client.on('error', (err) => {
    emit.fail(new IngestionError({ ... }))
  })
})
```

This is the canonical pattern for wrapping push-based APIs into Effect Streams.

#### Decision 5: Multi-Group Support (DECIDED by Prime)

**Choice: Multiple sparkplug-client instances, one per group**

Each Sparkplug B group requires its own sparkplug-client instance because `sparkplug-client` binds to a single `groupId` at construction. The adapter creates N clients for N groups and merges their output streams:

```typescript
// For each groupId, create a sparkplug-client + Stream
const streams = config.groupIds.map(groupId => 
  createGroupStream(groupId, config, aliasRegistry)
)
// Merge all group streams into a single output
return Stream.mergeAll(streams, { concurrency: config.groupIds.length })
```

This approach:
- Isolates per-group lifecycle (one group's NDEATH doesn't affect others)
- Allows independent reconnection per group
- Alias registries are already per-edge-node, so no conflict

#### Decision 6: EMQX + NATS Architecture (DECIDED by Prime)

**Choice: EMQX is the MQTT layer; NATS stays internal**

```
Edge Devices ──MQTT──▶ EMQX Broker ──▶ SparkplugAdapter ──▶ Pipeline
                                              │
                                              ▼
                                    L2 Bridge Service (future)
                                              │
                                              ▼
                                       NATS JetStream
                                    (internal event bus)
```

- EMQX handles all MQTT concerns: retained messages, Will messages, Sparkplug B awareness
- NATS MQTT bridge is NOT used for Sparkplug B (can't do retained/will)
- A separate L2 bridge service will forward selected EMQX topics to NATS JetStream
- The bridge is a future epic, not part of this plan

#### Decision 7: STATE Message Handling (DECIDED by Prime)

**Choice: Implement STATE message handling for SCADA HA awareness**

The adapter will subscribe to `STATE/{scada_host_id}` topics and track which SCADA application is PRIMARY vs STANDBY. This enables:
- Detecting when the primary SCADA host goes offline
- Coordinating with redundant application instances
- Logging state transitions for audit

Implementation: Track active SCADA hosts in a `Ref<HashMap<string, 'ONLINE' | 'OFFLINE'>>`. Emit state change events via the metadata field of a synthetic IngestedReading (or a separate side-channel).

---

## Interfaces

### SparkplugAdapterConfig

```typescript
// src/lib/iiot/adapters/sparkplug-adapter.ts

export const SparkplugAdapterConfig = Schema.Struct({
  /** MQTT broker URL (e.g., 'mqtt://localhost:1883') */
  serverUrl: Schema.String,
  /** MQTT username */
  username: Schema.optional(Schema.String),
  /** MQTT password */
  password: Schema.optional(Schema.String),
  /** Sparkplug B group IDs to subscribe to (e.g., ['plant-a', 'plant-b']) */
  groupIds: Schema.Array(Schema.NonEmptyString),
  /** MQTT client ID (auto-generated if omitted) */
  clientId: Schema.optional(Schema.String),
  /** Subscription topic patterns (default: subscribe to all DDATA in group) */
  subscribeTopics: Schema.optional(Schema.Array(Schema.String)),
  /** Whether to track device birth/death lifecycle (default: true) */
  trackLifecycle: Schema.optional(Schema.Boolean),
})
export type SparkplugAdapterConfig = Schema.Schema.Type<typeof SparkplugAdapterConfig>
```

### SparkplugPublisherConfig

```typescript
// src/lib/iiot/adapters/sparkplug-publisher.ts

export const SparkplugPublisherConfig = Schema.Struct({
  /** MQTT broker URL */
  serverUrl: Schema.String,
  /** MQTT username */
  username: Schema.optional(Schema.String),
  /** MQTT password */
  password: Schema.optional(Schema.String),
  /** Sparkplug B group ID */
  groupId: Schema.String,
  /** Edge node ID */
  edgeNodeId: Schema.String,
  /** Device configurations to simulate */
  devices: Schema.Array(Schema.Struct({
    deviceId: Schema.String,
    metrics: Schema.Array(Schema.Struct({
      name: Schema.String,
      type: Schema.Literal('Double', 'Float', 'Int32', 'Boolean'),
      /** Value range for numeric types */
      min: Schema.optional(Schema.Number),
      max: Schema.optional(Schema.Number),
    })),
  })),
  /** Publish interval in milliseconds (default: 1000) */
  publishIntervalMs: Schema.optional(Schema.Number),
})
export type SparkplugPublisherConfig = Schema.Schema.Type<typeof SparkplugPublisherConfig>
```

### Data Flow

1. EMQX broker receives Sparkplug B messages from edge devices (or SparkplugPublisher)
2. SparkplugAdapter subscribes via `sparkplug-client` (acts as Sparkplug Application)
3. On NBIRTH/DBIRTH: Update alias registry, log device discovery
4. On DDATA: For each metric in payload:
   a. Resolve metric name (via alias if needed)
   b. Extract numeric value (skip non-numeric for now)
   c. Build topic string: `spBv1.0/{groupId}/DDATA/{edgeNode}/{deviceId}/{metricName}`
   d. Extract quality from metric properties (if present)
   e. Create `IngestedReading` with topic, value, timestamp, sourceQuality
   f. Emit into Effect Stream
5. TopicRouter resolves topic to DeviceId
6. ReadingProcessor batches readings
7. AlarmDetector checks thresholds

---

## Dependencies

| Dependency | Type | Version | Reason |
|------------|------|---------|--------|
| `@selfcharters/sparkplug-client` | monorepo (new) | 0.1.0 | Effect-native Sparkplug B protocol layer (replaces `sparkplug-client`) |
| `mqtt` | npm (new, direct) | ^5.15.0 | MQTT 5.0 client — latest, full feature set |
| `sparkplug-payload` | npm (new, direct) | ^1.0.3 | Protobuf encode/decode for Sparkplug B payloads |
| `effect` | npm (existing) | * | Effect Stream, Layer, Schema, Ref |
| EMQX broker | docker | 5.x | MQTT broker with Sparkplug B awareness |

Note: We build our own Effect-native Sparkplug B client (`@selfcharters/sparkplug-client`) on top of `mqtt@5` + `sparkplug-payload`. This replaces the Eclipse `sparkplug-client@3.2.4` which hardcodes `clean: true`, `retain: false`, QoS 0 with no override path. See Appendix A for detailed analysis.

---

## Implementation Phases

### Phase 1: Foundation — Types + Alias Registry

**Files to create:**
- `src/lib/iiot/adapters/sparkplug-adapter.ts` — Config schema, alias registry, metric decoder

**What to build:**
1. `SparkplugAdapterConfig` schema (as shown above)
2. `AliasRegistry` — Effect Ref-based per-node alias mapping:

```typescript
// Internal alias registry
const AliasRegistry = {
  make: () => Ref.make(HashMap.empty<string, HashMap<number, string>>()),

  // On NBIRTH/DBIRTH: register aliases from birth metrics
  registerBirth: (ref, edgeNodeId, metrics) => Ref.update(ref, ...),

  // On DDATA: resolve alias to metric name
  resolveAlias: (ref, edgeNodeId, alias) => Ref.get(ref).pipe(...),

  // On NDEATH: clear edge node's aliases
  clearNode: (ref, edgeNodeId) => Ref.update(ref, HashMap.remove(edgeNodeId)),
}
```

3. `decodeMetricValue` — Extract numeric value from UMetric, handling type coercion:
   - `Double`, `Float`, `Int32`, `Int16`, `Int8`, `UInt32`, `UInt16`, `UInt8` → `number`
   - `Int64`, `UInt64` → `Long.toNumber()` (warn on precision loss > Number.MAX_SAFE_INTEGER)
   - `Boolean` → `1` or `0`
   - `String`, `DateTime`, etc. → skip (not numeric sensor data)

4. `extractQuality` — Extract quality from `metric.properties?.Quality?.value` as string

**Acceptance:**
- [ ] Types compile (`bunx tsc --noEmit`)
- [ ] Alias registry unit tests pass
- [ ] Metric decoder unit tests pass

**Estimated effort:** Small

### Phase 2: SparkplugAdapter — Core Implementation

**Files to create/modify:**
- `src/lib/iiot/adapters/sparkplug-adapter.ts` — Full adapter implementation
- `src/lib/iiot/adapters/index.ts` — Add exports

**What to build:**

```typescript
export const SparkplugAdapterLive = (
  config: SparkplugAdapterConfig,
): Layer.Layer<IngestionAdapter> => {
  // 1. Create sparkplug-client in subscribe()
  // 2. Bridge EventEmitter → Effect Stream
  // 3. Decode DDATA metrics → IngestedReading
  // 4. Handle NBIRTH/DBIRTH for alias registry
  // 5. Handle NDEATH/DDEATH for cleanup
  // 6. Reconnection via Effect.retry with Schedule.exponential
}
```

Key implementation details:

**Subscribe method:**
```typescript
subscribe: Effect.gen(function* () {
  const aliasRegistry = yield* AliasRegistry.make()
  const healthState = yield* Ref.make<IngestionHealth>({
    protocol: 'sparkplug',
    connected: false,
    errorCount: 0,
  })

  // Create one stream per group, then merge
  const groupStreams = config.groupIds.map(groupId => 
    createGroupStream(groupId, config, aliasRegistry, healthState)
  )
  return Stream.mergeAll(groupStreams, { concurrency: config.groupIds.length })
})

// Helper: create a Stream for a single Sparkplug B group
const createGroupStream = (
  groupId: string,
  config: SparkplugAdapterConfig,
  aliasRegistry: AliasRegistryRef,
  healthState: Ref<IngestionHealth>,
) => Stream.async<IngestedReading, IngestionError>((emit) => {
    const client = newClient({
      serverUrl: config.serverUrl,
      username: config.username ?? '',
      password: config.password ?? '',
      groupId,
      edgeNode: `adapter-${groupId}-${config.clientId ?? crypto.randomUUID().slice(0, 8)}`,
      clientId: config.clientId 
        ? `${config.clientId}-${groupId}` 
        : `tmnl-sparkplug-${groupId}-${crypto.randomUUID().slice(0, 8)}`,
    })

    client.on('birth', () => {
      // Subscribe to DDATA, DBIRTH, DDEATH for all edge nodes in this group
      const topics = config.subscribeTopics ?? [
        `spBv1.0/${groupId}/DDATA/+/+`,
        `spBv1.0/${groupId}/DBIRTH/+/+`,
        `spBv1.0/${groupId}/DDEATH/+/+`,
        `spBv1.0/${groupId}/NBIRTH/+`,
        `spBv1.0/${groupId}/NDEATH/+`,
      ]
      for (const topic of topics) {
        client.subscribeTopic(topic)
      }
      // Also subscribe to STATE topics for SCADA HA
      client.subscribeTopic('STATE/+')
    })

    client.on('message', (topic, payload) => {
      // Parse topic: spBv1.0/{group}/{type}/{edgeNode}[/{device}]
      const parts = topic.split('/')

      // Handle STATE messages (SCADA HA awareness)
      if (parts[0] === 'STATE') {
        const scadaHostId = parts[1]
        // payload contains ONLINE or OFFLINE as UTF-8 string
        // Update SCADA host state tracking
        return
      }

      const groupId = parts[1]
      const msgType = parts[2]  // DDATA, DBIRTH, etc.
      const edgeNodeId = parts[3]
      const deviceId = parts[4]

      if (msgType === 'NBIRTH' || msgType === 'DBIRTH') {
        // Register aliases from birth metrics
        // (run as Effect, handle async)
        return
      }

      if (msgType === 'NDEATH') {
        // Clear alias registry for this edge node
        return
      }

      if (msgType === 'DDATA' && payload.metrics) {
        for (const metric of payload.metrics) {
          const metricName = metric.name
            ?? /* resolve alias */ undefined
          if (!metricName) continue

          const numericValue = decodeMetricValue(metric)
          if (numericValue === null) continue

          const quality = extractQuality(metric)
          const timestamp = metric.timestamp
            ?? payload.timestamp
            ?? Date.now()

          // All metrics flow through — filtering is TopicRouter's concern
          emit.single(new IngestedReading({
            topic: `spBv1.0/${groupId}/DDATA/${edgeNodeId}/${deviceId}/${metricName}`,
            value: numericValue,
            sourceTimestamp: DateTime.unsafeMake(new Date(Number(timestamp))),
            sourceQuality: quality,
            metadata: {
              groupId,
              edgeNodeId,
              deviceId: deviceId ?? edgeNodeId,
              metricType: metric.type,
            },
          }))
        }
      }
    })

    client.on('error', (err) => {
      // Update error count, don't fail the stream (reconnect handles it)
    })

    client.on('close', () => {
      // Update health state
    })

    client.on('reconnect', () => {
      // Log reconnection attempt
    })
  })
})
```

**Health check:**
```typescript
healthCheck: Ref.get(healthState)
```

**Dependencies:** Phase 1

**Acceptance:**
- [ ] SparkplugAdapterLive compiles
- [ ] Unit tests with mock sparkplug-client events pass
- [ ] Stream emits IngestedReading from synthetic DDATA payloads

**Estimated effort:** Medium

### Phase 3: SparkplugPublisher — Test Tool

**Files to create:**
- `src/lib/iiot/adapters/sparkplug-publisher.ts` — Publisher implementation
- `scripts/sparkplug-publish.ts` — CLI entry point

**What to build:**

The publisher acts as a Sparkplug B Edge Node that publishes synthetic device data. It uses `sparkplug-client` to handle the birth/death lifecycle automatically.

```typescript
export const createSparkplugPublisher = (config: SparkplugPublisherConfig) =>
  Effect.gen(function* () {
    const client = newClient({
      serverUrl: config.serverUrl,
      username: config.username ?? '',
      password: config.password ?? '',
      groupId: config.groupId,
      edgeNode: config.edgeNodeId,
      clientId: `publisher-${config.edgeNodeId}`,
    })

    // Wait for 'birth' event
    yield* Effect.async<void>((resume) => {
      client.on('birth', () => resume(Effect.void))
    })

    // Publish NBIRTH with all device metrics
    const allMetrics: UMetric[] = config.devices.flatMap(d =>
      d.metrics.map(m => ({
        name: `${d.deviceId}/${m.name}`,
        type: m.type as TypeStr,
        value: 0,
      }))
    )
    client.publishNodeBirth({ timestamp: Date.now(), metrics: allMetrics })

    // Publish DBIRTH for each device
    for (const device of config.devices) {
      const deviceMetrics = device.metrics.map(m => ({
        name: m.name,
        type: m.type as TypeStr,
        value: 0,
      }))
      client.publishDeviceBirth(device.deviceId, {
        timestamp: Date.now(),
        metrics: deviceMetrics,
      })
    }

    // Publish DDATA at configured interval
    const interval = config.publishIntervalMs ?? 1000

    return {
      /** Start publishing loop — returns a Stream of published readings for verification */
      start: Stream.repeatEffectWithSchedule(
        Effect.gen(function* () {
          const now = Date.now()
          for (const device of config.devices) {
            const metrics: UMetric[] = device.metrics.map(m => {
              const min = m.min ?? 0
              const max = m.max ?? 100
              return {
                name: m.name,
                type: m.type as TypeStr,
                value: m.type === 'Boolean'
                  ? Math.random() > 0.5
                  : min + Math.random() * (max - min),
              }
            })
            client.publishDeviceData(device.deviceId, {
              timestamp: now,
              metrics,
            })
          }
        }),
        Schedule.spaced(Duration.millis(interval)),
      ),

      /** Stop the publisher */
      stop: Effect.sync(() => client.stop()),
    }
  })
```

**CLI script (`scripts/sparkplug-publish.ts`):**
```typescript
#!/usr/bin/env bun
import { Effect, Duration, Stream } from 'effect'
import { createSparkplugPublisher } from '../src/lib/iiot/adapters/sparkplug-publisher'

const config = {
  serverUrl: process.env.MQTT_BROKER ?? 'mqtt://localhost:1883',
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASS,
  groupId: process.env.SPARKPLUG_GROUP ?? 'plant-a',
  edgeNodeId: process.env.SPARKPLUG_EDGE ?? 'edge-01',
  devices: [
    {
      deviceId: 'sensor-array-01',
      metrics: [
        { name: 'Temperature', type: 'Double' as const, min: 20, max: 85 },
        { name: 'Pressure', type: 'Double' as const, min: 1.0, max: 10.0 },
        { name: 'Vibration', type: 'Double' as const, min: 0, max: 15 },
        { name: 'FlowRate', type: 'Float' as const, min: 0, max: 500 },
      ],
    },
    {
      deviceId: 'motor-drive-01',
      metrics: [
        { name: 'RPM', type: 'Int32' as const, min: 0, max: 3600 },
        { name: 'Current', type: 'Double' as const, min: 0, max: 120 },
        { name: 'Running', type: 'Boolean' as const },
      ],
    },
  ],
  publishIntervalMs: 1000,
}

const program = Effect.gen(function* () {
  console.log(`[SparkplugPublisher] Connecting to ${config.serverUrl}...`)
  console.log(`[SparkplugPublisher] Group: ${config.groupId}, Edge: ${config.edgeNodeId}`)
  const publisher = yield* createSparkplugPublisher(config)
  console.log('[SparkplugPublisher] Connected. Publishing DDATA every 1s...')
  console.log('[SparkplugPublisher] Press Ctrl+C to stop')
  yield* publisher.start.pipe(Stream.runDrain)
})

Effect.runPromise(program).catch(console.error)
```

**Dependencies:** Phase 1 (shared types), EMQX broker running

**Acceptance:**
- [ ] Publisher connects to EMQX
- [ ] Publishes NBIRTH, DBIRTH, then periodic DDATA
- [ ] Messages visible via `mosquitto_sub` or EMQX dashboard
- [ ] CLI script runs with `bun run scripts/sparkplug-publish.ts`

**Estimated effort:** Medium

### Phase 4: Topic Routing Configuration

**Files to modify:**
- `src/lib/iiot/adapters/ingestion-service.ts` — Add Sparkplug convenience layer
- `src/lib/iiot/adapters/index.ts` — Update exports

**What to build:**

Default TopicRoute entries for Sparkplug B namespace:

```typescript
/**
 * Default topic routes for Sparkplug B.
 *
 * Maps the composite topic (with metric name appended by the adapter)
 * to DeviceId. The glob pattern captures: group/DDATA/edgeNode/deviceId/metricName
 *
 * Pattern: spBv1.0/{group}/DDATA/{edge}/{device}/{metric}
 * DeviceId: {edge}:{device}
 */
export const defaultSparkplugRoutes: ReadonlyArray<TopicRoute> = [
  {
    topicPattern: 'spBv1.0/*/DDATA/*/*/*',
    deviceId: '$3:$4',  // edge:device — BUT: matchGlob doesn't support capture groups
  },
]
```

**Note on capture groups:** The current `matchGlob` implementation does NOT support capture groups (`$1`, `$2`). Two options:

**Option A (Recommended):** Add a `deviceIdExtractor` function to TopicRoute that extracts deviceId from the matched topic string:
```typescript
const SparkplugDeviceExtractor = (topic: string): string => {
  // spBv1.0/{group}/DDATA/{edgeNode}/{deviceId}/{metricName}
  const parts = topic.split('/')
  return `${parts[3]}:${parts[4]}`  // edgeNode:deviceId
}
```

**Option B:** Register explicit routes per device (requires knowing devices upfront from DBIRTH).

**Choice: Option A** — Add `deviceIdExtractor` to the adapter, register a glob route with a static deviceId placeholder, then override the resolve result in the adapter before emitting IngestedReading.

Actually, the cleaner approach: the SparkplugAdapter already knows the `edgeNodeId` and `deviceId` from the topic parse. Instead of relying on TopicRouter glob matching, the adapter can embed the deviceId directly into the `IngestedReading.metadata` and let a Sparkplug-aware TopicRoute resolve it.

**Simplest approach:** Register explicit routes during DBIRTH discovery. When DBIRTH arrives for `edgeNode/deviceId`, auto-register a TopicRoute:
```typescript
// On DBIRTH:
router.register({
  topicPattern: `spBv1.0/${groupId}/DDATA/${edgeNodeId}/${deviceId}/*`,
  deviceId: `${edgeNodeId}:${deviceId}`,
})
```

This is the most natural approach — device discovery drives route registration.

**Dependencies:** Phase 2

**Acceptance:**
- [ ] DBIRTH triggers automatic route registration
- [ ] DDATA readings are routable after DBIRTH

**Estimated effort:** Small

### Phase 5: Docker + Nix Infrastructure

**Files to create:**
- `docker/docker-compose.sparkplug.yml` — EMQX broker + SparkplugPublisher
- `nix/modules/sparkplug/default.nix` — Nix module with scripts

**Note:** The EMQX broker infrastructure is being planned separately by a parallel architect. This phase covers the Sparkplug-specific parts that layer on top of the broker.

**Docker Compose (`docker/docker-compose.sparkplug.yml`):**
```yaml
# Sparkplug B test infrastructure
# Extends the EMQX broker with a Sparkplug publisher sidecar
#
# Usage:
#   docker compose -f docker-compose.iiot.yml -f docker-compose.sparkplug.yml up -d
#
# Requires: EMQX broker running (from docker-compose.emqx.yml or similar)

services:
  sparkplug-publisher:
    build:
      context: ../
      dockerfile: docker/sparkplug/Dockerfile
    container_name: tmnl_sparkplug_publisher
    environment:
      MQTT_BROKER: 'mqtt://emqx:1883'
      SPARKPLUG_GROUPS: 'plant-a'  # Comma-separated for multi-group
      SPARKPLUG_EDGE: 'edge-sim-01'
      PUBLISH_INTERVAL_MS: '1000'
    depends_on:
      emqx:
        condition: service_healthy
    networks:
      - iiot
    restart: unless-stopped
```

**Nix module (`nix/modules/sparkplug/default.nix`):**
```nix
{ inputs, lib, ... }:
{
  perSystem = { config, pkgs, system, lib, ... }: {
    mission-control.scripts = {
      sparkplug-publish = {
        description = "Run Sparkplug B test publisher";
        category = "IIoT";
        exec = ''
          cd "$FLAKE_ROOT/packages/tmnl"
          bun run scripts/sparkplug-publish.ts
        '';
      };

      sparkplug-subscribe = {
        description = "Subscribe to Sparkplug B topics (debug)";
        category = "IIoT";
        exec = ''
          BROKER=''${MQTT_BROKER:-"localhost:1883"}
          echo "[Sparkplug] Subscribing to spBv1.0/# on $BROKER..."
          mosquitto_sub -h "''${BROKER%%:*}" -p "''${BROKER##*:}" -t "spBv1.0/#" -v
        '';
      };

      sparkplug-test = {
        description = "Run Sparkplug B integration tests";
        category = "IIoT";
        exec = ''
          cd "$FLAKE_ROOT/packages/tmnl"
          bun test src/lib/iiot/__tests__/adapters/sparkplug-adapter.test.ts
        '';
      };
    };
  };
}
```

**Dependencies:** EMQX broker plan (parallel effort)

**Acceptance:**
- [ ] `docker compose -f docker-compose.sparkplug.yml up` starts publisher
- [ ] Nix scripts available via `tmnl sparkplug-publish`
- [ ] Publisher → EMQX → SparkplugAdapter pipeline works end-to-end

**Estimated effort:** Small

### Phase 6: Integration Tests

**Files to create:**
- `src/lib/iiot/__tests__/adapters/sparkplug-adapter.test.ts` — Unit tests
- `src/lib/iiot/__tests__/adapters/sparkplug-integration.test.ts` — E2E with EMQX

**Unit tests (no broker needed):**
```typescript
import { it } from '@effect/vitest'

describe('SparkplugAdapter', () => {
  describe('decodeMetricValue', () => {
    it('decodes Double metric', () => { ... })
    it('decodes Int32 metric', () => { ... })
    it('decodes Boolean metric as 0/1', () => { ... })
    it('returns null for String metric', () => { ... })
    it('handles Long values', () => { ... })
  })

  describe('AliasRegistry', () => {
    it.effect('registers aliases from DBIRTH', () => Effect.gen(function* () { ... }))
    it.effect('resolves alias to metric name', () => Effect.gen(function* () { ... }))
    it.effect('clears aliases on NDEATH', () => Effect.gen(function* () { ... }))
  })

  describe('extractQuality', () => {
    it('extracts quality from metric properties', () => { ... })
    it('returns undefined when no quality property', () => { ... })
  })

  describe('topic parsing', () => {
    it('parses DDATA topic', () => { ... })
    it('parses DBIRTH topic', () => { ... })
    it('parses NBIRTH topic (no deviceId)', () => { ... })
  })
})
```

**Integration tests (requires EMQX):**
```typescript
describe('SparkplugAdapter Integration', () => {
  // Skip if EMQX not available
  const brokerUrl = process.env.MQTT_BROKER ?? 'mqtt://localhost:1883'

  it.effect('receives DDATA as IngestedReading', () =>
    Effect.gen(function* () {
      // 1. Start SparkplugAdapter
      // 2. Start SparkplugPublisher
      // 3. Collect 10 readings from adapter stream
      // 4. Verify readings have correct topic, value range, timestamp
      // 5. Stop both
    }).pipe(
      Effect.provide(SparkplugAdapterLive({ serverUrl: brokerUrl, groupIds: ['test'] })),
      Effect.provide(TopicRouterLive),
    )
  )

  it.effect('auto-registers routes from DBIRTH', () =>
    Effect.gen(function* () {
      // 1. Start adapter with TopicRouter
      // 2. Publish DBIRTH
      // 3. Verify TopicRouter has route for device
    })
  )
})
```

**Dependencies:** Phase 2, Phase 3, Phase 5 (EMQX running)

**Acceptance:**
- [ ] Unit tests pass without broker
- [ ] Integration tests pass with EMQX
- [ ] Coverage > 80% for adapter code

**Estimated effort:** Medium

### Phase 7: Stub Adapters — OPC-UA + Modbus

**Files to create:**
- `src/lib/iiot/adapters/opcua-adapter-stub.ts`
- `src/lib/iiot/adapters/modbus-adapter-stub.ts`

**What to build:**

Minimal stubs for type-level completeness of the adapter registry:

```typescript
// opcua-adapter-stub.ts
export const OpcUaAdapterConfig = Schema.Struct({
  endpointUrl: Schema.String,
  securityPolicy: Schema.optional(Schema.String),
})
export type OpcUaAdapterConfig = Schema.Schema.Type<typeof OpcUaAdapterConfig>

export const OpcUaAdapterLive = (config: OpcUaAdapterConfig): Layer.Layer<IngestionAdapter> =>
  Layer.succeed(IngestionAdapter, {
    protocol: 'opcua',
    subscribe: Effect.die('OPC-UA adapter not yet implemented'),
    healthCheck: Effect.die('OPC-UA adapter not yet implemented'),
  })
```

```typescript
// modbus-adapter-stub.ts
export const ModbusAdapterConfig = Schema.Struct({
  host: Schema.String,
  port: Schema.optional(Schema.Number),
  unitId: Schema.optional(Schema.Number),
  mode: Schema.optional(Schema.Literal('tcp', 'rtu', 'ascii')),
})
export type ModbusAdapterConfig = Schema.Schema.Type<typeof ModbusAdapterConfig>

export const ModbusAdapterLive = (config: ModbusAdapterConfig): Layer.Layer<IngestionAdapter> =>
  Layer.succeed(IngestionAdapter, {
    protocol: 'modbus',
    subscribe: Effect.die('Modbus adapter not yet implemented'),
    healthCheck: Effect.die('Modbus adapter not yet implemented'),
  })
```

**Dependencies:** None (Phase 1 types exist)

**Acceptance:**
- [ ] Both stubs compile
- [ ] Exported from `index.ts`
- [ ] Config schemas validate correctly

**Estimated effort:** Tiny

---

## File Manifest

| Phase | File | Action | Purpose |
|-------|------|--------|---------|
| 1 | `src/lib/iiot/adapters/sparkplug-adapter.ts` | Create | Config, AliasRegistry, MetricDecoder |
| 2 | `src/lib/iiot/adapters/sparkplug-adapter.ts` | Modify | Full adapter implementation |
| 2 | `src/lib/iiot/adapters/index.ts` | Modify | Export SparkplugAdapter |
| 3 | `src/lib/iiot/adapters/sparkplug-publisher.ts` | Create | Test publisher |
| 3 | `scripts/sparkplug-publish.ts` | Create | CLI entry point |
| 4 | `src/lib/iiot/adapters/ingestion-service.ts` | Modify | Sparkplug convenience layer |
| 5 | `docker/docker-compose.sparkplug.yml` | Create | Publisher docker compose |
| 5 | `nix/modules/sparkplug/default.nix` | Create | Nix scripts |
| 5 | `nix/modules/default.nix` | Modify | Add sparkplug shell |
| 6 | `src/lib/iiot/__tests__/adapters/sparkplug-adapter.test.ts` | Create | Unit tests |
| 6 | `src/lib/iiot/__tests__/adapters/sparkplug-integration.test.ts` | Create | E2E tests |
| 7 | `src/lib/iiot/adapters/opcua-adapter-stub.ts` | Create | OPC-UA stub |
| 7 | `src/lib/iiot/adapters/modbus-adapter-stub.ts` | Create | Modbus stub |
| 7 | `src/lib/iiot/adapters/index.ts` | Modify | Export stubs |
| 2 | `package.json` | Modify | Add `@selfcharters/sparkplug-client` workspace dependency |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Custom protocol layer maintenance | Low — ~150 lines of protocol logic | Well-tested, spec-compliant, Effect-native. Less code than sparkplug-client's 450 lines. |
| EMQX broker not ready | High — blocks integration tests | Unit tests work without broker. Publisher + adapter can be tested independently with any MQTT broker (even mosquitto). |
| `sparkplug-payload` uses `Long` (64-bit) | Low — precision loss for Int64/UInt64 | Warn on values > Number.MAX_SAFE_INTEGER. Most IIoT metrics are Double/Float/Int32. |
| `sparkplug-client` is EventEmitter-based | Low — needs bridging to Effect Stream | `Stream.async` is the canonical pattern. Well-documented in Effect. |
| Metric aliasing complexity | Medium — incorrect alias resolution corrupts data | Thorough unit tests for AliasRegistry. Clear on NDEATH. Log unresolved aliases. |
| protobufjs binary compilation | Low — may need native compilation for some platforms | `sparkplug-payload` bundles pre-compiled protobuf. Falls back to JS implementation. |

---

## Resolved Decisions (formerly Open Questions)

- [x] **EMQX vs NATS MQTT bridge**: **EMQX confirmed.** NATS MQTT bridge cannot handle retained messages or Will messages. EMQX is the MQTT layer; NATS stays internal. A new L2 bridge service will forward EMQX topics to NATS JetStream (separate epic).
- [x] **Multi-group support**: **YES.** Adapter creates one sparkplug-client instance per group and merges output streams via `Stream.mergeAll`. Config changed from `groupId: string` to `groupIds: string[]`.
- [x] **Metric filtering**: **TopicRouter level.** All metrics flow through the adapter unfiltered. TopicRouter glob patterns control which metrics reach the pipeline.
- [x] **STATE message handling**: **YES.** Adapter subscribes to `STATE/+` topics and tracks SCADA Primary/Standby host state for HA awareness. Included in Phase 2.

---

## Success Criteria

1. SparkplugAdapter connects to EMQX and streams IngestedReading from Sparkplug B DDATA messages
2. **Multi-group**: Adapter subscribes to N groups simultaneously, merges streams correctly
3. SparkplugPublisher generates realistic synthetic IIoT data at configurable rates
4. End-to-end pipeline: Publisher → EMQX → SparkplugAdapter → TopicRouter → ReadingProcessor → AlarmDetector works
5. Alias resolution works for devices that use metric aliases after BIRTH
6. Quality mapping uses existing `mapSparkplugQuality()` function correctly
7. **STATE handling**: Adapter tracks SCADA host ONLINE/OFFLINE state transitions
8. **All metrics pass through**: No adapter-level filtering; TopicRouter controls routing
9. Unit tests pass without external dependencies; integration tests pass with EMQX
10. Nix scripts provide one-command access to publish/subscribe/test

---

## Coordination Notes

- **EMQX confirmed** as the MQTT broker. The EMQX infrastructure plan is complete (`thoughts/shared/plans/emqx-broker-plan.md`). SparkplugAdapter depends on EMQX being available; unit tests work without it.
- The SparkplugPublisher can also be used with any MQTT 3.1.1+ broker (mosquitto, etc.) for testing before EMQX is ready.
- The `docker-compose.sparkplug.yml` is designed to extend the EMQX compose file, not replace it.
- **NATS bridge** is a separate future epic: an L2 service that forwards selected EMQX topics to NATS JetStream. Not part of this plan.
- **EMQX + NATS coexistence**: EMQX owns MQTT (external edge devices); NATS owns internal pub/sub + JetStream. No overlap in responsibility.


---

## Appendix A: Nortech Fork Analysis (@nortech/sparkplug-client)

### What It Is

`@nortech/sparkplug-client@3.5.2` is a fork of Eclipse Tahu's `sparkplug-client` maintained by Nortech.ai (Oslo, Norway). Published May 2025, it is the most recently updated Sparkplug B client for Node.js.

### What It Changed (vs Eclipse sparkplug-client@3.2.4)

| Change | Impact |
|--------|--------|
| Upgraded `mqtt` dependency from `^4.2.8` to `^5.12.1` | Uses mqtt.js v5 (MQTT 5.0 support at the transport level) |
| Exported `decodePayload`, `decompressPayload`, `maybeDecompressPayload` as public functions | Allows external payload processing without instantiating a client |
| Added `cb?: mqtt.PacketCallback` to `publishNodeBirth`, `publishNodeData`, `publishDeviceData`, `publishDeviceBirth` | Enables publish confirmation callbacks |
| Added `cb?: mqtt.CloseCallback` and `force?: boolean` to `stop()` | Cleaner shutdown semantics |
| Uses `@nortech/sparkplug-payload` instead of `sparkplug-payload` | Their own fork of the payload library (functionally identical) |
| Code style: double quotes, trailing commas, reorganized imports | Cosmetic |

### What It Did NOT Change

Every critical MQTT parameter remains hardcoded with no override path:

```javascript
// @nortech/sparkplug-client constructor (identical to Eclipse):
_this.mqttOptions = {
  ...(config.mqttOptions || {}),  // user overrides spread FIRST
  clientId: clientId,              // OVERWRITTEN
  clean: true,                     // HARDCODED — no persistent sessions
  keepalive: keepalive,
  reschedulePings: false,
  connectTimeout: 30000,
  username: username,
  password: password,
  will: {                          // HARDCODED — cannot customize
    topic: `spBv1.0/${groupId}/NDEATH/${edgeNode}`,
    payload: Buffer.from(encodedDeathPayload),
    qos: 0,                        // HARDCODED
    retain: false,                  // HARDCODED
  }
};
```

The TypeScript type enforces this: `mqttOptions?: Omit<IClientOptions, 'clientId' | 'clean' | 'keepalive' | 'reschedulePings' | 'connectTimeout' | 'username' | 'password' | 'will'>`. You cannot pass `clean`, `will`, or any of the Omit'd properties.

All publish methods (`publishNodeBirth`, `publishDeviceBirth`, `publishDeviceData`, `publishNodeData`) call `this.client.publish(topic, payload)` with two arguments — no options object — defaulting to `{qos: 0, retain: false}`.

### Why It's Insufficient

1. **Cannot set `retain: true` on NBIRTH/DBIRTH** — blocks testing retained birth certificates
2. **Cannot set `clean: false`** — blocks testing persistent MQTT sessions
3. **Cannot customize Will QoS** — blocks testing QoS 1 for NDEATH delivery guarantee
4. **Cannot customize Will retain** — blocks testing retained death notifications
5. **Single `groupId` per client** — blocks multi-group support without N client instances
6. **EventEmitter API** — requires bridging to Effect Stream (not a dealbreaker, but adds boilerplate)

The Nortech fork solves the mqtt.js version problem but not the configurability problem. For our use case (empirical broker testing, Effect-native architecture, multi-group support), we need full control over MQTT options.

---

## Appendix B: @selfcharters/sparkplug-client Fork Plan

### Overview

A new NX library package at `packages/sparkplug-client/` that provides an Effect-native Sparkplug B protocol layer on top of `mqtt@5` + `sparkplug-payload`. This replaces both `sparkplug-client@3.2.4` (Eclipse) and `@nortech/sparkplug-client@3.5.2` (Nortech fork).

**Key principle**: Every MQTT option is configurable via Effect Schema. The adapter layer (in `packages/tmnl`) composes these primitives into the `IngestionAdapter` interface.

### Package Structure

```
packages/sparkplug-client/
├── package.json
├── project.json
├── tsconfig.json
├── tsconfig.lib.json
├── tsconfig.spec.json
├── src/
│   ├── index.ts                    # Barrel exports
│   ├── MqttTransport.ts            # Effect Service for MQTT connection lifecycle
│   ├── SparkplugCodec.ts           # Protobuf encode/decode wrapper
│   ├── SparkplugProtocol.ts        # Topic builder, seq counters, Will construction
│   ├── SparkplugService.ts         # High-level Sparkplug B Service (compose all modules)
│   ├── config.ts                   # Effect Schema config types
│   └── errors.ts                   # SparkplugError TaggedError
├── test/
│   ├── MqttTransport.test.ts
│   ├── SparkplugCodec.test.ts
│   ├── SparkplugProtocol.test.ts
│   └── SparkplugService.test.ts
└── README.md
```

### package.json

```json
{
  "name": "@selfcharters/sparkplug-client",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "private": true,
  "dependencies": {
    "mqtt": "^5.15.0",
    "sparkplug-payload": "^1.0.3",
    "effect": "^3.18.4"
  },
  "devDependencies": {
    "@effect/vitest": "*",
    "vitest": "*"
  },
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "build": "tsc"
  }
}
```

### project.json

```json
{
  "name": "@selfcharters/sparkplug-client",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "packages/sparkplug-client/src",
  "projectType": "library",
  "tags": ["scope:iiot", "type:lib"],
  "targets": {
    "test": {
      "executor": "nx:run-commands",
      "options": {
        "command": "bun run test:run",
        "cwd": "packages/sparkplug-client"
      }
    },
    "build": {
      "executor": "nx:run-commands",
      "options": {
        "command": "bun run build",
        "cwd": "packages/sparkplug-client"
      }
    }
  }
}
```

### Module Architecture

#### 1. config.ts — Effect Schema Config Types (~40 lines)

All MQTT options are configurable. Nothing is hardcoded.

```typescript
import { Schema } from 'effect'

/** MQTT connection options — every parameter exposed */
export const MqttConfig = Schema.Struct({
  serverUrl: Schema.String,
  clientId: Schema.optional(Schema.String),
  username: Schema.optional(Schema.String),
  password: Schema.optional(Schema.String),
  /** Clean session — default true. Set false for persistent sessions. */
  clean: Schema.optional(Schema.Boolean),
  keepalive: Schema.optional(Schema.Number),
  connectTimeout: Schema.optional(Schema.Number),
  /** Will message — fully configurable. Auto-constructed if omitted. */
  will: Schema.optional(Schema.Struct({
    topic: Schema.String,
    payload: Schema.Uint8ArrayFromSelf,
    qos: Schema.optional(Schema.Literal(0, 1, 2)),
    retain: Schema.optional(Schema.Boolean),
  })),
})
export type MqttConfig = Schema.Schema.Type<typeof MqttConfig>

/** Sparkplug B protocol options */
export const SparkplugConfig = Schema.Struct({
  /** Sparkplug B group IDs to subscribe to */
  groupIds: Schema.Array(Schema.NonEmptyString),
  /** Edge node identifier (for this adapter instance) */
  edgeNodeId: Schema.String,
  /** Protocol version — default 'spBv1.0' */
  version: Schema.optional(Schema.String),
  /** Publish options for BIRTH messages */
  birthPublishOptions: Schema.optional(Schema.Struct({
    qos: Schema.optional(Schema.Literal(0, 1, 2)),
    retain: Schema.optional(Schema.Boolean),
  })),
  /** Publish options for DATA messages */
  dataPublishOptions: Schema.optional(Schema.Struct({
    qos: Schema.optional(Schema.Literal(0, 1, 2)),
    retain: Schema.optional(Schema.Boolean),
  })),
  /** Subscribe QoS for incoming messages */
  subscribeQos: Schema.optional(Schema.Literal(0, 1, 2)),
  /** Enable payload compression (GZIP/DEFLATE) */
  compression: Schema.optional(Schema.Literal('GZIP', 'DEFLATE')),
})
export type SparkplugConfig = Schema.Schema.Type<typeof SparkplugConfig>

/** Combined config */
export const SparkplugClientConfig = Schema.Struct({
  mqtt: MqttConfig,
  sparkplug: SparkplugConfig,
})
export type SparkplugClientConfig = Schema.Schema.Type<typeof SparkplugClientConfig>
```

#### 2. SparkplugProtocol.ts — Pure Protocol Logic (~60 lines)

```typescript
import { Ref, Effect } from 'effect'
import { encodePayload } from 'sparkplug-payload/lib/sparkplugbpayload'
import type { UPayload, UMetric } from 'sparkplug-payload/lib/sparkplugbpayload'

// ── Topic Builder ──────────────────────────────────────────────────────
export const buildTopic = (
  version: string,
  groupId: string,
  msgType: string,
  edgeNode: string,
  deviceId?: string,
): string =>
  deviceId
    ? `${version}/${groupId}/${msgType}/${edgeNode}/${deviceId}`
    : `${version}/${groupId}/${msgType}/${edgeNode}`

export const parseTopic = (topic: string) => {
  const parts = topic.split('/')
  return {
    version: parts[0],   // 'spBv1.0'
    groupId: parts[1],   // 'plant-a'
    msgType: parts[2],   // 'DDATA', 'DBIRTH', etc.
    edgeNode: parts[3],  // 'edge-01'
    deviceId: parts[4],  // 'sensor-01' (optional)
  }
}

// ── Sequence Counters ──────────────────────────────────────────────────
/** Message sequence counter (0-255, wraps) */
export const SeqCounter = {
  make: () => Ref.make(0),
  next: (ref: Ref.Ref<number>) =>
    Ref.modify(ref, (n) => {
      const current = n
      const next = n >= 255 ? 0 : n + 1
      return [current, next]
    }),
  reset: (ref: Ref.Ref<number>) => Ref.set(ref, 0),
}

/** Birth-death sequence counter (monotonically increasing) */
export const BdSeqCounter = {
  make: () => Ref.make(0),
  next: (ref: Ref.Ref<number>) =>
    Ref.modify(ref, (n) => [n, n + 1]),
}

// ── Death Payload ──────────────────────────────────────────────────────
export const makeDeathPayload = (bdSeq: number): UPayload => ({
  timestamp: Date.now(),
  metrics: [{
    name: 'bdSeq',
    value: bdSeq,
    type: 'UInt64',
  }],
})

// ── Will Message Construction ──────────────────────────────────────────
export const makeWillMessage = (
  version: string,
  groupId: string,
  edgeNode: string,
  bdSeq: number,
  qos: 0 | 1 | 2 = 0,
  retain: boolean = false,
) => ({
  topic: buildTopic(version, groupId, 'NDEATH', edgeNode),
  payload: Buffer.from(encodePayload(makeDeathPayload(bdSeq))),
  qos,
  retain,
})

// ── Birth Payload Helpers ──────────────────────────────────────────────
export const addSeqNumber = (payload: UPayload, seq: number): UPayload => ({
  ...payload,
  seq,
})

export const addBdSeqMetric = (payload: UPayload, bdSeq: number): UPayload => ({
  ...payload,
  metrics: [
    ...(payload.metrics ?? []),
    { name: 'bdSeq', type: 'UInt64' as const, value: bdSeq },
  ],
})
```

#### 3. MqttTransport.ts — Effect Service for MQTT Connection (~50 lines)

```typescript
import { Context, Effect, Layer, Stream, Scope, Schema } from 'effect'
import * as mqtt from 'mqtt'
import type { MqttConfig } from './config'

export interface MqttTransportShape {
  /** The underlying mqtt.js client */
  readonly client: mqtt.MqttClient
  /** Publish a message with full control over options */
  readonly publish: (
    topic: string,
    payload: Buffer,
    options?: { qos?: 0 | 1 | 2; retain?: boolean },
  ) => Effect.Effect<void>
  /** Subscribe to a topic pattern */
  readonly subscribe: (
    topic: string,
    qos?: 0 | 1 | 2,
  ) => Effect.Effect<void>
  /** Stream of raw incoming messages */
  readonly messages: Stream.Stream<{ topic: string; payload: Buffer }>
  /** Whether the client is currently connected */
  readonly isConnected: Effect.Effect<boolean>
}

export class MqttTransport extends Context.Tag('selfcharters/MqttTransport')<
  MqttTransport,
  MqttTransportShape
>() {}

export const MqttTransportLive = (config: MqttConfig): Layer.Layer<MqttTransport> =>
  Layer.scoped(MqttTransport, Effect.gen(function* () {
    const client = yield* Effect.acquireRelease(
      Effect.async<mqtt.MqttClient, never>((resume) => {
        const c = mqtt.connect(config.serverUrl, {
          clientId: config.clientId ?? `selfcharters-${crypto.randomUUID().slice(0, 8)}`,
          clean: config.clean ?? true,
          keepalive: config.keepalive ?? 5,
          connectTimeout: config.connectTimeout ?? 30000,
          username: config.username,
          password: config.password,
          will: config.will,
        })
        c.on('connect', () => resume(Effect.succeed(c)))
      }),
      (c) => Effect.sync(() => c.end(true)),
    )

    const messages = Stream.async<{ topic: string; payload: Buffer }>((emit) => {
      client.on('message', (topic, payload) => {
        emit.single({ topic, payload: Buffer.from(payload) })
      })
    })

    return MqttTransport.of({
      client,
      publish: (topic, payload, options) => Effect.sync(() => {
        client.publish(topic, payload, { qos: options?.qos ?? 0, retain: options?.retain ?? false })
      }),
      subscribe: (topic, qos) => Effect.sync(() => {
        client.subscribe(topic, { qos: qos ?? 0 })
      }),
      messages,
      isConnected: Effect.sync(() => client.connected),
    })
  }))
```

#### 4. SparkplugCodec.ts — Protobuf Encode/Decode (~30 lines)

```typescript
import { encodePayload, decodePayload } from 'sparkplug-payload/lib/sparkplugbpayload'
import type { UPayload, UMetric, TypeStr } from 'sparkplug-payload/lib/sparkplugbpayload'
import Long from 'long'

export { encodePayload, decodePayload }
export type { UPayload, UMetric, TypeStr }

/** Extract numeric value from a Sparkplug B metric */
export const decodeMetricValue = (metric: UMetric): number | null => {
  if (metric.value === null || metric.value === undefined) return null
  switch (metric.type) {
    case 'Double': case 'Float':
    case 'Int8': case 'Int16': case 'Int32':
    case 'UInt8': case 'UInt16': case 'UInt32':
      return typeof metric.value === 'number' ? metric.value : null
    case 'Int64': case 'UInt64':
      if (Long.isLong(metric.value)) return metric.value.toNumber()
      if (typeof metric.value === 'number') return metric.value
      return null
    case 'Boolean':
      return metric.value === true ? 1 : metric.value === false ? 0 : null
    default:
      return null  // String, DateTime, DataSet, Template, etc.
  }
}

/** Extract quality from metric properties */
export const extractQuality = (metric: UMetric): string | undefined => {
  const qualityProp = metric.properties?.['Quality']
  if (!qualityProp) return undefined
  return String(qualityProp.value)
}
```

#### 5. SparkplugService.ts — High-Level Composed Service (~40 lines)

```typescript
import { Context, Effect, Layer, Stream, Ref, HashMap } from 'effect'
import { MqttTransport } from './MqttTransport'
import { decodePayload, decodeMetricValue, extractQuality } from './SparkplugCodec'
import { buildTopic, parseTopic, SeqCounter, BdSeqCounter, makeWillMessage, addSeqNumber, addBdSeqMetric } from './SparkplugProtocol'
import type { SparkplugConfig } from './config'
import type { UPayload } from 'sparkplug-payload/lib/sparkplugbpayload'

export interface SparkplugServiceShape {
  /** Stream of decoded Sparkplug B messages (all types) */
  readonly messages: Stream.Stream<SparkplugMessage>
  /** Publish NBIRTH */
  readonly publishNodeBirth: (payload: UPayload) => Effect.Effect<void>
  /** Publish DBIRTH */
  readonly publishDeviceBirth: (deviceId: string, payload: UPayload) => Effect.Effect<void>
  /** Publish DDATA */
  readonly publishDeviceData: (deviceId: string, payload: UPayload) => Effect.Effect<void>
  /** Publish DDEATH */
  readonly publishDeviceDeath: (deviceId: string, payload: UPayload) => Effect.Effect<void>
  /** Alias registry: edgeNodeId → (alias → metricName) */
  readonly aliasRegistry: Ref.Ref<HashMap.HashMap<string, HashMap.HashMap<number, string>>>
}

export interface SparkplugMessage {
  readonly topic: string
  readonly groupId: string
  readonly msgType: string
  readonly edgeNodeId: string
  readonly deviceId?: string
  readonly payload: UPayload
}

export class SparkplugService extends Context.Tag('selfcharters/SparkplugService')<
  SparkplugService,
  SparkplugServiceShape
>() {}
```

#### 6. index.ts — Barrel Exports

```typescript
// Services
export { MqttTransport, MqttTransportLive, type MqttTransportShape } from './MqttTransport'
export { SparkplugService, type SparkplugServiceShape, type SparkplugMessage } from './SparkplugService'

// Protocol
export { buildTopic, parseTopic, SeqCounter, BdSeqCounter, makeDeathPayload, makeWillMessage, addSeqNumber, addBdSeqMetric } from './SparkplugProtocol'

// Codec
export { encodePayload, decodePayload, decodeMetricValue, extractQuality } from './SparkplugCodec'
export type { UPayload, UMetric, TypeStr } from './SparkplugCodec'

// Config
export { MqttConfig, SparkplugConfig, SparkplugClientConfig } from './config'

// Errors
export { SparkplugError } from './errors'
```

### How This Replaces sparkplug-client in the Plan

| Before (sparkplug-client) | After (@selfcharters/sparkplug-client) |
|---------------------------|----------------------------------------|
| `sparkplug-client` npm dependency | `@selfcharters/sparkplug-client` workspace dependency |
| EventEmitter bridge to Stream.async | MqttTransport.messages is already a Stream |
| `newClient(config)` → SparkplugClient | `MqttTransportLive(config)` → Layer |
| `client.on('message', ...)` | `transport.messages.pipe(Stream.map(...))` |
| `client.publishDeviceData(id, payload)` | `service.publishDeviceData(id, payload)` |
| `clean: true` hardcoded | `config.mqtt.clean` — configurable |
| `retain: false` hardcoded | `config.sparkplug.birthPublishOptions.retain` — configurable |
| `qos: 0` hardcoded | `config.sparkplug.subscribeQos` — configurable |
| Will hardcoded | `config.mqtt.will` — fully configurable, auto-constructed if omitted |
| Single groupId | `config.sparkplug.groupIds` — multi-group |
| 450 lines JS (70 logic + 380 boilerplate) | ~150 lines Effect-native TypeScript |

### Impact on Implementation Phases

- **Phase 1 (Foundation)**: Now includes creating `packages/sparkplug-client/` with config schemas, SparkplugProtocol, SparkplugCodec
- **Phase 2 (SparkplugAdapter)**: Uses `MqttTransportLive` + `SparkplugService` instead of `sparkplug-client`
- **Phase 3 (SparkplugPublisher)**: Uses `SparkplugService.publishDeviceData()` instead of `sparkplug-client` methods
- **Phase 5 (Infrastructure)**: `bun add @selfcharters/sparkplug-client` in tmnl, no npm install needed
- **Phase 7 (Stubs)**: No change

### Empirical Testing Enabled

With configurable MQTT options, we can now build test matrices:

```typescript
// Test: Does EMQX handle retained NBIRTH?
const configRetained = {
  mqtt: { serverUrl: 'mqtt://emqx:1883', ... },
  sparkplug: { birthPublishOptions: { retain: true, qos: 1 }, ... },
}

// Test: Does NATS MQTT bridge handle Will with QoS 1?
const configNatsWill = {
  mqtt: { serverUrl: 'mqtt://nats:1883', will: { ..., qos: 1, retain: true } },
  sparkplug: { ... },
}

// Test: Persistent sessions on EMQX
const configPersistent = {
  mqtt: { serverUrl: 'mqtt://emqx:1883', clean: false, clientId: 'persistent-01' },
  sparkplug: { ... },
}
```

This makes the EMQX-vs-NATS broker decision empirically verifiable rather than theoretical.
