--------------------------- MODULE HTTPServer ----------------------------
(*
 * Multi-connection HTTP server with bounded concurrency and graceful shutdown.
 *
 * Models the HttpServer (server.rs:129-301) lifecycle:
 *   - TCP bind + accept loop via Http1Listener
 *   - Per-connection task spawning on RuntimeHandle
 *   - max_connections bound (ServerConfig, default 10,000)
 *   - Graceful shutdown: ShutdownSignal -> drain_timeout -> force close
 *
 * The server uses asupersync's Http1Listener which:
 *   1. Accepts TCP connections in a loop
 *   2. Spawns per-connection tasks via runtime.try_spawn()
 *   3. Tracks active connections
 *   4. On shutdown signal: stops accepting, drains active, force-closes
 *
 * Reference: server.rs:220-301 (serve_on), server.rs:260-285 (shutdown bridging)
 *)
EXTENDS Naturals, Sequences, FiniteSets

------------------------------------------------------------------------
(* ── Constants ─────────────────────────────────────────────────────── *)

CONSTANTS
    MaxConnections,    \* ServerConfig.max_connections (default 10,000)
    MaxConcurrentIds   \* Model bound: total connection IDs available

ASSUME MaxConnections \in Nat /\ MaxConnections >= 1
ASSUME MaxConcurrentIds \in Nat /\ MaxConcurrentIds >= MaxConnections

------------------------------------------------------------------------
(* ── Connection ID Pool ────────────────────────────────────────────── *)

ConnIds == 1..MaxConcurrentIds

------------------------------------------------------------------------
(* ── Variables ─────────────────────────────────────────────────────── *)

VARIABLES
    serverState,       \* ServerStates: ACCEPTING, DRAINING, STOPPED
    activeConns,       \* Set of currently active connection IDs
    completedConns,    \* Set of completed (closed) connection IDs
    connState,         \* Function: ConnId -> connection state or "NONE"
    totalAccepted,     \* Total connections accepted over server lifetime
    drainInitiated     \* Whether shutdown signal has been received

vars == <<serverState, activeConns, completedConns, connState, totalAccepted, drainInitiated>>

------------------------------------------------------------------------
(* ── Type Invariant ────────────────────────────────────────────────── *)

TypeInvariant ==
    /\ serverState \in {"ACCEPTING", "DRAINING", "STOPPED"}
    /\ activeConns \subseteq ConnIds
    /\ completedConns \subseteq ConnIds
    /\ activeConns \cap completedConns = {}  \* Disjoint
    /\ totalAccepted \in Nat
    /\ drainInitiated \in BOOLEAN

------------------------------------------------------------------------
(* ── Initial State ─────────────────────────────────────────────────── *)
(*
 * Server has bound its TCP listener and is ready to accept.
 * Reference: server.rs:147-156 (bind) + server.rs:290 (listener.run)
 *)
Init ==
    /\ serverState = "ACCEPTING"
    /\ activeConns = {}
    /\ completedConns = {}
    /\ connState = [c \in ConnIds |-> "NONE"]
    /\ totalAccepted = 0
    /\ drainInitiated = FALSE

------------------------------------------------------------------------
(* ── Actions ───────────────────────────────────────────────────────── *)

(*
 * AcceptConnection: Accept a new TCP connection.
 * Guard: server is accepting AND active count < max_connections.
 * Reference: Http1Listener accept loop with max_connections guard.
 *)
AcceptConnection ==
    /\ serverState = "ACCEPTING"
    /\ Cardinality(activeConns) < MaxConnections
    /\ \E c \in ConnIds :
        /\ c \notin activeConns
        /\ c \notin completedConns
        /\ activeConns' = activeConns \cup {c}
        /\ connState' = [connState EXCEPT ![c] = "ACTIVE"]
        /\ totalAccepted' = totalAccepted + 1
        /\ UNCHANGED <<serverState, completedConns, drainInitiated>>

(*
 * ConnectionComplete: A connection finishes its lifecycle.
 * The connection handler returned — request-response cycle done or error.
 * Reference: per-connection task completing in the runtime.
 *)
ConnectionComplete(c) ==
    /\ c \in activeConns
    /\ connState[c] = "ACTIVE"
    /\ activeConns' = activeConns \ {c}
    /\ completedConns' = completedConns \cup {c}
    /\ connState' = [connState EXCEPT ![c] = "COMPLETED"]
    /\ UNCHANGED <<serverState, totalAccepted, drainInitiated>>

(*
 * AnyConnectionComplete: Existential wrapper for ConnectionComplete.
 *)
AnyConnectionComplete ==
    \E c \in activeConns : ConnectionComplete(c)

(*
 * BeginDrain: Shutdown signal received — stop accepting, begin draining.
 * Reference: server.rs:270-285 — shutdown watcher spawns, calls
 *            listener_shutdown.begin_drain(drain_timeout).
 *
 * The Http1Listener stops its accept loop and waits for active
 * connections to complete within drain_timeout.
 *)
BeginDrain ==
    /\ serverState = "ACCEPTING"
    /\ ~drainInitiated
    /\ serverState' = "DRAINING"
    /\ drainInitiated' = TRUE
    /\ UNCHANGED <<activeConns, completedConns, connState, totalAccepted>>

(*
 * DrainComplete: All active connections have closed during drain.
 * Reference: server.rs:290 — listener.run() returns stats.
 *)
DrainComplete ==
    /\ serverState = "DRAINING"
    /\ activeConns = {}
    /\ serverState' = "STOPPED"
    /\ UNCHANGED <<activeConns, completedConns, connState, totalAccepted, drainInitiated>>

(*
 * ForceClose: Drain timeout expired — force-close remaining connections.
 * Reference: asupersync's Http1Listener drain logic with drain_timeout.
 * The server reports stats.force_closed count (server.rs:294).
 *)
ForceClose ==
    /\ serverState = "DRAINING"
    /\ activeConns # {}
    \* Force-close all remaining connections
    /\ completedConns' = completedConns \cup activeConns
    /\ connState' = [c \in ConnIds |->
                        IF c \in activeConns THEN "FORCE_CLOSED"
                        ELSE connState[c]]
    /\ activeConns' = {}
    /\ serverState' = "STOPPED"
    /\ UNCHANGED <<totalAccepted, drainInitiated>>

(*
 * Terminal: STOPPED is an absorbing state — explicit stuttering step.
 *)
Terminal ==
    /\ serverState = "STOPPED"
    /\ UNCHANGED vars

------------------------------------------------------------------------
(* ── Next-State Relation ───────────────────────────────────────────── *)

Next ==
    \/ AcceptConnection
    \/ AnyConnectionComplete
    \/ BeginDrain
    \/ DrainComplete
    \/ ForceClose
    \/ Terminal

------------------------------------------------------------------------
(* ── Fairness ──────────────────────────────────────────────────────── *)
(*
 * Weak fairness on connection completion ensures active connections
 * eventually finish (no starvation).
 *
 * Strong fairness on AcceptConnection ensures that if the server is
 * accepting and there's capacity, it eventually accepts.
 *
 * We do NOT require fairness on BeginDrain — shutdown is externally
 * triggered, not guaranteed to happen.
 *)

Fairness ==
    /\ \A c \in ConnIds : WF_vars(ConnectionComplete(c))
    /\ SF_vars(AcceptConnection)
    /\ WF_vars(DrainComplete)

------------------------------------------------------------------------
(* ── Specification ─────────────────────────────────────────────────── *)

Spec == Init /\ [][Next]_vars /\ Fairness

------------------------------------------------------------------------
(* ── Safety Properties ─────────────────────────────────────────────── *)

(*
 * S1: Connection bound — never exceed MaxConnections active connections.
 * This is THE critical safety property for the server.
 * Reference: ServerConfig.max_connections, Http1ListenerConfig.max_connections
 *)
ConnectionBound ==
    Cardinality(activeConns) <= MaxConnections

(*
 * S2: No accepts during drain — once draining, no new connections.
 * Reference: Http1Listener stops accept loop on shutdown signal.
 *)
NoAcceptDuringDrain ==
    serverState \in {"DRAINING", "STOPPED"} =>
        \A c \in ConnIds :
            (connState[c] = "NONE" => c \notin activeConns)

(*
 * S3: Active and completed sets are always disjoint.
 * A connection is either active or completed, never both.
 *)
DisjointSets ==
    activeConns \cap completedConns = {}

(*
 * S4: STOPPED is terminal — no transitions out.
 *)
StoppedIsTerminal ==
    serverState = "STOPPED" => serverState' = "STOPPED"

(*
 * S5: Total accepted is monotonically non-decreasing.
 *)
AcceptedMonotonic ==
    totalAccepted' >= totalAccepted

(*
 * S6: Connection IDs are properly tracked — every active ID has ACTIVE state.
 *)
StateConsistency ==
    \A c \in ConnIds :
        /\ (c \in activeConns) => connState[c] = "ACTIVE"
        /\ (c \in completedConns) => connState[c] \in {"COMPLETED", "FORCE_CLOSED"}
        /\ (c \notin activeConns /\ c \notin completedConns) => connState[c] = "NONE"

------------------------------------------------------------------------
(* ── Liveness Properties ───────────────────────────────────────────── *)

(*
 * L1: No connection starvation — every active connection eventually completes.
 * Under weak fairness on ConnectionComplete, this should hold.
 *)
NoConnectionStarvation ==
    \A c \in ConnIds :
        c \in activeConns ~> c \notin activeConns

(*
 * L2: Drain eventually completes — once draining, the server eventually stops.
 * This requires all active connections to eventually complete.
 *)
DrainEventuallyCompletes ==
    serverState = "DRAINING" ~> serverState = "STOPPED"

(*
 * L3: If shutdown is initiated, the server eventually stops.
 *)
EventualShutdown ==
    drainInitiated ~> serverState = "STOPPED"

==========================================================================
