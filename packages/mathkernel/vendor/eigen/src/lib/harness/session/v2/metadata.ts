/**
 * Session Metadata Schema
 *
 * Lightweight listing view — pi-web-ui two-store pattern.
 * Full SessionTree is heavy; metadata is for browse/search/list.
 *
 * @module harness/session/v2/metadata
 */

import { Schema } from 'effect'
import { HarnessSessionId } from './identity'

// =============================================================================
// Session Status
// =============================================================================

/** Unified session status — no more execution/metadata divergence */
export const SessionStatus = Schema.Literal(
  'active',
  'closed',
  'failed',
  'archived',
  'starred',
)
export type SessionStatus = typeof SessionStatus.Type

// =============================================================================
// Session Metadata
// =============================================================================

/**
 * Lightweight session metadata for listing/searching.
 *
 * Stored in a separate IndexedDB object store from full session data
 * (pi-web-ui two-store pattern). Allows fast browsing without
 * loading full conversation trees.
 */
export const SessionMetadata = Schema.TaggedStruct('SessionMetadata', {
  /** Session identifier */
  id: HarnessSessionId,
  /** User-set or auto-generated title */
  title: Schema.String,
  /** ISO-8601 creation timestamp */
  createdAt: Schema.String.pipe(Schema.nonEmptyString()),
  /** ISO-8601 last modification timestamp */
  lastModified: Schema.String.pipe(Schema.nonEmptyString()),
  /** Total messages in session */
  messageCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  /** First few chars of conversation for preview */
  preview: Schema.String,
  /** LLM provider name */
  provider: Schema.optional(Schema.String),
  /** Model identifier */
  model: Schema.optional(Schema.String),
  /** Lifecycle status */
  status: SessionStatus,
  /** User-applied tags */
  tags: Schema.Array(Schema.String),
  /** Token usage summary */
  tokenUsage: Schema.optional(Schema.Struct({
    input: Schema.Number.pipe(Schema.nonNegative()),
    output: Schema.Number.pipe(Schema.nonNegative()),
    total: Schema.Number.pipe(Schema.nonNegative()),
  })),
  /** Node this session is bound to (for conductor panels) */
  nodeId: Schema.optional(Schema.String),
  /** Agent role */
  role: Schema.optional(Schema.String),
})
export type SessionMetadata = typeof SessionMetadata.Type
