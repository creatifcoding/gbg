# EMQX Broker Reference (Banked)

> Consolidated from `thoughts/shared/indexes/emqx-resources.md`
> Original date: 2026-02-08 | Status: BANKED (Epic 26 + Epic 28)

## Overview

EMQX is a purpose-built MQTT 5.0 broker planned as the industrial device communication layer. **Currently banked** -- the NATS-only path was chosen (see [ADR-001](../decisions/adr-001-nats-only-broker.md)). EMQX is activatable if third-party MQTT devices require a standards-compliant MQTT 5.0 broker.

## When to Activate

Activate Epic 26 (EMQX) when ANY of these are true:

1. Third-party edge nodes require MQTT 5.0 (retained messages, session persistence, Will Delay Interval)
2. NATS MQTT bridge spike tests reveal blocking limitations
3. Retained message serving needed beyond JetStream KV workaround
4. Scale exceeds NATS MQTT bridge capacity (>10K concurrent MQTT clients)
5. MQTT 5.0 features needed: topic aliases, flow control, user properties

Do NOT activate if:
- All devices connect through our own SparkplugAdapter
- JetStream KV handles STATE message semantics adequately
- NATS MQTT bridge handles Will messages reliably

## Configuration Reference

### Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 1883 | MQTT TCP | Device connections |
| 8883 | MQTT TLS | Secure device connections |
| 8083 | WebSocket | Browser MQTT clients |
| 18083 | HTTP | Dashboard + REST API + Prometheus |

No conflicts with NATS (4222/8222/9222) or PostgreSQL (5432/5433).

### Docker Compose Service

```yaml
emqx:
  image: emqx/emqx:5.8
  container_name: tmnl_emqx
  ports: ['1883:1883', '8883:8883', '8083:8083', '18083:18083']
  volumes:
    - emqx-data:/opt/emqx/data
    - ./emqx/emqx.conf:/opt/emqx/etc/emqx.conf:ro
  environment:
    EMQX_ALLOW_ANONYMOUS: 'true'
  healthcheck:
    test: ['CMD', 'emqx', 'ctl', 'status']
    interval: 10s
    timeout: 5s
    retries: 5
```

### Essential emqx.conf

```hocon
listeners.tcp.default.bind = "0.0.0.0:1883"
listeners.tcp.default.max_packet_size = "1MB"
mqtt.retain_available = true
mqtt.max_topic_levels = 10
mqtt.wildcard_subscription = true
retainer.enable = true
retainer.backend.type = built_in_database
retainer.backend.storage_type = disc
```

## Architecture (When Activated)

```
Industrial Devices --> EMQX (1883/8883) --> SparkplugAdapter (mqtt.js)
                                                  |
                                            IngestionAdapter.subscribe()
                                                  |
                                            IngestionService pipeline

Future (Epic 28):
  EMQX --(select topics)--> MqttNatsBridge L2 --> NATS JetStream
```

## Activation Cost

| Epic | SP | Description |
|------|-----|-------------|
| Epic 26 | 13 SP | EMQX Docker, config, TLS, Nix module, auth |
| Epic 28 | 8 SP | EMQX-NATS Bridge L2 Service |
| **Total** | **21 SP** | ~2 sprints |

All implementation details pre-planned in `thoughts/shared/plans/emqx-broker-infrastructure-plan.md`.

## External Links

| Resource | Description |
|----------|-------------|
| [EMQX Docker Hub](https://hub.docker.com/r/emqx/emqx) | Container images |
| [EMQX Docs](https://docs.emqx.com/en/emqx/latest/) | Latest documentation |
| [EMQX Sparkplug B](https://docs.emqx.com/en/emqx/latest/data-integration/sparkplug.html) | Sparkplug integration |
| [EMQX GitHub](https://github.com/emqx/emqx) | Source code |
