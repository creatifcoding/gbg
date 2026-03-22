# Sparkplug B Protocol Reference

> Consolidated from `thoughts/shared/indexes/sparkplug-resources.md`
> Original date: 2026-02-08

## Overview

Sparkplug B is the Eclipse Foundation's MQTT-based IIoT protocol that standardizes topic namespaces, protobuf-encoded payloads, and a birth/death lifecycle for edge devices. We act as a **Sparkplug Application** (subscriber/consumer) -- we do not publish BIRTH/DATA. Our adapter decodes incoming DDATA into `IngestedReading` and feeds the downstream pipeline.

## Topic Namespace

```
spBv1.0 / {group_id} / {message_type} / {edge_node_id} [ / {device_id} ]
```

| Message Type | QoS | Retain | Direction | Purpose |
|-------------|-----|--------|-----------|---------|
| `NBIRTH` | 0 (MUST) | false (MUST) | Edge->Broker | Node birth certificate |
| `DBIRTH` | 0 (MUST) | false (MUST) | Edge->Broker | Device birth certificate |
| `NDATA` | 0 | false | Edge->Broker | Node-level data |
| `DDATA` | 0 | false | Edge->Broker | Device data (primary stream) |
| `NDEATH` (Will) | **1 (MUST)** | false (MUST) | Edge->Broker | MQTT Will for delivery guarantee |
| `DDEATH` | 0 | false | Edge->Broker | Device death |
| `NCMD` | Sub QoS 1 (MUST) | N/A | App->Edge | Command to node |
| `DCMD` | Sub QoS 1 (MUST) | N/A | App->Edge | Command to device |
| `STATE` | 1 | **true (MUST)** | App->Broker | SCADA host awareness (ONLY retained message) |

## Protobuf Payload (UPayload)

```typescript
interface UPayload {
  timestamp?: number | Long    // Epoch ms
  seq?: number | Long          // Sequence number (0-255, wraps)
  metrics?: UMetric[]          // Array of metric values
}

interface UMetric {
  name?: string                // Metric name (e.g., "Temperature")
  alias?: number | Long        // Numeric alias (after BIRTH establishes mapping)
  timestamp?: number | Long    // Per-metric timestamp
  dataType?: number            // DataType enum
  value: number | Long | boolean | string | Uint8Array | null
  type: TypeStr                // "Int32" | "Double" | "Boolean" | "String" | ...
  properties?: Record<string, UPropertyValue>  // Quality, engineering units
}
```

## Quality Encoding

Sparkplug B metric quality is an integer bitmask in `metric.properties.Quality`:

| Range | Meaning | OpcUaQuality Mapping |
|-------|---------|---------------------|
| >= 192 | Good | `'good'` |
| >= 64 | Uncertain | `'uncertain'` |
| < 64 | Bad | `'bad'` |

Implemented at `src/lib/iiot/adapters/quality-mapping.ts:83-89`.

## Alias Registry

BIRTH messages establish `name -> alias` mapping per edge node:

```
DBIRTH: metrics: [{ name: "Temperature", alias: 1 }, { name: "Pressure", alias: 2 }]
DDATA:  metrics: [{ alias: 1, value: 72.5 }, { alias: 2, value: 3.14 }]
```

Registry structure: `HashMap<edgeNodeId, HashMap<alias, metricName>>`

- **NBIRTH**: Clear all aliases for edge node, rebuild
- **DBIRTH**: Add device-scoped aliases
- **NDEATH**: Clear entire alias map for edge node
- **DDATA**: Lookup `metric.alias` -> metric name if `metric.name` absent

## Sequence Numbers

- NBIRTH resets sequence to 0
- Each subsequent message increments (0-255, wraps)
- `bdSeq` (birth-death sequence) in NBIRTH/NDEATH for session tracking

## Key Source Files

| File | Purpose |
|------|---------|
| `packages/sparkplug-client/src/MqttTransport.ts` | Effect-native MQTT connection lifecycle |
| `packages/sparkplug-client/src/SparkplugProtocol.ts` | Topic builder, seq counters, Will construction |
| `packages/sparkplug-client/src/SparkplugCodec.ts` | Protobuf encode/decode wrapper |
| `src/lib/iiot/adapters/sparkplug-adapter.ts` | SparkplugAdapter implementing IngestionAdapter |
| `src/lib/iiot/adapters/sparkplug-publisher.ts` | Test publisher (Edge Node simulator) |
| `src/lib/iiot/adapters/quality-mapping.ts` | `mapSparkplugQuality()` |

## Client Fork Lineage (@selfcharters)

| Layer | Package | Changes |
|-------|---------|---------|
| **Eclipse Tahu** | `sparkplug-client@3.2.4` | Original: mqtt.js v2, EventEmitter, hardcoded `clean:true`, `will.qos:0` (SPEC VIOLATION) |
| **Nortech** | `@nortech/sparkplug-client@3.5.2` | Upgraded mqtt.js v4->v5, exposed decode/decompress as public |
| **@selfcharters** | `@selfcharters/sparkplug-client@0.1.0` | Unlock mqttOptions, fix Will QoS 0->1, configurable per-publish, Effect Service wrappers |

**Fork rationale**: Eclipse is dead (mqtt.js v2). Nortech upgraded transport but kept hardcoded locks. Four changes: (a) remove `Omit<>` restriction, (b) fix Will QoS to 1, (c) configurable retain/QoS per-publish, (d) Effect-native wrappers.

See [ADR-003: Sparkplug Client Fork](../decisions/adr-003-sparkplug-client-fork.md).

## SparkplugConfig Schema

```
SparkplugConfig (Effect Schema TaggedStruct)
  serverUrl: string         -- MQTT broker URL
  groupId: string           -- Sparkplug B group
  edgeNodeId: string        -- Edge node identifier
  clientId?: string         -- MQTT client ID (auto-generated if omitted)
  mqtt.cleanSession: true   -- spec-mandated
  mqtt.keepalive: 65        -- Sparkplug B typical
  will.qos: 1              -- spec-compliant (Eclipse/Nortech had 0)
  will.retain: false        -- spec-compliant
  publish.qos: 0           -- BIRTH/DATA messages
  publish.retain: false     -- spec-compliant
  state.enabled: false      -- opt-in Primary Host Application role
  state.qos: 1             -- spec-compliant STATE
  state.retain: true        -- spec-mandated (ONLY message type with retain)
```

## Integration Pipeline

```
Edge Devices --MQTT--> Broker --> SparkplugAdapter --> Pipeline
                                       |
                                 +-----+-----+
                                 |           |
                           AliasRegistry  MetricDecoder
                                 |           |
                                 +-----+-----+
                                       |
                              Stream<IngestedReading>
                                       |
                                TopicRouter -> DeviceId
                                       |
                              ReadingProcessor (batch)
                                       |
                              AlarmDetector (threshold)
```

- **SparkplugAdapter**: Subscribes via MqttTransport, decodes protobuf, emits IngestedReading
- **TopicRouter**: Routes topics to DeviceId (`{edge}:{device}`)
- **Dynamic route registration**: DBIRTH triggers auto-registration per device

## npm Dependencies

| Package | Version | Role |
|---------|---------|------|
| `mqtt` | ^5.15.0 | MQTT 5.0 client (TypeScript-native since v5) |
| `sparkplug-payload` | ^1.0.3 | Standalone protobuf codec (no MQTT coupling) |
| `effect` | (existing) | Services, Layers, Streams, Schema |

## External Links

| Resource | Description |
|----------|-------------|
| [Sparkplug 3.0.0 Spec](https://www.eclipse.org/tahu/spec/sparkplug_spec.pdf) | Full specification |
| [Sparkplug 2.2 Spec](https://sparkplug.eclipse.org/specification/version/2.2/documents/sparkplug-specification-2.2.pdf) | Legacy specification |
| [Eclipse Tahu GitHub](https://github.com/eclipse-tahu/tahu) | Reference implementation |
| [Sparkplug Spec Repo](https://github.com/eclipse-sparkplug/sparkplug) | Specification source |
| [sparkplug-payload npm](https://www.npmjs.com/package/sparkplug-payload) | Protobuf codec |
| [mqtt.js GitHub](https://github.com/mqttjs/MQTT.js) | MQTT 5.0 client |
| [@nortech/sparkplug-client npm](https://www.npmjs.com/package/@nortech/sparkplug-client) | Fork base |
| [NATS MQTT Bridge Docs](https://docs.nats.io/running-a-nats-service/configuration/mqtt) | NATS-side MQTT |

## Related Documents

- [ADR-001: NATS-Only Broker](../decisions/adr-001-nats-only-broker.md) -- Why NATS won over EMQX
- [ADR-003: Sparkplug Client Fork](../decisions/adr-003-sparkplug-client-fork.md) -- Fork rationale
- [NATS MQTT Bridge](nats-mqtt-bridge.md) -- Feature support, topic translation
- [NATS Infrastructure](nats-infrastructure.md) -- JetStream KV for STATE, BIRTH certificates
- [EMQX (Banked)](emqx-banked.md) -- Configuration reference, activation triggers
- [Stream Processing](../architecture/stream-processing.md) -- Ingestion pipeline architecture
