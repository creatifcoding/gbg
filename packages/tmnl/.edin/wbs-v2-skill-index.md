# WBS V2 — Shared Skill & Tool Index

## For All Committee Members

This file is your shared reference. Use it to find the right skill/tool for your domain.

---

## Research Tools (MANDATORY before writing epics)

| Tool | How to Use | When |
|------|-----------|------|
| **deepwiki** | `mcp__deepwiki__ask_question` repo=`Effect-TS/effect` | Verify Effect patterns |
| **deepwiki** | `mcp__deepwiki__ask_question` repo=`tim-smart/effect-atom` | Verify Atom patterns |
| **effect submodule** | Read `../../submodules/effect/packages/*/test/` | Canonical test patterns |
| **effect-atom submodule** | Read `../../submodules/effect-atom/packages/atom/test/` | Atom test patterns |
| **website submodule** | Read `../../submodules/website/content/src/content/docs/` | Human-authored docs |
| **Codebase grep** | `Grep` tool across `src/lib/iiot/` | What already exists |

## Skills by Domain

### Core Platform (platform-architect)
- `/effect-patterns` — Service definition, Layer composition
- `/effect-service-authoring` — Effect.Service<>() patterns
- `/effect-schema-mastery` — Schema.TaggedStruct, TaggedClass, branded types
- `/effect-atom-integration` — Atom.runtime, ctx.set()
- `/effect-stream-patterns` — Stream creation, transformation

### Network & Multi-Tenant (network-architect)
- `/effect-match-patterns` — Discriminated unions, Queue/PubSub
- `/iiot-unified-namespace` — UNS topic hierarchy
- `/iiot-isa95-hierarchy` — ISA-95 equipment hierarchy
- `/effect-scope-resources` — Scope management for connections

### Security & Governance (security-architect)
- `/effect-service-authoring` — Service boundary patterns
- `/effect-schema-mastery` — Validation at boundaries

### DevEx & Operations (devex-architect)
- `/tmnl-documentation-nav` — Documentation hierarchy
- `/tmnl-testbed-patterns` — Testbed components
- `/spike-testing` — Hypothesis-driven debugging
- `/cli-core` — Effect CLI patterns

### DePIN & Blockchain (depin-architect)
- `/effect-patterns` — Core Effect for Sui integration
- `/effect-schema-mastery` — Token/transaction schemas

### Infrastructure & Networking (infra-architect)
- `/iiot-database` — TimescaleDB + Apache AGE
- `/nex-effect-services` — NEX workload integration
- `/renode-for-tmnl` — Hardware simulation

### Operational Data Domains (data-architect)
- `/effect-schema-mastery` — Domain entity schemas
- `/adal-schema-drift` — Schema drift analysis
- `/iiot-database` — SQL patterns
- `/effect-service-authoring` — Repository services

### Product & Market (product-architect)
- `/react-compound-components` — UI composition
- `/ux-interaction-patterns` — Factory-floor UX
- `/ux-feedback-patterns` — Status, loading, toasts
- `/components-build` — Component patterns

---

## Existing Codebase Reference

### What Already Exists (from WBS V1 — 266 SP COMPLETE)

| Area | Path | Status |
|------|------|--------|
| Schemas | `src/lib/iiot/schemas/` | Entity schemas (Asset, Alarm, SensorReading, WorkOrder, EquipmentState) |
| Models | `src/lib/iiot/models/` | Model derivations from schemas |
| DDL | `src/lib/iiot/infrastructure/ddl/` | TimescaleDB + AGE migrations |
| Repos | `src/lib/iiot/repositories/` | CRUD repos for all entities |
| Errors | `src/lib/iiot/errors/` | Tagged error types |
| L1 Services | `src/lib/iiot/services/l1/` | Pg, TimeSeries, Graph clients |
| L2 Services | `src/lib/iiot/services/l2/` | Business logic services |
| Event Sourcing | `src/lib/iiot/infrastructure/` | EventLog, EventJournal, feature flags |
| ES Handlers | `src/lib/iiot/handlers/` | Alarm, WorkOrder, EquipmentState handlers |
| RPC | `src/lib/iiot/rpc/` | RPC groups and handlers |
| HTTP | `src/lib/iiot/http/` | HTTP API routes |
| Streaming | `src/lib/iiot/streaming/` | RPC streaming, entity observer |
| Regulatory | `src/lib/iiot/regulatory/` | ISA-18.2, audit trail |
| Entity Layer | `src/lib/iiot/entity-layer/` | Effect/cluster entity composition |
| Tests | `src/lib/iiot/__tests__/` | Integration + unit tests |

### What Does NOT Exist Yet (from RFC)

- Network entity types (S15) — Organization, Site, Area, etc.
- Edge-first architecture (S16) — Offline-first, sync
- Marketplace protocol (S18) — Two-sided market, capability discovery
- Sui settlement (S18.11) — Smart contracts, escrow
- Trust model (S20) — Cross-org trust federation
- Onboarding protocol (S24) — 15-minute SLA
- DePIN economics (S30) — Token mining, proof-of-relay
- Operational data domains (S36) — BOM, routing, quality, scheduling, energy, inventory
- Hardware firmware — Edge device, gateway code
- Reticulum mesh integration (S35) — NATS-over-Reticulum tunnel
- Pricing engine — Tiered pricing, usage metering

---

## WBS Output Format

Each expert produces their domain's epics in this format:

```markdown
## Phase N: [Phase Name] (Sprints X-Y) — Z SP

### Epic NN: [Epic Name] — M SP
| Status | Task | Description |
|--------|------|-------------|
| ⏳ | NN.1.1 | [Task description] |
| ⏳ | NN.1.2 | [Task description] |
| ⏳ | NN.2.1 | [Task description] |

**Dependencies**: [Epic X, Epic Y]
**RFC Sections**: [Section numbers]
```

### SP Estimation Guide

| Size | SP | Examples |
|------|----|----------|
| Trivial | 1 | Single branded ID, barrel export |
| Small | 2-3 | Schema definition, simple repo method |
| Medium | 5 | Service with 3-5 methods, migration |
| Large | 8 | Complex service with dependencies, integration tests |
| XL | 13 | Full subsystem (e.g., marketplace protocol) |

---

## Communication Protocol

1. **Read your RFC sections** — Use `Read` tool on `docs/specifications/rfc-entity-realtime-integration.md` with line offsets
2. **Cross-reference existing code** — `Grep`/`Glob` in `src/lib/iiot/`
3. **Validate patterns** — Use deepwiki and skills
4. **Produce epics** — Write to `docs/specifications/wbs-v2/[your-domain].md`
5. **Report dependencies** — Send message to team lead (Val) with cross-domain deps
6. **Discuss conflicts** — DM the relevant domain expert to resolve overlaps
