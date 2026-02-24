------------------------- MODULE MiddlewareChain -------------------------
(*
 * Middleware onion model specification.
 *
 * Models the composable middleware stack as implemented in ava-web's
 * MiddlewareStack (middleware.rs:375-424) and Router.run_middleware
 * (router.rs:333-345).
 *
 * Key behaviors modeled:
 *   - LIFO ordering: last added = outermost = runs first on request
 *   - Onion model: inbound pass (request), then outbound pass (response)
 *   - Short-circuit: any middleware can return without calling next.run()
 *   - The terminal Next (dispatch_inner) is consumed exactly once
 *
 * Reference implementation:
 *   middleware.rs:394-410 — recursive build() function
 *   router.rs:333-345     — run_middleware recursive chain
 *
 * The MiddlewareStack.handle() builds the chain from inside out:
 *   layers[0].handle(req, Next(|r| layers[1].handle(r, Next(|r| ... terminal))))
 *   But Router.run_middleware builds LIFO: idx = mw_count-1 downward.
 *
 * For this spec, position tracks which layer we're at (1..NumMiddlewares),
 * and direction tracks whether we're in the inbound or outbound phase.
 *)
EXTENDS Naturals, Sequences, FiniteSets

------------------------------------------------------------------------
(* ── Constants ─────────────────────────────────────────────────────── *)

CONSTANT NumMiddlewares  \* Number of middleware layers in the stack

ASSUME NumMiddlewares \in Nat /\ NumMiddlewares >= 1

------------------------------------------------------------------------
(* ── Variables ─────────────────────────────────────────────────────── *)

VARIABLES
    position,        \* Current middleware layer (0 = outside stack, 1..N = layer)
    direction,       \* "INBOUND" (request phase) or "OUTBOUND" (response phase)
    shortCircuited,  \* TRUE if a middleware returned without calling next
    executed,        \* Sequence of <<direction, layer>> recording execution order
    handlerReached   \* TRUE if the terminal handler was invoked

vars == <<position, direction, shortCircuited, executed, handlerReached>>

------------------------------------------------------------------------
(* ── Type Invariant ────────────────────────────────────────────────── *)

TypeInvariant ==
    /\ position \in 0..NumMiddlewares
    /\ direction \in {"INBOUND", "OUTBOUND"}
    /\ shortCircuited \in BOOLEAN
    /\ handlerReached \in BOOLEAN

------------------------------------------------------------------------
(* ── Initial State ─────────────────────────────────────────────────── *)
(*
 * Request enters the outermost middleware (position 0, about to enter 1).
 *)
Init ==
    /\ position = 0
    /\ direction = "INBOUND"
    /\ shortCircuited = FALSE
    /\ executed = <<>>
    /\ handlerReached = FALSE

------------------------------------------------------------------------
(* ── Actions ───────────────────────────────────────────────────────── *)

(*
 * AdvanceInbound: Move deeper into the middleware stack.
 * Each middleware calls next.run(req) to pass the request inward.
 * Reference: middleware.rs — mw.handle(req, next) calling next.run(req)
 *)
AdvanceInbound ==
    /\ direction = "INBOUND"
    /\ ~shortCircuited
    /\ position < NumMiddlewares
    /\ position' = position + 1
    /\ executed' = Append(executed, <<"INBOUND", position + 1>>)
    /\ UNCHANGED <<direction, shortCircuited, handlerReached>>

(*
 * ReachHandler: All middleware passed — invoke the terminal handler.
 * This is the actual route handler (dispatch_inner).
 * Reference: router.rs:337-338 — innermost Next calls dispatch_inner
 * Reference: middleware.rs:400-405 — terminal Next consumed once
 *)
ReachHandler ==
    /\ direction = "INBOUND"
    /\ position = NumMiddlewares
    /\ ~shortCircuited
    /\ direction' = "OUTBOUND"
    /\ handlerReached' = TRUE
    /\ executed' = Append(executed, <<"HANDLER", 0>>)
    /\ UNCHANGED <<position, shortCircuited>>

(*
 * ShortCircuit: A middleware returns a response without calling next.
 * Models: RateLimiter returning 429 (middleware.rs:259-268),
 *         MaxBodySize returning 413 (middleware.rs:298-305),
 *         BlockMiddleware returning 403 (router.rs:567-577).
 *
 * Once short-circuited, the outbound phase starts from the current
 * position, unwinding only the middlewares that were entered.
 *)
ShortCircuit ==
    /\ direction = "INBOUND"
    /\ position > 0  \* Must be inside at least one middleware
    /\ ~shortCircuited
    /\ shortCircuited' = TRUE
    /\ direction' = "OUTBOUND"
    /\ executed' = Append(executed, <<"SHORT_CIRCUIT", position>>)
    /\ UNCHANGED <<position, handlerReached>>

(*
 * AdvanceOutbound: Unwind through middleware layers (response phase).
 * Each middleware's handle() returns the modified response to its caller.
 * Reference: middleware.rs — after `let resp = next.run(req).await`,
 *            the middleware modifies resp and returns it.
 *)
AdvanceOutbound ==
    /\ direction = "OUTBOUND"
    /\ position > 0
    /\ position' = position - 1
    /\ executed' = Append(executed, <<"OUTBOUND", position>>)
    /\ UNCHANGED <<direction, shortCircuited, handlerReached>>

(*
 * Done: Response has unwound through all entered middlewares.
 * The response is now ready to be serialized to the client.
 * Modeled as a self-loop (stuttering) on the terminal state.
 *)
Done ==
    /\ direction = "OUTBOUND"
    /\ position = 0
    /\ UNCHANGED vars

------------------------------------------------------------------------
(* ── Terminal Predicate ────────────────────────────────────────────── *)

Complete ==
    /\ direction = "OUTBOUND"
    /\ position = 0

------------------------------------------------------------------------
(* ── Next-State Relation ───────────────────────────────────────────── *)

Next ==
    \/ AdvanceInbound
    \/ ReachHandler
    \/ ShortCircuit
    \/ AdvanceOutbound
    \/ Done

------------------------------------------------------------------------
(* ── Fairness ──────────────────────────────────────────────────────── *)
(*
 * We require weak fairness on all actions to ensure progress.
 * ShortCircuit is non-deterministic — it MAY happen, not MUST.
 *)

Fairness ==
    /\ WF_vars(AdvanceInbound)
    /\ WF_vars(ReachHandler)
    /\ WF_vars(AdvanceOutbound)

------------------------------------------------------------------------
(* ── Specification ─────────────────────────────────────────────────── *)

Spec == Init /\ [][Next]_vars /\ Fairness

------------------------------------------------------------------------
(* ── Safety Properties ─────────────────────────────────────────────── *)

(*
 * S1: Onion ordering — every outbound layer was previously entered inbound.
 * For every OUTBOUND entry at layer L, there exists a prior INBOUND entry
 * at the same layer L.
 *
 * This is THE key invariant of the middleware onion model.
 * It ensures no middleware's response phase runs without its request phase.
 *)
OnionOrdering ==
    \A i \in 1..Len(executed) :
        executed[i][1] = "OUTBOUND" =>
            \E j \in 1..(i-1) :
                /\ executed[j][1] = "INBOUND"
                /\ executed[j][2] = executed[i][2]

(*
 * S2: Short-circuit skips deeper layers.
 * If short-circuited at position P, no INBOUND entries exist for layers > P.
 *)
ShortCircuitSkipsDeeper ==
    shortCircuited =>
        LET scIdx == CHOOSE i \in 1..Len(executed) :
                         executed[i][1] = "SHORT_CIRCUIT"
            scLayer == executed[scIdx][2]
        IN \A j \in (scIdx+1)..Len(executed) :
               executed[j][1] = "INBOUND" => executed[j][2] <= scLayer

(*
 * S3: Handler is reached exactly once (or zero times if short-circuited).
 * Reference: middleware.rs:403-404 — "terminal Next consumed more than once"
 *            uses .take() to enforce at-most-once.
 *)
HandlerAtMostOnce ==
    LET handlerEntries == {i \in 1..Len(executed) : executed[i][1] = "HANDLER"}
    IN Cardinality(handlerEntries) <= 1

(*
 * S4: If handler was reached, short-circuit did not happen, and vice versa.
 *)
HandlerXorShortCircuit ==
    ~(handlerReached /\ shortCircuited)

(*
 * S5: Outbound unwinds in reverse order of inbound.
 * If OUTBOUND entries appear at layers L1 and L2 (L1 before L2 in the
 * executed sequence), then L1 > L2 (unwinding from inside out).
 *)
OutboundReversesInbound ==
    \A i, j \in 1..Len(executed) :
        /\ i < j
        /\ executed[i][1] = "OUTBOUND"
        /\ executed[j][1] = "OUTBOUND"
        => executed[i][2] > executed[j][2]

(*
 * S6: Inbound advances in order (1, 2, 3, ...).
 *)
InboundMonotonic ==
    \A i, j \in 1..Len(executed) :
        /\ i < j
        /\ executed[i][1] = "INBOUND"
        /\ executed[j][1] = "INBOUND"
        => executed[i][2] < executed[j][2]

------------------------------------------------------------------------
(* ── Liveness Properties ───────────────────────────────────────────── *)

(*
 * L1: The middleware chain eventually completes (reaches position 0 outbound).
 *)
EventualCompletion ==
    <>(direction = "OUTBOUND" /\ position = 0)

(*
 * L2: If not short-circuited, the handler is eventually reached.
 *)
EventualHandlerIfNoShortCircuit ==
    ~shortCircuited ~> (handlerReached \/ shortCircuited)

==========================================================================
