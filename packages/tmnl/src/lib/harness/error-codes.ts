/**
 * Harness Engine Error Codes — single source of truth.
 *
 * Architecture:
 *   1. Category literals — each a Schema.Literal union
 *   2. HarnessErrorCode — Schema.Union of all categories
 *   3. Severity derived from category membership (not a parallel map)
 *
 * Adding a new code to a category automatically classifies its severity.
 *
 * @module harness/error-codes
 */

import { Schema } from 'effect'

// ─── Severity ────────────────────────────────────────────────────────────────

export const ErrorSeverity = Schema.Literal('error', 'warn', 'info', 'silent')
export type ErrorSeverity = typeof ErrorSeverity.Type

// ─── Category: Stream Lifecycle (→ error) ────────────────────────────────────

export const StreamErrorCode = Schema.Literal(
  'pi-ai-stream-init-failed',
  'pi-ai-stream-failed',
  'pi-ai-stream-result-failed',
  'stream-timeout',
  'stream-result-timeout',
  'stream-wallclock-timeout',
  'stream-fetch-timeout',
  'stream-error',
  'stream-defect',
)
export type StreamErrorCode = typeof StreamErrorCode.Type

// ─── Category: Network (→ error) ─────────────────────────────────────────────

export const NetworkErrorCode = Schema.Literal(
  'network-unavailable',
)
export type NetworkErrorCode = typeof NetworkErrorCode.Type

// ─── Category: Session Lifecycle (→ error) ───────────────────────────────────

export const SessionLifecycleErrorCode = Schema.Literal(
  'session-missing',
  'session-not-found',
  'session-load-failed',
  'session-events-load-failed',
  'session-prompt-defect',
)
export type SessionLifecycleErrorCode = typeof SessionLifecycleErrorCode.Type

// ─── Category: Session CRUD (→ warn) ─────────────────────────────────────────

export const SessionCrudErrorCode = Schema.Literal(
  'list-sessions-failed',
  'update-session-meta-failed',
  'delete-session-failed',
  'fork-session-load-failed',
  'fork-session-events-failed',
  'fork-session-upsert-failed',
  'fork-session-append-failed',
)
export type SessionCrudErrorCode = typeof SessionCrudErrorCode.Type

// ─── Category: Store / Codec (→ silent) ──────────────────────────────────────

export const StoreCodecErrorCode = Schema.Literal(
  'decode-session-index-failed',
  'invalid-raw-event',
  'invalid-session-file',
  'provider-marker-decode-failed',
)
export type StoreCodecErrorCode = typeof StoreCodecErrorCode.Type

// ─── Category: Tool Execution (→ warn) ───────────────────────────────────────

export const ToolErrorCode = Schema.Literal(
  'tool-round-limit-exceeded',
  'tool-use-without-calls',
  'tool-execution-failed',
  'tool-not-found',
  'tool-name-unresolved',
  'tool-timeout',
)
export type ToolErrorCode = typeof ToolErrorCode.Type

// ─── Category: Model / Catalog (→ warn) ──────────────────────────────────────

export const ModelErrorCode = Schema.Literal(
  'model-catalog-failed',
  'model-resolution-failed',
)
export type ModelErrorCode = typeof ModelErrorCode.Type

// ─── Category: Adapter Diagnostics (→ silent) ────────────────────────────────

export const AdapterDiagnosticCode = Schema.Literal(
  'adapter-invalid-text-delta',
  'adapter-invalid-thinking-delta',
  'adapter-noop-diagnostic',
  'invalid-text-delta',
  'invalid-thinking-delta',
  'invalid-toolcall-delta',
)
export type AdapterDiagnosticCode = typeof AdapterDiagnosticCode.Type

// ─── Category: Internal / Structural (mixed) ─────────────────────────────────

export const InternalErrorCode = Schema.Literal(
  'assistant-round-defect',
  'daemon-defect',
  'timeout',
)
export type InternalErrorCode = typeof InternalErrorCode.Type

export const InternalWarnCode = Schema.Literal(
  'compaction-failed',
)
export type InternalWarnCode = typeof InternalWarnCode.Type

export const InternalInfoCode = Schema.Literal(
  'aborted',
)
export type InternalInfoCode = typeof InternalInfoCode.Type

// ─── Union: All error codes ──────────────────────────────────────────────────

export const HarnessErrorCode = Schema.Union(
  StreamErrorCode,
  NetworkErrorCode,
  SessionLifecycleErrorCode,
  SessionCrudErrorCode,
  StoreCodecErrorCode,
  ToolErrorCode,
  ModelErrorCode,
  AdapterDiagnosticCode,
  InternalErrorCode,
  InternalWarnCode,
  InternalInfoCode,
)
export type HarnessErrorCode = typeof HarnessErrorCode.Type

// ─── Category → severity (Schema.is guards) ─────────────────────────────────
//
// Each guard derives from its category literal. Adding a code to a category
// automatically routes it to the correct severity — one place to maintain.

const isError  = Schema.is(Schema.Union(StreamErrorCode, NetworkErrorCode, SessionLifecycleErrorCode, InternalErrorCode))
const isWarn   = Schema.is(Schema.Union(SessionCrudErrorCode, ToolErrorCode, ModelErrorCode, InternalWarnCode))
const isInfo   = Schema.is(InternalInfoCode)
const isSilent = Schema.is(Schema.Union(StoreCodecErrorCode, AdapterDiagnosticCode))

/**
 * Derive severity from category membership.
 * Falls back to 'error' for unknown codes (defensive).
 */
export function severityOf(code: string): ErrorSeverity {
  if (isError(code))  return 'error'
  if (isWarn(code))   return 'warn'
  if (isInfo(code))   return 'info'
  if (isSilent(code)) return 'silent'
  return 'error'
}

/**
 * Whether this code should appear in the UI banner.
 * 'silent' codes are suppressed (internal diagnostics).
 */
export function isBannerVisible(code: string): boolean {
  return severityOf(code) !== 'silent'
}

// ─── Severity map schema (for validation / serialization) ────────────────────

export const SeverityMap = Schema.Record({
  key: HarnessErrorCode,
  value: ErrorSeverity,
})
export type SeverityMap = typeof SeverityMap.Type
