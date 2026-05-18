/**
 * ReactorCheckpointModel DDL.
 *
 * Stores processed EventJournal entry ids per Reactor consumer so replay and
 * warm delivery can be deduplicated across restarts.
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

export const createReactorCheckpointsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.reactor_checkpoints (
      consumer_id      TEXT NOT NULL,
      source_entry_id  TEXT NOT NULL,
      source_event     TEXT NOT NULL,
      primary_key      TEXT NOT NULL,
      outcome          TEXT NOT NULL CHECK (outcome IN ('processed', 'skipped', 'failed')),
      processed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,

      PRIMARY KEY (consumer_id, source_entry_id)
    )
  `

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_reactor_checkpoints_consumer_processed_at
    ON iiot.reactor_checkpoints (consumer_id, processed_at DESC)
  `

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_reactor_checkpoints_source_event
    ON iiot.reactor_checkpoints (source_event, processed_at DESC)
  `
})
