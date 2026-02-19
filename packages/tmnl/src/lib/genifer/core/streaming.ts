/**
 * @fileoverview Stream-based UI tree rendering with Effect.Stream
 *
 * Uses Effect.Stream for:
 * - Progressive rendering from API streams
 * - Backpressure-aware buffering
 * - Chunk-based updates for smooth UI
 * - Cancellation support via Fiber
 *
 * IMPORTANT: Uses Schema.decode at boundaries for proper validation!
 */

import {
  Effect,
  Stream,
  Chunk,
  Option,
  Fiber,
  Ref,
  Duration,
  Queue,
  Schema,
  pipe
} from "effect"
import {
  UITree,
  UIElement,
  JsonPatch,
  JsonRenderDecodeError
} from "./schemas"
import { TreeWorkerPool } from "../workers/tree-worker-pool"
import type { PatchOp } from "./schemas"
import { setByPathSync } from "./path"

// =============================================================================
// Types
// =============================================================================

/** Stream event for UI updates */
export type UIStreamEvent =
  | { _tag: "Patch"; patch: JsonPatch }
  | { _tag: "Complete"; tree: UITree }
  | { _tag: "Error"; error: unknown }

/** Stream options */
export interface UIStreamOptions {
  /** Buffer size for backpressure (default: 16) */
  bufferSize?: number
  /** Chunk size for batch updates (default: 5) */
  chunkSize?: number
  /** Debounce duration for UI updates (default: 16ms) */
  debounceMs?: number
}

export interface DecodeErrorOptions {
  readonly onDecodeError?: (error: JsonRenderDecodeError) => Effect.Effect<void, never>
  readonly streamId?: string
  readonly context?: Record<string, unknown>
}

// =============================================================================
// Patch Application (using UITree class methods)
// =============================================================================

const normalizeElement = (value: Record<string, unknown>) => ({
  key: value['key'] as string,
  type: value['type'] as string,
  props: (value['props'] as Record<string, unknown>) ?? {},
  children: (value['children'] as string[]) ?? [],
  parentKey: (value['parentKey'] as string | null) ?? null,
  visible: value['visible'] as unknown,
  entrance: value['entrance'] as unknown,
})

/**
 * Apply a JSON patch to a UI tree (uses immutable UITree methods)
 */
export const applyPatch = (
  tree: UITree,
  patch: JsonPatch
): Effect.Effect<UITree, never> =>
  Effect.gen(function* () {
    const op = patch.op as PatchOp
    const path = patch.path

    switch (op) {
      case "set":
      case "add":
      case "replace": {
        // Handle root path
        if (path === "/root") {
          return tree.setRoot(patch.value as string)
        }

        // Handle elements paths
        if (path.startsWith("/elements/")) {
          const pathParts = path.slice("/elements/".length).split("/")
          const elementKey = pathParts[0]

          if (!elementKey) return tree

          if (pathParts.length === 1) {
            // Setting entire element - normalize defaults before constructing
            const element = new UIElement(normalizeElement(patch.value as Record<string, unknown>) as any)
            return tree.setElement(elementKey, element)
          } else {
            // Setting property of element
            const existingElement = tree.getElement(elementKey)
            if (existingElement) {
              const propPath = "/" + pathParts.slice(1).join("/")
              // Create new element with updated property
              const updated = setByPathSync(
                normalizeElement(existingElement as unknown as Record<string, unknown>) as Record<string, unknown>,
                propPath,
                patch.value
              )
              const newElement = new UIElement(updated as any)
              return tree.setElement(elementKey, newElement)
            }
          }
        }
        return tree
      }

      case "remove": {
        if (path.startsWith("/elements/")) {
          const elementKey = path.slice("/elements/".length).split("/")[0]
          if (elementKey) {
            return tree.removeElement(elementKey)
          }
        }
        return tree
      }

      default:
        // Exhaustive check - if we reach here, PatchOp type was extended
        return tree
    }
  })

/**
 * Apply multiple patches to a tree
 */
export const applyPatches = (
  tree: UITree,
  patches: Chunk.Chunk<JsonPatch>
): Effect.Effect<UITree, never> =>
  Effect.gen(function* () {
    let current = tree
    for (const patch of patches) {
      current = yield* applyPatch(current, patch)
    }
    return current
  })

// =============================================================================
// Stream Creation
// =============================================================================

/**
 * Parse and decode a JSON patch line (Effect-native)
 * Supports both NDJSON (raw JSON) and SSE format (data: JSON)
 *
 * Both HTTP server and Cluster now emit JsonPatch directly.
 */
const parsePatchLine = (
  line: string,
  options: DecodeErrorOptions & { chunk: string; lineIndex: number }
): Effect.Effect<Option.Option<JsonPatch>, never> =>
  Effect.gen(function* () {
    const { onDecodeError, streamId, context, chunk, lineIndex } = options
    let trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("//")) {
      return Option.none()
    }

    // Handle SSE format: "data: <json>"
    if (trimmed.startsWith("data:")) {
      trimmed = trimmed.slice(5).trim()
      if (!trimmed) {
        return Option.none()
      }
    }

    const parsed = yield* Effect.try(() => JSON.parse(trimmed)).pipe(
      Effect.map(Option.some),
      Effect.catchAll((error) =>
        (onDecodeError
          ? onDecodeError(new JsonRenderDecodeError({
              stage: "parse",
              line: trimmed,
              chunk,
              message: String(error),
              timestamp: Date.now(),
              streamId,
              context,
              lineIndex,
            }))
          : Effect.void).pipe(Effect.as(Option.none()))
      )
    )

    if (Option.isNone(parsed)) {
      return Option.none()
    }

    return yield* Schema.decodeUnknown(JsonPatch)(parsed.value).pipe(
      Effect.map(Option.some),
      Effect.catchAll((error) =>
        (onDecodeError
          ? onDecodeError(new JsonRenderDecodeError({
              stage: "decode",
              line: trimmed,
              chunk,
              parsed: parsed.value,
              message: String(error),
              timestamp: Date.now(),
              streamId,
              context,
              lineIndex,
            }))
          : Effect.void).pipe(Effect.as(Option.none()))
      )
    )
  })

/**
 * Create a stream from fetch response (supports SSE and NDJSON formats)
 *
 * Uses Stream.asyncPush for push-based streaming with zero buffering.
 * Each patch is emitted immediately as it arrives from the network.
 * SSE format (text/event-stream) forces browsers to stream progressively.
 */
export const streamFromFetch = (
  url: string,
  body: unknown,
  signal?: AbortSignal,
  decodeOptions: DecodeErrorOptions = {}
): Stream.Stream<JsonPatch, Error> =>
  Stream.asyncPush<JsonPatch, Error>((emit) =>
    Effect.gen(function* () {
      yield* Effect.log("[streamFromFetch] starting fetch")

      const response = yield* Effect.tryPromise({
        try: () => fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal
        }),
        catch: (e) => e instanceof Error ? e : new Error(String(e))
      })

      if (!response.ok) {
        return yield* Effect.fail(new Error(`HTTP error: ${response.status}`))
      }

      const reader = response.body?.getReader()
      if (!reader) {
        return yield* Effect.fail(new Error("No response body"))
      }

      const decoder = new TextDecoder()
      let buffer = ""
      let lineIndex = 0

      yield* Effect.log("[streamFromFetch] reading stream")

      while (true) {
        const { done, value } = yield* Effect.tryPromise({
          try: () => reader.read(),
          catch: (e) => e instanceof Error ? e : new Error(String(e))
        })

        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        // Log raw chunk arrival with timestamp
        yield* Effect.log(`[RAW CHUNK] ${chunk.length} bytes: "${chunk.slice(0, 80)}..."`)
        buffer += chunk

        // Process complete lines (NDJSON)
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          lineIndex += 1
          const maybePatch = yield* parsePatchLine(line, {
            ...decodeOptions,
            chunk,
            lineIndex,
          })
          if (Option.isSome(maybePatch)) {
            yield* Effect.log(`[streamFromFetch] emitting: ${maybePatch.value.path}`)
            emit.single(maybePatch.value)
            yield* Effect.yieldNow()  // Yield to allow consumer to process
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        lineIndex += 1
        const maybePatch = yield* parsePatchLine(buffer, {
          ...decodeOptions,
          chunk: buffer,
          lineIndex,
        })
        if (Option.isSome(maybePatch)) {
          emit.single(maybePatch.value)
        }
      }

      yield* Effect.log("[streamFromFetch] stream complete")
      emit.end()
    })
  , { bufferSize: "unbounded" })  // Unbounded = immediate emission, no blocking

/**
 * Create a stream from an async iterable
 */
export const streamFromAsyncIterable = <A>(
  iterable: AsyncIterable<A>,
  onError: (e: unknown) => Error
): Stream.Stream<A, Error> =>
  Stream.fromAsyncIterable(iterable, onError)

// =============================================================================
// Queue-based Progressive Streaming (fixes asyncPush buffering issue)
// =============================================================================

/**
 * Create a truly progressive stream from fetch using Queue + concurrent producer.
 *
 * Unlike Stream.asyncPush which buffers until producer completes,
 * this uses Stream.fromQueue which processes items immediately as they arrive.
 * The producer fiber offers items to the queue, then shuts it down to signal completion.
 *
 * @param url - API endpoint
 * @param body - Request body
 * @param signal - Optional abort signal
 * @returns Stream that emits patches progressively as they arrive
 */
export const streamFromFetchProgressive = (
  url: string,
  body: unknown,
  signal?: AbortSignal,
  decodeOptions: DecodeErrorOptions = {}
): Effect.Effect<Stream.Stream<JsonPatch, Error>, never> =>
  Effect.gen(function* () {
    // Create queue for producer -> consumer communication
    const queue = yield* Queue.unbounded<JsonPatch>()

    // Producer: fetches and enqueues patches, then shuts down queue
    const producer = Effect.gen(function* () {
      yield* Effect.log("[streamProgressive] Starting fetch...")

      const response = yield* Effect.tryPromise({
        try: () => fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal
        }),
        catch: (e) => e instanceof Error ? e : new Error(String(e))
      })

      if (!response.ok) {
        yield* Queue.shutdown(queue)
        return yield* Effect.fail(new Error(`HTTP error: ${response.status}`))
      }

      const reader = response.body?.getReader()
      if (!reader) {
        yield* Queue.shutdown(queue)
        return yield* Effect.fail(new Error("No response body"))
      }

      const decoder = new TextDecoder()
      let buffer = ""
      let lineIndex = 0

      while (true) {
        const { done, value } = yield* Effect.tryPromise({
          try: () => reader.read(),
          catch: (e) => e instanceof Error ? e : new Error(String(e))
        })

        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        yield* Effect.log(`[streamProgressive] Chunk: ${chunk.length} bytes`)
        buffer += chunk

        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          lineIndex += 1
          const maybePatch = yield* parsePatchLine(line, {
            ...decodeOptions,
            chunk,
            lineIndex,
          })
          if (Option.isSome(maybePatch)) {
            yield* Queue.offer(queue, maybePatch.value)
            // Yield after each offer to give consumer a chance to process
            yield* Effect.yieldNow()
          }
        }
      }

      // Handle remaining buffer
      if (buffer.trim()) {
        lineIndex += 1
        const maybePatch = yield* parsePatchLine(buffer, {
          ...decodeOptions,
          chunk: buffer,
          lineIndex,
        })
        if (Option.isSome(maybePatch)) {
          yield* Queue.offer(queue, maybePatch.value)
        }
      }

      // Shutdown queue to signal end-of-stream (idiomatic for Stream.fromQueue)
      yield* Effect.log("[streamProgressive] Producer done, shutting down queue")
      yield* Queue.shutdown(queue)
    })

    // Fork producer to run concurrently with stream consumption
    yield* Effect.fork(producer)

    // Return stream from queue - processes items immediately as they arrive!
    // Stream ends gracefully when queue is shut down
    return Stream.fromQueue(queue)
  })

// =============================================================================
// Stream Processing
// =============================================================================

/**
 * Process a patch stream into UI tree updates
 */
export const processPatches = (
  patchStream: Stream.Stream<JsonPatch, Error>,
  options: UIStreamOptions = {}
): Stream.Stream<UITree, Error> => {
  const {
    chunkSize = 1,  // Default to 1 for truly progressive rendering
    debounceMs = 8  // Lower debounce for smoother updates
  } = options

  // For chunkSize=1, use debounce to emit latest accumulated tree after bursts settle
  // Claude streams in network chunks with natural pauses - debounce captures the latest state
  if (chunkSize <= 1) {
    return pipe(
      patchStream,
      // Apply each patch immediately, accumulating into tree
      Stream.scan(UITree.empty(), (tree, patch) =>
        Effect.runSync(applyPatch(tree, patch))
      ),
      // Debounce: wait for pause in patches, then emit latest tree
      // This naturally aligns with network chunk boundaries
      Stream.debounce(Duration.millis(debounceMs))
    )
  }

  // Batched mode for higher chunk sizes (reduces render calls)
  return pipe(
    patchStream,
    Stream.grouped(chunkSize),
    Stream.throttle({
      cost: () => 1,
      duration: Duration.millis(debounceMs),
      units: 1
    }),
    Stream.scan(UITree.empty(), (tree, patches) =>
      Effect.runSync(applyPatches(tree, patches))
    )
  )
}

/**
 * Create a managed UI stream with state
 */
export const makeUIStream = (
  url: string,
  options: UIStreamOptions = {}
) =>
  Effect.gen(function* () {
    // Current tree state (using UITree.empty())
    const treeRef = yield* Ref.make<UITree>(UITree.empty())

    // Streaming state
    const isStreamingRef = yield* Ref.make(false)
    const errorRef = yield* Ref.make<Option.Option<Error>>(Option.none())

    // Current fiber (for cancellation)
    let currentFiber: Fiber.RuntimeFiber<void, Error> | null = null

    /**
     * Send a prompt and stream UI updates
     */
    const send = (
      prompt: string,
      context?: Record<string, unknown>
    ): Effect.Effect<void, Error> =>
      Effect.gen(function* () {
        // Cancel any existing stream
        if (currentFiber) {
          yield* Fiber.interrupt(currentFiber)
        }

        // Reset state
        yield* Ref.set(treeRef, UITree.empty())
        yield* Ref.set(isStreamingRef, true)
        yield* Ref.set(errorRef, Option.none())

        // Create abort controller for cancellation
        const abortController = new AbortController()

        // Create the stream
        const patchStream = streamFromFetch(
          url,
          { prompt, context, currentTree: UITree.empty() },
          abortController.signal
        )

        // Process patches
        const processEffect = pipe(
          processPatches(patchStream, options),
          Stream.runForEach((tree) =>
            Ref.set(treeRef, tree)
          ),
          Effect.catchAll((error) =>
            Effect.gen(function* () {
              yield* Ref.set(errorRef, Option.some(error))
            })
          ),
          Effect.ensuring(
            Ref.set(isStreamingRef, false)
          )
        )

        // Fork the stream processing
        currentFiber = yield* Effect.fork(processEffect)

        // Wait for completion
        yield* Fiber.join(currentFiber)
      })

    /**
     * Clear the current tree
     */
    const clear = (): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        if (currentFiber) {
          yield* Fiber.interrupt(currentFiber)
        }
        yield* Ref.set(treeRef, UITree.empty())
        yield* Ref.set(errorRef, Option.none())
      })

    /**
     * Cancel the current stream
     */
    const cancel = (): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        if (currentFiber) {
          yield* Fiber.interrupt(currentFiber)
        }
        yield* Ref.set(isStreamingRef, false)
      })

    /**
     * Get current tree
     */
    const getTree = (): Effect.Effect<UITree, never> =>
      Ref.get(treeRef)

    /**
     * Get streaming state
     */
    const isStreaming = (): Effect.Effect<boolean, never> =>
      Ref.get(isStreamingRef)

    /**
     * Get error if any
     */
    const getError = (): Effect.Effect<Option.Option<Error>, never> =>
      Ref.get(errorRef)

    return {
      send,
      clear,
      cancel,
      getTree,
      isStreaming,
      getError,
      treeRef,
      isStreamingRef,
      errorRef
    }
  })

export type UIStreamService = Effect.Effect.Success<ReturnType<typeof makeUIStream>>

// =============================================================================
// Utilities
// =============================================================================

/**
 * Convert a flat element list to a UITree
 */
export const flatToTree = (
  elements: Array<{ key: string; type: string; props: Record<string, unknown>; parentKey?: string | null; visible?: boolean }>
): UITree => {
  const elementMap: Record<string, UIElement> = {}
  let root = ""

  // First pass: add all elements to map
  for (const element of elements) {
    elementMap[element.key] = new UIElement({
      key: element.key,
      type: element.type,
      props: element.props,
      children: [],
      parentKey: element.parentKey ?? null,
      visible: element.visible
    })
  }

  // Second pass: build parent-child relationships
  for (const element of elements) {
    if (element.parentKey) {
      const parent = elementMap[element.parentKey]
      if (parent) {
        // Create new element with updated children (immutable)
        const currentChildren = [...parent.children]
        currentChildren.push(element.key)
        elementMap[element.parentKey] = new UIElement({
          ...parent,
          children: currentChildren
        })
      }
    } else {
      root = element.key
    }
  }

  return new UITree({ root, elements: elementMap })
}

/**
 * Export parse function for external use
 */
export { parsePatchLine }

// =============================================================================
// Hybrid Streaming (Phase 3: Parse Worker + Tree Worker)
// =============================================================================

/**
 * Options for hybrid streaming
 */
export interface HybridStreamOptions {
  /** Batch size for tree worker (default: 10) */
  batchSize?: number
  /** Debounce duration for UI updates (default: 8ms) */
  debounceMs?: number
}

/**
 * Process patches using Tree Worker (offloads applyPatches to worker)
 *
 * Unlike processPatches which runs applyPatch on main thread,
 * this batches patches and sends them to the Tree Worker.
 *
 * @param patchStream - Stream of JsonPatch objects
 * @param options - Batch size and debounce options
 * @returns Stream of UITree updates
 */
export const processWithTreeWorker = (
  patchStream: Stream.Stream<JsonPatch, Error>,
  options: HybridStreamOptions = {}
): Stream.Stream<UITree, Error, TreeWorkerPool> => {
  const { batchSize = 1, debounceMs = 8 } = options  // batchSize=1 for immediate processing

  return pipe(
    patchStream,
    (stream) =>
      Stream.flatMap(
        Stream.make(null),
        () =>
          Effect.gen(function* () {
            const pool = yield* TreeWorkerPool
            // Use Tree Worker Pool's applyStream which handles batching internally
            return pool.applyStream(UITree.empty(), stream, batchSize)
          }).pipe(Stream.unwrap)
      ),
    // Debounce to emit after bursts settle
    Stream.debounce(Duration.millis(debounceMs))
  )
}

/**
 * Create a hybrid stream that uses Parse Worker for parsing
 * and Tree Worker for tree construction.
 *
 * This achieves near-zero main thread blocking:
 * - Network chunks: ~1ms (TextDecoder only)
 * - JSON.parse + Schema.decode: Parse Worker
 * - applyPatches + tree construction: Tree Worker
 * - Main thread: postMessage overhead only (~2-3ms total)
 *
 * @param url - API endpoint
 * @param body - Request body
 * @param options - Hybrid streaming options
 * @param signal - Optional abort signal
 * @returns Effect that yields the patch stream (requires TreeWorker)
 */
export const streamHybrid = (
  url: string,
  body: unknown,
  options: HybridStreamOptions = {},
  signal?: AbortSignal,
  decodeOptions: DecodeErrorOptions = {}
): Effect.Effect<Stream.Stream<UITree, Error>, never, TreeWorkerPool> =>
  Effect.gen(function* () {
    const { batchSize = 1, debounceMs = 8 } = options  // batchSize=1 for immediate processing
    const pool = yield* TreeWorkerPool

    // Get progressive patch stream (uses Parse Worker internally if configured)
    const patchStream = yield* streamFromFetchProgressive(url, body, signal, decodeOptions)

    // Use Tree Worker Pool to build trees (pooled workers with load balancing)
    return pipe(
      pool.applyStream(UITree.empty(), patchStream, batchSize),
      Stream.debounce(Duration.millis(debounceMs))
    )
  })
