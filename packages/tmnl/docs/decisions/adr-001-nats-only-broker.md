# ADR-001: NATS-Only Broker Strategy

> Consolidated from `thoughts/shared/plans/nats-decision-gate-result.md`
> Decision date: 2026-02-09 | Status: ACCEPTED

## Context

The IIoT system needs an MQTT broker for Sparkplug B device communication. Two candidates were evaluated:

1. **NATS** (already running) with its built-in MQTT bridge
2. **EMQX** (new infrastructure) as a purpose-built MQTT 5.0 broker

The SparkplugAdapter, SparkplugPublisher, and `@selfcharters/sparkplug-client` are all broker-agnostic by design -- switching from NATS MQTT bridge to EMQX is a one-line URL change (`mqtt://nats:1883` to `mqtt://emqx:1883`).

## Decision

**NATS-only is CONFIRMED** as the broker strategy for the development and prototype phase. EMQX is banked (Epic 26 + Epic 28 remain on shelf, totaling 21 SP of deferred work).

## Evidence

### What NATS MQTT Bridge Supports

| Feature | Supported | Notes |
|---------|-----------|-------|
| MQTT 3.1.1 | YES | Full protocol |
| QoS 0 / QoS 1 | YES | QoS 1 via JetStream |
| Will messages (LWT) | YES (2.9+) | Fires on TCP disconnect |
| Binary payloads | YES | Opaque bytes -- protobuf works |
| Topic wildcards | YES | `+` and `#` |
| Retained messages | **NO** | Use JetStream KV instead |
| MQTT 5.0 | **NO** | Not needed -- Sparkplug B is 3.1.1 |
| Session persistence | **NO** | sparkplug-client hardcodes `clean: true` |

### Critical Finding

Source-code analysis of `sparkplug-client` v3.2.4 reveals that the library does NOT use retained messages. Every `publish()` call defaults to `retain: false`. The Will message explicitly sets `retain: false`. This collapses the primary EMQX justification.

### JetStream KV as Retained Message Substitute

For BIRTH certificates and STATE messages, JetStream KV provides superior semantics:
- History tracking (KV revision)
- TTL for stale entries
- `kv.watch()` for reactive updates
- Explicit query via `kv.keys()`

## Decision Matrix

| Dimension | Winner | Why |
|-----------|--------|-----|
| Data path | Tie | Both work for Sparkplug B |
| Retained messages | **NATS** | KV is better; sparkplug-client doesn't use retain |
| Will messages | **EMQX** | More battle-tested (NATS needs spike verification) |
| STATE handling | **NATS** | KV watch() > MQTT retained |
| Operational complexity | **NATS** | Already running; zero new infra |
| Bridge elimination | **NATS** | Direct consume; no L2 service needed |
| MQTT dashboard | **EMQX** | Rich web UI vs CLI |
| Future MQTT 5.0 | **EMQX** | Ready today |
| **Weighted total** | **NATS 59/68** | vs EMQX 55/68 |

## Savings

| Epic | SP | Description | Status |
|------|-----|-------------|--------|
| Epic 26 | 13 SP | EMQX Broker Infrastructure | BANKED |
| Epic 28 | 8 SP | EMQX-NATS Bridge L2 Service | BANKED |
| **Total saved** | **21 SP** | ~2 sprints deferred |

## Conditions

- Spike tests MUST be executed against NATS MQTT bridge to empirically validate
- Will message reliability MUST be confirmed via spike F27.4.1
- Heartbeat-based NDEATH fallback SHOULD be built for defense-in-depth
- Decision WILL be revisited if third-party edge devices or MQTT 5.0 features become required

## EMQX Activation Triggers

1. Will message spike fails on NATS MQTT bridge
2. Customer deployment requires third-party MQTT 5.0 edge devices
3. Sparkplug B conformance certification required
4. Scale beyond 10K concurrent MQTT clients
5. Regulatory audit requires certified MQTT broker

## Consequences

- NATS remains the single broker for both internal events and external MQTT
- 21 SP of infrastructure work deferred (~1.5 sprints saved)
- EMQX plans preserved at `thoughts/shared/plans/emqx-broker-infrastructure-plan.md`
- Architecture supports EMQX activation as a one-line URL change
