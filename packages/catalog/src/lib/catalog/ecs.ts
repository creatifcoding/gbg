import type { AnalogId, SpecimenId } from './schemas/identifiers'

/**
 * Catalog is an ECS. Layout is mined from iiot (schemas / models / repos / entity).
 * The mental model is not ISA-95 and not a Card row with 20 required columns.
 *
 * Entity = branded id. Components attach over time. Systems use what's present.
 */

export const CATALOG_ENTITIES = [
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
export type CatalogEntity = (typeof CATALOG_ENTITIES)[number]

export const CATALOG_COMPONENTS = [
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
export type CatalogComponent = (typeof CATALOG_COMPONENTS)[number]

export const CATALOG_SYSTEMS = [
  'intake',
  'capture',
  'file',
  'identify',
  'relate',
] as const
export type CatalogSystem = (typeof CATALOG_SYSTEMS)[number]

export type CatalogEntityId = SpecimenId | AnalogId

/** Intake attaches Status(raw) at birth. Everything else is optional. */
export const INTAKE_REQUIRED_COMPONENTS = ['status'] as const

export const IDENTIFY_SYSTEM_STATUS = 'later' as const
