/**
 * Durable-Streams v1 — DEPRECATED
 *
 * ⚠️  This is the **legacy** Durable-Streams implementation, written against
 *     Effect v3 and a NATS-bridge protocol that does NOT faithfully implement
 *     the canonical Durable Streams wire spec
 *     (https://github.com/durable-streams/durable-streams).
 *
 * Known model mismatches with the spec (preserved here for backwards-compat):
 *   - Numeric `Schema.Number` offsets   →  spec uses opaque lex-sortable strings
 *   - Custom JSON envelope { items, nextOffset, upToDate }
 *                                       →  spec uses HTTP response headers
 *                                          (Stream-Next-Offset, Stream-Up-To-Date,
 *                                           Stream-Cursor, Stream-Closed)
 *   - Producer idempotency via id+seq   →  spec uses id + epoch + seq (with fencing)
 *   - Custom SSE _tag union             →  spec uses raw SSE-formatted body
 *   - X-Schema-Id header on top         →  schema is orthogonal to spec; additive
 *   - No Stream-Cursor / CDN collapsing →  cannot edge-scale fan-out
 *   - No Stream-Closed / 410 Gone       →  no graceful shutdown / retention semantics
 *
 * For new code, use `@/lib/holonet/durable-streams/latest` (Effect v4, spec-faithful).
 *
 * See `../latest/ARCHITECTURE.md` for the rebuild plan.
 *
 * @module holonet/durable-streams/v1
 * @deprecated Use `@/lib/holonet/durable-streams/latest` instead.
 */

// ─── Services ────────────────────────────────────────────────────────────────
export * from './services';

// ─── Events (EventLog for Observability) ─────────────────────────────────────
export * from './events';

// ─── HTTP API ────────────────────────────────────────────────────────────────
export * from './api';
