# RFC Section: Conformance & Testing Requirements

```
Section:       17 — Conformance & Testing Requirements
RFC:           001 (Entity Lifecycle Event Distribution)
Status:        DRAFT
Author:        industry-analyst (Val)
Created:       2026-02-09
Dependencies:  rfc-section-architectural-principles.md (conformance levels)
               rfc-section-two-domain-consistency.md (G-1 through G-8)
               rfc-section-monitoring-infrastructure.md (SLO definitions)
```

---

## CT.1 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this section are to be
interpreted as described in [RFC2119] and [RFC8174].

---

## CT.2 Conformance Levels

This RFC defines three conformance levels. Each level subsumes the requirements
of the preceding level.

### CT.2.1 Level 1: Single-Organization Conformance

An implementation MUST satisfy architectural principles P1 through P8 (see
Section 3) and ordering guarantees G-1 through G-7 (see Section X.3) to claim
single-organization conformance. This level supports:

- ISA-95 hierarchy navigation at depths 1 through 9
- Real-time entity state subscriptions via WebSocket [EFFECT-RPCSERVER]
- Event sourcing with temporal queries for alarm, equipment state, and work
  order entities [EVENT-SOURCING]
- Bounded-latency delivery per the SLO table in MON.4.1
- Edge-cloud partition tolerance (G-6) with local continuity
- Idempotent event processing (G-7) via content-addressed message IDs

**Required features** (all MUST):

| Feature | Verification |
|---------|-------------|
| Per-entity sequential ordering (G-1) | Monotonic sequence numbers per entity stream |
| Session consistency (G-4) | Read-your-writes within a single WebSocket connection |
| Bounded staleness (G-5) | Latency within ISA-95 level thresholds (L0: 100ms, L1: 250ms, L2: 1s) |
| Edge partition tolerance (G-6) | Events buffered locally during 24h partition, replayed on reconnection |
| Idempotent processing (G-7) | Duplicate message IDs rejected without side effects |
| ISA-18.2 alarm lifecycle | 6 alarm states, valid transitions, shelve duration limits [EEMUA-191] |
| Effect Schema validation | All entity events decode without error through Schema.decodeUnknown |

**Optional features** (MAY):

| Feature | Note |
|---------|------|
| Cross-entity causal ordering (G-3) | Requires `causedBy` metadata; SHOULD for full SA support |
| Variable-depth hierarchy (> 5 levels) | Required only for enterprise deployments |
| Benchmark suite execution | RECOMMENDED for production deployments |

### CT.2.2 Level 2: Manufacturing Commons Conformance

An implementation MUST satisfy principles P1 through P12 and guarantees G-1
through G-8 to claim manufacturing commons conformance. This level adds:

| Feature | Verification |
|---------|-------------|
| Cross-org eventual consistency (G-8) | Bounded staleness of 60 seconds across tenant boundaries |
| NATS account isolation [NATS-ACCOUNTS] | Zero subject namespace leakage between organizations |
| Anti-corruption layer [ANTI-CORRUPTION] | Redacted signals pass schema validation; no raw entity state crosses boundary |
| Variable-depth ISA-95 hierarchy (P9) | Telescoping from 3 to 9 levels without entity ID changes |
| Data sovereignty mediation (P10) | Export rules enforced per NATS account; cross-org signals carry `networkTimestamp` |
| Commons governance observability (P12) | Aggregate metrics available without exposing per-org internals |

### CT.2.3 Partial Conformance

Implementations MAY claim partial conformance by declaring which principles and
guarantees are satisfied. The minimum viable sets are:

| Deployment Scenario | Required Principles | Required Guarantees |
|--------------------|--------------------|-------------------|
| Single machine monitoring | P1, P5 | G-1, G-5 |
| Small shop (Earl persona) | P1, P3, P5, P9 | G-1, G-4, G-5, G-7 |
| Contract manufacturer (Maria persona) | P1-P6, P9 | G-1 through G-7 |
| Enterprise (Boeing persona) | P1-P8 | G-1 through G-7 |
| Manufacturing commons | P1-P12 | G-1 through G-8 |

Partial conformance claims MUST enumerate satisfied requirements explicitly.
An implementation MUST NOT claim a conformance level if any MUST requirement
at that level is unmet.

---

## CT.3 Test Suite Requirements

Implementations MUST provide a test suite organized into five tiers. Each tier
targets a distinct failure class and MUST be executable independently.

### CT.3.1 Tier 1: Unit Tests (Schema & Pure Logic)

Unit tests validate Effect Schema decode/encode roundtrips, state machine
transition logic, and pure functions with no external dependencies.

**Requirements**:
- Every `Schema.TaggedStruct` and `Schema.TaggedClass` in the entity domain
  MUST have a decode/encode roundtrip test [EFFECT-SCHEMA]
- Every state machine transition function MUST have exhaustive valid/invalid
  transition tests
- ISA-95 hierarchy validation (`isValidParentChild`) MUST be tested for all
  9 entity types

**Codebase reference**: Unit tests at
`src/lib/iiot/__tests__/schemas/*.test.ts` and
`src/lib/iiot/__tests__/schemas/area.test.ts` through `site.test.ts`
demonstrate the current schema validation pattern.

**Framework**: Vitest with `@effect/vitest` [EFFECT-VITEST]. Configuration at
`vitest.config.ts` (lines 10-48): `happy-dom` environment, `pool: "forks"`,
`singleFork: true` for sequential integration execution.

### CT.3.2 Tier 2: Property-Based Tests (Invariants)

Property-based tests use fast-check generators to explore the state space of
ISA-95 hierarchies, state machine transitions, and event schemas.

**Requirements**:
- Hierarchy invariants MUST be validated: valid parent-child relationships
  across all 9 entity types, path depth bounds (1-9 segments), and segment
  uniqueness within a path
- State machine invariants MUST hold: reachability (every state reachable
  from initial via valid transitions), no dead states (every non-terminal
  state has at least one outbound transition), and determinism (each
  state + event pair yields exactly one next state)
- OEE calculation invariants MUST hold: `0 <= OEE <= 1`,
  `OEE = Availability * Performance * Quality`, and monotonic degradation
  under fault injection
- Schema roundtrip invariants MUST hold: `decode(encode(x)) === x` for
  all entity event types under arbitrary valid inputs

**Codebase reference**: Property-based tests at
`src/lib/iiot/__tests__/schemas/property-based/hierarchy.test.ts`,
`entity-methods.test.ts`, `oee-calculations.test.ts`,
`state-machines.test.ts`, `temporal.test.ts`, and
`json-schema.test.ts`. Graph property tests at
`src/lib/iiot/__tests__/schemas/property-based/asset-state-graphs-*.test.ts`
and machine property tests at
`src/lib/iiot/__tests__/machines/property/*.property.test.ts`.

### CT.3.3 Tier 3: Integration Tests (Service Composition)

Integration tests validate Effect Layer composition, database interactions,
and JetStream stream configuration.

**Requirements**:
- EventJournal append/read roundtrip MUST work for all event-sourced
  entities (alarms, equipment state, work orders)
- Repository operations (CRUD) MUST work against the IIoT database
  (PostgreSQL + Apache AGE graph + TimescaleDB hypertables)
- State machine integration tests MUST validate full lifecycle:
  create entity -> transition states -> query history -> verify audit trail
- IngestionService pipeline (SparkplugPipelineLayer) MUST process a
  Sparkplug-B DDATA payload end-to-end: decode protobuf -> route by topic
  -> process reading -> detect alarm threshold -> persist

**Codebase reference**: Integration tests at
`src/lib/iiot/__tests__/integration/sql-event-journal.test.ts`,
`work-order-es.test.ts`, `equipment-state-es.test.ts`,
`graph.test.ts`, `time-series.test.ts`, `hybrid.test.ts`.
Machine integration tests at
`src/lib/iiot/__tests__/integration/machines/*.integration.test.ts`.

**Infrastructure**: Integration tests require Docker infrastructure:
```
docker compose -f docker/docker-compose.iiot.yml up -d
```

### CT.3.4 Tier 4: Compliance Tests (Standards Conformance)

Compliance tests validate adherence to external standards referenced by this
RFC.

**Requirements**:

| Standard | Test Scope | Pass Criteria |
|----------|-----------|---------------|
| ISA-18.2 [EEMUA-191] | Alarm state machine: 6 states, valid transitions, shelve max 24h, suppression requires reason | All transitions match ISA-18.2 state diagram |
| ISA-95 [ISA-95-1] | Hierarchy depth 1-9, parent-child validation, entity type enumeration | All 9 entity types validated; no orphan or cyclic references |
| Sparkplug-B [SPARKPLUG-B] | NBIRTH/DBIRTH/DDATA/DDEATH decode, alias resolution, metric type mapping | 100% of Sparkplug-B message types decoded without error |
| RFC 2119 [RFC2119] | Every MUST requirement in Sections X, Y, Z testable by at least one test case | No untested MUST requirement |

**Codebase reference**: Compliance tests at
`src/lib/iiot/__tests__/compliance/isa-18-2-compliance.test.ts` and
`immutability.test.ts`.

### CT.3.5 Tier 5: End-to-End Tests (System Behavior)

End-to-end tests validate cross-cutting behavior across the full system stack:
edge device, NATS cluster, entity processing pipeline, and WebSocket delivery.

**Requirements**:
- **Onboarding flow**: Organization creation -> NATS account provisioning ->
  edge device bootstrap -> first Sparkplug-B NBIRTH -> first OEE score.
  MUST complete within the 15-minute SLA (Section O)
- **Partition tolerance**: Edge device operates for 24 hours without cloud
  connectivity. On reconnection, all buffered events MUST replay in
  per-entity sequential order (G-1) with zero data loss
- **Multi-tenant isolation**: Events published by Organization A MUST NOT
  be observable by Organization B. Verified by subscribing to wildcard
  subjects across account boundaries
- **Alarm lifecycle**: Sensor threshold breach -> alarm raised -> operator
  acknowledged -> alarm cleared. Full lifecycle MUST complete within
  alarm delivery SLO (Critical: < 100ms platform delivery)

**Infrastructure**: E2E tests require the full Docker Compose stack plus
at least two NATS accounts for multi-tenant isolation verification.

---

## CT.4 Performance Benchmarks

Implementations claiming conformance MUST meet the following performance
thresholds under sustained load. Benchmarks MUST be executed on hardware
representative of the target deployment (see Section D for deployment topology).

### CT.4.1 Event Throughput

| Channel | Minimum Sustained Rate | Test Duration | Measurement |
|---------|----------------------|---------------|-------------|
| `iiot:readings` (L0 telemetry) | 1,000 events/sec per org | 5 minutes | Events published and acknowledged by JetStream |
| `iiot:alarms` (L1-L2 lifecycle) | 100 events/sec per org | 5 minutes | Zero dropped alarm events (bounded backpressure) |
| `iiot:equipment` (L1-L2 state) | 200 events/sec per org | 5 minutes | All state transitions persisted |
| `iiot:entity-changes` (L3 transitions) | 500 events/sec per org | 5 minutes | EventJournal append confirmed |
| Aggregate (hub cluster) | 2M events/sec total | 5 minutes | Across all channels, all organizations |

**Codebase reference**: Channel throughput targets defined in
`rfc-section-effect-architecture.md` (lines 420-432). Throughput spike test
pattern at `src/lib/iiot/__tests__/spikes/sparkplug-throughput-spike.test.ts`.

**Benchmark configuration**: Vitest benchmark mode (`vitest.config.ts` lines
44-48, `include: ["src/**/*.bench.{ts,tsx}"]`).

### CT.4.2 Event Delivery Latency

Latency is measured from event production (entity handler emit) to subscriber
delivery (WebSocket message or NATS consumer ack).

| ISA-95 Level | P50 | P95 | P99 | Measurement Window |
|--------------|-----|-----|-----|--------------------|
| L0 (Physical Process) | < 20ms | < 50ms | < 100ms | 10,000 events |
| L1 (Basic Control) | < 50ms | < 100ms | < 250ms | 10,000 events |
| L2 (Supervisory Control) | < 100ms | < 250ms | < 500ms | 10,000 events |
| L3 (Manufacturing Ops) | < 200ms | < 500ms | < 1s | 10,000 events |
| L4 (Enterprise) | < 500ms | < 2s | < 5s | 10,000 events |

**Source**: SLO definitions from MON.4.1 (monitoring infrastructure section).

### CT.4.3 Entity Scale

| Metric | Threshold | Measurement |
|--------|-----------|-------------|
| Concurrent active entities per org | >= 1,000 | Entity handlers responding within L2 latency SLO |
| Total entities per hub cluster | >= 100,000 | Shard assignment stable, no hot spots > 2x mean |
| Hierarchy depth | 9 levels | Navigation queries < 50ms P95 |
| Concurrent WebSocket subscribers | >= 500 per org | Event fan-out within latency SLOs |

### CT.4.4 Edge Device Performance

| Metric | Threshold | Hardware Baseline |
|--------|-----------|------------------|
| Sensor ingestion rate | >= 100 sensors at 1 Hz | Raspberry Pi 4 (4 GB) or equivalent |
| Local JetStream persistence | >= 100 events/sec sustained | 32 GB SD card or eMMC |
| Sparkplug-B decode latency | < 5ms per DDATA message | ARM Cortex-A72 @ 1.5 GHz |
| Offline buffer capacity | >= 24 hours at 100 events/sec | ~800 MB JetStream storage |

---

## CT.5 Interoperability Testing

### CT.5.1 Sparkplug-B Interoperability [SPARKPLUG-B]

Implementations MUST pass the following Sparkplug-B interoperability tests:

| Test Case | Input | Expected Behavior |
|-----------|-------|-------------------|
| NBIRTH decode | Valid NBIRTH protobuf with 50 metrics | All metrics registered in AliasRegistry; entity created |
| DBIRTH decode | Valid DBIRTH with metric aliases | Aliases resolved to metric names via AliasRegistry |
| DDATA with aliases | DDATA using numeric aliases (not names) | Alias resolution succeeds; reading values correct |
| DDEATH handling | DDEATH from previously birthed node | Node state set to OFFLINE; `StateRegistryKV` updated |
| STATE topic | `STATE/scada_host_id` with online=true/false | Host availability updated in state registry |
| Rebirth sequence | DBIRTH after DDEATH (same node) | AliasRegistry cleared and rebuilt; no stale aliases |
| Unknown alias | DDATA with alias not in current NBIRTH | Metric skipped with warning; no crash |
| Protobuf v3 | Sparkplug-B payload encoded with protobuf3 | Decode succeeds; metric types mapped correctly |

**Codebase reference**: AliasRegistry at
`src/lib/iiot/adapters/sparkplug-adapter.ts` (lines 79-111). Sparkplug
integration spikes at `src/lib/iiot/__tests__/spikes/sparkplug-*.test.ts`.

### CT.5.2 OPC UA Interoperability [OPC-UA-14]

Implementations claiming OPC UA support MUST pass:

| Test Case | Expected Behavior |
|-----------|-------------------|
| Browse address space | ISA-95 hierarchy navigable via OPC UA BrowseService |
| Read current value | Entity state readable as OPC UA Variable nodes |
| Subscribe to changes | MonitoredItems deliver entity state changes within L2 latency SLO |
| Historical access | HistoryRead returns event-sourced entity history |

**Note**: OPC UA adapter is currently a stub
(`src/lib/iiot/adapters/opcua-adapter-stub.ts`). These tests become REQUIRED
when the adapter reaches production readiness.

### CT.5.3 MQTT 5.0 Interoperability [MQTT-5]

Implementations MUST support MQTT 5.0 as the transport for Sparkplug-B and
MAY support it for direct telemetry ingestion:

| Test Case | Expected Behavior |
|-----------|-------------------|
| QoS 1 delivery | At-least-once delivery confirmed via PUBACK |
| Retained messages | NBIRTH retained; late-joining subscribers receive last birth certificate |
| Topic alias | MQTT 5.0 topic aliases reduce per-message overhead |
| Shared subscriptions | `$share/group/topic` distributes load across adapter instances |

### CT.5.4 NATS Interoperability [NATS-PROTO]

For direct NATS integration (developer-facing, lowest latency):

| Test Case | Expected Behavior |
|-----------|-------------------|
| Subject mapping | Entity events published to `iiot.{orgId}.entity.{type}.{id}` |
| JetStream consumer | Pull consumer with explicit ack receives all events in order (G-1) |
| KV watch | NATS KV watch on entity key delivers state changes in real time |
| Account isolation | Subscriber in Account B receives zero messages from Account A subjects |
| Leaf node sync | Edge leaf node reconnect replays buffered messages preserving order |

---

## CT.6 Certification Process

### CT.6.1 Third-Party Integration Certification

Organizations developing adapters, connectors, or extensions for the TMNL
manufacturing commons MUST undergo the following certification process:

**Step 1: Self-Assessment**
- Execute the conformance test suite (CT.3) against the integration
- Document which conformance level (CT.2) is claimed
- Record all test results with timestamps and environment details

**Step 2: Interoperability Verification**
- Deploy the integration in a staging environment with at least two
  existing certified organizations
- Execute cross-org event delivery tests (G-8 verification)
- Verify zero namespace leakage across NATS accounts

**Step 3: Performance Validation**
- Execute the benchmark suite (CT.4) under sustained load
- Provide P50/P95/P99 latency measurements for all applicable ISA-95 levels
- Demonstrate edge device performance within thresholds (CT.4.4) if
  the integration includes edge components

**Step 4: Certification Grant**
- Submit self-assessment, interoperability results, and performance
  data to the commons governance body
- Certification is granted per conformance level and is valid for
  12 months or until a breaking schema change, whichever comes first
- Certified integrations are listed in the commons registry

### CT.6.2 Recertification Triggers

An integration MUST be recertified when:

| Trigger | Reason |
|---------|--------|
| Schema version change | New entity event schemas may break decode/encode roundtrips |
| NATS protocol upgrade | Leafnode or JetStream behavior changes may affect G-1, G-6 |
| Sparkplug-B spec update | Metric type or alias semantics may change |
| 12-month expiry | Periodic validation against evolving commons requirements |

---

## CT.7 Schema Evolution Regression Testing

### CT.7.1 Forward Compatibility

When an entity event schema evolves (new optional fields, new event types),
existing consumers MUST continue to function without modification.

**Test procedure**:
1. Produce events using the new schema version (v(n+1))
2. Consume events using a consumer compiled against the previous schema (v(n))
3. Verify: consumer decodes all events without error; unknown fields are
   ignored; no data corruption in known fields

**Implementation**: Effect Schema's `Schema.optionalWith` for new fields ensures
forward compatibility. The `_tag` discriminant on `TaggedStruct` MUST remain
stable across versions [EFFECT-SCHEMA].

### CT.7.2 Backward Compatibility

When a consumer is upgraded to a new schema version, it MUST correctly process
events persisted under the previous schema.

**Test procedure**:
1. Persist 1,000 events using schema v(n)
2. Upgrade consumer to schema v(n+1)
3. Replay all persisted events through the upgraded consumer
4. Verify: all events decode successfully; entity state reconstructed
   identically to pre-upgrade state

### CT.7.3 Schema Registry Validation

Implementations SHOULD maintain a schema registry that:
- Records all schema versions with their Effect Schema definitions
- Validates that new versions are backward-compatible (no removed required
  fields, no type narrowing of existing fields)
- Generates JSON Schema artifacts via `JSONSchema.make()` for external
  consumers [EFFECT-SCHEMA]

### CT.7.4 Regression Test Matrix

For each schema evolution, the following test matrix MUST be executed:

| Test | v(n) Producer -> v(n) Consumer | v(n+1) Producer -> v(n) Consumer | v(n) Producer -> v(n+1) Consumer | v(n+1) Producer -> v(n+1) Consumer |
|------|-------------------------------|----------------------------------|----------------------------------|-------------------------------------|
| Decode success | MUST pass | MUST pass | MUST pass | MUST pass |
| Encode roundtrip | MUST pass | N/A (consumer only) | N/A (consumer only) | MUST pass |
| Entity state integrity | MUST pass | MUST pass (known fields only) | MUST pass | MUST pass |
| Event ordering (G-1) | MUST pass | MUST pass | MUST pass | MUST pass |

---

## CT.8 Coverage Requirements

### CT.8.1 Code Coverage Thresholds

Implementations SHOULD meet the following coverage thresholds for production
deployments:

| Metric | Threshold | Scope |
|--------|-----------|-------|
| Line coverage | >= 85% | Entity domain (`src/lib/iiot/`) |
| Function coverage | >= 85% | Entity domain |
| Branch coverage | >= 80% | Entity domain |
| Statement coverage | >= 85% | Entity domain |

**Codebase reference**: Coverage configuration at `vitest.config.ts` (lines
26-43), using v8 provider with `["text", "json", "html"]` reporters.

### CT.8.2 Requirement Traceability

Every MUST and MUST NOT requirement in this RFC SHOULD be traceable to at
least one test case. Implementations SHOULD maintain a traceability matrix
mapping RFC requirement identifiers (G-1 through G-8, P1 through P12, MON.*,
CT.*) to specific test file paths.

---

## References

All citations use keys from the canonical bibliography
(`docs/specifications/bibliography.md`).

### Standards
- [RFC2119] — RFC 2119 key words
- [RFC8174] — RFC 8174 key words clarification
- [ISA-95-1] — ISA-95 Part 1: Models and terminology
- [EEMUA-191] — EEMUA 191 alarm management
- [SPARKPLUG-B] — Eclipse Sparkplug-B specification
- [OPC-UA-14] — OPC UA Part 14: PubSub
- [MQTT-5] — MQTT version 5.0

### Effect-TS
- [EFFECT-SCHEMA] — Effect Schema runtime validation
- [EFFECT-VITEST] — @effect/vitest test integration
- [EFFECT-RPCSERVER] — Effect RpcServer
- [EFFECT-CLUSTER] — @effect/cluster entity management
- [EVENT-SOURCING] — Event sourcing pattern

### Infrastructure
- [NATS-PROTO] — NATS protocol specification
- [NATS-ACCOUNTS] — NATS account-based multi-tenancy
- [NATS-DEDUP-INF] — NATS deduplication

### Architecture
- [ANTI-CORRUPTION] — Anti-corruption layer pattern

---

<!-- INTEGRATION NOTES
  Section ID: CT
  Assembly position: Section 17 (after Onboarding Protocol, before Appendices)
  Line count: ~290
  Dependencies: Sections 3 (principles), X (guarantees), MON (SLOs), O (onboarding SLA)
  Cross-references from other sections:
    - rfc-assembly-plan.md:668 identifies this as a gap
    - rfc-section-architectural-principles.md:527-559 defines conformance levels (CT.2 expands)
    - rfc-section-monitoring-infrastructure.md:235-241 defines SLOs (CT.4.2 references)
    - rfc-section-two-domain-consistency.md:59-168 defines G-1..G-8 (CT.2 references)
  Citation keys used (18): RFC2119, RFC8174, ISA-95-1, EEMUA-191, SPARKPLUG-B,
    OPC-UA-14, MQTT-5, EFFECT-SCHEMA, EFFECT-VITEST, EFFECT-RPCSERVER,
    EFFECT-CLUSTER, EVENT-SOURCING, NATS-PROTO, NATS-ACCOUNTS, NATS-DEDUP-INF,
    ANTI-CORRUPTION, ISA-18.2 (inline ref only, not bracketed), JETSTREAM (inline only)
  All 18 bracketed keys verified against bibliography.md
-->
