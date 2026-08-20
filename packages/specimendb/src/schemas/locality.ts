import * as Schema from 'effect/Schema'

/** GPS tags were missing. Never a geocoded city, never a guessed place name. */
export const UnknownLocality = Schema.TaggedStruct('unknown', {})
export type UnknownLocality = typeof UnknownLocality.Type

/**
 * EXIF GPS fix. Latitude/longitude are required. Altitude and GPSDateTime
 * come along when those tags exist. This is not a reverse-geocoded place.
 */
export const GpsLocality = Schema.TaggedStruct('gps', {
  latitude: Schema.Number,
  longitude: Schema.Number,
  altitude: Schema.NullOr(Schema.Number),
  gpsDateTime: Schema.NullOr(Schema.NonEmptyString),
})
export type GpsLocality = typeof GpsLocality.Type

/** Typed place for non-picture dumps only. Pictures never take this path. */
export const NamedLocality = Schema.TaggedStruct('named', {
  label: Schema.NonEmptyString,
})
export type NamedLocality = typeof NamedLocality.Type

export const Locality = Schema.Union([
  UnknownLocality,
  GpsLocality,
  NamedLocality,
])
export type Locality = typeof Locality.Type

export const UNKNOWN_LOCALITY: UnknownLocality = { _tag: 'unknown' }

export const decodeLocality = Schema.decodeUnknownSync(Locality)

export function formatLocality(locality: Locality): string {
  switch (locality._tag) {
    case 'unknown':
      return 'unknown'
    case 'named':
      return locality.label
    case 'gps': {
      const coords = `${locality.latitude}, ${locality.longitude}`
      if (locality.altitude == null) return coords
      return `${coords}, ${locality.altitude} m`
    }
    default: {
      const _exhaustive: never = locality
      return _exhaustive
    }
  }
}

export function namedLocality(raw: string | null | undefined): Locality {
  const label = raw?.trim() ?? ''
  if (label.length === 0) return UNKNOWN_LOCALITY
  return { _tag: 'named', label }
}
