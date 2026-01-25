/**
 * Durable Streams Server Tests
 *
 * Tests for StreamStore Effect.Service with in-memory SQLite.
 * Uses bun:test for Bun-native SQLite support.
 *
 * @module @gbg/tmnl/durable-streams/server/__tests__/service.bun.test
 */

import { describe, test, expect } from 'bun:test'
import { Effect, Layer } from 'effect'
import {
  StreamStoreTag,
  StreamStoreFullLayer,
  StreamNotFoundError,
  StreamExistsError,
} from '../service'
import { DurableStreamTestLayer } from '../persistence'

// ─────────────────────────────────────────────────────────────────────────────
// Test Layer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Test layer: StreamStore with in-memory SQLite
 */
const TestLayer = StreamStoreFullLayer.pipe(
  Layer.provide(DurableStreamTestLayer)
)

/**
 * Helper to run Effect in test context
 */
const runTest = <A, E>(effect: Effect.Effect<A, E, any>) =>
  Effect.runPromise(effect.pipe(Effect.provide(TestLayer)))

// ─────────────────────────────────────────────────────────────────────────────
// StreamStore Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('StreamStore', () => {
  describe('create', () => {
    test('creates a new stream', async () => {
      await runTest(
        Effect.gen(function* () {
          const store = yield* StreamStoreTag

          yield* store.create('test-stream-create-1')

          const exists = yield* store.exists('test-stream-create-1')
          expect(exists).toBe(true)
        })
      )
    })

    test('fails when stream already exists', async () => {
      await runTest(
        Effect.gen(function* () {
          const store = yield* StreamStoreTag

          yield* store.create('duplicate-stream')

          const result = yield* store.create('duplicate-stream').pipe(
            Effect.either
          )

          expect(result._tag).toBe('Left')
          if (result._tag === 'Left') {
            expect(result.left).toBeInstanceOf(StreamExistsError)
          }
        })
      )
    })

    test('respects custom content type', async () => {
      await runTest(
        Effect.gen(function* () {
          const store = yield* StreamStoreTag

          yield* store.create('typed-stream', 'application/x-ndjson')

          const meta = yield* store.metadata('typed-stream')
          expect(meta.exists).toBe(true)
          expect(meta.contentType).toBe('application/x-ndjson')
        })
      )
    })
  })

  describe('getOrCreate', () => {
    test('creates stream if not exists', async () => {
      await runTest(
        Effect.gen(function* () {
          const store = yield* StreamStoreTag

          yield* store.getOrCreate('idempotent-stream')

          const exists = yield* store.exists('idempotent-stream')
          expect(exists).toBe(true)
        })
      )
    })

    test('is idempotent when stream exists', async () => {
      await runTest(
        Effect.gen(function* () {
          const store = yield* StreamStoreTag

          yield* store.getOrCreate('idempotent-stream-2')
          yield* store.getOrCreate('idempotent-stream-2')
          yield* store.getOrCreate('idempotent-stream-2')

          const exists = yield* store.exists('idempotent-stream-2')
          expect(exists).toBe(true)
        })
      )
    })
  })

  describe('append', () => {
    test('appends data to stream', async () => {
      await runTest(
        Effect.gen(function* () {
          const store = yield* StreamStoreTag

          yield* store.create('append-stream')

          const result = yield* store.append('append-stream', { event: 'test', value: 42 })

          expect(result.success).toBe(true)
          expect(result.streamId).toBe('append-stream')
          expect(result.offset).toBe('1')
        })
      )
    })

    test('increments offset on each append', async () => {
      await runTest(
        Effect.gen(function* () {
          const store = yield* StreamStoreTag

          yield* store.create('multi-append-stream')

          const r1 = yield* store.append('multi-append-stream', { n: 1 })
          const r2 = yield* store.append('multi-append-stream', { n: 2 })
          const r3 = yield* store.append('multi-append-stream', { n: 3 })

          expect(r1.offset).toBe('1')
          expect(r2.offset).toBe('2')
          expect(r3.offset).toBe('3')
        })
      )
    })

    test('fails when stream does not exist', async () => {
      await runTest(
        Effect.gen(function* () {
          const store = yield* StreamStoreTag

          const result = yield* store.append('nonexistent-stream', { data: 'test' }).pipe(
            Effect.either
          )

          expect(result._tag).toBe('Left')
          if (result._tag === 'Left') {
            expect(result.left).toBeInstanceOf(StreamNotFoundError)
          }
        })
      )
    })
  })

  describe('read', () => {
    test('reads all entries from stream', async () => {
      await runTest(
        Effect.gen(function* () {
          const store = yield* StreamStoreTag

          yield* store.create('read-stream')
          yield* store.append('read-stream', { event: 'a' })
          yield* store.append('read-stream', { event: 'b' })
          yield* store.append('read-stream', { event: 'c' })

          const data = yield* store.read('read-stream')

          expect(data.entries).toHaveLength(3)
          expect(data.entries[0]?.data).toEqual({ event: 'a' })
          expect(data.entries[1]?.data).toEqual({ event: 'b' })
          expect(data.entries[2]?.data).toEqual({ event: 'c' })
        })
      )
    })

    test('reads from offset', async () => {
      await runTest(
        Effect.gen(function* () {
          const store = yield* StreamStoreTag

          yield* store.create('offset-read-stream')
          yield* store.append('offset-read-stream', { n: 1 })
          yield* store.append('offset-read-stream', { n: 2 })
          yield* store.append('offset-read-stream', { n: 3 })
          yield* store.append('offset-read-stream', { n: 4 })

          // Read from offset 2 (should get entries 3, 4)
          const data = yield* store.read('offset-read-stream', '2')

          expect(data.entries).toHaveLength(2)
          expect(data.entries[0]?.data).toEqual({ n: 3 })
          expect(data.entries[1]?.data).toEqual({ n: 4 })
        })
      )
    })

    test('respects limit', async () => {
      await runTest(
        Effect.gen(function* () {
          const store = yield* StreamStoreTag

          yield* store.create('limit-read-stream')
          for (let i = 1; i <= 10; i++) {
            yield* store.append('limit-read-stream', { n: i })
          }

          const data = yield* store.read('limit-read-stream', '0', 3)

          expect(data.entries).toHaveLength(3)
          expect(data.lastOffset).toBe('3')
          expect(data.upToDate).toBe(false)
        })
      )
    })

    test('returns upToDate when at end', async () => {
      await runTest(
        Effect.gen(function* () {
          const store = yield* StreamStoreTag

          yield* store.create('uptodate-stream')
          yield* store.append('uptodate-stream', { event: 'only' })

          const data = yield* store.read('uptodate-stream')

          expect(data.upToDate).toBe(true)
        })
      )
    })

    test('fails when stream does not exist', async () => {
      await runTest(
        Effect.gen(function* () {
          const store = yield* StreamStoreTag

          const result = yield* store.read('ghost-stream').pipe(
            Effect.either
          )

          expect(result._tag).toBe('Left')
          if (result._tag === 'Left') {
            expect(result.left).toBeInstanceOf(StreamNotFoundError)
          }
        })
      )
    })
  })

  describe('metadata', () => {
    test('returns metadata for existing stream', async () => {
      await runTest(
        Effect.gen(function* () {
          const store = yield* StreamStoreTag

          yield* store.create('meta-stream')
          yield* store.append('meta-stream', { event: 'test' })

          const meta = yield* store.metadata('meta-stream')

          expect(meta.exists).toBe(true)
          expect(meta.streamId).toBe('meta-stream')
          expect(meta.contentType).toBe('application/json')
          expect(meta.currentOffset).toBe('1')
          expect(meta.createdAt).toBeDefined()
          expect(meta.updatedAt).toBeDefined()
        })
      )
    })

    test('returns exists=false for nonexistent stream', async () => {
      await runTest(
        Effect.gen(function* () {
          const store = yield* StreamStoreTag

          const meta = yield* store.metadata('no-such-stream')

          expect(meta.exists).toBe(false)
        })
      )
    })
  })

  describe('delete', () => {
    test('deletes a stream', async () => {
      await runTest(
        Effect.gen(function* () {
          const store = yield* StreamStoreTag

          yield* store.create('delete-me-stream')
          yield* store.append('delete-me-stream', { data: 'will be deleted' })

          const beforeExists = yield* store.exists('delete-me-stream')
          expect(beforeExists).toBe(true)

          yield* store.delete('delete-me-stream')

          const afterExists = yield* store.exists('delete-me-stream')
          expect(afterExists).toBe(false)
        })
      )
    })

    test('delete is idempotent', async () => {
      await runTest(
        Effect.gen(function* () {
          const store = yield* StreamStoreTag

          // Delete nonexistent stream should not error
          yield* store.delete('never-existed-stream')
          yield* store.delete('never-existed-stream')

          // Verify no error
          const exists = yield* store.exists('never-existed-stream')
          expect(exists).toBe(false)
        })
      )
    })
  })

  describe('count', () => {
    test('counts streams', async () => {
      await runTest(
        Effect.gen(function* () {
          const store = yield* StreamStoreTag

          // Get initial count
          const initialCount = yield* store.count()

          // Create some streams
          yield* store.create('count-stream-1')
          yield* store.create('count-stream-2')
          yield* store.create('count-stream-3')

          const newCount = yield* store.count()
          expect(newCount).toBe(initialCount + 3)
        })
      )
    })
  })

  describe('integration: full workflow', () => {
    test('handles complete stream lifecycle', async () => {
      await runTest(
        Effect.gen(function* () {
          const store = yield* StreamStoreTag
          const streamId = 'lifecycle-test-stream'

          // 1. Create
          yield* store.create(streamId)
          expect(yield* store.exists(streamId)).toBe(true)

          // 2. Append multiple events
          const events = [
            { _tag: 'Created', id: '1', name: 'Test' },
            { _tag: 'Updated', id: '1', name: 'Test Updated' },
            { _tag: 'Deleted', id: '1' },
          ]

          for (const event of events) {
            yield* store.append(streamId, event)
          }

          // 3. Read all
          const data = yield* store.read(streamId)
          expect(data.entries).toHaveLength(3)
          expect(data.entries.map(e => e.data)).toEqual(events)

          // 4. Read with resume (from offset 1)
          const resumed = yield* store.read(streamId, '1')
          expect(resumed.entries).toHaveLength(2)
          expect(resumed.entries[0]?.data).toEqual(events[1])

          // 5. Check metadata
          const meta = yield* store.metadata(streamId)
          expect(meta.exists).toBe(true)
          expect(meta.currentOffset).toBe('3')

          // 6. Delete
          yield* store.delete(streamId)
          expect(yield* store.exists(streamId)).toBe(false)
        })
      )
    })
  })
})
