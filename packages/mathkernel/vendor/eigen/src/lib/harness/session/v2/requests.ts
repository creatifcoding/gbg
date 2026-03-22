/**
 * Session Machine Requests — Schema.TaggedRequest for each operation
 *
 * These are the messages the session actor accepts.
 * Each is a Schema.TaggedRequest with typed payload, success, and failure.
 *
 * Public requests: consumer-facing API
 * Private requests: internal operations (auto-compaction, persistence)
 *
 * @module harness/session/v2/requests
 */

import { Schema } from 'effect'
import { EntryId } from './identity'
import { SessionMessage } from './entries'
import type { SessionEntry } from './entries'
import type { SessionTree } from './tree'

// =============================================================================
// Error type for request failures
// =============================================================================

export const SessionError = Schema.String
export type SessionError = typeof SessionError.Type

// =============================================================================
// Public Requests — consumer API
// =============================================================================

/** Append a message to the session tree */
export class AppendMessage extends Schema.TaggedRequest<AppendMessage>()(
  'AppendMessage',
  {
    failure: SessionError,
    success: EntryId,
    payload: {
      message: SessionMessage,
    },
  },
) {}

/** Append a raw entry (for non-message entry types) */
export class AppendEntry extends Schema.TaggedRequest<AppendEntry>()(
  'AppendEntry',
  {
    failure: SessionError,
    success: EntryId,
    payload: {
      entry: Schema.Unknown,
    },
  },
) {}

/** Branch from a specific entry — move the leaf pointer */
export class BranchFrom extends Schema.TaggedRequest<BranchFrom>()(
  'BranchFrom',
  {
    failure: SessionError,
    success: Schema.Void,
    payload: {
      fromEntryId: EntryId,
    },
  },
) {}

/** Get the current branch (root → leaf) */
export class GetBranch extends Schema.TaggedRequest<GetBranch>()(
  'GetBranch',
  {
    failure: SessionError,
    success: Schema.Unknown,
    payload: {},
  },
) {}

/** Get the full tree */
export class GetTree extends Schema.TaggedRequest<GetTree>()(
  'GetTree',
  {
    failure: SessionError,
    success: Schema.Unknown,
    payload: {},
  },
) {}

/** Request compaction with a summary */
export class Compact extends Schema.TaggedRequest<Compact>()(
  'Compact',
  {
    failure: SessionError,
    success: EntryId,
    payload: {
      summary: Schema.String,
      firstKeptEntryId: EntryId,
      tokensBefore: Schema.Number,
    },
  },
) {}

// =============================================================================
// Private Requests — internal operations
// =============================================================================

/** Check if auto-compaction is needed (private — called after each append) */
export class CheckCompaction extends Schema.TaggedRequest<CheckCompaction>()(
  'CheckCompaction',
  {
    failure: Schema.Never,
    success: Schema.Boolean,
    payload: {},
  },
) {}
