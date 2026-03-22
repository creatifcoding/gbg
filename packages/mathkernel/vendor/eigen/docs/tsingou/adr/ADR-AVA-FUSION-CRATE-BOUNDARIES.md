# ADR: ava-fusion Crate Boundary Architecture

**ADR-ID:** AVA-FUSION-001  
**Status:** PROPOSED  
**Author:** crate-architect (ava-fusion-research team)  
**Date:** 2026-02-20  
**Context:** ava-fusion crate design — pure domain types vs runtime integration with asupersync

---

## 1. Context

The `ava-fusion` crate is planned as the domain type layer for the AVA (Asset View Agent)
fusion pipeline. It will define the type vocabulary for sensor fusion, obligation tracking,
actor communication, and outcome signaling.

Concurrently, `asupersync` (v0.2.5) has been identified as the candidate runtime for the
fusion pipeline. This ADR analyzes whether `ava-fusion` should depend on `asupersync`,
and if so, at what level.

---

## 2. Facts Established

### 2.1 Current `ava-domain` Crate (verified via source read)

**File:** `src-ava/ava-domain/Cargo.toml`

```toml
[dependencies]
serde = { workspace = true }
serde_json = { workspace = true }
typeshare = { workspace = true }
thiserror = { workspace = true }
async-trait = { workspace = true }
arrow = { workspace = true }   # ← NOTE: arrow is NOT wasm-safe
```

**Patterns used** (`ids.rs`, `channels.rs`):
- Branded newtypes: `struct AssetId(pub String)` with `#[serde(transparent)]`
- ADT enums: `enum ChannelRole { State, Event, Metric, Command, Log }`
- All types annotated `#[typeshare]` for TypeScript generation
- No async runtime dependency — pure structural types with serde

**Edition:** `2021` (workspace-wide)

### 2.2 Workspace Structure (`src-ava/Cargo.toml`)

Members: `ava-domain`, `ava-macros`, `ava-adapters`, `ava-compiler`,
`ava-reconciler`, `ava-runtime`, `ava-api`, `ava-wasm`

The presence of `ava-wasm` is critical — it confirms the workspace has a live WASM
compilation target. Any crate depended upon by `ava-wasm` (transitively) MUST be
WASM-compatible.

### 2.3 asupersync Dependency Analysis

**Edition:** `2024` (nightly Rust required — `rust-toolchain.toml` specifies `channel = "nightly"`)

#### Non-WASM-safe mandatory dependencies (no feature flag):

| Dependency | Version | Why WASM-incompatible |
|---|---|---|
| `polling` | 3.11 | OS event loop — epoll/kqueue/IOCP, not wasm |
| `socket2` | 0.6 | BSD socket primitives via libc |
| `libc` | 0.2 | POSIX C library bindings — no wasm32 target |
| `nix` | 0.31 | Unix syscalls (fs, poll, socket, uio, user) |
| `crossbeam-queue` | 0.3 | Lock-free queue — std::sync dependent |
| `parking_lot` | 0.12 | OS mutex/rwlock primitives |

**Only WASM-guarded dep:**
```toml
[target.'cfg(not(target_arch = "wasm32"))'.dependencies]
ring = { version = "0.17", optional = true }  # TLS feature only
```

`ring` is the only dep with a wasm32 exclusion guard, and it is optional (TLS feature).
The six deps above (`polling`, `socket2`, `libc`, `nix`, etc.) are **unconditional**
mandatory dependencies. There is no `cfg(target_arch = "wasm32")` guard anywhere in
the source that would disable these.

**No `#![cfg_attr(target_arch = "wasm32", ...)]` crate-level guards found in `src/lib.rs`.**

#### Key asupersync types of interest:

From `src/lib.rs` re-exports (line 167):
```rust
Budget, CancelKind, CancelReason, ObligationId, Outcome, OutcomeError, PanicPayload, Policy
```

These are defined in the `types` module. The question is whether these **type definitions**
alone could be extracted — but they are not a separate crate; they live inside `asupersync`.

#### FrankenSuite sub-crates — potentially isolatable:

| Crate | Deps | WASM-safe? |
|---|---|---|
| `franken-kernel` | `serde` only | **YES** |
| `franken-evidence` | `serde`, `serde_json`, `tempfile` | Likely yes (tempfile is dev-only) |
| `franken-decision` | `franken-kernel`, `franken-evidence`, `serde` | **YES** |

These three franken sub-crates have **zero runtime deps** and are WASM-safe.

### 2.4 Edition Compatibility

- Our workspace: edition `2021`
- asupersync: edition `2024`, requires **nightly** toolchain
- Cargo workspaces allow mixing editions — each crate declares its own `edition`
- However: depending on an `edition = "2024"` crate from an `edition = "2021"` crate is
  fully supported. Editions only affect compilation of the declaring crate.
- The **nightly requirement** is the real blocker — `rust-toolchain.toml` in asupersync
  sets `channel = "nightly"`. If we vendor asupersync, our workspace `rust-toolchain.toml`
  would need to match, forcing all workspace members to nightly.

---

## 3. Options Analysis

### Option A — ava-fusion stays PURE (no asupersync dep)

**Shape:**
```
ava-fusion
  deps: serde, serde_json, typeshare, thiserror
  types: FusionId, ObligationRef, SensorReading, FusionOutcome (mirrors asupersync semantics)
  NO: actual asupersync types
```

| Criterion | Assessment |
|---|---|
| WASM-safe | YES — zero runtime deps |
| TypeScript generation | YES — typeshare works |
| nightly requirement | NO — stable Rust |
| asupersync Outcome/Budget usable | NO — must mirror types |
| Transitive footprint | ~5 crates |
| ava-wasm compatible | YES |

**Pro:**
- WASM-safe by construction
- Stable toolchain
- TypeScript frontend can use typeshare-generated types
- Keeps ava-domain pattern intact

**Con:**
- Must define `FusionOutcome<T,E>`, `FusionBudget`, `ObligationId` as mirrors — type drift risk
- Behavior (actors, channels, obligations) still needs a separate crate

---

### Option B — ava-fusion depends on asupersync (full)

**Shape:**
```
ava-fusion
  deps: asupersync (full), serde, typeshare
  types: re-export asupersync::Outcome, Budget, ObligationId
```

| Criterion | Assessment |
|---|---|
| WASM-safe | NO — libc/nix/polling pulled unconditionally |
| TypeScript generation | PARTIAL — asupersync types lack #[typeshare] |
| nightly requirement | YES — forced workspace-wide |
| asupersync Outcome/Budget usable | YES — direct re-export |
| Transitive footprint | ~40+ crates |
| ava-wasm compatible | NO — breaks ava-wasm |

**Pro:**
- No type mirroring — single source of truth for Outcome/Budget
- Direct FrankenSuite integration (evidence ledger, decisions)

**Con:**
- Breaks `ava-wasm` target entirely
- Forces nightly Rust workspace-wide
- Pulls in 40+ crates transitively (polling, socket2, etc.)
- asupersync types lack `#[typeshare]` annotations — cannot generate TS types directly

**VERDICT: Non-starter.** Breaks WASM and forces nightly on entire workspace.

---

### Option C — Three-Crate Split (RECOMMENDED)

**Shape:**
```
ava-fusion          — PURE types (serde + typeshare, no runtime)
  mirrors: FusionOutcome<T,E>, FusionBudget, FusionObligationId
  typeshare-annotated: YES
  edition: 2021

ava-fusion-runtime  — Runtime integration
  deps: ava-fusion + asupersync
  edition: 2024 (can use 2024 features for asupersync interop)
  provides: type conversion traits (From<FusionOutcome> for asupersync::Outcome)
  NOT in ava-wasm members

ava-domain (existing) — View/channel compilation (unchanged)
```

```
┌──────────────────────────────────────────────────────────────┐
│ ava-wasm       ← depends on ava-fusion (pure)                │
│ ava-adapters   ← depends on ava-fusion (pure)                │
│ ava-api        ← depends on ava-fusion-runtime               │
│ ava-runtime    ← depends on ava-fusion-runtime + asupersync  │
└──────────────────────────────────────────────────────────────┘
```

| Criterion | ava-fusion | ava-fusion-runtime |
|---|---|---|
| WASM-safe | YES | NO (by design) |
| TypeScript generation | YES | N/A |
| nightly requirement | NO | YES (for asupersync) |
| asupersync Outcome/Budget | Mirrors | Direct types |
| Type drift risk | Low (conversion layer at boundary) | N/A |

**Pro:**
- Clean separation: WASM-safe types vs native runtime
- ava-wasm and TypeScript frontend continue to work
- asupersync integration confined to server-side crates
- Edition mixing is legal — ava-fusion-runtime can use edition 2024
- Conversion traits provide single place to manage type alignment

**Con:**
- Three crates instead of one — more workspace management overhead
- Mirror types in ava-fusion must stay aligned with asupersync semantics
- Conversion layer is manual until asupersync types gain From impls

---

### Option D — ava-fusion + feature flags

**Shape:**
```
ava-fusion
  default: pure types (serde + typeshare)
  feature "runtime": enables asupersync dep
```

| Criterion | Assessment |
|---|---|
| WASM-safe (default) | YES |
| Feature "runtime" WASM-safe | NO |
| TypeScript generation | YES (default) |
| nightly requirement | Conditional (only with feature) |
| ava-wasm compatible | YES (must exclude "runtime" feature) |

**Pro:**
- Single crate
- Feature flag gates the runtime coupling

**Con:**
- Cargo feature flags don't solve nightly toolchain requirement — if ANY
  crate in the workspace enables the feature, nightly is needed
- `ava-wasm` must explicitly set `default-features = false` — fragile
- Feature unification in Cargo can cause inadvertent activation
- Harder to reason about WASM safety when a feature exists that breaks it

**VERDICT: Fragile.** Feature unification is too dangerous for a WASM-breaking dep.

---

### Option E — Depend only on FrankenSuite sub-crates (PARTIAL OPTION)

**Shape:**
```
ava-fusion
  deps: serde, typeshare, franken-kernel, franken-decision (vendored)
  NOT: asupersync itself
```

The franken sub-crates (`franken-kernel`, `franken-evidence`, `franken-decision`) are WASM-safe
(deps: serde only) and use edition 2024 but do NOT require nightly.

| Criterion | Assessment |
|---|---|
| WASM-safe | YES |
| Gets FrankenSuite TraceId, DecisionId, PolicyId | YES |
| Gets Outcome/Budget/ObligationId | NO — those live in asupersync core |
| nightly requirement | NO — franken crates compile on stable |
| Vendoring complexity | Medium |

**Pro:**
- Adds FrankenSuite tracing primitives (TraceId, DecisionId, PolicyId) without full runtime
- WASM-safe
- Stable toolchain

**Con:**
- Doesn't get the core protocol types (Outcome, Budget, ObligationId)
- Requires vendoring 3 sub-crates separately from asupersync

---

## 4. Recommendation

**Adopt Option C (Three-Crate Split) with Option E as a tactical add-on.**

### Rationale

1. **WASM is a hard constraint.** `ava-wasm` is a declared workspace member. Any crate in
   its dependency graph touching `libc`/`nix`/`polling` will fail at `wasm32-unknown-unknown`
   compilation. This eliminates Options B and D.

2. **Three-crate split is the established Rust pattern** for "types crate + runtime crate".
   Examples: `hyper-util` (runtime) vs `http` (types), `tower` (service) vs `tower-core` (traits).

3. **FrankenSuite sub-crates are WASM-safe** and can be vendored independently. Including
   `franken-kernel` in `ava-fusion` (pure) adds TraceId/DecisionId for audit trails without
   pulling asupersync.

4. **Edition mixing is safe.** Cargo documentation confirms editions are per-crate. `ava-fusion`
   stays on 2021, `ava-fusion-runtime` can use 2024 for asupersync interop.

5. **Nightly is isolated.** Only `ava-fusion-runtime` (and downstream like `ava-runtime`, `ava-api`)
   need the nightly toolchain. The workspace `rust-toolchain.toml` should specify stable by default;
   the `ava-fusion-runtime` subcrate can override with a local `rust-toolchain.toml`.

### Proposed crate structure

```
src-ava/
  ava-fusion/              ← NEW (pure types)
    Cargo.toml             edition = "2021"
    deps: serde, serde_json, typeshare, thiserror, franken-kernel (vendored)
    src/
      lib.rs
      outcome.rs           # FusionOutcome<T,E> — mirrors asupersync::Outcome semantics
      budget.rs            # FusionBudget — mirrors asupersync::Budget
      obligation.rs        # ObligationId, ObligationSpec
      sensor.rs            # SensorReading, SensorId — fusion domain types
      identity.rs          # FusionActorId, FusionRegionId

  ava-fusion-runtime/      ← NEW (runtime integration)
    Cargo.toml             edition = "2024", channel = "nightly"
    deps: ava-fusion, asupersync
    src/
      lib.rs
      convert.rs           # From<FusionOutcome<T,E>> for asupersync::Outcome etc.
      actor.rs             # FusionActor trait impl over asupersync actors
      region.rs            # FusionRegion lifecycle over asupersync regions
```

### Workspace Cargo.toml update

Add to `src-ava/Cargo.toml` members:
```toml
members = [
    "ava-domain",
    "ava-macros",
    "ava-adapters",
    "ava-compiler",
    "ava-reconciler",
    "ava-runtime",
    "ava-api",
    "ava-wasm",
    "ava-fusion",           # ← ADD
    "ava-fusion-runtime",   # ← ADD
]
```

`ava-wasm/Cargo.toml` deps:
```toml
ava-fusion = { path = "../ava-fusion" }
# NOT: ava-fusion-runtime — never depends on runtime
```

---

## 5. Edition 2024 Compatibility Notes

- Cargo workspaces support mixed editions (confirmed in Cargo reference)
- Edition affects only syntactic features in the crate declaring it
- `ava-fusion` at edition 2021 can depend on `franken-kernel` at edition 2024 — no issue
- `ava-fusion-runtime` at edition 2024 requires nightly toolchain (asupersync constraint)
- Workaround: use a per-directory `rust-toolchain.toml` in `ava-fusion-runtime/` — Cargo
  will pick it up during builds of that crate only when built in isolation; workspace builds
  inherit the root toolchain, so the workspace `rust-toolchain.toml` must specify nightly
  OR exclude `ava-fusion-runtime` from default build targets

---

## 6. Decision Matrix Summary

| Option | WASM-safe | Stable Rust | TypeScript gen | No type drift | Recommended |
|---|---|---|---|---|---|
| A — Pure | YES | YES | YES | NO (mirrors) | Acceptable fallback |
| B — Full asupersync | NO | NO | PARTIAL | YES | REJECTED |
| C — Three crates | YES | PARTIAL* | YES | YES | **RECOMMENDED** |
| D — Feature flags | FRAGILE | FRAGILE | YES | LOW | REJECTED |
| E — FrankenSuite only | YES | YES | YES | PARTIAL | Tactical add-on to C |

*ava-fusion itself is stable; ava-fusion-runtime is nightly-only

---

## 7. Open Questions

1. **Vendoring strategy for FrankenSuite sub-crates**: Copy into `src-ava/vendor/` or use
   a git submodule? Recommendation: vendor as path deps initially, add to workspace.

2. **Mirror type alignment**: Who is responsible for keeping `FusionOutcome<T,E>` semantically
   aligned with `asupersync::Outcome`? Recommendation: `ava-fusion-runtime/convert.rs` should
   have doc-tests that fail if asupersync changes semantics.

3. **typeshare for FrankenSuite types**: `TraceId`, `DecisionId` from `franken-kernel` are
   not `#[typeshare]` annotated. Should `ava-fusion` re-wrap them with typeshare? Recommendation:
   yes — create `FusionTraceId(pub String)` with `#[typeshare]` that wraps `franken_kernel::TraceId`.

4. **Workspace nightly override**: How to isolate nightly to `ava-fusion-runtime` without
   forcing workspace-wide nightly? Recommendation: investigate `[workspace.metadata.nightly-members]`
   approach or CI matrix splitting.

