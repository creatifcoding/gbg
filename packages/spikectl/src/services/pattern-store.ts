/**
 * Pattern Store Service - SQLite Backend via @gbg/ctl
 *
 * Effect-based service for managing spike patterns with autopoietic learning.
 * Uses @gbg/ctl persistence patterns for SQLite access.
 *
 * @skill spikectl/core
 */

import {
  createSqliteLayer,
  SqlClient,
  StorageError,
  getAppPaths,
  type TableDef,
} from "@gbg/ctl"
import { Context, Effect, Layer } from "effect"
import { SpikePattern, SpikeFix, HypothesisConfig } from "../schemas/index.js"

// =============================================================================
// Configuration
// =============================================================================

export const APP_PATHS = getAppPaths("spikectl")

// =============================================================================
// Database Schema
// =============================================================================

const PATTERNS_TABLE: TableDef = {
  name: "patterns",
  columns: `
    id TEXT PRIMARY KEY,
    error_signature TEXT NOT NULL,
    domain TEXT NOT NULL,
    hypothesis_template TEXT NOT NULL,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    last_used TEXT,
    tags TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  `,
  indexes: [
    `CREATE INDEX IF NOT EXISTS idx_patterns_domain ON patterns(domain)`,
    `CREATE INDEX IF NOT EXISTS idx_patterns_last_used ON patterns(last_used)`,
  ],
}

const FIXES_TABLE: TableDef = {
  name: "fixes",
  columns: `
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_id TEXT NOT NULL REFERENCES patterns(id),
    root_cause TEXT NOT NULL,
    fix TEXT NOT NULL,
    applied_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  `,
  indexes: [
    `CREATE INDEX IF NOT EXISTS idx_fixes_pattern_id ON fixes(pattern_id)`,
  ],
}

// =============================================================================
// Service Interface
// =============================================================================

export interface PatternStoreService {
  readonly initialize: () => Effect.Effect<void, StorageError>
  readonly findPattern: (id: string) => Effect.Effect<SpikePattern | null, StorageError>
  readonly matchPatterns: (error: string) => Effect.Effect<SpikePattern[], StorageError>
  readonly upsertPattern: (pattern: SpikePattern) => Effect.Effect<void, StorageError>
  readonly recordSuccess: (patternId: string, fix: SpikeFix) => Effect.Effect<void, StorageError>
  readonly recordFailure: (patternId: string) => Effect.Effect<void, StorageError>
  readonly listPatterns: (opts?: { limit?: number; offset?: number }) => Effect.Effect<SpikePattern[], StorageError>
  readonly getStats: () => Effect.Effect<PatternStats, StorageError>
  readonly successRate: (pattern: SpikePattern) => number
}

export interface PatternStats {
  readonly totalPatterns: number
  readonly totalFixes: number
  readonly topDomains: readonly { domain: string; count: number }[]
  readonly recentPatterns: readonly SpikePattern[]
  readonly avgSuccessRate: number
}

// =============================================================================
// Service Tag
// =============================================================================

export class PatternStore extends Context.Tag("spikectl/PatternStore")<
  PatternStore,
  PatternStoreService
>() {}

// =============================================================================
// Row Type Converters
// =============================================================================

interface PatternRow {
  id: string
  error_signature: string
  domain: string
  hypothesis_template: string
  success_count: number
  failure_count: number
  last_used: string | null
  tags: string
}

interface FixRow {
  id: number
  pattern_id: string
  root_cause: string
  fix: string
  applied_at: string
}

const parsePatternRow = (row: PatternRow, fixes: SpikeFix[]): SpikePattern => ({
  id: row.id,
  errorSignature: row.error_signature,
  domain: row.domain,
  hypothesisTemplate: JSON.parse(row.hypothesis_template) as HypothesisConfig[],
  successCount: row.success_count,
  failureCount: row.failure_count,
  lastUsed: row.last_used,
  fixes,
  tags: JSON.parse(row.tags) as string[],
})

const parseFixRow = (row: FixRow): SpikeFix => ({
  rootCause: row.root_cause,
  fix: row.fix,
  appliedAt: row.applied_at,
})

// =============================================================================
// Service Implementation
// =============================================================================

export const PatternStoreLive = Layer.effect(
  PatternStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    // Local ensureTable that uses our already-acquired sql client
    const ensureTableLocal = (table: TableDef) =>
      Effect.gen(function* () {
        yield* sql.unsafe(`
          CREATE TABLE IF NOT EXISTS ${table.name} (
            ${table.columns}
          )
        `).pipe(
          Effect.mapError((e) => new StorageError({
            operation: `CREATE TABLE ${table.name}`,
            path: APP_PATHS.db,
            cause: String(e),
          }))
        )

        if (table.indexes) {
          for (const indexDef of table.indexes) {
            yield* sql.unsafe(indexDef).pipe(
              Effect.catchAll(() => Effect.void)
            )
          }
        }
      })

    const initialize = (): Effect.Effect<void, StorageError> =>
      Effect.gen(function* () {
        yield* ensureTableLocal(PATTERNS_TABLE)
        yield* ensureTableLocal(FIXES_TABLE)
      })

    const getFixesForPattern = (patternId: string): Effect.Effect<SpikeFix[], StorageError> =>
      Effect.gen(function* () {
        const rows = yield* sql<FixRow>`
          SELECT * FROM fixes WHERE pattern_id = ${patternId} ORDER BY applied_at DESC
        `.pipe(
          Effect.mapError((e) => new StorageError({
            operation: "get fixes",
            path: APP_PATHS.db,
            cause: String(e),
          }))
        )
        return rows.map(parseFixRow)
      })

    const findPattern = (id: string): Effect.Effect<SpikePattern | null, StorageError> =>
      Effect.gen(function* () {
        const rows = yield* sql<PatternRow>`
          SELECT * FROM patterns WHERE id = ${id}
        `.pipe(
          Effect.mapError((e) => new StorageError({
            operation: "find pattern",
            path: APP_PATHS.db,
            cause: String(e),
          }))
        )

        if (rows.length === 0) return null

        const fixes = yield* getFixesForPattern(id)
        return parsePatternRow(rows[0], fixes)
      })

    const matchPatterns = (error: string): Effect.Effect<SpikePattern[], StorageError> =>
      Effect.gen(function* () {
        const rows = yield* sql<PatternRow>`
          SELECT * FROM patterns ORDER BY success_count DESC
        `.pipe(
          Effect.mapError((e) => new StorageError({
            operation: "match patterns",
            path: APP_PATHS.db,
            cause: String(e),
          }))
        )

        const matched: SpikePattern[] = []
        for (const row of rows) {
          try {
            const regex = new RegExp(row.error_signature, "i")
            if (regex.test(error)) {
              const fixes = yield* getFixesForPattern(row.id)
              matched.push(parsePatternRow(row, fixes))
            }
          } catch {
            // Fallback to substring match
            if (error.toLowerCase().includes(row.error_signature.toLowerCase())) {
              const fixes = yield* getFixesForPattern(row.id)
              matched.push(parsePatternRow(row, fixes))
            }
          }
        }

        return matched.sort((a, b) => successRate(b) - successRate(a))
      })

    const successRate = (pattern: SpikePattern): number => {
      const total = pattern.successCount + pattern.failureCount
      return total > 0 ? pattern.successCount / total : 0
    }

    const upsertPattern = (pattern: SpikePattern): Effect.Effect<void, StorageError> =>
      Effect.gen(function* () {
        const hypothesisJson = JSON.stringify(pattern.hypothesisTemplate)
        const tagsJson = JSON.stringify(pattern.tags)
        const now = new Date().toISOString()

        yield* sql`
          INSERT INTO patterns (id, error_signature, domain, hypothesis_template, success_count, failure_count, last_used, tags, updated_at)
          VALUES (${pattern.id}, ${pattern.errorSignature}, ${pattern.domain}, ${hypothesisJson}, ${pattern.successCount}, ${pattern.failureCount}, ${pattern.lastUsed}, ${tagsJson}, ${now})
          ON CONFLICT(id) DO UPDATE SET
            error_signature = excluded.error_signature,
            domain = excluded.domain,
            hypothesis_template = excluded.hypothesis_template,
            success_count = excluded.success_count,
            failure_count = excluded.failure_count,
            last_used = excluded.last_used,
            tags = excluded.tags,
            updated_at = excluded.updated_at
        `.pipe(
          Effect.mapError((e) => new StorageError({
            operation: "upsert pattern",
            path: APP_PATHS.db,
            cause: String(e),
          }))
        )

        // Insert fixes that don't exist
        for (const fix of pattern.fixes) {
          yield* sql`
            INSERT OR IGNORE INTO fixes (pattern_id, root_cause, fix, applied_at)
            VALUES (${pattern.id}, ${fix.rootCause}, ${fix.fix}, ${fix.appliedAt})
          `.pipe(
            Effect.mapError((e) => new StorageError({
              operation: "insert fix",
              path: APP_PATHS.db,
              cause: String(e),
            }))
          )
        }
      })

    const recordSuccess = (patternId: string, fix: SpikeFix): Effect.Effect<void, StorageError> =>
      Effect.gen(function* () {
        const now = new Date().toISOString().split("T")[0]

        yield* sql`
          UPDATE patterns
          SET success_count = success_count + 1, last_used = ${now}, updated_at = ${new Date().toISOString()}
          WHERE id = ${patternId}
        `.pipe(
          Effect.mapError((e) => new StorageError({
            operation: "record success",
            path: APP_PATHS.db,
            cause: String(e),
          }))
        )

        yield* sql`
          INSERT INTO fixes (pattern_id, root_cause, fix, applied_at)
          VALUES (${patternId}, ${fix.rootCause}, ${fix.fix}, ${fix.appliedAt})
        `.pipe(
          Effect.mapError((e) => new StorageError({
            operation: "insert fix",
            path: APP_PATHS.db,
            cause: String(e),
          }))
        )
      })

    const recordFailure = (patternId: string): Effect.Effect<void, StorageError> =>
      sql`
        UPDATE patterns
        SET failure_count = failure_count + 1, last_used = ${new Date().toISOString().split("T")[0]}, updated_at = ${new Date().toISOString()}
        WHERE id = ${patternId}
      `.pipe(
        Effect.mapError((e) => new StorageError({
          operation: "record failure",
          path: APP_PATHS.db,
          cause: String(e),
        })),
        Effect.asVoid
      )

    const listPatterns = (opts?: { limit?: number; offset?: number }): Effect.Effect<SpikePattern[], StorageError> =>
      Effect.gen(function* () {
        const limit = opts?.limit ?? 50
        const offset = opts?.offset ?? 0

        const rows = yield* sql<PatternRow>`
          SELECT * FROM patterns
          ORDER BY updated_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `.pipe(
          Effect.mapError((e) => new StorageError({
            operation: "list patterns",
            path: APP_PATHS.db,
            cause: String(e),
          }))
        )

        const patterns: SpikePattern[] = []
        for (const row of rows) {
          const fixes = yield* getFixesForPattern(row.id)
          patterns.push(parsePatternRow(row, fixes))
        }
        return patterns
      })

    const getStats = (): Effect.Effect<PatternStats, StorageError> =>
      Effect.gen(function* () {
        const [countResult] = yield* sql<{ count: number }>`
          SELECT COUNT(*) as count FROM patterns
        `.pipe(
          Effect.mapError((e) => new StorageError({
            operation: "count patterns",
            path: APP_PATHS.db,
            cause: String(e),
          }))
        )

        const [fixCountResult] = yield* sql<{ count: number }>`
          SELECT COUNT(*) as count FROM fixes
        `.pipe(
          Effect.mapError((e) => new StorageError({
            operation: "count fixes",
            path: APP_PATHS.db,
            cause: String(e),
          }))
        )

        const topDomains = yield* sql<{ domain: string; count: number }>`
          SELECT domain, COUNT(*) as count FROM patterns
          GROUP BY domain ORDER BY count DESC LIMIT 5
        `.pipe(
          Effect.mapError((e) => new StorageError({
            operation: "top domains",
            path: APP_PATHS.db,
            cause: String(e),
          }))
        )

        const recentPatterns = yield* listPatterns({ limit: 5 })

        const [avgResult] = yield* sql<{ avg_rate: number | null }>`
          SELECT AVG(CAST(success_count AS REAL) / NULLIF(success_count + failure_count, 0)) as avg_rate
          FROM patterns
        `.pipe(
          Effect.mapError((e) => new StorageError({
            operation: "avg success rate",
            path: APP_PATHS.db,
            cause: String(e),
          }))
        )

        return {
          totalPatterns: countResult?.count ?? 0,
          totalFixes: fixCountResult?.count ?? 0,
          topDomains: [...topDomains],
          recentPatterns,
          avgSuccessRate: avgResult?.avg_rate ?? 0,
        }
      })

    // Initialize on service creation
    yield* initialize()

    return {
      initialize,
      findPattern,
      matchPatterns,
      upsertPattern,
      recordSuccess,
      recordFailure,
      listPatterns,
      getStats,
      successRate,
    }
  })
)

// =============================================================================
// Layer Factory
// =============================================================================

/**
 * Ensure XDG data directory exists
 */
const ensureDataDir = () =>
  Effect.sync(() => {
    const fs = require("node:fs")
    const dir = APP_PATHS.db.substring(0, APP_PATHS.db.lastIndexOf("/"))
    fs.mkdirSync(dir, { recursive: true })
  }).pipe(Effect.ignore)

/**
 * Create the full PatternStore layer with SQLite client via @gbg/ctl
 */
export const makePatternStoreLayer = () =>
  Layer.unwrapEffect(
    Effect.gen(function* () {
      yield* ensureDataDir()
      return PatternStoreLive.pipe(
        Layer.provide(createSqliteLayer({ filename: APP_PATHS.db }))
      )
    })
  )

// Re-export StorageError for commands to use
export { StorageError } from "@gbg/ctl"
