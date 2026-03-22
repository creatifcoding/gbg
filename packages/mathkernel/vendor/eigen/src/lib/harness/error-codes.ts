/**
 * Harness Engine Error Codes — single source of truth.
 *
 * Taxonomy follows Effect's error model:
 *
 *   Error        — Expected, recoverable. Part of the API contract.
 *   Defect       — Unexpected, bugs. Shouldn't happen in correct code.
 *   Interruption — User-initiated cancellation.
 *
 * Within each class, codes are grouped by operational domain.
 * Severity is derived from class + domain via Schema.is guards.
 *
 * @module harness/error-codes
 */

import { Schema } from 'effect'

// ─── Severity ────────────────────────────────────────────────────────────────

export const ErrorSeverity = Schema.Literal('error', 'warn', 'info', 'silent')
export type ErrorSeverity = typeof ErrorSeverity.Type

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ERRORS — Expected, recoverable. Caller can handle or retry.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Stream lifecycle failures — connection dropped, timeout, init failure. → error */
export const StreamError = Schema.Literal(
  'pi-ai-stream-init-failed',
  'pi-ai-stream-failed',
  'pi-ai-stream-result-failed',
  'stream-timeout',
  'stream-result-timeout',
  'stream-wallclock-timeout',
  'stream-fetch-timeout',
  'stream-error',
)
export type StreamError = typeof StreamError.Type

/** Network-level failures — no connectivity. → error */
export const NetworkError = Schema.Literal(
  'network-unavailable',
)
export type NetworkError = typeof NetworkError.Type

/** Session lifecycle — missing, not found, failed to load. → error */
export const SessionError = Schema.Literal(
  'session-missing',
  'session-not-found',
  'session-load-failed',
  'session-events-load-failed',
)
export type SessionError = typeof SessionError.Type

/** Session CRUD — list/update/delete/fork failures. Operational. → warn */
export const SessionCrudError = Schema.Literal(
  'list-sessions-failed',
  'update-session-meta-failed',
  'delete-session-failed',
  'fork-session-load-failed',
  'fork-session-events-failed',
  'fork-session-upsert-failed',
  'fork-session-append-failed',
)
export type SessionCrudError = typeof SessionCrudError.Type

/** Tool execution — round limits, timeouts, resolution. → warn */
export const ToolError = Schema.Literal(
  'tool-round-limit-exceeded',
  'tool-use-without-calls',
  'tool-execution-failed',
  'tool-not-found',
  'tool-name-unresolved',
  'tool-timeout',
)
export type ToolError = typeof ToolError.Type

/** Model/catalog resolution — failed to load model list. → warn */
export const ModelError = Schema.Literal(
  'model-catalog-failed',
  'model-resolution-failed',
)
export type ModelError = typeof ModelError.Type

/** Generic timeout — something took too long. → error */
export const TimeoutError = Schema.Literal(
  'timeout',
)
export type TimeoutError = typeof TimeoutError.Type

/** Compaction — background maintenance failure. → warn */
export const CompactionError = Schema.Literal(
  'compaction-failed',
)
export type CompactionError = typeof CompactionError.Type

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  DEFECTS — Unexpected, bugs. These shouldn't happen in correct code.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Critical defects — structural failures that surface to the user. → error */
export const CriticalDefect = Schema.Literal(
  'stream-defect',
  'assistant-round-defect',
  'session-prompt-defect',
  'daemon-defect',
)
export type CriticalDefect = typeof CriticalDefect.Type

/** Adapter diagnostic defects — malformed deltas, noop events. → silent */
export const AdapterDefect = Schema.Literal(
  'adapter-invalid-text-delta',
  'adapter-invalid-thinking-delta',
  'adapter-noop-diagnostic',
  'invalid-text-delta',
  'invalid-thinking-delta',
  'invalid-toolcall-delta',
)
export type AdapterDefect = typeof AdapterDefect.Type

/** Store/codec defects — serialization, decode failures. → silent */
export const StoreDefect = Schema.Literal(
  'decode-session-index-failed',
  'invalid-raw-event',
  'invalid-session-file',
  'provider-marker-decode-failed',
)
export type StoreDefect = typeof StoreDefect.Type

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  INTERRUPTIONS — User-initiated cancellation.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const Interruption = Schema.Literal(
  'aborted',
)
export type Interruption = typeof Interruption.Type

// ─── Union: All error codes ──────────────────────────────────────────────────

export const HarnessErrorCode = Schema.Union(
  // Errors
  StreamError,
  NetworkError,
  SessionError,
  SessionCrudError,
  ToolError,
  ModelError,
  TimeoutError,
  CompactionError,
  // Defects
  CriticalDefect,
  AdapterDefect,
  StoreDefect,
  // Interruptions
  Interruption,
)
export type HarnessErrorCode = typeof HarnessErrorCode.Type

// ─── Severity (derived from class + domain) ──────────────────────────────────
//
// Schema.is derives directly from the category literals.
// Add a code to a category → severity follows. One place to maintain.

const isCriticalError = Schema.is(Schema.Union(StreamError, NetworkError, SessionError, TimeoutError, CriticalDefect))
const isWarn          = Schema.is(Schema.Union(SessionCrudError, ToolError, ModelError, CompactionError))
const isInfo          = Schema.is(Interruption)
const isSilent        = Schema.is(Schema.Union(AdapterDefect, StoreDefect))

export function severityOf(code: string): ErrorSeverity {
  if (isCriticalError(code)) return 'error'
  if (isWarn(code))           return 'warn'
  if (isInfo(code))           return 'info'
  if (isSilent(code))         return 'silent'
  return 'error'
}

export function isBannerVisible(code: string): boolean {
  return severityOf(code) !== 'silent'
}

// ─── Severity map schema (for validation / serialization) ────────────────────

export const SeverityMap = Schema.Record({
  key: HarnessErrorCode,
  value: ErrorSeverity,
})
export type SeverityMap = typeof SeverityMap.Type
