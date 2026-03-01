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
 * - Stream isolation via Atom.family (same system as useUIStream)
 *
 * EntityProxy Endpoint: POST /cards/stream-ui-generate/:entityId
 *
 * @module genifer/react/useUIStreamCluster
 */

"use client"

import { useCallback, useEffect, useContext, useMemo } from "react"
import { useAtomValue, RegistryContext } from "@effect-atom/atom-react"
import { Effect, Fiber, Option, pipe, Stream } from "effect"
import type { RuntimeFiber } from "effect/Fiber"

import { UITree } from "../core/schemas"
import { processPatches, streamFromFetchProgressive, streamHybrid } from "../core/streaming"
import { TreeWorkerPoolAuto } from "../workers/tree-worker-pool"
import {
  decodeErrorStreamIdsAtom,
  registerDecodeErrorStreamId,
  getStreamAtoms,
  type StreamAtoms,
} from "./atoms"

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Default EntityProxy base URL (cluster node on port 8100)
 */
export const DEFAULT_CLUSTER_BASE_URL = "http://localhost:8100"

// =============================================================================
// Legacy Singleton Atoms (DEPRECATED — kept for backward compatibility)
// =============================================================================
// These forward to the family system under a well-known key.
// Existing code that imports these will keep working but is NOT concurrent-safe.
// Migrate to useUIStreamCluster({ cardId: ... }) which is family-backed.

import { Atom } from "@effect-atom/atom"
import {
  streamTreeFamily,
  streamIsStreamingFamily,
  streamErrorFamily,
  streamFiberFamily,
} from "./atoms"

const LEGACY_CLUSTER_KEY = "__legacy_cluster__"

/** @deprecated Use family-backed atoms via getStreamAtoms() */
export const clusterTreeAtom = streamTreeFamily(LEGACY_CLUSTER_KEY)
/** @deprecated Use family-backed atoms via getStreamAtoms() */
export const clusterIsStreamingAtom = streamIsStreamingFamily(LEGACY_CLUSTER_KEY)
/** @deprecated Use family-backed atoms via getStreamAtoms() */
export const clusterErrorAtom = streamErrorFamily(LEGACY_CLUSTER_KEY)
/** @deprecated Use family-backed atoms via getStreamAtoms() */
export const clusterStreamFiberAtom = streamFiberFamily(LEGACY_CLUSTER_KEY)

// =============================================================================
// Hook Types
// =============================================================================

export interface UseUIStreamClusterOptions {
  /**
   * Card ID for entity routing.
   * This becomes the entityId in the URL: /cards/stream-ui-generate/:entityId
   * Also used as the stream isolation key.
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
  /** The stream atoms bundle for this instance */
  atoms: StreamAtoms
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for streaming UI generation via Effect Cluster EntityProxy.
 *
 * Concurrent-safe via Atom.family keyed by `cardId`.
 * Multiple cards can stream simultaneously without state corruption.
 *
 * @example
 * ```tsx
 * const result = useUIStreamCluster({
 *   cardId: 'my-card',
 *   baseUrl: 'http://localhost:8100',
 * })
 * result.send('Create a dashboard with metrics')
 * <Renderer tree={result.tree} />
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

  // Resolve the atom family bundle — scoped to this card
  const atoms = useMemo(() => getStreamAtoms(streamId), [streamId])

  // Read reactive state from family atoms
  const tree = useAtomValue(atoms.tree)
  const isStreaming = useAtomValue(atoms.isStreaming)
  const error = useAtomValue(atoms.error)

  const interruptFiber = useCallback(() => {
    const existingFiber = registry.get(atoms.fiber) as Option.Option<RuntimeFiber<void, Error>>
    if (Option.isSome(existingFiber)) {
      Effect.runFork(Fiber.interrupt(existingFiber.value))
    }
  }, [registry, atoms.fiber])

  const getApiEndpoint = useCallback(() => {
    return `${baseUrl}/cards/stream-ui-generate/${encodeURIComponent(cardId)}`
  }, [baseUrl, cardId])

  const send = useCallback(
    (prompt: string, context?: Record<string, unknown>) => {
      interruptFiber()

      // Reset THIS card's state
      registry.set(atoms.tree, UITree.empty())
      registry.set(atoms.isStreaming, true)
      registry.set(atoms.error, Option.none())
      registry.set(atoms.decodeErrors, [])

      registry.set(decodeErrorStreamIdsAtom, registerDecodeErrorStreamId(
        registry.get(decodeErrorStreamIdsAtom) as Set<string>,
        streamId
      ))

      const abortController = new AbortController()
      const api = getApiEndpoint()

      const entityProxyPayload = {
        cardId,
        operationId: crypto.randomUUID(),
        prompt,
        catalog: "default",
        context,
      }

      const streamEffect = Effect.gen(function* () {
        let treeStream: Stream.Stream<UITree, Error>

        const errorTracking = {
          streamId,
          context: { prompt, transport: "cluster" as const, cardId },
          onDecodeError: (decodeError: any) =>
            Effect.sync(() => {
              const current = registry.get(atoms.decodeErrors) as Array<any>
              registry.set(atoms.decodeErrors, [...current, decodeError])
            }),
        }

        if (hybrid) {
          treeStream = yield* streamHybrid(
            api,
            entityProxyPayload,
            { batchSize },
            abortController.signal,
            errorTracking,
          )
        } else {
          const patchStream = yield* streamFromFetchProgressive(
            api,
            entityProxyPayload,
            abortController.signal,
            errorTracking,
          )
          treeStream = processPatches(patchStream)
        }

        yield* pipe(
          treeStream,
          Stream.runForEach((newTree) =>
            Effect.gen(function* () {
              registry.set(atoms.tree, newTree)
              yield* Effect.promise(() => new Promise<void>(r => setTimeout(r, 0)))
            })
          )
        )

        const finalTree = registry.get(atoms.tree) as UITree
        onComplete?.(finalTree)
      }).pipe(
        Effect.catchAll((err) =>
          Effect.sync(() => {
            const e = err instanceof Error ? err : new Error(String(err))
            registry.set(atoms.error, Option.some(e))
            onError?.(e)
          })
        ),
        Effect.ensuring(
          Effect.sync(() => {
            registry.set(atoms.isStreaming, false)
            registry.set(atoms.fiber, Option.none())
          })
        ),
        Effect.provide(TreeWorkerPoolAuto)
      )

      const fiber = Effect.runFork(streamEffect) as RuntimeFiber<void, Error>
      registry.set(atoms.fiber, Option.some(fiber))
    },
    [getApiEndpoint, streamId, atoms, onComplete, onError, registry, hybrid, batchSize, interruptFiber]
  )

  const clear = useCallback(() => {
    interruptFiber()
    registry.set(atoms.tree, UITree.empty())
    registry.set(atoms.error, Option.none())
    registry.set(atoms.fiber, Option.none())
  }, [registry, atoms, interruptFiber])

  const cancel = useCallback(() => {
    interruptFiber()
    registry.set(atoms.isStreaming, false)
    registry.set(atoms.fiber, Option.none())
  }, [registry, atoms, interruptFiber])

  useEffect(() => {
    return () => {
      const existingFiber = registry.get(atoms.fiber) as Option.Option<RuntimeFiber<void, Error>>
      if (Option.isSome(existingFiber)) {
        Effect.runFork(Fiber.interrupt(existingFiber.value))
      }
    }
  }, [registry, atoms.fiber])

  return { tree, isStreaming, error, send, clear, cancel, atoms }
}
