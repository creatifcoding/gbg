/**
 * ProcedureKind — execution-model classification per PCT.md §6.
 *
 * Closed taxonomy for v1. Each kind dictates the wire shape, idempotency
 * guarantees, and cacheability semantics. See `PCT.md` for the canonical
 * matrix of kind × wire × idempotent × cacheable.
 *
 * @module @tmnl/pct/procedures/ProcedureKind
 */

import * as Schema from "effect-v4/Schema"

/**
 * Branded literal union of supported procedure kinds.
 *
 * - `pure`     — stateless, deterministic, no side effects. GET, cacheable.
 * - `query`    — side-effect-free read of server state. GET, conditionally cacheable.
 * - `mutation` — stateful single-shot. POST, not cacheable. Producer-headers honored.
 * - `stream`   — server→client unbounded sequence. SSE.
 * - `duplex`   — bidirectional. WebSocket binding (post-1.0).
 */
export const ProcedureKind = Schema.Literals([
  "pure",
  "query",
  "mutation",
  "stream",
  "duplex",
])
export type ProcedureKind = typeof ProcedureKind.Type

/** True iff a procedure of this kind is idempotent on the wire. */
export const isIdempotent = (kind: ProcedureKind): boolean =>
  kind === "pure" || kind === "query"

/** True iff a procedure of this kind is cacheable per default policy. */
export const isCacheable = (kind: ProcedureKind): boolean => kind === "pure"

/** True iff this kind requires a streaming response. */
export const isStreaming = (kind: ProcedureKind): boolean =>
  kind === "stream" || kind === "duplex"
