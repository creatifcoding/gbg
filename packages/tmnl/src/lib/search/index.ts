/**
 * TMNL Search
 *
 * Stream-first search framework with Effect integration.
 *
 * ## Quick Start
 *
 * ```ts
 * import { createFlexSearchDriver, withMinScore } from '@/lib/search'
 * import { Effect, Stream } from 'effect'
 *
 * // Create driver
 * const driver = await Effect.runPromise(createFlexSearchDriver<Command>())
 *
 * // Index items
 * await Effect.runPromise(driver.index(commands, {
 *   fields: ['name', 'description', 'category'],
 * }))
 *
 * // Search (returns Stream)
 * const results = await Effect.runPromise(
 *   driver.search('save').pipe(
 *     withMinScore(0.3),
 *     Stream.take(10),
 *     Stream.runCollect
 *   )
 * )
 * ```
 *
 * ## Architecture
 *
 * - **Queries return Stream** → progressive UI, natural cancellation
 * - **Mutations return Effect** → one-shot, transactional
 * - **Schema as gatekeeper** → light validation/filtering
 * - **Operators are composable** → Stream pipelines
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type {
  SearchResult,
  FieldMatch,
  SearchStrategy,
  SearchOptions,
  Indexable,
  FieldConfig,
  IndexConfig,
  SearchError,
  SearchStats,
  SearchServiceImpl,
  CommandSearchItem,
  CommandSearchService,
} from './types'

export { SearchService } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Core schemas
  CharRangeSchema,
  FieldMatchSchema,
  SearchResultSchema,
  ValidSearchResultSchema,
  SearchStrategySchema,
  SearchOptionsSchema,
  CommandSearchItemSchema,
  CommandSearchResultSchema,
  // Type guards
  isValidResult,
  isCommandResult,
  // Filter factories
  scoreAbove,
  scoreBelow,
  hasFieldMatch,
  hasMatches,
  inCategory,
  inScope,
  nameContains,
  // Combinators
  allOf,
  anyOf,
  not,
} from './schemas'

export type {
  FieldMatch as FieldMatchSchemaType,
  SearchResult as SearchResultSchemaType,
  SearchStrategy as SearchStrategySchemaType,
  SearchOptions as SearchOptionsSchemaType,
  CommandSearchItem as CommandSearchItemSchemaType,
  CommandSearchResult as CommandSearchResultSchemaType,
} from './schemas'

// ─────────────────────────────────────────────────────────────────────────────
// Drivers
// ─────────────────────────────────────────────────────────────────────────────

export { createFlexSearchDriver } from './drivers/flexsearch'
export { createLinearDriver } from './drivers/linear'

// ─────────────────────────────────────────────────────────────────────────────
// Operators
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Score operators
  withMinScore,
  withMaxScore,
  withScoreRange,
  withFieldBoost,
  withBoosts,
  withPositionDecay,
  // Match operators
  withFieldMatch,
  withAnyFieldMatch,
  withAllFieldMatches,
  withMatches,
  // Sorting
  sortedByScore,
  // Tracing
  tracedStream,
  timedStream,
  createTracedDriver,
  consoleTracedStream,
} from './operators'
