# RFC: System Capability Audit — PCT / LNK / MSH / STX

Status: draft
Purpose: distinguish platform substance from architectural costume jewelry.

## Correction

Frame projections are not the feature to put on trial. The demand profile is
already established:

- multi-source temporal coherence;
- replay/idempotency;
- historical read/read-model performance;
- schema-versioned derived contracts;
- multiple consumers needing the same coherent shape.

That combination makes explicit frame projections a platform capability, not a
speculative flourish. The right audit target is the whole system surface: which
features reinforce the platform thesis, which features are duplicated seams, and
which features should stay narrow until repetition earns generalization.

## System thesis

The platform is becoming a contract-first, replay-safe, federated runtime for
typed operational data products.

```text
PCT  = contracts, registry, identity, control plane, derived-data specs
LNK  = durable typed streams and durable wire semantics
MSH  = NATS/Auth/JetStream/KV/micro substrate
STX  = local/client state substrate where React or tooling needs reactive state
SQL  = materialized read models and analytics, not source-of-truth semantics
```

The system is complex because the domain is complex. The risk is not complexity
itself. The risk is **unowned complexity**: features whose owner, consumer,
failure mode, and downgrade path are unclear.

## Evaluation rubric

A capability is justified when it scores strongly on at least three axes:

| Axis | Question |
| --- | --- |
| Consumer pressure | Does more than one real consumer want this shape? |
| Semantic compression | Does it remove repeated bespoke logic from consumers? |
| Durability/replay | Does correctness require recovery, offset/idempotency, or provenance? |
| Contract value | Does it need schema/version/discovery/governance? |
| Operational leverage | Does it enable deployment, inspection, migration, or debugging? |
| Boundary hygiene | Does it reduce coupling between PCT/LNK/MSH/STX instead of smearing it? |

A capability is suspicious when it mainly provides naming, aesthetic symmetry, or
future optionality without a repeated consumer.

## Capability map

| Capability | Owner | Justification | Maintenance cost | Verdict |
| --- | --- | --- | --- | --- |
| Effect v4 strict package islands | All strict packages | Prevents v3/v4 bridge rot and dependency ambiguity. | Medium | Keep, non-negotiable. |
| MSH NATS connection layer | MSH | Shared substrate for NATS connectivity, options, lifecycle. | Low/medium | Keep. |
| MSH NATS auth/JWT/token support | MSH | Real deployments need identity/auth; NATS auth is not a PCT concern. | Medium | Keep, but keep policy-free. |
| MSH JetStream stream helpers | MSH | LNK needs substrate access without owning NATS client internals. | Medium | Keep substrate-only. |
| MSH KV CAS substrate | MSH | Enables LNK metadata and fencing primitives over NATS KV. | Medium | Keep, but no LNK semantics here. |
| MSH subject registry/conventions | MSH | Avoids subject string chaos and validates substrate naming. | Low | Keep. |
| MSH micro endpoint host | MSH | Generic schema-backed request/reply host; reused by PCT control plane. | Low/medium | Keep; proven useful. |
| MSH tracing spans | MSH | Observability seam; useful across substrate calls. | Low | Keep, light. |
| LNK core typed streams | LNK | Central product capability: typed append/read/subscribe. | Medium | Keep, crown jewel. |
| LNK `TypedLnk` over `SchemaResolver` | LNK | Keeps typed consumption stable while PCT resolver can vary. | Medium | Keep. |
| LNK in-memory wire | LNK | Fast tests, reference semantics. | Low | Keep. |
| LNK HTTP wire | LNK | Simple deployment/debug path and existing compatibility. | Medium | Keep unless NATS fully supersedes consumer demand. |
| LNK MSH/NATS bridge wire | LNK | Durable distributed runtime over NATS/JetStream. | High | Keep; this is production substrate. |
| LNK `NatsBridgeWire` compatibility alias | LNK | Migration affordance. | Low now, grows with time | Keep temporarily; schedule removal after users migrate. |
| LNK CAS append kernel | LNK | Durable offset/idempotency correctness. | High but essential | Keep. |
| LNK shard guard/fencing | LNK | Prevents split-brain producer corruption. | Medium/high | Keep if bridge is production. |
| LNK batch publisher naming | LNK | Transport optimization concept. | Medium | Rename/align to frame only where semantic; keep batch if truly transport-only. |
| PCT procedure/manifest registry | PCT | Contract discovery and typed operation publishing. | Medium | Keep. |
| PCT notary/signature model | PCT | Trust/provenance for published contracts. | Medium | Keep, but avoid overbuilding policy until deployment requires it. |
| PCT identity providers | PCT | Needed for signed/federated artifacts. | Medium | Keep. |
| PCT federation sync/delta/eventlog remote | PCT | Supports distributed contract registry. | High | Keep as strategic; harden only along real peer scenarios. |
| PCT Config module | PCT | Centralizes runtime shape and prevents env/config scattering. | Medium | Keep. |
| PCT CLI `serve` | PCT | Operational entrypoint for HTTP/NATS control plane. | Medium | Keep. |
| PCT NATS control plane | PCT | Gives LNK a NATS-native SchemaResolver path without changing LNK. | Medium | Keep; already boundary-clean. |
| PCT NATS SchemaResolver client | PCT client | Swappable resolver under unchanged LNK algebra. | Low/medium | Keep. |
| PCT frame projection specs/compiler | PCT | Derived data contracts and read-model DDL. Scores on all core axes. | Medium | Keep; not bloat. |
| ProjectionWorker runtime | LNK/PCT runtime boundary | Required for temporal coherence + replay + Timescale materialization. | High | Build, but vertical-slice first. |
| Timescale source fact hypertable | SQL/projection subsystem | Historical audit/analytics/replay visibility. | Medium | Keep if projections are operational; optional per deployment. |
| Timescale frame hypertables | SQL/projection subsystem | Direct read-model performance and retention/compression. | Medium | Keep. |
| Timescale CAGGs over frame tables | SQL/projection subsystem | Valuable analytics acceleration after frames exist. | Medium | Defer framework; add per use case. |
| STX state substrate | STX | Needed where client/local reactive state must be durable/transactional. | Medium | Keep, but do not leak into server stream semantics. |
| TMNL UI/testbeds | TMNL | Development affordances and visual validation. | Variable | Keep as demos/labs; isolate from PCT/LNK/MSH core. |

## What is not bloat

### 1. Multiple packages

The package split is justified because the boundaries are real:

- MSH cannot know PCT schemas or LNK offset semantics.
- LNK must not know PCT registry storage or federation policy.
- PCT must not own NATS substrate lifecycle beyond composing MSH layers.
- STX should not become a server stream substitute.

This split is not bloat; it is blast-radius control.

### 2. NATS control plane plus HTTP control plane

This is duplication only if they compete for the same deployment story. They do
not:

- HTTP is easy to inspect, test, and integrate broadly.
- NATS is native to the streaming/microservice fabric.

Both are justified if they share contracts and one does not drift semantically
from the other.

Rule: same PCT operation contracts, different transports.

### 3. Frame projections

Frame projections compress repeated consumer logic into a governed derived data
contract. They are justified precisely because consumers should not each reinvent
multi-source temporal assembly, replay behavior, imputation labeling, and
historical materialization.

### 4. CAS/fencing/idempotency

This is not ceremony. Durable streams without idempotency and fencing are just
optimistic append logs with better marketing.

## Real bloat risks

### 1. Compatibility aliases without sunset

Aliases are useful during migration. They become bloat when they are immortal.

Current example:

- `nats-bridge` / `NatsBridgeWire` compatibility names after `msh-bridge` /
  `MshBridgeWire` became canonical.

Recommendation:

- add deprecation docs;
- keep tests while external usage exists;
- schedule removal after a release boundary.

### 2. Generic frameworks before the second concrete case

The pattern is often right; the generic abstraction is often premature.

High-risk candidates:

- general projection DSL;
- automatic migration apply engine;
- CAGG framework;
- multi-tenant worker scheduler;
- dynamic schema-to-SQL inference;
- arbitrary user joins.

Recommendation:

- implement one vertical slice;
- implement the second with light duplication;
- extract framework only after the second/third case reveals the stable shape.

### 3. Transport names leaking semantic names

“Batch” and “Frame” are different concepts.

- batch = transport/mechanical grouping;
- frame = coherent semantic observational moment.

Recommendation:

- keep `batch` names only in transport internals;
- use `frame` for derived coherent records;
- never use batch APIs to imply semantic coherence.

### 4. PCT becoming runtime policy soup

PCT should describe and serve contracts. It should not become the worker runtime,
DB migration daemon, dashboard semantics engine, or NATS substrate manager.

Recommendation:

- PCT emits specs/plans/control-plane responses;
- worker runtimes consume specs;
- MSH owns substrate;
- SQL migration/apply tooling stays explicit.

### 5. Timescale as hidden semantic engine

Timescale should not be used to hide multi-stream assembly. It should store and
accelerate explicit read models.

Recommendation:

- use Timescale for source facts and frame hypertables;
- use CAGGs over already-coherent frames;
- keep temporal assembly in ProjectionWorker.

### 6. Test/demo infrastructure graduating into product surface

Testbeds and demos are useful. They become bloat when every demo adds an exported
package surface or config branch.

Recommendation:

- demos live under scripts/testbed docs;
- exported APIs require a consumer and tests;
- keep package exports intentionally narrow.

## Complexity budget by layer

### MSH: substrate budget

Allowed complexity:

- NATS connection/options/lifecycle;
- auth/JWT/token plumbing;
- JetStream/KV helpers;
- subject conventions;
- generic schema-backed micro host;
- tracing.

Forbidden complexity:

- PCT schema policy;
- LNK offset/fencing semantics;
- frame projection rules;
- business domain concepts.

### LNK: durable stream budget

Allowed complexity:

- stream identity and offsets;
- append/read/subscribe;
- typed LNK facade;
- SchemaResolver algebra;
- wire conformance;
- MSH bridge semantics;
- producer idempotency/fencing;
- optional frame stream output writer.

Forbidden complexity:

- PCT registry ownership;
- NATS auth policy design;
- Timescale schema design except through projection runtime adapters;
- dashboard-specific models.

### PCT: contract/control-plane budget

Allowed complexity:

- procedure/manifest/registry contracts;
- identity/notary/federation;
- config layering;
- HTTP/NATS control plane;
- SchemaResolver provider;
- FrameProjectionSpec and ProjectionPlan compiler.

Forbidden complexity:

- direct NATS substrate implementation;
- LNK durable-stream internals;
- generic worker scheduler;
- automatic DB migration daemon without explicit operator control.

### STX: state budget

Allowed complexity:

- local/client transactional state;
- React/tooling-facing state where effect-atom/useState is insufficient;
- deterministic state transitions.

Forbidden complexity:

- replacing durable stream semantics;
- becoming a hidden persistence layer for PCT/LNK runtime facts.

### Timescale/SQL: read-model budget

Allowed complexity:

- source fact hypertables;
- materialized frame hypertables;
- indexes/compression/retention;
- CAGGs over frames/source facts;
- analytical views.

Forbidden complexity:

- hidden semantic frame assembly;
- ungoverned dynamic SQL;
- imputation without metadata.

## System-level recommendations

### Keep building

1. PCT NATS control plane and SchemaResolver provider.
2. LNK MSH bridge hardening.
3. FrameProjectionSpec and deterministic ProjectionPlan compiler.
4. One ProjectionWorker vertical slice.
5. Timescale materialized frame tables.
6. Config-driven runtime composition.

### Slow down / gate

1. Generic projection DSL.
2. Automatic migration apply.
3. Multi-tenant projection runtime.
4. CAGG framework.
5. Dynamic schema inference.
6. Expanding public exports without consumers.

### Clean up

1. Sunset compatibility aliases on a schedule.
2. Keep MSH free of domain policy.
3. Keep PCT from owning worker lifecycle beyond plan/control-plane contracts.
4. Split transport batching from semantic frames in naming/docs.
5. Add capability-owner notes to RFCs and exports.

## The governance rule

Every new subsystem must answer four questions before it graduates from RFC to
runtime:

1. Who owns the semantics?
2. Who owns the substrate?
3. Who are the first two consumers?
4. What is the smallest degradation path if it is unavailable?

If those answers are clear, complexity is probably justified. If not, it is
probably architecture cosplay.

## Current verdict

The system is ambitious but mostly coherent. The core stack is not bloated; it is
separating hard concerns that would otherwise be dangerously entangled.

The bloat risk is not the existence of MSH/LNK/PCT/STX/frame projections. The
bloat risk is premature generality around the edges:

- immortal compatibility aliases;
- generic projection DSLs;
- framework-grade migration/apply before one production projection;
- CAGGs as a platform before concrete analytical read models;
- demos/testbeds leaking into public API.

So the next move is not to cut frame projections. The next move is to keep the
feature, but force the implementation through one narrow end-to-end production
slice before extracting more machinery.
