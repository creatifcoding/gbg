import type { SearchResultItem } from '../schemas'

/**
 * Canonical extracted position from SearchResultItem.
 */
export interface ExtractedPosition {
  readonly lon: number
  readonly lat: number
  readonly altitudeM?: number
}

/**
 * Extract a normalized lon/lat(/altitude) tuple from any SearchResultItem.
 *
 * Returns null when the position payload is malformed.
 */
export function extractSearchResultPosition(
  result: SearchResultItem
): ExtractedPosition | null {
  if (!('position' in result)) {
    return null
  }

  const pos = result.position as readonly number[]
  if (!Array.isArray(pos) || pos.length < 2) {
    return null
  }

  const lon = pos[0]
  const lat = pos[1]

  if (typeof lon !== 'number' || typeof lat !== 'number') {
    return null
  }

  switch (result._tag) {
    case 'SearchResultFlight':
    case 'SearchResultTrack': {
      const altitudeM = typeof pos[2] === 'number' ? pos[2] : undefined
      return { lon, lat, altitudeM }
    }

    case 'SearchResultPoi':
    case 'SearchResultFeature':
    case 'SearchResultWeather':
    case 'SearchResultImagery':
      return { lon, lat }
  }
}
