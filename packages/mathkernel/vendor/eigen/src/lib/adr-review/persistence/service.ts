/**
 * ADR Review Persistence Service
 *
 * Bridge between atoms and WASM SQLite persistence.
 * Provides hydration and background persist operations.
 */
import { Effect, ManagedRuntime } from 'effect'
import type { SqlError } from '@effect/sql/SqlError'
import type { ReviewStatus as AtomReviewStatus, Comment } from '../schemas/status'
import {
  ADRPersistence,
  ADRReviewPersistenceLive,
  ReviewCommentRepo,
  UnitReviewRepo,
} from './index'

// =============================================================================
// Managed Runtime (keeps scoped layer alive)
// =============================================================================

type PersistenceServices = UnitReviewRepo | ReviewCommentRepo | ADRPersistence

/**
 * Managed runtime that keeps the SQLite client alive.
 * Lazy-initialized on first access.
 */
let managedRuntime: ManagedRuntime.ManagedRuntime<PersistenceServices, SqlError> | null = null
let runtimeInitializing = false
let runtimeInitQueue: Array<() => void> = []

/**
 * Get or create the managed runtime.
 * Uses ManagedRuntime to keep scoped resources (SQLite client) alive.
 */
const getRuntime = async (): Promise<ManagedRuntime.ManagedRuntime<PersistenceServices, SqlError>> => {
  if (managedRuntime) {
    return managedRuntime
  }

  if (runtimeInitializing) {
    // Wait for initialization to complete
    return new Promise((resolve) => {
      runtimeInitQueue.push(() => resolve(managedRuntime!))
    })
  }

  runtimeInitializing = true
  Effect.runSync(Effect.logInfo('[adr-review] Starting runtime initialization...'))

  try {
    // Create managed runtime that keeps the layer alive
    managedRuntime = ManagedRuntime.make(ADRReviewPersistenceLive)

    // Initialize by running a simple effect (this builds the layer)
    await managedRuntime.runPromise(
      Effect.logInfo('[adr-review] Managed runtime initialized')
    )

    Effect.runSync(Effect.logInfo('[adr-review] Runtime initialization complete'))

    // Notify queued callers
    runtimeInitQueue.forEach((cb) => cb())
    runtimeInitQueue = []

    return managedRuntime
  } catch (err) {
    Effect.runSync(
      Effect.logError('[adr-review] Runtime initialization FAILED', Effect.succeed({ error: String(err) }))
    )
    runtimeInitializing = false
    throw err
  }
}

// =============================================================================
// Hydration
// =============================================================================

export interface HydratedState {
  unitStatuses: Map<string, AtomReviewStatus>
  unitComments: Map<string, Comment[]>
}

/**
 * Hydrate review state from SQLite for a specific ADR.
 */
export async function hydrateADR(adrId: string): Promise<HydratedState> {
  const runtime = await getRuntime()

  return runtime.runPromise(
    Effect.gen(function* () {
      const unitRepo = yield* UnitReviewRepo
      const commentRepo = yield* ReviewCommentRepo

      // Load unit reviews
      const reviews = yield* unitRepo.findByAdr(adrId)
      const unitStatuses = new Map<string, AtomReviewStatus>()
      for (const review of reviews) {
        const key = `${review.adrId}:${review.unitPath}`
        unitStatuses.set(key, review.status as AtomReviewStatus)
      }

      // Load comments
      const comments = yield* commentRepo.findByAdr(adrId)
      const unitComments = new Map<string, Comment[]>()
      for (const comment of comments) {
        const key = `${comment.adrId}:${comment.unitPath}`
        const existing = unitComments.get(key) || []
        existing.push({
          id: comment.id,
          path: comment.unitPath,
          author: comment.author,
          content: comment.content,
          timestamp: String(comment.createdAt),
          replyTo: comment.replyTo ?? undefined,
        })
        unitComments.set(key, existing)
      }

      yield* Effect.logInfo(
        `[adr-review] Hydrated ${unitStatuses.size} statuses, ${comments.length} comments for ${adrId}`
      )

      return { unitStatuses, unitComments }
    })
  )
}

/**
 * Hydrate all review state from SQLite.
 */
export async function hydrateAll(): Promise<HydratedState> {
  const runtime = await getRuntime()

  return runtime.runPromise(
    Effect.gen(function* () {
      const unitRepo = yield* UnitReviewRepo
      const commentRepo = yield* ReviewCommentRepo

      // Load all unit reviews
      const reviews = yield* unitRepo.listAll()
      const unitStatuses = new Map<string, AtomReviewStatus>()
      for (const review of reviews) {
        const key = `${review.adrId}:${review.unitPath}`
        unitStatuses.set(key, review.status as AtomReviewStatus)
      }

      // Load comments per ADR
      const adrIds = new Set(reviews.map((r) => r.adrId))
      const unitComments = new Map<string, Comment[]>()

      for (const adrId of adrIds) {
        const comments = yield* commentRepo.findByAdr(adrId)
        for (const comment of comments) {
          const key = `${comment.adrId}:${comment.unitPath}`
          const existing = unitComments.get(key) || []
          existing.push({
            id: comment.id,
            path: comment.unitPath,
            author: comment.author,
            content: comment.content,
            timestamp: String(comment.createdAt),
            replyTo: comment.replyTo ?? undefined,
          })
          unitComments.set(key, existing)
        }
      }

      yield* Effect.logInfo(
        `[adr-review] Hydrated ${unitStatuses.size} total statuses, ${unitComments.size} comment threads`
      )

      return { unitStatuses, unitComments }
    })
  )
}

// =============================================================================
// Persist Operations (Background)
// =============================================================================

/**
 * Persist unit status change and save to IndexedDB.
 */
export function persistUnitStatus(
  adrId: string,
  unitPath: string,
  status: AtomReviewStatus,
  reviewedBy?: string
): void {
  getRuntime()
    .then((runtime) => {
      runtime.runFork(
        Effect.gen(function* () {
          yield* Effect.logInfo(`[adr-review] Persisting status: ${adrId}:${unitPath} = ${status}`)

          const repo = yield* UnitReviewRepo
          yield* Effect.logInfo('[adr-review] Got UnitReviewRepo')

          const persistence = yield* ADRPersistence
          yield* Effect.logInfo('[adr-review] Got ADRPersistence')

          yield* repo.upsert(adrId, unitPath, status, reviewedBy)
          yield* Effect.logInfo('[adr-review] Upsert complete')

          yield* persistence.save
          yield* Effect.logInfo(`[adr-review] Saved to IndexedDB: ${adrId}:${unitPath} = ${status}`)
        }).pipe(
          Effect.catchAll((error) =>
            Effect.logError('[adr-review] Failed to persist status', Effect.succeed({ error: String(error) }))
          )
        )
      )
    })
    .catch((err) => {
      // Runtime initialization failed
      Effect.runSync(Effect.logError('[adr-review] Runtime failed', Effect.succeed({ error: String(err) })))
    })
}

/**
 * Persist comment and save to IndexedDB.
 */
export function persistComment(adrId: string, unitPath: string, comment: Comment): void {
  getRuntime().then((runtime) => {
    runtime.runFork(
      Effect.gen(function* () {
        const repo = yield* ReviewCommentRepo
        const persistence = yield* ADRPersistence

        // Note: createdAt is handled by the repository insert method (uses current time)
        yield* repo.insert({
          id: comment.id as any,
          adrId,
          unitPath,
          author: comment.author,
          content: comment.content,
          replyTo: comment.replyTo ?? null,
          createdAt: undefined, // Repository uses current time
        })
        yield* persistence.save
        yield* Effect.logDebug(`[adr-review] Persisted comment: ${comment.id}`)
      }).pipe(
        Effect.catchAll((error) =>
          Effect.logError(`[adr-review] Failed to persist comment: ${error}`)
        )
      )
    )
  })
}

/**
 * Delete a comment and save to IndexedDB.
 */
export function deleteComment(commentId: string): void {
  getRuntime().then((runtime) => {
    runtime.runFork(
      Effect.gen(function* () {
        const repo = yield* ReviewCommentRepo
        const persistence = yield* ADRPersistence

        yield* repo.delete(commentId)
        yield* persistence.save
        yield* Effect.logDebug(`[adr-review] Deleted comment: ${commentId}`)
      }).pipe(
        Effect.catchAll((error) =>
          Effect.logError(`[adr-review] Failed to delete comment: ${error}`)
        )
      )
    )
  })
}
