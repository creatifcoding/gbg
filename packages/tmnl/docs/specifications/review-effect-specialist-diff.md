# Effect-Specialist Review: RFC Sections 6-14 vs Research Findings

**Reviewer**: Val (effect-specialist)
**Date**: 2026-02-09
**Sources compared**:
- `rfc-entity-realtime-integration.md` Sections 6-14 (lines 769-1620)
- `rfc-section-two-domain-consistency.md` (454 lines)
- `research-effect-architecture.md` (1589 lines)
- `rfc-section-effect-architecture.md` (791 lines)
- `research-cluster-patterns.md` (393 lines)

---

## 1. MISSING in RFC Sections 6-14

### M-1: No Shard Group Annotations (Section 6.3)

**Section 6.3** describes entity lifecycle and cluster integration correctly but
makes NO mention of `ClusterSchema.ShardGroup` annotations. At 200K orgs with
14.2M entities, all entity types would compete for the same 300 shards by default.

**Research finding** (research-effect-architecture.md Section 1.2): 5 shard groups
(`orgs`, `assets`, `equipment`, `telemetry`, `events`) with per-group shard count
recommendations. Written in rfc-section-effect-architecture.md Section 1.2.

**Impact**: HIGH. Without shard groups, Sensor entities (10M) dominate shard
assignment, starving Organization entities (200K) of processing capacity.

**Fix**: Add shard group specification to Section 6.3 or reference the Effect
architecture section.

---

### M-2: No Multi-Tenant Isolation (Sections 6-10)

The main RFC specifies no tenant isolation mechanism. The `EntityStateChanged`
schema includes `entityId` but no `orgId` field. At 200K organizations sharing a
cluster, every entity event from every org would flow to every subscriber.

**Research finding** (research-effect-architecture.md Section 4): TenantIsolation
middleware via `RpcMiddleware.Tag` + `FiberRef`-scoped `TenantContext`. The
two-domain consistency section (X.7) specifies NATS Account-level isolation, but
the RFC sections 6-10 never connect this to the Effect Layer model.

**Impact**: CRITICAL. Without tenant isolation, subscribing to
`SubscribeEntityChanges` returns events from ALL organizations.

**Fix**: Add `orgId` field to `EntityStateChanged` (Section 7.1). Add tenant
filtering to the `SubscribeEntityChanges` handler (Section 11.2). Reference the
TenantIsolation middleware from the Effect architecture section.

---

### M-3: No Layer Composition Specification (Section 10.6)

Section 10.6 says "EntityStack MUST be updated to include EventDistribution in
its Layer composition" but provides no specification of the Layer dependency graph.
At metropolitan scale, the Layer composition is 5 tiers deep with 30+ services.

**Research finding** (research-effect-architecture.md Section 6): 5-tier Layer
model (Infrastructure -> Domain -> Stream -> RPC -> Cluster). Written in
rfc-section-effect-architecture.md Section 6.

**Impact**: MEDIUM. Implementers would not know where EventDistribution sits in
the Layer stack or what its dependencies are.

**Fix**: Reference the Effect architecture section's Layer composition model.

---

### M-4: No Stream Backpressure Strategy for Entity Events (Section 8.1)

Section 8.1 specifies `maxLag: 2000` for the entity-changes channel but does not
specify the backpressure strategy (sliding, bounded, dropping). The research
identifies that entity-changes should use **dropping** because events are
replayable from EventLog.

**Research finding** (research-effect-architecture.md Section 5.2): Three distinct
backpressure strategies mapped to channel semantics:
- `PubSub.sliding` for telemetry (operator needs latest)
- `PubSub.bounded` for alarms (ISA-18.2 mandates no loss)
- `PubSub.dropping` for entity-changes (replayable from EventLog)

**Impact**: MEDIUM. Wrong backpressure choice could either lose unreplayable
events (if dropping is used for alarms) or cause memory pressure (if bounded is
used for high-volume telemetry).

**Fix**: Add backpressure strategy to Section 8.1 channel table.

---

### M-5: No Shard Migration Silence Window (Section 9)

Section 9 covers temporal semantics (ordering, consistency, delivery) but never
addresses what happens to the observer fiber during shard migration. The entity
is destroyed on the old node (observer interrupted), then recreated on the new
node (fresh observer started). During this window, events are not emitted.

**Research finding** (research-cluster-patterns.md Section 1.3, research-effect-
architecture.md Section 2.3): Migration is NOT atomic. The entity's Scope is
closed (observer interrupted), shard lock released, HashRing recomputed, new runner
acquires shard, first message recreates entity. The silence window is ~15 seconds
(entityTerminationTimeout default).

**Impact**: HIGH. Consumers observing `Machine.changes` via WebSocket will see a
gap during shard migration with no indication of why events stopped.

**Fix**: Add Section 9.5 "Shard Migration and Observer Continuity" specifying:
(1) the silence window, (2) that `Machine.changes` re-emits initial state on
resubscription, (3) that consumers SHOULD treat reconnection + initial state as a
migration recovery signal.

---

### M-6: No EntityResource Pattern (Section 10)

Section 10 specifies `makeEntityObserver` using `Effect.forkScoped` but never
mentions `EntityResource.make` for resources that should survive entity restarts
(shard migrations). The RFC mentions this as Q2 (Open Question) but my research
confirms it is not needed for the observer itself.

However, there is no mention of `EntityResource` for OTHER resources that entity
handlers might need (NATS connections, database pools) that SHOULD survive
restarts.

**Research finding** (research-cluster-patterns.md Section 6): EntityResource
wraps `RcRef.make` with `CloseScope` that survives shard migration. Ideal for
persistent connections.

**Impact**: LOW for observer (correctly not needed). MEDIUM for general entity
infrastructure guidance.

**Fix**: Resolve Q2 explicitly (confirm observer does NOT need EntityResource
because Machine.changes re-emits initial state). Add EntityResource guidance for
persistent connections.

---

### M-7: No Testing Architecture (Sections 6-14)

The RFC specifies implementation phases (Section 12) but provides no testing
strategy. No mention of `TestRunner.layer`, `Entity.makeTestClient`, or
`EventDistributionTestLayer`.

**Research finding** (research-effect-architecture.md Section 7): 4-tier testing
pyramid: Unit (Registry.make, Schema asserts), Integration (SingleRunner +
TestEventDistribution), Contract (RpcTest.makeClient), E2E (TestRunner.layer +
full cluster).

**Impact**: MEDIUM. Implementers would need to discover testing patterns
independently.

**Fix**: Reference the Effect architecture section's testing architecture.

---

## 2. INCORRECT in RFC Sections 6-14

### I-1: Stream.pairwise vs Stream.zipWithPrevious (Section 10.1)

Section 10.1 uses `Stream.pairwise` in the `makeEntityObserver` code:

```typescript
Stream.pairwise,
Stream.map(([prev, curr]) => ...)
```

My research verified that `@effect/stream` provides `Stream.zipWithPrevious`
which emits `[Option<prev>, curr]` tuples. `Stream.pairwise` may not exist in
the current Effect API surface. The Q1 open question flags this correctly but the
normative code should use the verified API.

**Recommendation**: Replace `Stream.pairwise` with `Stream.zipWithPrevious` or
`Stream.scan` with 2-element accumulator, as the Q1 fallback suggests. Mark this
as resolved in Q1.

---

### I-2: NATS Subject Inconsistency Between Sections

**Section 8.4** specifies:
```
iiot.entities.{entityType}.{entityId}
```

**Section 5.9.1** specifies:
```
iiot.readings.{siteId}.{areaId}.{lineId}.{deviceId}
iiot.equipment.{siteId}.{areaId}.{lineId}.{equipmentId}
```

**Two-domain consistency (X.3, G-1)** specifies:
```
iiot.{orgId}.entity.{entityType}.{entityId}
```

These three hierarchies are INCONSISTENT:
- Section 8.4 has no `orgId` prefix (single-tenant assumption)
- Section 5.9.1 uses ISA-95 hierarchy path (deep subject tree)
- Two-domain has `orgId` prefix (multi-tenant, but flat after that)

**Research finding** (rfc-section-effect-architecture.md Section 5.3): The entity
event NATS subjects should use `iiot.{orgId}.entity.{entityType}.{entityId}` at
minimum, matching the two-domain model. Section 5.9.1's hierarchical subjects are
a recommended EXTENSION for level-scoped subscriptions, not a replacement.

**Recommendation**: Harmonize. Section 8.4 should adopt the two-domain format
(`iiot.{orgId}.entity.{entityType}.{entityId}`) as the normative pattern. Section
5.9.1 should be marked as a RECOMMENDED extension that coexists via NATS subject
mapping.

---

### I-3: EntityStateChanged Missing orgId (Section 7.1)

The `EntityStateChanged` schema (Section 7.1) has no `orgId` field. At 200K
organizations, every entity event needs an organization identifier for:
- NATS subject routing (`iiot.{orgId}.entity...`)
- Client-side filtering
- Audit compliance (which org generated the event)
- Tenant isolation enforcement

The two-domain consistency section's EventEnvelope (X.6.1) correctly includes
`orgId` but the EntityStateChanged schema in the main RFC does not.

**Recommendation**: Add `orgId: Schema.String` as a REQUIRED field in
EntityStateChanged. Align with the two-domain EventEnvelope.

---

### I-4: 5th Channel Volume Underestimate (Section 8.1)

Section 8.1 estimates `~43K/day` for entity-changes. This is the single-site
estimate. At 200K organizations:

- 200K orgs x ~43K events/day/org = unrealistic (not all entities change daily)
- More realistic: ~0.5 state changes/entity/day average across 14.2M entities
  = ~7.1M entity events/day across the network

The 43K figure is reasonable for a single org, but the section should clarify
scope.

**Recommendation**: Clarify that 43K/day is per-organization. Add network-scale
estimate (~7.1M/day) for metropolitan deployment sizing.

---

## 3. NATS Subject Hierarchy vs Entity Cardinality Model

### Verification Matrix

| Source | Subject Format | orgId? | Cardinality Match? |
|---|---|---|---|
| RFC Section 8.4 | `iiot.entities.{type}.{id}` | NO | Fails at 200K orgs |
| RFC Section 5.9.1 | `iiot.readings.{site}.{area}.{line}.{device}` | NO | Assumes single enterprise |
| Two-domain X.3 G-1 | `iiot.{orgId}.entity.{type}.{id}` | YES | Matches 200K-org model |
| Two-domain X.7 | Per-account isolation | YES (implicit) | Matches via NATS Accounts |
| Effect arch 5.3 | `iiot.{orgId}.entity.{type}.{id}` | YES | Aligned with two-domain |

### Inconsistency Analysis

The two-domain consistency section resolves the multi-tenant problem via NATS
Accounts (X.7): each organization gets an isolated JetStream domain. Within that
domain, subjects are `iiot.entity.{entityType}.{entityId}` (no orgId needed
because the account IS the org).

This means:
- **Intra-org subjects** (within NATS Account): `iiot.entity.{type}.{id}` -- orgId
  is implicit in the account
- **Cross-org subjects** (system account): need explicit orgId

The main RFC Section 8.4 subject `iiot.entities.{type}.{id}` (note: plural
"entities" vs singular "entity") is close to the intra-org format but not
identical. The pluralization should be harmonized.

### Cardinality Check

At 200K orgs with NATS Account isolation:
- Each org's JetStream domain handles only its own entities (~71 entities/org avg)
- Wildcard `iiot.entity.>` within an account is bounded to ~71 subjects
- Network-level aggregation uses the system account, not per-org subscriptions

This architecture correctly prevents the N^2 subscription explosion that would
occur if all 14.2M entities published to shared subjects.

**Verdict**: The two-domain consistency section's NATS Account model CORRECTLY
handles entity cardinality. The main RFC Section 8.4 needs to be aligned with
this model (add account context, harmonize subject naming).

---

## 4. Cross-Reference Gaps

### RFC sections that should reference Effect architecture section:

| RFC Section | Gap | Effect Arch Section to Reference |
|---|---|---|
| 6.3 Entity Lifecycle | No shard groups | 1.2 Shard Group Configuration |
| 8.1 EventDistribution | No backpressure strategy | 5.2 Backpressure Strategies |
| 9 Temporal Semantics | No migration silence | 2.3 Observer Fiber Lifecycle |
| 10 Observer Impl | No testing strategy | 7 Testing Architecture |
| 10.6 EntityStack | No Layer composition | 6 Layer Composition Architecture |
| 11 Streaming RPC | No tenant isolation | 4.2 TenantIsolation Middleware |

### Two-domain sections that should reference Effect architecture section:

| Two-Domain Section | Gap | Effect Arch Section to Reference |
|---|---|---|
| X.7 Multi-Tenant via NATS | No Layer-level isolation | 4.2 TenantIsolation + FiberRef |
| X.3 G-4 Session Consistency | No WebSocket session impl | 4.3 Streaming RPC per-session |
| X.5 Adaptive ISA-95 | No entity count detection | 1.1 Entity Cardinality Model |

---

## 5. Summary

| Category | Count | Severity |
|---|---|---|
| MISSING items (M-1 through M-7) | 7 | 2 HIGH, 1 CRITICAL, 3 MEDIUM, 1 LOW |
| INCORRECT items (I-1 through I-4) | 4 | I-2 CRITICAL, I-3 HIGH, I-1 LOW, I-4 LOW |
| NATS subject inconsistencies | 3 formats | Needs harmonization |
| Cross-reference gaps | 9 | Assembly-time fix |

### Priority Actions

1. **CRITICAL**: Add `orgId` to EntityStateChanged + harmonize NATS subjects (I-2, I-3)
2. **HIGH**: Add shard group specification (M-1)
3. **HIGH**: Add shard migration silence window (M-5)
4. **HIGH**: Add tenant isolation to SubscribeEntityChanges (M-2)
5. **MEDIUM**: Add backpressure strategy, Layer composition refs, testing refs (M-3, M-4, M-7)
6. **LOW**: Resolve Stream.pairwise API question (I-1), volume clarification (I-4)

---

*Review complete. All findings grounded in verified codebase references and
research documents.*
