/**
 * Pipeline Orchestrator — wires streaming graph → normalization → feedback
 *
 * This is the integration layer that connects all pipeline phases:
 *   Phase 1: extractJson/normalize/repair (for post-stream finalization)
 *   Phase 2: graph callbacks (onComponentComplete → normalizeElement)
 *   Phase 3: incremental tree builder (progressive UITree assembly)
 *   Phase 4: prompt engineering (catalog-aware system prompts)
 *   Phase 5: feedback loop (quality scoring, retry, compliance)
 *
 * Creates an enhanced StreamingJsonService with normalization baked in.
 *
 * @module genifer/streaming/pipeline
 */

import * as Atom from '@effect-atom/atom/Atom'
import * as Registry from '@effect-atom/atom/Registry'
import { Option, HashMap, Effect, Either } from 'effect'
import {
  createStreamingGraph,
  type RawComponentData,
  type ComponentIdentification,
  type StreamingGraphCallbacks,
} from './graph.js'
import type { JSONToken } from './tokenizer.js'
import type { ValidationResult, ComponentRegistration } from './bfta.js'
import {
  normalizeElement,
  createQuarantineQueue,
  createIncrementalTreeBuilder,
  type QuarantineEntry,
} from '../core/incremental-normalize.js'
import {
  scoreResult,
  classifyFailure,
  createRetryBudget,
  recordAttempt,
  type QualityScore,
  type ClassifiedFailure,
  type RetryBudgetConfig,
} from '../core/feedback-loop.js'
import { UITree, UIElement } from '../core/schemas.js'
import type { RepairResult, RepairAction } from '../core/repair.js'
import { repair } from '../core/repair.js'

// =============================================================================
// Pipeline State Atoms
// =============================================================================

/** Incrementally-built UITree — updated on each onComponentComplete */
export const pipelineTreeAtom = Atom.make<UITree>(UITree.empty()).pipe(Atom.keepAlive)

/** Normalized UIElements received so far */
export const normalizedElementsAtom = Atom.make<readonly UIElement[]>([]).pipe(Atom.keepAlive)

/** Quarantined elements that failed normalization */
export const quarantinedAtom = Atom.make<readonly QuarantineEntry[]>([]).pipe(Atom.keepAlive)

/** Completion frontier Φ(t) — set of completed component keys */
export const completionFrontierAtom = Atom.make<ReadonlySet<string>>(new Set()).pipe(Atom.keepAlive)

/** Quality score (populated after stream finalization) */
export const qualityScoreAtom = Atom.make<Option.Option<QualityScore>>(Option.none()).pipe(Atom.keepAlive)

/** Classified failure (populated if quality gate fails) */
export const classifiedFailureAtom = Atom.make<Option.Option<ClassifiedFailure>>(Option.none()).pipe(Atom.keepAlive)

/** Pipeline stage: idle → streaming → finalizing → complete | failed */
export const pipelineStageAtom = Atom.make<'idle' | 'streaming' | 'finalizing' | 'complete' | 'failed'>('idle').pipe(Atom.keepAlive)

/** Component identifications from the graph (raw, pre-normalization) */
export const identifiedComponentsAtom = Atom.make<readonly ComponentIdentification[]>([]).pipe(Atom.keepAlive)

/** Stream error */
export const pipelineErrorAtom = Atom.make<Option.Option<Error>>(Option.none()).pipe(Atom.keepAlive)

/** Chunk count */
export const chunkCountAtom = Atom.make(0).pipe(Atom.keepAlive)

/** BFTA validation results */
export const validationResultsAtom = Atom.make<readonly ValidationResult[]>([]).pipe(Atom.keepAlive)

// =============================================================================
// Pipeline Config
// =============================================================================

export type PipelineConfig = {
  /** Registry for atom state */
  registry?: Registry.Registry
  /** BFTA component registrations */
  registrations?: readonly ComponentRegistration[]
  /** Expected element count for quality scoring */
  expectedElements?: number
  /** Expected tree depth for quality scoring */
  expectedDepth?: number
  /** Quality threshold (0–1, default 0.5) */
  qualityThreshold?: number
  /** Retry budget config */
  retry?: Partial<RetryBudgetConfig>
  /** Quarantine max retries */
  quarantineMaxRetries?: number
  /** Model name for compliance tracking */
  model?: string
}

// =============================================================================
// Pipeline Orchestrator
// =============================================================================

export type StreamingPipeline = {
  /** Feed a string chunk into the pipeline */
  feedChunk: (chunk: string) => void
  /** Flush tokenizer and finalize the pipeline (triggers scoring + repair) */
  finalize: () => { tree: UITree; score: QualityScore; repairResult: RepairResult }
  /** Reset all state for a new stream */
  reset: () => void
  /** Current d2ts version */
  readonly version: number
  /** The registry for atom access */
  readonly registry: Registry.Registry
  /** Retry budget manager */
  readonly retryBudget: ReturnType<typeof createRetryBudget>
}

export function createStreamingPipeline(config: PipelineConfig = {}): StreamingPipeline {
  const registry = config.registry ?? Registry.make()
  const quarantineQueue = createQuarantineQueue(config.quarantineMaxRetries ?? 2)
  const treeBuilder = createIncrementalTreeBuilder()
  const retryBudget = createRetryBudget(config.retry)

  // ---------------------------------------------------------------------------
  // Graph callbacks — wire Phase 2 into Phase 3
  // ---------------------------------------------------------------------------

  const callbacks: StreamingGraphCallbacks = {
    onComponentIdentified(id: ComponentIdentification) {
      const prev = registry.get(identifiedComponentsAtom)
      registry.set(identifiedComponentsAtom, [...prev, id])
    },

    onToken(_token: JSONToken) {
      // Token-level tracking handled by chunkCount; detailed token history
      // is available via the base service if needed.
    },

    onComponentComplete(data: RawComponentData) {
      // Phase 3: normalize the raw component (run synchronously in hot path)
      const result = Effect.runSync(Effect.either(normalizeElement(data)))

      if (Either.isRight(result)) {
        const element = result.right
        // Add to normalized list
        const prev = registry.get(normalizedElementsAtom)
        registry.set(normalizedElementsAtom, [...prev, element])

        // Add to incremental tree builder (depth from graph data)
        treeBuilder.addElement(element, data.depth)
        registry.set(pipelineTreeAtom, treeBuilder.snapshot())

        // Update completion frontier
        const frontier = new Set(registry.get(completionFrontierAtom))
        frontier.add(element.key)
        registry.set(completionFrontierAtom, frontier)
      } else {
        // Quarantine failed element
        quarantineQueue.enqueue(data, result.left, null)
        registry.set(quarantinedAtom, quarantineQueue.entries)
      }
    },

    onValidation(result: ValidationResult) {
      const prev = registry.get(validationResultsAtom)
      registry.set(validationResultsAtom, [...prev, result])
    },
  }

  // ---------------------------------------------------------------------------
  // Create graph
  // ---------------------------------------------------------------------------

  const graph = createStreamingGraph(
    config.registrations && config.registrations.length > 0
      ? { callbacks, registrations: config.registrations }
      : callbacks,
  )

  // ---------------------------------------------------------------------------
  // Pipeline API
  // ---------------------------------------------------------------------------

  return {
    feedChunk(chunk: string) {
      if (registry.get(pipelineStageAtom) === 'idle') {
        registry.set(pipelineStageAtom, 'streaming')
      }
      registry.set(chunkCountAtom, registry.get(chunkCountAtom) + 1)

      try {
        graph.sendChunk(chunk)
      } catch (err) {
        registry.set(
          pipelineErrorAtom,
          Option.some(err instanceof Error ? err : new Error(String(err))),
        )
        registry.set(pipelineStageAtom, 'failed')
      }
    },

    finalize() {
      registry.set(pipelineStageAtom, 'finalizing')

      // Flush tokenizer
      try {
        graph.flush()
      } catch (err) {
        registry.set(
          pipelineErrorAtom,
          Option.some(err instanceof Error ? err : new Error(String(err))),
        )
      }

      // Retry quarantined elements (Effect → sync)
      if (quarantineQueue.size > 0) {
        const { recovered } = Effect.runSync(quarantineQueue.retry())
        for (const el of recovered) {
          treeBuilder.addElement(el, 1) // recovered = depth unknown, use 1
          const prev = registry.get(normalizedElementsAtom)
          registry.set(normalizedElementsAtom, [...prev, el])
        }
      }

      // Build final tree
      let tree = treeBuilder.snapshot()

      // Phase 1: repair pass on the final tree (Effect → sync)
      const repairResult = Effect.runSync(repair(tree))
      tree = repairResult.tree

      // Update atoms
      registry.set(pipelineTreeAtom, tree)
      registry.set(quarantinedAtom, quarantineQueue.entries)

      // Phase 5: score
      const score = scoreResult(tree, repairResult, {
        expectedElements: config.expectedElements,
        expectedDepth: config.expectedDepth,
        threshold: config.qualityThreshold,
      })
      registry.set(qualityScoreAtom, Option.some(score))

      // Track compliance
      if (config.model) {
        recordAttempt(config.model, {
          success: score.passed,
          repairsNeeded: repairResult.repairs.length > 0,
        })
      }

      if (score.passed) {
        registry.set(pipelineStageAtom, 'complete')
      } else {
        const failure = classifyFailure(undefined, score, repairResult)
        registry.set(classifiedFailureAtom, Option.some(failure))
        registry.set(pipelineStageAtom, 'failed')
      }

      return { tree, score, repairResult }
    },

    reset() {
      graph.reset()
      treeBuilder.clear()
      quarantineQueue.clear()
      retryBudget.reset()

      registry.set(pipelineTreeAtom, UITree.empty())
      registry.set(normalizedElementsAtom, [])
      registry.set(quarantinedAtom, [])
      registry.set(completionFrontierAtom, new Set())
      registry.set(qualityScoreAtom, Option.none())
      registry.set(classifiedFailureAtom, Option.none())
      registry.set(pipelineStageAtom, 'idle')
      registry.set(identifiedComponentsAtom, [])
      registry.set(pipelineErrorAtom, Option.none())
      registry.set(chunkCountAtom, 0)
      registry.set(validationResultsAtom, [])
    },

    get version() { return graph.version },
    get registry() { return registry },
    retryBudget,
  }
}
