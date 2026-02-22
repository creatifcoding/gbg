/**
 * EmbeddingService — DI-swappable text embedding via @effect/ai.
 *
 * Providers:
 *  - OpenAIEmbeddingLive: OpenAI text-embedding-3-small (default)
 *  - OllamaEmbeddingLive: Ollama via OpenAI-compat endpoint (future)
 *  - NoOpEmbeddingLive:   Zero vectors for testing
 *
 * ## Error Hierarchy
 *
 * All errors extend `EmbeddingErrorBase` and carry `_tag` for pattern matching:
 *
 * | Error                    | When                                      |
 * |--------------------------|-------------------------------------------|
 * | EmbeddingQuotaError      | 429 insufficient_quota / billing issue     |
 * | EmbeddingRateLimitError  | 429 rate_limit_exceeded                    |
 * | EmbeddingAuthError       | 401 invalid_api_key / 403 forbidden        |
 * | EmbeddingNetworkError    | DNS, TCP, TLS — request never sent         |
 * | EmbeddingTimeoutError    | Request or fiber timed out                 |
 * | EmbeddingProviderError   | 5xx or unrecognized provider error         |
 * | EmbeddingInputError      | Malformed input rejected by provider       |
 * | EmbeddingError           | Catch-all / unknown                        |
 *
 * Each error captures:
 * - `provider`: "openai" | "ollama" | "noop" | "unknown"
 * - `model`: model identifier
 * - `statusCode`: HTTP status when available
 * - `responseBody`: raw response body (truncated to 2KB)
 * - `requestUrl`: the endpoint URL
 * - `cause`: original upstream error
 *
 * @module
 */

import { Context, Data, Effect, Layer, Redacted, Schema } from 'effect'
import { AiError, EmbeddingModel } from '@effect/ai'
import { OpenAiClient, OpenAiEmbeddingModel } from '@effect/ai-openai'
import { FetchHttpClient } from '@effect/platform'

// =============================================================================
// Error Types — Rich, Tagged, Forensic
// =============================================================================

/** Shared fields across all embedding errors */
interface EmbeddingErrorFields {
  readonly message: string
  readonly provider: 'openai' | 'ollama' | 'noop' | 'unknown'
  readonly model: string
  readonly statusCode?: number
  readonly responseBody?: string
  readonly requestUrl?: string
  readonly cause?: unknown
}

/** Quota exhausted — billing issue, not transient */
export class EmbeddingQuotaError extends Data.TaggedError('EmbeddingQuotaError')<EmbeddingErrorFields> {}

/** Rate limited — transient, retry with backoff */
export class EmbeddingRateLimitError extends Data.TaggedError('EmbeddingRateLimitError')<
  EmbeddingErrorFields & {
    readonly retryAfterMs?: number
  }
> {}

/** Auth failure — bad key, revoked, wrong permissions */
export class EmbeddingAuthError extends Data.TaggedError('EmbeddingAuthError')<EmbeddingErrorFields> {}

/** Network / transport failure — never reached provider */
export class EmbeddingNetworkError extends Data.TaggedError('EmbeddingNetworkError')<EmbeddingErrorFields> {}

/** Timeout — request or fiber deadline exceeded */
export class EmbeddingTimeoutError extends Data.TaggedError('EmbeddingTimeoutError')<EmbeddingErrorFields> {}

/** Provider returned a server error (5xx) or unrecognized error */
export class EmbeddingProviderError extends Data.TaggedError('EmbeddingProviderError')<EmbeddingErrorFields> {}

/** Input rejected — too long, empty, encoding issue */
export class EmbeddingInputError extends Data.TaggedError('EmbeddingInputError')<EmbeddingErrorFields> {}

/** Catch-all for truly unknown errors */
export class EmbeddingError extends Data.TaggedError('EmbeddingError')<EmbeddingErrorFields> {}

/** Union of all embedding errors — use for exhaustive matching */
export type EmbeddingErrors =
  | EmbeddingQuotaError
  | EmbeddingRateLimitError
  | EmbeddingAuthError
  | EmbeddingNetworkError
  | EmbeddingTimeoutError
  | EmbeddingProviderError
  | EmbeddingInputError
  | EmbeddingError

// =============================================================================
// Error Classification — AiError → EmbeddingErrors
// =============================================================================

/** Truncate body to avoid giant strings in error objects */
const truncateBody = (body?: string, max = 2048): string | undefined =>
  body && body.length > max ? body.slice(0, max) + '…[truncated]' : body

/** Parse OpenAI error body for error type/code */
const parseOpenAIErrorBody = (body?: string): { type?: string; code?: string; message?: string } => {
  if (!body) return {}
  try {
    const parsed = JSON.parse(body)
    return {
      type: parsed?.error?.type,
      code: parsed?.error?.code,
      message: parsed?.error?.message,
    }
  } catch {
    return {}
  }
}

/**
 * Classify an @effect/ai AiError into a specific EmbeddingError variant.
 * This is the core discriminator — it reads status codes, error bodies,
 * and error types to produce a precise, actionable error.
 */
const classifyAiError = (
  err: AiError.AiError,
  provider: EmbeddingErrorFields['provider'],
  model: string,
): EmbeddingErrors => {
  const base = { provider, model, cause: err }

  switch (err._tag) {
    case 'HttpResponseError': {
      const status = err.response.status
      const body = truncateBody(err.body ?? undefined)
      const requestUrl = err.request.url
      const parsed = parseOpenAIErrorBody(err.body ?? undefined)
      const msg = parsed.message ?? err.message ?? `HTTP ${status}`
      const fields = { ...base, statusCode: status, responseBody: body, requestUrl }

      // 401 / 403 — auth
      if (status === 401 || status === 403) {
        return new EmbeddingAuthError({ ...fields, message: `Auth failed: ${msg}` })
      }

      // 429 — distinguish quota vs rate limit
      if (status === 429) {
        if (parsed.code === 'insufficient_quota' || parsed.type === 'insufficient_quota') {
          return new EmbeddingQuotaError({ ...fields, message: `Quota exhausted: ${msg}` })
        }
        // Parse Retry-After header if available
        const retryAfterRaw = err.response.headers?.['retry-after']
        const retryAfterMs = retryAfterRaw ? Number(retryAfterRaw) * 1000 : undefined
        return new EmbeddingRateLimitError({
          ...fields,
          message: `Rate limited: ${msg}`,
          retryAfterMs: retryAfterMs && !isNaN(retryAfterMs) ? retryAfterMs : undefined,
        })
      }

      // 400 — input error
      if (status === 400) {
        return new EmbeddingInputError({ ...fields, message: `Bad input: ${msg}` })
      }

      // 408 / 504 — timeout from server
      if (status === 408 || status === 504) {
        return new EmbeddingTimeoutError({ ...fields, message: `Server timeout: ${msg}` })
      }

      // 5xx — provider error
      if (status >= 500) {
        return new EmbeddingProviderError({ ...fields, message: `Provider error (${status}): ${msg}` })
      }

      // Anything else
      return new EmbeddingError({ ...fields, message: `Unexpected HTTP ${status}: ${msg}` })
    }

    case 'HttpRequestError': {
      const requestUrl = err.request.url
      const msg = err.description ?? err.message ?? 'Request failed'

      if (err.reason === 'Transport') {
        // Could be DNS, TCP reset, TLS handshake failure
        const lcMsg = msg.toLowerCase()
        if (lcMsg.includes('timeout') || lcMsg.includes('timed out') || lcMsg.includes('deadline')) {
          return new EmbeddingTimeoutError({
            ...base,
            requestUrl,
            message: `Request timeout: ${msg}`,
          })
        }
        return new EmbeddingNetworkError({
          ...base,
          requestUrl,
          message: `Network error: ${msg}`,
        })
      }

      return new EmbeddingError({
        ...base,
        requestUrl,
        message: `Request error (${err.reason}): ${msg}`,
      })
    }

    case 'MalformedInput':
      return new EmbeddingInputError({
        ...base,
        message: `Malformed input: ${err.description ?? err.message ?? 'unknown'}`,
      })

    case 'MalformedOutput':
      return new EmbeddingProviderError({
        ...base,
        message: `Malformed response: ${err.description ?? err.message ?? 'unknown'}`,
      })

    case 'UnknownError':
      return new EmbeddingError({
        ...base,
        message: `Unknown AI error: ${err.description ?? err.message ?? 'unknown'}`,
      })
  }
}

/**
 * Classify a non-AiError into an EmbeddingError.
 * Handles raw JS errors, timeouts, connection issues, etc.
 */
const classifyUnknownError = (
  err: unknown,
  provider: EmbeddingErrorFields['provider'],
  model: string,
  operation: string,
): EmbeddingErrors => {
  const base = { provider, model, cause: err }

  // Check if it's an AiError we can decompose
  if (AiError.isAiError(err)) {
    return classifyAiError(err as AiError.AiError, provider, model)
  }

  // Raw Error with message
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted')) {
      return new EmbeddingTimeoutError({ ...base, message: `${operation} timeout: ${err.message}` })
    }
    if (msg.includes('econnrefused') || msg.includes('enotfound') || msg.includes('network')) {
      return new EmbeddingNetworkError({ ...base, message: `${operation} network error: ${err.message}` })
    }
    if (msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('api key')) {
      return new EmbeddingAuthError({ ...base, message: `${operation} auth error: ${err.message}` })
    }
  }

  // Total fallback
  return new EmbeddingError({
    ...base,
    message: `${operation} failed: ${err instanceof Error ? err.message : String(err)}`,
  })
}

// =============================================================================
// Config
// =============================================================================

export class EmbeddingConfig extends Schema.Class<EmbeddingConfig>('EmbeddingConfig')({
  provider: Schema.optionalWith(
    Schema.Literal('openai', 'ollama', 'noop'),
    { default: () => 'openai' as const },
  ),
  model: Schema.optionalWith(Schema.String, {
    default: () => 'text-embedding-3-small',
  }),
  baseUrl: Schema.optional(Schema.String),
  dimensions: Schema.optionalWith(Schema.Number, { default: () => 1536 }),
}) {}

// =============================================================================
// Service Interface
// =============================================================================

export interface EmbeddingServiceShape {
  /** Embed a single text string into a vector */
  readonly embed: (text: string) => Effect.Effect<ReadonlyArray<number>, EmbeddingErrors>

  /** Batch embed multiple texts */
  readonly embedMany: (
    texts: ReadonlyArray<string>,
  ) => Effect.Effect<ReadonlyArray<ReadonlyArray<number>>, EmbeddingErrors>

  /** Pure cosine similarity between two vectors */
  readonly cosineSimilarity: (
    a: ReadonlyArray<number>,
    b: ReadonlyArray<number>,
  ) => number
}

export class EmbeddingService extends Context.Tag('questionnaire/EmbeddingService')<
  EmbeddingService,
  EmbeddingServiceShape
>() {}

// =============================================================================
// Cosine Similarity (pure, shared across all implementations)
// =============================================================================

export const cosineSimilarity = (a: ReadonlyArray<number>, b: ReadonlyArray<number>): number => {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    normA += a[i]! * a[i]!
    normB += b[i]! * b[i]!
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

// =============================================================================
// OpenAI Implementation
// =============================================================================

/**
 * Build the full @effect/ai layer stack for OpenAI embeddings.
 * EmbeddingModel depends on OpenAiClient depends on FetchHttpClient.
 */
const buildOpenAILayers = (options: {
  readonly apiKey: Redacted.Redacted
  readonly model: string
  readonly baseUrl?: string
  readonly dimensions: number
}): Layer.Layer<EmbeddingModel.EmbeddingModel> => {
  const clientLayer = OpenAiClient.layer({
    apiKey: options.apiKey,
    apiUrl: options.baseUrl,
  })

  const embeddingModelLayer = OpenAiEmbeddingModel.model(options.model, {
    mode: 'batched',
    dimensions: options.dimensions,
  })

  return embeddingModelLayer.pipe(
    Layer.provide(clientLayer),
    Layer.provide(FetchHttpClient.layer),
  )
}

/**
 * Wrap an EmbeddingModel.EmbeddingModel layer into an EmbeddingService layer.
 * The adapter translates between @effect/ai's AiError and our rich error hierarchy.
 */
const fromEmbeddingModel = (
  modelLayer: Layer.Layer<EmbeddingModel.EmbeddingModel>,
  provider: EmbeddingErrorFields['provider'],
  model: string,
): Layer.Layer<EmbeddingService> =>
  Layer.effect(
    EmbeddingService,
    Effect.gen(function* () {
      const embedder = yield* EmbeddingModel.EmbeddingModel

      const embed = Effect.fn('EmbeddingService.embed')(
        (text: string) =>
          embedder.embed(text).pipe(
            Effect.map((r) => r as unknown as ReadonlyArray<number>),
            Effect.mapError((e) => classifyUnknownError(e, provider, model, 'embed')),
          ),
      )

      const embedMany = Effect.fn('EmbeddingService.embedMany')(
        (texts: ReadonlyArray<string>) =>
          embedder.embedMany(texts).pipe(
            Effect.map((r) => r as unknown as ReadonlyArray<ReadonlyArray<number>>),
            Effect.mapError((e) => classifyUnknownError(e, provider, model, 'embedMany')),
          ),
      )

      return EmbeddingService.of({ embed, embedMany, cosineSimilarity })
    }),
  ).pipe(Layer.provide(modelLayer))

/**
 * OpenAI-backed embedding layer with explicit Redacted key.
 */
export const makeOpenAIEmbedding = (options: {
  readonly apiKey: Redacted.Redacted
  readonly model?: string
  readonly baseUrl?: string
  readonly dimensions?: number
}): Layer.Layer<EmbeddingService> => {
  const modelName = options.model ?? 'text-embedding-3-small'
  const modelLayer = buildOpenAILayers({
    apiKey: options.apiKey,
    model: modelName,
    baseUrl: options.baseUrl,
    dimensions: options.dimensions ?? 1536,
  })
  return fromEmbeddingModel(modelLayer, 'openai', modelName)
}

/**
 * Convenience: OpenAI embedding from process.env.OPENAI_API_KEY.
 * Key is never in plaintext — wrapped in Redacted throughout.
 */
export const OpenAIEmbeddingLive = (options?: {
  readonly model?: string
  readonly baseUrl?: string
  readonly dimensions?: number
}): Layer.Layer<EmbeddingService> => {
  const apiKey = Redacted.make(process.env.OPENAI_API_KEY ?? '')
  return makeOpenAIEmbedding({
    apiKey,
    model: options?.model ?? process.env.QUESTIONNAIRE_EMBEDDING_MODEL ?? 'text-embedding-3-small',
    baseUrl: options?.baseUrl ?? process.env.QUESTIONNAIRE_EMBEDDING_BASE_URL,
    dimensions: options?.dimensions ?? Number(process.env.QUESTIONNAIRE_EMBEDDING_DIMENSIONS ?? '1536'),
  })
}

/**
 * Convenience: Ollama via OpenAI-compat.
 * Uses a dummy Redacted key (Ollama doesn't check it).
 */
export const OllamaEmbeddingLive = (baseUrl?: string): Layer.Layer<EmbeddingService> =>
  makeOpenAIEmbedding({
    apiKey: Redacted.make('ollama'),
    model: process.env.QUESTIONNAIRE_EMBEDDING_MODEL ?? 'nomic-embed-text',
    baseUrl: baseUrl ?? process.env.QUESTIONNAIRE_EMBEDDING_BASE_URL ?? 'http://localhost:11434/v1',
    dimensions: Number(process.env.QUESTIONNAIRE_EMBEDDING_DIMENSIONS ?? '768'),
  })

// =============================================================================
// No-Op Implementation (for testing)
// =============================================================================

export const NoOpEmbeddingLive = (dimensions: number = 1536): Layer.Layer<EmbeddingService> =>
  Layer.succeed(
    EmbeddingService,
    EmbeddingService.of({
      embed: (_text: string) => Effect.succeed(new Array(dimensions).fill(0)),
      embedMany: (texts: ReadonlyArray<string>) =>
        Effect.succeed(texts.map(() => new Array(dimensions).fill(0))),
      cosineSimilarity,
    }),
  )
