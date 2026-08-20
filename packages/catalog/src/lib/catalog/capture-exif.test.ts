import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseMetadata, writeMetadata } from '@uswriting/exiftool'
import { tagsFromCapture } from '../../../capture/tags.js'
import { localityFromExif } from './exif'

const jpegWithoutExif = Uint8Array.from(
  Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AP/Z',
    'base64',
  ),
)

const vendorDir = path.resolve(
  fileURLToPath(new URL('../../../capture/vendor', import.meta.url)),
)

describe('capture ExifTool write', () => {
  it('vendors WASM next to a relative import, not a CDN', () => {
    const js = readFileSync(path.join(vendorDir, 'exiftool.js'), 'utf8')
    expect(js.startsWith('import{MemoryFileSystem as O,ZeroPerl as E}from"./zeroperl.js"')).toBe(
      true,
    )
    expect(js).not.toMatch(/https?:\/\/[^"' ]+zeroperl/)
    expect(existsSync(path.join(vendorDir, 'zeroperl.wasm'))).toBe(true)
    expect(existsSync(path.join(vendorDir, 'zeroperl.js'))).toBe(true)
  })

  it('writes GPS tags into a JPEG without inventing a city', async () => {
    const capturedAt = new Date(Date.UTC(2026, 7, 20, 18, 1, 2))
    const tags = tagsFromCapture({
      capturedAt,
      coords: { latitude: 32.2217, longitude: -110.9265 },
    })
    const file = { name: 'cup.jpg', data: jpegWithoutExif }
    const result = await writeMetadata(file, tags, { args: ['-m'] })
    expect(result.success).toBe(true)
    if (!result.success) return

    const bytes = new Uint8Array(result.data)
    expect(bytes.byteLength).toBeGreaterThan(jpegWithoutExif.byteLength)

    const read = await parseMetadata(
      { name: 'cup.jpg', data: bytes },
      {
        args: ['-json', '-n', '-GPSLatitude', '-GPSLongitude', '-DateTimeOriginal'],
        transform: (raw) => JSON.parse(raw) as unknown,
      },
    )
    expect(read.success).toBe(true)
    if (!read.success) return
    const row = Array.isArray(read.data) ? read.data[0] : read.data
    expect(row).toMatchObject({
      GPSLatitude: expect.any(Number),
      GPSLongitude: expect.any(Number),
    })
    const locality = localityFromExif(row as Record<string, unknown>)
    expect(locality._tag).toBe('gps')
    if (locality._tag === 'gps') {
      expect(locality.latitude).toBeCloseTo(32.2217, 3)
      expect(locality.longitude).toBeCloseTo(-110.9265, 3)
    }
    expect(JSON.stringify(row)).not.toMatch(/Tucson|geocode/i)
  }, 60_000)

  it('leaves GPS off when coords are missing', async () => {
    const tags = tagsFromCapture({
      capturedAt: new Date('2026-08-20T12:00:00Z'),
      coords: null,
    })
    const result = await writeMetadata(
      { name: 'stripped.jpg', data: jpegWithoutExif },
      tags,
      { args: ['-m'] },
    )
    expect(result.success).toBe(true)
    if (!result.success) return
    const read = await parseMetadata(
      { name: 'stripped.jpg', data: new Uint8Array(result.data) },
      {
        args: ['-json', '-n', '-GPSLatitude', '-GPSLongitude', '-DateTimeOriginal'],
        transform: (raw) => JSON.parse(raw) as unknown,
      },
    )
    expect(read.success).toBe(true)
    if (!read.success) return
    const row = (Array.isArray(read.data) ? read.data[0] : read.data) as Record<
      string,
      unknown
    >
    expect(row.GPSLatitude).toBeUndefined()
    expect(row.GPSLongitude).toBeUndefined()
    expect(localityFromExif(row)._tag).toBe('unknown')
  }, 60_000)
})
