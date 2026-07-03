/**
 * Prospect Pipeline — Shared HTTP Client for Connectors
 *
 * Effect-native HTTP fetching with retry, timeout, rate limit handling.
 * No try/catch. No raw fetch(). All errors in the Effect channel.
 *
 * @module prospects/connectors/_http
 */

import { Effect, Duration, Schedule } from 'effect'
import { ConnectorError, ConnectorRateLimitError, connectorTimeout } from './interface'

// =============================================================================
// JSON Fetch — the one HTTP call all connectors use
// =============================================================================

/**
 * Fetch JSON from a URL with Effect error handling.
 *
 * - Timeout after 30s
 * - Rate limit errors (429) → ConnectorRateLimitError with retryAfterMs
 * - 4xx/5xx → ConnectorError with retryable flag
 * - Parse failures → ConnectorError
 * - Auto-retry on 5xx (3 attempts, exponential backoff)
 */
export const fetchJson = <T = unknown>(
  url: string,
  sourceId: string,
  options?: {
    readonly headers?: Record<string, string>
    readonly method?: string
    readonly body?: string
  }
): Effect.Effect<T, ConnectorError | ConnectorRateLimitError> =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(url, {
          method: options?.method ?? 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'TMNL-ProspectPipeline/1.0',
            ...options?.headers,
          },
          body: options?.body,
          signal: AbortSignal.timeout(Duration.toMillis(connectorTimeout)),
        }),
      catch: (error) =>
        new ConnectorError({
          sourceId,
          message: `Network error: ${error instanceof Error ? error.message : String(error)}`,
          retryable: true,
        }),
    })

    // Rate limit
    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after')
      const retryMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : 60_000
      return yield* Effect.fail(
        new ConnectorRateLimitError({ sourceId, retryAfterMs: retryMs })
      )
    }

    // Client errors (not retryable)
    if (response.status >= 400 && response.status < 500) {
      const body = yield* Effect.tryPromise({
        try: () => response.text(),
        catch: () => new ConnectorError({ sourceId, message: `HTTP ${response.status}`, retryable: false }),
      })
      return yield* Effect.fail(
        new ConnectorError({
          sourceId,
          message: `HTTP ${response.status}: ${body.slice(0, 500)}`,
          statusCode: response.status,
          retryable: false,
        })
      )
    }

    // Server errors (retryable)
    if (response.status >= 500) {
      return yield* Effect.fail(
        new ConnectorError({
          sourceId,
          message: `HTTP ${response.status}`,
          statusCode: response.status,
          retryable: true,
        })
      )
    }

    // Parse JSON
    const json = yield* Effect.tryPromise({
      try: () => response.json() as Promise<T>,
      catch: (error) =>
        new ConnectorError({
          sourceId,
          message: `JSON parse error: ${error instanceof Error ? error.message : String(error)}`,
          retryable: false,
        }),
    })

    return json
  }).pipe(
    // Auto-retry on retryable errors (5xx, network)
    Effect.retry({
      schedule: Schedule.exponential(Duration.seconds(1)).pipe(
        Schedule.compose(Schedule.recurs(3))
      ),
      while: (error) => error._tag === 'ConnectorError' && error.retryable,
    })
  )

// =============================================================================
// Pagination Helper
// =============================================================================

/**
 * Auto-paginate through a source, collecting all pages.
 *
 * @param fetchPage - Function that fetches a single page
 * @param maxPages - Safety cap to prevent runaway pagination
 * @param delayBetweenPages - Rate-limit courtesy delay between pages
 */
export const paginateAll = <T>(
  fetchPage: (page: number) => Effect.Effect<{
    readonly items: ReadonlyArray<T>
    readonly nextPage: number | null
    readonly total: number
  }, ConnectorError | ConnectorRateLimitError>,
  maxPages: number = 10,
  delayBetweenPages: Duration.DurationInput = Duration.millis(500),
): Effect.Effect<{
  readonly allItems: ReadonlyArray<T>
  readonly totalAvailable: number
  readonly pagesConsumed: number
}, ConnectorError | ConnectorRateLimitError> =>
  Effect.gen(function* () {
    const allItems: T[] = []
    let currentPage = 0
    let totalAvailable = 0
    let pagesConsumed = 0

    while (currentPage !== null && pagesConsumed < maxPages) {
      const result = yield* fetchPage(currentPage)
      allItems.push(...result.items)
      totalAvailable = result.total
      pagesConsumed++

      if (result.nextPage === null || result.items.length === 0) break
      currentPage = result.nextPage

      // Courtesy delay between pages
      yield* Effect.sleep(delayBetweenPages)
    }

    return { allItems, totalAvailable, pagesConsumed }
  })
