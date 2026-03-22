/**
 * AI Core Error Schemas
 *
 * Typed error taxonomy using Effect Schema TaggedStruct pattern.
 * All errors are discriminated by _tag for exhaustive pattern matching.
 *
 * Error categories:
 * - Connection: Network/server issues
 * - Stream: SSE parsing, protocol issues
 * - Provider: Configuration issues
 * - Tool: MCP tool execution failures
 */

import { Option, Schema } from 'effect'

// =============================================================================
// Connection Error
// =============================================================================

/**
 * Network/server connection failures
 * Includes retry hint for transient failures
 */
export class AICoreConnectionError extends Schema.TaggedClass<AICoreConnectionError>()(
  'AICoreConnectionError',
  {
    timestamp: Schema.Number,
    requestId: Schema.NullOr(Schema.String),
    url: Schema.String,
    cause: Schema.String,
    retryable: Schema.Boolean,
  }
) {
  static create(
    url: string,
    cause: unknown,
    retryable = true,
    requestId?: string
  ): AICoreConnectionError {
    return new AICoreConnectionError({
      url,
      cause: cause instanceof Error ? cause.message : String(cause),
      retryable,
      timestamp: Date.now(),
      requestId: requestId ?? null,
    })
  }
}

// =============================================================================
// Stream Error
// =============================================================================

/**
 * Streaming phase where error occurred
 */
export const StreamPhase = Schema.Literal('connect', 'read', 'parse', 'decode', 'abort')
export type StreamPhase = typeof StreamPhase.Type

/**
 * SSE streaming and parsing errors
 */
export class AICoreStreamError extends Schema.TaggedClass<AICoreStreamError>()(
  'AICoreStreamError',
  {
    timestamp: Schema.Number,
    requestId: Schema.NullOr(Schema.String),
    phase: StreamPhase,
    message: Schema.String,
    rawChunk: Schema.NullOr(Schema.String),
  }
) {
  static create(
    phase: StreamPhase,
    message: string,
    rawChunk?: string,
    requestId?: string
  ): AICoreStreamError {
    return new AICoreStreamError({
      phase,
      message,
      rawChunk: rawChunk ?? null,
      timestamp: Date.now(),
      requestId: requestId ?? null,
    })
  }
}

// =============================================================================
// Provider Errors
// =============================================================================

/**
 * Provider not found in registry
 */
export class AICoreProviderNotFoundError extends Schema.TaggedClass<AICoreProviderNotFoundError>()(
  'AICoreProviderNotFoundError',
  {
    timestamp: Schema.Number,
    requestId: Schema.NullOr(Schema.String),
    providerName: Schema.String,
    availableProviders: Schema.Array(Schema.String),
  }
) {
  static create(
    providerName: string,
    availableProviders: readonly string[],
    requestId?: string
  ): AICoreProviderNotFoundError {
    return new AICoreProviderNotFoundError({
      providerName,
      availableProviders: [...availableProviders],
      timestamp: Date.now(),
      requestId: requestId ?? null,
    })
  }
}

/**
 * Provider already registered (duplicate)
 */
export class AICoreProviderExistsError extends Schema.TaggedClass<AICoreProviderExistsError>()(
  'AICoreProviderExistsError',
  {
    timestamp: Schema.Number,
    requestId: Schema.NullOr(Schema.String),
    providerName: Schema.String,
  }
) {
  static create(providerName: string, requestId?: string): AICoreProviderExistsError {
    return new AICoreProviderExistsError({
      providerName,
      timestamp: Date.now(),
      requestId: requestId ?? null,
    })
  }
}

/**
 * Provider misconfigured (missing required config)
 */
export class AICoreProviderConfigError extends Schema.TaggedClass<AICoreProviderConfigError>()(
  'AICoreProviderConfigError',
  {
    timestamp: Schema.Number,
    requestId: Schema.NullOr(Schema.String),
    providerName: Schema.String,
    field: Schema.String,
    reason: Schema.String,
  }
) {
  static create(
    providerName: string,
    field: string,
    reason: string,
    requestId?: string
  ): AICoreProviderConfigError {
    return new AICoreProviderConfigError({
      providerName,
      field,
      reason,
      timestamp: Date.now(),
      requestId: requestId ?? null,
    })
  }
}

// =============================================================================
// Tool Errors
// =============================================================================

/**
 * MCP tool execution failure
 */
export class AICoreToolExecutionError extends Schema.TaggedClass<AICoreToolExecutionError>()(
  'AICoreToolExecutionError',
  {
    timestamp: Schema.Number,
    requestId: Schema.NullOr(Schema.String),
    toolName: Schema.String,
    serverId: Schema.String,
    cause: Schema.String,
    args: Schema.NullOr(Schema.Unknown),
  }
) {
  static create(
    toolName: string,
    serverId: string,
    cause: unknown,
    args?: unknown,
    requestId?: string
  ): AICoreToolExecutionError {
    return new AICoreToolExecutionError({
      toolName,
      serverId,
      cause: cause instanceof Error ? cause.message : String(cause),
      args: args ?? null,
      timestamp: Date.now(),
      requestId: requestId ?? null,
    })
  }
}

/**
 * Tool not found in any connected MCP server
 */
export class AICoreToolNotFoundError extends Schema.TaggedClass<AICoreToolNotFoundError>()(
  'AICoreToolNotFoundError',
  {
    timestamp: Schema.Number,
    requestId: Schema.NullOr(Schema.String),
    toolName: Schema.String,
    availableTools: Schema.Array(Schema.String),
  }
) {
  static create(
    toolName: string,
    availableTools: readonly string[],
    requestId?: string
  ): AICoreToolNotFoundError {
    return new AICoreToolNotFoundError({
      toolName,
      availableTools: [...availableTools],
      timestamp: Date.now(),
      requestId: requestId ?? null,
    })
  }
}

// =============================================================================
// Error Union
// =============================================================================

/**
 * Union of all AI Core errors for exhaustive handling
 */
export const AICoreError = Schema.Union(
  AICoreConnectionError,
  AICoreStreamError,
  AICoreProviderNotFoundError,
  AICoreProviderExistsError,
  AICoreProviderConfigError,
  AICoreToolExecutionError,
  AICoreToolNotFoundError
)
export type AICoreError = typeof AICoreError.Type

// =============================================================================
// Error Utilities
// =============================================================================

/**
 * Check if error is retryable
 */
export const isRetryable = (error: AICoreError): boolean => {
  switch (error._tag) {
    case 'AICoreConnectionError':
      return error.retryable
    case 'AICoreStreamError':
      return error.phase === 'read' || error.phase === 'connect'
    case 'AICoreToolExecutionError':
      return true // Tool execution can be retried
    default:
      return false
  }
}

/**
 * Get user-friendly error message
 */
export const getErrorMessage = (error: AICoreError): string => {
  switch (error._tag) {
    case 'AICoreConnectionError':
      return `Connection failed: ${error.cause}`
    case 'AICoreStreamError':
      return `Stream error (${error.phase}): ${error.message}`
    case 'AICoreProviderNotFoundError':
      return `Provider "${error.providerName}" not found. Available: ${error.availableProviders.join(', ')}`
    case 'AICoreProviderExistsError':
      return `Provider "${error.providerName}" already exists`
    case 'AICoreProviderConfigError':
      return `Provider "${error.providerName}" config error: ${error.field} - ${error.reason}`
    case 'AICoreToolExecutionError':
      return `Tool "${error.toolName}" failed: ${error.cause}`
    case 'AICoreToolNotFoundError':
      return `Tool "${error.toolName}" not found`
  }
}
