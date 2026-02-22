/**
 * Tests for richAnswerIndex enrichment, backward compatibility, and patch migration.
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
  PersistedResult,
  RichAnswerEntry,
  resultKey,
} from '../index.ts'

import {
  Questionnaire,
  QuestionnaireResult,
  Answer,
  Question,
  QuestionOption,
} from '../../schema.ts'

// =============================================================================
// Test Layer — fresh per test to avoid cross-contamination
// QuestionnaireStoreLive needs BucketStore; some tests also access BucketStore directly.
// passthrough ensures BucketStore is available in the output alongside QuestionnaireStore.
// =============================================================================

const freshLayer = () => {
  const bucketLayer = InMemoryBucketStoreLive
  const storeLayer = QuestionnaireStoreLive.pipe(Layer.provide(bucketLayer))
  return Layer.merge(storeLayer, bucketLayer)
}

// =============================================================================
// Fixtures
// =============================================================================

const makeSpec = (overrides?: Partial<{ id: string; title: string }>): Questionnaire =>
  new Questionnaire({
    id: overrides?.id ?? 'rich-test',
    title: overrides?.title ?? 'Rich Test Survey',
    description: 'Tests for richAnswerIndex',
    questions: [
      new Question({
        id: 'q1',
        prompt: 'What area should we focus on?',
        type: 'select' as const,
        options: [
          new QuestionOption({ value: 'frontend', label: 'Frontend', description: 'React components' }),
          new QuestionOption({ value: 'backend', label: 'Backend', description: 'API and services' }),
        ],
      }),
      new Question({
        id: 'q2',
        prompt: 'Which frontend concern?',
        type: 'select' as const,
        options: [
          new QuestionOption({ value: 'perf', label: 'Performance' }),
          new QuestionOption({ value: 'a11y', label: 'Accessibility' }),
        ],
      }),
    ],
    startId: 'q1',
    tags: ['test'],
  })

const makeResult = (overrides?: Partial<{
  answers: Array<{ questionId: string; value: string; label: string; wasCustom?: boolean; note?: string }>
}>): QuestionnaireResult =>
  new QuestionnaireResult({
    questionnaireId: 'rich-test',
    cancelled: false,
    completedAt: new Date().toISOString(),
    tags: ['test'],
    answers: (overrides?.answers ?? [
      { questionId: 'q1', value: 'frontend', label: 'Frontend' },
      { questionId: 'q2', value: 'perf', label: 'Performance' },
    ]).map(a => new Answer(a)),
  })

// =============================================================================
// Test 1: New result includes richAnswerIndex
// =============================================================================

describe('richAnswerIndex — saveResult enrichment', () => {
  it.scoped('new result includes richAnswerIndex with prompt text', () =>
    Effect.gen(function* () {
      const store = yield* QuestionnaireStore
      const spec = makeSpec()
      yield* store.saveSpec(spec)

      const result = makeResult()
      const persisted = yield* store.saveResult(spec, result, 1)

      // richAnswerIndex should be populated
      assert.isTrue(Object.keys(persisted.richAnswerIndex).length > 0)
      assert.strictEqual(Object.keys(persisted.richAnswerIndex).length, 2)

      // q1 entry should have the prompt from the spec
      const q1Rich = persisted.richAnswerIndex['q1']
      assert.isDefined(q1Rich)
      assert.strictEqual(q1Rich.prompt, 'What area should we focus on?')
      assert.strictEqual(q1Rich.value, 'frontend')
      assert.strictEqual(q1Rich.label, 'Frontend')

      // q2 entry
      const q2Rich = persisted.richAnswerIndex['q2']
      assert.isDefined(q2Rich)
      assert.strictEqual(q2Rich.prompt, 'Which frontend concern?')
      assert.strictEqual(q2Rich.value, 'perf')
      assert.strictEqual(q2Rich.label, 'Performance')
    }).pipe(Effect.provide(freshLayer())),
  )

  it.scoped('richAnswerIndex preserves wasCustom and note', () =>
    Effect.gen(function* () {
      const store = yield* QuestionnaireStore
      const spec = makeSpec()
      yield* store.saveSpec(spec)

      const result = makeResult({
        answers: [
          { questionId: 'q1', value: 'custom-area', label: 'Custom Area', wasCustom: true, note: 'Something special' },
          { questionId: 'q2', value: 'perf', label: 'Performance' },
        ],
      })
      const persisted = yield* store.saveResult(spec, result, 1)

      const q1Rich = persisted.richAnswerIndex['q1']
      assert.strictEqual(q1Rich.wasCustom, true)
      assert.strictEqual(q1Rich.note, 'Something special')

      // q2 should NOT have wasCustom or note
      const q2Rich = persisted.richAnswerIndex['q2']
      assert.strictEqual(q2Rich.wasCustom, false) // default
      assert.isUndefined(q2Rich.note)
    }).pipe(Effect.provide(freshLayer())),
  )

  it.scoped('answerIndex is still populated alongside richAnswerIndex', () =>
    Effect.gen(function* () {
      const store = yield* QuestionnaireStore
      const spec = makeSpec()
      yield* store.saveSpec(spec)

      const result = makeResult()
      const persisted = yield* store.saveResult(spec, result, 1)

      // Both indexes present
      assert.deepStrictEqual(persisted.answerIndex, { q1: 'frontend', q2: 'perf' })
      assert.strictEqual(Object.keys(persisted.richAnswerIndex).length, 2)
    }).pipe(Effect.provide(freshLayer())),
  )
})

// =============================================================================
// Test 2: Backward compatibility — old results without richAnswerIndex
// =============================================================================

describe('richAnswerIndex — backward compatibility', () => {
  it.scoped('old result JSON without richAnswerIndex decodes with empty default', () =>
    Effect.gen(function* () {
      // Simulate an old persisted result that has no richAnswerIndex field
      const oldJson = {
        _tag: 'PersistedResult',
        resultId: 'old-result-123',
        specId: 'old-spec',
        specVersion: 1,
        completedAt: '2025-01-01T00:00:00Z',
        cancelled: false,
        tags: ['legacy'],
        result: {},
        answerIndex: { q1: 'frontend' },
        // NOTE: no richAnswerIndex field at all
      }

      const decoded = Schema.decodeUnknownSync(PersistedResult)(oldJson)
      assert.isDefined(decoded)
      assert.deepStrictEqual(decoded.richAnswerIndex, {})
      // answerIndex should still be present
      assert.deepStrictEqual(decoded.answerIndex, { q1: 'frontend' })
    }).pipe(Effect.provide(freshLayer())),
  )

  it.scoped('old result with explicit undefined richAnswerIndex decodes fine', () =>
    Effect.gen(function* () {
      const oldJson = {
        _tag: 'PersistedResult',
        resultId: 'old-result-456',
        specId: 'old-spec',
        specVersion: 1,
        completedAt: '2025-01-01T00:00:00Z',
        cancelled: false,
        result: {},
        answerIndex: {},
        richAnswerIndex: undefined,
      }

      const decoded = Schema.decodeUnknownSync(PersistedResult)(oldJson)
      assert.isDefined(decoded)
      assert.deepStrictEqual(decoded.richAnswerIndex, {})
    }).pipe(Effect.provide(freshLayer())),
  )
})

// =============================================================================
// Test 3: updateResult enriches old results
// =============================================================================

describe('richAnswerIndex — updateResult enrichment', () => {
  it.scoped('updateResult can populate richAnswerIndex on an unenriched result', () =>
    Effect.gen(function* () {
      const store = yield* QuestionnaireStore
      const bucket = yield* BucketStore
      const spec = makeSpec()
      yield* store.saveSpec(spec)

      // Save a result normally (will have richAnswerIndex)
      const result = makeResult()
      const saved = yield* store.saveResult(spec, result, 1)

      // Manually strip richAnswerIndex to simulate an old result
      const stripped = new PersistedResult({
        ...saved,
        richAnswerIndex: {},
      })
      yield* bucket.put(resultKey('rich-test', saved.resultId), stripped, PersistedResult)

      // Verify it's stripped
      const beforePatch = yield* store.getResult('rich-test', saved.resultId)
      assert.deepStrictEqual(beforePatch!.richAnswerIndex, {})

      // Now updateResult to populate it
      const updated = yield* store.updateResult('rich-test', saved.resultId, (existing) => {
        const questionMap = spec.questionMap
        const richAnswerIndex: Record<string, RichAnswerEntry> = {}

        const qResult = Schema.decodeUnknownSync(QuestionnaireResult)(existing.result)
        for (const answer of qResult.answers) {
          const question = questionMap.get(answer.questionId)
          richAnswerIndex[answer.questionId] = new RichAnswerEntry({
            prompt: question?.prompt ?? answer.questionId,
            value: answer.value,
            label: answer.label,
            ...(answer.wasCustom ? { wasCustom: answer.wasCustom } : {}),
            ...(answer.note ? { note: answer.note } : {}),
          })
        }

        return new PersistedResult({ ...existing, richAnswerIndex })
      })

      assert.strictEqual(Object.keys(updated.richAnswerIndex).length, 2)
      assert.strictEqual(updated.richAnswerIndex['q1'].prompt, 'What area should we focus on?')
      assert.strictEqual(updated.richAnswerIndex['q1'].value, 'frontend')
      assert.strictEqual(updated.richAnswerIndex['q2'].prompt, 'Which frontend concern?')

      // Verify persistence
      const afterPatch = yield* store.getResult('rich-test', saved.resultId)
      assert.strictEqual(Object.keys(afterPatch!.richAnswerIndex).length, 2)
      assert.strictEqual(afterPatch!.richAnswerIndex['q1'].prompt, 'What area should we focus on?')
    }).pipe(Effect.provide(freshLayer())),
  )

  it.scoped('updateResult fails for nonexistent result', () =>
    Effect.gen(function* () {
      const store = yield* QuestionnaireStore

      const error = yield* store.updateResult(
        'nonexistent-spec',
        'nonexistent-result',
        (existing) => existing,
      ).pipe(Effect.flip)

      // Should fail with a wrapped error (QuestionnaireStoreError wrapping ResultNotFoundError)
      assert.isDefined(error)
    }).pipe(Effect.provide(freshLayer())),
  )
})

// =============================================================================
// Test 4: Idempotency — updateResult on already-enriched result
// =============================================================================

describe('richAnswerIndex — idempotency', () => {
  it.scoped('updateResult on already-enriched result preserves existing data', () =>
    Effect.gen(function* () {
      const store = yield* QuestionnaireStore
      const spec = makeSpec()
      yield* store.saveSpec(spec)

      const result = makeResult()
      const saved = yield* store.saveResult(spec, result, 1)

      // Result is already enriched from saveResult
      assert.strictEqual(Object.keys(saved.richAnswerIndex).length, 2)

      // "Patch" — check if enriched, skip if yes
      const existing = yield* store.getResult('rich-test', saved.resultId)
      const alreadyEnriched = Object.keys(existing!.richAnswerIndex).length > 0
      assert.isTrue(alreadyEnriched)

      // If we do updateResult anyway, data should be identical
      const updated = yield* store.updateResult('rich-test', saved.resultId, (ex) => {
        // Idempotent: return as-is since already enriched
        return ex
      })

      assert.deepStrictEqual(updated.richAnswerIndex, saved.richAnswerIndex)
      assert.strictEqual(updated.richAnswerIndex['q1'].prompt, 'What area should we focus on?')
    }).pipe(Effect.provide(freshLayer())),
  )
})
