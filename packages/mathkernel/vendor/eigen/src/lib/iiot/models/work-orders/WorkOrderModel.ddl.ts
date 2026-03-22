/**
 * WorkOrderModel DDL - Co-located database schema for WorkOrder entity
 *
 * Includes work_orders table, indexes, and status transition constraints.
 * Supports ISA-95 Level 3 operations management.
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

// =============================================================================
// Work Orders Table DDL
// =============================================================================

/**
 * Creates the work_orders table in the iiot schema.
 *
 * Columns derived from WorkOrderModel:
 * - id: TEXT PRIMARY KEY (auto-generated WorkOrderId, e.g., 'WO-2026-00001')
 * - workflow_definition_id: TEXT NOT NULL (FK to workflow_definitions)
 * - workflow_version: TEXT NOT NULL
 * - title: TEXT NOT NULL
 * - description: TEXT NOT NULL
 * - type: TEXT NOT NULL (ISA-95 work order types)
 * - priority: TEXT NOT NULL
 * - status: TEXT NOT NULL (lifecycle state)
 * - created_by: TEXT NOT NULL
 * - created_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * - ... optional fields for lifecycle management
 * - transitions: JSONB NOT NULL DEFAULT '[]' (FDA 21 CFR Part 11 audit trail)
 */
export const createWorkOrdersTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.work_orders (
      id                      TEXT PRIMARY KEY DEFAULT 'WO-' || to_char(NOW(), 'YYYY') || '-' || lpad(nextval('iiot.work_order_seq')::TEXT, 5, '0'),
      workflow_definition_id  TEXT NOT NULL,
      workflow_version        TEXT NOT NULL,
      title                   TEXT NOT NULL,
      description             TEXT NOT NULL DEFAULT '',
      type                    TEXT NOT NULL CHECK (type IN (
        'preventive_maintenance', 'corrective_maintenance', 'emergency_repair',
        'calibration', 'inspection', 'installation', 'modification',
        'decommissioning', 'production', 'changeover', 'cleaning', 'other'
      )),
      priority                TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent', 'emergency')),
      status                  TEXT NOT NULL CHECK (status IN (
        'created', 'submitted', 'approved', 'rejected', 'started',
        'suspended', 'resumed', 'completed', 'failed', 'cancelled', 'closed'
      )),
      created_by              TEXT NOT NULL,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      scheduled_start         TIMESTAMPTZ,
      due_date                TIMESTAMPTZ,
      actual_start            TIMESTAMPTZ,
      actual_end              TIMESTAMPTZ,
      expected_resume         TIMESTAMPTZ,
      parent_work_order_id    TEXT REFERENCES iiot.work_orders(id),
      primary_asset_id        TEXT,
      failed_task_id          TEXT,
      assigned_to             TEXT,
      summary                 TEXT,
      failure_reason          TEXT,
      cancellation_reason     TEXT,
      outcome                 TEXT CHECK (outcome IS NULL OR outcome IN ('success', 'partial', 'failed', 'cancelled')),
      suspension_reason       TEXT CHECK (suspension_reason IS NULL OR suspension_reason IN (
        'awaiting_parts', 'awaiting_approval', 'awaiting_personnel',
        'equipment_unavailable', 'safety_hold', 'quality_hold',
        'scheduling_conflict', 'external_dependency', 'other'
      )),
      final_status            TEXT CHECK (final_status IS NULL OR final_status IN (
        'completed_success', 'completed_partial', 'failed',
        'cancelled_before_start', 'cancelled_during_execution'
      )),
      compensation_required   BOOLEAN NOT NULL DEFAULT FALSE,
      metadata                JSONB DEFAULT '{}',
      -- FDA 21 CFR Part 11 audit trail: append-only state transition history
      -- Each element: {workOrderId, fromState, toState, transitionedAt, transitionedBy?, reason?}
      transitions             JSONB NOT NULL DEFAULT '[]'
    )
  `

  // Indexes for common query patterns
  yield* sql`CREATE INDEX IF NOT EXISTS idx_work_orders_status ON iiot.work_orders (status, created_at DESC)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_work_orders_type ON iiot.work_orders (type, status)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_work_orders_priority ON iiot.work_orders (priority, status) WHERE status NOT IN ('closed', 'rejected')`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_work_orders_assigned ON iiot.work_orders (assigned_to, status) WHERE assigned_to IS NOT NULL`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_work_orders_asset ON iiot.work_orders (primary_asset_id, status) WHERE primary_asset_id IS NOT NULL`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_work_orders_due ON iiot.work_orders (due_date) WHERE due_date IS NOT NULL AND status NOT IN ('closed', 'rejected', 'cancelled')`
})

// =============================================================================
// Work Order Sequence DDL
// =============================================================================

/**
 * Creates sequence for work order numbering.
 */
export const createWorkOrderSequence = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`CREATE SEQUENCE IF NOT EXISTS iiot.work_order_seq START WITH 1 INCREMENT BY 1`
})
