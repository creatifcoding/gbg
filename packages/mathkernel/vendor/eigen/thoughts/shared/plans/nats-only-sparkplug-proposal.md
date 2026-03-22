# Devil's Advocate: NATS-Only Sparkplug B Architecture

**Created:** 2026-02-08
**Author:** arch-nats-advocate (Val — adversarial review mode)
**Status:** PROPOSAL — Stress-testing the EMQX decision
**Purpose:** Rigorous counter-argument to adding EMQX. Goal: commit with confidence or change course.

---

## 1. Executive Summary

The current plan adds EMQX (a dedicated MQTT 5.0 broker) alongside NATS (existing internal backbone) for Sparkplug B IIoT ingestion. This proposal argues that **NATS alone may be sufficient**, and that the claimed EMQX requirements are weaker than they appear.

### Key Finding

**Source-code analysis of `sparkplug-client` v3.2.4 reveals that the library does NOT use retained messages.** Every `publish()` call — NBIRTH, DBIRTH, DDATA, DDEATH — defaults to `retain: false`. The primary justification for EMQX (retained BIRTH certificates) does not apply to the actual library we plan to use.

### The Case in Three Sentences

1. NATS already runs in production with JetStream, KV, clustering, and MQTT bridge support.
2. The only genuinely missing feature is Will messages for NDEATH on ungraceful disconnect — and NATS MQTT bridge has supported Will since NATS Server 2.9.
3. Adding EMQX introduces operational complexity (second message broker, 8 new Nix scripts, Docker volumes, TLS certs, auth backends) for features that `sparkplug-client` does not actually use.

### Honest Bottom Line

The NATS-only approach is **viable for the current scope** but carries risk for future MQTT requirements. This document lays out both sides fairly.

---

## 2. NATS MQTT Bridge — Honest Assessment

### What It Can Do

| Feature | NATS MQTT Bridge (2.10+) | Status |
|---------|--------------------------|--------|
| MQTT 3.1.1 protocol | YES | Full implementation |
| Topic subscription with wildcards | YES | `+` and `#` wildcards work |
| QoS 0 (at most once) | YES | Native |
| QoS 1 (at least once) | YES | Backed by JetStream acknowledgment |
| QoS 2 (exactly once) | NO | Downgraded to QoS 1 |
| Binary payloads (protobuf) | YES | Opaque byte pass-through |
| Will messages (LWT) | YES (since 2.9) | Published on ungraceful disconnect |
| Clean sessions | YES | `clean: true` is the default mode |
| Reconnection | YES | mqtt.js handles reconnect transparently |
| Multiple concurrent clients | YES | Standard NATS connection management |
| Topic→subject translation | YES | `/` becomes `.` automatically |

### What It Cannot Do

| Feature | NATS MQTT Bridge | Impact for Sparkplug B |
|---------|-------------------|----------------------|
| Retained messages | NO | **Low impact** — sparkplug-client does NOT set `retain: true` on any publish. See evidence below. |
| MQTT 5.0 | NO — 3.1.1 only | **Low impact** — sparkplug-client uses mqtt.js v4 with `clean: true`, QoS 0 throughout. No v5 features used. |
| Session persistence | NO — clean sessions only | **No impact** — sparkplug-client hardcodes `clean: true` (line 145 of index.js). |
| Shared subscriptions | NO | **No impact** — not used by Sparkplug B spec or our adapter. |
| Topic aliases (MQTT 5.0) | NO | **No impact** — bandwidth optimization, not needed for local broker. |
| Flow control (MQTT 5.0) | NO | **No impact** — NATS has its own flow control via JetStream. |
| MQTT Dashboard | NO | **Medium impact** — must use NATS monitoring tools instead. |

### Evidence: sparkplug-client Does NOT Use Retained Messages

Source code analysis of `sparkplug-client@3.2.4/index.js`:

```
Line 282-301: publishNodeBirth()    → client.publish(topic, payload)          // NO retain flag
Line 314-321: publishDeviceData()    → client.publish(topic, payload)          // NO retain flag
Line 325-333: publishDeviceBirth()   → client.publish(topic, payload)          // NO retain flag
Line 336-343: publishDeviceDeath()   → client.publish(topic, payload)          // NO retain flag
Line 145-150: Will message           → will: { retain: false, qos: 0, ... }   // Will explicitly NOT retained
```

The mqtt.js `client.publish(topic, payload)` call defaults to `{ retain: false }` when no options object is passed. This means **none of the Sparkplug B messages are retained at the broker level**.

**Implication:** The argument that "NATS cannot do retained messages, therefore EMQX is required" is based on a theoretical spec requirement that the actual library does not implement.

### What NATS MQTT Bridge Actually Uses Under the Hood

When MQTT is enabled on NATS, the bridge:
1. Accepts MQTT TCP connections on the configured port
2. Translates MQTT topics to NATS subjects (`/` → `.`)
3. Maps MQTT subscriptions to NATS subscriptions
4. For QoS 1, creates JetStream consumers for delivery guarantees
5. For Will messages, stores the Will payload and publishes it on TCP disconnect
6. Treats all payloads as opaque bytes (protobuf works fine)

---

## 3. Proposed Architecture: NATS-Only

```
Industrial Devices / Edge Nodes (multiple groups/enterprises)
│
├── Sparkplug B Edge Nodes ──┐    group_id = "acme", "contoso", "fabrikam"
│   (DDATA/DBIRTH/DDEATH)    │    (multi-group support)
│                            │
├── Raw MQTT Sensors ────────┼──▶ NATS Server (port 1883 MQTT / 4222 NATS)
│   (JSON payloads)          │       │
│                            │       ├── JetStream (file-backed persistence)
├── OPC-UA PubSub ───────────┘       ├── KV Store (device registry, BIRTH certs)
│   (MQTT transport)                 ├── Monitoring (port 8222)
│                                    ├── WebSocket (port 9222)
│                                    │
│                                    ▼
│                            SparkplugAdapter (mqtt.js client)
│                            Connects to NATS MQTT bridge on :1883
│                            Subscribes: spBv1.0/+/DDATA/#  (all groups)
│                                        spBv1.0/+/DBIRTH/# (device registration)
│                                    │
│                                    ▼
│                            IngestionAdapter.subscribe()
│                            → Stream<IngestedReading>
│                                    │
│                            ┌───────┴────────┐
│                            │                │
│                     IngestionService    BIRTH cert → KV
│                     (pipeline)         (application-layer
│                            │            device registry)
│                            ▼
│                     TimescaleDB + EventLog
│
│
│   ┌─────────────────────────────────────────────────────────────┐
│   │  Application-Layer Device Registry (replaces retained msgs) │
│   │                                                              │
│   │  JetStream KV bucket: SPARKPLUG_BIRTHS                      │
│   │    Key: {group}.{edgeNode}.{device}                         │
│   │    Value: Last BIRTH certificate (protobuf or JSON)          │
│   │    Watch: New subscribers get current state via KV.watch()   │
│   │                                                              │
│   │  JetStream KV bucket: SPARKPLUG_STATE                       │
│   │    Key: {scada_host_id}                                      │
│   │    Value: "ONLINE" | "OFFLINE"                               │
│   │    Watch: State changes via KV.watch()                       │
│   └─────────────────────────────────────────────────────────────┘
│
│
NATS (single broker) ──── Internal backbone + MQTT bridge
│                         JetStream KV, event streams, WebSocket
│                         cluster coordination, device registry
│                         MQTT bridge for industrial devices
```

### Key Differences from EMQX Architecture

| Concern | EMQX Plan | NATS-Only Plan |
|---------|-----------|----------------|
| MQTT broker | Dedicated EMQX container | NATS MQTT bridge (built-in) |
| Device registry | EMQX retained messages | JetStream KV bucket |
| SCADA STATE | EMQX retained messages | JetStream KV bucket |
| NDEATH detection | EMQX Will messages | NATS Will messages (2.9+) + heartbeat fallback |
| Dashboard | EMQX Dashboard (:18083) | NATS monitoring (:8222) + CLI |
| Auth | EMQX PostgreSQL + JWT | NATS auth (users/tokens/NKeys) |
| TLS | EMQX TLS listener (:8883) | NATS TLS (same config pattern) |
| Internal consumers | EMQX→NATS bridge (L2 service) | Direct — already in NATS |

### The Bridge Service Becomes Unnecessary

The EMQX plan requires a **future L2 bridge service** (Epic 28, 8 SP) to forward EMQX MQTT topics to NATS JetStream for internal consumers. With NATS-only, this entire epic is eliminated — MQTT messages are already NATS subjects. Internal services subscribe directly.

```
EMQX plan:   Device → EMQX → Bridge L2 Service → NATS → Internal Consumer
NATS-only:   Device → NATS (MQTT bridge) → Internal Consumer
```

**Savings:** Epic 28 (8 SP, ~1 sprint), plus ongoing operational complexity of maintaining the bridge.

---

## 4. Workarounds for Missing Features

### 4.1 Retained Messages → JetStream KV (Last-Value Cache)

**Problem:** The Sparkplug B spec says NBIRTH/DBIRTH SHOULD be retained so late-joining subscribers get the metric catalog.

**Reality check:** sparkplug-client does NOT set `retain: true`. This is a theoretical concern, not a practical one.

**Workaround (arguably better than retained messages):**

```typescript
// Application-layer device registry using JetStream KV
// This is BETTER than retained messages because it provides:
// - History (KV revision tracking)
// - TTL (auto-expire stale entries)
// - Watch (reactive updates for new subscribers)
// - Explicit lifecycle management

import { connect, KV } from 'nats'

// On NBIRTH/DBIRTH received by SparkplugAdapter:
const storeBirthCert = async (kv: KV, groupId: string, edgeNode: string, deviceId: string, payload: Uint8Array) => {
  const key = `${groupId}.${edgeNode}.${deviceId ?? '_node'}`
  await kv.put(key, payload)  // Stored with revision history
}

// On new subscriber join (adapter startup):
const replayBirthCerts = async (kv: KV) => {
  const keys = await kv.keys()
  for await (const key of keys) {
    const entry = await kv.get(key)
    if (entry) {
      // Replay BIRTH cert to the adapter's alias registry
      processBirthCert(entry.value)
    }
  }
}

// Reactive: watch for new BIRTH certs
const watchBirths = async (kv: KV) => {
  const watch = await kv.watch()
  for await (const entry of watch) {
    processBirthCert(entry.value)
  }
}
```

**Why this is arguably better than retained messages:**
- **History**: KV tracks revisions; retained messages only keep the latest
- **TTL**: Auto-expire stale BIRTH certs after N hours
- **Watch semantics**: `kv.watch()` is more explicit than retained message delivery
- **Query**: Can enumerate all known devices via `kv.keys()`
- **Atomic**: KV operations are atomic; retained messages have race conditions

### 4.2 Will Messages (NDEATH) → NATS Will + Heartbeat Fallback

**Problem:** When an edge node crashes, NDEATH must be published to notify subscribers. MQTT Will messages handle this at the broker level.

**NATS status:** Will messages ARE supported since NATS Server 2.9+. When an MQTT client connects with a Will payload and then disconnects ungracefully (TCP timeout, crash), NATS publishes the Will message.

**Primary approach: Use NATS Will support directly.**

```
sparkplug-client sets Will at connect:
  will: {
    topic: "spBv1.0/{group}/NDEATH/{edgeNode}",
    payload: encodedDeathPayload,
    qos: 0,
    retain: false    // NOTE: retain is false — compatible with NATS
  }

NATS MQTT bridge receives this Will configuration.
On ungraceful disconnect → NATS publishes Will to translated subject.
```

Since `retain: false` is explicitly set on the Will, NATS's lack of retained message support is irrelevant here.

**Fallback: Application-layer heartbeat monitoring.**

If Will messages prove unreliable in NATS MQTT bridge (edge case), implement a fallback:

```typescript
// Heartbeat-based death detection (defensive layer)
// This runs IN ADDITION to Will messages, not instead of

const HEARTBEAT_TIMEOUT_MS = 30_000  // 30 seconds

const monitorEdgeNodes = Effect.gen(function* () {
  const lastSeen = yield* Ref.make(HashMap.empty<string, number>())

  // Update timestamp on any message from an edge node
  const onMessage = (edgeNodeId: string) =>
    Ref.update(lastSeen, HashMap.set(edgeNodeId, Date.now()))

  // Periodic check for stale edge nodes
  const checker = Stream.repeatEffectWithSchedule(
    Effect.gen(function* () {
      const now = Date.now()
      const map = yield* Ref.get(lastSeen)
      for (const [edgeNodeId, lastTs] of HashMap.entries(map)) {
        if (now - lastTs > HEARTBEAT_TIMEOUT_MS) {
          yield* publishSyntheticDeath(edgeNodeId)
          yield* Ref.update(lastSeen, HashMap.remove(edgeNodeId))
        }
      }
    }),
    Schedule.spaced(Duration.seconds(10))
  )

  return checker
})
```

**Trade-off acknowledged:** Heartbeat detection adds 10-30 seconds of latency vs Will messages which fire on TCP disconnect (~5-15 seconds depending on keepalive). For IIoT alarm systems, this latency may or may not be acceptable depending on the use case.

### 4.3 Session Persistence → Not Needed

sparkplug-client hardcodes `clean: true` (line 145). No session persistence is used. Non-issue.

### 4.4 MQTT 5.0 → Not Needed (Currently)

sparkplug-client uses mqtt.js v4 and no MQTT 5.0 features. The Sparkplug B spec is based on MQTT 3.1.1. Non-issue for current scope.

### 4.5 STATE Messages → JetStream KV

```typescript
// STATE/{scada_host_id} → JetStream KV
const stateKV = await js.views.kv('SPARKPLUG_STATE')

// Publish STATE (our adapter publishes this, not sparkplug-client)
await stateKV.put('scada-primary', 'ONLINE')

// Watch for STATE changes (reactive)
const watch = await stateKV.watch({ key: '>' })
for await (const entry of watch) {
  console.log(`SCADA ${entry.key}: ${entry.string()}`)
}
```

This is cleaner than MQTT retained messages because KV gives you explicit `watch()` semantics instead of relying on retained message delivery on subscribe.

### 4.6 MQTT Dashboard → NATS Monitoring + CLI

**EMQX provides:** Web dashboard at :18083 showing connected clients, topics, subscriptions, message rates, retained messages.

**NATS provides:**
- HTTP monitoring at :8222 (`/connz`, `/subsz`, `/routez`, `/jsz`)
- `nats` CLI tool (`nats sub`, `nats pub`, `nats stream ls`, `nats kv ls`)
- `nats-top` for real-time monitoring
- Prometheus metrics via `/metrics` endpoint

**Gap:** No MQTT-specific dashboard. You can't see "MQTT clients" as a distinct category. This is a real operational visibility gap.

**Mitigation:** Build a simple health endpoint in the SparkplugAdapter that reports MQTT-level metrics (connected clients, topics, message rate). This data feeds into the existing IngestionHealth schema.

---

## 5. Decision Matrix

| Dimension | EMQX (dedicated broker) | NATS-only (MQTT bridge) | Winner |
|-----------|------------------------|------------------------|--------|
| **1. Sparkplug B data path (DDATA)** | Full MQTT 5.0 | MQTT 3.1.1 bridge | Tie — both work |
| **2. Retained messages (BIRTH certs)** | Native support | JetStream KV (better semantics) | **NATS** — KV is better than retained, and sparkplug-client doesn't use retain anyway |
| **3. Will messages (NDEATH)** | Native, battle-tested | Supported since 2.9, less battle-tested | **EMQX** — more proven |
| **4. STATE message handling** | Retained messages | JetStream KV | **NATS** — explicit watch semantics |
| **5. MQTT protocol compliance** | Full MQTT 3.1.1 + 5.0 | MQTT 3.1.1 (partial) | **EMQX** — full compliance |
| **6. Operational complexity** | New container, 8 Nix scripts, TLS certs, auth backend, volumes | Already running | **NATS** — zero new infrastructure |
| **7. Bridge to internal consumers** | Requires L2 service (Epic 28, 8 SP) | Direct — already in NATS | **NATS** — saves an entire epic |
| **8. Dashboard/observability** | Rich MQTT dashboard | CLI + HTTP monitoring | **EMQX** — better visibility |
| **9. Auth model** | PostgreSQL + JWT (purpose-built) | NATS auth (users/NKeys/JWT) | Tie — both adequate |
| **10. TLS** | Built-in MQTTS listener | NATS TLS (same pattern) | Tie |
| **11. Team knowledge** | New technology to learn | Already in production | **NATS** — known quantity |
| **12. Future MQTT 5.0 needs** | Ready today | Would need EMQX later | **EMQX** — future-proof |
| **13. Resource usage** | ~200MB container + volumes | Zero additional resources | **NATS** — no overhead |
| **14. Port allocation** | 5 new ports (1883, 8883, 8083, 8084, 18083) | Reuse existing NATS :1883 | **NATS** — no port sprawl |
| **15. Third-party MQTT devices** | Full compatibility guaranteed | 3.1.1 devices work; 5.0 devices may not | **EMQX** — safer for unknown devices |
| **16. Sparkplug B spec compliance** | Closer to spec intent | Pragmatic deviation | **EMQX** — spec-purist |
| **17. Recovery from broker failure** | Dedicated failure domain | Broker failure affects ALL services | **EMQX** — isolation |
| **18. Horizontal scaling** | EMQX clustering | NATS clustering | Tie — both cluster |

**Score: NATS wins 7, EMQX wins 6, Tie 5**

### Weighted Score (by importance to our use case)

| Dimension | Weight | EMQX | NATS |
|-----------|--------|------|------|
| Data path works | 10 | 10 | 10 |
| Retained messages | 8 | 8 | 9 |
| Will messages | 9 | 9 | 7 |
| Operational simplicity | 8 | 4 | 8 |
| Bridge elimination | 7 | 3 | 7 |
| Dashboard | 5 | 5 | 2 |
| Team knowledge | 6 | 3 | 6 |
| Future-proofing | 6 | 6 | 3 |
| Resource efficiency | 4 | 2 | 4 |
| Third-party devices | 5 | 5 | 3 |
| **Weighted Total** | — | **55/68** | **59/68** |

NATS-only edges ahead on weighted score, primarily due to operational simplicity and bridge elimination. EMQX's advantage concentrates on future-proofing and MQTT protocol depth.

---

## 6. Risks & Honest Weaknesses

### Where NATS-Only Genuinely Falls Short

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| **Will messages less battle-tested in NATS** | HIGH | LOW-MEDIUM | NATS 2.9+ supports Will. Test thoroughly with sparkplug-client. Add heartbeat fallback as defense-in-depth. |
| **MQTT protocol edge cases** | MEDIUM | LOW | EMQX handles millions of MQTT connections in production. NATS MQTT bridge is a compatibility layer, not a purpose-built broker. Edge cases (malformed packets, protocol negotiation quirks) more likely. |
| **No MQTT-specific dashboard** | MEDIUM | CERTAIN | Must build MQTT visibility into SparkplugAdapter health check and NATS monitoring. Real operational gap. |
| **Future MQTT 5.0 requirement** | HIGH | MEDIUM | If we later need MQTT 5.0 features (shared subscriptions, user properties, topic aliases), we'd need EMQX anyway. This plan defers that cost, not eliminates it. |
| **Third-party device compatibility** | MEDIUM | LOW | Industrial devices from Siemens, ABB, etc. expect full MQTT broker compliance. NATS bridge might have undiscovered incompatibilities. |
| **Failure domain coupling** | MEDIUM | LOW | If NATS goes down, both internal messaging AND MQTT ingestion fail. EMQX provides isolation — MQTT can continue even if NATS is unhealthy. |
| **Sparkplug B spec deviation** | LOW | CERTAIN | The spec recommends retained BIRTH messages. Our approach works pragmatically but deviates from the letter of the spec. If we undergo IEC 62541 or Sparkplug conformance testing, this could be flagged. |

### What Could Force a Migration to EMQX Later

1. **A customer deploys MQTT 5.0-only edge devices** — would need EMQX or Mosquitto
2. **Sparkplug B library change** — if we move away from sparkplug-client to one that uses retained messages
3. **Scale beyond NATS MQTT bridge limits** — NATS MQTT bridge is designed for thousands of clients, not millions
4. **Regulatory requirement** — some IIoT standards may require a certified MQTT broker
5. **Will message failure in production** — if NATS Will proves unreliable, EMQX is the immediate fallback

### What Cannot Be Worked Around

**QoS 2 (exactly-once delivery):** NATS MQTT bridge downgrades QoS 2 to QoS 1. If any future requirement demands exactly-once MQTT delivery, EMQX is required. However, Sparkplug B specifies QoS 0 for DDATA, and sparkplug-client uses QoS 0 for everything, so this is not a current concern.

---

## 7. Implementation: What Changes

### If We Go NATS-Only

**Docker changes:**

```yaml
# docker/nats/nats-server.conf — ADD MQTT bridge
mqtt {
  port: 1883
  # No auth for dev
  no_auth_user: mqtt_dev
}
```

```yaml
# docker/docker-compose.yml — ADD port 1883 to NATS
nats:
  ports:
    - '4222:4222'
    - '8222:8222'
    - '9222:9222'
    - '1883:1883'   # <-- ADD: MQTT bridge
```

That's it. Two lines of config. Compare to the EMQX plan: new container, new Docker service, new volumes, new Nix module with 8 scripts, TLS cert generator, ACL rules, dashboard config.

**SparkplugAdapter changes:** None. mqtt.js connects to `mqtt://localhost:1883` regardless of whether the broker is EMQX or NATS.

**Application-layer device registry:**

```typescript
// src/lib/iiot/adapters/sparkplug-device-registry.ts
// New file — JetStream KV-based device registry (replaces retained BIRTH messages)

import { Effect, Layer } from 'effect'
import * as Nats from '@nats-io/nats'
import * as KV from '@nats-io/kv'

export class SparkplugDeviceRegistry extends Effect.Service<SparkplugDeviceRegistry>()(
  'tmnl/iiot/SparkplugDeviceRegistry',
  {
    effect: Effect.gen(function* () {
      const nc = yield* NatsConnection  // existing NATS service
      const js = nc.jetstream()
      const kv = yield* Effect.tryPromise(() =>
        js.views.kv('SPARKPLUG_BIRTHS', { history: 5, ttl: 24 * 60 * 60 * 1000 })
      )

      return {
        storeBirth: (key: string, payload: Uint8Array) =>
          Effect.tryPromise(() => kv.put(key, payload)),

        getBirth: (key: string) =>
          Effect.tryPromise(() => kv.get(key)).pipe(
            Effect.map((entry) => entry?.value ?? null)
          ),

        watchBirths: () =>
          Stream.async<{ key: string; value: Uint8Array }>((emit) => {
            kv.watch().then((watch) => {
              ;(async () => {
                for await (const entry of watch) {
                  emit.single({ key: entry.key, value: entry.value })
                }
              })()
            })
          }),

        allDevices: () =>
          Effect.tryPromise(async () => {
            const keys: string[] = []
            for await (const key of await kv.keys()) {
              keys.push(key)
            }
            return keys
          }),
      }
    }),
  }
) {}
```

### Epics Eliminated

| Epic | SP | What's Saved |
|------|-----|-------------|
| Epic 26: EMQX Broker Infrastructure | 13 SP | Docker service, EMQX config, TLS, Nix module, auth backend |
| Epic 28: EMQX→NATS Bridge L2 Service | 8 SP | Bridge service, topic mapping, health, tests |
| **Total saved** | **21 SP** | ~2 sprints of work |

### New Work Required (NATS-Only)

| Task | SP | Description |
|------|-----|-------------|
| Enable MQTT bridge in NATS config | 1 SP | 2 lines of config |
| SparkplugDeviceRegistry (KV) | 2 SP | JetStream KV-based BIRTH cert store |
| Heartbeat death detection (fallback) | 2 SP | Application-layer NDEATH monitoring |
| NATS MQTT Will message testing | 1 SP | Verify Will works with sparkplug-client on NATS |
| **Total new work** | **6 SP** | ~0.5 sprint |

**Net savings: 15 SP (~1.5 sprints)**

---

## 8. Recommendation

### My Honest Assessment

**NATS-only is viable for the current scope.** The technical arguments for EMQX are weaker than they appear:

1. **Retained messages:** sparkplug-client doesn't use them. Argument collapses.
2. **Will messages:** NATS 2.9+ supports them. Needs testing, but likely works.
3. **MQTT 5.0:** sparkplug-client uses MQTT 3.1.1. Not needed today.
4. **Session persistence:** sparkplug-client hardcodes `clean: true`. Not needed.

**However**, I recommend the following decision framework:

### Decision Tree

```
Are we deploying to production with third-party edge devices (not our own)?
│
├── YES → Use EMQX
│         Reason: Unknown devices may need full MQTT compliance.
│         We can't control what they send.
│
└── NO → Are we building for IIoT spec conformance / certification?
         │
         ├── YES → Use EMQX
         │         Reason: Retained messages are in the Sparkplug B spec.
         │         Conformance testing will flag the deviation.
         │
         └── NO → NATS-only is viable
                   │
                   ├── Start with NATS MQTT bridge
                   ├── Build SparkplugDeviceRegistry (KV)
                   ├── Test Will messages thoroughly
                   ├── Add heartbeat death detection as fallback
                   └── If Will proves unreliable → add EMQX later
```

### If I Had to Choose

For a **development/prototype phase** where we control the edge devices and are iterating rapidly: **NATS-only**. Save 1.5 sprints, reduce operational complexity, build with what we know.

For a **production deployment** receiving data from third-party industrial devices: **EMQX**. The operational overhead is justified by MQTT protocol compliance, battle-tested Will messages, and the MQTT dashboard for debugging device connectivity issues.

### Phased Approach (Best of Both)

1. **Phase A (now):** Enable NATS MQTT bridge. Build SparkplugAdapter against NATS. Test thoroughly.
2. **Phase B (when needed):** If NATS MQTT bridge proves insufficient (Will failures, device incompatibilities, MQTT 5.0 requirement), add EMQX. The SparkplugAdapter uses mqtt.js — switching brokers is a config change (`mqtt://nats:1883` → `mqtt://emqx:1883`).

This approach lets us **start fast** without foreclosing the EMQX option.

---

## Appendix A: NATS Server MQTT Configuration Reference

```
# nats-server.conf — MQTT bridge configuration
mqtt {
  # MQTT listener port
  port: 1883

  # TLS (optional)
  # tls {
  #   cert_file: "/etc/nats/certs/server-cert.pem"
  #   key_file: "/etc/nats/certs/server-key.pem"
  #   ca_file: "/etc/nats/certs/ca.pem"
  # }

  # Authentication (optional)
  # no_auth_user: mqtt_anon     # Allow anonymous
  # authorization {
  #   users = [
  #     { user: "edge_device", password: "...", permissions: { publish: "spBv1.0.>" } }
  #     { user: "adapter", password: "...", permissions: { subscribe: "spBv1.0.>" } }
  #   ]
  # }

  # QoS 1 requires JetStream
  # (already enabled in our config)

  # Maximum pending ack messages for QoS 1
  ack_wait: "30s"
  max_ack_pending: 1024
}
```

## Appendix B: Topic Translation Examples

| MQTT Topic | NATS Subject |
|------------|-------------|
| `spBv1.0/acme/DDATA/plant-a.area-1.line-1/motor-01` | `spBv1.0.acme.DDATA.plant-a.area-1.line-1.motor-01` |
| `spBv1.0/+/DDATA/#` | `spBv1.0.*.DDATA.>` |
| `STATE/scada-primary` | `STATE.scada-primary` |

**Important caveat:** The `.` in edge_node_id (e.g., `plant-a.area-1.line-1`) creates additional subject levels in NATS. This means `spBv1.0/acme/DDATA/plant-a.area-1.line-1/motor-01` becomes `spBv1.0.acme.DDATA.plant-a.area-1.line-1.motor-01` (7 levels in NATS vs 5 in MQTT). NATS wildcard subscriptions with `>` handle this correctly, but `*` (single token) wildcards would not match multi-level edge_node_ids.

This is a real concern if native NATS subscribers need to consume Sparkplug B messages. The topic translation makes NATS subject hierarchy incompatible with MQTT topic hierarchy when topics contain `.` characters.

**Mitigation:** Use `>` wildcards for NATS subscriptions, or normalize edge_node_ids to use `-` instead of `.`.

## Appendix C: Resource Comparison

| Resource | EMQX Addition | NATS-Only Addition |
|----------|---------------|-------------------|
| Docker containers | +1 (EMQX) | 0 |
| Docker volumes | +2 (data + log) | 0 |
| RAM (idle) | ~150-200MB | ~0 (MQTT bridge is lightweight) |
| RAM (1K MQTT clients) | ~500MB | ~50MB additional |
| Disk | ~200MB image + data | 0 |
| Ports | +5 (1883, 8883, 8083, 8084, 18083) | +1 (1883, reuse NATS) |
| Nix scripts | +8 new scripts | +1 modified config |
| TLS certs | Separate cert set | Reuse NATS certs |
| Auth backend | PostgreSQL + JWT integration | NATS native auth |

---

*This document is an adversarial review, not sabotage. The goal is to stress-test the EMQX decision so we can commit with confidence — or change course if the evidence warrants it.*

Co-Authored-By: Val <val@maidens.ai>

---

## Addendum D: sparkplug-client Override Analysis (2026-02-08)

### Finding: Settings Are Truly Hardcoded

Source-code analysis of `sparkplug-client@3.2.4` confirms that `retain: false`, `clean: true`, and QoS 0 are **hardcoded with no override mechanism**. The TypeScript `Omit` type on `mqttOptions` explicitly excludes `clean`, `will`, and other MQTT connect options from user configuration.

```typescript
// index.d.ts:27 — TypeScript PREVENTS overriding these
mqttOptions?: Omit<IClientOptions,
  'clientId' | 'clean' | 'keepalive' | 'reschedulePings' |
  'connectTimeout' | 'username' | 'password' | 'will'
>;
```

```javascript
// index.js:144-150 — Hardcoded values OVERWRITE user options
this.mqttOptions = {
  ...config.mqttOptions || {},   // user options spread first
  clientId, clean: true,         // then overwritten
  will: { ..., qos: 0, retain: false }  // hardcoded
};
```

### Finding: sparkplug-client is Effectively Dormant

- Last release: 2023-09-06 (2.5 years ago)
- Locked to mqtt.js v4 (two major versions behind)
- Compiled ES5 output (__extends, __assign patterns)
- Single maintainer (Cirrus Link / Eclipse Tahu)
- ~2,000-3,000 weekly downloads

### Recommendation: Build Custom Thin Layer

sparkplug-client provides ~200 lines of value-add over `mqtt.js` + `sparkplug-payload`:
- bdSeq/seq counter management (~35 lines)
- Will payload construction (~15 lines)
- NBIRTH bdSeq injection (~15 lines)
- Topic construction helpers (~20 lines)
- NCMD/DCMD event routing (~30 lines)
- Compression wrapper (~40 lines)

A custom layer takes ~2 SP and provides:
1. `mqtt.js@5` (latest) instead of v4
2. Full control over retain/QoS/Will per message type
3. Effect-native streams (no EventEmitter bridging)
4. TypeScript-first (not compiled ES5)
5. No dependency on a dormant library

**This recommendation holds regardless of NATS-only vs EMQX.** The custom layer gives us broker-agnostic control — the adapter works with either NATS MQTT bridge or EMQX by changing one connection URL.
