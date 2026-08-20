import type { Analog } from '../schemas/analog'
import type { AnalogId } from '../schemas/identifiers'
import type { CatalogSnapshot } from '../models/catalog-snapshot'
import type { CatalogEvent } from '../schemas/events'

export function findAnalog(
  snapshot: CatalogSnapshot,
  id: AnalogId | string,
): Analog | undefined {
  return snapshot.analogs.find((analog) => analog.id === id)
}

export function upsertAnalog(
  snapshot: CatalogSnapshot,
  analog: Analog,
): CatalogSnapshot {
  const index = snapshot.analogs.findIndex((item) => item.id === analog.id)
  const analogs = snapshot.analogs.slice()
  if (index < 0) {
    analogs.unshift(analog)
  } else {
    analogs[index] = analog
  }
  return { ...snapshot, analogs }
}

export function appendAnalogEvents(
  snapshot: CatalogSnapshot,
  events: ReadonlyArray<CatalogEvent>,
): CatalogSnapshot {
  if (events.length === 0) return snapshot
  return { ...snapshot, events: [...snapshot.events, ...events] }
}
