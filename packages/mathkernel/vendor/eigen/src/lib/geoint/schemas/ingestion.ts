/**
 * GEOINT Ingestion Schemas
 *
 * Effect Schema definitions for the ingestion RPC layer:
 * - Tagged request schemas for RPC operations
 * - Data.TaggedError hierarchy for typed error handling
 * - Response schemas for ingester/orchestrator status
 *
 * @module geoint/schemas/ingestion
 */

import { Schema, Data, Option } from 'effect'

// =============================================================================
// Ingester Name Schema
// =============================================================================

/**
 * Valid ingester names for individual control.
 */
export const IngesterNameSchema = Schema.Literal('flight', 'osm', 'weather', 'imagery')
export type IngesterName = typeof IngesterNameSchema.Type

// =============================================================================
// Error Types (Data.TaggedError pattern)
// =============================================================================

/**
 * Ingestion error category for high-level classification.
 */
export const IngestionErrorCategory = Schema.Literal(
  'not_configured', // Orchestrator not available
  'already_running', // Ingester already started
  'not_running',    // Ingester not running
  'start_failed',   // Failed to start
  'stop_failed',    // Failed to stop
  'not_found',      // Ingester not found
  'unknown'         // Unclassified errors
)
export type IngestionErrorCategory = typeof IngestionErrorCategory.Type

/**
 * Orchestrator not configured - ingestion system unavailable.
 */
export class IngestionNotConfiguredError extends Data.TaggedError('IngestionNotConfiguredError')<{
  readonly message: string
  readonly reason?: string
}> {
  readonly category = 'not_configured' as const
  readonly recoverable = false
  get userMessage() {
    return 'Ingestion system is not configured. Ensure IngestionPipelineLive layer is provided.'
  }
}

/**
 * Ingester already running - cannot start again.
 */
export class IngestionAlreadyRunningError extends Data.TaggedError('IngestionAlreadyRunningError')<{
  readonly message: string
  readonly ingester: IngesterName
}> {
  readonly category = 'already_running' as const
  readonly recoverable = false
  get userMessage() {
    return `${this.ingester} ingester is already running.`
  }
}

/**
 * Ingester not running - cannot stop.
 */
export class IngestionNotRunningError extends Data.TaggedError('IngestionNotRunningError')<{
  readonly message: string
  readonly ingester: IngesterName
}> {
  readonly category = 'not_running' as const
  readonly recoverable = false
  get userMessage() {
    return `${this.ingester} ingester is not running.`
  }
}

/**
 * Failed to start ingester(s).
 */
export class IngestionStartError extends Data.TaggedError('IngestionStartError')<{
  readonly message: string
  readonly ingester?: IngesterName
  readonly cause?: unknown
}> {
  readonly category = 'start_failed' as const
  readonly recoverable = true
  readonly retryDelayMs = 5000
  get userMessage() {
    return this.ingester
      ? `Failed to start ${this.ingester} ingester: ${this.message}`
      : `Failed to start ingestion: ${this.message}`
  }
}

/**
 * Failed to stop ingester(s).
 */
export class IngestionStopError extends Data.TaggedError('IngestionStopError')<{
  readonly message: string
  readonly ingester?: IngesterName
  readonly cause?: unknown
}> {
  readonly category = 'stop_failed' as const
  readonly recoverable = true
  readonly retryDelayMs = 2000
  get userMessage() {
    return this.ingester
      ? `Failed to stop ${this.ingester} ingester: ${this.message}`
      : `Failed to stop ingestion: ${this.message}`
  }
}

/**
 * Ingester not found - invalid ingester name.
 */
export class IngesterNotFoundError extends Data.TaggedError('IngesterNotFoundError')<{
  readonly message: string
  readonly ingester: string
}> {
  readonly category = 'not_found' as const
  readonly recoverable = false
  get userMessage() {
    return `Ingester '${this.ingester}' not found. Valid names: flight, osm, weather, imagery.`
  }
}

/**
 * Unknown ingestion error.
 */
export class IngestionUnknownError extends Data.TaggedError('IngestionUnknownError')<{
  readonly message: string
  readonly cause?: unknown
}> {
  readonly category = 'unknown' as const
  readonly recoverable = false
  readonly userMessage = 'An unexpected ingestion error occurred.'
}

/**
 * Discriminated union of all ingestion errors.
 * Use `Match.tag` for exhaustive handling.
 */
export type IngestionError =
  | IngestionNotConfiguredError
  | IngestionAlreadyRunningError
  | IngestionNotRunningError
  | IngestionStartError
  | IngestionStopError
  | IngesterNotFoundError
  | IngestionUnknownError

// =============================================================================
// Tagged Request Schemas
// =============================================================================

/**
 * Request to start all enabled ingesters.
 */
export class StartIngestionRequest extends Schema.TaggedRequest<StartIngestionRequest>()(
  'StartIngestionRequest',
  {
    failure: Schema.Never,
    success: Schema.suspend(() => OrchestratorStatusSchema),
    payload: {},
  }
) {}

/**
 * Request to stop all running ingesters.
 */
export class StopIngestionRequest extends Schema.TaggedRequest<StopIngestionRequest>()(
  'StopIngestionRequest',
  {
    failure: Schema.Never,
    success: Schema.suspend(() => OrchestratorStatusSchema),
    payload: {},
  }
) {}

/**
 * Request to get current ingestion status.
 */
export class GetIngestionStatusRequest extends Schema.TaggedRequest<GetIngestionStatusRequest>()(
  'GetIngestionStatusRequest',
  {
    failure: Schema.Never,
    success: Schema.suspend(() => OrchestratorStatusSchema),
    payload: {},
  }
) {}

/**
 * Request to start a specific ingester.
 */
export class StartIngesterRequest extends Schema.TaggedRequest<StartIngesterRequest>()(
  'StartIngesterRequest',
  {
    failure: Schema.Never,
    success: Schema.suspend(() => IngesterStatusSchema),
    payload: {
      name: IngesterNameSchema,
    },
  }
) {}

/**
 * Request to stop a specific ingester.
 */
export class StopIngesterRequest extends Schema.TaggedRequest<StopIngesterRequest>()(
  'StopIngesterRequest',
  {
    failure: Schema.Never,
    success: Schema.suspend(() => IngesterStatusSchema),
    payload: {
      name: IngesterNameSchema,
    },
  }
) {}

// =============================================================================
// Response Schemas
// =============================================================================

/**
 * Status of an individual ingester.
 */
export const IngesterStatusSchema = Schema.Struct({
  name: Schema.String,
  running: Schema.Boolean,
  startedAt: Schema.optionalWith(Schema.DateFromSelf, { as: 'Option' }),
  error: Schema.optionalWith(Schema.String, { as: 'Option' }),
})
export type IngesterStatus = typeof IngesterStatusSchema.Type

/**
 * Combined orchestrator status with all ingesters.
 */
export const OrchestratorStatusSchema = Schema.Struct({
  running: Schema.Boolean,
  ingesters: Schema.Array(IngesterStatusSchema),
  startedAt: Schema.optionalWith(Schema.DateFromSelf, { as: 'Option' }),
})
export type OrchestratorStatus = typeof OrchestratorStatusSchema.Type

// =============================================================================
// Conversion Utilities
// =============================================================================

/**
 * Parse an unknown error into an IngestionError.
 */
export const parseIngestionError = (error: unknown): IngestionError => {
  // Already an IngestionError
  if (error && typeof error === 'object' && '_tag' in error) {
    const tag = (error as { _tag: string })._tag
    if (tag.startsWith('Ingestion') || tag.startsWith('Ingester')) {
      return error as IngestionError
    }
  }

  const message = error instanceof Error ? error.message : String(error)
  const lowerMessage = message.toLowerCase()

  // Not configured
  if (
    lowerMessage.includes('not configured') ||
    lowerMessage.includes('orchestrator') ||
    lowerMessage.includes('not available')
  ) {
    return new IngestionNotConfiguredError({ message })
  }

  // Already running
  if (lowerMessage.includes('already running')) {
    return new IngestionAlreadyRunningError({
      message,
      ingester: 'flight', // Default, actual value should come from context
    })
  }

  // Not running
  if (lowerMessage.includes('not running')) {
    return new IngestionNotRunningError({
      message,
      ingester: 'flight',
    })
  }

  // Start failed
  if (lowerMessage.includes('start') && lowerMessage.includes('failed')) {
    return new IngestionStartError({
      message,
      cause: error instanceof Error ? error : undefined,
    })
  }

  // Stop failed
  if (lowerMessage.includes('stop') && lowerMessage.includes('failed')) {
    return new IngestionStopError({
      message,
      cause: error instanceof Error ? error : undefined,
    })
  }

  // Not found
  if (lowerMessage.includes('not found') || lowerMessage.includes('invalid ingester')) {
    return new IngesterNotFoundError({
      message,
      ingester: 'unknown',
    })
  }

  // Default to unknown
  return new IngestionUnknownError({
    message,
    cause: error instanceof Error ? error : undefined,
  })
}

/**
 * Create a "not configured" status for when orchestrator is unavailable.
 */
export const notConfiguredStatus = (): OrchestratorStatus => ({
  running: false,
  ingesters: [],
  startedAt: Option.none(),
})

/**
 * Create a "not found" ingester status.
 */
export const ingesterNotFoundStatus = (name: string): IngesterStatus => ({
  name,
  running: false,
  startedAt: Option.none(),
  error: Option.some(`Ingester '${name}' not found`),
})
