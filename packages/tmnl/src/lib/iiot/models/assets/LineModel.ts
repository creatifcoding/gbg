/**
 * LineModel - Effect SQL Model for Production Line Entity
 *
 * Derives from Line domain schema with Model-specific transforms
 * for PostgreSQL persistence.
 *
 * @module
 */

import { Model } from '@effect/sql'
import { LineId } from '../../schemas/identifiers'
import { Line } from '../../schemas/assets'
import { CreatedAt, UpdatedAt } from '../_common'

// =============================================================================
// Model Definition
// =============================================================================

/**
 * Line Model
 *
 * Derives from Line domain schema (schemas/assets.ts).
 * Applies Model-specific transforms for PostgreSQL:
 * - id → Model.GeneratedByApp (client-provided)
 * - Adds createdAt/updatedAt timestamps
 *
 * PK: id (client-provided LineId)
 * FK: plantId → iiot.plants(id)
 */
export class LineModel extends Model.Class<LineModel>('LineModel')({
  // Derived from Line.fields - direct reuse
  name: Line.fields.name,
  plantId: Line.fields.plantId,

  // Derived with Model-specific transforms
  id: Model.GeneratedByApp(LineId),  // Add GeneratedByApp modifier

  // DB-only fields (not in domain schema)
  createdAt: CreatedAt,
  updatedAt: UpdatedAt,
}) {}
