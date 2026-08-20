import { describe, expect, it } from 'vitest'
import {
  cameraFromExif,
  localityFromExif,
  observedAtFromExif,
  sidecarFromTags,
} from './exif'
import { UNKNOWN_LOCALITY } from './schemas/locality'

describe('localityFromExif', () => {
  it('uses GPSLatitude/GPSLongitude/GPSAltitude/GPSDateTime when present', () => {
    expect(
      localityFromExif({
        GPSLatitude: 32.2217,
        GPSLongitude: -110.9265,
        GPSAltitude: 728.5,
        GPSDateTime: '2026:08:19 18:04:11',
      }),
    ).toEqual({
      _tag: 'gps',
      latitude: 32.2217,
      longitude: -110.9265,
      altitude: 728.5,
      gpsDateTime: '2026:08:19 18:04:11',
    })
  })

  it('is unknown when GPS tags are missing, and does not invent a city', () => {
    const locality = localityFromExif({
      Make: 'Apple',
      Model: 'iPhone',
      DateTimeOriginal: '2026:08:19 12:00:00',
    })
    expect(locality).toEqual(UNKNOWN_LOCALITY)
    expect(JSON.stringify(locality)).not.toMatch(/Tucson|city|geocode/i)
  })

  it('ignores generic latitude/longitude dumps from IP or pixels', () => {
    expect(
      localityFromExif({
        latitude: 32,
        longitude: -110,
      }),
    ).toEqual(UNKNOWN_LOCALITY)
  })
})

describe('camera and DateTimeOriginal', () => {
  it('pulls DateTimeOriginal, Make, and Model when present', () => {
    const tags = {
      DateTimeOriginal: '2026:08:19 07:11:02',
      Make: 'Canon',
      Model: 'EOS R5',
    }
    expect(observedAtFromExif(tags)).toBe('2026:08:19 07:11:02')
    expect(cameraFromExif(tags)).toEqual({ make: 'Canon', model: 'EOS R5' })
  })

  it('marks a sidecar stripped when GPS, DateTimeOriginal, and camera are absent', () => {
    const sidecar = sidecarFromTags({
      tool: 'exiftool',
      tags: {},
      originalPresent: false,
    })
    expect(sidecar.stripped).toBe(true)
    expect(localityFromExif(sidecar.tags)).toEqual(UNKNOWN_LOCALITY)
  })
})
