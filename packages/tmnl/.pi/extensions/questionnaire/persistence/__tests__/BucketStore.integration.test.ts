/**
 * Integration tests — BucketStore + QuestionnaireStore against real MinIO.
 *
 * Requires: docker compose up minio (port 9000)
 * Bucket: questionnaires (created by minio-init or manually)
 *
 * These tests hit the wire. They prove the S3 protocol works end-to-end.
 */

import { describe, it, assert, beforeAll, afterAll } from '@effect/vitest'
import { Effect, Layer, Schema } from 'effect'
import { S3Service } from '@effect-aws/client-s3'

import {
  BucketStore,
  BucketStoreConfig,
  S3BucketStoreLive,
  QuestionnaireStore,
  QuestionnaireStoreLive,
  QueryFilter,
} from '../index.ts'

import { Questionnaire, QuestionnaireResult, Answer, Question, QuestionOption } from '../../schema.ts'

// =============================================================================
// MinIO Layer — real S3 via @effect-aws/client-s3
// =============================================================================

/**
 * Each test run gets a unique prefix to avoid collisions.
 * This means we can run tests in parallel without cleanup concerns.
 */
const testRunId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const MinIOConfig = BucketStoreConfig.Custom({
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  accessKeyId: 'minioadmin',
  secretAccessKey: 'minioadmin',
  bucket: 'questionnaires',
  forcePathStyle: true,
  keyPrefix: `${testRunId}/`,
})

/** @effect-aws S3Service layer configured for MinIO */
const S3ServiceLayer = S3Service.layer({
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
  },
  forcePathStyle: true,
})

const S3Layer = S3BucketStoreLive.pipe(
  Layer.provide(MinIOConfig),
  Layer.provide(S3ServiceLayer),
)
const StoreLayer = QuestionnaireStoreLive.pipe(Layer.provide(S3Layer))

// =============================================================================
// Test Fixtures
// =============================================================================

const makeSpec = (id = 'integ-spec'): Questionnaire =>
  new Questionnaire({
    id,
    title: 'Integration Test Survey',
    description: 'Tests real S3 round-trip',
    questions: [
      new Question({
        id: 'q1',
        prompt: 'Choose wisely',
        type: 'select' as const,
        options: [
          new QuestionOption({ value: 'red', label: 'Red Pill' }),
          new QuestionOption({ value: 'blue', label: 'Blue Pill' }),
        ],
      }),
      new Question({
        id: 'q2',
        prompt: 'How deep?',
        type: 'input' as const,
      }),
    ],
    startId: 'q1',
    tags: ['integration', 'test'],
    persist: true,
  })

const makeResult = (specId = 'integ-spec'): QuestionnaireResult =>
  new QuestionnaireResult({
    questionnaireId: specId,
    cancelled: false,
    completedAt: new Date().toISOString(),
    tags: ['integration', 'test'],
    answers: [
      new Answer({ questionId: 'q1', value: 'red', label: 'Red Pill' }),
      new Answer({ questionId: 'q2', value: 'all the way', label: 'all the way', wasCustom: true }),
    ],
  })

// =============================================================================
// BucketStore — S3 Wire Tests
// =============================================================================

describe('BucketStore (MinIO integration)', () => {
  it.scoped('isReady returns true when MinIO is up', () =>
    Effect.gen(function* () {
      const store = yield* BucketStore
      const ready = yield* store.isReady()
      assert.isTrue(ready)
    }).pipe(Effect.provide(S3Layer)),
  )

  it.scoped('put + get round-trips JSON through real S3', () =>
    Effect.gen(function* () {
      const store = yield* BucketStore
      const S = Schema.Struct({ message: Schema.String, count: Schema.Number })

      const data = { message: 'hello from MinIO', count: 42 }
      yield* store.put('integ/round-trip.json', data, S)

      const retrieved = yield* store.get('integ/round-trip.json', S)
      assert.deepStrictEqual(retrieved, data)
    }).pipe(Effect.provide(S3Layer)),
  )

  it.scoped('get returns null for non-existent key', () =>
    Effect.gen(function* () {
      const store = yield* BucketStore
      const S = Schema.Struct({ x: Schema.Number })
      const result = yield* store.get('does/not/exist.json', S)
      assert.isNull(result)
    }).pipe(Effect.provide(S3Layer)),
  )

  it.scoped('putRaw + getRaw works with raw strings', () =>
    Effect.gen(function* () {
      const store = yield* BucketStore
      yield* store.putRaw('integ/raw.txt', 'raw content here', 'text/plain')
      const raw = yield* store.getRaw('integ/raw.txt')
      assert.strictEqual(raw, 'raw content here')
    }).pipe(Effect.provide(S3Layer)),
  )

  it.scoped('exists + del lifecycle', () =>
    Effect.gen(function* () {
      const store = yield* BucketStore
      const S = Schema.Struct({ v: Schema.String })

      yield* store.put('integ/to-delete.json', { v: 'ephemeral' }, S)
      assert.isTrue(yield* store.exists('integ/to-delete.json'))

      yield* store.del('integ/to-delete.json')
      assert.isFalse(yield* store.exists('integ/to-delete.json'))
    }).pipe(Effect.provide(S3Layer)),
  )

  it.scoped('list filters by prefix', () =>
    Effect.gen(function* () {
      const store = yield* BucketStore
      const S = Schema.Struct({ n: Schema.Number })

      yield* store.put('integ/list/a.json', { n: 1 }, S)
      yield* store.put('integ/list/b.json', { n: 2 }, S)
      yield* store.put('integ/other/c.json', { n: 3 }, S)

      const result = yield* store.list('integ/list/')
      assert.strictEqual(result.objects.length, 2)
      assert.isTrue(result.objects.every(o => o.key.startsWith('integ/list/')))
    }).pipe(Effect.provide(S3Layer)),
  )

  it.scoped('head returns metadata', () =>
    Effect.gen(function* () {
      const store = yield* BucketStore
      yield* store.putRaw('integ/head-test.json', '{"check":"metadata"}', 'application/json')

      const meta = yield* store.head('integ/head-test.json')
      assert.isNotNull(meta)
      assert.strictEqual(meta!.key, 'integ/head-test.json')
      assert.isTrue((meta!.size ?? 0) > 0)
    }).pipe(Effect.provide(S3Layer)),
  )

  it.scoped('listAll auto-paginates', () =>
    Effect.gen(function* () {
      const store = yield* BucketStore
      const S = Schema.Struct({ i: Schema.Number })

      for (let i = 0; i < 5; i++) {
        yield* store.put(`integ/all/${i}.json`, { i }, S)
      }

      const all = yield* store.listAll('integ/all/')
      assert.strictEqual(all.length, 5)
    }).pipe(Effect.provide(S3Layer)),
  )
})

// =============================================================================
// QuestionnaireStore — Full Stack Integration
// =============================================================================

describe('QuestionnaireStore (MinIO integration)', () => {
  it.scoped('save spec + result + query round-trip', () =>
    Effect.gen(function* () {
      const store = yield* QuestionnaireStore
      const spec = makeSpec()

      // Save spec
      const persisted = yield* store.saveSpec(spec)
      assert.strictEqual(persisted.specId, 'integ-spec')
      assert.strictEqual(persisted.version, 1)

      // Save result
      const result = makeResult()
      const saved = yield* store.saveResult(spec, result, 1)
      assert.isTrue(saved.resultId.length > 0)
      assert.deepStrictEqual(saved.answerIndex, { q1: 'red', q2: 'all the way' })

      // Get result back
      const retrieved = yield* store.getResult('integ-spec', saved.resultId)
      assert.isNotNull(retrieved)
      assert.strictEqual(retrieved!.resultId, saved.resultId)

      // Query by spec ID
      const bySpec = yield* store.query(new QueryFilter({ specId: 'integ-spec' }))
      assert.strictEqual(bySpec.total, 1)

      // Query by tag
      const byTag = yield* store.query(new QueryFilter({ tags: ['integration'] }))
      assert.isTrue(byTag.total >= 1)

      // Query by answer content
      const byAnswer = yield* store.query(new QueryFilter({
        answerMatch: { q1: 'red' },
      }))
      assert.isTrue(byAnswer.total >= 1)

      // Full-text search
      const fullText = yield* store.query(new QueryFilter({ fullText: 'all the way' }))
      assert.isTrue(fullText.total >= 1)
    }).pipe(Effect.provide(StoreLayer)),
  )

  it.scoped('spec versioning works across S3', () =>
    Effect.gen(function* () {
      const store = yield* QuestionnaireStore
      const spec = makeSpec('version-test')

      const v1 = yield* store.saveSpec(spec, ['v1'])
      assert.strictEqual(v1.version, 1)

      const v2 = yield* store.saveSpec(spec, ['v2'])
      assert.strictEqual(v2.version, 2)

      // Latest should be v2
      const latest = yield* store.getSpec('version-test')
      assert.strictEqual(latest!.version, 2)

      // Can still get v1
      const old = yield* store.getSpec('version-test', 1)
      assert.strictEqual(old!.version, 1)
      assert.deepStrictEqual(old!.tags, ['v1'])
    }).pipe(Effect.provide(StoreLayer)),
  )

  it.scoped('list specs returns catalog from S3', () =>
    Effect.gen(function* () {
      const store = yield* QuestionnaireStore

      yield* store.saveSpec(makeSpec('catalog-a'))
      yield* store.saveSpec(makeSpec('catalog-b'))

      const catalog = yield* store.listSpecs()
      assert.isTrue(catalog.total >= 2)

      const ids = catalog.specs.map(s => s.specId)
      assert.isTrue(ids.includes('catalog-a'))
      assert.isTrue(ids.includes('catalog-b'))
    }).pipe(Effect.provide(StoreLayer)),
  )

  it.scoped('delete spec removes everything from S3', () =>
    Effect.gen(function* () {
      const store = yield* QuestionnaireStore
      const spec = makeSpec('to-delete')

      yield* store.saveSpec(spec)
      yield* store.saveResult(spec, makeResult('to-delete'), 1)

      yield* store.deleteSpec('to-delete')

      const gone = yield* store.getSpec('to-delete')
      assert.isNull(gone)

      const results = yield* store.listResults('to-delete')
      assert.strictEqual(results.length, 0)
    }).pipe(Effect.provide(StoreLayer)),
  )

  it.scoped('isReady confirms MinIO connectivity', () =>
    Effect.gen(function* () {
      const store = yield* QuestionnaireStore
      assert.isTrue(yield* store.isReady())
    }).pipe(Effect.provide(StoreLayer)),
  )
})
