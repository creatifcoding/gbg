# RFC-0001 — DMN: Domain Module Network

Status: draft

## 1. Context

TMNL has several mature but domain-specific implementation patterns in `packages/tmnl/src/lib/iiot`: Effect Schema contracts, SQL DDL and migrations, repositories, state services, machines, Effect Cluster entities, event handlers, graph projections, Reactor policies, adapters, and test stacks. These patterns are valuable beyond IIoT.

DMN is therefore not an industrial message bus. DMN is the **Domain Module Network**: a generic domain-module substrate that extracts those latent patterns into reusable Effect v4-native factories, capability modules, manifests, and runtime bindings.

IIoT becomes the first substantial domain pack implemented on top of DMN, not the definition of DMN.

## 2. Naming decision

**DMN means Domain Module Network.**

Avoid these older or narrower meanings:

- Data/Message Network;
- Industrial DMN;
- IIoT DMN;
- broker;
- message bus.

The name is intentionally module-centered because DMN must cover more than messages: schemas, persistence, migrations, repositories, entities, machines, handlers, projections, policies, adapters, runtime layers, and view-agent capabilities.

## 3. Core concepts

### 3.1 Domain Module

A **Domain Module** is a bounded, reusable domain surface expressed through DMN. Examples:

- IIoT / plant operations;
- GEOINT;
- trading;
- SDR/radio;
- future domain packs.

A Domain Module is not merely a folder or message namespace. It composes reusable **Capability Modules** and exposes a coherent domain manifest.

### 3.2 Capability Module

A **Capability Module** is a reusable DMN building block that may be composed into multiple Domain Modules. Candidate capability modules extracted from IIoT precedent include:

- Schema Pack;
- DDL / Migration Pack;
- Repository;
- Persistence authority ports and adapters;
- Event journal / audit trail;
- Checkpoint / claim stores;
- State Service;
- Machine / Statechart;
- Entity Lifecycle;
- Handler Group;
- Projection;
- Reaction Policy;
- Adapter;
- Test Harness;
- View Agent compatibility seams.

### 3.3 EVA — Entity View Agent

DMN should remain compatible with a future **EVA — Entity View Agent** system, but EVA is not a near-term DMN responsibility.

EVA generalizes the existing AVA precedent:

- **AVA — Asset View Agent**: asset-centered view-agent modality.
- **EVA — Entity View Agent**: entity-centered view-agent modality that can apply across DMN Domain Modules.

EVA is not a rename-only exercise. It keeps the AVA insight — an agent synthesizes, governs, and evolves live views — but removes the assumption that the viewed thing must be an asset. For now, DMN should avoid absorbing EVA. DMN should instead expose clean domain contracts, ports, streams, and projections that a separate EVA system could consume later.

## 4. Hexagonal alignment

DMN should align with idealized hexagonal architecture:

```text
Domain Module
  ├─ Core contracts
  │   ├─ schemas
  │   ├─ commands/events
  │   ├─ machines
  │   └─ policies
  ├─ Ports
  │   ├─ repositories
  │   ├─ event journal
  │   ├─ stream bindings
  │   ├─ transport bindings
  │   ├─ view agents
  │   └─ adapters
  └─ Adapters
      ├─ SQL / migrations
      ├─ MSH / NATS / JetStream / KV
      ├─ PCT schema/procedure registry
      ├─ LNK durable streams
      ├─ protocol SDKs
      └─ UI / STX / effect-atom consumers
```

Dependency direction should remain inward:

```text
schemas / pure declarations
  ← services / ports
  ← adapters / infrastructure
  ← application edges
```

### 4.1 Persistence authority posture

DMN should not mandate one durable store. It should provide **Persistence Capability Modules**: generic ports and factories for durable authority surfaces, plus first-party adapters where existing IIoT precedent proves the shape.

Candidate persistence capabilities:

- `defineMigrationPack`;
- `defineModelBinding`;
- `defineRepository`;
- `defineEventJournalPort`;
- `defineAuditTrail`;
- `defineCheckpointStore`;
- `defineClaimStore`;
- retention/archive stores for stream-heavy domains.

SQL/EventJournal should be first-party implementations, not mandatory core assumptions. IIoT can require SQL/EventJournal authority; GEOINT, trading, and SDR/radio may bind different storage authorities while still conforming to DMN ports.

### 4.2 Reaction Policy posture

DMN should generalize the current IIoT Reactor into a **Reaction Policy** capability.

A Reaction Policy observes durable signals, classifies eligibility, applies admission control, records idempotency state, and dispatches only to target-owned authority. It is not a workflow engine and it is not a projection handler mutation loophole.

Candidate Reaction Policy surfaces:

- `ObservationSpec` — durable event or signal to semantic observation;
- `PropagationPolicy` — relationship/policy rules for where pressure can flow;
- `AdmissionControl` — lane/feature/candidate gating;
- `ClaimStore` — idempotent source-entry ownership and recovery;
- `CheckpointStore` — replay/delivery dedupe;
- `ConstraintAuthority` — exact constraints and retractions where required;
- `TargetReactionContract` — target-owned classify/dispatch capability.

The IIoT **Reactor** remains the concrete precedent and product name for the existing implementation. The generic DMN capability should be called Reaction Policy.

## 5. Relationship to MSH / PCT / LNK

DMN sits above MSH, PCT, and LNK. It composes them natively without collapsing their boundaries.

```text
@tmnl/msh  → mesh substrate: NATS, auth, subjects, JetStream/KV, tracing
@tmnl/pct  → schema/procedure registry and control-plane contracts
@tmnl/lnk  → durable typed streams, offsets, producer fencing, STX materializers
@tmnl/dmn  → domain module factories, manifests, capability modules, runtime assembly
```

MSH must not learn domain semantics. PCT must not become the domain model. LNK must not become a domain event journal. DMN owns the domain-module composition layer.

## 6. Candidate package topology

Preferred topology:

```text
packages/dmn/              generic Domain Module Network core
packages/dmn-iiot/         IIoT / plant-ops domain pack
packages/dmn-geoint/       future GEOINT domain pack
packages/dmn-trading/      future trading domain pack
packages/dmn-sdr/          future SDR/radio domain pack
```

Domain packs may begin inside TMNL while the factory surface is under discovery, but the target shape should keep generic DMN core separate from domain semantics.

## 7. Factory surface hypothesis

DMN should start with small orthogonal factories plus a manifest composer, not one all-powerful `defineDomain` DSL.

```ts
const WorkOrderModule = defineDomainModule({
  id: "work-order",
  schemas: defineSchemaPack({...}),
  persistence: definePersistencePack({
    migrations: defineMigrationPack({...}),
    repo: defineRepository({...}),
    eventJournal: defineEventJournalPort({...}),
    auditTrail: defineAuditTrail({...}),
  }),
  state: defineStateService({...}),
  machine: defineMachine({...}),
  entity: defineEntity({...}),
  handlers: defineHandlerGroup({...}),
  reactions: defineReactionPolicy({...}),
})
```

This keeps the extraction grounded in real IIoT pressure while preserving the ability to use only the capabilities a given domain needs. For example, PackML may need schema + machine/statechart + projection capabilities without entity lifecycle authority.

## 8. IIoT extraction pressure

IIoT is the proving ground because it already contains full-chain canonical examples:

- Alarm;
- WorkOrder;
- EquipmentState;
- asset hierarchy;
- EventJournal integration;
- relationship graph projections;
- Reactor structural consistency policies;
- ingestion adapters;
- SQL-backed authority.

The extraction should examine each piece conceptually and implementation-wise, then rework it into DMN where the abstraction proves reusable.

## 9. Initial implementation strategy

Recommended first implementation path:

1. Finish brownfield map of IIoT surfaces.
2. Choose one complete vertical slice, likely WorkOrder or Alarm.
3. Extract only the factories needed to rebuild that slice cleanly in DMN.
4. Reimplement the slice on DMN.
5. Compare golden traces against the current IIoT behavior.
6. Repeat with the next canonical slice.

Avoid designing the entire DMN factory universe before one real domain slice survives contact with code.

## 10. Open questions

1. Which vertical slice proves DMN first: WorkOrder, Alarm, or EquipmentState?
2. What is the exact boundary between Reactor as a DMN capability module and Reactor as IIoT-specific structural policy?
3. What minimum compatibility seams should DMN expose so a future EVA system can consume Domain Modules cleanly?
4. Which parts of current IIoT stay as host application integration rather than moving into `dmn-iiot`?
5. What is the minimum MSH/PCT/LNK binding needed for the first vertical slice?
6. Which parts of IIoT Reactor become generic Reaction Policy factories, and which remain IIoT-specific policy declarations?
