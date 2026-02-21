/**
 * Genifer Persistence Pipeline — Save/Load UITree ↔ PostgreSQL
 *
 * Bridges the in-memory UITree (HashMap-backed) to genifer.trees + genifer.elements.
 * Also emits quality signals on save.
 *
 * Save: UITree → INSERT genifer.trees + INSERT genifer.elements (batch)
 * Load: SELECT genifer.trees JOIN genifer.elements → UITree (HashMap reconstruction)
 *
 * @module
 */

import { Effect, Option, HashMap, Context, Layer } from 'effect'
import { SqlError } from '@effect/sql'
import type { ParseResult } from 'effect'

import { UITree, UIElement } from '../core/schemas'
import type { GeniferTreeId } from '../models/_common'
import { GeniferTreeRepo, type GeniferTreeRepository } from './GeniferTreeRepo'
import { GeniferElementRepo, type GeniferElementRepository, type ElementInsert } from './GeniferElementRepo'
import { GeniferSignalRepo, type GeniferSignalRepository } from './GeniferSignalRepo'

// =============================================================================
// Types
// =============================================================================

export type PersistenceError = SqlError.SqlError | ParseResult.ParseError

export interface SaveTreeInput {
  /** The generated UITree */
  readonly tree: UITree
  /** The prompt that produced this tree */
  readonly prompt: string
  /** Pipeline quality score (0–1) */
  readonly qualityScore: number
  /** Number of repairs during normalization */
  readonly repairCount: number
  /** Generation duration in ms */
  readonly durationMs?: number
  /** Which model generated this */
  readonly model?: string
  /** Thread ID for conversation chains */
  readonly threadId?: string
  /** Parent tree ID (for refinements) */
  readonly parentTreeId?: GeniferTreeId
}

export interface SaveTreeResult {
  /** Database-generated UUID for the tree */
  readonly treeId: GeniferTreeId
  /** Number of elements persisted */
  readonly elementCount: number
}

export interface LoadTreeResult {
  /** Reconstructed UITree */
  readonly tree: UITree
  /** Database metadata */
  readonly prompt: string
  readonly qualityScore: number
  readonly model: string | null
  readonly threadId: string | null
  readonly createdAt: Date
}

export interface GeniferPersistenceService {
  /** Save a UITree + elements to PostgreSQL. Emits pipeline_score signal. */
  readonly saveTree: (input: SaveTreeInput) => Effect.Effect<SaveTreeResult, PersistenceError>
  /** Load a UITree from PostgreSQL by tree ID. Reconstructs HashMap. */
  readonly loadTree: (treeId: GeniferTreeId) => Effect.Effect<Option.Option<LoadTreeResult>, PersistenceError>
}

// =============================================================================
// Tag
// =============================================================================

export class GeniferPersistence extends Context.Tag('genifer/Persistence')<
  GeniferPersistence,
  GeniferPersistenceService
>() {}

// =============================================================================
// Implementation
// =============================================================================

export const GeniferPersistenceLive = Layer.effect(
  GeniferPersistence,
  Effect.gen(function* () {
    const treeRepo = yield* GeniferTreeRepo
    const elementRepo = yield* GeniferElementRepo
    const signalRepo = yield* GeniferSignalRepo

    // =========================================================================
    // Save
    // =========================================================================

    const saveTree = (input: SaveTreeInput): Effect.Effect<SaveTreeResult, PersistenceError> =>
      Effect.gen(function* () {
        const { tree, prompt, qualityScore, repairCount, durationMs, model, threadId, parentTreeId } = input

        const elementCount = tree.size

        // 1. Insert tree row
        const treeRow = yield* treeRepo.insert({
          prompt,
          rootKey: tree.root,
          model: model ? Option.some(model) : Option.none(),
          qualityScore,
          elementCount,
          repairCount,
          durationMs: durationMs != null ? Option.some(durationMs) : Option.none(),
          threadId: threadId ? Option.some(threadId) : Option.none(),
          parentTreeId: parentTreeId ? Option.some(parentTreeId) : Option.none(),
          humanRating: Option.none(),
          metadata: Option.none(),
        })

        const treeId = treeRow.id

        // 2. Convert UIElements → ElementInsert[]
        const inserts: ElementInsert[] = []
        for (const [_key, elem] of tree.elements) {
          inserts.push({
            elementKey: elem.key,
            elementType: elem.type,
            props: elem.props as Record<string, unknown>,
            className: elem.className,
            parentKey: elem.parentKey,
            children: elem.children,
            depth: computeDepth(tree, elem.key),
            entrance: elem.entrance,
            role: elem.role,
            ariaLabel: elem.ariaLabel,
            visible: elem.visible,
          })
        }

        // 3. Batch insert elements
        yield* elementRepo.insertBatch(treeId, inserts)

        // 4. Emit pipeline_score signal
        yield* signalRepo.emit({
          targetType: 'tree',
          targetId: treeId,
          signalType: 'pipeline_score',
          value: qualityScore,
          metadata: { model, repairCount, elementCount, durationMs },
        })

        return { treeId, elementCount } satisfies SaveTreeResult
      })

    // =========================================================================
    // Load
    // =========================================================================

    const loadTree = (treeId: GeniferTreeId): Effect.Effect<Option.Option<LoadTreeResult>, PersistenceError> =>
      Effect.gen(function* () {
        // 1. Get tree metadata
        const treeOpt = yield* treeRepo.findById(treeId)
        if (Option.isNone(treeOpt)) return Option.none()

        const treeRow = treeOpt.value

        // 2. Get all elements
        const elements = yield* elementRepo.findByTree(treeId)

        // 3. Reconstruct HashMap<string, UIElement>
        let elementMap = HashMap.empty<string, UIElement>()

        for (const elem of elements) {
          const uiElement = new UIElement({
            key: elem.elementKey,
            type: elem.elementType,
            props: elem.props as Record<string, unknown>,
            children: elem.children,
            parentKey: Option.getOrNull(elem.parentKey),
            className: Option.getOrUndefined(elem.className),
            entrance: Option.getOrUndefined(elem.entrance) as any,
            role: Option.getOrUndefined(elem.role),
            ariaLabel: Option.getOrUndefined(elem.ariaLabel),
            visible: Option.getOrUndefined(elem.visible) as any,
          })
          elementMap = HashMap.set(elementMap, elem.elementKey, uiElement)
        }

        // 4. Build UITree
        const tree = new UITree({
          root: treeRow.rootKey,
          elements: elementMap,
        })

        // 5. Increment usage counter
        yield* treeRepo.incrementUsage(treeId)

        return Option.some({
          tree,
          prompt: treeRow.prompt,
          qualityScore: treeRow.qualityScore,
          model: Option.getOrNull(treeRow.model),
          threadId: Option.getOrNull(treeRow.threadId),
          createdAt: treeRow.createdAt as any as Date,
        } satisfies LoadTreeResult)
      })

    return { saveTree, loadTree } satisfies GeniferPersistenceService
  })
)

// =============================================================================
// Helpers
// =============================================================================

/**
 * Compute depth by walking parent_key chain.
 * Root (no parent) = 0.
 */
function computeDepth(tree: UITree, key: string): number {
  let depth = 0
  let current = key
  for (let i = 0; i < 100; i++) {  // Guard against cycles
    const elem = tree.getElementUnsafe(current)
    if (!elem || !elem.parentKey) break
    current = elem.parentKey
    depth++
  }
  return depth
}
