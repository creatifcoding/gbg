import { describe, expect, it } from 'vitest'
import {
  GEO_SHOT_OPTIONS,
  captureFilename,
  coordsFromGeolocation,
  tagsFromCapture,
} from '../capture/tags.js'

describe('capture tags', () => {
  it('writes GPS tags when a fix exists', () => {
    const capturedAt = new Date(Date.UTC(2026, 7, 20, 15, 4, 11))
    const tags = tagsFromCapture({
      capturedAt,
      coords: { latitude: 32.2217, longitude: -110.9265 },
    })
    expect(tags.GPSLatitude).toBe('32.2217')
    expect(tags.GPSLatitudeRef).toBe('N')
    expect(tags.GPSLongitude).toBe('110.9265')
    expect(tags.GPSLongitudeRef).toBe('W')
  })

  it('omits GPS when location is denied', () => {
    const tags = tagsFromCapture({
      capturedAt: new Date('2026-08-20T12:00:00'),
      coords: null,
    })
    expect(tags.GPSLatitude).toBeUndefined()
    expect(tags.GPSDateTime).toBeUndefined()
    expect(JSON.stringify(tags)).not.toMatch(/32\.|Tucson|city/i)
  })

  it('names the download from the capture clock', () => {
    const capturedAt = new Date(2026, 7, 20, 9, 5, 7)
    expect(captureFilename(capturedAt)).toBe('specimen-20260820-090507.jpg')
  })

  it('takes shot coords from GeolocationCoordinates numbers only', () => {
    expect(GEO_SHOT_OPTIONS.enableHighAccuracy).toBe(true)
    expect(GEO_SHOT_OPTIONS.maximumAge).toBe(0)
    expect(
      coordsFromGeolocation({ latitude: 32.2217, longitude: -110.9265 }),
    ).toEqual({ latitude: 32.2217, longitude: -110.9265 })
    expect(coordsFromGeolocation({ latitude: 32, longitude: 'west' })).toBeNull()
  })
})
