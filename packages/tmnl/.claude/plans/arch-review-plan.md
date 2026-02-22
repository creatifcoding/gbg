# Architecture Review Plan — RFC Sectional Approach

## Status: UPDATED per team lead's strategy pivot

### Deliverables (Revised)

| # | File | Target Lines | Description |
|---|------|-------------|-------------|
| 1 | `docs/tsingou/adr/INDEX.md` | 200-300 | Master ADR cross-reference with dependency graph, decision impact matrix, terminology glossary |
| 2 | `docs/tsingou/rfc/rfc-section-architecture-overview.md` | 800-1500 | System architecture: design philosophy, component topology, layer composition, deployment model |
| 3 | `docs/tsingou/rfc/rfc-section-signal-pipeline.md` | 800-1500 | Signal pipeline: BaseSignal schema, d2ts dataflow, adapters, operators, version strategy |
| 4 | `docs/tsingou/rfc/rfc-section-rendering-surface.md` | 800-1500 | 4-layer rendering: R3F, visx, p5, DOM; OutputBridge; routing; analysis technique mapping |
| 5 | `docs/tsingou/rfc/rfc-section-state-management.md` | 800-1500 | State management: Atom-as-State doctrine, Effect.Ref boundaries, reactive subscriptions, NATS KV |

**Total target: 3,400-6,300 lines** (ADR INDEX + 4 RFC sections)

---

## Style Requirements (from IIoT RFC reference)

All RFC sections MUST follow:

1. **Section metadata block** (top of file):
   ```
   Section:       [Title]
   Parent RFC:    TSG-RFC-001 (Tsingou Signal Analysis Platform)
   Status:        DRAFT
   Author:        Val (architecture-reviewer)
   Created:       2026-02-18
   Research Base: [source documents and line counts]
   ```

2. **RFC 2119 normative language**: "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", "MAY" interpreted per [RFC2119] and [RFC8174]

3. **TSG.x section numbering prefix**: Each section uses `TSG.{N}` where N is the assigned section number

4. **Mandatory elements per section**:
   - Table of Contents
   - Tables mapping concepts to implementation
   - ASCII/Mermaid diagrams
   - Code examples (Effect-TS patterns from source)
   - Normative requirements ("Implementations MUST...")
   - Citations with `[KEY]` format
   - Cross-references to other TSG sections and ADRs

5. **Tone**: IETF memo style — precise, formal, third-person. No conversational language.

---

## Research Complete — All Documents Read

### Source Documents (23 total)

| Category | Count | Documents |
|----------|-------|-----------|
| Core specs | 3 | SPEC.md (215 lines), FLOW_ARCHITECTURE.md (693 lines), R3F_MIGRATION.md (1038 lines) |
| ADRs | 13 | ADR-001 through ADR-013 |
| nw-wrld reference | 7 | 01_SIGNAL_PIPELINE through 06_WORKSPACE + ARCHITECTURE_ANALYSIS |

### Source Code Verified (4 files)

| File | Lines | Verification |
|------|-------|-------------|
| `src/lib/tsingou-flow/schemas/base-signal.ts` | 159 | BaseSignal schema matches docs exactly |
| `src/lib/tsingou-flow/services/TsingouFlow.ts` | 276 | d2ts stubs confirmed, Atom-as-State verified |
| `src/lib/tsingou-flow/services/AdapterManager.ts` | 411 | Queue.bounded(4096), scoped lifecycle, 18th error class |
| `src/lib/tsingou-flow/adapters/errors.ts` | 188 | 17 tagged errors + union type confirmed |

---

## Consistency Issues Found (7)

These will be documented in the RFC sections and flagged in INDEX.md:

| # | Issue | Severity | RFC Section |
|---|-------|----------|-------------|
| 1 | Error count: ADR-006 says 17, actual is 18 (includes AdapterManagerError) | Medium | signal-pipeline |
| 2 | ADR-012 says "STIX-native Signals" but ADR-009 revised to "custom internal + STIX interop" | High | architecture-overview |
| 3 | SPEC.md §9 has stale file paths for nw-wrld docs | Low | INDEX.md |
| 4 | SPEC.md only lists ADR-001-008 but 13 exist | Low | INDEX.md |
| 5 | Missing ADRs for Tauri v2, R3F, d2ts package selection | Medium | architecture-overview |
| 6 | "Holonet" vs "NATS" terminology inconsistency | Medium | architecture-overview |
| 7 | nw-wrld module count varies (20 vs 21) | Low | rendering-surface |

---

## Execution Plan

### Step 1: Create `docs/tsingou/adr/INDEX.md` (~200-300 lines)

Structure:
```
# Tsingou ADR Index

## ADR Registry
| # | Title | Status | Date | Components Affected | Key Dependencies |
(13 rows with full metadata)

## Decision Timeline
Chronological narrative of decision sequence and rationale.

## ADR Dependency Graph
Mermaid directed graph showing cross-references.

## Decision Impact Matrix
Table: ADRs × Components (Schema, Adapters, Pipeline, State, Rendering, Transport, Errors, External)

## Implementation Status
Per-ADR: Fully implemented | Partially implemented | Design-only | Stubbed

## Consistency Notes
Documented contradictions and revision candidates.

## Terminology Glossary
Holonet/NATS, Tsingou/tsingou-flow, d2ts/D2, BaseSignal/Signal
```

### Step 2: Create `docs/tsingou/rfc/rfc-section-architecture-overview.md` (~800-1500 lines)

Section numbering: TSG.1

```
TSG.1. Architecture Overview

TSG.1.1 Design Philosophy
  - Signal-driven SIGINT/OSINT analysis platform
  - Effect-TS as foundational runtime
  - Relationship to nw_wrld: study, diverge, never fork
  - Named for Mary Tsingou (FPU problem, nonlinear dynamics)

TSG.1.2 System Topology
  - High-level component diagram (Mermaid)
  - Process model: Tauri v2 + sidecar daemons
  - Package namespace: @tmnl/tsingou-*
  - File inventory: 40 TypeScript files, ~5,800 LOC

TSG.1.3 Layer Composition
  - Effect Layer tree: HolonetConfig → NatsConnection → ... → TsingouFlow
  - Service dependency graph (from TsingouFlow.ts dependencies)
  - Scoped lifecycle semantics (Effect.addFinalizer)

TSG.1.4 Messaging Fabric
  - NATS 5 roles: direct source, message bus, bridge, fan-out, JetStream replay
  - Holonet service stack
  - Subject naming: tsingou.signal.{kind}.{sourceId}
  - KV buckets and JetStream streams

TSG.1.5 Intelligence Integration
  - STIX interop layer (custom BaseSignal ↔ STIX 2.1 bidirectional codec)
  - Intelligence cycle coverage (6 phases)
  - Platform integration points (Palantir, MISP, OpenCTI, TheHive, Cortex)
  - TAXII transport bridge

TSG.1.6 Deployment Model
  - Tauri v2 single process + sidecar
  - NATS leaf nodes for edge sensors
  - Workspace structure

TSG.1.7 nw_wrld Divergence Summary
  - Table: nw_wrld pattern → Tsingou replacement → rationale
  - Architectural shifts: OOP→FP, imperative→declarative, Electron→Tauri

TSG.1.8 Implementation Status
  - Built vs stubbed vs design-only
  - Wave progression

TSG.1.9 Normative Requirements
  - Consolidated MUST/SHOULD/MAY from this section

TSG.1.10 References
```

### Step 3: Create `docs/tsingou/rfc/rfc-section-signal-pipeline.md` (~800-1500 lines)

Section numbering: TSG.2

```
TSG.2. Signal Pipeline

TSG.2.1 BaseSignal Schema
  - Branded identifiers (SignalId, SourceId, SessionId)
  - Multi-dimensional versioning: SignalVersion = [tick, source_seq]
  - SignalKind discriminator (6 known kinds)
  - Schema definition with Effect Schema code
  - Extension mechanism (8 source-specific extensions)

TSG.2.2 Source Adapters
  - SourceAdapterShape service contract
  - AdapterManager lifecycle (register → scope → connect → push → unregister)
  - Queue.bounded(4096) backpressure semantics
  - 8 adapter implementations with contract tables
  - In-process vs sidecar deployment

TSG.2.3 Schema Registry
  - NATS KV-backed runtime registration
  - Schema versioning strategy
  - Validation pipeline integration

TSG.2.4 Differential Dataflow (d2ts)
  - Ingest graph vs derived graph architecture
  - Version strategy: [tick, source_seq] partial ordering
  - MultiSet semantics: accumulation (+1), retraction (-1)
  - Current status: stubbed (pass-through until @electric-sql/d2ts stabilizes)

TSG.2.5 Custom Operators
  - Window, throttle, schema-validate
  - Operator contract and composition

TSG.2.6 Error Handling
  - 17+1 tagged error hierarchy (Data.TaggedError)
  - catchTag/catchTags precision recovery
  - Error propagation through pipeline stages
  - Error classification table

TSG.2.7 NATS Subject Topology
  - Subject naming convention
  - JetStream stream configuration
  - Consumer patterns

TSG.2.8 OutputBridge
  - Queue → Atom.set() → useAtomValue() pipeline
  - Zero-coupling signal routing

TSG.2.9 Normative Requirements
TSG.2.10 References
```

### Step 4: Create `docs/tsingou/rfc/rfc-section-rendering-surface.md` (~800-1500 lines)

Section numbering: TSG.3

```
TSG.3. Rendering Surface

TSG.3.1 4-Layer Composited Architecture
  - Layer table: z-index, technology, rendering target, use cases
  - Compositing strategy (CSS stacking, pointer events)
  - Layer independence guarantees

TSG.3.2 R3F Layer (z:0, WebGL 3D)
  - React Three Fiber declarative scene graph
  - Use cases: link analysis, geospatial, signal flow
  - Migration from imperative Three.js (nw_wrld)
  - Performance considerations

TSG.3.3 visx Layer (z:1, SVG)
  - D3-powered declarative charts
  - Use cases: timeline, heatmaps, ATT&CK matrix
  - Why visx over raw D3 (React integration)

TSG.3.4 p5 Layer (z:2, Canvas 2D)
  - p5-wrapper integration
  - Use cases: spectrum waterfall, noise fields, constellation diagrams
  - SDR-specific rendering
  - Sketch lifecycle management

TSG.3.5 DOM Layer (z:3, React/framer-motion)
  - Controls, alerts, tables, overlays
  - framer-motion animation integration (ADR-007)
  - AG-Grid data surfaces

TSG.3.6 OutputBridge Architecture
  - Signal → rendering layer routing
  - Atom-mediated zero-coupling
  - Performance: batch updates, selective subscription

TSG.3.7 Analysis Technique Mapping
  - 8 techniques across 4 layers (ADR-013)
  - MVP-per-layer strategy
  - Technique → layer → visualization table

TSG.3.8 nw_wrld Module Migration
  - 21 module inventory with migration tracks
  - Migration status per module
  - R3F equivalents table

TSG.3.9 Normative Requirements
TSG.3.10 References
```

### Step 5: Create `docs/tsingou/rfc/rfc-section-state-management.md` (~800-1500 lines)

Section numbering: TSG.4

```
TSG.4. State Management

TSG.4.1 Atom-as-State Doctrine
  - Design rationale (ADR-005)
  - Atom.make() as primary reactive state
  - Why not SubscriptionRef, polling, or streams-to-streams
  - Comparison with nw_wrld's Jotai + mutable + closures

TSG.4.2 Atom Inventory
  - Complete inventory of all atoms across services
  - TsingouFlow atoms (tick, pipeline status, stats, diagnostics)
  - AdapterManager atoms (registry, health, signal count, lifecycle events)
  - Categorization: UI-visible vs internal

TSG.4.3 Effect.Ref Boundaries
  - When to use Effect.Ref (internal-only service state)
  - When NOT to use Effect.Ref (anything React needs to see)
  - Decision flowchart

TSG.4.4 Reactive Subscription Model
  - Atom.subscribe() for Effect services
  - useAtomValue() for React components
  - ctx.set() for service-scoped mutations
  - Registry lifecycle and scoping

TSG.4.5 NATS KV Integration
  - Schema registry state
  - Adapter configuration state
  - Session state persistence
  - KV → Atom synchronization patterns

TSG.4.6 State Persistence
  - Workspace-scoped persistence
  - Session recovery patterns
  - nw_wrld divergence: atomic writes vs god-object

TSG.4.7 Scoped Lifecycle Management
  - Effect.addFinalizer() for cleanup
  - Scope.make() / Scope.close() for adapter lifecycle
  - Service dependency ordering

TSG.4.8 Error State Management
  - Error atoms and health tracking
  - Adapter health status propagation
  - Diagnostic state for debugging

TSG.4.9 Normative Requirements
TSG.4.10 References
```

---

## Section Numbering Convention

| Section | TSG Number | Rationale |
|---------|-----------|-----------|
| Architecture Overview | TSG.1 | Top-level system context |
| Signal Pipeline | TSG.2 | Core data flow |
| Rendering Surface | TSG.3 | Output/visualization |
| State Management | TSG.4 | Cross-cutting concern |

These numbers are provisional and may be adjusted during final assembly.

---

## Writing Protocol

For each RFC section:

1. **Open with metadata block** matching `rfc-section-theoretical-foundations.md` format
2. **Include RFC 2119 normative statement** in preamble
3. **Write Table of Contents** with anchor links
4. **Author subsections** with:
   - Normative requirements (MUST/SHOULD/MAY)
   - Tables mapping concepts to implementation
   - Code examples from verified source files
   - Mermaid/ASCII diagrams for architecture
   - Cross-references to ADRs (`[ADR-00N]`)
   - Cross-references to other TSG sections (`[TSG.N.M]`)
5. **Close with Normative Requirements summary** consolidating all MUST/SHOULD from the section
6. **Close with References** section

---

## Dependency Order

```
INDEX.md (no dependencies — pure cross-reference)
  ↓
rfc-section-architecture-overview.md (references INDEX.md for ADR links)
  ↓
rfc-section-signal-pipeline.md (references architecture-overview for context)
  ↓
rfc-section-rendering-surface.md (references signal-pipeline for OutputBridge)
  ↓
rfc-section-state-management.md (references all above for atom inventory)
```

I will write them in this order: INDEX.md first, then the 4 RFC sections sequentially.
