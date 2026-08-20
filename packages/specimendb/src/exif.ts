import { dateFromExifDateTime } from './specimen-id'
import { UNKNOWN_LOCALITY, type GpsLocality, type Locality } from './schemas/locality'

export type ExifToolName = 'exiftool' | 'exifr'

export type ExifSidecar = {
  tool: ExifToolName
  stripped: boolean
  originalPresent: boolean
  note?: string
  tags: Record<string, unknown>
}

function tagString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString()
  }
  if (value && typeof value === 'object') {
    if ('rawValue' in value && typeof value.rawValue === 'string') {
      return tagString(value.rawValue)
    }
    if ('toISOString' in value && typeof value.toISOString === 'function') {
      try {
        const iso = value.toISOString()
        return typeof iso === 'string' ? iso : null
      } catch {
        return null
      }
    }
  }
  return null
}

function tagNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const match = value.trim().match(/^[-+]?\d+(?:\.\d+)?/)
    if (!match) return null
    const parsed = Number.parseFloat(match[0])
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function firstTag(
  tags: Record<string, unknown>,
  names: ReadonlyArray<string>,
): unknown {
  for (const name of names) {
    if (name in tags && tags[name] != null) return tags[name]
    const grouped = Object.entries(tags).find(([key]) => {
      const bare = key.includes(':') ? key.slice(key.indexOf(':') + 1) : key
      return bare === name
    })
    if (grouped && grouped[1] != null) return grouped[1]
  }
  return undefined
}

/** EXIF GPS tags only. Generic latitude/longitude dumps are not locality. */
const GPS_LAT = ['GPSLatitude'] as const
const GPS_LON = ['GPSLongitude'] as const
const GPS_ALT = ['GPSAltitude'] as const
const GPS_DT = ['GPSDateTime'] as const

export function localityFromExif(tags: Record<string, unknown>): Locality {
  const latitude = tagNumber(firstTag(tags, GPS_LAT))
  const longitude = tagNumber(firstTag(tags, GPS_LON))
  if (latitude == null || longitude == null) return UNKNOWN_LOCALITY

  const altitude = tagNumber(firstTag(tags, GPS_ALT))
  const gpsDateTime = tagString(firstTag(tags, GPS_DT))

  const gps: GpsLocality = {
    _tag: 'gps',
    latitude,
    longitude,
    altitude,
    gpsDateTime,
  }
  return gps
}

export function observedAtFromExif(tags: Record<string, unknown>): string | null {
  return tagString(
    firstTag(tags, ['DateTimeOriginal', 'CreateDate', 'dateTimeOriginal']),
  )
}

export function cameraFromExif(tags: Record<string, unknown>): {
  make: string | null
  model: string | null
} {
  return {
    make: tagString(firstTag(tags, ['Make', 'make'])),
    model: tagString(firstTag(tags, ['Model', 'model', 'CameraModelName'])),
  }
}

export function filingDateFromExif(
  tags: Record<string, unknown>,
  fallback: Date,
): Date {
  const original = observedAtFromExif(tags)
  if (!original) return fallback
  return dateFromExifDateTime(original) ?? fallback
}

export function sidecarFromTags(input: {
  tool: ExifToolName
  tags: Record<string, unknown>
  originalPresent: boolean
  note?: string
}): ExifSidecar {
  const locality = localityFromExif(input.tags)
  const observedAt = observedAtFromExif(input.tags)
  const camera = cameraFromExif(input.tags)
  const stripped =
    locality._tag === 'unknown' &&
    observedAt == null &&
    camera.make == null &&
    camera.model == null
  return {
    tool: input.tool,
    stripped,
    originalPresent: input.originalPresent,
    ...(input.note ? { note: input.note } : {}),
    tags: input.tags,
  }
}

/** Drop File: and Composite: prefixes from an exiftool -G dump so GPS* keys resolve. */
export function flattenExifTags(
  tags: Record<string, unknown>,
): Record<string, unknown> {
  const flat: Record<string, unknown> = { ...tags }
  for (const [key, value] of Object.entries(tags)) {
    const colon = key.lastIndexOf(':')
    if (colon === -1) continue
    const bare = key.slice(colon + 1)
    if (!(bare in flat)) flat[bare] = value
  }
  return flat
}
