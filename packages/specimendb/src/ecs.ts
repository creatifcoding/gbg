import type { AnalogId, SpecimenId } from './schemas/identifiers'

/**
 * specimendb is an ECS. Layout is mined from iiot (schemas / repos / entity / Rpc).
 * The mental model is not ISA-95 and not a Card row with 20 required columns.
 *
 * Entity = branded id. Components attach over time. Systems use what's present.
 */

export const SPECIMENDB_ENTITIES = [
  'specimen',
  'analog',
  'organism',
  'structure',
  'mechanism',
  'function',
  'observation',
  'attachment',
  'tag',
  'question',
] as const
export type SpecimendbEntity = (typeof SPECIMENDB_ENTITIES)[number]

export const SPECIMENDB_COMPONENTS = [
  'status',
  'claim',
  'media',
  'exif',
  'locality',
  'taxon',
  'structure',
  'mechanism',
  'function',
  'analogLink',
  'tag',
  'question',
  'observation',
] as const
export type SpecimendbComponent = (typeof SPECIMENDB_COMPONENTS)[number]

export const SPECIMENDB_SYSTEMS = [
  'intake',
  'capture',
  'file',
  'identify',
  'relate',
] as const
export type SpecimendbSystem = (typeof SPECIMENDB_SYSTEMS)[number]

export type SpecimendbEntityId = SpecimenId | AnalogId

/** Intake attaches Status(raw) at birth. Everything else is optional. */
export const INTAKE_REQUIRED_COMPONENTS = ['status'] as const

export const IDENTIFY_SYSTEM_STATUS = 'later' as const
