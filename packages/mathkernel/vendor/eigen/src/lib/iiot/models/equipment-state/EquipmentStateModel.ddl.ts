/**
 * EquipmentStateModel DDL - Co-located database schema for EquipmentState entity
 *
 * Includes equipment_states table and indexes for OEE tracking.
 * Supports ISA-95/OEE standard equipment state management.
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

// =============================================================================
// Equipment States Table DDL
// =============================================================================

/**
 * Creates the equipment_states table in the iiot schema.
 *
 * Columns derived from EquipmentStateModel:
 * - id: TEXT PRIMARY KEY (auto-generated EquipmentStateId, e.g., 'EST-xxxxx')
 * - machine_id: TEXT NOT NULL (FK to machines)
 * - state: TEXT NOT NULL (ISA-95/OEE state types)
 * - reason: TEXT (nullable, detailed reason for state)
 * - started_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * - ended_at: TIMESTAMPTZ (nullable, set when state ends)
 * - operator_id: TEXT (nullable)
 * - notes: TEXT (nullable)
 * - metadata: JSONB DEFAULT '{}'
 */
export const createEquipmentStatesTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.equipment_states (
      id              TEXT PRIMARY KEY DEFAULT 'EST-' || gen_random_uuid()::TEXT,
      machine_id      TEXT NOT NULL,
      state           TEXT NOT NULL CHECK (state IN (
        'running', 'idle', 'planned_downtime', 'unplanned_downtime', 'setup', 'blocked'
      )),
      reason          TEXT CHECK (reason IS NULL OR reason IN (
        'production', 'test_run', 'warmup',
        'no_operator', 'no_order', 'awaiting_material',
        'scheduled_maintenance', 'break', 'shift_change', 'cleaning',
        'breakdown', 'quality_issue', 'tool_failure', 'electrical', 'mechanical',
        'changeover', 'tooling_change', 'material_change',
        'starved', 'blocked_downstream', 'waiting_approval',
        'other', 'unknown'
      )),
      started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at        TIMESTAMPTZ,
      operator_id     TEXT,
      notes           TEXT,
      metadata        JSONB DEFAULT '{}'
    )
  `

  // Indexes for common query patterns
  yield* sql`CREATE INDEX IF NOT EXISTS idx_equipment_states_machine ON iiot.equipment_states (machine_id, started_at DESC)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_equipment_states_state ON iiot.equipment_states (state, started_at DESC)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_equipment_states_active ON iiot.equipment_states (machine_id, started_at DESC) WHERE ended_at IS NULL`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_equipment_states_timerange ON iiot.equipment_states (started_at, ended_at)`

  // Partial index for OEE calculations - downtime states
  yield* sql`CREATE INDEX IF NOT EXISTS idx_equipment_states_downtime ON iiot.equipment_states (machine_id, started_at DESC)
             WHERE state IN ('planned_downtime', 'unplanned_downtime')`
})

// =============================================================================
// Equipment State Aggregation View DDL
// =============================================================================

/**
 * Creates a materialized view for equipment state duration aggregation.
 * Used for OEE calculations and downtime reports.
 */
export const createEquipmentStateDurationView = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE MATERIALIZED VIEW IF NOT EXISTS iiot.equipment_state_durations AS
    SELECT
      machine_id,
      date_trunc('hour', started_at) AS period_start,
      state,
      SUM(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at)) * 1000) AS duration_ms,
      COUNT(*) AS transition_count
    FROM iiot.equipment_states
    WHERE started_at > NOW() - INTERVAL '30 days'
    GROUP BY machine_id, date_trunc('hour', started_at), state
  `

  yield* sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_equipment_state_durations_pk
             ON iiot.equipment_state_durations (machine_id, period_start, state)`
})
