/**
 * Session Machine Tests
 *
 * Unit: machine boots, accepts requests, updates state
 * Behavior: sequential processing, branch + compact workflows
 * Integration: snapshot/restore round-trip
 */

import { describe, it, expect } from '@effect/vitest'
import { Effect, Scope } from 'effect'
import { Machine } from '@effect/experimental'
import { SessionMachine } from '../machine'
import {
  AppendMessage,
  BranchFrom,
  GetBranch,
  GetTree,
  Compact,
} from '../requests'
import { resetEntryCounter } from '../tree-ops'
import type { SessionTree } from '../tree'
import type { SessionEntry } from '../entries'

// =============================================================================
// Helpers
// =============================================================================

const TEST_INPUT = { id: 'test-session', cwd: '/tmp' }

/** Boot a machine in a scoped effect for testing */
const bootMachine = Effect.gen(function* () {
  const actor = yield* Machine.boot(SessionMachine, TEST_INPUT)
  return actor
})

// =============================================================================
// Unit: Machine boots correctly
// =============================================================================

describe('SessionMachine — Unit', () => {
  it.effect('boots with empty tree', () =>
    Effect.gen(function* () {
      resetEntryCounter()
      const actor = yield* bootMachine

      const tree = (yield* actor.send(new GetTree())) as SessionTree
      expect(tree.header.id).toBe('test-session')
      expect(tree.header.cwd).toBe('/tmp')
      expect(tree.entries).toHaveLength(0)
      expect(tree.leafId).toBeNull()
    }).pipe(Effect.scoped),
  )

  it.effect('appends a message and returns entry ID', () =>
    Effect.gen(function* () {
      resetEntryCounter()
      const actor = yield* bootMachine

      const entryId = yield* actor.send(
        new AppendMessage({
          message: { role: 'user', content: 'Hello' },
        }),
      )

      expect(typeof entryId).toBe('string')
      expect(entryId).toBeTruthy()

      const tree = (yield* actor.send(new GetTree())) as SessionTree
      expect(tree.entries).toHaveLength(1)
      expect(tree.leafId).toBe(entryId)
    }).pipe(Effect.scoped),
  )
})

// =============================================================================
// Behavior: Conversation workflow
// =============================================================================

describe('SessionMachine — Behavior', () => {
  it.effect('handles multi-turn conversation', () =>
    Effect.gen(function* () {
      resetEntryCounter()
      const actor = yield* bootMachine

      const e1 = yield* actor.send(
        new AppendMessage({ message: { role: 'user', content: 'What is Effect?' } }),
      )
      const e2 = yield* actor.send(
        new AppendMessage({ message: { role: 'assistant', content: 'A TypeScript library.' } }),
      )
      const e3 = yield* actor.send(
        new AppendMessage({ message: { role: 'user', content: 'Show me an example.' } }),
      )

      const branch = (yield* actor.send(new GetBranch())) as ReadonlyArray<SessionEntry>
      expect(branch).toHaveLength(3)
      expect(branch[0].id).toBe(e1)
      expect(branch[1].id).toBe(e2)
      expect(branch[2].id).toBe(e3)
    }).pipe(Effect.scoped),
  )

  it.effect('branches and follows new path', () =>
    Effect.gen(function* () {
      resetEntryCounter()
      const actor = yield* bootMachine

      // Main path: e1 → e2 → e3
      const e1 = yield* actor.send(
        new AppendMessage({ message: { role: 'user', content: 'root' } }),
      )
      yield* actor.send(
        new AppendMessage({ message: { role: 'assistant', content: 'main response' } }),
      )
      yield* actor.send(
        new AppendMessage({ message: { role: 'user', content: 'main follow-up' } }),
      )

      // Branch from e1
      yield* actor.send(new BranchFrom({ fromEntryId: e1 }))
      const e4 = yield* actor.send(
        new AppendMessage({ message: { role: 'assistant', content: 'alt response' } }),
      )

      // Branch should be e1 → e4
      const branch = (yield* actor.send(new GetBranch())) as ReadonlyArray<SessionEntry>
      expect(branch).toHaveLength(2)
      expect(branch[0].id).toBe(e1)
      expect(branch[1].id).toBe(e4)

      // Full tree should have all 4 entries
      const tree = (yield* actor.send(new GetTree())) as SessionTree
      expect(tree.entries).toHaveLength(4)
    }).pipe(Effect.scoped),
  )

  it.effect('compacts and includes summary in context', () =>
    Effect.gen(function* () {
      resetEntryCounter()
      const actor = yield* bootMachine

      // Build up some conversation
      const e1 = yield* actor.send(
        new AppendMessage({ message: { role: 'user', content: 'first question' } }),
      )
      yield* actor.send(
        new AppendMessage({ message: { role: 'assistant', content: 'first answer' } }),
      )
      const e3 = yield* actor.send(
        new AppendMessage({ message: { role: 'user', content: 'second question' } }),
      )

      // Compact — summarize everything before e3
      const compactionId = yield* actor.send(
        new Compact({
          summary: 'User asked about Effect. Got a basic answer.',
          firstKeptEntryId: e3,
          tokensBefore: 15000,
        }),
      )

      expect(typeof compactionId).toBe('string')

      // Tree should have 4 entries (3 messages + 1 compaction)
      const tree = (yield* actor.send(new GetTree())) as SessionTree
      expect(tree.entries).toHaveLength(4)
    }).pipe(Effect.scoped),
  )

  it.effect('rejects branch to non-existent entry', () =>
    Effect.gen(function* () {
      resetEntryCounter()
      const actor = yield* bootMachine

      yield* actor.send(
        new AppendMessage({ message: { role: 'user', content: 'hi' } }),
      )

      const result = yield* Effect.either(
        actor.send(new BranchFrom({ fromEntryId: 'nonexistent' as any })),
      )

      expect(result._tag).toBe('Left')
    }).pipe(Effect.scoped),
  )
})

// =============================================================================
// Integration: Snapshot / Restore
// =============================================================================

describe('SessionMachine — Integration (snapshot/restore)', () => {
  it.effect('snapshot captures full tree state', () =>
    Effect.gen(function* () {
      resetEntryCounter()
      const actor = yield* bootMachine

      yield* actor.send(
        new AppendMessage({ message: { role: 'user', content: 'before snapshot' } }),
      )
      yield* actor.send(
        new AppendMessage({ message: { role: 'assistant', content: 'response' } }),
      )

      const snap = yield* Machine.snapshot(actor)

      // Snapshot is [input, state] tuple
      expect(Array.isArray(snap)).toBe(true)
      expect(snap).toHaveLength(2)

      // State (snap[1]) should be a serialized SessionTree
      const serializedTree = snap[1] as any
      expect(serializedTree.header).toBeDefined()
      expect(serializedTree.entries).toHaveLength(2)
    }).pipe(Effect.scoped),
  )

  it.effect('restore rebuilds machine from snapshot', () =>
    Effect.gen(function* () {
      resetEntryCounter()

      // Boot, add messages, snapshot
      const actor1 = yield* Machine.boot(SessionMachine, TEST_INPUT)
      yield* actor1.send(
        new AppendMessage({ message: { role: 'user', content: 'msg 1' } }),
      )
      yield* actor1.send(
        new AppendMessage({ message: { role: 'assistant', content: 'msg 2' } }),
      )
      const snap = yield* Machine.snapshot(actor1)

      // Restore into new actor
      const actor2 = yield* Machine.restore(SessionMachine, snap)

      // Restored actor should have same state
      const tree = (yield* actor2.send(new GetTree())) as SessionTree
      expect(tree.entries).toHaveLength(2)
      expect(tree.header.id).toBe('test-session')

      // Can continue appending
      yield* actor2.send(
        new AppendMessage({ message: { role: 'user', content: 'msg 3 after restore' } }),
      )
      const updatedTree = (yield* actor2.send(new GetTree())) as SessionTree
      expect(updatedTree.entries).toHaveLength(3)
    }).pipe(Effect.scoped),
  )
})
