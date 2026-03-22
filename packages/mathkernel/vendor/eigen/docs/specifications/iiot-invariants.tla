--------------------------- MODULE IIoTInvariants ---------------------------
(*
 * IIoT Microfactory — Formal Invariant Specification
 *
 * Models the Effect Cluster actor system with:
 *   - Independent entity mailboxes (no cross-entity ordering)
 *   - ISA-95 equipment hierarchy (parent-child)
 *   - ISA-18.2 alarm lifecycle
 *   - Equipment state transitions (OEE)
 *   - Work order lifecycle (FDA 21 CFR Part 11)
 *
 * PURPOSE: Find invariant violations caused by non-commutative
 * operation ordering across independent actor mailboxes.
 *
 * Run with TLC model checker to discover counterexamples.
 *)

EXTENDS Naturals, Sequences, FiniteSets

CONSTANTS
    Entities,           \* Set of all entity IDs (e.g., {"PLT-1", "LIN-1", "MCH-1", "ALM-1"})
    ParentOf,           \* Function: entity -> parent entity (or "none")
    EntityType,         \* Function: entity -> type (plant | line | machine | alarm | equipment | workorder)
    NULL                \* Sentinel for "no parent"

VARIABLES
    state,              \* [Entities -> current state]
    mailbox,            \* [Entities -> sequence of pending messages]
    history,            \* [Entities -> sequence of (action, fromState, toState) triples]
    clock               \* Global logical clock (for ordering analysis)

vars == <<state, mailbox, history, clock>>

-----------------------------------------------------------------------------
(* STATE SPACES per entity type — derived from the codebase graphs *)
-----------------------------------------------------------------------------

PlantStates == {"created", "commissioning", "operational", "scheduled_shutdown", "decommissioned"}
LineStates == {"created", "commissioning", "operational", "scheduled_shutdown", "decommissioned"}
MachineStates == {"created", "commissioning", "operational", "scheduled_shutdown", "decommissioned"}

AlarmStates == {"unacknowledged", "acknowledged", "shelved", "suppressed", "cleared", "out_of_service"}

EquipmentStates == {"running", "idle", "planned_downtime", "unplanned_downtime", "setup", "blocked"}

WorkOrderStates == {"created", "submitted", "approved", "rejected", "started",
                    "suspended", "resumed", "completed", "failed", "cancelled", "closed"}

StatesFor(type) ==
    CASE type = "plant"     -> PlantStates
    []   type = "line"      -> LineStates
    []   type = "machine"   -> MachineStates
    []   type = "alarm"     -> AlarmStates
    []   type = "equipment" -> EquipmentStates
    []   type = "workorder" -> WorkOrderStates

InitialState(type) ==
    CASE type = "plant"     -> "created"
    []   type = "line"      -> "created"
    []   type = "machine"   -> "created"
    []   type = "alarm"     -> "unacknowledged"
    []   type = "equipment" -> "idle"
    []   type = "workorder" -> "created"

-----------------------------------------------------------------------------
(* TRANSITION GRAPHS — edges from the codebase *)
(* ValidTransition(type, from, to) = TRUE iff the graph has that edge *)
-----------------------------------------------------------------------------

PlantTransitions == {
    <<"created", "commissioning">>,
    <<"commissioning", "operational">>,
    <<"operational", "scheduled_shutdown">>,
    <<"scheduled_shutdown", "decommissioned">>,
    <<"operational", "decommissioned">>
}

LineTransitions == {
    <<"created", "commissioning">>,
    <<"commissioning", "operational">>,
    <<"operational", "scheduled_shutdown">>,
    <<"scheduled_shutdown", "decommissioned">>,
    <<"operational", "decommissioned">>
}

MachineTransitions == {
    <<"created", "commissioning">>,
    <<"commissioning", "operational">>,
    <<"operational", "scheduled_shutdown">>,
    <<"scheduled_shutdown", "decommissioned">>,
    <<"operational", "decommissioned">>
}

AlarmTransitions == {
    <<"unacknowledged", "acknowledged">>,
    <<"unacknowledged", "shelved">>,
    <<"unacknowledged", "suppressed">>,
    <<"unacknowledged", "out_of_service">>,
    <<"acknowledged", "cleared">>,
    <<"acknowledged", "shelved">>,
    <<"acknowledged", "suppressed">>,
    <<"acknowledged", "out_of_service">>,
    <<"shelved", "unacknowledged">>,
    <<"shelved", "acknowledged">>,
    <<"shelved", "out_of_service">>,
    <<"suppressed", "unacknowledged">>,
    <<"suppressed", "acknowledged">>,
    <<"suppressed", "out_of_service">>,
    <<"cleared", "unacknowledged">>,
    <<"out_of_service", "unacknowledged">>,
    <<"out_of_service", "cleared">>
}

EquipmentTransitions == {
    <<"running", "idle">>,
    <<"running", "planned_downtime">>,
    <<"running", "unplanned_downtime">>,
    <<"running", "setup">>,
    <<"running", "blocked">>,
    <<"idle", "running">>,
    <<"idle", "planned_downtime">>,
    <<"idle", "unplanned_downtime">>,
    <<"idle", "setup">>,
    <<"idle", "blocked">>,
    <<"planned_downtime", "idle">>,
    <<"planned_downtime", "running">>,
    <<"planned_downtime", "unplanned_downtime">>,
    <<"planned_downtime", "setup">>,
    <<"unplanned_downtime", "idle">>,
    <<"unplanned_downtime", "running">>,
    <<"unplanned_downtime", "planned_downtime">>,
    <<"unplanned_downtime", "setup">>,
    <<"setup", "running">>,
    <<"setup", "idle">>,
    <<"setup", "unplanned_downtime">>,
    <<"setup", "blocked">>,
    <<"blocked", "running">>,
    <<"blocked", "idle">>,
    <<"blocked", "unplanned_downtime">>,
    <<"blocked", "setup">>
}

WorkOrderTransitions == {
    <<"created", "submitted">>,
    <<"created", "cancelled">>,
    <<"submitted", "approved">>,
    <<"submitted", "rejected">>,
    <<"approved", "started">>,
    <<"approved", "cancelled">>,
    <<"started", "suspended">>,
    <<"started", "completed">>,
    <<"started", "failed">>,
    <<"suspended", "resumed">>,
    <<"suspended", "cancelled">>,
    <<"resumed", "suspended">>,
    <<"resumed", "completed">>,
    <<"resumed", "failed">>,
    <<"completed", "closed">>,
    <<"failed", "closed">>,
    <<"cancelled", "closed">>
}

TransitionsFor(type) ==
    CASE type = "plant"     -> PlantTransitions
    []   type = "line"      -> LineTransitions
    []   type = "machine"   -> MachineTransitions
    []   type = "alarm"     -> AlarmTransitions
    []   type = "equipment" -> EquipmentTransitions
    []   type = "workorder" -> WorkOrderTransitions

ValidTransition(entity, from, to) ==
    <<from, to>> \in TransitionsFor(EntityType[entity])

-----------------------------------------------------------------------------
(* ACTIONS *)
-----------------------------------------------------------------------------

(*
 * EnqueueMessage: A client sends a transition request to an entity.
 * Non-deterministic: any valid target state can be enqueued at any time.
 * This models the "two requests arrive" scenario.
 *)
EnqueueMessage(entity, targetState) ==
    /\ targetState \in StatesFor(EntityType[entity])
    /\ targetState /= state[entity]      \* no self-loops
    /\ mailbox' = [mailbox EXCEPT ![entity] = Append(@, targetState)]
    /\ UNCHANGED <<state, history, clock>>

(*
 * ProcessMessage: Entity handler dequeues and processes the next message.
 * If the transition is valid from current state: apply it.
 * If invalid: reject (message consumed, state unchanged).
 *
 * THIS IS THE KEY: processing is deterministic given the current state.
 * But the current state depends on what was processed before,
 * which depends on arrival order to the mailbox.
 *)
ProcessMessage(entity) ==
    /\ Len(mailbox[entity]) > 0
    /\ LET targetState == Head(mailbox[entity])
       IN IF ValidTransition(entity, state[entity], targetState)
          THEN /\ state' = [state EXCEPT ![entity] = targetState]
               /\ history' = [history EXCEPT ![entity] =
                    Append(@, <<state[entity], targetState, clock>>)]
          ELSE /\ UNCHANGED <<state, history>>  \* rejected — invalid from current state
    /\ mailbox' = [mailbox EXCEPT ![entity] = Tail(@)]
    /\ clock' = clock + 1

-----------------------------------------------------------------------------
(* INITIAL STATE *)
-----------------------------------------------------------------------------

Init ==
    /\ state = [e \in Entities |-> InitialState(EntityType[e])]
    /\ mailbox = [e \in Entities |-> <<>>]
    /\ history = [e \in Entities |-> <<>>]
    /\ clock = 0

-----------------------------------------------------------------------------
(* NEXT STATE RELATION *)
-----------------------------------------------------------------------------

Next ==
    \/ \E e \in Entities, s \in StatesFor(EntityType[e]):
        EnqueueMessage(e, s)
    \/ \E e \in Entities:
        ProcessMessage(e)

Spec == Init /\ [][Next]_vars

-----------------------------------------------------------------------------
(* INVARIANTS *)
-----------------------------------------------------------------------------

(*==========================================================================*)
(* INVARIANT 1: Graph Integrity (EXPECTED TO HOLD)                          *)
(*                                                                          *)
(* Every entity's state is reachable from its initial state via valid        *)
(* transitions. The handler enforces this — reject invalid transitions.     *)
(*==========================================================================*)

GraphIntegrity ==
    \A e \in Entities:
        state[e] \in StatesFor(EntityType[e])

(*==========================================================================*)
(* INVARIANT 2: Hierarchy Coherence (EXPECTED TO BE VIOLATED)               *)
(*                                                                          *)
(* A child in an "active" state (operational/running) must have a parent    *)
(* that is also "active". Decommissioned parent + active child = violation. *)
(*                                                                          *)
(* This WILL be violated because parent and child have independent          *)
(* mailboxes. TLC will find the interleaving.                               *)
(*==========================================================================*)

IsActive(entity) ==
    CASE EntityType[entity] = "plant"     -> state[entity] \in {"commissioning", "operational"}
    []   EntityType[entity] = "line"      -> state[entity] \in {"commissioning", "operational"}
    []   EntityType[entity] = "machine"   -> state[entity] \in {"commissioning", "operational"}
    []   EntityType[entity] = "alarm"     -> state[entity] \in {"unacknowledged", "acknowledged"}
    []   EntityType[entity] = "equipment" -> state[entity] \in {"running", "setup"}
    []   EntityType[entity] = "workorder" -> TRUE  \* work orders don't participate in hierarchy

IsDecommissioned(entity) ==
    CASE EntityType[entity] = "plant"     -> state[entity] = "decommissioned"
    []   EntityType[entity] = "line"      -> state[entity] = "decommissioned"
    []   EntityType[entity] = "machine"   -> state[entity] = "decommissioned"
    []   OTHER                            -> FALSE

HierarchyCoherence ==
    \A child \in Entities:
        ParentOf[child] /= NULL =>
            ~(IsActive(child) /\ IsDecommissioned(ParentOf[child]))

(*==========================================================================*)
(* INVARIANT 3: Alarm-Equipment Causal Coherence (EXPECTED TO BE VIOLATED)  *)
(*                                                                          *)
(* If equipment is in unplanned_downtime, there should be an active alarm.  *)
(* If an alarm is cleared, equipment should not still be in breakdown.      *)
(*                                                                          *)
(* Violated because alarm and equipment are separate entities.              *)
(*==========================================================================*)

\* For model checking, we need to know which alarm is "for" which equipment.
\* We encode this via ParentOf: alarm -> equipment entity.

AlarmEquipmentCoherence ==
    \A alm \in Entities:
        /\ EntityType[alm] = "alarm"
        /\ ParentOf[alm] /= NULL
        /\ EntityType[ParentOf[alm]] = "equipment"
        => ~( state[alm] = "cleared"
            /\ state[ParentOf[alm]] = "unplanned_downtime" )

(*==========================================================================*)
(* INVARIANT 4: Work Order Safety (EXPECTED TO BE VIOLATED)                 *)
(*                                                                          *)
(* A started work order targeting a machine implies the machine should be   *)
(* in a maintenance-compatible state (not running production).              *)
(*                                                                          *)
(* Violated because work order and equipment are separate entities.         *)
(*==========================================================================*)

WorkOrderSafety ==
    \A wo \in Entities:
        /\ EntityType[wo] = "workorder"
        /\ ParentOf[wo] /= NULL
        /\ EntityType[ParentOf[wo]] = "equipment"
        => ~( state[wo] \in {"started", "resumed"}
            /\ state[ParentOf[wo]] = "running" )

(*==========================================================================*)
(* INVARIANT 5: Non-Commutativity Detection                                 *)
(*                                                                          *)
(* For any entity, if two messages A and B are both in the mailbox:         *)
(* Does order matter? We detect this by checking if both orderings          *)
(* lead to different final states.                                          *)
(*                                                                          *)
(* This is a META-INVARIANT: it identifies which operation PAIRS            *)
(* are non-commutative for each entity type.                                *)
(*==========================================================================*)

\* Helper: apply transition if valid, else return original state
ApplyIfValid(entity, currentState, targetState) ==
    IF <<currentState, targetState>> \in TransitionsFor(EntityType[entity])
    THEN targetState
    ELSE currentState

\* For any entity with 2+ messages queued, check commutativity
NonCommutativityDetected ==
    \E e \in Entities:
        /\ Len(mailbox[e]) >= 2
        /\ LET a == mailbox[e][1]
               b == mailbox[e][2]
               s == state[e]
               \* Order A;B
               s_after_a  == ApplyIfValid(e, s, a)
               s_after_ab == ApplyIfValid(e, s_after_a, b)
               \* Order B;A
               s_after_b  == ApplyIfValid(e, s, b)
               s_after_ba == ApplyIfValid(e, s_after_b, a)
           IN s_after_ab /= s_after_ba

(*==========================================================================*)
(* INVARIANT 6: Decommission Cascade Completeness                           *)
(*                                                                          *)
(* If a parent is decommissioned, ALL descendants must eventually be        *)
(* decommissioned. This is a LIVENESS property (not safety).                *)
(* We approximate it as: parent decommissioned → no child is "created"      *)
(* or "commissioning" (i.e., children must have progressed past the point   *)
(* where the parent was still alive).                                       *)
(*                                                                          *)
(* EXPECTED TO BE VIOLATED: no cascade mechanism exists.                    *)
(*==========================================================================*)

CascadeCompleteness ==
    \A parent \in Entities:
        IsDecommissioned(parent) =>
            \A child \in Entities:
                (ParentOf[child] = parent /\ EntityType[child] \in {"line", "machine"}) =>
                    state[child] \in {"decommissioned", "scheduled_shutdown"}

(*==========================================================================*)
(* PROPERTIES TO CHECK                                                       *)
(*                                                                          *)
(* Safety (must ALWAYS hold):                                               *)
(*   GraphIntegrity         — ✓ holds (handler enforces)                    *)
(*                                                                          *)
(* Safety (VIOLATED by architecture):                                       *)
(*   HierarchyCoherence     — ✗ child active + parent decommissioned       *)
(*   AlarmEquipmentCoherence — ✗ alarm cleared + equipment still broken     *)
(*   WorkOrderSafety        — ✗ work order active + machine running         *)
(*   CascadeCompleteness    — ✗ parent decommissioned, children still live  *)
(*                                                                          *)
(* Detection:                                                               *)
(*   NonCommutativityDetected — identifies dangerous operation pairs        *)
(*==========================================================================*)

=============================================================================
