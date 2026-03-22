# Stream Processing Architecture

> Consolidated from `thoughts/shared/plans/phase5-stream-architecture.md`
> Original date: 2026-02-07 | Status: Implemented (Epic 19)

## Overview

Epic 19 builds the real-time ingestion pipeline that brings industrial sensor data into the IIoT system. Data flows from protocol adapters (OPC-UA, Sparkplug B, Modbus/MQTT) through an Effect Stream pipeline that routes readings to DeviceId, batch-inserts into TimescaleDB, and triggers alarm detection against configured sensor thresholds.

## Pipeline Architecture

```
Protocol Adapters (external boundary)
    OpcUaAdapter | SparkplugAdapter | ModbusAdapter
        |
    IngestionAdapter (Effect.Service interface)
        subscribe(): Stream<IngestedReading>
        |
Stream Processing Pipeline
    1. TopicRouter        -- UNS topic -> DeviceId mapping
    2. QualityMapper      -- Protocol quality -> OpcUaQuality
    3. BatchProcessor     -- Stream.groupedWithin(100, 5s) -> insertBatch()
    4. AlarmDetector      -- Stream.scan (threshold comparison)
    5. EventPublisher     -- AlarmEntity.Trigger() + PubSub
        |
Storage Layer
    TimescaleDB (iiot.sensor_readings hypertable)
    EventLog (AlarmTriggered events)
```

## IngestionAdapter Interface

The adapter interface is protocol-agnostic. Each protocol adapter wraps its library's push/poll API into an Effect Stream:

```typescript
export interface IngestionAdapterShape {
  readonly protocol: string
  readonly subscribe: Effect.Effect<
    Stream.Stream<IngestedReading, IngestionError>,
    IngestionError
  >
  readonly healthCheck: Effect.Effect<IngestionHealth, IngestionError>
}

export class IngestionAdapter extends Context.Tag('tmnl/iiot/IngestionAdapter')<
  IngestionAdapter, IngestionAdapterShape
>() {}
```

## Pipeline Components

### TopicRouter
Maps protocol-specific topic strings to internal DeviceId:
- Sparkplug B: `spBv1.0/{group}/DDATA/{edge}/{device}` -> `DeviceId`
- OPC-UA: NodeId -> DeviceId via alias registry
- MQTT: Topic pattern matching

### QualityMapper
Normalizes protocol quality indicators to OPC-UA quality codes:
- Sparkplug B: Integer bitmask (>=192 Good, >=64 Uncertain, <64 Bad)
- OPC-UA: Native quality codes
- MQTT: Default to Good (no quality metadata)

### BatchProcessor
Efficient bulk inserts using Effect Stream windowing:
```typescript
Stream.groupedWithin(100, Duration.seconds(5))  // 100 readings or 5s window
  .pipe(Stream.mapEffect(batch => insertBatch(batch)))
```

### AlarmDetector
Stateful stream processing using `Stream.scan` for threshold comparison:
- Compares readings against sensor threshold configuration
- Triggers alarm creation when thresholds are breached
- Supports high, critical, low, and critical-low thresholds

### SparkplugPipelineLayer
Pre-composed layer at `src/lib/iiot/adapters/ingestion-service.ts`:
```typescript
export const SparkplugPipelineLayer = Layer.mergeAll(
  SparkplugAdapterLive,
  TopicRouterLive,
  ReadingProcessorLive,
  AlarmDetectorLive,
  IngestionServiceLive,
)
```

## EventDistribution (4 Channels)

Events from the pipeline fan out to subscribers via ChannelService:

| Channel | Content | maxLag | Consumers |
|---------|---------|--------|-----------|
| `iiot:readings` | SensorReading events | 10,000 | WebSocket subscribers, dashboards |
| `iiot:alarms` | AlarmEvent lifecycle | 1,000 | WebSocket, notification service |
| `iiot:equipment` | EquipmentStateChange | 1,000 | WebSocket, analytics |
| `iiot:invalidations` | CacheInvalidation | 1,000 | React query invalidation |

Each channel: `PubSub (inlet) -> ChannelService inlet -> broadcast outlet -> subscriber streams`

## Backpressure Strategy

- **PubSub maxLag**: Configurable per channel (readings higher for throughput, others lower)
- **Stream.groupedWithin**: Batching prevents DB write amplification
- **ChannelService broadcast**: Each subscriber gets independent outlet with its own backpressure
- **Slow subscribers**: Dropped via PubSub sliding window, not blocking the pipeline
