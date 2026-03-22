/**
 * GEOINT Search Error Schemas
 *
 * Effect Schema definitions for typed error handling in the search system.
 * Discriminated union types enable:
 * - Specific error recovery strategies per error type
 * - User-friendly error messages
 * - Retry logic for transient failures
 * - Telemetry/logging with structured error data
 *
 * @module geoint/schemas/errors
 */

import { Schema, Data, DateTime } from 'effect'

// =============================================================================
// Error Types
// =============================================================================

/**
 * Search error category for high-level classification.
 */
export const SearchErrorCategory = Schema.Literal(
  'network',    // Connection failures, WebSocket issues
  'timeout',    // Request timeout
  'rate_limit', // API rate limiting
  'server',     // Server-side errors (500s)
  'validation', // Invalid query/input
  'not_found',  // Resource not found
  'auth',       // Authentication/authorization failures
  'unknown'     // Unclassified errors
)
export type SearchErrorCategory = typeof SearchErrorCategory.Type

/**
 * Whether the error is recoverable with retry.
 */
export const isRecoverable = (category: SearchErrorCategory): boolean => {
  switch (category) {
    case 'network':
    case 'timeout':
    case 'rate_limit':
    case 'server':
      return true
    case 'validation':
    case 'not_found':
    case 'auth':
    case 'unknown':
      return false
  }
}

// =============================================================================
// Error Classes (Data.TaggedError pattern)
// =============================================================================

/**
 * Network connectivity error - server unreachable or WebSocket failure.
 */
export class SearchNetworkError extends Data.TaggedError('SearchNetworkError')<{
  readonly message: string
  readonly url?: string
  readonly cause?: unknown
}> {
  readonly category = 'network' as const
  readonly recoverable = true
  readonly userMessage = 'Unable to connect to search server. Please check your connection.'
  readonly retryDelayMs = 2000
}

/**
 * Request timeout error.
 */
export class SearchTimeoutError extends Data.TaggedError('SearchTimeoutError')<{
  readonly message: string
  readonly timeoutMs: number
  readonly operation?: string
}> {
  readonly category = 'timeout' as const
  readonly recoverable = true
  readonly userMessage = 'Search request timed out. Try a smaller search area or fewer sources.'
  readonly retryDelayMs = 1000
}

/**
 * Rate limit error from external API.
 */
export class SearchRateLimitError extends Data.TaggedError('SearchRateLimitError')<{
  readonly message: string
  readonly source: string
  readonly retryAfterMs?: number
}> {
  readonly category = 'rate_limit' as const
  readonly recoverable = true
  get userMessage() {
    return `${this.source} API rate limit reached. ${this.retryAfterMs ? `Retry in ${Math.ceil(this.retryAfterMs / 1000)}s.` : 'Please wait before retrying.'}`
  }
  get retryDelayMs() {
    return this.retryAfterMs ?? 5000
  }
}

/**
 * Server-side error (500, etc.)
 */
export class SearchServerError extends Data.TaggedError('SearchServerError')<{
  readonly message: string
  readonly statusCode?: number
  readonly cause?: unknown
}> {
  readonly category = 'server' as const
  readonly recoverable = true
  readonly userMessage = 'Search server encountered an error. Retrying...'
  readonly retryDelayMs = 3000
}

/**
 * Validation error - invalid query parameters.
 */
export class SearchValidationError extends Data.TaggedError('SearchValidationError')<{
  readonly message: string
  readonly field?: string
  readonly value?: unknown
}> {
  readonly category = 'validation' as const
  readonly recoverable = false
  get userMessage() {
    return this.field ? `Invalid ${this.field}: ${this.message}` : this.message
  }
}

/**
 * Resource not found error.
 */
export class SearchNotFoundError extends Data.TaggedError('SearchNotFoundError')<{
  readonly message: string
  readonly resource?: string
  readonly id?: string
}> {
  readonly category = 'not_found' as const
  readonly recoverable = false
  get userMessage() {
    return this.resource ? `${this.resource} not found` : 'Resource not found'
  }
}

/**
 * Authentication/authorization error.
 */
export class SearchAuthError extends Data.TaggedError('SearchAuthError')<{
  readonly message: string
  readonly source?: string
}> {
  readonly category = 'auth' as const
  readonly recoverable = false
  get userMessage() {
    return this.source ? `Authentication failed for ${this.source}` : 'Authentication required'
  }
}

/**
 * Unknown/unclassified error.
 */
export class SearchUnknownError extends Data.TaggedError('SearchUnknownError')<{
  readonly message: string
  readonly cause?: unknown
}> {
  readonly category = 'unknown' as const
  readonly recoverable = false
  readonly userMessage = 'An unexpected error occurred. Please try again.'
}

// =============================================================================
// Union Type
// =============================================================================

/**
 * Discriminated union of all search errors.
 * Use `Match.tag` for exhaustive handling.
 *
 * @example
 * ```typescript
 * Match.type<SearchError>().pipe(
 *   Match.tag('SearchNetworkError', (e) => `Network: ${e.userMessage}`),
 *   Match.tag('SearchTimeoutError', (e) => `Timeout: ${e.timeoutMs}ms`),
 *   Match.tag('SearchRateLimitError', (e) => `Rate limited: ${e.source}`),
 *   Match.exhaustive
 * )
 * ```
 */
export type SearchError =
  | SearchNetworkError
  | SearchTimeoutError
  | SearchRateLimitError
  | SearchServerError
  | SearchValidationError
  | SearchNotFoundError
  | SearchAuthError
  | SearchUnknownError

// =============================================================================
// Error Schema (for serialization)
// =============================================================================

/**
 * Serializable error representation for RPC/storage.
 */
export class SearchErrorData extends Schema.Class<SearchErrorData>('SearchErrorData')({
  category: SearchErrorCategory,
  message: Schema.String,
  userMessage: Schema.String,
  recoverable: Schema.Boolean,
  retryDelayMs: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  details: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { default: () => ({}) }
  ),
  timestamp: Schema.DateTimeUtcFromSelf,
}) {}

// =============================================================================
// Conversion Utilities
// =============================================================================

/**
 * Get retry delay from error (if applicable).
 */
const getRetryDelayMs = (error: SearchError): number => {
  switch (error._tag) {
    case 'SearchNetworkError':
      return error.retryDelayMs
    case 'SearchTimeoutError':
      return error.retryDelayMs
    case 'SearchRateLimitError':
      return error.retryDelayMs
    case 'SearchServerError':
      return error.retryDelayMs
    default:
      return 0
  }
}

/**
 * Convert a SearchError to serializable SearchErrorData.
 */
export const toSearchErrorData = (error: SearchError): SearchErrorData => {
  return new SearchErrorData({
    category: error.category,
    message: error.message,
    userMessage: error.userMessage,
    recoverable: error.recoverable,
    retryDelayMs: getRetryDelayMs(error),
    details: {},
    timestamp: DateTime.unsafeNow(),
  })
}

/**
 * Parse an unknown error into a SearchError.
 * Attempts to classify based on error message patterns.
 */
export const parseError = (error: unknown): SearchError => {
  // Already a SearchError
  if (error && typeof error === 'object' && '_tag' in error) {
    const tag = (error as { _tag: string })._tag
    if (tag.startsWith('Search')) {
      return error as SearchError
    }
  }

  const message = error instanceof Error ? error.message : String(error)
  const lowerMessage = message.toLowerCase()

  // Network errors
  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('connection') ||
    lowerMessage.includes('websocket') ||
    lowerMessage.includes('econnrefused') ||
    lowerMessage.includes('fetch failed') ||
    lowerMessage.includes('failed to fetch') ||
    lowerMessage.includes('socket') ||
    lowerMessage.includes('404')
  ) {
    return new SearchNetworkError({
      message,
      cause: error instanceof Error ? error : undefined,
    })
  }

  // Timeout errors
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return new SearchTimeoutError({
      message,
      timeoutMs: 30000,
    })
  }

  // Rate limit errors
  if (
    lowerMessage.includes('rate limit') ||
    lowerMessage.includes('429') ||
    lowerMessage.includes('too many requests')
  ) {
    return new SearchRateLimitError({
      message,
      source: 'API',
    })
  }

  // Server errors
  if (
    lowerMessage.includes('500') ||
    lowerMessage.includes('502') ||
    lowerMessage.includes('503') ||
    lowerMessage.includes('504') ||
    lowerMessage.includes('server error')
  ) {
    return new SearchServerError({
      message,
      cause: error instanceof Error ? error : undefined,
    })
  }

  // Auth errors
  if (
    lowerMessage.includes('401') ||
    lowerMessage.includes('403') ||
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('forbidden')
  ) {
    return new SearchAuthError({
      message,
    })
  }

  // Validation errors
  if (
    lowerMessage.includes('invalid') ||
    lowerMessage.includes('validation') ||
    lowerMessage.includes('required')
  ) {
    return new SearchValidationError({
      message,
    })
  }

  // Default to unknown
  return new SearchUnknownError({
    message,
    cause: error instanceof Error ? error : undefined,
  })
}

// =============================================================================
// UI Error State
// =============================================================================

/**
 * Error state for UI components.
 * Includes all info needed to display error and offer retry.
 */
export interface SearchErrorState {
  readonly error: SearchError
  readonly timestamp: Date
  readonly retryCount: number
  readonly maxRetries: number
  readonly canRetry: boolean
}

/**
 * Create initial error state for UI.
 */
export const createErrorState = (
  error: SearchError,
  maxRetries = 3
): SearchErrorState => ({
  error,
  timestamp: new Date(),
  retryCount: 0,
  maxRetries,
  canRetry: error.recoverable,
})

/**
 * Update error state after a retry attempt.
 */
export const incrementRetry = (state: SearchErrorState): SearchErrorState => ({
  ...state,
  retryCount: state.retryCount + 1,
  canRetry: state.error.recoverable && state.retryCount + 1 < state.maxRetries,
})
