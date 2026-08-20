import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const packageRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))

const BANNED =
  /cf-ipcountry|ipapi|ip-api|ipinfo|geoip|nominatim|reverseGeocode/i

describe('locality source of truth', () => {
  it('does not use IP geo, Cloudflare country headers, or geocoding', () => {
    const locked = [
      'capture/capture.js',
      'capture/tags.js',
      'src/exif.ts',
      'src/eat.ts',
    ]
    for (const relative of locked) {
      const source = readFileSync(path.join(packageRoot, relative), 'utf8')
      expect(source, relative).not.toMatch(BANNED)
    }
  })

  it('asks navigator.geolocation at shoot, not when arming the camera', () => {
    const captureJs = readFileSync(
      path.join(packageRoot, 'capture/capture.js'),
      'utf8',
    )
    const armStart = captureJs.indexOf('async function armCamera')
    const shootStart = captureJs.indexOf('async function shoot')
    expect(armStart).toBeGreaterThan(-1)
    expect(shootStart).toBeGreaterThan(armStart)
    const armFn = captureJs.slice(armStart, shootStart)
    expect(armFn).not.toMatch(/geolocation/)
    const shootFn = captureJs.slice(shootStart)
    expect(shootFn).toMatch(/await requestCoords\(\)/)
  })
})
