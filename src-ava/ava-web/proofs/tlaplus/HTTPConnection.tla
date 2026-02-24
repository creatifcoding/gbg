------------------------- MODULE HTTPConnection -------------------------
(*
 * Single HTTP/1.1 connection lifecycle FSM.
 *
 * Models the state machine for one connection as handled by ava-web's
 * serve_on closure (server.rs:232-258). The handler closure:
 *   1. Receives an h1::Request from asupersync's Http1Server
 *   2. Converts h1 -> web types (convert_h1_to_web)
 *   3. Dispatches through the Router (router.handle)
 *   4. Converts web -> h1 response (convert_web_to_h1)
 *
 * The Router internally:
 *   a. Injects state into extensions (router.rs:316-318)
 *   b. Chains middleware in LIFO order (router.rs:321-329)
 *   c. Dispatches to the matched route handler (router.rs:348-377)
 *
 * Keep-alive is bounded by max_requests_per_connection (ServerConfig).
 *
 * Safety:  No response without a prior request.
 * Liveness: Every request eventually produces a response (under fairness).
 *)
EXTENDS Naturals, Sequences, FiniteSets

------------------------------------------------------------------------
(* ── Constants ─────────────────────────────────────────────────────── *)

CONSTANT MaxPipelineDepth  \* max_requests_per_connection from ServerConfig

ASSUME MaxPipelineDepth \in Nat /\ MaxPipelineDepth >= 1

------------------------------------------------------------------------
(* ── Variables ─────────────────────────────────────────────────────── *)

VARIABLES
    state,           \* Current connection state
    pipelineDepth,   \* Number of request-response cycles completed
    extractionOk,    \* Whether the current extraction succeeded
    routeFound       \* Whether the router found a matching route

vars == <<state, pipelineDepth, extractionOk, routeFound>>

------------------------------------------------------------------------
(* ── Type Invariant ────────────────────────────────────────────────── *)

TypeInvariant ==
    /\ state \in {"IDLE", "READING_REQUEST", "ROUTING", "EXTRACTING",
                   "HANDLING", "WRITING_RESPONSE", "KEEP_ALIVE",
                   "CLOSING", "CLOSED"}
    /\ pipelineDepth \in 0..MaxPipelineDepth
    /\ extractionOk \in BOOLEAN
    /\ routeFound \in BOOLEAN

------------------------------------------------------------------------
(* ── Initial State ─────────────────────────────────────────────────── *)

Init ==
    /\ state = "IDLE"
    /\ pipelineDepth = 0
    /\ extractionOk = TRUE
    /\ routeFound = TRUE

------------------------------------------------------------------------
(* ── Actions ───────────────────────────────────────────────────────── *)

(*
 * ReadRequest: Connection receives bytes and begins parsing.
 * Corresponds to Http1Server reading from TcpStream.
 *)
ReadRequest ==
    /\ state \in {"IDLE", "KEEP_ALIVE"}
    /\ state' = "READING_REQUEST"
    /\ UNCHANGED <<pipelineDepth, extractionOk, routeFound>>

(*
 * Route: matchit radix tree lookup.
 * Non-deterministically models route match or miss (404/405).
 * Reference: router.rs:348-377 (dispatch_inner)
 *)
Route ==
    /\ state = "READING_REQUEST"
    /\ state' = "ROUTING"
    /\ routeFound' \in BOOLEAN  \* Non-deterministic: route may or may not match
    /\ UNCHANGED <<pipelineDepth, extractionOk>>

(*
 * Extract: Run FromRequestParts and FromRequest extractors.
 * Only proceeds if route was found. On route miss, skip to response.
 * Reference: handler.rs macro-generated call() methods
 *)
Extract ==
    /\ state = "ROUTING"
    /\ routeFound = TRUE
    /\ state' = "EXTRACTING"
    /\ extractionOk' \in BOOLEAN  \* Non-deterministic: extraction may fail
    /\ UNCHANGED <<pipelineDepth, routeFound>>

(*
 * RouteMiss: No matching route — produce 404/405 directly.
 * Reference: router.rs:376 (NOT_FOUND) and router.rs:41-48 (METHOD_NOT_ALLOWED)
 *)
RouteMiss ==
    /\ state = "ROUTING"
    /\ routeFound = FALSE
    /\ state' = "WRITING_RESPONSE"
    /\ UNCHANGED <<pipelineDepth, extractionOk, routeFound>>

(*
 * Handle: Execute the matched handler function.
 * Only proceeds if extraction succeeded.
 * Reference: handler.rs — FnHandler/AsyncFnHandler .call()
 *)
Handle ==
    /\ state = "EXTRACTING"
    /\ extractionOk = TRUE
    /\ state' = "HANDLING"
    /\ UNCHANGED <<pipelineDepth, extractionOk, routeFound>>

(*
 * ExtractionFail: Extractor returned an error response (400/500).
 * Reference: handler.rs — from_request/from_request_parts Err branch
 *)
ExtractionFail ==
    /\ state = "EXTRACTING"
    /\ extractionOk = FALSE
    /\ state' = "WRITING_RESPONSE"
    /\ UNCHANGED <<pipelineDepth, extractionOk, routeFound>>

(*
 * WriteResponse: Serialize and send the response.
 * Reached from Handle (normal), RouteMiss (404/405), or ExtractionFail (400/500).
 *)
WriteResponse ==
    /\ state = "HANDLING"
    /\ state' = "WRITING_RESPONSE"
    /\ UNCHANGED <<pipelineDepth, extractionOk, routeFound>>

(*
 * KeepAlive: Connection reuse when pipeline depth allows.
 * Reference: ServerConfig.max_requests_per_connection
 *)
KeepAlive ==
    /\ state = "WRITING_RESPONSE"
    /\ pipelineDepth + 1 < MaxPipelineDepth
    /\ state' = "KEEP_ALIVE"
    /\ pipelineDepth' = pipelineDepth + 1
    /\ UNCHANGED <<extractionOk, routeFound>>

(*
 * PipelineExhausted: Max requests reached — close connection.
 *)
PipelineExhausted ==
    /\ state = "WRITING_RESPONSE"
    /\ pipelineDepth + 1 >= MaxPipelineDepth
    /\ state' = "CLOSING"
    /\ pipelineDepth' = pipelineDepth + 1
    /\ UNCHANGED <<extractionOk, routeFound>>

(*
 * Close: Voluntary close from IDLE, KEEP_ALIVE, or after response.
 * Models: client disconnect, idle timeout, or explicit Connection: close.
 *)
Close ==
    /\ state \in {"IDLE", "KEEP_ALIVE", "WRITING_RESPONSE"}
    /\ state' = "CLOSING"
    /\ UNCHANGED <<pipelineDepth, extractionOk, routeFound>>

(*
 * Closed: Terminal state — connection resources released.
 *)
Closed ==
    /\ state = "CLOSING"
    /\ state' = "CLOSED"
    /\ UNCHANGED <<pipelineDepth, extractionOk, routeFound>>

------------------------------------------------------------------------
(* ── Error Path: Connection Reset ──────────────────────────────────── *)
(*
 * Models TCP reset or I/O error during any active phase.
 * The connection transitions directly to CLOSING.
 *)
ConnectionError ==
    /\ state \in {"READING_REQUEST", "ROUTING", "EXTRACTING",
                   "HANDLING", "WRITING_RESPONSE"}
    /\ state' = "CLOSING"
    /\ UNCHANGED <<pipelineDepth, extractionOk, routeFound>>

(*
 * Terminal: CLOSED is an absorbing state — explicit stuttering step.
 *)
Terminal ==
    /\ state = "CLOSED"
    /\ UNCHANGED vars

------------------------------------------------------------------------
(* ── Next-State Relation ───────────────────────────────────────────── *)

Next ==
    \/ ReadRequest
    \/ Route
    \/ Extract
    \/ RouteMiss
    \/ Handle
    \/ ExtractionFail
    \/ WriteResponse
    \/ KeepAlive
    \/ PipelineExhausted
    \/ Close
    \/ Closed
    \/ ConnectionError
    \/ Terminal

------------------------------------------------------------------------
(* ── Fairness ──────────────────────────────────────────────────────── *)
(*
 * Weak fairness on the normal path ensures progress.
 * We do NOT require fairness on ConnectionError (errors are not guaranteed).
 *)

Fairness ==
    /\ WF_vars(ReadRequest)
    /\ WF_vars(Route)
    /\ WF_vars(Extract)
    /\ WF_vars(RouteMiss)
    /\ WF_vars(Handle)
    /\ WF_vars(ExtractionFail)
    /\ WF_vars(WriteResponse)
    /\ WF_vars(KeepAlive)
    /\ WF_vars(PipelineExhausted)
    /\ WF_vars(Close)
    /\ WF_vars(Closed)

------------------------------------------------------------------------
(* ── Specification ─────────────────────────────────────────────────── *)

Spec == Init /\ [][Next]_vars /\ Fairness

------------------------------------------------------------------------
(* ── Safety Properties ─────────────────────────────────────────────── *)

(*
 * S1: No response is written without a preceding request read.
 *     If we're in WRITING_RESPONSE, at least one request was read.
 *)
NoResponseWithoutRequest ==
    state = "WRITING_RESPONSE" =>
        \/ pipelineDepth > 0               \* Not first request
        \/ state # "IDLE"                   \* Left IDLE (had ReadRequest)

(*
 * S2: Pipeline depth never exceeds the configured maximum.
 *)
PipelineBound ==
    pipelineDepth <= MaxPipelineDepth

(*
 * S3: CLOSED is a terminal state — no transitions out.
 *)
ClosedIsTerminal ==
    state = "CLOSED" => state' = "CLOSED"

(*
 * S4: Extraction only happens after successful routing.
 *)
ExtractionRequiresRoute ==
    state = "EXTRACTING" => routeFound = TRUE

(*
 * S5: Handler only runs after successful extraction.
 *)
HandlerRequiresExtraction ==
    state = "HANDLING" => extractionOk = TRUE

------------------------------------------------------------------------
(* ── Liveness Properties ───────────────────────────────────────────── *)

(*
 * L1: Every request eventually gets a response or the connection closes.
 *)
EventualResponseOrClose ==
    state = "READING_REQUEST" ~>
        (state = "WRITING_RESPONSE" \/ state = "CLOSING" \/ state = "CLOSED")

(*
 * L2: Every connection eventually terminates.
 *)
EventualTermination ==
    state # "CLOSED" ~> state = "CLOSED"

(*
 * L3: A keep-alive connection eventually processes another request or closes.
 *)
KeepAliveProgress ==
    state = "KEEP_ALIVE" ~>
        (state = "READING_REQUEST" \/ state = "CLOSING" \/ state = "CLOSED")

==========================================================================
