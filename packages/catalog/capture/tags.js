/** Build ExifTool tags for a captured still. GPS omitted when coords are missing. */

export function pad2(value) {
  return String(value).padStart(2, '0')
}

export function formatExifLocal(date) {
  return `${date.getFullYear()}:${pad2(date.getMonth() + 1)}:${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

export function formatExifUtc(date) {
  return `${date.getUTCFullYear()}:${pad2(date.getUTCMonth() + 1)}:${pad2(date.getUTCDate())} ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}`
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
