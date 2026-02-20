/**
 * Incremental Normalizer — per-element normalization for streaming pipeline
 *
 * Unlike batch `normalize()` which operates on full JSON blobs, the incremental
 * normalizer converts individual `RawComponentData` into `UIElement` as components
 * complete from the streaming graph. This enables progressive rendering.
 *
 * Pipeline position:
 *   d2ts tokenizer → graph callbacks → **normalizeElement()** → Atom.family → renderer
 *
 * @module genifer/core/incremental-normalize
 */
import { Effect, Option, HashMap, Atom } from 'effect'
import { UIElement, UITree } from './schemas.js'
import type { RawComponentData } from '../streaming/graph.js'
import { NormalizeError } from './normalize.js'

// =============================================================================
// Per-element normalization
// =============================================================================

/**
 * Convert a single RawComponentData into a UIElement.
 *
 * - Extracts type, key, children, parentKey from fields
 * - Everything else becomes props
 * - Auto-generates key from type + counter if missing
 * - Infers parentKey from the graph's depth/ancestry (passed via parentKey param)
 */
let autoKeyCounter = 0

export function normalizeElement(
  data: RawComponentData,
  parentKey: string | null = null,
): Effect.Effect<UIElement, NormalizeError> {
  return Effect.try({
    try: () => {
      const type = data.componentType
      if (!type) {
        throw new NormalizeError({
          stage: 'convert',
          message: 'RawComponentData has no componentType',
          context: data.fields,
        })
      }

      const key = data.elementKey ?? `${type.toLowerCase()}-auto-${++autoKeyCounter}`

      // Separate structural fields from props
      const { type: _t, _tag: _tag, key: _k, children: _c, ...props } = data.fields as Record<string, unknown>

      // Children: from the graph's childKeys (already resolved)
      const children = data.childKeys.length > 0 ? [...data.childKeys] : []

      return new UIElement({
        key,
        type,
        props: props as Record<string, unknown>,
        children,
        parentKey,
      })
    },
    catch: (e) =>
      e instanceof NormalizeError
        ? e
        : new NormalizeError({
            stage: 'convert',
            message: e instanceof Error ? e.message : String(e),
          }),
  })
}

/** Reset the auto-key counter (for testing) */
export function resetAutoKeyCounter(): void {
  autoKeyCounter = 0
}

// =============================================================================
// Quarantine Queue
// =============================================================================

export type QuarantineEntry = {
  readonly data: RawComponentData
  readonly error: NormalizeError
  readonly parentKey: string | null
  readonly attempt: number
  readonly timestamp: number
}

/**
 * Creates a quarantine queue for failed normalizations.
 * Failed elements get queued for post-stream repair attempt.
 */
export function createQuarantineQueue(maxRetries: number = 2) {
  const queue: QuarantineEntry[] = []

  return {
    /** Add a failed element to quarantine */
    enqueue(data: RawComponentData, error: NormalizeError, parentKey: string | null): void {
      queue.push({
        data,
        error,
        parentKey,
        attempt: 1,
        timestamp: Date.now(),
      })
    },

    /** Retry all quarantined elements. Returns [succeeded, stillFailed]. */
    retry(): Effect.Effect<{ recovered: UIElement[]; failed: QuarantineEntry[] }> {
      return Effect.gen(function* () {
        const recovered: UIElement[] = []
        const stillFailed: QuarantineEntry[] = []

        for (const entry of queue) {
          if (entry.attempt >= maxRetries) {
            stillFailed.push(entry)
            continue
          }

          const exit = yield* Effect.either(normalizeElement(entry.data, entry.parentKey))
          if (exit._tag === 'Right') {
            recovered.push(exit.right)
          } else {
            stillFailed.push({
              ...entry,
              error: exit.left,
              attempt: entry.attempt + 1,
            })
          }
        }

        // Replace queue with remaining failures
        queue.length = 0
        queue.push(...stillFailed)

        return { recovered, failed: stillFailed }
      })
    },

    /** Current queue size */
    get size(): number {
      return queue.length
    },

    /** Get all quarantined entries */
    get entries(): readonly QuarantineEntry[] {
      return queue
    },

    /** Clear the queue */
    clear(): void {
      queue.length = 0
    },
  }
}

// =============================================================================
// Incremental Tree Builder
// =============================================================================

/**
 * Creates an incremental tree builder that assembles UITree progressively
 * as components normalize from the streaming graph.
 *
 * Uses wave-front strategy: leaf components normalize first (depth-first
 * from graph's bottom-up completion order), parents incorporate childKeys
 * as they arrive.
 */
export function createIncrementalTreeBuilder() {
  let elements = HashMap.empty<string, UIElement>()
  let rootKey: string | null = null
  let elementCount = 0

  return {
    /**
     * Add a normalized element to the tree.
     * The first element added at depth 1 (or the last element overall) becomes root.
     */
    addElement(element: UIElement, depth: number): void {
      elements = HashMap.set(elements, element.key, element)
      elementCount++

      // Track root: the shallowest element (depth 1 = top-level object)
      if (depth <= 1 || rootKey === null) {
        rootKey = element.key
      }
    },

    /**
     * Build the current tree snapshot.
     * Can be called at any point for a partial tree.
     */
    snapshot(): UITree {
      return new UITree({
        root: rootKey ?? '',
        elements,
      })
    },

    /** Number of elements added so far */
    get size(): number {
      return elementCount
    },

    /** Current root key */
    get root(): string | null {
      return rootKey
    },

    /** Reset for a new stream */
    clear(): void {
      elements = HashMap.empty<string, UIElement>()
      rootKey = null
      elementCount = 0
    },
  }
}
