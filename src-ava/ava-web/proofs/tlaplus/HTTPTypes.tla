---------------------------- MODULE HTTPTypes ----------------------------
(*
 * Shared type definitions for ava-web TLA+ specifications.
 *
 * These model the core HTTP protocol types as used by the ava-web
 * framework. Constants are parameterized for TLC model checking with
 * finite state spaces.
 *
 * Reference: src-ava/ava-web/src/server.rs, src/extractor.rs
 *)
EXTENDS Naturals, Sequences, FiniteSets

------------------------------------------------------------------------
(* ── Constants ─────────────────────────────────────────────────────── *)

CONSTANTS
    MaxConnections,        \* Server-level connection bound (default 10,000)
    MaxPipelineDepth,      \* Per-connection keep-alive request limit (default 1,000)
    MaxMiddlewares         \* Maximum middleware layers in a stack

------------------------------------------------------------------------
(* ── HTTP Methods ──────────────────────────────────────────────────── *)

Methods == {"GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"}

------------------------------------------------------------------------
(* ── Status Code Classes ───────────────────────────────────────────── *)
(*
 * We model status codes as representative values per class rather than
 * the full 100..599 range to keep the state space tractable for TLC.
 *)

StatusCodes == {200, 201, 204, 301, 400, 403, 404, 405, 408, 413, 429, 500, 502, 504}

Informational(s) == s \in 100..199
Success(s)       == s \in 200..299
Redirection(s)   == s \in 300..399
ClientError(s)   == s \in 400..499
ServerError(s)   == s \in 500..599

------------------------------------------------------------------------
(* ── Request / Response Records ────────────────────────────────────── *)
(*
 * Simplified records — we omit body/headers content since the TLA+
 * specs focus on control flow (state transitions, ordering) rather
 * than data transformation.
 *)

RequestShape  == [method: Methods, path: STRING]
ResponseShape == [status: StatusCodes]

------------------------------------------------------------------------
(* ── Connection States ─────────────────────────────────────────────── *)
(*
 * Models the lifecycle of a single HTTP/1.1 connection as implemented
 * in ava-web's serve_on handler closure (server.rs:232-258).
 *
 * IDLE           → Connection accepted, waiting for request bytes
 * READING_REQUEST → Parsing h1::Request from TCP stream
 * ROUTING         → matchit radix tree lookup (router.rs:348-377)
 * EXTRACTING      → Running FromRequest/FromRequestParts extractors
 * HANDLING        → Executing the handler function
 * WRITING_RESPONSE → Serializing response back to h1::Response
 * KEEP_ALIVE      → Connection reuse (pipelineDepth < max)
 * CLOSING         → Drain/shutdown initiated
 * CLOSED          → Connection fully terminated
 *)

ConnectionStates == {
    "IDLE",
    "READING_REQUEST",
    "ROUTING",
    "EXTRACTING",
    "HANDLING",
    "WRITING_RESPONSE",
    "KEEP_ALIVE",
    "CLOSING",
    "CLOSED"
}

------------------------------------------------------------------------
(* ── Server States ─────────────────────────────────────────────────── *)
(*
 * Models the HttpServer lifecycle (server.rs:136-301).
 *
 * BINDING    → TCP listener bind (server.rs:147-156)
 * ACCEPTING  → Accept loop running (server.rs:290)
 * DRAINING   → Shutdown signal received, draining active connections
 * STOPPED    → Accept loop exited, all connections closed
 *)

ServerStates == {"BINDING", "ACCEPTING", "DRAINING", "STOPPED"}

------------------------------------------------------------------------
(* ── Middleware Direction ───────────────────────────────────────────── *)

MiddlewareDirections == {"INBOUND", "OUTBOUND"}

==========================================================================
