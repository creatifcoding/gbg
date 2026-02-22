/**
 * QuestionnaireStore — domain-specific persistence over BucketStore.
 *
 * Manages spec library (versioned) + result archive (queryable).
 * Maintains inverted indexes for tags and dates.
 * Provides all five query dimensions: by-id, date-range, tags, answer-content, full-text.
 *
 * Context.Tag pattern — depends on BucketStore (which is DI-swappable).
 *
 * @module questionnaire/persistence/QuestionnaireStore
 */

import { Effect, Context, Layer, Schema } from 'effect'
import { nanoid } from 'nanoid'

import { BucketStore } from './BucketStore.ts'
import {
  PersistedSpec,
  PersistedResult,
  RichAnswerEntry,
  SpecPointer,
  QueryFilter,
  QueryResult,
  TagIndex,
  DateIndex,
  SpecSummary,
  SpecCatalog,
  ResultSummary,
  QuestionnaireStoreError,
  SpecNotFoundError,
  ResultNotFoundError,
  type SpecId,
  type ResultId,
  type SpecVersion,
  type BucketError,
  type QuestionnaireStoreErrors,
  specVersionKey,
  specLatestKey,
  resultKey,
  tagIndexKey,
  dateIndexKey,
  resultListPrefix,
  specListPrefix,
  isoToDate,
} from './schemas.ts'

import { Questionnaire as QuestionnaireSchema, type Questionnaire, type QuestionnaireResult } from '../schema.ts'
import { QuestionnaireResult as QuestionnaireResultSchema } from '../schema.ts'

// =============================================================================
// Error wrapping helper
// =============================================================================

/**
 * Wrap any bucket-layer error into a QuestionnaireStoreError,
 * preserving the original error chain and adding domain context.
 */
const wrapError = (
  message: string,
  context?: {
    operation?: QuestionnaireStoreError['operation']
    specId?: string
    resultId?: string
  },
) => (err: unknown) =>
  new QuestionnaireStoreError({
    message: `${message}: ${err instanceof Error ? err.message : String(err)}`,
    operation: context?.operation,
    specId: context?.specId,
    resultId: context?.resultId,
    cause: err,
  })

// =============================================================================
// Service Shape
// =============================================================================

export interface QuestionnaireStoreShape {
  // ─── Spec Library ──────────────────────────────────────────────────────

  /**
   * Save a questionnaire spec. Auto-versions:
   * - First save → version 1
   * - Subsequent saves → version N+1
   * Returns the version number.
   */
  readonly saveSpec: (
    spec: Questionnaire,
    tags?: readonly string[],
  ) => Effect.Effect<PersistedSpec, QuestionnaireStoreErrors>

  /**
   * Get a specific version of a spec.
   * If no version, returns the latest.
   */
  readonly getSpec: (
    specId: string,
    version?: number,
  ) => Effect.Effect<PersistedSpec | null, QuestionnaireStoreErrors>

  /**
   * Get the latest spec, failing if not found.
   */
  readonly requireSpec: (
    specId: string,
  ) => Effect.Effect<PersistedSpec, QuestionnaireStoreErrors>

  /**
   * List all specs in the library.
   */
  readonly listSpecs: () => Effect.Effect<SpecCatalog, QuestionnaireStoreErrors>

  /**
   * Delete a spec and all its versions + associated results.
   */
  readonly deleteSpec: (
    specId: string,
  ) => Effect.Effect<void, QuestionnaireStoreErrors>

  // ─── Result Archive ────────────────────────────────────────────────────

  /**
   * Save a questionnaire result. Generates a unique resultId.
   * Automatically updates tag + date indexes.
   * Returns the persisted result with its ID.
   */
  readonly saveResult: (
    spec: Questionnaire,
    result: QuestionnaireResult,
    specVersion: number,
    embedding?: ReadonlyArray<number>,
  ) => Effect.Effect<PersistedResult, QuestionnaireStoreErrors>

  /**
   * Get a single result by its ID + spec ID.
   */
  readonly getResult: (
    specId: string,
    resultId: string,
  ) => Effect.Effect<PersistedResult | null, QuestionnaireStoreErrors>

  /**
   * List results for a specific spec.
   */
  readonly listResults: (
    specId: string,
  ) => Effect.Effect<ReadonlyArray<PersistedResult>, QuestionnaireStoreErrors>

  /**
   * Delete a specific result and clean up indexes.
   */
  readonly deleteResult: (
    specId: string,
    resultId: string,
  ) => Effect.Effect<void, QuestionnaireStoreErrors>

  // ─── Query ─────────────────────────────────────────────────────────────

  /**
   * Query results across all five dimensions.
   * Filters are AND-combined.
   */
  readonly query: (
    filter: QueryFilter,
  ) => Effect.Effect<QueryResult, QuestionnaireStoreErrors>

  // ─── Mutation ────────────────────────────────────────────────────────

  /**
   * Update an existing result in-place via an updater function.
   * Loads existing, applies updater, writes back to the same key.
   * Returns the updated result.
   */
  readonly updateResult: (
    specId: string,
    resultId: string,
    updater: (existing: PersistedResult) => PersistedResult,
  ) => Effect.Effect<PersistedResult, QuestionnaireStoreErrors>

  // ─── Health ────────────────────────────────────────────────────────────

  /**
   * Check if the store is operational.
   */
  readonly isReady: () => Effect.Effect<boolean, never>
}

// =============================================================================
// Service Tag
// =============================================================================

export class QuestionnaireStore extends Context.Tag('questionnaire/QuestionnaireStore')<
  QuestionnaireStore,
  QuestionnaireStoreShape
>() {}

// =============================================================================
// Live Implementation
// =============================================================================

export const QuestionnaireStoreLive = Layer.effect(
  QuestionnaireStore,
  Effect.gen(function* () {
    const bucket = yield* BucketStore

    // ─── Spec Library ────────────────────────────────────────────────────

    const saveSpec: QuestionnaireStoreShape['saveSpec'] = (spec, tags) =>
      Effect.gen(function* () {
        const specId = spec.id
        const now = new Date().toISOString()

        // Get current pointer to determine next version
        const pointer = yield* bucket.get(specLatestKey(specId), SpecPointer)
        const nextVersion = pointer ? pointer.currentVersion + 1 : 1

        // Build the persisted spec
        const persisted = new PersistedSpec({
          specId: specId as SpecId,
          version: nextVersion as unknown as SpecVersion,
          savedAt: now,
          tags: [...(tags ?? spec.tags ?? [])],
          spec: Schema.encodeSync(QuestionnaireSchema)(spec),
        })

        // Save versioned snapshot
        yield* bucket.put(
          specVersionKey(specId, nextVersion),
          persisted,
          PersistedSpec,
        )

        // Update latest pointer
        yield* bucket.put(
          specLatestKey(specId),
          new SpecPointer({
            specId: specId as SpecId,
            currentVersion: nextVersion as unknown as SpecVersion,
            updatedAt: now,
          }),
          SpecPointer,
        )

        return persisted
      }).pipe(
        Effect.mapError(wrapError(`Failed to save spec '${spec.id}'`, { operation: 'saveSpec', specId: spec.id })),
        Effect.withSpan('QuestionnaireStore.saveSpec', { attributes: { specId: spec.id } }),
      )

    const getSpec: QuestionnaireStoreShape['getSpec'] = (specId, version) =>
      Effect.gen(function* () {
        if (version !== undefined) {
          return yield* bucket.get(specVersionKey(specId, version), PersistedSpec)
        }
        // Get latest pointer first
        const pointer = yield* bucket.get(specLatestKey(specId), SpecPointer)
        if (!pointer) return null
        return yield* bucket.get(
          specVersionKey(specId, pointer.currentVersion),
          PersistedSpec,
        )
      }).pipe(
        Effect.mapError(wrapError(`Failed to get spec '${specId}'`, { operation: 'getSpec', specId })),
        Effect.withSpan('QuestionnaireStore.getSpec', { attributes: { specId } }),
      )

    const requireSpec: QuestionnaireStoreShape['requireSpec'] = (specId) =>
      Effect.gen(function* () {
        const spec = yield* getSpec(specId)
        if (!spec) {
          return yield* Effect.fail(new SpecNotFoundError({ specId }))
        }
        return spec
      }).pipe(Effect.withSpan('QuestionnaireStore.requireSpec', { attributes: { specId } }))

    const listSpecs: QuestionnaireStoreShape['listSpecs'] = () =>
      Effect.gen(function* () {
        // List all latest.json pointers
        const objects = yield* bucket.listAll(specListPrefix())
        const pointerObjects = objects.filter((o) => o.key.endsWith('/latest.json'))

        const specs: SpecSummary[] = []

        for (const obj of pointerObjects) {
          const pointer = yield* bucket.get(obj.key, SpecPointer)
          if (!pointer) continue

          const latestSpec = yield* bucket.get(
            specVersionKey(pointer.specId, pointer.currentVersion),
            PersistedSpec,
          )
          if (!latestSpec) continue

          // Count results for this spec
          const resultObjects = yield* bucket.listAll(resultListPrefix(pointer.specId))

          // Extract title/description from spec body
          const specBody = latestSpec.spec as any

          specs.push(new SpecSummary({
            specId: pointer.specId,
            title: specBody?.title ?? pointer.specId,
            description: specBody?.description,
            currentVersion: pointer.currentVersion,
            tags: latestSpec.tags,
            resultCount: resultObjects.length,
            createdAt: latestSpec.savedAt, // Could traverse to v1 for true createdAt
            updatedAt: pointer.updatedAt,
          }))
        }

        return new SpecCatalog({ specs, total: specs.length })
      }).pipe(
        Effect.mapError(wrapError('Failed to list specs', { operation: 'listSpecs' })),
        Effect.withSpan('QuestionnaireStore.listSpecs'),
      )

    const deleteSpec: QuestionnaireStoreShape['deleteSpec'] = (specId) =>
      Effect.gen(function* () {
        // Delete all versions
        const allKeys = yield* bucket.listAll(specListPrefix() + specId + '/')
        for (const obj of allKeys) {
          yield* bucket.del(obj.key)
        }
        // Delete all results
        const resultKeys = yield* bucket.listAll(resultListPrefix(specId))
        for (const obj of resultKeys) {
          yield* bucket.del(obj.key)
        }
      }).pipe(
        Effect.mapError(wrapError(`Failed to delete spec '${specId}'`, { operation: 'deleteSpec', specId })),
        Effect.withSpan('QuestionnaireStore.deleteSpec', { attributes: { specId } }),
      )

    // ─── Result Archive ──────────────────────────────────────────────────

    const saveResult: QuestionnaireStoreShape['saveResult'] = (spec, result, specVersion, embedding) =>
      Effect.gen(function* () {
        const resultId = nanoid()
        const now = result.completedAt ?? new Date().toISOString()
        const specId = spec.id

        // Build flattened answer index for query
        const answerIndex: Record<string, string> = {}
        for (const answer of result.answers) {
          answerIndex[answer.questionId] = answer.value
        }

        // Build rich answer index with full question prompts
        const richAnswerIndex: Record<string, RichAnswerEntry> = {}
        for (const answer of result.answers) {
          const question = spec.questionMap.get(answer.questionId)
          richAnswerIndex[answer.questionId] = new RichAnswerEntry({
            prompt: question?.prompt ?? answer.questionId,
            value: answer.value,
            label: answer.label,
            ...(answer.wasCustom ? { wasCustom: answer.wasCustom } : {}),
            ...(answer.note ? { note: answer.note } : {}),
          })
        }

        // Build persisted result
        const persisted = new PersistedResult({
          resultId: resultId as ResultId,
          specId: specId as SpecId,
          specVersion: specVersion as unknown as SpecVersion,
          completedAt: now,
          cancelled: result.cancelled,
          tags: [...(result.tags ?? spec.tags ?? [])],
          result: Schema.encodeSync(QuestionnaireResultSchema)(result),
          answerIndex,
          richAnswerIndex,
          ...(embedding ? { embedding: [...embedding] } : {}),
        })

        // Save the result
        yield* bucket.put(
          resultKey(specId, resultId),
          persisted,
          PersistedResult,
        )

        // Update tag indexes
        const allTags = persisted.tags
        for (const tag of allTags) {
          yield* updateTagIndex(tag, resultId, 'add')
        }

        // Update date index
        const dateStr = isoToDate(now)
        yield* updateDateIndex(dateStr, resultId, 'add')

        return persisted
      }).pipe(
        Effect.mapError(wrapError(`Failed to save result for '${spec.id}'`, { operation: 'saveResult', specId: spec.id })),
        Effect.withSpan('QuestionnaireStore.saveResult', { attributes: { specId: spec.id } }),
      )

    const getResult: QuestionnaireStoreShape['getResult'] = (specId, resultId) =>
      bucket.get(resultKey(specId, resultId), PersistedResult).pipe(
        Effect.mapError((err) =>
          new QuestionnaireStoreError({
            message: `Failed to get result '${resultId}': ${err instanceof Error ? err.message : String(err)}`,
            operation: 'getResult',
            specId,
            resultId,
            cause: err,
          }),
        ),
        Effect.withSpan('QuestionnaireStore.getResult', { attributes: { specId, resultId } }),
      )

    const listResults: QuestionnaireStoreShape['listResults'] = (specId) =>
      Effect.gen(function* () {
        const objects = yield* bucket.listAll(resultListPrefix(specId))
        const results: PersistedResult[] = []
        for (const obj of objects) {
          const result = yield* bucket.get(obj.key, PersistedResult)
          if (result) results.push(result)
        }
        // Sort by completedAt descending (newest first)
        return results.sort((a, b) => b.completedAt.localeCompare(a.completedAt))
      }).pipe(
        Effect.mapError(wrapError(`Failed to list results for '${specId}'`, { operation: 'listResults', specId })),
        Effect.withSpan('QuestionnaireStore.listResults', { attributes: { specId } }),
      )

    const deleteResult: QuestionnaireStoreShape['deleteResult'] = (specId, resultId) =>
      Effect.gen(function* () {
        // Load the result first to clean up indexes
        const existing = yield* bucket.get(resultKey(specId, resultId), PersistedResult)
        if (existing) {
          // Clean tag indexes
          for (const tag of existing.tags) {
            yield* updateTagIndex(tag, resultId, 'remove')
          }
          // Clean date index
          const dateStr = isoToDate(existing.completedAt)
          yield* updateDateIndex(dateStr, resultId, 'remove')
        }
        yield* bucket.del(resultKey(specId, resultId))
      }).pipe(
        Effect.mapError(wrapError(`Failed to delete result '${resultId}'`, { operation: 'deleteResult', resultId })),
        Effect.withSpan('QuestionnaireStore.deleteResult', { attributes: { specId, resultId } }),
      )

    // ─── Query Engine ────────────────────────────────────────────────────

    const query: QuestionnaireStoreShape['query'] = (filter) =>
      Effect.gen(function* () {
        // Step 1: Gather candidate results
        let candidates: PersistedResult[]

        if (filter.specId) {
          // Scoped to one spec
          const results = yield* listResults(filter.specId)
          candidates = [...results]
        } else {
          // All results across all specs — list everything under results/
          const allObjects = yield* bucket.listAll('results/')
          candidates = []
          for (const obj of allObjects) {
            const result = yield* bucket.get(obj.key, PersistedResult)
            if (result) candidates.push(result)
          }
        }

        // Step 2: Apply filters

        // Status filter
        if (filter.status && filter.status !== 'all') {
          const wantCancelled = filter.status === 'cancelled'
          candidates = candidates.filter((r) => r.cancelled === wantCancelled)
        }

        // Date range filter
        if (filter.dateFrom) {
          candidates = candidates.filter((r) => r.completedAt >= filter.dateFrom!)
        }
        if (filter.dateTo) {
          candidates = candidates.filter((r) => r.completedAt <= filter.dateTo!)
        }

        // Tag filter (AND logic — all specified tags must be present)
        if (filter.tags && filter.tags.length > 0) {
          const requiredTags = new Set(filter.tags)
          candidates = candidates.filter((r) => {
            const resultTags = new Set(r.tags)
            for (const tag of requiredTags) {
              if (!resultTags.has(tag)) return false
            }
            return true
          })
        }

        // Answer content filter — { questionId: valuePattern }
        if (filter.answerMatch) {
          const matchEntries = Object.entries(filter.answerMatch)
          candidates = candidates.filter((r) => {
            for (const [qId, pattern] of matchEntries) {
              const answerValue = r.answerIndex[qId]
              if (!answerValue) return false
              // Case-insensitive substring match
              if (!answerValue.toLowerCase().includes(pattern.toLowerCase())) return false
            }
            return true
          })
        }

        // Full-text search — search across all answer values and the result body
        if (filter.fullText) {
          const needle = filter.fullText.toLowerCase()
          candidates = candidates.filter((r) => {
            // Search answer index values
            const answerText = Object.values(r.answerIndex).join(' ').toLowerCase()
            if (answerText.includes(needle)) return true

            // Search the full result body as stringified JSON
            const bodyText = JSON.stringify(r.result).toLowerCase()
            if (bodyText.includes(needle)) return true

            // Search tags
            const tagText = r.tags.join(' ').toLowerCase()
            if (tagText.includes(needle)) return true

            return false
          })
        }

        // Step 3: Sort (newest first)
        candidates.sort((a, b) => b.completedAt.localeCompare(a.completedAt))

        // Step 4: Paginate
        const total = candidates.length
        const offset = filter.offset ?? 0
        const limit = filter.limit ?? 50
        const paged = candidates.slice(offset, offset + limit)

        return new QueryResult({
          results: paged,
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        })
      }).pipe(
        Effect.mapError(wrapError('Query failed', { operation: 'query' })),
        Effect.withSpan('QuestionnaireStore.query'),
      )

    // ─── Index Maintenance (internal) ────────────────────────────────────

    const updateTagIndex = (
      tag: string,
      resultId: string,
      op: 'add' | 'remove',
    ): Effect.Effect<void, BucketError> =>
      Effect.gen(function* () {
        const key = tagIndexKey(tag)
        const existing = yield* bucket.get(key, TagIndex)
        const ids = existing ? [...existing.resultIds] : []

        if (op === 'add') {
          if (!ids.includes(resultId)) ids.push(resultId)
        } else {
          const idx = ids.indexOf(resultId)
          if (idx >= 0) ids.splice(idx, 1)
        }

        if (ids.length === 0) {
          yield* bucket.del(key)
        } else {
          yield* bucket.put(key, new TagIndex({
            tag,
            resultIds: ids,
            updatedAt: new Date().toISOString(),
          }), TagIndex)
        }
      })

    const updateDateIndex = (
      date: string,
      resultId: string,
      op: 'add' | 'remove',
    ): Effect.Effect<void, BucketError> =>
      Effect.gen(function* () {
        const key = dateIndexKey(date)
        const existing = yield* bucket.get(key, DateIndex)
        const ids = existing ? [...existing.resultIds] : []

        if (op === 'add') {
          if (!ids.includes(resultId)) ids.push(resultId)
        } else {
          const idx = ids.indexOf(resultId)
          if (idx >= 0) ids.splice(idx, 1)
        }

        if (ids.length === 0) {
          yield* bucket.del(key)
        } else {
          yield* bucket.put(key, new DateIndex({
            date,
            resultIds: ids,
            updatedAt: new Date().toISOString(),
          }), DateIndex)
        }
      })

    // ─── Mutation ─────────────────────────────────────────────────────────

    const updateResult: QuestionnaireStoreShape['updateResult'] = (specId, resultId, updater) =>
      Effect.gen(function* () {
        const existing = yield* getResult(specId, resultId)
        if (!existing) {
          return yield* Effect.fail(new ResultNotFoundError({ resultId, specId }))
        }
        const updated = updater(existing)
        yield* bucket.put(
          resultKey(specId, resultId),
          updated,
          PersistedResult,
        )
        return updated
      }).pipe(
        Effect.mapError(wrapError(`Failed to update result '${resultId}'`, { operation: 'saveResult', specId, resultId })),
        Effect.withSpan('QuestionnaireStore.updateResult', { attributes: { specId, resultId } }),
      )

    // ─── Health ──────────────────────────────────────────────────────────

    const isReady: QuestionnaireStoreShape['isReady'] = () =>
      bucket.isReady()

    return {
      saveSpec,
      getSpec,
      requireSpec,
      listSpecs,
      deleteSpec,
      saveResult,
      getResult,
      listResults,
      deleteResult,
      updateResult,
      query,
      isReady,
    } satisfies QuestionnaireStoreShape
  }),
)

// =============================================================================
// Convenience Layers
// =============================================================================

/** Full QuestionnaireStore with MinIO BucketStore */
export const QuestionnaireStoreMinIO = QuestionnaireStoreLive
// Consumers must also provide BucketStore + BucketStoreConfig layers

/** QuestionnaireStore with in-memory BucketStore (for tests) */
export { InMemoryBucketStoreLive as BucketStoreTest } from './BucketStore.ts'
