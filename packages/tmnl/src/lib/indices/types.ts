/**
 * TMNL Indices Builder - Types
 *
 * Multi-source search composition inspired by Emacs Consult.
 * Sources are DATA definitions; search mechanics handled by src/lib/search.
 *
 * @see assets/documents/IDEA-MILL.org IDEA-0005 for research
 */

import type { Effect, Stream } from "effect"

// ─────────────────────────────────────────────────────────────────────────────
// Base Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Searchable item shape - all sources must produce items extending this
 */
export interface SearchItem {
  readonly id: string
  readonly _source?: string // Injected by builder for narrowing
}

/**
 * Preview data for candidate preview (optional)
 */
export interface PreviewData {
  readonly type: "route" | "content" | "component"
  readonly route?: string
  readonly content?: string
  readonly component?: React.ComponentType
}

// ─────────────────────────────────────────────────────────────────────────────
// Source Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search source - candidate generator with metadata
 *
 * Inspired by Consult's source plist pattern:
 * - :name → name
 * - :narrow → narrowKey
 * - :category → category
 * - :items → items (sync)
 * - :async → items (stream)
 * - :action → action
 * - :state → preview
 *
 * @example
 * ```ts
 * const testbedSource: SearchSource<TestbedSearchItem> = {
 *   id: 'testbeds',
 *   name: 'Testbeds',
 *   narrowKey: 't',
 *   category: 'navigation',
 *   icon: '◈',
 *   items: () => Effect.succeed(getSearchableTestbeds()),
 *   action: (item) => Effect.sync(() => navigate(item.route)),
 * }
 * ```
 */
export interface SearchSource<T extends SearchItem> {
  /** Unique source identifier */
  readonly id: string

  /** Display name for group headers */
  readonly name: string

  /** Narrowing key - press key + space to filter to this source only */
  readonly narrowKey?: string

  /** Category for styling/actions (like Consult's completion category) */
  readonly category: string

  /** Icon for source (displayed in group headers) */
  readonly icon?: string

  /** Face/accent color for candidates from this source */
  readonly accent?: string

  /** Hidden by default? User must explicitly widen to see */
  readonly hidden?: boolean

  /** Enable predicate - source excluded if returns false */
  readonly enabled?: () => boolean

  /**
   * Candidate generator
   *
   * Sync: Returns Effect that resolves to item array
   * Async: Returns Stream that yields items progressively
   */
  readonly items: () => Effect.Effect<readonly T[]> | Stream.Stream<T>

  /**
   * Action to execute when item is selected
   * Called after selection, not during preview
   */
  readonly action: (item: T) => Effect.Effect<void>

  /**
   * Preview function for live preview during selection
   * Optional - not all sources support preview
   */
  readonly preview?: (item: T) => Effect.Effect<PreviewData>
}

// ─────────────────────────────────────────────────────────────────────────────
// Builder Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Narrowing state
 */
export interface NarrowState {
  /** Currently active narrow key, or null for all sources */
  readonly activeKey: string | null

  /** Map of narrowKey → sourceId for quick lookup */
  readonly keyToSource: ReadonlyMap<string, string>
}

/**
 * Merged item with source metadata injected
 */
export type MergedItem<T extends SearchItem> = T & {
  readonly _source: string
  readonly _sourceName: string
  readonly _sourceIcon?: string
  readonly _sourceAccent?: string
}

/**
 * Indices builder configuration
 */
export interface IndicesConfig {
  /** Debounce time for async sources (ms) */
  readonly debounceMs?: number

  /** Max concurrent async source fetches */
  readonly concurrency?: number

  /** Include hidden sources? */
  readonly includeHidden?: boolean
}

/**
 * Indices builder result - what consumers receive
 */
export interface IndicesResult<T extends SearchItem> {
  /** Merged stream of all items from all sources */
  readonly stream: Stream.Stream<MergedItem<T>>

  /** Narrow to a single source */
  readonly narrow: (key: string) => void

  /** Widen to all sources */
  readonly widen: () => void

  /** Get source by narrow key */
  readonly getSourceByKey: (key: string) => SearchSource<T> | undefined

  /** All registered sources */
  readonly sources: readonly SearchSource<T>[]

  /** Current narrow state */
  readonly narrowState: NarrowState
}

// ─────────────────────────────────────────────────────────────────────────────
// Source Registry Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Source registration - sources can be added dynamically
 */
export interface SourceRegistry<T extends SearchItem> {
  /** Register a new source */
  readonly register: (source: SearchSource<T>) => void

  /** Unregister a source by ID */
  readonly unregister: (sourceId: string) => void

  /** Get all registered sources */
  readonly getSources: () => readonly SearchSource<T>[]

  /** Get source by ID */
  readonly getSource: (sourceId: string) => SearchSource<T> | undefined

  /** Get source by narrow key */
  readonly getSourceByKey: (key: string) => SearchSource<T> | undefined
}
