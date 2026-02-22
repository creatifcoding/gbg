/**
 * SemanticQueryEngine — combines DuckDB + EmbeddingService for semantic search
 * over questionnaire results stored in S3/MinIO.
 *
 * ## Error Hierarchy
 *
 * | Error                   | When                                        |
 * |-------------------------|---------------------------------------------|
 * | SemanticEmbedError      | Query embedding failed (wraps EmbeddingErr) |
 * | SemanticStorageError    | DuckDB/S3 read failed (wraps DuckDBErr)     |
 * | SemanticNoResultsError  | No results found in bucket (not a crash)    |
 * | SemanticParseError      | Result JSON malformed, can't extract fields  |
 * | SemanticQueryError      | Catch-all                                   |
 *
 * Upstream errors are preserved in `cause` — full chain is inspectable.
 *
 * @module
 */

import { Context, Data, Effect, Layer } from 'effect'
import { DuckDBClient, type DuckDBErrors } from './DuckDBClient.ts'
import { EmbeddingService, type EmbeddingErrors } from './EmbeddingService.ts'
import type { SemanticQuery, SemanticMatch, SemanticSearchResult } from './schemas.ts'

// =============================================================================
// Errors — Rich, Tagged, Forensic
// =============================================================================

/** Shared fields */
interface SemanticErrorFields {
  readonly message: string
  readonly query?: string
  readonly cause?: unknown
}

/** Query embedding failed — wraps EmbeddingErrors with context */
export class SemanticEmbedError extends Data.TaggedError('SemanticEmbedError')<
  SemanticErrorFields & {
    readonly provider?: string
    readonly model?: string
  }
> {}

/** DuckDB / S3 read failed — wraps DuckDBErrors with context */
export class SemanticStorageError extends Data.TaggedError('SemanticStorageError')<
  SemanticErrorFields & {
    readonly sql?: string
    readonly bucket?: string
  }
> {}

/** No results found in the bucket — informational, not a crash */
export class SemanticNoResultsError extends Data.TaggedError('SemanticNoResultsError')<
  SemanticErrorFields & {
    readonly bucket: string
    readonly filtersApplied: boolean
  }
> {}

/** Result JSON was malformed — couldn't extract embedding or answers */
export class SemanticParseError extends Data.TaggedError('SemanticParseError')<
  SemanticErrorFields & {
    readonly resultId?: string
    readonly field?: string
  }
> {}

/** Catch-all */
export class SemanticQueryError extends Data.TaggedError('SemanticQueryError')<SemanticErrorFields> {}

/** Union of all semantic query errors */
export type SemanticErrors =
  | SemanticEmbedError
  | SemanticStorageError
  | SemanticNoResultsError
  | SemanticParseError
  | SemanticQueryError

// =============================================================================
// Error Wrapping — Upstream → Semantic
// =============================================================================

/** Wrap an EmbeddingError into SemanticEmbedError, preserving forensic data */
const wrapEmbeddingError = (queryText: string) => (err: EmbeddingErrors): SemanticEmbedError =>
  new SemanticEmbedError({
    message: `Failed to embed query: ${err.message}`,
    query: queryText,
    provider: 'provider' in err ? (err as { provider: string }).provider : undefined,
    model: 'model' in err ? (err as { model: string }).model : undefined,
    cause: err,
  })

/** Wrap a DuckDBError into SemanticStorageError, preserving forensic data */
const wrapDuckDBError = (queryText: string) => (err: DuckDBErrors): SemanticStorageError =>
  new SemanticStorageError({
    message: `Failed to read results from storage: ${err.message}`,
    query: queryText,
    sql: 'sql' in err ? (err as { sql?: string }).sql : undefined,
    bucket: 'bucket' in err ? (err as { bucket?: string }).bucket : undefined,
    cause: err,
  })

// =============================================================================
// Service Interface
// =============================================================================

export interface SemanticQueryEngineShape {
  /** Run a semantic search over questionnaire results */
  readonly search: (
    query: SemanticQuery,
  ) => Effect.Effect<SemanticSearchResult, SemanticErrors>

  /** Embed a questionnaire result's answers for storage */
  readonly embedResult: (
    answerIndex: Record<string, string>,
  ) => Effect.Effect<ReadonlyArray<number>, SemanticErrors>
}

export class SemanticQueryEngine extends Context.Tag('questionnaire/SemanticQueryEngine')<
  SemanticQueryEngine,
  SemanticQueryEngineShape
>() {}

// =============================================================================
// Text Extraction Helpers
// =============================================================================

/** Flatten an answerIndex into a single embeddable text */
const answerIndexToText = (answerIndex: Record<string, string>): string =>
  Object.entries(answerIndex)
    .map(([qId, value]) => `${qId}: ${value}`)
    .join('. ')

/** Safely parse a JSON field that might be string or object */
const safeParse = <T>(raw: T | string | null | undefined): T | null => {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }
  return raw
}

/** Convert unknown answer payloads into readable strings */
const stringifyAnswerValue = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value && typeof value === 'object') {
    const maybeAnswer = value as { value?: unknown; label?: unknown }
    if (typeof maybeAnswer.value === 'string') return maybeAnswer.value
    if (typeof maybeAnswer.label === 'string') return maybeAnswer.label
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return ''
}

/**
 * Normalize persisted answerIndex variants into Record<string, string>.
 * Handles:
 * - canonical { [questionId]: string }
 * - array Answer[] legacy/heterogeneous shapes
 * - object values containing nested answer objects
 */
const normalizeAnswerIndex = (raw: unknown): Record<string, string> => {
  const parsed = safeParse<unknown>(raw)
  if (!parsed) return {}

  const assign = (out: Record<string, string>, key: unknown, value: unknown) => {
    const defaultKey = typeof key === 'string' ? key : String(key)
    if (value && typeof value === 'object') {
      const maybeAnswer = value as { questionId?: unknown; value?: unknown; label?: unknown }
      if (typeof maybeAnswer.questionId === 'string') {
        out[maybeAnswer.questionId] = stringifyAnswerValue(maybeAnswer.value ?? maybeAnswer.label ?? value)
        return
      }
    }
    out[defaultKey] = stringifyAnswerValue(value)
  }

  if (Array.isArray(parsed)) {
    const out: Record<string, string> = {}
    for (const item of parsed) {
      if (item && typeof item === 'object') {
        const answer = item as { questionId?: unknown; value?: unknown; label?: unknown }
        if (typeof answer.questionId === 'string') {
          out[answer.questionId] = stringifyAnswerValue(answer.value ?? answer.label ?? item)
        }
      }
    }
    return out
  }

  if (parsed instanceof Map) {
    const out: Record<string, string> = {}
    for (const [key, value] of parsed.entries()) {
      assign(out, key, value)
    }
    return out
  }

  if (typeof parsed === 'object') {
    const out: Record<string, string> = {}
    const entries = Object.entries(parsed as Record<string, unknown>)
    for (const [key, value] of entries) {
      assign(out, key, value)
    }

    // DuckDB can surface map-like structs that expose iterators but not own enumerable entries
    if (entries.length === 0 && typeof (parsed as { [Symbol.iterator]?: unknown })[Symbol.iterator] === 'function') {
      for (const pair of parsed as Iterable<unknown>) {
        if (Array.isArray(pair) && pair.length >= 2) {
          assign(out, pair[0], pair[1])
        }
      }
    }

    return out
  }

  return {}
}

/** Fallback: derive answerIndex from persisted result.answers payload */
const normalizeAnswerIndexFromResult = (raw: unknown): Record<string, string> => {
  const parsed = safeParse<unknown>(raw)
  if (!parsed || typeof parsed !== 'object') return {}

  const maybeResult = parsed as { answers?: unknown }
  if (!Array.isArray(maybeResult.answers)) return {}
  return normalizeAnswerIndex(maybeResult.answers)
}

/** Normalize persisted tag variants into a string array */
const normalizeTags = (raw: unknown): string[] => {
  const parsed = safeParse<unknown>(raw)
  if (!parsed) return []
  if (Array.isArray(parsed)) {
    return parsed.filter((t): t is string => typeof t === 'string')
  }
  if (typeof parsed === 'string') return [parsed]
  return []
}

// =============================================================================
// Live Implementation
// =============================================================================

export const SemanticQueryEngineLive: Layer.Layer<
  SemanticQueryEngine,
  never,
  DuckDBClient | EmbeddingService
> = Layer.effect(
  SemanticQueryEngine,
  Effect.gen(function* () {
    const db = yield* DuckDBClient
    const embeddings = yield* EmbeddingService

    const embedResult = Effect.fn('SemanticQueryEngine.embedResult')(
      (answerIndex: Record<string, string>) => {
        const text = answerIndexToText(answerIndex)
        if (text.trim().length === 0) {
          return Effect.succeed([] as ReadonlyArray<number>)
        }
        return embeddings.embed(text).pipe(
          Effect.mapError(
            (err): SemanticErrors =>
              new SemanticEmbedError({
                message: `Failed to embed result: ${err.message}`,
                provider: 'provider' in err ? (err as { provider: string }).provider : undefined,
                model: 'model' in err ? (err as { model: string }).model : undefined,
                cause: err,
              }),
          ),
        )
      },
    )

    const search = Effect.fn('SemanticQueryEngine.search')(
      (query: SemanticQuery) =>
        Effect.gen(function* () {
          const startMs = Date.now()

          // 1. Embed the query text
          const queryVector = yield* embeddings.embed(query.query).pipe(
            Effect.mapError(wrapEmbeddingError(query.query)),
          )

          // 2. Read results from S3 via DuckDB
          const whereClauses: string[] = []
          if (query.filters?.specId) {
            whereClauses.push(`specId = '${query.filters.specId}'`)
          }
          if (query.filters?.dateFrom) {
            whereClauses.push(`completedAt >= '${query.filters.dateFrom}'`)
          }
          if (query.filters?.dateTo) {
            whereClauses.push(`completedAt <= '${query.filters.dateTo}'`)
          }

          const whereStr = whereClauses.length > 0
            ? `WHERE ${whereClauses.join(' AND ')}`
            : ''

          const bucket = db.bucket
          const sql = `SELECT
            resultId, specId, completedAt, cancelled, tags, answerIndex, result, embedding
          FROM read_json(
            's3://${bucket}/results/**/*.json',
            ignore_errors = true,
            union_by_name = true
          )
          ${whereStr}`

          type ResultRow = {
            resultId: string
            specId: string
            completedAt: string
            cancelled: boolean
            tags: string[] | string | null
            answerIndex: unknown
            result: unknown
            embedding: number[] | string | null
          }

          const results = yield* db.query<ResultRow>(sql).pipe(
            Effect.mapError(wrapDuckDBError(query.query)),
            // Empty results from S3 glob are not errors — just empty array
            Effect.catchTag('SemanticStorageError', (err) => {
              // If the error is "no files found" type, return empty
              const msg = err.message.toLowerCase()
              if (msg.includes('no files') || msg.includes('glob') || msg.includes('no object')) {
                return Effect.succeed([] as ReadonlyArray<ResultRow>)
              }
              return Effect.fail(err)
            }),
          )

          // 3. Compute cosine similarity for each result
          const scored: Array<SemanticMatch & { score: number }> = []

          for (const row of results) {
            let answerIndex = normalizeAnswerIndex(row.answerIndex)
            if (Object.keys(answerIndex).length === 0) {
              answerIndex = normalizeAnswerIndexFromResult(row.result)
            }

            // Parse embedding — might be stored as JSON string or array
            let embeddingVec: ReadonlyArray<number> | null =
              safeParse<number[]>(row.embedding)

            // If no embedding stored, embed on the fly (slower but works)
            if (!embeddingVec || embeddingVec.length === 0) {
              const text = answerIndexToText(answerIndex)
              if (text.trim().length > 0) {
                embeddingVec = yield* embeddings.embed(text).pipe(
                  Effect.mapError(wrapEmbeddingError(query.query)),
                )
              }
            }

            if (!embeddingVec || embeddingVec.length === 0) continue

            const score = embeddings.cosineSimilarity(queryVector, embeddingVec)
            if (score < (query.minScore ?? 0.5)) continue

            // Parse tags
            const tags = normalizeTags(row.tags)

            // Filter by tags if specified
            if (query.filters?.tags && query.filters.tags.length > 0) {
              const hasAllTags = query.filters.tags.every((t) => tags.includes(t))
              if (!hasAllTags) continue
            }

            scored.push({
              resultId: row.resultId,
              specId: row.specId,
              score,
              matchedText: answerIndexToText(answerIndex),
              completedAt: row.completedAt,
              cancelled: row.cancelled ?? false,
              tags,
              answerIndex,
            })
          }

          // 4. Sort by score descending, take topK
          scored.sort((a, b) => b.score - a.score)
          const topK = query.topK ?? 10
          const matches = scored.slice(0, topK)

          const executionMs = Date.now() - startMs

          return {
            matches,
            query: query.query,
            totalScanned: results.length,
            executionMs,
          } as SemanticSearchResult
        }),
    )

    return SemanticQueryEngine.of({ search, embedResult })
  }),
)
