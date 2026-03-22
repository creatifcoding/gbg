/**
 * GeniferService — Common entry point for all genifer persistence operations
 *
 * Wraps repos + persistence pipeline into a single Effect.Service.
 * All operations are typed, traced (Effect.withSpan), and error-mapped
 * to GeniferQueryError / GeniferTreeNotFoundError etc.
 *
 * Architecture mirrors iiot/services/l3/IIoTService.ts:
 * - Single service aggregating domain operations
 * - Typed error channel per operation
 * - Layer composition via dependencies
 *
 * @module
 */

import { Effect, Option } from 'effect'
import { UITree, UIElement } from '../core/schemas'
import type { GeniferTreeId, GeniferCompositeId, SignalTargetType, SignalType } from '../models/_common'
import type { GeniferTreeModel } from '../models/GeniferTreeModel'
import type { GeniferElementModel } from '../models/GeniferElementModel'
import type { GeniferCompositeModel } from '../models/GeniferCompositeModel'
import type { GeniferSignalModel } from '../models/GeniferSignalModel'
import {
  GeniferTreeRepo,
} from '../repos/GeniferTreeRepo'
import {
  GeniferElementRepo,
} from '../repos/GeniferElementRepo'
import {
  GeniferCompositeRepo,
} from '../repos/GeniferCompositeRepo'
import {
  GeniferSignalRepo,
} from '../repos/GeniferSignalRepo'
import {
  GeniferPersistence,
  type SaveTreeInput,
  type SaveTreeResult,
  type LoadTreeResult,
} from '../repos/persistence'
import {
  GeniferQueryError,
  GeniferTreeNotFoundError,
  GeniferCompositeNotFoundError,
  GeniferInvalidRatingError,
  GeniferPersistenceError,
} from './errors'

// =============================================================================
// Result Types (for RPC success schemas)
// =============================================================================

export interface TreeSummary {
  readonly id: GeniferTreeId
  readonly prompt: string
  readonly rootKey: string
  readonly model: string | null
  readonly qualityScore: number
  readonly elementCount: number
  readonly repairCount: number
  readonly humanRating: number | null
  readonly usageCount: number
  readonly createdAt: Date
}

// =============================================================================
// Service Definition
// =============================================================================

export class GeniferService extends Effect.Service<GeniferService>()('genifer/GeniferService', {
  effect: Effect.gen(function* () {
    const treeRepo = yield* GeniferTreeRepo
    const elementRepo = yield* GeniferElementRepo
    const compositeRepo = yield* GeniferCompositeRepo
    const signalRepo = yield* GeniferSignalRepo
    const persistence = yield* GeniferPersistence

    // =========================================================================
    // Tree Operations
    // =========================================================================

    /**
     * Save a UITree to PostgreSQL (tree + elements + auto signal).
     */
    const saveTree = (input: SaveTreeInput): Effect.Effect<
      SaveTreeResult,
      GeniferPersistenceError
    > =>
      persistence.saveTree(input).pipe(
        Effect.mapError((e) => new GeniferPersistenceError({
          operation: 'saveTree',
          message: String(e),
        })),
        Effect.withSpan('GeniferService.saveTree', {
          attributes: { prompt: input.prompt, elementCount: input.tree.size },
        }),
      )

    /**
     * Load a UITree from PostgreSQL by tree ID.
     */
    const loadTree = (treeId: GeniferTreeId): Effect.Effect<
      LoadTreeResult,
      GeniferTreeNotFoundError | GeniferPersistenceError
    > =>
      persistence.loadTree(treeId).pipe(
        Effect.flatMap((opt) =>
          Option.match(opt, {
            onNone: () => Effect.fail(new GeniferTreeNotFoundError({ treeId })),
            onSome: Effect.succeed,
          })
        ),
        Effect.mapError((e) => {
          if (e instanceof GeniferTreeNotFoundError) return e
          return new GeniferPersistenceError({
            operation: 'loadTree',
            message: String(e),
          })
        }),
        Effect.withSpan('GeniferService.loadTree', { attributes: { treeId } }),
      )

    /**
     * List recent trees (newest first).
     */
    const listRecentTrees = (limit = 50): Effect.Effect<
      readonly TreeSummary[],
      GeniferQueryError
    > =>
      treeRepo.findRecent(limit).pipe(
        Effect.map((rows) => rows.map(toTreeSummary)),
        Effect.mapError((e) => new GeniferQueryError({
          operation: 'listRecentTrees',
          message: String(e),
        })),
        Effect.withSpan('GeniferService.listRecentTrees'),
      )

    /**
     * List trees by minimum quality score.
     */
    const listTreesByQuality = (minScore: number, limit = 50): Effect.Effect<
      readonly TreeSummary[],
      GeniferQueryError
    > =>
      treeRepo.findByQuality(minScore, limit).pipe(
        Effect.map((rows) => rows.map(toTreeSummary)),
        Effect.mapError((e) => new GeniferQueryError({
          operation: 'listTreesByQuality',
          message: String(e),
        })),
        Effect.withSpan('GeniferService.listTreesByQuality'),
      )

    /**
     * List trees in a conversation thread (oldest first).
     */
    const listTreesByThread = (threadId: string): Effect.Effect<
      readonly TreeSummary[],
      GeniferQueryError
    > =>
      treeRepo.findByThread(threadId).pipe(
        Effect.map((rows) => rows.map(toTreeSummary)),
        Effect.mapError((e) => new GeniferQueryError({
          operation: 'listTreesByThread',
          message: String(e),
        })),
        Effect.withSpan('GeniferService.listTreesByThread'),
      )

    /**
     * Rate a tree (human rating 1-5).
     */
    const rateTree = (treeId: GeniferTreeId, rating: number): Effect.Effect<
      void,
      GeniferInvalidRatingError | GeniferQueryError
    > => {
      if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
        return Effect.fail(new GeniferInvalidRatingError({
          value: rating,
          message: 'Rating must be an integer between 1 and 5',
        }))
      }

      return treeRepo.updateRating(treeId, rating).pipe(
        Effect.flatMap((row) =>
          signalRepo.emit({
            targetType: 'tree',
            targetId: treeId,
            signalType: 'human_rating',
            value: rating,
          })
        ),
        Effect.mapError((e) => new GeniferQueryError({
          operation: 'rateTree',
          message: String(e),
        })),
        Effect.withSpan('GeniferService.rateTree'),
      )
    }

    /**
     * Delete a tree and all its elements (CASCADE).
     */
    const deleteTree = (treeId: GeniferTreeId): Effect.Effect<
      void,
      GeniferQueryError
    > =>
      treeRepo.delete(treeId).pipe(
        Effect.mapError((e) => new GeniferQueryError({
          operation: 'deleteTree',
          message: String(e),
        })),
        Effect.withSpan('GeniferService.deleteTree'),
      )

    // =========================================================================
    // Element Operations
    // =========================================================================

    /**
     * List all elements for a tree.
     */
    const listElementsByTree = (treeId: GeniferTreeId): Effect.Effect<
      readonly GeniferElementModel[],
      GeniferQueryError
    > =>
      elementRepo.findByTree(treeId).pipe(
        Effect.mapError((e) => new GeniferQueryError({
          operation: 'listElementsByTree',
          message: String(e),
        })),
        Effect.withSpan('GeniferService.listElementsByTree'),
      )

    /**
     * Get subtree rooted at element_key (recursive CTE).
     */
    const getSubtree = (treeId: GeniferTreeId, rootKey: string): Effect.Effect<
      readonly GeniferElementModel[],
      GeniferQueryError
    > =>
      elementRepo.findSubtree(treeId, rootKey).pipe(
        Effect.mapError((e) => new GeniferQueryError({
          operation: 'getSubtree',
          message: String(e),
        })),
        Effect.withSpan('GeniferService.getSubtree'),
      )

    // =========================================================================
    // Composite Operations
    // =========================================================================

    /**
     * Upsert a composite (ON CONFLICT name → update).
     */
    const upsertComposite = (composite: typeof GeniferCompositeModel.insert.Type): Effect.Effect<
      GeniferCompositeModel,
      GeniferQueryError
    > =>
      compositeRepo.upsert(composite).pipe(
        Effect.mapError((e) => new GeniferQueryError({
          operation: 'upsertComposite',
          message: String(e),
        })),
        Effect.withSpan('GeniferService.upsertComposite'),
      )

    /**
     * Get composite by name.
     */
    const getComposite = (name: string): Effect.Effect<
      GeniferCompositeModel,
      GeniferCompositeNotFoundError | GeniferQueryError
    > =>
      compositeRepo.findByName(name).pipe(
        Effect.flatMap((opt) =>
          Option.match(opt, {
            onNone: () => Effect.fail(new GeniferCompositeNotFoundError({ compositeId: name })),
            onSome: Effect.succeed,
          })
        ),
        Effect.mapError((e) => {
          if (e instanceof GeniferCompositeNotFoundError) return e
          return new GeniferQueryError({
            operation: 'getComposite',
            message: String(e),
          })
        }),
        Effect.withSpan('GeniferService.getComposite'),
      )

    /**
     * List all composites (newest first).
     */
    const listComposites = (limit = 100): Effect.Effect<
      readonly GeniferCompositeModel[],
      GeniferQueryError
    > =>
      compositeRepo.findAll(limit).pipe(
        Effect.mapError((e) => new GeniferQueryError({
          operation: 'listComposites',
          message: String(e),
        })),
        Effect.withSpan('GeniferService.listComposites'),
      )

    /**
     * Top-ranked composites (materialized view).
     */
    const topRankedComposites = (limit = 20): Effect.Effect<
      readonly GeniferCompositeModel[],
      GeniferQueryError
    > =>
      compositeRepo.findTopRanked(limit).pipe(
        Effect.mapError((e) => new GeniferQueryError({
          operation: 'topRankedComposites',
          message: String(e),
        })),
        Effect.withSpan('GeniferService.topRankedComposites'),
      )

    /**
     * Rate a composite (human rating 1-5).
     */
    const rateComposite = (id: GeniferCompositeId, rating: number): Effect.Effect<
      void,
      GeniferInvalidRatingError | GeniferQueryError
    > => {
      if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
        return Effect.fail(new GeniferInvalidRatingError({
          value: rating,
          message: 'Rating must be an integer between 1 and 5',
        }))
      }

      return compositeRepo.updateRating(id, rating).pipe(
        Effect.flatMap(() =>
          signalRepo.emit({
            targetType: 'composite',
            targetId: id,
            signalType: 'human_rating',
            value: rating,
          })
        ),
        Effect.mapError((e) => new GeniferQueryError({
          operation: 'rateComposite',
          message: String(e),
        })),
        Effect.withSpan('GeniferService.rateComposite'),
      )
    }

    /**
     * Refresh composite rankings materialized view.
     */
    const refreshCompositeRankings = (): Effect.Effect<void, GeniferQueryError> =>
      compositeRepo.refreshRankings().pipe(
        Effect.mapError((e) => new GeniferQueryError({
          operation: 'refreshCompositeRankings',
          message: String(e),
        })),
        Effect.withSpan('GeniferService.refreshCompositeRankings'),
      )

    /**
     * Delete a composite.
     */
    const deleteComposite = (id: GeniferCompositeId): Effect.Effect<void, GeniferQueryError> =>
      compositeRepo.delete(id).pipe(
        Effect.mapError((e) => new GeniferQueryError({
          operation: 'deleteComposite',
          message: String(e),
        })),
        Effect.withSpan('GeniferService.deleteComposite'),
      )

    // =========================================================================
    // Signal Operations
    // =========================================================================

    /**
     * Emit a quality signal.
     */
    const emitSignal = (signal: {
      targetType: SignalTargetType
      targetId: string
      signalType: SignalType
      value: number
      metadata?: unknown
    }): Effect.Effect<void, GeniferQueryError> =>
      signalRepo.emit(signal).pipe(
        Effect.mapError((e) => new GeniferQueryError({
          operation: 'emitSignal',
          message: String(e),
        })),
        Effect.withSpan('GeniferService.emitSignal'),
      )

    /**
     * Get signals for a target.
     */
    const listSignalsByTarget = (
      targetType: SignalTargetType,
      targetId: string,
    ): Effect.Effect<readonly GeniferSignalModel[], GeniferQueryError> =>
      signalRepo.findByTarget(targetType, targetId).pipe(
        Effect.mapError((e) => new GeniferQueryError({
          operation: 'listSignalsByTarget',
          message: String(e),
        })),
        Effect.withSpan('GeniferService.listSignalsByTarget'),
      )

    /**
     * Get recent signals of a type.
     */
    const listSignalsByType = (
      signalType: SignalType,
      limit = 100,
    ): Effect.Effect<readonly GeniferSignalModel[], GeniferQueryError> =>
      signalRepo.findByType(signalType, limit).pipe(
        Effect.mapError((e) => new GeniferQueryError({
          operation: 'listSignalsByType',
          message: String(e),
        })),
        Effect.withSpan('GeniferService.listSignalsByType'),
      )

    // =========================================================================
    // Return service shape
    // =========================================================================

    return {
      // Tree
      saveTree,
      loadTree,
      listRecentTrees,
      listTreesByQuality,
      listTreesByThread,
      rateTree,
      deleteTree,
      // Elements
      listElementsByTree,
      getSubtree,
      // Composites
      upsertComposite,
      getComposite,
      listComposites,
      topRankedComposites,
      rateComposite,
      refreshCompositeRankings,
      deleteComposite,
      // Signals
      emitSignal,
      listSignalsByTarget,
      listSignalsByType,
    }
  }),
}) {}

// =============================================================================
// Helpers
// =============================================================================

// =============================================================================
// Layer Composition
// =============================================================================

import { Layer } from 'effect'
import {
  GeniferTreeRepoLive,
  GeniferElementRepoLive,
  GeniferCompositeRepoLive,
  GeniferSignalRepoLive,
  GeniferPersistenceLive,
  GeniferRepositoriesLive,
} from '../repos'

/**
 * GeniferService layer backed by SQL repos.
 *
 * Requires: SqlClient.SqlClient
 */
export const GeniferServiceLive = GeniferService.Default.pipe(
  Layer.provide(GeniferPersistenceLive),
  Layer.provide(GeniferRepositoriesLive),
)

// =============================================================================
// Helpers
// =============================================================================

function toTreeSummary(row: GeniferTreeModel): TreeSummary {
  return {
    id: row.id,
    prompt: row.prompt,
    rootKey: row.rootKey,
    model: Option.getOrNull(row.model),
    qualityScore: row.qualityScore,
    elementCount: row.elementCount,
    repairCount: row.repairCount,
    humanRating: Option.getOrNull(row.humanRating),
    usageCount: row.usageCount ?? 0,
    createdAt: row.createdAt as any as Date,
  }
}
