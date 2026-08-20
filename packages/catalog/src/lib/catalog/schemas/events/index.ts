import { Schema } from 'effect'
import { AnalogEvent } from './analog-events'
import { CardEvent } from './card-events'

export * from './card-events'
export * from './analog-events'

export const CatalogEvent = Schema.Union([CardEvent, AnalogEvent])
export type CatalogEvent = typeof CatalogEvent.Type

export const decodeCatalogEvent = Schema.decodeUnknownSync(CatalogEvent)
