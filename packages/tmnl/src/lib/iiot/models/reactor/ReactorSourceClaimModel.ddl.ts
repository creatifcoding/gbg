/**
 * ReactorSourceClaimModel DDL.
 *
 * Stores source-entry processing authority for Reactor consumers. Claims are
 * acquired before graph planning and target dispatch so warm/cold delivery races
 * cannot process the same EventJournal entry twice under different policy
 * epochs.
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'
import {
  ReactorCheckpointOutcomes,
  ReactorClaimPhases,
  ReactorClaimStatuses,
} from '../../schemas/reactor'
import { enumValues, sqlTextLiteral, sqlTextLiteralList } from '../_ddl-helpers'

const CLAIM_STATUSES_SQL = sqlTextLiteralList(enumValues(ReactorClaimStatuses))
const CLAIM_PHASES_SQL = sqlTextLiteralList(enumValues(ReactorClaimPhases))
const CLAIM_STATUS_PROCESSING_SQL = sqlTextLiteral(ReactorClaimStatuses.Processing)
const CLAIM_STATUS_COMPLETED_SQL = sqlTextLiteral(ReactorClaimStatuses.Completed)
const CLAIM_STATUS_BLOCKED_SQL = sqlTextLiteral(ReactorClaimStatuses.Blocked)
const CLAIM_STATUS_DEFERRED_SQL = sqlTextLiteral(ReactorClaimStatuses.Deferred)
const CLAIM_PHASE_ACQUIRED_SQL = sqlTextLiteral(ReactorClaimPhases.Acquired)
const CHECKPOINT_OUTCOMES_SQL = sqlTextLiteralList(enumValues(ReactorCheckpointOutcomes))
const FINAL_CLAIM_STATUSES_SQL = sqlTextLiteralList([
  ReactorClaimStatuses.Completed,
  ReactorClaimStatuses.Blocked,
  ReactorClaimStatuses.Deferred,
])

export const createReactorSourceClaimsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.reactor_source_claims (
      consumer_id          TEXT NOT NULL,
      source_entry_id      TEXT NOT NULL,
      source_event         TEXT NOT NULL,
      primary_key          TEXT NOT NULL,

      owner_key            TEXT NOT NULL,
      policy_epoch         TEXT NOT NULL,
      registry_fingerprint TEXT NOT NULL,

      claim_status         TEXT NOT NULL CHECK (claim_status IN (${sql.unsafe(CLAIM_STATUSES_SQL)})),
      claim_token          TEXT NOT NULL,
      claimed_by           TEXT NOT NULL,
      attempt              INTEGER NOT NULL DEFAULT 1 CHECK (attempt > 0),
      phase                TEXT NOT NULL DEFAULT ${sql.unsafe(CLAIM_PHASE_ACQUIRED_SQL)} CHECK (phase IN (${sql.unsafe(CLAIM_PHASES_SQL)})),

      claimed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      heartbeat_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      lease_expires_at     TIMESTAMPTZ NOT NULL,
      attempt_deadline_at  TIMESTAMPTZ NOT NULL,
      phase_started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      next_retry_at        TIMESTAMPTZ,
      completed_at         TIMESTAMPTZ,
      blocked_at           TIMESTAMPTZ,

      outcome              TEXT CHECK (outcome IN (${sql.unsafe(CHECKPOINT_OUTCOMES_SQL)})),
      conflict_reason      TEXT,
      last_error           TEXT,
      metadata             JSONB NOT NULL DEFAULT '{}'::jsonb,

      PRIMARY KEY (consumer_id, source_entry_id),
      CHECK ((claim_status = ${sql.unsafe(CLAIM_STATUS_COMPLETED_SQL)}) = (completed_at IS NOT NULL)),
      CHECK ((claim_status = ${sql.unsafe(CLAIM_STATUS_BLOCKED_SQL)}) = (blocked_at IS NOT NULL)),
      CHECK ((claim_status = ${sql.unsafe(CLAIM_STATUS_DEFERRED_SQL)}) = (next_retry_at IS NOT NULL)),
      CHECK (lease_expires_at <= attempt_deadline_at OR claim_status IN (${sql.unsafe(FINAL_CLAIM_STATUSES_SQL)}))
    )
  `

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_reactor_source_claims_owner_status
    ON iiot.reactor_source_claims (owner_key, claim_status, claimed_at)
  `

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_reactor_source_claims_lease
    ON iiot.reactor_source_claims (claim_status, lease_expires_at)
    WHERE claim_status = ${sql.unsafe(CLAIM_STATUS_PROCESSING_SQL)}
  `

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_reactor_source_claims_epoch
    ON iiot.reactor_source_claims (policy_epoch, registry_fingerprint, claimed_at DESC)
  `

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_reactor_source_claims_deferred
    ON iiot.reactor_source_claims (next_retry_at)
    WHERE claim_status = ${sql.unsafe(CLAIM_STATUS_DEFERRED_SQL)}
  `
})
