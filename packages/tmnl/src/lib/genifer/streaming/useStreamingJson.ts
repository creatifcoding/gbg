/**
 * useStreamingJson
 *
 * React hook bridging StreamingJsonService atoms to components.
 * Subscribes to identified components and parsing state.
 *
 * @module genifer/streaming/useStreamingJson
 */

'use client'

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { Option } from 'effect'
import {
  identifiedComponentsAtom,
  isParsingAtom,
  streamingErrorAtom,
  chunkCountAtom,
  partialFieldsAtom,
  getStreamingJsonService,
  type StreamingJsonServiceShape,
} from './service.js'
import type { ComponentIdentification } from './graph.js'

// =============================================================================
// Types
// =============================================================================

export interface UseStreamingJsonReturn {
  /** Components identified so far (appended as stream progresses) */
  identifiedComponents: readonly ComponentIdentification[]
  /** Whether the parser is actively receiving chunks */
  isParsing: boolean
  /** Streaming error (if any) */
  error: Error | null
  /** Number of chunks processed */
  chunkCount: number
  /** Partial fields being accumulated at each depth */
  partialFields: ReadonlyMap<number, Record<string, unknown>>
  /** Feed a string chunk into the parser */
  feedChunk: (chunk: string) => void
  /** Flush buffered partial tokens */
  flush: () => void
  /** Reset all state for a new stream */
  reset: () => void
}

// =============================================================================
// Registry-based subscription helper
// =============================================================================

function useRegistryAtom<T>(service: StreamingJsonServiceShape, atom: any): T {
  const r = service.registry
  return useSyncExternalStore(
    (cb) => r.subscribe(atom, cb),
    () => r.get(atom) as T,
    () => r.get(atom) as T,
  )
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook for consuming the streaming JSON parser in React.
 *
 * Usage:
 * ```tsx
 * const { identifiedComponents, isParsing, feedChunk, flush, reset } = useStreamingJson()
 *
 * // In your SSE/fetch handler:
 * onChunk((chunk) => feedChunk(chunk))
 * onDone(() => flush())
 * ```
 */
export function useStreamingJson(): UseStreamingJsonReturn {
  const serviceRef = useRef<StreamingJsonServiceShape | null>(null)
  if (!serviceRef.current) {
    serviceRef.current = getStreamingJsonService()
  }
  const service = serviceRef.current

  // Subscribe to atoms via registry
  const identifiedComponents = useRegistryAtom<readonly ComponentIdentification[]>(
    service,
    identifiedComponentsAtom,
  )
  const isParsing = useRegistryAtom<boolean>(service, isParsingAtom)
  const errorOpt = useRegistryAtom<Option.Option<Error>>(service, streamingErrorAtom)
  const chunkCount = useRegistryAtom<number>(service, chunkCountAtom)
  const partialFields = useRegistryAtom<ReadonlyMap<number, Record<string, unknown>>>(
    service,
    partialFieldsAtom,
  )

  const error = Option.getOrNull(errorOpt)

  // Stable callbacks
  const feedChunk = useCallback(
    (chunk: string) => service.feedChunk(chunk),
    [service],
  )
  const flush = useCallback(() => service.flush(), [service])
  const reset = useCallback(() => service.reset(), [service])

  return {
    identifiedComponents,
    isParsing,
    error,
    chunkCount,
    partialFields,
    feedChunk,
    flush,
    reset,
  }
}
