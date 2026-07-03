/**
 * Crew Entity Schema
 *
 * A team of workers assigned to a discipline on a project.
 * Simple CRUD — no lifecycle states, no graph, no machine.
 *
 * @module sios/schemas/crew
 */

import { Schema, Option } from 'effect'
import { CrewId, ProjectId, WorkerId } from '../identifiers'
import { BaseSiosFields } from '../common'

// =============================================================================
// Enums
// =============================================================================

export const CrewDiscipline = Schema.Literal(
  'mechanical',
  'electrical',
  'controls',
  'steelwork',
  'fire_protection',
  'general',
  'commissioning',
  'multi_trade'
)
export type CrewDiscipline = typeof CrewDiscipline.Type

export const CrewShiftPattern = Schema.Literal(
  'day',
  'night',
  'swing',
  'extended',
  'rotating'
)
export type CrewShiftPattern = typeof CrewShiftPattern.Type

// =============================================================================
// Crew Entity — TaggedClass
// =============================================================================

export class Crew extends Schema.TaggedClass<Crew>()('Crew', {
  id: CrewId,
  projectId: ProjectId,
  name: Schema.NonEmptyString,
  discipline: CrewDiscipline,
  shiftPattern: CrewShiftPattern,
  /** Foreman's WorkerId */
  foremanId: Schema.optionalWith(WorkerId, { as: 'Option' }),
  /** Target headcount for this crew */
  targetHeadcount: Schema.Number.pipe(Schema.greaterThan(0)),
  /** Is this crew currently active on the project? */
  isActive: Schema.Boolean,

  ...BaseSiosFields,
}) {
  /** Check if crew is fully staffed given current count */
  isFullyStaffed(currentCount: number): boolean {
    return currentCount >= this.targetHeadcount
  }
}

// =============================================================================
// Create Params
// =============================================================================

export const CreateCrewParams = Schema.Struct({
  projectId: ProjectId,
  name: Schema.NonEmptyString,
  discipline: CrewDiscipline,
  shiftPattern: CrewShiftPattern,
  foremanId: Schema.optional(WorkerId),
  targetHeadcount: Schema.Number.pipe(Schema.greaterThan(0)),
})
export type CreateCrewParams = typeof CreateCrewParams.Type

// =============================================================================
// Update Params
// =============================================================================

export const UpdateCrewParams = Schema.Struct({
  name: Schema.optional(Schema.NonEmptyString),
  shiftPattern: Schema.optional(CrewShiftPattern),
  foremanId: Schema.optional(WorkerId),
  targetHeadcount: Schema.optional(Schema.Number.pipe(Schema.greaterThan(0))),
  isActive: Schema.optional(Schema.Boolean),
})
export type UpdateCrewParams = typeof UpdateCrewParams.Type
