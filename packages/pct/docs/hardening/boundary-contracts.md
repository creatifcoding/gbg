# PCT/LNK/MSH Boundary Contracts and Anti-Bloat Rubric

Status: hardening reference  
Owner: `#F1167 PCT/LNK/MSH Hardening Documentation and Closeout System`  
Task: `#4247 Slice D: Add boundary contract matrix and anti-bloat links`  
Last updated: 2026-05-26

## Purpose

This document is the boundary contract every PCT/LNK/MSH hardening lane must use
when deciding where code, policy, diagnostics, and operational semantics belong.

If a feature crosses layers, this page decides whether it is architecture or a
Rube Goldberg machine wearing a nice coat.

Primary references:

- [RFC-SYSTEM-CAPABILITY-AUDIT.md](../../RFC-SYSTEM-CAPABILITY-AUDIT.md)
- [PCT-LNK-MSH-HARDENING-RECON.md](../../PCT-LNK-MSH-HARDENING-RECON.md)
- [NATS-INTEGRATION-CLOSEOUT.md](../../NATS-INTEGRATION-CLOSEOUT.md)
- [MSH / PCT-LNK composition RFC](../../../msh/docs/pct-lnk-composition-rfc.md)
- [LNK NATS bridge docs](../../../lnk/NATS-BRIDGE.md)
- [staging-hygiene.md](./staging-hygiene.md)

## System thesis

The stack is a contract-first, replay-safe, federated runtime for typed
operational data products.

| Layer | Thesis role |
| --- | --- |
| PCT | Contracts, registry, identity, federation, control plane, derived-data specs, hardening governance. |
| LNK | Durable typed streams and durable wire semantics. |
| MSH | NATS/Auth/JetStream/KV/micro substrate. |
| STX | Local/client/tooling state substrate where reactive state is needed. |
| SQL/Timescale | Materialized read models, source facts, ledgers, historical analytics. |

The split is not bloat. It is blast-radius control.

## Boundary matrix

| Concern | Owner | Allowed dependencies | Forbidden drift |
| --- | --- | --- | --- |
| NATS connection lifecycle | MSH | MSH may depend on NATS client libraries and generic Effect services. | PCT/LNK-specific reconnect, schema, projection, or stream policy inside MSH. |
| NATS auth substrate | MSH | Token, NKey, JWT, creds, redaction helpers, safe auth metadata. | PCT HTTP route policy, LNK producer roles, tenant semantics, registry trust decisions. |
| JetStream stream helpers | MSH | Generic stream ensure/info/publish/fetch wrappers over opaque payloads. | LNK offset semantics, producer fencing, frame semantics, PCT projection policy. |
| KV/CAS substrate | MSH | Generic bucket/get/put/update/delete by revision. | LNK stream metadata meaning, producer epoch rules, close/retention semantics. |
| Subject conventions | MSH | Substrate naming validation and generic subject matching. | PCT persona policy or LNK stream operation authorization. |
| Generic micro endpoint host | MSH | Schema-backed request/reply host, typed decode/encode, service error envelope. | PCT endpoint names/policies hardcoded into MSH. |
| Durable stream append/read | LNK | Depends on MSH substrate APIs and SchemaResolver abstraction. | Raw NATS client lifecycle ownership or PCT registry/federation policy. |
| Producer fencing/idempotency | LNK | Uses MSH KV/JetStream mechanically. | PCT deciding offset authority or MSH interpreting producer epochs. |
| `SchemaResolver.fetchSchema(schemaId)` | LNK contract | PCT may provide resolver implementations. | Changing LNK API to know PCT control-plane transport. |
| PCT NATS control plane | PCT | Uses MSH generic micro host. | MSH owning `schema.get` / `capabilities.get` semantics. |
| Registry/federation/EventLogRemote | PCT | May publish/read through LNK or serve over HTTP/NATS. | LNK deciding registry trust policy or MSH performing registry validation. |
| Frame projection specs | PCT | May consume LNK streams and produce read models/outbox events. | LNK assembling semantic frames or Timescale becoming hidden assembler. |
| Projection scheduler admission | PCT runtime | Uses Effect fibers/semaphores/schedules and durable runtime ports. | Local admission controls pretending to be durable lease authority. |
| Durable projection lease/fence/checkpoint/outbox | PCT runtime + LNK boundary | LNK owns duplicate suppression for emitted stream writes. | PCT bypassing LNK idempotency; MSH owning projection semantics. |
| React/client state | STX | Local UI/tool state and reactive transactions. | STX becoming server stream truth or durable cross-node ledger. |
| Source facts/read models/analytics | SQL/Timescale | Stores source facts, ledgers, frame tables, CAGGs. | SQL queries defining ungoverned semantic assembly outside PCT contracts. |

## Package dependency rules

### MSH

MSH may import:

- `effect-v4` / Effect v4 packages used by MSH;
- NATS client libraries;
- package-local MSH modules.

MSH must not import:

- `@tmnl/pct`;
- `@tmnl/lnk`;
- PCT registry, projection, identity, EventLog, or federation modules;
- LNK stream/framing/offset/producer modules.

Permitted references to PCT/LNK in MSH docs are explanatory only.

### LNK

LNK may import:

- MSH substrate APIs for the MSH/NATS bridge;
- Effect v4 packages;
- its own contracts and wire services.

LNK must not import:

- PCT registry/federation/notary/publish internals;
- PCT NATS control-plane implementation details;
- PCT projection worker runtime.

LNK may depend on the abstract `SchemaResolver` shape. PCT can implement that
shape over HTTP, NATS, memory, or future transports.

### PCT

PCT may import:

- LNK public contracts/services;
- MSH public substrate APIs for NATS control-plane composition;
- Effect v4 packages and package-local PCT modules.

PCT must not:

- compile MSH source through workspace path alias leakage;
- own raw NATS connection lifecycle beyond composing MSH layers;
- rewrite LNK durable stream semantics inside PCT adapters;
- use Timescale as an ungoverned semantic assembler.

### STX

STX may support:

- local/client state machines;
- React/tooling reactive state;
- transactional local state.

STX must not be used as:

- LNK replacement;
- cross-node durable stream ledger;
- source of truth for PCT projection checkpoints.

## Anti-bloat rubric

A capability is justified when it scores strongly on at least three of these:

| Axis | Question |
| --- | --- |
| Consumer pressure | Does more than one real consumer want this shape? |
| Semantic compression | Does it remove repeated bespoke logic from consumers? |
| Durability/replay | Does correctness require recovery, offset/idempotency, or provenance? |
| Contract value | Does it need schema/version/discovery/governance? |
| Operational leverage | Does it enable deployment, inspection, migration, or debugging? |
| Boundary hygiene | Does it reduce coupling between PCT/LNK/MSH/STX instead of smearing it? |

Suspicious capabilities usually have one of these smells:

- naming symmetry without a real consumer;
- generic framework before the second concrete case;
- compatibility alias with no sunset;
- transport detail pretending to be semantic concept;
- PCT policy buried in MSH substrate docs;
- SQL query becoming semantic source of truth;
- Kubernetes overlay before local deterministic proof.

## Capabilities that are explicitly not bloat

| Capability | Why it stays |
| --- | --- |
| Strict Effect v4 package islands | Prevents v3/v4 bridge rot and dependency ambiguity. |
| MSH auth/NATS/JetStream/KV/micro substrate | Real deployment substrate needed by multiple layers. |
| LNK durable typed streams | Core product capability: offsets, framing, fencing, idempotency. |
| PCT NATS control plane | Native resolver/control path for NATS fabric while keeping LNK resolver API stable. |
| Frame projections | Compress multi-source temporal assembly into governed derived data contracts. |
| Projection durable runtime | Required for replay, checkpointing, leases, outbox, and operational projection workers. |
| Diagnostics/doctor surface | Required before soak, ACL denial, and chaos have useful evidence. |
| Workspace hygiene guardrails | Required because current worktree is heavily dirty and root lockfile drift is high-risk. |

## Known bloat risks and policy

### Compatibility aliases

Current example:

- `nats-bridge` / `NatsBridgeWire` compatibility names after `msh-bridge` /
  `MshBridgeWire` became canonical.

Policy:

- Keep compatibility aliases only with migration purpose.
- Document deprecation/sunset once external usage is known to be migrated.
- Do not add new aliases casually.

### Batch vs frame naming

Definitions:

- **batch** = transport/mechanical grouping;
- **frame** = coherent semantic observational moment.

Policy:

- Keep `batch` only in transport internals.
- Use `frame` for derived coherent records.
- Never imply batch APIs produce semantic coherence.

### Generic projection framework pressure

Policy:

- One vertical slice first.
- Second slice may duplicate lightly.
- Extract framework only after stable shape appears.

### CAGG and migration automation

Policy:

- Keep CAGG framework deferred until concrete read-model demand exists.
- Migration preview/apply must remain explicit and inspectable.

### Kubernetes first

Policy:

- Kubernetes is Tier 2.
- Local deterministic faults and local NATS bounce come first.
- No network partition claims without explicit chaos controller dependency and evidence.

## Boundary review commands

Use these during closeout when relevant.

### MSH must not import PCT/LNK code

```bash
rg -n "@tmnl/(pct|lnk)|packages/(pct|lnk)|from ['\"].*(pct|lnk)|import\(['\"].*(pct|lnk)" \
  packages/msh/src packages/msh/test
```

Expected result:

- no source/test imports;
- documentation-only references are acceptable when scoped to docs.

### PCT package boundary typecheck posture

```bash
cd packages/pct
bunx tsc --noEmit --pretty false
```

Expected result:

- PCT resolves MSH/LNK through package/public boundaries, not workspace path alias
  source leakage.

### Staged boundary review

Full runbook: [staging-hygiene.md](./staging-hygiene.md)

```bash
git diff --cached --name-status
git status --short -- package.json bun.lock .gitmodules
```

Expected result:

- changed files match the lane being closed;
- no root/shared files unless explicitly owned;
- no unrelated package deletes or runtime state;
- exact pathspec staging is used if staging occurred.

## Closeout boundary checklist

Every hardening closeout should answer:

- [ ] Does MSH remain substrate-only?
- [ ] Does LNK still own durable stream semantics?
- [ ] Does PCT still own contracts/control-plane policy?
- [ ] Does STX stay local/client/tooling state only?
- [ ] Does SQL/Timescale stay a facts/ledger/read-model/analytics store?
- [ ] If a capability is generic, does it satisfy at least three anti-bloat axes?
- [ ] If an alias or compatibility path exists, is its migration purpose named?
- [ ] If Kubernetes appears, has the equivalent local deterministic proof landed?

If the answer is “well, technically,” stop. That is where entropy enters wearing
a conference badge.
