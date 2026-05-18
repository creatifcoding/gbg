/**
 * EquipmentStateTransitionModel DDL - append-only equipment state transition audit.
 *
 * Captures one row per equipment state transition for causal DAG reconstruction.
 * The equipment_states table stores state intervals; this table stores the
 * transition fact and Reactor propagation metadata.
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

const EQUIPMENT_STATES = [
  'running',
  'idle',
  'planned_downtime',
  'unplanned_downtime',
  'setup',
  'blocked',
] as const

const STATE_REASONS = [
  'production',
  'test_run',
  'warmup',
  'no_operator',
  'no_order',
  'awaiting_material',
  'scheduled_maintenance',
  'break',
  'shift_change',
  'cleaning',
  'breakdown',
  'quality_issue',
  'tool_failure',
  'electrical',
  'mechanical',
  'changeover',
  'tooling_change',
  'material_change',
  'starved',
  'blocked_downstream',
  'waiting_approval',
  'other',
  'unknown',
] as const

const quoted = (values: readonly string[]) => values.map((value) => `'${value}'`).join(', ')

export const createEquipmentStateTransitionsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.equipment_state_transitions (
      id                           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      machine_id                   TEXT NOT NULL,
      equipment_state_id           TEXT NOT NULL REFERENCES iiot.equipment_states(id) ON DELETE CASCADE,
      from_state                   TEXT NOT NULL CHECK (from_state IN (${sql.unsafe(quoted(EQUIPMENT_STATES))})),
      to_state                     TEXT NOT NULL CHECK (to_state IN (${sql.unsafe(quoted(EQUIPMENT_STATES))})),
      transitioned_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      transitioned_by              TEXT,
      reason                       TEXT CHECK (reason IS NULL OR reason IN (${sql.unsafe(quoted(STATE_REASONS))})),
      notes                        TEXT,
      propagation_id               TEXT,
      caused_by_propagation_id     TEXT,

      CONSTRAINT check_equipment_state_change CHECK (from_state != to_state)
    )
  `

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_equipment_state_transitions_machine
    ON iiot.equipment_state_transitions (machine_id, transitioned_at ASC)
  `

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_equipment_state_transitions_state_id
    ON iiot.equipment_state_transitions (equipment_state_id)
  `

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_equipment_state_transitions_time
    ON iiot.equipment_state_transitions (transitioned_at DESC)
  `

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_equipment_state_transitions_user
    ON iiot.equipment_state_transitions (transitioned_by, transitioned_at DESC)
    WHERE transitioned_by IS NOT NULL
  `

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_equipment_state_transitions_propagation_id
    ON iiot.equipment_state_transitions (propagation_id)
    WHERE propagation_id IS NOT NULL
  `

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_equipment_state_transitions_caused_by_propagation_id
    ON iiot.equipment_state_transitions (caused_by_propagation_id)
    WHERE caused_by_propagation_id IS NOT NULL
  `

  yield* sql`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_equipment_state_transition_inbound_propagation
    ON iiot.equipment_state_transitions (machine_id, caused_by_propagation_id)
    WHERE caused_by_propagation_id IS NOT NULL
  `
})

export const createEquipmentStateTransitionsImmutabilityTrigger = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE OR REPLACE FUNCTION iiot.reject_equipment_state_transition_update()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'UPDATE not allowed on equipment_state_transitions (append-only audit trail)';
    END;
    $$ LANGUAGE plpgsql
  `

  yield* sql`
    DROP TRIGGER IF EXISTS prevent_equipment_state_transition_update ON iiot.equipment_state_transitions
  `

  yield* sql`
    CREATE TRIGGER prevent_equipment_state_transition_update
    BEFORE UPDATE ON iiot.equipment_state_transitions
    FOR EACH ROW
    EXECUTE FUNCTION iiot.reject_equipment_state_transition_update()
  `
})

export const setupEquipmentStateTransitions = Effect.gen(function* () {
  yield* createEquipmentStateTransitionsTable
  yield* createEquipmentStateTransitionsImmutabilityTrigger
})
