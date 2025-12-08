/**
 * TMNL Indices Builder
 *
 * Effect.Stream composition for multi-source search.
 * Inspired by Consult's consult--async-pipeline pattern.
 *
 * @see assets/documents/IDEA-MILL.org IDEA-0005 for research
 */

import { Effect, Stream, pipe, Ref, Option } from "effect"
import type {
  SearchItem,
  SearchSource,
  MergedItem,
  IndicesConfig,
  NarrowState,
} from "./types"

// ─────────────────────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: Required<IndicesConfig> = {
  debounceMs: 100,
  concurrency: 10,
  includeHidden: false,
}

// ─────────────────────────────────────────────────────────────────────────────
// Source Stream Creation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a source's items to a stream with metadata injection
 */
const sourceToStream = <T extends SearchItem>(
  source: SearchSource<T>
): Stream.Stream<MergedItem<T>> => {
  const result = source.items()

  // Check if it's already a stream
  const isStream = (x: unknown): x is Stream.Stream<T> =>
    typeof x === "object" && x !== null && "_tag" in (x as object)

  const baseStream: Stream.Stream<T> = isStream(result)
    ? result
    : pipe(
        result as Effect.Effect<readonly T[]>,
        Effect.map((items) => Stream.fromIterable(items)),
        Stream.unwrap
      )

  // Inject source metadata into each item
  return pipe(
    baseStream,
    Stream.map(
      (item): MergedItem<T> => ({
        ...item,
        _source: source.id,
        _sourceName: source.name,
        _sourceIcon: source.icon,
        _sourceAccent: source.accent,
      })
    ),
    // Source isolation - failures don't crash the whole search
    Stream.catchAll((error) => {
      console.warn(`[indices] Source "${source.id}" failed:`, error)
      return Stream.empty
    })
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Narrowing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build narrow key → source ID map
 */
const buildKeyToSourceMap = <T extends SearchItem>(
  sources: readonly SearchSource<T>[]
): Map<string, string> => {
  const map = new Map<string, string>()
  for (const source of sources) {
    if (source.narrowKey) {
      map.set(source.narrowKey, source.id)
    }
  }
  return map
}

/**
 * Apply narrowing filter to stream
 */
const applyNarrowing = <T extends SearchItem>(
  stream: Stream.Stream<MergedItem<T>>,
  narrowState: NarrowState
): Stream.Stream<MergedItem<T>> => {
  if (narrowState.activeKey === null) {
    return stream
  }

  const sourceId = narrowState.keyToSource.get(narrowState.activeKey)
  if (!sourceId) {
    return stream
  }

  return Stream.filter(stream, (item) => item._source === sourceId)
}

// ─────────────────────────────────────────────────────────────────────────────
// Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create indices builder from sources
 *
 * @example
 * ```ts
 * const builder = createIndicesBuilder([
 *   testbedSource,
 *   commandSource,
 *   routeSource,
 * ])
 *
 * const program = Effect.gen(function*() {
 *   const indices = yield* builder
 *
 *   // Get merged stream
 *   const items = yield* Stream.runCollect(indices.stream)
 *
 *   // Narrow to testbeds only
 *   indices.narrow('t')
 *
 *   // Widen back to all
 *   indices.widen()
 * })
 * ```
 */
export const createIndicesBuilder = <T extends SearchItem>(
  sources: readonly SearchSource<T>[],
  config: IndicesConfig = {}
): Effect.Effect<{
  readonly stream: Stream.Stream<MergedItem<T>>
  readonly narrow: (key: string) => Effect.Effect<void>
  readonly widen: () => Effect.Effect<void>
  readonly narrowState: Effect.Effect<NarrowState>
  readonly sources: readonly SearchSource<T>[]
  readonly getSourceByKey: (key: string) => SearchSource<T> | undefined
}> =>
  Effect.gen(function* () {
    const cfg = { ...DEFAULT_CONFIG, ...config }

    // Filter to enabled sources
    const enabledSources = sources.filter((s) => {
      if (s.hidden && !cfg.includeHidden) return false
      if (s.enabled && !s.enabled()) return false
      return true
    })

    // Build narrowing map
    const keyToSource = buildKeyToSourceMap(enabledSources)

    // Create narrow state ref
    const narrowStateRef = yield* Ref.make<NarrowState>({
      activeKey: null,
      keyToSource,
    })

    // Create individual source streams
    const sourceStreams = enabledSources.map((source) => sourceToStream(source))

    // Merge all streams (unordered for speed)
    const mergedStream = Stream.mergeAll(sourceStreams, {
      concurrency: cfg.concurrency,
    })

    return {
      stream: mergedStream,

      narrow: (key: string) =>
        Ref.update(narrowStateRef, (state) => ({
          ...state,
          activeKey: key,
        })),

      widen: () =>
        Ref.update(narrowStateRef, (state) => ({
          ...state,
          activeKey: null,
        })),

      narrowState: Ref.get(narrowStateRef),

      sources: enabledSources,

      getSourceByKey: (key: string) =>
        enabledSources.find((s) => s.narrowKey === key),
    }
  })

// ─────────────────────────────────────────────────────────────────────────────
// Reactive Builder (for hooks)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a narrowed stream based on current narrow state
 *
 * This is the reactive version for use with atoms/hooks.
 * The stream is recomputed when narrow state changes.
 */
export const createNarrowedStream = <T extends SearchItem>(
  sources: readonly SearchSource<T>[],
  narrowKey: string | null,
  config: IndicesConfig = {}
): Stream.Stream<MergedItem<T>> => {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  // Filter to enabled sources
  let enabledSources = sources.filter((s) => {
    if (s.hidden && !cfg.includeHidden) return false
    if (s.enabled && !s.enabled()) return false
    return true
  })

  // Apply narrowing at source level (more efficient than stream filter)
  if (narrowKey !== null) {
    enabledSources = enabledSources.filter((s) => s.narrowKey === narrowKey)
  }

  // Create individual source streams
  const sourceStreams = enabledSources.map((source) => sourceToStream(source))

  // Merge all streams
  return Stream.mergeAll(sourceStreams, {
    concurrency: cfg.concurrency,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Collect all items from sources synchronously (for initial index building)
 */
export const collectAllItems = <T extends SearchItem>(
  sources: readonly SearchSource<T>[],
  config: IndicesConfig = {}
): Effect.Effect<readonly MergedItem<T>[]> =>
  Effect.gen(function* () {
    const stream = createNarrowedStream(sources, null, config)
    const chunk = yield* Stream.runCollect(stream)
    return [...chunk]
  })

/**
 * Get narrowing help text (like consult-narrow-help)
 */
export const getNarrowingHelp = <T extends SearchItem>(
  sources: readonly SearchSource<T>[]
): string => {
  const narrowable = sources.filter((s) => s.narrowKey)
  if (narrowable.length === 0) return "No narrowing keys defined"

  return narrowable
    .map((s) => `${s.narrowKey}: ${s.name}`)
    .join("  ")
}
