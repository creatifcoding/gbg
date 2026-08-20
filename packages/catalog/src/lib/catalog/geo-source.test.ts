import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const catalogRoot = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)))

const BANNED =
  /cf-ipcountry|ipapi|ip-api|ipinfo|geoip|nominatim|reverseGeocode/i

const LOCKED_SOURCES = [
  'capture/capture.js',
  'capture/tags.js',
  'src/lib/catalog/exif.ts',
  'src/lib/catalog/functions.ts',
  'src/lib/catalog/store.server.ts',
]

describe('locality source of truth', () => {
  it('does not use IP geo, Cloudflare country headers, or geocoding in capture or picture intake', () => {
    for (const relative of LOCKED_SOURCES) {
      const source = readFileSync(path.join(catalogRoot, relative), 'utf8')
      expect(source, relative).not.toMatch(BANNED)
    }
  })

  it('asks navigator.geolocation at shoot, not when arming the camera', () => {
    const captureJs = readFileSync(
      path.join(catalogRoot, 'capture/capture.js'),
      'utf8',
    )
    const armStart = captureJs.indexOf('async function armCamera')
    const shootStart = captureJs.indexOf('async function shoot')
    expect(armStart).toBeGreaterThan(-1)
    expect(shootStart).toBeGreaterThan(armStart)
    const armFn = captureJs.slice(armStart, shootStart)
    expect(armFn).not.toMatch(/geolocation/)
    expect(armFn).not.toMatch(/requestCoords/)
    const shootFn = captureJs.slice(shootStart)
    expect(shootFn).toMatch(/await requestCoords\(\)/)
    expect(captureJs).toMatch(/GEO_SHOT_OPTIONS/)
    expect(captureJs).toMatch(/navigator\.geolocation\.getCurrentPosition/)
  })
})
