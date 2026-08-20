/** Build ExifTool tags from a browser Geolocation API fix taken at shot time. */

export const GEO_SHOT_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 10000,
}

export function pad2(value) {
  return String(value).padStart(2, '0')
}

export function formatExifLocal(date) {
  return `${date.getFullYear()}:${pad2(date.getMonth() + 1)}:${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

export function formatExifUtc(date) {
  return `${date.getUTCFullYear()}:${pad2(date.getUTCMonth() + 1)}:${pad2(date.getUTCDate())} ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}`
}

/**
 * Read lat/lon from a GeolocationPosition.coords object.
 * Returns null when the numbers are missing. Does not guess, geocode, or use IP.
 */
export function coordsFromGeolocation(coords) {
  if (!coords) return null
  const latitude = coords.latitude
  const longitude = coords.longitude
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return { latitude, longitude }
}

export function tagsFromCapture({ capturedAt, coords }) {
  const tags = {
    DateTimeOriginal: formatExifLocal(capturedAt),
  }
  if (
    !coords ||
    !Number.isFinite(coords.latitude) ||
    !Number.isFinite(coords.longitude)
  ) {
    return tags
  }
  tags.GPSLatitude = String(Math.abs(coords.latitude))
  tags.GPSLatitudeRef = coords.latitude >= 0 ? 'N' : 'S'
  tags.GPSLongitude = String(Math.abs(coords.longitude))
  tags.GPSLongitudeRef = coords.longitude >= 0 ? 'E' : 'W'
  tags.GPSDateTime = formatExifUtc(capturedAt)
  return tags
}

export function captureFilename(capturedAt) {
  return `specimen-${capturedAt.getFullYear()}${pad2(capturedAt.getMonth() + 1)}${pad2(capturedAt.getDate())}-${pad2(capturedAt.getHours())}${pad2(capturedAt.getMinutes())}${pad2(capturedAt.getSeconds())}.jpg`
}
