/**
 * TMNL Search — Types
 *
 * Stream-first search framework with Effect integration.
 * Designed for 5000+ item scale with progressive result emission.
 *
 * Key Design:
 * - Queries return Stream (progressive, cancellable)
 * - Mutations return Effect (one-shot, transactional)
 */

import { Context, Effect, Stream } from 'effect'

// ─────────────────────────────────────────────────────────────────────────────
// Search Result Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single search result with scoring and match info
 */
export interface SearchResult<T = unknown> {
  /** The matched item */
  readonly item: T
  /** Relevance score (0-1, higher = better match) */
  readonly score: number
  /** Which fields matched */
  readonly matches?: readonly FieldMatch[]
  /** Original index in the source array (for highlighting) */
  readonly index?: number
}

/**
 * Information about which field matched and where
 */
export interface FieldMatch {
  /** Field name that matched */
  readonly field: string
  /** Character ranges that matched (for highlighting) */
  readonly ranges?: readonly [start: number, end: number][]
}

// ─────────────────────────────────────────────────────────────────────────────
// Search Options
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search strategy
 */
export type SearchStrategy = 'exact' | 'prefix' | 'fuzzy' | 'auto'

/**
 * Options for search queries
 */
export interface SearchOptions {
  /** Maximum results to return */
  readonly limit?: number
  /** Search strategy to use */
  readonly strategy?: SearchStrategy
  /** Fuzzy matching threshold (0-1, lower = more lenient) */
  readonly fuzzyThreshold?: number
  /** Fields to search (if not specified, searches all indexed fields) */
  readonly fields?: readonly string[]
  /** Enable suggestions for typos */
  readonly suggest?: boolean
  /** Boost certain fields (field name → weight multiplier) */
  readonly boost?: Readonly<Record<string, number>>
  /** Chunk size for progressive emission (default: 10) */
  readonly chunkSize?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Indexable Item
// ─────────────────────────────────────────────────────────────────────────────

/**
 * An item that can be indexed for search
 */
export interface Indexable {
  /** Unique identifier */
  readonly id: string | number
  /** Additional properties to index */
  readonly [key: string]: unknown
}

/**
 * Configuration for indexing a field
 */
export interface FieldConfig {
  /** Field name */
  readonly field: string
  /** Tokenization strategy */
  readonly tokenize?: 'strict' | 'forward' | 'reverse' | 'full'
  /** Weight for this field in scoring */
  readonly weight?: number
}

/**
 * Index configuration
 */
export interface IndexConfig<T extends Indexable = Indexable> {
  /** Fields to index */
  readonly fields: readonly (keyof T | FieldConfig)[]
  /** Whether to store original documents */
  readonly store?: boolean
  /** Custom ID field (defaults to 'id') */
  readonly idField?: keyof T
}

// ─────────────────────────────────────────────────────────────────────────────
// Search Service Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Error types for search operations
 */
export type SearchError =
  | { readonly _tag: 'IndexNotReady'; readonly message: string }
  | { readonly _tag: 'InvalidQuery'; readonly message: string }
  | { readonly _tag: 'IndexError'; readonly message: string; readonly cause?: unknown }

/**
 * Stats about the search index
 */
export interface SearchStats {
  /** Number of indexed items */
  readonly itemCount: number
  /** Number of indexed fields */
  readonly fieldCount: number
  /** Memory usage estimate (bytes) */
  readonly memoryUsage?: number
  /** Last index update timestamp */
  readonly lastUpdated?: number
}

/**
 * Search service interface (Stream-first)
 *
 * Implementations:
 * - FlexSearchDriver (production, fast)
 * - LinearDriver (fallback, simple .includes())
 * - TracedDriver (wraps any driver with Effect.withSpan)
 *
 * Design:
 * - Queries return Stream → progressive UI, natural cancellation
 * - Mutations return Effect → one-shot, transactional
 */
export interface SearchServiceImpl<T extends Indexable = Indexable> {
  // ───────────────────────────────────────────────────────────────────────────
  // Mutations (Effect - one-shot)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Index a collection of items
   */
  readonly index: (
    items: readonly T[],
    config: IndexConfig<T>
  ) => Effect.Effect<void, SearchError>

  /**
   * Add a single item to the index
   */
  readonly add: (item: T) => Effect.Effect<void, SearchError>

  /**
   * Update an existing item in the index
   */
  readonly update: (item: T) => Effect.Effect<void, SearchError>

  /**
   * Remove an item from the index by ID
   */
  readonly remove: (id: string | number) => Effect.Effect<void, SearchError>

  // ───────────────────────────────────────────────────────────────────────────
  // Queries (Stream - progressive, cancellable)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Search the index (auto-detect strategy)
   *
   * Returns a Stream for progressive result emission.
   * Cancel the stream to abort the search.
   */
  readonly search: (
    query: string,
    options?: SearchOptions
  ) => Stream.Stream<SearchResult<T>, SearchError>

  /**
   * Prefix search (autocomplete)
   *
   * Optimized for instant search-as-you-type.
   */
  readonly prefix: (
    query: string,
    options?: Omit<SearchOptions, 'strategy'>
  ) => Stream.Stream<SearchResult<T>, SearchError>

  /**
   * Fuzzy search (typo-tolerant)
   *
   * More lenient matching for typos and misspellings.
   */
  readonly fuzzy: (
    query: string,
    options?: Omit<SearchOptions, 'strategy'>
  ) => Stream.Stream<SearchResult<T>, SearchError>

  // ───────────────────────────────────────────────────────────────────────────
  // Admin (Effect - one-shot)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get index stats
   */
  readonly stats: () => Effect.Effect<SearchStats, SearchError>

  /**
   * Clear the entire index
   */
  readonly clear: () => Effect.Effect<void, SearchError>
}

// ─────────────────────────────────────────────────────────────────────────────
// Effect Service Tag
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search service Effect tag
 */
export class SearchService extends Context.Tag('tmnl/search/SearchService')<
  SearchService,
  SearchServiceImpl
>() {}

// ─────────────────────────────────────────────────────────────────────────────
// Command-Specific Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Command search item shape (for command palette)
 */
export interface CommandSearchItem extends Indexable {
  readonly id: string
  readonly name: string
  readonly description?: string
  readonly category: string
  readonly scope: string
  readonly keys?: string
}

/**
 * Shorthand for command search service
 */
export type CommandSearchService = SearchServiceImpl<CommandSearchItem>
