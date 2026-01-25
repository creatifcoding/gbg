/**
 * PlantModel - Effect SQL Model for Plant Entity
 *
 * Derives from Plant domain schema with Model-specific transforms
 * for PostgreSQL persistence.
 *
 * @module
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import { PlantId } from '../../schemas/identifiers'
import { Plant } from '../../schemas/assets'
import { CreatedAt, UpdatedAt } from '../_common'

// =============================================================================
// Model Definition
// =============================================================================

/**
 * Plant Model
 *
 * Derives from Plant domain schema (schemas/assets.ts).
 * Applies Model-specific transforms for PostgreSQL:
 * - id → Model.GeneratedByApp (client-provided)
 * - location → Model.FieldOption (NULL ↔ Option)
 * - Adds createdAt/updatedAt timestamps
 *
 * PK: id (client-provided PlantId)
 */
export class PlantModel extends Model.Class<PlantModel>('PlantModel')({
  // Derived from Plant.fields - direct reuse
  name: Plant.fields.name,

  // Derived with Model-specific transforms
  id: Model.GeneratedByApp(PlantId),         // Add GeneratedByApp modifier
  location: Model.FieldOption(Schema.String), // Schema.optional → Model.FieldOption

  // DB-only fields (not in domain schema)
  createdAt: CreatedAt,
  updatedAt: UpdatedAt,
}) {}
