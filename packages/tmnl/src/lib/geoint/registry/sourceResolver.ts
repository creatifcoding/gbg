import type { IntelSource as EcsIntelSource } from '@/lib/ecs'
import type { IntelSource as GeointIntelSource } from '../schemas/search'
import type { CanonicalIntelSource } from './schemas'
import { resolveCanonicalSource } from './sourceRegistry'

const SOURCE_TO_CANONICAL: Record<string, CanonicalIntelSource> = {
  // GEOINT search schema literals (canonical only)
  track: 'track',
  feature: 'feature',
  osm: 'osm',
  opensky: 'opensky',
  'adsb-lol': 'adsb-lol',
  planet: 'planet',
  sentinel: 'sentinel',
  openmeteo: 'openmeteo',
  custom: 'custom',
  // additional canonical sources surfaced by registry adapters
  noaa: 'noaa',
  overpass: 'overpass',
  nominatim: 'nominatim',
  'copernicus-stac': 'copernicus-stac',
  'planetary-computer': 'planetary-computer',
}

const CANONICAL_TO_ECS: Record<CanonicalIntelSource, EcsIntelSource> = {
  // ECS direct
  opensky: 'opensky',
  'adsb-lol': 'adsb-lol',
  flightradar24: 'flightradar24',
  overpass: 'overpass',
  osm: 'osm',
  nominatim: 'nominatim',
  planet: 'planet',
  sentinel: 'sentinel',
  maxar: 'maxar',
  openmeteo: 'openmeteo',
  noaa: 'noaa',
  manual: 'manual',
  derived: 'derived',
  fused: 'fused',
  unknown: 'unknown',
  // registry extensions mapped into ECS domain
  track: 'derived',
  feature: 'derived',
  aisstream: 'unknown',
  'marine-traffic': 'unknown',
  gdacs: 'unknown',
  firms: 'unknown',
  usgs: 'unknown',
  'copernicus-stac': 'sentinel',
  'planetary-computer': 'derived',
  worldpop: 'derived',
  gdelt: 'derived',
  acled: 'derived',
  custom: 'unknown',
}

export const normalizeToCanonicalSource = (source: string): CanonicalIntelSource => {
  const lowered = source.toLowerCase()

  const fromRegistry = resolveCanonicalSource(lowered)
  if (fromRegistry) return fromRegistry

  return SOURCE_TO_CANONICAL[lowered] ?? 'unknown'
}

export const toEcsIntelSource = (source: string): EcsIntelSource =>
  CANONICAL_TO_ECS[normalizeToCanonicalSource(source)]

export const normalizeGeointSourceListToEcs = (
  sources: ReadonlyArray<GeointIntelSource>
): ReadonlyArray<EcsIntelSource> => {
  const mapped = sources.map((source) => toEcsIntelSource(source))
  return [...new Set(mapped)]
}
