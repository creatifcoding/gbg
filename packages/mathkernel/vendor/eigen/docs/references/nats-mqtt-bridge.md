# NATS MQTT Bridge Reference

> Consolidated from `thoughts/shared/indexes/nats-resources.md`
> Original date: 2026-02-08

## Overview

NATS Server includes a built-in MQTT bridge that translates MQTT 3.1.1 protocol to NATS subjects. This is the chosen broker strategy for Sparkplug B device communication (see [ADR-001](../decisions/adr-001-nats-only-broker.md)).

## Feature Support

| Feature | Supported | Notes |
|---------|-----------|-------|
| MQTT 3.1.1 | YES | Full protocol |
| QoS 0 / QoS 1 | YES | QoS 1 via JetStream |
| Will messages (LWT) | YES (2.9+) | Fires on TCP disconnect |
| Binary payloads | YES | Opaque bytes -- protobuf works |
| Topic wildcards | YES | `+` -> `*`, `#` -> `>` |
| Retained messages | **NO** | Use JetStream KV instead |
| MQTT 5.0 | **NO** | Not needed for Sparkplug B (3.1.1-based) |
| QoS 2 | **NO** | Downgraded to QoS 1 |
| Session persistence | **NO** | sparkplug-client hardcodes `clean: true` |

## Configuration

### nats-server.conf

```conf
mqtt {
  port: 1883
  no_auth_user: mqtt_dev
  ack_wait: "30s"
  max_ack_pending: 1024
}
```

### Docker Compose

Add `- '1883:1883'` to NATS ports. That's it.

## JetStream KV Workarounds

### BIRTH Certificate Registry

```typescript
const kv = await js.views.kv('SPARKPLUG_BIRTHS', { history: 5, ttl: 86_400_000 })

// Store BIRTH
await kv.put(`${groupId}.${edgeNode}.${deviceId}`, birthPayload)

// Replay on startup
for await (const key of await kv.keys()) {
  const entry = await kv.get(key)
  if (entry) processBirthCert(entry.value)
}

// Watch live updates
const watch = await kv.watch()
for await (const entry of watch) processBirthCert(entry.value)
```

### STATE Message Registry

```typescript
const stateKV = await js.views.kv('SPARKPLUG_STATE')
await stateKV.put('scada-primary', 'ONLINE')
```

JetStream KV provides superior semantics over MQTT retained messages: history tracking, TTL, `watch()` for reactive updates, and explicit enumeration via `keys()`.

## Topic Translation

| MQTT | NATS |
|------|------|
| `spBv1.0/plant-a/DDATA/edge-01/sensor-01` | `spBv1.0.plant-a.DDATA.edge-01.sensor-01` |
| `+` (single-level wildcard) | `*` |
| `#` (multi-level wildcard) | `>` |
| `/` (separator) | `.` (separator) |

Note: Dots (`.`) in edge_node_ids create extra NATS subject levels. Use `>` wildcards or normalize IDs to `-`.

## Monitoring

- NATS HTTP monitoring: `:8222` (`/connz`, `/subsz`, `/jsz`)
- NATS CLI: `nats` command
- Prometheus: `/metrics` endpoint
- SparkplugAdapter tracks its own connection health via `Effect.Ref<IngestionHealth>`

## External Links

| Resource | Description |
|----------|-------------|
| [NATS MQTT Bridge Docs](https://docs.nats.io/running-a-nats-service/configuration/mqtt) | Configuration reference |
| [JetStream KV Docs](https://docs.nats.io/nats-concepts/jetstream/key-value-store) | Key-value store |
| [NATS Docker Images](https://hub.docker.com/_/nats) | `nats:2.10-alpine` |
