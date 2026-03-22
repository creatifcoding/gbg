# Decision Gate Result: F27.4.5 -- NATS-Only vs EMQX

**Date:** 2026-02-09
**Agent:** kraken (Decision Gate Evaluation)
**Status:** DECISION RENDERED
**Decision:** NATS-ONLY CONFIRMED for development phase. EMQX banked (Epic 26 stays on shelf).

---

## 1. Decision Summary

**NATS-only is CONFIRMED** as the broker strategy for the current development and prototype phase.

EMQX activation is NOT required. Epic 26 (EMQX Broker Infrastructure, 13 SP) and Epic 28 (EMQX-NATS Bridge L2 Service, 8 SP) remain banked -- totaling 21 SP of deferred work. The SparkplugAdapter, SparkplugPublisher, and `@selfcharters/sparkplug-client` are all broker-agnostic by design; switching from NATS MQTT bridge to EMQX is a one-line URL change (`mqtt://nats:1883` to `mqtt://emqx:1883`).

---

## 2. Evidence Inventory

### 2.1 What Was Built (VERIFIED -- files read and analyzed)

| Artifact | Path | Status |
|----------|------|--------|
| SparkplugAdapter | `src/lib/iiot/adapters/sparkplug-adapter.ts` | Complete, 353 lines. AliasRegistry, multi-group, health check, retry logic. |
| SparkplugPublisher | `src/lib/iiot/adapters/sparkplug-publisher.ts` | Complete, 189 lines. NBIRTH, DBIRTH, periodic DDATA with random values. |
| MqttTransport | `packages/sparkplug-client/src/MqttTransport.ts` | Complete, 234 lines. Effect-native, `Stream.asyncPush`, `acquireRelease` lifecycle. |
| SparkplugProtocol | `packages/sparkplug-client/src/SparkplugProtocol.ts` | Complete. Topic builder, seq counters, Will construction. |
| SparkplugCodec | `packages/sparkplug-client/src/SparkplugCodec.ts` | Complete. Protobuf encode/decode, metric value extraction. |
| CLI script | `scripts/sparkplug-publish.ts` | Complete. Env-var configured Bun entry point. |
| Nix module | `nix/modules/sparkplug.nix` | Complete. 4 scripts: sparkplug-publish, sparkplug-test, sparkplug-spike, sparkplug-client-test. |

### 2.2 Spike Tests Written (VERIFIED -- all 4 files read)

| Spike | File | What It Tests |
|-------|------|---------------|
| 1.1 Will Message | `__tests__/spikes/sparkplug-will-spike.test.ts` | Will message delivery on unclean disconnect (socket.destroy) |
| 1.2 Protobuf Roundtrip | `__tests__/spikes/sparkplug-protobuf-spike.test.ts` | Sparkplug B protobuf encode/decode survives MQTT publish/subscribe |
| 1.3 Wildcard Matching | `__tests__/spikes/sparkplug-wildcard-spike.test.ts` | `spBv1.0/+/DDATA/+/+` correctly matches DDATA, excludes NBIRTH |
| 1.4 Throughput | `__tests__/spikes/sparkplug-throughput-spike.test.ts` | 100 msg/sec sustained, <1% loss at QoS 0, p95 latency <50ms |

All 4 spike tests use `process.env['MQTT_BROKER']` and skip when no broker is available. They are designed to run against ANY MQTT broker -- NATS MQTT bridge, EMQX, Mosquitto, or any other compliant broker.

### 2.3 What Was NOT Built (VERIFIED -- not in codebase)

| Missing Item | Impact |
|--------------|--------|
| NATS MQTT bridge config | `docker/nats/nats-server.conf` has NO `mqtt {}` block. Port 1883 is not exposed. |
| Docker port 1883 mapping | `docker-compose.yml` NATS service maps only 4222, 8222, 9222. No MQTT port. |
| EMQX Docker service | `docker-compose.iiot.yml` has only iiot-db. No EMQX container. |
| Spike execution results | No evidence of spike tests having been run against any broker. |

---

## 3. Decision Criteria Evaluation

### 3.1 Sparkplug B Protobuf Over MQTT Bridge

**Assessment: PASS (by design, pending empirical validation)**

The spike test (`sparkplug-protobuf-spike.test.ts`) is well-constructed: it encodes a UPayload with 5 metrics (Double, Boolean, String, Int32), publishes the protobuf binary via mqtt.js, receives it, decodes, and compares field-by-field. It also tests byte-identical preservation.

NATS MQTT bridge treats payloads as opaque bytes. The NATS documentation confirms binary payload pass-through. Protobuf encoding should survive transit without corruption.

**Confidence: HIGH** -- The test exists and the protocol mechanics are sound. Empirical run required but expected to pass.

### 3.2 Multi-Group Subscription

**Assessment: PASS (by design, pending empirical validation)**

The wildcard spike test (`sparkplug-wildcard-spike.test.ts`) validates:
1. `spBv1.0/+/DDATA/+/+` matches DDATA but NOT NBIRTH (different topic depth)
2. `spBv1.0/{groupId}/#` matches all message types within a group

NATS MQTT bridge translates `+` to `*` and `#` to `>` in the NATS subject space. Both are standard MQTT 3.1.1 wildcards.

The SparkplugAdapter (`sparkplug-adapter.ts:293-321`) creates one MqttTransport per groupId and merges via `Stream.mergeAll`. This architecture works identically regardless of broker.

**Confidence: HIGH** -- Architecture is broker-agnostic. Wildcard semantics are standard MQTT 3.1.1.

### 3.3 Will Message / NDEATH

**Assessment: CONDITIONAL PASS**

The Will spike test (`sparkplug-will-spike.test.ts`) validates the critical NDEATH delivery path: a client connects with a Will payload, socket is destroyed, and the subscriber checks for Will delivery within 5 seconds.

**Key findings from the NATS-only proposal (Section 4.2):**
- NATS MQTT bridge supports Will messages since NATS Server 2.9+
- The Docker image is `nats:2.10-alpine` -- Will support is present
- `sparkplug-client` sets `will.retain = false` and `will.qos = 0` -- both compatible with NATS MQTT bridge
- The custom `@selfcharters/sparkplug-client` MqttTransport (`MqttTransport.ts:101-106`) constructs the Will with configurable QoS and retain

**Risk:** NATS Will implementation is less battle-tested than EMQX. The proposal recommends a heartbeat-based fallback for defense-in-depth. This is a reasonable mitigation.

**Confidence: MEDIUM-HIGH** -- Protocol support exists in NATS 2.10. Needs empirical spike execution to confirm. Heartbeat fallback should be built regardless.

### 3.4 Retained Messages (STATE / BIRTH Certificates)

**Assessment: PASS (with JetStream KV workaround)**

**Critical finding from the NATS-only proposal (Section 2):**

> Source-code analysis of `sparkplug-client` v3.2.4 reveals that the library does NOT use retained messages. Every `publish()` call defaults to `retain: false`. The Will message explicitly sets `retain: false`.

The custom `@selfcharters/sparkplug-client` package confirms this at the architecture level -- `SparkplugConfig.publish.retain` defaults to `false` in both the publisher (`sparkplug-publisher.ts:108`) and adapter (`sparkplug-adapter.ts:227`).

**For BIRTH certificates:** The proposal recommends JetStream KV (`SPARKPLUG_BIRTHS` bucket) as an application-layer device registry. This is arguably superior to MQTT retained messages:
- History tracking (KV revision)
- TTL for stale entries
- `kv.watch()` for reactive updates
- Explicit query via `kv.keys()`

**For STATE messages:** JetStream KV (`SPARKPLUG_STATE` bucket) provides equivalent semantics with explicit `watch()` instead of retained message delivery.

**Confidence: HIGH** -- The retained message concern is largely theoretical for the current codebase. JetStream KV provides better semantics.

### 3.5 Performance at 100+ msg/sec

**Assessment: PASS (by design, pending empirical validation)**

The throughput spike test (`sparkplug-throughput-spike.test.ts`) publishes 1000 messages at 10ms intervals (100 msg/sec), measures loss and latency:
- Target: <1% loss at QoS 0
- Target: p95 latency <50ms

NATS is designed for millions of messages per second. The MQTT bridge adds minimal overhead for message translation. The IIoT workload (hundreds to low thousands of msg/sec) is well within NATS capabilities.

**Confidence: HIGH** -- NATS throughput far exceeds requirements. Empirical confirmation via spike execution is straightforward.

---

## 4. Risk Assessment

### Remaining Risks (NATS-Only)

| Risk | Severity | Likelihood | Mitigation | Status |
|------|----------|------------|------------|--------|
| Will message reliability under edge cases | HIGH | LOW | Heartbeat fallback (not yet built) | OPEN -- build as part of adapter hardening |
| NATS MQTT bridge protocol edge cases | MEDIUM | LOW | Spike tests designed to catch these | OPEN -- run spikes to validate |
| No MQTT-specific dashboard | MEDIUM | CERTAIN | NATS monitoring + adapter health endpoint | ACCEPTABLE -- nats CLI and :8222 sufficient for dev |
| Future MQTT 5.0 requirement | HIGH | MEDIUM | Add EMQX later; adapter is broker-agnostic | ACCEPTABLE -- deferred cost, not eliminated |
| Third-party device compatibility | MEDIUM | LOW | Only our own publisher in dev phase | NOT APPLICABLE for current scope |
| Topic translation dot-vs-slash | LOW | CERTAIN | Use `>` wildcards in NATS; normalize edge_node_ids | DOCUMENTED in proposal Appendix B |

### What Could Trigger EMQX Activation

1. Will message spike fails on NATS MQTT bridge
2. Customer deployment requires third-party MQTT 5.0 edge devices
3. Sparkplug B conformance certification required
4. Scale beyond 10K concurrent MQTT clients
5. Regulatory audit requires certified MQTT broker

---

## 5. Quantitative Summary

### Work Saved by NATS-Only

| Epic | SP | Description | Status |
|------|-----|-------------|--------|
| Epic 26 | 13 SP | EMQX Broker Infrastructure | BANKED |
| Epic 28 | 8 SP | EMQX-NATS Bridge L2 Service | BANKED |
| **Total saved** | **21 SP** | ~2 sprints | |

### Work Required (NATS-Only)

| Task | SP | Description | Status |
|------|-----|-------------|--------|
| Enable MQTT bridge in NATS config | 0.5 SP | Add `mqtt { port: 1883 }` to `nats-server.conf`, expose port in Docker | NOT DONE |
| Run spike tests against NATS MQTT bridge | 0.5 SP | Execute all 4 spike tests with `MQTT_BROKER=mqtt://localhost:1883` | NOT DONE |
| SparkplugDeviceRegistry (KV) | 2 SP | JetStream KV for BIRTH cert store | NOT DONE |
| Heartbeat death detection (fallback) | 2 SP | Application-layer NDEATH monitoring | NOT DONE |
| **Total new work** | **5 SP** | ~0.5 sprint | |

### Net Savings: 16 SP (~1.5 sprints)

---

## 6. Immediate Next Steps

### Step 1: Enable NATS MQTT Bridge (Tiny -- 15 minutes)

Add to `docker/nats/nats-server.conf`:

```
mqtt {
  port: 1883
  no_auth_user: mqtt_dev
}
```

Add to `docker/docker-compose.yml` under `nats.ports`:

```
- '1883:1883'   # MQTT bridge
```

### Step 2: Run Spike Tests (Small -- 30 minutes)

```bash
docker compose -f docker/docker-compose.yml restart nats
MQTT_BROKER=mqtt://localhost:1883 bun test src/lib/iiot/__tests__/spikes/
```

Expected: All 4 spikes pass. If any fail, document the failure and re-evaluate.

### Step 3: Record Results

Update this document with empirical spike results. If all pass, close the decision gate. If Will message spike fails, escalate to EMQX activation.

---

## 7. Decision Statement

**NATS-ONLY CONFIRMED** for the development and prototype phase.

**Rationale:**
1. The SparkplugAdapter and `@selfcharters/sparkplug-client` are fully implemented and broker-agnostic
2. The `sparkplug-client` library (and our custom fork) do not use retained messages -- the primary EMQX justification collapses
3. NATS 2.10 supports Will messages, the only genuinely critical MQTT feature for Sparkplug B NDEATH
4. JetStream KV provides better semantics than MQTT retained messages for device registry and STATE tracking
5. 21 SP of EMQX infrastructure work is deferred, saving approximately 1.5 sprints
6. The architecture supports EMQX activation as a one-line URL change if requirements change

**Conditions:**
- Spike tests MUST be executed against NATS MQTT bridge to empirically validate the decision
- Will message reliability MUST be confirmed via spike 1.1
- Heartbeat-based NDEATH fallback SHOULD be built for defense-in-depth
- This decision WILL be revisited if third-party edge devices or MQTT 5.0 features become a requirement

**Epic 26 Status:** BANKED (available for activation if conditions change)
**Epic 28 Status:** BANKED (eliminated entirely if NATS-only remains)

---

## Appendix A: File Evidence Trail

All claims in this document are sourced from direct file reads:

| File | Finding |
|------|---------|
| `docker/nats/nats-server.conf` | No `mqtt {}` block -- MQTT bridge NOT currently enabled |
| `docker/docker-compose.yml` | NATS ports: 4222, 8222, 9222 only -- no 1883 |
| `docker/docker-compose.iiot.yml` | Only iiot-db service -- no EMQX container |
| `src/lib/iiot/adapters/sparkplug-adapter.ts` | Full implementation: AliasRegistry, multi-group, health, retry |
| `src/lib/iiot/adapters/sparkplug-publisher.ts` | Full implementation: NBIRTH, DBIRTH, periodic DDATA |
| `packages/sparkplug-client/src/MqttTransport.ts` | Effect-native, `Stream.asyncPush`, configurable Will |
| `__tests__/spikes/sparkplug-will-spike.test.ts` | Will message delivery test (unclean disconnect) |
| `__tests__/spikes/sparkplug-protobuf-spike.test.ts` | Protobuf roundtrip preservation test |
| `__tests__/spikes/sparkplug-wildcard-spike.test.ts` | Wildcard subscription filtering test |
| `__tests__/spikes/sparkplug-throughput-spike.test.ts` | 100 msg/sec sustained throughput test |
| `nix/modules/sparkplug.nix` | 4 mission-control scripts for IIoT category |
| `thoughts/shared/plans/sparkplug-b-plan.md` | Architecture plan, 7 design decisions, appendices |
| `thoughts/shared/plans/nats-only-sparkplug-proposal.md` | NATS-only counter-argument, decision matrix, workarounds |
| `thoughts/shared/plans/emqx-broker-infrastructure-plan.md` | EMQX plan (7 phases, 5 features) |
| `thoughts/shared/plans/broker-infra-decomposition.md` | WBS decomposition (Epics 26-28, 34 SP) |

---

Co-Authored-By: kraken-agent (Val)
