import type { Specimen } from '../schemas/specimen'
import type { SpecimenId } from '../schemas/identifiers'
import type { CatalogSnapshot } from '../models/catalog-snapshot'
import type { CatalogEvent } from '../schemas/events'

export function findSpecimen(
  snapshot: CatalogSnapshot,
  id: SpecimenId | string,
): Specimen | undefined {
  return snapshot.specimens.find((specimen) => specimen.id === id)
}

export function upsertSpecimen(
  snapshot: CatalogSnapshot,
  specimen: Specimen,
): CatalogSnapshot {
  const index = snapshot.specimens.findIndex((item) => item.id === specimen.id)
  const specimens = snapshot.specimens.slice()
  if (index < 0) {
    specimens.unshift(specimen)
  } else {
    specimens[index] = specimen
  }
  return { ...snapshot, specimens }
}

export function appendEvents(
  snapshot: CatalogSnapshot,
  events: ReadonlyArray<CatalogEvent>,
): CatalogSnapshot {
  if (events.length === 0) return snapshot
  return { ...snapshot, events: [...snapshot.events, ...events] }
}
