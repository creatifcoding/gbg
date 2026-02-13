# EMQX Broker Infrastructure — Quick Reference

**SME**: arch-emqx | **Status**: BANKED (Epic 26 + Epic 28) | **Updated**: 2026-02-08

EMQX is a purpose-built MQTT 5.0 broker planned as the industrial device communication layer for Sparkplug B edge nodes, raw MQTT sensors, and OPC-UA PubSub. It coexists with NATS — NATS remains the internal backbone while EMQX owns the MQTT protocol boundary. **Currently banked**: the NATS-only path was chosen, with EMQX activatable if third-party MQTT devices require a standards-compliant MQTT 5.0 broker with retained messages and full session persistence.

---

## Key Decisions

- **EMQX version**: 5.8 (latest at time of planning) — best Sparkplug B support, MQTT 5.0
- **Deployment**: Docker Compose only (no k8s)
- **EMQX-NATS relationship**: COEXIST — EMQX for external MQTT devices, NATS for internal bus
- **Auth (production)**: PostgreSQL password lookup + JWT for service-to-service
- **Auth (dev)**: Anonymous (`EMQX_ALLOW_ANONYMOUS=true`)
- **EMQX→NATS bridge**: Separate L2 service (Epic 28, also banked)
- **STATUS**: Both Epic 26 (EMQX) and Epic 28 (bridge) are BANKED — preserved, not deleted
- **Retained messages**: Critical for Sparkplug B STATE topics; EMQX's retainer is disc-backed
- **NATS MQTT bridge lacks**: retained messages, MQTT 5.0 features, session persistence — hence EMQX was planned

---

## Configuration Reference

### Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 1883 | MQTT TCP | Device connections |
| 8883 | MQTT TLS | Secure device connections |
| 8083 | WebSocket | Browser MQTT clients |
| 8084 | WebSocket TLS | Secure browser MQTT |
| 18083 | HTTP | Dashboard + REST API + Prometheus |

No conflicts with NATS (4222/8222/9222) or PostgreSQL (5432/5433).

### Essential emqx.conf Settings

```hocon
listeners.tcp.default.bind = "0.0.0.0:1883"
listeners.tcp.default.max_packet_size = "1MB"       # Sparkplug protobuf can be large
mqtt.retain_available = true                         # Critical for STATE messages
mqtt.max_topic_levels = 10                           # ISA-95 hierarchy depth
mqtt.wildcard_subscription = true                    # spBv1.0/+/DDATA/#
retainer.enable = true
retainer.backend.type = built_in_database
retainer.backend.storage_type = disc                 # Persist across restarts
```

### Docker Compose Service

```yaml
emqx:
  image: emqx/emqx:5.8
  container_name: tmnl_emqx
  ports: ['1883:1883', '8883:8883', '8083:8083', '8084:8084', '18083:18083']
  volumes:
    - emqx-data:/opt/emqx/data
    - emqx-log:/opt/emqx/log
    - ./emqx/emqx.conf:/opt/emqx/etc/emqx.conf:ro
    - ./emqx/acl.conf:/opt/emqx/etc/acl.conf:ro
  environment:
    EMQX_DASHBOARD__DEFAULT_USERNAME: 'admin'
    EMQX_DASHBOARD__DEFAULT_PASSWORD: 'tmnl_dev_2026'
    EMQX_ALLOW_ANONYMOUS: 'true'
  healthcheck:
    test: ['CMD', 'emqx', 'ctl', 'status']
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 30s
```

---

## When to Activate EMQX

Activate Epic 26 (EMQX) when ANY of these are true:

1. **Third-party edge nodes** require a standards-compliant MQTT 5.0 broker (retained messages, session persistence, Will Delay Interval)
2. **NATS MQTT bridge empirical tests** (Epic 27, F27.4) reveal blocking limitations (e.g., Will messages don't fire reliably)
3. **Retained message serving** needed for late-joining subscribers beyond JetStream KV workaround
4. **Scale** exceeds NATS MQTT bridge capacity
5. **MQTT 5.0 features** needed: topic aliases, flow control, user properties, Will Delay

Do NOT activate if:
- All devices connect through our own SparkplugAdapter (we control the client)
- JetStream KV handles STATE message semantics adequately
- NATS MQTT bridge handles Will messages reliably (verified by spike F27.4)

---

## Integration Points

```
Industrial Devices ──► EMQX (1883/8883) ──► SparkplugAdapter (mqtt.js client)
                                                    │
                                              IngestionAdapter.subscribe()
                                                    │
                                              IngestionService pipeline
                                              (TopicRouter → ReadingProcessor → AlarmDetector)
                                                    │
                                              TimescaleDB + EventLog

Future (Epic 28):
  EMQX ──(select topics)──► MqttNatsBridge L2 ──► NATS JetStream
```

- **SparkplugAdapter** connects to EMQX via mqtt.js, subscribes to `spBv1.0/+/DDATA/#`
- **IngestionAdapter** interface is protocol-agnostic — already defined in Epic 19
- **TopicRouter** resolves per-group routes from Sparkplug B namespace
- **MqttNatsBridge** (Epic 28) would forward select MQTT topics to NATS JetStream subjects

---

## Docker/Nix Quick Commands

```bash
# Start EMQX (after implementing Epic 26)
docker compose -f docker/docker-compose.iiot.yml up -d emqx

# Check status
docker exec tmnl_emqx emqx ctl status

# List connected clients
docker exec tmnl_emqx emqx ctl clients list

# List topics
docker exec tmnl_emqx emqx ctl topics list

# List retained messages
docker exec tmnl_emqx emqx ctl retainer list

# Prometheus metrics
curl http://localhost:18083/api/v5/prometheus/stats

# Test publish (requires mosquitto-clients in Nix shell)
mosquitto_pub -h localhost -p 1883 -t "spBv1.0/acme/DDATA/site-a/motor-01" -m '{"value":42.5}'

# Test subscribe
mosquitto_sub -h localhost -p 1883 -t "spBv1.0/+/DDATA/#" -v

# Generate dev TLS certs
bash docker/emqx/certs/generate-dev-certs.sh docker/emqx/certs

# Dashboard
open http://localhost:18083  # admin / tmnl_dev_2026
```

Nix module planned at `nix/modules/emqx/default.nix` with scripts: `emqx-up`, `emqx-down`, `emqx-status`, `emqx-shell`, `emqx-test-pub`, `emqx-test-sub`, `emqx-test-sparkplug`, `emqx-gen-certs`, `emqx-destroy`.

---

## External Links

| Resource | URL |
|----------|-----|
| EMQX Docker Hub | https://hub.docker.com/r/emqx/emqx |
| EMQX Docs (latest) | https://docs.emqx.com/en/emqx/latest/ |
| EMQX Configuration Reference | https://docs.emqx.com/en/emqx/latest/configuration/configuration.html |
| EMQX ACL (Authorization) | https://docs.emqx.com/en/emqx/latest/access-control/authz/authz.html |
| EMQX PostgreSQL Auth | https://docs.emqx.com/en/emqx/latest/access-control/authn/postgresql.html |
| EMQX JWT Auth | https://docs.emqx.com/en/emqx/latest/access-control/authn/jwt.html |
| EMQX Sparkplug B Docs | https://docs.emqx.com/en/emqx/latest/data-integration/sparkplug.html |
| EMQX REST API | https://docs.emqx.com/en/emqx/latest/admin/api.html |
| EMQX Prometheus | https://docs.emqx.com/en/emqx/latest/observability/prometheus.html |
| EMQX GitHub | https://github.com/emqx/emqx |
| Sparkplug 3.0.0 Spec | https://www.eclipse.org/tahu/spec/sparkplug_spec.pdf |
| NATS MQTT Bridge Docs | https://docs.nats.io/running-a-nats-service/configuration/mqtt |

---

## FAQ

**Q1: Why was EMQX banked instead of deleted?**
Because the NATS MQTT bridge lacks retained messages, MQTT 5.0 features, and full session persistence. If third-party devices require these, EMQX activates. Plans are preserved at `thoughts/shared/plans/emqx-broker-infrastructure-plan.md`.

**Q2: Does EMQX replace NATS?**
No. They coexist. NATS = internal backbone (JetStream KV, event streaming, cluster coordination). EMQX = external MQTT broker (device telemetry, Sparkplug B). If EMQX is activated, a bridge service (Epic 28) forwards select MQTT data to NATS.

**Q3: What's the activation cost of Epic 26?**
13 SP across 5 features (Docker Compose, EMQX config, TLS, Nix module, auth). All implementation details are pre-planned in `emqx-broker-infrastructure-plan.md` — an implementer can follow it step by step.

**Q4: Can I test MQTT without EMQX?**
Yes. NATS has a built-in MQTT bridge (`mqtt.enabled: true` in NATS config). It supports MQTT 3.1.1, QoS 0/1, Will messages (2.9+), but NOT retained messages or MQTT 5.0. Epic 27 F27.4 is a spike to empirically test its limits.

**Q5: Where are the ACL rules?**
Dev: `{allow, all}` in `docker/emqx/acl.conf`. Production ACLs are documented in the plan (Phase 6, topic namespace design) covering edge nodes, ingestion service, SCADA host, bridge service, and operator roles.

**Q6: How does auth work?**
Dev: anonymous. Production: EMQX PostgreSQL auth plugin queries `mqtt_users` table for device credentials (bcrypt hashed). Services authenticate via JWT (JWKS endpoint). Both auth mechanisms are configured in `emqx.conf` (commented out for dev).

**Q7: What's the Sparkplug B topic structure?**
`spBv1.0/{group_id}/{message_type}/{edge_node_id}/{device_id}`. group_id maps to enterprise (ISA-95). edge_node_id encodes site.area.line. device_id is the machine/sensor. Multi-group supported via `+` wildcard on group_id.

**Q8: What about STATE messages?**
STATE messages (`STATE/{scada_host_id}`) are the ONLY Sparkplug B message type requiring `retain=true`. EMQX handles this natively. Under the NATS-only path, JetStream KV substitutes for retained messages (arguably superior: history, TTL, watch).

**Q9: How does EMQX health monitoring work?**
Three levels: (1) Container healthcheck via `emqx ctl status`, (2) Dashboard at :18083 for real-time monitoring, (3) Prometheus metrics at `/api/v5/prometheus/stats`. The SparkplugAdapter tracks its own connection health separately via `Effect.Ref<IngestionHealth>`.

**Q10: What files would be created if EMQX is activated?**
`docker/emqx/emqx.conf`, `docker/emqx/acl.conf`, `docker/emqx/certs/generate-dev-certs.sh`, `docker/emqx/certs/.gitignore`, `nix/modules/emqx/default.nix`. Modified: `docker/docker-compose.iiot.yml`, `nix/default.nix`, `nix/modules/core.nix`.

---

*Created by arch-emqx — EMQX Broker Infrastructure SME*
*Source plans: emqx-broker-infrastructure-plan.md, broker-infra-decomposition.md, sparkplug-b-reference-index.md*
*Date: 2026-02-08*
