/**
 * Tree Worker API
 *
 * Effect-wrapped API for the Tree Worker.
 * Provides type-safe communication with the worker.
 *
 * @module genifer/workers/tree-worker-api
 */

import { Effect, Stream, Deferred, Ref, Layer, Context, Chunk, HashMap } from "effect"
import { UITree, UIElement, JsonPatch } from "../core/schemas"
import type {
  ApplyPatchesRequest,
  ApplyPatchesResponse,
} from "./tree.worker"

// =============================================================================
// JSON Serialization Types (for worker communication)
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

// =============================================================================
// Serialization Helpers
// =============================================================================

/**
 * Convert UITree class instance to plain JSON for postMessage.
 * Iterates HashMap entries → plain Record for structured clone.
 */
const treeToJSON = (tree: UITree): UITreeJSON => {
  const elements: Record<string, UIElementJSON> = {}
  for (const [key, el] of tree.elements) {
    elements[key] = {
      key: el.key,
      type: el.type,
      props: el.props as Record<string, unknown>,
      children: [...el.children],
      parentKey: el.parentKey,
      visible: el.visible,
      entrance: el.entrance,
    }
  }
  return { root: tree.root, elements }
}

/**
 * Convert plain JSON back to UITree class instance.
 * Record → HashMap via fromIterable.
 */
const treeFromJSON = (json: UITreeJSON): UITree =>
  UITree.fromRecord(
    json.root,
    Object.fromEntries(
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
    )
  )

/**
 * Convert JsonPatch to plain JSON
 */
const patchToJSON = (patch: JsonPatch): { op: string; path: string; value?: unknown } => ({
  op: patch.op,
  path: patch.path,
  value: patch.value,
})

// =============================================================================
// Types
// =============================================================================

export interface TreeWorkerService {
  /**
   * Apply multiple patches to a tree
   */
  readonly applyPatches: (
    tree: UITree,
    patches: Chunk.Chunk<JsonPatch>
  ) => Effect.Effect<UITree, Error>

  /**
   * Create a stream that applies patches as they arrive
   * Batches patches for efficiency (amortizes postMessage overhead)
   */
  readonly applyStream: (
    initialTree: UITree,
    patches: Stream.Stream<JsonPatch, Error>,
    batchSize?: number
  ) => Stream.Stream<UITree, Error>

  /**
   * Terminate the worker
   */
  readonly terminate: () => Effect.Effect<void>
}

// =============================================================================
// Service Tag
// =============================================================================

export class TreeWorker extends Context.Tag("TreeWorker")<
  TreeWorker,
  TreeWorkerService
>() {}

// =============================================================================
// Implementation
// =============================================================================

const makeTreeWorker = Effect.gen(function* () {
  // Track pending requests
  const pendingRef = yield* Ref.make<Map<number, Deferred.Deferred<UITree, Error>>>(
    new Map()
  )
  const idRef = yield* Ref.make(0)

  // Create worker
  let worker: Worker | null = null

  const getWorker = Effect.gen(function* () {
    if (worker) return worker

    // Browser/Vite environment
    if (typeof window !== "undefined") {
      // @ts-ignore - import.meta.url works in Vite, tsconfig doesn't recognize it
      worker = new Worker(
        new URL("./tree.worker.ts", import.meta.url),
        { type: "module" }
      )
    } else {
      // Node/Bun environment - use Worker from worker_threads
      return yield* Effect.fail(new Error("Workers not supported in this environment"))
    }

    // Set up message handler
    worker.onmessage = (event: MessageEvent<ApplyPatchesResponse | { type: "ready" }>) => {
      if (event.data.type === "ready") {
        return
      }

      const response = event.data as ApplyPatchesResponse
      Effect.runSync(
        Effect.gen(function* () {
          const pending = yield* Ref.get(pendingRef)
          const deferred = pending.get(response.id)
          if (deferred) {
            pending.delete(response.id)
            yield* Ref.set(pendingRef, pending)
            // Convert JSON back to UITree class
            const tree = treeFromJSON(response.tree)
            yield* Deferred.succeed(deferred, tree)
          }
        })
      )
    }

    worker.onerror = (error) => {
      console.error("[TreeWorker] Error:", error)
    }

    return worker
  })

  const applyPatches = (
    tree: UITree,
    patches: Chunk.Chunk<JsonPatch>
  ): Effect.Effect<UITree, Error> =>
    Effect.gen(function* () {
      // Fast path: no patches = return same tree
      if (Chunk.isEmpty(patches)) {
        return tree
      }

      const w = yield* getWorker
      const id = yield* Ref.updateAndGet(idRef, (n) => n + 1)
      const deferred = yield* Deferred.make<UITree, Error>()

      yield* Ref.update(pendingRef, (map) => {
        map.set(id, deferred)
        return map
      })

      const request: ApplyPatchesRequest = {
        type: "applyPatches",
        id,
        tree: treeToJSON(tree),
        patches: Chunk.toReadonlyArray(patches).map(patchToJSON) as ApplyPatchesRequest["patches"],
      }
      w.postMessage(request)

      const result = yield* Deferred.await(deferred).pipe(
        Effect.timeout("5 seconds"),
        Effect.catchTag("TimeoutException", () =>
          Effect.fail(new Error("Worker timeout"))
        )
      )

      return result
    })

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

  const terminate = (): Effect.Effect<void> =>
    Effect.sync(() => {
      if (worker) {
        worker.terminate()
        worker = null
      }
    })

  return {
    applyPatches,
    applyStream,
    terminate,
  } satisfies TreeWorkerService
})

// =============================================================================
// Layer
// =============================================================================

export const TreeWorkerLive = Layer.scoped(
  TreeWorker,
  Effect.gen(function* () {
    const service = yield* makeTreeWorker
    yield* Effect.addFinalizer(() => service.terminate())
    return service
  })
)

// =============================================================================
// Fallback (no worker, main thread)
// =============================================================================

/**
 * Fallback implementation that runs on main thread.
 * Useful for environments without worker support or for comparison benchmarks.
 */
export const makeTreeWorkerFallback = Effect.gen(function* () {
  // Import applyPatch dynamically to avoid circular deps
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
    batchSize = 1  // Default 1 for immediate processing
  ): Stream.Stream<UITree, Error> =>
    Stream.scanEffect(
      Stream.grouped(patches, batchSize),
      initialTree,
      (tree, patchChunk) => applyPatches(tree, patchChunk)
    )

  const terminate = (): Effect.Effect<void> => Effect.void

  return {
    applyPatches,
    applyStream,
    terminate,
  } satisfies TreeWorkerService
})

export const TreeWorkerFallback = Layer.effect(TreeWorker, makeTreeWorkerFallback)

// =============================================================================
// Auto-selecting Layer
// =============================================================================

/**
 * Auto-selects worker or fallback based on environment.
 * Uses worker in browser, fallback in Node/Bun.
 */
export const TreeWorkerAuto = Layer.effect(
  TreeWorker,
  Effect.gen(function* () {
    if (typeof window !== "undefined" && typeof Worker !== "undefined") {
      return yield* makeTreeWorker
    }
    return yield* makeTreeWorkerFallback
  })
)
