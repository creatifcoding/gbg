/**
 * Session Header Schema
 *
 * The first line of a session JSONL file. NOT part of the tree (no parentId).
 * Contains version for auto-migration, cwd for directory scoping,
 * optional parentSession for forks.
 *
 * @module harness/session/v2/header
 */

import { Schema } from 'effect'
import { HarnessSessionId } from './identity'

/** Current schema version for session files */
export const SESSION_SCHEMA_VERSION = 1

/**
 * Session file header — first line of JSONL.
 *
 * Not a tree entry (no parentId). Contains session metadata:
 * - version for schema migration
 * - cwd for directory scoping
 * - parentSession for forked sessions
 */
export const SessionHeader = Schema.TaggedStruct('SessionHeader', {
  /** Schema version (for auto-migration) */
  version: Schema.Number.pipe(Schema.int(), Schema.positive()),
  /** Session identifier */
  id: HarnessSessionId,
  /** ISO-8601 creation timestamp */
  timestamp: Schema.String.pipe(Schema.nonEmptyString()),
  /** Working directory when session was created */
  cwd: Schema.String,
  /** Parent session ID if this was forked */
  parentSession: Schema.optional(HarnessSessionId),
})
export type SessionHeader = typeof SessionHeader.Type
