/**
 * TMNL Indices Builder
 *
 * Multi-source search composition inspired by Emacs Consult.
 *
 * Sources are DATA definitions that provide candidates.
 * The indices builder composes them into unified streams.
 * Search filtering is handled by src/lib/search drivers.
 *
 * @example Basic usage
 * ```ts
 * import { createIndicesBuilder, testbedSource } from '@/lib/indices'
 *
 * const program = Effect.gen(function*() {
 *   const indices = yield* createIndicesBuilder([testbedSource])
 *   const items = yield* Stream.runCollect(indices.stream)
 *   console.log(`Found ${items.length} items`)
 * })
 * ```
 *
 * @example With narrowing
 * ```ts
 * // In CommandBar, user presses "t SPC" to narrow to testbeds
 * const indices = yield* createIndicesBuilder([
 *   testbedSource,   // narrowKey: 't'
 *   commandSource,   // narrowKey: 'c'
 *   routeSource,     // narrowKey: 'r'
 * ])
 *
 * // Narrow to testbeds only
 * yield* indices.narrow('t')
 *
 * // Get narrowed stream
 * const narrowed = yield* Stream.runCollect(
 *   createNarrowedStream(indices.sources, 't')
 * )
 *
 * // Widen back
 * yield* indices.widen()
 * ```
 *
 * @see assets/documents/IDEA-MILL.org IDEA-0005 for design research
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type {
  SearchItem,
  SearchSource,
  MergedItem,
  IndicesConfig,
  NarrowState,
  PreviewData,
  SourceRegistry,
} from "./types"

// ─────────────────────────────────────────────────────────────────────────────
// Builder
// ─────────────────────────────────────────────────────────────────────────────

export {
  createIndicesBuilder,
  createNarrowedStream,
  collectAllItems,
  getNarrowingHelp,
} from "./builder"

// ─────────────────────────────────────────────────────────────────────────────
// Sources
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Main testbed source
  testbedSource,
  // Factory for category-filtered sources
  createCategorySource,
  // Pre-defined category sources
  dataTestbedSource,
  uiTestbedSource,
  animationTestbedSource,
  // Default source set
  defaultSources,
  // Types
  type TestbedIndexItem,
} from "./sources"
