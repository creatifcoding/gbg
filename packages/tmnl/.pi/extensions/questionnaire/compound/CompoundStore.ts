/**
 * CompoundStore — domain-specific persistence for compound specs + run archive.
 *
 * Manages compound spec library (versioned, same pattern as QuestionnaireStore)
 * and compound run records (queryable with topology-aware filters).
 *
 * Context.Tag pattern — depends on BucketStore (which is DI-swappable).
 *
 * @module questionnaire/compound/CompoundStore
 */

import { Effect, Context, Layer, Schema } from 'effect'
import { BucketStore } from '../persistence/BucketStore.ts'
import {
  CompoundSpec,
  CompoundRun,
  PersistedCompoundSpec,
  CompoundQueryFilter,
  CompoundSpecError,
  CompoundRunError,
  type CompoundSpecId,
  compoundSpecVersionKey,
  compoundSpecLatestKey,
  compoundRunKey,
  compoundRunListPrefix,
} from './schemas.ts'

// =============================================================================
// Inline SpecPointer for compound specs (mirrors persistence/schemas.ts pattern)
// =============================================================================

const CompoundSpecPointer = Schema.Struct({
  specId: Schema.String,
  currentVersion: Schema.Number,
  updatedAt: Schema.String,
})

// =============================================================================
// Error wrapping helpers — same pattern as QuestionnaireStore
// =============================================================================

const wrapSpecError = (message: string, specId?: string) => (err: unknown) =>
  new CompoundSpecError({
    message: `${message}: ${err instanceof Error ? err.message : String(err)}`,
    specId,
    cause: err,
  })

const wrapRunError = (message: string, runId?: string, specId?: string) => (err: unknown) =>
  new CompoundRunError({
    message: `${message}: ${err instanceof Error ? err.message : String(err)}`,
    runId,
    specId,
    cause: err,
  })

// =============================================================================
// Service Shape
// =============================================================================

export interface CompoundStoreShape {
  // ─── Compound Spec Library ───────────────────────────────────────────

  /** Save a compound spec. Auto-versions like QuestionnaireStore.saveSpec */
  readonly saveCompoundSpec: (
    spec: CompoundSpec,
  ) => Effect.Effect<PersistedCompoundSpec, CompoundSpecError>

  /** Get a compound spec by ID (latest version) or specific version */
  readonly getCompoundSpec: (
    specId: string,
    version?: number,
  ) => Effect.Effect<PersistedCompoundSpec | null, CompoundSpecError>

  /** List all compound specs */
  readonly listCompoundSpecs: () => Effect.Effect<ReadonlyArray<PersistedCompoundSpec>, CompoundSpecError>

  // ─── Compound Run Archive ────────────────────────────────────────────

  /** Save a compound run record */
  readonly saveCompoundRun: (
    run: CompoundRun,
  ) => Effect.Effect<void, CompoundRunError>

  /** Get a compound run by specId + runId */
  readonly getCompoundRun: (
    specId: string,
    runId: string,
  ) => Effect.Effect<CompoundRun | null, CompoundRunError>

  /** List all runs for a compound spec */
  readonly listCompoundRuns: (
    specId: string,
  ) => Effect.Effect<ReadonlyArray<CompoundRun>, CompoundRunError>

  /** Query compound runs with topology-aware filters */
  readonly queryCompoundRuns: (
    filter: CompoundQueryFilter,
  ) => Effect.Effect<ReadonlyArray<CompoundRun>, CompoundRunError>
}

// =============================================================================
// Service Tag
// =============================================================================

export class CompoundStore extends Context.Tag('compound/CompoundStore')<
  CompoundStore,
  CompoundStoreShape
>() {}

// =============================================================================
// Live Implementation
// =============================================================================

export const CompoundStoreLive = Layer.effect(
  CompoundStore,
  Effect.gen(function* () {
    const bucket = yield* BucketStore

    // ─── Compound Spec Library ──────────────────────────────────────────

    const saveCompoundSpec: CompoundStoreShape['saveCompoundSpec'] = (spec) =>
      Effect.gen(function* () {
        const specId = spec.id as string
        const now = new Date().toISOString()

        // Get current pointer to determine next version
        const pointer = yield* bucket.get(compoundSpecLatestKey(specId), CompoundSpecPointer)
        const nextVersion = pointer ? pointer.currentVersion + 1 : 1

        // Build the persisted spec
        const persisted = new PersistedCompoundSpec({
          specId: spec.id,
          version: nextVersion,
          savedAt: now,
          tags: [...spec.tags],
          spec: Schema.encodeSync(CompoundSpec)(spec),
        })

        // Save versioned snapshot
        yield* bucket.put(
          compoundSpecVersionKey(specId, nextVersion),
          persisted,
          PersistedCompoundSpec,
        )

        // Update latest pointer
        yield* bucket.put(
          compoundSpecLatestKey(specId),
          { specId, currentVersion: nextVersion, updatedAt: now },
          CompoundSpecPointer,
        )

        return persisted
      }).pipe(
        Effect.mapError(wrapSpecError(`Failed to save compound spec '${spec.id as string}'`, spec.id as string)),
        Effect.withSpan('CompoundStore.saveCompoundSpec', { attributes: { specId: spec.id as string } }),
      )

    const getCompoundSpec: CompoundStoreShape['getCompoundSpec'] = (specId, version) =>
      Effect.gen(function* () {
        if (version !== undefined) {
          return yield* bucket.get(compoundSpecVersionKey(specId, version), PersistedCompoundSpec)
        }
        // Get latest pointer first
        const pointer = yield* bucket.get(compoundSpecLatestKey(specId), CompoundSpecPointer)
        if (!pointer) return null
        return yield* bucket.get(
          compoundSpecVersionKey(specId, pointer.currentVersion),
          PersistedCompoundSpec,
        )
      }).pipe(
        Effect.mapError(wrapSpecError(`Failed to get compound spec '${specId}'`, specId)),
        Effect.withSpan('CompoundStore.getCompoundSpec', { attributes: { specId } }),
      )

    const listCompoundSpecs: CompoundStoreShape['listCompoundSpecs'] = () =>
      Effect.gen(function* () {
        // List all objects under compound-specs/ to find latest.json pointers
        const objects = yield* bucket.listAll('compound-specs/')
        const pointerObjects = objects.filter((o) => o.key.endsWith('/latest.json'))

        const specs: PersistedCompoundSpec[] = []

        for (const obj of pointerObjects) {
          const pointer = yield* bucket.get(obj.key, CompoundSpecPointer)
          if (!pointer) continue

          const latestSpec = yield* bucket.get(
            compoundSpecVersionKey(pointer.specId, pointer.currentVersion),
            PersistedCompoundSpec,
          )
          if (latestSpec) specs.push(latestSpec)
        }

        return specs
      }).pipe(
        Effect.mapError(wrapSpecError('Failed to list compound specs')),
        Effect.withSpan('CompoundStore.listCompoundSpecs'),
      )

    // ─── Compound Run Archive ───────────────────────────────────────────

    const saveCompoundRun: CompoundStoreShape['saveCompoundRun'] = (run) =>
      Effect.gen(function* () {
        yield* bucket.put(
          compoundRunKey(run.specId as string, run.runId as string),
          run,
          CompoundRun,
        )
      }).pipe(
        Effect.mapError(wrapRunError(`Failed to save compound run '${run.runId as string}'`, run.runId as string, run.specId as string)),
        Effect.withSpan('CompoundStore.saveCompoundRun', { attributes: { specId: run.specId as string, runId: run.runId as string } }),
      )

    const getCompoundRun: CompoundStoreShape['getCompoundRun'] = (specId, runId) =>
      Effect.gen(function* () {
        return yield* bucket.get(compoundRunKey(specId, runId), CompoundRun)
      }).pipe(
        Effect.mapError(wrapRunError(`Failed to get compound run '${runId}'`, runId, specId)),
        Effect.withSpan('CompoundStore.getCompoundRun', { attributes: { specId, runId } }),
      )

    const listCompoundRuns: CompoundStoreShape['listCompoundRuns'] = (specId) =>
      Effect.gen(function* () {
        const objects = yield* bucket.listAll(compoundRunListPrefix(specId))
        const runs: CompoundRun[] = []
        for (const obj of objects) {
          const run = yield* bucket.get(obj.key, CompoundRun)
          if (run) runs.push(run)
        }
        // Sort by startedAt descending (newest first)
        return runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      }).pipe(
        Effect.mapError(wrapRunError(`Failed to list compound runs for '${specId}'`, undefined, specId)),
        Effect.withSpan('CompoundStore.listCompoundRuns', { attributes: { specId } }),
      )

    const queryCompoundRuns: CompoundStoreShape['queryCompoundRuns'] = (filter) =>
      Effect.gen(function* () {
        // Step 1: Gather candidate runs
        let candidates: CompoundRun[]

        if (filter.specId) {
          candidates = [...(yield* listCompoundRuns(filter.specId))]
        } else {
          // All runs across all specs — list everything under compound-runs/
          const allObjects = yield* bucket.listAll('compound-runs/')
          candidates = []
          for (const obj of allObjects) {
            const run = yield* bucket.get(obj.key, CompoundRun)
            if (run) candidates.push(run)
          }
        }

        // Step 2: Apply filters

        // Status filter
        if (filter.status) {
          candidates = candidates.filter((r) => r.status === filter.status)
        }

        // Run ID filter
        if (filter.runId) {
          candidates = candidates.filter((r) => (r.runId as string) === filter.runId)
        }

        // Date range filter (on startedAt)
        if (filter.dateFrom) {
          candidates = candidates.filter((r) => r.startedAt >= filter.dateFrom!)
        }
        if (filter.dateTo) {
          candidates = candidates.filter((r) => r.startedAt <= filter.dateTo!)
        }

        // Tag filter (AND logic — all specified tags must be present)
        if (filter.tags && filter.tags.length > 0) {
          const requiredTags = new Set(filter.tags)
          candidates = candidates.filter((r) => {
            const runTags = new Set(r.tags)
            for (const tag of requiredTags) {
              if (!runTags.has(tag)) return false
            }
            return true
          })
        }

        // pathContains filter — run must have visited ALL specified nodeIds
        if (filter.pathContains && filter.pathContains.length > 0) {
          const requiredNodes = filter.pathContains
          candidates = candidates.filter((r) => {
            const pathSet = new Set(r.pathTaken.map((n) => n as string))
            return requiredNodes.every((nid) => pathSet.has(nid))
          })
        }

        // nodeFilters — per-node answer matching
        if (filter.nodeFilters) {
          const nodeFilterEntries = Object.entries(filter.nodeFilters)
          candidates = candidates.filter((run) => {
            for (const [nodeId, questionFilters] of nodeFilterEntries) {
              // Find the NodeExecution for this nodeId
              const execution = run.nodeExecutions.find((ne) => (ne.nodeId as string) === nodeId)
              if (!execution) return false

              // Check accumulated answers in accumulatorAfter
              const accRaw = execution.accumulatorAfter?.raw ?? {}
              const questionEntries = Object.entries(questionFilters)

              for (const [questionId, valuePattern] of questionEntries) {
                // Look for answer keyed as `{nodeId}/{questionId}`
                const accKey = `${nodeId}/${questionId}`
                const accValue = accRaw[accKey]
                if (accValue === undefined) return false

                // String match (case-insensitive substring)
                const valueStr = typeof accValue === 'object' && accValue !== null && 'value' in accValue
                  ? String((accValue as { value: unknown }).value)
                  : String(accValue)

                if (!valueStr.toLowerCase().includes(valuePattern.toLowerCase())) return false
              }
            }
            return true
          })
        }

        // Step 3: Sort (newest first by startedAt)
        candidates.sort((a, b) => b.startedAt.localeCompare(a.startedAt))

        // Step 4: Paginate
        const offset = filter.offset
        const limit = filter.limit
        return candidates.slice(offset, offset + limit)
      }).pipe(
        Effect.mapError(wrapRunError('Query compound runs failed', undefined, filter.specId)),
        Effect.withSpan('CompoundStore.queryCompoundRuns'),
      )

    return {
      saveCompoundSpec,
      getCompoundSpec,
      listCompoundSpecs,
      saveCompoundRun,
      getCompoundRun,
      listCompoundRuns,
      queryCompoundRuns,
    } satisfies CompoundStoreShape
  }),
)
