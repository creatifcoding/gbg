/**
 * TMNL Search — Traced Operators
 *
 * Effect.withSpan wrappers for observability.
 * Enables tracing via OpenTelemetry or console logging.
 */

import { Effect, Stream } from 'effect'
import type {
  SearchServiceImpl,
  SearchResult,
  SearchOptions,
  SearchError,
  Indexable,
  IndexConfig,
} from '../types'

// ─────────────────────────────────────────────────────────────────────────────
// Stream Tracing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wrap a stream with tracing spans
 * Each chunk emission creates a span
 */
export const tracedStream = <T, E>(
  name: string,
  attributes?: Record<string, unknown>
) =>
  (stream: Stream.Stream<T, E>): Stream.Stream<T, E> =>
    Stream.unwrap(
      Effect.gen(function* () {
        yield* Effect.logDebug(`[${name}] Stream started`, attributes)
        let count = 0

        return stream.pipe(
          Stream.tap((item) =>
            Effect.gen(function* () {
              count++
              if (count % 10 === 0) {
                yield* Effect.logDebug(`[${name}] Emitted ${count} items`)
              }
            })
          ),
          Stream.ensuring(
            Effect.logDebug(`[${name}] Stream completed: ${count} items`)
          )
        )
      })
    )

/**
 * Add timing to stream consumption
 */
export const timedStream = <T, E>(name: string) =>
  (stream: Stream.Stream<T, E>): Stream.Stream<T, E> =>
    Stream.unwrap(
      Effect.gen(function* () {
        const startTime = Date.now()

        return stream.pipe(
          Stream.ensuring(
            Effect.sync(() => {
              const elapsed = Date.now() - startTime
              console.debug(`[${name}] Completed in ${elapsed}ms`)
            })
          )
        )
      })
    )

// ─────────────────────────────────────────────────────────────────────────────
// Service Wrapper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wrap a SearchService with tracing spans on all operations
 */
export const createTracedDriver = <T extends Indexable>(
  inner: SearchServiceImpl<T>,
  serviceName: string = 'SearchService'
): SearchServiceImpl<T> => ({
  // ─────────────────────────────────────────────────────────────────────────
  // Mutations (with Effect.withSpan)
  // ─────────────────────────────────────────────────────────────────────────

  index: (items: readonly T[], config: IndexConfig<T>) =>
    inner.index(items, config).pipe(
      Effect.withSpan(`${serviceName}.index`, {
        attributes: {
          itemCount: items.length,
          fields: config.fields.length,
        },
      }),
      Effect.tap(() =>
        Effect.logInfo(`[${serviceName}] Indexed ${items.length} items`)
      )
    ),

  add: (item: T) =>
    inner.add(item).pipe(
      Effect.withSpan(`${serviceName}.add`, {
        attributes: { itemId: item.id },
      })
    ),

  update: (item: T) =>
    inner.update(item).pipe(
      Effect.withSpan(`${serviceName}.update`, {
        attributes: { itemId: item.id },
      })
    ),

  remove: (id: string | number) =>
    inner.remove(id).pipe(
      Effect.withSpan(`${serviceName}.remove`, {
        attributes: { itemId: id },
      })
    ),

  // ─────────────────────────────────────────────────────────────────────────
  // Queries (with Stream tracing)
  // ─────────────────────────────────────────────────────────────────────────

  search: (query: string, options?: SearchOptions) =>
    inner.search(query, options).pipe(
      tracedStream(`${serviceName}.search`, {
        query,
        limit: options?.limit,
        strategy: options?.strategy,
      })
    ),

  prefix: (query: string, options?: Omit<SearchOptions, 'strategy'>) =>
    inner.prefix(query, options).pipe(
      tracedStream(`${serviceName}.prefix`, {
        query,
        limit: options?.limit,
      })
    ),

  fuzzy: (query: string, options?: Omit<SearchOptions, 'strategy'>) =>
    inner.fuzzy(query, options).pipe(
      tracedStream(`${serviceName}.fuzzy`, {
        query,
        limit: options?.limit,
      })
    ),

  // ─────────────────────────────────────────────────────────────────────────
  // Admin (with Effect.withSpan)
  // ─────────────────────────────────────────────────────────────────────────

  stats: () =>
    inner.stats().pipe(
      Effect.withSpan(`${serviceName}.stats`),
      Effect.tap((stats) =>
        Effect.logDebug(`[${serviceName}] Stats`, { stats })
      )
    ),

  clear: () =>
    inner.clear().pipe(
      Effect.withSpan(`${serviceName}.clear`),
      Effect.tap(() => Effect.logInfo(`[${serviceName}] Index cleared`))
    ),
})

// ─────────────────────────────────────────────────────────────────────────────
// Utility: Console Tracing (for development)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simple console-based tracing for development
 */
export const consoleTracedStream = <T extends { score?: number }, E>(
  label: string
) =>
  (stream: Stream.Stream<T, E>): Stream.Stream<T, E> => {
    let count = 0
    const startTime = Date.now()

    return stream.pipe(
      Stream.tap((item) =>
        Effect.sync(() => {
          count++
          if (count <= 3) {
            console.log(`[${label}] Result ${count}:`, {
              score: item.score,
              item: item,
            })
          }
        })
      ),
      Stream.ensuring(
        Effect.sync(() => {
          const elapsed = Date.now() - startTime
          console.log(
            `[${label}] Complete: ${count} results in ${elapsed}ms`
          )
        })
      )
    )
  }
