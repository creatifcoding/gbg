import { Schema } from 'effect'
import { AnalogEvent } from './analog-events'
import { SpecimenEvent } from './specimen-events'

export * from './specimen-events'
export * from './analog-events'

export const CatalogEvent = Schema.Union([SpecimenEvent, AnalogEvent])
export type CatalogEvent = typeof CatalogEvent.Type

export const decodeCatalogEvent = Schema.decodeUnknownSync(CatalogEvent)
