/**
 * useUIStreamCluster - HTTP transport variant using EntityProxy API
 *
 * Provides the same interface as useUIStream for drop-in A/B testing.
 * Uses HTTP fetch to EntityProxy endpoints instead of direct cursor server.
 *
 * Key differences from useUIStream:
 * - Uses EntityProxy HTTP API (cluster node) at configurable baseUrl
 * - Same NDJSON streaming protocol as cursor server
 * - Card-scoped: each card routes to a specific entity in the cluster
 *
 * EntityProxy Endpoint: POST /cards/stream-ui-generate/:entityId
 *
 * @module json-render/react/useUIStreamCluster
 */

"use client"

import { useCallback, useEffect, useContext } from "react"
import { useAtomValue, RegistryContext } from "@effect-atom/atom-react"
import { Atom } from "@effect-atom/atom"
import { Effect, Fiber, Option, pipe, Stream } from "effect"
import type { RuntimeFiber } from "effect/Fiber"

import { UITree } from "../core/schemas"
import { processPatches, streamFromFetchProgressive, streamHybrid } from "../core/streaming"
import { TreeWorkerPoolAuto } from "../workers"
import {
  decodeErrorStreamIdsAtom,
  decodeErrorsFamily,
  registerDecodeErrorStreamId
} from "./atoms"

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Default EntityProxy base URL (cluster node on port 8100)
 */
export const DEFAULT_CLUSTER_BASE_URL = "http://localhost:8100"

// =============================================================================
// Cluster-specific Atoms (isolated from HTTP mode atoms)
// =============================================================================

/** Tree state for cluster mode */
export const clusterTreeAtom = Atom.make<UITree>(UITree.empty())

/** Streaming state for cluster mode */
export const clusterIsStreamingAtom = Atom.make<boolean>(false)

/** Error state for cluster mode */
export const clusterErrorAtom = Atom.make<Option.Option<Error>>(Option.none())

/** Current fiber for cluster mode (for cancellation) */
export const clusterStreamFiberAtom = Atom.make<Option.Option<RuntimeFiber<void, Error>>>(Option.none())

// =============================================================================
// Hook Types (matching useUIStream interface)
// =============================================================================

export interface UseUIStreamClusterOptions {
  /**
   * Card ID for entity routing
   * This becomes the entityId in the URL: /cards/stream-ui-generate/:entityId
   */
  cardId: string
  /**
   * Base URL for the cluster EntityProxy API
   * @default "http://localhost:8100"
   */
  baseUrl?: string
  /**
   * Use hybrid mode (Tree Worker for near-zero main thread blocking)
   * @default false
   */
  hybrid?: boolean
  /**
   * Batch size for tree worker (only applies when hybrid=true)
   * @default 10
   */
  batchSize?: number
  /** Callback when stream completes */
  onComplete?: (tree: UITree) => void
  /** Callback on error */
  onError?: (error: Error) => void
}

export interface UseUIStreamClusterReturn {
  /** Current UI tree */
  tree: UITree
  /** Whether currently streaming */
  isStreaming: boolean
  /** Error if any */
  error: Option.Option<Error>
  /** Send a prompt to generate UI */
  send: (prompt: string, context?: Record<string, unknown>) => void
  /** Clear the current tree */
  clear: () => void
  /** Cancel current stream */
  cancel: () => void
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for streaming UI generation via Effect Cluster EntityProxy
 *
 * Drop-in replacement for useUIStream with same interface.
 * Uses HTTP fetch to EntityProxy endpoints at the cluster node.
 *
 * @example
 * ```tsx
 * const result = useUIStreamCluster({
 *   cardId: 'my-card',
 *   baseUrl: 'http://localhost:8100', // cluster EntityProxy
 * })
 *
 * // Send prompt
 * result.send('Create a dashboard with metrics')
 *
 * // Render tree
 * <JsonRenderer tree={result.tree} />
 * ```
 */
export function useUIStreamCluster({
  cardId,
  baseUrl = DEFAULT_CLUSTER_BASE_URL,
  hybrid = false,
  batchSize = 1,
  onComplete,
  onError,
}: UseUIStreamClusterOptions): UseUIStreamClusterReturn {
  const registry = useContext(RegistryContext)
  const streamId = `ui-stream:cluster:${cardId}`

  // Read reactive state via atoms
  const tree = useAtomValue(clusterTreeAtom)
  const isStreaming = useAtomValue(clusterIsStreamingAtom)
  const error = useAtomValue(clusterErrorAtom)

  /**
   * Construct the EntityProxy API endpoint for UI generation
   * Format: POST /cards/stream-ui-generate/:entityId
   */
  const getApiEndpoint = useCallback(() => {
    return `${baseUrl}/cards/stream-ui-generate/${encodeURIComponent(cardId)}`
  }, [baseUrl, cardId])

  /**
   * Send a prompt and stream UI updates via EntityProxy HTTP
   */
  const send = useCallback(
    (prompt: string, context?: Record<string, unknown>) => {
      // Cancel any existing stream
      const existingFiber = registry.get(clusterStreamFiberAtom) as Option.Option<RuntimeFiber<void, Error>>
      if (Option.isSome(existingFiber)) {
        Effect.runFork(Fiber.interrupt(existingFiber.value))
      }

      // Reset state
      registry.set(clusterTreeAtom, UITree.empty())
      registry.set(clusterIsStreamingAtom, true)
      registry.set(clusterErrorAtom, Option.none())
      registry.set(decodeErrorStreamIdsAtom, registerDecodeErrorStreamId(
        registry.get(decodeErrorStreamIdsAtom) as Set<string>,
        streamId
      ))
      registry.set(decodeErrorsFamily(streamId), [])

      // Create AbortController for fetch cancellation
      const abortController = new AbortController()

      // Get the EntityProxy endpoint
      const api = getApiEndpoint()

      // Build EntityProxy payload (matches CardEntity.UIGeneratePayload schema)
      const entityProxyPayload = {
        cardId,
        operationId: crypto.randomUUID(),
        prompt,
        catalog: "default",
        context,
      }

      // Create the stream processing effect
      const streamEffect = Effect.gen(function* () {
        let treeStream: Stream.Stream<UITree, Error>

        if (hybrid) {
          // Hybrid mode: use Tree Worker for near-zero main thread blocking
          treeStream = yield* streamHybrid(
            api,
            entityProxyPayload,
            { batchSize },
            abortController.signal,
            {
              streamId,
              context: { prompt, transport: "cluster", cardId },
              onDecodeError: (error) =>
                Effect.sync(() => {
                  const current = registry.get(decodeErrorsFamily(streamId)) as Array<typeof error>
                  registry.set(decodeErrorsFamily(streamId), [...current, error])
                }),
            }
          )
        } else {
          // Standard mode: process patches on main thread
          const patchStream = yield* streamFromFetchProgressive(
            api,
            entityProxyPayload,
            abortController.signal,
            {
              streamId,
              context: { prompt, transport: "cluster", cardId },
              onDecodeError: (error) =>
                Effect.sync(() => {
                  const current = registry.get(decodeErrorsFamily(streamId)) as Array<typeof error>
                  registry.set(decodeErrorsFamily(streamId), [...current, error])
                }),
            }
          )
          treeStream = processPatches(patchStream)
        }

        // Update atom on each tree update
        yield* pipe(
          treeStream,
          Stream.runForEach((newTree) =>
            Effect.gen(function* () {
              registry.set(clusterTreeAtom, newTree)
              // Use setTimeout(0) macrotask to truly yield to browser event loop
              yield* Effect.promise(() => new Promise<void>(r => setTimeout(r, 0)))
            })
          )
        )

        // Get final tree for callback
        const finalTree = registry.get(clusterTreeAtom) as UITree
        onComplete?.(finalTree)
      }).pipe(
        Effect.catchAll((err) =>
          Effect.sync(() => {
            const e = err instanceof Error ? err : new Error(String(err))
            registry.set(clusterErrorAtom, Option.some(e))
            onError?.(e)
          })
        ),
        Effect.ensuring(
          Effect.sync(() => {
            registry.set(clusterIsStreamingAtom, false)
            registry.set(clusterStreamFiberAtom, Option.none())
          })
        ),
        // Always provide TreeWorkerPool layer (it's lazy - won't create pool unless needed)
        Effect.provide(TreeWorkerPoolAuto)
      )

      // Fork the stream processing
      const fiber = Effect.runFork(streamEffect) as RuntimeFiber<void, Error>
      registry.set(clusterStreamFiberAtom, Option.some(fiber))
    },
    [getApiEndpoint, onComplete, onError, registry, hybrid, batchSize]
  )

  /**
   * Clear the current tree
   */
  const clear = useCallback(() => {
    const existingFiber = registry.get(clusterStreamFiberAtom) as Option.Option<RuntimeFiber<void, Error>>
    if (Option.isSome(existingFiber)) {
      Effect.runFork(Fiber.interrupt(existingFiber.value))
    }

    registry.set(clusterTreeAtom, UITree.empty())
    registry.set(clusterErrorAtom, Option.none())
    registry.set(clusterStreamFiberAtom, Option.none())
  }, [registry])

  /**
   * Cancel current stream
   */
  const cancel = useCallback(() => {
    const existingFiber = registry.get(clusterStreamFiberAtom) as Option.Option<RuntimeFiber<void, Error>>
    if (Option.isSome(existingFiber)) {
      Effect.runFork(Fiber.interrupt(existingFiber.value))
    }
    registry.set(clusterIsStreamingAtom, false)
    registry.set(clusterStreamFiberAtom, Option.none())
  }, [registry])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const existingFiber = registry.get(clusterStreamFiberAtom) as Option.Option<RuntimeFiber<void, Error>>
      if (Option.isSome(existingFiber)) {
        Effect.runFork(Fiber.interrupt(existingFiber.value))
      }
    }
  }, [registry])

  return {
    tree,
    isStreaming,
    error,
    send,
    clear,
    cancel,
  }
}
