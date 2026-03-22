# RFC-001 Section: Migration & Upgrade Strategy

```
Section:       Migration & Upgrade Strategy
Parent RFC:    RFC-001 (Entity Lifecycle Event Distribution)
Status:        DRAFT
Author:        Val (marketplace-writer)
Created:       2026-02-09
Dependencies:  Section 15 (Edge-First Architecture)
               Section 16 (Deployment Topology)
               Section DX (Developer Experience)
               Section FM (Failure Modes & Recovery)
Research Base: rfc-section-edge-architecture-v2.md (15.6 Brownfield, 15.9 Progressive Enhancement)
               rfc-section-onboarding-protocol.md (Integration Patterns)
               rfc-section-deployment-topology.md (16.5 Upgrade and Migration)
               src/lib/iiot/adapters/ (ingestion pipeline)
Bibliography:  docs/specifications/bibliography.md
```

---

## MIG.1 Scope

This section specifies migration and upgrade procedures for organizations
joining the TMNL manufacturing commons or evolving their deployment. It covers
brownfield integration with existing industrial systems, tier promotion paths,
schema evolution, zero-downtime edge agent upgrades, and rollback procedures.

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this section are to be
interpreted as described in [RFC-2119].

**Cross-references**:
- Section 15 (Edge-First Architecture) defines the four-tier capability model
  and brownfield integration phases [15.6]
- Section 16 (Deployment Topology) defines NATS topology and cluster profiles
- Section DX (Developer Experience) defines SDK and CLI tooling
- Section FM (Failure Modes) defines recovery procedures referenced by rollback

---

## MIG.2 Conventions

| Term | Definition |
|------|-----------|
| **Brownfield** | Existing industrial installation with SCADA, PLC, or historian infrastructure |
| **Greenfield** | New installation without legacy systems |
| **Tier promotion** | Upgrading edge deployment from lower to higher capability tier (T0-T3) |
| **Schema version** | Integer version embedded in event payloads (`schemaVersion` field) |
| **Rolling upgrade** | Replacing edge agent instances one at a time with zero aggregate downtime |
| **Strangler fig** | Incremental replacement pattern: observe, augment, replace [FOWLER-POEAA] |

---

## MIG.3 Brownfield Integration

### MIG.3.1 The Strangler Fig Pattern

Organizations with existing SCADA, MES, or historian infrastructure MUST be
able to adopt the platform incrementally without disrupting production. The
platform implements the strangler fig pattern [FOWLER-POEAA] in three phases:

```
Phase 1: OBSERVE         Phase 2: AUGMENT          Phase 3: REPLACE
(read-only, 1-2 weeks)   (side-by-side, 2-8 weeks) (controlled cutover)

Existing SCADA            Existing SCADA             PLCs/Sensors
  (unchanged)               (still primary)              │
      │                         │                         ▼
      ▼                         ▼                    Sparkplug Adapter
Sparkplug Adapter         Sparkplug Adapter              │
      │                         │                         ▼
      ▼                         ▼                    NATS + Entity System
   NATS                  NATS + Entity System          (primary)
      │                    (shadow mode)                  │
      ▼                         │                         ▼
T0 Dashboard              T0/T2 Dashboard             Operators
(read-only overlay)       (analytics + alarms)
```

**Phase constraints**:

- Phase 1 MUST NOT require changes to existing PLC/SCADA configuration. The
  `SparkplugAdapterLive` (`lib/iiot/adapters/sparkplug-adapter.ts:406-495`)
  passively subscribes to existing MQTT topics as a read-only consumer.
- Phase 2 MUST NOT interfere with existing control loops. Entity processing
  operates in observation mode only.
- Phase 3 cutover is organization-controlled. The platform MUST NOT require
  organizations to decommission legacy systems. Organizations MAY remain in
  Phase 2 indefinitely (dual-system operation).

### MIG.3.2 Protocol Adapter Matrix

Implementations MUST provide protocol adapters conforming to the
`IngestionAdapter` interface (`lib/iiot/adapters/ingestion.ts:25-36`). Each
adapter normalizes protocol-specific telemetry into `IngestedReading` instances:

| Existing Protocol | Adapter | Min Tier | Integration Method |
|-------------------|---------|----------|-------------------|
| Sparkplug B (MQTT) | `SparkplugAdapterLive` | T1 | Direct MQTT subscription [SPARKPLUG-B] |
| OPC UA | `OpcUaAdapter` (planned) | T2 | UA client Browse + MonitoredItems [OPC-UA-14] |
| Modbus TCP/RTU | `ModbusAdapter` (planned) | T2 | Polling with configurable interval |
| BACnet/IP | `BacnetAdapter` (planned) | T2 | BACnet subscription |
| Proprietary PLC | Custom adapter | T2 | Organization-specific development |
| CSV/Historian export | `FileAdapter` (planned) | T1 | File watch + batch import |

All adapters MUST implement the `IngestionAdapter` service interface:

```typescript
// lib/iiot/adapters/ingestion.ts — protocol-agnostic interface
interface IngestionAdapterShape {
  readonly protocol: string
  readonly subscribe: Effect<Stream<IngestedReading, IngestionError>>
  readonly healthCheck: Effect<IngestionHealth, IngestionError>
}
```

### MIG.3.3 Sparkplug-B Migration from Existing MQTT Brokers

Organizations with existing MQTT brokers SHOULD migrate to Sparkplug-B
semantics for automatic device discovery. The migration path:

1. **Assess**: Identify existing MQTT topic structure and payload format.
2. **Bridge**: Deploy T1 edge agent with `SparkplugAdapterConfig`
   (`lib/iiot/adapters/sparkplug-adapter.ts:56-68`) pointing to the existing
   MQTT broker URL.
3. **Discover**: The adapter subscribes to `spBv1.0/{groupId}/#` topics.
   NBIRTH/DBIRTH messages register device aliases via `makeAliasRegistry`
   (`lib/iiot/adapters/sparkplug-adapter.ts:79-111`).
4. **Validate**: Confirm DDATA messages flow through `processMessage`
   (`lib/iiot/adapters/sparkplug-adapter.ts:228-344`) and produce
   `IngestedReading` instances.
5. **Consolidate**: Once validated, configure additional `groupIds` to
   cover all Sparkplug groups on the broker.

For non-Sparkplug MQTT installations, organizations MUST either:
- Deploy a Sparkplug-compliant edge node (e.g., Eclipse Tahu, Cirrus Link)
  that bridges raw MQTT to Sparkplug-B format, OR
- Implement a custom `IngestionAdapter` that normalizes their MQTT topic
  structure to `IngestedReading`.

### MIG.3.4 OPC UA Brownfield Integration

Organizations with OPC UA servers [OPC-UA-14] follow an analogous pattern:

1. **Discover**: The OPC UA adapter browses the server address space via
   mDNS or configured endpoint URL.
2. **Map**: OPC UA node IDs map to TMNL entity IDs:
   ```
   OPC UA:  ns=2;s=PLC1.Motor1.Temperature
   TMNL:    Sensor { deviceId: "PLC1-Motor1-Temperature" }
   ```
3. **Subscribe**: MonitoredItem subscriptions provide continuous data change
   notifications, normalized to `IngestedReading`.
4. **Coexist**: The OPC UA server continues serving existing HMI/SCADA
   clients. The adapter adds a parallel data consumer without displacement.

### MIG.3.5 Modbus and Proprietary Protocol Integration

For Modbus TCP/RTU and proprietary PLC protocols, the adapter MUST:

- Poll at configurable intervals (RECOMMENDED: 1-10 seconds for process data)
- Map register addresses to `IngestedReading` topics via configuration
- Handle register data type conversion (INT16, FLOAT32, etc.)
- Report connection health via `healthCheck`

The polling adapter template follows the same `IngestionAdapter` interface,
ensuring uniform pipeline integration through `IngestionServiceLive`
(`lib/iiot/adapters/ingestion-service.ts:184-188`).

---

## MIG.4 Tier Promotion Paths

### MIG.4.1 Promotion Overview

Edge deployments progress through capability tiers as organizations scale.
Each promotion adds Layer composition capabilities without requiring a full
redeployment [EFFECT-LAYER]:

```
T0 ──► T1 ──► T2 ──► T3
 │       │       │       │
 │       │       │       └── + HolonetBridgeLive, HttpApiLayer
 │       │       └────────── + SingleRunner, EntityHandlers, EventDistribution, WebSocket
 │       └────────────────── + SparkplugPipelineLayer (ingestion + alarm detection)
 └────────────────────────── Browser-only (WebSocket consumer)
```

### MIG.4.2 T0 to T1: Adding Protocol Bridge

**Prerequisites**: Physical hardware (Raspberry Pi 4/5 or equivalent SBC,
$50-200) and network access to MQTT broker or OPC UA server.

**Procedure**:

1. Flash edge agent image to microSD/eMMC (Nix-based: `nix/default.nix`
   imports `nix/modules/sparkplug.nix` for Sparkplug tooling).
2. Configure `SparkplugAdapterConfig` with broker URL and group IDs.
3. Connect to network. The agent boots with the T1 Layer stack:
   ```
   SparkplugAdapterLive + ReadingProcessorLive + AlarmDetectorLive
   = SparkplugPipelineLayer (lib/iiot/adapters/ingestion-service.ts:297-322)
   ```
4. Verify readings via `nats sub "iiot.readings.>"` from the NATS CLI
   (`nix/modules/core.nix` provides `natscli` in the dev shell).

**Data migration**: None required. T0 has no local state.

**Rollback**: Power off the T1 device. T0 browser clients continue functioning
against any remaining T2/T3/cloud endpoints.

### MIG.4.3 T1 to T2: Adding Entity Processing

**Prerequisites**: Hardware upgrade to industrial gateway ($500-2,000) with
4+ GB RAM and persistent storage.

**Procedure**:

1. Deploy T2 image with expanded Layer stack:
   ```
   SparkplugPipelineLayer
   + SingleRunner.layer       ← local entity processing
   + EntityHandlersLayer      ← asset entity state machines
   + EventDistributionLayer   ← 4-channel event broadcast
   + WebSocketServerLayer     ← local WebSocket for T0 clients
   ```
2. Initialize JetStream domain for local event persistence.
3. Replay any buffered readings from T1's NATS leaf node into the entity
   system. The T1 node SHOULD have been configured with JetStream retention
   to buffer readings during the transition window.
4. Validate entity state convergence: compare entity state snapshots before
   and after promotion.

**Data migration**:

- **JetStream streams**: T1 MAY have a local JetStream domain with buffered
  readings. These MUST be replayed into T2's entity system before the T1
  buffer is decommissioned.
- **NATS KV state**: Host application state from `makeStateRegistryKV`
  (`lib/iiot/adapters/sparkplug-adapter.ts:191-207`) persists in the
  `iiot-state` KV bucket. This MUST be migrated to the T2's KV store.
- **Entity snapshots**: Not applicable (T1 has no entity state).

**Rollback**: Revert Layer stack to T1 configuration. Entity state is lost
but readings continue flowing.

### MIG.4.4 T2 to T3: Adding Cluster and Federation

**Prerequisites**: Rack server or VM cluster ($5,000-50,000+) with 16+ GB
RAM and multi-core CPU.

**Procedure**:

1. Deploy T3 image with full Layer stack including cluster:
   ```
   SparkplugPipelineLayer
   + SocketRunner.layer({ host: "0.0.0.0", port: 34437 })  ← cluster runner
   + EntityHandlersLayer
   + EventDistributionLayer
   + WebSocketServerLayer
   + HolonetBridgeLive     ← cross-org federation
   + HttpApiLayer           ← REST API for integrations
   ```
2. Migrate entity shards from `SingleRunner` to `SocketRunner`. The
   `@effect/cluster` HashRing [EFFECT-HASHRING] handles shard rebalancing.
3. Configure NATS super-cluster leaf node connection to the metropolitan hub.
4. Enable HolonetBridge for cross-org event federation.

**Data migration**:

- **Entity state**: @effect/cluster performs automatic shard migration via
  HashRing. Entity state is preserved during runner transition (see FM.9.1.3
  chaos engineering scenario: zero event loss during migration).
- **JetStream streams**: T2's JetStream domain is promoted to a full
  super-cluster participant. Existing stream data is retained.

**Rollback**: Revert to `SingleRunner.layer`. Cluster shards collapse back
to local processing. Federation connections are dropped gracefully.

---

## MIG.5 Schema Evolution and Backward Compatibility

### MIG.5.1 Event Schema Versioning

All event payloads MUST include a `schemaVersion` integer field. The current
codebase uses `schemaVersion: 1` throughout the event system
(`lib/iiot/services/l2/alarm-event-emitter.ts:122,181,229`).

**Version contract**:

- Consumers MUST accept events with `schemaVersion <= currentVersion`.
- Producers MUST emit events at the latest `schemaVersion`.
- Schema changes MUST be backward-compatible within a major version:
  new fields MAY be added; existing fields MUST NOT be removed or renamed.

### MIG.5.2 Effect Schema Transformation Pipeline

Schema evolution leverages Effect Schema's transformation capabilities
[EFFECT-SCHEMA]. For version migrations:

```typescript
// Version 1 → Version 2 transformation
const AlarmEventV1 = Schema.Struct({
  _tag: Schema.Literal("AlarmEvent"),
  schemaVersion: Schema.Literal(1),
  alarmId: Schema.String,
  severity: Schema.Literal("low", "medium", "high", "critical"),
  // ...
})

const AlarmEventV2 = Schema.Struct({
  _tag: Schema.Literal("AlarmEvent"),
  schemaVersion: Schema.Literal(2),
  alarmId: Schema.String,
  severity: Schema.Literal("low", "medium", "high", "critical"),
  priority: Schema.optional(Schema.Number),  // NEW in v2
  // ...
})

// Decoder accepts both versions
const AlarmEventAny = Schema.Union(AlarmEventV1, AlarmEventV2)
```

### MIG.5.3 JetStream Stream Migration

When schema versions change, JetStream streams containing historical events
MUST remain readable. Implementations MUST follow these rules:

- **Additive changes** (new optional fields): No stream migration required.
  Existing events decode correctly with the new schema (missing fields default
  to `undefined`).
- **Structural changes** (field renames, type changes): Deploy a stream
  transformer that reads from the old stream and writes to a new stream with
  transformed payloads. The old stream MUST be retained for the configured
  retention period.
- **Breaking changes**: MUST NOT be performed on production streams without
  a major version bump. Breaking changes require a new stream name
  (e.g., `iiot-events-v2`) and a parallel consumer migration period.

### MIG.5.4 NATS KV Schema Migration

KV buckets (e.g., `iiot-state` used by `makeStateRegistryKV`) follow the
same versioning discipline:

- KV entries SHOULD include a version field in the stored schema
  (`HostStateEntry` at `lib/iiot/adapters/sparkplug-adapter.ts:172-175`).
- Migrations are performed by reading all keys, transforming values, and
  writing back. NATS KV revision numbers provide optimistic concurrency
  control during migration.

---

## MIG.6 Zero-Downtime Edge Agent Upgrades

### MIG.6.1 Rolling Upgrade Pattern

Edge agents MUST support zero-downtime upgrades. The platform uses a
rolling upgrade strategy:

```
Time ──────────────────────────────────────────────────►

Agent v1.2 ████████████████████████░░░░░░░░░░░░  (draining)
                                    ▲
                                    │ health check passes
                                    │
Agent v1.3 ░░░░░░░░░░░░░░░░░░░░░░░░████████████  (receiving)

NATS subscription: continuous — leaf node handles reconnect
JetStream: no data loss — consumer ack-wait covers the gap
```

**Procedure for T1 (single-instance)**:

1. Deploy new agent binary alongside the running instance.
2. Start new instance on a different port. Wait for health check to pass.
3. Redirect NATS leaf node connection to new instance.
4. Drain old instance: stop accepting new subscriptions, flush pending acks.
5. Terminate old instance after drain completes.

**Procedure for T2/T3 (entity processing)**:

1. For `SingleRunner` (T2): Stop entity processing, upgrade agent, restart.
   Entity state is persisted in JetStream; entities resume from last
   checkpoint on restart.
2. For `SocketRunner` (T3): Perform rolling upgrade across cluster nodes.
   @effect/cluster rebalances shards as nodes leave and rejoin
   [EFFECT-HASHRING]. At least one node MUST remain available throughout.

### MIG.6.2 Nix-Based Reproducible Deployments

Edge agent builds SHOULD use Nix for reproducible, atomic deployments. The
project's Nix configuration (`nix/default.nix`) composes modules for each
deployment concern:

| Module | Purpose |
|--------|---------|
| `nix/modules/core.nix` | Base tooling: git, natscli, nats-server, ripgrep |
| `nix/modules/sparkplug.nix` | Sparkplug adapter scripts and test tooling |
| `nix/modules/tauri.nix` | Desktop application build (T0/T2 with UI) |
| `nix/modules/embedded.nix` | Embedded/constrained device toolchains |
| `nix/modules/tests.nix` | Test suite configuration |

Nix provides atomic profile switching: the new version is built in isolation,
then a single `nix-env --switch-generation` atomically activates it. Rollback
is `nix-env --rollback` -- instant, no rebuild required.

### MIG.6.3 Canary Deployment for Multi-Org Updates

Platform-wide updates (affecting the NATS super-cluster or shared
infrastructure) MUST use canary deployment:

1. **Canary ring** (1% of organizations): Deploy update to a small subset.
   Monitor for 24 hours.
2. **Early adopter ring** (10%): Expand deployment. Monitor for 48 hours.
3. **General availability** (100%): Roll out to all organizations.

Each ring MUST meet the following gate criteria before promoting:
- Zero increase in error rate (compared to baseline)
- All SLOs within budget (see Section MON)
- No entity state corruption detected (see Section OBS)

---

## MIG.7 Rollback Procedures

### MIG.7.1 Edge Agent Rollback

| Tier | Rollback Method | Data Impact |
|------|----------------|-------------|
| T0 | Browser cache clear + reload | None (stateless) |
| T1 | Nix generation rollback or binary swap | Buffered readings may replay |
| T2 | Nix rollback + entity checkpoint restore | Entities resume from last checkpoint |
| T3 | Rolling cluster rollback (node-by-node) | Shard rebalancing via HashRing |

### MIG.7.2 Rollback Decision Criteria

Operators MUST initiate rollback when ANY of the following conditions persist
for more than 15 minutes after deployment:

- Error rate exceeds 2x the pre-deployment baseline
- Entity state divergence detected between replicas
- JetStream consumer lag exceeds 60 seconds (G-1 violation)
- Health check failure rate exceeds 5% of monitored endpoints

### MIG.7.3 Schema Rollback

Schema version rollback is constrained:

- **Additive changes** (v1 -> v2 added optional fields): Rollback is safe.
  v1 consumers ignore unknown fields.
- **Non-additive changes**: Rollback requires the v1 consumer to handle v2
  events gracefully. Implementations MUST test forward compatibility before
  deploying schema changes.
- **JetStream streams**: Historical events at the newer schema version remain
  in the stream. Rolled-back consumers MUST use `Schema.Union` to decode
  both versions (see MIG.5.2).

### MIG.7.4 Tier Demotion

Tier demotion (e.g., T3 -> T2) is the inverse of promotion:

1. Disable higher-tier Layer components (HolonetBridge, HttpApi).
2. Collapse cluster runner to single runner.
3. Disconnect NATS super-cluster leaf node (operate locally).

Demotion MUST preserve local entity state and JetStream streams. Cross-org
federation state is lost but can be re-established on re-promotion.

---

## MIG.8 Codebase Grounding

| Concept | Implementation | File Reference |
|---------|---------------|----------------|
| Protocol adapter interface | `IngestionAdapter` service + `IngestedReading` schema | `lib/iiot/adapters/ingestion.ts:25-36` |
| Sparkplug adapter | `SparkplugAdapterLive`, `SparkplugAdapterKVLive` | `lib/iiot/adapters/sparkplug-adapter.ts:406-595` |
| Sparkplug config | `SparkplugAdapterConfig` schema | `lib/iiot/adapters/sparkplug-adapter.ts:56-68` |
| Alias registry | `makeAliasRegistry` (metric alias resolution) | `lib/iiot/adapters/sparkplug-adapter.ts:79-111` |
| KV state registry | `makeStateRegistryKV` (NATS KV persistence) | `lib/iiot/adapters/sparkplug-adapter.ts:191-207` |
| Pipeline orchestrator | `IngestionServiceLive` | `lib/iiot/adapters/ingestion-service.ts:184-188` |
| Sparkplug pipeline | `SparkplugPipelineLayer` (full adapter stack) | `lib/iiot/adapters/ingestion-service.ts:297-322` |
| Dev pipeline | `IngestionPipelineDevLayer` (mock adapter) | `lib/iiot/adapters/ingestion-service.ts:244-269` |
| Schema versioning | `schemaVersion: 1` in event payloads | `lib/iiot/services/l2/alarm-event-emitter.ts:122` |
| Nix modules | Core, sparkplug, tauri, embedded, tests | `nix/default.nix`, `nix/modules/*.nix` |
| Retry schedule | Exponential backoff for reconnection | `lib/iiot/adapters/sparkplug-adapter.ts:383-386` |
| Message processing | `processMessage` (all Sparkplug message types) | `lib/iiot/adapters/sparkplug-adapter.ts:228-344` |

---

## MIG.9 References

| Key | Reference |
|-----|-----------|
| [RFC-2119] | Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels." BCP 14, RFC 2119, 1997. |
| [SPARKPLUG-B] | Eclipse Foundation. "Eclipse Sparkplug Specification v3.0.0." 2023. |
| [OPC-UA-14] | OPC Foundation. "OPC Unified Architecture -- Part 14: PubSub." IEC 62541-14:2020. |
| [EFFECT-LAYER] | Effect Contributors. "effect/Layer -- Dependency Injection with Memoization and Scoping." |
| [EFFECT-SCHEMA] | Effect Contributors. "effect/Schema -- Runtime Validation with Type-Level Inference." |
| [EFFECT-HASHRING] | Effect Contributors. "effect/HashRing -- Consistent Hashing Implementation." |
| [FOWLER-POEAA] | Fowler, M. *Patterns of Enterprise Application Architecture.* Addison-Wesley, 2002. |
| [ISA-95-1] | ANSI/ISA-95.00.01-2010 (IEC 62264-1). "Enterprise-Control System Integration -- Part 1." |
