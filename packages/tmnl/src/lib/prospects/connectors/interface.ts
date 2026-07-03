/**
 * Prospect Pipeline — Source Connector Interface
 *
 * Every data source implements this contract. Sources return
 * HarvestCompanyRecord[] that feeds into HarvestService.ingestBatch().
 *
 * Connectors are Effect.Service instances — testable, composable, provideable.
 *
 * @module prospects/connectors/interface
 */

import { Schema, Effect, Duration, Schedule } from 'effect'
import type { HarvestSource } from '../schemas/domain'
import type { HarvestCompanyRecord } from '../schemas/harvest'

// =============================================================================
// Connector Errors
// =============================================================================

export class ConnectorError extends Schema.TaggedError<ConnectorError>()(
  'ConnectorError',
  {
    sourceId: Schema.String,
    message: Schema.String,
    statusCode: Schema.optional(Schema.Number),
    retryable: Schema.Boolean,
  }
) {}

export class ConnectorRateLimitError extends Schema.TaggedError<ConnectorRateLimitError>()(
  'ConnectorRateLimitError',
  {
    sourceId: Schema.String,
    retryAfterMs: Schema.Number,
  }
) {}

export class ConnectorAuthError extends Schema.TaggedError<ConnectorAuthError>()(
  'ConnectorAuthError',
  {
    sourceId: Schema.String,
    message: Schema.String,
  }
) {}

// =============================================================================
// Connector Response Types
// =============================================================================

export interface FetchResult {
  readonly records: ReadonlyArray<HarvestCompanyRecord>
  readonly totalAvailable: number
  readonly nextPage: number | null
  readonly sourceMetadata?: Record<string, unknown>
}

export interface HealthStatus {
  readonly healthy: boolean
  readonly latencyMs: number
  readonly lastSuccessAt: string | null
  readonly errorMessage?: string
}

// =============================================================================
// Connector Interface
// =============================================================================

/**
 * SourceConnector — the contract every data source implements.
 *
 * Connectors are stateless fetchers. They don't write to the DB —
 * they return records for HarvestService to ingest.
 */
export interface SourceConnectorShape {
  /** Which HarvestSource enum this connector represents */
  readonly sourceId: HarvestSource

  /** Human-readable name for logs and monitoring */
  readonly displayName: string

  /**
   * Fetch a page of results.
   *
   * @param params.query - Search term or keyword
   * @param params.category - Source-specific category/NAICS/SIC code
   * @param params.page - Page number (0-indexed)
   * @param params.limit - Results per page
   * @param params.since - Only results after this ISO date (for incremental)
   */
  readonly fetch: (params: {
    readonly query?: string
    readonly category?: string
    readonly page?: number
    readonly limit?: number
    readonly since?: string
  }) => Effect.Effect<FetchResult, ConnectorError | ConnectorRateLimitError>

  /**
   * Fetch ALL pages for a query, auto-paginating.
   * Returns concatenated results. Respects rate limits between pages.
   */
  readonly fetchAll: (params: {
    readonly query?: string
    readonly category?: string
    readonly maxPages?: number
    readonly since?: string
  }) => Effect.Effect<FetchResult, ConnectorError | ConnectorRateLimitError>

  /** Health check — is this source reachable and responding? */
  readonly healthCheck: Effect.Effect<HealthStatus, ConnectorError>
}

// =============================================================================
// Retry Policy (shared across connectors)
// =============================================================================

/**
 * Standard retry policy for connector HTTP calls.
 * Exponential backoff: 1s → 2s → 4s, max 3 retries.
 * Only retries on retryable errors.
 */
export const connectorRetryPolicy = Schedule.exponential(Duration.seconds(1)).pipe(
  Schedule.compose(Schedule.recurs(3)),
)

/**
 * Standard timeout for connector HTTP calls.
 */
export const connectorTimeout = Duration.seconds(30)
