import type { CatalogEvent } from '../schemas/events'
import type { CatalogSnapshot } from '../models/catalog-snapshot'

export function eventsForEntity(
  snapshot: CatalogSnapshot,
  entityId: string,
): CatalogEvent[] {
  return snapshot.events.filter((event) => event.entityId === entityId)
}

export function insertEvents(
  snapshot: CatalogSnapshot,
  events: ReadonlyArray<CatalogEvent>,
): CatalogSnapshot {
  if (events.length === 0) return snapshot
  return { ...snapshot, events: [...snapshot.events, ...events] }
}
