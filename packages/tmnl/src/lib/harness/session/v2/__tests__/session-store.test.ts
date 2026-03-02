/**
 * SessionStore Tests — DI-able persistence via KeyValueStore
 */
import { describe, it, expect } from 'vitest'
import { Effect, Layer, Option } from 'effect'
import { KeyValueStore } from '@effect/platform'
import { SessionStore } from '../session-store'
import { makeSessionTree } from '../tree'
import { appendEntry, makeMessageEntry, resetEntryCounter } from '../tree-ops'
import type { HarnessSessionId } from '../identity'

// In-memory KVS for tests
const TestLayer = SessionStore.Default.pipe(
  Layer.provide(KeyValueStore.layerMemory),
)

const id1 = 'sess-001' as HarnessSessionId
const id2 = 'sess-002' as HarnessSessionId

function makeTreeWithMessages(id: HarnessSessionId, msgCount: number) {
  resetEntryCounter()
  let tree = makeSessionTree({ id, cwd: '/tmp/test' })
  for (let i = 0; i < msgCount; i++) {
    const role = i % 2 === 0 ? 'user' : 'assistant'
    const msg = makeMessageEntry(tree, {
      role: role as any,
      content: `Message ${i + 1} from ${role}`,
    })
    tree = appendEntry(tree, msg)
  }
  return tree
}

const run = <A>(effect: Effect.Effect<A, any, SessionStore>) =>
  Effect.runPromise(effect.pipe(Effect.provide(TestLayer)))

describe('SessionStore', () => {
  describe('tree operations', () => {
    it('saveTree + loadTree round-trips', async () => {
      const tree = makeTreeWithMessages(id1, 4)
      await run(
        Effect.gen(function* () {
          const store = yield* SessionStore
          yield* store.saveTree(tree)

          const loaded = yield* store.loadTree(id1)
          expect(Option.isSome(loaded)).toBe(true)

          const restored = Option.getOrThrow(loaded)
          expect(restored.header.id).toBe(id1)
          expect(restored.entries.length).toBe(4)
          expect(restored.leafId).toBe(tree.leafId)
        }),
      )
    })

    it('loadTree returns None for missing session', async () => {
      await run(
        Effect.gen(function* () {
          const store = yield* SessionStore
          const loaded = yield* store.loadTree('nonexistent' as HarnessSessionId)
          expect(Option.isNone(loaded)).toBe(true)
        }),
      )
    })

    it('hasTree checks existence', async () => {
      const tree = makeTreeWithMessages(id1, 2)
      await run(
        Effect.gen(function* () {
          const store = yield* SessionStore
          yield* store.saveTree(tree)

          expect(yield* store.hasTree(id1)).toBe(true)
          expect(yield* store.hasTree('nope' as HarnessSessionId)).toBe(false)
        }),
      )
    })

    it('deleteTree removes tree + metadata', async () => {
      const tree = makeTreeWithMessages(id1, 2)
      await run(
        Effect.gen(function* () {
          const store = yield* SessionStore
          yield* store.saveTree(tree)
          expect(yield* store.hasTree(id1)).toBe(true)

          yield* store.deleteTree(id1)
          expect(yield* store.hasTree(id1)).toBe(false)

          const meta = yield* store.loadMeta(id1)
          expect(Option.isNone(meta)).toBe(true)
        }),
      )
    })
  })

  describe('metadata operations', () => {
    it('saveTree auto-creates metadata', async () => {
      const tree = makeTreeWithMessages(id1, 4)
      await run(
        Effect.gen(function* () {
          const store = yield* SessionStore
          yield* store.saveTree(tree)

          const meta = yield* store.loadMeta(id1)
          expect(Option.isSome(meta)).toBe(true)

          const m = Option.getOrThrow(meta)
          expect(m.id).toBe(id1)
          expect(m.messageCount).toBe(4)
          expect(m._tag).toBe('SessionMetadata')
        }),
      )
    })

    it('listMeta returns all stored metadata', async () => {
      const tree1 = makeTreeWithMessages(id1, 2)
      const tree2 = makeTreeWithMessages(id2, 6)
      await run(
        Effect.gen(function* () {
          const store = yield* SessionStore
          yield* store.saveTree(tree1)
          yield* store.saveTree(tree2)

          const metas = yield* store.listMeta()
          expect(metas.length).toBeGreaterThanOrEqual(2)

          const ids = metas.map((m) => m.id)
          expect(ids).toContain(id1)
          expect(ids).toContain(id2)
        }),
      )
    })

    it('deleteMeta removes from index', async () => {
      const tree = makeTreeWithMessages(id1, 2)
      await run(
        Effect.gen(function* () {
          const store = yield* SessionStore
          yield* store.saveTree(tree)

          yield* store.deleteMeta(id1)
          const meta = yield* store.loadMeta(id1)
          expect(Option.isNone(meta)).toBe(true)
        }),
      )
    })
  })

  describe('bulk operations', () => {
    it('listIds returns all stored session IDs', async () => {
      const tree1 = makeTreeWithMessages(id1, 2)
      const tree2 = makeTreeWithMessages(id2, 2)
      await run(
        Effect.gen(function* () {
          const store = yield* SessionStore
          yield* store.saveTree(tree1)
          yield* store.saveTree(tree2)

          const ids = yield* store.listIds()
          expect(ids).toContain(id1)
          expect(ids).toContain(id2)
        }),
      )
    })

    it('clearAll removes everything', async () => {
      const tree = makeTreeWithMessages(id1, 2)
      await run(
        Effect.gen(function* () {
          const store = yield* SessionStore
          yield* store.saveTree(tree)
          expect(yield* store.hasTree(id1)).toBe(true)

          yield* store.clearAll()
          expect(yield* store.hasTree(id1)).toBe(false)
        }),
      )
    })
  })

  describe('DI swappability', () => {
    it('works with layerMemory', async () => {
      const tree = makeTreeWithMessages(id1, 2)
      // This test IS the proof — TestLayer uses layerMemory
      await run(
        Effect.gen(function* () {
          const store = yield* SessionStore
          yield* store.saveTree(tree)
          const loaded = yield* store.loadTree(id1)
          expect(Option.isSome(loaded)).toBe(true)
        }),
      )
    })

    // Additional backing stores (IndexedDB, SQLite) would be
    // tested by providing different Layers here:
    //
    // const SqliteTestLayer = SessionStore.Default.pipe(
    //   Layer.provide(mySqliteKeyValueStoreLayer),
    // )
  })
})
