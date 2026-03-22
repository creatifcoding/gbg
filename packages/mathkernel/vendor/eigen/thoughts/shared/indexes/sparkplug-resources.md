# Sparkplug B — Quick Reference Resource Index

> **Role**: arch-sparkplug SME reference card for implementers.
> **Created**: 2026-02-08
> **Scope**: Sparkplug B protocol, @selfcharters/sparkplug-client fork, SparkplugAdapter integration.

---

## Summary

Sparkplug B is the Eclipse Foundation's MQTT-based IIoT protocol that standardizes topic namespaces (`spBv1.0/{group}/{verb}/{edge}/{device}`), protobuf-encoded payloads, and a birth/death lifecycle for edge devices. We subscribe to Sparkplug B messages as a **Sparkplug Application** (consumer) — we do not publish BIRTH/DATA ourselves. Our adapter decodes incoming DDATA into `IngestedReading` and feeds the downstream pipeline (TopicRouter, ReadingProcessor, AlarmDetector). The MQTT client library decision: fork `@nortech/sparkplug-client@3.5.2` as `@selfcharters/sparkplug-client` to unlock hardcoded MQTT settings, fix a Will QoS spec violation, and add Effect-native wrappers.

---

## Fork Lineage

| Layer | Package | What It Adds |
|-------|---------|-------------|
| **1. Eclipse Tahu** | `sparkplug-client@3.2.4` | Original: mqtt.js v2, EventEmitter, hardcoded `clean:true`, `will.qos:0` (SPEC VIOLATION), `retain:false`, Omit<> on mqttOptions |
| **2. Nortech** | `@nortech/sparkplug-client@3.5.2` | Upgraded mqtt.js v4→v5, exposed `decodePayload`/`decompressPayload` as public, added `cb` callback params. Same hardcoded locks. |
| **3. @selfcharters** | `@selfcharters/sparkplug-client@0.1.0` | Unlock Omit<>, fix Will QoS 0→1, configurable retain/will/QoS per-publish, Effect Schema config, `MqttTransport` (acquireRelease), `Stream.async` bridge, `SeqCounter`/`BdSeqCounter` as `Effect.Ref` |

**Rationale**: Eclipse is dead (mqtt.js v2, last Sep 2023). Nortech is best starting point (mqtt.js v5, May 2025) but keeps the same locks. Nobody in the JS ecosystem has needed configurable retain/will/QoS because the spec mandates the values — but we need them for empirical broker testing (NATS vs EMQX).

---

## Spec Requirements Table

**Source**: Sparkplug Specification v3.0.0 (Eclipse Foundation, Nov 2022)

| Message Type | QoS | Retain | Normative Language | Direction |
|-------------|-----|--------|-------------------|-----------|
| **NBIRTH** | **0** (MUST) | **false** (MUST) | Edge Node birth certificate | Edge→Broker |
| **DBIRTH** | **0** (MUST) | **false** (MUST) | Device birth certificate | Edge→Broker |
| **NDATA** | 0 (implied) | false (implied) | Edge Node data | Edge→Broker |
| **DDATA** | 0 (implied) | false (implied) | Device data (primary stream) | Edge→Broker |
| **NDEATH** (Will) | **1** (MUST) | **false** (MUST) | MQTT Will message for delivery guarantee | Edge→Broker |
| **DDEATH** | 0 (not explicit) | false (not explicit) | Device death | Edge→Broker |
| **NCMD** | Sub QoS **1** (MUST) | N/A | Command to Edge Node | App→Edge |
| **DCMD** | Sub QoS **1** (MUST) | N/A | Command to Device | App→Edge |
| **STATE** | **1** (implied) | **true** (MUST) | SCADA host awareness — ONLY message with retain | App→Broker |

**Clean Session**: ALL Sparkplug clients MUST set `Clean Session = true` (MQTT 3.1.1) or `Clean Start = true` + `Session Expiry Interval = 0` (MQTT 5.0).

**Key normative statement**: "All non-STATE messages MUST be published on QoS 0 with retain = false. STATE messages MUST be published on QoS 1 with retain = true."

**Will QoS spec violation**: Both Eclipse (`sparkplug-client@3.2.4`) and Nortech (`@nortech/sparkplug-client@3.5.2`) hardcode Will QoS to 0. The spec says MUST be 1. Our fork fixes this.

---

## SparkplugConfig Schema

```
SparkplugConfig (Effect Schema TaggedStruct)
├── serverUrl: string              — MQTT broker URL (e.g., 'mqtt://localhost:1883')
├── groupId: string                — Sparkplug B group
├── edgeNodeId: string             — Edge node identifier
├── clientId?: string              — MQTT client ID (auto-generated if omitted)
├── mqtt:
│   ├── cleanSession: true         — DEFAULT (spec-mandated)
│   └── keepalive: 65              — DEFAULT (Sparkplug B typical)
├── will:
│   ├── qos: 1                     — DEFAULT (spec-compliant NDEATH; Eclipse/Nortech had 0)
│   └── retain: false              — DEFAULT (spec-compliant)
├── publish:
│   ├── qos: 0                     — DEFAULT for BIRTH/DATA messages
│   └── retain: false              — DEFAULT (spec-compliant)
└── state:
    ├── enabled: false             — DEFAULT (opt-in for Primary Host Application role)
    ├── qos: 1                     — DEFAULT (spec-compliant STATE)
    └── retain: true               — DEFAULT (spec-mandated — ONLY message type with retain)
```

All fields are optional with spec-compliant defaults. Override any knob individually for empirical broker testing.

---

## Key Source Files

| File | Path (from `packages/tmnl/`) | Purpose |
|------|-----|---------|
| IngestionAdapter | `src/lib/iiot/adapters/ingestion.ts` | Service interface: `subscribe → Stream<IngestedReading>`, `healthCheck` |
| Quality Mapping | `src/lib/iiot/adapters/quality-mapping.ts` | `mapSparkplugQuality()` at line 83 — integer bitmask → OpcUaQuality |
| TopicRouter | `src/lib/iiot/adapters/device-routing.ts` | Glob/exact topic→DeviceId routing |
| Adapters index | `src/lib/iiot/adapters/index.ts` | Barrel exports |
| Sparkplug plan | `thoughts/shared/plans/sparkplug-b-plan.md` | Full plan (1540 lines) + Appendix A (Nortech) + Appendix B (fork) |
| Research index | `thoughts/shared/plans/sparkplug-b-reference-index.md` | Consolidated research findings |
| NATS proposal | `thoughts/shared/plans/nats-only-sparkplug-proposal.md` | NATS-only Sparkplug analysis |
| WBS tracker | `.claude/plans/enumerated-crafting-otter.md` | Epic 27 tasks |

### Planned files (Epic 27)

| File | Location | Purpose |
|------|----------|---------|
| `@selfcharters/sparkplug-client` | `packages/sparkplug-client/` | NX library — Effect-native protocol layer |
| `MqttTransport.ts` | `packages/sparkplug-client/src/` | Effect Service for MQTT connection lifecycle |
| `SparkplugProtocol.ts` | `packages/sparkplug-client/src/` | Topic builder, seq counters, Will construction |
| `SparkplugCodec.ts` | `packages/sparkplug-client/src/` | Protobuf encode/decode wrapper |
| `config.ts` | `packages/sparkplug-client/src/` | Effect Schema config types |
| `SparkplugService.ts` | `packages/sparkplug-client/src/` | High-level composed Service |
| `sparkplug-adapter.ts` | `src/lib/iiot/adapters/` | SparkplugAdapter implementing IngestionAdapter |
| `sparkplug-publisher.ts` | `src/lib/iiot/adapters/` | Test publisher (Edge Node simulator) |

---

## npm Dependencies

| Package | Version | Role |
|---------|---------|------|
| `mqtt` | ^5.15.0 | MQTT 5.0 client — TypeScript-native since v5.0.0, per-publish QoS/retain control |
| `sparkplug-payload` | ^1.0.3 | Standalone protobuf codec for Sparkplug B payloads (no MQTT coupling) |
| `effect` | (existing) | Services, Layers, Streams, Schema, Ref |

**Not used**: `sparkplug-client@3.2.4` (dead), `@nortech/sparkplug-client@3.5.2` (base for fork, not a runtime dep).

---

## Topic Namespace

```
spBv1.0 / {group_id} / {message_type} / {edge_node_id} [ / {device_id} ]
```

**Examples**:
- `spBv1.0/plant-a/NBIRTH/edge-01` — Node birth (no device)
- `spBv1.0/plant-a/DBIRTH/edge-01/sensor-array-01` — Device birth
- `spBv1.0/plant-a/DDATA/edge-01/sensor-array-01` — Device data
- `spBv1.0/plant-a/NDEATH/edge-01` — Node death (MQTT Will)
- `STATE/scada-host-01` — SCADA host state (different namespace)

**Adapter subscription patterns** (per group):
- `spBv1.0/{groupId}/DDATA/+/+` — All device data
- `spBv1.0/{groupId}/DBIRTH/+/+` — Device births (alias registry)
- `spBv1.0/{groupId}/DDEATH/+/+` — Device deaths
- `spBv1.0/{groupId}/NBIRTH/+` — Node births
- `spBv1.0/{groupId}/NDEATH/+` — Node deaths
- `STATE/+` — SCADA host state

---

## Alias Registry

BIRTH messages (NBIRTH/DBIRTH) establish a `name → alias` mapping per edge node:

```
DBIRTH payload:
  metrics: [
    { name: "Temperature", alias: 1, type: "Double", value: 0 },
    { name: "Pressure",    alias: 2, type: "Double", value: 0 },
  ]

Subsequent DDATA:
  metrics: [
    { alias: 1, value: 72.5 },   ← "Temperature"
    { alias: 2, value: 3.14 },   ← "Pressure"
  ]
```

**Registry structure**: `HashMap<string, HashMap<number, string>>` — key is `edgeNodeId`, inner key is alias number, value is metric name.

- **NBIRTH**: Clear all aliases for edge node, rebuild from birth metrics
- **DBIRTH**: Add device-scoped aliases to edge node's map
- **NDEATH**: Clear entire alias map for that edge node
- **DDATA**: Lookup `metric.alias` → metric name if `metric.name` is absent

---

## Integration Points

```
Edge Devices ──MQTT──▶ Broker ──▶ SparkplugAdapter ──▶ Pipeline
                                       │
                                ┌──────┴──────┐
                                │             │
                          AliasRegistry  MetricDecoder
                                │             │
                                └──────┬──────┘
                                       │
                                       ▼
                              Stream<IngestedReading>
                                       │
                                TopicRouter → DeviceId
                                       │
                              ReadingProcessor (batch)
                                       │
                              AlarmDetector (threshold)
```

1. **SparkplugAdapter** — Subscribes via `MqttTransport`, decodes protobuf, emits `IngestedReading`
2. **TopicRouter** — Routes `spBv1.0/{group}/DDATA/{edge}/{device}/{metric}` → DeviceId (`{edge}:{device}`)
3. **ReadingProcessor** — Batches readings for persistence
4. **AlarmDetector** — Checks threshold-based alarms
5. **Quality mapping** — `mapSparkplugQuality()` converts integer bitmask to `OpcUaQuality`
6. **Dynamic route registration** — DBIRTH triggers auto-registration of TopicRoute per device

---

## External Links

| Resource | URL |
|----------|-----|
| Sparkplug 3.0.0 Spec (PDF) | https://www.eclipse.org/tahu/spec/sparkplug_spec.pdf |
| Sparkplug 2.2 Spec (PDF) | https://sparkplug.eclipse.org/specification/version/2.2/documents/sparkplug-specification-2.2.pdf |
| Operational Behavior (AsciiDoc) | https://github.com/eclipse-sparkplug/sparkplug/blob/master/specification/src/main/asciidoc/chapters/Sparkplug_5_Operational_Behavior.adoc |
| Normative Statements | https://github.com/eclipse-sparkplug/sparkplug/blob/master/docs/normative_statements.md |
| Eclipse Tahu GitHub | https://github.com/eclipse-tahu/tahu |
| Sparkplug Spec Repo | https://github.com/eclipse-sparkplug/sparkplug |
| mqtt.js GitHub | https://github.com/mqttjs/MQTT.js |
| mqtt.js npm | https://www.npmjs.com/package/mqtt |
| @nortech/sparkplug-client npm | https://www.npmjs.com/package/@nortech/sparkplug-client |
| sparkplug-payload npm | https://www.npmjs.com/package/sparkplug-payload |
| QoS 0 and Data Loss (Cirrus Link) | https://docs.chariot.io/display/CLD80/Sparkplug%2C+QoS+0+and+Potential+Data+Loss |
| Will QoS GitHub Issue #107 | https://github.com/eclipse-sparkplug/sparkplug/issues/107 |
| NATS MQTT Bridge Docs | https://docs.nats.io/running-a-nats-service/configuration/mqtt |

---

## FAQ

### 1. Why fork @nortech instead of using sparkplug-client directly?

Eclipse's `sparkplug-client@3.2.4` is dead — mqtt.js v2, no TypeScript, Will QoS spec violation, hardcoded config. Nortech upgraded to mqtt.js v5 (the only meaningful change needed at the transport layer) but kept the same hardcoded locks. Forking Nortech gives us mqtt.js v5 for free and a clean base to unlock configurable MQTT options.

### 2. Why not just use raw mqtt.js + sparkplug-payload?

That works and is the fallback. But Nortech's fork already handles ~70 lines of protocol logic (bdSeq/seq counters, Will payload construction, topic building, compression, auto-subscribe NCMD/DCMD, message routing). Rather than rewriting those, we fork and wrap in Effect.

### 3. What does the fork actually change on top of Nortech?

Four changes: (a) Remove the `Omit<>` TypeScript restriction on mqttOptions, (b) Fix Will QoS from 0 to 1 (spec-compliant), (c) Make per-publish retain/QoS configurable, (d) Add Effect-native wrappers (Service, Layer, Stream bridge, Schema config).

### 4. Are we an Edge Node or an Application?

We are a **Sparkplug Application** (subscriber/consumer). We receive NBIRTH/DBIRTH/DDATA/DDEATH from edge nodes. We do NOT publish BIRTH/DATA ourselves. We MAY publish NCMD/DCMD commands and STATE messages.

### 5. Why is Will QoS 1 important?

NDEATH (the Will message) fires when an edge node disconnects ungracefully. QoS 0 means "fire and forget" — if the broker is momentarily busy, the death notification is lost. QoS 1 guarantees at-least-once delivery, so the application always learns about node deaths. The spec mandates QoS 1; both Eclipse and Nortech violate this.

### 6. What's the deal with STATE messages?

STATE is the only message type requiring `retain: true`. It's used by SCADA Primary Host Applications to announce `{"online": true/false, "timestamp": <ms>}`. Topic: `STATE/{hostId}`. Our adapter subscribes to `STATE/+` for SCADA HA awareness. If using NATS (no retained messages), STATE is handled via JetStream KV instead.

### 7. Does the adapter filter metrics?

No. All metrics from DDATA flow through the adapter unfiltered. Filtering is the TopicRouter's concern — glob patterns control which metrics reach the pipeline.

### 8. How does multi-group work?

The adapter creates one `MqttTransport` per `groupId` and merges their output streams via `Stream.mergeAll`. This isolates per-group lifecycle (one group's NDEATH doesn't affect others) and allows independent reconnection. Alias registries are per-edge-node, so no conflict across groups.

### 9. NATS or EMQX for the broker?

Current plan: NATS MQTT bridge for development. EMQX is banked (Epic 26) and activatable if: (a) NATS spike (F27.4) reveals blocking limitations, (b) third-party edge nodes require full MQTT 5.0, or (c) retained STATE messages need broker-level serving. Epic 27 tasks F27.4.1-F27.4.4 are empirical spike tests to validate NATS viability.

### 10. What does `decodeMetricValue` handle?

Extracts numeric values from Sparkplug B UMetric: `Double/Float/Int8-32/UInt8-32 → number`, `Int64/UInt64 → Long.toNumber()` (warns on precision loss), `Boolean → 0/1`, everything else → `null` (skipped).

### 11. What is the sequence counter (seq) for?

Each Sparkplug message carries a `seq` field (0-255, wraps). NBIRTH resets to 0. Consumers use seq to detect out-of-order or dropped messages. The `bdSeq` (birth-death sequence) in NBIRTH/NDEATH links births to deaths for session tracking.

### 12. How does dynamic route registration work?

When DBIRTH arrives for `edgeNode/deviceId`, the adapter auto-registers a TopicRoute: `spBv1.0/{groupId}/DDATA/{edgeNodeId}/{deviceId}/* → deviceId: {edgeNodeId}:{deviceId}`. This makes DDATA readings routable without pre-configuring every device.

---

*arch-sparkplug SME — standing by for implementer queries.*
