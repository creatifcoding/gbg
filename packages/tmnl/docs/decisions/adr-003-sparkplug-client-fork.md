# ADR-003: Custom Sparkplug Client Fork

> Consolidated from `thoughts/shared/indexes/sparkplug-resources.md` and `thoughts/shared/plans/sparkplug-b-plan.md` Appendices A+B
> Decision date: 2026-02-08 | Status: ACCEPTED

## Context

The Sparkplug B protocol requires an MQTT client that handles the birth/death lifecycle, protobuf payloads, sequence counters, and Will messages. Three options were evaluated:

| Option | Package | Status |
|--------|---------|--------|
| Eclipse Tahu | `sparkplug-client@3.2.4` | Dead (mqtt.js v2, Sep 2023) |
| Nortech fork | `@nortech/sparkplug-client@3.5.2` | Active (mqtt.js v5, May 2025) |
| Custom fork | `@selfcharters/sparkplug-client@0.1.0` | New (Effect-native) |

## Decision

**Create `@selfcharters/sparkplug-client`** as a new NX library package at `packages/sparkplug-client/`. Built on top of `mqtt@5` + `sparkplug-payload`, replacing both Eclipse and Nortech clients.

## Fork Lineage

| Layer | Package | What It Adds |
|-------|---------|-------------|
| 1. Eclipse Tahu | `sparkplug-client@3.2.4` | Original: mqtt.js v2, EventEmitter, hardcoded `clean:true`, `will.qos:0` (SPEC VIOLATION), `retain:false` |
| 2. Nortech | `@nortech/sparkplug-client@3.5.2` | Upgraded mqtt.js v4->v5, exposed `decodePayload`/`decompressPayload`, added callback params. Same hardcoded locks. |
| 3. @selfcharters | `@selfcharters/sparkplug-client@0.1.0` | Unlock `Omit<>`, fix Will QoS 0->1 (spec-compliant), configurable retain/will/QoS per-publish, Effect Schema config, `MqttTransport` (acquireRelease), `Stream.asyncPush` bridge |

## Problems with Existing Clients

Both Eclipse and Nortech hardcode critical MQTT parameters with no override path:

```javascript
// Constructor (identical in both):
_this.mqttOptions = {
  ...(config.mqttOptions || {}),  // user overrides spread FIRST
  clientId: clientId,              // OVERWRITTEN
  clean: true,                     // HARDCODED
  will: {
    topic: `spBv1.0/${groupId}/NDEATH/${edgeNode}`,
    payload: Buffer.from(encodedDeathPayload),
    qos: 0,                        // HARDCODED — SPEC VIOLATION (should be 1)
    retain: false,                  // HARDCODED
  }
};
```

TypeScript enforces this: `mqttOptions?: Omit<IClientOptions, 'clientId' | 'clean' | 'keepalive' | ... | 'will'>`.

### Spec Violation

The Sparkplug 3.0.0 specification mandates Will QoS = 1 for NDEATH delivery guarantee. Both Eclipse and Nortech set QoS = 0. This means an NDEATH notification can be silently lost if the broker is momentarily busy.

## Our Fork Architecture

```
packages/sparkplug-client/src/
  config.ts              — Effect Schema config (every MQTT option configurable)
  MqttTransport.ts       — Effect Service for MQTT lifecycle (acquireRelease)
  SparkplugProtocol.ts   — Topic builder, seq counters, Will construction
  SparkplugCodec.ts      — Protobuf encode/decode wrapper
  SparkplugService.ts    — High-level composed Service
  errors.ts              — SparkplugError TaggedError
  index.ts               — Barrel exports
```

### Key Differences

| Before (sparkplug-client) | After (@selfcharters) |
|---------------------------|----------------------|
| EventEmitter bridge to Stream.async | `MqttTransport.messages` is already a Stream |
| `newClient(config)` -> SparkplugClient | `MqttTransportLive(config)` -> Layer |
| `clean: true` hardcoded | `config.mqtt.clean` configurable |
| `retain: false` hardcoded | `config.sparkplug.birthPublishOptions.retain` configurable |
| `qos: 0` hardcoded | `config.sparkplug.subscribeQos` configurable |
| Will QoS 0 (spec violation) | Will QoS 1 (spec-compliant default) |
| Single groupId | `config.sparkplug.groupIds` multi-group |
| 450 lines JS | ~150 lines Effect-native TypeScript |

## Consequences

- Full control over MQTT parameters enables empirical broker testing (NATS vs EMQX)
- Effect-native: `MqttTransport` uses `acquireRelease`, messages are `Stream<T>`
- Spec-compliant Will QoS = 1 by default
- Multi-group support without N separate client instances
- Dependencies: `mqtt@^5.15.0` + `sparkplug-payload@^1.0.3` + `effect`
