/**
 * ReactorConstraintModel DDL.
 *
 * SQL-first authority for target-owned Reactor constraints. Local Effect
 * primitives may serialize/coalesce in-process callers, but this table is the
 * distributed source of truth for assert/retract/reconcile state.
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'
import {
  ReactorConstraintEffects,
  ReactorConstraintFamilies,
  ReactorConstraintStates,
} from '../../schemas/reactor'
import {
  EntityCapabilityIds,
  RELATIONSHIP_EDGE_TYPE_VALUES,
  RELATIONSHIP_NODE_TYPE_VALUES,
} from '../../schemas/relationships'
import { enumValues, sqlTextLiteral, sqlTextLiteralList } from '../_ddl-helpers'

const NODE_TYPES_SQL = sqlTextLiteralList(RELATIONSHIP_NODE_TYPE_VALUES)
const EDGE_TYPES_SQL = sqlTextLiteralList(RELATIONSHIP_EDGE_TYPE_VALUES)
const CAPABILITY_IDS_SQL = sqlTextLiteralList(enumValues(EntityCapabilityIds))
const CONSTRAINT_FAMILIES_SQL = sqlTextLiteralList(enumValues(ReactorConstraintFamilies))
const CONSTRAINT_STATES_SQL = sqlTextLiteralList(enumValues(ReactorConstraintStates))
const CONSTRAINT_EFFECTS_SQL = sqlTextLiteralList(enumValues(ReactorConstraintEffects))
const CONSTRAINT_STATE_ASSERTED_SQL = sqlTextLiteral(ReactorConstraintStates.Asserted)
const CONSTRAINT_STATE_RETRACTED_SQL = sqlTextLiteral(ReactorConstraintStates.Retracted)

export const createReactorConstraintsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.reactor_constraints (
      target_type           TEXT NOT NULL CHECK (target_type IN (${sql.unsafe(NODE_TYPES_SQL)})),
      target_id             TEXT NOT NULL,
      capability            TEXT NOT NULL CHECK (capability IN (${sql.unsafe(CAPABILITY_IDS_SQL)})),
      family                TEXT NOT NULL CHECK (family IN (${sql.unsafe(CONSTRAINT_FAMILIES_SQL)})),

      source_type           TEXT NOT NULL CHECK (source_type IN (${sql.unsafe(NODE_TYPES_SQL)})),
      source_id             TEXT NOT NULL,
      relationship_edge_type TEXT NOT NULL CHECK (relationship_edge_type IN (${sql.unsafe(EDGE_TYPES_SQL)})),

      policy_id             TEXT NOT NULL,
      policy_version        TEXT NOT NULL,
      policy_epoch          TEXT NOT NULL,
      registry_fingerprint  TEXT NOT NULL,

      source_entry_id       TEXT NOT NULL,
      source_event          TEXT NOT NULL,
      propagation_id        TEXT NOT NULL,

      state                 TEXT NOT NULL CHECK (state IN (${sql.unsafe(CONSTRAINT_STATES_SQL)})),
      effect                TEXT NOT NULL CHECK (effect IN (${sql.unsafe(CONSTRAINT_EFFECTS_SQL)})),
      asserted_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      retracted_at          TIMESTAMPTZ,
      metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,

      constraint_id         TEXT GENERATED ALWAYS AS (
        'rc_' || md5(
          target_type || ':' || target_id || ':' || capability || ':' ||
          source_type || ':' || source_id || ':' || relationship_edge_type || ':' ||
          policy_id || ':' || propagation_id
        )
      ) STORED,

      PRIMARY KEY (constraint_id),
      CHECK (state <> ${sql.unsafe(CONSTRAINT_STATE_RETRACTED_SQL)} OR retracted_at IS NOT NULL),
      UNIQUE (
        target_type,
        target_id,
        capability,
        source_type,
        source_id,
        relationship_edge_type,
        policy_id,
        propagation_id
      )
    )
  `

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_reactor_constraints_target_active
    ON iiot.reactor_constraints (target_type, target_id, family, asserted_at DESC)
    WHERE state = ${sql.unsafe(CONSTRAINT_STATE_ASSERTED_SQL)}
  `

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_reactor_constraints_source_entry
    ON iiot.reactor_constraints (source_entry_id)
  `

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_reactor_constraints_policy_epoch
    ON iiot.reactor_constraints (policy_epoch, registry_fingerprint, asserted_at DESC)
  `
})
