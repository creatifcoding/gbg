# SREAM — Structured Requirements & Modality Engine

## What Is SREAM?

SREAM is a formal, typed, machine-verifiable semantic layer for expressing and manipulating system requirements. It converts natural-language statements like:

> "The terminal display subsystem **shall** support 4K screen resolutions."

into structured, event-sourced domain objects that machines can analyze, audit, validate, fuzz-test, and trace across the full lifecycle.

## Why Does It Exist?

Requirements written in English are ambiguous, inconsistent, and difficult to validate at scale. SREAM removes that ambiguity by decomposing every requirement into:

| Component        | Role                                           | Example                           |
|------------------|------------------------------------------------|-----------------------------------|
| **Subject**      | The system/subsystem being constrained         | `terminal display subsystem`      |
| **Modality**     | The deontic obligation (must/shall/may/must_not)| `shall` → obligatory (O φ)        |
| **Predicate**    | The action being required                      | `support`                         |
| **Object**       | What the action applies to                     | `4K screen resolutions`           |
| **Constraints**  | Measurable bounds (numeric, enum, boolean, expr)| resolution ≥ 3840×2160           |
| **Context**      | Operational mode, assumptions, guards          | `operational mode`, not degraded  |
| **Verification** | How to prove compliance                        | test plan, inspection, demo       |
| **Trace**        | Links to design, implementation, evidence      | code refs, test results           |

## SREAM in TMNL

SREAM is a **TMNL subsystem** used for **dogfooding** — TMNL's own feature requirements are expressed as SREAM objects. This enables V-model traceability: requirements trace to implementation, implementation traces back to requirements.

Subjects in SREAM are TMNL subsystems:
- `layers:functional:001:1` → Layer System, functional requirement #1
- `animation:performance:003:2` → Animation Library, performance requirement #3, 2nd order
- `slider:interface:002:1` → Slider System, interface requirement #2

## The Four Pillars

SREAM is composed of four pillars with strict dependency ordering:

```
D ← C ← B ← A
│    │    │    │
│    │    │    └─ Adversarial Fuzzer (stress-test requirements)
│    │    └────── Deontic Inference Engine (detect conflicts, propagate obligations)
│    └─────────── Lifecycle Audit Log (event-sourced state, full provenance)
│
└──────────────── Core DSL (types, construction, validation, normalization)
```

| Pillar | Name                   | Purpose                                                      |
|--------|------------------------|--------------------------------------------------------------|
| **D**  | Core DSL               | Canonical data model, Schema types, construction pipeline, validation, serialization |
| **C**  | Audit Log              | Event-sourced state backbone — the log IS the state          |
| **B**  | Deontic Inference      | Conflict detection, obligation propagation, effective modality computation |
| **A**  | Adversarial Fuzzer     | Mutation testing of requirements: modality swaps, constraint fuzzing, logical attacks |

### Build Order: D → C → B → A

This isn't just dependency order — it's architectural necessity:
- **D defines what events look like** (RequirementCreated, RequirementUpdated, etc.)
- **C defines how state is derived from events** (fold function: events → current state)
- **B operates on the derived state** (reads canonical fields for inference)
- **A generates mutant requirements** that flow back through D's validation and B's inference

## State Model: Event-Sourced

SREAM uses **event sourcing** — all state is derived by folding an append-only event stream:

```
Events (append-only)              →  fold()  →  Current State (Atoms)
────────────────────────                        ────────────────────────
RequirementCreated                              Map<ReqId, RequirementSpec>
RequirementUpdated                              Index<Team, ReqId[]>
RequirementDeleted                              Index<Category, ReqId[]>
ConstraintAttached                              ClauseIndex (for inference)
VerificationLinked                              ValidationState
TraceLinked
ValidationRunCompleted
InferenceRunCompleted
ConflictDetected
```

This is the same pattern used by TMNL's IIoT module for WorkOrder, Alarm, and EquipmentState entities. SREAM follows those exact canonical patterns.

## Deontic Semantics

SREAM treats modalities as deontic operators:

| Modality    | Deontic Operator | Lattice Level |
|-------------|------------------|---------------|
| `must`      | O φ (obligatory) | `required`    |
| `shall`     | O φ (obligatory) | `required`    |
| `may`       | P φ (permitted)  | `optional`    |
| `must_not`  | O ¬φ (forbidden) | `forbidden`   |

**Conflict rules:**
- `O φ ∧ O ¬φ` → **Direct conflict** (must AND must_not)
- `O φ ∧ P ¬φ` → **Suspicious** (obligation with permitted negation)
- `allOf([r, r])` → **Redundancy** (duplicate requirements)

**Effective modality lattice:**
```
forbidden < optional < required
```

## Technology Stack

- **Effect-TS** — Services, Layers, Streams, Refs
- **Effect Schema** — All domain types are Schemas (TaggedClass, TaggedStruct, Literal, Brand)
- **@effect/experimental EventLog** — Event sourcing infrastructure
- **@effect/experimental EventGroup** — Event registration and serialization
- **@effect/experimental EventJournal** — Persistence backend (memory for dev, SQL for prod)
- **@effect/experimental Machine** — State machine procedures (for requirement lifecycle)
- **effect-atom** — Reactive state for React consumers (Atom-as-State pattern)
- **Effect Graph** — State transition validation (requirement lifecycle graph)

## Related Documents

- [01-PATTERNS.md](./01-PATTERNS.md) — Canonical patterns extracted from IIoT module
- [02-SCHEMAS.md](./02-SCHEMAS.md) — Domain type catalog and Schema definitions
- [03-EVENTS.md](./03-EVENTS.md) — Event hierarchy and EventGroup definitions
- [04-SERVICES.md](./04-SERVICES.md) — Effect Services architecture
- [05-STATE.md](./05-STATE.md) — State management and event fold
- [06-FILE-STRUCTURE.md](./06-FILE-STRUCTURE.md) — Directory layout and module organization
