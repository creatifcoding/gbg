# AVA.12 Complex Event Processing

```
Section:       AVA.12 — Complex Event Processing
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          III — Algorithms (Normative)
Prerequisites: AVA.11 (Tracking & State Estimation)
Feeds:         AVA.13 (Output Pipeline)
```

> This section specifies the Complex Event Processing (CEP) subsystem
> of the ava-fusion pipeline. It defines the NFA-SASE engine for temporal
> sequence pattern detection, the SharedBuffer arena for memory-efficient
> event storage, the predicate expression compiler with haversine distance
> support, three contiguity modes, and budget-based blowup defenses. The
> key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
> "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL"
> in this document are to be interpreted as described in [RFC2119] and
> [RFC8174].

---

## Table of Contents

1.  [Conventions and Terminology](#ava121-conventions-and-terminology)
2.  [Architecture Overview](#ava122-architecture-overview)
3.  [SharedBuffer Arena](#ava123-sharedbuffer-arena)
4.  [Predicate Expression Compiler](#ava124-predicate-expression-compiler)
5.  [NFA-SASE Engine](#ava125-nfa-sase-engine)
6.  [Contiguity Modes](#ava126-contiguity-modes)
7.  [Blowup Defenses](#ava127-blowup-defenses)
8.  [Multi-Pattern Coordinator](#ava128-multi-pattern-coordinator)
9.  [Pattern Matching Lifecycle](#ava129-pattern-matching-lifecycle)
10. [Normative Requirements Summary](#ava1210-normative-requirements-summary)
11. [References](#ava1211-references)

---

## AVA.12.1 Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### AVA.12.1.1 Terminology

| Term | Definition |
|------|-----------|
| **NFA** | Nondeterministic Finite Automaton — state machine with multiple active states |
| **SASE** | Stream-based And Shared Execution — NFA variant for complex event processing |
| **SharedBuffer** | Arena-backed event storage where events are stored once and referenced by pointer |
| **EventRef** | 16-byte lightweight reference into the SharedBuffer (index + generation + timestamp) |
| **Partial match** | A `ComputationState` progressing through the NFA |
| **Contiguity** | Rule governing what happens when a non-matching event arrives |
| **Budget cap** | Maximum partial match count per NFA to bound memory |
| **Cross-step predicate** | A predicate referencing fields from multiple matched events |
| **Predicate pushdown** | Evaluating cross-step predicates as early as possible |

---

## AVA.12.2 Architecture Overview

The CEP subsystem comprises four layers
(`ava-fusion-runtime/src/cep/mod.rs:1-11`):

```
CepEngine (multi-pattern coordinator)
    |
    +-- NfaEngine (per-pattern NFA)
    |       |
    |       +-- SharedBuffer (arena event storage)
    |       +-- Compiled step predicates (Expr AST)
    |       +-- Compiled cross-step predicates (Expr + pushdown state)
    |
    +-- NfaEngine (per-pattern NFA)
            ...
```

- **SharedBuffer**: Events stored once; partial matches hold 16-byte refs
- **evaluator**: Predicate expression compiler (AST + recursive descent parser)
- **NfaEngine**: Per-pattern NFA with Strict/Relaxed/NonDeterministic contiguity
- **CepEngine**: Multi-pattern coordinator dispatching events to all active NFAs

---

## AVA.12.3 SharedBuffer Arena

### AVA.12.3.1 Design

Events are stored once in a contiguous arena. Partial NFA matches hold
lightweight `EventRef` copies instead of cloning full event data
(`ava-fusion-runtime/src/cep/shared_buffer.rs:1-12`):

```
Memory = N events * sizeof(EventData)
       + M partial matches * ~16 bytes (EventRef only)
```

This is Apache Flink's SharedBuffer insight adapted for in-process use.

### AVA.12.3.2 EventData

The canonical event record (`shared_buffer.rs:17-28`):

```rust
pub struct EventData {
    pub signal_kind: String,     // Source signal (e.g., "ais", "absence")
    pub entity_id: String,       // Entity this event belongs to
    pub timestamp: u64,          // Epoch milliseconds
    pub fields: Vec<(String, f64)>,  // Key-value payload
}
```

Field lookup by name returns `Option<f64>` (`shared_buffer.rs:32-34`).

### AVA.12.3.3 EventRef

16-byte lightweight reference with generation-based stale detection
(`shared_buffer.rs:42-53`):

```rust
pub struct EventRef {
    pub(crate) index: u32,       // Slot index (4 bytes)
    pub(crate) generation: u32,  // Stale detection (4 bytes)
    pub timestamp: u64,          // Cached for fast window checks (8 bytes)
}
```

**AVA.12-R1**: `EventRef` MUST be exactly 16 bytes, Copy, and trivially
cloneable. Validated by test `event_ref_is_copy_and_small`
(`shared_buffer.rs:282-291`).

### AVA.12.3.4 Arena Operations

| Operation | Complexity | Description |
|-----------|-----------|-------------|
| `insert(data)` | O(1) amortised | Returns EventRef; reuses free slots |
| `get(ref)` | O(1) | Returns `None` if generation mismatch (stale) |
| `evict_before(cutoff)` | O(N) | Removes events with `timestamp < cutoff` |
| `remove(ref)` | O(1) | Removes specific event by reference |

Slot reuse after eviction bumps the generation counter, invalidating all
outstanding `EventRef`s to that slot (`shared_buffer.rs:110-137`).

**AVA.12-R2**: After eviction, the `get()` method MUST return `None` for
any `EventRef` whose generation does not match the slot's current generation
(`shared_buffer.rs:140-147`).

---

## AVA.12.4 Predicate Expression Compiler

### AVA.12.4.1 Five AST Variants

The predicate compiler produces a typed AST with five node kinds
(`ava-fusion-runtime/src/cep/evaluator.rs:8-13`):

| Variant | Syntax Example | Description |
|---------|---------------|-------------|
| **Field** | `step_0.speed` | References a matched event's field |
| **Literal** | `1.0`, `-5.0` | Numeric constant |
| **BinOp** | `a < b`, `a + b` | Arithmetic or comparison |
| **FuncCall** | `haversine(...)`, `abs(x)` | Built-in function call |
| **Not** | `!(speed > 10)` | Logical negation |

```rust
pub enum Expr {
    Field(u32, String),         // (step_index, field_name)
    Literal(f64),
    BinOp(Box<Expr>, Op, Box<Expr>),
    FuncCall(String, Vec<Expr>),
    Not(Box<Expr>),
}
```

### AVA.12.4.2 Operator Precedence

The recursive descent parser (`evaluator.rs:349-498`) implements standard
precedence levels:

| Level | Operators | Associativity |
|-------|-----------|---------------|
| 1 (lowest) | `\|\|` | Left |
| 2 | `&&` | Left |
| 3 | `<`, `<=`, `>`, `>=`, `==`, `!=` | None |
| 4 | `+`, `-` | Left |
| 5 | `*`, `/` | Left |
| 6 (highest) | `!`, parentheses, atoms | Right (unary) |

### AVA.12.4.3 Built-in Functions

Five built-in functions are available (`evaluator.rs:162-174`):

| Function | Arity | Description |
|----------|-------|-------------|
| `abs(x)` | 1 | Absolute value |
| `min(a, b)` | 2 | Minimum of two values |
| `max(a, b)` | 2 | Maximum of two values |
| `sqrt(x)` | 1 | Square root |
| `haversine(lat1, lon1, lat2, lon2)` | 4 | Great-circle distance in meters |

### AVA.12.4.4 Haversine Distance

The haversine function computes great-circle distance using Earth
radius R = 6,371,000 m (`evaluator.rs:177-186`):

```rust
fn haversine_m(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    const R: f64 = 6_371_000.0;
    let d_lat = (lat2 - lat1).to_radians();
    let d_lon = (lon2 - lon1).to_radians();
    let a = (d_lat/2).sin()^2 + lat1_r.cos() * lat2_r.cos() * (d_lon/2).sin()^2;
    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());
    R * c
}
```

Validated by test `func_call_haversine`: London to Paris yields ~343 km
(`evaluator.rs:597-614`).

**AVA.12-R3**: The haversine function MUST accept arguments in decimal
degrees and return distance in meters.

### AVA.12.4.5 Cross-Step Field Access

Predicates can reference fields from different matched steps using
`step_N.field_name` syntax:

```
step_0.speed > step_2.speed
haversine(step_0.lat, step_0.lon, step_2.lat, step_2.lon) < 50000
```

### AVA.12.4.6 Predicate Pushdown

The `max_step_ref()` method computes the highest step index referenced
by an expression (`evaluator.rs:132-143`). Cross-step predicates are
evaluated as soon as their highest-referenced step is matched, pruning
infeasible partial matches early (`nfa.rs:102-112`).

**AVA.12-R4**: Implementations MUST evaluate cross-step predicates at the
earliest possible state (pushdown optimisation).

### AVA.12.4.7 Missing Fields and NaN Semantics

Missing fields return `f64::NAN` (`evaluator.rs:84`). NaN is falsy in
boolean context (`evaluator.rs:154-156`). Division by near-zero returns
NaN (`evaluator.rs:96-100`).

---

## AVA.12.5 NFA-SASE Engine

### AVA.12.5.1 Per-Pattern NFA

Each `SequencePattern` compiles to an `NfaEngine` where each step is an
NFA state (`ava-fusion-runtime/src/cep/nfa.rs:57-79`):

```rust
pub struct NfaEngine {
    pattern: SequencePattern,
    step_predicates: Vec<Option<Expr>>,       // Compiled per-step predicates
    cross_predicates: Vec<CompiledCrossPredicate>,
    active_states: Vec<ComputationState>,     // Active partial matches
    budget: usize,                            // Max partial matches
    buffer: SharedBuffer,                     // Per-engine event store
    completed: Vec<SequenceMatch>,
    events_processed: u64,
}
```

### AVA.12.5.2 ComputationState

A partial match in progress (`nfa.rs:31-38`):

```rust
struct ComputationState {
    current_state: usize,           // Next step to match
    matched_events: Vec<EventRef>,  // One EventRef per completed step
    start_time: u64,                // For window eviction
}
```

### AVA.12.5.3 Event Processing

`process_event()` (`nfa.rs:130-163`) executes the following per event:

1. Store event in SharedBuffer
2. Window eviction — drop partial matches older than `pattern.timeout_ms`
3. Try starting a new partial match at state 0
4. Advance all existing partial matches
5. Budget cap — oldest-first eviction if count exceeds limit
6. Return number of newly completed matches

**AVA.12-R5**: Implementations MUST process events in timestamp order
within a single NFA engine. Out-of-order events may produce incorrect
matches.

### AVA.12.5.4 Match Emission

When a partial match reaches the final state and passes all cross-step
predicates, a `SequenceMatch` is emitted (`nfa.rs:388-421`):

```rust
SequenceMatch {
    pattern_id: String,      // Source pattern ID
    entity_id: String,       // From first matched event
    matched_steps: Vec<u32>, // Step indices (0..N)
    start_ms: u64,           // First event timestamp
    end_ms: u64,             // Last event timestamp
    confidence: f64,         // 1.0 for complete matches
}
```

---

## AVA.12.6 Contiguity Modes

Three contiguity modes govern how non-matching events are handled
(`nfa.rs:339-348`):

### AVA.12.6.1 Strict Contiguity

If the next event does not match the expected step, the partial match
is **dropped** immediately (`nfa.rs:323-324`).

```
Pattern: AIS -> Absence
Events:  AIS, Radar, Absence
Result:  NO MATCH (Radar breaks strict contiguity)
```

Validated by test `strict_drops_on_non_match` (`nfa.rs:542-554`).

### AVA.12.6.2 Relaxed Contiguity

Non-matching events are **ignored**; the partial match continues waiting
(`nfa.rs:326-327`).

```
Pattern: AIS -> Absence
Events:  AIS, Radar, ADS-B, Absence
Result:  MATCH (unrelated events skipped)
```

This is the default contiguity mode. Validated by test
`relaxed_ignores_unrelated_events` (`nfa.rs:529-539`).

### AVA.12.6.3 Non-Deterministic Contiguity

On a matching event, the engine **forks**: one branch takes the match
(TAKE transition) and one branch keeps waiting (IGNORE fork)
(`nfa.rs:317-319`).

```
Pattern: AIS -> AIS (NonDeterministic)
Events:  AIS_1, AIS_2, AIS_3
Result:  Matches (AIS_1,AIS_2), (AIS_1,AIS_3), (AIS_2,AIS_3)
```

Validated by test `nondet_forks_on_match` (`nfa.rs:557-574`).

### AVA.12.6.4 Contiguity Resolution

Step-level contiguity overrides the pattern default. The effective
contiguity for step `i` is determined by step `i-1`'s contiguity field
(the transition INTO the current step) (`nfa.rs:339-348`).

**AVA.12-R6**: Implementations MUST support all three contiguity modes.
Step-level overrides MUST take precedence over the pattern-level default.

---

## AVA.12.7 Blowup Defenses

Three defenses prevent exponential blowup of partial matches
(`nfa.rs:7-11`):

### AVA.12.7.1 Window Eviction

Partial matches older than `pattern.timeout_ms` are evicted before
processing each event (`nfa.rs:138-140`):

```rust
self.active_states.retain(|s| {
    now.saturating_sub(s.start_time) <= self.pattern.timeout_ms
});
```

Validated by test `window_eviction_drops_old_matches` (`nfa.rs:655-668`).

### AVA.12.7.2 Budget Cap

When the partial match count exceeds `budget`, oldest-first eviction
is applied (`nfa.rs:157-160`):

```rust
if self.active_states.len() > self.budget {
    self.active_states.sort_by_key(|s| s.start_time);
    self.active_states.truncate(self.budget);
}
```

Default budget: 10,000 partial matches per NFA (`nfa.rs:22`).

**AVA.12-R7**: Implementations MUST enforce a budget cap on active partial
matches. The default MUST be 10,000.

Validated by test `budget_cap_evicts_oldest` (`nfa.rs:673-684`).

### AVA.12.7.3 SharedBuffer Event Storage

Events are stored once in the SharedBuffer. Partial matches hold only
16-byte `EventRef` values. This reduces memory from:

```
Without SharedBuffer: M partial matches * K events * sizeof(EventData)
With SharedBuffer:    N events * sizeof(EventData) + M * K * 16 bytes
```

**AVA.12-R8**: The SharedBuffer MUST support time-based eviction via
`evict_before(cutoff)`, returning the count of evicted events
(`shared_buffer.rs:152-166`).

---

## AVA.12.8 Multi-Pattern Coordinator

### AVA.12.8.1 CepEngine

The `CepEngine` manages a registry of compiled NFA engines
(`cep/mod.rs:30-107`):

```rust
pub struct CepEngine {
    engines: Vec<NfaEngine>,
}
```

### AVA.12.8.2 Pattern Registration

`register()` compiles a `SequencePattern` into an NFA. Only enabled
patterns are registered (`mod.rs:47-54`):

```rust
pub fn register(&mut self, pattern: SequencePattern) -> Result<(), String> {
    if !pattern.enabled { return Ok(()); }
    let engine = NfaEngine::new(pattern)?;
    self.engines.push(engine);
    Ok(())
}
```

**AVA.12-R9**: Disabled patterns (`.enabled = false`) MUST be silently
skipped during registration.

### AVA.12.8.3 Event Dispatch

`process_event()` clones the event to each registered NFA engine and
collects all completed matches (`mod.rs:73-84`):

```rust
pub fn process_event(&mut self, event: EventData) -> Vec<SequenceMatch> {
    let mut all_matches = Vec::new();
    for engine in &mut self.engines {
        let n = engine.process_event(event.clone());
        if n > 0 {
            all_matches.extend(engine.drain_completed());
        }
    }
    all_matches
}
```

### AVA.12.8.4 Global Eviction

`evict_all_before(cutoff)` propagates to all SharedBuffers
(`mod.rs:101-106`). SHOULD be called periodically to bound memory.

---

## AVA.12.9 Pattern Matching Lifecycle

### AVA.12.9.1 End-to-End Flow

```
1. Operator defines SequencePattern (steps, predicates, timeout)
2. CepEngine.register() compiles pattern -> NfaEngine
3. Events arrive via process_event()
4. NfaEngine:
   a. Window eviction on stale partial matches
   b. Try new match at state 0 (signal kind + step predicate)
   c. Advance existing partial matches (TAKE/IGNORE per contiguity)
   d. Pushdown cross-step predicate evaluation
   e. Budget cap enforcement
5. Complete matches -> SequenceMatch emitted
6. drain_completed() returns matches to consumer
```

### AVA.12.9.2 Example: AIS Dark Period Detection

```rust
SequencePattern {
    id: "ais-dark",
    steps: [
        SequenceStep { signal_kind: "ais", contiguity: Relaxed, .. },
        SequenceStep { signal_kind: "absence", contiguity: Relaxed, .. },
        SequenceStep { signal_kind: "ais", contiguity: Relaxed, .. },
    ],
    timeout_ms: 60_000,
    ..
}
```

Validated by test `three_step_ais_dark_period` (`nfa.rs:688-708`):

```
Events: AIS(t=1000) -> Absence(t=5000) -> AIS(t=10000)
Match:  pattern_id="ais-dark", start_ms=1000, end_ms=10000
```

### AVA.12.9.3 Example: Speed Anomaly with Cross-Step Predicate

```
steps: [AIS, Absence, AIS]
cross_predicate: "step_0.speed > step_2.speed"
```

Accepts when the vessel was faster before the gap than after. Validated
by tests `cross_step_predicate_acceptance` and
`cross_step_predicate_rejection` (`nfa.rs:603-651`).

**AVA.12-R10**: Cross-step predicates MUST be evaluated on complete matches
before emission. Partial match pushdown evaluation is an optimisation
that MUST NOT change the semantic result.

---

## AVA.12.10 Normative Requirements Summary

| ID | Requirement | Level |
|----|-------------|-------|
| AVA.12-R1 | EventRef MUST be exactly 16 bytes and Copy | MUST |
| AVA.12-R2 | SharedBuffer get() MUST return None for stale references | MUST |
| AVA.12-R3 | haversine() MUST accept degrees, return meters | MUST |
| AVA.12-R4 | Cross-step predicates MUST use pushdown evaluation | MUST |
| AVA.12-R5 | Events MUST be processed in timestamp order within an NFA | MUST |
| AVA.12-R6 | All three contiguity modes MUST be supported; step overrides pattern | MUST |
| AVA.12-R7 | Budget cap MUST be enforced; default 10,000 per NFA | MUST |
| AVA.12-R8 | SharedBuffer MUST support time-based eviction | MUST |
| AVA.12-R9 | Disabled patterns MUST be silently skipped | MUST |
| AVA.12-R10 | Cross-step predicates MUST be evaluated before match emission | MUST |

---

## AVA.12.11 References

- [RFC2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017.
- [SASE 2006] Wu, E., Diao, Y., Rizvi, S., "High-performance complex event processing over streams", Proc. SIGMOD, 2006.
- [Flink CEP] Apache Flink, "FlinkCEP - Complex event processing for Flink", https://nightlies.apache.org/flink/flink-docs-stable/docs/libs/cep/
- [ava-fusion-runtime nfa.rs] `ava-fusion-runtime/src/cep/nfa.rs` — NFA-SASE engine (777 lines)
- [ava-fusion-runtime shared_buffer.rs] `ava-fusion-runtime/src/cep/shared_buffer.rs` — SharedBuffer arena (328 lines)
- [ava-fusion-runtime evaluator.rs] `ava-fusion-runtime/src/cep/evaluator.rs` — Predicate AST + parser (753 lines)
- [ava-fusion-runtime mod.rs] `ava-fusion-runtime/src/cep/mod.rs` — CepEngine coordinator (219 lines)

---

*End of section AVA.12*
