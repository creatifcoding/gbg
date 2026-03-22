# NATS-Only Sparkplug B — Quick Reference Index

**Author:** arch-nats-advocate | **Created:** 2026-02-08 | **Status:** Active SME resource

---

## Why NATS-Only Won

EMQX was banked because the primary justification — retained messages for BIRTH certificates — collapsed under source-code analysis: `sparkplug-client` hardcodes `retain: false` on every publish. The only Sparkplug B message requiring retain is STATE, and JetStream KV handles it with superior semantics (history, TTL, watch(), enumeration). NATS saves 21 SP (~2 sprints) by eliminating EMQX container, Nix scripts, TLS certs, auth backend, and the bridge L2 service. Weighted score: NATS 59/68 vs EMQX 55/68.

---

## NATS MQTT Bridge — What Works / What Doesn't

| Feature | Supported | Notes |
|---------|-----------|-------|
| MQTT 3.1.1 | YES | Full protocol |
| QoS 0 / QoS 1 | YES | QoS 1 via JetStream |
| Will messages (LWT) | YES (2.9+) | Fires on TCP disconnect |
| Binary payloads | YES | Opaque bytes — protobuf works |
| Topic wildcards | YES | `+` and `#` |
| Retained messages | **NO** | Use JetStream KV instead |
| MQTT 5.0 | **NO** | Not needed — Sparkplug B is 3.1.1 |
| QoS 2 | **NO** | Downgraded to QoS 1 — irrelevant for Sparkplug |
| Session persistence | **NO** | sparkplug-client hardcodes `clean: true` |
| MQTT dashboard | **NO** | Use NATS monitoring (:8222) + CLI |

---

## Workarounds

**Retained messages → JetStream KV** (superior: history, TTL, watch(), key enumeration, atomic ops)
- `SPARKPLUG_BIRTHS` bucket — keyed `{group}.{edgeNode}.{device}`, replay on startup via `kv.keys()`, live updates via `kv.watch()`
- `SPARKPLUG_STATE` bucket — keyed `{scada_host_id}`, ONLINE/OFFLINE

**Session persistence → JetStream durable consumers** (not needed — `clean: true` hardcoded)

**MQTT 5.0 → Not needed** (subscriber-side role, spec is 3.1.1-based)

---

## NATS MQTT Bridge Config

**Helm values (already enabled):** `mqtt.enabled: true`, `mqtt.port: 1883`

**Docker nats-server.conf:**
```conf
mqtt { port: 1883; ack_wait: "30s"; max_ack_pending: 1024 }
```

**Docker Compose:** Add `- '1883:1883'` to NATS ports. That's it.

---

## Decision Matrix Summary

| Dimension | Winner | Why |
|-----------|--------|-----|
| Data path | Tie | Both work for Sparkplug B |
| Retained messages | **NATS** | KV is better; sparkplug-client doesn't use retain anyway |
| Will messages | **EMQX** | More battle-tested (NATS needs spike verification) |
| STATE handling | **NATS** | KV watch() > MQTT retained |
| Operational complexity | **NATS** | Already running; zero new infra |
| Bridge elimination | **NATS** | Direct consume; no L2 service needed |
| MQTT dashboard | **EMQX** | Rich web UI vs CLI |
| Future MQTT 5.0 | **EMQX** | Ready today |
| **Weighted total** | **NATS 59/68** | vs EMQX 55/68 |

---

## Spike Plan — Epic 27 F27.4

| Test | Validates | Pass Criteria |
|------|-----------|---------------|
| F27.4.1 | Will firing on TCP disconnect | NDEATH arrives within keepalive window |
| F27.4.2 | Protobuf roundtrip through bridge | Byte-for-byte match after decode |
| F27.4.3 | Wildcard subscription | `spBv1.0/+/DDATA/#` receives multi-group messages |
| F27.4.4 | Throughput | 1000 DDATA msg/sec without loss |

**Decision gate (F27.4.5):** All pass → NATS confirmed. Any critical fail → activate Epic 26 (EMQX).

---

## When EMQX Activates

Trigger ANY of: (1) third-party devices needing MQTT 5.0, (2) Will spike failure, (3) Sparkplug conformance testing flags retain deviation, (4) scale beyond NATS MQTT bridge capacity, (5) customer MQTT 5.0-only devices.

Plans preserved: `emqx-broker-infrastructure-plan.md` (841 lines), `broker-infra-decomposition.md`.

---

## JetStream KV Patterns

```typescript
// Store BIRTH
const kv = await js.views.kv('SPARKPLUG_BIRTHS', { history: 5, ttl: 86_400_000 })
await kv.put(`${groupId}.${edgeNode}.${deviceId}`, birthPayload)

// Replay on startup
for await (const key of await kv.keys()) {
  const entry = await kv.get(key); if (entry) processBirthCert(entry.value)
}

// Watch live
const watch = await kv.watch()
for await (const entry of watch) processBirthCert(entry.value)

// STATE
const stateKV = await js.views.kv('SPARKPLUG_STATE')
await stateKV.put('scada-primary', 'ONLINE')
```

---

## External Links

| Resource | URL |
|----------|-----|
| NATS MQTT Bridge docs | https://docs.nats.io/running-a-nats-service/configuration/mqtt |
| JetStream KV docs | https://docs.nats.io/nats-concepts/jetstream/key-value-store |
| NATS Docker images | https://hub.docker.com/_/nats (`nats:2.10-alpine`) |
| Sparkplug 3.0.0 spec | https://www.eclipse.org/tahu/spec/sparkplug_spec.pdf |
| mqtt.js (transport) | https://github.com/mqttjs/MQTT.js |
| sparkplug-payload | https://www.npmjs.com/package/sparkplug-payload |

---

## FAQ

**Will messages reliable on NATS?** Supported since 2.9+. Less battle-tested than EMQX — spike F27.4.1 is mandatory. Heartbeat fallback planned as defense-in-depth.

**`.` in edge node IDs?** Creates extra NATS subject levels. Use `>` wildcards (not `*`) for NATS subscriptions, or normalize IDs to `-`.

**Late-joining subscribers?** JetStream KV `SPARKPLUG_BIRTHS` — enumerate keys on startup, then `kv.watch()`. Better than MQTT retained.

**Need MQTT 5.0 later?** Add EMQX. SparkplugAdapter uses mqtt.js — broker switch is a URL change. Plans banked (Epics 26+28, 21 SP).

**QoS 2?** NATS downgrades to QoS 1. Irrelevant — Sparkplug B uses QoS 0 for data, QoS 1 for Will/CMD.

**Connection limit?** Designed for thousands, not millions. Our scope (tens-hundreds of edge nodes) is fine. Benchmark before scaling further.

**Monitoring without EMQX Dashboard?** NATS `:8222` HTTP (`/connz`, `/subsz`, `/jsz`), `nats` CLI, `nats-top`, Prometheus `/metrics`. Build MQTT-specific health into SparkplugAdapter.

---

*arch-nats-advocate — Standing Expert Panel, IIoT Broker Infrastructure*
