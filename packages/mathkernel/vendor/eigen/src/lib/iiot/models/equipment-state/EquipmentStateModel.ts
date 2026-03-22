/**
 * EquipmentStateModel - Effect SQL Model for EquipmentState Entity
 *
 * Derives from EquipmentState domain schema with Model-specific transforms
 * for PostgreSQL persistence. Tracks ISA-95/OEE standard equipment states
 * for machine availability, performance, and quality metrics.
 *
 * @module
 */

import { Option, Schema } from 'effect'
import { Model } from '@effect/sql'
import {
  EquipmentStateId,
  StateType,
  StateReason,
} from '../../schemas/equipment-state/schema'
import { MachineId } from '../../schemas/assets/machine/schema'
import { CreatedAt, OptionalMetadata } from '../_common'

// =============================================================================
// Model Definition
// =============================================================================

// =============================================================================
// OEE Category Type
// =============================================================================

/** OEE classification categories for equipment states */
export type OeeCategory = 'productive' | 'availability_loss' | 'performance_loss'

/**
 * Equipment State Model
 *
 * Derives from EquipmentState domain schema (schemas/equipment-state/schema.ts).
 * Applies Model-specific transforms for PostgreSQL:
 * - Optional fields -> Model.FieldOption (NULL <-> Option)
 * - DateTimeUtc -> Model.DateTimeInsertFromDate (pg Date objects)
 * - Metadata -> Model.FieldOption(MetadataRecord) (JSONB as parsed objects)
 *
 * PK: id (auto-generated EquipmentStateId, e.g., "EST-xxxxx")
 * FK: machineId -> iiot.machines(machine_id)
 *
 * State Types (ISA-95/OEE):
 * - running: Productive time (OEE availability numerator)
 * - idle: Performance loss (available but not producing)
 * - planned_downtime: Availability loss (scheduled)
 * - unplanned_downtime: Availability loss (unscheduled)
 * - setup: Performance loss (changeover)
 * - blocked: Performance loss (starved/blocked)
 */
export class EquipmentStateModel extends Model.Class<EquipmentStateModel>('EquipmentState')({
  /** Auto-generated equipment state identifier (e.g., "EST-mch001-20260130-001") */
  id: Model.Generated(EquipmentStateId),

  /** Machine this state belongs to (FK to machines table) */
  machineId: MachineId,

  /** Current state type (ISA-95/OEE standard) */
  state: StateType,

  /** Detailed reason for state (optional, for root cause analysis) */
  reason: Model.FieldOption(StateReason),

  /** When this state period started (set on insert) */
  startedAt: CreatedAt,

  /** When this state period ended (None if current/active state) */
  endedAt: Model.FieldOption(Schema.DateFromSelf),

  /** Operator who initiated or recorded this state change */
  operatorId: Model.FieldOption(Schema.String),

  /** Free-form notes about this state */
  notes: Model.FieldOption(Schema.String),

  /** Extensible metadata (JSONB column, parsed by pg driver) */
  metadata: OptionalMetadata,
}) {
  // ===========================================================================
  // OEE Classification Methods (ISA-95/OEE Standard)
  // ===========================================================================

  /**
   * Check if state is productive (running = producing value)
   */
  isProductive(): boolean {
    return this.state === 'running'
  }

  /**
   * Check if state is an availability loss (machine not available)
   * Includes: planned_downtime, unplanned_downtime
   */
  isAvailabilityLoss(): boolean {
    return this.state === 'planned_downtime' || this.state === 'unplanned_downtime'
  }

  /**
   * Check if state is a performance loss (available but not producing)
   * Includes: idle, setup, blocked
   */
  isPerformanceLoss(): boolean {
    return this.state === 'idle' || this.state === 'setup' || this.state === 'blocked'
  }

  /**
   * Get the OEE category for this state
   */
  getOeeCategory(): OeeCategory {
    if (this.isProductive()) return 'productive'
    if (this.isAvailabilityLoss()) return 'availability_loss'
    return 'performance_loss'
  }

  /**
   * Check if this state period is still active (not ended)
   */
  isActive(): boolean {
    return Option.isNone(this.endedAt)
  }
}
