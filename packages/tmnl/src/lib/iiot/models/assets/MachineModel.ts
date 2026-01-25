/**
 * MachineModel - Effect SQL Model for Machine Entity
 *
 * Derives from Machine domain schema with Model-specific transforms
 * for PostgreSQL persistence.
 *
 * @module
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import { MachineId } from '../../schemas/identifiers'
import { Machine } from '../../schemas/assets'
import { CreatedAt, UpdatedAt } from '../_common'

// =============================================================================
// Model Definition
// =============================================================================

/**
 * Machine Model
 *
 * Derives from Machine domain schema (schemas/assets.ts).
 * Applies Model-specific transforms for PostgreSQL:
 * - id → Model.GeneratedByApp (client-provided)
 * - model → Model.FieldOption (NULL ↔ Option)
 * - Adds createdAt/updatedAt timestamps
 *
 * PK: id (client-provided MachineId)
 * FK: lineId → iiot.lines(id)
 */
export class MachineModel extends Model.Class<MachineModel>('MachineModel')({
  // Derived from Machine.fields - direct reuse
  name: Machine.fields.name,
  lineId: Machine.fields.lineId,

  // Derived with Model-specific transforms
  id: Model.GeneratedByApp(MachineId),        // Add GeneratedByApp modifier
  model: Model.FieldOption(Schema.String),    // Schema.optional → Model.FieldOption

  // DB-only fields (not in domain schema)
  createdAt: CreatedAt,
  updatedAt: UpdatedAt,
}) {}
