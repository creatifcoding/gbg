/**
 * GeniferHarnessService — Orchestrates genifer within the pi harness
 *
 * This is the brain. It:
 *   - Manages surfaces (create, update, remove, refine)
 *   - Drives generation via ai-adapter → pipeline → persistence
 *   - Updates all atoms (surfaces, deltas, quality, thread history)
 *   - Emits GeniferEvents for the harness event bus
 *   - Delegates queries to GeniferService repos
 *
 * @module genifer/harness/GeniferHarnessService
 */

import { Context, Effect, Layer, Schema, Option } from 'effect'
import * as Atom from '@effect-atom/atom/Atom'
import * as AtomRegistry from '@effect-atom/atom/Registry'
import { nanoid } from 'nanoid'
import type { GeniferSurface } from './surface'
import { SurfaceQuality } from './surface'
import type { GeniferEvent } from './schemas'
import {
  GeniferGenerateStartEvent,
  GeniferStreamDeltaEvent,
  GeniferGenerateCompleteEvent,
  GeniferRefineStartEvent,
  GeniferRefineCompleteEvent,
  GeniferQualityEvent,
} from './schemas'
import {
  activeGenerationAtom,
  surfaceRegistryAtom,
  streamDeltasAtom,
  qualityMetricsAtom,
  threadHistoryAtom,
  sessionTreeIdsAtom,
  type ActiveGeneration,
  type QualityMetrics,
} from './atoms'
import { GeniferService, type TreeSummary } from '../services'

// =============================================================================
// Error Type
// =============================================================================

export class GeniferHarnessError extends Schema.TaggedError<GeniferHarnessError>()(
  'GeniferHarnessError',
  {
    operation: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

// =============================================================================
// Input/Output Types
// =============================================================================

export interface GenerateOptions {
  readonly prompt: string
  readonly sessionId: string
  readonly threadId?: string
  readonly rootClassName?: string
  readonly model?: string
  readonly persist?: boolean
  /** Callback for each event (injected by ToolDefinition bridge) */
  readonly onEvent?: (event: GeniferEvent) => void
  /** Callback for streaming progress (injected by ToolDefinition bridge) */
  readonly onProgress?: (status: string, elementCount: number) => void
}

export interface GenerateResult {
  readonly surfaceId: string
  readonly treeId: string | null
  readonly elementCount: number
  readonly qualityScore: number
  readonly repairCount: number
  readonly durationMs: number
  readonly model: string
  readonly threadId: string
}

export interface RefineOptions {
  readonly surfaceId: string
  readonly instruction: string
  readonly sessionId: string
  readonly model?: string
  readonly persist?: boolean
  readonly onEvent?: (event: GeniferEvent) => void
  readonly onProgress?: (status: string, elementCount: number) => void
}

export interface RefineResult {
  readonly surfaceId: string
  readonly treeId: string | null
  readonly sourceTreeId: string
  readonly sourceSurfaceId: string
  readonly elementCount: number
  readonly qualityScore: number
  readonly repairCount: number
  readonly durationMs: number
  readonly addedElements: number
  readonly removedElements: number
  readonly modifiedElements: number
}

export type QueryOperation =
  | 'list_recent'
  | 'list_by_quality'
  | 'list_by_thread'
  | 'get_tree'
  | 'rate_tree'
  | 'list_composites'
  | 'top_composites'
  | 'rate_composite'
  | 'get_signals'

export interface QueryResult {
  readonly operation: QueryOperation
  readonly data: unknown
}

// =============================================================================
// Service Shape
// =============================================================================

export interface GeniferHarnessServiceShape {
  /**
   * Generate a new surface from a prompt.
   * Creates surface → streams deltas → normalizes → persists → emits events.
   */
  readonly generate: (opts: GenerateOptions) => Effect.Effect<GenerateResult, GeniferHarnessError>

  /**
   * Refine an existing surface with an instruction.
   * Loads tree → refines → creates new surface version → persists.
   */
  readonly refine: (opts: RefineOptions) => Effect.Effect<RefineResult, GeniferHarnessError>

  /**
   * Query persistence layer (delegates to GeniferService).
   */
  readonly query: (
    operation: QueryOperation,
    args?: Record<string, unknown>,
  ) => Effect.Effect<QueryResult, GeniferHarnessError>

  /**
   * Get a surface by ID.
   */
  readonly getSurface: (surfaceId: string) => GeniferSurface | undefined

  /**
   * Get all active surfaces.
   */
  readonly getAllSurfaces: () => ReadonlyMap<string, GeniferSurface>

  /**
   * Remove a surface from the registry.
   */
  readonly removeSurface: (surfaceId: string) => void

  /**
   * The atom registry for direct atom access.
   */
  readonly registry: AtomRegistry.Registry
}

export class GeniferHarnessServiceTag extends Context.Tag('genifer/GeniferHarnessService')<
  GeniferHarnessServiceTag,
  GeniferHarnessServiceShape
>() {}

// =============================================================================
// Live Implementation
// =============================================================================

export const GeniferHarnessServiceLive = Layer.effect(
  GeniferHarnessServiceTag,
  Effect.gen(function* () {
    const geniferService = yield* GeniferService
    const registry = AtomRegistry.make()

    let seqCounter = 0
    const nextSeq = () => ++seqCounter

    // ── Helpers: atom mutations ──

    const setActiveGeneration = (gen: ActiveGeneration | null) => {
      registry.set(activeGenerationAtom, gen)
    }

    const addSurface = (surface: GeniferSurface) => {
      const current = new Map(registry.get(surfaceRegistryAtom))
      current.set(surface.id, surface)
      registry.set(surfaceRegistryAtom, current)
    }

    const updateSurface = (surfaceId: string, update: Partial<GeniferSurface>) => {
      const current = new Map(registry.get(surfaceRegistryAtom))
      const existing = current.get(surfaceId)
      if (existing) {
        // Schema.TaggedClass instances are immutable — spread for new fields
        current.set(surfaceId, { ...existing, ...update } as GeniferSurface)
        registry.set(surfaceRegistryAtom, current)
      }
    }

    const appendDelta = (delta: GeniferStreamDeltaEvent) => {
      const current = registry.get(streamDeltasAtom)
      registry.set(streamDeltasAtom, [...current, delta])
    }

    const setQualityMetrics = (metrics: QualityMetrics) => {
      registry.set(qualityMetricsAtom, metrics)
    }

    const appendSessionTreeId = (treeId: string) => {
      const current = registry.get(sessionTreeIdsAtom)
      registry.set(sessionTreeIdsAtom, [...current, treeId])
    }

    const appendThreadHistory = (summary: TreeSummary) => {
      const current = registry.get(threadHistoryAtom)
      registry.set(threadHistoryAtom, [...current, summary])
    }

    // ── Generate ──

    const generate = (opts: GenerateOptions): Effect.Effect<GenerateResult, GeniferHarnessError> =>
      Effect.gen(function* () {
        const surfaceId = nanoid()
        const threadId = opts.threadId ?? nanoid()
        const model = opts.model ?? 'sonnet-4'
        const startTime = Date.now()

        // Reset stream deltas
        registry.set(streamDeltasAtom, [])

        // Set active generation
        setActiveGeneration({
          toolCallId: surfaceId, // will be overridden by bridge
          surfaceId,
          prompt: opts.prompt,
          instruction: null,
          status: 'streaming',
          model,
          startedAt: startTime,
          elementCount: 0,
          error: null,
        })

        // Emit start event
        const startEvent = new GeniferGenerateStartEvent({
          seq: nextSeq(),
          sessionId: opts.sessionId,
          toolCallId: surfaceId,
          surfaceId,
          prompt: opts.prompt,
          threadId,
          model,
          timestamp: startTime,
        })
        opts.onEvent?.(startEvent)

        // TODO: Wire to ai-adapter.generate() + pipeline
        // For now, this is the orchestration skeleton.
        // The actual LLM call + pipeline streaming will be wired in Phase 5
        // when ToolDefinitions bridge into this service.

        // Simulate completion for skeleton
        const durationMs = Date.now() - startTime
        const elementCount = 0
        const qualityScore = 0
        const repairCount = 0

        // Update active generation
        setActiveGeneration({
          toolCallId: surfaceId,
          surfaceId,
          prompt: opts.prompt,
          instruction: null,
          status: 'complete',
          model,
          startedAt: startTime,
          elementCount,
          error: null,
        })

        // Emit complete event
        const completeEvent = new GeniferGenerateCompleteEvent({
          seq: nextSeq(),
          sessionId: opts.sessionId,
          toolCallId: surfaceId,
          surfaceId,
          treeId: null,
          elementCount,
          qualityScore,
          repairCount,
          durationMs,
          model,
          threadId,
          error: null,
          timestamp: Date.now(),
        })
        opts.onEvent?.(completeEvent)

        // Set quality metrics
        setQualityMetrics({
          surfaceId,
          score: qualityScore,
          elementCount,
          repairCount,
          durationMs,
          model,
        })

        // Clear active generation
        setActiveGeneration(null)

        return {
          surfaceId,
          treeId: null,
          elementCount,
          qualityScore,
          repairCount,
          durationMs,
          model,
          threadId,
        }
      }).pipe(
        Effect.mapError((e) =>
          e instanceof GeniferHarnessError ? e : new GeniferHarnessError({
            operation: 'generate',
            message: String(e),
            cause: e,
          })
        ),
        Effect.withSpan('GeniferHarnessService.generate'),
      )

    // ── Refine ──

    const refine = (opts: RefineOptions): Effect.Effect<RefineResult, GeniferHarnessError> =>
      Effect.gen(function* () {
        const surface = registry.get(surfaceRegistryAtom).get(opts.surfaceId)
        if (!surface) {
          return yield* Effect.fail(new GeniferHarnessError({
            operation: 'refine',
            message: `Surface not found: '${opts.surfaceId}'`,
          }))
        }

        const newSurfaceId = nanoid()
        const model = opts.model ?? 'sonnet-4'
        const startTime = Date.now()

        // Reset stream deltas
        registry.set(streamDeltasAtom, [])

        setActiveGeneration({
          toolCallId: newSurfaceId,
          surfaceId: newSurfaceId,
          prompt: surface.prompt,
          instruction: opts.instruction,
          status: 'streaming',
          model,
          startedAt: startTime,
          elementCount: 0,
          error: null,
        })

        // Emit refine start event
        const startEvent = new GeniferRefineStartEvent({
          seq: nextSeq(),
          sessionId: opts.sessionId,
          toolCallId: newSurfaceId,
          surfaceId: newSurfaceId,
          sourceTreeId: surface.treeId ?? '',
          sourceSurfaceId: surface.id,
          instruction: opts.instruction,
          model,
          timestamp: startTime,
        })
        opts.onEvent?.(startEvent)

        // TODO: Wire to ai-adapter.refine() + pipeline
        const durationMs = Date.now() - startTime

        const completeEvent = new GeniferRefineCompleteEvent({
          seq: nextSeq(),
          sessionId: opts.sessionId,
          toolCallId: newSurfaceId,
          surfaceId: newSurfaceId,
          sourceTreeId: surface.treeId ?? '',
          sourceSurfaceId: surface.id,
          resultTreeId: null,
          elementCount: 0,
          qualityScore: 0,
          repairCount: 0,
          durationMs,
          addedElements: 0,
          removedElements: 0,
          modifiedElements: 0,
          error: null,
          timestamp: Date.now(),
        })
        opts.onEvent?.(completeEvent)

        setActiveGeneration(null)

        return {
          surfaceId: newSurfaceId,
          treeId: null,
          sourceTreeId: surface.treeId ?? '',
          sourceSurfaceId: surface.id,
          elementCount: 0,
          qualityScore: 0,
          repairCount: 0,
          durationMs,
          addedElements: 0,
          removedElements: 0,
          modifiedElements: 0,
        }
      }).pipe(
        Effect.mapError((e) =>
          e instanceof GeniferHarnessError ? e : new GeniferHarnessError({
            operation: 'refine',
            message: String(e),
            cause: e,
          })
        ),
        Effect.withSpan('GeniferHarnessService.refine'),
      )

    // ── Query ──

    const query = (
      operation: QueryOperation,
      args?: Record<string, unknown>,
    ): Effect.Effect<QueryResult, GeniferHarnessError> =>
      Effect.gen(function* () {
        const limit = typeof args?.limit === 'number' ? args.limit : 50

        switch (operation) {
          case 'list_recent': {
            const trees = yield* geniferService.listRecentTrees(limit)
            return { operation, data: trees }
          }
          case 'list_by_quality': {
            const minScore = typeof args?.minScore === 'number' ? args.minScore : 0.8
            const trees = yield* geniferService.listTreesByQuality(minScore, limit)
            return { operation, data: trees }
          }
          case 'list_by_thread': {
            const threadId = args?.threadId as string
            if (!threadId) {
              return yield* Effect.fail(new GeniferHarnessError({
                operation: 'query',
                message: 'list_by_thread requires threadId arg',
              }))
            }
            const trees = yield* geniferService.listTreesByThread(threadId)
            return { operation, data: trees }
          }
          case 'get_tree': {
            const treeId = args?.treeId as string
            if (!treeId) {
              return yield* Effect.fail(new GeniferHarnessError({
                operation: 'query',
                message: 'get_tree requires treeId arg',
              }))
            }
            const loaded = yield* geniferService.loadTree(treeId)
            return { operation, data: loaded }
          }
          case 'rate_tree': {
            const treeId = args?.treeId as string
            const rating = args?.rating as number
            if (!treeId || !rating) {
              return yield* Effect.fail(new GeniferHarnessError({
                operation: 'query',
                message: 'rate_tree requires treeId and rating args',
              }))
            }
            yield* geniferService.rateTree(treeId, rating)
            return { operation, data: { rated: true, treeId, rating } }
          }
          case 'list_composites': {
            const composites = yield* geniferService.listComposites(limit)
            return { operation, data: composites }
          }
          case 'top_composites': {
            const composites = yield* geniferService.topRankedComposites(limit)
            return { operation, data: composites }
          }
          case 'rate_composite': {
            const id = args?.compositeId as string
            const rating = args?.rating as number
            if (!id || !rating) {
              return yield* Effect.fail(new GeniferHarnessError({
                operation: 'query',
                message: 'rate_composite requires compositeId and rating args',
              }))
            }
            yield* geniferService.rateComposite(id, rating)
            return { operation, data: { rated: true, compositeId: id, rating } }
          }
          case 'get_signals': {
            const targetType = (args?.targetType as string) ?? 'tree'
            const targetId = args?.targetId as string
            if (!targetId) {
              return yield* Effect.fail(new GeniferHarnessError({
                operation: 'query',
                message: 'get_signals requires targetId arg',
              }))
            }
            const signals = yield* geniferService.listSignalsByTarget(
              targetType as any,
              targetId,
            )
            return { operation, data: signals }
          }
          default:
            return yield* Effect.fail(new GeniferHarnessError({
              operation: 'query',
              message: `Unknown query operation: '${operation}'`,
            }))
        }
      }).pipe(
        Effect.mapError((e) =>
          e instanceof GeniferHarnessError ? e : new GeniferHarnessError({
            operation: 'query',
            message: String(e),
            cause: e,
          })
        ),
        Effect.withSpan('GeniferHarnessService.query'),
      )

    // ── Surface CRUD ──

    const getSurface = (surfaceId: string) =>
      registry.get(surfaceRegistryAtom).get(surfaceId)

    const getAllSurfaces = () =>
      registry.get(surfaceRegistryAtom)

    const removeSurface = (surfaceId: string) => {
      const current = new Map(registry.get(surfaceRegistryAtom))
      current.delete(surfaceId)
      registry.set(surfaceRegistryAtom, current)
    }

    return GeniferHarnessServiceTag.of({
      generate,
      refine,
      query,
      getSurface,
      getAllSurfaces,
      removeSurface,
      registry,
    })
  }),
)
