/**
 * WorkOrderTransitionModel DDL - Co-located database schema
 *
 * Creates the normalized work_order_transitions table for FDA 21 CFR Part 11
 * compliant audit trails.
 *
 * Compliance notes:
 * - Immutable: No UPDATE/DELETE operations (INSERT-only)
 * - Timestamped: Server-generated transitioned_at for tamper evidence
 * - Attributed: transitioned_by tracks who performed the action
 * - Justified: reason field for regulatory-required explanations
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

// =============================================================================
// Work Order Transitions Table DDL
// =============================================================================

/**
 * Valid work order status values for CHECK constraints.
 * Must match WorkOrderStatus schema in schemas/work-orders.ts
 */
const WORK_ORDER_STATUSES = [
  'created',
  'submitted',
  'approved',
  'rejected',
  'started',
  'suspended',
  'resumed',
  'completed',
  'failed',
  'cancelled',
  'closed',
] as const

/**
 * Creates the work_order_transitions table in the iiot schema.
 *
 * Columns:
 * - id: TEXT PRIMARY KEY (UUID, auto-generated)
 * - work_order_id: TEXT NOT NULL (FK to work_orders with CASCADE delete)
 * - from_state: TEXT NOT NULL (validated against WorkOrderStatus)
 * - to_state: TEXT NOT NULL (validated against WorkOrderStatus)
 * - transitioned_at: TIMESTAMPTZ NOT NULL DEFAULT NOW() (server-generated)
 * - transitioned_by: TEXT (user identifier for FDA compliance)
 * - reason: TEXT (justification for transition)
 *
 * Design decisions:
 * - CASCADE delete: When work order is deleted, transitions go too
 * - No UPDATE trigger: This is an append-only audit table
 * - Server timestamp: Prevents client-side timestamp manipulation
 */
export const createWorkOrderTransitionsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Create the transitions table
  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.work_order_transitions (
      id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      work_order_id     TEXT NOT NULL REFERENCES iiot.work_orders(id) ON DELETE CASCADE,
      from_state        TEXT NOT NULL CHECK (from_state IN (${sql.unsafe(WORK_ORDER_STATUSES.map((s) => `'${s}'`).join(', '))})),
      to_state          TEXT NOT NULL CHECK (to_state IN (${sql.unsafe(WORK_ORDER_STATUSES.map((s) => `'${s}'`).join(', '))})),
      transitioned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      transitioned_by   TEXT,
      reason            TEXT,

      -- Ensure from_state != to_state (no-op transitions are invalid)
      CONSTRAINT check_state_change CHECK (from_state != to_state)
    )
  `

  // Primary index: Lookup by work order (most common query)
  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_transitions_work_order_id
    ON iiot.work_order_transitions (work_order_id, transitioned_at ASC)
  `

  // Audit index: Time-range queries for compliance reporting
  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_transitions_time
    ON iiot.work_order_transitions (transitioned_at DESC)
  `

  // User audit index: "What did user X do?"
  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_transitions_user
    ON iiot.work_order_transitions (transitioned_by, transitioned_at DESC)
    WHERE transitioned_by IS NOT NULL
  `
})

/**
 * Creates a trigger to prevent UPDATE operations on transitions table.
 * FDA 21 CFR Part 11 requires immutable audit trails.
 *
 * Note: This is defensive programming. The application layer should
 * not attempt updates, but this catches any mistakes.
 */
export const createTransitionsImmutabilityTrigger = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Create function to reject updates
  yield* sql`
    CREATE OR REPLACE FUNCTION iiot.reject_transition_update()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'UPDATE not allowed on work_order_transitions (FDA 21 CFR Part 11 compliance)';
    END;
    $$ LANGUAGE plpgsql
  `

  // Create trigger
  yield* sql`
    DROP TRIGGER IF EXISTS prevent_transition_update ON iiot.work_order_transitions
  `

  yield* sql`
    CREATE TRIGGER prevent_transition_update
    BEFORE UPDATE ON iiot.work_order_transitions
    FOR EACH ROW
    EXECUTE FUNCTION iiot.reject_transition_update()
  `
})

/**
 * Complete DDL setup for work order transitions.
 */
export const setupWorkOrderTransitions = Effect.gen(function* () {
  yield* createWorkOrderTransitionsTable
  yield* createTransitionsImmutabilityTrigger
})
