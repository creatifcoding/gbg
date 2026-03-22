---
title: "NATS Infrastructure Reference"
date: 2026-02-09
status: Active
source: thoughts/shared/plans/emqx-broker-infrastructure-plan.md, thoughts/shared/plans/broker-infra-decomposition.md, thoughts/shared/plans/nats-decision-gate-result.md
---

# NATS Infrastructure Reference

## Architecture Overview

NATS serves as the single broker for both internal events and external MQTT. See [ADR-001: NATS-Only Broker Strategy](../decisions/adr-001-nats-only-broker.md) for the decision rationale.

```
Industrial Devices / Edge Nodes
    |
    +-- Sparkplug B Edge Nodes (DDATA/DBIRTH/DDEATH)
    +-- Raw MQTT Sensors (JSON payloads)
    |
    v
NATS Server 2.10 (port 4222)
    +-- MQTT Bridge (port 1883)    <-- Sparkplug B ingestion
    +-- JetStream                  <-- Persistent streams, KV
    +-- PubSub                     <-- Internal event distribution
    +-- Monitoring (port 8222)     <-- HTTP monitoring
```

## NATS Services

### Core NATS (port 4222)

Standard NATS publish/subscribe for internal communication:

| Subject Pattern | Purpose |
|-----------------|---------|
| `iiot.readings.*` | Sensor reading distribution |
| `iiot.alarms.*` | Alarm event distribution |
| `iiot.equipment.*` | Equipment state changes |
| `iiot.invalidations.*` | Cache invalidation signals |

### JetStream KV

Key-Value stores for persistent state:

| Bucket | Key Format | Purpose |
|--------|------------|---------|
| `SPARKPLUG_BIRTHS` | `{groupId}.{edgeNodeId}.{deviceId}` | Device BIRTH certificates |
| `SPARKPLUG_STATE` | `host.{hostId}` | SCADA host liveness (replaces MQTT retained) |
| `IIOT_STATE` | `{entityType}.{entityId}` | Entity state registry |

**Note:** NATS KV keys use dots (`.`) as separators, not colons (`:`). Colons are invalid because KV keys become NATS subjects internally (`$KV.bucket.key`).

### MQTT Bridge (port 1883)

NATS-native MQTT 3.1.1 bridge for Sparkplug B device communication:

| Feature | Supported | Notes |
|---------|:---------:|-------|
| MQTT 3.1.1 | Yes | Full protocol |
| QoS 0 / QoS 1 | Yes | QoS 1 via JetStream |
| Will messages (LWT) | Yes (2.9+) | Fires on TCP disconnect |
| Binary payloads | Yes | Opaque bytes -- protobuf works |
| Topic wildcards | Yes | `+` and `#` supported |
| Retained messages | **No** | Use JetStream KV instead |
| MQTT 5.0 | **No** | Not needed -- Sparkplug B is 3.1.1 |

Topic translation: MQTT `+` maps to NATS `*`, MQTT `#` maps to NATS `>`.

### Monitoring (port 8222)

HTTP endpoints for health and metrics:

| Endpoint | Purpose |
|----------|---------|
| `/varz` | Server statistics |
| `/connz` | Active connections |
| `/routez` | Cluster routes |
| `/subsz` | Subscription details |
| `/jsz` | JetStream status |

## Docker Compose Configuration

```yaml
# docker/docker-compose.yml
services:
  nats:
    image: nats:2.10-alpine
    command: ["--config", "/etc/nats/nats-server.conf"]
    ports:
      - '4222:4222'   # NATS client
      - '8222:8222'   # Monitoring
      - '9222:9222'   # Cluster (future)
      - '1883:1883'   # MQTT bridge
    volumes:
      - ./nats/nats-server.conf:/etc/nats/nats-server.conf
      - nats-data:/data
```

### NATS Server Configuration

```
# docker/nats/nats-server.conf
server_name: tmnl-nats

jetstream {
  store_dir: /data
  max_mem: 256MB
  max_file: 1GB
}

mqtt {
  port: 1883
  no_auth_user: mqtt_dev
}
```

## Holonet Integration

The Holonet layer (Phase 5) bridges NATS into the application via Effect services:

| Component | Purpose |
|-----------|---------|
| `HolonetBridge` | NATS connection lifecycle (acquireRelease) |
| `IIoTSubjects` | Subject naming conventions for IIoT |
| `EventDistribution` | ChannelService-based fan-out to subscribers |
| `StateRegistryKV` | JetStream KV for entity state |

### PubSub Subjects (via IIoTSubjects)

```typescript
const subjects = {
  readings:      'iiot.readings',       // High-frequency sensor data
  alarms:        'iiot.alarms',         // Alarm lifecycle events
  equipment:     'iiot.equipment',      // Equipment state changes
  invalidations: 'iiot.invalidations',  // Cache invalidation
}
```

## EMQX Activation (Banked)

EMQX plans are preserved but deferred. Activation triggers:

1. Will message spike fails on NATS MQTT bridge
2. Customer deployment requires third-party MQTT 5.0 edge devices
3. Sparkplug B conformance certification required
4. Scale beyond 10K concurrent MQTT clients
5. Regulatory audit requires certified MQTT broker

See `thoughts/shared/plans/emqx-broker-infrastructure-plan.md` for the full EMQX plan.

## Related Documents

- [ADR-001: NATS-Only Broker Strategy](../decisions/adr-001-nats-only-broker.md)
- [Sparkplug B Protocol Reference](sparkplug-b.md)
- [EMQX Banked Plans](emqx-banked.md)
- Source: `thoughts/shared/plans/nats-decision-gate-result.md`
- Source: `thoughts/shared/plans/broker-infra-decomposition.md`
