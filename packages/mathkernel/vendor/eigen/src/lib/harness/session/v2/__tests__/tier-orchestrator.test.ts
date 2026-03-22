/**
 * Tier Orchestrator Tests
 */
import { describe, it, expect } from 'vitest'
import { Effect, Layer, Option } from 'effect'
import { KeyValueStore } from '@effect/platform'
import { TierOrchestrator, makeTierOrchestratorLayer } from '../tier-orchestrator'
import { SessionStore } from '../session-store'
import { makeSessionTree } from '../tree'
import { appendEntry, makeMessageEntry, resetEntryCounter } from '../tree-ops'
import type { HarnessSessionId } from '../identity'

// Full layer stack with in-memory KVS (no localStorage in test env)
const TestLayer = makeTierOrchestratorLayer(KeyValueStore.layerMemory)

const id1 = 'orch-sess-001' as HarnessSessionId

function makeTree(id: HarnessSessionId) {
  resetEntryCounter()
  let tree = makeSessionTree({ id, cwd: '/tmp/orch-test' })
  const msg1 = makeMessageEntry(tree, {
    role: 'user',
    content: 'Tell me about Effect',
  })
  tree = appendEntry(tree, msg1)
  const msg2 = makeMessageEntry(tree, {
    role: 'assistant',
    content: 'Effect is a powerful TypeScript library for building robust applications.',
  })
  tree = appendEntry(tree, msg2)
  return tree
}

const run = <A>(effect: Effect.Effect<A, any, TierOrchestrator>) =>
  Effect.runPromise(effect.pipe(Effect.provide(TestLayer)))

describe('TierOrchestrator', () => {
  describe('persist + hydrate', () => {
    it('persist writes to cold tier, hydrate retrieves', async () => {
      const tree = makeTree(id1)
      await run(
        Effect.gen(function* () {
          const orch = yield* TierOrchestrator
          yield* orch.persist(tree)

          const hydrated = yield* orch.hydrate(id1)
          expect(Option.isSome(hydrated)).toBe(true)

          const restored = Option.getOrThrow(hydrated)
          expect(restored.header.id).toBe(id1)
          expect(restored.entries.length).toBe(2)
        }),
      )
    })

    it('hydrate returns None for missing session', async () => {
      await run(
        Effect.gen(function* () {
          const orch = yield* TierOrchestrator
          const result = yield* orch.hydrate('nonexistent' as HarnessSessionId)
          expect(Option.isNone(result)).toBe(true)
        }),
      )
    })
  })

  describe('JSONL export/import', () => {
    it('exportJsonl produces valid JSONL', async () => {
      const tree = makeTree(id1)
      await run(
        Effect.gen(function* () {
          const orch = yield* TierOrchestrator
          yield* orch.persist(tree)

          const jsonl = yield* orch.exportJsonl(id1)
          expect(Option.isSome(jsonl)).toBe(true)

          const lines = Option.getOrThrow(jsonl).split('\n')
          expect(lines.length).toBe(3) // header + 2 entries

          const header = JSON.parse(lines[0])
          expect(header._tag).toBe('SessionHeader')
        }),
      )
    })

    it('importJsonl creates session from JSONL', async () => {
      const tree = makeTree(id1)
      await run(
        Effect.gen(function* () {
          const orch = yield* TierOrchestrator

          // Export first
          yield* orch.persist(tree)
          const jsonlOpt = yield* orch.exportJsonl(id1)
          const jsonl = Option.getOrThrow(jsonlOpt)

          // Purge, then import
          yield* orch.purge(id1)
          const nothing = yield* orch.hydrate(id1)
          expect(Option.isNone(nothing)).toBe(true)

          const imported = yield* orch.importJsonl(jsonl)
          expect(imported.header.id).toBe(id1)
          expect(imported.entries.length).toBe(2)

          // Should be in cold storage now
          const hydrated = yield* orch.hydrate(id1)
          expect(Option.isSome(hydrated)).toBe(true)
        }),
      )
    })

    it('exportJsonl returns None for missing session', async () => {
      await run(
        Effect.gen(function* () {
          const orch = yield* TierOrchestrator
          const result = yield* orch.exportJsonl('nope' as HarnessSessionId)
          expect(Option.isNone(result)).toBe(true)
        }),
      )
    })
  })

  describe('purge', () => {
    it('purge removes session from all tiers', async () => {
      const tree = makeTree(id1)
      await run(
        Effect.gen(function* () {
          const orch = yield* TierOrchestrator
          yield* orch.persist(tree)

          const before = yield* orch.hydrate(id1)
          expect(Option.isSome(before)).toBe(true)

          yield* orch.purge(id1)

          const after = yield* orch.hydrate(id1)
          expect(Option.isNone(after)).toBe(true)
        }),
      )
    })
  })

  describe('listSessions', () => {
    it('lists metadata for persisted sessions', async () => {
      const tree = makeTree(id1)
      await run(
        Effect.gen(function* () {
          const orch = yield* TierOrchestrator
          yield* orch.persist(tree)

          const sessions = yield* orch.listSessions()
          expect(sessions.length).toBeGreaterThanOrEqual(1)

          const meta = sessions.find((s) => s.id === id1)
          expect(meta).toBeDefined()
          expect(meta!.messageCount).toBe(2)
          expect(meta!._tag).toBe('SessionMetadata')
        }),
      )
    })
  })

  describe('layer composition', () => {
    it('makeTierOrchestratorLayer composes with any KVS', async () => {
      // This test proves the DI works — layerMemory is the backing store
      const tree = makeTree(id1)
      await run(
        Effect.gen(function* () {
          const orch = yield* TierOrchestrator
          yield* orch.persist(tree)
          const hydrated = yield* orch.hydrate(id1)
          expect(Option.isSome(hydrated)).toBe(true)
        }),
      )
    })
  })
})
