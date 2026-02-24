------------------------ MODULE SessionProtocol -------------------------
(*
 * Session-typed handler protocol state machine.
 *
 * Models the HttpChan<S> typestate transitions from session.rs.
 * A session is a pair of dual endpoints (handler + caller) that must
 * execute complementary protocol steps. Dropping a channel mid-protocol
 * triggers a drop bomb (panic).
 *
 * Reference implementation:
 *   session.rs:164-200     -- HttpChan<S> struct and transition()
 *   session.rs:204-208     -- Send transition (send consumes self)
 *   session.rs:213-222     -- Recv transition (recv consumes self)
 *   session.rs:226-236     -- Select transition (select_left / select_right)
 *   session.rs:257-265     -- Offer transition (offer with Branch)
 *   session.rs:269-278     -- End transition (close -> SessionProof)
 *   session.rs:282-291     -- Drop bomb (impl<S> Drop for HttpChan<S>)
 *   session.rs:330          -- HttpHandlerSession type alias
 *   session.rs:337          -- HttpCallerSession type alias
 *
 * Handler protocol (HttpHandlerSession, session.rs:330):
 *   Recv<Request, Select<Send<Response, End>, Send<ErrorResponse, End>>>
 *
 *   RECV_REQUEST -> SELECT_BRANCH -> SEND_RESPONSE -> END -> [close] -> CLOSED
 *                                 \-> SEND_ERROR    -> END -> [close] -> CLOSED
 *
 * Caller protocol (HttpCallerSession, session.rs:337):
 *   Send<Request, Offer<Recv<Response, End>, Recv<ErrorResponse, End>>>
 *
 *   SEND_REQUEST -> OFFER_BRANCH -> RECV_RESPONSE -> END -> [close] -> CLOSED
 *                                \-> RECV_ERROR    -> END -> [close] -> CLOSED
 *
 * Drop bomb (session.rs:282-291):
 *   Any channel dropped in a non-END/CLOSED state panics:
 *   panic!("SESSION LEAKED: HttpChan {} dropped without reaching End state")
 *)
EXTENDS Naturals, Sequences, FiniteSets

------------------------------------------------------------------------
(* -- Constants -------------------------------------------------------- *)

CONSTANTS
    MaxSessions    \* Number of concurrent sessions to model-check

ASSUME MaxSessions \in Nat /\ MaxSessions >= 1

------------------------------------------------------------------------
(* -- Session IDs ------------------------------------------------------ *)

SessionIds == 1..MaxSessions

------------------------------------------------------------------------
(* -- Protocol States -------------------------------------------------- *)
(*
 * Handler states — map directly to HttpChan<S> typestates:
 *
 *   RECV_REQUEST   HttpChan<Recv<Request, ...>>     session.rs:330
 *   SELECT_BRANCH  HttpChan<Select<A, B>>           session.rs:226
 *   SEND_RESPONSE  HttpChan<Send<Response, End>>    session.rs:330 (left)
 *   SEND_ERROR     HttpChan<Send<ErrorResponse, End>> session.rs:330 (right)
 *   END            HttpChan<End>                    session.rs:269
 *   CLOSED         SessionProof produced            session.rs:271
 *   LEAKED         Drop bomb fired                  session.rs:282
 *
 * Caller states — dual of handler (session.rs:337):
 *
 *   SEND_REQUEST   HttpChan<Send<Request, ...>>
 *   OFFER_BRANCH   HttpChan<Offer<A, B>>
 *   RECV_RESPONSE  HttpChan<Recv<Response, End>>
 *   RECV_ERROR     HttpChan<Recv<ErrorResponse, End>>
 *   END            HttpChan<End>
 *   CLOSED         SessionProof produced
 *   LEAKED         Drop bomb fired
 *)

HandlerStates == {
    "RECV_REQUEST", "SELECT_BRANCH", "SEND_RESPONSE", "SEND_ERROR",
    "END", "CLOSED", "LEAKED"
}

CallerStates == {
    "SEND_REQUEST", "OFFER_BRANCH", "RECV_RESPONSE", "RECV_ERROR",
    "END", "CLOSED", "LEAKED"
}

------------------------------------------------------------------------
(* -- Variables -------------------------------------------------------- *)

VARIABLES
    hState,          \* Function: SessionId -> HandlerState
    cState,          \* Function: SessionId -> CallerState
    active,          \* Set of currently-active session IDs
    proofs,          \* Set of session IDs that produced a handler SessionProof
    leaked,          \* Set of session IDs where any drop bomb fired
    sendCount        \* Function: SessionId -> Nat (responses sent by handler)

vars == <<hState, cState, active, proofs, leaked, sendCount>>

------------------------------------------------------------------------
(* -- Type Invariant --------------------------------------------------- *)

TypeInvariant ==
    /\ \A s \in SessionIds :
        /\ hState[s] \in HandlerStates \cup {"INIT"}
        /\ cState[s] \in CallerStates \cup {"INIT"}
        /\ sendCount[s] \in Nat
    /\ active \subseteq SessionIds
    /\ proofs \subseteq SessionIds
    /\ leaked \subseteq SessionIds
    /\ proofs \cap leaked = {}

------------------------------------------------------------------------
(* -- Initial State ---------------------------------------------------- *)
(*
 * No sessions active. All channels in INIT state.
 * Reference: Before new_handler_session() is called (session.rs:342).
 *)

Init ==
    /\ hState = [s \in SessionIds |-> "INIT"]
    /\ cState = [s \in SessionIds |-> "INIT"]
    /\ active = {}
    /\ proofs = {}
    /\ leaked = {}
    /\ sendCount = [s \in SessionIds |-> 0]

------------------------------------------------------------------------
(* -- Actions ---------------------------------------------------------- *)

(* ================================================================== *)
(* Session Lifecycle                                                    *)
(* ================================================================== *)

(*
 * CreateSession: Allocate a new handler/caller pair.
 * Models new_handler_session() (session.rs:342-345).
 *
 * Handler starts at RECV_REQUEST  (Recv<Request, Select<...>>)
 * Caller starts at SEND_REQUEST   (Send<Request, Offer<...>>)
 *
 * These are duals: handler receives what caller sends.
 *)
CreateSession ==
    \E s \in SessionIds :
        /\ s \notin active
        /\ s \notin proofs
        /\ s \notin leaked
        /\ hState' = [hState EXCEPT ![s] = "RECV_REQUEST"]
        /\ cState' = [cState EXCEPT ![s] = "SEND_REQUEST"]
        /\ active' = active \cup {s}
        /\ sendCount' = [sendCount EXCEPT ![s] = 0]
        /\ UNCHANGED <<proofs, leaked>>

(* ================================================================== *)
(* Handler-Side Transitions                                            *)
(* ================================================================== *)

(*
 * HandlerRecv: Handler receives the request.
 * HttpChan<Recv<Request, Select<...>>> --recv(req)--> HttpChan<Select<...>>
 * Reference: session.rs:219 — recv(self, value: T) -> (T, HttpChan<S>)
 *)
HandlerRecv(s) ==
    /\ s \in active
    /\ hState[s] = "RECV_REQUEST"
    /\ hState' = [hState EXCEPT ![s] = "SELECT_BRANCH"]
    /\ UNCHANGED <<cState, active, proofs, leaked, sendCount>>

(*
 * HandlerSelectLeft: Handler selects the success (Response) branch.
 * HttpChan<Select<Send<Response,End>, Send<ErrorResponse,End>>>
 *   --select_left()--> HttpChan<Send<Response, End>>
 * Reference: session.rs:228-229
 *)
HandlerSelectLeft(s) ==
    /\ s \in active
    /\ hState[s] = "SELECT_BRANCH"
    /\ hState' = [hState EXCEPT ![s] = "SEND_RESPONSE"]
    /\ UNCHANGED <<cState, active, proofs, leaked, sendCount>>

(*
 * HandlerSelectRight: Handler selects the error (ErrorResponse) branch.
 * HttpChan<Select<...>> --select_right()--> HttpChan<Send<ErrorResponse, End>>
 * Reference: session.rs:232-234
 *)
HandlerSelectRight(s) ==
    /\ s \in active
    /\ hState[s] = "SELECT_BRANCH"
    /\ hState' = [hState EXCEPT ![s] = "SEND_ERROR"]
    /\ UNCHANGED <<cState, active, proofs, leaked, sendCount>>

(*
 * HandlerSendResponse: Handler sends a Response (success path).
 * HttpChan<Send<Response, End>> --send(resp)--> HttpChan<End>
 * Reference: session.rs:206-208
 *)
HandlerSendResponse(s) ==
    /\ s \in active
    /\ hState[s] = "SEND_RESPONSE"
    /\ hState' = [hState EXCEPT ![s] = "END"]
    /\ sendCount' = [sendCount EXCEPT ![s] = sendCount[s] + 1]
    /\ UNCHANGED <<cState, active, proofs, leaked>>

(*
 * HandlerSendError: Handler sends an ErrorResponse (error path).
 * HttpChan<Send<ErrorResponse, End>> --send(err)--> HttpChan<End>
 * Reference: session.rs:206-208
 *)
HandlerSendError(s) ==
    /\ s \in active
    /\ hState[s] = "SEND_ERROR"
    /\ hState' = [hState EXCEPT ![s] = "END"]
    /\ sendCount' = [sendCount EXCEPT ![s] = sendCount[s] + 1]
    /\ UNCHANGED <<cState, active, proofs, leaked>>

(*
 * HandlerClose: Handler closes the channel, producing SessionProof.
 * HttpChan<End> --close()--> SessionProof
 * Reference: session.rs:271-278
 *
 * close() calls std::mem::forget(self) to disarm the drop bomb,
 * then returns SessionProof { channel_id }.
 *
 * IMPORTANT: close() is ONLY available on HttpChan<End>.
 * The Rust type system enforces this at compile time.
 *)
HandlerClose(s) ==
    /\ s \in active
    /\ hState[s] = "END"
    /\ hState' = [hState EXCEPT ![s] = "CLOSED"]
    /\ proofs' = proofs \cup {s}
    /\ UNCHANGED <<cState, active, leaked, sendCount>>

(* ================================================================== *)
(* Caller-Side Transitions                                             *)
(* ================================================================== *)

(*
 * CallerSend: Caller sends the request to the handler.
 * HttpChan<Send<Request, Offer<...>>> --send(req)--> HttpChan<Offer<...>>
 * Reference: session.rs:206-208
 *)
CallerSend(s) ==
    /\ s \in active
    /\ cState[s] = "SEND_REQUEST"
    /\ cState' = [cState EXCEPT ![s] = "OFFER_BRANCH"]
    /\ UNCHANGED <<hState, active, proofs, leaked, sendCount>>

(*
 * CallerOfferLeft: Caller accepts the handler's left (success) selection.
 * HttpChan<Offer<Recv<Response,End>, Recv<ErrorResponse,End>>>
 *   --offer(Branch::Left)--> HttpChan<Recv<Response, End>>
 * Reference: session.rs:259 (Offered::Left)
 *
 * DUALITY: Handler select_left <-> Caller offer Left.
 *)
CallerOfferLeft(s) ==
    /\ s \in active
    /\ cState[s] = "OFFER_BRANCH"
    /\ cState' = [cState EXCEPT ![s] = "RECV_RESPONSE"]
    /\ UNCHANGED <<hState, active, proofs, leaked, sendCount>>

(*
 * CallerOfferRight: Caller accepts the handler's right (error) selection.
 * HttpChan<Offer<...>> --offer(Branch::Right)--> HttpChan<Recv<ErrorResponse, End>>
 * Reference: session.rs:261 (Offered::Right)
 *
 * DUALITY: Handler select_right <-> Caller offer Right.
 *)
CallerOfferRight(s) ==
    /\ s \in active
    /\ cState[s] = "OFFER_BRANCH"
    /\ cState' = [cState EXCEPT ![s] = "RECV_ERROR"]
    /\ UNCHANGED <<hState, active, proofs, leaked, sendCount>>

(*
 * CallerRecvResponse: Caller receives the Response.
 * HttpChan<Recv<Response, End>> --recv(resp)--> (resp, HttpChan<End>)
 *)
CallerRecvResponse(s) ==
    /\ s \in active
    /\ cState[s] = "RECV_RESPONSE"
    /\ cState' = [cState EXCEPT ![s] = "END"]
    /\ UNCHANGED <<hState, active, proofs, leaked, sendCount>>

(*
 * CallerRecvError: Caller receives the ErrorResponse.
 * HttpChan<Recv<ErrorResponse, End>> --recv(err)--> (err, HttpChan<End>)
 *)
CallerRecvError(s) ==
    /\ s \in active
    /\ cState[s] = "RECV_ERROR"
    /\ cState' = [cState EXCEPT ![s] = "END"]
    /\ UNCHANGED <<hState, active, proofs, leaked, sendCount>>

(*
 * CallerClose: Caller closes the channel.
 * HttpChan<End> --close()--> SessionProof
 *)
CallerClose(s) ==
    /\ s \in active
    /\ cState[s] = "END"
    /\ cState' = [cState EXCEPT ![s] = "CLOSED"]
    /\ UNCHANGED <<hState, active, proofs, leaked, sendCount>>

(* ================================================================== *)
(* Session Completion                                                   *)
(* ================================================================== *)

(*
 * SessionComplete: Both endpoints have closed. Remove from active set.
 * The session is fully consumed — both SessionProofs produced.
 *)
SessionComplete(s) ==
    /\ s \in active
    /\ hState[s] = "CLOSED"
    /\ cState[s] = "CLOSED"
    /\ active' = active \ {s}
    /\ UNCHANGED <<hState, cState, proofs, leaked, sendCount>>

(* ================================================================== *)
(* Drop Bomb                                                           *)
(* ================================================================== *)

(*
 * HandlerDropBomb: Handler channel dropped without reaching End.
 * Reference: session.rs:282-291
 *
 *   impl<S> Drop for HttpChan<S> {
 *       fn drop(&mut self) {
 *           if !self.closed {
 *               panic!("SESSION LEAKED: HttpChan {} dropped without
 *                       reaching End state", self.channel_id);
 *           }
 *       }
 *   }
 *
 * This fires when an HttpChan in RECV_REQUEST, SELECT_BRANCH,
 * SEND_RESPONSE, or SEND_ERROR state goes out of scope.
 * It CANNOT fire from END (close disarms) or CLOSED (forgotten).
 *)
HandlerDropBomb(s) ==
    /\ s \in active
    /\ hState[s] \in {"RECV_REQUEST", "SELECT_BRANCH",
                       "SEND_RESPONSE", "SEND_ERROR"}
    /\ hState' = [hState EXCEPT ![s] = "LEAKED"]
    /\ leaked' = leaked \cup {s}
    /\ UNCHANGED <<cState, active, proofs, sendCount>>

(*
 * CallerDropBomb: Caller channel dropped without reaching End.
 *)
CallerDropBomb(s) ==
    /\ s \in active
    /\ cState[s] \in {"SEND_REQUEST", "OFFER_BRANCH",
                       "RECV_RESPONSE", "RECV_ERROR"}
    /\ cState' = [cState EXCEPT ![s] = "LEAKED"]
    /\ leaked' = leaked \cup {s}
    /\ UNCHANGED <<hState, active, proofs, sendCount>>

------------------------------------------------------------------------
(* -- Terminal --------------------------------------------------------- *)

Terminal ==
    /\ active = {}
    /\ UNCHANGED vars

------------------------------------------------------------------------
(* -- Next-State Relation ---------------------------------------------- *)

Next ==
    \/ CreateSession
    \/ \E s \in SessionIds :
        \/ HandlerRecv(s)
        \/ HandlerSelectLeft(s)
        \/ HandlerSelectRight(s)
        \/ HandlerSendResponse(s)
        \/ HandlerSendError(s)
        \/ HandlerClose(s)
        \/ CallerSend(s)
        \/ CallerOfferLeft(s)
        \/ CallerOfferRight(s)
        \/ CallerRecvResponse(s)
        \/ CallerRecvError(s)
        \/ CallerClose(s)
        \/ SessionComplete(s)
        \/ HandlerDropBomb(s)
        \/ CallerDropBomb(s)
    \/ Terminal

------------------------------------------------------------------------
(* -- Fairness --------------------------------------------------------- *)
(*
 * Weak fairness on protocol transitions ensures channels make progress.
 * We do NOT require fairness on drop bombs — they model programmer
 * errors (forgetting to consume the channel), not intended behavior.
 *
 * This ensures that under correct usage, the protocol always completes.
 *)

Fairness ==
    /\ \A s \in SessionIds :
        /\ WF_vars(HandlerRecv(s))
        /\ WF_vars(HandlerSelectLeft(s) \/ HandlerSelectRight(s))
        /\ WF_vars(HandlerSendResponse(s))
        /\ WF_vars(HandlerSendError(s))
        /\ WF_vars(HandlerClose(s))
        /\ WF_vars(CallerSend(s))
        /\ WF_vars(CallerOfferLeft(s) \/ CallerOfferRight(s))
        /\ WF_vars(CallerRecvResponse(s))
        /\ WF_vars(CallerRecvError(s))
        /\ WF_vars(CallerClose(s))
        /\ WF_vars(SessionComplete(s))

------------------------------------------------------------------------
(* -- Specification ---------------------------------------------------- *)

Spec == Init /\ [][Next]_vars /\ Fairness

------------------------------------------------------------------------
(* -- Safety Properties ------------------------------------------------ *)

(*
 * S1: Exactly one response produced per session (no double-send).
 *
 * Each handler sends exactly one message: either a Response (via
 * HandlerSendResponse) or an ErrorResponse (via HandlerSendError),
 * never both, never more than once. The typestate machine enforces
 * this because send() consumes self — you cannot call it twice.
 *
 * Tracked by sendCount: it MUST be 0 or 1 for any active session.
 * Once the handler reaches END, sendCount is exactly 1.
 *)
ExactlyOneResponse ==
    \A s \in SessionIds :
        /\ sendCount[s] <= 1
        /\ (hState[s] = "END" => sendCount[s] = 1)
        /\ (hState[s] = "CLOSED" => sendCount[s] = 1)

(*
 * S2: close() only reachable from END state.
 *
 * In Rust, close() is ONLY implemented on HttpChan<End> (session.rs:269).
 * It is a compile error to call close() on any other state. We model
 * this as: if a channel transitioned to CLOSED, it was in END before.
 *
 * Invariant form: CLOSED implies the session was in END.
 * Since HandlerClose requires hState[s] = "END", this is structural.
 *)
CloseOnlyFromEnd ==
    \A s \in SessionIds :
        /\ (hState[s] = "CLOSED" => s \in proofs)
        /\ (hState[s] = "CLOSED" => sendCount[s] = 1)

(*
 * S3: LEAKED state is unreachable under correct protocol usage.
 *
 * "Correct usage" means no drop bombs fire — the programmer always
 * drives the channel to END and calls close(). Under the fairness
 * constraints (which model correct programming), the LEAKED state
 * is never entered.
 *
 * We express this as: leaked and proofs are disjoint. A session
 * that produced a proof was never leaked. More strongly: if a
 * session is in the proofs set, it was never in the leaked set.
 *
 * Note: LEAKED IS reachable in the general model (drop bombs exist).
 * It is unreachable ONLY under the fairness constraint that models
 * correct usage. We also state the invariant that proofs and leaked
 * are always disjoint (even in incorrect usage, you can't be both).
 *)
ProofAndLeakedDisjoint ==
    proofs \cap leaked = {}

(*
 * S4: Handler and caller duality — caller offers what handler selects.
 *
 * The handler uses Select (local choice) and the caller uses Offer
 * (remote choice). They are duals:
 *
 *   Handler Select<A, B>  <-->  Caller Offer<A, B>
 *   Handler select_left   <-->  Caller offer(Left)
 *   Handler select_right  <-->  Caller offer(Right)
 *
 * Operationally: when the handler is in SELECT_BRANCH, the caller
 * should be in OFFER_BRANCH (or have already moved past it). When
 * the handler sends a Response, the caller should receive a Response
 * (not an ErrorResponse).
 *
 * We express compatible state pairs for active sessions.
 *)
HandlerCallerDuality ==
    \A s \in active :
        \* Handler RECV <-> Caller SEND (Recv/Send duality)
        /\ (hState[s] = "RECV_REQUEST" =>
                cState[s] \in {"SEND_REQUEST", "OFFER_BRANCH"})
        \* Handler SELECT <-> Caller OFFER (Select/Offer duality)
        /\ (hState[s] = "SELECT_BRANCH" =>
                cState[s] \in {"OFFER_BRANCH", "SEND_REQUEST"})
        \* After handler sends, caller should be receiving on the matching branch
        \* or still in offer (message in flight)
        /\ (hState[s] = "END" =>
                cState[s] \in {"OFFER_BRANCH", "RECV_RESPONSE", "RECV_ERROR",
                               "END", "CLOSED", "LEAKED"})
        \* Both cannot be in INIT after activation
        /\ (hState[s] # "INIT")

(*
 * S5 (bonus): CLOSED and LEAKED are absorbing states.
 *
 * Once a channel enters CLOSED or LEAKED, it stays there forever.
 * CLOSED: the channel was consumed by close() + std::mem::forget(self).
 * LEAKED: the drop bomb fired — the process is panicking.
 *)
AbsorbingStates ==
    \A s \in SessionIds :
        /\ (hState[s] = "CLOSED" => hState'[s] = "CLOSED")
        /\ (hState[s] = "LEAKED" => hState'[s] = "LEAKED")
        /\ (cState[s] = "CLOSED" => cState'[s] = "CLOSED")
        /\ (cState[s] = "LEAKED" => cState'[s] = "LEAKED")

(*
 * S6 (bonus): No state can transition backwards.
 *
 * The handler follows a strict linear path:
 *   RECV_REQUEST -> SELECT_BRANCH -> SEND_RESPONSE|SEND_ERROR -> END -> CLOSED
 * No action can move the handler backwards (e.g., END -> RECV_REQUEST).
 * This is enforced structurally by the action guards.
 *)
NoBackwardTransition ==
    \A s \in active :
        /\ (hState[s] = "END" =>
                hState'[s] \in {"END", "CLOSED", "LEAKED"})
        /\ (hState[s] = "SEND_RESPONSE" =>
                hState'[s] \in {"SEND_RESPONSE", "END", "LEAKED"})
        /\ (hState[s] = "SEND_ERROR" =>
                hState'[s] \in {"SEND_ERROR", "END", "LEAKED"})

------------------------------------------------------------------------
(* -- Liveness Properties ---------------------------------------------- *)

(*
 * L1: Under fairness, every session eventually reaches END or LEAKED.
 *
 * Every active session makes progress. If the programmer follows the
 * protocol (no drops), it reaches END then CLOSED. If dropped, the
 * bomb fires (LEAKED). Either way, the session leaves the active set.
 *)
EventualEndOrLeaked ==
    \A s \in SessionIds :
        s \in active ~>
            (hState[s] \in {"END", "CLOSED", "LEAKED"})

(*
 * L2: If handler doesn't panic, session reaches END (not LEAKED).
 *
 * More precisely: if the handler reaches END, it eventually produces
 * a SessionProof via close(). The converse of the drop bomb — a
 * well-behaved handler always completes.
 *)
CorrectHandlerReachesEnd ==
    \A s \in SessionIds :
        hState[s] = "END" ~> s \in proofs

(*
 * L3 (bonus): Every active session eventually completes (both sides close).
 *)
EventualCompletion ==
    \A s \in SessionIds :
        s \in active ~>
            (hState[s] \in {"CLOSED", "LEAKED"} /\
             cState[s] \in {"CLOSED", "LEAKED"})

==========================================================================
