# IIoT Invariants — TLC Model Checking Analysis

## Running the Model

### Prerequisites

```bash
# Option A: TLA+ Toolbox (GUI) — download from https://lamport.azurewebsites.net/tla/toolbox.html
# Option B: CLI via tla2tools.jar
wget https://github.com/tlaplus/tlaplus/releases/download/v1.8.0/tla2tools.jar
```

### Execute

```bash
# From thoughts/shared/plans/
java -jar tla2tools.jar -config iiot-invariants.cfg iiot-invariants.tla

# With depth limit (faster, still finds violations)
java -jar tla2tools.jar -config iiot-invariants.cfg -depth 12 iiot-invariants.tla

# Workers for parallel exploration
java -jar tla2tools.jar -config iiot-invariants.cfg -workers 4 iiot-invariants.tla
```

### Model Size Estimate

| Entity | States | Transitions |
|--------|--------|-------------|
| PLT (plant) | 5 | 5 |
| LIN (line) | 5 | 5 |
| MCH (machine) | 5 | 5 |
| ALM (alarm) | 6 | 17 |
| EQP (equipment) | 6 | 26 |
| WO (work order) | 11 | 17 |

With mailbox depth ≤ 2, the reachable state space is bounded but large.
TLC should find **all** cross-entity violations within seconds (depth ≤ 10).

---

## Expected Counterexamples

### Invariant 2: HierarchyCoherence — VIOLATED

**Shortest violation trace (predicted):**

```
State 0 (Init):
  PLT = "created", LIN = "created"

State 1 (EnqueueMessage(PLT, "commissioning")):
  PLT = "created", mailbox[PLT] = <<"commissioning">>

State 2 (ProcessMessage(PLT)):
  PLT = "commissioning"

State 3 (EnqueueMessage(PLT, "operational")):
  mailbox[PLT] = <<"operational">>

State 4 (ProcessMessage(PLT)):
  PLT = "operational"

State 5 (EnqueueMessage(LIN, "commissioning")):
  mailbox[LIN] = <<"commissioning">>

State 6 (ProcessMessage(LIN)):
  LIN = "commissioning"  ← child now active

State 7 (EnqueueMessage(PLT, "decommissioned")):
  mailbox[PLT] = <<"decommissioned">>

State 8 (ProcessMessage(PLT)):
  PLT = "decommissioned"  ← parent decommissioned
  LIN = "commissioning"   ← child still active

  *** INVARIANT HierarchyCoherence VIOLATED ***
  IsActive(LIN) = TRUE, IsDecommissioned(PLT) = TRUE
```

**Why it happens:** PLT and LIN have independent mailboxes. Nothing prevents PLT from transitioning to "decommissioned" while LIN is mid-lifecycle. There's no "check children" guard in the plant handler.

**Real-world scenario:** Operator decommissions plant PLT-EAST. Line LIN-7 on that plant is still commissioning (technician was halfway through setup). LIN-7's handler doesn't know its parent just died. It will happily continue to "operational" — running production on a decommissioned plant.

---

### Invariant 3: AlarmEquipmentCoherence — VIOLATED

**Shortest violation trace (predicted):**

```
State 0 (Init):
  ALM = "unacknowledged", EQP = "idle"

State 1: EQP → "unplanned_downtime"  (breakdown!)
State 2: ALM → "acknowledged"        (operator sees alarm)
State 3: ALM → "cleared"             (operator clears alarm)
         EQP = "unplanned_downtime"   (equipment STILL broken)

  *** INVARIANT AlarmEquipmentCoherence VIOLATED ***
  state[ALM] = "cleared", state[EQP] = "unplanned_downtime"
```

**Why it happens:** Alarm clearing is an operator action on the ALM entity. Equipment recovery is a separate action on the EQP entity. No causal link between them.

**Real-world scenario:** Operator acknowledges and clears high-temperature alarm on press MCH-3. But the press is still physically overheating (EQP = unplanned_downtime). The alarm dashboard shows "all clear" while the machine is still down. If this is a foundry or food processing line, **this is a safety hazard**.

**ISA-18.2 note:** The standard actually anticipates this — "return to normal" should be a **process condition**, not an operator action. Our model lets operators clear alarms independently of process state.

---

### Invariant 4: WorkOrderSafety — VIOLATED

**Shortest violation trace (predicted):**

```
State 0 (Init):
  WO = "created", EQP = "idle"

State 1: WO → "submitted"
State 2: WO → "approved"
State 3: EQP → "running"     (production starts!)
State 4: WO → "started"      (maintenance begins while running!)

  *** INVARIANT WorkOrderSafety VIOLATED ***
  state[WO] = "started", state[EQP] = "running"
```

**Why it happens:** Work order approval (WO) doesn't check current equipment state (EQP). By the time the work order is "started," production may have resumed.

**Real-world scenario:** Maintenance work order WO-2847 is approved for press MCH-3 (scheduled for idle shift). But production scheduler pushes MCH-3 back to "running" before maintenance starts. Technician arrives, begins maintenance on a running machine. **FDA 21 CFR Part 11 violation** — the work order system didn't enforce lockout/tagout.

---

### Invariant 6: CascadeCompleteness — VIOLATED

**Shortest violation trace (predicted):**

```
State 0 (Init):
  PLT = "created", LIN = "created", MCH = "created"

State 1-4: PLT → commissioning → operational → decommissioned
State 5: (no messages sent to LIN or MCH)

  PLT = "decommissioned"
  LIN = "created"    ← still in initial state
  MCH = "created"    ← still in initial state

  *** INVARIANT CascadeCompleteness VIOLATED ***
  Parent decommissioned, children never progressed
```

**Why it happens:** There is no cascade mechanism. Decommissioning a plant doesn't send decommission messages to its children. They remain in whatever state they were in.

**Real-world scenario:** Plant PLT-EAST is decommissioned in the system. But its 12 lines and 47 machines remain as "operational" entities. Ghost entities accumulate. Reports show active equipment on a dead plant. If a new plant reuses entity IDs, the old ghosts cause data conflicts.

---

## Invariant 5: NonCommutativityDetected — ANALYSIS

This isn't checked as an invariant (it's expected to fire). Instead, let's enumerate the non-commutative pairs per entity type.

### Plant/Line/Machine (identical graphs)

| Current State | Msg A | Msg B | A;B result | B;A result | Commutative? |
|---------------|-------|-------|------------|------------|:---:|
| created | commissioning | decommissioned | commissioning (B rejected) | created (A rejected, B rejected) | **NO** |
| operational | scheduled_shutdown | decommissioned | decommissioned (from sched) | decommissioned (direct) | YES (same end) |

The key non-commutative pair: **{commissioning, decommissioned}** from "created" state.
- A;B: created → commissioning (B="decommissioned" rejected from commissioning)
- B;A: created → rejected (no created→decommissioned edge!) → A="commissioning" applied → commissioning
- Wait: created→decommissioned IS NOT in the graph. So B is rejected, then A succeeds.
- Result: both orderings reach "commissioning". **COMMUTATIVE** (accidentally).

Actually, let me re-examine. From "operational":
- A=scheduled_shutdown, B=decommissioned
- A;B: operational → scheduled_shutdown → decommissioned = **decommissioned**
- B;A: operational → decommissioned (valid!) → scheduled_shutdown rejected = **decommissioned**
- Same result. Commutative.

The plant/line/machine graph is essentially a **linear chain with one shortcut** (operational→decommissioned). All pairs from any reachable state produce the same outcome regardless of order. **Plant-type entities are commutative-safe.**

### Alarm (ISA-18.2)

| Current State | Msg A | Msg B | A;B | B;A | Commutative? |
|---------------|-------|-------|-----|-----|:---:|
| unacknowledged | acknowledged | shelved | acknowledged→shelved = **shelved** | unacknowledged→shelved→acknowledged = **acknowledged** | **NO** |
| unacknowledged | acknowledged | suppressed | ack→suppressed = **suppressed** | suppressed→ack = **acknowledged** | **NO** |
| unacknowledged | shelved | suppressed | shelved→(no suppressed edge!) = **shelved** | suppressed→(no shelved edge!) = **suppressed** | **NO** |
| acknowledged | cleared | shelved | cleared→(no shelved edge) = **cleared** | shelved→(no cleared edge) = **shelved** | **NO** |
| acknowledged | cleared | out_of_service | cleared→(no oos edge) = **cleared** | oos→cleared = **cleared** | **NO** (intermediate differs) |

**Alarms are riddled with non-commutativity.** The ISA-18.2 graph is a rich mesh — almost every pair of actions from the same state produces different outcomes depending on order.

**Dangerous implication:** If two operators simultaneously shelve and acknowledge the same alarm, the final state depends on which message arrives at the actor first. One operator sees "shelved," the other sees "acknowledged," but the actual state could be either.

### Equipment (ISA-95/OEE)

The equipment graph is "generally permissive" — most states can reach most other states. Let's check:

| Current State | Msg A | Msg B | A;B | B;A | Commutative? |
|---------------|-------|-------|-----|-----|:---:|
| running | idle | blocked | idle→blocked = **blocked** | blocked→idle = **idle** | **NO** |
| running | planned_downtime | unplanned_downtime | pd→upd = **upd** | upd→pd = **pd** | **NO** |
| idle | running | setup | running→setup = **setup** | setup→running = **running** | **NO** |

**Equipment is also heavily non-commutative.** The permissive graph means most transitions succeed, but the order determines the final state.

**Dangerous scenario:** Operator sets machine to "planned_downtime" for scheduled maintenance. Simultaneously, a sensor detects failure and triggers "unplanned_downtime." The outcome depends on arrival order. If planned wins, the failure signal is effectively swallowed — the system thinks it's a planned stop, not a breakdown.

### Work Order (FDA 21 CFR Part 11)

| Current State | Msg A | Msg B | A;B | B;A | Commutative? |
|---------------|-------|-------|-----|-----|:---:|
| submitted | approved | rejected | approved (rejected fails from approved) = **approved** | rejected (approved fails from rejected) = **rejected** | **NO** |
| started | suspended | completed | suspended (completed fails) = **suspended** | completed (suspended fails) = **completed** | **NO** |
| started | suspended | failed | suspended (failed fails) = **suspended** | failed (suspended fails) = **failed** | **NO** |

**Work orders have critical non-commutativity at decision points.** The approve/reject fork and the complete/fail fork are both order-dependent. If a supervisor approves while QA rejects, the outcome is a coin flip based on mailbox ordering.

**FDA 21 CFR Part 11 implication:** The regulation requires **auditability** — you must know WHY a work order is in its current state. If the outcome depends on message arrival order (not business logic), the audit trail is meaningless. "Why was WO-2847 approved?" "Because the approve message arrived 3ms before the reject message." That's not a compliant answer.

---

## Severity Matrix

| Invariant | Violation Class | Safety Impact | Regulatory Impact | Frequency |
|-----------|----------------|:---:|:---:|:---:|
| HierarchyCoherence | Cross-entity hierarchy | **HIGH** — ghost operations | MEDIUM — asset tracking | LOW (decommission is rare) |
| AlarmEquipmentCoherence | Cross-domain causal | **CRITICAL** — safety hazard | **HIGH** — ISA-18.2 | MEDIUM (alarms are frequent) |
| WorkOrderSafety | Cross-domain causal | **CRITICAL** — lockout/tagout | **CRITICAL** — FDA 21 CFR Part 11 | MEDIUM |
| CascadeCompleteness | Missing mechanism | MEDIUM — data integrity | LOW | LOW |
| NonCommutativity (alarm) | Intra-entity ordering | **HIGH** — operator confusion | **HIGH** — ISA-18.2 audit | HIGH |
| NonCommutativity (equipment) | Intra-entity ordering | **HIGH** — misclassified downtime | MEDIUM — OEE accuracy | HIGH |
| NonCommutativity (work order) | Intra-entity ordering | **CRITICAL** — wrong approval | **CRITICAL** — FDA Part 11 | MEDIUM |

---

## Architectural Responses

### Tier 1: Accept + Compensate (P=0.60)

For most cross-entity violations, the actor model's eventual consistency is acceptable IF we add:

1. **Periodic reconciliation** — A background process scans for hierarchy violations and emits compensating events
2. **Soft invariant checks** — Handler can READ parent state (async) before applying transition, rejecting if parent is decommissioned. Not atomic, but closes the window significantly.
3. **Audit log divergence detection** — EventLog tracks both the "intended" and "actual" state; a monitor flags divergences.

**Covers:** HierarchyCoherence, CascadeCompleteness, AlarmEquipmentCoherence

### Tier 2: Synchronous Guard (P=0.25)

For safety-critical invariants, add a synchronous check in the handler:

```typescript
// In PlantEntity handler for "decommission" action:
// 1. Query all children of this plant
// 2. If any child is active, REJECT the decommission
// 3. Otherwise, proceed AND send decommission to children

// Cost: One extra query per transition. Acceptable for rare operations.
```

**Covers:** WorkOrderSafety (check equipment state before starting), HierarchyCoherence (check children before decommission)

### Tier 3: Intra-Entity Ordering (NEW — from non-commutativity analysis)

For alarm/equipment/work-order non-commutativity:

1. **Idempotency keys** — Each request carries a version/timestamp. Handler rejects stale requests.
2. **Last-writer-wins with causality** — Client must include `expectedCurrentState`. If mismatch, reject with `StaleStateError`.
3. **Optimistic concurrency** — Similar to ETags in HTTP. Handler checks version before applying.

```typescript
// Client sends: { action: "approve", expectedState: "submitted", version: 7 }
// Handler checks: state === "submitted" && version === 7
// If stale: reject with StaleStateError { currentState, currentVersion }
// Client must re-read and retry
```

**Covers:** All non-commutative pairs within single entities.

---

## Recommended Priority

1. **IMMEDIATE** — Optimistic concurrency on work orders (FDA compliance)
2. **IMMEDIATE** — Synchronous equipment-state check before work order start (lockout/tagout)
3. **NEXT** — Soft parent-state check on hierarchy transitions (decommission guard)
4. **NEXT** — Alarm-equipment coherence via reconciliation process
5. **LATER** — Cascade decommission mechanism
6. **LATER** — Full optimistic concurrency on alarms and equipment

---

## Files

| File | Purpose |
|------|---------|
| `iiot-invariants.tla` | TLA+ specification |
| `iiot-invariants.cfg` | TLC model configuration |
| `iiot-invariants-analysis.md` | This document — predicted counterexamples and responses |
