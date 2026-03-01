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
import { ActionBinding, DataSourceBinding, GeniferSurface, SurfaceQuality } from './surface'
import {
  type SurfaceId,
  type ThreadId,
  type SessionId,
  type ToolCallId,
  makeSurfaceId,
  makeThreadId,
} from '../identifiers'
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
import {
  generate as adapterGenerate,
  refine as adapterRefine,
  type PromptEvalTrace,
} from '../compiler/ai-adapter'
import { CatalogComponents, createCatalogLayer } from '../core/CatalogService'
import { coreDomainCatalog } from '../catalog'
import { normalize } from '../core/normalize'
import type { JsonPatch, UITree } from '../core/schemas'

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

export interface GeniferProgressUpdate {
  /** Optional full tree checkpoint (throttled, not every patch) */
  readonly treeSnapshot?: unknown
  /** RFC6902/legacy-set patch emitted for incremental client application */
  readonly treePatch?: JsonPatch
  /** Monotonic patch sequence number for de-duplication */
  readonly patchSeq?: number
  /** Operation start timestamp (epoch ms) */
  readonly startTs?: number
  /** Timestamp of first patch observed in harness stream (epoch ms) */
  readonly firstPatchReceivedTs?: number
  /** Measured from operation start -> first emitted patch */
  readonly firstPatchLatencyMs?: number
}

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
  readonly onProgress?: (status: string, elementCount: number, progress?: GeniferProgressUpdate) => void
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
  /** Operation start timestamp (epoch ms) */
  readonly startTs?: number
  /** Timestamp of first patch observed in harness stream (epoch ms) */
  readonly firstPatchReceivedTs?: number
  /** Milliseconds from operation start until first patch was emitted */
  readonly firstPatchLatencyMs?: number
  /** Structured malformed-line evidence captured during parsing/decoding */
  readonly quarantineEntries?: ReadonlyArray<unknown>
  /** Serialized UITree snapshot for inline rendering */
  readonly treeSnapshot: unknown
  /** Prompt eval trace emitted by ai-adapter for tokenomics + steering */
  readonly promptEval?: PromptEvalTrace
}

export interface RefineOptions {
  readonly surfaceId: string
  readonly instruction: string
  readonly sessionId: string
  readonly model?: string
  readonly persist?: boolean
  readonly onEvent?: (event: GeniferEvent) => void
  readonly onProgress?: (status: string, elementCount: number, progress?: GeniferProgressUpdate) => void
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
  /** Operation start timestamp (epoch ms) */
  readonly startTs?: number
  /** Timestamp of first patch observed in harness stream (epoch ms) */
  readonly firstPatchReceivedTs?: number
  /** Milliseconds from operation start until first patch was emitted */
  readonly firstPatchLatencyMs?: number
  /** Structured malformed-line evidence captured during parsing/decoding */
  readonly quarantineEntries?: ReadonlyArray<unknown>
  /** Serialized UITree snapshot for inline rendering */
  readonly treeSnapshot: unknown
  /** Prompt eval trace emitted by ai-adapter for tokenomics + steering */
  readonly promptEval?: PromptEvalTrace
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
   * Allocate a streaming-status GeniferSurface and register it in the
   * surface registry immediately. Returns the surfaceId synchronously.
   * The surface has status:'streaming', no treeSnapshot, empty bindings.
   *
   * Use with `generateInBackground` for fire-and-forget panel spawning.
   */
  readonly allocateStreamingSurface: (opts: {
    readonly prompt: string
    readonly sessionId: SessionId
    readonly threadId?: ThreadId
    readonly model?: string
  }) => { readonly surfaceId: SurfaceId; readonly threadId: ThreadId }

  /**
   * Run generation in background for a pre-allocated streaming surface.
   * Returns an Effect that can be run as a detached fiber.
   * As tokens stream in, the surface atom is updated incrementally.
   * On completion, the surface is promoted to status:'complete'.
   */
  readonly generateInBackground: (opts: GenerateOptions & {
    /** The pre-allocated surfaceId from allocateStreamingSurface */
    readonly surfaceId: SurfaceId
    /** The threadId from allocateStreamingSurface */
    readonly threadId: ThreadId
    /** Called with each incremental surface update (for panel event bus relay) */
    readonly onSurfaceUpdate?: (surfaceId: SurfaceId, surface: GeniferSurface) => void
  }) => Effect.Effect<GenerateResult, GeniferHarnessError>

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
    const catalogLayer = createCatalogLayer(coreDomainCatalog)

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

    const materializeBindings = (tree: UITree) => {
      const dataBindings: Record<string, DataSourceBinding> = {}
      const actionBindings: Record<string, ActionBinding> = {}

      for (const [elementKey, element] of tree.elements) {
        const dataSources = Array.isArray((element as any).dataSources)
          ? ((element as any).dataSources as ReadonlyArray<any>)
          : []
        for (const source of dataSources) {
          if (!source || typeof source !== 'object') continue
          const targetProp = typeof source.targetProp === 'string' ? source.targetProp : 'value'
          const key = GeniferSurface.bindingKey(elementKey, targetProp)
          dataBindings[key] = new DataSourceBinding({
            type: (source.type as any) ?? 'static',
            key: String(source.key ?? key),
            targetProp,
            ...(source.staticValue !== undefined ? { staticValue: source.staticValue } : {}),
            ...(typeof source.transform === 'string' ? { transform: source.transform } : {}),
            ...(typeof source.refreshMs === 'number' ? { refreshMs: source.refreshMs } : {}),
          })
        }

        const actions = Array.isArray((element as any).actions)
          ? ((element as any).actions as ReadonlyArray<any>)
          : []
        for (const action of actions) {
          if (!action || typeof action !== 'object') continue
          const trigger = typeof action.trigger === 'string' ? action.trigger : 'onClick'
          const key = GeniferSurface.actionKey(elementKey, trigger)
          actionBindings[key] = new ActionBinding({
            type: (action.type as any) ?? 'emitEvent',
            trigger,
            target: String(action.target ?? ''),
            ...(action.payload !== undefined ? { payload: action.payload } : {}),
            ...(typeof action.confirmPrompt === 'string' ? { confirmPrompt: action.confirmPrompt } : {}),
          })
        }
      }

      return { dataBindings, actionBindings }
    }

    // ── Generate ──

    const generate = (opts: GenerateOptions): Effect.Effect<GenerateResult, GeniferHarnessError> =>
      Effect.gen(function* () {
        const surfaceId = nanoid()
        const threadId = opts.threadId ?? nanoid()
        const model = opts.model ?? 'sonnet-4'
        const startTime = Date.now()

        // ── Preflight ──
        if (!modelLayer) {
          return yield* Effect.fail(new GeniferHarnessError({
            operation: 'generate',
            message: 'No LanguageModel layer set — call setModelLayer() at harness startup',
          }))
        }

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

        let streamedElements = 0
        let patchSeq = 0
        let firstPatchReceivedTs: number | undefined = undefined
        let firstPatchLatencyMs: number | undefined = undefined
        const adapterResult = yield* adapterGenerate({
          prompt: opts.prompt,
          interactive: true,
          maxRetries: 2,
          onDelta: () => {
            // raw text deltas are accounted for via onPatch/onTreeUpdate
          },
          onPatch: (patch, _partialTree, elementCount) => {
            patchSeq += 1
            streamedElements = elementCount
            const now = Date.now()
            if (firstPatchReceivedTs === undefined) {
              firstPatchReceivedTs = now
            }
            if (firstPatchLatencyMs === undefined) {
              firstPatchLatencyMs = Math.max(0, now - startTime)
            }
            opts.onProgress?.('streaming', streamedElements, {
              treePatch: patch,
              patchSeq,
              startTs: startTime,
              firstPatchReceivedTs,
              firstPatchLatencyMs,
            })
          },
          onTreeUpdate: (_partialTree, elementCount) => {
            // Keep element counters fresh without serializing full snapshots.
            streamedElements = elementCount
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
              elementCount: Math.max(streamedElements, 1),
              propsSnapshot: null,
              className: null,
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

        yield* Effect.annotateCurrentSpan('genifer.promptEval.utility', adapterResult.promptEval.utility.utilityScore)
        yield* Effect.annotateCurrentSpan('genifer.promptEval.steering', adapterResult.promptEval.utility.steeringScore)
        yield* Effect.annotateCurrentSpan('genifer.promptEval.costIndex', adapterResult.promptEval.utility.costIndex)

        // Create surface from result
        const { dataBindings, actionBindings } = materializeBindings(adapterResult.tree)
        const surface: GeniferSurface = new GeniferSurface({
          id: surfaceId,
          treeId: null, // filled after persist
          threadId,
          toolCallId: surfaceId,
          sessionId: opts.sessionId,
          treeSnapshot: adapterResult.rawJson,
          treePatch: null,
          patchSeq: 0,
          version: 1,
          parentSurfaceId: null,
          dataBindings,
          actionBindings,
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
          startTs: startTime,
          firstPatchReceivedTs,
          firstPatchLatencyMs,
          quarantineEntries: adapterResult.quarantineEntries,
          treeSnapshot: adapterResult.rawJson,
          promptEval: adapterResult.promptEval,
        }
      }).pipe(
        Effect.ensuring(Effect.sync(() => setActiveGeneration(null))),
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

        // ── Preflight ──
        if (!modelLayer) {
          return yield* Effect.fail(new GeniferHarnessError({
            operation: 'refine',
            message: 'No LanguageModel layer set — call setModelLayer() at harness startup',
          }))
        }

        // Reconstruct current tree from snapshot for refinement
        let currentTree: UITree | null = null
        if (surface.treeSnapshot != null) {
          const snapshotRaw = typeof surface.treeSnapshot === 'string'
            ? surface.treeSnapshot
            : JSON.stringify(surface.treeSnapshot)

          const normalized = yield* normalize(snapshotRaw).pipe(Effect.either)
          if (normalized._tag === 'Right') {
            currentTree = normalized.right
          }
        }

        if (!currentTree) {
          return yield* Effect.fail(new GeniferHarnessError({
            operation: 'refine',
            message: `Cannot refine surface ${opts.surfaceId}: no usable tree snapshot available`,
          }))
        }

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

        const refineSeedSnapshot = JSON.stringify({
          root: currentTree.root,
          elements: currentTree.toRecord(),
        })

        // Seed refine consumers with the source tree before diff patches arrive.
        opts.onProgress?.('streaming', currentTree.size, {
          treeSnapshot: refineSeedSnapshot,
          patchSeq: 0,
          startTs: startTime,
        })

        let streamedElements = currentTree.size
        let patchSeq = 0
        let firstPatchReceivedTs: number | undefined = undefined
        let firstPatchLatencyMs: number | undefined = undefined
        const adapterResult = yield* adapterRefine({
          prompt: opts.instruction,
          currentTree,
          interactive: true,
          maxRetries: 2,
          onDelta: () => {
            // raw text deltas are accounted for via onPatch/onTreeUpdate
          },
          onPatch: (patch, _partialTree, elementCount) => {
            patchSeq += 1
            streamedElements = elementCount
            const now = Date.now()
            if (firstPatchReceivedTs === undefined) {
              firstPatchReceivedTs = now
            }
            if (firstPatchLatencyMs === undefined) {
              firstPatchLatencyMs = Math.max(0, now - startTime)
            }
            opts.onProgress?.('streaming', streamedElements, {
              treePatch: patch,
              patchSeq,
              startTs: startTime,
              firstPatchReceivedTs,
              firstPatchLatencyMs,
            })
          },
          onTreeUpdate: (_partialTree, elementCount) => {
            streamedElements = elementCount
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
              elementCount: Math.max(streamedElements, 1),
              propsSnapshot: null,
              className: null,
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

        yield* Effect.annotateCurrentSpan('genifer.promptEval.utility', adapterResult.promptEval.utility.utilityScore)
        yield* Effect.annotateCurrentSpan('genifer.promptEval.steering', adapterResult.promptEval.utility.steeringScore)
        yield* Effect.annotateCurrentSpan('genifer.promptEval.costIndex', adapterResult.promptEval.utility.costIndex)

        // Diff calculation (basic: compare element counts)
        const sourceElementCount = currentTree ? HashMap.size(currentTree.elements) : 0
        const addedElements = Math.max(0, elementCount - sourceElementCount)
        const removedElements = Math.max(0, sourceElementCount - elementCount)
        const modifiedElements = Math.min(elementCount, sourceElementCount)

        // Create refined surface
        const { dataBindings, actionBindings } = materializeBindings(adapterResult.tree)
        const refinedSurface: GeniferSurface = new GeniferSurface({
          id: newSurfaceId,
          treeId: null,
          threadId: surface.threadId,
          toolCallId: newSurfaceId,
          sessionId: opts.sessionId,
          treeSnapshot: adapterResult.rawJson,
          treePatch: null,
          patchSeq: 0,
          version: surface.version + 1,
          parentSurfaceId: surface.id,
          dataBindings,
          actionBindings,
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
          startTs: startTime,
          firstPatchReceivedTs,
          firstPatchLatencyMs,
          quarantineEntries: adapterResult.quarantineEntries,
          treeSnapshot: adapterResult.rawJson,
          promptEval: adapterResult.promptEval,
        }
      }).pipe(
        Effect.ensuring(Effect.sync(() => setActiveGeneration(null))),
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

    // ── allocateStreamingSurface ──
    // Creates a real GeniferSurface in status:'streaming' and registers it
    // in the surface registry immediately. The panel visitor can subscribe
    // to it via geniferPanelSurfaces atom and render the streaming skeleton.

    const allocateStreamingSurface = (opts: {
      readonly prompt: string
      readonly sessionId: SessionId
      readonly threadId?: ThreadId
      readonly model?: string
    }): { readonly surfaceId: SurfaceId; readonly threadId: ThreadId } => {
      const surfaceId = makeSurfaceId()
      const threadId = opts.threadId ?? makeThreadId()
      const model = opts.model ?? 'sonnet-4'

      const streamingSurface: GeniferSurface = new GeniferSurface({
        id: surfaceId,
        treeId: null,
        threadId,
        toolCallId: surfaceId,
        sessionId: opts.sessionId,
        treeSnapshot: null,
        treePatch: null,
        patchSeq: 0,
        version: 1,
        parentSurfaceId: null,
        dataBindings: {},
        actionBindings: {},
        quality: new SurfaceQuality({ score: 0, elementCount: 0, repairCount: 0, model, durationMs: 0 }),
        prompt: opts.prompt,
        instruction: null,
        status: 'streaming',
        createdAt: Date.now(),
      })

      addSurface(streamingSurface)
      return { surfaceId, threadId }
    }

    // ── generateInBackground ──
    // Runs the full generation pipeline for a pre-allocated streaming surface.
    // As tokens arrive, the surface in the registry is updated with partial
    // treeSnapshots. On completion, status is promoted to 'complete' with
    // fully materialized bindings. The onSurfaceUpdate callback lets the
    // bridge push updates to the panel event bus.

    const generateInBackground = (opts: GenerateOptions & {
      readonly surfaceId: SurfaceId
      readonly threadId: ThreadId
      readonly onSurfaceUpdate?: (surfaceId: SurfaceId, surface: GeniferSurface) => void
    }): Effect.Effect<GenerateResult, GeniferHarnessError> =>
      Effect.gen(function* () {
        const { surfaceId, threadId } = opts
        const model = opts.model ?? 'sonnet-4'
        const startTime = Date.now()

        // ── Preflight ──
        if (!modelLayer) {
          return yield* Effect.fail(new GeniferHarnessError({
            operation: 'generateInBackground',
            message: 'No LanguageModel layer set — call setModelLayer() at harness startup',
          }))
        }

        // Reset stream deltas
        registry.set(streamDeltasAtom, [])

        setActiveGeneration({
          toolCallId: surfaceId,
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

        let streamedElements = 0
        let patchSeq = 0
        let firstPatchReceivedTs: number | undefined = undefined
        let firstPatchLatencyMs: number | undefined = undefined
        const adapterResult = yield* adapterGenerate({
          prompt: opts.prompt,
          interactive: true,
          maxRetries: 2,
          onDelta: () => {
            // raw text deltas are accounted for via onPatch/onTreeUpdate
          },
          onPatch: (patch, _partialTree, elementCount) => {
            patchSeq += 1
            streamedElements = elementCount
            const now = Date.now()
            if (firstPatchReceivedTs === undefined) {
              firstPatchReceivedTs = now
            }
            if (firstPatchLatencyMs === undefined) {
              firstPatchLatencyMs = Math.max(0, now - startTime)
            }

            updateSurface(surfaceId, {
              treePatch: patch,
              patchSeq,
              quality: new SurfaceQuality({
                score: 0,
                elementCount: streamedElements,
                repairCount: 0,
                model,
                durationMs: Date.now() - startTime,
              }),
            })

            const updatedSurface = getSurface(surfaceId)
            if (updatedSurface) {
              opts.onSurfaceUpdate?.(surfaceId, updatedSurface)
            }

            opts.onProgress?.('streaming', streamedElements, {
              treePatch: patch,
              patchSeq,
              startTs: startTime,
              firstPatchReceivedTs,
              firstPatchLatencyMs,
            })
          },
          onTreeUpdate: (_partialTree, elementCount) => {
            streamedElements = elementCount
          },
          onComponent: (key, type) => {
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
              elementCount: Math.max(streamedElements, 1),
              propsSnapshot: null,
              className: null,
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

        // Materialize bindings from the final tree
        const { dataBindings, actionBindings } = materializeBindings(adapterResult.tree)

        // Promote surface to complete with full bindings
        updateSurface(surfaceId, {
          treeSnapshot: adapterResult.rawJson,
          treePatch: null,
          patchSeq,
          dataBindings,
          actionBindings,
          quality: new SurfaceQuality({ score: qualityScore, elementCount, repairCount, model, durationMs }),
          status: 'complete',
        })

        // Final surface push
        const finalSurface = getSurface(surfaceId)
        if (finalSurface) {
          opts.onSurfaceUpdate?.(surfaceId, finalSurface)
        }

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
            console.warn(`[genifer] persistence failed for surface ${surfaceId}:`, saveResult.left)
          }
        }

        setActiveGeneration(null)

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

        setQualityMetrics({
          surfaceId,
          score: qualityScore,
          elementCount,
          repairCount,
          durationMs,
          model,
        })

        return {
          surfaceId,
          treeId,
          elementCount,
          qualityScore,
          repairCount,
          durationMs,
          model,
          threadId,
          startTs: startTime,
          firstPatchReceivedTs,
          firstPatchLatencyMs,
          quarantineEntries: adapterResult.quarantineEntries,
          treeSnapshot: adapterResult.rawJson,
          promptEval: adapterResult.promptEval,
        }
      }).pipe(
        Effect.ensuring(Effect.sync(() => setActiveGeneration(null))),
        Effect.mapError((e) =>
          e instanceof GeniferHarnessError ? e : new GeniferHarnessError({
            operation: 'generateInBackground',
            message: String(e),
            cause: e,
          }),
        ),
        Effect.withSpan('GeniferHarnessService.generateInBackground'),
      )

    return GeniferHarnessServiceTag.of({
      generate,
      refine,
      query,
      getSurface,
      getAllSurfaces,
      removeSurface,
      allocateStreamingSurface,
      generateInBackground,
      setModelLayer,
      registry,
    })
  }),
)
