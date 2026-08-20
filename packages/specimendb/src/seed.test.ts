import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { FIRST_SPECIMEN, SECOND_SPECIMEN } from './seed'
import { localityFromExif } from './exif'
import { UNKNOWN_LOCALITY } from './schemas/locality'

const packageRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))

describe('filed seed specimens', () => {
  it('keeps 20260819-001 as a stripped field catch without GPS', () => {
    expect(FIRST_SPECIMEN.id).toBe('20260819-001')
    expect(FIRST_SPECIMEN.kind).toBe('picture')
    expect(FIRST_SPECIMEN.locality).toBeUndefined()
    const sidecar = JSON.parse(
      readFileSync(
        path.join(packageRoot, 'assets/specimens/20260819-001/exif.json'),
        'utf8',
      ),
    ) as { stripped: boolean; originalPresent: boolean; tags: Record<string, unknown> }
    expect(sidecar.stripped).toBe(true)
    expect(sidecar.originalPresent).toBe(false)
    expect(localityFromExif(sidecar.tags)).toEqual(UNKNOWN_LOCALITY)
  })

  it('keeps 20260819-002 as an Apple TextKit emoji HEIC without GPS', () => {
    expect(SECOND_SPECIMEN.id).toBe('20260819-002')
    expect(SECOND_SPECIMEN.kind).toBe('picture')
    expect(SECOND_SPECIMEN.locality).toBeUndefined()
    const sidecar = JSON.parse(
      readFileSync(
        path.join(packageRoot, 'assets/specimens/20260819-002/exif.json'),
        'utf8',
      ),
    ) as { originalPresent: boolean; note: string; tags: Record<string, unknown> }
    expect(sidecar.originalPresent).toBe(false)
    expect(sidecar.note).toMatch(/HEIC/)
    expect(sidecar.note).toMatch(/GPS/)
    expect(localityFromExif(sidecar.tags)).toEqual(UNKNOWN_LOCALITY)
    expect(existsSync(path.join(packageRoot, 'assets/specimens/20260819-002'))).toBe(
      true,
    )
  })
})
