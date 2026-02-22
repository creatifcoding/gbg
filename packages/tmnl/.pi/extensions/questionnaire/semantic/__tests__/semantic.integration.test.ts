/**
 * Semantic search integration tests.
 *
 * Tests:
 *  - EmbeddingService (NoOp + OpenAI live)
 *  - DuckDBClient reading from MinIO
 *  - SemanticQueryEngine end-to-end
 *  - cosine similarity math
 *
 * Requires:
 *  - MinIO running at localhost:9000
 *  - LD_LIBRARY_PATH includes libstdc++.so.6 (for DuckDB native)
 *  - OPENAI_API_KEY in .env for live embedding tests
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Effect, Layer, Scope, Redacted } from 'effect'
import {
  EmbeddingService,
  NoOpEmbeddingLive,
  cosineSimilarity,
  makeOpenAIEmbedding,
} from '../EmbeddingService.ts'
import {
  DuckDBClient,
  DuckDBConfig,
  DuckDBClientLive,
  DuckDBError,
} from '../DuckDBClient.ts'
import {
  SemanticQueryEngine,
  SemanticQueryEngineLive,
} from '../SemanticQueryEngine.ts'
import type { SemanticQuery } from '../schemas.ts'

// Load .env
import * as fs from 'node:fs'
import * as path from 'node:path'
const envPath = path.join(__dirname, '../../.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq > 0 && !process.env[t.slice(0, eq).trim()])
      process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const runScoped = <A, E>(
  effect: Effect.Effect<A, E, Scope.Scope>,
): Promise<A> => Effect.runPromise(Effect.scoped(effect))

const minioConfig = new DuckDBConfig({
  s3Endpoint: 'localhost:9000',
  s3AccessKeyId: 'minioadmin',
  s3SecretAccessKey: 'minioadmin',
  s3Bucket: 'questionnaires',
  s3UrlStyle: 'path',
  s3UseSsl: false,
})

// ─── Cosine Similarity (pure math, no deps) ─────────────────────────────────

describe('cosineSimilarity', () => {
  it('identical vectors → 1.0', () => {
    const a = [1, 0, 0, 1]
    expect(cosineSimilarity(a, a)).toBeCloseTo(1.0, 5)
  })

  it('orthogonal vectors → 0.0', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0, 5)
  })

  it('opposite vectors → -1.0', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0, 5)
  })

  it('empty vectors → 0', () => {
    expect(cosineSimilarity([], [])).toBe(0)
  })

  it('mismatched lengths → 0', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0)
  })

  it('zero vectors → 0', () => {
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0)
  })
})

// ─── NoOp Embedding ──────────────────────────────────────────────────────────

describe('NoOpEmbeddingLive', () => {
  const layer = NoOpEmbeddingLive(384)

  it('embed returns zero vector of correct dimensions', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* EmbeddingService
        return yield* svc.embed('hello world')
      }).pipe(Effect.provide(layer)),
    )
    expect(result).toHaveLength(384)
    expect(result.every((v) => v === 0)).toBe(true)
  })

  it('embedMany returns one vector per input', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* EmbeddingService
        return yield* svc.embedMany(['a', 'b', 'c'])
      }).pipe(Effect.provide(layer)),
    )
    expect(result).toHaveLength(3)
    expect(result[0]).toHaveLength(384)
  })

  it('cosineSimilarity is accessible from service', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* EmbeddingService
        return svc.cosineSimilarity([1, 0], [0, 1])
      }).pipe(Effect.provide(layer)),
    )
    expect(result).toBeCloseTo(0, 5)
  })
})

// ─── DuckDB: In-Memory ──────────────────────────────────────────────────────

describe('DuckDBClient (in-memory)', () => {
  const memConfig = new DuckDBConfig({ databasePath: ':memory:' })

  it('runs basic SQL', async () => {
    const result = await runScoped(
      Effect.gen(function* () {
        const db = yield* DuckDBClient
        return yield* db.query<{ answer: number }>('SELECT 42 AS answer')
      }).pipe(Effect.provide(DuckDBClientLive(memConfig))),
    )
    expect(result).toHaveLength(1)
    expect(result[0].answer).toBe(42)
  })

  it('execute works (CREATE TABLE)', async () => {
    await runScoped(
      Effect.gen(function* () {
        const db = yield* DuckDBClient
        yield* db.execute('CREATE TABLE test (id INT, name VARCHAR)')
        yield* db.execute("INSERT INTO test VALUES (1, 'alice'), (2, 'bob')")
        const rows = yield* db.query<{ id: number; name: string }>('SELECT * FROM test ORDER BY id')
        expect(rows).toHaveLength(2)
        expect(rows[0].name).toBe('alice')
      }).pipe(Effect.provide(DuckDBClientLive(memConfig))),
    )
  })

  it('bad SQL yields DuckDBError', async () => {
    const result = await runScoped(
      Effect.gen(function* () {
        const db = yield* DuckDBClient
        return yield* db.query('SELECT * FROM nonexistent_table_xyz')
      }).pipe(
        Effect.provide(DuckDBClientLive(memConfig)),
        Effect.flip,
      ),
    )
    expect(result._tag).toBe('DuckDBError')
  })
})

// ─── DuckDB: MinIO S3 Reads ─────────────────────────────────────────────────

describe('DuckDBClient (MinIO)', () => {
  it('reads questionnaire results from S3', async () => {
    const result = await runScoped(
      Effect.gen(function* () {
        const db = yield* DuckDBClient
        return yield* db.query<{ specId: string; resultId: string }>(
          `SELECT specId, resultId
           FROM read_json('s3://${db.bucket}/results/**/*.json', ignore_errors=true, union_by_name=true)
           LIMIT 10`,
        )
      }).pipe(Effect.provide(DuckDBClientLive(minioConfig))),
    )
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('specId')
    expect(result[0]).toHaveProperty('resultId')
  })

  it('runs SQL aggregation over S3 data', async () => {
    const result = await runScoped(
      Effect.gen(function* () {
        const db = yield* DuckDBClient
        return yield* db.query<{ specId: string; count: string }>(
          `SELECT specId, COUNT(*) as count
           FROM read_json('s3://${db.bucket}/results/**/*.json', ignore_errors=true, union_by_name=true)
           GROUP BY specId`,
        )
      }).pipe(Effect.provide(DuckDBClientLive(minioConfig))),
    )
    expect(result.length).toBeGreaterThan(0)
    expect(Number(result[0].count)).toBeGreaterThan(0)
  })

  it('reads embedding field from stored results', async () => {
    const result = await runScoped(
      Effect.gen(function* () {
        const db = yield* DuckDBClient
        return yield* db.query<{ resultId: string; has_embedding: boolean }>(
          `SELECT resultId, embedding IS NOT NULL as has_embedding
           FROM read_json('s3://${db.bucket}/results/**/*.json', ignore_errors=true, union_by_name=true)
           LIMIT 5`,
        )
      }).pipe(Effect.provide(DuckDBClientLive(minioConfig))),
    )
    expect(result.length).toBeGreaterThan(0)
  })
})

// ─── SemanticQueryEngine (NoOp embeddings + DuckDB) ──────────────────────────

describe('SemanticQueryEngine (NoOp + MinIO)', () => {
  const engineLayer = SemanticQueryEngineLive.pipe(
    Layer.provide(DuckDBClientLive(minioConfig)),
    Layer.provide(NoOpEmbeddingLive()),
  )

  it('search returns results (noop = zero similarity, lowered threshold)', async () => {
    const result = await runScoped(
      Effect.gen(function* () {
        const engine = yield* SemanticQueryEngine
        return yield* engine.search({
          query: 'performance problems',
          topK: 5,
          minScore: -1, // noop vectors, accept everything
        } satisfies SemanticQuery)
      }).pipe(Effect.provide(engineLayer)),
    )
    // With noop embeddings, cosine(zero, zero) = 0, so minScore -1 catches all
    expect(result.totalScanned).toBeGreaterThan(0)
    expect(result.executionMs).toBeGreaterThanOrEqual(0)
  })

  it('embedResult produces vector from answerIndex', async () => {
    const result = await runScoped(
      Effect.gen(function* () {
        const engine = yield* SemanticQueryEngine
        return yield* engine.embedResult({ q1: 'speed', q2: 'slow rendering' })
      }).pipe(Effect.provide(engineLayer)),
    )
    expect(result).toHaveLength(1536)
  })

  it('search respects specId filter', async () => {
    const result = await runScoped(
      Effect.gen(function* () {
        const engine = yield* SemanticQueryEngine
        return yield* engine.search({
          query: 'anything',
          topK: 100,
          minScore: -1,
          filters: { specId: 'perf-check' },
        } satisfies SemanticQuery)
      }).pipe(Effect.provide(engineLayer)),
    )
    for (const match of result.matches) {
      expect(match.specId).toBe('perf-check')
    }
  })
})

// ─── OpenAI Live Embeddings ─────────────────────────────────────────────────

const hasOpenAIKey = !!process.env.OPENAI_API_KEY

describe.skipIf(!hasOpenAIKey)('OpenAI Embeddings (live)', () => {
  const layer = makeOpenAIEmbedding({
    apiKey: Redacted.make(process.env.OPENAI_API_KEY ?? ''),
    model: 'text-embedding-3-small',
    dimensions: 1536,
  })

  it('embeds text and returns 1536-dim vector', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* EmbeddingService
        return yield* svc.embed('AG-Grid rendering is slow with 2000 rows')
      }).pipe(Effect.provide(layer), Effect.scoped),
    )
    expect(result).toHaveLength(1536)
    expect(result.filter((v) => v !== 0).length).toBeGreaterThan(100)
  })

  it('similar texts have high cosine similarity', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* EmbeddingService
        const base = yield* svc.embed('AG-Grid is slow with large datasets')
        const similar = yield* svc.embed('Data grid rendering performance is poor with many rows')
        const unrelated = yield* svc.embed('I enjoy cooking pasta on weekends')
        return {
          simScore: svc.cosineSimilarity(base, similar),
          unrelatedScore: svc.cosineSimilarity(base, unrelated),
        }
      }).pipe(Effect.provide(layer), Effect.scoped),
    )
    expect(result.simScore).toBeGreaterThan(0.7)
    expect(result.unrelatedScore).toBeLessThan(0.5)
    expect(result.simScore).toBeGreaterThan(result.unrelatedScore)
  })

  it('embedMany batches correctly', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* EmbeddingService
        return yield* svc.embedMany(['hello', 'world', 'test'])
      }).pipe(Effect.provide(layer), Effect.scoped),
    )
    expect(result).toHaveLength(3)
    for (const vec of result) {
      expect(vec).toHaveLength(1536)
    }
  })
})

// ─── Full E2E: OpenAI + DuckDB + SemanticQueryEngine ─────────────────────────

describe.skipIf(!hasOpenAIKey)('SemanticQueryEngine E2E (OpenAI + MinIO)', () => {
  const engineLayer = SemanticQueryEngineLive.pipe(
    Layer.provide(DuckDBClientLive(minioConfig)),
    Layer.provide(
      makeOpenAIEmbedding({
        apiKey: Redacted.make(process.env.OPENAI_API_KEY ?? ''),
        model: 'text-embedding-3-small',
        dimensions: 1536,
      }),
    ),
  )

  it('semantic search finds relevant questionnaire results', async () => {
    const result = await runScoped(
      Effect.gen(function* () {
        const engine = yield* SemanticQueryEngine
        return yield* engine.search({
          query: 'rendering performance with data grids',
          topK: 5,
          minScore: 0.3,
        })
      }).pipe(Effect.provide(engineLayer)),
    )
    expect(result.totalScanned).toBeGreaterThan(0)
    expect(result.executionMs).toBeGreaterThanOrEqual(0)
    console.log(`Semantic search: scanned ${result.totalScanned}, found ${result.matches.length} matches in ${result.executionMs}ms`)
    for (const m of result.matches) {
      console.log(`  ${m.specId}/${m.resultId}: score=${m.score.toFixed(3)} text="${m.matchedText.slice(0, 60)}"`)
    }
  })
})
