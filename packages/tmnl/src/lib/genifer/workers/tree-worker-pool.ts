/**
 * Tree Worker Pool (Effect Platform)
 *
 * Proper Effect WorkerPool implementation using @effect/platform.
 * Provides pooled workers with automatic load balancing.
 *
 * @module genifer/workers/tree-worker-pool
 */

import { Worker } from "@effect/platform"
import { BrowserWorker } from "@effect/platform-browser"
import { Effect, Stream, Layer, Context, Chunk, Option, pipe } from "effect"
import { UITree, UIElement, JsonPatch } from "../core/schemas"

// =============================================================================
// JSON Serialization Types
// =============================================================================

interface UIElementJSON {
  key: string
  type: string
  props: Record<string, unknown>
  children: string[]
  parentKey: string | null
  visible?: unknown
  entrance?: unknown
}

interface UITreeJSON {
  root: string
  elements: Record<string, UIElementJSON>
}

interface ApplyPatchesRequest {
  tree: UITreeJSON
  patches: Array<{ op: string; path: string; value?: unknown }>
}

// =============================================================================
// Serialization Helpers
// =============================================================================

const treeToJSON = (tree: UITree): UITreeJSON => ({
  root: tree.root,
  elements: Object.fromEntries(
    Object.entries(tree.elements).map(([key, el]) => [
      key,
      {
        key: el.key,
        type: el.type,
        props: el.props,
        children: [...el.children],
        parentKey: el.parentKey,
        visible: el.visible,
        entrance: el.entrance,
      },
    ])
  ),
})

const treeFromJSON = (json: UITreeJSON): UITree =>
  new UITree({
    root: json.root,
    elements: Object.fromEntries(
      Object.entries(json.elements).map(([key, el]) => [
        key,
        new UIElement({
          key: el.key,
          type: el.type,
          props: el.props,
          children: el.children,
          parentKey: el.parentKey,
          visible: el.visible as UIElement["visible"],
          entrance: el.entrance as UIElement["entrance"],
        }),
      ])
    ),
  })

const patchToJSON = (patch: JsonPatch): { op: string; path: string; value?: unknown } => ({
  op: patch.op,
  path: patch.path,
  value: patch.value,
})

// =============================================================================
// WorkerPool Service
// =============================================================================

export interface TreeWorkerPoolService {
  /**
   * Apply patches using the worker pool.
   * Automatically load-balances across available workers.
   */
  readonly applyPatches: (
    tree: UITree,
    patches: Chunk.Chunk<JsonPatch>
  ) => Effect.Effect<UITree, Error>

  /**
   * Apply patches progressively as they arrive.
   * Batches patches and emits intermediate tree states.
   * Good for progressive rendering where user sees UI building.
   */
  readonly applyStream: (
    initialTree: UITree,
    patches: Stream.Stream<JsonPatch, Error>,
    batchSize?: number
  ) => Stream.Stream<UITree, Error>

  /**
   * Apply ALL patches in a single worker call.
   * Collects entire stream, sends once, returns final tree.
   * Good for final-only rendering or when you want one roundtrip.
   */
  readonly applyAll: (
    initialTree: UITree,
    patches: Stream.Stream<JsonPatch, Error>
  ) => Effect.Effect<UITree, Error>

  /**
   * Get pool statistics
   */
  readonly stats: () => Effect.Effect<{
    size: number
    available: number
  }>
}

export class TreeWorkerPool extends Context.Tag("TreeWorkerPool")<
  TreeWorkerPool,
  TreeWorkerPoolService
>() {}

// =============================================================================
// Pool Configuration
// =============================================================================

export interface TreeWorkerPoolConfig {
  /**
   * Number of workers in the pool.
   * Defaults to navigator.hardwareConcurrency or 4.
   */
  readonly size?: number

  /**
   * Maximum concurrent tasks per worker.
   * Defaults to 1 (each worker handles one batch at a time).
   */
  readonly concurrency?: number
}

// =============================================================================
// Live Implementation
// =============================================================================

/**
 * Create the TreeWorkerPool service using Effect Platform WorkerPool.
 */
const makeTreeWorkerPool = (config: TreeWorkerPoolConfig = {}) =>
  Effect.gen(function* () {
    const poolSize = config.size ?? (typeof navigator !== "undefined" ? navigator.hardwareConcurrency : 4) ?? 4

    // Create the worker pool
    const pool = yield* Worker.makePool<ApplyPatchesRequest, never, UITreeJSON>({
      size: poolSize,
      concurrency: config.concurrency ?? 1,
    })

    const applyPatches = (
      tree: UITree,
      patches: Chunk.Chunk<JsonPatch>
    ): Effect.Effect<UITree, Error> =>
      Effect.gen(function* () {
        if (Chunk.isEmpty(patches)) {
          return tree
        }

        const request: ApplyPatchesRequest = {
          tree: treeToJSON(tree),
          patches: Chunk.toReadonlyArray(patches).map(patchToJSON),
        }

        // Execute on pool - returns Stream, take first result
        const maybeResult = yield* pipe(
          pool.execute(request),
          Stream.runHead
        )

        const resultJSON = Option.getOrThrowWith(
          maybeResult,
          () => new Error("No result from worker")
        )

        return treeFromJSON(resultJSON)
      }).pipe(
        Effect.mapError((e) => e instanceof Error ? e : new Error(String(e)))
      )

    const applyStream = (
      initialTree: UITree,
      patches: Stream.Stream<JsonPatch, Error>,
      batchSize = 1  // Default 1 for immediate processing
    ): Stream.Stream<UITree, Error> =>
      Stream.scanEffect(
        Stream.grouped(patches, batchSize),
        initialTree,
        (tree, patchChunk) => applyPatches(tree, patchChunk)
      )

    const applyAll = (
      initialTree: UITree,
      patches: Stream.Stream<JsonPatch, Error>
    ): Effect.Effect<UITree, Error> =>
      Effect.gen(function* () {
        const allPatches = yield* Stream.runCollect(patches)
        return yield* applyPatches(initialTree, allPatches)
      })

    const stats = () =>
      Effect.succeed({
        size: poolSize,
        available: poolSize,
      })

    return {
      applyPatches,
      applyStream,
      applyAll,
      stats,
    } satisfies TreeWorkerPoolService
  })

// =============================================================================
// Layers
// =============================================================================

/**
 * Browser layer that provides BrowserWorker spawning.
 * Use this in browser environments.
 */
export const BrowserWorkerLayer = BrowserWorker.layer(() =>
  new globalThis.Worker(
    // @ts-ignore - import.meta.url works in Vite/browser, tsconfig doesn't recognize it
    new URL("./tree.worker.effect.ts", import.meta.url),
    { type: "module" }
  )
)

/**
 * Live layer for TreeWorkerPool in browser.
 * Provides pooled workers with default configuration.
 */
export const TreeWorkerPoolLive = Layer.scoped(
  TreeWorkerPool,
  makeTreeWorkerPool()
).pipe(Layer.provide(BrowserWorkerLayer))

/**
 * Live layer with custom configuration.
 */
export const TreeWorkerPoolLiveWithConfig = (config: TreeWorkerPoolConfig) =>
  Layer.scoped(
    TreeWorkerPool,
    makeTreeWorkerPool(config)
  ).pipe(Layer.provide(BrowserWorkerLayer))

// =============================================================================
// Fallback (Main Thread)
// =============================================================================

/**
 * Fallback implementation that runs on main thread.
 * For environments without worker support.
 */
const makeTreeWorkerPoolFallback = Effect.gen(function* () {
  const { applyPatch } = yield* Effect.promise(() =>
    import("../core/streaming").then((m) => ({
      applyPatch: m.applyPatch,
    }))
  )

  const applyPatches = (
    tree: UITree,
    patches: Chunk.Chunk<JsonPatch>
  ): Effect.Effect<UITree, Error> =>
    Effect.gen(function* () {
      let current = tree
      for (const patch of patches) {
        current = yield* applyPatch(current, patch)
      }
      return current
    })

  const applyStream = (
    initialTree: UITree,
    patches: Stream.Stream<JsonPatch, Error>,
    batchSize = 1  // Default 1 for immediate processing; future: dynamic batching by component boundaries
  ): Stream.Stream<UITree, Error> =>
    Stream.scanEffect(
      Stream.grouped(patches, batchSize),
      initialTree,
      (tree, patchChunk) => applyPatches(tree, patchChunk)
    )

  const applyAll = (
    initialTree: UITree,
    patches: Stream.Stream<JsonPatch, Error>
  ): Effect.Effect<UITree, Error> =>
    Effect.gen(function* () {
      // Collect ALL patches from stream into single Chunk
      const allPatches = yield* Stream.runCollect(patches)
      // Single call with all patches - no batching
      return yield* applyPatches(initialTree, allPatches)
    })

  const stats = () =>
    Effect.succeed({
      size: 0,
      available: 0,
    })

  return {
    applyPatches,
    applyStream,
    applyAll,
    stats,
  } satisfies TreeWorkerPoolService
})

export const TreeWorkerPoolFallback = Layer.effect(
  TreeWorkerPool,
  makeTreeWorkerPoolFallback
)

// =============================================================================
// Auto-selecting Layer
// =============================================================================

/**
 * Auto-selects pooled workers or fallback based on environment.
 * Uses Layer.scoped because Worker.makePool requires Scope for lifecycle management.
 */
export const TreeWorkerPoolAuto = Layer.scoped(
  TreeWorkerPool,
  Effect.gen(function* () {
    if (typeof window !== "undefined" && typeof Worker !== "undefined") {
      // Browser with Worker support - use pool
      return yield* makeTreeWorkerPool().pipe(
        Effect.provide(BrowserWorkerLayer)
      )
    }
    // Fallback for Node/Bun
    return yield* makeTreeWorkerPoolFallback
  })
)
