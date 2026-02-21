/**
 * GeniferSignalModel DDL — genifer.signals table (append-only)
 *
 * Quality signals accumulate on trees, elements, and composites.
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

export const createGeniferSignalsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS genifer.signals (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      target_type  TEXT NOT NULL CHECK (target_type IN ('element', 'tree', 'composite')),
      target_id    UUID NOT NULL,
      signal_type  TEXT NOT NULL CHECK (signal_type IN (
        'pipeline_score', 'human_rating', 'usage', 'repair',
        'reuse', 'promote', 'deprecate'
      )),
      value        REAL NOT NULL,
      metadata     JSONB,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_genifer_signals_target ON genifer.signals(target_type, target_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_genifer_signals_type   ON genifer.signals(signal_type)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_genifer_signals_time   ON genifer.signals(created_at DESC)`
})

/**
 * Materialized view for composite quality rankings.
 *
 * Composite score = 40% pipeline + 30% human + 30% usage.
 */
export const createCompositeRankingsView = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE MATERIALIZED VIEW IF NOT EXISTS genifer.composite_rankings AS
    SELECT
      c.id,
      c.name,
      c.usage_count,
      c.quality_score AS pipeline_score,
      c.human_rating,
      (
        COALESCE(c.quality_score, 0) * 0.4 +
        COALESCE(c.human_rating::real / 5.0, 0) * 0.3 +
        LEAST(c.usage_count::real / 100.0, 1.0) * 0.3
      ) AS composite_rank
    FROM genifer.composites c
    ORDER BY composite_rank DESC
  `

  yield* sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_composite_rankings_id ON genifer.composite_rankings(id)`
})
