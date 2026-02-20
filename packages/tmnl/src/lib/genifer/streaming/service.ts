/**
 * StreamingJsonService
 *
 * Effect.Service wrapping the d2ts streaming JSON graph with Atom-based state.
 * Uses Registry for imperative atom access (works in both React and test contexts).
 *
 * Pipeline: string chunks → tokenizer → d2ts graph → component identification → atoms
 *
 * @module genifer/streaming/service
 */

import * as Atom from '@effect-atom/atom/Atom'
import * as Registry from '@effect-atom/atom/Registry'
import { Option } from 'effect'
import {
  createStreamingGraph,
  type ComponentIdentification,
  type StreamingGraphCallbacks,
} from './graph.js'
import type { JSONToken } from './tokenizer.js'
import type { ValidationResult, ComponentRegistration } from './bfta.js'

// =============================================================================
// State Atoms (module-level, Atom-as-State pattern)
// =============================================================================

/**
 * Components identified so far in the current stream.
 */
export const identifiedComponentsAtom = Atom.make<readonly ComponentIdentification[]>([]).pipe(
  Atom.keepAlive,
)

/**
 * Whether the parser is actively receiving chunks.
 */
export const isParsingAtom = Atom.make(false).pipe(Atom.keepAlive)

/**
 * Token stream — all tokens emitted during this parse session.
 * Capped to prevent memory blowout on large payloads.
 */
const MAX_TOKEN_HISTORY = 2000
export const tokensAtom = Atom.make<readonly JSONToken[]>([]).pipe(Atom.keepAlive)

/**
 * Partial object fields being accumulated at each depth.
 * Key = depth, value = Record<fieldName, fieldValue>
 */
export const partialFieldsAtom = Atom.make<ReadonlyMap<number, Record<string, unknown>>>(
  new Map(),
).pipe(Atom.keepAlive)

/**
 * Stream error (if any).
 */
export const streamingErrorAtom = Atom.make<Option.Option<Error>>(Option.none()).pipe(
  Atom.keepAlive,
)

/**
 * Count of chunks processed in this session.
 */
export const chunkCountAtom = Atom.make(0).pipe(Atom.keepAlive)

/**
 * BFTA validation results emitted during streaming.
 */
export const validationResultsAtom = Atom.make<readonly ValidationResult[]>([]).pipe(
  Atom.keepAlive,
)

/**
 * BFTA validation errors (rejected nodes only).
 */
export const validationErrorsAtom = Atom.make<readonly ValidationResult[]>([]).pipe(
  Atom.keepAlive,
)

// =============================================================================
// Service
// =============================================================================

export type StreamingJsonServiceShape = {
  /** Feed a string chunk into the streaming parser. */
  feedChunk: (chunk: string) => void
  /** Flush any buffered partial tokens from the tokenizer. */
  flush: () => void
  /** Reset all state for a new parse session. */
  reset: () => void
  /** Current d2ts version counter (monotonic). */
  readonly version: number
  /** The registry used for atom access. */
  readonly registry: Registry.Registry
}

export type StreamingJsonServiceOptions = {
  /** Registry for atom state (default: new Registry.make()) */
  registry?: Registry.Registry
  /** Component registrations for BFTA validation. Omit to skip validation. */
  registrations?: readonly ComponentRegistration[]
}

// =============================================================================
// Partial field tracking
// =============================================================================

function createPartialFieldTracker(registry: Registry.Registry) {
  const partials = new Map<number, { fields: Record<string, unknown>; currentKey: string | null }>()

  function update(token: JSONToken) {
    switch (token._tag) {
      case 'ObjectStart': {
        const depth = token.depth + 1
        partials.set(depth, { fields: {}, currentKey: null })
        break
      }
      case 'ObjectEnd': {
        const depth = token.depth + 1
        partials.delete(depth)
        break
      }
      case 'Key': {
        const obj = partials.get(token.depth)
        if (obj) obj.currentKey = token.value
        break
      }
      case 'String':
      case 'Number':
      case 'Boolean':
      case 'Null': {
        const obj = partials.get(token.depth)
        if (obj && obj.currentKey) {
          const val =
            token._tag === 'String' ? token.value
              : token._tag === 'Number' ? token.value
              : token._tag === 'Boolean' ? token.value
              : null
          obj.fields[obj.currentKey] = val
          obj.currentKey = null
        }
        break
      }
    }

    // Snapshot to atom
    const snapshot = new Map<number, Record<string, unknown>>()
    for (const [depth, partial] of partials) {
      snapshot.set(depth, { ...partial.fields })
    }
    registry.set(partialFieldsAtom, snapshot)
  }

  function clear() {
    partials.clear()
  }

  return { update, clear }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Creates a StreamingJsonService instance bound to a Registry.
 *
 * In React: pass the Registry from context (or let the singleton create one).
 * In tests: pass `Registry.make()` for isolated atom state.
 *
 * Overloads:
 *   createStreamingJsonService() — default singleton registry, no BFTA
 *   createStreamingJsonService(registry) — custom registry, no BFTA
 *   createStreamingJsonService(options) — full options with optional BFTA
 */
export function createStreamingJsonService(
  registryOrOptions?: Registry.Registry | StreamingJsonServiceOptions,
): StreamingJsonServiceShape {
  const isOptions = registryOrOptions != null && typeof registryOrOptions === 'object' && 'registry' in registryOrOptions || (registryOrOptions != null && typeof registryOrOptions === 'object' && 'registrations' in registryOrOptions)
  const registry: Registry.Registry = isOptions
    ? (registryOrOptions as StreamingJsonServiceOptions).registry ?? Registry.make()
    : (registryOrOptions as Registry.Registry | undefined) ?? Registry.make()
  const registrations = isOptions
    ? (registryOrOptions as StreamingJsonServiceOptions).registrations
    : undefined

  const tracker = createPartialFieldTracker(registry)

  const callbacks: StreamingGraphCallbacks = {
    onComponentIdentified(id: ComponentIdentification) {
      const prev = registry.get(identifiedComponentsAtom)
      registry.set(identifiedComponentsAtom, [...prev, id])
    },
    onToken(token: JSONToken) {
      // Append to token history (capped)
      const prev = registry.get(tokensAtom)
      registry.set(
        tokensAtom,
        prev.length >= MAX_TOKEN_HISTORY ? [...prev.slice(-500), token] : [...prev, token],
      )
      // Update partial fields
      tracker.update(token)
    },
    onValidation(result) {
      const prev = registry.get(validationResultsAtom)
      registry.set(validationResultsAtom, [...prev, result])
      if (!result.accepted) {
        const prevErrors = registry.get(validationErrorsAtom)
        registry.set(validationErrorsAtom, [...prevErrors, result])
      }
    },
  }

  const graph = createStreamingGraph(
    registrations && registrations.length > 0
      ? { callbacks, registrations }
      : callbacks,
  )

  return {
    feedChunk(chunk: string) {
      if (!registry.get(isParsingAtom)) {
        registry.set(isParsingAtom, true)
      }
      registry.set(chunkCountAtom, registry.get(chunkCountAtom) + 1)

      try {
        graph.sendChunk(chunk)
      } catch (err) {
        registry.set(
          streamingErrorAtom,
          Option.some(err instanceof Error ? err : new Error(String(err))),
        )
      }
    },

    flush() {
      try {
        graph.flush()
      } catch (err) {
        registry.set(
          streamingErrorAtom,
          Option.some(err instanceof Error ? err : new Error(String(err))),
        )
      }
      registry.set(isParsingAtom, false)
    },

    reset() {
      graph.reset()
      tracker.clear()
      registry.set(identifiedComponentsAtom, [])
      registry.set(tokensAtom, [])
      registry.set(partialFieldsAtom, new Map())
      registry.set(streamingErrorAtom, Option.none())
      registry.set(chunkCountAtom, 0)
      registry.set(isParsingAtom, false)
      registry.set(validationResultsAtom, [])
      registry.set(validationErrorsAtom, [])
    },

    get version() {
      return graph.version
    },

    get registry() {
      return registry
    },
  }
}

// =============================================================================
// Singleton (for React context — uses a shared Registry)
// =============================================================================

let _instance: StreamingJsonServiceShape | null = null

/**
 * Get the singleton StreamingJsonService instance.
 * Creates one on first call with a default Registry.
 */
export function getStreamingJsonService(): StreamingJsonServiceShape {
  if (!_instance) {
    _instance = createStreamingJsonService()
  }
  return _instance
}
