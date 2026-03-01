/**
 * Session Machine — The Actor
 *
 * Machine.makeSerializable wrapping SessionTree as state.
 * Each operation is a Schema.TaggedRequest procedure.
 * Sequential message processing — no race conditions on tree mutations.
 * snapshot/restore gives full session persistence.
 *
 * @module harness/session/v2/machine
 */

import { Effect, Schema } from 'effect'
import { Machine } from '@effect/experimental'
import { SessionTree } from './tree'
import { makeSessionTree } from './tree'
import {
  AppendMessage,
  AppendEntry,
  BranchFrom,
  GetBranch,
  GetTree,
  Compact,
  CheckCompaction,
} from './requests'
import {
  appendEntry,
  branchFrom,
  getBranch,
  buildContext,
  makeMessageEntry,
  makeCompactionEntry,
} from './tree-ops'
import type { HarnessSessionId } from './identity'

// =============================================================================
// Machine Input — what you need to boot a session
// =============================================================================

export const SessionMachineInput = Schema.Struct({
  id: Schema.String,
  cwd: Schema.String,
  parentSession: Schema.optional(Schema.String),
})
export type SessionMachineInput = typeof SessionMachineInput.Type

// =============================================================================
// Machine State Schema — SessionTree for serialization
// =============================================================================

// The Machine's serializable state IS the SessionTree.
// snapshot/restore captures the full conversation.

// =============================================================================
// The Machine
// =============================================================================

export const SessionMachine = Machine.makeSerializable(
  {
    state: SessionTree,
    input: SessionMachineInput,
  },
  (input, previous) =>
    Machine.serializable.make(
      previous ?? makeSessionTree({
        id: input.id as HarnessSessionId,
        cwd: input.cwd,
        ...(input.parentSession
          ? { parentSession: input.parentSession as HarnessSessionId }
          : {}),
      }),
      { identifier: `Session(${input.id})` },
    ).pipe(
      // ---------------------------------------------------------------
      // AppendMessage — add a message to the tree
      // ---------------------------------------------------------------
      Machine.serializable.add(AppendMessage, ({ state, request }) =>
        Effect.gen(function* () {
          const entry = makeMessageEntry(state, request.message)
          const newTree = appendEntry(state, entry)
          return [entry.id, newTree] as const
        }),
      ),

      // ---------------------------------------------------------------
      // AppendEntry — add a raw pre-built entry
      // ---------------------------------------------------------------
      Machine.serializable.add(AppendEntry, ({ state, request }) =>
        Effect.gen(function* () {
          const entry = request.entry as any
          if (!entry?.id || !entry?._tag) {
            return yield* Effect.fail('Invalid entry: missing id or _tag')
          }
          const newTree = appendEntry(state, entry)
          return [entry.id, newTree] as const
        }),
      ),

      // ---------------------------------------------------------------
      // BranchFrom — move leaf pointer to fork point
      // ---------------------------------------------------------------
      Machine.serializable.add(BranchFrom, ({ state, request }) =>
        Effect.gen(function* () {
          try {
            const newTree = branchFrom(state, request.fromEntryId)
            return [void 0, newTree] as const
          } catch (e: any) {
            return yield* Effect.fail(e?.message ?? 'Branch failed')
          }
        }),
      ),

      // ---------------------------------------------------------------
      // GetBranch — read the current branch (root → leaf)
      // ---------------------------------------------------------------
      Machine.serializable.add(GetBranch, ({ state }) =>
        Effect.succeed([getBranch(state), state] as const),
      ),

      // ---------------------------------------------------------------
      // GetTree — read the full tree
      // ---------------------------------------------------------------
      Machine.serializable.add(GetTree, ({ state }) =>
        Effect.succeed([state, state] as const),
      ),

      // ---------------------------------------------------------------
      // Compact — append a compaction entry
      // ---------------------------------------------------------------
      Machine.serializable.add(Compact, ({ state, request }) =>
        Effect.gen(function* () {
          const entry = makeCompactionEntry(
            state,
            request.summary,
            request.firstKeptEntryId,
            request.tokensBefore,
          )
          const newTree = appendEntry(state, entry)
          return [entry.id, newTree] as const
        }),
      ),

      // ---------------------------------------------------------------
      // CheckCompaction (private) — check if auto-compaction needed
      // ---------------------------------------------------------------
      Machine.serializable.addPrivate(CheckCompaction, ({ state }) =>
        Effect.gen(function* () {
          const branch = getBranch(state)
          const messageCount = branch.filter((e) => e._tag === 'MessageEntry').length
          // Simple heuristic: compact if > 50 messages in current branch
          const needsCompaction = messageCount > 50
          return [needsCompaction, state] as const
        }),
      ),
    ),
)

export type SessionMachine = typeof SessionMachine
