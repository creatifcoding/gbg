/**
 * Tests for BucketStore (in-memory) + QuestionnaireStore + all 5 query dimensions.
 *
 * Uses @effect/vitest with in-memory BucketStore — no network, no MinIO needed.
 */

import { describe, it, assert } from '@effect/vitest'
import { Effect, Layer, Schema } from 'effect'

import {
  BucketStore,
  InMemoryBucketStoreLive,
  QuestionnaireStore,
  QuestionnaireStoreLive,
  QueryFilter,
  PersistedSpec,
  PersistedResult,
} from '../index.ts'

import { Questionnaire, QuestionnaireResult, Answer, Question, QuestionOption } from '../../schema.ts'

// =============================================================================
// Test Layer — QuestionnaireStore backed by in-memory BucketStore
// =============================================================================

const TestLayer = QuestionnaireStoreLive.pipe(
  Layer.provide(InMemoryBucketStoreLive),
)

// Fresh layer per test to avoid cross-contamination
const freshLayer = () => QuestionnaireStoreLive.pipe(
  Layer.provide(InMemoryBucketStoreLive),
)

// =============================================================================
// Test Fixtures
// =============================================================================

const makeSpec = (overrides?: Partial<{
  id: string
  title: string
  tags: string[]
  persist: boolean
}>): Questionnaire =>
  new Questionnaire({
    id: overrides?.id ?? 'test-spec',
    title: overrides?.title ?? 'Test Survey',
    description: 'A test questionnaire',
    questions: [
      new Question({ id: 'q1', prompt: 'Pick one', type: 'select' as const, options: [
        new QuestionOption({ value: 'a', label: 'Alpha' }),
        new QuestionOption({ value: 'b', label: 'Beta' }),
      ]}),
      new Question({ id: 'q2', prompt: 'Pick another', type: 'select' as const, options: [
        new QuestionOption({ value: 'x', label: 'X-ray' }),
        new QuestionOption({ value: 'y', label: 'Yankee' }),
      ]}),
    ],
    startId: 'q1',
    tags: overrides?.tags ?? ['test'],
    persist: overrides?.persist ?? true,
  })

const makeResult = (overrides?: Partial<{
  questionnaireId: string
  cancelled: boolean
  tags: string[]
  completedAt: string
  answers: Array<{ questionId: string; value: string; label: string }>
}>): QuestionnaireResult =>
  new QuestionnaireResult({
    questionnaireId: overrides?.questionnaireId ?? 'test-spec',
    cancelled: overrides?.cancelled ?? false,
    completedAt: overrides?.completedAt ?? new Date().toISOString(),
    tags: overrides?.tags ?? ['test'],
    answers: (overrides?.answers ?? [
      { questionId: 'q1', value: 'a', label: 'Alpha' },
      { questionId: 'q2', value: 'x', label: 'X-ray' },
    ]).map(a => new Answer(a)),
  })

// =============================================================================
// BucketStore Tests
// =============================================================================

describe('BucketStore (in-memory)', () => {
  it.scoped('put and get round-trips JSON via Schema', () =>
    Effect.gen(function* () {
      const store = yield* BucketStore

      const TestSchema = Schema.Struct({ name: Schema.String, count: Schema.Number })
      type TestType = typeof TestSchema.Type

      const data: TestType = { name: 'hello', count: 42 }
      yield* store.put('test/obj.json', data, TestSchema)

      const retrieved = yield* store.get('test/obj.json', TestSchema)
      assert.deepStrictEqual(retrieved, data)
    }).pipe(Effect.provide(InMemoryBucketStoreLive)),
  )

  it.scoped('get returns null for missing key', () =>
    Effect.gen(function* () {
      const store = yield* BucketStore
      const TestSchema = Schema.Struct({ x: Schema.Number })
      const result = yield* store.get('nonexistent', TestSchema)
      assert.isNull(result)
    }).pipe(Effect.provide(InMemoryBucketStoreLive)),
  )

  it.scoped('require fails for missing key', () =>
    Effect.gen(function* () {
      const store = yield* BucketStore
      const TestSchema = Schema.Struct({ x: Schema.Number })
      const error = yield* store.require('nonexistent', TestSchema).pipe(Effect.flip)
      assert.strictEqual(error._tag, 'BucketObjectNotFoundError')
    }).pipe(Effect.provide(InMemoryBucketStoreLive)),
  )

  it.scoped('del removes object', () =>
    Effect.gen(function* () {
      const store = yield* BucketStore
      const S = Schema.Struct({ v: Schema.String })
      yield* store.put('to-delete', { v: 'bye' }, S)
      assert.isTrue(yield* store.exists('to-delete'))
      yield* store.del('to-delete')
      assert.isFalse(yield* store.exists('to-delete'))
    }).pipe(Effect.provide(InMemoryBucketStoreLive)),
  )

  it.scoped('list filters by prefix', () =>
    Effect.gen(function* () {
      const store = yield* BucketStore
      const S = Schema.Struct({ v: Schema.Number })
      yield* store.put('prefix/a.json', { v: 1 }, S)
      yield* store.put('prefix/b.json', { v: 2 }, S)
      yield* store.put('other/c.json', { v: 3 }, S)

      const result = yield* store.list('prefix/')
      assert.strictEqual(result.objects.length, 2)
      assert.isTrue(result.objects.every(o => o.key.startsWith('prefix/')))
    }).pipe(Effect.provide(InMemoryBucketStoreLive)),
  )

  it.scoped('listAll returns all matching objects', () =>
    Effect.gen(function* () {
      const store = yield* BucketStore
      const S = Schema.Struct({ v: Schema.Number })
      for (let i = 0; i < 5; i++) {
        yield* store.put(`all/${i}.json`, { v: i }, S)
      }
      const all = yield* store.listAll('all/')
      assert.strictEqual(all.length, 5)
    }).pipe(Effect.provide(InMemoryBucketStoreLive)),
  )

  it.scoped('head returns metadata', () =>
    Effect.gen(function* () {
      const store = yield* BucketStore
      yield* store.putRaw('meta-test', '{"hello":"world"}', 'application/json')
      const meta = yield* store.head('meta-test')
      assert.isNotNull(meta)
      assert.strictEqual(meta!.key, 'meta-test')
      assert.isTrue(meta!.size > 0)
    }).pipe(Effect.provide(InMemoryBucketStoreLive)),
  )

  it.scoped('isReady returns true', () =>
    Effect.gen(function* () {
      const store = yield* BucketStore
      assert.isTrue(yield* store.isReady())
    }).pipe(Effect.provide(InMemoryBucketStoreLive)),
  )
})

// =============================================================================
// QuestionnaireStore — Spec Library Tests
// =============================================================================

describe('QuestionnaireStore — Spec Library', () => {
  it.scoped('saveSpec creates version 1 on first save', () =>
    Effect.gen(function* () {
      const store = yield* QuestionnaireStore
      const spec = makeSpec()
      const persisted = yield* store.saveSpec(spec)

      assert.strictEqual(persisted.specId, 'test-spec')
      assert.strictEqual(persisted.version, 1)
      assert.deepStrictEqual(persisted.tags, ['test'])
    }).pipe(Effect.provide(freshLayer())),
  )

  it.scoped('saveSpec auto-increments version', () =>
    Effect.gen(function* () {
      const store = yield* QuestionnaireStore
      const spec = makeSpec()

      const v1 = yield* store.saveSpec(spec)
      assert.strictEqual(v1.version, 1)

      const v2 = yield* store.saveSpec(spec)
      assert.strictEqual(v2.version, 2)

      const v3 = yield* store.saveSpec(spec)
      assert.strictEqual(v3.version, 3)
    }).pipe(Effect.provide(freshLayer())),
  )

  it.scoped('getSpec returns latest by default', () =>
    Effect.gen(function* () {
      const store = yield* QuestionnaireStore
      const spec = makeSpec()

      yield* store.saveSpec(spec)
      yield* store.saveSpec(spec)

      const latest = yield* store.getSpec('test-spec')
      assert.isNotNull(latest)
      assert.strictEqual(latest!.version, 2)
    }).pipe(Effect.provide(freshLayer())),
  )

  it.scoped('getSpec returns specific version', () =>
    Effect.gen(function* () {
      const store = yield* QuestionnaireStore
      const spec = makeSpec()

      yield* store.saveSpec(spec)
      yield* store.saveSpec(spec, ['v2-tag'])

      const v1 = yield* store.getSpec('test-spec', 1)
      assert.isNotNull(v1)
      assert.strictEqual(v1!.version, 1)
      assert.deepStrictEqual(v1!.tags, ['test'])

      const v2 = yield* store.getSpec('test-spec', 2)
      assert.isNotNull(v2)
      assert.deepStrictEqual(v2!.tags, ['v2-tag'])
    }).pipe(Effect.provide(freshLayer())),
  )

  it.scoped('getSpec returns null for unknown spec', () =>
    Effect.gen(function* () {
      const store = yield* QuestionnaireStore
      const result = yield* store.getSpec('nonexistent')
      assert.isNull(result)
    }).pipe(Effect.provide(freshLayer())),
  )

  it.scoped('requireSpec fails for unknown spec', () =>
    Effect.gen(function* () {
      const store = yield* QuestionnaireStore
      const error = yield* store.requireSpec('nonexistent').pipe(Effect.flip)
      assert.strictEqual(error._tag, 'SpecNotFoundError')
    }).pipe(Effect.provide(freshLayer())),
  )

  it.scoped('listSpecs returns catalog', () =>
    Effect.gen(function* () {
      const store = yield* QuestionnaireStore

      yield* store.saveSpec(makeSpec({ id: 'spec-a', title: 'Spec A' }))
      yield* store.saveSpec(makeSpec({ id: 'spec-b', title: 'Spec B' }))

      const catalog = yield* store.listSpecs()
      assert.strictEqual(catalog.total, 2)
      const ids = catalog.specs.map(s => s.specId).sort()
      assert.deepStrictEqual(ids, ['spec-a', 'spec-b'])
    }).pipe(Effect.provide(freshLayer())),
  )

  it.scoped('deleteSpec removes spec and results', () =>
    Effect.gen(function* () {
      const store = yield* QuestionnaireStore
      const spec = makeSpec()

      yield* store.saveSpec(spec)
      yield* store.saveResult(spec, makeResult(), 1)

      yield* store.deleteSpec('test-spec')

      const result = yield* store.getSpec('test-spec')
      assert.isNull(result)

      const results = yield* store.listResults('test-spec')
      assert.strictEqual(results.length, 0)
    }).pipe(Effect.provide(freshLayer())),
  )
})

// =============================================================================
// QuestionnaireStore — Result Archive Tests
// =============================================================================

describe('QuestionnaireStore — Result Archive', () => {
  it.scoped('saveResult creates a persisted result with generated ID', () =>
    Effect.gen(function* () {
      const store = yield* QuestionnaireStore
      const spec = makeSpec()
      yield* store.saveSpec(spec)

      const result = makeResult()
      const persisted = yield* store.saveResult(spec, result, 1)

      assert.isTrue(persisted.resultId.length > 0)
      assert.strictEqual(persisted.specId, 'test-spec')
      assert.strictEqual(persisted.specVersion, 1)
      assert.strictEqual(persisted.cancelled, false)
      assert.deepStrictEqual(persisted.answerIndex, { q1: 'a', q2: 'x' })
    }).pipe(Effect.provide(freshLayer())),
  )

  it.scoped('listResults returns all results for a spec', () =>
    Effect.gen(function* () {
      const store = yield* QuestionnaireStore
      const spec = makeSpec()
      yield* store.saveSpec(spec)

      yield* store.saveResult(spec, makeResult(), 1)
      yield* store.saveResult(spec, makeResult(), 1)
      yield* store.saveResult(spec, makeResult(), 1)

      const results = yield* store.listResults('test-spec')
      assert.strictEqual(results.length, 3)
    }).pipe(Effect.provide(freshLayer())),
  )

  it.scoped('getResult retrieves specific result', () =>
    Effect.gen(function* () {
      const store = yield* QuestionnaireStore
      const spec = makeSpec()
      yield* store.saveSpec(spec)

      const saved = yield* store.saveResult(spec, makeResult(), 1)
      const retrieved = yield* store.getResult('test-spec', saved.resultId)

      assert.isNotNull(retrieved)
      assert.strictEqual(retrieved!.resultId, saved.resultId)
    }).pipe(Effect.provide(freshLayer())),
  )

  it.scoped('deleteResult removes result', () =>
    Effect.gen(function* () {
      const store = yield* QuestionnaireStore
      const spec = makeSpec()
      yield* store.saveSpec(spec)

      const saved = yield* store.saveResult(spec, makeResult(), 1)
      yield* store.deleteResult('test-spec', saved.resultId)

      const retrieved = yield* store.getResult('test-spec', saved.resultId)
      assert.isNull(retrieved)
    }).pipe(Effect.provide(freshLayer())),
  )
})

// =============================================================================
// QuestionnaireStore — Query (all 5 dimensions)
// =============================================================================

describe('QuestionnaireStore — Query', () => {
  // Helper to set up a populated store
  const populatedStore = () =>
    Effect.gen(function* () {
      const store = yield* QuestionnaireStore

      // Spec A — architecture decisions
      const specA = makeSpec({ id: 'arch-decision', tags: ['architecture', 'decision'] })
      yield* store.saveSpec(specA)

      // Result 1: chose frontend
      yield* store.saveResult(specA, makeResult({
        questionnaireId: 'arch-decision',
        tags: ['architecture', 'decision'],
        completedAt: '2025-01-15T10:00:00Z',
        answers: [
          { questionId: 'q1', value: 'frontend', label: 'Frontend' },
          { questionId: 'q2', value: 'performance', label: 'Performance' },
        ],
      }), 1)

      // Result 2: chose backend
      yield* store.saveResult(specA, makeResult({
        questionnaireId: 'arch-decision',
        tags: ['architecture', 'decision'],
        completedAt: '2025-02-01T14:00:00Z',
        answers: [
          { questionId: 'q1', value: 'backend', label: 'Backend' },
          { questionId: 'q2', value: 'auth', label: 'Authentication' },
        ],
      }), 1)

      // Spec B — retro survey
      const specB = makeSpec({ id: 'retro-survey', tags: ['retro', 'team'] })
      yield* store.saveSpec(specB)

      // Result 3: cancelled
      yield* store.saveResult(specB, makeResult({
        questionnaireId: 'retro-survey',
        cancelled: true,
        tags: ['retro', 'team'],
        completedAt: '2025-01-20T09:00:00Z',
        answers: [],
      }), 1)

      // Result 4: completed retro
      yield* store.saveResult(specB, makeResult({
        questionnaireId: 'retro-survey',
        tags: ['retro', 'team'],
        completedAt: '2025-03-01T16:00:00Z',
        answers: [
          { questionId: 'q1', value: 'good', label: 'Things went well' },
          { questionId: 'q2', value: 'deploy', label: 'Deployment process' },
        ],
      }), 1)

      return store
    })

  // ── Dimension 1: By spec ID ────────────────────────────────────────────

  it.scoped('query by specId', () =>
    Effect.gen(function* () {
      yield* populatedStore()
      const store = yield* QuestionnaireStore

      const result = yield* store.query(new QueryFilter({ specId: 'arch-decision' }))
      assert.strictEqual(result.total, 2)
      assert.isTrue(result.results.every(r => r.specId === 'arch-decision'))
    }).pipe(Effect.provide(freshLayer())),
  )

  // ── Dimension 2: By date range ─────────────────────────────────────────

  it.scoped('query by date range', () =>
    Effect.gen(function* () {
      yield* populatedStore()
      const store = yield* QuestionnaireStore

      const result = yield* store.query(new QueryFilter({
        dateFrom: '2025-01-16T00:00:00Z',
        dateTo: '2025-02-28T00:00:00Z',
      }))
      // Should match: Result 2 (Feb 1) and Result 3 (Jan 20)
      assert.strictEqual(result.total, 2)
    }).pipe(Effect.provide(freshLayer())),
  )

  // ── Dimension 3: By tags ───────────────────────────────────────────────

  it.scoped('query by tags (AND logic)', () =>
    Effect.gen(function* () {
      yield* populatedStore()
      const store = yield* QuestionnaireStore

      // Single tag
      const archResults = yield* store.query(new QueryFilter({ tags: ['architecture'] }))
      assert.strictEqual(archResults.total, 2)

      // Multiple tags (AND)
      const retroTeam = yield* store.query(new QueryFilter({ tags: ['retro', 'team'] }))
      assert.strictEqual(retroTeam.total, 2)

      // Non-existent tag
      const empty = yield* store.query(new QueryFilter({ tags: ['nonexistent'] }))
      assert.strictEqual(empty.total, 0)
    }).pipe(Effect.provide(freshLayer())),
  )

  // ── Dimension 4: By answer content ─────────────────────────────────────

  it.scoped('query by answer content', () =>
    Effect.gen(function* () {
      yield* populatedStore()
      const store = yield* QuestionnaireStore

      const result = yield* store.query(new QueryFilter({
        answerMatch: { q1: 'frontend' },
      }))
      assert.strictEqual(result.total, 1)
      assert.strictEqual(result.results[0].answerIndex['q1'], 'frontend')
    }).pipe(Effect.provide(freshLayer())),
  )

  it.scoped('answer match is case-insensitive substring', () =>
    Effect.gen(function* () {
      yield* populatedStore()
      const store = yield* QuestionnaireStore

      const result = yield* store.query(new QueryFilter({
        answerMatch: { q1: 'FRONT' },
      }))
      assert.strictEqual(result.total, 1)
    }).pipe(Effect.provide(freshLayer())),
  )

  // ── Dimension 5: Full-text search ──────────────────────────────────────

  it.scoped('full-text search across answers', () =>
    Effect.gen(function* () {
      yield* populatedStore()
      const store = yield* QuestionnaireStore

      const result = yield* store.query(new QueryFilter({ fullText: 'deploy' }))
      assert.strictEqual(result.total, 1)
      assert.strictEqual(result.results[0].specId, 'retro-survey')
    }).pipe(Effect.provide(freshLayer())),
  )

  it.scoped('full-text search across tags', () =>
    Effect.gen(function* () {
      yield* populatedStore()
      const store = yield* QuestionnaireStore

      const result = yield* store.query(new QueryFilter({ fullText: 'architecture' }))
      assert.strictEqual(result.total, 2)
    }).pipe(Effect.provide(freshLayer())),
  )

  // ── Combined filters ───────────────────────────────────────────────────

  it.scoped('combined filters (AND)', () =>
    Effect.gen(function* () {
      yield* populatedStore()
      const store = yield* QuestionnaireStore

      const result = yield* store.query(new QueryFilter({
        specId: 'arch-decision',
        answerMatch: { q1: 'backend' },
        tags: ['architecture'],
      }))
      assert.strictEqual(result.total, 1)
      assert.strictEqual(result.results[0].answerIndex['q1'], 'backend')
    }).pipe(Effect.provide(freshLayer())),
  )

  // ── Status filter ──────────────────────────────────────────────────────

  it.scoped('query by status: completed', () =>
    Effect.gen(function* () {
      yield* populatedStore()
      const store = yield* QuestionnaireStore

      const result = yield* store.query(new QueryFilter({ status: 'completed' }))
      assert.isTrue(result.results.every(r => !r.cancelled))
      assert.strictEqual(result.total, 3)
    }).pipe(Effect.provide(freshLayer())),
  )

  it.scoped('query by status: cancelled', () =>
    Effect.gen(function* () {
      yield* populatedStore()
      const store = yield* QuestionnaireStore

      const result = yield* store.query(new QueryFilter({ status: 'cancelled' }))
      assert.strictEqual(result.total, 1)
      assert.isTrue(result.results[0].cancelled)
    }).pipe(Effect.provide(freshLayer())),
  )

  // ── Pagination ─────────────────────────────────────────────────────────

  it.scoped('pagination works', () =>
    Effect.gen(function* () {
      yield* populatedStore()
      const store = yield* QuestionnaireStore

      const page1 = yield* store.query(new QueryFilter({ limit: 2, offset: 0 }))
      assert.strictEqual(page1.results.length, 2)
      assert.strictEqual(page1.total, 4)
      assert.isTrue(page1.hasMore)

      const page2 = yield* store.query(new QueryFilter({ limit: 2, offset: 2 }))
      assert.strictEqual(page2.results.length, 2)
      assert.isFalse(page2.hasMore)
    }).pipe(Effect.provide(freshLayer())),
  )

  // ── Empty query returns all ────────────────────────────────────────────

  it.scoped('empty query returns all results', () =>
    Effect.gen(function* () {
      yield* populatedStore()
      const store = yield* QuestionnaireStore

      const result = yield* store.query(new QueryFilter({}))
      assert.strictEqual(result.total, 4)
    }).pipe(Effect.provide(freshLayer())),
  )
})
