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

import { Context, Effect, Layer, Schema, Option, HashMap } from 'effect'
import { LanguageModel } from '@effect/ai'
import * as Atom from '@effect-atom/atom/Atom'
import * as AtomRegistry from '@effect-atom/atom/Registry'
import { nanoid } from 'nanoid'
import { GeniferSurface, SurfaceQuality } from './surface'
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
import { generate as adapterGenerate, refine as adapterRefine } from '../compiler/ai-adapter'
import { CatalogComponents, createCatalogLayer } from '../core/CatalogService'
import { uiDomainCatalog } from '../catalog/ui-domain-catalog'
import { coreDomainCatalog } from '../catalog/core-domain-catalog'
import { buttonDomainCatalog } from '../catalog/button-domain-catalog'
import { createStreamingPipeline } from '../streaming/pipeline'

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
  readonly onProgress?: (status: string, elementCount: number, partialTree?: unknown) => void
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
  /** Serialized UITree snapshot for inline rendering */
  readonly treeSnapshot: unknown
}

export interface RefineOptions {
  readonly surfaceId: string
  readonly instruction: string
  readonly sessionId: string
  readonly model?: string
  readonly persist?: boolean
  readonly onEvent?: (event: GeniferEvent) => void
  readonly onProgress?: (status: string, elementCount: number, partialTree?: unknown) => void
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
  /** Serialized UITree snapshot for inline rendering */
  readonly treeSnapshot: unknown
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
   * Set the LanguageModel layer for generation.
   * Called at harness startup when the provider is known.
   */
  readonly setModelLayer: (layer: Layer.Layer<LanguageModel.LanguageModel>) => void

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

    // ── Model layer (set at runtime when provider is known) ──

    let modelLayer: Layer.Layer<LanguageModel.LanguageModel> | null = null
    const catalogLayer = createCatalogLayer(uiDomainCatalog, coreDomainCatalog, buttonDomainCatalog)

    const setModelLayer = (layer: Layer.Layer<LanguageModel.LanguageModel>) => {
      modelLayer = layer
    }

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

        // ── Call ai-adapter.generate() with LanguageModel + CatalogComponents ──

        if (!modelLayer) {
          return yield* Effect.fail(new GeniferHarnessError({
            operation: 'generate',
            message: 'No LanguageModel layer set — call setModelLayer() at harness startup',
          }))
        }

        let streamedElements = 0
        const adapterResult = yield* adapterGenerate({
          prompt: opts.prompt,
          interactive: true,
          maxRetries: 2,
          onDelta: (delta) => {
            // Raw text deltas — count chunks as progress
            streamedElements++
          },
          onTreeUpdate: (partialTree, elementCount) => {
            // Incremental tree update — new element completed in pipeline
            // Serialize UITree → plain JSON-safe object for WS transport
            streamedElements = elementCount
            try {
              const plainTree = {
                root: partialTree.root,
                elements: Object.fromEntries(
                  [...partialTree.elements].map(([k, v]) => [k, { ...v }])
                ),
              }
              opts.onProgress?.('streaming', elementCount, plainTree)
            } catch {
              opts.onProgress?.('streaming', elementCount)
            }
          },
          onComponent: (key, type) => {
            // Element identified during streaming — emit proper delta event
            const deltaEvent = new GeniferStreamDeltaEvent({
              seq: nextSeq(),
              sessionId: opts.sessionId,
              toolCallId: surfaceId,
              surfaceId,
              elementKey: key,
              elementType: type,
              parentKey: null,
              depth: 0,
              stage: 'tokenized',
              timestamp: Date.now(),
            })
            appendDelta(deltaEvent)
            opts.onEvent?.(deltaEvent)
            setActiveGeneration({
              toolCallId: surfaceId,
              surfaceId,
              prompt: opts.prompt,
              instruction: null,
              status: 'streaming',
              model,
              startedAt: startTime,
              elementCount: streamedElements,
              error: null,
            })
          },
          onRetry: (attempt, _failure) => {
            opts.onProgress?.(`retry-${attempt}`, streamedElements)
          },
        }).pipe(
          Effect.provide(modelLayer),
          Effect.provide(catalogLayer),
        )

        const durationMs = Date.now() - startTime
        const elementCount = adapterResult.elementCount
        const qualityScore = adapterResult.qualityScore
        const repairCount = adapterResult.repairCount

        // Create surface from result
        const surface: GeniferSurface = new GeniferSurface({
          id: surfaceId,
          treeId: null, // filled after persist
          threadId,
          toolCallId: surfaceId,
          sessionId: opts.sessionId,
          treeSnapshot: adapterResult.rawJson,
          version: 1,
          parentSurfaceId: null,
          dataBindings: {},
          actionBindings: {},
          quality: new SurfaceQuality({ score: qualityScore, elementCount, repairCount, model, durationMs }),
          prompt: opts.prompt,
          instruction: null,
          status: 'complete',
          createdAt: startTime,
        })
        addSurface(surface)

        // Persist if requested
        let treeId: string | null = null
        if (opts.persist !== false) {
          const saveResult = yield* geniferService.saveTree({
            tree: adapterResult.tree,
            prompt: opts.prompt,
            qualityScore,
            repairCount,
            threadId,
          }).pipe(Effect.either)
          if (saveResult._tag === 'Right') {
            treeId = (saveResult.right as any).treeId ?? null
            if (treeId) {
              appendSessionTreeId(treeId)
              updateSurface(surfaceId, { treeId })
            }
          } else {
            // Persistence failure is non-fatal — surface still works from snapshot
            console.warn(`[genifer] persistence failed for surface ${surfaceId}:`, saveResult.left)
          }
        }

        // Update active generation to complete
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
          treeId,
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
          treeId,
          elementCount,
          qualityScore,
          repairCount,
          durationMs,
          model,
          threadId,
          treeSnapshot: adapterResult.rawJson,
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

        // ── Call ai-adapter.refine() with current tree ──

        if (!modelLayer) {
          return yield* Effect.fail(new GeniferHarnessError({
            operation: 'refine',
            message: 'No LanguageModel layer set — call setModelLayer() at harness startup',
          }))
        }

        // Reconstruct current tree from snapshot for refinement
        let currentTree: import('../core/schemas').UITree | null = null
        if (surface.treeSnapshot && typeof surface.treeSnapshot === 'string') {
          try {
            const rebuildPipeline = createStreamingPipeline()
            rebuildPipeline.feedChunk(surface.treeSnapshot as string)
            const { tree: rebuilt } = rebuildPipeline.finalize()
            currentTree = rebuilt
          } catch {
            // Fall through
          }
        }

        if (!currentTree) {
          return yield* Effect.fail(new GeniferHarnessError({
            operation: 'refine',
            message: `Cannot refine surface ${opts.surfaceId}: no tree snapshot available`,
          }))
        }

        let streamedElements = 0
        const adapterResult = yield* adapterRefine({
          prompt: opts.instruction,
          currentTree,
          interactive: true,
          maxRetries: 2,
          onDelta: (_delta) => {
            streamedElements++
          },
          onTreeUpdate: (partialTree, elementCount) => {
            streamedElements = elementCount
            try {
              const plainTree = {
                root: partialTree.root,
                elements: Object.fromEntries(
                  [...partialTree.elements].map(([k, v]) => [k, { ...v }])
                ),
              }
              opts.onProgress?.('streaming', elementCount, plainTree)
            } catch {
              opts.onProgress?.('streaming', elementCount)
            }
          },
          onComponent: (key, type) => {
            const deltaEvent = new GeniferStreamDeltaEvent({
              seq: nextSeq(),
              sessionId: opts.sessionId,
              toolCallId: newSurfaceId,
              surfaceId: newSurfaceId,
              elementKey: key ?? `el-${streamedElements}`,
              elementType: type ?? 'Unknown',
              parentKey: null,
              depth: 0,
              stage: 'tokenized',
              timestamp: Date.now(),
            })
            appendDelta(deltaEvent)
            opts.onEvent?.(deltaEvent)
          },
        }).pipe(
          Effect.provide(modelLayer),
          Effect.provide(catalogLayer),
        )

        const durationMs = Date.now() - startTime
        const elementCount = adapterResult.elementCount
        const qualityScore = adapterResult.qualityScore
        const repairCount = adapterResult.repairCount

        // Diff calculation (basic: compare element counts)
        const sourceElementCount = currentTree ? HashMap.size(currentTree.elements) : 0
        const addedElements = Math.max(0, elementCount - sourceElementCount)
        const removedElements = Math.max(0, sourceElementCount - elementCount)
        const modifiedElements = Math.min(elementCount, sourceElementCount)

        // Create refined surface
        const refinedSurface: GeniferSurface = new GeniferSurface({
          id: newSurfaceId,
          treeId: null,
          threadId: surface.threadId,
          toolCallId: newSurfaceId,
          sessionId: opts.sessionId,
          treeSnapshot: adapterResult.rawJson,
          version: surface.version + 1,
          parentSurfaceId: surface.id,
          dataBindings: {},
          actionBindings: {},
          quality: new SurfaceQuality({ score: qualityScore, elementCount, repairCount, model, durationMs }),
          prompt: surface.prompt,
          instruction: opts.instruction,
          status: 'complete',
          createdAt: startTime,
        })
        addSurface(refinedSurface)

        // Persist
        let treeId: string | null = null
        if (opts.persist !== false) {
          const saveResult = yield* geniferService.saveTree({
            tree: adapterResult.tree,
            prompt: surface.prompt,
            qualityScore,
            repairCount,
            threadId: surface.threadId,
          }).pipe(Effect.either)
          if (saveResult._tag === 'Right') {
            treeId = (saveResult.right as any).treeId ?? null
            if (treeId) {
              appendSessionTreeId(treeId)
              updateSurface(newSurfaceId, { treeId })
            }
          } else {
            console.warn(`[genifer] persistence failed for refined surface ${newSurfaceId}:`, saveResult.left)
          }
        }

        const completeEvent = new GeniferRefineCompleteEvent({
          seq: nextSeq(),
          sessionId: opts.sessionId,
          toolCallId: newSurfaceId,
          surfaceId: newSurfaceId,
          sourceTreeId: surface.treeId ?? '',
          sourceSurfaceId: surface.id,
          resultTreeId: treeId,
          elementCount,
          qualityScore,
          repairCount,
          durationMs,
          addedElements,
          removedElements,
          modifiedElements,
          error: null,
          timestamp: Date.now(),
        })
        opts.onEvent?.(completeEvent)

        setActiveGeneration(null)

        return {
          surfaceId: newSurfaceId,
          treeId,
          sourceTreeId: surface.treeId ?? '',
          sourceSurfaceId: surface.id,
          elementCount,
          qualityScore,
          repairCount,
          durationMs,
          addedElements,
          removedElements,
          modifiedElements,
          treeSnapshot: adapterResult.rawJson,
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
      setModelLayer,
      registry,
    })
  }),
)
