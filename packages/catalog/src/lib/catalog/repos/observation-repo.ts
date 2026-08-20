import type { Observation } from '../schemas/observation'
import type { ObservationId, SpecimenId } from '../schemas/identifiers'
import type { CatalogSnapshot } from '../models/catalog-snapshot'

export function findObservation(
  snapshot: CatalogSnapshot,
  id: ObservationId | string,
): Observation | undefined {
  return snapshot.observations.find((item) => item.id === id)
}

export function observationsForSpecimen(
  snapshot: CatalogSnapshot,
  specimenId: SpecimenId | string,
): Observation[] {
  return snapshot.observations.filter((item) => item.specimenId === specimenId)
}

export function upsertObservation(
  snapshot: CatalogSnapshot,
  observation: Observation,
): CatalogSnapshot {
  const index = snapshot.observations.findIndex(
    (item) => item.id === observation.id,
  )
  const observations = snapshot.observations.slice()
  if (index < 0) {
    observations.unshift(observation)
  } else {
    observations[index] = observation
  }
  return { ...snapshot, observations }
}
